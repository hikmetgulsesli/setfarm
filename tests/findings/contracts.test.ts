import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EvidenceBundleV2Schema,
  aggregateEvidenceVerdict,
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
} from "../../src/evidence/evidence-bundle-v2.js";
import {
  FindingSetV1Schema,
  createFindingSetV1,
} from "../../src/findings/finding-set.js";
import {
  RecoveryCaseV1Schema,
  computeRecoveryDispatchDedupeKey,
  createRecoveryCaseV1,
} from "../../src/recovery/recovery-case.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);
const SHA_A = "1".repeat(40);
const SHA_B = "2".repeat(40);
const TREE_A = "3".repeat(40);

function findingSet(observedEvidenceRefs: string[] = [HASH_C]) {
  return createFindingSetV1({
    runId: "run-findings-1",
    storyId: "US-001",
    packetHash: HASH_A,
    sliceHash: HASH_B,
    sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: HASH_D }],
      observedEvidenceRefs,
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function evidenceBundle(verdict: "pass" | "fail" | "inconclusive" = "pass") {
  const command = {
    kind: "command" as const,
    owner: "setfarm-orchestrator" as const,
    commandRef: "CMD_TEST",
    exitCode: verdict === "fail" ? 1 : 0,
    stdoutArtifactHash: HASH_A,
    startedAt: "2026-07-13T00:00:00.000Z",
    completedAt: "2026-07-13T00:00:01.000Z",
  };
  const control = {
    kind: "control" as const,
    owner: "setfarm-orchestrator" as const,
    actionRef: "ACT_SAVE",
    controlRef: "CTRL_SAVE",
    beforeArtifactHash: HASH_B,
    afterArtifactHash: HASH_C,
    startedAt: "2026-07-13T00:00:02.000Z",
    completedAt: "2026-07-13T00:00:03.000Z",
  };
  return createEvidenceBundleV2({
    runId: "run-findings-1",
    storyId: "US-001",
    packetHash: HASH_A,
    sliceHash: HASH_B,
    sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    predicates: [{
      invariantRef: "INV_SAVE_RELOAD",
      predicateRef: "EVID_SAVE_RELOAD",
      actionRef: "ACT_SAVE",
      controlRef: "CTRL_SAVE",
      required: true,
      verdict,
      observationRefs: [computeObservationRef(command), computeObservationRef(control)],
    }],
    observations: [control, command],
    artifacts: [
      { hash: HASH_C, mediaType: "application/json", locator: "evidence/after.json" },
      { hash: HASH_A, mediaType: "text/plain", locator: "evidence/test.stdout" },
      { hash: HASH_B, mediaType: "application/json", locator: "evidence/before.json" },
    ],
    runner: { id: "setfarm-browser-runner", version: "2.0.0", environmentHash: HASH_D },
    startedAt: "2026-07-13T00:00:00.000Z",
    completedAt: "2026-07-13T00:00:03.000Z",
  });
}

function recoveryCase() {
  const findings = findingSet();
  return createRecoveryCaseV1({
    runId: findings.runId,
    storyId: findings.storyId,
    findingSetHash: findings.findingSetHash,
    findingIds: findings.findings.map((finding) => finding.findingId),
    packetHash: findings.packetHash,
    sliceHash: findings.sliceHash,
    sourceRevision: findings.sourceRevision,
    owner: "implement",
    expectedDelta: {
      kind: "source_change",
      invariantRefs: ["INV_SAVE_RELOAD"],
      requiredPaths: ["src/App.tsx"],
    },
    allowedPaths: ["src/App.tsx"],
    evidencePlan: ["EVID_SAVE_RELOAD"],
    priorAttemptRefs: [],
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  }, { now: new Date("2026-07-13T00:00:00.000Z") });
}

describe("typed finding contracts", () => {
  it("binds IDs to exact source semantics while evidence revisions create a new set hash", () => {
    const first = findingSet([HASH_C, HASH_E]);
    const reordered = findingSet([HASH_E, HASH_C]);
    const refreshed = findingSet([HASH_C, HASH_F]);

    assert.deepEqual(reordered, first);
    assert.equal(refreshed.findings[0]!.findingId, first.findings[0]!.findingId);
    assert.notEqual(refreshed.findingSetHash, first.findingSetHash);
    assert.equal(FindingSetV1Schema.safeParse({ ...first, proseVerdict: "probably fixed" }).success, false);
  });

  it("keeps unstructured review prose from inventing a predicate", () => {
    const base = findingSet();
    const result = createFindingSetV1({
      runId: base.runId,
      storyId: base.storyId,
      packetHash: base.packetHash,
      sliceHash: base.sliceHash,
      sourceRevision: base.sourceRevision,
      findings: [{
        origin: "review",
        classification: "unstructured_review",
        externalRef: {
          platform: "github",
          repositoryNodeId: "R_repo",
          prNumber: 1925,
          threadId: "PRRT_thread",
          headSha: SHA_A,
          commentRevisionHash: HASH_D,
        },
        invariantRef: "INV_UNSTRUCTURED_REVIEW",
        sourceLocators: [{ path: "src/App.tsx", contentHash: HASH_D }],
        observedEvidenceRefs: [HASH_C],
        status: "open",
      }],
    });
    assert.equal(result.findings[0]?.expectedPredicateRef, undefined);
    assert.equal(FindingSetV1Schema.safeParse({
      ...result,
      findings: [{ ...result.findings[0], expectedPredicateRef: "EVID_GUESSED_FROM_PROSE" }],
    }).success, false);
  });
});

describe("orchestrator evidence bundle", () => {
  it("derives exact observation and bundle identities", () => {
    const first = evidenceBundle("pass");
    const second = evidenceBundle("pass");
    assert.deepEqual(second, first);
    assert.equal(computeEvidenceBundleHash(second), computeEvidenceBundleHash(first));
    assert.equal(first.aggregateVerdict, "pass");
    assert.equal(first.observations.every((observation) => observation.owner === "setfarm-orchestrator"), true);
  });

  it("cannot aggregate a required child failure to pass", () => {
    const failed = evidenceBundle("fail");
    assert.equal(failed.aggregateVerdict, "fail");
    assert.equal(aggregateEvidenceVerdict(failed.predicates), "fail");
    assert.equal(EvidenceBundleV2Schema.safeParse({ ...failed, aggregateVerdict: "pass" }).success, false);
    assert.equal(EvidenceBundleV2Schema.safeParse({
      ...failed,
      predicates: [
        ...failed.predicates,
        { ...failed.predicates[0]!, verdict: "pass" },
      ],
    }).success, false);
  });

  it("rejects agent-owned and missing evidence artifacts", () => {
    const valid = evidenceBundle();
    assert.equal(EvidenceBundleV2Schema.safeParse({
      ...valid,
      observations: valid.observations.map((observation, index) =>
        index === 0 ? { ...observation, owner: "agent" } : observation),
    }).success, false);
    assert.equal(EvidenceBundleV2Schema.safeParse({ ...valid, artifacts: valid.artifacts.slice(1) }).success, false);
  });
});

describe("bounded recovery contract", () => {
  it("derives exact case identity and enforces bounded budgets", () => {
    const value = recoveryCase();
    assert.match(value.recoveryCaseId, /^RCV_[a-f0-9]{64}$/);
    assert.equal(RecoveryCaseV1Schema.safeParse({
      ...value,
      budget: {
        limits: { ...value.budget.limits, supervisorRepair: 2 },
        used: value.budget.used,
      },
    }).success, false);
  });

  it("deduplicates model repair by unchanged source tree across empty commits", () => {
    const value = recoveryCase();
    const base = {
      dispatchClass: "product_implementation" as const,
      runId: value.runId,
      storyId: value.storyId,
      findingIds: value.findingIds,
      packetHash: value.packetHash,
      sliceHash: value.sliceHash,
      evidencePlan: value.evidencePlan,
    };
    const first = computeRecoveryDispatchDedupeKey({
      ...base,
      sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    });
    const emptyCommit = computeRecoveryDispatchDedupeKey({
      ...base,
      sourceRevision: { sha: SHA_B, treeHash: TREE_A },
    });
    const changedPacket = computeRecoveryDispatchDedupeKey({
      ...base,
      packetHash: HASH_E,
      sourceRevision: { sha: SHA_B, treeHash: TREE_A },
    });
    const otherRun = computeRecoveryDispatchDedupeKey({
      ...base,
      runId: "run-findings-2",
      sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    });
    assert.equal(emptyCommit, first);
    assert.notEqual(changedPacket, first);
    assert.notEqual(otherRun, first);
  });

  it("requires explicit terminal owner and matching outcome", () => {
    const value = recoveryCase();
    assert.equal(RecoveryCaseV1Schema.safeParse({ ...value, status: "blocked" }).success, false);
    assert.equal(RecoveryCaseV1Schema.safeParse({
      ...value,
      status: "blocked",
      terminal: {
        owner: "supervisor",
        outcome: "resolved",
        reasonCode: "budget_exhausted",
        evidenceBundleHashes: [],
      },
    }).success, false);
  });
});
