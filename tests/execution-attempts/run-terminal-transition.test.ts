import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyContractSpineMigrations,
  planContractSpineMigrations,
  readContractSpineMigrationAttestation,
  rollbackArtifactPublicationBatchLedgerToV22,
  rollbackArtifactStoreAuthorityLedgerToV23,
  rollbackOperationalFailureCauseSealToV20,
  rollbackPreparationAuthorityV2LedgerToV24,
  rollbackProductCompilationAttemptLedgerToV21,
  rollbackRecoveryTerminalLeaseIdentityToV19,
} from "../../src/db/contract-spine-migrations.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { transitionRunToTerminal } from "../../src/execution/run-terminal-transition.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { exactProductReservation, HASH_A } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

async function rollbackCurrentToV21(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
    targetReleaseSha: "2".repeat(40),
  });
  await rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
    targetReleaseSha: "3".repeat(40),
  });
  await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
    targetReleaseSha: "4".repeat(40),
  });
  await rollbackProductCompilationAttemptLedgerToV21(database.sql, {
    targetReleaseSha: "5".repeat(40),
  });
}

async function seedActiveStory(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, runId: string) {
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
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
      (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 1)
  `;
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
    VALUES (${runId}, 'implement', 'US-002', 'feature-dev_developer', NOW())
    RETURNING id::integer AS id
  `;
  return { stepDbId, storyDbId, claimId: claims[0]!.id };
}

