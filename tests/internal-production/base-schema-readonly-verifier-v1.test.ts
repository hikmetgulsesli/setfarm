import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyOrdinaryBaseSchemaCatalogReadOnlyV1 } from "../../src/db/base-schema-readonly-verifier-v1.js";

test("base catalog verification refuses an empty catalog in a bounded read-only transaction", async () => {
  const statements: string[] = [];
  const sql = {
    begin: async (mode: string, operation: (transaction: unknown) => Promise<void>) => {
      assert.equal(mode, "isolation level repeatable read read only");
      return operation({
        unsafe: async (statement: string) => {
          statements.push(statement);
          return statement.includes("has_database_privilege")
            ? [{ database: true, schema: true }]
            : [];
        },
      });
    },
  };

  await assert.rejects(
    verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql as never),
    /SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1/,
  );
  assert.ok(statements.some((statement) => statement.includes("lock_timeout")));
  assert.ok(statements.some((statement) => statement.includes("statement_timeout")));
  assert.ok(statements.some((statement) => statement.includes("idle_in_transaction_session_timeout")));
  assert.ok(statements.some((statement) => statement.includes("search_path")));
  assert.ok(statements.some((statement) => statement.includes("pg_class")));
  assert.ok(statements.every((statement) => !/\b(?:CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i.test(statement)));
});

test("database errors are reduced to one fixed catalog mismatch code", async () => {
  const sql = { begin: async () => { throw new Error("postgresql://secret@example.invalid/private"); } };
  await assert.rejects(
    verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql as never),
    (error: unknown) => error instanceof Error
      && error.message === "SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1"
      && !String(error).includes("secret"),
  );
});

test("base catalog verification refuses required tables with no required columns", async () => {
  const requiredTables = ["claim_log", "medic_checks", "rules", "run_observations", "runs", "steps", "stories"];
  const sql = {
    begin: async (_mode: string, operation: (transaction: unknown) => Promise<void>) => operation({
      unsafe: async (statement: string) => statement.includes("has_database_privilege")
        ? [{ database: true, schema: true }]
        : statement.includes("FROM pg_class c JOIN pg_namespace n")
          ? requiredTables.map((name) => ({ name, kind: "r", persistence: "p",
            partitioned: false, rowSecurity: false, forceRowSecurity: false }))
          : [],
    }),
  };

  await assert.rejects(
    verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql as never),
    /SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1/,
  );
});
