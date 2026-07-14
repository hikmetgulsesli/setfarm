import type postgres from "postgres";
import { z } from "zod";

import { getSql } from "../db-pg.js";
import {
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import { createFindingSetFromEvidenceBundleV2 } from "../findings/evidence-finding-set.js";
import type { FindingSetV1 } from "../findings/finding-set.js";
import { runImplementEvidenceIfRequested } from "../installer/implement-evidence-runner.js";
import {
  loadV3ImplementationAttemptContext,
  reserveV3DownstreamEvidenceAttempt,
  V3ImplementationAttemptError,
  type V3ImplementationAttemptResult,
} from "../execution/v3-implementation-attempt.js";
import { captureShadowSourceRevision } from "../execution/shadow-attempt-recorder.js";
import {
  SourceRevisionV1Schema,
  type ExecutionAttemptV1,
  type SourceRevisionV1,
} from "../execution/schemas/execution-attempt-v1.js";
import { createRuntimeArtifactReader, type SealedRuntimePacketV1 } from "../product-compiler/runtime-artifact-reader.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { resolveProductArtifactCapacity, resolveProductArtifactDir } from "../runtime-config.js";
import { createFindingRecoveryRepository } from "./finding-recovery-repository.js";
import { RecoveryDispatchClassV1Schema } from "./recovery-case.js";
import { RecoveryDeliveryStateV1Schema } from "./recovery-delivery.js";
import { classifyV3EvidenceFailure } from "./v3-recovery-effect.js";
import {
  createV3RecoveryCoordinator,
  type V3RecoveryCoordinatorResult,
} from "./v3-recovery-coordinator.js";
import {
  createV3DownstreamEvidencePublication,
  V3DownstreamEvidenceAuthorityV1Schema,
  type V3DownstreamEvidenceAuthorityV1,
} from "./v3-downstream-evidence-publication.js";

type Sql = postgres.Sql;

const BoundedIdentitySchema = z.string().min(1).max(500);

const DownstreamEvidenceRunInputSchema = z.object({
  runId: BoundedIdentitySchema,
  stepDbId: BoundedIdentitySchema,
  workflowStepId: z.enum(["qa-test", "final-test"]),
  phase: z.enum(["qa", "final", "integration"]),
  parentClaimId: z.number().int().positive(),
  worktree: z.string().min(1).max(4_000),
  branch: z.string().min(1).max(1_000),
  intent: z.enum(["downstream_failure", "final_acceptance"]).default("downstream_failure"),
}).strict().superRefine((value, context) => {
  if (value.phase === "qa" && value.workflowStepId !== "qa-test") {
    context.addIssue({ code: "custom", path: ["workflowStepId"], message: "QA phase requires qa-test" });
  }
  if (["final", "integration"].includes(value.phase) && value.workflowStepId !== "final-test") {
    context.addIssue({ code: "custom", path: ["workflowStepId"], message: "Final/integration phase requires final-test" });
  }
  if (value.intent === "final_acceptance" && (value.workflowStepId !== "final-test" || value.phase !== "final")) {
    context.addIssue({ code: "custom", path: ["intent"], message: "only the final final-test boundary may seal an accepted candidate" });
  }
});

export type V3DownstreamEvidenceRunInput = z.infer<typeof DownstreamEvidenceRunInputSchema>;

type StoryIdentity = Readonly<{ storyDbId: string; storyId: string; status: string }>;

const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);

const V3RecoveryCoordinatorResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("verified"),
    evidenceBundleHash: Sha256Schema,
    attemptId: AttemptIdSchema,
  }).strict(),
  z.object({
    status: z.literal("dispatched"),
    recoveryCaseId: RecoveryCaseIdSchema,
    revisionId: RecoveryRevisionIdSchema,
    dispatchId: RecoveryDispatchIdSchema,
    dispatchClass: RecoveryDispatchClassV1Schema,
    modelDispatch: z.boolean(),
    deliveryState: RecoveryDeliveryStateV1Schema,
    evidenceBundleHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("resolved"),
    recoveryCaseId: RecoveryCaseIdSchema,
    revisionId: RecoveryRevisionIdSchema,
    evidenceBundleHash: Sha256Schema,
    attemptId: AttemptIdSchema,
  }).strict(),
  z.object({
    status: z.enum(["blocked", "superseded"]),
    recoveryCaseId: RecoveryCaseIdSchema,
    revisionId: RecoveryRevisionIdSchema,
    reasonCode: BoundedIdentitySchema,
    evidenceBundleHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("pending"),
    recoveryCaseId: RecoveryCaseIdSchema,
    revisionId: RecoveryRevisionIdSchema,
    reasonCode: BoundedIdentitySchema,
    evidenceBundleHash: Sha256Schema,
  }).strict(),
]);

