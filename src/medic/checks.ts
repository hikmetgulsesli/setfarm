/**
 * Medic health checks — modular functions that inspect DB state and return findings.
 */
import { getDb } from "../db.js";
import { getMaxRoleTimeoutSeconds } from "../installer/install.js";
import { logger } from "../lib/logger.js";
import { existsSync } from "fs";
import { join } from "path";

const DISABLED_DIR = join(process.env.HOME || "/home/setrox", ".openclaw/disabled-services");

export type MedicSeverity = "info" | "warning" | "critical";
export type MedicActionType =
  | "reset_step"
  | "fail_run"
  | "resume_run"
  | "teardown_crons"
  | "reset_story"
  | "recreate_crons"
  | "restart_service"
  | "restart_gateway"
  | "kill_browser_sessions"
  | "none";

export interface MedicFinding {
  check: string;
  severity: MedicSeverity;
  message: string;
  action: MedicActionType;
  /** IDs of affected entities */
  runId?: string;
  stepId?: string;
  storyId?: string;
  workflowId?: string;
  /** Whether the medic auto-remediated this */
  serviceName?: string;
  remediated: boolean;
}

// ── Check: Stuck Steps ──────────────────────────────────────────────

const MAX_ROLE_TIMEOUT_MS = (getMaxRoleTimeoutSeconds() + 5 * 60) * 1000;

/**
 * Find steps that have been "running" longer than the max role timeout.
 * These are likely abandoned by crashed/timed-out agents.
 */
export function checkStuckSteps(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  const stuck = db.prepare(`
    SELECT s.id, s.step_id, s.run_id, s.agent_id, s.updated_at, s.abandoned_count,
           r.workflow_id, r.task
    FROM steps s
    JOIN runs r ON r.id = s.run_id
    WHERE s.status = 'running'
      AND r.status IN ('running', 'resuming')
      AND (julianday('now') - julianday(s.updated_at)) * 86400000 > ?
  `).all(MAX_ROLE_TIMEOUT_MS) as Array<{
    id: string; step_id: string; run_id: string; agent_id: string;
    updated_at: string; abandoned_count: number; workflow_id: string; task: string;
  }>;

  for (const step of stuck) {
    const ageMin = Math.round(
      (Date.now() - new Date(step.updated_at).getTime()) / 60000
    );
    findings.push({
      check: "stuck_steps",
      severity: "warning",
      message: `Step "${step.step_id}" in run ${step.run_id.slice(0, 8)} (${step.workflow_id}) has been running for ${ageMin}min — likely abandoned by agent ${step.agent_id}`,
      action: "reset_step",
      runId: step.run_id,
      stepId: step.id,
      remediated: false, // caller decides whether to remediate
    });
  }

  return findings;
}

// ── Check: Stalled Runs ─────────────────────────────────────────────

const STALL_THRESHOLD_MS = MAX_ROLE_TIMEOUT_MS * 2;

/**
 * Find runs where no step has transitioned in 2x the max role timeout.
 * This catches systemic issues (all agents broken, crons failing, etc).
 */
