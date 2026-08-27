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
  realpathSync,
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
const TASK12_P0_DELIVERY_COMMIT_SHA = "72aba7c721bffb42d3f5d7cab507360d4c588ccc";
const TASK12_P0_DELIVERY_TREE_HASH = "e72a466a4db2f55015ecd3a26936b87c89d43a0e";
const TASK12_P0_EXACT24_PATH_BLOB_SET_HASH = "e36c683184b25ecbe10e03b2eecc839213847cb82dd871b221f0813386080bbf";
const TASK12_P0_FOCUSED_VERIFICATION_HASH = "f54b4b6c56c4a908b5d6b57a05a86bef2bdf34e07b9bfd06ec47f7c5c72bd18a";
const TASK12_P0_ORDERED_PATH_BLOBS = Object.freeze([
  ["package.json", "371d381e6837b04dc533b7a70f3682d6235853e1"],
  ["src/db-pg.ts", "2d1fe1a9dbf786ee2b32a29cbdaa8db98583ec72"],
  ["src/execution/run-persistence.ts", "0d563d481dd7ce4824d0d73b2aa3ad0defb7d6c3"],
  ["src/execution/run-terminal-transition.ts", "4b5694b1acc7263ea7253306d0dd9a9eaf0bf1b3"],
  ["src/installer/run.ts", "7a3ea511cfa4802431ed5c22d5be7f5a0b0b3bfe"],
  ["src/internal-production/owner-admission-v1.ts", "f51859dd3a2fbefb79c14e011cc5647386610712"],
  ["src/internal-production/baseline-post-handoff-receipt-v1.ts", "e5aa3c53d5407ad3454e88094fd7b404d9468e43"],
  ["src/internal-production/baseline-restart-authority-retirement-v1.ts", "c1cf04d6e8fa124a972d87a50ff03cb973ddbf66"],
  ["src/internal-production/baseline-post-handoff-cli.ts", "f6b8ae085ec4f21aaba992fe008cccead8ff2f97"],
  ["src/internal-production/baseline-spawner-startup-admission-v1.ts", "8bf84adf743321e0dcddf1de84fae6c21eff590e"],
  ["src/internal-production/baseline-service-restart-sequence-v1.ts", "33d2cd3750650b0645aa6a58e623770dc0f441e4"],
  ["src/execution/runtime-completion.ts", "e6956fd9f705231d991538a7bc546e4d9b49a1ef"],
  ["src/spawner.ts", "f04ba9c5c1283b0cb79b58a012952950a34421a5"],
  ["tests/internal-production/baseline-post-handoff-cli.test.ts", "177992dff1f0f554b7026844f41f3823b003227b"],
  ["tests/internal-production/owner-admission-v1.test.ts", "18cfb10973e7212e42ac452830ae59eac0fc37cd"],
  ["tests/internal-production/baseline-post-handoff-receipt-v1.test.ts", "a232b52eb999004b2d28bf9dcdc5cee9c4a6a86c"],
  ["tests/internal-production/baseline-restart-authority-retirement-v1.test.ts", "b468f5080d955306311a31a03c810bd1b712b26f"],
  ["tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts", "a23c9b3ae853f36a97efd0523824aeb844ad5970"],
  ["tests/internal-production/baseline-spawner-startup-admission-v1.test.ts", "43c3a99b49efe6cd28cfe1ad8f0ac720a4f34495"],
  ["tests/internal-production/baseline-service-restart-sequence-v1.test.ts", "e717e08df2e237fd0d2cfc9cd3abf0678ce1a39f"],
  ["tests/execution-attempts/runtime-completion.test.ts", "09856184cca940a2e8afb44e5111ac75d3571cba"],
  ["tests/execution-attempts/run-protocol.test.ts", "c6a7e8050267cfef14b53e3348b0a6ba4602a0a8"],
  ["tests/execution-attempts/run-terminal-transition.test.ts", "175a7d7870597687eaac74b522edae22c6bf367b"],
  ["tests/claim-log-lifecycle.test.ts", "7d62803475e4acf06769bd0bbc623606a7ffc39b"],
] as const);
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
  currentEntryAncestorSwapAfterGuard?: boolean;
  stopAfterCurrentEntryOperationPublication?: boolean;
  stubServiceCensus?: boolean;
  preparedAuthorityDirectorySwap?: string;
  preparedAuthorityDirectoryWrongDevice?: boolean;
  preparedAccessorReobservationDrift?: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation";
  preparedAccessorByteDrift?: boolean;
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
  if (options.currentEntryAncestorSwapAfterGuard) {
    fixtureObserver = fixtureObserver.replace(
      'const currentEntryWriterTarget = path.join(store.directory, "current-entry-store");',
      'if(basename===CURRENT_ENTRY_FILES.pendingBootstrapHandoffMigration){const heldStore=path.join(path.dirname(store.directory),`held-current-entry-${process.pid}`);renameSync(store.directory,heldStore);mkdirSync(store.directory,{mode:0o700})} const currentEntryWriterTarget = path.join(store.directory, "current-entry-store");',
    );
  }
  if (options.stopAfterCurrentEntryOperationPublication) {
    fixtureObserver = fixtureObserver.replace(
      /\s+const controllerLock = await acquireTask12ControllerLockV1\(resolved\.operationHash\);\s+try \{ return await ensureTask12PreparedCurrentEntryStatusV1\(resolved\); \}\s+finally \{ releaseTask12ControllerLockV1\(controllerLock\); \}/g,
      "\n  return resolved;",
    );
  }
  if (options.stubServiceCensus) {
    const censusStart = fixtureObserver.indexOf("export async function observeInternalProductionServiceCensusV1(): Promise<InternalProductionServiceCensusV1> {");
    const censusEnd = fixtureObserver.indexOf("\n\nasync function observeLegacyDatabaseCensusV1", censusStart);
    assert.notEqual(censusStart, -1, "production service census start must remain fixture-readable");
    assert.notEqual(censusEnd, -1, "production service census end must remain fixture-readable");
    fixtureObserver = `${fixtureObserver.slice(0, censusStart)}export async function observeInternalProductionServiceCensusV1(): Promise<InternalProductionServiceCensusV1> {
  const setfarm = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const source = Object.freeze({ sha: setfarm.sha, treeHash: setfarm.treeHash, buildHash: setfarm.buildHash });
  const service = (label: string, pid: number, port: null | 3333 | 3080 | 18789) => {
    const common = {
      pid,
      processStartTimeEpochMs: 1_700_000_000_000 + pid,
      processIdentityHash: sha256(\`fixture-process:\${label}\`),
      serviceIdentityHash: sha256(\`fixture-service:\${label}\`),
      generationHash: sha256(\`fixture-generation:\${label}\`),
      loadedSourceSha: port === 18789 ? null : source.sha,
      loadedTreeHash: port === 18789 ? null : source.treeHash,
      loadedBuildHash: port === 18789 ? null : source.buildHash,
      processOwnerCount: 1 as const,
    };
    if (port === null) return recursivelyFreeze({ ...common, listener: null });
    return recursivelyFreeze({
      ...common,
      listenerOwnerCount: 1 as const,
      listener: { host: "127.0.0.1" as const, port, listenerIdentityHash: sha256(\`fixture-listener:\${label}:\${port}\`) },
    });
  };
  const body = {
    schema: "setfarm.internal-production-service-census.v1" as const,
    spawner: service("com.setrox.setfarm-spawner", 1001, null) as InternalProductionServiceCensusSpawnerV1,
    dashboard: service("com.setrox.setfarm-dashboard", 1002, 3333) as InternalProductionListeningServiceCensusV1,
    missionControl: service("com.setrox.mission-control", 1003, 3080) as InternalProductionListeningServiceCensusV1,
    openClaw: service("ai.openclaw.gateway", 1004, 18789) as InternalProductionListeningServiceCensusV1,
  };
  return recursivelyFreeze({ ...body, censusHash: hashCanonicalJson(body) });
}${fixtureObserver.slice(censusEnd)}`;
  }
  if (options.preparedAuthorityDirectorySwap) {
    fixtureObserver = fixtureObserver.replace(
      'assertDirectory(store.directory, storeBefore, "prepared current-entry store");\n  let operation:',
      `assertDirectory(store.directory, storeBefore, "prepared current-entry store"); { const authorityDirectory=path.join(store.directory,${JSON.stringify(options.preparedAuthorityDirectorySwap)}); const held=path.join(path.dirname(store.directory),${JSON.stringify(`held-${options.preparedAuthorityDirectorySwap}`)}); renameSync(authorityDirectory,held); mkdirSync(authorityDirectory,{mode:0o700}); }\n  let operation:`,
    );
  }
  if (options.preparedAuthorityDirectoryWrongDevice) {
    fixtureObserver = fixtureObserver.replace(
      'const directory = directorySnapshot(path.join(store.directory, entry), `prepared current-entry ${entry}`, store.device);',
      'const directory = directorySnapshot(path.join(store.directory, entry), `prepared current-entry ${entry}`, store.device + 1n);',
    );
  }
  fixtureFile(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts", fixtureObserver);
  fixtureFile(root, "src/internal-production/owner-admission-v1.ts", readFileSync(path.join(sourceRoot, "src/internal-production/owner-admission-v1.ts")));
  fixtureFile(root, "src/db/bootstrap-main-claim-handoff-v1-migration.ts", readFileSync(path.join(sourceRoot, "src/db/bootstrap-main-claim-handoff-v1-migration.ts")));
  fixtureFile(root, "src/db-pg.ts", fixtureDatabasePortSource(options));
  fixtureFile(root, "src/db/contract-spine-migration-digests.generated.ts", 'export const CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS={31:"f052eff1b45df0f00ffb844fe0d23b542eafa4789da5e90a329a8d756dfcdc3a"};\n');
  fixtureFile(root, "src/db/contract-spine-migration-source-integrity.ts", 'export const CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST={31:{}};\n');
  fixtureFile(root, "src/execution/v3-git-revision.ts", 'export function replayV3HistoricalGitCommitAncestryV1(){}\n');
  fixtureFile(root, "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts", fixturePbaPortSource(options));
  fixtureFile(root, "src/product-compiler/canonical-json.ts", readFileSync(path.join(sourceRoot, "src/product-compiler/canonical-json.ts")));
  fixtureFile(root, ".gitignore", "dist/\n.setfarm/\ndata/\n");
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

it("P4 current-entry status preserves every crash prefix", async () => {
  const controller = await import("../../src/internal-production/baseline-post-handoff-receipt-v1.js");
  const required = [
    ["resumeInternalProductionCurrentEntryAuthorityV1", 0],
    ["observeInternalProductionCurrentEntryAuthorityStatusV1", 0],
    ["resolveInternalProductionCurrentEntryAuthorityStatusV1", 1],
    ["resolveInternalProductionCurrentEntryAuthorityV1", 1],
    ["verifyCurrentInternalProductionCurrentEntryV1", 0],
    ["resolveInternalProductionCurrentEntryVerificationV1", 1],
    ["applyInternalProductionBaselineBootstrapHandoffMigrationV1", 1],
  ] as const;
  for (const [name, arity] of required) {
    const value = Reflect.get(controller, name);
    assert.equal(typeof value, "function", name);
    assert.equal((value as Function).length, arity, name);
  }
  for (const [name, arity] of [
    ["prepareInternalProductionRecoverySourceBootstrapRunV1", 0],
    ["resumeActiveInternalProductionRecoverySourceBootstrapRunV1", 0],
    ["observeInternalProductionRecoverySourceBootstrapStatusV1", 0],
    ["resolveInternalProductionRecoverySourceBootstrapPendingInputV1", 1],
    ["resolveInternalProductionRecoverySourceBootstrapOperationV1", 1],
  ] as const) {
    const value = Reflect.get(controller, name);
    assert.equal(typeof value, "function", name);
    assert.equal((value as Function).length, arity, name);
  }
  const source = readFileSync(observerSource, "utf8");
  assert.doesNotMatch(source, /migration-32 authorization store is not prepared|current-entry durable prefix requires controller recovery/);
  const orderedPorts = [
    "openInternalProductionCurrentEntryMigration32TransactionV1",
    "stageInternalProductionCurrentEntryMigration32InTransactionV1",
    "commitInternalProductionCurrentEntryMigration32TransactionV1",
    "applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1",
    "activateInternalProductionBaselineOwnerProducerManifestV1",
    "prepareRecoverySourceBootstrapHeldLockV1",
    "verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1",
    "initializeInternalProductionCurrentEntryDatabaseV1",
    "transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1",
    "resumeRecoverySourceBootstrapHeldLockV1",
  ];
  let cursor = -1;
  for (const port of orderedPorts) {
    const next = source.indexOf(port, cursor + 1);
    assert.ok(next > cursor, `${port} must occur after its predecessor`);
    cursor = next;
  }
  for (const required of [
    'hasExactKeys(migration, ["phase", "authorization", "consumption", "migrationReceipt", "currentAudit"])',
    'hasExactKeys(manifest, ["ownerProducerManifestActivationRef", "ownerProducerManifestActivationHash", "ownerProducerManifestHeadRef", "ownerProducerManifestHeadHash"])',
    'hasExactKeys(admission, ["phase", "sealedAdmission", "admissionReady", "loadedRuntimeServiceAuthority"])',
    'deriveTask12ResolvedAuthorityPairsV1(',
    'canonicalComparable(freshServices) !== canonicalComparable(fresh.serviceCensus)',
    'canonicalComparable(freshOwners) !== canonicalComparable(fresh.completeZeroOwnerCensusObservationBody)',
    'await resolveInternalProductionBootstrapHandoffCurrentAuditV1(phase.currentAudit as Readonly<{ bootstrapHandoffCurrentAuditRef: string; bootstrapHandoffCurrentAuditHash: string }>)',
    'recovery-source-bootstrap-pending-input.json',
    'recovery-source-bootstrap-visibility-head.json',
    'acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1',
    'const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1 = "Implement Tasks 1 and 2 from docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md exactly as written."',
    'planPath: "docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md"',
    'taskOrdinals: recursivelyFreeze([1, 2])',
    '"buildHash", "activationPreflightHash", "releaseAdmissionHash", "targetSourceRunReservationRef"',
    'resolveCurrentInternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1',
    'name === "authorityV3FocusedTestReceipt"',
    'name === "preMutationLoadedRuntimeServiceAuthority"',
    'name === "loadedRuntimeServiceAuthority"',
    'name === "ownerAdmissionFence"',
    'const focused = deliveryEvidence.focusedTests as Record<string, unknown>',
  ]) assert.ok(source.includes(required), `missing strict Task12 status/verifier behavior: ${required}`);
});

it("P4 reviewed D source build gate is invoked only and fail closed", async () => {
  const controller = await import("../../src/internal-production/baseline-post-handoff-receipt-v1.js");
  assert.equal(typeof controller.observeInternalProductionReviewedDSourceBuildGateV1, "function");
  assert.equal(controller.observeInternalProductionReviewedDSourceBuildGateV1.length, 0);
  assert.equal(typeof controller.observeInternalProductionServiceRestartCutoverReadinessCandidateV1, "function");
  assert.equal(controller.observeInternalProductionServiceRestartCutoverReadinessCandidateV1.length, 0);
});

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
    "dist/internal-production/owner-admission-v1.js": "// compiled owner admission fixture\n",
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

function runDetachedServiceHarness(label: "com.setrox.setfarm-spawner" | "com.setrox.setfarm-dashboard", fault = "none"): ReturnType<typeof spawnSync> {
  const source = readFileSync(observerSource, "utf8");
  const start = source.indexOf("type DetachedSetfarmServiceLabelV1 =");
  const end = source.indexOf("\nfunction observeServiceProcessV1(", start);
  assert.notEqual(start, -1, "detached service production slice must exist");
  assert.notEqual(end, -1, "detached service production slice must terminate before the direct launcher observer");
  const slice = source.slice(start, end).replace(
    "function observeDetachedSetfarmServiceV1(",
    "export function observeDetachedSetfarmServiceV1(",
  );
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-detached-census-")));
  const harnessPath = path.join(root, "harness.ts");
  const canonicalRoot = path.join(root, "workspace", "setfarm");
  const fixtureHome = path.join(root, "home");
  const launcher = path.join(fixtureHome, ".local", "bin", "setfarm");
  for (const locator of ["dist/cli/cli.js", "dist/spawner.js", "dist/server/daemon.js"]) fixtureFile(canonicalRoot, locator, `fixture ${locator}\n`, 0o600);
  mkdirSync(path.dirname(launcher), { recursive: true });
  symlinkSync(path.join(canonicalRoot, "dist", "cli", "cli.js"), launcher);
  const plistDirectory = path.join(fixtureHome, "Library", "LaunchAgents");
  const writePlist = (serviceLabel: "com.setrox.setfarm-spawner" | "com.setrox.setfarm-dashboard", args: readonly string[], stem: string) => fixtureFile(
    plistDirectory,
    `${serviceLabel}.plist`,
    JSON.stringify({
      StandardOutPath: path.join(fixtureHome, ".openclaw", "logs", `${stem}.watch.log`),
      EnvironmentVariables: {
        PATH: "/usr/bin:/bin",
        SETFARM_PG_URL: "postgresql://fixture/setfarm",
        ...(serviceLabel.endsWith("dashboard") ? { SETFARM_OPERATIONAL_WRITE_TOKEN: "fixture-token" } : {}),
      },
      StartInterval: 60,
      ProgramArguments: args,
      StandardErrorPath: path.join(fixtureHome, ".openclaw", "logs", `${stem}.watch.err.log`),
      RunAtLoad: true,
      Label: serviceLabel,
    }),
    0o600,
  );
  writePlist("com.setrox.setfarm-spawner", [launcher, "spawner", "start"], "setfarm-spawner");
  writePlist("com.setrox.setfarm-dashboard", [launcher, "dashboard", "start", "--port", "3333"], "setfarm-dashboard");
  const harness = String.raw`
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import type { BigIntStats } from "node:fs";
import path from "node:path";
const CURRENT_ENTRY_MAX_BYTES=1048576, MAX_BUILD_FILE_BYTES_V1=33554432;
type InternalProductionServiceCensusSpawnerV1=Readonly<Record<string,unknown>>;
type InternalProductionListeningServiceCensusV1=Readonly<Record<string,unknown>>;
const fault=process.env.FAULT??"none";
let activeLabel="", scan=0;
function currentEntryFail(message:string):never{throw new Error("INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:"+message)}
function fixedRepositoryRoot(){return process.env.CANONICAL_ROOT!}
function userInfo(){return {homedir:process.env.FIXTURE_HOME!}}
function recursivelyFreeze<T>(value:T):T{if(value&&typeof value==="object"){for(const key of Reflect.ownKeys(value as object)){const d=Object.getOwnPropertyDescriptor(value as object,key);if(d&&"value" in d)recursivelyFreeze(d.value)}Object.freeze(value)}return value}
function canonicalComparable(value:unknown):string{if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return "["+value.map(canonicalComparable).join(",")+"]";const r=value as Record<string,unknown>;return "{"+Object.keys(r).sort().map(k=>JSON.stringify(k)+":"+canonicalComparable(r[k])).join(",")+"}"}
function compareBytes(a:string,b:string){return Buffer.compare(Buffer.from(a),Buffer.from(b))}
function sha256(value:Buffer|string){return createHash("sha256").update(value).digest("hex")}
function hashCanonicalJson(value:unknown){return sha256(canonicalComparable(value))}
function isPlainRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype}
function hasExactKeys(value:Record<string,unknown>,keys:readonly string[]){return canonicalComparable(Object.keys(value).sort(compareBytes))===canonicalComparable([...keys].sort(compareBytes))}
function sameRegularMetadata(a:BigIntStats,b:BigIntStats){return a.dev===b.dev&&a.ino===b.ino&&a.mode===b.mode&&a.nlink===b.nlink&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs}
function readStableRegular(target:string,_cap:number,device:bigint,links:number){const before=lstatSync(target,{bigint:true});const bytes=readFileSync(target);const after=lstatSync(target,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.dev!==device||before.nlink!==BigInt(links)||!sameRegularMetadata(before,after))currentEntryFail("regular file invalid");return Object.freeze({bytes,mode:Number(before.mode&0o7777n),stats:before})}
function launchText(label:string,args:readonly string[]){const uid=process.getuid!();const home=userInfo().homedir;const running=fault==="launch_running";const actual=fault==="launch_args"?[...args,"extra"]:args;const launchPath=fault==="launch_path"?home+"/Library/LaunchAgents/crossed.plist":home+"/Library/LaunchAgents/"+label+".plist";const program=fault==="launch_program"?"/tmp/crossed":args[0];const pg=fault==="launch_environment"?"postgresql://crossed/setfarm":"postgresql://fixture/setfarm";const extra=fault==="extra_environment"?"\t\tNODE_OPTIONS => --require=/tmp/crossed.js\n":"";const inheritedExtra=fault==="inherited_preload"?"\t\tDYLD_INSERT_LIBRARIES => /tmp/crossed.dylib\n":"";const envDir=fault==="crossed_env_dir"?fixedRepositoryRoot()+"/scripts":home+"/ai/setrox/setfarm/scripts";return "gui/"+uid+"/"+label+" = {\n\tpath = "+launchPath+"\n\ttype = LaunchAgent\n\tstate = "+(running?"running":"not running")+"\n"+(running?"\tpid = 999\n":"")+"\n\tprogram = "+program+"\n\targuments = {\n"+actual.map(v=>"\t\t"+v+"\n").join("")+"\t}\n\n\tinherited environment = {\n\t\tSETFARM_ENV_DIR => "+envDir+"\n\t\tSSH_AUTH_SOCK => /var/run/com.apple.launchd.Fixture123/Listeners\n"+inheritedExtra+"\t}\n\n\tdefault environment = {\n\t\tPATH => /usr/bin:/bin:/usr/sbin:/sbin\n\t}\n\n\tenvironment = {\n\t\tOSLogRateLimit => 64\n\t\tPATH => /usr/bin:/bin\n\t\tSETFARM_PG_URL => "+pg+"\n"+(label.endsWith("dashboard")?"\t\tSETFARM_OPERATIONAL_WRITE_TOKEN => fixture-token\n":"")+"\t\tXPC_SERVICE_NAME => "+label+"\n"+extra+"\t}\n\trun interval = 60 seconds\n\tproperties = runatload | inferred program\n}\n"}
function plistText(label:string,args:readonly string[]){const home=userInfo().homedir;const stem=label.endsWith("spawner")?"setfarm-spawner":"setfarm-dashboard";const actual=fault==="plist_args"?[...args,"extra"]:args;return JSON.stringify({StandardOutPath:home+"/.openclaw/logs/"+stem+".watch.log",EnvironmentVariables:{PATH:"/usr/bin:/bin",SETFARM_PG_URL:"postgresql://fixture/setfarm",
...(label.endsWith("dashboard")?{SETFARM_OPERATIONAL_WRITE_TOKEN:"fixture-token"}:{})},StartInterval:60,ProgramArguments:actual,StandardErrorPath:home+"/.openclaw/logs/"+stem+".watch.err.log",RunAtLoad:true,Label:label})}
function boundedChildText(executable:string,args:readonly string[],_label:string,input?:Buffer){if(executable==="/bin/launchctl"){activeLabel=args[1]!.split("/").at(-1)!;const profile=detachedSetfarmServiceProfileV1(activeLabel as DetachedSetfarmServiceLabelV1);return launchText(activeLabel,profile.launchArguments)}if(executable==="/usr/bin/plutil"){const parsed=JSON.parse(input!.toString());if(fault==="plist_args")parsed.ProgramArguments.push("extra");return JSON.stringify(parsed)}if(executable==="/bin/ps")return (fault==="wrong_comm"?"/tmp/crossed":realpathSync(process.execPath))+"\n";throw new Error("unexpected command "+executable)}
function processRows(){const profile=detachedSetfarmServiceProfileV1(activeLabel as DetachedSetfarmServiceLabelV1);const pid=activeLabel.endsWith("spawner")?101:102;const node=realpathSync(process.execPath);const args=[node,profile.entrypoint,...profile.daemonArguments];if(fault==="wrong_args")args.push("extra");const row={uid:fault==="wrong_uid"?process.getuid!()+1:process.getuid!(),pid,ppid:fault==="wrong_ppid"?2:1,pgid:fault==="wrong_pgid"?7:pid,stat:fault==="zombie"?"Z":fault==="stat_drift"&&scan>0?"R":"Ss",lstart:"Sun Aug 16 15:42:28 2026",command:args.join(" "),cwd:null};const rows=fault==="zero"?[]:[Object.freeze(row)];if(fault==="multiple"||(fault==="multiple_after"&&scan>0))rows.push(Object.freeze({...row,pid:pid+20,pgid:pid+20,command:[node,profile.entrypoint,"crossed"].join(" ")}));if(fault==="drift"&&scan>0&&rows[0])rows[0]=Object.freeze({...row,lstart:"Sun Aug 16 15:42:29 2026"});if(fault==="cli_drift"&&scan>0){unlinkSync(profile.launchArguments[0]!);symlinkSync(profile.entrypoint,profile.launchArguments[0]!)}scan+=1;return Object.freeze(rows)}
function runPhysicalCommandV1(executable:string,args:readonly string[]){if(executable==="/usr/sbin/lsof"){const pid=Number(args[3]);if(fault==="partial_lsof")return Object.freeze({status:1,stdout:Buffer.from("partial")});if(activeLabel.endsWith("spawner")||fault==="listener_missing")return Object.freeze({status:1,stdout:Buffer.alloc(0)});return Object.freeze({status:0,stdout:Buffer.from("listener:"+pid)})}return Object.freeze({status:0,stdout:Buffer.from("fixture\n")})}
function parsePhysicalProcessesV1(){return processRows()}
function parseProcessListenersV1(_bytes:Buffer,pid:number){if(fault==="listener_cross")return Object.freeze([{pid:pid+1,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3333}]);if(fault==="listener_multiple")return Object.freeze([{pid,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3333},{pid,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3334}]);return Object.freeze([{pid,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3333}])}
function observeProcessListenersV1(pid:number){if(activeLabel.endsWith("spawner"))return Object.freeze([]);if(fault==="listener_missing")return Object.freeze([]);if(fault==="listener_cross")return Object.freeze([{pid:pid+1,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3333}]);if(fault==="listener_multiple")return Object.freeze([{pid,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3333},{pid,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3334}]);return Object.freeze([{pid,protocol:"TCP" as const,localAddress:"127.0.0.1",port:3333}])}
${slice}
const label=process.env.LABEL as DetachedSetfarmServiceLabelV1;
const result=observeDetachedSetfarmServiceV1(label,label.endsWith("spawner")?null:3333,Object.freeze({sha:"a".repeat(40),treeHash:"b".repeat(40),buildHash:"c".repeat(64)}));
process.stdout.write(JSON.stringify(result)+"\n");
`;
  try {
    fixtureFile(root, "harness.ts", harness);
    return spawnSync(process.execPath, ["--import", tsxLoader, harnessPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, LABEL: label, FAULT: fault, CANONICAL_ROOT: canonicalRoot, FIXTURE_HOME: fixtureHome },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function currentEntryStore(root: string): string {
  return path.join(path.dirname(root), "data/internal-production-baseline/current-entry-v1");
}

function currentEntryMembers(store: string, basename: string): readonly string[] {
  return existsSync(store)
    ? readdirSync(store).filter((name) => name === basename || name.startsWith(`.${basename}.`)).sort()
    : [];
}

function legacyDatabaseCensusRow(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    catalogViolationCount: "0",
    aprbChildViolationCount: "0",
    ordinaryBatchViolationCount: "0",
    activeHeaderViolationCount: "0",
    ownerReservationsRelation: null,
    ownerAdmissionHeadRelation: null,
    producerSourceRelation: null,
    producerActivationRelation: null,
    producerActivationHeadRelation: null,
    producerCurrentRelation: null,
    activeRunCount: "0",
    openClaimCount: "0",
    executionAttemptCount: "0",
    activeRuntimeSessionCount: "0",
    activeCompletionOwnerCount: "0",
    unsettledMandatoryEffectCount: "0",
    artifactReservationCount: "0",
    publicationBatchCount: "0",
    artifactPublicationCount: "0",
    terminationOwnerCount: "0",
    findingOwnerCount: "0",
    recoveryOwnerCount: "0",
    operationalDeliveryCount: "0",
    ...overrides,
  };
}

function createLegacyDatabaseCensusFixture(rows: readonly Record<string, unknown>[]): string {
  const root = mkdtempSync(path.join(tmpdir(), "setfarm-p4-legacy-census-"));
  let source = readFileSync(observerSource, "utf8");
  source = source.replace(
    "async function observeLegacyDatabaseCensusV1()",
    "export async function observeLegacyDatabaseCensusV1()",
  );
  source = source.replace(
    'const postgresModule = await import("postgres");',
    `const fixtureRows=JSON.parse(process.env.P4_LEGACY_CENSUS_ROWS ?? "[]");
    let queryCalls=0;
    const fixtureSql=Object.assign(async (strings: readonly string[]) => {
      queryCalls+=1;
      const query=Array.from(strings).join("?");
      if(queryCalls===1){
        if(!query.includes("SET LOCAL statement_timeout = '5s'")) throw new Error("MISSING_STATEMENT_TIMEOUT");
      }else if(queryCalls===2){
        if(!query.includes("SET LOCAL lock_timeout = '1s'")) throw new Error("MISSING_LOCK_TIMEOUT");
      }else if(queryCalls===3){
        for(const literal of ["pg_catalog.pg_attribute","runtime_completion_effects","artifact_publication_batch_items","recovery_dispatch_deliveries"]){
          if(!query.includes(literal)) throw new Error("MISSING_CATALOG_CONTRACT_"+literal);
        }
        for(const literal of [
          "status IN ('running','resuming','cancelling','failing')",
          "outcome IS NULL",
          "disposition IN ('claimed','running')",
          "state NOT IN ('released','quarantined')",
          "state NOT IN ('accepted','rejected','quarantined')",
          "mandatory IS TRUE AND state NOT IN ('applied','reconciled')",
          "reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_'",
          "WHERE state='active'",
          "reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'",
          "state<>'terminalized'",
          "status='open'",
          "status IN ('open','repairing','evidencing')",
          "state IN ('authorized','leased','attempt_reserved','running')",
          "state IN ('pending','leased')",
        ]) if(!query.includes(literal)) throw new Error("MISSING_AGGREGATE_PREDICATE_"+literal);
      }else throw new Error("EXTRA_DATABASE_QUERY");
      return fixtureRows;
    }, {
      begin: async (mode: unknown, callback: (tx: unknown) => Promise<unknown>) => {
        if(mode!=="isolation level repeatable read read only") throw new Error("WRONG_DATABASE_SNAPSHOT_MODE");
        return callback(fixtureSql);
      },
      end: async () => {if(queryCalls!==3) throw new Error("WRONG_DATABASE_QUERY_COUNT");},
    });
    const postgresModule={default:()=>fixtureSql};`,
  );
  fixtureFile(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts", source);
  fixtureFile(
    root,
    "src/internal-production/owner-admission-v1.ts",
    readFileSync(path.join(sourceRoot, "src/internal-production/owner-admission-v1.ts")),
  );
  fixtureFile(
    root,
    "src/product-compiler/canonical-json.ts",
    readFileSync(path.join(sourceRoot, "src/product-compiler/canonical-json.ts")),
  );
  fixtureFile(root, "package.json", `${JSON.stringify({ type: "module" })}\n`);
  process.env.P4_LEGACY_CENSUS_ROWS = JSON.stringify(rows);
  return root;
}

async function loadDatabaseOnlyForIsolatedLifecycleTest<T>(
  rawDatabaseUrl: string | undefined,
  loadDatabase: () => Promise<T>,
): Promise<T | undefined> {
  if (rawDatabaseUrl === undefined) return undefined;
  const parsed = new URL(rawDatabaseUrl);
  assert.equal(parsed.protocol, "postgresql:");
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname));
  const isLegacyDatabase = /^\/setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/.test(parsed.pathname);
  const isAuthenticatedProjection = /^\/setfarm_p3_[a-f0-9]{24}_(?:primary|clone_[a-f0-9]{12}|empty_[a-f0-9]{12})$/.test(parsed.pathname);
  assert.equal(isLegacyDatabase || isAuthenticatedProjection, true, "ISOLATED_LIFECYCLE_DATABASE_URL_REQUIRED");
  if (isAuthenticatedProjection) {
    const capability = await import("../execution-attempts/test-database.js");
    capability.authenticateP3ProjectedReadinessTestCapabilityV1();
    const rawAdminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
    assert.ok(rawAdminUrl, "ISOLATED_LIFECYCLE_ADMIN_URL_REQUIRED_IN_PROJECTION");
    const adminUrl = new URL(rawAdminUrl);
    assert.equal(adminUrl.protocol, "postgresql:");
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(adminUrl.hostname));
    assert.equal(adminUrl.pathname, "/postgres");
  } else {
    assert.equal(process.env.SETFARM_TEST_PG_ADMIN_URL, undefined, "ISOLATED_LIFECYCLE_ADMIN_URL_FORBIDDEN_IN_CHILD");
  }
  return loadDatabase();
}

describe("OA17 zero-input current Setfarm source/build observation", () => {
  it("P4 Task12 delivery authority authenticates the historical exact24 delivery from a clean descendant", async () => {
    const receipt = await import(
      `../../src/internal-production/baseline-post-handoff-receipt-v1.js?p4-delivery=${Date.now()}`
    );
    assert.equal(typeof receipt.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1, "function");
    assert.equal(receipt.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1.length, 0);
    assert.equal(typeof receipt.resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1, "function");
    assert.equal(receipt.resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1.length, 1);
    const featureRoot = createFixture();
    try {
      git(featureRoot, ["switch", "-q", "-c", "fixture-task12-delivery-feature"]);
      const rejected = runFixtureExpression(featureRoot, `(async()=>{try{await m.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1()}catch(error){process.stdout.write(String(error));return}throw new Error('EXPECTED_FEATURE_BRANCH_REJECTION')})()`);
      assert.equal(rejected.status, 0, rejected.stderr);
      assert.match(rejected.stdout, /branch|main|synchronized|source/i);
      assert.equal(
        existsSync(path.join(path.dirname(featureRoot), "data/internal-production-baseline/current-entry-v1/task12-p0-delivery-authorities")),
        false,
        "a feature branch is rejected before delivery authority publication",
      );
      assert.equal(existsSync(path.join(featureRoot, "data")), false, "delivery observation never writes a repository-local authority root");
    } finally {
      removeFixture(featureRoot);
    }

    const source = readFileSync(observerSource, "utf8");
    assert.match(source, /setfarm\.internal-production-baseline-task12-p0-delivery-authority\.v1/);
    assert.match(source, /task12-p0-delivery-authorities/);
    assert.match(source, /"task12-p0-delivery-authorities", "sha256"/);
    assert.match(source, /setfarm\.internal-production-baseline-task12-p0-focused-verification\.v1/);
    assert.match(source, /--test-name-pattern=\^P4 /);
    assert.doesNotMatch(source, /process\.env\.[A-Z0-9_]*TASK12.*DELIVERY/i);

    const root = createFixture();
    try {
      const fixtureObserverPath = path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
      const fixtureBaseCommit = git(root, ["rev-parse", "HEAD"]);
      let fixtureSource = readFileSync(fixtureObserverPath, "utf8");
      fixtureSource = fixtureSource.replace(
        "  const constants = task12P0DeliveryConstantsV1();",
        "  let constants = task12P0DeliveryConstantsV1();\n  const p4Tamper = Reflect.get(globalThis, '__p4Task12DeliveryConstantsTamper');\n  if (typeof p4Tamper === 'function') constants = (p4Tamper as (value: Task12P0DeliveryConstantsV1) => Task12P0DeliveryConstantsV1)(constants);",
      );
      assert.notEqual(fixtureSource, readFileSync(fixtureObserverPath, "utf8"));
      writeFileSync(fixtureObserverPath, fixtureSource);
      const sourceObjects = realpathSync(git(sourceRoot, ["rev-parse", "--git-path", "objects"]));
      fixtureFile(root, ".git/objects/info/alternates", `${sourceObjects}\n`);
      git(root, ["add", "src/internal-production/baseline-post-handoff-receipt-v1.ts"]);
      const constantsTree = git(root, ["write-tree"]);
      const constantsCommit = execFileSync(
        "/usr/bin/git",
        ["commit-tree", constantsTree, "-p", TASK12_P0_DELIVERY_COMMIT_SHA, "-m", "fixture Task12 constants fill"],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
      git(root, ["update-ref", "refs/heads/main", constantsCommit]);
      git(root, ["update-ref", "refs/remotes/origin/main", constantsCommit]);
      assert.equal(git(root, ["rev-parse", "HEAD"]), constantsCommit);
      assert.equal(git(root, ["status", "--porcelain"]), "");
      assert.equal(git(root, ["rev-parse", `${TASK12_P0_DELIVERY_COMMIT_SHA}^{tree}`]), TASK12_P0_DELIVERY_TREE_HASH);
      for (const [locator, blobHash] of TASK12_P0_ORDERED_PATH_BLOBS) {
        assert.equal(git(root, ["rev-parse", `${TASK12_P0_DELIVERY_COMMIT_SHA}:${locator}`]), blobHash, locator);
      }
      const prepared = runProducer(root, "--prepare");
      assert.equal(prepared.status, 0, prepared.stderr);
      materializeOutputs(root);
      const finalized = runProducer(root, "--finalize");
      assert.equal(finalized.status, 0, finalized.stderr);

      const success = runFixtureExpression(root, `(async()=>{const first=await m.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1();const second=await m.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1();const resolved=await m.resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1({deliveryAuthorityRef:first.deliveryAuthorityRef,deliveryAuthorityHash:first.deliveryAuthorityHash});process.stdout.write(JSON.stringify({first,second,resolved}))})()`);
      assert.equal(success.status, 0, success.stderr);
      const observed = JSON.parse(success.stdout) as Readonly<{ first: Record<string, unknown>; second: Record<string, unknown>; resolved: Record<string, unknown> }>;
      assert.deepEqual(observed.second, observed.first, "response-loss adoption returns the exact first authority");
      assert.deepEqual(observed.resolved, observed.first, "the published authority is pair-resolvable");
      assert.equal(observed.first.deliveryCommitSha, TASK12_P0_DELIVERY_COMMIT_SHA);
      assert.equal(observed.first.deliveryTreeHash, TASK12_P0_DELIVERY_TREE_HASH);
      assert.equal(observed.first.currentSourceSha, constantsCommit);
      assert.equal(observed.first.currentSourceTreeHash, constantsTree);
      assert.equal(observed.first.exact24PathBlobSetHash, TASK12_P0_EXACT24_PATH_BLOB_SET_HASH);
      assert.equal(observed.first.focusedVerificationHash, TASK12_P0_FOCUSED_VERIFICATION_HASH);
      assert.match(String(observed.first.currentSourceBuildHash), /^[0-9a-f]{64}$/);
      const authorityHash = String(observed.first.deliveryAuthorityHash);
      const authorityRef = String(observed.first.deliveryAuthorityRef);
      const authorityPath = path.join(path.dirname(root), "data/internal-production-baseline/current-entry-v1/task12-p0-delivery-authorities/sha256", authorityHash.slice(0, 2), `${authorityHash}.json`);
      const authorityBytes = readFileSync(authorityPath);
      const authority = JSON.parse(authorityBytes.toString("utf8")) as Record<string, unknown>;
      assert.equal(lstatSync(authorityPath, { bigint: true }).nlink, 1n);
      assert.equal(Number(lstatSync(authorityPath, { bigint: true }).mode & 0o7777n), 0o600);

      const tamperCases = Object.freeze([
        ["command trailing space", `(value)=>({...value,orderedCommands:[[...value.orderedCommands[0].slice(0,-1),value.orderedCommands[0].at(-1)+' ']]})`],
        ["command order", `(value)=>({...value,orderedCommands:[[value.orderedCommands[0][1],value.orderedCommands[0][0],...value.orderedCommands[0].slice(2)]]})`],
        ["historical path", `(value)=>({...value,orderedPathBlobs:value.orderedPathBlobs.map((entry,index)=>index===0?{...entry,path:'package-lock.json'}:entry)})`],
        ["historical blob", `(value)=>({...value,orderedPathBlobs:value.orderedPathBlobs.map((entry,index)=>index===0?{...entry,blobHash:'0'.repeat(40)}:entry)})`],
        ["focused path", `(value)=>({...value,orderedTestPathBlobs:value.orderedTestPathBlobs.map((entry,index)=>index===0?{...entry,path:'tests/not-authorized.test.ts'}:entry)})`],
        ["focused blob", `(value)=>({...value,orderedTestPathBlobs:value.orderedTestPathBlobs.map((entry,index)=>index===0?{...entry,blobHash:'0'.repeat(40)}:entry)})`],
        ["exit code", `(value)=>({...value,exitCode:1})`],
        ["pass bit", `(value)=>({...value,passed:false})`],
        ["delivery tree", `(value)=>({...value,deliveryTreeHash:'0'.repeat(40)})`],
        ["delivery ancestry", `(value)=>({...value,deliveryCommitSha:${JSON.stringify(fixtureBaseCommit)}})`],
      ] as const);
      const deliveryDirectory = path.dirname(authorityPath);
      const initialAuthorityMembers = readdirSync(deliveryDirectory).sort();
      for (const [label, mutator] of tamperCases) {
        const result = runFixtureExpression(root, `(async()=>{globalThis.__p4Task12DeliveryConstantsTamper=${mutator};try{await m.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1()}catch(error){process.stdout.write(String(error));return}throw new Error('EXPECTED_DELIVERY_TAMPER_REJECTION')})()`);
        assert.equal(result.status, 0, `${label}: ${result.stderr}`);
        assert.match(result.stdout, /Task12 P0|Git command failed|delivery/i, label);
        assert.deepEqual(readdirSync(deliveryDirectory).sort(), initialAuthorityMembers, `${label} publishes no new authority bytes`);
      }

      git(root, ["update-ref", "refs/remotes/origin/main", TASK12_P0_DELIVERY_COMMIT_SHA]);
      const crossedOrigin = runFixtureExpression(root, `(async()=>{try{await m.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1()}catch(error){process.stdout.write(String(error));return}throw new Error('EXPECTED_ORIGIN_REJECTION')})()`);
      assert.equal(crossedOrigin.status, 0, crossedOrigin.stderr);
      assert.match(crossedOrigin.stdout, /origin|synchronized|source/i);
      git(root, ["update-ref", "refs/remotes/origin/main", constantsCommit]);

      const buildInfoPath = path.join(root, "dist/BUILD_INFO.json");
      const buildInfoBytes = readFileSync(buildInfoPath);
      chmodSync(buildInfoPath, 0o600);
      writeFileSync(buildInfoPath, Buffer.concat([buildInfoBytes, Buffer.from(" ")]));
      chmodSync(buildInfoPath, 0o444);
      const crossedBuild = runFixtureExpression(root, `(async()=>{try{await m.observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1()}catch(error){process.stdout.write(String(error));return}throw new Error('EXPECTED_BUILD_REJECTION')})()`);
      assert.equal(crossedBuild.status, 0, crossedBuild.stderr);
      assert.match(crossedBuild.stdout, /build|artifact|JSON|bytes/i);
      chmodSync(buildInfoPath, 0o600);
      writeFileSync(buildInfoPath, buildInfoBytes);
      chmodSync(buildInfoPath, 0o444);

      const resolve = () => runFixtureExpression(root, `(async()=>{try{await m.resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1(${JSON.stringify({ deliveryAuthorityRef: authorityRef, deliveryAuthorityHash: authorityHash })})}catch(error){process.stdout.write(String(error));return}throw new Error('EXPECTED_RESOLVER_TAMPER_REJECTION')})()`);
      for (const [label, changed] of [
        ["ref", { ...authority, deliveryAuthorityRef: `setfarm://internal-production/baseline-task12-p0-delivery-authority/sha256/${"0".repeat(64)}` }],
        ["hash", { ...authority, deliveryAuthorityHash: "0".repeat(64) }],
      ] as const) {
        writeFileSync(authorityPath, `${canonical(changed)}\n`, { mode: 0o600 });
        const result = resolve();
        assert.equal(result.status, 0, `${label}: ${result.stderr}`);
        assert.match(result.stdout, /crossed|pair|authority/i, label);
        writeFileSync(authorityPath, authorityBytes, { mode: 0o600 });
      }
      chmodSync(authorityPath, 0o4600);
      const specialMode = resolve();
      assert.equal(specialMode.status, 0, specialMode.stderr);
      assert.match(specialMode.stdout, /inode|mode|record/i);
      chmodSync(authorityPath, 0o600);
      const alias = `${authorityPath}.alias`;
      linkSync(authorityPath, alias);
      const crossedLink = resolve();
      assert.equal(crossedLink.status, 0, crossedLink.stderr);
      assert.match(crossedLink.stdout, /inode|link|record/i);
      unlinkSync(alias);
    } finally {
      removeFixture(root);
    }
  });

  it("P4 Task12 public resolvers reject special-bit records and insecure store ancestors", () => {
    for (const fault of ["record-special-bit", "ancestor-mode"] as const) {
      const root = createFixture();
      try {
        const body = {
          schema: "setfarm.internal-production-baseline-task12-p0-delivery-authority.v1",
          deliveryCommitSha: "1".repeat(40),
          deliveryTreeHash: "2".repeat(40),
          deliveryAncestorOfCurrentSource: true,
          currentSourceSha: "3".repeat(40),
          currentSourceTreeHash: "4".repeat(40),
          currentSourceBuildHash: "5".repeat(64),
          exact24PathBlobSetHash: "6".repeat(64),
          focusedVerificationHash: "7".repeat(64),
        };
        const deliveryAuthorityHash = canonicalHash(body);
        const deliveryAuthorityRef = `setfarm://internal-production/baseline-task12-p0-delivery-authority/sha256/${deliveryAuthorityHash}`;
        const target = path.join(path.dirname(root), "data/internal-production-baseline/current-entry-v1/task12-p0-delivery-authorities/sha256", deliveryAuthorityHash.slice(0, 2), `${deliveryAuthorityHash}.json`);
        const chain = ["data", "data/internal-production-baseline", "data/internal-production-baseline/current-entry-v1", "data/internal-production-baseline/current-entry-v1/task12-p0-delivery-authorities", "data/internal-production-baseline/current-entry-v1/task12-p0-delivery-authorities/sha256", `data/internal-production-baseline/current-entry-v1/task12-p0-delivery-authorities/sha256/${deliveryAuthorityHash.slice(0, 2)}`];
        for (const member of chain) { mkdirSync(path.join(path.dirname(root), member), { recursive: true, mode: 0o700 }); chmodSync(path.join(path.dirname(root), member), 0o700); }
        writeFileSync(target, `${canonical({ ...body, deliveryAuthorityRef, deliveryAuthorityHash })}\n`, { mode: 0o600 });
        if (fault === "record-special-bit") chmodSync(target, 0o4600);
        else chmodSync(path.join(path.dirname(root), "data/internal-production-baseline/current-entry-v1"), 0o755);
        const result = runFixtureExpression(root, `m.resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1(${JSON.stringify({ deliveryAuthorityRef, deliveryAuthorityHash })})`);
        assert.notEqual(result.status, 0, `${fault} must fail through the public delivery resolver`);
        assert.match(result.stderr, /directory|mode|inode|identity|record/i);
      } finally {
        removeFixture(root);
      }
    }
  });

  it("P4 Task12 receipt no-replace deterministically adopts two and eight equal pre-link temps", () => {
    for (const count of [2, 8]) {
      const root = createFixture();
      try {
        const modulePath = path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
        const source = readFileSync(modulePath, "utf8").replace("function publishLegacyZeroRecordV1(", "export function publishLegacyZeroRecordV1(");
        assert.notEqual(source, readFileSync(modulePath, "utf8"));
        writeFileSync(modulePath, source);
        const canonicalRoot = realpathSync(root);
        const directory = path.join(canonicalRoot, "data/internal-production-baseline/p4-receipt-prelinks");
        for (const member of [path.join(canonicalRoot, "data"), path.join(canonicalRoot, "data/internal-production-baseline"), directory]) { mkdirSync(member, { recursive: true, mode: 0o700 }); chmodSync(member, 0o700); }
        const target = path.join(directory, `record-${count}.json`);
        const value = { schema: "setfarm.tests.task12-receipt-prelink.v1", count };
        const bytes = `${canonical(value)}\n`;
        const temps = Array.from({ length: count }, (_, index) => `${target}.tmp-${process.pid}-${`42345678-1234-4123-8123-${String(count - index).padStart(12, "0")}`}`);
        for (const temp of temps) writeFileSync(temp, bytes, { mode: 0o600 });
        const expectedInode = lstatSync([...temps].sort()[0]!, { bigint: true }).ino;
        const result = runFixtureExpression(root, `m.publishLegacyZeroRecordV1(${JSON.stringify(target)},Buffer.from(${JSON.stringify(bytes)}))`);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(lstatSync(target, { bigint: true }).ino, expectedInode, `${count} candidates select the unsigned-name-first inode`);
        assert.equal(temps.some(existsSync), false, `${count} candidates are all cleaned`);
      } finally {
        removeFixture(root);
      }
    }

    {
      const root = createFixture();
      try {
        const modulePath = path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
        const original = readFileSync(modulePath, "utf8");
        const source = original
          .replace("function publishLegacyZeroRecordV1(", "export function publishLegacyZeroRecordV1(")
          .replace(
            "        const now = fstatSync(item.descriptor, { bigint: true }); const atPath = lstatSync(item.path, { bigint: true }); const observed = readTask12ReceiptDescriptorBytesV1(item.descriptor, now.size);",
            "        ((globalThis as Record<string, unknown>).__p4ReceiptBeforeTempUnlink as undefined | ((member: string) => void))?.(item.path);\n        const now = fstatSync(item.descriptor, { bigint: true }); const atPath = lstatSync(item.path, { bigint: true }); const observed = readTask12ReceiptDescriptorBytesV1(item.descriptor, now.size);",
          )
          .replace(
            "        unlinkSync(item.path);\n        fsyncCurrentEntryDirectory(directory);",
            "        unlinkSync(item.path);\n        fsyncCurrentEntryDirectory(directory);\n        ((globalThis as Record<string, unknown>).__p4ReceiptAfterTempFsync as undefined | ((member: string) => void))?.(item.path);",
          );
        assert.notEqual(source, original);
        writeFileSync(modulePath, source);
        const canonicalRoot = realpathSync(root);
        const directory = path.join(canonicalRoot, "data/internal-production-baseline/p4-receipt-cleanup-race");
        for (const member of [path.join(canonicalRoot, "data"), path.join(canonicalRoot, "data/internal-production-baseline"), directory]) { mkdirSync(member, { recursive: true, mode: 0o700 }); chmodSync(member, 0o700); }
        const value = { schema: "setfarm.tests.task12-receipt-cleanup-race.v1" };
        const bytes = `${canonical(value)}\n`;

        const replacementTarget = path.join(directory, "replacement.json");
        writeFileSync(replacementTarget, bytes, { mode: 0o600 });
        const replacementTemp = `${replacementTarget}.tmp-${process.pid}-62345678-1234-4123-8123-123456789abc`;
        writeFileSync(replacementTemp, bytes, { mode: 0o600 });
        const replacement = runFixtureExpression(root, `(async()=>{const fs=await import('node:fs');let fired=false;globalThis.__p4ReceiptBeforeTempUnlink=(member)=>{if(fired)return;fired=true;fs.renameSync(member,member+'.pinned');fs.writeFileSync(member,${JSON.stringify(bytes)},{mode:0o600})};try{m.publishLegacyZeroRecordV1(${JSON.stringify(replacementTarget)},Buffer.from(${JSON.stringify(bytes)}))}catch(error){process.stdout.write(String(error));return}throw new Error('EXPECTED_REPLACEMENT_REJECTION')})()`);
        assert.equal(replacement.status, 0, replacement.stderr);
        assert.match(replacement.stdout, /temp changed|candidate changed|crossed/i);
        assert.equal(existsSync(replacementTemp), true, "a foreign replacement at the candidate path is never unlinked");

        const crashTarget = path.join(directory, "crash.json");
        const crashTemps = [
          `${crashTarget}.tmp-${process.pid}-72345678-1234-4123-8123-000000000001`,
          `${crashTarget}.tmp-${process.pid}-72345678-1234-4123-8123-000000000002`,
        ];
        for (const member of crashTemps) writeFileSync(member, bytes, { mode: 0o600 });
        const crash = runFixtureExpression(root, `(async()=>{const fs=await import('node:fs');let faults=2;globalThis.__p4ReceiptAfterTempFsync=()=>{if(faults-->0)throw new Error('P4_RECEIPT_AFTER_TEMP_FSYNC')};const attempt=()=>{try{m.publishLegacyZeroRecordV1(${JSON.stringify(crashTarget)},Buffer.from(${JSON.stringify(bytes)}));return 'ok'}catch(error){return String(error)}};const first=attempt();const afterFirst=${JSON.stringify(crashTemps)}.filter(fs.existsSync);const second=attempt();const afterSecond=${JSON.stringify(crashTemps)}.filter(fs.existsSync);delete globalThis.__p4ReceiptAfterTempFsync;const third=attempt();process.stdout.write(JSON.stringify({first,afterFirst,second,afterSecond,third,target:fs.readFileSync(${JSON.stringify(crashTarget)},'utf8')}))})()`);
        assert.equal(crash.status, 0, crash.stderr);
        const crashEvidence = JSON.parse(crash.stdout);
        assert.match(crashEvidence.first, /P4_RECEIPT_AFTER_TEMP_FSYNC/);
        assert.equal(crashEvidence.afterFirst.length, 1, "the first unlink+fsync is the only durable cleanup prefix before the first crash");
        assert.match(crashEvidence.second, /P4_RECEIPT_AFTER_TEMP_FSYNC/);
        assert.equal(crashEvidence.afterSecond.length, 0, "the second retry durably removes only the remaining candidate");
        assert.equal(crashEvidence.third, "ok");
        assert.equal(crashEvidence.target, bytes);
      } finally {
        removeFixture(root);
      }
    }
  });

  it("P4 Task12 receipt refuses a hardlinked stale writer lock without unlinking either name", () => {
    const root = createFixture();
    try {
      const modulePath = path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
      const original = readFileSync(modulePath, "utf8");
      const source = original
        .replace("function acquireTask12ReceiptLocatorWriterV1(", "export function acquireTask12ReceiptLocatorWriterV1(")
        .replace('    const result = spawnSync("/bin/ps",', '    (globalThis as Record<string, number>).__p4ReceiptOwnerObservations = ((globalThis as Record<string, number>).__p4ReceiptOwnerObservations ?? 0) + 1;\n    const result = spawnSync("/bin/ps",');
      assert.notEqual(source, original);
      writeFileSync(modulePath, source);
      const canonicalRoot = realpathSync(root);
      const directory = path.join(canonicalRoot, "data/internal-production-baseline/p4-receipt-lock");
      for (const member of [path.join(canonicalRoot, "data"), path.join(canonicalRoot, "data/internal-production-baseline"), directory]) { mkdirSync(member, { recursive: true, mode: 0o700 }); chmodSync(member, 0o700); }
      const target = path.join(directory, "record.json");
      const lockPath = path.join(directory, ".record.json.writer.lock");
      const alias = `${lockPath}.alias`;
      const body = {
        schema: "setfarm.internal-production-task12-receipt-locator-writer-lock.v1",
        targetHash: canonicalHash({ schema: "setfarm.internal-production-task12-receipt-locator-writer-target.v1", target }),
        pid: 999999,
        start: "Mon Jan 01 00:00:00 2001",
        commandHash: "8".repeat(64),
        identityHash: "9".repeat(64),
        nonce: "52345678-1234-4123-8123-123456789abc",
      };
      writeFileSync(lockPath, `${canonical(body)}\n`, { mode: 0o600 });
      linkSync(lockPath, alias);
      const result = runFixtureExpression(root, `(async()=>{globalThis.__p4ReceiptOwnerObservations=0;try{m.acquireTask12ReceiptLocatorWriterV1(${JSON.stringify(target)}).close()}catch(error){process.stdout.write(String(globalThis.__p4ReceiptOwnerObservations));throw error}})()`);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, "0", "a non-sole stale lock is rejected before owner observation");
      assert.equal(lstatSync(lockPath, { bigint: true }).nlink, 2n);
      assert.equal(lstatSync(alias, { bigint: true }).nlink, 2n);
    } finally {
      removeFixture(root);
    }
  });

  it("P4 Task12 receipt writer closes every busy guard and recovers a post-link fault", () => {
    const root = createFixture();
    try {
      const canonicalRoot = realpathSync(root);
      const modulePath = path.join(canonicalRoot, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
      const original = readFileSync(modulePath, "utf8");
      const source = original
        .replace("function acquireTask12ReceiptLocatorWriterV1(", "export function acquireTask12ReceiptLocatorWriterV1(")
        .replace("function authenticateTask12ReceiptDirectoryChainV1(target: string): Task12ReceiptDirectoryGuardV1 {", "function authenticateTask12ReceiptDirectoryChainV1(target: string): Task12ReceiptDirectoryGuardV1 { (globalThis as Record<string, number>).__p4ReceiptGuardCreates=((globalThis as Record<string, number>).__p4ReceiptGuardCreates??0)+1;")
        .replace("        closed = true;\n        for (const descriptor of descriptors.reverse()) closeSync(descriptor);", "        closed = true; (globalThis as Record<string, number>).__p4ReceiptGuardCloses=((globalThis as Record<string, number>).__p4ReceiptGuardCloses??0)+1;\n        for (const descriptor of descriptors.reverse()) closeSync(descriptor);")
        .replace("const deadline = Date.now() + 10_000;", "const deadline = Date.now() + 75;")
        .replace(
          "      }\n      unlinkPinned(temp, descriptor, identity, bytes, 2n);",
          "      }\n      const hook=Reflect.get(globalThis,'__p4ReceiptPostLinkHook'); if(typeof hook==='function')hook(directory);\n      unlinkPinned(temp, descriptor, identity, bytes, 2n);",
        );
      assert.notEqual(source, original);
      writeFileSync(modulePath, source);
      const directory = path.join(canonicalRoot, "data/internal-production-baseline/p4-receipt-writer-faults");
      for (const member of [path.join(canonicalRoot, "data"), path.join(canonicalRoot, "data/internal-production-baseline"), directory]) { mkdirSync(member, { recursive: true, mode: 0o700 }); chmodSync(member, 0o700); }

      const busyTarget = path.join(directory, "busy.json");
      const busyProgram = `(async()=>{globalThis.__p4ReceiptGuardCreates=0;globalThis.__p4ReceiptGuardCloses=0;const held=m.acquireTask12ReceiptLocatorWriterV1(${JSON.stringify(busyTarget)});const beforeFd=(await import('node:fs')).readdirSync('/dev/fd').length;const beforeCreates=globalThis.__p4ReceiptGuardCreates;const beforeCloses=globalThis.__p4ReceiptGuardCloses;let rejected=false;try{m.acquireTask12ReceiptLocatorWriterV1(${JSON.stringify(busyTarget)})}catch{rejected=true}const afterFd=(await import('node:fs')).readdirSync('/dev/fd').length;const created=globalThis.__p4ReceiptGuardCreates-beforeCreates;const closed=globalThis.__p4ReceiptGuardCloses-beforeCloses;held.close();process.stdout.write(JSON.stringify({rejected,beforeFd,afterFd,created,closed}))})()`;
      const busy = runFixtureExpression(root, busyProgram);
      assert.equal(busy.status, 0, busy.stderr);
      const busyEvidence = JSON.parse(busy.stdout);
      assert.equal(busyEvidence.rejected, true);
      assert.equal(busyEvidence.afterFd, busyEvidence.beforeFd, "busy retries leak no chain descriptors");
      assert.equal(busyEvidence.closed, busyEvidence.created, "each busy retry closes its exact chain guard");

      const faultTarget = path.join(directory, "post-link.json");
      const faultProgram = `(async()=>{const fs=await import('node:fs');let injected=true;globalThis.__p4ReceiptPostLinkHook=(directory)=>{if(!injected)return;injected=false;const held=directory+'.held';fs.renameSync(directory,held);fs.renameSync(held,directory);throw new Error('P4_POST_LINK_FAULT')};let first='';try{m.acquireTask12ReceiptLocatorWriterV1(${JSON.stringify(faultTarget)})}catch(error){first=String(error)}delete globalThis.__p4ReceiptPostLinkHook;const inventory=fs.readdirSync(${JSON.stringify(directory)}).filter(name=>name.includes('post-link'));const retry=m.acquireTask12ReceiptLocatorWriterV1(${JSON.stringify(faultTarget)});retry.close();process.stdout.write(JSON.stringify({first,inventory}))})()`;
      const fault = runFixtureExpression(root, faultProgram);
      assert.equal(fault.status, 0, fault.stderr);
      const faultEvidence = JSON.parse(fault.stdout);
      assert.match(faultEvidence.first, /P4_POST_LINK_FAULT/);
      assert.deepEqual(faultEvidence.inventory, [], "post-link failure removes only its authenticated lock/temp before retry");
    } finally {
      removeFixture(root);
    }
  });

  it("P4 receipt owns startup prerequisite observations", async () => {
    const receipt = await import(
      `../../src/internal-production/baseline-post-handoff-receipt-v1.js?p4-prerequisites=${Date.now()}`
    );
    assert.equal(typeof receipt.observeInternalProductionServiceCensusV1, "function");
    assert.equal(receipt.observeInternalProductionServiceCensusV1.length, 0);
    assert.equal(typeof receipt.observeInternalProductionLegacyPreManifestZeroOwnerV1, "function");
    assert.equal(receipt.observeInternalProductionLegacyPreManifestZeroOwnerV1.length, 0);
    assert.equal(typeof receipt.resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1, "function");
    assert.equal(receipt.resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1.length, 1);

    const source = readFileSync(observerSource, "utf8");
    assert.match(source, /legacy-pre-manifest-zero-owner-observation\/sha256\//);
    assert.doesNotMatch(source, /^import .*baseline-spawner-startup-admission-v1/m);
    assert.doesNotMatch(source, /newest|latest.*legacy-pre-manifest/i);
    assert.doesNotMatch(source, /Object\.fromEntries\(COMPLETE_ZERO_CENSUS_KEYS_V1/);
    const completeObserver = /export async function observeCompleteInternalProductionZeroOwnerCensusV1\([\s\S]*?\n}\n\nconst ZERO_OWNER_GUARD_ROOT_V1/.exec(source)?.[0] ?? "";
    assert.match(completeObserver, /observeInternalProductionPostManifestOwnerCensusSnapshotV1/);
    assert.doesNotMatch(completeObserver, /observeLegacyDatabaseCensusV1\(/);
    assert.match(completeObserver, /reservationIdentitySetHash: snapshot\.reservationIdentitySetHash/);
    assert.match(completeObserver, /ownerIdentitySetHash: snapshot\.ownerIdentitySetHash/);
    const databaseSource = readFileSync(dbSource, "utf8");
    const postManifestSnapshot = /export async function observeInternalProductionPostManifestOwnerCensusSnapshotV1\([\s\S]*?\n}\n\nclass OwnerProducerActivationSupersededError/.exec(databaseSource)?.[0] ?? "";
    assert.match(postManifestSnapshot, /isolation level repeatable read read only/);
    assert.match(postManifestSnapshot, /WHERE state IN \('pending','bound'\)/);
    assert.match(postManifestSnapshot, /openRows\.length !== 0/);
    assert.match(postManifestSnapshot, /INTERNAL_PRODUCTION_COMPLETE_OWNER_SIDECAR_NONZERO/);
    assert.match(postManifestSnapshot, /emptyIdentitySetHash = hashCanonicalJson\(\[\]\)/);
    const cutoverFenceConsumer = /export async function consumeInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardV1\([\s\S]*?\n}\n/.exec(source)?.[0] ?? "";
    assert.match(cutoverFenceConsumer, /import\("\.\.\/db-pg\.js"\)/);
    assert.doesNotMatch(cutoverFenceConsumer, /owner-admission-v1\.js/);
    assert.match(postManifestSnapshot, /reservationIdentitySetHash = hashCanonicalJson\(reservationIdentities\)/);
    assert.match(postManifestSnapshot, /ownerIdentitySetHash = hashCanonicalJson\(ownerIdentities\)/);
    const cutoverConsumer = /export async function consumeInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardV1\([\s\S]*?\n}\n\nexport type InternalProductionCurrentEntryAuthorityStatusPairV1/.exec(source)?.[0] ?? "";
    let cutoverCursor = -1;
    for (const required of [
      "const status = await (observeCutoverStatus",
      "const operation = await (resolveOperation",
      "const fence = await (reobserveFence",
      "const freshZero = await observeCompleteInternalProductionZeroOwnerCensusV1",
      "const helper = await (observeHelperCensus",
      "cutoverZeroOwnerConsumptionPathV1",
      "zeroOwnerConsumedIndexPathV1",
      "reopenedIndex",
    ]) {
      const next = cutoverConsumer.indexOf(required, cutoverCursor + 1);
      assert.ok(next > cutoverCursor, `cutover consumer ordering missing ${required}`);
      cutoverCursor = next;
    }
    for (const producer of [
      "reserveInternalProductionOrdinaryServiceStartOwnerV1",
      "reserveInternalProductionServiceRestartDispatchOwnerV1",
      "reserveInternalProductionServiceRestartOperationOwnerV1",
      "reserveGoldenLaunchPreparationOwnerV1",
      "reserveGoldenPreparedLaunchOwnerV1",
      "reserveGoldenLaunchOutboxOwnerV1",
      "reserveGoldenStagedCaseOwnerV1",
      "reserveGoldenFixtureAttemptOwnerV1",
      "reserveGoldenExistingRepositoryFixtureAttemptOwnerV1",
      "reserveGoldenDocsSessionOwnerV1",
      "reserveGoldenDocsLeaseOwnerV1",
      "reserveGoldenFleetStageOwnerV1",
      "reserveGoldenFleetInflightOwnerV1",
      "reserveGoldenFleetReviewOwnerV1",
      "reserveGoldenMatrixInflightOwnerV1",
      "reserveColdRehearsalOwnerV1",
      "reserveGoldenCompilationLeaseOwnerV1",
      "reserveGoldenExecutionLeaseOwnerV1",
    ]) assert.ok(source.includes(producer), `missing phase-closed producer proof for ${producer}`);
  });

  it("P4 legacy census rejects a nonzero open claim instead of synthesizing zero", () => {
    const rows = [legacyDatabaseCensusRow({ openClaimCount: "1" })];
    const root = createLegacyDatabaseCensusFixture(rows);
    try {
      const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const result = spawnSync(process.execPath, [
        "--import", tsxLoader, "--input-type=module", "-e",
        `import(${JSON.stringify(moduleUrl)}).then((m)=>m.observeLegacyDatabaseCensusV1()).then(()=>{throw new Error("NONZERO_OPEN_CLAIM_ACCEPTED")})`,
      ], {
        cwd: root,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          SETFARM_PG_URL: "postgresql://fixture.invalid/setfarm",
          P4_LEGACY_CENSUS_ROWS: JSON.stringify(rows),
        },
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /openClaimCount|open claim/i);
      assert.doesNotMatch(result.stderr, /NONZERO_OPEN_CLAIM_ACCEPTED/);
    } finally {
      delete process.env.P4_LEGACY_CENSUS_ROWS;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("P4 legacy database census rejects every live predicate and malformed aggregate", () => {
    const root = createLegacyDatabaseCensusFixture([]);
    const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
    const run = (row: Record<string, unknown>) => spawnSync(process.execPath, [
      "--import", tsxLoader, "--input-type=module", "-e",
      `import(${JSON.stringify(moduleUrl)}).then((m)=>m.observeLegacyDatabaseCensusV1())`,
    ], {
      cwd: root,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        SETFARM_PG_URL: "postgresql://fixture.invalid/setfarm",
        P4_LEGACY_CENSUS_ROWS: JSON.stringify([row]),
      },
    });
    try {
      const liveKeys = [
        "activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount",
        "activeCompletionOwnerCount", "unsettledMandatoryEffectCount", "artifactReservationCount",
        "publicationBatchCount", "artifactPublicationCount", "terminationOwnerCount", "findingOwnerCount",
        "recoveryOwnerCount", "operationalDeliveryCount",
      ];
      for (const key of liveKeys) {
        const result = run(legacyDatabaseCensusRow({ [key]: "1" }));
        assert.notEqual(result.status, 0, `${key} must refuse`);
        assert.match(result.stderr, new RegExp(key));
      }
      for (const [key, value] of [
        ["openClaimCount", "-1"],
        ["openClaimCount", "01"],
        ["openClaimCount", "9007199254740992"],
        ["openClaimCount", null],
        ["catalogViolationCount", "1"],
        ["aprbChildViolationCount", "1"],
        ["ordinaryBatchViolationCount", "1"],
        ["activeHeaderViolationCount", "1"],
        ["producerCurrentRelation", "internal_production_owner_producer_manifest_set_current_v1"],
      ] as const) {
        const result = run(legacyDatabaseCensusRow({ [key]: value }));
        assert.notEqual(result.status, 0, `${key}=${String(value)} must refuse`);
        assert.match(result.stderr, new RegExp(key));
      }
      const zero = run(legacyDatabaseCensusRow());
      assert.equal(zero.status, 0, zero.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("P4 phase-closed census refuses every present or symlinked future authority path", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "setfarm-p4-phase-closed-"));
    let source = readFileSync(observerSource, "utf8");
    source = source
      .replace("function requireAbsentPhasePathV1(", "export function requireAbsentPhasePathV1(")
      .replace("function requireAbsentProducerLiteralV1(", "export function requireAbsentProducerLiteralV1(")
      .replace("function assertPhaseSourceEqualV1(", "export function assertPhaseSourceEqualV1(");
    fixtureFile(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts", source);
    fixtureFile(root, "src/internal-production/owner-admission-v1.ts", readFileSync(path.join(sourceRoot, "src/internal-production/owner-admission-v1.ts")));
    fixtureFile(root, "src/product-compiler/canonical-json.ts", readFileSync(path.join(sourceRoot, "src/product-compiler/canonical-json.ts")));
    fixtureFile(root, "package.json", `${JSON.stringify({ type: "module" })}\n`);
    const moduleUrl = `${pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href}?phase=${Date.now()}`;
    try {
      const loaded = await import(moduleUrl) as Readonly<{
        requireAbsentPhasePathV1: (target: string, label: string) => void;
        requireAbsentProducerLiteralV1: (source: string, producer: string) => void;
        assertPhaseSourceEqualV1: (expected: unknown, observed: unknown) => void;
      }>;
      const target = path.join(root, "future-authority");
      assert.doesNotThrow(() => loaded.requireAbsentPhasePathV1(target, "future authority"));
      fixtureFile(root, "future-authority", "present\n");
      assert.throws(() => loaded.requireAbsentPhasePathV1(target, "future authority"), /present before its producer phase/);
      unlinkSync(target);
      symlinkSync(path.join(root, "missing-target"), target);
      assert.throws(() => loaded.requireAbsentPhasePathV1(target, "future authority"), /present before its producer phase/);
      assert.doesNotThrow(() => loaded.requireAbsentProducerLiteralV1("export const unrelated = true;", "reserveRecoverySourceRunOwnerV1"));
      for (const spelling of [
        "export function reserveRecoverySourceRunOwnerV1(){}",
        "export const reserveRecoverySourceRunOwnerV1=()=>{}",
        "// reserveRecoverySourceRunOwnerV1",
      ]) assert.throws(() => loaded.requireAbsentProducerLiteralV1(spelling, "reserveRecoverySourceRunOwnerV1"), /future producer export is already active/);
      const sourceIdentity = { sha: "1".repeat(40), treeHash: "2".repeat(40), buildHash: "3".repeat(64) };
      assert.doesNotThrow(() => loaded.assertPhaseSourceEqualV1(sourceIdentity, { ...sourceIdentity }));
      for (const mutation of [{ sha: "4".repeat(40) }, { treeHash: "5".repeat(40) }, { buildHash: "6".repeat(64) }]) {
        assert.throws(() => loaded.assertPhaseSourceEqualV1(sourceIdentity, { ...sourceIdentity, ...mutation }), /phase-closed source/);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("P4 physical census parser rejects malformed and over-cap process inventories", () => {
    const root = mkdtempSync(path.join(tmpdir(), "setfarm-p4-physical-census-"));
    let source = readFileSync(observerSource, "utf8");
    source = source
      .replace("function parsePhysicalProcessesV1(", "export function parsePhysicalProcessesV1(")
      .replace("function parseLsofReferencesV1(", "export function parseLsofReferencesV1(")
      .replace("function parseGitWorktreeListV1(", "export function parseGitWorktreeListV1(")
      .replace("function parseProcessListenersV1(", "export function parseProcessListenersV1(")
      .replace("function assertPhysicalInventoryPassStableV1(", "export function assertPhysicalInventoryPassStableV1(");
    fixtureFile(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts", source);
    fixtureFile(root, "src/internal-production/owner-admission-v1.ts", readFileSync(path.join(sourceRoot, "src/internal-production/owner-admission-v1.ts")));
    fixtureFile(root, "src/product-compiler/canonical-json.ts", readFileSync(path.join(sourceRoot, "src/product-compiler/canonical-json.ts")));
    fixtureFile(root, "package.json", `${JSON.stringify({ type: "module" })}\n`);
    const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
    const run = (text: string) => spawnSync(process.execPath, [
      "--import", tsxLoader, "--input-type=module", "-e",
      `import(${JSON.stringify(moduleUrl)}).then((m)=>process.stdout.write(JSON.stringify(m.parsePhysicalProcessesV1(Buffer.from(process.env.P4_PS)))))`,
    ], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "/usr/bin:/bin", P4_PS: text } });
    try {
      const row = "501 42 1 42 S Mon Aug 24 12:34:56 2026 /usr/bin/node fixture\n";
      const valid = run(row);
      assert.equal(valid.status, 0, valid.stderr);
      assert.equal(JSON.parse(valid.stdout)[0].pid, 42);
      const malformed = run("not a process row\n");
      assert.notEqual(malformed.status, 0);
      assert.match(malformed.stderr, /process row is malformed/);
      const overflow = run(row.repeat(4_097));
      assert.notEqual(overflow.status, 0);
      assert.match(overflow.stderr, /exceeds the row cap/);
      const runLsof = (bytes: Buffer) => spawnSync(process.execPath, [
        "--import", tsxLoader, "--input-type=module", "-e",
        `import(${JSON.stringify(moduleUrl)}).then((m)=>process.stdout.write(JSON.stringify(m.parseLsofReferencesV1(Buffer.from(process.env.P4_LSOF,"base64"),"/managed"))))`,
      ], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "/usr/bin:/bin", P4_LSOF: bytes.toString("base64") } });
      const lsofValid = runLsof(Buffer.from("p42\0cnode\0f1\0n/managed/file\0\n"));
      assert.equal(lsofValid.status, 0, lsofValid.stderr);
      assert.deepEqual(JSON.parse(lsofValid.stdout), { pids: [42], deleted: [] });
      for (const bytes of [
        Buffer.from("pbad\0n/managed/file\0\n"),
        Buffer.from("p42\0p42\0n/managed/file\0\n"),
        Buffer.from("n/managed/file\0\n"),
        Buffer.from("cnode\0f1\0\n"),
      ]) {
        const refused = runLsof(bytes);
        assert.notEqual(refused.status, 0);
      }
      const runPrivate = (expression: string, environment: Record<string, string> = {}) => spawnSync(process.execPath, [
        "--import", tsxLoader, "--input-type=module", "-e", `import(${JSON.stringify(moduleUrl)}).then((m)=>${expression})`,
      ], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "/usr/bin:/bin", ...environment } });
      const gitValid = runPrivate("process.stdout.write(JSON.stringify(m.parseGitWorktreeListV1(Buffer.from(process.env.P4_BYTES,'base64'))))", { P4_BYTES: Buffer.from("worktree /primary\0HEAD a\0worktree /managed\0HEAD b\0").toString("base64") });
      assert.equal(gitValid.status, 0, gitValid.stderr);
      assert.deepEqual(JSON.parse(gitValid.stdout), ["/primary", "/managed"]);
      for (const bytes of [Buffer.from("worktree /managed\0worktree /managed\0"), Buffer.from("worktree /managed\n")]) {
        assert.notEqual(runPrivate("m.parseGitWorktreeListV1(Buffer.from(process.env.P4_BYTES,'base64'))", { P4_BYTES: bytes.toString("base64") }).status, 0);
      }
      const listeners = runPrivate("process.stdout.write(JSON.stringify(m.parseProcessListenersV1(Buffer.from(process.env.P4_BYTES,'base64'),42)))", { P4_BYTES: Buffer.from("p42\0cnode\0f1\0n127.0.0.1:4567\0\n").toString("base64") });
      assert.equal(listeners.status, 0, listeners.stderr);
      assert.deepEqual(JSON.parse(listeners.stdout), [{ pid: 42, protocol: "TCP", localAddress: "127.0.0.1", port: 4567 }]);
      for (const bytes of [Buffer.from("p43\0n127.0.0.1:4567\0\n"), Buffer.from("p42\0nmalformed\0\n"), Buffer.from("p42\0n127.0.0.1:4567\0n127.0.0.1:4567\0\n")]) {
        assert.notEqual(runPrivate("m.parseProcessListenersV1(Buffer.from(process.env.P4_BYTES,'base64'),42)", { P4_BYTES: bytes.toString("base64") }).status, 0);
      }
      assert.equal(runPrivate("m.assertPhysicalInventoryPassStableV1({worktrees:[],processes:[],listeners:[],stale:[]},{worktrees:[],processes:[],listeners:[],stale:[]})").status, 0);
      assert.notEqual(runPrivate("m.assertPhysicalInventoryPassStableV1({worktrees:[],processes:[],listeners:[],stale:[]},{worktrees:[{root:'/changed',dirty:false}],processes:[],listeners:[],stale:[]})").status, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    const production = readFileSync(observerSource, "utf8");
    for (const literal of [
      "/usr/bin/git", "worktree", "--porcelain", "-z", "--porcelain=v2", "--untracked-files=all",
      "/bin/ps", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command=", "/usr/sbin/lsof", "-F0pcRfn", "+D", "-iTCP", "-sTCP:LISTEN",
    ]) assert.ok(production.includes(literal), `missing fixed physical literal ${literal}`);
  });

  it("P4 service census resolves the two fixed Setfarm launchers through detached daemon authority", () => {
    const source = readFileSync(observerSource, "utf8");
    assert.match(source, /observeDetachedSetfarmServiceV1/);
    assert.match(source, /label === "com\.setrox\.setfarm-spawner"[\s\S]{0,400}path\.join\(repository, "dist", "spawner\.js"\)/);
    assert.match(source, /path\.join\(repository, "dist", "server", "daemon\.js"\)[\s\S]{0,120}Object\.freeze\(\["3333"\]\)/);
    assert.match(source, /ppid !== 1|ppid === 1/);
    assert.match(source, /pgid !== candidate\.pid|pgid === candidate\.pid/);
    assert.match(source, /\["-ww", "-p", String\(candidate\.pid\), "-o", "comm="\]/);
    assert.match(source, /hashCanonicalJson\(\{ schema: "setfarm\.internal-production-service-identity\.v1", label, command: candidate\.command \}\)/);
    assert.match(source, /hashCanonicalJson\(\{ schema: "setfarm\.internal-production-loaded-service-generation\.v1", label, serviceIdentityHash, source \}\)/);
    assert.match(source, /return recursivelyFreeze\(\{ \.\.\.body, censusHash: hashCanonicalJson\(body\) \}\)/);
    assert.doesNotMatch(source, /readFileSync\([^\n]*(?:spawner|dashboard)\.pid/);
    assert.doesNotMatch(runDetachedServiceHarness.toString(), /setfarm-internal-production-bootstrap/);
    for (const [label, fault] of [["com.setrox.setfarm-spawner", "none"], ["com.setrox.setfarm-dashboard", "none"], ["com.setrox.setfarm-spawner", "stat_drift"]] as const) {
      const observed = runDetachedServiceHarness(label, fault);
      assert.equal(observed.status, 0, observed.stderr);
      const body = JSON.parse(observed.stdout);
      assert.equal(body.pid, label.endsWith("spawner") ? 101 : 102);
      assert.equal(body.processOwnerCount, 1);
      assert.equal(body.processIdentityHash, createHash("sha256").update(`${body.pid}\nSun Aug 16 15:42:28 2026\n`).digest("hex"));
      const sourceBody = { sha: "a".repeat(40), treeHash: "b".repeat(40), buildHash: "c".repeat(64) };
      assert.equal(body.loadedSourceSha, sourceBody.sha);
      assert.equal(body.loadedTreeHash, sourceBody.treeHash);
      assert.equal(body.loadedBuildHash, sourceBody.buildHash);
      assert.match(body.serviceIdentityHash, /^[a-f0-9]{64}$/);
      assert.equal(body.generationHash, canonicalHash({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash: body.serviceIdentityHash, source: sourceBody }));
      assert.equal(body.listener, label.endsWith("spawner") ? null : body.listener);
      if (label.endsWith("dashboard")) assert.deepEqual(body.listener, { host: "127.0.0.1", port: 3333, listenerIdentityHash: createHash("sha256").update("listener:102").digest("hex") });
    }
    for (const fault of ["launch_running", "launch_args", "launch_path", "launch_program", "launch_environment", "extra_environment", "inherited_preload", "crossed_env_dir", "plist_args", "zero", "multiple", "multiple_after", "wrong_uid", "wrong_ppid", "wrong_pgid", "zombie", "wrong_args", "wrong_comm", "drift", "cli_drift", "partial_lsof", "listener_missing", "listener_multiple", "listener_cross"]) {
      const label = fault.startsWith("listener_") ? "com.setrox.setfarm-dashboard" : "com.setrox.setfarm-spawner";
      const refused = runDetachedServiceHarness(label, fault);
      assert.notEqual(refused.status, 0, `${fault} must fail closed`);
      assert.equal(refused.stdout, "", `${fault} must not publish a census member`);
    }
  });
  it("receives the administrator URL only in an authenticated projection child", async () => {
    if (process.env.SETFARM_PG_URL === undefined) return;
    const databaseUrl = new URL(process.env.SETFARM_PG_URL);
    const isAuthenticatedProjection = /^\/setfarm_p3_[a-f0-9]{24}_(?:primary|clone_[a-f0-9]{12}|empty_[a-f0-9]{12})$/.test(databaseUrl.pathname);
    if (!isAuthenticatedProjection) {
      assert.equal(process.env.SETFARM_TEST_PG_ADMIN_URL, undefined);
      return;
    }
    await loadDatabaseOnlyForIsolatedLifecycleTest(process.env.SETFARM_PG_URL, async () => undefined);
    if (process.env.P4_PROJECTION_ENVIRONMENT_NEGATIVE_CHILD === "1") return;
    const runNegative = (database: string) => spawnSync(
      process.execPath,
      ["--import", "tsx", "--test", "--test-concurrency=1", "--test-name-pattern=^receives the administrator URL only in an authenticated projection child$", fileURLToPath(import.meta.url)],
      {
        cwd: sourceRoot,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          SETFARM_PG_URL: database,
          SETFARM_TEST_PG_ADMIN_URL: "postgresql://postgres@localhost:5432/postgres",
          P4_PROJECTION_ENVIRONMENT_NEGATIVE_CHILD: "1",
        },
      },
    );
    for (const database of [
      "postgresql://postgres@localhost:5432/setfarm_p3_0123456789abcdef01234567_primary",
      "postgresql://ambient.invalid:5432/setfarm_p3_0123456789abcdef01234567_primary",
    ]) {
      const refused = runNegative(database);
      assert.notEqual(refused.status, 0, `unauthenticated projection environment accepted: ${database}`);
      assert.doesNotMatch(refused.stdout, /P4_PROJECTION_DATABASE_CALLBACK_REACHED/);
    }
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

  it("P4 routes every current-entry authority store through the fixed sibling workspace root", () => {
    const source = readFileSync(observerSource, "utf8");
    assert.equal(
      [...source.matchAll(/fixedWorkspaceAuthorityPathV1\(/g)].length,
      20,
      "one helper definition plus all nineteen authority-store call sites must remain bound",
    );
    assert.doesNotMatch(source, /path\.join\(fixedRepositoryRoot\(\),/);
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

  it("P4 authenticates every code-owned authority directory while observing prepared current-entry state", () => {
    const authorityDirectories = [
      "operations",
      "records",
      "recovery-source-bootstrap-v1",
      "task12-p0-delivery-authorities",
    ] as const;
    const prepareStore = (root: string): string => {
      const store = currentEntryStore(root);
      for (const directory of [
        path.join(path.dirname(root), "data"),
        path.join(path.dirname(root), "data/internal-production-baseline"),
        store,
      ]) {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        chmodSync(directory, 0o700);
      }
      return store;
    };
    for (const members of [...authorityDirectories.map((entry) => [entry] as const), authorityDirectories]) {
      const root = createFixture();
      try {
        const store = prepareStore(root);
        for (const member of members) {
          mkdirSync(path.join(store, member), { mode: 0o700 });
          chmodSync(path.join(store, member), 0o700);
        }
        const result = runFixtureExpression(
          root,
          "m.observePreparedInternalProductionCurrentEntryOperationV1().then((value) => process.stdout.write(JSON.stringify(value)))",
        );
        assert.equal(result.status, 0, `${members.join(",")}: ${result.stderr}`);
        assert.equal(result.stdout, "null");
      } finally {
        removeFixture(root);
      }
    }

    for (const fault of ["file", "symlink", "wrong-mode", "wrong-device", "identity-swap", "unknown"] as const) {
      const root = createFixture({
        preparedAuthorityDirectorySwap: fault === "identity-swap" ? "operations" : undefined,
        preparedAuthorityDirectoryWrongDevice: fault === "wrong-device",
      });
      try {
        const store = prepareStore(root);
        if (fault === "file") writeFileSync(path.join(store, "operations"), "not a directory\n", { mode: 0o600 });
        else if (fault === "symlink") {
          const target = path.join(path.dirname(store), "foreign-authority-directory");
          mkdirSync(target, { mode: 0o700 });
          symlinkSync(target, path.join(store, "records"));
        } else if (fault === "wrong-mode") {
          mkdirSync(path.join(store, "recovery-source-bootstrap-v1"), { mode: 0o700 });
          chmodSync(path.join(store, "recovery-source-bootstrap-v1"), 0o755);
        } else if (fault === "unknown") mkdirSync(path.join(store, "unknown-authority-directory"), { mode: 0o700 });
        else mkdirSync(path.join(store, "operations"), { mode: 0o700 });
        const result = runFixtureExpression(root, "m.observePreparedInternalProductionCurrentEntryOperationV1()");
        assert.notEqual(result.status, 0, `${fault} must fail closed`);
        assert.match(result.stderr, /current-entry|directory|device|identity|inventory|mode/i);
      } finally {
        removeFixture(root);
      }
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
    const fixture = finalizedFixture({ stopAfterCurrentEntryOperationPublication: true });
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
      const fixture = finalizedFixture({ stopAfterCurrentEntryOperationPublication: true });
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
        assert.match(blocked.stderr, /regular|mode|link|inode|member|current-entry|cap|symbolic/i);
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
      const fixture = finalizedFixture({ preparedAccessorReobservationDrift: family, stopAfterCurrentEntryOperationPublication: true });
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
    const fixture = finalizedFixture({ stopAfterCurrentEntryOperationPublication: true });
    try {
      const seeded = runFixtureExpression(fixture.root, "m.prepareInternalProductionCurrentEntryOperationV1()");
      assert.equal(seeded.status, 0, seeded.stderr);
      const modulePath = path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
      const source = readFileSync(modulePath, "utf8");
      const drifted = source.replace(
        "before.dev !== parent.dev || before.dev !== atPath.dev",
        "before.dev !== parent.dev + 1n || before.dev !== atPath.dev",
      );
      assert.notEqual(drifted, source);
      writeFileSync(modulePath, drifted);
      const result = runFixtureExpression(fixture.root, "m.observePreparedInternalProductionCurrentEntryOperationV1()");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /device|inode|regular|current-entry/i);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("rejects last-instant prepared operation byte drift from the retained first snapshot", () => {
    const fixture = finalizedFixture({ preparedAccessorByteDrift: true, stopAfterCurrentEntryOperationPublication: true });
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
    const fixture = finalizedFixture({ stopAfterCurrentEntryOperationPublication: true });
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

  it("P4 publishes and adopts the three current-entry records in a finalized sibling-data fixture", () => {
    const fixture = finalizedFixture({ stubServiceCensus: true });
    try {
      const moduleUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
      const program = `import(${JSON.stringify(moduleUrl)}).then(async (m) => { const first=await m.prepareInternalProductionCurrentEntryOperationV1(); const second=await m.prepareInternalProductionCurrentEntryOperationV1(); process.stdout.write(JSON.stringify({first,second})); })`;
      const result = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], { cwd: fixture.root, encoding: "utf8", env: { ...process.env } });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout).first, JSON.parse(result.stdout).second);
      assert.equal(git(fixture.root, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
      assert.equal(existsSync(path.join(fixture.root, "data")), false);
      const store = path.join(path.dirname(fixture.root), "data/internal-production-baseline/current-entry-v1");
      const operationHash = JSON.parse(result.stdout).first.operationHash as string;
      assert.equal(existsSync(path.join(
        store,
        "operations/sha256",
        operationHash.slice(0, 2),
        operationHash,
        "01-current-status.pair.json",
      )), true);
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

  it("P4 recovers complete v31 and pending temp-only crash states before publishing the operation", () => {
    const fixture = finalizedFixture({ stopAfterCurrentEntryOperationPublication: true });
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

  it("P4 normalizes every non-target family pre-link and response-loss state before unrelated publication", () => {
    const families = [
      { basename: "authority-v3-migration31-audit.json", publish: "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()" },
      { basename: "pending-bootstrap-handoff-migration.json", publish: "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()" },
      { basename: "current-entry-operation.json", publish: "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()" },
    ] as const;
    const expected = ["authority-v3-migration31-audit.json", "current-entry-operation.json", "pending-bootstrap-handoff-migration.json"];
    const failures: string[] = [];
    for (const family of families) {
      for (const state of ["pre-link", "response-loss"] as const) {
        const fixture = finalizedFixture({ stopAfterCurrentEntryOperationPublication: true });
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

  it("P4 resnapshots when two publishers contend on non-target pre-link and response-loss normalization", async () => {
    for (const state of ["pre-link", "response-loss"] as const) {
      const fixture = finalizedFixture({ stopAfterCurrentEntryOperationPublication: true });
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

  it("P4 rejects special-bit directories and records on public current-entry publication paths", () => {
    const directoryFixture = finalizedFixture();
    const recordFixture = finalizedFixture();
    try {
      const directoryStore = currentEntryStore(directoryFixture.root);
      const seededDirectory = runFixtureExpression(directoryFixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
      assert.equal(seededDirectory.status, 0, seededDirectory.stderr);
      chmodSync(directoryStore, 0o4700);
      const directoryBlocked = runFixtureExpression(directoryFixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.notEqual(directoryBlocked.status, 0);
      assert.equal(existsSync(path.join(directoryStore, "pending-bootstrap-handoff-migration.json")), false);
      chmodSync(directoryStore, 0o700);

      const recordStore = currentEntryStore(recordFixture.root);
      const seededRecord = runFixtureExpression(recordFixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
      assert.equal(seededRecord.status, 0, seededRecord.stderr);
      const v31 = path.join(recordStore, "authority-v3-migration31-audit.json");
      chmodSync(v31, 0o4600);
      const recordBlocked = runFixtureExpression(recordFixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.notEqual(recordBlocked.status, 0);
      assert.equal(existsSync(path.join(recordStore, "pending-bootstrap-handoff-migration.json")), false);
      chmodSync(v31, 0o600);
    } finally {
      removeFixture(directoryFixture.root);
      removeFixture(recordFixture.root);
    }
  });

  it("P4 detects a current-entry ancestor replacement after the descriptor chain is pinned", () => {
    const fixture = finalizedFixture({ currentEntryAncestorSwapAfterGuard: true });
    try {
      const seeded = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
      assert.equal(seeded.status, 0, seeded.stderr);
      const original = readFileSync(path.join(currentEntryStore(fixture.root), "authority-v3-migration31-audit.json"));
      const blocked = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
      assert.notEqual(blocked.status, 0);
      assert.match(blocked.stderr, /directory chain changed|identity/i);
      const heldDirectories = readdirSync(path.dirname(currentEntryStore(fixture.root))).filter((name) => name.startsWith("held-current-entry-"));
      assert.equal(heldDirectories.length, 1);
      assert.equal(readFileSync(path.join(path.dirname(currentEntryStore(fixture.root)), heldDirectories[0]!, "authority-v3-migration31-audit.json")).equals(original), true);
      assert.equal(existsSync(path.join(currentEntryStore(fixture.root), "pending-bootstrap-handoff-migration.json")), false);
    } finally {
      removeFixture(fixture.root);
    }
  });

  it("P4 adopts at most eight authenticated current-entry crash temps and refuses the ninth untouched", () => {
    for (const count of [8, 9]) {
      const fixture = finalizedFixture();
      try {
        const seeded = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionAuthorityV3Migration31AuditV1()");
        assert.equal(seeded.status, 0, seeded.stderr);
        const store = currentEntryStore(fixture.root);
        const fixed = path.join(store, "authority-v3-migration31-audit.json");
        const bytes = readFileSync(fixed);
        unlinkSync(fixed);
        const tempNames = Array.from({ length: count }, (_, index) => `.authority-v3-migration31-audit.json.12345678-1234-4123-8123-${String(index + 1).padStart(12, "0")}.tmp`);
        for (const name of tempNames) {
          writeFileSync(path.join(store, name), bytes, { mode: 0o600 });
          chmodSync(path.join(store, name), 0o600);
        }
        const result = runFixtureExpression(fixture.root, "m.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1()");
        if (count === 8) {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(readFileSync(fixed).equals(bytes), true);
          assert.equal(tempNames.some((name) => existsSync(path.join(store, name))), false);
        } else {
          assert.notEqual(result.status, 0);
          assert.equal(existsSync(fixed), false);
          assert.deepEqual(tempNames.filter((name) => existsSync(path.join(store, name))), tempNames);
          assert.equal(existsSync(path.join(store, "pending-bootstrap-handoff-migration.json")), false);
        }
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
      "resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1",
      "observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1",
      "observeCurrentInternalProductionAuthorityV3Migration31AuditV1",
      "observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1",
      "resolveInternalProductionAuthorityV3Migration31AuditV1",
      "resolveInternalProductionPendingBootstrapHandoffMigrationV1",
      "observePreparedInternalProductionCurrentEntryOperationV1",
      "prepareInternalProductionCurrentEntryOperationV1",
      "resolveInternalProductionCurrentEntryOperationV1",
      "observeInternalProductionServiceCensusV1",
      "observeInternalProductionLegacyPreManifestZeroOwnerV1",
      "resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1",
      "resolveInternalProductionCompleteZeroOwnerCensusObservationV1",
      "observeCompleteInternalProductionZeroOwnerCensusV1",
      "resolveInternalProductionBaselineZeroOwnerMutationGuardV1",
      "prepareInternalProductionBaselineZeroOwnerMutationGuardV1",
      "resolveInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardConsumptionV1",
      "consumeInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardV1",
      "reobserveInternalProductionBaselineServiceRestartPreparedRuntimeProjectionV1",
      "observeInternalProductionCurrentEntryAuthorityStatusV1",
      "resolveInternalProductionCurrentEntryAuthorityStatusV1",
      "resolveInternalProductionCurrentEntryAuthorityV1",
      "resolveInternalProductionCurrentEntryVerificationV1",
      "resolveInternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1",
      "resolveInternalProductionPreManifestMigration32AuthorizationV1",
      "resolveInternalProductionPreManifestMigration32AuthorizationConsumptionV1",
      "resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1",
      "resolveInternalProductionPreManifestMigration32AuthorizationStatusV1",
      "observeInternalProductionPreManifestMigration32AuthorizationStatusV1",
      "prepareInternalProductionPreManifestMigration32AuthorizationV1",
      "applyInternalProductionBaselineBootstrapHandoffMigrationV1",
      "resolveInternalProductionRecoverySourceBootstrapPendingInputV1",
      "resolveInternalProductionRecoverySourceBootstrapOperationV1",
      "resolveInternalProductionRecoverySourceRunTerminalAuthorityV1",
      "resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1",
      "resolveInternalProductionRecoverySourceBootstrapRunReceiptV1",
      "resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1",
      "observeInternalProductionRecoverySourceBootstrapStatusV1",
      "prepareInternalProductionRecoverySourceBootstrapRunV1",
      "resumeActiveInternalProductionRecoverySourceBootstrapRunV1",
      "resumeInternalProductionCurrentEntryAuthorityV1",
      "verifyCurrentInternalProductionCurrentEntryV1",
      "observeInternalProductionReviewedDSourceBuildGateV1",
      "observeInternalProductionServiceRestartCutoverReadinessCandidateV1",
      "resolveInternalProductionBaselineServiceRestartAuthorizationV1",
      "resolveInternalProductionBaselineServiceRestartOperationV1",
      "observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1",
      "prepareInternalProductionBaselineServiceRestartV1",
      "observeInternalProductionBaselineServiceRestartAuthorizationStatusV1",
      "resolveInternalProductionBaselineServiceRestartAuthorityV1",
      "prepareInternalProductionBaselineSpawnerBootstrapServiceRestartAuthorizationV1",
      "restartInternalProductionBaselineServiceV1",
    ]);
    assert.match(source, /export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1\(\)/);
    assert.match(source, /export async function observePreparedInternalProductionCurrentEntryOperationV1\(\)/);
    assert.doesNotMatch(source, /process\.(?:argv|cwd)\b/);
    assert.deepEqual([...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]), ["SETFARM_PG_URL"]);
    assert.doesNotMatch(source, /\b(?:fallback|packagedFallback|repositoryRoot|gitBinary|toolPath)\s*[:=]/i);
    assert.match(source, /spawnSync\("\/usr\/bin\/git"/);
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(imports.filter((specifier) => specifier.startsWith(".")), ["../product-compiler/canonical-json.js", "./owner-admission-v1.js"]);
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
