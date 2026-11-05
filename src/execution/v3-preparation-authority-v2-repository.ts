import type postgres from "postgres";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { Sha256Schema, NormalizedRelativeLocatorSchema } from "../product-compiler/schemas/common-v1.js";
import { createRuntimeArtifactReader } from "../product-compiler/runtime-artifact-reader.js";
import type { ArtifactCapacityLimits } from "../product-compiler/artifact-capacity.js";
import { resolveProductArtifactDir, resolveProductArtifactCapacity } from "../runtime-config.js";
import { topologyPathAbsenceHash } from "../product-compiler/schemas/build-topology-v1.js";
import { LegacyImplementationSliceV2Schema } from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import { V3ImplementationAgentOutputV1Schema } from "./v3-implementation-output.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import { V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS } from "./v3-source-snapshot-v2.js";
import { createV3PreparationClaimAuthorityV1, type V3PreparationClaimAuthorityV1 } from "./v3-preparation-claim-authority.js";
import {
  V3PreparationClaimAuthorityV2Schema,
  type V3PreparationClaimAuthorityV2,
  V3PreparationDependencyAttemptAuthorityV2Schema,
  type V3PreparationDependencyAttemptAuthorityV2,
} from "./v3-preparation-claim-authority-v2.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export type V3NativePreparationArtifacts = Readonly<{ artifactRoot: string; artifactLimits: ArtifactCapacityLimits }>;

export function createV3NativePreparationArtifactReader(sql: Sql, artifacts?: V3NativePreparationArtifacts) {
  return createRuntimeArtifactReader({ sql,
    artifactRoot: artifacts?.artifactRoot ?? resolveProductArtifactDir(),
    artifactLimits: artifacts?.artifactLimits ?? resolveProductArtifactCapacity() });
}

/** Recover the original V1 scheduling bytes from the lossless paired V2 authority. */
export function readinessFromNativePreparationV2(authority: V3PreparationClaimAuthorityV2): V3PreparationClaimAuthorityV1 {
  return createV3PreparationClaimAuthorityV1({
    stateVersion: authority.stateVersion, runId: authority.runId, stepId: authority.stepId,
    storyId: authority.storyId, packetHash: authority.packetHash, baseRevision: authority.baseRevision,
    projectedDependencyIds: [...authority.projectedDependencyIds],
    dependencyAttempts: authority.dependencyAttempts.map(dependency => ({
      storyId: dependency.storyId, attemptId: dependency.attemptId, attemptClass: dependency.attemptClass,
      disposition: dependency.disposition, sourceRevision: dependency.sourceAfter,
    })),
  });
}

const NATIVE_GIT_CUSTODY_REF_PREFIX = "setfarm://native-git-custody-v1/";
type NativeGitQuery = Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">;
type NativeGitCustodyInput = Readonly<{
  runId: string; claimId: number; worktree: string; branch: string; sourceBefore: SourceRevisionV1;
}>;

function nativeCustodyEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_NO_REPLACE_OBJECTS: "1" };
  // The canonical repository argument owns object lookup, never inherited Git
  // redirection to a different worktree, index, common directory or object store.
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_NAMESPACE"]) delete env[key];
  return env;
}

function nativeCustodyGit(repo: string, args: string[]): string {
  return execFileSync("git", ["--no-replace-objects", "--literal-pathspecs", ...args], {
    cwd: repo, timeout: 10_000, maxBuffer: 16_384, encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"], env: nativeCustodyEnvironment(),
  }).trim();
}

function nativeGitCommonDirectory(repo: string) {
  const reported = nativeCustodyGit(repo, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (!path.isAbsolute(reported) || /[\r\n\0]/.test(reported)) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_INVALID", "Git common directory must be one absolute path");
  }
  const directory = realpathSync(reported);
  const stat = lstatSync(directory, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_INVALID", "Git common directory is not a canonical directory");
  }
  return { path: directory, dev: stat.dev.toString(), ino: stat.ino.toString() };
}

function nativeCustodyRevision(repo: string, sha: string): SourceRevisionV1 {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)
    || nativeCustodyGit(repo, ["cat-file", "-t", sha]) !== "commit") {
    repositoryFail("V3_NATIVE_ORIGINAL_SOURCE_MISMATCH", "native source must identify an exact commit object");
  }
  const treeHash = nativeCustodyGit(repo, ["rev-parse", "--verify", "--end-of-options", `${sha}^{tree}`]);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(treeHash) || treeHash.length !== sha.length) {
    repositoryFail("V3_NATIVE_ORIGINAL_SOURCE_MISMATCH", "native source must retain its exact Git root tree");
  }
  return { sha, treeHash };
}

