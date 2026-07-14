import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertClaimAuthority,
  parseClaimEnvelope,
} from "../../src/execution/claim-authority.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { exactProductReservation, HASH_A } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

describe("immutable claim authority", () => {
  it("validates paired story identity and forbids incomplete compiler capabilities", () => {
    const base = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "shadow",
      issuedAt: new Date().toISOString(),
      stepId: "step-1",
      workflowStepId: "implement",
      runId: "run-1",
      claimId: 1,
      claimAgentId: "feature-dev_developer",
      runtimeAgentId: "prism",
    } as const;
    assert.throws(() => parseClaimEnvelope({ ...base, storyId: "US-001" }), /Story identity/);
    assert.throws(
      () => parseClaimEnvelope({ ...base, storyId: "US-001", storyDbId: "story-1" }),
      /attempt fence/i,
    );
    assert.equal(parseClaimEnvelope(base).runtimeAgentId, "prism");
  });

  it("accepts a mapped runtime only through the exact claim, generation, and attempt fence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-authority-story";
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
          (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 4)
      `;
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'implement', 'US-002', 'feature-dev_developer', NOW())
        RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_authority-story-01",
        fenceToken: () => "f".repeat(64),
      });
      const reservation = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const envelope = {
        schema: "setfarm.claim-envelope.v1" as const,
        protocol: "shadow" as const,
        issuedAt: new Date().toISOString(),
        stepId: stepDbId,
        workflowStepId: "implement",
        runId,
        storyId: "US-002",
        storyDbId,
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        claimGeneration: 4,
        attempt: {
          attemptId: reservation.attempt.attemptId,
          generation: reservation.attempt.generation,
          fenceToken: reservation.attempt.fenceToken,
        },
      };
      const authority = await assertClaimAuthority(database.sql, envelope, stepDbId);
      assert.equal(authority.storyId, "US-002");
      assert.equal(authority.envelope.runtimeAgentId, "prism");

      await database.sql`UPDATE stories SET claim_generation = 5 WHERE id = ${storyDbId}`;
      await assert.rejects(
        assertClaimAuthority(database.sql, envelope, stepDbId),
        /CLAIM_AUTHORITY_GENERATION_MISMATCH/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("accepts v3 story authority only when its attempt matches the activated packet and slice", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-authority-v3";
      const stepDbId = `${runId}-step`;
      const storyDbId = `${runId}-story`;
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'v3 authority', 'running', 'v3',
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
          (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 3)
      `;
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'implement', 'US-002', 'feature-dev_developer', NOW())
        RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_authority-v3-00001",
        fenceToken: () => "7".repeat(64),
      });
      const reservation = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const envelope = {
        schema: "setfarm.claim-envelope.v1" as const,
        protocol: "v3" as const,
        issuedAt: new Date().toISOString(),
        stepId: stepDbId,
        workflowStepId: "implement",
        runId,
        storyId: "US-002",
        storyDbId,
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        claimGeneration: 3,
        attempt: {
          attemptId: reservation.attempt.attemptId,
          generation: reservation.attempt.generation,
          fenceToken: reservation.attempt.fenceToken,
        },
      };
      assert.equal((await assertClaimAuthority(database.sql, envelope, stepDbId)).protocol, "v3");
      await database.sql`
        UPDATE execution_attempts SET slice_hash = NULL
         WHERE attempt_id = ${reservation.attempt.attemptId}
      `;
      await assert.rejects(
        assertClaimAuthority(database.sql, envelope, stepDbId),
        /CLAIM_AUTHORITY_V3_ATTEMPT_CONTRACT_MISMATCH/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a stale single-step claim id without touching current state", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-authority-single";
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
      await assert.rejects(
        assertClaimAuthority(database.sql, {
          schema: "setfarm.claim-envelope.v1",
          protocol: "shadow",
          issuedAt: new Date().toISOString(),
          stepId: stepDbId,
          workflowStepId: "verify",
          runId,
          claimId: claims[0]!.id + 1,
          claimAgentId: "feature-dev_reviewer",
          runtimeAgentId: "flux",
        }, stepDbId),
        /CLAIM_AUTHORITY_NOT_FOUND/,
      );
      const state = await database.sql<Array<{ status: string; outcome: string | null }>>`
        SELECT s.status, cl.outcome
          FROM steps s
          JOIN claim_log cl ON cl.run_id = s.run_id AND cl.step_id = s.step_id
         WHERE s.id = ${stepDbId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "running", outcome: null });
    } finally {
      await database.cleanup();
    }
  });
});
