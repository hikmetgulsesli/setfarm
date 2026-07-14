import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  closeClaimAndBoundAttempt,
  closeUniqueSingleStepClaimForRecoveryInTransaction,
  completeSingleStepClaimAndState,
  completeStoryClaimAndBoundAttempt,
} from "../../src/execution/claim-attempt-transition.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { exactProductReservation, HASH_A } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

async function insertClaim(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{
    runId: string;
    storyId?: string;
    agentId?: string;
  }>,
): Promise<number> {
  const rows = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
    VALUES (
      ${input.runId}, 'implement', ${input.storyId ?? "US-002"},
      ${input.agentId ?? "feature-dev_developer"}, NOW() - INTERVAL '1 minute'
    )
    RETURNING id::integer AS id
  `;
  return rows[0]!.id;
}

describe("atomic claim-attempt terminal transition", () => {
  it("closes an exact shadow claim and its bound fence in one transaction", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await database.insertRun("run-claim-transition");
      const claimId = await insertClaim(database, { runId: "run-claim-transition" });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_claim-transition-0001",
        fenceToken: () => "f".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-claim-transition",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));

      const first = await closeClaimAndBoundAttempt(database.sql, {
        claimId,
        runId: "run-claim-transition",
        stepId: "implement",
        storyId: "US-002",
        agentId: "feature-dev_developer",
        outcome: "infra_retry",
        diagnostic: "hard timeout",
      });
      assert.deepEqual(first, {
        status: "closed",
        claimId,
        claimOutcome: "infra_retry",
        attemptId: "ATT_claim-transition-0001",
        attemptDisposition: "inconclusive",
      });
      assert.equal((await repository.findById("ATT_claim-transition-0001"))?.disposition, "inconclusive");
      const claim = await database.sql<Array<{ outcome: string; diagnostic: string }>>`
        SELECT outcome, diagnostic FROM claim_log WHERE id = ${claimId}
      `;
      assert.deepEqual({ ...claim[0] }, { outcome: "infra_retry", diagnostic: "hard timeout" });

      const second = await closeClaimAndBoundAttempt(database.sql, {
        claimId,
        runId: "run-claim-transition",
        stepId: "implement",
        storyId: "US-002",
        agentId: "feature-dev_developer",
        outcome: "failed",
        diagnostic: "late owner",
      });
      assert.deepEqual(second, {
        status: "cas_lost",
        claimId,
        claimOutcome: "infra_retry",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("serializes competing recovery owners and accepts exactly one CAS", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await database.insertRun("run-claim-race");
      const claimId = await insertClaim(database, { runId: "run-claim-race" });
      const repository = createAttemptRepository(database.sql);
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-claim-race",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const close = (diagnostic: string) => closeClaimAndBoundAttempt(database.sql, {
        claimId,
        runId: "run-claim-race",
        stepId: "implement",
        storyId: "US-002",
        agentId: "feature-dev_developer",
        outcome: "infra_retry",
        diagnostic,
      });
      const results = await Promise.all([close("owner-a"), close("owner-b")]);
      assert.deepEqual(results.map((result) => result.status).sort(), ["cas_lost", "closed"]);
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back the claim when the active attempt binding is malformed", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await database.insertRun("run-claim-invalid-binding");
      const claimId = await insertClaim(database, { runId: "run-claim-invalid-binding" });
      const otherClaimId = await insertClaim(database, {
        runId: "run-claim-invalid-binding",
        storyId: "US-OTHER",
      });
      const repository = createAttemptRepository(database.sql);
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-claim-invalid-binding",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await database.sql`
        UPDATE execution_attempts SET claim_id = ${otherClaimId}
        WHERE run_id = 'run-claim-invalid-binding' AND story_id = 'US-002'
      `;

      await assert.rejects(
        closeClaimAndBoundAttempt(database.sql, {
          claimId,
          runId: "run-claim-invalid-binding",
          stepId: "implement",
          storyId: "US-002",
          agentId: "feature-dev_developer",
          outcome: "infra_retry",
          diagnostic: "must roll back",
        }),
        /CLAIM_ATTEMPT_BINDING_MISMATCH/,
      );
      const claim = await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${claimId}
      `;
      assert.equal(claim[0]?.outcome, null);
    } finally {
      await database.cleanup();
    }
  });

  it("closes a v3 claim only through its exact packet-bound attempt fence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          'run-claim-v3', 'feature-dev', 'v3 lifecycle', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
      const claimId = await insertClaim(database, { runId: "run-claim-v3" });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_claim-v3-native-0001",
        fenceToken: () => "3".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-claim-v3",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const result = await closeClaimAndBoundAttempt(database.sql, {
        claimId,
        runId: "run-claim-v3",
        stepId: "implement",
        storyId: "US-002",
        agentId: "feature-dev_developer",
        outcome: "infra_retry",
        diagnostic: "bounded native v3 recovery",
      });
      assert.equal(result.status, "closed");
      assert.equal(result.attemptId, "ATT_claim-v3-native-0001");
      const claim = await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${claimId}
      `;
      assert.equal(claim[0]?.outcome, "infra_retry");
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back a v3 claim when its active attempt lacks the sealed slice contract", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          'run-claim-v3-invalid', 'feature-dev', 'v3 invalid lifecycle', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
      const claimId = await insertClaim(database, { runId: "run-claim-v3-invalid" });
      const repository = createAttemptRepository(database.sql);
      const reserved = await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-claim-v3-invalid",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await database.sql`
        UPDATE execution_attempts SET slice_hash = NULL
         WHERE attempt_id = ${reserved.attempt.attemptId}
      `;
      await assert.rejects(
        closeClaimAndBoundAttempt(database.sql, {
          claimId,
          runId: "run-claim-v3-invalid",
          stepId: "implement",
          storyId: "US-002",
          agentId: "feature-dev_developer",
          outcome: "infra_retry",
          diagnostic: "must preserve owner",
        }),
        /CLAIM_ATTEMPT_V3_CONTRACT_MISMATCH/,
      );
      const claim = await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${claimId}
      `;
      assert.equal(claim[0]?.outcome, null);
    } finally {
      await database.cleanup();
    }
  });

  it("publishes exact shadow story completion with its claim and fence atomically", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-story-complete";
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
          (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 7)
      `;
      const claimId = await insertClaim(database, { runId });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_story-complete-0001",
        fenceToken: () => "f".repeat(64),
      });
      const reservation = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      assert.equal(reservation.status, "reserved");
      const envelope: ClaimEnvelopeV1 = {
        schema: "setfarm.claim-envelope.v1",
        protocol: "shadow",
        issuedAt: new Date().toISOString(),
        stepId: stepDbId,
        workflowStepId: "implement",
        runId,
        storyId: "US-002",
        storyDbId,
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        claimGeneration: 7,
        attempt: {
          attemptId: reservation.attempt.attemptId,
          generation: reservation.attempt.generation,
          fenceToken: reservation.attempt.fenceToken,
        },
      };

      const result = await completeStoryClaimAndBoundAttempt(database.sql, {
        envelope,
        sourceAfter: { sha: "2".repeat(40), treeHash: "4".repeat(40) },
        outputHash: "9".repeat(64),
        evidenceRefs: ["setfarm://test/story-completion"],
        storyStatus: "done",
        storyOutput: "STATUS: done",
        storyPrUrl: "https://github.com/example/repo/pull/1",
        storyBranch: "story/us-002",
        stepStatus: "running",
        stepOutput: "STATUS: done",
      });
      assert.deepEqual(result, {
        status: "completed",
        claimId,
        attemptId: "ATT_story-complete-0001",
        attemptDisposition: "produced_delta",
      });
      const state = await database.sql<Array<{
        claim_outcome: string;
        attempt_disposition: string;
        story_status: string;
        story_claimed_by: string | null;
        step_status: string;
        current_story_id: string | null;
      }>>`
        SELECT cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition,
               st.status AS story_status,
               st.claimed_by AS story_claimed_by,
               s.status AS step_status,
               s.current_story_id
          FROM claim_log cl
          JOIN execution_attempts ea ON ea.run_id = cl.run_id AND ea.story_id = cl.story_id
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        claim_outcome: "completed",
        attempt_disposition: "produced_delta",
        story_status: "done",
        story_claimed_by: null,
        step_status: "running",
        current_story_id: null,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("publishes v3 story completion through the activated packet and exact slice fence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-story-complete-v3";
      const stepDbId = `${runId}-step`;
      const storyDbId = `${runId}-story`;
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'v3 completion', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
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
          (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 5)
      `;
      const claimId = await insertClaim(database, { runId });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_story-complete-v3-01",
        fenceToken: () => "8".repeat(64),
      });
      const reservation = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const candidate = await repository.recordCandidateSource({
        attemptId: reservation.attempt.attemptId,
        generation: reservation.attempt.generation,
        fenceToken: reservation.attempt.fenceToken,
        sourceAfter: { sha: "2".repeat(40), treeHash: "4".repeat(40) },
      });
      assert.equal(candidate.status, "candidate");
      const result = await completeStoryClaimAndBoundAttempt(database.sql, {
        envelope: {
          schema: "setfarm.claim-envelope.v1",
          protocol: "v3",
          issuedAt: new Date().toISOString(),
          stepId: stepDbId,
          workflowStepId: "implement",
          runId,
          storyId: "US-002",
          storyDbId,
          claimId,
          claimAgentId: "feature-dev_developer",
          runtimeAgentId: "prism",
          claimGeneration: 5,
          attempt: {
            attemptId: reservation.attempt.attemptId,
            generation: reservation.attempt.generation,
            fenceToken: reservation.attempt.fenceToken,
          },
        },
        sourceAfter: { sha: "2".repeat(40), treeHash: "4".repeat(40) },
        outputHash: "9".repeat(64),
        attemptDisposition: "verified",
        storyStatus: "done",
        storyOutput: "STATUS: done",
        stepStatus: "running",
        stepOutput: "STATUS: done",
      });
      assert.equal(result.status, "completed");
      assert.equal(result.attemptId, reservation.attempt.attemptId);
      assert.equal((await repository.findById(reservation.attempt.attemptId))?.disposition, "verified");
    } finally {
      await database.cleanup();
    }
  });

  it("terminalizes failed v3 evidence without exposing the story to the normal pending pool", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-story-evidence-failed-v3";
      const stepDbId = `${runId}-step`;
      const storyDbId = `${runId}-story`;
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'v3 evidence failure', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
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
          (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 6)
      `;
      const claimId = await insertClaim(database, { runId });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_story-evidence-fail-v3",
        fenceToken: () => "8".repeat(64),
      });
      const reservation = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const sourceAfter = { sha: "2".repeat(40), treeHash: "4".repeat(40) };
      assert.equal((await repository.recordCandidateSource({
        attemptId: reservation.attempt.attemptId,
        generation: reservation.attempt.generation,
        fenceToken: reservation.attempt.fenceToken,
        sourceAfter,
      })).status, "candidate");
      const result = await completeStoryClaimAndBoundAttempt(database.sql, {
        envelope: {
          schema: "setfarm.claim-envelope.v1",
          protocol: "v3",
          issuedAt: new Date().toISOString(),
          stepId: stepDbId,
          workflowStepId: "implement",
          runId,
          storyId: "US-002",
          storyDbId,
          claimId,
          claimAgentId: "feature-dev_developer",
          runtimeAgentId: "prism",
          claimGeneration: 6,
          attempt: {
            attemptId: reservation.attempt.attemptId,
            generation: reservation.attempt.generation,
            fenceToken: reservation.attempt.fenceToken,
          },
        },
        sourceAfter,
        attemptDisposition: "failed",
        evidenceRefs: [`setfarm://evidence-bundle/${"6".repeat(64)}`],
        storyStatus: "failed",
        storyOutput: "canonical evidence failed",
        stepStatus: "running",
        stepOutput: "canonical evidence failed",
      });
      assert.equal(result.attemptDisposition, "failed");
      const state = await database.sql<Array<{
        attempt_disposition: string;
        story_status: string;
        story_claimed_by: string | null;
        pending_count: number;
      }>>`
        SELECT ea.disposition AS attempt_disposition,
               st.status AS story_status,
               st.claimed_by AS story_claimed_by,
               (SELECT COUNT(*)::integer FROM stories candidate
                 WHERE candidate.run_id = ${runId} AND candidate.status = 'pending') AS pending_count
          FROM execution_attempts ea
          JOIN stories st ON st.run_id = ea.run_id AND st.story_id = ea.story_id
         WHERE ea.attempt_id = ${reservation.attempt.attemptId}
      `;
      assert.deepEqual({ ...state[0] }, {
        attempt_disposition: "failed",
        story_status: "failed",
        story_claimed_by: null,
        pending_count: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back every completion mutation when a stale generation loses authority", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-story-stale";
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
          (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 8)
      `;
      const claimId = await insertClaim(database, { runId });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_story-stale-000001",
        fenceToken: () => "a".repeat(64),
      });
      const reservation = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      assert.equal(reservation.status, "reserved");
      await assert.rejects(
        completeStoryClaimAndBoundAttempt(database.sql, {
          envelope: {
            schema: "setfarm.claim-envelope.v1",
            protocol: "shadow",
            issuedAt: new Date().toISOString(),
            stepId: stepDbId,
            workflowStepId: "implement",
            runId,
            storyId: "US-002",
            storyDbId,
            claimId,
            claimAgentId: "feature-dev_developer",
            runtimeAgentId: "prism",
            claimGeneration: 7,
            attempt: {
              attemptId: reservation.attempt.attemptId,
              generation: reservation.attempt.generation,
              fenceToken: reservation.attempt.fenceToken,
            },
          },
          sourceAfter: { sha: "2".repeat(40), treeHash: "4".repeat(40) },
          storyStatus: "done",
          storyOutput: "late",
          stepStatus: "running",
          stepOutput: "late",
        }),
        /STORY_COMPLETION_OWNERSHIP_CHANGED/,
      );
      const state = await database.sql<Array<{ outcome: string | null; disposition: string; story_status: string; step_status: string }>>`
        SELECT cl.outcome, ea.disposition, st.status AS story_status, s.status AS step_status
          FROM claim_log cl
          JOIN execution_attempts ea ON ea.run_id = cl.run_id AND ea.story_id = cl.story_id
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        outcome: null,
        disposition: "claimed",
        story_status: "running",
        step_status: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("closes only the exact single-step claim while publishing step state", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-complete";
      const stepDbId = `${runId}-step`;
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          (${stepDbId}, ${runId}, 'verify', 'feature-dev_reviewer', 2, '', '', 'running')
      `;
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'verify', NULL, 'feature-dev_reviewer', NOW())
        RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      await completeSingleStepClaimAndState(database.sql, {
        envelope: {
          schema: "setfarm.claim-envelope.v1",
          protocol: "shadow",
          issuedAt: new Date().toISOString(),
          stepId: stepDbId,
          workflowStepId: "verify",
          runId,
          claimId,
          claimAgentId: "feature-dev_reviewer",
          runtimeAgentId: "flux",
        },
        stepStatus: "waiting",
        stepOutput: "STATUS: done",
      });
      const state = await database.sql<Array<{ outcome: string; status: string; output: string }>>`
        SELECT cl.outcome, s.status, s.output
          FROM claim_log cl
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, { outcome: "completed", status: "waiting", output: "STATUS: done" });
    } finally {
      await database.cleanup();
    }
  });

  it("reconstructs and closes exactly one bounded single-step recovery owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-recovery";
      const stepDbId = `${runId}-step`;
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          (${stepDbId}, ${runId}, 'supervise', 'feature-dev_supervisor', 2, '', '', 'running')
      `;
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'supervise', NULL, 'feature-dev_supervisor', NOW())
        RETURNING id::integer AS id
      `;

      const result = await database.sql.begin((transaction) =>
        closeUniqueSingleStepClaimForRecoveryInTransaction(transaction, {
          runId,
          stepDbId,
          workflowStepId: "supervise",
          outcome: "infra_retry",
          diagnostic: "canonical verify retry owns recovery",
        })
      );
      assert.deepEqual(result, {
        status: "closed",
        protocol: "shadow",
        claimId: claims[0]!.id,
        claimAgentId: "feature-dev_supervisor",
      });
      const state = await database.sql<Array<{ outcome: string; diagnostic: string }>>`
        SELECT outcome, diagnostic FROM claim_log WHERE id = ${claims[0]!.id}
      `;
      assert.deepEqual({ ...state[0] }, {
        outcome: "infra_retry",
        diagnostic: "canonical verify retry owns recovery",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("fails closed when bounded recovery cannot prove a unique owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-recovery-ambiguous";
      const stepDbId = `${runId}-step`;
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          (${stepDbId}, ${runId}, 'supervise', 'feature-dev_supervisor', 2, '', '', 'running')
      `;
      await database.sql`DROP INDEX idx_claim_log_open_single_unique`;
      await database.sql`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES
          (${runId}, 'supervise', NULL, 'feature-dev_supervisor', NOW()),
          (${runId}, 'supervise', NULL, 'feature-dev_supervisor-duplicate', NOW())
      `;

      await assert.rejects(
        database.sql.begin((transaction) =>
          closeUniqueSingleStepClaimForRecoveryInTransaction(transaction, {
            runId,
            stepDbId,
            workflowStepId: "supervise",
            outcome: "infra_retry",
            diagnostic: "must not close a set",
          })
        ),
        /BOUNDED_RECOVERY_CLAIM_AMBIGUOUS/,
      );
      const state = await database.sql<Array<{ open_count: number }>>`
        SELECT COUNT(*)::integer AS open_count
          FROM claim_log
         WHERE run_id = ${runId} AND outcome IS NULL
      `;
      assert.equal(state[0]?.open_count, 2);
    } finally {
      await database.cleanup();
    }
  });

  it("does not treat a running step without a claim as recoverable authority", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-recovery-owner-missing";
      const stepDbId = `${runId}-step`;
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          (${stepDbId}, ${runId}, 'supervise', 'feature-dev_supervisor', 2, '', '', 'running')
      `;
      await assert.rejects(
        database.sql.begin((transaction) =>
          closeUniqueSingleStepClaimForRecoveryInTransaction(transaction, {
            runId,
            stepDbId,
            workflowStepId: "supervise",
            outcome: "infra_retry",
            diagnostic: "missing owner",
          })
        ),
        /BOUNDED_RECOVERY_RUNNING_OWNER_MISSING/,
      );
    } finally {
      await database.cleanup();
    }
  });
});
