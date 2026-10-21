import { createHash } from "node:crypto";
import path from "node:path";
import { types } from "node:util";
import { z } from "zod";
import { canonicalJsonStringify } from "../../product-compiler/canonical-json.js";
import { GitObjectHashSchema, StoryIdSchema } from "../../product-compiler/schemas/common-v1.js";
import { FindingSetV1Schema, FindingV1Schema, FindingOriginV1Schema } from "../../findings/finding-set.js";
import { ConvergenceEvalResultVersionedSchema, ConvergenceEvalRunResultVersionedSchema } from "../../evals/result-schema-v2.js";
import { ConvergenceReleaseGateV1Schema } from "../../evals/release-gate.js";
import { validateInternalProductionOwnerReservationCloseV1 } from "../../internal-production/owner-admission-v1.js";
import { V3ReleaseAdmissionV1Schema } from "../v3-release-admission.js";
import { ControlSelectionIdentityV1Schema, ControlPrivateIntentV1Schema, ControlJobReceiptV1Schema, ControlReportRefsV1Schema } from "./manual-control-job-v1.js";
import { WorkerJournalRecordV1Schema, WorkerJournalHeadV1Schema, parseWorkerJournalRecordV1, parseWorkerJournalHeadV1,
  CONTROL_WORKER_JOURNAL_MAX_RECORDS_V1 } from "./manual-control-worker-channel-v1.js";
import { ManualAcquireV1Schema, ManualReservationV1Schema, ManualOwnerV1Schema, ManualSlotV1Schema,
  ManualRecordV1Schema, ManualClosureV1Schema } from "./manual-evaluation-record-v1.js";

export type ManualOrphanRefusalCodeV1 = "MALFORMED" | "SOURCE" | "TARGET" | "HISTORY" | "AUTHENTICATION"
  | "SETTLEMENT" | "JOURNAL" | "ACTIVITY" | "FINDINGS" | "SLOTS" | "NATIVE" | "OTHER_OWNER" | "CAS" | "PUBLICATION" | "UNCERTAIN";
export type ManualOrphanVerdictV1 = Readonly<{ status: "eligible"; evidenceHash: string; priorRecordHash: string; releasedRecordHash: string }
  | { status: "refused"; code: ManualOrphanRefusalCodeV1 }>;

const MiB = 1024 * 1024;
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Source = z.string().regex(/^[a-f0-9]{40}$/);
const Id = z.string().uuid().refine(value => value === value.toLowerCase());
const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const UTC = z.string().datetime().refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const Absolute = z.string().min(1).max(4096).refine(value => path.isAbsolute(value) && path.normalize(value) === value && !/[\u0000-\u001f\u007f]/.test(value));
const Relative = z.string().min(1).max(4096).refine(value => !value.startsWith("/") && !/[\\\u0000-\u001f\u007f]/.test(value)
  && value.split("/").every(part => part !== "" && part !== "." && part !== ".."));
const RootRelative = z.union([z.literal(""), Relative]);
const RunId = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/);
const Ref = z.string().min(1).max(4000).regex(/^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/);
const TerminalRef = z.string().min(1).max(12519).regex(/^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/);
const Decimal = z.string().max(30).regex(/^(0|[1-9][0-9]*)$/);
const Name = z.string().min(1).max(63).refine(v => !v.includes("\0") && Buffer.byteLength(v) <= 63);
const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const equal = (a: unknown, b: unknown) => canonicalJsonStringify(a) === canonicalJsonStringify(b);

