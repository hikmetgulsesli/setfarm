import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  contractSpineMigrationLockKey,
  readContractSpineMigrationAttestation,
  planContractSpineMigrations,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { validateRuntimeCompletionEffectInput } from "../../src/execution/runtime-completion-effect-runner.js";
import { RuntimeCompletionPlanV1Schema } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

async function restoreExactV7Shape(database: TestDatabase): Promise<void> {
  await database.sql`DELETE FROM setfarm_schema_migrations WHERE version IN (8, 12)`;
  await database.sql`DROP TABLE operational_event_deliveries`;
  await database.sql`DROP TABLE operational_events`;
  await database.sql`DROP FUNCTION setfarm_forbid_operational_event_mutation()`;
  await database.sql`DROP TABLE operational_outbox`;
  await database.sql`DROP TABLE runtime_completion_effects`;
  await database.sql.unsafe(`
    ALTER TABLE runtime_completion_requests
      DROP CONSTRAINT runtime_completion_requests_owner_plan_check,
      DROP CONSTRAINT runtime_completion_requests_plan_hash_check,
      DROP CONSTRAINT runtime_completion_requests_plan_object_check,
      DROP CONSTRAINT runtime_completion_requests_plan_pair_check,
      DROP CONSTRAINT runtime_completion_requests_owner_attempt_count_check,
      DROP COLUMN completion_plan,
      DROP COLUMN completion_plan_hash,
      DROP COLUMN prepared_at,
      DROP COLUMN owner_attempt_count
  `);
  await database.sql.unsafe(`
    ALTER TABLE runtime_sessions
      DROP CONSTRAINT runtime_sessions_process_identity_binding_check,
      DROP CONSTRAINT runtime_sessions_process_identity_object_check,
      DROP CONSTRAINT runtime_sessions_process_group_check,
      DROP COLUMN process_identity,
      DROP COLUMN process_group_id
  `);
}

