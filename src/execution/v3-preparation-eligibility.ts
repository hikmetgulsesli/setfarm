import type postgres from "postgres";

import type { SealedRuntimePacket } from "../product-compiler/runtime-artifact-reader.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import { V3ImplementationAttemptError } from "./v3-implementation-attempt.js";
import {
  decideV3PreparationFailure,
  type V3PreparationDecisionV1,
  type V3PreparationDependencyStateV1,
} from "./v3-preparation-decision.js";

type TerminalDependencyAttempt = Readonly<{
  storyId: string;
  attemptId: string;
  disposition: "produced_delta" | "already_satisfied" | "verified";
  sourceAfterSha: string | null;
  sourceAfterTreeHash: string | null;
}>;

export type V3PreparationEligibilityResult =
  | Readonly<{
      status: "ready";
      packet: SealedRuntimePacket;
      source: SourceRevisionV1;
      dependencyState: readonly V3PreparationDependencyStateV1[];
    }>
  | Readonly<{
      status: "blocked";
      packet: SealedRuntimePacket;
      source: SourceRevisionV1;
      dependencyState: readonly V3PreparationDependencyStateV1[];
      decision: V3PreparationDecisionV1;
      detail: string;
    }>;

type EligibilityDependencies = Readonly<{
  readPacket(runId: string): Promise<SealedRuntimePacket>;
  captureSource(worktree: string): Promise<SourceRevisionV1>;
  readTerminalDependencyAttempts(input: Readonly<{
    runId: string;
    stepId: string;
    packetHash: string;
    storyIds: readonly string[];
  }>): Promise<readonly TerminalDependencyAttempt[]>;
  readOpenFingerprint?(input: Readonly<{
    runId: string;
    stepId: string;
    storyId: string;
  }>): Promise<string | undefined>;
}>;

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function asBlocked(input: Readonly<{
  runId: string;
  stepId: string;
  storyId: string;
  packet: SealedRuntimePacket;
  source: SourceRevisionV1;
  dependencyState: readonly V3PreparationDependencyStateV1[];
  error: V3ImplementationAttemptError;
  existingOpenFingerprint?: string;
}>): V3PreparationEligibilityResult {
  return {
    status: "blocked",
    packet: input.packet,
    source: input.source,
    dependencyState: input.dependencyState,
    decision: decideV3PreparationFailure({
      identity: {
        runId: input.runId,
        stepId: input.stepId,
        storyId: input.storyId,
        packetHash: input.packet.packetHash,
        sourceSha: input.source.sha,
        sourceTreeHash: input.source.treeHash,
        phase: "eligibility",
        dependencyState: [...input.dependencyState],
      },
      error: input.error,
      existingOpenFingerprint: input.existingOpenFingerprint,
    }),
    detail: input.error.message,
  };
}