async function nativeCanonicalRunRepository(query: NativeGitQuery, input: NativeGitCustodyInput) {
  const rows = await query.unsafe<Array<{ context: string }>>(
    `SELECT r.context FROM runs r JOIN claim_log c ON c.run_id=r.id
      WHERE r.id=$1 AND c.id=$2 AND r.protocol='v3' AND r.status IN ('running','resuming')`,
    [input.runId, input.claimId]);
  if (rows.length !== 1) repositoryFail("V3_NATIVE_GIT_CUSTODY_RUN_INVALID", "native locator requires the actual active run and claim");
  const context: unknown = JSON.parse(rows[0]!.context);
  if (!context || typeof context !== "object" || Array.isArray(context) || !("repo" in context)
    || typeof context.repo !== "string" || !path.isAbsolute(context.repo) || /[\r\n\0]/.test(context.repo)) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_RUN_INVALID", "active run has no canonical repository locator");
  }
  const repo = realpathSync(context.repo);
  const stat = lstatSync(repo);
  if (!stat.isDirectory() || stat.isSymbolicLink()) repositoryFail("V3_NATIVE_GIT_CUSTODY_RUN_INVALID", "run repository is not a directory");
  const common = nativeGitCommonDirectory(repo);
  const ref = `refs/heads/${input.branch}`;
  nativeCustodyGit(repo, ["check-ref-format", ref]);
  const retainedCommit = nativeCustodyGit(repo, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(retainedCommit)) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_BRANCH_INVALID", "original branch has no retained exact commit");
  }
  const original = nativeCustodyRevision(repo, input.sourceBefore.sha);
  if (canonicalJsonStringify(original) !== canonicalJsonStringify(input.sourceBefore)) {
    repositoryFail("V3_NATIVE_ORIGINAL_SOURCE_MISMATCH", "canonical repository does not reproduce the original pinned tree");
  }
  nativeCustodyGit(repo, ["merge-base", "--is-ancestor", input.sourceBefore.sha, retainedCommit]);
  const witness = {
    runId: input.runId, claimId: input.claimId, repo, common,
    worktree: input.worktree, branch: input.branch, sourceBefore: input.sourceBefore,
  };
  return { runRepo: context.repo, repo, common, retainedCommit,
    evidenceRef: NATIVE_GIT_CUSTODY_REF_PREFIX + createHash("sha256").update(canonicalJsonStringify(witness)).digest("hex") };
}

const authenticatedNativeGitCustodies = new WeakMap<object, string>();
export type AuthenticatedNativeGitCustody = Readonly<{
  owner: NativeGitCustodyInput; runRepo: string; evidenceRef: string;
}>;

/** Complete Git and canonical filesystem observations before reservation's
 * transaction. No caller supplies a custody URI or repository locator. */
export async function authenticateNativeGitCustody(query: NativeGitQuery, input: NativeGitCustodyInput): Promise<AuthenticatedNativeGitCustody> {
  const canonical = await nativeCanonicalRunRepository(query, input);
  const worktreeCommon = nativeGitCommonDirectory(input.worktree);
  if (canonicalJsonStringify(worktreeCommon) !== canonicalJsonStringify(canonical.common)
    || nativeCustodyGit(input.worktree, ["symbolic-ref", "HEAD"]) !== `refs/heads/${input.branch}`) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_ORIGIN_MISMATCH", "original worktree is not the canonical run repository's exact branch");
  }
  const snapshot = Object.freeze({
    owner: Object.freeze({ ...input, sourceBefore: Object.freeze({ ...input.sourceBefore }) }),
    runRepo: canonical.runRepo, evidenceRef: canonical.evidenceRef,
  });
  authenticatedNativeGitCustodies.set(snapshot, canonicalJsonStringify(snapshot));
  return snapshot;
}

/** Existing reservation already holds its advisory/run locks. Recheck only DB
 * identity through that same transaction; never perform Git or a pool query. */
export async function recheckNativeGitCustodyInTransaction(transaction: TransactionSql, snapshot: AuthenticatedNativeGitCustody): Promise<void> {
  if (authenticatedNativeGitCustodies.get(snapshot) !== canonicalJsonStringify(snapshot)) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_UNAUTHENTICATED", "custody snapshot was not produced by original Git authentication");
  }
  const rows = await transaction.unsafe<Array<{ repo: string }>>(
    `SELECT r.context::jsonb->>'repo' AS repo FROM runs r JOIN claim_log c ON c.run_id=r.id
      WHERE r.id=$1 AND c.id=$2 AND r.protocol='v3' AND r.status IN ('running','resuming')`,
    [snapshot.owner.runId, snapshot.owner.claimId]);
  if (rows.length !== 1 || rows[0]!.repo !== snapshot.runRepo) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_RUN_CHANGED", "actual canonical run repository changed before reservation");
  }
}

