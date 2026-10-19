import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { test } from "node:test";
import { z } from "zod";

// These tests stay on the raw runner: parsing must not open a database,
// inspect private operational material, or create a selected runtime root.
const schemas = () => import("../../src/execution/schemas/manual-control-job-v1.js");
const HASH = "a".repeat(64);
const SOURCE = "b".repeat(40);
const JOB_ID = "50b3b637-0cfa-4d87-8472-9b95c38bcda7";
const receipt = () => ({
  schema: "mission-control.control-job.v1",
  jobId: JOB_ID,
  kind: "convergence_full8",
  revision: 1,
  selectionHash: HASH,
  sourceSha: SOURCE,
  mcSourceSha: "c".repeat(40),
  mcBuildHash: "d".repeat(64),
  suiteHash: "e".repeat(64),
  state: "accepted",
  requestedAt: "2026-10-19T00:00:00.000Z",
  startedAt: null,
  updatedAt: "2026-10-19T00:00:00.000Z",
  finishedAt: null,
  phase: "accepted",
  code: null,
  currentCaseId: null,
  ownedRunId: null,
  completedCases: 0,
  plannedCases: 8,
  reportRefs: {},
  cancelRequested: false,
});

test("public receipt preserves unknown facts and never treats completion as qualification", async () => {
  const { ControlJobReceiptV1Schema } = await schemas();
  const input = { ...receipt(), state: "completed", finishedAt: "2026-10-19T01:00:00.000Z" };
  const parsed = ControlJobReceiptV1Schema.parse(input);
  assert.deepEqual(parsed.reportRefs, {});
  assert.equal(parsed.currentCaseId, null);
  assert.equal(parsed.ownedRunId, null);
  assert.equal(parsed.code, null);
  assert.equal(parsed.state, "completed");
});

test("public receipt refuses private authority and unsupported job or state values", async () => {
  const { ControlJobReceiptV1Schema } = await schemas();
  for (const extra of ["nonce", "slotToken", "runtimeUrl", "releaseDir", "rawOutput", "command", "argv"]) {
    assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), [extra]: "private" }).success, false, extra);
  }
  for (const kind of ["shell", "convergence_preflight", "repair", ""]) {
    assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), kind }).success, false, kind);
  }
  for (const state of ["go", "passed", "stopped", ""]) {
    assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), state }).success, false, state);
  }
  assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), reportRefs: { slotToken: "private" } }).success, false);
});

test("public receipt refuses missing, fractional, negative or nonnumeric revision and counts", async () => {
  const { ControlJobReceiptV1Schema } = await schemas();
  for (const field of ["revision", "completedCases", "plannedCases"]) {
    for (const value of [undefined, -1, 0.5, NaN, Infinity, "0", null]) {
      assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), [field]: value }).success, false, `${field}:${String(value)}`);
    }
  }
  assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), completedCases: 9 }).success, false);
});

test("receipt binds the only supported job kinds to their suite identity", async () => {
  const { ControlJobReceiptV1Schema } = await schemas();
  assert.equal(ControlJobReceiptV1Schema.safeParse(receipt()).success, true);
  assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), suiteHash: null }).success, false);
  for (const kind of ["activation_preflight", "ui_regression"]) {
    const input = { ...receipt(), kind, suiteHash: null, plannedCases: 0 };
    assert.equal(ControlJobReceiptV1Schema.safeParse(input).success, true, kind);
    assert.equal(ControlJobReceiptV1Schema.safeParse({ ...input, suiteHash: HASH }).success, false, kind);
  }
});

test("receipt refuses invalid opaque identities and malformed time or report hash", async () => {
  const { ControlJobReceiptV1Schema } = await schemas();
  for (const [field, value] of [
    ["jobId", "../private"], ["selectionHash", "short"], ["sourceSha", HASH],
    ["mcSourceSha", ""], ["mcBuildHash", SOURCE], ["suiteHash", "private/path"],
    ["requestedAt", "yesterday"], ["startedAt", ""], ["updatedAt", null],
  ] as const) {
    assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), [field]: value }).success, false, field);
  }
  assert.equal(ControlJobReceiptV1Schema.safeParse({ ...receipt(), reportRefs: { gateHash: "path/to/gate.json" } }).success, false);
});

