import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  createPostgresTerminalAttemptReconciler,
  reconcileTerminalClaimAttempts,
  type TerminalAttemptReconcilerDependencies,
} from "../../src/execution/attempt-reconciler.js";
import type { ExecutionAttemptV1 } from "../../src/execution/schemas/execution-attempt-v1.js";
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
  it("exact-adopts response loss, rejects a missing sidecar, and rolls insert/reread/bind failures back to the prior head", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-attempt-birth-adoption";
      await database.insertRun(runId);
      const claim = async (storyId: string) => Number((await database.sql<Array<{ id: string }>>`
        INSERT INTO claim_log (run_id,step_id,story_id,agent_id)
        VALUES (${runId},'implement',${storyId},'feature-dev_developer')
        RETURNING id::text
      `)[0]!.id);
      const claimId = await claim("US-adopt");
      const input = exactProductReservation({
        claimId,
        runId,
        storyId: "US-adopt",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      });
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_exact-adoption-0001",
        fenceToken: () => "7".repeat(64),
      });
      const first = await repository.reserve(input);
      assert.equal(first.status, "reserved");
      const headAfterFirst = Number((await database.sql<Array<{ head_version: number }>>`
        SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
      `)[0]!.head_version);
      const replay = await createAttemptRepository(database.sql, {
        attemptId: () => "ATT_must-not-be-allocated",
        fenceToken: () => "8".repeat(64),
      }).reserve(input);
      assert.equal(replay.status, "duplicate");
      assert.equal(replay.attempt.attemptId, first.attempt.attemptId);
      assert.equal(Number((await database.sql<Array<{ head_version: number }>>`
        SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
      `)[0]!.head_version), headAfterFirst);

      await database.sql`DROP INDEX idx_execution_attempts_active_fence`;
      await database.sql`DROP INDEX idx_execution_attempts_dedupe`;
      await database.sql`DROP INDEX idx_execution_attempts_claim_id_unique`;
      try {
        await database.sql.unsafe(
          `INSERT INTO execution_attempts (
             attempt_id,claim_id,run_id,step_id,story_id,generation,fence_token,
             attempt_class,packet_hash,compilation_report_hash,slice_hash,
             source_before_sha,source_before_tree_hash,source_after_sha,source_after_tree_hash,
             finding_set_hash,recovery_case_revision_id,recovery_dispatch_id,dedupe_key,
             role,agent_id,branch,worktree,lease_acquired_at,lease_expires_at,heartbeat_at,
             disposition,output_hash,evidence_refs,created_at,updated_at
           ) SELECT $2,claim_id,run_id,step_id,story_id,generation,fence_token,
                    attempt_class,packet_hash,compilation_report_hash,slice_hash,
                    source_before_sha,source_before_tree_hash,source_after_sha,source_after_tree_hash,
                    finding_set_hash,recovery_case_revision_id,recovery_dispatch_id,dedupe_key,
                    role,agent_id,branch,worktree,lease_acquired_at,lease_expires_at,heartbeat_at,
                    disposition,output_hash,evidence_refs,created_at,updated_at
               FROM execution_attempts WHERE attempt_id=$1`,
          [first.attempt.attemptId, "ATT_structural-clone-0001"],
        );
        await assert.rejects(repository.reserve(input), /ATTEMPT_DEDUPE_IDENTITY_AMBIGUOUS/);
      } finally {
        await database.sql`DELETE FROM execution_attempts WHERE attempt_id='ATT_structural-clone-0001'`;
        await database.sql`CREATE UNIQUE INDEX idx_execution_attempts_active_fence ON execution_attempts(run_id,step_id,story_id) WHERE disposition IN ('claimed','running')`;
        await database.sql`CREATE UNIQUE INDEX idx_execution_attempts_dedupe ON execution_attempts(dedupe_key) WHERE dedupe_key IS NOT NULL`;
        await database.sql`CREATE UNIQUE INDEX idx_execution_attempts_claim_id_unique ON execution_attempts(claim_id) WHERE claim_id IS NOT NULL`;
      }

      await database.sql`ALTER TABLE internal_production_owner_reservations_v1 DROP CONSTRAINT internal_production_owner_reservation_key_unique`;
      await database.sql`ALTER TABLE internal_production_owner_reservations_v1 DISABLE TRIGGER USER`;
      try {
        await database.sql.unsafe(
          `INSERT INTO internal_production_owner_reservations_v1
           SELECT 'IRES_extra-sidecar-test',repeat('0',64),category,owner_key,owner_key_hash,
                  producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
                  reservation_payload,reservation_head_predecessor_hash,state,
                  canonical_owner_identity,binding_hash,binding_payload,close_kind,
                  terminal_owner_ref,terminal_owner_hash,close_head_predecessor_hash,
                  close_head_successor_hash,preserved_fence_ref,preserved_fence_hash,
                  close_ref,close_hash,close_payload,head_version,created_at,updated_at
             FROM internal_production_owner_reservations_v1
            WHERE category='execution-attempt' AND owner_key=$1`,
          [first.attempt.attemptId],
        );
        await assert.rejects(repository.reserve(input), /EXECUTION_ATTEMPT_ADOPTION_INVALID/);
      } finally {
        await database.sql`DELETE FROM internal_production_owner_reservations_v1 WHERE reservation_ref='IRES_extra-sidecar-test'`;
        await database.sql`ALTER TABLE internal_production_owner_reservations_v1 ENABLE TRIGGER USER`;
        await database.sql`ALTER TABLE internal_production_owner_reservations_v1 ADD CONSTRAINT internal_production_owner_reservation_key_unique UNIQUE (category,owner_key_hash)`;
      }

      const pristineHead = (await database.sql<Array<{ head_hash: string }>>`
        SELECT head_hash FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
      `)[0]!;
      await database.sql`UPDATE internal_production_owner_admission_head_v1 SET head_hash=${"0".repeat(64)} WHERE singleton=TRUE`;
      const staleStoryId = "US-stale-head";
      const staleClaimId = await claim(staleStoryId);
      await assert.rejects(
        createAttemptRepository(database.sql, {
          attemptId: () => "ATT_stale-head-refusal",
          fenceToken: () => "6".repeat(64),
        }).reserve(exactProductReservation({
          claimId: staleClaimId,
          runId,
          storyId: staleStoryId,
          agentId: "feature-dev_developer",
          evidenceRefs: [`setfarm://claim-log/${staleClaimId}`],
        })),
      );
      await database.sql`
        UPDATE internal_production_owner_admission_head_v1
           SET head_hash=${pristineHead.head_hash}
         WHERE singleton=TRUE
      `;

      const failureCases = [
        { label: "insert", triggerTable: "execution_attempts", timing: "BEFORE INSERT", body: "RAISE EXCEPTION 'TEST_ATTEMPT_INSERT_REJECT';" },
        { label: "reread", triggerTable: "execution_attempts", timing: "BEFORE INSERT", body: "NEW.compilation_report_hash := repeat('0',64); RETURN NEW;" },
        { label: "bind", triggerTable: "internal_production_owner_reservations_v1", timing: "BEFORE UPDATE", body: "IF NEW.category='execution-attempt' AND NEW.state='bound' THEN RAISE EXCEPTION 'TEST_ATTEMPT_BIND_REJECT'; END IF;" },
      ] as const;
      for (const [index, failure] of failureCases.entries()) {
        const storyId = `US-${failure.label}`;
        const nextClaimId = await claim(storyId);
        const attemptId = `ATT_birth-${failure.label}-rollback`;
        const functionName = `test_attempt_birth_${failure.label}_${Date.now()}_${index}`;
        const triggerName = `trg_attempt_birth_${failure.label}_${Date.now()}_${index}`;
        const headBefore = Number((await database.sql<Array<{ head_version: number }>>`
          SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
        `)[0]!.head_version);
        try {
          await database.sql.unsafe(
            `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$ BEGIN ${failure.body} RETURN NEW; END; $$ LANGUAGE plpgsql`,
          );
          await database.sql.unsafe(
            `CREATE TRIGGER ${triggerName} ${failure.timing} ON ${failure.triggerTable}
             FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
          );
          await assert.rejects(
            createAttemptRepository(database.sql, {
              attemptId: () => attemptId,
              fenceToken: () => "9".repeat(64),
            }).reserve(exactProductReservation({
              claimId: nextClaimId,
              runId,
              storyId,
              agentId: "feature-dev_developer",
              evidenceRefs: [`setfarm://claim-log/${nextClaimId}`],
            })),
            failure.label === "reread"
              ? /EXECUTION_ATTEMPT_ADOPTION_INVALID/
              : new RegExp(`TEST_ATTEMPT_${failure.label.toUpperCase()}_REJECT`),
          );
        } finally {
          await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON ${failure.triggerTable}`);
          await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
        }
        const residue = (await database.sql<Array<{ attempts: number; sidecars: number; head_version: string }>>`
          SELECT (SELECT count(*)::integer FROM execution_attempts WHERE attempt_id=${attemptId}) AS attempts,
                 (SELECT count(*)::integer FROM internal_production_owner_reservations_v1
                   WHERE category='execution-attempt' AND owner_key=${attemptId}) AS sidecars,
                 head_version
            FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
        `)[0]!;
        assert.deepEqual({ ...residue }, { attempts: 0, sidecars: 0, head_version: String(headBefore) }, failure.label);
      }
      const completeStoryId = "US-repository-complete";
      const completeClaimId = await claim(completeStoryId);
      const completeRepository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_repository-complete-close",
        fenceToken: () => "5".repeat(64),
      });
      const completeBirth = await completeRepository.reserve(exactProductReservation({
        claimId: completeClaimId,
        runId,
        storyId: completeStoryId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${completeClaimId}`],
      }));
      await database.sql.unsafe(`
        CREATE FUNCTION reject_repository_attempt_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='execution-attempt' AND NEW.owner_key='ATT_repository-complete-close'
             AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_REPOSITORY_ATTEMPT_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_repository_attempt_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_repository_attempt_close_v1()
      `);
      await assert.rejects(completeRepository.complete({
        attemptId: completeBirth.attempt.attemptId,
        generation: completeBirth.attempt.generation,
        fenceToken: completeBirth.attempt.fenceToken,
        disposition: "failed",
        evidenceRefs: ["setfarm://test/repository-complete-close-rollback"],
      }), /TEST_REPOSITORY_ATTEMPT_CLOSE_REJECTED/);
      assert.equal((await completeRepository.findById(completeBirth.attempt.attemptId))?.disposition, "claimed");
      await database.sql`DROP TRIGGER reject_repository_attempt_close_v1 ON internal_production_owner_reservations_v1`;
      await database.sql`DROP FUNCTION reject_repository_attempt_close_v1()`;
      assert.equal((await completeRepository.complete({
        attemptId: completeBirth.attempt.attemptId,
        generation: completeBirth.attempt.generation,
        fenceToken: completeBirth.attempt.fenceToken,
        disposition: "failed",
        evidenceRefs: ["setfarm://test/repository-complete-close-rollback"],
      })).status, "completed");
      assert.equal((await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE category='execution-attempt' AND owner_key=${completeBirth.attempt.attemptId}
      `)[0]?.state, "closed");
      await database.sql`ALTER TABLE internal_production_owner_reservations_v1 DISABLE TRIGGER USER`;
      try {
        await database.sql`
          DELETE FROM internal_production_owner_reservations_v1
           WHERE category='execution-attempt' AND owner_key=${first.attempt.attemptId}
        `;
      } finally {
        await database.sql`ALTER TABLE internal_production_owner_reservations_v1 ENABLE TRIGGER USER`;
      }
      await assert.rejects(repository.reserve(input), /EXECUTION_ATTEMPT_ADOPTION_INVALID/);
    } finally {
      await database.cleanup();
    }
  });

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
    const database = await createIsolatedTestDatabase();
    try {
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
      const bornOwner = await database.sql<Array<{
        state: string;
        owner_key: string;
      }>>`
        SELECT state, owner_key
          FROM internal_production_owner_reservations_v1
         WHERE category = 'execution-attempt'
           AND owner_key = 'ATT_reconcile-pg-000001'
      `;
      assert.deepEqual(bornOwner.map((row) => ({ ...row })), [{
        state: "bound",
        owner_key: "ATT_reconcile-pg-000001",
      }]);
      await database.sql`
        UPDATE claim_log
           SET outcome = 'infra_retry', abandoned_at = NOW() - INTERVAL '1 minute',
               duration_ms = 60000, diagnostic = 'hard timeout'
         WHERE id = ${claimId}
      `;
      await database.sql`UPDATE runs SET status = 'cancelled' WHERE id = 'run-reconcile-pg'`;

      const reconciler = createPostgresTerminalAttemptReconciler(database.sql, { graceMs: 0 });
      await database.sql.unsafe(`
        CREATE FUNCTION reject_reconciler_attempt_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='execution-attempt' AND NEW.owner_key='ATT_reconcile-pg-000001'
             AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_RECONCILER_ATTEMPT_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_reconciler_attempt_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_reconciler_attempt_close_v1()
      `);
      const rejected = await reconciler.reconcileClaim({ claimId, runtimeQuiesced: true });
      assert.deepEqual(rejected, { scanned: 1, reconciled: 0, raced: 0, failed: 1 });
      assert.equal((await repository.findById("ATT_reconcile-pg-000001"))?.disposition, "claimed");
      assert.equal((await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE category='execution-attempt' AND owner_key='ATT_reconcile-pg-000001'
      `)[0]?.state, "bound");
      await database.sql`DROP TRIGGER reject_reconciler_attempt_close_v1 ON internal_production_owner_reservations_v1`;
      await database.sql`DROP FUNCTION reject_reconciler_attempt_close_v1()`;
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
      const terminalOwner = await database.sql<Array<{ state: string }>>`
        SELECT state
          FROM internal_production_owner_reservations_v1
         WHERE category = 'execution-attempt'
           AND owner_key = 'ATT_reconcile-pg-000001'
      `;
      assert.deepEqual(terminalOwner.map((row) => ({ ...row })), [{ state: "closed" }]);
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
    const database = await createIsolatedTestDatabase();
    try {
      const releaseSha = "d".repeat(40);
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
