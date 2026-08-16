import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import postgres from "postgres";

import {
  mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1,
} from "../../src/db/bootstrap-main-claim-handoff-v1-migration.js";
import {
  applyBootstrapMainClaimHandoffGuardedMigration32V1,
  applyContractSpineMigrations,
  auditAuthorityV3ContractSpineThroughMigration31V1,
  inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  convergenceArtifactRef,
  createV3ReleaseAdmissionV1,
} from "../../src/execution/v3-release-admission.js";

const TEST_DATABASE_PATTERN = /^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/;
const DEFAULT_ADMIN_URL = "postgresql://postgres@localhost:5432/postgres";

export type TestDatabase = Awaited<ReturnType<typeof createIsolatedTestDatabase>>;

export async function createIsolatedMigration31TestDatabase(): Promise<TestDatabase> {
  const database = await createIsolatedTestDatabase({ migrate: false });
  try {
    const automatic = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(automatic.guardedPending, [
      "contract-spine-bootstrap-main-claim-handoff-v1",
    ]);
    const audit = await auditAuthorityV3ContractSpineThroughMigration31V1(database.sql);
    assert.equal(audit.status, "verified");
    assert.equal(audit.throughVersion, 31);
    const pending = await inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(
      database.sql,
    );
    assert.equal(pending.status, "exact_pending_guarded_successor");
    assert.equal(pending.migration.version, 32);
    assert.equal(pending.migration.state, "pending");
    return database;
  } catch (error) {
    await database.cleanup();
    throw error;
  }
}

export async function seedV3ReleaseGoAdmission(
  sql: postgres.Sql | postgres.TransactionSql,
  releaseSha: string,
): Promise<string> {
  const suiteHash = hashCanonicalJson({ fixture: "v3-release-admission", releaseSha });
  const resultHash = hashCanonicalJson({ fixture: "v3-release-result", releaseSha });
  const gateHash = hashCanonicalJson({ fixture: "v3-release-gate", releaseSha, resultHash });
  const admission = createV3ReleaseAdmissionV1({
    schema: "setfarm.v3-release-admission.v1",
    kind: "release_go",
    releaseSha,
    suiteHash,
    result: { hash: resultHash, ref: convergenceArtifactRef(resultHash) },
    gate: { hash: gateHash, ref: convergenceArtifactRef(gateHash) },
    preflightHash: hashCanonicalJson({ fixture: "v3-release-preflight", releaseSha }),
    slots: [],
    issuedAt: "2026-07-13T00:00:00.000Z",
    expiresAt: null,
  });
  await sql.unsafe(
    `INSERT INTO v3_release_admissions (
       admission_hash, kind, release_sha, suite_hash,
       result_hash, result_ref, gate_hash, gate_ref,
       expires_at, payload, created_at
     ) VALUES ($1, 'release_go', $2, $3, $4, $5, $6, $7,
               NULL, $8::text::jsonb, $9)
     ON CONFLICT (admission_hash) DO NOTHING`,
    [
      admission.admissionHash,
      admission.releaseSha,
      admission.suiteHash,
      admission.result.hash,
      admission.result.ref,
      admission.gate.hash,
      admission.gate.ref,
      JSON.stringify(admission),
      admission.issuedAt,
    ],
  );
  return admission.admissionHash;
}

function adminUrl(): URL {
  const parsed = new URL(process.env.SETFARM_TEST_PG_ADMIN_URL || DEFAULT_ADMIN_URL);
  parsed.pathname = "/postgres";
  return parsed;
}

