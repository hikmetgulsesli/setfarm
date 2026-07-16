import type postgres from "postgres";

import type {
  ExactSealedRuntimePacket,
  SealedRuntimePacket,
  SealedRuntimePacketV3,
} from "../product-compiler/runtime-artifact-reader.js";
import { ProductBuildPacketV1Schema } from "../product-compiler/schemas/product-build-packet-v1.js";
import { ProductBuildPacketV2Schema } from "../product-compiler/schemas/product-build-packet-v2.js";
import { ProductBuildPacketV3Schema } from "../product-compiler/schemas/product-build-packet-v3.js";
import { ProductCompilationReportV1Schema } from "../product-compiler/schemas/compilation-report-v1.js";
import { ProductCompilationReportV2Schema } from "../product-compiler/schemas/compilation-report-v2.js";
import { ProductCompilationReportV3Schema } from "../product-compiler/schemas/compilation-report-v3.js";
import { StoryIdSchema } from "../product-compiler/schemas/common-v1.js";
import { StoryPlanV1Schema, type StoryPlanV1 } from "../product-compiler/schemas/story-plan-v1.js";
import { StoryPlanV2Schema, type StoryPlanV2 } from "../product-compiler/schemas/story-plan-v2.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import type { createV3PreparationBlockRepository } from "./v3-preparation-block-repository.js";
import {
  V3PreparationClaimAuthorityV1Schema,
  type V3PreparationClaimAuthorityV1,
} from "./v3-preparation-claim-authority.js";
import {
  decideV3PreparationFailure,
  type V3PreparationBlockV1,
  type V3PreparationDecisionV1,
  type V3PreparationDependencyStateV1,
} from "./v3-preparation-decision.js";
import {
  createV3PreparationEligibilityEvaluator,
} from "./v3-preparation-eligibility.js";
import { resolveV3GitRevision } from "./v3-git-revision.js";

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_PENDING_STORIES = 5_000;

export type V3NormalImplementationPreclaimErrorCode =
  | "V3_NORMAL_PRECLAIM_INPUT_INVALID"
  | "V3_NORMAL_PRECLAIM_PACKET_UNAVAILABLE"
  | "V3_NORMAL_PRECLAIM_PACKET_INVALID"
  | "V3_NORMAL_PRECLAIM_STORY_SELECTION_FAILED"
  | "V3_NORMAL_PRECLAIM_STORY_PROJECTION_INVALID"
  | "V3_NORMAL_PRECLAIM_STORY_NOT_IN_PACKET"
  | "V3_NORMAL_PRECLAIM_STORY_ORDER_MISMATCH"
  | "V3_NORMAL_PRECLAIM_DEPENDENCY_PROJECTION_INVALID"
  | "V3_NORMAL_PRECLAIM_DEPENDENCY_PACKET_MISMATCH"
  | "V3_NORMAL_PRECLAIM_SOURCE_SYNC_FAILED"
  | "V3_NORMAL_PRECLAIM_SOURCE_UNAVAILABLE"
  | "V3_NORMAL_PRECLAIM_ELIGIBILITY_FAILED"
  | "V3_NORMAL_PRECLAIM_BLOCK_LEDGER_FAILED"
  | "V3_NORMAL_PRECLAIM_BLOCK_LEDGER_INCONSISTENT"
  | "V3_NORMAL_PRECLAIM_AUTHORITY_FAILED"
  | "V3_NORMAL_PRECLAIM_AUTHORITY_INVALID";

export class V3NormalImplementationPreclaimError extends Error {
  readonly code: V3NormalImplementationPreclaimErrorCode;
  readonly causeCode?: string;
  readonly hardPreClaim = true;
  readonly evidence: Readonly<Record<string, string | null>>;

  constructor(
    code: V3NormalImplementationPreclaimErrorCode,
    message: string,
    options: Readonly<{
      causeCode?: string;
      evidence?: Readonly<Record<string, string | null>>;
    }> = {},
  ) {
    super(`${code}:${message}`);
    this.name = "V3NormalImplementationPreclaimError";
    this.code = code;
    this.causeCode = options.causeCode;
    this.evidence = Object.freeze({ ...options.evidence });
  }
}

