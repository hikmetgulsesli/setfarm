/**
 * Query Layer (repo.ts)
 *
 * Centralizes the most repeated DB operations from step-ops.ts and other modules.
 * Each function wraps a single query call — no business logic.
 */

import { pgGet, pgQuery, pgRun, pgBegin, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";


// ── Run queries ─────────────────────────────────────────────────────

export async function getRunStatus(runId: string): Promise<string | undefined> {
  const row = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [runId]);
  return row?.status;
}

export async function getRunContext(runId: string): Promise<Record<string, string>> {
  const row = await pgGet<{ context: string }>("SELECT context FROM runs WHERE id = $1", [runId]);
  return row ? JSON.parse(row.context) : {};
}

export async function updateRunContext(runId: string, context: Record<string, string>): Promise<void> {
  // Atomic read-merge-write inside transaction to prevent race conditions
  await pgBegin(async (sql) => {
    const row = await sql.unsafe("SELECT context FROM runs WHERE id = $1 FOR UPDATE", [runId]);
    const existing = row[0]?.context ? (typeof row[0].context === "string" ? JSON.parse(row[0].context) : row[0].context) : {};
    const base = Array.isArray(existing) ? {} : existing;
    const merged = { ...base, ...context };
    await sql.unsafe("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(merged), now(), runId]);
  });
}

/**
 * Fail a run. When `terminal` is true the failure is marked in runs.meta so
 * medic's resume_run action skips it. Wave 13 Bug J-2 (run #344 postmortem):
 * previously any failed run — including intentional merge-queue aborts and
 * retry-exhausted guards — could be revived by medic, which then re-advanced
 * the pipeline past a dead implement step into verify/security-gate/qa-test.
 * Intentional callers (step-ops.ts direct-merge failure paths, retry exhaust,
 * missing-context guards) must pass terminal=true so the failure sticks.
 */
export async function failRun(runId: string, terminal = false): Promise<void> {
  await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2",
    [now(), runId]);
  if (!terminal) return;
  try {
    const row = await pgGet<{ meta: string | null }>("SELECT meta FROM runs WHERE id = $1", [runId]);
    const meta = row?.meta ? JSON.parse(row.meta) : {};
    meta.terminal_failure = true;
    meta.terminal_marked_at = now();
    await pgRun("UPDATE runs SET meta = $1 WHERE id = $2", [JSON.stringify(meta), runId]);
  } catch (e) {
    logger.warn(`[failRun] Could not persist terminal_failure flag for ${runId}: ${String(e)}`);
  }
}

export async function completeRun(runId: string): Promise<void> {
  await pgRun("UPDATE runs SET status = 'completed', updated_at = $1 WHERE id = $2",
    [now(), runId]);
}

export async function getWorkflowId(runId: string): Promise<string | undefined> {
  try {
    const row = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
    return row?.workflow_id;
  } catch (e: any) {
    logger.warn(`[repo] getWorkflowId("${runId}") failed: ${e.message}`);
    return undefined;
  }
}

// ── Story queries ───────────────────────────────────────────────────

export async function verifyStory(storyId: string): Promise<void> {
  await pgRun("UPDATE stories SET status = 'verified', updated_at = $1 WHERE id = $2",
    [now(), storyId]);
}

export async function skipFailedStories(_runId: string): Promise<number> {
  // DISABLED: Never skip stories. Failed stories stay as 'failed' and get
  // retried by failStep until max_retries exhausted. Then they stay 'failed'
  // and the loop completes without them. No story is ever marked 'skipped'.
  return 0;
}

export async function countStoriesByStatus(runId: string, status: string): Promise<number> {
  const row = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = $2", [runId, status]);
  return Number(row?.cnt ?? 0);
}

export async function countAllStories(runId: string): Promise<number> {
  const row = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1", [runId]);
  return Number(row?.cnt ?? 0);
}

export async function findStoryByStatus(runId: string, status: string): Promise<{ id: string } | undefined> {
  return await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = $2 LIMIT 1", [runId, status]);
}

export async function getNextPendingStory(runId: string): Promise<any | undefined> {
  return await pgGet("SELECT * FROM stories WHERE run_id = $1 AND status = 'pending' AND (abandoned_count IS NULL OR abandoned_count < 3) ORDER BY story_index ASC LIMIT 1", [runId]);
}

