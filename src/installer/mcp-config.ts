/**
 * MCP (Model Context Protocol) Configuration
 * Defines MCP servers available to agents during pipeline execution.
 * OpenClaw supports mcpServers in settings.json natively.
 */

export type AgentRole = "analysis" | "coding" | "verification" | "testing" | "scanning" | "pr";

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export function getDefaultMcpServers(): Record<string, McpServerConfig> {
  return {
    "context7": {
      command: "npx",
      args: ["-y", "@upstash/context7-mcp@latest"],
    },
  };
}

export function getMcpServersForRole(role: AgentRole): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};
  const defaults = getDefaultMcpServers();

  // All roles get context7 for documentation lookup
  servers["context7"] = defaults["context7"];

  return servers;
}

export function generateMcpSettingsJson(role: AgentRole): { mcpServers: Record<string, McpServerConfig> } {
  return { mcpServers: getMcpServersForRole(role) };
}
