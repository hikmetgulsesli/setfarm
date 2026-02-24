import { getDb } from "../db.js";
import type { LoopConfig, Story } from "./types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync, execFileSync } from "node:child_process";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import { emitEvent } from "./events.js";
import { logger } from "../lib/logger.js";
import { getMaxRoleTimeoutSeconds } from "./install.js";
import { isFrontendChange } from "../lib/frontend-detect.js";

// --- Git worktree helpers for parallel story isolation ---
function createStoryWorktree(repo: string, storyId: string, baseBranch: string): string {
  const worktreeDir = path.join(repo, ".worktrees", storyId.toLowerCase());
  try {
    // Ensure .worktrees dir exists
    fs.mkdirSync(path.join(repo, ".worktrees"), { recursive: true });
    // Remove leftover worktree if exists (from failed previous run)
    try { execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], { cwd: repo, timeout: 10000, stdio: "pipe" }); } catch {}
    try { execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" }); } catch {}
    // Create fresh worktree with new branch from base
    execFileSync("git", ["worktree", "add", worktreeDir, "-b", storyId.toLowerCase(), baseBranch], { cwd: repo, timeout: 30000, stdio: "pipe" });
    // Symlink node_modules to avoid reinstall per story
    const nmSrc = path.join(repo, "node_modules");
    const nmDst = path.join(worktreeDir, "node_modules");
    if (fs.existsSync(nmSrc) && !fs.existsSync(nmDst)) {
      fs.symlinkSync(nmSrc, nmDst);
    }
    logger.info(`[worktree] Created ${worktreeDir} from ${baseBranch}`, {});
    return worktreeDir;
  } catch (err: any) {
    // Branch might already exist — try without -b
    try {
      execFileSync("git", ["worktree", "add", worktreeDir, storyId.toLowerCase()], { cwd: repo, timeout: 30000, stdio: "pipe" });
      const nmSrc = path.join(repo, "node_modules");
      const nmDst = path.join(worktreeDir, "node_modules");
      if (fs.existsSync(nmSrc) && !fs.existsSync(nmDst)) {
        fs.symlinkSync(nmSrc, nmDst);
      }
      logger.info(`[worktree] Created ${worktreeDir} (existing branch)`, {});
      return worktreeDir;
    } catch (err2: any) {
      logger.warn(`[worktree] Failed to create worktree: ${(err2.message || "").slice(0, 100)}`, {});
      return "";
    }
  }
}

function removeStoryWorktree(repo: string, storyId: string): void {
  const worktreeDir = path.join(repo, ".worktrees", storyId.toLowerCase());
  try {
    // Remove node_modules symlink first (git worktree remove doesn't handle symlinks well)
    const nmLink = path.join(worktreeDir, "node_modules");
    try { fs.unlinkSync(nmLink); } catch {}
    execFileSync("git", ["worktree", "remove", worktreeDir, "--force"], { cwd: repo, timeout: 10000, stdio: "pipe" });
    execFileSync("git", ["worktree", "prune"], { cwd: repo, timeout: 5000, stdio: "pipe" });
    logger.info(`[worktree] Removed ${worktreeDir}`, {});
  } catch (err: any) {
    // Item 12: Log worktree cleanup errors instead of silently swallowing
    logger.error(`[worktree] Failed to remove ${worktreeDir}: ${(err.message || "").slice(0, 200)}`, {});
  }
}

/**
 * Parse KEY: value lines from step output with support for multi-line values.
 * Accumulates continuation lines until the next KEY: boundary or end of output.
 * Returns a map of lowercase keys to their (trimmed) values.
 * Skips STORIES_JSON keys (handled separately).
 */
export function parseOutputKeyValues(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = output.split("\n");
  let pendingKey: string | null = null;
  let pendingValue = "";

  function commitPending() {
    if (pendingKey && !pendingKey.startsWith("STORIES_JSON")) {
      result[pendingKey.toLowerCase()] = pendingValue.trim();
    }
    pendingKey = null;
    pendingValue = "";
  }

  for (const line of lines) {
    const match = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (match) {
      // New KEY: line found — flush previous key
      commitPending();
      pendingKey = match[1];
      pendingValue = match[2];
    } else if (pendingKey) {
      // Continuation line — append to current key's value
      pendingValue += "\n" + line;
    }
  }
  // Flush any remaining pending value
  commitPending();

  return result;
}

/**
 * Fire-and-forget cron teardown when a run ends.
 * Looks up the workflow_id for the run and tears down crons if no other active runs.
 */
function scheduleRunCronTeardown(runId: string): void {
  try {
    const db = getDb();
    const run = db.prepare("SELECT workflow_id FROM runs WHERE id = ?").get(runId) as { workflow_id: string } | undefined;
    if (run) {
      // Item 13: Log cron teardown errors instead of silently swallowing
      teardownWorkflowCronsIfIdle(run.workflow_id).catch((err) => {
        logger.error(`Cron teardown failed for workflow ${run.workflow_id}: ${String(err)}`, { runId });
      });
    }
  } catch {
    // best-effort
  }
}

function getWorkflowId(runId: string): string | undefined {
  try {
    const db = getDb();
    const row = db.prepare("SELECT workflow_id FROM runs WHERE id = ?").get(runId) as { workflow_id: string } | undefined;
    return row?.workflow_id;
  } catch { return undefined; }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Resolve {{key}} placeholders in a template against a context object.
 */
export function resolveTemplate(template: string, context: Record<string, string>): string {
  // Supports {{key}}, {{key|default_value}}, and {{key.sub}}
  return template.replace(/\{\{(\w+(?:\.\w+)*)(?:\|([^}]*))?\}\}/g, (_match, key: string, defaultVal?: string) => {
    if (key in context) return context[key];
    const lower = key.toLowerCase();
    if (lower in context) return context[lower];
    // If a default was provided via {{key|default}}, use it instead of [missing:]
    if (defaultVal !== undefined) return defaultVal;
    return `[missing: ${key}]`;
  });
}

/**
 * Get the workspace path for an OpenClaw agent by its id.
 */
function getAgentWorkspacePath(agentId: string): string | null {
  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const agent = config.agents?.list?.find((a: any) => a.id === agentId);
    return agent?.workspace ?? null;
  } catch {
    return null;
  }
}

/**
 * Read progress.txt from the loop step's agent workspace.
 */
