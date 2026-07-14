import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { transitionRunToTerminal } from "../../src/execution/run-terminal-transition.js";
import { exactProductReservation, HASH_A } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

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
});
