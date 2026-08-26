import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  contractSpineMigrationLockKey,
  readContractSpineMigrationAttestation,
  planContractSpineMigrations,
  rollbackArtifactPublicationBatchPlanLedgerToV25,
  rollbackPlatformReleaseStoreRecordLedgerV3ToV26,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackV3StoryClaimRuntimeBindingToV28,
  rollbackOperationalFailureCauseAuthorityV2ToV29,
  rollbackOperationalFailureCauseAuthorityV3ToV30,
  rollbackPreparationAuthorityV2LedgerToV24,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { validateRuntimeCompletionEffectInput } from "../../src/execution/runtime-completion-effect-runner.js";
import { RuntimeCompletionPlanV1Schema } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const guardedMigrationId = "contract-spine-bootstrap-main-claim-handoff-v1";
const recoveryPublicationMigrationId = "033_v3_recovery_claim_runtime_publication_v1";

it("P4 guarded stage uses held savepoint without changing v32 digest", async () => {
  const [databaseSource, migrationSource, guardedSource, generatedDigests] = await Promise.all([
    readFile(path.join(repoRoot, "src/db-pg.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/db/bootstrap-main-claim-handoff-v1-migration.ts")),
    readFile(path.join(repoRoot, "src/db/contract-spine-migrations.ts")),
    readFile(path.join(repoRoot, "src/db/contract-spine-migration-digests.generated.ts")),
  ]);
  const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(
    [sha256(migrationSource), sha256(guardedSource), sha256(generatedDigests)],
    [
      "1f5b1f1c9d54051b674ad883c1b1e5998df6f3e5b5f77fe6d7f960337b6b4ff6",
      "a2ae3847427ea087c5a850a9263d89c810815c7e006b2c7e4ecababf6963fad6",
      "366a60b471443d89e386365fa58d35e36277baad654dab596e3a2335af01219d",
    ],
  );

  const start = databaseSource.indexOf("// SETFARM_P4_MIGRATION_32_TRANSACTION_V1:BEGIN");
  const end = databaseSource.indexOf("// SETFARM_P4_MIGRATION_32_TRANSACTION_V1:END");
  assert.ok(start >= 0 && end > start, "P4 transaction kernel is absent");
  const kernel = databaseSource.slice(start, end);
  assert.match(
    kernel,
    /const applyInternalProductionBaselineBootstrapHandoffMigrationV1\s*=\s*applyBootstrapMainClaimHandoffGuardedMigration32V1/,
  );
  assert.match(kernel, /property === ["']begin["'][\s\S]*transaction\.savepoint\(callback\)/);
  assert.doesNotMatch(kernel, /export[^\n]*(?:Sql|savepoint|callback|facade)/i);
});

async function snapshotMigration33RollbackBoundary(database: TestDatabase) {
  const rows = await database.sql<Array<{ legacy_metadata: string; migration_33_bytes: string }>>`
    SELECT
      COALESCE((
        SELECT jsonb_agg(to_jsonb(journal) ORDER BY journal.version)::text
          FROM setfarm_schema_migrations journal WHERE journal.version <= 32
      ), '[]') AS legacy_metadata,
      jsonb_build_object(
        'relation', to_regclass('public.internal_production_v3_recovery_claim_publications_v1')::text,
        'function', to_regprocedure('public.ip_v3_recovery_publication_immutable_v1()')::text,
        'journal', (
          SELECT to_jsonb(journal) FROM setfarm_schema_migrations journal WHERE journal.version=33
        )
      )::text AS migration_33_bytes
  `;
  return { ...rows[0]! };
}

async function typescriptFilesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? typescriptFilesUnder(entryPath)
      : entry.isFile() && /\.(?:[cm]?ts|tsx)$/u.test(entry.name)
        ? [entryPath]
        : [];
  }));
  return files.flat();
}

