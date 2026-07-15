import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
  type EvidenceBundleV2,
} from "../../src/evidence/evidence-bundle-v2.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import {
  V3ImplementationAttemptError,
  type V3ImplementationAttemptResult,
} from "../../src/execution/v3-implementation-attempt.js";
import {
  ExecutionAttemptV1Schema,
  type ExecutionAttemptV1,
  type SourceRevisionV1,
} from "../../src/execution/schemas/execution-attempt-v1.js";
import type { FindingSetV1 } from "../../src/findings/finding-set.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import type { SealedRuntimePacketV1 } from "../../src/product-compiler/runtime-artifact-reader.js";
import {
  ImplementationSliceV1Schema,
  type ImplementationSliceV1,
} from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import {
  createV3DownstreamEvidenceRouter,
  V3DownstreamEvidenceRouteResultV1Schema,
  V3DownstreamEvidenceRouterError,
} from "../../src/recovery/v3-downstream-evidence-router.js";
import type { V3RecoveryCoordinatorResult } from "../../src/recovery/v3-recovery-coordinator.js";
import { V3_RECOVERY_TERMINAL_REASON_CODES_V1 } from "../../src/recovery/v3-downstream-terminal-cause-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const RUN_ID = "run-v3-downstream-router";
const PACKET_HASH = "a".repeat(64);
const SOURCE = Object.freeze({ sha: "1".repeat(40), treeHash: "2".repeat(40) });
const STORY_IDS = ["US-001", "US-002"] as const;
const NOW = "2026-07-13T10:00:00.000Z";

