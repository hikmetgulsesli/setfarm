/**
 * PR State Resolution (pr-state.ts)
 *
 * Extracted from step-ops.ts — centralizes all PR state checking logic.
 * Previously duplicated in 3 places: claim-auto-complete, claim-auto-verify, handleVerifyEach.
 */

import { execFileSync } from "node:child_process";
import { logger } from "../lib/logger.js";
import { GH_CLI_TIMEOUT, GH_MERGE_TIMEOUT } from "./constants.js";

// ── Types ────────────────────────────────────────────────────────────

export type PRState = "MERGED" | "OPEN" | "CLOSED" | "UNKNOWN";

export interface PRStateResult {
  /** Raw state from gh CLI */
  state: PRState;
  /** PR exists and is deliverable (MERGED or OPEN) */
  isDeliverable: boolean;
  /** PR was reopened from CLOSED state */
  wasReopened: boolean;
  /** Alternative PR URL found (when original was CLOSED and reopen failed) */
  alternativePrUrl: string | null;
  /** Story content already merged into base branch (CLOSED PR but code delivered) */
  contentInBaseBranch: boolean;
}

// ── Core: Get PR State ───────────────────────────────────────────────

/**
 * Get the current state of a PR via gh CLI.
 */
export function getPRState(prUrl: string): PRState {
  try {
    const state = execFileSync("gh", ["pr", "view", prUrl, "--json", "state", "--jq", ".state"], {
      timeout: GH_CLI_TIMEOUT, stdio: "pipe"
    }).toString().trim();
    if (state === "MERGED" || state === "OPEN" || state === "CLOSED") return state;
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

// ── Reopen CLOSED PR ─────────────────────────────────────────────────

/**
 * Attempt to reopen a CLOSED PR. Returns true if successful.
 */
export function tryReopenPR(prUrl: string, storyId: string, runId: string): boolean {
  try {
    execFileSync("gh", ["pr", "reopen", prUrl], { timeout: GH_CLI_TIMEOUT, stdio: "pipe" });
    logger.info(`[pr-state] Reopened CLOSED PR for story ${storyId}: ${prUrl}`, { runId });
    return true;
  } catch (err) {
    logger.warn(`[pr-state] Cannot reopen CLOSED PR ${prUrl} for story ${storyId}: ${String(err)}`, { runId });
    return false;
  }
}

// ── Auto-Merge OPEN PR ──────────────────────────────────────────────

/**
 * Attempt to squash-merge an OPEN PR. Returns true if successful.
 */
export function tryAutoMergePR(prUrl: string, storyId: string, runId: string): boolean {
  try {
    execFileSync("gh", ["pr", "merge", prUrl, "--squash", "--delete-branch"], {
      timeout: GH_MERGE_TIMEOUT, stdio: "pipe"
    });
    logger.info(`[pr-state] Auto-merged PR for story ${storyId}: ${prUrl}`, { runId });
    return true;
  } catch (err) {
    logger.warn(`[pr-state] Auto-merge failed for ${prUrl}: ${String(err)}`, { runId });
    return false;
  }
}

// ── Search PR by Branch Name ─────────────────────────────────────────

/**
 * Search for a PR by branch name — first merged, then open.
 * Returns the PR URL if found, null otherwise.
 */
export function findPrByBranch(repoPath: string, branch: string): string | null {
  try {
    let url = execFileSync("gh", ["pr", "list", "--head", branch, "--state", "merged", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe"
    }).toString().trim();
    if (url) return url;
    url = execFileSync("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe"
    }).toString().trim();
    return url || null;
  } catch {
    return null;
  }
}

// ── Search for Alternative PR ────────────────────────────────────────

/**
 * Search for an alternative merged/open PR when the recorded PR is CLOSED.
 * Developer retries often create a new branch (e.g. US-005-v2) with a new PR,
 * but the DB still points to the old CLOSED PR. This searches by story branch
 * pattern to find the actual deliverable.
 */
export function findAlternativePR(repoPath: string, storyId: string, runIdPrefix: string): string | null {
  const baseBranch = `${runIdPrefix}-${storyId}`;
  try {
    // First: search for merged PRs matching the story ID in the title or branch
    let foundUrl = execFileSync("gh", ["pr", "list", "--search", `${storyId} in:title`, "--state", "merged", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe"
    }).toString().trim();
    if (foundUrl) return foundUrl;

    // Second: search for open PRs matching the story ID
    foundUrl = execFileSync("gh", ["pr", "list", "--search", `${storyId} in:title`, "--state", "open", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe"
    }).toString().trim();
    if (foundUrl) return foundUrl;

    // Third: search by base branch name pattern
    foundUrl = execFileSync("gh", ["pr", "list", "--search", `head:${baseBranch}`, "--state", "merged", "--json", "url", "--jq", ".[0].url"], {
      cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe"
    }).toString().trim();
    if (foundUrl) return foundUrl;
  } catch (ghErr: any) {
    logger.debug("gh PR search failed: " + (ghErr?.message || "unknown"));
  }
  return null;
}

// ── Check if Story Content is in Base Branch ─────────────────────────

/**
 * Check if a story branch's changes are already present in a target branch.
 * Used when a PR is CLOSED (e.g., GitHub auto-closed it when base branch was merged/deleted).
 * Uses the PR's head commit SHA to check ancestry — if the head SHA is an ancestor of target,
 * the story's code is already delivered.
 */
export function isStoryContentInBranch(repoPath: string, prUrl: string, targetBranches: string[]): boolean {
  try {
    // Get the closed PR's head commit SHA
    const headSha = execFileSync("gh", ["pr", "view", prUrl, "--json", "headRefOid", "--jq", ".headRefOid"], {
      cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe"
    }).toString().trim();
    if (!headSha || headSha.length < 7) return false;

    // Fetch latest refs
    execFileSync("git", ["fetch", "origin", "--prune"], { cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe" });

    // Check if headSha is ancestor of any target branch
    for (const target of targetBranches) {
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", headSha, "origin/" + target], {
          cwd: repoPath, timeout: 10000, stdio: "pipe"
        });
        return true; // headSha is ancestor of target = changes are in target
      } catch {
        // Not ancestor of this branch, try next
      }
    }
    return false;
  } catch (e) {
    logger.debug("[isStoryContentInBranch] Check failed: " + String(e));
    return false;
  }
}