function readProgressFile(runId: string): string {
  const db = getDb();
  const loopStep = db.prepare(
    "SELECT agent_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(runId) as { agent_id: string } | undefined;
  if (!loopStep) return "(no progress file)";
  const workspace = getAgentWorkspacePath(loopStep.agent_id);
  if (!workspace) return "(no progress file)";
  try {
    // Only use run-scoped progress file (no legacy fallback)
    const scopedPath = path.join(workspace, `progress-${runId}.txt`);
    if (!fs.existsSync(scopedPath)) return "(no progress yet)";
    return fs.readFileSync(scopedPath, "utf-8");
  } catch {
    return "(no progress yet)";
  }
}

/**
 * Get all stories for a run, ordered by story_index.
 */
export function getStories(runId: string): Story[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM stories WHERE run_id = ? ORDER BY story_index ASC"
  ).all(runId) as any[];
  return rows.map(r => ({
    id: r.id,
    runId: r.run_id,
    storyIndex: r.story_index,
    storyId: r.story_id,
    title: r.title,
    description: r.description,
    acceptanceCriteria: JSON.parse(r.acceptance_criteria),
    status: r.status,
    output: r.output ?? undefined,
    retryCount: r.retry_count,
    maxRetries: r.max_retries,
  }));
}

/**
 * Get the story currently being worked on by a loop step.
 */
export function getCurrentStory(stepId: string): Story | null {
  const db = getDb();
  const step = db.prepare(
    "SELECT current_story_id FROM steps WHERE id = ?"
  ).get(stepId) as { current_story_id: string | null } | undefined;
  if (!step?.current_story_id) return null;
  const row = db.prepare("SELECT * FROM stories WHERE id = ?").get(step.current_story_id) as any;
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    storyIndex: row.story_index,
    storyId: row.story_id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: JSON.parse(row.acceptance_criteria),
    status: row.status,
    output: row.output ?? undefined,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
  };
}

function formatStoryForTemplate(story: Story): string {
  const ac = story.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`).join("\n");
  return `Story ${story.storyId}: ${story.title}\n\n${story.description}\n\nAcceptance Criteria:\n${ac}`;
}

function formatCompletedStories(stories: Story[]): string {
  const completed = stories.filter(s => s.status === "done" || s.status === "skipped" || s.status === "verified");
  if (completed.length === 0) return "(none yet)";
  return completed.map(s => `- ${s.storyId}: ${s.title} [${s.status}]`).join("\n");
}

// ── T5: STORIES_JSON parsing ────────────────────────────────────────

/**
 * Parse STORIES_JSON from step output and insert stories into the DB.
 */
function parseAndInsertStories(output: string, runId: string): void {
  const lines = output.split("\n");
  const startIdx = lines.findIndex(l => l.startsWith("STORIES_JSON:"));
  if (startIdx === -1) return;

  // Dedup guard: if stories already exist for this run, skip insertion.
  // Prevents 3x duplication when multiple cron instances process the same output.
  const db0 = getDb();
  const existingCount = db0.prepare("SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?").get(runId);
  if (existingCount && (existingCount as any).cnt > 0) {
    logger.info("Stories already exist for run " + runId + ", skipping duplicate insertion");
    return;
  }

  // Collect JSON text: first line after prefix, then subsequent lines until next KEY: or end
  const firstLine = lines[startIdx].slice("STORIES_JSON:".length).trim();
  const jsonLines = [firstLine];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^[A-Z_]+:\s/.test(lines[i])) break;
    jsonLines.push(lines[i]);
  }

  const jsonText = jsonLines.join("\n").trim();
  let stories: any[];
  try {
    stories = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse STORIES_JSON: ${(e as Error).message}`);
  }

  if (!Array.isArray(stories)) {
    throw new Error("STORIES_JSON must be an array");
  }
  if (stories.length > 20) {
    throw new Error(`STORIES_JSON has ${stories.length} stories, max is 20`);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 3, ?, ?)"
  );

  const seenIds = new Set<string>();
  for (let i = 0; i < stories.length; i++) {
    const s = stories[i];
    // Accept both camelCase and snake_case
    const ac = s.acceptanceCriteria ?? s.acceptance_criteria;
    if (!s.id || !s.title || !s.description || !Array.isArray(ac) || ac.length === 0) {
      throw new Error(`STORIES_JSON story at index ${i} missing required fields (id, title, description, acceptanceCriteria)`);
    }
    if (seenIds.has(s.id)) {
      throw new Error(`STORIES_JSON has duplicate story id "${s.id}"`);
    }
    seenIds.add(s.id);
    insert.run(crypto.randomUUID(), runId, i, s.id, s.title, s.description, JSON.stringify(ac), now, now);
  }
}

// ── Abandoned Step Cleanup ──────────────────────────────────────────

const ABANDONED_THRESHOLD_MS = (getMaxRoleTimeoutSeconds() + 5 * 60) * 1000; // max role timeout + 5 min buffer
const MAX_ABANDON_RESETS = 5; // abandoned steps get more chances than explicit failures

/**
 * Find steps that have been "running" for too long and reset them to pending.
 * This catches cases where an agent claimed a step but never completed/failed it.
 * Exported so it can be called from medic/health-check crons independently of claimStep.
 */
