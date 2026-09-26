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

test("Task6A V2 prespawn rechecks after every awaited continuation before effects", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const spawn = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "spawnAgentNow");
  assert.ok(spawn?.body);
  const statements = spawn.body.statements;
  const deferIndex = statements.findIndex((node) => ts.isVariableStatement(node)
    && node.getText(tree).includes("await shouldDeferBackgroundWorkflow(wfId)"));
  assert.ok(deferIndex >= 0, "background query must be an awaited statement before its effectful branch");
  const restartIndex = statements.findIndex((node) => ts.isIfStatement(node)
    && node.getText(tree).includes('await restartGatewayAfterOpenClawCleanup("prespawn", openClawCleanup)'));
  assert.ok(restartIndex >= 0);
  const restart = statements[restartIndex]!;
  assert.ok(ts.isIfStatement(restart));
  const runtime = statements.find((node): node is ts.IfStatement => ts.isIfStatement(node)
    && node.getText(tree).includes("const gatewayReadiness = await getGatewayReadiness()"));
  assert.ok(runtime && ts.isBlock(runtime.thenStatement));
  const readinessStatements = runtime.thenStatement.statements;
  const readinessIndex = readinessStatements.findIndex((node) => ts.isVariableStatement(node)
    && node.getText(tree).includes("await getGatewayReadiness()"));
  assert.ok(readinessIndex >= 0);

  const boundaries: ReadonlyArray<{ name: string; body: ts.NodeArray<ts.Statement>; index: number; next: RegExp }> = [
    { name: "background", body: statements, index: deferIndex, next: /if \(deferBackgroundWorkflow\)/ },
    { name: "restart", body: statements, index: restartIndex, next: /if \(trackedRuntimeCount\(\) >= MAX_CONCURRENT\)/ },
    { name: "readiness", body: readinessStatements, index: readinessIndex, next: /if \(!gatewayReadiness\.ready\)/ },
  ];
  for (const { name, body, index, next } of boundaries) {
    const guard = body[index + 1]?.getText(tree);
    const shutdown = body[index + 2]?.getText(tree);
    assert.equal(guard, "await assertTask6aPreSchemaOrdinaryStartupV2();", `${name} guard`);
    assert.equal(shutdown, "if (shuttingDown) return;", `${name} shutdown`);
    assert.match(body[index + 3]?.getText(tree) || "", next, `${name} effect ordering`);
    const run = new Function("wait", "preflight", "effect", `return (async () => {
      let shuttingDown = false;
      const assertTask6aPreSchemaOrdinaryStartupV2 = () => preflight(() => { shuttingDown = true; });
      await wait();
      ${guard}
      ${shutdown}
      effect();
    })();`) as (wait: () => Promise<void>, preflight: (shutdown: () => void) => Promise<void>,
      effect: () => void) => Promise<void>;
    const calls: string[] = [];
    await assert.rejects(run(async () => { calls.push("await"); },
      async () => { calls.push("guard"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
      () => calls.push("effect")), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
    assert.deepEqual(calls.splice(0), ["await", "guard"], name);
    await run(async () => { calls.push("await"); },
      async (shutdownNow) => { calls.push("guard"); shutdownNow(); }, () => calls.push("effect"));
    assert.deepEqual(calls.splice(0), ["await", "guard"], name);
    await run(async () => { calls.push("await"); },
      async () => { calls.push("guard"); }, () => calls.push("effect"));
    assert.deepEqual(calls, ["await", "guard", "effect"], name);
  }
});

test("Task6A V2 found claim refuses after claimStep without a release write", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const spawn = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "spawnAgentNow");
  assert.ok(spawn?.body);
  const statements = spawn.body.statements;
  const claimIndex = statements.findIndex((node) => ts.isTryStatement(node)
    && node.tryBlock.getText(tree).includes("claim = await claimStep("));
  assert.ok(claimIndex >= 0);
  const noWork = statements[claimIndex + 1];
  assert.ok(noWork && ts.isIfStatement(noWork));
  assert.equal(noWork.expression.getText(tree), "!claim.found");
  const refusal = statements[claimIndex + 2];
  assert.ok(refusal && ts.isTryStatement(refusal));
  assert.equal(refusal.tryBlock.statements[0]?.getText(tree), "await assertTask6aPreSchemaOrdinaryStartupV2();");
  assert.ok(refusal.catchClause?.block.getText(tree).includes("retainTask6aV2PostClaimRuntimeIfExact(claim, runtimeIntent)"));
  assert.ok(refusal.catchClause?.block.getText(tree).includes("claimingSpawns.delete(key)"));
  assert.ok(refusal.catchClause?.block.getText(tree).includes("return;"));
  assert.doesNotMatch(refusal.getText(tree), /releaseUntransferredPostClaimOwnership|quarantine|unlinkSync/);
  const shutdown = statements[claimIndex + 3];
  assert.ok(shutdown && ts.isIfStatement(shutdown));
  assert.equal(shutdown.expression.getText(tree), "shuttingDown");
  assert.match(shutdown.thenStatement.getText(tree), /retainTask6aV2PostClaimRuntimeIfExact\(claim, runtimeIntent\)/);
  assert.match(shutdown.thenStatement.getText(tree), /claimingSpawns\.delete\(key\)/);
  assert.match(shutdown.thenStatement.getText(tree), /return;/);
  assert.doesNotMatch(shutdown.getText(tree), /releaseUntransferredPostClaimOwnership|quarantine|unlinkSync/);
  assert.match(statements[claimIndex + 4]?.getText(tree) || "", /^let postClaimOwnershipTransferred = false;/);

  const run = new Function("preflight", "effect", "deletes", "warnings", "retained", "unbound", "exact", `return (async () => {
    const claim = { found: true };
    const runtimeIntent = { sessionId: "RTS_exact", ownerInstanceId: "owner" };
    const key = "wf:role:agent";
    let shuttingDown = false;
    let task6aV2UnboundPostClaimRefusals = 0;
    const claimingSpawns = { delete: (value) => deletes.push(value) };
    const console = { warn: (value) => warnings.push(value) };
    const retainTask6aV2PostClaimRuntimeIfExact = () => { retained.push("sampled"); return exact; };
    const assertTask6aPreSchemaOrdinaryStartupV2 = () => preflight(() => { shuttingDown = true; });
    try {
      ${refusal.getText(tree)}
      ${shutdown.getText(tree)}
      effect();
    } finally { unbound.push(task6aV2UnboundPostClaimRefusals); }
  })();`) as (preflight: (shutdown: () => void) => Promise<void>, effect: () => void,
      deletes: string[], warnings: string[], retained: string[], unbound: number[], exact: boolean) => Promise<void>;
  const effects: string[] = [];
  const deletes: string[] = [];
  const warnings: string[] = [];
  const retained: string[] = [];
  const unbound: number[] = [];
  await run(async () => { throw Error("PRIVATE_CAUSE_SHOULD_NOT_BE_LOGGED"); },
    () => effects.push("postclaim"), deletes, warnings, retained, unbound, true);
  assert.deepEqual(effects, []);
  assert.deepEqual(deletes.splice(0), ["wf:role:agent"]);
  assert.deepEqual(warnings.splice(0), ["[spawner] Task6A V2 post-claim refused; claim left unchanged for inspection"]);
  assert.deepEqual(retained.splice(0), ["sampled"]);
  assert.deepEqual(unbound.splice(0), [0]);
  await run(async (shutdownNow) => { shutdownNow(); },
    () => effects.push("postclaim"), deletes, warnings, retained, unbound, true);
  assert.deepEqual(effects, []);
  assert.deepEqual(deletes.splice(0), ["wf:role:agent"]);
  assert.deepEqual(warnings.splice(0), ["[spawner] Shutdown after claim; claim left unchanged for inspection"]);
  assert.deepEqual(retained.splice(0), ["sampled"]);
  assert.deepEqual(unbound.splice(0), [0]);
  let releasePreflight!: () => void;
  let signalEntered!: () => void;
  let beginShutdown!: () => void;
  const entered = new Promise<void>((resolve) => { signalEntered = resolve; });
  const heldPreflight = new Promise<void>((resolve) => { releasePreflight = resolve; });
  const pending = run(async (shutdownNow) => {
    beginShutdown = shutdownNow;
    signalEntered();
    await heldPreflight;
  }, () => effects.push("postclaim"), deletes, warnings, retained, unbound, true);
  await entered;
  beginShutdown();
  releasePreflight();
  await pending;
  assert.deepEqual(effects, []);
  assert.deepEqual(deletes.splice(0), ["wf:role:agent"]);
  assert.deepEqual(retained.splice(0), ["sampled"]);
  assert.deepEqual(unbound.splice(0), [0]);
  assert.deepEqual(warnings.splice(0), ["[spawner] Shutdown after claim; claim left unchanged for inspection"]);
  await run(async () => {}, () => effects.push("postclaim"), deletes, warnings, retained, unbound, true);
  assert.deepEqual(effects, ["postclaim"]);
  assert.deepEqual(deletes, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(retained, []);
  assert.deepEqual(unbound.splice(0), [0]);
  await run(async () => { throw Error("refused"); }, () => effects.push("postclaim"),
    deletes, warnings, retained, unbound, false);
  assert.deepEqual(effects, ["postclaim"]);
  assert.deepEqual(unbound, [1], "legacy no-runtime refusal must make shutdown nonzero");
});

