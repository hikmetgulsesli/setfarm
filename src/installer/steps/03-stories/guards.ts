import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { pgQuery, pgRun, now } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { parseAndInsertStories } from "../../story-ops.js";
import {
  collectUiBehaviorRequirements,
  computePredictedScreenFiles,
  normalizeUiBehaviorText,
  type UiBehaviorRequirement,
} from "./context.js";

// validateOutput is intentionally minimal at the field level — STORIES_JSON
// arrives as multi-line raw text (not in parsed[]) and is ingested by
// parseAndInsertStories during onComplete. Module-level checks here catch
// only the most obvious agent failure modes.
export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }
  return { ok: errors.length === 0, errors };
}

function getExplicitMaxStories(context: Record<string, string>): number | null {
  const m = String(context["story_count_hint"] || "").match(/MAX_STORIES=(\d+)/);
  const n = m ? Number(m[1]) : 0;
  return Number.isInteger(n) && n > 0 && n < 50 ? n : null;
}

const SEMANTIC_STOP_WORDS = new Set([
  "about", "adet", "agent", "ana", "app", "application", "arac", "asama", "basic", "basit",
  "bir", "bircok", "butun", "cihaz", "codlama", "css", "daha", "de", "deploy", "dev",
  "dizin", "dogrulama", "dosya", "ekran", "fazla", "frontend", "gereken", "gerekirse",
  "gerekli", "github", "html", "icin", "icinde", "ile", "ise", "javascript", "kisa",
  "kod", "kodlama", "kurulum", "local", "localstorage", "maks", "maksimum", "minimal",
  "next", "nextjs", "node", "olan", "olarak", "olacak", "olsun", "platform", "prd",
  "proje", "react", "repo", "screen", "setup", "smoke", "static", "story", "tailwind",
  "tek", "temel", "test", "testidir", "tests", "typescript", "typecheck", "ui", "user",
  "uygulama", "uygulamasi", "veya", "vite", "web", "yeni", "yok",
]);

const SEMANTIC_SYNONYM_GROUPS = [
  ["sayac", "sayaci", "sayacin", "sayaclar", "counter"],
  ["arttir", "artir", "increment", "increase"],
  ["azalt", "decrement", "decrease"],
  ["sifirla", "reset"],
  ["not", "notlar", "notes", "note"],
  ["arama", "ara", "search"],
  ["gorev", "todo", "task"],
  ["oyun", "game"],
];

function normalizeSemanticText(text: string): string {
  return String(text || "")
    .replace(/[İ]/g, "I")
    .replace(/[ı]/g, "i")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o");
}

function canonicalSemanticToken(token: string): string {
  for (const group of SEMANTIC_SYNONYM_GROUPS) {
    if (group.includes(token)) return group[0];
  }
  return token;
}

function semanticTokens(text: string): string[] {
  const normalized = normalizeSemanticText(text);
  const raw = normalized.match(/[a-z0-9]{3,}/g) || [];
  const out: string[] = [];
  for (const token of raw) {
    if (/\d/.test(token)) continue;
    if (SEMANTIC_STOP_WORDS.has(token)) continue;
    out.push(canonicalSemanticToken(token));
  }
  return [...new Set(out)];
}

export function extractStoryDomainTerms(taskText: string, prdText: string): string[] {
  const taskTerms = semanticTokens(taskText);
  const prdTerms = new Set(semanticTokens(prdText));
  const source = prdTerms.size > 0 ? taskTerms.filter(t => prdTerms.has(t)) : taskTerms;
  return [...new Set(source)].slice(0, 12);
}

export interface SemanticStoryInput {
  story_id?: string;
  story_index?: number;
  title?: string | null;
  description?: string | null;
  acceptance_criteria?: string | null;
  scope_description?: string | null;
  scope_files?: string | null;
  shared_files?: string | null;
}

function parseStoryJsonField(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.join(" ");
    if (parsed && typeof parsed === "object") return Object.values(parsed as Record<string, unknown>).join(" ");
  } catch {
    // fall through to raw text
  }
  return String(raw);
}

