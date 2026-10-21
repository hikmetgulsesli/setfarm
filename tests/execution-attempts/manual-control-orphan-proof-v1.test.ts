import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { createV3ReleaseAdmissionV1, convergenceArtifactRef } from "../../src/execution/v3-release-admission.js";
import { makeSyntheticManualOrphanEvidenceV1, makeSyntheticManualOrphanMaintenanceResidueV1, syntheticBytesV1 } from "./helpers/manual-control-orphan-fixture-v1.js";
import type { ManualOrphanEvidenceV1 } from "../../src/execution/schemas/manual-control-orphan-retirement-v1.js";

// Intentionally unresolved until Task1 implementation. A missing module is the
// initial contract RED, never evidence that the semantic assertions ran.
import {
  parseManualOrphanEvidenceV1,
  parseManualOrphanRequestV1,
  parseManualOrphanSettlementV1,
} from "../../src/execution/schemas/manual-control-orphan-retirement-v1.js";
import {
  deriveManualOrphanReleasedRecordV1,
  proveManualOrphanRetirementV1,
} from "../../src/execution/manual-control-orphan-proof-v1.js";

const hashBytes = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const HASH = "a".repeat(64);
const SOURCE = "b".repeat(40);

function settlementSyntaxFixture() {
  return {
    schema: "mission-control.control-original-worker-settlement.v1",
    subject: "original_fixed_node_worker",
    jobId: "00000000-0000-4000-8000-000000000001", kind: "convergence_full8",
    channelId: "00000000-0000-4000-8000-000000000002",
    intentHash: HASH, selectionHash: HASH, sourceSha: SOURCE, mcSourceSha: SOURCE,
    mcBuildHash: HASH, executableHash: HASH, brokerPid: 100,
    originalChild: { pid: 101, processStartedAt: "2026-10-20T00:00:00.000Z",
      processGroupId: 101, source: "observed_os", executable: "/fixture/node",
      script: "/fixture/old/dist/cli/control-test-worker-v1.js", commandHash: HASH },
    ownerHash: HASH, exit: { code: 1, signal: null }, processClose: { code: 1, signal: null },
    stdout: { endObserved: true, closeObserved: true },
    stderr: { endObserved: true, closeObserved: true }, errors: [],
    observedFactsComplete: true, recordedAtUTC: "2026-10-20T00:01:00.000Z",
  };
}

test("strict settlement syntax preserves original nonzero exit without certifying its owner", () => {
  const parsed = parseManualOrphanSettlementV1(settlementSyntaxFixture());
  assert.deepEqual(parsed.exit, { code: 1, signal: null });
  assert.deepEqual(parsed.processClose, { code: 1, signal: null });
  assert.throws(() => parseManualOrphanSettlementV1({ ...settlementSyntaxFixture(), nonce: "private" }));
  assert.throws(() => parseManualOrphanSettlementV1({ ...settlementSyntaxFixture(), stdout: { endObserved: true } }));
  assert.throws(() => parseManualOrphanSettlementV1({ ...settlementSyntaxFixture(), stderr: { endObserved: true, closeObserved: true, hash: HASH } }));
});

test("settlement syntax retains incomplete original observations for semantic refusal", () => {
  const input = { ...settlementSyntaxFixture(), originalChild: null, ownerHash: null,
    exit: null, processClose: null, observedFactsComplete: false,
    stdout: { endObserved: false, closeObserved: false },
    stderr: { endObserved: false, closeObserved: false } };
  assert.deepEqual(parseManualOrphanSettlementV1(input), input);
  for (const error of ["CHILD_ERROR", "STDOUT_ERROR", "STDERR_ERROR", "STDOUT_LOG_ERROR", "STDERR_LOG_ERROR", "OWNER_BINDING_ERROR"]) {
    assert.deepEqual(parseManualOrphanSettlementV1({ ...input, errors: [error] }).errors, [error]);
  }
  for (const errors of [["UNKNOWN"], ["CHILD_ERROR", "CHILD_ERROR"], ["STDERR_ERROR", "CHILD_ERROR"]]) {
    assert.throws(() => parseManualOrphanSettlementV1({ ...input, errors }));
  }
});

test("strict settlement tuple and time syntax reject coercion and impossible observations", () => {
  for (const exit of [{ code: null, signal: null }, { code: 1, signal: "SIGTERM" },
    { code: 0.5, signal: null }, { code: Infinity, signal: null }, { code: "1", signal: null },
    { code: null, signal: "" }, { code: null, signal: "SIG\nTERM" }]) {
    assert.throws(() => parseManualOrphanSettlementV1({ ...settlementSyntaxFixture(), exit }));
  }
  for (const recordedAtUTC of ["2026-10-20", "2026-10-20T00:01:00Z", new Date("2026-10-20T00:01:00.000Z")]) {
    assert.throws(() => parseManualOrphanSettlementV1({ ...settlementSyntaxFixture(), recordedAtUTC }));
  }
});

type Mutable<T> = T extends readonly (infer E)[] ? Mutable<E>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
type Evidence = Mutable<ManualOrphanEvidenceV1>;
type Document = Evidence["reservation"];
const fresh = () => structuredClone(makeSyntheticManualOrphanEvidenceV1().evidence) as Evidence;

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const member of Object.values(value)) freeze(member);
    Object.freeze(value);
  }
  return value;
}

function encodeDocument<T>(doc: { file: Document["file"]; value: T }, encoding: "canonical" | "record" | "pretty" = "canonical") {
  const text = encoding === "record" ? JSON.stringify(doc.value) : encoding === "pretty" ? JSON.stringify(doc.value, null, 2) : canonicalJsonStringify(doc.value);
  doc.file.bytes = syntheticBytesV1(`${text}\n`);
  for (const stat of [doc.file.descriptorBefore, doc.file.descriptorAfter, doc.file.namedAfter]) stat.size = String(doc.file.bytes.byteLength);
}

