/**
 * Medic — the setfarm health watchdog.
 *
 * Runs periodic health checks on workflow runs, detects stuck/stalled/dead state,
 * and takes corrective action where safe. Logs all findings to the medic_checks table.
 *
 * NOTE: This file uses execFileSync (not exec) for all subprocess calls.
 * execFileSync is safe against shell injection as it does not invoke a shell.
 */
import { pgQuery, pgGet, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import { recordStepTransition } from "../installer/repo.js";
import { emitEvent, type EventType } from "../installer/events.js";
import { teardownWorkflowCronsIfIdle, ensureWorkflowCrons, removeAgentCrons, setupAgentCrons, expectedCronCount, actualCronCount, repairAgentCrons, syncActiveCrons } from "../installer/agent-cron.js";
import { loadWorkflowSpec } from "../installer/workflow-spec.js";
import { resolveWorkflowDir, resolveSetfarmCli } from "../installer/paths.js";
import { listCronJobs } from "../installer/gateway-api.js";
import {
  runSyncChecks,
  checkOrphanedCrons,
  checkStuckWaitingSteps,
  type MedicFinding,
} from "./checks.js";
import { completeStep } from "../installer/step-ops.js";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";

/** systemctl --user wrapper with XDG_RUNTIME_DIR for crontab compat */
function systemctlUser(...args: string[]): string {
  const uid = os.userInfo().uid;
  return execFileSync("systemctl", ["--user", ...args], {
    encoding: "utf-8", timeout: 30000,
    env: { ...process.env, XDG_RUNTIME_DIR: `/run/user/${uid}`, DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${uid}/bus` },
  });
}
import { logger } from "../lib/logger.js";

// ── DB Migration ────────────────────────────────────────────────────

export async function ensureMedicTables(): Promise<void> {
  // Skip DDL — table already created by migration script
  // PG emits NOTICE for CREATE TABLE IF NOT EXISTS which clutters logs
  return;
}

// ── GitHub PR Helpers (Medic v6) ─────────────────────────────────────

function extractRepoUrl(task: string): string | null {
  const match = task.match(/https:\/\/github\.com\/[\w-]+\/[\w.-]+/);
  if (match) return match[0];
  const repoPathMatch = task.match(/REPO:\s*(\/\S+)/);
  if (repoPathMatch) {
    try {
      const remoteUrl = execFileSync(
        "git", ["-C", repoPathMatch[1], "remote", "get-url", "origin"],
        { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
      const ghMatch = remoteUrl.match(/github\.com[:/]([\w-]+\/[\w.-]+?)(?:\.git)?$/);
      if (ghMatch) return `https://github.com/${ghMatch[1]}`;
    } catch (err) { /* fall through */ }
  }
  return null;
}

function checkMergedPR(repoUrl: string, storyId: string, runId: string): string | null {
  const repoPath = repoUrl.replace("https://github.com/", "");
  const runPrefix = runId.slice(0, 8);
  const storyLower = storyId.toLowerCase().replace(/_/g, "-");
  try {
    const output = execFileSync(
      "gh", ["pr", "list", "--repo", repoPath, "--state", "merged", "--json", "number,url,headRefName", "--limit", "100"],
      { encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const prs = JSON.parse(output) as Array<{ number: number; url: string; headRefName: string }>;
    for (const pr of prs) {
      if (!pr.headRefName) continue;
      const branch = pr.headRefName.toLowerCase();
      if (branch === storyLower || branch.includes("-" + storyLower) || branch.includes("/" + storyLower) || branch.startsWith(runPrefix + "-") || branch.startsWith(runPrefix.toLowerCase() + "-")) {
        return pr.url;
      }
    }
  } catch (err) { /* fall through */ }
  return null;
}

// ── Remediation ─────────────────────────────────────────────────────

async function remediate(finding: MedicFinding): Promise<boolean> {
  switch (finding.action) {
    case "reset_step": {
      if (!finding.stepId) return false;
      const step = await pgGet<{ abandoned_count: number; output: string | null; status: string }>("SELECT abandoned_count, output, status FROM steps WHERE id = $1", [finding.stepId]);
      if (!step) return false;

      if (step.status === "running" && step.output) {
        const statusMatch = step.output.match(/^STATUS:\s*(.+)$/im);
        const statusVal = statusMatch?.[1]?.trim().toLowerCase();
        if (statusVal && ["done", "pass", "passed", "verified"].includes(statusVal)) {
          try { const result = await completeStep(finding.stepId, step.output); if (result.advanced || result.runCompleted) { emitEvent({ ts: now(), event: "step.done" as EventType, runId: finding.runId ?? "", stepId: finding.stepId, detail: "Medic: auto-completed stuck step (output had STATUS: done)" }); return true; } } catch (err) { /* fall through */ }
        }
      }

      const newCount = (step.abandoned_count ?? 0) + 1;
      const MAX_STEP_ABANDONS = 10;
      const SAME_ERROR_LIMIT = 3;

      if (step.output && newCount >= SAME_ERROR_LIMIT) {
        const recentChecks = await pgQuery<{ details: string }>("SELECT details FROM medic_checks WHERE details LIKE $1 AND details LIKE '%reset_step%' ORDER BY checked_at DESC LIMIT $2", [`%${finding.stepId}%`, SAME_ERROR_LIMIT]);
        if (recentChecks.length >= SAME_ERROR_LIMIT - 1) {
          logger.error(`[medic] Same-error circuit breaker: step ${finding.stepId} reset ${newCount}x`, { runId: finding.runId });
          await pgRun("UPDATE steps SET status = 'failed', output = $1, abandoned_count = $2, updated_at = $3 WHERE id = $4", ["Medic: same error repeated " + newCount + " times — circuit breaker. Last output: " + (step.output || "").substring(0, 300), newCount, now(), finding.stepId]);
          await recordStepTransition(finding.stepId, finding.runId || "", "running", "failed", undefined, "medic:circuitBreaker", { abandonCount: newCount });
          if (finding.runId) { await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), finding.runId]); emitEvent({ ts: now(), event: "run.failed" as EventType, runId: finding.runId, detail: "Medic: same-error circuit breaker on step " + (finding.stepId || "") }); }
          return true;
        }
      }

      // VERIFY FORCE-VERIFY (2026-04-06): If verify step is stuck 3+ times, force auto-verify all done stories
      // This catches gateway stall scenarios where the agent session never starts.
      const stepRow = await pgGet<{ step_id: string; run_id: string }>("SELECT step_id, run_id FROM steps WHERE id = $1", [finding.stepId]);
      if (stepRow && stepRow.step_id === "verify" && newCount >= 3) {
        try {
          const { autoVerifyAndAdvance } = await import("../installer/step-advance.js");
          const advanced = await autoVerifyAndAdvance(stepRow.run_id);
          if (advanced) {
            logger.info("[medic] Force auto-verified all done stories for verify step", { runId: stepRow.run_id });
            emitEvent({ ts: now(), event: "step.done" as EventType, runId: stepRow.run_id, stepId: finding.stepId, detail: "Medic: force auto-verified" });
            return true;
          }
        } catch (e) { logger.warn("[medic] Force auto-verify failed: " + String(e), { runId: stepRow?.run_id }); }
      }

      if (newCount >= MAX_STEP_ABANDONS) {
        await pgRun("UPDATE steps SET status = 'failed', output = 'Medic: abandoned too many times', abandoned_count = $1, updated_at = $2 WHERE id = $3", [newCount, now(), finding.stepId]);
        await recordStepTransition(finding.stepId, finding.runId || "", "running", "failed", undefined, "medic:abandonLimit", { abandonCount: newCount });
        if (finding.runId) { await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), finding.runId]); emitEvent({ ts: now(), event: "run.failed" as EventType, runId: finding.runId, detail: "Medic: step abandoned too many times" }); }
        return true;
      }

      await pgRun("UPDATE steps SET status = 'pending', abandoned_count = $1, retry_count = retry_count + 1, updated_at = $2 WHERE id = $3", [newCount, now(), finding.stepId]);
      await recordStepTransition(finding.stepId, finding.runId || "", "running", "pending", undefined, "medic:resetStep", { abandonCount: newCount });
      if (finding.runId) { emitEvent({ ts: now(), event: "step.timeout" as EventType, runId: finding.runId, stepId: finding.stepId, detail: `Medic: reset stuck step (abandon ${newCount}/${MAX_STEP_ABANDONS})` }); }
      // Immediately recreate crons after reset — dont wait for next medic cycle
      try {
        if (finding.runId) {
          const run = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [finding.runId]);
          if (run) await syncActiveCrons(finding.runId, run.workflow_id);
        }
      } catch {}
      return true;
    }

    case "restart_service":
    case "restart_gateway":
    case "recreate_crons":
    case "kill_browser_sessions": {
      // These actions don't differ between PG/SQLite — delegate to shared logic
      // (they use execFileSync/system calls, not DB)
      // For restart_gateway we need the DB query for activeWfs
      if (finding.action === "restart_gateway") {
        try {
          const uptimeOut = systemctlUser("show", "openclaw-gateway", "--property=ActiveEnterTimestamp").trim();
          const tsMatch = uptimeOut.match(/ActiveEnterTimestamp=(.+)/);
          if (tsMatch) { const uptimeMs = Date.now() - new Date(tsMatch[1]).getTime(); if (uptimeMs < 30 * 60 * 1000) { return false; } }
        } catch {}
        try {
          systemctlUser("restart", "openclaw-gateway");
          try {
            const { setTimeout: sleep } = await import("timers/promises");
            await sleep(5000);
            const activeWfs = await pgQuery<{ workflow_id: string }>("SELECT DISTINCT workflow_id FROM runs WHERE status = 'running'");
            const CLI = resolveSetfarmCli();
            for (const wf of activeWfs) { try { execFileSync("node", [CLI, "workflow", "ensure-crons", wf.workflow_id], { encoding: "utf-8", timeout: 60000 }); } catch {} }
          } catch {}
          emitEvent({ ts: now(), event: "run.resumed" as EventType, runId: finding.runId ?? "", detail: "Medic: gateway scheduler stalled — restarted" });
          return true;
        } catch { return false; }
      }
      if (finding.action === "restart_service") {
        if (!finding.serviceName) return false;
        try { systemctlUser("start", finding.serviceName); emitEvent({ ts: now(), event: "step.done" as EventType, runId: finding.runId ?? "", detail: "Medic: restarted " + finding.serviceName }); return true; } catch { return false; }
      }
      if (finding.action === "recreate_crons") {
        const wfId = finding.workflowId ?? finding.message.match(/workflow "([^"]+)"/)?.[1];
        if (!wfId) return false;
        try { await removeAgentCrons(wfId); const workflowDir = resolveWorkflowDir(wfId); const workflow = await loadWorkflowSpec(workflowDir); await setupAgentCrons(workflow); emitEvent({ ts: now(), event: "run.resumed" as EventType, runId: finding.runId ?? "", workflowId: wfId, detail: `Medic: force-recreated crons for "${wfId}"` }); return true; } catch { return false; }
      }
      if (finding.action === "kill_browser_sessions") {
        try { const { killOrphanedBrowserSessions } = await import("../installer/browser-tools.js"); const killed = killOrphanedBrowserSessions(); if (killed > 0) { emitEvent({ ts: now(), event: "step.done" as EventType, runId: finding.runId ?? "", detail: `Medic: killed ${killed} orphaned Chromium` }); return true; } return false; } catch { return false; }
      }
      return false;
    }

    case "fail_run": {
      if (!finding.runId) return false;
      const run = await pgGet<{ status: string; workflow_id: string }>("SELECT status, workflow_id FROM runs WHERE id = $1", [finding.runId]);
      if (!run || run.status !== "running") return false;
      // Record transitions for all active steps before failing them
      const activeStepsForFail = await pgQuery<{ id: string; status: string }>("SELECT id, status FROM steps WHERE run_id = $1 AND status IN ('waiting', 'pending', 'running')", [finding.runId]);
      await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), finding.runId]);
      await pgRun("UPDATE steps SET status = 'failed', output = 'Medic: run marked as dead', updated_at = $1 WHERE run_id = $2 AND status IN ('waiting', 'pending', 'running')", [now(), finding.runId]);
      for (const s of activeStepsForFail) { await recordStepTransition(s.id, finding.runId, s.status, "failed", undefined, "medic:failRun"); }
      emitEvent({ ts: now(), event: "run.failed" as EventType, runId: finding.runId, workflowId: run.workflow_id, detail: "Medic: zombie run" });
      try { await teardownWorkflowCronsIfIdle(run.workflow_id); } catch {}
      return true;
    }

    case "teardown_crons": {
      const match = finding.message.match(/workflow "([^"]+)"/);
      if (!match) return false;
      try { await teardownWorkflowCronsIfIdle(match[1]); return true; } catch { return false; }
    }

    case "resume_run": {
      if (!finding.runId) return false;
      const resumeClaim = await pgRun("UPDATE runs SET status = 'resuming', updated_at = $1 WHERE id = $2 AND status = 'failed'", [now(), finding.runId]);
      if (resumeClaim.changes === 0) return false;
      const run = await pgGet<{ id: string; workflow_id: string; status: string; meta: string | null }>("SELECT id, workflow_id, status, meta FROM runs WHERE id = $1", [finding.runId]);
      if (!run) return false;
      const failedStep = await pgGet<{ id: string; step_id: string; type: string; current_story_id: string | null }>("SELECT id, step_id, type, current_story_id FROM steps WHERE run_id = $1 AND status = 'failed' ORDER BY step_index ASC LIMIT 1", [run.id]);
      if (!failedStep) return false;
      const loopStep = await pgGet<{ id: string; loop_config: string | null }>("SELECT id, loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND status IN ('running', 'failed') LIMIT 1", [run.id]);

      if (loopStep?.loop_config) {
        const lc = JSON.parse(loopStep.loop_config);
        if (lc.verifyEach && lc.verifyStep === failedStep.step_id) {
          await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = GREATEST(retry_count - 1, 0), updated_at = $1 WHERE id = $2", [now(), loopStep.id]);
          await pgRun("UPDATE steps SET status = 'waiting', current_story_id = NULL, retry_count = GREATEST(retry_count - 1, 0), updated_at = $1 WHERE id = $2", [now(), failedStep.id]);
          await pgRun("UPDATE stories SET status = 'pending', updated_at = $1 WHERE run_id = $2 AND status = 'failed'", [now(), run.id]);
        }
      } else {
        if (failedStep.type === "loop") {
          const failedStory = await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = 'failed' ORDER BY story_index ASC LIMIT 1", [run.id]);
          if (failedStory) { await pgRun("UPDATE stories SET status = 'pending', updated_at = $1 WHERE id = $2", [now(), failedStory.id]); }
          await pgRun("UPDATE steps SET retry_count = GREATEST(retry_count - 1, 0) WHERE run_id = $1 AND type = 'loop'", [run.id]);
        }
        await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = GREATEST(retry_count - 1, 0), updated_at = $1 WHERE id = $2", [now(), failedStep.id]);
      }

      await pgRun("UPDATE runs SET status = 'running', updated_at = $1 WHERE id = $2 AND status = 'resuming'", [now(), run.id]);
      const meta = run.meta ? JSON.parse(run.meta) : {};
      meta.medic_resume_count = (meta.medic_resume_count ?? 0) + 1;
      meta.medic_last_resume = now();
      await pgRun("UPDATE runs SET meta = $1 WHERE id = $2", [JSON.stringify(meta), run.id]);

      try { const workflowDir = resolveWorkflowDir(run.workflow_id); const workflow = await loadWorkflowSpec(workflowDir); await ensureWorkflowCrons(workflow); } catch {}

      emitEvent({ ts: now(), event: "run.resumed" as EventType, runId: run.id, workflowId: run.workflow_id, detail: `Medic: auto-resumed (attempt ${meta.medic_resume_count}/3)` });
      return true;
    }

    case "reset_story": {
      if (!finding.storyId) return false;
      const story = await pgGet<{ abandoned_count: number; run_id: string }>("SELECT abandoned_count, run_id FROM stories WHERE id = $1 AND status = 'running'", [finding.storyId]);
      if (!story) return false;

      const storyMeta = await pgGet<{ story_id: string }>("SELECT story_id FROM stories WHERE id = $1", [finding.storyId]);
      const runMeta = await pgGet<{ task: string }>("SELECT task FROM runs WHERE id = $1", [story.run_id]);
      if (storyMeta && runMeta) {
        const repoUrl = extractRepoUrl(runMeta.task);
        if (repoUrl) {
          const prUrl = checkMergedPR(repoUrl, storyMeta.story_id, story.run_id);
          if (prUrl) {
            await pgRun("UPDATE stories SET status = 'done', abandoned_count = 0, output = $1, updated_at = $2 WHERE id = $3", [`STATUS: done\nPR_URL: ${prUrl}\nCHANGES: Medic v6: merged PR found`, now(), finding.storyId]);
            await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND type = 'loop' AND current_story_id = $3", [now(), story.run_id, finding.storyId]);
            emitEvent({ ts: now(), event: "story.done" as EventType, runId: story.run_id, detail: `Medic v6: PR merged — ${storyMeta.story_id} (${prUrl})` });
            return true;
          }
        }
      }

      const newCount = (story.abandoned_count ?? 0) + 1;
      const MAX_STORY_ABANDONS = 10;
      if (newCount >= MAX_STORY_ABANDONS) {
        await pgRun("UPDATE stories SET status = 'failed', abandoned_count = $1, output = 'Medic: abandoned too many times — failed', updated_at = $2 WHERE id = $3", [newCount, now(), finding.storyId]);
        emitEvent({ ts: now(), event: "story.failed" as EventType, runId: story.run_id, detail: `Medic: story abandoned ${newCount} times` });
      } else {
        await pgRun("UPDATE stories SET status = 'pending', abandoned_count = $1, updated_at = $2 WHERE id = $3", [newCount, now(), finding.storyId]);
        await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND type = 'loop' AND current_story_id = $3", [now(), story.run_id, finding.storyId]);
        emitEvent({ ts: now(), event: "step.timeout" as EventType, runId: story.run_id, detail: `Medic: orphaned story reset (abandon ${newCount}/${MAX_STORY_ABANDONS})` });
      }
      return true;
    }

    case "advance_pipeline": {
      if (!finding.runId) return false;
      try {
        const { advancePipeline } = await import("../installer/step-advance.js");
        const result = await advancePipeline(finding.runId);
        if (result.advanced) {
          emitEvent({ ts: now(), event: "pipeline.advanced" as EventType, runId: finding.runId, detail: "Medic: recovered stuck waiting step" });
          logger.info(`[medic] advancePipeline recovered stuck step for run ${finding.runId}`, {});
        }
        return result.advanced || result.runCompleted;
      } catch (err) {
        logger.warn(`[medic] advancePipeline recovery failed: ${String(err)}`, {});
        return false;
      }
    }

    case "none":
    default:
      return false;
  }
}

