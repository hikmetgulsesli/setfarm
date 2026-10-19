import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getSql } from "../db-pg.js";
import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { runDefaultActivationPreflight } from "./activation-preflight.js";
import { loadConvergenceSuiteVersioned, type LoadedConvergenceSuiteVersioned } from "../evals/suite-schema-v2.js";
import { createDefaultConvergencePorts, runConvergenceSuite, type ConvergenceRunnerPorts, type ConvergenceJobControlV1, type ConvergenceSuiteRun, type BoundCaseIdentityV1 } from "../evals/convergence-runner.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { selectedManualWorkerChannelV1 } from "./manual-test-worker-channel-v1.js";
import { registerSelectedManualWorkerCustodyV1, prepareSelectedDirectEvaluationIntentV1, acquireSelectedManualEvaluationV1, bindSelectedManualCanaryV1, releaseSelectedManualEvaluationV1, observeSelectedManualSettlementV1, closeSelectedManualWorkerCustodyV1, type ManualEvaluationReservationV1 } from "./manual-test-admission-v1.js";
import { V3ReleaseAdmissionV1Schema, canarySelectorHash, computeCanarySlotHash, type InternalCanaryAdmissionContextV1 } from "./v3-release-admission.js";
import { buildRunOperationalSnapshot } from "../server/run-operational-snapshot.js";
import { executeRunOperationalAction } from "./run-operational-action.js";
import { ControlPrivateIntentV1Schema, ControlWorkerCustodyV1Schema, type ControlPrivateIntentV1, type ControlWorkerCustodyV1, type ControlJobReceiptV1, type ControlReportRefsV1 } from "./schemas/manual-control-job-v1.js";
import { ControlWorkerFatalErrorV1, isControlWorkerFatalErrorV1, hashObservedControlWorkerOwnerV1, serializeWorkerJournalRecordV1, parseWorkerJournalRecordV1, hashWorkerJournalRecordV1, serializeWorkerJournalHeadV1, parseWorkerJournalHeadV1, ObservedControlWorkerOwnerV1Schema, type WorkerJournalEventV1, type WorkerJournalRefV1, type WorkerJournalRecordV1, type ObservedControlWorkerOwnerV1, type WorkerChannelBodyV1, } from "./schemas/manual-control-worker-channel-v1.js";
export type ManualControlEffectPortsV1 = Readonly<{
    runPreflight: typeof runDefaultActivationPreflight;
    loadSuite: typeof loadConvergenceSuiteVersioned;
    createConvergencePorts: typeof createDefaultConvergencePorts;
    stopOwnedRun: (runId: string, expectedSnapshotHash: string) => Promise<void>;
    settlementClock?: Readonly<{ now(): number; sleep(ms: number): Promise<void> }>;
}>;
const defaultEffects: ManualControlEffectPortsV1 = Object.freeze({
    runPreflight: runDefaultActivationPreflight, loadSuite: loadConvergenceSuiteVersioned, createConvergencePorts: createDefaultConvergencePorts,
    stopOwnedRun: async (runId, expectedSnapshotHash) => { await executeRunOperationalAction(getSql(), { action: "stop", runId, expectedSnapshotHash }); },
});
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type FilePin = {
    locator: string;
    stat: fs.BigIntStats;
    bytes: Buffer;
};
type ParentPin = {
    locator: string;
    stat: fs.BigIntStats;
};
function same(a: fs.BigIntStats, b: fs.BigIntStats, file = false): boolean {
    return a.dev === b.dev && a.ino === b.ino && a.uid === b.uid && a.mode === b.mode && (!file || (a.nlink === b.nlink && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs));
}
function parents(directory: string, root: string): ParentPin[] {
    const result: ParentPin[] = [];
    for (let current = directory;; current = path.dirname(current)) {
        const stat = fs.lstatSync(current, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== BigInt(process.getuid!()) || Number(stat.mode & 511n) !== 0o700 || fs.realpathSync(current) !== current)
            throw new Error("unsafe parent");
        result.push({ locator: current, stat });
        if (current === root)
            return result;
        if (current === path.dirname(current))
            throw new Error("outside private root");
    }
}
function checkParents(pins: ParentPin[]): void { for (const pin of pins)
    if (!same(pin.stat, fs.lstatSync(pin.locator, { bigint: true })))
        throw new Error("parent changed"); }