// Check descriptors before reading values, including array members. No getter,
// proxy trap, toJSON or coercion is invoked at this runtime trust boundary.
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
function detachJson(input: unknown): Json {
  let nodes = 0, bytes = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number): Json {
    if (++nodes > 2_000_000 || depth > 64) throw new Error("MALFORMED");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("MALFORMED"); return value; }
    if (typeof value === "string") {
      if (value.length > 24 * MiB || (bytes += Buffer.byteLength(value)) > 512 * MiB) throw new Error("MALFORMED");
      return value;
    }
    if (typeof value !== "object" || types.isProxy(value) || ancestors.has(value)) throw new Error("MALFORMED");
    const array = Array.isArray(value);
    if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) throw new Error("MALFORMED");
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.length > 65537 || keys.some(k => typeof k !== "string")) throw new Error("MALFORMED");
    ancestors.add(value);
    let result: Json;
    if (array) {
      const length = descriptors.length?.value;
      if (!Number.isSafeInteger(length) || length < 0 || length > 65536 || keys.length !== length + 1) throw new Error("MALFORMED");
      const items: Json[] = [];
      for (let i = 0; i < length; i++) {
        const d = descriptors[String(i)];
        if (!d || !d.enumerable || !("value" in d)) throw new Error("MALFORMED");
        items.push(visit(d.value, depth + 1));
      }
      result = items;
    } else {
      const object: { [key: string]: Json } = {};
      for (const key of keys as string[]) {
        const d = descriptors[key]!;
        if (!d.enumerable || !("value" in d)) throw new Error("MALFORMED");
        bytes += Buffer.byteLength(key);
        if (key.length > 4096 || bytes > 512 * MiB) throw new Error("MALFORMED");
        Object.defineProperty(object, key, { value: visit(d.value, depth + 1), enumerable: true, writable: true, configurable: true });
      }
      result = object;
    }
    ancestors.delete(value);
    return result;
  }
  return visit(input, 0);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") { for (const v of Object.values(value)) freeze(v); Object.freeze(value); }
  return value;
}
function parseData<T>(schema: z.ZodType<T>, input: unknown): T {
  const detached = detachJson(input);
  const parsed = schema.parse(detached);
  // Existing aliases must not silently normalize or retain unknown payloads.
  if (!equal(detached, parsed)) throw new Error("MALFORMED");
  return freeze(parsed);
}