function syncJournal(e: Evidence) {
  let previousHash: string | null = null;
  for (const [i, doc] of e.journal.entries()) {
    doc.file.relative = `evals/manual-control-journals/${e.request.jobId}/records/${String(i + 1).padStart(20, "0")}.json`;
    doc.value.previousHash = previousHash;
    encodeDocument(doc);
    previousHash = doc.file.bytes.sha256;
  }
  e.journalHead.value.recordHash = previousHash!;
  encodeDocument(e.journalHead);
  e.request.expectedJournalHeadHash = e.journalHead.file.bytes.sha256;
  for (const start of e.namespace.startChildren) {
    const record = e.journal.find(d => d.value.revision === start.value.journal.revision);
    assert.ok(record, "retained start-child reference must name an existing journal record");
    start.value.journal.hash = record.file.bytes.sha256;
    encodeDocument(start);
    assert.deepEqual(JSON.parse(Buffer.from(start.file.bytes.base64, "base64").toString()), start.value);
  }
}

function inventoryAddFile(e: Evidence, relative: string) {
  const parts = relative.split("/");
  for (let i = 0; i < parts.length; i++) {
    const parent = parts.slice(0, i).join("/");
    let listing = e.namespace.directories.find(d => d.relative === parent);
    if (!listing) { listing = { relative: parent, names: [] }; e.namespace.directories.push(listing); }
    if (!listing.names.includes(parts[i]!)) listing.names.push(parts[i]!);
    listing.names.sort();
  }
  e.namespace.directories.sort((a, b) => a.relative.localeCompare(b.relative));
}

function setCapturedPrivateUid(value: unknown, uid: string): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const member of value) setCapturedPrivateUid(member, uid); return; }
  if (Object.hasOwn(value, "descriptorBefore") && Object.hasOwn(value, "parents") && Object.hasOwn(value, "bytes")) {
    const file = value as Document["file"];
    for (const stat of [file.descriptorBefore, file.descriptorAfter, file.namedAfter]) stat.uid = uid;
    for (const parent of file.parents) { parent.before.uid = uid; parent.after.uid = uid; }
    return;
  }
  for (const member of Object.values(value)) setCapturedPrivateUid(member, uid);
}

function inventoryRemove(e: Evidence, relative: string) {
  const parts = relative.split("/"), name = parts.pop()!;
  const listing = e.namespace.directories.find(d => d.relative === parts.join("/"));
  assert.ok(listing);
  listing.names = listing.names.filter(n => n !== name);
}

function refuse(e: Evidence, expected: string | readonly string[]) {
  const snapshot = structuredClone(e);
  freeze(e);
  const verdict = proveManualOrphanRetirementV1(e);
  assert.equal(verdict.status, "refused");
  if (verdict.status !== "refused") assert.fail("invalid evidence became eligible");
  assert.ok((typeof expected === "string" ? [expected] : expected).includes(verdict.code), `expected ${String(expected)}, received ${verdict.code}`);
  assert.deepEqual(Object.keys(verdict).sort(), ["code", "status"]);
  assert.deepEqual(e, snapshot, "refusal must preserve every input byte and field");
}

