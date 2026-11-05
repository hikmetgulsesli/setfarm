import { z } from "zod";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { SemanticArtifactProducerV1Schema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { LegacyImplementationSliceV2Schema } from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import { ProductBuildPacketV3Schema } from "../product-compiler/schemas/product-build-packet-v3.js";
import { ProductCompilationReportV3Schema } from "../product-compiler/schemas/compilation-report-v3.js";
import { EvidencePlanV2Schema, compileEvidencePlanV2 } from "../evidence/evidence-plan-v2.js";
import { FindingSetV1Schema } from "../findings/finding-set.js";
import { GithubReviewThreadEvidenceV1Schema } from "../findings/github-review-source.js";
import { ExecutionAttemptV1Schema, SourceRevisionV1Schema } from "./schemas/execution-attempt-v1.js";
import { V3PreparationClaimAuthorityV2Schema } from "./v3-preparation-runtime-authority-v1.js";
import { ModelExecutionProfileV1Schema, OperationalRetryDirectiveV1Schema, resolveV3ExecutionProfile } from "./operational-retry-directive.js";
import { V3SupervisorRetryDirectiveV1Schema } from "./v3-supervisor-retry-directive.js";
import { createV3ArtifactRefKeyV2 } from "./v3-artifact-ref-key-v2.js";

const Identity = z.string().min(1).max(500);
const Producer = SemanticArtifactProducerV1Schema;
const PacketEnvelope = z.object({ schema: z.literal("setfarm.semantic-artifact-envelope.v1"), artifactType: z.literal("setfarm.product-build-packet.v3"), producer: Producer, payload: ProductBuildPacketV3Schema }).strict();
const ReportEnvelope = z.object({ schema: z.literal("setfarm.semantic-artifact-envelope.v1"), artifactType: z.literal("setfarm.product-compilation-report.v3"), producer: Producer, payload: ProductCompilationReportV3Schema }).strict();
// Zod forbids pick() on a refined object. Reuse each exact field validator;
// native handoff refinement below supplies the separate descriptor's tuple join.
const RecoveryAttempt = z.object({
  attemptId: ExecutionAttemptV1Schema.shape.attemptId,
  claimId: ExecutionAttemptV1Schema.shape.claimId,
  runId: ExecutionAttemptV1Schema.shape.runId,
  stepId: ExecutionAttemptV1Schema.shape.stepId,
  storyId: ExecutionAttemptV1Schema.shape.storyId,
  generation: ExecutionAttemptV1Schema.shape.generation,
  attemptClass: ExecutionAttemptV1Schema.shape.attemptClass,
  role: ExecutionAttemptV1Schema.shape.role,
  packetHash: ExecutionAttemptV1Schema.shape.packetHash,
  compilationReportHash: ExecutionAttemptV1Schema.shape.compilationReportHash,
  sliceHash: ExecutionAttemptV1Schema.shape.sliceHash,
  sourceBefore: ExecutionAttemptV1Schema.shape.sourceBefore,
  findingSetHash: ExecutionAttemptV1Schema.shape.findingSetHash,
  recoveryCaseRevisionId: ExecutionAttemptV1Schema.shape.recoveryCaseRevisionId,
  recoveryDispatchId: ExecutionAttemptV1Schema.shape.recoveryDispatchId,
}).strict();
const same = (left: unknown, right: unknown) => canonicalJsonStringify(left) === canonicalJsonStringify(right);
const artifactHash = (artifactType: string, producer: z.infer<typeof Producer>, payload: unknown) => hashCanonicalJson({ schema: "setfarm.semantic-artifact-envelope.v1", artifactType, producer, payload });

export const V3ImplementationClaimHandoffV2Schema = z.object({
  schema: z.literal("setfarm.v3-implementation-claim-handoff.v2"), protocol: z.literal("v3"),
  runId: Identity, stepId: Identity, workflowStepId: z.literal("implement").default("implement"), storyId: Identity, storyDbId: Identity,
  claimId: z.number().int().positive(), attemptId: ExecutionAttemptV1Schema.shape.attemptId, attemptGeneration: z.number().int().positive(),
  branch: z.string().min(1).max(1_000), workdir: z.string().min(1).max(4_000).refine(value => value.startsWith("/")),
  packetHash: Sha256Schema, compilationReportHash: Sha256Schema, sliceHash: Sha256Schema, sliceRef: z.string().min(1).max(160),
  evidencePlanHash: Sha256Schema, evidencePlanArtifactHash: Sha256Schema, evidencePlanRef: z.string().min(1).max(160),
  executionAuthority: z.object({ role: z.enum(["developer", "supervisor"]), attemptClass: z.enum(["product_implementation", "infrastructure_retry", "supervisor_repair"]) }).strict(),
  executionProfile: ModelExecutionProfileV1Schema.default(() => resolveV3ExecutionProfile("primary")),
  sourceBefore: SourceRevisionV1Schema, artifactProducer: Producer,
  packetEnvelope: PacketEnvelope, compilationReportEnvelope: ReportEnvelope, nativeAuthority: V3PreparationClaimAuthorityV2Schema,
  implementationSlice: LegacyImplementationSliceV2Schema, evidencePlan: EvidencePlanV2Schema,
  operationalRetry: OperationalRetryDirectiveV1Schema.optional(), operationalRetryArtifactHash: Sha256Schema.optional(),
  supervisorRetry: V3SupervisorRetryDirectiveV1Schema.optional(), supervisorRetryArtifactHash: Sha256Schema.optional(),
  recoveryAttempt: RecoveryAttempt.optional(), findingSet: FindingSetV1Schema.optional(),
  reviewEvidenceArtifacts: z.array(z.object({ artifactHash: Sha256Schema, evidence: GithubReviewThreadEvidenceV1Schema }).strict()).max(100).default([]),
}).strict().superRefine((value, context) => {
  const fail = (field: string, message: string) => context.addIssue({ code: "custom", path: [field], message });
  const slice = value.implementationSlice, plan = value.evidencePlan, origin = value.nativeAuthority;
  const packet = value.packetEnvelope.payload, report = value.compilationReportEnvelope.payload;
  if (!same(value.artifactProducer, value.packetEnvelope.producer) || !same(value.artifactProducer, value.compilationReportEnvelope.producer)
    || !same(value.artifactProducer, slice.producer) || !same(packet, slice.packet)
    || hashCanonicalJson(value.packetEnvelope) !== value.packetHash || hashCanonicalJson(value.compilationReportEnvelope) !== value.compilationReportHash
    || report.status !== "sealed" || report.packetHash !== value.packetHash || !same(report.compiler, packet.compiler)
    || !same(report.validationIds, packet.validationIds)
    || report.artifactHashes.productSpecV2 !== packet.productSpecV2Hash || report.artifactHashes.designGraphV2 !== packet.designGraphV2Hash
    || report.artifactHashes.buildTopologyV1 !== packet.buildTopologyV1Hash || report.artifactHashes.storyPlanV2 !== packet.storyPlanV2Hash
    || report.artifactHashes.designSourceClosureV2 !== packet.designSourceClosureV2Hash || report.artifactHashes.implementationSourceMapV1 !== packet.implementationSourceMapV1Hash) {
    fail("packetEnvelope", "Native packet/report envelopes and producer must bind the exact compiled children");
  }
  if (artifactHash("setfarm.implementation-slice.v2", value.artifactProducer, slice) !== value.sliceHash
    || value.sliceRef !== createV3ArtifactRefKeyV2("slice", value.storyId, value.sliceHash)
    || slice.packetHash !== value.packetHash || slice.storyId !== value.storyId || !same(slice.sourceRevision, value.sourceBefore)) {
    fail("implementationSlice", "Native slice envelope/ref/story/source identity differs from the handoff");
  }
  if (origin.runId !== value.runId || origin.stepId !== value.workflowStepId || origin.storyId !== value.storyId
    || origin.packetHash !== value.packetHash || origin.compilationReportHash !== value.compilationReportHash
    || !same(origin.dependencyAttempts.map(({ attemptId: _id, attemptGeneration: _generation, attemptClass: _class, disposition: _disposition, ...dependency }) => dependency), slice.dependencyOutputs)) {
    fail("nativeAuthority", "Native origin must bind exact run/story/packet/report/dependency witnesses");
  }
  try {
    if (!same(compileEvidencePlanV2({ slice, sliceHash: value.sliceHash }), plan)) fail("evidencePlan", "Native plan must reproduce from the genuine native slice");
  } catch { fail("evidencePlan", "Native plan cannot reproduce from the genuine native slice"); }
  if (plan.planHash !== value.evidencePlanHash || plan.packetHash !== value.packetHash || plan.sliceHash !== value.sliceHash || plan.storyId !== value.storyId
    || artifactHash("setfarm.evidence-plan.v2", value.artifactProducer, plan) !== value.evidencePlanArtifactHash
    || value.evidencePlanRef !== createV3ArtifactRefKeyV2("evidence_plan", value.storyId, value.evidencePlanArtifactHash)) {
    fail("evidencePlan", "Native plan envelope/ref identity differs from the handoff");
  }
  const recovery = slice.recovery, retry = value.operationalRetry, supervisor = value.supervisorRetry;
  if (Number(Boolean(recovery)) + Number(Boolean(retry)) + Number(Boolean(supervisor)) > 1) fail("operationalRetry", "Native recovery and retry authorities are mutually exclusive");
  for (const [directive, hash, type, field] of [
    [retry, value.operationalRetryArtifactHash, "setfarm.operational-retry-directive.v1", "operationalRetry"],
    [supervisor, value.supervisorRetryArtifactHash, "setfarm.v3-supervisor-retry-directive.v1", "supervisorRetry"],
  ] as const) {
    if (Boolean(directive) !== Boolean(hash) || (directive && artifactHash(type, value.artifactProducer, directive) !== hash)) fail(field, "Native retry must bind its exact immutable semantic envelope");
  }
  if (!recovery && !same(origin.baseRevision, value.sourceBefore)) fail("sourceBefore", "Initial native execution must retain its authenticated origin base");
  if (recovery) {
    const attempt = value.recoveryAttempt;
    if (!attempt || attempt.attemptId !== value.attemptId || attempt.generation !== value.attemptGeneration || attempt.claimId !== value.claimId
      || attempt.runId !== value.runId || attempt.stepId !== value.workflowStepId || attempt.storyId !== value.storyId
      || attempt.packetHash !== value.packetHash || attempt.compilationReportHash !== value.compilationReportHash || attempt.sliceHash !== value.sliceHash
      || !same(attempt.sourceBefore, value.sourceBefore) || attempt.findingSetHash !== recovery.findingSet.findingSetHash
      || !attempt.recoveryCaseRevisionId || !attempt.recoveryDispatchId || attempt.role !== value.executionAuthority.role
      || attempt.attemptClass !== value.executionAuthority.attemptClass
      || (attempt.attemptClass !== "product_implementation" && attempt.attemptClass !== "supervisor_repair")
      || (attempt.attemptClass === "supervisor_repair" ? attempt.role !== "supervisor" : attempt.role !== "developer")) {
      fail("recoveryAttempt", "Native recovery requires its exact separate execution and finding authority");
    }
    if (value.findingSet && !same(value.findingSet, recovery.findingSet)) fail("findingSet", "Native recovery finding set differs from the sealed recovery slice");
  } else if (value.recoveryAttempt || value.findingSet || value.reviewEvidenceArtifacts.length) {
    fail("recoveryAttempt", "Native recovery material requires an authenticated native recovery slice");
  }
  const expectedRole = recovery ? value.recoveryAttempt?.role : "developer";
  const expectedClass = recovery ? value.recoveryAttempt?.attemptClass : retry ? "infrastructure_retry" : "product_implementation";
  if (value.executionAuthority.role !== expectedRole || value.executionAuthority.attemptClass !== expectedClass
    || !same(value.executionProfile, retry?.executionProfile ?? resolveV3ExecutionProfile("primary"))) fail("executionAuthority", "Native execution role/class/profile must derive from its exact authority");
  if (retry && (retry.runId !== value.runId || retry.stepId !== value.workflowStepId || retry.storyId !== value.storyId
    || retry.priorAttempt.packetHash !== value.packetHash || retry.priorAttempt.sliceHash !== value.sliceHash
    || retry.priorAttempt.attemptId === value.attemptId || retry.priorAttempt.claimId === value.claimId || retry.priorAttempt.generation >= value.attemptGeneration
    || !same(retry.nextSourceRevision, value.sourceBefore) || !same(retry.expectedDelta.allowedPaths, nativeImplementationWritePaths(value)))) {
    fail("operationalRetry", "Native operational retry differs from exact predecessor/source/write authority");
  }
  if (supervisor && (supervisor.runId !== value.runId || supervisor.storyDbId !== value.storyDbId || supervisor.storyId !== value.storyId
    || supervisor.supervisorClaimId === value.claimId || !same(supervisor.sourceRevision, value.sourceBefore))) fail("supervisorRetry", "Native supervisor retry differs from its exact prior supervision");
  if (nativeImplementationWritePaths(value).some(path => path.split("/").some(part => part === ".git" || part === ".setfarm"))) fail("implementationSlice", "Native source authority cannot include protected repository controls");
  if (recovery) {
    const reviewFindings = recovery.findingSet.findings.filter(finding => finding.classification === "unstructured_review");
    const artifacts = value.reviewEvidenceArtifacts;
    const hashes = artifacts.map(artifact => artifact.artifactHash);
    const refs = reviewFindings.flatMap(finding => finding.observedEvidenceRefs);
    if (reviewFindings.length && (value.executionAuthority.role !== "supervisor"
      || value.executionAuthority.attemptClass !== "supervisor_repair")) {
      fail("executionAuthority", "Native unstructured review requires supervisor repair authority");
    }
    if (artifacts.length !== reviewFindings.length || new Set(hashes).size !== hashes.length
      || reviewFindings.some(finding => finding.observedEvidenceRefs.length !== 1)
      || new Set(refs).size !== refs.length) {
      fail("reviewEvidenceArtifacts", "Native review findings and immutable artifacts must be a bijection");
    }
    const byHash = new Map(artifacts.map(artifact => [artifact.artifactHash, artifact]));
    for (const artifact of artifacts) {
      if (artifactHash("setfarm.github-review-thread-evidence.v1", value.artifactProducer, artifact.evidence) !== artifact.artifactHash) {
        fail("reviewEvidenceArtifacts", "Native review artifact envelope hash differs");
      }
    }
    for (const finding of reviewFindings) {
      const artifact = byHash.get(finding.observedEvidenceRefs[0]!);
      const external = finding.externalRef;
      const locator = finding.sourceLocators[0];
      if (!artifact || !external || finding.sourceLocators.length !== 1 || !locator) {
        fail("reviewEvidenceArtifacts", "Native review finding must own one exact artifact and locator");
        continue;
      }
      const evidence = artifact.evidence;
      if (evidence.repository.nodeId !== external.repositoryNodeId
        || evidence.prNumber !== external.prNumber || evidence.threadId !== external.threadId
        || evidence.headSha !== external.headSha || evidence.headSha !== value.sourceBefore.sha
        || evidence.bodyRevisionHash !== external.commentRevisionHash
        || (external.commentId !== undefined && !evidence.comments.some(comment => comment.commentId === external.commentId))
        || evidence.path !== locator.path || evidence.currentSource.contentHash !== locator.contentHash) {
        fail("reviewEvidenceArtifacts", "Native review evidence differs from exact current finding identity");
      }
    }
  }
});

export type V3ImplementationClaimHandoffV2 = z.infer<typeof V3ImplementationClaimHandoffV2Schema>;

export function nativeImplementationWritePaths(handoff: Pick<V3ImplementationClaimHandoffV2, "implementationSlice">): string[] {
  const slice = handoff.implementationSlice;
  return [...new Set(slice.recovery ? slice.recovery.expectedSourceDelta.changes.map(change => change.path)
    : slice.files.filter(file => file.role === "owned" || file.role === "shared_writable").map(file => file.path))].sort();
}

export function createV3ImplementationClaimHandoffV2(input: unknown): V3ImplementationClaimHandoffV2 {
  return V3ImplementationClaimHandoffV2Schema.parse(input);
}