// Derive the actual decoded size from canonical base64 without allocating a
// Buffer. Never trust a caller's declared byteLength for a resource boundary.
function encodedByteLength(encoded: unknown, cap: number): number {
  if (typeof encoded !== "string" || encoded.length > Math.ceil(cap / 3) * 4 || encoded.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("MALFORMED");
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const length = encoded.length / 4 * 3 - padding;
  if (length < 0 || length > cap) throw new Error("MALFORMED");
  if (padding) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const last = alphabet.indexOf(encoded[encoded.length - padding - 1]!);
    if (last < 0 || (last & (padding === 2 ? 15 : 3)) !== 0) throw new Error("MALFORMED");
  }
  return length;
}
function checkedByteLength(value: { base64: string; byteLength: number }, cap: number): number {
  const actual = encodedByteLength(value.base64, cap);
  if (!Number.isSafeInteger(value.byteLength) || value.byteLength !== actual) throw new Error("MALFORMED");
  return actual;
}
function decodeBytes(value: { base64: string; byteLength: number; sha256: string }, cap: number): Buffer {
  const actual = checkedByteLength(value, cap);
  const bytes = Buffer.from(value.base64, "base64");
  if (bytes.length !== actual || bytes.toString("base64") !== value.base64 || digest(bytes) !== value.sha256) throw new Error("MALFORMED");
  return bytes;
}
function bytesSchema(cap: number) { return z.object({ base64: z.string().max(Math.ceil(cap / 3) * 4), byteLength: Count.max(cap), sha256: Hash }).strict().superRefine((v, c) => {
  try { checkedByteLength(v, cap); }
  catch { c.addIssue({ code: "custom", message: "Byte bound mismatch" }); return; }
  // An allocation/runtime exception is not a continuable validation issue.
  decodeBytes(v, cap);
}); }
const Stat = z.object({ dev: Decimal, ino: Decimal, mode: Decimal, nlink: Decimal, uid: Decimal, gid: Decimal, size: Decimal, mtimeNs: Decimal, ctimeNs: Decimal }).strict();
const ParentPin = z.object({ relative: RootRelative, before: Stat, after: Stat }).strict();
const stableParentKeys = ["dev", "ino", "mode", "uid", "gid"] as const;
function fileSchema(cap: number) { return z.object({ relative: Relative, bytes: bytesSchema(cap), descriptorBefore: Stat, descriptorAfter: Stat, namedAfter: Stat,
  parents: z.array(ParentPin).min(1).max(32) }).strict().superRefine((v, c) => {
  const fail = () => c.addIssue({ code: "custom", message: "Private file pin mismatch" });
  const stat = v.descriptorBefore, root = v.parents[0];
  if (!root || !equal(stat, v.descriptorAfter) || !equal(stat, v.namedAfter) || stat.mode !== "33152" || stat.nlink !== "1"
    || stat.size !== String(v.bytes.byteLength) || v.bytes.byteLength === 0 || stat.uid !== root.before.uid) fail();
  const parts = v.relative.split("/").slice(0, -1), expected = ["", ...parts.map((_, i) => parts.slice(0, i + 1).join("/"))];
  if (!equal(expected, v.parents.map(p => p.relative))) fail();
  for (const p of v.parents) if (p.before.mode !== "16832" || p.before.uid !== root?.before.uid
    || stableParentKeys.some(k => p.before[k] !== p.after[k])) fail();
}); }
const FileData = fileSchema(16 * MiB);
type FileValue = z.infer<typeof FileData>;
function document<S extends z.ZodType>(schema: S, cap: number, encoding: "canonical" | "record" | "artifact" | "journal" | "head" = "canonical") {
  return z.object({ file: fileSchema(cap), value: schema }).strict().superRefine((v, c) => {
    try {
      // Zod child refinements can report continuable issues. Recheck all byte
      // bounds here before decoding, independently of the child's outcome.
      if (!("value" in v)) throw new Error("value");
      const bytes = decodeBytes(v.file.bytes, cap), text = bytes.toString("utf8");
      if (!Buffer.from(text).equals(bytes)) throw new Error("utf8");
      // Bound raw nesting before JSON.parse allocates its object graph.
      let depth = 0, quoted = false, escaped = false;
      for (const char of text) {
        if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; }
        else if (char === '"') quoted = true;
        else if (char === "{" || char === "[") { if (++depth > 64) throw new Error("depth"); }
        else if (char === "}" || char === "]") depth--;
      }
      const raw: unknown = JSON.parse(text), checked = schema.parse(detachJson(raw));
      if (!equal(raw, checked) || !equal(checked, v.value)) throw new Error("value");
      if (encoding === "journal") parseWorkerJournalRecordV1(bytes);
      else if (encoding === "head") parseWorkerJournalHeadV1(bytes);
      else if (encoding !== "artifact" && text !== (encoding === "record" ? JSON.stringify(checked) : canonicalJsonStringify(checked)) + "\n") throw new Error("encoding");
    } catch { c.addIssue({ code: "custom", message: "Document bytes and parsed value disagree" }); }
  });
}
const SourceAuthority = z.object({ branch: z.literal("main"), clean: z.literal(true), sha: GitObjectHashSchema,
  treeHash: GitObjectHashSchema, buildHash: Hash, originMainSha: GitObjectHashSchema }).strict();
const Request = z.object({ requestId: Id, jobId: Id, expectedRevision: z.literal(6), expectedRecordHash: Hash, expectedJournalHeadHash: Hash, expectedSettlementHash: Hash }).strict();
const ExitTuple = z.object({ code: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullable(),
  signal: z.string().min(1).max(128).refine(v => !/[\u0000-\u001f\u007f]/.test(v)).nullable() }).strict().refine(v => (v.code === null) !== (v.signal === null));
const StreamEnd = z.object({ endObserved: z.boolean(), closeObserved: z.boolean() }).strict();
const settlementErrors = ["CHILD_ERROR", "STDOUT_ERROR", "STDERR_ERROR", "STDOUT_LOG_ERROR", "STDERR_LOG_ERROR", "OWNER_BINDING_ERROR"] as const;
const Settlement = z.object({ schema: z.literal("mission-control.control-original-worker-settlement.v1"), subject: z.literal("original_fixed_node_worker"),
  jobId: Id, kind: z.enum(["activation_preflight", "convergence_full8", "ui_regression"]), channelId: Id, intentHash: Hash, selectionHash: Hash, sourceSha: Source,
  mcSourceSha: Source, mcBuildHash: Hash, executableHash: Hash, brokerPid: Positive, originalChild: ManualOwnerV1Schema.nullable(), ownerHash: Hash.nullable(),
  exit: ExitTuple.nullable(), processClose: ExitTuple.nullable(), stdout: StreamEnd, stderr: StreamEnd,
  errors: z.array(z.enum(settlementErrors)).max(6).refine(v => v.every((e, i) => i === 0 || settlementErrors.indexOf(e) > settlementErrors.indexOf(v[i - 1]!))),
  observedFactsComplete: z.boolean(), recordedAtUTC: UTC }).strict();
