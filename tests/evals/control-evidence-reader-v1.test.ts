import assert from "node:assert/strict";
import { test } from "node:test";

test("absent selection is explicitly unconfigured without creating a root", async () => {
  const { readSelectedControlEvidenceV1 } = await import("../../src/evals/control-evidence-reader-v1.js");
  const result = await readSelectedControlEvidenceV1({ selectionHash: "a".repeat(64), sourceSha: "b".repeat(40), releaseSha: "b".repeat(40), suiteHash: null, refs: {} });
  assert.deepEqual(result.activation, { availability: { state: "unconfigured", code: "CONTROL_SELECTION_UNCONFIGURED" }, report: null });
  assert.deepEqual(result.evaluation, result.activation);
});

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { registerHooks } from "node:module";
import childProcess from "node:child_process";
import { ProductConvergenceSuiteV2Schema } from "../../src/evals/suite-schema-v2.js";
import { createConvergenceResultV2, createConvergenceRunResultV2 } from "../../src/evals/result-schema-v2.js";
import { taskIntentOracleHashV2 } from "../../src/evals/task-intent-oracle-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createConvergenceResult, createConvergenceRunResult } from "../../src/evals/result-schema.js";
import { evaluateConvergenceReleaseGate } from "../../src/evals/release-gate.js";
import { fixture, snapshot } from "./control-evidence-fixture-v1.js";
const HASH = "a".repeat(64);

test("component temp-tree reads genuine activation and planned catalog without filesystem writes", async t => {
  const f = await fixture(t); f.putActivation(); f.storeResult(); const before = snapshot(f.root);
  const r = await f.reader.readSelectedControlEvidenceV1(f.input);
  assert.equal(r.activation.availability.state, "available"); assert.equal(r.activation.report?.observedAt, null); assert.equal(r.activation.report?.checks.length, 6);
  assert.equal(r.evaluation.availability.state, "available"); assert.equal(r.evaluation.report?.preflightChecks.length, 8);
  assert.equal(r.evaluation.report?.executionMode, "preflight"); assert.equal(r.evaluation.report?.qualification, "unqualified");
  assert.deepEqual(r.evaluation.report?.cases.map(c => c.caseId), f.suite.cases.map(c => c.caseId));
  assert.ok(r.evaluation.report?.cases.every(c => c.evidenceState === "not_started" && c.disposition === null && c.passed === null && c.runId === null && c.resultHash === null));
  assert.deepEqual(snapshot(f.root), before); assert.doesNotMatch(JSON.stringify(r), /oracle|environment|selector|task|\/private|\/var\//);
});
for (const fault of ["copied_hash", "duplicate_activation", "wrong_release", "wrong_suite", "wrong_source", "wrong_selection", "cross_gate", "gate_without_result"] as const) test(`component rejects ${fault} as invalid`, async t => {
  const f = await fixture(t); f.putActivation(); const stored = f.storeResult();
  if (fault === "copied_hash") fs.appendFileSync(path.join(f.artifacts, `${f.input.refs.activationHash}.json`), " ");
  if (fault === "duplicate_activation") f.putActivation({ ...f.activation, checks: f.activation.checks.map(() => f.activation.checks[0]!) });
  if (fault === "wrong_release") f.input.releaseSha = "e".repeat(40);
  if (fault === "wrong_suite") f.input.suiteHash = "e".repeat(64);
  if (fault === "wrong_source") f.input.sourceSha = "e".repeat(40);
  if (fault === "wrong_selection") f.input.selectionHash = "e".repeat(64);
  if (fault === "cross_gate") { const gate = evaluateConvergenceReleaseGate(f.result([], "execute")); f.putEval(gate); f.input.refs.gateHash = gate.gateHash; }
  if (fault === "gate_without_result") delete f.input.refs.resultHash;
  const r = await f.reader.readSelectedControlEvidenceV1(f.input);
  assert.equal((fault === "copied_hash" || fault === "duplicate_activation" ? r.activation : r.evaluation).availability.state, "invalid", JSON.stringify(r));
});
for (const fault of ["symlink_leaf", "symlink_parent", "hardlink", "directory_leaf", "oversized", "writable_leaf"] as const) test(`component rejects hostile ${fault} as unsafe`, async t => {
  const f = await fixture(t); const { result } = f.storeResult(); const leaf = path.join(f.evals, "sha256", result.resultHash.slice(0, 2), `${result.resultHash}.json`);
  if (fault === "symlink_leaf") { fs.renameSync(leaf, `${leaf}.target`); fs.symlinkSync(`${leaf}.target`, leaf); }
  if (fault === "symlink_parent") { const parent = path.dirname(leaf); fs.renameSync(parent, `${parent}-target`); fs.symlinkSync(`${parent}-target`, parent); }
  if (fault === "hardlink") fs.linkSync(leaf, `${leaf}.other`);
  if (fault === "directory_leaf") { fs.unlinkSync(leaf); fs.mkdirSync(leaf); }
  if (fault === "oversized") fs.truncateSync(leaf, 16 * 1024 * 1024 + 1);
  if (fault === "writable_leaf") fs.chmodSync(leaf, 0o666);
  const r = await f.reader.readSelectedControlEvidenceV1(f.input); assert.equal(r.evaluation.availability.state, "unsafe", JSON.stringify(r));
});
test("component distinguishes missing exact leaf and root from absent refs without mkdir", async t => {
  const f = await fixture(t); assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "unconfigured");
  f.input.refs.resultHash = HASH; assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "missing");
  fs.rmSync(f.evals, { recursive: true }); assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "missing"); assert.equal(fs.existsSync(f.evals), false);
});