export type V3NormalImplementationStoryRow = Readonly<{
  id: string;
  run_id: string;
  story_id: string;
  story_index: number;
  status: string;
  depends_on: unknown;
}>;

export type V3TerminalDependencyAttemptProjection = Readonly<{
  storyId: string;
  attemptId: string;
  disposition: "produced_delta" | "already_satisfied" | "verified";
  sourceAfterSha: string | null;
  sourceAfterTreeHash: string | null;
}>;

type V3PreparationBlockRepository = Pick<
  ReturnType<typeof createV3PreparationBlockRepository>,
  "findOpen" | "readOpenFingerprint" | "record" | "resolveReady"
>;

export type V3NormalImplementationPreclaimResult<
  TStory extends V3NormalImplementationStoryRow = V3NormalImplementationStoryRow,
> =
  | Readonly<{ status: "none" }>
  | Readonly<{
      status: "blocked";
      story?: TStory;
      packetHash?: string;
      baseRevision?: SourceRevisionV1;
      decision?: V3PreparationDecisionV1;
      block?: V3PreparationBlockV1;
      ledgerStatus?: "opened" | "duplicate" | "superseded" | "historical" | "unchanged";
      error: V3NormalImplementationPreclaimError;
      consumesClaim: false;
      dispatchModel: false;
    }>
  | Readonly<{
      status: "ready";
      story: TStory;
      packetHash: string;
      baseRevision: SourceRevisionV1;
      authority: V3PreparationClaimAuthorityV1;
    }>;

export type V3NormalImplementationPreclaimDependencies<
  TStory extends V3NormalImplementationStoryRow = V3NormalImplementationStoryRow,
> = Readonly<{
  readPacket(runId: string): Promise<ExactSealedRuntimePacket>;
  readPendingStories(input: Readonly<{
    runId: string;
    stepId: string;
  }>): Promise<readonly TStory[]>;
  readTerminalDependencyAttempts(input: Readonly<{
    runId: string;
    stepId: string;
    packetHash: string;
    storyIds: readonly string[];
  }>): Promise<readonly V3TerminalDependencyAttemptProjection[]>;
  blockRepository: V3PreparationBlockRepository;
  syncBeforePin?(input: Readonly<{
    runId: string;
    stepId: string;
    storyId: string;
    packetHash: string;
    repo: string;
    requestedBaseRef: string;
  }>): void | Promise<void>;
  resolveRevision?: typeof resolveV3GitRevision;
}>;

function structuralCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

function detail(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000);
}

