/**
 * Cleanup Operations
 *
 * Extracted from step-ops.ts — abandoned step cleanup, progress archiving,
 * local branch cleanup, cron teardown scheduling.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pgQuery, pgRun, pgGet, now } from "../db-pg.js";
import type { LoopConfig } from "./types.js";
import { logger } from "../lib/logger.js";
import { emitEvent } from "./events.js";
import { teardownWorkflowCronsIfIdle, syncActiveCrons } from "./agent-cron.js";
import {
  BASE_ABANDONED_THRESHOLD_MS,
  SLOW_STEP_IDS,
  SLOW_ABANDONED_THRESHOLD_MS,
  SLOW_FAST_ABANDONED_THRESHOLD_MS,
  FAST_STEP_ABANDONED_THRESHOLD_MS,
  FAST_STEP_FAST_ABANDONED_THRESHOLD_MS,
  MAX_ABANDON_RESETS,
  STEP_STATUS,
} from "./constants.js";
import { autoSaveWorktree } from "./worktree-ops.js";
import { getWorkflowId, getRunContext, failRun, recordStepTransition } from "./repo.js";
import { getAgentWorkspacePath } from "./worktree-ops.js";

// ── Helper ──────────────────────────────────────────────────────────

const PROJECT_ARTIFACT_PATHS = [
  "QA_REPORT.md",
  "qa-report.md",
  "qa-report.json",
  "qa-report.txt",
  "qa-debug.cjs",
  "qa-full-test.cjs",
  "qa-test*.cjs",
  "smoke-home.png",
  "smoke-after-click.png",
];

const TRANSIENT_PREVIEW_PORTS = new Set(["4173", ...Array.from({ length: 17 }, (_, idx) => String(5173 + idx))]);

type ProcessRow = {
  pid: number;
  ppid: number;
  command: string;
  cwd?: string;
  cgroup?: string;
};

function isSafeProjectDir(repoPath: string): boolean {
  if (!repoPath || !path.isAbsolute(repoPath)) return false;
  const resolved = path.resolve(repoPath);
  if (resolved === "/" || resolved === os.homedir() || resolved === path.join(os.homedir(), ".openclaw", "setfarm-repo")) return false;
  return fs.existsSync(resolved);
}

function getProjectDirs(context: Record<string, string>): string[] {
  const dirs = new Set<string>();
  for (const key of ["repo", "REPO", "story_workdir"]) {
    const value = context[key];
    if (value && isSafeProjectDir(value)) dirs.add(path.resolve(value));
  }
  return [...dirs];
}

function cleanupUntrackedProjectArtifacts(repoPath: string): number {
  if (!fs.existsSync(path.join(repoPath, ".git"))) return 0;
  let files: string[] = [];
  try {
    const out = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", ...PROJECT_ARTIFACT_PATHS], {
      cwd: repoPath,
      timeout: 10_000,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    files = out ? out.split(/\n+/).filter(Boolean) : [];
  } catch {
    return 0;
  }

  let removed = 0;
  for (const rel of files) {
    const abs = path.resolve(repoPath, rel);
    if (abs !== repoPath && !abs.startsWith(repoPath + path.sep)) continue;
    try {
      const st = fs.statSync(abs);
      if (st.isFile() || st.isSymbolicLink()) {
        fs.unlinkSync(abs);
        removed++;
      }
    } catch { /* already gone */ }
  }
  return removed;
}

function parseProcessRows(): ProcessRow[] {
  let out = "";
  try {
    out = execFileSync("ps", ["-eo", "pid=,ppid=,command="], {
      timeout: 10_000,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }
  return out.split("\n").map((line): ProcessRow | null => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\s\S]+)$/);
    if (!match) return null;
    const pid = Number(match[1]);
    return {
      pid,
      ppid: Number(match[2]),
      command: match[3],
      cwd: readProcessCwd(pid),
      cgroup: readProcessCgroup(pid),
    };
  }).filter((row): row is ProcessRow => !!row && row.pid > 0);
}

function readProcessCwd(pid: number): string | undefined {
  if (process.platform !== "linux") return undefined;
  try { return fs.realpathSync(`/proc/${pid}/cwd`); } catch { return undefined; }
}

