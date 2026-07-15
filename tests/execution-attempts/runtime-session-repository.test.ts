import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
import { publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import {
  createRuntimeSessionRepository,
  releaseDrainedRuntimeSessionInTransaction,
  releaseDrainedRuntimeSessionsInTransaction,
  releaseReservedRuntimeSessionInTransaction,
} from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
} from "../../src/execution/run-termination.js";
import { HASH_A, HASH_B, HASH_C, HASH_D, SHA_A, TREE_A, exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/runtime-absent"],
};

async function seedStory(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, runId: string) {
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  await database.insertRun(runId);
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, current_story_id)
    VALUES
      (${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'running', ${storyDbId})
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status, claimed_by, claim_generation)
    VALUES
      (${storyDbId}, ${runId}, 1, 'US-001', 'Story', 'running', 'feature-dev_developer', 1)
  `;
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${runId}, 'implement', 'US-001', 'feature-dev_developer')
    RETURNING id::integer AS id
  `;
  return { stepDbId, storyDbId, claimId: claims[0]!.id };
}

async function seedAttemptBoundRecoveryRuntime(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{ runId: string; runtimeOwnerInstanceId?: string }>,
) {
  const storyId = "US-RECOVERY";
  const storyDbId = `${input.runId}-story`;
  const stepDbId = `${input.runId}-step`;
  const releaseSha = "d".repeat(40);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
  await database.sql.unsafe(
    `INSERT INTO runs (
       id, workflow_id, task, status, protocol, protocol_version,
       compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
     ) VALUES ($1, 'feature-dev', 'recovery runtime test', 'running', 'v3', 1, $2, $3, $4, $5)`,
    [input.runId, releaseSha, HASH_A, "e".repeat(64), releaseAdmissionHash],
  );
  await database.sql.unsafe(
    `INSERT INTO steps (
       id, run_id, step_id, agent_id, step_index, input_template, expects,
       status, type, current_story_id
     ) VALUES ($1, $2, 'implement', 'feature-dev_developer', 1, '', '', 'running', 'loop', NULL)`,
    [stepDbId, input.runId],
  );
  await database.sql.unsafe(
    `INSERT INTO stories (
       id, run_id, story_index, story_id, title, status, claimed_by, claim_generation
     ) VALUES ($1, $2, 1, $3, 'Recovery story', 'failed', NULL, 0)`,
    [storyDbId, input.runId, storyId],
  );

  const findingSet = createFindingSetV1({
    runId: input.runId,
    storyId,
    packetHash: HASH_A,
    sliceHash: HASH_C,
    sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_RUNTIME_START",
      sourceLocators: [{ path: "src/App.tsx", contentHash: HASH_D }],
      observedEvidenceRefs: [HASH_B],
      expectedPredicateRef: "EVID_RUNTIME_START",
      status: "open",
    }],
  });
  const draft: RecoveryCaseDraftV1 = {
    runId: input.runId,
    storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: HASH_A,
    sliceHash: HASH_C,
    sourceRevision: findingSet.sourceRevision,
    owner: "implement",
    expectedDelta: {
      kind: "source_change",
      invariantRefs: ["INV_RUNTIME_START"],
      requiredPaths: ["src/App.tsx"],
    },
    allowedPaths: ["src/App.tsx"],
    evidencePlan: ["EVID_RUNTIME_START"],
    priorAttemptRefs: [],
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
  const findings = createFindingRecoveryRepository(database.sql);
  await findings.putFindingSet(findingSet);
  const opened = await findings.openRecoveryCase(draft);
  const deliveries = createRecoveryDeliveryRepository(database.sql);
  const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
  assert.ok(revision);
  const authorization = await deliveries.authorizeCurrentRevision({
    recoveryCaseId: opened.recoveryCase.recoveryCaseId,
    revisionId: revision.revisionId,
    expectedStateVersion: opened.recoveryCase.stateVersion,
    dispatchClass: "product_implementation",
  });
  assert.equal(authorization.status, "authorized");
  if (authorization.status !== "authorized") throw new Error("test recovery authorization failed");
  const handoff = await createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
    runId: input.runId,
    storyId,
    ownerInstanceId: "spawner-recovery",
    leaseMs: 60_000,
  });

  const runtimeOwnerInstanceId = input.runtimeOwnerInstanceId ?? "spawner-recovery";
  const publication = await publishLoopClaimRuntime(database.sql, {
    runId: input.runId,
    stepDbId,
    workflowStepId: "implement",
    storyDbId,
    storyId,
    claimAgentId: "feature-dev_developer",
    parallelLimit: 1,
    runtimeIntent: {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_recovery-runtime-0001",
      runtimeAgentId: "prism",
      runtimeKind: "openclaw_session",
      ownerInstanceId: runtimeOwnerInstanceId,
    },
    recoveryHandoff: handoff,
  });
  assert.equal(publication?.claimAuthority?.mode, "recovery");
  assert.ok(publication?.runtime);
  const claimId = publication.claimId;
  const attempt = await createAttemptRepository(database.sql, {
    attemptId: () => "ATT_recovery-runtime-0001",
    fenceToken: () => "f".repeat(64),
  }).reserve(exactProductReservation({
    claimId,
    runId: input.runId,
    storyId,
    agentId: "feature-dev_developer",
    packetHash: HASH_A,
    compilationReportHash: HASH_B,
    sliceHash: HASH_C,
    sourceBefore: findingSet.sourceRevision,
    findingSetHash: findingSet.findingSetHash,
    recoveryCaseRevisionId: handoff.revisionId,
    recoveryDispatchId: handoff.dispatchId,
    recoveryDeliveryLease: {
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
    },
    evidenceRefs: [`setfarm://claim-log/${claimId}`],
  }));
  assert.equal(attempt.status, "reserved");
  const sessions = createRuntimeSessionRepository(database.sql);
  await sessions.bindAttempt({
    sessionId: publication.runtime.sessionId,
    attemptId: attempt.attempt.attemptId,
    ownerInstanceId: publication.runtime.ownerInstanceId,
  });
  const session = await sessions.findById(publication.runtime.sessionId);
  assert.ok(session);
  const recoveryFence = {
    revisionId: handoff.revisionId,
    dispatchId: handoff.dispatchId,
    leaseToken: handoff.lease.leaseToken,
    attempt: {
      attemptId: attempt.attempt.attemptId,
      generation: attempt.attempt.generation,
      fenceToken: attempt.attempt.fenceToken,
    },
  };
  return { sessions, session, attempt, deliveries, handoff, recoveryFence };
}

