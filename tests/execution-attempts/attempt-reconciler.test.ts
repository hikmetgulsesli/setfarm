import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  createPostgresTerminalAttemptReconciler,
  reconcileTerminalClaimAttempts,
  type TerminalAttemptReconcilerDependencies,
} from "../../src/execution/attempt-reconciler.js";
import type { ExecutionAttemptV1 } from "../../src/execution/schemas/execution-attempt-v1.js";
import { applyContractSpineMigrations } from "../../src/db/contract-spine-migrations.js";
import { exactProductReservation, HASH_B } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

function activeAttempt(overrides: Partial<ExecutionAttemptV1> = {}): ExecutionAttemptV1 {
  return {
    schema: "setfarm.execution-attempt.v1",
    attemptId: "ATT_reconcile-test-0001",
    runId: "run-reconcile-1",
    stepId: "implement",
    storyId: "US-002",
    generation: 1,
    fenceToken: "f".repeat(64),
    attemptClass: "product_implementation",
    compilationReportHash: HASH_B,
    sourceBefore: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
    role: "developer",
    agentId: "feature-dev_developer",
    branch: "story/us-002",
    worktree: "/tmp/missing-reconciler-worktree",
    lease: {
      acquiredAt: "2026-07-13T00:00:00.000Z",
      expiresAt: "2026-07-13T00:10:00.000Z",
      heartbeatAt: "2026-07-13T00:00:00.000Z",
    },
    disposition: "claimed",
    evidenceRefs: ["setfarm://claim-log/91"],
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<TerminalAttemptReconcilerDependencies> = {},
): TerminalAttemptReconcilerDependencies {
  const attempt = activeAttempt();
  return {
    listCandidates: async () => [{ attempt, claimId: 91, claimOutcome: "infra_retry" }],
    complete: async (input) => ({
      status: "completed",
      attempt: { ...attempt, disposition: input.disposition, evidenceRefs: input.evidenceRefs },
    }),
    emit: async () => undefined,
    ...overrides,
  };
}

describe("terminal claim attempt reconciler", () => {
  it("terminalizes an infra retry as inconclusive with exact claim evidence", async () => {
    let completion: Parameters<TerminalAttemptReconcilerDependencies["complete"]>[0] | undefined;
    const result = await reconcileTerminalClaimAttempts({ limit: 10 }, dependencies({
      complete: async (input) => {
        completion = input;
        return {
          status: "completed",
          attempt: { ...activeAttempt(), disposition: input.disposition, evidenceRefs: input.evidenceRefs },
        };
      },
    }));
    assert.deepEqual(result, { scanned: 1, reconciled: 1, raced: 0, failed: 0 });
    assert.equal(completion?.disposition, "inconclusive");
    assert.deepEqual(completion?.evidenceRefs, [
      "setfarm://attempt-reconciler/claim-terminal/infra_retry",
      "setfarm://claim-log/91",
    ]);
  });

  it("preserves a failed legacy disposition and treats a lost fence as a benign race", async () => {
    const dispositions: string[] = [];
    const emitted: Array<{ code: string; requestedDisposition: string }> = [];
    const result = await reconcileTerminalClaimAttempts({ limit: 10 }, dependencies({
      listCandidates: async () => [{ attempt: activeAttempt(), claimId: 91, claimOutcome: "failed" }],
      complete: async (input) => {
        dispositions.push(input.disposition);
        return { status: "stale_fence" };
      },
      emit: async (event) => {
        emitted.push({ code: event.code, requestedDisposition: event.requestedDisposition });
      },
    }));
    assert.deepEqual(dispositions, ["failed"]);
    assert.deepEqual(result, { scanned: 1, reconciled: 0, raced: 1, failed: 0 });
    assert.deepEqual(emitted, [{
      code: "ATTEMPT_TERMINAL_RECONCILE_RACED",
      requestedDisposition: "failed",
    }]);
  });

  it("contains one malformed candidate and continues the bounded batch", async () => {
    const result = await reconcileTerminalClaimAttempts({ limit: 10 }, dependencies({
      listCandidates: async () => [
        { attempt: activeAttempt(), claimId: 91, claimOutcome: "infra_retry" },
        { attempt: activeAttempt({ attemptId: "ATT_reconcile-test-0002" }), claimId: 92, claimOutcome: "completed" },
      ],
      complete: async (input) => {
        if (input.attemptId.endsWith("0001")) throw new Error("private DB detail");
        return {
          status: "completed",
          attempt: { ...activeAttempt({ attemptId: input.attemptId }), disposition: input.disposition },
        };
      },
    }));
    assert.deepEqual(result, { scanned: 2, reconciled: 1, raced: 0, failed: 1 });
  });

  it("reconciles a real terminal claim exactly once under the repository fence", async () => {
    const database = await createIsolatedTestDatabase({ migrate: false });
    try {
      await applyContractSpineMigrations(database.sql, { releaseSha: "d".repeat(40) });
      await database.sql`
        INSERT INTO runs (
          id, run_number, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash
        ) VALUES (
          'run-reconcile-pg', 1, 'feature-dev', 'reconcile', 'running', 'shadow',
          ${"d".repeat(40)}, ${"a".repeat(64)}
        )
      `;
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (
          run_id, step_id, story_id, agent_id, claimed_at,
          outcome, abandoned_at, duration_ms, diagnostic
        ) VALUES (
          'run-reconcile-pg', 'implement', 'US-002', 'feature-dev_developer',
          NOW() - INTERVAL '2 minutes', NULL, NULL, NULL, NULL
        ) RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_reconcile-pg-000001",
        fenceToken: () => "e".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-reconcile-pg",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }), { now: new Date("2026-07-13T00:00:00.000Z") });
      await database.sql`
        UPDATE claim_log
           SET outcome = 'infra_retry', abandoned_at = NOW() - INTERVAL '1 minute',
               duration_ms = 60000, diagnostic = 'hard timeout'
         WHERE id = ${claimId}
      `;
      await database.sql`UPDATE runs SET status = 'cancelled' WHERE id = 'run-reconcile-pg'`;

      const reconciler = createPostgresTerminalAttemptReconciler(database.sql, { graceMs: 0 });
      const first = await reconciler.reconcileClaim({ claimId, runtimeQuiesced: true });
      const second = await reconciler.reconcile({ limit: 10 });
      assert.deepEqual(first, { scanned: 1, reconciled: 1, raced: 0, failed: 0 });
      assert.deepEqual(second, { scanned: 0, reconciled: 0, raced: 0, failed: 0 });
      const stored = await repository.findById("ATT_reconcile-pg-000001");
      assert.equal(stored?.disposition, "inconclusive");
      assert.ok(stored?.evidenceRefs.includes(`setfarm://claim-log/${claimId}`));
      assert.ok(
        stored?.evidenceRefs.includes("setfarm://attempt-reconciler/claim-terminal/infra_retry"),
        JSON.stringify(stored?.evidenceRefs),
      );
    } finally {
      await database.cleanup();
    }
  });

  it("waits for lease expiry during polling but permits explicit post-drain reconciliation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-reconcile-live-lease";
      await database.insertRun(runId);
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (
          run_id, step_id, story_id, agent_id, claimed_at,
          outcome, abandoned_at, duration_ms, diagnostic
        ) VALUES (
          ${runId}, 'implement', 'US-002', 'feature-dev_developer',
          NOW() - INTERVAL '1 minute', NULL, NULL, NULL, NULL
        ) RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_reconcile-live-lease",
        fenceToken: () => "f".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }), { now: new Date(), leaseMs: 5 * 60_000 });
      await database.sql`
        UPDATE claim_log
           SET outcome = 'infra_retry', abandoned_at = NOW() - INTERVAL '30 seconds',
               duration_ms = 30000, diagnostic = 'claim closed before runtime drain'
         WHERE id = ${claimId}
      `;

      const reconciler = createPostgresTerminalAttemptReconciler(database.sql, { graceMs: 0 });
      assert.deepEqual(await reconciler.reconcile({ limit: 10 }), {
        scanned: 0,
        reconciled: 0,
        raced: 0,
        failed: 0,
      });
      assert.deepEqual(
        await reconciler.reconcileClaim({ claimId, runtimeQuiesced: true }),
        { scanned: 1, reconciled: 1, raced: 0, failed: 0 },
      );
    } finally {
      await database.cleanup();
    }
  });

  it("refuses explicit reconciliation until the durable runtime session is quiescent", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-reconcile-runtime-owner";
      await database.insertRun(runId);
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
        VALUES (${runId}, 'implement', 'US-002', 'feature-dev_developer')
        RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_reconcile-runtime-owner",
        fenceToken: () => "a".repeat(64),
      });
      const reserved = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }), { leaseMs: 5 * 60_000 });
      await database.sql.unsafe(
        `INSERT INTO runtime_sessions (
           session_id, run_id, step_db_id, workflow_step_id, story_db_id, story_id,
           claim_id, attempt_id, claim_agent_id, runtime_agent_id, runtime_kind,
           state, owner_instance_id, heartbeat_at
         ) VALUES (
           $1, $2, $3, 'implement', $4, 'US-002',
           $5, $6, 'feature-dev_developer', 'prism', 'openclaw_session',
           'starting', 'spawner-test', clock_timestamp()
         )`,
        [
          "RTS_reconcile-runtime-owner",
          runId,
          `${runId}-step`,
          `${runId}-story`,
          claimId,
          reserved.attempt.attemptId,
        ],
      );
      await database.sql`
        UPDATE claim_log
           SET outcome = 'infra_retry', abandoned_at = clock_timestamp(),
               diagnostic = 'manager observed terminal claim before runtime drain'
         WHERE id = ${claimId}
      `;
      const reconciler = createPostgresTerminalAttemptReconciler(database.sql, { graceMs: 0 });
      assert.deepEqual(
        await reconciler.reconcileClaim({ claimId, runtimeQuiesced: true }),
        { scanned: 1, reconciled: 0, raced: 1, failed: 0 },
      );
      assert.equal((await repository.findById(reserved.attempt.attemptId))?.disposition, "claimed");
      await database.sql`
        UPDATE runtime_sessions
           SET state = 'drained', drained_at = clock_timestamp(), updated_at = clock_timestamp()
         WHERE session_id = 'RTS_reconcile-runtime-owner'
      `;
      assert.deepEqual(
        await reconciler.reconcileClaim({ claimId, runtimeQuiesced: true }),
        { scanned: 1, reconciled: 1, raced: 0, failed: 0 },
      );
      assert.equal((await repository.findById(reserved.attempt.attemptId))?.disposition, "inconclusive");
    } finally {
      await database.cleanup();
    }
  });

  it("rejects malformed relational bindings and ignores v3 compatibility candidates", async () => {
    const database = await createIsolatedTestDatabase({ migrate: false });
    try {
      const releaseSha = "d".repeat(40);
      await applyContractSpineMigrations(database.sql, { releaseSha });
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES
          ('run-reconcile-invalid', 'feature-dev', 'invalid bindings', 'running', 'shadow', ${releaseSha}, ${"a".repeat(64)}, NULL),
          ('run-reconcile-v3', 'feature-dev', 'v3 binding', 'running', 'v3', ${releaseSha}, ${"a".repeat(64)}, ${releaseAdmissionHash})
      `;
      const claims = await database.sql<Array<{ id: number; story_id: string }>>`
        INSERT INTO claim_log (
          run_id, step_id, story_id, agent_id, claimed_at,
          outcome, abandoned_at, duration_ms
        ) VALUES
          ('run-reconcile-invalid', 'implement', 'US-MULTI', 'feature-dev_developer', NOW() - INTERVAL '2 minutes', NULL, NULL, NULL),
          ('run-reconcile-invalid', 'implement', 'US-OTHER', 'feature-dev_developer', NOW() - INTERVAL '2 minutes', NULL, NULL, NULL),
          ('run-reconcile-invalid', 'implement', 'US-AGENT', 'different-agent', NOW() - INTERVAL '2 minutes', NULL, NULL, NULL),
          ('run-reconcile-v3', 'implement', 'US-V3', 'feature-dev_developer', NOW() - INTERVAL '2 minutes', NULL, NULL, NULL)
        RETURNING id::integer AS id, story_id
      `;
      const claimId = (storyId: string) => claims.find((row) => row.story_id === storyId)!.id;
      const invalidRepository = createAttemptRepository(database.sql);
      await assert.rejects(invalidRepository.reserve(exactProductReservation({
        claimId: claimId("US-MULTI"),
        runId: "run-reconcile-invalid",
        storyId: "US-MULTI",
        agentId: "feature-dev_developer",
        evidenceRefs: [
          `setfarm://claim-log/${claimId("US-MULTI")}`,
          `setfarm://claim-log/${claimId("US-OTHER")}`,
        ],
      })));
      await assert.rejects(invalidRepository.reserve(exactProductReservation({
        claimId: claimId("US-AGENT"),
        runId: "run-reconcile-invalid",
        storyId: "US-AGENT",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId("US-AGENT")}`],
      })), /ATTEMPT_CLAIM_BINDING_INVALID/);
      await invalidRepository.reserve(exactProductReservation({
        claimId: claimId("US-V3"),
        runId: "run-reconcile-v3",
        storyId: "US-V3",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId("US-V3")}`],
      }));
      await database.sql`
        UPDATE claim_log
           SET outcome = 'infra_retry', abandoned_at = NOW() - INTERVAL '1 minute',
               duration_ms = 60000
         WHERE id = ${claimId("US-V3")}
      `;

      const reconciler = createPostgresTerminalAttemptReconciler(database.sql, { graceMs: 0 });
      assert.deepEqual(
        await reconciler.reconcileClaim({ claimId: claimId("US-V3"), runtimeQuiesced: true }),
        { scanned: 0, reconciled: 0, raced: 0, failed: 0 },
      );
    } finally {
      await database.cleanup();
    }
  });
});
