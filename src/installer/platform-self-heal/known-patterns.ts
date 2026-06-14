export interface KnownFailurePattern {
  id: string;
  category: string;
  stepIds: string[];
  patterns: string[];
  evidence: string;
}

export const KNOWN_FAILURE_PATTERNS: KnownFailurePattern[] = [
  {
    id: "qa-interactions-tested-zero",
    category: "smoke_contract_gap",
    stepIds: ["qa-test"],
    patterns: ["QA_INTERACTIONS_TESTED=0", "requires QA_INTERACTIONS_TESTED > 0"],
    evidence: "QA guardrail is failing because interaction evidence was not detected.",
  },
  {
    id: "design-import-screen-coverage-missing",
    category: "design_import_gap",
    stepIds: ["setup-build", "implement", "qa-test", "final-test"],
    patterns: ["DESIGN_IMPORT_SCREEN_COVERAGE_MISSING", "SCREEN_MAP", "generated screen"],
    evidence: "Design screen coverage mismatch points to generated screen validation/import gates.",
  },
  {
    id: "unknown-material-icons",
    category: "supervisor_quality_gap",
    stepIds: ["implement", "verify", "supervise", "qa-test", "final-test"],
    patterns: ["UNKNOWN_MATERIAL_ICONS", "Unknown Material Symbols", "BadgeHelp"],
    evidence: "Unknown generated icons are build-safe fallback quality issues that should be routed to supervisor repair, not setup-build failure.",
  },
  {
    id: "final-test-json-missing",
    category: "final_test_contract_gap",
    stepIds: ["final-test"],
    patterns: ["FINAL_TEST_JSON", "SMOKE_TEST_RESULT", "completed without"],
    evidence: "Final-test completion contract is missing structured runtime evidence.",
  },
  {
    id: "mc-project-terminal-visibility",
    category: "mc_projects_visibility_bug",
    stepIds: ["mission-control", "projects", "run"],
    patterns: ["failed project cards", "cancelled project cards", "Projects default view"],
    evidence: "Mission Control project visibility policy should hide terminal failed/cancelled cards by default.",
  },
];

export function matchKnownFailurePattern(stepId: string, error: string): KnownFailurePattern | undefined {
  const haystack = `${stepId}\n${error}`.toLowerCase();
  return KNOWN_FAILURE_PATTERNS.find((pattern) => {
    const stepMatches = pattern.stepIds.includes(stepId) || pattern.stepIds.includes("*");
    if (!stepMatches) return false;
    return pattern.patterns.every((part) => haystack.includes(part.toLowerCase()));
  });
}