async function nativeAttemptGitLocator(query: NativeGitQuery, input: Readonly<{
  runId: string; attemptId: string; source: SourceRevisionV1;
}>) {
  const rows = await query.unsafe<Array<{
    claim_id: string | null; branch: string | null; worktree: string | null; evidence_refs: string;
    source_before_sha: string; source_before_tree_hash: string;
    source_after_sha: string | null; source_after_tree_hash: string | null; accepted: boolean;
    recovery_dispatch_id: string | null; attempt_class: string;
  }>>(`SELECT a.claim_id::text,a.branch,a.worktree,a.evidence_refs,
      a.source_before_sha,a.source_before_tree_hash,a.source_after_sha,a.source_after_tree_hash,a.recovery_dispatch_id,a.attempt_class,
      EXISTS (SELECT 1 FROM runtime_completion_requests q
        JOIN runtime_sessions s ON s.session_id=q.runtime_session_id AND s.attempt_id=a.attempt_id
          AND s.claim_id=a.claim_id AND s.run_id=a.run_id AND s.story_id=a.story_id
          AND s.step_db_id=q.step_db_id AND s.workflow_step_id=a.step_id
        JOIN claim_log c ON c.id=a.claim_id AND c.run_id=a.run_id AND c.story_id=a.story_id AND c.step_id=a.step_id
        WHERE q.attempt_id=a.attempt_id AND q.claim_id=a.claim_id AND q.run_id=a.run_id
          AND q.story_id=a.story_id AND q.workflow_step_id=a.step_id AND q.output_hash=a.output_hash
          AND q.state='accepted' AND q.apply_phase='effects_committed' AND q.claim_outcome='completed'
          AND s.state='released' AND c.outcome='completed'
          AND a.disposition IN ('produced_delta','already_satisfied','verified')) AS accepted
    FROM execution_attempts a WHERE a.run_id=$1 AND a.attempt_id=$2`, [input.runId, input.attemptId]);
  const row = rows[0];
  if (rows.length !== 1 || !row?.claim_id || !row.branch || !row.worktree) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_ATTEMPT_INVALID", "native attempt lacks its exact original owner/branch/worktree");
  }
  const sourceBefore = { sha: row.source_before_sha, treeHash: row.source_before_tree_hash };
  const sourceAfter = row.source_after_sha && row.source_after_tree_hash
    ? { sha: row.source_after_sha, treeHash: row.source_after_tree_hash } : undefined;
  if (canonicalJsonStringify(input.source) !== canonicalJsonStringify(sourceBefore)
    && (!sourceAfter || canonicalJsonStringify(input.source) !== canonicalJsonStringify(sourceAfter))) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_SOURCE_INVALID", "requested object is not the attempt's pinned original or candidate");
  }
  const owner = { runId: input.runId, claimId: claimId(row.claim_id), branch: row.branch,
    worktree: row.worktree, sourceBefore };
  const refs: unknown = JSON.parse(row.evidence_refs);
  if (!Array.isArray(refs) || refs.some(ref => typeof ref !== "string")) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_REFERENCE_INVALID", "attempt evidence references are not a string array");
  }
  let custodyOwner = owner;
  if (row.recovery_dispatch_id || row.attempt_class === "infrastructure_retry") {
    const originRefs = refs.filter((ref: string) => ref.startsWith("setfarm://preparation-authority-v2/"));
    if (originRefs.length !== 1) repositoryFail("V3_NATIVE_GIT_CUSTODY_REFERENCE_INVALID", "successor must retain one initial authority");
    const origins = await query.unsafe<Array<{ claim_id: string; branch: string; worktree: string;
      source_before_sha: string; source_before_tree_hash: string; evidence_refs: string }>>(
      `SELECT initial.claim_id::text,initial.branch,initial.worktree,initial.source_before_sha,
          initial.source_before_tree_hash,initial.evidence_refs
       FROM v3_preparation_authority_attempts_v2 b
       JOIN execution_attempts initial ON initial.attempt_id=b.attempt_id AND initial.claim_id=b.claim_id AND initial.slice_hash=b.slice_hash
       JOIN execution_attempts successor ON successor.run_id=initial.run_id AND successor.step_id=initial.step_id
         AND successor.story_id=initial.story_id AND successor.packet_hash=initial.packet_hash
         AND successor.compilation_report_hash=initial.compilation_report_hash
       LEFT JOIN internal_production_v3_recovery_claim_publications_v1 p ON p.claim_id=successor.claim_id
         AND p.run_id=successor.run_id AND p.workflow_step_id=successor.step_id AND p.story_id=successor.story_id
         AND p.dispatch_id=successor.recovery_dispatch_id AND p.revision_id=successor.recovery_case_revision_id
       WHERE b.authority_hash=$1 AND successor.attempt_id=$2 AND successor.run_id=$3
         AND initial.attempt_class='product_implementation' AND initial.role='developer'
         AND initial.recovery_dispatch_id IS NULL AND initial.recovery_case_revision_id IS NULL
         AND (p.claim_id IS NOT NULL OR (
           successor.attempt_class='infrastructure_retry' AND successor.role='developer'
           AND successor.recovery_dispatch_id IS NULL AND successor.recovery_case_revision_id IS NULL
           AND successor.generation=initial.generation+1 AND successor.slice_hash=initial.slice_hash
           AND successor.source_before_sha=initial.source_before_sha AND successor.source_before_tree_hash=initial.source_before_tree_hash
           AND initial.disposition='inconclusive' AND EXISTS(SELECT 1 FROM claim_log prior
             WHERE prior.id=initial.claim_id AND prior.run_id=initial.run_id AND prior.step_id=initial.step_id
               AND prior.story_id=initial.story_id AND prior.outcome='infra_retry')
         ) OR (
           successor.attempt_class='evidence_only' AND successor.role='evidence-orchestrator'
           AND successor.generation=initial.generation+1 AND successor.slice_hash=initial.slice_hash
           AND successor.source_before_sha=initial.source_after_sha AND successor.source_before_tree_hash=initial.source_after_tree_hash
           AND EXISTS(SELECT 1 FROM recovery_dispatch_deliveries delivery
             JOIN recovery_revision_dispatches dispatch ON dispatch.dispatch_id=delivery.dispatch_id AND dispatch.revision_id=delivery.revision_id
             JOIN recovery_case_revisions revision ON revision.revision_id=dispatch.revision_id
             JOIN recovery_cases c ON c.recovery_case_id=revision.recovery_case_id AND c.current_revision_id=revision.revision_id
             WHERE delivery.attempt_id=successor.attempt_id AND delivery.claim_id=successor.claim_id
               AND delivery.run_id=successor.run_id AND delivery.story_id=successor.story_id AND delivery.attempt_count=1
               AND delivery.execution_slice_hash=successor.slice_hash AND dispatch.dispatch_class='evidence_only'
               AND dispatch.dispatch_id=successor.recovery_dispatch_id AND revision.revision_id=successor.recovery_case_revision_id
               AND revision.revision_number=1 AND revision.parent_revision_id IS NULL AND revision.owner='infrastructure'
               AND revision.packet_hash=successor.packet_hash AND revision.contract_slice_hash=initial.slice_hash
               AND revision.finding_set_hash=successor.finding_set_hash AND c.prior_attempt_refs::jsonb ? initial.attempt_id
               AND revision.source_sha=successor.source_before_sha AND revision.source_tree_hash=successor.source_before_tree_hash)
         ))`,
      [originRefs[0]!.slice("setfarm://preparation-authority-v2/".length), input.attemptId, input.runId]);
    const origin = origins[0];
    if (origins.length !== 1 || !origin?.branch || !origin.worktree
      || canonicalJsonStringify(JSON.parse(origin.evidence_refs).filter((ref: string) => ref.startsWith(NATIVE_GIT_CUSTODY_REF_PREFIX)))
        !== canonicalJsonStringify(refs.filter((ref: string) => ref.startsWith(NATIVE_GIT_CUSTODY_REF_PREFIX)))) {
      repositoryFail("V3_NATIVE_GIT_CUSTODY_REFERENCE_INVALID", "successor custody must equal the genuine initial reservation witness");
    }
    custodyOwner = { runId: input.runId, claimId: claimId(origin.claim_id), branch: origin.branch,
      worktree: origin.worktree, sourceBefore: { sha: origin.source_before_sha, treeHash: origin.source_before_tree_hash } };
  }
  const canonical = await nativeCanonicalRunRepository(query, custodyOwner);
  const custody = refs.filter((ref: string) => ref.startsWith(NATIVE_GIT_CUSTODY_REF_PREFIX));
  if (custody.length > 1 || (custody.length === 1 && custody[0] !== canonical.evidenceRef)) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_REFERENCE_INVALID", "original custody witness is ambiguous or differs from the canonical repository");
  }
  let worktreeExists = true;
  try { lstatSync(row.worktree); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") worktreeExists = false;
    else throw error;
  }
  if (worktreeExists) {
    const current = nativeGitCommonDirectory(row.worktree);
    if (canonicalJsonStringify(current) !== canonicalJsonStringify(canonical.common)) {
      repositoryFail("V3_NATIVE_GIT_CUSTODY_ORIGIN_MISMATCH", "surviving original worktree belongs to another Git object database");
    }
  } else if (!row.accepted || custody.length !== 1) {
    // No backfill from matching objects: a removed historical worktree without
    // its original reservation witness cannot establish common-dir custody.
    repositoryFail("V3_NATIVE_GIT_CUSTODY_WITNESS_REQUIRED", "removed worktree requires its genuine original witness and accepted/released tuple");
  }
  const actual = nativeCustodyRevision(canonical.repo, input.source.sha);
  if (canonicalJsonStringify(actual) !== canonicalJsonStringify(input.source)) {
    repositoryFail("V3_NATIVE_ORIGINAL_SOURCE_MISMATCH", "canonical source object does not reproduce its pinned root tree");
  }
  const ownRef = `refs/heads/${row.branch}`;
  nativeCustodyGit(canonical.repo, ["check-ref-format", ownRef]);
  const retainedCommit = nativeCustodyGit(canonical.repo, ["rev-parse", "--verify", "--end-of-options", `${ownRef}^{commit}`]);
  nativeCustodyGit(canonical.repo, ["merge-base", "--is-ancestor", input.source.sha, retainedCommit]);
  if (sourceAfter) nativeCustodyGit(canonical.repo, ["merge-base", "--is-ancestor", sourceBefore.sha, sourceAfter.sha]);
  return { ...canonical, retainedAttemptCommit: retainedCommit };
}

