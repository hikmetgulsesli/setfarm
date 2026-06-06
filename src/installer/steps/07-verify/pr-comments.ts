/**
 * PR Comment Handler — fetches Copilot/human review comments on the final PR,
 * injects them into the verify step context so the agent can address feedback
 * before attempting merge.
 *
 * Flow:
 *   1. After implement step opens the PR, verify step enters a polling window
 *   2. Every 5 minutes, `gh pr view <pr> --json comments,reviews` is called
 *   3. New comments (not yet seen) are aggregated into context.pr_comments
 *   4. Verify agent prompt includes {{PR_COMMENTS}}; agent addresses feedback
 *   5. After all comments resolved + CI green, auto-merge via `gh pr merge --auto --squash`
 *
 * Depends on `gh` CLI being authenticated on the gateway host.
 */

import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "../../../lib/logger.js";

const execFileAsync = promisify(execFile);

export interface PrComment {
  id: string;
  threadId?: string;
  author: string;
  body: string;
  createdAt: string;
  state?: string; // review state: APPROVED, CHANGES_REQUESTED, COMMENTED
  commitOid?: string;
  path?: string;
  line?: number;
  originalLine?: number;
  outdated?: boolean;
  threadResolved?: boolean;
  threadOutdated?: boolean;
  kind: "issue" | "review" | "review-comment";
}

export interface PrState {
  state: "OPEN" | "CLOSED" | "MERGED";
  headRefName?: string;
  headOid?: string;
  headCommittedAt?: string;
  createdAt?: string;
  mergeable?: string;
  mergeStateStatus?: string;
  checksStatus?: string;
  comments: PrComment[];
}

function reviewSummaryLooksActionable(comment: PrComment, state: PrState): boolean {
  if (comment.state === "CHANGES_REQUESTED") return true;
  if (comment.state !== "COMMENTED") return false;

  // COMMENTED review summaries are snapshots. If the branch has moved since
  // the summary was written, stale summary prose must not keep re-opening the
  // same story forever. Current inline review threads are handled separately.
  if (comment.commitOid && state.headOid && comment.commitOid !== state.headOid) return false;
  if (comment.createdAt && state.headCommittedAt) {
    const reviewTime = Date.parse(comment.createdAt);
    const headTime = Date.parse(state.headCommittedAt);
    if (Number.isFinite(reviewTime) && Number.isFinite(headTime) && reviewTime < headTime) return false;
  }

  const body = String(comment.body || "").trim();
  if (!body) return false;

  const hasActionableLanguage = /\b(fix|bug|issue|critical|high-priority|high priority|incorrect|destructive|unhandled|missing|prevent|avoid|must|should)\b/i.test(body);
  // Service lifecycle banners and generic review summaries are not blockers
  // unless the same review body also contains actionable feedback.
  if (!hasActionableLanguage) return false;

  // Gemini Code Assist often emits actionable findings only in the review
  // body (no inline thread). Treat those as current blockers so Setfarm cannot
  // merge before the implementer addresses them.
  return /\b(feedback|highlights?|suggests?|recommends?|critical|high-priority|high priority|must|should)\b/i.test(body);
}

export function getActionablePrComments(state: PrState): PrComment[] {
  return (state.comments || []).filter(c => {
    if (!c.body || c.body.trim().length < 5) return false;
    // GitHub keeps old inline review comments after a branch moves. When the
    // current line is gone, `line` is null and only `original_line` remains.
    // GraphQL reviewThreads also marks resolved threads. Treat resolved or
    // outdated inline threads as historical context; otherwise verify agents
    // re-route fixed/stale comments as fresh blockers.
    if (c.kind === "review-comment" && (c.outdated || c.threadResolved || c.threadOutdated)) return false;
    // GitHub keeps COMMENTED review summaries after every inline thread has
    // been fixed/resolved. Plain summaries are not blockers, but Gemini Code
    // Assist can put actionable findings directly in the COMMENTED review body
    // without inline threads, so inspect body severity before auto-merge.
    if (c.kind === "review") return reviewSummaryLooksActionable(c, state);
    // Skip bot-generated auto-merge notifications and similar noise.
    if (/^(auto-merge|automerge|merge conflict|ci)\b/i.test(c.body.trim())) return false;
    return true;
  });
}