test("literal global history and original bytes bind active6 to released7", () => {
  const { evidence, priorRecord } = makeSyntheticManualOrphanEvidenceV1();
  assert.deepEqual(evidence.history.map(d => [d.value.reservation.revision, d.value.reservation.phase]),
    [[1, "pending"], [2, "active"], [3, "released"], [4, "pending"], [5, "active"], [6, "active"]]);
  assert.deepEqual(evidence.history.map(d => d.value.reservation.jobId), [
    "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000001"]);
  assert.equal(evidence.journal.length, 20);
  assert.deepEqual(evidence.journal.map(d => d.value.event.type), ["acquired", "phase", "phase", "canary_create_requested", "canary_bound", "phase", "start_requested", "run_bound", "phase", "cancel_latched", "stop_requested", "stop_observed", "phase", "run_result_stored", "phase", "artifacts_stored", "phase", "finalization_boundary", "artifacts_stored", "phase"]);
  assert.equal(evidence.journal[0]!.value.event.type, "acquired");
  assert.equal(Reflect.get(evidence.journal[0]!.value.event, "reservationRevision"), 5);
  assert.equal(Reflect.get(evidence.journal[4]!.value.event, "reservationRevision"), 6);
  assert.deepEqual(evidence.journal[19]!.value.event, { type: "phase", phase: "settling", currentCaseId: null, completedCases: 1 });
  assert.equal(evidence.database.slots.length, 8);
  assert.equal(evidence.database.slots.filter(s => s.claimRows[0]!.run_id === null).length, 7);
  assert.equal(evidence.database.slots[0]!.runRows[0]!.status, "cancelled");
  const runOwner = evidence.database.slots[0]!.ownerRows[0]!.canonical_owner_identity;
  assert.deepEqual(runOwner, { schema: "setfarm.internal-production-canonical-owner-identity.v1", category: "run",
    ownerKey: "orphan_fixture_run_1", ownerRef: "setfarm://runs/orphan_fixture_run_1",
    ownerHash: hashBytes('{"runId":"orphan_fixture_run_1","schema":"setfarm.internal-production-workflow-run-owner.v1"}') });
  assert.equal(evidence.database.slots[0]!.close!.terminalOwnerRef, "setfarm://runs/orphan_fixture_run_1/terminal/cancelled");
  assert.equal(evidence.database.slots[0]!.close!.terminalOwnerHash,
    hashBytes('{"runId":"orphan_fixture_run_1","schema":"setfarm.internal-production-workflow-run-terminal-owner.v1","status":"cancelled"}'));
  assert.deepEqual(evidence.database.releaseGoRows, []);
  assert.equal(evidence.mc.receipts[3]!.value.receipt.revision, 4);
  assert.equal(evidence.mc.receipts[3]!.value.mapping!.ack.body.receipt.revision, 3);
  assert.equal(evidence.mc.receipts[1]!.value.mapping!.ack.sequence, 2);
  assert.equal(evidence.mc.receipts[2]!.value.mapping!.ack.sequence, 3);
  assert.equal(evidence.mc.receipts[2]!.value.mapping!.sequence, 2);
  assert.equal(evidence.mc.index.value.jobs.length, 2);
  assert.equal(evidence.mc.index.value.jobs[0]!.receipt.state, "cancelling");
  assert.equal(evidence.nativeBefore.census.stderr.bytes.sha256, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const expected = { ...priorRecord, reservation: { ...priorRecord.reservation, revision: 7, phase: "released" as const } };
  const priorBytes = `${JSON.stringify(priorRecord)}\n`, releasedBytes = `${JSON.stringify(expected)}\n`;
  assert.ok(priorBytes.startsWith('{"schema":"setfarm.manual-evaluation-record.v1","reservation":{"jobId":'));
  assert.equal(Buffer.from(evidence.reservation.file.bytes.base64, "base64").toString(), priorBytes);
  assert.notEqual(hashBytes(priorBytes), hashBytes(`${canonicalJsonStringify(priorRecord)}\n`));
  const before = structuredClone(evidence);
  freeze(evidence); freeze(priorRecord);
  const parsed = parseManualOrphanEvidenceV1(evidence);
  assert.deepEqual(parsed, evidence, "strict parser cannot strip or default data");
  const released = deriveManualOrphanReleasedRecordV1(priorRecord);
  assert.deepEqual(released, expected);
  assert.equal(JSON.stringify(released) + "\n", releasedBytes);
  const verdict = proveManualOrphanRetirementV1(parsed);
  assert.equal(verdict.status, "eligible");
  if (verdict.status !== "eligible") assert.fail(`synthetic positive refused: ${verdict.code}`);
  assert.equal(verdict.priorRecordHash, hashBytes(priorBytes));
  assert.equal(verdict.releasedRecordHash, hashBytes(releasedBytes));
  assert.equal(verdict.evidenceHash, hashBytes(canonicalJsonStringify(evidence)));
  assert.deepEqual(proveManualOrphanRetirementV1(parsed), verdict, "same valid input has a deterministic complete verdict");
  assert.deepEqual(Object.keys(verdict).sort(), ["evidenceHash", "priorRecordHash", "releasedRecordHash", "status"]);
  assert.deepEqual(evidence, before);
});

type Defect = { name: string; code: string | readonly string[]; change(e: Evidence): void };
const defects: Defect[] = [
  { name: "maintenance source differs from its main authority", code: "SOURCE", change: e => { e.maintenanceSource.originMainSha = "f".repeat(40); } },
  { name: "maintenance and target claim identical source", code: "SOURCE", change: e => { e.maintenanceSource = structuredClone(e.target.source); } },
  { name: "selected source differs from target source", code: "TARGET", change: e => { e.target.selection.sourceSha = "f".repeat(40); } },
  { name: "database role differs from captured target", code: "TARGET", change: e => { e.database.currentUser = "wrong_runtime"; } },
  { name: "current head differs from revision6", code: ["HISTORY", "CAS"], change: e => { e.reservation.value.nonceDigest = "f".repeat(64); encodeDocument(e.reservation, "record"); e.request.expectedRecordHash = e.reservation.file.bytes.sha256; } },
  { name: "global history missing prior revision", code: "HISTORY", change: e => { e.history.splice(1, 1); } },
  { name: "current segment acquired revision wrongly assumes global6", code: "JOURNAL", change: e => { Reflect.set(e.journal[0]!.value.event, "reservationRevision", 6); syncJournal(e); } },
  { name: "canary bound refers to unbound acquired5", code: "JOURNAL", change: e => { Reflect.set(e.journal[4]!.value.event, "reservationRevision", 5); syncJournal(e); } },
  { name: "retained start-child journal reference is stale", code: "JOURNAL", change: e => { const d = e.namespace.startChildren[0]!; d.value.journal.hash = "f".repeat(64); encodeDocument(d); } },
  { name: "current job repeats across prior released segment", code: "HISTORY", change: e => { e.history[0]!.value.reservation.jobId = e.request.jobId; encodeDocument(e.history[0]!, "record"); } },
  { name: "retained prior intent has no closure", code: "OTHER_OWNER", change: e => { e.namespace.otherIntents[0]!.closure = null; e.namespace.closures = []; } },
  { name: "prior closure crosses released byte hash", code: "OTHER_OWNER", change: e => { const d = e.namespace.closures[0]!; if (d.value.closure.kind === "reservation_released") d.value.closure.recordHash = "f".repeat(64); encodeDocument(d, "record"); e.namespace.otherIntents[0]!.closure = d; } },
  { name: "selection crossed in channel receipt", code: "AUTHENTICATION", change: e => { e.mc.receipts[0]!.value.receipt.selectionHash = "f".repeat(64); encodeDocument(e.mc.receipts[0]!); } },
  { name: "suite crossed in channel receipt", code: "AUTHENTICATION", change: e => { e.mc.receipts[0]!.value.receipt.suiteHash = "f".repeat(64); encodeDocument(e.mc.receipts[0]!); } },
  { name: "source crossed in channel receipt", code: "AUTHENTICATION", change: e => { e.mc.receipts[0]!.value.receipt.sourceSha = "f".repeat(40); encodeDocument(e.mc.receipts[0]!); } },
  { name: "channel id crossed", code: "AUTHENTICATION", change: e => { e.mc.channel.value.channelId = "00000000-0000-4000-8000-000000009999"; encodeDocument(e.mc.channel); } },
  { name: "original ready hash crossed", code: "AUTHENTICATION", change: e => { e.mc.channel.value.readyFrameHash = "f".repeat(64); encodeDocument(e.mc.channel); } },
  { name: "original channel owner crossed", code: "AUTHENTICATION", change: e => { e.mc.channel.value.originalChild.pid = 999; encodeDocument(e.mc.channel); } },
  { name: "intent nonce digest differs from original reservation", code: "AUTHENTICATION", change: e => { e.intent.value.nonceDigest = "f".repeat(64); encodeDocument(e.intent); } },
  { name: "ACK channel crossed", code: "AUTHENTICATION", change: e => { e.mc.receipts[1]!.value.mapping!.ack.channelId = "00000000-0000-4000-8000-000000009999"; encodeDocument(e.mc.receipts[1]!); } },
  { name: "ACK worker hash crossed", code: "AUTHENTICATION", change: e => { e.mc.receipts[1]!.value.mapping!.ack.body.workerFrameHash = "f".repeat(64); encodeDocument(e.mc.receipts[1]!); } },
  { name: "repeated cancellation mapping ACK overwritten with newer outer receipt", code: "AUTHENTICATION", change: e => { const d = e.mc.receipts[3]!; d.value.mapping!.ack.body.receipt = structuredClone(d.value.receipt); d.value.mapping!.ack.body.receiptRevision = d.value.receipt.revision; encodeDocument(d); } },
  { name: "receipt file missing from numbered history", code: "AUTHENTICATION", change: e => { e.mc.receipts.splice(2, 1); } },
  { name: "index drops retained earlier ready mapping", code: "AUTHENTICATION", change: e => { e.mc.index.value.jobs[0]!.frames.shift(); encodeDocument(e.mc.index); } },
  { name: "index selected job unpublished", code: "AUTHENTICATION", change: e => { e.mc.index.value.jobs[0]!.published = false; encodeDocument(e.mc.index); } },
  { name: "cancel ancestry request crossed", code: "AUTHENTICATION", change: e => { e.mc.cancel!.value.requestId = "00000000-0000-4000-8000-000000009999"; encodeDocument(e.mc.cancel!); } },
  { name: "request prior record byte hash stale", code: "CAS", change: e => { e.request.expectedRecordHash = "f".repeat(64); } },
  { name: "request journal head hashes internal record instead of head bytes", code: "CAS", change: e => { e.request.expectedJournalHeadHash = e.journalHead.value.recordHash; } },
  { name: "request settlement byte hash stale", code: "CAS", change: e => { e.request.expectedSettlementHash = "f".repeat(64); } },
  { name: "journal gap", code: "JOURNAL", change: e => { e.journal.splice(10, 1); } },
  { name: "journal head points to wrong record", code: "JOURNAL", change: e => { e.journalHead.value.recordHash = "f".repeat(64); encodeDocument(e.journalHead); e.request.expectedJournalHeadHash = e.journalHead.file.bytes.sha256; } },
  { name: "journal owner hash crossed", code: "JOURNAL", change: e => { e.journal[10]!.value.ownerHash = "f".repeat(64); syncJournal(e); } },
  { name: "journal has a released event", code: "JOURNAL", change: e => { e.journal[19]!.value.event = { type: "released", heldRevision: 6 }; syncJournal(e); } },
  { name: "journal has a closed event", code: "JOURNAL", change: e => { e.journal[19]!.value.event = { type: "closed", closureHash: "f".repeat(64), outcome: "cancelled", reportRefs: {} }; syncJournal(e); } },
  { name: "journal has promotion confirmation", code: "JOURNAL", change: e => { Reflect.set(e.journal[18]!.value.event, "stage", "promotion_confirmed"); syncJournal(e); } },
  { name: "journal boundary continues go", code: "JOURNAL", change: e => { Reflect.set(e.journal[17]!.value.event, "decision", "continue"); Reflect.set(e.journal[17]!.value.event, "gateDecision", "go"); syncJournal(e); } },
  { name: "journal candidate/final boundary crossed hash", code: "JOURNAL", change: e => { Reflect.set(e.journal[17]!.value.event, "resultHash", "f".repeat(64)); syncJournal(e); } },
  { name: "journal contains unresolved fault", code: "JOURNAL", change: e => { e.journal[10]!.value.event = { type: "fault", code: "CONTROL_PROMOTION_UNCERTAIN", phase: "finalizing" }; syncJournal(e); } },
  { name: "completed cases falsely counts only passing results", code: "JOURNAL", change: e => { Reflect.set(e.journal[16]!.value.event, "completedCases", 0); syncJournal(e); } },
  { name: "nonpromoting eval artifact missing", code: ["JOURNAL", "MALFORMED"], change: e => { const a = e.artifacts.splice(1, 1)[0]!; inventoryRemove(e, a.document.file.relative); } },
  { name: "semantic result hash replaced by pretty file byte hash", code: "JOURNAL", change: e => { Reflect.set(e.journal[18]!.value.event, "resultHash", e.artifacts[1]!.document.file.bytes.sha256); syncJournal(e); } },
  { name: "immutable finding child absent", code: "FINDINGS", change: e => { e.database.findingChildren = []; } },
  { name: "immutable finding child duplicate", code: "FINDINGS", change: e => { e.database.findingChildren.push(structuredClone(e.database.findingChildren[0]!)); } },
  { name: "immutable finding child orphan", code: "FINDINGS", change: e => { e.database.findingChildren[0]!.finding_set_hash = "f".repeat(64); } },
  { name: "immutable finding source fingerprint crossed", code: "FINDINGS", change: e => { e.database.findingChildren[0]!.source_fingerprint = "f".repeat(64); } },
  { name: "immutable parent child inventory crossed", code: "FINDINGS", change: e => { e.database.findingParents[0]!.finding_ids = []; } },
  { name: "immutable finding parent duplicate", code: "FINDINGS", change: e => { e.database.findingParents.push(structuredClone(e.database.findingParents[0]!)); } },
  { name: "one cumulative slot removed from active6", code: "HISTORY", change: e => { e.history[5]!.value.slots.pop(); encodeDocument(e.history[5]!, "record"); e.reservation.value = structuredClone(e.history[5]!.value); encodeDocument(e.reservation, "record"); e.request.expectedRecordHash = e.reservation.file.bytes.sha256; } },
  { name: "slot claim row missing", code: "SLOTS", change: e => { e.database.slots[1]!.claimRows = []; } },
  { name: "claim consumed_at without run_id", code: "SLOTS", change: e => { e.database.slots[1]!.claimRows[0]!.consumed_at = "2026-10-20T00:00:10.000Z"; } },
  { name: "claim run_id without consumed_at", code: "SLOTS", change: e => { e.database.slots[0]!.claimRows[0]!.consumed_at = null; } },
  { name: "duplicate consumed run in two slots", code: "SLOTS", change: e => { e.database.slots[1]!.claimRows[0]!.run_id = e.database.slots[0]!.claimRows[0]!.run_id; e.database.slots[1]!.claimRows[0]!.consumed_at = e.database.slots[0]!.claimRows[0]!.consumed_at; } },
  { name: "consumed run nonterminal", code: "MALFORMED", change: e => { Reflect.set(e.database.slots[0]!.runRows[0]!, "status", "running"); } },
  { name: "consumed run wrong protocol", code: "MALFORMED", change: e => { Reflect.set(e.database.slots[0]!.runRows[0]!, "protocol", "shadow"); } },
  { name: "consumed run wrong protocol version", code: "MALFORMED", change: e => { Reflect.set(e.database.slots[0]!.runRows[0]!, "protocol_version", 2); } },
  { name: "consumed run wrong source", code: "SLOTS", change: e => { e.database.slots[0]!.runRows[0]!.compiler_release_sha = "f".repeat(40); } },
  { name: "consumed run wrong task", code: "SLOTS", change: e => { e.database.slots[0]!.runRows[0]!.task = "Crossed admitted task"; } },
  { name: "claim selector crossed", code: "SLOTS", change: e => { e.database.slots[0]!.claimRows[0]!.selector_hash = "f".repeat(64); } },
  { name: "claim admission crossed", code: "SLOTS", change: e => { e.database.slots[0]!.claimRows[0]!.admission_hash = "f".repeat(64); } },
  { name: "claim case crossed", code: "SLOTS", change: e => { e.database.slots[0]!.claimRows[0]!.case_hash = "f".repeat(64); } },
  { name: "claim task crossed", code: "SLOTS", change: e => { e.database.slots[0]!.claimRows[0]!.task_hash = "f".repeat(64); } },
  { name: "claim repetition crossed", code: "MALFORMED", change: e => { Reflect.set(e.database.slots[0]!.claimRows[0]!, "repetition", 2); } },
  { name: "canonical owner ref crossed", code: "SLOTS", change: e => { e.database.slots[0]!.ownerRows[0]!.canonical_owner_identity.ownerRef = "setfarm://runs/another_run"; } },
  { name: "canonical owner hash crossed", code: "SLOTS", change: e => { e.database.slots[0]!.ownerRows[0]!.canonical_owner_identity.ownerHash = "f".repeat(64); } },
  { name: "canonical owner schema crossed", code: "MALFORMED", change: e => { Reflect.set(e.database.slots[0]!.ownerRows[0]!.canonical_owner_identity, "schema", "invented" ); } },
  { name: "terminal authority pair crossed", code: "SLOTS", change: e => { e.database.slots[0]!.terminalPair!.terminalAuthorityHash = "f".repeat(64); } },
  { name: "close content hash forged", code: ["MALFORMED", "SLOTS"], change: e => { e.database.slots[0]!.close!.closeHash = "f".repeat(64); } },
  { name: "terminal close record missing", code: "SLOTS", change: e => { e.database.slots[0]!.close = null; } },
  { name: "closed owner close ref crossed", code: "SLOTS", change: e => { e.database.slots[0]!.ownerRows[0]!.close_ref = "setfarm://internal-production/owner-reservation-closes/another"; } },
  { name: "closed owner close hash crossed", code: "SLOTS", change: e => { e.database.slots[0]!.ownerRows[0]!.close_hash = "f".repeat(64); } },
  { name: "unconsumed slot carries run owner evidence", code: "SLOTS", change: e => { e.database.slots[1]!.ownerRows = structuredClone(e.database.slots[0]!.ownerRows); } },
  { name: "native after bracket omitted", code: "MALFORMED", change: e => { Reflect.deleteProperty(e, "nativeAfter"); } },
  { name: "native census truncates last newline", code: "NATIVE", change: e => { const c = e.nativeBefore.census; c.stdout.bytes = syntheticBytesV1(Buffer.from(c.stdout.bytes.base64, "base64").toString().trimEnd()); c.stdout.dataBytesObserved = c.stdout.bytes.byteLength; } },
  { name: "native original PID present with selected command", code: "NATIVE", change: e => appendCensus(e, `101 1 101 /fixture/node /fixture/old/dist/cli/control-test-worker-v1.js`) },
  { name: "native original PID reused by unrelated executable", code: "NATIVE", change: e => appendCensus(e, "101 1 101 /usr/bin/true") },
  { name: "native retained start child PID remains", code: "NATIVE", change: e => appendCensus(e, "102 1 102 /usr/bin/true") },
  { name: "native original detached process group remains", code: "NATIVE", change: e => appendCensus(e, "888 1 101 /usr/bin/true") },
  { name: "native original descendant remains", code: "NATIVE", change: e => appendCensus(e, "888 101 888 /usr/bin/true") },
  { name: "native retained child descendant remains", code: "NATIVE", change: e => appendCensus(e, "888 102 888 /usr/bin/true") },
  { name: "native selected evaluator remains", code: "NATIVE", change: e => appendCensus(e, "888 1 888 /fixture/node /fixture/old/dist/evals/convergence-runner.js") },
  { name: "native malformed selected reference remains", code: "NATIVE", change: e => appendCensus(e, "888 1 888 /usr/bin/env /fixture/old/src/evals/convergence-runner.ts") },
  { name: "native duplicate PID", code: "NATIVE", change: e => appendCensus(e, "1 0 1 /sbin/launchd") },
  { name: "native cyclic descendants", code: "NATIVE", change: e => appendCensus(e, "888 889 888 /usr/bin/true\n889 888 889 /usr/bin/true") },
  { name: "native census actual executor absent", code: "NATIVE", change: e => { e.nativeBefore.census.executorPid = 999; } },
  { name: "native census executor parent crossed", code: "NATIVE", change: e => { e.nativeBefore.census.executorParentPid = 999; } },
  { name: "native after observation precedes DB collection", code: "NATIVE", change: e => { e.nativeAfter.observedAtStartUTC = "2026-10-20T00:00:00.000Z"; e.nativeAfter.observedAtEndUTC = "2026-10-20T00:00:04.000Z"; } },
  { name: "native census close precedes exit", code: "NATIVE", change: e => { e.nativeBefore.census.closeObservedAtUTC = e.nativeBefore.census.spawnObservedAtUTC; } },
  { name: "native arbitrary census command", code: "NATIVE", change: e => { e.nativeBefore.census.argv = ["-A"]; } },
  { name: "native identity before and after differ", code: "NATIVE", change: e => { const c = e.nativeBefore.collectorIdentity.after; c.stdout.bytes = syntheticBytesV1("Tue Oct 20 00:00:00 2026 400 /fixture/node /fixture/other.js\n"); c.stdout.dataBytesObserved = c.stdout.bytes.byteLength; } },
  { name: "native collector identity comm crossed", code: "NATIVE", change: e => { const c = e.nativeBefore.collectorIdentity.comm; c.stdout.bytes = syntheticBytesV1("/other/node\n"); c.stdout.dataBytesObserved = c.stdout.bytes.byteLength; } },
  { name: "maintenance temp file remains", code: "OTHER_OWNER", change: e => { const f = makeSyntheticManualOrphanMaintenanceResidueV1(); e.namespace.buildMaintenanceFiles.push(f); inventoryAddFile(e, f.relative); assert.deepEqual(f.parents.map(p => p.relative), ["", ".setfarm"]); assert.equal(f.bytes.byteLength, Number(f.namedAfter.size)); } },
  { name: "manual mutation remains", code: "OTHER_OWNER", change: e => { e.namespace.mutationFiles.push(structuredClone(e.reservation.file)); } },
  { name: "prepublication retirement residue remains", code: "OTHER_OWNER", change: e => { e.namespace.retirementFiles.push(structuredClone(e.reservation.file)); } },
  { name: "empty retirements directory is still prepublication residue", code: "OTHER_OWNER", change: e => { e.namespace.directories.find(d => d.relative === "evals/manual-controls")!.names.push("retirements"); e.namespace.directories.push({ relative: "evals/manual-controls/retirements", names: [] }); } },
  { name: "unknown manual namespace entry", code: "OTHER_OWNER", change: e => { e.namespace.directories.find(d => d.relative === "evals/manual-controls")!.names.push("unexplained.json"); } },
  { name: "unknown unclosed retained MC owner", code: "OTHER_OWNER", change: e => { const prior = structuredClone(e.namespace.otherIntents[0]!); prior.jobId = "00000000-0000-4000-8000-000000009999"; prior.closure = null; e.namespace.otherIntents.push(prior); } },
];

function appendCensus(e: Evidence, line: string) {
  const c = e.nativeBefore.census;
  c.stdout.bytes = syntheticBytesV1(`${Buffer.from(c.stdout.bytes.base64, "base64").toString()}${line}\n`);
  c.stdout.dataBytesObserved = c.stdout.bytes.byteLength;
}

for (const defect of defects) test(`refuses ${defect.name}`, () => {
  const e = fresh(); defect.change(e); refuse(e, defect.code);
});

test("related release_go row blocks even without journal promotion confirmation", () => {
  const e = fresh(), event = e.journal[15]!.value.event;
  assert.equal(event.type, "artifacts_stored"); if (event.type !== "artifacts_stored") assert.fail();
  const payload = createV3ReleaseAdmissionV1({ schema: "setfarm.v3-release-admission.v1", kind: "release_go", releaseSha: e.target.source.sha,
    suiteHash: e.reservation.value.reservation.suiteHash!, result: { hash: event.resultHash, ref: convergenceArtifactRef(event.resultHash) },
    gate: { hash: event.gateHash, ref: convergenceArtifactRef(event.gateHash) }, preflightHash: "a".repeat(64), slots: [], issuedAt: "2026-10-20T00:00:50.000Z", expiresAt: null });
  e.database.releaseGoRows.push({ admission_hash: payload.admissionHash, kind: "release_go", release_sha: payload.releaseSha, suite_hash: payload.suiteHash,
    result_hash: event.resultHash, result_ref: convergenceArtifactRef(event.resultHash), gate_hash: event.gateHash, gate_ref: convergenceArtifactRef(event.gateHash), expires_at: null, payload });
  refuse(e, "JOURNAL");
});

test("settlement completeness is recomputed from every actual original handle fact", () => {
  const changes: [string, (s: Evidence["mc"]["settlement"]["value"]) => void][] = [
    ["exit0", s => { s.exit = { code: 0, signal: null }; }], ["close0", s => { s.processClose = { code: 0, signal: null }; }],
    ["null exit", s => { s.exit = null; }], ["null close", s => { s.processClose = null; }],
    ["signal exit", s => { s.exit = { code: null, signal: "SIGTERM" }; }],
    ["null owner", s => { s.originalChild = null; }], ["null owner hash", s => { s.ownerHash = null; }],
    ["crossed owner", s => { s.originalChild!.pid = 999; }], ["crossed owner hash", s => { s.ownerHash = "f".repeat(64); }],
    ["crossed broker build", s => { s.mcBuildHash = "f".repeat(64); }], ["crossed MC source", s => { s.mcSourceSha = "f".repeat(40); }],
    ["crossed executable", s => { s.executableHash = "f".repeat(64); }], ["crossed selection", s => { s.selectionHash = "f".repeat(64); }],
    ["crossed job source", s => { s.sourceSha = "f".repeat(40); }], ["crossed channel", s => { s.channelId = "00000000-0000-4000-8000-000000009999"; }],
    ["false completeness", s => { s.observedFactsComplete = false; }], ["error", s => { s.errors = ["CHILD_ERROR"]; }],
  ];
  for (const stream of ["stdout", "stderr"] as const) for (const field of ["endObserved", "closeObserved"] as const) changes.push([`${stream}.${field}`, s => { s[stream][field] = false; }]);
  for (const [name, change] of changes) {
    const e = fresh(); change(e.mc.settlement.value); encodeDocument(e.mc.settlement);
    e.request.expectedSettlementHash = e.mc.settlement.file.bytes.sha256;
    assert.equal(e.mc.settlement.value.observedFactsComplete, name === "false completeness" ? false : true);
    refuse(e, "SETTLEMENT");
  }
});

test("native capture completion requires actual close and complete stream facts at both brackets", () => {
  for (const bracket of ["nativeBefore", "nativeAfter"] as const) {
    const mutations: ((c: Evidence["nativeBefore"]["census"]) => void)[] = [
      c => { c.exit = null; }, c => { c.processClose = null; }, c => { c.spawnObservedAtUTC = null; },
      c => { c.exitObservedAtUTC = null; }, c => { c.closeObservedAtUTC = null; },
      c => { c.exit = { code: 1, signal: null }; }, c => { c.errors = ["TIMEOUT"]; },
      c => { c.stdout.dataBytesObserved++; }, c => { c.stderr.bytes = syntheticBytesV1("warning\n"); c.stderr.dataBytesObserved = c.stderr.bytes.byteLength; },
    ];
    for (const stream of ["stdout", "stderr"] as const) for (const field of ["endObserved", "closeObserved"] as const) mutations.push(c => { c[stream][field] = false; });
    for (const mutate of mutations) { const e = fresh(); mutate(e[bracket].census); refuse(e, "NATIVE"); }
  }
});

test("strict nested data and file pins cannot be replaced by completeness claims", () => {
  const mutations: ((e: Evidence) => void)[] = [
    e => { Reflect.set(e, "authenticated", true); }, e => { Reflect.set(e.database, "idle", true); },
    e => { Reflect.set(e.nativeBefore, "ownerAbsent", true); }, e => { Reflect.deleteProperty(e.database, "activityRows"); },
    e => { Reflect.set(e.reservation.file.bytes, "path", "/fixture/private"); },
    e => { e.reservation.file.bytes.base64 += "="; }, e => { e.reservation.file.bytes.byteLength++; },
    e => { e.reservation.file.bytes.sha256 = "f".repeat(64); }, e => { e.reservation.file.namedAfter.ino = "999"; },
    e => { e.reservation.file.namedAfter.nlink = "2"; }, e => { e.reservation.file.descriptorBefore.mode = "33188"; },
    e => { e.reservation.file.parents[0]!.after.mode = "16877"; }, e => { e.reservation.file.parents = []; },
    e => { e.reservation.file.relative = "../reservation.json"; },
    e => { e.reservation.file.relative = "evals\\reservation.json"; },
    e => { e.reservation.file.descriptorBefore.size = "01"; },
    e => { Reflect.set(e.database, "backendPid", 1n); },
  ];
  for (const change of mutations) { const e = fresh(); change(e); refuse(e, "MALFORMED"); }
});

test("runtime proof reparses even callers that bypass the static validated type", () => {
  const e = fresh(); Reflect.set(e.request, "expectedRevision", "6"); refuse(e, "MALFORMED");
  const invalid = fresh(); Reflect.set(invalid.database, "observedAtStartUTC", new Date());
  assert.throws(() => parseManualOrphanEvidenceV1(invalid));
  const withFunction = fresh(); Reflect.set(withFunction.namespace, "ignore", () => true);
  assert.throws(() => parseManualOrphanEvidenceV1(withFunction));
});

test("consistent captured UID and stable per-file GID are data rather than fixed host constants", () => {
  const e = fresh();
  const originalDigest = hashBytes(canonicalJsonStringify(e));
  setCapturedPrivateUid(e, "777");
  for (const stat of [e.reservation.file.descriptorBefore, e.reservation.file.descriptorAfter, e.reservation.file.namedAfter]) stat.gid = "21";
  assert.equal(e.reservation.file.parents[0]!.before.uid, "777");
  assert.equal(e.reservation.file.parents[0]!.before.gid, "20");
  assert.equal(e.reservation.file.namedAfter.gid, "21");
  const expectedDigest = hashBytes(canonicalJsonStringify(e));
  const verdict = proveManualOrphanRetirementV1(parseManualOrphanEvidenceV1(freeze(e)));
  assert.equal(verdict.status, "eligible");
  if (verdict.status !== "eligible") assert.fail("consistent captured metadata must remain eligible");
  assert.equal(verdict.evidenceHash, expectedDigest);
  assert.notEqual(verdict.evidenceHash, originalDigest);
});

test("private ownership refuses root UID disagreement, file UID disagreement and per-pin GID drift independently", () => {
  const rootMismatch = fresh();
  setCapturedPrivateUid(rootMismatch.reservation.file, "777");
  assert.equal(rootMismatch.reservation.file.parents[0]!.before.uid, "777");
  assert.equal(rootMismatch.history[5]!.file.parents[0]!.before.uid, "501");
  refuse(rootMismatch, "MALFORMED");
  const fileMismatch = fresh();
  for (const stat of [fileMismatch.reservation.file.descriptorBefore, fileMismatch.reservation.file.descriptorAfter, fileMismatch.reservation.file.namedAfter]) stat.uid = "777";
  assert.equal(fileMismatch.reservation.file.parents[0]!.before.uid, "501");
  refuse(fileMismatch, "MALFORMED");
  const gidDrift = fresh(); gidDrift.reservation.file.namedAfter.gid = "21";
  assert.equal(gidDrift.reservation.file.descriptorAfter.gid, "20");
  refuse(gidDrift, "MALFORMED");
});

test("evidence digest covers all checked data and changes for a valid retirement requestId only", () => {
  const first = fresh(), changed = fresh();
  changed.request.requestId = "00000000-0000-4000-8000-000000009999";
  assert.deepEqual({ ...changed, request: first.request }, first, "only the administrative retirement requestId changes");
  const firstExpected = hashBytes(canonicalJsonStringify(first)), changedExpected = hashBytes(canonicalJsonStringify(changed));
  assert.notEqual(firstExpected, changedExpected);
  const firstVerdict = proveManualOrphanRetirementV1(parseManualOrphanEvidenceV1(freeze(first)));
  const repeatedVerdict = proveManualOrphanRetirementV1(parseManualOrphanEvidenceV1(first));
  const changedVerdict = proveManualOrphanRetirementV1(parseManualOrphanEvidenceV1(freeze(changed)));
  assert.equal(firstVerdict.status, "eligible"); assert.equal(changedVerdict.status, "eligible");
  if (firstVerdict.status !== "eligible" || changedVerdict.status !== "eligible") assert.fail("valid requestId-only change must retain eligibility");
  assert.deepEqual(repeatedVerdict, firstVerdict);
  assert.equal(firstVerdict.evidenceHash, firstExpected); assert.equal(changedVerdict.evidenceHash, changedExpected);
  assert.notEqual(firstVerdict.evidenceHash, changedVerdict.evidenceHash);
  assert.equal(firstVerdict.priorRecordHash, changedVerdict.priorRecordHash);
  assert.equal(firstVerdict.releasedRecordHash, changedVerdict.releasedRecordHash);
});

test("parsed evidence and proof verdicts cannot be mutated after validation", () => {
  const input = fresh(), parsed = parseManualOrphanEvidenceV1(input);
  input.request.requestId = "00000000-0000-4000-8000-000000009999";
  assert.equal(parsed.request.requestId, "00000000-0000-4000-8000-000000000006");
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.request));
  assert.ok(Object.isFrozen(parsed.database.slots[0]!.claimRows));
  assert.equal(Reflect.set(parsed.request, "expectedRevision", 7), false);
  const verdict = proveManualOrphanRetirementV1(parsed);
  assert.equal(verdict.status, "eligible");
  assert.ok(Object.isFrozen(verdict));
  assert.equal(Reflect.set(verdict, "status", "refused"), false);
  const refused = fresh(); refused.request.expectedRecordHash = "f".repeat(64);
  const refusal = proveManualOrphanRetirementV1(refused);
  assert.deepEqual(refusal, { status: "refused", code: "CAS" });
  assert.ok(Object.isFrozen(refusal));
});