test("component full pass GO is available but never filesystem-qualified", async t => {
  const f = await fixture(t); f.storeResult(f.result(f.runs(), "execute"));
  const r = await f.reader.readSelectedControlEvidenceV1(f.input);
  assert.equal(r.evaluation.availability.state, "available"); assert.equal(r.evaluation.availability.code, "CONTROL_RELEASE_ADMISSION_UNOBSERVED");
  assert.equal(r.evaluation.report?.qualification, "unqualified"); assert.equal(r.evaluation.report?.gateDecision, "go"); assert.equal(r.evaluation.report?.completedCases, 8);
});
test("component partial execution records only actual stored case rows", async t => {
  const f = await fixture(t); const runs = f.runs().slice(0, 2); f.storeResult(f.result(runs, "execute"));
  const r = await f.reader.readSelectedControlEvidenceV1(f.input);
  assert.equal(r.evaluation.report?.resultStatus, "blocked"); assert.equal(r.evaluation.report?.completedCases, 2); assert.equal(r.evaluation.report?.gateDecision, "no_go");
  assert.deepEqual(r.evaluation.report?.cases.map(c => c.evidenceState), ["recorded", "recorded", "not_started", "not_started", "not_started", "not_started", "not_started", "not_started"]);
});
test("component cancellation preserves actual full-eight evidence with blocked no-GO", async t => {
  const f = await fixture(t); f.storeResult(f.result(f.runs(), "execute", ["EVAL_CANCEL_REQUESTED"]));
  const r = await f.reader.readSelectedControlEvidenceV1(f.input);
  assert.equal(r.evaluation.report?.resultStatus, "blocked"); assert.equal(r.evaluation.report?.completedCases, 8); assert.equal(r.evaluation.report?.gateDecision, "no_go");
  assert.deepEqual(r.evaluation.report?.blockerCodes, ["EVAL_CANCEL_REQUESTED"]);
});