const Channel = z.object({ schema: z.literal("mission-control.control-channel.v1"), jobId: Id, intentHash: Hash, channelId: Id,
  originalChild: ManualOwnerV1Schema, readyFrameHash: Hash }).strict();
const Ack = z.object({ schema: z.literal("setfarm.manual-control-worker-channel.v1"), jobId: Id, channelId: Id, intentHash: Hash,
  direction: z.literal("broker_to_worker"), sequence: Positive,
  body: z.object({ type: z.literal("ack"), workerSequence: Positive, workerFrameHash: Hash, receiptRevision: Count, receipt: ControlJobReceiptV1Schema }).strict(), mac: Hash }).strict();
const Mapping = z.object({ sequence: Positive, hash: Hash, ack: Ack }).strict();
const ReceiptSnapshot = z.object({ receipt: ControlJobReceiptV1Schema, mapping: Mapping.nullable() }).strict();
const CancelAlias = z.object({ keyHash: Hash, expectedRevision: Positive }).strict();
const IndexCancel = z.object({ keyHash: Hash, requestId: Id, receipt: ControlJobReceiptV1Schema, aliases: z.array(CancelAlias).max(32) }).strict();
const IndexEntry = z.object({ keyHash: Hash, intentHash: Hash, published: z.boolean(), receipt: ControlJobReceiptV1Schema,
  frames: z.array(Mapping).max(64), cancel: IndexCancel.nullable() }).strict();
const IndexData = z.object({ schema: z.literal("mission-control.control-index.v1"), revision: Positive, jobs: z.array(IndexEntry).max(10000),
  history: z.array(z.object({ id: Hash, selectionHash: Hash, sourceSha: Source, refs: ControlReportRefsV1Schema }).strict()).max(10000) }).strict();
const CancelRecord = z.object({ schema: z.literal("mission-control.control-cancel.v1"), jobId: Id, intentHash: Hash, channelId: Id,
  requestId: Id, idempotencyKeyHash: Hash, acceptedReceiptRevision: Count, requestedAt: UTC }).strict();
const CancelReplay = CancelAlias.extend({ requestId: Id, receipt: ControlJobReceiptV1Schema }).strict();
const McEvidence = z.object({ index: document(IndexData, 8 * MiB), channel: document(Channel, 16384),
  receipts: z.array(document(ReceiptSnapshot, 32768)).min(1).max(4096), cancel: document(CancelRecord, 32768).nullable(),
  cancelReplays: z.array(document(CancelReplay, 32768)).max(32), settlement: document(Settlement, 16384) }).strict();

const Activity = z.object({ active_runs: Count, open_claims: Count, active_attempts: Count, active_attempt_binding_conflicts: Count,
  active_runtimes: Count, active_runtime_completions: Count, active_completion_effects: Count, active_recovery_cases: Count,
  active_recovery_deliveries: Count, active_termination_requests: Count, active_compilations: Count, active_publications: Count,
  active_publication_batches: Count, active_outbox: Count, active_operational_deliveries: Count, active_owner_reservations: Count }).strict();
const FindingParent = z.object({ finding_set_hash: Hash, finding_set_id: z.string().regex(/^FSET_[a-f0-9]{64}$/), run_id: z.string().min(1).max(500),
  story_id: StoryIdSchema, packet_hash: Hash, slice_hash: Hash, source_sha: GitObjectHashSchema, source_tree_hash: GitObjectHashSchema,
  finding_ids: z.array(z.string().regex(/^FIND_[a-f0-9]{64}$/)).max(5000), payload: FindingSetV1Schema }).strict();