test("continue with no_go retains candidate bytes and accepts final_without_promotion", () => {
  const e = structuredClone(makeSyntheticManualOrphanEvidenceV1("continue_no_go").evidence) as Evidence;
  assert.equal(e.journal.length, 17); assert.equal(e.journalHead.value.revision, 17);
  assert.equal(e.journal.some(d => ["cancel_latched", "stop_requested", "stop_observed"].includes(d.value.event.type)), false);
  const candidate = e.journal[12]!.value.event;
  assert.equal(candidate.type, "artifacts_stored");
  if (candidate.type !== "artifacts_stored") assert.fail();
  assert.deepEqual(e.journal[14]!.value.event, { type: "finalization_boundary", resultHash: candidate.resultHash, gateHash: candidate.gateHash, gateDecision: "no_go", decision: "continue" });
  assert.deepEqual(e.journal[15]!.value.event, { ...candidate, stage: "final_without_promotion" });
  const result = e.artifacts.find(a => a.kind === "eval_result")!;
  assert.deepEqual(Reflect.get(result.document.value, "blockerCodes"), ["EVAL_RUN_IDENTITY_INVALIDATED"]);
  assert.equal(e.artifacts.length, 3);
  const verdict = proveManualOrphanRetirementV1(parseManualOrphanEvidenceV1(freeze(e)));
  assert.equal(verdict.status, "eligible");
});