export function cleanupAbandonedSteps(): void {
  const db = getDb();
  // Use numeric comparison so mixed timestamp formats don't break ordering.
  const thresholdMs = ABANDONED_THRESHOLD_MS;

  // Find running steps that haven't been updated recently
  const abandonedSteps = db.prepare(
    "SELECT id, step_id, run_id, retry_count, max_retries, type, current_story_id, loop_config, abandoned_count FROM steps WHERE status = 'running' AND (julianday('now') - julianday(updated_at)) * 86400000 > ?"
  ).all(thresholdMs) as { id: string; step_id: string; run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; loop_config: string | null; abandoned_count: number }[];

  for (const step of abandonedSteps) {
    if (step.type === "loop" && !step.current_story_id && step.loop_config) {
      try {
        const loopConfig: LoopConfig = JSON.parse(step.loop_config);
        if (loopConfig.verifyEach && loopConfig.verifyStep) {
          const verifyStatus = db.prepare(
            "SELECT status FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1"
          ).get(step.run_id, loopConfig.verifyStep) as { status: string } | undefined;
          if (verifyStatus?.status === "pending" || verifyStatus?.status === "running") {
            continue;
          }
        }
      } catch {
        // If loop config is malformed, fall through to abandonment handling.
      }
    }

    // Item 8: Loop steps — use abandoned_count, NOT retry_count (abandonment != agent failure)
    if (step.type === "loop" && step.current_story_id) {
      const story = db.prepare(
        "SELECT id, retry_count, max_retries, story_id, title, abandoned_count FROM stories WHERE id = ?"
      ).get(step.current_story_id) as { id: string; retry_count: number; max_retries: number; story_id: string; title: string; abandoned_count: number } | undefined;

      if (story) {
        const newAbandonCount = (story.abandoned_count ?? 0) + 1;
        const wfId = getWorkflowId(step.run_id);
        if (newAbandonCount >= MAX_ABANDON_RESETS) {
          db.prepare("UPDATE stories SET status = 'failed', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?").run(newAbandonCount, story.id);
          db.prepare("UPDATE steps SET status = 'failed', output = 'Story abandoned and abandon limit reached', current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(step.id);
          db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, storyId: story.story_id, storyTitle: story.title, detail: `Abandoned — abandon limit reached (${newAbandonCount}/${MAX_ABANDON_RESETS})` });
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Story abandoned and abandon limit reached" });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story abandoned and abandon limit reached" });
          scheduleRunCronTeardown(step.run_id);
        } else {
          db.prepare("UPDATE stories SET status = 'pending', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?").run(newAbandonCount, story.id);
          db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(step.id);
          emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Story ${story.story_id} abandoned — reset to pending (abandon ${newAbandonCount}/${MAX_ABANDON_RESETS})` });
          logger.info(`Abandoned step reset to pending (story abandon ${newAbandonCount})`, { runId: step.run_id, stepId: step.step_id });
        }
        continue;
      }
    }

    // Single steps (or loop steps without a current story): use abandoned_count, not retry_count
    const newAbandonCount = (step.abandoned_count ?? 0) + 1;
    if (newAbandonCount >= MAX_ABANDON_RESETS) {
      // Too many abandons — fail the step and run
      db.prepare(
        "UPDATE steps SET status = 'failed', output = 'Agent abandoned step without completing (' || ? || ' times)', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newAbandonCount, newAbandonCount, step.id);
      db.prepare(
        "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
      ).run(step.run_id);
      const wfId = getWorkflowId(step.run_id);
      emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Retries exhausted — step failed` });
      emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Agent abandoned step without completing" });
      emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Step abandoned and retries exhausted" });
      scheduleRunCronTeardown(step.run_id);
    } else {
      // Reset to pending for retry — do NOT increment retry_count (abandonment != explicit failure)
      db.prepare(
        "UPDATE steps SET status = 'pending', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newAbandonCount, step.id);
      emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, detail: `Reset to pending (abandon ${newAbandonCount}/${MAX_ABANDON_RESETS})` });
    }
  }

  // Reset running stories that are abandoned — don't touch "done" stories
  // Don't increment retry_count for abandonment; only explicit failStep() counts against retries
  const abandonedStories = db.prepare(
    "SELECT id, retry_count, max_retries, run_id FROM stories WHERE status = 'running' AND (julianday('now') - julianday(updated_at)) * 86400000 > ?"
  ).all(thresholdMs) as { id: string; retry_count: number; max_retries: number; run_id: string }[];

  for (const story of abandonedStories) {
    // Simply reset to pending without incrementing retry_count
    db.prepare("UPDATE stories SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(story.id);
  }

  // Recover stuck pipelines: loop step done but no subsequent step pending/running
  const stuckLoops = db.prepare(`
    SELECT s.id, s.run_id, s.step_index FROM steps s
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
    )
  `).all() as { id: string; run_id: string; step_index: number }[];

  for (const stuck of stuckLoops) {
    logger.info(`Recovering stuck pipeline after loop completion`, { runId: stuck.run_id, stepId: stuck.id });
    advancePipeline(stuck.run_id);
  }
}

// ── Frontend change detection ───────────────────────────────────────

/**
 * Compute whether a branch has frontend changes relative to main.
 * Returns 'true' or 'false' as a string for template context.
 */
export function computeHasFrontendChanges(repo: string, branch: string): string {
  try {
    const output = execFileSync("git", ["diff", "--name-only", `main..${branch}`], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 10_000,
    });
    const files = output.trim().split("\n").filter(f => f.length > 0);
    return isFrontendChange(files) ? "true" : "false";
  } catch {
    return "false";
  }
}

// ── Peek (lightweight work check) ───────────────────────────────────

export type PeekResult = "HAS_WORK" | "NO_WORK";

/**
 * Lightweight check: does this agent have any pending/waiting steps in active runs?
 * Unlike claimStep(), this runs a single cheap COUNT query — no cleanup, no context resolution.
 * Returns "HAS_WORK" if any pending/waiting steps exist, "NO_WORK" otherwise.
 */
