import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  unlinkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it } from "node:test";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const observerSource = path.join(sourceRoot, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
const isolatedRunner = path.join(sourceRoot, "scripts/run-isolated-postgres-tests.ts");
const dbSource = path.join(sourceRoot, "src/db-pg.ts");
const tsxLoader = import.meta.resolve("tsx");
const EXACT_SCRIPTS = Object.freeze({
  prebuild: "node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts",
  build: "umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js",
  postbuild: "node scripts/write-build-info.mjs --finalize",
  "check:migration-digests": "node --import tsx scripts/check-contract-spine-migration-digests.ts --check",
  "check:mission-control-contracts": "node --import tsx scripts/mission-control-contract-artifacts.ts --check",
  "build-generation-retention:inspect": "node scripts/build-generation-retention.mjs inspect",
  "build-generation-retention:prepare": "node scripts/build-generation-retention.mjs prepare",
  "build-generation-retention:resume": "node scripts/build-generation-retention.mjs resume",
});
const EXACT_TSCONFIG = Object.freeze({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: "dist",
    rootDir: "src",
    strict: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    types: ["node"],
  },
  include: ["src/**/*.ts"],
});

function git(root: string, args: readonly string[]): string {
  return execFileSync("/usr/bin/git", [...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function fixtureFile(root: string, locator: string, bytes: string | Buffer, mode = 0o644): void {
  const target = path.join(root, locator);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  chmodSync(target, mode);
}

function fixtureV31Migrations(): readonly (readonly [string, string])[] {
  const source = readFileSync(observerSource, "utf8");
  const match = /const V31_MIGRATION_IDENTITIES = Object\.freeze\((\[[\s\S]*?\]) as const\);/.exec(source);
  assert.ok(match, "production v31 identities must be fixture-readable");
  return JSON.parse(match[1]!.replace(/,\s*\]$/, "]")) as readonly (readonly [string, string])[];
}

type FixtureOptions = Readonly<{
  v31ReobservationDrift?: boolean;
  v31AuditExtra?: boolean;
  pendingExtra?: boolean;
  crossedPbaResponse?: boolean;
  pbaObservationExtra?: boolean;
  pbaResponseExtra?: boolean;
  normalizationContentionBarrier?: boolean;
  preparedAccessorReobservationDrift?: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation";
  preparedAccessorByteDrift?: boolean;
  preparedAccessorWrongDevice?: boolean;
}>;

function fixtureDatabasePortSource(options: FixtureOptions): string {
  const migrations = fixtureV31Migrations().map(([name, checksum], index) => ({ version: index + 1, name, migrationClass: "automatic", checksum, state: "applied" }));
  const fullAudit = { schema: "setfarm.contract-spine-current-authority-ledgers-audit.v2", version: "2.0.0", scope: "database-current-authority-ledgers-only", status: "verified", authorityState: "database_integrity_audit_only", productionAuthority: false, productionAdmission: "forbidden", mutationAuthority: false, storeAuthority: false, restartAuthority: false, trustConclusion: "characterization_only", artifactPublicationAuthorityLedger: { schema: "setfarm.artifact-publication-authority-ledger-audit.v2", scope: "database-ledger-only", status: "verified", batchPlanCount: 0, authority: null }, platformReleaseStoreRecordLedger: { schema: "setfarm.platform-release-store-record-ledger-current-audit.v3", scope: "database-record-integrity-only", status: "integrity_verified", authorityState: "database_record_integrity_audit_only", productionAuthority: false, productionAdmission: "forbidden", mutationAuthority: false, storeAuthority: false, restartAuthority: false, trustConclusion: "characterization_only", recordCount: 0, tailRecordHash: null, tailPublishedCensusHash: null }, v3StoryClaimRuntimeBinding: { schema: "setfarm.v3-story-claim-runtime-binding-current-audit.v1", scope: "database-binding-integrity-only", status: "integrity_verified", authorityState: "database_binding_integrity_audit_only", productionAuthority: false, productionAdmission: "forbidden", mutationAuthority: false, bindingCount: 0, requiredOwnerCount: 0 } };
  const pending = { schema: "setfarm.pending-bootstrap-main-claim-handoff-guarded-successor.v1", status: "exact_pending_guarded_successor", migration: { version: 32, name: "contract-spine-bootstrap-main-claim-handoff-v1", migrationClass: "guarded", checksum: "d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d", state: "pending" }, migrationDigest: "8cbaab0c47bf3639033442d2df9a1c15d421eb34adbab72fa82951712cafe4e2", namedMigrationDigestEntryHash: "81d9164ca0f2c0be1cece391fc654a854c28ccfce905b87c3ad680202f95557c", orderedStatementsHash: "ccfcfdb6ed9e9d87add9e28394b2e67bf9ed55347841fe0529cdde4d6a5b34c9", expectedSchemaProjectionHash: "9f44b6312ba62fb7b48da153e70fa7f19ce543dbeec500b9111d750847a7eed1" };
  const driftedAudit = { ...fullAudit, artifactPublicationAuthorityLedger: { ...fullAudit.artifactPublicationAuthorityLedger, batchPlanCount: 1 } };
  return `let auditCalls=0;\nexport async function auditCurrentInternalProductionAuthorityV3Migration31V1(){auditCalls+=1;return {authorityV3ContractSpineThroughMigration31:{schema:"setfarm.authority-v3-contract-spine-through-migration-31-audit.v1",status:"verified",throughVersion:31,migrations:${JSON.stringify(migrations)}${options.v31AuditExtra ? ",extra:true" : ""}},currentAuthorityAudit:auditCalls===1||${JSON.stringify(!options.v31ReobservationDrift)}?${JSON.stringify(fullAudit)}:${JSON.stringify(driftedAudit)}}}\nexport async function inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1(){return ${JSON.stringify(options.pendingExtra ? { ...pending, extra: true } : pending)}}\n`;
}

function fixturePbaPortSource(options: FixtureOptions): string {
  const evidenceCoreA = { schema: "fixture.product-build-authority-v2-delivery-evidence.v1", marker: "a" };
  const evidenceCoreB = { schema: "fixture.product-build-authority-v2-delivery-evidence.v1", marker: "b" };
  const hashA = canonicalHash(evidenceCoreA);
  const hashB = canonicalHash(evidenceCoreB);
  const evidenceA = { ...evidenceCoreA, deliveryEvidenceRef: `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${hashA}`, deliveryEvidenceHash: hashA };
  const evidenceB = { ...evidenceCoreB, deliveryEvidenceRef: `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${hashB}`, deliveryEvidenceHash: hashB };
  const response = {
    schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    currentStatus: "current",
    deliveryEvidenceRef: evidenceA.deliveryEvidenceRef,
    deliveryEvidenceHash: evidenceA.deliveryEvidenceHash,
    evidence: options.crossedPbaResponse ? evidenceB : evidenceA,
    ...(options.pbaResponseExtra ? { extra: true } : {}),
  };
  return `const response=${JSON.stringify(response)}; export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(){return {schema:"setfarm.product-build-authority-v2-delivery-evidence-observation.v1",observationTransport:"source-cli",response${options.pbaObservationExtra ? ",extra:true" : ""}}} export function parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value: unknown){return value as Record<string, unknown>}\n`;
}

function createFixture(options: FixtureOptions = {}): string {
  assert.equal(existsSync(observerSource), true, "production observer module must exist before fixture creation");
  const root = path.join(mkdtempSync(path.join(tmpdir(), "setfarm-oa17-observer-")), "setfarm");
  fixtureFile(root, "scripts/write-build-info.mjs", readFileSync(path.join(sourceRoot, "scripts/write-build-info.mjs")));
  fixtureFile(root, "scripts/build-generation-retention.mjs", readFileSync(path.join(sourceRoot, "scripts/build-generation-retention.mjs")));
  fixtureFile(root, "scripts/stitch-to-jsx.mjs", 'process.stdout.write("fixture converter\\n");\n');
  fixtureFile(root, "scripts/copy-step-assets.mjs", readFileSync(path.join(sourceRoot, "scripts/copy-step-assets.mjs")), 0o755);
  fixtureFile(root, "scripts/inject-version.js", "// fixture inject\n");
  const observerBytes = readFileSync(observerSource, "utf8");
  let fixtureObserver = options.normalizationContentionBarrier
    ? observerBytes.replace(
      'if (plan.state === "block" || plan.fixedName !== basename) currentEntryFail(`publisher family ${basename} cannot normalize`);',
      'if (plan.state === "block" || plan.fixedName !== basename) currentEntryFail(`publisher family ${basename} cannot normalize`); const barrier=path.join(store.directory,"..","normalization-contention-barrier"); try{mkdirSync(barrier,{mode:0o700})}catch(error){if(!(error instanceof Error)||!("code" in error)||error.code!=="EEXIST")throw error} try{writeFileSync(path.join(barrier,String(process.pid)),"ready\\n",{flag:"wx",mode:0o600})}catch(error){if(!(error instanceof Error)||!("code" in error)||error.code!=="EEXIST")throw error} const wait=new Int32Array(new SharedArrayBuffer(4)); while(readdirSync(barrier).length<2)Atomics.wait(wait,0,0,5);',
    )
    : observerBytes;
  if (options.preparedAccessorReobservationDrift) {
    const driftedBasename = {
      authorityV3Migration31Audit: "authority-v3-migration31-audit.json",
      pendingBootstrapHandoffMigration: "pending-bootstrap-handoff-migration.json",
      operation: "current-entry-operation.json",
    }[options.preparedAccessorReobservationDrift];
    fixtureObserver = fixtureObserver.replace(
      'assertDirectory(store.directory, storeBefore, "prepared current-entry store");\n  let operation:',
      `assertDirectory(store.directory, storeBefore, "prepared current-entry store"); { const driftPath=path.join(store.directory,${JSON.stringify(driftedBasename)}); const driftBytes=readFileSync(driftPath); renameSync(driftPath,path.join(store.directory,"..",${JSON.stringify(`held-${driftedBasename}`)})); writeFileSync(driftPath,driftBytes,{mode:0o600}); }\n  let operation:`,
    );
  }
  if (options.preparedAccessorByteDrift) {
    fixtureObserver = fixtureObserver.replace(
      'assertDirectory(store.directory, storeBefore, "prepared current-entry store");\n  let operation:',
      'assertDirectory(store.directory, storeBefore, "prepared current-entry store"); { const driftPath=path.join(store.directory,CURRENT_ENTRY_FILES.operation); const driftBytes=readFileSync(driftPath); driftBytes[0]=driftBytes[0]===0x7b?0x5b:0x7b; writeFileSync(driftPath,driftBytes,{mode:0o600}); }\n  let operation:',
    );
  }
  if (options.preparedAccessorWrongDevice) {
    fixtureObserver = fixtureObserver.replace(
      "CURRENT_ENTRY_MAX_BYTES,\n      store.device,\n      1,",
      "CURRENT_ENTRY_MAX_BYTES,\n      store.device + 1n,\n      1,",
    );
  }
  fixtureFile(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts", fixtureObserver);
  fixtureFile(root, "src/db/bootstrap-main-claim-handoff-v1-migration.ts", readFileSync(path.join(sourceRoot, "src/db/bootstrap-main-claim-handoff-v1-migration.ts")));
  fixtureFile(root, "src/db-pg.ts", fixtureDatabasePortSource(options));
  fixtureFile(root, "src/db/contract-spine-migration-digests.generated.ts", 'export const CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS={31:"f052eff1b45df0f00ffb844fe0d23b542eafa4789da5e90a329a8d756dfcdc3a"};\n');
  fixtureFile(root, "src/db/contract-spine-migration-source-integrity.ts", 'export const CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST={31:{}};\n');
  fixtureFile(root, "src/execution/v3-git-revision.ts", 'export function replayV3HistoricalGitCommitAncestryV1(){}\n');
  fixtureFile(root, "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts", fixturePbaPortSource(options));
  fixtureFile(root, "src/product-compiler/canonical-json.ts", readFileSync(path.join(sourceRoot, "src/product-compiler/canonical-json.ts")));
  fixtureFile(root, ".gitignore", "dist/\n.setfarm/\n");
  fixtureFile(root, "package.json", `${JSON.stringify({ version: "9.8.7", scripts: EXACT_SCRIPTS }, null, 2)}\n`);
  fixtureFile(root, "tsconfig.json", `${JSON.stringify(EXACT_TSCONFIG, null, 2)}\n`);
  fixtureFile(root, "src/cli/cli.ts", 'console.log("fixture");\n');
  fixtureFile(root, "src/server/index.ts", "export const server = true;\n");
  fixtureFile(root, "src/server/index.html", "<!doctype html>fixture\n");
  fixtureFile(root, "src/installer/compat-rules.json", "{}\n");
  fixtureFile(root, "src/installer/prompts/prompt.md", "prompt\n");
  fixtureFile(root, "src/installer/steps/nested/step.md", "step\n");
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.name", "Setfarm Test"]);
  git(root, ["config", "user.email", "setfarm-test@example.invalid"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["remote", "add", "origin", "https://github.com/hikmetgulsesli/setfarm.git"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "fixture"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  return root;
}

function removeFixture(root: string): void {
  rmSync(path.dirname(root), { recursive: true, force: true });
}

function runProducer(root: string, phase: "--prepare" | "--finalize") {
  return spawnSync(process.execPath, ["scripts/write-build-info.mjs", phase], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function materializeOutputs(root: string): void {
  const outputs: Readonly<Record<string, string>> = Object.freeze({
    "dist/cli/cli.js": 'console.log("fixture");\n',
    "dist/db/bootstrap-main-claim-handoff-v1-migration.js": "// compiled migration fixture\n",
    "dist/db-pg.js": "// compiled db fixture\n",
    "dist/db/contract-spine-migration-digests.generated.js": "// compiled digest fixture\n",
    "dist/db/contract-spine-migration-source-integrity.js": "// compiled integrity fixture\n",
    "dist/execution/v3-git-revision.js": "// compiled git fixture\n",
    "dist/installer/compat-rules.json": "{}\n",
    "dist/installer/prompts/prompt.md": "prompt\n",
    "dist/installer/steps/nested/step.md": "step\n",
    "dist/internal-production/baseline-post-handoff-receipt-v1.js": "// compiled observer fixture\n",
    "dist/internal-production/product-build-authority-v2-delivery-evidence-v1.js": "// compiled PBA fixture\n",
    "dist/product-compiler/canonical-json.js": "// compiled canonical fixture\n",
    "dist/server/index.html": "<!doctype html>fixture\n",
    "dist/server/index.js": "export const server = true;\n",
  });
  for (const [locator, bytes] of Object.entries(outputs)) fixtureFile(root, locator, bytes, 0o600);
}

function finalizedFixture(options: FixtureOptions = {}): Readonly<{ root: string; buildInputSetHash: string }> {
  const root = createFixture(options);
  const prepared = runProducer(root, "--prepare");
  assert.equal(prepared.status, 0, prepared.stderr);
  const receipt = JSON.parse(readFileSync(path.join(root, "dist/PLATFORM_BUILD_PREPARE.json"), "utf8"));
  materializeOutputs(root);
  const finalized = runProducer(root, "--finalize");
  assert.equal(finalized.status, 0, finalized.stderr);
  return Object.freeze({ root, buildInputSetHash: receipt.buildInputSetHash });
}

function runObserver(root: string): ReturnType<typeof spawnSync> {
  const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
  const program = `import(${JSON.stringify(moduleUrl)}).then(async (m) => process.stdout.write(JSON.stringify(await m.observeCurrentInternalProductionCleanSetfarmSourceBuildV1()) + "\\n"))`;
  return spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function runFixtureExpression(root: string, expression: string): ReturnType<typeof spawnSync> {
  const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
  return spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => ${expression})`], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function runFixtureExpressionAsync(root: string, expression: string): Promise<Readonly<{ status: number | null; stdout: string; stderr: string }>> {
  const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => ${expression})`], {
      cwd: root,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve(Object.freeze({ status, stdout, stderr })));
  });
}

function currentEntryStore(root: string): string {
  return path.join(path.dirname(root), "data/internal-production-baseline/current-entry-v1");
}

function currentEntryMembers(store: string, basename: string): readonly string[] {
  return existsSync(store)
    ? readdirSync(store).filter((name) => name === basename || name.startsWith(`.${basename}.`)).sort()
    : [];
}

async function loadDatabaseOnlyForIsolatedLifecycleTest<T>(
  rawDatabaseUrl: string | undefined,
  loadDatabase: () => Promise<T>,
): Promise<T | undefined> {
  if (rawDatabaseUrl === undefined) return undefined;
  const parsed = new URL(rawDatabaseUrl);
  assert.match(
    parsed.pathname,
    /^\/setfarm_contract_spine_test_[a-z0-9_]+$/,
    "ISOLATED_LIFECYCLE_DATABASE_URL_REQUIRED",
  );
  assert.equal(process.env.SETFARM_TEST_PG_ADMIN_URL, undefined, "ISOLATED_LIFECYCLE_ADMIN_URL_FORBIDDEN_IN_CHILD");
  return loadDatabase();
}

describe("OA17 zero-input current Setfarm source/build observation", () => {
  it("does not receive the isolated-runner administrator URL in a database child", () => {
    if (process.env.SETFARM_PG_URL === undefined) return;
    assert.equal(process.env.SETFARM_TEST_PG_ADMIN_URL, undefined);
  });

  it("rejects an ambient child database URL before reading the administrator URL", () => {
    const result = spawnSync(process.execPath, ["--import", tsxLoader, isolatedRunner, "--", "node", "--import", "tsx", "--test", "--test-concurrency=1", observerSource], {
      cwd: sourceRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        SETFARM_PG_URL: "postgresql://ambient.invalid:1/ambient",
        SETFARM_TEST_PG_ADMIN_URL: "not-a-postgres-url",
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ISOLATED_TEST_AMBIENT_PG_URL_FORBIDDEN/);
  });

  it("exports the current-entry immutable record API without eagerly loading PostgreSQL", async () => {
    const loaded = await import(`${pathToFileURL(observerSource).href}?slice-b-api=${Date.now()}`) as Record<string, unknown>;
    assert.equal(typeof loaded.observeCurrentInternalProductionAuthorityV3Migration31AuditV1, "function");
    assert.equal(typeof loaded.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1, "function");
    assert.equal(typeof loaded.prepareInternalProductionCurrentEntryOperationV1, "function");
    assert.equal(typeof loaded.observePreparedInternalProductionCurrentEntryOperationV1, "function");
    assert.equal(typeof loaded.resolveInternalProductionCurrentEntryOperationV1, "function");
  });

  it("returns null for an absent prepared operation without creating current-entry state", () => {
    const root = createFixture();
    try {
      const workspace = path.dirname(root);
      const before = readdirSync(workspace).sort();
      const result = runFixtureExpression(
        root,
        "m.observePreparedInternalProductionCurrentEntryOperationV1().then((value) => process.stdout.write(JSON.stringify(value)))",
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "null");
      assert.deepEqual(readdirSync(workspace).sort(), before);
      assert.equal(existsSync(currentEntryStore(root)), false);
    } finally {
      removeFixture(root);
    }
  });

  it("rejects a temporary or foreign prepared-operation inventory instead of returning absence", () => {
    for (const name of [
      ".current-entry-operation.json.12345678-1234-4123-8123-123456789abc.tmp",
      "foreign-current-entry-member",
    ]) {
      const root = createFixture();
      try {
        const store = currentEntryStore(root);
        for (const directory of [
          path.join(path.dirname(root), "data"),
          path.join(path.dirname(root), "data/internal-production-baseline"),
          store,
        ]) {
          mkdirSync(directory, { recursive: true, mode: 0o700 });
          chmodSync(directory, 0o700);
        }
        writeFileSync(path.join(store, name), "{}\n", { mode: 0o600 });
        chmodSync(path.join(store, name), 0o600);
        const result = runFixtureExpression(
          root,
          "m.observePreparedInternalProductionCurrentEntryOperationV1()",
        );
        assert.notEqual(result.status, 0, `${name} must be corruption`);
        assert.match(result.stderr, /current-entry|inventory|foreign|temporary|corrupt/i);
        assert.equal(existsSync(path.join(store, name)), true);
      } finally {
        removeFixture(root);
      }
    }
  });

  it("returns the exact prepared operation and accepts valid fixed siblings as absence", () => {
    const fixture = finalizedFixture();
    try {
      const seeded = runFixtureExpression(
        fixture.root,
        "m.prepareInternalProductionCurrentEntryOperationV1().then((value) => process.stdout.write(JSON.stringify(value)))",
      );
      assert.equal(seeded.status, 0, seeded.stderr);
      const observed = runFixtureExpression(
        fixture.root,
        "m.observePreparedInternalProductionCurrentEntryOperationV1().then((value) => process.stdout.write(JSON.stringify(value)))",
      );
      assert.equal(observed.status, 0, observed.stderr);
      assert.deepEqual(JSON.parse(observed.stdout), JSON.parse(seeded.stdout));
      const frozen = runFixtureExpression(
        fixture.root,
        "m.observePreparedInternalProductionCurrentEntryOperationV1().then((value) => { const deep=(entry) => entry===null||typeof entry!==\"object\"||(Object.isFrozen(entry)&&Reflect.ownKeys(entry).every((key)=>{const descriptor=Object.getOwnPropertyDescriptor(entry,key);return !descriptor||!(\"value\" in descriptor)||deep(descriptor.value)})); process.stdout.write(String(deep(value))) })",
      );
      assert.equal(frozen.status, 0, frozen.stderr);
      assert.equal(frozen.stdout, "true");

      const store = currentEntryStore(fixture.root);
      unlinkSync(path.join(store, "current-entry-operation.json"));
      const siblingNames = readdirSync(store).sort();
      const siblingBytes = siblingNames.map((name) => readFileSync(path.join(store, name)));
      const absent = runFixtureExpression(
        fixture.root,
        "m.observePreparedInternalProductionCurrentEntryOperationV1().then((value) => process.stdout.write(JSON.stringify(value)))",
      );
      assert.equal(absent.status, 0, absent.stderr);
      assert.equal(absent.stdout, "null");
      assert.deepEqual(readdirSync(store).sort(), siblingNames);
      siblingNames.forEach((name, index) => assert.equal(
        readFileSync(path.join(store, name)).equals(siblingBytes[index]!),
        true,
      ));
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("blocks wrong-mode, hard-linked, symlink, special, and oversized prepared members without cleanup", () => {
    for (const physical of ["mode", "link", "symlink", "special", "size"] as const) {
      const fixture = finalizedFixture();
      try {
        const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
        assert.equal(seeded.status, 0, seeded.stderr);
        const operation = path.join(currentEntryStore(fixture.root), "current-entry-operation.json");
        if (physical === "mode") chmodSync(operation, 0o644);
        else if (physical === "link") linkSync(operation, path.join(path.dirname(currentEntryStore(fixture.root)), "operation-hard-link"));
        else if (physical === "symlink") {
          const target = `${operation}.target`;
          renameSync(operation, target);
          symlinkSync(target, operation);
        } else if (physical === "special") {
          unlinkSync(operation);
          execFileSync("/usr/bin/mkfifo", [operation]);
          chmodSync(operation, 0o600);
        } else writeFileSync(operation, Buffer.alloc(1_048_577), { mode: 0o600 });
        const before = physical === "special" ? null : lstatSync(operation);
        const blocked = runFixtureExpression(fixture.root, "m.observePreparedInternalProductionCurrentEntryOperationV1()");
        assert.notEqual(blocked.status, 0);
        assert.match(blocked.stderr, /regular|mode|link|member|current-entry|cap|symbolic/i);
        if (before !== null) {
          const after = lstatSync(operation);
          assert.equal(after.ino, before.ino);
          assert.equal(after.mode, before.mode);
          assert.equal(after.nlink, before.nlink);
          assert.equal(after.size, before.size);
        } else assert.equal(lstatSync(operation).isFIFO(), true);
      } finally {
        removeFixture(fixture.root);
      }
    }
  });

  it("rejects last-instant identity drift across every prepared family after parsing exact first snapshots", () => {
    for (const family of ["authorityV3Migration31Audit", "pendingBootstrapHandoffMigration", "operation"] as const) {
      const fixture = finalizedFixture({ preparedAccessorReobservationDrift: family });
      try {
        const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
        assert.equal(seeded.status, 0, seeded.stderr);
        const result = runFixtureExpression(fixture.root, "m.observePreparedInternalProductionCurrentEntryOperationV1()");
        assert.notEqual(result.status, 0, family);
        assert.match(result.stderr, /changed|identity|mode|prepared current-entry/i);
      } finally {
        removeFixture(fixture.root);
      }
    }
  });

  it("rejects a cross-device prepared member observation", () => {
    const fixture = finalizedFixture({ preparedAccessorWrongDevice: true });
    try {
      const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
      assert.equal(seeded.status, 0, seeded.stderr);
      const result = runFixtureExpression(fixture.root, "m.observePreparedInternalProductionCurrentEntryOperationV1()");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /device|regular|current-entry/i);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("rejects last-instant prepared operation byte drift from the retained first snapshot", () => {
    const fixture = finalizedFixture({ preparedAccessorByteDrift: true });
    try {
      const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
      assert.equal(seeded.status, 0, seeded.stderr);
      const result = runFixtureExpression(fixture.root, "m.observePreparedInternalProductionCurrentEntryOperationV1()");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /changed|prepared current-entry/i);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("does not turn a prepared store disappearance race into absence", () => {
    const fixture = finalizedFixture();
    try {
      const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
      assert.equal(seeded.status, 0, seeded.stderr);
      const modulePath = path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
      const source = readFileSync(modulePath, "utf8");
      const start = source.indexOf("function readCurrentEntryStore()");
      const end = source.indexOf("\n}\n\nfunction publisherEntry", start);
      assert.ok(start >= 0 && end > start);
      const original = source.slice(start, end);
      const raced = original.replace(
        "const observed = directorySnapshot(directory, `current-entry store ${segment}`, workspaceSnapshot.device);",
        "if(segment===\"current-entry-v1\"){lstatSync(directory);rmSync(directory,{recursive:true});} const observed = directorySnapshot(directory, `current-entry store ${segment}`, workspaceSnapshot.device);",
      );
      assert.notEqual(raced, original);
      writeFileSync(modulePath, `${source.slice(0, start)}${raced}${source.slice(end)}`);
      const result = runFixtureExpression(
        fixture.root,
        "m.observePreparedInternalProductionCurrentEntryOperationV1().then((value) => process.stdout.write(JSON.stringify(value)))",
      );
      assert.notEqual(result.status, 0, "a disappeared previously observed store must be corruption");
      assert.match(result.stderr, /current-entry|changed|absent|directory/i);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("requires a second no-follow absence observation before returning null", () => {
    const root = createFixture();
    try {
      const parent = path.dirname(currentEntryStore(root));
      for (const directory of [path.join(path.dirname(root), "data"), parent]) {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        chmodSync(directory, 0o700);
      }
      const modulePath = path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
      const source = readFileSync(modulePath, "utf8");
      const raced = source.replace(
        "assertDirectory(parentDirectory, parentSnapshot, `parent of absent current-entry store ${segment}`);\n      try {",
        "assertDirectory(parentDirectory, parentSnapshot, `parent of absent current-entry store ${segment}`); mkdirSync(directory,{mode:0o700});\n      try {",
      );
      assert.notEqual(raced, source);
      writeFileSync(modulePath, raced);
      const result = runFixtureExpression(
        root,
        "m.observePreparedInternalProductionCurrentEntryOperationV1().then((value) => process.stdout.write(JSON.stringify(value)))",
      );
      assert.notEqual(result.status, 0, "an appearing store must be corruption");
      assert.match(result.stderr, /current-entry|changed|absent|directory/i);
      assert.equal(existsSync(currentEntryStore(root)), true);
    } finally {
      removeFixture(root);
    }
  });

  it("declares only zero-input current-entry database composition ports without importing db-pg", () => {
    const source = readFileSync(dbSource, "utf8");
    assert.match(source, /export async function auditCurrentInternalProductionAuthorityV3Migration31V1\(\):/);
    assert.match(source, /export async function inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1\(\):/);
    assert.match(source, /const sql = getSql\(\);[\s\S]*await auditAuthorityV3ContractSpineThroughMigration31V1\(sql\);[\s\S]*await auditCurrentContractSpineAuthorityLedgersAtV31Data\(sql\);[\s\S]*await inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1\(sql\);/);
  });

  it("keeps a pair-only historical resolver read-only when its fixed record is absent", () => {
    const root = createFixture();
    try {
      const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const pair = {
        pendingBootstrapHandoffMigrationRef:
          `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${"a".repeat(64)}`,
        pendingBootstrapHandoffMigrationHash: "a".repeat(64),
      };
      const program = `import(${JSON.stringify(moduleUrl)}).then((m) => m.resolveInternalProductionPendingBootstrapHandoffMigrationV1(${JSON.stringify(pair)})).catch(() => {})`;
      const result = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(existsSync(path.join(path.dirname(root), "data/internal-production-baseline/current-entry-v1")), false);
    } finally {
      removeFixture(root);
    }
  });

  it("reopens only the exact pending-migration pair and rejects a stored hash tamper", () => {
    const root = createFixture();
    try {
      const store = path.join(path.dirname(root), "data/internal-production-baseline/current-entry-v1");
      mkdirSync(store, { recursive: true, mode: 0o700 });
      for (const directory of [path.join(path.dirname(root), "data"), path.join(path.dirname(root), "data/internal-production-baseline"), store]) {
        chmodSync(directory, 0o700);
      }
      const sourceSha = git(root, ["rev-parse", "HEAD"]);
      const sourceTreeHash = git(root, ["rev-parse", "HEAD^{tree}"]);
      const core = {
        schema: "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1",
        currentStatus: "current",
        controllerSource: {
          branch: "main",
          clean: true,
          sha: sourceSha,
          treeHash: sourceTreeHash,
          buildHash: "c".repeat(64),
          originMainSha: sourceSha,
        },
        pendingSuccessor: {
          schema: "setfarm.pending-bootstrap-main-claim-handoff-guarded-successor.v1",
          status: "exact_pending_guarded_successor",
          migration: {
            version: 32,
            name: "contract-spine-bootstrap-main-claim-handoff-v1",
            migrationClass: "guarded",
            checksum: "d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d",
            state: "pending",
          },
          migrationDigest: "8cbaab0c47bf3639033442d2df9a1c15d421eb34adbab72fa82951712cafe4e2",
          namedMigrationDigestEntryHash: "81d9164ca0f2c0be1cece391fc654a854c28ccfce905b87c3ad680202f95557c",
          orderedStatementsHash: "ccfcfdb6ed9e9d87add9e28394b2e67bf9ed55347841fe0529cdde4d6a5b34c9",
          expectedSchemaProjectionHash: "9f44b6312ba62fb7b48da153e70fa7f19ce543dbeec500b9111d750847a7eed1",
        },
        migrationImplementation: {
          locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts",
          gitMode: "100644",
          gitBlobHash: git(root, ["rev-parse", "HEAD:src/db/bootstrap-main-claim-handoff-v1-migration.ts"]),
        },
      };
      const pendingBootstrapHandoffMigrationHash = canonicalHash(core);
      const record = {
        ...core,
        pendingBootstrapHandoffMigrationRef:
          `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${pendingBootstrapHandoffMigrationHash}`,
        pendingBootstrapHandoffMigrationHash,
      };
      const recordPath = path.join(store, "pending-bootstrap-handoff-migration.json");
      writeFileSync(recordPath, `${canonical(record)}\n`, { mode: 0o600 });
      chmodSync(recordPath, 0o600);
      const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const runResolver = (pair: unknown) => spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then(async (m) => process.stdout.write(JSON.stringify(await m.resolveInternalProductionPendingBootstrapHandoffMigrationV1(${JSON.stringify(pair)}))))`], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env },
      });
      const pair = {
        pendingBootstrapHandoffMigrationRef: record.pendingBootstrapHandoffMigrationRef,
        pendingBootstrapHandoffMigrationHash,
      };
      const valid = runResolver(pair);
      assert.equal(valid.status, 0, valid.stderr);
      assert.equal(JSON.parse(valid.stdout).pendingBootstrapHandoffMigrationHash, pendingBootstrapHandoffMigrationHash);
      const tampered = runResolver({ ...pair, pendingBootstrapHandoffMigrationHash: "2".repeat(64) });
      assert.notEqual(tampered.status, 0);
      assert.match(tampered.stderr, /pair|hash/i);
      const invalidCore = {
        ...core,
        pendingSuccessor: {
          ...core.pendingSuccessor,
          migration: { ...core.pendingSuccessor.migration, state: "applied" },
        },
      };
      const invalidHash = canonicalHash(invalidCore);
      const invalidRecord = {
        ...invalidCore,
        pendingBootstrapHandoffMigrationRef:
          `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${invalidHash}`,
        pendingBootstrapHandoffMigrationHash: invalidHash,
      };
      writeFileSync(recordPath, `${canonical(invalidRecord)}\n`, { mode: 0o600 });
      chmodSync(recordPath, 0o600);
      const invalid = runResolver({
        pendingBootstrapHandoffMigrationRef: invalidRecord.pendingBootstrapHandoffMigrationRef,
        pendingBootstrapHandoffMigrationHash: invalidHash,
      });
      assert.notEqual(invalid.status, 0);
      assert.match(invalid.stderr, /migration 32|pending/i);
    } finally {
      removeFixture(root);
    }
  });

  it("publishes and adopts the three current-entry records in a finalized sibling-data fixture", () => {
    const fixture = finalizedFixture();
    try {
      const moduleUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const program = `import(${JSON.stringify(moduleUrl)}).then(async (m) => { const first=await m.prepareInternalProductionCurrentEntryOperationV1(); const second=await m.prepareInternalProductionCurrentEntryOperationV1(); process.stdout.write(JSON.stringify({first,second})); })`;
      const result = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], { cwd: fixture.root, encoding: "utf8", env: { ...process.env } });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout).first, JSON.parse(result.stdout).second);
      const store = path.join(path.dirname(fixture.root), "data/internal-production-baseline/current-entry-v1");
      assert.deepEqual(["authority-v3-migration31-audit.json", "pending-bootstrap-handoff-migration.json", "current-entry-operation.json"].map((name) => existsSync(path.join(store, name))), [true, true, true]);
      const fixed = path.join(store, "authority-v3-migration31-audit.json");
      const responseLossTemp = path.join(store, ".authority-v3-migration31-audit.json.12345678-1234-4123-8123-123456789abc.tmp");
      linkSync(fixed, responseLossTemp);
      const adopt = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1())`], { cwd: fixture.root, encoding: "utf8", env: { ...process.env } });
      assert.equal(adopt.status, 0, adopt.stderr);
      assert.equal(existsSync(responseLossTemp), false);
      assert.equal(lstatSync(fixed).nlink, 1);
      const blockedTemp = path.join(store, ".authority-v3-migration31-audit.json.12345678-1234-4123-8123-123456789abd.tmp");
      linkSync(fixed, blockedTemp);
      const foreign = path.join(store, "foreign-current-entry-record");
      writeFileSync(foreign, "foreign\n", { mode: 0o600 });
      chmodSync(foreign, 0o600);
      const blocked = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1())`], { cwd: fixture.root, encoding: "utf8", env: { ...process.env } });
      assert.notEqual(blocked.status, 0);
      assert.match(blocked.stderr, /foreign|unknown/i);
      assert.equal(existsSync(blockedTemp), true);
      unlinkSync(foreign);
      unlinkSync(blockedTemp);
      const pendingFixed = path.join(store, "pending-bootstrap-handoff-migration.json");
      const v31BeforeInvalidFixed = readFileSync(fixed);
      writeFileSync(pendingFixed, "{}\n", { mode: 0o600 });
      chmodSync(pendingFixed, 0o600);
      const invalidFixed = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1())`], { cwd: fixture.root, encoding: "utf8", env: { ...process.env } });
      assert.notEqual(invalidFixed.status, 0);
      assert.equal(readFileSync(fixed).equals(v31BeforeInvalidFixed), true);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("cleans a semantic-invalid sole temp in a non-target family but preserves a physical-invalid temp", () => {
    const semanticFixture = finalizedFixture();
    const physicalFixture = finalizedFixture();
    try {
      const runV31Observer = (root: string) => {
        const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
        return spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1())`], {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env },
        });
      };
      const createStore = (root: string) => {
        const workspace = path.dirname(root);
        const directories = [
          path.join(workspace, "data"),
          path.join(workspace, "data/internal-production-baseline"),
          path.join(workspace, "data/internal-production-baseline/current-entry-v1"),
        ];
        for (const directory of directories) {
          mkdirSync(directory, { mode: 0o700 });
          chmodSync(directory, 0o700);
        }
        return directories[2]!;
      };

      const semanticStore = createStore(semanticFixture.root);
      const semanticTemp = path.join(semanticStore, ".pending-bootstrap-handoff-migration.json.12345678-1234-4123-8123-123456789abc.tmp");
      writeFileSync(semanticTemp, "{}\n", { mode: 0o600 });
      chmodSync(semanticTemp, 0o600);
      const recovered = runV31Observer(semanticFixture.root);
      assert.equal(recovered.status, 0, recovered.stderr);
      assert.equal(existsSync(semanticTemp), false);
      assert.equal(existsSync(path.join(semanticStore, "pending-bootstrap-handoff-migration.json")), false);
      assert.equal(existsSync(path.join(semanticStore, "authority-v3-migration31-audit.json")), true);

      const physicalStore = createStore(physicalFixture.root);
      const physicalTemp = path.join(physicalStore, ".pending-bootstrap-handoff-migration.json.12345678-1234-4123-8123-123456789abd.tmp");
      writeFileSync(physicalTemp, "{}\n", { mode: 0o644 });
      chmodSync(physicalTemp, 0o644);
      const blocked = runV31Observer(physicalFixture.root);
      assert.notEqual(blocked.status, 0);
      assert.match(blocked.stderr, /identity|mode|publisher/i);
      assert.equal(existsSync(physicalTemp), true);
      assert.equal(existsSync(path.join(physicalStore, "authority-v3-migration31-audit.json")), false);
    } finally {
      removeFixture(semanticFixture.root);
      removeFixture(physicalFixture.root);
    }
  });

  it("leaves the operation absent when v31 changes at the prepublication reobservation fence", () => {
    const fixture = finalizedFixture({ v31ReobservationDrift: true });
    try {
      const moduleUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const result = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => m.prepareInternalProductionCurrentEntryOperationV1())`], {
        cwd: fixture.root,
        encoding: "utf8",
        env: { ...process.env },
      });
      const operation = path.join(path.dirname(fixture.root), "data/internal-production-baseline/current-entry-v1/current-entry-operation.json");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /changed|differs|blocked|prerequisite/i);
      assert.equal(existsSync(operation), false);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("rejects an operation whose PBA response pair is crossed with its body before publication", () => {
    const fixture = finalizedFixture({ crossedPbaResponse: true });
    try {
      const moduleUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const result = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m) => m.prepareInternalProductionCurrentEntryOperationV1())`], {
        cwd: fixture.root,
        encoding: "utf8",
        env: { ...process.env },
      });
      const operation = path.join(path.dirname(fixture.root), "data/internal-production-baseline/current-entry-v1/current-entry-operation.json");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /PBA|delivery evidence|crossed|pair|hash/i);
      assert.equal(existsSync(operation), false);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("classifies every non-target family topology before publishing another family", () => {
    const fixedLinkFixture = finalizedFixture();
    const soleTempLinkFixture = finalizedFixture();
    const forkFixture = finalizedFixture();
    try {
      for (const fixture of [fixedLinkFixture, soleTempLinkFixture, forkFixture]) {
        const seeded = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
        assert.equal(seeded.status, 0, seeded.stderr);
      }
      const v31Name = "authority-v3-migration31-audit.json";
      const pendingName = "pending-bootstrap-handoff-migration.json";

      const fixedLinkStore = currentEntryStore(fixedLinkFixture.root);
      linkSync(path.join(fixedLinkStore, v31Name), path.join(path.dirname(fixedLinkFixture.root), "unmatched-v31-link"));
      const fixedLinkBlocked = runFixtureExpression(fixedLinkFixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.notEqual(fixedLinkBlocked.status, 0);
      assert.deepEqual(currentEntryMembers(fixedLinkStore, pendingName), []);

      const soleTempStore = currentEntryStore(soleTempLinkFixture.root);
      const soleTemp = path.join(soleTempStore, ".authority-v3-migration31-audit.json.12345678-1234-4123-8123-123456789abc.tmp");
      renameSync(path.join(soleTempStore, v31Name), soleTemp);
      linkSync(soleTemp, path.join(path.dirname(soleTempLinkFixture.root), "unmatched-v31-temp-link"));
      const soleTempBlocked = runFixtureExpression(soleTempLinkFixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.notEqual(soleTempBlocked.status, 0);
      assert.deepEqual(currentEntryMembers(soleTempStore, pendingName), []);

      const forkStore = currentEntryStore(forkFixture.root);
      const fixed = JSON.parse(readFileSync(path.join(forkStore, v31Name), "utf8"));
      fixed.currentAuthorityAudit.artifactPublicationAuthorityLedger.batchPlanCount = 1;
      fixed.currentAuthorityAuditHash = canonicalHash(fixed.currentAuthorityAudit);
      const forkProjection = { ...fixed };
      delete forkProjection.authorityV3Migration31AuditRef;
      delete forkProjection.authorityV3Migration31AuditHash;
      fixed.authorityV3Migration31AuditHash = canonicalHash(forkProjection);
      fixed.authorityV3Migration31AuditRef = `setfarm://internal-production/authority-v3-migration31-audit/sha256/${fixed.authorityV3Migration31AuditHash}`;
      const forkTemp = path.join(forkStore, ".authority-v3-migration31-audit.json.12345678-1234-4123-8123-123456789abd.tmp");
      writeFileSync(forkTemp, `${canonical(fixed)}\n`, { mode: 0o600 });
      chmodSync(forkTemp, 0o600);
      const forkBlocked = runFixtureExpression(forkFixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.notEqual(forkBlocked.status, 0);
      assert.deepEqual(currentEntryMembers(forkStore, pendingName), []);
      assert.equal(existsSync(forkTemp), true);
    } finally {
      removeFixture(fixedLinkFixture.root);
      removeFixture(soleTempLinkFixture.root);
      removeFixture(forkFixture.root);
    }
  });

  it("does not clean a semantic-invalid sole temp with link count two", () => {
    const fixture = finalizedFixture();
    try {
      const store = currentEntryStore(fixture.root);
      for (const directory of [path.join(path.dirname(fixture.root), "data"), path.dirname(store), store]) {
        mkdirSync(directory, { mode: 0o700 });
        chmodSync(directory, 0o700);
      }
      const temp = path.join(store, ".pending-bootstrap-handoff-migration.json.12345678-1234-4123-8123-123456789abc.tmp");
      writeFileSync(temp, "{}\n", { mode: 0o600 });
      chmodSync(temp, 0o600);
      linkSync(temp, path.join(path.dirname(fixture.root), "invalid-temp-second-link"));
      const result = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
      assert.notEqual(result.status, 0);
      assert.equal(existsSync(temp), true);
      assert.deepEqual(currentEntryMembers(store, "authority-v3-migration31-audit.json"), []);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("strict-validates complete observer candidates before creating fixed or temp records", () => {
    const cases = [
      { options: { v31AuditExtra: true }, basename: "authority-v3-migration31-audit.json", expression: "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()" },
      { options: { pendingExtra: true }, basename: "pending-bootstrap-handoff-migration.json", expression: "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()" },
      { options: { pbaObservationExtra: true }, basename: "current-entry-operation.json", expression: "m.prepareInternalProductionCurrentEntryOperationV1()" },
      { options: { pbaResponseExtra: true }, basename: "current-entry-operation.json", expression: "m.prepareInternalProductionCurrentEntryOperationV1()" },
    ] as const;
    for (const testCase of cases) {
      const fixture = finalizedFixture(testCase.options);
      try {
        const result = runFixtureExpression(fixture.root, testCase.expression);
        assert.notEqual(result.status, 0, testCase.basename);
        assert.deepEqual(currentEntryMembers(currentEntryStore(fixture.root), testCase.basename), [], testCase.basename);
      } finally {
        removeFixture(fixture.root);
      }
    }
  });

  it("rejects every v1-through-v31 identity/checksum tamper and nested full-audit extra/type tamper", () => {
    const fixture = finalizedFixture();
    try {
      const seeded = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
      assert.equal(seeded.status, 0, seeded.stderr);
      const recordPath = path.join(currentEntryStore(fixture.root), "authority-v3-migration31-audit.json");
      const original = JSON.parse(readFileSync(recordPath, "utf8"));
      const mutations: Array<Record<string, unknown>> = [];
      const finalize = (record: Record<string, any>) => {
        const projection = { ...record };
        delete projection.authorityV3Migration31AuditRef;
        delete projection.authorityV3Migration31AuditHash;
        const hash = canonicalHash(projection);
        record.authorityV3Migration31AuditHash = hash;
        record.authorityV3Migration31AuditRef = `setfarm://internal-production/authority-v3-migration31-audit/sha256/${hash}`;
        mutations.push(record);
      };
      for (let index = 0; index < 31; index += 1) {
        const identity = structuredClone(original);
        identity.authorityV3ContractSpineThroughMigration31.migrations[index].name += "-tampered";
        finalize(identity);
        const checksum = structuredClone(original);
        checksum.authorityV3ContractSpineThroughMigration31.migrations[index].checksum = "0".repeat(64);
        finalize(checksum);
      }
      const nestedExtra = structuredClone(original);
      nestedExtra.currentAuthorityAudit.artifactPublicationAuthorityLedger.extra = true;
      nestedExtra.currentAuthorityAuditHash = canonicalHash(nestedExtra.currentAuthorityAudit);
      finalize(nestedExtra);
      const nestedType = structuredClone(original);
      nestedType.currentAuthorityAudit.platformReleaseStoreRecordLedger.recordCount = "0";
      nestedType.currentAuthorityAuditHash = canonicalHash(nestedType.currentAuthorityAudit);
      finalize(nestedType);

      const moduleUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const cases = mutations.map((record) => ({
        bytes: `${canonical(record)}\n`,
        pair: {
          authorityV3Migration31AuditRef: record.authorityV3Migration31AuditRef,
          authorityV3Migration31AuditHash: record.authorityV3Migration31AuditHash,
        },
      }));
      const program = `import{writeFileSync,chmodSync}from"node:fs";import(${JSON.stringify(moduleUrl)}).then(async(m)=>{let rejected=0;for(const c of ${JSON.stringify(cases)}){writeFileSync(${JSON.stringify(recordPath)},c.bytes);chmodSync(${JSON.stringify(recordPath)},0o600);try{await m.resolveInternalProductionAuthorityV3Migration31AuditV1(c.pair)}catch{rejected+=1}}process.stdout.write(String(rejected))})`;
      const result = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], { cwd: fixture.root, encoding: "utf8", env: { ...process.env } });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(Number(result.stdout), cases.length);
      assert.equal(cases.length, 64);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("rejects each crossed pending-v32 derived commitment", () => {
    const fixture = finalizedFixture();
    try {
      const seeded = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.equal(seeded.status, 0, seeded.stderr);
      const recordPath = path.join(currentEntryStore(fixture.root), "pending-bootstrap-handoff-migration.json");
      const original = JSON.parse(readFileSync(recordPath, "utf8"));
      const mutations = ["checksum", "migrationDigest", "namedMigrationDigestEntryHash", "orderedStatementsHash", "expectedSchemaProjectionHash"].map((field) => {
        const record = structuredClone(original);
        if (field === "checksum") record.pendingSuccessor.migration.checksum = "0".repeat(64);
        else record.pendingSuccessor[field] = "0".repeat(64);
        const projection = { ...record };
        delete projection.pendingBootstrapHandoffMigrationRef;
        delete projection.pendingBootstrapHandoffMigrationHash;
        const hash = canonicalHash(projection);
        record.pendingBootstrapHandoffMigrationHash = hash;
        record.pendingBootstrapHandoffMigrationRef = `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${hash}`;
        return record;
      });
      const moduleUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const cases = mutations.map((record) => ({ bytes: `${canonical(record)}\n`, pair: { pendingBootstrapHandoffMigrationRef: record.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: record.pendingBootstrapHandoffMigrationHash } }));
      const program = `import{writeFileSync,chmodSync}from"node:fs";import(${JSON.stringify(moduleUrl)}).then(async(m)=>{let rejected=0;for(const c of ${JSON.stringify(cases)}){writeFileSync(${JSON.stringify(recordPath)},c.bytes);chmodSync(${JSON.stringify(recordPath)},0o600);try{await m.resolveInternalProductionPendingBootstrapHandoffMigrationV1(c.pair)}catch{rejected+=1}}process.stdout.write(String(rejected))})`;
      const result = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], { cwd: fixture.root, encoding: "utf8", env: { ...process.env } });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(Number(result.stdout), 5);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("recovers complete v31 and pending temp-only crash states before publishing the operation", () => {
    const fixture = finalizedFixture();
    try {
      const v31 = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
      const pending = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.equal(v31.status, 0, v31.stderr);
      assert.equal(pending.status, 0, pending.stderr);
      const store = currentEntryStore(fixture.root);
      const v31Temp = ".authority-v3-migration31-audit.json.12345678-1234-4123-8123-123456789abc.tmp";
      const pendingTemp = ".pending-bootstrap-handoff-migration.json.12345678-1234-4123-8123-123456789abd.tmp";
      renameSync(path.join(store, "authority-v3-migration31-audit.json"), path.join(store, v31Temp));
      renameSync(path.join(store, "pending-bootstrap-handoff-migration.json"), path.join(store, pendingTemp));
      const recovered = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
      assert.equal(recovered.status, 0, recovered.stderr);
      assert.deepEqual(readdirSync(store).sort(), ["authority-v3-migration31-audit.json", "current-entry-operation.json", "pending-bootstrap-handoff-migration.json"]);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("normalizes every non-target family pre-link and response-loss state before unrelated publication", () => {
    const families = [
      { basename: "authority-v3-migration31-audit.json", publish: "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()" },
      { basename: "pending-bootstrap-handoff-migration.json", publish: "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()" },
      { basename: "current-entry-operation.json", publish: "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()" },
    ] as const;
    const expected = ["authority-v3-migration31-audit.json", "current-entry-operation.json", "pending-bootstrap-handoff-migration.json"];
    const failures: string[] = [];
    for (const family of families) {
      for (const state of ["pre-link", "response-loss"] as const) {
        const fixture = finalizedFixture();
        try {
          const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
          assert.equal(seeded.status, 0, seeded.stderr);
          const store = currentEntryStore(fixture.root);
          const fixed = path.join(store, family.basename);
          const tempName = `.${family.basename}.12345678-1234-4123-8123-123456789abc.tmp`;
          const temp = path.join(store, tempName);
          if (state === "pre-link") renameSync(fixed, temp);
          else linkSync(fixed, temp);
          const published = runFixtureExpression(fixture.root, family.publish);
          if (published.status !== 0 || canonical(readdirSync(store).sort()) !== canonical(expected)) {
            failures.push(`${family.basename}:${state}:${published.status}:${published.stderr}`);
          }
        } finally {
          removeFixture(fixture.root);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  it("resnapshots when two publishers contend on non-target pre-link and response-loss normalization", async () => {
    for (const state of ["pre-link", "response-loss"] as const) {
      const fixture = finalizedFixture({ normalizationContentionBarrier: true });
      try {
        const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
        assert.equal(seeded.status, 0, seeded.stderr);
        const store = currentEntryStore(fixture.root);
        const fixed = path.join(store, "authority-v3-migration31-audit.json");
        const temp = path.join(store, ".authority-v3-migration31-audit.json.12345678-1234-4123-8123-123456789abc.tmp");
        if (state === "pre-link") renameSync(fixed, temp);
        else linkSync(fixed, temp);
        const results = await Promise.all([
          runFixtureExpressionAsync(fixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()"),
          runFixtureExpressionAsync(fixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()"),
        ]);
        assert.deepEqual(results.map((result) => result.status), [0, 0], results.map((result) => result.stderr).join("\n"));
        assert.deepEqual(readdirSync(store).sort(), ["authority-v3-migration31-audit.json", "current-entry-operation.json", "pending-bootstrap-handoff-migration.json"]);
      } finally {
        removeFixture(fixture.root);
      }
    }
  });

  it("keeps no-environment lifecycle execution test-safe before db-pg import", async () => {
    let databaseImports = 0;
    const result = await loadDatabaseOnlyForIsolatedLifecycleTest(undefined, async () => {
      databaseImports += 1;
      return "unreachable";
    });
    assert.equal(result, undefined);
    assert.equal(databaseImports, 0);
  });

  it("fails closed at v32 then observes the exact v31/pending lifecycle after a same-database public reset", async (t) => {
    const db = await loadDatabaseOnlyForIsolatedLifecycleTest(
      process.env.SETFARM_PG_URL,
      async () => import(`${pathToFileURL(dbSource).href}?slice-b-lifecycle=${Date.now()}`) as Promise<typeof import("../../src/db-pg.js")>,
    );
    if (db === undefined) {
      t.skip("ISOLATED_LIFECYCLE_DATABASE_URL_REQUIRED");
      return;
    }
    const migrations = await import("../../src/db/contract-spine-migrations.js");
    await assert.rejects(
      db.auditCurrentInternalProductionAuthorityV3Migration31V1(),
      /MIGRATION_INCOMPLETE|Migration-31|version 32/i,
    );
    const sql = db.getSql();
    await sql.unsafe("DROP SCHEMA public CASCADE");
    await sql.unsafe("CREATE SCHEMA public");
    const automatic = await migrations.applyContractSpineMigrations(sql);
    assert.deepEqual(automatic.guardedPending, ["contract-spine-bootstrap-main-claim-handoff-v1"]);
    const audit = await db.auditCurrentInternalProductionAuthorityV3Migration31V1();
    assert.equal(audit.authorityV3ContractSpineThroughMigration31.throughVersion, 31);
    assert.equal(audit.currentAuthorityAudit.status, "verified");
    const pending = await db.inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
    assert.equal(pending.status, "exact_pending_guarded_successor");
    assert.equal(pending.migration.version, 32);
    assert.equal(pending.migration.state, "pending");
  });

  it("exports the zero-input observer from an import-inert module", async () => {
    const loaded = existsSync(observerSource)
      ? await import(`${pathToFileURL(observerSource).href}?oa17=${Date.now()}`)
      : undefined;
    assert.equal(
      typeof loaded?.observeCurrentInternalProductionCleanSetfarmSourceBuildV1,
      "function",
      "production must export observeCurrentInternalProductionCleanSetfarmSourceBuildV1",
    );
  });

  it("keeps the observer boundary zero-input, code-owned, and free of fallback seams", () => {
    const source = readFileSync(observerSource, "utf8");
    const runtimeExports = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)]
      .map((match) => match[1]);
    assert.deepEqual(runtimeExports, [
      "observeCurrentInternalProductionCleanSetfarmSourceBuildV1",
      "observeCurrentInternalProductionAuthorityV3Migration31AuditV1",
      "observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1",
      "resolveInternalProductionAuthorityV3Migration31AuditV1",
      "resolveInternalProductionPendingBootstrapHandoffMigrationV1",
      "observePreparedInternalProductionCurrentEntryOperationV1",
      "prepareInternalProductionCurrentEntryOperationV1",
      "resolveInternalProductionCurrentEntryOperationV1",
    ]);
    assert.match(source, /export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1\(\)/);
    assert.match(source, /export async function observePreparedInternalProductionCurrentEntryOperationV1\(\)/);
    assert.doesNotMatch(source, /process\.(?:env|argv|cwd)\b/);
    assert.doesNotMatch(source, /\b(?:fallback|packagedFallback|repositoryRoot|gitBinary|toolPath)\s*[:=]/i);
    assert.match(source, /spawnSync\("\/usr\/bin\/git"/);
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(imports.filter((specifier) => specifier.startsWith(".")), ["../product-compiler/canonical-json.js"]);
  });

  it("returns only the clean current source tuple and exact controller build hash", () => {
    const fixture = finalizedFixture();
    try {
      const observed = runObserver(fixture.root);
      assert.equal(observed.status, 0, observed.stderr);
      const value = JSON.parse(observed.stdout.trim());
      const sha = git(fixture.root, ["rev-parse", "HEAD"]);
      const treeHash = git(fixture.root, ["rev-parse", "HEAD^{tree}"]);
      const info = JSON.parse(readFileSync(path.join(fixture.root, "dist/BUILD_INFO.json"), "utf8"));
      const outputTree = JSON.parse(readFileSync(path.join(fixture.root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), "utf8"));
      const manifest = JSON.parse(readFileSync(path.join(fixture.root, "dist/PLATFORM_RELEASE_MANIFEST.json"), "utf8"));
      const stableBuildInfo = {
        schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
        sha: info.sha,
        shortSha: info.shortSha,
        branch: info.branch,
        dirty: info.dirty,
        packageVersion: info.packageVersion,
        displayVersion: info.displayVersion,
      };
      const expectedBuildHash = canonicalHash({
        schema: "setfarm.internal-production-controller-build.v1",
        stableBuildInfo,
        buildInputSetHash: fixture.buildInputSetHash,
        outputTreeHash: outputTree.outputTreeHash,
        releaseManifestHash: canonicalHash(manifest),
      });
      assert.deepEqual(value, {
        branch: "main",
        clean: true,
        sha,
        treeHash,
        buildHash: expectedBuildHash,
        originMainSha: sha,
      });
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("excludes valid builtAt metadata from controller build identity", () => {
    const fixture = finalizedFixture();
    try {
      const first = runObserver(fixture.root);
      assert.equal(first.status, 0, first.stderr);
      const infoPath = path.join(fixture.root, "dist/BUILD_INFO.json");
      const info = JSON.parse(readFileSync(infoPath, "utf8"));
      info.builtAt = "2040-01-02T03:04:05.006Z";
      chmodSync(infoPath, 0o644);
      writeFileSync(infoPath, `${JSON.stringify(info, null, 2)}\n`);
      chmodSync(infoPath, 0o444);
      const second = runObserver(fixture.root);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(JSON.parse(second.stdout).buildHash, JSON.parse(first.stdout).buildHash);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("rejects deterministic manifest tamper and hidden tracked drift", () => {
    const manifestFixture = finalizedFixture();
    const driftFixture = finalizedFixture();
    try {
      const manifestPath = path.join(manifestFixture.root, "dist/PLATFORM_RELEASE_MANIFEST.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.stitchConverter.source.byteLength += 1;
      chmodSync(manifestPath, 0o644);
      writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
      chmodSync(manifestPath, 0o444);
      const tampered = runObserver(manifestFixture.root);
      assert.notEqual(tampered.status, 0);
      assert.match(tampered.stderr, /manifest|pinned/i);

      git(driftFixture.root, ["update-index", "--skip-worktree", "package.json"]);
      writeFileSync(path.join(driftFixture.root, "package.json"), `${readFileSync(path.join(driftFixture.root, "package.json"), "utf8")} `);
      assert.equal(git(driftFixture.root, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
      const drifted = runObserver(driftFixture.root);
      assert.notEqual(drifted.status, 0);
      assert.match(drifted.stderr, /pinned Git blob|live tracked/i);
    } finally {
      removeFixture(manifestFixture.root);
      removeFixture(driftFixture.root);
    }
  });

  it("rejects reordered, duplicate-key, and alternate-whitespace authority bytes", () => {
    const infoFixture = finalizedFixture();
    const treeFixture = finalizedFixture();
    try {
      const infoPath = path.join(infoFixture.root, "dist/BUILD_INFO.json");
      const info = JSON.parse(readFileSync(infoPath, "utf8")) as Record<string, unknown>;
      const reordered = {
        builtAt: info.builtAt,
        sha: info.sha,
        shortSha: info.shortSha,
        branch: info.branch,
        dirty: info.dirty,
        packageVersion: info.packageVersion,
        displayVersion: info.displayVersion,
      };
      chmodSync(infoPath, 0o644);
      writeFileSync(infoPath, `${JSON.stringify(reordered, null, 2)}\n`);
      chmodSync(infoPath, 0o444);
      const reorderedResult = runObserver(infoFixture.root);
      assert.notEqual(reorderedResult.status, 0);
      assert.match(reorderedResult.stderr, /BUILD_INFO|field|raw bytes/i);

      const treePath = path.join(treeFixture.root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json");
      const treeText = readFileSync(treePath, "utf8").trimEnd();
      const duplicateSchema = treeText.replace(
        '"schema":"setfarm.platform-build-output-tree.v1",',
        '"schema":"setfarm.platform-build-output-tree.v1","schema":"setfarm.platform-build-output-tree.v1",',
      );
      chmodSync(treePath, 0o644);
      writeFileSync(treePath, `${duplicateSchema}\n`);
      chmodSync(treePath, 0o444);
      const duplicateResult = runObserver(treeFixture.root);
      assert.notEqual(duplicateResult.status, 0);
      assert.match(duplicateResult.stderr, /output tree|raw bytes|field/i);
    } finally {
      rmSync(infoFixture.root, { recursive: true, force: true });
      rmSync(treeFixture.root, { recursive: true, force: true });
    }
  });

  it("rejects multiple local origin values even when source and artifacts are unchanged", () => {
    const fixture = finalizedFixture();
    try {
      git(fixture.root, ["remote", "set-url", "--add", "origin", "https://example.invalid/second.git"]);
      const observed = runObserver(fixture.root);
      assert.notEqual(observed.status, 0);
      assert.match(observed.stderr, /origin/i);
    } finally {
      removeFixture(fixture.root);
    }
  });
});
