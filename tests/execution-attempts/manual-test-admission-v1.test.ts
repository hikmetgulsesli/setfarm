import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

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
    schema: "setfarm.manual-control-selection.v1",
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
