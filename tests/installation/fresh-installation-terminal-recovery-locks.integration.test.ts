import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

// Genuine schema-only restricted PG components; no admission, activation or
// terminal owner authority is fabricated. Root supplies the isolated endpoint.
test("fresh restricted runtime locks the actual empty recovery chain and settles no recovery owners", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const fixture = await freshSourceCheckoutFixture();
  const load = (relative: string) => import(pathToFileURL(path.join(fixture.root, relative)).href);
  const protection = await load("src/installation/fresh-installation-provenance-v1.ts");
  const business = await load("src/installation/fresh-installation-runtime-grants-v1.ts");
  const recovery = await load("src/recovery/v3-terminal-recovery-chain.ts");
  const endpoint = new URL(freshTestAdminUrl); endpoint.pathname = "/" + installation.databaseName;
  const control = postgres(endpoint.href, { max: 1, connect_timeout: 3, onnotice() {} });
  let runtime: ReturnType<typeof postgres> | undefined;
  try {
    await control.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
      await protection.installFreshInstallationProvenanceProtectionV1(tx, installation.runtimeRole);
      await business.installFreshInstallationRuntimeBusinessGrantsV1(tx, installation.runtimeRole);
    });
    const credential = JSON.parse(readFileSync(path.join(installation.directory, "runtime-credentials.json"), "utf8"));
    runtime = postgres(credential.runtimeUrl, { max: 1, connect_timeout: 3, onnotice() {} });
    const runId = "component-terminal-recovery-empty";
    // Default-protocol component row only. Calling the actual V3 helper here
    // proves its PG lock rights; it does not fabricate public V3 admission.
    await runtime`INSERT INTO runs(id,workflow_id,task) VALUES(${runId},'component','recovery lock component')`;
    await runtime.begin(async tx => {
      await tx`SELECT id FROM runs WHERE id=${runId} FOR UPDATE`;
      const snapshot = await recovery.lockV3TerminalRecoveryChainInTransaction(tx, runId);
      assert.equal(Object.isFrozen(snapshot), true);
      assert.equal(snapshot.deliveries.length, 0);
      assert.equal(snapshot.cases.length, 0);
      for (const status of ["failed", "cancelled", "completed"] as const) {
        const result = await recovery.settleV3TerminalRecoveryChainInTransaction(tx, {
          runId, status, diagnostic: "component only", transitionTime: new Date(), snapshot,
        });
        assert.equal(Object.isFrozen(result), true);
        assert.deepEqual(result, { closedDeliveries: 0, closedRecoveryCases: 0, decisionRefs: [] });
      }
    });
    assert.equal((await runtime`SELECT status FROM runs WHERE id=${runId}`)[0]!.status, "running");
  } finally {
    await runtime?.end({ timeout: 3 });
    await control.end({ timeout: 3 });
  }
});
