/**
 * Query Layer (repo.ts)
 *
 * Centralizes the most repeated DB operations from step-ops.ts and other modules.
 * Each function wraps a single db.prepare() call — no business logic.
 */

import { getDb } from "../db.js";
import { logger } from "../lib/logger.js";

const now = () => new Date().toISOString();

// ── Run queries ─────────────────────────────────────────────────────

export function getRunStatus(runId: string): string | undefined {
  const row = getDb().prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string } | undefined;
  return row?.status;
}

export function getRunContext(runId: string): Record<string, string> {
  const row = getDb().prepare("SELECT context FROM runs WHERE id = ?").get(runId) as { context: string } | undefined;
  return row ? JSON.parse(row.context) : {};
}

export function updateRunContext(runId: string, context: Record<string, string>): void {
  getDb().prepare("UPDATE runs SET context = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(context), now(), runId);
}

export function failRun(runId: string): void {
  getDb().prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?")
    .run(now(), runId);
}

export function completeRun(runId: string): void {
  getDb().prepare("UPDATE runs SET status = 'completed', updated_at = ? WHERE id = ?")
    .run(now(), runId);
}

export function getWorkflowId(runId: string): string | undefined {
  try {
    const row = getDb().prepare("SELECT workflow_id FROM runs WHERE id = ?").get(runId) as { workflow_id: string } | undefined;
    return row?.workflow_id;
  } catch (e: any) {
    logger.warn(`[repo] getWorkflowId("${runId}") failed: ${e.message}`);
    return undefined;
  }
}

// ── Story queries ───────────────────────────────────────────────────

export function verifyStory(storyId: string): void {
  getDb().prepare("UPDATE stories SET status = 'verified', updated_at = ? WHERE id = ?")
    .run(now(), storyId);
}

export function skipFailedStories(runId: string): void {
  getDb().prepare("UPDATE stories SET status = 'skipped', updated_at = ? WHERE run_id = ? AND status = 'failed'")
    .run(now(), runId);
}

export function countStoriesByStatus(runId: string, status: string): number {
  const row = getDb().prepare("SELECT COUNT(*) as cnt FROM stories WHERE run_id = ? AND status = ?")
    .get(runId, status) as { cnt: number };
  return row.cnt;
}

export function countAllStories(runId: string): number {
  const row = getDb().prepare("SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?")
    .get(runId) as { cnt: number };
  return row.cnt;
}

export function findStoryByStatus(runId: string, status: string): { id: string } | undefined {
  return getDb().prepare("SELECT id FROM stories WHERE run_id = ? AND status = ? LIMIT 1")
    .get(runId, status) as { id: string } | undefined;
}

export function getNextPendingStory(runId: string): any | undefined {
  return getDb().prepare("SELECT * FROM stories WHERE run_id = ? AND status = 'pending' AND (abandoned_count IS NULL OR abandoned_count < 3) ORDER BY story_index ASC LIMIT 1")
    .get(runId);
}

export function getNextDoneStory(runId: string): any | undefined {
  return getDb().prepare("SELECT * FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1")
    .get(runId);
}

export function getStoryInfo(storyId: string): { story_id: string; title: string } | undefined {
  return getDb().prepare("SELECT story_id, title FROM stories WHERE id = ?")
    .get(storyId) as { story_id: string; title: string } | undefined;
}

export function updateStoryStatus(storyId: string, status: string, extra?: {
  output?: string; prUrl?: string; storyBranch?: string;
  retryCount?: number; abandonedCount?: number;
}): void {
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

// ── Step queries ────────────────────────────────────────────────────

export function setStepStatus(stepId: string, status: string): number {
  return Number(getDb().prepare("UPDATE steps SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, now(), stepId).changes);
}

export function setStepStatusConditional(stepId: string, newStatus: string, requiredStatus: string): number {
  return Number(getDb().prepare("UPDATE steps SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
    .run(newStatus, now(), stepId, requiredStatus).changes);
}

export function failStepWithOutput(stepId: string, output: string): void {
  getDb().prepare("UPDATE steps SET status = 'failed', output = ?, updated_at = ? WHERE id = ?")
    .run(output, now(), stepId);
}

export function clearStepStory(stepId: string, output: string): void {
  getDb().prepare("UPDATE steps SET current_story_id = NULL, output = ?, updated_at = ? WHERE id = ?")
    .run(output, now(), stepId);
}

export function findLoopStep(runId: string): { id: string; loop_config: string | null } | undefined {
  return getDb().prepare("SELECT id, loop_config FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1")
    .get(runId) as { id: string; loop_config: string | null } | undefined;
}

export function findActiveLoop(runId: string): { id: string } | undefined {
  return getDb().prepare("SELECT id FROM steps WHERE run_id = ? AND type = 'loop' AND status NOT IN ('done', 'failed', 'waiting') LIMIT 1")
    .get(runId) as { id: string } | undefined;
}

export function findVerifyStepByStepId(runId: string, stepId: string): { id: string } | undefined {
  return getDb().prepare("SELECT id FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1")
    .get(runId, stepId) as { id: string } | undefined;
}
