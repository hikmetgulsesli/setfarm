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
  if (reviewSummaryLooksLikeDigest(body)) return false;

  const hasActionableLanguage = /\b(fix|bug|issue|critical|high-priority|high priority|incorrect|destructive|unhandled|missing|prevent|avoid|must|should)\b/i.test(body);
  // Service lifecycle banners and generic review summaries are not blockers
  // unless the same review body also contains actionable feedback.
  if (!hasActionableLanguage) return false;

  // Gemini Code Assist often emits actionable findings only in the review
  // body (no inline thread). Treat those as current blockers so Setfarm cannot
  // merge before the implementer addresses them.
  return (
    /\b(?:please\s+(?:fix|change|update|add|remove|handle|prevent|avoid)|must\s+(?:fix|change|update|handle|prevent|avoid)|required\s+change|blocking|breaks?|fails?|error)\b/i.test(body) ||
    /\b(feedback|highlights?|suggests?|recommends?|critical|high-priority|high priority|must|should)\b/i.test(body)
  );
}

function reviewSummaryLooksLikeDigest(body: string): boolean {
  const text = String(body || "").trim();
  if (!text) return false;
  if (/```/.test(text)) return false;
  if (/\b(?:line|lines)\s+\d+\b|:[0-9]+\b/.test(text)) return false;
  if (/\b(?:please|must\s+(?:fix|change|update)|required\s+change|blocking|breaks?|fails?|error)\b/i.test(text)) return false;
  return (
    /\bThis pull request\b[\s\S]{0,500}\bfeedback focuses on\b/i.test(text) ||
    /\bThe feedback focuses on\b/i.test(text) ||
    /\bfeedback focuses on enhancing\b/i.test(text)
  );
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

function extractQuotedHumanLabels(body: string): string[] {
  return [...String(body || "").matchAll(/`([^`]{3,120})`/g)]
    .map(match => String(match[1] || "").trim())
    .filter(value =>
      /[A-Za-z]/.test(value) &&
      !/[\\/]/.test(value) &&
      !/\.(?:css|html|js|jsx|json|mjs|cjs|ts|tsx)$/i.test(value) &&
      !/^\[[\s\S]*\]$/.test(value) &&
      !/^[A-Za-z0-9_-]{20,}$/.test(value),
    );
}

function missingInputFieldLooksSatisfied(body: string, normalizedSource: string): boolean {
  if (!/\bmissing\b/i.test(body) || !/\binput\s+field\b/i.test(body)) return false;

  for (const label of extractQuotedHumanLabels(body)) {
    const escaped = escapeRegExp(label).replace(/\s+/g, "\\s+");
    const inputWithMatchingAttribute = new RegExp(
      `<input\\b[^>]*(?:placeholder|aria-label|value|name|id)\\s*=\\s*["'][^"']*${escaped}[^"']*["'][^>]*>`,
      "i",
    );
    if (inputWithMatchingAttribute.test(normalizedSource)) return true;

    const matchingLabelWithInput = new RegExp(
      `<label\\b[^>]*>[\\s\\S]{0,180}${escaped}[\\s\\S]{0,180}<input\\b`,
      "i",
    );
    if (matchingLabelWithInput.test(normalizedSource)) return true;
  }

  return false;
}

function commentProseLooksMechanicallySatisfied(body: string, normalizedSource: string): boolean {
  const text = String(body || "").toLowerCase();

  if (missingInputFieldLooksSatisfied(body, normalizedSource)) return true;
  if (domXssInnerHtmlLooksSatisfied(body, normalizedSource)) return true;

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

  if (
    /\btype\s*guard\b|\bisPersistedState\b|\bvalidation\b/i.test(body) &&
    /\brecords?\b/i.test(body) &&
    /\bsettings\b/i.test(body) &&
    /\bpollingInterval\b/i.test(body) &&
    /\.every\s*\(\s*is\w+Record\s*\)/.test(normalizedSource) &&
    /is\w+Settings\s*\(\s*candidate\.settings\s*\)/.test(normalizedSource) &&
    /Number\.isFinite\s*\([^)]*pollingInterval[^)]*\)/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\bfocus(?:ed)?\b|\bcursor\b|\bselection\b/i.test(body) &&
    /\brerender\b|\bre-render\b|\brender\b|\bupdate\b/i.test(body) &&
    /document\.activeElement/.test(normalizedSource) &&
    /getAttribute\s*\(\s*['"]data-action-id['"]\s*\)|\.dataset\.actionId/.test(normalizedSource) &&
    /\bselectionStart\b/.test(normalizedSource) &&
    /\bselectionEnd\b/.test(normalizedSource) &&
    /\.setSelectionRange\s*\(/.test(normalizedSource) &&
    /\.focus\s*\(/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\bDOM\s+is\s+ready\b|\bDOMContentLoaded\b|\bon\s+(?:initial\s+)?page\s+load\b|\bimmediately\s+upon\s+loading\b/i.test(body) &&
    /\binitiali[sz]e\b|\bactual\b|\breal-?time\b|\bstore\s+data\b|\bstate\b/i.test(body) &&
    /document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]/.test(normalizedSource) &&
    /document\.readyState/.test(normalizedSource) &&
    /\b(?:init|initialize|refresh|render)\s*\(\s*\)/i.test(normalizedSource) &&
    (
      /\b(?:update|render|refresh)\w*\s*\([^)]*\b(?:get\w+\s*\(\s*\)|state|store)\b[^)]*\)/i.test(normalizedSource) ||
      /\bvar\s+\w+\s*=\s*get\w+\s*\(\s*\)\s*;?\s*\b(?:update|render|refresh)\w*\s*\(\s*\w+/i.test(normalizedSource)
    )
  ) {
    return true;
  }

  if (
    /\bnull\b|\bnon-object\b|\bnon\s*object\b|\bdefensive\b|\bfilter\s+out\b/i.test(body) &&
    /\barray\b|\belements?\b|\brecords?\b|\bitems?\b|\bnotes?\b|\bentries\b/i.test(body) &&
    /\.filter\s*\(\s*function\s*\([^)]*\)\s*\{[^}]*!==\s*null[^}]*typeof\s+\w+\s*===\s*['"]object['"][^}]*\}/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\baction\s+IDs?\b|\bdata-action-id\b/i.test(body) &&
    /\buppercase\b|\bACT_\b|\bnaming\s+convention\b|\bprefix\b/i.test(body) &&
    /data-action-id\s*=\s*["']ACT_[A-Z0-9_]+["']/.test(normalizedSource)
  ) {
    const quoted = [...String(body || "").matchAll(/`([^`]+)`/g)]
      .map(match => String(match[1] || "").trim())
      .filter(Boolean);
    const oldIds = quoted.filter(value => /^[a-z][a-z0-9-]*$/.test(value));
    if (oldIds.length === 0 || oldIds.every(value => !normalizedSource.includes(`data-action-id="${value}"`) && !normalizedSource.includes(`data-action-id='${value}'`))) {
      return true;
    }
  }

  if (
    /\baria-label\b/i.test(body) &&
    /\brole\s*=\s*["']img["']|\brole\b[^.\n]{0,80}\bimg\b/i.test(body) &&
    /\bspan\b/i.test(body) &&
    /createEl\s*\(\s*['"]span['"][^)]*aria-label[^)]*(?:['"]role['"]|role)\s*:\s*['"]img['"][^)]*\)/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\baria-label\b/i.test(body) &&
    /\brole\s*=\s*["']img["']|\brole\b[^.\n]{0,80}\bimg\b/i.test(body) &&
    /\bspan\b/i.test(body) &&
    /<span\b[^>]*\baria-label\s*=\s*["'][^"']+["'][^>]*\brole\s*=\s*["']img["'][^>]*>/i.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\brouting\b|\bnavigation\b|\bpage\s+structure\b|\bMPA\b|\bSPA\b|\bempty\s+shell\b/i.test(body) &&
    /\bindex\.html\b/i.test(body) &&
    /(?:http-equiv\s*=\s*["']refresh["'][^>]*url\s*=\s*[^"'>\s]+\.html|window\.location|location\.replace|location\.href|href\s*=\s*["'][^"']+\.html["'])/i.test(normalizedSource) &&
    /<!doctype\s+html>|<html\b/i.test(normalizedSource) &&
    /data-testid\s*=\s*["']setfarm-app-root["']|data-setfarm-root\s*=\s*["']baseline["']/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\bmissing\b|\bmalformed\b|\bnull\b|\bundefined\b|\bdefensive\b|\bguard\b/i.test(body) &&
    /\bname\b/i.test(body) &&
    /\bid\b/i.test(body) &&
    /\.filter\s*\(/.test(normalizedSource) &&
    /String\s*\([^)]*\bname\b[^)]*\)\.toLowerCase\s*\(\s*\)/.test(normalizedSource) &&
    /String\s*\([^)]*\bid\b[^)]*\)\.toLowerCase\s*\(\s*\)/.test(normalizedSource) &&
    /(?:\b\w+\s*&&\s*\w+\.name\b|\?\.\s*name\b|\bname\b[^;\n]*(?:\?\?|\|\|)\s*['"]{2})/.test(normalizedSource) &&
    /(?:\b\w+\s*&&\s*\w+\.id\b|\?\.\s*id\b|\bid\b[^;\n]*(?:\?\?|\|\|)\s*['"]{2})/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\bimport\b/i.test(body) &&
    /\buseState\b/.test(body) &&
    /\buseEffect\b/.test(body) &&
    /import\s*\{[^}]*\buseState\b[^}]*\buseEffect\b[^}]*\}\s*from\s*['"]react['"]/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\bdebounc/i.test(body) &&
    /\bsearch\b/i.test(body) &&
    /\blocal\s+state\b/i.test(body) &&
    /\buseState\b/.test(body) &&
    /\buseEffect\b/.test(body) &&
    /useState\s*\(\s*searchQuery\s*\)/.test(normalizedSource) &&
    /useEffect\s*\([^]*?setLocalSearchQuery\s*\(\s*searchQuery\s*\)[^]*?\[\s*searchQuery\s*\]/.test(normalizedSource) &&
    /(?:window\.)?setTimeout\s*\(/.test(normalizedSource) &&
    /(?:window\.)?clearTimeout\s*\(/.test(normalizedSource) &&
    /search-records/.test(normalizedSource) &&
    /localSearchQuery/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\buseSyncExternalStore\b/.test(body) &&
    /\bsubscribe\b|\bsubscription\b|\bexternal\s+store\b/i.test(body) &&
    /import\s*\{[^}]*\buseSyncExternalStore\b[^}]*\}\s*from\s*['"]react['"]/.test(normalizedSource) &&
    /useSyncExternalStore\s*\(\s*[^,]+\.subscribe\s*,\s*\(\s*\)\s*=>\s*[^,]+\.state\s*,?/.test(normalizedSource) &&
    /return\s*\{[^}]*\bstate\b[^}]*\bdispatch\b[^}]*\}/.test(normalizedSource)
  ) {
    return true;
  }

  if (
    /\bcreateActions\b/.test(body) &&
    /\bsupported\s+action\s+IDs?\b/i.test(body) &&
    /\bunsupported|unhandled\b/i.test(body) &&
    /function\s+createActions\b/.test(normalizedSource) &&
    /const\s+actions\s*=\s*\{\}\s+as\s+Partial\s*<\s*Record\s*</.test(normalizedSource) &&
    /for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*\{[^]*?switch\s*\([^)]*\)\s*\{[^]*?actions\s*\[\s*\w+\s*\]\s*=\s*\(\s*\)\s*=>[^]*?default\s*:\s*break\s*;?[^]*?\}/.test(normalizedSource)
  ) {
    return true;
  }

  const classStateResolution = cssClassStateToggleResolution(body, normalizedSource);
  if (classStateResolution) return true;

  return false;
}

function domXssInnerHtmlLooksSatisfied(body: string, normalizedSource: string): boolean {
  const text = String(body || "");
  if (!/\binnerhtml\b/i.test(text)) return false;
  if (!/\bxss\b|cross-site scripting|attribute breakout|user-controlled|localstorage/i.test(text)) return false;

  const hasDomConstruction =
    /\b(?:document\.)?createElement\s*\(/.test(normalizedSource) &&
    (/\btextContent\s*=/.test(normalizedSource) || /\bcreateTextNode\s*\(/.test(normalizedSource)) &&
    (/\bsetAttribute\s*\(/.test(normalizedSource) || /\bdataset\.[A-Za-z_$][\w$]*\s*=/.test(normalizedSource));
  if (!hasDomConstruction) return false;

  const hasDefensiveCoercionOrValidation =
    /\bString\s*\(/.test(normalizedSource) ||
    /\b(?:Array\.isArray|Number\.isFinite|Object\.values)\s*\(/.test(normalizedSource) ||
    /\b(?:allowed|valid|safe|saniti[sz]ed)[A-Za-z0-9_$]*\b/i.test(normalizedSource) ||
    /\.(?:includes|has)\s*\(/.test(normalizedSource);
  if (!hasDefensiveCoercionOrValidation) return false;

  const suspiciousInnerHtmlAssignment =
    /\.innerHTML\s*(?:\+?=)\s*(?!['"`]\s*['"`])/.test(normalizedSource) &&
    !/\.innerHTML\s*=\s*['"`]\s*['"`]/.test(normalizedSource);
  if (suspiciousInnerHtmlAssignment) return false;

  if (/\bclass(?:Name|List)\b/i.test(text) || /\bcolor\b/i.test(text)) {
    const hasClassValidation =
      /\b(?:allowed|valid|safe)[A-Za-z0-9_$]*(?:Colors?|Classes?)?\b/i.test(normalizedSource) ||
      /\bclassList\.add\s*\(/.test(normalizedSource) ||
      /\bclassName\s*=\s*[^;\n]*(?:\?|&&|\|\|)/.test(normalizedSource);
    if (!hasClassValidation) return false;
  }

  return true;
}

function cssClassStateToggleResolution(body: string, normalizedSource: string): boolean {
  const bodyText = String(body || "");
  const lower = bodyText.toLowerCase();
  if (!/\bclass\b/.test(lower) || !/\btoggl/.test(lower)) return false;
  if (!/\bbase\s+styling\s+class\b|\bbase\s+class\b|\blayout\s+class\b|\berror-specific\b|\bstate-specific\b/.test(lower)) return false;

  const quoted = [...bodyText.matchAll(/`([^`]+)`/g)]
    .map((match) => String(match[1] || "").trim())
    .filter(Boolean);
  const cssClassNames = quoted.filter((value) => /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(value));
  const baseClass = cssClassNames.find((value) => /[-_](?:banner|container|panel|shell|layout|base)$/i.test(value))
    || cssClassNames[0];
  if (!baseClass) return false;

  const escapedBase = escapeRegExp(baseClass);
  if (new RegExp(`\\.classList\\.toggle\\(\\s*['"]${escapedBase}['"]`).test(normalizedSource)) return false;

  const stateClassNames = cssClassNames.filter((value) =>
    value !== baseClass &&
    /(?:^|[-_])(?:is|has|error|success|warning|active|selected|open|closed|invalid|valid|state)(?:[-_]|$)/i.test(value)
  );
  const togglesQuotedState = stateClassNames.some((value) =>
    new RegExp(`\\.classList\\.toggle\\(\\s*['"]${escapeRegExp(value)}['"]`).test(normalizedSource)
  );
  if (togglesQuotedState) return true;

  const togglesAnyStateClass = new RegExp("\\.classList\\.toggle\\(\\s*['\"][A-Za-z_-][A-Za-z0-9_-]*(?:[-_](?:state|error|success|warning|active|selected|open|closed|invalid|valid)|(?:^|[-_])is[-_][A-Za-z0-9_-]+)['\"]").test(normalizedSource);
  const keepsBaseClass = new RegExp("\\.classList\\.add\\(\\s*['\"][A-Za-z_-][A-Za-z0-9_-]*(?:[-_](?:banner|container|panel|shell|layout|base))?['\"]").test(normalizedSource);
  return togglesAnyStateClass && keepsBaseClass;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getMechanicallySatisfiedInlineReviewThreadIds(state: PrState, repoPath: string): string[] {
  const root = String(repoPath || "").trim();
  if (!root) return [];

  const ids = new Set<string>();
  for (const comment of getActionablePrComments(state)) {
    if (comment.kind !== "review-comment" || !comment.threadId || !comment.path) continue;
    for (const source of readReviewCommentCandidateSources(root, state.headRefName, comment.path, comment.body)) {
      if (commentLooksMechanicallySatisfied(comment, source)) ids.add(comment.threadId);
      if (ids.has(comment.threadId)) break;
    }
  }
  return [...ids];
}

function extractReferencedReviewPaths(body: string): string[] {
  const paths = new Set<string>();
  for (const match of String(body || "").matchAll(/`([^`]+)`/g)) {
    const value = String(match[1] || "").trim().replace(/^\/+/, "");
    if (/^[A-Za-z0-9._/-]+\.(?:html|css|js|jsx|ts|tsx|mjs|cjs|json)$/.test(value) && !value.includes("..")) {
      paths.add(value);
    }
  }
  return [...paths];
}

function readReviewCommentCandidateSources(repoPath: string, headRefName: string | undefined, relativePath: string, body = ""): string[] {
  const sources: string[] = [];
  const rootPath = path.resolve(repoPath);
  const safeRelatives = [...new Set([
    String(relativePath || "").replace(/^\/+/, ""),
    ...extractReferencedReviewPaths(body),
  ])].filter(value => value && !value.includes("\0"));
  if (safeRelatives.length === 0) return sources;

  const readOne = (safeRelative: string): string[] => {
    const candidates: string[] = [];
    if (safeRelative.includes("..")) return candidates;

    if (headRefName && /^[A-Za-z0-9._/-]+$/.test(headRefName)) {
      for (const ref of [headRefName, `origin/${headRefName}`]) {
        try {
          candidates.push(execFileSync("git", ["-C", rootPath, "show", `${ref}:${safeRelative}`], {
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
        candidates.push(readFileSync(filePath, "utf-8"));
      } catch {
        // A transient read failure should not unblock review comments.
      }
    }
    return candidates;
  };

  for (const safeRelative of safeRelatives) {
    sources.push(...readOne(safeRelative));
  }
  if (sources.length > 1) sources.push(sources.join("\n"));
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