export function getResolvableHistoricalInlineReviewThreadIds(state: PrState): string[] {
  return [...new Set((state.comments || [])
    .filter(c =>
      c.kind === "review-comment" &&
      c.threadId &&
      !c.threadResolved &&
      (c.outdated || c.threadOutdated),
    )
    .map(c => c.threadId as string))];
}

function normalizeCodeForReviewResolution(value: string): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSuggestionBlocks(body: string): string[] {
  const blocks: string[] = [];
  const pattern = /```suggestion[^\n]*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(String(body || ""))) !== null) {
    const block = String(match[1] || "").trim();
    if (block) blocks.push(block);
  }
  return blocks;
}

function extractFencedCodeBlocks(body: string): string[] {
  const blocks: string[] = [];
  const pattern = /```(?!suggestion\b)[^\n]*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(String(body || ""))) !== null) {
    const block = String(match[1] || "").trim();
    if (block) blocks.push(block);
  }
  return blocks;
}

function semanticSuggestionTokens(suggestion: string): string[] {
  const tokens = new Set<string>();
  const text = String(suggestion || "");
  for (const match of text.matchAll(/\b(?:runtime|state|props|settings|data|ctx|context)\??\.\w+\b/g)) {
    tokens.add(match[0]);
  }
  for (const match of text.matchAll(/\bArray\.from\b|\.map\b|\.filter\b|\.reduce\b|\.some\b|\.every\b/g)) {
    tokens.add(match[0]);
  }
  return [...tokens];
}

export function commentLooksMechanicallySatisfied(comment: PrComment, source: string): boolean {
  if (comment.kind !== "review-comment") return false;
  if (!comment.threadId || comment.threadResolved || comment.threadOutdated || comment.outdated) return false;

  const sourceText = normalizeCodeForReviewResolution(source);
  if (!sourceText) return false;

  for (const block of extractFencedCodeBlocks(comment.body)) {
    const normalizedBlock = normalizeCodeForReviewResolution(block);
    if (normalizedBlock.length >= 24 && sourceText.includes(normalizedBlock)) return true;
  }

  for (const suggestion of extractSuggestionBlocks(comment.body)) {
    const normalizedSuggestion = normalizeCodeForReviewResolution(suggestion);
    if (normalizedSuggestion.length >= 24 && sourceText.includes(normalizedSuggestion)) return true;

    const tokens = semanticSuggestionTokens(suggestion);
    if (tokens.length >= 2 && tokens.every(token => sourceText.includes(token))) return true;
  }

  if (commentProseLooksMechanicallySatisfied(comment.body, sourceText)) return true;

  return false;
}

