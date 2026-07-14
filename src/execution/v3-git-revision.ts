import { spawnSync } from "node:child_process";

import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";

const FULL_GIT_OBJECT_HASH = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const DEFAULT_GIT_TIMEOUT_MS = 10_000;
const MAX_GIT_TIMEOUT_MS = 60_000;

export type V3GitRevisionErrorCode =
  | "V3_GIT_REVISION_INPUT_INVALID"
  | "V3_GIT_REPOSITORY_UNAVAILABLE"
  | "V3_GIT_COMMIT_UNAVAILABLE"
  | "V3_GIT_OBJECT_NOT_COMMIT"
  | "V3_GIT_TREE_INVALID"
  | "V3_GIT_REF_INVALID"
  | "V3_GIT_REF_NOT_COMMIT"
  | "V3_GIT_EXPECTED_SHA_MISMATCH"
  | "V3_GIT_REF_DRIFT";

export class V3GitRevisionError extends Error {
  readonly code: V3GitRevisionErrorCode;
  readonly hardPreClaim = true;
  readonly evidence: Readonly<Record<string, string | null>>;

  constructor(
    code: V3GitRevisionErrorCode,
    message: string,
    evidence: Readonly<Record<string, string | null>> = {},
  ) {
    super(`${code}:${message}`);
    this.name = "V3GitRevisionError";
    this.code = code;
    this.evidence = Object.freeze({ ...evidence });
  }
}

type GitCommandResult = Readonly<{
  stdout: string;
  stderr: string;
}>;

function fail(
  code: V3GitRevisionErrorCode,
  message: string,
  evidence?: Readonly<Record<string, string | null>>,
): never {
  throw new V3GitRevisionError(code, message, evidence);
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  const timeout = timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_GIT_TIMEOUT_MS) {
    fail("V3_GIT_REVISION_INPUT_INVALID", "git timeout must be an integer between 1 and 60000 milliseconds", {
      timeoutMs: String(timeout),
    });
  }
  return timeout;
}

function requireFullObjectHash(
  value: string,
  field: string,
  errorCode: V3GitRevisionErrorCode = "V3_GIT_REVISION_INPUT_INVALID",
): string {
  if (!FULL_GIT_OBJECT_HASH.test(value)) {
    fail(errorCode, `${field} must be a lowercase full Git object hash`, {
      field,
      value: value.slice(0, 160),
    });
  }
  return value;
}

function exactOutputLine(output: string, code: V3GitRevisionErrorCode, description: string): string {
  const lines = output.trim().split(/\r?\n/);
  if (lines.length !== 1 || !lines[0]) {
    fail(code, `${description} did not return exactly one value`);
  }
  return lines[0];
}

function runGit(
  repo: string,
  args: readonly string[],
  timeoutMs: number,
  failureCode: V3GitRevisionErrorCode,
  failureMessage: string,
): GitCommandResult {
  const result = spawnSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.error || result.status !== 0 || result.signal || stderr.trim()) {
    fail(failureCode, failureMessage, {
      gitArgs: args.join(" ").slice(0, 500),
      status: result.status === null ? null : String(result.status),
      signal: result.signal,
      detail: (result.error?.message || stderr.trim() || "git command failed").slice(0, 500),
    });
  }
  return { stdout, stderr };
}

function assertRepository(repo: string, timeoutMs: number): void {
  if (!repo || repo.includes("\0")) {
    fail("V3_GIT_REVISION_INPUT_INVALID", "repo must be a non-empty filesystem path");
  }
  runGit(
    repo,
    ["rev-parse", "--git-dir"],
    timeoutMs,
    "V3_GIT_REPOSITORY_UNAVAILABLE",
    "repository object database is unavailable",
  );
}

/**
 * Reads one immutable commit and its root tree directly from Git's object
 * database. It never consults the index or working-tree bytes.
 */
