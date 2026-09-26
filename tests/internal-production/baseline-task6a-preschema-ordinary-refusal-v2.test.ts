import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

import { canonicalJsonBytes, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { classifyTask6aPreSchemaOrdinaryStartupV2 } from "../../src/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.js";

const sourceRoot = path.resolve(import.meta.dirname, "../../src");
const journal = (state: string) => ({ schema: "setfarm.contract-spine-through33-journal-read-only.v2", state });
const absent = { state: "absent" };
const present = { state: "present", operationHash: "b".repeat(64), fileIdentity: "1:2:3:4" };
const tsxLoader = import.meta.resolve("tsx");

function operationBytes(): Buffer {
  const currentSource = { branch: "main", clean: true, sha: "a".repeat(40), treeHash: "b".repeat(40),
    buildHash: "c".repeat(64), originMainSha: "a".repeat(40) };
  const deliveredPaths = ["server/routes/setfarm-operational.test.ts", "server/routes/setfarm-operational.ts",
    "server/services/setfarm-product-build-authority.ts", "server/services/setfarm-product-build-authority.test.ts",
    "src/lib/product-build-authority.ts", "src/components/run-detail/ProductBuildAuthority.tsx",
    "tests/product-build-authority-render.test.tsx", "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json"];
  const deliveredPathBlobs = deliveredPaths.map((item, index) => ({ path: item, blobHash: String(index + 1).repeat(64) }));
  const argv = ["node", "--import", "tsx", "--test", deliveredPaths[0], deliveredPaths[3], deliveredPaths[6]];
  const focusedCore = { schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1", argv,
    commandContractHash: hashCanonicalJson({ argv }), testPathBlobs: [deliveredPathBlobs[0], deliveredPathBlobs[3], deliveredPathBlobs[6]],
    exitCode: 0, passed: true };
  const focusedTestReceiptHash = hashCanonicalJson(focusedCore);
  const focusedTests = { ...focusedCore,
    focusedTestReceiptRef: `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focusedTestReceiptHash}`,
    focusedTestReceiptHash };
  const artifactKinds = ["run-operational-snapshot.v1", "run-operational-snapshot.v2", "run-operational-snapshot.v3",
    "deployment-observation.v1", "project-transfer-ack.v1", "operational-active-run-status.v1"];
  const artifacts = artifactKinds.flatMap((kind) => ["compatibility", "schema"].map((suffix) => ({
    producerPath: `contracts/generated/mission-control/${kind}.${suffix}.json`,
    vendoredPath: `contracts/vendor/setfarm/${kind}.${suffix}.json`, sha256: "f".repeat(64),
  })));
  const vendorCore = { schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1",
    lockPath: deliveredPaths[7], producerRepository: "https://github.com/hikmetgulsesli/setfarm.git",
    producerCommit: "d".repeat(40), lockContentHash: deliveredPathBlobs[7]!.blobHash, artifacts,
    compatibilitySetHash: hashCanonicalJson({ schema: "mission-control.setfarm-contract-compatibility-set.v1", artifacts }) };
  const vendorLock = { ...vendorCore, vendorLockProjectionHash: hashCanonicalJson(vendorCore) };
  const evidenceCore = { schema: "mission-control.product-build-authority-v2-delivery-evidence.v1", currentStatus: "current",
    deliveryPrNumber: 19, deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a",
    deliveryMergeAncestorOfCurrentSource: true, currentSource, deliveredPathBlobs, focusedTests, vendorLock };
  const deliveryEvidenceHash = hashCanonicalJson(evidenceCore);
  const deliveryEvidenceRef = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`;
  const response = { schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    currentStatus: "current", deliveryEvidenceRef, deliveryEvidenceHash,
    evidence: { ...evidenceCore, deliveryEvidenceRef, deliveryEvidenceHash } };
  const pair = (name: string, refKey: string, hashKey: string, hash: string) => ({
    [refKey]: `setfarm://internal-production/${name}/sha256/${hash}`, [hashKey]: hash,
  });
  const body = {
    schema: "setfarm.internal-production-current-entry-operation.v1",
    purpose: "task6a-internal-production-current-entry-v1",
    controllerSource: currentSource,
    productBuildAuthorityV2DeliveryEvidence: { deliveryEvidenceRef, deliveryEvidenceHash },
    productBuildAuthorityV2Observation: { schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
      observationTransport: "source-cli", response },
    authorityV3Migration31Audit: pair("authority-v3-migration31-audit", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "d".repeat(64)),
    pendingBootstrapHandoffMigration: pair("pending-bootstrap-handoff-migration", "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "e".repeat(64)),
  };
  const operationHash = hashCanonicalJson(body);
  return Buffer.concat([canonicalJsonBytes({ ...body,
    operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`,
    operationHash,
  }), Buffer.from("\n")]);
}

function observeAtFakeHome(home: string) {
  const modulePath = path.join(sourceRoot, "internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts");
  const code = `
    import os from "node:os";
    import { syncBuiltinESMExports } from "node:module";
    const original = os.userInfo();
    os.userInfo = () => ({ ...original, homedir: ${JSON.stringify(home)} });
    syncBuiltinESMExports();
    const module = await import(${JSON.stringify(modulePath)});
    try { console.log(JSON.stringify(module.observeTask6aFixedCurrentEntryOperationPresenceV2())); }
    catch (error) { console.error(error instanceof Error ? error.message : "INVALID"); process.exitCode = 1; }
  `;
  return spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", code], {
    cwd: path.resolve(sourceRoot, ".."), encoding: "utf8", env: { ...process.env, SETFARM_PG_URL: undefined },
  });
}

function preflightAtFakeHome(home: string) {
  const modulePath = path.join(sourceRoot, "internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts");
  const code = `
    import os from "node:os";
    import { syncBuiltinESMExports } from "node:module";
    const original = os.userInfo();
    os.userInfo = () => ({ ...original, homedir: ${JSON.stringify(home)} });
    syncBuiltinESMExports();
    const module = await import(${JSON.stringify(modulePath)});
    try { await module.assertTask6aPreSchemaOrdinaryStartupV2(); console.log("EXISTING_GATES"); }
    catch (error) { console.error(error instanceof Error ? error.message : "INVALID"); process.exitCode = 1; }
  `;
  return spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", code], {
    cwd: path.resolve(sourceRoot, ".."), encoding: "utf8", env: { ...process.env, SETFARM_PG_URL: undefined },
  });
}

test("Task6A V2 ordinary preflight leaves a noncanonical installation with no fixed workspace to existing gates", () => {
  const home = mkdtempSync(path.join(tmpdir(), "task6a-ordinary-home-"));
  try {
    const result = preflightAtFakeHome(home);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "EXISTING_GATES\n");
    const ai = path.join(home, "ai");
    symlinkSync("missing-target", ai);
    const linkedParent = preflightAtFakeHome(home);
    assert.equal(linkedParent.status, 1);
    assert.equal(linkedParent.stderr, "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED\n");
    rmSync(ai);
    mkdirSync(ai, { mode: 0o700 });
    const missingRoot = preflightAtFakeHome(home);
    assert.equal(missingRoot.status, 0, missingRoot.stderr);
    const root = path.join(ai, "setrox");
    symlinkSync("missing-target", root);
    const linkedRoot = preflightAtFakeHome(home);
    assert.equal(linkedRoot.status, 1);
    assert.equal(linkedRoot.stderr, "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED\n");
    rmSync(root);
    writeFileSync(root, "not-a-directory");
    const fileRoot = preflightAtFakeHome(home);
    assert.equal(fileRoot.status, 1);
    rmSync(root);
    const store = path.join(root, "data/internal-production-baseline/current-entry-v1");
    mkdirSync(store, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(store, "current-entry-operation.json"), operationBytes(), { mode: 0o600 });
    const presentOperation = preflightAtFakeHome(home);
    assert.equal(presentOperation.status, 1);
    assert.equal(presentOperation.stderr, "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED\n");
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("Task6A V2 canonical checkout never treats a missing fixed workspace as out of scope", () => {
  const source = readFileSync(path.join(sourceRoot, "internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts"), "utf8");
  const tree = ts.createSourceFile("baseline-task6a-preschema-ordinary-refusal-v2.ts", source, ts.ScriptTarget.Latest, true);
  const helper = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "ordinaryCheckoutWithoutFixedWorkspaceV2");
  assert.ok(helper);
  const js = ts.transpileModule(helper.getText(tree).replace("import.meta.url", "sourceUrl"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const root = path.join(tmpdir(), "canonical-task6a-checkout", "ai", "setrox");
  const run = new Function("resolveInternalProductionBaselineWorkspaceRootV1", "path", "fileURLToPath", "sourceUrl",
    `const cleanupUncertain = false;\n${js}\nreturn ordinaryCheckoutWithoutFixedWorkspaceV2();`) as
    (root: () => string, paths: typeof path, sourcePath: () => string, url: string) => boolean;
  assert.equal(run(() => root, path, () => path.join(root, "dist/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.js"), "file:///canonical"), false);
  if (process.platform === "darwin") {
    const lexicalAlias = "/var/folders/task6a-home/ai/setrox";
    const physicalAlias = `/private${lexicalAlias}`;
    assert.equal(run(() => lexicalAlias, path, () => path.join(physicalAlias, "dist/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.js"), "file:///canonical-alias"), false);
  }
});

test("Task6A V2 ordinary workspace absence cannot bypass uncertain cleanup", () => {
  const source = readFileSync(path.join(sourceRoot, "internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts"), "utf8");
  const tree = ts.createSourceFile("baseline-task6a-preschema-ordinary-refusal-v2.ts", source, ts.ScriptTarget.Latest, true);
  const helper = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "ordinaryCheckoutWithoutFixedWorkspaceV2");
  assert.ok(helper?.body);
  assert.equal(helper.body.statements[0]?.getText(tree), "if (cleanupUncertain) fail();");
});

test("Task6A V2 fixed-operation probe is no-write and refuses malformed or symlinked records", () => {
  const home = mkdtempSync(path.join(tmpdir(), "task6a-preschema-home-"));
  try {
    const store = path.join(home, "ai/setrox/data/internal-production-baseline/current-entry-v1");
    mkdirSync(store, { recursive: true, mode: 0o700 });
    const target = path.join(store, "current-entry-operation.json");
    const absentResult = observeAtFakeHome(home);
    assert.equal(absentResult.status, 0, absentResult.stderr);
    assert.deepEqual(JSON.parse(absentResult.stdout).state, "absent");
    const bytes = operationBytes();
    writeFileSync(target, bytes, { mode: 0o600 });
    const before = statSync(target, { bigint: true });
    const presentResult = observeAtFakeHome(home);
    assert.equal(presentResult.status, 0, presentResult.stderr);
    assert.equal(JSON.parse(presentResult.stdout).state, "present");
    assert.deepEqual(readFileSync(target), bytes);
    assert.equal(statSync(target, { bigint: true }).mtimeNs, before.mtimeNs);
    const nested = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    nested.controllerSource = null;
    delete nested.operationRef;
    delete nested.operationHash;
    const nestedHash = hashCanonicalJson(nested);
    writeFileSync(target, Buffer.concat([canonicalJsonBytes({ ...nested,
      operationRef: `setfarm://internal-production/current-entry-operation/sha256/${nestedHash}`,
      operationHash: nestedHash,
    }), Buffer.from("\n")]), { mode: 0o600 });
    const selfHashedInvalid = observeAtFakeHome(home);
    assert.equal(selfHashedInvalid.status, 1);
    assert.equal(selfHashedInvalid.stderr, "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED\n");
    const malformedPba = JSON.parse(bytes.toString("utf8")) as Record<string, any>;
    const invalidEvidenceCore = { fixture: true };
    const invalidEvidenceHash = hashCanonicalJson(invalidEvidenceCore);
    const invalidEvidenceRef = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${invalidEvidenceHash}`;
    malformedPba.productBuildAuthorityV2DeliveryEvidence = { deliveryEvidenceRef: invalidEvidenceRef, deliveryEvidenceHash: invalidEvidenceHash };
    malformedPba.productBuildAuthorityV2Observation.response = {
      schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1", currentStatus: "current",
      deliveryEvidenceRef: invalidEvidenceRef, deliveryEvidenceHash: invalidEvidenceHash,
      evidence: { ...invalidEvidenceCore, deliveryEvidenceRef: invalidEvidenceRef, deliveryEvidenceHash: invalidEvidenceHash },
    };
    delete malformedPba.operationRef;
    delete malformedPba.operationHash;
    const malformedPbaHash = hashCanonicalJson(malformedPba);
    writeFileSync(target, Buffer.concat([canonicalJsonBytes({ ...malformedPba,
      operationRef: `setfarm://internal-production/current-entry-operation/sha256/${malformedPbaHash}`,
      operationHash: malformedPbaHash,
    }), Buffer.from("\n")]), { mode: 0o600 });
    const selfHashedInvalidPba = observeAtFakeHome(home);
    assert.equal(selfHashedInvalidPba.status, 1);
    assert.equal(selfHashedInvalidPba.stderr, "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED\n");
    writeFileSync(target, Buffer.from("not-json\n"), { mode: 0o600 });
    const malformed = observeAtFakeHome(home);
    assert.equal(malformed.status, 1);
    assert.equal(malformed.stderr, "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED\n");
    rmSync(target);
    symlinkSync("missing-target", target);
    const linked = observeAtFakeHome(home);
    assert.equal(linked.status, 1);
    assert.equal(linked.stderr, "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED\n");
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("Task6A V2 pre-schema classifier leaves absent operation to existing ordinary gates", () => {
  assert.equal(classifyTask6aPreSchemaOrdinaryStartupV2(absent, null), "existing-gates");
  assert.throws(() => classifyTask6aPreSchemaOrdinaryStartupV2(absent, journal("not-through33")));
});