test("private intent binds the fixed recipe and keeps custody separate from public receipt", async () => {
  const { ControlPrivateIntentV1Schema, ControlWorkerCustodyV1Schema, ControlJobReceiptV1Schema } = await schemas();
  const intent = {
    schema: "mission-control.control-intent.v1",
    receipt: receipt(),
    installationDir: "/owned/installation",
    releaseDir: "/owned/release",
    nonceDigest: HASH,
    fixedSuiteRelativePath: "evals/suites/product-convergence-codex-v1.json",
  };
  assert.equal(ControlPrivateIntentV1Schema.safeParse(intent).success, true);
  for (const fixedSuiteRelativePath of [null, "../suite.json", "evals/suites/custom.json"]) {
    assert.equal(ControlPrivateIntentV1Schema.safeParse({ ...intent, fixedSuiteRelativePath }).success, false);
  }
  assert.equal(ControlPrivateIntentV1Schema.safeParse({ ...intent, nonce: "private" }).success, false);
  const custody = {
    schema: "mission-control.control-custody.v1", jobId: JOB_ID,
    selectionHash: HASH, sourceSha: SOURCE, mcBuildHash: "d".repeat(64), nonce: "f".repeat(64),
  };
  assert.equal(ControlWorkerCustodyV1Schema.safeParse(custody).success, true);
  assert.equal(ControlWorkerCustodyV1Schema.safeParse({ ...custody, command: "node" }).success, false);
  assert.equal(ControlWorkerCustodyV1Schema.safeParse({ ...custody, nonce: "" }).success, false);
  assert.equal(ControlJobReceiptV1Schema.safeParse(custody).success, false);
});

test("shared selection hash uses exactly the strict captured identity record", async () => {
  const { ControlSelectionIdentityV1Schema, hashControlSelectionIdentityV1 } = await schemas();
  const identity = {
    schema: "setfarm.manual-control-selection.v1" as const,
    installationId: JOB_ID, sourceSha: SOURCE,
    installationDir: "/owned/installation", releaseDir: "/owned/release", catalogHash: HASH,
    activationPreparedHash: "e".repeat(64), activationAcknowledgedHash: "f".repeat(64),
  };
  const canonical = `{"activationAcknowledgedHash":"${"f".repeat(64)}","activationPreparedHash":"${"e".repeat(64)}","catalogHash":"${HASH}","installationDir":"/owned/installation","installationId":"${JOB_ID}","releaseDir":"/owned/release","schema":"setfarm.manual-control-selection.v1","sourceSha":"${SOURCE}"}`;
  assert.equal(hashControlSelectionIdentityV1(identity), createHash("sha256").update(canonical).digest("hex"));
  assert.equal(ControlSelectionIdentityV1Schema.safeParse({ ...identity, mcBuildHash: HASH }).success, false);
  for (const [key, value] of [
    ["installationId", "not-a-uuid"], ["sourceSha", HASH], ["catalogHash", SOURCE],
    ["installationDir", "relative"], ["releaseDir", "/owned/../release"],
    ["activationPreparedHash", null], ["activationAcknowledgedHash", undefined],
  ] as const) {
    assert.equal(ControlSelectionIdentityV1Schema.safeParse({ ...identity, [key]: value }).success, false, key);
  }
});

function privateFileComponent() {
  const locator = new URL("../../src/execution/manual-test-admission-v1.ts", import.meta.url);
  const source = fs.readFileSync(locator, "utf8");
  const tree = ts.createSourceFile("manual.ts", source, ts.ScriptTarget.Latest, true);
  const names = ["refuseV1", "sameStatV1", "pinParentsV1", "assertParentsV1", "readPrivateFileV1", "syncDirectoryV1", "publishExclusiveV1", "sameOwnerV1", "parseProcessTableV1", "hasOwnedChildrenV1"];
  const declarations = names.map(name => {
    const node = tree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
    assert.ok(node, `complete production ${name} required`);
    return node.getText(tree);
  }).join("\n");
  const compiled = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const factory = `${compiled};return {readPrivateFileV1,publishExclusiveV1,sameOwnerV1,parseProcessTableV1,hasOwnedChildrenV1};`;
  return { factory, ...new Function("fs", "path", factory)(fs, path) };
}

