/**
 * Medic health checks — modular functions that inspect DB state and return findings.
 */
import { getDb } from "../db.js";
import { getMaxRoleTimeoutSeconds } from "../installer/install.js";

export type MedicSeverity = "info" | "warning" | "critical";
export type MedicActionType =
  | "reset_step"
  | "fail_run"
  | "resume_run"
  | "teardown_crons"
  | "reset_story"
  | "recreate_crons"
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
      AND r.status = 'running'
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
    WHERE r.status = 'running'
    GROUP BY r.id
    HAVING (julianday('now') - julianday(MAX(s.updated_at))) * 86400000 > ?
  `).all(STALL_THRESHOLD_MS) as Array<{
    id: string; workflow_id: string; task: string;
    updated_at: string; last_step_update: string;
  }>;

  for (const run of stalled) {
    const ageMin = Math.round(
      (Date.now() - new Date(run.last_step_update).getTime()) / 60000
    );
    findings.push({
      check: "stalled_runs",
      severity: "critical",
      message: `Run ${run.id.slice(0, 8)} (${run.workflow_id}: "${run.task.slice(0, 60)}") has had no step progress for ${ageMin}min`,
      action: "none", // alert only — don't auto-fail without human input
      runId: run.id,
      remediated: false,
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

const CLAIMED_STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes — if Phase 2 hasn't started in 10min, it's dead

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
      AND r.status = 'running'
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
const RESUME_COOLDOWN_MS = 10 * 60 * 1000; // 10 min cooldown between resumes

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

const STORY_STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes — matches agent timeout

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
      AND r.status = 'running'
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

const CIRCUIT_BREAKER_THRESHOLD_MS = 12 * 60 * 1000; // 12 min = 3x the 4-min cron interval

/**
 * Detect when agent crons are dead or in error state.
 *
 * Signal: pending stories exist (work available) but no story has been
 * claimed recently. With 4-min interval and 3 parallel crons, a claim
 * should happen every 1-2 min. If no claim in 12 min, crons are likely dead.
 *
 * Includes 15-min cooldown (checked via medic_checks history) to prevent
 * rapid re-creation loops.
 */
export function checkStalledWorkflowCrons(): MedicFinding[] {
  const db = getDb();
  const findings: MedicFinding[] = [];

  // Get all workflows with running runs
  const workflows = db.prepare(
    "SELECT DISTINCT workflow_id FROM runs WHERE status = 'running'"
  ).all() as Array<{ workflow_id: string }>;

  for (const { workflow_id } of workflows) {
    // Check if there are pending stories waiting to be claimed
    const pending = db.prepare(`
      SELECT COUNT(*) as cnt FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = ? AND r.status = 'running' AND st.status = 'pending'
    `).get(workflow_id) as { cnt: number };

    if (pending.cnt === 0) continue; // no pending work — crons are fine or not needed

    // When was the last story claimed (set to running)?
    const lastClaim = db.prepare(`
      SELECT MAX(st.updated_at) as ts FROM stories st
      JOIN runs r ON r.id = st.run_id
      WHERE r.workflow_id = ? AND r.status = 'running' AND st.status = 'running'
    `).get(workflow_id) as { ts: string | null };

    const age = lastClaim?.ts
      ? Date.now() - new Date(lastClaim.ts).getTime()
      : CIRCUIT_BREAKER_THRESHOLD_MS + 1; // no running stories at all = stalled

    if (age <= CIRCUIT_BREAKER_THRESHOLD_MS) continue;

    // Cooldown: don't re-fire if we already recreated crons in the last 15 min
    const recentRecreate = db.prepare(`
      SELECT MAX(checked_at) as ts FROM medic_checks
      WHERE details LIKE '%stalled_workflow_crons%'
        AND details LIKE '%"remediated":true%'
        AND details LIKE ?
        AND checked_at > datetime('now', '-15 minutes')
    `).get(`%${workflow_id}%`) as { ts: string | null };

    if (recentRecreate?.ts) continue;

    const ageMin = lastClaim?.ts ? Math.round(age / 60000) : -1;
    findings.push({
      check: "stalled_workflow_crons",
      severity: "warning",
      message: `Workflow "${workflow_id}" has ${pending.cnt} pending stories but ${ageMin > 0 ? `no claim in ${ageMin}min` : "no active claims"} — crons may be dead, force-recreating`,
      action: "recreate_crons",
      workflowId: workflow_id,
      remediated: false,
    });
  }

  return findings;
}

export function runSyncChecks(): MedicFinding[] {
  return [
    ...checkOrphanedStories(),
    ...checkClaimedButStuck(),
    ...checkStuckSteps(),
    ...checkStalledRuns(),
    ...checkDeadRuns(),
    ...checkFailedRunsForResume(),
    ...checkStalledWorkflowCrons(),
  ];
}
