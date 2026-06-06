import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FailureRoute, PatchPlan } from "./types.js";

export function platformSelfHealRoot(): string {
  return process.env.SETFARM_PLATFORM_SELF_HEAL_DIR ||
    path.join(process.cwd(), ".setfarm", "platform-self-heal");
}

export function artifactDirFor(runId: string, selfHealId: string): string {
  return path.join(platformSelfHealRoot(), runId, selfHealId);
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

export function persistPlanOnlyArtifacts(params: {
  route: FailureRoute;
  patchPlan: PatchPlan;
}): string {
  const dir = artifactDirFor(params.route.runId, params.route.selfHealId);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, "FAILURE_ROUTE.json"), params.route);
  writeJson(path.join(dir, "PATCH_PLAN.json"), params.patchPlan);
  writeJson(path.join(dir, "RESULT.json"), {
    schema: "setfarm.platform-self-heal-result.v1",
    selfHealId: params.route.selfHealId,
    createdAt: new Date().toISOString(),
    status: "plan_only",
    artifactHost: os.hostname(),
    patchApplied: false,
    reason: params.route.policy.reason,
  });
  return dir;
}
