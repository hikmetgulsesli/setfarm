import type postgres from "postgres";
import { execFileSync } from "node:child_process";
import { realpathSync, lstatSync, openSync, closeSync, fstatSync, ftruncateSync, readSync, writeSync, constants } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { createRuntimeArtifactReader, type SealedRuntimePacketV3 } from "../product-compiler/runtime-artifact-reader.js";
import { IndexedArtifactPublisher } from "../product-compiler/indexed-artifact-publisher.js";
import { createHybridArtifactStoreCapacityLeaseProviderV1 } from "../product-compiler/artifact-store-authority.js";
import { resolveArtifactStorePublicationAuthorityMode } from "../runtime-config.js";
import { ImplementationRecoveryDirectiveV2Schema, LegacyImplementationSliceV2Schema, type LegacyImplementationSliceV2 } from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import { compileLegacyImplementationSliceV2, verifyLegacyImplementationSliceV2 } from "../product-compiler/slice-compiler-v2-legacy.js";
import { Sha256Schema, StoryIdSchema } from "../product-compiler/schemas/common-v1.js";
import { createAttemptRepository, lockAttemptReservationOwnerInTransaction, reserveAttemptInTransaction } from "./attempt-repository.js";
import { createV3ImplementationAttemptV2Assembler, nativeImplementationSourcePathsV3 } from "./v3-implementation-attempt-v2.js";
import { createV3ArtifactRefKeyV2 } from "./v3-artifact-ref-key-v2.js";
import { resolveV3GitRevision } from "./v3-git-revision.js";
import { captureV3ImplementationSourceSnapshotsV2, V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS } from "./v3-source-snapshot-v2.js";
import {
  authenticateV3NativePreparation, recheckV3NativePreparationInTransaction, bindV3PreparationAuthorityAttemptV2InTransaction,
  captureNativeAttemptFileSignatures, captureNativeOriginalFileSignatures,
  authenticateNativeGitCustody, recheckNativeGitCustodyInTransaction,
  readinessFromNativePreparationV2,
  readV3PreparationAuthorityByClaimV2, readV3PreparationAuthorityByAttemptV2,
  readV3NativeDependencyAuthority, readV3NativeIndexedArtifact,
  type V3NativePreparationArtifacts,
} from "./v3-preparation-authority-v2-repository.js";
import type { V3PreparationClaimAuthorityV1 } from "./v3-preparation-runtime-authority-v1.js";
import type { V3PreparationClaimAuthorityV2 } from "./v3-preparation-runtime-authority-v1.js";
import { compileEvidencePlanV2, type EvidencePlanV2 } from "../evidence/evidence-plan-v2.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-store.js";
import type { SemanticArtifactProducerV1 } from "../product-compiler/schemas/common-v1.js";
import { createV3ImplementationClaimHandoffV2, nativeImplementationWritePaths, type V3ImplementationClaimHandoffV2 } from "./v3-implementation-handoff-v2.js";
import { createV3ImplementationContext } from "./v3-implementation-handoff.js";
import { OperationalRetryDirectiveV1Schema, parseOperationalRetryDirectiveStoryOutput, resolveV3ExecutionProfile, type OperationalRetryDirectiveV1, type ModelExecutionProfileV1 } from "./operational-retry-directive.js";
import type { ExecutionAttemptV1, SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";

import { createRecoveryDeliveryRepository } from "../recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../recovery/finding-recovery-repository.js";
import { createV3RecoveryClaimAuthority, V3RecoveryClaimHandoffV1Schema } from "../recovery/v3-recovery-claim-authority.js";
import type { RecoveryCaseRevisionV1, RecoveryRevisionDispatchV1 } from "../recovery/recovery-delivery.js";
import type { FindingSetV1 } from "../findings/finding-set.js";
import { createV3EvidenceOnlyPublication, readNativeEvidenceOnlySourceAuthority,readNativeAcceptedModelSourceAuthority,
  type V3EvidenceOnlyPublicationLeaseV1 } from "../recovery/v3-evidence-only-publication.js";
import { createV3DownstreamEvidencePublication, V3DownstreamEvidenceAuthorityV1Schema,
  readNativeDownstreamSourceOwner, readNativeDownstreamAttemptAuthority,
  type V3DownstreamEvidenceAuthorityV1 } from "../recovery/v3-downstream-evidence-publication.js";
import type { GithubReviewThreadEvidenceV1 } from "../findings/github-review-source.js";
import { loadV3ReviewEvidenceArtifactsV1 } from "./v3-review-evidence-artifacts.js";

type NativeRecoveryContextV3 = Readonly<{
  revision: RecoveryCaseRevisionV1; dispatch: RecoveryRevisionDispatchV1; findingSet: FindingSetV1;
  reviewEvidenceArtifacts: readonly Readonly<{ artifactHash: string; evidence: GithubReviewThreadEvidenceV1 }>[];
}>;
type NativeRecoveryPreparedV3 = Readonly<Omit<NativePreparedImplementationV3, "kind"> & {
  kind: "native-recovery-prepared"; recovery: NativeRecoveryContextV3;
}>;

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
const RecoveryReserveInputSchema = ReserveInputSchema.omit({ nativeAuthorityHash: true, role: true }).extend({
  role: z.enum(["developer", "supervisor"]), findingSetHash: Sha256Schema.optional(),
  recoveryDelivery: z.object({ dispatchId: z.string().regex(/^RDISP_[a-f0-9]{64}$/),
    revisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/), ownerInstanceId: z.string().min(1).max(500),
    leaseToken: z.string().min(16).max(500) }).strict(),
}).strict();
type NativeRecoveryReservationV3 = z.infer<typeof RecoveryReserveInputSchema>;
const LocatorSchema = z.object({ runId: z.string().min(1).max(500), storyId: StoryIdSchema,
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/) }).strict();

