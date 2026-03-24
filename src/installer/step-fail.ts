/**
 * Step Failure & Retry Logic (step-fail.ts)
 *
 * Extracted from step-ops.ts — handles step failures with per-story retry,
 * fallback model escalation, and single-step retry/fail logic.
 */

import { execFileSync } from "node:child_process";
import { getDb } from "../db.js";
import { logger } from "../lib/logger.js";
import { emitEvent } from "./events.js";
import { buildPollingPrompt } from "./agent-cron.js";
import {
  STORY_FALLBACK_RETRY_THRESHOLD,
  STORY_FALLBACK_MODEL,
  DEFAULT_DEVELOPER_AGENTS,
} from "./constants.js";
import {
  getRunContext, getWorkflowId, getStoryInfo,
} from "./repo.js";
import { removeStoryWorktree } from "./worktree-ops.js";
import { scheduleRunCronTeardown } from "./cleanup-ops.js";

// ── failStep ─────────────────────────────────────────────────────────

/**
 * Fail a step, with retry logic. For loop steps, applies per-story retry.
 */
export function failStep(stepId: string, error: string): { retrying: boolean; runFailed: boolean } {
  const db = getDb();

  const step = db.prepare(
    "SELECT run_id, retry_count, max_retries, type, current_story_id, agent_id FROM steps WHERE id = ?"
  ).get(stepId) as { run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string } | undefined;

  if (!step) throw new Error(`Step not found: ${stepId}`);

  // T9: Loop step failure — per-story retry
  if (step.type === "loop" && step.current_story_id) {
    return handleLoopStepFailure(stepId, step, error);
  }

  // Single step: existing logic
  return handleSingleStepFailure(stepId, step, error);
}

// ── Loop step failure (per-story retry) ──────────────────────────────

function handleLoopStepFailure(
  stepId: string,
  step: { run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string },
  error: string,
): { retrying: boolean; runFailed: boolean } {
  const db = getDb();
  const story = db.prepare(
    "SELECT id, retry_count, max_retries FROM stories WHERE id = ?"
  ).get(step.current_story_id!) as { id: string; retry_count: number; max_retries: number } | undefined;

  if (!story) return handleSingleStepFailure(stepId, step, error);

  const storyRow = getStoryInfo(step.current_story_id!);
  const newRetry = story.retry_count + 1;

  // Clean up worktree BEFORE transaction (slow git ops should not hold write lock)
  if (storyRow?.story_id) {
    const ctx = getRunContext(step.run_id);
    if (ctx.repo) removeStoryWorktree(ctx.repo, storyRow.story_id, step.agent_id);
  }

  if (newRetry > story.max_retries) {
    // Story retries exhausted — mark story as failed but DON'T fail the run
    // Atomic: story fail + step reset must happen together
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = ? WHERE id = ?").run(newRetry, new Date().toISOString(), story.id);
      db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), stepId);
      try { db.prepare("UPDATE claim_log SET outcome = 'failed', duration_ms = CAST((julianday('now') - julianday(claimed_at)) * 86400000 AS INTEGER), diagnostic = ? WHERE story_id = ? AND outcome IS NULL").run(error, storyRow?.story_id || ""); } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
      db.exec("COMMIT");
    } catch (txErr) {
      try { db.exec("ROLLBACK"); } catch (e) { logger.warn("[tx] ROLLBACK failed: " + String(e), {}); }
      throw txErr;
    }
    const wfId = getWorkflowId(step.run_id);
    emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: stepId, storyId: storyRow?.story_id, storyTitle: storyRow?.title, detail: `Story retries exhausted (${newRetry}/${story.max_retries}) — loop continues` });
    logger.info(`[failStep] Story ${storyRow?.story_id} retries exhausted — marked failed, loop continues`, { runId: step.run_id });
    return { retrying: false, runFailed: false };
  }

  // Retry the story — atomic: story pending + step reset
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = ? WHERE id = ?").run(newRetry, new Date().toISOString(), story.id);
    db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), stepId);
    try { db.prepare("UPDATE claim_log SET outcome = 'failed', duration_ms = CAST((julianday('now') - julianday(claimed_at)) * 86400000 AS INTEGER), diagnostic = ? WHERE story_id = ? AND outcome IS NULL").run(error, storyRow?.story_id || ""); } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
    db.exec("COMMIT");
  } catch (txErr) {
    try { db.exec("ROLLBACK"); } catch (e) { logger.warn("[tx] ROLLBACK failed: " + String(e), {}); }
    throw txErr;
  }

  // v1.7.8: After STORY_FALLBACK_RETRY_THRESHOLD retries, fire a one-shot cron
  // with fallback model so a different LLM attempts the story
  if (newRetry >= STORY_FALLBACK_RETRY_THRESHOLD) {
    fireFallbackRetryCron(step, storyRow, newRetry);
  }

  return { retrying: true, runFailed: false };
}

// ── Single step failure ──────────────────────────────────────────────

// Fix 3: Steps that MUST fail the run when retries exhausted (critical path)
const CRITICAL_STEPS = new Set(["deploy", "plan", "setup-repo", "setup-build", "stories"]);

