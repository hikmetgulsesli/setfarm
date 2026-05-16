import type { SupervisorFinding, SupervisorModelProvider } from "./types.js";
import { chooseSupervisorProvider, readSupervisorModelPolicy } from "./model-policy.js";
import {
  appendSupervisorEvent,
  supervisorFixerPlanPath,
  upsertSupervisorRunMetadata,
} from "./state.js";
import fs from "node:fs";
import path from "node:path";

export interface SupervisorFixerPlan {
  schema: "setfarm.supervisor-fixer-plan.v1";
  createdAt: string;
  provider: SupervisorModelProvider;
  reason: string;
  findings: string[];
  allowedFiles: string[];
  repeatedBlockerCount?: number;
}

export function planSupervisorFix(params: {
  findings: SupervisorFinding[];
  allowedFiles: string[];
  failedProviders?: SupervisorModelProvider[];
  repeatedBlockerCount?: number;
}): SupervisorFixerPlan {
  const policy = readSupervisorModelPolicy();
  const provider = chooseSupervisorProvider({
    policy,
    failedProviders: params.failedProviders,
    repeatedBlockerCount: params.repeatedBlockerCount,
  });
  return {
    schema: "setfarm.supervisor-fixer-plan.v1",
    createdAt: new Date().toISOString(),
    provider,
    reason: params.repeatedBlockerCount && params.repeatedBlockerCount > 1
      ? "Repeated blocker remained after supervisor intervention."
      : "Supervisor blocker needs a scoped architect/fixer pass.",
    findings: params.findings.map((finding) => `${finding.itemId}: ${finding.message}`).slice(0, 12),
    allowedFiles: [...new Set(params.allowedFiles)].slice(0, 40),
    repeatedBlockerCount: params.repeatedBlockerCount,
  };
}

export function persistSupervisorFixerPlan(params: {
  workdir: string;
  runId: string;
  storyId?: string;
  findings: SupervisorFinding[];
  allowedFiles: string[];
  failedProviders?: SupervisorModelProvider[];
  repeatedBlockerCount?: number;
}): SupervisorFixerPlan {
  const plan = planSupervisorFix({
    findings: params.findings,
    allowedFiles: params.allowedFiles,
    failedProviders: params.failedProviders,
    repeatedBlockerCount: params.repeatedBlockerCount,
  });
  const file = supervisorFixerPlanPath(params.workdir, params.runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(plan, null, 2) + "\n");
  upsertSupervisorRunMetadata({
    workdir: params.workdir,
    runId: params.runId,
    scope: "story",
    status: "fixing",
    storyId: params.storyId,
    provider: plan.provider,
    activeFixers: [String(plan.provider)],
    fixerPlan: file,
  });
  appendSupervisorEvent(params.workdir, {
    ts: plan.createdAt,
    runId: params.runId,
    storyId: params.storyId,
    type: "fixer-selected",
    source: "fixer",
    message: `Supervisor selected ${plan.provider} for repeated blocker repair.`,
    data: {
      provider: plan.provider,
      repeatedBlockerCount: params.repeatedBlockerCount || 0,
      findings: plan.findings,
      allowedFiles: plan.allowedFiles,
    },
  });
  return plan;
}
