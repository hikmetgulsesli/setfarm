import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type postgres from "postgres";
import { createConvergenceResult, createConvergenceRunResult } from "../../src/evals/result-schema.js";
import { createV3ReleaseAdmissionV1, convergenceArtifactRef } from "../../src/execution/v3-release-admission.js";
import { fixture, snapshot } from "./control-evidence-fixture-v1.js";

// Raw SQL doubles exercise component branching only. Positive actual DB authority
// is reserved for the separately registered protected-PG production-promotion test.
function sqlDouble(rows: unknown[], mode = "ok", after?: () => void) {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  const sql = { begin: async (options: string, callback: (sql: unknown) => Promise<unknown>) => {
    assert.equal(options, "isolation level repeatable read read only");
    const result = await callback({ unsafe: async (text: string, values: unknown[] = []) => {
      statements.push({ text: text.replace(/\s+/g, " ").trim(), values });
      if (mode === "query_error") throw new Error("private SQL connection detail");
      return /FROM public.v3_release_admissions/.test(text) ? rows : [];
    }});
    after?.();
    if (mode === "commit_error") throw new Error("private transaction completion detail");
    return result;
  }} as unknown as postgres.Sql;
  return { sql, statements };
}
async function prepared(t: Parameters<typeof fixture>[0]) {
  const f = await fixture(t), stored = f.storeResult(f.result(f.runs(), "execute"));
  const admission = createV3ReleaseAdmissionV1({ schema: "setfarm.v3-release-admission.v1", kind: "release_go",
    releaseSha: f.input.releaseSha, suiteHash: f.input.suiteHash, result: { hash: stored.result.resultHash, ref: convergenceArtifactRef(stored.result.resultHash) },
    gate: { hash: stored.gate.gateHash, ref: convergenceArtifactRef(stored.gate.gateHash) }, preflightHash: stored.result.preflight.preflightHash, issuedAt: stored.result.finishedAt, expiresAt: null, slots: [] });
  if (admission.kind !== "release_go") throw new Error("FIXTURE_RELEASE_GO_REQUIRED");
  const row = { admission_hash: admission.admissionHash, kind: admission.kind, release_sha: admission.releaseSha, suite_hash: admission.suiteHash,
    result_hash: admission.result.hash, result_ref: admission.result.ref, gate_hash: admission.gate.hash, gate_ref: admission.gate.ref, expires_at: null, payload: admission };
  const hooks = f.hooksFactory();
  let adapter: typeof import("../../src/evals/control-evidence-admission-reader-v1.js");
  try { adapter = await import(f.adapterUrl); } finally { hooks.deregister(); }
  return { ...f, stored, admission, row, read: (sql: postgres.Sql) => adapter.readSelectedControlEvidenceWithAdmissionV1(f.input, sql) };
}

