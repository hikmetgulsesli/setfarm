import { pgQuery, pgGet, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import type { LoopConfig, Story } from "./types.js";
import { execFileSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { emitEvent } from "./events.js";
import { logger } from "../lib/logger.js";
import { runQualityChecks, formatQualityReport } from "./quality-gates.js";
import {
  CLEANUP_THROTTLE_MS,
  RUN_STATUS,
  STORY_STATUS,
  PROTECTED_CONTEXT_KEYS,
  OPTIONAL_TEMPLATE_VARS,
  PR_REVIEW_DELAY_MS,
} from "./constants.js";
import { getPRState, tryReopenPR, tryAutoMergePR, findPrByBranch, resolveClosedPR } from "./pr-state.js";
import { failStep } from "./step-fail.js";
import { advancePipeline, checkLoopContinuation } from "./step-advance.js";
import { runMergeQueue } from "./merge-queue-ops.js";

// ── Re-exports from extracted modules (backwards compat for cli.ts, medic.ts) ──
export { resolveTemplate, parseOutputKeyValues } from "./context-ops.js";
export { getStories, getCurrentStory } from "./story-ops.js";
export { computeHasFrontendChanges } from "./step-guardrails.js";
export { archiveRunProgress } from "./cleanup-ops.js";
export { failStep } from "./step-fail.js";

// ── Imports from extracted modules (used internally) ──
import { resolveTemplate, parseOutputKeyValues, readProgressFile, readProjectMemory, updateProjectMemory, getProjectTree, getInstalledPackages, getSharedCode, getRecentStoryCode, getComponentRegistry, getApiRoutes, pruneContextForStep } from "./context-ops.js";
import { getStories, formatStoryForTemplate, formatCompletedStories, parseAndInsertStories } from "./story-ops.js";
import { createStoryWorktree, removeStoryWorktree, findWorktreeDir, syncBaseBranch } from "./worktree-ops.js";
import { computeHasFrontendChanges, checkTestFailures, checkQualityGate, checkRequiredOutputFields, processDesignCompletion, processSetupCompletion, processSetupDesignContracts, processBrowserCheck, processDesignFidelityCheck, checkStoryDesignCompliance, checkImportConsistency } from "./step-guardrails.js";
import { cleanupAbandonedSteps as _cleanupAbandonedSteps, scheduleRunCronTeardown } from "./cleanup-ops.js";
import {
  getRunStatus, getRunContext, updateRunContext, failRun,
  getWorkflowId as _getWorkflowId,
  verifyStory, skipFailedStories, countAllStories, countStoriesByStatus,
  findStoryByStatus, getStoryInfo,
  setStepStatus, failStepWithOutput,
  findLoopStep, findActiveLoop,
  recordStepTransition,
} from "./repo.js";

const STITCH_HTML_EXCERPT_CHARS = 2500;
const STITCH_HTML_TOTAL_CHARS = 6000;
const DESIGN_DOM_EXCERPT_CHARS = 3000;

// ── Predicted screen file helpers (2026-04-14 SCOPE_BLEED fix) ──
// Mirrors scripts/stitch-to-jsx.mjs toComponentName() — MUST stay in sync.
// Planner was hallucinating English paths (src/pages/GameScreen.tsx) while
// stitch-to-jsx produced Turkish paths (src/screens/OyunEkrani.tsx), causing
// SCOPE_BLEED loops. This helper lets stories step inject the real future
// paths before planner generates scope_files.
function toComponentNameForStitch(title: string): string {
  return title
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/).filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function computePredictedScreenFiles(repoPath: string): Array<{ screenId: string; title: string; filePath: string }> {
  if (!repoPath) return [];
  const manifestPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    if (!Array.isArray(manifest)) return [];
    return manifest
      .filter((s: any) => !isPrdPseudoDesignScreen(s))
      .filter((s: any) => s?.title && s?.screenId)
      .map((s: any) => {
        const name = toComponentNameForStitch(String(s.title));
        return { screenId: String(s.screenId), title: String(s.title), filePath: name ? `src/screens/${name}.tsx` : "" };
      })
      .filter(s => s.filePath !== "");
  } catch (e) {
    logger.warn(`[predicted-screens] Failed to parse DESIGN_MANIFEST.json: ${String(e).slice(0, 120)}`);
    return [];
  }
}

/**
 * Wrapper: calls cleanup-ops.cleanupAbandonedSteps with advancePipeline callback.
 * Maintains the original zero-arg signature for backwards compatibility.
 */
export async function cleanupAbandonedSteps(): Promise<void> {
  await _cleanupAbandonedSteps(advancePipeline);
}

async function getWorkflowId(runId: string): Promise<string | undefined> {
  return await _getWorkflowId(runId);
}

/**
 * Wave 5 fix #20 (plan: reactive-frolicking-cupcake): safe loop_config parser.
 * Previously three call sites did `JSON.parse(step.loop_config)` without a
 * try/catch. A corrupted or half-written loop_config row (possible during
 * migrations or medic resets) would throw and crash the claim loop. This
 * helper returns `null` on any error and logs the failure so we can see it.
 */
function parseLoopConfigSafe(raw: string | null, runId?: string): LoopConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoopConfig;
  } catch (e) {
    logger.warn(`[loop-config] Failed to parse loop_config: ${String(e).slice(0, 150)}`, runId ? { runId } : {});
    return null;
  }
}

