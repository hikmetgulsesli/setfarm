import { logger } from "../../lib/logger.js";
import { recordObservation } from "../observations.js";
import { readPlatformSelfHealConfig } from "./config.js";
import { classifyPlatformFailure } from "./classifier.js";
import { buildPlanOnlyPatchPlan } from "./patch-contract.js";
import { persistPlanOnlyArtifacts } from "./workspace.js";
import { appendPatchRegistryEntry } from "./patch-registry.js";
import type { PlatformSelfHealResult } from "./types.js";

export async function maybeRunPlatformSelfHeal(params: {
  runId: string;
  stepId: string;
  agentId?: string | null;
  error: string;
}): Promise<PlatformSelfHealResult> {
  const config = readPlatformSelfHealConfig();
  if (!config.enabled) {
    return { attempted: false, reason: "disabled" };
  }

  try {
    const route = classifyPlatformFailure({
      runId: params.runId,
      stepId: params.stepId,
      error: params.error,
      config,
    });
    const patchPlan = buildPlanOnlyPatchPlan(route);
    const artifactDir = persistPlanOnlyArtifacts({ route, patchPlan });
    appendPatchRegistryEntry({
      selfHealId: route.selfHealId,
      createdAt: route.createdAt,
      category: route.category,
      targetFiles: patchPlan.targetFiles,
      testsRun: patchPlan.testsToRun,
      status: "planned",
      artifactDir,
    });

    await recordObservation({
      runId: params.runId,
      stepId: params.stepId,
      agentId: params.agentId || "",
      phase: "platform-self-heal",
      checkId: `platform-self-heal:${route.selfHealId}`,
      label: "Platform self-heal plan created",
      status: route.failureClass === "platform_failure" ? "blocked" : "info",
      summary: `${route.failureClass}/${route.category}: ${route.policy.reason}`,
      detail: params.error.slice(0, 2000),
      eventType: "platform_self_heal.plan_created",
      metadata: {
        selfHealId: route.selfHealId,
        failureClass: route.failureClass,
        category: route.category,
        confidence: route.confidence,
        artifactDir,
        patchEligible: route.policy.patchEligible,
        mechanicalCorroboration: route.mechanicalCorroboration,
      },
      filePaths: patchPlan.targetFiles,
    });

    return { attempted: true, selfHealId: route.selfHealId, artifactDir, route, patchPlan };
  } catch (error) {
    logger.warn(`[platform-self-heal] plan-only failed: ${String(error).slice(0, 240)}`, { runId: params.runId, stepId: params.stepId });
    return { attempted: false, reason: String(error) };
  }
}