export function checkStalledRuns(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  // Get running runs where the most recent step update is stale
  const stalled = db.prepare(`
    SELECT r.id, r.workflow_id, r.task, r.updated_at,
           MAX(s.updated_at) as last_step_update
    FROM runs r
    JOIN steps s ON s.run_id = r.id
    WHERE r.status IN ('running', 'resuming')
    GROUP BY r.id
    HAVING (julianday('now') - julianday(MAX(s.updated_at))) * 86400000 > ?
  `).all(STALL_THRESHOLD_MS) as Array<{
    id: string; workflow_id: string; task: string;
    updated_at: string; last_step_update: string;
  }>;

  const STALL_AUTOFAIL_MS = 6 * 60 * 60 * 1000; // 6 hours — auto-fail if no progress

  for (const run of stalled) {
    const ageMs = Date.now() - new Date(run.last_step_update).getTime();
    const ageMin = Math.round(ageMs / 60000);

    if (ageMs > STALL_AUTOFAIL_MS) {
      // Auto-fail runs stalled for 6+ hours
      db.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ? AND status IN ('running', 'resuming')")
        .run(new Date().toISOString(), run.id);
      // Fail any non-terminal steps
      db.prepare("UPDATE steps SET status = 'failed', output = 'Auto-failed: run stalled for ' || ? || ' minutes', updated_at = ? WHERE run_id = ? AND status NOT IN ('done', 'failed')")
        .run(String(ageMin), new Date().toISOString(), run.id);
      findings.push({
        check: "stalled_runs",
        severity: "critical",
        message: `Run ${run.id.slice(0, 8)} (${run.workflow_id}: "${run.task.slice(0, 60)}") stalled for ${ageMin}min — AUTO-FAILED`,
        action: "fail_run",
        runId: run.id,
        remediated: true,
      });
    } else {
      findings.push({
        check: "stalled_runs",
        severity: "critical",
        message: `Run ${run.id.slice(0, 8)} (${run.workflow_id}: "${run.task.slice(0, 60)}") has had no step progress for ${ageMin}min`,
        action: "none",
        runId: run.id,
        remediated: false,
      });
    }
  }

  // v1.5.53: Resuming state should not last more than 2 minutes
  const stuckResuming = db.prepare(`
    SELECT id, workflow_id, task FROM runs
    WHERE status = 'resuming'
    AND (julianday('now') - julianday(updated_at)) * 86400000 > 120000
  `).all() as Array<{ id: string; workflow_id: string; task: string }>;
  for (const run of stuckResuming) {
    db.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), run.id);
    db.prepare("UPDATE steps SET status = 'failed', output = 'Auto-failed: run stuck in resuming state', updated_at = ? WHERE run_id = ? AND status NOT IN ('done', 'failed')")
      .run(new Date().toISOString(), run.id);
    findings.push({
      check: "stalled_runs",
      severity: "critical",
      message: `Run ${run.id.slice(0, 8)} (${run.workflow_id}) stuck in resuming state >2min — AUTO-FAILED`,
      action: "fail_run",
      runId: run.id,
      remediated: true,
    });
  }

  return findings;
}

// ── Check: Dead Runs ────────────────────────────────────────────────

/**
 * Find runs marked as "running" but all steps are terminal (done/failed)
 * with no waiting/pending/running steps left. These are zombie runs.
 */
export function checkDeadRuns(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  const zombies = db.prepare(`
    SELECT r.id, r.workflow_id, r.task
    FROM runs r
    WHERE r.status = 'running'
      AND NOT EXISTS (
        SELECT 1 FROM steps s
        WHERE s.run_id = r.id
        AND s.status IN ('waiting', 'pending', 'running')
      )
  `).all() as Array<{ id: string; workflow_id: string; task: string }>;

  for (const run of zombies) {
    // Check if all steps are done (should be completed) or some are failed
    const failed = db.prepare(
      "SELECT COUNT(*) as cnt FROM steps WHERE run_id = ? AND status = 'failed'"
    ).get(run.id) as { cnt: number };

    const action: MedicActionType = "fail_run";
    const detail = failed.cnt > 0
      ? `${failed.cnt} failed step(s), no active steps remaining`
      : `All steps terminal but run still marked as running`;

    findings.push({
      check: "dead_runs",
      severity: "critical",
      message: `Run ${run.id.slice(0, 8)} (${run.workflow_id}) is a zombie — ${detail}`,
      action,
      runId: run.id,
      remediated: false,
    });
  }

  return findings;
}

// ── Check: Orphaned Crons ───────────────────────────────────────────

/**
 * Check if agent crons exist for workflows with zero active runs.
 * Returns workflow IDs that should have their crons torn down.
 *
 * NOTE: This check requires the list of current cron jobs to be passed in,
 * since reading crons is async (gateway API). The medic runner handles this.
 */
export function checkOrphanedCrons(
  cronJobs: Array<{ id: string; name: string }>,
): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  // Extract unique workflow IDs from setfarm cron job names
  const workflowIds = new Set<string>();
  for (const job of cronJobs) {
    const match = job.name.match(/^setfarm\/([^/]+)\//);
    if (match) workflowIds.add(match[1]);
  }

  for (const wfId of workflowIds) {
    const active = db.prepare(
      "SELECT COUNT(*) as cnt FROM runs WHERE workflow_id = ? AND status = 'running'"
    ).get(wfId) as { cnt: number };

    if (active.cnt === 0) {
      // Guard: don't tear down if pending/running/claimed stories exist (fixes teardown/recreate race)
      const pendingWork = db.prepare(`
        SELECT COUNT(*) as cnt FROM stories st
        JOIN runs r ON r.id = st.run_id
        WHERE r.workflow_id = ? AND st.status IN ('pending','running','claimed')
      `).get(wfId) as { cnt: number };
      if (pendingWork.cnt > 0) continue;
      const jobCount = cronJobs.filter(j => j.name.startsWith(`setfarm/${wfId}/`)).length;
      findings.push({
        check: "orphaned_crons",
        severity: "warning",
        message: `${jobCount} cron job(s) for workflow "${wfId}" still running but no active runs exist`,
        action: "teardown_crons",
        remediated: false,
      });
    }
  }

  return findings;
}

