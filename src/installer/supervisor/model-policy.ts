import type { SupervisorModelPolicy, SupervisorModelProvider } from "./types.js";

export function readSupervisorModelPolicy(env: NodeJS.ProcessEnv = process.env): SupervisorModelPolicy {
  const providerPriority = String(env.SETFARM_SUPERVISOR_PROVIDER_PRIORITY || "codex,kimi,minimax")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const normalized = providerPriority.length > 0 ? providerPriority : ["codex", "kimi", "minimax"];
  return {
    providerPriority: normalized,
    defaultProvider: normalized[0],
    fallbackProviders: normalized.slice(1),
  };
}

export function chooseSupervisorProvider(params: {
  policy?: SupervisorModelPolicy;
  failedProviders?: SupervisorModelProvider[];
  repeatedBlockerCount?: number;
  reason?: string;
} = {}): SupervisorModelProvider {
  const policy = params.policy || readSupervisorModelPolicy();
  const failed = new Set((params.failedProviders || []).map((provider) => String(provider)));
  const priority = params.repeatedBlockerCount && params.repeatedBlockerCount > 1
    ? policy.providerPriority
    : [policy.defaultProvider, ...policy.fallbackProviders];
  return priority.find((provider) => !failed.has(String(provider))) || policy.defaultProvider;
}