async function restoreExactV7Shape(database: TestDatabase): Promise<void> {
  await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
    targetReleaseSha: "1".repeat(40),
  });
  await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
    targetReleaseSha: "0".repeat(40),
  });
  await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
    targetReleaseSha: "7".repeat(40),
  });
  await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
    targetReleaseSha: "6".repeat(40),
  });
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

  it("registers exact automatic ordinals 1-31, sole guarded ordinal 32, and blocked 33", async () => {
    const module = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js")
      .catch(() => null);
    assert.ok(module, "the dedicated guarded migration module must exist");
    assert.equal(module.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ID, guardedMigrationId);
    assert.equal(module.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ORDINAL, 32);
    const statementAuthority = module.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_STATEMENTS.map(
      (statement: string) => {
        const normalized = statement.replace(/\s+/g, " ").trim();
        const match = normalized.match(
          /^(?:CREATE (TABLE|FUNCTION|TRIGGER|INDEX)|INSERT INTO|ALTER TABLE) (?:public\.)?([a-z0-9_]+)/i,
        );
        assert.ok(match, `unclassified guarded migration statement: ${normalized.slice(0, 80)}`);
        return `${(match[1] ?? normalized.split(" ").slice(0, 2).join("-")).toLowerCase()}:${match[2]}`;
      },
    );
    assert.deepEqual(statementAuthority, [
      "table:internal_production_bootstrap_main_claim_handoff_operations_v1",
      "table:internal_production_owner_reservations_v1",
      "table:internal_production_owner_admission_authorities_v1",
      "function:setfarm_forbid_internal_production_owner_admission_authority_mutation",
      "trigger:trg_internal_production_owner_admission_authority_immutable",
      "trigger:trg_internal_production_owner_admission_authority_truncate_forbidden",
      "table:internal_production_owner_admission_head_v1",
      "insert-into:internal_production_owner_admission_head_v1",
      "function:ip_op_reject_immutable_v1",
      "table:internal_production_owner_producer_source_build_authorities_v1",
      "index:ip_op_sba_v1_plan_manifest_idx",
      "table:internal_production_owner_producer_manifest_set_activations_v1",
      "index:ip_op_msa_v1_phase_manifest_idx",
      "index:ip_op_msa_v1_pred_activation_idx",
      "index:ip_op_msa_v1_pred_head_idx",
      "table:internal_production_owner_producer_manifest_activation_heads_v1",
      "index:ip_op_mah_v1_phase_activation_idx",
      "index:ip_op_mah_v1_pred_head_idx",
      "alter-table:internal_production_owner_producer_manifest_set_activations_v1",
      "table:internal_production_owner_producer_manifest_set_current_v1",
      "insert-into:internal_production_owner_producer_manifest_set_current_v1",
      "function:ip_op_enforce_current_update_v1",
      "trigger:ip_op_sba_v1_immutable_trg",
      "trigger:ip_op_msa_v1_immutable_trg",
      "trigger:ip_op_mah_v1_immutable_trg",
      "trigger:ip_op_msc_v1_delete_truncate_trg",
      "trigger:ip_op_msc_v1_update_trg",
    ]);
    assert.equal(
      Buffer.byteLength("internal_production_owner_producer_manifest_activation_heads_v1"),
      63,
    );
    assert.equal(
      module.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_STATEMENTS.some((statement: string) =>
        statement.includes("internal_production_owner_producer_manifest_set_activation_heads_v1")),
      false,
    );

    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.migrations.length, 33);
    assert.deepEqual(
      plan.migrations.slice(0, 31).map((migration) => migration.migrationClass),
      Array.from({ length: 31 }, () => "automatic"),
    );
    assert.deepEqual(plan.migrations[31], {
      version: 32,
      name: guardedMigrationId,
      migrationClass: "guarded",
      checksum: plan.migrations[31]?.checksum,
      state: "pending",
    });
  });

  it("registers ordinary migration 33 but blocks it behind guarded migration 32", async () => {
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.migrations.length, 33);
    assert.deepEqual(plan.migrations[32], {
      version: 33,
      name: recoveryPublicationMigrationId,
      migrationClass: "automatic",
      checksum: plan.migrations[32]?.checksum,
      state: "blocked_by_guarded_predecessor",
    });

    const applied = await applyContractSpineMigrations(database.sql, {
      releaseSha: "c".repeat(40),
    });
    assert.deepEqual(applied.guardedPending, [guardedMigrationId]);
    assert.equal([
      ...applied.applied,
      ...applied.adopted,
      ...applied.alreadyApplied,
    ].includes(recoveryPublicationMigrationId), false);
    const state = await database.sql<Array<{
      relation_name: string | null;
      journal_count: number;
    }>>`
      SELECT to_regclass(
               'public.internal_production_v3_recovery_claim_publications_v1'
             )::text AS relation_name,
             (SELECT COUNT(*)::integer
                FROM public.setfarm_schema_migrations
               WHERE version = 33) AS journal_count
    `;
    assert.deepEqual({ ...state[0] }, { relation_name: null, journal_count: 0 });
  });

  it("applies migration 33 after guarded 32 with one exact release metadata triple", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const releaseSha = "d".repeat(40);
    const applied = await applyContractSpineMigrations(database.sql, { releaseSha });
    assert.equal(applied.applied.at(-1), recoveryPublicationMigrationId);
    assert.deepEqual(applied.guardedPending, []);
    const rows = await database.sql<Array<{
      name: string;
      state: string;
      release_sha: string | null;
      verified_release_sha: string | null;
      verified_at: Date | null;
      relation_name: string | null;
    }>>`
      SELECT migration.name,
             migration.state,
             migration.release_sha,
             migration.verified_release_sha,
             migration.verified_at,
             to_regclass(
               'public.internal_production_v3_recovery_claim_publications_v1'
             )::text AS relation_name
        FROM public.setfarm_schema_migrations migration
       WHERE migration.version = 33
    `;
    assert.equal(rows.length, 1);
    assert.deepEqual({ ...rows[0], verified_at: rows[0]?.verified_at instanceof Date }, {
      name: recoveryPublicationMigrationId,
      state: "applied",
      release_sha: releaseSha,
      verified_release_sha: releaseSha,
      verified_at: true,
      relation_name: "internal_production_v3_recovery_claim_publications_v1",
    });
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("applies new migration 33 with the exact undefined metadata triple", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const applied = await applyContractSpineMigrations(database.sql);
    assert.equal(applied.applied.at(-1), recoveryPublicationMigrationId);
    const rows = await database.sql<Array<{
      state: string;
      release_sha: string | null;
      verified_release_sha: string | null;
      verified_at: Date | null;
    }>>`
      SELECT state,release_sha,verified_release_sha,verified_at
        FROM setfarm_schema_migrations WHERE version=33
    `;
    assert.deepEqual({ ...rows[0] }, {
      state: "applied",
      release_sha: null,
      verified_release_sha: null,
      verified_at: null,
    });
  });

  it("rolls migration 33 and legacy verification metadata back when its journal write fails", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const before = await database.sql<Array<{
      version: number;
      verified_release_sha: string | null;
      verified_at: Date | null;
    }>>`
      SELECT version, verified_release_sha, verified_at
        FROM public.setfarm_schema_migrations
       ORDER BY version
    `;
    await database.sql.unsafe(`
      CREATE FUNCTION reject_migration_33_ddl_v1() RETURNS event_trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF to_regclass('public.internal_production_v3_recovery_claim_publications_v1')
           IS NOT NULL THEN
          RAISE EXCEPTION 'reject migration 33 ddl';
        END IF;
      END
      $$
    `);
    await database.sql.unsafe(`
      CREATE EVENT TRIGGER reject_migration_33_ddl_v1
      ON ddl_command_start WHEN TAG IN ('CREATE TRIGGER')
      EXECUTE FUNCTION reject_migration_33_ddl_v1()
    `);
    try {
      await assert.rejects(
        applyContractSpineMigrations(database.sql, { releaseSha: "e".repeat(40) }),
        /reject migration 33 ddl/,
      );
    } finally {
      await database.sql.unsafe("DROP EVENT TRIGGER reject_migration_33_ddl_v1");
      await database.sql.unsafe("DROP FUNCTION reject_migration_33_ddl_v1()");
    }
    const after = await database.sql<typeof before>`
      SELECT version, verified_release_sha, verified_at
        FROM public.setfarm_schema_migrations
       ORDER BY version
    `;
    assert.deepEqual(after, before);
    const relation = await database.sql<Array<{ relation_name: string | null }>>`
      SELECT to_regclass(
               'public.internal_production_v3_recovery_claim_publications_v1'
             )::text AS relation_name
    `;
    assert.equal(relation[0]?.relation_name, null);
  });

  it("uses the savepoint facade and exposes no migration 33 result before outer commit acknowledgement", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    let savepointCalls = 0;
    let releaseCommit!: () => void;
    const commitGate = new Promise<void>((resolve) => { releaseCommit = resolve; });
    let callbackReady!: () => void;
    const callbackCompleted = new Promise<void>((resolve) => { callbackReady = resolve; });
    const instrumentedSql = new Proxy(database.sql as any, {
      get(target, property) {
        if (property === "begin") {
          return (callback: (sql: unknown) => Promise<unknown>) => database.sql.begin(async (raw) => {
            const instrumentedTransaction = new Proxy(raw as any, {
              get(transactionTarget, transactionProperty) {
                if (transactionProperty === "savepoint") {
                  return (...args: unknown[]) => {
                    savepointCalls += 1;
                    return (raw.savepoint as any).apply(raw, args);
                  };
                }
                const value = Reflect.get(transactionTarget, transactionProperty, transactionTarget);
                return typeof value === "function" ? value.bind(transactionTarget) : value;
              },
            });
            const result = await callback(instrumentedTransaction);
            callbackReady();
            await commitGate;
            return result;
          });
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    let settled = false;
    const applying = applyContractSpineMigrations(instrumentedSql, {
      releaseSha: "6".repeat(40),
    }).then((result) => {
      settled = true;
      return result;
    });
    await callbackCompleted;
    try {
      await Promise.resolve();
      assert.ok(savepointCalls > 0, "legacy core must use the outer transaction savepoint facade");
      assert.equal(settled, false, "public result must await outer commit acknowledgement");
      assert.equal(
        (await database.sql<Array<{ relation_name: string | null }>>`
          SELECT to_regclass('public.internal_production_v3_recovery_claim_publications_v1')::text AS relation_name
        `)[0]?.relation_name,
        null,
      );
    } finally {
      releaseCommit();
    }
    const result = await applying;
    assert.equal(result.applied.at(-1), recoveryPublicationMigrationId);
    assert.equal(
      (await database.sql<Array<{ relation_name: string | null }>>`
        SELECT to_regclass('public.internal_production_v3_recovery_claim_publications_v1')::text AS relation_name
      `)[0]?.relation_name,
      "internal_production_v3_recovery_claim_publications_v1",
    );
  });

  it("adopts the wholly committed migration 33 after outer commit acknowledgement loss", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const responseLossSql = new Proxy(database.sql as any, {
      get(target, property) {
        if (property === "begin") {
          return async (callback: (sql: unknown) => Promise<unknown>) => {
            await database.sql.begin((transaction) => callback(transaction));
            throw new Error("TEST_MIGRATION_COMMIT_ACK_LOST");
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const releaseSha = "b".repeat(40);
    await assert.rejects(
      applyContractSpineMigrations(responseLossSql, { releaseSha }),
      /TEST_MIGRATION_COMMIT_ACK_LOST/,
    );
    const committed = await database.sql<Array<{
      count: number;
      release_sha: string;
      verified_release_sha: string;
    }>>`
      SELECT COUNT(*)::integer AS count,MIN(release_sha) AS release_sha,
             MIN(verified_release_sha) AS verified_release_sha
        FROM setfarm_schema_migrations WHERE version=33
    `;
    assert.deepEqual({ ...committed[0] }, {
      count: 1,
      release_sha: releaseSha,
      verified_release_sha: releaseSha,
    });
    const replay = await applyContractSpineMigrations(database.sql, { releaseSha });
    assert.equal(replay.alreadyApplied.at(-1), recoveryPublicationMigrationId);
    assert.equal(
      (await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations WHERE version=33
      `)[0]?.count,
      1,
    );
  });

  it("rolls every migration 33 failure boundary back to byte-identical legacy metadata", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const before = await snapshotMigration33RollbackBoundary(database);

    const cases: ReadonlyArray<Readonly<{
      name: string;
      sql: any;
      expected: RegExp;
      callbackObserved: () => boolean;
    }>> = [];
    const mutableCases = cases as Array<{
      name: string;
      sql: any;
      expected: RegExp;
      callbackObserved: () => boolean;
    }>;

    let callbackReached = false;
    mutableCases.push({
      name: "outer callback failure",
      sql: new Proxy(database.sql as any, {
        get(target, property) {
          if (property === "begin") {
            return (callback: (sql: unknown) => Promise<unknown>) => database.sql.begin(async (transaction) => {
              await callback(transaction);
              callbackReached = true;
              throw new Error("TEST_MIGRATION_OUTER_CALLBACK_FAILURE");
            });
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
      expected: /TEST_MIGRATION_OUTER_CALLBACK_FAILURE/,
      callbackObserved: () => callbackReached,
    });

    let savepointReached = false;
    mutableCases.push({
      name: "private facade savepoint failure",
      sql: new Proxy(database.sql as any, {
        get(target, property) {
          if (property === "begin") {
            return (callback: (sql: unknown) => Promise<unknown>) => database.sql.begin((raw) => callback(new Proxy(raw as any, {
              get(transactionTarget, transactionProperty) {
                if (transactionProperty === "savepoint") {
                  return () => {
                    savepointReached = true;
                    throw new Error("TEST_MIGRATION_PRIVATE_SAVEPOINT_FAILURE");
                  };
                }
                const value = Reflect.get(transactionTarget, transactionProperty, transactionTarget);
                return typeof value === "function" ? value.bind(transactionTarget) : value;
              },
            })));
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
      expected: /TEST_MIGRATION_PRIVATE_SAVEPOINT_FAILURE/,
      callbackObserved: () => savepointReached,
    });

    let finalVerificationReached = false;
    mutableCases.push({
      name: "final verification failure",
      sql: new Proxy(database.sql as any, {
        get(target, property) {
          if (property === "begin") {
            return (callback: (sql: unknown) => Promise<unknown>) => database.sql.begin((raw) => {
              let journaled33 = false;
              const transaction = new Proxy(raw as any, {
                get(transactionTarget, transactionProperty) {
                  if (transactionProperty === "unsafe") {
                    return async (query: string, parameters?: unknown[]) => {
                      if (journaled33 && query.includes("internal_production_v3_recovery_claim_publications_v1")) {
                        finalVerificationReached = true;
                        throw new Error("TEST_MIGRATION_FINAL_VERIFICATION_FAILURE");
                      }
                      const result = await raw.unsafe(query, parameters as any);
                      if (query.includes("INSERT INTO public.setfarm_schema_migrations")
                        && parameters?.[0] === 33) journaled33 = true;
                      return result;
                    };
                  }
                  const value = Reflect.get(transactionTarget, transactionProperty, transactionTarget);
                  return typeof value === "function" ? value.bind(transactionTarget) : value;
                },
              });
              return callback(transaction);
            });
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
      expected: /TEST_MIGRATION_FINAL_VERIFICATION_FAILURE/,
      callbackObserved: () => finalVerificationReached,
    });

    for (const failure of cases) {
      let settled = false;
      let publicResultObserved = false;
      const applying = applyContractSpineMigrations(failure.sql, {
        releaseSha: "c".repeat(40),
      }).then((result) => {
        publicResultObserved = true;
        return result;
      }).finally(() => { settled = true; });
      await assert.rejects(applying, failure.expected, failure.name);
      assert.equal(settled, true);
      assert.equal(publicResultObserved, false, `${failure.name} exposed a pre-ACK result`);
      assert.equal(failure.callbackObserved(), true, `${failure.name} injection was not reached`);
      assert.deepEqual(
        await snapshotMigration33RollbackBoundary(database),
        before,
        `${failure.name} changed legacy metadata or migration 33 bytes`,
      );
    }

    await database.sql.unsafe(`
      CREATE SCHEMA test_migration_33_outer_commit_v1
    `);
    await database.sql.unsafe(`
      CREATE TABLE test_migration_33_outer_commit_v1.commit_signal (
        signal integer NOT NULL
      )
    `);
    await database.sql.unsafe(`
      CREATE FUNCTION test_migration_33_outer_commit_v1.reject_commit() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'TEST_MIGRATION_OUTER_COMMIT_REJECTED';
      END
      $$
    `);
    await database.sql.unsafe(`
      CREATE CONSTRAINT TRIGGER test_reject_migration_33_outer_commit_v1
      AFTER INSERT ON test_migration_33_outer_commit_v1.commit_signal
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION test_migration_33_outer_commit_v1.reject_commit()
    `);
    let commitCallbackReturned = false;
    const commitRejectingSql = new Proxy(database.sql as any, {
      get(target, property) {
        if (property === "begin") {
          return (callback: (sql: unknown) => Promise<unknown>) => database.sql.begin(async (transaction) => {
            const result = await callback(transaction);
            await transaction.unsafe(
              "INSERT INTO test_migration_33_outer_commit_v1.commit_signal (signal) VALUES (33)",
            );
            commitCallbackReturned = true;
            return result;
          });
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    let commitSettled = false;
    let commitResultObserved = false;
    const commitRejectingApply = applyContractSpineMigrations(commitRejectingSql, {
      releaseSha: "c".repeat(40),
    }).then((result) => {
      commitResultObserved = true;
      return result;
    }).finally(() => { commitSettled = true; });
    try {
      await assert.rejects(
        commitRejectingApply,
        /TEST_MIGRATION_OUTER_COMMIT_REJECTED/,
        "outer commit-time rejection",
      );
      assert.equal(commitCallbackReturned, true, "outer callback did not return before COMMIT rejection");
      assert.equal(commitResultObserved, false, "migration result escaped before COMMIT acknowledgement");
      assert.equal(commitSettled, true);
      assert.deepEqual(
        await snapshotMigration33RollbackBoundary(database),
        before,
        "outer COMMIT rejection changed legacy metadata or migration 33 bytes",
      );
    } finally {
      await database.sql.unsafe("DROP SCHEMA test_migration_33_outer_commit_v1 CASCADE");
    }
  });

  it("projects migration 33 exact columns, keys, foreign keys, function, triggers, owner and ACL", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
    const columns = await database.sql<Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>>`
      SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'internal_production_v3_recovery_claim_publications_v1'
       ORDER BY ordinal_position
    `;
    assert.deepEqual(columns.map((column) => ({ ...column })), [
      { column_name: "claim_id", data_type: "bigint", is_nullable: "NO" },
      { column_name: "runtime_session_id", data_type: "text", is_nullable: "NO" },
      { column_name: "run_id", data_type: "text", is_nullable: "NO" },
      { column_name: "step_db_id", data_type: "text", is_nullable: "NO" },
      { column_name: "workflow_step_id", data_type: "text", is_nullable: "NO" },
      { column_name: "story_db_id", data_type: "text", is_nullable: "NO" },
      { column_name: "story_id", data_type: "text", is_nullable: "NO" },
      { column_name: "story_index", data_type: "integer", is_nullable: "NO" },
      { column_name: "recovery_case_id", data_type: "text", is_nullable: "NO" },
      { column_name: "revision_id", data_type: "text", is_nullable: "NO" },
      { column_name: "dispatch_id", data_type: "text", is_nullable: "NO" },
      { column_name: "status", data_type: "text", is_nullable: "NO" },
      { column_name: "handoff_canonical_json", data_type: "text", is_nullable: "NO" },
      { column_name: "handoff_hash", data_type: "text", is_nullable: "NO" },
      { column_name: "bound_at", data_type: "timestamp with time zone", is_nullable: "NO" },
    ]);
    const catalog = await database.sql<Array<{
      foreign_keys: number;
      constraints: number;
      triggers: number;
      enabled_triggers: number;
      table_owner_current: boolean;
      public_table_access: boolean;
      function_owner_current: boolean;
      public_function_execute: boolean;
      function_body: string;
      function_config: string[] | null;
    }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM pg_constraint
          WHERE conrelid = 'internal_production_v3_recovery_claim_publications_v1'::regclass
            AND contype = 'f') AS foreign_keys,
        (SELECT COUNT(*)::integer FROM pg_constraint
          WHERE conrelid = 'internal_production_v3_recovery_claim_publications_v1'::regclass) AS constraints,
        (SELECT COUNT(*)::integer FROM pg_trigger
          WHERE tgrelid = 'internal_production_v3_recovery_claim_publications_v1'::regclass
            AND NOT tgisinternal) AS triggers,
        (SELECT COUNT(*)::integer FROM pg_trigger
          WHERE tgrelid = 'internal_production_v3_recovery_claim_publications_v1'::regclass
            AND NOT tgisinternal AND tgenabled = 'O') AS enabled_triggers,
        (SELECT pg_get_userbyid(relowner) = current_user FROM pg_class
          WHERE oid = 'internal_production_v3_recovery_claim_publications_v1'::regclass)
          AS table_owner_current,
        has_table_privilege(
          0, 'internal_production_v3_recovery_claim_publications_v1'::regclass, 'SELECT'
        ) AS public_table_access,
        pg_get_userbyid(function.proowner) = current_user AS function_owner_current,
        has_function_privilege(0, function.oid, 'EXECUTE') AS public_function_execute,
        function.prosrc AS function_body,
        function.proconfig AS function_config
      FROM pg_proc function
      WHERE function.oid = 'ip_v3_recovery_publication_immutable_v1()'::regprocedure
    `;
    assert.deepEqual({ ...catalog[0], function_body: catalog[0]?.function_body.trim() }, {
      foreign_keys: 9,
      constraints: 15,
      triggers: 2,
      enabled_triggers: 2,
      table_owner_current: true,
      public_table_access: false,
      function_owner_current: true,
      public_function_execute: false,
      function_body: "BEGIN\n  RAISE EXCEPTION 'V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_IMMUTABLE';\nEND",
      function_config: ["search_path=pg_catalog, public"],
    });
  });

  it("rejects extra migration 33 indexes instead of accepting expanded topology", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
    await database.sql`
      CREATE INDEX ip_v3_recovery_publications_unexpected_idx
      ON internal_production_v3_recovery_claim_publications_v1 (run_id)
    `;
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects every extra named-role and PUBLIC table/function grant on migration 33", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
    for (const [grant, revoke] of [
      [
        "GRANT SELECT ON internal_production_v3_recovery_claim_publications_v1 TO pg_monitor",
        "REVOKE ALL ON internal_production_v3_recovery_claim_publications_v1 FROM pg_monitor",
      ],
      [
        "GRANT EXECUTE ON FUNCTION ip_v3_recovery_publication_immutable_v1() TO pg_monitor",
        "REVOKE ALL ON FUNCTION ip_v3_recovery_publication_immutable_v1() FROM pg_monitor",
      ],
      [
        "GRANT SELECT ON internal_production_v3_recovery_claim_publications_v1 TO PUBLIC",
        "REVOKE ALL ON internal_production_v3_recovery_claim_publications_v1 FROM PUBLIC",
      ],
      [
        "GRANT EXECUTE ON FUNCTION ip_v3_recovery_publication_immutable_v1() TO PUBLIC",
        "REVOKE ALL ON FUNCTION ip_v3_recovery_publication_immutable_v1() FROM PUBLIC",
      ],
    ] as const) {
      await database.sql.unsafe(grant);
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql.unsafe(revoke);
      assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    }
  });

  it("rejects migration 33 owner and trigger-enabled drift", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
    for (const [mutate, restore] of [
      [
        "ALTER TABLE internal_production_v3_recovery_claim_publications_v1 OWNER TO pg_monitor",
        "ALTER TABLE internal_production_v3_recovery_claim_publications_v1 OWNER TO postgres",
      ],
      [
        "ALTER FUNCTION ip_v3_recovery_publication_immutable_v1() OWNER TO pg_monitor",
        "ALTER FUNCTION ip_v3_recovery_publication_immutable_v1() OWNER TO postgres",
      ],
      [
        "ALTER TABLE internal_production_v3_recovery_claim_publications_v1 DISABLE TRIGGER ip_v3_recovery_publication_row_immutable_v1",
        "ALTER TABLE internal_production_v3_recovery_claim_publications_v1 ENABLE TRIGGER ip_v3_recovery_publication_row_immutable_v1",
      ],
      [
        "ALTER TABLE internal_production_v3_recovery_claim_publications_v1 DISABLE TRIGGER ip_v3_recovery_publication_truncate_forbidden_v1",
        "ALTER TABLE internal_production_v3_recovery_claim_publications_v1 ENABLE TRIGGER ip_v3_recovery_publication_truncate_forbidden_v1",
      ],
      [
        "CREATE OR REPLACE FUNCTION ip_v3_recovery_publication_immutable_v1() RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $$BEGIN RAISE EXCEPTION 'DRIFTED_RECOVERY_PUBLICATION_FUNCTION'; END$$",
        "CREATE OR REPLACE FUNCTION ip_v3_recovery_publication_immutable_v1() RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $$BEGIN\n  RAISE EXCEPTION 'V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_IMMUTABLE';\nEND$$",
      ],
    ] as const) {
      await database.sql.unsafe(mutate);
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql.unsafe(restore);
      assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    }
  });

  it("adopts only exact migration 33 schema with undefined and defined metadata triples", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 33`;
    const withoutRelease = await applyContractSpineMigrations(database.sql);
    assert.equal(withoutRelease.adopted.at(-1), recoveryPublicationMigrationId);
    const undefinedRows = await database.sql<Array<{
      state: string;
      release_sha: string | null;
      verified_release_sha: string | null;
      verified_at: Date | null;
    }>>`
      SELECT state, release_sha, verified_release_sha, verified_at
        FROM setfarm_schema_migrations WHERE version = 33
    `;
    assert.deepEqual({ ...undefinedRows[0] }, {
      state: "adopted",
      release_sha: null,
      verified_release_sha: null,
      verified_at: null,
    });

    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 33`;
    const releaseSha = "f".repeat(40);
    const withRelease = await applyContractSpineMigrations(database.sql, { releaseSha });
    assert.equal(withRelease.adopted.at(-1), recoveryPublicationMigrationId);
    const definedRows = await database.sql<typeof undefinedRows>`
      SELECT state, release_sha, verified_release_sha, verified_at
        FROM setfarm_schema_migrations WHERE version = 33
    `;
    assert.deepEqual({ ...definedRows[0], verified_at: definedRows[0]?.verified_at instanceof Date }, {
      state: "adopted",
      release_sha: releaseSha,
      verified_release_sha: releaseSha,
      verified_at: true,
    });
  });

  it("preserves exact existing migration 33 metadata when release is undefined and rejects partial schema", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const releaseSha = "9".repeat(40);
    await applyContractSpineMigrations(database.sql, { releaseSha });
    const before = await database.sql<Array<{
      release_sha: string | null;
      verified_release_sha: string | null;
      verified_at: Date | null;
    }>>`
      SELECT release_sha, verified_release_sha, verified_at
        FROM setfarm_schema_migrations WHERE version = 33
    `;
    const repeated = await applyContractSpineMigrations(database.sql);
    assert.equal(repeated.alreadyApplied.at(-1), recoveryPublicationMigrationId);
    const after = await database.sql<typeof before>`
      SELECT release_sha, verified_release_sha, verified_at
        FROM setfarm_schema_migrations WHERE version = 33
    `;
    assert.deepEqual(after, before);

    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 33`;
    await database.sql`DROP TABLE internal_production_v3_recovery_claim_publications_v1`;
    await database.sql`DROP FUNCTION ip_v3_recovery_publication_immutable_v1()`;
    await database.sql`CREATE TABLE internal_production_v3_recovery_claim_publications_v1 (claim_id bigint)`;
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    assert.equal(
      (await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations WHERE version = 33
      `)[0]?.count,
      0,
    );
  });

  it("preserves existing migration 33 release identity while refreshing defined verification metadata", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const originalRelease = "7".repeat(40);
    await applyContractSpineMigrations(database.sql, { releaseSha: originalRelease });
    const original = await database.sql<Array<{ verified_at: Date }>>`
      SELECT verified_at FROM setfarm_schema_migrations WHERE version=33
    `;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const verificationRelease = "8".repeat(40);
    const repeated = await applyContractSpineMigrations(database.sql, {
      releaseSha: verificationRelease,
    });
    assert.equal(repeated.alreadyApplied.at(-1), recoveryPublicationMigrationId);
    const rows = await database.sql<Array<{
      state: string;
      release_sha: string;
      verified_release_sha: string;
      verified_at: Date;
    }>>`
      SELECT state,release_sha,verified_release_sha,verified_at
        FROM setfarm_schema_migrations WHERE version=33
    `;
    assert.equal(rows[0]?.state, "applied");
    assert.equal(rows[0]?.release_sha, originalRelease);
    assert.equal(rows[0]?.verified_release_sha, verificationRelease);
    assert.ok(rows[0]!.verified_at.getTime() >= original[0]!.verified_at.getTime());
  });

  it("rejects extra pending migration 33 topology before mutating predecessor verification metadata", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const initialRelease = "4".repeat(40);
    await applyContractSpineMigrations(database.sql, { releaseSha: initialRelease });
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version=33`;
    await database.sql`
      CREATE INDEX ip_v3_recovery_publications_preflight_extra_idx
      ON internal_production_v3_recovery_claim_publications_v1 (story_id)
    `;
    const before = await database.sql<Array<{
      version: number;
      release_sha: string | null;
      verified_release_sha: string | null;
      verified_at: Date | null;
    }>>`
      SELECT version,release_sha,verified_release_sha,verified_at
        FROM setfarm_schema_migrations ORDER BY version
    `;
    await assert.rejects(
      applyContractSpineMigrations(database.sql, { releaseSha: "5".repeat(40) }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const after = await database.sql<typeof before>`
      SELECT version,release_sha,verified_release_sha,verified_at
        FROM setfarm_schema_migrations ORDER BY version
    `;
    assert.deepEqual(after, before);
    assert.equal(
      (await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations WHERE version=33
      `)[0]?.count,
      0,
    );
  });

  it("generic apply skips guarded 32 while targeted v31 audit and pending inspection succeed", async () => {
    const migrationApi = await import("../../src/db/contract-spine-migrations.js");
    assert.equal(
      typeof migrationApi.auditAuthorityV3ContractSpineThroughMigration31V1,
      "function",
    );
    assert.equal(
      typeof migrationApi.inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1,
      "function",
    );

    const priorEnvironment = process.env.SETFARM_APPLY_GUARDED_MIGRATION;
    process.env.SETFARM_APPLY_GUARDED_MIGRATION = guardedMigrationId;
    try {
      const applied = await applyContractSpineMigrations(database.sql, {
        releaseSha: "c".repeat(40),
        guarded: true,
        migrationId: guardedMigrationId,
      } as never);
      assert.deepEqual(applied.guardedPending, [guardedMigrationId]);
    } finally {
      if (priorEnvironment === undefined) {
        delete process.env.SETFARM_APPLY_GUARDED_MIGRATION;
      } else {
        process.env.SETFARM_APPLY_GUARDED_MIGRATION = priorEnvironment;
      }
    }

    const journal = await database.sql<Array<{ version: number }>>`
      SELECT version FROM setfarm_schema_migrations ORDER BY version
    `;
    assert.deepEqual(journal.map((row) => row.version), Array.from({ length: 31 }, (_, i) => i + 1));
    const guardedRelations = await database.sql<Array<{ relation: string | null }>>`
      SELECT to_regclass('public.internal_production_bootstrap_main_claim_handoff_operations_v1')::text AS relation
      UNION ALL SELECT to_regclass('public.internal_production_owner_reservations_v1')::text
      UNION ALL SELECT to_regclass('public.internal_production_owner_admission_authorities_v1')::text
      UNION ALL SELECT to_regclass('public.internal_production_owner_admission_head_v1')::text
      UNION ALL SELECT to_regclass('public.internal_production_owner_producer_source_build_authorities_v1')::text
      UNION ALL SELECT to_regclass('public.internal_production_owner_producer_manifest_set_activations_v1')::text
      UNION ALL SELECT to_regclass('public.internal_production_owner_producer_manifest_activation_heads_v1')::text
      UNION ALL SELECT to_regclass('public.internal_production_owner_producer_manifest_set_current_v1')::text
    `;
    assert.deepEqual(
      guardedRelations.map((row) => row.relation),
      [null, null, null, null, null, null, null, null],
    );

    const audit = await migrationApi.auditAuthorityV3ContractSpineThroughMigration31V1(database.sql);
    assert.equal(audit.status, "verified");
    assert.equal(audit.throughVersion, 31);
    assert.equal(audit.migrations.length, 31);
    const pending = await migrationApi
      .inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(database.sql);
    assert.deepEqual({
      status: pending.status,
      version: pending.migration.version,
      name: pending.migration.name,
      migrationClass: pending.migration.migrationClass,
      state: pending.migration.state,
    }, {
      status: "exact_pending_guarded_successor",
      version: 32,
      name: guardedMigrationId,
      migrationClass: "guarded",
      state: "pending",
    });
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE"
        && /Migration 32 is pending/.test(error.message),
    );
  });

  it("test-private zero-argument capability applies guarded 32 exactly once", async () => {
    const capability = database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1;
    assert.equal(typeof capability, "function");
    assert.equal(capability.length, 0);
    await assert.rejects(
      Reflect.apply(capability, database, [{}]),
      /TEST_GUARDED_MIGRATION_32_ARGUMENTS_FORBIDDEN/,
    );

    const automatic = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(automatic.guardedPending, [guardedMigrationId]);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
    const first = await capability.call(database);
    assert.equal(first.status, "applied");
    const descendantReleaseSha = "d".repeat(40);
    const reattested = await applyContractSpineMigrations(database.sql, {
      releaseSha: descendantReleaseSha,
    });
    assert.deepEqual(reattested.guardedPending, []);
    const applicationIdentity = await database.sql<Array<{
      release_sha: string;
      verified_release_sha: string;
    }>>`
      SELECT release_sha, verified_release_sha
        FROM setfarm_schema_migrations
       WHERE version = 32
    `;
    assert.deepEqual(applicationIdentity.map((row) => ({ ...row })), [{
      release_sha: "a".repeat(40),
      verified_release_sha: descendantReleaseSha,
    }]);
    const second = await capability.call(database);
    assert.equal(second.status, "already_applied");

    const journal = await database.sql<Array<{ version: number; name: string }>>`
      SELECT version, name FROM setfarm_schema_migrations WHERE version = 32
    `;
    assert.deepEqual(journal.map((row) => ({ ...row })), [{ version: 32, name: guardedMigrationId }]);
    const complete = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(complete.guardedPending, []);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");

    const module = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    const projection = await module.projectBootstrapMainClaimHandoffV1Schema(database.sql);
    assert.deepEqual(projection, {
      schema: "setfarm.bootstrap-main-claim-handoff-schema-projection.v1",
      migrationId: guardedMigrationId,
      migrationOrdinal: 32,
      bootstrapHandoffOperationTablePresent: true,
      bootstrapHandoffOperationIdUnique: true,
      bootstrapHandoffClaimIdUnique: true,
      terminalReceiptPairColumnsPresent: true,
      ownerReservationSidecarPresent: true,
      ownerAdmissionHeadPresent: true,
    });
    const activationRelations = await database.sql<Array<{
      relation_name: string;
      canonical_body_type: string | null;
    }>>`
      SELECT c.relname AS relation_name,
             format_type(a.atttypid, a.atttypmod) AS canonical_body_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attribute a
          ON a.attrelid = c.oid
         AND a.attname = 'canonical_body'
         AND a.attnum > 0
         AND NOT a.attisdropped
       WHERE n.nspname = 'public'
         AND c.relname = ANY(${[
           "internal_production_owner_producer_source_build_authorities_v1",
           "internal_production_owner_producer_manifest_set_activations_v1",
           "internal_production_owner_producer_manifest_activation_heads_v1",
           "internal_production_owner_producer_manifest_set_current_v1",
         ]}::text[])
       ORDER BY c.relname
    `;
    assert.deepEqual(activationRelations.map((row) => ({ ...row })), [
      {
        relation_name: "internal_production_owner_producer_manifest_activation_heads_v1",
        canonical_body_type: "text",
      },
      {
        relation_name: "internal_production_owner_producer_manifest_set_activations_v1",
        canonical_body_type: "text",
      },
      {
        relation_name: "internal_production_owner_producer_manifest_set_current_v1",
        canonical_body_type: null,
      },
      {
        relation_name: "internal_production_owner_producer_source_build_authorities_v1",
        canonical_body_type: "text",
      },
    ]);
    const activationCurrentSeed = await database.sql<Array<{
      singleton_key: boolean;
      current_revision: string;
      phase: string | null;
      activation_ref: string | null;
      activation_hash: string | null;
      head_ref: string | null;
      head_hash: string | null;
    }>>`
      SELECT singleton_key, current_revision::text, phase,
             activation_ref, activation_hash, head_ref, head_hash
        FROM internal_production_owner_producer_manifest_set_current_v1
    `;
    assert.deepEqual(activationCurrentSeed.map((row) => ({ ...row })), [{
      singleton_key: true,
      current_revision: "0",
      phase: null,
      activation_ref: null,
      activation_hash: null,
      head_ref: null,
      head_hash: null,
    }]);
    await assert.rejects(
      database.sql`
        UPDATE internal_production_owner_producer_manifest_set_current_v1
           SET current_revision = current_revision
         WHERE singleton_key = TRUE
      `,
      /IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID/,
    );
    for (const statement of [
      "UPDATE internal_production_owner_producer_source_build_authorities_v1 SET plan = plan",
      "DELETE FROM internal_production_owner_producer_manifest_set_activations_v1",
      "TRUNCATE internal_production_owner_producer_source_build_authorities_v1",
    ]) {
      await assert.rejects(
        database.sql.unsafe(statement),
        /IP_OWNER_PRODUCER_IMMUTABLE_MUTATION/,
      );
    }
    const immutableFunctionStatement =
      module.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_STATEMENTS[8] as string;
    const replaceFunctionStatement = immutableFunctionStatement.replace(
      "CREATE FUNCTION",
      "CREATE OR REPLACE FUNCTION",
    );
    const caseDriftedFunctionStatement = replaceFunctionStatement.replace(
      "IP_OWNER_PRODUCER_IMMUTABLE_MUTATION",
      "ip_owner_producer_immutable_mutation",
    );
    try {
      await database.sql.unsafe(caseDriftedFunctionStatement);
      await assert.rejects(
        module.projectBootstrapMainClaimHandoffV1Schema(database.sql),
        /function catalog mismatch|exact relation metadata mismatch/,
      );
    } finally {
      await database.sql.unsafe(replaceFunctionStatement);
    }
    await module.projectBootstrapMainClaimHandoffV1Schema(database.sql);

    const rawBodyText = '{  "z": 1.00, "a": "Case  Preserved", "z": 2  }';
    await assert.rejects(
      database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `INSERT INTO internal_production_owner_producer_source_build_authorities_v1 (
             source_build_authority_ref, source_build_authority_hash, plan,
             manifest_hash, owner_category_registry_hash,
             owner_category_census_map_hash, canonical_body
           ) VALUES ($1,$2,'A',$3,$4,$5,$6)`,
          [
            "setfarm://tests/canonical-text-preservation",
            "1".repeat(64),
            "2".repeat(64),
            "3".repeat(64),
            "4".repeat(64),
            rawBodyText,
          ],
        );
        const rows = await transaction.unsafe<Array<{ canonical_body: string }>>(
          `SELECT canonical_body
             FROM internal_production_owner_producer_source_build_authorities_v1
            WHERE source_build_authority_ref = $1`,
          ["setfarm://tests/canonical-text-preservation"],
        );
        assert.equal(rows[0]?.canonical_body, rawBodyText);
        throw new Error("ROLLBACK_CANONICAL_TEXT_FIXTURE");
      }),
      /ROLLBACK_CANONICAL_TEXT_FIXTURE/,
    );
    const rolledBackTextRows = await database.sql<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count
        FROM internal_production_owner_producer_source_build_authorities_v1
       WHERE source_build_authority_ref = 'setfarm://tests/canonical-text-preservation'
    `;
    assert.equal(rolledBackTextRows[0]?.count, "0");
    await database.sql`
      UPDATE internal_production_owner_admission_head_v1
         SET head_payload = head_payload || ${{
           headTransitionFixture: {
             schema: "setfarm.test-owner-admission-head-transition.v1",
             headVersion: 1,
           },
         }}::jsonb
       WHERE singleton = TRUE
    `;
    assert.equal((await planContractSpineMigrations(database.sql)).status, "current");
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    assert.equal((await capability.call(database)).status, "already_applied");
    const preserved = await database.sql<Array<{ head_payload: Record<string, unknown> }>>`
      SELECT head_payload
        FROM internal_production_owner_admission_head_v1
       WHERE singleton = TRUE
    `;
    const preservedHeadPayload = preserved[0]!.head_payload;
    for (const mutation of [
      `head_payload #- '{migrationApplication,authorizationHash}'`,
      `jsonb_set(
         head_payload,
         '{migrationApplication,unexpected}',
         'true'::jsonb
       )`,
      `jsonb_set(
         jsonb_set(
           head_payload,
           '{migrationApplication,authorizationHash}',
           head_payload #> '{migrationApplication,authorizationConsumptionHash}'
         ),
         '{migrationApplication,authorizationConsumptionHash}',
         head_payload #> '{migrationApplication,authorizationHash}'
       )`,
    ]) {
      await database.sql.unsafe(
        `UPDATE internal_production_owner_admission_head_v1
            SET head_payload = ${mutation}
          WHERE singleton = TRUE`,
      );
      const drift = await planContractSpineMigrations(database.sql);
      assert.equal(drift.status, "drift");
      assert.equal(
        drift.migrations.find((migration) => migration.version === 32)?.state,
        "adoption_mismatch",
      );
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql`
        UPDATE internal_production_owner_admission_head_v1
           SET head_payload = ${preservedHeadPayload}::jsonb
         WHERE singleton = TRUE
      `;
    }
  });

  it("rejects adoptable, partial, extra-pending, and unexpected guarded successors", async () => {
    const migrationApi = await import("../../src/db/contract-spine-migrations.js");
    const guarded = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    await applyContractSpineMigrations(database.sql);

    await database.sql.unsafe(guarded.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_STATEMENTS[0]);
    await assert.rejects(
      migrationApi.inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );

    await database.sql.unsafe("DROP TABLE internal_production_bootstrap_main_claim_handoff_operations_v1");
    for (const statement of guarded.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    await assert.rejects(
      migrationApi.inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    await assert.rejects(
      database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1(),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );

    await database.sql.unsafe(`
      DROP TABLE
        internal_production_owner_producer_manifest_set_current_v1,
        internal_production_owner_producer_manifest_activation_heads_v1,
        internal_production_owner_producer_manifest_set_activations_v1,
        internal_production_owner_producer_source_build_authorities_v1,
        internal_production_owner_admission_head_v1,
        internal_production_owner_admission_authorities_v1,
        internal_production_owner_reservations_v1,
        internal_production_bootstrap_main_claim_handoff_operations_v1
      CASCADE
    `);
    await database.sql.unsafe("DROP FUNCTION ip_op_enforce_current_update_v1()");
    await database.sql.unsafe("DROP FUNCTION ip_op_reject_immutable_v1()");
    await database.sql.unsafe(
      "DROP FUNCTION setfarm_forbid_internal_production_owner_admission_authority_mutation()",
    );
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 31`;
    await assert.rejects(
      migrationApi.inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );

    await database.sql`
      INSERT INTO setfarm_schema_migrations (version, name, checksum, state, release_sha)
      VALUES (99, '099_unexpected', ${"f".repeat(64)}, 'applied', NULL)
    `;
    await assert.rejects(
      migrationApi.inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_UNKNOWN_VERSION",
    );
  });

  it("rejects a forged adopted journal state for guarded migration 32", async () => {
    const guarded = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    const automatic = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(automatic.guardedPending, [guardedMigrationId]);
    const pendingPlan = await planContractSpineMigrations(database.sql);
    const guardedPlan = pendingPlan.migrations.find((migration) => migration.version === 32);
    assert.ok(guardedPlan);
    for (const statement of guarded.BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    await database.sql`
      INSERT INTO setfarm_schema_migrations (version, name, checksum, state, release_sha)
      VALUES (32, ${guardedMigrationId}, ${guardedPlan.checksum}, 'adopted', ${"a".repeat(40)})
    `;

    const forgedPlan = await planContractSpineMigrations(database.sql);
    assert.equal(forgedPlan.status, "drift");
    assert.equal(
      forgedPlan.migrations.find((migration) => migration.version === 32)?.state,
      "adoption_mismatch",
    );
    for (const operation of [
      () => applyContractSpineMigrations(database.sql),
      () => verifyContractSpineMigrations(database.sql),
      () => database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1(),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }

    await database.sql`UPDATE setfarm_schema_migrations SET state = 'applied' WHERE version = 32`;
    const provenanceFreePlan = await planContractSpineMigrations(database.sql);
    assert.equal(provenanceFreePlan.status, "drift");
    assert.equal(
      provenanceFreePlan.migrations.find((migration) => migration.version === 32)?.state,
      "adoption_mismatch",
    );
    for (const operation of [
      () => applyContractSpineMigrations(database.sql),
      () => verifyContractSpineMigrations(database.sql),
      () => database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1(),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("rejects same-name guarded schema weakening through the exact projector", async () => {
    const guarded = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await database.sql.unsafe(
      `ALTER TABLE internal_production_owner_admission_authorities_v1
         DROP CONSTRAINT internal_production_owner_admission_authority_kind_check`,
    );
    await database.sql.unsafe(
      `ALTER TABLE internal_production_owner_admission_authorities_v1
         ADD CONSTRAINT internal_production_owner_admission_authority_kind_check
         CHECK (authority_kind <> '')`,
    );

    await assert.rejects(
      guarded.projectBootstrapMainClaimHandoffV1Schema(database.sql),
      (error: unknown) => error instanceof guarded.BootstrapMainClaimHandoffV1SchemaError
        && /exact relation metadata mismatch/.test(error.message),
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("projects the exact category and owner-admission purpose guards", async () => {
    const guarded = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const requiredGuards = [
      {
        relation: "internal_production_owner_reservations_v1",
        name: "internal_production_owner_reservation_category_check",
      },
      {
        relation: "internal_production_owner_admission_authorities_v1",
        name: "internal_production_owner_admission_authority_purpose_check",
      },
    ] as const;
    const installed = await database.sql.unsafe<Array<{ name: string }>>(
      `SELECT conname AS name
         FROM pg_constraint
        WHERE conname = ANY($1::text[])
        ORDER BY conname`,
      [requiredGuards.map((guard) => guard.name)],
    );
    assert.deepEqual(
      installed.map((row) => row.name),
      requiredGuards.map((guard) => guard.name).sort(),
    );

    for (const guard of requiredGuards) {
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(
            `ALTER TABLE public.${guard.relation} DROP CONSTRAINT ${guard.name}`,
          );
          await transaction.unsafe(
            `ALTER TABLE public.${guard.relation} ADD CONSTRAINT ${guard.name} CHECK (TRUE)`,
          );
          await guarded.projectBootstrapMainClaimHandoffV1Schema(transaction);
        }),
        (error: unknown) => error instanceof guarded.BootstrapMainClaimHandoffV1SchemaError
          && /exact relation metadata mismatch/.test(error.message),
      );
    }
  });

  it("rejects owner reservations outside the exact category registry", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO internal_production_owner_reservations_v1 (
           reservation_ref, reservation_hash, category, owner_key, owner_key_hash,
           producer_purpose_hash, producer_implementation_id,
           producer_implementation_hash, reservation_payload,
           reservation_head_predecessor_hash, state, head_version
         ) VALUES ($1, $2, 'invented-owner-category', 'owner-key', $3, $4,
                   'test-producer-v1', $5, '{}'::jsonb, $6, 'pending', 0)`,
        [
          "setfarm://tests/reservations/invalid-category",
          "1".repeat(64),
          "2".repeat(64),
          "3".repeat(64),
          "4".repeat(64),
          "5".repeat(64),
        ],
      ),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "23514",
    );
  });

  it("rejects owner-admission fence and release bodies outside the exact purpose union", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const predecessor = "0".repeat(64);
    const successor = "1".repeat(64);
    const invalidFenceRef = "setfarm://tests/owner-admission-fences/invalid-purpose";
    const invalidFenceHash = "2".repeat(64);
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO internal_production_owner_admission_authorities_v1 (
           authority_ref, authority_hash, authority_kind, phase_key,
           predecessor_head_hash, successor_head_hash, authority_body
         ) VALUES ($1, $2, 'fence', 'invalid-fence-purpose', $3, $4, $5::text::jsonb)`,
        [
          invalidFenceRef,
          invalidFenceHash,
          predecessor,
          successor,
          JSON.stringify({
            schema: "setfarm.internal-production-global-owner-admission-fence.v1",
            purpose: "invented-owner-admission-purpose-v1",
            fenceRef: invalidFenceRef,
            fenceHash: invalidFenceHash,
            ownerAdmissionHeadHash: successor,
            targetFamily: { kind: "none", targetFamilyHash: null },
          }),
        ],
      ),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "23514",
    );

    const invalidReleaseRef = "setfarm://tests/owner-admission-releases/invalid-purpose";
    const invalidReleaseHash = "3".repeat(64);
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO internal_production_owner_admission_authorities_v1 (
           authority_ref, authority_hash, authority_kind, phase_key,
           predecessor_head_hash, successor_head_hash, authority_body
         ) VALUES ($1, $2, 'release', 'invalid-release-purpose', $3, $4, $5::text::jsonb)`,
        [
          invalidReleaseRef,
          invalidReleaseHash,
          predecessor,
          successor,
          JSON.stringify({
            schema: "setfarm.internal-production-global-owner-admission-fence-release.v1",
            purpose: "invented-owner-admission-purpose-v1",
            releaseRef: invalidReleaseRef,
            releaseHash: invalidReleaseHash,
            ownerAdmissionHeadPredecessorHash: predecessor,
            ownerAdmissionHeadSuccessorHash: successor,
            releaseAuthority: { targetFamilyKind: "none" },
          }),
        ],
      ),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "23514",
    );
  });

  it("makes the owner-admission authority journal permanently append-only", async () => {
    const guarded = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    await applyContractSpineMigrations(database.sql);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    const authorityRef = "setfarm://tests/owner-admission-authorities/immutable-reservation";
    const authorityHash = "1".repeat(64);
    const predecessor = "0".repeat(64);
    await database.sql.unsafe(
      `INSERT INTO internal_production_owner_admission_authorities_v1 (
         authority_ref, authority_hash, authority_kind, phase_key,
         predecessor_head_hash, successor_head_hash, authority_body
       ) VALUES ($1, $2, 'reservation', 'immutable-reservation', $3, $3, $4::text::jsonb)`,
      [
        authorityRef,
        authorityHash,
        predecessor,
        JSON.stringify({
          schema: "setfarm.internal-production-owner-reservation.v1",
          reservationRef: authorityRef,
          reservationHash: authorityHash,
          ownerAdmissionHeadPredecessorHash: predecessor,
        }),
      ],
    );
    for (const mutation of [
      `UPDATE internal_production_owner_admission_authorities_v1
          SET phase_key = 'rewritten' WHERE authority_ref = '${authorityRef}'`,
      `DELETE FROM internal_production_owner_admission_authorities_v1
          WHERE authority_ref = '${authorityRef}'`,
      "TRUNCATE TABLE internal_production_owner_admission_authorities_v1",
    ]) {
      await assert.rejects(
        database.sql.unsafe(mutation),
        /INTERNAL_PRODUCTION_OWNER_ADMISSION_AUTHORITY_MUTATION_FORBIDDEN/,
      );
    }

    await database.sql.unsafe(
      `CREATE OR REPLACE FUNCTION public.setfarm_forbid_internal_production_owner_admission_authority_mutation()
       RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public AS $function$
       BEGIN
         RETURN OLD;
       END
       $function$`,
    );
    await assert.rejects(
      guarded.projectBootstrapMainClaimHandoffV1Schema(database.sql),
      (error: unknown) => error instanceof guarded.BootstrapMainClaimHandoffV1SchemaError
        && /exact relation metadata mismatch/.test(error.message),
    );
  });

  it("keeps the test-only migration capability outside production exports and package commands", async () => {
    const migrationApi = await import("../../src/db/contract-spine-migrations.js");
    assert.equal(
      "applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1" in migrationApi,
      false,
    );
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.equal(
      Object.values(packageJson.scripts).some((command) =>
        /guarded|bootstrap-main-claim-handoff/i.test(command)),
      false,
    );

    const seamSymbols = [
      ["mintBootstrapMainClaimHandoff", "GuardedMigration32EvidenceForControllerV1"].join(""),
      ["applyBootstrapMainClaimHandoff", "GuardedMigration32V1"].join(""),
    ] as const;
    const seamOccurrences: Array<Readonly<{
      symbol: string;
      file: string;
      count: number;
    }>> = [];
    for (const sourceRoot of [
      path.join(repoRoot, "src"),
      path.join(repoRoot, "tests"),
      path.join(repoRoot, "scripts"),
    ]) {
      for (const file of await typescriptFilesUnder(sourceRoot)) {
        const source = await readFile(file, "utf8");
        for (const symbol of seamSymbols) {
          const count = source.split(symbol).length - 1;
          if (count > 0) {
            seamOccurrences.push({ symbol, file: path.relative(repoRoot, file), count });
          }
        }
      }
    }
    seamOccurrences.sort((left, right) =>
      left.file.localeCompare(right.file)
      || seamSymbols.indexOf(left.symbol).toString().localeCompare(
        seamSymbols.indexOf(right.symbol).toString(),
      ));
    assert.deepEqual(seamOccurrences, [
      {
        symbol: seamSymbols[1],
        file: "src/db-pg.ts",
        count: 2,
      },
      {
        symbol: seamSymbols[0],
        file: "src/db/bootstrap-main-claim-handoff-v1-migration.ts",
        count: 1,
      },
      {
        symbol: seamSymbols[1],
        file: "src/db/contract-spine-migrations.ts",
        count: 1,
      },
      {
        symbol: seamSymbols[1],
        file: "tests/execution-attempts/migrations.test.ts",
        count: 1,
      },
      {
        symbol: seamSymbols[0],
        file: "tests/execution-attempts/test-database.ts",
        count: 4,
      },
      {
        symbol: seamSymbols[1],
        file: "tests/execution-attempts/test-database.ts",
        count: 6,
      },
      {
        symbol: seamSymbols[0],
        file: "tests/internal-production/owner-admission-v1.test.ts",
        count: 2,
      },
      {
        symbol: seamSymbols[1],
        file: "tests/internal-production/owner-admission-v1.test.ts",
        count: 2,
      },
    ]);
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
    assert.deepEqual(first.guardedPending, [guardedMigrationId]);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);

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
    assert.equal(journal.slice(0, 31).every((row) => row.release_sha === releaseSha), true);
    assert.equal(journal[31]?.release_sha, "a".repeat(40));
    assert.equal(
      journal.slice(0, 32).every((row) => row.verified_release_sha === "a".repeat(40)),
      true,
    );
    assert.deepEqual(journal[32], { release_sha: null, verified_release_sha: null });

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
    assert.equal(originalReleases.slice(0, 31).every((row) => row.release_sha === releaseSha), true);
    assert.equal(originalReleases[31]?.release_sha, "a".repeat(40));
    assert.equal(originalReleases[32]?.release_sha, null);
  });

  it("adopts an exact existing attempt table only after catalog verification", async () => {
    await applyContractSpineMigrations(database.sql);
    await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
      targetReleaseSha: "1".repeat(40),
    });
    await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
      targetReleaseSha: "0".repeat(40),
    });
    await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
      targetReleaseSha: "8".repeat(40),
    });
    await database.sql`DROP TABLE setfarm_schema_migrations`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations[0]?.state, "adoptable");
    const adopted = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(adopted.applied, [
      "003_migration_release_attestation",
      "029_v3_story_claim_runtime_binding_v1",
      "030_operational_failure_cause_authority_v2",
      "031_operational_failure_cause_authority_v3",
    ]);
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
      "019_runtime_completion_submission_evidence",
      "020_recovery_terminal_lease_identity",
      "021_operational_failure_cause_seal",
      "022_product_compilation_attempt_ledger",
      "023_artifact_publication_batch_ledger",
      "024_artifact_store_authority_ledger",
      "025_v3_preparation_authority_v2_ledger",
      "026_artifact_publication_batch_plan_ledger",
      "027_platform_release_store_record_ledger_v3",
      "028_runtime_completion_manifest_authority",
    ]);
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("upgrades agent-scoped claim indexes and backfills the exact relational claim owner", async () => {
    await applyContractSpineMigrations(database.sql);
    await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
      targetReleaseSha: "1".repeat(40),
    });
    await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
      targetReleaseSha: "0".repeat(40),
    });
    await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
      targetReleaseSha: "7".repeat(40),
    });
    await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
      targetReleaseSha: "6".repeat(40),
    });
    await rollbackPlatformReleaseStoreRecordLedgerV3ToV26(database.sql, {
      targetReleaseSha: "7".repeat(40),
    });
    await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
      targetReleaseSha: "8".repeat(40),
    });
    await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
      targetReleaseSha: "9".repeat(40),
    });
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version IN (5, 6, 7, 8, 12, 14, 18, 19, 21)`;
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
    await database.sql`DROP FUNCTION setfarm_validate_runtime_completion_submission()`;
    await database.sql`DROP FUNCTION setfarm_forbid_runtime_completion_submission_update()`;
    await database.sql`DROP INDEX idx_runtime_sessions_session_claim_run_unique`;
    await database.sql`DROP TABLE runtime_sessions`;
    await database.sql`DROP TABLE run_termination_requests`;
    await database.sql`DROP FUNCTION setfarm_enforce_operational_failure_cause_immutable()`;
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
      "019_runtime_completion_submission_evidence",
      "021_operational_failure_cause_seal",
      "025_v3_preparation_authority_v2_ledger",
      "026_artifact_publication_batch_plan_ledger",
      "027_platform_release_store_record_ledger_v3",
      "028_runtime_completion_manifest_authority",
      "029_v3_story_claim_runtime_binding_v1",
      "030_operational_failure_cause_authority_v2",
      "031_operational_failure_cause_authority_v3",
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
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
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
      "028_runtime_completion_manifest_authority",
      "029_v3_story_claim_runtime_binding_v1",
      "030_operational_failure_cause_authority_v2",
      "031_operational_failure_cause_authority_v3",
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
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
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

  it("rejects a submission trigger that omits one authoritative update column", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      "DROP TRIGGER trg_runtime_completion_submission_validate ON runtime_completion_requests",
    );
    await database.sql.unsafe(`
      CREATE TRIGGER trg_runtime_completion_submission_validate
      BEFORE INSERT OR UPDATE OF
        submission_evidence, source_proposal, output, output_hash, claim_envelope
      ON runtime_completion_requests
      FOR EACH ROW EXECUTE FUNCTION setfarm_validate_runtime_completion_submission()
    `);

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
    await database.applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
    await applyContractSpineMigrations(database.sql);
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
    assert.equal(results.flatMap((result) => result.applied).length, migrationCount - 2);
    assert.equal(results.flatMap((result) => result.alreadyApplied).length, migrationCount - 2);
    assert.deepEqual(
      results.map((result) => result.guardedPending),
      [[guardedMigrationId], [guardedMigrationId]],
    );

    const rows = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations
    `;
    assert.equal(rows[0]?.count, migrationCount - 2);
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