const FindingChild = z.object({ finding_set_hash: Hash, finding_id: z.string().regex(/^FIND_[a-f0-9]{64}$/), origin: FindingOriginV1Schema,
  classification: z.enum(["structured", "unstructured_review"]), invariant_ref: z.string().min(5).max(200).regex(/^INV_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  status: z.enum(["open", "satisfied", "invalid", "superseded"]), source_fingerprint: Hash, payload: FindingV1Schema }).strict();
const Close = z.object({ schema: z.literal("setfarm.internal-production-owner-reservation-close.v1"), closeKind: z.enum(["ordinary", "fence-target"]),
  reservationRef: Ref, reservationHash: Hash, terminalOwnerRef: TerminalRef, terminalOwnerHash: Hash,
  ownerAdmissionHeadPredecessorHash: Hash, ownerAdmissionHeadSuccessorHash: Hash, preservedFenceRef: Ref.nullable(), preservedFenceHash: Hash.nullable(),
  closeRef: Ref, closeHash: Hash }).strict().superRefine((v, c) => {
    try { validateInternalProductionOwnerReservationCloseV1(v); } catch { c.addIssue({ code: "custom", message: "Invalid owner close" }); }
  });
const CanonicalRunIdentity = z.object({ schema: z.literal("setfarm.internal-production-canonical-owner-identity.v1"), category: z.literal("run"),
  ownerKey: RunId, ownerRef: Ref, ownerHash: Hash }).strict();
const TerminalPair = z.object({ runOwnerReservationRef: Ref, runOwnerReservationHash: Hash, terminalAuthorityRef: Ref, terminalAuthorityHash: Hash }).strict();
const SlotEvidence = z.object({ slot: ManualSlotV1Schema,
  admissionRows: z.array(z.object({ payload: V3ReleaseAdmissionV1Schema, expires_at: UTC, expired: z.boolean() }).strict()).max(2),
  claimRows: z.array(z.object({ run_id: RunId.nullable(), consumed_at: UTC.nullable(), admission_hash: Hash, admission_kind: z.literal("convergence_canary"),
    case_hash: Hash, task_hash: Hash, repetition: z.literal(1), selector_hash: Hash }).strict()).max(2),
  runRows: z.array(z.object({ id: RunId, status: z.enum(["completed", "failed", "cancelled"]), protocol: z.literal("v3"), protocol_version: z.literal(1),
    compiler_release_sha: Source, release_admission_hash: Hash, task: z.string().max(MiB).refine(v => Buffer.byteLength(v) <= MiB) }).strict()).max(2),
  ownerRows: z.array(z.object({ state: z.literal("closed"), close_ref: Ref, close_hash: Hash, canonical_owner_identity: CanonicalRunIdentity }).strict()).max(2),
  terminalPair: TerminalPair.nullable(), close: Close.nullable() }).strict();
const ReleaseGoRow = z.object({ admission_hash: Hash, kind: z.literal("release_go"), release_sha: GitObjectHashSchema, suite_hash: Hash,
  result_hash: Hash, result_ref: z.string().min(1).max(4096), gate_hash: Hash, gate_ref: z.string().min(1).max(4096), expires_at: z.null(), payload: V3ReleaseAdmissionV1Schema }).strict();
const DatabaseEvidence = z.object({ observedAtStartUTC: UTC, observedAtEndUTC: UTC, databaseName: Name, currentUser: Name, sessionUser: Name,
  ownerOid: Positive, runtimeOid: Positive, backendPid: Positive, activityRows: z.array(Activity).max(2), findingParents: z.array(FindingParent).max(4096),
  findingChildren: z.array(FindingChild).max(65536), slots: z.array(SlotEvidence).length(8), releaseGoRows: z.array(ReleaseGoRow).max(4096) }).strict();

const captureStream = (cap: number) => z.object({ bytes: bytesSchema(cap), dataBytesObserved: Count, endObserved: z.boolean(), closeObserved: z.boolean() }).strict();
const NativeCapture = z.object({ captureId: Id, collector: ManualOwnerV1Schema, executable: z.literal("/bin/ps"), argv: z.array(z.string().max(4096)).max(16), cwd: Absolute,
  executorPid: Positive, executorParentPid: Positive, invokedAtUTC: UTC, spawnObservedAtUTC: UTC.nullable(), exitObservedAtUTC: UTC.nullable(), closeObservedAtUTC: UTC.nullable(),
  exit: ExitTuple.nullable(), processClose: ExitTuple.nullable(), stdout: captureStream(4 * MiB), stderr: captureStream(65536),
  errors: z.array(z.enum(["SPAWN_ERROR", "CHILD_ERROR", "STDOUT_ERROR", "STDERR_ERROR", "TIMEOUT", "OUTPUT_LIMIT"])).max(6).refine(v => new Set(v).size === v.length) }).strict()
  .refine(v => v.stdout.bytes.byteLength <= 4 * MiB && v.stderr.bytes.byteLength <= 65536);
const IdentityCapture = z.object({ subject: z.enum(["collector", "dashboard", "spawner"]), expected: ManualOwnerV1Schema,
  before: NativeCapture, comm: NativeCapture, after: NativeCapture }).strict();
const ServiceRecord = z.object({ schema: z.literal("setfarm.fresh-service-process.v1"), service: z.enum(["dashboard", "spawner"]), installationDirectory: Absolute,
  sourceSha: Source, executable: Absolute, script: Absolute, ownerIdentity: z.object({ schema: z.literal("setfarm.process-identity.v1"), pid: Positive,
    processStartedAt: UTC, processGroupId: Positive, source: z.literal("observed_os") }).strict() }).strict();
const ServiceObservation = z.discriminatedUnion("status", [
  z.object({ service: z.enum(["dashboard", "spawner"]), status: z.literal("absent") }).strict(),
  z.object({ service: z.enum(["dashboard", "spawner"]), status: z.literal("present"), lock: document(ServiceRecord, 8192, "record"), pidFile: fileSchema(32), identity: IdentityCapture }).strict(),
]);
const NativeSnapshot = z.object({ snapshotId: Id, observedAtStartUTC: UTC, observedAtEndUTC: UTC, collector: ManualOwnerV1Schema,
  census: NativeCapture, collectorIdentity: IdentityCapture, services: z.array(ServiceObservation).length(2) }).strict();
const StartChild = z.object({ schema: z.literal("setfarm.manual-start-child.v1"), reservation: ManualReservationV1Schema, intentHash: Hash,
  owner: ManualOwnerV1Schema, child: ManualOwnerV1Schema, parentPid: Positive, journal: z.object({ revision: Positive.max(1024), hash: Hash }).strict(),
  slot: ManualSlotV1Schema, caseId: z.string().min(1).max(128), workflowId: z.string().min(1).max(128) }).strict();
// Original direct producer writes schema first, then the Acquire fields.
const DirectIntent = z.object({ schema: z.literal("setfarm.manual-direct-evaluation-intent.v1"), ...ManualAcquireV1Schema.shape,
  kind: z.literal("convergence_full8"), suiteHash: Hash,
  executionMode: z.enum(["preflight", "execute"]), owner: ManualOwnerV1Schema, nonceDigest: Hash }).strict();
const ClosureDocument = document(ManualClosureV1Schema, 16384, "record");
const OtherIntent = z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("mission_control"), jobId: Id, intent: document(ControlPrivateIntentV1Schema, 32768), closure: ClosureDocument.nullable() }).strict(),
  z.object({ origin: z.literal("direct"), jobId: Id, intent: document(DirectIntent, 32768, "record"), closure: ClosureDocument.nullable() }).strict(),
]);
const Basename = z.string().min(1).max(4096).refine(v => v !== "." && v !== ".." && !/[\/\\\u0000-\u001f\u007f]/.test(v));
const NamespaceEvidence = z.object({ directories: z.array(z.object({ relative: RootRelative, names: z.array(Basename).max(4096).refine(v => new Set(v).size === v.length) }).strict()).max(4096),
  otherIntents: z.array(OtherIntent).max(4096), closures: z.array(ClosureDocument).max(4096), startChildren: z.array(document(StartChild, 65536)).max(8),
  mutationFiles: z.array(FileData).max(4096), retirementFiles: z.array(FileData).max(4096), buildMaintenanceFiles: z.array(FileData).max(4096), unexpectedFiles: z.array(FileData).max(4096) }).strict();