function readProcessCgroup(pid: number): string | undefined {
  if (process.platform !== "linux") return undefined;
  try { return fs.readFileSync(`/proc/${pid}/cgroup`, "utf-8").trim().split("\n").pop(); } catch { return undefined; }
}

function collectDescendants(pid: number, childrenByParent: Map<number, ProcessRow[]>, out: Set<number>): void {
  const children = childrenByParent.get(pid) || [];
  for (const child of children) {
    if (out.has(child.pid)) continue;
    out.add(child.pid);
    collectDescendants(child.pid, childrenByParent, out);
  }
}

function hasAllowedTransientPort(command: string, ports: Set<string>): boolean {
  for (const port of ports) {
    const escaped = port.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:--port(?:=|\\s+)|-p\\s+|-l\\s+|--listen(?:=|\\s+))${escaped}\\b`).test(command)) return true;
  }
  return false;
}

function isPathInside(child: string | undefined, parent: string): boolean {
  if (!child) return false;
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  return resolvedChild === resolvedParent || resolvedChild.startsWith(resolvedParent + path.sep);
}

function isManagedProjectService(row: ProcessRow): boolean {
  const cgroup = row.cgroup || "";
  if (!/\.service\b/.test(cgroup)) return false;
  // Agent-spawned preview processes inherit Setfarm/OpenClaw service cgroups;
  // deployed apps have their own project service cgroup and must be preserved.
  return !/(setfarm-spawner|openclaw-gateway)\.service\b/.test(cgroup);
}

function isTransientPreviewCommand(row: ProcessRow, repoPath: string, ports: Set<string>): boolean {
  const command = row.command;
  const cwd = row.cwd || "";
  if (isManagedProjectService(row)) return false;
  // Deleted Setfarm story worktrees cannot be valid active project servers.
  // Agents sometimes leave Vite/esbuild behind after git worktree removal; those
  // processes keep the OpenClaw gateway cgroup hot and are not tied to the
  // standard preview port range.
  if (
    /\bstory-worktrees\b/.test(cwd) &&
    /\(deleted\)$/.test(cwd) &&
    /\b(vite|esbuild|npm|npx|node|sh|bash)\b/.test(command)
  ) {
    return true;
  }
  if (!command.includes(repoPath) && !isPathInside(row.cwd, repoPath)) return false;
  if (!hasAllowedTransientPort(command, ports)) return false;
  return /\b(vite|next)\b[\s\S]{0,80}\b(dev|preview|start)\b|\bnpx\s+vite\b|\bnpm\s+exec\s+vite\b|\bserve\b[\s\S]{0,80}\bdist\b/.test(command);
}

function reapTransientPreviewProcesses(repoPath: string, ports: Set<string>): number {
  const rows = parseProcessRows();
  if (rows.length === 0) return 0;

  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const childrenByParent = new Map<number, ProcessRow[]>();
  for (const row of rows) {
    const children = childrenByParent.get(row.ppid) || [];
    children.push(row);
    childrenByParent.set(row.ppid, children);
  }

  const targets = new Set<number>();
  for (const row of rows) {
    if (!isTransientPreviewCommand(row, repoPath, ports)) continue;
    targets.add(row.pid);
    collectDescendants(row.pid, childrenByParent, targets);

    let parent = byPid.get(row.ppid);
    while (parent && parent.pid !== 1 && parent.pid !== process.pid) {
      if (!/\b(npm|npx|node|sh|bash)\b/.test(parent.command) || !/\b(vite|npm exec|npx|sh -c|bash -c)\b/.test(parent.command)) break;
      targets.add(parent.pid);
      parent = byPid.get(parent.ppid);
    }
  }

  if (targets.size === 0) return 0;
  const ordered = [...targets].sort((a, b) => b - a);
  for (const pid of ordered) {
    try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
  }
  const deadline = Date.now() + 1200;
  while (Date.now() < deadline) {
    let anyAlive = false;
    for (const pid of ordered) {
      try { process.kill(pid, 0); anyAlive = true; break; } catch { /* dead */ }
    }
    if (!anyAlive) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  for (const pid of ordered) {
    try { process.kill(pid, "SIGKILL"); } catch { /* already dead */ }
  }
  return targets.size;
}

export async function cleanupProjectEphemera(
  runId: string,
  reason = "step-cleanup",
  explicitContext?: Record<string, string>,
): Promise<void> {
  try {
    const context = explicitContext || await getRunContext(runId);
    const ports = new Set(TRANSIENT_PREVIEW_PORTS);
    const devPort = context["dev_server_port"];
    if (devPort && /^\d+$/.test(devPort)) ports.add(devPort);

    let artifactCount = 0;
    let processCount = 0;
    for (const repoPath of getProjectDirs(context)) {
      artifactCount += cleanupUntrackedProjectArtifacts(repoPath);
      processCount += reapTransientPreviewProcesses(repoPath, ports);
    }

    if (artifactCount || processCount) {
      logger.info(`[project-cleanup] ${reason}: removed ${artifactCount} artifact(s), reaped ${processCount} transient preview process(es)`, { runId });
    }
  } catch (err) {
    logger.warn(`[project-cleanup] ${reason} failed: ${String(err).slice(0, 300)}`, { runId });
  }
}

/**
 * Fire-and-forget cron teardown when a run ends.
 * Looks up the workflow_id for the run and tears down crons if no other active runs.
 */
export function scheduleRunCronTeardown(runId: string): void {
  getWorkflowId(runId).then((wfId) => {
    if (wfId) {
      teardownWorkflowCronsIfIdle(wfId).catch((err) => {
        logger.error(`Cron teardown failed for workflow ${wfId}: ${String(err)}`, { runId });
      });
    }
  }).catch((e) => {
    logger.debug(`[cleanup] Cron teardown scheduling failed: ${e}`, { runId });
  });
}

// ── Abandoned Step Cleanup ──────────────────────────────────────────

/**
 * Find steps that have been "running" for too long and reset them to pending.
 * This catches cases where an agent claimed a step but never completed/failed it.
 * Exported so it can be called from medic/health-check crons independently of claimStep.
 *
 * Uses advancePipeline callback to avoid circular dependency with step-ops.ts.
 */
export async function cleanupAbandonedSteps(advancePipeline: (runId: string) => Promise<{ advanced: boolean; runCompleted: boolean }> | { advanced: boolean; runCompleted: boolean }): Promise<void> {
    const abandonedSteps = await pgQuery<{
      id: string; step_id: string; run_id: string; retry_count: number; max_retries: number;
      type: string; current_story_id: string | null; loop_config: string | null;
      abandoned_count: number; agent_id: string; updated_at: string;
    }>(
      `SELECT id, step_id, run_id, retry_count, max_retries, type, current_story_id, loop_config, abandoned_count, agent_id, updated_at FROM steps
       WHERE status = 'running' AND (
         (abandoned_count = 0 AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 > $1)
         OR (abandoned_count > 0 AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 > $2)
       )`,
      [FAST_STEP_ABANDONED_THRESHOLD_MS, FAST_STEP_FAST_ABANDONED_THRESHOLD_MS]
    );

    for (const step of abandonedSteps) {
      const isSlow = SLOW_STEP_IDS.has(step.step_id);
      const baseThreshold = isSlow ? SLOW_ABANDONED_THRESHOLD_MS : FAST_STEP_ABANDONED_THRESHOLD_MS;
      const fastThreshold = isSlow ? SLOW_FAST_ABANDONED_THRESHOLD_MS : FAST_STEP_FAST_ABANDONED_THRESHOLD_MS;
      const elapsedMs = (Date.now() - new Date(step.updated_at).getTime());
      const threshold = step.abandoned_count === 0 ? baseThreshold : fastThreshold;
      if (elapsedMs < threshold) continue;

      if (step.type === "loop" && !step.current_story_id && step.loop_config) {
        try {
          const loopConfig: LoopConfig = JSON.parse(step.loop_config);
          if (loopConfig.verifyEach && loopConfig.verifyStep) {
            const verifyStatus = await pgGet<{ status: string }>(
              "SELECT status FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
              [step.run_id, loopConfig.verifyStep]
            );
            if (verifyStatus?.status === STEP_STATUS.PENDING || verifyStatus?.status === STEP_STATUS.RUNNING) {
              continue;
            }
          }
        } catch (e) {
          logger.debug(`[cleanup] Malformed loop_config, proceeding with abandonment: ${e}`, { runId: step.run_id });
        }
      }

      if (step.type === "loop" && step.current_story_id) {
        const story = await pgGet<{
          id: string; retry_count: number; max_retries: number; story_id: string;
          title: string; abandoned_count: number; claimed_at: string | null;
        }>(
          "SELECT id, retry_count, max_retries, story_id, title, abandoned_count, claimed_at FROM stories WHERE id = $1",
          [step.current_story_id]
        );

        if (story) {
          try {
            const ctx = await getRunContext(step.run_id);
            const repo = ctx.repo || ctx.REPO;
            if (repo) autoSaveWorktree(repo, story.story_id, step.agent_id);
          } catch (e) {
            logger.warn(`[cleanup] auto-save worktree failed: ${String(e)}`, { runId: step.run_id });
          }

          const newAbandonCount = (story.abandoned_count ?? 0) + 1;
          const wfId = await getWorkflowId(step.run_id);
          const claimedAt = story.claimed_at || step.updated_at;
          const abandonedAt = now();
          const durationMin = Math.round((Date.now() - new Date(claimedAt as string).getTime()) / 60000);

          if (newAbandonCount >= MAX_ABANDON_RESETS) {
            const diagnostic = `ABANDONED: Agent ${step.agent_id} claimed at ${claimedAt}, timed out after ~${durationMin}min. No output produced. Attempt ${newAbandonCount}/${MAX_ABANDON_RESETS}. Limit reached — story failed.`;
            await pgRun("UPDATE stories SET output = $1 WHERE id = $2 AND (output IS NULL OR output = '')", [diagnostic, story.id]);
            await pgRun("UPDATE stories SET status = 'failed', abandoned_count = $1, updated_at = $2 WHERE id = $3", [newAbandonCount, abandonedAt, story.id]);
            await pgRun("UPDATE steps SET status = 'failed', output = 'Story abandoned and abandon limit reached', current_story_id = NULL, updated_at = $1 WHERE id = $2", [abandonedAt, step.id]);
            await recordStepTransition(step.id, step.run_id, "running", "failed", step.agent_id, "cleanup:storyAbandonLimit", { storyId: story.story_id, abandonCount: newAbandonCount });
            try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, duration_ms = $2, diagnostic = $3 WHERE story_id = $4 AND outcome IS NULL", [abandonedAt, durationMin * 60000, diagnostic, story.story_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
            await failRun(step.run_id);
            emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, storyId: story.story_id, storyTitle: story.title, detail: `Abandoned — ${diagnostic}` });
            emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Story abandoned and abandon limit reached" });
            emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story abandoned and abandon limit reached" });
            scheduleRunCronTeardown(step.run_id);
          } else {
            const diagnostic = `ABANDONED: Agent ${step.agent_id} claimed at ${claimedAt}, timed out after ~${durationMin}min. No output produced. Attempt ${newAbandonCount}/${MAX_ABANDON_RESETS}.`;
            await pgRun("UPDATE stories SET output = $1 WHERE id = $2 AND (output IS NULL OR output = '')", [diagnostic, story.id]);
            await pgRun("UPDATE stories SET status = 'pending', abandoned_count = $1, retry_count = retry_count + 1, updated_at = $2 WHERE id = $3", [newAbandonCount, abandonedAt, story.id]);
            await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, abandoned_count = $1, retry_count = retry_count + 1, updated_at = $2 WHERE id = $3", [newAbandonCount, abandonedAt, step.id]);
            await recordStepTransition(step.id, step.run_id, "running", "pending", step.agent_id, "cleanup:storyAbandoned", { storyId: story.story_id, abandonCount: newAbandonCount });
            try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, duration_ms = $2, diagnostic = $3 WHERE story_id = $4 AND outcome IS NULL", [abandonedAt, durationMin * 60000, diagnostic, story.story_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
            emitEvent({ ts: now(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Story ${story.story_id} abandoned — ${diagnostic}` });
            logger.info(`Abandoned step reset to pending (story abandon ${newAbandonCount})`, { runId: step.run_id, stepId: step.step_id });
            // Immediately recreate agent crons so the step is picked up without waiting for medic
            try {
              if (wfId) await syncActiveCrons(step.run_id, wfId);
            } catch (cronErr) {
              logger.debug(`[cleanup] Post-abandon cron sync failed: ${String(cronErr)}`, { runId: step.run_id });
            }
          }
          continue;
        }
      }

      // Single steps
      const newAbandonCount = (step.abandoned_count ?? 0) + 1;
      const singleDiagnostic = `ABANDONED: Agent ${step.agent_id} timed out. No completion signal received. Attempt ${newAbandonCount}/${MAX_ABANDON_RESETS}.`;

      if (newAbandonCount >= MAX_ABANDON_RESETS) {
        await pgRun("UPDATE steps SET status = 'failed', output = $1, abandoned_count = $2, updated_at = $3 WHERE id = $4", [singleDiagnostic, newAbandonCount, now(), step.id]);
        await recordStepTransition(step.id, step.run_id, "running", "failed", step.agent_id, "cleanup:abandonLimit", { abandonCount: newAbandonCount });
        await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), step.run_id]);
        try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, diagnostic = $2 WHERE run_id = $3 AND step_id = $4 AND outcome IS NULL", [now(), singleDiagnostic, step.run_id, step.step_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
        const wfId = await getWorkflowId(step.run_id);
        emitEvent({ ts: now(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Retries exhausted — ${singleDiagnostic}` });
        emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: singleDiagnostic });
        emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Step abandoned and retries exhausted" });
        scheduleRunCronTeardown(step.run_id);
      } else {
        await pgRun("UPDATE steps SET status = 'pending', abandoned_count = $1, retry_count = retry_count + 1, updated_at = $2 WHERE id = $3", [newAbandonCount, now(), step.id]);
        await recordStepTransition(step.id, step.run_id, "running", "pending", step.agent_id, "cleanup:abandoned", { abandonCount: newAbandonCount });
        try { await pgRun("UPDATE claim_log SET outcome = 'abandoned', abandoned_at = $1, diagnostic = $2 WHERE run_id = $3 AND step_id = $4 AND outcome IS NULL", [now(), singleDiagnostic, step.run_id, step.step_id]); } catch (e) { logger.warn("[cleanup] claim_log update failed: " + String(e), { runId: step.run_id }); }
        emitEvent({ ts: now(), event: "step.timeout", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, detail: `Reset to pending — ${singleDiagnostic}` });
        // Immediately recreate agent crons so the step is picked up without waiting for medic
        try {
          const wfId = await getWorkflowId(step.run_id);
          if (wfId) await syncActiveCrons(step.run_id, wfId);
        } catch (cronErr) {
          logger.debug(`[cleanup] Post-abandon cron sync failed: ${String(cronErr)}`, { runId: step.run_id });
        }
      }
    }

    // Reset running stories that are abandoned
    const abandonedStories = await pgQuery<{ id: string; retry_count: number; max_retries: number; run_id: string }>(
      "SELECT id, retry_count, max_retries, run_id FROM stories WHERE status = 'running' AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 > $1",
      [BASE_ABANDONED_THRESHOLD_MS]
    );

    for (const story of abandonedStories) {
      await pgRun("UPDATE stories SET status = 'pending', abandoned_count = abandoned_count + 1, retry_count = retry_count + 1, updated_at = $1 WHERE id = $2", [now(), story.id]);
    }

    // Recover stuck pipelines
    const stuckLoops = await pgQuery<{ id: string; run_id: string; step_index: number }>(
      `SELECT s.id, s.run_id, s.step_index FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.type = 'loop' AND s.status = 'done' AND r.status = 'running'
       AND NOT EXISTS (
         SELECT 1 FROM steps s2 WHERE s2.run_id = s.run_id
         AND s2.step_index > s.step_index
         AND s2.status IN ('pending', 'running')
       )
       AND EXISTS (
         SELECT 1 FROM steps s3 WHERE s3.run_id = s.run_id
         AND s3.step_index > s.step_index
         AND s3.status = 'waiting'
       )`
    );

    for (const stuck of stuckLoops) {
      logger.info(`Recovering stuck pipeline after loop completion`, { runId: stuck.run_id, stepId: stuck.id });
      await advancePipeline(stuck.run_id);
    }

    // Recover stuck verify_each
    const stuckVerify = await pgQuery<{ id: string; run_id: string; step_id: string; loop_config: string }>(
      `SELECT s.id, s.run_id, s.step_id, ls.loop_config FROM steps s
       JOIN runs r ON r.id = s.run_id
       JOIN steps ls ON ls.run_id = s.run_id AND ls.type = 'loop'
       WHERE r.status = 'running'
       AND s.status = 'waiting'
       AND ls.loop_config IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'done'
       )`
    );

    for (const sv of stuckVerify) {
      try {
        const lc = JSON.parse(sv.loop_config);
        if (lc.verifyEach && lc.verifyStep === sv.step_id) {
          await pgRun("UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2", [now(), sv.id]);
          logger.info(`[cleanup] Recovered stuck verify_each step ${sv.step_id} — done stories awaiting verification`, { runId: sv.run_id });
        }
      } catch (e) { logger.debug(`[cleanup] Skipping stuck verify with malformed loop_config: ${e}`, { runId: sv.run_id }); }
    }
}

// ── Progress Archiving ──────────────────────────────────────────────

export async function archiveRunProgress(runId: string): Promise<void> {
  const loopStep = await pgGet<{ agent_id: string }>(
    "SELECT agent_id FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [runId]
  );
  if (!loopStep) return;

  const workspace = getAgentWorkspacePath(loopStep.agent_id);
  if (!workspace) return;

  const scopedPath = path.join(workspace, `progress-${runId}.txt`);
  if (!fs.existsSync(scopedPath)) return;

  const archiveDir = path.join(workspace, "archive", runId);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(scopedPath, path.join(archiveDir, "progress.txt"));
  fs.unlinkSync(scopedPath);
}

// ── Local Branch Cleanup ────────────────────────────────────────────

/**
 * Clean up leftover local git branches when a run completes.
 * Switches to main and deletes all other branches.
 */
export async function cleanupLocalBranches(runId: string): Promise<void> {
  try {
    const context = await getRunContext(runId);
    const repo = context.repo;
    if (!repo) return;

    // Switch to main first
    try {
      execFileSync("git", ["checkout", "-f", "main"], { cwd: repo, timeout: 10_000, stdio: "pipe" });
    } catch {
      logger.warn(`[branch-cleanup] Could not checkout main in ${repo}`, {});
      return;
    }

    // List all branches except main
    try {
      const result = execFileSync("git", ["branch", "--format=%(refname:short)"], { cwd: repo, timeout: 10_000, stdio: "pipe" });
      const branches = result.toString().trim().split("\n").filter(b => b && b !== "main");
      for (const branch of branches) {
        try {
          execFileSync("git", ["branch", "-D", branch.trim()], { cwd: repo, timeout: 5_000, stdio: "pipe" });
        } catch (err) { logger.warn(`[cleanup] ${String(err)}`, {}); }
      }
      if (branches.length > 0) {
        logger.info(`[branch-cleanup] Deleted ${branches.length} stale branches for run ${runId}`, {});
      }
    } catch (err) { logger.warn(`[cleanup] ${String(err)}`, {}); }

    // Prune remote tracking branches
    try {
      execFileSync("git", ["fetch", "--prune"], { cwd: repo, timeout: 15_000, stdio: "pipe" });
    } catch (err) { logger.warn(`[cleanup] ${String(err)}`, {}); }
  } catch (err) {
    logger.warn(`[branch-cleanup] Failed for run ${runId}: ${err}`, {});
  }
}