test("private intent reader refuses symlinks hardlinks unsafe modes ancestor swaps and oversized files", () => {
  const api = privateFileComponent();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-private-read-")));
  try {
    const parent = path.join(root, "jobs"); fs.mkdirSync(parent, { mode: 0o700 });
    const file = path.join(parent, "intent.json");
    fs.writeFileSync(file, "{}\n", { mode: 0o600 });
    const pin = api.readPrivateFileV1(file, 32, root);
    assert.equal(pin.bytes.toString(), "{}\n");
    fs.chmodSync(file, 0o644); assert.throws(() => api.readPrivateFileV1(file, 32, root)); fs.chmodSync(file, 0o600);
    fs.linkSync(file, path.join(parent, "alias.json")); assert.throws(() => api.readPrivateFileV1(file, 32, root)); fs.unlinkSync(path.join(parent, "alias.json"));
    fs.renameSync(file, `${file}.real`); fs.symlinkSync(`${file}.real`, file); assert.throws(() => api.readPrivateFileV1(file, 32, root)); fs.unlinkSync(file); fs.renameSync(`${file}.real`, file);
    fs.writeFileSync(file, "x".repeat(33)); assert.throws(() => api.readPrivateFileV1(file, 32, root));
    fs.renameSync(parent, `${parent}.old`); fs.symlinkSync(`${parent}.old`, parent); assert.throws(() => api.readPrivateFileV1(file, 64, root));
  } finally { fs.rmSync(root, { recursive: true }); }
});

test("exclusive publication never replaces an existing owner or removes a crashed child's durable record", () => {
  const api = privateFileComponent();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-private-crash-")));
  try {
    const file = path.join(root, "reservation.json");
    const bytes = Buffer.from('{"phase":"pending","revision":1}\n');
    const script = `const fs=require('node:fs'),path=require('node:path');const api=new Function('fs','path',${JSON.stringify(api.factory)})(fs,path);api.publishExclusiveV1(${JSON.stringify(file)},Buffer.from(${JSON.stringify(bytes.toString())}),${JSON.stringify(root)});process.exit(23);`;
    const child = spawnSync(process.execPath, ["-e", script], { env: { PATH: process.env.PATH }, encoding: "utf8", timeout: 10_000 });
    assert.equal(child.status, 23);
    assert.deepEqual(api.readPrivateFileV1(file, 1024, root).bytes, bytes);
    assert.throws(() => api.publishExclusiveV1(file, Buffer.from("replacement"), root));
    assert.deepEqual(fs.readFileSync(file), bytes);
  } finally { fs.rmSync(root, { recursive: true }); }
});

test("exact evaluator process identity refuses reused PID changed group or legacy provenance", () => {
  const { sameOwnerV1 } = privateFileComponent();
  const owner = { pid: 123, processStartedAt: "2026-10-19T00:00:00.000Z", processGroupId: 123, source: "observed_os", executable: "/fixed/node", script: "/fixed/release/dist/cli/control-test-worker-v1.js", commandHash: "a".repeat(64) };
  assert.equal(sameOwnerV1(owner, { ...owner }), true);
  for (const altered of [{ processStartedAt: "2026-10-19T00:00:01.000Z" }, { processGroupId: 124 }, { source: "tracked_child" }, { executable: "/other/node" }, { script: "/other/worker.js" }, { commandHash: "b".repeat(64) }]) {
    assert.equal(sameOwnerV1(owner, { ...owner, ...altered }), false);
  }
});

test("production custody ingress refuses unselected source entry before any operational effect", async () => {
  const api = await import("../../src/execution/manual-test-admission-v1.js");
  await assert.rejects(() => api.registerSelectedManualWorkerCustodyV1({
    schema: "mission-control.control-custody.v1", jobId: JOB_ID, selectionHash: HASH,
    sourceSha: SOURCE, mcBuildHash: HASH, nonce: "f".repeat(64),
  }));
  await assert.rejects(() => api.prepareSelectedDirectEvaluationIntentV1());
});


test("process census refuses malformed rows and retains descendants or orphan group children", () => {
  const { parseProcessTableV1, hasOwnedChildrenV1 } = privateFileComponent();
  const owner = { pid: 123, processGroupId: 123 };
  const one = "123 1 123 /fixed/node /fixed/worker.js\n";
  assert.equal(hasOwnedChildrenV1(parseProcessTableV1(one), owner), false);
  assert.equal(hasOwnedChildrenV1(parseProcessTableV1(one + "124 123 124 /fixed/child\n125 124 125 /fixed/grandchild\n"), owner), true);
  assert.equal(hasOwnedChildrenV1(parseProcessTableV1(one + "126 1 123 /fixed/orphan\n"), owner), true);
  for (const text of ["bad\n", one + one, "0 1 2 bad\n", "123 -1 123 bad\n"]) assert.throws(() => parseProcessTableV1(text));
});


