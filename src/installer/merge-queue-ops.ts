import type postgres from "postgres";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { readRegularFileAtMostSync } from "../lib/bounded-file-read.js";
import { V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS } from "../execution/v3-source-snapshot-v2.js";
import { authenticateNativeEvidenceContinuationOwner,readNativeEvidenceOnlySuccessAuthority,
  type NativeEvidenceContinuationOwner } from "../recovery/v3-evidence-only-publication.js";
import { getSql as nativeEvidenceSql } from "../db-pg.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJsonStringify,hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";
import { RuntimeCompletionPlanV1Schema } from "../execution/schemas/runtime-completion-plan-v1.js";
import { V3ImplementationAgentOutputV1Schema } from "../execution/v3-implementation-output.js";
import { currentRuntimeCompletionOwnerCapability } from "../execution/runtime-completion-owner-context.js";
import { createNativeV3ImplementationContextService } from "../execution/v3-native-implementation-attempt.js";
import { resolveProductArtifactDir, resolveProductArtifactCapacity } from "../runtime-config.js";
import { EvidenceBundleV2Schema,computeEvidenceBundleHash } from "../evidence/evidence-bundle-v2.js";

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

export interface GitAncestryProof {
  schema: "setfarm.git-ancestry-proof.v1";
  sourceSha: string;
  sourceCommitSha: string | null;
  targetRef: string;
  targetCommitSha: string | null;
  outcome: "ancestor" | "not_ancestor" | "unresolvable";
  reason: string;
}

export interface StoryMergeReconciliation {
  schema: "setfarm.story-merge-reconciliation.v1";
  status: "reconciled" | "not_applied" | "indeterminate";
  success: boolean;
  proof: GitAncestryProof;
}

export interface ExactSourceMergeResult extends MergeResult {
  schema: "setfarm.exact-source-merge-result.v1";
  resolution: "applied" | "reconciled" | "failed";
  proof: GitAncestryProof;
  error: string;
}

export interface FinalPullRequestIdentity {
  repository: string;
  headBranch: string;
  baseBranch: string;
}

export interface FinalPullRequestMatch extends FinalPullRequestIdentity {
  url: string;
  number: number;
  state: "OPEN" | "MERGED" | "CLOSED" | "UNKNOWN";
}

export interface FinalPullRequestLookupResult {
  schema: "setfarm.final-pull-request-lookup.v1";
  status: "found" | "not_found" | "ambiguous" | "error";
  identity: FinalPullRequestIdentity;
  pullRequest: FinalPullRequestMatch | null;
  candidates: FinalPullRequestMatch[];
  error: string;
}

export interface FinalPullRequestEnsureResult {
  schema: "setfarm.final-pull-request-ensure.v1";
  success: boolean;
  action: "existing" | "created" | "reconciled_after_create_error" | "failed";
  identity: FinalPullRequestIdentity;
  pullRequest: FinalPullRequestMatch | null;
  error: string;
}

function compactCommandError(error: unknown): string {
  const candidate = error as { message?: unknown; stderr?: unknown };
  const stderr = Buffer.isBuffer(candidate?.stderr)
    ? candidate.stderr.toString("utf8")
    : String(candidate?.stderr ?? "");
  return (stderr || String(candidate?.message ?? error ?? "unknown command error"))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000);
}

function commandExitStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function resolveCommitSha(repoPath: string, revision: string): string | null {
  try {
    const sha = execFileSync(
      "git",
      ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`],
      { cwd: repoPath, timeout: 5_000, stdio: "pipe", encoding: "utf8" },
    ).trim().toLowerCase();
    return /^[a-f0-9]{40,64}$/.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

/**
 * Resolve both sides to immutable commit ids and prove whether the exact source
 * commit is contained by the requested target. This never fetches or mutates
 * the repository; callers choose the authoritative target ref explicitly.
 */
export function proveExactCommitAncestor(
  repoPath: string,
  sourceSha: string,
  targetRef: string,
): GitAncestryProof {
  const normalizedSource = sourceSha.trim().toLowerCase();
  const normalizedTarget = targetRef.trim();
  const base = {
    schema: "setfarm.git-ancestry-proof.v1" as const,
    sourceSha: normalizedSource,
    sourceCommitSha: null,
    targetRef: normalizedTarget,
    targetCommitSha: null,
  };
  if (!/^[a-f0-9]{40,64}$/.test(normalizedSource)) {
    return { ...base, outcome: "unresolvable", reason: "source-sha-invalid" };
  }
  if (!normalizedTarget) {
    return { ...base, outcome: "unresolvable", reason: "target-ref-missing" };
  }
  const sourceCommitSha = resolveCommitSha(repoPath, normalizedSource);
  if (!sourceCommitSha) {
    return { ...base, outcome: "unresolvable", reason: "source-commit-unresolvable" };
  }
  const targetCommitSha = resolveCommitSha(repoPath, normalizedTarget);
  if (!targetCommitSha) {
    return {
      ...base,
      sourceCommitSha,
      outcome: "unresolvable",
      reason: "target-commit-unresolvable",
    };
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sourceCommitSha, targetCommitSha], {
      cwd: repoPath,
      timeout: 10_000,
      stdio: "pipe",
    });
    return {
      ...base,
      sourceCommitSha,
      targetCommitSha,
      outcome: "ancestor",
      reason: "exact-source-is-ancestor",
    };
  } catch (error) {
    if (commandExitStatus(error) === 1) {
      return {
        ...base,
        sourceCommitSha,
        targetCommitSha,
        outcome: "not_ancestor",
        reason: "exact-source-is-not-ancestor",
      };
    }
    return {
      ...base,
      sourceCommitSha,
      targetCommitSha,
      outcome: "unresolvable",
      reason: `ancestry-check-failed:${compactCommandError(error)}`,
    };
  }
}

/**
 * Crash-safe reconciliation for a single story merge effect. An exact source
 * commit already reachable from the target is success, even when replaying the
 * merge command itself would now report an empty/no-op branch.
 */
export function reconcileStoryMerge(input: Readonly<{
  repoPath: string;
  sourceSha: string;
  targetRef: string;
}>): StoryMergeReconciliation {
  const proof = proveExactCommitAncestor(input.repoPath, input.sourceSha, input.targetRef);
  if (proof.outcome === "ancestor") {
    return {
      schema: "setfarm.story-merge-reconciliation.v1",
      status: "reconciled",
      success: true,
      proof,
    };
  }
  if (proof.outcome === "not_ancestor") {
    return {
      schema: "setfarm.story-merge-reconciliation.v1",
      status: "not_applied",
      success: false,
      proof,
    };
  }
  return {
    schema: "setfarm.story-merge-reconciliation.v1",
    status: "indeterminate",
    success: false,
    proof,
  };
}

/**
 * Merge one immutable source commit into a feature branch and prove that the
 * exact commit is published to origin. The source branch is never rebased or
 * force-pushed, so completion evidence remains bound to the reviewed SHA.
 */
export function mergeExactSourceIntoFeature(input: Readonly<{
  repoPath: string;
  sourceSha: string;
  featureBranch: string;
  commitMessage: string;
}>): ExactSourceMergeResult {
  const featureBranch = input.featureBranch.trim();
  const sourceSha = input.sourceSha.trim().toLowerCase();
  const unresolved = proveExactCommitAncestor(input.repoPath, sourceSha, `origin/${featureBranch}`);
  const failed = (error: string, conflicts: string[] = [], proof = unresolved): ExactSourceMergeResult => ({
    schema: "setfarm.exact-source-merge-result.v1",
    success: false,
    resolution: "failed",
    conflicts,
    proof,
    error,
  });
  if (!/^[a-f0-9]{40,64}$/.test(sourceSha)) {
    return failed("EXACT_SOURCE_MERGE_SOURCE_INVALID");
  }
  if (!featureBranch) return failed("EXACT_SOURCE_MERGE_FEATURE_BRANCH_MISSING");
  try {
    execFileSync("git", ["check-ref-format", "--branch", featureBranch], {
      cwd: input.repoPath,
      timeout: 5_000,
      stdio: "pipe",
    });
  } catch (error) {
    return failed(`EXACT_SOURCE_MERGE_FEATURE_BRANCH_INVALID:${compactCommandError(error)}`);
  }
  if (!resolveCommitSha(input.repoPath, sourceSha)) {
    return failed("EXACT_SOURCE_MERGE_SOURCE_UNRESOLVABLE");
  }

  try {
    execFileSync("git", ["fetch", "origin", featureBranch], {
      cwd: input.repoPath,
      timeout: GIT_LONG_TIMEOUT,
      stdio: "pipe",
    });
  } catch (error) {
    return failed(`EXACT_SOURCE_MERGE_FETCH_FAILED:${compactCommandError(error)}`);
  }
  const publishedBefore = reconcileStoryMerge({
    repoPath: input.repoPath,
    sourceSha,
    targetRef: `origin/${featureBranch}`,
  });
  if (publishedBefore.status === "reconciled") {
    return {
      schema: "setfarm.exact-source-merge-result.v1",
      success: true,
      resolution: "reconciled",
      conflicts: [],
      proof: publishedBefore.proof,
      error: "",
    };
  }
  if (publishedBefore.status === "indeterminate") {
    return failed("EXACT_SOURCE_MERGE_REMOTE_PROOF_INDETERMINATE", [], publishedBefore.proof);
  }

  try {
    execFileSync("git", ["checkout", featureBranch], {
      cwd: input.repoPath,
      timeout: GIT_LONG_TIMEOUT,
      stdio: "pipe",
    });
    execFileSync("git", ["pull", "origin", featureBranch, "--ff-only"], {
      cwd: input.repoPath,
      timeout: GIT_LONG_TIMEOUT,
      stdio: "pipe",
    });
    const localProof = reconcileStoryMerge({
      repoPath: input.repoPath,
      sourceSha,
      targetRef: featureBranch,
    });
    if (localProof.status === "indeterminate") {
      return failed("EXACT_SOURCE_MERGE_LOCAL_PROOF_INDETERMINATE", [], localProof.proof);
    }
    if (localProof.status === "not_applied") {
      try {
        execFileSync("git", ["merge", "--no-ff", sourceSha, "-m", input.commitMessage], {
          cwd: input.repoPath,
          timeout: GIT_LONG_TIMEOUT,
          stdio: "pipe",
        });
      } catch (mergeError) {
        let conflicts: string[] = [];
        try {
          conflicts = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], {
            cwd: input.repoPath,
            timeout: 5_000,
            stdio: "pipe",
            encoding: "utf8",
          }).trim().split("\n").filter(Boolean);
        } catch {
          // The command diagnostic remains sufficient when conflict enumeration fails.
        }
        try {
          execFileSync("git", ["merge", "--abort"], {
            cwd: input.repoPath,
            timeout: 5_000,
            stdio: "pipe",
          });
        } catch {
          // No merge state may exist when git rejected before starting.
        }
        return failed(
          `EXACT_SOURCE_MERGE_CONFLICT:${compactCommandError(mergeError)}`,
          conflicts,
          localProof.proof,
        );
      }
    }

    try {
      execFileSync("git", ["push", "origin", `${featureBranch}:${featureBranch}`], {
        cwd: input.repoPath,
        timeout: GIT_LONG_TIMEOUT,
        stdio: "pipe",
      });
    } catch (pushError) {
      // The remote can accept the update before transport failure is reported;
      // exact remote ancestry below is the only success authority.
      logger.warn(`[merge-queue] exact source push returned an error; reconciling remote: ${compactCommandError(pushError)}`);
    }
    try {
      execFileSync("git", ["fetch", "origin", featureBranch], {
        cwd: input.repoPath,
        timeout: GIT_LONG_TIMEOUT,
        stdio: "pipe",
      });
    } catch (fetchError) {
      return failed(`EXACT_SOURCE_MERGE_POST_PUSH_FETCH_FAILED:${compactCommandError(fetchError)}`);
    }
    const published = reconcileStoryMerge({
      repoPath: input.repoPath,
      sourceSha,
      targetRef: `origin/${featureBranch}`,
    });
    if (published.status !== "reconciled") {
      return failed(
        `EXACT_SOURCE_MERGE_REMOTE_PUBLICATION_${published.status.toUpperCase()}`,
        [],
        published.proof,
      );
    }
    return {
      schema: "setfarm.exact-source-merge-result.v1",
      success: true,
      resolution: "applied",
      conflicts: [],
      proof: published.proof,
      error: "",
    };
  } catch (error) {
    return failed(`EXACT_SOURCE_MERGE_FAILED:${compactCommandError(error)}`);
  }
}

function resolveGithubRepository(repoPath: string): string | null {
  try {
    const repository = execFileSync(
      "gh",
      ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
      { cwd: repoPath, timeout: GH_CLI_TIMEOUT, stdio: "pipe", encoding: "utf8" },
    ).trim();
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ? repository : null;
  } catch {
    return null;
  }
}

function normalizePullRequestState(value: unknown): FinalPullRequestMatch["state"] {
  const state = String(value ?? "").toUpperCase();
  return state === "OPEN" || state === "MERGED" || state === "CLOSED" ? state : "UNKNOWN";
}

function pullRequestStateRank(state: FinalPullRequestMatch["state"]): number {
  if (state === "OPEN") return 0;
  if (state === "MERGED") return 1;
  if (state === "CLOSED") return 2;
  return 3;
}

function pullRequestFromUrl(
  identity: FinalPullRequestIdentity,
  url: string,
): FinalPullRequestMatch | null {
  try {
    const parsed = new URL(url);
    const expectedPath = `/${identity.repository.toLowerCase()}/pull/`;
    if (parsed.hostname.toLowerCase() !== "github.com") return null;
    if (!parsed.pathname.toLowerCase().startsWith(expectedPath)) return null;
    const number = Number(parsed.pathname.slice(expectedPath.length).split("/")[0]);
    if (!Number.isInteger(number) || number <= 0) return null;
    return { ...identity, url: parsed.toString(), number, state: "OPEN" };
  } catch {
    return null;
  }
}

/** Find a usable final PR by exact repository, head branch, and base branch. */
export function findFinalPullRequestByIdentity(input: Readonly<{
  repoPath: string;
  headBranch: string;
  baseBranch: string;
}>): FinalPullRequestLookupResult {
  const headBranch = input.headBranch.trim();
  const baseBranch = input.baseBranch.trim();
  const unresolvedIdentity: FinalPullRequestIdentity = {
    repository: "",
    headBranch,
    baseBranch,
  };
  if (!headBranch || !baseBranch) {
    return {
      schema: "setfarm.final-pull-request-lookup.v1",
      status: "error",
      identity: unresolvedIdentity,
      pullRequest: null,
      candidates: [],
      error: "FINAL_PR_IDENTITY_INCOMPLETE",
    };
  }
  const repository = resolveGithubRepository(input.repoPath);
  const identity = { repository: repository ?? "", headBranch, baseBranch };
  if (!repository) {
    return {
      schema: "setfarm.final-pull-request-lookup.v1",
      status: "error",
      identity,
      pullRequest: null,
      candidates: [],
      error: "FINAL_PR_REPOSITORY_UNRESOLVABLE",
    };
  }
  try {
    const raw = execFileSync("gh", [
      "pr", "list",
      "--repo", repository,
      "--head", headBranch,
      "--base", baseBranch,
      "--state", "all",
      "--limit", "100",
      "--json", "url,number,state,headRefName,baseRefName,isCrossRepository",
    ], {
      cwd: input.repoPath,
      timeout: GH_CLI_TIMEOUT,
      stdio: "pipe",
      encoding: "utf8",
    });
    const rows = JSON.parse(raw) as Array<{
      url?: unknown;
      number?: unknown;
      state?: unknown;
      headRefName?: unknown;
      baseRefName?: unknown;
      isCrossRepository?: unknown;
    }>;
    const candidates = (Array.isArray(rows) ? rows : [])
      .flatMap((row): FinalPullRequestMatch[] => {
        if (
          row.isCrossRepository === true
          || row.headRefName !== headBranch
          || row.baseRefName !== baseBranch
          || typeof row.url !== "string"
          || !Number.isInteger(Number(row.number))
          || Number(row.number) <= 0
        ) return [];
        const parsed = pullRequestFromUrl(identity, row.url);
        if (!parsed || parsed.number !== Number(row.number)) return [];
        return [{ ...parsed, state: normalizePullRequestState(row.state) }];
      })
      .sort((left, right) => (
        pullRequestStateRank(left.state) - pullRequestStateRank(right.state)
        || right.number - left.number
      ));
    const open = candidates.filter((candidate) => candidate.state === "OPEN");
    if (open.length > 1) {
      return {
        schema: "setfarm.final-pull-request-lookup.v1",
        status: "ambiguous",
        identity,
        pullRequest: null,
        candidates,
        error: "FINAL_PR_IDENTITY_AMBIGUOUS",
      };
    }
    const usable = open[0] ?? candidates.find((candidate) => candidate.state === "MERGED") ?? null;
    return {
      schema: "setfarm.final-pull-request-lookup.v1",
      status: usable ? "found" : "not_found",
      identity,
      pullRequest: usable,
      candidates,
      error: "",
    };
  } catch (error) {
    return {
      schema: "setfarm.final-pull-request-lookup.v1",
      status: "error",
      identity,
      pullRequest: null,
      candidates: [],
      error: `FINAL_PR_LOOKUP_FAILED:${compactCommandError(error)}`,
    };
  }
}

/**
 * Ensure the final PR without interpreting command prose. The exact identity is
 * reconciled before creation and again after any create result, including an
 * error that may have happened after GitHub accepted the request.
 */
export function ensureFinalPullRequest(input: Readonly<{
  repoPath: string;
  headBranch: string;
  baseBranch: string;
  title: string;
  body: string;
}>): FinalPullRequestEnsureResult {
  const before = findFinalPullRequestByIdentity(input);
  if (before.status === "found" && before.pullRequest) {
    return {
      schema: "setfarm.final-pull-request-ensure.v1",
      success: true,
      action: "existing",
      identity: before.identity,
      pullRequest: before.pullRequest,
      error: "",
    };
  }
  if (before.status === "error" || before.status === "ambiguous") {
    return {
      schema: "setfarm.final-pull-request-ensure.v1",
      success: false,
      action: "failed",
      identity: before.identity,
      pullRequest: null,
      error: before.error,
    };
  }

  let createError = "";
  let createdFromOutput: FinalPullRequestMatch | null = null;
  try {
    const output = execFileSync("gh", [
      "pr", "create",
      "--repo", before.identity.repository,
      "--base", before.identity.baseBranch,
      "--head", before.identity.headBranch,
      "--title", input.title,
      "--body", input.body,
    ], {
      cwd: input.repoPath,
      timeout: GH_MERGE_TIMEOUT,
      stdio: "pipe",
      encoding: "utf8",
    }).trim();
    const url = output.match(/https?:\/\/[^\s]+/)?.[0] ?? "";
    createdFromOutput = pullRequestFromUrl(before.identity, url);
  } catch (error) {
    createError = compactCommandError(error);
  }

  const after = findFinalPullRequestByIdentity(input);
  if (after.status === "found" && after.pullRequest) {
    return {
      schema: "setfarm.final-pull-request-ensure.v1",
      success: true,
      action: createError ? "reconciled_after_create_error" : "created",
      identity: after.identity,
      pullRequest: after.pullRequest,
      error: "",
    };
  }
  if (!createError && createdFromOutput) {
    return {
      schema: "setfarm.final-pull-request-ensure.v1",
      success: true,
      action: "created",
      identity: before.identity,
      pullRequest: createdFromOutput,
      error: "",
    };
  }
  return {
    schema: "setfarm.final-pull-request-ensure.v1",
    success: false,
    action: "failed",
    identity: after.identity.repository ? after.identity : before.identity,
    pullRequest: null,
    error: createError
      ? `FINAL_PR_CREATE_FAILED:${createError}`
      : (after.error || "FINAL_PR_CREATE_RETURNED_NO_MATCH"),
  };
}

// ── Fuzzy Story-Branch Probe (Wave 15 Bug J / Wave 16 generalization) ───

/**
 * When the declared story branch is empty (zero commits ahead of feature),
 * scan ALL local + remote refs whose name shares the run-id prefix and whose
 * story-id suffix fuzzy-matches the declared branch (case-insensitive, dash /
 * underscore agnostic). Pick the first non-empty one.
 *
 * Handles every observed agent naming divergence without per-case wiring:
 *   declared: abc12345-us-001
 *   agent wrote any of: abc12345-US-001, abc12345-us_001, abc12345-us001,
 *                       abc12345-Us-001, origin/abc12345-US-001, ...
 *
 * Returns the first non-empty match, or null.
 */
function findMatchingBranchWithCommits(
  repoPath: string,
  storyBranch: string,
  featureBranch: string,
): { ref: string; commits: number } | null {
  const parts = storyBranch.split("-");
  if (parts.length < 2) return null;
  const runPrefix = parts[0].toLowerCase();
  const storyIdCompact = parts.slice(1).join("").toLowerCase(); // "us" + "001" → "us001"
  const declaredLc = storyBranch.toLowerCase();

  let refs: string[] = [];
  try {
    const out = execFileSync(
      "git",
      ["for-each-ref", "--format=%(refname:short)", "refs/heads/", "refs/remotes/origin/"],
      { cwd: repoPath, timeout: 5000, stdio: "pipe" },
    ).toString().trim();
    refs = out.split("\n").filter(Boolean);
  } catch { return null; }

  // Same-run refs whose suffix (after run prefix, stripped of -/_) matches story-id
  const candidates = refs.filter(ref => {
    const base = ref.replace(/^origin\//, "").toLowerCase();
    if (base === declaredLc) return false;                  // already tried
    if (!base.startsWith(runPrefix + "-")) return false;    // different run
    const suffix = base.slice(runPrefix.length + 1).replace(/[-_]/g, "");
    return suffix === storyIdCompact;
  });

  // Deduplicate local+remote pairs — prefer local (faster merge target)
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const r of candidates) {
    const bare = r.replace(/^origin\//, "");
    if (seen.has(bare)) continue;
    seen.add(bare);
    // Emit local first if the same bare name also exists locally
    if (candidates.includes(bare)) ordered.push(bare);
    else ordered.push(r);
  }

  for (const ref of ordered) {
    try {
      const out = execFileSync("git", ["rev-list", "--count", `${featureBranch}..${ref}`], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      const count = parseInt(out, 10) || 0;
      if (count > 0) return { ref, commits: count };
    } catch { /* bad ref — continue */ }
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
    // Wave 16 (run #488 postmortem): scan ALL refs matching run_id + story_id
    // (case/separator fuzzy). Covers every naming divergence agents produce
    // without per-case wiring. Non-empty winner → merge, none → real empty.
    const match = findMatchingBranchWithCommits(repoPath, storyBranch, featureBranch);
    if (match) {
      logger.warn(`[merge-queue] fuzzy-ref rescue: ${storyBranch} empty, merging ${match.ref} (${match.commits} commits ahead)`);
      mergeTarget = match.ref;
      commitsAhead = match.commits;
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

  // REBASE BEFORE MERGE (2026-04-22): rebase story branch on current feature HEAD
  // so sequential merges don't conflict on shared files. If rebase fails, the
  // conflict is still exposed by the subsequent merge attempt + -X theirs retry.
  try {
    // Create/reset local branch from mergeTarget (handles both local and origin/ refs)
    execFileSync("git", ["checkout", "-B", storyBranch, mergeTarget], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });
    execFileSync("git", ["rebase", featureBranch], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });
    // Force-push rebased branch so remote matches (keeps PR in sync)
    try {
      execFileSync("git", ["push", "--force-with-lease", "origin", storyBranch], {
        cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
      });
    } catch (pushErr) {
      logger.warn(`[merge-queue] Rebase push failed for ${storyBranch}: ${String(pushErr).slice(0, 150)}`);
    }
    logger.info(`[merge-queue] Rebased ${storyBranch} onto ${featureBranch} before merge`);
    // Use local ref for subsequent merge (already at rebased tip)
    mergeTarget = storyBranch;
    // Return to feature branch for the merge
    execFileSync("git", ["checkout", featureBranch], {
      cwd: repoPath, timeout: GIT_LONG_TIMEOUT, stdio: "pipe",
    });
  } catch (rebaseErr) {
    // Abort rebase if in progress, restore clean state
    try {
      execFileSync("git", ["rebase", "--abort"], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      });
    } catch { /* no rebase in progress */ }
    try {
      execFileSync("git", ["checkout", featureBranch], {
        cwd: repoPath, timeout: 5000, stdio: "pipe",
      });
    } catch { /* best effort */ }
    logger.warn(`[merge-queue] Rebase failed for ${storyBranch}, continuing with merge + -X theirs fallback: ${String(rebaseErr).slice(0, 200)}`);
  }

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

// Preserve the code-owned record already written by native model completion.
// This grants no merge/claim authority and never reconstructs acceptance bytes.
type NativeModelMergeIdentity=Readonly<{
  runId:string;storyDbId:string;storyId:string;attemptId:string;sourceSha:string|null;
}>;

async function authenticateNativeModelAcceptanceInTransaction(tx:postgres.TransactionSql,input:NativeModelMergeIdentity) {
  const cap=currentRuntimeCompletionOwnerCapability();
    const rows=await tx.unsafe<Array<{
      story_output:string;story_generation:number;output:string;output_hash:string;packet_hash:string;slice_hash:string;
      source_before_sha:string;source_before_tree_hash:string;source_after_sha:string;source_after_tree_hash:string;
      bundle_hash:string;bundle_payload:unknown;request_id:string;claim_id:string;step_db_id:string;
      completion_plan:unknown;completion_plan_hash:string;
    }>>(`
      SELECT story.output AS story_output,story.claim_generation AS story_generation,q.output,q.output_hash,
        a.packet_hash,a.slice_hash,a.source_before_sha,a.source_before_tree_hash,a.source_after_sha,a.source_after_tree_hash,
        bundle.evidence_bundle_hash AS bundle_hash,bundle.payload AS bundle_payload,
        q.request_id,q.claim_id::text,q.step_db_id,q.completion_plan,q.completion_plan_hash
      FROM stories story JOIN runs run ON run.id=story.run_id AND run.protocol='v3' AND run.status IN ('running','resuming')
      JOIN execution_attempts a ON a.attempt_id=$4 AND a.run_id=story.run_id AND a.story_id=story.story_id
        AND a.step_id='implement' AND a.packet_hash=run.packet_hash AND a.source_after_sha=$5
        AND a.disposition='verified' AND a.branch=story.story_branch
        AND a.attempt_class IN ('product_implementation','supervisor_repair','infrastructure_retry')
        AND a.role=CASE WHEN a.attempt_class='supervisor_repair' THEN 'supervisor' ELSE 'developer' END
      JOIN semantic_artifacts packet ON packet.artifact_hash=a.packet_hash AND packet.artifact_type='setfarm.product-build-packet.v3'
      JOIN claim_log claim ON claim.id=a.claim_id AND claim.run_id=a.run_id AND claim.step_id=a.step_id
        AND claim.story_id=a.story_id AND claim.agent_id=a.agent_id AND claim.outcome='completed'
      JOIN runtime_completion_requests q ON q.attempt_id=a.attempt_id AND q.claim_id=a.claim_id AND q.run_id=a.run_id
        AND q.workflow_step_id=a.step_id AND q.story_id=a.story_id AND q.output_hash=a.output_hash AND q.claim_outcome=claim.outcome
      JOIN runtime_sessions runtime ON runtime.session_id=q.runtime_session_id AND runtime.claim_id=a.claim_id
        AND runtime.attempt_id=a.attempt_id AND runtime.run_id=a.run_id AND runtime.workflow_step_id=a.step_id
        AND runtime.step_db_id=q.step_db_id AND runtime.story_db_id=story.id AND runtime.story_id=a.story_id AND runtime.claim_agent_id=a.agent_id
      JOIN v3_story_claim_runtime_bindings_v1 binding ON binding.claim_id=a.claim_id AND binding.runtime_session_id=runtime.session_id
        AND binding.run_id=a.run_id AND binding.step_db_id=q.step_db_id AND binding.workflow_step_id='implement'
        AND binding.subject_kind='story_member' AND binding.story_db_id=story.id AND binding.story_id=story.story_id
        AND binding.story_index=story.story_index AND binding.story_claim_generation=story.claim_generation
      JOIN evidence_bundles bundle ON bundle.run_id=a.run_id AND bundle.story_id=a.story_id AND bundle.attempt_id=a.attempt_id
        AND bundle.packet_hash=a.packet_hash AND bundle.slice_hash=a.slice_hash
        AND bundle.source_sha=a.source_after_sha AND bundle.source_tree_hash=a.source_after_tree_hash AND bundle.aggregate_verdict='pass'
        AND a.evidence_refs::jsonb ? ('setfarm://evidence-bundle/' || bundle.evidence_bundle_hash)
      WHERE story.run_id=$1 AND story.id=$2 AND story.story_id=$3 AND story.status IN ('done','verified')
        AND story.claimed_by IS NULL AND story.claimed_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM execution_attempts newer WHERE newer.run_id=a.run_id
          AND newer.step_id=a.step_id AND newer.story_id=a.story_id AND newer.generation>a.generation)
        AND (($6::text IS NULL AND q.state='accepted' AND q.apply_phase='effects_committed' AND runtime.state='released')
          OR ($6::text IS NOT NULL AND q.state='processing' AND q.apply_phase='owner_committed' AND runtime.state='drained'
            AND q.request_id=$6 AND q.owner_instance_id=$7 AND q.owner_attempt_count=$8 AND q.lease_expires_at>clock_timestamp()))
      FOR UPDATE OF story,q
    `,[input.runId,input.storyDbId,input.storyId,input.attemptId,input.sourceSha,
      cap?.requestId??null,cap?.ownerInstanceId??null,cap?.ownerAttemptCount??0]);
    const row=rows[0];
    if(rows.length!==1||!row)throw Error("V3_NATIVE_MODEL_MERGE_ACCEPTANCE_OWNER_MISMATCH");
    const accepted=z.object({
      schema:z.literal("setfarm.v3-story-acceptance-record.v1"),storyId:z.string(),attemptId:z.string(),
      packetHash:z.string(),sliceHash:z.string(),sourceRevision:SourceRevisionV1Schema,
      evidenceBundleRef:z.string(),findingSetRef:z.null(),aggregateVerdict:z.literal("pass"),
      failureClass:z.null(),agentOutputHash:z.string(),
    }).strict().parse(JSON.parse(row.story_output));
    const model=V3ImplementationAgentOutputV1Schema.parse(JSON.parse(row.output));
    const bundle=EvidenceBundleV2Schema.parse(row.bundle_payload);
    const plan=RuntimeCompletionPlanV1Schema.parse(row.completion_plan);
    if(row.story_output!==canonicalJsonStringify(accepted)
      ||accepted.storyId!==input.storyId||accepted.attemptId!==input.attemptId
      ||accepted.packetHash!==row.packet_hash||accepted.sliceHash!==row.slice_hash
      ||accepted.sourceRevision.sha!==row.source_after_sha||accepted.sourceRevision.treeHash!==row.source_after_tree_hash
      ||accepted.evidenceBundleRef!==`setfarm://evidence-bundle/${row.bundle_hash}`
      ||accepted.agentOutputHash!==row.output_hash
      ||createHash("sha256").update(row.output,"utf8").digest("hex")!==row.output_hash
      ||model.disposition!=="ready_for_evidence"||model.attemptId!==input.attemptId
      ||model.packetHash!==row.packet_hash||model.sliceHash!==row.slice_hash
      ||model.sourceBefore.sha!==row.source_before_sha||model.sourceBefore.treeHash!==row.source_before_tree_hash
      ||computeEvidenceBundleHash(bundle)!==row.bundle_hash||bundle.aggregateVerdict!=="pass"
      ||bundle.runId!==input.runId||bundle.storyId!==input.storyId||bundle.attemptId!==input.attemptId
      ||bundle.packetHash!==row.packet_hash||bundle.sliceHash!==row.slice_hash
      ||bundle.sourceRevision.sha!==row.source_after_sha||bundle.sourceRevision.treeHash!==row.source_after_tree_hash
      ||!bundle.predicates.length||bundle.predicates.some(p=>p.required&&p.verdict!=="pass")
      ||hashCanonicalJson(plan)!==row.completion_plan_hash||plan.requestId!==row.request_id
      ||plan.runId!==input.runId||plan.stepDbId!==row.step_db_id||plan.workflowStepId!=="implement"
      ||plan.claimId!==Number(row.claim_id)||plan.outputHash!==row.output_hash||plan.kind!=="story_completion"
      ||plan.subject?.storyDbId!==input.storyDbId||plan.subject?.storyId!==input.storyId
      ||plan.subject?.sourceSha!==row.source_after_sha) {
      throw Error("V3_NATIVE_MODEL_MERGE_ACCEPTANCE_RECORD_MISMATCH");
    }
  return {row,cap};
}

