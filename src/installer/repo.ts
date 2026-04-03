/**
 * Query Layer (repo.ts)
 *
 * Centralizes the most repeated DB operations from step-ops.ts and other modules.
 * Each function wraps a single query call — no business logic.
 */

import { pgGet, pgQuery, pgRun, now } from "../db-pg.js";
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
  await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3",
    [JSON.stringify(context), now(), runId]);
}

export async function failRun(runId: string): Promise<void> {
  await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2",
    [now(), runId]);
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

export async function skipFailedStories(runId: string): Promise<void> {
  // Only skip stories that have exhausted their retries — re-queue others
  const failed = await pgQuery<{ id: string; output: string | null; story_id: string; retry_count: number; max_retries: number }>(
    "SELECT id, output, story_id, retry_count, max_retries FROM stories WHERE run_id = $1 AND status = 'failed'", [runId]
  );
  for (const s of failed) {
    if (s.retry_count < s.max_retries) {
      // Still has retries left — re-queue instead of skipping
      await pgRun("UPDATE stories SET status = 'pending', updated_at = $1 WHERE id = $2", [now(), s.id]);
      continue;
    }
    const skipReason = s.output
      ? `SKIPPED (was failed): ${s.output}`
      : `SKIPPED: Story ${s.story_id} failed with no diagnostic — likely empty workdir or agent timeout`;
    await pgRun("UPDATE stories SET status = 'skipped', output = $1, updated_at = $2 WHERE id = $3",
      [skipReason, now(), s.id]);
  }
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
