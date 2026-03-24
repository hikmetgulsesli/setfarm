/**
 * Query Layer (repo.ts)
 *
 * Centralizes the most repeated DB operations from step-ops.ts and other modules.
 * Each function wraps a single db.prepare() call — no business logic.
 */

import { getDb } from "../db.js";
import { pgGet, pgQuery, pgRun } from "../db-pg.js";
import { logger } from "../lib/logger.js";

const USE_PG = process.env.DB_BACKEND === 'postgres';
const now = () => new Date().toISOString();

// ── Run queries ─────────────────────────────────────────────────────

export async function getRunStatus(runId: string): Promise<string | undefined> {
  if (USE_PG) {
    const row = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [runId]);
    return row?.status;
  } else {
    const row = getDb().prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string } | undefined;
    return row?.status;
  }
}

export async function getRunContext(runId: string): Promise<Record<string, string>> {
  if (USE_PG) {
    const row = await pgGet<{ context: string }>("SELECT context FROM runs WHERE id = $1", [runId]);
    return row ? JSON.parse(row.context) : {};
  } else {
    const row = getDb().prepare("SELECT context FROM runs WHERE id = ?").get(runId) as { context: string } | undefined;
    return row ? JSON.parse(row.context) : {};
  }
}

export async function updateRunContext(runId: string, context: Record<string, string>): Promise<void> {
  if (USE_PG) {
    await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3",
      [JSON.stringify(context), now(), runId]);
  } else {
    getDb().prepare("UPDATE runs SET context = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(context), now(), runId);
  }
}

export async function failRun(runId: string): Promise<void> {
  if (USE_PG) {
    await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2",
      [now(), runId]);
  } else {
    getDb().prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?")
      .run(now(), runId);
  }
}

export async function completeRun(runId: string): Promise<void> {
  if (USE_PG) {
    await pgRun("UPDATE runs SET status = 'completed', updated_at = $1 WHERE id = $2",
      [now(), runId]);
  } else {
    getDb().prepare("UPDATE runs SET status = 'completed', updated_at = ? WHERE id = ?")
      .run(now(), runId);
  }
}

export async function getWorkflowId(runId: string): Promise<string | undefined> {
  try {
    if (USE_PG) {
      const row = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
      return row?.workflow_id;
    } else {
      const row = getDb().prepare("SELECT workflow_id FROM runs WHERE id = ?").get(runId) as { workflow_id: string } | undefined;
      return row?.workflow_id;
    }
  } catch (e: any) {
    logger.warn(`[repo] getWorkflowId("${runId}") failed: ${e.message}`);
    return undefined;
  }
}

// ── Story queries ───────────────────────────────────────────────────

export async function verifyStory(storyId: string): Promise<void> {
  if (USE_PG) {
    await pgRun("UPDATE stories SET status = 'verified', updated_at = $1 WHERE id = $2",
      [now(), storyId]);
  } else {
    getDb().prepare("UPDATE stories SET status = 'verified', updated_at = ? WHERE id = ?")
      .run(now(), storyId);
  }
}

export async function skipFailedStories(runId: string): Promise<void> {
  if (USE_PG) {
    await pgRun("UPDATE stories SET status = 'skipped', updated_at = $1 WHERE run_id = $2 AND status = 'failed'",
      [now(), runId]);
  } else {
    getDb().prepare("UPDATE stories SET status = 'skipped', updated_at = ? WHERE run_id = ? AND status = 'failed'")
      .run(now(), runId);
  }
}

export async function countStoriesByStatus(runId: string, status: string): Promise<number> {
  if (USE_PG) {
    const row = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = $2", [runId, status]);
    return Number(row?.cnt ?? 0);
  } else {
    const row = getDb().prepare("SELECT COUNT(*) as cnt FROM stories WHERE run_id = ? AND status = ?")
      .get(runId, status) as { cnt: number };
    return row.cnt;
  }
}

export async function countAllStories(runId: string): Promise<number> {
  if (USE_PG) {
    const row = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1", [runId]);
    return Number(row?.cnt ?? 0);
  } else {
    const row = getDb().prepare("SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?")
      .get(runId) as { cnt: number };
    return row.cnt;
  }
}

export async function findStoryByStatus(runId: string, status: string): Promise<{ id: string } | undefined> {
  if (USE_PG) {
    return await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = $2 LIMIT 1", [runId, status]);
  } else {
    return getDb().prepare("SELECT id FROM stories WHERE run_id = ? AND status = ? LIMIT 1")
      .get(runId, status) as { id: string } | undefined;
  }
}

export async function getNextPendingStory(runId: string): Promise<any | undefined> {
  if (USE_PG) {
    return await pgGet("SELECT * FROM stories WHERE run_id = $1 AND status = 'pending' AND (abandoned_count IS NULL OR abandoned_count < 3) ORDER BY story_index ASC LIMIT 1", [runId]);
  } else {
    return getDb().prepare("SELECT * FROM stories WHERE run_id = ? AND status = 'pending' AND (abandoned_count IS NULL OR abandoned_count < 3) ORDER BY story_index ASC LIMIT 1")
      .get(runId);
  }
}

