import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { ensureCompilerClaimFence } from "../../src/execution/compiler-claim-fence.js";
import { publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { withdrawPreDispatchClaimInTransaction } from "../../src/execution/pre-dispatch-withdrawal-authority.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  createV3RecoveryClaimAuthority,
  v3RecoveryStoryLockIdentity,
} from "../../src/recovery/v3-recovery-claim-authority.js";
import { createV3RecoveryLifecycleReconciler } from "../../src/recovery/v3-recovery-lifecycle-reconciler.js";
import { createV3RecoveryOwnerLeaseRepository } from "../../src/recovery/v3-recovery-owner-lease.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const PACKET_HASH = "a".repeat(64);
const SLICE_HASH = "b".repeat(64);
const OBSERVATION_HASH = "c".repeat(64);
const CONTENT_HASH = "d".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE = "2".repeat(40);

function finding(runId: string, storyId: string) {
  return createFindingSetV1({
    runId,
    storyId,
    packetHash: PACKET_HASH,
    sliceHash: SLICE_HASH,
    sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: CONTENT_HASH }],
      observedEvidenceRefs: [OBSERVATION_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
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
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
}

describe("v3 recovery lifecycle reconciler", () => {
  let database: TestDatabase;
  let sequence = 0;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  async function setup() {
    sequence += 1;
    const runId = `run-v3-lifecycle-${sequence}`;
    const storyId = `US-LIFE-${sequence}`;
    const stepDbId = `step-v3-lifecycle-${sequence}`;
    const storyDbId = `story-v3-lifecycle-${sequence}`;
    const base = new Date(Date.now() + sequence * 1_000);
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'lifecycle reconciliation', 'running', 'v3', 1, $2, $3, $4, $5)`,
      [runId, releaseSha, PACKET_HASH, "e".repeat(64), releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type, current_story_id
       ) VALUES ($1, $2, 'implement', 'implement-agent', 5, '', '', 'pending', 'loop', NULL)`,
      [stepDbId, runId],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, description,
         acceptance_criteria, status
       ) VALUES ($1, $2, 1, $3, 'Lifecycle story', '', '[]', 'failed')`,
      [storyDbId, runId, storyId],
    );

    const findingSet = finding(runId, storyId);
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const opened = await findings.openRecoveryCase(recoveryDraft(findingSet), { now: base });
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
    }, { now: new Date(base.getTime() + 1_000) });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected recovery delivery authorization");
    return {
      runId,
      storyId,
      stepDbId,
      storyDbId,
      base,
      findingSet,
      revision,
      dispatch: authorized.dispatch,
      delivery: authorized.delivery,
      deliveries,
    };
  }

  async function lease(
    fixture: Awaited<ReturnType<typeof setup>>,
    input: Readonly<{ ownerInstanceId: string; leaseMs: number; now: Date }>,
  ) {
    return createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: input.ownerInstanceId,
      leaseMs: input.leaseMs,
    }, { now: input.now });
  }

  async function publish(
    fixture: Awaited<ReturnType<typeof setup>>,
    handoff: Awaited<ReturnType<typeof lease>>,
    input: Readonly<{ sessionId: string; now: Date }>,
  ) {
    const publication = await publishLoopClaimRuntime(database.sql, {
      runId: fixture.runId,
      stepDbId: fixture.stepDbId,
      workflowStepId: "implement",
      storyDbId: fixture.storyDbId,
      storyId: fixture.storyId,
      claimAgentId: "recovery-agent",
      parallelLimit: 1,
      recoveryHandoff: handoff,
      runtimeIntent: {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: input.sessionId,
        runtimeAgentId: "recovery-runtime-agent",
        runtimeKind: "local_process",
        ownerInstanceId: handoff.lease.ownerInstanceId,
      },
      now: input.now,
    });
    assert.ok(publication?.runtime);
    return publication;
  }

  async function reserveModelAttempt(
    fixture: Awaited<ReturnType<typeof setup>>,
    handoff: Awaited<ReturnType<typeof lease>>,
    input: Readonly<{ sessionId: string; now: Date; start?: boolean }>,
  ) {
    const publication = await publish(fixture, handoff, {
      sessionId: input.sessionId,
      now: input.now,
    });
    assert.ok(publication);
    const reservation = await createAttemptRepository(database.sql).reserve({
      claimId: publication!.claimId,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      attemptClass: "product_implementation",
      packetHash: handoff.directive.packetHash,
      compilationReportHash: "f".repeat(64),
      sliceHash: "9".repeat(64),
      sourceBefore: handoff.directive.sourceRevision,
      findingSetHash: handoff.directive.findingSetHash,
      recoveryCaseRevisionId: handoff.revisionId,
      recoveryDispatchId: handoff.dispatchId,
      recoveryDeliveryLease: {
        ownerInstanceId: handoff.lease.ownerInstanceId,
        leaseToken: handoff.lease.leaseToken,
      },
      role: "developer",
      agentId: "recovery-agent",
      evidenceRefs: [`setfarm://claim-log/${publication!.claimId}`],
    }, { now: new Date(input.now.getTime() + 100), leaseMs: 60_000 });
    assert.equal(reservation.status, "reserved");
    if (reservation.status !== "reserved") throw new Error("expected model attempt reservation");
    await createRuntimeSessionRepository(database.sql).bindAttempt({
      sessionId: input.sessionId,
      attemptId: reservation.attempt.attemptId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(input.now.getTime() + 200),
    });
    if (input.start !== false) {
      await createRuntimeSessionRepository(database.sql).markStarting({
        sessionId: input.sessionId,
        ownerInstanceId: handoff.lease.ownerInstanceId,
        recoveryFence: {
          revisionId: handoff.revisionId,
          dispatchId: handoff.dispatchId,
          leaseToken: handoff.lease.leaseToken,
          attempt: {
            attemptId: reservation.attempt.attemptId,
            generation: reservation.attempt.generation,
            fenceToken: reservation.attempt.fenceToken,
          },
        },
        now: new Date(input.now.getTime() + 300),
      });
    }
    return { publication: publication!, attempt: reservation.attempt };
  }

  async function expireDelivery(dispatchId: string): Promise<void> {
    const clocks = await database.sql<Array<{ wall_clock: Date }>>`
      SELECT clock_timestamp() AS wall_clock
    `;
    await database.sql`
      UPDATE recovery_dispatch_deliveries
         SET lease_expires_at = ${new Date(clocks[0]!.wall_clock.getTime() - 1_000)}
       WHERE dispatch_id = ${dispatchId}
    `;
  }

  async function expireModelOwner(dispatchId: string, attemptId: string): Promise<void> {
    await database.sql.begin(async (transaction) => {
      const clocks = await transaction.unsafe<Array<{ wall_clock: Date }>>(
        "SELECT clock_timestamp() AS wall_clock",
      );
      const anchor = clocks[0]!.wall_clock.getTime();
      const claimAt = new Date(anchor - 3_000);
      const startedAt = new Date(anchor - 2_000);
      const expiresAt = new Date(anchor - 1_000);
      await transaction.unsafe(
        `UPDATE claim_log claim
            SET claimed_at = $2
          WHERE claim.id = (SELECT attempt.claim_id FROM execution_attempts attempt WHERE attempt.attempt_id = $1)`,
        [attemptId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE stories story
            SET claimed_at = $2
           FROM execution_attempts attempt
          WHERE attempt.attempt_id = $1
            AND story.run_id = attempt.run_id
            AND story.story_id = attempt.story_id`,
        [attemptId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE runtime_sessions
            SET created_at = $2, heartbeat_at = $3, updated_at = $3
          WHERE attempt_id = $1`,
        [attemptId, claimAt, startedAt],
      );
      await transaction.unsafe(
        `UPDATE execution_attempts
            SET lease_acquired_at = $2, heartbeat_at = $2,
                lease_expires_at = $3, updated_at = $2
          WHERE attempt_id = $1`,
        [attemptId, startedAt, expiresAt],
      );
      await transaction.unsafe(
        `UPDATE recovery_dispatch_deliveries
            SET started_at = $2, lease_expires_at = $3, updated_at = $2
          WHERE dispatch_id = $1`,
        [dispatchId, startedAt, expiresAt],
      );
    });
  }

  async function expireUnreservedPublication(dispatchId: string): Promise<void> {
    await database.sql.begin(async (transaction) => {
      const clocks = await transaction.unsafe<Array<{ wall_clock: Date }>>(
        "SELECT clock_timestamp() AS wall_clock",
      );
      const anchor = clocks[0]!.wall_clock.getTime();
      const deliveryAt = new Date(anchor - 4_000);
      const claimAt = new Date(anchor - 3_000);
      const expiresAt = new Date(anchor - 1_000);
      await transaction.unsafe(
        `UPDATE claim_log claim
            SET claimed_at = $2
           FROM recovery_dispatch_deliveries delivery
          WHERE delivery.dispatch_id = $1
            AND claim.run_id = delivery.run_id
            AND claim.story_id = delivery.story_id
            AND claim.outcome IS NULL`,
        [dispatchId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE stories story
            SET claimed_at = $2
           FROM recovery_dispatch_deliveries delivery
          WHERE delivery.dispatch_id = $1
            AND story.run_id = delivery.run_id
            AND story.story_id = delivery.story_id`,
        [dispatchId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE runtime_sessions runtime
            SET created_at = $2, heartbeat_at = $2, updated_at = $2
           FROM recovery_dispatch_deliveries delivery
          WHERE delivery.dispatch_id = $1
            AND runtime.run_id = delivery.run_id
            AND runtime.story_id = delivery.story_id
            AND runtime.state <> 'released'`,
        [dispatchId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE recovery_dispatch_deliveries
            SET lease_expires_at = $2, updated_at = $3
          WHERE dispatch_id = $1`,
        [dispatchId, expiresAt, deliveryAt],
      );
    });
  }

  async function waitForBlockedStoryAdvisory(minimum = 1): Promise<void> {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const rows = await database.sql<Array<{ blocked: number }>>`
        SELECT COUNT(*)::integer AS blocked
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%pg_advisory_xact_lock(hashtextextended($1, 0))%'
      `;
      if ((rows[0]?.blocked ?? 0) >= minimum) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`TEST_BARRIER_RECOVERY_ADVISORY_WAITERS_MISSING:${minimum}`);
  }

  async function holdStoryAdvisory(runId: string, storyId: string) {
    let entered!: () => void;
    let release!: () => void;
    const enteredGate = new Promise<void>((resolve) => { entered = resolve; });
    const releaseGate = new Promise<void>((resolve) => { release = resolve; });
    const done = database.sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        v3RecoveryStoryLockIdentity({ runId, storyId }),
      ]);
      entered();
      await releaseGate;
    });
    await enteredGate;
    return { release, done };
  }

  async function makeModelOwner(label: string, start = true) {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: `barrier-owner-${label}`,
      leaseMs: 120_000,
      now: leaseAt,
    });
    const safeLabel = label.replace(/[^A-Za-z0-9-]/g, "x").padEnd(20, "x").slice(0, 20);
    const sessionId = `RTS_${safeLabel}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start,
    });
    const recoveryFence = {
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      leaseToken: handoff.lease.leaseToken,
      attempt: {
        attemptId: bound.attempt.attemptId,
        generation: bound.attempt.generation,
        fenceToken: bound.attempt.fenceToken,
      },
    };
    const exact = {
      kind: "model_runtime" as const,
      runId: fixture.runId,
      storyId: fixture.storyId,
      claimId: bound.publication.claimId,
      claimAgentId: "recovery-agent",
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
      attempt: recoveryFence.attempt,
      runtimeSessionId: sessionId,
    };
    return {
      fixture,
      handoff,
      bound,
      sessionId,
      recoveryFence,
      exact,
      sessions: createRuntimeSessionRepository(database.sql),
      leases: createV3RecoveryOwnerLeaseRepository(database.sql),
    };
  }

  it("heartbeats runtime, attempt and delivery atomically and rejects a second owner", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "canonical-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"h".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    const heartbeatAt = new Date(leaseAt.getTime() + 1_000);
    const leases = createV3RecoveryOwnerLeaseRepository(database.sql);
    const exactInput = {
      kind: "model_runtime" as const,
      runId: fixture.runId,
      storyId: fixture.storyId,
      claimId: bound.publication.claimId,
      claimAgentId: "recovery-agent",
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
      attempt: {
        attemptId: bound.attempt.attemptId,
        generation: bound.attempt.generation,
        fenceToken: bound.attempt.fenceToken,
      },
      runtimeSessionId: sessionId,
    };
    const [retained, forged] = await Promise.all([
      leases.heartbeat(exactInput, { now: heartbeatAt, leaseMs: 120_000 }),
      leases.heartbeat({ ...exactInput, ownerInstanceId: "forged-second-owner" }, {
        now: heartbeatAt,
        leaseMs: 120_000,
      }),
    ]);
    assert.equal(retained.status, "retained");
    assert.equal(forged.status, "stale_fence");
    if (retained.status !== "retained") throw new Error("expected retained owner heartbeat");
    const rows = await database.sql.unsafe<Array<{
      runtime_heartbeat: Date;
      attempt_heartbeat: Date;
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT runtime.heartbeat_at AS runtime_heartbeat,
              attempt.heartbeat_at AS attempt_heartbeat,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM runtime_sessions runtime
         JOIN execution_attempts attempt ON attempt.attempt_id = runtime.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE runtime.session_id = $1`,
      [sessionId],
    );
    assert.equal(rows[0]?.runtime_heartbeat.toISOString(), rows[0]?.attempt_heartbeat.toISOString());
    assert.equal(rows[0]?.attempt_expiry.toISOString(), retained.expiresAt);
    assert.equal(rows[0]?.delivery_expiry.toISOString(), retained.expiresAt);
    assert.equal(
      rows[0]!.attempt_expiry.getTime() - rows[0]!.attempt_heartbeat.getTime(),
      120_000,
      "one fresh DB wall-clock instant must drive heartbeat and expiry",
    );
  });

  it("relinquishes only the exact active owner leases without terminalizing product state", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "relinquish-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"r".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: false,
    });
    const exact = {
      kind: "model_runtime" as const,
      runId: fixture.runId,
      storyId: fixture.storyId,
      claimId: bound.publication.claimId,
      claimAgentId: "recovery-agent",
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
      attempt: {
        attemptId: bound.attempt.attemptId,
        generation: bound.attempt.generation,
        fenceToken: bound.attempt.fenceToken,
      },
      runtimeSessionId: sessionId,
    };
    const repository = createV3RecoveryOwnerLeaseRepository(database.sql);
    for (const forged of [
      { ...exact, ownerInstanceId: "forged-owner" },
      { ...exact, leaseToken: "forged-lease-token-000000" },
      { ...exact, claimAgentId: "forged-claim-agent" },
      { ...exact, claimId: exact.claimId + 100_000 },
      { ...exact, revisionId: `RREV_${"0".repeat(64)}` },
      { ...exact, dispatchId: `RDISP_${"0".repeat(64)}` },
      { ...exact, runtimeSessionId: `RTS_${"x".repeat(20)}-${sequence}` },
      { ...exact, attempt: { ...exact.attempt, attemptId: `ATT_${"x".repeat(20)}` } },
      { ...exact, attempt: { ...exact.attempt, generation: exact.attempt.generation + 1 } },
      { ...exact, attempt: { ...exact.attempt, fenceToken: "forged-fence-token-000000" } },
    ]) {
      assert.equal((await repository.relinquish(forged)).status, "stale_fence");
    }

    const result = await repository.relinquish(exact);
    assert.equal(result.status, "relinquished");
    if (result.status !== "relinquished") throw new Error("expected exact relinquish");
    const rows = await database.sql.unsafe<Array<{
      claim_outcome: string | null;
      story_status: string;
      step_status: string;
      attempt_disposition: string;
      delivery_state: string;
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT claim.outcome AS claim_outcome, story.status AS story_status,
              step.status AS step_status, attempt.disposition AS attempt_disposition,
              delivery.state AS delivery_state,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM claim_log claim
         JOIN stories story ON story.run_id = claim.run_id AND story.story_id = claim.story_id
         JOIN steps step ON step.run_id = claim.run_id AND step.step_id = claim.step_id
         JOIN execution_attempts attempt ON attempt.claim_id = claim.id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE claim.id = $1`,
      [exact.claimId],
    );
    assert.deepEqual({
      claimOutcome: rows[0]?.claim_outcome,
      storyStatus: rows[0]?.story_status,
      stepStatus: rows[0]?.step_status,
      attemptDisposition: rows[0]?.attempt_disposition,
      deliveryState: rows[0]?.delivery_state,
    }, {
      claimOutcome: null,
      storyStatus: "running",
      stepStatus: "running",
      attemptDisposition: "claimed",
      deliveryState: "attempt_reserved",
    });
    assert.equal(rows[0]?.attempt_expiry.toISOString(), result.relinquishedAt);
    assert.equal(rows[0]?.delivery_expiry.toISOString(), result.relinquishedAt);
  });

  it("hard-fences runtime start in both orders around exact relinquish", async () => {
    const relinquishFirst = await makeModelOwner("relinquish-first", false);
    const firstBarrier = await holdStoryAdvisory(
      relinquishFirst.fixture.runId,
      relinquishFirst.fixture.storyId,
    );
    const relinquishPending = relinquishFirst.leases.relinquish(relinquishFirst.exact);
    await waitForBlockedStoryAdvisory(1);
    const startPending = relinquishFirst.sessions.markStarting({
      sessionId: relinquishFirst.sessionId,
      ownerInstanceId: relinquishFirst.handoff.lease.ownerInstanceId,
      recoveryFence: relinquishFirst.recoveryFence,
    });
    await waitForBlockedStoryAdvisory(2);
    firstBarrier.release();
    await firstBarrier.done;
    assert.equal((await relinquishPending).status, "relinquished");
    await assert.rejects(startPending, /RUNTIME_SESSION_RECOVERY_ATTEMPT_FENCE_STALE/);

    const startFirst = await makeModelOwner("start-first", false);
    const secondBarrier = await holdStoryAdvisory(startFirst.fixture.runId, startFirst.fixture.storyId);
    const startFirstPending = startFirst.sessions.markStarting({
      sessionId: startFirst.sessionId,
      ownerInstanceId: startFirst.handoff.lease.ownerInstanceId,
      recoveryFence: startFirst.recoveryFence,
    });
    await waitForBlockedStoryAdvisory(1);
    const relinquishSecondPending = startFirst.leases.relinquish(startFirst.exact);
    await waitForBlockedStoryAdvisory(2);
    secondBarrier.release();
    await secondBarrier.done;
    assert.equal((await startFirstPending).state, "starting");
    assert.equal((await relinquishSecondPending).status, "relinquished");
    await assert.rejects(
      startFirst.sessions.markRunning({
        sessionId: startFirst.sessionId,
        ownerInstanceId: startFirst.handoff.lease.ownerInstanceId,
        recoveryFence: startFirst.recoveryFence,
      }),
      /RUNTIME_SESSION_RECOVERY_ATTEMPT_FENCE_STALE/,
    );
  });

  it("cannot revive a lease that expires while heartbeat or relinquish waits on the owner lock", async () => {
    const runBlockedExpiry = async (
      label: string,
      operation: (owner: Awaited<ReturnType<typeof makeModelOwner>>) => Promise<{ status: string }>,
    ) => {
      const owner = await makeModelOwner(label);
      const barrier = await holdStoryAdvisory(owner.fixture.runId, owner.fixture.storyId);
      await database.sql.begin(async (transaction) => {
        const times = await transaction.unsafe<Array<{ expires_at: Date }>>(
          "SELECT clock_timestamp() + INTERVAL '350 milliseconds' AS expires_at",
        );
        const expiresAt = times[0]!.expires_at;
        await transaction.unsafe(
          `UPDATE execution_attempts SET lease_expires_at = $2
            WHERE attempt_id = $1`,
          [owner.bound.attempt.attemptId, expiresAt],
        );
        await transaction.unsafe(
          `UPDATE recovery_dispatch_deliveries SET lease_expires_at = $2
            WHERE dispatch_id = $1`,
          [owner.handoff.dispatchId, expiresAt],
        );
      });
      const pending = operation(owner);
      await waitForBlockedStoryAdvisory(1);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      barrier.release();
      await barrier.done;
      const result = await pending;
      assert.equal(result.status, "stale_fence");
      const rows = await database.sql.unsafe<Array<{
        attempt_expiry: Date;
        delivery_expiry: Date;
        db_now: Date;
      }>>(
        `SELECT attempt.lease_expires_at AS attempt_expiry,
                delivery.lease_expires_at AS delivery_expiry,
                clock_timestamp() AS db_now
           FROM execution_attempts attempt
           JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
          WHERE attempt.attempt_id = $1`,
        [owner.bound.attempt.attemptId],
      );
      assert.ok(rows[0]!.attempt_expiry.getTime() <= rows[0]!.db_now.getTime());
      assert.equal(rows[0]!.attempt_expiry.toISOString(), rows[0]!.delivery_expiry.toISOString());
    };

    await runBlockedExpiry("heartbeat-expiry", (owner) => owner.leases.heartbeat(
      owner.exact,
      { now: new Date("2000-01-01T00:00:00.000Z"), leaseMs: 120_000 },
    ));
    await runBlockedExpiry("relinquish-expiry", (owner) => owner.leases.relinquish(owner.exact));
  });

  it("linearizes simultaneous relinquish before heartbeat to one durable owner outcome", async () => {
    const owner = await makeModelOwner("heartbeat-relinquish");
    const barrier = await holdStoryAdvisory(owner.fixture.runId, owner.fixture.storyId);
    const relinquishPending = owner.leases.relinquish(owner.exact);
    await waitForBlockedStoryAdvisory(1);
    const heartbeatPending = owner.leases.heartbeat(owner.exact, {
      now: new Date("2000-01-01T00:00:00.000Z"),
      leaseMs: 120_000,
    });
    await waitForBlockedStoryAdvisory(2);
    barrier.release();
    await barrier.done;
    assert.equal((await relinquishPending).status, "relinquished");
    assert.equal((await heartbeatPending).status, "stale_fence");
  });

  it("relinquishes every nonreleased recovery runtime state without mutating product state", async () => {
    for (const state of ["running", "drain_requested", "drained", "quarantined"] as const) {
      const owner = await makeModelOwner(`state-${state}`);
      if (state === "running") {
        assert.equal((await owner.sessions.markRunning({
          sessionId: owner.sessionId,
          ownerInstanceId: owner.handoff.lease.ownerInstanceId,
          recoveryFence: owner.recoveryFence,
        })).status, "running");
      }
      if (["drain_requested", "drained"].includes(state)) {
        assert.equal((await owner.sessions.requestDrain({
          sessionId: owner.sessionId,
          ownerInstanceId: owner.handoff.lease.ownerInstanceId,
          diagnostic: `fixture ${state}`,
        })).state, "drain_requested");
      }
      if (state === "drained") {
        assert.equal((await owner.sessions.markDrained({
          sessionId: owner.sessionId,
          ownerInstanceId: owner.handoff.lease.ownerInstanceId,
          evidence: {
            schema: "setfarm.runtime-drain-evidence.v1",
            observedAt: new Date().toISOString(),
            localProcessAbsent: true,
            openClawTaskAbsent: true,
            workspaceProcessAbsent: true,
            stableObservations: 2,
            evidenceRefs: ["setfarm://test/relinquish-state-matrix"],
          },
        })).state, "drained");
      }
      if (state === "quarantined") {
        const current = await owner.sessions.findById(owner.sessionId);
        assert.ok(current);
        assert.equal((await owner.sessions.quarantine({
          sessionId: owner.sessionId,
          expectedOwnerInstanceId: owner.handoff.lease.ownerInstanceId,
          expectedStateVersion: current.stateVersion,
          diagnostic: "fixture quarantined owner",
        })).state, "quarantined");
      }
      assert.equal((await owner.leases.relinquish(owner.exact)).status, "relinquished");
      const product = await database.sql.unsafe<Array<{
        claim_outcome: string | null;
        story_status: string;
      }>>(
        `SELECT claim.outcome AS claim_outcome, story.status AS story_status
           FROM claim_log claim
           JOIN stories story ON story.run_id = claim.run_id AND story.story_id = claim.story_id
          WHERE claim.id = $1`,
        [owner.exact.claimId],
      );
      assert.equal(product[0]?.claim_outcome, null);
      assert.equal(product[0]?.story_status, "running");
    }
  });

  it("blocks generic pre-dispatch withdrawal behind a foreign active recovery owner", async () => {
    const owner = await makeModelOwner("foreign-predispatch");
    // The partial unique index correctly prevents two open story claims. Model
    // the stale/foreign recovery envelope that this fence must reject by
    // closing its old claim while leaving the independently durable delivery
    // active, then publish the duplicate pre-dispatch claim.
    await database.sql`
      UPDATE claim_log
         SET outcome = 'infra_retry', abandoned_at = clock_timestamp()
       WHERE id = ${owner.exact.claimId}
    `;
    const duplicateClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (
        ${owner.fixture.runId}, 'implement', ${owner.fixture.storyId},
        'duplicate-agent', clock_timestamp()
      )
      RETURNING id::integer AS id
    `;
    const duplicateClaimId = duplicateClaims[0]!.id;
    await database.sql`
      UPDATE stories
         SET claimed_by = 'duplicate-agent', claimed_at = clock_timestamp(),
             claim_generation = claim_generation + 1
       WHERE id = ${owner.fixture.storyDbId}
    `;
    const duplicateRuntimeId = `RTS_${"d".repeat(20)}-${sequence}`;
    await createRuntimeSessionRepository(database.sql).reserve({
      sessionId: duplicateRuntimeId,
      runId: owner.fixture.runId,
      stepDbId: owner.fixture.stepDbId,
      workflowStepId: "implement",
      storyDbId: owner.fixture.storyDbId,
      storyId: owner.fixture.storyId,
      claimId: duplicateClaimId,
      claimAgentId: "duplicate-agent",
      runtimeAgentId: "duplicate-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "duplicate-owner",
    });

    await assert.rejects(
      database.sql.begin((transaction) => withdrawPreDispatchClaimInTransaction(transaction, {
        identity: {
          claimId: duplicateClaimId,
          runId: owner.fixture.runId,
          workflowStepId: "implement",
          storyId: owner.fixture.storyId,
          claimAgentId: "duplicate-agent",
          runtime: { sessionId: duplicateRuntimeId, ownerInstanceId: "duplicate-owner" },
        },
        outcome: "infra_retry",
        diagnostic: "generic duplicate must not steal a recovery-owned story",
      })),
      /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:recovery_dispatch/,
    );
    const state = await database.sql<Array<{
      claim_outcome: string | null;
      runtime_state: string;
      story_status: string;
      step_status: string;
    }>>`
      SELECT claim.outcome AS claim_outcome, runtime.state AS runtime_state,
             story.status AS story_status, step.status AS step_status
        FROM claim_log claim
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN stories story ON story.run_id = claim.run_id AND story.story_id = claim.story_id
        JOIN steps step ON step.run_id = claim.run_id AND step.step_id = claim.step_id
       WHERE claim.id = ${duplicateClaimId}
    `;
    assert.deepEqual({ ...state[0] }, {
      claim_outcome: null,
      runtime_state: "reserved",
      story_status: "running",
      step_status: "running",
    });
  });

  it("withdraws compiler duplicates but never resets product state owned by authorized or leased recovery", async () => {
    for (const deliveryState of ["authorized", "leased"] as const) {
      const fixture = await setup();
      if (deliveryState === "leased") {
        await lease(fixture, {
          ownerInstanceId: `compiler-foreign-${deliveryState}`,
          leaseMs: 120_000,
          now: new Date(Date.now() - 1_000),
        });
      }
      await database.sql.unsafe(
        `UPDATE stories
            SET status = 'running', claimed_by = 'duplicate-agent', claimed_at = clock_timestamp()
          WHERE id = $1`,
        [fixture.storyDbId],
      );
      await database.sql.unsafe(
        `UPDATE steps SET status = 'running', current_story_id = $2 WHERE id = $1`,
        [fixture.stepDbId, fixture.storyDbId],
      );
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${fixture.runId}, 'implement', ${fixture.storyId}, 'duplicate-agent', clock_timestamp())
        RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      const runtimeSessionId = `RTS_${deliveryState.padEnd(20, "x")}-${sequence}`;
      await createRuntimeSessionRepository(database.sql).reserve({
        sessionId: runtimeSessionId,
        runId: fixture.runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "implement",
        storyDbId: fixture.storyDbId,
        storyId: fixture.storyId,
        claimId,
        claimAgentId: "duplicate-agent",
        runtimeAgentId: "duplicate-runtime",
        runtimeKind: "local_process",
        ownerInstanceId: "duplicate-owner",
      });

      assert.deepEqual(await ensureCompilerClaimFence(database.sql, {
        claimId,
        runId: fixture.runId,
        stepId: "implement",
        storyId: fixture.storyId,
        storyDbId: fixture.storyDbId,
        claimAgentId: "duplicate-agent",
        diagnostic: "compiler duplicate observed a foreign recovery owner",
      }), {
        status: "blocked",
        reason: "COMPILER_CLAIM_FOREIGN_OWNER_RETAINED",
      });
      const state = await database.sql<Array<{
        story_status: string;
        step_status: string;
        current_story_id: string | null;
        claim_outcome: string | null;
        runtime_state: string;
        delivery_state: string;
      }>>`
        SELECT story.status AS story_status, step.status AS step_status,
               step.current_story_id, claim.outcome AS claim_outcome,
               runtime.state AS runtime_state, delivery.state AS delivery_state
          FROM stories story
          JOIN steps step ON step.run_id = story.run_id AND step.step_id = 'implement'
          JOIN claim_log claim ON claim.id = ${claimId}
          JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
          JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = ${fixture.dispatch.dispatchId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "running",
        step_status: "running",
        current_story_id: fixture.storyDbId,
        claim_outcome: "infra_retry",
        runtime_state: "released",
        delivery_state: deliveryState,
      });
    }
  });

  it("rolls back every owner heartbeat when the delivery fence update fails", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "heartbeat-rollback-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"r".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    const before = await database.sql.unsafe<Array<{
      runtime_heartbeat: Date;
      attempt_heartbeat: Date;
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT runtime.heartbeat_at AS runtime_heartbeat,
              attempt.heartbeat_at AS attempt_heartbeat,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM runtime_sessions runtime
         JOIN execution_attempts attempt ON attempt.attempt_id = runtime.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE runtime.session_id = $1`,
      [sessionId],
    );
    const functionName = `test_fail_owner_heartbeat_${sequence}`;
    const triggerName = `trg_fail_owner_heartbeat_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.lease_expires_at <> OLD.lease_expires_at THEN
             RAISE EXCEPTION 'TEST_FORCED_OWNER_HEARTBEAT_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON recovery_dispatch_deliveries
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        createV3RecoveryOwnerLeaseRepository(database.sql).heartbeat({
          kind: "model_runtime",
          runId: fixture.runId,
          storyId: fixture.storyId,
          claimId: bound.publication.claimId,
          claimAgentId: "recovery-agent",
          revisionId: handoff.revisionId,
          dispatchId: handoff.dispatchId,
          ownerInstanceId: handoff.lease.ownerInstanceId,
          leaseToken: handoff.lease.leaseToken,
          attempt: {
            attemptId: bound.attempt.attemptId,
            generation: bound.attempt.generation,
            fenceToken: bound.attempt.fenceToken,
          },
          runtimeSessionId: sessionId,
        }, { now: new Date(leaseAt.getTime() + 1_000), leaseMs: 120_000 }),
        /TEST_FORCED_OWNER_HEARTBEAT_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON recovery_dispatch_deliveries`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    const after = await database.sql.unsafe<typeof before>(
      `SELECT runtime.heartbeat_at AS runtime_heartbeat,
              attempt.heartbeat_at AS attempt_heartbeat,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM runtime_sessions runtime
         JOIN execution_attempts attempt ON attempt.attempt_id = runtime.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE runtime.session_id = $1`,
      [sessionId],
    );
    assert.deepEqual(
      Object.fromEntries(Object.entries(after[0]!).map(([key, value]) => [key, (value as Date).toISOString()])),
      Object.fromEntries(Object.entries(before[0]!).map(([key, value]) => [key, (value as Date).toISOString()])),
    );
  });

  it("rolls back exact relinquish atomically when the delivery lease update fails", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "relinquish-rollback-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"q".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: false,
    });
    const readLeases = () => database.sql.unsafe<Array<{
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM execution_attempts attempt
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE attempt.attempt_id = $1`,
      [bound.attempt.attemptId],
    );
    const before = await readLeases();
    const functionName = `test_fail_owner_relinquish_${sequence}`;
    const triggerName = `trg_fail_owner_relinquish_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.lease_expires_at <> OLD.lease_expires_at THEN
             RAISE EXCEPTION 'TEST_FORCED_OWNER_RELINQUISH_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON recovery_dispatch_deliveries
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        createV3RecoveryOwnerLeaseRepository(database.sql).relinquish({
          kind: "model_runtime",
          runId: fixture.runId,
          storyId: fixture.storyId,
          claimId: bound.publication.claimId,
          claimAgentId: "recovery-agent",
          revisionId: handoff.revisionId,
          dispatchId: handoff.dispatchId,
          ownerInstanceId: handoff.lease.ownerInstanceId,
          leaseToken: handoff.lease.leaseToken,
          attempt: {
            attemptId: bound.attempt.attemptId,
            generation: bound.attempt.generation,
            fenceToken: bound.attempt.fenceToken,
          },
          runtimeSessionId: sessionId,
        }),
        /TEST_FORCED_OWNER_RELINQUISH_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON recovery_dispatch_deliveries`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    const after = await readLeases();
    assert.deepEqual(
      after[0] && {
        attemptExpiry: after[0].attempt_expiry.toISOString(),
        deliveryExpiry: after[0].delivery_expiry.toISOString(),
      },
      before[0] && {
        attemptExpiry: before[0].attempt_expiry.toISOString(),
        deliveryExpiry: before[0].delivery_expiry.toISOString(),
      },
    );
  });

  it("drains and terminalizes one expired model owner exactly once across crash-boundary scans", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "expired-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"x".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    await expireModelOwner(handoff.dispatchId, bound.attempt.attemptId);
    const reconcileAt = new Date(leaseAt.getTime() + 70_000);
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);

    const drainReports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
    ]);
    const drainEvents = drainReports.flatMap((report) => report.events);
    assert.equal(drainReports.reduce((sum, report) => sum + report.counts.requestedRuntimeDrains, 0), 2);
    assert.equal(drainEvents.filter((event) => event.action === "request_runtime_drain" && event.mutated).length, 1);
    assert.equal(drainEvents.filter((event) => event.code === "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_DRAIN_PENDING").length, 1);
    assert.ok(drainEvents.every((event) => event.runtimeSessionId === sessionId));

    const pending = await createRuntimeSessionRepository(database.sql).findById(sessionId);
    assert.equal(pending?.state, "drain_requested");
    const stillOwned = await database.sql.unsafe<Array<{
      attempt_disposition: string;
      claim_outcome: string | null;
      delivery_state: string;
    }>>(
      `SELECT attempt.disposition AS attempt_disposition,
              claim.outcome AS claim_outcome,
              delivery.state AS delivery_state
         FROM execution_attempts attempt
         JOIN claim_log claim ON claim.id = attempt.claim_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE attempt.attempt_id = $1`,
      [bound.attempt.attemptId],
    );
    assert.deepEqual({ ...stillOwned[0]! }, {
      attempt_disposition: "claimed",
      claim_outcome: null,
      delivery_state: "attempt_reserved",
    }, "drain request does not expose or terminalize a runtime that may still exist");

    await createRuntimeSessionRepository(database.sql).markDrained({
      sessionId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(reconcileAt.getTime() + 1_000),
      evidence: {
        schema: "setfarm.runtime-drain-evidence.v1",
        observedAt: new Date(reconcileAt.getTime() + 1_000).toISOString(),
        localProcessAbsent: true,
        openClawTaskAbsent: true,
        workspaceProcessAbsent: true,
        stableObservations: 2,
        evidenceRefs: [
          `setfarm://v3-recovery-owner/${handoff.dispatchId}`,
          `setfarm://runtime-session/${sessionId}`,
        ],
      },
    });

    const terminalAt = new Date(reconcileAt.getTime() + 2_000);
    const terminalReports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: terminalAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: terminalAt }),
    ]);
    assert.equal(
      terminalReports.reduce((sum, report) => sum + report.counts.blockedExpiredModelAttempts, 0),
      1,
    );
    assert.equal(terminalReports.flatMap((report) => report.events)
      .filter((event) => event.action === "block_expired_model_attempt" && event.mutated).length, 1);

    const terminalRows = await database.sql.unsafe<Array<{
      attempt_disposition: string;
      claim_outcome: string | null;
      runtime_state: string;
      delivery_state: string;
      case_status: string;
      story_status: string;
      story_claimed_by: string | null;
      step_status: string;
      current_story_id: string | null;
    }>>(
      `SELECT attempt.disposition AS attempt_disposition,
              claim.outcome AS claim_outcome,
              runtime.state AS runtime_state,
              delivery.state AS delivery_state,
              recovery_case.status AS case_status,
              story.status AS story_status,
              story.claimed_by AS story_claimed_by,
              step.status AS step_status,
              step.current_story_id
         FROM execution_attempts attempt
         JOIN claim_log claim ON claim.id = attempt.claim_id
         JOIN runtime_sessions runtime ON runtime.attempt_id = attempt.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
         JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id = delivery.recovery_case_id
         JOIN stories story ON story.run_id = attempt.run_id AND story.story_id = attempt.story_id
         JOIN steps step ON step.id = runtime.step_db_id
        WHERE attempt.attempt_id = $1`,
      [bound.attempt.attemptId],
    );
    assert.deepEqual({ ...terminalRows[0]! }, {
      attempt_disposition: "inconclusive",
      claim_outcome: "infra_retry",
      runtime_state: "released",
      delivery_state: "blocked",
      case_status: "blocked",
      story_status: "failed",
      story_claimed_by: null,
      step_status: "running",
      current_story_id: null,
    });
    const replay = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(terminalAt.getTime() + 1_000) },
    );
    assert.equal(replay.counts.scanned, 0, "terminal owner is never sent through recovery again");
  });

  it("blocks the exact owner chain when runtime absence proof is quarantined", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "quarantined-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"q".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    await expireModelOwner(handoff.dispatchId, bound.attempt.attemptId);
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const expiredAt = new Date(leaseAt.getTime() + 70_000);
    const requested = await reconciler.reconcileActive({ runId: fixture.runId }, { now: expiredAt });
    assert.equal(requested.counts.requestedRuntimeDrains, 1);
    const sessions = createRuntimeSessionRepository(database.sql);
    const observedRuntime = await sessions.findById(sessionId);
    assert.ok(observedRuntime);
    await sessions.quarantine({
      sessionId,
      expectedOwnerInstanceId: observedRuntime.ownerInstanceId,
      expectedStateVersion: observedRuntime.stateVersion,
      diagnostic: "TEST_RUNTIME_ABSENCE_NOT_PROVEN",
      evidence: { localProcessAbsent: false },
      now: new Date(expiredAt.getTime() + 1_000),
    });
    const blocked = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(expiredAt.getTime() + 2_000) },
    );
    assert.equal(blocked.counts.blockedExpiredModelAttempts, 1);
    assert.equal(blocked.events[0]?.code, "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_QUARANTINED");
    assert.equal((await createRuntimeSessionRepository(database.sql).findById(sessionId))?.state, "quarantined");
    assert.equal((await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId))?.state, "blocked");
  });

  it("terminalizes an expired attempt-bound reserved runtime with no-spawn proof", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "reserved-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"z".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: false,
    });
    await expireModelOwner(handoff.dispatchId, bound.attempt.attemptId);
    const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 70_000) },
    );
    assert.equal(report.counts.blockedExpiredModelAttempts, 1);
    const runtime = await createRuntimeSessionRepository(database.sql).findById(sessionId);
    assert.equal(runtime?.state, "released");
    assert.equal(runtime?.drainEvidence.schema, "setfarm.no-spawn-release-evidence.v1");
  });

  it("repairs an acquire/post-lease-validation crash exactly once under concurrent scans", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, { ownerInstanceId: "lease-race-owner", leaseMs: 60_000, now: leaseAt });
    await expireDelivery(handoff.dispatchId);
    const reconcileAt = new Date(leaseAt.getTime() + 2_000);
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);

    const reports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
    ]);
    const events = reports.flatMap((report) => report.events);
    assert.equal(
      reports.reduce((sum, report) => sum + report.counts.resetExpiredLeases, 0),
      1,
      JSON.stringify(events),
    );
    assert.equal(events.filter((item) => item.mutated).length, 1);
    assert.ok(events.some((item) => item.code === "V3_RECOVERY_LIFECYCLE_AUTHORIZED_CONSISTENT"));

    const delivery = await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "authorized");
    assert.equal(delivery?.ownerInstanceId, undefined);
    assert.equal(delivery?.leaseToken, undefined);
    assert.equal(delivery?.leaseExpiresAt, undefined);
    const attempts = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM execution_attempts
       WHERE recovery_dispatch_id = ${fixture.dispatch.dispatchId}
    `;
    assert.equal(attempts[0]?.count, 0, "reconciliation never fabricates an attempt");
  });

  it("rolls lifecycle mutation back when its canonical outbox evidence cannot commit", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "atomic-outbox-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    await expireDelivery(handoff.dispatchId);
    const reconcileAt = new Date(leaseAt.getTime() + 2_000);
    const functionName = `test_fail_lifecycle_outbox_${sequence}`;
    const triggerName = `trg_fail_lifecycle_outbox_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.event_type = 'product_compiler.v3_recovery_lifecycle_reconciled' THEN
             RAISE EXCEPTION 'TEST_FORCED_LIFECYCLE_OUTBOX_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE INSERT ON operational_outbox
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
          { runId: fixture.runId },
          { now: reconcileAt },
        ),
        /TEST_FORCED_LIFECYCLE_OUTBOX_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON operational_outbox`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    const rolledBack = await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId);
    assert.equal(rolledBack?.state, "leased");
    assert.equal(rolledBack?.ownerInstanceId, handoff.lease.ownerInstanceId);
    assert.equal(rolledBack?.leaseToken, handoff.lease.leaseToken);
    assert.equal((await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM operational_outbox
       WHERE aggregate_id = ${fixture.runId}
         AND event_type = 'product_compiler.v3_recovery_lifecycle_reconciled'
    `)[0]?.count, 0);

    const committed = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: reconcileAt },
    );
    assert.equal(committed.counts.resetExpiredLeases, 1, JSON.stringify(committed.events));
    const evidence = await database.sql<Array<{ action: string; mutated: boolean }>>`
      SELECT payload->>'action' AS action,
             (payload->>'mutated')::boolean AS mutated
        FROM operational_outbox
       WHERE aggregate_id = ${fixture.runId}
         AND event_type = 'product_compiler.v3_recovery_lifecycle_reconciled'
    `;
    assert.deepEqual(evidence.map((row) => ({ ...row })), [{
      action: "reset_expired_lease",
      mutated: true,
    }]);
  });

  it("deduplicates repeated report-only evidence while its source row is unchanged", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    await lease(fixture, {
      ownerInstanceId: "stable-evidence-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const first = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 1_000) },
    );
    const second = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 2_000) },
    );
    assert.equal(first.events[0]?.code, "V3_RECOVERY_LIFECYCLE_LEASE_NOT_EXPIRED");
    assert.equal(second.events[0]?.code, "V3_RECOVERY_LIFECYCLE_LEASE_NOT_EXPIRED");
    assert.equal(first.events[0]?.observedAt, second.events[0]?.observedAt);

    const evidence = await database.sql<Array<{ count: number; keys: number }>>`
      SELECT COUNT(*)::integer AS count,
             COUNT(DISTINCT event_key)::integer AS keys
        FROM operational_outbox
       WHERE aggregate_id = ${fixture.runId}
         AND event_type = 'product_compiler.v3_recovery_lifecycle_reconciled'
    `;
    assert.deepEqual({ ...evidence[0]! }, { count: 1, keys: 1 });
  });

  it("rolls back only the exact expired reserved publication before attempt reservation", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "publication-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"p".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    await expireUnreservedPublication(handoff.dispatchId);

    const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 2_000) },
    );
    assert.equal(report.counts.rolledBackPublications, 1);
    assert.equal(report.events[0]?.code, "V3_RECOVERY_LIFECYCLE_PUBLICATION_ROLLED_BACK");

    const claims = await database.sql<Array<{ outcome: string | null }>>`
      SELECT outcome FROM claim_log WHERE id = ${publication!.claimId}
    `;
    assert.equal(claims[0]?.outcome, "infra_retry");
    const runtimes = await database.sql<Array<{ state: string; attempt_id: string | null }>>`
      SELECT state, attempt_id FROM runtime_sessions WHERE session_id = ${sessionId}
    `;
    assert.deepEqual({ ...runtimes[0]! }, { state: "released", attempt_id: null });
    const stories = await database.sql<Array<{ status: string; claimed_by: string | null; claimed_at: Date | null }>>`
      SELECT status, claimed_by, claimed_at FROM stories WHERE id = ${fixture.storyDbId}
    `;
    assert.equal(stories[0]?.status, "failed");
    assert.equal(stories[0]?.claimed_by, null);
    assert.equal(stories[0]?.claimed_at, null);
    const steps = await database.sql<Array<{ status: string; current_story_id: string | null }>>`
      SELECT status, current_story_id FROM steps WHERE id = ${fixture.stepDbId}
    `;
    assert.deepEqual({ ...steps[0]! }, { status: "running", current_story_id: null });
    const delivery = await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "authorized");
    assert.equal(delivery?.attemptId, undefined);
  });

  it("advances only an exact running runtime and active attempt, then becomes a no-op", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "attempt-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"a".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    const reservation = await createAttemptRepository(database.sql).reserve({
      claimId: publication!.claimId,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      attemptClass: "product_implementation",
      packetHash: handoff.directive.packetHash,
      compilationReportHash: "f".repeat(64),
      sliceHash: "9".repeat(64),
      sourceBefore: handoff.directive.sourceRevision,
      findingSetHash: handoff.directive.findingSetHash,
      recoveryCaseRevisionId: handoff.revisionId,
      recoveryDispatchId: handoff.dispatchId,
      recoveryDeliveryLease: {
        ownerInstanceId: handoff.lease.ownerInstanceId,
        leaseToken: handoff.lease.leaseToken,
      },
      role: "developer",
      agentId: "recovery-agent",
      evidenceRefs: [`setfarm://claim-log/${publication!.claimId}`],
    }, { now: new Date(leaseAt.getTime() + 200) });
    assert.equal(reservation.status, "reserved");
    await createAttemptRepository(database.sql).markRunning({
      attemptId: reservation.attempt.attemptId,
      generation: reservation.attempt.generation,
      fenceToken: reservation.attempt.fenceToken,
    }, { now: new Date("2200-01-01T00:00:00.000Z") });
    await createRuntimeSessionRepository(database.sql).bindAttempt({
      sessionId,
      attemptId: reservation.attempt.attemptId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(leaseAt.getTime() + 300),
    });
    await database.sql`
      UPDATE runtime_sessions
         SET state = 'running',
             created_at = (
               SELECT claim.claimed_at + interval '1 second'
                 FROM claim_log claim
                WHERE claim.id = runtime_sessions.claim_id
             ),
             started_at = ${new Date(leaseAt.getTime() + 400)},
             heartbeat_at = ${new Date(leaseAt.getTime() + 400)},
             updated_at = ${new Date(leaseAt.getTime() + 400)}
       WHERE session_id = ${sessionId} AND state = 'reserved'
    `;
    await database.sql`
      UPDATE recovery_dispatch_deliveries delivery
         SET started_at = claim.claimed_at + interval '2 seconds'
        FROM claim_log claim
       WHERE delivery.dispatch_id = ${fixture.dispatch.dispatchId}
         AND claim.id = delivery.claim_id
    `;

    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const first = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 500) },
    );
    assert.equal(first.counts.advancedRunning, 1, JSON.stringify(first, null, 2));
    assert.equal((await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId))?.state, "running");

    const replay = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 600) },
    );
    assert.equal(replay.counts.noops, 1);
    assert.equal(replay.events[0]?.code, "V3_RECOVERY_LIFECYCLE_RUNNING_CONSISTENT");
  });

  it("reports a nonexpired lease and an expired starting runtime without mutating either owner", async () => {
    const leasedFixture = await setup();
    const leaseAt = new Date(leasedFixture.base.getTime() + 2_000);
    await lease(leasedFixture, {
      ownerInstanceId: "live-lease-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const liveReport = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: leasedFixture.runId },
      { now: new Date(leaseAt.getTime() + 1_000) },
    );
    assert.equal(liveReport.counts.quarantined, 1);
    assert.equal(liveReport.events[0]?.code, "V3_RECOVERY_LIFECYCLE_LEASE_NOT_EXPIRED");
    assert.equal((await leasedFixture.deliveries.findDelivery(leasedFixture.dispatch.dispatchId))?.state, "leased");

    const runtimeFixture = await setup();
    const runtimeLeaseAt = new Date(runtimeFixture.base.getTime() + 2_000);
    const handoff = await lease(runtimeFixture, {
      ownerInstanceId: "starting-runtime-owner",
      leaseMs: 60_000,
      now: runtimeLeaseAt,
    });
    const sessionId = `RTS_${"s".repeat(20)}-${sequence}`;
    const publication = await publish(runtimeFixture, handoff, {
      sessionId,
      now: new Date(runtimeLeaseAt.getTime() + 100),
    });
    assert.ok(publication);
    await createRuntimeSessionRepository(database.sql).markStarting({
      sessionId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(runtimeLeaseAt.getTime() + 200),
    });
    await expireDelivery(handoff.dispatchId);

    const unsafeReport = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: runtimeFixture.runId },
      { now: new Date(runtimeLeaseAt.getTime() + 2_000) },
    );
    assert.equal(unsafeReport.counts.quarantined, 1);
    assert.equal(unsafeReport.events[0]?.code, "V3_RECOVERY_LIFECYCLE_UNRELEASED_RUNTIME_UNSAFE");
    assert.equal((await runtimeFixture.deliveries.findDelivery(runtimeFixture.dispatch.dispatchId))?.state, "leased");
    const ownerRows = await database.sql<Array<{ runtime_state: string; claim_outcome: string | null; story_status: string }>>`
      SELECT rs.state AS runtime_state, cl.outcome AS claim_outcome, story.status AS story_status
        FROM runtime_sessions rs
        JOIN claim_log cl ON cl.id = rs.claim_id
        JOIN stories story ON story.id = rs.story_db_id
       WHERE rs.session_id = ${sessionId}
    `;
    assert.deepEqual({ ...ownerRows[0]! }, {
      runtime_state: "starting",
      claim_outcome: null,
      story_status: "running",
    });
  });

  it("fails closed on an ambiguous expired lease and never exposes a normal pending story", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "ambiguous-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${fixture.runId}, 'implement', ${fixture.storyId}, 'orphan-agent', ${new Date(leaseAt.getTime() + 100)})
      RETURNING id::integer AS id
    `;
    await expireDelivery(handoff.dispatchId);

    const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 2_000) },
    );
    assert.equal(report.counts.quarantined, 1);
    assert.equal(report.events[0]?.code, "V3_RECOVERY_LIFECYCLE_UNBOUND_OWNER_AMBIGUOUS");
    assert.equal((await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId))?.state, "leased");
    const story = await database.sql<Array<{ status: string }>>`
      SELECT status FROM stories WHERE id = ${fixture.storyDbId}
    `;
    assert.equal(story[0]?.status, "failed");
    const claim = await database.sql<Array<{ outcome: string | null }>>`
      SELECT outcome FROM claim_log WHERE id = ${claims[0]!.id}
    `;
    assert.equal(claim[0]?.outcome, null);
  });
});
