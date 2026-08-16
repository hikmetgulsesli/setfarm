import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  planContractSpineMigrations,
  readContractSpineMigrationAttestation,
  rollbackArtifactPublicationBatchLedgerToV22,
  rollbackArtifactPublicationBatchPlanLedgerToV25,
  rollbackPlatformReleaseStoreRecordLedgerV3ToV26,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackV3StoryClaimRuntimeBindingToV28,
  rollbackArtifactStoreAuthorityLedgerToV23,
  rollbackOperationalFailureCauseSealToV20,
  rollbackOperationalFailureCauseAuthorityV3ToV30,
  rollbackOperationalFailureCauseAuthorityV2ToV29,
  rollbackPreparationAuthorityV2LedgerToV24,
  rollbackProductCompilationAttemptLedgerToV21,
  rollbackRecoveryTerminalLeaseIdentityToV19,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  detectOperationalFailureCauseAuthorityV3Constraint,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS,
  verifyOperationalFailureCauseAuthorityV3Constraint,
} from "../../src/db/operational-failure-cause-authority-v3-migration.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import {
  DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
} from "../../src/product-compiler/design-source-runtime-v2.js";

async function rollbackCurrentToV21(database: TestDatabase): Promise<void> {
  await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
    targetReleaseSha: "6".repeat(40),
  });
  await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
    targetReleaseSha: "7".repeat(40),
  });
  await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
    targetReleaseSha: "8".repeat(40),
  });
  await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
    targetReleaseSha: "9".repeat(40),
  });
  await rollbackPlatformReleaseStoreRecordLedgerV3ToV26(database.sql, {
    targetReleaseSha: "a".repeat(40),
  });
  await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
    targetReleaseSha: "b".repeat(40),
  });
  await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
    targetReleaseSha: "c".repeat(40),
  });
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

const V3_ONLY_CODES = Object.freeze([
  "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED",
  "SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED",
  "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
] as const);

function v3Cause(failureCode: string): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "setup-build",
    boundary: "product_compiler.setup_build_packet",
    failureClass: "contract_invalid",
    failureCode,
  });
}