// ── Run All Checks ──────────────────────────────────────────────────

/**
 * Run all synchronous checks (everything except orphaned crons which needs async cron list).
 */
// ── Check: Claimed But Not Progressing ────────────────────────────────

const CLAIMED_STUCK_THRESHOLD_MS = 25 * 60 * 1000; // 25 min — design (Stitch API) and implement can take 20+ min

/**
 * Find steps that were claimed (status='running') but haven't been updated
 * within a short threshold. This catches Phase 2 sub-agents that never started
 * or crashed immediately after spawn — much faster than the full role timeout.
 */
export function checkClaimedButStuck(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  const stuck = db.prepare(`
    SELECT s.id, s.step_id, s.run_id, s.agent_id, s.updated_at, s.abandoned_count,
           r.workflow_id
    FROM steps s
    JOIN runs r ON r.id = s.run_id
    WHERE s.status = 'running'
      AND r.status IN ('running', 'resuming')
      AND (julianday('now') - julianday(s.updated_at)) * 86400000 > ?
      AND (julianday('now') - julianday(s.updated_at)) * 86400000 < ?
  `).all(CLAIMED_STUCK_THRESHOLD_MS, MAX_ROLE_TIMEOUT_MS) as Array<{
    id: string; step_id: string; run_id: string; agent_id: string;
    updated_at: string; abandoned_count: number; workflow_id: string;
  }>;

  for (const step of stuck) {
    const ageMin = Math.round(
      (Date.now() - new Date(step.updated_at).getTime()) / 60000
    );
    findings.push({
      check: "claimed_but_stuck",
      severity: "warning",
      message: `Step "${step.step_id}" in run ${step.run_id.slice(0, 8)} claimed ${ageMin}min ago but no progress — Phase 2 agent likely dead`,
      action: "reset_step",
      runId: step.run_id,
      stepId: step.id,
      remediated: false,
    });
  }

  return findings;
}

// ── Check: Failed Runs (Auto-Resume Candidate) ─────────────────────

const RESUME_MAX_ATTEMPTS = 3;
const RESUME_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown — reduced from 10min between resumes

/**
 * Find runs that failed due to step retries exhausted but still have
 * pending stories. These are candidates for auto-resume.
 * Respects a max resume count (stored in run meta) and cooldown period.
 */
export function checkFailedRunsForResume(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  const failedRuns = db.prepare(`
    SELECT r.id, r.workflow_id, r.task, r.updated_at, r.meta
    FROM runs r
    WHERE r.status = 'failed'
      AND EXISTS (
        SELECT 1 FROM stories st
        WHERE st.run_id = r.id
        AND st.status IN ('pending', 'running')
      )
  `).all() as Array<{
    id: string; workflow_id: string; task: string;
    updated_at: string; meta: string | null;
  }>;

  for (const run of failedRuns) {
    const meta = run.meta ? JSON.parse(run.meta) : {};
    const resumeCount: number = meta.medic_resume_count ?? 0;
    const lastResume = meta.medic_last_resume ? new Date(meta.medic_last_resume).getTime() : 0;
    const cooldownOk = (Date.now() - lastResume) > RESUME_COOLDOWN_MS;
    const updatedAge = Date.now() - new Date(run.updated_at).getTime();

    if (resumeCount >= RESUME_MAX_ATTEMPTS) continue;
    if (!cooldownOk) continue;
    if (updatedAge < 2 * 60 * 1000) continue; // wait 2 min for dust to settle

    const pendingStories = db.prepare(
      "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ? AND status IN ('pending', 'running')"
    ).get(run.id) as { cnt: number };

    findings.push({
      check: "failed_run_resumable",
      severity: "warning",
      message: `Run ${run.id.slice(0, 8)} (${run.workflow_id}) failed with ${pendingStories.cnt} stories remaining — auto-resume ${resumeCount + 1}/${RESUME_MAX_ATTEMPTS}`,
      action: "resume_run",
      runId: run.id,
      remediated: false,
    });
  }

  return findings;
}

// ── Check: Orphaned Stories (#225) ──────────────────────────────────

const STORY_STUCK_THRESHOLD_MS = 20 * 60 * 1000; // 20 min — match agent timeout (30min), allow legitimate implement work