export async function claimNextStory(runId: string, agentId: string, eligibleStoryId?: string): Promise<any | undefined> {
  return await pgBegin(async (sql) => {
    // If a specific dependency-eligible story ID is provided, claim that one.
    // Otherwise fall back to first pending story by index.
    const query = eligibleStoryId
      ? `SELECT id, story_id, title, story_index, output, retry_count, max_retries, abandoned_count
         FROM stories WHERE run_id = $1 AND id = $2 AND status = 'pending'
         FOR UPDATE SKIP LOCKED`
      : `SELECT id, story_id, title, story_index, output, retry_count, max_retries, abandoned_count
         FROM stories WHERE run_id = $1 AND status = 'pending'
         ORDER BY story_index ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;
    const params = eligibleStoryId ? [runId, eligibleStoryId] : [runId];
    const rows = await sql.unsafe(query, params);
    const story = rows[0] as any;
    if (!story) return undefined;

    await sql.unsafe(
      `UPDATE stories SET status = 'running', started_at = NOW(), updated_at = $1
       WHERE id = $2`,
      [now(), story.id]
    );
    return story;
  });
}

export async function getNextDoneStory(runId: string): Promise<any | undefined> {
  return await pgGet("SELECT * FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY story_index ASC LIMIT 1", [runId]);
}

export async function getStoryInfo(storyId: string): Promise<{ story_id: string; title: string } | undefined> {
  return await pgGet<{ story_id: string; title: string }>("SELECT story_id, title FROM stories WHERE id = $1", [storyId]);
}

export async function updateStoryStatus(storyId: string, status: string, extra?: {
  output?: string; prUrl?: string; storyBranch?: string;
  retryCount?: number; abandonedCount?: number;
}): Promise<void> {
  const ts = now();
  const sets: string[] = ["status = $1", "updated_at = $2"];
  const vals: any[] = [status, ts];
  let idx = 3;
  if (extra?.output !== undefined) { sets.push(`output = $${idx}`); vals.push(extra.output); idx++; }
  if (extra?.prUrl !== undefined) { sets.push(`pr_url = $${idx}`); vals.push(extra.prUrl); idx++; }
  if (extra?.storyBranch !== undefined) { sets.push(`story_branch = $${idx}`); vals.push(extra.storyBranch); idx++; }
  if (extra?.retryCount !== undefined) { sets.push(`retry_count = $${idx}`); vals.push(extra.retryCount); idx++; }
  if (extra?.abandonedCount !== undefined) { sets.push(`abandoned_count = $${idx}`); vals.push(extra.abandonedCount); idx++; }
  vals.push(storyId);
  await pgRun(`UPDATE stories SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
}

// ── Step queries ────────────────────────────────────────────────────

export async function setStepStatus(stepId: string, status: string): Promise<number> {
  const result = await pgRun("UPDATE steps SET status = $1, updated_at = $2 WHERE id = $3",
    [status, now(), stepId]);
  return result.changes;
}

export async function setStepStatusConditional(stepId: string, newStatus: string, requiredStatus: string): Promise<number> {
  const result = await pgRun("UPDATE steps SET status = $1, updated_at = $2 WHERE id = $3 AND status = $4",
    [newStatus, now(), stepId, requiredStatus]);
  return result.changes;
}

export async function failStepWithOutput(stepId: string, output: string): Promise<void> {
  await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
    [output, now(), stepId]);
}

export async function clearStepStory(stepId: string, output: string): Promise<void> {
  await pgRun("UPDATE steps SET current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3",
    [output, now(), stepId]);
}

export async function findLoopStep(runId: string): Promise<{ id: string; loop_config: string | null } | undefined> {
  return await pgGet<{ id: string; loop_config: string | null }>("SELECT id, loop_config FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [runId]);
}

export async function findActiveLoop(runId: string): Promise<{ id: string } | undefined> {
  return await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND type = 'loop' AND status NOT IN ('done', 'failed', 'waiting') LIMIT 1", [runId]);
}

export async function findVerifyStepByStepId(runId: string, stepId: string): Promise<{ id: string } | undefined> {
  return await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [runId, stepId]);
}

// ── Step Transition Recording ──────────────────────────────────────

/**
 * Record a step status transition in step_transitions table.
 * Best-effort — failures are silently logged to avoid breaking the pipeline.
 */
export async function recordStepTransition(
  stepId: string, runId: string, fromStatus: string | null, toStatus: string,
  agentId?: string, triggeredBy?: string, metadata?: Record<string, any>
): Promise<void> {
  try {
    await pgRun(
      "INSERT INTO step_transitions (step_id, run_id, from_status, to_status, agent_id, triggered_by, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [stepId, runId, fromStatus, toStatus, agentId || null, triggeredBy || null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (e) { /* best effort — don't break pipeline */ }
}
