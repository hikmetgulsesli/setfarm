import { getDb, beginTx, endTx } from "../db.js";
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
import { resolveTemplate, parseOutputKeyValues, readProgressFile, readProjectMemory, updateProjectMemory } from "./context-ops.js";
import { getStories, formatStoryForTemplate, formatCompletedStories, parseAndInsertStories } from "./story-ops.js";
import { createStoryWorktree, removeStoryWorktree } from "./worktree-ops.js";
import { computeHasFrontendChanges, checkTestFailures, checkQualityGate, processDesignCompletion, processSetupCompletion, processSetupDesignContracts, processBrowserCheck, processDesignFidelityCheck } from "./step-guardrails.js";
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

function getWorkflowId(runId: string): string | undefined {
  return _getWorkflowId(runId);
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
  // Count pending steps, PLUS running loop steps that still have pending stories
  // #182: Don't match 'waiting' (claimStep won't accept them → wasted sessions)
  // #262: Also match running loops with unverified 'done' stories (verify_each cycle)
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM steps s
     JOIN runs r ON r.id = s.run_id
     WHERE s.agent_id = ? AND r.status = 'running'
       AND (
         s.status = 'pending'
         OR (s.status = 'running' AND s.type = 'loop'
             AND (EXISTS (SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'pending')
                  OR EXISTS (SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'done')))
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
 * Throttle cleanupAbandonedSteps: run at most once every 30 seconds (matches cron interval).
 */
let lastCleanupTime = 0;

/**
 * Find and claim a pending step for an agent, returning the resolved input.
 */
export function claimStep(agentId: string): ClaimResult {
  beginTx();
  try {
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
           AND prev.status NOT IN ('done', 'failed', 'skipped', 'verified')
           AND NOT (prev.type = 'loop' AND prev.status = 'running')
       )
     ORDER BY s.step_index ASC, s.status ASC
     LIMIT 1`
  ).get(agentId) as { id: string; step_id: string; run_id: string; input_template: string; type: string; loop_config: string | null; step_status: string } | undefined;

  if (!step) return { found: false };

  // Guard: don't claim work for a failed run
  if (getRunStatus(step.run_id) === RUN_STATUS.FAILED) return { found: false };

  // DESIGN STEP DEDUP: If .stitch + stitch/*.html exist, auto-complete design step.
  // Prevents duplicate Stitch projects on retry/re-run of same repo.
  if (step.step_id === "design") {
    const dRepoPath = getRunContext(step.run_id)["repo"] || "";
    if (dRepoPath) {
      const dStitchFile = path.join(dRepoPath, ".stitch");
      const dStitchDir = path.join(dRepoPath, "stitch");
      if (fs.existsSync(dStitchFile) && fs.existsSync(dStitchDir)) {
        try {
          const dData = JSON.parse(fs.readFileSync(dStitchFile, "utf-8"));
          // Only reuse if .stitch was written DURING this run (prevents cross-run contamination)
          const runRow = db.prepare("SELECT created_at FROM runs WHERE id = ?").get(step.run_id) as any;
          const runCreatedAt = runRow ? new Date(runRow.created_at).getTime() : 0;
          const stitchUpdatedAt = dData.updatedAt ? new Date(dData.updatedAt).getTime() : 0;
          if (stitchUpdatedAt < runCreatedAt) {
            logger.info(`[design-dedup] .stitch is stale (written ${dData.updatedAt}, run started ${runRow?.created_at}) — deleting to force fresh design`, { runId: step.run_id });
            try { fs.unlinkSync(dStitchFile); } catch {}
            try { fs.rmSync(dStitchDir, { recursive: true, force: true }); } catch {}
          } else {
          const dHtmlFiles = fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html"));
          if (dData.projectId && dHtmlFiles.length > 0) {
            const dScreenMap = dHtmlFiles.map((f: string) => ({
              screenId: f.replace(".html", ""),
              name: f.replace(".html", ""),
              type: "page",
              description: f.replace(".html", ""),
            }));
            const dCtx = getRunContext(step.run_id);
            dCtx["stitch_project_id"] = dData.projectId;
            dCtx["screens_generated"] = String(dHtmlFiles.length);
            dCtx["screen_map"] = JSON.stringify(dScreenMap);
            dCtx["device_type"] = dCtx["device_type"] || "DESKTOP";
            dCtx["design_system"] = dCtx["design_system"] || "reused from previous run";
            dCtx["design_notes"] = `Reused ${dHtmlFiles.length} existing screen designs from .stitch`;
            updateRunContext(step.run_id, dCtx);
            const dOutput = `STATUS: done\nSTITCH_PROJECT_ID: ${dData.projectId}\nSCREENS_GENERATED: ${dHtmlFiles.length}\nDESIGN_NOTES: Reused ${dHtmlFiles.length} screens from previous run`;
            db.prepare("UPDATE steps SET status = 'done', output = ?, updated_at = ? WHERE id = ?")
              .run(dOutput, new Date().toISOString(), step.id);
            logger.info(`[design-dedup] Skipped — reusing ${dHtmlFiles.length} screens from .stitch (project ${dData.projectId})`, { runId: step.run_id });
            advancePipeline(step.run_id);
            return { found: false };
          }
        }} catch (e) { logger.warn(`[design-dedup] .stitch parse error: ${e}`, { runId: step.run_id }); }
      }
    }
  }

  // DEPLOY ENV GUARD: Auto-generate .env for projects with auth/DB before deploy
  if (step.step_id === "deploy") {
    const dCtx = getRunContext(step.run_id);
    const repoPath = dCtx["repo"] || "";
    if (repoPath && !fs.existsSync(path.join(repoPath, ".env"))) {
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
  }

  // Get run context
  const context: Record<string, string> = getRunContext(step.run_id);

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
      // #claim-auto-complete: Auto-complete stories that already have a PR (open or merged).
      // In implement step, PR creation IS the deliverable — merge happens in verify step.
      // Checks BOTH running AND pending stories — medic resets running→pending faster
      // than cron claims, so pending stories with PRs must also be caught.
      // Branch naming convention: {runId_prefix}-{storyId} e.g. "433ff7a1-US-001"
      const runIdPrefix = step.run_id.slice(0, 8);
      const autoCompleteStories = db.prepare(
        "SELECT * FROM stories WHERE run_id = ? AND status = 'pending' ORDER BY story_index ASC"
      ).all(step.run_id) as any[];
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
            db.prepare("UPDATE stories SET status = 'done', pr_url = ?, story_branch = ?, updated_at = ? WHERE id = ?")
              .run(prUrl, storyBranchForCheck, new Date().toISOString(), rs.id);
            db.prepare("UPDATE steps SET current_story_id = NULL, updated_at = ? WHERE id = ? AND current_story_id = ?")
              .run(new Date().toISOString(), step.id, rs.id);
            logger.info(`[claim-auto-complete] Story ${rs.story_id} auto-completed — PR exists: ${prUrl}`, { runId: step.run_id });
            emitEvent({ ts: new Date().toISOString(), event: "story.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: rs.story_id, storyTitle: rs.title, detail: `Auto-completed — PR exists (${prUrl})` });
          }
        } catch (e) {
          logger.warn(`[claim-auto-complete] PR check failed for story ${rs.story_id}: ${String(e)}`, { runId: step.run_id });
        }
      }

      // BEGIN IMMEDIATE early: story selection + claim must be atomic to prevent
      // two parallel crons from selecting the same story (race condition fix #4)
      db.exec("BEGIN IMMEDIATE");
      let _txOpen = true;
      const _rollbackEarly = () => { if (_txOpen) { try { db.exec("ROLLBACK"); } catch (e) { logger.warn(`[claim] ROLLBACK failed: ${String(e)}`, {}); } _txOpen = false; } };

      // Find next pending story with dependency check
      const pendingStories = db.prepare(
        "SELECT * FROM stories WHERE run_id = ? AND status = 'pending' ORDER BY story_index ASC"
      ).all(step.run_id) as any[];

      let nextStory: any | undefined;
      for (const candidate of pendingStories) {
        if (candidate.depends_on) {
          try {
            const deps: string[] = JSON.parse(candidate.depends_on);
            if (deps.length > 0) {
              const completedIds = db.prepare(
                "SELECT story_id FROM stories WHERE run_id = ? AND status IN ('done', 'failed', 'verified', 'skipped')"
              ).all(step.run_id).map((r: any) => r.story_id);
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
        const failedStory = findStoryByStatus(step.run_id, "failed") as { id: string } | undefined;

        if (failedStory) {
          // v9.0: Skip failed stories instead of failing the loop
          skipFailedStories(step.run_id);
          const wfId = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "story.skipped", runId: step.run_id, workflowId: wfId, stepId: step.id, agentId: agentId, detail: "Failed stories skipped — loop continues" });
        }

        // Check if other stories are still running in parallel
        const runningStory = db.prepare(
          "SELECT id FROM stories WHERE run_id = ? AND status = 'running'"
        ).get(step.run_id);
        if (runningStory) {
          _rollbackEarly(); return { found: false }; // Other stories still running, wait for them
        }

        // DEPENDENCY DEADLOCK GUARD: pending stories exist but all blocked by deps — FAIL RUN (v1.5.53)
        if (pendingStories.length > 0 && !failedStory) {
          const deadlockMsg = `Dependency deadlock: ${pendingStories.length} pending stories all blocked by unmet dependencies — failing run`;
          logger.error(deadlockMsg, { runId: step.run_id });
          for (const blocked of pendingStories) {
            db.prepare("UPDATE stories SET status = 'failed', output = 'Failed: dependency deadlock', updated_at = ? WHERE id = ?")
              .run(new Date().toISOString(), blocked.id);
          }
          db.prepare("UPDATE steps SET status = 'failed', output = ?, updated_at = ? WHERE id = ?")
            .run(deadlockMsg, new Date().toISOString(), step.id);
          failRun(step.run_id);
          const wfIdDL = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfIdDL, stepId: step.step_id, detail: deadlockMsg });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfIdDL, detail: deadlockMsg });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // #157 GUARD: 0 total stories means planner did not produce STORIES_JSON
        const totalStories = { cnt: countAllStories(step.run_id) };
        if (totalStories.cnt === 0) {
          const noStoriesReason = "No stories exist — planner did not produce STORIES_JSON";
          logger.warn(noStoriesReason, { runId: step.run_id, stepId: step.step_id });
          db.prepare(
            "UPDATE steps SET status = 'failed', output = ?, updated_at = ? WHERE id = ?"
          ).run(noStoriesReason, new Date().toISOString(), step.id);
          db.prepare(
            "UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?"
          ).run(new Date().toISOString(), step.run_id);
          const wfId157 = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId157, stepId: step.step_id, detail: noStoriesReason });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId157, detail: noStoriesReason });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // No pending, running, or failed stories — mark step done and advance
        db.prepare(
          "UPDATE steps SET status = 'done', updated_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), step.id);
        emitEvent({ ts: new Date().toISOString(), event: "step.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
        advancePipeline(step.run_id);
        return { found: false };
      }

      // PARALLEL LIMIT: Don't exceed max concurrent running stories
      const runningStoryCount = { cnt: countStoriesByStatus(step.run_id, "running") };
      const parallelLimit = loopConfig?.parallelCount ?? 3;
      if (runningStoryCount.cnt >= parallelLimit) {
        _rollbackEarly(); return { found: false }; // At capacity, wait for running stories to finish
      }


      // GIT WORKTREE ISOLATION: Each story gets its own working directory.
      // Requires tools.fs.workspaceOnly=false in openclaw.json (sandbox off).
      const storyBranch = nextStory.story_id.toLowerCase();
      let storyWorkdir = "";
      if (context["repo"]) {
        storyWorkdir = createStoryWorktree(context["repo"], storyBranch, context["branch"] || "master", agentId);
      }
      if (!storyWorkdir && context["repo"]) {
        // Worktree creation failed — fail the story to prevent parallel corruption
        _rollbackEarly();
        const wtReason = `Worktree creation failed for story ${nextStory.story_id} — cannot isolate parallel work`;
        logger.error(wtReason, { runId: step.run_id, stepId: step.step_id });
        db.prepare("UPDATE stories SET status = 'failed', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), nextStory.id);
        emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextStory.story_id, storyTitle: nextStory.title, detail: wtReason });
        return { found: false };
      }
      context["story_workdir"] = storyWorkdir || context["repo"] || "";

      // Claim the story (transaction already open from story selection)
      db.prepare(
        "UPDATE stories SET status = 'running', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), nextStory.id);
      db.prepare(
        "UPDATE steps SET status = 'running', current_story_id = ?, updated_at = ? WHERE id = ?"
      ).run(nextStory.id, new Date().toISOString(), step.id);
      db.exec("COMMIT");
      _txOpen = false;

      // v1.5.50: Record claim in claim_log + update story claim metadata
      const claimNow = new Date().toISOString();
      try {
        db.prepare(
          "INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES (?, ?, ?, ?, ?)"
        ).run(step.run_id, step.step_id, nextStory.story_id, agentId, claimNow);
        db.prepare(
          "UPDATE stories SET claimed_at = ?, claimed_by = ? WHERE id = ?"
        ).run(claimNow, agentId, nextStory.id);
      } catch (e) { logger.warn(`[claim-log] Failed to record claim: ${String(e)}`, { runId: step.run_id }); }

      const wfId = getWorkflowId(step.run_id);
      emitEvent({ ts: new Date().toISOString(), event: "step.running", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId });
      emitEvent({ ts: new Date().toISOString(), event: "story.started", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, storyId: nextStory.story_id, storyTitle: nextStory.title });
      logger.info(`Story started: ${nextStory.story_id} — ${nextStory.title}`, { runId: step.run_id, stepId: step.step_id });

      // Build story template vars
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

      const allStories = getStories(step.run_id);
      const pendingCount = allStories.filter(s => s.status === STORY_STATUS.PENDING || s.status === STORY_STATUS.RUNNING).length;

      context["current_story"] = formatStoryForTemplate(story);
      context["current_story_id"] = story.storyId;
      context["current_story_title"] = story.title;
      context["completed_stories"] = formatCompletedStories(allStories);
      context["stories_remaining"] = String(pendingCount);
      context["progress"] = readProgressFile(step.run_id);
      context["project_memory"] = readProjectMemory(context);

      // FIX: Clear stale story-specific context from previous story to prevent cross-contamination
      context["pr_url"] = "";
      context["story_branch"] = "";
      context["verify_feedback"] = "";

      // Resolve story_screens from SCREEN_MAP
      const screenMapRaw = context["screen_map"];
      if (screenMapRaw) {
        try {
          const screenMap = JSON.parse(screenMapRaw);
          if (Array.isArray(screenMap)) {
            const storyScreens = screenMap
              .filter((s: any) => Array.isArray(s.stories) && s.stories.includes(story.storyId))
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
                logger.warn(`[story-claim] Missing design files for story ${story.storyId}: ${missing.map((s: any) => s.htmlFile).join(", ")}`, { runId: step.run_id });
              }
            }
          }
        } catch (e) {
          logger.warn(`Failed to parse screen_map for story ${story.storyId}`, { runId: step.run_id });
          context["story_screens"] = "";
        }
      }

      // Default optional template vars to prevent MISSING_INPUT_GUARD false positives (story-each flow)
      for (const v of OPTIONAL_TEMPLATE_VARS) {
        if (!context[v]) context[v] = "";
      }

      // Persist story context vars to DB so verify_each steps can access them
      updateRunContext(step.run_id, context);

      // v1.5.50: Inject previous_failure from prior abandon output
      if (nextStory.output && (nextStory.abandoned_count > 0 || nextStory.retry_count > 0)) {
        context["previous_failure"] = nextStory.output;
      }

      let resolvedInput = resolveTemplate(step.input_template, context);

      // Item 7: MISSING_INPUT_GUARD inside claim flow (v1.5.53: retry once before failing run)
      const allMissing = [...new Set([...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase()))];
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input`;
        const storyRetry = db.prepare("SELECT retry_count FROM stories WHERE id = ?").get(nextStory.id) as { retry_count: number } | undefined;
        const retryCount = storyRetry?.retry_count ?? 0;
        logger.warn(`${reason} (story=${nextStory.story_id}, retry=${retryCount})`, { runId: step.run_id, stepId: step.step_id });
        // Reset the claimed story
        if (retryCount > 0) {
          // Second occurrence — fail everything
          db.prepare("UPDATE stories SET status = 'failed', updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), nextStory.id);
          db.prepare("UPDATE steps SET status = 'failed', output = ?, current_story_id = NULL, updated_at = ? WHERE id = ?")
            .run(reason + " — failing run (retry exhausted)", new Date().toISOString(), step.id);
          db.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), step.run_id);
          const wfId2 = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: step.step_id, detail: reason });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: reason });
          if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
          scheduleRunCronTeardown(step.run_id);
        } else {
          // First occurrence — retry story (possible WAL lag)
          db.prepare("UPDATE stories SET status = 'pending', retry_count = retry_count + 1, output = ?, updated_at = ? WHERE id = ?")
            .run(reason + " — retrying once", new Date().toISOString(), nextStory.id);
          db.prepare("UPDATE steps SET current_story_id = NULL, updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), step.id);
          if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
          logger.info(`[missing-input] Story ${nextStory.story_id} will retry — possible WAL lag`, { runId: step.run_id });
        }
        return { found: false };
      }


      return { found: true, stepId: step.id, runId: step.run_id, resolvedInput };
    }
  }

  // Item 6: Single step — atomic claim with changes check to prevent race condition
  const claimResult = db.prepare(
    "UPDATE steps SET status = 'running', updated_at = ? WHERE id = ? AND status = 'pending'"
  ).run(new Date().toISOString(), step.id);
  if (claimResult.changes === 0) {
    // Already claimed by another cron — return no work
    return { found: false };
  }
  emitEvent({ ts: new Date().toISOString(), event: "step.running", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
  logger.info(`Step claimed by ${agentId}`, { runId: step.run_id, stepId: step.step_id });

  // v1.5.50: Record single step claim in claim_log
  try {
    db.prepare(
      "INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES (?, ?, NULL, ?, ?)"
    ).run(step.run_id, step.step_id, agentId, new Date().toISOString());
  } catch (e) { logger.warn(`[claim-log] Failed to record claim: ${String(e)}`, { runId: step.run_id }); }

  // #260: Default optional template vars to prevent MISSING_INPUT_GUARD false positives
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }

  // Inject progress for any step in a run that has stories
  const hasStories = db.prepare(
    "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?"
  ).get(step.run_id) as { cnt: number };
  if (hasStories.cnt > 0) {
    context["progress"] = readProgressFile(step.run_id);
    context["project_memory"] = readProjectMemory(context);

    // Inject stories_json for non-loop steps that need it
    const allStoriesForCtx = getStories(step.run_id);
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
  // This prevents parallel developers from overwriting each other's story context.
  // #claim-auto-verify: Also auto-verifies stories whose PRs are already merged,
  // preventing the "son mil" agent timeout loop.
  const loopStepForVerify = findLoopStep(step.run_id);
  if (loopStepForVerify?.loop_config) {
    const lcCheck: LoopConfig = JSON.parse(loopStepForVerify.loop_config);
    if (lcCheck.verifyEach && lcCheck.verifyStep === step.step_id) {
      // Auto-verify stories whose PRs are already merged OR open (auto-merge + verify).
      // "Son mil" fix: agent reviews PR but session dies before step complete.
      // Instead of retrying indefinitely, auto-merge open PRs to unblock pipeline.
      let nextUnverified: any | undefined;
      let _autoVerifyCount1 = 0;
      const MAX_AUTO_VERIFY = 5;
      while (true) {
        if (++_autoVerifyCount1 > MAX_AUTO_VERIFY) {
          logger.info(`[claim-auto-verify] Hit MAX_AUTO_VERIFY (${MAX_AUTO_VERIFY}) — deferring remaining stories to next cycle`, { runId: step.run_id });
          break;
        }
        nextUnverified = db.prepare(
          "SELECT * FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1"
        ).get(step.run_id) as any | undefined;
        if (!nextUnverified) break;

        const prUrl = nextUnverified.pr_url || "";
        if (prUrl) {
          const prState = getPRState(prUrl);
          if (prState === "MERGED") {
            // Advisory quality check — auto-verify regardless (downstream steps catch issues)
            const cavRepoPath = context["repo"] || context["REPO"] || "";
            if (cavRepoPath) {
              const cavIssues = runQualityChecks(cavRepoPath);
              const cavErrors = cavIssues.filter(i => i.severity === "error");
              if (cavErrors.length > 0) {
                logger.warn(`[claim-auto-verify-quality] PR merged — quality gate has ${cavErrors.length} error(s) but auto-verifying anyway (deferred to downstream steps):\n${formatQualityReport(cavIssues)}`, { runId: step.run_id });
              }
            }
            verifyStory(nextUnverified.id);
            logger.info(`[claim-auto-verify] Story ${nextUnverified.story_id} auto-verified — PR merged`, { runId: step.run_id });
            emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, storyTitle: nextUnverified.title });
            continue;
          }
          if (prState === "CLOSED") {
            const repoPath = context["repo"] || "";
            const runIdPrefix = step.run_id.slice(0, 8);
            const featureBranch = context["branch"] || context["BRANCH"] || "";
            const checkBranches = [featureBranch, "main", "master"].filter(Boolean);
            const resolution = resolveClosedPR(prUrl, nextUnverified.story_id, step.run_id, repoPath, runIdPrefix, checkBranches);
            if (resolution.alternativePrUrl) {
              db.prepare("UPDATE stories SET pr_url = ?, updated_at = ? WHERE id = ?")
                .run(resolution.alternativePrUrl, new Date().toISOString(), nextUnverified.id);
              logger.info(`[claim-auto-verify] Found alternative PR for ${nextUnverified.story_id}: ${resolution.alternativePrUrl} (original CLOSED: ${prUrl})`, { runId: step.run_id });
              emitEvent({ ts: new Date().toISOString(), event: "story.retry", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, detail: `Switched to alternative PR: ${resolution.alternativePrUrl}` });
              continue;
            } else if (resolution.contentInBaseBranch) {
              verifyStory(nextUnverified.id);
              logger.info(`[claim-auto-verify] Story ${nextUnverified.story_id} auto-verified — CLOSED PR content found in base branch`, { runId: step.run_id });
              emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, storyTitle: nextUnverified.title, detail: `Auto-verified — CLOSED PR content already in base branch` });
              continue;
            } else if (!resolution.reopened) {
              // Content truly missing — fail the story
              db.prepare("UPDATE stories SET status = 'failed', output = 'Failed: CLOSED PR could not be reopened, content not found in base branch', updated_at = ? WHERE id = ?")
                .run(new Date().toISOString(), nextUnverified.id);
              logger.warn(`[claim-auto-verify] CLOSED PR ${prUrl} — content NOT in base branch — failing story ${nextUnverified.story_id}`, { runId: step.run_id });
              emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, storyTitle: nextUnverified.title, detail: `CLOSED PR content not in base branch` });
              continue;
            }
            // reopened=true → fall through to agent verification
          }
          if (prState === "OPEN") {
            const abandonCount = nextUnverified.abandoned_count ?? 0;
            if (abandonCount >= 1 && tryAutoMergePR(prUrl, nextUnverified.story_id, step.run_id)) {
              verifyStory(nextUnverified.id);
              logger.info(`[claim-auto-verify] Story ${nextUnverified.story_id} auto-merged + verified — PR was OPEN after ${abandonCount} abandon(s)`, { runId: step.run_id });
              emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, storyTitle: nextUnverified.title, detail: `Auto-merged after ${abandonCount} abandon(s)` });
              continue;
            }
          }
        }
        break; // Found a story that needs actual agent verification
      }

      if (!nextUnverified) {
        // All stories auto-verified — no agent work needed, advance pipeline
        db.prepare("UPDATE steps SET status = 'waiting', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), step.id);
        logger.info(`[claim-auto-verify] All stories auto-verified, triggering pipeline advancement`, { runId: step.run_id });
        try { checkLoopContinuation(step.run_id, loopStepForVerify.id); } catch (e) { logger.error("[claim-auto-verify] checkLoopContinuation failed: " + String(e), { runId: step.run_id }); }
        return { found: false };
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
      const vScreenMapRaw = context["screen_map"];
      if (vScreenMapRaw) {
        try {
          const vScreenMap = JSON.parse(vScreenMapRaw);
          if (Array.isArray(vScreenMap)) {
            const vStoryScreens = vScreenMap
              .filter((s: any) => Array.isArray(s.stories) && s.stories.includes(nextUnverified.story_id))
              .map((s: any) => ({
                screenId: s.screenId,
                name: s.name,
                type: s.type,
                htmlFile: `stitch/${s.screenId}.html`,
              }));
            context["story_screens"] = JSON.stringify(vStoryScreens);
          }
        } catch (e) {
          logger.warn(`Failed to parse screen_map for verify story ${nextUnverified.story_id}`, { runId: step.run_id });
          context["story_screens"] = "";
        }
      }

      db.prepare("UPDATE runs SET context = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(context), new Date().toISOString(), step.run_id);
      logger.info(`Verify step: injected story ${nextUnverified.story_id} context`, { runId: step.run_id });
    }
  }

  let resolvedInput = resolveTemplate(step.input_template, context);

      // MISSING_INPUT_GUARD (v1.5.53): First miss → retry step, second → fail run.
      // WAL race condition can cause false positives — one retry absorbs that.
      const allMissing = [...new Set([...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase()))];
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input`;
        // Check step's retry_count to decide retry vs fail
        const stepRetry = db.prepare("SELECT retry_count FROM steps WHERE id = ?").get(step.id) as { retry_count: number } | undefined;
        const retryCount = stepRetry?.retry_count ?? 0;
        logger.warn(`${reason} (retry=${retryCount})`, { runId: step.run_id, stepId: step.step_id });
        if (retryCount > 0) {
          // Second occurrence — fail run
          db.prepare("UPDATE steps SET status = 'failed', output = ?, updated_at = ? WHERE id = ?")
            .run(reason + " — failing run (retry exhausted)", new Date().toISOString(), step.id);
          db.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), step.run_id);
          const wfId = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: reason });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: reason });
          scheduleRunCronTeardown(step.run_id);
        } else {
          // First occurrence — retry step (possible WAL lag)
          db.prepare("UPDATE steps SET status = 'pending', retry_count = retry_count + 1, output = ?, updated_at = ? WHERE id = ?")
            .run(reason + " — retrying once", new Date().toISOString(), step.id);
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
  } finally { endTx(); }
}

// ── Complete ────────────────────────────────────────────────────────

/**
 * Complete a step: save output, merge context, advance pipeline.
 */
export function completeStep(stepId: string, output: string): { advanced: boolean; runCompleted: boolean } {
  beginTx();
  try {
  const db = getDb();

  const step = db.prepare(
    "SELECT id, run_id, step_id, step_index, type, loop_config, current_story_id, agent_id FROM steps WHERE id = ?"
  ).get(stepId) as { id: string; run_id: string; step_id: string; step_index: number; type: string; loop_config: string | null; current_story_id: string | null; agent_id: string } | undefined;

  if (!step) throw new Error(`Step not found: ${stepId}`);

  // Guard: don't process completions for failed runs
  if (getRunStatus(step.run_id) === RUN_STATUS.FAILED) {
    return { advanced: false, runCompleted: false };
  }

  // Merge KEY: value lines into run context
  const context: Record<string, string> = getRunContext(step.run_id);

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
    failStep(stepId, `Agent reported failure: ${parsed["status"]}. Output: ${output.slice(0, 500)}`);
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
  const prevContextJson = db.prepare("SELECT context FROM runs WHERE id = ?").get(step.run_id) as { context: string } | undefined;
  db.prepare(
    "UPDATE runs SET context = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(context), new Date().toISOString(), step.run_id);

  // PLAN STEP PRD GUARDRAIL (v1.5.53): Plan must output a meaningful PRD
  if (step.step_id === "plan" && parsed["status"]?.toLowerCase() === "done") {
    const prdVal = (parsed["prd"] || context["prd"] || "").trim();
    if (prdVal.length < 100) {
      const prdErr = `GUARDRAIL: Plan step completed but PRD is ${prdVal.length < 1 ? "empty" : "too short (" + prdVal.length + " chars)"}. Plan must output a meaningful PRD.`;
      logger.warn(`[plan-guardrail] ${prdErr}`, { runId: step.run_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, prdErr);
      return { advanced: false, runCompleted: false };
    }

    // PRD_SCREEN_COUNT guardrail: minimum 3 screens
    const screenCount = parseInt(parsed["prd_screen_count"] || context["prd_screen_count"] || "0", 10);
    if (screenCount > 0 && screenCount < 3) {
      const scErr = `GUARDRAIL: PRD has only ${screenCount} screen(s). Minimum is 3 (main view + error state + empty/alternate state). Add missing screens to PRD Ekranlar table and update PRD_SCREEN_COUNT.`;
      logger.warn(`[plan-guardrail] ${scErr}`, { runId: step.run_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, scErr);
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
            const priorRun = db.prepare(
              "SELECT id FROM runs WHERE status IN ('completed','cancelled','failed') AND context LIKE ? AND id != ? LIMIT 1"
            ).get(`%${repoPath}%`, step.run_id) as { id: string } | undefined;
            // Clean in-place: same directory, fresh start (no suffix — keeps resume working)
            {
              // Clean stale artifacts from previous runs
              try { fs.unlinkSync(path.join(repoPath, ".stitch")); } catch {}
              try { fs.rmSync(path.join(repoPath, "stitch"), { recursive: true, force: true }); } catch {}
              try { fs.rmSync(path.join(repoPath, ".stitch-screens.json"), { force: true }); } catch {}
              execFileSync("git", ["checkout", "--orphan", "__fresh__"], { cwd: repoPath, timeout: 5000 });
              execFileSync("git", ["rm", "-rf", "."], { cwd: repoPath, timeout: 5000 });
              execFileSync("git", ["clean", "-fd"], { cwd: repoPath, timeout: 5000 });
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

  // TEST FAILURE GUARDRAIL
  if (parsed["status"]?.toLowerCase() === "done") {
    const testFailMsg = checkTestFailures(output);
    if (testFailMsg) {
      logger.warn(`Test guardrail triggered`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, testFailMsg);
      return { advanced: false, runCompleted: false };
    }
  }

  // QUALITY GATE GUARDRAIL
  // For implement step (loop), check story worktree — not main repo.
  // Story code lives in worktree until PR merge; main repo won't have the changes yet.
  if (parsed["status"]?.toLowerCase() === "done") {
    const qgPath = (step.step_id === "implement" && context["story_workdir"])
      ? context["story_workdir"]
      : (context["repo"] || context["REPO"] || "");
    const qgMsg = checkQualityGate(step.step_id, qgPath);
    if (qgMsg) {
      logger.warn(`[quality-gate] Failed`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, qgMsg);
      return { advanced: false, runCompleted: false };
    }
  }

  // Design Contract + Rules (design step)
  if (step.step_id === "design" && parsed["status"]?.toLowerCase() === "done") {
    const designErr = processDesignCompletion(step.run_id, context, db);
    if (designErr) {
      logger.warn(`[design-guardrail] Failed`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, designErr);
      return { advanced: false, runCompleted: false };
    }

    // Immediately download Stitch HTML after design completes (don't wait for setup-repo)
    const dRepo = context["repo"] || context["REPO"] || "";
    const dProjId = context["stitch_project_id"] || "";
    const dScreenCount = parseInt(context["screens_generated"] || "0", 10);
    const dScreenMap = context["screen_map"] || "";
    const dHasScreens = dScreenCount > 0 || (dScreenMap.length > 10 && dScreenMap.includes("screenId"));
    if (dRepo && dProjId && dHasScreens) {
      const dStitchDir = path.join(dRepo, "stitch");
      if (!fs.existsSync(dStitchDir) || fs.readdirSync(dStitchDir).filter(f => f.endsWith(".html")).length === 0) {
        logger.info(`[design-download] Downloading ${dScreenCount} screens from Stitch project ${dProjId}`, { runId: step.run_id });
        try {
          fs.mkdirSync(dStitchDir, { recursive: true });
          const stitchScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/stitch-api.mjs");
          let screenIds: any[] = [];
          const screenMapJson = context["screen_map"] || "";
          if (screenMapJson) {
            try { screenIds = JSON.parse(screenMapJson); } catch {}
          }
          if (screenIds.length === 0) {
            try {
              const listOut = execFileSync("node", [stitchScript, "list-screens", dProjId], { encoding: "utf-8", timeout: 30000 }).trim();
              try { screenIds = JSON.parse(listOut); } catch {}
            } catch {}
          }
          let dlCount = 0;
          for (const scr of screenIds) {
            const sid = scr?.id || scr?.screenId || (typeof scr === "string" ? scr : null);
            if (!sid) continue;
            try {
              execFileSync("node", [stitchScript, "download-screen", dProjId, String(sid), path.join(dStitchDir, String(sid) + ".html")], { encoding: "utf-8", timeout: 30000 });
              dlCount++;
            } catch (dlErr) { logger.warn(`[design-download] download-screen ${sid} failed: ${dlErr}`, { runId: step.run_id }); }
          }
          try { execFileSync("node", [stitchScript, "create-manifest", dStitchDir], { encoding: "utf-8", timeout: 15000 }); } catch {}
          try { execFileSync("node", [stitchScript, "extract-tokens", dStitchDir], { encoding: "utf-8", timeout: 15000 }); } catch {}
          logger.info(`[design-download] Downloaded ${dlCount}/${screenIds.length} screen(s)`, { runId: step.run_id });
        } catch (dlErr) {
          logger.warn(`[design-download] Screen download failed: ${dlErr}`, { runId: step.run_id });
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
        updateRunContext(step.run_id, context);
      }
    }
    const dbErr = processSetupCompletion(context, step.run_id);
    if (dbErr) {
      failStep(stepId, dbErr);
      return { advanced: false, runCompleted: false };
    }
  }

  // Design Contract Building (setup step — after HTML download)
  if (step.step_id === "setup-repo" && parsed["status"]?.toLowerCase() === "done") {
    const designErr = processSetupDesignContracts(step.run_id, context, db);
    if (designErr) {
      failStep(stepId, designErr);
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
          updateRunContext(step.run_id, context);
        }
      } catch {}
    }
  }

  // SETUP-BUILD BASELINE GUARDRAIL (v1.5.53): Also reject empty baseline
  if (step.step_id === "setup-build" && parsed["status"]?.toLowerCase() === "done") {
    const baseline = (parsed["baseline"] || "").toLowerCase().trim();
    if (!baseline || /(fail|error|broken|crash)/i.test(baseline)) {
      const baselineMsg = `GUARDRAIL: setup-build baseline is "${parsed["baseline"] || "(empty)"}" — build must explicitly pass.`;
      logger.warn(`[setup-build-guardrail] ${baselineMsg}`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, baselineMsg);
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
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, deployErr);
      return { advanced: false, runCompleted: false };
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
      failStep(stepId, screenMapErr);
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

  // Design Fidelity Check (verify + final-test steps — advisory)
  if ((step.step_id === "verify" || step.step_id === "final-test") && parsed["status"]?.toLowerCase() === "done") {
    processDesignFidelityCheck(context, step.run_id);
  }

  // SMOKE TEST GUARDRAIL (final-test): If agent skipped smoke test, retry
  if (step.step_id === "final-test" && parsed["status"]?.toLowerCase() === "done") {
    const smokeResult = parsed["smoke_test_result"] || "";
    if (!smokeResult) {
      logger.warn(`[final-test-guardrail] SMOKE_TEST_RESULT missing from final-test output — agent likely skipped smoke test. Retrying.`, { runId: step.run_id, stepId: step.step_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, "GUARDRAIL: final-test completed without SMOKE_TEST_RESULT. You MUST run smoke-test.mjs and include SMOKE_TEST_RESULT in your output.");
      return { advanced: false, runCompleted: false };
    }
  }

  db.prepare(
    "UPDATE runs SET context = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(context), new Date().toISOString(), step.run_id);

  // T5: Parse STORIES_JSON from output (any step, typically the planner)
  parseAndInsertStories(output, step.run_id);

  // STORIES STEP EARLY GUARD (v1.5.53): Catch 0 stories immediately instead of wasting setup time
  if (step.step_id === "stories" && parsed["status"]?.toLowerCase() === "done") {
    const storyCount = countAllStories(step.run_id);
    if (storyCount === 0) {
      const noStoriesMsg = "GUARDRAIL: Stories step completed with STATUS: done but produced 0 stories — STORIES_JSON missing or empty";
      logger.warn(`[stories-guardrail] ${noStoriesMsg}`, { runId: step.run_id });
      if (prevContextJson) db.prepare("UPDATE runs SET context = ? WHERE id = ?").run(prevContextJson.context, step.run_id);
      failStep(stepId, noStoriesMsg);
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
      const uiRe = /(?:ui|page|screen|component|frontend|button|form|dashboard|layout|css|html|react|next|vue|angular|svelte)/i;
      const taskText = context["task"] || "";
      if (uiRe.test(output) || uiRe.test(taskText)) {
        const autoStories = getStories(step.run_id);
        if (autoStories.length > 0) {
          const screenMap: Array<{screenId: string; name: string; type: string; description: string; stories: string[]}> = [];
          let scrIdx = 1;
          for (const s of autoStories) {
            if (uiRe.test(s.title + " " + (s.description || ""))) {
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
          db.prepare("UPDATE runs SET context = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(context), new Date().toISOString(), step.run_id);
          logger.info(`[screen-map-guardrail] Auto-generated SCREEN_MAP with ${screenMap.length} screen(s) from ${autoStories.length} stories (stories step fallback)`, { runId: step.run_id });
        }
      }
    }
  }

  // #157 GUARD: If the IMMEDIATELY NEXT step is a loop, verify stories exist.
  // v12.0: Only fire if no non-loop steps remain between current and next loop step,
  // because intermediate steps (e.g. stories, setup) may produce STORIES_JSON later.
  const nextLoopStep = db.prepare(
    "SELECT id, step_id, step_index FROM steps WHERE run_id = ? AND type = 'loop' AND step_index > ? AND status = 'waiting' ORDER BY step_index ASC LIMIT 1"
  ).get(step.run_id, step.step_index) as { id: string; step_id: string; step_index: number } | undefined;
  if (nextLoopStep) {
    // Check if there are any non-loop steps between us and the next loop step
    const intermediateSteps = db.prepare(
      "SELECT COUNT(*) as cnt FROM steps WHERE run_id = ? AND step_index > ? AND step_index < ? AND type != 'loop' AND status IN ('waiting', 'pending')"
    ).get(step.run_id, step.step_index, nextLoopStep.step_index) as { cnt: number };
    if (intermediateSteps.cnt === 0) {
      // No intermediate steps — this is the last step before the loop
      const storyCount = { cnt: countAllStories(step.run_id) };
      if (storyCount.cnt === 0) {
        const noStoriesMsg = "Step completed but produced no STORIES_JSON — downstream loop would run with 0 stories";
        logger.warn(noStoriesMsg, { runId: step.run_id, stepId: step.step_id });
        failStepWithOutput(step.id, noStoriesMsg);
        failRun(step.run_id);
        const wfId157b = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId157b, stepId: step.step_id, detail: noStoriesMsg });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId157b, detail: noStoriesMsg });
        scheduleRunCronTeardown(step.run_id);
        return { advanced: false, runCompleted: false };
      }
    } else {
      logger.info(`[stories-guard] Skipped — ${intermediateSteps.cnt} step(s) remain before loop step ${nextLoopStep.step_id}`, { runId: step.run_id, stepId: step.step_id });
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
    const storyRow = getStoryInfo(step.current_story_id);

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

    // Mark current story done or skipped + persist PR context for verify_each
    // FIX: Remove context fallback to prevent cross-contamination between parallel stories
    const storyPrUrl = parsed["pr_url"] || "";
    const storyBranchName = parsed["story_branch"] || "";
    db.prepare(
      "UPDATE stories SET status = ?, output = ?, pr_url = ?, story_branch = ?, updated_at = ? WHERE id = ?"
    ).run(storyStatus, output, storyPrUrl, storyBranchName, new Date().toISOString(), step.current_story_id);
    emitEvent({ ts: new Date().toISOString(), event: storyEvent as import("./events.js").EventType, runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title });
    logger.info(`Story ${storyStatus}: ${storyRow?.story_id} — ${storyRow?.title}`, { runId: step.run_id, stepId: step.step_id });

    // v1.5.50: Resolve claim_log outcome
    try {
      db.prepare(
        "UPDATE claim_log SET outcome = 'completed' WHERE story_id = ? AND outcome IS NULL"
      ).run(storyRow?.story_id || "");
    } catch (e) { logger.warn(`[claim-log] Failed to resolve completion: ${String(e)}`, { runId: step.run_id }); }


    // Update PROJECT_MEMORY.md with completed story info
    if (storyRow && storyStatus !== STORY_STATUS.SKIPPED) {
      updateProjectMemory(context, storyRow.story_id, storyRow.title, storyStatus, output);
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
    updateRunContext(step.run_id, context);

    // Clear current_story_id, save output
    db.prepare(
      "UPDATE steps SET current_story_id = NULL, output = ?, updated_at = ? WHERE id = ?"
    ).run(output, new Date().toISOString(), step.id);

    const loopConfig: LoopConfig | null = step.loop_config ? JSON.parse(step.loop_config) : null;

    // T8: verify_each flow — set verify step to pending
    if (loopConfig?.verifyEach && loopConfig.verifyStep) {
      const verifyStep = db.prepare(
        "SELECT id FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1"
      ).get(step.run_id, loopConfig.verifyStep) as { id: string } | undefined;

      if (verifyStep) {
        // Only set verify to pending if not already pending/running (prevents race condition with parallel stories)
        db.prepare(
          "UPDATE steps SET status = 'pending', updated_at = ? WHERE id = ? AND status IN ('waiting', 'done')"
        ).run(new Date().toISOString(), verifyStep.id);
        // Loop step stays 'running'
        db.prepare(
          "UPDATE steps SET status = 'running', updated_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), step.id);
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

  // Single step: mark done (accept both running and pending — medic may have reset a slow step to pending
  // while the agent was still finishing its work, so we should still accept the completion)
  const updateResult = db.prepare(
    "UPDATE steps SET status = 'done', output = ?, updated_at = ? WHERE id = ? AND status IN ('running', 'pending')"
  ).run(output, new Date().toISOString(), stepId);
  if (updateResult.changes === 0) {
    // Already completed by another session — skip to prevent double pipeline advancement
    logger.info(`Step already completed, skipping duplicate`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }
  emitEvent({ ts: new Date().toISOString(), event: "step.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id });
  logger.info(`Step completed: ${step.step_id}`, { runId: step.run_id, stepId: step.step_id });

  // v1.5.50: Resolve claim_log outcome for single step
  try {
    db.prepare(
      "UPDATE claim_log SET outcome = 'completed' WHERE run_id = ? AND step_id = ? AND story_id IS NULL AND outcome IS NULL"
    ).run(step.run_id, step.step_id);
  } catch (e) { logger.warn(`[claim-log] Failed to resolve completion: ${String(e)}`, { runId: step.run_id }); }

  // Guard: if a loop step is still active (not done), don't advance the pipeline.
  // During verify_each cycles, single steps (test, pr, review, etc.) may get claimed
  // and completed — advancing would skip the loop and break story iteration.
  const activeLoop = findActiveLoop(step.run_id);
  if (activeLoop) {
    logger.info(`Skipping advancePipeline — loop step still active`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  return advancePipeline(step.run_id);
  } finally { endTx(); }
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
  db.exec("BEGIN IMMEDIATE");
  try {
    const changed = db.prepare(
      "UPDATE steps SET status = 'waiting', output = ?, updated_at = ? WHERE id = ? AND status = 'running'"
    ).run(output, new Date().toISOString(), verifyStep.id);
    if (changed.changes === 0) {
      db.exec("COMMIT");
      // Another cron already processed this verify step
      return { advanced: false, runCompleted: false };
    }
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch (e) { logger.warn(`[step-ops] ROLLBACK failed: ${String(e)}`, {}); }
    throw err;
  }

  // Identify the story being verified: output first (most reliable), then context (v1.5.53)
  let verifiedStoryId = parsedOutput["current_story_id"] || context["current_story_id"];
  if (!verifiedStoryId) {
    // Fallback: find the most recent 'done' story
    const lastDone = db.prepare(
      "SELECT story_id FROM stories WHERE run_id = ? AND status = 'done' ORDER BY updated_at DESC LIMIT 1"
    ).get(verifyStep.run_id) as { story_id: string } | undefined;
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
        db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = ? WHERE id = ?").run(newRetry, new Date().toISOString(), retryStory.id);
        setStepStatus(loopStepId, "failed");
        failRun(verifyStep.run_id);
        const wfId = getWorkflowId(verifyStep.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: verifyStep.run_id, workflowId: wfId, stepId: verifyStep.step_id });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: verifyStep.run_id, workflowId: wfId, detail: "Verification retries exhausted" });
        scheduleRunCronTeardown(verifyStep.run_id);
        return { advanced: false, runCompleted: false };
      }

      // Set story back to pending for retry
      db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = ? WHERE id = ?").run(newRetry, new Date().toISOString(), retryStory.id);

      // Store verify feedback
      const issues = context["issues"] ?? output;
      context["verify_feedback"] = issues;
      emitEvent({ ts: new Date().toISOString(), event: "story.retry", runId: verifyStep.run_id, workflowId: getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, detail: issues });
      updateRunContext(verifyStep.run_id, context);
    }

    // Set loop step back to pending for retry
    setStepStatus(loopStepId, "pending");
    return { advanced: false, runCompleted: false };
  }

  // Verify PASSED — mark the verified story as 'verified' (not just 'done')
  if (verifiedStoryId) {
    const verifiedRow = db.prepare(
      "SELECT id FROM stories WHERE run_id = ? AND story_id = ? AND status = 'done' LIMIT 1"
    ).get(verifyStep.run_id, verifiedStoryId) as { id: string } | undefined;
    if (verifiedRow) {
      verifyStory(verifiedRow.id);
      logger.info(`Story verified: ${verifiedStoryId}`, { runId: verifyStep.run_id });
    }
  }
  emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: verifyStep.run_id, workflowId: getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, storyId: verifiedStoryId });

  // Clear feedback
  delete context["verify_feedback"];

  // Check for more unverified 'done' stories before checking loop continuation
  // Auto-verify stories whose PRs are already merged (prevents redundant verify cycles)
  let nextUnverifiedStory: { id: string; story_id: string; output: string | null; pr_url: string | null; story_branch: string | null } | undefined;
  let _autoVerifyCount2 = 0;
  const MAX_AUTO_VERIFY_HVE = 5;
  while (true) {
    if (++_autoVerifyCount2 > MAX_AUTO_VERIFY_HVE) {
      logger.info(`[handleVerifyEach] Hit MAX_AUTO_VERIFY (${MAX_AUTO_VERIFY_HVE}) — deferring remaining stories to next cycle`, { runId: verifyStep.run_id });
      break;
    }
    nextUnverifiedStory = db.prepare(
      "SELECT id, story_id, output, pr_url, story_branch FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1"
    ).get(verifyStep.run_id) as typeof nextUnverifiedStory;
    if (!nextUnverifiedStory) break;

    // Check if PR is already merged — if so, auto-verify and skip
    const prUrl = nextUnverifiedStory.pr_url || "";
    if (prUrl) {
      const prState = getPRState(prUrl);
      if (prState === "MERGED") {
        // Advisory quality check — auto-verify regardless (downstream steps catch issues)
        const hveRepoPath = context["repo"] || context["REPO"] || "";
        if (hveRepoPath) {
          const hveIssues = runQualityChecks(hveRepoPath);
          const hveErrors = hveIssues.filter(i => i.severity === "error");
          if (hveErrors.length > 0) {
            logger.warn(`[auto-verify-quality] PR merged — quality gate has ${hveErrors.length} error(s) but auto-verifying anyway (deferred to downstream):\n${formatQualityReport(hveIssues)}`, { runId: verifyStep.run_id });
          }
        }
        verifyStory(nextUnverifiedStory.id);
        logger.info(`Auto-verified story ${nextUnverifiedStory.story_id} — PR merged`, { runId: verifyStep.run_id });
        continue;
      }
      if (prState === "CLOSED") {
        const repoPath = context["repo"] || "";
        const runIdPrefix = verifyStep.run_id.slice(0, 8);
        const featureBranch2 = context["branch"] || context["BRANCH"] || "";
        const checkBranches2 = [featureBranch2, "main", "master"].filter(Boolean);
        const resolution = resolveClosedPR(prUrl, nextUnverifiedStory.story_id, verifyStep.run_id, repoPath, runIdPrefix, checkBranches2);
        if (resolution.alternativePrUrl) {
          db.prepare("UPDATE stories SET pr_url = ?, updated_at = ? WHERE id = ?")
            .run(resolution.alternativePrUrl, new Date().toISOString(), nextUnverifiedStory.id);
          logger.info(`[handleVerifyEach] Found alternative PR for ${nextUnverifiedStory.story_id}: ${resolution.alternativePrUrl}`, { runId: verifyStep.run_id });
          continue;
        } else if (resolution.contentInBaseBranch) {
          verifyStory(nextUnverifiedStory.id);
          logger.info(`[handleVerifyEach] Story ${nextUnverifiedStory.story_id} auto-verified — CLOSED PR content found in base branch`, { runId: verifyStep.run_id });
          continue;
        } else if (!resolution.reopened) {
          db.prepare("UPDATE stories SET status = 'failed', output = 'Failed: CLOSED PR could not be reopened, content not found in base branch', updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), nextUnverifiedStory.id);
          logger.warn(`[handleVerifyEach] CLOSED PR ${prUrl} — content NOT in base branch — failing story ${nextUnverifiedStory.story_id}`, { runId: verifyStep.run_id });
          continue;
        }
        // reopened=true → fall through to agent verification
      }
    }
    break; // Found a story that needs actual verification
  }

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
    updateRunContext(verifyStep.run_id, context);

    // Set verify step to pending for next story
    setStepStatus(verifyStep.id, "pending");
    logger.info(`Verify cycling to next unverified story: ${nextUnverifiedStory.story_id}`, { runId: verifyStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  // No more unverified stories — persist context and check loop continuation
  updateRunContext(verifyStep.run_id, context);

  try {
    return checkLoopContinuation(verifyStep.run_id, loopStepId);
  } catch (err) {
    logger.error(`checkLoopContinuation failed, recovering: ${String(err)}`, { runId: verifyStep.run_id });
    // Ensure loop step is at least pending so cron can retry
    setStepStatus(loopStepId, "pending");
    return { advanced: false, runCompleted: false };
  }
}

