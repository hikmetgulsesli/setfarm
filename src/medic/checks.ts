/**
 * Medic health checks — modular functions that inspect DB state and return findings.
 */
import { pgGet, pgQuery, pgRun, now } from "../db-pg.js";
import { getMaxRoleTimeoutSeconds } from "../installer/install.js";
import { logger } from "../lib/logger.js";
import { existsSync } from "fs";
import { execFileSync } from "node:child_process";
import os from "node:os";

/** systemctl --user wrapper with XDG_RUNTIME_DIR for crontab compat */
function systemctlUser(...args: string[]): string {
  const uid = os.userInfo().uid;
  return execFileSync("systemctl", ["--user", ...args], {
    encoding: "utf-8", timeout: 5000,
    env: { ...process.env, XDG_RUNTIME_DIR: `/run/user/${uid}`, DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${uid}/bus` },
  });
}
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
  | "advance_pipeline"
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
export async function checkStuckSteps(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let stuck: Array<{
    id: string; step_id: string; run_id: string; agent_id: string;
    updated_at: string; abandoned_count: number; workflow_id: string; task: string;
  }>;

  stuck = await pgQuery(`
    SELECT s.id, s.step_id, s.run_id, s.agent_id, s.updated_at, s.abandoned_count,
           r.workflow_id, r.task
    FROM steps s
    JOIN runs r ON r.id = s.run_id
    WHERE s.status = 'running'
      AND r.status IN ('running', 'resuming')
      AND EXTRACT(EPOCH FROM NOW() - s.updated_at::timestamptz) * 1000 > $1
  `, [MAX_ROLE_TIMEOUT_MS]);

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
export async function checkStalledRuns(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let stalled: Array<{
    id: string; workflow_id: string; task: string;
    updated_at: string; last_step_update: string;
  }>;

  stalled = await pgQuery(`
    SELECT r.id, r.workflow_id, r.task, r.updated_at,
           MAX(s.updated_at) as last_step_update
    FROM runs r
    JOIN steps s ON s.run_id = r.id
    WHERE r.status IN ('running', 'resuming')
    GROUP BY r.id, r.workflow_id, r.task, r.updated_at
    HAVING EXTRACT(EPOCH FROM NOW() - MAX(s.updated_at)::timestamptz) * 1000 > $1
  `, [STALL_THRESHOLD_MS]);

  const STALL_AUTOFAIL_MS = 6 * 60 * 60 * 1000; // 6 hours — auto-fail if no progress

  for (const run of stalled) {
    const ageMs = Date.now() - new Date(run.last_step_update).getTime();
    const ageMin = Math.round(ageMs / 60000);

    if (ageMs > STALL_AUTOFAIL_MS) {
      // Auto-fail runs stalled for 6+ hours
      await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2 AND status IN ('running', 'resuming')",
        [now(), run.id]);
      await pgRun("UPDATE steps SET status = 'failed', output = 'Auto-failed: run stalled for ' || $1 || ' minutes', updated_at = $2 WHERE run_id = $3 AND status NOT IN ('done', 'failed')",
        [String(ageMin), now(), run.id]);
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
  let stuckResuming: Array<{ id: string; workflow_id: string; task: string }>;

  stuckResuming = await pgQuery(`
    SELECT id, workflow_id, task FROM runs
    WHERE status = 'resuming'
    AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 > 120000
  `);

  for (const run of stuckResuming) {
    await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2",
      [now(), run.id]);
    await pgRun("UPDATE steps SET status = 'failed', output = 'Auto-failed: run stuck in resuming state', updated_at = $1 WHERE run_id = $2 AND status NOT IN ('done', 'failed')",
      [now(), run.id]);
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
export async function checkDeadRuns(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let zombies: Array<{ id: string; workflow_id: string; task: string }>;

  zombies = await pgQuery(`
    SELECT r.id, r.workflow_id, r.task
    FROM runs r
    WHERE r.status = 'running'
      AND NOT EXISTS (
        SELECT 1 FROM steps s
        WHERE s.run_id = r.id
        AND s.status IN ('waiting', 'pending', 'running')
      )
  `);

  for (const run of zombies) {
    let failedCnt: number;
    const row = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM steps WHERE run_id = $1 AND status = 'failed'", [run.id]
    );
    failedCnt = Number(row?.cnt ?? 0);

    const action: MedicActionType = "fail_run";
    const detail = failedCnt > 0
      ? `${failedCnt} failed step(s), no active steps remaining`
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
export async function checkOrphanedCrons(
  cronJobs: Array<{ id: string; name: string }>,
): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  // Extract unique workflow IDs from setfarm cron job names
  const workflowIds = new Set<string>();
  for (const job of cronJobs) {
    const match = job.name.match(/^setfarm\/([^/]+)\//);
    if (match) workflowIds.add(match[1]);
  }

  for (const wfId of workflowIds) {
    let activeCnt: number;
    let pendingWorkCnt: number;

    const active = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM runs WHERE workflow_id = $1 AND status = 'running'", [wfId]
    );
    activeCnt = Number(active?.cnt ?? 0);

    if (activeCnt === 0) {
      const pendingWork = await pgGet<{ cnt: string }>(`
        SELECT COUNT(*) as cnt FROM stories st
        JOIN runs r ON r.id = st.run_id
        WHERE r.workflow_id = $1 AND st.status IN ('pending','running','claimed')
      `, [wfId]);
      pendingWorkCnt = Number(pendingWork?.cnt ?? 0);
      if (pendingWorkCnt > 0) continue;

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

const CLAIMED_STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 10 min — for fast steps (plan, stories, etc.)
const CLAIMED_STUCK_SLOW_THRESHOLD_MS = 12 * 60 * 1000; // 25 min — for slow steps (design, implement, setup)
const SLOW_STEP_IDS_FOR_MEDIC = new Set(["implement", "setup-repo", "setup-build"]);

/**
 * Find steps that were claimed (status='running') but haven't been updated
 * within a short threshold. This catches Phase 2 sub-agents that never started
 * or crashed immediately after spawn — much faster than the full role timeout.
 * Slow steps (design, implement, setup) get 25min threshold instead of 10min.
 */
export async function checkClaimedButStuck(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let stuck: Array<{
    id: string; step_id: string; run_id: string; agent_id: string;
    updated_at: string; abandoned_count: number; workflow_id: string;
  }>;

  stuck = await pgQuery(`
    SELECT s.id, s.step_id, s.run_id, s.agent_id, s.updated_at, s.abandoned_count,
           r.workflow_id
    FROM steps s
    JOIN runs r ON r.id = s.run_id
    WHERE s.status = 'running'
      AND r.status IN ('running', 'resuming')
      AND EXTRACT(EPOCH FROM NOW() - s.updated_at::timestamptz) * 1000 > $1
      AND EXTRACT(EPOCH FROM NOW() - s.updated_at::timestamptz) * 1000 < $2
  `, [CLAIMED_STUCK_THRESHOLD_MS, MAX_ROLE_TIMEOUT_MS]);

  for (const step of stuck) {
    const elapsedMs = Date.now() - new Date(step.updated_at).getTime();
    // Slow steps get longer threshold — design/implement genuinely need 15-25 min
    if (SLOW_STEP_IDS_FOR_MEDIC.has(step.step_id) && elapsedMs < CLAIMED_STUCK_SLOW_THRESHOLD_MS) {
      continue; // Not stuck yet — still within slow step threshold
    }
    const ageMin = Math.round(elapsedMs / 60000);
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
export async function checkFailedRunsForResume(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let failedRuns: Array<{
    id: string; workflow_id: string; task: string;
    updated_at: string; meta: string | null;
  }>;

  failedRuns = await pgQuery(`
    SELECT r.id, r.workflow_id, r.task, r.updated_at, r.meta
    FROM runs r
    WHERE r.status = 'failed'
      AND EXISTS (
        SELECT 1 FROM stories st
        WHERE st.run_id = r.id
        AND st.status IN ('pending', 'running')
      )
  `);

  for (const run of failedRuns) {
    const meta = run.meta ? JSON.parse(run.meta) : {};
    const resumeCount: number = meta.medic_resume_count ?? 0;
    const lastResume = meta.medic_last_resume ? new Date(meta.medic_last_resume).getTime() : 0;
    const cooldownOk = (Date.now() - lastResume) > RESUME_COOLDOWN_MS;
    const updatedAge = Date.now() - new Date(run.updated_at).getTime();

    if (resumeCount >= RESUME_MAX_ATTEMPTS) continue;
    if (!cooldownOk) continue;
    if (updatedAge < 2 * 60 * 1000) continue; // wait 2 min for dust to settle

    let pendingCnt: number;
    const row = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running')", [run.id]
    );
    pendingCnt = Number(row?.cnt ?? 0);

    findings.push({
      check: "failed_run_resumable",
      severity: "warning",
      message: `Run ${run.id.slice(0, 8)} (${run.workflow_id}) failed with ${pendingCnt} stories remaining — auto-resume ${resumeCount + 1}/${RESUME_MAX_ATTEMPTS}`,
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
 */
export async function checkOrphanedStories(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let stuck: Array<{
    id: string; story_id: string; title: string; updated_at: string;
    abandoned_count: number; run_id: string; workflow_id: string;
  }>;

  stuck = await pgQuery(`
    SELECT st.id, st.story_id, st.title, st.updated_at, st.abandoned_count,
           st.run_id, r.workflow_id
    FROM stories st
    JOIN runs r ON r.id = st.run_id
    WHERE st.status = 'running'
      AND r.status IN ('running', 'resuming')
      AND EXTRACT(EPOCH FROM NOW() - st.updated_at::timestamptz) * 1000 > $1
  `, [STORY_STUCK_THRESHOLD_MS]);

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
 */
export async function checkStalledWorkflowCrons(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let workflows: Array<{ workflow_id: string }>;

  workflows = await pgQuery(
    "SELECT DISTINCT workflow_id FROM runs WHERE status IN ('running', 'resuming')"
  );

  for (const { workflow_id } of workflows) {
    let pendingStoriesCnt: number;
    let pendingStepsCnt: number;

    const ps = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = $1 AND r.status IN ('running', 'resuming') AND st.status = 'pending'
    `, [workflow_id]);
    pendingStoriesCnt = Number(ps?.cnt ?? 0);

    const pst = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE r.workflow_id = $1 AND r.status IN ('running', 'resuming') AND s.status = 'pending' AND s.type = 'single'
    `, [workflow_id]);
    pendingStepsCnt = Number(pst?.cnt ?? 0);

    const pendingTotal = pendingStoriesCnt + pendingStepsCnt;
    if (pendingTotal === 0) continue; // no pending work — crons are fine or not needed

    // Guard: if any stories are currently running, agents are actively working.
    let runningStoriesCnt: number;
    let runningStepsCnt: number;

    const rs = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = $1 AND r.status IN ('running', 'resuming') AND st.status = 'running'
        AND EXTRACT(EPOCH FROM NOW() - st.updated_at::timestamptz) * 1000 < $2
    `, [workflow_id, CLAIMED_STUCK_THRESHOLD_MS]);
    runningStoriesCnt = Number(rs?.cnt ?? 0);

    const rst = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE r.workflow_id = $1 AND r.status IN ('running', 'resuming') AND s.status = 'running'
        AND EXTRACT(EPOCH FROM NOW() - s.updated_at::timestamptz) * 1000 < $2
    `, [workflow_id, CLAIMED_STUCK_THRESHOLD_MS]);
    runningStepsCnt = Number(rst?.cnt ?? 0);

    if (runningStoriesCnt > 0 || runningStepsCnt > 0) continue; // agents are busy — crons are fine

    // No running stories/steps — check when the last activity happened
    let lastActivityTs: string | null;

    const lastStoryActivity = await pgGet<{ ts: string | null }>(`
      SELECT MAX(st.updated_at) as ts FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = $1 AND r.status IN ('running', 'resuming') AND st.status IN ('running', 'done')
    `, [workflow_id]);
    const lastStepActivity = await pgGet<{ ts: string | null }>(`
      SELECT MAX(s.updated_at) as ts FROM steps s
      JOIN runs r ON r.id = s.run_id
      WHERE r.workflow_id = $1 AND r.status IN ('running', 'resuming') AND s.status IN ('running', 'done')
    `, [workflow_id]);
    lastActivityTs = [lastStoryActivity?.ts, lastStepActivity?.ts].filter(Boolean).sort().pop() ?? null;

    const age = lastActivityTs
      ? Date.now() - new Date(lastActivityTs).getTime()
      : CIRCUIT_BREAKER_THRESHOLD_MS + 1; // no activity at all = stalled

    // Under-capacity check: running < parallelCount with pending work
    if (age <= CIRCUIT_BREAKER_THRESHOLD_MS) {
      // Activity is recent, but check if we are under-capacity
      const loopStep = await pgGet<{ loop_config: string | null }>(
        "SELECT loop_config FROM steps WHERE run_id IN (SELECT id FROM runs WHERE workflow_id = $1 AND status = 'running') AND type = 'loop' AND status = 'running' LIMIT 1",
        [workflow_id]
      );
      const parallelCount = loopStep?.loop_config ? (JSON.parse(loopStep.loop_config).parallelCount || 3) : 3;
      const runningStories = await pgGet<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id IN (SELECT id FROM runs WHERE workflow_id = $1 AND status = 'running') AND status = 'running'" ,
        [workflow_id]
      );
      const pendingStories = await pgGet<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id IN (SELECT id FROM runs WHERE workflow_id = $1 AND status = 'running') AND status = 'pending'" ,
        [workflow_id]
      );
      const runningCnt = parseInt(runningStories?.cnt || "0", 10);
      const pendingCnt = parseInt(pendingStories?.cnt || "0", 10);

      if (pendingCnt > 0 && runningCnt < parallelCount) {
        // Check cooldown (2min since last recreate)
        const recentFix = await pgGet<{ ts: string | null }>(
          "SELECT MAX(checked_at) as ts FROM medic_checks WHERE details LIKE '%under_capacity%' AND checked_at > NOW() - INTERVAL '2 minutes'"
        );
        if (!recentFix?.ts) {
          findings.push({
            check: "under_capacity",
            severity: "warning" as MedicSeverity,
            message: `Under-capacity: ${runningCnt}/${parallelCount} running, ${pendingCnt} pending in "${workflow_id}" — force recreating crons`,
            action: "recreate_crons" as MedicActionType,
            workflowId: workflow_id,
            remediated: false,
          });
        }
      }
      continue;
    }

    // Cooldown: don't re-fire if crons were already recreated recently
    let recentRecreateTs: string | null;

    const recentRecreate = await pgGet<{ ts: string | null }>(`
      SELECT MAX(checked_at) as ts FROM medic_checks
      WHERE (details LIKE '%stalled_workflow_crons%' OR details LIKE '%partial cron loss%' OR details LIKE '%crons for%')
        AND details LIKE '%recreate_crons%'
        AND details LIKE $1
        AND checked_at > NOW() - INTERVAL '10 minutes'
    `, [`%${workflow_id}%`]);
    recentRecreateTs = recentRecreate?.ts ?? null;

    if (recentRecreateTs) continue;

    const ageMin = lastActivityTs ? Math.round(age / 60000) : -1;
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


const SERVICE_RESTART_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown — reduced from 10min between restarts

/**
 * For running pipelines, check if the project systemd service is running.
 * Agents sometimes stop services during implementation and forget to restart.
 * Includes 5-min cooldown per service to prevent crash-loop restart storms.
 */
export async function checkOfflineServices(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let running: Array<{ id: string; context: string }>;

  running = await pgQuery(
    "SELECT id, context FROM runs WHERE status = 'running'"
  );

  for (const run of running) {
    try {
      // Only check services for runs where deploy step has completed
      let deployDone: any;
      deployDone = await pgGet(
        "SELECT 1 FROM steps WHERE run_id = $1 AND step_id = 'deploy' AND status = 'done' LIMIT 1", [run.id]
      );
      if (!deployDone) continue;

      const ctx = JSON.parse(run.context);
      const repo = ctx.repo;
      if (!repo) continue;

      const serviceName = repo.replace(/\/+$/, "").split("/").pop();
      if (!serviceName) continue;

      // Skip manually disabled services (marker file from MC toggle)
      if (existsSync(join(DISABLED_DIR, serviceName))) continue;

      try {
        systemctlUser("is-active", serviceName);
      } catch (err: any) {
        const stdout = (err.stdout ?? "").trim();
        if (stdout === "inactive" || stdout === "dead" || stdout === "failed") {
          try {
            systemctlUser("cat", serviceName);

            // Cooldown: skip if we already restarted this service recently
            let recentRestartTs: string | null;
            const recentRestart = await pgGet<{ ts: string | null }>(`
              SELECT MAX(checked_at) as ts FROM medic_checks
              WHERE details LIKE '%offline_service%'
                AND details LIKE '%restart_service%'
                AND details LIKE $1
                AND checked_at > NOW() - INTERVAL '10 minutes'
            `, [`%${serviceName}%`]);
            recentRestartTs = recentRestart?.ts ?? null;

            if (recentRestartTs) continue;

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
export async function checkOrphanedInTerminalRuns(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let orphanSteps: { id: string; step_id: string; run_id: string; status: string; run_status: string }[];
  let orphanStories: { id: string; story_id: string; run_id: string; status: string; run_status: string }[];

  orphanSteps = await pgQuery(`
    SELECT s.id, s.step_id, s.run_id, s.status, r.status as run_status
    FROM steps s JOIN runs r ON s.run_id = r.id
    WHERE r.status IN ('cancelled', 'failed')
    AND s.status NOT IN ('done', 'failed')
  `);

  for (const step of orphanSteps) {
    await pgRun("UPDATE steps SET status = 'failed', output = 'Auto-failed: run is ' || $1, updated_at = $2 WHERE id = $3",
      [step.run_status, now(), step.id]);
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
  orphanStories = await pgQuery(`
    SELECT s.id, s.story_id, s.run_id, s.status, r.status as run_status
    FROM stories s JOIN runs r ON s.run_id = r.id
    WHERE r.status IN ('cancelled', 'failed')
    AND s.status NOT IN ('done', 'verified', 'failed', 'skipped')
  `);

  for (const story of orphanStories) {
    await pgRun("UPDATE stories SET status = 'failed', updated_at = $1 WHERE id = $2",
      [now(), story.id]);
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
 */
export async function checkGatewayStalling(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  let activeRunsCnt: number;

  {
    const row = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running'"
    );
    activeRunsCnt = Number(row?.cnt ?? 0);
  }
  if (activeRunsCnt === 0) return findings;

  // Count cron recreates in the stall window
  let recreatesCnt: number;

  {
    const row = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM medic_checks
      WHERE details LIKE '%recreate_crons%'
        AND EXTRACT(EPOCH FROM NOW() - checked_at::timestamptz) * 1000 < $1
    `, [GATEWAY_STALL_WINDOW_MS]);
    recreatesCnt = Number(row?.cnt ?? 0);
  }

  if (recreatesCnt < GATEWAY_STALL_RECREATE_THRESHOLD) return findings;

  // Check if any story OR step was claimed in the same window
  let recentStoryClaimsCnt: number;
  let recentStepClaimsCnt: number;

  const rsc = await pgGet<{ cnt: string }>(`
    SELECT COUNT(*) as cnt FROM stories
    WHERE status = 'running'
      AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 < $1
  `, [GATEWAY_STALL_WINDOW_MS]);
  recentStoryClaimsCnt = Number(rsc?.cnt ?? 0);

  const rstc = await pgGet<{ cnt: string }>(`
    SELECT COUNT(*) as cnt FROM steps
    WHERE status = 'running'
      AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 < $1
  `, [GATEWAY_STALL_WINDOW_MS]);
  recentStepClaimsCnt = Number(rstc?.cnt ?? 0);

  if (recentStoryClaimsCnt > 0 || recentStepClaimsCnt > 0) return findings; // Claims happening = gateway alive

  // Cooldown: don't restart if we already restarted recently
  let recentRestartTs: string | null;

  {
    const row = await pgGet<{ ts: string | null }>(`
      SELECT MAX(checked_at) as ts FROM medic_checks
      WHERE details LIKE '%restart_gateway%'
        AND details LIKE '%recreate_crons%'
        AND EXTRACT(EPOCH FROM NOW() - checked_at::timestamptz) * 1000 < $1
    `, [GATEWAY_RESTART_COOLDOWN_MS]);
    recentRestartTs = row?.ts ?? null;
  }

  if (recentRestartTs) return findings;

  findings.push({
    check: "gateway_stalling",
    severity: "critical",
    message: `Gateway scheduler stalled: ${recreatesCnt} cron recreates in 5min but 0 claims — restarting gateway`,
    action: "restart_gateway",
    remediated: false,
  });

  return findings;
}