const Artifact = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("eval_result"), document: document(ConvergenceEvalResultVersionedSchema, 16 * MiB, "artifact") }).strict(),
  z.object({ kind: z.literal("run_result"), document: document(ConvergenceEvalRunResultVersionedSchema, 16 * MiB, "artifact") }).strict(),
  z.object({ kind: z.literal("release_gate"), document: document(ConvergenceReleaseGateV1Schema, 16 * MiB, "artifact") }).strict(),
]);
const TargetData = z.object({ selection: ControlSelectionIdentityV1Schema, source: SourceAuthority, databaseName: Name, runtimeRole: Name, ownerRole: Name,
  ownerOid: Positive, runtimeOid: Positive, nodeExecutable: Absolute, nodeExecutableHash: Hash, mcSourceSha: Source, mcBuildHash: Hash }).strict();
const RecordDocument = document(ManualRecordV1Schema, 65536, "record");
const Evidence = z.object({ schema: z.literal("setfarm.manual-control-orphan-evidence.v1"), request: Request, maintenanceSource: SourceAuthority,
  maintenanceOwner: ManualOwnerV1Schema, target: TargetData, history: z.array(RecordDocument).max(6), reservation: RecordDocument,
  intent: document(ControlPrivateIntentV1Schema, 32768), mc: McEvidence,
  journal: z.array(document(WorkerJournalRecordV1Schema, 65536, "journal")).max(CONTROL_WORKER_JOURNAL_MAX_RECORDS_V1), journalHead: document(WorkerJournalHeadV1Schema, 1024, "head"),
  database: DatabaseEvidence, artifacts: z.array(Artifact).max(64), namespace: NamespaceEvidence, nativeBefore: NativeSnapshot, nativeAfter: NativeSnapshot }).strict();