export async function getNextDoneStory(runId: string): Promise<any | undefined> {
  if (USE_PG) {
    return await pgGet("SELECT * FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY story_index ASC LIMIT 1", [runId]);
  } else {
    return getDb().prepare("SELECT * FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1")
      .get(runId);
  }
}

export async function getStoryInfo(storyId: string): Promise<{ story_id: string; title: string } | undefined> {
  if (USE_PG) {
    return await pgGet<{ story_id: string; title: string }>("SELECT story_id, title FROM stories WHERE id = $1", [storyId]);
  } else {
    return getDb().prepare("SELECT story_id, title FROM stories WHERE id = ?")
      .get(storyId) as { story_id: string; title: string } | undefined;
  }
}

export async function updateStoryStatus(storyId: string, status: string, extra?: {
  output?: string; prUrl?: string; storyBranch?: string;
  retryCount?: number; abandonedCount?: number;
}): Promise<void> {
  if (USE_PG) {
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
  } else {
    const db = getDb();
    const ts = now();
    const sets: string[] = ["status = ?", "updated_at = ?"];
    const vals: any[] = [status, ts];
    if (extra?.output !== undefined) { sets.push("output = ?"); vals.push(extra.output); }
    if (extra?.prUrl !== undefined) { sets.push("pr_url = ?"); vals.push(extra.prUrl); }
    if (extra?.storyBranch !== undefined) { sets.push("story_branch = ?"); vals.push(extra.storyBranch); }
    if (extra?.retryCount !== undefined) { sets.push("retry_count = ?"); vals.push(extra.retryCount); }
    if (extra?.abandonedCount !== undefined) { sets.push("abandoned_count = ?"); vals.push(extra.abandonedCount); }
    vals.push(storyId);
    db.prepare(`UPDATE stories SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}

// ── Step queries ────────────────────────────────────────────────────

export async function setStepStatus(stepId: string, status: string): Promise<number> {
  if (USE_PG) {
    const result = await pgRun("UPDATE steps SET status = $1, updated_at = $2 WHERE id = $3",
      [status, now(), stepId]);
    return result.changes;
  } else {
    return Number(getDb().prepare("UPDATE steps SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, now(), stepId).changes);
  }
}

export async function setStepStatusConditional(stepId: string, newStatus: string, requiredStatus: string): Promise<number> {
  if (USE_PG) {
    const result = await pgRun("UPDATE steps SET status = $1, updated_at = $2 WHERE id = $3 AND status = $4",
      [newStatus, now(), stepId, requiredStatus]);
    return result.changes;
  } else {
    return Number(getDb().prepare("UPDATE steps SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
      .run(newStatus, now(), stepId, requiredStatus).changes);
  }
}

export async function failStepWithOutput(stepId: string, output: string): Promise<void> {
  if (USE_PG) {
    await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
      [output, now(), stepId]);
  } else {
    getDb().prepare("UPDATE steps SET status = 'failed', output = ?, updated_at = ? WHERE id = ?")
      .run(output, now(), stepId);
  }
}

export async function clearStepStory(stepId: string, output: string): Promise<void> {
  if (USE_PG) {
    await pgRun("UPDATE steps SET current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3",
      [output, now(), stepId]);
  } else {
    getDb().prepare("UPDATE steps SET current_story_id = NULL, output = ?, updated_at = ? WHERE id = ?")
      .run(output, now(), stepId);
  }
}

export async function findLoopStep(runId: string): Promise<{ id: string; loop_config: string | null } | undefined> {
  if (USE_PG) {
    return await pgGet<{ id: string; loop_config: string | null }>("SELECT id, loop_config FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [runId]);
  } else {
    return getDb().prepare("SELECT id, loop_config FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1")
      .get(runId) as { id: string; loop_config: string | null } | undefined;
  }
}

export async function findActiveLoop(runId: string): Promise<{ id: string } | undefined> {
  if (USE_PG) {
    return await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND type = 'loop' AND status NOT IN ('done', 'failed', 'waiting') LIMIT 1", [runId]);
  } else {
    return getDb().prepare("SELECT id FROM steps WHERE run_id = ? AND type = 'loop' AND status NOT IN ('done', 'failed', 'waiting') LIMIT 1")
      .get(runId) as { id: string } | undefined;
  }
}

export async function findVerifyStepByStepId(runId: string, stepId: string): Promise<{ id: string } | undefined> {
  if (USE_PG) {
    return await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [runId, stepId]);
  } else {
    return getDb().prepare("SELECT id FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1")
      .get(runId, stepId) as { id: string } | undefined;
  }
}