function blocked<TStory extends V3NormalImplementationStoryRow>(input: Readonly<{
  code: V3NormalImplementationPreclaimErrorCode;
  message: string;
  cause?: unknown;
  evidence?: Readonly<Record<string, string | null>>;
  story?: TStory;
  packetHash?: string;
  baseRevision?: SourceRevisionV1;
  decision?: V3PreparationDecisionV1;
  block?: V3PreparationBlockV1;
  ledgerStatus?: "opened" | "duplicate" | "superseded" | "historical" | "unchanged";
}>): V3NormalImplementationPreclaimResult<TStory> {
  return {
    status: "blocked",
    ...(input.story ? { story: input.story } : {}),
    ...(input.packetHash ? { packetHash: input.packetHash } : {}),
    ...(input.baseRevision ? { baseRevision: input.baseRevision } : {}),
    ...(input.decision ? { decision: input.decision } : {}),
    ...(input.block ? { block: input.block } : {}),
    ...(input.ledgerStatus ? { ledgerStatus: input.ledgerStatus } : {}),
    error: new V3NormalImplementationPreclaimError(input.code, input.message, {
      ...(input.cause ? { causeCode: structuralCode(input.cause) } : {}),
      evidence: input.evidence,
    }),
    consumesClaim: false,
    dispatchModel: false,
  };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

type V3ImplementationStoryPlan = StoryPlanV1 | StoryPlanV2;

function validateNativeV3Packet(
  packet: SealedRuntimePacketV3,
): StoryPlanV2 {
  const packetPayload = ProductBuildPacketV3Schema.safeParse(packet.packet);
  const report = ProductCompilationReportV3Schema.safeParse(packet.compilationReport);
  const storyPlan = StoryPlanV2Schema.safeParse(packet.storyPlan);
  if (!packetPayload.success || !report.success || report.data.status !== "sealed" || !storyPlan.success) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_PACKET_INVALID",
      "native v3 packet payload, sealed report, or StoryPlanV2 is invalid",
    );
  }
  const refs = packet.refs;
  const requiredRefs = [
    refs.productSpec,
    refs.buildTopology,
    refs.storyPlan,
    refs.designSourceClosure,
    refs.implementationSourceMap,
    refs.packet,
    refs.compilationReport,
  ];
  if (
    requiredRefs.some((hash) => !SHA256.test(hash))
    || (refs.designGraph !== null && !SHA256.test(refs.designGraph))
    || (packetPayload.data.designGraphV2Hash === null) !== (refs.designGraph === null)
    || packetPayload.data.productSpecV2Hash !== refs.productSpec
    || packetPayload.data.designGraphV2Hash !== refs.designGraph
    || packetPayload.data.buildTopologyV1Hash !== refs.buildTopology
    || packetPayload.data.storyPlanV2Hash !== refs.storyPlan
    || packetPayload.data.designSourceClosureV2Hash !== refs.designSourceClosure
    || packetPayload.data.implementationSourceMapV1Hash !== refs.implementationSourceMap
    || report.data.packetHash !== packet.packetHash
    || report.data.artifactHashes.productSpecV2 !== refs.productSpec
    || report.data.artifactHashes.designGraphV2 !== refs.designGraph
    || report.data.artifactHashes.buildTopologyV1 !== refs.buildTopology
    || report.data.artifactHashes.storyPlanV2 !== refs.storyPlan
    || report.data.artifactHashes.designSourceClosureV2 !== refs.designSourceClosure
    || report.data.artifactHashes.implementationSourceMapV1 !== refs.implementationSourceMap
    || packetPayload.data.compiler.codeSha !== report.data.compiler.codeSha
    || packetPayload.data.compiler.version !== report.data.compiler.version
    || packetPayload.data.runtimeDataContractHash !== packet.buildTopology.runtimeDataContractHash
    || packetPayload.data.runtimeEvidenceContractHash !== packet.buildTopology.runtimeEvidenceContractHash
  ) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_PACKET_INVALID",
      "native v3 packet child refs, runtime authority, or compiler identity are internally inconsistent",
    );
  }
  return storyPlan.data;
}

function validatePacket(packet: ExactSealedRuntimePacket, runId: string): V3ImplementationStoryPlan {
  if (
    packet.runId !== runId
    || !SHA256.test(packet.packetHash)
    || packet.refs.packet !== packet.packetHash
  ) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_PACKET_INVALID",
      "runtime packet identity is not bound to the requested run and artifact ref",
    );
  }
  if ("implementationSourceMap" in packet) return validateNativeV3Packet(packet);
  const packetPayload = packet.packet.schema === "setfarm.product-build-packet.v2"
    ? ProductBuildPacketV2Schema.safeParse(packet.packet)
    : ProductBuildPacketV1Schema.safeParse(packet.packet);
  const report = packet.compilationReport.schema === "setfarm.product-compilation-report.v2"
    ? ProductCompilationReportV2Schema.safeParse(packet.compilationReport)
    : ProductCompilationReportV1Schema.safeParse(packet.compilationReport);
  const storyPlan = StoryPlanV1Schema.safeParse(packet.storyPlan);
  if (!packetPayload.success || !report.success || report.data.status !== "sealed" || !storyPlan.success) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_PACKET_INVALID",
      "runtime packet payload, sealed report, or StoryPlan is invalid",
    );
  }
  const refs = packet.refs;
  if (
    Object.values(refs).some((hash) => !SHA256.test(hash))
    || packetPayload.data.productSpecHash !== refs.productSpec
    || packetPayload.data.designGraphHash !== refs.designGraph
    || packetPayload.data.buildTopologyHash !== refs.buildTopology
    || packetPayload.data.storyPlanHash !== refs.storyPlan
    || report.data.packetHash !== packet.packetHash
    || report.data.artifactHashes.productSpec !== refs.productSpec
    || report.data.artifactHashes.designGraph !== refs.designGraph
    || report.data.artifactHashes.buildTopology !== refs.buildTopology
    || report.data.artifactHashes.storyPlan !== refs.storyPlan
    || packetPayload.data.compiler.codeSha !== report.data.compiler.codeSha
    || packetPayload.data.compiler.version !== report.data.compiler.version
    || (packetPayload.data.schema === "setfarm.product-build-packet.v2" && (
      !("designSourceClosure" in refs)
      || packetPayload.data.designSourceClosureHash !== refs.designSourceClosure
      || report.data.schema !== "setfarm.product-compilation-report.v2"
      || report.data.artifactHashes.designSourceClosure !== refs.designSourceClosure
    ))
  ) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_PACKET_INVALID",
      "runtime packet child refs or compiler identity are internally inconsistent",
    );
  }
  return storyPlan.data;
}

