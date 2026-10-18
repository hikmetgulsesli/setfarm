import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";
import {
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
} from "../../src/internal-production/owner-admission-v1.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { freshOwnerAuthorityDataV1 } from "./fresh-installation-owner-authority-data.js";

// SOURCE COMPONENT evidence only. The Map is deliberately seeded with parsed
// synthetic DATA, not with a successfully authenticated production authority.
// Actual PostgreSQL rows live solely in this connection's temporary namespace.
// No production immutable trigger is altered; no release/context verifier is
// replaced. Every case must refuse on the stored row before fresh admission.
type Cache = Map<string, InternalProductionOwnerProducerSourceBuildAuthorityV1>;
let componentDirectory: string | undefined;
let resolve: (sql: postgres.TransactionSql, pair: InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  cache: Cache) => Promise<InternalProductionOwnerProducerSourceBuildAuthorityV1>;

before(async () => {
  // Selection absence is a real captured guard in the component. This file is
  // not a selected-installation process and must not retarget an existing one.
  assert.equal(process.env.SETFARM_INSTALLATION_DIR, undefined,
    "cache component tests require an unselected process");
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const region = (startMarker: string, endMarker: string): string => {
    const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, "source component boundary missing");
    assert.equal(source.lastIndexOf(startMarker), start, "source component start is ambiguous");
    assert.equal(source.lastIndexOf(endMarker), end, "source component end is ambiguous");
    return source.slice(start, end);
  };
  const owner = new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url).href;
  const canonical = new URL("../../src/product-compiler/canonical-json.ts", import.meta.url).href;
  const selection = new URL("../../src/installation/fresh-installation-selection-v1.ts", import.meta.url).href;
  let dependencies = region("async function freshOwnerSourceContextV1(",
    "async function deriveCurrentOwnerProducerSourceAuthorityAForDatabaseV1(");
  // These are genuine modules, not replacement implementations. Retain the real
  // missing-context and unqualified-compiled-release refusal paths.
  for (const name of ["fresh-installation-activation-v1", "fresh-installation-owner-source-v1"]) {
    dependencies = dependencies.replaceAll(`"./installation/${name}.js"`,
      JSON.stringify(new URL(`../../src/installation/${name}.ts`, import.meta.url).href));
  }
  let resolver = region("async function resolveOwnerProducerSourceInTransactionV1(",
    "export async function resolveInternalProductionOwnerProducerSourceBuildAuthorityV1(");
  for (const [from, to] of [
    ["./internal-production/baseline-post-handoff-receipt-v1.js", "../../src/internal-production/baseline-post-handoff-receipt-v1.ts"],
    ["./internal-production/product-build-authority-v2-delivery-evidence-v1.js", "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts"],
    ["./execution/v3-git-revision.js", "../../src/execution/v3-git-revision.ts"],
  ] as const) resolver = resolver.replaceAll(JSON.stringify(from), JSON.stringify(new URL(to, import.meta.url).href));
  componentDirectory = await mkdtemp(path.join(tmpdir(), "sf-fresh-source-cache-component-"));
  const componentPath = path.join(componentDirectory, "source-cache.ts");
  await writeFile(componentPath, `
import type postgres from "postgres";
import type { PgTransactionSql as InternalProductionPgTransactionSql } from ${JSON.stringify(owner)};
import {
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
} from ${JSON.stringify(owner)};
import { canonicalJsonStringify } from ${JSON.stringify(canonical)};
import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from ${JSON.stringify(selection)};
${region("const _freshDatabaseV1 = {", "function requireSelectedFreshDatabaseV1(")}
${region("type OwnerProducerSourceRowV1 =", "type OwnerProducerActivationRowV1 =")}
type OwnerProducerSourceCacheV1 = Map<string, InternalProductionOwnerProducerSourceBuildAuthorityV1>;
${region("function strictCanonicalText(", "function exactObjectKeys(")}
${dependencies}
// Unused by these fresh-row negatives; retain the real legacy repository input.
const OWNER_PRODUCER_REPOSITORY_ROOT = ${JSON.stringify(fileURLToPath(new URL("../../", import.meta.url)))};
${resolver}
export { resolveOwnerProducerSourceInTransactionV1 as resolve };
`, { mode: 0o600 });
  ({ resolve } = await import(pathToFileURL(componentPath).href));
});