function publishSetupBaselineToMain(repo: string, runBranch: string, runId: string): boolean {
  if (!repo) return false;
  try {
    const current = execFileSync("git", ["branch", "--show-current"], {
      cwd: repo, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (runBranch && current !== runBranch) {
      execFileSync("git", ["checkout", runBranch], {
        cwd: repo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
    }

    try {
      execFileSync("git", ["rm", "-r", "--cached", "--ignore-unmatch", "node_modules"], {
        cwd: repo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {}

    try {
      const dirty = execFileSync("git", ["status", "--porcelain"], {
        cwd: repo, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (dirty) {
        execFileSync("git", ["add", "-A"], { cwd: repo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
        execFileSync("git", ["commit", "-m", "chore: finalize setup baseline"], {
          cwd: repo,
          timeout: 20000,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, GIT_COMMITTER_NAME: "Moltclaw AI", GIT_COMMITTER_EMAIL: "setrox@moltclaw.local" },
        });
      }
    } catch { /* nothing to commit is fine */ }

    if (runBranch) {
      try {
        execFileSync("git", ["push", "origin", runBranch], {
          cwd: repo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (pushBranchErr) {
        logger.warn(`[setup-build] Could not push setup branch ${runBranch}: ${String(pushBranchErr).slice(0, 180)}`, { runId });
      }
    }

    execFileSync("git", ["push", "origin", "HEAD:main"], {
      cwd: repo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
    });
    try {
      execFileSync("git", ["branch", "-f", "main", "HEAD"], {
        cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {}
    syncBaseBranch(repo, "main");
    logger.info(`[setup-build] Published setup baseline to main; story PRs will branch from main`, { runId });
    return true;
  } catch (e) {
    logger.warn(`[setup-build] Could not publish setup baseline to main: ${String(e).slice(0, 220)}`, { runId });
    return false;
  }
}

// ── Peek (lightweight work check) ───────────────────────────────────

export type PeekResult = "HAS_WORK" | "NO_WORK";

/**
 * Lightweight check: does this agent have any pending/waiting steps in active runs?
 * Unlike claimStep(), this runs a single cheap COUNT query — no cleanup, no context resolution.
 * Returns "HAS_WORK" if any pending/waiting steps exist, "NO_WORK" otherwise.
 */
export async function peekStep(agentId: string, callerGatewayAgent?: string): Promise<PeekResult> {
    // OUTPUT RECOVERY at peek time: if a previous session wrote output but died before
    // completing, recover it now. This prevents the "peek→NO_WORK→loop forever" problem
    // where claimStep's recovery never runs because peek returns NO_WORK first.
    // Scans ALL output files in /tmp — each parallel agent writes to its own file
    // (e.g. setfarm-output-koda.txt, setfarm-output-flux.txt)
    try {
      // FIX (2026-04-14 cross-contamination): when a caller is specified
      // (pool-based agents always pass --caller), ONLY inspect this caller's
      // own output file. The previous readdir-everything scan let an assigned
      // developer's stale /tmp/setfarm-output-<other>.txt get auto-completed
      // into a DIFFERENT run's implement step — e.g. lux polling for yemek
      // picked up koda's leftover renk-koru output (workflow.log 06:22:07).
      const tmpFiles = callerGatewayAgent
        ? (fs.existsSync(`/tmp/setfarm-output-${callerGatewayAgent}.txt`) ? [`setfarm-output-${callerGatewayAgent}.txt`] : [])
        : fs.readdirSync('/tmp').filter(f => f.startsWith('setfarm-output-') && f.endsWith('.txt'));
      for (const fileName of tmpFiles) {
        const filePath = `/tmp/${fileName}`;
        try {
          const output = fs.readFileSync(filePath, 'utf-8').trim();
          if (!output.includes('STATUS:')) continue;
          // P2-06: Skip if file is older than current run (cross-contamination guard)
          const fileStat = fs.statSync(filePath);
          const fileAge = Date.now() - fileStat.mtimeMs;
          if (fileAge > 1800000) { fs.unlinkSync(filePath); continue; } // older than 30min = stale
          // Find any running step for this agent role that could match
          const runningStep = await pgGet<{ id: string; step_id: string; run_id: string }>(
            `SELECT s.id, s.step_id, s.run_id FROM steps s JOIN runs r ON r.id = s.run_id
             WHERE s.agent_id = $1 AND s.status = 'running' AND r.status = 'running'
             LIMIT 1`, [agentId]
          );
          if (runningStep) {
            // peek-recovery FILE_STALE: skip file from previous step
            const _prt = await pgGet<{ started_at: string | null }>(
              "SELECT started_at FROM steps WHERE id = $1", [runningStep.id]
            );
            if (_prt?.started_at && fileStat.mtimeMs < new Date(_prt.started_at).getTime() - 5000) {
              logger.info(`[peek-recovery] Skipping stale ${fileName} (before step start)`, { runId: runningStep.run_id });
              continue;
            }
            // Skip orphan recovery for design step — pre-claim generates screens, recovery would corrupt output
            if (runningStep.step_id === 'design') {
              logger.info(`[peek-recovery] Skipping orphan recovery for design step — pre-claim handles it`, { runId: runningStep.run_id });
              continue;
            }
            // v2026.4.12: Skip orphan recovery for stories step if output lacks STORIES_JSON.
            // Orphaned output from previous step (plan) gets picked up and auto-completes
            // stories with 0 stories, wasting a retry attempt.
            if (runningStep.step_id === 'stories' && !output.includes('STORIES_JSON')) {
              logger.info(`[peek-recovery] Skipping orphan recovery for stories step — output lacks STORIES_JSON`, { runId: runningStep.run_id });
              continue;
            }
            logger.info(`[peek-recovery] Found orphaned output ${fileName} for ${runningStep.step_id} (${agentId}) — auto-completing`, { runId: runningStep.run_id });
            try {
              const { completeStep } = await import("./step-ops.js");
              const result = await completeStep(runningStep.id, output);
              fs.unlinkSync(filePath);
              logger.info(`[peek-recovery] Auto-completed ${runningStep.step_id} from ${fileName}, advanced=${result.advanced}`, { runId: runningStep.run_id });
              break; // One recovery per peek call
            } catch (e) {
              logger.warn(`[peek-recovery] Auto-complete failed for ${fileName}: ${String(e)}`, { runId: runningStep.run_id });
            }
          }
        } catch (e) { logger.debug(`[output-recovery] File read failed: ${String(e).slice(0, 100)}`); }
      }
    } catch (e) { /* non-fatal — /tmp read failed */ }

    // AUTO-PR/peek-claim race fix (2026-04-21): peek must match claim's semantics.
    // Claim returns NO_WORK when all pending stories are dep-blocked AND running stories
    // exist. Peek was previously permissive (just checked "pending exists") — causing
    // infinite HAS_WORK→claim NO_WORK cycle that burned agent sessions with no progress.
    const row = await pgGet<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.agent_id = $1 AND r.status = 'running'
         AND (
          (
            s.status = 'pending'
            AND NOT (
              s.type = 'loop'
              AND COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
              AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
            )
          )
          OR (s.status = 'running' AND s.type = 'loop' AND (
            (
              EXISTS (
                SELECT 1 FROM stories st
                WHERE st.run_id = s.run_id AND st.status = 'pending'
                  AND NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(
                      CASE
                        WHEN st.depends_on IS NULL OR st.depends_on = 'null' OR st.depends_on = ''
                        THEN '[]'::jsonb
                        ELSE st.depends_on::jsonb
                      END
                    ) AS dep
                    WHERE NOT EXISTS (
                      SELECT 1 FROM stories d
                      WHERE d.run_id = s.run_id AND d.story_id = dep
                        AND d.status IN ('done', 'failed', 'verified', 'skipped')
                    )
                  )
              )
              AND NOT (
                COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
                AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
              )
            )
            OR (
              NOT (COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb)
              AND EXISTS (SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'done')
            )
          ))
         )`, [agentId]
    );
    return (row?.cnt ?? 0) > 0 ? "HAS_WORK" : "NO_WORK";
}

// ── Claim ───────────────────────────────────────────────────────────

interface ClaimResult {
  found: boolean;
  stepId?: string;
  runId?: string;
  resolvedInput?: string;
}

/** Step row as returned by the step selection query in claimStep. */
type StepRow = {
  id: string;
  step_id: string;
  run_id: string;
  input_template: string;
  type: string;
  loop_config: string | null;
  step_status: string;
  current_story_id: string | null;
  retry_count: number;
  output: string | null;
};


// ── Source Tree Injection ────────────────────────────────────────────

/**
 * Generate a compact directory tree of src/ to inject into story context.
 * Helps agents discover existing directories and avoid creating duplicates
 * (e.g., contexts/ when context/ already exists).
 */
function generateSrcTree(repoPath: string): string {
  if (!repoPath || !fs.existsSync(repoPath)) return "";
  const srcDir = path.join(repoPath, "src");
  if (!fs.existsSync(srcDir)) return "";
  
  const lines: string[] = [];
  function walk(dir: string, prefix: string, depth: number) {
    if (depth > 4) return; // max 4 levels deep
    let entries: string[];
    try {
      entries = fs.readdirSync(dir).filter(e => 
        !e.startsWith(".") && e !== "node_modules" && !e.endsWith(".test.tsx") && !e.endsWith(".test.ts")
      ).sort();
    } catch { return; }
    
    const dirs = entries.filter(e => {
      try { return fs.statSync(path.join(dir, e)).isDirectory(); } catch { return false; }
    });
    const files = entries.filter(e => {
      try { return fs.statSync(path.join(dir, e)).isFile(); } catch { return false; }
    });
    
    for (const f of files) lines.push(prefix + f);
    for (const d of dirs) {
      lines.push(prefix + d + "/");
      walk(path.join(dir, d), prefix + "  ", depth + 1);
    }
  }
  
  walk(srcDir, "  ", 0);
  if (lines.length === 0) return "";
  if (lines.length > 80) {
    // Too large — only show directories
    const dirLines = lines.filter(l => l.trimEnd().endsWith("/"));
    return "src/\n" + dirLines.join("\n");
  }
  return "src/\n" + lines.join("\n");
}

// ── Extracted helpers (private, called only from claimStep) ──────────

/**
 * Auto-complete design step with existing HTML files.
 * Shared by .stitch dedup and PRD Generator cache path.
 */
const MIN_STITCH_HTML_BYTES = 1000;

function isReusableStitchHtml(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    if (fs.statSync(filePath).size < MIN_STITCH_HTML_BYTES) return false;
    const head = fs.readFileSync(filePath, "utf-8").slice(0, 4000).toLowerCase();
    if (!head.includes("<html") && !head.includes("<!doctype")) return false;
    if (head.includes("empty html") || head.includes("design not generated")) return false;
    return true;
  } catch {
    return false;
  }
}

function isPrdPseudoDesignScreen(screen: any): boolean {
  const title = String(screen?.title || screen?.name || "").trim().toLowerCase();
  const htmlFile = String(screen?.htmlFile || "").trim().toLowerCase();
  return /\bprd\b/.test(title) || /\bprd\b/.test(htmlFile);
}

function reusableDesignScreens(repoPath: string, htmlFiles: string[]): Array<{ screenId: string; name: string }> {
  const stitchDir = path.join(repoPath, "stitch");
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (Array.isArray(manifest)) {
        return manifest
          .filter((screen: any) => !isPrdPseudoDesignScreen(screen))
          .filter((screen: any) => {
            const sid = String(screen?.screenId || screen?.id || "");
            return sid && isReusableStitchHtml(path.join(stitchDir, sid + ".html"));
          })
          .map((screen: any) => ({
            screenId: String(screen.screenId || screen.id),
            name: String(screen.title || screen.name || screen.screenId || screen.id),
          }));
      }
    } catch (e) {
      logger.warn(`[design-dedup] Manifest parse failed: ${String(e).slice(0, 120)}`, {});
    }
  }

  return htmlFiles
    .filter((file: string) => isReusableStitchHtml(path.join(stitchDir, file)))
    .map((file: string) => ({
      screenId: file.replace(".html", ""),
      name: file.replace(".html", ""),
    }));
}

function expectedDesignScreenCount(repoPath: string): number {
  const manifestPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return 0;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!Array.isArray(manifest)) return 0;
    return manifest.filter((screen: any) => !isPrdPseudoDesignScreen(screen)).length;
  } catch {
    return 0;
  }
}

async function autoCompleteDesignStep(step: StepRow, db: any, htmlFiles: string[], projectId: string): Promise<boolean> {
  const dRepoPath = (await getRunContext(step.run_id))["repo"] || "";
  const dCtx = await getRunContext(step.run_id);
  if (!dRepoPath) return false;

  const reusableScreens = reusableDesignScreens(dRepoPath, htmlFiles);
  const expectedFromManifest = expectedDesignScreenCount(dRepoPath);
  if (expectedFromManifest > 0 && reusableScreens.length < expectedFromManifest) {
    logger.warn(`[design-dedup] Existing design incomplete: ${reusableScreens.length}/${expectedFromManifest} valid HTMLs — waiting for generation`, { runId: step.run_id });
    return false;
  }

  const prdScreenCount = dCtx["prd_screen_count"] ? parseInt(dCtx["prd_screen_count"], 10) : 0;
  if (prdScreenCount > 0 && reusableScreens.length < prdScreenCount) {
    logger.warn(`[design-dedup] Existing design incomplete: ${reusableScreens.length}/${prdScreenCount} valid screens — clearing cache to force regeneration`, { runId: step.run_id });
    if (dRepoPath) {
      try { fs.rmSync(path.join(dRepoPath, "stitch"), { recursive: true, force: true }); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
      try { fs.unlinkSync(path.join(dRepoPath, ".stitch")); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
    }
    return false;
  }

  if (reusableScreens.length === 0) {
    logger.warn(`[design-dedup] Existing design has no valid HTMLs — waiting for generation`, { runId: step.run_id });
    return false;
  }

  const dScreenMap = reusableScreens.map((screen) => ({
    screenId: screen.screenId,
    name: screen.name,
    type: "page",
    description: screen.name,
  }));
  dCtx["stitch_project_id"] = projectId;
  dCtx["screens_generated"] = String(reusableScreens.length);
  dCtx["screen_map"] = JSON.stringify(dScreenMap);
  dCtx["device_type"] = dCtx["device_type"] || "DESKTOP";
  dCtx["design_system"] = dCtx["design_system"] || "reused from existing designs";
  dCtx["design_notes"] = `Reused ${reusableScreens.length} existing screen designs`;
  await updateRunContext(step.run_id, dCtx);
  const dOutput = `STATUS: done\nSTITCH_PROJECT_ID: ${projectId}\nSCREENS_GENERATED: ${reusableScreens.length}\nDESIGN_NOTES: Reused ${reusableScreens.length} screens (auto-skip)`;
  await pgRun("UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3", [dOutput, now(), step.id]);
  logger.info(`[design-dedup] Auto-skipped design — reusing ${reusableScreens.length} valid screens (project ${projectId})`, { runId: step.run_id });
  await advancePipeline(step.run_id);
  return true;
}

/**
 * DESIGN STEP DEDUP: If .stitch + stitch/*.html exist, auto-complete design step.
 * Also auto-skips when stitch/ has ≥2 HTML files from PRD Generator cache.
 * Returns true if the step was auto-completed (caller should return { found: false }).
 */
async function handleDesignDedup(step: StepRow, db: any): Promise<boolean> {
  if (step.step_id !== "design") return false;

  const dRepoPath = (await getRunContext(step.run_id))["repo"] || "";
  if (!dRepoPath) return false;

  const dStitchFile = path.join(dRepoPath, ".stitch");
  const dStitchDir = path.join(dRepoPath, "stitch");

  // Fix 2: Also auto-skip when stitch/ has ≥2 HTML files WITHOUT .stitch file
  // (PRD Generator copies HTML from cache — no .stitch metadata needed)
  if (!fs.existsSync(dStitchDir)) return false;

  const dHtmlFiles = fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html"));

  // Case A: .stitch file exists — validate freshness
  if (fs.existsSync(dStitchFile)) {
    try {
      const dData = JSON.parse(fs.readFileSync(dStitchFile, "utf-8"));
      // Only reuse if .stitch was written DURING this run (prevents cross-run contamination)
      const runRow = await pgGet<any>("SELECT created_at FROM runs WHERE id = $1", [step.run_id]);
      const runCreatedAt = runRow ? new Date(runRow.created_at).getTime() : 0;
      const stitchUpdatedAt = dData.updatedAt ? new Date(dData.updatedAt).getTime() : 0;
      // 60s tolerance: PRD Generator writes .stitch seconds before run starts
      const STALE_TOLERANCE_MS = 60000;
      if (stitchUpdatedAt < (runCreatedAt - STALE_TOLERANCE_MS)) {
        logger.info(`[design-dedup] .stitch is stale (written ${dData.updatedAt}, run started ${runRow?.created_at}) — deleting to force fresh design`, { runId: step.run_id });
        try { fs.unlinkSync(dStitchFile); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        try { fs.rmSync(dStitchDir, { recursive: true, force: true }); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        return false;
      }

      if (dData.projectId && dHtmlFiles.length > 0) {
        return await autoCompleteDesignStep(step, db, dHtmlFiles, dData.projectId);
      }
    } catch (e) { logger.warn(`[design-dedup] .stitch parse error: ${e}`, { runId: step.run_id }); }
  }

  // Case B: No .stitch file but stitch/ has ≥2 HTML files (PRD Generator cache)
  if (dHtmlFiles.length >= 2) {
    logger.info(`[design-dedup] No .stitch file but stitch/ has ${dHtmlFiles.length} HTML files — auto-skipping design step`, { runId: step.run_id });
    return await autoCompleteDesignStep(step, db, dHtmlFiles, "prd-generator-cache");
  }

  return false;
}

/**
 * DEPLOY ENV GUARD: Auto-generate .env for projects with auth/DB before deploy.
 * Mutates the filesystem only (no return value needed).
 */
async function handleDeployEnvGuard(step: StepRow): Promise<void> {
  if (step.step_id !== "deploy") return;

  const dCtx = await getRunContext(step.run_id);
  const repoPath = dCtx["repo"] || "";
  if (!repoPath || fs.existsSync(path.join(repoPath, ".env"))) return;

  const envLines: string[] = [];
  // DB connection — prefer external DB
  const dbUrl = dCtx["database_url"] || "";
  const dbHost = dCtx["db_host"] || process.env.SETFARM_DEFAULT_DB_HOST || "localhost";
  const dbPort = dCtx["db_port"] || process.env.SETFARM_DEFAULT_DB_PORT || "5432";
  const dbName = dCtx["db_name"] || path.basename(repoPath).replace(/-/g, "_");
  const dbUser = dCtx["db_user"] || process.env.SETFARM_DEFAULT_DB_USER || "postgres";
  const dbPass = dCtx["db_password"] || process.env.SETFARM_DEFAULT_DB_PASS || "";
  if (dbUrl) {
    envLines.push(`DATABASE_URL=${dbUrl}`);
  } else {
    // Check if project uses Prisma/DB
    const pkgPath = path.join(repoPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps["prisma"] || allDeps["@prisma/client"] || allDeps["drizzle-orm"] || allDeps["typeorm"]) {
          envLines.push(`DATABASE_URL=postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`);
        }
      } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
    }
  }
  // NextAuth secret
  const pkgPath2 = path.join(repoPath, "package.json");
  if (fs.existsSync(pkgPath2)) {
    try {
      const pkg2 = JSON.parse(fs.readFileSync(pkgPath2, "utf-8"));
      const allDeps2 = { ...pkg2.dependencies, ...pkg2.devDependencies };
      if (allDeps2["next-auth"] || allDeps2["@auth/core"]) {
        const secret = execFileSync("openssl", ["rand", "-base64", "32"], { timeout: 5000 }).toString().trim();
        const hostname = path.basename(repoPath);
        envLines.push(`NEXTAUTH_SECRET=${secret}`);
        envLines.push(`NEXTAUTH_URL=https://${hostname}.setrox.com.tr`);
      }
    } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
  }
  if (envLines.length > 0) {
    fs.writeFileSync(path.join(repoPath, ".env"), envLines.join("\n") + "\n");
    logger.info(`[deploy-env] Generated .env with ${envLines.length} var(s): ${envLines.map(l => l.split("=")[0]).join(", ")}`, { runId: step.run_id });
  }
}

/**
 * Auto-complete stories that already have a PR (open or merged).
 * Checks BOTH running AND pending stories — medic resets running->pending faster
 * than cron claims, so pending stories with PRs must also be caught.
 */
async function autoCompleteStoriesWithPRs(
  step: StepRow,
  runIdPrefix: string,
  context: Record<string, string>,
  db: any,
): Promise<void> {
  const autoCompleteStories = await pgQuery<any>("SELECT * FROM stories WHERE run_id = $1 AND status = 'pending' ORDER BY story_index ASC", [step.run_id]);
  for (const rs of autoCompleteStories) {
    // Build expected branch: {runId_prefix}-{STORY_ID} e.g. "433ff7a1-US-001"
    const storyBranchForCheck = (rs.story_branch || `${runIdPrefix}-${rs.story_id}`).toLowerCase();
    const existingPrUrl = rs.pr_url || "";

    try {
      let prUrl = existingPrUrl;
      let prFound = false;

      if (prUrl) {
        const state = getPRState(prUrl);
        if (state === "MERGED" || state === "OPEN") {
          prFound = true;
        } else if (state === "CLOSED") {
          prFound = tryReopenPR(prUrl, rs.story_id, step.run_id);
        }
      } else if (storyBranchForCheck && context["repo"]) {
        const foundUrl = findPrByBranch(context["repo"], storyBranchForCheck);
        if (foundUrl) {
          prUrl = foundUrl;
          prFound = true;
        }
      }

      // Wave 5 fix #19 (plan: reactive-frolicking-cupcake): validate PR URL
      // format before auto-completing. Previously any non-empty string would
      // auto-complete the story, which meant a malformed or placeholder URL
      // could silently mark work as done. Require the github.com/owner/repo/pull/N
      // shape, and also confirm it belongs to the expected repo.
      const GH_PR_REGEX = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+(?:[?#].*)?$/i;
      const expectedRepoName = (context["repo"] || "").split("/").pop() || "";
      const prUrlValid = prUrl && GH_PR_REGEX.test(prUrl) && (!expectedRepoName || prUrl.includes(`/${expectedRepoName}/`));
      if (prFound && prUrlValid) {
          await pgRun("UPDATE stories SET status = 'done', pr_url = $1, story_branch = $2, updated_at = $3 WHERE id = $4 AND status = 'pending'", [prUrl, storyBranchForCheck, now(), rs.id]);
          await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2 AND current_story_id = $3", [now(), step.id, rs.id]);
        logger.info(`[claim-auto-complete] Story ${rs.story_id} auto-completed — PR exists: ${prUrl}`, { runId: step.run_id });
        emitEvent({ ts: now(), event: "story.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: rs.story_id, storyTitle: rs.title, detail: `Auto-completed — PR exists (${prUrl})` });
      } else if (prFound && !prUrlValid) {
        logger.warn(`[claim-auto-complete] Story ${rs.story_id} has PR "${prUrl}" but format invalid or wrong repo — NOT auto-completing`, { runId: step.run_id });
      }
    } catch (e) {
      logger.warn(`[claim-auto-complete] PR check failed for story ${rs.story_id}: ${String(e)}`, { runId: step.run_id });
    }
  }
}

/**
 * Resolve story_screens from SCREEN_MAP for a given storyId.
 * Mutates context["story_screens"] and optionally context["design_warning"].
 */
async function resolveStoryScreens(
  storyId: string,
  context: Record<string, string>,
  runId: string,
  logPrefix: string,
): Promise<void> {
  const screenMapRaw = context["screen_map"];
  if (!screenMapRaw) return;

  try {
    const screenMap = JSON.parse(screenMapRaw);
    if (Array.isArray(screenMap)) {
      const storyScreens = screenMap
        .filter((s: any) => Array.isArray(s.stories) && s.stories.includes(storyId))
        .map((s: any) => ({
          screenId: s.screenId,
          name: s.name,
          type: s.type,
          htmlFile: `stitch/${s.screenId}.html`,
        }));
      context["story_screens"] = JSON.stringify(storyScreens);
      // Warn if referenced screen HTML files don't exist
      const repoPath = context["repo"] || context["REPO"] || "";
      if (repoPath && storyScreens.length > 0) {
        const missing = storyScreens.filter((s: any) => !fs.existsSync(path.join(repoPath, s.htmlFile)));
        if (missing.length > 0) {
          context["design_warning"] = `WARNING: ${missing.length} design reference file(s) missing: ${missing.map((s: any) => s.htmlFile).join(", ")}. Implement based on screen names and design-tokens.css.`;
          logger.warn(`[${logPrefix}] Missing design files for story ${storyId}: ${missing.map((s: any) => s.htmlFile).join(", ")}`, { runId });
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to parse screen_map for story ${storyId}`, { runId });
    context["story_screens"] = "";
  }
}

/**
 * Inject story-specific context vars after a story is claimed in a loop step.
 * Mutates `context` in-place with current_story, completed_stories, story_screens, etc.
 */
async function injectStoryContext(
  nextStory: any,
  step: StepRow,
  context: Record<string, string>,
): Promise<void> {
  // FIX #5: Clear stale story context at claim time (not just completeStep)
  // Prevents cross-contamination when parallel stories share the same run context
  // ISSUE-1: Preserve story_branch if it was set by pipeline (worktree creation)
  const pipelineStoryBranch = context["story_branch"] || "";
  delete context["pr_url"];
  delete context["story_branch"];
  delete context["current_story_id"];
  delete context["current_story_title"];
  delete context["current_story"];
  delete context["verify_feedback"];

  const story: Story = {
    id: nextStory.id,
    runId: nextStory.run_id,
    storyIndex: nextStory.story_index,
    storyId: nextStory.story_id,
    title: nextStory.title,
    description: nextStory.description,
    acceptanceCriteria: (() => { try { return JSON.parse(nextStory.acceptance_criteria); } catch { logger.warn("Bad acceptance_criteria JSON for story " + nextStory.story_id); return []; } })(),
    status: nextStory.status,
    output: nextStory.output ?? undefined,
    retryCount: nextStory.retry_count,
    maxRetries: nextStory.max_retries,
  };

  const allStories = await getStories(step.run_id);
  const pendingCount = allStories.filter(s => s.status === STORY_STATUS.PENDING || s.status === STORY_STATUS.RUNNING).length;

  context["current_story"] = formatStoryForTemplate(story);
  context["current_story_id"] = story.storyId;
  context["current_story_title"] = story.title;
  context["completed_stories"] = formatCompletedStories(allStories);
  context["stories_remaining"] = String(pendingCount);
  context["progress"] = await readProgressFile(step.run_id);
  context["project_memory"] = await readProjectMemory(context);

  // Wave 14 Bug Q: inject story scope discipline. These come from the planner's
  // STORIES_JSON (scope_files / shared_files / scope_description). Empty when
  // planner did not provide them — developer prompt then falls back to legacy
  // "implement the acceptance criteria" mode. The post-implementation bleed
  // check in completeStep uses these to reject out-of-scope writes.
  try {
    const scopeRow = await pgGet<{ scope_files: string; shared_files: string; scope_description: string; file_skeletons: string }>(
      "SELECT scope_files, shared_files, scope_description, file_skeletons FROM stories WHERE id = $1",
      [nextStory.id]
    );
    if (scopeRow?.scope_files) {
      try {
        const list = JSON.parse(scopeRow.scope_files);
        if (Array.isArray(list) && list.length > 0) {
          context["story_scope_files"] = list.join(", ");
        }
      } catch (e) { logger.debug(`[context] Malformed JSON: ${String(e).slice(0, 80)}`); }
    }
    if (scopeRow?.shared_files) {
      try {
        const list = JSON.parse(scopeRow.shared_files);
        if (Array.isArray(list) && list.length > 0) {
          context["story_shared_files"] = list.join(", ");
        }
      } catch (e) { logger.debug(`[context] Malformed JSON: ${String(e).slice(0, 80)}`); }
    }
    if (scopeRow?.scope_description) {
      context["story_scope_description"] = scopeRow.scope_description;
    }
    // file_skeletons: function signatures from stories step to guide implementation
    if (scopeRow?.file_skeletons) {
      try {
        const skeletons = JSON.parse(scopeRow.file_skeletons);
        if (typeof skeletons === "object" && Object.keys(skeletons).length > 0) {
          context["file_skeletons"] = Object.entries(skeletons)
            .map(([filePath, sig]) => `${filePath}:\n${sig}`)
            .join("\n\n");
        }
      } catch (e) { logger.debug(`[context] Malformed JSON: ${String(e).slice(0, 80)}`); }
    }
    // 5-model consensus: write .story-scope-files to worktree for pre-commit hook
    if (context["story_scope_files"] && context["story_workdir"]) {
      try {
        const scopeList = context["story_scope_files"].split(", ");
        // v2026.4.13: Include shared_files so dep-merge expanded files are allowed by hook
        const sharedList = context["story_shared_files"] ? context["story_shared_files"].split(", ") : [];
        // Add IMPLICIT_SHARED patterns
        const implicitFiles = ["vitest.config.ts","vitest.config.js","jest.config.ts","jest.config.js","src/test/setup.ts","src/test/utils.ts","src/setupTests.ts"];
        const allAllowed = [...new Set([...scopeList, ...sharedList, ...implicitFiles])];
        // Also allow *.test.tsx and *.spec.tsx (wildcard — hook uses grep -qxF so these wont match, but test files are caught by the hook logic)
        const _scopeFP = path.join(context["story_workdir"], ".story-scope-files"); fs.writeFileSync(_scopeFP, allAllowed.join("\n") + "\n"); try { fs.chmodSync(_scopeFP, 0o664); } catch { /* best effort */ }
      } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
    }
    // 5-model consensus: always inject scope_reminder (even on first attempt)
    if (context["story_scope_files"]) {
      context["scope_reminder"] = "SCOPE ENFORCEMENT: You may ONLY write files in [" + context["story_scope_files"] + "]. Test files (*.test.tsx) and test config (vitest.config.ts, src/test/setup.ts) are also allowed. App.tsx, main.tsx, index.css are FORBIDDEN unless in your scope_files. Violation = instant SCOPE_BLEED rejection.";
    }
  } catch (e) {
    // Column may not exist on very old schemas — degrade gracefully
    logger.debug(`[scope-inject] Could not read story scope columns: ${String(e).slice(0, 120)}`);
  }

  // FIX: Clear stale story-specific context from previous story to prevent cross-contamination
  context["pr_url"] = "";
  // ISSUE-1: Restore pipeline-set story_branch (from worktree) instead of blanking it
  context["story_branch"] = pipelineStoryBranch;
  context["verify_feedback"] = "";

  // Inject source tree so agent knows existing file structure (prevents duplicate dirs)
  const repoPath = context["repo"] || context["REPO"] || "";
  if (repoPath && !context["src_tree"]) {
    const srcTree = generateSrcTree(repoPath);
    if (srcTree) {
      context["src_tree"] = srcTree;
    }
  }

  // Resolve story_screens from SCREEN_MAP
  await resolveStoryScreens(story.storyId, context, step.run_id, "story-claim");

  // Inject stitch HTML content for this story's screens into context
  // This embeds the actual HTML into the prompt so the agent doesn't need to read files
  const storyScreensRaw = context["story_screens"] || "[]";
  try {
    const storyScreensParsed = JSON.parse(storyScreensRaw);
    const repoPath = context["repo"] || context["REPO"] || "";
    if (Array.isArray(storyScreensParsed) && storyScreensParsed.length > 0 && repoPath) {
      let stitchHtmlContent = "";
      for (const screen of storyScreensParsed) {
        const htmlFile = path.join(repoPath, screen.htmlFile || `stitch/${screen.screenId}.html`);
        if (fs.existsSync(htmlFile)) {
          const html = fs.readFileSync(htmlFile, "utf-8");
          const excerpt = html.replace(/\s+/g, " ").trim();
          const truncated = excerpt.length > STITCH_HTML_EXCERPT_CHARS
            ? excerpt.slice(0, STITCH_HTML_EXCERPT_CHARS) + " ...(truncated; read file for full HTML)"
            : excerpt;
          stitchHtmlContent += `\nSTITCH SCREEN: ${screen.name || screen.screenId}\nFILE: ${screen.htmlFile || `stitch/${screen.screenId}.html`}\nHTML_EXCERPT: ${truncated}\n`;
          if (stitchHtmlContent.length > STITCH_HTML_TOTAL_CHARS) {
            stitchHtmlContent = stitchHtmlContent.slice(0, STITCH_HTML_TOTAL_CHARS) + "\n...(truncated; read stitch files for full design)\n";
            break;
          }
        }
      }
      if (stitchHtmlContent) {
        context["stitch_html"] = stitchHtmlContent;
        // P2-08: Don't persist stitch_html to DB context (prevents 200K+ blob growth)
        // It will be used in resolvedInput but deleted before updateRunContext
        context["_stitch_html_transient"] = "true";
        logger.info(`[stitch-html-inject] Injected ${storyScreensParsed.length} screen HTML(s) into context for story ${story.storyId} (${stitchHtmlContent.length} chars)`, { runId: step.run_id });
      }
    }
  } catch (e) {
    logger.warn(`[stitch-html-inject] Failed to inject stitch HTML: ${String(e)}`, { runId: step.run_id });
  }

  // Inject DESIGN_DOM for element-level coding guidance
  try {
    const storyScreensForDom = JSON.parse(context["story_screens"] || "[]");
    const repoDom = context["repo"] || context["REPO"] || "";
    const designDomPath = path.join(repoDom, "stitch", "DESIGN_DOM.json");
    if (repoDom && fs.existsSync(designDomPath)) {
      const fullDom = JSON.parse(fs.readFileSync(designDomPath, "utf-8"));
      if (fullDom.screens) {
        const storyScreenIds = storyScreensForDom.map((s: any) => s.screenId);
        const filteredScreens: Record<string, any> = {};
        for (const sid of storyScreenIds) {
          if (fullDom.screens[sid]) filteredScreens[sid] = fullDom.screens[sid];
        }
        const domToInject = Object.keys(filteredScreens).length > 0 ? filteredScreens : fullDom.screens;
        const domJson = JSON.stringify(domToInject);
        context["design_dom"] = domJson.length > DESIGN_DOM_EXCERPT_CHARS
          ? domJson.substring(0, DESIGN_DOM_EXCERPT_CHARS) + "...(truncated; read stitch/DESIGN_DOM.json for full DOM)"
          : domJson;
      }
    }
  } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }

  // ── Smart Context Injection — only for implement step ───────────
  if (step.step_id === "implement") {
    const repoPath = context["repo"] || "";
    const workdir = context["story_workdir"] || repoPath;
    if (workdir) {
      try {
        const projectTree = getProjectTree(workdir);
        if (projectTree) context["project_tree"] = projectTree;

        const packages = getInstalledPackages(workdir);
        if (packages) context["installed_packages"] = packages;

        const sharedCode = getSharedCode(workdir);
        if (sharedCode) context["shared_code"] = sharedCode;

        const recentCode = await getRecentStoryCode(step.run_id, repoPath, story.storyId);
        if (recentCode) context["recent_stories_code"] = recentCode;

        const components = getComponentRegistry(workdir);
        if (components) context["component_registry"] = components;

        const apiRoutes = getApiRoutes(workdir);
        if (apiRoutes) context["api_routes"] = apiRoutes;

        logger.info(`[smart-context] Injected: tree=${projectTree.length}c packages=${packages.length}c shared=${sharedCode.length}c recent=${recentCode.length}c components=${components.length}c api=${apiRoutes.length}c`, { runId: step.run_id });

        // Truncate if total context is too large (>200K estimated tokens)
        const totalChars = Object.values(context).reduce((sum, v) => sum + (v?.length || 0), 0);
        const estimatedTokens = Math.ceil(totalChars / 4);
        if (estimatedTokens > 200000) {
          context["recent_stories_code"] = (context["recent_stories_code"] || "").slice(0, 20000);
          context["shared_code"] = (context["shared_code"] || "").slice(0, 15000);
          logger.warn(`[smart-context] Context too large (${estimatedTokens} tokens est.), truncated`, { runId: step.run_id });
        }
      } catch (e) {
        logger.warn(`[smart-context] Injection failed: ${String(e)}`, { runId: step.run_id });
      }
    }
  }

  // ── Platform-Specific Design Rules Injection ────────────────────────
  if (step.step_id === "implement" || step.step_id === "verify") {
    try {
      const { detectPlatform, getDesignRules } = await import("./design-rules.js");
      const platform = detectPlatform(context["repo"] || "");
      context["design_rules"] = getDesignRules(platform);
      context["detected_platform"] = platform;
    } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
  }

  // Default optional template vars to prevent MISSING_INPUT_GUARD false positives (story-each flow)
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }

  // Persist story context vars to DB so verify_each steps can access them
  await updateRunContext(step.run_id, context);

  // v1.5.50: Inject previous_failure from prior abandon output
  if (nextStory.output && (nextStory.abandoned_count > 0 || nextStory.retry_count > 0)) {
    const { classifyError } = await import("./error-taxonomy.js");
    const classified = classifyError(nextStory.output);
    context["previous_failure"] = nextStory.output;
    context["failure_category"] = classified.category;
    context["failure_suggestion"] = classified.suggestion;
  }
}

/**
 * Inject verify-each story context for the single-step verify claim path.
 * Mutates `context` in-place and updates DB context.
 * Returns false if all stories were auto-verified (caller should return { found: false }).
 */
async function injectVerifyContext(
  step: StepRow,
  context: Record<string, string>,
  db: any,
): Promise<boolean> {
  const loopStepForVerify = await findLoopStep(step.run_id);
  if (!loopStepForVerify?.loop_config) return true;

  const lcCheck: LoopConfig = JSON.parse(loopStepForVerify.loop_config);
  if (!lcCheck.verifyEach || lcCheck.verifyStep !== step.step_id) return true;

  // Auto-verify stories whose PRs are already merged/closed-with-ancestry.
  // Also auto-merges OPEN PRs after abandonment (prevents "son mil" loop).
  const nextUnverified = await autoVerifyDoneStories(step.run_id, context, "claim-auto-verify", { autoMergeOpen: true });

  if (!nextUnverified) {
    // All stories auto-verified — no agent work needed, advance pipeline
    await pgRun("UPDATE steps SET status = 'waiting', updated_at = $1 WHERE id = $2", [now(), step.id]);
    logger.info(`[claim-auto-verify] All stories auto-verified, triggering pipeline advancement`, { runId: step.run_id });
    try { await checkLoopContinuation(step.run_id, loopStepForVerify.id); } catch (e) { logger.error("[claim-auto-verify] checkLoopContinuation failed: " + String(e), { runId: step.run_id }); }
    return false;
  }

  // Inject unverified story context for agent verification
  if (nextUnverified.output) {
    const storyOutput = parseOutputKeyValues(nextUnverified.output);
    for (const [key, value] of Object.entries(storyOutput)) {
      if (PROTECTED_CONTEXT_KEYS.has(key) && context[key]) continue;
      context[key] = value;
    }
  }
  // Override with DB columns if available (more reliable than output parse)
  if (nextUnverified.pr_url) context["pr_url"] = nextUnverified.pr_url;
  if (nextUnverified.story_branch) context["story_branch"] = nextUnverified.story_branch;
  context["current_story_id"] = nextUnverified.story_id;
  context["current_story_title"] = nextUnverified.title;
  const storyObj: Story = {
    id: nextUnverified.id, runId: nextUnverified.run_id,
    storyIndex: nextUnverified.story_index, storyId: nextUnverified.story_id,
    title: nextUnverified.title, description: nextUnverified.description,
    acceptanceCriteria: (() => { try { return JSON.parse(nextUnverified.acceptance_criteria); } catch { logger.warn("Bad acceptance_criteria JSON for story " + nextUnverified.story_id); return []; } })(),
    status: nextUnverified.status, output: nextUnverified.output,
    retryCount: nextUnverified.retry_count, maxRetries: nextUnverified.max_retries,
  };
  context["current_story"] = formatStoryForTemplate(storyObj);

  // Resolve story_screens from SCREEN_MAP for verify_each
  await resolveStoryScreens(nextUnverified.story_id, context, step.run_id, "verify-claim");

  await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);
  logger.info(`Verify step: injected story ${nextUnverified.story_id} context`, { runId: step.run_id });

  return true;
}

/**
 * Claim a single (non-loop) step: atomic claim, optional verify context injection,
 * progress/stories injection, and missing-input guard.
 * Returns a ClaimResult.
 */
async function claimSingleStep(
  step: StepRow,
  agentId: string,
  context: Record<string, string>,
  db: any,
): Promise<ClaimResult> {
  // Single-step idempotency: some models run `step claim` twice and overwrite
  // their claim file. If this role already owns a running non-loop step, reissue
  // the same claim instead of returning NO_WORK and orphaning the step.
  if (step.step_status === "running") {
    logger.info(`[claim-idempotent] Re-issued running step ${step.step_id} to ${agentId}`, { runId: step.run_id, stepId: step.step_id });
  } else {
    // Item 6: Single step — atomic claim with changes check to prevent race condition
    let _claimChanges: number;
    const _cr = await pgRun("UPDATE steps SET status = 'running', started_at = NOW(), updated_at = $1 WHERE id = $2 AND status = 'pending'", [now(), step.id]);
    _claimChanges = _cr.changes;
    if (_claimChanges === 0) {
      // Already claimed by another cron — return no work
      return { found: false };
    }
    await recordStepTransition(step.id, step.run_id, "pending", "running", agentId, "claimSingleStep");
    emitEvent({ ts: now(), event: "step.running", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
    logger.info(`Step claimed by ${agentId}`, { runId: step.run_id, stepId: step.step_id });

    // v1.5.50: Record single step claim in claim_log
    try {
      await pgRun("INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, $2, NULL, $3, $4)", [step.run_id, step.step_id, agentId, now()]);
    } catch (e) { logger.warn(`[claim-log] Failed to record claim: ${String(e)}`, { runId: step.run_id }); }
  }

  // Inject previous failure context so agent knows what to fix on retry
  if (step.retry_count > 0 && step.output) {
    const { classifyError } = await import("./error-taxonomy.js");
    const classified = classifyError(step.output);
    context["previous_failure"] = step.output;
    context["failure_category"] = classified.category;
    context["failure_suggestion"] = classified.suggestion;
    logger.info(`[claim] Injected previous_failure (${classified.category}) for retry ${step.retry_count} of ${step.step_id}`, { runId: step.run_id });
  }

  // #260: Default optional template vars to prevent MISSING_INPUT_GUARD false positives
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }

  // Inject progress for any step in a run that has stories
  const hasStories = await pgGet<{ cnt: number }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1", [step.run_id]);
  if ((hasStories?.cnt ?? 0) > 0) {
    context["progress"] = await readProgressFile(step.run_id);
    context["project_memory"] = await readProjectMemory(context);

    // Inject stories_json for non-loop steps that need it
    const allStoriesForCtx = await getStories(step.run_id);
    const storiesForTemplate = allStoriesForCtx.map(s => ({
      id: s.storyId,
      title: s.title,
      description: s.description,
      acceptanceCriteria: s.acceptanceCriteria,
    }));
    context["stories_json"] = JSON.stringify(storiesForTemplate, null, 2);
  }

  // (Stories predicted_screen_files inject moved to 03-stories/context.ts —
  // invoked via the step-module claim delegation block.)

  // BUG FIX: If this is a verify step for a verify_each loop, inject the correct
  // story info from the oldest unverified 'done' story (not from stale context).
  if (!await injectVerifyContext(step, context, db)) {
    return { found: false };
  }

  // ═══ VERIFY PRE-FLIGHT: Static analysis for verify step speedup ═══
  if (step.step_id === "verify" && context["repo"] && (context["story_branch"] || context["branch"])) {
    try {
      const { buildPreFlightReport, formatPreFlightForAgent } = await import("./static-analysis.js");
      const analysisBranch = context["story_branch"] || context["branch"];
      const report = buildPreFlightReport(context["repo"], analysisBranch);
      context["preflight_analysis"] = formatPreFlightForAgent(report);
      context["preflight_diff"] = report.diffSummary;
      context["preflight_errors"] = report.eslintErrors + "\n" + report.tscErrors;
      logger.info(`[preflight] Verify pre-flight: ${report.changedFiles.length} files, ${report.totalIssues} issue(s)`, { runId: step.run_id });
    } catch (e) {
      logger.warn(`[preflight] Skipped: ${String(e)}`, { runId: step.run_id });
    }
  }

  // (Design pre-claim moved to src/installer/steps/02-design/preclaim.ts —
  // invoked by the step-module delegation block below as module.preClaim.)

  // PR REVIEW DELAY GATE: Wait for external review comments (Gemini, Copilot) before verify claim
  // BUG FIX: Previously used step.updated_at as baseline but updated it on every defer, resetting
  // the timer infinitely. Now uses context["verify_pending_since"] as stable baseline.
  const reviewPrUrl = context["final_pr"] || context["pr_url"] || "";
  if (step.step_id === "verify" && reviewPrUrl) {
    let hasReviewSignal = false;
    try {
      const { fetchPrState, formatPrCommentsForAgent } = await import("./steps/07-verify/pr-comments.js");
      const state = await fetchPrState(reviewPrUrl, context["repo_full"] || "");
      if (state) {
        const formatted = formatPrCommentsForAgent(state);
        if (formatted) context["pr_comments"] = formatted;
        context["pr_check_state"] = state.checksStatus || "";
        context["pr_mergeable"] = state.mergeable || "";
        context["pr_merge_state_status"] = state.mergeStateStatus || "";
        hasReviewSignal =
          state.comments.length > 0 ||
          state.checksStatus === "failing" ||
          state.mergeable === "CONFLICTING" ||
          ["DIRTY", "BLOCKED"].includes(state.mergeStateStatus || "");
      }
    } catch (e) {
      logger.warn(`[review-delay] PR signal check failed: ${String(e).slice(0, 160)}`, { runId: step.run_id, stepId: step.step_id });
    }
    if (context["verify_pending_pr_url"] !== reviewPrUrl) {
      context["verify_pending_pr_url"] = reviewPrUrl;
      context["verify_pending_since"] = new Date().toISOString();
      await updateRunContext(step.run_id, context);
    }
    if (!context["verify_pending_since"]) {
      context["verify_pending_since"] = new Date().toISOString();
      await updateRunContext(step.run_id, context);
    }
    const elapsed = Date.now() - new Date(context["verify_pending_since"]).getTime();
    if (!hasReviewSignal && elapsed < PR_REVIEW_DELAY_MS) {
      const remaining = Math.round((PR_REVIEW_DELAY_MS - elapsed) / 1000);
      logger.info(`[review-delay] PR review delay: ${remaining}s remaining — deferring verify claim`, { runId: step.run_id, stepId: step.step_id });
      // Revert status to pending so next cron can retry — DO NOT touch updated_at
      await pgRun("UPDATE steps SET status = 'pending' WHERE id = $1", [step.id]);
      return { found: false };
    }
    if (hasReviewSignal) {
      logger.info(`[review-delay] PR already has review/check signal — skipping wait`, { runId: step.run_id, stepId: step.step_id });
    }
    // Delay passed — clean up marker so a future retry starts fresh
    delete context["verify_pending_since"];
    delete context["verify_pending_pr_url"];
    await updateRunContext(step.run_id, context);
  }

  // Default optional template vars for non-story steps (design, security-gate, etc.)
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }
  // Wave 14 Bug K: per-step context allowlist. Strips PROTECTED keys (DB
  // credentials, API tokens) and non-allowlisted bloat before template
  // resolution. DB-persisted run.context is untouched — only the agent
  // prompt is trimmed. See constants.ts STEP_CONTEXT_ALLOWLIST for the list.
  const prunedContextSingle = pruneContextForStep(context, step.step_id);
  const contextBytesBefore = JSON.stringify(context).length;
  const contextBytesAfter = JSON.stringify(prunedContextSingle).length;
  if (contextBytesBefore > contextBytesAfter + 1000) {
    logger.info(`[context-prune] ${step.step_id}: ${contextBytesBefore}→${contextBytesAfter} bytes (${Math.round((1 - contextBytesAfter / contextBytesBefore) * 100)}% trimmed)`, { runId: step.run_id });
  }
  // (Stories first-attempt reminder moved to 03-stories/context.ts — invoked
  // via the step-module claim delegation block below.)
  // (Plan step reminder is owned by the plan module's injectContext.)

  // Step module claim-side delegation (v2026-04-14). Order:
  //   1. preClaim — heavy work BEFORE agent claims (Stitch API for design step)
  //   2. injectContext — inject step-specific context vars
  // Both share the same pruned context object so changes flow into the agent's
  // resolved prompt below.
  try {
    const _modRegistry = await import("./steps/registry.js");
    const _stepModule = _modRegistry.get(step.step_id);
    if (_stepModule) {
      const _modCtx = {
        runId: step.run_id,
        stepId: step.step_id,
        task: prunedContextSingle["task"] || prunedContextSingle["TASK"] || "",
        retryCount: step.retry_count,
        context: prunedContextSingle,
      };
      if (_stepModule.preClaim) {
        try {
          await _stepModule.preClaim(_modCtx);
          await updateRunContext(step.run_id, prunedContextSingle);
          // Refresh both started_at AND updated_at so medic's checkClaimedButStuck
          // measures agent runtime, not preClaim duration. (Medic uses updated_at
          // — not started_at — so we must touch updated_at too.)
          await pgRun("UPDATE steps SET started_at = $1, updated_at = $1 WHERE id = $2", [now(), step.id]);
          logger.info(`[step-module] ${_stepModule.id} preClaim ok — timestamps refreshed`, { runId: step.run_id });
          const postPreClaimStep = await pgGet<{ status: string }>("SELECT status FROM steps WHERE id = $1", [step.id]);
          if (postPreClaimStep && postPreClaimStep.status !== "running") {
            logger.info(`[step-module] ${_stepModule.id} preClaim changed step status to ${postPreClaimStep.status}; skipping agent spawn`, { runId: step.run_id, stepId: step.step_id });
            return { found: false };
          }
        } catch (_pce) {
          logger.warn(`[step-module] ${_stepModule.id} preClaim failed (non-fatal): ${String(_pce).slice(0, 200)}`, { runId: step.run_id });
        }
      }
      await _stepModule.injectContext(_modCtx);
    }
  } catch (_ie) {
    logger.warn(`[step-module] injectContext failed: ${String(_ie).slice(0, 200)}`, { runId: step.run_id });
  }
  let resolvedInput = resolveTemplate(step.input_template, prunedContextSingle);

  // Step module takeover: if a module is registered for this step, its
  // buildPrompt() replaces the workflow.yml input_template output. This is
  // how the module's prompt.md + rules.md actually reach the agent (Faz 2
  // of the module pilot — without this, AGENTS.md stays the source of truth
  // and the module's prompt sits unused).
  try {
    const _modRegistryP = await import("./steps/registry.js");
    const _stepModuleP = _modRegistryP.get(step.step_id);
    if (_stepModuleP) {
      const _modulePrompt = _stepModuleP.buildPrompt({
        runId: step.run_id,
        task: prunedContextSingle["task"] || prunedContextSingle["TASK"] || "",
        context: prunedContextSingle,
      });
      if (_modulePrompt && _modulePrompt.length > 0) {
        if (_modulePrompt.length > _stepModuleP.maxPromptSize) {
          logger.warn(`[step-module] ${_stepModuleP.id} prompt ${_modulePrompt.length} > budget ${_stepModuleP.maxPromptSize} — using anyway, investigate`, { runId: step.run_id });
        }
        resolvedInput = _modulePrompt;
        logger.info(`[step-module] ${_stepModuleP.id} buildPrompt override (${_modulePrompt.length}b)`, { runId: step.run_id });
      }
    }
  } catch (_pe) {
    logger.warn(`[step-module] buildPrompt failed (falling back to template): ${String(_pe).slice(0, 200)}`, { runId: step.run_id });
  }

  // MISSING_INPUT_GUARD (v1.5.53): First miss -> retry step, second -> fail run.
  // WAL race condition can cause false positives — one retry absorbs that.
  const allMissing = [...new Set([...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase()))];
  if (allMissing.length > 0) {
    const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input`;
    // Check step's retry_count to decide retry vs fail
    const stepRetry = await pgGet<{ retry_count: number }>("SELECT retry_count FROM steps WHERE id = $1", [step.id]);
    const retryCount = stepRetry?.retry_count ?? 0;
    logger.warn(`${reason} (retry=${retryCount})`, { runId: step.run_id, stepId: step.step_id });
    if (retryCount > 0) {
      // Second occurrence — fail run (Wave 13 J-2: mark terminal so medic won't revive)
      await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [reason + " — failing run (retry exhausted)", now(), step.id]);
      await failRun(step.run_id, true);
      const wfId = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: reason });
      emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: reason });
      scheduleRunCronTeardown(step.run_id);
    } else {
      // First occurrence — retry step (possible WAL lag)
      await pgRun("UPDATE steps SET status = 'pending', retry_count = retry_count + 1, output = $1, updated_at = $2 WHERE id = $3", [reason + " — retrying once", now(), step.id]);
      logger.info(`[missing-input] Step ${step.step_id} will retry — possible WAL lag`, { runId: step.run_id });
    }
    return { found: false };
  }

  return {
    found: true,
    stepId: step.id,
    runId: step.run_id,
    resolvedInput,
  };
}

// ── End extracted helpers ────────────────────────────────────────────

/**
 * Throttle cleanupAbandonedSteps: run at most once every 30 seconds (matches cron interval).
 */
let lastCleanupTime = 0;

/**
 * Find and claim a pending step for an agent, returning the resolved input.
 */
export async function claimStep(agentId: string, callerGatewayAgent?: string): Promise<ClaimResult> {
  // Throttle cleanup: run at most once every 5 minutes across all agents
  const epochMs = Date.now();
  if (epochMs - lastCleanupTime >= CLEANUP_THROTTLE_MS) {
    await cleanupAbandonedSteps();
    lastCleanupTime = epochMs;
  }

  // OUTPUT RECOVERY: If a previous agent session died after writing output but before completing,
  // recover the output. Scans all setfarm-output-*.txt files (each parallel agent has its own).
  try {
    // FIX (2026-04-14 cross-contamination): restrict to caller-owned tmp file
    // when callerGatewayAgent is provided. See peekStep for rationale.
    const tmpFiles = callerGatewayAgent
      ? (fs.existsSync(`/tmp/setfarm-output-${callerGatewayAgent}.txt`) ? [`setfarm-output-${callerGatewayAgent}.txt`] : [])
      : fs.readdirSync('/tmp').filter(f => f.startsWith('setfarm-output-') && f.endsWith('.txt'));
    for (const fileName of tmpFiles) {
      const filePath = `/tmp/${fileName}`;
      try {
        const recoveryOutput = fs.readFileSync(filePath, 'utf-8').trim();
        if (!recoveryOutput.includes('STATUS:')) continue;
        const runningStep = await pgGet<{ id: string; step_id: string; run_id: string }>(
          `SELECT s.id, s.step_id, s.run_id FROM steps s JOIN runs r ON r.id = s.run_id
           WHERE s.agent_id = $1 AND s.status = 'running' AND r.status = 'running'
           LIMIT 1`, [agentId]
        );
        if (runningStep) {
          // Skip orphan recovery for design step — pre-claim generates screens, recovery would corrupt output
          if (runningStep.step_id === 'design') {
            logger.info(`[output-recovery] Skipping orphan recovery for design step — pre-claim handles it`, { runId: runningStep.run_id });
            continue;
          }
          // v2026.4.12: Skip stories step if output lacks STORIES_JSON — prevents 0-stories auto-complete
          if (runningStep.step_id === 'stories' && !recoveryOutput.includes('STORIES_JSON')) {
            logger.info(`[output-recovery] Skipping orphan recovery for stories step — output lacks STORIES_JSON`, { runId: runningStep.run_id });
            continue;
          }
          logger.info(`[output-recovery] Found orphaned ${fileName} for ${runningStep.step_id} — auto-completing`, { runId: runningStep.run_id });
          try {
            const { completeStep } = await import("./step-ops.js");
            await completeStep(runningStep.id, recoveryOutput);
            fs.unlinkSync(filePath);
            return { found: false };
          } catch (e) {
            logger.warn(`[output-recovery] Auto-complete failed for ${fileName}: ${String(e)}`, { runId: runningStep.run_id });
          }
        }
      } catch (e) { logger.debug(`[output-recovery] Single file failed: ${String(e).slice(0, 80)}`); }
    }
  } catch (e) { logger.warn(`[output-recovery] Check failed: ${String(e)}`, {}); }

  // Allow claiming from both pending AND running loop steps (parallel story execution)
  //
  // DEVELOPER-POOL AWARE SELECTION:
  // For implement steps (the only pool-based step), restrict candidates to runs
  // that are either unassigned or assigned to THIS caller. Without this filter,
  // the LIMIT 1 could return a step belonging to another developer's run; the
  // downstream CAS would then fail and the caller would return NO_WORK even
  // though another claimable run exists (starvation bug — 2026-04-14 postmortem).
  // Also prefer own-run (0), then unassigned (1), so an already-reserved
  // developer resumes their own work before picking up a new one.
  const step = await pgGet<StepRow>(
        `SELECT s.id, s.step_id, s.run_id, s.input_template, s.type, s.loop_config, s.status as step_status, s.current_story_id, s.retry_count, s.output
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         WHERE s.agent_id = $1
           AND (s.status = 'pending' OR s.status = 'running')
           AND r.status NOT IN ('failed', 'cancelled')
           AND (
             $2::text IS NULL
             OR s.step_id <> 'implement'
             OR r.assigned_developer IS NULL
             OR r.assigned_developer = $2
           )
           AND NOT EXISTS (
             SELECT 1 FROM steps prev
	             WHERE prev.run_id = s.run_id
	               AND prev.step_index < s.step_index
	               AND prev.status NOT IN ('done', 'failed', 'skipped', 'verified')
	               AND NOT (prev.type = 'loop' AND prev.status = 'running')
	               AND NOT (
	                 prev.type = 'loop'
	                 AND prev.status = 'pending'
	                 AND COALESCE(prev.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
	                 AND COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id
	                 AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
	               )
	           )
         ORDER BY
           CASE
             WHEN s.status = 'running' THEN 0
             WHEN $2::text IS NOT NULL AND r.assigned_developer = $2 THEN 0
             WHEN r.assigned_developer IS NULL THEN 1
             ELSE 2
           END,
           s.step_index ASC, s.status ASC
         LIMIT 1`, [agentId, callerGatewayAgent ?? null]);

  if (!step) return { found: false };

  // Guard: don't claim work for a failed run
  if (await getRunStatus(step.run_id) === RUN_STATUS.FAILED) return { found: false };

  // DESIGN STEP DEDUP
  if (await handleDesignDedup(step, null)) return { found: false };

  // DEPLOY ENV GUARD
  await handleDeployEnvGuard(step);

  // Get run context
  const context: Record<string, string> = await getRunContext(step.run_id);

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
    const loopConfig: LoopConfig | null = parseLoopConfigSafe(step.loop_config, step.run_id);
    if (loopConfig?.over === "stories") {
      const isPrEach = loopConfig?.mergeStrategy === "pr-each" || !!loopConfig?.verifyEach;
      // Bug C fix (plan: reactive-frolicking-cupcake.md, run #342 postmortem):
      // Capture the base branch's commit SHA on the FIRST claim of the implement
      // loop and store it in context. All story worktrees in this loop must be
      // created from the SAME commit, even if setup-build later writes more
      // commits to the same branch (which run #342 actually did — there was a
      // 269c2df setup-build commit, then a 9c26285 follow-up after the agent
      // already reported done; US-001's worktree was on 269c2df while US-002+
      // were on 9c26285, and the merge queue then conflicted on package.json
      // because the bases diverged).
      //
      // Once captured, the value is sticky for the lifetime of a direct-merge
      // implement step. pr-each intentionally uses moving main after each PR merge.
      if (isPrEach && context["implement_base_commit"]) {
        delete context["implement_base_commit"];
        await updateRunContext(step.run_id, context);
        logger.info(`[implement] Cleared pinned base commit because pr-each uses main after each merge`, { runId: step.run_id });
      }
      if (!isPrEach && context["repo"] && context["branch"] && !context["implement_base_commit"]) {
        try {
          const sha = execFileSync("git", ["rev-parse", context["branch"]], {
            cwd: context["repo"], encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
          }).trim();
          if (/^[0-9a-f]{40}$/i.test(sha)) {
            context["implement_base_commit"] = sha;
            await updateRunContext(step.run_id, context);
            logger.info(`[implement] Captured base commit ${sha.slice(0, 8)} from ${context["branch"]} — all story worktrees will be created from this SHA`, { runId: step.run_id });
          }
        } catch (e) {
          logger.warn(`[implement] Could not capture base commit for ${context["branch"]}: ${String(e).slice(0, 150)}`, { runId: step.run_id });
        }
      }

      // Idempotent loop claim: some agents may accidentally run `step claim` twice.
      // The first call moves the story to running; the second used to return NO_WORK
      // and overwrite the claim file, leaving the story orphaned. Re-issue the same
      // running story to this role instead of burning the claim.
      if (step.current_story_id) {
        const runningStory = await pgGet<any>("SELECT * FROM stories WHERE id = $1 AND run_id = $2 AND status = 'running'", [step.current_story_id, step.run_id]);
        if (runningStory && (!runningStory.claimed_by || runningStory.claimed_by === agentId)) {
          const storyBranch = (runningStory.story_branch || `${step.run_id.slice(0, 8)}-${runningStory.story_id}`).toLowerCase();
          context["story_branch"] = storyBranch;
          if (context["repo"]) {
            const storyWorkdir = findWorktreeDir(context["repo"], storyBranch, agentId) || findWorktreeDir(context["repo"], runningStory.story_id, agentId) || "";
            if (storyWorkdir) context["story_workdir"] = storyWorkdir;
          }
          context["claim_generation"] = String(runningStory.claim_generation ?? 0);
          await injectStoryContext(runningStory, step, context);
          if (step.step_id === "implement") {
            try {
              const { buildTestGenerationPrompt } = await import("./test-generation.js");
              const techStack = context["tech_stack"] || "react";
              const acceptanceCriteria = runningStory.title || "";
              context["test_generation_prompt"] = buildTestGenerationPrompt(runningStory.title, acceptanceCriteria, techStack);
            } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
          }
          const prunedContextLoop = pruneContextForStep(context, step.step_id);
          const resolvedInput = resolveTemplate(step.input_template, prunedContextLoop);
          logger.info(`[claim-idempotent] Re-issued running story ${runningStory.story_id} to ${agentId}`, { runId: step.run_id, stepId: step.step_id });
          return { found: true, stepId: step.id, runId: step.run_id, resolvedInput };
        }
      }

      // Auto-complete stories that already have a PR (open or merged)
      const runIdPrefix = step.run_id.slice(0, 8);
      await autoCompleteStoriesWithPRs(step, runIdPrefix, context, null);

      // pr-each means strict serial delivery: a story with status=done must be
      // reviewed, fixed, merged into main, and marked verified before the next
      // story can be claimed. This prevents US-002/US-003 from branching from a
      // stale baseline while US-001's PR is still open.
      if (loopConfig?.verifyEach && loopConfig.verifyStep) {
        const awaitingVerify = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
          [step.run_id],
        );
        if (parseInt(awaitingVerify?.cnt || "0", 10) > 0) {
          await pgRun(
            "UPDATE steps SET status = 'pending', updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status IN ('waiting','done','pending')",
            [now(), step.run_id, loopConfig.verifyStep],
          );
          logger.info(`[pr-each] Waiting for done story PR verification before claiming next story`, { runId: step.run_id });
          return { found: false };
        }
      }

      // Story selection + claim must be atomic to prevent
      // two parallel crons from selecting the same story (race condition fix #4)
      // P2-01: Fake transaction removed — claim uses RETURNING for atomicity

      // Find next pending story with dependency check
      const pendingStories = await pgQuery<any>("SELECT * FROM stories WHERE run_id = $1 AND status = 'pending' ORDER BY story_index ASC", [step.run_id]);

      let nextStory: any | undefined;
      for (const candidate of pendingStories) {
        if (candidate.depends_on) {
          try {
            const deps: string[] = JSON.parse(candidate.depends_on);
            if (deps.length > 0) {
              const completedIds = (await pgQuery<{ story_id: string }>("SELECT story_id FROM stories WHERE run_id = $1 AND status IN ('done', 'failed', 'verified', 'skipped')", [step.run_id])
              ).map((r: any) => r.story_id);
              const completedSet = new Set(completedIds);
              const unmet = deps.filter(d => !completedSet.has(d));
              if (unmet.length > 0) {
                logger.info(`Story ${candidate.story_id} blocked by unmet dependencies: ${unmet.join(', ')}`, { runId: step.run_id });
                continue; // Skip this story, try next one
              }
            }
          } catch (e) {
            logger.warn(`Failed to parse depends_on for story ${candidate.story_id}: ${String(e)}`, { runId: step.run_id });
          }
        }
        nextStory = candidate;
        break;
      }

      if (!nextStory) {
        // (removed: fake transaction cleanup)
        // Wave 1 fix #2 (plan: reactive-frolicking-cupcake): previously, if there were no
        // next pending stories but a failed story existed, we called skipFailedStories to
        // convert failed → skipped so the loop could "finish" and the pipeline could march
        // on. Commit 96dd442 removed the equivalent call from step-advance.ts with the
        // message "fail run if any story fails — no more silent skip + broken deploy", but
        // this claim-path copy was left behind, re-introducing the silent skip whenever a
        // loop runs out of pending work while holding a failed story. We now leave failed
        // stories in 'failed' status so the run-level guardrail in checkLoopContinuation
        // fails the run instead of silently marching on.
        const failedStory = await findStoryByStatus(step.run_id, "failed") as { id: string } | undefined;

        // Check if other stories are still running in parallel
        const runningStory = await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = 'running'", [step.run_id]);
        if (runningStory) {
          // (removed: fake transaction cleanup)
        return { found: false }; // Other stories still running, wait for them
        }

        // DEPENDENCY DEADLOCK GUARD: pending stories exist but all blocked by deps — FAIL RUN (v1.5.53)
        if (pendingStories.length > 0 && !failedStory) {
          const deadlockMsg = `Dependency deadlock: ${pendingStories.length} pending stories all blocked by unmet dependencies — failing run`;
          logger.error(deadlockMsg, { runId: step.run_id });
          for (const blocked of pendingStories) {
            await pgRun("UPDATE stories SET status = 'failed', output = 'Failed: dependency deadlock', updated_at = $1 WHERE id = $2", [now(), blocked.id]);
          }
          await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [deadlockMsg, now(), step.id]);
          await failRun(step.run_id, true);
          const wfIdDL = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdDL, stepId: step.step_id, detail: deadlockMsg });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdDL, detail: deadlockMsg });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // #157 GUARD: 0 total stories means planner did not produce STORIES_JSON
        const totalStories = { cnt: await countAllStories(step.run_id) };
        if (totalStories.cnt === 0) {
          const noStoriesReason = "No stories exist — planner did not produce STORIES_JSON";
          logger.warn(noStoriesReason, { runId: step.run_id, stepId: step.step_id });
          await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [noStoriesReason, now(), step.id]);
          await failRun(step.run_id, true);
          const wfId157 = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId157, stepId: step.step_id, detail: noStoriesReason });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId157, detail: noStoriesReason });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // PENDING STORY GUARD: If pending stories remain but agent said "done", DON'T complete the loop.
        // Reset step to pending so the next claim cycle picks up remaining stories.
        const remainingPending = await pgGet<{ cnt: number }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'pending'", [step.run_id]);
        if ((remainingPending?.cnt ?? 0) > 0) {
          logger.warn(`[loop-guard] ${remainingPending?.cnt} pending stories remain — refusing to complete implement loop`, { runId: step.run_id });
          await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), step.id]);
          return { found: false };
        }

        // No pending, running, or failed stories — mark step done and advance
        await pgRun("UPDATE steps SET status = 'done', updated_at = $1 WHERE id = $2", [now(), step.id]);
        emitEvent({ ts: now(), event: "step.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
        await advancePipeline(step.run_id);
        return { found: false };
      }

      // ── DEVELOPER RESERVATION: one developer per project (atomic CAS) ──
      // When a developer agent claims an implement step, the system locks that
      // developer to this run. Other developers skip this run, and this developer
      // skips other runs. Developers are released when the run completes/fails
      // (query-based: WHERE status='running' filters out finished runs).
      //
      // Uses atomic UPDATE ... WHERE ... RETURNING to prevent TOCTOU race:
      // two agents polling simultaneously cannot both assign themselves.
      if (callerGatewayAgent) {
        // Atomic CAS: assign developer only if slot is empty AND developer is free
        const claimed = await pgGet<{ assigned_developer: string }>(
          `UPDATE runs SET assigned_developer = $1
           WHERE id = $2 AND assigned_developer IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM runs WHERE status = 'running' AND assigned_developer = $1 AND id != $2
           )
           RETURNING assigned_developer`,
          [callerGatewayAgent, step.run_id]
        );
        if (!claimed) {
          // CAS failed — either someone else got it, or this agent is busy elsewhere
          const existing = await pgGet<{ assigned_developer: string | null }>(
            "SELECT assigned_developer FROM runs WHERE id = $1", [step.run_id]
          );
          if (existing?.assigned_developer === callerGatewayAgent) {
            // This agent is already assigned to this run — proceed (re-claim after retry)
          } else {
            return { found: false };
          }
        } else {
          logger.info(`[developer-reservation] Assigned ${callerGatewayAgent} to run ${step.run_id.slice(0, 8)}`, { runId: step.run_id });
        }
      }

      // PARALLEL LIMIT: Don't exceed max concurrent running stories
      const runningStoryCount = { cnt: await countStoriesByStatus(step.run_id, "running") };
      const parallelLimit = loopConfig?.parallelCount ?? 3;
      if (runningStoryCount.cnt >= parallelLimit) {
        // (removed: fake transaction cleanup)
        return { found: false }; // At capacity, wait for running stories to finish
      }

      // Atomic story claim with FOR UPDATE SKIP LOCKED — prevents double-claim race condition
      // Pass dependency-checked story ID to respect story ordering
      const { claimNextStory } = await import("./repo.js");
      const claimedStory = await claimNextStory(step.run_id, agentId, nextStory?.id);
      if (!claimedStory) {
        // No pending stories available (all locked or done)
        logger.info(`[claim] No pending stories available to claim — all locked or done`, { runId: step.run_id });
        return { found: false };
      }
      // Use the atomically claimed story for all subsequent operations
      nextStory = claimedStory;
      // ISSUE-1 FIX: Use {runIdPrefix}-{storyId} for branch name to prevent collisions across runs
      const storyRunPrefix = step.run_id.slice(0, 8);
      const storyBranch = `${storyRunPrefix}-${nextStory.story_id}`.toLowerCase();

      // Wave 4 fix #10 (plan: reactive-frolicking-cupcake): previously we updated
      // `steps.current_story_id` BEFORE creating the worktree. If the process died
      // between the DB update and the worktree creation (gateway restart, OOM kill,
      // agent crash), the DB pointed at a claimed story with no working directory
      // and the only recovery was a medic reset. Now we create the worktree first —
      // a pure filesystem operation with no DB side-effects — and only update
      // `current_story_id` once we have a valid `storyWorkdir`. A crash in the
      // filesystem phase leaves the step in its previous state and the next claim
      // loop re-picks the story cleanly.

      // GUARD: Repo path MUST exist — without it, agent works in wrong directory
      if (!context["repo"]) {
        const noRepoReason = "MISSING_REPO: context['repo'] is empty — cannot implement story without project path";
        logger.error(`[claim] ${noRepoReason} (story=${nextStory.story_id})`, { runId: step.run_id });
        await pgRun("UPDATE stories SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
          [noRepoReason, now(), nextStory.id]);
        try { await pgRun("UPDATE claim_log SET outcome = 'failed', diagnostic = $1 WHERE story_id = $2 AND outcome IS NULL", [noRepoReason, nextStory.story_id]); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, detail: noRepoReason });
        return { found: false };
      }

      // GIT WORKTREE ISOLATION: Create OUTSIDE transaction to avoid holding DB
      // lock during slow git operations. Done BEFORE the DB update so the DB
      // never references a worktree that does not exist.
      //
      // direct-merge pins all sibling stories to one feature-branch commit.
      // pr-each is different: each story starts from the latest main after the
      // previous story PR was merged and local main was synced.
      const baseRef = isPrEach ? "main" : (context["implement_base_commit"] || context["branch"] || "master");
      if (isPrEach && context["repo"]) syncBaseBranch(context["repo"], "main");
      const storyWorkdir = createStoryWorktree(context["repo"], storyBranch, baseRef, agentId);
      if (!storyWorkdir) {
        // Worktree creation failed — revert story claim, do not touch step state
        const wtReason = `Worktree creation failed for story ${nextStory.story_id} — cannot isolate parallel work`;
        logger.error(wtReason, { runId: step.run_id, stepId: step.step_id });
        // Revert story to pending so the next claim loop can retry with a fresh worktree
        // (not 'failed' — the story's own implementation was never attempted)
        await pgRun("UPDATE stories SET status = 'pending', claimed_at = NULL, claimed_by = NULL, updated_at = $1 WHERE id = $2", [now(), nextStory.id]);
        try { await pgRun("UPDATE claim_log SET outcome = 'failed', diagnostic = $1 WHERE story_id = $2 AND outcome IS NULL", [wtReason, nextStory.story_id]); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        emitEvent({ ts: now(), event: "story.retry", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextStory.story_id, storyTitle: nextStory.title, detail: wtReason });
        return { found: false };
      }

      // Worktree is ready — NOW update the step to point at the story.
      await pgRun("UPDATE steps SET status = 'running', current_story_id = $1, started_at = COALESCE(started_at, NOW()), updated_at = $2 WHERE id = $3", [nextStory.id, now(), step.id]);
      await recordStepTransition(step.id, step.run_id, "pending", "running", agentId, "claimLoopStep", { storyId: nextStory.story_id });

      context["story_workdir"] = storyWorkdir;
      context["story_base_ref"] = baseRef;

      // Verify node_modules symlink is intact after worktree creation
      if (storyWorkdir) {
        const nmLink = path.join(storyWorkdir, "node_modules");
        const nmSource = path.join(context["repo"] || "", "node_modules");
        try {
          const stat = fs.lstatSync(nmLink);
          if (!stat.isSymbolicLink()) {
            // node_modules exists but is NOT a symlink — delete and recreate
            fs.rmSync(nmLink, { recursive: true, force: true });
            fs.symlinkSync(nmSource, nmLink);
            logger.info(`[worktree] Repaired node_modules symlink in ${storyWorkdir}`, { runId: step.run_id });
          }
        } catch {
          // Doesn't exist — create symlink
          if (fs.existsSync(nmSource)) {
            try { fs.symlinkSync(nmSource, nmLink); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
          }
        }
      }

      // ISSUE-1 FIX: Read ACTUAL git branch from worktree and inject into context
      // This ensures the agent uses the correct branch name instead of creating its own
      const actualWorktreeDir = storyWorkdir || context["repo"];
      try {
        const actualBranch = execFileSync("git", ["branch", "--show-current"], {
          cwd: actualWorktreeDir, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (actualBranch) {
          // Wave 4 fix #11: force lowercase here too — git itself is case-sensitive
          // on Linux, so a `US-005` branch and a `us-005` branch are genuinely distinct
          // references and the merge queue ends up trying to merge only one of them.
          const actualBranchLc = actualBranch.toLowerCase();
          context["story_branch"] = actualBranchLc;
          // Also persist to stories table so verify step can reference it
          await pgRun("UPDATE stories SET story_branch = $1 WHERE id = $2", [actualBranchLc, nextStory.id]);
          logger.info(`[story-branch] Set story_branch=${actualBranchLc} from worktree (story=${nextStory.story_id})`, { runId: step.run_id });
        }
      } catch (branchErr) {
        // Fallback: use the computed branch name (already lowercased on line 1126)
        context["story_branch"] = storyBranch;
        logger.warn(`[story-branch] Could not read branch from worktree, using computed: ${storyBranch}`, { runId: step.run_id });
      }

      // v1.5.50: Record claim in claim_log + update story claim metadata
      const claimNow = now();
      try {
        await pgRun("INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, $2, $3, $4, $5)", [step.run_id, step.step_id, nextStory.story_id, agentId, claimNow]);
        await pgRun("UPDATE stories SET claimed_at = $1, claimed_by = $2 WHERE id = $3", [claimNow, agentId, nextStory.id]);
      } catch (e) { logger.warn(`[claim-log] Failed to record claim: ${String(e)}`, { runId: step.run_id }); }

      // v2026.4.12: Merge dependency branches into worktree for integration stories.
      // Stories with depends_on start from implement_base_commit (empty project).
      // Without this, the agent sees no code from prior stories and reimplements
      // everything, causing scope-bleed on 10+ files (run #408 US-004 failure mode).
      if (nextStory.depends_on && storyWorkdir) {
        try {
          const deps: string[] = JSON.parse(nextStory.depends_on);
          if (deps.length > 0) {
            // Query each dep individually — ANY($2) with JS arrays unreliable in porsager/postgres
            const depBranches: { story_branch: string; story_id: string }[] = [];
            for (const depId of deps) {
              const row = await pgGet<{ story_branch: string; story_id: string }>(
                "SELECT story_branch, story_id FROM stories WHERE run_id = $1 AND story_id = $2 AND status IN ('done','verified') AND story_branch IS NOT NULL",
                [step.run_id, depId]
              );
              if (row) depBranches.push(row);
            }
            const storyScopeFiles = new Set<string>();
            try {
              const parsedScopeFiles = JSON.parse(nextStory.scope_files || "[]");
              if (Array.isArray(parsedScopeFiles)) {
                for (const f of parsedScopeFiles) {
                  if (typeof f === "string" && f.trim()) storyScopeFiles.add(f.trim());
                }
              }
            } catch (e) { logger.debug(`[dep-merge] Failed parsing scope_files: ${String(e).slice(0, 80)}`); }
            // Use git checkout (not merge) to copy files WITHOUT merge commits.
            // Merge commits cause merge-queue conflicts because the same changes
            // appear on multiple branches. checkout just updates the working tree.
            let mergedCount = 0;
            for (const dep of depBranches) {
              try {
                // Get list of files changed in the dep branch vs base
                const diffOutput = execFileSync("git", ["diff", "--name-only", baseRef, dep.story_branch], {
                  cwd: storyWorkdir, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                }).trim();
                if (!diffOutput) continue;
                const depFiles = diffOutput.split("\n").filter(f => f.length > 0);
                // Checkout each file from the dep branch into working tree
                for (const f of depFiles) {
                  try {
                    execFileSync("git", ["checkout", dep.story_branch, "--", f], {
                      cwd: storyWorkdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
                    });
                  } catch (e) { logger.debug(`[worktree] File not in worktree: ${String(e).slice(0, 80)}`); }
                }
                // Unstage all — files exist in working tree but NOT committed
                execFileSync("git", ["reset", "HEAD"], {
                  cwd: storyWorkdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
                });
                // Mark dependency files as assume-unchanged so git ignores them
                // for commit/diff. Keep current-story scope files trackable:
                // integration stories often need to edit a file originally
                // introduced by a dependency, and hiding those edits makes PRs
                // miss required source changes.
                let ignoredDepFileCount = 0;
                let editableDepFileCount = 0;
                for (const f of depFiles) {
                  if (storyScopeFiles.has(f)) {
                    try {
                      execFileSync("git", ["update-index", "--no-assume-unchanged", "--no-skip-worktree", f], {
                        cwd: storyWorkdir, timeout: 3000, stdio: ["pipe", "pipe", "pipe"],
                      });
                    } catch {
                      try {
                        execFileSync("git", ["update-index", "--no-assume-unchanged", f], {
                          cwd: storyWorkdir, timeout: 3000, stdio: ["pipe", "pipe", "pipe"],
                        });
                      } catch (e) { logger.debug(`[worktree] Could not clear index flags: ${String(e).slice(0, 80)}`); }
                    }
                    editableDepFileCount++;
                    continue;
                  }
                  try {
                    execFileSync("git", ["update-index", "--assume-unchanged", f], {
                      cwd: storyWorkdir, timeout: 3000, stdio: ["pipe", "pipe", "pipe"],
                    });
                    ignoredDepFileCount++;
                  } catch (e) { logger.debug(`[worktree] File not found: ${String(e).slice(0, 80)}`); }
                }
                mergedCount++;
                logger.info(`[dep-merge] Copied ${depFiles.length} files from ${dep.story_id} (${dep.story_branch}) into ${nextStory.story_id} worktree (${ignoredDepFileCount} assume-unchanged, ${editableDepFileCount} editable scope files)`, { runId: step.run_id });
              } catch (mergeErr) {
                logger.warn(`[dep-merge] Failed copying ${dep.story_id} into ${nextStory.story_id}: ${String(mergeErr).slice(0, 150)}`, { runId: step.run_id });
              }
            }
            if (mergedCount > 0) {
              logger.info(`[dep-merge] Merged ${mergedCount}/${depBranches.length} dependency branches into ${nextStory.story_id}`, { runId: step.run_id });
            }
            // Expand shared_files with ALL other stories' scope_files (transitive).
            // Direct deps are insufficient: US-004 depends on US-002/003 but also
            // needs US-001's files (index.css, tokens). Instead of computing
            // transitive closure, just include all stories' scope_files.
            const depScopeFiles: string[] = [];
            const allStoryScopes = await pgQuery<{ scope_files: string | null; story_id: string }>(
              "SELECT scope_files, story_id FROM stories WHERE run_id = $1 AND story_id != $2",
              [step.run_id, nextStory.story_id]
            );
            for (const row of allStoryScopes) {
              if (row?.scope_files) {
                try {
                  const files: string[] = JSON.parse(row.scope_files);
                  if (Array.isArray(files)) depScopeFiles.push(...files);
                } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
              }
            }
            if (depScopeFiles.length > 0) {
              const currentShared: string[] = JSON.parse(nextStory.shared_files || "[]").filter((f: any) => typeof f === "string");
              const expandedShared = [...new Set([...currentShared, ...depScopeFiles])];
              await pgRun(
                "UPDATE stories SET shared_files = $1, updated_at = $2 WHERE id = $3",
                [JSON.stringify(expandedShared), now(), nextStory.id]
              );
              nextStory.shared_files = JSON.stringify(expandedShared);
              logger.info(`[dep-merge] Expanded ${nextStory.story_id} shared_files with ${depScopeFiles.length} dependency scope files`, { runId: step.run_id });
            }
          }
        } catch (e) {
          logger.warn(`[dep-merge] Failed to process depends_on for ${nextStory.story_id}: ${String(e).slice(0, 200)}`, { runId: step.run_id });
        }
      }

      const wfId = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.running", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId });
      emitEvent({ ts: now(), event: "story.started", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, storyId: nextStory.story_id, storyTitle: nextStory.title });
      logger.info(`Story started: ${nextStory.story_id} — ${nextStory.title}`, { runId: step.run_id, stepId: step.step_id });

      // Wave 14 Bug L: inject claim_generation into context so completeStep can
      // verify the agent that reports done is the SAME agent that claimed the story.
      // Stale agents (from a previous abandoned claim) report done with an old gen.
      context["claim_generation"] = String(nextStory.claim_generation ?? 0);

      // Inject story context (template vars, screen_map, optional vars, previous_failure)
      await injectStoryContext(nextStory, step, context);

      // Inject test generation prompt so agent writes tests alongside implementation
      if (step.step_id === "implement") {
        try {
          const { buildTestGenerationPrompt } = await import("./test-generation.js");
          const techStack = context["tech_stack"] || "react";
          const acceptanceCriteria = nextStory.title || "";
          context["test_generation_prompt"] = buildTestGenerationPrompt(nextStory.title, acceptanceCriteria, techStack);
        } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
      }

      // Wave 14 Bug K: per-step context allowlist for loop (story-each) claims.
      // Loop steps inject heavy design context (stitch_html, design_dom, etc.)
      // which only implement needs. Downstream loop steps (verify-each if used,
      // or single-step verify after the loop) should not see that bloat.
      const prunedContextLoop = pruneContextForStep(context, step.step_id);
      const loopBytesBefore = JSON.stringify(context).length;
      const loopBytesAfter = JSON.stringify(prunedContextLoop).length;
      if (loopBytesBefore > loopBytesAfter + 1000) {
        logger.info(`[context-prune] ${step.step_id} (loop story=${nextStory.story_id}): ${loopBytesBefore}→${loopBytesAfter} bytes (${Math.round((1 - loopBytesAfter / loopBytesBefore) * 100)}% trimmed)`, { runId: step.run_id });
      }
      let resolvedInput = resolveTemplate(step.input_template, prunedContextLoop);

      // Item 7: MISSING_INPUT_GUARD inside claim flow (v1.5.53: retry once before failing run)
      const allMissing = [...new Set([...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase()))];
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input`;
        const storyRetry = await pgGet<{ retry_count: number }>("SELECT retry_count FROM stories WHERE id = $1", [nextStory.id]);
        const retryCount = storyRetry?.retry_count ?? 0;
        logger.warn(`${reason} (story=${nextStory.story_id}, retry=${retryCount})`, { runId: step.run_id, stepId: step.step_id });
        // Reset the claimed story
        if (retryCount > 0) {
          // Second occurrence — fail everything (Wave 13 J-2: terminal flag)
          await pgRun("UPDATE stories SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), nextStory.id]);
          await pgRun("UPDATE steps SET status = 'failed', output = $1, current_story_id = NULL, updated_at = $2 WHERE id = $3", [reason + " — failing run (retry exhausted)", now(), step.id]);
          await failRun(step.run_id, true);
          const wfId2 = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: step.step_id, detail: reason });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: reason });
          if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
          scheduleRunCronTeardown(step.run_id);
        } else {
          // First occurrence — retry story (possible WAL lag)
          await pgRun("UPDATE stories SET status = 'pending', retry_count = retry_count + 1, output = $1, updated_at = $2 WHERE id = $3", [reason + " — retrying once", now(), nextStory.id]);
          await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), step.id]);
          if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
          try { await pgRun("UPDATE claim_log SET outcome = 'failed', diagnostic = $1 WHERE story_id = $2 AND outcome IS NULL", [reason, nextStory.story_id]); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
          logger.info(`[missing-input] Story ${nextStory.story_id} will retry — possible WAL lag`, { runId: step.run_id });
        }
        return { found: false };
      }


      // GUARD: Empty critical variables — catches "" values that missing-input guard misses
      const CRITICAL_STORY_VARS = ["repo", "story_workdir", "branch"];
      const emptyVars = CRITICAL_STORY_VARS.filter(v => v in context && context[v] !== undefined && context[v].trim() === "");
      if (emptyVars.length > 0) {
        const emptyReason = `EMPTY_CRITICAL_VARS: [${emptyVars.join(", ")}] are empty — cannot implement story`;
        logger.warn(`[claim] ${emptyReason} (story=${nextStory.story_id})`, { runId: step.run_id });
        await pgRun("UPDATE stories SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
          [emptyReason, now(), nextStory.id]);
        await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), step.id]);
        try { await pgRun("UPDATE claim_log SET outcome = 'failed', diagnostic = $1 WHERE story_id = $2 AND outcome IS NULL", [emptyReason, nextStory.story_id]); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
        return { found: false };
      }

      return { found: true, stepId: step.id, runId: step.run_id, resolvedInput };
    }
  }

  // Single (non-loop) step claim path
  return await claimSingleStep(step, agentId, context, null);
}

// ── Complete ────────────────────────────────────────────────────────

/**
 * Complete a step: save output, merge context, advance pipeline.
 */
export async function completeStep(stepId: string, output: string): Promise<{ advanced: boolean; runCompleted: boolean }> {

  type StepRow = { id: string; run_id: string; step_id: string; step_index: number; type: string; loop_config: string | null; current_story_id: string | null; agent_id: string; retry_count: number; max_retries: number };
  let step = await pgGet<StepRow>("SELECT id, run_id, step_id, step_index, type, loop_config, current_story_id, agent_id, retry_count, max_retries FROM steps WHERE id = $1", [stepId]);

  if (!step) {
    // Fallback: agent may have passed runId instead of stepId — find the active step for this run
    const fallbackStep = await pgGet<StepRow>(`SELECT id, run_id, step_id, step_index, type, loop_config, current_story_id, agent_id, retry_count, max_retries FROM steps WHERE run_id = $1 AND status IN ('running', 'pending') ORDER BY step_index ASC LIMIT 1`, [stepId]);
    if (fallbackStep) {
      logger.warn(`[completeStep] Agent passed runId "${stepId}" instead of stepId — resolved to step "${fallbackStep.id}" (${fallbackStep.step_id})`, { runId: fallbackStep.run_id });
      step = fallbackStep;
    } else {
      throw new Error(`Step not found: ${stepId}`);
    }
  }

  // Guard: don't process late completions for terminal runs. Agents can keep
  // running after a user cancellation until their OpenClaw session is reaped;
  // accepting their output would mutate context/stories after the run is dead.
  const runStatus = await getRunStatus(step.run_id);
  if (runStatus === RUN_STATUS.FAILED || runStatus === RUN_STATUS.CANCELLED) {
    logger.warn(`[completeStep] Ignoring late completion for terminal run (${runStatus})`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  // Merge KEY: value lines into run context
  const context: Record<string, string> = await getRunContext(step.run_id);

  // Parse KEY: value lines and merge into context
  // #197: Protect seed context keys from being overwritten by step output
  const parsed = parseOutputKeyValues(output);
  for (const [key, value] of Object.entries(parsed)) {
    if (PROTECTED_CONTEXT_KEYS.has(key) && context[key]) {
      logger.warn(`[context] Blocked overwrite of protected key "${key}" (current: "${context[key]}", attempted: "${value}")`, { runId: step.run_id });
      continue;
    }
    context[key] = value;
  }

  // Wave 13 Bug N (run #344 postmortem): dangerous command guard. In run #344
  // multiple agents ran `rm -rf node_modules && npm install` inside their
  // worktrees, which destroyed the node_modules symlink pointing at the main
  // project and triggered cascading install failures. Others ran `git push
  // --force` on feature branches. We can't stop the shell at invocation time,
  // but agents tend to echo their commands into STDOUT for auditing — if we
  // see one of these patterns in the output we fail the step immediately with
  // corrective guidance, denying the success path and forcing a retry.
  const DANGEROUS_CMDS: Array<{ rx: RegExp; label: string }> = [
    { rx: /\brm\s+-[rf]+\s+[^|;&]*\bnode_modules\b/, label: "rm -rf node_modules" },
    { rx: /\brm\s+-[rf]+\s+[^|;&]*\.vite\b/, label: "rm -rf .vite" },
    { rx: /\bgit\s+push\s+--force\b/, label: "git push --force" },
    { rx: /\bgit\s+reset\s+--hard\s+origin\/(main|master)\b/, label: "git reset --hard origin/main" },
  ];
  for (const { rx, label } of DANGEROUS_CMDS) {
    const m = output.match(rx);
    if (m) {
      const snippet = m[0].slice(0, 120);
      logger.error(`[dangerous-cmd] Blocked command pattern "${label}" in ${step.step_id} output: ${snippet}`, { runId: step.run_id });
      await failStep(stepId, `DANGEROUS_COMMAND_DETECTED: "${snippet}". The "${label}" pattern is banned — node_modules is a symlink to the main repo so rm -rf breaks sibling worktrees, and force-push / hard-reset destroy history. Use 'git clean -fdx' for build artifacts, 'npm ci' for dependency reset, or push a revert commit instead. Re-implement the story without running that command.`);
      return { advanced: false, runCompleted: false };
    }
  }

  // Expand tilde in repo path (Node.js fs does not expand ~)
  if (context["repo"]?.startsWith("~/")) {
    context["repo"] = context["repo"].replace(/^~\//, os.homedir() + "/");
  }
  if (context["story_workdir"]?.startsWith("~/")) {
    context["story_workdir"] = context["story_workdir"].replace(/^~\//, os.homedir() + "/");
  }

  // FIX 1: Explicit fail interceptor — agent reported STATUS: fail/error
  // Wave 13 Bug J-3 (run #344 postmortem): extend parser to handle "retry" and
  // treat unknown status values as failures. Previously only fail/failed/error
  // tripped the failStep path; "retry" (and anything else) silently fell through
  // to the default "done" flow, so run #344's verify step was marked done even
  // though Iris explicitly reported STATUS: retry with a list of blocking issues.
  // Wave 13+ hotfix: parseOutputKeyValues can leak trailing lines into the
  // STATUS value when agent output lacks blank separators. Run #352 US-003:
  // parsed["status"] = "done\nstepId: ..." instead of just "done".
  // Fix: trim and extract only the first word from the status value.
  const rawStatus = (parsed["status"] || "").trim();
  const statusVal = (rawStatus.indexOf("\n") >= 0 ? rawStatus.slice(0, rawStatus.indexOf("\n")).trim() : rawStatus).split(/\s/)[0].toLowerCase() || undefined;
  if (statusVal === "fail" || statusVal === "failed" || statusVal === "error") {
    logger.warn(`Agent reported STATUS: ${parsed["status"]} — failing step`, { runId: step.run_id, stepId: step.step_id });
    await failStep(stepId, `Agent reported failure: ${parsed["status"]}. Output: ${output.slice(0, 500)}`);
    return { advanced: false, runCompleted: false };
  }
  if (statusVal === "retry") {
    // Soft retry: failStep bounces the step back to pending and increments
    // retry_count; if retries are exhausted the existing step-fail logic
    // escalates to a terminal fail. Verify-each already handles this in its
    // own path (step-ops.ts handleVerifyEachCompletion); this branch closes
    // the gap for single-step verify (direct-merge workflows).
    logger.warn(`[status-parser] Agent reported STATUS: retry — bouncing step to pending`, { runId: step.run_id, stepId: step.step_id });
    await failStep(stepId, `Agent requested retry: ${output.slice(0, 500)}`);
    return { advanced: false, runCompleted: false };
  }
  if (statusVal && statusVal !== "done" && statusVal !== "skip") {
    // Whitelist: any explicit status other than done/skip/retry/fail is garbage
    // and must fail loudly. This catches typos, hallucinations ("STATUS: ok"),
    // and future agents that invent new status words without platform support.
    logger.warn(`[status-parser] Agent reported unknown STATUS: "${parsed["status"]}" — treating as failure`, { runId: step.run_id, stepId: step.step_id });
    await failStep(stepId, `Unknown STATUS: "${parsed["status"]}". Expected one of: done, skip, retry, fail.`);
    return { advanced: false, runCompleted: false };
  }
  if (!statusVal) {
    // Missing STATUS line — legacy agents still expect the default "done" flow,
    // but surface a warning so we can tighten this later if needed.
    logger.warn(`[status-parser] Missing STATUS in agent output — assuming done (legacy)`, { runId: step.run_id, stepId: step.step_id });
  }

  // FIX 6: Status is ephemeral — do not propagate upstream status to downstream steps
  delete context["status"];

  // No fallback extraction — if upstream didn't output required keys,
  // the missing input guard will catch it and fail cleanly.

  // EAGER CONTEXT SAVE: Persist merged context BEFORE guardrail checks.
  // Guardrails (test, quality, db-provision) may call failStep + return early,
  // which previously skipped the context save — losing parsed output keys.
  // v1.5.47: Snapshot context before save so guardrail failures can rollback bad values.
  const prevContextJson = await pgGet<{ context: string }>("SELECT context FROM runs WHERE id = $1", [step.run_id]);
  await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);

  // Step module delegation (v2026-04-14).
  // Registered modules OWN their step's validation and side effects.
  // Order: normalize (mutate parsed) → validateOutput (reject on fail) → onComplete (side effects).
  // Unregistered steps fall through to legacy guardrails below.
  {
    const _modRegistry = await import("./steps/registry.js");
    const _stepModule = _modRegistry.get(step.step_id);
    if (_stepModule) {
      if (_stepModule.normalize) _stepModule.normalize(parsed);
      const _result = _stepModule.validateOutput(parsed);
      if (!_result.ok) {
        const _modErr = `GUARDRAIL [module:${_stepModule.id}]: ${_result.errors.join("; ")}`;
        logger.warn(`[step-module] ${_modErr}`, { runId: step.run_id });
        if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
        await failStep(stepId, _modErr);
        return { advanced: false, runCompleted: false };
      }
      if (_stepModule.onComplete) {
        try {
          await _stepModule.onComplete({ runId: step.run_id, stepId: step.step_id, parsed, context, rawOutput: output });
          logger.info(`[step-module] ${_stepModule.id} onComplete ok`, { runId: step.run_id });
        } catch (_oe) {
          // Module onComplete threw — treat as fatal guardrail rejection (e.g. stories
          // 0-stories, missing scope_files, hallucinated screen path).
          const _msg = `GUARDRAIL [module:${_stepModule.id}]: ${String(_oe instanceof Error ? _oe.message : _oe).slice(0, 400)}`;
          logger.warn(`[step-module] ${_msg}`, { runId: step.run_id });
          if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
          await failStep(stepId, _msg);
          return { advanced: false, runCompleted: false };
        }
      }
    }
  }

  // (Legacy REPO DEDUP for plan moved to 01-plan/guards.ts normalize() —
  //  bug fix: stitch is now WIPED during reset (was preserved, causing run #445
  //  to inherit 5-day-old stitch from a prior task). Module owns it now.)

  // REQUIRED OUTPUT FIELDS GUARDRAIL (Wave 3 fix #12 + Wave 9 auto-derive)
  // Enforce that each step's agent output contains fields the pipeline actually
  // reads downstream. Wave 9 addition: before firing the guardrail, try to
  // auto-derive missing fields from filesystem/package.json state so agents
  // that copy only the tail of a script's output (and skip EXISTING_CODE /
  // BUILD_CMD on the last line) don't burn a retry slot. Run #344 proved
  // this: every single run was eating one retry on both setup-repo and
  // setup-build for exactly this reason — the script emitted the field but
  // the agent forwarded only STATUS: done. The derivation is conservative —
  // only fills when a reliable source exists, otherwise the guardrail still
  // fires and the agent gets a chance to correct.
  if (parsed["status"]?.toLowerCase() === "done") {
    // (setup-repo EXISTING_CODE + setup-build BUILD_CMD auto-derive moved to
    //  04-setup-repo/preclaim.ts and 05-setup-build/preclaim.ts — modules
    //  expose *_hint context vars that their onComplete stamp into the final fields.)

    const missingFieldsMsg = checkRequiredOutputFields(step.step_id, parsed);
    if (missingFieldsMsg) {
      logger.warn(`[required-fields-guardrail] ${missingFieldsMsg}`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, missingFieldsMsg);
      return { advanced: false, runCompleted: false };
    }
  }

  // TEST FAILURE GUARDRAIL — soft retry with fix instructions instead of hard fail
  if (parsed["status"]?.toLowerCase() === "done") {
    const testFailMsg = checkTestFailures(output);
    if (testFailMsg && step.retry_count < step.max_retries) {
      logger.warn(`Test guardrail triggered — soft retry with fix instructions`, { runId: step.run_id, stepId: step.step_id });
      // Inject failure details as previous_failure so agent knows what to fix
      const { classifyError: _ce1 } = await import("./error-taxonomy.js");
      const _cl1 = _ce1(testFailMsg);
      context["previous_failure"] = `TEST GUARDRAIL: ${testFailMsg}`;
      context["failure_category"] = _cl1.category;
      context["failure_suggestion"] = _cl1.suggestion;
      await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);
      await failStep(stepId, testFailMsg);
      return { advanced: false, runCompleted: false };
    } else if (testFailMsg) {
      // Max retries reached — hard fail
      logger.warn(`Test guardrail — max retries reached, hard fail`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, testFailMsg);
      return { advanced: false, runCompleted: false };
    }
  }

  // QUALITY GATE GUARDRAIL — soft retry with fix context
  if (parsed["status"]?.toLowerCase() === "done") {
    const qgPath = (step.step_id === "implement" && context["story_workdir"])
      ? context["story_workdir"]
      : (context["repo"] || context["REPO"] || "");
    const qgMsg = checkQualityGate(step.step_id, qgPath);
    if (qgMsg && step.retry_count < step.max_retries) {
      logger.warn(`[quality-gate] Soft retry with fix instructions`, { runId: step.run_id, stepId: step.step_id });
      const { classifyError: _ce2 } = await import("./error-taxonomy.js");
      const _cl2 = _ce2(qgMsg);
      context["previous_failure"] = `QUALITY GATE: ${qgMsg}`;
      context["failure_category"] = _cl2.category;
      context["failure_suggestion"] = _cl2.suggestion;
      await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);
      await failStep(stepId, qgMsg);
      return { advanced: false, runCompleted: false };
    } else if (qgMsg) {
      logger.warn(`[quality-gate] Max retries — hard fail`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, qgMsg);
      return { advanced: false, runCompleted: false };
    }
  }

  // Design Contract + Rules — moved to 02-design/guards.ts onComplete (called via step-module delegation).
  // The download fallback below stays as belt-and-suspenders if the module's preClaim missed something.
  if (step.step_id === "design" && parsed["status"]?.toLowerCase() === "done") {
    // Immediately download Stitch HTML after design completes (don't wait for setup-repo)
    const dRepo = context["repo"] || context["REPO"] || "";
    let dProjId = context["stitch_project_id"] || "";
    const dScreenCount = parseInt(context["screens_generated"] || "0", 10);
    const dScreenMap = context["screen_map"] || "";
    const dHasScreens = dScreenCount > 0 || (dScreenMap.length > 10 && dScreenMap.includes("screenId"));

    // AUTO-CREATE Stitch project if agent didn't create one
    if (dRepo && !dProjId && dHasScreens) {
      const stitchScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/stitch-api.mjs");
      const projectName = path.basename(dRepo);
      logger.info(`[design-auto-project] Creating Stitch project "${projectName}"`, { runId: step.run_id });
      try {
        const ensureOut = execFileSync("node", [stitchScript, "ensure-project", projectName, dRepo], { encoding: "utf-8", timeout: 30000, cwd: dRepo });
        let ensureResult: any = {};
        try { ensureResult = JSON.parse(ensureOut); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        dProjId = ensureResult.projectId || "";
        if (dProjId) {
          context["stitch_project_id"] = dProjId;
          logger.info(`[design-auto-project] Created Stitch project: ${dProjId}`, { runId: step.run_id });
        }
      } catch (e) {
        logger.warn(`[design-auto-project] Failed: ${e}`, { runId: step.run_id });
      }
    }

    if (dRepo && dProjId && dHasScreens) {
      const dStitchDir = path.join(dRepo, "stitch");
      // Only generate if no HTML exists (skip if already downloaded by pre-claim)
      {
        const stitchScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/stitch-api.mjs");
        const existingHtmlCount = fs.existsSync(dStitchDir)
          ? fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html")).length : 0;
        let screenMapArr: any[] = [];
        try { screenMapArr = JSON.parse(dScreenMap); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        if (screenMapArr.length > 0 && existingHtmlCount === 0) {
          const designSystem = context["design_system"] || "";
          const task = context["task"] || "";
          const deviceType = context["device_type"] || "DESKTOP";

          // Build multi-screen prompt with FULL PRD
          const prd = context["prd"] || context["PRD"] || "";
          const screenDescs = screenMapArr.map((s: any, i: number) =>
            `Screen ${i + 1}: ${s.name} — ${s.description || s.type || "UI screen"}`
          ).join("\n");

          // PRD truncate: max 6000 chars to fit Stitch API limits
          const prdTruncated = prd.length > 6000 ? prd.slice(0, 6000) + "\n...(truncated)" : prd;

          const prompt = `Generate ${screenMapArr.length} screens for the following application.

=== PRD (Product Requirements Document) ===
${prdTruncated}

=== DESIGN SYSTEM ===
${designSystem}

=== SCREENS TO GENERATE ===
${screenDescs}

=== RULES ===
- All visible text (buttons, labels, headings, placeholders, menu items) MUST be in Turkish language.
- Use Material Symbols icons.
- Consistent design system across ALL screens.
- Each screen must be a complete, detailed, production-ready UI design.
- Dark theme with the colors specified in design system.`;

          const promptFile = path.join(dStitchDir, ".generate-prompt.txt");
          fs.writeFileSync(promptFile, prompt);

          logger.info(`[design-generate] Auto-generating ${screenMapArr.length} screens via generate-all-screens`, { runId: step.run_id });
          try {
            const genOut = execFileSync("node", [stitchScript, "generate-all-screens", dProjId, promptFile, deviceType, "GEMINI_3_1_PRO"], { encoding: "utf-8", timeout: 600000, cwd: dRepo });
            let genResult: any = {};
            try { genResult = JSON.parse(genOut); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
            logger.info(`[design-generate] Generated ${genResult.total || 0} screens in ${genResult.elapsedSeconds || "?"}s`, { runId: step.run_id });
          } catch (genErr) {
            logger.warn(`[design-generate] generate-all-screens failed: ${genErr}`, { runId: step.run_id });
          }
        }

        // DOWNLOAD: Batch download all screens (HTML + PNG + manifest + tokens)
        logger.info(`[design-download] Downloading all screens from Stitch project ${dProjId}`, { runId: step.run_id });
        try {
          const dlOut = execFileSync("node", [stitchScript, "download-all", dProjId, dStitchDir], { encoding: "utf-8", timeout: 180000, cwd: dRepo });
          let dlResult: any = {};
          try { dlResult = JSON.parse(dlOut); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
          logger.info(`[design-download] Downloaded ${dlResult.downloaded || 0}/${dlResult.total || 0} screens`, { runId: step.run_id });
        } catch (dlErr) {
          logger.warn(`[design-download] Batch download failed: ${dlErr}`, { runId: step.run_id });
        }

        // GUARD: Verify HTML files actually exist after download
        const htmlAfterDownload = fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html"));
        if (htmlAfterDownload.length === 0 && dScreenCount > 0) {
          const failMsg = `GUARDRAIL: Design step claims ${dScreenCount} screens but 0 HTML files downloaded. Stitch project may be deleted or API failed. Remove .stitch file and retry.`;
          logger.error(`[design-download] ${failMsg}`, { runId: step.run_id });
          // Remove stale .stitch so retry creates fresh project
          const staleStitch = path.join(dRepo, ".stitch");
          if (fs.existsSync(staleStitch)) { try { fs.unlinkSync(staleStitch); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); } }
          await failStep(stepId, failMsg);
          return { advanced: false, runCompleted: false };
        }
      }
    }

    // #21 fix (plan: reactive-frolicking-cupcake.md): sync stitch_project_id back
    // to MC's prds table. The MC dashboard's "View Design" link reads from
    // prds.stitch_project_id, but that column only gets populated when the user
    // creates a PRD via MC's preview flow (prd-generator.ts:475). For runs
    // started via setfarm CLI directly, or for runs where the design step
    // discovered/auto-created a Stitch project after the PRD already existed,
    // the prds row stays empty and the dashboard shows "no design available".
    // Setfarm shares the same Postgres database as MC, so we can write
    // directly. Idempotent: only fills in NULL, never overwrites a value the
    // PRD generator already set.
    const prdsSyncProjId = context["stitch_project_id"] || "";
    if (prdsSyncProjId) {
      try {
        const updateRes = await pgRun(
          "UPDATE prds SET stitch_project_id = $1, updated_at = NOW() WHERE run_id = $2 AND (stitch_project_id IS NULL OR stitch_project_id = '')",
          [prdsSyncProjId, step.run_id],
        );
        // pgRun returns the result; the underlying postgres client exposes count via .count
        const affected = (updateRes as any)?.count ?? 0;
        if (affected > 0) {
          logger.info(`[design] Synced stitch_project_id=${prdsSyncProjId} to prds row for run ${step.run_id.slice(0, 8)}`, { runId: step.run_id });
        }
      } catch (syncErr) {
        // Non-fatal: prds table may not exist (setfarm-only deployment) or
        // schema may differ. Log and continue — never block the design step
        // on a sync failure.
        logger.warn(`[design] prds.stitch_project_id sync skipped: ${String(syncErr).slice(0, 200)}`, { runId: step.run_id });
      }
    }
  }

  // DB Auto-Provisioning (setup step)
  // (setup-repo branch ensure + DB provision + design contracts moved to
  //  04-setup-repo/preclaim.ts. setup-build branch fallback moved to
  //  05-setup-build/preclaim.ts via shared branch normalize.)

  // (setup-build baseline, stitch-to-jsx, compat engine moved to
  //  05-setup-build/preclaim.ts and guards.ts. Module delegation handles failure.)

  // SETUP-BUILD APP.TSX SCAFFOLD BASELINE GUARDRAIL.
  // setup-repo creates a neutral App.tsx marked with data-setfarm-root="baseline".
  // If setup-build or its agent rewrites App.tsx before implement, surface it so
  // downstream reviewers can catch feature code leaking into the baseline.
  if (step.step_id === "setup-build" && parsed["status"]?.toLowerCase() === "done") {
    try {
      const repoPath = context["repo"] || "";
      const appTsxPath = path.join(repoPath, "src", "App.tsx");
      if (repoPath && fs.existsSync(appTsxPath)) {
        const appTsxContent = fs.readFileSync(appTsxPath, "utf-8");
        const lineCount = appTsxContent.split("\n").length;
        // Accept either Setfarm's neutral baseline or older Vite starter signals.
        const hasSetfarmBaseline = /data-setfarm-root=["']baseline["']/.test(appTsxContent);
        const hasReactLogo = /reactLogo|react\.svg|vite\.svg/i.test(appTsxContent);
        const hasCountState = /useState\(0\)|count.*setCount|setCount.*count/i.test(appTsxContent);
        const hasViteDemo = /count is|edit.*app\.tsx|HMR|vite \+ react/i.test(appTsxContent);
        const looksLikeDefault = hasSetfarmBaseline || hasReactLogo || hasCountState || hasViteDemo;
        if (!looksLikeDefault) {
          const preview = appTsxContent.slice(0, 200).replace(/\s+/g, " ");
          logger.warn(`[setup-build-scope] src/App.tsx does NOT match setup scaffold baseline after setup-build (${lineCount} lines, preview: "${preview}..."). Implement will start from this modified baseline.`, { runId: step.run_id });
          // Record in context so verify/qa-test can see it downstream if needed
          context["setup_build_app_tsx_drift"] = `lines=${lineCount},hasSetupBaseline=false`;
          await updateRunContext(step.run_id, context);
        }
      }
    } catch (appTsxErr) {
      logger.warn(`[setup-build-scope] App.tsx drift check skipped: ${String(appTsxErr).slice(0, 150)}`, { runId: step.run_id });
    }
  }

  // pr-each story branches target main, so setup-build must publish the clean
  // scaffold/build baseline to main before implement starts. Without this,
  // US-001 branches from an empty/stale main and every later PR collides.
  if (step.step_id === "setup-build" && parsed["status"]?.toLowerCase() === "done") {
    const baselinePublished = publishSetupBaselineToMain(context["repo"] || "", context["branch"] || "", step.run_id);
    if (!baselinePublished) {
      const reason = "SETUP_BASELINE_MAIN_SYNC_FAILED: setup-build could not publish the baseline to main. pr-each implement cannot start safely until main contains the scaffold/build baseline.";
      await failStep(stepId, reason);
      return { advanced: false, runCompleted: false };
    }
  }

  // DEPLOY HEALTH CHECK GUARDRAIL (v1.5.53): Verify service is actually running after deploy
  if (step.step_id === "deploy" && parsed["status"]?.toLowerCase() === "done") {
    const port = context["port"] || parsed["port"] || "";
    const serviceName = context["service_name"] || parsed["service_name"] || "";
    let deployErr = "";

    // Health check: curl
    if (port) {
      try {
        execFileSync("curl", ["-sf", "--max-time", "5", `http://127.0.0.1:${port}/`],
          { timeout: 10_000, stdio: "pipe" });
      } catch {
        deployErr = `GUARDRAIL: Deploy health check failed — service not responding on port ${port}`;
      }
    }

    // Service check: systemctl
    if (!deployErr && serviceName) {
      try {
        const isActive = execFileSync("systemctl", ["--user", "is-active", serviceName],
          { timeout: 5_000, stdio: "pipe" }).toString().trim();
        if (isActive !== "active") {
          deployErr = `GUARDRAIL: Service ${serviceName} is ${isActive}, not active`;
        }
      } catch {
        deployErr = `GUARDRAIL: Service ${serviceName} not found or inactive`;
      }
    }

    if (deployErr) {
      logger.warn(`[deploy-guardrail] ${deployErr}`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, deployErr);
      return { advanced: false, runCompleted: false };
    }

    // MC registration guardrail: verify project is registered in Mission Control
    const deployType = parsed["deploy_type"] || "";
    if (deployType === "new-web" || deployType === "new-mobile" || deployType === "update") {
      const projectName = context["repo"] ? path.basename(context["repo"]) : "";
      if (projectName) {
        try {
          const mcCheck = execFileSync("curl", ["-sf", "--max-time", "5", `http://127.0.0.1:3080/api/projects/${projectName}`],
            { timeout: 10_000, stdio: "pipe" }).toString().trim();
          const mcData = JSON.parse(mcCheck);
          if (!mcData.id) {
            deployErr = `GUARDRAIL: Project "${projectName}" not found in Mission Control after deploy. MC registration failed.`;
          } else {
            logger.info(`[deploy-guardrail] MC registration verified: ${projectName}`, { runId: step.run_id });
          }
        } catch {
          deployErr = `GUARDRAIL: Project "${projectName}" not found in Mission Control. Deploy must register the project.`;
        }
        if (deployErr) {
          logger.warn(`[deploy-guardrail] ${deployErr}`, { runId: step.run_id, stepId: step.step_id });
          if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
          await failStep(stepId, deployErr);
          return { advanced: false, runCompleted: false };
        }
      }
    }

    // ISSUE-3 FIX: Verify main branch has source code (package.json)
    // If feature→main merge (Issue 2 guardrail) worked, main should have all source.
    // This is a safety check — warns but doesn't block deploy.
    const deployRepoPath = context["repo"] || "";
    if (deployRepoPath) {
      try {
        const mainHasPackageJson = execFileSync("git", ["show", "main:package.json"], {
          cwd: deployRepoPath, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
        }).toString().trim();
        if (!mainHasPackageJson) {
          logger.warn(`[deploy-guardrail] main branch missing package.json — source may not be merged`, { runId: step.run_id });
        } else {
          logger.info(`[deploy-guardrail] main branch source verification passed (package.json exists)`, { runId: step.run_id });
        }
      } catch {
        logger.warn(`[deploy-guardrail] main branch source verification failed — package.json not found on main`, { runId: step.run_id });
      }
    }

    // Tunnel + DNS auto-create: ensure Cloudflare tunnel entry + DNS CNAME exist
    const deployProjectName = context["repo"] ? path.basename(context["repo"]) : "";
    if (deployProjectName && port) {
      const hostname = `${deployProjectName}.setrox.com.tr`;
      let tunnelOk = false;
      // Try sudo first, then non-sudo fallback
      for (const cmd of [["sudo", "bash"], ["bash"]]) {
        if (tunnelOk) break;
        try {
          execFileSync(cmd[0], [...cmd.slice(1), path.join(os.homedir(), ".openclaw/scripts/tunnel-add.sh"), hostname, String(port)], {
            timeout: 30000, stdio: "pipe",
          });
          tunnelOk = true;
          logger.info(`[deploy-guardrail] Tunnel + DNS ensured for ${hostname}:${port}`, { runId: step.run_id });
        } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
      }
      if (!tunnelOk) {
        logger.warn(`[deploy-guardrail] Tunnel/DNS setup failed for ${hostname}`, { runId: step.run_id });
      }
    }
  }

  // SCREEN_MAP Enforcement (design step) — design owns screen identification
  // v12.0: design step SCREEN_MAP no longer requires stories field (stories step adds it later)
  logger.info(`[completeStep] step_id=${step.step_id} status=${parsed["status"]} has_screen_map=${!!context["screen_map"]}`, { runId: step.run_id });
  if (step.step_id === "design" && parsed["status"]?.toLowerCase() === "done") {
    logger.info(`[screen-map-guardrail] Entering design step guardrail check`, { runId: step.run_id });
    let screenMapErr: string | null = null;
    const screenMapRaw = context["screen_map"];
    if (screenMapRaw) {
      try {
        const sm = JSON.parse(screenMapRaw);
        if (!Array.isArray(sm) || sm.length === 0) {
          screenMapErr = "GUARDRAIL: SCREEN_MAP is empty array. Design must identify unique screens. Retry with valid SCREEN_MAP.";
        } else {
          for (const scr of sm) {
            if (!scr.screenId || !scr.name) {
              screenMapErr = "GUARDRAIL: SCREEN_MAP entries must have screenId and name. Fix SCREEN_MAP format.";
              break;
            }
          }
          // v1.7.7: Minimum screen count enforcement
          // Count PRD screen table rows from context (if planner stored them)
          const prdScreenCount = context["prd_screen_count"] ? parseInt(context["prd_screen_count"], 10) : 0;
          if (!screenMapErr && prdScreenCount > 0 && sm.length < prdScreenCount) {
            screenMapErr = `GUARDRAIL: SCREEN_MAP has ${sm.length} screens but PRD requires ${prdScreenCount}. Design must generate ALL screens from PRD table. Missing: ${prdScreenCount - sm.length} screens.`;
          }
          // Minimum absolute count: CRM/SaaS projects should have at least 8 screens
          if (!screenMapErr && sm.length < 3) {
            screenMapErr = "GUARDRAIL: SCREEN_MAP has only " + sm.length + " screens. Minimum 3 required. Add missing screens.";
          }
        }
      } catch {
        screenMapErr = "GUARDRAIL: SCREEN_MAP is not valid JSON. Fix SCREEN_MAP format.";
      }
    }
    if (screenMapErr) {
      logger.warn(`[screen-map-guardrail] SCREEN_MAP validation failed: ${screenMapErr}`, { runId: step.run_id, stepId: step.step_id });
      await failStep(stepId, screenMapErr);
      return { advanced: false, runCompleted: false };
    }
  }

  // Browser DOM Gate (implement step — advisory)
  // Use story_workdir for implement — story code lives in worktree, not main repo.
  if (step.step_id === "implement" && parsed["status"]?.toLowerCase() === "done") {
    const browserCtx = context["story_workdir"]
      ? { ...context, repo: context["story_workdir"] }
      : context;
    processBrowserCheck(browserCtx, step.run_id, step.step_id);
  }

  // Design Fidelity Check (verify + final-test steps — BLOCKING on structural/wiring errors)
  if ((step.step_id === "verify" || step.step_id === "final-test") && parsed["status"]?.toLowerCase() === "done") {
    const fidelityErr = await processDesignFidelityCheck(context, step.run_id);
    if (fidelityErr) {
      logger.warn(`[design-fidelity-gate] Blocking: ${fidelityErr}`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, fidelityErr);
      return { advanced: false, runCompleted: false };
    }
  }

  // Import Consistency Check (verify + final-test — BLOCKING on duplicate dirs/imports)
  if ((step.step_id === "verify" || step.step_id === "final-test") && parsed["status"]?.toLowerCase() === "done") {
    const repoPath = context["repo"] || context["REPO"] || "";
    if (repoPath) {
      const importErr = checkImportConsistency(repoPath);
      if (importErr) {
        logger.warn(`[import-consistency-gate] Blocking: ${importErr}`, { runId: step.run_id, stepId: step.step_id });
        if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
        await failStep(stepId, importErr);
        return { advanced: false, runCompleted: false };
      }
    }
  }

  // SMOKE TEST GUARDRAIL (final-test): If agent skipped smoke test, try to run it
  // ourselves before burning a retry slot. Agents frequently forget the smoke test
  // even when the build is fine (run #337 final-test needed a full retry for this).
  if (step.step_id === "final-test" && parsed["status"]?.toLowerCase() === "done") {
    let smokeResult = parsed["smoke_test_result"] || "";
    if (!smokeResult) {
      const repoPath = context["repo"] || "";
      const smokeScript = path.join(os.homedir(), ".openclaw", "setfarm-repo", "scripts", "smoke-test.mjs");
      if (repoPath && fs.existsSync(smokeScript)) {
        try {
          logger.info(`[final-test-autoderive] SMOKE_TEST_RESULT missing — running smoke-test.mjs`, { runId: step.run_id, stepId: step.step_id });
          const smokeOut = execFileSync("node", [smokeScript, repoPath], { timeout: 240000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          // smoke-test.mjs prints a summary; accept any non-empty output as the result
          smokeResult = (smokeOut || "").trim().slice(-2000) || "pass (auto-derived)";
          parsed["smoke_test_result"] = smokeResult;
          logger.info(`[final-test-autoderive] smoke-test auto-run succeeded`, { runId: step.run_id });
        } catch (smokeErr: any) {
          const errOut = String(smokeErr?.stdout || smokeErr?.stderr || smokeErr?.message || smokeErr).slice(0, 2000);
          logger.warn(`[final-test-autoderive] smoke-test auto-run failed: ${errOut.slice(0, 200)}`, { runId: step.run_id });
          // Leave smokeResult empty so the guardrail fires below
        }
      }
    }
    if (!smokeResult) {
      logger.warn(`[final-test-guardrail] SMOKE_TEST_RESULT missing from final-test output — agent likely skipped smoke test. Retrying.`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, "GUARDRAIL: final-test completed without SMOKE_TEST_RESULT. You MUST run smoke-test.mjs and include SMOKE_TEST_RESULT in your output.");
      return { advanced: false, runCompleted: false };
    }
  }

  // ISSUE-2 FIX: Pipeline-level feature→main merge guarantee
  // After final-test completes successfully, verify the feature branch is merged into main.
  // Agents sometimes skip or silently fail the merge — this guardrail ensures it happens.
  if (step.step_id === "final-test" && parsed["status"]?.toLowerCase() === "done") {
    const mergeBranch = context["branch"] || "feature/initial-prd";
    const mergeRepo = context["repo"] || "";
    if (mergeRepo && mergeBranch) {
      let isPrEachFinal = false;
      try {
        const loopRow = await pgGet<{ loop_config?: any }>(
          "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND loop_config IS NOT NULL LIMIT 1",
          [step.run_id]
        );
        const loopConfigRaw = loopRow?.loop_config;
        const loopConfig = typeof loopConfigRaw === "string" ? JSON.parse(loopConfigRaw || "{}") : (loopConfigRaw || {});
        isPrEachFinal = loopConfig?.mergeStrategy === "pr-each" || !!loopConfig?.verifyEach;
      } catch (loopErr) {
        logger.warn(`[final-test-merge-guardrail] loop_config lookup failed: ${String(loopErr).slice(0, 160)}`, { runId: step.run_id });
      }

      try {
        if (isPrEachFinal) {
          try {
            execFileSync("git", ["checkout", "main"], { cwd: mergeRepo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
            execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: mergeRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
            logger.info(`[final-test-merge-guardrail] pr-each flow detected; synced main and skipped stale run-branch merge`, { runId: step.run_id });
          } catch (syncErr) {
            logger.warn(`[final-test-merge-guardrail] pr-each main sync failed: ${String(syncErr)}`, { runId: step.run_id });
          }
        } else {
          // Check if an open PR exists for this branch → main
          let prMerged = false;
          try {
            const prUrl = execFileSync("gh", ["pr", "list", "--head", mergeBranch, "--base", "main", "--state", "open", "--json", "url", "--jq", ".[0].url"], {
              cwd: mergeRepo, encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"],
            }).trim();
            if (prUrl) {
              execFileSync("gh", ["pr", "merge", prUrl, "--squash", "--delete-branch"], {
                cwd: mergeRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
              });
              logger.info(`[final-test-merge-guardrail] PR merged via gh: ${prUrl}`, { runId: step.run_id });
              prMerged = true;
            }
          } catch (ghErr) {
            logger.warn(`[final-test-merge-guardrail] gh pr merge attempt failed: ${String(ghErr)}`, { runId: step.run_id });
          }

          // If no open PR was found/merged, try direct git merge
          if (!prMerged) {
            try {
              // Check if branch is already merged into main
              execFileSync("git", ["merge-base", "--is-ancestor", mergeBranch, "main"], {
                cwd: mergeRepo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
              });
              logger.info(`[final-test-merge-guardrail] Branch ${mergeBranch} already merged into main`, { runId: step.run_id });
            } catch {
              // Not yet merged — do direct merge
              try {
                execFileSync("git", ["checkout", "main"], { cwd: mergeRepo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
                execFileSync("git", ["merge", mergeBranch, "--no-ff", "-m", `Merge ${mergeBranch} into main`], { cwd: mergeRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
                execFileSync("git", ["push", "origin", "main"], { cwd: mergeRepo, timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
                logger.info(`[final-test-merge-guardrail] Direct merged ${mergeBranch} into main`, { runId: step.run_id });
              } catch (directMergeErr) {
                logger.warn(`[final-test-merge-guardrail] Direct merge failed: ${String(directMergeErr)}`, { runId: step.run_id });
              }
            }
          }
        }
      } catch (mergeErr) {
        logger.warn(`[final-test-merge-guardrail] Merge guardrail failed: ${String(mergeErr)}`, { runId: step.run_id });
      }

      // After all merge attempts, verify main has source code
      let mainHasSource = false;
      try {
        execFileSync("git", ["show", "main:package.json"], { cwd: mergeRepo, timeout: 5000, stdio: "pipe" });
        mainHasSource = true;
      } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }

      if (!mainHasSource && step.retry_count < step.max_retries) {
        context["previous_failure"] = "MERGE FAIL: Feature branch not merged into main. Main branch has no source code.";
        context["failure_category"] = "MERGE_CONFLICT";
        context["failure_suggestion"] = isPrEachFinal
          ? "pr-each flow should already have story PRs merged; sync origin/main or inspect missing package.json"
          : "Merge feature branch into main manually or resolve conflicts";
        await updateRunContext(step.run_id, context);
        await failStep(stepId, "Feature branch not merged into main — source code missing");
        return { advanced: false, runCompleted: false };
      }
    }
  }

  await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);

  // (parseAndInsertStories + 0-stories + scope_files + overlap + hallucinated-path
  //  + multi-owner guardrails moved to 03-stories/guards.ts onComplete — invoked
  //  via step-module delegation block above.)

  // Auto-generate SCREEN_MAP if stories step did not produce one with story mappings (fallback)
  // v12.0: stories step should output SCREEN_MAP with stories field, but if it doesn't, auto-generate
  if (step.step_id === "stories" && parsed["status"]?.toLowerCase() === "done") {
    const screenMapRaw = context["screen_map"];
    let needsAutoGen = false;
    if (screenMapRaw) {
      try {
        const sm = JSON.parse(screenMapRaw);
        // Check if stories field is populated
        const hasStoryMappings = Array.isArray(sm) && sm.some((s: any) => Array.isArray(s.stories) && s.stories.length > 0);
        if (!hasStoryMappings) needsAutoGen = true;
      } catch (parseErr: any) {
        needsAutoGen = true;
      }
    } else {
      needsAutoGen = true;
    }
    if (needsAutoGen) {
      const hasUi = (context["has_ui"] || "").toLowerCase() === "true" || ["ui", "fullstack"].includes((context["project_type"] || "").toLowerCase());
      if (hasUi) {
        const autoStories = await getStories(step.run_id);
        if (autoStories.length > 0) {
          const screenMap: Array<{screenId: string; name: string; type: string; description: string; stories: string[]}> = [];
          let scrIdx = 1;
          for (const s of autoStories) {
            if (true) { // All stories in UI projects get screen mapping
              screenMap.push({
                screenId: `SCR-${String(scrIdx++).padStart(3, "0")}`,
                name: s.title,
                type: "app-screen",
                description: s.description || s.title,
                stories: [s.storyId],
              });
            }
          }
          if (screenMap.length === 0) {
            screenMap.push({
              screenId: "SCR-001",
              name: "Main Screen",
              type: "app-screen",
              description: "Primary application interface",
              stories: autoStories.map(s => s.storyId),
            });
          }
          context["screen_map"] = JSON.stringify(screenMap);
          await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);
          logger.info(`[screen-map-guardrail] Auto-generated SCREEN_MAP with ${screenMap.length} screen(s) from ${autoStories.length} stories (stories step fallback)`, { runId: step.run_id });
        }
      }
    }
  }

  // #157 GUARD: If the IMMEDIATELY NEXT step is a loop, verify stories exist.
  // v12.0: Only fire if no non-loop steps remain between current and next loop step,
  // because intermediate steps (e.g. stories, setup) may produce STORIES_JSON later.
  const nextLoopStep = await pgGet<{ id: string; step_id: string; step_index: number }>("SELECT id, step_id, step_index FROM steps WHERE run_id = $1 AND type = 'loop' AND step_index > $2 AND status = 'waiting' ORDER BY step_index ASC LIMIT 1", [step.run_id, step.step_index]);
  if (nextLoopStep) {
    // Check if there are any non-loop steps between us and the next loop step
    const intermediateSteps = await pgGet<{ cnt: number }>("SELECT COUNT(*) as cnt FROM steps WHERE run_id = $1 AND step_index > $2 AND step_index < $3 AND type != 'loop' AND status IN ('waiting', 'pending')", [step.run_id, step.step_index, nextLoopStep.step_index]);
    if ((intermediateSteps?.cnt ?? 0) === 0) {
      // No intermediate steps — this is the last step before the loop
      const storyCount = { cnt: await countAllStories(step.run_id) };
      if (storyCount.cnt === 0) {
        const noStoriesMsg = "Step completed but produced no STORIES_JSON — downstream loop would run with 0 stories";
        logger.warn(noStoriesMsg, { runId: step.run_id, stepId: step.step_id });
        await failStepWithOutput(step.id, noStoriesMsg);
        await failRun(step.run_id, true);
        const wfId157b = await getWorkflowId(step.run_id);
        emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId157b, stepId: step.step_id, detail: noStoriesMsg });
        emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId157b, detail: noStoriesMsg });
        scheduleRunCronTeardown(step.run_id);
        return { advanced: false, runCompleted: false };
      }
    } else {
      logger.info(`[stories-guard] Skipped — ${intermediateSteps?.cnt} step(s) remain before loop step ${nextLoopStep.step_id}`, { runId: step.run_id, stepId: step.step_id });
    }
  }

  // T7: Loop step completion
  // RACE CONDITION GUARD: If loop step but current_story_id is NULL,
  // another parallel agent cleared it. Do NOT fall through to single-step
  // completion — that would prematurely end the loop while stories remain.
  if (step.type === "loop" && !step.current_story_id) {
    logger.warn(`Loop step complete called with no current_story_id — parallel race condition, ignoring`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  if (step.type === "loop" && step.current_story_id) {
    // Wave 14 Bug L: stale claim guard. If story was re-claimed (timeout + re-claim),
    // the original agent may still report done with the old claim_generation. Reject it.
    const agentGen = parseInt(parsed["claim_generation"] || context["claim_generation"] || "0", 10);
    const dbGenRow = await pgGet<{ claim_generation: number }>("SELECT claim_generation FROM stories WHERE id = $1", [step.current_story_id]);
    const dbGen = dbGenRow?.claim_generation ?? 0;
    if (agentGen > 0 && dbGen > 0 && agentGen < dbGen) {
      logger.warn(`[stale-claim] Agent reported claim_generation=${agentGen}, DB has ${dbGen} — rejecting stale output`, { runId: step.run_id, stepId: step.step_id });
      return { advanced: false, runCompleted: false };
    }

    // Look up story info for event
    const storyRow = await getStoryInfo(step.current_story_id);

    // v9.0: Check agent STATUS — skip, fail/error (defense-in-depth), or done
    // Wave 13+ hotfix: parseOutputKeyValues can leak trailing lines into the
    // STATUS value when agent output lacks blank separators. Run #352 US-003:
    // parsed["status"] = "done\nstepId: ..." instead of just "done".
    // Fix: trim and extract only the first word from the status value.
    const rawStatus = (parsed["status"] || "").trim();
    const statusVal = (rawStatus.indexOf("\n") >= 0 ? rawStatus.slice(0, rawStatus.indexOf("\n")).trim() : rawStatus).split(/\s/)[0].toLowerCase() || undefined;
    let storyStatus: string, storyEvent: string;
    if (statusVal === "fail" || statusVal === "failed" || statusVal === "error") {
      storyStatus = STORY_STATUS.FAILED; storyEvent = "story.failed";
    } else if (statusVal === "skip") {
      storyStatus = STORY_STATUS.SKIPPED; storyEvent = "story.skipped";
    } else {
      storyStatus = STORY_STATUS.DONE; storyEvent = "story.done";
    }

    // PHASED DEVELOPMENT — opt-in via loop config `phases: true`
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && step.loop_config) {
      try {
        const lc = JSON.parse(step.loop_config);
        if (lc.phases) {
          const currentPhase = context["implement_phase"] || "foundation";
          const phases = ["foundation", "core", "ui"];
          const phaseIdx = phases.indexOf(currentPhase);

          if (phaseIdx < phases.length - 1) {
            // Check phase gate
            const { checkPhaseGate } = await import("./step-guardrails.js");
            const workdir = context["story_workdir"] || context["repo"] || "";
            const gateResult = checkPhaseGate(workdir, currentPhase);

            if (gateResult && step.retry_count < step.max_retries) {
              // Phase gate failed — retry with fix instructions
              context["previous_failure"] = `PHASE GATE (${currentPhase}): ${gateResult}`;
              context["failure_category"] = "GUARDRAIL_FAIL";
              await updateRunContext(step.run_id, context);
              await failStep(stepId, gateResult);
              logger.info(`[phased-dev] Phase gate failed for ${currentPhase}, retrying`, { runId: step.run_id });
              return { advanced: false, runCompleted: false };
            }

            // Phase passed — advance to next phase
            const nextPhase = phases[phaseIdx + 1];
            context["implement_phase"] = nextPhase;
            context["previous_failure"] = "";
            await updateRunContext(step.run_id, context);

            // Re-queue story as pending for next phase
            await pgRun("UPDATE stories SET status = 'pending', updated_at = $1 WHERE id = $2",
              [now(), step.current_story_id]);

            logger.info(`[phased-dev] Phase ${currentPhase} complete, advancing to ${nextPhase}`, { runId: step.run_id });
            return { advanced: false, runCompleted: false };
          }
          // Final phase (ui) — fall through to normal completion
        }
      } catch (e) {
        logger.warn(`[phased-dev] Skipped: ${String(e)}`, { runId: step.run_id });
      }
    }

    // Design compliance check — only for implement step, done stories
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE) {
      const designIssue = checkStoryDesignCompliance(context);
      if (designIssue && step.retry_count >= 2 && step.retry_count < step.max_retries) {
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} failed design check — soft retry`, { runId: step.run_id });
        const { classifyError: _ce3 } = await import("./error-taxonomy.js");
        const _cl3 = _ce3(designIssue);
        context["previous_failure"] = `DESIGN COMPLIANCE: ${designIssue}`;
        context["failure_category"] = _cl3.category;
        context["failure_suggestion"] = _cl3.suggestion;
        await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);
        await failStep(stepId, designIssue);
        return { advanced: false, runCompleted: false };
      } else if (designIssue && step.retry_count < 2) {
        // First 1-2 attempts: warn only (advisory), let story pass
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} design issues (advisory, retry ${step.retry_count}): ${designIssue}`, { runId: step.run_id });
      } else if (designIssue) {
        // Max retries — log warning but let story pass (advisory)
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} design issues (max retries reached, advisory): ${designIssue}`, { runId: step.run_id });
      }
    }

    // TEST RUNNER — run project tests on implement story completion
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE) {
      try {
        const { detectTestFramework, runTests, buildTestFixPrompt } = await import("./test-generation.js");
        const testRepo = context["story_workdir"] || context["repo"] || "";
        if (testRepo) {
          const framework = detectTestFramework(testRepo);
          if (framework.runner !== "none") {
            const testResult = runTests(testRepo, framework);
            if (!testResult.passed) {
              // 2026-04-21: WARN-ONLY. Test failures no longer fail story — verify step catches them
              // via PR review. Avoids infinite retry loop when agent keeps producing flaky/failing tests.
              logger.warn(`[test-runner] ${testResult.failedTests} test(s) failed for story ${storyRow?.story_id} (advisory, not blocking)`, { runId: step.run_id });
              context["test_warnings"] = `${testResult.failedTests} test(s) failed — see verify step review`;
              await updateRunContext(step.run_id, context);
            }
          }
        }
      } catch (e) {
        logger.warn(`[test-runner] Skipped: ${String(e)}`, { runId: step.run_id });
      }
    }

    // SCOPE ENFORCEMENT — delegated to 06-implement/guards.ts
    // (Wave 6 fix A, Wave 10 Bug D, Wave 13 Bug P9, Wave 14 Bug Q)
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && storyRow?.story_id) {
      try {
        const { resolveStoryWorktree, checkScopeFilesGate, checkScopeEnforcement } = await import("./steps/06-implement/guards.js");
        const wd = await resolveStoryWorktree(step.current_story_id, context["story_workdir"] || "");
        const scopeLoopConfig = parseLoopConfigSafe(step.loop_config, step.run_id);
        const baseBr = context["story_base_ref"] || ((scopeLoopConfig?.mergeStrategy === "pr-each" || scopeLoopConfig?.verifyEach) ? "main" : (context["branch"] || ""));

        // 2026-04-22: Setup story (story_index === 0) bypass KALDIRILDI.
        // Eski davranis: setup story scope check'e tabi degildi -> agent tam app yaziyordu
        // -> sonraki story'ler "dosya zaten yazilmis" SCOPE_FILE_MISSING aliyordu.
        // Artik tum story'ler scope check'e tabi. Config dosyalari (package.json, vite.config,
        // tailwind.config, postcss.config, tsconfig.json vb.) zaten guards.ts SCOPE_IGNORE
        // regex'inde ignore ediliyor, setup story rahatlikla calisir.
        if (wd && baseBr && fs.existsSync(wd)) {
          // Scope files existence gate (declared files must exist in worktree)
          if (step.retry_count < step.max_retries) {
            const sfGate = await checkScopeFilesGate(storyRow.story_id, step.current_story_id, storyRow.title, wd);
            if (!sfGate.passed) {
              context["previous_failure"] = sfGate.reason!;
              context["failure_category"] = sfGate.category!;
              context["failure_suggestion"] = sfGate.suggestion!;
              await updateRunContext(step.run_id, context);
              await failStep(stepId, sfGate.reason!);
              return { advanced: false, runCompleted: false };
            }
          }

          // Zero-work, stub, scope bleed, scope overflow checks
          const scopeResult = await checkScopeEnforcement(
            storyRow.story_id, step.current_story_id, storyRow.title,
            wd, baseBr, step.retry_count, step.max_retries,
          );
          if (!scopeResult.passed && scopeResult.category) {
            // SCOPE_BLEED cleanup: revert out-of-scope files to baseline so the
            // next retry doesn't inherit them. Without this, the offending
            // commit stays on the branch; when the story later merges, those
            // files collide with other stories that own them (observed run
            // #496 US-001 merge conflict — US-002 bleed left US-001's files
            // in US-002's branch, merge-queue rejected clean US-001 branch).
            if (scopeResult.category === "SCOPE_BLEED" && scopeResult.outOfScope && scopeResult.outOfScope.length > 0 && wd && baseBr) {
              // SILENT REVERT (2026-04-22): cleanup out-of-scope files + amend commit.
              // Pink Elephant: failing with feedback "Integration files belong to integration
              // story" makes LLMs repeat the bleed. Silent cleanup preserves scope-clean commit
              // and lets story continue to DONE → auto-PR → verify reviews.
              let cleanupOk = false;
              try {
                const outOfScopeFiles = scopeResult.outOfScope;
                for (const file of outOfScopeFiles) {
                  try {
                    execFileSync("git", ["checkout", baseBr, "--", file], {
                      cwd: wd, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                    });
                  } catch (checkoutErr) {
                    try {
                      execFileSync("git", ["rm", "-f", file], {
                        cwd: wd, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
                      });
                    } catch { /* best effort */ }
                  }
                }
                try {
                  execFileSync("git", ["commit", "--amend", "--no-edit", "--allow-empty"], {
                    cwd: wd, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                    env: { ...process.env, GIT_COMMITTER_NAME: "Moltclaw AI", GIT_COMMITTER_EMAIL: "setrox@moltclaw.local" },
                  });
                  cleanupOk = true;
                } catch { /* best effort */ }
                logger.warn(`[scope-bleed-silent] Reverted ${outOfScopeFiles.length} out-of-scope file(s) in ${storyRow.story_id}: ${outOfScopeFiles.slice(0, 5).join(", ")} — story kept DONE`, { runId: step.run_id });
              } catch (cleanupErr) {
                logger.warn(`[scope-bleed-silent] Cleanup failed: ${String(cleanupErr).slice(0, 200)}`, { runId: step.run_id });
              }
              if (cleanupOk) {
                context["scope_bleed_warning"] = `Silently reverted ${scopeResult.outOfScope.length} out-of-scope file(s): ${scopeResult.outOfScope.slice(0, 3).join(", ")}`;
                await updateRunContext(step.run_id, context);
                // Fall through — story done.
              } else {
                // 2026-04-22: Cleanup failed -> WARNING ONLY (no fail). Setup bypass + story
                // roadmap riskini azaltti. Tam app yazsa bile merge queue cogu dosyayi ignore
                // eder. Story DONE olarak gecsin, fail retry dongusunu kirsin.
                context["scope_bleed_warning"] = `Scope bleed detected (cleanup failed): ${scopeResult.outOfScope!.length} out-of-scope file(s). Story kept DONE advisory.`;
                logger.warn(`[scope-bleed-warn] Story ${storyRow.story_id} kept DONE despite scope bleed (${scopeResult.outOfScope!.length} files) — cleanup failed, tolerating`, { runId: step.run_id });
                await updateRunContext(step.run_id, context);
                // Fall through — don't fail.
              }
            } else {
              // Non-SCOPE_BLEED or no outOfScope list — original fail behavior
              context["previous_failure"] = scopeResult.reason!;
              context["failure_category"] = scopeResult.category;
              context["failure_suggestion"] = scopeResult.suggestion!;
              await updateRunContext(step.run_id, context);
              await failStep(stepId, scopeResult.reason!);
              return { advanced: false, runCompleted: false };
            }
          }
          // Soft warning (scope creep flag for verify step)
          if (scopeResult.reason && scopeResult.passed) {
            context["scope_creep_warning"] = scopeResult.reason;
          }
        }
      } catch (scopeErr) {
        logger.warn(`[scope-check] Skipped for story ${storyRow.story_id}: ${String(scopeErr).slice(0, 150)}`, { runId: step.run_id });
      }
    }

    // Mark current story done or skipped + persist PR context for verify_each
    // FIX: Remove context fallback to prevent cross-contamination between parallel stories
    let storyPrUrl = parsed["pr_url"] || "";

    // Wave 12 Bug H fix (plan: reactive-frolicking-cupcake.md, run #344 postmortem):
    // Capture the agent's ORIGINAL STORY_BRANCH and PR_URL claims BEFORE any overwrite
    // below. Wave 1 Fix #3 cross-project guard (further down) was reading
    // parsed["story_branch"] AFTER the DB-value overwrite, so any divergence between
    // the agent's claim and the expected branch was erased before the check ran. Run
    // #344 caught it: prism committed pomodoro timer code into the SETFARM-REPO (cwd
    // confusion, agent never 'cd'd to story_workdir), reported STORY_BRANCH: main,
    // but the guard saw "d1605a46-us-002" (DB value) and happily passed. The work
    // landed as a 1067-line commit inside ~/.openclaw/setfarm-repo which had to be
    // reverted manually.
    const agentOriginalBranch = (parsed["story_branch"] || "").trim();
    const agentOriginalPr = (parsed["pr_url"] || "").trim();

    // ISSUE-1 FIX: Prefer pipeline-set branch (from DB) over agent's output (agents create wrong names)
    const dbStoryBranch = await pgGet<{ story_branch: string }>("SELECT story_branch FROM stories WHERE id = $1", [step.current_story_id]);
    // Wave 4 fix #11 (plan: reactive-frolicking-cupcake): normalize story_branch to
    // lowercase. Run #338 produced a `35b2cc22-US-005` (uppercase) branch alongside
    // `35b2cc22-us-005` (lowercase) because createStoryWorktree uses toLowerCase()
    // but the agent's STORY_BRANCH output was uppercase and wrote into the DB as-is.
    // Normalize at every point where story_branch is read from agent output or passed
    // to downstream steps.
    const storyBranchName = (dbStoryBranch?.story_branch || parsed["story_branch"] || context["story_branch"] || "").toLowerCase();
    // Always inject DB branch into context so verify agent can find it
    if (storyBranchName) {
      context["story_branch"] = storyBranchName;
      parsed["story_branch"] = storyBranchName;
    }
    // CROSS-PROJECT CONTAMINATION GUARD (run #337 US-002 hallucination fix + Wave 12 Bug H):
    // Agent sessions occasionally carry context from a previous project and fabricate
    // STORY_BRANCH / PR_URL fields pointing at a different repo. Detect that here and
    // fail the step with corrective feedback — never let a fabricated output be marked done.
    // Wave 12 Bug H: now uses the ORIGINAL agent claims captured above, not the
    // DB-overwritten values. Also runs for ALL statuses except SKIPPED (not just DONE)
    // so it still catches a cross-project commit even when the story reported failed
    // (e.g. run #344 US-002 hit 'test(s) failed' first which masked the branch mismatch).
    if (storyStatus !== STORY_STATUS.SKIPPED) {
      const expectedRunPrefix = step.run_id.slice(0, 8);
      const expectedRepoName = (context["repo"] || "").split("/").pop() || "";
      const branchMismatch = agentOriginalBranch && expectedRunPrefix && !agentOriginalBranch.toLowerCase().startsWith(expectedRunPrefix.toLowerCase()) && !agentOriginalBranch.toLowerCase().includes(expectedRunPrefix.toLowerCase());
      const prMismatch = agentOriginalPr && expectedRepoName && !agentOriginalPr.includes(`/${expectedRepoName}/`) && !agentOriginalPr.includes(`/${expectedRepoName}.git/`);
      if (branchMismatch || prMismatch) {
        const details: string[] = [];
        if (branchMismatch) details.push(`STORY_BRANCH "${agentOriginalBranch}" does not match run prefix "${expectedRunPrefix}"`);
        if (prMismatch) details.push(`PR_URL "${agentOriginalPr}" does not reference repo "${expectedRepoName}"`);
        const correctiveMsg = `CROSS-PROJECT CONTAMINATION: Agent output references a different project. ${details.join(". ")}. You must work in ${context["repo"] || "the assigned repo"} on story ${storyRow?.story_id} (${storyRow?.title}). Do NOT reference other repos, branches, or PRs. Re-do the work in the correct worktree.`;
        logger.error(`[cross-project-guard] ${correctiveMsg}`, { runId: step.run_id, stepId: step.step_id });
        if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
        await failStep(stepId, correctiveMsg);
        return { advanced: false, runCompleted: false };
      }
    }
    // FIX: Validate PR URL belongs to correct repo (cross-contamination guard)
    if (storyPrUrl && context["repo"]) {
      const expectedRepo = context["repo"].split("/").pop() || "";
      if (expectedRepo && !storyPrUrl.includes(expectedRepo)) {
        logger.error(`[cross-repo] Story ${storyRow?.story_id} PR ${storyPrUrl} does not match repo ${expectedRepo}`, { runId: step.run_id });
        storyPrUrl = "";
      }
    }
    // FIX: Prevent duplicate PR URL assignment (cross-contamination between parallel stories)
    if (storyPrUrl && storyRow?.story_id) {
      const duplicatePr = await pgGet<{ story_id: string }>(
        "SELECT story_id FROM stories WHERE run_id = $1 AND pr_url = $2 AND story_id != $3",
        [step.run_id, storyPrUrl, storyRow.story_id],
      );
      if (duplicatePr) {
        logger.error(`[duplicate-pr] PR ${storyPrUrl} already assigned to ${duplicatePr.story_id}, clearing for ${storyRow.story_id}`, { runId: step.run_id });
        storyPrUrl = "";
      }
    }

    // PR-EACH BASE GUARD: Developer agents must not create PRs, but some still
    // do. If they create one against the run branch, retarget it to main before
    // verify sees it; otherwise the story can merge into the wrong branch and
    // the next story starts from stale local main.
    const storyLoopConfig = parseLoopConfigSafe(step.loop_config, step.run_id);
    const requiredPrBase = (storyLoopConfig?.mergeStrategy === "pr-each" || storyLoopConfig?.verifyEach) ? "main" : "";
    if (storyStatus === STORY_STATUS.DONE && storyPrUrl && requiredPrBase && context["repo"]) {
      try {
        const infoRaw = execFileSync("gh", ["pr", "view", storyPrUrl, "--json", "baseRefName,url"], {
          cwd: context["repo"], timeout: 15_000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
        }).toString();
        const info = JSON.parse(infoRaw);
        const currentBase = String(info.baseRefName || "");
        if (currentBase && currentBase !== requiredPrBase) {
          const m = String(info.url || storyPrUrl).match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
          if (!m) throw new Error(`cannot parse PR URL ${storyPrUrl}`);
          execFileSync("gh", ["api", "-X", "PATCH", `repos/${m[1]}/${m[2]}/pulls/${m[3]}`, "-f", `base=${requiredPrBase}`], {
            cwd: context["repo"], timeout: 30_000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
          });
          logger.warn(`[pr-base-guard] Retargeted ${storyPrUrl} from ${currentBase} to ${requiredPrBase} for ${storyRow?.story_id}`, { runId: step.run_id });
        }
      } catch (baseErr) {
        logger.warn(`[pr-base-guard] Could not validate/retarget ${storyPrUrl}: ${String(baseErr).slice(0, 220)}`, { runId: step.run_id });
      }
    }
    // AUTO-PR (2026-04-21): Systemic PR creation — never rely on agent to run gh pr create.
    // If story is DONE and has a pushed branch but no PR URL, system opens PR on main.
    // Runs per-story so each logical unit gets its own PR for isolated review.
    if (
      storyStatus === STORY_STATUS.DONE &&
      !storyPrUrl &&
      storyBranchName &&
      context["repo"] &&
      storyBranchName.toLowerCase() !== (context["branch"] || "").toLowerCase()
    ) {
      const autoRepo = context["repo"];
      const autoBase = requiredPrBase || (context["branch"] || "main");
      try {
        // Ensure branch is pushed (idempotent)
        try {
          execFileSync("git", ["push", "-u", "origin", storyBranchName], {
            cwd: autoRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          });
        } catch (pushErr) {
          logger.warn(`[auto-pr] push failed for ${storyBranchName}: ${String(pushErr).slice(0, 200)}`, { runId: step.run_id });
        }

        // Check for existing PR (any state) to avoid duplicate creation
        let existingPr = "";
        try {
          existingPr = execFileSync("gh", ["pr", "list", "--head", storyBranchName, "--state", "all", "--json", "url", "--jq", ".[0].url // \"\""], {
            cwd: autoRepo, timeout: 15000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
          }).toString().trim();
        } catch (listErr) {
          logger.warn(`[auto-pr] pr list failed: ${String(listErr).slice(0, 150)}`, { runId: step.run_id });
        }

        if (existingPr) {
          storyPrUrl = existingPr;
          logger.info(`[auto-pr] Reusing existing PR ${existingPr} for story ${storyRow?.story_id}`, { runId: step.run_id });
        } else {
          const prTitle = `feat: ${storyRow?.story_id || "story"} - ${(storyRow?.title || "").slice(0, 70)}`;
          const changesRaw = (parsed["changes"] || output || "").toString().slice(0, 1500);
          const prBody = `## Story\n${storyRow?.story_id || ""}: ${storyRow?.title || ""}\n\n## Changes\n${changesRaw}\n\n_Auto-created by setfarm after story completion._`;
          try {
            const prOut = execFileSync("gh", ["pr", "create", "--base", autoBase, "--head", storyBranchName, "--title", prTitle, "--body", prBody], {
              cwd: autoRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
            }).toString().trim();
            const urlMatch = prOut.match(/https?:\/\/github\.com\/\S+/);
            if (urlMatch) {
              storyPrUrl = urlMatch[0];
              parsed["pr_url"] = storyPrUrl;
              context["pr_url"] = storyPrUrl;
              logger.info(`[auto-pr] Created PR ${storyPrUrl} for story ${storyRow?.story_id}`, { runId: step.run_id });
            } else {
              logger.warn(`[auto-pr] gh pr create returned no URL. Output: ${prOut.slice(0, 300)}`, { runId: step.run_id });
            }
          } catch (createErr) {
            logger.warn(`[auto-pr] gh pr create failed for ${storyBranchName}: ${String(createErr).slice(0, 400)}`, { runId: step.run_id });
          }
        }
      } catch (autoErr) {
        logger.warn(`[auto-pr] unexpected: ${String(autoErr).slice(0, 200)}`, { runId: step.run_id });
      }
    }

    await pgRun("UPDATE stories SET status = $1, output = $2, pr_url = $3, story_branch = $4, updated_at = $5 WHERE id = $6", [storyStatus, output, storyPrUrl, storyBranchName, now(), step.current_story_id]);
    emitEvent({ ts: now(), event: storyEvent as import("./events.js").EventType, runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title });
    logger.info(`Story ${storyStatus}: ${storyRow?.story_id} — ${storyRow?.title}`, { runId: step.run_id, stepId: step.step_id });

    // v1.5.50: Resolve claim_log outcome
    try {
      await pgRun("UPDATE claim_log SET outcome = 'completed', duration_ms = EXTRACT(EPOCH FROM NOW() - claimed_at::timestamptz) * 1000 WHERE story_id = $1 AND outcome IS NULL", [storyRow?.story_id || ""]);
    } catch (e) { logger.warn(`[claim-log] Failed to resolve completion: ${String(e)}`, { runId: step.run_id }); }

    // B2: Record step_metrics for SLA tracking
    try {
      const claimTs = await pgGet<{ claimed_at: string }>("SELECT claimed_at FROM claim_log WHERE step_id = $1 AND outcome IS NULL ORDER BY claimed_at DESC LIMIT 1", [step.step_id]);
      const actualClaimedAt = claimTs?.claimed_at || now();
      await pgRun("INSERT INTO step_metrics (run_id, step_name, agent_id, claimed_at, completed_at, duration_ms, outcome, created_at) VALUES ($1, $2, $3, $4, NOW(), EXTRACT(EPOCH FROM NOW() - $5::timestamptz) * 1000, 'completed', NOW())", [step.run_id, step.step_id, step.agent_id || "", actualClaimedAt, actualClaimedAt]);
    } catch (e) { logger.warn(`[step-metrics] insert failed: ${String(e)}`, { runId: step.run_id }); }



    // Update PROJECT_MEMORY.md with completed story info
    if (storyRow && storyStatus !== STORY_STATUS.SKIPPED) {
      await updateProjectMemory(context, storyRow.story_id, storyRow.title, storyStatus, output);
    }
    // Clean up: remove worktree (auto-saves uncommitted changes before removal)
    if (storyRow?.story_id && context["repo"]) {
      removeStoryWorktree(context["repo"], storyBranchName || storyRow.story_id, step.agent_id);
    }

    // FIX: Clear story-specific context to prevent cross-contamination between parallel stories
    delete context["pr_url"];
    delete context["story_branch"];
    delete context["current_story_id"];
    delete context["current_story_title"];
    delete context["current_story"];
    delete context["story_base_ref"];
    delete context["verify_feedback"];
    // Wave 1 fix #3 (plan: reactive-frolicking-cupcake): previous_failure is set by
    // failStep and guardrails when a story attempt fails, so the next retry sees its
    // own past error. It is never cleared anywhere, so when the loop finishes this
    // story and claims the NEXT one, the new story's agent inherits the previous
    // story's error message and gets steered by it ("fix the calculator test" while
    // implementing the settings page). Clear it here — story transition is the right
    // boundary, not claim time (retries on the same story must keep seeing it).
    delete context["previous_failure"];
    await updateRunContext(step.run_id, context);

    // Clear current_story_id, save output
    await pgRun("UPDATE steps SET current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3", [output, now(), step.id]);

    const loopConfig: LoopConfig | null = parseLoopConfigSafe(step.loop_config, step.run_id);

    // Wave 3 fix #18 (plan: reactive-frolicking-cupcake): make the loop completion
    // merge strategies explicit. Two branches follow:
    //   1. direct-merge — one batched PR via merge-queue at loop end. Used when
    //      loopConfig.mergeStrategy === "direct-merge".
    //   2. pr-each (default) — each story gets its own PR via the verify step
    //      loop. Used when loopConfig.verifyEach === true. This is the implicit
    //      default; there is no explicit "pr-each" string. If neither branch
    //      matches, we fall through to checkLoopContinuation as a safety net.
    // Any future strategy must be added as an explicit branch above the
    // fall-through, not silently plumbed through.

    // DIRECT-MERGE: No per-story PRs — merge queue runs after all stories complete
    if (loopConfig?.mergeStrategy === "direct-merge") {
      // Check if all stories are done (no pending/running left)
      const activeCount = await pgGet<{ count: string }>(
        "SELECT COUNT(*) as count FROM stories WHERE run_id = $1 AND status IN ('pending', 'running')",
        [step.run_id],
      );
      const active = parseInt(activeCount?.count || "0", 10);
      if (active === 0) {
        // All stories done — run merge queue
        logger.info(`[direct-merge] All stories done, starting merge queue`, { runId: step.run_id });
        const repoPath = context["repo"] || "";
        const featureBranch = context["branch"] || "";
        if (repoPath && featureBranch) {
          try {
            const mqResult = await runMergeQueue(step.run_id, repoPath, featureBranch);
            logger.info(`[direct-merge] Merge queue complete: ${mqResult.merged.length} merged, ${mqResult.conflicted.length} conflicts`, { runId: step.run_id });

            // Bug A fix (plan: reactive-frolicking-cupcake.md, run #342 postmortem):
            // Wave 1 #2 removed skipFailedStories from the claim path so the
            // checkLoopContinuation guardrail (96dd442) could fail the run on any
            // failed story. But the direct-merge code path bypasses checkLoopContinuation
            // entirely — runMergeQueue marks conflicted stories as failed (Wave 1 #8)
            // and we then jump straight to advancePipeline. Result: implement step
            // gets marked done and verify/qa-test/deploy all run on a broken state.
            // Run #342 caught this with US-001 + US-003 in 'failed' status while the
            // run sat at 'completed' and PR #2 was merged anyway. Now we explicitly
            // count failed stories AFTER the merge queue and short-circuit to a run
            // failure instead of advancing the pipeline.
            const failedStories = await pgQuery<{ story_id: string; title: string }>(
              "SELECT story_id, title FROM stories WHERE run_id = $1 AND status = 'failed' ORDER BY story_index",
              [step.run_id],
            );
            if (failedStories.length > 0) {
              const failList = failedStories.map(s => `${s.story_id} (${s.title})`).join(", ");
              const failMsg = `Direct-merge complete but ${failedStories.length} story(s) failed: ${failList}. Run cannot proceed with broken stories — verify, qa-test, deploy would all be on partial work. Resolve the merge conflicts manually, mark stories verified, and resume the run, or restart with a clean PRD.`;
              logger.error(`[direct-merge] ${failMsg}`, { runId: step.run_id });
              await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [
                `STATUS: failed\nMERGE_QUEUE_RESULT: ${mqResult.merged.length} merged, ${mqResult.conflicted.length} conflicted\nFAILED_STORIES: ${failList}\nREASON: ${failMsg}`,
                now(), step.id,
              ]);
              // Wave 13 J-2: terminal flag — medic must not resume this run
              await failRun(step.run_id, true);
              const wfIdF = await getWorkflowId(step.run_id);
              emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdF, stepId: step.step_id, detail: failMsg });
              emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdF, detail: failMsg });
              scheduleRunCronTeardown(step.run_id);
              return { advanced: false, runCompleted: false };
            }

            // Mark loop step done and advance
            await pgRun("UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3", [
              `STATUS: done\nMERGED: ${mqResult.merged.join(', ')}\nCONFLICTS: ${mqResult.conflicted.join(', ')}\nFINAL_PR: ${mqResult.prUrl || 'none'}`,
              now(), step.id,
            ]);
            // Set final_pr in context for verify step
            if (mqResult.prUrl) {
              context["final_pr"] = mqResult.prUrl;
              await updateRunContext(step.run_id, context);
            }
            return advancePipeline(step.run_id);
          } catch (mqErr) {
            // Wave 11 Bug G fix (plan: reactive-frolicking-cupcake.md, run #344 postmortem):
            // runMergeQueue throws when too many stories hit conflicts (>= merged count).
            // The previous code marked the step failed and called advancePipeline, which
            // silently moved the pipeline to verify/qa-test/deploy even though implement
            // was in failed state. Wave 8 Bug A fix was INSIDE the try block, so the throw
            // path skipped it entirely. Run #344 caught it: implement=failed, but verify
            // was still claimed 4 times in rapid succession (verify delay-loop) because
            // advancePipeline happily moved forward. Now we directly fail the run —
            // never call advancePipeline when the merge queue has thrown.
            const mqErrMsg = String(mqErr);
            logger.error(`[direct-merge] Merge queue threw — failing run: ${mqErrMsg}`, { runId: step.run_id });
            const failMsg = `Merge queue aborted: ${mqErrMsg}. Too many story branches hit merge conflicts to recover automatically — inspect the stories table for which ones ended in status='failed' with merge_status='conflict', fix those branches manually, or restart the run with a cleaner PRD.`;
            await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [
              `STATUS: failed\nERROR: ${failMsg}`,
              now(), step.id,
            ]);
            // Wave 13 J-2: terminal flag — medic must not resume this run
            await failRun(step.run_id, true);
            const wfIdMQ = await getWorkflowId(step.run_id);
            emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdMQ, stepId: step.step_id, detail: failMsg });
            emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdMQ, detail: failMsg });
            scheduleRunCronTeardown(step.run_id);
            return { advanced: false, runCompleted: false };
          }
        } else {
          // Missing repo or branch context — fail the run directly, don't advance
          // (Wave 11 Bug G: this path also advanced past a failed implement step)
          logger.error(`[direct-merge] Missing repo/branch context for merge queue`, { runId: step.run_id });
          const missingMsg = "Missing repo or branch context for merge queue — implement step cannot complete";
          await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [
            `STATUS: failed\nERROR: ${missingMsg}`,
            now(), step.id,
          ]);
          // Wave 13 J-2: terminal flag — medic must not resume this run
          await failRun(step.run_id, true);
          const wfIdMissing = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdMissing, stepId: step.step_id, detail: missingMsg });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdMissing, detail: missingMsg });
          scheduleRunCronTeardown(step.run_id);
          return { advanced: false, runCompleted: false };
        }
      }
      // More stories pending — keep loop running
      return { advanced: false, runCompleted: false };
    }

    // T8: verify_each flow — set verify step to pending
    if (loopConfig?.verifyEach && loopConfig.verifyStep) {
      const verifyStep = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [step.run_id, loopConfig.verifyStep]);

      if (verifyStep) {
        // Only set verify to pending if not already pending/running (prevents race condition with parallel stories)
        await pgRun("UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2 AND status IN ('waiting', 'done')", [now(), verifyStep.id]);
        // ISSUE-4 FIX: Preserve started_at — only set on first transition to running
        await pgRun("UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2", [now(), step.id]);
        return { advanced: false, runCompleted: false };
      }
    }

    // No verify_each: check for more stories
    return checkLoopContinuation(step.run_id, step.id);
  }

  // T8: Check if this is a verify step triggered by verify-each
  // NOTE: Don't filter by status='running' — the loop step may have been temporarily
  // reset by cleanupAbandonedSteps, causing this to fall through to single-step path (#52)
  const loopStepRow = await pgGet<{ id: string; loop_config: string | null; run_id: string }>("SELECT id, loop_config, run_id FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [step.run_id]);

  if (loopStepRow?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStepRow.loop_config);
    if (lc.verifyEach && lc.verifyStep === step.step_id) {
      return await handleVerifyEachCompletion(step, loopStepRow.id, output, context);
    }
  }

  // Single step: mark done (accept both running and pending — medic may have reset a slow step to pending
  // while the agent was still finishing its work, so we should still accept the completion)
  let _updateChanges: number;
  const _ur = await pgRun("UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3 AND status IN ('running', 'pending')", [output, now(), stepId]);
  _updateChanges = _ur.changes;
  if (_updateChanges === 0) {
    // Already completed by another session — skip to prevent double pipeline advancement
    logger.info(`Step already completed, skipping duplicate`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }
  await recordStepTransition(stepId, step.run_id, "running", "done", step.agent_id, "completeStep");
  emitEvent({ ts: now(), event: "step.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id });
  logger.info(`Step completed: ${step.step_id}`, { runId: step.run_id, stepId: step.step_id });

  // Post-complete: delete /tmp output files to prevent peek-recovery cross-step contamination
  try {
    const _tmpFiles = fs.readdirSync("/tmp").filter(f => f.startsWith("setfarm-output-") && f.endsWith(".txt"));
    for (const _f of _tmpFiles) { try { fs.unlinkSync("/tmp/" + _f); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); } }
  } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }

  // v1.5.50: Resolve claim_log outcome for single step
  try {
    await pgRun("UPDATE claim_log SET outcome = 'completed', duration_ms = EXTRACT(EPOCH FROM NOW() - claimed_at::timestamptz) * 1000 WHERE run_id = $1 AND step_id = $2 AND story_id IS NULL AND outcome IS NULL", [step.run_id, step.step_id]);
  } catch (e) { logger.warn(`[claim-log] Failed to resolve completion: ${String(e)}`, { runId: step.run_id }); }

    // B2: Record step_metrics for single step
    try {
      await pgRun("INSERT INTO step_metrics (run_id, step_name, agent_id, claimed_at, completed_at, duration_ms, outcome, created_at) VALUES ($1, $2, $3, $4, NOW(), 0, 'completed', NOW())", [step.run_id, step.step_id, step.agent_id || "", now()]);
    } catch (e) { logger.warn(`[step-metrics] insert failed: ${String(e)}`, { runId: step.run_id }); }


  // Guard: if a loop step is still active (not done), don't advance the pipeline.
  // During verify_each cycles, single steps (test, pr, review, etc.) may get claimed
  // and completed — advancing would skip the loop and break story iteration.
  const activeLoop = await findActiveLoop(step.run_id);
  if (activeLoop) {
    logger.info(`Skipping advancePipeline — loop step still active`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  return advancePipeline(step.run_id);
}

/**
 * Handle verify-each completion: pass or fail the story.
 */
async function handleVerifyEachCompletion(
  verifyStep: { id: string; run_id: string; step_id: string; step_index: number },
  loopStepId: string,
  output: string,
  context: Record<string, string>
): Promise<{ advanced: boolean; runCompleted: boolean }> {
  const parsedOutput = parseOutputKeyValues(output);

  // Guard: strip protected keys from parsed output to prevent seed value corruption
  for (const key of PROTECTED_CONTEXT_KEYS) {
    if (key in parsedOutput) {
      logger.warn(`[handleVerifyEach] Stripped protected key "${key}" from output`, { runId: verifyStep.run_id });
      delete parsedOutput[key];
    }
  }

  const status = parsedOutput["status"]?.toLowerCase() || context["status"]?.toLowerCase();

  // Atomic guard: prevent parallel crons from double-completing the same verify step.
  // Only proceed if we are the one that transitions it from running → waiting.
  const _pgChanged = await pgRun("UPDATE steps SET status = 'waiting', output = $1, updated_at = $2 WHERE id = $3 AND status = 'running'", [output, now(), verifyStep.id]);
  if (_pgChanged.changes === 0) { return { advanced: false, runCompleted: false }; }
  await recordStepTransition(verifyStep.id, verifyStep.run_id, "running", "waiting", undefined, "handleVerifyEachCompletion");

  // Identify the story being verified: output first (most reliable), then context (v1.5.53)
  let verifiedStoryId = parsedOutput["current_story_id"] || context["current_story_id"];
  if (!verifiedStoryId) {
    // Fallback: find the most recent 'done' story
    const lastDone = await pgGet<{ story_id: string }>("SELECT story_id FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC LIMIT 1", [verifyStep.run_id]);
    if (lastDone) {
      verifiedStoryId = lastDone.story_id;
      logger.warn(`[verify] current_story_id missing from output+context, using fallback: ${lastDone.story_id}`, { runId: verifyStep.run_id });
    }
  }

  if (status === "retry") {
    // Verify failed — retry the story
    // Find the specific story that was being verified
    let retryStory: { id: string; retry_count: number; max_retries: number } | undefined;
    if (verifiedStoryId) {
      retryStory = await pgGet<typeof retryStory>("SELECT id, retry_count, max_retries FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1", [verifyStep.run_id, verifiedStoryId]);
    }
    // Fallback: last done story by updated_at
    if (!retryStory) {
      retryStory = await pgGet<typeof retryStory>("SELECT id, retry_count, max_retries FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC LIMIT 1", [verifyStep.run_id]);
    }

    if (retryStory) {
      const newRetry = retryStory.retry_count + 1;
      if (newRetry > retryStory.max_retries) {
        // Story retries exhausted — fail everything (Wave 13 J-2: terminal flag)
        await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, updated_at = $2 WHERE id = $3", [newRetry, now(), retryStory.id]);
        await setStepStatus(loopStepId, "failed");
        await failRun(verifyStep.run_id, true);
        const wfId = await getWorkflowId(verifyStep.run_id);
        emitEvent({ ts: now(), event: "story.failed", runId: verifyStep.run_id, workflowId: wfId, stepId: verifyStep.step_id });
        emitEvent({ ts: now(), event: "run.failed", runId: verifyStep.run_id, workflowId: wfId, detail: "Verification retries exhausted" });
        scheduleRunCronTeardown(verifyStep.run_id);
        return { advanced: false, runCompleted: false };
      }

      // Set story back to pending for retry
      await pgRun("UPDATE stories SET status = 'pending', retry_count = $1, updated_at = $2 WHERE id = $3", [newRetry, now(), retryStory.id]);

      // Store verify feedback
      const issues = context["issues"] ?? output;
      context["verify_feedback"] = issues;
      emitEvent({ ts: now(), event: "story.retry", runId: verifyStep.run_id, workflowId: await getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, detail: issues });
      await updateRunContext(verifyStep.run_id, context);
    }

    // Set loop step back to pending for retry
    await setStepStatus(loopStepId, "pending");
    return { advanced: false, runCompleted: false };
  }

  // Verify PASSED — mark the verified story as 'verified' (not just 'done')
  if (verifiedStoryId) {
    const verifiedRow = await pgGet<{ id: string; pr_url: string | null; story_branch: string | null }>(
      "SELECT id, pr_url, story_branch FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
      [verifyStep.run_id, verifiedStoryId],
    );
    if (verifiedRow) {
      if (!verifiedRow.pr_url) {
        context["previous_failure"] = `PR_MISSING: ${verifiedStoryId} cannot be verified until a PR exists and is merged into main.`;
        context["current_story_id"] = verifiedStoryId;
        if (verifiedRow.story_branch) context["story_branch"] = verifiedRow.story_branch;
        await updateRunContext(verifyStep.run_id, context);
        await setStepStatus(verifyStep.id, "pending");
        logger.warn(`[verify] ${verifiedStoryId} reported done but has no PR URL — keeping verify pending`, { runId: verifyStep.run_id });
        return { advanced: false, runCompleted: false };
      }
      const prState = getPRState(verifiedRow.pr_url);
      if (prState !== "MERGED") {
        context["previous_failure"] = `PR_NOT_MERGED: ${verifiedStoryId} PR is ${prState}. Address review comments/checks, merge ${verifiedRow.pr_url} into main, then report STATUS: done.`;
        context["pr_url"] = verifiedRow.pr_url;
        context["current_story_id"] = verifiedStoryId;
        if (verifiedRow.story_branch) context["story_branch"] = verifiedRow.story_branch;
        await updateRunContext(verifyStep.run_id, context);
        await setStepStatus(verifyStep.id, "pending");
        logger.warn(`[verify] ${verifiedStoryId} PR is ${prState}, not MERGED — keeping verify pending`, { runId: verifyStep.run_id });
        return { advanced: false, runCompleted: false };
      }
      if (context["repo"]) syncBaseBranch(context["repo"], "main");
      await verifyStory(verifiedRow.id);
      logger.info(`Story verified: ${verifiedStoryId}`, { runId: verifyStep.run_id });
    }
  }
  emitEvent({ ts: now(), event: "story.verified", runId: verifyStep.run_id, workflowId: await getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, storyId: verifiedStoryId });

  // Clear feedback
  delete context["verify_feedback"];

  // Auto-verify 'done' stories whose PRs are already merged (prevents redundant verify cycles)
  const nextUnverifiedStory = await autoVerifyDoneStories(verifyStep.run_id, context, "handleVerifyEach");

  if (nextUnverifiedStory) {
    // More stories need verification — inject next story's info and cycle verify
    if (nextUnverifiedStory.output) {
      const storyOut = parseOutputKeyValues(nextUnverifiedStory.output);
      for (const [key, value] of Object.entries(storyOut)) {
        if (PROTECTED_CONTEXT_KEYS.has(key) && context[key]) continue;
        context[key] = value;
      }
    }
    // Override with DB columns if available
    if (nextUnverifiedStory.pr_url) context["pr_url"] = nextUnverifiedStory.pr_url;
    if (nextUnverifiedStory.story_branch) context["story_branch"] = nextUnverifiedStory.story_branch;
    context["current_story_id"] = nextUnverifiedStory.story_id;
    await updateRunContext(verifyStep.run_id, context);

    // Set verify step to pending for next story
    await setStepStatus(verifyStep.id, "pending");
    logger.info(`Verify cycling to next unverified story: ${nextUnverifiedStory.story_id}`, { runId: verifyStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  // No more unverified stories — persist context and check loop continuation
  await updateRunContext(verifyStep.run_id, context);

  try {
    return checkLoopContinuation(verifyStep.run_id, loopStepId);
  } catch (err) {
    logger.error(`checkLoopContinuation failed, recovering: ${String(err)}`, { runId: verifyStep.run_id });
    // Ensure loop step is at least pending so cron can retry
    await setStepStatus(loopStepId, "pending");
    return { advanced: false, runCompleted: false };
  }
}

// ── Auto-verify helper (shared by claim-auto-verify and handleVerifyEach) ──

const MAX_AUTO_VERIFY_ITERATIONS = 5;

/**
 * Auto-verify 'done' stories whose PRs are already merged/closed-with-ancestry.
 * Returns the first story that still needs agent verification, or null if all auto-verified.
 */
export async function autoVerifyDoneStories(
  runId: string,
  context: Record<string, string>,
  logPrefix: string,
  options?: { autoMergeOpen?: boolean },
): Promise<any | null> {
  let count = 0;
  while (true) {
    if (++count > MAX_AUTO_VERIFY_ITERATIONS) {
      logger.info(`[${logPrefix}] Hit MAX_AUTO_VERIFY (${MAX_AUTO_VERIFY_ITERATIONS}) — deferring remaining stories to next cycle`, { runId });
      return null; // Treat as "all done for now"
    }
    const story = await pgGet<any>("SELECT * FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY story_index ASC LIMIT 1", [runId]);
    if (!story) return null;

    // FIX: If this story has been stuck in verify for too many cycles, force auto-verify.
    // BUG FIX (2026-04-06): Old query was checking implement step's abandoned_count (always 0)
    // instead of verify step. Now reads verifyStep name from loop_config and queries directly.
    const loopStepRow = await pgGet<{ loop_config: string }>(
      "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND loop_config LIKE '%verifyEach%' LIMIT 1",
      [runId]
    );
    let verifyStepName = "verify";
    try { verifyStepName = JSON.parse(loopStepRow?.loop_config || "{}").verifyStep || "verify"; } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
    const verifyStep = await pgGet<{ abandoned_count: number }>(
      "SELECT abandoned_count FROM steps WHERE run_id = $1 AND step_id = $2 AND status IN ('running','pending','failed') LIMIT 1",
      [runId, verifyStepName]
    );
    const verifyStepAbandons = verifyStep?.abandoned_count ?? 0;
    // Force auto-verify ONLY if PR is already merged (no auto-merge — PR review is mandatory)
    if (verifyStepAbandons >= 3) {
      const prUrl = story.pr_url || "";
      if (prUrl) {
        const fvState = getPRState(prUrl);
        if (fvState === "MERGED") {
          if (context["repo"]) syncBaseBranch(context["repo"], "main");
          await verifyStory(story.id);
          logger.info(`[${logPrefix}] Story ${story.story_id} force-verified — PR already merged, verify abandoned ${verifyStepAbandons}x`, { runId });
          emitEvent({ ts: now(), event: "story.verified", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title, detail: `Force-verified — PR merged, verify abandoned ${verifyStepAbandons}x` });
          continue;
        }
        // PR not merged → agent must review comments, fix issues, then merge
        logger.info(`[${logPrefix}] Story ${story.story_id} PR still ${fvState} — needs agent review (no auto-merge)`, { runId });
      }
    }

    const prUrl = story.pr_url || "";
    if (!prUrl) return story; // No PR URL → needs agent verification

    try {
      const prState = getPRState(prUrl);

      if (prState === "MERGED") {
        // Advisory quality check — auto-verify regardless (downstream steps catch issues)
        const repoPath = context["repo"] || context["REPO"] || "";
        if (repoPath) syncBaseBranch(repoPath, "main");
        if (repoPath) {
          try {
            const issues = runQualityChecks(repoPath);
            const errors = issues.filter(i => i.severity === "error");
            if (errors.length > 0) {
              logger.warn(`[${logPrefix}-quality] PR merged — quality gate has ${errors.length} error(s) but auto-verifying anyway:\n${formatQualityReport(issues)}`, { runId });
            }
          } catch (qErr) {
            logger.warn(`[${logPrefix}] runQualityChecks threw: ${String(qErr)}`, { runId });
          }
        }
        await verifyStory(story.id);
        logger.info(`[${logPrefix}] Story ${story.story_id} auto-verified — PR merged`, { runId });
        emitEvent({ ts: now(), event: "story.verified", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title });
        continue;
      }

      if (prState === "CLOSED") {
        const repoPath = context["repo"] || "";
        const runIdPrefix = runId.slice(0, 8);
        const featureBranch = context["branch"] || context["BRANCH"] || "";
        const checkBranches = [featureBranch, "main", "master"].filter(Boolean);
        const resolution = resolveClosedPR(prUrl, story.story_id, runId, repoPath, runIdPrefix, checkBranches);
        if (resolution.alternativePrUrl) {
          await pgRun("UPDATE stories SET pr_url = $1, updated_at = $2 WHERE id = $3", [resolution.alternativePrUrl, now(), story.id]);
          logger.info(`[${logPrefix}] Found alternative PR for ${story.story_id}: ${resolution.alternativePrUrl}`, { runId });
          continue; // Re-check with updated PR
        } else if (resolution.contentInBaseBranch) {
          if (repoPath) syncBaseBranch(repoPath, "main");
          await verifyStory(story.id);
          logger.info(`[${logPrefix}] Story ${story.story_id} auto-verified — CLOSED PR content in base branch`, { runId });
          emitEvent({ ts: now(), event: "story.verified", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title, detail: "Auto-verified — CLOSED PR content in base branch" });
          continue;
        } else if (!resolution.reopened) {
          await pgRun("UPDATE stories SET status = 'failed', output = 'Failed: CLOSED PR could not be reopened, content not found in base branch', updated_at = $1 WHERE id = $2", [now(), story.id]);
          logger.warn(`[${logPrefix}] CLOSED PR ${prUrl} — content NOT in base branch — failing story ${story.story_id}`, { runId });
          emitEvent({ ts: now(), event: "story.failed", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title, detail: "CLOSED PR content not in base branch" });
          continue;
        }
        // reopened=true → fall through to agent verification
        return story;
      }

      if (prState === "OPEN") {
        // OPEN PR = needs agent review. Agent must read Gemini+Copilot comments,
        // fix issues, then merge. No auto-merge — review is mandatory.
        return story;
      }
    } catch (e) {
      logger.warn(`[${logPrefix}] PR state check failed for ${prUrl}: ${String(e)}`, { runId });
    }

    return story; // Needs agent verification
  }
}
