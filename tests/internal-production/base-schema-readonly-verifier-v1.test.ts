import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { verifyOrdinaryBaseSchemaCatalogReadOnlyV1 } from "../../src/db/base-schema-readonly-verifier-v1.js";

test("normal internal-production pure suite includes the base catalog verifier", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["test:internal-production:pure"],
    /tests\/internal-production\/base-schema-readonly-verifier-v1\.test\.ts/);
});

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
  assert.equal(statements[0],
    "SELECT pg_catalog.set_config('search_path', 'pg_catalog, public, pg_temp', true)");
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
        : statement.includes("FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n")
          ? requiredTables.map((name) => ({ name, kind: "r", persistence: "p",
            accessMethod: "heap",
            tableOptions: null, toastOptions: null,
            replicaIdentity: "d",
            partitioned: false, rowSecurity: false, forceRowSecurity: false,
            hasInheritance: false, hasRewriteRules: false, ownerReachable: false }))
          : [],
    }),
  };

  await assert.rejects(
    verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql as never),
    /SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1/,
  );
});