function readPin(locator: string, cap: number): FilePin {
    const stat = fs.lstatSync(locator, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || stat.uid !== BigInt(process.getuid!()) || Number(stat.mode & 511n) !== 0o600 || stat.size > BigInt(cap))
        throw new Error("unsafe file");
    const fd = fs.openSync(locator, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        if (!same(stat, fs.fstatSync(fd, { bigint: true }), true))
            throw new Error("file changed");
        const buffer = Buffer.alloc(cap + 1);
        let length = 0;
        while (length < buffer.length) {
            const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
            if (count === 0) break;
            length += count;
        }
        const bytes = buffer.subarray(0, length);
        if (bytes.length > cap || !same(stat, fs.fstatSync(fd, { bigint: true }), true) || !same(stat, fs.lstatSync(locator, { bigint: true }), true))
            throw new Error("file changed");
        return { locator, stat, bytes };
    }
    finally {
        fs.closeSync(fd);
    }
}
function checkPin(pin: FilePin, cap: number): void { const current = readPin(pin.locator, cap); if (!same(current.stat, pin.stat, true) || !current.bytes.equals(pin.bytes))
    throw new Error("file changed"); }
function syncDirectory(locator: string): void { const fd = fs.openSync(locator, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW); try {
    fs.fsyncSync(fd);
}
finally {
    fs.closeSync(fd);
} }
function exclusive(locator: string, bytes: Uint8Array): FilePin {
    const fd = fs.openSync(locator, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try {
        fs.writeFileSync(fd, bytes);
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
    syncDirectory(path.dirname(locator));
    return readPin(locator, bytes.length);
}
class WorkerJournalV1 {
    private readonly directory: string;
    private readonly pins: ParentPin[];
    private readonly ownerHash: string;
    private head: FilePin | null = null;
    private tail: FilePin | null = null;
    private readonly records: FilePin[] = [];
    private current: WorkerJournalRefV1 | null = null;
    private failed = false;
    constructor(evalRoot: string, private readonly jobId: string, private readonly intentHash: string, owner: ObservedControlWorkerOwnerV1, privateRoot = evalRoot) {
        try {
            // Both directory creation and every append are synchronous under the one
            // uninterrupted custody owner; no asynchronous writer can interleave CAS.
            const rootPins = parents(evalRoot, privateRoot);
            const base = path.join(evalRoot, "manual-control-journals");
            try {
                fs.mkdirSync(base, { mode: 0o700 });
                syncDirectory(evalRoot);
            }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "EEXIST")
                    throw error;
            }
            checkParents(rootPins);
            parents(base, privateRoot);
            this.directory = path.join(base, ControlWorkerCustodyV1Schema.shape.jobId.parse(jobId));
            fs.mkdirSync(this.directory, { mode: 0o700 });
            syncDirectory(base);
            fs.mkdirSync(path.join(this.directory, "records"), { mode: 0o700 });
            syncDirectory(this.directory);
            this.pins = parents(path.join(this.directory, "records"), privateRoot);
            this.ownerHash = hashObservedControlWorkerOwnerV1(owner);
        }
        catch {
            throw new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
        }
    }
    ref(): WorkerJournalRefV1 | null {
        this.validate();
        return this.current;
    }
    private validate(): void {
        try {
            if (this.failed)
                throw new Error("failed journal");
            checkParents(this.pins);
            if (this.head)
                checkPin(this.head, 1024);
            else {
                try {
                    fs.lstatSync(path.join(this.directory, "head.json"));
                    throw new Error("unexpected head");
                }
                catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                        throw error;
                }
            }
            for (const pin of this.records)
                checkPin(pin, 65536);
            if (this.tail) {
                checkPin(this.tail, 65536);
                if (hashWorkerJournalRecordV1(parseWorkerJournalRecordV1(this.tail.bytes)) !== this.current?.hash)
                    throw new Error("tail changed");
            }
            if (this.head) {
                const head = parseWorkerJournalHeadV1(this.head.bytes);
                if (head.jobId !== this.jobId || head.revision !== this.current?.revision || head.recordHash !== this.current?.hash)
                    throw new Error("head changed");
            }
        }
        catch {
            this.failed = true;
            throw new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
        }
    }
    append(event: WorkerJournalEventV1): WorkerJournalRefV1 {
        this.validate();
        try {
            const revision = (this.current?.revision ?? 0) + 1;
            const record: WorkerJournalRecordV1 = { schema: "setfarm.manual-control-journal-record.v1", jobId: this.jobId, intentHash: this.intentHash, ownerHash: this.ownerHash, revision, previousHash: this.current?.hash ?? null, event };
            const bytes = serializeWorkerJournalRecordV1(record), hash = hashWorkerJournalRecordV1(record);
            const tail = exclusive(path.join(this.directory, "records", `${String(revision).padStart(20, "0")}.json`), bytes);
            checkParents(this.pins);
            const next = exclusive(path.join(this.directory, "head.next.json"), serializeWorkerJournalHeadV1({ schema: "setfarm.manual-control-journal-head.v1", jobId: this.jobId, revision, recordHash: hash }));
            this.validate();
            checkPin(next, 1024);
            fs.renameSync(next.locator, path.join(this.directory, "head.json"));
            syncDirectory(this.directory);
            const published = readPin(path.join(this.directory, "head.json"), 1024);
            // Rename may change ctime, but must preserve the exact opened file,
            // its content and all other immutable metadata. Never adopt a new head.
            if (!same(next.stat, published.stat) || next.stat.nlink !== published.stat.nlink || next.stat.size !== published.stat.size || next.stat.mtimeNs !== published.stat.mtimeNs || !next.bytes.equals(published.bytes))
                throw new Error("published head changed");
            this.records.push(tail);
            this.tail = tail;
            this.head = published;
            this.current = Object.freeze({ revision, hash });
            this.validate();
            return this.current;
        }
        catch {
            this.failed = true;
            throw new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
        }
    }
}
function selected() {
    assertFreshInstallationSelectionUnchangedV1();
    const selection = freshInstallationSelectionV1;
    if (!selection?.activation?.acknowledged || !selection.activation.activatedPin)
        throw new ControlWorkerFatalErrorV1("CONTROL_CUSTODY_UNCERTAIN");
    selection.assertUnchanged();
    return selection;
}
function closureHash(jobId: string, intentHash: string, owner: ObservedControlWorkerOwnerV1): string {
    const selection = selected();
    const locator = path.join(selection.paths.root, "evals/manual-controls/closures", `${jobId}.json`);
    const pins = parents(path.dirname(locator), selection.directory), pin = readPin(locator, 32768);
    // Successful Task1 close is the authority. This independent pin/hash is only
    // linkage to that just-published marker, never an alternative close validator.
    const marker = JSON.parse(pin.bytes.toString("utf8"));
    if (marker.jobId !== jobId || marker.intentHash !== intentHash || hashObservedControlWorkerOwnerV1(marker.owner) !== hashObservedControlWorkerOwnerV1(owner))
        throw new ControlWorkerFatalErrorV1("CONTROL_SETTLEMENT_UNCERTAIN");
    checkParents(pins);
    checkPin(pin, 32768);
    return digest(pin.bytes);
}
async function resolveConsumedClaim(context: InternalCanaryAdmissionContextV1, input: {
    sourceSha: string;
    suiteHash: string;
}, expected?: {
    runId: string;
    runNumber: number;
}): Promise<{
    runId: string;
    runNumber: number;
}> {
    try {
        selected();
        return await getSql().begin("isolation level repeatable read read only", async (sql) => {
            const admissions = await sql.unsafe("SELECT payload FROM v3_release_admissions WHERE admission_hash=$1", [context.admissionHash]);
            if (admissions.length !== 1)
                throw new Error("admission missing");
            const admission = V3ReleaseAdmissionV1Schema.parse(admissions[0]!.payload);
            const slot = admission.slots.find(value => value.slotHash === context.slotHash);
            if (admission.kind !== "convergence_canary" || admission.admissionHash !== context.admissionHash || admission.releaseSha !== input.sourceSha || admission.suiteHash !== input.suiteHash || !slot || slot.caseHash !== context.caseHash || slot.taskHash !== context.taskHash || slot.repetition !== context.repetition || slot.selectorHash !== canarySelectorHash(context.slotToken))
                throw new Error("admission mismatch");
            const claims = await sql.unsafe("SELECT admission_hash,admission_kind,case_hash,task_hash,repetition,selector_hash,run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=$1", [context.slotHash]);
            const claim = claims[0];
            if (claims.length !== 1 || !claim || claim.admission_hash !== context.admissionHash || claim.admission_kind !== "convergence_canary" || claim.case_hash !== context.caseHash || claim.task_hash !== context.taskHash || claim.repetition !== context.repetition || claim.selector_hash !== slot.selectorHash || typeof claim.run_id !== "string" || !claim.run_id || claim.consumed_at === null)
                throw new Error("claim mismatch");
            const runs = await sql.unsafe("SELECT id,run_number,protocol,protocol_version,compiler_release_sha,release_admission_hash,task FROM runs WHERE id=$1", [claim.run_id]);
            const run = runs[0];
            if (runs.length !== 1 || !run || run.id !== claim.run_id || !Number.isSafeInteger(run.run_number) || run.run_number <= 0 || run.protocol !== "v3" || run.protocol_version !== 1 || run.compiler_release_sha !== input.sourceSha || run.release_admission_hash !== context.admissionHash || hashCanonicalJson(run.task) !== context.taskHash || (expected && (expected.runId !== run.id || expected.runNumber !== run.run_number)))
                throw new Error("run mismatch");
            selected();
            return { runId: run.id as string, runNumber: run.run_number as number };
        }) as {
            runId: string;
            runNumber: number;
        };
    }
    catch {
        throw new ControlWorkerFatalErrorV1("CONTROL_START_UNRESOLVED");
    }
}
type Channel = ReturnType<typeof selectedManualWorkerChannelV1>;
type JobInput = Pick<ManualEvaluationReservationV1, "jobId" | "kind" | "selectionHash" | "sourceSha" | "suiteHash">;
class WorkerExecutionV1 {
    private cancelled = false;
    private cancellationSource: string | null = null;
    private boundary = false;
    private promoted = false;
    private completed = 0;
    private phase: Parameters<ConvergenceJobControlV1["onPhase"]>[0]["phase"] | "acquired" = "acquired";
    private bound = new Map<string, {
        identity: BoundCaseIdentityV1;
        context: InternalCanaryAdmissionContextV1;
        run: {
            runId: string;
            runNumber: number;
        } | null;
    }>();
    private started = new Set<string>();
    private stopAttempted = new Set<string>();
    private settlementClock = { now: () => performance.now(), sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) };
    readonly control: ConvergenceJobControlV1;
    constructor(private input: JobInput, private reservation: ManualEvaluationReservationV1, private journal: WorkerJournalV1, private effects: ManualControlEffectPortsV1, private channel: Channel | null) {
        if (effects.settlementClock) this.settlementClock = effects.settlementClock;
        this.control = {
            beforeCase: async (identity) => { this.assert(); if (![...this.bound.values()].some(v => hashCanonicalJson(v.identity) === hashCanonicalJson(identity)))
                throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED"); },
            onRunStarted: async (value) => { const bound = this.bound.get(value.slotHash); if (!bound?.run || bound.run.runId !== value.runId || bound.context.admissionHash !== value.admissionHash)
                throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED"); await this.progress(value.caseId, value.runId); },
            onRunResult: async (value) => { const bound = [...this.bound.values()].find(v => v.run?.runId === value.runId); if (!bound || hashCanonicalJson(bound.identity) !== hashCanonicalJson({ caseId: value.caseId, caseHash: value.caseHash, taskHash: value.taskHash, repetition: value.repetition }))
                throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED"); this.journal.append({ type: "run_result_stored", case: { ...bound.identity, repetition: 1 }, runId: value.runId, resultHash: value.resultHash }); this.completed++; },
            cancellationRequested: async () => this.cancel(),
            requestOwnedRunStop: async (value) => this.stop(value),
            onPhase: async (value) => { this.assert(); this.phase = value.phase; if (value.completedCases !== this.completed)
                throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED"); this.journal.append({ type: "phase", ...value } as WorkerJournalEventV1); await this.progress(value.currentCaseId, [...this.bound.values()].find(bound => bound.identity.caseId === value.currentCaseId)?.run?.runId ?? null); },
            onPublication: async (value) => { this.assert(); this.journal.append({ type: "artifacts_stored", ...value }); if (value.stage === "promotion_confirmed")
                this.promoted = true; },
            beforeFinalization: async (value) => { const decision = await this.cancel() ? "cancel" : "continue"; this.assert(); this.journal.append({ type: "finalization_boundary", ...value, decision }); this.boundary = true; return decision; },
        };
    }
    async announceAcquired(): Promise<void> { await this.progress(null, null); }
    private assert(): void { selected(); this.channel?.assertUnchanged(); this.journal.ref(); }
    private async progress(currentCaseId: string | null, ownedRunId: string | null): Promise<void> {
        if (!this.channel || this.channel.cancellation()?.unavailable) {
            await this.cancel();
            return;
        }
        try {
            await this.channel.send({ type: "progress", journal: this.journal.ref(), phase: this.phase, currentCaseId, ownedRunId, completedCases: this.completed, code: null } as WorkerChannelBodyV1);
        }
        catch (error) {
            if (!isControlWorkerFatalErrorV1(error) || error.code !== "CONTROL_CHANNEL_UNAVAILABLE")
                throw error;
            await this.cancel();
        }
    }
    async cancel(): Promise<boolean> {
        this.assert();
        const state = this.channel?.cancellation();
        if (state && this.cancellationSource === null) {
            this.cancellationSource = state.unavailable ? "channel_lost" : "operator";
            this.journal.append({ type: "cancel_latched", source: state.unavailable ? "channel_lost" : "operator", requestId: state.unavailable ? null : state.requestId });
            if (!this.boundary)
                this.cancelled = true;
            if (!state.unavailable && state.requestId) {
                try {
                    await this.channel!.send({ type: "cancel_observed", requestId: state.requestId, journal: this.journal.ref()!, effective: this.boundary ? "after_boundary" : "latched" });
                }
                catch (error) {
                    if (!isControlWorkerFatalErrorV1(error) || error.code !== "CONTROL_CHANNEL_UNAVAILABLE")
                        throw error;
                }
            }
        }
        return this.cancelled;
    }
    wrap(loaded: LoadedConvergenceSuiteVersioned, ports: ConvergenceRunnerPorts): ConvergenceRunnerPorts {
        const create = ports.admissions.createCanary.bind(ports.admissions), start = ports.process.startRun.bind(ports.process);
        let creationAttempted = false, promotionAttempted = false;
        return { ...ports, admissions: { ...ports.admissions, promoteReleaseGo: async (input) => {
                    this.assert();
                    if (promotionAttempted)
                        throw new ControlWorkerFatalErrorV1("CONTROL_PROMOTION_UNCERTAIN");
                    promotionAttempted = true;
                    try {
                        // No await before the canonical promotion call: the runner
                        // has just committed its final cooperative decision.
                        await ports.admissions.promoteReleaseGo(input);
                    }
                    catch {
                        throw new ControlWorkerFatalErrorV1("CONTROL_PROMOTION_UNCERTAIN");
                    }
                }, createCanary: async (input) => {
                    this.assert();
                    if (creationAttempted || await this.cancel())
                        throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED");
                    creationAttempted = true;
                    const slots = input.slots.map(slot => { const item = loaded.suite.cases.find(c => hashCanonicalJson(c) === slot.caseHash && hashCanonicalJson(c.task) === slot.taskHash); if (!item || slot.repetition !== 1)
                        throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED"); return { ...slot, caseId: item.caseId, repetition: 1 as const }; });
                    this.journal.append({ type: "canary_create_requested", ...input, slots } as WorkerJournalEventV1);
                    try {
                        const result = await create(input);
                        if (result.contexts.length !== 8 || new Set(result.contexts.map(v => v.slotHash)).size !== 8)
                            throw new Error("contexts");
                        for (const context of result.contexts) {
                            const slot = slots.find(v => v.caseHash === context.caseHash && v.taskHash === context.taskHash && v.repetition === context.repetition && v.slotToken === context.slotToken);
                            if (!slot)
                                throw new Error("context mismatch");
                            this.bound.set(context.slotHash, { identity: { caseId: slot.caseId, caseHash: slot.caseHash, taskHash: slot.taskHash, repetition: 1 }, context, run: null });
                        }
                        if (new Set(result.contexts.map(v => v.admissionHash)).size !== 1)
                            throw new Error("admission mismatch");
                        await getSql().begin("isolation level repeatable read read only", async (sql) => {
                            const rows = await sql.unsafe("SELECT payload FROM v3_release_admissions WHERE admission_hash=$1", [result.contexts[0]!.admissionHash]);
                            if (rows.length !== 1)
                                throw new Error("admission absent");
                            const admission = V3ReleaseAdmissionV1Schema.parse(rows[0]!.payload);
                            if (admission.kind !== "convergence_canary" || admission.admissionHash !== result.contexts[0]!.admissionHash || admission.releaseSha !== input.releaseSha || admission.suiteHash !== input.suiteHash || admission.preflightHash !== input.preflightHash || admission.slots.length !== 8 || Date.parse(admission.expiresAt) - Date.parse(admission.issuedAt) !== input.ttlMs)
                                throw new Error("stored admission mismatch");
                            for (const context of result.contexts) {
                                const selectorHash = canarySelectorHash(context.slotToken);
                                const slotHash = computeCanarySlotHash({ releaseSha: input.releaseSha, suiteHash: input.suiteHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: context.repetition, selectorHash });
                                if (slotHash !== context.slotHash || !admission.slots.some(slot => slot.slotHash === slotHash && slot.caseHash === context.caseHash && slot.taskHash === context.taskHash && slot.repetition === context.repetition && slot.selectorHash === selectorHash))
                                    throw new Error("stored slot mismatch");
                            }
                        });
                        this.reservation = await bindSelectedManualCanaryV1({ reservation: this.reservation, admissionHash: result.contexts[0]!.admissionHash, slots: result.contexts.map(({ admissionHash, slotHash, caseHash, taskHash, repetition }) => ({ admissionHash, slotHash, caseHash, taskHash, repetition })) });
                        this.journal.append({ type: "canary_bound", contexts: [...this.bound.values()].map(v => ({ caseId: v.identity.caseId, context: v.context })), reservationRevision: this.reservation.revision } as WorkerJournalEventV1);
                        return result;
                    }
                    catch (error) {
                        if (isControlWorkerFatalErrorV1(error))
                            throw error;
                        throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED");
                    }
                } }, process: { ...ports.process, startRun: async (input) => {
                    this.assert();
                    const binding = this.bound.get(input.admission.slotHash);
                    if (input.workflowId !== loaded.suite.workflowId || !binding || binding.run || this.started.has(input.admission.slotHash) || hashCanonicalJson(binding.context) !== hashCanonicalJson(input.admission) || hashCanonicalJson(input.task) !== binding.identity.taskHash)
                        throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED");
                    this.journal.append({ type: "start_requested", case: { ...binding.identity, repetition: 1 }, admissionHash: binding.context.admissionHash, slotHash: binding.context.slotHash });
                    this.started.add(input.admission.slotHash);
                    let response: {
                        runId: string;
                        runNumber: number;
                    } | undefined;
                    try {
                        response = await start({ ...input, startChild: { reservation: this.reservation, journal: this.journal.ref()! } });
                    }
                    catch (error) {
                        if (isControlWorkerFatalErrorV1(error))
                            throw error;
                    }
                    const run = await resolveConsumedClaim(binding.context, { sourceSha: this.input.sourceSha, suiteHash: this.input.suiteHash! }, response);
                    this.journal.append({ type: "run_bound", case: { ...binding.identity, repetition: 1 }, admissionHash: binding.context.admissionHash, slotHash: binding.context.slotHash, ...run, source: response ? "start_response" : "consumed_claim" });
                    binding.run = run;
                    return run;
                } } };
    }
    private async stop(value: BoundCaseIdentityV1 & {
        runId: string;
    }): Promise<"requested" | "already_terminal" | "refused"> {
        this.assert();
        const bound = [...this.bound.values()].find(v => v.run?.runId === value.runId);
        if (!bound || hashCanonicalJson(bound.identity) !== hashCanonicalJson({ caseId: value.caseId, caseHash: value.caseHash, taskHash: value.taskHash, repetition: value.repetition }) || this.stopAttempted.has(value.runId))
            throw new ControlWorkerFatalErrorV1("CONTROL_SETTLEMENT_UNCERTAIN");
        await resolveConsumedClaim(bound.context, { sourceSha: this.input.sourceSha, suiteHash: this.input.suiteHash! }, bound.run!);
        const snapshot = await buildRunOperationalSnapshot(getSql(), value.runId);
        if (!snapshot || snapshot.run.id !== value.runId)
            throw new ControlWorkerFatalErrorV1("CONTROL_SETTLEMENT_UNCERTAIN");
        if (snapshot.summary.lifecycleState === "terminal") {
            this.journal.append({ type: "stop_observed", runId: value.runId, result: "already_terminal", code: null });
            return "already_terminal";
        }
        this.journal.append({ type: "stop_requested", runId: value.runId, snapshotHash: snapshot.snapshotHash });
        this.stopAttempted.add(value.runId);
        try {
            await this.effects.stopOwnedRun(value.runId, snapshot.snapshotHash);
        }
        catch {
            this.journal.append({ type: "stop_observed", runId: value.runId, result: "refused", code: "CONTROL_SETTLEMENT_UNCERTAIN" });
            return "refused";
        }
        this.journal.append({ type: "stop_observed", runId: value.runId, result: "requested", code: null });
        return "requested";
    }
    async finish(refs: ControlReportRefsV1, outcome: "completed" | "blocked" | "cancelled" | "failed", intentHash: string, owner: ObservedControlWorkerOwnerV1): Promise<ControlJobReceiptV1 | null> {
        this.assert();
        this.phase = "settling";
        this.journal.append({ type: "phase", phase: "settling", currentCaseId: null, completedCases: this.completed });
        await this.progress(null, null);
        await this.cancel();
        try {
            const deadline = this.settlementClock.now() + 60_000;
            let ready = false;
            for (let observation = 0; observation < 12; observation++) {
                this.assert(); await this.cancel();
                // Reserve the full transaction bound; never extend the overall deadline.
                if (deadline - this.settlementClock.now() < 5_000) break;
                const state = await observeSelectedManualSettlementV1(this.reservation);
                this.assert();
                if (this.settlementClock.now() >= deadline) break;
                if (state === "ready") { ready = true; break; }
                if (state !== "pending") throw new Error("unknown settlement");
                const delay = Math.min(5_000, deadline - this.settlementClock.now() - 5_000);
                if (delay <= 0) break;
                await this.settlementClock.sleep(delay);
            }
            if (!ready) throw new Error("settlement deadline exceeded");
            await releaseSelectedManualEvaluationV1(this.reservation);
        }
        catch {
            throw new ControlWorkerFatalErrorV1("CONTROL_SETTLEMENT_UNCERTAIN");
        }
        this.journal.append({ type: "released", heldRevision: this.reservation.revision });
        await closeSelectedManualWorkerCustodyV1();
        const hash = closureHash(this.input.jobId, intentHash, owner);
        this.journal.append({ type: "closed", closureHash: hash, outcome, reportRefs: refs });
        if (!this.channel)
            return null;
        return this.channel.send({ type: "final_closed", journal: this.journal.ref(), closureHash: hash, outcome, code: this.boundary && this.channel.cancellation() && !this.cancelled ? "CONTROL_CANCEL_TOO_LATE" : null, completedCases: this.completed, reportRefs: refs, finalization: this.promoted ? "promotion_confirmed" : this.cancelled ? "cancelled_before_boundary" : "no_promotion" });
    }
    finalDecision(): void { this.boundary = true; }
}
function acquiredJournal(input: JobInput, reservation: ManualEvaluationReservationV1, intentHash: string, owner: ObservedControlWorkerOwnerV1, origin: "mission_control" | "direct", executionMode: "preflight" | "execute"): WorkerJournalV1 {
    const selection = selected();
    const journal = new WorkerJournalV1(path.join(selection.paths.root, "evals"), input.jobId, intentHash, owner, selection.directory);
    journal.append({ type: "acquired", kind: input.kind, selectionHash: input.selectionHash, sourceSha: input.sourceSha, suiteHash: input.suiteHash, executionMode, owner, origin, reservationRevision: reservation.revision });
    return journal;
}
async function closeNeverReserved(channel: Channel, outcome: "blocked" | "cancelled"): Promise<ControlJobReceiptV1> {
    await closeSelectedManualWorkerCustodyV1();
    return channel.send({ type: "final_closed", journal: null, closureHash: closureHash(channel.intent.receipt.jobId, channel.intentHash, channel.owner), outcome, code: outcome === "cancelled" ? "CONTROL_CANCEL_REQUESTED" : "CONTROL_JOB_BLOCKED", completedCases: 0, reportRefs: {}, finalization: "never_reserved" });
}
export async function runSelectedManualControlJobV1(rawIntent: ControlPrivateIntentV1, rawCustody: ControlWorkerCustodyV1, effects: ManualControlEffectPortsV1 = defaultEffects): Promise<ControlJobReceiptV1> {
    const channel = selectedManualWorkerChannelV1();
    // Reference identity carries the uninterrupted accepted session. Parsing a
    // copied intent/custody object cannot create an authenticated worker session.
    if (rawIntent !== channel.intent || rawCustody !== channel.custody)
        throw new ControlWorkerFatalErrorV1("CONTROL_CUSTODY_UNCERTAIN");
    const intent = ControlPrivateIntentV1Schema.parse(rawIntent), custody = ControlWorkerCustodyV1Schema.parse(rawCustody);
    const selection = selected();
    if (intent.receipt.kind === "ui_regression")
        throw new ControlWorkerFatalErrorV1("CONTROL_CUSTODY_UNCERTAIN");
    await registerSelectedManualWorkerCustodyV1(custody);
    if (channel.cancellation())
        return closeNeverReserved(channel, "cancelled");
    const input: JobInput = { jobId: intent.receipt.jobId, kind: intent.receipt.kind, selectionHash: intent.receipt.selectionHash, sourceSha: intent.receipt.sourceSha, suiteHash: intent.receipt.suiteHash };
    let reservation: ManualEvaluationReservationV1;
    try {
        reservation = await acquireSelectedManualEvaluationV1(input);
    }
    catch {
        return closeNeverReserved(channel, "blocked");
    }
    const journal = acquiredJournal(input, reservation, channel.intentHash, channel.owner, "mission_control", input.kind === "activation_preflight" ? "preflight" : "execute");
    const execution = new WorkerExecutionV1(input, reservation, journal, effects, channel);
    await execution.announceAcquired();
    let refs: ControlReportRefsV1 = {}, outcome: "completed" | "blocked" | "cancelled" = "completed";
    if (input.kind === "activation_preflight") {
        await execution.control.onPhase({ phase: "preflight", currentCaseId: null, completedCases: 0 });
        if (!await execution.cancel()) {
            const report = await effects.runPreflight({ protocol: "v3", compilerReleaseSha: input.sourceSha });
            if (!report.stored)
                throw new ControlWorkerFatalErrorV1("CONTROL_CUSTODY_UNCERTAIN");
            refs = { activationHash: report.hash };
        }
        if (await execution.cancel())
            outcome = "cancelled";
        execution.finalDecision();
    }
    else {
        const loaded = await effects.loadSuite(path.join(selection.paths.repository, "evals/suites/product-convergence-codex-v1.json"));
        if (loaded.suiteHash !== input.suiteHash)
            throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED");
        const ports = await effects.createConvergencePorts(selection.paths.evals);
        try {
            const result = await runConvergenceSuite(loaded, { releaseSha: input.sourceSha, execute: true, control: execution.control }, execution.wrap(loaded, ports));
            refs = { resultHash: result.result.resultHash, gateHash: result.gate.gateHash };
            outcome = result.result.blockerCodes.includes("EVAL_CANCEL_REQUESTED") ? "cancelled" : "completed";
            return (await execution.finish(refs, outcome, channel.intentHash, channel.owner))!;
        }
        finally {
            await ports.sql.close?.();
        }
    }
    return (await execution.finish(refs, outcome, channel.intentHash, channel.owner))!;
}
export async function runSelectedDirectConvergenceV1(loaded: LoadedConvergenceSuiteVersioned, options: Readonly<{
    releaseSha: string;
    execute: boolean;
}>, ports: ConvergenceRunnerPorts): Promise<ConvergenceSuiteRun> {
    const selection = selected();
    const input = await prepareSelectedDirectEvaluationIntentV1();
    if (loaded.suiteHash !== input.suiteHash || options.releaseSha !== input.sourceSha)
        throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED");
    const locator = path.join(selection.paths.root, "evals/manual-controls/direct", `${input.jobId}.json`);
    const pins = parents(path.dirname(locator), selection.directory), pin = readPin(locator, 32768);
    const direct = JSON.parse(pin.bytes.toString("utf8")), owner = ObservedControlWorkerOwnerV1Schema.parse(direct.owner), intentHash = digest(pin.bytes);
    if (direct.executionMode !== (options.execute ? "execute" : "preflight"))
        throw new ControlWorkerFatalErrorV1("CONTROL_BINDING_FAILED");
    checkParents(pins);
    checkPin(pin, 32768);
    let reservation: ManualEvaluationReservationV1;
    try {
        reservation = await acquireSelectedManualEvaluationV1(input);
    }
    catch (error) {
        await closeSelectedManualWorkerCustodyV1();
        throw error;
    }
    const journal = acquiredJournal(input, reservation, intentHash, owner, "direct", options.execute ? "execute" : "preflight");
    const execution = new WorkerExecutionV1(input, reservation, journal, defaultEffects, null);
    const result = await runConvergenceSuite(loaded, { ...options, control: execution.control }, execution.wrap(loaded, ports));
    await execution.finish({ resultHash: result.result.resultHash, gateHash: result.gate.gateHash }, "completed", intentHash, owner);
    return result;
}
