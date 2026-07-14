import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  V3RecoveryClaimAuthorityError,
  V3RecoveryClaimHandoffV1Schema,
  createV3RecoveryClaimAuthority,
} from "../../src/recovery/v3-recovery-claim-authority.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const PACKET_HASH = "a".repeat(64);
const CONTRACT_SLICE_HASH = "b".repeat(64);
const EVIDENCE_HASH = "c".repeat(64);
const SOURCE_HASH = "d".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE = "2".repeat(40);

function finding(runId: string, storyId: string) {
  return createFindingSetV1({
    runId,
    storyId,
    packetHash: PACKET_HASH,
    sliceHash: CONTRACT_SLICE_HASH,
    sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: SOURCE_HASH }],
      observedEvidenceRefs: [EVIDENCE_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(
  findingSet: ReturnType<typeof finding>,
  dispatchClass: "product_implementation" | "supervisor_repair" | "evidence_only",
): RecoveryCaseDraftV1 {
  const sourceRepair = dispatchClass !== "evidence_only";
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((item) => item.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
    owner: dispatchClass === "product_implementation"
      ? "implement"
      : dispatchClass === "supervisor_repair"
        ? "supervisor"
        : "infrastructure",
    expectedDelta: sourceRepair
      ? {
          kind: "source_change",
          invariantRefs: ["INV_SAVE_RELOAD"],
          requiredPaths: ["src/App.tsx"],
        }
      : {
          kind: "evidence_refresh",
          predicateRefs: ["EVID_SAVE_RELOAD"],
        },
    allowedPaths: sourceRepair ? ["src/App.tsx"] : [],
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

describe("v3 recovery-first claim authority", () => {
  let database: TestDatabase;
  let sequence = 0;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  async function setup(
    dispatchClass: "product_implementation" | "supervisor_repair" | "evidence_only" = "product_implementation",
  ) {
    sequence += 1;
    const runId = `run-v3-claim-authority-${sequence}`;
    const storyId = `US-AUTH-${sequence}`;
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'authority test', 'running', 'v3', 1, $2, $3, $4, $5)`,
      [runId, releaseSha, PACKET_HASH, "e".repeat(64), releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (id, run_id, story_index, story_id, title, status)
       VALUES ($1, $2, 1, $3, 'Recovery authority story', 'failed')`,
      [`${runId}-story`, runId, storyId],
    );
    const findingSet = finding(runId, storyId);
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const opened = await findings.openRecoveryCase(recoveryDraft(findingSet, dispatchClass), {
      now: new Date("2026-07-13T09:00:00.000Z"),
    });
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass,
    }, { now: new Date("2026-07-13T09:00:01.000Z") });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected recovery authorization");
    return {
      runId,
      storyId,
      findingSet,
      recoveryCase: opened.recoveryCase,
      revision,
      dispatch: authorized.dispatch,
      delivery: authorized.delivery,
    };
  }

  it("excludes normal claims while any active recovery delivery owns the story", async () => {
    const fixture = await setup();
    const authority = createV3RecoveryClaimAuthority(database.sql);
    let operationCalled = false;

    await assert.rejects(
      authority.withNormalClaimAuthority({
        runId: fixture.runId,
        storyId: fixture.storyId,
      }, async () => {
        operationCalled = true;
      }),
      (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
        && error.code === "V3_NORMAL_CLAIM_BLOCKED_BY_RECOVERY",
    );
    assert.equal(operationCalled, false);

    sequence += 1;
    const clearRunId = `run-v3-claim-authority-${sequence}`;
    const clearStoryId = `US-AUTH-${sequence}`;
    const clearReleaseSha = "3".repeat(40);
    const clearReleaseAdmissionHash = await database.seedV3ReleaseGoAdmission(clearReleaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'normal authority', 'running', 'v3', 1, $2, $3, $4, $5)`,
      [clearRunId, clearReleaseSha, PACKET_HASH, "e".repeat(64), clearReleaseAdmissionHash],
    );
    const result = await authority.withNormalClaimAuthority({
      runId: clearRunId,
      storyId: clearStoryId,
    }, async (transaction) => {
      const rows = await transaction.unsafe<Array<{ protocol: string }>>(
        "SELECT protocol FROM runs WHERE id = $1",
        [clearRunId],
      );
      return rows[0]?.protocol;
    });
    assert.equal(result, "v3");
  });

  it("serializes concurrent model claimers and derives all authority from the ledger", async () => {
    const fixture = await setup("supervisor_repair");
    const authority = createV3RecoveryClaimAuthority(database.sql);
    const now = new Date("2026-07-13T09:01:00.000Z");
    const raced = await Promise.allSettled([
      authority.acquireRecoveryClaim({
        runId: fixture.runId,
        storyId: fixture.storyId,
        ownerInstanceId: "worker-a",
        leaseMs: 60_000,
      }, { now }),
      authority.acquireRecoveryClaim({
        runId: fixture.runId,
        storyId: fixture.storyId,
        ownerInstanceId: "worker-b",
        leaseMs: 60_000,
      }, { now }),
    ]);
    const fulfilled = raced.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof authority.acquireRecoveryClaim>>> =>
      result.status === "fulfilled");
    const rejected = raced.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0]!.reason instanceof V3RecoveryClaimAuthorityError, true);
    assert.equal(rejected[0]!.reason.code, "V3_RECOVERY_LEASE_HELD");

    const handoff = fulfilled[0]!.value;
    assert.equal(V3RecoveryClaimHandoffV1Schema.safeParse(handoff).success, true);
    assert.equal(handoff.status, "lease_acquired");
    assert.equal(handoff.dispatchClass, "supervisor_repair");
    assert.equal(handoff.directive.findingSetHash, fixture.findingSet.findingSetHash);
    assert.deepEqual(handoff.directive.findingIds, fixture.findingSet.findings.map((item) => item.findingId));
    assert.deepEqual(handoff.directive.allowedPaths, ["src/App.tsx"]);
    assert.equal(handoff.reservationBoundary.leaseAndAttemptAtomicInThisModule, false);
    assert.equal(handoff.reservationBoundary.state, "lease_acquired_attempt_not_reserved");

    await assert.rejects(
      authority.acquireRecoveryClaim({
        runId: fixture.runId,
        storyId: fixture.storyId,
        ownerInstanceId: handoff.lease.ownerInstanceId,
        leaseMs: 60_000,
        allowedPaths: ["src/override.ts"],
      }, { now }),
    );
  });

  it("reissues an exact unreserved lease and permits takeover only after expiry", async () => {
    const fixture = await setup();
    const authority = createV3RecoveryClaimAuthority(database.sql);
    const first = await authority.acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: "lease-owner-a",
      leaseMs: 1_000,
    }, { now: new Date("2026-07-13T09:02:00.000Z") });
    const replay = await authority.acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: "lease-owner-a",
      continuation: {
        kind: "unreserved_lease",
        leaseToken: first.lease.leaseToken,
      },
    }, { now: new Date("2026-07-13T09:02:00.500Z") });
    assert.equal(replay.status, "lease_reissued");
    assert.deepEqual(replay.lease, first.lease);

    await assert.rejects(
      authority.acquireRecoveryClaim({
        runId: fixture.runId,
        storyId: fixture.storyId,
        ownerInstanceId: "lease-owner-b",
      }, { now: new Date("2026-07-13T09:02:00.750Z") }),
      (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
        && error.code === "V3_RECOVERY_LEASE_HELD",
    );
    const takeover = await authority.acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: "lease-owner-b",
      leaseMs: 2_000,
    }, { now: new Date("2026-07-13T09:02:02.000Z") });
    assert.equal(takeover.status, "lease_acquired");
    assert.equal(takeover.lease.ownerInstanceId, "lease-owner-b");
    assert.notEqual(takeover.lease.leaseToken, first.lease.leaseToken);
  });

  it("allows only the same owner and exact attempt to reissue an attempt-bound claim", async () => {
    const fixture = await setup();
    const authority = createV3RecoveryClaimAuthority(database.sql);
    const leased = await authority.acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: "attempt-owner",
      leaseMs: 60_000,
    }, { now: new Date("2026-07-13T09:03:00.000Z") });
    const claimRows = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${fixture.runId}, 'implement', ${fixture.storyId}, 'recovery-agent')
      RETURNING id::integer AS id
    `;
    const claimId = claimRows[0]!.id;
    const reserved = await createAttemptRepository(database.sql).reserve({
      claimId,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      attemptClass: "product_implementation",
      packetHash: leased.directive.packetHash,
      compilationReportHash: "f".repeat(64),
      sliceHash: "9".repeat(64),
      sourceBefore: leased.directive.sourceRevision,
      findingSetHash: leased.directive.findingSetHash,
      recoveryCaseRevisionId: leased.revisionId,
      recoveryDispatchId: leased.dispatchId,
      recoveryDeliveryLease: {
        ownerInstanceId: leased.lease.ownerInstanceId,
        leaseToken: leased.lease.leaseToken,
      },
      role: "developer",
      agentId: "recovery-agent",
      evidenceRefs: [`setfarm://claim-log/${claimId}`],
    }, { now: new Date("2026-07-13T09:03:01.000Z") });
    assert.equal(reserved.status, "reserved");

    const replay = await authority.acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: "attempt-owner",
      continuation: { kind: "attempt", attemptId: reserved.attempt.attemptId },
    }, { now: new Date("2026-07-13T09:03:02.000Z") });
    assert.equal(replay.status, "attempt_bound_reissue");
    assert.equal(replay.attemptBinding?.attemptId, reserved.attempt.attemptId);
    assert.equal(replay.attemptBinding?.claimId, claimId);
    assert.equal(replay.reservationBoundary.requiredNextOperation, "resume_exact_attempt_only");

    await assert.rejects(
      authority.acquireRecoveryClaim({
        runId: fixture.runId,
        storyId: fixture.storyId,
        ownerInstanceId: "other-owner",
        continuation: { kind: "attempt", attemptId: reserved.attempt.attemptId },
      }),
      (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
        && error.code === "V3_RECOVERY_ATTEMPT_BOUND_CONFLICT",
    );
    await assert.rejects(
      authority.acquireRecoveryClaim({
        runId: fixture.runId,
        storyId: fixture.storyId,
        ownerInstanceId: "attempt-owner",
        continuation: { kind: "attempt", attemptId: `ATT_${"x".repeat(16)}` },
      }),
      (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
        && error.code === "V3_RECOVERY_ATTEMPT_BOUND_CONFLICT",
    );
  });

  it("never turns evidence-only delivery into a model claim", async () => {
    const fixture = await setup("evidence_only");
    const authority = createV3RecoveryClaimAuthority(database.sql);
    await assert.rejects(
      authority.acquireRecoveryClaim({
        runId: fixture.runId,
        storyId: fixture.storyId,
        ownerInstanceId: "model-worker",
      }, { now: new Date("2026-07-13T09:04:00.000Z") }),
      (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
        && error.code === "V3_RECOVERY_EVIDENCE_ONLY_NO_MODEL_CLAIM",
    );
    const delivery = await createRecoveryDeliveryRepository(database.sql)
      .findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "authorized");
    assert.equal(delivery?.ownerInstanceId, undefined);
  });
});