// ── Main Check Runner ───────────────────────────────────────────────

export interface MedicCheckResult { id: string; checkedAt: string; issuesFound: number; actionsTaken: number; summary: string; findings: MedicFinding[]; }

async function logCronRecreate(reason: string, workflowId: string): Promise<void> {
  try {
    await pgRun("INSERT INTO medic_checks (id, checked_at, issues_found, actions_taken, summary, details) VALUES ($1, $2, 1, 1, $3, $4)", [crypto.randomUUID(), now(), `Cron recreate: ${reason}`, JSON.stringify([{ check: "restore_crons", action: "recreate_crons", workflowId, remediated: true }])]);
  } catch (e) { logger.warn(`[medic] logCronRecreate failed: ${String(e)}`, {}); }
}

export async function restoreActiveRunCrons(): Promise<number> {
  const RECREATE_COOLDOWN_MS = 5 * 60 * 1000;
  try { const lastRecreate = await pgGet<{ checked_at: string }>("SELECT checked_at FROM medic_checks WHERE summary LIKE 'Cron recreate:%' ORDER BY checked_at DESC LIMIT 1"); if (lastRecreate && (Date.now() - new Date(lastRecreate.checked_at).getTime()) < RECREATE_COOLDOWN_MS) return 0; } catch {}
  const activeRuns = await pgQuery<{ workflow_id: string }>("SELECT DISTINCT workflow_id FROM runs WHERE status = 'running'");

  let restored = 0;
  const OVERDUE_THRESHOLD_MS = 5 * 60 * 1000;
  let overdueCronWorkflows = new Set<string>();
  try { const cronResult = await listCronJobs(); if (cronResult.ok && cronResult.jobs) { const epochMs = Date.now(); for (const job of cronResult.jobs) { if (!job.name.startsWith("setfarm/")) continue; const nextRun = (job as any).state?.nextRunAtMs ?? 0; if (nextRun > 0 && (epochMs - nextRun) > OVERDUE_THRESHOLD_MS) { const parts = job.name.split("/"); if (parts.length >= 3) overdueCronWorkflows.add(parts[1]); } } } } catch (e) { logger.warn(`[medic] overdue cron check failed: ${String(e)}`, {}); }

  for (const run of activeRuns) {
    try {
      const workflowDir = resolveWorkflowDir(run.workflow_id);
      const workflow = await loadWorkflowSpec(workflowDir);

      if (overdueCronWorkflows.has(run.workflow_id)) {
        await removeAgentCrons(run.workflow_id); await setupAgentCrons(workflow); await logCronRecreate("overdue", run.workflow_id); restored++;
        emitEvent({ ts: now(), event: "run.resumed" as EventType, runId: "", workflowId: run.workflow_id, detail: `Medic: overdue crons for "${run.workflow_id}" — force-recreated` });
      } else {
        const expected = expectedCronCount(workflow);
        const actual = await actualCronCount(run.workflow_id);
        if (actual === -1) { logger.warn(`[medic] gateway unreachable (${run.workflow_id})`, {}); }
        else if (actual === 0) {
          // Prefer syncActiveCrons (demand-based) over setupAgentCrons (all agents)
          const activeRun = await pgGet<{ id: string }>("SELECT id FROM runs WHERE workflow_id = $1 AND status = 'running' ORDER BY created_at DESC LIMIT 1", [run.workflow_id]);
          if (activeRun) {
            await syncActiveCrons(activeRun.id, run.workflow_id);
          } else {
            await setupAgentCrons(workflow);
          }
          await logCronRecreate("total_loss", run.workflow_id); restored++;
          emitEvent({ ts: now(), event: "run.resumed" as EventType, runId: activeRun?.id || "", workflowId: run.workflow_id, detail: `Medic: 0/${expected} crons — recreated (demand-based)` });
        }
        else if (actual !== expected) {
          // DEMAND-BASED: syncActiveCrons manages cron count — mismatch is normal.
          // But if actual < 2 and pending steps exist, partial cron loss needs repair.
          const pendingSteps = await pgGet<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM steps s JOIN runs r ON r.id = s.run_id
             WHERE r.workflow_id = $1 AND r.status = 'running' AND s.status = 'pending'`,
            [run.workflow_id]
          );
          if (actual < 2 && (pendingSteps?.cnt ?? 0) > 0) {
            const activeRunForRepair = await pgGet<{ id: string }>(
              "SELECT id FROM runs WHERE workflow_id = $1 AND status = 'running' ORDER BY created_at DESC LIMIT 1",
              [run.workflow_id]
            );
            if (activeRunForRepair) {
              await syncActiveCrons(activeRunForRepair.id, run.workflow_id);
              logger.info(`[medic] Partial cron loss: actual=${actual}, ${pendingSteps?.cnt} pending steps — repaired`, {});
              restored++;
            }
          } else {
            logger.info(`[medic] Cron count: actual=${actual} expected=${expected} for ${run.workflow_id} — demand-based, ok`, {});
          }
        }
      }
    } catch (err) { logger.warn(`[medic] restoreActiveRunCrons failed for ${run.workflow_id}: ${String(err)}`, {}); }
  }
  return restored;
}

export async function runMedicCheck(): Promise<MedicCheckResult> {
  await ensureMedicTables();
  try { await restoreActiveRunCrons(); } catch (e) { logger.warn(`[medic] restoreActiveRunCrons failed: ${String(e)}`, {}); }

  const findings: MedicFinding[] = await runSyncChecks();
  try { findings.push(...await checkStuckWaitingSteps()); } catch (e) { logger.warn(`[medic] checkStuckWaitingSteps failed: ${String(e)}`, {}); }
  try { const cronResult = await listCronJobs(); if (cronResult.ok && cronResult.jobs) { findings.push(...await checkOrphanedCrons(cronResult.jobs.filter(j => j.name.startsWith("setfarm/")))); } } catch (err) { console.warn("listCronJobs failed:", String(err)); }

  let actionsTaken = 0;
  for (const finding of findings) { if (finding.action !== "none") { try { const success = await remediate(finding); if (success) { finding.remediated = true; actionsTaken++; } } catch (err) { logger.error(`[medic] remediate failed for ${finding.action} (${finding.check}): ${String(err)}`, { runId: finding.runId }); } } }

  const parts: string[] = [];
  if (findings.length === 0) { parts.push("All clear — no issues found"); } else { const critical = findings.filter(f => f.severity === "critical").length; const warnings = findings.filter(f => f.severity === "warning").length; if (critical > 0) parts.push(`${critical} critical`); if (warnings > 0) parts.push(`${warnings} warning(s)`); if (actionsTaken > 0) parts.push(`${actionsTaken} auto-fixed`); }
  const summary = parts.join(", ");

  const checkId = crypto.randomUUID();
  const checkedAt = now();
  await pgRun("INSERT INTO medic_checks (id, checked_at, issues_found, actions_taken, summary, details) VALUES ($1, $2, $3, $4, $5, $6)", [checkId, checkedAt, findings.length, actionsTaken, summary, JSON.stringify(findings)]);
  await pgExec("DELETE FROM medic_checks WHERE id NOT IN (SELECT id FROM medic_checks ORDER BY checked_at DESC LIMIT 500)");

  return { id: checkId, checkedAt, issuesFound: findings.length, actionsTaken, summary, findings };
}

// ── Query Helpers ───────────────────────────────────────────────────

export interface MedicStatus { installed: boolean; lastCheck: { checkedAt: string; summary: string; issuesFound: number; actionsTaken: number } | null; recentChecks: number; recentIssues: number; recentActions: number; }

export async function getMedicStatus(): Promise<MedicStatus> {
  try {
    await ensureMedicTables();
    const last = await pgGet<{ checked_at: string; summary: string; issues_found: number; actions_taken: number }>("SELECT checked_at, summary, issues_found, actions_taken FROM medic_checks ORDER BY checked_at DESC LIMIT 1");
    const stats = await pgGet<{ checks: number; issues: number; actions: number }>("SELECT COUNT(*) as checks, COALESCE(SUM(issues_found), 0) as issues, COALESCE(SUM(actions_taken), 0) as actions FROM medic_checks WHERE checked_at > (NOW() - INTERVAL '24 hours')::text");
    return { installed: true, lastCheck: last ? { checkedAt: last.checked_at, summary: last.summary, issuesFound: last.issues_found, actionsTaken: last.actions_taken } : null, recentChecks: stats?.checks ?? 0, recentIssues: stats?.issues ?? 0, recentActions: stats?.actions ?? 0 };
  } catch (err) { return { installed: false, lastCheck: null, recentChecks: 0, recentIssues: 0, recentActions: 0 }; }
}

export async function getRecentMedicChecks(limit = 20): Promise<Array<{ id: string; checkedAt: string; issuesFound: number; actionsTaken: number; summary: string; details: MedicFinding[]; }>> {
  try {
    await ensureMedicTables();
    const rows = await pgQuery<{ id: string; checked_at: string; issues_found: number; actions_taken: number; summary: string; details: string; }>("SELECT * FROM medic_checks ORDER BY checked_at DESC LIMIT $1", [limit]);
    return rows.map(r => ({ id: r.id, checkedAt: r.checked_at, issuesFound: r.issues_found, actionsTaken: r.actions_taken, summary: r.summary, details: JSON.parse(r.details ?? "[]") }));
  } catch (err) { return []; }
}
