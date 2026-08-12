/**
 * Story Operations
 *
 * Extracted from step-ops.ts — CRUD and formatting for user stories within loop steps.
 */

import crypto from "node:crypto";
import type postgres from "postgres";
import { pgQuery, pgGet, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import type { Story } from "./types.js";
import { logger } from "../lib/logger.js";
import { MAX_STORIES, DEFAULT_STORY_MAX_RETRIES } from "./constants.js";
import {
  ENGLISH_TEXT_DESCENDANT_V1,
  englishTextViolationMessageV1,
  inspectEnglishTextTreeV1,
} from "../product-compiler/english-text-contract-v1.js";

// ── Story CRUD ──────────────────────────────────────────────────────

/**
 * Get all stories for a run, ordered by story_index.
 */
const EMPTY_STORY_VALUE = /^(?:undefined|null|\[object Object\])$/i;

function cleanStoryText(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || EMPTY_STORY_VALUE.test(text)) return "";
  return text;
}

function extractLeadingJsonArray(text: string): { json: string; tail: string } | null {
  if (!text.startsWith("[")) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
    } else if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return {
          json: text.slice(0, i + 1),
          tail: text.slice(i + 1),
        };
      }
    }
  }

  return null;
}

function criteriaFromTail(tail: string): string[] {
  return tail
    .split(/\r?\n/)
    .map(line => line.trim())
    .map(line => line.replace(/^[-*]\s+/, "").trim())
    .filter(line => line && line !== "--- Design Contract Requirements ---")
    .filter(line => !EMPTY_STORY_VALUE.test(line));
}

