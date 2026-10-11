import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { readOpenClawConfig, writeOpenClawConfig } from "./openclaw-config.js";
import { removeMainAgentGuidance } from "./main-agent-guidance.js";
import {
  resolveSetfarmRoot,
  resolveRunRoot,
  resolveWorkflowDir,
  resolveWorkflowWorkspaceDir,
  resolveWorkflowWorkspaceRoot,
  resolveWorkflowRoot,
} from "./paths.js";
import { removeSubagentAllowlist } from "./subagent-allowlist.js";
import { uninstallSetfarmSkill } from "./skill-install.js";
import { removeAgentCrons } from "./agent-cron.js";
import { deleteAgentCronJobs } from "./gateway-api.js";
import { pgQuery, pgRun, pgGet } from "../db-pg.js";
import { stopDaemon } from "../server/daemonctl.js";
import type { WorkflowInstallResult } from "./types.js";
import { assertCleanupTargetOutsideBaselineV2 } from "./platform-cleanup-protection-v2.js";
import { withDashboardCutoverLocalProducerAsyncV2 } from "../internal-production/baseline-dashboard-cutover-local-producer-drain-v2.js";


function filterAgentList(
  list: Array<Record<string, unknown>>,
  workflowId: string,
): Array<Record<string, unknown>> {
  const prefix = `${workflowId}_`;
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

const DEFAULT_CRON_SESSION_RETENTION = "4h";
const DEFAULT_SESSION_MAINTENANCE = {
  mode: "enforce",
  pruneAfter: "2d",
  maxEntries: 500,
  rotateBytes: "10mb",
} as const;

async function getActiveRuns(workflowId?: string): Promise<Array<{ id: string; workflow_id: string; task: string }>> {
  try {
    if (workflowId) {
      return await pgQuery<{ id: string; workflow_id: string; task: string }>(
        "SELECT id, workflow_id, task FROM runs WHERE workflow_id = $1 AND status = 'running'", [workflowId]
      );
    }
    return await pgQuery<{ id: string; workflow_id: string; task: string }>(
      "SELECT id, workflow_id, task FROM runs WHERE status = 'running'"
    );
  } catch {
    return [];
  }
}

export async function checkActiveRuns(workflowId?: string): Promise<Array<{ id: string; workflow_id: string; task: string }>> {
  return getActiveRuns(workflowId);
}

async function removeRunRecords(workflowId: string): Promise<void> {
  try {
    const runs = await pgQuery<{ id: string }>("SELECT id FROM runs WHERE workflow_id = $1", [workflowId]);
    for (const run of runs) {
      await pgRun("DELETE FROM stories WHERE run_id = $1", [run.id]);
      await pgRun("DELETE FROM steps WHERE run_id = $1", [run.id]);
    }
    await pgRun("DELETE FROM runs WHERE workflow_id = $1", [workflowId]);
  } catch {
    // DB might not exist yet
  }
}

export async function uninstallWorkflow(params: {
  workflowId: string;
  removeGuidance?: boolean;
}): Promise<WorkflowInstallResult> {
  return withDashboardCutoverLocalProducerAsyncV2("workflow-uninstall", async () => {
    const workflowDir = resolveWorkflowDir(params.workflowId);
    const workflowWorkspaceDir = resolveWorkflowWorkspaceDir(params.workflowId);
    const { path: configPath, config } = await readOpenClawConfig();
    const list = Array.isArray(config.agents?.list) ? config.agents?.list : [];
    const nextList = filterAgentList(list, params.workflowId);
    const removedAgents = list.filter((entry) => !nextList.includes(entry));
    const agentParentDirs = Object.freeze(removedAgents
      .map(entry => typeof entry.agentDir === "string" ? entry.agentDir : "")
      .filter(Boolean).map(agentDir => path.dirname(agentDir)));
    const cleanupTargets = Object.freeze([workflowDir, workflowWorkspaceDir, ...agentParentDirs]);
    if (cleanupTargets.length > 128) throw Error("SETFARM_PROTECTED_BASELINE_CLEANUP_REFUSED");
    cleanupTargets.forEach(target => assertCleanupTargetOutsideBaselineV2(target));
    if (config.agents) {
      config.agents.list = nextList;
    }
    removeSubagentAllowlist(
      config,
      removedAgents
        .map((entry) => (typeof entry.id === "string" ? entry.id : ""))
        .filter(Boolean),
    );
    await writeOpenClawConfig(configPath, config);

    if (params.removeGuidance !== false) {
      await removeMainAgentGuidance();
    }

    if (await pathExists(workflowDir)) {
      assertCleanupTargetOutsideBaselineV2(workflowDir);
      await fs.rm(workflowDir, { recursive: true, force: true });
    }

    if (await pathExists(workflowWorkspaceDir)) {
      assertCleanupTargetOutsideBaselineV2(workflowWorkspaceDir);
      await fs.rm(workflowWorkspaceDir, { recursive: true, force: true });
    }

    await removeRunRecords(params.workflowId);
    await removeAgentCrons(params.workflowId);

    for (const parentDir of agentParentDirs) {
      if (await pathExists(parentDir)) {
        assertCleanupTargetOutsideBaselineV2(parentDir);
        await fs.rm(parentDir, { recursive: true, force: true });
      }
    }

    return { workflowId: params.workflowId, workflowDir };
  });
}

export async function uninstallAllWorkflows(): Promise<void> {
  return withDashboardCutoverLocalProducerAsyncV2("all-workflows-uninstall", async () => {
    const { path: configPath, config } = await readOpenClawConfig();
    const list = Array.isArray(config.agents?.list) ? config.agents?.list : [];
    const removedAgents = list.filter((entry) => {
      const id = typeof entry.id === "string" ? entry.id : "";
      const agentDir = typeof entry.agentDir === "string" ? entry.agentDir : "";
      return id !== "main" && agentDir.includes("/.openclaw/agents/");
    });
    const workflowRoot = resolveWorkflowRoot();
    const workflowWorkspaceRoot = resolveWorkflowWorkspaceRoot();
    const setfarmRoot = resolveSetfarmRoot();
    const projectRoot = path.resolve(import.meta.dirname, "..", "..");
    const distDir = path.join(projectRoot, "dist");
    const nodeModulesDir = path.join(projectRoot, "node_modules");
    const agentParentDirs = Object.freeze(removedAgents
      .map(entry => typeof entry.agentDir === "string" ? entry.agentDir : "")
      .filter(Boolean).map(agentDir => path.dirname(agentDir)));
    const setfarmTargets = Object.freeze(["dashboard.pid", "dashboard.log", "events.jsonl", "logs"]
      .map(name => path.join(setfarmRoot, name)));
    const cleanupTargets = Object.freeze([workflowRoot, workflowWorkspaceRoot, ...agentParentDirs,
      ...setfarmTargets, setfarmRoot, distDir, nodeModulesDir]);
    if (cleanupTargets.length > 128) throw Error("SETFARM_PROTECTED_BASELINE_CLEANUP_REFUSED");
    cleanupTargets.forEach(target => assertCleanupTargetOutsideBaselineV2(target));
    stopDaemon();
    if (config.agents) {
      config.agents.list = list.filter((entry) => !removedAgents.includes(entry));
    }
    removeSubagentAllowlist(
      config,
      removedAgents
        .map((entry) => (typeof entry.id === "string" ? entry.id : ""))
        .filter(Boolean),
    );
    if (config.cron?.sessionRetention === DEFAULT_CRON_SESSION_RETENTION) {
      delete config.cron.sessionRetention;
      if (Object.keys(config.cron).length === 0) {
        delete config.cron;
      }
    }
    if (config.session?.maintenance) {
      const maintenance = config.session.maintenance;
      const rotateBytes = (maintenance as Record<string, unknown>).rotateBytes;
      const matchesDefaults =
        maintenance.mode === DEFAULT_SESSION_MAINTENANCE.mode &&
        (maintenance.pruneAfter === DEFAULT_SESSION_MAINTENANCE.pruneAfter ||
          maintenance.pruneDays === undefined) &&
        maintenance.maxEntries === DEFAULT_SESSION_MAINTENANCE.maxEntries &&
        (rotateBytes === undefined || rotateBytes === DEFAULT_SESSION_MAINTENANCE.rotateBytes);
      if (matchesDefaults) {
        delete config.session.maintenance;
        if (Object.keys(config.session).length === 0) {
          delete config.session;
        }
      }
    }
    await writeOpenClawConfig(configPath, config);

    await removeMainAgentGuidance();
    await uninstallSetfarmSkill();

    await deleteAgentCronJobs("setfarm/");

    if (await pathExists(workflowRoot)) {
      assertCleanupTargetOutsideBaselineV2(workflowRoot);
      await fs.rm(workflowRoot, { recursive: true, force: true });
    }

    if (await pathExists(workflowWorkspaceRoot)) {
      assertCleanupTargetOutsideBaselineV2(workflowWorkspaceRoot);
      await fs.rm(workflowWorkspaceRoot, { recursive: true, force: true });
    }

    for (const parentDir of agentParentDirs) {
      if (await pathExists(parentDir)) {
        assertCleanupTargetOutsideBaselineV2(parentDir);
        await fs.rm(parentDir, { recursive: true, force: true });
      }
    }

    if (await pathExists(setfarmRoot)) {
      for (const p of setfarmTargets) {
        if (await pathExists(p)) {
          assertCleanupTargetOutsideBaselineV2(p);
          await fs.rm(p, { recursive: true, force: true });
        }
      }
      const entries = await fs.readdir(setfarmRoot).catch(() => ["placeholder"] as string[]);
      if (entries.length === 0) {
        assertCleanupTargetOutsideBaselineV2(setfarmRoot);
        await fs.rm(setfarmRoot, { recursive: true, force: true });
      }
    }

    const { removeCliSymlink } = await import("./symlink.js");
    removeCliSymlink();

    // Note: execSync used here for npm unlink — no user input, safe usage
    try {
      execSync("npm unlink -g", { cwd: projectRoot, stdio: "ignore" });
    } catch {
      // link may not exist
    }
    if (await pathExists(distDir)) {
      assertCleanupTargetOutsideBaselineV2(distDir);
      await fs.rm(distDir, { recursive: true, force: true });
    }
    if (await pathExists(nodeModulesDir)) {
      assertCleanupTargetOutsideBaselineV2(nodeModulesDir);
      await fs.rm(nodeModulesDir, { recursive: true, force: true });
    }
  });
}