describe("durable runtime session ownership", () => {
  it("tracks reserve, attempt binding, start, drain, and release behind exact owners", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-session";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const attempts = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_runtime-session-0001",
        fenceToken: () => "f".repeat(64),
      });
      const reservedAttempt = await attempts.reserve(exactProductReservation({
        claimId,
        runId,
        storyId: "US-001",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_runtime-session-0001",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-a",
        worktree: ".worktrees/us-001",
      });
      assert.equal(session.state, "reserved");
      assert.equal(session.attemptId, undefined);
      const bound = await sessions.bindAttempt({
        sessionId: session.sessionId,
        attemptId: reservedAttempt.attempt.attemptId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(bound.attemptId, "ATT_runtime-session-0001");
      const starting = await sessions.markStarting({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        sessionKey: "openclaw-key-starting",
        worktree: ".worktrees/us-001-exact",
        runtimePath: "/tmp/runtime-us-001",
        transcriptPath: "/tmp/runtime-us-001.jsonl",
      });
      assert.equal(starting.state, "starting");
      assert.equal(starting.sessionKey, "openclaw-key-starting");
      assert.equal(starting.worktree, ".worktrees/us-001-exact");
      assert.equal(starting.runtimePath, "/tmp/runtime-us-001");
      assert.equal(starting.transcriptPath, "/tmp/runtime-us-001.jsonl");
      await assert.rejects(
        sessions.markRunning({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-a",
          pid: 1234,
          sessionKey: "openclaw-key",
        }),
        /RUNTIME_SESSION_PROCESS_IDENTITY_REQUIRED/,
      );
      assert.equal((await sessions.findById(session.sessionId))?.state, "starting");
      const processIdentity = {
        schema: "setfarm.process-identity.v1" as const,
        pid: 1234,
        processStartedAt: "2026-07-13T12:00:00.000Z",
        processGroupId: 1234,
        source: "observed_os" as const,
      };
      const running = await sessions.markRunning({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        pid: 1234,
        sessionKey: "openclaw-key",
        processIdentity,
      });
      assert.equal(running.status, "running");
      assert.equal(running.session.pid, 1234);
      assert.deepEqual(running.session.processIdentity, processIdentity);
      assert.equal(running.session.processGroupId, 1234);
      const runningAttempt = await attempts.findById(reservedAttempt.attempt.attemptId);
      assert.equal(
        runningAttempt?.disposition,
        "running",
        "the runtime and its exact compiler attempt must publish running in one transaction",
      );
      await assert.rejects(
        sessions.requestDrain({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-b",
          diagnostic: "wrong owner",
        }),
        /RUNTIME_SESSION_DRAIN_REQUEST_FAILED/,
      );
      assert.equal((await sessions.requestDrain({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        diagnostic: "shutdown",
      })).state, "drain_requested");
      await assert.rejects(
        sessions.markDrained({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-a",
          evidence: { ...DRAIN_EVIDENCE, localProcessAbsent: false },
        }),
      );
      await assert.rejects(
        sessions.markDrained({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-b",
          evidence: DRAIN_EVIDENCE,
        }),
        /RUNTIME_SESSION_DRAIN_CAS_LOST/,
      );
      const firstDrained = await sessions.markDrained({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      assert.equal(firstDrained.state, "drained");
      const reusedDrainProof = await sessions.markDrained({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-b",
        evidence: {
          ...DRAIN_EVIDENCE,
          observedAt: "2026-07-13T12:00:01.000Z",
          evidenceRefs: ["setfarm://test/second-recovery-intent"],
        },
      });
      assert.equal(reusedDrainProof.state, "drained");
      assert.equal(
        reusedDrainProof.drainedAt,
        firstDrained.drainedAt,
        "a later completion/cancellation intent must reuse the already-proven drain boundary",
      );
      assert.deepEqual(
        reusedDrainProof.drainEvidence,
        firstDrained.drainEvidence,
        "idempotent drain adoption must not overwrite the canonical proof that won the first transition",
      );
      await assert.rejects(
        database.sql.begin((transaction) => releaseDrainedRuntimeSessionsInTransaction(
          transaction,
          { runId },
        )),
        /RUNTIME_SESSION_RELEASE_OWNER_ACTIVE/,
      );
      await database.sql`UPDATE execution_attempts SET disposition = 'inconclusive' WHERE attempt_id = 'ATT_runtime-session-0001'`;
      await database.sql`UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${claimId}`;
      assert.equal((await database.sql.begin((transaction) => releaseDrainedRuntimeSessionInTransaction(
        transaction,
        { sessionId: session.sessionId, claimId, ownerInstanceId: "spawner-a" },
      ))).state, "released");
      assert.equal(await database.sql.begin((transaction) => releaseDrainedRuntimeSessionsInTransaction(
        transaction,
        { runId },
      )), 0);
      assert.equal((await sessions.findById(session.sessionId))?.state, "released");
    } finally {
      await database.cleanup();
    }
  });

  it("rejects mismatched and duplicate claim capabilities", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-session-binding";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const base = {
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session" as const,
        ownerInstanceId: "spawner-a",
      };
      await assert.rejects(
        sessions.reserve({ ...base, sessionId: "RTS_runtime-session-bad01", storyId: "US-WRONG" }),
        /RUNTIME_SESSION_CLAIM_IDENTITY_MISMATCH/,
      );
      await sessions.reserve({ ...base, sessionId: "RTS_runtime-session-good1" });
      await assert.rejects(
        sessions.reserve({ ...base, sessionId: "RTS_runtime-session-good2" }),
        /duplicate key value|unique constraint/i,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("publishes a recovery attempt, runtime, and dispatch delivery as running atomically", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedAttemptBoundRecoveryRuntime(database, {
        runId: "run-recovery-runtime-start",
      });
      assert.equal((await fixture.deliveries.findDelivery(fixture.handoff.dispatchId))?.state, "attempt_reserved");
      await fixture.sessions.markStarting({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        recoveryFence: fixture.recoveryFence,
      });
      const running = await fixture.sessions.markRunning({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        pid: 4321,
        processIdentity: {
          schema: "setfarm.process-identity.v1",
          pid: 4321,
          processStartedAt: "2026-07-13T12:10:00.000Z",
          processGroupId: 4321,
          source: "observed_os",
        },
        recoveryFence: fixture.recoveryFence,
      });
      assert.equal(running.status, "running");
      assert.equal((await fixture.deliveries.findDelivery(fixture.handoff.dispatchId))?.state, "running");
      assert.equal(
        (await createAttemptRepository(database.sql).findById(fixture.attempt.attempt.attemptId))?.disposition,
        "running",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("blocks runtime start before publication when the recovery delivery owner differs", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedAttemptBoundRecoveryRuntime(database, {
        runId: "run-recovery-runtime-owner-mismatch",
        runtimeOwnerInstanceId: "different-spawner",
      });
      await assert.rejects(
        fixture.sessions.markStarting({
          sessionId: fixture.session.sessionId,
          ownerInstanceId: fixture.session.ownerInstanceId,
          recoveryFence: fixture.recoveryFence,
        }),
        /RUNTIME_SESSION_RECOVERY_DELIVERY_FENCE_STALE/,
      );
      assert.equal((await fixture.sessions.findById(fixture.session.sessionId))?.state, "reserved");
      assert.equal((await fixture.deliveries.findDelivery(fixture.handoff.dispatchId))?.state, "attempt_reserved");
      assert.equal(
        (await createAttemptRepository(database.sql).findById(fixture.attempt.attempt.attemptId))?.disposition,
        "claimed",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("fences a stale quarantine observation after runtime ownership advances", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-quarantine-fence";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const reserved = await sessions.reserve({
        sessionId: "RTS_runtime-quarantine-fence1",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-stale",
      });
      const staleObservation = await sessions.markStarting({
        sessionId: reserved.sessionId,
        ownerInstanceId: "spawner-stale",
      });

      await database.sql`
        UPDATE runtime_sessions
           SET owner_instance_id = 'spawner-current',
               state_version = state_version + 1,
               heartbeat_at = NOW(),
               updated_at = NOW()
         WHERE session_id = ${reserved.sessionId}
           AND owner_instance_id = 'spawner-stale'
           AND state_version = ${staleObservation.stateVersion}
      `;

      await assert.rejects(
        sessions.quarantine({
          sessionId: reserved.sessionId,
          expectedOwnerInstanceId: staleObservation.ownerInstanceId,
          expectedStateVersion: staleObservation.stateVersion,
          diagnostic: "stale worker must not quarantine adopted runtime",
        }),
        /RUNTIME_SESSION_QUARANTINE_CAS_LOST/,
      );
      const adopted = await sessions.findById(reserved.sessionId);
      assert.ok(adopted);
      assert.equal(adopted.ownerInstanceId, "spawner-current");
      assert.equal(adopted.state, "starting");
      assert.equal(adopted.stateVersion, staleObservation.stateVersion + 1);

      const quarantined = await sessions.quarantine({
        sessionId: adopted.sessionId,
        expectedOwnerInstanceId: adopted.ownerInstanceId,
        expectedStateVersion: adopted.stateVersion,
        diagnostic: "current worker proved runtime uncertainty",
      });
      assert.equal(quarantined.state, "quarantined");
      assert.equal(quarantined.stateVersion, adopted.stateVersion + 1);
      const replay = await sessions.quarantine({
        sessionId: adopted.sessionId,
        expectedOwnerInstanceId: staleObservation.ownerInstanceId,
        expectedStateVersion: staleObservation.stateVersion,
        diagnostic: "lost response replay must not rewrite terminal receipt",
      });
      assert.equal(replay.state, "quarantined");
      assert.equal(replay.stateVersion, quarantined.stateVersion);
      assert.equal(replay.diagnostic, quarantined.diagnostic);
    } finally {
      await database.cleanup();
    }
  });

  it("preserves drain proof through quarantine and re-proves it only for the exact termination owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-quarantine-stop";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const reserved = await sessions.reserve({
        sessionId: "RTS_runtime-quarantine-stop1",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-runtime",
      });
      await sessions.markStarting({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
      });
      const running = await sessions.markRunning({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        sessionKey: "runtime-quarantine-stop-key",
      });
      assert.equal(running.status, "running");
      const draining = await sessions.requestDrain({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        diagnostic: "completion requested drain",
      });
      const drained = await sessions.markDrained({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        evidence: DRAIN_EVIDENCE,
      });
      const quarantined = await sessions.quarantine({
        sessionId: reserved.sessionId,
        expectedOwnerInstanceId: drained.ownerInstanceId,
        expectedStateVersion: drained.stateVersion,
        diagnostic: "completion owner rejected an invalid proposal",
        evidence: { completionRequestId: "RCR_runtime-quarantine-stop1" },
      });
      assert.equal(draining.state, "drain_requested");
      assert.equal(quarantined.state, "quarantined");
      assert.deepEqual(quarantined.drainEvidence, DRAIN_EVIDENCE);

      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "test.operator.stop",
        diagnostic: "operator requested cancellation against quarantine",
        requestId: "RTR_runtime-quarantine-stop1",
      });
      assert.equal(requested.status, "requested");
      if (requested.status === "already_terminal") throw new Error("termination request missing");
      const terminations = createRunTerminationRepository(database.sql);
      const termination = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-termination",
      });
      assert.equal(termination?.state, "draining");
      assert.ok(termination?.ownerInstanceId);

      const freshEvidence = {
        ...DRAIN_EVIDENCE,
        observedAt: "2026-07-13T12:05:00.000Z",
        evidenceRefs: [
          `setfarm://run-termination/${termination!.requestId}`,
          `setfarm://runtime-session/${quarantined.sessionId}`,
        ],
      };
      await assert.rejects(
        sessions.recoverQuarantinedForTermination({
          sessionId: quarantined.sessionId,
          expectedStateVersion: quarantined.stateVersion,
          terminationRequestId: termination!.requestId,
          terminationOwnerInstanceId: "wrong-owner",
          evidence: freshEvidence,
          diagnostic: "wrong owner must not recover quarantine",
        }),
        /RUNTIME_SESSION_TERMINATION_RECOVERY_CAS_LOST:quarantined/,
      );
      const recovered = await sessions.recoverQuarantinedForTermination({
        sessionId: quarantined.sessionId,
        expectedStateVersion: quarantined.stateVersion,
        terminationRequestId: termination!.requestId,
        terminationOwnerInstanceId: termination!.ownerInstanceId!,
        evidence: freshEvidence,
        diagnostic: "termination owner re-proved process, task, and workspace absence",
      });
      assert.equal(recovered.state, "drained");
      assert.deepEqual(recovered.drainEvidence, freshEvidence);
      assert.match(recovered.diagnostic || "", /completion owner rejected an invalid proposal/);
      assert.match(recovered.diagnostic || "", /termination owner re-proved/);

      const replay = await sessions.recoverQuarantinedForTermination({
        sessionId: quarantined.sessionId,
        expectedStateVersion: quarantined.stateVersion,
        terminationRequestId: termination!.requestId,
        terminationOwnerInstanceId: termination!.ownerInstanceId!,
        evidence: freshEvidence,
        diagnostic: "lost response replay",
      });
      assert.equal(replay.state, "drained");
      assert.deepEqual(replay.drainEvidence, freshEvidence);
    } finally {
      await database.cleanup();
    }
  });

  it("returns the durable termination drain handoff when termination wins after markStarting", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-start-termination-handoff";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const reserved = await sessions.reserve({
        sessionId: "RTS_runtime-start-termination-handoff",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-runtime",
      });
      await sessions.markStarting({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
      });
      const termination = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "test.runtime-start-race",
        diagnostic: "termination won after runtime start intent",
        requestId: "RTR_runtime-start-termination-handoff",
      });
      assert.equal(termination.status, "requested");
      const draining = await sessions.requestDrain({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        diagnostic: "termination owns the drain",
      });
      assert.equal(draining.state, "drain_requested");

      const handoff = await sessions.markRunning({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        sessionKey: "must-not-be-published-running",
      });
      assert.equal(handoff.status, "drain_requested");
      assert.equal(handoff.session.state, "drain_requested");
      assert.equal(handoff.session.sessionKey, undefined);
      const rows = await database.sql<Array<{
        run_status: string;
        runtime_state: string;
        termination_count: number;
      }>>`
        SELECT run.status AS run_status, runtime.state AS runtime_state,
               (SELECT COUNT(*)::integer FROM run_termination_requests request
                 WHERE request.run_id = run.id AND request.state <> 'terminalized') AS termination_count
          FROM runs run
          JOIN runtime_sessions runtime ON runtime.run_id = run.id
         WHERE run.id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "failing",
        runtime_state: "drain_requested",
        termination_count: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("returns a recovery runtime drain handoff before consulting a stale attempt fence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedAttemptBoundRecoveryRuntime(database, {
        runId: "run-recovery-runtime-termination-handoff",
      });
      await fixture.sessions.markStarting({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        recoveryFence: fixture.recoveryFence,
      });
      const termination = await requestRunTermination(database.sql, {
        runId: fixture.session.runId,
        targetStatus: "failed",
        requestedBy: "test.recovery-runtime-start-race",
        diagnostic: "termination won while the recovery runtime was starting",
        requestId: "RTR_recovery-runtime-termination-handoff",
      });
      assert.equal(termination.status, "requested");
      const draining = await fixture.sessions.requestDrain({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        diagnostic: "termination owns the recovery runtime drain",
      });
      assert.equal(draining.state, "drain_requested");

      await database.sql`
        UPDATE execution_attempts
           SET fence_token = ${"e".repeat(64)}, updated_at = NOW()
         WHERE attempt_id = ${fixture.attempt.attempt.attemptId}
      `;

      const handoff = await fixture.sessions.markRunning({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        sessionKey: "must-not-be-published-after-recovery-relinquish",
        recoveryFence: fixture.recoveryFence,
      });
      assert.equal(handoff.status, "drain_requested");
      assert.equal(handoff.session.state, "drain_requested");
      assert.equal(handoff.session.sessionKey, undefined);
      assert.equal(
        (await fixture.sessions.findById(fixture.session.sessionId))?.state,
        "drain_requested",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("releases an exact reserved no-spawn owner only after its claim is terminal", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-no-spawn";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_runtime-no-spawn-0001",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-a",
      });
      await assert.rejects(
        database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(
          transaction,
          {
            sessionId: session.sessionId,
            claimId,
            ownerInstanceId: "spawner-a",
            diagnostic: "no spawn",
          },
        )),
        /RUNTIME_SESSION_RESERVED_RELEASE_CLAIM_ACTIVE/,
      );
      await database.sql`UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${claimId}`;
      const released = await database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(
        transaction,
        {
          sessionId: session.sessionId,
          claimId,
          ownerInstanceId: "spawner-a",
          diagnostic: "preclaim rejected before spawn",
        },
      ));
      assert.equal(released.state, "released");
      assert.equal(released.drainEvidence.sourceState, "reserved");
      const replay = await sessions.quarantine({
        sessionId: session.sessionId,
        expectedOwnerInstanceId: session.ownerInstanceId,
        expectedStateVersion: session.stateVersion,
        diagnostic: "late quarantine replay must preserve release",
      });
      assert.equal(replay.state, "released");
      assert.equal(replay.stateVersion, released.stateVersion);
      assert.equal(replay.diagnostic, released.diagnostic);
    } finally {
      await database.cleanup();
    }
  });
});
