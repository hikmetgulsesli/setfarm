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
} from "./constants.js";
import { getPRState, tryReopenPR, tryAutoMergePR, findPrByBranch, resolveClosedPR } from "./pr-state.js";
import { failStep } from "./step-fail.js";
import { advancePipeline, checkLoopContinuation } from "./step-advance.js";

// ── Re-exports from extracted modules (backwards compat for cli.ts, medic.ts) ──
export { resolveTemplate, parseOutputKeyValues } from "./context-ops.js";
export { getStories, getCurrentStory } from "./story-ops.js";
export { computeHasFrontendChanges } from "./step-guardrails.js";
export { archiveRunProgress } from "./cleanup-ops.js";
export { failStep } from "./step-fail.js";

// ── Imports from extracted modules (used internally) ──
import { resolveTemplate, parseOutputKeyValues, readProgressFile, readProjectMemory, updateProjectMemory, getProjectTree, getInstalledPackages, getSharedCode, getRecentStoryCode, getComponentRegistry, getApiRoutes } from "./context-ops.js";
import { getStories, formatStoryForTemplate, formatCompletedStories, parseAndInsertStories } from "./story-ops.js";
import { createStoryWorktree, removeStoryWorktree } from "./worktree-ops.js";
import { computeHasFrontendChanges, checkTestFailures, checkQualityGate, processDesignCompletion, processSetupCompletion, processSetupDesignContracts, processBrowserCheck, processDesignFidelityCheck, checkStoryDesignCompliance } from "./step-guardrails.js";
import { cleanupAbandonedSteps as _cleanupAbandonedSteps, scheduleRunCronTeardown } from "./cleanup-ops.js";
import {
  getRunStatus, getRunContext, updateRunContext, failRun,
  getWorkflowId as _getWorkflowId,
  verifyStory, skipFailedStories, countAllStories, countStoriesByStatus,
  findStoryByStatus, getStoryInfo,
  setStepStatus, failStepWithOutput,
  findLoopStep, findActiveLoop,
} from "./repo.js";

/**
 * Wrapper: calls cleanup-ops.cleanupAbandonedSteps with advancePipeline callback.
 * Maintains the original zero-arg signature for backwards compatibility.
 */
export function cleanupAbandonedSteps(): void {
  _cleanupAbandonedSteps(advancePipeline);
}

async function getWorkflowId(runId: string): Promise<string | undefined> {
  return await _getWorkflowId(runId);
}

// ── Peek (lightweight work check) ───────────────────────────────────

export type PeekResult = "HAS_WORK" | "NO_WORK";

/**
 * Lightweight check: does this agent have any pending/waiting steps in active runs?
 * Unlike claimStep(), this runs a single cheap COUNT query — no cleanup, no context resolution.
 * Returns "HAS_WORK" if any pending/waiting steps exist, "NO_WORK" otherwise.
 */