async function seedActiveRecovery(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{ runId: string; runStatus: "failed" | "completed" }>,
) {
  const releaseSha = "d".repeat(40);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
  await database.sql`
    INSERT INTO runs (
      id, workflow_id, task, status, protocol,
      compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
    ) VALUES (
      ${input.runId}, 'feature-dev', 'terminal recovery chain', 'running', 'v3',
      ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
    )
  `;
  const stepDbId = `${input.runId}-implement`;
  const storyDbId = `${input.runId}-story`;
  const storyId = "US-RECOVERY-TERMINAL";
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type)
    VALUES
      (${stepDbId}, ${input.runId}, 'implement', 'feature-dev_developer', 1, '', '', 'pending', 'loop')
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status)
    VALUES
      (${storyDbId}, ${input.runId}, 1, ${storyId}, 'Terminal recovery story', 'failed')
  `;
  const findingSet = createFindingSetV1({
    runId: input.runId,
    storyId,
    packetHash: HASH_A,
    sliceHash: "b".repeat(64),
    sourceRevision: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: "3".repeat(64) }],
      observedEvidenceRefs: ["4".repeat(64)],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
  const findings = createFindingRecoveryRepository(database.sql);
  await findings.putFindingSet(findingSet);
  const opened = await findings.openRecoveryCase({
    runId: input.runId,
    storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: HASH_A,
    sliceHash: "b".repeat(64),
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
  });
  const deliveries = createRecoveryDeliveryRepository(database.sql);
  const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
  assert.ok(revision);
  const authorized = await deliveries.authorizeCurrentRevision({
    recoveryCaseId: opened.recoveryCase.recoveryCaseId,
    revisionId: revision.revisionId,
    expectedStateVersion: opened.recoveryCase.stateVersion,
    dispatchClass: "product_implementation",
  });
  assert.equal(authorized.status, "authorized");
  if (authorized.status !== "authorized") throw new Error("expected authorized recovery fixture");
  await database.sql`UPDATE runs SET status = ${input.runStatus} WHERE id = ${input.runId}`;
  return { recoveryCaseId: opened.recoveryCase.recoveryCaseId, dispatchId: authorized.dispatch.dispatchId };
}

describe("canonical run terminal owner", () => {
  it("refuses to erase active shadow owners without a drained failure request", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-failed";
      await database.insertRun(runId);
      const { claimId } = await seedActiveStory(database, runId);
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-fail1",
        fenceToken: () => "f".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "terminal quality failure",
        }),
        /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
      );
      const state = await database.sql<Array<{
        run_status: string;
        step_status: string;
        story_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        meta: string;
      }>>`
        SELECT r.status AS run_status, s.status AS step_status,
               st.status AS story_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, r.meta
          FROM runs r
          JOIN steps s ON s.run_id = r.id
          JOIN stories st ON st.run_id = r.id
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({
        run_status: state[0]?.run_status,
        step_status: state[0]?.step_status,
        story_status: state[0]?.story_status,
        claim_outcome: state[0]?.claim_outcome,
        attempt_disposition: state[0]?.attempt_disposition,
      }, {
        run_status: "running",
        step_status: "running",
        story_status: "running",
        claim_outcome: null,
        attempt_disposition: "claimed",
      });
      assert.equal(state[0]!.meta, null);
    } finally {
      await database.cleanup();
    }
  });

  it("refuses successful completion while any claim or attempt owner is active", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-complete-blocked";
      await database.insertRun(runId);
      const { claimId } = await seedActiveStory(database, runId);
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-open1",
        fenceToken: () => "a".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "pipeline complete",
        }),
        /RUN_TERMINAL_OPEN_OWNERS/,
      );
      const state = await database.sql<Array<{ status: string; outcome: string | null; disposition: string }>>`
        SELECT r.status, cl.outcome, ea.disposition
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "running", outcome: null, disposition: "claimed" });
    } finally {
      await database.cleanup();
    }
  });

  it("reconciles a leaked active fence on an already-cancelled shadow run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-cancel-reconcile";
      await database.insertRun(runId);
      const { claimId } = await seedActiveStory(database, runId);
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-leak1",
        fenceToken: () => "b".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await database.sql`UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${claimId}`;
      await database.sql`UPDATE runs SET status = 'cancelled' WHERE id = ${runId}`;

      const result = await transitionRunToTerminal(database.sql, {
        runId,
        status: "cancelled",
        diagnostic: "Workflow cancelled by user",
      });
      assert.equal(result.closedClaims, 0);
      assert.equal(result.closedAttempts, 1);
      const attempt = await repository.findById("ATT_run-terminal-leak1");
      assert.equal(attempt?.disposition, "inconclusive");
      assert.ok(attempt?.evidenceRefs.includes("setfarm://run-terminal/cancelled"));
    } finally {
      await database.cleanup();
    }
  });

  it("refuses terminal replay while a historical runtime may still be executing", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-replay-live-runtime";
      await database.insertRun(runId);
      const { stepDbId, storyDbId, claimId } = await seedActiveStory(database, runId);
      const attempts = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-replay-live",
        fenceToken: () => "c".repeat(64),
      });
      const reserved = await attempts.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      assert.equal(reserved.status, "reserved");
      const sessionId = "RTS_run-terminal-replay-live-runtime";
      const sessions = createRuntimeSessionRepository(database.sql);
      await sessions.reserve({
        sessionId,
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-002",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "feature-dev_developer",
        runtimeKind: "local_process",
        ownerInstanceId: "historical-live-owner",
      });
      await sessions.bindAttempt({
        sessionId,
        attemptId: reserved.attempt.attemptId,
        ownerInstanceId: "historical-live-owner",
      });
      await database.sql`
        UPDATE runtime_sessions SET state = 'running' WHERE session_id = ${sessionId}
      `;
      await database.sql`UPDATE runs SET status = 'cancelled' WHERE id = ${runId}`;

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "cancelled",
          diagnostic: "must not erase a potentially live historical owner",
        }),
        /RUN_TERMINAL_REPLAY_RUNTIME_NOT_DRAINED:1/,
      );
      const rows = await database.sql<Array<{
        claim_outcome: string | null;
        attempt_disposition: string;
        runtime_state: string;
      }>>`
        SELECT claim.outcome AS claim_outcome,
               attempt.disposition AS attempt_disposition,
               runtime.state AS runtime_state
          FROM claim_log claim
          JOIN execution_attempts attempt ON attempt.claim_id = claim.id
          JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
         WHERE claim.id = ${claimId}
      `;
      assert.deepEqual({ ...rows[0]! }, {
        claim_outcome: null,
        attempt_disposition: "claimed",
        runtime_state: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("does not treat exact packet-bound v3 owners as failure drain proof", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          'run-terminal-v3', 'feature-dev', 'v3 terminal', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
      const { claimId } = await seedActiveStory(database, "run-terminal-v3");
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-v3-01",
        fenceToken: () => "4".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-terminal-v3",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId: "run-terminal-v3",
          status: "failed",
          diagnostic: "native v3 terminal owner",
        }),
        /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
      );
      assert.equal((await repository.findById("ATT_run-terminal-v3-01"))?.disposition, "claimed");
    } finally {
      await database.cleanup();
    }
  });

  it("refuses successful v3 terminalization without an AcceptedCandidate", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-no-candidate";
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'v3 missing candidate', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "must not self-certify success",
        }),
        /RUN_TERMINAL_V3_ACCEPTED_CANDIDATE_REQUIRED/,
      );
      const rows = await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `;
      assert.equal(rows[0]?.status, "running");
    } finally {
      await database.cleanup();
    }
  });

  it("atomically closes an explicitly unclaimed legacy bootstrap when cron publication fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-legacy-bootstrap";
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol
        ) VALUES (
          ${runId}, 'feature-dev', 'legacy bootstrap terminal', 'running', 'legacy'
        )
      `;
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          ('run-terminal-legacy-bootstrap-step', ${runId}, 'plan', 'feature-dev_planner', 0, '', '', 'pending')
      `;

      const result = await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "cron setup failed before claims",
        unclaimedBootstrapFailure: true,
      });
      assert.deepEqual(result, {
        status: "failed",
        previousStatus: "running",
        closedClaims: 0,
        closedAttempts: 0,
        closedRecoveryDeliveries: 0,
        closedRecoveryCases: 0,
        changedSteps: 1,
        changedStories: 0,
      });
      const state = await database.sql<Array<{ run_status: string; step_status: string }>>`
        SELECT r.status AS run_status, s.status AS step_status
          FROM runs r JOIN steps s ON s.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { run_status: "failed", step_status: "failed" });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects bootstrap terminalization once any claim owner exists", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-bootstrap-owned";
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'v3 bootstrap owned', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash}
        )
      `;
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          ('run-terminal-v3-bootstrap-owned-step', ${runId}, 'plan', 'feature-dev_planner', 0, '', '', 'running')
      `;
      await database.sql`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'plan', NULL, 'feature-dev_planner', NOW())
      `;

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "must not steal an owner",
          unclaimedBootstrapFailure: true,
        }),
        /RUN_TERMINAL_BOOTSTRAP_OWNER_EXISTS/,
      );
      const state = await database.sql<Array<{ status: string; outcome: string | null }>>`
        SELECT r.status, cl.outcome
          FROM runs r JOIN claim_log cl ON cl.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "running", outcome: null });
    } finally {
      await database.cleanup();
    }
  });

  it("atomically closes active recovery residue on an already-failed v3 run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-recovery-residue";
      const fixture = await seedActiveRecovery(database, { runId, runStatus: "failed" });
      const result = await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "reconcile historical terminal recovery owner",
      });
      assert.equal(result.closedRecoveryDeliveries, 1);
      assert.equal(result.closedRecoveryCases, 1);

      const delivery = await createRecoveryDeliveryRepository(database.sql)
        .findDelivery(fixture.dispatchId);
      assert.equal(delivery?.schema, "setfarm.recovery-dispatch-delivery.v2");
      assert.equal(delivery?.state, "blocked");
      assert.equal(delivery?.ownerInstanceId, undefined);
      assert.equal(delivery?.leaseToken, undefined);
      assert.equal(delivery?.terminalResult.schema, "setfarm.run-terminal-recovery-chain.v1");
      const rows = await database.sql<Array<{
        case_status: string;
        case_terminal: unknown;
        event_deliveries: number;
        event_cases: number;
      }>>`
        SELECT recovery_case.status AS case_status,
               recovery_case.terminal AS case_terminal,
               (outbox.payload->>'closedRecoveryDeliveries')::integer AS event_deliveries,
               (outbox.payload->>'closedRecoveryCases')::integer AS event_cases
          FROM recovery_cases recovery_case
          JOIN operational_outbox outbox
            ON outbox.aggregate_id = recovery_case.run_id
           AND outbox.event_type = 'run.terminal'
         WHERE recovery_case.recovery_case_id = ${fixture.recoveryCaseId}
      `;
      assert.equal(rows[0]?.case_status, "blocked");
      assert.deepEqual(rows[0]?.case_terminal, {
        owner: "implement",
        outcome: "blocked",
        reasonCode: "evidence_inconclusive",
        evidenceBundleHashes: [],
      });
      assert.equal(rows[0]?.event_deliveries, 1);
      assert.equal(rows[0]?.event_cases, 1);

      const settled = await database.sql<Array<{
        updated_at: Date;
        terminal_events: number;
      }>>`
        SELECT run.updated_at,
               (SELECT COUNT(*)::integer FROM operational_outbox event
                 WHERE event.aggregate_id = run.id
                   AND event.event_type = 'run.terminal') AS terminal_events
          FROM runs run
         WHERE run.id = ${runId}
      `;
      await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "same settled state observed through different prose",
      });
      await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "another operator description must remain a no-op",
      });
      const replayed = await database.sql<Array<{
        updated_at: Date;
        terminal_events: number;
      }>>`
        SELECT run.updated_at,
               (SELECT COUNT(*)::integer FROM operational_outbox event
                 WHERE event.aggregate_id = run.id
                   AND event.event_type = 'run.terminal') AS terminal_events
          FROM runs run
         WHERE run.id = ${runId}
      `;
      assert.equal(replayed[0]!.updated_at.toISOString(), settled[0]!.updated_at.toISOString());
      assert.equal(settled[0]!.terminal_events, 1);
      assert.equal(replayed[0]!.terminal_events, 1);
    } finally {
      await database.cleanup();
    }
  });

  it("refuses to erase an active recovery owner from a completed v3 run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-complete-recovery";
      const fixture = await seedActiveRecovery(database, { runId, runStatus: "completed" });
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "must preserve unresolved recovery evidence",
        }),
        /RUN_TERMINAL_ACTIVE_RECOVERY/,
      );
      assert.equal(
        (await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatchId))?.state,
        "authorized",
      );
      assert.equal(
        (await createFindingRecoveryRepository(database.sql)
          .findRecoveryCase(fixture.recoveryCaseId))?.status,
        "repairing",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("downgrades migration 20 terminal rows to the exact v19 reader contract", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v19-binary-rollback";
      const fixture = await seedActiveRecovery(database, { runId, runStatus: "failed" });
      const targetReleaseSha = "7".repeat(40);
      await rollbackCurrentToV21(database);
      await rollbackOperationalFailureCauseSealToV20(database.sql, {
        targetReleaseSha: "6".repeat(40),
      });
      await assert.rejects(
        rollbackRecoveryTerminalLeaseIdentityToV19(database.sql, { targetReleaseSha }),
        /Migration 20 rollback requires zero active owners/,
      );
      await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "create a lease-free v2 terminal row before binary rollback",
      });
      assert.equal(
        (await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatchId))?.schema,
        "setfarm.recovery-dispatch-delivery.v2",
      );
      const rollback = await rollbackRecoveryTerminalLeaseIdentityToV19(database.sql, {
        targetReleaseSha,
      });
      assert.match(rollback.rollbackId, /^RBK_[a-f0-9]{64}$/);
      assert.equal(rollback.rowsRewritten, 1);
      assert.equal(rollback.targetVersion, 19);
      const legacyReadable = await createRecoveryDeliveryRepository(database.sql)
        .findDelivery(fixture.dispatchId);
      assert.equal(legacyReadable?.schema, "setfarm.recovery-dispatch-delivery.v1");
      assert.equal(legacyReadable?.ownerInstanceId, "setfarm-v19-rollback");
      assert.match(legacyReadable?.leaseToken ?? "", /^ROLLBACK_[a-f0-9]{32}$/);

      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.migrations.find((migration) => migration.version === 20)?.state, "pending");
      const attestation = await readContractSpineMigrationAttestation(database.sql);
      assert.equal(attestation.status, "attested");
      assert.equal(attestation.verifiedReleaseSha, targetReleaseSha);

      const reapplied = await applyContractSpineMigrations(database.sql, {
        releaseSha: "8".repeat(40),
      });
      assert.deepEqual(reapplied.applied, [
        "020_recovery_terminal_lease_identity",
        "021_operational_failure_cause_seal",
        "022_product_compilation_attempt_ledger",
        "023_artifact_publication_batch_ledger",
        "024_artifact_store_authority_ledger",
        "025_v3_preparation_authority_v2_ledger",
      ]);
      assert.equal(
        (await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatchId))?.schema,
        "setfarm.recovery-dispatch-delivery.v1",
      );
      await rollbackCurrentToV21(database);
      await rollbackOperationalFailureCauseSealToV20(database.sql, {
        targetReleaseSha: "9".repeat(40),
      });
      const repeated = await rollbackRecoveryTerminalLeaseIdentityToV19(database.sql, {
        targetReleaseSha,
      });
      assert.match(repeated.rollbackId, /^RBK_[a-f0-9]{64}$/);
      assert.notEqual(repeated.rollbackId, rollback.rollbackId);
      assert.equal(repeated.rowsRewritten, 0);
      assert.equal(repeated.targetReleaseSha, targetReleaseSha);
      const receipts = await database.sql<Array<{ rollback_id: string }>>`
        SELECT rollback_id
          FROM setfarm_schema_migration_rollbacks
         WHERE target_release_sha = ${targetReleaseSha}
         ORDER BY applied_at, rollback_id
      `;
      assert.deepEqual(
        new Set(receipts.map((receipt) => receipt.rollback_id)),
        new Set([rollback.rollbackId, repeated.rollbackId]),
      );
      assert.equal(
        (await planContractSpineMigrations(database.sql)).migrations
          .find((migration) => migration.version === 20)?.state,
        "pending",
      );
    } finally {
      await database.cleanup();
    }
  });
});