export function detectStorySemanticDrift(
  context: { task?: string; prd?: string; PRD?: string },
  stories: SemanticStoryInput[],
): string | null {
  const domainTerms = extractStoryDomainTerms(context.task || "", context.prd || context.PRD || "");
  if (domainTerms.length < 2 || stories.length === 0) return null;

  const storyText = stories.map(s => [
    s.title || "",
    s.description || "",
    s.scope_description || "",
    parseStoryJsonField(s.acceptance_criteria),
    parseStoryJsonField(s.scope_files),
  ].join(" ")).join(" ");
  const storyTerms = new Set(semanticTokens(storyText));
  const hits = domainTerms.filter(t => storyTerms.has(t));
  const minHits = Math.min(2, domainTerms.length);
  if (hits.length >= minHits) return null;

  const missing = domainTerms.filter(t => !storyTerms.has(t)).slice(0, 8).join(", ");
  const storyIds = stories.map(s => s.story_id).filter(Boolean).join(", ") || "unknown";
  return `GUARDRAIL: Story semantic drift detected for ${storyIds}. Stories do not preserve task/PRD domain terms. Missing terms: ${missing}. Re-output STORIES_JSON using the original product concept and actions from PRD/task.`;
}

const UI_BEHAVIOR_STOP_WORDS = new Set([
  "action", "aktif", "aria", "button", "buton", "click", "control", "deger",
  "div", "dom", "feedback", "flow", "href", "icon", "input", "islem", "item",
  "label", "link", "modal", "navigate", "onchange", "onclick", "page", "panel",
  "state", "submit", "target", "trigger", "url", "value", "visible", "circle", "alt",
]);

const UI_BEHAVIOR_SYNONYM_GROUPS = [
  ["settings", "setting", "ayar", "ayarlar", "tune"],
  ["history", "gecmis", "kayit", "kayitlar", "logs", "log"],
  ["profile", "profil", "person", "account", "hesap", "kullanici"],
  ["home", "ana", "anasayfa", "dashboard"],
  ["search", "ara", "arama", "filtre", "filter"],
  ["add", "add_circle", "plus", "ekle", "yeni", "olustur", "create"],
  ["artir", "arttir", "increase", "increment", "plus"],
  ["remove", "minus", "azalt", "decrease", "decrement"],
  ["reset", "restart", "restart_alt", "sifirla"],
  ["save", "kaydet", "submit", "gonder"],
  ["delete", "sil", "kaldir", "trash"],
  ["close", "kapat", "iptal", "cancel", "dismiss"],
  ["note", "notes", "not", "notlar"],
  ["counter", "sayac", "tally"],
  ["notification", "notifications", "bildirim", "bildirimler"],
  ["favorite", "favorites", "favori"],
  ["bookmark", "bookmarks", "yerimi"],
];

function uiBehaviorTokens(text: string): string[] {
  return normalizeUiBehaviorText(text)
    .split(/[ /]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !UI_BEHAVIOR_STOP_WORDS.has(t));
}

function expandUiBehaviorTerm(term: string): string[] {
  const normalized = normalizeUiBehaviorText(term).replace(/\s+/g, "_");
  const group = UI_BEHAVIOR_SYNONYM_GROUPS.find(g => g.includes(normalized));
  return group ? group : [normalized];
}

function requirementTerms(req: UiBehaviorRequirement): string[] {
  const raw = [
    req.label,
    req.icon || "",
    req.action || "",
    req.route || "",
  ].join(" ");
  const expanded = uiBehaviorTokens(raw).flatMap(expandUiBehaviorTerm);
  return [...new Set(expanded.filter(t => t.length >= 2 && !UI_BEHAVIOR_STOP_WORDS.has(t)))];
}

function formatUiBehaviorRequirement(req: UiBehaviorRequirement): string {
  return [
    `${req.screenId}:${req.kind} "${req.label}"`,
    req.icon ? `icon=${req.icon}` : "",
    req.route ? `route=${req.route}` : "",
    req.action ? `action=${req.action}` : "",
  ].filter(Boolean).join(" ");
}

function findMissingUiBehaviorRequirements(
  repoPath: string,
  stories: SemanticStoryInput[],
): UiBehaviorRequirement[] {
  const requirements = collectUiBehaviorRequirements(repoPath);
  if (requirements.length === 0 || stories.length === 0) return [];

  const storyText = stories.map(s => [
    s.title || "",
    s.description || "",
    s.scope_description || "",
    parseStoryJsonField(s.acceptance_criteria),
    parseStoryJsonField(s.scope_files),
  ].join(" ")).join(" ");
  const storyTokens = new Set(uiBehaviorTokens(storyText).flatMap(expandUiBehaviorTerm));

  const missing: UiBehaviorRequirement[] = [];
  for (const req of requirements) {
    const terms = requirementTerms(req);
    if (terms.length === 0) continue;
    if (!terms.some(t => storyTokens.has(t))) missing.push(req);
  }
  return missing;
}

