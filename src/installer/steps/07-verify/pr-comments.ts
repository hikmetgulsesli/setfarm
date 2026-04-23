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

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../../../lib/logger.js";

const execFileAsync = promisify(execFile);

export interface PrComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  state?: string; // review state: APPROVED, CHANGES_REQUESTED, COMMENTED
  kind: "issue" | "review" | "review-comment";
}

export interface PrState {
  state: "OPEN" | "CLOSED" | "MERGED";
  mergeable?: string;
  checksStatus?: string;
  comments: PrComment[];
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
      "--json", "state,mergeable,statusCheckRollup,comments,reviews",
    ], { timeout: 30000 });

    const data = JSON.parse(stdout);
    const comments: PrComment[] = [];

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
        kind: "review",
      });
    }

    const rollup = Array.isArray(data.statusCheckRollup) ? data.statusCheckRollup : [];
    const anyFailing = rollup.some((s: any) => s?.conclusion === "FAILURE" || s?.state === "FAILURE");
    const allPassing = rollup.length > 0 && rollup.every((s: any) => s?.conclusion === "SUCCESS" || s?.state === "SUCCESS");
    const checksStatus = anyFailing ? "failing" : allPassing ? "passing" : "pending";

    return {
      state: data.state,
      mergeable: data.mergeable,
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

  const actionable = state.comments.filter(c => {
    if (!c.body || c.body.trim().length < 5) return false;
    // Skip bot-generated auto-merge notifications and similar noise
    if (/^(auto-merge|automerge|merge conflict|ci)\b/i.test(c.body.trim())) return false;
    return true;
  });

  if (actionable.length === 0) return "";

  const lines = [
    `## PR Comments (${actionable.length} actionable)`,
    "",
    `PR state: ${state.state}, checks: ${state.checksStatus || "unknown"}, mergeable: ${state.mergeable || "unknown"}`,
    "",
  ];
  for (const c of actionable.slice(0, 20)) {
    const body = c.body.trim().replace(/\s+/g, " ").slice(0, 400);
    const tag = c.state ? `[${c.kind}:${c.state}]` : `[${c.kind}]`;
    lines.push(`- ${tag} @${c.author}: ${body}`);
  }
  lines.push("");
  lines.push("Her comment için uygun fix'i aynı branch'e push et, sonra yorumu addresslediğini belirt.");
  return lines.join("\n");
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