export async function createIsolatedTestDatabase(
  options: Readonly<{ migrate?: boolean }> = {},
) {
  const database = `setfarm_contract_spine_test_${process.pid}_${randomBytes(6).toString("hex")}`;
  assert.match(database, TEST_DATABASE_PATTERN);
  const admin = postgres(adminUrl().toString(), {
    max: 2,
    connect_timeout: 5,
    idle_timeout: 1,
    onnotice: () => {},
  });
  const operations: string[] = [];
  try {
    await admin`SELECT 1`;
    operations.push(`CREATE DATABASE ${database}`);
    await admin.unsafe(`CREATE DATABASE "${database}"`);
    process.stderr.write(`[execution-test-db] created ${database}\n`);
  } catch (error) {
    await admin.end({ timeout: 2 }).catch(() => {});
    throw new Error(`ISOLATED_POSTGRES_UNAVAILABLE: ${error instanceof Error ? error.message : String(error)}`);
  }

  const target = adminUrl();
  target.pathname = `/${database}`;
  process.env.SETFARM_PG_URL = target.toString();
  let db: typeof import("../../src/db-pg.js");
  let applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1:
    () => ReturnType<typeof applyBootstrapMainClaimHandoffGuardedMigration32V1>;
  let migrateIsolatedContractSpineV1: () => Promise<void>;
  try {
    db = await import(`../../src/db-pg.ts?execution-test=${database}`);
    db.pgConfigureIsolatedTestDatabase(target.toString());

    applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1 = async function () {
      if (arguments.length !== 0) {
        throw new TypeError("TEST_GUARDED_MIGRATION_32_ARGUMENTS_FORBIDDEN");
      }
      const fixtureHash = (name: string) => hashCanonicalJson({
        schema: "setfarm.test-guarded-migration-32-evidence-fact.v1",
        database,
        name,
      });
      const evidence = mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1({
          schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-evidence.v1",
          purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1",
          currentEntryOperationRef: `setfarm://tests/${database}/current-entry-operation`,
          currentEntryOperationHash: fixtureHash("current-entry-operation"),
          sealedSpawnerAdmissionRef: `setfarm://tests/${database}/sealed-spawner-admission`,
          sealedSpawnerAdmissionHash: fixtureHash("sealed-spawner-admission"),
          postPredecessorTerminationLegacyZeroOwnerObservationRef:
            `setfarm://tests/${database}/post-termination-zero-owner`,
          postPredecessorTerminationLegacyZeroOwnerObservationHash:
            fixtureHash("post-termination-zero-owner"),
          authorityV3Migration31AuditRef: `setfarm://tests/${database}/migration-31-audit`,
          authorityV3Migration31AuditHash: fixtureHash("migration-31-audit"),
          pendingBootstrapHandoffMigrationRef:
            `setfarm://tests/${database}/pending-guarded-migration-32`,
          pendingBootstrapHandoffMigrationHash: fixtureHash("pending-guarded-migration-32"),
          cleanSetfarmSourceSha: "a".repeat(40),
          cleanSetfarmTreeHash: "b".repeat(40),
          cleanSetfarmBuildHash: fixtureHash("clean-setfarm-build"),
          migrationSourceSha: "a".repeat(40),
          freshLegacyZeroOwnerObservationRef:
            `setfarm://tests/${database}/fresh-zero-owner`,
          freshLegacyZeroOwnerObservationHash: fixtureHash("fresh-zero-owner"),
          preManifestMigration32AuthorizationRef:
            `setfarm://tests/${database}/migration-32-authorization`,
          preManifestMigration32AuthorizationHash: fixtureHash("migration-32-authorization"),
          preManifestMigration32AuthorizationConsumptionRef:
            `setfarm://tests/${database}/migration-32-authorization-consumption`,
          preManifestMigration32AuthorizationConsumptionHash:
            fixtureHash("migration-32-authorization-consumption"),
      });
      await assert.rejects(
        applyBootstrapMainClaimHandoffGuardedMigration32V1(
          db.getSql(),
          { ...evidence } as typeof evidence,
        ),
        /rejects unauthenticated or cloned evidence/,
      );
      const result = await applyBootstrapMainClaimHandoffGuardedMigration32V1(
        db.getSql(),
        evidence,
      );
      const driftedEvidence = mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1({
        ...evidence,
        currentEntryOperationRef:
          `setfarm://tests/${database}/drifted-current-entry-operation`,
        currentEntryOperationHash: fixtureHash("drifted-current-entry-operation"),
      });
      await assert.rejects(
        applyBootstrapMainClaimHandoffGuardedMigration32V1(db.getSql(), driftedEvidence),
        /response-loss retry evidence differs from first application/,
      );
      return result;
    };

    migrateIsolatedContractSpineV1 = async function (): Promise<void> {
      const automatic = await applyContractSpineMigrations(db.getSql());
      assert.deepEqual(automatic.guardedPending, [
        "contract-spine-bootstrap-main-claim-handoff-v1",
      ]);
      await applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1();
      assert.equal((await verifyContractSpineMigrations(db.getSql())).status, "verified");
    };

    if (options.migrate !== false) {
      await migrateIsolatedContractSpineV1();
      await db.pgMigrate();
    }
    const connected = await db.getSql()<Array<{ current_database: string }>>`
      SELECT current_database() AS current_database
    `;
    assert.equal(connected[0]?.current_database, database);
  } catch (error) {
    await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${database} AND pid <> pg_backend_pid()`;
    await admin.unsafe(`DROP DATABASE "${database}"`);
    await admin.end({ timeout: 5 });
    throw error;
  }

  let cleaned = false;
  return {
    database,
    url: target.toString(),
    operations,
    sql: db.getSql(),
    db,
    applyBootstrapMainClaimHandoffGuardedMigration32ForTestV1,
    async insertRun(runId: string) {
      await db.pgRun(
        `INSERT INTO runs (
           id, workflow_id, task, status, protocol,
           compiler_release_sha, activation_preflight_hash
         ) VALUES ($1, 'feature-dev', 'contract test', 'running', 'shadow', $2, $3)`,
        [runId, "d".repeat(40), "e".repeat(64)],
      );
    },
    async seedV3ReleaseGoAdmission(releaseSha: string) {
      return seedV3ReleaseGoAdmission(db.getSql(), releaseSha);
    },
    async reset() {
      assert.match(database, TEST_DATABASE_PATTERN);
      await db.getSql().unsafe("DROP SCHEMA public CASCADE");
      await db.getSql().unsafe("CREATE SCHEMA public");
      await migrateIsolatedContractSpineV1();
      await db.pgMigrate();
    },
    async cleanup() {
      if (cleaned) return;
      cleaned = true;
      await db.pgClose();
      assert.match(database, TEST_DATABASE_PATTERN);
      await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${database} AND pid <> pg_backend_pid()`;
      operations.push(`DROP DATABASE ${database}`);
      await admin.unsafe(`DROP DATABASE "${database}"`);
      process.stderr.write(`[execution-test-db] dropped ${database}\n`);
      await admin.end({ timeout: 5 });
    },
  };
}