async function seedLegacyV7Completion(
  database: TestDatabase,
  input: Readonly<{
    suffix: string;
    applyPhase: "owner_committed" | "effects_committed";
    pid?: number;
    processStartedAt?: Date;
    runtimeState?: "running" | "drained";
  }>,
): Promise<Readonly<{ requestId: string; runtimeSessionId: string }>> {
  const runId = `migration-v7-${input.suffix}`;
  const stepDbId = `${runId}-step`;
  const attemptId = `ATT_${input.suffix}-legacy-v7`;
  const runtimeSessionId = `RTS_${input.suffix}-legacy-v7`;
  const requestId = `RCR_${input.suffix}-legacy-v7-owner`;
  await database.sql`
    INSERT INTO runs (id, workflow_id, task, status)
    VALUES (${runId}, 'feature-dev', 'v7 completion migration fixture', 'running')
  `;
  const claims = await database.sql<Array<{ id: string }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${runId}, 'implement', NULL, 'feature-dev_developer')
    RETURNING id::text AS id
  `;
  const claimId = claims[0]!.id;
  await database.sql`
    INSERT INTO execution_attempts (
      attempt_id, run_id, step_id, story_id, generation, fence_token,
      attempt_class, compilation_report_hash, source_before_sha,
      source_before_tree_hash, role, agent_id, lease_acquired_at,
      lease_expires_at, heartbeat_at, disposition, evidence_refs, claim_id
    ) VALUES (
      ${attemptId}, ${runId}, 'implement', '', 1, ${"f".repeat(64)},
      'infrastructure_retry', ${"c".repeat(64)}, ${"a".repeat(40)},
      ${"b".repeat(64)}, 'developer', 'feature-dev_developer', NOW(),
      NOW() + INTERVAL '5 minutes', NOW(), 'running', '[]', ${claimId}::bigint
    )
  `;
  const runtimeState = input.runtimeState ?? "drained";
  await database.sql`
    INSERT INTO runtime_sessions (
      session_id, run_id, step_db_id, workflow_step_id, claim_id, attempt_id,
      claim_agent_id, runtime_agent_id, runtime_kind, pid, process_started_at,
      state, owner_instance_id, heartbeat_at, drained_at, drain_evidence
    ) VALUES (
      ${runtimeSessionId}, ${runId}, ${stepDbId}, 'implement', ${claimId}::bigint, ${attemptId},
      'feature-dev_developer', 'prism', 'local_process', ${input.pid ?? null},
      ${input.processStartedAt ?? null}, ${runtimeState}, 'legacy-spawner', NOW(),
      ${runtimeState === "drained" ? new Date("2026-07-13T12:01:00.000Z") : null},
      ${runtimeState === "drained" ? { source: "legacy-drain" } : {}}::jsonb
    )
  `;
  const output = `STATUS: done\nFIXTURE: ${input.suffix}`;
  const outputHash = hashCanonicalJson(output);
  await database.sql`
    INSERT INTO runtime_completion_requests (
      request_id, runtime_session_id, claim_id, run_id, step_db_id,
      workflow_step_id, attempt_id, claim_envelope, output, output_hash,
      apply_phase, claim_outcome, claim_committed_at, effects_committed_at,
      state, requested_by, requested_at, drained_at, processing_at, result
    ) VALUES (
      ${requestId}, ${runtimeSessionId}, ${claimId}::bigint, ${runId}, ${stepDbId},
      'implement', ${attemptId}, ${{ schema: "legacy-v7-claim-envelope" }}::jsonb,
      ${output}, ${outputHash}, ${input.applyPhase}, 'completed',
      '2026-07-13T12:02:00.000Z'::timestamptz,
      ${input.applyPhase === "effects_committed" ? new Date("2026-07-13T12:03:00.000Z") : null},
      'processing', 'legacy-spawner', '2026-07-13T12:00:00.000Z'::timestamptz,
      '2026-07-13T12:01:00.000Z'::timestamptz,
      '2026-07-13T12:01:30.000Z'::timestamptz,
      ${{ advanced: false, runCompleted: false }}::jsonb
    )
  `;
  return { requestId, runtimeSessionId };
}

describe("contract spine migration journal", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
  });

  it("rejects a live or non-isolated URL before a test connection can open", async () => {
    const guardedDb = await import(`../../src/db-pg.ts?url-guard=${Date.now()}`);
    assert.throws(
      () => guardedDb.pgConfigureIsolatedTestDatabase(
        "postgresql://postgres@localhost:5432/setfarm",
      ),
      /ISOLATED_TEST_DATABASE_URL_REJECTED/,
    );
    assert.throws(
      () => guardedDb.pgConfigureIsolatedTestDatabase(
        "postgresql://postgres@example.com:5432/setfarm_contract_spine_test_1_aaaaaaaaaaaa",
      ),
      /ISOLATED_TEST_DATABASE_URL_REJECTED/,
    );
  });

  it("plans an empty database without mutating it", async () => {
    const before = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    const plan = await planContractSpineMigrations(database.sql);
    const after = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    assert.deepEqual(after, before);
    assert.equal(plan.schema, "setfarm.contract-spine-migration-plan.v1");
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations.length >= 1, true);
    assert.equal(plan.migrations[0]?.state, "pending");
  });

  it("makes ordinary runtime startup verify-only and fail before base DDL", async () => {
    await assert.rejects(
      database.db.pgMigrate(),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
    const tablesAfterVerify = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    assert.equal(tablesAfterVerify.length, 0);

    await database.db.pgMigrate({ contractSpineMode: "apply" });
    const tablesAfterApply = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    assert.ok(tablesAfterApply.some((table) => table.name === "execution_attempts"));
    assert.ok(tablesAfterApply.some((table) => table.name === "setfarm_schema_migrations"));
  });

  it("applies, journals, verifies, and reapplies idempotently", async () => {
    const releaseSha = "c".repeat(40);
    const first = await applyContractSpineMigrations(database.sql, { releaseSha });
    assert.equal(first.applied.length >= 1, true);
    assert.deepEqual(first.adopted, []);

    const verified = await verifyContractSpineMigrations(database.sql);
    assert.equal(verified.status, "verified");
    assert.equal(verified.migrations.every((item) => item.state === "applied"), true);
    const journal = await database.sql<{
      release_sha: string | null;
      verified_release_sha: string | null;
    }[]>`
      SELECT release_sha, verified_release_sha
      FROM setfarm_schema_migrations
      ORDER BY version
    `;
    assert.equal(journal.every((row) => row.release_sha === releaseSha), true);
    assert.equal(journal.every((row) => row.verified_release_sha === releaseSha), true);

    const nextReleaseSha = "d".repeat(40);
    const second = await applyContractSpineMigrations(database.sql, {
      releaseSha: nextReleaseSha,
    });
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.adopted, []);
    assert.equal(second.alreadyApplied.length, verified.migrations.length);
    const attestation = await readContractSpineMigrationAttestation(database.sql);
    assert.deepEqual(attestation, {
      status: "attested",
      versions: verified.migrations.map((item) => item.version),
      verifiedReleaseSha: nextReleaseSha,
    });
    const originalReleases = await database.sql<{ release_sha: string | null }[]>`
      SELECT release_sha FROM setfarm_schema_migrations ORDER BY version
    `;
    assert.equal(originalReleases.every((row) => row.release_sha === releaseSha), true);
  });

  it("adopts an exact existing attempt table only after catalog verification", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`DROP TABLE setfarm_schema_migrations`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations[0]?.state, "adoptable");
    const adopted = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(adopted.applied, ["003_migration_release_attestation"]);
    assert.deepEqual(adopted.adopted, [
      "001_execution_attempts",
      "002_run_protocol_identity",
      "004_compiler_preflight_identity",
      "005_claim_attempt_relational_binding",
      "006_durable_runtime_ownership",
      "007_manager_owned_completion",
      "008_runtime_completion_effect_ledger",
      "009_product_artifact_index",
      "010_finding_recovery_evidence_ledger",
      "011_revisioned_recovery_delivery_ledger",
      "012_canonical_operational_event_projection",
      "013_accepted_candidate_ledger",
      "014_v3_deploy_receipt_ledger",
      "015_v3_release_admission_ledger",
      "016_v3_preparation_block_ledger",
      "017_v3_github_review_resolution_evidence",
      "018_v3_project_transfer_ack_ledger",
    ]);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("upgrades agent-scoped claim indexes and backfills the exact relational claim owner", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version IN (5, 6, 7, 8, 12, 14, 18)`;
    await database.sql`DROP TRIGGER trg_runs_project_transfer_ack_set_once ON runs`;
    await database.sql`DROP FUNCTION setfarm_enforce_project_transfer_ack_pointer_set_once()`;
    await database.sql`ALTER TABLE runs DROP CONSTRAINT runs_project_transfer_ack_identity_fkey`;
    await database.sql`DROP TABLE v3_project_transfer_acks`;
    await database.sql`ALTER TABLE runs DROP COLUMN project_transfer_ack_hash`;
    await database.sql`ALTER TABLE v3_deploy_receipts DROP CONSTRAINT v3_deploy_receipts_transfer_binding_unique`;
    await database.sql`DROP TRIGGER trg_runs_deploy_receipt_set_once ON runs`;
    await database.sql`DROP FUNCTION setfarm_enforce_deploy_receipt_pointer_set_once()`;
    await database.sql`ALTER TABLE runs DROP CONSTRAINT runs_deploy_receipt_identity_fkey`;
    await database.sql`DROP TABLE v3_deploy_receipts`;
    await database.sql`ALTER TABLE runs DROP COLUMN deploy_receipt_hash`;
    await database.sql`
      ALTER TABLE accepted_candidates
      DROP CONSTRAINT accepted_candidates_deploy_binding_unique
    `;
    await database.sql`
      ALTER TABLE claim_log
      DROP CONSTRAINT claim_log_id_run_workflow_unique
    `;
    await database.sql`DROP TABLE operational_event_deliveries`;
    await database.sql`DROP TABLE operational_events`;
    await database.sql`DROP FUNCTION setfarm_forbid_operational_event_mutation()`;
    await database.sql`DROP TABLE operational_outbox`;
    await database.sql`DROP TABLE runtime_completion_effects`;
    await database.sql`DROP TABLE runtime_completion_requests`;
    await database.sql`DROP INDEX idx_runtime_sessions_session_claim_run_unique`;
    await database.sql`DROP TABLE runtime_sessions`;
    await database.sql`DROP TABLE run_termination_requests`;
    await database.sql`DROP INDEX idx_execution_attempts_attempt_claim_unique`;
    await database.sql`DROP INDEX idx_claim_log_id_run_unique`;
    await database.sql`DROP INDEX idx_execution_attempts_claim_id_unique`;
    await database.sql`
      ALTER TABLE execution_attempts
      DROP CONSTRAINT execution_attempts_claim_id_fkey
    `;
    await database.sql`ALTER TABLE execution_attempts DROP COLUMN claim_id`;
    await database.sql`DROP INDEX idx_claim_log_open_single_unique`;
    await database.sql`DROP INDEX idx_claim_log_open_story_unique`;
    await database.sql`
      CREATE UNIQUE INDEX idx_claim_log_open_single_unique
      ON claim_log(run_id, step_id, agent_id)
      WHERE outcome IS NULL AND story_id IS NULL
    `;
    await database.sql`
      CREATE UNIQUE INDEX idx_claim_log_open_story_unique
      ON claim_log(run_id, step_id, story_id, agent_id)
      WHERE outcome IS NULL AND story_id IS NOT NULL
    `;

    const claims = await database.sql<Array<{ id: string }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('legacy-index-run', 'implement', 'US-001', 'feature-dev_developer')
      RETURNING id::text AS id
    `;
    const claimId = claims[0]!.id;
    await database.sql`
      INSERT INTO execution_attempts (
        attempt_id, run_id, step_id, story_id, generation, fence_token,
        attempt_class, compilation_report_hash, source_before_sha,
        source_before_tree_hash, role, agent_id, lease_acquired_at,
        lease_expires_at, heartbeat_at, disposition, evidence_refs
      ) VALUES (
        'ATT_old_index_upgrade', 'legacy-index-run', 'implement', 'US-001', 1,
        ${"f".repeat(64)}, 'infrastructure_retry', ${"c".repeat(64)},
        ${"a".repeat(40)}, ${"b".repeat(64)}, 'developer',
        'feature-dev_developer', NOW(), NOW() + INTERVAL '5 minutes', NOW(),
        'claimed', ${JSON.stringify([`setfarm://claim-log/${claimId}`])}
      )
    `;

    const result = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(result.applied, [
      "005_claim_attempt_relational_binding",
      "006_durable_runtime_ownership",
      "007_manager_owned_completion",
      "008_runtime_completion_effect_ledger",
      "012_canonical_operational_event_projection",
      "014_v3_deploy_receipt_ledger",
      "018_v3_project_transfer_ack_ledger",
    ]);
    const rows = await database.sql<Array<{
      claim_id: string | null;
      claim_outcome: string | null;
      disposition: string;
    }>>`
      SELECT ea.claim_id::text AS claim_id,
             cl.outcome AS claim_outcome,
             ea.disposition
        FROM execution_attempts ea
        JOIN claim_log cl ON cl.id = ea.claim_id
       WHERE ea.attempt_id = 'ATT_old_index_upgrade'
    `;
    assert.deepEqual({ ...rows[0] }, {
      claim_id: claimId,
      claim_outcome: null,
      disposition: "claimed",
    });
    const indexes = await database.sql<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'idx_claim_log_open_single_unique',
           'idx_claim_log_open_story_unique'
         )
       ORDER BY indexname
    `;
    assert.equal(indexes.length, 2);
    assert.equal(indexes.every((index) => !index.indexdef.includes("agent_id")), true);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("upgrades only settled v7 effects as non-replayable canonical receipts", async () => {
    await applyContractSpineMigrations(database.sql);
    await restoreExactV7Shape(database);
    const terminalIdentityUnknown = await seedLegacyV7Completion(database, {
      suffix: "effects-terminal-id-01",
      applyPhase: "effects_committed",
      pid: 4321,
    });
    const effectsCommitted = await seedLegacyV7Completion(database, {
      suffix: "effects-committed-01",
      applyPhase: "effects_committed",
      pid: 4322,
      processStartedAt: new Date("2026-07-13T11:59:00.000Z"),
    });

    const applied = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(applied.applied, [
      "008_runtime_completion_effect_ledger",
      "012_canonical_operational_event_projection",
    ]);
    const rows = await database.sql<Array<{
      request_id: string;
      completion_plan: unknown;
      completion_plan_hash: string;
      process_pid: number | null;
      process_identity: unknown;
      runtime_diagnostic: string | null;
    }>>`
      SELECT rcr.request_id, rcr.completion_plan, rcr.completion_plan_hash,
             rs.pid AS process_pid, rs.process_identity,
             rs.diagnostic AS runtime_diagnostic
        FROM runtime_completion_requests rcr
        JOIN runtime_sessions rs ON rs.session_id = rcr.runtime_session_id
       WHERE rcr.request_id IN (${terminalIdentityUnknown.requestId}, ${effectsCommitted.requestId})
       ORDER BY rcr.request_id
    `;
    assert.equal(rows.length, 2);
    for (const row of rows) {
      const plan = RuntimeCompletionPlanV1Schema.parse(row.completion_plan);
      assert.equal(hashCanonicalJson(plan), row.completion_plan_hash);
      assert.equal(plan.requestId, row.request_id);
      assert.equal(plan.kind, "legacy_recovery");
      assert.equal(plan.continuation.type, "legacy_receipt_only");
      assert.equal(plan.effects[0]?.effectType, "legacy.receipt");
    }
    const terminalRuntime = rows.find((row) => row.request_id === terminalIdentityUnknown.requestId)!;
    assert.equal(terminalRuntime.process_pid, null);
    assert.deepEqual(terminalRuntime.process_identity, {});
    assert.match(terminalRuntime.runtime_diagnostic ?? "", /UNVERIFIABLE_TERMINAL_PROCESS_IDENTITY\(pid=4321\)/);
    const committedRuntime = rows.find((row) => row.request_id === effectsCommitted.requestId)!;
    assert.equal(committedRuntime.process_pid, 4322);
    assert.equal(
      (committedRuntime.process_identity as Record<string, unknown>).schema,
      "setfarm.process-identity.v1",
    );

    const effects = createRuntimeCompletionEffectRepository(database.sql);
    const terminalEffects = await effects.listForRequest(terminalIdentityUnknown.requestId);
    const appliedEffects = await effects.listForRequest(effectsCommitted.requestId);
    assert.equal(terminalEffects.length, 1);
    assert.equal(terminalEffects[0]?.state, "applied");
    assert.equal(appliedEffects.length, 1);
    assert.equal(appliedEffects[0]?.state, "applied");
    validateRuntimeCompletionEffectInput(terminalEffects[0]!);
    validateRuntimeCompletionEffectInput(appliedEffects[0]!);

    const repeated = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(repeated.applied, []);
    assert.equal((await effects.listForRequest(terminalIdentityUnknown.requestId)).length, 1);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("fails v8 atomically when a legacy owner commit has no exact continuation receipt", async () => {
    await applyContractSpineMigrations(database.sql);
    await restoreExactV7Shape(database);
    const ownerCommitted = await seedLegacyV7Completion(database, {
      suffix: "owner-ambiguous-0001",
      applyPhase: "owner_committed",
    });

    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH"
        && error.message.includes(ownerCommitted.requestId)
        && /cannot prove legacy owner-committed continuation/.test(error.message),
    );
    const columns = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'runtime_completion_requests'
         AND column_name = 'completion_plan'
    `;
    assert.equal(columns[0]?.count, 0, "ambiguous legacy continuation must roll back every v8 DDL statement");
  });

  it("fails v8 closed instead of fabricating an active legacy process identity", async () => {
    await applyContractSpineMigrations(database.sql);
    await restoreExactV7Shape(database);
    await seedLegacyV7Completion(database, {
      suffix: "active-pid-unknown-01",
      applyPhase: "owner_committed",
      pid: 9876,
      runtimeState: "running",
    });

    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH"
        && /cannot prove active legacy process identity/.test(error.message),
    );
    const columns = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'runtime_sessions'
         AND column_name = 'process_identity'
    `;
    assert.equal(columns[0]?.count, 0, "the failed migration must roll back every v8 DDL statement");
  });

  it("backfills existing runs as immutable legacy protocol version one", async () => {
    await database.sql`CREATE SEQUENCE runs_run_number_seq`;
    await database.sql.unsafe(`
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        run_number INTEGER NOT NULL DEFAULT nextval('runs_run_number_seq'::regclass),
        workflow_id TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        context TEXT NOT NULL DEFAULT '{}',
        meta TEXT,
        notify_url TEXT,
        assigned_developer TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await database.sql`
      INSERT INTO runs (id, workflow_id, task)
      VALUES ('legacy-before-protocol', 'feature-dev', 'old run')
    `;

    await applyContractSpineMigrations(database.sql);
    const rows = await database.sql<{
      protocol: string;
      protocol_version: number;
      compiler_release_sha: string | null;
    }[]>`
      SELECT protocol, protocol_version, compiler_release_sha
      FROM runs
      WHERE id = 'legacy-before-protocol'
    `;
    assert.deepEqual({ ...rows[0] }, {
      protocol: "legacy",
      protocol_version: 1,
      compiler_release_sha: null,
    });
    await assert.rejects(
      database.sql`UPDATE runs SET protocol = 'shadow' WHERE id = 'legacy-before-protocol'`,
      /RUN_PROTOCOL_IMMUTABLE/,
    );
  });

  it("rejects a partially installed run protocol identity", async () => {
    await database.sql`CREATE TABLE runs (id TEXT PRIMARY KEY, protocol TEXT NOT NULL DEFAULT 'legacy')`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((item) => item.version === 2)?.state, "adoption_mismatch");
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const journal = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'setfarm_schema_migrations'
    `;
    assert.equal(journal[0]?.count, 0);
  });

  it("does not replace a pre-existing protocol identity function", async () => {
    await database.sql.unsafe(`
      CREATE FUNCTION setfarm_enforce_run_protocol_identity() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN OLD;
      END;
      $$
    `);

    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof Error
        && "code" in error
        && error.code === "42723",
    );

    const definitions = await database.sql<{ definition: string }[]>`
      SELECT pg_get_functiondef('setfarm_enforce_run_protocol_identity()'::regprocedure) AS definition
    `;
    assert.match(definitions[0]?.definition ?? "", /RETURN OLD/);
    const journal = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'setfarm_schema_migrations'
    `;
    assert.equal(journal[0]?.count, 0);
  });

  it("rejects a checksum mismatch without repairing journal history", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`
      UPDATE setfarm_schema_migrations
      SET checksum = ${"0".repeat(64)}
      WHERE version = 1
    `;

    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_CHECKSUM_MISMATCH",
    );

    const row = await database.sql<{ checksum: string }[]>`
      SELECT checksum FROM setfarm_schema_migrations WHERE version = 1
    `;
    assert.equal(row[0]?.checksum, "0".repeat(64));
  });

  it("rejects an attestation constraint with the expected name but wrong semantics", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "c".repeat(40) });
    await database.sql.unsafe(
      "ALTER TABLE setfarm_schema_migrations DROP CONSTRAINT setfarm_schema_migrations_verified_pair_check",
    );
    await database.sql.unsafe(
      "ALTER TABLE setfarm_schema_migrations ADD CONSTRAINT setfarm_schema_migrations_verified_pair_check CHECK (TRUE)",
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a manager-completion terminal-time constraint with the expected name but wrong semantics", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      "ALTER TABLE runtime_completion_requests DROP CONSTRAINT runtime_completion_requests_terminal_time_check",
    );
    await database.sql.unsafe(
      "ALTER TABLE runtime_completion_requests ADD CONSTRAINT runtime_completion_requests_terminal_time_check CHECK (TRUE)",
    );

    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a manager-completion processing-time constraint with the expected name but wrong semantics", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      "ALTER TABLE runtime_completion_requests DROP CONSTRAINT runtime_completion_requests_processing_time_check",
    );
    await database.sql.unsafe(
      "ALTER TABLE runtime_completion_requests ADD CONSTRAINT runtime_completion_requests_processing_time_check CHECK (TRUE)",
    );

    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("plans, applies, verifies, and detects drift in the product artifact index migration", async () => {
    const pending = await planContractSpineMigrations(database.sql);
    assert.equal(pending.migrations.find((item) => item.version === 9)?.state, "pending");
    const applied = await applyContractSpineMigrations(database.sql);
    assert.ok(applied.applied.includes("009_product_artifact_index"));
    const verified = await verifyContractSpineMigrations(database.sql);
    assert.equal(verified.migrations.find((item) => item.version === 9)?.state, "applied");
    const relations = await database.sql<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN (
           'semantic_artifacts',
           'artifact_capacity',
           'artifact_publication_reservations',
           'product_packets',
           'run_artifact_refs'
         )
       ORDER BY tablename
    `;
    assert.equal(relations.length, 5);

    const second = await applyContractSpineMigrations(database.sql);
    assert.ok(second.alreadyApplied.includes("009_product_artifact_index"));
    await database.sql.unsafe(
      "ALTER TABLE artifact_capacity DROP CONSTRAINT artifact_capacity_values_check",
    );
    await database.sql.unsafe(
      "ALTER TABLE artifact_capacity ADD CONSTRAINT artifact_capacity_values_check CHECK (TRUE)",
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a journal version newer than the running source", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`
      INSERT INTO setfarm_schema_migrations
        (version, name, checksum, state, release_sha)
      VALUES
        (99, '099_future_migration', ${"f".repeat(64)}, 'applied', 'future-release')
    `;

    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.at(-1)?.state, "unexpected");
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_UNKNOWN_VERSION",
    );
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_UNKNOWN_VERSION",
    );
  });

  it("fails closed when a pre-existing table has the wrong shape", async () => {
    await database.sql`CREATE TABLE execution_attempts (attempt_id TEXT PRIMARY KEY)`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations[0]?.state, "adoption_mismatch");
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );

    const journal = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'setfarm_schema_migrations'
    `;
    assert.equal(journal[0]?.count, 0);
  });
  it("serializes concurrent apply and journals one migration", async () => {
    const migrationCount = (await planContractSpineMigrations(database.sql)).migrations.length;
    const results = await Promise.all([
      applyContractSpineMigrations(database.sql),
      applyContractSpineMigrations(database.sql),
    ]);
    assert.equal(results.flatMap((result) => result.applied).length, migrationCount);
    assert.equal(results.flatMap((result) => result.alreadyApplied).length, migrationCount);

    const rows = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations
    `;
    assert.equal(rows[0]?.count, migrationCount);
  });

  it("bounds advisory-lock waiting", async () => {
    const blocker = database.sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(${contractSpineMigrationLockKey})`;
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    await assert.rejects(
      applyContractSpineMigrations(database.sql, { lockTimeoutMs: 50 }),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_LOCK_TIMEOUT",
    );
    await blocker;
  });
});
