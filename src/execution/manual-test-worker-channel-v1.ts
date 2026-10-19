import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import { ControlPrivateIntentV1Schema, ControlWorkerCustodyV1Schema, hashControlSelectionIdentityV1, type ControlPrivateIntentV1, type ControlWorkerCustodyV1, type ControlJobReceiptV1, } from "./schemas/manual-control-job-v1.js";
import { ControlWorkerFatalErrorV1, WorkerChannelEnvelopeV1Schema, ObservedControlWorkerOwnerV1Schema, hashWorkerChannelFrameV1, signWorkerChannelFrameV1, verifyWorkerChannelFrameV1, type ObservedControlWorkerOwnerV1, type WorkerChannelBindingV1, type WorkerChannelBodyV1, type WorkerChannelEnvelopeV1, } from "./schemas/manual-control-worker-channel-v1.js";
type PrivatePin = {
    locator: string;
    stat: fs.BigIntStats;
    bytes: Buffer;
    parents: Array<{
        locator: string;
        stat: fs.BigIntStats;
    }>;
};
function fail(): never { throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID"); }
function same(a: fs.BigIntStats, b: fs.BigIntStats, file = false): boolean {
    return a.dev === b.dev && a.ino === b.ino && a.uid === b.uid && a.mode === b.mode && (!file || (a.nlink === b.nlink && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs));
}
function pinIntent(locator: string, root: string): PrivatePin {
    const parents: PrivatePin["parents"] = [];
    for (let cursor = path.dirname(locator);; cursor = path.dirname(cursor)) {
        const stat = fs.lstatSync(cursor, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== BigInt(process.getuid!()) || Number(stat.mode & 511n) !== 0o700 || fs.realpathSync(cursor) !== cursor)
            fail();
        parents.push({ locator: cursor, stat });
        if (cursor === root)
            break;
        if (cursor === path.dirname(cursor))
            fail();
    }
    const before = fs.lstatSync(locator, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.uid !== BigInt(process.getuid!()) || Number(before.mode & 511n) !== 0o600 || before.size > 32768n)
        fail();
    const fd = fs.openSync(locator, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        if (!same(before, fs.fstatSync(fd, { bigint: true }), true))
            fail();
        const buffer = Buffer.alloc(32769);
        let length = 0;
        while (length < buffer.length) {
            const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
            if (count === 0) break;
            length += count;
        }
        const bytes = buffer.subarray(0, length);
        if (bytes.length > 32768 || !same(before, fs.fstatSync(fd, { bigint: true }), true) || !same(before, fs.lstatSync(locator, { bigint: true }), true))
            fail();
        for (const p of parents)
            if (!same(p.stat, fs.lstatSync(p.locator, { bigint: true })))
                fail();
        return { locator, stat: before, bytes, parents };
    }
    finally {
        fs.closeSync(fd);
    }
}
function assertPin(pin: PrivatePin, root: string): void {
    const current = pinIntent(pin.locator, root);
    if (!same(pin.stat, current.stat, true) || !pin.bytes.equals(current.bytes))
        fail();
    for (const p of pin.parents)
        if (!same(p.stat, fs.lstatSync(p.locator, { bigint: true })))
            fail();
}
function observeOwner(script: string, deadline = Date.now() + 10000): ObservedControlWorkerOwnerV1 {
    const executable = fs.realpathSync(process.execPath);
    const read = (args: string[]) => {
        const timeout = Math.min(5000, deadline - Date.now());
        if (timeout <= 0) throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_UNAVAILABLE");
        const ps = spawnSync("/bin/ps", args, { shell: false, encoding: "utf8", timeout, maxBuffer: 4 * 1024 * 1024, env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdio: ["ignore", "pipe", "pipe"] });
        if (ps.error || ps.signal || ps.status !== 0 || ps.stderr !== "")
            fail();
        return ps.stdout;
    };
    const args = ["-ww", "-p", String(process.pid), "-o", "lstart=", "-o", "pgid=", "-o", "args="];
    const output = read(args), command = read(["-ww", "-p", String(process.pid), "-o", "comm="]);
    if (read(args) !== output)
        fail();
    const row = /^\s*(\w{3} \w{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\s+(\d+)\s+([^\r\n]+)\n?$/.exec(output);
    const fullExecutable = /^(\S+)\n?$/.exec(command);
    if (!row || !fullExecutable || fs.realpathSync(fullExecutable[1]!) !== executable || row[3] !== `${executable} ${script} --job-id ${process.argv[3]}`)
        fail();
    return ObservedControlWorkerOwnerV1Schema.parse({ pid: process.pid, processStartedAt: new Date(`${row[1]} UTC`).toISOString(), processGroupId: Number(row[2]), source: "observed_os", executable, script, commandHash: createHash("sha256").update(row[3]).digest("hex") });
}
type Channel = Readonly<{
    intent: ControlPrivateIntentV1;
    custody: ControlWorkerCustodyV1;
    intentHash: string;
    owner: ObservedControlWorkerOwnerV1;
    assertUnchanged(): void;
    cancellation(): Readonly<{
        requestId: string | null;
        unavailable: boolean;
    }> | null;
    send(body: WorkerChannelBodyV1): Promise<ControlJobReceiptV1>;
}>;
let session: Channel | null = null;
let attempted = false;
export function selectedManualWorkerChannelV1(): Channel {
    if (!session)
        throw new ControlWorkerFatalErrorV1("CONTROL_CUSTODY_UNCERTAIN");
    session.assertUnchanged();
    return session;
}
export async function acceptSelectedManualWorkerChannelV1(): Promise<Readonly<{
    intent: ControlPrivateIntentV1;
    custody: ControlWorkerCustodyV1;
}>> {
    if (attempted)
        fail();
    attempted = true;
    const startupDeadline = Date.now() + 10000;
    function freezePrivate<T>(value: T): T {
        if (value && typeof value === "object") {
            for (const child of Object.values(value))
                freezePrivate(child);
            Object.freeze(value);
        }
        return value;
    }
    // Refuse source/loader/shell ingress before even loading selection observations.
    if (!fileURLToPath(import.meta.url).endsWith(".js") || process.execArgv.length !== 0 || process.argv.length !== 4 || process.argv[2] !== "--job-id" || process.env.NODE_OPTIONS || !process.connected || typeof process.send !== "function")
        fail();
    const { freshInstallationSelectionV1: selected, assertFreshInstallationSelectionUnchangedV1 } = await import("../installation/fresh-installation-selection-v1.js");
    if (!selected?.activation?.acknowledged || !selected.activation.activatedPin)
        fail();
    const script = path.join(selected.paths.repository, "dist/cli/control-test-worker-v1.js");
    if (fileURLToPath(import.meta.url) !== path.join(selected.paths.repository, "dist/execution/manual-test-worker-channel-v1.js") || process.argv[1] !== script || fs.realpathSync(script) !== script || /\s/.test(script))
        fail();
    const jobId = ControlWorkerCustodyV1Schema.shape.jobId.parse(process.argv[3]);
    const pin = pinIntent(path.join(selected.paths.root, "mission-control/controls/jobs", jobId, "intent.json"), selected.directory);
    const intent = freezePrivate(ControlPrivateIntentV1Schema.parse(JSON.parse(pin.bytes.toString("utf8"))));
    const intentHash = createHash("sha256").update(pin.bytes).digest("hex");
    const selectionHash = hashControlSelectionIdentityV1({ schema: "setfarm.manual-control-selection.v1", installationId: selected.state.origin.installationId, sourceSha: selected.state.origin.sourceSha, installationDir: selected.directory, releaseDir: selected.paths.repository, catalogHash: selected.catalogHash, activationPreparedHash: selected.activation.preparedPin.sha256, activationAcknowledgedHash: selected.activation.activatedPin.sha256 });
    if (intent.receipt.kind === "ui_regression" || intent.receipt.jobId !== jobId || intent.installationDir !== selected.directory || intent.releaseDir !== selected.paths.repository || intent.receipt.selectionHash !== selectionHash || intent.receipt.sourceSha !== selected.state.origin.sourceSha)
        fail();
    const owner = Object.freeze(observeOwner(script, startupDeadline));
    if (Date.now() >= startupDeadline) throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_UNAVAILABLE");
    const assertUnchanged = () => {
        assertFreshInstallationSelectionUnchangedV1();
        selected.assertUnchanged();
        assertPin(pin, selected.directory);
        if (JSON.stringify(observeOwner(script, session === null ? startupDeadline : undefined)) !== JSON.stringify(owner))
            fail();
    };
    let binding: WorkerChannelBindingV1 | null = null, custody: ControlWorkerCustodyV1 | null = null;
    let brokerSequence = 0, workerSequence = 0, lastReceiptRevision = intent.receipt.revision;
    let lastReceipt = intent.receipt;
    let cancellation: Readonly<{
        requestId: string | null;
        unavailable: boolean;
    }> | null = null;
    let unavailable = false;
    let outstanding: {
        frame: WorkerChannelEnvelopeV1;
        resolve: (r: ControlJobReceiptV1) => void;
        reject: (e: Error) => void;
    } | null = null;
    let receiveCustody!: (value: ControlWorkerCustodyV1) => void;
    let rejectCustody!: (error: Error) => void;
    const custodyPromise = new Promise<ControlWorkerCustodyV1>((resolve, reject) => { receiveCustody = resolve; rejectCustody = reject; });
    const markUnavailable = () => {
        unavailable = true;
        cancellation = { requestId: cancellation?.requestId ?? null, unavailable: true };
        const error = new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_UNAVAILABLE");
        rejectCustody(error);
        outstanding?.reject(error);
    };
    const onMessage = (raw: unknown) => {
        try {
            if (unavailable)
                return;
            if (Buffer.byteLength(JSON.stringify(raw)) > 16384)
                fail();
            if (!custody) {
                const initial = WorkerChannelEnvelopeV1Schema.parse(raw);
                if (initial.body.type !== "custody" || initial.sequence !== 1)
                    fail();
                const candidate = Object.freeze(initial.body.custody);
                if (candidate.jobId !== jobId || candidate.selectionHash !== selectionHash || candidate.sourceSha !== intent.receipt.sourceSha || candidate.mcBuildHash !== intent.receipt.mcBuildHash || !timingSafeEqual(Buffer.from(intent.nonceDigest, "hex"), createHash("sha256").update(candidate.nonce).digest()))
                    fail();
                binding = { jobId, channelId: initial.channelId, intentHash, kind: intent.receipt.kind };
                verifyWorkerChannelFrameV1({ frame: raw, binding, direction: "broker_to_worker", nonce: candidate.nonce });
                custody = candidate;
                brokerSequence = 1;
                receiveCustody(candidate);
                return;
            }
            const frame = verifyWorkerChannelFrameV1({ frame: raw, binding: binding!, direction: "broker_to_worker", nonce: custody.nonce });
            if (frame.sequence !== brokerSequence + 1)
                fail();
            brokerSequence = frame.sequence;
            if (frame.body.type === "cancel") {
                if (cancellation && cancellation.requestId !== frame.body.requestId)
                    fail();
                if (frame.body.acceptedReceiptRevision <= lastReceiptRevision)
                    fail();
                cancellation = { requestId: frame.body.requestId, unavailable: false };
                lastReceiptRevision = frame.body.acceptedReceiptRevision;
                return;
            }
            if (frame.body.type !== "ack" || !outstanding)
                fail();
            const ack = frame.body;
            if (ack.workerSequence !== outstanding.frame.sequence || ack.workerFrameHash !== hashWorkerChannelFrameV1(outstanding.frame) || ack.receiptRevision <= lastReceiptRevision)
                fail();
            const receipt = ack.receipt, initial = intent.receipt;
            for (const key of ["jobId", "kind", "selectionHash", "sourceSha", "mcSourceSha", "mcBuildHash", "suiteHash", "requestedAt", "plannedCases"] as const)
                if (receipt[key] !== initial[key])
                    fail();
            if ((cancellation || lastReceipt.cancelRequested) && !receipt.cancelRequested)
                fail();
            const acceptedBody = outstanding.frame.body;
            if (receipt.updatedAt < lastReceipt.updatedAt || receipt.updatedAt < receipt.requestedAt ||
                (receipt.startedAt !== null && (receipt.startedAt < receipt.requestedAt || receipt.startedAt > receipt.updatedAt)) ||
                (lastReceipt.startedAt !== null && receipt.startedAt !== lastReceipt.startedAt))
                fail();
            if (acceptedBody.type !== "final_closed" && (receipt.finishedAt !== null || Object.keys(receipt.reportRefs).length !== 0))
                fail();
            if (acceptedBody.type === "final_closed") {
                if (receipt.finishedAt === null || receipt.finishedAt < (receipt.startedAt ?? receipt.requestedAt) || receipt.finishedAt > receipt.updatedAt || receipt.startedAt !== lastReceipt.startedAt || receipt.state !== acceptedBody.outcome || receipt.code !== acceptedBody.code || receipt.phase !== "closed" || receipt.currentCaseId !== null || receipt.ownedRunId !== null || receipt.completedCases !== acceptedBody.completedCases)
                    fail();
                for (const key of ["activationHash", "resultHash", "gateHash", "uiReportHash"] as const)
                    if (receipt.reportRefs[key] !== acceptedBody.reportRefs[key])
                        fail();
            }
            else if (acceptedBody.type === "progress") {
                if (receipt.state !== (receipt.cancelRequested ? "cancelling" : "running") || (acceptedBody.phase === "acquired" ? receipt.startedAt === null : receipt.startedAt !== lastReceipt.startedAt) || receipt.code !== acceptedBody.code || receipt.phase !== acceptedBody.phase || receipt.completedCases !== acceptedBody.completedCases || receipt.currentCaseId !== acceptedBody.currentCaseId || receipt.ownedRunId !== acceptedBody.ownedRunId)
                    fail();
            }
            else if (acceptedBody.type === "ready") {
                if (receipt.state !== (receipt.cancelRequested ? "cancelling" : "starting") || receipt.startedAt !== null || receipt.phase !== "starting" || receipt.completedCases !== 0 || receipt.currentCaseId !== null || receipt.ownedRunId !== null)
                    fail();
            }
            else if (acceptedBody.type === "cancel_observed") {
                if (!receipt.cancelRequested || receipt.state !== "cancelling" || receipt.code !== (acceptedBody.effective === "after_boundary" ? "CONTROL_CANCEL_TOO_LATE" : "CONTROL_CANCEL_REQUESTED") || receipt.phase !== lastReceipt.phase || receipt.startedAt !== lastReceipt.startedAt || receipt.completedCases !== lastReceipt.completedCases || receipt.currentCaseId !== lastReceipt.currentCaseId || receipt.ownedRunId !== lastReceipt.ownedRunId)
                    fail();
            }
            else if (acceptedBody.type === "fault") {
                if (receipt.state !== "ownership_unknown" || receipt.phase !== "ownership_unknown" || receipt.code !== acceptedBody.code || receipt.startedAt !== lastReceipt.startedAt || receipt.completedCases !== lastReceipt.completedCases || receipt.currentCaseId !== lastReceipt.currentCaseId || receipt.ownedRunId !== lastReceipt.ownedRunId)
                    fail();
            }
            lastReceiptRevision = ack.receiptRevision;
            lastReceipt = freezePrivate(receipt);
            outstanding.resolve(receipt);
            outstanding = null;
        }
        catch {
            markUnavailable();
        }
    };
    process.on("message", onMessage);
    process.on("disconnect", markUnavailable);
    const startupTimer = setTimeout(markUnavailable, Math.max(1, startupDeadline - Date.now()));
    try {
        const accepted = await custodyPromise;
        const send = async (body: WorkerChannelBodyV1): Promise<ControlJobReceiptV1> => {
            assertUnchanged();
            if (unavailable || !process.connected)
                throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_UNAVAILABLE");
            if (outstanding)
                throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID");
            const frame = signWorkerChannelFrameV1({ binding: binding!, direction: "worker_to_broker", sequence: ++workerSequence, body, nonce: accepted.nonce });
            const acknowledgement = new Promise<ControlJobReceiptV1>((resolve, reject) => { outstanding = { frame, resolve, reject }; });
            const transmit = () => process.send!(frame, error => { if (error)
                markUnavailable(); });
            let retry = false;
            const deadline = setInterval(() => { if (!retry) {
                retry = true;
                transmit();
            }
            else
                markUnavailable(); }, 30000);
            try {
                transmit();
                return await acknowledgement;
            }
            finally {
                clearInterval(deadline);
                outstanding = null;
            }
        };
        await send({ type: "ready", owner, journal: null });
        assertUnchanged();
        if (Date.now() >= startupDeadline) throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_UNAVAILABLE");
        session = Object.freeze({ intent, custody: accepted, intentHash, owner, assertUnchanged, cancellation: () => cancellation, send });
        return Object.freeze({ intent, custody: accepted });
    }
    finally {
        clearTimeout(startupTimer);
    }
}
