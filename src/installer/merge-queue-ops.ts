/**
 * Merge Queue Operations (merge-queue-ops.ts)
 *
 * Handles the "direct-merge" strategy: instead of per-story PRs,
 * story branches are merged sequentially into the feature branch,
 * then a single PR is created from feature → main.
 */

import { execFileSync } from "node:child_process";
import { pgQuery, pgRun, pgGet, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { emitEvent } from "./events.js";
import { getWorkflowId, getRunContext, updateRunContext } from "./repo.js";
import { GIT_LONG_TIMEOUT, GH_CLI_TIMEOUT, GH_MERGE_TIMEOUT } from "./constants.js";

// ── Types ────────────────────────────────────────────────────────────

export interface MergeResult {
  success: boolean;
  conflicts: string[];
}

export interface MergeQueueResult {
  merged: string[];
  conflicted: string[];
  skipped: string[];
  prUrl: string | null;
}

// ── Single Story Merge ──────────────────────────────────────────────

/**
 * Merge a single story branch into the feature branch using --no-ff.
 * Returns success/failure and any conflict file list.
 */
export function mergeStoryIntoFeature(
  repoPath: string,
  storyBranch: string,
  featureBranch: string,
  commitMessage: string,
): MergeResult {
  try {
    // Ensure we're on the feature branch and up to date
    execFileSync("git", ["checkout", featureBranch], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });
    execFileSync("git", ["pull", "origin", featureBranch, "--ff-only"], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });
  } catch (e) {
    logger.warn(`[merge-queue] Failed to checkout/pull ${featureBranch}: ${String(e)}`);
    // Try reset to origin if pull fails
    try {
      execFileSync("git", ["reset", "--hard", `origin/${featureBranch}`], {
        cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
      });
    } catch {
      return { success: false, conflicts: [`Cannot sync ${featureBranch}`] };
    }
  }

  // Try to fetch story branch — track whether remote version exists
  let remoteAvailable = true;
  try {
    execFileSync("git", ["fetch", "origin", storyBranch], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });
  } catch {
    // Branch may not exist on remote (local-only worktree)
    remoteAvailable = false;
    logger.warn(`[merge-queue] Cannot fetch ${storyBranch}, trying local merge`);
  }

  // BUG FIX: Resolve merge target correctly — previously always used origin/ prefix
  // even when fetch failed, causing "branch not found" to be reported as conflict.
  let mergeTarget = remoteAvailable ? `origin/${storyBranch}` : storyBranch;
  if (!remoteAvailable) {
    // Verify local branch exists before attempting merge
    try {
      execFileSync("git", ["rev-parse", "--verify", storyBranch], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      });
    } catch {
      logger.warn(`[merge-queue] Local branch ${storyBranch} also missing — skipping merge`);
      return { success: false, conflicts: [`branch-missing:${storyBranch}`] };
    }
  }

  try {
    // Merge with --no-ff to preserve story boundary
    execFileSync("git", ["merge", "--no-ff", mergeTarget, "-m", commitMessage], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });

    // Push the merged feature branch
    execFileSync("git", ["push", "origin", featureBranch], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });

    return { success: true, conflicts: [] };
  } catch (mergeErr) {
    // Merge failed — collect conflict files
    let conflicts: string[] = [];
    try {
      const diffOutput = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      conflicts = diffOutput.split("\n").filter(Boolean);
    } catch { /* ignore */ }

    // Abort the failed merge
    try {
      execFileSync("git", ["merge", "--abort"], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      });
    } catch { /* ignore */ }

    return { success: false, conflicts };
  }
}

// ── Merge Queue Runner ──────────────────────────────────────────────

/**
 * Run the merge queue for a completed run:
 * 1. Get all stories ordered by story_index
 * 2. Merge each "done" story sequentially into feature branch
 * 3. Create a single PR from feature → main
 */
