import type { SupervisorFinding, SupervisorModelProvider } from "./types.js";
import { chooseSupervisorProvider, readSupervisorModelPolicy } from "./model-policy.js";

export interface SupervisorFixerPlan {
  provider: SupervisorModelProvider;
  reason: string;
  findings: string[];
  allowedFiles: string[];
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
    provider,
    reason: params.repeatedBlockerCount && params.repeatedBlockerCount > 1
      ? "Repeated blocker remained after supervisor intervention."
      : "Supervisor blocker needs a scoped architect/fixer pass.",
    findings: params.findings.map((finding) => `${finding.itemId}: ${finding.message}`).slice(0, 12),
    allowedFiles: [...new Set(params.allowedFiles)].slice(0, 40),
  };
}
