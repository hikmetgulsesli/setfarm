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

// ── Case-Variant Probe (Wave 15 Bug J) ──────────────────────────────

/**
 * When a story branch is empty (zero commits ahead of feature), check whether
 * the agent committed to a case-variant of the branch name. This happens when
 * the agent's prompt injected the story_id in its original case (US-001) while
 * setfarm's createStoryWorktree forced lowercase (us-001), and the agent ran
 * `git checkout -b` using the uppercase form instead of honoring the worktree.
 *
 * Returns the first non-empty variant found, or null.
 */
function findCaseVariantWithCommits(
  repoPath: string,
  storyBranch: string,
  featureBranch: string,
): { ref: string; commits: number } | null {
  const candidates: string[] = [];
  // Variant 1: uppercase the story-id suffix (last two dash segments).
  // Format: {runIdPrefix}-{storyKind}-{storyNum}  e.g.  cae03c94-us-001 → cae03c94-US-001
  const parts = storyBranch.split("-");
  if (parts.length >= 3) {
    const prefix = parts.slice(0, -2).join("-");
    const suffix = parts.slice(-2).join("-").toUpperCase();
    candidates.push(`${prefix}-${suffix}`);
  }
  // Variant 2: fully uppercase story-id portion only (handles hex prefixes safely)
  if (parts.length >= 2) {
    const prefix = parts.slice(0, -1).join("-");
    const last = parts[parts.length - 1].toUpperCase();
    const v = `${prefix}-${last}`;
    if (!candidates.includes(v)) candidates.push(v);
  }

  for (const cand of candidates) {
    if (cand === storyBranch) continue;
    // Resolve candidate: prefer local branch, fall back to origin/
    let ref: string | null = null;
    try {
      execFileSync("git", ["rev-parse", "--verify", cand], {
        cwd: repoPath, timeout: 3000, stdio: "pipe",
      });
      ref = cand;
    } catch { /* try remote */ }
    if (!ref) {
      try {
        execFileSync("git", ["rev-parse", "--verify", `origin/${cand}`], {
          cwd: repoPath, timeout: 3000, stdio: "pipe",
        });
        ref = `origin/${cand}`;
      } catch { continue; }
    }
    try {
      const out = execFileSync("git", ["rev-list", "--count", `${featureBranch}..${ref}`], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      const count = parseInt(out, 10) || 0;
      if (count > 0) return { ref, commits: count };
    } catch { /* continue to next variant */ }
  }
  return null;
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

  // Wave 13 Bug I (run #344 postmortem): reject empty story branches BEFORE merge.
  // If the agent never committed real work, story_branch has zero commits ahead of
  // the feature branch. `git merge` on such a branch returns "Already up to date"
  // and we used to treat that as success — which is what let #344 report "2 merged"
  // while the feature branch still only held the scaffold. rev-list --count catches
  // it up front so the story is marked failed and the Wave 8 Bug A guardrail picks
  // it up with an actionable message.
  let commitsAhead = 0;
  try {
    const rlOut = execFileSync("git", ["rev-list", "--count", `${featureBranch}..${mergeTarget}`], {
      cwd: repoPath, timeout: 5000, stdio: "pipe",
    }).toString().trim();
    commitsAhead = parseInt(rlOut, 10) || 0;
  } catch (e) {
    // rev-list can fail for unrelated histories; fall through to merge and let
    // the post-merge SHA check catch a no-op.
    logger.warn(`[merge-queue] rev-list failed for ${storyBranch}: ${String(e).slice(0, 150)}`);
  }
  if (commitsAhead === 0) {
    // Wave 15 Bug J (run #480 postmortem): agents may commit to a case-variant
    // branch (e.g. setfarm created `cae03c94-us-001` lowercase, but agent ran
    // `git checkout -b cae03c94-US-001` preserving PRD story-id case). Probe
    // known variants before giving up — if a non-empty variant exists, merge it.
    const variant = findCaseVariantWithCommits(repoPath, storyBranch, featureBranch);
    if (variant) {
      logger.warn(`[merge-queue] case-variant rescue: ${storyBranch} empty, merging ${variant.ref} (${variant.commits} commits ahead)`);
      mergeTarget = variant.ref;
      commitsAhead = variant.commits;
    } else {
      logger.warn(`[merge-queue] ${storyBranch} has zero commits ahead of ${featureBranch} — agent did not commit any story work`);
      return { success: false, conflicts: [`empty-branch:${storyBranch}`] };
    }
  }

  // Capture feature branch HEAD BEFORE the merge so we can detect no-op merges
  // (e.g. story branch diverged on non-tracked files only, or --ff resolved to
  // an identity merge). A successful merge must advance the feature HEAD.
  let headBefore = "";
  try {
    headBefore = execFileSync("git", ["rev-parse", featureBranch], {
      cwd: repoPath, timeout: 5000, stdio: "pipe",
    }).toString().trim();
  } catch { /* push/verify still catches the outright failure case */ }

  try {
    // Merge with --no-ff to preserve story boundary
    execFileSync("git", ["merge", "--no-ff", mergeTarget, "-m", commitMessage], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });

    // Wave 13 Bug I post-merge guard: feature HEAD must have advanced.
    if (headBefore) {
      const headAfter = execFileSync("git", ["rev-parse", featureBranch], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      if (headAfter === headBefore) {
        logger.error(`[merge-queue] no-op merge: ${featureBranch} HEAD unchanged after merging ${storyBranch}`);
        return { success: false, conflicts: [`no-op-merge:${storyBranch}`] };
      }
    }

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

    // CONFLICT AUTO-RESOLVE (run #338 fix): story branches diverge from baseline and
    // conflict on scaffolder files. The story branch is the latest version of the work
    // for its scope, so prefer its side. Retry with -X theirs before giving up.
    try {
      logger.warn(`[merge-queue] Conflict on ${storyBranch}, retrying with -X theirs (conflicts: ${conflicts.join(", ").slice(0, 200)})`);
      execFileSync("git", ["merge", "--no-ff", "-X", "theirs", mergeTarget, "-m", commitMessage], {
        cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
      });
      // Wave 13 Bug I post-merge guard (also in retry path): feature HEAD must advance.
      if (headBefore) {
        const headAfterRetry = execFileSync("git", ["rev-parse", featureBranch], {
          cwd: repoPath, timeout: 5000, stdio: "pipe",
        }).toString().trim();
        if (headAfterRetry === headBefore) {
          logger.error(`[merge-queue] no-op merge (retry path): ${featureBranch} HEAD unchanged after -X theirs merging ${storyBranch}`);
          return { success: false, conflicts: [`no-op-merge:${storyBranch}`] };
        }
      }
      execFileSync("git", ["push", "origin", featureBranch], {
        cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
      });
      logger.info(`[merge-queue] Conflict auto-resolved with -X theirs for ${storyBranch}`);
      return { success: true, conflicts: [] };
    } catch (retryErr) {
      // Even -X theirs couldn't resolve (likely delete/modify or add/add with no base)
      try { execFileSync("git", ["merge", "--abort"], { cwd: repoPath, timeout: 5000, stdio: "pipe" }); } catch { /* ignore */ }
      logger.error(`[merge-queue] -X theirs retry also failed for ${storyBranch}: ${String(retryErr).slice(0, 200)}`);
      return { success: false, conflicts };
    }
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

    const storyBranch = (story.story_branch || `${runId.slice(0, 8)}-${story.story_id}`).toLowerCase();
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
      // Run #338 fix: previously conflict only set merge_status, leaving story.status='done'.
      // That let the pipeline silently proceed to deploy with partial work. Now mark the
      // story as 'failed' so the "fail run if any story failed" guardrail (96dd442) catches
      // it and surfaces the conflict as a run failure instead of burying it in the DB.
      result.conflicted.push(story.story_id);
      await pgRun(
        "UPDATE stories SET merge_status = 'conflict', status = 'failed', output = COALESCE(output, '') || E'\\n\\nMERGE_CONFLICT: ' || $3, updated_at = $1 WHERE id = $2",
        [now(), story.id, mergeResult.conflicts.join(", ")],
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
        } catch (e) { logger.warn(`[merge-queue] Could not find existing PR: ${String(e).slice(0, 100)}`, { runId }); }
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
