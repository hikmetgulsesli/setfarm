import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type postgres from "postgres";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1,
  type PgTransactionSql,
} from "../../src/db-pg.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import {
  createRuntimeSessionRepository,
} from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
  requestRunTerminationInTransaction,
} from "../../src/execution/run-termination.js";
import {
  operationalFailureCauseHashV1,
  type OperationalFailureCauseV1,
} from "../../src/execution/schemas/operational-failure-cause-v1.js";
import { transitionRunToTerminal } from "../../src/execution/run-terminal-transition.js";
import { buildRunOperationalSnapshot } from "../../src/server/run-operational-snapshot.js";
import {
  DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
} from "../../src/product-compiler/design-source-runtime-v2.js";
import { createInternalProductionTerminationCanonicalOwnerIdentityV1 } from "../../src/internal-production/owner-admission-v1.js";
import { exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/drain-proof"],
};

const SETUP_BUILD_CAUSE: OperationalFailureCauseV1 = {
  schema: "setfarm.operational-failure-cause.v1",
  workflowStepId: "setup-build",
  boundary: "stitch.converter.generated_tsx",
  failureClass: "generated_artifact_invalid",
  failureCode: "V3_OBSERVABLE_REF_INVALID",
};

const SETUP_BUILD_BINDING_CAUSE: OperationalFailureCauseV1 = {
  ...SETUP_BUILD_CAUSE,
  failureCode: "V3_OBSERVABLE_SELECTOR_INVALID",
};

async function bindRunOwner(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
): Promise<void> {
  await database.sql.begin(async (transaction) => {
    const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
    const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
      transaction as PgTransactionSql,
      { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
    );
    await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: identity,
    });
  });
}

async function seedOwnedRuntime(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  runtimeState: "starting" | "running" = "running",
) {
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  await database.insertRun(runId);
  await bindRunOwner(database, runId);
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
  const claimId = await database.sql.begin(async (transaction) => {
    const rows = await (transaction as PgTransactionSql)<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      "a-claim-loop-runtime-v1",
      rows,
    );
    return insertAndBindInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      birth,
      {
        runId,
        workflowStepId: "implement",
        storyId: "US-001",
        claimAgentId: "feature-dev_developer",
        claimedAt: new Date(),
      },
    );
  }) as number;
  const attempts = createAttemptRepository(database.sql, {
    attemptId: () => `ATT_${runId}-attempt`,
    fenceToken: () => "f".repeat(64),
  });
  const attempt = await attempts.reserve(exactProductReservation({
    claimId,
    runId,
    storyId: "US-001",
    agentId: "feature-dev_developer",
    evidenceRefs: [`setfarm://claim-log/${claimId}`],
  }));
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.reserve({
    sessionId: `RTS_${runId}-session`,
    runId,
    stepDbId,
    workflowStepId: "implement",
    storyDbId,
    storyId: "US-001",
    claimId,
    attemptId: attempt.attempt.attemptId,
    claimAgentId: "feature-dev_developer",
    runtimeAgentId: "prism",
    runtimeKind: "openclaw_session",
    ownerInstanceId: "spawner-a",
  });
  await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: "spawner-a" });
  if (runtimeState === "running") {
    await sessions.markRunning({
      sessionId: session.sessionId,
      ownerInstanceId: "spawner-a",
      sessionKey: `key-${runId}`,
    });
  }
  return { stepDbId, storyDbId, claimId, attempt, sessions, sessionId: session.sessionId };
}

