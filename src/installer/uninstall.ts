import fs from "node:fs/promises";
import path from "node:path";
import { readOpenClawConfig, writeOpenClawConfig } from "./openclaw-config.js";
import { removeMainAgentGuidance } from "./main-agent-guidance.js";
import { resolveRunRoot, resolveWorkflowDir, resolveWorkflowWorkspaceDir } from "./paths.js";
import type { WorkflowInstallResult } from "./types.js";

function filterAgentList(
  list: Array<Record<string, unknown>>,
  workflowId: string,
): Array<Record<string, unknown>> {
  const prefix = `${workflowId}/`;
  return list.filter((entry) => {
    const id = typeof entry.id === "string" ? entry.id : "";
    return !id.startsWith(prefix);
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeRunRecords(workflowId: string): Promise<void> {
  const runRoot = resolveRunRoot();
  if (!(await pathExists(runRoot))) {
    return;
  }
  const entries = await fs.readdir(runRoot);
  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(runRoot, entry);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as { workflowId?: string };
      if (data.workflowId === workflowId) {
        await fs.rm(filePath, { force: true });
      }
    } catch {
      // Ignore malformed run data.
    }
  }
}

export async function uninstallWorkflow(params: {
  workflowId: string;
  removeGuidance?: boolean;
}): Promise<WorkflowInstallResult> {
  const workflowDir = resolveWorkflowDir(params.workflowId);
  const workflowWorkspaceDir = resolveWorkflowWorkspaceDir(params.workflowId);
  const { path: configPath, config } = await readOpenClawConfig();
  const list = Array.isArray(config.agents?.list) ? config.agents?.list : [];
  const nextList = filterAgentList(list, params.workflowId);
  const removedAgents = list.filter((entry) => !nextList.includes(entry));
  if (config.agents) {
    config.agents.list = nextList;
  }
  await writeOpenClawConfig(configPath, config);

  if (params.removeGuidance !== false) {
    await removeMainAgentGuidance();
  }

  if (await pathExists(workflowDir)) {
    await fs.rm(workflowDir, { recursive: true, force: true });
  }

  if (await pathExists(workflowWorkspaceDir)) {
    await fs.rm(workflowWorkspaceDir, { recursive: true, force: true });
  }

  await removeRunRecords(params.workflowId);

  for (const entry of removedAgents) {
    const agentDir = typeof entry.agentDir === "string" ? entry.agentDir : "";
    if (!agentDir) {
      continue;
    }
    if (await pathExists(agentDir)) {
      await fs.rm(agentDir, { recursive: true, force: true });
    }
  }

  return { workflowId: params.workflowId, workflowDir };
}