export function detectUiBehaviorContractGaps(
  repoPath: string,
  stories: SemanticStoryInput[],
): string | null {
  const missing = findMissingUiBehaviorRequirements(repoPath, stories);
  if (missing.length === 0) return null;

  const list = missing.slice(0, 10).map(formatUiBehaviorRequirement).join("; ");
  const suffix = missing.length > 10 ? `; +${missing.length - 10} more` : "";
  return `GUARDRAIL: UI_BEHAVIOR_CONTRACT coverage missing for ${missing.length} control(s): ${list}${suffix}. Re-output STORIES_JSON so acceptanceCriteria names each missing Stitch control and its visible behavior before coding starts.`;
}

function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function behaviorCriterion(req: UiBehaviorRequirement): string {
  const details = [
    `${req.kind} "${req.label}"`,
    req.icon ? `icon=${req.icon}` : "",
    req.action ? `action=${req.action}` : "",
    req.route ? `route=${req.route}` : "",
  ].filter(Boolean).join("; ");
  return `[UI_BEHAVIOR_CONTRACT] ${req.screenId} (${req.screenTitle}) ${details} must ${req.expectedBehavior}.`;
}

function scoreStoryForRequirement(
  story: SemanticStoryInput,
  req: UiBehaviorRequirement,
  screenFileById: Map<string, string>,
): number {
  let score = 0;
  const scope = parseStringArray(story.scope_files);
  const shared = parseStringArray(story.shared_files);
  const screenFile = screenFileById.get(req.screenId);
  if (screenFile && scope.includes(screenFile)) score += 100;
  if (screenFile && shared.includes(screenFile)) score += 50;
  if ((story.story_index ?? 0) > 0) score += 10; // avoid setup story when possible

  const storyTokens = new Set(uiBehaviorTokens([
    story.title || "",
    story.description || "",
    story.scope_description || "",
    parseStoryJsonField(story.acceptance_criteria),
    parseStoryJsonField(story.scope_files),
  ].join(" ")).flatMap(expandUiBehaviorTerm));
  for (const term of requirementTerms(req)) {
    if (storyTokens.has(term)) score += 4;
  }
  return score;
}

export function planUiBehaviorCriteriaInjections(
  repoPath: string,
  stories: SemanticStoryInput[],
): Map<string, string[]> {
  const missing = findMissingUiBehaviorRequirements(repoPath, stories);
  if (missing.length === 0) return new Map();

  const screenFileById = new Map(computePredictedScreenFiles(repoPath).map((s) => [s.screenId, s.filePath]));
  const updates = new Map<string, string[]>();

  for (const req of missing) {
    const owner = [...stories]
      .sort((a, b) => {
        const scoreDiff = scoreStoryForRequirement(b, req, screenFileById) - scoreStoryForRequirement(a, req, screenFileById);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.story_index ?? 0) - (b.story_index ?? 0);
      })[0];
    if (!owner?.story_id) continue;
    const existing = updates.get(owner.story_id) || [];
    existing.push(behaviorCriterion(req));
    updates.set(owner.story_id, existing);
  }
  return updates;
}

async function autoInjectUiBehaviorCriteria(
  runId: string,
  repoPath: string,
  stories: SemanticStoryInput[],
): Promise<number> {
  const updates = planUiBehaviorCriteriaInjections(repoPath, stories);

  let injected = 0;
  for (const story of stories) {
    if (!story.story_id) continue;
    const additions = updates.get(story.story_id);
    if (!additions?.length) continue;
    const acceptance = parseStringArray(story.acceptance_criteria);
    const normalizedExisting = new Set(acceptance.map(normalizeUiBehaviorText));
    const next = [...acceptance];
    for (const item of additions) {
      const key = normalizeUiBehaviorText(item);
      if (!normalizedExisting.has(key)) {
        next.push(item);
        normalizedExisting.add(key);
        injected++;
      }
    }
    if (next.length !== acceptance.length) {
      await pgRun(
        "UPDATE stories SET acceptance_criteria = $1, updated_at = $2 WHERE run_id = $3 AND story_id = $4",
        [JSON.stringify(next), now(), runId, story.story_id],
      );
    }
  }
  if (injected > 0) {
    logger.info(`[module:stories] Auto-injected ${injected} UI behavior acceptance criterion/criteria from DESIGN_DOM`, { runId });
  }
  return injected;
}

