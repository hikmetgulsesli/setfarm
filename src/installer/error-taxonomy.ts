/**
 * Error Taxonomy — Classify pipeline errors for structured reporting.
 */

export type ErrorCategory =
  | "GUARDRAIL_FAIL"
  | "TIMEOUT"
  | "CONTEXT_MISSING"
  | "BUILD_FAIL"
  | "TEST_FAIL"
  | "DESIGN_MISMATCH"
  | "MERGE_CONFLICT"
  | "API_ERROR"
  | "AGENT_CRASH"
  | "UNKNOWN";

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  suggestion: string;
}

const PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory; suggestion: string }> = [
  { pattern: /GUARDRAIL|DESIGN UYUMSUZLUK|design.tokens|design compliance/i, category: "DESIGN_MISMATCH", suggestion: "Import stitch/design-tokens.css and use var(--token) instead of hardcoded values" },
  { pattern: /MISSING_INPUT|missing:\s*\w+|\[missing:/i, category: "CONTEXT_MISSING", suggestion: "Required template variable not set — check previous step output" },
  { pattern: /timed?\s*out|TIMEOUT|ABANDONED|agent.*dead/i, category: "TIMEOUT", suggestion: "Agent session exceeded timeout — retry or increase threshold" },
  { pattern: /npm ERR|build failed|tsc.*error|vite.*error|webpack.*error/i, category: "BUILD_FAIL", suggestion: "Build errors — check TypeScript types, missing imports, or dependency issues" },
  { pattern: /Tests?:\s+\d+\s+failed|test.*fail|FAIL\s+src\//i, category: "TEST_FAIL", suggestion: "Test failures — fix assertions or update test expectations" },
  { pattern: /merge conflict|CONFLICT|could not merge/i, category: "MERGE_CONFLICT", suggestion: "Git merge conflict — resolve conflicting changes between parallel stories" },
  { pattern: /fetch failed|ECONNREFUSED|ENOTFOUND|rate.limit|quota/i, category: "API_ERROR", suggestion: "External API error — check network, API keys, or rate limits" },
  { pattern: /GUARDRAIL FAIL|quality gate|smoke.test/i, category: "GUARDRAIL_FAIL", suggestion: "Quality gate check failed — review guardrail output for specific issues" },
  { pattern: /segfault|SIGSEGV|heap out of memory|killed/i, category: "AGENT_CRASH", suggestion: "Agent process crashed — likely memory issue, retry with smaller context" },
];

export function classifyError(errorText: string): ClassifiedError {
  for (const { pattern, category, suggestion } of PATTERNS) {
    if (pattern.test(errorText)) {
      return { category, message: errorText.slice(0, 500), suggestion };
    }
  }
  return { category: "UNKNOWN", message: errorText.slice(0, 500), suggestion: "Unexpected error — review agent output for details" };
}