/**
 * Find stories stuck in 'running' state for too long.
 *
 * In loop steps with parallel execution, the STEP stays "running" for hours
 * while processing multiple stories. Individual stories can get orphaned when
 * the agent session dies without calling step complete/fail.
 *
 * cleanupAbandonedSteps() only checks step.current_story_id (one story),
 * and only runs when crons are alive. This check catches ALL orphaned stories
 * independently via medic's own cron.
 *
 * Note: story.updated_at is set on claim (status='running') and only updated
 * again on status change. 20min threshold allows legitimate work (agent timeout
 * is 30min) while catching dead sessions reasonably fast.
 */
export function checkOrphanedStories(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  const stuck = db.prepare(`
    SELECT st.id, st.story_id, st.title, st.updated_at, st.abandoned_count,
           st.run_id, r.workflow_id
    FROM stories st
    JOIN runs r ON r.id = st.run_id
    WHERE st.status = 'running'
      AND r.status IN ('running', 'resuming')
      AND (julianday('now') - julianday(st.updated_at)) * 86400000 > ?
  `).all(STORY_STUCK_THRESHOLD_MS) as Array<{
    id: string; story_id: string; title: string; updated_at: string;
    abandoned_count: number; run_id: string; workflow_id: string;
  }>;

  for (const story of stuck) {
    const ageMin = Math.round(
      (Date.now() - new Date(story.updated_at).getTime()) / 60000
    );
    findings.push({
      check: "orphaned_stories",
      severity: "warning",
      message: `Story "${story.story_id}" (${(story.title ?? "").slice(0, 40)}) in run ${story.run_id.slice(0, 8)} (${story.workflow_id}) has been running for ${ageMin}min — session likely dead`,
      action: "reset_story",
      runId: story.run_id,
      storyId: story.id,
      remediated: false,
    });
  }

  return findings;
}

// ── Check: Stalled Workflow Crons / Circuit Breaker (#218) ──────────

const CIRCUIT_BREAKER_THRESHOLD_MS = 3 * 60 * 1000; // 3 min — reduced from 5min — but running story guard prevents false positives

/**
 * Detect when agent crons are dead or in error state.
 *
 * Signal: pending stories exist (work available) but no story has been
 * claimed recently. With 4-min interval and 3 parallel crons, a claim
 * should happen every 1-2 min. If no claim in 3 min, crons are likely dead.
 *
 * Includes 10-min cooldown (checked via medic_checks history) to prevent
 * rapid re-creation loops.
 */
export function checkStalledWorkflowCrons(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  // Get all workflows with running runs
  const workflows = db.prepare(
    "SELECT DISTINCT workflow_id FROM runs WHERE status IN ('running', 'resuming')"
  ).all() as Array<{ workflow_id: string }>;

  for (const { workflow_id } of workflows) {
    // Check if there are pending stories waiting to be claimed
    const pendingStories = db.prepare(`
      SELECT COUNT(*) as cnt FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = ? AND r.status IN ('running', 'resuming') AND st.status = 'pending'
    `).get(workflow_id) as { cnt: number };

    // Also check pending single steps (e.g. design step has no stories)
    const pendingSteps = db.prepare(`
      SELECT COUNT(*) as cnt FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE r.workflow_id = ? AND r.status IN ('running', 'resuming') AND s.status = 'pending' AND s.type = 'single'
    `).get(workflow_id) as { cnt: number };

    const pendingTotal = pendingStories.cnt + pendingSteps.cnt;
    if (pendingTotal === 0) continue; // no pending work — crons are fine or not needed

    // Guard: if any stories are currently running, agents are actively working.
    // Don't recreate crons just because no NEW claim happened — the agent is busy.
    // v1.5.47: Only count "running" items that were recently updated.
    // A step stuck in "running" with error output (e.g. MISSING_INPUT_GUARD) is effectively dead.
    const runningStories = db.prepare(`
      SELECT COUNT(*) as cnt FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = ? AND r.status IN ('running', 'resuming') AND st.status = 'running'
        AND (julianday('now') - julianday(st.updated_at)) * 86400000 < ?
    `).get(workflow_id, CLAIMED_STUCK_THRESHOLD_MS) as { cnt: number };

    // Also check if any steps are running (single steps, not just loop stories)
    const runningSteps = db.prepare(`
      SELECT COUNT(*) as cnt FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE r.workflow_id = ? AND r.status IN ('running', 'resuming') AND s.status = 'running'
        AND (julianday('now') - julianday(s.updated_at)) * 86400000 < ?
    `).get(workflow_id, CLAIMED_STUCK_THRESHOLD_MS) as { cnt: number };

    if (runningStories.cnt > 0 || runningSteps.cnt > 0) continue; // agents are busy — crons are fine

    // No running stories/steps — check when the last activity happened
    const lastStoryActivity = db.prepare(`
      SELECT MAX(st.updated_at) as ts FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = ? AND r.status IN ('running', 'resuming') AND st.status IN ('running', 'done')
    `).get(workflow_id) as { ts: string | null };
    const lastStepActivity = db.prepare(`
      SELECT MAX(s.updated_at) as ts FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE r.workflow_id = ? AND r.status IN ('running', 'resuming') AND s.status IN ('running', 'done')
    `).get(workflow_id) as { ts: string | null };
    const lastActivityTs = [lastStoryActivity?.ts, lastStepActivity?.ts].filter(Boolean).sort().pop() ?? null;
    const lastActivity = { ts: lastActivityTs };

    const age = lastActivity?.ts
      ? Date.now() - new Date(lastActivity.ts).getTime()
      : CIRCUIT_BREAKER_THRESHOLD_MS + 1; // no activity at all = stalled

    if (age <= CIRCUIT_BREAKER_THRESHOLD_MS) continue;

    // Cooldown: don't re-fire if crons were already recreated recently
    // (by this check OR by restoreActiveRunCrons count-based verification)
    const recentRecreate = db.prepare(`
      SELECT MAX(checked_at) as ts FROM medic_checks
      WHERE (details LIKE '%stalled_workflow_crons%' OR details LIKE '%partial cron loss%' OR details LIKE '%crons for%')
        AND details LIKE '%recreate_crons%'
        AND details LIKE ?
        AND julianday(checked_at) > julianday('now', '-10 minutes')
    `).get(`%${workflow_id}%`) as { ts: string | null };

    if (recentRecreate?.ts) continue;

    const ageMin = lastActivity?.ts ? Math.round(age / 60000) : -1;
    findings.push({
      check: "stalled_workflow_crons",
      severity: "warning",
      message: `Workflow "${workflow_id}" has ${pendingTotal} pending item(s) but ${ageMin > 0 ? `no claim in ${ageMin}min` : "no active claims"} — crons may be dead, force-recreating`,
      action: "recreate_crons",
      workflowId: workflow_id,
      remediated: false,
    });
  }

  return findings;
}


