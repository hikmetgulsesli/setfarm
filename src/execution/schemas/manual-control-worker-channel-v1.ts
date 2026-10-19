import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { canonicalJsonStringify, hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { parseInternalCanaryAdmissionContext, type InternalCanaryAdmissionContextV1 } from "../v3-release-admission.js";
import { ControlJobKindV1Schema, ControlJobReceiptV1Schema, ControlReportRefsV1Schema, ControlWorkerCustodyV1Schema, } from "./manual-control-job-v1.js";
export const CONTROL_WORKER_CHANNEL_MAX_BYTES_V1 = 16384;
export const CONTROL_WORKER_JOURNAL_RECORD_MAX_BYTES_V1 = 65536;
export const CONTROL_WORKER_JOURNAL_HEAD_MAX_BYTES_V1 = 1024;
export const CONTROL_WORKER_JOURNAL_MAX_RECORDS_V1 = 1024;
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Source = z.string().regex(/^[a-f0-9]{40}$/);
const Id = z.string().uuid().refine(value => value === value.toLowerCase());
const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Positive = Count.refine(value => value > 0);
const Time = z.string().datetime().refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const Absolute = z.string().min(1).max(4096).refine(value => path.isAbsolute(value) && path.normalize(value) === value && !/[\u0000-\u001f\u007f]/.test(value));
const RunId = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/);
const CatalogCaseId = z.enum(["utility-status-baseline", "utility-preference-compositional", "operations-work-baseline", "operations-queue-paraphrase", "game-start-baseline", "game-restart-compositional", "negative-ambiguous-product", "negative-unsupported-kernel"]);
const CaseId = z.string().refine(value => CatalogCaseId.safeParse(value).success);
const Phase = z.enum(["starting", "acquired", "preflight", "admission", "case_start", "case_running", "case_collect", "publishing", "finalizing", "settling", "released", "closed", "ownership_unknown"]);
const FatalCode = z.enum(["CONTROL_CHANNEL_INVALID", "CONTROL_CHANNEL_UNAVAILABLE", "CONTROL_JOURNAL_FAILED", "CONTROL_CUSTODY_UNCERTAIN", "CONTROL_BINDING_FAILED", "CONTROL_START_UNRESOLVED", "CONTROL_PROMOTION_UNCERTAIN", "CONTROL_SETTLEMENT_UNCERTAIN"]);
export type ControlWorkerFatalCodeV1 = z.infer<typeof FatalCode>;
export const ControlWorkerSafeCodeV1Schema = z.enum([...FatalCode.options, "CONTROL_CANCEL_TOO_LATE", "CONTROL_CANCEL_REQUESTED", "CONTROL_JOB_BLOCKED", "CONTROL_JOB_FAILED", "CONTROL_CHANNEL_READY"]);
export type ControlWorkerSafeCodeV1 = z.infer<typeof ControlWorkerSafeCodeV1Schema>;
const fatalInstances = new WeakSet<object>();
export class ControlWorkerFatalErrorV1 extends Error {
    readonly code: ControlWorkerFatalCodeV1;
    constructor(code: ControlWorkerFatalCodeV1) {
        const safeCode = FatalCode.parse(code);
        super(safeCode);
        this.name = "ControlWorkerFatalErrorV1";
        this.code = safeCode;
        fatalInstances.add(this);
    }
}
export function isControlWorkerFatalErrorV1(error: unknown): error is ControlWorkerFatalErrorV1 {
    return error instanceof ControlWorkerFatalErrorV1 && fatalInstances.has(error);
}
export const ObservedControlWorkerOwnerV1Schema = z.object({ pid: Positive, processStartedAt: Time, processGroupId: Positive, source: z.literal("observed_os"), executable: Absolute, script: Absolute, commandHash: Hash }).strict();
export type ObservedControlWorkerOwnerV1 = Readonly<z.infer<typeof ObservedControlWorkerOwnerV1Schema>>;
export const WorkerJournalRefV1Schema = z.object({ revision: Positive.refine(value => value <= CONTROL_WORKER_JOURNAL_MAX_RECORDS_V1), hash: Hash }).strict();
export type WorkerJournalRefV1 = Readonly<z.infer<typeof WorkerJournalRefV1Schema>>;
export const WorkerChannelBindingV1Schema = z.object({ jobId: Id, channelId: Id, intentHash: Hash, kind: ControlJobKindV1Schema }).strict();
export type WorkerChannelBindingV1 = Readonly<z.infer<typeof WorkerChannelBindingV1Schema>>;
const Direction = z.enum(["broker_to_worker", "worker_to_broker"]);
export type WorkerChannelDirectionV1 = z.infer<typeof Direction>;
const Outcome = z.enum(["completed", "failed", "blocked", "cancelled"]);
const SfCount = Count.refine(value => value <= 8);
const UiCount = Count.refine(value => value <= 2048);
const UiBody = z.discriminatedUnion("type", [
    z.object({ type: z.literal("ui_ready"), owner: ObservedControlWorkerOwnerV1Schema, fixtureVersion: RunId, fixtureHash: Hash, plannedAssertions: UiCount }).strict(),
    z.object({ type: z.literal("ui_progress"), phase: z.enum(["starting", "running", "publishing", "cleanup"]), completedAssertions: UiCount, plannedAssertions: UiCount, code: ControlWorkerSafeCodeV1Schema.nullable() }).strict(),
    z.object({ type: z.literal("ui_cancel_observed"), requestId: Id, effective: z.enum(["latched", "after_boundary"]) }).strict(),
    z.object({ type: z.literal("ui_final"), uiReportHash: Hash, cleanupHash: Hash, ownedCleanup: z.literal("confirmed"), outcome: Outcome, code: ControlWorkerSafeCodeV1Schema.nullable(), completedAssertions: UiCount, plannedAssertions: UiCount }).strict(),
]);
export const UiRegressionWorkerBodyV1Schema = UiBody.superRefine((v, c) => {
    if ("completedAssertions" in v && v.completedAssertions > v.plannedAssertions)
        c.addIssue({ code: "custom", message: "Completed assertions exceed plan" });
});
export type UiRegressionWorkerBodyV1 = Readonly<z.infer<typeof UiRegressionWorkerBodyV1Schema>>;
const SfBody = z.discriminatedUnion("type", [
    z.object({ type: z.literal("custody"), custody: ControlWorkerCustodyV1Schema }).strict(),
    z.object({ type: z.literal("ready"), owner: ObservedControlWorkerOwnerV1Schema, journal: z.null() }).strict(),
    z.object({ type: z.literal("progress"), journal: WorkerJournalRefV1Schema.nullable(), phase: Phase, currentCaseId: CaseId.nullable(), ownedRunId: RunId.nullable(), completedCases: SfCount, code: ControlWorkerSafeCodeV1Schema.nullable() }).strict(),
    z.object({ type: z.literal("ack"), workerSequence: Positive, workerFrameHash: Hash, receiptRevision: Count, receipt: ControlJobReceiptV1Schema }).strict(),
    z.object({ type: z.literal("cancel"), requestId: Id, acceptedReceiptRevision: Count }).strict(),
    z.object({ type: z.literal("cancel_observed"), requestId: Id, journal: WorkerJournalRefV1Schema, effective: z.enum(["latched", "after_boundary"]) }).strict(),
    z.object({ type: z.literal("fault"), code: ControlWorkerSafeCodeV1Schema, phase: Phase, journal: WorkerJournalRefV1Schema.nullable() }).strict(),
    z.object({ type: z.literal("final_closed"), journal: WorkerJournalRefV1Schema.nullable(), closureHash: Hash, outcome: Outcome, code: ControlWorkerSafeCodeV1Schema.nullable(), completedCases: SfCount, reportRefs: ControlReportRefsV1Schema, finalization: z.enum(["no_promotion", "promotion_confirmed", "cancelled_before_boundary", "never_reserved"]) }).strict(),
]);
export const WorkerChannelBodyV1Schema = z.union([SfBody, UiRegressionWorkerBodyV1Schema]).superRefine((v, c) => {
    if (v.type === "ack" && v.receiptRevision !== v.receipt.revision)
        c.addIssue({ code: "custom", message: "ACK receipt revision mismatch" });
    if (v.type === "final_closed") {
        if (v.reportRefs.uiReportHash)
            c.addIssue({ code: "custom", message: "SF closure cannot publish UI evidence" });
        if (v.journal === null && (v.finalization !== "never_reserved" || v.completedCases !== 0 || Object.keys(v.reportRefs).length !== 0))
            c.addIssue({ code: "custom", message: "Unreserved closure has no journal or report" });
        if (v.journal !== null && v.finalization === "never_reserved")
            c.addIssue({ code: "custom", message: "Reserved closure needs final decision" });
        if (v.finalization === "promotion_confirmed" && (v.outcome !== "completed" || !v.reportRefs.resultHash || !v.reportRefs.gateHash))
            c.addIssue({ code: "custom", message: "Promotion needs completed linked reports" });
    }
});
export type WorkerChannelBodyV1 = Readonly<z.infer<typeof WorkerChannelBodyV1Schema>>;
export const WorkerChannelEnvelopeV1Schema = z.object({ schema: z.literal("setfarm.manual-control-worker-channel.v1"), jobId: Id, channelId: Id, intentHash: Hash, direction: Direction, sequence: Positive, body: WorkerChannelBodyV1Schema, mac: Hash }).strict();
export type WorkerChannelEnvelopeV1 = Readonly<z.infer<typeof WorkerChannelEnvelopeV1Schema>>;
function contextual(frame: WorkerChannelEnvelopeV1, binding: WorkerChannelBindingV1, direction: WorkerChannelDirectionV1, nonce: string): void {
    if (frame.jobId !== binding.jobId || frame.channelId !== binding.channelId || frame.intentHash !== binding.intentHash || frame.direction !== direction)
        throw new Error("binding");
    const body = frame.body;
    const broker = ["custody", "ack", "cancel"].includes(body.type);
    if (broker !== (direction === "broker_to_worker"))
        throw new Error("direction");
    if (!["custody", "ack", "cancel", "fault"].includes(body.type) && body.type.startsWith("ui_") !== (binding.kind === "ui_regression"))
        throw new Error("kind");
    if (body.type === "custody" && (body.custody.jobId !== binding.jobId || body.custody.nonce !== nonce))
        throw new Error("custody");
    if (body.type === "ack" && (body.receipt.jobId !== binding.jobId || body.receipt.kind !== binding.kind))
        throw new Error("receipt");
    if (body.type === "fault" && binding.kind === "ui_regression" && body.journal !== null)
        throw new Error("journal");
    if (body.type === "final_closed" && ((binding.kind === "activation_preflight" && (body.reportRefs.resultHash || body.reportRefs.gateHash || body.completedCases !== 0)) || (binding.kind === "convergence_full8" && body.reportRefs.activationHash)))
        throw new Error("refs");
}
export function signWorkerChannelFrameV1(input: Readonly<{
    binding: WorkerChannelBindingV1;
    direction: WorkerChannelDirectionV1;
    sequence: number;
    body: WorkerChannelBodyV1;
    nonce: string;
}>): WorkerChannelEnvelopeV1 {
    try {
        const binding = WorkerChannelBindingV1Schema.parse(input.binding);
        ControlWorkerCustodyV1Schema.shape.nonce.parse(input.nonce);
        const { kind: _kind, ...header } = binding;
        const parsed = WorkerChannelEnvelopeV1Schema.parse({ schema: "setfarm.manual-control-worker-channel.v1", ...header, direction: input.direction, sequence: input.sequence, body: input.body, mac: "0".repeat(64) });
        contextual(parsed, binding, input.direction, input.nonce);
        const { mac: _mac, ...payload } = parsed;
        const frame = { ...payload, mac: createHmac("sha256", input.nonce).update(canonicalJsonStringify(payload)).digest("hex") };
        if (Buffer.byteLength(canonicalJsonStringify(frame)) > CONTROL_WORKER_CHANNEL_MAX_BYTES_V1)
            throw new Error("size");
        return frame;
    }
    catch {
        throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID");
    }
}
export function verifyWorkerChannelFrameV1(input: Readonly<{
    frame: unknown;
    binding: WorkerChannelBindingV1;
    direction: WorkerChannelDirectionV1;
    nonce: string;
}>): WorkerChannelEnvelopeV1 {
    try {
        if (Buffer.byteLength(JSON.stringify(input.frame)) > CONTROL_WORKER_CHANNEL_MAX_BYTES_V1 || Buffer.byteLength(canonicalJsonStringify(input.frame)) > CONTROL_WORKER_CHANNEL_MAX_BYTES_V1)
            throw new Error("size");
        const frame = WorkerChannelEnvelopeV1Schema.parse(input.frame);
        const expected = signWorkerChannelFrameV1({ ...input, sequence: frame.sequence, body: frame.body });
        contextual(frame, input.binding, input.direction, input.nonce);
        if (!timingSafeEqual(Buffer.from(frame.mac, "hex"), Buffer.from(expected.mac, "hex")))
            throw new Error("mac");
        return frame;
    }
    catch {
        throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID");
    }
}
export function hashWorkerChannelFrameV1(frame: WorkerChannelEnvelopeV1): string { return hashCanonicalJson(WorkerChannelEnvelopeV1Schema.parse(frame)); }
export function hashObservedControlWorkerOwnerV1(owner: ObservedControlWorkerOwnerV1): string { return hashCanonicalJson(ObservedControlWorkerOwnerV1Schema.parse(owner)); }
const Case = z.object({ caseId: CaseId, caseHash: Hash, taskHash: Hash, repetition: z.literal(1) }).strict();
const Context = z.custom<InternalCanaryAdmissionContextV1>(value => parseInternalCanaryAdmissionContext(JSON.stringify(value)) !== null).refine(value => value.repetition === 1);
const slots = z.array(Case.extend({ slotToken: ControlWorkerCustodyV1Schema.shape.nonce }).strict()).length(8).refine(values => new Set(values.map(v => v.caseId)).size === 8);
const contexts = z.array(z.object({ caseId: CaseId, context: Context }).strict()).length(8).refine(values => new Set(values.map(v => v.caseId)).size === 8 && new Set(values.map(v => v.context.slotHash)).size === 8 && new Set(values.map(v => v.context.admissionHash)).size === 1);
export const WorkerJournalEventV1Schema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("acquired"), kind: z.enum(["activation_preflight", "convergence_full8"]), selectionHash: Hash, sourceSha: Source, suiteHash: Hash.nullable(), executionMode: z.enum(["preflight", "execute"]), owner: ObservedControlWorkerOwnerV1Schema, origin: z.enum(["mission_control", "direct"]), reservationRevision: Positive }).strict(),
    z.object({ type: z.literal("phase"), phase: Phase, currentCaseId: CaseId.nullable(), completedCases: SfCount }).strict(),
    z.object({ type: z.literal("canary_create_requested"), releaseSha: Source, suiteHash: Hash, preflightHash: Hash, ttlMs: Positive, slots }).strict(),
    z.object({ type: z.literal("canary_bound"), contexts, reservationRevision: Positive }).strict(),
    z.object({ type: z.literal("start_requested"), case: Case, admissionHash: Hash, slotHash: Hash }).strict(),
    z.object({ type: z.literal("run_bound"), case: Case, admissionHash: Hash, slotHash: Hash, runId: RunId, runNumber: Positive, source: z.enum(["start_response", "consumed_claim"]) }).strict(),
    z.object({ type: z.literal("run_result_stored"), case: Case, runId: RunId, resultHash: Hash }).strict(),
    z.object({ type: z.literal("cancel_latched"), source: z.enum(["operator", "channel_lost"]), requestId: Id.nullable() }).strict(),
    z.object({ type: z.literal("stop_requested"), runId: RunId, snapshotHash: Hash }).strict(),
    z.object({ type: z.literal("stop_observed"), runId: RunId, result: z.enum(["requested", "already_terminal", "refused"]), code: ControlWorkerSafeCodeV1Schema.nullable() }).strict(),
    z.object({ type: z.literal("artifacts_stored"), stage: z.enum(["candidate", "cancelled_final", "promotion_confirmed", "final_without_promotion"]), resultHash: Hash, gateHash: Hash, resultStatus: z.enum(["planned", "pass", "fail", "blocked"]), gateDecision: z.enum(["go", "no_go"]) }).strict(),
    z.object({ type: z.literal("finalization_boundary"), resultHash: Hash, gateHash: Hash, gateDecision: z.enum(["go", "no_go"]), decision: z.enum(["cancel", "continue"]) }).strict(),
    z.object({ type: z.literal("released"), heldRevision: Positive }).strict(),
    z.object({ type: z.literal("closed"), closureHash: Hash, outcome: Outcome, reportRefs: ControlReportRefsV1Schema }).strict(),
    z.object({ type: z.literal("fault"), code: FatalCode, phase: Phase }).strict(),
]).superRefine((v, c) => {
    if (v.type === "acquired" && (v.kind === "convergence_full8") !== (v.suiteHash !== null))
        c.addIssue({ code: "custom", message: "Suite kind mismatch" });
    if (v.type === "cancel_latched" && (v.source === "operator") !== (v.requestId !== null))
        c.addIssue({ code: "custom", message: "Cancellation source mismatch" });
    if (v.type === "closed" && v.reportRefs.uiReportHash)
        c.addIssue({ code: "custom", message: "SF journal cannot publish UI evidence" });
});
export type WorkerJournalEventV1 = Readonly<z.infer<typeof WorkerJournalEventV1Schema>>;
export const WorkerJournalRecordV1Schema = z.object({ schema: z.literal("setfarm.manual-control-journal-record.v1"), jobId: Id, intentHash: Hash, ownerHash: Hash, revision: Positive.refine(v => v <= CONTROL_WORKER_JOURNAL_MAX_RECORDS_V1), previousHash: Hash.nullable(), event: WorkerJournalEventV1Schema }).strict().superRefine((v, c) => {
    if ((v.revision === 1) !== (v.previousHash === null) || (v.revision === 1) !== (v.event.type === "acquired"))
        c.addIssue({ code: "custom", message: "Journal initial record mismatch" });
});
export type WorkerJournalRecordV1 = Readonly<z.infer<typeof WorkerJournalRecordV1Schema>>;
export const WorkerJournalHeadV1Schema = z.object({ schema: z.literal("setfarm.manual-control-journal-head.v1"), jobId: Id, revision: Positive.refine(v => v <= CONTROL_WORKER_JOURNAL_MAX_RECORDS_V1), recordHash: Hash }).strict();
export type WorkerJournalHeadV1 = Readonly<z.infer<typeof WorkerJournalHeadV1Schema>>;
function encode<T>(schema: z.ZodType<T>, value: T, cap: number): Uint8Array {
    const bytes = Buffer.from(canonicalJsonStringify(schema.parse(value)) + "\n");
    if (bytes.length > cap)
        throw new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
    return bytes;
}
function decode<T>(schema: z.ZodType<T>, bytes: Uint8Array, cap: number): T {
    if (bytes.length > cap)
        throw new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
    const parsed = schema.parse(JSON.parse(Buffer.from(bytes).toString("utf8")));
    if (!Buffer.from(bytes).equals(Buffer.from(encode(schema, parsed, cap))))
        throw new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
    return parsed;
}
export function serializeWorkerJournalRecordV1(record: WorkerJournalRecordV1): Uint8Array { return encode(WorkerJournalRecordV1Schema, record, CONTROL_WORKER_JOURNAL_RECORD_MAX_BYTES_V1); }
export function parseWorkerJournalRecordV1(bytes: Uint8Array): WorkerJournalRecordV1 { return decode(WorkerJournalRecordV1Schema, bytes, CONTROL_WORKER_JOURNAL_RECORD_MAX_BYTES_V1); }
export function hashWorkerJournalRecordV1(record: WorkerJournalRecordV1): string { return createHash("sha256").update(serializeWorkerJournalRecordV1(record)).digest("hex"); }
export function serializeWorkerJournalHeadV1(head: WorkerJournalHeadV1): Uint8Array { return encode(WorkerJournalHeadV1Schema, head, CONTROL_WORKER_JOURNAL_HEAD_MAX_BYTES_V1); }
export function parseWorkerJournalHeadV1(bytes: Uint8Array): WorkerJournalHeadV1 { return decode(WorkerJournalHeadV1Schema, bytes, CONTROL_WORKER_JOURNAL_HEAD_MAX_BYTES_V1); }
