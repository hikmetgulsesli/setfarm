export type FailureRouteAction = "re_claim" | "link_story" | "platform_bug";

export type FailureRoutePolicy = "qa_fix_disabled" | "qa_fix_bounded";

export interface FailureRouteInput {
  runId: string;
  stepId: string;
  failure: string;
  currentStoryId?: string | null;
  hasMachineEvidence?: boolean;
  existingRepairCount?: number;
  repeatedFailureCount?: number;
}

export interface FailureRouteDecision {
  action: FailureRouteAction;
  category: string;
  reason: string;
  qaFixAllowed: boolean;
  policy: FailureRoutePolicy;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export function readQaFixEnabled(): boolean {
  return boolEnv("SETFARM_QA_FIX_ENABLED", false);
}

function normalizeCategory(stepId: string, failure: string): string {
  const raw = String(failure || "");
  if (/\bSMOKE_INFRA_FAILURE\b|agent-browser|playwright|chromium|ECONNREFUSED|timeout/i.test(raw)) return "browser_infra_failure";
  if (/\bVERIFY_MERGE_BLOCKER\b|merge conflict|CONFLICTING|DIRTY/i.test(raw)) return "verify_merge_blocker";
  if (/\bIMPLEMENT_EVIDENCE|runtime evidence|IMPLEMENT_VERIFICATION_REQUEST/i.test(raw)) return "implement_evidence_failure";
  if (/\bDESIGN_IMPORT|stitch-to-jsx|generated-screen-validator|SCREEN_MAP/i.test(raw)) return "design_import_failure";
  if (stepId === "qa-test") return "qa_quality_failure";
  if (stepId === "final-test") return "final_test_quality_failure";
  if (stepId === "verify") return "verify_quality_failure";
  return "downstream_quality_failure";
}

export function routeDownstreamQualityFailure(input: FailureRouteInput): FailureRouteDecision {
  const category = normalizeCategory(input.stepId, input.failure);
  const qaFixEnabled = readQaFixEnabled();
  const policy: FailureRoutePolicy = qaFixEnabled ? "qa_fix_bounded" : "qa_fix_disabled";

  if (category === "browser_infra_failure" || category === "design_import_failure") {
    return {
      action: "platform_bug",
      category,
      reason: `${category} is a platform/setup failure and must not create a QA-FIX story.`,
      qaFixAllowed: false,
      policy,
    };
  }

  if (category === "verify_merge_blocker") {
    return {
      action: "platform_bug",
      category,
      reason: "Verify merge blockers require PR/story branch repair, not a QA-FIX story.",
      qaFixAllowed: false,
      policy,
    };
  }

  if (!qaFixEnabled) {
    return {
      action: input.currentStoryId ? "re_claim" : "platform_bug",
      category,
      reason: "QA-FIX automatic repair stories are disabled; route failure to original story retry or platform diagnosis.",
      qaFixAllowed: false,
      policy,
    };
  }

  if (!input.hasMachineEvidence) {
    return {
      action: input.currentStoryId ? "re_claim" : "platform_bug",
      category,
      reason: "QA-FIX requires machine evidence. Agent prose is not enough.",
      qaFixAllowed: false,
      policy,
    };
  }

  if ((input.existingRepairCount || 0) >= 1 || (input.repeatedFailureCount || 0) > 1) {
    return {
      action: "platform_bug",
      category,
      reason: "QA-FIX bounded policy refused another repair story.",
      qaFixAllowed: false,
      policy,
    };
  }

  return {
    action: "link_story",
    category,
    reason: "QA-FIX bounded policy permits one evidence-backed repair story.",
    qaFixAllowed: true,
    policy,
  };
}