export async function peekStep(agentId: string): Promise<PeekResult> {
    // OUTPUT RECOVERY at peek time: if a previous session wrote output but died before
    // completing, recover it now. This prevents the "peek→NO_WORK→loop forever" problem
    // where claimStep's recovery never runs because peek returns NO_WORK first.
    // Scans ALL output files in /tmp — each parallel agent writes to its own file
    // (e.g. setfarm-output-koda.txt, setfarm-output-flux.txt)
    try {
      const tmpFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('setfarm-output-') && f.endsWith('.txt'));
      for (const fileName of tmpFiles) {
        const filePath = `/tmp/${fileName}`;
        try {
          const output = fs.readFileSync(filePath, 'utf-8').trim();
          if (!output.includes('STATUS:')) continue;
          // Find any running step for this agent role that could match
          const runningStep = await pgGet<{ id: string; step_id: string; run_id: string }>(
            `SELECT s.id, s.step_id, s.run_id FROM steps s JOIN runs r ON r.id = s.run_id
             WHERE s.agent_id = $1 AND s.status = 'running' AND r.status = 'running'
             LIMIT 1`, [agentId]
          );
          if (runningStep) {
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
        } catch { /* single file read failed, continue */ }
      }
    } catch (e) { /* non-fatal — /tmp read failed */ }

    const row = await pgGet<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.agent_id = $1 AND r.status = 'running'
         AND (
           s.status = 'pending'
           OR (s.status = 'running' AND s.type = 'loop'
               AND (EXISTS (SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'pending')
                    OR EXISTS (SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'done')))
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
};

// ── Extracted helpers (private, called only from claimStep) ──────────

/**
 * Auto-complete design step with existing HTML files.
 * Shared by .stitch dedup and PRD Generator cache path.
 */
async function autoCompleteDesignStep(step: StepRow, db: any, htmlFiles: string[], projectId: string): Promise<boolean> {
  const dRepoPath = (await getRunContext(step.run_id))["repo"] || "";
  const dScreenMap = htmlFiles.map((f: string) => ({
    screenId: f.replace(".html", ""),
    name: f.replace(".html", ""),
    type: "page",
    description: f.replace(".html", ""),
  }));
  const dCtx = await getRunContext(step.run_id);
  dCtx["stitch_project_id"] = projectId;
  dCtx["screens_generated"] = String(htmlFiles.length);
  dCtx["screen_map"] = JSON.stringify(dScreenMap);
  dCtx["device_type"] = dCtx["device_type"] || "DESKTOP";
  dCtx["design_system"] = dCtx["design_system"] || "reused from existing designs";
  dCtx["design_notes"] = `Reused ${htmlFiles.length} existing screen designs`;
  await updateRunContext(step.run_id, dCtx);
  const dOutput = `STATUS: done\nSTITCH_PROJECT_ID: ${projectId}\nSCREENS_GENERATED: ${htmlFiles.length}\nDESIGN_NOTES: Reused ${htmlFiles.length} screens (auto-skip)`;
  await pgRun("UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3", [dOutput, now(), step.id]);
  logger.info(`[design-dedup] Auto-skipped design — reusing ${htmlFiles.length} screens (project ${projectId})`, { runId: step.run_id });
  advancePipeline(step.run_id);
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
        try { fs.unlinkSync(dStitchFile); } catch {}
        try { fs.rmSync(dStitchDir, { recursive: true, force: true }); } catch {}
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
      } catch {}
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
    } catch {}
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
    const storyBranchForCheck = rs.story_branch || `${runIdPrefix}-${rs.story_id}`;
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

      if (prFound && prUrl) {
          await pgRun("UPDATE stories SET status = 'done', pr_url = $1, story_branch = $2, updated_at = $3 WHERE id = $4", [prUrl, storyBranchForCheck, now(), rs.id]);
          await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2 AND current_story_id = $3", [now(), step.id, rs.id]);
        logger.info(`[claim-auto-complete] Story ${rs.story_id} auto-completed — PR exists: ${prUrl}`, { runId: step.run_id });
        emitEvent({ ts: now(), event: "story.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: rs.story_id, storyTitle: rs.title, detail: `Auto-completed — PR exists (${prUrl})` });
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

  // FIX: Clear stale story-specific context from previous story to prevent cross-contamination
  context["pr_url"] = "";
  context["story_branch"] = "";
  context["verify_feedback"] = "";

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
          // Truncate if too large (max 15K chars per screen, ~4K tokens)
          const truncated = html.length > 15000 ? html.slice(0, 15000) + "\n<!-- ...truncated -->" : html;
          stitchHtmlContent += `\n<!-- STITCH SCREEN: ${screen.name || screen.screenId} -->\n${truncated}\n`;
        }
      }
      if (stitchHtmlContent) {
        context["stitch_html"] = stitchHtmlContent;
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
        context["design_dom"] = domJson.length > 8000 ? domJson.substring(0, 8000) + "...(truncated)" : domJson;
      }
    }
  } catch {}

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

  // Default optional template vars to prevent MISSING_INPUT_GUARD false positives (story-each flow)
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }

  // Persist story context vars to DB so verify_each steps can access them
  await updateRunContext(step.run_id, context);

  // v1.5.50: Inject previous_failure from prior abandon output
  if (nextStory.output && (nextStory.abandoned_count > 0 || nextStory.retry_count > 0)) {
    context["previous_failure"] = nextStory.output;
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
    try { checkLoopContinuation(step.run_id, loopStepForVerify.id); } catch (e) { logger.error("[claim-auto-verify] checkLoopContinuation failed: " + String(e), { runId: step.run_id }); }
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
  // Item 6: Single step — atomic claim with changes check to prevent race condition
  let _claimChanges: number;
  const _cr = await pgRun("UPDATE steps SET status = 'running', updated_at = $1 WHERE id = $2 AND status = 'pending'", [now(), step.id]);
  _claimChanges = _cr.changes;
  if (_claimChanges === 0) {
    // Already claimed by another cron — return no work
    return { found: false };
  }
  emitEvent({ ts: now(), event: "step.running", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
  logger.info(`Step claimed by ${agentId}`, { runId: step.run_id, stepId: step.step_id });

  // v1.5.50: Record single step claim in claim_log
  try {
    await pgRun("INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, $2, NULL, $3, $4)", [step.run_id, step.step_id, agentId, now()]);
  } catch (e) { logger.warn(`[claim-log] Failed to record claim: ${String(e)}`, { runId: step.run_id }); }

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

  // BUG FIX: If this is a verify step for a verify_each loop, inject the correct
  // story info from the oldest unverified 'done' story (not from stale context).
  if (!await injectVerifyContext(step, context, db)) {
    return { found: false };
  }

  // ═══ DESIGN PRE-CLAIM: Auto-generate Stitch screens from PRD ═══
  if (step.step_id === "design") {
    const dRepo = context["repo"] || context["REPO"] || "";
    const dPrd = context["prd"] || context["PRD"] || "";
    const dStitchDir = dRepo ? path.join(dRepo, "stitch") : "";
    const existingHtml = dStitchDir && fs.existsSync(dStitchDir)
      ? fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html")).length : 0;

    if (dRepo && dPrd && existingHtml === 0) {
      const stitchScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/stitch-api.mjs");
      fs.mkdirSync(dStitchDir, { recursive: true });

      // 1. Ensure Stitch project
      let projId = "";
      try {
        const dotStitch = path.join(dRepo, ".stitch");
        if (fs.existsSync(dotStitch)) projId = JSON.parse(fs.readFileSync(dotStitch, "utf-8")).projectId || "";
      } catch {}
      if (!projId) {
        try {
          const ensureOut = execFileSync("node", [stitchScript, "ensure-project", path.basename(dRepo), dRepo],
            { encoding: "utf-8", timeout: 30000, cwd: dRepo });
          try { projId = JSON.parse(ensureOut).projectId || ""; } catch {}
        } catch (e) { logger.warn(`[design-preclaim] ensure-project failed: ${e}`, { runId: step.run_id }); }
      }

      if (projId) {
        context["stitch_project_id"] = projId;
        // 2. Write PRD as Stitch prompt
        const promptFile = path.join(dStitchDir, ".generate-prompt.txt");
        const deviceType = context["device_type"] || "DESKTOP";
        fs.writeFileSync(promptFile, dPrd + "\n\nGenerate all screens described in this PRD as separate screen designs. All visible text must be in Turkish. Use a dark, modern theme.");
        logger.info(`[design-preclaim] Generating screens from PRD via generate-all-screens (project: ${projId})`, { runId: step.run_id });

        // 3. generate-all-screens
        try {
          const genOut = execFileSync("node", [stitchScript, "generate-all-screens", projId, promptFile, deviceType, "GEMINI_3_1_PRO"],
            { encoding: "utf-8", timeout: 600000, cwd: dRepo });
          let genResult: any = {};
          try { genResult = JSON.parse(genOut); } catch {}
          logger.info(`[design-preclaim] Generated ${genResult.total || 0} screens in ${genResult.elapsedSeconds || "?"}s`, { runId: step.run_id });
        } catch (e) { logger.warn(`[design-preclaim] generate-all-screens failed: ${e}`, { runId: step.run_id }); }

        // 4. download-all
        try {
          const dlOut = execFileSync("node", [stitchScript, "download-all", projId, dStitchDir],
            { encoding: "utf-8", timeout: 180000, cwd: dRepo });
          let dlResult: any = {};
          try { dlResult = JSON.parse(dlOut); } catch {}
          logger.info(`[design-preclaim] Downloaded ${dlResult.downloaded || 0}/${dlResult.total || 0} screens`, { runId: step.run_id });
          context["screens_generated"] = String(dlResult.downloaded || 0);
        } catch (e) { logger.warn(`[design-preclaim] download-all failed: ${e}`, { runId: step.run_id }); }

        // 5. Generate DESIGN_DOM.json
        try {
          const domScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/design-dom-extract.mjs");
          if (fs.existsSync(domScript)) {
            execFileSync("node", [domScript, dStitchDir], { encoding: "utf-8", timeout: 30000 });
          }
        } catch {}

        await updateRunContext(step.run_id, context);
      }
    }
  }

  let resolvedInput = resolveTemplate(step.input_template, context);

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
      // Second occurrence — fail run
      await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [reason + " — failing run (retry exhausted)", now(), step.id]);
      await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), step.run_id]);
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
export async function claimStep(agentId: string): Promise<ClaimResult> {
  // Throttle cleanup: run at most once every 5 minutes across all agents
  const epochMs = Date.now();
  if (epochMs - lastCleanupTime >= CLEANUP_THROTTLE_MS) {
    cleanupAbandonedSteps();
    lastCleanupTime = epochMs;
  }

  // OUTPUT RECOVERY: If a previous agent session died after writing output but before completing,
  // recover the output. Scans all setfarm-output-*.txt files (each parallel agent has its own).
  try {
    const tmpFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('setfarm-output-') && f.endsWith('.txt'));
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
      } catch { /* single file failed */ }
    }
  } catch (e) { logger.warn(`[output-recovery] Check failed: ${String(e)}`, {}); }

  // Allow claiming from both pending AND running loop steps (parallel story execution)
  const step = await pgGet<{ id: string; step_id: string; run_id: string; input_template: string; type: string; loop_config: string | null; step_status: string }>(
        `SELECT s.id, s.step_id, s.run_id, s.input_template, s.type, s.loop_config, s.status as step_status
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         WHERE s.agent_id = $1
           AND (s.status = 'pending' OR (s.status = 'running' AND s.type = 'loop'))
           AND r.status NOT IN ('failed', 'cancelled')
           AND NOT EXISTS (
             SELECT 1 FROM steps prev
             WHERE prev.run_id = s.run_id
               AND prev.step_index < s.step_index
               AND prev.status NOT IN ('done', 'failed', 'skipped', 'verified')
               AND NOT (prev.type = 'loop' AND prev.status = 'running')
           )
         ORDER BY s.step_index ASC, s.status ASC
         LIMIT 1`, [agentId]);

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
    const loopConfig: LoopConfig | null = step.loop_config ? JSON.parse(step.loop_config) : null;
    if (loopConfig?.over === "stories") {
      // Auto-complete stories that already have a PR (open or merged)
      const runIdPrefix = step.run_id.slice(0, 8);
      await autoCompleteStoriesWithPRs(step, runIdPrefix, context, null);

      // Story selection + claim must be atomic to prevent
      // two parallel crons from selecting the same story (race condition fix #4)
      let _txOpen = true;
      const _rollbackEarly = () => {
        if (_txOpen) {
          _txOpen = false;
        }
      };

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
        _rollbackEarly();
        const failedStory = await findStoryByStatus(step.run_id, "failed") as { id: string } | undefined;

        if (failedStory) {
          // v9.0: Skip failed stories instead of failing the loop
          await skipFailedStories(step.run_id);
          const wfId = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "story.skipped", runId: step.run_id, workflowId: wfId, stepId: step.id, agentId: agentId, detail: "Failed stories skipped — loop continues" });
        }

        // Check if other stories are still running in parallel
        const runningStory = await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = 'running'", [step.run_id]);
        if (runningStory) {
          _rollbackEarly(); return { found: false }; // Other stories still running, wait for them
        }

        // DEPENDENCY DEADLOCK GUARD: pending stories exist but all blocked by deps — FAIL RUN (v1.5.53)
        if (pendingStories.length > 0 && !failedStory) {
          const deadlockMsg = `Dependency deadlock: ${pendingStories.length} pending stories all blocked by unmet dependencies — failing run`;
          logger.error(deadlockMsg, { runId: step.run_id });
          for (const blocked of pendingStories) {
            await pgRun("UPDATE stories SET status = 'failed', output = 'Failed: dependency deadlock', updated_at = $1 WHERE id = $2", [now(), blocked.id]);
          }
          await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [deadlockMsg, now(), step.id]);
          await failRun(step.run_id);
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
          await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), step.run_id]);
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
        advancePipeline(step.run_id);
        return { found: false };
      }

      // PARALLEL LIMIT: Don't exceed max concurrent running stories
      const runningStoryCount = { cnt: await countStoriesByStatus(step.run_id, "running") };
      const parallelLimit = loopConfig?.parallelCount ?? 3;
      if (runningStoryCount.cnt >= parallelLimit) {
        _rollbackEarly(); return { found: false }; // At capacity, wait for running stories to finish
      }

      // Claim the story with optimistic lock — only succeeds if still pending (prevents double-claim)
      const storyBranch = nextStory.story_id.toLowerCase();
      const claimResult = await pgGet<{ id: string }>("UPDATE stories SET status = 'running', updated_at = $1 WHERE id = $2 AND status = 'pending' RETURNING id", [now(), nextStory.id]);
      if (!claimResult) {
        // Another agent claimed this story between SELECT and UPDATE — retry next cycle
        logger.info(`[claim] Story ${nextStory.story_id} already claimed by another agent — skipping`, { runId: step.run_id });
        _rollbackEarly(); return { found: false };
      }
      await pgRun("UPDATE steps SET status = 'running', current_story_id = \$1, updated_at = \$2 WHERE id = \$3", [nextStory.id, now(), step.id]);
      _txOpen = false;

      // GIT WORKTREE ISOLATION: Create OUTSIDE transaction to avoid holding DB
      // lock during slow git operations.
      let storyWorkdir = "";
      if (context["repo"]) {
        storyWorkdir = createStoryWorktree(context["repo"], storyBranch, context["branch"] || "master", agentId);
      }
      if (!storyWorkdir && context["repo"]) {
        // Worktree creation failed — revert story claim
        const wtReason = `Worktree creation failed for story ${nextStory.story_id} — cannot isolate parallel work`;
        logger.error(wtReason, { runId: step.run_id, stepId: step.step_id });
        await pgRun("UPDATE stories SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), nextStory.id]);
        await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), step.id]);
        emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextStory.story_id, storyTitle: nextStory.title, detail: wtReason });
        return { found: false };
      }
      context["story_workdir"] = storyWorkdir || context["repo"] || "";

      // v1.5.50: Record claim in claim_log + update story claim metadata
      const claimNow = now();
      try {
        await pgRun("INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, $2, $3, $4, $5)", [step.run_id, step.step_id, nextStory.story_id, agentId, claimNow]);
        await pgRun("UPDATE stories SET claimed_at = $1, claimed_by = $2 WHERE id = $3", [claimNow, agentId, nextStory.id]);
      } catch (e) { logger.warn(`[claim-log] Failed to record claim: ${String(e)}`, { runId: step.run_id }); }

      const wfId = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.running", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId });
      emitEvent({ ts: now(), event: "story.started", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, storyId: nextStory.story_id, storyTitle: nextStory.title });
      logger.info(`Story started: ${nextStory.story_id} — ${nextStory.title}`, { runId: step.run_id, stepId: step.step_id });

      // Inject story context (template vars, screen_map, optional vars, previous_failure)
      await injectStoryContext(nextStory, step, context);

      let resolvedInput = resolveTemplate(step.input_template, context);

      // Item 7: MISSING_INPUT_GUARD inside claim flow (v1.5.53: retry once before failing run)
      const allMissing = [...new Set([...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase()))];
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input`;
        const storyRetry = await pgGet<{ retry_count: number }>("SELECT retry_count FROM stories WHERE id = $1", [nextStory.id]);
        const retryCount = storyRetry?.retry_count ?? 0;
        logger.warn(`${reason} (story=${nextStory.story_id}, retry=${retryCount})`, { runId: step.run_id, stepId: step.step_id });
        // Reset the claimed story
        if (retryCount > 0) {
          // Second occurrence — fail everything
          await pgRun("UPDATE stories SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), nextStory.id]);
          await pgRun("UPDATE steps SET status = 'failed', output = $1, current_story_id = NULL, updated_at = $2 WHERE id = $3", [reason + " — failing run (retry exhausted)", now(), step.id]);
          await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), step.run_id]);
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
          logger.info(`[missing-input] Story ${nextStory.story_id} will retry — possible WAL lag`, { runId: step.run_id });
        }
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

  // Guard: don't process completions for failed runs
  if (await getRunStatus(step.run_id) === RUN_STATUS.FAILED) {
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

  // Expand tilde in repo path (Node.js fs does not expand ~)
  if (context["repo"]?.startsWith("~/")) {
    context["repo"] = context["repo"].replace(/^~\//, os.homedir() + "/");
  }
  if (context["story_workdir"]?.startsWith("~/")) {
    context["story_workdir"] = context["story_workdir"].replace(/^~\//, os.homedir() + "/");
  }

  // FIX 1: Explicit fail interceptor — agent reported STATUS: fail/error
  const statusVal = parsed["status"]?.toLowerCase();
  if (statusVal === "fail" || statusVal === "failed" || statusVal === "error") {
    logger.warn(`Agent reported STATUS: ${parsed["status"]} — failing step`, { runId: step.run_id, stepId: step.step_id });
    await failStep(stepId, `Agent reported failure: ${parsed["status"]}. Output: ${output.slice(0, 500)}`);
    return { advanced: false, runCompleted: false };
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

  // PLAN STEP PRD GUARDRAIL (v1.5.53): Plan must output a meaningful PRD
  if (step.step_id === "plan") {
    // Auto-resolve prd from prd_path if inline prd is missing
    let prdVal = (parsed["prd"] || context["prd"] || "").trim();
    if (prdVal.length < 100 && context["prd_path"]) {
      try {
        const prdContent = fs.readFileSync(context["prd_path"], "utf-8").trim();
        if (prdContent.length >= 100) {
          prdVal = prdContent;
          context["prd"] = prdContent;
          parsed["prd"] = prdContent;
        }
      } catch {}
    }
    if (prdVal.length < 100) {
      const prdErr = `GUARDRAIL: Plan step completed but PRD is ${prdVal.length < 1 ? "empty" : "too short (" + prdVal.length + " chars)"}. Plan must output a meaningful PRD.`;
      logger.warn(`[plan-guardrail] ${prdErr}`, { runId: step.run_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, prdErr);
      return { advanced: false, runCompleted: false };
    }

    // PRD_SCREEN_COUNT guardrail: minimum 3 screens
    const screenCount = parseInt(parsed["prd_screen_count"] || context["prd_screen_count"] || "0", 10);
    if (screenCount > 0 && screenCount < 3) {
      const scErr = `GUARDRAIL: PRD has only ${screenCount} screen(s). Minimum is 3 (main view + error state + empty/alternate state). Add missing screens to PRD Ekranlar table and update PRD_SCREEN_COUNT.`;
      logger.warn(`[plan-guardrail] ${scErr}`, { runId: step.run_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, scErr);
      return { advanced: false, runCompleted: false };
    }

    // REPO path guardrail: must be under $HOME/projects/
    const repoVal = (parsed["repo"] || context["repo"] || "").trim();
    const projectsDir = path.join(os.homedir(), "projects");
    if (repoVal && !repoVal.startsWith(projectsDir)) {
      // Auto-fix: extract last segment and put under $HOME/projects/
      const slug = repoVal.split("/").filter(Boolean).pop() || "project";
      const fixedRepo = path.join(projectsDir, slug);
      parsed["repo"] = fixedRepo;
      context["repo"] = fixedRepo;
      logger.warn(`[plan-guardrail] REPO auto-fixed: ${repoVal} → ${fixedRepo}`, { runId: step.run_id });
    }
  }

  // REPO DEDUP GUARDRAIL (plan step) — if repo dir has existing code, auto-suffix or reset
  if (step.step_id === "plan" && parsed["status"]?.toLowerCase() === "done") {
    const repoPath = context["repo"] || context["REPO"] || "";
    if (repoPath) {
      try {
        
        
        if (fs.existsSync(path.join(repoPath, ".git"))) {
          let commitCount = 0;
          try {
            const out = execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: repoPath, timeout: 5000 }).toString().trim();
            commitCount = parseInt(out, 10) || 0;
          } catch (gitErr: any) { logger.debug("git rev-list failed: " + (gitErr?.message || "")); }
          if (commitCount > 2) {
            const priorRun = await pgGet<{ id: string }>("SELECT id FROM runs WHERE status IN ('completed','cancelled','failed') AND context LIKE $1 AND id != $2 LIMIT 1", [`%${repoPath}%`, step.run_id]);
            // Clean in-place: same directory, fresh start (no suffix — keeps resume working)
            {
              // Backup stitch before git reset
              const _stitchDir = path.join(repoPath, "stitch");
              const _stitchFile = path.join(repoPath, ".stitch");
              const _bkDir = path.join(repoPath, "..", ".stitch-bk-" + Date.now());
              const _hasStitch = fs.existsSync(_stitchDir) || fs.existsSync(_stitchFile);
              if (_hasStitch) {
                fs.mkdirSync(_bkDir, { recursive: true });
                fs.cpSync(_stitchDir, path.join(_bkDir, "stitch"), { recursive: true });
                fs.copyFileSync(_stitchFile, path.join(_bkDir, ".stitch"));
              }
              execFileSync("git", ["checkout", "--orphan", "__fresh__"], { cwd: repoPath, timeout: 5000 });
              execFileSync("git", ["rm", "-rf", "."], { cwd: repoPath, timeout: 5000 });
              execFileSync("git", ["clean", "-fd"], { cwd: repoPath, timeout: 5000 });
              // Restore stitch after git reset
              if (_hasStitch) {
                try { fs.cpSync(path.join(_bkDir, "stitch"), _stitchDir, { recursive: true }); } catch {}
                try { fs.copyFileSync(path.join(_bkDir, ".stitch"), _stitchFile); } catch {}
                fs.rmSync(_bkDir, { recursive: true, force: true });
              }
              fs.writeFileSync(path.join(repoPath, "README.md"), "# Project\n");
              execFileSync("git", ["add", "."], { cwd: repoPath, timeout: 5000 });
              execFileSync("git", ["commit", "-m", "initial"], { cwd: repoPath, timeout: 5000 });
              try { execFileSync("git", ["branch", "-D", "main"], { cwd: repoPath, timeout: 5000 }); } catch (e) { logger.warn(`[repo-dedup] branch -D main failed (expected if not exists): ${String(e)}`, {}); }
              execFileSync("git", ["branch", "-m", "main"], { cwd: repoPath, timeout: 5000 });
              logger.info(`[repo-dedup] Reset existing repo ${repoPath} (${commitCount} commits, no prior completed run)`, { runId: step.run_id });
            }
          }
        }
      } catch (e: any) {
        logger.warn(`[repo-dedup] Error: ${e.message}`, { runId: step.run_id });
      }
    }
  }

  // TEST FAILURE GUARDRAIL — soft retry with fix instructions instead of hard fail
  if (parsed["status"]?.toLowerCase() === "done") {
    const testFailMsg = checkTestFailures(output);
    if (testFailMsg && step.retry_count < step.max_retries) {
      logger.warn(`Test guardrail triggered — soft retry with fix instructions`, { runId: step.run_id, stepId: step.step_id });
      // Inject failure details as previous_failure so agent knows what to fix
      context["previous_failure"] = `TEST GUARDRAIL: ${testFailMsg}`;
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
      context["previous_failure"] = `QUALITY GATE: ${qgMsg}`;
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

  // Design Contract + Rules (design step)
  if (step.step_id === "design" && parsed["status"]?.toLowerCase() === "done") {
    const designErr = await processDesignCompletion(step.run_id, context);
    if (designErr) {
      logger.warn(`[design-guardrail] Failed`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, designErr);
      return { advanced: false, runCompleted: false };
    }

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
        try { ensureResult = JSON.parse(ensureOut); } catch {}
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
      // ALWAYS auto-generate — clear partial screens and regenerate from PRD
      if (fs.existsSync(dStitchDir)) {
        for (const f of fs.readdirSync(dStitchDir)) {
          if (f.endsWith(".html") || f.endsWith(".png")) {
            try { fs.unlinkSync(path.join(dStitchDir, f)); } catch {}
          }
        }
      }
      {
        // Screens already generated in pre-claim. Just verify they exist.
        const stitchScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/stitch-api.mjs");
        let screenMapArr: any[] = [];
        try { screenMapArr = JSON.parse(dScreenMap); } catch {}
        if (screenMapArr.length > 0) {
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
            try { genResult = JSON.parse(genOut); } catch {}
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
          try { dlResult = JSON.parse(dlOut); } catch {}
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
          if (fs.existsSync(staleStitch)) { try { fs.unlinkSync(staleStitch); } catch {} }
          await failStep(stepId, failMsg);
          return { advanced: false, runCompleted: false };
        }
      }
    }
  }

  // DB Auto-Provisioning (setup step)
  if (step.step_id === "setup-repo" && parsed["status"]?.toLowerCase() === "done") {
    // Ensure plan's BRANCH exists in repo (create from main if missing)
    const planBranch = context["branch"] || context["BRANCH"];
    const repoDir = context["repo"] || context["REPO"];
    if (planBranch && repoDir && planBranch !== "main" && planBranch !== "master") {
      try {
        const branchList = execFileSync("git", ["branch", "--list", planBranch], { cwd: repoDir, encoding: "utf-8", timeout: 5000 }).trim();
        if (!branchList) {
          execFileSync("git", ["checkout", "-b", planBranch], { cwd: repoDir, timeout: 5000 });
          execFileSync("git", ["checkout", "main"], { cwd: repoDir, timeout: 5000 });
          logger.info(`[setup-repo] Created missing branch "${planBranch}" from main`, { runId: step.run_id });
        }
      } catch (e) {
        logger.warn(`[setup-repo] Could not create branch "${planBranch}", falling back to main: ${e}`, { runId: step.run_id });
        context["branch"] = "main";
        await updateRunContext(step.run_id, context);
      }
    }
    const dbErr = processSetupCompletion(context, step.run_id);
    if (dbErr) {
      await failStep(stepId, dbErr);
      return { advanced: false, runCompleted: false };
    }
  }

  // Design Contract Building (setup step — after HTML download)
  if (step.step_id === "setup-repo" && parsed["status"]?.toLowerCase() === "done") {
    const designErr = await processSetupDesignContracts(step.run_id, context);
    if (designErr) {
      await failStep(stepId, designErr);
      return { advanced: false, runCompleted: false };
    }
  }

  // SETUP-BUILD BRANCH FALLBACK: if plan's branch doesn't exist, use main
  if (step.step_id === "setup-build") {
    const buildBranch = context["branch"] || context["BRANCH"];
    const buildRepo = context["repo"] || context["REPO"];
    if (buildBranch && buildRepo && buildBranch !== "main" && buildBranch !== "master") {
      try {
        const exists = execFileSync("git", ["branch", "--list", buildBranch], { cwd: buildRepo, encoding: "utf-8", timeout: 5000 }).trim();
        if (!exists) {
          logger.warn(`[setup-build] Branch "${buildBranch}" not found, falling back to main`, { runId: step.run_id });
          context["branch"] = "main";
          await updateRunContext(step.run_id, context);
        }
      } catch {}
    }
  }

  // SETUP-BUILD BASELINE GUARDRAIL (v1.5.53): Also reject empty baseline
  if (step.step_id === "setup-build" && parsed["status"]?.toLowerCase() === "done") {
    const baseline = (parsed["baseline"] || "").toLowerCase().trim();
    if (!baseline || !["pass", "ok"].includes(baseline.toLowerCase())) {
      const baselineMsg = `GUARDRAIL: setup-build baseline is "${parsed["baseline"] || "(empty)"}" — build must explicitly pass.`;
      logger.warn(`[setup-build-guardrail] ${baselineMsg}`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, baselineMsg);
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

  // SMOKE TEST GUARDRAIL (final-test): If agent skipped smoke test, retry
  if (step.step_id === "final-test" && parsed["status"]?.toLowerCase() === "done") {
    const smokeResult = parsed["smoke_test_result"] || "";
    if (!smokeResult) {
      logger.warn(`[final-test-guardrail] SMOKE_TEST_RESULT missing from final-test output — agent likely skipped smoke test. Retrying.`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, "GUARDRAIL: final-test completed without SMOKE_TEST_RESULT. You MUST run smoke-test.mjs and include SMOKE_TEST_RESULT in your output.");
      return { advanced: false, runCompleted: false };
    }
  }

  await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);

  // T5: Parse STORIES_JSON from output (any step, typically the planner)
  await parseAndInsertStories(output, step.run_id);

  // STORIES STEP EARLY GUARD (v1.5.53): Catch 0 stories immediately instead of wasting setup time
  if (step.step_id === "stories" && parsed["status"]?.toLowerCase() === "done") {
    const storyCount = await countAllStories(step.run_id);
    if (storyCount === 0) {
      const noStoriesMsg = "GUARDRAIL: Stories step completed with STATUS: done but produced 0 stories — STORIES_JSON missing or empty";
      logger.warn(`[stories-guardrail] ${noStoriesMsg}`, { runId: step.run_id });
      if (prevContextJson) { await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [prevContextJson.context, step.run_id]); }
      await failStep(stepId, noStoriesMsg);
      return { advanced: false, runCompleted: false };
    }
  }

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
        await failRun(step.run_id);
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
    // Look up story info for event
    const storyRow = await getStoryInfo(step.current_story_id);

    // v9.0: Check agent STATUS — skip, fail/error (defense-in-depth), or done
    const statusVal = parsed["status"]?.toLowerCase();
    let storyStatus: string, storyEvent: string;
    if (statusVal === "fail" || statusVal === "failed" || statusVal === "error") {
      storyStatus = STORY_STATUS.FAILED; storyEvent = "story.failed";
    } else if (statusVal === "skip") {
      storyStatus = STORY_STATUS.SKIPPED; storyEvent = "story.skipped";
    } else {
      storyStatus = STORY_STATUS.DONE; storyEvent = "story.done";
    }

    // Design compliance check — only for implement step, done stories
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE) {
      const designIssue = checkStoryDesignCompliance(context);
      if (designIssue && step.retry_count < step.max_retries) {
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} failed design check — soft retry`, { runId: step.run_id });
        context["previous_failure"] = `DESIGN COMPLIANCE: ${designIssue}`;
        await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);
        await failStep(stepId, designIssue);
        return { advanced: false, runCompleted: false };
      } else if (designIssue) {
        // Max retries — log warning but let story pass (advisory)
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} design issues (max retries reached, advisory): ${designIssue}`, { runId: step.run_id });
      }
    }

    // Mark current story done or skipped + persist PR context for verify_each
    // FIX: Remove context fallback to prevent cross-contamination between parallel stories
    const storyPrUrl = parsed["pr_url"] || "";
    const storyBranchName = parsed["story_branch"] || "";
    await pgRun("UPDATE stories SET status = $1, output = $2, pr_url = $3, story_branch = $4, updated_at = $5 WHERE id = $6", [storyStatus, output, storyPrUrl, storyBranchName, now(), step.current_story_id]);
    emitEvent({ ts: now(), event: storyEvent as import("./events.js").EventType, runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title });
    logger.info(`Story ${storyStatus}: ${storyRow?.story_id} — ${storyRow?.title}`, { runId: step.run_id, stepId: step.step_id });

    // v1.5.50: Resolve claim_log outcome
    try {
      await pgRun("UPDATE claim_log SET outcome = 'completed', duration_ms = EXTRACT(EPOCH FROM NOW() - claimed_at::timestamptz) * 1000 WHERE story_id = $1 AND outcome IS NULL", [storyRow?.story_id || ""]);
    } catch (e) { logger.warn(`[claim-log] Failed to resolve completion: ${String(e)}`, { runId: step.run_id }); }

    // B2: Record step_metrics for SLA tracking
    try {
      await pgRun("INSERT INTO step_metrics (run_id, step_name, agent_id, claimed_at, completed_at, duration_ms, outcome, created_at) VALUES ($1, $2, $3, $4, NOW(), EXTRACT(EPOCH FROM NOW() - $5::timestamptz) * 1000, 'completed', NOW())", [step.run_id, step.step_id, step.agent_id || "", now(), now()]);
    } catch (e) { logger.warn(`[step-metrics] insert failed: ${String(e)}`, { runId: step.run_id }); }



    // Update PROJECT_MEMORY.md with completed story info
    if (storyRow && storyStatus !== STORY_STATUS.SKIPPED) {
      await updateProjectMemory(context, storyRow.story_id, storyRow.title, storyStatus, output);
    }
    // Clean up: remove worktree (auto-saves uncommitted changes before removal)
    if (storyRow?.story_id && context["repo"]) {
      removeStoryWorktree(context["repo"], storyRow.story_id, step.agent_id);
    }

    // FIX: Clear story-specific context to prevent cross-contamination between parallel stories
    delete context["pr_url"];
    delete context["story_branch"];
    delete context["current_story_id"];
    delete context["current_story_title"];
    delete context["current_story"];
    delete context["verify_feedback"];
    await updateRunContext(step.run_id, context);

    // Clear current_story_id, save output
    await pgRun("UPDATE steps SET current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3", [output, now(), step.id]);

    const loopConfig: LoopConfig | null = step.loop_config ? JSON.parse(step.loop_config) : null;

    // T8: verify_each flow — set verify step to pending
    if (loopConfig?.verifyEach && loopConfig.verifyStep) {
      const verifyStep = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [step.run_id, loopConfig.verifyStep]);

      if (verifyStep) {
        // Only set verify to pending if not already pending/running (prevents race condition with parallel stories)
        await pgRun("UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2 AND status IN ('waiting', 'done')", [now(), verifyStep.id]);
        await pgRun("UPDATE steps SET status = 'running', updated_at = $1 WHERE id = $2", [now(), step.id]);
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
  emitEvent({ ts: now(), event: "step.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id });
  logger.info(`Step completed: ${step.step_id}`, { runId: step.run_id, stepId: step.step_id });

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
        // Story retries exhausted — fail everything
        await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, updated_at = $2 WHERE id = $3", [newRetry, now(), retryStory.id]);
        await setStepStatus(loopStepId, "failed");
        await failRun(verifyStep.run_id);
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
    const verifiedRow = await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1", [verifyStep.run_id, verifiedStoryId]);
    if (verifiedRow) {
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
async function autoVerifyDoneStories(
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

    const prUrl = story.pr_url || "";
    if (!prUrl) return story; // No PR URL → needs agent verification

    try {
      const prState = getPRState(prUrl);

      if (prState === "MERGED") {
        // Advisory quality check — auto-verify regardless (downstream steps catch issues)
        const repoPath = context["repo"] || context["REPO"] || "";
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
        // Always try auto-merge for done stories with OPEN PRs.
        // The verify agent already marked it "done" meaning quality checks passed.
        // Waiting for abandon count wastes cycles — merge immediately.
        if (tryAutoMergePR(prUrl, story.story_id, runId)) {
          await verifyStory(story.id);
          logger.info(`[${logPrefix}] Story ${story.story_id} auto-merged + verified — PR was OPEN (done story)`, { runId });
          emitEvent({ ts: now(), event: "story.verified", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title, detail: "Auto-merged — done story with OPEN PR" });
          continue;
        }
        // If auto-merge failed, still needs agent verification
      }
    } catch (e) {
      logger.warn(`[${logPrefix}] PR state check failed for ${prUrl}: ${String(e)}`, { runId });
    }

    return story; // Needs agent verification
  }
}

