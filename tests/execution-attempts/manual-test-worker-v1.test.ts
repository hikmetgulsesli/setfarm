import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import { ManualReservationV1Schema, ManualSlotV1Schema, ManualOwnerV1Schema } from "../../src/execution/schemas/manual-evaluation-record-v1.js";
// Source component extraction adds test exports only. Actual function bodies,
// filesystem operations and pure schemas remain production code. No activated
// compiled entry, selected role, DB, service or provider is fabricated here.
async function journalComponent(replacements: Record<string, string> = {}) {
    const locator = path.resolve("src/execution/manual-test-worker-v1.ts");
    let source = fs.readFileSync(locator, "utf8");
    source = source.replace(/from "(\.[^"]+)"/g, (_, specifier) => `from ${JSON.stringify(replacements[specifier] ?? pathToFileURL(path.resolve(path.dirname(locator), specifier.replace(/\.js$/, ".ts"))).href)}`);
    source += "\nexport { WorkerJournalV1, WorkerExecutionV1, resolveConsumedClaim };\n";
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    return import(`data:text/javascript;base64,${Buffer.from(compiled + "\n//# sourceURL=manual-worker-component.mjs").toString("base64")}`);
}
const owner = { pid: 123, processStartedAt: "2026-10-19T00:00:00.000Z", processGroupId: 123, source: "observed_os", executable: "/usr/bin/node", script: "/release/dist/cli/control-test-worker-v1.js", commandHash: "a".repeat(64) };
const acquired = { type: "acquired", kind: "activation_preflight", selectionHash: "b".repeat(64), sourceSha: "c".repeat(40), suiteHash: null, executionMode: "preflight", owner, origin: "mission_control", reservationRevision: 1 };
test("journal retains immutable chained records and refuses head drift without next publication", async () => {
    const { WorkerJournalV1 } = await journalComponent();
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-worker-journal-")));
    fs.chmodSync(root, 0o700);
    try {
        const journal = new WorkerJournalV1(root, "11111111-1111-4111-8111-111111111111", "d".repeat(64), owner);
        const first = journal.append(acquired);
        const second = journal.append({ type: "phase", phase: "preflight", currentCaseId: null, completedCases: 0 });
        assert.equal(first.revision, 1);
        assert.equal(second.revision, 2);
        const directory = path.join(root, "manual-control-journals", "11111111-1111-4111-8111-111111111111");
        const records = path.join(directory, "records");
        const firstBytes = fs.readFileSync(path.join(records, "00000000000000000001.json"));
        const record = JSON.parse(fs.readFileSync(path.join(records, "00000000000000000002.json"), "utf8"));
        assert.equal(record.previousHash, first.hash);
        fs.writeFileSync(path.join(directory, "head.json"), "{}\n");
        assert.throws(() => journal.append({ type: "phase", phase: "settling", currentCaseId: null, completedCases: 0 }), /CONTROL_JOURNAL_FAILED/);
        assert.deepEqual(fs.readFileSync(path.join(records, "00000000000000000001.json")), firstBytes);
        assert.equal(fs.readdirSync(records).length, 2);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test("journal refuses existing job directories and hostile links without adoption", async () => {
    const { WorkerJournalV1 } = await journalComponent();
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-worker-journal-")));
    fs.chmodSync(root, 0o700);
    try {
        const job = "11111111-1111-4111-8111-111111111111";
        new WorkerJournalV1(root, job, "d".repeat(64), owner);
        assert.throws(() => new WorkerJournalV1(root, job, "d".repeat(64), owner), /CONTROL_JOURNAL_FAILED/);
        const other = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-worker-foreign-")));
        try {
            fs.symlinkSync(other, path.join(root, "manual-control-journals", "22222222-2222-4222-8222-222222222222"));
            assert.throws(() => new WorkerJournalV1(root, "22222222-2222-4222-8222-222222222222", "d".repeat(64), owner), /CONTROL_JOURNAL_FAILED/);
            assert.deepEqual(fs.readdirSync(other), []);
        }
        finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test("injected effects cannot mint worker custody or reach preflight", async () => {
    const { runSelectedManualControlJobV1 } = await import("../../src/execution/manual-test-worker-v1.js");
    let effects = 0;
    const effect = async () => { effects++; throw new Error("unexpected"); };
    await assert.rejects(() => runSelectedManualControlJobV1({} as never, {} as never, { runPreflight: effect, loadSuite: effect, createConvergencePorts: effect, stopOwnedRun: effect }), /CONTROL_CUSTODY_UNCERTAIN/);
    assert.equal(effects, 0);
});
for (const cancelAt of ["never", "before", "during", "after"] as const)
    test(`activation worker preserves actual report and closure when cancel is ${cancelAt}`, async () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-worker-activation-")));
        fs.chmodSync(root, 0o700);
        try {
            for (const directory of ["runtime", "runtime/evals", "runtime/evals/manual-controls", "runtime/evals/manual-controls/closures"])
                fs.mkdirSync(path.join(root, directory), { mode: 0o700 });
            const fixturePath = path.join(root, "component.mjs");
            const job = "11111111-1111-4111-8111-111111111111";
            const receipt = { schema: "mission-control.control-job.v1", jobId: job, kind: "activation_preflight", revision: 1, selectionHash: "b".repeat(64), sourceSha: "c".repeat(40), mcSourceSha: "d".repeat(40), mcBuildHash: "e".repeat(64), suiteHash: null, state: "accepted", requestedAt: "2026-10-19T00:00:00.000Z", startedAt: null, updatedAt: "2026-10-19T00:00:00.000Z", finishedAt: null, phase: "accepted", code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 0, reportRefs: {}, cancelRequested: false };
            const intent = { schema: "mission-control.control-intent.v1", receipt, installationDir: root, releaseDir: root, nonceDigest: "f".repeat(64), fixedSuiteRelativePath: null };
            const custody = { schema: "mission-control.control-custody.v1", jobId: job, selectionHash: receipt.selectionHash, sourceSha: receipt.sourceSha, mcBuildHash: receipt.mcBuildHash, nonce: "n".repeat(32) };
            fs.writeFileSync(fixturePath, `import fs from 'node:fs';export const events=[];export const frames=[];
export const intent=Object.freeze(${JSON.stringify(intent)}),custody=Object.freeze(${JSON.stringify(custody)}),owner=Object.freeze(${JSON.stringify(owner)});
export const freshInstallationSelectionV1=Object.freeze({directory:${JSON.stringify(root)},paths:Object.freeze({root:${JSON.stringify(path.join(root, "runtime"))},repository:${JSON.stringify(root)},evals:${JSON.stringify(path.join(root, "runtime/evals/results"))}}),activation:Object.freeze({acknowledged:true,activatedPin:{}}),assertUnchanged(){}});
export function assertFreshInstallationSelectionUnchangedV1(){}
export let cancellation=${cancelAt === 'before' ? JSON.stringify({ requestId: '33333333-3333-4333-8333-333333333333', unavailable: false }) : 'null'};export function requestCancel(){cancellation={requestId:'33333333-3333-4333-8333-333333333333',unavailable:false};}
const channel=Object.freeze({intent,custody,owner,intentHash:'${"f".repeat(64)}',assertUnchanged(){},cancellation(){return cancellation;},async send(frame){frames.push(frame);events.push('frame:'+frame.type);if(frame.type==='progress'&&frame.phase==='settling'&&${JSON.stringify(cancelAt)}==='after')requestCancel();return {...intent.receipt,state:frame.type==='final_closed'?frame.outcome:'running',revision:frames.length+1,reportRefs:frame.reportRefs??{}};}});
export function selectedManualWorkerChannelV1(){return channel;}
export async function registerSelectedManualWorkerCustodyV1(){events.push('register');}
export async function acquireSelectedManualEvaluationV1(input){events.push('acquire');return {...input,revision:7,phase:'active'};}
export async function bindSelectedManualCanaryV1(){throw new Error('unexpected canary');}
export async function observeSelectedManualSettlementV1(){return "ready";}
export async function releaseSelectedManualEvaluationV1(reservation){if(reservation.revision!==7)throw new Error('revision');events.push('release');}
export async function closeSelectedManualWorkerCustodyV1(){events.push('close');fs.writeFileSync(${JSON.stringify(path.join(root, "runtime/evals/manual-controls/closures", job + ".json"))},JSON.stringify({jobId:intent.receipt.jobId,intentHash:channel.intentHash,owner})+'\\n',{mode:0o600,flag:'wx'});}
export async function prepareSelectedDirectEvaluationIntentV1(){throw new Error('unexpected direct');}
`, { mode: 0o600 });
            const url = pathToFileURL(fixturePath).href;
            const fixture = await import(url);
            const component = await journalComponent({ "../installation/fresh-installation-selection-v1.js": url, "./manual-test-worker-channel-v1.js": url, "./manual-test-admission-v1.js": url });
            let preflights = 0;
            const output = await component.runSelectedManualControlJobV1(fixture.intent, fixture.custody, {
                runPreflight: async (input: any) => { preflights++; assert.deepEqual(input, { protocol: "v3", compilerReleaseSha: "c".repeat(40) }); fixture.events.push("preflight"); if (cancelAt === "during")
                    fixture.requestCancel(); return { stored: true, status: "fail", hash: "1".repeat(64), report: { checks: Array.from({ length: 6 }, (_, i) => ({ id: `check-${i}`, status: "fail", code: `CODE_${i}` })) } }; },
                loadSuite: async () => { throw new Error("unexpected suite"); }, createConvergencePorts: async () => { throw new Error("unexpected runner"); }, stopOwnedRun: async () => { throw new Error("unexpected stop"); },
            });
            assert.equal(preflights, cancelAt === "before" ? 0 : 1);
            assert.equal(output.state, cancelAt === "before" || cancelAt === "during" ? "cancelled" : "completed");
            assert.deepEqual(output.reportRefs, cancelAt === "before" ? {} : { activationHash: "1".repeat(64) });
            assert.deepEqual(fixture.events.filter((v: string) => !v.startsWith("frame:")), cancelAt === "before" ? ["register", "close"] : ["register", "acquire", "preflight", "release", "close"]);
            assert.equal(fixture.events.at(-1), "frame:final_closed");
            if (cancelAt !== "before")
                assert.equal(fixture.frames[0].phase, "acquired");
            if (cancelAt === "after") {
                const directory = path.join(root, "runtime/evals/manual-control-journals", job, "records");
                const records = fs.readdirSync(directory).map(name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")));
                assert.equal(records.filter(value => value.event.type === "cancel_latched").length, 1);
                assert.equal(fixture.frames.at(-1).code, "CONTROL_CANCEL_TOO_LATE");
            }
            assert.ok(fixture.frames.slice(0, -1).every((v: any) => v.reportRefs === undefined));
        }
        finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
test("journal refuses dangling head symlink before publishing any record", async () => {
    const { WorkerJournalV1 } = await journalComponent();
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-worker-link-")));
    fs.chmodSync(root, 0o700);
    try {
        const job = "11111111-1111-4111-8111-111111111111";
        const journal = new WorkerJournalV1(root, job, "d".repeat(64), owner);
        const directory = path.join(root, "manual-control-journals", job);
        fs.symlinkSync(path.join(root, "absent"), path.join(directory, "head.json"));
        assert.throws(() => journal.append(acquired), /CONTROL_JOURNAL_FAILED/);
        assert.deepEqual(fs.readdirSync(path.join(directory, "records")), []);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
async function wrappedStartComponent(mode: "success" | "lost" | "unused" | "foreign" | "wrong_response" | "bind_refused" | "foreign_admission", options: { failure?: string; terminal?: boolean; channel?: boolean } = {}) {
    const { loadConvergenceSuiteVersioned } = await import("../../src/evals/suite-schema-v2.js");
    const { hashCanonicalJson } = await import("../../src/product-compiler/canonical-json.js");
    const { createV3ReleaseAdmissionV1, computeCanarySlotHash, canarySelectorHash } = await import("../../src/execution/v3-release-admission.js");
    const loaded = await loadConvergenceSuiteVersioned(path.resolve("evals/suites/product-convergence-codex-v1.json"));
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-worker-binding-")));
    fs.chmodSync(root, 0o700);
    const input = { jobId: "11111111-1111-4111-8111-111111111111", kind: "convergence_full8", sourceSha: "c".repeat(40), selectionHash: "b".repeat(64), suiteHash: loaded.suiteHash };
    const request = { releaseSha: input.sourceSha, suiteHash: input.suiteHash, preflightHash: "d".repeat(64), ttlMs: 176400000, slots: loaded.suite.cases.map((value, index) => ({ caseHash: hashCanonicalJson(value), taskHash: hashCanonicalJson(value.task), repetition: 1, slotToken: String(index).repeat(32) })) };
    const admission = createV3ReleaseAdmissionV1({ schema: "setfarm.v3-release-admission.v1", kind: "convergence_canary", releaseSha: input.sourceSha, suiteHash: loaded.suiteHash, preflightHash: mode === "foreign_admission" ? "f".repeat(64) : request.preflightHash, result: { hash: null, ref: null }, gate: { hash: null, ref: null }, issuedAt: "2026-10-19T00:00:00.000Z", expiresAt: "2026-10-21T01:00:00.000Z", slots: request.slots.map(slot => ({ ...(({ caseHash, taskHash, repetition }) => ({ caseHash, taskHash, repetition }))(slot), selectorHash: canarySelectorHash(slot.slotToken), slotHash: computeCanarySlotHash({ releaseSha: input.sourceSha, suiteHash: loaded.suiteHash, ...slot, selectorHash: canarySelectorHash(slot.slotToken) }) })) });
    const contexts = request.slots.map(slot => ({ schema: "setfarm.internal-convergence-admission.v1", admissionHash: admission.admissionHash, slotHash: admission.slots.find(value => value.caseHash === slot.caseHash)!.slotHash, ...slot }));
    const first = contexts[0]!;
    const claim = { admission_hash: admission.admissionHash, admission_kind: "convergence_canary", case_hash: first.caseHash, task_hash: first.taskHash, repetition: 1, selector_hash: canarySelectorHash(first.slotToken), run_id: null, consumed_at: null };
    const run = { id: "owned-run", run_number: 41, protocol: "v3", protocol_version: 1, compiler_release_sha: input.sourceSha, release_admission_hash: admission.admissionHash, task: loaded.suite.cases[0]!.task };
    for (const directory of ["evals", "evals/manual-controls", "evals/manual-controls/closures"]) fs.mkdirSync(path.join(root, directory), { mode: 0o700 });
    const pureUrl = pathToFileURL(path.resolve("src/execution/schemas/manual-control-worker-channel-v1.ts")).href;
    const file = path.join(root, "effects.mjs");
    fs.writeFileSync(file, `import fs from 'node:fs';import {ControlWorkerFatalErrorV1} from ${JSON.stringify(pureUrl)};
const options=${JSON.stringify(options)};
export const facts={events:[],frames:[],stops:[],unavailable:false,claim:${JSON.stringify(claim)},run:${JSON.stringify(run)},admission:${JSON.stringify(admission)},queries:[],bindings:[]};
export const freshInstallationSelectionV1=Object.freeze({directory:${JSON.stringify(root)},paths:Object.freeze({root:${JSON.stringify(root)}}),activation:Object.freeze({acknowledged:true,activatedPin:{}}),assertUnchanged(){}});
export function assertFreshInstallationSelectionUnchangedV1(){}
export function getSql(){return {async begin(mode,callback){if(mode!=='isolation level repeatable read read only')throw new Error('transaction');return callback({async unsafe(query,args){facts.queries.push({query,args});if(query==='SELECT payload FROM v3_release_admissions WHERE admission_hash=$1'){if(args[0]!==facts.admission.admissionHash)throw new Error('foreign admission');return [{payload:facts.admission}];}if(query.includes('FROM v3_canary_admission_claims WHERE slot_hash=$1')){if(args[0]!==${JSON.stringify(first.slotHash)})throw new Error('foreign slot');return [facts.claim];}if(query.includes('FROM runs WHERE id=$1')){if(args[0]!==facts.claim.run_id)throw new Error('foreign run');return [facts.run];}throw new Error('unexpected query');}});}};}
export async function bindSelectedManualCanaryV1(value){facts.bindings.push(value);if(${JSON.stringify(mode)}==='bind_refused')throw new Error('bind refused');return {...value.reservation,revision:value.reservation.revision+1};}
export async function acquireSelectedManualEvaluationV1(){throw new Error('unexpected acquire');}
export async function registerSelectedManualWorkerCustodyV1(){throw new Error('unexpected register');}
export async function prepareSelectedDirectEvaluationIntentV1(){throw new Error('unexpected direct');}
export async function buildRunOperationalSnapshot(sql,runId){facts.events.push('snapshot');if(runId!==facts.run.id)throw new Error('foreign snapshot');return {run:{id:runId},summary:{lifecycleState:options.terminal?'terminal':'active'},snapshotHash:'${"e".repeat(64)}'};}
export const effects={settlementClock:{now:()=>facts.clockMs??0,sleep:async(ms)=>{facts.clockMs=(facts.clockMs??0)+ms;facts.events.push('settlement_wait');}},async stopOwnedRun(runId,expectedSnapshotHash){facts.stops.push({runId,expectedSnapshotHash});facts.events.push('stop');if(['stale_stop','denied_stop','terminal_race'].includes(options.failure))throw new Error(options.failure);}};
export const channel={assertUnchanged(){},cancellation(){return facts.unavailable?{requestId:null,unavailable:true}:null;},async send(frame){facts.frames.push(frame);if(facts.unavailable||frame.type==='final_closed'&&options.failure==='final_frame')throw new ControlWorkerFatalErrorV1('CONTROL_CHANNEL_UNAVAILABLE');return {state:frame.outcome,reportRefs:frame.reportRefs??{}};}};
export async function observeSelectedManualSettlementV1(){facts.events.push('settlement');facts.settlementReads=(facts.settlementReads??0)+1;if(options.failure==='unknown_settlement')throw new Error('unknown');return options.failure==='forever_pending'||options.failure==='pending_delivery'&&facts.settlementReads<3?'pending':'ready';}
export async function releaseSelectedManualEvaluationV1(reservation){facts.events.push('release:'+reservation.revision);if(options.failure==='pending_delivery'&&facts.settlementReads!==3)throw new Error('delivery still pending');if(reservation.revision!==8||['release','live_owner'].includes(options.failure))throw new Error('release refused');}
export async function closeSelectedManualWorkerCustodyV1(){facts.events.push('close');if(options.failure==='close')throw new Error('close refused');fs.writeFileSync(${JSON.stringify(path.join(root,"evals/manual-controls/closures",input.jobId+".json"))},JSON.stringify({jobId:${JSON.stringify(input.jobId)},intentHash:'${"a".repeat(64)}',owner:${JSON.stringify(owner)}})+'\\n',{mode:0o600,flag:'wx'});if(options.failure==='final_journal')fs.appendFileSync(${JSON.stringify(path.join(root,"manual-control-journals",input.jobId,"records/00000000000000000001.json"))},' ');}

`, { mode: 0o600 });
    const url = pathToFileURL(file).href, fixture = await import(url);
    const component = await journalComponent({ "../installation/fresh-installation-selection-v1.js": url, "../db-pg.js": url, "./manual-test-admission-v1.js": url, "../server/run-operational-snapshot.js": url });
    const journal = new component.WorkerJournalV1(root, input.jobId, "a".repeat(64), owner);
    journal.append({ ...acquired, kind: "convergence_full8", suiteHash: loaded.suiteHash, executionMode: "execute" });
    const execution = new component.WorkerExecutionV1(input, { ...input, revision: 7, phase: "active" }, journal, fixture.effects, options.channel ? fixture.channel : null);
    let starts = 0, creates = 0, promotions = 0, clockMs = Date.now();
    const ports = { clock: {now:()=>new Date(clockMs),sleep:async(ms:number)=>{clockMs+=ms;fixture.facts.events.push("settlement_wait");}}, admissions: { createCanary: async () => { creates++; return { contexts }; }, promoteReleaseGo: async () => { promotions++; if (options.failure === "promotion") throw new Error("promotion output lost"); } }, process: { startRun: async (startInput: any) => {
                starts++;
                fixture.facts.startChild = startInput.startChild;
                const record = JSON.parse(fs.readFileSync(path.join(root, "manual-control-journals", input.jobId, "records", String(journal.ref().revision).padStart(20, "0") + ".json"), "utf8"));
                assert.equal(record.event.type, "start_requested");
                if (mode !== "unused") {
                    fixture.facts.claim.run_id = "owned-run";
                    fixture.facts.claim.consumed_at = "2026-10-19T00:01:00.000Z";
                }
                if (mode === "foreign")
                    fixture.facts.claim.selector_hash = "f".repeat(64);
                if (mode !== "success" && mode !== "wrong_response")
                    throw new Error("lost output");
                return { runId: mode === "wrong_response" ? "foreign-run" : "owned-run", runNumber: 41 };
            } } };
    return { root, input, request, loaded, fixture, journal, execution, wrapped: execution.wrap(loaded, ports), contexts, starts: () => starts, creates: () => creates, promotions: () => promotions };
}
for (const mode of ["success", "lost", "unused", "foreign", "wrong_response", "bind_refused", "foreign_admission"] as const) {
    test(`actual worker wrapper binds all slots once and resolves ${mode} start only from its consumed claim`, async () => {
        const h = await wrappedStartComponent(mode);
        try {
            if (mode === "bind_refused" || mode === "foreign_admission") {
                await assert.rejects(() => h.wrapped.admissions.createCanary(h.request), /CONTROL_BINDING_FAILED/);
                assert.equal(h.starts(), 0);
                return;
            }
            const created = await h.wrapped.admissions.createCanary(h.request);
            assert.equal(h.fixture.facts.bindings.length, 1);
            assert.equal(h.fixture.facts.bindings[0].slots.length, 8);
            assert.equal(h.creates(), 1);
            const stored = JSON.parse(fs.readFileSync(path.join(h.root, "manual-control-journals", h.input.jobId, "records", "00000000000000000003.json"), "utf8"));
            assert.equal(stored.event.type, "canary_bound");
            assert.equal(stored.event.reservationRevision, 8);
            const call = () => h.wrapped.process.startRun({ workflowId: h.loaded.suite.workflowId, task: h.loaded.suite.cases[0]!.task, releaseSha: h.input.sourceSha, admission: created.contexts[0] });
            if (mode === "success" || mode === "lost")
                assert.deepEqual(await call(), { runId: "owned-run", runNumber: 41 });
            else
                await assert.rejects(call, /CONTROL_START_UNRESOLVED/);
            await assert.rejects(call, /CONTROL_BINDING_FAILED/);
            assert.equal(h.starts(), 1);
            assert.equal(h.creates(), 1);
            assert.ok(h.fixture.facts.queries.every((q: any) => !q.query.includes("ORDER BY") && !q.query.includes("LIMIT")));
        }
        finally {
            fs.rmSync(h.root, { recursive: true, force: true });
        }
    });
}
test("journal detects modification of an earlier immutable record before the next effect", async () => {
    const { WorkerJournalV1 } = await journalComponent();
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-worker-chain-")));
    fs.chmodSync(root, 0o700);
    try {
        const job = "11111111-1111-4111-8111-111111111111";
        const journal = new WorkerJournalV1(root, job, "d".repeat(64), owner);
        journal.append(acquired);
        journal.append({ type: "phase", phase: "preflight", currentCaseId: null, completedCases: 0 });
        const records = path.join(root, "manual-control-journals", job, "records");
        fs.writeFileSync(path.join(records, "00000000000000000001.json"), "{}\n");
        assert.throws(() => journal.append({ type: "phase", phase: "settling", currentCaseId: null, completedCases: 0 }), /CONTROL_JOURNAL_FAILED/);
        assert.equal(fs.readdirSync(records).length, 2);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("selected direct orchestration refuses execution mode drift before acquisition", async () => {
    const source = fs.readFileSync("src/execution/manual-test-worker-v1.ts", "utf8");
    const tree = ts.createSourceFile("worker.ts", source, ts.ScriptTarget.ES2022, true);
    const declaration = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "runSelectedDirectConvergenceV1")!;
    const body = ts.transpileModule(declaration.getText(tree), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("export ", "");
    const { ObservedControlWorkerOwnerV1Schema, ControlWorkerFatalErrorV1 } = await import("../../src/execution/schemas/manual-control-worker-channel-v1.js");
    const input = { jobId: "11111111-1111-4111-8111-111111111111", sourceSha: "a".repeat(40), suiteHash: "b".repeat(64), kind: "convergence_full8", selectionHash: "c".repeat(64) };
    let acquisitions = 0;
    const dependencies = { selected: () => ({ directory: "/fixture", paths: { root: "/fixture/runtime" } }), prepareSelectedDirectEvaluationIntentV1: async () => input, parents: () => [], readPin: () => ({ bytes: Buffer.from(JSON.stringify({ owner, executionMode: "preflight" })) }), path, digest: () => "d".repeat(64), ObservedControlWorkerOwnerV1Schema, checkParents: () => {}, checkPin: () => {}, ControlWorkerFatalErrorV1, acquireSelectedManualEvaluationV1: async () => { acquisitions++; throw new Error("unexpected acquire"); }, closeSelectedManualWorkerCustodyV1: async () => {} };
    const run = new Function(...Object.keys(dependencies), body + ";return runSelectedDirectConvergenceV1;")(...Object.values(dependencies));
    await assert.rejects(() => run({ suiteHash: input.suiteHash }, { releaseSha: input.sourceSha, execute: true }, {}), /CONTROL_BINDING_FAILED/);
    assert.equal(acquisitions, 0);
});

// Isolated filesystem faults wrap only the OS port; these are the actual source
// pin/journal bodies, with no selection, DB, or compiled-entry authority.
async function filesystemComponent(fsPort: typeof fs = fs) {
    const source = fs.readFileSync("src/execution/manual-test-worker-v1.ts", "utf8");
    const tree = ts.createSourceFile("worker.ts", source, ts.ScriptTarget.ES2022, true);
    const names = ["same", "parents", "checkParents", "readPin", "checkPin", "syncDirectory", "exclusive", "WorkerJournalV1"];
    const nodes = tree.statements.filter(n => (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && names.includes(n.name?.text ?? ""));
    assert.equal(nodes.length, names.length);
    const body = ts.transpileModule(nodes.map(n => n.getText(tree)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const deps = { fs: fsPort, path, process, ...(await import("../../src/execution/schemas/manual-control-worker-channel-v1.js")), ...(await import("../../src/execution/schemas/manual-control-job-v1.js")) };
    return new Function(...Object.keys(deps), body + ";return {WorkerJournalV1,readPin};")(...Object.values(deps));
}
for (const mutation of ["job", "revision", "identical_replacement"] as const) test(`journal fences ${mutation} head swap at publication`, async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "worker-head-swap-")));
    fs.chmodSync(root, 0o700);
    let swaps = 0;
    const port = new Proxy(fs, { get(target, key) {
        if (key === "renameSync") return (from: string, to: string) => {
            fs.renameSync(from, to);
            const bytes = fs.readFileSync(to);
            if (mutation === "identical_replacement") {
                fs.writeFileSync(to + ".replacement", bytes, { mode: 0o600, flag: "wx" });
                fs.renameSync(to + ".replacement", to);
            } else {
                const head = JSON.parse(bytes.toString());
                if (mutation === "job") head.jobId = "22222222-2222-4222-8222-222222222222";
                else head.revision++;
                const keys = Object.keys(head).sort();
                fs.writeFileSync(to, JSON.stringify(head, keys) + "\n");
            }
            swaps++;
        };
        return Reflect.get(target, key);
    } });
    try {
        const { WorkerJournalV1 } = await filesystemComponent(port);
        const journal = new WorkerJournalV1(root, "11111111-1111-4111-8111-111111111111", "d".repeat(64), owner);
        assert.throws(() => journal.append(acquired), /CONTROL_JOURNAL_FAILED/);
        assert.throws(() => journal.ref(), /CONTROL_JOURNAL_FAILED/);
        assert.throws(() => journal.append(acquired), /CONTROL_JOURNAL_FAILED/);
        assert.equal(swaps, 1);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("worker private read caps bytes when file grows after descriptor stat", async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "worker-read-growth-")));
    const file = path.join(root, "record.json"), cap = 65536;
    fs.writeFileSync(file, "{}\n", { mode: 0o600 });
    let grown = false, bytesRead = 0;
    const port = new Proxy(fs, { get(target, key) {
        if (key === "fstatSync") return (...args: Parameters<typeof fs.fstatSync>) => {
            const value = fs.fstatSync(...args);
            if (!grown) { grown = true; fs.appendFileSync(file, Buffer.alloc(cap * 4)); }
            return value;
        };
        if (key === "readFileSync") return (fd: number) => { const value = fs.readFileSync(fd); bytesRead += value.length; return value; };
        if (key === "readSync") return (...args: any[]) => { const count = (fs.readSync as any)(...args); bytesRead += count; return count; };
        return Reflect.get(target, key);
    } });
    try {
        const { readPin } = await filesystemComponent(port);
        assert.throws(() => readPin(file, cap), /file changed/);
        assert.ok(bytesRead <= cap + 1, `read ${bytesRead} bytes for cap ${cap}`);
        assert.equal(bytesRead, cap + 1);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const point of ["record_write", "record_fsync", "record_directory_fsync", "head_write", "head_fsync", "rename", "published_directory_fsync"] as const) test(`journal permanently fences ${point} failure and preserves crash residue`, async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "worker-journal-fault-")));
    fs.chmodSync(root, 0o700);
    const descriptors = new Map<number, string>();
    let armed = false, renamed = false, failures = 0;
    const fault = () => { failures++; throw new Error(`injected ${point}`); };
    const port = new Proxy(fs, { get(target, key) {
        if (key === "openSync") return (...args: any[]) => { const fd = (fs.openSync as any)(...args); descriptors.set(fd, String(args[0])); return fd; };
        if (key === "closeSync") return (fd: number) => { descriptors.delete(fd); fs.closeSync(fd); };
        if (key === "writeFileSync") return (fd: number, bytes: Uint8Array) => {
            const name = descriptors.get(fd)!;
            if (armed && ((point === "record_write" && name.endsWith("00000000000000000001.json")) || (point === "head_write" && name.endsWith("head.next.json")))) {
                fs.writeSync(fd, bytes.subarray(0, 3)); fault();
            }
            fs.writeFileSync(fd, bytes);
        };
        if (key === "fsyncSync") return (fd: number) => {
            const name = descriptors.get(fd)!;
            if (armed && ((point === "record_fsync" && name.endsWith("00000000000000000001.json")) || (point === "record_directory_fsync" && name.endsWith("/records")) || (point === "head_fsync" && name.endsWith("head.next.json")) || (point === "published_directory_fsync" && renamed && name.endsWith("11111111-1111-4111-8111-111111111111")))) fault();
            fs.fsyncSync(fd);
        };
        if (key === "renameSync") return (from: string, to: string) => { if (armed && point === "rename") fault(); fs.renameSync(from, to); renamed = true; };
        return Reflect.get(target, key);
    } });
    try {
        const { WorkerJournalV1 } = await filesystemComponent(port);
        const job = "11111111-1111-4111-8111-111111111111", journal = new WorkerJournalV1(root, job, "d".repeat(64), owner);
        armed = true;
        assert.throws(() => journal.append(acquired), /CONTROL_JOURNAL_FAILED/);
        assert.equal(failures, 1);
        const directory = path.join(root, "manual-control-journals", job);
        const before = fs.readdirSync(directory, { recursive: true });
        assert.throws(() => journal.append(acquired), /CONTROL_JOURNAL_FAILED/);
        assert.throws(() => journal.ref(), /CONTROL_JOURNAL_FAILED/);
        assert.throws(() => new WorkerJournalV1(root, job, "d".repeat(64), owner), /CONTROL_JOURNAL_FAILED/);
        assert.deepEqual(fs.readdirSync(directory, { recursive: true }), before);
        assert.equal(failures, 1);
        assert.equal(descriptors.size, 0);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("journal refuses record 1025 without writing or adopting a new head", async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "worker-journal-cap-")));
    fs.chmodSync(root, 0o700);
    try {
        const { WorkerJournalV1 } = await filesystemComponent();
        const job = "11111111-1111-4111-8111-111111111111", journal = new WorkerJournalV1(root, job, "d".repeat(64), owner);
        journal.append(acquired);
        for (let i = 1; i < 1024; i++) journal.append({ type: "phase", phase: "preflight", currentCaseId: null, completedCases: 0 });
        assert.equal(journal.ref().revision, 1024);
        const directory = path.join(root, "manual-control-journals", job), before = fs.readFileSync(path.join(directory, "head.json"));
        assert.throws(() => journal.append({ type: "phase", phase: "preflight", currentCaseId: null, completedCases: 0 }), /CONTROL_JOURNAL_FAILED/);
        assert.equal(fs.readdirSync(path.join(directory, "records")).length, 1024);
        assert.deepEqual(fs.readFileSync(path.join(directory, "head.json")), before);
        assert.throws(() => journal.ref(), /CONTROL_JOURNAL_FAILED/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

async function startBound(h: Awaited<ReturnType<typeof wrappedStartComponent>>) {
    const created = await h.wrapped.admissions.createCanary(h.request);
    const run = await h.wrapped.process.startRun({ workflowId: h.loaded.suite.workflowId, task: h.loaded.suite.cases[0]!.task, releaseSha: h.input.sourceSha, admission: created.contexts[0] });
    const { caseHash, taskHash, repetition } = created.contexts[0];
    return { ...run, caseId: h.loaded.suite.cases[0]!.caseId, caseHash, taskHash, repetition };
}
for (const failure of [undefined, "stale_stop", "denied_stop", "terminal_race"]) test(`actual bound stop adapter ${failure ?? "requests exact fresh snapshot"} without retry`, async () => {
    const h = await wrappedStartComponent("success", { failure });
    try {
        const run = await startBound(h);
        assert.equal(await h.execution.control.requestOwnedRunStop(run), failure ? "refused" : "requested");
        assert.deepEqual(h.fixture.facts.stops, [{ runId: "owned-run", expectedSnapshotHash: "e".repeat(64) }]);
        await assert.rejects(() => h.execution.control.requestOwnedRunStop(run), /CONTROL_SETTLEMENT_UNCERTAIN/);
        assert.equal(h.fixture.facts.stops.length, 1);
        assert.equal(h.fixture.facts.events.some((v: string) => v.startsWith("release") || v === "close"), false);
        assert.deepEqual(h.fixture.facts.frames, []);
    } finally { fs.rmSync(h.root, { recursive: true, force: true }); }
});
test("terminal stop snapshot avoids stop action but live-owner release refusal retains custody", async () => {
    const h = await wrappedStartComponent("success", { terminal: true, failure: "live_owner", channel: true });
    try {
        const run = await startBound(h);
        assert.equal(await h.execution.control.requestOwnedRunStop(run), "already_terminal");
        assert.deepEqual(h.fixture.facts.stops, []);
        await assert.rejects(() => h.execution.finish({}, "cancelled", "a".repeat(64), owner), /CONTROL_SETTLEMENT_UNCERTAIN/);
        assert.deepEqual(h.fixture.facts.events, ["snapshot", "settlement", "release:8"]);
        assert.equal(h.fixture.facts.frames.some((v: any) => v.type === "final_closed"), false);
    } finally { fs.rmSync(h.root, { recursive: true, force: true }); }
});
for (const failure of [undefined, "release", "close", "final_journal", "final_frame"]) test(`actual finish adapter ${failure ?? "releases latest reservation and closes"} publishes no premature refs`, async () => {
    const h = await wrappedStartComponent("success", { failure, channel: true });
    try {
        await h.wrapped.admissions.createCanary(h.request);
        const refs = { resultHash: "b".repeat(64), gateHash: "c".repeat(64) };
        const finish = () => h.execution.finish(refs, "completed", "a".repeat(64), owner);
        if (failure) await assert.rejects(finish, failure === "release" ? /CONTROL_SETTLEMENT_UNCERTAIN/ : failure === "close" ? /close refused/ : failure === "final_journal" ? /CONTROL_JOURNAL_FAILED/ : /CONTROL_CHANNEL_UNAVAILABLE/);
        else assert.deepEqual((await finish()).reportRefs, refs);
        assert.deepEqual(h.fixture.facts.events, failure === "release" ? ["settlement", "release:8"] : ["settlement", "release:8", "close"]);
        const finals = h.fixture.facts.frames.filter((v: any) => v.type === "final_closed");
        assert.equal(finals.length, failure && failure !== "final_frame" ? 0 : 1);
        assert.ok(h.fixture.facts.frames.filter((v: any) => v.type !== "final_closed").every((v: any) => v.reportRefs === undefined));
        if (finals.length) assert.deepEqual(finals[0].reportRefs, refs);
        assert.equal(h.starts(), 0);
    } finally { fs.rmSync(h.root, { recursive: true, force: true }); }
});
test("healthy-journal active disconnect latches cancellation, stops exact owned run and settles despite final ACK loss", async () => {
    const h = await wrappedStartComponent("success", { channel: true });
    try {
        const run = await startBound(h);
        h.fixture.facts.unavailable = true;
        await h.execution.control.onPhase({ phase: "case_running", currentCaseId: run.caseId, completedCases: 0 });
        assert.equal(await h.execution.control.cancellationRequested(), true);
        assert.equal(await h.execution.control.requestOwnedRunStop(run), "requested");
        assert.equal(await h.execution.control.beforeFinalization({ resultHash: "b".repeat(64), gateHash: "c".repeat(64), gateDecision: "no_go" }), "cancel");
        await assert.rejects(() => h.execution.finish({}, "cancelled", "a".repeat(64), owner), /CONTROL_CHANNEL_UNAVAILABLE/);
        assert.deepEqual(h.fixture.facts.events, ["snapshot", "stop", "settlement", "release:8", "close"]);
        assert.equal(h.starts(), 1);
        const records = fs.readdirSync(path.join(h.root, "manual-control-journals", h.input.jobId, "records")).map(name => JSON.parse(fs.readFileSync(path.join(h.root, "manual-control-journals", h.input.jobId, "records", name), "utf8")));
        assert.deepEqual(records.filter(v => v.event.type === "cancel_latched").map(v => v.event.source), ["channel_lost"]);
        assert.equal(records.at(-1).event.type, "closed");
        assert.deepEqual(h.fixture.facts.frames.map((v: any) => v.type), ["final_closed"]);
    } finally { fs.rmSync(h.root, { recursive: true, force: true }); }
});
test("uncertain journal prevents new start, artifact publication and finalization", async () => {
    const h = await wrappedStartComponent("success");
    try {
        const created = await h.wrapped.admissions.createCanary(h.request);
        fs.appendFileSync(path.join(h.root, "manual-control-journals", h.input.jobId, "records/00000000000000000001.json"), " ");
        await assert.rejects(() => h.wrapped.process.startRun({ workflowId: h.loaded.suite.workflowId, task: h.loaded.suite.cases[0]!.task, releaseSha: h.input.sourceSha, admission: created.contexts[0] }), /CONTROL_JOURNAL_FAILED/);
        await assert.rejects(() => h.execution.control.onPublication({ stage: "candidate", resultHash: "b".repeat(64), gateHash: "c".repeat(64) }), /CONTROL_JOURNAL_FAILED/);
        await assert.rejects(() => h.execution.control.beforeFinalization({ resultHash: "b".repeat(64), gateHash: "c".repeat(64), gateDecision: "go" }), /CONTROL_JOURNAL_FAILED/);
        assert.equal(h.starts(), 0);
        assert.deepEqual(h.fixture.facts.events, []);
    } finally { fs.rmSync(h.root, { recursive: true, force: true }); }
});

test("worker promotion uncertainty is fatal and cannot be retried or publish final refs", async () => {
    const h = await wrappedStartComponent("success", { failure: "promotion", channel: true });
    try {
        const refs = { resultHash: "b".repeat(64), gateHash: "c".repeat(64) };
        await h.execution.control.onPublication({ stage: "candidate", ...refs, resultStatus: "pass", gateDecision: "go" });
        assert.equal(await h.execution.control.beforeFinalization({ ...refs, gateDecision: "go" }), "continue");
        const call = () => h.wrapped.admissions.promoteReleaseGo({ releaseSha: h.input.sourceSha, suiteHash: h.input.suiteHash, ...refs, resultRef: "/immutable/result", gateRef: "/immutable/gate" });
        await assert.rejects(call, /CONTROL_PROMOTION_UNCERTAIN/);
        await assert.rejects(call, /CONTROL_PROMOTION_UNCERTAIN/);
        assert.equal(h.promotions(), 1);
        assert.deepEqual(h.fixture.facts.events, []);
        assert.deepEqual(h.fixture.facts.frames, []);
    } finally { fs.rmSync(h.root, { recursive: true, force: true }); }
});

for (const cap of [1024, 32768, 65536]) test(`private pin accepts exactly ${cap} bytes and refuses cap plus one`, async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "worker-byte-cap-"))), file = path.join(root, "bounded");
    try {
        const { readPin } = await filesystemComponent();
        fs.writeFileSync(file, Buffer.alloc(cap, 65), { mode: 0o600 });
        assert.equal(readPin(file, cap).bytes.length, cap);
        fs.appendFileSync(file, "x");
        assert.throws(() => readPin(file, cap), /unsafe file/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("worker passes refreshed reservation and exact durable start head to the default-child boundary", async () => {
    const h = await wrappedStartComponent("success");
    try {
        const created = await h.wrapped.admissions.createCanary(h.request);
        await h.wrapped.process.startRun({workflowId:h.loaded.suite.workflowId,task:h.loaded.suite.cases[0]!.task,releaseSha:h.input.sourceSha,admission:created.contexts[0]});
        assert.deepEqual(h.fixture.facts.startChild, {reservation:{...h.input,revision:8,phase:"active"},journal:{revision:4,hash:JSON.parse(fs.readFileSync(path.join(h.root,"manual-control-journals",h.input.jobId,"records/00000000000000000005.json"),"utf8")).previousHash}});
    } finally {fs.rmSync(h.root,{recursive:true,force:true});}
});

// Real private file/journal/proof functions with explicitly simulated selected
// custody and OS identity. These cases grant no compiled or OS authority.
async function startProofComponentFixture() {
    const h=await wrappedStartComponent("unused");
    const created=await h.wrapped.admissions.createCanary(h.request),context=created.contexts[0];
    await assert.rejects(()=>h.wrapped.process.startRun({workflowId:h.loaded.suite.workflowId,task:h.loaded.suite.cases[0]!.task,releaseSha:h.input.sourceSha,admission:context}),/CONTROL_START_UNRESOLVED/);
    fs.renameSync(path.join(h.root,"manual-control-journals"),path.join(h.root,"evals/manual-control-journals"));
    const canonical=await import("../../src/product-compiler/canonical-json.js"), channel=await import("../../src/execution/schemas/manual-control-worker-channel-v1.js");
    const record={schema:"setfarm.manual-evaluation-record.v1",reservation:{...h.input,revision:8,phase:"active"},owner,intentHash:"a".repeat(64),nonceDigest:"b".repeat(64),admissionHash:context.admissionHash,slots:created.contexts.map(({admissionHash,slotHash,caseHash,taskHash,repetition}:any)=>({admissionHash,slotHash,caseHash,taskHash,repetition})),executionMode:"execute"};
    const selected={directory:h.root,paths:{root:h.root,repository:h.root},assertUnchanged(){}};
    const childOwner={...owner,pid:124,script:path.join(h.root,"dist/cli/cli.js"),executable:fs.realpathSync(process.execPath)};
    const source=fs.readFileSync("src/execution/manual-test-admission-v1.ts","utf8"),tree=ts.createSourceFile("manual.ts",source,ts.ScriptTarget.Latest,true);
    const names=["Hash","StartChildProofSchemaV1","refuseV1","sameStatV1","pinParentsV1","assertParentsV1","readPrivateFileV1","stableV1","syncDirectoryV1","publishExclusiveV1","sameOwnerV1","digestV1","optionalStatV1","createChildV1","startProofPathV1","startJournalV1","publishSelectedManualStartChildV1","readStartChildProofV1"];
    const nodes=tree.statements.filter(node=>ts.isFunctionDeclaration(node)?names.includes(node.name?.text??""):ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&names.includes(d.name.text)));
    assert.equal(nodes.length,names.length);
    const body=ts.transpileModule(nodes.map(node=>node.getText(tree)).join("\n"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^export /gm,"");
    const {z}=await import("zod"),{createHash}=await import("node:crypto");
    const held={record,pin:null as any};
    const deps={fs,path,z,createHash,ReservationSchema:ManualReservationV1Schema,SlotSchema:ManualSlotV1Schema,OwnerSchema:ManualOwnerV1Schema,...canonical,...channel,process:new Proxy(process,{get(target,key){if(key==="pid")return 124;if(key==="ppid")return owner.pid;return Reflect.get(target,key);}}),selectionV1:()=>({selected}),rootV1:()=>({selected,root:path.join(h.root,"evals/manual-controls")}),heldV1:(reservation:any)=>{assert.deepEqual(reservation,record.reservation);return held;},observeStartChildV1:()=>childOwner,processOwnerV1:()=>owner};
    const api=new Function(...Object.keys(deps),body+";return {publishSelectedManualStartChildV1,readStartChildProofV1,readPrivateFileV1,startJournalV1};")(...Object.values(deps));
    const reservationPath=path.join(h.root,"evals/manual-controls/reservation.json"),intentPath=path.join(h.root,"intent.json");
    fs.writeFileSync(reservationPath,JSON.stringify(record)+"\n",{mode:0o600});fs.writeFileSync(intentPath,"{}\n",{mode:0o600});
    held.pin=api.readPrivateFileV1(reservationPath,65536,h.root);
    const custody={owner,intent:api.readPrivateFileV1(intentPath,32768,h.root)};
    const head=JSON.parse(fs.readFileSync(path.join(h.root,"evals/manual-control-journals",h.input.jobId,"head.json"),"utf8"));
    const descriptor={reservation:record.reservation,journal:{revision:head.revision,hash:head.recordHash}};
    const input={workflowId:h.loaded.suite.workflowId,task:h.loaded.suite.cases[0]!.task,releaseSha:h.input.sourceSha,admission:context};
    const child={pid:childOwner.pid,exitCode:null,signalCode:null,spawnfile:childOwner.executable,spawnargs:[childOwner.executable,childOwner.script,"workflow","run",input.workflowId,input.task,"--protocol","v3"]};
    const run={workflowId:input.workflowId,task:input.task,protocol:{canaryAdmission:context}};
    return {h,api,record,custody,descriptor,input,child,run,held,childOwner,proofPath:path.join(h.root,"evals/manual-controls/start-children",h.input.jobId,context.slotHash+".json")};
}
for(const fault of ["none","revision","head","earlier_record","foreign_slot","foreign_parent","duplicate","proof_drift"] as const) test(`private start proof binds durable current head, all-slot revision and exact child: ${fault}`,async()=>{
    const f=await startProofComponentFixture();
    try {
        if(fault==="revision")f.descriptor.reservation={...f.descriptor.reservation,revision:7};
        if(fault==="head")f.descriptor.journal.hash="f".repeat(64);
        if(fault==="earlier_record")fs.appendFileSync(path.join(f.h.root,"evals/manual-control-journals",f.h.input.jobId,"records/00000000000000000001.json")," ");
        if(fault==="foreign_slot")f.input.admission={...f.input.admission,slotHash:"f".repeat(64)};
        if(["revision","head","earlier_record","foreign_slot"].includes(fault)) {assert.throws(()=>f.api.publishSelectedManualStartChildV1(f.descriptor,f.input,f.child));assert.equal(fs.existsSync(f.proofPath),false);return;}
        const recheck=f.api.publishSelectedManualStartChildV1(f.descriptor,f.input,f.child);
        if(fault==="duplicate"){assert.throws(()=>f.api.publishSelectedManualStartChildV1(f.descriptor,f.input,f.child));return;}
        if(fault==="foreign_parent") {const proof=JSON.parse(fs.readFileSync(f.proofPath,"utf8"));proof.parentPid++;const {canonicalJsonStringify}=await import("../../src/product-compiler/canonical-json.js");fs.writeFileSync(f.proofPath,canonicalJsonStringify(proof)+"\n");await assert.rejects(()=>f.api.readStartChildProofV1(f.held,f.custody,f.run));return;}
        const observed=await f.api.readStartChildProofV1(f.held,f.custody,f.run);assert.deepEqual(observed.child,f.childOwner);observed.assertUnchanged();
        if(fault==="proof_drift") {fs.appendFileSync(f.proofPath," ");assert.throws(recheck);assert.throws(()=>observed.assertUnchanged());return;}
        recheck();const proof=JSON.parse(fs.readFileSync(f.proofPath,"utf8"));assert.equal(proof.reservation.revision,8);assert.equal(proof.journal.revision,4);assert.equal(JSON.stringify(proof).includes(f.input.admission.slotToken),false);
    } finally {fs.rmSync(f.h.root,{recursive:true,force:true});}
});

test("worker waits through known canonical delivery drain then releases and closes once",async()=>{
    const h=await wrappedStartComponent("success",{failure:"pending_delivery"});
    try {
        await h.wrapped.admissions.createCanary(h.request);
        await h.execution.finish({},"cancelled","a".repeat(64),owner);
        assert.deepEqual(h.fixture.facts.events,["settlement","settlement_wait","settlement","settlement_wait","settlement","release:8","close"]);
    } finally {fs.rmSync(h.root,{recursive:true,force:true});}
});

for (const failure of ["forever_pending", "unknown_settlement"] as const) test(`worker ${failure} retains custody without release or another start`, async () => {
    const h = await wrappedStartComponent("success", {failure});
    try {
        await h.wrapped.admissions.createCanary(h.request);
        await assert.rejects(() => h.execution.finish({}, "cancelled", "a".repeat(64), owner), /CONTROL_SETTLEMENT_UNCERTAIN/);
        assert.equal(h.fixture.facts.events.some((event: string) => event.startsWith("release") || event === "close"), false);
        assert.equal(h.fixture.facts.settlementReads, failure === "unknown_settlement" ? 1 : 12);
        assert.ok(h.fixture.facts.events.filter((event: string) => event === "settlement_wait").length <= 11);
        assert.equal(h.starts(),0); assert.equal(h.promotions(),0);
    } finally { fs.rmSync(h.root,{recursive:true,force:true}); }
});