export type ManualOrphanEvidenceV1 = z.infer<typeof Evidence>;
export type ManualOrphanRequestV1 = z.infer<typeof Request>;
export type ManualOrphanSettlementV1 = z.infer<typeof Settlement>;
export function parseManualOrphanRequestV1(input: unknown): ManualOrphanRequestV1 { return parseData(Request, input); }
export function parseManualOrphanSettlementV1(input: unknown): ManualOrphanSettlementV1 { return parseData(Settlement, input); }
/** Shared data-only boundary for released-record derivation. */
export function parseManualOrphanRecordV1(input: unknown) { return parseData(ManualRecordV1Schema, input); }
export function parseManualOrphanEvidenceV1(input: unknown): ManualOrphanEvidenceV1 {
  const detached = detachJson(input);
  let decoded = 0;
  // Budget all byte projections before any base64 decoding or JSON.parse.
  function budget(value: Json): void {
    if (value === null || typeof value !== "object") return;
    if (!Array.isArray(value) && "base64" in value && "byteLength" in value) {
      const actual = encodedByteLength(value.base64, 16 * MiB);
      if ((decoded += actual) > 128 * MiB || typeof value.byteLength !== "number"
        || !Number.isSafeInteger(value.byteLength) || value.byteLength !== actual) throw new Error("MALFORMED");
    }
    for (const child of Object.values(value)) budget(child);
  }
  budget(detached);
  const checked = Evidence.parse(detached);
  if (!equal(detached, checked)) throw new Error("MALFORMED");
  // A captured root is one stable identity across all private document copies.
  let root: FileValue["parents"][number]["before"] | undefined;
  function pins(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if ("descriptorBefore" in value && "parents" in value && "bytes" in value) {
      const file = value as FileValue, current = file.parents[0]!.before;
      if (root && stableParentKeys.some(k => root![k] !== current[k])) throw new Error("MALFORMED");
      root ??= current;
    }
    for (const child of Object.values(value)) pins(child);
  }
  pins(checked);
  return freeze(checked);
}