async function assertNativeModelAcceptanceBeforeMerge(input:NativeModelMergeIdentity):Promise<void> {
  await nativeEvidenceSql().begin(async tx=>{await authenticateNativeModelAcceptanceInTransaction(tx,input);});
}

async function preserveNativeModelAcceptanceAfterMerge(input:NativeModelMergeIdentity):Promise<void> {
  await nativeEvidenceSql().begin(async tx=>{
    const {row,cap}=await authenticateNativeModelAcceptanceInTransaction(tx,input);
    // Leave output untouched. CAS and the live-owner predicate protect against
    // a new story owner or a lease expiring during bounded record validation.
    const changed=await tx.unsafe<Array<{id:string}>>(`
      UPDATE stories story SET merge_status='merged',status='verified',updated_at=clock_timestamp()
      WHERE story.id=$1 AND story.run_id=$2 AND story.story_id=$3 AND story.output=$4
        AND story.claim_generation=$5 AND story.status IN ('done','verified')
        AND story.claimed_by IS NULL AND story.claimed_at IS NULL
        AND EXISTS(SELECT 1 FROM runtime_completion_requests q WHERE q.request_id=$6 AND q.output_hash=$7
          AND q.completion_plan_hash=$8 AND (($9::text IS NULL AND q.state='accepted' AND q.apply_phase='effects_committed')
            OR ($9::text IS NOT NULL AND q.state='processing' AND q.apply_phase='owner_committed' AND q.request_id=$9
              AND q.owner_instance_id=$10 AND q.owner_attempt_count=$11 AND q.lease_expires_at>clock_timestamp())))
      RETURNING story.id
    `,[input.storyDbId,input.runId,input.storyId,row.story_output,row.story_generation,row.request_id,row.output_hash,
      row.completion_plan_hash,cap?.requestId??null,cap?.ownerInstanceId??null,cap?.ownerAttemptCount??0]);
    if(changed.length!==1)throw Error("V3_NATIVE_MODEL_MERGE_ACCEPTANCE_CAS_LOST");
  });
}

