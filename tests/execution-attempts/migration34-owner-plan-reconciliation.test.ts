import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import ts from "typescript";
import {
  ContractSpineMigrationError, getContractSpineCurrentHeadJournalIdentitiesV1,
} from "../../src/db/contract-spine-migrations.js";
import { BootstrapMainClaimHandoffV1SchemaError } from "../../src/db/bootstrap-main-claim-handoff-v1-migration.js";

// Execute the complete production wrapper AND reconciler. Only SQL/catalog and
// current-owner provenance I/O are controlled here; no reconciled plan is faked.
// This component regression cannot qualify a real database owner-head proof.
const location = new URL("../../src/db/contract-spine-migrations.ts", import.meta.url);
const tree = ts.createSourceFile(location.pathname, readFileSync(location, "utf8"), ts.ScriptTarget.ESNext, true);
const names = ["applyContractSpineMigrationsIfNeeded", "reconcileCurrentOwnerAdmissionHeadMigrationPlanV1",
  "contractSpineMigrationPlanStatusV1", "isLockTimeout"];
const actualDeclarations = names.map(name => {
  const declaration = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `actual declaration ${name}`);
  return declaration.getText(tree).replace(/^export\s+/, "");
}).join("\n");
const compiled = ts.transpileModule(actualDeclarations, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

function fixture(options: { invalidOwner?: boolean; journalDrift?: boolean; unrelatedDrift?: boolean } = {}) {
  const definitions = getContractSpineCurrentHeadJournalIdentitiesV1();
  assert.equal(definitions.length, 34);
  const journal = definitions.map(definition => ({ ...definition, state: "applied" }));
  if (options.journalDrift) journal[31]!.checksum = "0".repeat(64);
  const rawPlan = { schema: "setfarm.contract-spine-migration-plan.v1", status: "drift",
    migrations: definitions.map(definition => ({ ...definition,
      state: definition.version === 32 ? "adoption_mismatch"
        : options.unrelatedDrift && definition.version === 33 ? "checksum_mismatch" : "applied" })) };
  const observed = { provenance: 0, finalOwnership: 0, finalJournal: 0, sql: [] as string[] };
  const transaction = { unsafe: async (statement: string) => {
    observed.sql.push(statement);
    assert.ok(statement.startsWith("SELECT set_config(") || statement.startsWith("SELECT pg_advisory_xact_lock("),
      `Unexpected effect or query in current34 fixture: ${statement}`);
    return [];
  } };
  const sameTransaction = (value: unknown) => { assert.equal(value, transaction); };
  const ports = {
    ContractSpineMigrationError, BootstrapMainClaimHandoffV1SchemaError,
    contractSpineMigrationLockKey: 1234,
    completeMigrations: definitions.slice(0, 33), currentMigrationsV34: definitions,
    checksum: (definition: typeof definitions[number]) => definition.checksum,
    completeJournalRows: async (value: unknown) => { sameTransaction(value); return structuredClone(journal); },
    planContractSpineMigrationsOnConnectionV34: async (value: unknown) => { sameTransaction(value); return structuredClone(rawPlan); },
    detectRegisteredMigrationAtCurrentSupportedHeadV31: async (definition: typeof definitions[number], value: unknown) => {
      sameTransaction(value); assert.equal(definition.version, 32); return "present";
    },
    verifyCurrentBootstrapMainClaimHandoffGuardedMigration32ApplicationProvenance: async (value: unknown) => {
      sameTransaction(value); await Promise.resolve(); observed.provenance += 1;
      if (options.invalidOwner) throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "Invalid current owner provenance");
    },
    verifyRegisteredMigrationAtCurrentSupportedHeadV31: async (definition: typeof definitions[number], value: unknown) => {
      sameTransaction(value); assert.equal(definition.version, 32);
    },
    verifyCurrentContractSpineObjectOwnershipAtCurrentSupportedHeadV34: async (value: unknown) => {
      sameTransaction(value); assert.equal(observed.provenance, 1); observed.finalOwnership += 1;
    },
    verifyExactContractSpineJournalAuthority: async (value: unknown) => {
      sameTransaction(value); assert.equal(observed.finalOwnership, 1); observed.finalJournal += 1;
    },
  };
  const apply = new Function("ports", `const {${Object.keys(ports).join(",")}}=ports;\n${compiled}\nreturn applyContractSpineMigrationsIfNeeded;`)(ports) as
    (sql: unknown) => Promise<{ alreadyApplied: readonly string[]; applied: readonly string[] }>;
  const sql = { begin: async (body: (value: unknown) => Promise<unknown>) => body(transaction) };
  return { apply: () => apply(sql), observed, definitions };
}

it("migration34 current wrapper reconciles legitimate current-owner provenance before its status guard", async () => {
  const value = fixture();
  const result = await value.apply();
  assert.deepEqual(result.applied, []);
  assert.equal(result.alreadyApplied.length, 34);
  assert.equal(result.alreadyApplied[33], "034_operational_failure_cause_authority_v4");
  assert.equal(value.observed.provenance, 1);
  assert.equal(value.observed.finalOwnership, 1);
  assert.equal(value.observed.finalJournal, 1);
});

it("migration34 current wrapper refuses invalid current-owner provenance", async () => {
  const value = fixture({ invalidOwner: true });
  await assert.rejects(value.apply(), (error: unknown) => error instanceof ContractSpineMigrationError
    && error.code === "MIGRATION_ADOPTION_MISMATCH");
  assert.equal(value.observed.finalOwnership, 0);
  assert.equal(value.observed.finalJournal, 0);
});

it("migration34 current wrapper cannot reconcile a changed migration32 journal identity", async () => {
  const value = fixture({ journalDrift: true });
  await assert.rejects(value.apply(), (error: unknown) => error instanceof ContractSpineMigrationError
    && error.code === "MIGRATION_ADOPTION_MISMATCH");
  assert.equal(value.observed.provenance, 0);
  assert.equal(value.observed.finalOwnership, 0);
});

it("migration34 current wrapper retains unrelated drift after owner-plan reconciliation", async () => {
  const value = fixture({ unrelatedDrift: true });
  await assert.rejects(value.apply(), (error: unknown) => error instanceof ContractSpineMigrationError
    && error.code === "MIGRATION_ADOPTION_MISMATCH");
  assert.equal(value.observed.finalOwnership, 0);
  assert.equal(value.observed.finalJournal, 0);
});