for (const fault of ["leaf_disappears", "ancestor_swap", "leaf_grows", "selected_drift"] as const) test(`component rechecks pins after await: ${fault}`, async t => {
  const f = await fixture(t); const { result } = f.storeResult(); const leaf = path.join(f.evals, "sha256", result.resultHash.slice(0, 2), `${result.resultHash}.json`);
  const original = fsp.open;
  fsp.open = (async (...args: Parameters<typeof fsp.open>) => {
    const handle = await original(...args);
    if (args[0] === leaf) {
      if (fault === "leaf_disappears") fs.unlinkSync(leaf);
      if (fault === "ancestor_swap") { const parent = path.dirname(leaf); fs.renameSync(parent, `${parent}-old`); fs.mkdirSync(parent, { mode: 0o700 }); fs.copyFileSync(path.join(`${parent}-old`, path.basename(leaf)), leaf); }
      if (fault === "leaf_grows") fs.appendFileSync(leaf, " ");
      if (fault === "selected_drift") f.state.drift = true;
    }
    return handle;
  }) as typeof fsp.open;
  try {
    if (fault === "selected_drift") await assert.rejects(f.reader.readSelectedControlEvidenceV1(f.input), /FIXTURE_SELECTION_DRIFT/);
    else assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "unsafe");
  } finally { fsp.open = original; }
});

test("component unrelated sibling creation during read preserves evidence availability", async t => {
  const f = await fixture(t); f.storeResult();
  const original = fsp.open; let wrote = false;
  const sibling = path.join(path.dirname(f.root), `${path.basename(f.root)}-unrelated`);
  t.after(() => fs.rmSync(sibling, { force: true }));
  fsp.open = (async (...args: Parameters<typeof fsp.open>) => {
    const handle = await original(...args);
    if (!wrote) { wrote = true; fs.writeFileSync(sibling, "unrelated log activity"); }
    return handle;
  }) as typeof fsp.open;
  try { assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "available"); }
  finally { fsp.open = original; }
});

for (const fault of ["case_hash", "repetition", "case_duplicate", "task_hash", "wrong_suite_id", "copied_result_hash", "missing_gate"] as const) test(`component validates stored run identities and exact eval hashes: ${fault}`, async t => {
  const f = await fixture(t); const runs = f.runs();
  if (["case_hash", "repetition", "task_hash", "wrong_suite_id"].includes(fault)) {
    const { resultHash: _, ...run } = runs[0]!;
    runs[0] = createConvergenceRunResult({ ...run, ...(fault === "case_hash" ? { caseHash: "f".repeat(64) } : {}), ...(fault === "repetition" ? { repetition: 2 } : {}),
      ...(fault === "task_hash" ? { taskHash: "f".repeat(64) } : {}), ...(fault === "wrong_suite_id" ? { suiteId: "other-suite" } : {}) });
  }
  if (fault === "case_duplicate") { const { resultHash: _, ...run } = runs[0]!; runs[1] = createConvergenceRunResult({ ...run, runId: "another-run" }); }
  const stored = f.storeResult(f.result(runs, "execute"));
  const leaf = path.join(f.evals, "sha256", stored.result.resultHash.slice(0, 2), `${stored.result.resultHash}.json`);
  if (fault === "copied_result_hash") fs.writeFileSync(leaf, JSON.stringify({ ...stored.result, environmentHash: "e".repeat(64) }, null, 2) + "\n");
  if (fault === "missing_gate") fs.unlinkSync(path.join(f.evals, "sha256", stored.gate.gateHash.slice(0, 2), `${stored.gate.gateHash}.json`));
  assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, fault === "missing_gate" ? "missing" : "invalid");
});

test("component compatible historical release stays historical", async t => {
  const f = await fixture(t); f.input.releaseSha = "e".repeat(40);
  const { resultHash: _, ...payload } = f.result(); f.storeResult(createConvergenceResult({ ...payload, releaseSha: f.input.releaseSha }));
  const result = await f.reader.readSelectedControlEvidenceV1(f.input);
  assert.equal(result.evaluation.availability.state, "available"); assert.equal(result.evaluation.report?.compatibility, "historical"); assert.equal(result.evaluation.report?.qualification, "historical");
});