type NativeMergeIndexEntry=Readonly<{mode:string;blob:string;stage:string;path:string}>;
function parseNativeMergeIndex(value:string):NativeMergeIndexEntry[] {
  return value.split("\0").filter(Boolean).map(entry=>{
      const match=/^(100644|100755) ([a-f0-9]{40}|[a-f0-9]{64}) ([0123])\t([^\0]+)$/.exec(entry);
      if(!match) throw Error("V3_NATIVE_SHARED_MERGE_REGULAR_STAGES_REQUIRED");
      return {mode:match[1]!,blob:match[2]!,stage:match[3]!,path:match[4]!};
    }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:a.stage<b.stage?-1:a.stage>b.stage?1:0);
}
function readNativeMergeWorktree(repoPath:string,expectedIndex:readonly NativeMergeIndexEntry[],sourceSha:string) {
  const root=realpathSync(repoPath);
      const paths=[...new Set(expectedIndex.map(entry=>entry.path))].sort();
      if(paths.length>V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxFiles)
        throw Error("V3_NATIVE_SHARED_MERGE_SOURCE_CAPACITY");
      let totalBytes=0;
      return paths.map(file=>{
        const parts=file.split("/");
        if(path.isAbsolute(file)||parts.some(part=>!part||part==='.'||part==='..'||part==='.git'))
          throw Error("V3_NATIVE_SHARED_MERGE_PATH_INVALID");
        let current=root;
        const parents=parts.slice(0,-1).map(part=>{
          current=path.join(current,part);const stat=lstatSync(current);
          if(!stat.isDirectory()||stat.isSymbolicLink()) throw Error("V3_NATIVE_SHARED_MERGE_PATH_INVALID");
          return {path:current,dev:stat.dev,ino:stat.ino};
        });
        const read=readRegularFileAtMostSync(path.join(root,file),V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxFileBytes);
        totalBytes+=read.byteLength;
        if(totalBytes>V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxTotalBytes
          ||parents.some(parent=>{const stat=lstatSync(parent.path);return !stat.isDirectory()||stat.isSymbolicLink()
            ||stat.dev!==parent.dev||stat.ino!==parent.ino;})) throw Error("V3_NATIVE_SHARED_MERGE_SOURCE_CHANGED");
        const mode=(read.stat.mode&0o111)?"100755":"100644";
        const staged=expectedIndex.find(entry=>entry.path===file&&entry.stage==='0');
        const objectHash=createHash((staged?.blob??sourceSha).length===40?'sha1':'sha256')
          .update(`blob ${read.byteLength}\0`).update(read.bytes).digest('hex');
        if(staged&&(staged.mode!==mode||staged.blob!==objectHash))
          throw Error("V3_NATIVE_SHARED_MERGE_UNSTAGED_SOURCE_CHANGED");
        return {path:file,mode,hash:createHash('sha256').update(read.bytes).digest('hex')};
      });

}

