import assert from "node:assert/strict";
import { test } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  createOperationalRetryDirectiveV1,
  parseOperationalRetryDirectiveStoryOutput,
} from "../../src/execution/operational-retry-directive.js";
import {
  publishOperationalRetryDirectiveInTransaction,
  terminalizeOperationalRetryExhaustionInTransaction,
} from "../../src/execution/operational-retry-transition.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("one terminal product attempt authorizes one concurrency-fenced infrastructure retry", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  try {
    const runId = "run-v3-operational-retry-lifecycle";
    const storyId = "US-001";
    const agentId = "feature-dev_developer";
    const packetHash = "a".repeat(64);
    const compilationReportHash = "b".repeat(64);
    const sliceHash = "c".repeat(64);
    const sourceBefore = { sha: "d".repeat(40), treeHash: "e".repeat(64) };
    const releaseSha = "f".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, packet_hash,
        release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'operational retry lifecycle', 'running', '{}', 'v3',
        ${releaseSha}, ${"1".repeat(64)}, ${packetHash}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, loop_config, current_story_id
      ) VALUES (
        'step-v3-operational-retry', ${runId}, 'implement', ${agentId}, 1, '', '',
        'running', 'loop', '{"over":"stories","parallel":1}', 'story-v3-operational-retry'
      )
    `;
    await database.sql`
      INSERT INTO stories (
        id, run_id, story_index, story_id, title, status, claimed_by, claim_generation
      ) VALUES (
        'story-v3-operational-retry', ${runId}, 1, ${storyId}, 'Typed retry story',
        'running', ${agentId}, 1
      )
    `;
    const firstClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${runId}, 'implement', ${storyId}, ${agentId}, NOW())
      RETURNING id::integer AS id
    `;
    let identity = 0;
    const attempts = createAttemptRepository(database.sql, {
      attemptId: () => `ATT_v3-operational-retry-${String(++identity).padStart(4, "0")}`,
      fenceToken: () => String(identity).padStart(64, "0"),
    });
    const first = await attempts.reserve({
      claimId: firstClaims[0]!.id,
      runId,
      stepId: "implement",
      storyId,
      attemptClass: "product_implementation",
      packetHash,
      compilationReportHash,
      sliceHash,
      sourceBefore,
      role: "developer",
      agentId,
      branch: "run-operational-retry-us-001",
      worktree: "/tmp/run-operational-retry-us-001",
      evidenceRefs: [`setfarm://claim-log/${firstClaims[0]!.id}`],
    });
    assert.equal(first.status, "reserved");
    const directive = createOperationalRetryDirectiveV1({
      runId,
      stepId: "implement",
      storyId,
      priorAttempt: {
        claimId: firstClaims[0]!.id,
        attemptId: first.attempt.attemptId,
        generation: first.attempt.generation,
        attemptClass: "product_implementation",
        packetHash,
        sliceHash,
        sourceBefore,
        terminalDisposition: "inconclusive",
      },
      failure: {
        code: "IMPLEMENT_NO_DELTA_STALL",
        diagnostic: "IMPLEMENT_NO_DELTA_STALL: no bounded source delta",
      },
      nextSourceRevision: sourceBefore,
      allowedPaths: ["src/App.tsx"],
    });
    await assert.rejects(
      database.sql.begin((transaction) =>
        publishOperationalRetryDirectiveInTransaction(transaction, {
          claimId: firstClaims[0]!.id,
          attemptId: first.attempt.attemptId,
          attemptGeneration: first.attempt.generation,
          runId,
          stepId: "implement",
          stepDbId: "wrong-step-v3-operational-retry",
          storyId,
          storyDbId: "story-v3-operational-retry",
          agentId,
          diagnostic: "IMPLEMENT_NO_DELTA_STALL: no bounded source delta",
          directive,
        }),
      ),
      /OPERATIONAL_RETRY_STEP_STATE_CAS_LOST/,
    );
    const rolledBack = await database.sql<Array<{
      claim_outcome: string | null;
      disposition: string;
      story_status: string;
      story_output: string | null;
    }>>`
      SELECT claim.outcome AS claim_outcome, attempt.disposition,
             story.status AS story_status, story.output AS story_output
        FROM claim_log claim
        JOIN execution_attempts attempt ON attempt.claim_id = claim.id
        JOIN stories story ON story.run_id = claim.run_id AND story.story_id = claim.story_id
       WHERE claim.id = ${firstClaims[0]!.id}
    `;
    assert.deepEqual({ ...rolledBack[0]! }, {
      claim_outcome: null,
      disposition: "claimed",
      story_status: "running",
      story_output: null,
    });
    const terminal = await database.sql.begin((transaction) =>
      publishOperationalRetryDirectiveInTransaction(transaction, {
        claimId: firstClaims[0]!.id,
        attemptId: first.attempt.attemptId,
        attemptGeneration: first.attempt.generation,
        runId,
        stepId: "implement",
        stepDbId: "step-v3-operational-retry",
        storyId,
        storyDbId: "story-v3-operational-retry",
        agentId,
        diagnostic: "IMPLEMENT_NO_DELTA_STALL: no bounded source delta",
        directive,
      }),
    );
    assert.equal(terminal.status, "closed");
    assert.equal(terminal.attemptDisposition, "inconclusive");
    const publishedStates = await database.sql<Array<{
      story_status: string;
      claimed_by: string | null;
      output: string | null;
      step_status: string;
      current_story_id: string | null;
    }>>`
      SELECT story.status AS story_status, story.claimed_by, story.output,
             step.status AS step_status, step.current_story_id
        FROM stories story
        JOIN steps step ON step.run_id = story.run_id AND step.step_id = 'implement'
       WHERE story.id = 'story-v3-operational-retry'
    `;
    assert.deepEqual(
      {
        story_status: publishedStates[0]!.story_status,
        claimed_by: publishedStates[0]!.claimed_by,
        step_status: publishedStates[0]!.step_status,
        current_story_id: publishedStates[0]!.current_story_id,
      },
      {
        story_status: "pending",
        claimed_by: null,
        step_status: "pending",
        current_story_id: null,
      },
    );
    assert.equal(
      parseOperationalRetryDirectiveStoryOutput(publishedStates[0]!.output)?.directiveHash,
      directive.directiveHash,
    );
    await database.sql`
      UPDATE stories
         SET status = 'running', claimed_by = ${agentId}, claimed_at = NOW(), claim_generation = 2
       WHERE id = 'story-v3-operational-retry'
    `;
    await database.sql`
      UPDATE steps
         SET status = 'running', current_story_id = 'story-v3-operational-retry'
       WHERE id = 'step-v3-operational-retry'
    `;
    const secondClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${runId}, 'implement', ${storyId}, ${agentId}, NOW())
      RETURNING id::integer AS id
    `;
    const retryReservation = {
      claimId: secondClaims[0]!.id,
      runId,
      stepId: "implement",
      storyId,
      attemptClass: "infrastructure_retry" as const,
      packetHash,
      compilationReportHash,
      sliceHash,
      sourceBefore,
      predecessorAttempt: {
        attemptId: directive.priorAttempt.attemptId,
        generation: directive.priorAttempt.generation,
        terminalDisposition: directive.priorAttempt.terminalDisposition,
      },
      role: "developer",
      agentId,
      branch: "run-operational-retry-us-001",
      worktree: "/tmp/run-operational-retry-us-001",
      evidenceRefs: [
        `setfarm://claim-log/${secondClaims[0]!.id}`,
        `setfarm://operational-retry/${directive.directiveHash}`,
      ],
    };
    await assert.rejects(
      attempts.reserve({
        ...retryReservation,
        predecessorAttempt: {
          ...retryReservation.predecessorAttempt,
          attemptId: "ATT_v3-operational-retry-wrong-predecessor",
        },
      }),
      /ATTEMPT_PREDECESSOR_FENCE_INVALID/,
    );
    const raced = await Promise.all([
      attempts.reserve(retryReservation),
      attempts.reserve(retryReservation),
    ]);
    assert.deepEqual(raced.map((item) => item.status).sort(), ["active_conflict", "reserved"]);
    const retry = raced.find((item) => item.status === "reserved")!.attempt;
    assert.equal(retry.attemptClass, "infrastructure_retry");
    assert.equal(retry.generation, first.attempt.generation + 1);
    assert.deepEqual(retry.sourceBefore, first.attempt.sourceBefore);

    const exhaustedDiagnostic = "SCOPE_WRITE_VIOLATION: fallback escaped its exact implementation slice";
    const exhausted = await database.sql.begin((transaction) =>
      terminalizeOperationalRetryExhaustionInTransaction(transaction, {
        claimId: secondClaims[0]!.id,
        attemptId: retry.attemptId,
        attemptGeneration: retry.generation,
        runId,
        stepId: "implement",
        stepDbId: "step-v3-operational-retry",
        storyId,
        storyDbId: "story-v3-operational-retry",
        agentId,
        diagnostic: exhaustedDiagnostic,
        directive,
      }),
    );
    assert.equal(exhausted.status, "closed");
    assert.equal(exhausted.attemptDisposition, "failed");

    const rows = await database.sql<Array<{
      attempt_class: string;
      generation: number;
      disposition: string;
      claim_outcome: string | null;
    }>>`
      SELECT ea.attempt_class, ea.generation, ea.disposition, cl.outcome AS claim_outcome
        FROM execution_attempts ea
        JOIN claim_log cl ON cl.id = ea.claim_id
       WHERE ea.run_id = ${runId}
       ORDER BY ea.generation
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      {
        attempt_class: "product_implementation",
        generation: 1,
        disposition: "inconclusive",
        claim_outcome: "infra_retry",
      },
      {
        attempt_class: "infrastructure_retry",
        generation: 2,
        disposition: "failed",
        claim_outcome: "failed",
      },
    ]);
    const exhaustedStates = await database.sql<Array<{
      story_status: string;
      story_output: string | null;
      step_status: string;
      current_story_id: string | null;
    }>>`
      SELECT story.status AS story_status, story.output AS story_output,
             step.status AS step_status, step.current_story_id
        FROM stories story
        JOIN steps step ON step.run_id = story.run_id AND step.step_id = 'implement'
       WHERE story.id = 'story-v3-operational-retry'
    `;
    assert.deepEqual({ ...exhaustedStates[0]! }, {
      story_status: "failed",
      story_output: exhaustedDiagnostic,
      step_status: "waiting",
      current_story_id: null,
    });

    const forbiddenClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${runId}, 'implement', ${storyId}, ${agentId}, NOW())
      RETURNING id::integer AS id
    `;
    await assert.rejects(
      attempts.reserve({
        ...retryReservation,
        claimId: forbiddenClaims[0]!.id,
        evidenceRefs: [
          `setfarm://claim-log/${forbiddenClaims[0]!.id}`,
          `setfarm://operational-retry/${directive.directiveHash}`,
        ],
      }),
      /ATTEMPT_PREDECESSOR_FENCE_INVALID/,
    );
  } finally {
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