test("Task6A V2 pre-schema classifier refuses an operation without exact through33 journal", () => {
  assert.throws(() => classifyTask6aPreSchemaOrdinaryStartupV2(present, journal("not-through33")), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
});

test("Task6A V2 pre-schema classifier permits only exact through33 journal to reach existing gates", () => {
  assert.equal(classifyTask6aPreSchemaOrdinaryStartupV2(present, journal("through33-journal-applied")), "existing-gates");
  for (const value of [null, journal("pending"), { ...journal("through33-journal-applied"), extra: true },
    { ...journal("through33-journal-applied"), schema: "crossed" }]) {
    assert.throws(() => classifyTask6aPreSchemaOrdinaryStartupV2(present, value), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  }
});

test("Task6A V2 preflight is before all ordinary startup mutations and does not change special child order", () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const start = source.indexOf("async function main() {");
  assert.ok(start >= 0);
  const body = source.slice(start, source.indexOf("  const pgUrl =", start));
  const at = (needle: string) => { const index = body.indexOf(needle); assert.ok(index >= 0, needle); return index; };
  const direct = at("await runInternalProductionDirectSpawnerStartupV1()");
  const cold = at("await runInternalProductionColdSpawnerStartupV1()");
  const preflight = at("await assertTask6aPreSchemaOrdinaryStartupV2()");
  assert.ok(direct < cold && cold < preflight);
  for (const effect of ["await reclaimPostRecoveryOrdinaryStartupFilesV1", "acquireSpawnerSingletonLock()", "publishSpawnerPidFileV1()",
    "claimInternalProductionBaselineSpawnerStartupAdmissionV1", "await pgMigrate()"])
    assert.ok(preflight < at(effect), effect);
  const module = readFileSync(path.join(sourceRoot, "internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts"), "utf8");
  assert.doesNotMatch(module, /observeInternalProductionCurrentEntryAuthorityStatusV1|observeInternalProductionPreSchemaSpawnerRebindStatusV1|fsyncSync|mkdirSync|writeFileSync/);
});

test("Task6A V2 extracted startup prefix refuses before existing ordinary admission", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const main = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "main");
  assert.ok(main?.body);
  const prefix = main.body.statements.slice(1, 5).map((statement) => statement.getText(tree)).join("\n");
  assert.match(prefix, /assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\)/);
  const execute = new Function("direct", "cold", "preflight", "ordinary",
    `return (async () => {
      const runInternalProductionDirectSpawnerStartupV1 = direct;
      const runInternalProductionColdSpawnerStartupV1 = cold;
      const assertTask6aPreSchemaOrdinaryStartupV2 = preflight;
      const assertOrdinarySpawnerDeploymentCutoverAdmissionV1 = ordinary;
      ${prefix}
    })();`) as (direct: () => Promise<boolean>, cold: () => Promise<boolean>,
      preflight: () => Promise<void>, ordinary: () => void) => Promise<void>;
  const calls: string[] = [];
  const run = (direct: boolean, cold: boolean, blocked: boolean) => execute(
    async () => { calls.push("direct"); return direct; },
    async () => { calls.push("cold"); return cold; },
    async () => { calls.push("preflight"); if (blocked) throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    () => { calls.push("ordinary"); },
  );
  await run(true, false, false);
  assert.deepEqual(calls.splice(0), ["direct"]);
  await run(false, true, false);
  assert.deepEqual(calls.splice(0), ["direct", "cold"]);
  await assert.rejects(run(false, false, true), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  assert.deepEqual(calls.splice(0), ["direct", "cold", "preflight"]);
  await run(false, false, false);
  assert.deepEqual(calls, ["direct", "cold", "preflight", "ordinary"]);
});