export const V3DownstreamStoryEvidenceResultV1Schema = z.object({
  storyDbId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  attemptId: AttemptIdSchema,
  sliceHash: Sha256Schema,
  evidencePlanArtifactHash: Sha256Schema,
  evidenceBundleHash: Sha256Schema,
  aggregateVerdict: z.enum(["pass", "fail", "inconclusive"]),
  execution: z.enum(["executed", "replayed"]),
  coordinator: V3RecoveryCoordinatorResultSchema,
}).strict();

const RouteResultCoreSchema = z.object({
  schema: z.literal("setfarm.v3-downstream-evidence-route.v1"),
  runId: BoundedIdentitySchema,
  phase: z.enum(["qa", "final", "integration"]),
  packetHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  stories: z.array(V3DownstreamStoryEvidenceResultV1Schema).max(10_000),
});

export const V3DownstreamEvidenceRouteResultV1Schema = z.discriminatedUnion("status", [
  RouteResultCoreSchema.extend({
    status: z.literal("accepted_candidate_ready"),
  }).strict(),
  RouteResultCoreSchema.extend({
    status: z.literal("recovery_routed"),
    routedStoryIds: z.array(BoundedIdentitySchema).min(1).max(10_000),
  }).strict(),
  RouteResultCoreSchema.extend({
    status: z.literal("packet_amendment_required"),
    reasonCode: z.enum(["no_sealed_story_owns_downstream_delta", "sealed_story_evidence_unavailable"]),
    requiredArtifact: z.literal("setfarm.product-build-packet.v.next"),
    unavailableStoryId: BoundedIdentitySchema.optional(),
    compilerReasonCode: BoundedIdentitySchema.optional(),
  }).strict(),
  RouteResultCoreSchema.extend({
    status: z.literal("bounded_recovery_blocked"),
    blockedStoryIds: z.array(BoundedIdentitySchema).min(1).max(10_000),
  }).strict(),
]).superRefine((value, context) => {
  if (value.status !== "packet_amendment_required" && value.stories.length === 0) {
    context.addIssue({ code: "custom", path: ["stories"], message: "routed or blocked recovery requires story evidence" });
  }
  if (value.status === "accepted_candidate_ready" && value.phase !== "final") {
    context.addIssue({ code: "custom", path: ["phase"], message: "AcceptedCandidate requires the final evidence phase" });
  }
  if (
    value.status === "packet_amendment_required"
    && value.reasonCode === "sealed_story_evidence_unavailable"
    && (!value.unavailableStoryId || !value.compilerReasonCode)
  ) {
    context.addIssue({
      code: "custom",
      path: ["unavailableStoryId"],
      message: "compiler rejection must identify the exact unavailable story and reason",
    });
  }
  if (
    value.status === "packet_amendment_required"
    && value.reasonCode === "no_sealed_story_owns_downstream_delta"
    && (value.unavailableStoryId || value.compilerReasonCode)
  ) {
    context.addIssue({
      code: "custom",
      path: ["compilerReasonCode"],
      message: "passing story evidence cannot claim a compiler rejection",
    });
  }
});

export type V3DownstreamStoryEvidenceResult = z.infer<typeof V3DownstreamStoryEvidenceResultV1Schema>;
export type V3DownstreamEvidenceRouteResult = z.infer<typeof V3DownstreamEvidenceRouteResultV1Schema>;

export class V3DownstreamEvidenceRouterError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(`${code}:${message}`, options);
    this.name = "V3DownstreamEvidenceRouterError";
    this.code = code;
  }
}

function fail(code: string, message: string, cause?: unknown): never {
  throw new V3DownstreamEvidenceRouterError(code, message, cause === undefined ? undefined : { cause });
}

function sameRevision(left: SourceRevisionV1, right: SourceRevisionV1): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function bundleRefs(refs: readonly string[]): string[] {
  return refs
    .filter((ref) => ref.startsWith("setfarm://evidence-bundle/"))
    .map((ref) => ref.slice("setfarm://evidence-bundle/".length));
}

function findingRefs(refs: readonly string[]): string[] {
  return refs
    .filter((ref) => ref.startsWith("setfarm://finding-set/"))
    .map((ref) => ref.slice("setfarm://finding-set/".length));
}