export function createV3PreparationEligibilityEvaluator(dependencies: EligibilityDependencies) {
  return Object.freeze({
    async evaluate(input: Readonly<{
      runId: string;
      stepId: string;
      storyId: string;
      sourceWorktree: string;
      projectedDependencyIds?: readonly string[];
    }>): Promise<V3PreparationEligibilityResult> {
      const [packet, source, existingOpenFingerprint] = await Promise.all([
        dependencies.readPacket(input.runId),
        dependencies.captureSource(input.sourceWorktree),
        dependencies.readOpenFingerprint?.({
          runId: input.runId,
          stepId: input.stepId,
          storyId: input.storyId,
        }),
      ]);
      const story = packet.storyPlan.stories.find((candidate) => candidate.id === input.storyId);
      if (!story) {
        return asBlocked({
          ...input,
          packet,
          source,
          dependencyState: [],
          existingOpenFingerprint,
          error: new V3ImplementationAttemptError(
            "V3_SLICE_STORY_NOT_IN_PACKET",
            `Story ${input.storyId} is absent from the sealed packet`,
          ),
        });
      }
      if (
        input.projectedDependencyIds
        && !sameStrings(input.projectedDependencyIds, story.dependsOn)
      ) {
        return asBlocked({
          ...input,
          packet,
          source,
          dependencyState: [],
          existingOpenFingerprint,
          error: new V3ImplementationAttemptError(
            "V3_ATTEMPT_CONTEXT_PACKET_MISMATCH",
            `Story ${input.storyId} dependency projection differs from its sealed packet`,
          ),
        });
      }

      if (!packet.buildTopology.runtimeEvidenceContract || !packet.buildTopology.runtimeEvidenceContractHash) {
        return asBlocked({
          ...input,
          packet,
          source,
          dependencyState: [],
          existingOpenFingerprint,
          error: new V3ImplementationAttemptError(
            "V3_RUNTIME_EVIDENCE_CONTRACT_REJECTED",
            "Sealed packet does not carry its compiler-verified runtime evidence contract",
          ),
        });
      }

      const attempts = await dependencies.readTerminalDependencyAttempts({
        runId: input.runId,
        stepId: input.stepId,
        packetHash: packet.packetHash,
        storyIds: story.dependsOn,
      });
      const attemptByStory = new Map(attempts.map((attempt) => [attempt.storyId, attempt]));
      const dependencyState: V3PreparationDependencyStateV1[] = story.dependsOn
        .map((storyId) => {
          const attempt = attemptByStory.get(storyId);
          if (!attempt) return { storyId, state: "missing" as const };
          if (!attempt.sourceAfterSha || !attempt.sourceAfterTreeHash) {
            return { storyId, state: "invalid" as const };
          }
          return {
            storyId,
            state: "ready" as const,
            attemptId: attempt.attemptId,
            disposition: attempt.disposition,
            sourceAfterSha: attempt.sourceAfterSha,
            sourceAfterTreeHash: attempt.sourceAfterTreeHash,
          };
        })
        .sort((left, right) => left.storyId.localeCompare(right.storyId));
      const invalid = dependencyState.find((dependency) => dependency.state === "invalid");
      if (invalid) {
        return asBlocked({
          ...input,
          packet,
          source,
          dependencyState,
          existingOpenFingerprint,
          error: new V3ImplementationAttemptError(
            "V3_SLICE_DEPENDENCY_ATTEMPT_INVALID",
            `Dependency ${invalid.storyId} has a terminal disposition without an exact source revision`,
          ),
        });
      }
      const missing = dependencyState.filter((dependency) => dependency.state === "missing");
      if (missing.length > 0) {
        return asBlocked({
          ...input,
          packet,
          source,
          dependencyState,
          existingOpenFingerprint,
          error: new V3ImplementationAttemptError(
            "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
            `Dependencies have no successful packet-bound implementation attempt: ${missing.map((item) => item.storyId).join(", ")}`,
          ),
        });
      }
      return {
        status: "ready",
        packet,
        source,
        dependencyState,
      };
    },
  });
}

export function createPostgresTerminalDependencyAttemptReader(sql: postgres.Sql) {
  return async (input: Readonly<{
    runId: string;
    stepId: string;
    packetHash: string;
    storyIds: readonly string[];
  }>): Promise<readonly TerminalDependencyAttempt[]> => {
    if (input.storyIds.length === 0) return [];
    const rows = await sql.unsafe<Array<{
      story_id: string;
      attempt_id: string;
      disposition: TerminalDependencyAttempt["disposition"];
      source_after_sha: string | null;
      source_after_tree_hash: string | null;
    }>>(
      `SELECT DISTINCT ON (story_id)
              story_id, attempt_id, disposition, source_after_sha, source_after_tree_hash
         FROM execution_attempts
        WHERE run_id = $1
          AND step_id = $2
          AND packet_hash = $3
          AND story_id = ANY($4::text[])
          AND attempt_class IN ('product_implementation', 'supervisor_repair')
          AND disposition IN ('produced_delta', 'already_satisfied', 'verified')
        ORDER BY story_id, generation DESC, attempt_id DESC`,
      [input.runId, input.stepId, input.packetHash, [...input.storyIds]],
    );
    return rows.map((row) => ({
      storyId: row.story_id,
      attemptId: row.attempt_id,
      disposition: row.disposition,
      sourceAfterSha: row.source_after_sha,
      sourceAfterTreeHash: row.source_after_tree_hash,
    }));
  };
}