// ── Unified: Resolve CLOSED PR ───────────────────────────────────────

export interface ResolveClosedResult {
  /** Found an alternative PR URL */
  alternativePrUrl: string | null;
  /** Story content is already in base branch — safe to auto-verify */
  contentInBaseBranch: boolean;
  /** PR was successfully reopened */
  reopened: boolean;
}

/**
 * Handle a CLOSED PR: try reopen → search alternative → check content in base branch.
 * Unified logic previously duplicated in claim-auto-verify and handleVerifyEach.
 */
export function resolveClosedPR(
  prUrl: string,
  storyId: string,
  runId: string,
  repoPath: string,
  runIdPrefix: string,
  baseBranches: string[],
): ResolveClosedResult {
  // Step 1: Try to reopen
  if (tryReopenPR(prUrl, storyId, runId)) {
    return { alternativePrUrl: null, contentInBaseBranch: false, reopened: true };
  }

  // Step 2: Search for alternative merged/open PR
  const altPr = repoPath ? findAlternativePR(repoPath, storyId, runIdPrefix) : null;
  if (altPr) {
    return { alternativePrUrl: altPr, contentInBaseBranch: false, reopened: false };
  }

  // Step 3: Check if content is already in base branch
  if (repoPath && isStoryContentInBranch(repoPath, prUrl, baseBranches)) {
    return { alternativePrUrl: null, contentInBaseBranch: true, reopened: false };
  }

  // Nothing worked — story content is truly missing
  return { alternativePrUrl: null, contentInBaseBranch: false, reopened: false };
}