describe("operational failure cause migration", () => {
  it("upgrades exact v30 to v31, rejects one-field drift, and reapplies idempotently", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const insert = async (
        suffix: string,
        requestedBy: string,
        cause: Readonly<Record<string, unknown>>,
      ): Promise<void> => {
        const runId = `run-v3-cause-${suffix}`;
        await database.insertRun(runId);
        await database.sql.unsafe(
          `INSERT INTO run_termination_requests (
             request_id, run_id, target_status, state, requested_by,
             requested_at, diagnostic, evidence
           ) VALUES ($1, $2, 'failed', 'requested', $3, NOW(),
                     'authority v3 fixture',
                     jsonb_build_object('operationalFailureCause', $4::text::jsonb))`,
          [`RTR_v3-cause-${suffix}`, runId, requestedBy, JSON.stringify(cause)],
        );
      };

      await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
        targetReleaseSha: "1".repeat(40),
      });
      assert.equal(await detectOperationalFailureCauseAuthorityV3Constraint(database.sql), "absent");
      for (const failureCode of V3_ONLY_CODES) {
        await assert.rejects(
          insert(`v30-${failureCode.toLowerCase()}`, "setfarm.step-fail.single", v3Cause(failureCode)),
          new RegExp(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT),
        );
      }

      const upgraded = await applyContractSpineMigrations(database.sql, {
        releaseSha: "2".repeat(40),
      });
      assert.deepEqual(upgraded.applied, ["031_operational_failure_cause_authority_v3"]);
      assert.equal(await detectOperationalFailureCauseAuthorityV3Constraint(database.sql), "present");
      await verifyOperationalFailureCauseAuthorityV3Constraint(database.sql);
      const currentHead = await database.sql<Array<{ version: number }>>`
        SELECT version FROM setfarm_schema_migrations
         WHERE version >= 26 ORDER BY version
      `;
      assert.deepEqual(currentHead.map((row) => row.version), [26, 27, 28, 29, 30, 31]);

      for (const [index, failureCode] of V3_ONLY_CODES.entries()) {
        await insert(`exact-${index}`, "setfarm.step-fail.single", v3Cause(failureCode));
      }
      for (const [suffix, requestedBy, cause] of [
        ["requester", "setfarm.step-fail.story", v3Cause(V3_ONLY_CODES[0])],
        ["step", "setfarm.step-fail.single", { ...v3Cause(V3_ONLY_CODES[0]), workflowStepId: "design" }],
        ["boundary", "setfarm.step-fail.single", { ...v3Cause(V3_ONLY_CODES[0]), boundary: "product_compiler.setup_build_packet_other" }],
        ["class", "setfarm.step-fail.single", { ...v3Cause(V3_ONLY_CODES[0]), failureClass: "generated_artifact_invalid" }],
        ["code", "setfarm.step-fail.single", { ...v3Cause(V3_ONLY_CODES[0]), failureCode: `${V3_ONLY_CODES[0]}_OTHER` }],
      ] as const) {
        await assert.rejects(
          insert(suffix, requestedBy, cause),
          new RegExp(OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT),
        );
      }

      const repeated = await applyContractSpineMigrations(database.sql, {
        releaseSha: "3".repeat(40),
      });
      assert.deepEqual(repeated.applied, []);
      assert.equal(repeated.alreadyApplied.at(-1), "031_operational_failure_cause_authority_v3");
    } finally {
      await database.cleanup();
    }
  });

  it("independently preserves v31 and evidence when each v3-only code refuses rollback", async () => {
    for (const [index, failureCode] of V3_ONLY_CODES.entries()) {
      const database = await createIsolatedTestDatabase();
      try {
        const runId = `run-v3-rollback-refusal-${index}`;
        const requestId = `RTR_v3-rollback-refusal-${index}`;
        await database.insertRun(runId);
        await database.sql.unsafe(
          `INSERT INTO run_termination_requests (
             request_id, run_id, target_status, state, requested_by,
             requested_at, diagnostic, evidence
           ) VALUES ($1, $2, 'failed', 'requested', 'setfarm.step-fail.single',
                     NOW(), 'authority v3 rollback-refusal fixture',
                     jsonb_build_object('operationalFailureCause', $3::text::jsonb))`,
          [requestId, runId, JSON.stringify(v3Cause(failureCode))],
        );
        const evidenceBefore = await database.sql<Array<{
          request_id: string;
          state: string;
          requested_by: string;
          evidence: Record<string, unknown>;
        }>>`
          SELECT request_id, state, requested_by, evidence
            FROM run_termination_requests
           WHERE run_id = ${runId}
           ORDER BY request_id
        `;
        const journalBefore = await database.sql<Array<{
          version: number;
          name: string;
          checksum: string;
          state: string;
          release_sha: string | null;
        }>>`
          SELECT version, name, checksum, state, release_sha
            FROM setfarm_schema_migrations
           WHERE version = 31
        `;
        assert.equal(evidenceBefore.length, 1);
        assert.deepEqual(evidenceBefore[0]?.evidence.operationalFailureCause,
          v3Cause(failureCode));
        assert.equal(journalBefore.length, 1);
        assert.equal(journalBefore[0]?.name, "031_operational_failure_cause_authority_v3");
        assert.equal(journalBefore[0]?.state, "applied");

        await assert.rejects(
          rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
            targetReleaseSha: `${index + 6}`.repeat(40),
          }),
          (error: unknown) => error instanceof ContractSpineMigrationError
            && error.code === "MIGRATION_INCOMPLETE",
        );

        const evidenceAfter = await database.sql<typeof evidenceBefore>`
          SELECT request_id, state, requested_by, evidence
            FROM run_termination_requests
           WHERE run_id = ${runId}
           ORDER BY request_id
        `;
        const journalAfter = await database.sql<typeof journalBefore>`
          SELECT version, name, checksum, state, release_sha
            FROM setfarm_schema_migrations
           WHERE version = 31
        `;
        assert.deepEqual(evidenceAfter, evidenceBefore);
        assert.deepEqual(journalAfter, journalBefore);
        assert.equal(await detectOperationalFailureCauseAuthorityV3Constraint(database.sql), "present");
      } finally {
        await database.cleanup();
      }
    }
  });

  it("detects v31 constraint drift as partial and rolls back safely without evidence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const rows = await database.sql<Array<{ expression: string }>>`
        SELECT pg_get_expr(conbin, conrelid, true) AS expression
          FROM pg_constraint
         WHERE conrelid = 'run_termination_requests'::regclass
           AND conname = ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}
      `;
      const expression = rows[0]?.expression;
      assert.ok(expression);
      const drifted = expression.replace(
        "'SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED'::text",
        "'SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED_OTHER'::text",
      );
      assert.notEqual(drifted, expression);
      await database.sql.unsafe(
        `ALTER TABLE run_termination_requests DROP CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}`,
      );
      await database.sql.unsafe(
        `ALTER TABLE run_termination_requests
           ADD CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}
           CHECK (${drifted}) NOT VALID`,
      );
      await database.sql.unsafe(
        `ALTER TABLE run_termination_requests
           VALIDATE CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}`,
      );
      assert.equal(await detectOperationalFailureCauseAuthorityV3Constraint(database.sql), "partial");
      for (const statement of OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS) {
        await database.sql.unsafe(statement);
      }
      const rollback = await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
        targetReleaseSha: "5".repeat(40),
      });
      assert.deepEqual(
        { fromVersion: rollback.fromVersion, targetVersion: rollback.targetVersion, rowsRewritten: rollback.rowsRewritten },
        { fromVersion: 31, targetVersion: 30, rowsRewritten: 0 },
      );
      assert.equal(await detectOperationalFailureCauseAuthorityV3Constraint(database.sql), "absent");
      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.migrations.find((entry) => entry.version === 30)?.state, "applied");
      assert.equal(plan.migrations.find((entry) => entry.version === 31)?.state, "pending");
    } finally {
      await database.cleanup();
    }
  });

  it("admits only the exact DESIGN tuple and preserves it against rollback", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const insert = async (input: Readonly<{
        suffix: string;
        requestedBy: string;
        cause: Readonly<Record<string, unknown>>;
      }>): Promise<void> => {
        const runId = `run-design-cause-${input.suffix}`;
        await database.insertRun(runId);
        await database.sql.unsafe(
          `INSERT INTO run_termination_requests (
             request_id, run_id, target_status, state, requested_by,
             requested_at, diagnostic, evidence
           ) VALUES ($1, $2, 'failed', 'requested', $3,
                     NOW(), 'DESIGN semantic closure fixture',
                     jsonb_build_object('operationalFailureCause', $4::text::jsonb))`,
          [
            `RTR_design-cause-${input.suffix}`,
            runId,
            input.requestedBy,
            JSON.stringify(input.cause),
          ],
        );
      };

      await insert({
        suffix: "exact",
        requestedBy: "setfarm.step-fail.single",
        cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
      });
      for (const input of [
        {
          suffix: "requester",
          requestedBy: "setfarm.step-fail.story",
          cause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
        },
        {
          suffix: "step",
          requestedBy: "setfarm.step-fail.single",
          cause: {
            ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
            workflowStepId: "setup-build",
          },
        },
        {
          suffix: "boundary",
          requestedBy: "setfarm.step-fail.single",
          cause: {
            ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
            boundary: "product_compiler.design_source.semantic_closure_other",
          },
        },
        {
          suffix: "class",
          requestedBy: "setfarm.step-fail.single",
          cause: {
            ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
            failureClass: "generated_artifact_invalid",
          },
        },
        {
          suffix: "code",
          requestedBy: "setfarm.step-fail.single",
          cause: {
            ...DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
            failureCode: "DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED_OTHER",
          },
        },
      ]) {
        await assert.rejects(
          insert(input),
          /run_termination_requests_operational_failure_cause_check/,
        );
      }

      await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
        targetReleaseSha: "0".repeat(40),
      });
      await assert.rejects(
        rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
          targetReleaseSha: "1".repeat(40),
        }),
        (error: unknown) =>
          error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_INCOMPLETE",
      );
      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.migrations.find((entry) => entry.version === 30)?.state, "applied");
      assert.equal(plan.migrations.find((entry) => entry.version === 31)?.state, "pending");
    } finally {
      await database.cleanup();
    }
  });

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
        "025_v3_preparation_authority_v2_ledger",
        "026_artifact_publication_batch_plan_ledger",
        "027_platform_release_store_record_ledger_v3",
        "028_runtime_completion_manifest_authority",
        "029_v3_story_claim_runtime_binding_v1",
        "030_operational_failure_cause_authority_v2",
        "031_operational_failure_cause_authority_v3",
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
