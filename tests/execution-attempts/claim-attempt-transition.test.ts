import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  closeClaimAndBoundAttempt,
  closeUniqueSingleStepClaimForRecoveryInTransaction,
  completeSingleStepClaimAndState,
  completeStoryClaimAndBoundAttempt,
} from "../../src/execution/claim-attempt-transition.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import type { PgTransactionSql } from "../../src/db-pg.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { exactProductReservation, HASH_A } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

async function insertClaim(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{
    runId: string;
    workflowStepId?: string;
    storyId?: string | null;
    agentId?: string;
    claimedAt?: Date;
  }>,
): Promise<number> {
  const workflowStepId = input.workflowStepId ?? "implement";
  const storyId = input.storyId === undefined ? "US-002" : input.storyId;
  const claimAgentId = input.agentId ?? "feature-dev_developer";
  const claimedAt = input.claimedAt ?? new Date(Date.now() - 60_000);
  return database.sql.begin(async (transaction) => {
    const rows = await (transaction as PgTransactionSql)<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      storyId === null ? "a-claim-single-runtime-v1" : "a-claim-loop-runtime-v1",
      rows,
    );
    return insertAndBindInternalProductionClaimBirthV1(transaction as PgTransactionSql, birth, {
      runId: input.runId,
      workflowStepId,
      storyId,
      claimAgentId,
      claimedAt,
    });
  }) as Promise<number>;
}

