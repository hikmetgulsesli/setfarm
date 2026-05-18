/**
 * Error Taxonomy — Classify pipeline errors for structured reporting.
 */

export type ErrorCategory =
  | "GUARDRAIL_FAIL"
  | "RUNTIME_BRIDGE_MISSING"
  | "TIMEOUT"
  | "CONTEXT_MISSING"
  | "BUILD_FAIL"
  | "BUILD_FAILED"
  | "TEST_FAIL"
  | "TEST_FAILED"
  | "DESIGN_MISMATCH"
  | "DESIGN_DOM_IMPLEMENTATION_MISMATCH"
  | "SUPERVISOR_BLOCKERS_OPEN"
  | "MERGE_CONFLICT"
  | "API_ERROR"
  | "AGENT_CRASH"
  | "AGENT_STALL"
  | "AGENT_SELF_LOOP"
  | "AGENT_PROCESS_EXITED"
  | "NO_WORK_DETECTED"
  | "IMPLEMENT_PRE_DELTA_CHECK_VIOLATION"
  | "CROSS_PROJECT_CONTAMINATION"
  | "VERIFY_BOUNDED_REVIEW_VIOLATION"
  | "GIT_DISCIPLINE"
  | "INTERMEDIATE_COMMIT"
  | "SCOPE_WRITE_VIOLATION"
  | "SCOPE_BLEED"
  | "SCOPE_FILE_MISSING"
  | "GENERATED_SCREEN_SHARED_READ"
  | "GENERATED_SCREEN_NOT_INTEGRATED"
  | "GENERATED_SCREEN_REGRESSION"
  | "RAW_STITCH_CONTEXT_READ"
  | "CLAIM_WORKDIR_MISSING"
  | "CLAIM_PARSE_LOOP"
  | "CLAIM_SUMMARY_IGNORED"
  | "PRODUCT_SUPERVISOR_BLOCKED"
  | "LLM_SUPERVISOR_BLOCKED"
  | "QUALITY_RETRY_FEEDBACK"
  | "PR_REVIEW_COMMENTS_OPEN"
  | "PR_NOT_MERGED"
  | "PR_MISSING"
  | "UNKNOWN";

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  suggestion: string;
}

const PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory; suggestion: string }> = [
  { pattern: /AGENT_MODEL_TURN_STALLED:/i, category: "AGENT_STALL", suggestion: "Model turn stalled without file/output/progress changes. Treat as provider/session infra; retry the same claim, and if repeated switch model or reduce injected context." },
  { pattern: /^IMPLEMENT_NO_DELTA_STALL:/i, category: "AGENT_STALL", suggestion: "Implement agent spent the grace window without any project source delta. Retry the same scoped story and require a small code edit before extended analysis." },
  { pattern: /^IMPLEMENT_PRE_DELTA_CHECK_VIOLATION:/i, category: "IMPLEMENT_PRE_DELTA_CHECK_VIOLATION", suggestion: "First-delta retry discipline was violated. Re-read CLAIM_SUMMARY_FILE, inspect only owned scope files plus safe metadata, make a small scoped source delta first, then run build/test/lint." },
  { pattern: /^NO WORK DETECTED:/i, category: "NO_WORK_DETECTED", suggestion: "The story reported done with no source delta. Re-read CLAIM_SUMMARY_FILE, inspect only owned scope files, make a small scoped implementation change before broad checks, then run the required build/test commands before reporting done." },
  { pattern: /^AGENT_SELF_LOOP:/i, category: "AGENT_SELF_LOOP", suggestion: "Agent repeated the same tool/test/build action without new code progress. Treat as supervisor feedback: inspect the first failing signal once, change the owned code or test expectation before rerunning, and avoid repeating identical commands." },
  { pattern: /^CROSS-PROJECT CONTAMINATION:/i, category: "CROSS_PROJECT_CONTAMINATION", suggestion: "Treat as manager feedback and ignore the contaminated branch/PR claim. Re-read CLAIM_SUMMARY_FILE, use its storyBranch/workdir/main repo as the only source of truth, work only in the prepared story worktree, and report the exact storyBranch from the summary." },
  { pattern: /^VERIFY_BOUNDED_REVIEW_VIOLATION:/i, category: "VERIFY_BOUNDED_REVIEW_VIOLATION", suggestion: "Verify must behave like a bounded manager gate: read the claim summary and PR metadata, run deterministic build/test/lint evidence once, then inspect only changed files needed for the first blocker. Do not perform broad manual source review before evidence commands." },
  { pattern: /engine_overloaded|temporarily overloaded|Provider finish_reason:\s*engine_overloaded/i, category: "API_ERROR", suggestion: "Model provider overloaded — retry the claim later or use a different model/provider; do not change project code for this failure." },
  { pattern: /^AGENT_PROCESS_EXITED:/i, category: "AGENT_PROCESS_EXITED", suggestion: "Agent process exited before completing the claim. Retry with the same scoped handoff; inspect transcript only if it repeats." },
  { pattern: /^GIT_DISCIPLINE_VIOLATION:/i, category: "GIT_DISCIPLINE", suggestion: "Developer agents must not run git add/commit/push. Continue coding in the assigned worktree, report STATUS: done, and let Setfarm stage, commit, push, and create PRs." },
  { pattern: /^INTERMEDIATE_COMMIT_VIOLATION:/i, category: "INTERMEDIATE_COMMIT", suggestion: "Use /tmp/setfarm-progress checkpoints for long work. Do not create partial commits; Setfarm creates the scoped story commit after gates pass." },
  { pattern: /^SCOPE_WRITE_VIOLATION:/i, category: "SCOPE_WRITE_VIOLATION", suggestion: "Modify only files listed in scopeFiles. Remove out-of-scope edits and keep scratch/probe files outside the project worktree." },
  { pattern: /^SCOPE_BLEED:/i, category: "SCOPE_BLEED", suggestion: "Story modified files outside SCOPE_FILES. Revert or move out-of-scope files; if an allowed src/* path appears truncated, inspect git porcelain path parsing." },
  { pattern: /^SCOPE_FILE_MISSING:/i, category: "SCOPE_FILE_MISSING", suggestion: "Create meaningful non-empty implementation files in the declared scope_files before reporting done. Do not collapse the story into one file when the story owns app state, hooks, domain types, storage, or CSS files." },
  { pattern: /^PLATFORM_STORY_COMMIT_SCOPE_BLOCKED:/i, category: "SCOPE_BLEED", suggestion: "Platform story commit saw out-of-scope files. If directory paths are reported, inspect git status -uall expansion before retrying." },
  { pattern: /^GENERATED_SCREEN_SHARED_READ:/i, category: "GENERATED_SCREEN_SHARED_READ", suggestion: "Use claim-summary designContracts, SCREEN_INDEX.json, and src/screens/index.ts for shared generated screens. Do not use the OpenClaw read tool or shell commands to read forbidden src/screens/*.tsx files outside scopeFiles." },
  { pattern: /^GENERATED_SCREEN_NOT_INTEGRATED:/i, category: "GENERATED_SCREEN_NOT_INTEGRATED", suggestion: "Render every owned generated screen through the app/router surface and wire its declared actions prop IDs before reporting done. Preserve previous-story behavior while replacing duplicate custom UI." },
  { pattern: /^GENERATED_SCREEN_REGRESSION:/i, category: "GENERATED_SCREEN_REGRESSION", suggestion: "Preserve every previously verified generated screen route/rendering surface while adding the current story screens. Do not replace previous generated screens with custom duplicate UI." },
  { pattern: /^PR_REVIEW_COMMENTS_OPEN:/i, category: "PR_REVIEW_COMMENTS_OPEN", suggestion: "Address every actionable PR review comment in the same story branch, push the fix, and only allow verify to merge after fresh PR comments are clear." },
  { pattern: /\b(?:PR\s*#\d+\s+still\s+has|current|actionable|unresolved|non-outdated)\b[\s\S]{0,220}\breview\s+(?:comment|thread)s?\b/i, category: "PR_REVIEW_COMMENTS_OPEN", suggestion: "Address, reply to, or resolve every current actionable PR review thread in the same story branch before retrying verify or merge gates." },
  { pattern: /^PR_NOT_MERGED:/i, category: "PR_NOT_MERGED", suggestion: "Do not accept STATUS: done while the story PR is still open. Address review comments/checks, merge the PR into main, and then let verify re-check the merged state." },
  { pattern: /^PR_MISSING:/i, category: "PR_MISSING", suggestion: "Create or recover the story PR before verify runs. A story cannot be verified from local worktree output alone." },
  { pattern: /^RAW_STITCH_CONTEXT_READ:/i, category: "RAW_STITCH_CONTEXT_READ", suggestion: "Use CLAIM_SUMMARY_FILE, injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX.json, and only story-owned generated screens. Do not read or exec stitch/*.html, .stitch-screens*.json, or stitch/DESIGN_DOM.json inside implement claims." },
  { pattern: /^DESIGN_DOM_IMPLEMENTATION_MISMATCH:/i, category: "DESIGN_DOM_IMPLEMENTATION_MISMATCH", suggestion: "Use the injected DESIGN_DOM/UI_CONTRACT/screenUsageContract handoff and restore the exact scoped controls, labels, and action IDs reported by the guard. Labeled icon mismatches are supervisor warnings unless the control is icon-only. Do not read raw Stitch HTML or broaden the story scope." },
  { pattern: /^SUPERVISOR_BLOCKERS_OPEN:/i, category: "SUPERVISOR_BLOCKERS_OPEN", suggestion: "Fix the exact supervisor checklist blocker ids in scoped files first. Missing controls, dead links, and static active controls are blockers; warning-level design drift can be handled after blockers pass. Do not read raw Stitch HTML or broaden scope." },
  { pattern: /^CLAIM_WORKDIR_MISSING:/i, category: "CLAIM_WORKDIR_MISSING", suggestion: "Setfarm could not resolve the prepared story worktree. Fix claim/workdir handoff before spawning a developer in agent scratch." },
  { pattern: /^CLAIM_PARSE_LOOP:/i, category: "CLAIM_PARSE_LOOP", suggestion: "Read the structured claim summary once and work from its focused fields. Do not jq/sed/head/node-loop over raw claim.input." },
  { pattern: /^CLAIM_SUMMARY_IGNORED:/i, category: "CLAIM_SUMMARY_IGNORED", suggestion: "Use CLAIM_SUMMARY_FILE as the authoritative handoff before reading the full claim fallback." },
  { pattern: /^LLM_SUPERVISOR_BLOCKED:/i, category: "LLM_SUPERVISOR_BLOCKED", suggestion: "Treat this as manager feedback. Return the same story to implement with the exact product/code blocker and keep supervisor memory intact." },
  { pattern: /\bSUPERVISOR_DECISION\s*:\s*block\b|^STATUS\s*:\s*retry[\s\S]*\bSUPERVISOR_/i, category: "LLM_SUPERVISOR_BLOCKED", suggestion: "Treat this as manager feedback. Return the same story to implement with the exact product/code blocker and keep supervisor memory intact." },
  { pattern: /^STATUS\s*:\s*retry[\s\S]*(?:\bFINDINGS\s*:|\bTEST_FAILURES\s*:|\bFEEDBACK\s*:|\bVULNERABILITIES\s*:)/i, category: "QUALITY_RETRY_FEEDBACK", suggestion: "Apply the exact retry findings in scoped source files, add or update focused regression coverage when requested, run the required checks, and keep the fix bounded to the current story." },
  { pattern: /(?:^|\n)\s*(?:GUARDRAIL\s+\[product-supervisor:|PRODUCT_SUPERVISOR(?:_BLOCKED)?\s*:|IMPLEMENT_NO_DELTA\b|PLAN_TRACEABILITY\b|PLAN_SCREEN_|DESIGN_SCREEN_|STORY_SUPERVISION_)/i, category: "PRODUCT_SUPERVISOR_BLOCKED", suggestion: "Product supervisor blocked a contract drift. Fix the root PRD/design/story coherence issue before continuing the pipeline." },
  { pattern: /^RUNTIME_BRIDGE_MISSING:/i, category: "RUNTIME_BRIDGE_MISSING", suggestion: "Add a real scoped source assignment such as window.app = { state, actions } or globalThis.app = { state, actions } from live runtime state before reporting done. Type declarations, comments, and window.game do not satisfy this guard." },
  { pattern: /^TEST_FAILED:/i, category: "TEST_FAILED", suggestion: "Run the touched tests, fix the failing source or invalid test expectation, then report done only after tests pass" },
  { pattern: /^BUILD_FAILED:/i, category: "BUILD_FAILED", suggestion: "Fix TypeScript/build errors in the story worktree, then run the build before completing" },
  { pattern: /GUARDRAIL|DESIGN MISMATCH|design.tokens|design compliance/i, category: "DESIGN_MISMATCH", suggestion: "Review exact design mismatch lines and apply the matching UI/design-token fix only" },
  { pattern: /MISSING_INPUT|\[missing:\s*\w+\]|(?:^|\n)\s*missing:\s*\w+/i, category: "CONTEXT_MISSING", suggestion: "Required template variable not set — check previous step output" },
  { pattern: /timed?\s*out|TIMEOUT|ABANDONED|agent.*dead/i, category: "TIMEOUT", suggestion: "Agent session exceeded timeout — retry or increase threshold" },
  { pattern: /npm ERR|build failed|tsc.*error|vite.*error|webpack.*error/i, category: "BUILD_FAIL", suggestion: "Build errors — check TypeScript types, missing imports, or dependency issues" },
  { pattern: /Tests?:\s+\d+\s+failed|test.*fail|FAIL\s+src\//i, category: "TEST_FAIL", suggestion: "Test failures — fix assertions or update test expectations" },
  { pattern: /(?:^|\n)\s*(?:MERGE_CONFLICT:|CONFLICT\s+\([^)]+\):|Auto-merging .+\nCONFLICT\b|Automatic merge failed|<<<<<<<\s|=======\s*$|>>>>>>>\s|error:\s+could not (?:apply|merge)\b|fatal:.*merge.*conflict|unmerged paths)/i, category: "MERGE_CONFLICT", suggestion: "Git merge conflict — resolve conflicting changes between parallel stories" },
  { pattern: /fetch failed|ECONNREFUSED|ENOTFOUND|rate.limit|quota/i, category: "API_ERROR", suggestion: "External API error — check network, API keys, or rate limits" },
  { pattern: /GUARDRAIL FAIL|quality gate|smoke.test/i, category: "GUARDRAIL_FAIL", suggestion: "Quality gate check failed — review guardrail output for specific issues" },
  { pattern: /segfault|SIGSEGV|heap out of memory|killed/i, category: "AGENT_CRASH", suggestion: "Agent process crashed — likely memory issue, retry with smaller context" },
  { pattern: /EADDRINUSE|address already in use/i, category: "BUILD_FAIL", suggestion: "Port already in use — kill the process using it or change port" },
  { pattern: /ENOMEM|heap out of memory|JavaScript heap/i, category: "AGENT_CRASH", suggestion: "Out of memory — reduce context size or increase NODE_OPTIONS --max-old-space-size" },
  { pattern: /ENOSPC|no space left on device/i, category: "API_ERROR", suggestion: "Disk full — clean up old builds, node_modules, or logs" },
  { pattern: /permission denied|EACCES/i, category: "BUILD_FAIL", suggestion: "Permission denied — check file permissions or run with correct user" },
  { pattern: /branch .{0,120} already exists|checkout .{0,120}(?:would overwrite|unmerged|conflict)|local changes .{0,120} would be overwritten by checkout/i, category: "MERGE_CONFLICT", suggestion: "Git branch conflict — delete old branch or resolve conflicts" },
  { pattern: /rate.limit|429|too many requests/i, category: "API_ERROR", suggestion: "API rate limit hit — wait and retry, or use different API key" },
  { pattern: /CERTIFICATE|ssl|TLS|self.signed/i, category: "API_ERROR", suggestion: "SSL/TLS certificate error — check network or set NODE_TLS_REJECT_UNAUTHORIZED=0 temporarily" },
];

export function buildGeneratedScreenSharedReadSuggestion(): string {
  return [
    "do not use the OpenClaw read tool, cat, sed, head, grep, rg, node, or python to read forbidden src/screens/*.tsx files outside scopeFiles",
    "use CLAIM_SUMMARY_FILE designContracts, SCREEN_INDEX.json, src/screens/index.ts, component registry, component types, and UI_CONTRACT instead",
    "if a generated screen contract is insufficient, report the exact missing action/type contract instead of opening shared generated source",
  ].join("; ");
}

function sanitizeGeneratedScreenSharedReadFeedback(errorText: string): string {
  const text = errorText.trim();
  const targetedFix = `FIX:\n${buildGeneratedScreenSharedReadSuggestion()
    .split("; ")
    .map(suggestion => `- ${suggestion}`)
    .join("\n")}`;

  if (/\nFIX:/i.test(text)) {
    return text.replace(/\nFIX:[\s\S]*$/i, `\n${targetedFix}`).trim();
  }

  return `${text}\n${targetedFix}`;
}

export function buildRawStitchContextSuggestion(): string {
  return [
    "do not read or exec stitch/*.html, .stitch-screens*.json, or stitch/DESIGN_DOM.json inside implement claims",
    "use CLAIM_SUMMARY_FILE, injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX.json, and only story-owned generated screens",
    "if the injected design handoff is insufficient, report the exact missing contract instead of loading the raw design corpus",
  ].join("; ");
}

function sanitizeRawStitchContextFeedback(errorText: string): string {
  const text = errorText.trim();
  const targetedFix = `FIX:\n${buildRawStitchContextSuggestion()
    .split("; ")
    .map(suggestion => `- ${suggestion}`)
    .join("\n")}`;

  if (/\nFIX:/i.test(text)) {
    return text.replace(/\nFIX:[\s\S]*$/i, `\n${targetedFix}`).trim();
  }

  return `${text}\n${targetedFix}`;
}

export function buildDesignMismatchSuggestion(errorText: string): string {
  const suggestions: string[] = [];
  if (/Material Symbols|icon fonts|material-symbols|material-icons|emoji icons/i.test(errorText)) {
    suggestions.push("replace icon fonts/emoji with inline SVG components or an installed SVG icon library");
  }
  if (/transition-all|transition\s*:\s*all|blanket transition/i.test(errorText)) {
    suggestions.push("replace transition-all/transition: all with scoped transition properties");
  }
  if (/design-tokens\.css.*import|design-tokens\.css is not imported|design.tokens/i.test(errorText)) {
    suggestions.push("import stitch/design-tokens.css from the real CSS entrypoint");
  }
  if (/hardcoded|#[0-9a-f]{3,8}|var\(--token\)/i.test(errorText)) {
    suggestions.push("replace hardcoded colors with available design token vars");
  }
  if (/empty click\/change handler|empty handler/i.test(errorText)) {
    suggestions.push("wire empty handlers to real state or navigation behavior");
  }
  if (suggestions.length === 0) {
    suggestions.push("fix only the exact files and issues reported by the design guardrail");
  }
  return suggestions.join("; ");
}

export function sanitizeDesignMismatchFeedback(errorText: string): string {
  const text = errorText.trim();
  if (/GENERATED_SCREEN_SHARED_READ:/i.test(text)) return sanitizeGeneratedScreenSharedReadFeedback(text);
  if (/RAW_STITCH_CONTEXT_READ:/i.test(text)) return sanitizeRawStitchContextFeedback(text);
  if (!/DESIGN MISMATCH|UI_CONTRACT|design compliance|design mismatch/i.test(text)) return text;

  const targetedFix = `FIX:\n${buildDesignMismatchSuggestion(text)
    .split("; ")
    .map(suggestion => `- ${suggestion}`)
    .join("\n")}`;

  const staleGenericFix = /FIX:[\s\S]{0,240}stitch\/design-tokens\.css[\s\S]{0,240}hardcoded[\s\S]{0,80}var\(--\*\)/i;
  if (staleGenericFix.test(text)) {
    return text.replace(staleGenericFix, targetedFix).trim();
  }

  if (!/\nFIX:/i.test(text)) {
    return `${text}\n${targetedFix}`;
  }

  return text;
}

export function classifyError(errorText: string): ClassifiedError {
  for (const { pattern, category, suggestion } of PATTERNS) {
    if (pattern.test(errorText)) {
      if (category === "DESIGN_MISMATCH") {
        return { category, message: errorText.slice(0, 500), suggestion: buildDesignMismatchSuggestion(errorText) };
      }
      return { category, message: errorText.slice(0, 500), suggestion };
    }
  }
  return { category: "UNKNOWN", message: errorText.slice(0, 500), suggestion: "Unexpected error — review agent output for details" };
}
