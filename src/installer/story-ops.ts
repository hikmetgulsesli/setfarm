/**
 * Story Operations
 *
 * Extracted from step-ops.ts — CRUD and formatting for user stories within loop steps.
 */

import crypto from "node:crypto";
import { pgQuery, pgGet, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import type { Story } from "./types.js";
import { logger } from "../lib/logger.js";
import { MAX_STORIES, DEFAULT_STORY_MAX_RETRIES } from "./constants.js";

// ── Story CRUD ──────────────────────────────────────────────────────

/**
 * Get all stories for a run, ordered by story_index.
 */
function safeParseAC(raw: string): string[] { try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : [raw]; } catch { const m = raw.match(/^(\[.*?\])/s); if (m) { try { return JSON.parse(m[1]); } catch { /* fallback below */ } } return raw ? [raw] : []; } }

function mapStoryRow(r: any): Story {
  return {
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
  };
}

export async function getStories(runId: string): Promise<Story[]> {
  const rows = await pgQuery(
    "SELECT * FROM stories WHERE run_id = $1 ORDER BY story_index ASC", [runId]
  );
  return rows.map(mapStoryRow);
}

/**
 * Get the story currently being worked on by a loop step.
 */
export async function getCurrentStory(stepId: string): Promise<Story | null> {
  const step = await pgGet<{ current_story_id: string | null }>(
    "SELECT current_story_id FROM steps WHERE id = $1", [stepId]
  );
  if (!step?.current_story_id) return null;
  const row = await pgGet("SELECT * FROM stories WHERE id = $1", [step.current_story_id]);
  if (!row) return null;
  return mapStoryRow(row);
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
export async function parseAndInsertStories(output: string, runId: string): Promise<void> {
  const lines = output.split("\n");
  const startIdx = lines.findIndex(l => l.startsWith("STORIES_JSON:"));
  // B64 support: agent sometimes encodes STORIES_JSON as base64
  const b64Idx = lines.findIndex(l => l.startsWith("STORIES_JSON_B64:"));
  if (b64Idx !== -1) {
    const b64Data = lines[b64Idx].slice("STORIES_JSON_B64:".length).trim();
    try {
      const decoded = Buffer.from(b64Data, "base64").toString("utf-8");
      return parseAndInsertStories("STORIES_JSON: " + decoded, runId);
    } catch (e) {
      logger.warn("[stories] B64 decode failed: " + String(e), { runId });
    }
  }

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

  // Cycle detection: topological sort to catch A->B->C->A before insertion
  const storyIds = new Set(stories.map((s: any) => s.id));
  const adjList = new Map<string, string[]>();
  for (const s of stories) {
    const deps = Array.isArray(s.depends_on) ? s.depends_on : [];
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
      throw new Error(`STORIES_JSON has a dependency cycle involving story "${sid}"`);
    }
  }

  // Validate all stories before insertion
  const seenIds = new Set<string>();
  for (let i = 0; i < stories.length; i++) {
    const s = stories[i];
    const ac = s.acceptanceCriteria ?? s.acceptance_criteria;
    if (!s.id || !s.title || !s.description || !Array.isArray(ac) || ac.length === 0) {
      throw new Error(`STORIES_JSON story at index ${i} missing required fields (id, title, description, acceptanceCriteria)`);
    }
    if (seenIds.has(s.id)) {
      throw new Error(`STORIES_JSON has duplicate story id "${s.id}"`);
    }
    seenIds.add(s.id);
  }

  await pgBegin(async (sql) => {
    const existingCount = await sql`SELECT COUNT(*) as cnt FROM stories WHERE run_id = ${runId}`;
    if (Number(existingCount[0].cnt) > 0) {
      logger.info("Stories already exist for run " + runId + ", skipping duplicate insertion");
      return;
    }
    const ts = now();
    for (let i = 0; i < stories.length; i++) {
      const s = stories[i];
      const ac = s.acceptanceCriteria ?? s.acceptance_criteria;
      const dependsOn = Array.isArray(s.depends_on) ? JSON.stringify(s.depends_on) : null;
      await sql`INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, depends_on, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${runId}, ${i}, ${s.id}, ${s.title}, ${s.description}, ${JSON.stringify(ac)}, 'pending', 0, 5, ${dependsOn}, ${ts}, ${ts})`;
    }
  });
}