test("cancelled_final can reuse candidate bytes already containing the cancel blocker", () => {
  const e = fresh(), final = e.journal[18]!.value.event;
  assert.equal(final.type, "artifacts_stored");
  if (final.type !== "artifacts_stored") assert.fail();
  assert.deepEqual(e.journal[15]!.value.event, { ...final, stage: "candidate" });
  assert.deepEqual(e.journal[17]!.value.event, { type: "finalization_boundary", resultHash: final.resultHash, gateHash: final.gateHash, gateDecision: "no_go", decision: "cancel" });
  assert.deepEqual(Reflect.get(e.artifacts.find(a => a.kind === "eval_result")!.document.value, "blockerCodes"), ["EVAL_CANCEL_REQUESTED"]);
  assert.equal(e.artifacts.length, 3);
  assert.equal(proveManualOrphanRetirementV1(parseManualOrphanEvidenceV1(freeze(e))).status, "eligible");
});

test("late cancellation adds only the producer blocker and derives distinct nonpromoting final artifacts", () => {
  const e = makeSyntheticManualOrphanEvidenceV1("late_cancel").evidence;
  assert.equal(e.journal.length, 18); assert.equal(e.journalHead.value.revision, 18);
  assert.deepEqual(e.journal.slice(12).map(d => d.value.event.type), ["artifacts_stored", "phase", "cancel_latched", "finalization_boundary", "artifacts_stored", "phase"]);
  assert.equal(e.journal.some(d => ["stop_requested", "stop_observed"].includes(d.value.event.type)), false);
  const results = e.artifacts.filter(a => a.kind === "eval_result").map(a => a.document.value);
  assert.equal(results.length, 2);
  const [candidate, final] = results;
  assert.notEqual(candidate!.resultHash, final!.resultHash);
  assert.deepEqual(final, { ...candidate, resultHash: final!.resultHash, status: "blocked",
    blockerCodes: ["EVAL_CANCEL_REQUESTED", "EVAL_RUN_IDENTITY_INVALIDATED"] });
  assert.equal(proveManualOrphanRetirementV1(parseManualOrphanEvidenceV1(freeze(e))).status, "eligible");
});

