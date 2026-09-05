import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureCompilerClaimFence } from "../../src/execution/compiler-claim-fence.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import type { PgTransactionSql } from "../../src/db-pg.js";
import { exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";

async function seedClaim(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, runId: string) {
  await database.insertRun(runId);
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, current_story_id)
    VALUES
      (${`${runId}-step`}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'running', ${`${runId}-story`})
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status, claimed_by)
    VALUES
      (${`${runId}-story`}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer')
  `;
  return insertClaim(database, runId);
}

async function insertClaim(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  storyId = "US-002",
): Promise<number> {
  return database.sql.begin(async (transaction) => {
    const rows = await (transaction as PgTransactionSql)<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      "a-claim-loop-runtime-v1",
      rows,
    );
    return insertAndBindInternalProductionClaimBirthV1(transaction as PgTransactionSql, birth, {
      runId,
      workflowStepId: "implement",
      storyId,
      claimAgentId: "feature-dev_developer",
      claimedAt: new Date(),
    });
  }) as Promise<number>;
}

function ensure(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, runId: string, claimId: number) {
  return ensureCompilerClaimFence(database.sql, {
    claimId,
    runId,
    stepId: "implement",
    storyId: "US-002",
    storyDbId: `${runId}-story`,
    claimAgentId: "feature-dev_developer",
    diagnostic: "reservation unavailable",
  });
}

async function reserveRuntime(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  claimId: number,
) {
  const repository = createRuntimeSessionRepository(database.sql);
  const sessionId = `RTS_${runId}-runtime-0001`;
  const ownerInstanceId = `${runId}-owner`;
  await repository.reserve({
    sessionId,
    runId,
    stepDbId: `${runId}-step`,
    workflowStepId: "implement",
    storyDbId: `${runId}-story`,
    storyId: "US-002",
    claimId,
    claimAgentId: "feature-dev_developer",
    runtimeAgentId: "developer",
    runtimeKind: "local_process",
    ownerInstanceId,
  });
  return { repository, sessionId, ownerInstanceId };
}

describe("compiler claim handoff fence", () => {
  it("recovers an exact reservation when the observer result was lost", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const claimId = await seedClaim(database, "run-fence-recover");
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_fence-recover-0001",
        fenceToken: () => "f".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-fence-recover",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      assert.deepEqual(await ensure(database, "run-fence-recover", claimId), {
        status: "fenced",
        attempt: {
          attemptId: "ATT_fence-recover-0001",
          generation: 1,
          fenceToken: "f".repeat(64),
        },
      });
    } finally {
      await database.cleanup();
    }
  });

  it("withdraws an unfenced claim before any runtime can spawn", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-fence-revert";
      const claimId = await seedClaim(database, runId);
      assert.deepEqual(await ensure(database, runId, claimId), { status: "reverted" });
      const state = await database.sql<Array<{ story_status: string; step_status: string; outcome: string }>>`
        SELECT st.status AS story_status, s.status AS step_status, cl.outcome
          FROM stories st
          JOIN steps s ON s.run_id = st.run_id
          JOIN claim_log cl ON cl.run_id = st.run_id
         WHERE st.run_id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "pending",
        step_status: "pending",
        outcome: "infra_retry",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("atomically releases the exact reserved runtime when an unfenced claim is withdrawn", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-fence-runtime-release";
      const claimId = await seedClaim(database, runId);
      const runtime = await reserveRuntime(database, runId, claimId);
      assert.deepEqual(await ensure(database, runId, claimId), { status: "reverted" });
      const state = await database.sql<Array<{
        runtime_state: string;
        released_at: Date | null;
        claim_outcome: string;
        story_status: string;
      }>>`
        SELECT rs.state AS runtime_state, rs.released_at, cl.outcome AS claim_outcome,
               st.status AS story_status
          FROM runtime_sessions rs
          JOIN claim_log cl ON cl.id = rs.claim_id
          JOIN stories st ON st.run_id = rs.run_id AND st.id = ${`${runId}-story`}
         WHERE rs.session_id = ${runtime.sessionId}
      `;
      assert.equal(state[0]?.runtime_state, "released");
      assert.ok(state[0]?.released_at);
      assert.equal(state[0]?.claim_outcome, "infra_retry");
      assert.equal(state[0]?.story_status, "pending");
    } finally {
      await database.cleanup();
    }
  });

  it("does not withdraw a claim after its exact runtime crossed the start CAS", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-fence-runtime-started";
      const claimId = await seedClaim(database, runId);
      const runtime = await reserveRuntime(database, runId, claimId);
      await runtime.repository.markStarting({
        sessionId: runtime.sessionId,
        ownerInstanceId: runtime.ownerInstanceId,
      });
      assert.deepEqual(await ensure(database, runId, claimId), {
        status: "blocked",
        reason: "COMPILER_CLAIM_RUNTIME_ALREADY_STARTED:starting",
      });
      const state = await database.sql<Array<{ runtime_state: string; outcome: string | null; story_status: string }>>`
        SELECT rs.state AS runtime_state, cl.outcome, st.status AS story_status
          FROM runtime_sessions rs
          JOIN claim_log cl ON cl.id = rs.claim_id
          JOIN stories st ON st.run_id = rs.run_id AND st.id = ${`${runId}-story`}
         WHERE rs.session_id = ${runtime.sessionId}
      `;
      assert.deepEqual({ ...state[0] }, {
        runtime_state: "starting",
        outcome: null,
        story_status: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a crossed active fence without mutating either owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-fence-block";
      const claimId = await seedClaim(database, runId);
      const otherClaimId = await insertClaim(database, runId, "US-OTHER");
      const repository = createAttemptRepository(database.sql);
      const foreignReservation = await repository.reserve(exactProductReservation({
        claimId: otherClaimId,
        runId,
        storyId: "US-OTHER",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${otherClaimId}`],
      }));
      await database.sql`
        UPDATE execution_attempts SET story_id = 'US-002'
        WHERE attempt_id = ${foreignReservation.attempt.attemptId}
      `;
      await assert.rejects(
        ensure(database, runId, claimId),
        /PRE_DISPATCH_ATTEMPT_IDENTITY_MISMATCH/,
      );
      const story = await database.sql<Array<{ status: string }>>`
        SELECT status FROM stories WHERE run_id = ${runId}
      `;
      assert.equal(story[0]?.status, "running");
      const retained = await database.sql<Array<{
        target_claim_outcome: string | null;
        target_claim_owner_state: string;
        foreign_attempt_disposition: string;
        foreign_attempt_owner_state: string;
      }>>`
        SELECT target_claim.outcome AS target_claim_outcome,
               target_owner.state AS target_claim_owner_state,
               foreign_attempt.disposition AS foreign_attempt_disposition,
               foreign_owner.state AS foreign_attempt_owner_state
          FROM claim_log target_claim
          JOIN internal_production_owner_reservations_v1 target_owner
            ON target_owner.producer_implementation_id = 'a-claim-loop-runtime-v1'
           AND target_owner.owner_key = target_claim.id::text
          JOIN execution_attempts foreign_attempt
            ON foreign_attempt.attempt_id = ${foreignReservation.attempt.attemptId}
          JOIN internal_production_owner_reservations_v1 foreign_owner
            ON foreign_owner.producer_implementation_id = 'a-execution-attempt-v1'
           AND foreign_owner.owner_key = foreign_attempt.attempt_id
         WHERE target_claim.id = ${claimId}
      `;
      assert.deepEqual({ ...retained[0] }, {
        target_claim_outcome: null,
        target_claim_owner_state: "bound",
        foreign_attempt_disposition: "claimed",
        foreign_attempt_owner_state: "bound",
      });
    } finally {
      await database.cleanup();
    }
  });
});