// onComplete owns the full stories guardrail chain. Failures fail the step
// (return early); auto-fixes mutate the DB in-place. The pipeline expects
// stories already inserted into the DB before this runs (parseAndInsertStories
// is called from completeStep before reaching here).
export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { runId, parsed, context, rawOutput } = ctx;

  // 0. Parse + insert STORIES_JSON from raw output (line-based parsed[] can't
  //    capture multi-line JSON). No-op if rawOutput missing or no STORIES_JSON.
  if (rawOutput) {
    try {
      await parseAndInsertStories(rawOutput, runId);
    } catch (e) {
      const msg = `parseAndInsertStories failed: ${String(e instanceof Error ? e.message : e).slice(0, 200)}`;
      logger.warn(`[module:stories] ${msg}`, { runId });
      throw new Error(msg);
    }
  }

  // 1. 0-stories check — no stories in DB after parsing means a malformed output
  const countRow = await pgQuery<{ cnt: string }>("SELECT COUNT(*)::text as cnt FROM stories WHERE run_id = $1", [runId]);
  const storyCount = parseInt(countRow[0]?.cnt || "0", 10);
  if (storyCount === 0) {
    const msg = "GUARDRAIL: Stories step completed with STATUS: done but produced 0 stories — STORIES_JSON missing or empty";
    logger.warn(`[module:stories] ${msg}`, { runId });
    throw new Error(msg);
  }

  const explicitMaxStories = getExplicitMaxStories(context);
  if (explicitMaxStories && storyCount > explicitMaxStories) {
    const msg = `GUARDRAIL: Stories step produced ${storyCount} stories but user explicitly capped at ${explicitMaxStories}. Combine small concerns and re-output STORIES_JSON within MAX_STORIES.`;
    logger.warn(`[module:stories] ${msg}`, { runId });
    await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
    throw new Error(msg);
  }

  let semanticRows = await pgQuery<SemanticStoryInput>(
    "SELECT story_index, story_id, title, description, acceptance_criteria, scope_description, scope_files, shared_files FROM stories WHERE run_id = $1 ORDER BY story_index",
    [runId]
  );
  const semanticErr = detectStorySemanticDrift(
    { task: context["task"] || "", prd: context["prd"] || context["PRD"] || "" },
    semanticRows
  );
  if (semanticErr) {
    logger.warn(`[module:stories] ${semanticErr}`, { runId });
    await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
    throw new Error(semanticErr);
  }

  const repoPath = context["repo"] || context["REPO"] || "";
  await autoInjectUiBehaviorCriteria(runId, repoPath, semanticRows);
  semanticRows = await pgQuery<SemanticStoryInput>(
    "SELECT story_index, story_id, title, description, acceptance_criteria, scope_description, scope_files, shared_files FROM stories WHERE run_id = $1 ORDER BY story_index",
    [runId]
  );
  const uiBehaviorErr = detectUiBehaviorContractGaps(repoPath, semanticRows);
  if (uiBehaviorErr) {
    logger.warn(`[module:stories] ${uiBehaviorErr}`, { runId });
    await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
    throw new Error(uiBehaviorErr);
  }

  // 2. missing scope_files (story_index > 0 — setup story exempt)
  const missingScope = await pgQuery<{ story_id: string }>(
    "SELECT story_id FROM stories WHERE run_id = $1 AND story_index > 0 AND (scope_files IS NULL OR scope_files = '' OR scope_files = '[]')",
    [runId]
  );
  if (missingScope.length > 0) {
    const ids = missingScope.map(r => r.story_id).join(", ");
    const msg = `GUARDRAIL: ${missingScope.length} story/stories missing scope_files (${ids}). Every non-setup story MUST declare scope_files. Re-output STORIES_JSON with scope_files populated.`;
    logger.warn(`[module:stories] ${msg}`, { runId });
    await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
    throw new Error(msg);
  }

  // 2b. Story granularity: MIN 3 files per story (integration/setup exempted).
  //     Single-file scopes trigger "complete the design" model reflex →
  //     SCOPE_BLEED loop. Observed run #494 (4/6 stories with 1 file each).
  const granularityRows = await pgQuery<{ story_id: string; scope_files: string | null; story_index: number }>(
    "SELECT story_id, scope_files, story_index FROM stories WHERE run_id = $1 ORDER BY story_index",
    [runId]
  );
  const tooSmall: string[] = [];
  for (const row of granularityRows) {
    if (!row.scope_files) continue;
    let files: string[] = [];
    try { files = JSON.parse(row.scope_files); } catch { continue; }
    if (!Array.isArray(files) || files.length === 0) continue;
    // Setup story (index 0) and integration story (App.tsx-containing) can be smaller
    const isIntegration = files.some(f => typeof f === "string" && (f === "src/App.tsx" || f === "src/App.jsx" || f === "src/main.tsx" || f === "src/main.jsx" || f === "src/index.tsx" || f === "src/index.jsx" || f === "index.html"));
    // 2026-04-24: hard MIN count removed. Scope should match concept size —
    // not forced by numeric rules that degrade story quality. Only reject
    // stories with 0 declared scope_files (no discipline) or empty array.
    if (files.length < 1 && row.story_index > 0 && !isIntegration) {
      tooSmall.push(`${row.story_id}(${files.length})`);
    }
  }
  if (tooSmall.length > 0) {
    const list = tooSmall.join(", ");
    const msg = `GUARDRAIL: ${tooSmall.length} story/stories have zero scope_files: ${list}. scope_files array must be non-empty; each story needs explicit file ownership.`;
    logger.warn(`[module:stories] ${msg}`, { runId });
    await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
    throw new Error(msg);
  }

  // 3. scope_files overlap auto-fix (keep first owner by story_index, move
  //    duplicates from later stories to their shared_files)
  const allRows = await pgQuery<{ story_id: string; scope_files: string | null; shared_files: string | null; story_index: number }>(
    "SELECT story_id, scope_files, shared_files, story_index FROM stories WHERE run_id = $1 ORDER BY story_index",
    [runId]
  );
  const fileOwner: Record<string, string> = {};
  const fixMap: Record<string, { remove: string[]; add: string[] }> = {};
  const overlaps: string[] = [];
  for (const row of allRows) {
    if (!row.scope_files) continue;
    let files: string[] = [];
    try { files = JSON.parse(row.scope_files); } catch { continue; }
    if (!Array.isArray(files)) continue;
    for (const f of files) {
      if (typeof f !== "string") continue;
      if (fileOwner[f]) {
        overlaps.push(`${f} \u2192 ${fileOwner[f]} + ${row.story_id}`);
        if (!fixMap[row.story_id]) fixMap[row.story_id] = { remove: [], add: [] };
        fixMap[row.story_id].remove.push(f);
        fixMap[row.story_id].add.push(f);
      } else {
        fileOwner[f] = row.story_id;
      }
    }
  }
  if (overlaps.length > 0) {
    logger.warn(`[module:stories] scope_files overlap auto-fixed: ${overlaps.join("; ")}`, { runId });
    for (const row of allRows) {
      const fix = fixMap[row.story_id];
      if (!fix) continue;
      try {
        const scope: string[] = JSON.parse(row.scope_files || "[]");
        const shared: string[] = JSON.parse(row.shared_files || "[]");
        const newScope = scope.filter(f => !fix.remove.includes(f));
        const newShared = [...new Set([...shared, ...fix.add])];
        await pgRun(
          "UPDATE stories SET scope_files = $1, shared_files = $2, updated_at = $3 WHERE run_id = $4 AND story_id = $5",
          [JSON.stringify(newScope), JSON.stringify(newShared), now(), runId, row.story_id]
        );
      } catch (e) {
        logger.warn(`[module:stories] overlap fix update failed for ${row.story_id}: ${String(e).slice(0, 120)}`, { runId });
      }
    }
  }

  // 4. hallucinated screen path detection + 5. multi-owner auto-fix
  //    (only if Stitch design manifest exists — predicts screen file paths)
  const predictedScreens = computePredictedScreenFiles(context["repo"] || "");
  if (predictedScreens.length === 0) return;

  const validScreenPaths = new Set(predictedScreens.map(s => s.filePath));
  const hallucinated: Array<{ story: string; path: string }> = [];
  const screenOwners: Record<string, string[]> = {};

  for (const row of allRows) {
    let scope: string[] = []; let shared: string[] = [];
    try { scope = JSON.parse(row.scope_files || "[]"); } catch { scope = []; }
    try { shared = JSON.parse(row.shared_files || "[]"); } catch { shared = []; }

    for (const f of [...scope, ...shared]) {
      if (typeof f !== "string") continue;
      if (/^src\/(pages|views|components\/screens)\/[A-Z][^/]*\.tsx?$/.test(f) && !validScreenPaths.has(f)) {
        hallucinated.push({ story: row.story_id, path: f });
      }
    }
    for (const f of scope) {
      if (typeof f === "string" && validScreenPaths.has(f)) {
        if (!screenOwners[f]) screenOwners[f] = [];
        screenOwners[f].push(row.story_id);
      }
    }
  }

  if (hallucinated.length > 0) {
    const list = hallucinated.slice(0, 10).map(h => `${h.story}:${h.path}`).join(", ");
    const validList = predictedScreens.slice(0, 10).map(s => s.filePath).join(", ");
    const msg = `GUARDRAIL: ${hallucinated.length} hallucinated screen path(s) (${list}). Stitch produces src/screens/<TurkishName>.tsx. Valid: ${validList}. Use PREDICTED_SCREEN_FILES.`;
    logger.warn(`[module:stories] ${msg}`, { runId });
    await pgRun("DELETE FROM stories WHERE run_id = $1", [runId]);
    throw new Error(msg);
  }

  // 7. Stack-aware sibling auto-include (prevents sibling-file SCOPE_BLEED).
  //    When a story owns an entry file (e.g. App.tsx in Vite, page.tsx in
  //    Next, ContentView.swift in iOS), the sibling MUST be in shared_files
  //    because developers reflexively touch it when wiring (imports, mount,
  //    root layout). Stack detected from repo structure; rules come from
  //    stack-rules.ts. Runs #494/#496 US-002 observed identical SCOPE_BLEED
  //    on src/main.tsx before this guard.
  const { detectStack, STACK_RULES } = await import("../06-implement/stack-rules.js");
  const detectedStack = detectStack(context["repo"] || "");
  const VITE_SIBLINGS: Array<[string, string]> = STACK_RULES[detectedStack].siblings;
  for (const row of allRows) {
    let scope: string[] = []; let shared: string[] = [];
    try { scope = JSON.parse(row.scope_files || "[]"); } catch { continue; }
    try { shared = JSON.parse(row.shared_files || "[]"); } catch { shared = []; }
    const added: string[] = [];
    for (const [owner, sibling] of VITE_SIBLINGS) {
      if (scope.includes(owner) && !scope.includes(sibling) && !shared.includes(sibling)) {
        shared.push(sibling);
        added.push(sibling);
      }
    }
    if (added.length > 0) {
      await pgRun(
        "UPDATE stories SET shared_files = $1, updated_at = $2 WHERE run_id = $3 AND story_id = $4",
        [JSON.stringify(shared), now(), runId, row.story_id]
      );
      logger.info(`[module:stories] Vite-aware auto-shared for ${row.story_id}: ${added.join(", ")}`, { runId });
    }
  }

  const multiOwned = Object.entries(screenOwners).filter(([_, owners]) => owners.length > 1);
  if (multiOwned.length > 0) {
    const summary = multiOwned.slice(0, 5).map(([f, o]) => `${f} → [${o.join(", ")}]`).join("; ");
    logger.warn(`[module:stories] multi-owned screens auto-fixed: ${summary}`, { runId });
    for (const [file, owners] of multiOwned) {
      const losers = owners.slice(1);
      for (const loser of losers) {
        const row = allRows.find(r => r.story_id === loser);
        if (!row) continue;
        try {
          const scope = JSON.parse(row.scope_files || "[]").filter((f: string) => f !== file);
          const shared = [...new Set([...JSON.parse(row.shared_files || "[]"), file])];
          await pgRun(
            "UPDATE stories SET scope_files = $1, shared_files = $2, updated_at = $3 WHERE run_id = $4 AND story_id = $5",
            [JSON.stringify(scope), JSON.stringify(shared), now(), runId, loser]
          );
        } catch (e) {
          logger.warn(`[module:stories] multi-owner fix failed for ${loser}: ${String(e).slice(0, 120)}`, { runId });
        }
      }
    }
  }
}
