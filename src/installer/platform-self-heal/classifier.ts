import { createHash, randomUUID } from "node:crypto";
import { matchKnownFailurePattern } from "./known-patterns.js";
import { ownershipForCategory } from "./ownership-map.js";
import type {
  FailureClass,
  FailureRoute,
  MechanicalCorroboration,
  PlatformSelfHealConfig,
  RepairTarget,
  ResumePolicy,
} from "./types.js";

function routeCategory(stepId: string, error: string): { category: string; confidence: number; corroboration: MechanicalCorroboration[] } {
  const known = matchKnownFailurePattern(stepId, error);
  if (known) {
    return {
      category: known.category,
      confidence: 0.86,
      corroboration: [{ type: "known_pattern", id: known.id, detail: known.evidence }],
    };
  }

  const normalized = error.toLowerCase();
  if (normalized.includes("design_import") || normalized.includes("stitch-to-jsx") || normalized.includes("generated-screen-validator")) {
    return {
      category: "design_import_gap",
      confidence: 0.72,
      corroboration: [{ type: "deterministic_signature", id: "design-import-text", detail: "Failure text includes design import validator signatures." }],
    };
  }
  if (stepId === "qa-test" && /qa_|smoke|interaction|browser/i.test(error)) {
    return {
      category: "smoke_contract_gap",
      confidence: 0.68,
      corroboration: [],
    };
  }
  if (stepId === "final-test" && /smoke|final|json|runtime/i.test(error)) {
    return {
      category: "final_test_contract_gap",
      confidence: 0.68,
      corroboration: [],
    };
  }
  return { category: "unknown", confidence: 0.35, corroboration: [] };
}

function repairTargetFor(category: string, failureClass: FailureClass): RepairTarget {
  if (failureClass !== "platform_failure") return failureClass === "project_failure" ? "generated_project" : "none";
  if (category.startsWith("mc_")) return "mission_control";
  return "setfarm_repo";
}

function resumePolicyFor(category: string, failureClass: FailureClass): ResumePolicy {
  if (failureClass !== "platform_failure") return "none";
  if (category === "design_import_gap") return "start_clean_replay";
  if (category.startsWith("mc_")) return "replay_failed_step";
  if (category === "smoke_contract_gap" || category === "qa_contract_gap" || category === "final_test_contract_gap") return "replay_failed_step";
  return "start_clean_replay";
}

function repairModeFor(failureClass: FailureClass): "platform_self_heal" | "project_repair" | "human_review" {
  if (failureClass === "platform_failure") return "platform_self_heal";
  if ((failureClass as FailureClass) === "project_failure") return "project_repair";
  return "human_review";
}

function blueClassify(stepId: string, error: string): { classification: FailureClass; category: string; confidence: number; corroboration: MechanicalCorroboration[]; rationale: string } {
  const routed = routeCategory(stepId, error);
  const ownership = ownershipForCategory(routed.category);
  const hasCorroboration = routed.corroboration.length > 0;
  const classification: FailureClass = ownership && hasCorroboration ? "platform_failure" : routed.category === "unknown" ? "ambiguous_failure" : "ambiguous_failure";
  return {
    classification,
    category: routed.category,
    confidence: routed.confidence,
    corroboration: routed.corroboration,
    rationale: ownership
      ? `Failure maps to ${routed.category}; platform patch requires corroboration and policy gates.`
      : "No platform ownership category matched this failure.",
  };
}

function redReview(blue: ReturnType<typeof blueClassify>, error: string): { invalidatedPlatformFailure: boolean; rationale: string } {
  const normalized = error.toLowerCase();
  const projectSignals = [
    "button has no handler",
    "game does not move",
    "settings",
    "acceptance criteria",
    "no changed files",
    "implementation",
  ];
  const hasProjectSignal = projectSignals.some((signal) => normalized.includes(signal));
  if (blue.classification === "platform_failure" && hasProjectSignal && blue.corroboration.length === 0) {
    return { invalidatedPlatformFailure: true, rationale: "Project-implementation signals are present and no mechanical corroboration supports platform failure." };
  }
  if (blue.classification === "platform_failure") {
    return { invalidatedPlatformFailure: false, rationale: "No stronger project-failure signal invalidated the mechanically corroborated platform route." };
  }
  return { invalidatedPlatformFailure: false, rationale: "Blue did not request platform patch eligibility." };
}

function envAllows(config: PlatformSelfHealConfig, category: string): boolean {
  const ownership = ownershipForCategory(category);
  if (!ownership) return false;
  if (!config.allowedClasses.includes(category)) return false;
  if (!config.allowedAreas.includes(ownership.area)) return false;
  return true;
}

export function createSelfHealId(runId: string, stepId: string, error: string): string {
  const hash = createHash("sha1").update(`${runId}\n${stepId}\n${error}`).digest("hex").slice(0, 8);
  return `sh_${hash}_${randomUUID().slice(0, 8)}`;
}

export function classifyPlatformFailure(params: {
  runId: string;
  stepId: string;
  error: string;
  config: PlatformSelfHealConfig;
  selfHealId?: string;
}): FailureRoute {
  const selfHealId = params.selfHealId || createSelfHealId(params.runId, params.stepId, params.error);
  const blue = blueClassify(params.stepId, params.error);
  const red = redReview(blue, params.error);
  const corroborated = blue.corroboration.length > 0;
  const allowedByEnv = envAllows(params.config, blue.category);
  const failureClass: FailureClass = blue.classification === "platform_failure" && !red.invalidatedPlatformFailure && corroborated
    ? "platform_failure"
    : blue.category === "unknown" ? "ambiguous_failure" : "ambiguous_failure";
  const patchEligible = params.config.enabled &&
    params.config.mode !== "plan_only" &&
    failureClass === "platform_failure" &&
    allowedByEnv &&
    blue.confidence >= params.config.minConfidence;

  const reason = !params.config.enabled
    ? "Platform self-heal disabled by env."
    : failureClass !== "platform_failure"
      ? "Failure is not mechanically confirmed as platform failure."
      : !allowedByEnv
        ? "Failure category is not allowed by env policy."
        : params.config.mode === "plan_only"
          ? "Plan-only mode records artifacts but does not patch."
          : patchEligible
            ? "Patch mode may proceed after write/test gates."
            : "Confidence or policy gates blocked patching.";

  return {
    schema: "setfarm.failure-route.v1",
    createdAt: new Date().toISOString(),
    selfHealId,
    runId: params.runId,
    stepId: params.stepId,
    failureClass,
    category: blue.category,
    confidence: blue.confidence,
    evidence: [
      params.error.slice(0, 1200),
      ...blue.corroboration.map((item) => item.detail),
    ],
    repairTarget: repairTargetFor(blue.category, failureClass),
    repairMode: repairModeFor(failureClass),
    resumePolicy: resumePolicyFor(blue.category, failureClass),
    mechanicalCorroboration: blue.corroboration,
    blueAssessment: {
      classification: blue.classification,
      category: blue.category,
      rationale: blue.rationale,
    },
    redAssessment: red,
    policy: {
      mode: params.config.mode,
      allowedByEnv,
      patchEligible,
      reason,
    },
  };
}
