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
  | "MERGE_CONFLICT"
  | "API_ERROR"
  | "AGENT_CRASH"
  | "AGENT_STALL"
  | "AGENT_SELF_LOOP"
  | "AGENT_PROCESS_EXITED"
  | "CROSS_PROJECT_CONTAMINATION"
  | "VERIFY_BOUNDED_REVIEW_VIOLATION"
  | "GIT_DISCIPLINE"
  | "INTERMEDIATE_COMMIT"
  | "SCOPE_WRITE_VIOLATION"
  | "SCOPE_BLEED"
  | "GENERATED_SCREEN_SHARED_READ"
  | "RAW_STITCH_CONTEXT_READ"
  | "CLAIM_WORKDIR_MISSING"
  | "CLAIM_PARSE_LOOP"
  | "CLAIM_SUMMARY_IGNORED"
  | "PRODUCT_SUPERVISOR_BLOCKED"
  | "LLM_SUPERVISOR_BLOCKED"
  | "UNKNOWN";

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  suggestion: string;
}

const PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory; suggestion: string }> = [
  { pattern: /AGENT_MODEL_TURN_STALLED:/i, category: "AGENT_STALL", suggestion: "Model turn stalled without file/output/progress changes. Treat as provider/session infra; retry the same claim, and if repeated switch model or reduce injected context." },
  { pattern: /^IMPLEMENT_NO_DELTA_STALL:/i, category: "AGENT_STALL", suggestion: "Implement agent spent the grace window without any project source delta. Retry the same scoped story and require a small code edit before extended analysis." },
  { pattern: /^AGENT_SELF_LOOP:/i, category: "AGENT_SELF_LOOP", suggestion: "Agent repeated the same tool/test/build action without new code progress. Treat as supervisor feedback: inspect the first failing signal once, change the owned code or test expectation before rerunning, and avoid repeating identical commands." },
  { pattern: /^CROSS-PROJECT CONTAMINATION:/i, category: "CROSS_PROJECT_CONTAMINATION", suggestion: "Treat as manager feedback and ignore the contaminated branch/PR claim. Re-read CLAIM_SUMMARY_FILE, use its storyBranch/workdir/main repo as the only source of truth, work only in the prepared story worktree, and report the exact storyBranch from the summary." },
  { pattern: /^VERIFY_BOUNDED_REVIEW_VIOLATION:/i, category: "VERIFY_BOUNDED_REVIEW_VIOLATION", suggestion: "Verify must behave like a bounded manager gate: read the claim summary and PR metadata, run deterministic build/test/lint evidence once, then inspect only changed files needed for the first blocker. Do not perform broad manual source review before evidence commands." },
  { pattern: /engine_overloaded|temporarily overloaded|Provider finish_reason:\s*engine_overloaded/i, category: "API_ERROR", suggestion: "Model provider overloaded — retry the claim later or use a different model/provider; do not change project code for this failure." },
  { pattern: /^AGENT_PROCESS_EXITED:/i, category: "AGENT_PROCESS_EXITED", suggestion: "Agent process exited before completing the claim. Retry with the same scoped handoff; inspect transcript only if it repeats." },
  { pattern: /^GIT_DISCIPLINE_VIOLATION:/i, category: "GIT_DISCIPLINE", suggestion: "Developer agents must not run git add/commit/push. Continue coding in the assigned worktree, report STATUS: done, and let Setfarm stage, commit, push, and create PRs." },
  { pattern: /^INTERMEDIATE_COMMIT_VIOLATION:/i, category: "INTERMEDIATE_COMMIT", suggestion: "Use /tmp/setfarm-progress checkpoints for long work. Do not create partial commits; Setfarm creates the scoped story commit after gates pass." },
  { pattern: /^SCOPE_WRITE_VIOLATION:/i, category: "SCOPE_WRITE_VIOLATION", suggestion: "Modify only files listed in scopeFiles. Remove out-of-scope edits and keep scratch/probe files outside the project worktree." },
  { pattern: /^SCOPE_BLEED:/i, category: "SCOPE_BLEED", suggestion: "Story modified files outside SCOPE_FILES. Revert or move out-of-scope files; if an allowed src/* path appears truncated, inspect git porcelain path parsing." },
  { pattern: /^PLATFORM_STORY_COMMIT_SCOPE_BLOCKED:/i, category: "SCOPE_BLEED", suggestion: "Platform story commit saw out-of-scope files. If directory paths are reported, inspect git status -uall expansion before retrying." },
  { pattern: /^GENERATED_SCREEN_SHARED_READ:/i, category: "GENERATED_SCREEN_SHARED_READ", suggestion: "Use claim-summary designContracts, SCREEN_INDEX.json, and src/screens/index.ts for shared generated screens. Do not use the OpenClaw read tool or shell commands to read forbidden src/screens/*.tsx files outside scopeFiles." },
  { pattern: /^RAW_STITCH_CONTEXT_READ:/i, category: "RAW_STITCH_CONTEXT_READ", suggestion: "Use CLAIM_SUMMARY_FILE, injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX.json, and only story-owned generated screens. Do not read or exec stitch/*.html, .stitch-screens*.json, or stitch/DESIGN_DOM.json inside implement claims." },
  { pattern: /^DESIGN_DOM_IMPLEMENTATION_MISMATCH:/i, category: "DESIGN_DOM_IMPLEMENTATION_MISMATCH", suggestion: "Use the injected DESIGN_DOM/UI_CONTRACT/screenUsageContract handoff and restore the exact scoped controls, icons, labels, and action IDs reported by the guard. Do not read raw Stitch HTML or broaden the story scope." },
  { pattern: /^CLAIM_WORKDIR_MISSING:/i, category: "CLAIM_WORKDIR_MISSING", suggestion: "Setfarm could not resolve the prepared story worktree. Fix claim/workdir handoff before spawning a developer in agent scratch." },
  { pattern: /^CLAIM_PARSE_LOOP:/i, category: "CLAIM_PARSE_LOOP", suggestion: "Read the structured claim summary once and work from its focused fields. Do not jq/sed/head/node-loop over raw claim.input." },
  { pattern: /^CLAIM_SUMMARY_IGNORED:/i, category: "CLAIM_SUMMARY_IGNORED", suggestion: "Use CLAIM_SUMMARY_FILE as the authoritative handoff before reading the full claim fallback." },
  { pattern: /^LLM_SUPERVISOR_BLOCKED:/i, category: "LLM_SUPERVISOR_BLOCKED", suggestion: "Treat this as manager feedback. Return the same story to implement with the exact product/code blocker and keep supervisor memory intact." },
  { pattern: /GUARDRAIL \[product-supervisor:|PRODUCT_SUPERVISOR|IMPLEMENT_NO_DELTA|PLAN_TRACEABILITY|PLAN_SCREEN_|DESIGN_SCREEN_|STORY_SUPERVISION_/i, category: "PRODUCT_SUPERVISOR_BLOCKED", suggestion: "Product supervisor blocked a contract drift. Fix the root PRD/design/story coherence issue before continuing the pipeline." },
  { pattern: /^RUNTIME_BRIDGE_MISSING:/i, category: "RUNTIME_BRIDGE_MISSING", suggestion: "Expose the required window.app/globalThis.app runtime bridge from live state before reporting done" },
  { pattern: /^TEST_FAILED:/i, category: "TEST_FAILED", suggestion: "Run the touched tests, fix the failing source or invalid test expectation, then report done only after tests pass" },
  { pattern: /^BUILD_FAILED:/i, category: "BUILD_FAILED", suggestion: "Fix TypeScript/build errors in the story worktree, then run the build before completing" },
  { pattern: /GUARDRAIL|DESIGN UYUMSUZLUK|design.tokens|design compliance/i, category: "DESIGN_MISMATCH", suggestion: "Review exact design mismatch lines and apply the matching UI/design-token fix only" },
  { pattern: /MISSING_INPUT|\[missing:\s*\w+\]|(?:^|\n)\s*missing:\s*\w+/i, category: "CONTEXT_MISSING", suggestion: "Required template variable not set — check previous step output" },
  { pattern: /timed?\s*out|TIMEOUT|ABANDONED|agent.*dead/i, category: "TIMEOUT", suggestion: "Agent session exceeded timeout — retry or increase threshold" },
  { pattern: /npm ERR|build failed|tsc.*error|vite.*error|webpack.*error/i, category: "BUILD_FAIL", suggestion: "Build errors — check TypeScript types, missing imports, or dependency issues" },
  { pattern: /Tests?:\s+\d+\s+failed|test.*fail|FAIL\s+src\//i, category: "TEST_FAIL", suggestion: "Test failures — fix assertions or update test expectations" },
  { pattern: /merge conflict|CONFLICT|could not merge/i, category: "MERGE_CONFLICT", suggestion: "Git merge conflict — resolve conflicting changes between parallel stories" },
  { pattern: /fetch failed|ECONNREFUSED|ENOTFOUND|rate.limit|quota/i, category: "API_ERROR", suggestion: "External API error — check network, API keys, or rate limits" },
  { pattern: /GUARDRAIL FAIL|quality gate|smoke.test/i, category: "GUARDRAIL_FAIL", suggestion: "Quality gate check failed — review guardrail output for specific issues" },
  { pattern: /segfault|SIGSEGV|heap out of memory|killed/i, category: "AGENT_CRASH", suggestion: "Agent process crashed — likely memory issue, retry with smaller context" },
  { pattern: /EADDRINUSE|address already in use/i, category: "BUILD_FAIL", suggestion: "Port already in use — kill the process using it or change port" },
  { pattern: /ENOMEM|heap out of memory|JavaScript heap/i, category: "AGENT_CRASH", suggestion: "Out of memory — reduce context size or increase NODE_OPTIONS --max-old-space-size" },
  { pattern: /ENOSPC|no space left on device/i, category: "API_ERROR", suggestion: "Disk full — clean up old builds, node_modules, or logs" },
  { pattern: /permission denied|EACCES/i, category: "BUILD_FAIL", suggestion: "Permission denied — check file permissions or run with correct user" },
  { pattern: /branch.*already exists|checkout.*conflict/i, category: "MERGE_CONFLICT", suggestion: "Git branch conflict — delete old branch or resolve conflicts" },
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
  const targetedFix = `DÜZELT:\n${buildGeneratedScreenSharedReadSuggestion()
    .split("; ")
    .map(suggestion => `• ${suggestion}`)
    .join("\n")}`;

  if (/\nDÜZELT:/i.test(text)) {
    return text.replace(/\nDÜZELT:[\s\S]*$/i, `\n${targetedFix}`).trim();
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
  const targetedFix = `DÜZELT:\n${buildRawStitchContextSuggestion()
    .split("; ")
    .map(suggestion => `• ${suggestion}`)
    .join("\n")}`;

  if (/\nDÜZELT:/i.test(text)) {
    return text.replace(/\nDÜZELT:[\s\S]*$/i, `\n${targetedFix}`).trim();
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
  if (/design-tokens\.css.*import|design-tokens\.css hiçbir dosyada|design.tokens/i.test(errorText)) {
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
  if (!/DESIGN UYUMSUZLUK|UI_CONTRACT|design compliance|design mismatch/i.test(text)) return text;

  const targetedFix = `DÜZELT:\n${buildDesignMismatchSuggestion(text)
    .split("; ")
    .map(suggestion => `• ${suggestion}`)
    .join("\n")}`;

  const staleGenericFix = /DÜZELT:\s*Kritik UI sözleşmesi hatalarını düzelt;\s*stitch\/design-tokens\.css'i import et,\s*hardcoded renkleri var\(--\*\) ile değiştir\./i;
  if (staleGenericFix.test(text)) {
    return text.replace(staleGenericFix, targetedFix).trim();
  }

  if (!/\nDÜZELT:/i.test(text)) {
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