/** Reads regular immutable blobs only; never substitutes current working bytes.
 * Recheck locator identity around the bounded existing snapshot capture. */
export async function captureNativeAttemptFileSignatures(query: NativeGitQuery, input: Readonly<{
  runId: string; attemptId: string; source: SourceRevisionV1;
  files: readonly Readonly<{ pathRef: string; path: string }>[];
}>) {
  const before = await nativeAttemptGitLocator(query, input);
  const files = captureNativeOriginalFileSignatures({ worktree: before.repo, source: input.source, files: input.files });
  const after = await nativeAttemptGitLocator(query, input);
  if (canonicalJsonStringify(before) !== canonicalJsonStringify(after)) {
    repositoryFail("V3_NATIVE_GIT_CUSTODY_CHANGED", "canonical repository or retained branch changed during immutable capture");
  }
  return files;
}

/** Immutable Git objects, never the current worktree, are original source authority. */
export function captureNativeOriginalFileSignatures(input: Readonly<{
  worktree: string; source: SourceRevisionV1; files: readonly Readonly<{ pathRef: string; path: string }>[];
}>) {
  const actual = nativeCustodyRevision(input.worktree, input.source.sha);
  if (canonicalJsonStringify(actual) !== canonicalJsonStringify(input.source)) {
    repositoryFail("V3_NATIVE_ORIGINAL_SOURCE_MISMATCH", "original commit does not reproduce its pinned root tree");
  }
  const limits = V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS;
  if (input.files.length > limits.maxFiles || new Set(input.files.map(file => file.pathRef)).size !== input.files.length) {
    repositoryFail("V3_NATIVE_ORIGINAL_FILES_INVALID", "original file closure is duplicated or exceeds capacity");
  }
  let total = 0;
  const runGit = (args: string[], maxBuffer: number) => execFileSync("git", ["--no-replace-objects", "--literal-pathspecs", ...args], {
    cwd: input.worktree, timeout: 10_000, maxBuffer, stdio: ["ignore", "pipe", "pipe"],
    env: nativeCustodyEnvironment(),
  });
  return [...input.files].sort((a, b) => a.pathRef < b.pathRef ? -1 : a.pathRef > b.pathRef ? 1 : 0).map(file => {
    NormalizedRelativeLocatorSchema.parse(file.path);
    // Literal pathspec prevents wildcard paths from selecting unrelated objects.
    const listed = runGit(["ls-tree", "-z", input.source.sha, "--", file.path], 16_384).toString("utf8");
    if (!listed) return { ...file, presence: "absent" as const, contentHash: topologyPathAbsenceHash(file.path) };
    const match = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0]+)\0$/.exec(listed);
    if (!match || match[3] !== file.path) {
      repositoryFail("V3_NATIVE_ORIGINAL_FILE_TYPE_INVALID", "original source must be one regular Git blob");
    }
    const bytes = runGit(["cat-file", "blob", match[2]!], limits.maxFileBytes + 1);
    total += bytes.byteLength;
    if (bytes.byteLength > limits.maxFileBytes || total > limits.maxTotalBytes) {
      repositoryFail("V3_NATIVE_ORIGINAL_SOURCE_CAPACITY", "original source exceeds snapshot capacity");
    }
    return { ...file, presence: "present" as const, contentHash: createHash("sha256").update(bytes).digest("hex") };
  });
}