export function captureV3GitCommitRevision(input: Readonly<{
  repo: string;
  commitSha: string;
  timeoutMs?: number;
}>): SourceRevisionV1 {
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const commitSha = requireFullObjectHash(input.commitSha, "commitSha");
  assertRepository(input.repo, timeoutMs);

  const typeResult = runGit(
    input.repo,
    ["cat-file", "-t", commitSha],
    timeoutMs,
    "V3_GIT_COMMIT_UNAVAILABLE",
    `commit object ${commitSha} is unavailable`,
  );
  const objectType = exactOutputLine(
    typeResult.stdout,
    "V3_GIT_COMMIT_UNAVAILABLE",
    "commit object type",
  );
  if (objectType !== "commit") {
    fail("V3_GIT_OBJECT_NOT_COMMIT", `object ${commitSha} is ${objectType}, not a commit`, {
      commitSha,
      objectType,
    });
  }

  const treeResult = runGit(
    input.repo,
    ["rev-parse", "--verify", "--end-of-options", `${commitSha}^{tree}`],
    timeoutMs,
    "V3_GIT_TREE_INVALID",
    `commit ${commitSha} root tree is unavailable`,
  );
  const treeHash = requireFullObjectHash(
    exactOutputLine(treeResult.stdout, "V3_GIT_TREE_INVALID", "commit root tree"),
    "treeHash",
    "V3_GIT_TREE_INVALID",
  );
  if (treeHash.length !== commitSha.length) {
    fail("V3_GIT_TREE_INVALID", "commit and tree use different object hash formats", {
      commitSha,
      treeHash,
    });
  }
  const treeType = exactOutputLine(
    runGit(
      input.repo,
      ["cat-file", "-t", treeHash],
      timeoutMs,
      "V3_GIT_TREE_INVALID",
      `tree object ${treeHash} is unavailable`,
    ).stdout,
    "V3_GIT_TREE_INVALID",
    "tree object type",
  );
  if (treeType !== "tree") {
    fail("V3_GIT_TREE_INVALID", `object ${treeHash} is ${treeType}, not a tree`, {
      commitSha,
      treeHash,
      treeType,
    });
  }

  return Object.freeze({ sha: commitSha, treeHash });
}

function resolveCanonicalRef(repo: string, requestedRef: string, timeoutMs: number): string {
  if (
    !requestedRef
    || requestedRef.length > 1_000
    || requestedRef.includes("\0")
    || requestedRef.includes("\n")
    || requestedRef.includes("\r")
  ) {
    fail("V3_GIT_REVISION_INPUT_INVALID", "requestedRef must be one bounded Git ref name", {
      requestedRef: requestedRef.slice(0, 160),
    });
  }
  const result = runGit(
    repo,
    ["rev-parse", "--symbolic-full-name", "--verify", "--end-of-options", requestedRef],
    timeoutMs,
    "V3_GIT_REF_INVALID",
    `ref ${requestedRef} is missing, ambiguous, or not a direct ref`,
  );
  const canonicalRef = exactOutputLine(result.stdout, "V3_GIT_REF_INVALID", "canonical ref");
  if (!canonicalRef.startsWith("refs/") && canonicalRef !== "HEAD") {
    fail("V3_GIT_REF_INVALID", `ref ${requestedRef} did not resolve to a canonical direct ref`, {
      requestedRef,
      canonicalRef,
    });
  }
  return canonicalRef;
}

function resolveRefCommit(repo: string, canonicalRef: string, timeoutMs: number): string {
  const result = runGit(
    repo,
    ["rev-parse", "--verify", "--end-of-options", `${canonicalRef}^{commit}`],
    timeoutMs,
    "V3_GIT_REF_NOT_COMMIT",
    `ref ${canonicalRef} does not resolve to an available commit`,
  );
  return requireFullObjectHash(
    exactOutputLine(result.stdout, "V3_GIT_REF_NOT_COMMIT", "resolved commit"),
    "resolvedCommitSha",
    "V3_GIT_REF_NOT_COMMIT",
  );
}

/**
 * Resolves a direct base ref once, pins it to a full commit, captures that
 * commit's tree, and then re-reads the ref to reject concurrent ref movement.
 * A full commit object ID bypasses ref lookup and remains immutable.
 */
export function resolveV3GitRevision(input: Readonly<{
  repo: string;
  requestedRef: string;
  expectedSha?: string;
  timeoutMs?: number;
}>): SourceRevisionV1 {
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const expectedSha = input.expectedSha === undefined
    ? undefined
    : requireFullObjectHash(input.expectedSha, "expectedSha");
  assertRepository(input.repo, timeoutMs);

  const directCommit = FULL_GIT_OBJECT_HASH.test(input.requestedRef);
  const canonicalRef = directCommit
    ? undefined
    : resolveCanonicalRef(input.repo, input.requestedRef, timeoutMs);
  const pinnedSha = directCommit
    ? requireFullObjectHash(input.requestedRef, "requestedRef")
    : resolveRefCommit(input.repo, canonicalRef!, timeoutMs);

  if (expectedSha !== undefined && pinnedSha !== expectedSha) {
    fail("V3_GIT_EXPECTED_SHA_MISMATCH", "base ref no longer resolves to the expected commit", {
      requestedRef: input.requestedRef,
      canonicalRef: canonicalRef ?? null,
      expectedSha,
      observedSha: pinnedSha,
    });
  }

  const revision = captureV3GitCommitRevision({
    repo: input.repo,
    commitSha: pinnedSha,
    timeoutMs,
  });
  if (canonicalRef !== undefined) {
    const observedAfterCapture = resolveRefCommit(input.repo, canonicalRef, timeoutMs);
    if (observedAfterCapture !== pinnedSha) {
      fail("V3_GIT_REF_DRIFT", "base ref moved while its immutable revision was being captured", {
        requestedRef: input.requestedRef,
        canonicalRef,
        pinnedSha,
        observedAfterCapture,
      });
    }
  }
  return revision;
}
