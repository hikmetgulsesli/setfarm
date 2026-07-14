import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureCompilerClaimFence } from "../../src/execution/compiler-claim-fence.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
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
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
    VALUES (${runId}, 'implement', 'US-002', 'feature-dev_developer', NOW())
    RETURNING id::integer AS id
  `;
  return claims[0]!.id;
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

  it("closes a duplicate claim but keeps an unrelated active fence non-retryable", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-fence-block";
      const claimId = await seedClaim(database, runId);
      const otherClaims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'implement', 'US-OTHER', 'feature-dev_developer', NOW())
        RETURNING id::integer AS id
      `;
      const repository = createAttemptRepository(database.sql);
      await repository.reserve(exactProductReservation({
        claimId: otherClaims[0]!.id,
        runId,
        storyId: "US-OTHER",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${otherClaims[0]!.id}`],
      }));
      await database.sql`
        UPDATE execution_attempts SET story_id = 'US-002'
        WHERE run_id = ${runId} AND story_id = 'US-OTHER'
      `;
      assert.deepEqual(await ensure(database, runId, claimId), {
        status: "blocked",
        reason: "COMPILER_CLAIM_DIFFERENT_ACTIVE_FENCE",
      });
      const story = await database.sql<Array<{ status: string }>>`
        SELECT status FROM stories WHERE run_id = ${runId}
      `;
      assert.equal(story[0]?.status, "running");
    } finally {
      await database.cleanup();
    }
  });
});