export async function readV3NativeIndexedArtifact(reader: ReturnType<typeof createRuntimeArtifactReader>, hash: string) {
  const [indexed, stored] = await Promise.all([reader.index.getArtifact(hash), reader.store.get(hash)]);
  if (!indexed || indexed.artifactType !== stored.envelope.artifactType
    || indexed.byteLength !== stored.bytes.byteLength
    || canonicalJsonStringify(indexed.producer) !== canonicalJsonStringify(stored.envelope.producer)) {
    repositoryFail("V3_NATIVE_ARTIFACT_INDEX_MISMATCH", "native artifact index does not authenticate the immutable CAS bytes");
  }
  return stored.envelope;
}

/** Enrich exactly the selected row; never query a newer terminal generation. */
export async function readV3NativeDependencyAuthority(
  sql: Sql, query: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  input: Readonly<{ runId: string; stepId: string; packetHash: string; storyId: string; attemptId: string }>,
  artifacts?: V3NativePreparationArtifacts,
): Promise<V3PreparationDependencyAttemptAuthorityV2> {
  const rows = await query.unsafe<Array<{
    attempt_id: string; generation: number; attempt_class: string; disposition: string;
    slice_hash: string | null; output_hash: string | null; source_after_sha: string | null;
    source_after_tree_hash: string | null; source_before_sha: string; source_before_tree_hash: string;
    worktree: string | null; output: string;
  }>>(`SELECT a.attempt_id,a.generation,a.attempt_class,a.disposition,a.slice_hash,a.output_hash,
      a.source_after_sha,a.source_after_tree_hash,a.source_before_sha,a.source_before_tree_hash,a.worktree,c.output
    FROM execution_attempts a JOIN runtime_completion_requests c
      ON c.attempt_id=a.attempt_id AND c.claim_id=a.claim_id AND c.run_id=a.run_id
      AND c.story_id=a.story_id AND c.output_hash=a.output_hash
    WHERE a.attempt_id=$1 AND a.run_id=$2 AND a.step_id=$3 AND a.packet_hash=$4 AND a.story_id=$5
      AND a.attempt_class IN ('product_implementation','supervisor_repair')
      AND a.disposition IN ('produced_delta','already_satisfied','verified')
      AND c.state='accepted' AND c.apply_phase='effects_committed'`,
  [input.attemptId, input.runId, input.stepId, input.packetHash, input.storyId]);
  const row = rows[0];
  if (rows.length !== 1 || !row?.slice_hash || !row.output_hash || !row.source_after_sha
    || !row.source_after_tree_hash || !row.worktree
    || createHash("sha256").update(row.output, "utf8").digest("hex") !== row.output_hash) {
    repositoryFail("V3_NATIVE_DEPENDENCY_OUTPUT_INVALID", "selected terminal row lacks its exact accepted output/source witness");
  }
  const reader = createV3NativePreparationArtifactReader(sql, artifacts);
  const envelope = await readV3NativeIndexedArtifact(reader, row.slice_hash);
  const slice = LegacyImplementationSliceV2Schema.parse(envelope.payload);
  const output = V3ImplementationAgentOutputV1Schema.parse(JSON.parse(row.output));
  const packet = await reader.readExactSealedPacket(input.runId);
  if (!("implementationSourceMap" in packet) || envelope.artifactType !== "setfarm.implementation-slice.v2"
    || canonicalJsonStringify(envelope.producer) !== canonicalJsonStringify(packet.producer)
    || slice.packetHash !== input.packetHash || slice.storyId !== input.storyId
    || output.disposition !== "ready_for_evidence" || output.attemptId !== input.attemptId
    || output.packetHash !== input.packetHash || output.sliceHash !== row.slice_hash
    || output.sourceBefore.sha !== row.source_before_sha || output.sourceBefore.treeHash !== row.source_before_tree_hash
    || slice.sourceRevision.sha !== row.source_before_sha || slice.sourceRevision.treeHash !== row.source_before_tree_hash) {
    repositoryFail("V3_NATIVE_DEPENDENCY_IDENTITY_MISMATCH", "terminal native slice/output is crossed with another attempt");
  }
  const story = packet.storyPlan.stories.find(story => story.id === input.storyId);
  if (!story) repositoryFail("V3_NATIVE_DEPENDENCY_STORY_MISSING", "terminal story absent from native packet");
  const files = packet.buildTopology.pathBindings.filter(binding => story.ownedPathRefs.includes(binding.id))
    .map(binding => ({ pathRef: binding.id, path: binding.path }));
  const sourceAfter = { sha: row.source_after_sha, treeHash: row.source_after_tree_hash };
  return V3PreparationDependencyAttemptAuthorityV2Schema.parse({ storyId: input.storyId,
    attemptId: row.attempt_id, attemptGeneration: row.generation, attemptClass: row.attempt_class,
    disposition: row.disposition, sliceHash: row.slice_hash, outputHash: row.output_hash, sourceAfter,
    fileSignatures: await captureNativeAttemptFileSignatures(query, { runId: input.runId,
      attemptId: row.attempt_id, source: sourceAfter, files }) });
}