// ── Orphaned Browser Processes ──────────────────────────────────────

async function checkOrphanedBrowserProcesses(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

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
    let activeRunsCnt: number;

    const row = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running'"
    );
    activeRunsCnt = Number(row?.cnt ?? 0);

    // Allow up to 2 Chrome processes per active run (main + devtools)
    const maxExpected = activeRunsCnt * 2;

    if (chromiumCount > maxExpected) {
      findings.push({
        check: "orphaned_browser",
        severity: "warning",
        message: `Found ${chromiumCount} Chromium process(es) but only ${activeRunsCnt} active run(s) — likely orphaned browser sessions`,
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
 */
export async function checkProviderFailure(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  // Must have active runs
  let activeRunsCnt: number;

  {
    const row = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running'"
    );
    activeRunsCnt = Number(row?.cnt ?? 0);
  }
  if (activeRunsCnt === 0) return findings;

  // Count recent step abandons (medic resets) in the window
  let recentAbandonsCnt: number;

  {
    const row = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM medic_checks
      WHERE details LIKE '%reset_step%'
        AND EXTRACT(EPOCH FROM NOW() - checked_at::timestamptz) * 1000 < $1
    `, [PROVIDER_FAIL_WINDOW_MS]);
    recentAbandonsCnt = Number(row?.cnt ?? 0);
  }

  if (recentAbandonsCnt < PROVIDER_FAIL_ABANDON_THRESHOLD) return findings;

  // Check if ANY story completed in the same window
  let recentCompletionsCnt: number;

  {
    const row = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM stories
      WHERE status IN ('done', 'verified')
        AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 < $1
    `, [PROVIDER_FAIL_WINDOW_MS]);
    recentCompletionsCnt = Number(row?.cnt ?? 0);
  }

  if (recentCompletionsCnt > 0) return findings; // Some agents succeed = not a provider issue

  // Also check if any step completed
  let recentStepDoneCnt: number;

  {
    const row = await pgGet<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM steps
      WHERE status = 'done'
        AND EXTRACT(EPOCH FROM NOW() - updated_at::timestamptz) * 1000 < $1
    `, [PROVIDER_FAIL_WINDOW_MS]);
    recentStepDoneCnt = Number(row?.cnt ?? 0);
  }

  if (recentStepDoneCnt > 0) return findings;

  // Cooldown: don't restart if we already did recently
  let recentRestartTs: string | null;

  {
    const row = await pgGet<{ ts: string | null }>(`
      SELECT MAX(checked_at) as ts FROM medic_checks
      WHERE (details LIKE '%provider_failure%' OR details LIKE '%restart_gateway%')
        AND details LIKE '%recreate_crons%'
        AND EXTRACT(EPOCH FROM NOW() - checked_at::timestamptz) * 1000 < $1
    `, [PROVIDER_FAIL_COOLDOWN_MS]);
    recentRestartTs = row?.ts ?? null;
  }

  if (recentRestartTs) return findings;

  findings.push({
    check: "provider_failure",
    severity: "critical",
    message: `Provider failure detected: ${recentAbandonsCnt} step abandons in 15min with 0 completions — restarting gateway to reset provider state`,
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
    const stale = await pgQuery(
      "SELECT cl.ctid, cl.run_id, cl.step_id, cl.story_id, cl.agent_id, cl.claimed_at " +
      "FROM claim_log cl WHERE cl.outcome IS NULL AND cl.claimed_at IS NOT NULL " +
      "AND EXTRACT(EPOCH FROM NOW() - cl.claimed_at::timestamptz) / 60 > $1",
      [STALE_THRESHOLD_MIN]
    );
    found = stale.length;
    for (const claim of stale) {
      logger.warn(`[MEDIC] Stale claim detected: agent=${claim.agent_id} step=${claim.step_id} story=${claim.story_id || 'N/A'} age=${STALE_THRESHOLD_MIN}+min`, { runId: claim.run_id });
      await pgRun(
        "UPDATE claim_log SET outcome = 'abandoned', abandoned_at = NOW(), duration_ms = CAST(EXTRACT(EPOCH FROM NOW() - claimed_at::timestamptz) * 1000 AS INTEGER), diagnostic = 'Stale claim detected by medic (60+ min)' WHERE run_id = $1 AND step_id = $2 AND claimed_at = $3 AND outcome IS NULL",
        [claim.run_id, claim.step_id, claim.claimed_at]
      );
      fixed++;
    }
  } catch (e) { logger.warn("[MEDIC] checkStaleClaims error: " + String(e), {}); }
  return { found, fixed };
}

// A3: Detect cascade failures (prerequisite step failed -> dependent step will also fail)
export async function checkCascadingFailures(db: any, logger: any): Promise<{ detected: number }> {
  let detected = 0;
  try {
    const cascades = await pgQuery(
      "SELECT r.id as run_id, fs.step_id as failed_step, fs.step_index as failed_idx, " +
      "ps.step_id as pending_step, ps.step_index as pending_idx, ps.status as pending_status " +
      "FROM runs r " +
      "JOIN steps fs ON fs.run_id = r.id AND fs.status = 'failed' " +
      "JOIN steps ps ON ps.run_id = r.id AND ps.step_index > fs.step_index AND ps.status IN ('pending', 'running') " +
      "WHERE r.status = 'running' " +
      "ORDER BY r.id, fs.step_index"
    );

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

export async function runSyncChecks(): Promise<MedicFinding[]> {
  return [
    ...await checkOrphanedInTerminalRuns(),
    ...await checkOrphanedStories(),
    ...await checkClaimedButStuck(),
    ...await checkStuckSteps(),
    ...await checkStalledRuns(),
    ...await checkDeadRuns(),
    ...await checkFailedRunsForResume(),
    ...await checkStalledWorkflowCrons(),
    ...await checkOfflineServices(),
    ...await checkGatewayStalling(),
    ...await checkProviderFailure(),
    ...await checkOrphanedBrowserProcesses(),
  ];
}


// ── Check: Stuck Waiting Steps (advancePipeline recovery) ──────────

/**
 * If a step is 'done' but the immediately next step is still 'waiting',
 * advancePipeline failed to activate it. Re-trigger advancement.
 * This is the safety net for gateway restarts during advancePipeline.
 */
export async function checkStuckWaitingSteps(): Promise<MedicFinding[]> {
  const findings: MedicFinding[] = [];

  const stuckRows = await pgQuery<{
    run_id: string;
    done_step: string;
    done_index: number;
    next_step: string;
    next_index: number;
    next_id: string;
    run_status: string;
    done_at: string;
  }>(`
    SELECT
      s1.run_id,
      s1.step_id as done_step,
      s1.step_index as done_index,
      s2.step_id as next_step,
      s2.step_index as next_index,
      s2.id as next_id,
      r.status as run_status,
      s1.updated_at as done_at
    FROM steps s1
    JOIN steps s2 ON s2.run_id = s1.run_id AND s2.step_index = (
        SELECT MIN(s3.step_index) FROM steps s3
        WHERE s3.run_id = s1.run_id AND s3.step_index > s1.step_index
      )
    JOIN runs r ON r.id = s1.run_id
    WHERE r.status = 'running'
      AND s1.status = 'done'
      AND s2.status = 'waiting'
      AND EXTRACT(EPOCH FROM NOW() - s1.updated_at) > 120
  `);

  for (const row of stuckRows) {
    findings.push({
      check: "stuck_waiting_step",
      severity: "warning",
      message: `Step "${row.next_step}" is waiting but previous step "${row.done_step}" is done (since ${row.done_at}) — advancePipeline missed, re-triggering`,
      action: "advance_pipeline",
      runId: row.run_id,
      stepId: row.next_id,
      remediated: false,
    });
  }

  return findings;
}