// ── Check: Offline Services ────────────────────────────────────────

import { execFileSync } from "node:child_process";

const SERVICE_RESTART_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown — reduced from 10min between restarts

/**
 * For running pipelines, check if the project systemd service is running.
 * Agents sometimes stop services during implementation and forget to restart.
 * Includes 5-min cooldown per service to prevent crash-loop restart storms.
 */
export function checkOfflineServices(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  const running = db.prepare(
    "SELECT id, context FROM runs WHERE status = 'running'"
  ).all() as Array<{ id: string; context: string }>;

  for (const run of running) {
    try {
      // Only check services for runs where deploy step has completed
      const deployDone = db.prepare(
        "SELECT 1 FROM steps WHERE run_id = ? AND step_id = 'deploy' AND status = 'done' LIMIT 1"
      ).get(run.id);
      if (!deployDone) continue;

      const ctx = JSON.parse(run.context);
      const repo = ctx.repo;
      if (!repo) continue;

      const serviceName = repo.replace(/\/+$/, "").split("/").pop();
      if (!serviceName) continue;

      // Skip manually disabled services (marker file from MC toggle)
      if (existsSync(join(DISABLED_DIR, serviceName))) continue;

      try {
        execFileSync("systemctl", ["--user", "is-active", serviceName], {
          encoding: "utf-8",
          timeout: 5000,
        });
      } catch (err: any) {
        const stdout = (err.stdout ?? "").trim();
        if (stdout === "inactive" || stdout === "dead" || stdout === "failed") {
          try {
            execFileSync("systemctl", ["--user", "cat", serviceName], {
              encoding: "utf-8",
              timeout: 5000,
            });

            // Cooldown: skip if we already restarted this service recently
            const recentRestart = db.prepare(`
              SELECT MAX(checked_at) as ts FROM medic_checks
              WHERE details LIKE '%offline_service%'
                AND details LIKE '%recreate_crons%'
                AND details LIKE ?
                AND julianday(checked_at) > julianday('now', '-10 minutes')
            `).get(`%${serviceName}%`) as { ts: string | null };

            if (recentRestart?.ts) continue;

            findings.push({
              check: "offline_service",
              severity: "warning",
              message: "Service " + serviceName + " is " + stdout + " while pipeline run " + run.id.slice(0, 8) + " is active",
              action: "restart_service",
              runId: run.id,
              serviceName,
              remediated: false,
            });
          } catch (err) { logger.warn("[medic] service restart check failed", {});
            // Service file does not exist — skip
          }
        }
      }
    } catch (err) { logger.warn("[medic] offline service check failed", {});
      // skip
    }
  }

  return findings;
}


