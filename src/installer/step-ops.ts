import { getDb, beginTx, endTx } from "../db.js";
import type { LoopConfig, Story } from "./types.js";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { emitEvent } from "./events.js";
import { logger } from "../lib/logger.js";
import { runQualityChecks, formatQualityReport } from "./quality-gates.js";
import {
  CLEANUP_THROTTLE_MS,
  PROTECTED_CONTEXT_KEYS,
  OPTIONAL_TEMPLATE_VARS,
} from "./constants.js";

// ── Re-exports from extracted modules (backwards compat for cli.ts, medic.ts) ──
export { resolveTemplate, parseOutputKeyValues } from "./context-ops.js";
export { getStories, getCurrentStory } from "./story-ops.js";
export { computeHasFrontendChanges } from "./step-guardrails.js";
export { archiveRunProgress } from "./cleanup-ops.js";

// ── Imports from extracted modules (used internally) ──
import { resolveTemplate, parseOutputKeyValues, readProgressFile, readProjectMemory, updateProjectMemory } from "./context-ops.js";
import { getStories, formatStoryForTemplate, formatCompletedStories, parseAndInsertStories } from "./story-ops.js";
import { createStoryWorktree, removeStoryWorktree, cleanupWorktrees } from "./worktree-ops.js";
import { computeHasFrontendChanges, checkTestFailures, checkQualityGate, checkMissingInputs, processDesignCompletion, processSetupCompletion, processSetupDesignContracts, processBrowserCheck } from "./step-guardrails.js";
import { cleanupAbandonedSteps as _cleanupAbandonedSteps, scheduleRunCronTeardown, archiveRunProgress, cleanupLocalBranches } from "./cleanup-ops.js";
import {
  getRunStatus, getRunContext, updateRunContext, failRun, completeRun,
  getWorkflowId as _getWorkflowId,
  verifyStory, skipFailedStories, countAllStories, countStoriesByStatus,
  findStoryByStatus, getNextPendingStory, getNextDoneStory, getStoryInfo,
  setStepStatus, setStepStatusConditional, failStepWithOutput, clearStepStory,
  findLoopStep, findActiveLoop, findVerifyStepByStepId,
  updateStoryStatus,
} from "./repo.js";

/**
 * Search for an alternative merged/open PR when the recorded PR is CLOSED.
 * Developer retries often create a new branch (e.g. US-005-v2) with a new PR,
 * but the DB still points to the old CLOSED PR. This searches by story branch
 * pattern to find the actual deliverable.
 */