function same(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

/** Current final source includes regular worktree bytes, not only an unchanged HEAD ref. */
export function captureNativeDownstreamCurrentSource(worktree:string,packet:SealedRuntimePacketV3):SourceRevisionV1 {
  const source=resolveV3GitRevision({repo:worktree,requestedRef:"HEAD"});
  const env:NodeJS.ProcessEnv={...process.env,GIT_NO_REPLACE_OBJECTS:"1",GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"};
  for(const key of ["GIT_DIR","GIT_WORK_TREE","GIT_COMMON_DIR","GIT_INDEX_FILE","GIT_OBJECT_DIRECTORY","GIT_ALTERNATE_OBJECT_DIRECTORIES","GIT_NAMESPACE"]) delete env[key];
  execFileSync("git",["--no-replace-objects","--literal-pathspecs","diff","--quiet","HEAD","--"],{
    cwd:worktree,env,timeout:10_000,maxBuffer:16_384,stdio:["ignore","pipe","pipe"]});
  const files=[...new Map(packet.storyPlan.stories.flatMap(story=>nativeImplementationSourcePathsV3(packet,story.id))
    .map(file=>[file.pathRef,file] as const)).values()].sort((a,b)=>a.pathRef<b.pathRef?-1:a.pathRef>b.pathRef?1:0);
  const committed=captureNativeOriginalFileSignatures({worktree,source,files});
  const current=captureV3ImplementationSourceSnapshotsV2({worktree,files});
  if(!same(current.snapshots,committed.map(({path:_path,...snapshot})=>snapshot))
    ||!same(resolveV3GitRevision({repo:worktree,requestedRef:"HEAD",expectedSha:source.sha}),source))
    throw Error("V3_NATIVE_DOWNSTREAM_SOURCE_MISMATCH");
  return source;
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
    const snapshots = await captureNativeAttemptFileSignatures(options.sql, { runId: input.runId,
      attemptId: input.attemptId, source: origin.authority.baseRevision,
      files: nativeImplementationSourcePathsV3(packet, input.storyId) });
    // Initial assembly observes declared dependency copies over the pinned base.
    // Reproduce those bytes from their authenticated immutable source signatures,
    // never from mutable worker files or by replacing the durable base revision.
    const story=packet.storyPlan.stories.find(candidate=>candidate.id===input.storyId);
    if(!story) throw new Error("V3_NATIVE_PREPARED_DEPENDENCY_MISMATCH");
    const reproductionFiles=snapshots.map(snapshot=>{
      const binding=packet.buildTopology.pathBindings.find(candidate=>candidate.id===snapshot.pathRef);
      const owner=binding&&packet.buildTopology.owners.find(candidate=>candidate.id===binding.ownerRef);
      if(!binding||binding.path!==snapshot.path) throw new Error("V3_NATIVE_PREPARED_DEPENDENCY_MISMATCH");
      if(!owner||owner.kind!=="story"||!story.dependsOn.includes(owner.storyRef)) {
        const {path:_path,...baseSnapshot}=snapshot;
        return baseSnapshot;
      }
      const grants=packet.buildTopology.sharedGrants.filter(grant=>story.sharedGrantRefs.includes(grant.id)
        &&grant.fromOwnerRef===owner.id&&grant.toOwnerRef===story.ownerRef&&grant.pathRefs.includes(snapshot.pathRef));
      if(story.ownedPathRefs.includes(snapshot.pathRef)||grants.length!==1)
        throw new Error("V3_NATIVE_PREPARED_DEPENDENCY_MISMATCH");
      const dependencies=origin.authority.dependencyAttempts.filter(dependency=>dependency.storyId===owner.storyRef);
      const signatures=dependencies.flatMap(dependency=>dependency.fileSignatures)
        .filter(signature=>signature.pathRef===snapshot.pathRef&&signature.path===snapshot.path);
      if(dependencies.length!==1||signatures.length!==1) throw new Error("V3_NATIVE_PREPARED_DEPENDENCY_MISMATCH");
      const {path:_path,...signature}=signatures[0]!;
      return signature;
    });
    const verified = verifyLegacyImplementationSliceV2({ slice, compilerInput: {
      packetHash: packet.packetHash, packet: packet.packet, productSpec: packet.productSpec,
      designGraph: packet.designGraph, buildTopology: packet.buildTopology, storyPlan: packet.storyPlan,
      designSourceClosure: packet.designSourceClosure, implementationSourceMap: packet.implementationSourceMap,
      storyId: input.storyId, sourceRevision: origin.authority.baseRevision, producer: packet.producer,
      currentFiles: reproductionFiles,
      dependencyOutputs: origin.authority.dependencyAttempts.map(dependency=>({
        storyId:dependency.storyId,sliceHash:dependency.sliceHash,outputHash:dependency.outputHash,
        sourceAfter:dependency.sourceAfter,fileSignatures:dependency.fileSignatures,
      })),
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
    const gitCustody = assembled ? await authenticateNativeGitCustody(options.sql, {
      runId: input.runId, claimId: input.claimId, worktree: input.worktree, branch: input.branch,
      sourceBefore: authority.baseRevision,
    }) : undefined;
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
      if (!gitCustody) throw new Error("V3_NATIVE_GIT_CUSTODY_UNAUTHENTICATED");
      await recheckNativeGitCustodyInTransaction(transaction, gitCustody);
      const reserved = await reserveAttemptInTransaction(transaction, {
        claimId: input.claimId, runId: input.runId, stepId: input.stepId, storyId: input.storyId,
        attemptClass: "product_implementation", packetHash: authority.packetHash,
        compilationReportHash: authority.compilationReportHash, sliceHash: assembled.sliceHash,
        sourceBefore: authority.baseRevision, role: input.role, agentId: input.agentId,
        branch: input.branch, worktree: input.worktree,
        evidenceRefs: [`setfarm://claim-log/${input.claimId}`, `setfarm://artifact/${assembled.sliceHash}`,
          `setfarm://preparation-authority-v2/${authority.authorityHash}`, gitCustody.evidenceRef],
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

/** Native context retains initial origin separately from an authenticated
 * recovery execution row and its current-source deterministic plan. */
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
  operationalRetry?: Readonly<{ directive: OperationalRetryDirectiveV1; artifactHash: string; refKey: string }>;
  evidenceOnly?: Readonly<{ revision: RecoveryCaseRevisionV1; dispatch: RecoveryRevisionDispatchV1;
    findingSet: FindingSetV1; sourceOwnerAttemptId: string }>;
  downstreamEvidence?: Readonly<{parentClaimId:number;sourceOwnerAttemptId:string}>;
  supervisorRetry?: never;
  recovery?: NativeRecoveryContextV3;
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
  const attempt = compiled.attempt;
  const executionAuthority = attempt.attemptClass === "supervisor_repair"
    ? { role: "supervisor", attemptClass: "supervisor_repair" }
    : { role: "developer", attemptClass: compiled.operationalRetry ? "infrastructure_retry" : "product_implementation" };
  if (attempt.role !== executionAuthority.role || attempt.attemptClass !== executionAuthority.attemptClass) {
    throw new Error("V3_IMPLEMENTATION_HANDOFF_MODEL_AUTHORITY_REQUIRED");
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
    executionAuthority,
    executionProfile: compiled.executionProfile, sourceBefore: compiled.sourceBefore,
    artifactProducer: compiled.artifactProducer, packetEnvelope: compiled.packetEnvelope,
    compilationReportEnvelope: compiled.compilationReportEnvelope, nativeAuthority: compiled.nativeAuthority,
    implementationSlice: compiled.slice, evidencePlan: compiled.evidencePlan,
    ...(compiled.operationalRetry ? { operationalRetry: compiled.operationalRetry.directive,
      operationalRetryArtifactHash: compiled.operationalRetry.artifactHash } : {}),
    ...(compiled.recovery ? { findingSet: compiled.recovery.findingSet,
      reviewEvidenceArtifacts: compiled.recovery.reviewEvidenceArtifacts,
      recoveryAttempt: { attemptId: attempt.attemptId, claimId: attempt.claimId, runId: attempt.runId,
        stepId: attempt.stepId, storyId: attempt.storyId, generation: attempt.generation,
        attemptClass: attempt.attemptClass, role: attempt.role, packetHash: attempt.packetHash,
        compilationReportHash: attempt.compilationReportHash, sliceHash: attempt.sliceHash,
        sourceBefore: attempt.sourceBefore, findingSetHash: attempt.findingSetHash,
        recoveryCaseRevisionId: attempt.recoveryCaseRevisionId, recoveryDispatchId: attempt.recoveryDispatchId },
    } : {}),
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

  const recoveryDeliveries = createRecoveryDeliveryRepository(options.sql);
  const recoveryFindings = createFindingRecoveryRepository(options.sql);
  const attempts = createAttemptRepository(options.sql);

  // Read actual publication and immutable rows before constructing any recovery
  // slice. Reservation still rechecks these under its existing locks and CAS.
  async function recoveryInputs(input: NativeRecoveryReservationV3, attempt?: ExecutionAttemptV1) {
    const [revision, dispatch, delivery] = await Promise.all([
      recoveryDeliveries.findRevision(input.recoveryDelivery.revisionId),
      recoveryDeliveries.findDispatch(input.recoveryDelivery.dispatchId),
      recoveryDeliveries.findDelivery(input.recoveryDelivery.dispatchId),
    ]);
    if (!revision || !dispatch || !delivery) throw new Error("V3_NATIVE_RECOVERY_AUTHORITY_MISSING");
    const rows = await options.sql.unsafe<Array<{ handoff_canonical_json: string; handoff_hash: string;
      active_owner:boolean; terminal_provenance:boolean; completion_owner:boolean }>>(
      `SELECT p.handoff_canonical_json,p.handoff_hash,
        (d.owner_instance_id=$8 AND d.lease_token=$9 AND d.lease_expires_at>clock_timestamp()
          AND d.state IN ('leased','attempt_reserved','running')
          AND ((a.attempt_id IS NULL AND s.state='reserved' AND d.attempt_id IS NULL)
            OR (a.claim_id=c.id AND (a.attempt_id=s.attempt_id OR (s.state='reserved' AND s.attempt_id IS NULL))
              AND d.attempt_id=a.attempt_id
              AND d.claim_id=c.id AND d.execution_slice_hash=a.slice_hash AND d.attempt_count=1
              AND ((a.disposition IN ('claimed','running') AND a.lease_expires_at>clock_timestamp()
                AND s.state IN ('reserved','starting','running'))
                OR (q.state='processing' AND q.drained_at IS NOT NULL AND q.lease_expires_at>clock_timestamp()
                  AND s.state='drained'))))) AS active_owner,
        (a.claim_id=c.id AND a.attempt_id=s.attempt_id AND d.attempt_id=a.attempt_id
          AND d.claim_id=c.id AND d.execution_slice_hash=a.slice_hash AND d.attempt_count=1
          AND a.disposition NOT IN ('claimed','running','superseded')
          AND q.state='accepted' AND q.apply_phase='effects_committed' AND q.output_hash=a.output_hash
          AND q.claim_outcome IN ('completed','failed') AND c.outcome=q.claim_outcome
          AND s.state='released' AND d.state IN ('succeeded','failed')) AS terminal_provenance,
        (a.claim_id=c.id AND a.attempt_id=s.attempt_id AND d.attempt_id=a.attempt_id AND d.claim_id=c.id
          AND d.execution_slice_hash=a.slice_hash AND d.attempt_count=1
          AND a.disposition NOT IN ('claimed','running','superseded') AND q.output_hash=a.output_hash
          AND q.state='processing' AND q.apply_phase IN ('owner_committed','effects_committed')
          AND q.drained_at IS NOT NULL AND q.lease_expires_at>clock_timestamp() AND s.state='drained'
          AND d.state IN ('succeeded','failed')) AS completion_owner
       FROM internal_production_v3_recovery_claim_publications_v1 p
       JOIN claim_log c ON c.id=p.claim_id AND c.run_id=p.run_id
         AND c.step_id=p.workflow_step_id AND c.story_id=p.story_id
       JOIN runtime_sessions s ON s.session_id=p.runtime_session_id AND s.claim_id=c.id
         AND s.run_id=p.run_id AND s.workflow_step_id=p.workflow_step_id
         AND s.step_db_id=p.step_db_id AND s.story_db_id=p.story_db_id AND s.story_id=p.story_id
         AND s.claim_agent_id=c.agent_id
       JOIN recovery_dispatch_deliveries d ON d.dispatch_id=p.dispatch_id AND d.revision_id=p.revision_id
         AND d.run_id=p.run_id AND d.story_id=p.story_id
       LEFT JOIN execution_attempts a ON a.claim_id=c.id AND a.run_id=p.run_id AND a.step_id=p.workflow_step_id
         AND a.story_id=p.story_id AND a.recovery_dispatch_id=p.dispatch_id AND a.recovery_case_revision_id=p.revision_id
       LEFT JOIN runtime_completion_requests q ON q.attempt_id=a.attempt_id AND q.claim_id=c.id
         AND q.run_id=p.run_id AND q.story_id=p.story_id AND q.workflow_step_id=p.workflow_step_id
         AND q.runtime_session_id=s.session_id AND q.step_db_id=p.step_db_id
       WHERE p.claim_id=$1 AND p.run_id=$2 AND p.workflow_step_id=$3 AND p.story_id=$4
         AND p.revision_id=$5 AND p.dispatch_id=$6 AND c.agent_id=$7`,
      [input.claimId, input.runId, input.stepId, input.storyId, revision.revisionId, dispatch.dispatchId, input.agentId,
        input.recoveryDelivery.ownerInstanceId,input.recoveryDelivery.leaseToken]);
    if (rows.length !== 1) throw new Error("V3_NATIVE_RECOVERY_CLAIM_PUBLICATION_MISSING");
    // Publication expiry is immutable receipt DATA; actual renewal can shorten
    // or lengthen the live lease. Historical accepted provenance grants no run.
    if(!rows[0]!.active_owner && !(attempt && (rows[0]!.terminal_provenance||rows[0]!.completion_owner)))
      throw new Error("V3_NATIVE_RECOVERY_OWNER_LEASE_STALE");
    const handoff = V3RecoveryClaimHandoffV1Schema.parse(JSON.parse(rows[0]!.handoff_canonical_json));
    const findingSet = await recoveryFindings.findFindingSet(dispatch.findingSetHash);
    const directive = {
      packetHash: revision.packetHash, contractSliceHash: revision.contractSliceHash,
      sourceRevision: revision.sourceRevision, findingSetHash: revision.findingSetHash,
      findingIds: revision.findingIds, expectedDelta: revision.expectedDelta,
      allowedPaths: revision.allowedPaths, evidencePlan: revision.evidencePlan,
      ...(revision.evidencePlanArtifactHash ? { evidencePlanArtifactHash: revision.evidencePlanArtifactHash } : {}),
    };
    if (rows[0]!.handoff_canonical_json !== canonicalJsonStringify(handoff)
      || rows[0]!.handoff_hash !== hashCanonicalJson(handoff)
      || handoff.runId !== input.runId || handoff.storyId !== input.storyId
      || handoff.revisionId !== revision.revisionId || handoff.dispatchId !== dispatch.dispatchId
      || handoff.recoveryCaseId !== revision.recoveryCaseId || dispatch.recoveryCaseId !== revision.recoveryCaseId
      || dispatch.revisionId !== revision.revisionId || handoff.dispatchClass !== dispatch.dispatchClass
      || handoff.recoveryOwner !== revision.owner || revision.runId !== input.runId || revision.storyId !== input.storyId
      || dispatch.runId !== input.runId || dispatch.storyId !== input.storyId
      || !same(handoff.directive, directive) || dispatch.packetHash !== revision.packetHash
      || dispatch.contractSliceHash !== revision.contractSliceHash || !same(dispatch.sourceRevision, revision.sourceRevision)
      || dispatch.findingSetHash !== revision.findingSetHash || !same(dispatch.findingIds, revision.findingIds)
      || !same(dispatch.evidencePlan, revision.evidencePlan) || dispatch.evidencePlanArtifactHash !== revision.evidencePlanArtifactHash
      || !findingSet || findingSet.findingSetHash !== revision.findingSetHash
      || findingSet.runId !== input.runId || findingSet.storyId !== input.storyId
      || findingSet.packetHash !== revision.packetHash || findingSet.sliceHash !== revision.contractSliceHash
      || !same(findingSet.sourceRevision, revision.sourceRevision)
      || !same(findingSet.findings.map(finding => finding.findingId), revision.findingIds)
      || (input.findingSetHash !== undefined && input.findingSetHash !== findingSet.findingSetHash)
      || handoff.lease.ownerInstanceId !== input.recoveryDelivery.ownerInstanceId
      || handoff.lease.leaseToken !== input.recoveryDelivery.leaseToken
      || delivery.ownerInstanceId !== handoff.lease.ownerInstanceId || delivery.leaseToken !== handoff.lease.leaseToken
      || input.role !== (handoff.dispatchClass === "supervisor_repair" ? "supervisor" : "developer")) {
      throw new Error("V3_NATIVE_RECOVERY_AUTHORITY_MISMATCH");
    }
    if (attempt && (attempt.claimId !== input.claimId || delivery.claimId !== input.claimId
      || delivery.attemptId !== attempt.attemptId || delivery.executionSliceHash !== attempt.sliceHash
      || delivery.attemptCount !== 1 || attempt.recoveryCaseRevisionId !== revision.revisionId
      || attempt.recoveryDispatchId !== dispatch.dispatchId || attempt.findingSetHash !== findingSet.findingSetHash
      || attempt.attemptClass !== handoff.dispatchClass || attempt.role !== input.role
      || !same(attempt.sourceBefore, revision.sourceRevision))) {
      throw new Error("V3_NATIVE_RECOVERY_ATTEMPT_MISMATCH");
    }
    // Resolve the genuine predecessor's initial binding; never synthesize a V2
    // authority at the recovery base or insert this successor into that relation.
    const priorRows = await options.sql.unsafe<Array<{ attempt_id: string }>>(
      `SELECT a.attempt_id FROM execution_attempts a JOIN recovery_cases c
         ON c.recovery_case_id=$1 AND c.prior_attempt_refs::jsonb ? a.attempt_id
       JOIN runtime_completion_requests q ON q.attempt_id=a.attempt_id AND q.claim_id=a.claim_id
         AND q.run_id=a.run_id AND q.workflow_step_id=a.step_id AND q.story_id=a.story_id AND q.output_hash=a.output_hash
       JOIN runtime_sessions s ON s.session_id=q.runtime_session_id AND s.attempt_id=a.attempt_id
         AND s.claim_id=a.claim_id AND s.run_id=a.run_id AND s.story_id=a.story_id
         AND s.step_db_id=q.step_db_id AND s.workflow_step_id=a.step_id
       JOIN claim_log cl ON cl.id=a.claim_id AND cl.outcome=q.claim_outcome
       WHERE a.run_id=$2 AND a.step_id=$3 AND a.story_id=$4 AND a.recovery_dispatch_id IS DISTINCT FROM $5
         AND ($6::integer IS NULL OR a.generation=$6)
         AND q.state='accepted' AND q.apply_phase='effects_committed' AND s.state='released'
         AND q.claim_outcome IN ('completed','failed') ORDER BY a.generation DESC LIMIT 1`,
      [handoff.recoveryCaseId, input.runId, input.stepId, input.storyId, dispatch.dispatchId,
        attempt ? attempt.generation - 1 : null]);
    const predecessor = priorRows[0] ? await attempts.findById(priorRows[0].attempt_id) : undefined;
    const originRefs = predecessor?.evidenceRefs.filter(ref => ref.startsWith("setfarm://preparation-authority-v2/")) ?? [];
    if (!predecessor || originRefs.length !== 1 || predecessor.sliceHash !== revision.contractSliceHash
      || !same(predecessor.sourceAfter, revision.sourceRevision)) throw new Error("V3_NATIVE_RECOVERY_PREDECESSOR_MISMATCH");
    const originRows = await options.sql.unsafe<Array<{ attempt_id: string }>>(
      `SELECT b.attempt_id FROM v3_preparation_authority_attempts_v2 b
       JOIN execution_attempts a ON a.attempt_id=b.attempt_id AND a.claim_id=b.claim_id AND a.slice_hash=b.slice_hash
       WHERE b.authority_hash=$1 AND a.run_id=$2 AND a.step_id=$3 AND a.story_id=$4`,
      [originRefs[0]!.slice("setfarm://preparation-authority-v2/".length), input.runId, input.stepId, input.storyId]);
    const origin = originRows[0] && originRows.length === 1
      ? await readV3PreparationAuthorityByAttemptV2(options.sql, originRows[0].attempt_id) : undefined;
    const initial = originRows[0] ? await attempts.findById(originRows[0].attempt_id) : undefined;
    if (!origin || !initial || initial.attemptClass !== "product_implementation" || initial.role !== "developer"
      || initial.recoveryDispatchId || initial.recoveryCaseRevisionId || initial.claimId !== origin.claimId
      || initial.packetHash !== origin.authority.packetHash || initial.compilationReportHash !== origin.authority.compilationReportHash
      || !same(initial.sourceBefore, origin.authority.baseRevision) || initial.packetHash !== revision.packetHash
      || predecessor.compilationReportHash !== initial.compilationReportHash
      || (attempt && (attempt.packetHash !== initial.packetHash || attempt.compilationReportHash !== initial.compilationReportHash
        || !same(attempt.evidenceRefs.filter(ref => ref.startsWith("setfarm://preparation-authority-v2/")), originRefs)))) {
      throw new Error("V3_NATIVE_RECOVERY_ORIGIN_MISMATCH");
    }
    if (findingSet.findings.some(finding => finding.classification === "unstructured_review")
      && (revision.owner !== "supervisor" || dispatch.dispatchClass !== "supervisor_repair" || input.role !== "supervisor")) {
      throw new Error("V3_NATIVE_RECOVERY_REVIEW_AUTHORITY_MISMATCH");
    }
    const packet = await reader.readExactSealedPacket(input.runId);
    if (!("implementationSourceMap" in packet) || packet.packetHash !== origin.authority.packetHash
      || packet.refs.compilationReport !== origin.authority.compilationReportHash) {
      throw new Error("V3_NATIVE_RECOVERY_ORIGIN_MISMATCH");
    }
    const reviewEvidenceArtifacts = await loadV3ReviewEvidenceArtifactsV1({
      readArtifact: hash => readV3NativeIndexedArtifact(reader, hash),
      producer: packet.producer, findingSet,
    });
    return { revision, dispatch, findingSet, handoff, delivery, predecessor, initialAttemptId: initial.attemptId, origin: origin.authority,
      reviewEvidenceArtifacts };
  }

  async function compileRecovery(input: NativeRecoveryReservationV3, authority: Awaited<ReturnType<typeof recoveryInputs>>,
    attempt?: ExecutionAttemptV1) {
    const packet = await reader.readExactSealedPacket(input.runId);
    if (!("implementationSourceMap" in packet) || packet.packetHash !== authority.origin.packetHash
      || packet.refs.compilationReport !== authority.origin.compilationReportHash) throw new Error("V3_NATIVE_PREPARED_PACKET_MISMATCH");
    for (const dependency of authority.origin.dependencyAttempts) {
      const actual = await readV3NativeDependencyAuthority(options.sql, options.sql, {
        runId: input.runId, stepId: input.stepId, packetHash: packet.packetHash,
        storyId: dependency.storyId, attemptId: dependency.attemptId,
      }, options);
      if (!same(actual, dependency)) throw new Error("V3_NATIVE_PREPARED_DEPENDENCY_MISMATCH");
    }
    const files = nativeImplementationSourcePathsV3(packet, input.storyId);
    const current = attempt
      ? await captureNativeAttemptFileSignatures(options.sql, { runId: input.runId, attemptId: attempt.attemptId,
          source: authority.revision.sourceRevision, files })
      : captureNativeOriginalFileSignatures({ worktree: input.worktree, source: authority.revision.sourceRevision, files });
    // A readonly dependency copy belongs to the semantic input, not the pinned
    // failed candidate's tree. Reproduce only its already-authenticated initial
    // input; writable/owned recovery witnesses remain the actual candidate.
    const initial = await preparedService.loadPreparedAttempt({ runId: input.runId,
      storyId: input.storyId, attemptId: authority.initialAttemptId });
    if (!same(initial.nativeAuthority, authority.origin)) throw Error("V3_NATIVE_RECOVERY_ORIGIN_MISMATCH");
    const readonlyInputs = initial.slice.files.filter(file => file.role === "shared_readonly").flatMap(file => {
      const dependencies = authority.origin.dependencyAttempts.filter(dependency =>
        dependency.fileSignatures.some(signature => signature.pathRef === file.pathRef && signature.path === file.path));
      if (!dependencies.length) return [];
      const signature = dependencies[0]!.fileSignatures.find(signature => signature.pathRef === file.pathRef && signature.path === file.path);
      if (dependencies.length !== 1 || !signature || authority.revision.allowedPaths.includes(file.path)
        || !same(signature, { pathRef: file.pathRef, path: file.path, presence: file.presence, contentHash: file.contentHash }))
        throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
      return [{ signature, dependency: dependencies[0]! }];
    });
    const semanticCurrent = current.map(snapshot =>
      readonlyInputs.find(input => input.signature.pathRef === snapshot.pathRef && input.signature.path === snapshot.path)?.signature ?? snapshot);
    const changes = current.filter(file => authority.revision.allowedPaths.includes(file.path))
      .map(({ pathRef, path, presence, contentHash }) => ({ pathRef, path, before: { presence, contentHash } }));
    const recovery = ImplementationRecoveryDirectiveV2Schema.parse({
      schema: "setfarm.implementation-recovery-directive.v2", findingSet: authority.findingSet,
      sourceRevision: authority.revision.sourceRevision,
      expectedSourceDelta: { schema: "setfarm.implementation-source-delta.v2", mode: "generated_repair",
        expectedDelta: authority.revision.expectedDelta, allowedPaths: authority.revision.allowedPaths, changes },
    });
    const compilerInput = {
      packetHash: packet.packetHash, packet: packet.packet, productSpec: packet.productSpec,
      designGraph: packet.designGraph, buildTopology: packet.buildTopology, storyPlan: packet.storyPlan,
      designSourceClosure: packet.designSourceClosure, implementationSourceMap: packet.implementationSourceMap,
      storyId: input.storyId, sourceRevision: authority.revision.sourceRevision, producer: packet.producer,
      currentFiles: semanticCurrent.map(({ path: _path, ...snapshot }) => snapshot), recovery,
      dependencyOutputs: authority.origin.dependencyAttempts.map(dependency=>({
        storyId:dependency.storyId,sliceHash:dependency.sliceHash,outputHash:dependency.outputHash,
        sourceAfter:dependency.sourceAfter,fileSignatures:dependency.fileSignatures,
      })),
    };
    const compiled = compileLegacyImplementationSliceV2(compilerInput);
    if (compiled.status !== "compiled") throw new Error(`V3_NATIVE_RECOVERY_COMPILATION_REJECTED:${JSON.stringify(compiled.diagnostics)}`);
    const verified = verifyLegacyImplementationSliceV2({ slice: compiled.slice, compilerInput });
    if (verified.status !== "verified" || verified.sliceHash !== compiled.sliceHash) throw new Error("V3_NATIVE_RECOVERY_REPRODUCTION_FAILED");
    return { ...compiled, current, semanticCurrent, readonlyInputs, sliceRefKey: createV3ArtifactRefKeyV2("slice", input.storyId, compiled.sliceHash) };
  }

  // Only first reservation provisions worker input. Context/history/replay
  // reproduction above never mutates the worktree or its index flags.
  async function provisionRecoveryReadonlyInputs(input: NativeRecoveryReservationV3,
    assembled: Awaited<ReturnType<typeof compileRecovery>>) {
    const files = assembled.current.map(({ pathRef, path }) => ({ pathRef, path }));
    const stripPath = ({ path: _path, ...snapshot }: typeof assembled.current[number]) => snapshot;
    const observed = captureV3ImplementationSourceSnapshotsV2({ worktree: input.worktree, files }).snapshots;
    for (const snapshot of observed) {
      const original = assembled.current.find(file => file.pathRef === snapshot.pathRef);
      const semantic = assembled.semanticCurrent.find(file => file.pathRef === snapshot.pathRef);
      if (!original || !semantic || (!same(snapshot, stripPath(original)) && !same(snapshot, stripPath(semantic))))
        throw Error("V3_NATIVE_RECOVERY_SOURCE_CHANGED");
    }
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" };
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_NAMESPACE"]) delete env[key];
    const git = (args: string[], maxBuffer = 16_384) => execFileSync("git", ["--no-replace-objects", "--literal-pathspecs", ...args], {
      cwd: input.worktree, env, timeout: 10_000, maxBuffer, stdio: ["ignore", "pipe", "pipe"],
    });
    const indexTree = git(["write-tree"]).toString("utf8").trim();
    if (indexTree !== assembled.slice.sourceRevision.treeHash) throw Error("V3_NATIVE_RECOVERY_SOURCE_CHANGED");
    const assertStillUnreserved = async () => {
      // Fresh SQL-only observation, outside any transaction. A duplicate that
      // already reserved/attached an attempt may only take the read-only path.
      const rows = await options.sql.unsafe<Array<{ claim_id: string | number }>>(`
        SELECT p.claim_id FROM internal_production_v3_recovery_claim_publications_v1 p
        JOIN claim_log c ON c.id=p.claim_id AND c.run_id=p.run_id AND c.step_id=p.workflow_step_id AND c.story_id=p.story_id
        JOIN runtime_sessions s ON s.session_id=p.runtime_session_id AND s.claim_id=c.id
          AND s.run_id=p.run_id AND s.workflow_step_id=p.workflow_step_id AND s.story_id=p.story_id
          AND s.step_db_id=p.step_db_id AND s.story_db_id=p.story_db_id AND s.claim_agent_id=c.agent_id
        JOIN recovery_dispatch_deliveries d ON d.dispatch_id=p.dispatch_id AND d.revision_id=p.revision_id
          AND d.run_id=p.run_id AND d.story_id=p.story_id
        WHERE p.claim_id=$1 AND p.run_id=$2 AND p.story_id=$3 AND p.workflow_step_id=$4
          AND p.dispatch_id=$5 AND p.revision_id=$6 AND c.agent_id=$7
          AND s.state='reserved' AND s.attempt_id IS NULL
          AND d.state='leased' AND d.attempt_id IS NULL AND d.claim_id IS NULL AND d.attempt_count=0
          AND d.owner_instance_id=$8 AND d.lease_token=$9 AND d.lease_expires_at>clock_timestamp()
          AND NOT EXISTS (SELECT 1 FROM execution_attempts a WHERE a.claim_id=p.claim_id)
      `, [input.claimId,input.runId,input.storyId,input.stepId,input.recoveryDelivery.dispatchId,
        input.recoveryDelivery.revisionId,input.agentId,input.recoveryDelivery.ownerInstanceId,input.recoveryDelivery.leaseToken]);
      if (rows.length !== 1) throw Error("V3_NATIVE_RECOVERY_READONLY_OWNER_CHANGED");
    };
    const root = realpathSync(input.worktree);
    let totalBytes = 0;
    for (const { signature, dependency } of assembled.readonlyInputs) {
      const original = assembled.current.find(file => file.pathRef === signature.pathRef && file.path === signature.path);
      if (!original) throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
      if (same(original, signature)) continue;
      // Existing initial dependency-copy semantics hide only tracked readonly
      // input. Never insert a readonly blob into this candidate's index.
      const tracked = git(["ls-files", "-z", "--", signature.path]).toString("utf8");
      if (tracked !== signature.path + "\0" || signature.presence !== "present" || original.presence !== "present")
        throw Error("V3_NATIVE_RECOVERY_READONLY_TRACKED_INPUT_REQUIRED");
      const listed = git(["ls-tree", "-z", dependency.sourceAfter.sha, "--", signature.path]).toString("utf8");
      const entry = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0]+)\0$/.exec(listed);
      if (!entry || entry[3] !== signature.path) throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
      const bytes = git(["cat-file", "blob", entry[2]!], V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxFileBytes + 1);
      totalBytes += bytes.byteLength;
      if (bytes.byteLength > V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxFileBytes
        || totalBytes > V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxTotalBytes
        || createHash("sha256").update(bytes).digest("hex") !== signature.contentHash)
        throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
      if (signature.path.split("/").some(segment => segment === ".git" || segment === ".setfarm"))
        throw Error("V3_NATIVE_RECOVERY_READONLY_PATH_INVALID");
      const target = path.join(root, signature.path);
      let parent = root;
      const parents = signature.path.split("/").slice(0, -1).map(segment => {
        parent = path.join(parent, segment);
        const stat = lstatSync(parent);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error("V3_NATIVE_RECOVERY_READONLY_PATH_INVALID");
        return { path: parent, dev: stat.dev, ino: stat.ino };
      });
      const before = lstatSync(target);
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
        throw Error("V3_NATIVE_RECOVERY_READONLY_PATH_INVALID");
      await assertStillUnreserved();
      // Recheck the path closure immediately before opening for mutation.
      if (parents.some(parent => { const stat = lstatSync(parent.path); return !stat.isDirectory() || stat.isSymbolicLink()
        || stat.dev !== parent.dev || stat.ino !== parent.ino; }))
        throw Error("V3_NATIVE_RECOVERY_READONLY_PATH_INVALID");
      const fd = openSync(target, constants.O_RDWR | constants.O_NOFOLLOW);
      try {
        const opened = fstatSync(fd);
        if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino)
          throw Error("V3_NATIVE_RECOVERY_READONLY_PATH_INVALID");
        if (opened.size > V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxFileBytes)
          throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
        const currentBytes = Buffer.alloc(opened.size);
        let read = 0;
        while (read < currentBytes.byteLength) {
          const count = readSync(fd, currentBytes, read, currentBytes.byteLength - read, read);
          if (!count) throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
          read += count;
        }
        const currentHash = createHash("sha256").update(currentBytes).digest("hex");
        const readIdentity = fstatSync(fd);
        if (currentHash !== original.contentHash && currentHash !== signature.contentHash)
          throw Error("V3_NATIVE_RECOVERY_SOURCE_CHANGED");
        if (readIdentity.size !== opened.size || readIdentity.mtimeMs !== opened.mtimeMs
          || readIdentity.ctimeMs !== opened.ctimeMs || readIdentity.dev !== before.dev || readIdentity.ino !== before.ino
          || readIdentity.nlink !== 1)
          throw Error("V3_NATIVE_RECOVERY_READONLY_PATH_INVALID");
        // Positional descriptor IO prevents a pre-write read from shifting the
        // write offset. Never clobber bytes other than exact base/same recipe.
        let written = 0;
        while (written < bytes.byteLength) {
          const count = writeSync(fd, bytes, written, bytes.byteLength - written, written);
          if (!count) throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
          written += count;
        }
        ftruncateSync(fd, bytes.byteLength);
      } finally { closeSync(fd); }
      const after = lstatSync(target);
      if (after.dev !== before.dev || after.ino !== before.ino || after.nlink !== 1 || !after.isFile()
        || parents.some(parent => { const stat = lstatSync(parent.path); return !stat.isDirectory() || stat.isSymbolicLink()
          || stat.dev !== parent.dev || stat.ino !== parent.ino; }))
        throw Error("V3_NATIVE_RECOVERY_READONLY_PATH_INVALID");
      await assertStillUnreserved();
      git(["update-index", "--assume-unchanged", "--", signature.path]);
    }
    const actual = captureV3ImplementationSourceSnapshotsV2({ worktree: input.worktree, files }).snapshots;
    if (!same(actual, assembled.semanticCurrent.map(stripPath)) || git(["write-tree"]).toString("utf8").trim() !== indexTree
      || git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], 16 * 1024 * 1024).byteLength
      || !same(resolveV3GitRevision({ repo: input.worktree, requestedRef: "HEAD",
        expectedSha: assembled.slice.sourceRevision.sha }), assembled.slice.sourceRevision))
      throw Error("V3_NATIVE_RECOVERY_READONLY_INPUT_MISMATCH");
  }

  async function recoveryAttemptInputs(attempt: ExecutionAttemptV1) {
    if (!attempt.worktree || !attempt.branch || !attempt.claimId || !attempt.recoveryDispatchId || !attempt.recoveryCaseRevisionId) {
      throw new Error("V3_NATIVE_RECOVERY_ATTEMPT_MISMATCH");
    }
    const delivery = await recoveryDeliveries.findDelivery(attempt.recoveryDispatchId);
    const input = RecoveryReserveInputSchema.parse({ claimId: attempt.claimId, runId: attempt.runId,
      stepId: attempt.stepId, storyId: attempt.storyId, role: attempt.role, agentId: attempt.agentId,
      branch: attempt.branch, worktree: attempt.worktree, findingSetHash: attempt.findingSetHash,
      recoveryDelivery: { dispatchId: attempt.recoveryDispatchId, revisionId: attempt.recoveryCaseRevisionId,
        ownerInstanceId: delivery?.ownerInstanceId, leaseToken: delivery?.leaseToken } });
    const authority = await recoveryInputs(input, attempt);
    return {input,authority};
  }

  async function loadRecoveryPrepared(attempt: ExecutionAttemptV1): Promise<NativeRecoveryPreparedV3> {
    const {input,authority}=await recoveryAttemptInputs(attempt);
    const assembled = await compileRecovery(input, authority, attempt);
    const envelope = await readV3NativeIndexedArtifact(reader, assembled.sliceHash);
    const refs = await options.sql.unsafe<Array<{ artifact_hash: string }>>(
      "SELECT artifact_hash FROM run_artifact_refs WHERE run_id=$1 AND ref_key=$2", [input.runId, assembled.sliceRefKey]);
    if (attempt.sliceHash !== assembled.sliceHash || !same(envelope, assembled.envelope)
      || refs.length !== 1 || refs[0]!.artifact_hash !== assembled.sliceHash
      || !attempt.evidenceRefs.includes(`setfarm://artifact/${assembled.sliceHash}`)) throw new Error("V3_NATIVE_RECOVERY_REFERENCE_MISMATCH");
    return { kind: "native-recovery-prepared", readiness: readinessFromNativePreparationV2(authority.origin),
      nativeAuthority: authority.origin, attempt, slice: assembled.slice, sliceHash: assembled.sliceHash,
      sliceRefKey: assembled.sliceRefKey, sourceBefore: authority.revision.sourceRevision,
      recovery: { revision: authority.revision, dispatch: authority.dispatch,
        findingSet: authority.findingSet, reviewEvidenceArtifacts: authority.reviewEvidenceArtifacts } };
  }

  async function reserveRecovery(raw: unknown): Promise<NativeImplementationContextV3> {
    const input = RecoveryReserveInputSchema.parse(raw);
    const authority = await recoveryInputs(input);
    const held = await createV3RecoveryClaimAuthority(options.sql).acquireRecoveryClaim({
      runId: input.runId, storyId: input.storyId, ownerInstanceId: input.recoveryDelivery.ownerInstanceId,
      continuation: authority.delivery.attemptId ? { kind: "attempt", attemptId: authority.delivery.attemptId }
        : { kind: "unreserved_lease", leaseToken: input.recoveryDelivery.leaseToken },
    });
    if (!same(held.directive, authority.handoff.directive)
      || held.lease.ownerInstanceId!==authority.handoff.lease.ownerInstanceId
      || held.lease.leaseToken!==authority.handoff.lease.leaseToken) {
      throw new Error("V3_NATIVE_RECOVERY_LIVE_LEASE_MISMATCH");
    }
    const gitCustody = await authenticateNativeGitCustody(options.sql, {
      runId: input.runId, claimId: input.claimId, worktree: input.worktree, branch: input.branch,
      sourceBefore: authority.revision.sourceRevision,
    });
    // A replay reloads immutable pinned source and never requires current edits
    // to equal sourceBefore. The lower reservation still authenticates its lease.
    const assembled = await compileRecovery(input, authority);
    const fresh = await recoveryInputs(input);
    if (fresh.delivery.attemptId) {
      const existing = await attempts.findById(fresh.delivery.attemptId);
      if (!existing || existing.claimId !== input.claimId || existing.runId !== input.runId || existing.storyId !== input.storyId
        || existing.recoveryDispatchId !== input.recoveryDelivery.dispatchId || existing.recoveryCaseRevisionId !== input.recoveryDelivery.revisionId)
        throw Error("V3_NATIVE_RECOVERY_ATTEMPT_MISMATCH");
      return loadAttemptContext({ runId: input.runId, storyId: input.storyId, attemptId: existing.attemptId });
    }
    {
      const head = resolveV3GitRevision({ repo: input.worktree, requestedRef: "HEAD", expectedSha: authority.revision.sourceRevision.sha });
      const status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
        cwd: input.worktree, timeout: 10_000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
      });
      if (status.byteLength || !same(head, authority.revision.sourceRevision)) throw new Error("V3_NATIVE_RECOVERY_SOURCE_CHANGED");
      await provisionRecoveryReadonlyInputs(input, assembled);
      const after = await authenticateNativeGitCustody(options.sql, {
        runId: input.runId, claimId: input.claimId, worktree: input.worktree, branch: input.branch,
        sourceBefore: authority.revision.sourceRevision,
      });
      if (!same(after, gitCustody)) throw Error("V3_NATIVE_RECOVERY_SOURCE_CHANGED");
      const live = await recoveryInputs(input);
      if (!same(live.handoff, authority.handoff) || !same(live.origin, authority.origin))
        throw Error("V3_NATIVE_RECOVERY_AUTHORITY_MISMATCH");
    }
    const published = await publisher.put(assembled.envelope);
    if (published.hash !== assembled.sliceHash) throw new Error("V3_NATIVE_SLICE_PUBLICATION_MISMATCH");
    const reservation = await options.sql.begin(async transaction => {
      await lockAttemptReservationOwnerInTransaction(transaction, input);
      await recheckNativeGitCustodyInTransaction(transaction, gitCustody);
      const result = await reserveAttemptInTransaction(transaction, {
        claimId: input.claimId, runId: input.runId, stepId: input.stepId, storyId: input.storyId,
        attemptClass: authority.handoff.dispatchClass, packetHash: authority.origin.packetHash,
        compilationReportHash: authority.origin.compilationReportHash, sliceHash: assembled.sliceHash,
        sourceBefore: authority.revision.sourceRevision, findingSetHash: authority.findingSet.findingSetHash,
        recoveryCaseRevisionId: authority.revision.revisionId, recoveryDispatchId: authority.dispatch.dispatchId,
        recoveryDeliveryLease: { ownerInstanceId: held.lease.ownerInstanceId, leaseToken: held.lease.leaseToken },
        recoveryExecutionSliceEnvelope: assembled.envelope,
        role: input.role, agentId: input.agentId, branch: input.branch, worktree: input.worktree,
        evidenceRefs: [`setfarm://claim-log/${input.claimId}`, `setfarm://artifact/${assembled.sliceHash}`,
          `setfarm://preparation-authority-v2/${authority.origin.authorityHash}`,
          `setfarm://finding-set/${authority.findingSet.findingSetHash}`,
          `setfarm://recovery-revision/${authority.revision.revisionId}`, `setfarm://recovery-dispatch/${authority.dispatch.dispatchId}`,
          ...authority.reviewEvidenceArtifacts.map(artifact => `setfarm://artifact/${artifact.artifactHash}`),
          ...authority.predecessor.evidenceRefs.filter(ref => ref.startsWith("setfarm://native-git-custody-v1/"))],
      });
      if (result.status !== "reserved") throw new Error("V3_NATIVE_RESERVATION_CONFLICT");
      await transaction.unsafe("INSERT INTO run_artifact_refs(run_id,ref_key,artifact_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [input.runId, assembled.sliceRefKey, assembled.sliceHash]);
      const refs = await transaction.unsafe<Array<{ artifact_hash: string }>>(
        "SELECT artifact_hash FROM run_artifact_refs WHERE run_id=$1 AND ref_key=$2", [input.runId, assembled.sliceRefKey]);
      if (refs[0]?.artifact_hash !== assembled.sliceHash) throw new Error("V3_NATIVE_RESERVATION_REFERENCE_CONFLICT");
      return result.attempt;
    });
    const compiled = await compileContext(await loadRecoveryPrepared(reservation));
    await publishContext(input, compiled);
    return loadAttemptContext({ runId: input.runId, storyId: input.storyId, attemptId: reservation.attemptId });
  }

  const operationalInputSchema = ReserveInputSchema.omit({ nativeAuthorityHash: true }).extend({
    operationalRetry: OperationalRetryDirectiveV1Schema,
  }).strict();

  async function operationalOrigin(directive: OperationalRetryDirectiveV1, claimId: number) {
    const prior = await preparedService.loadPreparedAttempt({ runId: directive.runId, storyId: directive.storyId,
      attemptId: directive.priorAttempt.attemptId });
    const a = prior.attempt;
    const paths = prior.slice.files.filter(file => file.role === "owned" || file.role === "shared_writable").map(file => file.path).sort();
    if (a.claimId !== directive.priorAttempt.claimId || claimId === a.claimId || a.generation !== directive.priorAttempt.generation
      || a.disposition !== directive.priorAttempt.terminalDisposition || a.packetHash !== directive.priorAttempt.packetHash
      || a.sliceHash !== directive.priorAttempt.sliceHash || a.stepId !== directive.stepId
      || !same(a.sourceBefore, directive.priorAttempt.sourceBefore) || !same(a.sourceBefore, directive.nextSourceRevision)
      || !same(paths, directive.expectedDelta.allowedPaths)) throw Error("V3_NATIVE_OPERATIONAL_ORIGIN_MISMATCH");
    return prior;
  }

  async function loadOperationalContext(attempt: ExecutionAttemptV1): Promise<NativeImplementationContextV3> {
    const hashes = attempt.evidenceRefs.filter(ref => ref.startsWith("setfarm://operational-retry-artifact/"))
      .map(ref => ref.slice("setfarm://operational-retry-artifact/".length));
    if (hashes.length !== 1 || !attempt.claimId || attempt.role !== "developer"
      || attempt.recoveryDispatchId || attempt.recoveryCaseRevisionId) throw Error("V3_NATIVE_OPERATIONAL_ATTEMPT_MISMATCH");
    const envelope = await readV3NativeIndexedArtifact(reader, hashes[0]!);
    if (envelope.artifactType !== "setfarm.operational-retry-directive.v1") throw Error("V3_NATIVE_OPERATIONAL_ARTIFACT_MISMATCH");
    const directive = OperationalRetryDirectiveV1Schema.parse(envelope.payload);
    const origin = await operationalOrigin(directive, attempt.claimId);
    const compiled = await compileContext(origin);
    const originRefs = origin.attempt.evidenceRefs.filter(ref => ref.startsWith("setfarm://preparation-authority-v2/")
      || ref.startsWith("setfarm://native-git-custody-v1/"));
    if (attempt.generation !== origin.attempt.generation + 1 || attempt.runId !== directive.runId
      || attempt.storyId !== directive.storyId || attempt.stepId !== directive.stepId
      || attempt.packetHash !== compiled.packetHash || attempt.compilationReportHash !== compiled.compilationReportHash
      || attempt.sliceHash !== origin.sliceHash || !same(attempt.sourceBefore, origin.sourceBefore)
      || !same(envelope.producer, compiled.artifactProducer)
      || !attempt.evidenceRefs.includes(`setfarm://operational-retry/${directive.directiveHash}`)
      || !attempt.evidenceRefs.includes(`setfarm://artifact/${hashes[0]}`)
      || !same(attempt.evidenceRefs.filter(ref => ref.startsWith("setfarm://preparation-authority-v2/")
        || ref.startsWith("setfarm://native-git-custody-v1/")).sort(), [...originRefs].sort()))
      throw Error("V3_NATIVE_OPERATIONAL_ATTEMPT_MISMATCH");
    return { ...compiled, attempt, executionProfile: directive.executionProfile,
      operationalRetry: { directive, artifactHash: hashes[0]!, refKey: `OPERATIONAL_RETRY_${directive.directiveHash.slice(0,16).toUpperCase()}` } };
  }

  async function reserveOperational(raw: unknown): Promise<NativeImplementationContextV3> {
    const input = operationalInputSchema.parse(raw);
    const directive = input.operationalRetry;
    if (input.runId !== directive.runId || input.storyId !== directive.storyId || input.stepId !== directive.stepId)
      throw Error("V3_NATIVE_OPERATIONAL_ORIGIN_MISMATCH");
    const origin = await operationalOrigin(directive, input.claimId);
    const compiled = await compileContext(origin);
    const envelope = SemanticArtifactEnvelopeV1Schema.parse({ schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.operational-retry-directive.v1", producer: compiled.artifactProducer, payload: directive });
    const publication = await publisher.put(envelope);
    await reader.index.addRunArtifactRef({runId:input.runId,
      refKey:`OPERATIONAL_RETRY_${directive.directiveHash.slice(0,16).toUpperCase()}`,artifactHash:publication.hash});
    const existing = await options.sql.unsafe<Array<{ attempt_id: string }>>(
      "SELECT attempt_id FROM execution_attempts WHERE claim_id=$1 AND run_id=$2", [input.claimId,input.runId]);
    if (!existing.length) {
      const head = resolveV3GitRevision({ repo: input.worktree, requestedRef: "HEAD", expectedSha: origin.sourceBefore.sha });
      const status = execFileSync("git", ["status","--porcelain=v1","-z","--untracked-files=all"],
        { cwd: input.worktree, timeout: 10_000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore","pipe","pipe"] });
      if (status.byteLength || !same(head, origin.sourceBefore)) throw Error("V3_NATIVE_OPERATIONAL_SOURCE_CHANGED");
    }
    const custody = await authenticateNativeGitCustody(options.sql, { runId: input.runId, claimId: input.claimId,
      worktree: input.worktree, branch: input.branch, sourceBefore: origin.sourceBefore });
    const reserved = await options.sql.begin(async tx => {
      await lockAttemptReservationOwnerInTransaction(tx,input);
      await recheckNativeGitCustodyInTransaction(tx,custody);
      const rows = await tx.unsafe<Array<{ output: string; prior_outcome: string; generation: number; disposition: string;
        claim_id: string; authority_hash: string; slice_hash: string; packet_hash: string; compilation_report_hash: string;
        source_before_sha: string; source_before_tree_hash: string; attempt_class: string; role: string }>>(`
        SELECT story.output,prior_claim.outcome AS prior_outcome,a.generation,a.disposition,a.claim_id::text,b.authority_hash,a.slice_hash,
          a.packet_hash,a.compilation_report_hash,a.source_before_sha,a.source_before_tree_hash,a.attempt_class,a.role
        FROM stories story JOIN claim_log current_claim ON current_claim.id=$1 AND current_claim.run_id=story.run_id
          AND current_claim.story_id=story.story_id AND current_claim.step_id=$2 AND current_claim.agent_id=$3 AND current_claim.outcome IS NULL
        JOIN execution_attempts a ON a.attempt_id=$4 AND a.run_id=story.run_id AND a.story_id=story.story_id AND a.step_id=$2
        JOIN claim_log prior_claim ON prior_claim.id=a.claim_id AND prior_claim.run_id=a.run_id
        JOIN v3_preparation_authority_attempts_v2 b ON b.attempt_id=a.attempt_id AND b.claim_id=a.claim_id AND b.slice_hash=a.slice_hash
        WHERE story.run_id=$5 AND story.story_id=$6 AND story.status='running' AND story.claimed_by=$3
        FOR UPDATE OF story,a`, [input.claimId,input.stepId,input.agentId,origin.attempt.attemptId,input.runId,input.storyId]);
      const row = rows[0];
      if (rows.length !== 1 || !row || row.prior_outcome !== "infra_retry" || row.generation !== origin.attempt.generation
        || row.disposition !== directive.priorAttempt.terminalDisposition || Number(row.claim_id) !== origin.attempt.claimId
        || row.authority_hash !== origin.nativeAuthority.authorityHash || row.slice_hash !== origin.sliceHash
        || row.packet_hash !== compiled.packetHash || row.compilation_report_hash !== compiled.compilationReportHash
        || row.source_before_sha !== origin.sourceBefore.sha || row.source_before_tree_hash !== origin.sourceBefore.treeHash
        || row.attempt_class !== "product_implementation" || row.role !== "developer"
        || !same(parseOperationalRetryDirectiveStoryOutput(row.output),directive)) throw Error("V3_NATIVE_OPERATIONAL_LOCKED_AUTHORITY_MISMATCH");
      const result = await reserveAttemptInTransaction(tx, { claimId: input.claimId, runId: input.runId,
        stepId: input.stepId, storyId: input.storyId, attemptClass: "infrastructure_retry", packetHash: compiled.packetHash,
        compilationReportHash: compiled.compilationReportHash, sliceHash: origin.sliceHash, sourceBefore: origin.sourceBefore,
        role: "developer",agentId: input.agentId,worktree: input.worktree,branch: input.branch,
        predecessorAttempt: { attemptId: origin.attempt.attemptId,generation: origin.attempt.generation,
          terminalDisposition: directive.priorAttempt.terminalDisposition },
        evidenceRefs: [`setfarm://claim-log/${input.claimId}`,`setfarm://artifact/${origin.sliceHash}`,
          `setfarm://artifact/${compiled.evidencePlanArtifactHash}`,`setfarm://artifact/${publication.hash}`,
          `setfarm://operational-retry/${directive.directiveHash}`,`setfarm://operational-retry-artifact/${publication.hash}`,
          ...origin.attempt.evidenceRefs.filter(ref => ref.startsWith("setfarm://preparation-authority-v2/")
            || ref.startsWith("setfarm://native-git-custody-v1/"))] });
      if (result.status === "active_conflict") throw Error("V3_NATIVE_RESERVATION_CONFLICT");
      return result.attempt;
    });
    const result = await loadOperationalContext(reserved);
    await publishContext(input,result);
    return loadAttemptContext({runId:input.runId,storyId:input.storyId,attemptId:reserved.attemptId});
  }

  async function nativeEvidenceContext(lease: Parameters<typeof readNativeEvidenceOnlySourceAuthority>[1], attempt?: ExecutionAttemptV1) {
    const source = await readNativeEvidenceOnlySourceAuthority(options.sql,lease);
    // Reuse the immediate accepted model's actual typed initial/recovery/retry
    // loader. Its original execution grant remains provenance, not verifier power.
    const compiled = await loadAttemptContext({runId:lease.runId,storyId:lease.storyId,attemptId:source.attempt_id});
    if(compiled.attempt.attemptClass==="evidence_only"||compiled.downstreamEvidence||compiled.evidenceOnly)
      throw Error("V3_NATIVE_EVIDENCE_ONLY_SOURCE_AUTHORITY_MISMATCH");
    const [revision,dispatch,findingSet] = await Promise.all([recoveryDeliveries.findRevision(lease.revisionId),
      recoveryDeliveries.findDispatch(lease.dispatchId),recoveryFindings.findFindingSet(lease.findingSetHash)]);
    if (!revision || !dispatch || !findingSet || dispatch.dispatchClass !== "evidence_only"
      || !same(findingSet.sourceRevision,lease.sourceRevision) || findingSet.sliceHash !== compiled.sliceHash
      || findingSet.packetHash !== compiled.packetHash || findingSet.runId !== lease.runId || findingSet.storyId !== lease.storyId
      || !same(findingSet.findings.map(finding=>finding.findingId).sort(),revision.findingIds)
      || compiled.sliceHash !== lease.contractSliceHash
      || compiled.evidencePlanArtifactHash !== lease.priorEvidencePlanArtifactHash) throw Error("V3_NATIVE_EVIDENCE_ONLY_CONTEXT_MISMATCH");
    if (attempt && (attempt.generation !== source.generation + 1 || attempt.attemptClass !== "evidence_only"
      || attempt.recoveryDispatchId !== dispatch.dispatchId || attempt.recoveryCaseRevisionId !== revision.revisionId
      || attempt.findingSetHash !== findingSet.findingSetHash || attempt.packetHash !== compiled.packetHash
      || attempt.sliceHash !== compiled.sliceHash || attempt.compilationReportHash !== compiled.compilationReportHash
      || attempt.branch !== source.branch || attempt.worktree !== source.worktree || !same(attempt.sourceBefore,lease.sourceRevision)
      || !attempt.evidenceRefs.includes(`setfarm://preparation-authority-v2/${source.authority_hash}`)))
      throw Error("V3_NATIVE_EVIDENCE_ONLY_ATTEMPT_MISMATCH");
    return { compiled, source, revision, dispatch, findingSet };
  }

  async function reserveEvidenceOnly(input: Readonly<{lease:V3EvidenceOnlyPublicationLeaseV1;worktree:string;branch:string}>) {
    const {compiled,source}=await nativeEvidenceContext(input.lease);
    if(input.worktree!==source.worktree||input.branch!==source.branch) throw Error("V3_NATIVE_EVIDENCE_ONLY_SOURCE_MISMATCH");
    const head=resolveV3GitRevision({repo:input.worktree,requestedRef:"HEAD",expectedSha:input.lease.sourceRevision.sha});
    if(!same(head,input.lease.sourceRevision)) throw Error("V3_NATIVE_EVIDENCE_ONLY_SOURCE_MISMATCH");
    const attempt=await createV3EvidenceOnlyPublication(options.sql).reserve(input.lease,{
      compilationReportHash:compiled.compilationReportHash,sliceHash:compiled.sliceHash,sliceRefKey:compiled.sliceRefKey,
      evidencePlanArtifactHash:compiled.evidencePlanArtifactHash,evidencePlanRefKey:compiled.evidencePlanRefKey,
      worktree:input.worktree,branch:input.branch,role:"evidence-orchestrator",agentId:"setfarm-evidence-orchestrator",
      evidenceRefs:[`setfarm://artifact/${compiled.sliceHash}`,`setfarm://artifact/${compiled.evidencePlanArtifactHash}`,
        ...compiled.attempt.evidenceRefs.filter(ref=>ref.startsWith("setfarm://preparation-authority-v2/")||ref.startsWith("setfarm://native-git-custody-v1/"))],
    });
    return loadAttemptContext({runId:input.lease.runId,storyId:input.lease.storyId,attemptId:attempt.attemptId});
  }

  async function loadEvidenceOnlyContext(attempt:ExecutionAttemptV1):Promise<NativeImplementationContextV3>{
    if(!attempt.recoveryDispatchId||!attempt.recoveryCaseRevisionId) throw Error("V3_NATIVE_EVIDENCE_ONLY_ATTEMPT_MISMATCH");
    const delivery=await recoveryDeliveries.findDelivery(attempt.recoveryDispatchId);
    const revision=await recoveryDeliveries.findRevision(attempt.recoveryCaseRevisionId);
    if(!delivery||!revision||delivery.attemptId!==attempt.attemptId||delivery.claimId!==attempt.claimId
      ||delivery.attemptCount!==1||delivery.executionSliceHash!==attempt.sliceHash
      ) throw Error("V3_NATIVE_EVIDENCE_ONLY_DELIVERY_MISMATCH");
    const lease:Parameters<typeof readNativeEvidenceOnlySourceAuthority>[1]={runId:attempt.runId,storyId:attempt.storyId,
      recoveryCaseId:revision.recoveryCaseId,revisionId:revision.revisionId,
      dispatchId:delivery.dispatchId,packetHash:revision.packetHash,contractSliceHash:revision.contractSliceHash,
      findingSetHash:revision.findingSetHash,sourceRevision:revision.sourceRevision,
      priorEvidencePlanArtifactHash:revision.evidencePlanArtifactHash};
    const authority=await nativeEvidenceContext(lease,attempt);
    const {recovery:_recovery,operationalRetry:_retry,evidenceOnly:_evidence,...contract}=authority.compiled;
    return {...contract,attempt,sourceBefore:revision.sourceRevision,
      evidenceOnly:{revision,dispatch:authority.dispatch,findingSet:authority.findingSet,sourceOwnerAttemptId:authority.source.attempt_id}};
  }

  /** A later repair can preserve a real earlier shared delta without claiming
   * that write again. Walk only the same story's authenticated source-predecessor
   * relation; every transparent hop must retain the exact regular blob. */
  async function authenticateSharedPathProducer(input:Readonly<{
    runId:string;storyId:string;packetHash:string;
    source:Awaited<ReturnType<typeof readNativeAcceptedModelSourceAuthority>>;
    signature:Awaited<ReturnType<typeof captureNativeAttemptFileSignatures>>[number];
  }>):Promise<string> {
    let source=input.source;
    for(;;) {
      const context=await loadAttemptContext({runId:input.runId,storyId:input.storyId,attemptId:source.attempt_id});
      const file=context.slice.files.find(file=>file.pathRef===input.signature.pathRef&&file.path===input.signature.path);
      if(!file||file.role!=="shared_writable"||context.sliceHash!==source.slice_hash
        ||context.attempt.generation!==source.generation||context.evidenceOnly||context.downstreamEvidence)
        throw Error("V3_NATIVE_DOWNSTREAM_SHARED_PRODUCER_MISMATCH");
      const snapshots=await captureNativeAttemptFileSignatures(options.sql,{runId:input.runId,attemptId:source.attempt_id,
        source:{sha:source.source_after_sha,treeHash:source.source_after_tree_hash},
        files:[{pathRef:file.pathRef,path:file.path}]});
      if(snapshots.length!==1||!same(snapshots[0],input.signature))
        throw Error("V3_NATIVE_DOWNSTREAM_SHARED_PRESERVATION_MISMATCH");
      const before={pathRef:file.pathRef,path:file.path,presence:file.presence,contentHash:file.contentHash};
      if(!same(before,input.signature)) {
        if(!nativeImplementationWritePaths({implementationSlice:context.slice}).includes(file.path)
          ||source.modelOutput.disposition!=="ready_for_evidence"
          ||!source.modelOutput.changes.some(change=>change.path===file.path))
          throw Error("V3_NATIVE_DOWNSTREAM_SHARED_PRODUCER_MISMATCH");
        return source.attempt_id;
      }
      // No write at this hop: require its actual source predecessor, not any
      // earlier equal blob. Generation strictly decreases; no new retry cap.
      if(!context.attempt.recoveryDispatchId||!context.attempt.recoveryCaseRevisionId)
        throw Error("V3_NATIVE_DOWNSTREAM_SHARED_PRODUCER_MISSING");
      const lineage=await recoveryAttemptInputs(context.attempt);
      const predecessor=await readNativeAcceptedModelSourceAuthority(options.sql,{runId:input.runId,
        storyId:input.storyId,packetHash:input.packetHash,attemptId:lineage.authority.predecessor.attemptId});
      if(predecessor.generation+1!==source.generation||predecessor.authority_hash!==input.source.authority_hash
        ||predecessor.initial_attempt_id!==input.source.initial_attempt_id
        ||predecessor.source_after_sha!==source.source_before_sha
        ||predecessor.source_after_tree_hash!==source.source_before_tree_hash)
        throw Error("V3_NATIVE_DOWNSTREAM_SHARED_PREDECESSOR_MISMATCH");
      source=predecessor;
    }
  }

  async function authenticateDownstreamSource(input: Readonly<{runId:string;storyId:string;worktree:string;
    branch:string;source:SourceRevisionV1;sourceOwnerAttemptId?:string}>) {
    const packet=await reader.readExactSealedPacket(input.runId);
    if(!("implementationSourceMap" in packet)) throw Error("V3_NATIVE_DOWNSTREAM_PACKET_REQUIRED");
    const sourceOwner=await readNativeDownstreamSourceOwner(options.sql,{runId:input.runId,storyId:input.storyId,
      packetHash:packet.packetHash,sourceOwnerAttemptId:input.sourceOwnerAttemptId});
    const runContext=z.record(z.string(),z.string()).parse(JSON.parse(sourceOwner.run_context));
    if(sourceOwner.repo!==input.worktree || realpathSync(sourceOwner.repo)!==realpathSync(input.worktree)
      ||runContext.repo!==sourceOwner.repo ||runContext.branch!==input.branch)
      throw Error("V3_NATIVE_DOWNSTREAM_REPOSITORY_MISMATCH");
    const gitEnv:NodeJS.ProcessEnv={...process.env,GIT_NO_REPLACE_OBJECTS:"1",GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"};
    for(const key of ["GIT_DIR","GIT_WORK_TREE","GIT_COMMON_DIR","GIT_INDEX_FILE","GIT_OBJECT_DIRECTORY","GIT_ALTERNATE_OBJECT_DIRECTORIES","GIT_NAMESPACE"]) delete gitEnv[key];
    const git=(args:string[])=>execFileSync("git",["--no-replace-objects","--literal-pathspecs",...args],{
      cwd:input.worktree,env:gitEnv,timeout:10_000,maxBuffer:16_384,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
    if(git(["rev-parse","--abbrev-ref","HEAD"])!==input.branch
      ||!same(resolveV3GitRevision({repo:input.worktree,requestedRef:"HEAD",expectedSha:input.source.sha}),input.source))
      throw Error("V3_NATIVE_DOWNSTREAM_SOURCE_MISMATCH");
    git(["diff","--quiet","HEAD","--"]);
    // Fold only real sealed writers in dependency order. Native story candidates
    // can be siblings at the pinned base; each must occur in integrated final
    // ancestry, while copied input continuity follows the authenticated semantic DAG.
    type Signature=Awaited<ReturnType<typeof captureNativeAttemptFileSignatures>>[number];
    const effective=new Map<string,{storyId:string;sliceHash:string;outputHash:string;signature:Signature}>();
    for(const story of packet.storyPlan.stories){
      const owner=await readNativeDownstreamSourceOwner(options.sql,{runId:input.runId,storyId:story.id,packetHash:packet.packetHash});
      const terminal=await readV3NativeDependencyAuthority(options.sql,options.sql,{runId:input.runId,stepId:"implement",
        packetHash:packet.packetHash,storyId:story.id,attemptId:owner.attempt_id},options);
      git(["merge-base","--is-ancestor",terminal.sourceAfter.sha,input.source.sha]);
      const context=await loadAttemptContext({runId:input.runId,storyId:story.id,attemptId:owner.attempt_id});
      const source=await readNativeAcceptedModelSourceAuthority(options.sql,{runId:input.runId,storyId:story.id,
        packetHash:packet.packetHash,attemptId:context.evidenceOnly?.sourceOwnerAttemptId??owner.attempt_id});
      if(source.source_after_sha!==terminal.sourceAfter.sha||source.source_after_tree_hash!==terminal.sourceAfter.treeHash
        ||source.slice_hash!==terminal.sliceHash)
        throw Error("V3_NATIVE_DOWNSTREAM_SOURCE_OWNER_MISMATCH");
      // Repair contracts describe a later failed candidate. The actual initial
      // reservation still records this story's copied semantic dependency input.
      const initial=source.initial_attempt_id===source.attempt_id?context
        :await loadAttemptContext({runId:input.runId,storyId:story.id,attemptId:source.initial_attempt_id});
      for(const signature of terminal.fileSignatures){
        if(effective.has(signature.pathRef)) throw Error("V3_NATIVE_DOWNSTREAM_EFFECTIVE_WRITER_AMBIGUOUS");
        effective.set(signature.pathRef,{storyId:story.id,sliceHash:terminal.sliceHash,outputHash:terminal.outputHash,signature});
      }
      // Copied readonly dependency inputs are semantic snapshots, not writes in
      // this story's pinned-base candidate. Only a sealed writable path can
      // supersede the authenticated effective producer.
      const shared=initial.slice.files.filter(file=>file.role==="shared_writable");
      const candidate=await captureNativeAttemptFileSignatures(options.sql,{runId:input.runId,attemptId:owner.attempt_id,
        source:terminal.sourceAfter,files:shared.map(({pathRef,path})=>({pathRef,path}))});
      for(const file of shared){
        const after=candidate.find(value=>value.pathRef===file.pathRef&&value.path===file.path);
        if(!after) throw Error("V3_NATIVE_DOWNSTREAM_EFFECTIVE_WRITER_REQUIRED");
        const before={pathRef:file.pathRef,path:file.path,presence:file.presence,contentHash:file.contentHash};
        if(same(after,before)) continue;
        const previous=effective.get(file.pathRef);
        const pathOwner=packet.buildTopology.pathBindings.find(binding=>binding.id===file.pathRef&&binding.path===file.path)?.ownerRef;
        const grants=initial.slice.sharedGrants.filter(grant=>grant.fromOwnerRef===pathOwner&&grant.toOwnerRef===story.ownerRef
          &&grant.pathRefs.includes(file.pathRef)&&grant.permissions.includes("write"));
        const dependency=initial.slice.dependencyOutputs.find(value=>value.storyId===previous?.storyId);
        if(file.role!=="shared_writable"||grants.length!==1||!previous||!story.dependsOn.includes(previous.storyId)
          ||!same(previous.signature,before)||!dependency||dependency.sliceHash!==previous.sliceHash
          ||dependency.outputHash!==previous.outputHash||!dependency.fileSignatures.some(value=>same(value,before)))
          throw Error("V3_NATIVE_DOWNSTREAM_EFFECTIVE_WRITER_REQUIRED");
        await authenticateSharedPathProducer({runId:input.runId,storyId:story.id,packetHash:packet.packetHash,
          source,signature:after});
        effective.set(file.pathRef,{storyId:story.id,sliceHash:terminal.sliceHash,outputHash:terminal.outputHash,signature:after});
      }
    }
    const expected=[...effective.values()].map(value=>value.signature).sort((a,b)=>a.pathRef<b.pathRef?-1:a.pathRef>b.pathRef?1:0);
    const files=expected.map(({pathRef,path})=>({pathRef,path}));
    const finalFiles=captureNativeOriginalFileSignatures({worktree:input.worktree,source:input.source,files});
    if(!same(finalFiles,expected)) throw Error("V3_NATIVE_DOWNSTREAM_EFFECTIVE_WRITER_REQUIRED");
    const current=captureV3ImplementationSourceSnapshotsV2({worktree:input.worktree,files});
    if(!same(current.snapshots,finalFiles.map(({path:_path,...snapshot})=>snapshot)))
      throw Error("V3_NATIVE_DOWNSTREAM_SOURCE_MISMATCH");
    const compiled=await loadAttemptContext({runId:input.runId,storyId:input.storyId,attemptId:sourceOwner.attempt_id});
    if(compiled.sliceHash!==sourceOwner.slice_hash||compiled.compilationReportHash!==sourceOwner.compilation_report_hash)
      throw Error("V3_NATIVE_DOWNSTREAM_CONTRACT_MISMATCH");
    if(!same(resolveV3GitRevision({repo:input.worktree,requestedRef:"HEAD",expectedSha:input.source.sha}),input.source))
      throw Error("V3_NATIVE_DOWNSTREAM_SOURCE_MISMATCH");
    return {compiled,sourceOwner};
  }

  async function reserveDownstream(input:Readonly<{authority:V3DownstreamEvidenceAuthorityV1;worktree:string;branch:string}>) {
    const authority=V3DownstreamEvidenceAuthorityV1Schema.parse(input.authority);
    const source=resolveV3GitRevision({repo:input.worktree,requestedRef:"HEAD"});
    const {compiled}=await authenticateDownstreamSource({runId:authority.runId,storyId:authority.storyId,
      worktree:input.worktree,branch:input.branch,source});
    if(compiled.packetHash!==authority.packetHash) throw Error("V3_NATIVE_DOWNSTREAM_PACKET_REQUIRED");
    const reservation=await createV3DownstreamEvidencePublication(options.sql).reserve(authority,{
      runId:authority.runId,stepId:authority.workflowStepId,storyId:authority.storyId,attemptClass:"evidence_only",
      packetHash:compiled.packetHash,compilationReportHash:compiled.compilationReportHash,sliceHash:compiled.sliceHash,
      sourceBefore:source,worktree:input.worktree,branch:input.branch,
      role:"downstream-evidence-orchestrator",agentId:"setfarm-downstream-evidence-orchestrator",
      evidenceRefs:[`setfarm://artifact/${compiled.packetHash}`,`setfarm://artifact/${compiled.compilationReportHash}`,
        `setfarm://artifact/${compiled.sliceHash}`,`setfarm://artifact/${compiled.evidencePlanArtifactHash}`],
    });
    return loadAttemptContext({runId:authority.runId,storyId:authority.storyId,attemptId:reservation.attempt.attemptId});
  }

  async function loadDownstreamContext(attempt:ExecutionAttemptV1):Promise<NativeImplementationContextV3>{
    const lineage=await readNativeDownstreamAttemptAuthority(options.sql,attempt);
    if(!attempt.worktree||!attempt.branch) throw Error("V3_NATIVE_DOWNSTREAM_SOURCE_MISMATCH");
    const {compiled}=await authenticateDownstreamSource({runId:attempt.runId,storyId:attempt.storyId,
      worktree:attempt.worktree,branch:attempt.branch,source:attempt.sourceBefore,sourceOwnerAttemptId:lineage.sourceOwner.attempt_id});
    if(attempt.sliceHash!==compiled.sliceHash||attempt.compilationReportHash!==compiled.compilationReportHash
      ||!attempt.evidenceRefs.includes(`setfarm://artifact/${compiled.evidencePlanArtifactHash}`))
      throw Error("V3_NATIVE_DOWNSTREAM_CONTRACT_MISMATCH");
    // Original model/recovery metadata remains authenticated provenance; its
    // execution grant must not become a grant for this distinct downstream child.
    const {evidenceOnly:_evidenceOnly,operationalRetry:_operationalRetry,recovery:_recovery,...semanticContext}=compiled;
    return {...semanticContext,attempt,sourceBefore:attempt.sourceBefore,downstreamEvidence:{
      parentClaimId:lineage.parentClaimId,sourceOwnerAttemptId:lineage.sourceOwner.attempt_id}};
  }

  async function compileContext(prepared: NativePreparedImplementationV3 | NativeRecoveryPreparedV3): Promise<NativeImplementationContextV3> {
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
    const input = LocatorSchema.parse(raw);
    const attempt = await attempts.findById(input.attemptId);
    if (!attempt || attempt.runId !== input.runId || attempt.storyId !== input.storyId) throw new Error("V3_NATIVE_PREPARED_ORIGIN_MISMATCH");
    const compiled = attempt.attemptClass === "infrastructure_retry" ? await loadOperationalContext(attempt)
      : attempt.attemptClass === "evidence_only" ? (attempt.role === "downstream-evidence-orchestrator"
        ? await loadDownstreamContext(attempt) : await loadEvidenceOnlyContext(attempt))
      : await compileContext(attempt.recoveryDispatchId ? await loadRecoveryPrepared(attempt) : await preparedService.loadPreparedAttempt(input));
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
    await publishContext(input, compiled);
    return loadAttemptContext({ runId: input.runId, storyId: input.storyId, attemptId: compiled.attempt.attemptId });
  }

  async function publishContext(input: Pick<NativeImplementationReservationV3,"runId"|"stepId"|"storyId"|"claimId"|"branch"|"worktree">,
    compiled: NativeImplementationContextV3): Promise<void> {
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
  }
  return Object.freeze({ reserve, reserveRecovery, reserveOperational, reserveEvidenceOnly, reserveDownstream, loadAttemptContext });
}
