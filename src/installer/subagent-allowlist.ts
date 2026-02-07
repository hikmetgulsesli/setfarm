type SubagentDefaults = {
  allowAgents?: string[];
};

type AgentsConfig = {
  defaults?: {
    subagents?: SubagentDefaults;
  };
};

type OpenClawConfig = {
  agents?: AgentsConfig;
};

function normalizeAllowAgents(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function ensureDefaults(config: OpenClawConfig): SubagentDefaults {
  if (!config.agents) {
    config.agents = {};
  }
  if (!config.agents.defaults) {
    config.agents.defaults = {};
  }
  if (!config.agents.defaults.subagents) {
    config.agents.defaults.subagents = {};
  }
  return config.agents.defaults.subagents;
}

export function addSubagentAllowlist(config: OpenClawConfig, agentIds: string[]): void {
  if (agentIds.length === 0) {
    return;
  }
  const subagents = ensureDefaults(config);
  const existing = normalizeAllowAgents(subagents.allowAgents);
  if (existing.includes("*")) {
    return;
  }
  subagents.allowAgents = uniq([...existing, ...agentIds]);
}

export function removeSubagentAllowlist(config: OpenClawConfig, agentIds: string[]): void {
  if (agentIds.length === 0) {
    return;
  }
  const subagents = ensureDefaults(config);
  const existing = normalizeAllowAgents(subagents.allowAgents);
  if (existing.includes("*")) {
    return;
  }
  const next = existing.filter((entry) => !agentIds.includes(entry));
  if (next.length === 0) {
    delete subagents.allowAgents;
    return;
  }
  subagents.allowAgents = next;
}