after(async () => {
  if (componentDirectory) await rm(componentDirectory, { recursive: true, force: true });
});

function loopbackMaintenanceUrl(): string {
  try {
    const url = new URL(process.env.SETFARM_TEST_PG_ADMIN_URL || "postgresql://postgres@127.0.0.1:5432/postgres");
    if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || url.pathname !== "/postgres" || !url.username || url.search || url.hash) throw new Error();
    return url.href;
  } catch { throw new Error("CACHE_COMPONENT_TEST_ADMIN_ENDPOINT_INVALID"); }
}

for (const variant of ["absent", "metadata", "canonical-text"] as const) {
  test(`fresh DATA cache cannot hide an actual PostgreSQL source row ${variant} change`,
    { timeout: 30_000 }, async () => {
      let sourceReads = 0;
      const sql = postgres(loopbackMaintenanceUrl(), {
        max: 1, connect_timeout: 3, idle_timeout: 2, onnotice() {},
        debug(_connection, query) {
          if (/\bFROM\s+internal_production_owner_producer_source_build_authorities_v1\b/i.test(query)) sourceReads++;
        },
      });
      try {
        await sql.begin(async transaction => {
          await transaction.unsafe("SET LOCAL statement_timeout='5000ms'");
          await transaction.unsafe("SET LOCAL lock_timeout='1000ms'");
          await transaction.unsafe("SET LOCAL idle_in_transaction_session_timeout='5000ms'");
          await transaction.unsafe("SET LOCAL search_path=pg_temp,pg_catalog");
          await transaction.unsafe(`CREATE TEMPORARY TABLE internal_production_owner_producer_source_build_authorities_v1 (
            source_build_authority_ref text NOT NULL,
            source_build_authority_hash text NOT NULL,
            plan text NOT NULL, manifest_hash text NOT NULL,
            owner_category_registry_hash text NOT NULL,
            owner_category_census_map_hash text NOT NULL, canonical_body text NOT NULL
          ) ON COMMIT DROP`);
          const authority = validateInternalProductionOwnerProducerSourceBuildAuthorityV1(freshOwnerAuthorityDataV1());
          assert.equal(authority.schema, "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1");
          const pair = { plan: "A" as const, sourceBuildAuthorityRef: authority.sourceBuildAuthorityRef,
            sourceBuildAuthorityHash: authority.sourceBuildAuthorityHash };
          const cache: Cache = new Map([[`${pair.plan}\0${pair.sourceBuildAuthorityRef}\0${pair.sourceBuildAuthorityHash}`, authority]]);
          await transaction.unsafe(`INSERT INTO pg_temp.internal_production_owner_producer_source_build_authorities_v1
            VALUES ($1,$2,$3,$4,$5,$6,$7)`, [authority.sourceBuildAuthorityRef, authority.sourceBuildAuthorityHash,
            authority.plan, authority.manifestHash, authority.ownerCategoryRegistryHash,
            authority.ownerCategoryCensusMapHash, canonicalJsonStringify(authority)]);
          if (variant === "absent") {
            await transaction.unsafe("DELETE FROM pg_temp.internal_production_owner_producer_source_build_authorities_v1");
          } else if (variant === "metadata") {
            await transaction.unsafe("UPDATE pg_temp.internal_production_owner_producer_source_build_authorities_v1 SET manifest_hash=repeat('f',64)");
          } else {
            await transaction.unsafe("UPDATE pg_temp.internal_production_owner_producer_source_build_authorities_v1 SET canonical_body='not-json'");
          }
          const before = sourceReads;
          await assert.rejects(resolve(transaction, pair, cache), {
            message: variant === "absent"
              ? "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_UNAVAILABLE"
              : "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION",
          });
          // This is an actual delegated PostgreSQL SELECT, not a mock call count.
          // It prevents a missing-context error from falsely satisfying the
          // corruption case while a stale cache skips the stored row entirely.
          assert.equal(sourceReads - before, 1, "fresh cached resolution must observe its actual stored row");
          assert.equal(cache.size, 1, "this test must retain the stale DATA cache");
        });
      } finally { await sql.end({ timeout: 3 }); }
    });
}