function flattenCriteriaValues(values: unknown[]): string[] {
  const criteria: string[] = [];

  for (const value of values) {
    const text = cleanStoryText(value);
    if (!text) continue;

    if (text.startsWith("[")) {
      const extracted = extractLeadingJsonArray(text);
      if (extracted) {
        try {
          const nested = JSON.parse(extracted.json);
          if (Array.isArray(nested)) {
            criteria.push(...flattenCriteriaValues(nested));
            criteria.push(...criteriaFromTail(extracted.tail));
            continue;
          }
        } catch {
          // Fall through to preserving the original text.
        }
      }
    }

    criteria.push(text);
  }

  const seen = new Set<string>();
  return criteria.filter(item => {
    const key = item.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseAcceptanceCriteria(raw: unknown): string[] {
  const text = cleanStoryText(raw);
  if (!text) return [];
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return flattenCriteriaValues(arr);
    const single = cleanStoryText(arr);
    return single ? [single] : [];
  } catch {
    const extracted = extractLeadingJsonArray(text);
    if (extracted) {
      try {
        const arr = JSON.parse(extracted.json);
        if (Array.isArray(arr)) {
          return flattenCriteriaValues(arr).concat(criteriaFromTail(extracted.tail));
        }
      } catch { /* fallback below */ }
    }
    return [text];
  }
}

function mapStoryRow(r: any): Story {
  return {
    id: r.id,
    runId: r.run_id,
    storyIndex: r.story_index,
    storyId: r.story_id,
    title: r.title,
    description: r.description,
    acceptanceCriteria: parseAcceptanceCriteria(r.acceptance_criteria),
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
  const storyId = cleanStoryText(story.storyId) || "UNKNOWN-STORY";
  const title = cleanStoryText(story.title) || storyId;
  const output = cleanStoryText(story.output);
  const description =
    cleanStoryText(story.description) ||
    (output ? `Failure report:\n${output}` : "No story description was provided. Inspect the current repository state before editing.");
  let criteria = Array.isArray(story.acceptanceCriteria)
    ? story.acceptanceCriteria.map(cleanStoryText).filter(Boolean)
    : [];
  if (criteria.length === 0) {
    criteria = /^QA-FIX-/i.test(storyId)
      ? [
          "Fix every failure listed in the QA/final failure report.",
          "npm run build passes on the current branch.",
          "The rendered app passes platform smoke testing without dead controls, console errors, blank screens, or layout failures.",
        ]
      : ["Implement the story behavior described above and verify it in the running app."];
  }
  const ac = criteria.map((c: string, i: number) => `  ${i + 1}. ${c}`).join("\n");
  return `Story ${storyId}: ${title}\n\n${description}\n\nAcceptance Criteria:\n${ac}`;
}

export function formatCompletedStories(stories: Story[]): string {
  const completed = stories.filter(s => s.status === "done" || s.status === "failed" || s.status === "skipped" || s.status === "verified");
  if (completed.length === 0) return "(none yet)";
  return completed.map(s => `- ${s.storyId}: ${s.title} [${s.status}]`).join("\n");
}

/**
 * Completed/planned story roadmap with the best available ownership evidence.
 * Before setup-build this is logical scope_targets; after setup-build it is
 * resolved_scope_files. Tells agents which story owns what so they avoid bleed.
 */
export async function formatStoryRoadmap(runId: string, currentStoryId: string): Promise<string> {
  const rows = await pgQuery<{
    story_id: string; title: string; status: string;
    scope_files: string | null; resolved_scope_files: string | null; scope_targets: string | null; shared_files: string | null;
  }>(
    "SELECT story_id, title, status, scope_files, resolved_scope_files, scope_targets, shared_files FROM stories WHERE run_id = $1 ORDER BY story_index",
    [runId]
  );
  if (rows.length === 0) return "(no stories)";

  const lines: string[] = [];
  for (const r of rows) {
    const isCurrent = r.story_id === currentStoryId;
    const marker = isCurrent ? "→ CURRENT" : r.status === "done" || r.status === "verified" ? "✓ DONE" : r.status === "failed" ? "✗ FAILED" : "□ " + r.status.toUpperCase();
    let scope: string[] = [];
    try { scope = JSON.parse(r.resolved_scope_files || r.scope_files || r.scope_targets || "[]"); } catch {}
    const scopeStr = scope.length > 0 ? scope.join(", ") : "(no scope declared)";
    lines.push(`${marker} ${r.story_id}: ${r.title}`);
    lines.push(`    Ownership: ${scopeStr}`);
  }
  return lines.join("\n");
}

// ── STORIES_JSON Parsing ────────────────────────────────────────────

const SINGLE_STORY_FRONTEND_INTEGRATION_FILES = [
  "src/App.tsx",
  "src/App.css",
  "src/main.tsx",
  "src/index.css",
  "src/contexts/AppContext.tsx",
];

const SETUP_OWNED_FRONTEND_TOOLCHAIN_PATTERNS = [
  /^package(?:-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb?$/,
  /^tsconfig(?:\.[^.]+)?\.json$/,
  /^vite\.config\.[cm]?[jt]s$/,
  /^tailwind\.config\.[cm]?[jt]s$/,
  /^postcss\.config\.[cm]?[jt]s$/,
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.eslintrc(?:\.[cm]?[jt]s|\.json)?$/,
  /^index\.html$/,
];

function isFrontendSurfaceFile(file: string): boolean {
  return (
    file.startsWith("src/screens/") ||
    file.startsWith("src/components/") ||
    file.endsWith(".tsx") ||
    file.endsWith(".jsx")
  );
}

function isSetupOwnedFrontendToolchainFile(file: string): boolean {
  return SETUP_OWNED_FRONTEND_TOOLCHAIN_PATTERNS.some((pattern) => pattern.test(file));
}

function normalizeImplementationContract(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const contract = value as Record<string, unknown>;
  if (Object.keys(contract).length === 0) return null;
  return JSON.stringify(contract);
}

function normalizeJsonArray(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value.filter((item) => item !== null && item !== undefined);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export function normalizeScopeFilesForStory(scopeFiles: unknown, storyCount: number): string[] | null {
  if (!Array.isArray(scopeFiles)) return null;

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of scopeFiles) {
    if (typeof raw !== "string") continue;
    const file = raw.trim();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    normalized.push(file);
  }

  const hasFrontendSurface = normalized.some(isFrontendSurfaceFile);
  if (hasFrontendSurface) {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (isSetupOwnedFrontendToolchainFile(normalized[i])) {
        seen.delete(normalized[i]);
        normalized.splice(i, 1);
      }
    }
  }

  if (storyCount === 1 && hasFrontendSurface) {
    for (const file of SINGLE_STORY_FRONTEND_INTEGRATION_FILES) {
      if (!seen.has(file)) {
        seen.add(file);
        normalized.push(file);
      }
    }
  }

  return normalized;
}

/** Reject generated story artifacts before any database transaction can begin. */
export function assertStoryArtifactEnglishV1(stories: unknown): void {
  const issue = inspectEnglishTextTreeV1(stories, {
    lexicalPathPatterns: [[ENGLISH_TEXT_DESCENDANT_V1]],
  })[0];
  if (issue) {
    throw new Error(
      `STORIES_ENGLISH_TEXT_REQUIRED: ${englishTextViolationMessageV1(issue)}`,
    );
  }
}

/**
 * Parse STORIES_JSON from step output and insert stories into the DB.
 */
export type ParseAndInsertStoriesOptions = Readonly<{
  replaceExisting?: boolean;
}>;

export type StoryPublicationRowV1 = Readonly<{
  storyIndex: number;
  storyId: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  dependsOn: string | null;
  scopeFiles: string | null;
  sharedFiles: string | null;
  scopeTargets: string | null;
  requestedDependencies: string | null;
  sharedEditRequests: string | null;
  resolvedScopeFiles: string | null;
  scopeDescription: string | null;
  fileSkeletons: string | null;
  implementationContract: string | null;
}>;

export function compileStoryPublicationRowsV1(output: string): readonly StoryPublicationRowV1[] {
  const lines = output.split("\n");
  const startIdx = lines.findIndex(l => l.startsWith("STORIES_JSON:"));
  // B64 support: agent sometimes encodes STORIES_JSON as base64
  const b64Idx = lines.findIndex(l => l.startsWith("STORIES_JSON_B64:"));
  if (b64Idx !== -1) {
    const b64Data = lines[b64Idx].slice("STORIES_JSON_B64:".length).trim();
    try {
      const decoded = Buffer.from(b64Data, "base64").toString("utf-8");
      return compileStoryPublicationRowsV1("STORIES_JSON: " + decoded);
    } catch (e) {
      throw new Error(`Failed to decode STORIES_JSON_B64: ${String(e instanceof Error ? e.message : e)}`);
    }
  }

  let jsonText: string;
  if (startIdx !== -1) {
    // Standard format: STORIES_JSON: [...]
    const firstLine = lines[startIdx].slice("STORIES_JSON:".length).trim();
    const jsonLines = [firstLine];
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (/^[A-Z_]+:(\s|$)/.test(lines[i])) break;
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
          return Object.freeze([]); // No STORIES_JSON field in object
        }
      } catch {
        return Object.freeze([]); // Not valid JSON
      }
    } else {
      return Object.freeze([]); // Not JSON at all — skip
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
  if (stories.length === 0) {
    throw new Error("STORIES_JSON must contain at least one story");
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
    if (typeof s.id !== "string" || s.id.length === 0
      || typeof s.title !== "string" || s.title.length === 0
      || typeof s.description !== "string" || s.description.length === 0
      || !Array.isArray(ac) || ac.length === 0) {
      throw new Error(`STORIES_JSON story at index ${i} missing required fields (id, title, description, acceptanceCriteria)`);
    }
    if (seenIds.has(s.id)) {
      throw new Error(`STORIES_JSON has duplicate story id "${s.id}"`);
    }
    seenIds.add(s.id);
  }

  assertStoryArtifactEnglishV1(stories);

  return Object.freeze(stories.map((s, storyIndex): StoryPublicationRowV1 => {
    const acceptanceCriteria = s.acceptanceCriteria ?? s.acceptance_criteria;
    const normalizedScopeFiles = normalizeScopeFilesForStory(s.scope_files, stories.length);
    const scopeFiles = normalizedScopeFiles ? JSON.stringify(normalizedScopeFiles) : null;
    return Object.freeze({
      storyIndex,
      storyId: s.id,
      title: s.title,
      description: s.description,
      acceptanceCriteria: JSON.stringify(acceptanceCriteria),
      dependsOn: Array.isArray(s.depends_on) ? JSON.stringify(s.depends_on) : null,
      scopeFiles,
      sharedFiles: Array.isArray(s.shared_files) ? JSON.stringify(s.shared_files) : null,
      scopeTargets: normalizeJsonArray(s.scope_targets),
      requestedDependencies: normalizeJsonArray(s.requested_dependencies),
      sharedEditRequests: normalizeJsonArray(s.shared_edit_requests),
      resolvedScopeFiles: scopeFiles,
      scopeDescription: typeof s.scope_description === "string" ? s.scope_description : null,
      fileSkeletons: s.file_skeletons && typeof s.file_skeletons === "object"
        ? JSON.stringify(s.file_skeletons)
        : null,
      implementationContract: normalizeImplementationContract(s.implementation_contract),
    });
  }));
}

export async function insertStoryPublicationRowsInTransactionV1(
  transaction: postgres.TransactionSql,
  runId: string,
  rows: readonly StoryPublicationRowV1[],
): Promise<void> {
  const ts = now();
  for (const row of rows) {
    await transaction.unsafe(
      `INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, depends_on, scope_files, shared_files, scope_targets, requested_dependencies, shared_edit_requests, resolved_scope_files, scope_description, file_skeletons, implementation_contract, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, 5, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)`,
      [
        crypto.randomUUID(), runId, row.storyIndex, row.storyId, row.title,
        row.description, row.acceptanceCriteria, row.dependsOn, row.scopeFiles,
        row.sharedFiles, row.scopeTargets, row.requestedDependencies,
        row.sharedEditRequests, row.resolvedScopeFiles, row.scopeDescription,
        row.fileSkeletons, row.implementationContract, ts,
      ],
    );
  }
}

export async function parseAndInsertStories(
  output: string,
  runId: string,
  options: ParseAndInsertStoriesOptions = {},
): Promise<void> {
  const rows = compileStoryPublicationRowsV1(output);
  if (rows.length === 0) return;

  await pgBegin(async (sql) => {
    if (options.replaceExisting) {
      const runRows = await sql`SELECT id FROM runs WHERE id = ${runId} FOR UPDATE`;
      if (runRows.length !== 1) {
        throw new Error("STORIES_CANONICAL_PUBLICATION_RUN_INVALID");
      }
      await sql`DELETE FROM stories WHERE run_id = ${runId}`;
    }
    const existingCount = await sql`SELECT COUNT(*) as cnt FROM stories WHERE run_id = ${runId}`;
    if (Number(existingCount[0].cnt) > 0) {
      logger.info("Stories already exist for run " + runId + ", skipping duplicate insertion");
      return;
    }
    await insertStoryPublicationRowsInTransactionV1(sql, runId, rows);
  });
}