describe("durable two-phase run termination", () => {
  it("binds the sole termination owner at request birth and exactly adopts ACK-loss replay", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-owner-birth";
      const requestId = "RTR_termination-owner-birth01";
      const seeded = await seedOwnedRuntime(database, runId);
      const completionRequestId = "RCR_termination-owner-birth01";
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: {
          schema: "setfarm.claim-envelope.v1",
          protocol: "shadow",
          issuedAt: "2026-07-13T12:00:00.000Z",
          stepId: seeded.stepDbId,
          workflowStepId: "implement",
          runId,
          storyId: "US-001",
          storyDbId: seeded.storyDbId,
          claimId: seeded.claimId,
          claimAgentId: "feature-dev_developer",
          runtimeAgentId: "prism",
          claimGeneration: 1,
          attempt: {
            attemptId: seeded.attempt.attempt.attemptId,
            generation: seeded.attempt.attempt.generation,
            fenceToken: seeded.attempt.attempt.fenceToken,
          },
        },
        output: "STATUS: done\nCHANGES: termination ACK replay boundary",
        requestId: completionRequestId,
      });
      assert.equal(completion.status, "requested");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: completionRequestId,
        ownerInstanceId: "task6-ack-boundary",
      });
      const input = {
        runId,
        targetStatus: "failed" as const,
        requestedBy: "task6-owner-birth",
        diagnostic: "bind the termination request owner",
        evidence: { source: "task6-red" },
        requestId,
      };

      const headBeforeBirth = BigInt((await database.sql<Array<{ head_version: string }>>`
        SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton
      `)[0]!.head_version);
      const ackLossSql = new Proxy(database.sql, {
        get(target, property, receiver) {
          if (property !== "begin") return Reflect.get(target, property, receiver);
          return async (callback: (transaction: postgres.TransactionSql) => Promise<unknown>) => {
            await database.sql.begin(callback);
            throw new Error("TEST_RUN_TERMINATION_ACK_LOST");
          };
        },
      });
      await assert.rejects(
        requestRunTermination(ackLossSql, input),
        /TEST_RUN_TERMINATION_ACK_LOST/,
      );
      const afterBirth = await database.sql<Array<{
        state: string;
        owner_key: string;
        close_ref: string | null;
        owner_count: number;
      }>>`
        SELECT owner.state,owner.owner_key,owner.close_ref,
               COUNT(*) OVER ()::integer AS owner_count
          FROM internal_production_owner_reservations_v1 owner
         WHERE owner.category='termination'
           AND owner.producer_implementation_id='a-termination-v1'
           AND owner.owner_key=${requestId}
      `;
      assert.deepEqual(afterBirth.map((row) => ({ ...row })), [{
        state: "bound",
        owner_key: requestId,
        close_ref: null,
        owner_count: 1,
      }]);
      const headAfterBirth = (await database.sql<Array<{ head_version: string }>>`
        SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton
      `)[0]!.head_version;
      assert.ok(BigInt(headAfterBirth) > headBeforeBirth);

      const preempted = await completions.preemptForRunTermination({
        requestId: completionRequestId,
        diagnostic: "completion boundary moved after termination ACK",
      });
      assert.equal(preempted.status, "preempted");
      const headBeforeReplay = (await database.sql<Array<{ head_version: string }>>`
        SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton
      `)[0]!.head_version;

      const replay = await requestRunTermination(database.sql, input);
      assert.equal(replay.status, "existing");
      const afterReplay = await database.sql<Array<{
        owner_count: number;
        binding_count: number;
        head_version: string;
      }>>`
        SELECT COUNT(*)::integer AS owner_count,
               COUNT(*) FILTER (WHERE state='bound')::integer AS binding_count,
               (SELECT head_version::text
                  FROM internal_production_owner_admission_head_v1
                 WHERE singleton) AS head_version
          FROM internal_production_owner_reservations_v1
         WHERE category='termination'
           AND producer_implementation_id='a-termination-v1'
           AND owner_key=${requestId}
      `;
      assert.deepEqual({ ...afterReplay[0] }, {
        owner_count: 1,
        binding_count: 1,
        head_version: headBeforeReplay,
      });
      for (const corruptBoundOwner of [
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `UPDATE internal_production_owner_reservations_v1
              SET canonical_owner_identity=jsonb_set(
                    canonical_owner_identity,'{ownerKey}',to_jsonb('task6-forged-termination'::text)
                  )
            WHERE category='termination' AND owner_key=$1`,
          [requestId],
        ),
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `UPDATE internal_production_owner_reservations_v1
              SET binding_payload=jsonb_set(
                    binding_payload,'{reservationRef}',to_jsonb('setfarm://forged/reservation'::text)
                  )
            WHERE category='termination' AND owner_key=$1`,
          [requestId],
        ),
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `UPDATE internal_production_owner_reservations_v1
              SET binding_payload=jsonb_set(
                    binding_payload,'{reservationHash}',to_jsonb($2::text)
                  )
            WHERE category='termination' AND owner_key=$1`,
          [requestId, "0".repeat(64)],
        ),
      ]) {
        await assert.rejects(
          database.sql.begin(async (transaction) => {
            await corruptBoundOwner(transaction);
            return requestRunTerminationInTransaction(transaction, input);
          }),
          /INTERNAL_PRODUCTION_(?:TERMINATION_OWNER_ADOPTION_INVALID|OWNER_[A-Z_]*CORRUPTION)/,
        );
      }
      assert.deepEqual({ ...(await database.sql<Array<{
        owner_count: number;
        binding_count: number;
        head_version: string;
      }>>`
        SELECT COUNT(*)::integer AS owner_count,
               COUNT(*) FILTER (WHERE state='bound')::integer AS binding_count,
               (SELECT head_version::text
                  FROM internal_production_owner_admission_head_v1
                 WHERE singleton) AS head_version
          FROM internal_production_owner_reservations_v1
        WHERE category='termination'
           AND producer_implementation_id='a-termination-v1'
           AND owner_key=${requestId}
      `)[0] }, { ...afterReplay[0] });

      const crossedRunId = "run-termination-deferred-crossed";
      const crossed = await seedOwnedRuntime(database, crossedRunId);
      const crossedCompletionRequestId = "RCR_termination-deferred-crossed1";
      const crossedCompletion = await requestRuntimeCompletion(database.sql, {
        envelope: {
          schema: "setfarm.claim-envelope.v1",
          protocol: "shadow",
          issuedAt: "2026-07-13T12:00:00.000Z",
          stepId: crossed.stepDbId,
          workflowStepId: "implement",
          runId: crossedRunId,
          storyId: "US-001",
          storyDbId: crossed.storyDbId,
          claimId: crossed.claimId,
          claimAgentId: "feature-dev_developer",
          runtimeAgentId: "prism",
          claimGeneration: 1,
          attempt: {
            attemptId: crossed.attempt.attempt.attemptId,
            generation: crossed.attempt.attempt.generation,
            fenceToken: crossed.attempt.attempt.fenceToken,
          },
        },
        output: "STATUS: done\nCHANGES: crossed deferred completion boundary",
        requestId: crossedCompletionRequestId,
      });
      assert.equal(crossedCompletion.status, "requested");
      await createRuntimeCompletionRepository(database.sql).claim({
        requestId: crossedCompletionRequestId,
        ownerInstanceId: "task6-crossed-boundary",
      });
      const headBeforeDeferredBoundaryTamper = (await database.sql<Array<{ head_version: string }>>`
        SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton
      `)[0]!.head_version;
      for (const forgedBoundary of [
        "RCR_termination-deferred-absent1",
        crossedCompletionRequestId,
      ]) {
        await assert.rejects(
          database.sql.begin(async (transaction) => {
            await transaction.unsafe(
              `UPDATE run_termination_requests
                  SET evidence=jsonb_set(
                        evidence,'{deferredForCompletionRequestId}',to_jsonb($2::text)
                      ),updated_at=NOW()
                WHERE request_id=$1`,
              [requestId, forgedBoundary],
            );
            return requestRunTerminationInTransaction(transaction, input);
          }),
          /RUN_TERMINATION_DEFERRED_BOUNDARY_INVALID/,
        );
      }
      assert.equal(
        (await database.sql<Array<{ head_version: string }>>`
          SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton
        `)[0]!.head_version,
        headBeforeDeferredBoundaryTamper,
      );
      assert.equal(
        (await database.sql<Array<{ deferred_boundary: string }>>`
          SELECT evidence->>'deferredForCompletionRequestId' AS deferred_boundary
            FROM run_termination_requests WHERE request_id=${requestId}
        `)[0]!.deferred_boundary,
        completionRequestId,
      );
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          for (const state of ["requested", "draining", "drained", "quarantined", "terminalized"]) {
            await transaction.unsafe(
              `UPDATE run_termination_requests
                  SET state=$2,
                      drained_at=CASE WHEN $2 IN ('drained','terminalized')
                        THEN COALESCE(drained_at,NOW()) ELSE NULL END,
                      terminalized_at=CASE WHEN $2='terminalized' THEN NOW() ELSE NULL END,
                      updated_at=NOW()
                WHERE request_id=$1`,
              [requestId, state],
            );
            const inventory = (await transaction.unsafe<Array<{
              request_state: string;
              owner_state: string;
              run_status: string;
            }>>(
              `SELECT request.state AS request_state,owner.state AS owner_state,run_row.status AS run_status
                 FROM run_termination_requests request
                 JOIN runs run_row ON run_row.id=request.run_id
                 JOIN internal_production_owner_reservations_v1 owner
                   ON owner.category='termination' AND owner.owner_key=request.request_id
                WHERE request.request_id=$1`,
              [requestId],
            ))[0]!;
            assert.deepEqual({ ...inventory }, {
              request_state: state,
              owner_state: "bound",
              run_status: "running",
            });
          }
          throw new Error("TEST_TERMINATION_DIRECT_STATE_BYPASS_ROLLBACK");
        }),
        /TEST_TERMINATION_DIRECT_STATE_BYPASS_ROLLBACK/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a termination sidecar that exists without its request row", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-partial-sidecar";
      const requestId = "RTR_termination-partial-sidecar1";
      await database.insertRun(runId);
      await database.sql.begin(async (transaction) => {
        const identity = createInternalProductionTerminationCanonicalOwnerIdentityV1({ requestId });
        await beginOrAdoptInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
          producerImplementationId: "a-termination-v1",
          ownerKey: identity.ownerKey,
        });
      });

      await assert.rejects(
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "task6-partial-sidecar",
          diagnostic: "partial sidecar must not be repaired",
          requestId,
        }),
        /INTERNAL_PRODUCTION_TERMINATION_OWNER_PARTIAL_BIRTH/,
      );
      const census = (await database.sql<Array<{
        request_count: number;
        owner_state: string;
      }>>`
        SELECT (SELECT COUNT(*)::integer FROM run_termination_requests
                 WHERE request_id=${requestId}) AS request_count,
               owner.state AS owner_state
          FROM internal_production_owner_reservations_v1 owner
         WHERE owner.reservation_payload->>'producerImplementationId'='a-termination-v1'
           AND owner.reservation_payload->>'ownerKey'=${requestId}
      `)[0]!;
      assert.deepEqual({ ...census }, { request_count: 0, owner_state: "pending" });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects ambiguous active completion boundaries before termination birth", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-ambiguous-completion";
      await database.insertRun(runId);
      const before = (await database.sql<Array<{
        request_count: number;
        termination_owner_count: number;
        head_version: string;
      }>>`
        SELECT (SELECT COUNT(*)::integer FROM run_termination_requests
                 WHERE run_id=${runId}) AS request_count,
               (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1
                 WHERE category='termination') AS termination_owner_count,
               head_version::text AS head_version
          FROM internal_production_owner_admission_head_v1 WHERE singleton
      `)[0]!;
      await assert.rejects(
        database.sql.begin((transaction) => {
          const ambiguousCompletionTransaction = new Proxy(transaction, {
            get(target, property, receiver) {
              if (property !== "unsafe") return Reflect.get(target, property, receiver);
              return (query: string, parameters?: unknown[]) => {
                if (
                  query.includes("SELECT request_id FROM runtime_completion_requests")
                  && query.includes("state IN ('draining', 'processing')")
                ) {
                  return Promise.resolve([
                    { request_id: "RCR_ambiguous-active-completion1" },
                    { request_id: "RCR_ambiguous-active-completion2" },
                  ]);
                }
                return Reflect.apply(target.unsafe, target, [query, parameters]);
              };
            },
          }) as postgres.TransactionSql;
          return requestRunTerminationInTransaction(ambiguousCompletionTransaction, {
            runId,
            targetStatus: "failed",
            requestedBy: "task6-ambiguous-completion",
            diagnostic: "ambiguous active completion must fail closed",
            requestId: "RTR_ambiguous-active-completion1",
          });
        }),
        /RUN_TERMINATION_ACTIVE_COMPLETION_AMBIGUOUS/,
      );
      const after = (await database.sql<Array<typeof before>>`
        SELECT (SELECT COUNT(*)::integer FROM run_termination_requests
                 WHERE run_id=${runId}) AS request_count,
               (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1
                 WHERE category='termination') AS termination_owner_count,
               head_version::text AS head_version
          FROM internal_production_owner_admission_head_v1 WHERE singleton
      `)[0]!;
      assert.deepEqual({ ...after }, { ...before });
    } finally {
      await database.cleanup();
    }
  });

  it("refuses termination birth before reservation or request mutation when readiness or head is corrupt", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-prebirth-refusal";
      await database.insertRun(runId);
      await database.sql.unsafe("CREATE SEQUENCE task6_termination_prebirth_probe_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION task6_termination_prebirth_probe_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          PERFORM nextval('task6_termination_prebirth_probe_v1');
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task6_termination_reservation_probe_v1
        BEFORE INSERT ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION task6_termination_prebirth_probe_v1()
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task6_termination_request_probe_v1
        BEFORE INSERT ON run_termination_requests
        FOR EACH ROW EXECUTE FUNCTION task6_termination_prebirth_probe_v1()
      `);
      const assertProbeUntouched = async () => {
        const probe = (await database.sql<Array<{ is_called: boolean }>>`
          SELECT is_called FROM task6_termination_prebirth_probe_v1
        `)[0]!;
        assert.equal(probe.is_called, false);
      };
      const input = {
        runId,
        targetStatus: "failed" as const,
        requestedBy: "task6-prebirth-refusal",
        diagnostic: "readiness and head must precede termination birth",
        requestId: "RTR_termination-prebirth-refuse1",
      };
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_producer_manifest_set_current_v1 DISABLE TRIGGER ALL",
          );
          await transaction.unsafe(
            "UPDATE internal_production_owner_producer_manifest_set_current_v1 SET activation_hash=$1 WHERE singleton_key=TRUE",
            ["0".repeat(64)],
          );
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_producer_manifest_set_current_v1 ENABLE TRIGGER ALL",
          );
          return requestRunTerminationInTransaction(transaction, input);
        }),
        /INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_(?:(?:CURRENT_)?CORRUPTION|UNAVAILABLE)/,
      );
      await assertProbeUntouched();
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_admission_head_v1 DISABLE TRIGGER ALL",
          );
          await transaction.unsafe(
            "UPDATE internal_production_owner_admission_head_v1 SET head_hash=$1 WHERE singleton=TRUE",
            ["1".repeat(64)],
          );
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_admission_head_v1 ENABLE TRIGGER ALL",
          );
          return requestRunTerminationInTransaction(transaction, input);
        }),
        /INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION/,
      );
      await assertProbeUntouched();
      const census = (await database.sql<Array<{ requests: number; owners: number }>>`
        SELECT (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id=${runId}) AS requests,
               (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1
                 WHERE category='termination' AND owner_key=${input.requestId}) AS owners
      `)[0]!;
      assert.deepEqual({ ...census }, { requests: 0, owners: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects crossed termination request identity or immutable body on replay", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-owner-crossing";
      await database.insertRun(runId);
      const original = {
        runId,
        targetStatus: "failed" as const,
        requestedBy: "task6-owner-crossing",
        diagnostic: "immutable termination request",
        evidence: { source: "task6", generation: 1 },
        requestId: "RTR_termination-owner-crossing1",
      };
      await requestRunTermination(database.sql, original);

      await assert.rejects(
        requestRunTermination(database.sql, {
          ...original,
          requestId: "RTR_termination-owner-crossing2",
        }),
        /RUN_TERMINATION_REQUEST_ID_CONFLICT/,
      );
      await assert.rejects(
        requestRunTermination(database.sql, {
          ...original,
          diagnostic: "changed immutable request body",
        }),
        /RUN_TERMINATION_REQUEST_BODY_CONFLICT/,
      );
      await assert.rejects(
        requestRunTermination(database.sql, {
          ...original,
          evidence: { source: "task6", generation: 2 },
        }),
        /RUN_TERMINATION_REQUEST_BODY_CONFLICT/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects an unbound direct-SQL termination request instead of adopting it", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-direct-sql-bypass";
      const requestId = "RTR_termination-direct-bypass1";
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO run_termination_requests (
          request_id,run_id,target_status,state,requested_by,requested_at,
          diagnostic,evidence
        ) VALUES (
          ${requestId},${runId},'failed','requested','task6-direct-sql',NOW(),
          'unbound direct insert','{}'::jsonb
        )
      `;

      await assert.rejects(
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "task6-direct-sql",
          diagnostic: "unbound direct insert",
          evidence: {},
          requestId,
        }),
        /INTERNAL_PRODUCTION_TERMINATION_OWNER_ADOPTION_INVALID/,
      );
      const owners = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count
          FROM internal_production_owner_reservations_v1
         WHERE category='termination' AND owner_key=${requestId}
      `;
      assert.equal(owners[0]!.count, 0);
    } finally {
      await database.cleanup();
    }
  });

  it("persists and projects the exact DESIGN semantic-closure cause", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-design-semantic-closure-cause";
      await database.insertRun(runId);
      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "setfarm.step-fail.single",
        diagnostic: "DESIGN semantic closure remained unresolved after bounded retry",
        evidence: {
          failureFingerprint: "f".repeat(64),
          operationalCauseHash: operationalFailureCauseHashV1(
            DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
          ),
        },
        failureCause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
        requestId: "RTR_design-semantic-closure-01",
      });
      assert.equal(requested.status, "requested");
      if (requested.status !== "requested") throw new Error("test request missing");
      assert.deepEqual(
        requested.request.failureCause,
        DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
      );

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      const projected = snapshot.terminationRequests.find(
        (request) => request.requestId === requested.request.requestId,
      );
      assert.deepEqual(
        projected?.evidence.operationalFailureCause,
        DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a structurally valid cause without exact producer authority before mutation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-cause-untrusted";
      await database.insertRun(runId);
      await assert.rejects(
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "agent-prose-classifier",
          diagnostic: "prose must not become canonical failure authority",
          failureCause: SETUP_BUILD_CAUSE,
        }),
        /RUN_TERMINATION_FAILURE_CAUSE_AUTHORITY_INVALID:REQUESTER_UNKNOWN/,
      );
      const state = await database.sql<Array<{ status: string; termination_count: number }>>`
        SELECT status,
               (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count
          FROM runs WHERE id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "running", termination_count: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects contradictory producer evidence before termination mutation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-cause-evidence-mismatch";
      await database.insertRun(runId);
      await assert.rejects(
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "setfarm-v3-downstream-compiler",
          diagnostic: "bounded recovery evidence and cause disagree",
          failureCause: {
            schema: "setfarm.operational-failure-cause.v1",
            workflowStepId: "qa-test",
            boundary: "product_compiler.downstream_recovery",
            failureClass: "contract_invalid",
            failureCode: "V3_DOWNSTREAM_SPECIFICATION_INCOMPLETE",
          },
          evidence: {
            schema: "setfarm.v3-downstream-termination-evidence.v1",
            outcome: "bounded_recovery_blocked",
            terminalReasonCodes: ["budget_exhausted"],
          },
        }),
        /RUN_TERMINATION_FAILURE_CAUSE_AUTHORITY_INVALID:EVIDENCE_BINDING_INVALID/,
      );
      const state = await database.sql<Array<{ status: string; termination_count: number }>>`
        SELECT status,
               (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count
          FROM runs WHERE id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "running", termination_count: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("seals a strict producer cause and rejects every later replacement path", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-cause-seal";
      await database.insertRun(runId);
      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "setfarm.step-fail.single",
        diagnostic: "generated TSX did not parse",
        evidence: { sourceRef: "setfarm://test/converter-output" },
        failureCause: SETUP_BUILD_CAUSE,
        requestId: "RTR_cause-seal-request01",
      });
      assert.equal(requested.status, "requested");
      if (requested.status !== "requested") throw new Error("test request missing");
      assert.deepEqual(requested.request.failureCause, SETUP_BUILD_CAUSE);
      assert.deepEqual(requested.request.evidence.operationalFailureCause, SETUP_BUILD_CAUSE);

      const duplicate = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "setfarm.step-fail.single",
        diagnostic: "generated TSX did not parse",
        evidence: { sourceRef: "setfarm://test/converter-output" },
        failureCause: { ...SETUP_BUILD_CAUSE },
        requestId: "RTR_cause-seal-request01",
      });
      assert.equal(duplicate.status, "existing");
      if (duplicate.status !== "existing") throw new Error("test duplicate missing");
      assert.deepEqual(duplicate.request.failureCause, SETUP_BUILD_CAUSE);

      await assert.rejects(
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "setfarm.step-fail.single",
          diagnostic: "conflicting cause must not replace the first writer",
          failureCause: SETUP_BUILD_BINDING_CAUSE,
        }),
        /RUN_TERMINATION_FAILURE_CAUSE_CONFLICT/,
      );

      await assert.rejects(
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "setfarm.step-fail.single",
          diagnostic: "reserved key injection",
          evidence: { operationalFailureCause: SETUP_BUILD_BINDING_CAUSE },
        }),
        /RUN_TERMINATION_FAILURE_CAUSE_RESERVED/,
      );

      const terminations = createRunTerminationRepository(database.sql);
      const claimed = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "termination-cause-owner",
      });
      assert.equal(claimed?.requestId, requested.request.requestId);
      await assert.rejects(
        terminations.markDrained({
          requestId: requested.request.requestId,
          ownerInstanceId: "termination-cause-owner",
          evidence: { operationalFailureCause: SETUP_BUILD_BINDING_CAUSE },
        }),
        /RUN_TERMINATION_FAILURE_CAUSE_RESERVED/,
      );
      const drained = await terminations.markDrained({
        requestId: requested.request.requestId,
        ownerInstanceId: "termination-cause-owner",
        evidence: { runtimeSessionCount: 0 },
      });
      assert.deepEqual(drained.failureCause, SETUP_BUILD_CAUSE);
      assert.deepEqual(drained.evidence.operationalFailureCause, SETUP_BUILD_CAUSE);
      const quarantined = await terminations.quarantine({
        requestId: requested.request.requestId,
        ownerInstanceId: "termination-cause-owner",
        diagnostic: "drain evidence needs operator inspection",
        evidence: { quarantineCode: "DRAIN_EVIDENCE_UNCERTAIN" },
      });
      assert.deepEqual(quarantined.failureCause, SETUP_BUILD_CAUSE);
      assert.deepEqual(quarantined.evidence.operationalFailureCause, SETUP_BUILD_CAUSE);
    } finally {
      await database.cleanup();
    }
  });

  it("allows exactly one concurrent first-writer cause", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-cause-race";
      await database.insertRun(runId);
      const writes = await Promise.allSettled([
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "setfarm.step-fail.single",
          diagnostic: "candidate a",
          failureCause: SETUP_BUILD_CAUSE,
          requestId: "RTR_cause-race-request-a",
        }),
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "setfarm.step-fail.single",
          diagnostic: "candidate b",
          failureCause: SETUP_BUILD_BINDING_CAUSE,
          requestId: "RTR_cause-race-request-b",
        }),
      ]);
      assert.equal(writes.filter((result) => result.status === "fulfilled").length, 1);
      const rejection = writes.find((result) => result.status === "rejected");
      assert.match(String(rejection && rejection.status === "rejected" ? rejection.reason : ""), /RUN_TERMINATION_FAILURE_CAUSE_CONFLICT/);
      const rows = await database.sql<Array<{ evidence: unknown }>>`
        SELECT evidence FROM run_termination_requests WHERE run_id = ${runId}
      `;
      assert.equal(rows.length, 1);
      const evidence = rows[0]!.evidence as Record<string, unknown>;
      assert.ok(
        operationalFailureCauseHashV1(evidence.operationalFailureCause) === operationalFailureCauseHashV1(SETUP_BUILD_CAUSE)
        || operationalFailureCauseHashV1(evidence.operationalFailureCause) === operationalFailureCauseHashV1(SETUP_BUILD_BINDING_CAUSE),
      );
    } finally {
      await database.cleanup();
    }
  });

  it("preserves the exact cause through drain, terminalization, repository, and snapshot reads", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-cause-lifecycle";
      await database.insertRun(runId);
      await bindRunOwner(database, runId);
      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "setfarm.step-fail.single",
        diagnostic: "typed setup-build terminal failure",
        failureCause: SETUP_BUILD_CAUSE,
        requestId: "RTR_cause-lifecycle-001",
      });
      if (requested.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "termination-cause-lifecycle-owner",
      });
      await terminations.markDrained({
        requestId: requested.request.requestId,
        ownerInstanceId: "termination-cause-lifecycle-owner",
        evidence: { runtimeSessionCount: 0 },
      });
      await terminations.terminalize({ requestId: requested.request.requestId });

      const stored = await terminations.findById(requested.request.requestId);
      assert.equal(stored?.state, "terminalized");
      assert.deepEqual(stored?.failureCause, SETUP_BUILD_CAUSE);
      assert.deepEqual(stored?.evidence.operationalFailureCause, SETUP_BUILD_CAUSE);
      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      const projected = snapshot.terminationRequests.find(
        (request) => request.requestId === requested.request.requestId,
      );
      assert.equal(projected?.state, "terminalized");
      assert.deepEqual(projected?.evidence.operationalFailureCause, SETUP_BUILD_CAUSE);
    } finally {
      await database.cleanup();
    }
  });

  it("forbids a failure cause on cancellation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-cancel-cause-invalid";
      await database.insertRun(runId);
      await assert.rejects(
        requestRunTermination(database.sql, {
          runId,
          targetStatus: "cancelled",
          requestedBy: "cli-user",
          diagnostic: "operator cancellation",
          failureCause: SETUP_BUILD_CAUSE,
        }),
        /Cancelled termination cannot carry an operational failure cause/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("keeps ownership active until runtime drain proof then terminalizes atomically", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-two-phase-cancel";
      const seeded = await seedOwnedRuntime(database, runId);
      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "Workflow cancelled by user",
        requestId: "RTR_two-phase-cancel01",
      });
      assert.equal(requested.status, "requested");
      if (requested.status !== "requested") throw new Error("test request missing");
      const beforeDrain = await database.sql<Array<{
        run_status: string;
        story_status: string;
        step_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        session_state: string;
      }>>`
        SELECT r.status AS run_status, st.status AS story_status, s.status AS step_status,
               cl.outcome AS claim_outcome, ea.disposition AS attempt_disposition,
               rs.state AS session_state
          FROM runs r
          JOIN steps s ON s.run_id = r.id
          JOIN stories st ON st.run_id = r.id
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...beforeDrain[0] }, {
        run_status: "cancelling",
        story_status: "running",
        step_status: "running",
        claim_outcome: null,
        attempt_disposition: "running",
        session_state: "running",
      });
      const duplicate = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "Workflow cancelled by user",
        requestId: "RTR_two-phase-cancel01",
      });
      assert.equal(duplicate.status, "existing");
      if (duplicate.status === "existing") assert.equal(duplicate.request.requestId, requested.request.requestId);

      const terminations = createRunTerminationRepository(database.sql);
      const claimed = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(claimed?.state, "draining");
      assert.equal((await seeded.sessions.findById(seeded.sessionId))?.state, "drain_requested");
      await assert.rejects(
        terminations.markDrained({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUN_TERMINATION_RUNTIME_NOT_DRAINED/,
      );
      const [heartbeat] = await Promise.all([
        terminations.heartbeat({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        assert.rejects(
          terminations.terminalize({ requestId: requested.request.requestId }),
          /RUN_TERMINATION_REQUEST_NOT_DRAINED/,
        ),
      ]);
      assert.equal(heartbeat, true);
      await seeded.sessions.markDrained({ sessionId: seeded.sessionId, evidence: DRAIN_EVIDENCE });
      assert.equal((await terminations.markDrained({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        evidence: { proofRef: "setfarm://test/drain-proof" },
      })).state, "drained");
      const terminal = await terminations.terminalize({ requestId: requested.request.requestId });
      assert.equal(terminal.status, "cancelled");
      const after = await database.sql<Array<{
        run_status: string;
        claim_outcome: string;
        attempt_disposition: string;
        session_state: string;
        request_state: string;
        outbox_termination_request_id: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS session_state,
               rr.state AS request_state,
               ob.payload->>'terminationRequestId' AS outbox_termination_request_id
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
          JOIN run_termination_requests rr ON rr.run_id = r.id
          JOIN operational_outbox ob ON ob.aggregate_id = r.id AND ob.event_type = 'run.terminal'
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...after[0] }, {
        run_status: "cancelled",
        claim_outcome: "cancelled",
        attempt_disposition: "inconclusive",
        session_state: "released",
        request_state: "terminalized",
        outbox_termination_request_id: requested.request.requestId,
      });
      assert.equal((await terminations.terminalize({ requestId: requested.request.requestId })).previousStatus, "cancelled");
      assert.equal(await terminations.heartbeat({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      }), false);
      await assert.rejects(
        terminations.quarantine({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
          diagnostic: "late quarantine must not reopen terminal ownership",
        }),
        /RUN_TERMINATION_QUARANTINE_FAILED/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("forbids direct active cancellation and refuses to infer drain from missing runtime evidence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-cancel-proof-required";
      await database.insertRun(runId);
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "cancelled",
          diagnostic: "unsafe direct cancel",
        }),
        /RUN_TERMINAL_CANCEL_DRAIN_PROOF_REQUIRED/,
      );
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
        VALUES (${runId}, 'plan', NULL, 'feature-dev_planner')
        RETURNING id::integer AS id
      `;
      const request = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel with untracked claim",
        requestId: "RTR_untracked-claim-0001",
      });
      if (request.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({ requestId: request.request.requestId, ownerInstanceId: "spawner-a" });
      await assert.rejects(
        terminations.markDrained({
          requestId: request.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUN_TERMINATION_OPEN_CLAIM_SESSION_MISSING/,
      );
      const claim = await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${claims[0]!.id}
      `;
      assert.equal(claim[0]?.outcome, null);
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "cancelling");
    } finally {
      await database.cleanup();
    }
  });

  it("quarantines an uncertain drain without exposing retryable or terminal state", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-cancel-quarantine";
      const seeded = await seedOwnedRuntime(database, runId);
      const request = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel",
        requestId: "RTR_cancel-quarantine01",
      });
      if (request.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({ requestId: request.request.requestId, ownerInstanceId: "spawner-a" });
      const observedRuntime = await seeded.sessions.findById(seeded.sessionId);
      assert.ok(observedRuntime);
      await seeded.sessions.quarantine({
        sessionId: seeded.sessionId,
        expectedOwnerInstanceId: observedRuntime.ownerInstanceId,
        expectedStateVersion: observedRuntime.stateVersion,
        diagnostic: "runtime absence could not be proven",
      });
      const quarantined = await terminations.quarantine({
        requestId: request.request.requestId,
        ownerInstanceId: "spawner-a",
        diagnostic: "runtime absence could not be proven",
      });
      assert.equal(quarantined.state, "quarantined");
      await assert.rejects(
        terminations.terminalize({ requestId: request.request.requestId }),
        /RUN_TERMINATION_REQUEST_NOT_DRAINED/,
      );
      const state = await database.sql<Array<{
        run_status: string;
        story_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
      }>>`
        SELECT r.status AS run_status, st.status AS story_status,
               cl.outcome AS claim_outcome, ea.disposition AS attempt_disposition
          FROM runs r
          JOIN stories st ON st.run_id = r.id
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, {
        run_status: "cancelling",
        story_status: "running",
        claim_outcome: null,
        attempt_disposition: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("uses the same drain proof owner for failed runs and preserves a starting runtime until proof", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-two-phase-failed";
      const seeded = await seedOwnedRuntime(database, runId, "starting");
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "unsafe direct failure",
        }),
        /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
      );
      const stillOwned = await database.sql<Array<{
        run_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        session_state: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS session_state
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...stillOwned[0] }, {
        run_status: "running",
        claim_outcome: null,
        attempt_disposition: "claimed",
        session_state: "starting",
      });

      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "failure-policy",
        diagnostic: "terminal quality failure",
        requestId: "RTR_two-phase-failed01",
      });
      if (requested.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      const claimed = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(claimed?.targetStatus, "failed");
      assert.equal((await seeded.sessions.findById(seeded.sessionId))?.state, "drain_requested");
      await assert.rejects(
        terminations.markDrained({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUN_TERMINATION_RUNTIME_NOT_DRAINED/,
      );
      await seeded.sessions.markDrained({ sessionId: seeded.sessionId, evidence: DRAIN_EVIDENCE });
      await terminations.markDrained({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        evidence: { proofRef: "setfarm://test/failed-drain-proof" },
      });
      const terminal = await terminations.terminalize({ requestId: requested.request.requestId });
      assert.equal(terminal.status, "failed");

      const settled = await database.sql<Array<{
        run_status: string;
        claim_outcome: string;
        attempt_disposition: string;
        session_state: string;
        request_state: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS session_state,
               rr.state AS request_state
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
          JOIN run_termination_requests rr ON rr.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...settled[0] }, {
        run_status: "failed",
        claim_outcome: "failed",
        attempt_disposition: "failed",
        session_state: "released",
        request_state: "terminalized",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("does not let fifty quarantined rows starve a healthy pending request", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const terminations = createRunTerminationRepository(database.sql);
      for (let index = 0; index < 50; index += 1) {
        const runId = `run-queue-quarantine-${String(index).padStart(3, "0")}`;
        await database.insertRun(runId);
        const request = await requestRunTermination(database.sql, {
          runId,
          targetStatus: "cancelled",
          requestedBy: "queue-test",
          diagnostic: "old poison request",
          requestId: `RTR_queue-quarantine-${String(index).padStart(3, "0")}`,
          now: new Date(1_700_000_000_000 + index),
        });
        if (request.status !== "requested") throw new Error("test request missing");
        await terminations.quarantine({
          requestId: request.request.requestId,
          diagnostic: "bounded poison quarantine",
          now: new Date(1_700_000_100_000 + index),
        });
      }
      const leasedRunId = "run-queue-leased";
      await database.insertRun(leasedRunId);
      const leased = await requestRunTermination(database.sql, {
        runId: leasedRunId,
        targetStatus: "failed",
        requestedBy: "queue-test",
        diagnostic: "healthy owner still holds lease",
        requestId: "RTR_queue-leased-00001",
      });
      if (leased.status !== "requested") throw new Error("test request missing");
      await terminations.claim({
        requestId: leased.request.requestId,
        ownerInstanceId: "live-termination-owner",
        leaseMs: 300_000,
      });
      const orphanedRunId = "run-queue-orphaned-lease";
      await database.insertRun(orphanedRunId);
      const orphaned = await requestRunTermination(database.sql, {
        runId: orphanedRunId,
        targetStatus: "failed",
        requestedBy: "queue-test",
        diagnostic: "owner crashed before lease publication",
        requestId: "RTR_queue-orphaned-0001",
        now: new Date(1_750_000_000_000),
      });
      if (orphaned.status !== "requested") throw new Error("test request missing");
      await database.sql`
        UPDATE run_termination_requests
           SET state = 'draining', owner_instance_id = 'crashed-owner', lease_expires_at = NULL
         WHERE request_id = ${orphaned.request.requestId}
      `;
      const healthyRunId = "run-queue-healthy";
      await database.insertRun(healthyRunId);
      const healthy = await requestRunTermination(database.sql, {
        runId: healthyRunId,
        targetStatus: "failed",
        requestedBy: "queue-test",
        diagnostic: "healthy request",
        requestId: "RTR_queue-healthy-0001",
        now: new Date(1_800_000_000_000),
      });
      if (healthy.status !== "requested") throw new Error("test request missing");

      const pending = await terminations.listPending(50);
      assert.deepEqual(pending.map((request) => request.requestId).sort(), [
        orphaned.request.requestId,
        healthy.request.requestId,
      ].sort());
    } finally {
      await database.cleanup();
    }
  });

  it("uses PostgreSQL time for lease takeover and cannot resurrect an expired owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-termination-db-clock";
      await database.insertRun(runId);
      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "clock-test",
        diagnostic: "database clock authority",
        requestId: "RTR_database-clock-0001",
        now: new Date("2100-01-01T00:00:00.000Z"),
      });
      if (requested.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      const first = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "clock-owner-a",
        leaseMs: 5_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      });
      assert.equal(first?.ownerInstanceId, "clock-owner-a");
      await database.sql`
        UPDATE run_termination_requests
           SET lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE request_id = ${requested.request.requestId}
      `;

      assert.equal(await terminations.heartbeat({
        requestId: requested.request.requestId,
        ownerInstanceId: "clock-owner-a",
        leaseMs: 300_000,
        now: new Date("2100-01-01T00:00:00.000Z"),
      }), false);
      const adopted = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "clock-owner-b",
        leaseMs: 5_000,
        now: new Date("1900-01-01T00:00:00.000Z"),
      });
      assert.equal(adopted?.ownerInstanceId, "clock-owner-b");
      assert.notEqual(adopted?.leaseExpiresAt, first?.leaseExpiresAt);
    } finally {
      await database.cleanup();
    }
  });
});