export type V3PreparationAuthorityV2PublicationStatus = "published" | "duplicate";

export class V3PreparationAuthorityV2RepositoryError extends Error {
  readonly code: string;
  override readonly cause?: unknown;

  constructor(code: string, message: string, options: Readonly<{ cause?: unknown }> = {}) {
    super(`${code}: ${message}`);
    this.name = "V3PreparationAuthorityV2RepositoryError";
    this.code = code;
    this.cause = options.cause;
  }
}

function repositoryFail(code: string, message: string, cause?: unknown): never {
  throw new V3PreparationAuthorityV2RepositoryError(code, message, { cause });
}

function claimId(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    repositoryFail("V3_PREPARATION_AUTHORITY_V2_CLAIM_ID_INVALID", "claim ID must be a positive safe integer");
  }
  return parsed;
}

function attemptId(value: unknown): string {
  if (typeof value !== "string" || !/^ATT_[A-Za-z0-9-]{16,160}$/.test(value)) {
    repositoryFail("V3_PREPARATION_AUTHORITY_V2_ATTEMPT_ID_INVALID", "attempt ID is invalid");
  }
  return value;
}

function isConstraintViolation(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && ["23503", "23505", "23514"].includes(String(error.code));
}

type AuthorityRow = Readonly<{
  authority_hash: string;
  authority_payload: unknown;
}>;

async function readAuthorityRow(
  sql: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  authorityHash: string,
): Promise<AuthorityRow | undefined> {
  const rows = await sql.unsafe<AuthorityRow[]>(
    `SELECT authority_hash, authority_payload
       FROM public.v3_preparation_authorities_v2
      WHERE authority_hash = $1`,
    [authorityHash],
  );
  return rows[0];
}

function parseAuthorityRow(row: AuthorityRow): V3PreparationClaimAuthorityV2 {
  const parsed = V3PreparationClaimAuthorityV2Schema.safeParse(
    typeof row.authority_payload === "string"
      ? JSON.parse(row.authority_payload)
      : row.authority_payload,
  );
  if (!parsed.success || parsed.data.authorityHash !== row.authority_hash) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_STORED_PAYLOAD_INVALID",
      "stored preparation authority does not reproduce its canonical hash",
      parsed.success ? undefined : parsed.error,
    );
  }
  return parsed.data;
}

export async function readV3PreparationAuthorityV2(
  sql: Sql | TransactionSql,
  authorityHashInput: string,
): Promise<V3PreparationClaimAuthorityV2 | undefined> {
  const authorityHash = Sha256Schema.parse(authorityHashInput);
  const row = await readAuthorityRow(sql, authorityHash);
  return row ? parseAuthorityRow(row) : undefined;
}

export async function readV3PreparationAuthorityByClaimV2(sql: Sql | TransactionSql, claimIdInput: number) {
  const rows = await sql.unsafe<Array<{ authority_hash: string }>>(
    "SELECT authority_hash FROM v3_preparation_authority_claims_v2 WHERE claim_id=$1", [claimId(claimIdInput)]);
  if (rows.length > 1) repositoryFail("V3_NATIVE_CLAIM_AMBIGUOUS", "claim has multiple native origins");
  return rows[0] ? readV3PreparationAuthorityV2(sql, rows[0].authority_hash) : undefined;
}

export async function readV3PreparationAuthorityByAttemptV2(sql: Sql | TransactionSql, attemptIdInput: string) {
  const rows = await sql.unsafe<Array<{ authority_hash: string; claim_id: string; slice_hash: string }>>(
    "SELECT authority_hash,claim_id::text,slice_hash FROM v3_preparation_authority_attempts_v2 WHERE attempt_id=$1",
    [attemptId(attemptIdInput)]);
  if (rows.length > 1) repositoryFail("V3_NATIVE_ATTEMPT_AMBIGUOUS", "attempt has multiple native origins");
  if (!rows[0]) return undefined;
  const authority = await readV3PreparationAuthorityV2(sql, rows[0].authority_hash);
  if (!authority) repositoryFail("V3_NATIVE_ATTEMPT_ORIGIN_MISSING", "bound native authority is absent");
  return { authority, claimId: claimId(rows[0].claim_id), sliceHash: rows[0].slice_hash };
}

const authenticatedNativePreparations = new WeakMap<object, string>();
const NATIVE_AUTHENTICATED = Symbol("native-authenticated-preparation");
export type AuthenticatedV3NativePreparation = Readonly<{
  [NATIVE_AUTHENTICATED]: true;
  readiness: V3PreparationClaimAuthorityV1;
  nativeAuthority?: V3PreparationClaimAuthorityV2;
}>;