test("expired admitted slots remain eligible when every consumed run has canonical terminal closure", () => {
  const e = fresh();
  assert.ok(e.database.slots.every(s => s.admissionRows[0]!.expired));
  assert.equal(proveManualOrphanRetirementV1(e).status, "eligible");
});

test("request parser retains only the six CAS assertions and requires exact revision6", () => {
  const request = fresh().request;
  assert.deepEqual(parseManualOrphanRequestV1(request), request);
  for (const key of Object.keys(request)) {
    const missing = { ...request }; Reflect.deleteProperty(missing, key);
    assert.throws(() => parseManualOrphanRequestV1(missing), key);
  }
  for (const key of ["force", "ignore", "root", "sql", "authority", "evidence", "authenticated"]) {
    assert.throws(() => parseManualOrphanRequestV1({ ...request, [key]: true }));
  }
  for (const expectedRevision of [5, 7, 6.5, "6", null]) assert.throws(() => parseManualOrphanRequestV1({ ...request, expectedRevision }));
});

test("derivation refuses stale/nonactive records and preserves original record shape", () => {
  const { priorRecord } = makeSyntheticManualOrphanEvidenceV1();
  for (const reservation of [{ ...priorRecord.reservation, revision: 5 }, { ...priorRecord.reservation, revision: 7 },
    { ...priorRecord.reservation, phase: "released" as const }, { ...priorRecord.reservation, phase: "ownership_unknown" as const }]) {
    assert.throws(() => deriveManualOrphanReleasedRecordV1({ ...priorRecord, reservation }), /MANUAL_ORPHAN_CAS/);
  }
});