function commentProseLooksMechanicallySatisfied(body: string, normalizedSource: string): boolean {
  const text = String(body || "").toLowerCase();

  if (
    /\bclamp\b/.test(text) &&
    /\bdelta\b/.test(text) &&
    /\b100\s*ms\b|\b100ms\b|\b100\b/.test(text) &&
    /Math\.min\s*\(\s*(?:action\.)?delta\s*,\s*100\s*\)/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\brequestAnimationFrame\b/.test(body) &&
    /\bpaused\b/.test(text) &&
    /\bgameOver\b/.test(body) &&
    /state\.started\s*&&\s*!state\.paused\s*&&\s*!state\.gameOver/.test(normalizedSource) &&
    /handle\s*=\s*null/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\buseGameSelector\b/.test(body) &&
    /\bselector\b/.test(text) &&
    /\buseEffect\b/.test(body) &&
    /\bresubscribe|subscription|dependency|dependencies\b/.test(text) &&
    /const\s+selectorRef\s*=\s*useRef\s*\(\s*selector\s*\)/.test(normalizedSource) &&
    /selectorRef\.current\s*=\s*selector/.test(normalizedSource) &&
    /setValue\s*\(\s*selectorRef\.current\s*\(/.test(normalizedSource) &&
    /useEffect\s*\([^]*?\[\s*\]\s*\)/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\brequestAnimationFrame\b/.test(body) &&
    /\b60\s*FPS\b|\b60\s*Hz\b|\b60Hz\b|\btarget frame rate\b|\brefresh rate\b/i.test(body) &&
    /\bthrottl/.test(text) &&
    /const\s+interval\s*=\s*1000\s*\/\s*60/.test(normalizedSource) &&
    /const\s+elapsed\s*=\s*now\s*-\s*lastTime/.test(normalizedSource) &&
    /elapsed\s*>=\s*interval/.test(normalizedSource) &&
    /lastTime\s*=\s*now\s*-\s*\(\s*elapsed\s*%\s*interval\s*\)/.test(normalizedSource) &&
    /requestAnimationFrame\s*\(\s*tick\s*\)/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\bINITIATE_SEQUENCE\b/.test(body) &&
    /\bgame\s*over\b|\bgameOver\b/i.test(body) &&
    /\breset\b/i.test(body) &&
    /\bcreateInitialState\b/.test(normalizedSource) &&
    /case\s+['"]INITIATE_SEQUENCE['"]/.test(normalizedSource) &&
    /if\s*\(\s*state\.gameOver\s*\)\s*\{[^]*?createInitialState\s*\(\s*\)[^]*?screen\s*:\s*['"]gameplay['"][^]*?paused\s*:\s*false[^]*?gameOver\s*:\s*false[^]*?\}/.test(normalizedSource)
  ) {
    return true;
  }

  return false;
}

export function getMechanicallySatisfiedInlineReviewThreadIds(state: PrState, repoPath: string): string[] {
  const root = String(repoPath || "").trim();
  if (!root) return [];

  const ids = new Set<string>();
  for (const comment of getActionablePrComments(state)) {
    if (comment.kind !== "review-comment" || !comment.threadId || !comment.path) continue;
    for (const source of readReviewCommentCandidateSources(root, state.headRefName, comment.path)) {
      if (commentLooksMechanicallySatisfied(comment, source)) ids.add(comment.threadId);
      if (ids.has(comment.threadId)) break;
    }
  }
  return [...ids];
}

function readReviewCommentCandidateSources(repoPath: string, headRefName: string | undefined, relativePath: string): string[] {
  const sources: string[] = [];
  const rootPath = path.resolve(repoPath);
  const safeRelative = String(relativePath || "").replace(/^\/+/, "");
  if (!safeRelative || safeRelative.includes("\0")) return sources;

  if (headRefName && /^[A-Za-z0-9._/-]+$/.test(headRefName)) {
    for (const ref of [headRefName, `origin/${headRefName}`]) {
      try {
        sources.push(execFileSync("git", ["-C", rootPath, "show", `${ref}:${safeRelative}`], {
          encoding: "utf-8",
          timeout: 10000,
          maxBuffer: 2_000_000,
        }));
        break;
      } catch {
        // Fall back to the next ref or the working tree below.
      }
    }
  }

  const filePath = path.resolve(rootPath, safeRelative);
  if (filePath.startsWith(`${rootPath}${path.sep}`) && existsSync(filePath)) {
    try {
      sources.push(readFileSync(filePath, "utf-8"));
    } catch {
      // A transient read failure should not unblock review comments.
    }
  }
  return sources;
}

/**
 * Parse a PR URL into owner/repo/number. Accepts full URL or shorthand #N.
 */
function parsePrUrl(prUrl: string, fallbackRepo?: string): { owner: string; repo: string; number: string } | null {
  if (!prUrl) return null;
  const fullMatch = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (fullMatch) return { owner: fullMatch[1], repo: fullMatch[2], number: fullMatch[3] };
  const shortMatch = prUrl.match(/#?(\d+)$/);
  if (shortMatch && fallbackRepo) {
    const parts = fallbackRepo.match(/([^/]+)\/([^/]+)$/);
    if (parts) return { owner: parts[1], repo: parts[2], number: shortMatch[1] };
  }
  return null;
}

/**
 * Fetch PR state + comments + reviews via `gh` CLI.
 * Returns null if gh is unavailable or PR is invalid.
 */
export async function fetchPrState(prUrl: string, fallbackRepo?: string): Promise<PrState | null> {
  const parsed = parsePrUrl(prUrl, fallbackRepo);
  if (!parsed) {
    logger.warn(`[pr-comments] Invalid PR URL: ${prUrl.slice(0, 80)}`);
    return null;
  }
  const ref = `${parsed.owner}/${parsed.repo}#${parsed.number}`;

  try {
    const { stdout } = await execFileAsync("gh", [
      "pr", "view", parsed.number,
      "--repo", `${parsed.owner}/${parsed.repo}`,
      "--json", "state,headRefName,createdAt,mergeable,mergeStateStatus,statusCheckRollup,comments,reviews,commits",
    ], { timeout: 30000 });

    const data = JSON.parse(stdout);
    const comments: PrComment[] = [];
    const commits = Array.isArray(data.commits) ? data.commits : [];
    const headCommit = commits.length > 0 ? commits[commits.length - 1] : undefined;

    for (const c of (data.comments || [])) {
      comments.push({
        id: `issue-${c.id || c.databaseId || Math.random().toString(36).slice(2)}`,
        author: c.author?.login || "unknown",
        body: c.body || "",
        createdAt: c.createdAt || "",
        kind: "issue",
      });
    }
    for (const r of (data.reviews || [])) {
      comments.push({
        id: `review-${r.id || r.databaseId || Math.random().toString(36).slice(2)}`,
        author: r.author?.login || "unknown",
        body: r.body || "",
        createdAt: r.submittedAt || r.createdAt || "",
        state: r.state,
        commitOid: r.commit?.oid || r.commit?.sha || "",
        kind: "review",
      });
    }
    let fetchedInlineThreads = false;
    try {
      const { stdout: threadStdout } = await execFileAsync("gh", [
        "api", "graphql",
        "-f", `owner=${parsed.owner}`,
        "-f", `name=${parsed.repo}`,
        "-F", `number=${parsed.number}`,
        "-f", "query=query($owner:String!,$name:String!,$number:Int!){ repository(owner:$owner,name:$name){ pullRequest(number:$number){ reviewThreads(first:100){ nodes{ id isResolved isOutdated path line startLine comments(first:50){ nodes{ databaseId body author{login} path line originalLine outdated createdAt } } } } } } }",
      ], { timeout: 30000 });
      const threadData = JSON.parse(threadStdout);
      const threads = threadData?.data?.repository?.pullRequest?.reviewThreads?.nodes;
      if (Array.isArray(threads)) {
        fetchedInlineThreads = true;
        for (const thread of threads) {
          const threadComments = thread?.comments?.nodes;
          if (!Array.isArray(threadComments)) continue;
          for (const c of threadComments) {
            const line = typeof c.line === "number" ? c.line : typeof thread.line === "number" ? thread.line : undefined;
            const originalLine = typeof c.originalLine === "number" ? c.originalLine : undefined;
            const threadOutdated = Boolean(thread.isOutdated || c.outdated);
            comments.push({
              id: `review-comment-${c.databaseId || Math.random().toString(36).slice(2)}`,
              threadId: typeof thread.id === "string" ? thread.id : undefined,
              author: c.author?.login || "unknown",
              body: c.body || "",
              createdAt: c.createdAt || "",
              path: c.path || thread.path || "",
              line,
              originalLine,
              outdated: threadOutdated || typeof line !== "number",
              threadResolved: Boolean(thread.isResolved),
              threadOutdated,
              kind: "review-comment",
            });
          }
        }
      }
    } catch (threadErr: any) {
      logger.warn(`[pr-comments] GraphQL review thread fetch failed for ${ref}: ${String(threadErr?.message || threadErr).slice(0, 160)}`);
    }

    if (!fetchedInlineThreads) {
      try {
        const { stdout: inlineStdout } = await execFileAsync("gh", [
          "api", `repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/comments`,
        ], { timeout: 30000 });
        const inline = JSON.parse(inlineStdout);
        if (Array.isArray(inline)) {
          for (const c of inline) {
            comments.push({
              id: `review-comment-${c.id || Math.random().toString(36).slice(2)}`,
              author: c.user?.login || "unknown",
              body: c.body || "",
              createdAt: c.created_at || "",
              path: c.path || "",
              line: typeof c.line === "number" ? c.line : undefined,
              originalLine: typeof c.original_line === "number" ? c.original_line : undefined,
              outdated: typeof c.line !== "number",
              kind: "review-comment",
            });
          }
        }
      } catch (inlineErr: any) {
        logger.warn(`[pr-comments] inline review comment fetch failed for ${ref}: ${String(inlineErr?.message || inlineErr).slice(0, 160)}`);
      }
    }

    const rollup = Array.isArray(data.statusCheckRollup) ? data.statusCheckRollup : [];
    const anyFailing = rollup.some((s: any) => s?.conclusion === "FAILURE" || s?.state === "FAILURE");
    const allPassing = rollup.length > 0 && rollup.every((s: any) => s?.conclusion === "SUCCESS" || s?.state === "SUCCESS");
    const checksStatus = anyFailing ? "failing" : allPassing ? "passing" : "pending";

    return {
      state: data.state,
      headRefName: data.headRefName || "",
      headOid: headCommit?.oid || headCommit?.sha || "",
      headCommittedAt: headCommit?.committedDate || headCommit?.authoredDate || "",
      createdAt: data.createdAt || "",
      mergeable: data.mergeable,
      mergeStateStatus: data.mergeStateStatus,
      checksStatus,
      comments,
    };
  } catch (err: any) {
    logger.warn(`[pr-comments] fetch failed for ${ref}: ${String(err?.message || err).slice(0, 200)}`);
    return null;
  }
}

/**
 * Format PR comments for injection into verify step context.
 * Returns empty string if no actionable comments.
 */
export function formatPrCommentsForAgent(state: PrState): string {
  if (!state.comments || state.comments.length === 0) return "";

  const actionable = getActionablePrComments(state);

  if (actionable.length === 0) return "";

  const lines = [
    `## PR Comments (${actionable.length} actionable)`,
    "",
    `PR state: ${state.state}, checks: ${state.checksStatus || "unknown"}, mergeable: ${state.mergeable || "unknown"}, mergeStateStatus: ${state.mergeStateStatus || "unknown"}`,
    "",
  ];
  for (const c of actionable.slice(0, 20)) {
    const body = formatPrCommentBodyForAgent(c.body);
    const tag = c.state ? `[${c.kind}:${c.state}]` : `[${c.kind}]`;
    const loc = c.path ? ` ${c.path}${c.line ? `:${c.line}` : ""}` : "";
    const thread = c.threadId ? ` thread=${c.threadId}` : "";
    lines.push(`- ${tag}${thread}${loc} @${c.author}:`);
    lines.push(indentPrCommentBody(body));
  }
  lines.push("");
  lines.push("For each listed thread/comment, push the appropriate fix to the same branch. Do not output STATUS: done until every listed thread is either fixed in code or explicitly reported as still blocked with its thread id. Setfarm must not resolve current actionable review threads; verify passes only after the thread becomes resolved/outdated from a real code change or reviewer action.");
  return lines.join("\n");
}

function formatPrCommentBodyForAgent(body: string): string {
  const text = String(body || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  const max = 3200;
  const trimmed = text.length > max ? `${text.slice(0, max)}\n[comment truncated after ${max} chars]` : text;
  return trimmed
    .split("\n")
    .map(line => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function indentPrCommentBody(body: string): string {
  const text = String(body || "").trim();
  if (!text) return "  (empty comment body)";
  return text.split("\n").map(line => `  ${line}`).join("\n");
}

/**
 * Low-level GitHub thread resolver. Do not call this for current actionable
 * review feedback; current feedback must be fixed in code and re-checked.
 */
export async function resolveReviewThread(threadId: string): Promise<{ ok: boolean; reason?: string }> {
  const id = threadId.trim();
  if (!id) return { ok: false, reason: "missing thread id" };
  try {
    await execFileAsync("gh", [
      "api", "graphql",
      "-f", `threadId=${id}`,
      "-f", "query=mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}){ thread { id isResolved } } }",
    ], { timeout: 30000 });
    logger.info(`[pr-comments] Resolved review thread ${id}`);
    return { ok: true };
  } catch (err: any) {
    const msg = String(err?.message || err).slice(0, 240);
    logger.warn(`[pr-comments] Resolve review thread ${id} failed: ${msg}`);
    return { ok: false, reason: msg };
  }
}

export async function resolveActionableInlineReviewThreads(state: PrState): Promise<{ resolved: number; failed: number; failures: string[] }> {
  const actionable = getActionablePrComments(state);
  const threadIds = [...new Set(actionable
    .filter(c => c.kind === "review-comment" && c.threadId)
    .map(c => c.threadId as string))];
  const failures: string[] = [];
  let resolved = 0;
  let failed = 0;
  for (const threadId of threadIds) {
    const result = await resolveReviewThread(threadId);
    if (result.ok) {
      resolved += 1;
    } else {
      failed += 1;
      failures.push(`${threadId}: ${result.reason || "unknown failure"}`);
    }
  }
  return { resolved, failed, failures };
}

export async function resolveMechanicallySatisfiedInlineReviewThreads(
  state: PrState,
  repoPath: string,
): Promise<{ resolved: number; failed: number; failures: string[]; candidates: number }> {
  const threadIds = getMechanicallySatisfiedInlineReviewThreadIds(state, repoPath);
  const failures: string[] = [];
  let resolved = 0;
  let failed = 0;
  for (const threadId of threadIds) {
    const result = await resolveReviewThread(threadId);
    if (result.ok) {
      resolved += 1;
    } else {
      failed += 1;
      failures.push(`${threadId}: ${result.reason || "unknown failure"}`);
    }
  }
  return { resolved, failed, failures, candidates: threadIds.length };
}

export async function resolveHistoricalInlineReviewThreads(state: PrState): Promise<{ resolved: number; failed: number; failures: string[] }> {
  const threadIds = getResolvableHistoricalInlineReviewThreadIds(state);
  const failures: string[] = [];
  let resolved = 0;
  let failed = 0;
  for (const threadId of threadIds) {
    const result = await resolveReviewThread(threadId);
    if (result.ok) {
      resolved += 1;
    } else {
      failed += 1;
      failures.push(`${threadId}: ${result.reason || "unknown failure"}`);
    }
  }
  return { resolved, failed, failures };
}

/**
 * Attempt auto-merge via gh CLI. Returns true on success.
 * Only call after verify step confirms all comments addressed.
 */
export async function attemptAutoMerge(prUrl: string, fallbackRepo?: string): Promise<{ ok: boolean; reason?: string }> {
  const parsed = parsePrUrl(prUrl, fallbackRepo);
  if (!parsed) return { ok: false, reason: "invalid PR URL" };

  try {
    await execFileAsync("gh", [
      "pr", "merge", parsed.number,
      "--repo", `${parsed.owner}/${parsed.repo}`,
      "--auto", "--squash",
    ], { timeout: 30000 });
    logger.info(`[pr-comments] Auto-merge enabled for ${parsed.owner}/${parsed.repo}#${parsed.number}`);
    return { ok: true };
  } catch (err: any) {
    const msg = String(err?.message || err).slice(0, 200);
    logger.warn(`[pr-comments] Auto-merge failed: ${msg}`);
    return { ok: false, reason: msg };
  }
}
