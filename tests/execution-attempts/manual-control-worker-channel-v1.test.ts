import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { signWorkerChannelFrameV1, verifyWorkerChannelFrameV1, hashWorkerChannelFrameV1, serializeWorkerJournalRecordV1, parseWorkerJournalRecordV1, hashWorkerJournalRecordV1, WorkerJournalRecordV1Schema, ControlWorkerFatalErrorV1, isControlWorkerFatalErrorV1, } from "../../src/execution/schemas/manual-control-worker-channel-v1.js";
const nonce = "a".repeat(32);
const binding = { jobId: "11111111-1111-4111-8111-111111111111", channelId: "22222222-2222-4222-8222-222222222222", intentHash: "b".repeat(64), kind: "convergence_full8" as const };
const owner = { pid: 123, processStartedAt: "2026-10-19T00:00:00.000Z", processGroupId: 123, source: "observed_os" as const, executable: "/usr/bin/node", script: "/release/dist/cli/control-test-worker-v1.js", commandHash: "c".repeat(64) };
test("authenticates canonical frames with direction and kind binding", () => {
    const body = { type: "ready" as const, owner, journal: null };
    const frame = signWorkerChannelFrameV1({ binding, direction: "worker_to_broker", sequence: 1, body, nonce });
    assert.deepEqual(verifyWorkerChannelFrameV1({ frame, binding, direction: "worker_to_broker", nonce }), frame);
    const canonical = (v: any): string => v && typeof v === "object" ? Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v);
    const { mac, ...payload } = frame;
    assert.equal(mac, createHmac("sha256", nonce).update(canonical(payload)).digest("hex"));
    assert.equal(hashWorkerChannelFrameV1(frame), createHash("sha256").update(canonical(frame)).digest("hex"));
    for (const changed of [{ ...frame, sequence: 2 }, { ...frame, extra: true }, { ...frame, mac: "0".repeat(64) }, { ...frame, body: { ...body, journal: { revision: 1, hash: binding.intentHash } } }]) {
        assert.throws(() => verifyWorkerChannelFrameV1({ frame: changed, binding, direction: "worker_to_broker", nonce }), ControlWorkerFatalErrorV1);
    }
    assert.throws(() => verifyWorkerChannelFrameV1({ frame, binding, direction: "broker_to_worker", nonce }), ControlWorkerFatalErrorV1);
    assert.throws(() => verifyWorkerChannelFrameV1({ frame, binding: { ...binding, kind: "ui_regression" }, direction: "worker_to_broker", nonce }), ControlWorkerFatalErrorV1);
    assert.throws(() => signWorkerChannelFrameV1({ binding, direction: "worker_to_broker", sequence: 0, body, nonce }));
    assert.throws(() => verifyWorkerChannelFrameV1({ frame: { ...frame, padding: "x".repeat(16384) }, binding, direction: "worker_to_broker", nonce }), ControlWorkerFatalErrorV1);
});
test("journal bytes are canonical newline terminated and begin only with acquisition", () => {
    const record = WorkerJournalRecordV1Schema.parse({ schema: "setfarm.manual-control-journal-record.v1", jobId: binding.jobId, intentHash: binding.intentHash, ownerHash: "c".repeat(64), revision: 1, previousHash: null, event: { type: "acquired", kind: "convergence_full8", selectionHash: "d".repeat(64), sourceSha: "e".repeat(40), suiteHash: "f".repeat(64), executionMode: "execute", owner, origin: "mission_control", reservationRevision: 1 } });
    const bytes = serializeWorkerJournalRecordV1(record);
    assert.equal(Buffer.from(bytes).at(-1), 10);
    assert.deepEqual(parseWorkerJournalRecordV1(bytes), record);
    assert.equal(hashWorkerJournalRecordV1(record), createHash("sha256").update(bytes).digest("hex"));
    assert.throws(() => parseWorkerJournalRecordV1(Buffer.from(JSON.stringify(record))));
    assert.throws(() => parseWorkerJournalRecordV1(Buffer.from(JSON.stringify(record, null, 2) + "\n")));
    assert.throws(() => WorkerJournalRecordV1Schema.parse({ ...record, event: { type: "released", heldRevision: 1 } }));
    assert.throws(() => WorkerJournalRecordV1Schema.parse({ ...record, revision: 2 }));
});
test("fatal brand cannot be forged from provider output or serialized errors", () => {
    const error = new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
    assert.equal(isControlWorkerFatalErrorV1(error), true);
    assert.equal(isControlWorkerFatalErrorV1({ code: error.code }), false);
    assert.equal(isControlWorkerFatalErrorV1(Object.create(ControlWorkerFatalErrorV1.prototype)), false);
    assert.equal(isControlWorkerFatalErrorV1(new Error(error.message)), false);
});
// Runtime sequencing component: only immutable selection/intent/OS observations
// and the original process IPC handle are substituted. No operational entry,
// admission, SQL, evaluator or positive compiled-authority claim is involved.
async function transportComponent(elapsedBeforeHandshake = 0) {
    const fs = await import("node:fs");
    const ts = await import("typescript");
    const { EventEmitter } = await import("node:events");
    const pure = await import("../../src/execution/schemas/manual-control-worker-channel-v1.js");
    const publicSchema = await import("../../src/execution/schemas/manual-control-job-v1.js");
    const locator = "src/execution/manual-test-worker-channel-v1.ts", source = fs.readFileSync(locator, "utf8"), tree = ts.createSourceFile(locator, source, ts.ScriptTarget.ES2022, true);
    const names = ["selectedManualWorkerChannelV1", "acceptSelectedManualWorkerChannelV1"];
    const statements = tree.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text ?? ""));
    assert.equal(statements.length, 2);
    const compiled = ts.transpileModule("let session=null;let attempted=false;\n" + statements.map(n => n.getText(tree)).join("\n"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
        .replaceAll("export ", "")
        .replace('await import("../installation/fresh-installation-selection-v1.js")', "selectionFixture")
        .replaceAll("import.meta.url", JSON.stringify("file:///fixture/dist/execution/manual-test-worker-channel-v1.js"))
        .replace(/export\s*\{\};?/, "");
    const identity = { schema: "setfarm.manual-control-selection.v1" as const, installationId: binding.jobId, sourceSha: "c".repeat(40), installationDir: "/fixture-installation", releaseDir: "/fixture", catalogHash: "d".repeat(64), activationPreparedHash: "e".repeat(64), activationAcknowledgedHash: "f".repeat(64) };
    const receipt = { schema: "mission-control.control-job.v1" as const, jobId: binding.jobId, kind: "convergence_full8" as const, revision: 1, selectionHash: publicSchema.hashControlSelectionIdentityV1(identity), sourceSha: identity.sourceSha, mcSourceSha: "d".repeat(40), mcBuildHash: "e".repeat(64), suiteHash: "f".repeat(64), state: "accepted" as const, requestedAt: "2026-10-19T00:00:00.000Z", startedAt: null, updatedAt: "2026-10-19T00:00:00.000Z", finishedAt: null, phase: "accepted", code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 8, reportRefs: {}, cancelRequested: false };
    const intent = publicSchema.ControlPrivateIntentV1Schema.parse({ schema: "mission-control.control-intent.v1", receipt, installationDir: identity.installationDir, releaseDir: identity.releaseDir, nonceDigest: createHash("sha256").update(nonce).digest("hex"), fixedSuiteRelativePath: "evals/suites/product-convergence-codex-v1.json" });
    const bytes = Buffer.from(JSON.stringify(intent) + "\n"), actualBinding = { ...binding, intentHash: createHash("sha256").update(bytes).digest("hex") };
    const custody = { schema: "mission-control.control-custody.v1" as const, jobId: binding.jobId, selectionHash: receipt.selectionHash, sourceSha: receipt.sourceSha, mcBuildHash: receipt.mcBuildHash, nonce };
    const selected = Object.freeze({ directory: identity.installationDir, paths: Object.freeze({ repository: identity.releaseDir, root: "/fixture-installation/runtime" }), state: Object.freeze({ origin: Object.freeze({ installationId: identity.installationId, sourceSha: identity.sourceSha }) }), catalogHash: identity.catalogHash, activation: Object.freeze({ acknowledged: true, preparedPin: Object.freeze({ sha256: identity.activationPreparedHash }), activatedPin: Object.freeze({ sha256: identity.activationAcknowledgedHash }) }), assertUnchanged() { } });
    const processPort = Object.assign(new EventEmitter(), { execArgv: [], argv: ["/usr/bin/node", "/fixture/dist/cli/control-test-worker-v1.js", "--job-id", binding.jobId], env: {}, connected: true, send: null as any });
    const sent: any[] = [];
    processPort.send = (frame: any, callback: (error?: Error) => void) => { sent.push(frame); queueMicrotask(() => callback()); };
    const timeouts = new Map<number, () => void>(), intervals = new Map<number, () => void>();
    let timer = 0;
    let clockNow = 0;
    const observations = { intentChanged: false, selectionChanged: false, owner: { ...owner } };
    const deps = { Date: { now: () => clockNow }, ...pure, ...publicSchema, process: processPort, fs: { realpathSync: (v: string) => v }, path: await import("node:path"), fileURLToPath: () => "/fixture/dist/execution/manual-test-worker-channel-v1.js", createHash, timingSafeEqual: (await import("node:crypto")).timingSafeEqual, pinIntent: () => Object.freeze({ bytes }), assertPin: () => { if (observations.intentChanged) throw new pure.ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID"); }, observeOwner: () => { clockNow = elapsedBeforeHandshake; return Object.freeze({ ...observations.owner }); }, fail: () => { throw new pure.ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID"); }, selectionFixture: Object.freeze({ freshInstallationSelectionV1: selected, assertFreshInstallationSelectionUnchangedV1() { if (observations.selectionChanged) throw new pure.ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID"); } }), setTimeout: (fn: () => void) => { timeouts.set(++timer, fn); return timer; }, clearTimeout: (id: number) => timeouts.delete(id), setInterval: (fn: () => void) => { intervals.set(++timer, fn); return timer; }, clearInterval: (id: number) => intervals.delete(id) };
    const api = new Function(...Object.keys(deps), compiled + ";return {acceptSelectedManualWorkerChannelV1,selectedManualWorkerChannelV1};")(...Object.values(deps));
    let brokerSequence = 0;
    const deliver = (body: any) => processPort.emit("message", pure.signWorkerChannelFrameV1({ binding: actualBinding, direction: "broker_to_worker", sequence: ++brokerSequence, body, nonce }));
    const ack = (frame: any, patch: any = {}) => deliver({ type: "ack", workerSequence: frame.sequence, workerFrameHash: pure.hashWorkerChannelFrameV1(frame), receiptRevision: patch.revision ?? 2, receipt: { ...receipt, state: "starting", phase: "starting", revision: 2, ...patch } });
    const accept = api.acceptSelectedManualWorkerChannelV1();
    const refusal = elapsedBeforeHandshake > 0 ? assert.rejects(accept, /CONTROL_CHANNEL_UNAVAILABLE/) : null;
    await new Promise(resolve => setImmediate(resolve));
    deliver({ type: "custody", custody });
    await new Promise(resolve => setImmediate(resolve));
    if (refusal) {
        if (sent[0]) ack(sent[0]);
        await refusal;
        assert.equal(sent.length, 0);
    } else assert.equal(sent[0]?.body.type, "ready");
    return { api, accept, sent, deliver, ack, timeouts, intervals, processPort, receipt, binding: actualBinding, observations };
}
test("original channel latches cancel while progress awaits durable ACK", async () => {
    const h = await transportComponent();
    h.ack(h.sent[0]);
    await h.accept;
    const channel = h.api.selectedManualWorkerChannelV1();
    const pending = channel.send({ type: "progress", journal: { revision: 1, hash: "a".repeat(64) }, phase: "acquired", currentCaseId: null, ownedRunId: null, completedCases: 0, code: null });
    h.deliver({ type: "cancel", requestId: "33333333-3333-4333-8333-333333333333", acceptedReceiptRevision: 3 });
    assert.deepEqual(channel.cancellation(), { requestId: "33333333-3333-4333-8333-333333333333", unavailable: false });
    h.ack(h.sent[1], { revision: 4, state: "cancelling", phase: "acquired", startedAt: "2026-10-19T00:01:00.000Z", updatedAt: "2026-10-19T00:01:00.000Z", cancelRequested: true });
    assert.equal((await pending).revision, 4);
});
test("original channel retransmits identical outstanding bytes then fences on lost ACK", async () => {
    const h = await transportComponent();
    h.ack(h.sent[0]);
    await h.accept;
    const channel = h.api.selectedManualWorkerChannelV1();
    const pending = channel.send({ type: "progress", journal: { revision: 1, hash: "a".repeat(64) }, phase: "acquired", currentCaseId: null, ownedRunId: null, completedCases: 0, code: null });
    const rejection = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    const tick = [...h.intervals.values()][0]!;
    tick();
    assert.deepEqual(h.sent[1], h.sent[2]);
    tick();
    await rejection;
    assert.equal(channel.cancellation().unavailable, true);
});
test("original channel refuses a valid-MAC final ACK with foreign report refs", async () => {
    const h = await transportComponent();
    h.ack(h.sent[0]);
    await h.accept;
    const channel = h.api.selectedManualWorkerChannelV1();
    const pending = channel.send({ type: "final_closed", journal: { revision: 4, hash: "a".repeat(64) }, closureHash: "b".repeat(64), outcome: "completed", code: null, completedCases: 8, reportRefs: { resultHash: "c".repeat(64), gateHash: "d".repeat(64) }, finalization: "promotion_confirmed" });
    const rejection = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    h.ack(h.sent[1], { revision: 3, state: "completed", phase: "closed", completedCases: 8, finishedAt: "2026-10-19T01:00:00.000Z", reportRefs: { resultHash: "f".repeat(64), gateHash: "d".repeat(64) } });
    await rejection;
});
test("accepted private intent and custody remain immutable across worker handoff", async () => {
    const h = await transportComponent();
    h.ack(h.sent[0]);
    const accepted = await h.accept;
    assert.equal(Object.isFrozen(accepted.intent), true);
    assert.equal(Object.isFrozen(accepted.intent.receipt), true);
    assert.equal(Object.isFrozen(accepted.custody), true);
});

test("startup deadline includes selection and synchronous OS observation before ready", async () => {
    await transportComponent(11000);
});

const progressBody = { type: "progress" as const, journal: { revision: 1, hash: "a".repeat(64) }, phase: "acquired" as const, currentCaseId: null, ownedRunId: null, completedCases: 0, code: null };
const finalBody = { type: "final_closed" as const, journal: { revision: 4, hash: "a".repeat(64) }, closureHash: "b".repeat(64), outcome: "completed" as const, code: null, completedCases: 8, reportRefs: { resultHash: "c".repeat(64), gateHash: "d".repeat(64) }, finalization: "promotion_confirmed" as const };
const acquiredAt = "2026-10-19T00:01:00.000Z", finishedAt = "2026-10-19T01:00:00.000Z";
async function acquiredTransport() {
    const h = await transportComponent(); h.ack(h.sent[0]); await h.accept;
    const channel = h.api.selectedManualWorkerChannelV1();
    const pending = channel.send(progressBody);
    h.ack(h.sent.at(-1), { revision: 3, state: "running", phase: "acquired", startedAt: acquiredAt, updatedAt: acquiredAt });
    await pending;
    return { ...h, channel };
}
test("ACK cancellation cannot clear previously acknowledged true before cancel frame", async () => {
    const h = await transportComponent(); h.ack(h.sent[0], { state: "cancelling", cancelRequested: true }); await h.accept;
    const channel = h.api.selectedManualWorkerChannelV1(), pending = channel.send(progressBody);
    const rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    h.ack(h.sent.at(-1), { revision: 3, state: "running", phase: "acquired", startedAt: acquiredAt, updatedAt: acquiredAt, cancelRequested: false });
    await rejected;
});
for (const [name, patch] of Object.entries({ phase: { phase: "case_running" }, case: { currentCaseId: "foreign-case" }, run: { ownedRunId: "foreign-run" }, start: { startedAt: finishedAt }, updated: { updatedAt: "2026-10-18T00:00:00.000Z" }, finish: { finishedAt: "2026-10-19T00:00:00.000Z" } })) test(`final ACK refuses inconsistent ${name} projection`, async () => {
    const h = await acquiredTransport(), pending = h.channel.send(finalBody);
    const rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    h.ack(h.sent.at(-1), { revision: 4, state: "completed", phase: "closed", completedCases: 8, startedAt: acquiredAt, updatedAt: finishedAt, finishedAt, reportRefs: finalBody.reportRefs, ...patch });
    await rejected;
});
test("intent private read caps growth between stat and read", async () => {
    const fs = (await import("node:fs")).default, path = (await import("node:path")).default, ts = await import("typescript");
    const root = fs.realpathSync(fs.mkdtempSync(path.join((await import("node:os")).tmpdir(), "channel-growth-")));
    fs.chmodSync(root, 0o700);
    const file = path.join(root, "intent.json"), cap = 32768;
    fs.writeFileSync(file, "{}\n", { mode: 0o600 });
    let grown = false, bytesRead = 0;
    const port = new Proxy(fs, { get(target, key) {
        if (key === "fstatSync") return (...args: any[]) => { const stat = (fs.fstatSync as any)(...args); if (!grown) { grown = true; fs.appendFileSync(file, Buffer.alloc(cap * 4)); } return stat; };
        if (key === "readFileSync") return (fd: number) => { const bytes = fs.readFileSync(fd); bytesRead += bytes.length; return bytes; };
        if (key === "readSync") return (...args: any[]) => { const count = (fs.readSync as any)(...args); bytesRead += count; return count; };
        return Reflect.get(target, key);
    } });
    try {
        const source = fs.readFileSync("src/execution/manual-test-worker-channel-v1.ts", "utf8"), tree = ts.createSourceFile("channel.ts", source, ts.ScriptTarget.ES2022, true);
        const nodes = tree.statements.filter(n => ts.isFunctionDeclaration(n) && ["same", "fail", "pinIntent"].includes(n.name?.text ?? ""));
        const body = ts.transpileModule(nodes.map(n => n.getText(tree)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
        const pin = new Function("fs", "path", "process", "ControlWorkerFatalErrorV1", body + ";return pinIntent;")(port, path, process, ControlWorkerFatalErrorV1);
        assert.throws(() => pin(file, root), /CONTROL_CHANNEL_INVALID/);
        assert.ok(bytesRead <= cap + 1, `read ${bytesRead} bytes for cap ${cap}`);
        assert.equal(bytesRead, cap + 1);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const [name, patch] of Object.entries({ state: { state: "starting" }, code: { code: "CONTROL_JOB_FAILED" }, start: { startedAt: null } })) test(`acquired progress ACK refuses inconsistent ${name}`, async () => {
    const h = await transportComponent(); h.ack(h.sent[0]); await h.accept;
    const pending = h.api.selectedManualWorkerChannelV1().send(progressBody), rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    h.ack(h.sent.at(-1), { revision: 3, state: "running", phase: "acquired", startedAt: acquiredAt, updatedAt: acquiredAt, ...patch });
    await rejected;
});
for (const kind of ["replay", "gap", "stale_revision", "wrong_frame", "wrong_worker_sequence"] as const) test(`transport fences ${kind} ACK before another effect`, async () => {
    const h = await acquiredTransport(), pending = h.channel.send({ ...progressBody, phase: "preflight" });
    const rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/), sent = h.sent.at(-1);
    const receipt = { ...h.receipt, revision: kind === "stale_revision" ? 3 : 4, state: "running", phase: "preflight", startedAt: acquiredAt, updatedAt: acquiredAt };
    const frame = signWorkerChannelFrameV1({ binding: h.binding, direction: "broker_to_worker", sequence: kind === "replay" ? 3 : kind === "gap" ? 5 : 4, nonce, body: { type: "ack", workerSequence: sent.sequence + (kind === "wrong_worker_sequence" ? 1 : 0), workerFrameHash: kind === "wrong_frame" ? "f".repeat(64) : hashWorkerChannelFrameV1(sent), receiptRevision: receipt.revision, receipt } as any });
    h.processPort.emit("message", frame); await rejected;
    await assert.rejects(() => h.channel.send(progressBody), /CONTROL_CHANNEL_UNAVAILABLE/);
    assert.equal(h.sent.length, 3);
});
for (const committed of [false, true]) test(`lost final ACK preserves ${committed ? "committed" : "uncommitted"} broker observation without worker success`, async () => {
    const h = await acquiredTransport(), pending = h.channel.send(finalBody);
    const rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    // Only an observation of the broker endpoint is modeled here. This does not
    // qualify MC durable storage or an actual compiled parent/child composition.
    const durableBrokerReceipt = committed ? Object.freeze({ ...h.receipt, revision: 4, state: "completed", phase: "closed", completedCases: 8, startedAt: acquiredAt, updatedAt: finishedAt, finishedAt, reportRefs: finalBody.reportRefs }) : null;
    const tick = [...h.intervals.values()][0]!; tick(); tick(); await rejected;
    assert.deepEqual(h.sent.at(-1), h.sent.at(-2));
    assert.equal(durableBrokerReceipt?.state ?? "ownership_unknown", committed ? "completed" : "ownership_unknown");
    assert.deepEqual(durableBrokerReceipt?.reportRefs ?? {}, committed ? finalBody.reportRefs : {});
    assert.equal(h.channel.cancellation().unavailable, true);
});
test("final ACK accepts broker finish time earlier than its ordered revision timestamp", async () => {
    const h = await acquiredTransport(), pending = h.channel.send(finalBody);
    h.ack(h.sent.at(-1), { revision: 4, state: "completed", phase: "closed", completedCases: 8, startedAt: acquiredAt, updatedAt: "2026-10-19T01:00:00.001Z", finishedAt, reportRefs: finalBody.reportRefs });
    assert.equal((await pending).finishedAt, finishedAt);
});

for (const mutation of ["intent", "selection", "pid", "processStartedAt", "processGroupId", "commandHash", "executable", "script"] as const) test(`accepted channel fences changed ${mutation} observations before another frame`, async () => {
    const h = await acquiredTransport();
    if (mutation === "intent") h.observations.intentChanged = true;
    else if (mutation === "selection") h.observations.selectionChanged = true;
    else if (mutation === "pid" || mutation === "processGroupId") h.observations.owner[mutation]++;
    else h.observations.owner[mutation] = mutation === "commandHash" ? "f".repeat(64) : mutation === "processStartedAt" ? finishedAt : "/foreign";
    await assert.rejects(() => h.channel.send(progressBody), /CONTROL_CHANNEL_INVALID/);
    assert.equal(h.sent.length, 2);
});
for (const field of ["code", "phase", "currentCaseId", "ownedRunId", "completedCases", "startedAt"] as const) test(`cancel observation ACK refuses foreign ${field}`, async () => {
    const h = await acquiredTransport();
    const requestId = "33333333-3333-4333-8333-333333333333";
    h.deliver({ type: "cancel", requestId, acceptedReceiptRevision: 4 });
    const pending = h.channel.send({ type: "cancel_observed", requestId, journal: { revision: 2, hash: "a".repeat(64) }, effective: "latched" });
    const rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    const patch = { revision: 5, state: "cancelling", phase: "acquired", code: "CONTROL_CANCEL_REQUESTED", cancelRequested: true, startedAt: acquiredAt, updatedAt: acquiredAt, [field]: field === "completedCases" ? 1 : field === "startedAt" ? null : "foreign" };
    h.ack(h.sent.at(-1), patch); await rejected;
});
test("ACK cannot reuse already observed durable cancellation revision", async () => {
    const h = await acquiredTransport();
    h.deliver({ type: "cancel", requestId: "33333333-3333-4333-8333-333333333333", acceptedReceiptRevision: 4 });
    const pending = h.channel.send({ ...progressBody, phase: "preflight" }), rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    h.ack(h.sent.at(-1), { revision: 4, state: "cancelling", phase: "preflight", cancelRequested: true, startedAt: acquiredAt, updatedAt: acquiredAt });
    await rejected;
});
test("original disconnect immediately rejects pending frame and never reopens channel", async () => {
    const h = await acquiredTransport(), pending = h.channel.send(progressBody), rejected = assert.rejects(pending, /CONTROL_CHANNEL_UNAVAILABLE/);
    h.processPort.connected = false; h.processPort.emit("disconnect"); await rejected;
    h.processPort.connected = true;
    await assert.rejects(() => h.channel.send(progressBody), /CONTROL_CHANNEL_UNAVAILABLE/);
    await assert.rejects(() => h.api.acceptSelectedManualWorkerChannelV1(), /CONTROL_CHANNEL_INVALID/);
    assert.equal(h.sent.length, 3);
});

test("acknowledged receipt retained for continuity cannot be mutated by its consumer", async () => {
    const h = await transportComponent(); h.ack(h.sent[0]); await h.accept;
    const pending = h.api.selectedManualWorkerChannelV1().send(progressBody);
    h.ack(h.sent.at(-1), { revision: 3, state: "cancelling", phase: "acquired", cancelRequested: true, startedAt: acquiredAt, updatedAt: acquiredAt });
    const receipt = await pending;
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(Object.isFrozen(receipt.reportRefs), true);
});
