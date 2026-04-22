import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { pgQuery, pgRun, now } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { parseAndInsertStories } from "../../story-ops.js";
import { computePredictedScreenFiles } from "./context.js";

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

  // 2b. Story granularity: MIN 2 files per story (integration/setup exempted).
  //     Single-file scopes trigger "complete the design" model reflex →
  //     SCOPE_BLEED loop. 2-file pairs (hook+component, type+util) are natural
  //     and acceptable. MIN 3 was too strict, caused planner retry loops
  //     (observed run #535 US-004 ThemeToggle pair).
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
    if (files.length < 2 && row.story_index > 0 && !isIntegration) {
      tooSmall.push(`${row.story_id}(${files.length})`);
    }
  }
  if (tooSmall.length > 0) {
    const list = tooSmall.join(", ");
    // 2026-04-22: Hard reject -> warning-only. Setup bypass (d40973f) + story roadmap
    // (0aced72) zaten scope bleed riskini azaltti. Hard reject kimi planner'i infinite
    // retry'a sokuyordu. Agent karari gecerli kalsin, single-file story'ler tolere
    // edilsin (worst case: one extra story, not full-app scope bleed).
    logger.warn(`[module:stories] ADVISORY: ${tooSmall.length} story/stories have few scope_files: ${list}. Allowed — guard is now warning-only.`, { runId });
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
