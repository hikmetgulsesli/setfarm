import type postgres from "postgres";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { Sha256Schema, NormalizedRelativeLocatorSchema } from "../product-compiler/schemas/common-v1.js";
import { createRuntimeArtifactReader } from "../product-compiler/runtime-artifact-reader.js";
import type { ArtifactCapacityLimits } from "../product-compiler/artifact-capacity.js";
import { resolveProductArtifactDir, resolveProductArtifactCapacity } from "../runtime-config.js";
import { topologyPathAbsenceHash } from "../product-compiler/schemas/build-topology-v1.js";
import { LegacyImplementationSliceV2Schema } from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import { V3ImplementationAgentOutputV1Schema } from "./v3-implementation-output.js";
import { captureV3GitCommitRevision } from "./v3-git-revision.js";
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

/** Immutable Git objects, never the current worktree, are original source authority. */
export function captureNativeOriginalFileSignatures(input: Readonly<{
  worktree: string; source: SourceRevisionV1; files: readonly Readonly<{ pathRef: string; path: string }>[];
}>) {
  const actual = captureV3GitCommitRevision({ repo: input.worktree, commitSha: input.source.sha });
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
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
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
    fileSignatures: captureNativeOriginalFileSignatures({ worktree: row.worktree, source: sourceAfter, files }) });
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