// ── Check: Orphaned Steps/Stories in Terminal Runs ──────────────────

/**
 * Find steps and stories that are still in active states but belong to
 * cancelled/failed runs. These should be moved to 'failed' to prevent
 * medic from repeatedly processing them.
 */
export function checkOrphanedInTerminalRuns(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  // Fix orphaned steps
  const orphanSteps = db.prepare(`
    SELECT s.id, s.step_id, s.run_id, s.status, r.status as run_status
    FROM steps s JOIN runs r ON s.run_id = r.id
    WHERE r.status IN ('cancelled', 'failed')
    AND s.status NOT IN ('done', 'failed')
  `).all() as { id: string; step_id: string; run_id: string; status: string; run_status: string }[];

  for (const step of orphanSteps) {
    db.prepare("UPDATE steps SET status = 'failed', output = 'Auto-failed: run is ' || ?, updated_at = ? WHERE id = ?")
      .run(step.run_status, new Date().toISOString(), step.id);
    findings.push({
      check: "orphaned_in_terminal_run",
      severity: "warning",
      message: `Step ${step.step_id} was '${step.status}' in ${step.run_status} run ${step.run_id} — auto-failed`,
      action: "none",
      runId: step.run_id,
      stepId: step.id,
      remediated: true,
    });
  }

  // Fix orphaned stories
  const orphanStories = db.prepare(`
    SELECT s.id, s.story_id, s.run_id, s.status, r.status as run_status
    FROM stories s JOIN runs r ON s.run_id = r.id
    WHERE r.status IN ('cancelled', 'failed')
    AND s.status NOT IN ('done', 'verified', 'failed', 'skipped')
  `).all() as { id: string; story_id: string; run_id: string; status: string; run_status: string }[];

  for (const story of orphanStories) {
    db.prepare("UPDATE stories SET status = 'failed', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), story.id);
    findings.push({
      check: "orphaned_in_terminal_run",
      severity: "warning",
      message: `Story ${story.story_id} was '${story.status}' in ${story.run_status} run ${story.run_id} — auto-failed`,
      action: "none",
      runId: story.run_id,
      storyId: story.id,
      remediated: true,
    });
  }

  return findings;
}

// ── Check: Gateway Stalling ─────────────────────────────────────────

const GATEWAY_RESTART_COOLDOWN_MS = 8 * 60 * 1000; // 8 min cooldown between gateway restarts
const GATEWAY_STALL_WINDOW_MS = 5 * 60 * 1000; // 5 min window — reduced from 10min to check recreate count
const GATEWAY_STALL_RECREATE_THRESHOLD = 2; // 2+ recreates in window = stalling

/**
 * Detect gateway scheduler stalling: if crons have been recreated 2+ times
 * in the last 5 minutes but no stories have been claimed, the gateway itself
 * is stuck and needs a restart.
 *
 * NOTE: restoreActiveRunCrons logs each recreate to medic_checks via logCronRecreate(),
 * making overdue/partial/total recreations visible to this check. Without this,
 * the stalling detector was blind to restoreActiveRunCrons and never triggered.
 *
 * Includes 8-min cooldown to prevent restart storms.
 */
export function checkGatewayStalling(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  // Check if any active runs exist — no runs = no need to check
  const activeRuns = db.prepare(
    "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running'"
  ).get() as { cnt: number };
  if (activeRuns.cnt === 0) return findings;

  // Count cron recreates in the stall window
  const recreates = db.prepare(`
    SELECT COUNT(*) as cnt FROM medic_checks
    WHERE details LIKE '%recreate_crons%'
      AND details LIKE '%recreate_crons%'
      AND (julianday('now') - julianday(checked_at)) * 86400000 < ?
  `).get(GATEWAY_STALL_WINDOW_MS) as { cnt: number };

  if (recreates.cnt < GATEWAY_STALL_RECREATE_THRESHOLD) return findings;

  // Check if any story OR step was claimed in the same window
  const recentStoryClaims = db.prepare(`
    SELECT COUNT(*) as cnt FROM stories
    WHERE status = 'running'
      AND (julianday('now') - julianday(updated_at)) * 86400000 < ?
  `).get(GATEWAY_STALL_WINDOW_MS) as { cnt: number };
  const recentStepClaims = db.prepare(`
    SELECT COUNT(*) as cnt FROM steps
    WHERE status = 'running'
      AND (julianday('now') - julianday(updated_at)) * 86400000 < ?
  `).get(GATEWAY_STALL_WINDOW_MS) as { cnt: number };

  if (recentStoryClaims.cnt > 0 || recentStepClaims.cnt > 0) return findings; // Claims happening = gateway alive

  // Cooldown: don't restart if we already restarted recently
  const recentRestart = db.prepare(`
    SELECT MAX(checked_at) as ts FROM medic_checks
    WHERE details LIKE '%restart_gateway%'
      AND details LIKE '%recreate_crons%'
      AND (julianday('now') - julianday(checked_at)) * 86400000 < ?
  `).get(GATEWAY_RESTART_COOLDOWN_MS) as { ts: string | null };

  if (recentRestart?.ts) return findings;

  findings.push({
    check: "gateway_stalling",
    severity: "critical",
    message: `Gateway scheduler stalled: ${recreates.cnt} cron recreates in 5min but 0 claims — restarting gateway`,
    action: "restart_gateway",
    remediated: false,
  });

  return findings;
}


// ── Orphaned Browser Processes ──────────────────────────────────────

function checkOrphanedBrowserProcesses(): MedicFinding[] {
  const findings: MedicFinding[] = [];
  const db = getDb();

  try {
    let chromiumCount = 0;
    try {
      const output = execFileSync("pgrep", ["-cf", "chromium.*--remote-debugging"], {
        timeout: 5000,
        stdio: "pipe",
      }).toString().trim();
      chromiumCount = parseInt(output, 10) || 0;
    } catch (err) { /* browser proc check */
      return findings; // pgrep exit 1 = no matches
    }

    if (chromiumCount === 0) return findings;

    // Check if there are active runs — if so, some Chrome processes may be legit
    const activeRuns = db.prepare(
      "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running'"
    ).get() as { cnt: number };

    // Allow up to 2 Chrome processes per active run (main + devtools)
    const maxExpected = activeRuns.cnt * 2;

    if (chromiumCount > maxExpected) {
      findings.push({
        check: "orphaned_browser",
        severity: "warning",
        message: `Found ${chromiumCount} Chromium process(es) but only ${activeRuns.cnt} active run(s) — likely orphaned browser sessions`,
        action: "kill_browser_sessions",
        remediated: false,
      });
    }
  } catch (err) { logger.warn("[medic] browser cleanup failed", {});
    // Non-critical — skip silently
  }

  return findings;
}

// ── Check: Provider Failure (mass 404) ──────────────────────────────

const PROVIDER_FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 min window
const PROVIDER_FAIL_ABANDON_THRESHOLD = 6; // 6+ abandons with 0 completions = provider down
const PROVIDER_FAIL_COOLDOWN_MS = 30 * 60 * 1000; // 30 min cooldown

/**
 * Detect provider-level failures: when the LLM API returns persistent errors
 * (e.g. 404 from corrupted hot-reload state), ALL agents fail simultaneously.
 *
 * Signal: many step resets (abandons) in a short window with zero story completions.
 * This is distinct from individual agent failures (which produce 1-2 abandons).
 *
 * Fix: restart the gateway to re-instantiate provider adapters.
 */
export function checkProviderFailure(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  // Must have active runs
  const activeRuns = db.prepare(
    "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running'"
  ).get() as { cnt: number };
  if (activeRuns.cnt === 0) return findings;

  // Count recent step abandons (medic resets) in the window
  const recentAbandons = db.prepare(`
    SELECT COUNT(*) as cnt FROM medic_checks
    WHERE details LIKE '%reset_step%'
      AND details LIKE '%recreate_crons%'
      AND (julianday('now') - julianday(checked_at)) * 86400000 < ?
  `).get(PROVIDER_FAIL_WINDOW_MS) as { cnt: number };

  if (recentAbandons.cnt < PROVIDER_FAIL_ABANDON_THRESHOLD) return findings;

  // Check if ANY story completed in the same window (if yes, provider works for some agents)
  const recentCompletions = db.prepare(`
    SELECT COUNT(*) as cnt FROM stories
    WHERE status IN ('done', 'verified')
      AND (julianday('now') - julianday(updated_at)) * 86400000 < ?
  `).get(PROVIDER_FAIL_WINDOW_MS) as { cnt: number };

  if (recentCompletions.cnt > 0) return findings; // Some agents succeed = not a provider issue

  // Also check if any step completed
  const recentStepDone = db.prepare(`
    SELECT COUNT(*) as cnt FROM steps
    WHERE status = 'done'
      AND (julianday('now') - julianday(updated_at)) * 86400000 < ?
  `).get(PROVIDER_FAIL_WINDOW_MS) as { cnt: number };

  if (recentStepDone.cnt > 0) return findings;

  // Cooldown: don't restart if we already did recently
  const recentRestart = db.prepare(`
    SELECT MAX(checked_at) as ts FROM medic_checks
    WHERE (details LIKE '%provider_failure%' OR details LIKE '%restart_gateway%')
      AND details LIKE '%recreate_crons%'
      AND (julianday('now') - julianday(checked_at)) * 86400000 < ?
  `).get(PROVIDER_FAIL_COOLDOWN_MS) as { ts: string | null };

  if (recentRestart?.ts) return findings;

  findings.push({
    check: "provider_failure",
    severity: "critical",
    message: `Provider failure detected: ${recentAbandons.cnt} step abandons in 15min with 0 completions — restarting gateway to reset provider state`,
    action: "restart_gateway",
    remediated: false,
  });

  return findings;
}


// B4: Detect stale claims (agent claimed 60+ min ago but still running)
export async function checkStaleClaims(db: any, logger: any): Promise<{ found: number; fixed: number }> {
  const STALE_THRESHOLD_MIN = 60;
  let found = 0, fixed = 0;
  try {
    const stale = db.prepare(
      "SELECT cl.rowid, cl.run_id, cl.step_id, cl.story_id, cl.agent_id, cl.claimed_at " +
      "FROM claim_log cl WHERE cl.outcome IS NULL AND cl.claimed_at IS NOT NULL " +
      "AND (julianday('now') - julianday(cl.claimed_at)) * 1440 > ?"
    ).all(STALE_THRESHOLD_MIN);
    found = stale.length;
    for (const claim of stale) {
      logger.warn(`[MEDIC] Stale claim detected: agent=${claim.agent_id} step=${claim.step_id} story=${claim.story_id || 'N/A'} age=${STALE_THRESHOLD_MIN}+min`, { runId: claim.run_id });
      db.prepare(
        "UPDATE claim_log SET outcome = 'abandoned', abandoned_at = datetime('now'), duration_ms = CAST((julianday('now') - julianday(claimed_at)) * 86400000 AS INTEGER), diagnostic = 'Stale claim detected by medic (60+ min)' WHERE rowid = ?"
      ).run(claim.rowid);
      fixed++;
    }
  } catch (e) { logger.warn("[MEDIC] checkStaleClaims error: " + String(e), {}); }
  return { found, fixed };
}

// A3: Detect cascade failures (prerequisite step failed -> dependent step will also fail)
export async function checkCascadingFailures(db: any, logger: any): Promise<{ detected: number }> {
  let detected = 0;
  try {
    // Find running runs where an early step failed but later steps are still pending/running
    const cascades = db.prepare(
      "SELECT r.id as run_id, fs.step_id as failed_step, fs.step_index as failed_idx, " +
      "ps.step_id as pending_step, ps.step_index as pending_idx, ps.status as pending_status " +
      "FROM runs r " +
      "JOIN steps fs ON fs.run_id = r.id AND fs.status = 'failed' " +
      "JOIN steps ps ON ps.run_id = r.id AND ps.step_index > fs.step_index AND ps.status IN ('pending', 'running') " +
      "WHERE r.status = 'running' " +
      "ORDER BY r.id, fs.step_index"
    ).all();

    const seenRuns = new Set<string>();
    for (const c of cascades) {
      if (seenRuns.has(c.run_id)) continue;
      seenRuns.add(c.run_id);
      logger.warn(`[MEDIC] CASCADE: run=${c.run_id} failed_step=${c.failed_step}(idx ${c.failed_idx}) -> ${c.pending_step}(idx ${c.pending_idx}) is ${c.pending_status} but will likely fail`, { runId: c.run_id });
      detected++;
    }
  } catch (e) { logger.warn("[MEDIC] checkCascadingFailures error: " + String(e), {}); }
  return { detected };
}

export function runSyncChecks(): MedicFinding[] {
  return [
    ...checkOrphanedInTerminalRuns(),
    ...checkOrphanedStories(),
    ...checkClaimedButStuck(),
    ...checkStuckSteps(),
    ...checkStalledRuns(),
    ...checkDeadRuns(),
    ...checkFailedRunsForResume(),
    ...checkStalledWorkflowCrons(),
    ...checkOfflineServices(),
    ...checkGatewayStalling(),
    ...checkProviderFailure(),
    ...checkOrphanedBrowserProcesses(),
  ];
}
