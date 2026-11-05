import type postgres from "postgres";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { createRuntimeArtifactReader } from "../product-compiler/runtime-artifact-reader.js";
import { IndexedArtifactPublisher } from "../product-compiler/indexed-artifact-publisher.js";
import { createHybridArtifactStoreCapacityLeaseProviderV1 } from "../product-compiler/artifact-store-authority.js";
import { resolveArtifactStorePublicationAuthorityMode } from "../runtime-config.js";
import { LegacyImplementationSliceV2Schema, type LegacyImplementationSliceV2 } from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import { verifyLegacyImplementationSliceV2 } from "../product-compiler/slice-compiler-v2-legacy.js";
import { Sha256Schema, StoryIdSchema } from "../product-compiler/schemas/common-v1.js";
import { createAttemptRepository, lockAttemptReservationOwnerInTransaction, reserveAttemptInTransaction } from "./attempt-repository.js";
import { createV3ImplementationAttemptV2Assembler, nativeImplementationSourcePathsV3 } from "./v3-implementation-attempt-v2.js";
import { createV3ArtifactRefKeyV2 } from "./v3-artifact-ref-key-v2.js";
import { resolveV3GitRevision } from "./v3-git-revision.js";
import { captureV3ImplementationSourceSnapshotsV2 } from "./v3-source-snapshot-v2.js";
import {
  authenticateV3NativePreparation, recheckV3NativePreparationInTransaction, bindV3PreparationAuthorityAttemptV2InTransaction,
  captureNativeOriginalFileSignatures, readinessFromNativePreparationV2,
  readV3PreparationAuthorityByClaimV2, readV3PreparationAuthorityByAttemptV2,
  readV3NativeDependencyAuthority, readV3NativeIndexedArtifact,
  type V3NativePreparationArtifacts,
} from "./v3-preparation-authority-v2-repository.js";
import type { V3PreparationClaimAuthorityV1 } from "./v3-preparation-claim-authority.js";
import type { V3PreparationClaimAuthorityV2 } from "./v3-preparation-claim-authority-v2.js";
import { compileEvidencePlanV2, type EvidencePlanV2 } from "../evidence/evidence-plan-v2.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-store.js";
import type { SemanticArtifactProducerV1 } from "../product-compiler/schemas/common-v1.js";
import { createV3ImplementationClaimHandoffV2, type V3ImplementationClaimHandoffV2 } from "./v3-implementation-handoff-v2.js";
import { createV3ImplementationContext } from "./v3-implementation-handoff.js";
import { resolveV3ExecutionProfile, type ModelExecutionProfileV1 } from "./operational-retry-directive.js";
import type { ExecutionAttemptV1, SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";

export type NativePreparedImplementationV3 = Readonly<{
  kind: "native-prepared";
  readiness: V3PreparationClaimAuthorityV1;
  nativeAuthority: V3PreparationClaimAuthorityV2;
  attempt: ExecutionAttemptV1;
  slice: LegacyImplementationSliceV2;
  sliceHash: string;
  sliceRefKey: string;
  sourceBefore: SourceRevisionV1;
}>;

const ReserveInputSchema = z.object({
  claimId: z.number().int().positive(), nativeAuthorityHash: Sha256Schema,
  runId: z.string().min(1).max(500), stepId: z.literal("implement"), storyId: StoryIdSchema,
  role: z.literal("developer"), agentId: z.string().min(1).max(500),
  branch: z.string().min(1).max(1_000), worktree: z.string().min(1).max(4_000).refine(path.isAbsolute),
}).strict();
export type NativeImplementationReservationV3 = z.input<typeof ReserveInputSchema>;
const LocatorSchema = z.object({ runId: z.string().min(1).max(500), storyId: StoryIdSchema,
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/) }).strict();

