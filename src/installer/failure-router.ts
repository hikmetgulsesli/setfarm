import { classifyStackFailure } from "./stack-modules/registry.js";
import type { StackPackId } from "./stack-contract/types.js";

export type FailureRouteAction = "re_claim" | "link_story" | "platform_bug" | "infra_retry";

export type FailureRoutePolicy = "qa_fix_disabled" | "qa_fix_bounded";

export interface FailureRouteInput {
  runId: string;
  stepId: string;
  failure: string;
  stackPackId?: StackPackId | string | null;
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

function isStackPackId(value: unknown): value is StackPackId {
  return [
    "nextjs-web-app",
    "vite-react-web-app",
    "static-html-site",
    "browser-game-canvas",
    "node-express-api",
    "node-cli",
    "python-cli",
    "python-web",
    "react-native-expo",
    "android-app",
    "ios-app",
    "desktop-electron",
  ].includes(String(value));
}

export function routeDownstreamQualityFailure(input: FailureRouteInput): FailureRouteDecision {
  const stackPackId = isStackPackId(input.stackPackId) ? input.stackPackId : "vite-react-web-app";
  const classification = classifyStackFailure(stackPackId, {
    stepId: input.stepId,
    failure: input.failure,
    hasMachineEvidence: input.hasMachineEvidence,
  });
  const category = classification.category;
  const qaFixEnabled = readQaFixEnabled();
  const policy: FailureRoutePolicy = qaFixEnabled ? "qa_fix_bounded" : "qa_fix_disabled";

  if (classification.action === "infra_retry") {
    return {
      action: "infra_retry",
      category,
      reason: classification.reason,
      qaFixAllowed: false,
      policy,
    };
  }

  if (classification.action === "platform_bug") {
    return {
      action: "platform_bug",
      category,
      reason: classification.reason,
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