/** Complete immutable CAS/Git reads before taking any transaction/row locks. */
export async function authenticateV3NativePreparation(
  sql: Sql,
  input: Readonly<{ readiness: V3PreparationClaimAuthorityV1; nativeAuthority?: V3PreparationClaimAuthorityV2;
    artifacts?: V3NativePreparationArtifacts }>,
): Promise<AuthenticatedV3NativePreparation> {
  const rows = await sql.unsafe<Array<{ artifact_type: string }>>(
    `SELECT a.artifact_type FROM product_packets p JOIN semantic_artifacts a ON a.artifact_hash=p.packet_hash
      WHERE p.run_id=$1 AND p.packet_hash=$2`, [input.readiness.runId, input.readiness.packetHash]);
  const isNative = rows.length === 1 && rows[0]!.artifact_type === "setfarm.product-build-packet.v3";
  const seal = (nativeAuthority?: V3PreparationClaimAuthorityV2): AuthenticatedV3NativePreparation => {
    const value = Object.freeze({ [NATIVE_AUTHENTICATED]: true as const,
      readiness: input.readiness, ...(nativeAuthority ? { nativeAuthority } : {}) });
    authenticatedNativePreparations.set(value, canonicalJsonStringify({ readiness: value.readiness, nativeAuthority: nativeAuthority ?? null }));
    return value;
  };
  if (!isNative && !input.nativeAuthority) return seal();
  if (!isNative || !input.nativeAuthority) {
    repositoryFail("V3_NATIVE_PREPARATION_PAIR_REQUIRED", "native packets require exactly the separate native authority");
  }
  const native = V3PreparationClaimAuthorityV2Schema.parse(input.nativeAuthority);
  if (canonicalJsonStringify(readinessFromNativePreparationV2(native)) !== canonicalJsonStringify(input.readiness)) {
    repositoryFail("V3_NATIVE_PREPARATION_PAIR_MISMATCH", "native authority differs from the complete V1 scheduling authority");
  }
  const reader = createV3NativePreparationArtifactReader(sql, input.artifacts);
  const packet = await reader.readExactSealedPacket(native.runId);
  const story = packet.storyPlan.stories.find(story => story.id === native.storyId);
  if (!("implementationSourceMap" in packet) || packet.packetHash !== native.packetHash
    || packet.refs.compilationReport !== native.compilationReportHash || !story
    || canonicalJsonStringify(story.dependsOn) !== canonicalJsonStringify(native.projectedDependencyIds)) {
    repositoryFail("V3_NATIVE_PREPARATION_PACKET_MISMATCH", "native preparation is crossed with another packet/report/story");
  }
  for (const dependency of native.dependencyAttempts) {
    const exact = await readV3NativeDependencyAuthority(sql, sql, {
      runId: native.runId, stepId: native.stepId, packetHash: native.packetHash,
      storyId: dependency.storyId, attemptId: dependency.attemptId,
    }, input.artifacts);
    if (canonicalJsonStringify(exact) !== canonicalJsonStringify(dependency)) {
      repositoryFail("V3_NATIVE_PREPARATION_DEPENDENCY_MISMATCH", "native terminal dependency witnesses changed");
    }
  }
  return seal(native);
}

/** Only this connection is used while locked; immutable bytes were authenticated
 * before begin. Current row identities and accepted-output hashes must still match. */
export async function recheckV3NativePreparationInTransaction(
  transaction: TransactionSql, input: AuthenticatedV3NativePreparation,
): Promise<V3PreparationClaimAuthorityV2 | undefined> {
  if (authenticatedNativePreparations.get(input) !== canonicalJsonStringify({
    readiness: input.readiness, nativeAuthority: input.nativeAuthority ?? null,
  })) repositoryFail("V3_NATIVE_PREPARATION_UNAUTHENTICATED", "native immutable authentication is absent or changed");
  const rows = await transaction.unsafe<Array<{ artifact_type: string; report_hash: string | null }>>(
    `SELECT a.artifact_type,ref.artifact_hash AS report_hash FROM product_packets p
      JOIN semantic_artifacts a ON a.artifact_hash=p.packet_hash
      LEFT JOIN run_artifact_refs ref ON ref.run_id=p.run_id AND ref.ref_key='COMPILATION_REPORT'
      WHERE p.run_id=$1 AND p.packet_hash=$2`, [input.readiness.runId, input.readiness.packetHash]);
  const native = input.nativeAuthority;
  if (!native) {
    if (rows[0]?.artifact_type === "setfarm.product-build-packet.v3") {
      repositoryFail("V3_NATIVE_PREPARATION_PAIR_REQUIRED", "native packet cannot consume historical readiness alone");
    }
    return undefined;
  }
  if (rows.length !== 1 || rows[0]!.artifact_type !== "setfarm.product-build-packet.v3"
    || rows[0]!.report_hash !== native.compilationReportHash) {
    repositoryFail("V3_NATIVE_PREPARATION_PACKET_MISMATCH", "native packet/report changed before publication");
  }
  for (const dependency of native.dependencyAttempts) {
    const rows = await transaction.unsafe<Array<{ generation: number; attempt_class: string; disposition: string;
      slice_hash: string; output_hash: string; source_after_sha: string; source_after_tree_hash: string; output: string }>>(
      `SELECT a.generation,a.attempt_class,a.disposition,a.slice_hash,a.output_hash,a.source_after_sha,a.source_after_tree_hash,c.output
        FROM execution_attempts a JOIN runtime_completion_requests c ON c.attempt_id=a.attempt_id
          AND c.claim_id=a.claim_id AND c.run_id=a.run_id AND c.story_id=a.story_id AND c.output_hash=a.output_hash
        WHERE a.attempt_id=$1 AND a.run_id=$2 AND a.step_id=$3 AND a.story_id=$4 AND a.packet_hash=$5
          AND c.state='accepted' AND c.apply_phase='effects_committed' FOR SHARE OF a,c`,
      [dependency.attemptId, native.runId, native.stepId, dependency.storyId, native.packetHash]);
    const row = rows[0];
    if (rows.length !== 1 || !row || row.generation !== dependency.attemptGeneration
      || row.attempt_class !== dependency.attemptClass || row.disposition !== dependency.disposition
      || row.slice_hash !== dependency.sliceHash || row.output_hash !== dependency.outputHash
      || row.source_after_sha !== dependency.sourceAfter.sha || row.source_after_tree_hash !== dependency.sourceAfter.treeHash
      || createHash("sha256").update(row.output, "utf8").digest("hex") !== dependency.outputHash) {
      repositoryFail("V3_NATIVE_PREPARATION_DEPENDENCY_MISMATCH", "native terminal dependency changed before publication");
    }
  }
  return native;
}