function selectPendingStory<TStory extends V3NormalImplementationStoryRow>(
  stories: readonly TStory[],
  runId: string,
): TStory | undefined {
  if (stories.length > MAX_PENDING_STORIES) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_STORY_SELECTION_FAILED",
      `pending story projection exceeds ${MAX_PENDING_STORIES}`,
    );
  }
  for (const story of stories) {
    if (
      typeof story.id !== "string"
      || story.id.length === 0
      || story.run_id !== runId
      || typeof story.story_id !== "string"
      || story.story_id.length === 0
      || !Number.isInteger(story.story_index)
      || story.story_index < 0
      || story.status !== "pending"
    ) {
      throw new V3NormalImplementationPreclaimError(
        "V3_NORMAL_PRECLAIM_STORY_PROJECTION_INVALID",
        "pending story reader returned a malformed or non-pending projection",
      );
    }
  }
  const ids = stories.map((story) => story.id);
  const storyIds = stories.map((story) => story.story_id);
  const indexes = stories.map((story) => story.story_index);
  if (
    new Set(ids).size !== ids.length
    || new Set(storyIds).size !== storyIds.length
    || new Set(indexes).size !== indexes.length
  ) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_STORY_PROJECTION_INVALID",
      "pending story projection contains duplicate row, story, or index identities",
    );
  }
  return [...stories].sort((left, right) =>
    left.story_index - right.story_index
    || left.story_id.localeCompare(right.story_id)
    || left.id.localeCompare(right.id))[0];
}

function validateStoryProjection(
  story: V3NormalImplementationStoryRow,
  storyPlan: V3ImplementationStoryPlan,
): readonly string[] {
  const orderedStories = [...storyPlan.stories].sort((left, right) => left.order - right.order);
  const sealedIndex = orderedStories.findIndex((candidate) => candidate.id === story.story_id);
  if (sealedIndex < 0) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_STORY_NOT_IN_PACKET",
      `pending story ${story.story_id} is absent from the sealed StoryPlan`,
    );
  }
  if (sealedIndex !== story.story_index) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_STORY_ORDER_MISMATCH",
      `pending story ${story.story_id} index differs from sealed StoryPlan order`,
    );
  }
  if (typeof story.depends_on !== "string") {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_DEPENDENCY_PROJECTION_INVALID",
      `pending story ${story.story_id} dependency projection is not canonical JSON`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(story.depends_on);
  } catch {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_DEPENDENCY_PROJECTION_INVALID",
      `pending story ${story.story_id} dependency projection is not JSON`,
    );
  }
  if (
    !Array.isArray(parsed)
    || parsed.some((value) => typeof value !== "string" || !StoryIdSchema.safeParse(value).success)
  ) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_DEPENDENCY_PROJECTION_INVALID",
      `pending story ${story.story_id} dependency projection is not a Story ID array`,
    );
  }
  const projected = parsed as string[];
  const canonicalProjected = canonicalStrings(projected);
  if (!sameStrings(projected, canonicalProjected)) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_DEPENDENCY_PROJECTION_INVALID",
      `pending story ${story.story_id} dependencies are duplicated or noncanonical`,
    );
  }
  const sealedDependencies = orderedStories[sealedIndex]!.dependsOn;
  const canonicalSealed = canonicalStrings(sealedDependencies);
  if (!sameStrings(sealedDependencies, canonicalSealed)) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_PACKET_INVALID",
      `sealed story ${story.story_id} dependencies are noncanonical`,
    );
  }
  if (!sameStrings(projected, sealedDependencies)) {
    throw new V3NormalImplementationPreclaimError(
      "V3_NORMAL_PRECLAIM_DEPENDENCY_PACKET_MISMATCH",
      `pending story ${story.story_id} dependencies differ from the sealed StoryPlan`,
    );
  }
  return projected;
}