test("component reader imports refuse operational constructors and perform zero mkdir or spawn calls", async t => {
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (/\/(?:convergence-runner|report|activation-preflight|indexed-artifact-publisher|artifact-store|db-pg|v3-release-admission-repository)\.[jt]s(?:$|\?)/.test(specifier)) throw new Error(`OPERATIONAL_IMPORT_FORBIDDEN:${specifier}`);
    return next(specifier, context);
  }});
  try {
    const f = await fixture(t); f.putActivation(); f.storeResult();
    const original = fsp.mkdir; let writes = 0;
    const originalSpawn = childProcess.spawn, originalSpawnSync = childProcess.spawnSync;
    childProcess.spawn = (() => { writes++; throw new Error("READER_SPAWN_FORBIDDEN"); }) as typeof childProcess.spawn;
    childProcess.spawnSync = (() => { writes++; throw new Error("READER_SPAWN_FORBIDDEN"); }) as typeof childProcess.spawnSync;
    fsp.mkdir = (async () => { writes++; throw new Error("READER_MKDIR_FORBIDDEN"); }) as typeof fsp.mkdir;
    try { assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "available"); assert.equal(writes, 0); }
    finally { fsp.mkdir = original; childProcess.spawn = originalSpawn; childProcess.spawnSync = originalSpawnSync; }
  } finally { hooks.deregister(); }
});

test("component unrelated sibling directory creation preserves evidence while ancestor mode changes refuse", async t => {
  const f = await fixture(t); f.storeResult(); const original = fsp.open; let mode = false;
  const sibling = path.join(f.root, "sibling-directory");
  fsp.open = (async (...args: Parameters<typeof fsp.open>) => { const handle = await original(...args);
    if (mode) fs.chmodSync(f.repository, 0o755);
    else fs.mkdirSync(sibling, { recursive: true, mode: 0o700 });
    return handle;
  }) as typeof fsp.open;
  try {
    assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "available"); mode = true;
    assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "unsafe");
  } finally { fsp.open = original; }
});

for (const fault of ["fail_without_blocking", "pass_with_blocking"] as const) test(`component activation rejects inconsistent blocking reduction: ${fault}`, async t => {
  const f = await fixture(t); f.putActivation({ ...f.activation, checks: f.activation.checks.map((check, index) => index === 0
    ? { ...check, status: fault === "fail_without_blocking" ? "fail" : "pass", blocking: fault === "pass_with_blocking" } : check) });
  assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).activation.availability.state, "invalid");
});
test("component artifact changed after its read returns unsafe availability", async t => {
  const f = await fixture(t); f.putActivation(); f.storeResult(); const original = fsp.open;
  fsp.open = (async (...args: Parameters<typeof fsp.open>) => { const handle = await original(...args);
    if (String(args[0]).includes("product-convergence-codex")) fs.appendFileSync(path.join(f.artifacts, `${f.input.refs.activationHash}.json`), " ");
    return handle;
  }) as typeof fsp.open;
  try { assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).activation.availability.state, "unsafe"); }
  finally { fsp.open = original; }
});

