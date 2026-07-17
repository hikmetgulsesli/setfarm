import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  planContractSpineMigrations,
  readContractSpineMigrationAttestation,
  rollbackArtifactPublicationBatchLedgerToV22,
  rollbackArtifactStoreAuthorityLedgerToV23,
  rollbackOperationalFailureCauseSealToV20,
  rollbackProductCompilationAttemptLedgerToV21,
  rollbackRecoveryTerminalLeaseIdentityToV19,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

async function rollbackCurrentToV21(database: TestDatabase): Promise<void> {
  await rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
    targetReleaseSha: "d".repeat(40),
  });
  await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
    targetReleaseSha: "e".repeat(40),
  });
  await rollbackProductCompilationAttemptLedgerToV21(database.sql, {
    targetReleaseSha: "f".repeat(40),
  });
}

const VALID_CAUSE = Object.freeze({
  schema: "setfarm.operational-failure-cause.v1",
  workflowStepId: "setup-build",
  boundary: "stitch.converter.generated_tsx",
  failureClass: "generated_artifact_invalid",
  failureCode: "V3_OBSERVABLE_REF_INVALID",
});

describe("operational failure cause migration", () => {
  it("validates and seals optional typed causes, then rolls back without rewriting evidence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const insertRun = async (suffix: string): Promise<string> => {
        const runId = `run-operational-cause-${suffix}`;
        await database.insertRun(runId);
        return runId;
      };
      const insertTermination = async (
        suffix: string,
        targetStatus: "failed" | "cancelled",
        evidence: Readonly<Record<string, unknown>>,
      ): Promise<string> => {
        const runId = await insertRun(suffix);
        await database.sql.unsafe(
          `INSERT INTO run_termination_requests (
             request_id, run_id, target_status, state, requested_by,
             requested_at, diagnostic, evidence
           ) VALUES ($1, $2, $3, 'requested', $5,
                     NOW(), 'migration fixture', $4::text::jsonb)`,
          [
            `RTR_${suffix}`,
            runId,
            targetStatus,
            JSON.stringify(evidence),
            Object.hasOwn(evidence, "operationalFailureCause")
              ? "setfarm.step-fail.single"
              : "migration-test",
          ],
        );
        return runId;
      };

      const typedRunId = await insertTermination("typed", "failed", {
        operationalFailureCause: VALID_CAUSE,
      });
      const untypedRunId = await insertTermination("untyped", "failed", {
        source: "legacy-writer",
      });
      await database.sql.unsafe(
        `UPDATE run_termination_requests
            SET evidence = evidence || '{"drain":"complete"}'::jsonb
          WHERE run_id = $1`,
        [typedRunId],
      );
      const preserved = await database.sql<Array<{ evidence: Record<string, unknown> }>>`
        SELECT evidence FROM run_termination_requests WHERE run_id = ${typedRunId}
      `;
      assert.deepEqual(preserved[0]?.evidence, {
        drain: "complete",
        operationalFailureCause: VALID_CAUSE,
      });

      await assert.rejects(
        database.sql.unsafe(
          `UPDATE run_termination_requests
              SET evidence = jsonb_set(
                evidence,
                '{operationalFailureCause,failureCode}',
                to_jsonb($2::text)
              )
            WHERE run_id = $1`,
          [typedRunId, "STITCH_OTHER_INVALID"],
        ),
        /SETFARM_OPERATIONAL_FAILURE_CAUSE_IMMUTABLE/,
      );
      await assert.rejects(
        database.sql.unsafe(
          `UPDATE run_termination_requests
              SET evidence = evidence - 'operationalFailureCause'
            WHERE run_id = $1`,
          [typedRunId],
        ),
        /SETFARM_OPERATIONAL_FAILURE_CAUSE_IMMUTABLE/,
      );
      await assert.rejects(
        database.sql.unsafe(
          `UPDATE run_termination_requests
              SET evidence = evidence || jsonb_build_object(
                'operationalFailureCause', $2::text::jsonb
              )
            WHERE run_id = $1`,
          [untypedRunId, JSON.stringify(VALID_CAUSE)],
        ),
        /SETFARM_OPERATIONAL_FAILURE_CAUSE_IMMUTABLE/,
      );
      await assert.rejects(
        database.sql.unsafe(
          "UPDATE run_termination_requests SET target_status = 'cancelled' WHERE run_id = $1",
          [untypedRunId],
        ),
        /SETFARM_RUN_TERMINATION_TARGET_STATUS_IMMUTABLE/,
      );
      await assert.rejects(
        database.sql.unsafe(
          "UPDATE run_termination_requests SET requested_by = 'agent-prose-classifier' WHERE run_id = $1",
          [typedRunId],
        ),
        /SETFARM_RUN_TERMINATION_REQUESTED_BY_IMMUTABLE/,
      );

      await assert.rejects(
        insertTermination("cancelled-typed", "cancelled", {
          operationalFailureCause: VALID_CAUSE,
        }),
        /run_termination_requests_operational_failure_cause_check/,
      );
      await assert.rejects(
        insertTermination("extra-key", "failed", {
          operationalFailureCause: { ...VALID_CAUSE, diagnostic: "volatile" },
        }),
        /run_termination_requests_operational_failure_cause_check/,
      );
      await assert.rejects(
        insertTermination("bad-code", "failed", {
          operationalFailureCause: { ...VALID_CAUSE, failureCode: "invalid prose" },
        }),
        /run_termination_requests_operational_failure_cause_check/,
      );

      await assert.rejects(
        rollbackRecoveryTerminalLeaseIdentityToV19(database.sql, {
          targetReleaseSha: "c".repeat(40),
        }),
        (error: unknown) =>
          error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_UNKNOWN_VERSION",
      );

      const targetReleaseSha = "a".repeat(40);
      await rollbackCurrentToV21(database);
      const rollback = await rollbackOperationalFailureCauseSealToV20(database.sql, {
        targetReleaseSha,
      });
      assert.match(rollback.rollbackId, /^RBK_[a-f0-9]{64}$/);
      assert.equal(rollback.fromVersion, 21);
      assert.equal(rollback.targetVersion, 20);
      assert.equal(rollback.rowsRewritten, 0);
      const afterRollback = await database.sql<Array<{ evidence: Record<string, unknown> }>>`
        SELECT evidence FROM run_termination_requests WHERE run_id = ${typedRunId}
      `;
      assert.deepEqual(afterRollback[0]?.evidence, preserved[0]?.evidence);
      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.migrations.find((migration) => migration.version === 21)?.state, "pending");
      const attestation = await readContractSpineMigrationAttestation(database.sql);
      assert.equal(attestation.status, "attested");
      assert.equal(attestation.verifiedReleaseSha, targetReleaseSha);

      await database.sql.unsafe(
        `UPDATE run_termination_requests
            SET evidence = jsonb_set(
              evidence,
              '{operationalFailureCause,failureCode}',
              to_jsonb($2::text)
            )
          WHERE run_id = $1`,
        [typedRunId, "V3_OBSERVABLE_SELECTOR_INVALID"],
      );
      await database.sql.unsafe(
        "UPDATE run_termination_requests SET target_status = 'cancelled' WHERE run_id = $1",
        [untypedRunId],
      );
      await database.sql.unsafe(
        "UPDATE run_termination_requests SET target_status = 'failed' WHERE run_id = $1",
        [untypedRunId],
      );
      await database.sql.unsafe(
        `UPDATE run_termination_requests
            SET evidence = evidence || jsonb_build_object(
              'operationalFailureCause', $2::text::jsonb
            ), requested_by = 'setfarm.step-fail.single'
          WHERE run_id = $1`,
        [untypedRunId, JSON.stringify(VALID_CAUSE)],
      );

      const reapplied = await applyContractSpineMigrations(database.sql, {
        releaseSha: "b".repeat(40),
      });
      assert.deepEqual(reapplied.applied, [
        "021_operational_failure_cause_seal",
        "022_product_compilation_attempt_ledger",
        "023_artifact_publication_batch_ledger",
        "024_artifact_store_authority_ledger",
      ]);
      assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");

      const constraintRows = await database.sql<Array<{ expression: string }>>`
        SELECT pg_get_expr(conbin, conrelid, true) AS expression
          FROM pg_constraint
         WHERE conrelid = 'run_termination_requests'::regclass
           AND conname = 'run_termination_requests_operational_failure_cause_check'
      `;
      const exactExpression = constraintRows[0]?.expression;
      assert.ok(exactExpression);
      const installConstraint = async (expression: string): Promise<void> => {
        await database.sql.unsafe(
          "ALTER TABLE run_termination_requests DROP CONSTRAINT run_termination_requests_operational_failure_cause_check",
        );
        await database.sql.unsafe(
          `ALTER TABLE run_termination_requests
             ADD CONSTRAINT run_termination_requests_operational_failure_cause_check
             CHECK (${expression}) NOT VALID`,
        );
        await database.sql.unsafe(
          "ALTER TABLE run_termination_requests VALIDATE CONSTRAINT run_termination_requests_operational_failure_cause_check",
        );
      };
      const assertConstraintDriftRejected = async (expression: string): Promise<void> => {
        assert.notEqual(expression, exactExpression);
        await installConstraint(expression);
        await assert.rejects(
          verifyContractSpineMigrations(database.sql),
          (error: unknown) =>
            error instanceof ContractSpineMigrationError
            && error.code === "MIGRATION_ADOPTION_MISMATCH",
        );
      };
      await assertConstraintDriftRejected(exactExpression.replace(
        "'V3_DOWNSTREAM_TERMINAL_REASON_SET_3F'::text",
        "'V3_DOWNSTREAM_TERMINAL_REASON_SET_3E'::text",
      ));
      const exactReasonPredicate =
        "(evidence -> 'terminalReasonCodes'::text) = '[\"specification_incomplete\"]'::jsonb";
      await assertConstraintDriftRejected(exactExpression.replace(
        exactReasonPredicate,
        `(${exactReasonPredicate} OR (evidence -> 'terminalReasonCodes'::text) = '["specification_incomplete","operator_required"]'::jsonb)`,
      ));
      await assertConstraintDriftRejected(exactExpression.replace(
        "'V3_OBSERVABLE_REF_INVALID'::text",
        "'V3_OBSERVABLE_REF_INVALID'::text, 'STORIES_REQUIRED_OUTPUT_MISSING'::text",
      ));
      await assertConstraintDriftRejected(exactExpression.replace(
        "'V3_OBSERVABLE_REF_INVALID'::text",
        "'V3_OBSERVABLE_REF_INVALID'::text, 'ATTACKER_NEW_CODE'::text",
      ));
      await installConstraint(exactExpression);
      assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");

      await database.sql.unsafe(
        "DROP TRIGGER trg_run_termination_requests_operational_failure_cause_immutable ON run_termination_requests",
      );
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) =>
          error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    } finally {
      await database.cleanup();
    }
  });
});