export async function publishV3PreparationAuthorityV2InTransaction(
  transaction: TransactionSql,
  authorityInput: unknown,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  const authority = V3PreparationClaimAuthorityV2Schema.parse(authorityInput);
  try {
    const rows = await transaction.unsafe<Array<{ authority_hash: string }>>(
      `INSERT INTO public.v3_preparation_authorities_v2 (
         authority_hash, authority_schema, authority_version, packet_schema,
         run_id, step_id, story_id, state_version, packet_hash,
         compilation_report_hash, base_source_sha, base_source_tree_hash,
         authority_payload
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text::jsonb
       )
       ON CONFLICT DO NOTHING
       RETURNING authority_hash`,
      [
        authority.authorityHash,
        authority.schema,
        authority.authorityVersion,
        authority.packetSchema,
        authority.runId,
        authority.stepId,
        authority.storyId,
        authority.stateVersion,
        authority.packetHash,
        authority.compilationReportHash,
        authority.baseRevision.sha,
        authority.baseRevision.treeHash,
        canonicalJsonStringify(authority),
      ],
    );
    if (rows.length === 1) return "published";
  } catch (error) {
    if (!isConstraintViolation(error)) throw error;
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_PUBLICATION_CONFLICT",
      "preparation authority identity conflicts with durable provenance",
      error,
    );
  }
  const stored = await readAuthorityRow(transaction, authority.authorityHash);
  if (!stored) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_PUBLICATION_CONFLICT",
      "preparation identity is already bound to a different canonical authority",
    );
  }
  const parsed = parseAuthorityRow(stored);
  if (canonicalJsonStringify(parsed) !== canonicalJsonStringify(authority)) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_PUBLICATION_CONFLICT",
      "existing authority hash does not contain the exact canonical payload",
    );
  }
  return "duplicate";
}

export async function publishV3PreparationAuthorityV2(
  sql: Sql,
  authority: unknown,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  return sql.begin((transaction) =>
    publishV3PreparationAuthorityV2InTransaction(transaction, authority)) as Promise<
      V3PreparationAuthorityV2PublicationStatus
    >;
}

export async function bindV3PreparationAuthorityClaimV2InTransaction(
  transaction: TransactionSql,
  input: Readonly<{ authorityHash: string; claimId: number }>,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  const authorityHash = Sha256Schema.parse(input.authorityHash);
  const exactClaimId = claimId(input.claimId);
  try {
    const rows = await transaction.unsafe<Array<{ authority_hash: string }>>(
      `INSERT INTO public.v3_preparation_authority_claims_v2 (authority_hash, claim_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING authority_hash`,
      [authorityHash, exactClaimId],
    );
    if (rows.length === 1) return "published";
  } catch (error) {
    if (!isConstraintViolation(error)) throw error;
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_CLAIM_CONFLICT",
      "claim is not the exact active owner of the preparation authority",
      error,
    );
  }
  const rows = await transaction.unsafe<Array<{ claim_id: string | number }>>(
    `SELECT claim_id FROM public.v3_preparation_authority_claims_v2
      WHERE authority_hash = $1`,
    [authorityHash],
  );
  if (rows.length !== 1 || claimId(rows[0]!.claim_id) !== exactClaimId) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_CLAIM_CONFLICT",
      "authority was already consumed by a different claim",
    );
  }
  return "duplicate";
}

export async function bindV3PreparationAuthorityAttemptV2InTransaction(
  transaction: TransactionSql,
  input: Readonly<{
    authorityHash: string;
    claimId: number;
    attemptId: string;
    sliceHash: string;
  }>,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  const authorityHash = Sha256Schema.parse(input.authorityHash);
  const exactClaimId = claimId(input.claimId);
  const exactAttemptId = attemptId(input.attemptId);
  const sliceHash = Sha256Schema.parse(input.sliceHash);
  try {
    const rows = await transaction.unsafe<Array<{ authority_hash: string }>>(
      `INSERT INTO public.v3_preparation_authority_attempts_v2 (
         authority_hash, claim_id, attempt_id, slice_hash
       ) VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING authority_hash`,
      [authorityHash, exactClaimId, exactAttemptId, sliceHash],
    );
    if (rows.length === 1) return "published";
  } catch (error) {
    if (!isConstraintViolation(error)) throw error;
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_ATTEMPT_CONFLICT",
      "attempt is not the exact initial implementation consumer of the authority",
      error,
    );
  }
  const rows = await transaction.unsafe<Array<{
    claim_id: string | number;
    attempt_id: string;
    slice_hash: string;
  }>>(
    `SELECT claim_id, attempt_id, slice_hash
       FROM public.v3_preparation_authority_attempts_v2
      WHERE authority_hash = $1`,
    [authorityHash],
  );
  const existing = rows[0];
  if (
    rows.length !== 1
    || claimId(existing!.claim_id) !== exactClaimId
    || existing!.attempt_id !== exactAttemptId
    || existing!.slice_hash !== sliceHash
  ) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_ATTEMPT_CONFLICT",
      "authority was already consumed by a different attempt or slice",
    );
  }
  return "duplicate";
}
