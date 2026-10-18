import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { DEFAULT_ARTIFACT_CAPACITY_LIMITS } from "../../src/product-compiler/artifact-capacity.js";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";

// Ordinary owned-PG component tests. No finalized-build, activation, workflow,
// standalone/hybrid deployment, or legacy readiness authority is fabricated.
async function api() {
  return import("../../src/installation/fresh-installation-artifact-bootstrap-v1.js");
}
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

test("fresh empty artifact bootstrap uses the owner transaction and outer rollback", { timeout: 120_000 }, async t => {
  const installation = await create(t); await installation.initialize();
  const component = await api();
  const endpoint = new URL(freshTestAdminUrl); endpoint.pathname = "/" + installation.databaseName;
  const owner = postgres(endpoint.href, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    await assert.rejects(owner.begin(async transaction => {
      await transaction.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      await component.installFreshInstallationEmptyArtifactIndexV1(transaction, installation.directory);
      assert.equal((await transaction.unsafe("SELECT state FROM public.artifact_capacity"))[0]?.state, "ready");
      throw new Error("outer-owner-rollback");
    }), /outer-owner-rollback/);
    const rolledBack = await owner.unsafe("SELECT state,total_bytes::text,reserved_bytes::text,reconciled_at FROM public.artifact_capacity");
    assert.equal(rolledBack[0]?.state, "bootstrap_required");
    assert.equal(rolledBack[0]?.total_bytes, "0"); assert.equal(rolledBack[0]?.reserved_bytes, "0");
    assert.equal(rolledBack[0]?.reconciled_at, null);
    await owner.begin(async transaction => {
      await transaction.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      await component.installFreshInstallationEmptyArtifactIndexV1(transaction, installation.directory);
    });
    const ready = await owner.unsafe("SELECT state,quota_bytes::text,max_payload_bytes::text,total_bytes::text,reserved_bytes::text,reconciled_at IS NOT NULL AS reconciled FROM public.artifact_capacity");
    assert.equal(ready[0]?.state, "ready"); assert.equal(ready[0]?.reconciled, true);
    assert.equal(ready[0]?.quota_bytes, String(DEFAULT_ARTIFACT_CAPACITY_LIMITS.rootQuotaBytes));
    assert.equal(ready[0]?.max_payload_bytes, String(DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes));
    assert.equal(ready[0]?.total_bytes, "0"); assert.equal(ready[0]?.reserved_bytes, "0");
    await assert.rejects(owner.begin(async transaction => {
      await transaction.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      await component.installFreshInstallationEmptyArtifactIndexV1(transaction, installation.directory);
    }), /FRESH_INSTALLATION_ARTIFACT_BOOTSTRAP_REFUSED/);
    const protection = await import("../../src/installation/fresh-installation-provenance-v1.js");
    const grants = await import("../../src/installation/fresh-installation-runtime-grants-v1.js");
    await owner.begin(async transaction => {
      await transaction.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      await protection.installFreshInstallationProvenanceProtectionV1(transaction, installation.runtimeRole);
      await grants.installFreshInstallationRuntimeBusinessGrantsV1(transaction, installation.runtimeRole);
    });
    const credential = JSON.parse(readFileSync(path.join(installation.directory, "runtime-credentials.json"), "utf8"));
    const runtime = postgres(credential.runtimeUrl, { max: 1, connect_timeout: 3, onnotice() {} });
    try {
      for (const column of ["quota_bytes", "max_payload_bytes"]) {
        await assert.rejects(runtime.unsafe(`UPDATE public.artifact_capacity SET ${column}=${column}`), { code: "42501" });
      }
    } finally { await runtime.end({ timeout: 3 }); }
  } finally { await owner.end({ timeout: 3 }); }
});

test("fresh artifact bootstrap refuses existing filesystem data and a runtime caller", { timeout: 120_000 }, async t => {
  const installation = await create(t); await installation.initialize();
  const component = await api();
  const endpoint = new URL(freshTestAdminUrl); endpoint.pathname = "/" + installation.databaseName;
  const owner = postgres(endpoint.href, { max: 1, connect_timeout: 3, onnotice() {} });
  const artifactRoot = path.join(installation.directory, "runtime", "product-compiler", "artifacts", "sha256");
  const credential = JSON.parse(readFileSync(path.join(installation.directory, "runtime-credentials.json"), "utf8"));
  const runtime = postgres(credential.runtimeUrl, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    await assert.rejects(runtime.begin(transaction => component.installFreshInstallationEmptyArtifactIndexV1(transaction, installation.directory)),
      /FRESH_INSTALLATION_ARTIFACT_BOOTSTRAP_REFUSED/);
    let directory = installation.directory;
    for (const part of ["runtime", "product-compiler", "artifacts", "sha256"]) {
      directory = path.join(directory, part); mkdirSync(directory, { mode: 0o700 });
    }
    writeFileSync(path.join(artifactRoot, "existing-data"), "preserve-me", { mode: 0o600 });
    await assert.rejects(owner.begin(async transaction => {
      await transaction.unsafe(`SET LOCAL ROLE ${quote(installation.ownerRole)}`);
      await component.installFreshInstallationEmptyArtifactIndexV1(transaction, installation.directory);
    }), /FRESH_INSTALLATION_ARTIFACT_BOOTSTRAP_REFUSED/);
    assert.equal(readFileSync(path.join(artifactRoot, "existing-data"), "utf8"), "preserve-me");
    assert.equal((await owner.unsafe("SELECT state FROM public.artifact_capacity"))[0]?.state, "bootstrap_required");
  } finally { await runtime.end({ timeout: 3 }); await owner.end({ timeout: 3 }); }
});