function packetEvidenceRefs(packet: ExactSealedRuntimePacket): string[] {
  return canonicalStrings(Object.values(packet.refs)
    .filter((hash): hash is string => typeof hash === "string")
    .map((hash) => `setfarm://artifact/${hash}`));
}

function exactAuthorityMatch(input: Readonly<{
  authority: V3PreparationClaimAuthorityV1;
  runId: string;
  stepId: string;
  storyId: string;
  packetHash: string;
  baseRevision: SourceRevisionV1;
  projectedDependencyIds: readonly string[];
  dependencyState: readonly V3PreparationDependencyStateV1[];
}>): boolean {
  const exactAttempts = input.dependencyState.every((dependency, index) => {
    const attempt = input.authority.dependencyAttempts[index];
    return dependency.state === "ready"
      && attempt?.storyId === dependency.storyId
      && attempt.attemptId === dependency.attemptId
      && attempt.disposition === dependency.disposition
      && attempt.sourceRevision.sha === dependency.sourceAfterSha
      && attempt.sourceRevision.treeHash === dependency.sourceAfterTreeHash;
  });
  return input.authority.runId === input.runId
    && input.authority.stepId === input.stepId
    && input.authority.storyId === input.storyId
    && input.authority.packetHash === input.packetHash
    && input.authority.baseRevision.sha === input.baseRevision.sha
    && input.authority.baseRevision.treeHash === input.baseRevision.treeHash
    && sameStrings(input.authority.projectedDependencyIds, input.projectedDependencyIds)
    && input.authority.dependencyAttempts.length === input.dependencyState.length
    && exactAttempts;
}

export function createV3NormalImplementationPreclaim<
  TStory extends V3NormalImplementationStoryRow = V3NormalImplementationStoryRow,