function terminalAttempt(attempt: ExecutionAttemptV1): boolean {
  return !["claimed", "running", "superseded"].includes(attempt.disposition);
}

function evidenceDisposition(bundle: EvidenceBundleV2): "verified" | "no_progress" | "inconclusive" {
  if (bundle.aggregateVerdict === "pass") return "verified";
  if (bundle.aggregateVerdict === "fail") return "no_progress";
  if (bundle.aggregateVerdict === "inconclusive") return "inconclusive";
  fail("V3_DOWNSTREAM_EVIDENCE_INCOMPLETE", "incomplete evidence cannot be published or retried");
}

const PACKET_AMENDMENT_COMPILER_REJECTIONS = new Set([
  "V3_RUNTIME_EVIDENCE_CONTRACT_REJECTED",
  "V3_RUNTIME_EVIDENCE_STACK_UNSUPPORTED",
  "V3_SLICE_SHARED_GRANT_MISSING",
  "V3_SLICE_PATH_BINDING_MISSING",
  "V3_SLICE_COMPILATION_REJECTED",
]);

function isPacketAmendmentCompilerRejection(error: unknown): error is V3ImplementationAttemptError {
  return error instanceof V3ImplementationAttemptError
    && PACKET_AMENDMENT_COMPILER_REJECTIONS.has(error.code);
}

function terminalVerdict(bundle: EvidenceBundleV2): "pass" | "fail" | "inconclusive" {
  if (bundle.aggregateVerdict === "incomplete") {
    fail("V3_DOWNSTREAM_EVIDENCE_INCOMPLETE", "terminal downstream evidence cannot remain incomplete");
  }
  return bundle.aggregateVerdict;
}

export type V3DownstreamEvidenceRouterDependencies = Readonly<{
  readPacket(runId: string): Promise<SealedRuntimePacketV1>;
  readStories(input: Readonly<{ runId: string; storyIds: readonly string[] }>): Promise<readonly StoryIdentity[]>;
  reserveAttempt(input: Readonly<{
    authority: V3DownstreamEvidenceAuthorityV1;
    worktree: string;
    branch: string;
  }>): Promise<V3ImplementationAttemptResult>;
  loadAttemptContext(input: Readonly<{
    runId: string;
    storyId: string;
    attemptId: string;
  }>): Promise<V3ImplementationAttemptResult>;
  markRunning(input: Readonly<{
    authority: V3DownstreamEvidenceAuthorityV1;
    attempt: ExecutionAttemptV1;
  }>): Promise<ExecutionAttemptV1>;
  complete(input: Readonly<{
    authority: V3DownstreamEvidenceAuthorityV1;
    attempt: ExecutionAttemptV1;
    disposition: "verified" | "no_progress" | "inconclusive";
    bundle: EvidenceBundleV2;
    findingSet?: FindingSetV1;
  }>): Promise<ExecutionAttemptV1>;
  executeEvidence(input: Readonly<{
    packet: SealedRuntimePacketV1;
    context: V3ImplementationAttemptResult;
    worktree: string;
  }>): Promise<EvidenceBundleV2>;
  captureSource(worktree: string): Promise<SourceRevisionV1>;
  findEvidenceBundle(hash: string): Promise<EvidenceBundleV2 | undefined>;
  findFindingSet(hash: string): Promise<FindingSetV1 | undefined>;
  coordinate(input: unknown): Promise<V3RecoveryCoordinatorResult>;
}>;

type StagedStoryEvidence = Readonly<{
  row: StoryIdentity;
  authority: V3DownstreamEvidenceAuthorityV1;
  context: V3ImplementationAttemptResult;
  attempt: ExecutionAttemptV1;
  bundle: EvidenceBundleV2;
  findingSet?: FindingSetV1;
  execution: "executed" | "replayed";
}>;

