import assert from "node:assert/strict";
import { test } from "node:test";

import type { PgTransactionSql } from "../../src/db-pg.js";
import { publishSingleClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import {
  createRuntimeCompletionRepository,
  markRuntimeCompletionOwnerCommittedInTransaction,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { closeExactSingleStepClaimInTransaction } from "../../src/execution/claim-attempt-transition.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { persistWorkflowRunInTransaction } from "../../src/execution/run-persistence.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 platform preclaim failure terminalizes without model retry authority", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    await runtimeDb.initializeInternalProductionCurrentEntryDatabaseV1();
    const runId = "run-v3-platform-preclaim-terminal";
    const stepDbId = "step-v3-platform-preclaim-terminal";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
      transaction as PgTransactionSql,
      {
        run: {
          id: runId,
          runNumber: 8601,
          workflowId: "feature-dev",
          task: "Compile the exact setup packet",
          context: JSON.stringify({ task: "Compile the exact setup packet" }),
          notifyUrl: null,
          createdAt: "2026-07-15T12:00:00.000Z",
          protocol: {
            mode: "v3",
            version: 1,
            compilerReleaseSha: releaseSha,
            activationPreflightHash: hashCanonicalJson({
              fixture: "v3-release-preflight",
              releaseSha,
            }),
            releaseAdmissionHash,
            releaseAdmissionKind: "release_go",
            canaryAdmission: null,
          },
        },
        steps: [
          { id: stepDbId, stepId: "setup-build", agentId: claimAgentId, stepIndex: 5, inputTemplate: "", expects: "", status: "pending", maxRetries: 3, type: "single", loopConfig: null },
          { id: "step-v3-platform-preclaim-implement", stepId: "implement", agentId: "feature-dev_developer", stepIndex: 6, inputTemplate: "", expects: "", status: "waiting", maxRetries: 3, type: "loop", loopConfig: null },
        ],
      },
    ));
    const runtimeIntent = {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_v3-platform-preclaim-terminal",
      runtimeAgentId: claimAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "v3-platform-preclaim-terminal-owner",
    } as const;
    const publication = await publishSingleClaimRuntime(database.sql, {
      runId,
      stepDbId,
      workflowStepId: "setup-build",
      claimAgentId,
      runtimeIntent,
      now: new Date("2026-07-15T12:00:00.000Z"),
    });
    assert.ok(publication?.runtime);
    assert.equal(publication.protocol, "v3");
    assert.deepEqual(publication.runtime, {
      sessionId: "RTS_v3-platform-preclaim-terminal",
      ownerInstanceId: "v3-platform-preclaim-terminal-owner",
    });
    const claimId = publication.claimId;
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: publication.protocol,
      issuedAt: "2026-07-15T12:00:00.000Z",
      stepId: stepDbId,
      workflowStepId: "setup-build",
      runId,
      claimId,
      claimAgentId,
      runtimeAgentId: claimAgentId,
    };

    const diagnostic = "PRODUCT_BUILD_PACKET_V3_BLOCKED: SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED";
    const operationalFailureCause = {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "setup-build",
      boundary: "product_compiler.setup_build_packet",
      failureClass: "contract_invalid",
      failureCode: "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
    } as const;
    const failInput = [
      stepDbId,
      diagnostic,
      envelope,
      {
        singleStepMode: "terminal_platform_preclaim" as const,
        operationalFailureCause,
      },
    ] as const;
    const { failStep } = await import("../../src/installer/step-fail.js");
    const readTerminalPrefix = async () => {
      const rows = await database.sql<Array<{
        step_status: string;
        claim_outcome: string | null;
        runtime_state: string;
        runtime_agent_id: string;
        owner_instance_id: string;
        termination_count: number;
        completion_count: number;
        completion_effect_count: number;
        completion_owner_count: number;
        claim_owner_state: string;
        runtime_owner_state: string;
      }>>`
        SELECT step.status AS step_status,
               claim.outcome AS claim_outcome,
               runtime.state AS runtime_state,
               runtime.runtime_agent_id,
               runtime.owner_instance_id,
               (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count,
               (SELECT COUNT(*)::integer FROM runtime_completion_requests WHERE run_id = ${runId}) AS completion_count,
               (SELECT COUNT(*)::integer FROM runtime_completion_effects effect
                 JOIN runtime_completion_requests request ON request.request_id = effect.request_id
                WHERE request.run_id = ${runId}) AS completion_effect_count,
               (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1
                 WHERE category = 'completion-owner') AS completion_owner_count,
               (SELECT MIN(state) FROM internal_production_owner_reservations_v1
                 WHERE category = 'claim' AND owner_key = claim.id::text) AS claim_owner_state,
               (SELECT MIN(state) FROM internal_production_owner_reservations_v1
                 WHERE category = 'runtime-session' AND owner_key = runtime.session_id) AS runtime_owner_state
          FROM steps step
          JOIN claim_log claim ON claim.id = ${claimId}
          JOIN runtime_sessions runtime ON runtime.session_id = ${publication.runtime.sessionId}
         WHERE step.id = ${stepDbId}
      `;
      assert.equal(rows.length, 1);
      return { ...rows[0]! };
    };
    const initialPrefix = await readTerminalPrefix();
    const readRuntimeCardinalityPrefix = async () => {
      const rows = await database.sql<Array<{
        step_status: string;
        claim_outcome: string | null;
        runtime_count: number;
        termination_count: number;
        claim_owner_state: string;
        runtime_owner_state: string;
      }>>`
        SELECT step.status AS step_status,claim.outcome AS claim_outcome,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE claim_id=${claimId}) AS runtime_count,
               (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id=${runId}) AS termination_count,
               (SELECT MIN(state) FROM internal_production_owner_reservations_v1
                 WHERE category='claim' AND owner_key=${String(claimId)}) AS claim_owner_state,
               (SELECT MIN(state) FROM internal_production_owner_reservations_v1
                 WHERE category='runtime-session' AND owner_key=${publication.runtime!.sessionId}) AS runtime_owner_state
          FROM steps step JOIN claim_log claim ON claim.id=${claimId}
         WHERE step.id=${stepDbId}
      `;
      assert.equal(rows.length, 1);
      return { ...rows[0]! };
    };
    await database.sql.unsafe(`CREATE TABLE p3_platform_preclaim_runtime_backup_v1 AS
      SELECT * FROM runtime_sessions WHERE session_id=$1`, [publication.runtime.sessionId]);
    await database.sql`DELETE FROM runtime_sessions WHERE session_id=${publication.runtime.sessionId}`;
    const missingRuntimePrefix = await readRuntimeCardinalityPrefix();
    await assert.rejects(
      failStep(...failInput),
      /PLATFORM_PRECLAIM_RESERVED_RUNTIME_AUTHORITY_INVALID/,
    );
    assert.deepEqual(await readRuntimeCardinalityPrefix(), missingRuntimePrefix);
    await database.sql.unsafe("INSERT INTO runtime_sessions SELECT * FROM p3_platform_preclaim_runtime_backup_v1");
    await database.sql.unsafe("ALTER TABLE runtime_sessions DROP CONSTRAINT runtime_sessions_claim_id_key");
    const extraRuntimeSessionId = "RTS_v3-platform-preclaim-terminal-extra";
    await database.sql.unsafe(`UPDATE p3_platform_preclaim_runtime_backup_v1
      SET session_id=$1,owner_instance_id=$2`, [
      extraRuntimeSessionId,
      "v3-platform-preclaim-terminal-extra-owner",
    ]);
    await database.sql.unsafe("INSERT INTO runtime_sessions SELECT * FROM p3_platform_preclaim_runtime_backup_v1");
    const multipleRuntimePrefix = await readRuntimeCardinalityPrefix();
    await assert.rejects(
      failStep(...failInput),
      /PLATFORM_PRECLAIM_RESERVED_RUNTIME_AUTHORITY_INVALID/,
    );
    assert.deepEqual(await readRuntimeCardinalityPrefix(), multipleRuntimePrefix);
    await database.sql`DELETE FROM runtime_sessions
      WHERE session_id=${extraRuntimeSessionId}`;
    await database.sql.unsafe(
      "ALTER TABLE runtime_sessions ADD CONSTRAINT runtime_sessions_claim_id_key UNIQUE (claim_id)",
    );
    await database.sql.unsafe("DROP TABLE p3_platform_preclaim_runtime_backup_v1");
    assert.deepEqual(await readTerminalPrefix(), initialPrefix);
    await database.sql.unsafe(`CREATE FUNCTION reject_platform_preclaim_lock_order_mutation_v1() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'TEST_PLATFORM_PRECLAIM_LOCK_ORDER_MUTATION_REJECTED';
      END $$`);
    await database.sql.unsafe(`CREATE TRIGGER reject_platform_preclaim_lock_order_mutation_v1
      BEFORE UPDATE ON claim_log FOR EACH ROW
      EXECUTE FUNCTION reject_platform_preclaim_lock_order_mutation_v1()`);
    let releaseRunLock!: () => void;
    const runLockRelease = new Promise<void>((resolve) => { releaseRunLock = resolve; });
    let announceRunLock!: (pid: number) => void;
    const runLockReady = new Promise<number>((resolve) => { announceRunLock = resolve; });
    const blocker = database.sql.begin(async (transaction) => {
      const pidRows = await transaction<Array<{ pid: number }>>`SELECT pg_backend_pid()::integer AS pid`;
      await transaction`SELECT id FROM runs WHERE id=${runId} FOR UPDATE`;
      announceRunLock(pidRows[0]!.pid);
      await runLockRelease;
      await transaction.unsafe("SET LOCAL lock_timeout='1500ms'");
      await transaction`SELECT session_id FROM runtime_sessions
        WHERE session_id=${publication.runtime!.sessionId} FOR UPDATE`;
      throw new Error("TEST_PLATFORM_PRECLAIM_LOCK_ORDER_RELEASE");
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "TEST_PLATFORM_PRECLAIM_LOCK_ORDER_RELEASE") return;
      throw error;
    });
    const blockerPid = await runLockReady;
    const concurrentFailure = failStep(...failInput).then(
      () => ({ error: null as unknown }),
      (error: unknown) => ({ error }),
    );
    let observedBlockedOnRun = false;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const waiting = await database.sql<Array<{ blocked: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity activity
           WHERE ${blockerPid}=ANY(pg_blocking_pids(activity.pid))
        ) AS blocked
      `;
      if (waiting[0]?.blocked) {
        observedBlockedOnRun = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(observedBlockedOnRun, true, "terminal failStep must wait behind the canonical run lock");
    releaseRunLock();
    await blocker;
    const concurrentResult = await concurrentFailure;
    assert.match(
      String(concurrentResult.error),
      /TEST_PLATFORM_PRECLAIM_LOCK_ORDER_MUTATION_REJECTED/,
    );
    assert.deepEqual(await readTerminalPrefix(), initialPrefix);
    await database.sql.unsafe("DROP TRIGGER reject_platform_preclaim_lock_order_mutation_v1 ON claim_log");
    await database.sql.unsafe("DROP FUNCTION reject_platform_preclaim_lock_order_mutation_v1()");
    const crossedEnvelope = { ...envelope, runtimeAgentId: "crossed-runtime-agent" };
    await assert.rejects(
      failStep(stepDbId, diagnostic, crossedEnvelope, failInput[3]),
      /(?:CLAIM_ENVELOPE|PLATFORM_PRECLAIM)_.*(?:MISMATCH|INVALID|REQUIRED)/,
    );
    assert.deepEqual(await readTerminalPrefix(), initialPrefix);
    for (const [column, hostile] of [
      ["runtime_agent_id", "crossed-runtime-agent"],
      ["owner_instance_id", ""],
      ["step_db_id", "step-v3-platform-preclaim-implement"],
      ["workflow_step_id", "implement"],
    ] as const) {
      const original = column === "runtime_agent_id"
        ? runtimeIntent.runtimeAgentId
        : column === "owner_instance_id"
          ? runtimeIntent.ownerInstanceId
          : column === "step_db_id"
            ? stepDbId
            : "setup-build";
      await database.sql.unsafe(
        `UPDATE runtime_sessions SET ${column}=$1 WHERE session_id=$2`,
        [hostile, publication.runtime.sessionId],
      );
      const crossedPrefix = await readTerminalPrefix();
      try {
        await assert.rejects(
          failStep(...failInput),
          /PLATFORM_PRECLAIM_RESERVED_RUNTIME_AUTHORITY_INVALID/,
        );
        assert.deepEqual(await readTerminalPrefix(), crossedPrefix);
      } finally {
        await database.sql.unsafe(
          `UPDATE runtime_sessions SET ${column}=$1 WHERE session_id=$2`,
          [original, publication.runtime.sessionId],
        );
      }
    }
    for (const state of ["starting", "running", "drain_requested", "drained", "released", "quarantined"] as const) {
      await database.sql`
        UPDATE runtime_sessions
           SET state=${state},
               started_at=CASE WHEN ${state} IN ('starting','running') THEN NOW() ELSE started_at END,
               drain_requested_at=CASE WHEN ${state} IN ('drain_requested','drained','released') THEN NOW() ELSE drain_requested_at END,
               drained_at=CASE WHEN ${state} IN ('drained','released') THEN NOW() ELSE NULL END,
               released_at=CASE WHEN ${state}='released' THEN NOW() ELSE NULL END,
               diagnostic=CASE WHEN ${state}='quarantined' THEN 'p3 hostile state' ELSE NULL END
         WHERE session_id=${publication.runtime.sessionId}
      `;
      const nonReservedPrefix = await readTerminalPrefix();
      try {
        const expectedRefusal = state === "quarantined"
          ? /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:runtime_quarantine:quarantined/
          : ["starting", "running", "drain_requested"].includes(state)
            ? new RegExp(`CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:runtime_session:${state}`)
            : /PLATFORM_PRECLAIM_RESERVED_RUNTIME_AUTHORITY_INVALID/;
        await assert.rejects(
          failStep(...failInput),
          expectedRefusal,
        );
        assert.deepEqual(await readTerminalPrefix(), nonReservedPrefix);
      } finally {
        await database.sql`
          UPDATE runtime_sessions
             SET state='reserved',started_at=NULL,drain_requested_at=NULL,
                 drained_at=NULL,released_at=NULL,diagnostic=NULL
           WHERE session_id=${publication.runtime.sessionId}
        `;
      }
    }
    await database.sql.unsafe(`
      CREATE FUNCTION reject_platform_preclaim_runtime_owner_close_v1() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.category='runtime-session' AND NEW.state='closed' THEN
          RAISE EXCEPTION 'TEST_PLATFORM_PRECLAIM_RUNTIME_OWNER_CLOSE_REJECTED';
        END IF;
        RETURN NEW;
      END $$
    `);
    await database.sql.unsafe(`
      CREATE TRIGGER reject_platform_preclaim_runtime_owner_close_v1
      BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
      FOR EACH ROW EXECUTE FUNCTION reject_platform_preclaim_runtime_owner_close_v1()
    `);
    await assert.rejects(failStep(...failInput), /TEST_PLATFORM_PRECLAIM_RUNTIME_OWNER_CLOSE_REJECTED/);
    assert.deepEqual(await readTerminalPrefix(), {
      step_status: "running",
      claim_outcome: null,
      runtime_state: "reserved",
      runtime_agent_id: claimAgentId,
      owner_instance_id: runtimeIntent.ownerInstanceId,
      termination_count: 0,
      completion_count: 0,
      completion_effect_count: 0,
      completion_owner_count: 0,
      claim_owner_state: "bound",
      runtime_owner_state: "bound",
    });
    await database.sql.unsafe("DROP TRIGGER reject_platform_preclaim_runtime_owner_close_v1 ON internal_production_owner_reservations_v1");
    await database.sql.unsafe("DROP FUNCTION reject_platform_preclaim_runtime_owner_close_v1()");

    const result = await failStep(...failInput);
    assert.deepEqual(result, { retrying: false, runFailed: true });

    const rows = await database.sql<Array<{
      step_status: string;
      retry_count: number;
      max_retries: number;
      claim_outcome: string;
      claim_diagnostic: string;
      run_status: string;
      completion_count: number;
      completion_effect_count: number;
      completion_owner_count: number;
      claim_count: number;
      termination_state: string;
      termination_evidence: Record<string, unknown>;
      implement_status: string;
      claim_owner_count: number;
      claim_owner_implementation: string;
      claim_owner_state: string;
      runtime_state: string;
      runtime_owner_count: number;
      runtime_owner_implementation: string;
      runtime_owner_state: string;
      termination_owner_count: number;
      termination_owner_implementation: string;
      termination_owner_state: string;
    }>>`
      SELECT step.status AS step_status,
             step.retry_count,
             step.max_retries,
             claim.outcome AS claim_outcome,
             claim.diagnostic AS claim_diagnostic,
             run.status AS run_status,
             (SELECT COUNT(*)::integer FROM runtime_completion_requests WHERE run_id = run.id) AS completion_count,
             (SELECT COUNT(*)::integer FROM runtime_completion_effects effect
               JOIN runtime_completion_requests request ON request.request_id = effect.request_id
              WHERE request.run_id = run.id) AS completion_effect_count,
             (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'completion-owner') AS completion_owner_count,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
             termination.state AS termination_state,
             termination.evidence AS termination_evidence,
             implement.status AS implement_status,
             (SELECT COUNT(*)::integer
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'claim'
                 AND reservation.owner_key = claim.id::text) AS claim_owner_count,
             (SELECT MIN(reservation.producer_implementation_id)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'claim'
                 AND reservation.owner_key = claim.id::text) AS claim_owner_implementation,
             (SELECT MIN(reservation.state)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'claim'
                 AND reservation.owner_key = claim.id::text) AS claim_owner_state,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'runtime-session'
                 AND reservation.owner_key = runtime.session_id) AS runtime_owner_count,
             (SELECT MIN(reservation.producer_implementation_id)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'runtime-session'
                 AND reservation.owner_key = runtime.session_id) AS runtime_owner_implementation,
             (SELECT MIN(reservation.state)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'runtime-session'
                 AND reservation.owner_key = runtime.session_id) AS runtime_owner_state,
             (SELECT COUNT(*)::integer
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'termination'
                 AND reservation.owner_key = termination.request_id) AS termination_owner_count,
             (SELECT MIN(reservation.producer_implementation_id)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'termination'
                 AND reservation.owner_key = termination.request_id) AS termination_owner_implementation,
             (SELECT MIN(reservation.state)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'termination'
                 AND reservation.owner_key = termination.request_id) AS termination_owner_state
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
        JOIN steps implement ON implement.id = 'step-v3-platform-preclaim-implement'
        JOIN claim_log claim ON claim.id = ${claimId}
        JOIN runtime_sessions runtime ON runtime.session_id = ${publication.runtime.sessionId}
        JOIN run_termination_requests termination ON termination.run_id = run.id
       WHERE run.id = ${runId}
    `;
    const owner = rows[0]!;
    assert.equal(owner.step_status, "failed");
    assert.equal(owner.retry_count, 0);
    assert.equal(owner.max_retries, 3, "platform terminalization must not rewrite configured stage retry budgets");
    assert.equal(owner.claim_outcome, "failed");
    assert.match(owner.claim_diagnostic, /^PLATFORM_PRECLAIM_TERMINAL \[setup-build\]:/);
    assert.equal(owner.run_status, "failing", "the termination ledger owns the final failed transition");
    assert.equal(owner.completion_count, 0, "preclaim failure has no model completion request");
    assert.equal(owner.completion_effect_count, 0, "preclaim failure has no model completion effect");
    assert.equal(owner.completion_owner_count, 0, "preclaim failure has no completion owner");
    assert.equal(owner.claim_count, 1, "unchanged platform source must not be sent to another model claim");
    assert.equal(owner.termination_state, "requested");
    assert.equal(owner.termination_evidence.failureOwner, "platform_preclaim");
    assert.equal(owner.termination_evidence.retryPolicy, "terminal");
    assert.deepEqual(owner.termination_evidence.operationalFailureCause, {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "setup-build",
      boundary: "product_compiler.setup_build_packet",
      failureClass: "contract_invalid",
      failureCode: "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
    });
    assert.equal(owner.implement_status, "waiting");
    assert.equal(owner.claim_owner_count, 1);
    assert.equal(owner.claim_owner_implementation, "a-claim-single-runtime-v1");
    assert.equal(owner.claim_owner_state, "closed");
    assert.equal(owner.runtime_state, "released");
    assert.equal(owner.runtime_owner_count, 1);
    assert.equal(owner.runtime_owner_implementation, "a-runtime-session-v1");
    assert.equal(owner.runtime_owner_state, "closed");
    assert.equal(owner.termination_owner_count, 1);
    assert.equal(owner.termination_owner_implementation, "a-termination-v1");
    assert.equal(owner.termination_owner_state, "bound");

    const headBeforeReplay = await database.sql<Array<{ head_version: string; head_hash: string; reservation_count: number }>>`
      SELECT head_version::text AS head_version, head_hash,
             (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1) AS reservation_count
        FROM internal_production_owner_admission_head_v1
       WHERE singleton = TRUE
    `;
    const retry = await (await import("../../src/installer/step-ops.js")).claimStep(
      claimAgentId,
      "v3-platform-preclaim-retry-forbidden",
      runtimeIntent,
    );
    assert.deepEqual(retry, { found: false });
    const headAfterReplay = await database.sql<Array<{ head_version: string; head_hash: string; reservation_count: number }>>`
      SELECT head_version::text AS head_version, head_hash,
             (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1) AS reservation_count
        FROM internal_production_owner_admission_head_v1
       WHERE singleton = TRUE
    `;
    assert.deepEqual(headAfterReplay, headBeforeReplay, "response-loss replay must not transition the owner head or add reservations");
    const counts = await database.sql<Array<{
      claim_count: number;
      source_unavailable_count: number;
      termination_count: number;
      requested_termination_count: number;
    }>>`
      SELECT COUNT(*)::integer AS claim_count,
             COUNT(*) FILTER (WHERE diagnostic LIKE 'V3_STAGE_RETRY_SOURCE_UNAVAILABLE%')::integer AS source_unavailable_count,
             (SELECT COUNT(*)::integer
                FROM run_termination_requests
               WHERE run_id = ${runId}) AS termination_count,
             (SELECT COUNT(*)::integer
                FROM run_termination_requests
               WHERE run_id = ${runId}
                 AND state = 'requested') AS requested_termination_count
        FROM claim_log
       WHERE run_id = ${runId}
    `;
    assert.deepEqual({ ...counts[0] }, {
      claim_count: 1,
      source_unavailable_count: 0,
      termination_count: 1,
      requested_termination_count: 1,
    });
  } finally {
    await runtimeDb?.pgClose();
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});

test("v3 platform preclaim refuses an unexpected model completion owner atomically", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    await runtimeDb.initializeInternalProductionCurrentEntryDatabaseV1();
    const runId = "run-v3-platform-preclaim-completion-cross";
    const stepDbId = "step-v3-platform-preclaim-completion-cross";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "e".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
      transaction as PgTransactionSql,
      {
        run: {
          id: runId,
          runNumber: 8602,
          workflowId: "feature-dev",
          task: "Reject a crossed completion owner",
          context: JSON.stringify({ task: "Reject a crossed completion owner" }),
          notifyUrl: null,
          createdAt: "2026-07-15T12:01:00.000Z",
          protocol: {
            mode: "v3",
            version: 1,
            compilerReleaseSha: releaseSha,
            activationPreflightHash: hashCanonicalJson({
              fixture: "v3-release-preflight",
              releaseSha,
            }),
            releaseAdmissionHash,
            releaseAdmissionKind: "release_go",
            canaryAdmission: null,
          },
        },
        steps: [
          { id: stepDbId, stepId: "setup-build", agentId: claimAgentId, stepIndex: 5, inputTemplate: "", expects: "", status: "pending", maxRetries: 3, type: "single", loopConfig: null },
        ],
      },
    ));
    const runtimeIntent = {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_v3-platform-preclaim-completion-cross",
      runtimeAgentId: claimAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "v3-platform-preclaim-completion-cross-owner",
    } as const;
    const publication = await publishSingleClaimRuntime(database.sql, {
      runId,
      stepDbId,
      workflowStepId: "setup-build",
      claimAgentId,
      runtimeIntent,
      now: new Date("2026-07-15T12:01:00.000Z"),
    });
    if (!publication.runtime) throw new Error("test runtime publication missing");
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-15T12:01:00.000Z",
      stepId: stepDbId,
      workflowStepId: "setup-build",
      runId,
      claimId: publication.claimId,
      claimAgentId,
      runtimeAgentId: claimAgentId,
    };
    const requested = await requestRuntimeCompletion(database.sql, {
      envelope,
      output: "unexpected model completion before platform preclaim",
      requestId: "RCR_platform-preclaim-cross01",
    });
    if (requested.status !== "requested") throw new Error("test completion request missing");
    const completions = createRuntimeCompletionRepository(database.sql);
    await completions.claim({
      requestId: requested.request.requestId,
      ownerInstanceId: "platform-preclaim-crossed-completion-owner",
    });
    await database.sql`
      UPDATE runtime_sessions SET state='drained',drain_requested_at=NOW(),drained_at=NOW()
       WHERE session_id=${runtimeIntent.sessionId}
    `;
    await completions.markProcessing({
      requestId: requested.request.requestId,
      ownerInstanceId: "platform-preclaim-crossed-completion-owner",
    });
    await database.sql`
      UPDATE runtime_sessions SET state='reserved',drain_requested_at=NULL,drained_at=NULL
       WHERE session_id=${runtimeIntent.sessionId}
    `;
    const capability = await completions.findById(requested.request.requestId);
    if (!capability?.ownerInstanceId || !capability.leaseExpiresAt) {
      throw new Error("test completion owner capability missing");
    }
    const before = (await database.sql<Array<{
      claim_outcome: string | null;
      step_status: string;
      runtime_state: string;
      termination_count: number;
      request_state: string;
      apply_phase: string;
    }>>`
      SELECT claim.outcome AS claim_outcome,step.status AS step_status,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id=${runId}) AS termination_count,
             request.state AS request_state,request.apply_phase
        FROM claim_log claim
        JOIN steps step ON step.id=${stepDbId}
        JOIN runtime_sessions runtime ON runtime.claim_id=claim.id
        JOIN runtime_completion_requests request ON request.claim_id=claim.id
       WHERE claim.id=${publication.claimId}
    `)[0]!;
    const { failStep } = await import("../../src/installer/step-fail.js");
    await assert.rejects(
      runWithRuntimeCompletionOwner({
        requestId: capability.requestId,
        ownerInstanceId: capability.ownerInstanceId,
        leaseExpiresAt: capability.leaseExpiresAt,
        ownerAttemptCount: capability.ownerAttemptCount,
      }, () => failStep(stepDbId, "PLATFORM_PRECLAIM_TERMINAL: crossed completion", envelope, {
        singleStepMode: "terminal_platform_preclaim",
      })),
      /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:runtime_completion:processing/,
    );
    const after = (await database.sql<Array<typeof before>>`
      SELECT claim.outcome AS claim_outcome,step.status AS step_status,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id=${runId}) AS termination_count,
             request.state AS request_state,request.apply_phase
        FROM claim_log claim
        JOIN steps step ON step.id=${stepDbId}
        JOIN runtime_sessions runtime ON runtime.claim_id=claim.id
        JOIN runtime_completion_requests request ON request.claim_id=claim.id
       WHERE claim.id=${publication.claimId}
    `)[0]!;
    assert.deepEqual({ ...after }, { ...before });

    const defensiveDiagnostic = "PLATFORM_PRECLAIM_TERMINAL: defensive accepted completion";
    const defensivePlan = createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_failure",
      continuation: { type: "failure_finalize" },
      effectPayload: { stepStatus: "failed", outcome: "failed" },
    });
    await database.sql`
      UPDATE runtime_sessions SET state='drained',drain_requested_at=NOW(),drained_at=NOW()
       WHERE session_id=${runtimeIntent.sessionId}
    `;
    await runWithRuntimeCompletionOwner({
      requestId: capability.requestId,
      ownerInstanceId: capability.ownerInstanceId,
      leaseExpiresAt: capability.leaseExpiresAt,
      ownerAttemptCount: capability.ownerAttemptCount,
    }, () => database.sql.begin(async (transaction) => {
      await closeExactSingleStepClaimInTransaction(transaction, {
        envelope,
        outcome: "failed",
        diagnostic: defensiveDiagnostic,
      });
      await transaction.unsafe(
        "UPDATE steps SET status='failed',output=$2,retry_count=0,updated_at=NOW() WHERE id=$1",
        [stepDbId, defensiveDiagnostic],
      );
      assert.equal(await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
        claimId: publication.claimId,
        claimOutcome: "failed",
        plan: defensivePlan,
      }), true);
    }));
    const completionResult = { advanced: false, runCompleted: false, runFailed: true };
    const effects = createRuntimeCompletionEffectRepository(database.sql);
    for (;;) {
      const effect = await effects.claimNext({
        requestId: capability.requestId,
        ownerInstanceId: capability.ownerInstanceId,
      });
      if (!effect) break;
      if (!effect.leaseToken) throw new Error("defensive completion effect lease missing");
      await effects.settle({
        requestId: capability.requestId,
        effectKey: effect.effectKey,
        ownerInstanceId: capability.ownerInstanceId,
        leaseToken: effect.leaseToken,
        resolution: "applied",
        result: completionResult,
        evidence: { source: "platform-preclaim-defensive-guard-test" },
      });
    }
    await completions.markEffectsCommitted({
      requestId: capability.requestId,
      ownerInstanceId: capability.ownerInstanceId,
      ownerAttemptCount: capability.ownerAttemptCount,
      result: completionResult,
    });
    await completions.acceptAndRelease({
      requestId: capability.requestId,
      ownerInstanceId: capability.ownerInstanceId,
      ownerAttemptCount: capability.ownerAttemptCount,
      result: completionResult,
    });
    await database.sql`
      UPDATE claim_log SET outcome=NULL,duration_ms=NULL,diagnostic=NULL,abandoned_at=NULL
       WHERE id=${publication.claimId}
    `;
    await database.sql`
      UPDATE steps SET status='running',output='',retry_count=0 WHERE id=${stepDbId}
    `;
    await database.sql`
      UPDATE runtime_sessions
         SET state='reserved',started_at=NULL,drain_requested_at=NULL,drained_at=NULL,
             released_at=NULL,diagnostic=NULL
       WHERE session_id=${runtimeIntent.sessionId}
    `;
    const defensiveBefore = (await database.sql<Array<{
      claim_outcome: string | null;
      step_status: string;
      runtime_state: string;
      termination_count: number;
      request_state: string;
      apply_phase: string;
    }>>`
      SELECT claim.outcome AS claim_outcome,step.status AS step_status,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id=${runId}) AS termination_count,
             request.state AS request_state,request.apply_phase
        FROM claim_log claim
        JOIN steps step ON step.id=${stepDbId}
        JOIN runtime_sessions runtime ON runtime.claim_id=claim.id
        JOIN runtime_completion_requests request ON request.claim_id=claim.id
       WHERE claim.id=${publication.claimId}
    `)[0]!;
    await assert.rejects(
      failStep(stepDbId, defensiveDiagnostic, envelope, {
        singleStepMode: "terminal_platform_preclaim",
      }),
      /PLATFORM_PRECLAIM_COMPLETION_OWNER_MUST_BE_ABSENT/,
    );
    const defensiveAfter = (await database.sql<Array<typeof defensiveBefore>>`
      SELECT claim.outcome AS claim_outcome,step.status AS step_status,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id=${runId}) AS termination_count,
             request.state AS request_state,request.apply_phase
        FROM claim_log claim
        JOIN steps step ON step.id=${stepDbId}
        JOIN runtime_sessions runtime ON runtime.claim_id=claim.id
        JOIN runtime_completion_requests request ON request.claim_id=claim.id
       WHERE claim.id=${publication.claimId}
    `)[0]!;
    assert.deepEqual({ ...defensiveAfter }, { ...defensiveBefore });
  } finally {
    await runtimeDb?.pgClose();
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