test("component exact admission observation qualifies only after read-only transaction completion", async t => {
  const f = await prepared(t), db = sqlDouble([f.row]); const before = snapshot(f.root);
  const original = await f.reader.readSelectedControlEvidenceV1(f.input); const result = await f.read(db.sql);
  assert.equal(original.evaluation.report?.qualification, "unqualified"); assert.equal(result.evaluation.report?.qualification, "qualified"); assert.equal(result.evaluation.availability.code, null);
  assert.deepEqual(result.evaluation.report, { ...original.evaluation.report, qualification: "qualified" }); assert.deepEqual(snapshot(f.root), before);
  assert.equal(db.statements.length, 2);
  assert.match(db.statements[0]!.text, /pg_catalog.set_config/); assert.deepEqual(db.statements[0]!.values, ["1000", "5000"]);
  assert.equal(db.statements[1]!.text, "SELECT admission_hash, kind, release_sha, suite_hash, result_hash, result_ref, gate_hash, gate_ref, expires_at, payload FROM public.v3_release_admissions WHERE kind = 'release_go' AND release_sha = $1 LIMIT 2");
  assert.deepEqual(db.statements[1]!.values, [f.input.releaseSha]);
});
for (const fault of ["missing", "conflict", "malformed", "scalar", "wrong_tuple", "preflight", "issued", "query_error", "commit_error"] as const) test(`component admission ${fault} never upgrades or changes stored result truth`, async t => {
  const f = await prepared(t); let row = f.row;
  if (fault === "malformed") row = { ...row, payload: { ...f.admission, admissionHash: "f".repeat(64) } };
  if (fault === "scalar") row = { ...row, suite_hash: "f".repeat(64) };
  if (["wrong_tuple", "preflight", "issued"].includes(fault)) {
    const { admissionHash: _, ...payload } = f.admission;
    const admission = createV3ReleaseAdmissionV1({ ...payload,
      ...(fault === "wrong_tuple" ? { result: { hash: "f".repeat(64), ref: convergenceArtifactRef("f".repeat(64)) } } : {}),
      ...(fault === "preflight" ? { preflightHash: "f".repeat(64) } : {}), ...(fault === "issued" ? { issuedAt: "2026-10-18T00:00:00.000Z" } : {}) });
    if (admission.kind !== "release_go") throw new Error("FIXTURE_RELEASE_GO_REQUIRED");
    row = { ...row, admission_hash: admission.admissionHash, result_hash: admission.result.hash, result_ref: admission.result.ref, payload: admission };
  }
  const db = sqlDouble(fault === "missing" ? [] : fault === "conflict" ? [row, { ...row, result_hash: "f".repeat(64) }] : [row], fault);
  const result = await f.read(db.sql), before = await f.reader.readSelectedControlEvidenceV1(f.input);
  const suffix = fault === "missing" ? "MISSING" : fault === "conflict" ? "CONFLICT" : fault.endsWith("error") ? "UNKNOWN" : "INVALID";
  assert.deepEqual(result.evaluation.report, before.evaluation.report); assert.equal(result.evaluation.availability.state, "available"); assert.equal(result.evaluation.availability.code, `CONTROL_RELEASE_ADMISSION_${suffix}`);
  assert.equal(result.evaluation.report?.resultStatus, "pass"); assert.equal(result.evaluation.report?.gateDecision, "go"); assert.deepEqual(result.evaluation.report?.blockerCodes, []);
});
for (const kind of ["planned", "partial", "cancelled", "missing_gate", "unsafe", "historical"] as const) test(`component ${kind} does not query admission`, async t => {
  const f = await prepared(t);
  if (kind === "planned") f.storeResult();
  if (kind === "partial") f.storeResult(f.result(f.runs().slice(0, 2), "execute"));
  if (kind === "cancelled") f.storeResult(f.result(f.runs(), "execute", ["EVAL_CANCEL_REQUESTED"]));
  if (kind === "missing_gate") delete f.input.refs.gateHash;
  if (kind === "unsafe") fs.chmodSync(path.join(f.evals, convergenceArtifactRef(f.stored.result.resultHash)), 0o666);
  if (kind === "historical") {
    f.input.releaseSha = "e".repeat(40);
    const runs = f.runs().map(({ resultHash: _, ...payload }) => createConvergenceRunResult({ ...payload, releaseSha: f.input.releaseSha }));
    const { resultHash: _, ...payload } = f.result();
    f.storeResult(createConvergenceResult({ ...payload, executionMode: "execute", status: "pass", releaseSha: f.input.releaseSha, runs }));
  }
  let queried = false; const sql = { begin: () => { queried = true; throw new Error("must not query"); } } as unknown as postgres.Sql;
  const result = await f.read(sql); assert.equal(queried, false); assert.notEqual(result.evaluation.report?.qualification, "qualified");
  if (kind === "historical") { assert.equal(result.evaluation.availability.state, "available"); assert.equal(result.evaluation.report?.qualification, "historical"); }
});
for (const fault of ["selection", "artifact"] as const) test(`component ${fault} drift after await escapes DB error catch`, async t => {
  const f = await prepared(t), db = sqlDouble([f.row], "ok", () => {
    if (fault === "selection") f.state.drift = true;
    else fs.appendFileSync(path.join(f.evals, convergenceArtifactRef(f.stored.result.resultHash)), " ");
  });
  await assert.rejects(f.read(db.sql), fault === "selection" ? /FIXTURE_SELECTION_DRIFT/ : /CONTROL_EVIDENCE_UNSAFE/);
});
test("component failed fresh observation never reuses a prior qualified result", async t => {
  const f = await prepared(t); assert.equal((await f.read(sqlDouble([f.row]).sql)).evaluation.report?.qualification, "qualified");
  const result = await f.read(sqlDouble([f.row], "query_error").sql); assert.equal(result.evaluation.report?.qualification, "unqualified"); assert.equal(result.evaluation.availability.code, "CONTROL_RELEASE_ADMISSION_UNKNOWN");
});