test("Task6A V2 ongoing spawn rechecks before its first ordinary effect", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const spawn = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "spawnAgentNow");
  assert.ok(spawn?.body);
  const first = spawn.body.statements[0]?.getText(tree);
  assert.equal(first, "await assertTask6aPreSchemaOrdinaryStartupV2();");
  const run = new Function("preflight", "effect", `return (async () => {
    const assertTask6aPreSchemaOrdinaryStartupV2 = preflight;
    ${first}
    effect();
  })();`) as (preflight: () => Promise<void>, effect: () => void) => Promise<void>;
  const effects: string[] = [];
  await assert.rejects(run(async () => { throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    () => effects.push("effect")), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  assert.deepEqual(effects, []);
  await run(async () => { effects.push("preflight"); }, () => effects.push("effect"));
  assert.deepEqual(effects, ["preflight", "effect"]);
});

test("Task6A V2 direct CLI claim refuses before claim effects or output", async () => {
  const source = readFileSync(path.join(sourceRoot, "cli/cli.ts"), "utf8");
  const tree = ts.createSourceFile("cli.ts", source, ts.ScriptTarget.Latest, true);
  const main = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "main");
  assert.ok(main?.body);
  const step = main.body.statements.find((node): node is ts.IfStatement =>
    ts.isIfStatement(node) && node.expression.getText(tree) === 'group === "step"');
  assert.ok(step && ts.isBlock(step.thenStatement));
  const claim = step.thenStatement.statements.find((node): node is ts.IfStatement =>
    ts.isIfStatement(node) && node.expression.getText(tree) === 'action === "claim"');
  assert.ok(claim && ts.isBlock(claim.thenStatement));
  const statements = claim.thenStatement.statements;
  const preflight = "await assertTask6aPreSchemaOrdinaryStartupV2();";
  const claimCall = "const result = await claimStep(target, callerAgent);";
  assert.equal(statements[3]?.getText(tree), preflight);
  assert.equal(statements[4]?.getText(tree), claimCall);
  assert.ok(statements.slice(5).some((node) => node.getText(tree).includes('process.stdout.write("NO_WORK\\n")')));
  assert.ok(statements.slice(5).some((node) => node.getText(tree).includes("process.stdout.write(JSON.stringify(")));
  const run = new Function("check", "claim", `return (async () => {
    const assertTask6aPreSchemaOrdinaryStartupV2 = check;
    const claimStep = claim;
    const target = "agent";
    const callerAgent = undefined;
    ${statements[3]!.getText(tree)}
    ${statements[4]!.getText(tree)}
    return result;
  })();`) as (check: () => Promise<void>, claim: () => Promise<unknown>) => Promise<unknown>;
  const calls: string[] = [];
  await assert.rejects(run(async () => { calls.push("preflight"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    async () => { calls.push("claim"); return { found: false }; }), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  assert.deepEqual(calls.splice(0), ["preflight"]);
  assert.deepEqual(await run(async () => { calls.push("preflight"); },
    async () => { calls.push("claim"); return { found: false }; }), { found: false });
  assert.deepEqual(calls, ["preflight", "claim"]);
});

test("Task6A V2 journal inspector is a read-only transaction and requires exact attestation and all 33 rows", async () => {
  const source = readFileSync(path.join(sourceRoot, "db/contract-spine-migrations.ts"), "utf8");
  const tree = ts.createSourceFile("contract-spine-migrations.ts", source, ts.ScriptTarget.Latest, true);
  const name = "inspectContractSpineThrough33JournalReadOnlyV2";
  const functions = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(functions.length, 1);
  const js = ts.transpileModule(functions[0]!.getText(tree).replace(/^export /, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const expected = Array.from({ length: 34 }, (_, index) => ({ version: index + 1,
    name: `migration-${index + 1}`, migrationClass: index === 31 ? "guarded" : "automatic",
    checksum: "a".repeat(64), state: "applied" }));
  const run = async (attestation: string, rows: readonly unknown[]) => {
    const statements: string[] = [];
    const inspect = new Function("completeMigrations", "checksum", "detectMigrationAttestationShape", "completeJournalRows",
      `${js}\nreturn ${name};`)(expected, (migration: { checksum: string }) => migration.checksum,
      async () => attestation, async () => rows) as (sql: unknown) => Promise<{ state: string }>;
    const result = await inspect({ begin: async (mode: string, callback: (transaction: unknown) => Promise<unknown>) => {
      assert.equal(mode, "isolation level repeatable read read only");
      return callback({ unsafe: async (statement: string) => {
        assert.match(statement, /^SELECT /, "no DDL/DML in inspection");
        statements.push(statement);
      } });
    } });
    assert.equal(statements.length, 4);
    assert.ok(statements.some((statement) => statement.includes("lock_timeout")));
    assert.ok(statements.some((statement) => statement.includes("statement_timeout")));
    return result.state;
  };
  assert.equal(await run("present", expected.slice(0, 33)), "through33-journal-applied",
    "a future migration definition must not strand a database whose journal is already through 33");
  assert.equal(await run("present", expected), "through33-journal-applied",
    "a later correctly applied migration must retain the through-33 fact");
  assert.equal(await run("absent", expected.slice(0, 33)), "not-through33", "all rows without exact attestation must not pass");
  assert.equal(await run("present", expected.slice(0, 31)), "not-through33");
  assert.equal(await run("present", [...expected, expected[0]]), "not-through33");
  assert.equal(await run("present", expected.map((row, index) => index === 32 ? { ...row, checksum: "b".repeat(64) } : row)), "not-through33");
  assert.equal(await run("present", expected.map((row, index) => index === 33 ? { ...row, checksum: "b".repeat(64) } : row)), "not-through33",
    "a present post-33 row must still match its known definition");
  assert.equal(await run("present", expected.map((row, index) => index === 31 ? { ...row, state: "adopted" } : row)), "not-through33");
});
