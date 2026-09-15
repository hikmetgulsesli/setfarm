import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  cpSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

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
import { observeLegacyFindingPublicationInventoryV1 } from "../../src/findings/finding-publication-v1.js";
import { validateLegacyFindingPublicationInventoryV1, type LegacyFindingPublicationInventoryV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import {
  convergenceArtifactRef,
  createV3ReleaseAdmissionV1,
} from "../../src/execution/v3-release-admission.js";

const TEST_DATABASE_PATTERN = /^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/;
const P3_DATABASE_PATTERN = /^setfarm_p3_[a-f0-9]{24}_(?:template|primary|clone_[a-f0-9]{12}|empty_[a-f0-9]{12})$/;
const DEFAULT_ADMIN_URL = "postgresql://postgres@localhost:5432/postgres";
const P3_FIXTURE_SOURCE_ROOT = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const P3_READINESS_SHADOW_PATH_V1 = fileURLToPath(new URL(
  "../../src/internal-production/baseline-spawner-startup-admission-v1.js",
  import.meta.url,
));
const P3_READINESS_SHADOW_MODULE_SPECIFIER_V1 = "../../src/internal-production/baseline-spawner-startup-admission-v1.js";
const P3_READINESS_SHADOW_MODULE_HREF_V1 = pathToFileURL(P3_READINESS_SHADOW_PATH_V1).href;
const P3_READINESS_SHADOW_TEST_DATABASE_IMPORT_V1 = "../../tests/execution-attempts/test-database.ts";
const P3_READINESS_SHADOW_DB_IMPORT_V1 = "../../src/db-pg.ts?p3-readiness=";
const P3_READINESS_SHADOW_MAX_BYTES_V1 = 65_536;
const P3_READINESS_SHADOW_HOOK_SOURCE_V1 = `
let targetUrl;
let source;

export function initialize(data) {
  if (
    data === null
    || typeof data !== "object"
    || JSON.stringify(Reflect.ownKeys(data)) !== JSON.stringify(["targetUrl", "source"])
    || typeof data.targetUrl !== "string"
    || !(data.source instanceof Uint8Array)
  ) {
    throw new Error("P3_READINESS_SHADOW_HOOK_DATA_INVALID");
  }
  targetUrl = data.targetUrl;
  source = Uint8Array.from(data.source);
}

export async function resolve(specifier, context, nextResolve) {
  let matchesTarget = false;
  if (typeof context.parentURL === "string") {
    try {
      const parent = new URL(context.parentURL);
      parent.search = "";
      parent.hash = "";
      const helperUrl = new URL("../../tests/execution-attempts/test-database.ts", targetUrl).href;
      const databaseUrl = new URL("../db-pg.ts", targetUrl).href;
      const isHelper = parent.href === helperUrl;
      const isDatabase = parent.href === databaseUrl;
      const literalMatches =
        (isHelper && specifier === "../../src/internal-production/baseline-spawner-startup-admission-v1.js")
        || (isDatabase && specifier === "./internal-production/baseline-spawner-startup-admission-v1.js");
      const tsxSubstitutedTargetUrl = targetUrl.slice(0, -3) + ".ts";
      const substitutedLiteralMatches =
        (isHelper && specifier === "../../src/internal-production/baseline-spawner-startup-admission-v1.ts")
        || (isDatabase && specifier === "./internal-production/baseline-spawner-startup-admission-v1.ts");
      const substitutedMatches =
        (isHelper || isDatabase)
        && (specifier === targetUrl || specifier === tsxSubstitutedTargetUrl);
      matchesTarget = literalMatches
        || (substitutedLiteralMatches
          && new URL(specifier, context.parentURL).href === tsxSubstitutedTargetUrl)
        || substitutedMatches;
    } catch {}
  }
  if (matchesTarget) return { url: targetUrl, format: "module", shortCircuit: true };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === targetUrl) return { format: "module", source, shortCircuit: true };
  return nextLoad(url, context);
}
`;
const P3_DELIVERED_PATHS = [
  "server/routes/setfarm-operational.test.ts",
  "server/routes/setfarm-operational.ts",
  "server/services/setfarm-product-build-authority.ts",
  "server/services/setfarm-product-build-authority.test.ts",
  "src/lib/product-build-authority.ts",
  "src/components/run-detail/ProductBuildAuthority.tsx",
  "tests/product-build-authority-render.test.tsx",
  "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
] as const;
const P3_VENDOR_ARTIFACTS = [
  "run-operational-snapshot.v1.compatibility.json",
  "run-operational-snapshot.v1.schema.json",
  "run-operational-snapshot.v2.compatibility.json",
  "run-operational-snapshot.v2.schema.json",
  "run-operational-snapshot.v3.compatibility.json",
  "run-operational-snapshot.v3.schema.json",
  "deployment-observation.v1.compatibility.json",
  "deployment-observation.v1.schema.json",
  "project-transfer-ack.v1.compatibility.json",
  "project-transfer-ack.v1.schema.json",
  "operational-active-run-status.v1.compatibility.json",
  "operational-active-run-status.v1.schema.json",
] as const;

type P3ProjectionMarkerV1 = Readonly<{
  schema: "setfarm.p3-isolated-projection-marker.v1";
  projectionRoot: string;
  projectedHead: string;
  runDatabasePrefix: string;
  templateDatabaseName: string;
  adminUrlSha256: string;
  setupNonceSha256: string;
  testNonceSha256: string;
}>;

let cachedCapabilityRoleV1: "setup" | "test" | null = null;
let p3ReadinessShadowHookRegisteredV1 = false;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function readP3MarkerV1(): P3ProjectionMarkerV1 {
  const root = realpathSync(process.cwd());
  if (root !== P3_FIXTURE_SOURCE_ROOT) {
    throw new Error("P3_PROJECTION_MODULE_ROOT_INVALID");
  }
  const markerPath = path.join(root, ".setfarm-p3-projection-marker.json");
  const markerStat = lstatSync(markerPath);
  assert.equal(markerStat.isFile() && !markerStat.isSymbolicLink(), true);
  assert.equal(markerStat.mode & 0o777, 0o600);
  assert.equal(markerStat.nlink, 1);
  const markerBytes = readFileSync(markerPath, "utf8");
  const value = JSON.parse(markerBytes) as Record<string, unknown>;
  assert.deepEqual(Reflect.ownKeys(value), [
    "schema", "projectionRoot", "projectedHead", "runDatabasePrefix",
    "templateDatabaseName", "adminUrlSha256", "setupNonceSha256", "testNonceSha256",
  ]);
  assert.equal(value.schema, "setfarm.p3-isolated-projection-marker.v1");
  assert.equal(value.projectionRoot, root);
  assert.equal(value.projectedHead, execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim());
  assert.match(String(value.runDatabasePrefix), /^setfarm_p3_[a-f0-9]{24}$/);
  assert.equal(value.templateDatabaseName, `${value.runDatabasePrefix}_template`);
  for (const key of ["adminUrlSha256", "setupNonceSha256", "testNonceSha256"] as const) {
    assert.match(String(value[key]), /^[a-f0-9]{64}$/);
  }
  if (value.setupNonceSha256 === value.testNonceSha256) {
    throw new Error("P3_PROJECTION_CAPABILITY_NONCES_INVALID");
  }
  assert.equal(markerBytes, `${JSON.stringify(value)}\n`);
  return Object.freeze(value as P3ProjectionMarkerV1);
}

function readAuthenticateAndCloseFd3ExactlyOnceV1(): Readonly<{ role: "setup" | "test"; marker: P3ProjectionMarkerV1 }> {
  if (cachedCapabilityRoleV1 !== null) throw new Error("P3_PROJECTION_CAPABILITY_REPLAYED");
  const marker = readP3MarkerV1();
  let frame: Buffer;
  try {
    frame = readFileSync(3);
  } finally {
    closeSync(3);
  }
  const match = /^SETFARM_P3_PROJECTION_CAPABILITY_V1:(setup|test):([a-f0-9]{64})\n$/.exec(frame.toString("ascii"));
  if (!match) throw new Error("P3_PROJECTION_CAPABILITY_INVALID");
  const role = match[1] as "setup" | "test";
  const expectedHash = role === "setup" ? marker.setupNonceSha256 : marker.testNonceSha256;
  if (sha256(Buffer.from(match[2]!, "hex")) !== expectedHash) {
    throw new Error("P3_PROJECTION_CAPABILITY_INVALID");
  }
  const normalizedAdmin = adminUrl().toString();
  if (sha256(normalizedAdmin) !== marker.adminUrlSha256) {
    throw new Error("P3_PROJECTION_ADMIN_URL_INVALID");
  }
  cachedCapabilityRoleV1 = role;
  return Object.freeze({ role, marker });
}

export function authenticateP3ProjectedReadinessTestCapabilityV1(): void {
  if (cachedCapabilityRoleV1 === null) {
    readAuthenticateAndCloseFd3ExactlyOnceV1();
  }
  assert.equal(cachedCapabilityRoleV1, "test");
  installP3ReadinessShadowHookV1();
}

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

function assertRecursivelyFrozenV1(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const nested of Object.values(value)) assertRecursivelyFrozenV1(nested);
}