async function loadReplayEvidence(
  attempt: ExecutionAttemptV1,
  dependencies: V3DownstreamEvidenceRouterDependencies,
): Promise<Readonly<{ bundle: EvidenceBundleV2; findingSet?: FindingSetV1 }>> {
  const bundles = bundleRefs(attempt.evidenceRefs);
  const findings = findingRefs(attempt.evidenceRefs);
  if (bundles.length !== 1 || findings.length > 1) {
    fail("V3_DOWNSTREAM_EVIDENCE_REPLAY_REFS_INVALID", "terminal attempt does not name one exact result");
  }
  const bundle = await dependencies.findEvidenceBundle(bundles[0]!);
  if (!bundle || computeEvidenceBundleHash(bundle) !== bundles[0]) {
    fail("V3_DOWNSTREAM_EVIDENCE_REPLAY_BUNDLE_MISSING", "terminal evidence bundle is absent or corrupt");
  }
  const findingSet = findings[0] ? await dependencies.findFindingSet(findings[0]) : undefined;
  if ((bundle.aggregateVerdict === "pass") !== !findingSet) {
    fail("V3_DOWNSTREAM_EVIDENCE_REPLAY_FINDING_MISMATCH", "terminal evidence and finding references disagree");
  }
  return { bundle, ...(findingSet ? { findingSet } : {}) };
}

async function coordinateInitial(input: Readonly<{
  context: V3ImplementationAttemptResult;
  bundle: EvidenceBundleV2;
  findingSet?: FindingSetV1;
  authority: V3DownstreamEvidenceAuthorityV1;
  dependencies: V3DownstreamEvidenceRouterDependencies;
}>): Promise<V3RecoveryCoordinatorResult> {
  const failureClass = classifyV3EvidenceFailure(input.bundle);
  return input.dependencies.coordinate({
    kind: "initial_evidence",
    slice: input.context.slice,
    sliceHash: input.context.sliceHash,
    evidencePlan: input.context.evidencePlan,
    evidencePlanArtifactHash: input.context.evidencePlanArtifactHash,
    evidenceBundle: input.bundle,
    ...(input.findingSet ? { findingSet: input.findingSet } : {}),
    ...(failureClass ? { failureClass } : {}),
    downstreamAuthority: input.authority,
  });
}