>(dependencies: V3NormalImplementationPreclaimDependencies<TStory>) {
  const revisionResolver = dependencies.resolveRevision ?? resolveV3GitRevision;

  return Object.freeze({
    async prepare(input: Readonly<{
      runId: string;
      stepId: string;
      repo: string;
      requestedBaseRef: string;
      expectedSha?: string;
    }>): Promise<V3NormalImplementationPreclaimResult<TStory>> {
      if (!input.runId || !input.stepId || !input.repo || !input.requestedBaseRef) {
        return blocked({
          code: "V3_NORMAL_PRECLAIM_INPUT_INVALID",
          message: "run, step, repository, and requested base ref are required",
        });
      }

      let packet: ExactSealedRuntimePacket;
      let storyPlan: V3ImplementationStoryPlan;
      try {
        packet = await dependencies.readPacket(input.runId);
        storyPlan = validatePacket(packet, input.runId);
      } catch (error) {
        return blocked({
          code: error instanceof V3NormalImplementationPreclaimError
            ? error.code
            : "V3_NORMAL_PRECLAIM_PACKET_UNAVAILABLE",
          message: detail(error),
          cause: error,
        });
      }

      let story: TStory | undefined;
      try {
        story = selectPendingStory(
          await dependencies.readPendingStories({ runId: input.runId, stepId: input.stepId }),
          input.runId,
        );
      } catch (error) {
        return blocked({
          code: error instanceof V3NormalImplementationPreclaimError
            ? error.code
            : "V3_NORMAL_PRECLAIM_STORY_SELECTION_FAILED",
          message: detail(error),
          cause: error,
          packetHash: packet.packetHash,
        });
      }
      if (!story) return { status: "none" };

      let projectedDependencyIds: readonly string[];
      try {
        projectedDependencyIds = validateStoryProjection(story, storyPlan);
      } catch (error) {
        return blocked({
          code: error instanceof V3NormalImplementationPreclaimError
            ? error.code
            : "V3_NORMAL_PRECLAIM_STORY_PROJECTION_INVALID",
          message: detail(error),
          cause: error,
          story,
          packetHash: packet.packetHash,
        });
      }

      try {
        await dependencies.syncBeforePin?.({
          runId: input.runId,
          stepId: input.stepId,
          storyId: story.story_id,
          packetHash: packet.packetHash,
          repo: input.repo,
          requestedBaseRef: input.requestedBaseRef,
        });
      } catch (error) {
        return blocked({
          code: "V3_NORMAL_PRECLAIM_SOURCE_SYNC_FAILED",
          message: detail(error),
          cause: error,
          story,
          packetHash: packet.packetHash,
        });
      }

      let baseRevision: SourceRevisionV1;
      try {
        baseRevision = revisionResolver({
          repo: input.repo,
          requestedRef: input.requestedBaseRef,
          ...(input.expectedSha ? { expectedSha: input.expectedSha } : {}),
        });
      } catch (error) {
        return blocked({
          code: "V3_NORMAL_PRECLAIM_SOURCE_UNAVAILABLE",
          message: detail(error),
          cause: error,
          evidence: {
            requestedBaseRef: input.requestedBaseRef,
            expectedSha: input.expectedSha ?? null,
          },
          story,
          packetHash: packet.packetHash,
        });
      }

      const evaluator = createV3PreparationEligibilityEvaluator({
        readPacket: async (runId) => {
          if (runId !== input.runId) throw new Error("V3_NORMAL_PRECLAIM_RUN_DRIFT");
          return packet;
        },
        captureSource: async (repo) => {
          if (repo !== input.repo) throw new Error("V3_NORMAL_PRECLAIM_REPO_DRIFT");
          return baseRevision;
        },
        readTerminalDependencyAttempts: dependencies.readTerminalDependencyAttempts,
        readOpenFingerprint: dependencies.blockRepository.readOpenFingerprint,
      });

      let eligibility: Awaited<ReturnType<typeof evaluator.evaluate>>;
      try {
        eligibility = await evaluator.evaluate({
          runId: input.runId,
          stepId: input.stepId,
          storyId: story.story_id,
          sourceWorktree: input.repo,
          projectedDependencyIds,
        });
      } catch (error) {
        let existingOpenFingerprint: string | undefined;
        try {
          existingOpenFingerprint = await dependencies.blockRepository.readOpenFingerprint({
            runId: input.runId,
            stepId: input.stepId,
            storyId: story.story_id,
          });
        } catch (ledgerError) {
          return blocked({
            code: "V3_NORMAL_PRECLAIM_BLOCK_LEDGER_FAILED",
            message: detail(ledgerError),
            cause: ledgerError,
            story,
            packetHash: packet.packetHash,
            baseRevision,
          });
        }
        const decision = decideV3PreparationFailure({
          identity: {
            runId: input.runId,
            stepId: input.stepId,
            storyId: story.story_id,
            packetHash: packet.packetHash,
            sourceSha: baseRevision.sha,
            sourceTreeHash: baseRevision.treeHash,
            phase: "eligibility",
            dependencyState: [],
          },
          error,
          existingOpenFingerprint,
        });
        eligibility = {
          status: "blocked",
          packet,
          source: baseRevision,
          dependencyState: [],
          decision,
          detail: detail(error),
        };
      }

      if (eligibility.status === "blocked") {
        const decision = eligibility.decision;
        try {
          if (decision.action === "unchanged_replay") {
            const open = await dependencies.blockRepository.findOpen({
              runId: input.runId,
              stepId: input.stepId,
              storyId: story.story_id,
            });
            if (!open || open.fingerprint !== decision.fingerprint) {
              return blocked({
                code: "V3_NORMAL_PRECLAIM_BLOCK_LEDGER_INCONSISTENT",
                message: "unchanged eligibility fingerprint has no exact open preparation block",
                story,
                packetHash: packet.packetHash,
                baseRevision,
                decision,
              });
            }
            return blocked({
              code: "V3_NORMAL_PRECLAIM_ELIGIBILITY_FAILED",
              message: eligibility.detail,
              story,
              packetHash: packet.packetHash,
              baseRevision,
              decision,
              block: open,
              ledgerStatus: "unchanged",
            });
          }
          const recorded = await dependencies.blockRepository.record({
            identity: {
              schema: "setfarm.v3-preparation-identity.v1",
              runId: input.runId,
              stepId: input.stepId,
              storyId: story.story_id,
              packetHash: packet.packetHash,
              sourceSha: baseRevision.sha,
              sourceTreeHash: baseRevision.treeHash,
              phase: decision.phase,
              errorCode: decision.errorCode,
              dependencyState: [...eligibility.dependencyState],
            },
            decision,
            detail: eligibility.detail,
            evidenceRefs: packetEvidenceRefs(packet),
          });
          return blocked({
            code: "V3_NORMAL_PRECLAIM_ELIGIBILITY_FAILED",
            message: eligibility.detail,
            story,
            packetHash: packet.packetHash,
            baseRevision,
            decision,
            block: recorded.block,
            ledgerStatus: recorded.status,
          });
        } catch (error) {
          return blocked({
            code: "V3_NORMAL_PRECLAIM_BLOCK_LEDGER_FAILED",
            message: detail(error),
            cause: error,
            story,
            packetHash: packet.packetHash,
            baseRevision,
            decision,
          });
        }
      }

      try {
        const resolution = await dependencies.blockRepository.resolveReady({
          runId: input.runId,
          stepId: input.stepId,
          storyId: story.story_id,
          packetHash: packet.packetHash,
          sourceSha: baseRevision.sha,
          sourceTreeHash: baseRevision.treeHash,
          dependencyState: eligibility.dependencyState,
          projectedDependencyIds,
        });
        const parsedAuthority = V3PreparationClaimAuthorityV1Schema.safeParse(resolution.authority);
        if (!parsedAuthority.success || !exactAuthorityMatch({
          authority: parsedAuthority.data,
          runId: input.runId,
          stepId: input.stepId,
          storyId: story.story_id,
          packetHash: packet.packetHash,
          baseRevision,
          projectedDependencyIds,
          dependencyState: eligibility.dependencyState,
        })) {
          return blocked({
            code: "V3_NORMAL_PRECLAIM_AUTHORITY_INVALID",
            message: "ready transition did not return the exact preparation claim authority",
            story,
            packetHash: packet.packetHash,
            baseRevision,
          });
        }
        return {
          status: "ready",
          story,
          packetHash: packet.packetHash,
          baseRevision,
          authority: parsedAuthority.data,
        };
      } catch (error) {
        return blocked({
          code: "V3_NORMAL_PRECLAIM_AUTHORITY_FAILED",
          message: detail(error),
          cause: error,
          story,
          packetHash: packet.packetHash,
          baseRevision,
        });
      }
    },
  });
}

/** Read-only projection. Claim publication must re-check the returned authority by CAS. */
export function createPostgresV3PendingStoryReader(sql: postgres.Sql) {
  return async (input: Readonly<{
    runId: string;
    stepId: string;
  }>): Promise<readonly V3NormalImplementationStoryRow[]> => sql.unsafe<V3NormalImplementationStoryRow[]>(
    `SELECT story.id::text, story.run_id, story.story_id, story.story_index,
            story.status, story.depends_on
       FROM stories story
      WHERE story.run_id = $1
        AND story.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM runs run
           WHERE run.id = story.run_id
             AND run.protocol = 'v3'
             AND run.status IN ('running', 'resuming')
        )
        AND EXISTS (
          SELECT 1 FROM steps step
           WHERE step.run_id = story.run_id
             AND step.step_id = $2
             AND step.type = 'loop'
             AND step.status IN ('pending', 'running')
        )
      ORDER BY story.story_index ASC, story.story_id ASC, story.id ASC
      LIMIT 5001`,
    [input.runId, input.stepId],
  );
}
