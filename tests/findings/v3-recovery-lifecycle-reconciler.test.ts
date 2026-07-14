import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
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
    const base = new Date(Date.UTC(2026, 6, 13, 12, sequence, 0));
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
        now: new Date(input.now.getTime() + 300),
      });
    }
    return { publication: publication!, attempt: reservation.attempt };
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
    const expectedExpiry = new Date(heartbeatAt.getTime() + 120_000).toISOString();
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
    assert.equal(rows[0]?.runtime_heartbeat.toISOString(), heartbeatAt.toISOString());
    assert.equal(rows[0]?.attempt_heartbeat.toISOString(), heartbeatAt.toISOString());
    assert.equal(rows[0]?.attempt_expiry.toISOString(), expectedExpiry);
    assert.equal(rows[0]?.delivery_expiry.toISOString(), expectedExpiry);
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
    await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
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
    await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: false,
    });
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
    await lease(fixture, { ownerInstanceId: "lease-race-owner", leaseMs: 1_000, now: leaseAt });
    const reconcileAt = new Date(leaseAt.getTime() + 2_000);
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);

    const reports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
    ]);
    const events = reports.flatMap((report) => report.events);
    assert.equal(reports.reduce((sum, report) => sum + report.counts.resetExpiredLeases, 0), 1);
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

  it("rolls back only the exact expired reserved publication before attempt reservation", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "publication-owner",
      leaseMs: 1_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"p".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);

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
    await createRuntimeSessionRepository(database.sql).bindAttempt({
      sessionId,
      attemptId: reservation.attempt.attemptId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(leaseAt.getTime() + 300),
    });
    await database.sql`
      UPDATE runtime_sessions
         SET state = 'running', started_at = ${new Date(leaseAt.getTime() + 400)},
             heartbeat_at = ${new Date(leaseAt.getTime() + 400)},
             updated_at = ${new Date(leaseAt.getTime() + 400)}
       WHERE session_id = ${sessionId} AND state = 'reserved'
    `;

    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const first = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 500) },
    );
    assert.equal(first.counts.advancedRunning, 1);
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
      leaseMs: 1_000,
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
    await lease(fixture, {
      ownerInstanceId: "ambiguous-owner",
      leaseMs: 1_000,
      now: leaseAt,
    });
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${fixture.runId}, 'implement', ${fixture.storyId}, 'orphan-agent', ${new Date(leaseAt.getTime() + 100)})
      RETURNING id::integer AS id
    `;

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
