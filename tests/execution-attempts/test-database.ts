import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import postgres from "postgres";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  convergenceArtifactRef,
  createV3ReleaseAdmissionV1,
} from "../../src/execution/v3-release-admission.js";

const TEST_DATABASE_PATTERN = /^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/;
const DEFAULT_ADMIN_URL = "postgresql://postgres@localhost:5432/postgres";

export type TestDatabase = Awaited<ReturnType<typeof createIsolatedTestDatabase>>;

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
  try {
    db = await import(`../../src/db-pg.ts?execution-test=${database}`);
    db.pgConfigureIsolatedTestDatabase(target.toString());
    if (options.migrate !== false) {
      await db.pgMigrate({ contractSpineMode: "apply" });
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
      await db.pgMigrate({ contractSpineMode: "apply" });
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