const ACTIVITY = ["active_runs", "open_claims", "active_attempts", "active_attempt_binding_conflicts", "active_runtimes", "active_runtime_completions", "active_completion_effects", "active_recovery_cases", "active_recovery_deliveries", "active_termination_requests", "active_compilations", "active_publications", "active_publication_batches", "active_outbox", "active_operational_deliveries", "active_owner_reservations"] as const;

test("all sixteen independent activity counters are required exact safe counts and must be zero", () => {
  assert.deepEqual(Object.keys(fresh().database.activityRows[0]!).sort(), [...ACTIVITY].sort());
  for (const field of ACTIVITY) {
    for (const value of [undefined, -1, 0.5, "0", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1]) {
      const e = fresh(), activity = e.database.activityRows[0]!;
      if (value === undefined) Reflect.deleteProperty(activity, field); else Reflect.set(activity, field, value);
      refuse(e, value === 1 ? "ACTIVITY" : "MALFORMED");
    }
  }
  const extra = fresh(); Reflect.set(extra.database.activityRows[0]!, "idle", true); refuse(extra, "MALFORMED");
  for (const count of [0, 2]) { const e = fresh(); e.database.activityRows = count === 0 ? [] : [e.database.activityRows[0]!, structuredClone(e.database.activityRows[0]!)]; refuse(e, "ACTIVITY"); }
});
