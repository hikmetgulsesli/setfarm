import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  createRecoveryDeliveryRepository,
  recoveryDeliveryDecisionRef,
} from "../../src/recovery/recovery-delivery-repository.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const PACKET_HASH = "a".repeat(64);
const SLICE_A = "b".repeat(64);
const SLICE_B = "c".repeat(64);
const EVIDENCE_A = "d".repeat(64);
const SOURCE_A = "e".repeat(64);
const SOURCE_B = "f".repeat(64);
const SHA_A = "1".repeat(40);
const SHA_B = "2".repeat(40);
const TREE_A = "3".repeat(40);
const TREE_B = "4".repeat(40);

function finding(input: Readonly<{
  sliceHash?: string;
  sha?: string;
  treeHash?: string;
  sourceHash?: string;
  invariant?: string;
  predicate?: string;
}> = {}) {
  return createFindingSetV1({
    runId: "run-recovery-delivery",
    storyId: "US-001",
    packetHash: PACKET_HASH,
    sliceHash: input.sliceHash ?? SLICE_A,
    sourceRevision: { sha: input.sha ?? SHA_A, treeHash: input.treeHash ?? TREE_A },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: input.invariant ?? "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: input.sourceHash ?? SOURCE_A }],
      observedEvidenceRefs: [EVIDENCE_A],
      expectedPredicateRef: input.predicate ?? "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(findingSet: ReturnType<typeof finding>): RecoveryCaseDraftV1 {
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((item) => item.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
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
  };
}

describe("revisioned recovery dispatch delivery", () => {
  let database: TestDatabase;
  let findings: ReturnType<typeof createFindingRecoveryRepository>;
  let deliveries: ReturnType<typeof createRecoveryDeliveryRepository>;

  before(async () => {
    database = await createIsolatedTestDatabase();
    findings = createFindingRecoveryRepository(database.sql);
    deliveries = createRecoveryDeliveryRepository(database.sql);
  });

  after(async () => database.cleanup());

  it("creates an exact initial revision and atomically authorizes a durable delivery", async () => {
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'recovery delivery test', 'running', 'v3', 1, $2, $3, $4, $5)`,
      ["run-recovery-delivery", releaseSha, PACKET_HASH, "5".repeat(64), releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status
       ) VALUES ($1, $2, 1, $3, 'Recovery delivery story', 'failed')`,
      ["story-recovery-delivery", "run-recovery-delivery", "US-001"],
    );
    const firstFinding = finding();
    await findings.putFindingSet(firstFinding);
    const opened = await findings.openRecoveryCase(recoveryDraft(firstFinding), {
      now: new Date("2026-07-13T08:00:00.000Z"),
      evidencePlanArtifactHash: EVIDENCE_A,
    });
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    assert.equal(revision.revisionNumber, 1);
    assert.equal(revision.parentRevisionId, undefined);
    assert.equal(revision.findingSetHash, firstFinding.findingSetHash);
    assert.equal(revision.evidencePlanArtifactHash, EVIDENCE_A);

    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
    }, { now: new Date("2026-07-13T08:01:00.000Z") });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected authorization");
    assert.equal(authorized.delivery.state, "authorized");
    assert.equal(authorized.delivery.attemptId, undefined);
    assert.equal(authorized.dispatch.revisionId, revision.revisionId);

    const rows = await database.sql<Array<{ dispatches: number; deliveries: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM recovery_revision_dispatches
          WHERE dispatch_id = ${authorized.dispatch.dispatchId}) AS dispatches,
        (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries
          WHERE dispatch_id = ${authorized.dispatch.dispatchId}) AS deliveries
    `;
    assert.deepEqual(rows[0], { dispatches: 1, deliveries: 1 });

    const duplicate = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: authorized.stateVersion,
      dispatchClass: "product_implementation",
    });
    assert.equal(duplicate.status, "duplicate");
  });

  it("fails closed on missing, duplicate, or non-failed canonical story rows before dispatch replay", async () => {
    const currentCase = await database.sql<Array<{
      recovery_case_id: string;
      current_revision_id: string;
      state_version: number;
      used_implement: number;
    }>>`
      SELECT recovery_case_id, current_revision_id, state_version, used_implement
        FROM recovery_cases
       WHERE run_id = 'run-recovery-delivery' AND story_id = 'US-001'
    `;
    assert.equal(currentCase.length, 1);
    const recovery = currentCase[0]!;
    const authorize = () => deliveries.authorizeCurrentRevision({
      recoveryCaseId: recovery.recovery_case_id,
      revisionId: recovery.current_revision_id,
      expectedStateVersion: recovery.state_version,
      dispatchClass: "product_implementation",
    });

    await database.sql`
      UPDATE stories SET status = 'running' WHERE id = 'story-recovery-delivery'
    `;
    await assert.rejects(authorize(), /RECOVERY_DISPATCH_STORY_NOT_FAILED:running/);

    await database.sql`
      DELETE FROM stories WHERE id = 'story-recovery-delivery'
    `;
    await assert.rejects(authorize(), /RECOVERY_DISPATCH_STORY_CARDINALITY_INVALID:0/);

    await database.sql.unsafe(
      `INSERT INTO stories (id, run_id, story_index, story_id, title, status)
       VALUES ($1, $2, 1, $3, 'Recovery delivery story', 'failed'),
              ($4, $2, 2, $3, 'Duplicate recovery delivery story', 'failed')`,
      ["story-recovery-delivery", "run-recovery-delivery", "US-001", "story-recovery-delivery-duplicate"],
    );
    await assert.rejects(authorize(), /RECOVERY_DISPATCH_STORY_CARDINALITY_INVALID:2/);
    await database.sql`
      DELETE FROM stories WHERE id = 'story-recovery-delivery-duplicate'
    `;

    const unchanged = await database.sql<Array<{
      state_version: number;
      used_implement: number;
      dispatches: number;
      deliveries: number;
    }>>`
      SELECT recovery.state_version,
             recovery.used_implement,
             (SELECT COUNT(*)::integer FROM recovery_revision_dispatches
               WHERE recovery_case_id = recovery.recovery_case_id) AS dispatches,
             (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries
               WHERE recovery_case_id = recovery.recovery_case_id) AS deliveries
        FROM recovery_cases recovery
       WHERE recovery.recovery_case_id = ${recovery.recovery_case_id}
    `;
    assert.deepEqual({ ...unchanged[0] }, {
      state_version: recovery.state_version,
      used_implement: recovery.used_implement,
      dispatches: 1,
      deliveries: 1,
    });
  });

  it("leases one authorized dispatch once and recovers an expired pre-attempt lease", async () => {
    const currentCase = await database.sql<Array<{ recovery_case_id: string }>>`
      SELECT recovery_case_id FROM recovery_cases
       WHERE run_id = 'run-recovery-delivery' AND story_id = 'US-001'
       LIMIT 1
    `;
    const recoveryCaseId = currentCase[0]!.recovery_case_id;
    const now = new Date("2026-07-13T08:02:00.000Z");
    const [first, raced] = await Promise.all([
      deliveries.leaseNext({ ownerInstanceId: "worker-a", runId: "run-recovery-delivery", storyId: "US-001", leaseMs: 1_000 }, { now }),
      deliveries.leaseNext({ ownerInstanceId: "worker-b", runId: "run-recovery-delivery", storyId: "US-001", leaseMs: 1_000 }, { now }),
    ]);
    assert.equal([first, raced].filter(Boolean).length, 1);
    const leased = first ?? raced!;
    assert.equal(leased.state, "leased");

    const beforeExpiry = await deliveries.leaseNext({
      ownerInstanceId: "worker-c",
      runId: "run-recovery-delivery",
      storyId: "US-001",
      leaseMs: 1_000,
    }, { now: new Date("2026-07-13T08:02:00.500Z") });
    assert.equal(beforeExpiry, undefined);

    const recovered = await deliveries.leaseNext({
      ownerInstanceId: "worker-c",
      runId: "run-recovery-delivery",
      storyId: "US-001",
      leaseMs: 1_000,
    }, { now: new Date("2026-07-13T08:02:02.000Z") });
    assert.ok(recovered);
    assert.equal(recovered.dispatchId, leased.dispatchId);
    assert.equal(recovered.ownerInstanceId, "worker-c");
    assert.notEqual(recovered.leaseToken, leased.leaseToken);

    const blocked = await deliveries.completeDelivery({
      dispatchId: recovered.dispatchId,
      revisionId: recovered.revisionId,
      state: "blocked",
      terminalResult: { reasonCode: "test_pre_attempt_crash_recovered" },
    }, { now: new Date("2026-07-13T08:02:03.000Z") });
    assert.equal(blocked?.state, "blocked");
    assert.equal(await deliveries.findActiveForStory({ runId: "run-recovery-delivery", storyId: "US-001" }), undefined);
    assert.ok(recoveryCaseId);
  });

  it("advances source/finding identity without resetting the case budget, then authorizes supervisor ownership", async () => {
    const caseRows = await database.sql<Array<{ recovery_case_id: string; state_version: number; used_implement: number }>>`
      SELECT recovery_case_id, state_version, used_implement
        FROM recovery_cases
       WHERE run_id = 'run-recovery-delivery' AND story_id = 'US-001'
       LIMIT 1
    `;
    const current = await deliveries.findCurrentRevision(caseRows[0]!.recovery_case_id);
    assert.ok(current);
    const nextFinding = finding({
      sliceHash: SLICE_B,
      sha: SHA_B,
      treeHash: TREE_B,
      sourceHash: SOURCE_B,
    });
    await findings.putFindingSet(nextFinding);
    const advanced = await deliveries.advanceRevision({
      recoveryCaseId: current.recoveryCaseId,
      expectedStateVersion: caseRows[0]!.state_version,
      parentRevisionId: current.revisionId,
      findingSetHash: nextFinding.findingSetHash,
      owner: "supervisor",
      expectedDelta: {
        kind: "source_change",
        invariantRefs: ["INV_SAVE_RELOAD"],
        requiredPaths: ["src/App.tsx"],
      },
      allowedPaths: ["src/App.tsx"],
      evidencePlan: ["EVID_SAVE_RELOAD"],
      evidencePlanArtifactHash: SOURCE_B,
      decisionRef: recoveryDeliveryDecisionRef({ reason: "product repair evidence still failed" }),
    }, { now: new Date("2026-07-13T08:03:00.000Z") });
    assert.equal(advanced.status, "advanced");
    if (advanced.status !== "advanced") throw new Error("expected revision advance");
    assert.equal(advanced.revision.revisionNumber, 2);
    assert.equal(advanced.revision.parentRevisionId, current.revisionId);
    assert.equal(advanced.revision.sourceRevision.treeHash, TREE_B);

    const budgetRows = await database.sql<Array<{ used_implement: number; used_supervisor_repair: number }>>`
      SELECT used_implement, used_supervisor_repair FROM recovery_cases
       WHERE recovery_case_id = ${current.recoveryCaseId}
    `;
    assert.deepEqual(budgetRows[0], { used_implement: 1, used_supervisor_repair: 0 });

    const supervisor = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: current.recoveryCaseId,
      revisionId: advanced.revision.revisionId,
      expectedStateVersion: advanced.stateVersion,
      dispatchClass: "supervisor_repair",
    });
    assert.equal(supervisor.status, "authorized");
    if (supervisor.status !== "authorized") throw new Error("expected supervisor authorization");
    assert.equal(supervisor.dispatch.sourceRevision.treeHash, TREE_B);
    const finalBudget = await database.sql<Array<{ used_implement: number; used_supervisor_repair: number }>>`
      SELECT used_implement, used_supervisor_repair FROM recovery_cases
       WHERE recovery_case_id = ${current.recoveryCaseId}
    `;
    assert.deepEqual(finalBudget[0], { used_implement: 1, used_supervisor_repair: 1 });
  });

  it("binds one leased dispatch to one attempt atomically and keeps the dispatch replay idempotent", async () => {
    const leased = await deliveries.leaseNext({
      ownerInstanceId: "recovery-worker",
      runId: "run-recovery-delivery",
      storyId: "US-001",
      leaseMs: 60_000,
    }, { now: new Date("2026-07-13T08:04:00.000Z") });
    assert.ok(leased);
    const dispatch = await deliveries.findDispatch(leased.dispatchId);
    assert.ok(dispatch);
    const claimRows = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('run-recovery-delivery', 'implement', 'US-001', 'supervisor-repair-agent')
      RETURNING id::integer AS id
    `;
    const claimId = claimRows[0]!.id;
    const attemptRepository = createAttemptRepository(database.sql);
    const reservation = {
      claimId,
      runId: "run-recovery-delivery",
      stepId: "implement",
      storyId: "US-001",
      attemptClass: "supervisor_repair" as const,
      packetHash: dispatch.packetHash,
      compilationReportHash: "6".repeat(64),
      sliceHash: "5".repeat(64),
      sourceBefore: dispatch.sourceRevision,
      findingSetHash: dispatch.findingSetHash,
      recoveryCaseRevisionId: dispatch.revisionId,
      recoveryDispatchId: dispatch.dispatchId,
      recoveryDeliveryLease: {
        ownerInstanceId: leased.ownerInstanceId!,
        leaseToken: leased.leaseToken!,
      },
      role: "supervisor",
      agentId: "supervisor-repair-agent",
      branch: "story/us-001-recovery",
      worktree: ".worktrees/us-001-recovery",
      evidenceRefs: [`setfarm://claim-log/${claimId}`],
    };
    const reserved = await attemptRepository.reserve(reservation, {
      now: new Date("2026-07-13T08:04:01.000Z"),
    });
    assert.equal(reserved.status, "reserved");
    assert.equal(reserved.attempt.recoveryCaseRevisionId, dispatch.revisionId);
    assert.equal(reserved.attempt.recoveryDispatchId, dispatch.dispatchId);
    const boundDelivery = await deliveries.findDelivery(dispatch.dispatchId);
    assert.equal(boundDelivery?.state, "attempt_reserved");
    assert.equal(boundDelivery?.attemptId, reserved.attempt.attemptId);
    assert.equal(boundDelivery?.executionSliceHash, "5".repeat(64));

    const replay = await attemptRepository.reserve(reservation, {
      now: new Date("2026-07-13T08:04:02.000Z"),
    });
    assert.equal(replay.status, "duplicate");
    assert.equal(replay.attempt.attemptId, reserved.attempt.attemptId);
    const attemptRows = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM execution_attempts
       WHERE recovery_dispatch_id = ${dispatch.dispatchId}
    `;
    assert.equal(attemptRows[0]?.count, 1);

    const running = await deliveries.markRunning({
      dispatchId: dispatch.dispatchId,
      revisionId: dispatch.revisionId,
      attemptId: reserved.attempt.attemptId,
    }, { now: new Date("2026-07-13T08:04:03.000Z") });
    assert.equal(running?.state, "running");
    const completedAttempt = await attemptRepository.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      disposition: "failed",
      evidenceRefs: [],
    }, { now: new Date("2026-07-13T08:04:04.000Z") });
    assert.equal(completedAttempt.status, "completed");
    const failedDelivery = await deliveries.completeDelivery({
      dispatchId: dispatch.dispatchId,
      revisionId: dispatch.revisionId,
      attemptId: reserved.attempt.attemptId,
      state: "failed",
      terminalResult: { disposition: "failed" },
    }, { now: new Date("2026-07-13T08:04:05.000Z") });
    assert.equal(failedDelivery?.state, "failed");
  });
});