export async function runMergeQueue(
  runId: string,
  repoPath: string,
  featureBranch: string,
): Promise<MergeQueueResult> {
  const result: MergeQueueResult = { merged: [], conflicted: [], skipped: [], prUrl: null };
  const wfId = await getWorkflowId(runId);

  logger.info(`[merge-queue] Starting merge queue for run ${runId}`, { runId });

  // Fetch all remote branches
  try {
    execFileSync("git", ["fetch", "origin", "--prune"], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });
  } catch (e) {
    logger.warn(`[merge-queue] git fetch failed: ${String(e)}`, { runId });
  }

  // Get all stories ordered by index
  const stories = await pgQuery<{
    id: string; story_id: string; title: string; status: string;
    story_branch: string; merge_status: string;
  }>(
    "SELECT id, story_id, title, status, story_branch, COALESCE(merge_status, 'pending') as merge_status FROM stories WHERE run_id = $1 ORDER BY story_index ASC",
    [runId],
  );

  for (const story of stories) {
    // Skip stories that aren't done or already merged
    if (story.status !== "done" && story.status !== "verified") {
      result.skipped.push(story.story_id);
      logger.info(`[merge-queue] Skipping ${story.story_id} (status: ${story.status})`, { runId });
      continue;
    }

    if (story.merge_status === "merged") {
      result.merged.push(story.story_id);
      logger.info(`[merge-queue] Already merged: ${story.story_id}`, { runId });
      continue;
    }

    const storyBranch = story.story_branch || `${runId.slice(0, 8)}-${story.story_id}`;
    const commitMsg = `merge: ${story.story_id} - ${story.title}`;

    logger.info(`[merge-queue] Merging ${story.story_id} (${storyBranch} → ${featureBranch})`, { runId });

    const mergeResult = mergeStoryIntoFeature(repoPath, storyBranch, featureBranch, commitMsg);

    if (mergeResult.success) {
      result.merged.push(story.story_id);
      await pgRun(
        "UPDATE stories SET merge_status = 'merged', status = 'verified', updated_at = $1 WHERE id = $2",
        [now(), story.id],
      );
      emitEvent({
        ts: now(), event: "story.verified", runId, workflowId: wfId,
        storyId: story.story_id, storyTitle: story.title,
        detail: `Direct-merged into ${featureBranch}`,
      });
      logger.info(`[merge-queue] Merged: ${story.story_id}`, { runId });
    } else {
      result.conflicted.push(story.story_id);
      await pgRun(
        "UPDATE stories SET merge_status = 'conflict', updated_at = $1 WHERE id = $2",
        [now(), story.id],
      );
      logger.warn(`[merge-queue] Conflict on ${story.story_id}: ${mergeResult.conflicts.join(', ')}`, { runId });
      emitEvent({
        ts: now(), event: "story.failed", runId, workflowId: wfId,
        storyId: story.story_id, storyTitle: story.title,
        detail: `Merge conflict: ${mergeResult.conflicts.join(', ')}`,
      });
    }
  }

  // Create single PR from feature → main
  if (result.merged.length > 0) {
    try {
      // Get task name for PR title
      const runRow = await pgGet<{ task: string }>("SELECT task FROM runs WHERE id = $1", [runId]);
      const taskLines = (runRow?.task || "").split("\n");
      const projectLine = taskLines.find(l => l.startsWith("Proje:")) || taskLines[0] || "Feature";
      const projectName = projectLine.replace(/^Proje:\s*/, "").trim();

      const prBody = [
        "## Summary",
        `Automated merge of ${result.merged.length} stories into \`${featureBranch}\`.`,
        "",
        "### Merged Stories",
        ...result.merged.map(s => `- ${s}`),
        ...(result.conflicted.length > 0 ? [
          "",
          "### Conflicts (skipped)",
          ...result.conflicted.map(s => `- ${s}`),
        ] : []),
        ...(result.skipped.length > 0 ? [
          "",
          "### Skipped",
          ...result.skipped.map(s => `- ${s}`),
        ] : []),
      ].join("\n");

      const prUrl = execFileSync("gh", [
        "pr", "create",
        "--base", "main",
        "--head", featureBranch,
        "--title", `feat: ${projectName}`,
        "--body", prBody,
      ], {
        cwd: repoPath, timeout: GH_MERGE_TIMEOUT, stdio: "pipe",
      }).toString().trim();

      result.prUrl = prUrl;
      logger.info(`[merge-queue] Created PR: ${prUrl}`, { runId });

      // Save PR URL in run context
      const context = await getRunContext(runId);
      context["final_pr"] = prUrl;
      await updateRunContext(runId, context);

    } catch (prErr) {
      // PR may already exist
      const errStr = String(prErr);
      if (errStr.includes("already exists")) {
        try {
          const existingPr = execFileSync("gh", [
            "pr", "list", "--head", featureBranch, "--base", "main",
            "--state", "open", "--json", "url", "--jq", ".[0].url",
          ], {
            cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe",
          }).toString().trim();
          if (existingPr) {
            result.prUrl = existingPr;
            const context = await getRunContext(runId);
            context["final_pr"] = existingPr;
            await updateRunContext(runId, context);
            logger.info(`[merge-queue] Using existing PR: ${existingPr}`, { runId });
          }
        } catch { /* ignore */ }
      } else {
        logger.error(`[merge-queue] Failed to create PR: ${errStr}`, { runId });
      }
    }
  }

  logger.info(`[merge-queue] Done — merged: ${result.merged.length}, conflicts: ${result.conflicted.length}, skipped: ${result.skipped.length}`, { runId });

  // Conflict threshold: if majority of stories conflicted, something is fundamentally wrong
  if (result.conflicted.length > 0 && result.conflicted.length >= result.merged.length) {
    throw new Error(`[merge-queue] Too many conflicts (${result.conflicted.length}/${result.conflicted.length + result.merged.length}) — aborting`);
  }

  return result;
}
