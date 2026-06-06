import { ownershipForCategory } from "./ownership-map.js";
import type { FailureRoute, PatchPlan } from "./types.js";

export function buildPlanOnlyPatchPlan(route: FailureRoute): PatchPlan {
  const ownership = ownershipForCategory(route.category);
  const targetFiles = ownership?.ownedPaths || [];
  return {
    schema: "setfarm.platform-patch-plan.v1",
    selfHealId: route.selfHealId,
    createdAt: new Date().toISOString(),
    intent: route.failureClass === "platform_failure"
      ? `Investigate ${route.category} platform repair for ${route.stepId}.`
      : `Do not patch platform; ${route.failureClass} requires review.`,
    targetFiles,
    expectedBehaviorChange: route.failureClass === "platform_failure"
      ? [`Preserve platform strictness while addressing ${route.category}.`]
      : [],
    testsToRun: ownership?.categorySuite || [],
    rollback: "none",
    status: "plan_only",
    reason: route.policy.reason,
  };
}

export function validatePatchPlanTargets(route: FailureRoute, plan: PatchPlan): { ok: boolean; reason?: string } {
  const ownership = ownershipForCategory(route.category);
  if (!ownership) return { ok: plan.targetFiles.length === 0, reason: "No ownership entry exists for category." };
  const allowed = new Set(ownership.ownedPaths);
  for (const file of plan.targetFiles) {
    if (file.includes("tests/platform-invariants/") || file.includes("tests/immutable/")) {
      return { ok: false, reason: `Immutable invariant path is forbidden: ${file}` };
    }
    if (!allowed.has(file) && !ownership.ownedPaths.some((entry) => entry.endsWith("/**") && file.startsWith(entry.slice(0, -3)))) {
      return { ok: false, reason: `Target file outside ownership map: ${file}` };
    }
  }
  return { ok: true };
}