test("Task6A V2 shutdown retains only an exact process-free reserved post-claim runtime", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const register = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "retainTask6aV2PostClaimRuntimeIfExact");
  const matches = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "matchesTask6aV2RetainedPostClaimRuntimeForShutdown");
  assert.ok(register?.body && matches?.body);
  const map = new Map<string, { claimId: number; ownerInstanceId: string }>();
  const registerJs = ts.transpileModule(register.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const makeRegister = new Function("retainedMap", `
    const task6aV2RetainedPostClaimRuntimes = retainedMap;
    ${registerJs}
    return retainTask6aV2PostClaimRuntimeIfExact;
  `) as (retainedMap: typeof map) => (claim: Record<string, unknown>, intent: Record<string, unknown>) => boolean;
  const registerRuntime = makeRegister(map);
  const intent = { sessionId: "RTS_exact", ownerInstanceId: "owner" };
  assert.equal(registerRuntime({ found: true, claimId: 7 }, intent), false);
  assert.equal(map.size, 0, "legacy found claim without runtime must not gain a shutdown exemption");
  assert.equal(registerRuntime({ found: true, claimId: 7, runtimeSessionId: "RTS_wrong", runtimeOwnerInstanceId: "owner" }, intent), false);
  assert.equal(map.size, 0);
  assert.equal(registerRuntime({ found: true, claimId: 7, runtimeSessionId: "RTS_exact", runtimeOwnerInstanceId: "other" }, intent), false);
  assert.equal(map.size, 0);
  assert.equal(registerRuntime({ found: true, claimId: 7, runtimeSessionId: "RTS_exact", runtimeOwnerInstanceId: "owner" }, intent), true);
  assert.deepEqual(map.get("RTS_exact"), { claimId: 7, ownerInstanceId: "owner" });

  const matchesJs = ts.transpileModule(matches.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const match = new Function(`${matchesJs}\nreturn matchesTask6aV2RetainedPostClaimRuntimeForShutdown;`)() as
    (session: Record<string, unknown>, retained: Record<string, unknown> | undefined) => boolean;
  const session = { sessionId: "RTS_exact", claimId: 7, ownerInstanceId: "owner", state: "reserved" };
  assert.equal(match(session, map.get("RTS_exact")), true);
  for (const crossed of [
    { ...session, claimId: 8 }, { ...session, ownerInstanceId: "other" },
    { ...session, state: "starting" }, { ...session, pid: 123 },
    { ...session, processIdentity: { pid: 123 } }, { ...session, processGroupId: 123 },
    { ...session, processStartedAt: new Date().toISOString() },
    { ...session, startedAt: new Date().toISOString() },
  ]) assert.equal(match(crossed, map.get("RTS_exact")), false);
  assert.equal(match(session, undefined), false);

  const shutdownLoop = source.slice(source.indexOf("for (const session of remaining) {"),
    source.indexOf("const failed = results.filter", source.indexOf("for (const session of remaining) {")));
  const exact = shutdownLoop.indexOf("matchesTask6aV2RetainedPostClaimRuntimeForShutdown(");
  const openClaim = shutdownLoop.indexOf("FROM claim_log", exact);
  const retained = shutdownLoop.indexOf('status: "retained_for_recovery"', openClaim);
  const quarantine = shutdownLoop.indexOf("runtimeSessions.quarantine(");
  assert.ok(exact >= 0 && openClaim > exact && retained > openClaim && quarantine > retained);
  assert.match(shutdownLoop.slice(openClaim, retained), /outcome IS NULL/);
  const loopJs = ts.transpileModule(`async function runLoop() { ${shutdownLoop} }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const runShutdownLoop = new Function("remaining", "retainedMap", "claimIsOpen", "writes", `
    const tracked = new Map();
    const results = [];
    const SPAWNER_INSTANCE_ID = "owner";
    const task6aV2RetainedPostClaimRuntimes = retainedMap;
    const runtimeSessions = { quarantine: async (value) => { writes.push(value); } };
    const pgGet = async (sql, params) => sql.includes("FROM claim_log") && claimIsOpen
      ? { id: String(params[0]) } : null;
    ${matchesJs}
    ${loopJs}
    return (async () => { await runLoop(); return results; })();
  `) as (sessions: Record<string, unknown>[], retainedMap: typeof map,
      claimIsOpen: boolean, writes: Record<string, unknown>[]) => Promise<Array<{ status: string }>>;
  const writes: Record<string, unknown>[] = [];
  assert.deepEqual((await runShutdownLoop([session], map, true, writes)).map((item) => item.status),
    ["retained_for_recovery"]);
  assert.deepEqual(writes, []);
  assert.deepEqual((await runShutdownLoop([session], map, false, writes)).map((item) => item.status),
    ["quarantined"]);
  assert.equal(writes.splice(0).length, 1);
  assert.deepEqual((await runShutdownLoop([{ ...session, state: "starting" }], map, true, writes)).map((item) => item.status),
    ["quarantined"]);
  assert.equal(writes.splice(0).length, 1);
  assert.deepEqual((await runShutdownLoop([session], new Map(), true, writes)).map((item) => item.status),
    ["quarantined"]);
  assert.equal(writes.splice(0).length, 1);
  assert.match(source, /task6aV2UnboundPostClaimRefusals > 0/);
  assert.match(source, /task6aV2RetainedPostClaimRuntimes\.size !== retained\.length/);
});

test("Task6A V2 ordinary post-claim awaits refuse without finalizer release writes", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const spawn = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "spawnAgentNow");
  assert.ok(spawn?.body);
  const outer = spawn.body.statements.find((node): node is ts.TryStatement => ts.isTryStatement(node)
    && Boolean(node.finallyBlock?.getText(tree).includes("releaseUntransferredPostClaimOwnership(claim")));
  assert.ok(outer?.finallyBlock);
  const body = outer.tryBlock.statements;
  const inlineIndex = body.findIndex((node) => ts.isVariableStatement(node)
    && node.getText(tree).includes("await completeInlineSecurityGateIfApplicable("));
  assert.ok(inlineIndex >= 0, "inline selector must be awaited before ordinary effects");
  assert.match(body[inlineIndex + 1]?.getText(tree) || "", /^if \(inlineSecurityCompleted\)/);
  const findIndex = body.findIndex((node) => ts.isTryStatement(node)
    && node.tryBlock.getText(tree).includes("await runtimeSessions.findById(runtimeSessionId)"));
  assert.ok(findIndex >= 0);
  assert.match(body[findIndex + 3]?.getText(tree) || "", /^if \(!runtimeLookupSettled\.ok\) throw runtimeLookupSettled\.error;/);
  assert.match(body[findIndex + 4]?.getText(tree) || "", /^const reservedRuntimeSession = runtimeLookupSettled\.session;/);
  assert.match(body[findIndex + 5]?.getText(tree) || "", /^let startingRuntimeSession:/);
  for (const { name, index, next } of [
    { name: "inline", index: inlineIndex + 1, next: /^const prompt = buildPreclaimedPrompt\(/ },
    { name: "runtime", index: findIndex, next: /^if \(!runtimeLookupSettled\.ok\) throw runtimeLookupSettled\.error;/ },
  ]) {
    const refusal = body[index + 1];
    const shutdown = body[index + 2];
    assert.ok(refusal && ts.isTryStatement(refusal), `${name} V2 sample`);
    assert.equal(refusal.tryBlock.statements[0]?.getText(tree), "await assertTask6aPreSchemaOrdinaryStartupV2();");
    assert.match(refusal.catchClause?.block.getText(tree) || "", /postClaimRefusedV2 = true/);
    assert.match(refusal.catchClause?.block.getText(tree) || "", /retainTask6aV2PostClaimRuntimeIfExact\(claim, runtimeIntent\)/);
    assert.doesNotMatch(refusal.getText(tree), /releaseUntransferredPostClaimOwnership|quarantine|unlinkSync/);
    assert.ok(shutdown && ts.isIfStatement(shutdown));
    assert.equal(shutdown.expression.getText(tree), "shuttingDown");
    assert.match(shutdown.thenStatement.getText(tree), /postClaimRefusedV2 = true/);
    assert.match(body[index + 3]?.getText(tree) || "", next);

    const run = new Function("preflight", "effect", "retained", `return (async () => {
      let shuttingDown = false;
      let postClaimRefusedV2 = false;
      let task6aV2UnboundPostClaimRefusals = 0;
      const claim = { found: true };
      const runtimeIntent = {};
      const key = "key";
      const claimingSpawns = { delete: () => {} };
      const console = { warn: () => {} };
      const retainTask6aV2PostClaimRuntimeIfExact = () => { retained.push("retain"); return true; };
      const assertTask6aPreSchemaOrdinaryStartupV2 = () => preflight(() => { shuttingDown = true; });
      ${refusal.getText(tree)}
      ${shutdown.getText(tree)}
      effect();
      return postClaimRefusedV2;
    })();`) as (preflight: (shutdown: () => void) => Promise<void>, effect: () => void,
      retained: string[]) => Promise<boolean | undefined>;
    const effects: string[] = [];
    const retained: string[] = [];
    assert.equal(await run(async () => { throw Error("refused"); }, () => effects.push("effect"), retained), undefined);
    assert.deepEqual(effects, [], name);
    assert.deepEqual(retained.splice(0), ["retain"], name);
    assert.equal(await run(async (shutdownNow) => { shutdownNow(); }, () => effects.push("effect"), retained), undefined);
    assert.deepEqual(effects, [], name);
    assert.deepEqual(retained.splice(0), ["retain"], name);
    assert.equal(await run(async () => {}, () => effects.push("effect"), retained), false);
    assert.deepEqual(effects, ["effect"], name);
    assert.deepEqual(retained, [], name);
  }
  assert.match(outer.finallyBlock.getText(tree), /if \(!postClaimOwnershipTransferred && !postClaimRefusedV2\)/);
});

test("Task6A V2 rejected runtime lookup still samples refusal before release", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const spawn = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "spawnAgentNow");
  assert.ok(spawn?.body);
  const outer = spawn.body.statements.find((node): node is ts.TryStatement => ts.isTryStatement(node)
    && Boolean(node.finallyBlock?.getText(tree).includes("releaseUntransferredPostClaimOwnership(claim")));
  assert.ok(outer?.finallyBlock);
  const statements = outer.tryBlock.statements;
  const lookupIndex = statements.findIndex((node) => ts.isTryStatement(node)
    && node.tryBlock.getText(tree).includes("await runtimeSessions.findById(runtimeSessionId)"));
  assert.ok(lookupIndex >= 0, "lookup rejection must be captured before the V2 sample");
  const declaration = statements[lookupIndex - 1]?.getText(tree);
  const lookup = statements[lookupIndex]?.getText(tree);
  const refusal = statements[lookupIndex + 1]?.getText(tree);
  const shutdown = statements[lookupIndex + 2]?.getText(tree);
  const rethrow = statements[lookupIndex + 3]?.getText(tree);
  assert.match(declaration || "", /^let runtimeLookupSettled:/);
  assert.match(lookup || "", /runtimeLookupSettled = \{ ok: false, error \}/);
  assert.match(refusal || "", /await assertTask6aPreSchemaOrdinaryStartupV2\(\)/);
  assert.match(shutdown || "", /^if \(shuttingDown\)/);
  assert.match(rethrow || "", /^if \(!runtimeLookupSettled\.ok\) throw runtimeLookupSettled\.error;/);
  const continuationJs = ts.transpileModule(`async function continuation() {
    ${declaration}
    ${lookup}
    ${refusal}
    ${shutdown}
    ${rethrow}
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const run = new Function("lookup", "preflight", "retained", "releases", `return (async () => {
    let shuttingDown = false;
    let postClaimOwnershipTransferred = false;
    let postClaimRefusedV2 = false;
    let task6aV2UnboundPostClaimRefusals = 0;
    const claim = { found: true };
    const runtimeIntent = {};
    const runtimeSessionId = "RTS_exact";
    const runtimeSessions = { findById: lookup };
    const console = { warn: () => {} };
    const retainTask6aV2PostClaimRuntimeIfExact = () => { retained.push("retain"); return true; };
    const assertTask6aPreSchemaOrdinaryStartupV2 = preflight;
    ${continuationJs}
    try {
      await continuation();
    } finally {
      if (!postClaimOwnershipTransferred && !postClaimRefusedV2) releases.push("release");
    }
  })();`) as (lookup: () => Promise<unknown>, preflight: () => Promise<void>,
      retained: string[], releases: string[]) => Promise<void>;
  const retained: string[] = [];
  const releases: string[] = [];
  await run(async () => { throw Error("LOOKUP_FAILURE"); },
    async () => { throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); }, retained, releases);
  assert.deepEqual(retained.splice(0), ["retain"]);
  assert.deepEqual(releases, []);
  await assert.rejects(run(async () => { throw Error("LOOKUP_FAILURE"); },
    async () => {}, retained, releases), /LOOKUP_FAILURE/);
  assert.deepEqual(retained, []);
  assert.deepEqual(releases, ["release"]);
});

test("Task6A V2 poller rechecks before its first ordinary effect", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const poll = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "pollForPendingWork");
  assert.ok(poll?.body);
  assert.equal(poll.body.statements[0]?.getText(tree), "if (shuttingDown) return;");
  const guarded = poll.body.statements[1];
  assert.ok(guarded && ts.isTryStatement(guarded));
  const statements = guarded.tryBlock.statements;
  assert.equal(statements[0]?.getText(tree), "await assertTask6aPreSchemaOrdinaryStartupV2();");
  assert.equal(statements[1]?.getText(tree), "await processRunTerminationRequests();");
  const run = new Function("preflight", "effect", `return (async () => {
    const assertTask6aPreSchemaOrdinaryStartupV2 = preflight;
    const processRunTerminationRequests = effect;
    ${statements[0]!.getText(tree)}
    ${statements[1]!.getText(tree)}
  })();`) as (preflight: () => Promise<void>, effect: () => Promise<void>) => Promise<void>;
  const calls: string[] = [];
  await assert.rejects(run(async () => { calls.push("preflight"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    async () => { calls.push("termination"); }), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  assert.deepEqual(calls.splice(0), ["preflight"]);
  await run(async () => { calls.push("preflight"); }, async () => { calls.push("termination"); });
  assert.deepEqual(calls, ["preflight", "termination"]);
});

test("Task6A V2 claim maintenance propagates refusal before effects and rechecks after await", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const maintenance = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "runClaimMaintenance");
  assert.ok(maintenance?.body);
  const statements = maintenance.body.statements;
  assert.equal(statements[0]?.getText(tree), "if (shuttingDown || claimMaintenanceInFlight) return;");
  assert.equal(statements[1]?.getText(tree), "await assertTask6aPreSchemaOrdinaryStartupV2();");
  assert.equal(statements[2]?.getText(tree), "if (shuttingDown || claimMaintenanceInFlight) return;");
  assert.equal(statements[3]?.getText(tree), "claimMaintenanceInFlight = true;");
  const guarded = statements[4];
  assert.ok(guarded && ts.isTryStatement(guarded));
  assert.equal(guarded.tryBlock.statements[0]?.getText(tree), "await reapFinishedClaims();");
  const run = new Function("check", "effect", "state", `return (async () => {
    let shuttingDown = state.shuttingDown;
    let claimMaintenanceInFlight = state.inFlight;
    const assertTask6aPreSchemaOrdinaryStartupV2 = async () => check(() => { shuttingDown = true; }, () => { claimMaintenanceInFlight = true; });
    ${statements.slice(0, 4).map((node) => node.getText(tree)).join("\n")}
    effect();
  })();`) as (check: (shutdown: () => void, claim: () => void) => Promise<void>,
    effect: () => void, state: { shuttingDown: boolean; inFlight: boolean }) => Promise<void>;
  const calls: string[] = [];
  await assert.rejects(run(async () => { calls.push("preflight"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    () => calls.push("effect"), { shuttingDown: false, inFlight: false }), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  assert.deepEqual(calls.splice(0), ["preflight"]);
  await run(async (shutdown) => { calls.push("preflight"); shutdown(); },
    () => calls.push("effect"), { shuttingDown: false, inFlight: false });
  assert.deepEqual(calls.splice(0), ["preflight"]);
  await run(async (_shutdown, claim) => { calls.push("preflight"); claim(); },
    () => calls.push("effect"), { shuttingDown: false, inFlight: false });
  assert.deepEqual(calls.splice(0), ["preflight"]);
  await run(async () => { calls.push("preflight"); },
    () => calls.push("effect"), { shuttingDown: false, inFlight: false });
  assert.deepEqual(calls, ["preflight", "effect"]);
});

test("Task6A V2 detached maintenance timer handles a propagated refusal", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const main = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "main");
  assert.ok(main?.body);
  const timer = main.body.statements.find((node) => node.getText(tree).includes("void runClaimMaintenance()"));
  assert.ok(timer);
  assert.match(timer.getText(tree), /void runClaimMaintenance\(\)\.catch\(/);
  const run = new Function("maintenance", "warning", `return async () => {
    const intervalHandles = [];
    const POLL_INTERVAL_MS = 10_000;
    let callback;
    const setInterval = (fn) => { callback = fn; return 1; };
    const runClaimMaintenance = maintenance;
    const console = { warn: warning };
    ${timer.getText(tree)}
    callback();
    await new Promise((resolve) => setImmediate(resolve));
  };`) as (maintenance: () => Promise<void>, warning: (message: string) => void) => () => Promise<void>;
  const warnings: string[] = [];
  await run(async () => { throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    (message) => warnings.push(message))();
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
});

test("Task6A V2 listener dispatcher refuses before handlers and catches async errors", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const dispatcher = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "dispatchTask6aV2OrdinaryListener");
  assert.ok(dispatcher?.body);
  assert.match(dispatcher.body.getText(tree), /await assertTask6aPreSchemaOrdinaryStartupV2\(\);\s*if \(shuttingDown\) return;\s*await handler\(payload\)/);
  const js = ts.transpileModule(dispatcher.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const makeDispatcher = new Function("check", "record", `
    let shuttingDown = false;
    const assertTask6aPreSchemaOrdinaryStartupV2 = () => check(() => { shuttingDown = true; });
    const logOrdinaryListenerRejection = record;
    ${js}
    return dispatchTask6aV2OrdinaryListener;
  `) as (check: (shutdown: () => void) => Promise<void>, record: (channel: string, error: unknown) => void) =>
    (channel: string, message: string, handler: (payload: unknown) => Promise<void>) => void;
  const calls: string[] = [];
  const errors: string[] = [];
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  makeDispatcher(async () => { calls.push("preflight"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    (channel, error) => errors.push(`${channel}:${String(error)}`))("step_pending", "{}",
    async () => { calls.push("handler"); });
  await settle();
  assert.deepEqual(calls.splice(0), ["preflight"]);
  assert.match(errors.splice(0)[0]!, /^step_pending:Error: TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED$/);
  makeDispatcher(async () => { calls.push("preflight"); },
    (channel, error) => errors.push(`${channel}:${String(error)}`))("story_pending", '{"id":1}',
    async (payload) => { calls.push(`handler:${(payload as { id: number }).id}`); });
  await settle();
  assert.deepEqual(calls.splice(0), ["preflight", "handler:1"]);
  assert.deepEqual(errors, []);
  let beginShutdown!: () => void;
  let releasePreflight!: () => void;
  makeDispatcher(async (shutdown) => {
    calls.push("preflight");
    beginShutdown = shutdown;
    await new Promise<void>((resolve) => { releasePreflight = resolve; });
  }, (channel, error) => errors.push(`${channel}:${String(error)}`))("run_termination_requested", "{}",
    async () => { calls.push("handler"); });
  await settle();
  assert.deepEqual(calls, ["preflight"]);
  beginShutdown();
  releasePreflight();
  await settle();
  assert.deepEqual(calls.splice(0), ["preflight"]);
  assert.deepEqual(errors, []);
  makeDispatcher(async () => { calls.push("preflight"); },
    (channel, error) => errors.push(`${channel}:${String(error)}`))("run_termination_requested", "{",
    async () => { calls.push("handler"); });
  await settle();
  assert.deepEqual(calls, []);
  assert.match(errors.splice(0)[0]!, /^run_termination_requested:SyntaxError:/);
  makeDispatcher(async () => { calls.push("preflight"); },
    (channel, error) => errors.push(`${channel}:${String(error)}`))("runtime_completion_requested", "{}",
    async () => { calls.push("handler"); throw Error("PROCESSOR_REJECTED"); });
  await settle();
  assert.deepEqual(calls, ["preflight", "handler"]);
  assert.match(errors[0]!, /^runtime_completion_requested:Error: PROCESSOR_REJECTED$/);
});

test("Task6A V2 all four LISTEN callbacks use the guarded dispatcher", () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const step = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "listenForStepPending");
  const main = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "main");
  assert.ok(step?.body && main?.body);
  assert.match(step.body.getText(tree), /dispatchTask6aV2OrdinaryListener\("step_pending", message, handleStepPending\)/);
  for (const [channel, handler] of [
    ["story_pending", "handleStoryPending"],
    ["run_termination_requested", "processRunTerminationRequests"],
    ["runtime_completion_requested", "processRuntimeCompletionRequests"],
  ]) {
    const registration = main.body.statements.find((node) =>
      node.getText(tree).startsWith(`await listener.listen("${channel}",`));
    assert.ok(registration, channel);
    const body = registration.getText(tree);
    assert.ok(body.includes(`dispatchTask6aV2OrdinaryListener("${channel}", msg,`), channel);
    assert.ok(body.includes(handler), `${channel} must dispatch its original handler`);
  }
});

test("Task6A V2 OpenClaw timer refuses before cleanup and handles detached rejection", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const main = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "main");
  assert.ok(main?.body);
  const interval = main.body.statements.find((node) => node.getText(tree).includes("OPENCLAW_STALE_TASK_SWEEP_MS"));
  assert.ok(interval);
  let callback: ts.ArrowFunction | undefined;
  const findCallback = (node: ts.Node) => {
    if (!callback && ts.isArrowFunction(node)) callback = node;
    else ts.forEachChild(node, findCallback);
  };
  findCallback(interval);
  assert.ok(callback);
  const body = callback.getText(tree);
  const preflight = body.indexOf("await assertTask6aPreSchemaOrdinaryStartupV2()");
  const shutdown = body.indexOf("if (shuttingDown) return;");
  const cleanup = body.indexOf('cleanupStaleSetfarmOpenClawTaskRecords("interval")');
  const restart = body.indexOf('await restartGatewayAfterOpenClawCleanup("interval", result)');
  assert.ok(preflight >= 0 && shutdown > preflight && cleanup > shutdown && restart > cleanup);
  assert.match(body, /\.catch\(\(error\) =>/);
  const js = ts.transpileModule(`const callback = ${body};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const makeCallback = new Function("check", "cleanupEffect", "restartEffect", "warning", `
    let shuttingDown = false;
    const assertTask6aPreSchemaOrdinaryStartupV2 = () => check(() => { shuttingDown = true; });
    const cleanupStaleSetfarmOpenClawTaskRecords = cleanupEffect;
    const restartGatewayAfterOpenClawCleanup = restartEffect;
    const console = { warn: warning };
    ${js}
    return callback;
  `) as (check: (shutdown: () => void) => Promise<void>, cleanup: () => unknown,
    restart: () => Promise<void>, warning: (message: string) => void) => () => void;
  const effects: string[] = [];
  const warnings: string[] = [];
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  makeCallback(async () => { effects.push("preflight"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    () => { effects.push("cleanup"); return { sessions: 0, tasks: 0 }; },
    async () => { effects.push("restart"); }, (message) => warnings.push(message))();
  await settle();
  assert.deepEqual(effects.splice(0), ["preflight"]);
  assert.match(warnings.splice(0)[0]!, /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  makeCallback(async () => { effects.push("preflight"); },
    () => { effects.push("cleanup"); return { sessions: 0, tasks: 0 }; },
    async () => { effects.push("restart"); }, (message) => warnings.push(message))();
  await settle();
  assert.deepEqual(effects.splice(0), ["preflight", "cleanup", "restart"]);
  assert.deepEqual(warnings, []);
  makeCallback(async () => { effects.push("preflight"); },
    () => { effects.push("cleanup"); return { sessions: 1, tasks: 0 }; },
    async () => { effects.push("restart"); throw Error("RESTART_REJECTED"); },
    (message) => warnings.push(message))();
  await settle();
  assert.deepEqual(effects.splice(0), ["preflight", "cleanup", "restart"]);
  assert.match(warnings.splice(0)[0]!, /RESTART_REJECTED/);
  makeCallback(async (shutdown) => { effects.push("preflight"); shutdown(); },
    () => { effects.push("cleanup"); return { sessions: 0, tasks: 0 }; },
    async () => { effects.push("restart"); }, (message) => warnings.push(message))();
  await settle();
  assert.deepEqual(effects, ["preflight"]);
  assert.deepEqual(warnings, []);
});

test("Task6A V2 post-restart OpenClaw resweep rechecks after its awaited restart", async () => {
  const source = readFileSync(path.join(sourceRoot, "spawner.ts"), "utf8");
  const tree = ts.createSourceFile("spawner.ts", source, ts.ScriptTarget.Latest, true);
  const restart = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "restartGatewayAfterOpenClawCleanup");
  assert.ok(restart?.body);
  const resweep = restart.body.statements.find((node): node is ts.IfStatement =>
    ts.isIfStatement(node) && node.expression.getText(tree) === "restarted");
  assert.ok(resweep && ts.isBlock(resweep.thenStatement));
  assert.equal(resweep.thenStatement.statements[0]?.getText(tree), "await assertTask6aPreSchemaOrdinaryStartupV2();");
  assert.equal(resweep.thenStatement.statements[1]?.getText(tree), "if (shuttingDown) return restarted;");
  assert.equal(resweep.thenStatement.statements[2]?.getText(tree),
    "cleanupStaleSetfarmOpenClawTaskRecords(`${context}-post-gateway-restart`);");
  const run = new Function("check", "cleanup", `return (async () => {
    let shuttingDown = false;
    const restarted = true;
    const context = "interval";
    const assertTask6aPreSchemaOrdinaryStartupV2 = () => check(() => { shuttingDown = true; });
    const cleanupStaleSetfarmOpenClawTaskRecords = cleanup;
    ${resweep.getText(tree)}
    return restarted;
  })();`) as (check: (shutdown: () => void) => Promise<void>, cleanup: (context: string) => void) => Promise<boolean>;
  const effects: string[] = [];
  await assert.rejects(run(async () => { effects.push("preflight"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    () => effects.push("resweep")), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  assert.deepEqual(effects.splice(0), ["preflight"]);
  assert.equal(await run(async (shutdown) => { effects.push("preflight"); shutdown(); },
    () => effects.push("resweep")), true);
  assert.deepEqual(effects.splice(0), ["preflight"]);
  assert.equal(await run(async () => { effects.push("preflight"); },
    (context) => effects.push(`resweep:${context}`)), true);
  assert.deepEqual(effects, ["preflight", "resweep:interval-post-gateway-restart"]);
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

test("Task6A V2 direct CLI peek refuses before recovery effects or output", async () => {
  const source = readFileSync(path.join(sourceRoot, "cli/cli.ts"), "utf8");
  const tree = ts.createSourceFile("cli.ts", source, ts.ScriptTarget.Latest, true);
  const main = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "main");
  assert.ok(main?.body);
  const step = main.body.statements.find((node): node is ts.IfStatement =>
    ts.isIfStatement(node) && node.expression.getText(tree) === 'group === "step"');
  assert.ok(step && ts.isBlock(step.thenStatement));
  const peek = step.thenStatement.statements.find((node): node is ts.IfStatement =>
    ts.isIfStatement(node) && node.expression.getText(tree) === 'action === "peek"');
  assert.ok(peek && ts.isBlock(peek.thenStatement));
  const statements = peek.thenStatement.statements;
  assert.equal(statements[3]?.getText(tree), "await assertTask6aPreSchemaOrdinaryStartupV2();");
  assert.equal(statements[4]?.getText(tree), "const result = await peekStep(target, callerAgent);");
  assert.equal(statements[5]?.getText(tree), 'process.stdout.write(result + "\\n");');
  const run = new Function("check", "peekEffect", `return (async () => {
    const assertTask6aPreSchemaOrdinaryStartupV2 = check;
    const peekStep = peekEffect;
    const target = "agent";
    const callerAgent = undefined;
    ${statements[3]!.getText(tree)}
    ${statements[4]!.getText(tree)}
    return result;
  })();`) as (check: () => Promise<void>, peekEffect: () => Promise<string>) => Promise<string>;
  const calls: string[] = [];
  await assert.rejects(run(async () => { calls.push("preflight"); throw Error("TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED"); },
    async () => { calls.push("peek"); return "NO_WORK"; }), /TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED/);
  assert.deepEqual(calls.splice(0), ["preflight"]);
  assert.equal(await run(async () => { calls.push("preflight"); },
    async () => { calls.push("peek"); return "NO_WORK"; }), "NO_WORK");
  assert.deepEqual(calls, ["preflight", "peek"]);
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