function attempt(input: Readonly<{
  storyId: string;
  sliceHash: string;
  disposition?: ExecutionAttemptV1["disposition"];
  evidenceRefs?: readonly string[];
}>): ExecutionAttemptV1 {
  return ExecutionAttemptV1Schema.parse({
    schema: "setfarm.execution-attempt.v1",
    attemptId: `ATT_downstream-${input.storyId.toLowerCase()}-0001`,
    claimId: input.storyId === "US-001" ? 101 : 102,
    runId: RUN_ID,
    stepId: "qa-test",
    storyId: input.storyId,
    generation: 1,
    fenceToken: hashCanonicalJson({ fence: input.storyId }),
    attemptClass: "evidence_only",
    packetHash: PACKET_HASH,
    compilationReportHash: "9".repeat(64),
    sliceHash: input.sliceHash,
    sourceBefore: SOURCE,
    ...(input.disposition && !["claimed", "running", "superseded"].includes(input.disposition)
      ? { sourceAfter: SOURCE }
      : {}),
    role: "downstream-evidence-orchestrator",
    agentId: "setfarm-downstream-evidence-orchestrator",
    branch: "run/downstream-router",
    worktree: "/tmp/downstream-router",
    lease: { acquiredAt: NOW, expiresAt: NOW, heartbeatAt: NOW },
    disposition: input.disposition ?? "claimed",
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function slice(storyId: string): ImplementationSliceV1 {
  const base = buildMinimalValidContracts().implementationSlice;
  return ImplementationSliceV1Schema.parse({
    ...base,
    storyId,
    story: { ...base.story, id: storyId },
    packetHash: PACKET_HASH,
    sourceRevision: { baseSha: SOURCE.sha, treeHash: SOURCE.treeHash },
  });
}

function bundle(input: Readonly<{
  storyId: string;
  sliceHash: string;
  attemptId: string;
  verdict: "pass" | "fail";
}>): EvidenceBundleV2 {
  const runtimeArtifactHash = hashCanonicalJson({ runtime: input.storyId, verdict: input.verdict });
  const observation = {
    kind: "runtime" as const,
    owner: "setfarm-orchestrator" as const,
    runtimeSessionId: `runtime-${input.storyId.toLowerCase()}`,
    runtimeArtifactHash,
    startedAt: NOW,
    completedAt: "2026-07-13T10:00:01.000Z",
  };
  return createEvidenceBundleV2({
    runId: RUN_ID,
    storyId: input.storyId,
    packetHash: PACKET_HASH,
    sliceHash: input.sliceHash,
    sourceRevision: SOURCE,
    attemptId: input.attemptId,
    predicates: [{
      invariantRef: "INV_PERSISTENCE_ROUND_TRIP",
      predicateRef: "EVID_SAVE_RELOAD",
      required: true,
      verdict: input.verdict,
      observationRefs: [computeObservationRef(observation)],
    }],
    observations: [observation],
    artifacts: [{ hash: runtimeArtifactHash, mediaType: "application/json", locator: "evidence/runtime.json" }],
    runner: { id: "setfarm-downstream-router-test", version: "1", environmentHash: "8".repeat(64) },
    startedAt: NOW,
    completedAt: "2026-07-13T10:00:02.000Z",
  });
}

describe("v3 downstream evidence router", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function fixture(verdicts: Readonly<Record<string, "pass" | "fail">>) {
    const worktree = await mkdtemp(path.join(tmpdir(), "setfarm-v3-downstream-router-"));
    roots.push(worktree);
    await mkdir(path.join(worktree, "src"), { recursive: true });
    await writeFile(path.join(worktree, "src/App.tsx"), "export const App = () => 'integrated';\n");
    const contexts = new Map<string, V3ImplementationAttemptResult>();
    const bundles = new Map<string, EvidenceBundleV2>();
    const findings = new Map<string, FindingSetV1>();
    const executions = new Map<string, number>();
    for (const storyId of STORY_IDS) {
      const exactSlice = slice(storyId);
      const exactSliceHash = hashCanonicalJson({ slice: storyId, source: SOURCE });
      const exactAttempt = attempt({ storyId, sliceHash: exactSliceHash });
      contexts.set(storyId, {
        attempt: exactAttempt,
        artifactProducer: { pass: "test", codeSha: "3".repeat(40), toolVersions: { setfarm: "test" } },
        slice: exactSlice,
        sliceHash: exactSliceHash,
        sliceRefKey: `SLICE_${storyId.replace("-", "_")}`,
        evidencePlan: compileEvidencePlanV1({ slice: exactSlice, sliceHash: exactSliceHash }),
        evidencePlanArtifactHash: hashCanonicalJson({ evidencePlan: storyId }),
        evidencePlanRefKey: `EVIDENCE_PLAN_${storyId.replace("-", "_")}`,
        packetHash: PACKET_HASH,
        compilationReportHash: "9".repeat(64),
        sourceBefore: SOURCE,
      });
    }
    const packet = {
      runId: RUN_ID,
      packetHash: PACKET_HASH,
      storyPlan: { stories: STORY_IDS.map((id) => ({ id })) },
    } as SealedRuntimePacketV1;
    const dependencies = {
      readPacket: async () => packet,
      readStories: async () => STORY_IDS.map((storyId, index) => ({ storyDbId: `story-db-${index + 1}`, storyId, status: "done" })),
      reserveAttempt: async ({ authority }: { authority: { storyId: string } }) => contexts.get(authority.storyId)!,
      loadAttemptContext: async ({ storyId }: { storyId: string }) => contexts.get(storyId)!,
      markRunning: async ({ attempt: current }: { attempt: ExecutionAttemptV1 }) => {
        const running = ExecutionAttemptV1Schema.parse({ ...current, disposition: "running" });
        contexts.set(current.storyId, { ...contexts.get(current.storyId)!, attempt: running });
        return running;
      },
      complete: async ({ attempt: current, bundle: exactBundle, findingSet }: {
        attempt: ExecutionAttemptV1;
        bundle: EvidenceBundleV2;
        findingSet?: FindingSetV1;
      }) => {
        const bundleHash = computeEvidenceBundleHash(exactBundle);
        bundles.set(bundleHash, exactBundle);
        if (findingSet) findings.set(findingSet.findingSetHash, findingSet);
        const completed = attempt({
          storyId: current.storyId,
          sliceHash: current.sliceHash!,
          disposition: exactBundle.aggregateVerdict === "pass" ? "verified" : "no_progress",
          evidenceRefs: [
            `setfarm://evidence-bundle/${bundleHash}`,
            ...(findingSet ? [`setfarm://finding-set/${findingSet.findingSetHash}`] : []),
          ],
        });
        contexts.set(current.storyId, { ...contexts.get(current.storyId)!, attempt: completed });
        return completed;
      },
      executeEvidence: async ({ context }: { context: V3ImplementationAttemptResult }) => {
        executions.set(context.attempt.storyId, (executions.get(context.attempt.storyId) ?? 0) + 1);
        return bundle({
          storyId: context.attempt.storyId,
          sliceHash: context.sliceHash,
          attemptId: context.attempt.attemptId,
          verdict: verdicts[context.attempt.storyId]!,
        });
      },
      captureSource: async (): Promise<SourceRevisionV1> => SOURCE,
      findEvidenceBundle: async (hash: string) => bundles.get(hash),
      findFindingSet: async (hash: string) => findings.get(hash),
      coordinate: async (input: unknown): Promise<V3RecoveryCoordinatorResult> => {
        const exactBundle = (input as { evidenceBundle: EvidenceBundleV2 }).evidenceBundle;
        const evidenceBundleHash = computeEvidenceBundleHash(exactBundle);
        return exactBundle.aggregateVerdict === "pass"
          ? { status: "verified", evidenceBundleHash, attemptId: exactBundle.attemptId! }
          : {
              status: "dispatched",
              recoveryCaseId: `RCV_${"3".repeat(64)}`,
              revisionId: `RREV_${"4".repeat(64)}`,
              dispatchId: `RDISP_${"5".repeat(64)}`,
              dispatchClass: "product_implementation",
              modelDispatch: true,
              deliveryState: "authorized",
              evidenceBundleHash,
            };
      },
    };
    return { worktree, contexts, executions, dependencies };
  }

  const routeInput = (worktree: string) => ({
    runId: RUN_ID,
    stepDbId: "step-db-qa",
    workflowStepId: "qa-test",
    phase: "qa",
    parentClaimId: 77,
    worktree,
    branch: "run/downstream-router",
  });

  it("recompiles every sealed StoryPlan story at one final source and routes only the failed owner", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "fail" });
    const result = await createV3DownstreamEvidenceRouter(value.dependencies).route(routeInput(value.worktree));
    assert.equal(result.status, "recovery_routed");
    assert.deepEqual(result.stories.map((story) => story.storyId), STORY_IDS);
    assert.deepEqual(result.stories.map((story) => story.execution), ["executed", "executed"]);
    assert.deepEqual(result.status === "recovery_routed" ? result.routedStoryIds : [], ["US-002"]);
    assert.deepEqual(Object.fromEntries(value.executions), { "US-001": 1, "US-002": 1 });
  });

  it("replays terminal bundles on unchanged source without running evidence again", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "fail" });
    const router = createV3DownstreamEvidenceRouter(value.dependencies);
    await router.route(routeInput(value.worktree));
    const replay = await router.route(routeInput(value.worktree));
    assert.deepEqual(replay.stories.map((story) => story.execution), ["replayed", "replayed"]);
    assert.deepEqual(Object.fromEntries(value.executions), { "US-001": 1, "US-002": 1 });
  });

  it("carries the exact finite terminal reason instead of inventing budget exhaustion", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "fail" });
    const router = createV3DownstreamEvidenceRouter({
      ...value.dependencies,
      coordinate: async (input: unknown): Promise<V3RecoveryCoordinatorResult> => {
        const exactBundle = (input as { evidenceBundle: EvidenceBundleV2 }).evidenceBundle;
        const evidenceBundleHash = computeEvidenceBundleHash(exactBundle);
        return exactBundle.aggregateVerdict === "pass"
          ? { status: "verified", evidenceBundleHash, attemptId: exactBundle.attemptId! }
          : {
              status: "blocked",
              recoveryCaseId: `RCV_${"3".repeat(64)}`,
              revisionId: `RREV_${"4".repeat(64)}`,
              reasonCode: "specification_incomplete",
              evidenceBundleHash,
            };
      },
    });
    const result = await router.route(routeInput(value.worktree));
    assert.equal(result.status, "bounded_recovery_blocked");
    if (result.status !== "bounded_recovery_blocked") assert.fail("expected terminal recovery route");
    assert.deepEqual(result.blockedStoryIds, ["US-002"]);
    assert.deepEqual(result.terminalReasonCodes, ["specification_incomplete"]);
  });

  it("represents the complete six-reason terminal vocabulary without truncation", () => {
    const stories = V3_RECOVERY_TERMINAL_REASON_CODES_V1.map((reasonCode, index) => ({
      storyDbId: `story-db-${index + 1}`,
      storyId: `US-00${index + 1}`,
      attemptId: `ATT_all-six-terminal-000${index + 1}`,
      sliceHash: "a".repeat(64),
      evidencePlanArtifactHash: "b".repeat(64),
      evidenceBundleHash: "c".repeat(64),
      aggregateVerdict: "fail" as const,
      execution: "replayed" as const,
      coordinator: {
        status: "blocked" as const,
        recoveryCaseId: `RCV_${"d".repeat(64)}`,
        revisionId: `RREV_${"e".repeat(64)}`,
        reasonCode,
        evidenceBundleHash: "c".repeat(64),
      },
    }));
    const result = V3DownstreamEvidenceRouteResultV1Schema.parse({
      schema: "setfarm.v3-downstream-evidence-route.v1",
      status: "bounded_recovery_blocked",
      runId: RUN_ID,
      phase: "qa",
      packetHash: PACKET_HASH,
      sourceRevision: SOURCE,
      stories,
      blockedStoryIds: stories.map((story) => story.storyId),
      terminalReasonCodes: V3_RECOVERY_TERMINAL_REASON_CODES_V1,
    });
    assert.equal(result.status, "bounded_recovery_blocked");
    if (result.status !== "bounded_recovery_blocked") assert.fail("expected blocked route");
    assert.deepEqual(result.terminalReasonCodes, V3_RECOVERY_TERMINAL_REASON_CODES_V1);
  });

  it("never terminalizes a pending recovery checkpoint", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "fail" });
    const router = createV3DownstreamEvidenceRouter({
      ...value.dependencies,
      coordinate: async (input: unknown): Promise<V3RecoveryCoordinatorResult> => {
        const exactBundle = (input as { evidenceBundle: EvidenceBundleV2 }).evidenceBundle;
        const evidenceBundleHash = computeEvidenceBundleHash(exactBundle);
        return exactBundle.aggregateVerdict === "pass"
          ? { status: "verified", evidenceBundleHash, attemptId: exactBundle.attemptId! }
          : {
              status: "pending",
              recoveryCaseId: `RCV_${"3".repeat(64)}`,
              revisionId: `RREV_${"4".repeat(64)}`,
              reasonCode: "recovery_checkpoint_requires_replay",
              evidenceBundleHash,
            };
      },
    });
    await assert.rejects(
      router.route(routeInput(value.worktree)),
      (error: unknown) => error instanceof V3DownstreamEvidenceRouterError
        && error.code === "V3_DOWNSTREAM_RECOVERY_CHECKPOINT_PENDING",
    );
  });

  it("requires a versioned packet amendment when all sealed story evidence passes", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "pass" });
    const result = await createV3DownstreamEvidenceRouter(value.dependencies).route(routeInput(value.worktree));
    assert.equal(result.status, "packet_amendment_required");
    assert.equal(result.status === "packet_amendment_required" ? result.reasonCode : "", "no_sealed_story_owns_downstream_delta");
    assert.equal(result.stories.length, 2);
  });

  it("returns exact final-source story refs for AcceptedCandidate publication on the success boundary", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "pass" });
    const result = await createV3DownstreamEvidenceRouter(value.dependencies).route({
      ...routeInput(value.worktree),
      stepDbId: "step-db-final",
      workflowStepId: "final-test",
      phase: "final",
      intent: "final_acceptance",
    });
    assert.equal(result.status, "accepted_candidate_ready");
    assert.equal(result.stories.every((story) => story.aggregateVerdict === "pass"), true);
    assert.equal(result.stories.every((story) => story.coordinator.status === "verified"), true);
    assert.equal(result.stories.every((story) => /^[a-f0-9]{64}$/.test(story.evidencePlanArtifactHash)), true);
  });

  it("fails closed when the DB projection is not the exact sealed StoryPlan", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "pass" });
    const router = createV3DownstreamEvidenceRouter({
      ...value.dependencies,
      readStories: async () => [{ storyDbId: "story-db-1", storyId: "US-001", status: "done" }],
    });
    await assert.rejects(
      router.route(routeInput(value.worktree)),
      (error: unknown) => error instanceof V3DownstreamEvidenceRouterError
        && error.code === "V3_DOWNSTREAM_EVIDENCE_STORY_PROJECTION_MISMATCH",
    );
  });

  it("rejects failed or skipped story state before final evidence can publish acceptance", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "pass" });
    const router = createV3DownstreamEvidenceRouter({
      ...value.dependencies,
      readStories: async () => STORY_IDS.map((storyId, index) => ({
        storyDbId: `story-db-${index + 1}`,
        storyId,
        status: storyId === "US-002" ? "failed" : "done",
      })),
    });
    await assert.rejects(
      router.route({
        ...routeInput(value.worktree),
        stepDbId: "step-db-final",
        workflowStepId: "final-test",
        phase: "final",
        intent: "final_acceptance",
      }),
      (error: unknown) => error instanceof V3DownstreamEvidenceRouterError
        && error.code === "V3_DOWNSTREAM_EVIDENCE_STORY_STATUS_INVALID",
    );
  });

  it("publishes no partial recovery dispatch when a later sealed story requires packet amendment", async () => {
    const value = await fixture({ "US-001": "fail", "US-002": "pass" });
    let coordinateCalls = 0;
    const router = createV3DownstreamEvidenceRouter({
      ...value.dependencies,
      reserveAttempt: async (input: { authority: { storyId: string } }) => {
        if (input.authority.storyId === "US-002") {
          throw new V3ImplementationAttemptError(
            "V3_SLICE_COMPILATION_REJECTED",
            "US-002 has no complete sealed final-source contract",
          );
        }
        return value.dependencies.reserveAttempt(input);
      },
      coordinate: async (input: unknown) => {
        coordinateCalls += 1;
        return value.dependencies.coordinate(input);
      },
    });
    const result = await router.route(routeInput(value.worktree));
    assert.equal(result.status, "packet_amendment_required");
    assert.equal(coordinateCalls, 0, "no story recovery may be exposed before the full evidence matrix compiles");
    assert.deepEqual(result.stories, []);
    if (result.status !== "packet_amendment_required") assert.fail("expected packet amendment");
    assert.equal(result.reasonCode, "sealed_story_evidence_unavailable");
    assert.equal(result.unavailableStoryId, "US-002");
    assert.equal(result.compilerReasonCode, "V3_SLICE_COMPILATION_REJECTED");
  });

  it("propagates operational reservation errors instead of converting them into packet amendments", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "pass" });
    const router = createV3DownstreamEvidenceRouter({
      ...value.dependencies,
      reserveAttempt: async () => { throw new Error("postgres unavailable"); },
    });
    await assert.rejects(router.route(routeInput(value.worktree)), /postgres unavailable/);
  });

  it("rejects source mutation during evidence before publication", async () => {
    const value = await fixture({ "US-001": "pass", "US-002": "pass" });
    let capture = 0;
    const router = createV3DownstreamEvidenceRouter({
      ...value.dependencies,
      captureSource: async () => (++capture === 1 ? SOURCE : { sha: SOURCE.sha, treeHash: "6".repeat(40) }),
    });
    await assert.rejects(
      router.route(routeInput(value.worktree)),
      (error: unknown) => error instanceof V3DownstreamEvidenceRouterError
        && error.code === "V3_DOWNSTREAM_EVIDENCE_SOURCE_MUTATED",
    );
  });
});
