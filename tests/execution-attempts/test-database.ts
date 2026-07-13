import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import postgres from "postgres";

const TEST_DATABASE_PATTERN = /^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/;
const DEFAULT_ADMIN_URL = "postgresql://postgres@localhost:5432/postgres";

export type TestDatabase = Awaited<ReturnType<typeof createIsolatedTestDatabase>>;

function adminUrl(): URL {
  const parsed = new URL(process.env.SETFARM_TEST_PG_ADMIN_URL || DEFAULT_ADMIN_URL);
  parsed.pathname = "/postgres";
  return parsed;
}

export async function createIsolatedTestDatabase() {
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
    await db.pgMigrate();
  } catch (error) {
    await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${database} AND pid <> pg_backend_pid()`;
    await admin.unsafe(`DROP DATABASE "${database}"`);
    await admin.end({ timeout: 5 });
    throw error;
  }

  let cleaned = false;
  return {
    database,
    operations,
    sql: db.getSql(),
    db,
    async insertRun(runId: string) {
      await db.pgRun(
        "INSERT INTO runs (id, workflow_id, task, status) VALUES ($1, 'feature-dev', 'contract test', 'running')",
        [runId],
      );
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