export function createV3DownstreamEvidenceRouter(
  dependencies: V3DownstreamEvidenceRouterDependencies,
) {
  return Object.freeze({
    async route(rawInput: unknown): Promise<V3DownstreamEvidenceRouteResult> {
      const input = DownstreamEvidenceRunInputSchema.parse(rawInput);
      const packet = await dependencies.readPacket(input.runId);
      const storyIds = packet.storyPlan.stories.map((story) => story.id);
      if (storyIds.length === 0 || new Set(storyIds).size !== storyIds.length) {
        fail("V3_DOWNSTREAM_EVIDENCE_STORY_PLAN_INVALID", "sealed StoryPlan must contain unique stories");
      }
      const rows = await dependencies.readStories({ runId: input.runId, storyIds });
      const rowByStory = new Map(rows.map((row) => [row.storyId, row]));
      if (
        rows.length !== storyIds.length
        || storyIds.some((storyId) => !rowByStory.has(storyId))
        || rows.some((row) => !storyIds.includes(row.storyId))
      ) {
        fail("V3_DOWNSTREAM_EVIDENCE_STORY_PROJECTION_MISMATCH", "DB stories are not the exact sealed StoryPlan projection");
      }
      const invalidStoryStatus = rows.find((row) => !["done", "verified"].includes(row.status));
      if (invalidStoryStatus) {
        fail(
          "V3_DOWNSTREAM_EVIDENCE_STORY_STATUS_INVALID",
          `${invalidStoryStatus.storyId} cannot enter downstream evidence from ${invalidStoryStatus.status}`,
        );
      }

      const finalSource = await dependencies.captureSource(input.worktree);
      const stagedStories: StagedStoryEvidence[] = [];
      const stories: V3DownstreamStoryEvidenceResult[] = [];
      for (const storyId of storyIds) {
        const row = rowByStory.get(storyId)!;
        const authority = V3DownstreamEvidenceAuthorityV1Schema.parse({
          schema: "setfarm.v3-downstream-evidence-authority.v1",
          runId: input.runId,
          stepDbId: input.stepDbId,
          workflowStepId: input.workflowStepId,
          phase: input.phase,
          parentClaimId: input.parentClaimId,
          storyDbId: row.storyDbId,
          storyId,
          packetHash: packet.packetHash,
        });
        let context: V3ImplementationAttemptResult;
        try {
          context = await dependencies.reserveAttempt({
            authority,
            worktree: input.worktree,
            branch: input.branch,
          });
        } catch (error) {
          if (!isPacketAmendmentCompilerRejection(error)) throw error;
          return V3DownstreamEvidenceRouteResultV1Schema.parse({
            schema: "setfarm.v3-downstream-evidence-route.v1",
            status: "packet_amendment_required",
            runId: input.runId,
            phase: input.phase,
            packetHash: packet.packetHash,
            sourceRevision: finalSource,
            stories: [],
            reasonCode: "sealed_story_evidence_unavailable",
            requiredArtifact: "setfarm.product-build-packet.v.next",
            unavailableStoryId: storyId,
            compilerReasonCode: error.code,
          });
        }
        if (!sameRevision(context.sourceBefore, finalSource)) {
          fail("V3_DOWNSTREAM_EVIDENCE_FINAL_SOURCE_MISMATCH", `${storyId} slice is not bound to the integrated source`);
        }

        let bundle: EvidenceBundleV2;
        let findingSet: FindingSetV1 | undefined;
        let attempt = context.attempt;
        let execution: "executed" | "replayed";
        if (terminalAttempt(attempt)) {
          const replay = await loadReplayEvidence(attempt, dependencies);
          bundle = replay.bundle;
          findingSet = replay.findingSet;
          execution = "replayed";
        } else {
          attempt = await dependencies.markRunning({ authority, attempt });
          bundle = await dependencies.executeEvidence({ packet, context, worktree: input.worktree });
          const sourceAfter = await dependencies.captureSource(input.worktree);
          if (!sameRevision(sourceAfter, finalSource)) {
            fail("V3_DOWNSTREAM_EVIDENCE_SOURCE_MUTATED", "downstream evidence execution changed integrated product source");
          }
          findingSet = createFindingSetFromEvidenceBundleV2({
            workdir: input.worktree,
            slice: context.slice,
            sliceHash: context.sliceHash,
            bundle,
          });
          if ((bundle.aggregateVerdict === "pass") !== !findingSet) {
            fail("V3_DOWNSTREAM_EVIDENCE_FINDING_SET_MISMATCH", "typed findings do not exactly cover non-passing predicates");
          }
          attempt = await dependencies.complete({
            authority,
            attempt,
            disposition: evidenceDisposition(bundle),
            bundle,
            ...(findingSet ? { findingSet } : {}),
          });
          execution = "executed";
        }
        context = await dependencies.loadAttemptContext({
          runId: input.runId,
          storyId,
          attemptId: attempt.attemptId,
        });
        if (bundle.aggregateVerdict === "incomplete") {
          fail("V3_DOWNSTREAM_EVIDENCE_INCOMPLETE", "terminal downstream evidence cannot remain incomplete");
        }
        stagedStories.push({
          row,
          authority,
          context,
          attempt,
          bundle,
          ...(findingSet ? { findingSet } : {}),
          execution,
        });
      }

      const postEvidenceSource = await dependencies.captureSource(input.worktree);
      if (!sameRevision(postEvidenceSource, finalSource)) {
        fail("V3_DOWNSTREAM_EVIDENCE_FINAL_SOURCE_DRIFT", "integrated source changed across the story evidence matrix");
      }

      // No recovery case or dispatch may exist until the complete sealed-story
      // matrix has been measured at one unchanged source. A later compiler
      // rejection must therefore yield only an explicit packet amendment,
      // never a partially exposed implementation owner.
      for (const staged of stagedStories) {
        const coordinated = await coordinateInitial({
          context: staged.context,
          bundle: staged.bundle,
          ...(staged.findingSet ? { findingSet: staged.findingSet } : {}),
          authority: staged.authority,
          dependencies,
        });
        stories.push({
          storyDbId: staged.row.storyDbId,
          storyId: staged.row.storyId,
          attemptId: staged.attempt.attemptId,
          sliceHash: staged.context.sliceHash,
          evidencePlanArtifactHash: staged.context.evidencePlanArtifactHash,
          evidenceBundleHash: computeEvidenceBundleHash(staged.bundle),
          aggregateVerdict: terminalVerdict(staged.bundle),
          execution: staged.execution,
          coordinator: coordinated,
        });
      }
      const routedStoryIds = stories
        .filter((story) => story.coordinator.status === "dispatched")
        .map((story) => story.storyId);
      if (routedStoryIds.length > 0) {
        return V3DownstreamEvidenceRouteResultV1Schema.parse({
          schema: "setfarm.v3-downstream-evidence-route.v1",
          status: "recovery_routed",
          runId: input.runId,
          phase: input.phase,
          packetHash: packet.packetHash,
          sourceRevision: finalSource,
          stories,
          routedStoryIds,
        });
      }
      const blockedStoryIds = stories
        .filter((story) => ["blocked", "superseded", "pending"].includes(story.coordinator.status))
        .map((story) => story.storyId);
      if (blockedStoryIds.length > 0) {
        return V3DownstreamEvidenceRouteResultV1Schema.parse({
          schema: "setfarm.v3-downstream-evidence-route.v1",
          status: "bounded_recovery_blocked",
          runId: input.runId,
          phase: input.phase,
          packetHash: packet.packetHash,
          sourceRevision: finalSource,
          stories,
          blockedStoryIds,
        });
      }
      if (input.intent === "final_acceptance") {
        if (stories.some((story) => story.aggregateVerdict !== "pass" || story.coordinator.status !== "verified")) {
          fail("V3_DOWNSTREAM_ACCEPTANCE_MATRIX_INVALID", "final acceptance requires one verified pass for every sealed story");
        }
        return V3DownstreamEvidenceRouteResultV1Schema.parse({
          schema: "setfarm.v3-downstream-evidence-route.v1",
          status: "accepted_candidate_ready",
          runId: input.runId,
          phase: input.phase,
          packetHash: packet.packetHash,
          sourceRevision: finalSource,
          stories,
        });
      }
      // The downstream trigger still failed, but every compiler-owned story
      // predicate passed at the exact final tree. No story owns this delta.
      // The only sound next action is a new versioned packet with an explicit
      // cross-story integration contract; prose must never expand ownership.
      return V3DownstreamEvidenceRouteResultV1Schema.parse({
        schema: "setfarm.v3-downstream-evidence-route.v1",
        status: "packet_amendment_required",
        runId: input.runId,
        phase: input.phase,
        packetHash: packet.packetHash,
        sourceRevision: finalSource,
        stories,
        reasonCode: "no_sealed_story_owns_downstream_delta",
        requiredArtifact: "setfarm.product-build-packet.v.next",
      });
    },
  });
}