for (const mode of ["preflight", "execute"] as const) test(`component reads genuine version-two ${mode} suite and result schemas`, async t => {
  const f = await fixture(t);
  const suite = ProductConvergenceSuiteV2Schema.parse({ ...f.suite, schema: "setfarm.product-convergence-suite.v2", suiteVersion: 2,
    cases: f.suite.cases.map(item => ({ ...item, oracle: { ...item.oracle, schema: "setfarm.task-intent-oracle.v2", oracleVersion: 2,
      expectedDecision: item.oracle.expectedDecision.kind === "typed_rejection" ? {
        kind: "typed_rejection", requiredReasonCodes: item.oracle.expectedDecision.reasonCodes, allowedReasonCodes: item.oracle.expectedDecision.reasonCodes,
        reasonRequirements: item.oracle.expectedDecision.reasonCodes.map(reasonCode => ({ reasonCode, clauseRefs: item.oracle.clauses.map(clause => clause.clauseId) }))
      } : item.oracle.expectedDecision } })) });
  f.input.suiteHash = hashCanonicalJson(suite);
  fs.writeFileSync(path.join(f.repository, "evals/suites/product-convergence-codex-v1.json"), JSON.stringify(suite));
  const runs = mode === "preflight" ? [] : f.runs().map((run, index) => {
    const { resultHash: _, ...payload } = run, item = suite.cases[index]!;
    const { evaluationHash: _evaluationHash, ...oraclePayload } = run.canonical.oracle;
    const decision = item.oracle.expectedDecision;
    const rejectionContract = decision.kind === "typed_rejection" ? { requiredReasonCodes: decision.requiredReasonCodes, allowedReasonCodes: decision.allowedReasonCodes,
      actualReasonCodes: decision.requiredReasonCodes, declaredReasonRequirements: decision.allowedReasonCodes.map(reasonCode => ({ reasonCode, requirementRefs: ["REQ_FIXTURE"] })),
      actualReasonRequirements: decision.requiredReasonCodes.map(reasonCode => ({ reasonCode, requirementRefs: ["REQ_FIXTURE"] })) } : null;
    const oracle = { ...oraclePayload, schema: "setfarm.task-intent-oracle-evaluation.v2", oracleHash: taskIntentOracleHashV2(item.task, item.oracle), rejectionContract };
    return createConvergenceRunResultV2({ ...payload, schema: "setfarm.product-convergence-run-result.v2", suiteVersion: 2, suiteHash: f.input.suiteHash,
      caseHash: hashCanonicalJson(item), oracleHash: oracle.oracleHash, canonical: { ...run.canonical, oracle: { ...oracle, evaluationHash: hashCanonicalJson(oracle) } } });
  });
  const { resultHash: _, ...payload } = f.result();
  f.storeResult(createConvergenceResultV2({ ...payload, schema: "setfarm.product-convergence-result.v2", suiteVersion: 2, suiteHash: f.input.suiteHash,
    executionMode: mode, status: mode === "preflight" ? "planned" : "pass", runs }));
  const result = await f.reader.readSelectedControlEvidenceV1(f.input);
  assert.equal(result.evaluation.availability.state, "available"); assert.equal(result.evaluation.report?.executionMode, mode);
  assert.equal(result.evaluation.report?.completedCases, mode === "preflight" ? 0 : 8); assert.equal(result.evaluation.report?.qualification, "unqualified");
});

test("component leaf disappearing between lstat and open is unsafe rather than originally missing", async t => {
  const f = await fixture(t); const { result } = f.storeResult(); const leaf = path.join(f.evals, "sha256", result.resultHash.slice(0, 2), `${result.resultHash}.json`), original = fsp.open;
  fsp.open = (async (...args: Parameters<typeof fsp.open>) => { if (args[0] === leaf) fs.unlinkSync(leaf); return original(...args); }) as typeof fsp.open;
  try { assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "unsafe"); }
  finally { fsp.open = original; }
});
test("component full-eight case rows cannot reuse a single operational run identity", async t => {
  const f = await fixture(t), runs = f.runs(); const { resultHash: _, ...run } = runs[1]!;
  runs[1] = createConvergenceRunResult({ ...run, runId: runs[0]!.runId }); f.storeResult(f.result(runs, "execute"));
  assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "invalid");
});
test("component a leaf owned by another uid is unsafe", async t => {
  const f = await fixture(t); const { result } = f.storeResult(); const leaf = path.join(f.evals, "sha256", result.resultHash.slice(0, 2), `${result.resultHash}.json`), original = fsp.lstat;
  fsp.lstat = (async (...args: Parameters<typeof fsp.lstat>) => { const stat = await original(...args); return args[0] === leaf ? Object.assign(Object.create(stat), { uid: Number(stat.uid) + 1 }) : stat; }) as typeof fsp.lstat;
  try { assert.equal((await f.reader.readSelectedControlEvidenceV1(f.input)).evaluation.availability.state, "unsafe"); }
  finally { fsp.lstat = original; }
});