function same(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

/** Inactive prepared-attempt API. It deliberately has no evidence plan, context,
 * handoff or dispatcher. Task10/11 must supply and qualify those separately. */
export function createNativeV3ImplementationAttemptService(options: V3NativePreparationArtifacts & Readonly<{ sql: postgres.Sql }>) {
  const publicationAuthority = resolveArtifactStorePublicationAuthorityMode();
  const capacityLeaseProvider = publicationAuthority === "hybrid-required"
    ? createHybridArtifactStoreCapacityLeaseProviderV1({ sql: options.sql, artifactRoot: options.artifactRoot, purpose: "writer" })
    : undefined;
  const reader = createRuntimeArtifactReader({ ...options, publicationAuthorityMode: publicationAuthority,
    ...(capacityLeaseProvider ? { capacityLeaseProvider } : {}) });
  const publisher = new IndexedArtifactPublisher({ index: reader.index, store: reader.store,
    publicationAuthority, ownerInstanceId: `native-prepared:${process.pid}` });
  const attempts = createAttemptRepository(options.sql);

  async function loadPreparedAttempt(raw: unknown): Promise<NativePreparedImplementationV3> {
    const input = LocatorSchema.parse(raw);
    const [origin, attempt] = await Promise.all([
      readV3PreparationAuthorityByAttemptV2(options.sql, input.attemptId), attempts.findById(input.attemptId),
    ]);
    if (!origin || !attempt || attempt.runId !== input.runId || attempt.storyId !== input.storyId
      || attempt.claimId !== origin.claimId || attempt.sliceHash !== origin.sliceHash
      || attempt.attemptClass !== "product_implementation" || attempt.role !== "developer"
      || attempt.recoveryCaseRevisionId || attempt.recoveryDispatchId || !attempt.worktree
      || attempt.runId !== origin.authority.runId || attempt.storyId !== origin.authority.storyId
      || attempt.stepId !== origin.authority.stepId || attempt.packetHash !== origin.authority.packetHash
      || attempt.compilationReportHash !== origin.authority.compilationReportHash
      || !same(attempt.sourceBefore, origin.authority.baseRevision)) {
      throw new Error("V3_NATIVE_PREPARED_ORIGIN_MISMATCH");
    }
    const claims = await options.sql.unsafe<Array<{ agent_id: string }>>(
      "SELECT agent_id FROM claim_log WHERE id=$1 AND run_id=$2 AND step_id=$3 AND story_id=$4",
      [origin.claimId, input.runId, attempt.stepId, input.storyId]);
    if (claims.length !== 1 || claims[0]!.agent_id !== attempt.agentId) throw new Error("V3_NATIVE_PREPARED_AGENT_MISMATCH");
    // This inactive preparation API shares the existing active-run reader
    // domain. A terminal-history reader is a separate downstream contract.
    const packet = await reader.readExactSealedPacket(input.runId);
    if (!("implementationSourceMap" in packet) || packet.packetHash !== origin.authority.packetHash
      || packet.refs.compilationReport !== origin.authority.compilationReportHash) throw new Error("V3_NATIVE_PREPARED_PACKET_MISMATCH");
    const envelope = await readV3NativeIndexedArtifact(reader, origin.sliceHash);
    if (envelope.artifactType !== "setfarm.implementation-slice.v2" || !same(envelope.producer, packet.producer)) {
      throw new Error("V3_NATIVE_PREPARED_PRODUCER_MISMATCH");
    }
    const slice = LegacyImplementationSliceV2Schema.parse(envelope.payload);
    const sliceRefKey = createV3ArtifactRefKeyV2("slice", input.storyId, origin.sliceHash);
    const refs = await options.sql.unsafe<Array<{ artifact_hash: string }>>(
      "SELECT artifact_hash FROM run_artifact_refs WHERE run_id=$1 AND ref_key=$2", [input.runId, sliceRefKey]);
    if (refs.length !== 1 || refs[0]!.artifact_hash !== origin.sliceHash
      || !attempt.evidenceRefs.includes(`setfarm://artifact/${origin.sliceHash}`)
      || !attempt.evidenceRefs.includes(`setfarm://preparation-authority-v2/${origin.authority.authorityHash}`)) {
      throw new Error("V3_NATIVE_PREPARED_REFERENCE_MISMATCH");
    }
    for (const dependency of origin.authority.dependencyAttempts) {
      const actual = await readV3NativeDependencyAuthority(options.sql, options.sql, {
        runId: input.runId, stepId: attempt.stepId, packetHash: packet.packetHash,
        storyId: dependency.storyId, attemptId: dependency.attemptId,
      }, options);
      if (!same(actual, dependency)) throw new Error("V3_NATIVE_PREPARED_DEPENDENCY_MISMATCH");
    }
    const snapshots = captureNativeOriginalFileSignatures({ worktree: attempt.worktree,
      source: origin.authority.baseRevision, files: nativeImplementationSourcePathsV3(packet, input.storyId) });
    const verified = verifyLegacyImplementationSliceV2({ slice, compilerInput: {
      packetHash: packet.packetHash, packet: packet.packet, productSpec: packet.productSpec,
      designGraph: packet.designGraph, buildTopology: packet.buildTopology, storyPlan: packet.storyPlan,
      designSourceClosure: packet.designSourceClosure, implementationSourceMap: packet.implementationSourceMap,
      storyId: input.storyId, sourceRevision: origin.authority.baseRevision, producer: packet.producer,
      currentFiles: snapshots.map(({ path: _path, ...snapshot }) => snapshot),
      dependencyOutputs: origin.authority.dependencyAttempts.map(({ attemptId: _id, attemptGeneration: _generation,
        attemptClass: _class, disposition: _disposition, ...output }) => output),
    } });
    if (verified.status !== "verified" || verified.sliceHash !== origin.sliceHash) throw new Error("V3_NATIVE_PREPARED_REPRODUCTION_FAILED");
    return Object.freeze({ kind: "native-prepared", readiness: readinessFromNativePreparationV2(origin.authority),
      nativeAuthority: origin.authority, attempt, slice: verified.slice, sliceHash: origin.sliceHash, sliceRefKey,
      sourceBefore: origin.authority.baseRevision });
  }

  async function reserve(raw: unknown): Promise<NativePreparedImplementationV3> {
    const input = ReserveInputSchema.parse(raw);
    const authority = await readV3PreparationAuthorityByClaimV2(options.sql, input.claimId);
    if (!authority || authority.authorityHash !== input.nativeAuthorityHash || authority.runId !== input.runId
      || authority.stepId !== input.stepId || authority.storyId !== input.storyId) throw new Error("V3_NATIVE_RESERVATION_AUTHORITY_MISMATCH");
    const readiness = readinessFromNativePreparationV2(authority);
    const existing = await options.sql.unsafe<Array<{ attempt_id: string }>>(
      "SELECT attempt_id FROM v3_preparation_authority_attempts_v2 WHERE authority_hash=$1", [authority.authorityHash]);
    // Original replay never re-enters the clean-worktree assembler.
    const assembled = existing.length ? undefined : await createV3ImplementationAttemptV2Assembler({
      readPacket: runId => reader.readExactSealedPacket(runId),
    }).assemble({ runId: input.runId, stepId: input.stepId, storyId: input.storyId,
      worktree: input.worktree, preparationAuthority: authority });
    if (assembled) {
      const published = await publisher.put(assembled.envelope);
      if (published.hash !== assembled.sliceHash) throw new Error("V3_NATIVE_SLICE_PUBLICATION_MISMATCH");
    }
    const authenticated = await authenticateV3NativePreparation(options.sql, {
      readiness, nativeAuthority: authority, artifacts: options,
    });
    let committedAttemptId = "";
    await options.sql.begin(async transaction => {
      // Publication replay locks the run before the claim. Acquire the existing
      // attempt advisory and run locks first, including on native replay.
      await lockAttemptReservationOwnerInTransaction(transaction, input);
      const live = await transaction.unsafe<Array<{ state_version: number; state_fingerprint: string }>>(
        `SELECT s.state_version,s.state_fingerprint FROM claim_log c
          JOIN runs r ON r.id=c.run_id
          JOIN v3_preparation_story_state s ON s.run_id=c.run_id AND s.step_id=c.step_id AND s.story_id=c.story_id
        WHERE c.id=$1 AND c.run_id=$2 AND c.step_id=$3 AND c.story_id=$4 AND c.agent_id=$5
          AND c.outcome IS NULL AND r.protocol='v3' AND r.status IN ('running','resuming')
          AND s.state='claimed' AND s.claim_id=c.id
        FOR UPDATE OF c,s`, [input.claimId, input.runId, input.stepId, input.storyId, input.agentId]);
      if (live.length !== 1 || live[0]!.state_version !== readiness.stateVersion
        || live[0]!.state_fingerprint !== readiness.authorityHash) throw new Error("V3_NATIVE_RESERVATION_CLAIM_STALE");
      const bound = await readV3PreparationAuthorityByClaimV2(transaction, input.claimId);
      if (!same(bound ?? null, authority)) throw new Error("V3_NATIVE_RESERVATION_ORIGIN_CHANGED");
      await recheckV3NativePreparationInTransaction(transaction, authenticated);
      const replay = await transaction.unsafe<Array<{ attempt_id: string }>>(
        "SELECT attempt_id FROM v3_preparation_authority_attempts_v2 WHERE authority_hash=$1", [authority.authorityHash]);
      if (replay[0]) { committedAttemptId = replay[0].attempt_id; return; }
      if (!assembled) throw new Error("V3_NATIVE_RESERVATION_ORIGIN_MISSING");
      const head = resolveV3GitRevision({ repo: input.worktree, requestedRef: "HEAD", expectedSha: authority.baseRevision.sha });
      const current = captureV3ImplementationSourceSnapshotsV2({ worktree: input.worktree,
        files: nativeImplementationSourcePathsV3(assembled.packet, input.storyId) });
      const status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
        cwd: input.worktree, timeout: 10_000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
      });
      if (status.byteLength || !same(head, authority.baseRevision) || !same(current.snapshots, assembled.compilerInput.currentFiles)) {
        throw new Error("V3_NATIVE_RESERVATION_SOURCE_CHANGED");
      }
      const reserved = await reserveAttemptInTransaction(transaction, {
        claimId: input.claimId, runId: input.runId, stepId: input.stepId, storyId: input.storyId,
        attemptClass: "product_implementation", packetHash: authority.packetHash,
        compilationReportHash: authority.compilationReportHash, sliceHash: assembled.sliceHash,
        sourceBefore: authority.baseRevision, role: input.role, agentId: input.agentId,
        branch: input.branch, worktree: input.worktree,
        evidenceRefs: [`setfarm://claim-log/${input.claimId}`, `setfarm://artifact/${assembled.sliceHash}`,
          `setfarm://preparation-authority-v2/${authority.authorityHash}`],
      });
      if (reserved.status !== "reserved") throw new Error("V3_NATIVE_RESERVATION_CONFLICT");
      await transaction.unsafe(
        `INSERT INTO run_artifact_refs(run_id,ref_key,artifact_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [input.runId, assembled.sliceRefKey, assembled.sliceHash]);
      const refs = await transaction.unsafe<Array<{ artifact_hash: string }>>(
        "SELECT artifact_hash FROM run_artifact_refs WHERE run_id=$1 AND ref_key=$2", [input.runId, assembled.sliceRefKey]);
      if (refs[0]?.artifact_hash !== assembled.sliceHash) throw new Error("V3_NATIVE_RESERVATION_REFERENCE_CONFLICT");
      await bindV3PreparationAuthorityAttemptV2InTransaction(transaction, {
        authorityHash: authority.authorityHash, claimId: input.claimId,
        attemptId: reserved.attempt.attemptId, sliceHash: assembled.sliceHash,
      });
      committedAttemptId = reserved.attempt.attemptId;
    });
    const result = await loadPreparedAttempt({ runId: input.runId, storyId: input.storyId, attemptId: committedAttemptId });
    if (result.attempt.agentId !== input.agentId || result.attempt.branch !== input.branch || result.attempt.worktree !== input.worktree) {
      throw new Error("V3_NATIVE_RESERVATION_REPLAY_INPUT_MISMATCH");
    }
    return result;
  }
  return Object.freeze({ reserve, loadPreparedAttempt });
}

/** A genuine initial prepared owner upgraded with its deterministic native plan.
 * Successor ownership is deliberately not represented by this initial type. */
export type NativeImplementationContextV3 = Readonly<Omit<NativePreparedImplementationV3, "kind"> & {
  kind: "native-dispatch-ready";
  artifactProducer: SemanticArtifactProducerV1;
  evidencePlan: EvidencePlanV2;
  evidencePlanArtifactHash: string;
  evidencePlanRefKey: string;
  packetHash: string;
  compilationReportHash: string;
  packetEnvelope: V3ImplementationClaimHandoffV2["packetEnvelope"];
  compilationReportEnvelope: V3ImplementationClaimHandoffV2["compilationReportEnvelope"];
  executionProfile: ModelExecutionProfileV1;
  operationalRetry?: never;
  supervisorRetry?: never;
  recovery?: never;
}>;

export function createNativeV3ImplementationAttemptHandoff(input: Readonly<{
  compiled: NativeImplementationContextV3;
  stepDbId: string; storyDbId: string; claimId: number; branch: string; workdir: string;
}>): V3ImplementationClaimHandoffV2 {
  const compiled = input.compiled;
  if (compiled.attempt.claimId !== input.claimId || compiled.attempt.stepId !== "implement"
    || compiled.attempt.branch !== input.branch || compiled.attempt.worktree !== input.workdir) {
    throw new Error("V3_NATIVE_PREPARED_ORIGIN_MISMATCH");
  }
  return createV3ImplementationClaimHandoffV2({
    schema: "setfarm.v3-implementation-claim-handoff.v2", protocol: "v3",
    runId: compiled.attempt.runId, stepId: input.stepDbId, workflowStepId: "implement",
    storyId: compiled.attempt.storyId, storyDbId: input.storyDbId, claimId: input.claimId,
    attemptId: compiled.attempt.attemptId, attemptGeneration: compiled.attempt.generation,
    branch: input.branch, workdir: input.workdir,
    packetHash: compiled.packetHash, compilationReportHash: compiled.compilationReportHash,
    sliceHash: compiled.sliceHash, sliceRef: compiled.sliceRefKey,
    evidencePlanHash: compiled.evidencePlan.planHash,
    evidencePlanArtifactHash: compiled.evidencePlanArtifactHash, evidencePlanRef: compiled.evidencePlanRefKey,
    executionAuthority: { role: "developer", attemptClass: "product_implementation" },
    executionProfile: compiled.executionProfile, sourceBefore: compiled.sourceBefore,
    artifactProducer: compiled.artifactProducer, packetEnvelope: compiled.packetEnvelope,
    compilationReportEnvelope: compiled.compilationReportEnvelope, nativeAuthority: compiled.nativeAuthority,
    implementationSlice: compiled.slice, evidencePlan: compiled.evidencePlan,
  });
}

/** Publication/readback layer over Task9's unchanged raw initial reservation.
 * Loading never republishes or reads mutable source as original authority. */
export function createNativeV3ImplementationContextService(options: V3NativePreparationArtifacts & Readonly<{ sql: postgres.Sql }>) {
  const preparedService = createNativeV3ImplementationAttemptService(options);
  const publicationAuthority = resolveArtifactStorePublicationAuthorityMode();
  const capacityLeaseProvider = publicationAuthority === "hybrid-required"
    ? createHybridArtifactStoreCapacityLeaseProviderV1({ sql: options.sql, artifactRoot: options.artifactRoot, purpose: "writer" })
    : undefined;
  const reader = createRuntimeArtifactReader({ ...options, publicationAuthorityMode: publicationAuthority,
    ...(capacityLeaseProvider ? { capacityLeaseProvider } : {}) });
  const publisher = new IndexedArtifactPublisher({ index: reader.index, store: reader.store,
    publicationAuthority, ownerInstanceId: `native-context:${process.pid}` });

  async function compileContext(prepared: NativePreparedImplementationV3): Promise<NativeImplementationContextV3> {
    const packet = await reader.readExactSealedPacket(prepared.attempt.runId);
    if (!("implementationSourceMap" in packet) || packet.packetHash !== prepared.nativeAuthority.packetHash
      || packet.refs.compilationReport !== prepared.nativeAuthority.compilationReportHash) {
      throw new Error("V3_NATIVE_PREPARED_PACKET_MISMATCH");
    }
    const evidencePlan = compileEvidencePlanV2({ slice: prepared.slice, sliceHash: prepared.sliceHash });
    const evidencePlanArtifactHash = hashCanonicalJson(planEnvelope(packet.producer, evidencePlan));
    const compiled: NativeImplementationContextV3 = { ...prepared, kind: "native-dispatch-ready",
      artifactProducer: packet.producer, evidencePlan, evidencePlanArtifactHash,
      evidencePlanRefKey: createV3ArtifactRefKeyV2("evidence_plan", prepared.attempt.storyId, evidencePlanArtifactHash),
      packetHash: packet.packetHash, compilationReportHash: packet.refs.compilationReport,
      packetEnvelope: { schema: "setfarm.semantic-artifact-envelope.v1", artifactType: "setfarm.product-build-packet.v3",
        producer: packet.producer, payload: packet.packet },
      compilationReportEnvelope: { schema: "setfarm.semantic-artifact-envelope.v1", artifactType: "setfarm.product-compilation-report.v3",
        producer: packet.producer, payload: packet.compilationReport },
      executionProfile: resolveV3ExecutionProfile("primary"),
    };
    return Object.freeze(compiled);
  }

  function planEnvelope(producer: SemanticArtifactProducerV1, plan: EvidencePlanV2) {
    return SemanticArtifactEnvelopeV1Schema.parse({ schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.evidence-plan.v2", producer, payload: plan });
  }

  async function loadAttemptContext(raw: unknown): Promise<NativeImplementationContextV3> {
    const compiled = await compileContext(await preparedService.loadPreparedAttempt(raw));
    const envelope = await readV3NativeIndexedArtifact(reader, compiled.evidencePlanArtifactHash);
    const refs = await options.sql.unsafe<Array<{ artifact_hash: string }>>(
      "SELECT artifact_hash FROM run_artifact_refs WHERE run_id=$1 AND ref_key=$2",
      [compiled.attempt.runId, compiled.evidencePlanRefKey]);
    if (refs.length !== 1 || refs[0]!.artifact_hash !== compiled.evidencePlanArtifactHash
      || !same(envelope, planEnvelope(compiled.artifactProducer, compiled.evidencePlan))) {
      throw new Error("V3_ATTEMPT_CONTEXT_EVIDENCE_PLAN_MISMATCH");
    }
    return compiled;
  }

  async function reserve(raw: unknown): Promise<NativeImplementationContextV3> {
    const input = ReserveInputSchema.parse(raw);
    const compiled = await compileContext(await preparedService.reserve(input));
    const identities = await options.sql.unsafe<Array<{ step_id: string; story_id: string }>>(
      `SELECT s.id AS step_id, st.id AS story_id FROM steps s JOIN stories st ON st.run_id=s.run_id
        WHERE s.run_id=$1 AND s.step_id=$2 AND st.story_id=$3`, [input.runId, input.stepId, input.storyId]);
    if (identities.length !== 1) throw new Error("V3_IMPLEMENTATION_COMPLETION_IDENTITY_REQUIRED");
    // Exercise the existing full-context capacity guard using actual owner IDs,
    // not placeholders. Failure cannot publish a model context.
    createV3ImplementationContext({ handoff: createNativeV3ImplementationAttemptHandoff({ compiled,
      stepDbId: identities[0]!.step_id, storyDbId: identities[0]!.story_id, claimId: input.claimId,
      branch: input.branch, workdir: input.worktree }) });
    const published = await publisher.put(planEnvelope(compiled.artifactProducer, compiled.evidencePlan));
    if (published.hash !== compiled.evidencePlanArtifactHash) throw new Error("V3_EVIDENCE_PLAN_PUBLICATION_HASH_MISMATCH");
    await reader.index.addRunArtifactRef({ runId: input.runId,
      refKey: compiled.evidencePlanRefKey, artifactHash: published.hash });
    return loadAttemptContext({ runId: input.runId, storyId: input.storyId, attemptId: compiled.attempt.attemptId });
  }
  return Object.freeze({ reserve, loadAttemptContext });
}