async function readExactStories(
  sql: Sql,
  input: Readonly<{ runId: string; storyIds: readonly string[] }>,
): Promise<readonly StoryIdentity[]> {
  const rows = await sql.unsafe<Array<{ id: string; story_id: string; status: string }>>(
    `SELECT id, story_id, status
       FROM stories
      WHERE run_id = $1
        AND story_id = ANY($2::text[])
        AND story_id NOT LIKE 'QA-FIX-%'
        AND status IN ('done', 'verified', 'skipped', 'failed')
      ORDER BY story_index, story_id`,
    [input.runId, input.storyIds],
  );
  return rows.map((row) => ({ storyDbId: row.id, storyId: row.story_id, status: row.status }));
}

export function createPostgresV3DownstreamEvidenceRouter(sql: Sql = getSql()) {
  const reader = createRuntimeArtifactReader({
    sql,
    artifactRoot: resolveProductArtifactDir(),
    artifactLimits: resolveProductArtifactCapacity(),
  });
  const publication = createV3DownstreamEvidencePublication(sql);
  const findings = createFindingRecoveryRepository(sql);
  const coordinator = createV3RecoveryCoordinator(sql);
  return createV3DownstreamEvidenceRouter({
    readPacket: (runId) => reader.readSealedPacket(runId),
    readStories: (input) => readExactStories(sql, input),
    reserveAttempt: (input) => reserveV3DownstreamEvidenceAttempt(input),
    loadAttemptContext: (input) => loadV3ImplementationAttemptContext(input),
    markRunning: (input) => publication.markRunning(input),
    complete: (input) => publication.complete(input),
    executeEvidence: async ({ packet, context, worktree }) => {
      const result = await runImplementEvidenceIfRequested({
        runId: context.attempt.runId,
        storyId: context.attempt.storyId,
        workdir: worktree,
        stackPackId: packet.buildTopology.stackPack.id,
        v3: {
          slice: context.slice,
          sliceHash: context.sliceHash,
          attemptId: context.attempt.attemptId,
          sourceRevision: context.sourceBefore,
        },
      });
      if (!result.canonicalEvidence) {
        fail("V3_DOWNSTREAM_EVIDENCE_BUNDLE_REQUIRED", "stack adapter did not return canonical story evidence");
      }
      return result.canonicalEvidence.bundle;
    },
    captureSource: (worktree) => captureShadowSourceRevision(worktree),
    findEvidenceBundle: (hash) => findings.findEvidenceBundle(hash),
    findFindingSet: (hash) => findings.findFindingSet(hash),
    coordinate: (input) => coordinator.coordinate(input),
  });
}