/** Reconstruct and publish only the exact native merge at a feature head.
 * All receipt authority comes from durable model ownership and immutable Git;
 * no caller-supplied receipt or historical fallback from a present ALS owner. */
async function reconcileNativeSharedMergeReceipt(input:Readonly<{
  identity:NativeModelMergeIdentity;repoPath:string;featureBranch:string;
}>):Promise<ExactSourceMergeResult|undefined> {
  const sourceSha=input.identity.sourceSha;
  if(!sourceSha) throw Error("V3_NATIVE_SHARED_MERGE_SOURCE_MISSING");
  const env:NodeJS.ProcessEnv={...process.env,GIT_NO_REPLACE_OBJECTS:"1",GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"};
  for(const key of ["GIT_DIR","GIT_WORK_TREE","GIT_COMMON_DIR","GIT_INDEX_FILE","GIT_OBJECT_DIRECTORY","GIT_ALTERNATE_OBJECT_DIRECTORIES","GIT_NAMESPACE"]) delete env[key];
  const git=(args:string[])=>execFileSync("git",["--no-replace-objects","--literal-pathspecs",...args],{
    cwd:input.repoPath,env,timeout:GIT_LONG_TIMEOUT,maxBuffer:16*1024*1024,encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  try {
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    git(["fetch","origin",input.featureBranch]);
    const native=createNativeV3ImplementationContextService({sql:nativeEvidenceSql(),
      artifactRoot:resolveProductArtifactDir(),artifactLimits:resolveProductArtifactCapacity()});
    const receipt=await native.authenticateSharedMergeReceipt({runId:input.identity.runId,storyId:input.identity.storyId,
      attemptId:input.identity.attemptId,worktree:input.repoPath,branch:input.featureBranch,sourceSha});
    if(!receipt) return undefined;
    const treeIndex=(sha:string)=>parseNativeMergeIndex(git(["ls-tree","-r","-z",sha])
      .split("\0").filter(Boolean).map(entry=>{
        const match=/^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0]+)$/.exec(entry);
        if(!match) throw Error("V3_NATIVE_SHARED_MERGE_RECEIPT_REGULAR_TREE_REQUIRED");
        return `${match[1]} ${match[2]} 0\t${match[3]}\0`;
      }).join(""));
    const mergedIndex=receipt.entries.map(entry=>({mode:entry.mode,blob:entry.blob,stage:"0",path:entry.path}));
    let expectedHead=receipt.localBefore;
    let expectedIndex=treeIndex(expectedHead);
    const assertExactLocal=()=>{
      if(git(["rev-parse","HEAD"]).trim()!==expectedHead
        ||git(["rev-parse","--abbrev-ref","HEAD"]).trim()!==input.featureBranch
        ||canonicalJsonStringify(parseNativeMergeIndex(git(["ls-files","--stage","-z"])))!==canonicalJsonStringify(expectedIndex)
        ||git(["ls-files","--others","--exclude-standard","-z"]).length)
        throw Error("V3_NATIVE_SHARED_MERGE_RECEIPT_LOCAL_CHANGED");
      // Hash every regular file against the immutable full index, including
      // paths hidden from status by index flags; no worktree-only credit.
      readNativeMergeWorktree(input.repoPath,expectedIndex,sourceSha);
    };
    assertExactLocal();
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    assertExactLocal();
    if(expectedHead!==receipt.merge.sha) {
      if(expectedHead!==receipt.target.sha) throw Error("V3_NATIVE_SHARED_MERGE_RECEIPT_TARGET_DRIFT");
      git(["merge","--ff-only",receipt.merge.sha]);
      expectedHead=receipt.merge.sha;
      expectedIndex=mergedIndex;
    }
    if(canonicalJsonStringify(expectedIndex)!==canonicalJsonStringify(mergedIndex)
      ||git(["rev-parse","HEAD^{tree}"]).trim()!==receipt.merge.treeHash)
      throw Error("V3_NATIVE_SHARED_MERGE_RECEIPT_TREE_MISMATCH");
    assertExactLocal();
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    assertExactLocal();
    // A normal fast-forward push preserves both original parents. No force,
    // replacement ref or source-ancestry-only reconciliation is permitted.
    try { git(["push","origin",`refs/heads/${input.featureBranch}:refs/heads/${input.featureBranch}`]); }
    catch { /* A lost acknowledgement is not publication proof or disproof. */ }
    // Always attempt the exact remote receipt read, even after a push error.
    // Failed fetch remains a refusal; only the fetched merge/tree/parents and
    // the unchanged live-owner/local-state checks below can grant success.
    git(["fetch","origin",input.featureBranch]);
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    assertExactLocal();
    const remote=git(["rev-parse",`origin/${input.featureBranch}^{commit}`]).trim();
    if(remote!==receipt.merge.sha||git(["rev-parse",`${remote}^{tree}`]).trim()!==receipt.merge.treeHash
      ||canonicalJsonStringify(git(["rev-list","--parents","-n","1",remote]).trim().split(/\s+/))!==canonicalJsonStringify(receipt.parents)
      ||canonicalJsonStringify(treeIndex(remote))!==canonicalJsonStringify(mergedIndex))
      throw Error("V3_NATIVE_SHARED_MERGE_REMOTE_RECEIPT_MISMATCH");
    for(const sha of [receipt.merge.sha,receipt.target.sha,sourceSha]) git(["merge-base","--is-ancestor",sha,remote]);
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    assertExactLocal();
    return {schema:"setfarm.exact-source-merge-result.v1",success:true,resolution:"reconciled",conflicts:[],error:"",
      proof:proveExactCommitAncestor(input.repoPath,receipt.merge.sha,`origin/${input.featureBranch}`)};
  } catch(error) {
    const diagnostic=`V3_NATIVE_SHARED_MERGE_RECEIPT_REFUSED:${compactCommandError(error)}`;
    logger.warn(`[merge-queue] ${diagnostic}`,{runId:input.identity.runId});
    return {schema:"setfarm.exact-source-merge-result.v1",success:false,resolution:"failed",conflicts:[],error:diagnostic,
      proof:proveExactCommitAncestor(input.repoPath,sourceSha,`origin/${input.featureBranch}`)};
  }
}

/** Private native-only fallback after the unchanged exact merge refused and
 * aborted. IDs locate real owners; callers cannot provide a resolution proof. */
async function mergeNativeSharedSourceAfterConflict(input:Readonly<{
  identity:NativeModelMergeIdentity;repoPath:string;featureBranch:string;commitMessage:string;
  refused:ExactSourceMergeResult;
}>):Promise<ExactSourceMergeResult> {
  const sourceSha=input.identity.sourceSha;
  const targetSha=input.refused.proof.targetCommitSha;
  if(!sourceSha||!targetSha||!input.refused.conflicts.length||input.refused.success) return input.refused;
  const failed=(error:string):ExactSourceMergeResult=>({...input.refused,error});
  const env:NodeJS.ProcessEnv={...process.env,GIT_NO_REPLACE_OBJECTS:"1",GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"};
  for(const key of ["GIT_DIR","GIT_WORK_TREE","GIT_COMMON_DIR","GIT_INDEX_FILE","GIT_OBJECT_DIRECTORY","GIT_ALTERNATE_OBJECT_DIRECTORIES","GIT_NAMESPACE"]) delete env[key];
  const git=(args:string[],maxBuffer=16*1024*1024)=>execFileSync("git",["--no-replace-objects","--literal-pathspecs",...args],{
    cwd:input.repoPath,env,timeout:GIT_LONG_TIMEOUT,maxBuffer,encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  let ownMergeStarted=false;
  const assertParents=()=>{
    if(git(["rev-parse","HEAD"]).trim()!==targetSha||git(["rev-parse","MERGE_HEAD"]).trim()!==sourceSha
      ||git(["rev-parse","--abbrev-ref","HEAD"]).trim()!==input.featureBranch)
      throw Error("V3_NATIVE_SHARED_MERGE_PARENTS_CHANGED");
  };
  try {
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    const native=createNativeV3ImplementationContextService({sql:nativeEvidenceSql(),
      artifactRoot:resolveProductArtifactDir(),artifactLimits:resolveProductArtifactCapacity()});
    const proof=await native.authenticateSharedMerge({runId:input.identity.runId,storyId:input.identity.storyId,
      attemptId:input.identity.attemptId,worktree:input.repoPath,branch:input.featureBranch,
      sourceSha,targetSha,conflicts:input.refused.conflicts});
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    if(git(["rev-parse","HEAD"]).trim()!==proof.target.sha
      ||git(["status","--porcelain=v1","-z","--untracked-files=all"]).length)
      throw Error("V3_NATIVE_SHARED_MERGE_TARGET_CHANGED");
    // Preserve both real parents. Only the exact already-observed conflict set
    // is eligible; no general merge strategy or source/base rewrite is used.
    try { git(["merge","--no-ff","--no-commit",sourceSha]); }
    catch { /* Exact unmerged entries and parents below decide eligibility. */ }
    ownMergeStarted=true;
    assertParents();
    const indexEntries=()=>parseNativeMergeIndex(git(["ls-files","--stage","-z"]));
    let expectedIndex=indexEntries();
    const unmerged=expectedIndex.filter(entry=>entry.stage!=="0");
    const actualConflicts=[...new Set(unmerged.map(entry=>entry.path))].sort();
    const worktreeEntries=()=>readNativeMergeWorktree(input.repoPath,expectedIndex,sourceSha);
    let expectedWorktree=worktreeEntries();
    const assertAutomaticResult=()=>{
      if(canonicalJsonStringify(indexEntries())!==canonicalJsonStringify(expectedIndex)
        ||canonicalJsonStringify(worktreeEntries())!==canonicalJsonStringify(expectedWorktree)
        ||git(["ls-files","--others","--exclude-standard","-z"]).length)
        throw Error("V3_NATIVE_SHARED_MERGE_AUTOMATIC_RESULT_CHANGED");
    };
    if(canonicalJsonStringify(actualConflicts)!==canonicalJsonStringify(proof.conflicts))
      throw Error("V3_NATIVE_SHARED_MERGE_CONFLICT_SET_CHANGED");
    for(const file of proof.conflicts) {
      const pathProof=proof.paths.find(path=>path.path===file);
      const stages=unmerged.filter(entry=>entry.path===file);
      if(!pathProof||stages.length!==3||new Set(stages.map(stage=>stage.stage)).size!==3
        ||stages.some(stage=>stage.mode!==pathProof.mode)
        ||stages.find(stage=>stage.stage==='1')?.blob!==pathProof.baseBlob
        ||stages.find(stage=>stage.stage==='2')?.blob!==pathProof.targetBlob
        ||stages.find(stage=>stage.stage==='3')?.blob!==pathProof.sourceBlob)
        throw Error("V3_NATIVE_SHARED_MERGE_STAGE_PROOF_MISMATCH");
      assertAutomaticResult();
      await assertNativeModelAcceptanceBeforeMerge(input.identity);
      assertParents();
      assertAutomaticResult();
      git(["restore",`--source=${sourceSha}`,"--staged","--worktree","--",file]);
      expectedIndex=[...expectedIndex.filter(entry=>entry.path!==file),
        {mode:pathProof.mode,blob:pathProof.sourceBlob,stage:"0",path:file}]
        .sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:a.stage<b.stage?-1:a.stage>b.stage?1:0);
      expectedWorktree=expectedWorktree.map(entry=>entry.path===file
        ?{path:file,mode:pathProof.mode,hash:pathProof.contentHash}:entry);
      assertAutomaticResult();
    }
    if(git(["ls-files","-u","-z"]).length) throw Error("V3_NATIVE_SHARED_MERGE_UNCOVERED_CONFLICT");
    const delta=git(["diff","--cached","--name-only","-z",targetSha,"--"]).split("\0").filter(Boolean);
    if(delta.some(file=>!proof.allowedPaths.includes(file))) throw Error("V3_NATIVE_SHARED_MERGE_RESULT_SCOPE_INVALID");
    assertAutomaticResult();
    const tree=git(["write-tree"]).trim();
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    assertParents();
    assertAutomaticResult();
    if(git(["write-tree"]).trim()!==tree) throw Error("V3_NATIVE_SHARED_MERGE_INDEX_CHANGED");
    git(["commit","-m",input.commitMessage]);
    ownMergeStarted=false;
    const committed=git(["rev-list","--parents","-n","1","HEAD"]).trim().split(/\s+/);
    if(committed.length!==3||committed[1]!==targetSha||committed[2]!==sourceSha
      ||git(["rev-parse","HEAD^{tree}"]).trim()!==tree)
      throw Error("V3_NATIVE_SHARED_MERGE_COMMIT_PROOF_MISMATCH");
    const committedMergeSha=committed[0]!;
    assertAutomaticResult();
    await assertNativeModelAcceptanceBeforeMerge(input.identity);
    assertAutomaticResult();
    const published=await reconcileNativeSharedMergeReceipt(input);
    if(!published?.success||published.proof.sourceCommitSha!==committedMergeSha
      ||git(["rev-parse","HEAD^{tree}"]).trim()!==tree)
      throw Error(published?.error||"V3_NATIVE_SHARED_MERGE_REMOTE_RECEIPT_MISSING");
    assertAutomaticResult();
    return published;
  } catch(error) {
    if(ownMergeStarted) {
      try { await assertNativeModelAcceptanceBeforeMerge(input.identity); assertParents(); git(["merge","--abort"]); }
      catch { /* Preserve a merge when its owner or parents changed. Never reset/adopt it. */ }
    }
    const diagnostic=`V3_NATIVE_SHARED_MERGE_REFUSED:${compactCommandError(error)}`;
    logger.warn(`[merge-queue] ${diagnostic}`,{runId:input.identity.runId});
    return failed(diagnostic);
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
  nativeOwner?:NativeEvidenceContinuationOwner,
): Promise<MergeQueueResult> {
  const native=nativeOwner?await authenticateNativeEvidenceContinuationOwner(nativeEvidenceSql(),nativeOwner):undefined;
  if(nativeOwner) {
    const context=await getRunContext(runId);
    if(nativeOwner.runId!==runId||context.repo!==repoPath||context.branch!==featureBranch
      ||native?.sourceOwner.completionPlan.continuation.type!=="story_direct_merge")
      throw new Error("V3_NATIVE_EVIDENCE_MERGE_CONTEXT_MISMATCH");
  }
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
    story_branch: string; merge_status: string; source_after_sha: string | null;
  }>(
    `SELECT s.id, s.story_id, s.title, s.status, s.story_branch,
            COALESCE(s.merge_status, 'pending') AS merge_status,
            (
              SELECT ea.source_after_sha
                FROM execution_attempts ea
               WHERE ea.run_id = s.run_id
                 AND ea.story_id = s.story_id
                 AND ea.source_after_sha IS NOT NULL
                 AND ea.disposition IN ('produced_delta', 'already_satisfied', 'verified')
               ORDER BY ea.generation DESC, ea.updated_at DESC
               LIMIT 1
            ) AS source_after_sha
       FROM stories s
      WHERE s.run_id = $1
      ORDER BY s.story_index ASC`,
    [runId],
  );

  for (const story of stories) {
    const pendingNative=!!native&&native.storyDbId===story.id&&nativeOwner?.storyId===story.story_id;
    if(pendingNative&&story.status!=="failed") throw new Error("V3_NATIVE_EVIDENCE_MERGE_STORY_CHANGED");
    // Only the fully authenticated terminal verifier can supply this pending source.
    if(pendingNative) story.source_after_sha=native!.sourceAfter.sha;
    if (story.status !== "done" && story.status !== "verified" && !pendingNative) {
      result.skipped.push(story.story_id);
      logger.info(`[merge-queue] Skipping ${story.story_id} (status: ${story.status})`, { runId });
      continue;
    }

    if (story.merge_status === "merged" && !pendingNative) {
      result.merged.push(story.story_id);
      logger.info(`[merge-queue] Already merged: ${story.story_id}`, { runId });
      continue;
    }

    const storyBranch = (story.story_branch || `${runId.slice(0, 8)}-${story.story_id}`).toLowerCase();
    const commitMsg = `merge: ${story.story_id} - ${story.title}`;

    logger.info(`[merge-queue] Merging ${story.story_id} (${storyBranch} → ${featureBranch})`, { runId });

    if(nativeOwner) await authenticateNativeEvidenceContinuationOwner(nativeEvidenceSql(),nativeOwner);
    let nativeModelIdentity:NativeModelMergeIdentity|undefined;
    if(!pendingNative&&story.source_after_sha) {
      const selected=await nativeEvidenceSql().unsafe<Array<{attempt_id:string;attempt_class:string;artifact_type:string}>>(`
        SELECT a.attempt_id,a.attempt_class,packet.artifact_type FROM execution_attempts a
        JOIN semantic_artifacts packet ON packet.artifact_hash=a.packet_hash
        WHERE a.run_id=$1 AND a.story_id=$2 AND a.source_after_sha=$3
        ORDER BY a.generation DESC,a.updated_at DESC LIMIT 1`,[runId,story.story_id,story.source_after_sha]);
      const candidate=selected[0];
      if(candidate?.artifact_type==='setfarm.product-build-packet.v3'
        && ['product_implementation','supervisor_repair','infrastructure_retry'].includes(candidate.attempt_class)) {
        nativeModelIdentity={runId,storyDbId:story.id,storyId:story.story_id,
          attemptId:candidate.attempt_id,sourceSha:story.source_after_sha};
        await assertNativeModelAcceptanceBeforeMerge(nativeModelIdentity);
      }
    }
    let exactMerge=nativeModelIdentity
      ?await reconcileNativeSharedMergeReceipt({identity:nativeModelIdentity,repoPath,featureBranch})
      :undefined;
    if(!exactMerge&&story.source_after_sha) exactMerge=mergeExactSourceIntoFeature({
      repoPath,sourceSha:story.source_after_sha,featureBranch,commitMessage:commitMsg});
    if(exactMerge&&!exactMerge.success&&nativeModelIdentity&&exactMerge.conflicts.length) {
      exactMerge=await mergeNativeSharedSourceAfterConflict({identity:nativeModelIdentity,repoPath,
        featureBranch,commitMessage:commitMsg,refused:exactMerge});
    }
    const mergeResult: MergeResult = exactMerge
      ? {
          success: exactMerge.success,
          conflicts: exactMerge.conflicts.length > 0
            ? exactMerge.conflicts
            : exactMerge.success
              ? []
              : [exactMerge.error],
        }
      : mergeStoryIntoFeature(repoPath, storyBranch, featureBranch, commitMsg);

    if (mergeResult.success) {
      result.merged.push(story.story_id);
      if(nativeOwner) await authenticateNativeEvidenceContinuationOwner(nativeEvidenceSql(),nativeOwner);
      // Pending verifier acceptance/receipt is published by its atomic case
      // transaction. Keep failed story and original output until that boundary.
      if(!pendingNative) {
        let output="STATUS: verified\nVERIFICATION_SUMMARY: Direct-merged into feature branch and marked verified.";
        const attempts=await nativeEvidenceSql().unsafe<Array<{attempt_id:string;attempt_class:string;packet_hash:string;artifact_type:string}>>(`
          SELECT a.attempt_id,a.attempt_class,a.packet_hash,p.artifact_type FROM execution_attempts a
          JOIN semantic_artifacts p ON p.artifact_hash=a.packet_hash WHERE a.run_id=$1 AND a.story_id=$2
          ORDER BY a.generation DESC,a.updated_at DESC LIMIT 1`,[runId,story.story_id]);
        const modelAttempt=attempts[0];
        if(modelAttempt?.artifact_type==="setfarm.product-build-packet.v3"
          && ["product_implementation","supervisor_repair","infrastructure_retry"].includes(modelAttempt.attempt_class)) {
          await preserveNativeModelAcceptanceAfterMerge({runId,storyDbId:story.id,storyId:story.story_id,
            attemptId:modelAttempt.attempt_id,sourceSha:story.source_after_sha});
        } else {
          if(attempts[0]?.attempt_class==="evidence_only"&&attempts[0].artifact_type==="setfarm.product-build-packet.v3") {
            const accepted=await readNativeEvidenceOnlySuccessAuthority(nativeEvidenceSql(),{runId,stepId:"implement",
              storyId:story.story_id,packetHash:attempts[0].packet_hash,attemptId:attempts[0].attempt_id});
            if(accepted.storyOutput!==accepted.acceptanceOutput||accepted.sourceAfter.sha!==story.source_after_sha)
              throw new Error("V3_NATIVE_EVIDENCE_MERGE_ACCEPTANCE_MISMATCH");
            output=accepted.acceptanceOutput;
          }
          await pgRun("UPDATE stories SET merge_status='merged',status='verified',output=$1,updated_at=$2 WHERE id=$3",
            [output,now(),story.id]);
        }
      }
      if(!pendingNative) emitEvent({
        ts: now(), event: "story.verified", runId, workflowId: wfId,
        storyId: story.story_id, storyTitle: story.title,
        detail: `Direct-merged into ${featureBranch}`,
      });
      logger.info(
        `[merge-queue] ${exactMerge?.resolution === "reconciled" ? "Reconciled" : "Merged"}: ${story.story_id}`,
        { runId },
      );
    } else {
      // Run #338 fix: previously conflict only set merge_status, leaving story.status='done'.
      // That let the pipeline silently proceed to deploy with partial work. Now mark the
      // story as 'failed' so the "fail run if any story failed" guardrail (96dd442) catches
      // it and surfaces the conflict as a run failure instead of burying it in the DB.
      result.conflicted.push(story.story_id);
      if(pendingNative) throw new Error(`V3_NATIVE_EVIDENCE_MERGE_CONFLICT:${mergeResult.conflicts.join(", ")}`);
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

  const nativeRun=await pgGet<{id:string}>(`SELECT run.id FROM runs run JOIN semantic_artifacts packet
    ON packet.artifact_hash=run.packet_hash AND packet.artifact_type='setfarm.product-build-packet.v3'
    WHERE run.id=$1 AND run.protocol='v3'`,[runId]);
  // Direct-merge stories become canonically verified incrementally. Publish
  // the final feature PR only after all other stories are terminal; the one
  // authenticated pending verifier is committed by its atomic case transaction.
  const outstanding=await pgGet<{count:string}>(`SELECT count(*)::text AS count FROM stories
    WHERE run_id=$1 AND status NOT IN ('done','verified','skipped') AND ($2::text IS NULL OR id<>$2)`,
    [runId,native?.storyDbId??null]);
  if (result.merged.length > 0 && (!nativeRun || outstanding?.count==="0")) {
    try {
      // Get task name for PR title
      const runRow = await pgGet<{ task: string }>("SELECT task FROM runs WHERE id = $1", [runId]);
      const taskLines = (runRow?.task || "").split("\n");
      const projectLine = taskLines.find(l => l.startsWith("Project:")) || taskLines[0] || "Feature";
      const projectName = projectLine.replace(/^Project:\s*/, "").trim();

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

      const ensured = ensureFinalPullRequest({
        repoPath,
        headBranch: featureBranch,
        baseBranch: "main",
        title: `feat: ${projectName}`,
        body: prBody,
      });
      if (ensured.success && ensured.pullRequest) {
        const prUrl = ensured.pullRequest.url;
        result.prUrl = prUrl;
        logger.info(`[merge-queue] Final PR ${ensured.action}: ${prUrl}`, { runId });

        // Save PR URL in run context
        const context = await getRunContext(runId);
        context["final_pr"] = prUrl;
        await updateRunContext(runId, context);
      } else {
        logger.error(`[merge-queue] Failed to ensure final PR: ${ensured.error}`, { runId });
      }
    } catch (prErr) {
      logger.error(`[merge-queue] Failed to prepare final PR: ${compactCommandError(prErr)}`, { runId });
    }
  }

  logger.info(`[merge-queue] Done — merged: ${result.merged.length}, conflicts: ${result.conflicted.length}, skipped: ${result.skipped.length}`, { runId });

  // Conflict threshold (2026-04-23 v2 — postmortem of Sprint 1 gap):
  // Three cases:
  //   a) conflicted > 0 && merged == 0 (all fail): retry individual stories with
  //      agent conflict-resolve prompt, then abort only if still all conflicted.
  //   b) conflicted > merged*2: too-skewed failure, abort.
  //   c) else: partial success, proceed with merged stories (conflicted recorded
  //      in stories.merge_status='conflict' for manual inspection).
  if (result.conflicted.length > 0 && result.merged.length === 0) {
    logger.error(`[merge-queue] All ${result.conflicted.length} stories conflicted, 0 merged — feature branch likely has schema drift. Run manual rebase: git fetch origin && git rebase origin/main. Or inspect scope_files overlap in stories.`, { runId });
    throw new Error(`[merge-queue] Zero merged, ${result.conflicted.length} conflicted — aborting (schema drift or full scope overlap)`);
  }
  if (result.conflicted.length > 0 && result.conflicted.length > result.merged.length * 2) {
    throw new Error(`[merge-queue] Too many conflicts (${result.conflicted.length}/${result.conflicted.length + result.merged.length}) — aborting`);
  }
  if (result.conflicted.length > 0) {
    logger.warn(`[merge-queue] ${result.conflicted.length} conflicts survived — proceeding with ${result.merged.length} merged stories`, { runId });
  }

  return result;
}