function privateClosureComponent() {
  const source = fs.readFileSync(new URL("../../src/execution/manual-test-admission-v1.ts", import.meta.url), "utf8");
  const tree = ts.createSourceFile("manual.ts", source, ts.ScriptTarget.Latest, true);
  const names = ["Hash", "AcquireSchema", "OwnerSchema", "ClosureSchema", "refuseV1", "beginCustodyOperationV1"];
  const declarations = names.map(name => {
    const node = tree.statements.find(statement => (ts.isFunctionDeclaration(statement) && statement.name?.text === name)
      || (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(tree) === name)));
    assert.ok(node, `complete production ${name} required`); return node.getText(tree);
  }).join("\n");
  const compiled = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function("z", "path", `${compiled};return {ClosureSchema,beginCustodyOperationV1};`)(z, path);
}

test("private closure binds exact intent owner mode and released archive without accepting public outcome authority", () => {
  const { ClosureSchema } = privateClosureComponent();
  const marker = { schema: "setfarm.manual-control-custody-closed.v1", jobId: JOB_ID, kind: "convergence_full8",
    selectionHash: HASH, sourceSha: SOURCE, suiteHash: HASH, executionMode: "execute", intentOrigin: "mission_control",
    intentHash: HASH, nonceDigest: HASH, owner: { pid: 123, processStartedAt: "2026-10-19T00:00:00.000Z", processGroupId: 123,
      source: "observed_os", executable: "/fixed/node", script: "/fixed/worker.js", commandHash: HASH }, closure: { kind: "never_reserved" } };
  assert.equal(ClosureSchema.safeParse(marker).success, true);
  assert.equal(ClosureSchema.safeParse({ ...marker, closure: { kind: "reservation_released", revision: 2, recordHash: HASH } }).success, true);
  for (const changed of [{ nonce: "private" }, { outcome: "go" }, { kind: "ui_regression" }, { suiteHash: null },
    { closure: { kind: "never_reserved", revision: 2, recordHash: HASH } },
    { closure: { kind: "reservation_released", revision: 0, recordHash: HASH } },
    { closure: { kind: "reservation_released", revision: 2 } },
    { owner: { ...marker.owner, source: "tracked_child" } }, { owner: { ...marker.owner, commandHash: undefined } },
    { owner: { ...marker.owner, executable: "/fixed/../node" } }, { owner: { ...marker.owner, processStartedAt: "invalid" } },
    { kind: "activation_preflight", suiteHash: null, executionMode: "execute" }]) {
    assert.equal(ClosureSchema.safeParse({ ...marker, ...changed }).success, false);
  }
});

test("custody lifecycle serializes in-flight work and refuses reuse after uncertain release or closure", () => {
  const { beginCustodyOperationV1 } = privateClosureComponent();
  for (const lifecycle of ["acquiring", "binding", "releasing", "closing", "closed", "uncertain"]) {
    const custody = { lifecycle, publicationAttempted: false, held: null, released: null };
    for (const operation of ["acquiring", "binding", "releasing", "closing"]) assert.throws(() => beginCustodyOperationV1(custody, operation));
    assert.equal(custody.lifecycle, lifecycle);
  }
  const custody = { lifecycle: "ready", publicationAttempted: false, held: null, released: null };
  beginCustodyOperationV1(custody, "acquiring");
  assert.equal(custody.lifecycle, "acquiring");
  assert.throws(() => beginCustodyOperationV1(custody, "closing"));
  assert.throws(() => beginCustodyOperationV1({ lifecycle: "ready", publicationAttempted: true, held: null, released: null }, "acquiring"));
});

test("zero-argument closure refuses a source process without established private custody", async () => {
  const api = await import("../../src/execution/manual-test-admission-v1.js");
  assert.equal(typeof api.closeSelectedManualWorkerCustodyV1, "function");
  await assert.rejects(() => api.closeSelectedManualWorkerCustodyV1(), /MANUAL_EVALUATION/);
});
