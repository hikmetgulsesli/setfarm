/**
 * Story Operations
 *
 * Extracted from step-ops.ts — CRUD and formatting for user stories within loop steps.
 */

import crypto from "node:crypto";
import { getDb } from "../db.js";
import type { Story } from "./types.js";
import { logger } from "../lib/logger.js";
import { MAX_STORIES, DEFAULT_STORY_MAX_RETRIES } from "./constants.js";

// ── Story CRUD ──────────────────────────────────────────────────────

/**
 * Get all stories for a run, ordered by story_index.
 */
function safeParseAC(raw: string): string[] { try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : [raw]; } catch { const m = raw.match(/^(\[.*?\])/s); if (m) { try { return JSON.parse(m[1]); } catch { /* fallback below */ } } return raw ? [raw] : []; } }

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
    acceptanceCriteria: safeParseAC(r.acceptance_criteria),
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
    acceptanceCriteria: safeParseAC(row.acceptance_criteria),
    status: row.status,
    output: row.output ?? undefined,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
  };
}

// ── Story Formatting ────────────────────────────────────────────────

export function formatStoryForTemplate(story: Story): string {
  const ac = story.acceptanceCriteria.map((c: string, i: number) => `  ${i + 1}. ${c}`).join("\n");
  return `Story ${story.storyId}: ${story.title}\n\n${story.description}\n\nAcceptance Criteria:\n${ac}`;
}

export function formatCompletedStories(stories: Story[]): string {
  const completed = stories.filter(s => s.status === "done" || s.status === "failed" || s.status === "skipped" || s.status === "verified");
  if (completed.length === 0) return "(none yet)";
  return completed.map(s => `- ${s.storyId}: ${s.title} [${s.status}]`).join("\n");
}

// ── STORIES_JSON Parsing ────────────────────────────────────────────

/**
 * Parse STORIES_JSON from step output and insert stories into the DB.
 */
export function parseAndInsertStories(output: string, runId: string): void {
  const lines = output.split("\n");
  const startIdx = lines.findIndex(l => l.startsWith("STORIES_JSON:"));

  let jsonText: string;
  if (startIdx !== -1) {
    // Standard format: STORIES_JSON: [...]
    const firstLine = lines[startIdx].slice("STORIES_JSON:".length).trim();
    const jsonLines = [firstLine];
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (/^[A-Z_]+:\s/.test(lines[i])) break;
      jsonLines.push(lines[i]);
    }
    jsonText = jsonLines.join("\n").trim();
  } else {
    // Fallback: try parsing output as JSON object or array
    const trimmed = output.trim();
    if (trimmed.startsWith("[")) {
      // Raw JSON array
      jsonText = trimmed;
    } else if (trimmed.startsWith("{")) {
      // JSON object — extract STORIES_JSON field
      try {
        const obj = JSON.parse(trimmed);
        if (obj.STORIES_JSON && Array.isArray(obj.STORIES_JSON)) {
          jsonText = JSON.stringify(obj.STORIES_JSON);
        } else {
          return; // No STORIES_JSON field in object
        }
      } catch {
        return; // Not valid JSON
      }
    } else {
      return; // Not JSON at all — skip
    }
  }
  let stories: any[];
  try {
    stories = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse STORIES_JSON: ${(e as Error).message}`);
  }

  if (!Array.isArray(stories)) {
    throw new Error("STORIES_JSON must be an array");
  }
  if (stories.length > MAX_STORIES) {
    throw new Error(`STORIES_JSON has ${stories.length} stories, max is ${MAX_STORIES}`);
  }

  const db = getDb();

  // BEGIN IMMEDIATE: dedup check + insert must be atomic to prevent
  // parallel agents from both passing the dedup guard and double-inserting.
  db.exec("BEGIN IMMEDIATE");
  try {
    const existingCount = db.prepare("SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?").get(runId) as { cnt: number };
    if (existingCount.cnt > 0) {
      db.exec("ROLLBACK");
      logger.info("Stories already exist for run " + runId + ", skipping duplicate insertion");
      return;
    }

    const now = new Date().toISOString();
    const insert = db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, depends_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 5, ?, ?, ?)"
    );

    // Cycle detection: topological sort to catch A→B→C→A before insertion
    const storyIds = new Set(stories.map((s: any) => s.id));
    const adjList = new Map<string, string[]>();
    for (const s of stories) {
      const deps = Array.isArray(s.depends_on) ? s.depends_on : [];
      // Only track deps that reference stories in THIS batch (ignore external refs)
      adjList.set(s.id, deps.filter((d: string) => storyIds.has(d)));
    }
    const visited = new Set<string>();
    const inStack = new Set<string>();
    function hasCycle(node: string): boolean {
      if (inStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      inStack.add(node);
      for (const dep of (adjList.get(node) || [])) {
        if (hasCycle(dep)) return true;
      }
      inStack.delete(node);
      return false;
    }
    for (const sid of storyIds) {
      if (hasCycle(sid)) {
        db.exec("ROLLBACK");
        throw new Error(`STORIES_JSON has a dependency cycle involving story "${sid}"`);
      }
    }

    const seenIds = new Set<string>();
    for (let i = 0; i < stories.length; i++) {
      const s = stories[i];
      // Accept both camelCase and snake_case
      const ac = s.acceptanceCriteria ?? s.acceptance_criteria;
      if (!s.id || !s.title || !s.description || !Array.isArray(ac) || ac.length === 0) {
        db.exec("ROLLBACK");
        throw new Error(`STORIES_JSON story at index ${i} missing required fields (id, title, description, acceptanceCriteria)`);
      }
      if (seenIds.has(s.id)) {
        db.exec("ROLLBACK");
        throw new Error(`STORIES_JSON has duplicate story id "${s.id}"`);
      }
      seenIds.add(s.id);
      const dependsOn = Array.isArray(s.depends_on) ? JSON.stringify(s.depends_on) : null;
      insert.run(crypto.randomUUID(), runId, i, s.id, s.title, s.description, JSON.stringify(ac), dependsOn, now, now);
    }
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch (e) { logger.warn("[tx] ROLLBACK failed: " + String(e), {}); }
    throw err;
  }
}