export function peekStep(agentId: string): PeekResult {
  const db = getDb();
  // Count pending/waiting steps, PLUS running loop steps that still have pending stories
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM steps s
     JOIN runs r ON r.id = s.run_id
     WHERE s.agent_id = ? AND r.status = 'running'
       AND (
         s.status IN ('pending', 'waiting')
         OR (s.status = 'running' AND s.type = 'loop'
             AND EXISTS (SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'pending'))
       )`
  ).get(agentId) as { cnt: number };
  return row.cnt > 0 ? "HAS_WORK" : "NO_WORK";
}

// ── Claim ───────────────────────────────────────────────────────────

interface ClaimResult {
  found: boolean;
  stepId?: string;
  runId?: string;
  resolvedInput?: string;
}

/**
 * Throttle cleanupAbandonedSteps: run at most once every 5 minutes.
 */
let lastCleanupTime = 0;
const CLEANUP_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Find and claim a pending step for an agent, returning the resolved input.
 */
export function claimStep(agentId: string): ClaimResult {
  // Throttle cleanup: run at most once every 5 minutes across all agents
  const now = Date.now();
  if (now - lastCleanupTime >= CLEANUP_THROTTLE_MS) {
    cleanupAbandonedSteps();
    lastCleanupTime = now;
  }
  const db = getDb();

  // Allow claiming from both pending AND running loop steps (parallel story execution)
  const step = db.prepare(
    `SELECT s.id, s.step_id, s.run_id, s.input_template, s.type, s.loop_config, s.status as step_status
     FROM steps s
     JOIN runs r ON r.id = s.run_id
     WHERE s.agent_id = ?
       AND (s.status = 'pending' OR (s.status = 'running' AND s.type = 'loop'))
       AND r.status NOT IN ('failed', 'cancelled')
       AND NOT EXISTS (
         SELECT 1 FROM steps prev
         WHERE prev.run_id = s.run_id
           AND prev.step_index < s.step_index
           AND prev.status NOT IN ('done', 'skipped', 'verified')
           AND NOT (prev.type = 'loop' AND prev.status = 'running')
       )
     ORDER BY s.step_index ASC, s.status ASC
     LIMIT 1`
  ).get(agentId) as { id: string; step_id: string; run_id: string; input_template: string; type: string; loop_config: string | null; step_status: string } | undefined;

  if (!step) return { found: false };

  // Guard: don't claim work for a failed run
  const runStatus = db.prepare("SELECT status FROM runs WHERE id = ?").get(step.run_id) as { status: string } | undefined;
  if (runStatus?.status === "failed") return { found: false };

  // Get run context
  const run = db.prepare("SELECT context FROM runs WHERE id = ?").get(step.run_id) as { context: string } | undefined;
  const context: Record<string, string> = run ? JSON.parse(run.context) : {};

  // Always inject run_id so templates can use {{run_id}} (e.g. for scoped progress files)
  context["run_id"] = step.run_id;

  // Compute has_frontend_changes from git diff when repo and branch are available
  if (context["repo"] && context["branch"]) {
    context["has_frontend_changes"] = computeHasFrontendChanges(context["repo"], context["branch"]);
  } else {
    context["has_frontend_changes"] = "false";
  }

  // T6: Loop step claim logic
  if (step.type === "loop") {
    const loopConfig: LoopConfig | null = step.loop_config ? JSON.parse(step.loop_config) : null;
    if (loopConfig?.over === "stories") {
      // Find next pending story
      const nextStory = db.prepare(
        "SELECT * FROM stories WHERE run_id = ? AND status = 'pending' ORDER BY story_index ASC LIMIT 1"
      ).get(step.run_id) as any | undefined;

      if (!nextStory) {
        const failedStory = db.prepare(
          "SELECT id FROM stories WHERE run_id = ? AND status = 'failed' LIMIT 1"
        ).get(step.run_id) as { id: string } | undefined;

        if (failedStory) {
          // v9.0: Skip failed stories instead of failing the loop
          db.prepare("UPDATE stories SET status = 'skipped', updated_at = datetime('now') WHERE run_id = ? AND status = 'failed'").run(step.run_id);
          const wfId = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "story.skipped", runId: step.run_id, workflowId: wfId, stepId: step.id, agentId: agentId, detail: "Failed stories skipped — loop continues" });
        }

        // Check if other stories are still running in parallel
        const runningStory = db.prepare(
          "SELECT id FROM stories WHERE run_id = ? AND status = 'running'"
        ).get(step.run_id);
        if (runningStory) {
          return { found: false }; // Other stories still running, wait for them
        }

        // #157 GUARD: 0 total stories means planner did not produce STORIES_JSON
        const totalStories = db.prepare(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?"
        ).get(step.run_id) as { cnt: number };
        if (totalStories.cnt === 0) {
          const noStoriesReason = "No stories exist — planner did not produce STORIES_JSON";
          logger.warn(noStoriesReason, { runId: step.run_id, stepId: step.step_id });
          db.prepare(
            "UPDATE steps SET status = 'failed', output = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(noStoriesReason, step.id);
          db.prepare(
            "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
          ).run(step.run_id);
          const wfId157 = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId157, stepId: step.step_id, detail: noStoriesReason });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId157, detail: noStoriesReason });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // No pending, running, or failed stories — mark step done and advance
        db.prepare(
          "UPDATE steps SET status = 'done', updated_at = datetime('now') WHERE id = ?"
        ).run(step.id);
        emitEvent({ ts: new Date().toISOString(), event: "step.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
        advancePipeline(step.run_id);
        return { found: false };
      }

      // PARALLEL LIMIT: Don't exceed max concurrent running stories
      const runningStoryCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ? AND status = 'running'"
      ).get(step.run_id) as { cnt: number };
      const parallelLimit = loopConfig?.parallelCount ?? 3;
      if (runningStoryCount.cnt >= parallelLimit) {
        return { found: false }; // At capacity, wait for running stories to finish
      }

      // STORY INDEX ORDERING: Don't claim story N if earlier stories (index < N) are still pending/failed
      const blockerStory = db.prepare(
        "SELECT id FROM stories WHERE run_id = ? AND story_index < ? AND status NOT IN ('done', 'verified', 'skipped', 'running') LIMIT 1"
      ).get(step.run_id, nextStory.story_index) as { id: string } | undefined;
      if (blockerStory) {
        return { found: false }; // Earlier stories not yet started — respect ordering
      }

      // GIT WORKTREE ISOLATION: Each story gets its own working directory.
      // Parallel crons can safely run different stories simultaneously.
      const storyBranch = nextStory.story_id.toLowerCase();
      let storyWorkdir = "";
      if (context["repo"]) {
        storyWorkdir = createStoryWorktree(context["repo"], storyBranch, context["branch"] || "master");
      }
      context["story_workdir"] = storyWorkdir || context["repo"] || "";

      // Transactional story claim — prevents parallel crons from double-claiming
      db.exec("BEGIN IMMEDIATE");
      // Re-check story is still pending inside transaction
      const storyCheck = db.prepare(
        "SELECT status FROM stories WHERE id = ? AND status = 'pending'"
      ).get(nextStory.id) as { status: string } | undefined;
      if (!storyCheck) {
        db.exec("COMMIT");
        // Another cron already claimed this story — return no work (will retry next cron tick)
        return { found: false };
      }
      db.prepare(
        "UPDATE stories SET status = 'running', updated_at = datetime('now') WHERE id = ?"
      ).run(nextStory.id);
      db.prepare(
        "UPDATE steps SET status = 'running', current_story_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(nextStory.id, step.id);
      db.exec("COMMIT");

      const wfId = getWorkflowId(step.run_id);
      emitEvent({ ts: new Date().toISOString(), event: "step.running", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId });
      emitEvent({ ts: new Date().toISOString(), event: "story.started", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, storyId: nextStory.story_id, storyTitle: nextStory.title });
      logger.info(`Story started: ${nextStory.story_id} — ${nextStory.title}`, { runId: step.run_id, stepId: step.step_id });

      // Build story template vars
      const story: Story = {
        id: nextStory.id,
        runId: nextStory.run_id,
        storyIndex: nextStory.story_index,
        storyId: nextStory.story_id,
        title: nextStory.title,
        description: nextStory.description,
        acceptanceCriteria: JSON.parse(nextStory.acceptance_criteria),
        status: nextStory.status,
        output: nextStory.output ?? undefined,
        retryCount: nextStory.retry_count,
        maxRetries: nextStory.max_retries,
      };

      const allStories = getStories(step.run_id);
      const pendingCount = allStories.filter(s => s.status === "pending" || s.status === "running").length;

      context["current_story"] = formatStoryForTemplate(story);
      context["current_story_id"] = story.storyId;
      context["current_story_title"] = story.title;
      context["completed_stories"] = formatCompletedStories(allStories);
      context["stories_remaining"] = String(pendingCount);
      context["progress"] = readProgressFile(step.run_id);

      // FALLBACK: Ensure story_branch defaults to story ID if developer forgot to output it
      if (!context["story_branch"]) {
        context["story_branch"] = story.storyId.toLowerCase();
      }

      if (!context["verify_feedback"]) {
        context["verify_feedback"] = "";
      }

      // Persist story context vars to DB so verify_each steps can access them
      db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(context), step.run_id);

      let resolvedInput = resolveTemplate(step.input_template, context);

      // Item 7: MISSING_INPUT_GUARD inside claim flow — also reset the claimed story on failure
      const allMissing = [...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase());
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input — failing step and run`;
        logger.warn(reason, { runId: step.run_id, stepId: step.step_id });
        // Fail the story that was just claimed
        db.prepare(
          "UPDATE stories SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
        ).run(nextStory.id);
        db.prepare(
          "UPDATE steps SET status = 'failed', output = ?, current_story_id = NULL, updated_at = datetime('now') WHERE id = ?"
        ).run(reason, step.id);
        db.prepare(
          "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
        ).run(step.run_id);
        const wfId2 = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: step.step_id, detail: reason });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: reason });
        // Clean up the worktree we just created
        if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch);
        scheduleRunCronTeardown(step.run_id);
        return { found: false };
      }


      return { found: true, stepId: step.id, runId: step.run_id, resolvedInput };
    }
  }

  // Item 6: Single step — atomic claim with changes check to prevent race condition
  const claimResult = db.prepare(
    "UPDATE steps SET status = 'running', updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
  ).run(step.id);
  if (claimResult.changes === 0) {
    // Already claimed by another cron — return no work
    return { found: false };
  }
  emitEvent({ ts: new Date().toISOString(), event: "step.running", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
  logger.info(`Step claimed by ${agentId}`, { runId: step.run_id, stepId: step.step_id });

  // Inject progress for any step in a run that has stories
  const hasStories = db.prepare(
    "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?"
  ).get(step.run_id) as { cnt: number };
  if (hasStories.cnt > 0) {
    context["progress"] = readProgressFile(step.run_id);
  }

  // BUG FIX: If this is a verify step for a verify_each loop, inject the correct
  // story info from the oldest unverified 'done' story (not from stale context).
  // This prevents parallel developers from overwriting each other's story context.
  const loopStepForVerify = db.prepare(
    "SELECT loop_config FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(step.run_id) as { loop_config: string | null } | undefined;
  if (loopStepForVerify?.loop_config) {
    const lcCheck: LoopConfig = JSON.parse(loopStepForVerify.loop_config);
    if (lcCheck.verifyEach && lcCheck.verifyStep === step.step_id) {
      const nextUnverified = db.prepare(
        "SELECT * FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1"
      ).get(step.run_id) as any | undefined;
      if (nextUnverified?.output) {
        // Parse story's own output to get its story_branch, pr_url, etc.
        const storyOutput = parseOutputKeyValues(nextUnverified.output);
        for (const [key, value] of Object.entries(storyOutput)) {
          context[key] = value;
        }
        context["current_story_id"] = nextUnverified.story_id;
        context["current_story_title"] = nextUnverified.title;
        const storyObj: Story = {
          id: nextUnverified.id, runId: nextUnverified.run_id,
          storyIndex: nextUnverified.story_index, storyId: nextUnverified.story_id,
          title: nextUnverified.title, description: nextUnverified.description,
          acceptanceCriteria: JSON.parse(nextUnverified.acceptance_criteria),
          status: nextUnverified.status, output: nextUnverified.output,
          retryCount: nextUnverified.retry_count, maxRetries: nextUnverified.max_retries,
        };
        context["current_story"] = formatStoryForTemplate(storyObj);
        db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify(context), step.run_id);
        logger.info(`Verify step: injected story ${nextUnverified.story_id} context`, { runId: step.run_id });
      }
    }
  }

  let resolvedInput = resolveTemplate(step.input_template, context);

      // MISSING_INPUT_GUARD: Any [missing:] marker means upstream didn't produce required output.
      // Fail the step AND run — downstream steps would be meaningless.
      const allMissing = [...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase());
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input — failing step and run`;
        logger.warn(reason, { runId: step.run_id, stepId: step.step_id });
        db.prepare(
          "UPDATE steps SET status = 'failed', output = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(reason, step.id);
        db.prepare(
          "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
        ).run(step.run_id);
        const wfId = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: reason });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: reason });
        scheduleRunCronTeardown(step.run_id);
        return { found: false };
      }

  return {
    found: true,
    stepId: step.id,
    runId: step.run_id,
    resolvedInput,
  };
}

// ── Complete ────────────────────────────────────────────────────────

/**
 * Complete a step: save output, merge context, advance pipeline.
 */
export function completeStep(stepId: string, output: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();

  const step = db.prepare(
    "SELECT id, run_id, step_id, step_index, type, loop_config, current_story_id FROM steps WHERE id = ?"
  ).get(stepId) as { id: string; run_id: string; step_id: string; step_index: number; type: string; loop_config: string | null; current_story_id: string | null } | undefined;

  if (!step) throw new Error(`Step not found: ${stepId}`);

  // Guard: don't process completions for failed runs
  const runCheck = db.prepare("SELECT status FROM runs WHERE id = ?").get(step.run_id) as { status: string } | undefined;
  if (runCheck?.status === "failed") {
    return { advanced: false, runCompleted: false };
  }

  // Merge KEY: value lines into run context
  const run = db.prepare("SELECT context FROM runs WHERE id = ?").get(step.run_id) as { context: string };
  const context: Record<string, string> = JSON.parse(run.context);

  // Parse KEY: value lines and merge into context
  const parsed = parseOutputKeyValues(output);
  for (const [key, value] of Object.entries(parsed)) {
    context[key] = value;
  }

  // No fallback extraction — if upstream didn't output required keys,
  // the missing input guard will catch it and fail cleanly.

  // TEST FAILURE GUARDRAIL: Reject completion if agent claims STATUS: done
  // but output contains clear test failure patterns (e.g. "Tests: 73 failed").
  // This prevents merging to main with failing tests.
  if (parsed["status"]?.toLowerCase() === "done") {
    const testFailPatterns = [
      /Tests?:\s+(\d+)\s+failed/i,           // Jest: "Tests: 73 failed"
      /Test Suites?:\s+(\d+)\s+failed/i,      // Jest: "Test Suites: 5 failed"
      /(\d+)\s+tests?\s+failed/i,             // Generic: "73 tests failed"
      /(\d+)\s+failing\b/i,                   // Mocha: "73 failing"
    ];
    for (const pat of testFailPatterns) {
      const m = output.match(pat);
      if (m && parseInt(m[1], 10) > 0) {
        const failCount = parseInt(m[1], 10);
        logger.warn(`Test guardrail: ${failCount} test failures detected despite STATUS: done`, { runId: step.run_id, stepId: step.step_id });
        failStep(stepId, `GUARDRAIL: ${failCount} test failure(s) detected in output. Agent reported STATUS: done but tests are failing. Fix all tests before completing.`);
        return { advanced: false, runCompleted: false };
      }
    }
  }

  db.prepare(
    "UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(context), step.run_id);

  // T5: Parse STORIES_JSON from output (any step, typically the planner)
  parseAndInsertStories(output, step.run_id);

  // #157 GUARD: If a downstream loop step expects stories, verify they exist
  const nextLoopStep = db.prepare(
    "SELECT id, step_id FROM steps WHERE run_id = ? AND type = 'loop' AND step_index > ? AND status = 'waiting' ORDER BY step_index ASC LIMIT 1"
  ).get(step.run_id, step.step_index) as { id: string; step_id: string } | undefined;
  if (nextLoopStep) {
    const storyCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?"
    ).get(step.run_id) as { cnt: number };
    if (storyCount.cnt === 0) {
      const noStoriesMsg = "Step completed but produced no STORIES_JSON — downstream loop would run with 0 stories";
      logger.warn(noStoriesMsg, { runId: step.run_id, stepId: step.step_id });
      db.prepare("UPDATE steps SET status = 'failed', output = ?, updated_at = datetime('now') WHERE id = ?").run(noStoriesMsg, step.id);
      db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(step.run_id);
      const wfId157b = getWorkflowId(step.run_id);
      emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId157b, stepId: step.step_id, detail: noStoriesMsg });
      emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId157b, detail: noStoriesMsg });
      scheduleRunCronTeardown(step.run_id);
      return { advanced: false, runCompleted: false };
    }
  }

  // T7: Loop step completion
  if (step.type === "loop" && step.current_story_id) {
    // Look up story info for event
    const storyRow = db.prepare("SELECT story_id, title FROM stories WHERE id = ?").get(step.current_story_id) as { story_id: string; title: string } | undefined;

    // v9.0: Check if agent output STATUS: skip — mark story as skipped instead of done
    const statusVal = parsed["status"]?.toLowerCase();
    const storyStatus = statusVal === "skip" ? "skipped" : "done";
    const storyEvent = statusVal === "skip" ? "story.skipped" : "story.done";

    // Mark current story done or skipped
    db.prepare(
      "UPDATE stories SET status = ?, output = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(storyStatus, output, step.current_story_id);
    emitEvent({ ts: new Date().toISOString(), event: storyEvent, runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title });
    logger.info(`Story ${storyStatus}: ${storyRow?.story_id} — ${storyRow?.title}`, { runId: step.run_id, stepId: step.step_id });

    // Clean up git worktree for completed story
    if (storyRow?.story_id && context["repo"]) {
      removeStoryWorktree(context["repo"], storyRow.story_id);
    }

    // Clear current_story_id, save output
    db.prepare(
      "UPDATE steps SET current_story_id = NULL, output = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(output, step.id);

    const loopConfig: LoopConfig | null = step.loop_config ? JSON.parse(step.loop_config) : null;

    // T8: verify_each flow — set verify step to pending
    if (loopConfig?.verifyEach && loopConfig.verifyStep) {
      const verifyStep = db.prepare(
        "SELECT id FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1"
      ).get(step.run_id, loopConfig.verifyStep) as { id: string } | undefined;

      if (verifyStep) {
        // Only set verify to pending if not already pending/running (prevents race condition with parallel stories)
        db.prepare(
          "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ? AND status IN ('waiting', 'done')"
        ).run(verifyStep.id);
        // Loop step stays 'running'
        db.prepare(
          "UPDATE steps SET status = 'running', updated_at = datetime('now') WHERE id = ?"
        ).run(step.id);
        return { advanced: false, runCompleted: false };
      }
    }

    // No verify_each: check for more stories
    return checkLoopContinuation(step.run_id, step.id);
  }

  // T8: Check if this is a verify step triggered by verify-each
  // NOTE: Don't filter by status='running' — the loop step may have been temporarily
  // reset by cleanupAbandonedSteps, causing this to fall through to single-step path (#52)
  const loopStepRow = db.prepare(
    "SELECT id, loop_config, run_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(step.run_id) as { id: string; loop_config: string | null; run_id: string } | undefined;

  if (loopStepRow?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStepRow.loop_config);
    if (lc.verifyEach && lc.verifyStep === step.step_id) {
      return handleVerifyEachCompletion(step, loopStepRow.id, output, context);
    }
  }

  // Single step: mark done (idempotency guard — only complete if still running)
  const updateResult = db.prepare(
    "UPDATE steps SET status = 'done', output = ?, updated_at = datetime('now') WHERE id = ? AND status = 'running'"
  ).run(output, stepId);
  if (updateResult.changes === 0) {
    // Already completed by another session — skip to prevent double pipeline advancement
    logger.info(`Step already completed, skipping duplicate`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }
  emitEvent({ ts: new Date().toISOString(), event: "step.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id });
  logger.info(`Step completed: ${step.step_id}`, { runId: step.run_id, stepId: step.step_id });

  // Guard: if a loop step is still active (not done), don't advance the pipeline.
  // During verify_each cycles, single steps (test, pr, review, etc.) may get claimed
  // and completed — advancing would skip the loop and break story iteration.
  const activeLoop = db.prepare(
    "SELECT id FROM steps WHERE run_id = ? AND type = 'loop' AND status NOT IN ('done', 'failed', 'waiting') LIMIT 1"
  ).get(step.run_id) as { id: string } | undefined;
  if (activeLoop) {
    logger.info(`Skipping advancePipeline — loop step still active`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  return advancePipeline(step.run_id);
}

/**
 * Handle verify-each completion: pass or fail the story.
 */
function handleVerifyEachCompletion(
  verifyStep: { id: string; run_id: string; step_id: string; step_index: number },
  loopStepId: string,
  output: string,
  context: Record<string, string>
): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();
  const status = context["status"]?.toLowerCase();

  // Reset verify step to waiting for next use
  db.prepare(
    "UPDATE steps SET status = 'waiting', output = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(output, verifyStep.id);

  // Identify the story being verified using context (not just last done)
  const verifiedStoryId = context["current_story_id"];

  if (status === "retry") {
    // Verify failed — retry the story
    // Find the specific story that was being verified
    let retryStory: { id: string; retry_count: number; max_retries: number } | undefined;
    if (verifiedStoryId) {
      retryStory = db.prepare(
        "SELECT id, retry_count, max_retries FROM stories WHERE run_id = ? AND story_id = ? AND status = 'done' LIMIT 1"
      ).get(verifyStep.run_id, verifiedStoryId) as typeof retryStory;
    }
    // Fallback: last done story by updated_at
    if (!retryStory) {
      retryStory = db.prepare(
        "SELECT id, retry_count, max_retries FROM stories WHERE run_id = ? AND status = 'done' ORDER BY updated_at DESC LIMIT 1"
      ).get(verifyStep.run_id) as typeof retryStory;
    }

    if (retryStory) {
      const newRetry = retryStory.retry_count + 1;
      if (newRetry > retryStory.max_retries) {
        // Story retries exhausted — fail everything
        db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, retryStory.id);
        db.prepare("UPDATE steps SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(loopStepId);
        db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(verifyStep.run_id);
        const wfId = getWorkflowId(verifyStep.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: verifyStep.run_id, workflowId: wfId, stepId: verifyStep.step_id });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: verifyStep.run_id, workflowId: wfId, detail: "Verification retries exhausted" });
        scheduleRunCronTeardown(verifyStep.run_id);
        return { advanced: false, runCompleted: false };
      }

      // Set story back to pending for retry
      db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, retryStory.id);

      // Store verify feedback
      const issues = context["issues"] ?? output;
      context["verify_feedback"] = issues;
      emitEvent({ ts: new Date().toISOString(), event: "story.retry", runId: verifyStep.run_id, workflowId: getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, detail: issues });
      db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(context), verifyStep.run_id);
    }

    // Set loop step back to pending for retry
    db.prepare("UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(loopStepId);
    return { advanced: false, runCompleted: false };
  }

  // Verify PASSED — mark the verified story as 'verified' (not just 'done')
  if (verifiedStoryId) {
    const verifiedRow = db.prepare(
      "SELECT id FROM stories WHERE run_id = ? AND story_id = ? AND status = 'done' LIMIT 1"
    ).get(verifyStep.run_id, verifiedStoryId) as { id: string } | undefined;
    if (verifiedRow) {
      db.prepare("UPDATE stories SET status = 'verified', updated_at = datetime('now') WHERE id = ?").run(verifiedRow.id);
      logger.info(`Story verified: ${verifiedStoryId}`, { runId: verifyStep.run_id });
    }
  }
  emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: verifyStep.run_id, workflowId: getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, storyId: verifiedStoryId });

  // Clear feedback
  delete context["verify_feedback"];

  // Check for more unverified 'done' stories before checking loop continuation
  const nextUnverifiedStory = db.prepare(
    "SELECT id, story_id, output FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1"
  ).get(verifyStep.run_id) as { id: string; story_id: string; output: string | null } | undefined;

  if (nextUnverifiedStory?.output) {
    // More stories need verification — inject next story's info and cycle verify
    const storyOut = parseOutputKeyValues(nextUnverifiedStory.output);
    for (const [key, value] of Object.entries(storyOut)) {
      context[key] = value;
    }
    context["current_story_id"] = nextUnverifiedStory.story_id;
    db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(context), verifyStep.run_id);

    // Set verify step to pending for next story
    db.prepare("UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?")
      .run(verifyStep.id);
    logger.info(`Verify cycling to next unverified story: ${nextUnverifiedStory.story_id}`, { runId: verifyStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  // No more unverified stories — persist context and check loop continuation
  db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(context), verifyStep.run_id);

  try {
    return checkLoopContinuation(verifyStep.run_id, loopStepId);
  } catch (err) {
    logger.error(`checkLoopContinuation failed, recovering: ${String(err)}`, { runId: verifyStep.run_id });
    // Ensure loop step is at least pending so cron can retry
    db.prepare("UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(loopStepId);
    return { advanced: false, runCompleted: false };
  }
}

/**
 * Check if the loop has more stories; if so set loop step pending, otherwise done + advance.
 */
function checkLoopContinuation(runId: string, loopStepId: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();
  const pendingStory = db.prepare(
    "SELECT id FROM stories WHERE run_id = ? AND status = 'pending' LIMIT 1"
  ).get(runId) as { id: string } | undefined;

  const loopStatus = db.prepare(
    "SELECT status FROM steps WHERE id = ?"
  ).get(loopStepId) as { status: string } | undefined;

  if (pendingStory) {
    if (loopStatus?.status === "failed") {
      return { advanced: false, runCompleted: false };
    }
    // More stories pending — keep step available for parallel claims
    // Only set to pending if not already running (don't interrupt parallel stories)
    if (loopStatus?.status !== "running") {
      db.prepare(
          "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?"
      ).run(loopStepId);
    }
    return { advanced: false, runCompleted: false };
  }

  // No pending stories — check if any are still running (parallel execution)
  const runningStory = db.prepare(
    "SELECT id FROM stories WHERE run_id = ? AND status = 'running' LIMIT 1"
  ).get(runId) as { id: string } | undefined;

  if (runningStory) {
    // Other stories still running in parallel — wait for them
    return { advanced: false, runCompleted: false };
  }

  // BUG FIX: Check for unverified 'done' stories — these still need verify_each processing.
  // Without this check, parallel story completion causes the loop to end prematurely,
  // leaving stories implemented but never verified/merged.
  const loopStepConfig = db.prepare("SELECT loop_config FROM steps WHERE id = ?").get(loopStepId) as { loop_config: string | null } | undefined;
  if (loopStepConfig?.loop_config) {
    const lcForCheck: LoopConfig = JSON.parse(loopStepConfig.loop_config);
    if (lcForCheck.verifyEach && lcForCheck.verifyStep) {
      const unverifiedStory = db.prepare(
        "SELECT id FROM stories WHERE run_id = ? AND status = 'done' LIMIT 1"
      ).get(runId) as { id: string } | undefined;
      if (unverifiedStory) {
        // Stories need verification — set verify step to pending
        db.prepare(
          "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE run_id = ? AND step_id = ? AND status IN ('waiting', 'done')"
        ).run(runId, lcForCheck.verifyStep);
        logger.info(`Loop has unverified stories — keeping verify active`, { runId });
        return { advanced: false, runCompleted: false };
      }
    }
  }

  const failedStory = db.prepare(
    "SELECT id FROM stories WHERE run_id = ? AND status = 'failed' LIMIT 1"
  ).get(runId) as { id: string } | undefined;

  if (failedStory) {
    // v9.0: Skip failed stories instead of failing the loop — let remaining stories continue
    db.prepare("UPDATE stories SET status = 'skipped', updated_at = datetime('now') WHERE run_id = ? AND status = 'failed'").run(runId);
    const wfId = getWorkflowId(runId);
    emitEvent({ ts: new Date().toISOString(), event: "story.skipped", runId, workflowId: wfId, stepId: loopStepId, detail: "Failed stories skipped — loop continues" });
    // Fall through to mark loop done
  }

  // All stories verified/skipped — mark loop step done
  db.prepare(
    "UPDATE steps SET status = 'done', updated_at = datetime('now') WHERE id = ?"
  ).run(loopStepId);

  // Also mark verify step done if it exists
  const loopStep = db.prepare("SELECT loop_config, run_id FROM steps WHERE id = ?").get(loopStepId) as { loop_config: string | null; run_id: string } | undefined;
  if (loopStep?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStep.loop_config);
    if (lc.verifyEach && lc.verifyStep) {
      db.prepare(
        "UPDATE steps SET status = 'done', updated_at = datetime('now') WHERE run_id = ? AND step_id = ?"
      ).run(runId, lc.verifyStep);
    }
  }

  return advancePipeline(runId);
}

/**
 * Advance the pipeline: find the next waiting step and make it pending, or complete the run.
 * Respects terminal run states — a failed run cannot be advanced or completed.
 */
function advancePipeline(runId: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();

  // Guard: don't advance or complete a run that's already failed/cancelled
  const runStatus = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string } | undefined;
  if (runStatus?.status === "failed" || runStatus?.status === "cancelled") {
    return { advanced: false, runCompleted: false };
  }

  // BEGIN IMMEDIATE prevents concurrent crons from double-advancing
  db.exec("BEGIN IMMEDIATE");
  try {
    const next = db.prepare(
      "SELECT id, step_id, step_index FROM steps WHERE run_id = ? AND status = 'waiting' ORDER BY step_index ASC LIMIT 1"
    ).get(runId) as { id: string; step_id: string; step_index: number } | undefined;

    const incomplete = db.prepare(
      "SELECT id FROM steps WHERE run_id = ? AND status IN ('failed', 'pending', 'running') LIMIT 1"
    ).get(runId) as { id: string } | undefined;

    if (!next && incomplete) {
      db.exec("COMMIT");
      return { advanced: false, runCompleted: false };
    }

    const wfId = getWorkflowId(runId);
    if (next) {
      // Guard: don't advance past steps that are still running or pending
      const priorIncomplete = db.prepare(
        "SELECT id FROM steps WHERE run_id = ? AND step_index < ? AND status IN ('running', 'pending') LIMIT 1"
      ).get(runId, next.step_index) as { id: string } | undefined;
      if (priorIncomplete) {
        db.exec("COMMIT");
        return { advanced: false, runCompleted: false };
      }
      db.prepare(
        "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?"
      ).run(next.id);
      db.exec("COMMIT");
      emitEvent({ ts: new Date().toISOString(), event: "pipeline.advanced", runId, workflowId: wfId, stepId: next.step_id });
      emitEvent({ ts: new Date().toISOString(), event: "step.pending", runId, workflowId: wfId, stepId: next.step_id });
      return { advanced: true, runCompleted: false };
    } else {
      db.prepare(
        "UPDATE runs SET status = 'completed', updated_at = datetime('now') WHERE id = ?"
      ).run(runId);
      db.exec("COMMIT");
      emitEvent({ ts: new Date().toISOString(), event: "run.completed", runId, workflowId: wfId });
      logger.info("Run completed", { runId, workflowId: wfId });
      archiveRunProgress(runId);
      scheduleRunCronTeardown(runId);
      return { advanced: false, runCompleted: true };
    }
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch {}
    throw err;
  }
}

// ── Fail ────────────────────────────────────────────────────────────

// ─── Progress Archiving (T15) ────────────────────────────────────────

export function archiveRunProgress(runId: string): void {
  const db = getDb();
  const loopStep = db.prepare(
    "SELECT agent_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(runId) as { agent_id: string } | undefined;
  if (!loopStep) return;

  const workspace = getAgentWorkspacePath(loopStep.agent_id);
  if (!workspace) return;

  const scopedPath = path.join(workspace, `progress-${runId}.txt`);
  const progressPath = scopedPath;
  if (!fs.existsSync(progressPath)) return;

  const archiveDir = path.join(workspace, "archive", runId);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(progressPath, path.join(archiveDir, "progress.txt"));
  fs.unlinkSync(progressPath); // clean up
}

/**
 * Fail a step, with retry logic. For loop steps, applies per-story retry.
 */
export function failStep(stepId: string, error: string): { retrying: boolean; runFailed: boolean } {
  const db = getDb();

  const step = db.prepare(
    "SELECT run_id, retry_count, max_retries, type, current_story_id FROM steps WHERE id = ?"
  ).get(stepId) as { run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null } | undefined;

  if (!step) throw new Error(`Step not found: ${stepId}`);

  // T9: Loop step failure — per-story retry
  if (step.type === "loop" && step.current_story_id) {
    const story = db.prepare(
      "SELECT id, retry_count, max_retries FROM stories WHERE id = ?"
    ).get(step.current_story_id) as { id: string; retry_count: number; max_retries: number } | undefined;

    if (story) {
      const storyRow = db.prepare("SELECT story_id, title FROM stories WHERE id = ?").get(step.current_story_id!) as { story_id: string; title: string } | undefined;
      const newRetry = story.retry_count + 1;
      if (newRetry > story.max_retries) {
        // Story retries exhausted — clean up worktree
        if (storyRow?.story_id) {
          const runCtx = db.prepare("SELECT context FROM runs WHERE id = ?").get(step.run_id) as { context: string } | undefined;
          const ctx = runCtx ? JSON.parse(runCtx.context) : {};
          if (ctx.repo) removeStoryWorktree(ctx.repo, storyRow.story_id);
        }
        db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, story.id);
        db.prepare("UPDATE steps SET status = 'failed', output = ?, current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(error, stepId);
        db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(step.run_id);
        const wfId = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: stepId, storyId: storyRow?.story_id, storyTitle: storyRow?.title, detail: error });
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: stepId, detail: error });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story retries exhausted" });
        scheduleRunCronTeardown(step.run_id);
        return { retrying: false, runFailed: true };
      }

      // Retry the story — clean up worktree (will be recreated on next claim)
      if (storyRow?.story_id) {
        const runCtx2 = db.prepare("SELECT context FROM runs WHERE id = ?").get(step.run_id) as { context: string } | undefined;
        const ctx2 = runCtx2 ? JSON.parse(runCtx2.context) : {};
        if (ctx2.repo) removeStoryWorktree(ctx2.repo, storyRow.story_id);
      }
      db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, story.id);
      db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(stepId);
      return { retrying: true, runFailed: false };
    }
  }

  // Single step: existing logic
  const newRetryCount = step.retry_count + 1;

  if (newRetryCount > step.max_retries) {
    db.prepare(
        "UPDATE steps SET status = 'failed', output = ?, retry_count = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(error, newRetryCount, stepId);
    db.prepare(
        "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
    ).run(step.run_id);
    const wfId2 = getWorkflowId(step.run_id);
    emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: stepId, detail: error });
    emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: "Step retries exhausted" });
    scheduleRunCronTeardown(step.run_id);
    return { retrying: false, runFailed: true };
  } else {
    db.prepare(
        "UPDATE steps SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newRetryCount, stepId);
    return { retrying: true, runFailed: false };
  }
}