describe("atomic claim-attempt terminal transition", () => {
  it("rolls claim outcome back when authenticated sidecar close is rejected", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-claim-close-trigger-rollback";
      await database.insertRun(runId);
      const claimId = await insertClaim(database, { runId, storyId: null });
      await database.sql.unsafe(`
        CREATE FUNCTION reject_claim_owner_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='claim' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_CLAIM_OWNER_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_claim_owner_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_claim_owner_close_v1()
      `);
      await assert.rejects(
        closeClaimAndBoundAttempt(database.sql, {
          claimId,
          runId,
          stepId: "implement",
          storyId: null,
          agentId: "feature-dev_developer",
          outcome: "failed",
          diagnostic: "must roll back",
        }),
        /TEST_CLAIM_OWNER_CLOSE_REJECTED/,
      );
      const stored = (await database.sql<Array<{ outcome: string | null; owner_state: string }>>`
        SELECT claim.outcome,reservation.state AS owner_state
          FROM claim_log claim
          JOIN internal_production_owner_reservations_v1 reservation
            ON reservation.category='claim' AND reservation.owner_key=claim.id::text
         WHERE claim.id=${claimId}
      `)[0]!;
      assert.deepEqual({ ...stored }, { outcome: null, owner_state: "bound" });
    } finally {
      await database.cleanup();
    }
  });

  it("closes authenticated claim owners for all six terminal outcomes", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      for (const outcome of [
        "completed", "infra_retry", "failed", "skipped", "abandoned", "cancelled",
      ] as const) {
        const runId = `run-claim-terminal-${outcome}`;
        await database.insertRun(runId);
        const claimId = await insertClaim(database, { runId, storyId: null });
        const result = await closeClaimAndBoundAttempt(database.sql, {
          claimId,
          runId,
          stepId: "implement",
          storyId: null,
          agentId: "feature-dev_developer",
          outcome,
          diagnostic: `exact ${outcome}`,
        });
        assert.equal(result.status, "closed");
        const stored = (await database.sql<Array<{ outcome: string; owner_state: string }>>`
          SELECT claim.outcome,reservation.state AS owner_state
            FROM claim_log claim
            JOIN internal_production_owner_reservations_v1 reservation
              ON reservation.category='claim' AND reservation.owner_key=claim.id::text
           WHERE claim.id=${claimId}
        `)[0]!;
        assert.deepEqual({ ...stored }, { outcome, owner_state: "closed" });
      }
    } finally {
      await database.cleanup();
    }
  });

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

  it("persists exact source-at-failure evidence in the claim terminalization transaction", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-claim-failure-source";
      await database.insertRun(runId);
      const claimId = await insertClaim(database, { runId });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_claim-failure-source-0001",
        fenceToken: () => "7".repeat(64),
      });
      const reserved = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const sourceAtFailure = { sha: "1".repeat(40), treeHash: "2".repeat(64) };

      const result = await closeClaimAndBoundAttempt(database.sql, {
        claimId,
        runId,
        stepId: "implement",
        storyId: "US-002",
        agentId: "feature-dev_developer",
        outcome: "infra_retry",
        diagnostic: "captured exact failure source",
        attemptDisposition: "inconclusive",
        attemptFailureEvidence: {
          attemptId: reserved.attempt.attemptId,
          generation: reserved.attempt.generation,
          fenceToken: reserved.attempt.fenceToken,
          runId,
          stepId: "implement",
          storyId: "US-002",
          sourceAtFailure,
          legacyClaimId: claimId,
          evidenceRefs: ["setfarm://test/source-at-failure"],
        },
      });
      assert.equal(result.status, "closed");
      const rows = await database.sql<Array<{
        outcome: string;
        disposition: string;
        source_after_sha: string;
        source_after_tree_hash: string;
        evidence_refs: string[];
      }>>`
        SELECT claim.outcome, attempt.disposition,
               attempt.source_after_sha, attempt.source_after_tree_hash,
               attempt.evidence_refs
          FROM claim_log claim
          JOIN execution_attempts attempt ON attempt.claim_id = claim.id
         WHERE claim.id = ${claimId}
      `;
      assert.equal(rows[0]?.outcome, "infra_retry");
      assert.equal(rows[0]?.disposition, "inconclusive");
      assert.equal(rows[0]?.source_after_sha, sourceAtFailure.sha);
      assert.equal(rows[0]?.source_after_tree_hash, sourceAtFailure.treeHash);
      assert.ok(rows[0]?.evidence_refs.includes("setfarm://test/source-at-failure"));
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back claim and source-at-failure fence together when claim terminalization fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-claim-failure-source-rollback";
      await database.insertRun(runId);
      const claimId = await insertClaim(database, { runId });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_claim-failure-source-rollback-0001",
        fenceToken: () => "8".repeat(64),
      });
      const reserved = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await database.sql.unsafe(`
        CREATE FUNCTION test_reject_claim_terminalization() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'TEST_REJECT_CLAIM_TERMINALIZATION';
        END;
        $$ LANGUAGE plpgsql
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER test_reject_claim_terminalization
        BEFORE UPDATE OF outcome ON claim_log
        FOR EACH ROW
        WHEN (OLD.outcome IS NULL AND NEW.outcome IS NOT NULL)
        EXECUTE FUNCTION test_reject_claim_terminalization()
      `);

      await assert.rejects(
        closeClaimAndBoundAttempt(database.sql, {
          claimId,
          runId,
          stepId: "implement",
          storyId: "US-002",
          agentId: "feature-dev_developer",
          outcome: "infra_retry",
          diagnostic: "transaction must roll back",
          attemptDisposition: "inconclusive",
          attemptFailureEvidence: {
            attemptId: reserved.attempt.attemptId,
            generation: reserved.attempt.generation,
            fenceToken: reserved.attempt.fenceToken,
            runId,
            stepId: "implement",
            storyId: "US-002",
            sourceAtFailure: { sha: "3".repeat(40), treeHash: "4".repeat(64) },
            legacyClaimId: claimId,
            evidenceRefs: ["setfarm://test/source-at-failure-rollback"],
          },
        }),
        /TEST_REJECT_CLAIM_TERMINALIZATION/,
      );
      const rows = await database.sql<Array<{
        outcome: string | null;
        disposition: string;
        source_after_sha: string | null;
        source_after_tree_hash: string | null;
      }>>`
        SELECT claim.outcome, attempt.disposition,
               attempt.source_after_sha, attempt.source_after_tree_hash
          FROM claim_log claim
          JOIN execution_attempts attempt ON attempt.claim_id = claim.id
         WHERE claim.id = ${claimId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        outcome: null,
        disposition: "claimed",
        source_after_sha: null,
        source_after_tree_hash: null,
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
        runContextJson: JSON.stringify({ phase: "core" }),
        expectedRunContextJson: "{}",
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
        run_context: string;
      }>>`
        SELECT cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition,
               st.status AS story_status,
               st.claimed_by AS story_claimed_by,
               s.status AS step_status,
               s.current_story_id,
               r.context AS run_context
          FROM claim_log cl
          JOIN execution_attempts ea ON ea.run_id = cl.run_id AND ea.story_id = cl.story_id
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
          JOIN runs r ON r.id = cl.run_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        claim_outcome: "completed",
        attempt_disposition: "produced_delta",
        story_status: "done",
        story_claimed_by: null,
        step_status: "running",
        current_story_id: null,
        run_context: JSON.stringify({ phase: "core" }),
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

  it("rolls back story completion when the run context compare-and-set is lost", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-story-context-cas-lost";
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
        attemptId: () => "ATT_story-context-cas-lost",
        fenceToken: () => "6".repeat(64),
      });
      const reservation = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await database.sql`
        UPDATE runs SET context = ${JSON.stringify({ concurrent: "winner" })}
         WHERE id = ${runId}
      `;
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
          storyStatus: "pending",
          storyOutput: "phase complete",
          stepStatus: "pending",
          stepOutput: "phase complete",
          runContextJson: JSON.stringify({ phase: "core" }),
          expectedRunContextJson: "{}",
        }),
        /STORY_COMPLETION_RUN_CONTEXT_CAS_LOST/,
      );
      const state = await database.sql<Array<{
        claim_outcome: string | null;
        attempt_disposition: string;
        story_status: string;
        story_claimed_by: string | null;
        step_status: string;
        current_story_id: string | null;
        run_context: string;
      }>>`
        SELECT claim.outcome AS claim_outcome,
               attempt.disposition AS attempt_disposition,
               story.status AS story_status,
               story.claimed_by AS story_claimed_by,
               step.status AS step_status,
               step.current_story_id,
               run.context AS run_context
          FROM claim_log claim
          JOIN execution_attempts attempt
            ON attempt.run_id = claim.run_id AND attempt.story_id = claim.story_id
          JOIN stories story
            ON story.run_id = claim.run_id AND story.story_id = claim.story_id
          JOIN steps step
            ON step.run_id = claim.run_id AND step.step_id = claim.step_id
          JOIN runs run ON run.id = claim.run_id
         WHERE claim.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        claim_outcome: null,
        attempt_disposition: "claimed",
        story_status: "running",
        story_claimed_by: "feature-dev_developer",
        step_status: "running",
        current_story_id: storyDbId,
        run_context: JSON.stringify({ concurrent: "winner" }),
      });
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
      const claimId = await insertClaim(database, {
        runId,
        workflowStepId: "verify",
        storyId: null,
        agentId: "feature-dev_reviewer",
      });
      const completedContext = JSON.stringify({
        product_spec_version: "v2",
        plan_english_authority_version: "compiler_review_v1",
      });
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
        runContextJson: completedContext,
        expectedRunContextJson: "{}",
      });
      const state = await database.sql<Array<{
        outcome: string;
        status: string;
        output: string;
        context: string;
      }>>`
        SELECT cl.outcome, s.status, s.output, r.context
          FROM claim_log cl
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
          JOIN runs r ON r.id = cl.run_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        outcome: "completed",
        status: "waiting",
        output: "STATUS: done",
        context: completedContext,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back claim, context, and step when a required completion owner is absent", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-required-owner";
      const stepDbId = `${runId}-step`;
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output)
        VALUES
          (${stepDbId}, ${runId}, 'plan', 'feature-dev_planner', 1, '', '', 'running', 'before')
      `;
      const claimId = await insertClaim(database, {
        runId,
        workflowStepId: "plan",
        storyId: null,
        agentId: "feature-dev_planner",
      });

      await assert.rejects(
        completeSingleStepClaimAndState(database.sql, {
          envelope: {
            schema: "setfarm.claim-envelope.v1",
            protocol: "shadow",
            issuedAt: new Date().toISOString(),
            stepId: stepDbId,
            workflowStepId: "plan",
            runId,
            claimId,
            claimAgentId: "feature-dev_planner",
            runtimeAgentId: "atlas",
          },
          stepStatus: "done",
          stepOutput: "STATUS: done",
          runContextJson: JSON.stringify({ product_spec_version: "v2" }),
          expectedRunContextJson: "{}",
          requireRuntimeCompletionOwner: true,
        }),
        /SINGLE_STEP_COMPLETION_RUNTIME_OWNER_REQUIRED/,
      );

      const state = await database.sql<Array<{
        outcome: string | null;
        status: string;
        output: string;
        context: string;
      }>>`
        SELECT cl.outcome, s.status, s.output, r.context
          FROM claim_log cl
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
          JOIN runs r ON r.id = cl.run_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        outcome: null,
        status: "running",
        output: "before",
        context: "{}",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back claim and step when the run context compare-and-set is lost", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-context-cas-lost";
      const stepDbId = `${runId}-step`;
      const concurrentContext = JSON.stringify({ concurrent_update: "preserved" });
      await database.insertRun(runId);
      await database.sql`
        UPDATE runs
           SET context = ${concurrentContext}
         WHERE id = ${runId}
      `;
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output)
        VALUES
          (${stepDbId}, ${runId}, 'plan', 'feature-dev_planner', 1, '', '', 'running', 'before')
      `;
      const claimId = await insertClaim(database, {
        runId,
        workflowStepId: "plan",
        storyId: null,
        agentId: "feature-dev_planner",
      });

      await assert.rejects(
        completeSingleStepClaimAndState(database.sql, {
          envelope: {
            schema: "setfarm.claim-envelope.v1",
            protocol: "shadow",
            issuedAt: new Date().toISOString(),
            stepId: stepDbId,
            workflowStepId: "plan",
            runId,
            claimId,
            claimAgentId: "feature-dev_planner",
            runtimeAgentId: "atlas",
          },
          stepStatus: "done",
          stepOutput: "STATUS: done",
          runContextJson: JSON.stringify({ compiled_update: "candidate" }),
          expectedRunContextJson: "{}",
        }),
        /SINGLE_STEP_COMPLETION_RUN_CONTEXT_CAS_LOST/,
      );

      const state = await database.sql<Array<{
        outcome: string | null;
        status: string;
        output: string;
        context: string;
      }>>`
        SELECT cl.outcome, s.status, s.output, r.context
          FROM claim_log cl
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
          JOIN runs r ON r.id = cl.run_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        outcome: null,
        status: "running",
        output: "before",
        context: concurrentContext,
      });
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
      const claimId = await insertClaim(database, {
        runId,
        workflowStepId: "supervise",
        storyId: null,
        agentId: "feature-dev_supervisor",
      });

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
        claimId,
        claimAgentId: "feature-dev_supervisor",
      });
      const state = await database.sql<Array<{ outcome: string; diagnostic: string }>>`
        SELECT outcome, diagnostic FROM claim_log WHERE id = ${claimId}
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