function readStableP3ReadinessShadowV1(): Buffer {
  const descriptor = openSync(
    P3_READINESS_SHADOW_PATH_V1,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const beforeDescriptor = fstatSync(descriptor, { bigint: true });
    const beforePath = lstatSync(P3_READINESS_SHADOW_PATH_V1, { bigint: true });
    for (const observed of [beforeDescriptor, beforePath]) {
      assert.equal(observed.isFile() && !observed.isSymbolicLink(), true);
      assert.equal(observed.mode & 0o777n, 0o600n);
      assert.equal(observed.nlink, 1n);
      assert.ok(observed.size > 0n && observed.size <= BigInt(P3_READINESS_SHADOW_MAX_BYTES_V1));
    }
    for (const key of ["dev", "ino", "mode", "nlink", "size", "mtimeNs", "ctimeNs"] as const) {
      assert.equal(beforeDescriptor[key], beforePath[key]);
    }
    const bytes = readFileSync(descriptor);
    const afterDescriptor = fstatSync(descriptor, { bigint: true });
    const afterPath = lstatSync(P3_READINESS_SHADOW_PATH_V1, { bigint: true });
    for (const key of ["dev", "ino", "mode", "nlink", "size", "mtimeNs", "ctimeNs"] as const) {
      assert.equal(afterDescriptor[key], beforeDescriptor[key]);
      assert.equal(afterPath[key], beforePath[key]);
      assert.equal(afterDescriptor[key], afterPath[key]);
    }
    assert.equal(BigInt(bytes.length), beforeDescriptor.size);
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function installP3ReadinessShadowHookV1(): void {
  if (p3ReadinessShadowHookRegisteredV1) return;
  const authenticatedBytes = readStableP3ReadinessShadowV1();
  const source = authenticatedBytes.toString("utf8");
  assert.deepEqual(Buffer.from(source, "utf8"), authenticatedBytes);
  assert.equal(source.match(/\bimport\b/g)?.length, 2);
  const importInventory = [
    ...source.matchAll(/\bfrom\s+(["'])([^"']+)\1/g),
    ...source.matchAll(/\bimport\(\s*(["'])([^"']+)\1/g),
  ].map((match) => match[2]);
  assert.deepEqual(importInventory, [
    P3_READINESS_SHADOW_TEST_DATABASE_IMPORT_V1,
    P3_READINESS_SHADOW_DB_IMPORT_V1,
  ]);
  for (const literal of importInventory) {
    assert.equal(source.split(literal!).length - 1, 1);
  }
  const hookUrl = `data:text/javascript;base64,${Buffer.from(P3_READINESS_SHADOW_HOOK_SOURCE_V1).toString("base64")}#${sha256(P3_READINESS_SHADOW_HOOK_SOURCE_V1)}`;
  register(hookUrl, {
    parentURL: import.meta.url,
    data: Object.freeze({
      targetUrl: P3_READINESS_SHADOW_MODULE_HREF_V1,
      source: Uint8Array.from(authenticatedBytes),
    }),
  });
  p3ReadinessShadowHookRegisteredV1 = true;
}

async function importP3ReadinessShadowV1(): Promise<Record<string, unknown>> {
  authenticateP3ProjectedReadinessTestCapabilityV1();
  return import(P3_READINESS_SHADOW_MODULE_SPECIFIER_V1) as Promise<Record<string, unknown>>;
}

async function verifyP3ActivatedCloneV1(
  db: typeof import("../../src/db-pg.js"),
): Promise<void> {
  const current = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
  assert.ok(current);
  assert.equal(current.receipt.phase, "A");
  assert.deepEqual(current.receipt.orderedPlans, ["A"]);
  const readiness = await importP3ReadinessShadowV1();
  assert.deepEqual(Object.keys(readiness).sort(), [
    "observeInternalProductionPreSchemaSpawnerRebindStatusV1",
    "resolveInternalProductionTask0SpawnerAdmissionReadyV1",
  ]);
  assert.equal(readiness.observeInternalProductionPreSchemaSpawnerRebindStatusV1.length, 0);
  assert.equal(readiness.resolveInternalProductionTask0SpawnerAdmissionReadyV1.length, 1);
  const status = await readiness.observeInternalProductionPreSchemaSpawnerRebindStatusV1();
  assertRecursivelyFrozenV1(status);
  assert.equal(status.state, "normal_task0_admission_ready");
  const ready = await readiness.resolveInternalProductionTask0SpawnerAdmissionReadyV1(
    { admissionReadyRef: status.admissionReady.admissionReadyRef, admissionReadyHash: status.admissionReady.admissionReadyHash },
  );
  assertRecursivelyFrozenV1(ready);
  assert.deepEqual({
    activationRef: ready.manifestActivationRef,
    activationHash: ready.manifestActivationHash,
    headRef: ready.manifestHeadRef,
    headHash: ready.manifestHeadHash,
  }, {
    activationRef: current.receipt.activationRef,
    activationHash: current.receipt.activationHash,
    headRef: current.head.headRef,
    headHash: current.head.headHash,
  });
}

async function verifyP3ReadinessUnavailableV1(): Promise<void> {
  const readiness = await importP3ReadinessShadowV1();
  assert.deepEqual(Object.keys(readiness).sort(), [
    "observeInternalProductionPreSchemaSpawnerRebindStatusV1",
    "resolveInternalProductionTask0SpawnerAdmissionReadyV1",
  ]);
  const observe = readiness.observeInternalProductionPreSchemaSpawnerRebindStatusV1 as () => Promise<unknown>;
  const resolve = readiness.resolveInternalProductionTask0SpawnerAdmissionReadyV1 as (pair: unknown) => Promise<unknown>;
  assert.equal(observe.length, 0);
  assert.equal(resolve.length, 1);
  await assert.rejects(observe(), /P3_PROJECTED_READINESS_DATABASE_INVALID/);
  await assert.rejects(resolve({
    admissionReadyRef: `setfarm://tests/p3/admission-ready/sha256/${"0".repeat(64)}`,
    admissionReadyHash: "0".repeat(64),
  }), /P3_PROJECTED_READINESS_DATABASE_INVALID/);
}

export async function createIsolatedTestDatabase(
  options: Readonly<{ migrate?: boolean }> = {},
) {
  const projectionMarkerPath = path.join(realpathSync(process.cwd()), ".setfarm-p3-projection-marker.json");
  const projectionMarkerPresent = existsSync(projectionMarkerPath);
  if (
    cachedCapabilityRoleV1 === null
    && projectionMarkerPresent
  ) {
    authenticateP3ProjectedReadinessTestCapabilityV1();
  }
  if (cachedCapabilityRoleV1 === null && !projectionMarkerPresent) {
    const selectedDatabaseUrl = process.env.SETFARM_PG_URL;
    if (selectedDatabaseUrl !== undefined) {
      let selectedDatabaseName = "";
      try {
        const parsed = new URL(selectedDatabaseUrl);
        selectedDatabaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      } catch {}
      if (P3_DATABASE_PATTERN.test(selectedDatabaseName)) throw new Error("P3_PROJECTION_MARKER_REQUIRED");
    }
  }
  const marker = cachedCapabilityRoleV1 === "test" ? readP3MarkerV1() : null;
  const database = marker === null
    ? `setfarm_contract_spine_test_${process.pid}_${randomBytes(6).toString("hex")}`
    : `${marker.runDatabasePrefix}_${options.migrate === false ? "empty" : "clone"}_${randomBytes(6).toString("hex")}`;
  assert.match(database, marker === null ? TEST_DATABASE_PATTERN : P3_DATABASE_PATTERN);
  const admin = postgres(adminUrl().toString(), {
    max: 2,
    connect_timeout: 5,
    idle_timeout: 1,
    onnotice: () => {},
  });
  const operations: string[] = [];
  try {
    await admin`SELECT 1`;
    if (marker !== null && options.migrate !== false) {
      operations.push(`CREATE DATABASE ${database} TEMPLATE ${marker.templateDatabaseName}`);
      await admin.unsafe(
        `CREATE DATABASE "${database}" TEMPLATE "${marker.templateDatabaseName}"`,
      );
      process.stderr.write(
        `[execution-test-db] cloned ${database} from ${marker.templateDatabaseName}\n`,
      );
    } else {
      operations.push(`CREATE DATABASE ${database}`);
      await admin.unsafe(`CREATE DATABASE "${database}"`);
      process.stderr.write(`[execution-test-db] created ${database}\n`);
    }
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
      const p3Operation = marker === null ? null : await (await import("../../src/internal-production/baseline-post-handoff-receipt-v1.js")).observePreparedInternalProductionCurrentEntryOperationV1();
      if (marker !== null && p3Operation === null) throw new Error("P3_MIGRATION_PROVENANCE_OPERATION_MISSING");
      const evidence = mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1(marker !== null && p3Operation !== null
        ? createP3LegacyMigrationProvenanceV1(p3Operation, marker.templateDatabaseName).evidence
        : {
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
      const successor = await applyContractSpineMigrations(db.getSql());
      assert.deepEqual(successor.guardedPending, []);
      assert.equal((await verifyContractSpineMigrations(db.getSql())).status, "verified");
    };

    if (options.migrate !== false && marker === null) {
      await migrateIsolatedContractSpineV1();
      await db.pgMigrate();
    }
    const connected = await db.getSql()<Array<{ current_database: string }>>`
      SELECT current_database() AS current_database
    `;
    assert.equal(connected[0]?.current_database, database);
    if (marker !== null && options.migrate !== false) {
      await verifyP3ActivatedCloneV1(db);
    } else if (marker !== null) {
      await verifyP3ReadinessUnavailableV1();
    }
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
    get sql() { return db.getSql(); },
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
      assert.match(database, marker === null ? TEST_DATABASE_PATTERN : P3_DATABASE_PATTERN);
      if (marker !== null && options.migrate !== false) {
        await db.pgClose();
        await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${database} AND pid <> pg_backend_pid()`;
        await admin.unsafe(`DROP DATABASE "${database}"`);
        await admin.unsafe(
          `CREATE DATABASE "${database}" TEMPLATE "${marker.templateDatabaseName}"`,
        );
        db.pgConfigureIsolatedTestDatabase(target.toString());
        await db.getSql()`SELECT 1`;
        await verifyP3ActivatedCloneV1(db);
      } else {
        await db.getSql().unsafe("DROP SCHEMA public CASCADE");
        await db.getSql().unsafe("CREATE SCHEMA public");
        if (marker === null) {
          await migrateIsolatedContractSpineV1();
          await db.pgMigrate();
        }
      }
    },
    async cleanup() {
      if (cleaned) return;
      cleaned = true;
      await db.pgClose();
      assert.match(database, marker === null ? TEST_DATABASE_PATTERN : P3_DATABASE_PATTERN);
      await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${database} AND pid <> pg_backend_pid()`;
      operations.push(`DROP DATABASE ${database}`);
      await admin.unsafe(`DROP DATABASE "${database}"`);
      process.stderr.write(`[execution-test-db] dropped ${database}\n`);
      await admin.end({ timeout: 5 });
    },
  };
}

async function migrateP3TemplateV1(
  db: typeof import("../../src/db-pg.js"),
): Promise<void> {
  const automatic = await applyContractSpineMigrations(db.getSql());
  assert.deepEqual(automatic.guardedPending, [
    "contract-spine-bootstrap-main-claim-handoff-v1",
  ]);
}

async function applyAndVerifyP3GenericSuccessorV1(
  db: typeof import("../../src/db-pg.js"),
): Promise<void> {
  const automatic = await applyContractSpineMigrations(db.getSql());
  assert.deepEqual(automatic.guardedPending, []);
  assert.equal((await verifyContractSpineMigrations(db.getSql())).status, "verified");
}

function p3FixtureGitV1(root: string, args: readonly string[]): string {
  const result = spawnSync("/usr/bin/git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function writeP3FixtureFileV1(
  root: string,
  locator: string,
  bytes: string | Buffer,
  mode = 0o644,
): void {
  const target = path.join(root, locator);
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
  writeFileSync(target, bytes);
  chmodSync(target, mode);
}

function materializeP3FixtureBuildOutputsV1(root: string): void {
  for (const locator of p3FixtureGitV1(root, ["ls-files", "-z"]).split("\0").filter(Boolean)) {
    let output: string | null = null;
    if (locator.startsWith("src/") && locator.endsWith(".ts") && !/\.(?:d|m|c)\.ts$/.test(locator)) {
      output = `dist/${locator.slice(4, -3)}.js`;
    } else if (
      locator === "src/server/index.html"
      || locator === "src/installer/compat-rules.json"
      || /^src\/installer\/prompts\/[^/]+\.md$/.test(locator)
      || /^src\/installer\/steps\/.+\.md$/.test(locator)
    ) {
      output = `dist/${locator.slice(4)}`;
    }
    if (output !== null) {
      writeP3FixtureFileV1(root, output, `// disposable P3 activation fixture for ${locator}\n`, 0o600);
    }
  }
}

function completeP3PbaObservationV1(vendorProducerCommit: string) {
  const deliveredPathBlobs = P3_DELIVERED_PATHS.map((entry, index) => ({
    path: entry,
    blobHash: String(index + 1).padStart(64, "0"),
  }));
  const argv = [
    "node", "--import", "tsx", "--test",
    "server/routes/setfarm-operational.test.ts",
    "server/services/setfarm-product-build-authority.test.ts",
    "tests/product-build-authority-render.test.tsx",
  ] as const;
  const focusedCore = {
    schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1" as const,
    argv,
    commandContractHash: hashCanonicalJson({ argv }),
    testPathBlobs: [deliveredPathBlobs[0]!, deliveredPathBlobs[3]!, deliveredPathBlobs[6]!],
    exitCode: 0 as const,
    passed: true as const,
  };
  const focusedTestReceiptHash = hashCanonicalJson(focusedCore);
  const focusedTests = {
    ...focusedCore,
    focusedTestReceiptRef: `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focusedTestReceiptHash}`,
    focusedTestReceiptHash,
  };
  const artifacts = P3_VENDOR_ARTIFACTS.map((name, index) => ({
    producerPath: `contracts/generated/mission-control/${name}`,
    vendoredPath: `contracts/vendor/setfarm/${name}`,
    sha256: String(index + 20).padStart(64, "0"),
  }));
  const vendorCore = {
    schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1" as const,
    lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json" as const,
    producerRepository: "https://github.com/hikmetgulsesli/setfarm.git" as const,
    producerCommit: vendorProducerCommit,
    lockContentHash: deliveredPathBlobs[7]!.blobHash,
    artifacts,
    compatibilitySetHash: hashCanonicalJson({
      schema: "mission-control.setfarm-contract-compatibility-set.v1",
      artifacts,
    }),
  };
  const vendorLock = {
    ...vendorCore,
    vendorLockProjectionHash: hashCanonicalJson(vendorCore),
  };
  const evidenceCore = {
    schema: "mission-control.product-build-authority-v2-delivery-evidence.v1" as const,
    currentStatus: "current" as const,
    deliveryPrNumber: 19 as const,
    deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a" as const,
    deliveryMergeAncestorOfCurrentSource: true as const,
    currentSource: {
      branch: "main" as const,
      clean: true as const,
      sha: vendorProducerCommit,
      treeHash: "b".repeat(40),
      buildHash: "c".repeat(64),
      originMainSha: vendorProducerCommit,
    },
    deliveredPathBlobs,
    focusedTests,
    vendorLock,
  };
  const deliveryEvidenceHash = hashCanonicalJson(evidenceCore);
  const evidence = {
    ...evidenceCore,
    deliveryEvidenceRef: `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`,
    deliveryEvidenceHash,
  };
  return {
    schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" as const,
    observationTransport: "source-cli" as const,
    response: {
      schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1" as const,
      currentStatus: "current" as const,
      deliveryEvidenceRef: evidence.deliveryEvidenceRef,
      deliveryEvidenceHash,
      evidence,
    },
  };
}

function createP3LegacyMigrationProvenanceV1(
  operation: import("../../src/internal-production/baseline-post-handoff-receipt-v1.js").InternalProductionCurrentEntryOperationV1,
  templateDatabase: string,
  inventory?: LegacyFindingPublicationInventoryV1,
) {
  const fact = (name: string) => hashCanonicalJson({ schema: "setfarm.p3-template-activation-fact.v1", database: templateDatabase, name });
  const censusKeys = [
    "activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount",
    "ordinaryStartingCount", "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount", "stagedCaseCount",
    "fixtureAttemptCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount", "fleetStageCount",
    "fleetInflightCount", "fleetPendingReviewCount", "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount",
    "operationalDeliveryCount", "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount",
    "ownedListenerCount", "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount",
  ];
  const legacyBody = {
    schema: inventory === undefined ? "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1" : "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v2",
    ...(inventory === undefined ? {} : { legacyFindingPublicationInventory: validateLegacyFindingPublicationInventoryV1(inventory) }),
    observationKind: "legacy-pre-manifest-existing-live-truth",
    ...operation.authorityV3Migration31Audit,
    cleanSetfarmSourceSha: operation.controllerSource.sha, cleanSetfarmTreeHash: operation.controllerSource.treeHash,
    cleanSetfarmBuildHash: operation.controllerSource.buildHash, observedSpawnerGenerationHash: fact("sealed-spawner-generation"),
    census: Object.fromEntries(censusKeys.map((key) => [key, 0])), allThirtySixScalarCountsZero: true,
    ownerReservationSidecarState: "absent-before-migration-32", ownerAdmissionHeadState: "absent-before-migration-32",
    manifestActivationState: "absent-before-initial-a-activation",
  };
  const observationHash = hashCanonicalJson(legacyBody);
  const legacy = { ...legacyBody, observationRef: `setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/${observationHash}`, observationHash };
  const facts = {
    currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash,
    sealedSpawnerAdmissionRef: `setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/${fact("sealed-spawner-admission")}`,
    sealedSpawnerAdmissionHash: fact("sealed-spawner-admission"),
    postPredecessorTerminationLegacyZeroOwnerObservationRef: legacy.observationRef,
    postPredecessorTerminationLegacyZeroOwnerObservationHash: legacy.observationHash,
    ...operation.authorityV3Migration31Audit, ...operation.pendingBootstrapHandoffMigration,
    cleanSetfarmSourceSha: operation.controllerSource.sha, cleanSetfarmTreeHash: operation.controllerSource.treeHash,
    cleanSetfarmBuildHash: operation.controllerSource.buildHash,
    freshLegacyZeroOwnerObservationRef: legacy.observationRef, freshLegacyZeroOwnerObservationHash: legacy.observationHash,
  };
  const purpose = "task6a-guarded-migration-32-after-sealed-spawner-v1" as const;
  const authorizationBody = { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization.v1", purpose, ...facts };
  const authorizationHash = hashCanonicalJson(authorizationBody);
  const authorization = { ...authorizationBody, authorizationRef: `setfarm://internal-production/pre-manifest-migration32-authorization/sha256/${authorizationHash}`, authorizationHash };
  const consumptionBody = { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-consumption.v1",
    currentEntryOperationRef: facts.currentEntryOperationRef, currentEntryOperationHash: facts.currentEntryOperationHash,
    authorizationRef: authorization.authorizationRef, authorizationHash,
    sealedSpawnerAdmissionRef: facts.sealedSpawnerAdmissionRef, sealedSpawnerAdmissionHash: facts.sealedSpawnerAdmissionHash,
    migrationId: "contract-spine-bootstrap-main-claim-handoff-v1", migrationOrdinal: 32 };
  const consumptionHash = hashCanonicalJson(consumptionBody);
  const consumption = { ...consumptionBody, consumptionRef: `setfarm://internal-production/pre-manifest-migration32-authorization-consumption/sha256/${consumptionHash}`, consumptionHash };
  const evidence = { schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-evidence.v1" as const, purpose, ...facts,
    migrationSourceSha: operation.controllerSource.sha,
    preManifestMigration32AuthorizationRef: authorization.authorizationRef, preManifestMigration32AuthorizationHash: authorizationHash,
    preManifestMigration32AuthorizationConsumptionRef: consumption.consumptionRef, preManifestMigration32AuthorizationConsumptionHash: consumptionHash };
  assert.equal(Object.keys(evidence).length, 22);
  return { legacy, authorization, consumption, evidence };
}

function p3FixtureReceiptWithOperationPublisherV1(source: string, root: string): string {
  const locatorSource = readFileSync(path.join(root, "src/internal-production/baseline-workspace-authority-path-v1.ts"), "utf8");
  const fixtureWorkspaceAuthority =
    'const CODE_OWNED_WORKSPACE_ROOT_V1 = path.resolve(import.meta.dirname, "../../..");';
  assert.equal(
    locatorSource.split(fixtureWorkspaceAuthority).length,
    2,
    "P3 activation fixture must inherit exactly one projected workspace authority",
  );
  assert.equal(
    locatorSource.includes('const CODE_OWNED_WORKSPACE_ROOT_V1 = path.join(CODE_OWNER_HOME_V1, "ai", "setrox");'),
    false,
    "P3 activation fixture must not inherit the production workspace authority",
  );
  const fixtureBoundSource = source;
  const start = fixtureBoundSource.indexOf("export async function prepareInternalProductionCurrentEntryOperationV1(): Promise<InternalProductionCurrentEntryOperationV1> {");
  const end = fixtureBoundSource.indexOf("\n\nexport async function resolveInternalProductionCurrentEntryOperationV1", start);
  assert.ok(start >= 0 && end > start, "P3 fixture current-entry operation publisher boundary must remain exact");
  let continuationReplacements = 0;
  const fixturePublisher = fixtureBoundSource.slice(start, end)
    .replace(
      "prepareInternalProductionCurrentEntryOperationV1",
      "prepareP3FixtureCurrentEntryOperationV1",
    )
    .replace(
      /\s+const controllerLock = await acquireTask12ControllerLockV1\(context, resolved\.operationHash\);\s+try \{ return await ensureTask12PreparedCurrentEntryStatusV1\(context, resolved\); \}\s+finally \{ releaseTask12ControllerLockV1\(controllerLock\); \}/g,
      () => {
        continuationReplacements += 1;
        return "\n    return resolved;";
      },
    );
  assert.equal(continuationReplacements, 2, "P3 fixture operation publisher must stop at both status-continuation boundaries");
  assert.match(fixturePublisher, /export async function prepareP3FixtureCurrentEntryOperationV1/);
  assert.doesNotMatch(fixturePublisher, /prepareInternalProductionCurrentEntryOperationV1|observeInternalProductionServiceCensusV1|ensureTask12PreparedCurrentEntryStatusV1|acquireTask12ControllerLockV1|launchctl|lsof/);
  return `${fixtureBoundSource}\n${fixturePublisher}\n${p3FixtureLegacyProvenancePublisherSourceV1()}\n`;
}

function p3FixtureLegacyProvenancePublisherSourceV1(): string {
  return `
export async function publishP3FixtureLegacyMigrationProvenanceV1(value) {
  publishLegacyZeroRecordV1(legacyZeroPathV1(value.legacy.observationHash), await canonicalRecordBytes(value.legacy));
  for (const [kind,record,refKey,hashKey,prefix] of [
    ["authorizations",value.authorization,"authorizationRef","authorizationHash",TASK12_MIGRATION_PREFIXES_V1.authorization],
    ["consumptions",value.consumption,"consumptionRef","consumptionHash",TASK12_MIGRATION_PREFIXES_V1.consumption],
  ]) {
    const body={...record}; delete body[refKey]; delete body[hashKey];
    const published=await publishTask12HashedRecordV1(kind,body,refKey,hashKey,prefix);
    if(canonicalComparable(published)!==canonicalComparable(record)) throw new Error("P3_MIGRATION_PROVENANCE_CROSSED");
  }
  const body={schema:"setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1", evidenceHash:hashCanonicalJson(value.evidence),
    authorizationRef:value.authorization.authorizationRef, authorizationHash:value.authorization.authorizationHash,
    authorizationConsumptionRef:value.consumption.consumptionRef, authorizationConsumptionHash:value.consumption.consumptionHash};
  return resolveInternalProductionLegacyFindingPublicationInventoryForMigrationV1({migrationApplication:{...body,applicationHash:hashCanonicalJson(body)},migrationSourceSha:value.evidence.migrationSourceSha});
}
`;
}

// This capability-gated test adapter exposes existing private leaves only in
// exact-URL module instances. It adds no runtime port and changes no source file.
export async function applyP3LegacyFindingMigration32ForTestV1(database: TestDatabase) {
  authenticateP3ProjectedReadinessTestCapabilityV1();
  const marker = readP3MarkerV1();
  assert.ok(database.database.startsWith(`${marker.runDatabasePrefix}_empty_`));
  assert.equal((await database.sql`SELECT current_database() AS name`)[0]?.name, database.database);
  const journal = await database.sql`SELECT version,state FROM setfarm_schema_migrations WHERE version>=32 ORDER BY version`;
  assert.deepEqual([...journal], [], "pending guarded migration has not published a journal row");
  const pending = await inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(database.sql);
  assert.equal(pending.status, "exact_pending_guarded_successor");
  assert.equal(pending.migration.version, 32);
  assert.equal(pending.migration.state, "pending");
  const nonce = randomBytes(12).toString("hex");
  const receiptUrl = `${pathToFileURL(path.join(P3_FIXTURE_SOURCE_ROOT, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href}?p3-legacy=${nonce}`;
  const dbUrl = `${pathToFileURL(path.join(P3_FIXTURE_SOURCE_ROOT, "src/db-pg.ts")).href}?p3-legacy=${nonce}`;
  const hook = `let receiptUrl,dbUrl,publisher;
export function initialize(data){({receiptUrl,dbUrl,publisher}=data)}
export async function load(url,context,nextLoad){
  const result=await nextLoad(url,context);
  if(url!==receiptUrl && url!==dbUrl)return result;
  const suffix=url===receiptUrl?publisher:"\\nexport { observePostManifestFindingPublicationOwnersV1 as observeP3LegacyFindingOwnersV1 };\\n";
  return {...result,source:Buffer.from(result.source).toString("utf8")+suffix};
}`;
  register(`data:text/javascript;base64,${Buffer.from(hook).toString("base64")}#${nonce}`, {
    parentURL: import.meta.url, data: { receiptUrl, dbUrl, publisher: p3FixtureLegacyProvenancePublisherSourceV1() },
  });
  const receipt = await import(receiptUrl);
  const operation = await receipt.observePreparedInternalProductionCurrentEntryOperationV1();
  assert.ok(operation);
  const inventory = await database.sql.begin("isolation level repeatable read read only", async (sql) => {
    const parents = await sql`SELECT finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,source_sha,source_tree_hash,finding_ids,payload FROM finding_sets ORDER BY finding_set_hash LIMIT 4097`;
    const children = await sql`SELECT finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload FROM findings ORDER BY finding_set_hash,finding_id LIMIT 65537`;
    const runs = await sql`SELECT id,status FROM runs WHERE id IN (SELECT run_id FROM finding_sets) ORDER BY id LIMIT 4097`;
    return observeLegacyFindingPublicationInventoryV1(parents, children, runs);
  });
  const provenance = createP3LegacyMigrationProvenanceV1(operation, database.database, inventory);
  assert.deepEqual(await receipt.publishP3FixtureLegacyMigrationProvenanceV1(provenance), inventory);
  await applyBootstrapMainClaimHandoffGuardedMigration32V1(database.sql, mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1(provenance.evidence));
  const exposed = await import(dbUrl);
  return async () => database.sql.begin("isolation level repeatable read read only", async (sql) => {
    const counts = await sql`SELECT COUNT(*)::integer AS count FROM findings WHERE status='open'`;
    return exposed.observeP3LegacyFindingOwnersV1(sql, counts[0]!.count) as Promise<number>;
  });
}

function createP3PreparedActivationFixtureV1(): Readonly<{ root: string; vendorCommit: string }> {
  const root = path.join(mkdtempSync(path.join(tmpdir(), "setfarm-p3-activation-")), "setfarm");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  cpSync(path.join(P3_FIXTURE_SOURCE_ROOT, "src"), path.join(root, "src"), { recursive: true });
  for (const locator of [
    "package.json", "tsconfig.json", ".gitignore", "scripts/write-build-info.mjs",
    "scripts/build-generation-retention.mjs", "scripts/copy-step-assets.mjs",
    "scripts/stitch-to-jsx.mjs", "scripts/inject-version.js",
  ]) {
    writeP3FixtureFileV1(
      root,
      locator,
      readFileSync(path.join(P3_FIXTURE_SOURCE_ROOT, locator)),
      locator.endsWith("copy-step-assets.mjs") ? 0o755 : 0o644,
    );
  }
  p3FixtureGitV1(root, ["init", "-q", "-b", "main"]);
  p3FixtureGitV1(root, ["config", "user.name", "Setfarm P3 Activation Test"]);
  p3FixtureGitV1(root, ["config", "user.email", "setfarm-p3-activation@invalid"]);
  p3FixtureGitV1(root, ["config", "commit.gpgsign", "false"]);
  const sourceCommonDir = p3FixtureGitV1(P3_FIXTURE_SOURCE_ROOT, ["rev-parse", "--git-common-dir"]);
  const sourceObjects = path.resolve(P3_FIXTURE_SOURCE_ROOT, sourceCommonDir, "objects");
  mkdirSync(path.join(root, ".git/objects/info"), { recursive: true });
  writeFileSync(path.join(root, ".git/objects/info/alternates"), `${sourceObjects}\n`);
  const sourceHead = p3FixtureGitV1(P3_FIXTURE_SOURCE_ROOT, ["rev-parse", "HEAD"]);
  p3FixtureGitV1(root, ["update-ref", "refs/heads/main", sourceHead]);
  p3FixtureGitV1(root, ["reset", "--mixed", "HEAD"]);
  p3FixtureGitV1(root, ["remote", "add", "origin", "https://github.com/hikmetgulsesli/setfarm.git"]);
  p3FixtureGitV1(root, ["add", "."]);
  p3FixtureGitV1(root, ["commit", "-qm", "P3 fixture vendor ancestor"]);
  const vendorCommit = p3FixtureGitV1(root, ["rev-parse", "HEAD"]);
  const observation = completeP3PbaObservationV1(vendorCommit);
  writeP3FixtureFileV1(
    root,
    "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts",
    `const observation=${JSON.stringify(observation)}; export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(){return structuredClone(observation)} export function parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value){return value}\n`,
  );
  const receiptLocator = "src/internal-production/baseline-post-handoff-receipt-v1.ts";
  writeP3FixtureFileV1(
    root,
    receiptLocator,
    p3FixtureReceiptWithOperationPublisherV1(readFileSync(path.join(root, receiptLocator), "utf8"), root),
  );
  p3FixtureGitV1(root, ["add", "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts", receiptLocator]);
  p3FixtureGitV1(root, ["commit", "-qm", "P3 fixture controller source"]);
  p3FixtureGitV1(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  for (const entry of p3FixtureGitV1(root, ["ls-files", "-s", "-z"]).split("\0").filter(Boolean)) {
    const match = /^(100644|100755) [a-f0-9]+ 0\t(.+)$/.exec(entry);
    assert.ok(match, `unexpected P3 fixture Git entry: ${entry}`);
    chmodSync(path.join(root, match[2]!), match[1] === "100755" ? 0o755 : 0o644);
  }
  const prepared = spawnSync(process.execPath, ["scripts/write-build-info.mjs", "--prepare"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(prepared.status, 0, prepared.stderr);
  materializeP3FixtureBuildOutputsV1(root);
  const finalized = spawnSync(process.execPath, ["scripts/write-build-info.mjs", "--finalize"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(finalized.status, 0, finalized.stderr);
  symlinkSync(path.join(P3_FIXTURE_SOURCE_ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
  writeFileSync(path.join(root, ".git/info/exclude"), "node_modules\n");
  return Object.freeze({ root, vendorCommit });
}

async function activateP3TemplateAndWriteReadinessV1(
  db: typeof import("../../src/db-pg.js"),
  projectionRoot: string,
  database: string,
): Promise<void> {
  const fixture = createP3PreparedActivationFixtureV1();
  try {
    const receiptUrl = pathToFileURL(path.join(
      fixture.root,
      "src/internal-production/baseline-post-handoff-receipt-v1.ts",
    )).href;
    const fixtureReceipt = await import(`${receiptUrl}?p3-prepare=${Date.now()}`);
    assert.equal(typeof fixtureReceipt.prepareP3FixtureCurrentEntryOperationV1, "function");
    assert.equal(fixtureReceipt.prepareP3FixtureCurrentEntryOperationV1.length, 0);
    const operation = await fixtureReceipt.prepareP3FixtureCurrentEntryOperationV1();
    const adopted = await fixtureReceipt.prepareP3FixtureCurrentEntryOperationV1();
    assert.deepEqual(adopted, operation);
    assert.deepEqual(await fixtureReceipt.observePreparedInternalProductionCurrentEntryOperationV1(), operation);
    assert.equal(p3FixtureGitV1(fixture.root, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
    assert.equal(existsSync(path.join(fixture.root, "data")), false);
    const fixtureStore = path.join(path.dirname(fixture.root), "data/internal-production-baseline/current-entry-v1");
    assert.equal(readFileSync(path.join(fixtureStore, "current-entry-operation.json"), "utf8").includes(operation.operationHash), true);
    assert.deepEqual(
      ["current-entry-operation.json", "records"],
      readdirSync(fixtureStore).sort(),
    );
    const exactPrerequisiteLocators = [
      path.join(
        fixtureStore,
        "records/authority-v3-migration31-audits/sha256",
        operation.authorityV3Migration31Audit.authorityV3Migration31AuditHash.slice(0, 2),
        `${operation.authorityV3Migration31Audit.authorityV3Migration31AuditHash}.json`,
      ),
      path.join(
        fixtureStore,
        "records/pending-bootstrap-handoff-migrations/sha256",
        operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash.slice(0, 2),
        `${operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash}.json`,
      ),
    ];
    for (const locator of exactPrerequisiteLocators) {
      assert.equal(existsSync(locator), true, `P3 fixture prerequisite must remain fixture-local: ${locator}`);
    }
    assert.notEqual(fixture.vendorCommit, operation.controllerSource.sha);
    p3FixtureGitV1(projectionRoot, [
      "fetch", "--no-tags", fixture.root, operation.controllerSource.sha,
    ]);
    const provenance = createP3LegacyMigrationProvenanceV1(operation, database);
    const authenticatedInventory = await fixtureReceipt.publishP3FixtureLegacyMigrationProvenanceV1(provenance);
    assert.deepEqual(authenticatedInventory.entries, [], "historical P3 fixture has no legacy publication membership");
    cpSync(path.join(path.dirname(fixture.root), "data"), path.join(path.dirname(projectionRoot), "data"), {
      recursive: true,
      errorOnExist: true,
      force: false,
      // The filtered copy path preserves source directory modes. Node 26's
      // native unfiltered path creates 0755 directories under umask 0022,
      // invalidating these already-authenticated private 0700 authorities.
      filter: () => true,
    });
    const evidence = mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1(provenance.evidence);
    await applyBootstrapMainClaimHandoffGuardedMigration32V1(db.getSql(), evidence);
    await applyAndVerifyP3GenericSuccessorV1(db);
    await db.pgMigrate();
    const owner = await import(`${pathToFileURL(path.join(
      fixture.root,
      "src/internal-production/owner-admission-v1.ts",
    )).href}?p3-owner=${Date.now()}`);
    const response = operation.productBuildAuthorityV2Observation.response;
    const sourceBody = {
      schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1" as const,
      plan: "A" as const,
      manifestHash: owner.INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      setfarmSource: operation.controllerSource,
      productBuildAuthorityV2DeliveryEvidenceRef: response.deliveryEvidenceRef,
      productBuildAuthorityV2DeliveryEvidenceHash: response.deliveryEvidenceHash,
      productBuildAuthorityV2Observation: operation.productBuildAuthorityV2Observation,
      vendorProducerCommit: fixture.vendorCommit,
      vendorProducerCommitAncestorProof: {
        schema: "setfarm.internal-production-vendor-ancestor-proof.v1" as const,
        vendorProducerCommit: fixture.vendorCommit,
        setfarmSourceSha: operation.controllerSource.sha,
        mergeBase: fixture.vendorCommit,
        verified: true as const,
      },
      ownerCategoryRegistryHash: owner.INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
      ownerCategoryCensusMapHash: owner.INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    };
    const sourceHash = hashCanonicalJson(sourceBody);
    const source = owner.validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
      ...sourceBody,
      sourceBuildAuthorityRef:
        `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceHash}`,
      sourceBuildAuthorityHash: sourceHash,
    });
    const fixtureDb = await import(`${pathToFileURL(path.join(fixture.root, "src/db-pg.ts")).href}?p3-activation=${Date.now()}`);
    try {
      const activation = await fixtureDb.activateInternalProductionOwnerProducerManifestSetV1({
        expectedPredecessor: null,
        manifests: [owner.INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1],
        orderedSourceBuildAuthorities: [{
          plan: "A" as const,
          sourceBuildAuthorityRef: source.sourceBuildAuthorityRef,
          sourceBuildAuthorityHash: source.sourceBuildAuthorityHash,
        }],
      });
      const current = await fixtureDb.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
      assert.ok(current);
      assert.equal(current.receipt.activationRef, activation.activationRef);
      assert.equal(current.receipt.activationHash, activation.activationHash);
      const head = current.head;
      const admissionReadyHash = hashCanonicalJson({
        schema: "setfarm.p3-projected-admission-ready.v1",
        activationRef: activation.activationRef,
        activationHash: activation.activationHash,
        headRef: head.headRef,
        headHash: head.headHash,
      });
      const admissionReadyRef = `setfarm://tests/p3/admission-ready/sha256/${admissionReadyHash}`;
      const readinessModulePath = path.join(
        projectionRoot,
        "src/internal-production/baseline-spawner-startup-admission-v1.js",
      );
      writeFileSync(readinessModulePath, `
import { authenticateP3ProjectedReadinessTestCapabilityV1 } from "../../tests/execution-attempts/test-database.ts";
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};
const READY = deepFreeze(${JSON.stringify({
        state: "normal-task0-admission-ready",
        admissionReadyRef,
        admissionReadyHash,
        manifestActivationRef: activation.activationRef,
        manifestActivationHash: activation.activationHash,
        manifestHeadRef: head.headRef,
        manifestHeadHash: head.headHash,
      })});
const STATUS = deepFreeze({
  state: "normal_task0_admission_ready",
  admissionReady: {
    admissionReadyHash: READY.admissionReadyHash,
    admissionReadyRef: READY.admissionReadyRef,
  },
});
async function verifySelectedDatabase() {
  authenticateP3ProjectedReadinessTestCapabilityV1();
  const db = await import("../../src/db-pg.ts?p3-readiness=" + Date.now() + "-" + Math.random());
  try {
    db.pgConfigureIsolatedTestDatabase(process.env.SETFARM_PG_URL ?? "");
    const current = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
    if (!current
      || current.receipt.phase !== "A"
      || current.receipt.activationRef !== READY.manifestActivationRef
      || current.receipt.activationHash !== READY.manifestActivationHash
      || current.head.headRef !== READY.manifestHeadRef
      || current.head.headHash !== READY.manifestHeadHash) {
      throw new Error("P3_PROJECTED_READINESS_DATABASE_INVALID");
    }
  } catch {
    throw new Error("P3_PROJECTED_READINESS_DATABASE_INVALID");
  } finally {
    await db.pgClose().catch(() => {});
  }
}
export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1() {
  await verifySelectedDatabase();
  return STATUS;
}
export async function resolveInternalProductionTask0SpawnerAdmissionReadyV1(pair) {
  await verifySelectedDatabase();
  if (!pair || Object.getPrototypeOf(pair) !== Object.prototype
    || JSON.stringify(Reflect.ownKeys(pair)) !== JSON.stringify(["admissionReadyRef", "admissionReadyHash"])
    || pair.admissionReadyRef !== READY.admissionReadyRef
    || pair?.admissionReadyHash !== READY.admissionReadyHash) throw new Error("PAIR_INVALID");
  return READY;
}
`, { mode: 0o600 });
    } finally {
      await fixtureDb.pgClose().catch(() => {});
    }
    const reopened = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
    assert.ok(reopened);
    assert.equal(reopened.receipt.phase, "A");
  } finally {
    rmSync(path.dirname(fixture.root), { recursive: true, force: true });
  }
}

async function setupP3TemplateDirectV1(): Promise<void> {
  const capability = readAuthenticateAndCloseFd3ExactlyOnceV1();
  assert.equal(capability.role, "setup");
  const target = new URL(process.env.SETFARM_PG_URL ?? "");
  const database = decodeURIComponent(target.pathname.replace(/^\/+/, ""));
  assert.equal(database, capability.marker.templateDatabaseName);
  assert.match(database, P3_DATABASE_PATTERN);
  const admin = postgres(adminUrl().toString(), {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 1,
    onnotice: () => {},
  });
  let db: typeof import("../../src/db-pg.js") | null = null;
  try {
    await admin.unsafe(`CREATE DATABASE "${database}"`);
    db = await import(`../../src/db-pg.ts?p3-template=${database}`);
    db.pgConfigureIsolatedTestDatabase(target.toString());
    await migrateP3TemplateV1(db);
    await activateP3TemplateAndWriteReadinessV1(
      db,
      capability.marker.projectionRoot,
      database,
    );
  } catch (error) {
    if (db) await db.pgClose().catch(() => {});
    await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${database} AND pid<>pg_backend_pid()`;
    await admin.unsafe(`DROP DATABASE IF EXISTS "${database}"`);
    throw error;
  } finally {
    if (db) await db.pgClose().catch(() => {});
    await admin.end({ timeout: 5 }).catch(() => {});
  }
}

const directEntryPath = process.argv[1] ? realpathSync(process.argv[1]) : null;
if (directEntryPath === realpathSync(fileURLToPath(import.meta.url))) {
  setupP3TemplateDirectV1().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
