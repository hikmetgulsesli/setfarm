export interface StrictnessDeltaIssue {
  severity: "info" | "warning" | "blocker";
  rule: string;
  detail: string;
}

const STRICTNESS_PATTERNS = [
  { rule: "deleted_throw", re: /^-\s*.*\bthrow\b/, detail: "Patch deletes a throw path." },
  { rule: "deleted_process_exit", re: /^-\s*.*process\.exit\s*\(/, detail: "Patch deletes a process.exit path." },
  { rule: "deleted_return_false", re: /^-\s*.*return\s+false\b/, detail: "Patch deletes a return false path." },
  { rule: "deleted_required_evidence", re: /^-\s*.*(QA_INTERACTIONS_TESTED|SMOKE_TEST_RESULT|FINAL_TEST_JSON|DESIGN_IMPORT)/, detail: "Patch deletes required evidence text." },
];

export function analyzeStrictnessDelta(diffText: string): StrictnessDeltaIssue[] {
  const issues: StrictnessDeltaIssue[] = [];
  for (const line of diffText.split("\n")) {
    for (const pattern of STRICTNESS_PATTERNS) {
      if (pattern.re.test(line)) {
        issues.push({ severity: "blocker", rule: pattern.rule, detail: pattern.detail });
      }
    }
  }
  if (/^[-+].*(threshold|minConfidence|max_retries|interactions)/im.test(diffText)) {
    issues.push({ severity: "warning", rule: "threshold_or_interaction_change", detail: "Patch changes threshold or interaction-related logic." });
  }
  return issues;
}