function handleSingleStepFailure(
  stepId: string,
  step: { run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; agent_id: string },
  error: string,
): { retrying: boolean; runFailed: boolean } {
  const db = getDb();
  const newRetryCount = step.retry_count + 1;

  // Look up the workflow step_id (e.g. "design", "deploy", "security-gate")
  const stepRow = db.prepare("SELECT step_id FROM steps WHERE id = ?").get(stepId) as { step_id: string } | undefined;
  const workflowStepId = stepRow?.step_id || "";

  // Atomic: step + run status updates must happen together
  db.exec("BEGIN IMMEDIATE");
  try {
    if (newRetryCount > step.max_retries) {
      const isCritical = CRITICAL_STEPS.has(workflowStepId);

      if (isCritical) {
        // Critical step: fail the run (original behavior)
        db.prepare("UPDATE steps SET status = 'failed', output = ?, retry_count = ?, updated_at = ? WHERE id = ?")
          .run(error, newRetryCount, new Date().toISOString(), stepId);
        db.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), step.run_id);
        try { db.prepare("UPDATE claim_log SET outcome = 'failed', duration_ms = CAST((julianday('now') - julianday(claimed_at)) * 86400000 AS INTEGER), diagnostic = ? WHERE run_id = ? AND step_id = ? AND story_id IS NULL AND outcome IS NULL").run(error, step.run_id, stepId); } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
        db.exec("COMMIT");
        const wfId2 = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: stepId, detail: error });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: "Critical step retries exhausted" });
        scheduleRunCronTeardown(step.run_id);
        return { retrying: false, runFailed: true };
      } else {
        // Fix 3: Non-critical step (design, security-gate, qa-test, final-test, verify):
        // Skip and let pipeline continue instead of killing the entire run
        db.prepare("UPDATE steps SET status = 'skipped', output = ?, retry_count = ?, updated_at = ? WHERE id = ?")
          .run(`SKIPPED: ${error}`, newRetryCount, new Date().toISOString(), stepId);
        try { db.prepare("UPDATE claim_log SET outcome = 'skipped', duration_ms = CAST((julianday('now') - julianday(claimed_at)) * 86400000 AS INTEGER), diagnostic = ? WHERE run_id = ? AND step_id = ? AND story_id IS NULL AND outcome IS NULL").run(error, step.run_id, stepId); } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
        db.exec("COMMIT");
        const wfId2 = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "step.skipped", runId: step.run_id, workflowId: wfId2, stepId: workflowStepId, detail: `Retries exhausted — skipped: ${error}` });
        logger.warn(`[failStep] Non-critical step ${workflowStepId} skipped after ${newRetryCount} retries — pipeline continues`, { runId: step.run_id });
        // Advance pipeline past the skipped step (lazy import to avoid circular dep)
        const { advancePipeline } = require("./step-advance.js");
        advancePipeline(step.run_id);
        return { retrying: false, runFailed: false };
      }
    } else {
      db.prepare("UPDATE steps SET status = 'pending', retry_count = ?, updated_at = ? WHERE id = ?")
        .run(newRetryCount, new Date().toISOString(), stepId);
      try { db.prepare("UPDATE claim_log SET outcome = 'failed', duration_ms = CAST((julianday('now') - julianday(claimed_at)) * 86400000 AS INTEGER), diagnostic = ? WHERE run_id = ? AND step_id = ? AND story_id IS NULL AND outcome IS NULL").run(error, step.run_id, stepId); } catch (e) { logger.warn("[claim-log] update failed: " + String(e), {}); }
      db.exec("COMMIT");
      return { retrying: true, runFailed: false };
    }
  } catch (txErr) {
    try { db.exec("ROLLBACK"); } catch (e) { logger.warn("[tx] ROLLBACK failed: " + String(e), {}); }
    throw txErr;
  }
}

// ── Fallback Model Cron ──────────────────────────────────────────────

function fireFallbackRetryCron(
  step: { run_id: string; agent_id: string },
  storyRow: { story_id: string; title: string } | undefined,
  newRetry: number,
): void {
  try {
    const wfId2 = getWorkflowId(step.run_id) || "feature-dev";
    const agentRole = step.agent_id.includes("_") ? step.agent_id.split("_").pop()! : step.agent_id;
    // Pick a different agent from the pool for variety
    const mappedAgents = [...DEFAULT_DEVELOPER_AGENTS];
    const fallbackAgent = mappedAgents[newRetry % mappedAgents.length];
    const cronName = `setfarm/fallback-retry/${storyRow?.story_id || "unknown"}-r${newRetry}`;
    const pollingPrompt = buildPollingPrompt(wfId2, agentRole);
    execFileSync("openclaw", [
      "cron", "add",
      "--name", cronName,
      "--agent", fallbackAgent,
      "--model", STORY_FALLBACK_MODEL,
      "--at", "+10s",
      "--delete-after-run",
      "--exact",
      "--session", "isolated",
      "--payload", JSON.stringify({
        kind: "agentTurn",
        message: pollingPrompt,
        timeoutSeconds: 1800,
      }),
    ], { timeout: 15000, stdio: "pipe" });
    logger.info(`[failStep] Fired fallback retry with model ${STORY_FALLBACK_MODEL} for story ${storyRow?.story_id} (retry ${newRetry}, agent ${fallbackAgent})`, { runId: step.run_id });
  } catch (fallbackErr) {
    logger.warn(`[failStep] Fallback cron creation failed: ${String(fallbackErr)} — normal retry will still work`, { runId: step.run_id });
  }
}