function findAlternativePR(repoPath: string, storyId: string, runIdPrefix: string): string | null {
  // Search patterns: exact branch, branch with suffix (-v2, -fix, etc.)
  const baseBranch = `${runIdPrefix}-${storyId}`;
  try {
    // First: search for merged PRs matching the story ID in the title or branch
    let foundUrl = execFileSync("gh", ["pr", "list", "--search", `${storyId} in:title`, "--state", "merged", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: 15000, stdio: "pipe"
    }).toString().trim();
    if (foundUrl) return foundUrl;

    // Second: search for open PRs matching the story ID
    foundUrl = execFileSync("gh", ["pr", "list", "--search", `${storyId} in:title`, "--state", "open", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: 15000, stdio: "pipe"
    }).toString().trim();
    if (foundUrl) return foundUrl;

    // Third: search by base branch name pattern
    foundUrl = execFileSync("gh", ["pr", "list", "--search", `head:${baseBranch}`, "--state", "merged", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: 15000, stdio: "pipe"
    }).toString().trim();
    if (foundUrl) return foundUrl;
  } catch {
    // gh search failed — no alternative found
  }
  return null;
}

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
           AND prev.status NOT IN ('done', 'skipped', 'verified')
           AND NOT (prev.type = 'loop' AND prev.status = 'running')
       )
     ORDER BY s.step_index ASC, s.status ASC
     LIMIT 1`
  ).get(agentId) as { id: string; step_id: string; run_id: string; input_template: string; type: string; loop_config: string | null; step_status: string } | undefined;

  if (!step) return { found: false };

  // Guard: don't claim work for a failed run
  if (getRunStatus(step.run_id) === "failed") return { found: false };

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
        "SELECT * FROM stories WHERE run_id = ? AND status IN ('running', 'pending') ORDER BY story_index ASC"
      ).all(step.run_id) as any[];
      for (const rs of autoCompleteStories) {
        // Build expected branch: {runId_prefix}-{STORY_ID} e.g. "433ff7a1-US-001"
        const storyBranchForCheck = rs.story_branch || `${runIdPrefix}-${rs.story_id}`;
        const existingPrUrl = rs.pr_url || "";

        try {
          let prUrl = existingPrUrl;
          let prFound = false;

          if (prUrl) {
            // Check existing PR exists and is not CLOSED (open or merged = OK)
            const prState = execFileSync("gh", ["pr", "view", prUrl, "--json", "state", "--jq", ".state"], {
              timeout: 15000, stdio: "pipe"
            }).toString().trim();
            if (prState === "MERGED" || prState === "OPEN") {
              prFound = true;
            } else if (prState === "CLOSED") {
              // FIX: CLOSED PR — try to reopen it
              try {
                execFileSync("gh", ["pr", "reopen", prUrl], { timeout: 15000, stdio: "pipe" });
                prFound = true;
                logger.info(`[claim-auto-complete] Reopened CLOSED PR for story ${rs.story_id}: ${prUrl}`, { runId: step.run_id });
              } catch (reopenErr) {
                // Reopen failed (branch deleted, etc.) — leave story pending so agent recreates PR
                logger.warn(`[claim-auto-complete] Cannot reopen CLOSED PR ${prUrl} for story ${rs.story_id}: ${String(reopenErr)}`, { runId: step.run_id });
                prFound = false;
              }
            }
          } else if (storyBranchForCheck && context["repo"]) {
            // No pr_url recorded — search by branch name (any state except closed)
            // First check merged PRs
            let foundUrl = execFileSync("gh", ["pr", "list", "--head", storyBranchForCheck, "--state", "merged", "--json", "url", "--jq", ".[0].url"], {
              cwd: context["repo"], timeout: 15000, stdio: "pipe"
            }).toString().trim();
            if (!foundUrl) {
              // Then check open PRs
              foundUrl = execFileSync("gh", ["pr", "list", "--head", storyBranchForCheck, "--state", "open", "--json", "url", "--jq", ".[0].url"], {
                cwd: context["repo"], timeout: 15000, stdio: "pipe"
              }).toString().trim();
            }
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
                "SELECT story_id FROM stories WHERE run_id = ? AND status IN ('done', 'verified', 'skipped')"
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
          return { found: false }; // Other stories still running, wait for them
        }

        // DEPENDENCY DEADLOCK GUARD: pending stories exist but all blocked by deps
        if (pendingStories.length > 0 && !failedStory) {
          logger.warn(`Dependency deadlock: ${pendingStories.length} pending stories but all blocked by unmet dependencies — skipping blocked stories`, { runId: step.run_id });
          for (const blocked of pendingStories) {
            db.prepare("UPDATE stories SET status = 'skipped', output = 'Skipped: dependency deadlock', updated_at = ? WHERE id = ?")
              .run(new Date().toISOString(), blocked.id);
          }
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
        return { found: false }; // At capacity, wait for running stories to finish
      }


      // GIT WORKTREE ISOLATION: Each story gets its own working directory.
      // Requires tools.fs.workspaceOnly=false in openclaw.json (sandbox off).
      const storyBranch = nextStory.story_id.toLowerCase();
      let storyWorkdir = "";
      if (context["repo"]) {
        storyWorkdir = createStoryWorktree(context["repo"], storyBranch, context["branch"] || "master", agentId);
      }
      context["story_workdir"] = storyWorkdir || context["repo"] || "";

      // Transactional story claim — prevents parallel crons from double-claiming
      db.exec("BEGIN IMMEDIATE");
      try {
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
          "UPDATE stories SET status = 'running', updated_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), nextStory.id);
        db.prepare(
          "UPDATE steps SET status = 'running', current_story_id = ?, updated_at = ? WHERE id = ?"
        ).run(nextStory.id, new Date().toISOString(), step.id);
        db.exec("COMMIT");
      } catch (err) {
        try { db.exec("ROLLBACK"); } catch (e) { logger.warn(`[step-ops] ROLLBACK failed: ${String(e)}`, {}); }
        throw err;
      }

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

      let resolvedInput = resolveTemplate(step.input_template, context);

      // Item 7: MISSING_INPUT_GUARD inside claim flow — also reset the claimed story on failure
      const allMissing = [...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase());
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input — failing step and run`;
        logger.warn(reason, { runId: step.run_id, stepId: step.step_id });
        // Fail the story that was just claimed
        db.prepare(
          "UPDATE stories SET status = 'failed', updated_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), nextStory.id);
        db.prepare(
          "UPDATE steps SET status = 'failed', output = ?, current_story_id = NULL, updated_at = ? WHERE id = ?"
        ).run(reason, new Date().toISOString(), step.id);
        db.prepare(
          "UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), step.run_id);
        const wfId2 = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: step.step_id, detail: reason });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: reason });
        // Clean up the worktree we just created
        if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
        scheduleRunCronTeardown(step.run_id);
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
      while (true) {
        nextUnverified = db.prepare(
          "SELECT * FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1"
        ).get(step.run_id) as any | undefined;
        if (!nextUnverified) break;

        const prUrl = nextUnverified.pr_url || "";
        if (prUrl) {
          try {
            const prState = execFileSync("gh", ["pr", "view", prUrl, "--json", "state", "--jq", ".state"], {
              timeout: 15000, stdio: "pipe"
            }).toString().trim();
            if (prState === "MERGED") {
              // Quality gate: even merged PRs must pass quality checks before auto-verify
              const cavRepoPath = context["repo"] || context["REPO"] || "";
              if (cavRepoPath) {
                const cavIssues = runQualityChecks(cavRepoPath);
                const cavErrors = cavIssues.filter(i => i.severity === "error");
                if (cavErrors.length > 0) {
                  const cavReport = formatQualityReport(cavIssues);
                  logger.warn(`[claim-auto-verify-quality] PR merged but quality gate failed for ${nextUnverified.story_id}:
${cavReport}`, { runId: step.run_id });
                  // Don't auto-verify — let agent handle it
                  break;
                }
              }
              verifyStory(nextUnverified.id);
              logger.info(`[claim-auto-verify] Story ${nextUnverified.story_id} auto-verified — PR merged + quality gate passed`, { runId: step.run_id });
              emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, storyTitle: nextUnverified.title });
              continue; // Check next story
            }
            if (prState === "CLOSED") {
              // FIX: CLOSED PR — try to reopen first
              try {
                execFileSync("gh", ["pr", "reopen", prUrl], { timeout: 15000, stdio: "pipe" });
                logger.info(`[claim-auto-verify] Reopened CLOSED PR for story ${nextUnverified.story_id}: ${prUrl}`, { runId: step.run_id });
                // Fall through to agent verification — agent will review the reopened PR
              } catch (reopenErr) {
                // Reopen failed — search for alternative merged/open PR (developer retry creates new branch)
                const repoPath = context["repo"] || "";
                const runIdPrefix = step.run_id.slice(0, 8);
                const altPr = repoPath ? findAlternativePR(repoPath, nextUnverified.story_id, runIdPrefix) : null;
                if (altPr) {
                  // Found alternative PR — update DB and re-check state
                  db.prepare("UPDATE stories SET pr_url = ?, updated_at = ? WHERE id = ?")
                    .run(altPr, new Date().toISOString(), nextUnverified.id);
                  logger.info(`[claim-auto-verify] Found alternative PR for ${nextUnverified.story_id}: ${altPr} (original CLOSED: ${prUrl})`, { runId: step.run_id });
                  emitEvent({ ts: new Date().toISOString(), event: "story.retry", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, detail: `Switched to alternative PR: ${altPr}` });
                  continue; // Re-check with updated PR on next iteration
                }
                // No alternative found — skip story
                db.prepare("UPDATE stories SET status = 'skipped', output = 'Skipped: CLOSED PR could not be reopened and no alternative PR found', updated_at = ? WHERE id = ?")
                  .run(new Date().toISOString(), nextUnverified.id);
                logger.warn(`[claim-auto-verify] CLOSED PR ${prUrl} — no alternative found — skipping story ${nextUnverified.story_id}`, { runId: step.run_id });
                emitEvent({ ts: new Date().toISOString(), event: "story.skipped", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, detail: `CLOSED PR could not be reopened, no alternative found` });
                continue; // Check next story
              }
            }
            if (prState === "OPEN") {
              // Auto-merge open PRs — the implement agent already created the PR,
              // and reviewer session keeps dying before merge. Unblock the pipeline.
              const abandonCount = nextUnverified.abandoned_count ?? 0;
              if (abandonCount >= 1) {
                // Only auto-merge after at least 1 failed verify attempt
                try {
                  execFileSync("gh", ["pr", "merge", prUrl, "--squash", "--delete-branch"], {
                    timeout: 30000, stdio: "pipe"
                  });
                  verifyStory(nextUnverified.id);
                  logger.info(`[claim-auto-verify] Story ${nextUnverified.story_id} auto-merged + verified — PR was OPEN after ${abandonCount} abandon(s)`, { runId: step.run_id });
                  emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: nextUnverified.story_id, storyTitle: nextUnverified.title, detail: `Auto-merged after ${abandonCount} abandon(s)` });
                  continue; // Check next story
                } catch (mergeErr) {
                  logger.warn(`[claim-auto-verify] Auto-merge failed for ${prUrl}: ${String(mergeErr)}`, { runId: step.run_id });
                  // Fall through to agent verification
                }
              }
            }
          } catch (e) {
            // gh command failed — proceed with normal agent verify
            logger.warn(`[claim-auto-verify] PR state check failed for ${prUrl}: ${String(e)}`, { runId: step.run_id });
          }
        }
        break; // Found a story that needs actual agent verification
      }

      if (!nextUnverified) {
        // All stories auto-verified — no agent work needed, advance pipeline
        db.prepare("UPDATE steps SET status = 'waiting', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), step.id);
        logger.info(`[claim-auto-verify] All stories auto-verified, triggering pipeline advancement`, { runId: step.run_id });
        checkLoopContinuation(step.run_id, loopStepForVerify.id);
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
        acceptanceCriteria: JSON.parse(nextUnverified.acceptance_criteria),
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

      // MISSING_INPUT_GUARD: Any [missing:] marker means upstream didn't produce required output.
      // Fail the step AND run — downstream steps would be meaningless.
      const allMissing = [...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase());
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input — failing step and run`;
        logger.warn(reason, { runId: step.run_id, stepId: step.step_id });
        db.prepare(
          "UPDATE steps SET status = 'failed', output = ?, updated_at = ? WHERE id = ?"
        ).run(reason, new Date().toISOString(), step.id);
        db.prepare(
          "UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), step.run_id);
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
  if (getRunStatus(step.run_id) === "failed") {
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

  // No fallback extraction — if upstream didn't output required keys,
  // the missing input guard will catch it and fail cleanly.

  // EAGER CONTEXT SAVE: Persist merged context BEFORE guardrail checks.
  // Guardrails (test, quality, db-provision) may call failStep + return early,
  // which previously skipped the context save — losing parsed output keys.
  db.prepare(
    "UPDATE runs SET context = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(context), new Date().toISOString(), step.run_id);


  // TEST FAILURE GUARDRAIL
  if (parsed["status"]?.toLowerCase() === "done") {
    const testFailMsg = checkTestFailures(output);
    if (testFailMsg) {
      logger.warn(`Test guardrail triggered`, { runId: step.run_id, stepId: step.step_id });
      failStep(stepId, testFailMsg);
      return { advanced: false, runCompleted: false };
    }
  }

  // QUALITY GATE GUARDRAIL
  if (parsed["status"]?.toLowerCase() === "done") {
    const repoPath = context["repo"] || context["REPO"] || "";
    const qgMsg = checkQualityGate(step.step_id, repoPath);
    if (qgMsg) {
      logger.warn(`[quality-gate] Failed`, { runId: step.run_id, stepId: step.step_id });
      failStep(stepId, qgMsg);
      return { advanced: false, runCompleted: false };
    }
  }

  // Design Contract + Rules (design step)
  if (step.step_id === "design" && parsed["status"]?.toLowerCase() === "done") {
    const designErr = processDesignCompletion(step.run_id, context, db);
    if (designErr) {
      logger.warn(`[design-guardrail] Failed`, { runId: step.run_id, stepId: step.step_id });
      failStep(stepId, designErr);
      return { advanced: false, runCompleted: false };
    }
  }

  // DB Auto-Provisioning (setup step)
  if (step.step_id === "setup" && parsed["status"]?.toLowerCase() === "done") {
    const dbErr = processSetupCompletion(context, step.run_id);
    if (dbErr) {
      failStep(stepId, dbErr);
      return { advanced: false, runCompleted: false };
    }
  }

  // Design Contract Building (setup step — after HTML download)
  if (step.step_id === "setup" && parsed["status"]?.toLowerCase() === "done") {
    processSetupDesignContracts(step.run_id, context, db);
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
  if (step.step_id === "implement" && parsed["status"]?.toLowerCase() === "done") {
    processBrowserCheck(context, step.run_id, step.step_id);
  }

  db.prepare(
    "UPDATE runs SET context = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(context), new Date().toISOString(), step.run_id);

  // T5: Parse STORIES_JSON from output (any step, typically the planner)
  parseAndInsertStories(output, step.run_id);

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
      } catch {
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

    // v9.0: Check if agent output STATUS: skip — mark story as skipped instead of done
    const statusVal = parsed["status"]?.toLowerCase();
    const storyStatus = statusVal === "skip" ? "skipped" : "done";
    const storyEvent = statusVal === "skip" ? "story.skipped" : "story.done";

    // Mark current story done or skipped + persist PR context for verify_each
    // FIX: Remove context fallback to prevent cross-contamination between parallel stories
    const storyPrUrl = parsed["pr_url"] || "";
    const storyBranchName = parsed["story_branch"] || "";
    db.prepare(
      "UPDATE stories SET status = ?, output = ?, pr_url = ?, story_branch = ?, updated_at = ? WHERE id = ?"
    ).run(storyStatus, output, storyPrUrl, storyBranchName, new Date().toISOString(), step.current_story_id);
    emitEvent({ ts: new Date().toISOString(), event: storyEvent, runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title });
    logger.info(`Story ${storyStatus}: ${storyRow?.story_id} — ${storyRow?.title}`, { runId: step.run_id, stepId: step.step_id });


    // Update PROJECT_MEMORY.md with completed story info
    if (storyRow && storyStatus !== "skipped") {
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

  // Single step: mark done (idempotency guard — only complete if still running)
  const updateResult = db.prepare(
    "UPDATE steps SET status = 'done', output = ?, updated_at = ? WHERE id = ? AND status = 'running'"
  ).run(output, new Date().toISOString(), stepId);
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
  const status = context["status"]?.toLowerCase();

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
  while (true) {
    nextUnverifiedStory = db.prepare(
      "SELECT id, story_id, output, pr_url, story_branch FROM stories WHERE run_id = ? AND status = 'done' ORDER BY story_index ASC LIMIT 1"
    ).get(verifyStep.run_id) as typeof nextUnverifiedStory;
    if (!nextUnverifiedStory) break;

    // Check if PR is already merged — if so, auto-verify and skip
    const prUrl = nextUnverifiedStory.pr_url || "";
    if (prUrl) {
      try {
        const prState = execFileSync("gh", ["pr", "view", prUrl, "--json", "state", "--jq", ".state"], { timeout: 15000, stdio: "pipe" }).toString().trim();
        if (prState === "MERGED") {
          // Quality gate: even merged PRs must pass quality checks
          const hveRepoPath = context["repo"] || context["REPO"] || "";
          if (hveRepoPath) {
            const hveIssues = runQualityChecks(hveRepoPath);
            const hveErrors = hveIssues.filter(i => i.severity === "error");
            if (hveErrors.length > 0) {
              const hveReport = formatQualityReport(hveIssues);
              logger.warn(`[auto-verify-quality] PR merged but quality gate failed for ${nextUnverifiedStory.story_id}:
${hveReport}`, { runId: verifyStep.run_id });
              // Block auto-verify — story goes back to pending for agent to fix
              db.prepare("UPDATE stories SET status = 'pending', retry_count = retry_count + 1, updated_at = ? WHERE id = ?")
                .run(new Date().toISOString(), nextUnverifiedStory.id);
              context["verify_feedback"] = `QUALITY GATE BLOCKED AUTO-VERIFY:
${hveReport}
Fix these issues in the merged code.`;
              db.prepare("UPDATE runs SET context = ?, updated_at = ? WHERE id = ?")
                .run(JSON.stringify(context), new Date().toISOString(), verifyStep.run_id);
              break; // Stop auto-verify loop — agent needs to fix
            }
          }
          verifyStory(nextUnverifiedStory.id);
          logger.info(`Auto-verified story ${nextUnverifiedStory.story_id} — PR merged + quality gate passed`, { runId: verifyStep.run_id });
          continue; // Check next story
        }
        if (prState === "CLOSED") {
          // FIX: CLOSED PR — try to reopen first
          try {
            execFileSync("gh", ["pr", "reopen", prUrl], { timeout: 15000, stdio: "pipe" });
            logger.info(`[handleVerifyEach] Reopened CLOSED PR for story ${nextUnverifiedStory.story_id}: ${prUrl}`, { runId: verifyStep.run_id });
            // Fall through to agent verification
          } catch (reopenErr) {
            // Reopen failed — search for alternative merged/open PR
            const repoPath = context["repo"] || "";
            const runIdPrefix = verifyStep.run_id.slice(0, 8);
            const altPr = repoPath ? findAlternativePR(repoPath, nextUnverifiedStory.story_id, runIdPrefix) : null;
            if (altPr) {
              db.prepare("UPDATE stories SET pr_url = ?, updated_at = ? WHERE id = ?")
                .run(altPr, new Date().toISOString(), nextUnverifiedStory.id);
              logger.info(`[handleVerifyEach] Found alternative PR for ${nextUnverifiedStory.story_id}: ${altPr} (original CLOSED: ${prUrl})`, { runId: verifyStep.run_id });
              continue; // Re-check with updated PR on next iteration
            }
            // No alternative found — skip story
            db.prepare("UPDATE stories SET status = 'skipped', output = 'Skipped: CLOSED PR could not be reopened and no alternative PR found', updated_at = ? WHERE id = ?")
              .run(new Date().toISOString(), nextUnverifiedStory.id);
            logger.warn(`[handleVerifyEach] CLOSED PR ${prUrl} — no alternative found — skipping story ${nextUnverifiedStory.story_id}`, { runId: verifyStep.run_id });
            continue; // Check next story
          }
        }
      } catch (e) {
        // gh command failed — proceed with normal verify
        logger.warn(`PR state check failed for ${prUrl}: ${String(e)}`, { runId: verifyStep.run_id });
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

/**
 * Check if the loop has more stories; if so set loop step pending, otherwise done + advance.
 */
function checkLoopContinuation(runId: string, loopStepId: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();
  const pendingStory = findStoryByStatus(runId, "pending") as { id: string } | undefined;

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
          "UPDATE steps SET status = 'pending', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), loopStepId);
    }
    return { advanced: false, runCompleted: false };
  }

  // No pending stories — check if any are still running (parallel execution)
  const runningStory = findStoryByStatus(runId, "running") as { id: string } | undefined;

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
      const unverifiedStory = findStoryByStatus(runId, "done") as { id: string } | undefined;
      if (unverifiedStory) {
        // Stories need verification — set verify step to pending
        db.prepare(
          "UPDATE steps SET status = 'pending', updated_at = ? WHERE run_id = ? AND step_id = ? AND status IN ('waiting', 'done')"
        ).run(new Date().toISOString(), runId, lcForCheck.verifyStep);
        logger.info(`Loop has unverified stories — keeping verify active`, { runId });
        return { advanced: false, runCompleted: false };
      }
    }
  }

  const failedStory = findStoryByStatus(runId, "failed") as { id: string } | undefined;

  if (failedStory) {
    // v9.0: Skip failed stories instead of failing the loop — let remaining stories continue
    skipFailedStories(runId);
    const wfId = getWorkflowId(runId);
    emitEvent({ ts: new Date().toISOString(), event: "story.skipped", runId, workflowId: wfId, stepId: loopStepId, detail: "Failed stories skipped — loop continues" });
    // Fall through to mark loop done
  }

  // All stories verified/skipped — mark loop step done
// Early worktree cleanup: clean up .worktrees when implement loop finishes,  // not just when the entire run completes. Prevents stale worktree accumulation.  cleanupWorktrees(runId);
  db.prepare(
    "UPDATE steps SET status = 'done', updated_at = ? WHERE id = ?"
  ).run(new Date().toISOString(), loopStepId);

  // Also mark verify step done if it exists
  const loopStep = db.prepare("SELECT loop_config, run_id FROM steps WHERE id = ?").get(loopStepId) as { loop_config: string | null; run_id: string } | undefined;
  if (loopStep?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStep.loop_config);
    if (lc.verifyEach && lc.verifyStep) {
      db.prepare(
        "UPDATE steps SET status = 'done', updated_at = ? WHERE run_id = ? AND step_id = ?"
      ).run(new Date().toISOString(), runId, lc.verifyStep);
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
  const runSt = getRunStatus(runId);
  if (runSt === "failed" || runSt === "cancelled") {
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
        "UPDATE steps SET status = 'pending', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), next.id);
      db.exec("COMMIT");
      emitEvent({ ts: new Date().toISOString(), event: "pipeline.advanced", runId, workflowId: wfId, stepId: next.step_id });
      emitEvent({ ts: new Date().toISOString(), event: "step.pending", runId, workflowId: wfId, stepId: next.step_id });
      return { advanced: true, runCompleted: false };
    } else {
      completeRun(runId);
      db.exec("COMMIT");
      emitEvent({ ts: new Date().toISOString(), event: "run.completed", runId, workflowId: wfId });
      logger.info("Run completed", { runId, workflowId: wfId });
      archiveRunProgress(runId);
      cleanupWorktrees(runId);
      cleanupLocalBranches(runId);
      scheduleRunCronTeardown(runId);
      return { advanced: false, runCompleted: true };
    }
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch (e) { logger.warn(`[step-ops] ROLLBACK failed: ${String(e)}`, {}); }
    throw err;
  }
}

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
    const story = db.prepare(
      "SELECT id, retry_count, max_retries FROM stories WHERE id = ?"
    ).get(step.current_story_id) as { id: string; retry_count: number; max_retries: number } | undefined;

    if (story) {
      const storyRow = getStoryInfo(step.current_story_id);
      const newRetry = story.retry_count + 1;
      if (newRetry > story.max_retries) {
        // Story retries exhausted — clean up worktree
        if (storyRow?.story_id) {
          const ctx = getRunContext(step.run_id);
          if (ctx.repo) removeStoryWorktree(ctx.repo, storyRow.story_id, step.agent_id);
        }
        db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = ? WHERE id = ?").run(newRetry, new Date().toISOString(), story.id);
        db.prepare("UPDATE steps SET status = 'failed', output = ?, current_story_id = NULL, updated_at = ? WHERE id = ?").run(error, new Date().toISOString(), stepId);
        failRun(step.run_id);
        const wfId = getWorkflowId(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: stepId, storyId: storyRow?.story_id, storyTitle: storyRow?.title, detail: error });
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: stepId, detail: error });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story retries exhausted" });
        scheduleRunCronTeardown(step.run_id);
        return { retrying: false, runFailed: true };
      }

      // Retry the story — clean up worktree (will be recreated on next claim)
      if (storyRow?.story_id) {
        const ctx2 = getRunContext(step.run_id);
        if (ctx2.repo) removeStoryWorktree(ctx2.repo, storyRow.story_id, step.agent_id);
      }
      db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = ? WHERE id = ?").run(newRetry, new Date().toISOString(), story.id);
      db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), stepId);
      return { retrying: true, runFailed: false };
    }
  }

  // Single step: existing logic
  const newRetryCount = step.retry_count + 1;

  if (newRetryCount > step.max_retries) {
    db.prepare(
        "UPDATE steps SET status = 'failed', output = ?, retry_count = ?, updated_at = ? WHERE id = ?"
    ).run(error, newRetryCount, new Date().toISOString(), stepId);
    db.prepare(
        "UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), step.run_id);
    const wfId2 = getWorkflowId(step.run_id);
    emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: stepId, detail: error });
    emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: "Step retries exhausted" });
    scheduleRunCronTeardown(step.run_id);
    return { retrying: false, runFailed: true };
  } else {
    db.prepare(
        "UPDATE steps SET status = 'pending', retry_count = ?, updated_at = ? WHERE id = ?"
    ).run(newRetryCount, new Date().toISOString(), stepId);
    return { retrying: true, runFailed: false };
  }
}
