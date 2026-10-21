import { createHash } from "node:crypto";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { requireFindingPublicationV1 } from "../findings/finding-publication-v1.js";
import { evaluateConvergenceReleaseGate } from "../evals/release-gate.js";
import { validateInternalProductionCanonicalOwnerIdentityV1, validateInternalProductionOwnerReservationCloseV1,
  createInternalProductionTerminalOwnerAuthorityV1, deriveInternalProductionTerminalOwnerAuthorityPairV1 } from "../internal-production/owner-admission-v1.js";
import { canarySelectorHash, computeCanarySlotHash, convergenceArtifactRef } from "./v3-release-admission.js";
import { hashControlSelectionIdentityV1 } from "./schemas/manual-control-job-v1.js";
import { hashObservedControlWorkerOwnerV1, hashWorkerJournalRecordV1, WorkerJournalEventV1Schema, ControlWorkerSafeCodeV1Schema, type WorkerJournalEventV1 } from "./schemas/manual-control-worker-channel-v1.js";
import { type ManualRecordV1, type ManualOwnerV1 } from "./schemas/manual-evaluation-record-v1.js";
import { parseManualOrphanEvidenceV1, parseManualOrphanRecordV1, type ManualOrphanEvidenceV1,
  type ManualOrphanVerdictV1, type ManualOrphanRefusalCodeV1 } from "./schemas/manual-control-orphan-retirement-v1.js";

const MC = "mission-control/controls", ROOT = "evals/manual-controls";
const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const equal = (a: unknown, b: unknown) => canonicalJsonStringify(a) === canonicalJsonStringify(b);
function requireFact(value: unknown): asserts value { if (!value) throw new Error("MANUAL_ORPHAN_REFUSED"); }
const numberName = (revision: number) => `${String(revision).padStart(20, "0")}.json`;
type Evidence = ManualOrphanEvidenceV1;
type Event<T extends WorkerJournalEventV1["type"]> = Extract<WorkerJournalEventV1, { type: T }>;
type Capture = Evidence["nativeBefore"]["census"];
type Snapshot = Evidence["nativeBefore"];
type Identity = Snapshot["collectorIdentity"];
type File = Evidence["reservation"]["file"];
const fileText = (file: Pick<File, "bytes">) => {
  const bytes = Buffer.from(file.bytes.base64, "base64"), text = bytes.toString("utf8");
  requireFact(Buffer.from(text).equals(bytes)); return text;
};
function acquireIdentity(record: ManualRecordV1) {
  const { revision: _revision, phase: _phase, ...input } = record.reservation; return input;
}
function immutableRecord(record: ManualRecordV1) {
  return { identity: acquireIdentity(record), owner: record.owner, intentHash: record.intentHash,
    nonceDigest: record.nonceDigest, executionMode: record.executionMode };
}

export function deriveManualOrphanReleasedRecordV1(prior: ManualRecordV1): ManualRecordV1 {
  try {
    const checked = parseManualOrphanRecordV1(prior);
    if (checked.reservation.revision !== 6 || checked.reservation.phase !== "active") throw new Error("CAS");
    return parseManualOrphanRecordV1({ ...checked, reservation: { ...checked.reservation, revision: 7, phase: "released" } });
  } catch { throw new Error("MANUAL_ORPHAN_CAS"); }
}

function sources(e: Evidence): void {
  const m = e.maintenanceSource, t = e.target.source;
  requireFact(m.sha === m.originMainSha && m.sha !== t.sha && m.buildHash !== t.buildHash);
  requireFact(e.maintenanceOwner.executable === e.target.nodeExecutable
    && e.maintenanceOwner.script.endsWith("/dist/cli/manual-control-orphan-retirement-v1.js")
    && !/\s/.test(e.maintenanceOwner.script) && !/\s/.test(e.maintenanceOwner.executable));
}
function target(e: Evidence): void {
  const t = e.target, d = e.database, r = e.reservation.value;
  requireFact(t.source.sha === t.source.originMainSha && t.selection.sourceSha === t.source.sha
    && t.runtimeRole !== t.ownerRole && t.runtimeOid !== t.ownerOid
    && d.databaseName === t.databaseName && d.currentUser === t.runtimeRole && d.sessionUser === t.runtimeRole
    && d.ownerOid === t.ownerOid && d.runtimeOid === t.runtimeOid);
  requireFact(r.reservation.selectionHash === hashControlSelectionIdentityV1(t.selection)
    && r.reservation.sourceSha === t.source.sha && r.reservation.kind === "convergence_full8" && r.executionMode === "execute"
    && r.owner.executable === t.nodeExecutable && r.owner.script === `${t.selection.releaseDir}/dist/cli/control-test-worker-v1.js`
    && !equal(r.owner, e.maintenanceOwner) && r.owner.pid !== e.maintenanceOwner.pid);
}
function history(e: Evidence): void {
  requireFact(e.history.length === 6 && e.reservation.file.relative === `${ROOT}/reservation.json`);
  const seen = new Set<string>(); let prior: ManualRecordV1 | undefined;
  for (const [i, d] of e.history.entries()) {
    const r = d.value;
    requireFact(d.file.relative === `${ROOT}/revisions/${numberName(i + 1)}` && r.reservation.revision === i + 1);
    requireFact(r.reservation.selectionHash === e.reservation.value.reservation.selectionHash && r.reservation.sourceSha === e.target.source.sha
      && ((r.reservation.kind === "convergence_full8") === (r.reservation.suiteHash !== null))
      && (r.reservation.kind !== "activation_preflight" || (r.executionMode === "preflight" && r.slots.length === 0))
      && new Set(r.slots.map(s => s.slotHash)).size === r.slots.length
      && (r.slots.length === 0 ? r.admissionHash === null : r.slots.every(s => s.admissionHash === r.admissionHash)));
    if (!prior || prior.reservation.jobId !== r.reservation.jobId) {
      requireFact(!seen.has(r.reservation.jobId) && r.reservation.phase === "pending" && (!prior || prior.reservation.phase === "released")
        && r.slots.length === 0 && r.admissionHash === null);
      seen.add(r.reservation.jobId);
    } else {
      requireFact(prior.reservation.phase !== "released" && r.reservation.phase !== "pending" && equal(immutableRecord(prior), immutableRecord(r))
        && prior.slots.every(s => r.slots.some(current => equal(s, current))));
      if (prior.reservation.phase === "pending") requireFact(r.reservation.phase === "active" && r.slots.length === 0);
    }
    prior = r;
  }
  requireFact(equal(prior, e.reservation.value) && e.history[5]!.file.bytes.sha256 === e.reservation.file.bytes.sha256
    && prior!.reservation.phase === "active" && prior!.reservation.revision === 6
    && prior!.slots.length === 8 && prior!.admissionHash !== null);
}
function cas(e: Evidence): void {
  requireFact(e.request.jobId === e.reservation.value.reservation.jobId && e.request.expectedRevision === e.reservation.value.reservation.revision
    && e.request.expectedRecordHash === e.reservation.file.bytes.sha256 && e.request.expectedJournalHeadHash === e.journalHead.file.bytes.sha256
    && e.request.expectedSettlementHash === e.mc.settlement.file.bytes.sha256);
}
function authentication(e: Evidence): void {
  const r = e.reservation.value, i = e.intent.value, c = e.mc.channel.value, job = r.reservation.jobId;
  const base = `${MC}/jobs/${job}`;
  requireFact(e.intent.file.relative === `${base}/intent.json` && e.intent.file.bytes.sha256 === r.intentHash
    && i.nonceDigest === r.nonceDigest && i.installationDir === e.target.selection.installationDir && i.releaseDir === e.target.selection.releaseDir);
  requireFact(e.mc.channel.file.relative === `${base}/channel.json` && c.jobId === job && c.intentHash === r.intentHash && equal(c.originalChild, r.owner));
  const identity = (receipt: Evidence["intent"]["value"]["receipt"]) => {
    requireFact(receipt.jobId === job && receipt.kind === r.reservation.kind && receipt.selectionHash === r.reservation.selectionHash
      && receipt.sourceSha === r.reservation.sourceSha && receipt.suiteHash === r.reservation.suiteHash
      && receipt.mcSourceSha === e.target.mcSourceSha && receipt.mcBuildHash === e.target.mcBuildHash
      && receipt.requestedAt === i.receipt.requestedAt && receipt.plannedCases === 8 && receipt.finishedAt === null);
  };
  identity(i.receipt);
  requireFact(equal(i.receipt, { ...i.receipt, revision: 1, state: "accepted", startedAt: null,
    updatedAt: i.receipt.requestedAt, finishedAt: null, phase: "starting", code: null, currentCaseId: null,
    ownedRunId: null, completedCases: 0, plannedCases: 8, reportRefs: {}, cancelRequested: false }));
  requireFact(e.mc.index.file.relative === `${MC}/index.json`);
  const jobs = e.mc.index.value.jobs;
  requireFact(new Set(jobs.map(j => j.receipt.jobId)).size === jobs.length && new Set(jobs.map(j => j.keyHash)).size === jobs.length);
  const entries = jobs.filter(j => j.receipt.jobId === job);
  requireFact(entries.length === 1); const entry = entries[0]!;
  requireFact(entry.published && entry.intentHash === r.intentHash && e.mc.receipts.length === entry.receipt.revision);
  const mappings = new Map<number, Evidence["mc"]["receipts"][number]["value"]["mapping"]>();
  const ordered: NonNullable<Evidence["mc"]["receipts"][number]["value"]["mapping"]>[] = [];
  let previous: Evidence["intent"]["value"]["receipt"] | undefined;
  for (const [n, d] of e.mc.receipts.entries()) {
    const { receipt, mapping } = d.value; identity(receipt);
    requireFact(receipt.revision === n + 1 && d.file.relative === `${base}/receipt-${numberName(n + 1)}`
      && (!previous || (receipt.updatedAt >= previous.updatedAt && receipt.completedCases >= previous.completedCases)));
    if (n === 0) requireFact(mapping === null && equal(receipt, i.receipt));
    else {
      requireFact(mapping !== null && previous !== undefined);
      const a = mapping.ack;
      requireFact(a.jobId === job && a.intentHash === r.intentHash && a.channelId === c.channelId
        && a.body.workerSequence === mapping.sequence && a.body.workerFrameHash === mapping.hash
        && a.body.receiptRevision === a.body.receipt.revision);
      identity(a.body.receipt);
      const prior = mappings.get(mapping.sequence);
      if (prior) {
        requireFact(equal(prior, mapping) && e.mc.cancel !== null && entry.cancel !== null
          && equal(receipt, entry.cancel.receipt) && receipt.revision === e.mc.cancel.value.acceptedReceiptRevision
          && previous.revision + 1 === receipt.revision && !previous.cancelRequested);
        // cancel() changes exactly these three facts; revise() adds only its
        // next revision and timestamp. Repeated ACK content stays unchanged.
        requireFact(equal(receipt, { ...previous, revision: receipt.revision, updatedAt: receipt.updatedAt,
          state: "cancelling", cancelRequested: true, code: "CONTROL_CANCEL_REQUESTED" }));
      } else {
        const last = ordered.at(-1);
        requireFact(equal(receipt, a.body.receipt) && (last ? mapping.sequence > last.sequence && a.sequence > last.ack.sequence : mapping.sequence === 1));
        const revised = { ...previous, revision: receipt.revision, updatedAt: receipt.updatedAt };
        if (!last) {
          requireFact(equal(receipt, { ...revised, state: previous.cancelRequested ? "cancelling" : "starting", phase: "starting" }));
        } else {
          // Retained ACKs establish the broker's stored projection, not the
          // absent raw frame or a replayed HMAC. Accept only an exact supported
          // producer delta and retain the cancellation latch in every branch.
          requireFact(previous.state !== "ownership_unknown" && receipt.cancelRequested === previous.cancelRequested);
          const progressFields = WorkerJournalEventV1Schema.safeParse({ type: "phase", phase: receipt.phase,
            currentCaseId: receipt.currentCaseId, completedCases: receipt.completedCases }).success
            && (receipt.code === null || ControlWorkerSafeCodeV1Schema.safeParse(receipt.code).success)
            && (receipt.ownedRunId === null || receipt.currentCaseId !== null);
          const startValid = previous.startedAt !== null ? receipt.startedAt === previous.startedAt
            : receipt.phase === "acquired" ? receipt.startedAt !== null && receipt.startedAt >= previous.updatedAt && receipt.startedAt <= receipt.updatedAt
            : receipt.startedAt === null;
          const progress = progressFields && startValid && equal(receipt, { ...revised,
            state: previous.cancelRequested ? "cancelling" : "running", phase: receipt.phase, code: receipt.code,
            completedCases: receipt.completedCases, currentCaseId: receipt.currentCaseId, ownedRunId: receipt.ownedRunId,
            startedAt: receipt.startedAt, reportRefs: {} });
          const cancelObserved = previous.cancelRequested && e.mc.cancel !== null
            && ["CONTROL_CANCEL_REQUESTED", "CONTROL_CANCEL_TOO_LATE"].includes(receipt.code ?? "")
            && equal(receipt, { ...revised, code: receipt.code });
          const fault = receipt.code !== null && ControlWorkerSafeCodeV1Schema.safeParse(receipt.code).success
            && equal(receipt, { ...revised, state: "ownership_unknown", phase: "ownership_unknown", code: receipt.code, reportRefs: {} });
          requireFact(progress || cancelObserved || fault);
        }
        mappings.set(mapping.sequence, mapping); ordered.push(mapping);
      }
    }
    previous = receipt;
  }
  requireFact(ordered.length > 0 && ordered[0]!.sequence === 1 && ordered[0]!.hash === c.readyFrameHash
    && equal(entry.frames, ordered.slice(-64)) && equal(entry.receipt, previous));
  if (e.mc.cancel) {
    const cancel = e.mc.cancel.value, index = entry.cancel;
    requireFact(index !== null && e.mc.cancel.file.relative === `${base}/cancel.json` && cancel.jobId === job && cancel.intentHash === r.intentHash
      && cancel.channelId === c.channelId && cancel.requestId === index.requestId && cancel.idempotencyKeyHash === index.keyHash
      && index.receipt.revision === cancel.acceptedReceiptRevision && index.receipt.updatedAt === cancel.requestedAt
      && index.receipt.cancelRequested && index.receipt.state === "cancelling" && index.receipt.code === "CONTROL_CANCEL_REQUESTED"
      && equal(e.mc.receipts[cancel.acceptedReceiptRevision - 1]?.value.receipt, index.receipt));
    requireFact(index.aliases.length >= 1 && new Set(index.aliases.map(a => a.keyHash)).size === index.aliases.length);
    const first = index.aliases[0]!;
    requireFact(first.keyHash === index.keyHash && first.expectedRevision + 1 === cancel.acceptedReceiptRevision
      && e.mc.cancelReplays.length === index.aliases.length - 1);
    for (const [n, d] of e.mc.cancelReplays.entries()) {
      const alias = index.aliases[n + 1]!;
      requireFact(d.file.relative === `${base}/cancel-replay-${alias.keyHash}.json` && d.value.keyHash === alias.keyHash
        && d.value.expectedRevision === alias.expectedRevision && d.value.requestId === cancel.requestId && equal(d.value.receipt, index.receipt)
        && alias.expectedRevision >= index.receipt.revision && alias.expectedRevision <= entry.receipt.revision);
    }
  } else requireFact(entry.cancel === null && e.mc.cancelReplays.length === 0 && e.mc.receipts.every(d => !d.value.receipt.cancelRequested));
}

type JournalProof = { contexts: Event<"canary_bound">["contexts"]; creation: Event<"canary_create_requested">;
  runs: Map<string, Event<"run_bound">>; results: Map<string, Event<"run_result_stored">>; artifactHashes: Set<string> };
function journal(e: Evidence): JournalProof {
  const r = e.reservation.value, job = r.reservation.jobId, head = e.journalHead.value, prefix = `evals/manual-control-journals/${job}`;
  requireFact(head.jobId === job && head.revision === e.journal.length && e.journal.length > 0 && e.journalHead.file.relative === `${prefix}/head.json`);
  const current = e.history.filter(d => d.value.reservation.jobId === job);
  requireFact(current.length >= 3);
  const pending = current[0]!.value, acquired = current[1]!.value;
  requireFact(pending.reservation.phase === "pending" && acquired.reservation.phase === "active" && acquired.slots.length === 0);
  let prior: string | null = null;
  for (const [n, d] of e.journal.entries()) {
    const v = d.value;
    requireFact(d.file.relative === `${prefix}/records/${numberName(n + 1)}` && v.revision === n + 1 && v.jobId === job
      && v.intentHash === r.intentHash && v.ownerHash === hashObservedControlWorkerOwnerV1(r.owner) && v.previousHash === prior);
    prior = hashWorkerJournalRecordV1(v); requireFact(prior === d.file.bytes.sha256);
  }
  requireFact(prior === head.recordHash);
  const events = e.journal.map(d => d.value.event), initial = events[0]!;
  requireFact(initial.type === "acquired");
  requireFact(initial.reservationRevision === acquired.reservation.revision && initial.kind === r.reservation.kind
    && initial.selectionHash === r.reservation.selectionHash && initial.sourceSha === r.reservation.sourceSha && initial.suiteHash === r.reservation.suiteHash
    && initial.executionMode === r.executionMode && equal(initial.owner, r.owner) && initial.origin === "mission_control");
  const contexts = new Map<string, Event<"canary_bound">["contexts"][number]>();
  let creation: Event<"canary_create_requested"> | undefined, binding: Event<"canary_bound"> | undefined;
  const requested = new Map<string, Event<"start_requested">>();
  const runs = new Map<string, Event<"run_bound">>(), results = new Map<string, Event<"run_result_stored">>();
  const stops = new Set<string>(), observedStops = new Set<string>();
  const artifactHashes = new Set<string>(), usedArtifacts = new Set<string>();
  const artifacts = new Map(e.artifacts.map(a => {
    const v = a.document.value, hash = "gateHash" in v ? v.gateHash : v.resultHash;
    requireFact(a.document.file.relative === `evals/results/${convergenceArtifactRef(hash)}`);
    return [`${a.kind}:${hash}`, a] as const;
  }));
  requireFact(artifacts.size === e.artifacts.length);
  let candidate: Event<"artifacts_stored"> | undefined, final: Event<"artifacts_stored"> | undefined;
  let boundary: Event<"finalization_boundary"> | undefined;
  let phase: Event<"phase">["phase"] = "acquired", caseId: string | null = null, completed = 0, cancellation = false;
  const pair = (event: Event<"artifacts_stored">) => {
    const a = artifacts.get(`eval_result:${event.resultHash}`), g = artifacts.get(`release_gate:${event.gateHash}`);
    requireFact(a?.kind === "eval_result" && g?.kind === "release_gate");
    const value = a.document.value, gate = g.document.value;
    requireFact(value.releaseSha === r.reservation.sourceSha && value.suiteHash === r.reservation.suiteHash && value.executionMode === "execute"
      && value.plannedRuns === 8 && value.status === event.resultStatus && gate.decision === event.gateDecision
      && equal(gate, evaluateConvergenceReleaseGate(value)) && value.runs.length === results.size);
    const unique = new Set<string>();
    for (const run of value.runs) {
      const stored = results.get(run.runId!); requireFact(stored && !unique.has(run.runId!) && stored.resultHash === run.resultHash);
      const doc = artifacts.get(`run_result:${run.resultHash}`); requireFact(doc?.kind === "run_result" && equal(doc.document.value, run)); unique.add(run.runId!);
    }
    usedArtifacts.add(`eval_result:${event.resultHash}`); usedArtifacts.add(`release_gate:${event.gateHash}`);
    artifactHashes.add(event.resultHash); artifactHashes.add(event.gateHash);
    return value;
  };
  for (const [index, event] of events.entries()) {
    if (index === 0) continue;
    requireFact(!["acquired", "released", "closed", "fault"].includes(event.type));
    if (event.type === "cancel_latched") {
      requireFact(!cancellation);
      if (event.source === "operator") requireFact(e.mc.cancel && event.requestId === e.mc.cancel.value.requestId);
      // The original broker loss flag is volatile and absent from this DTO.
      // This bounded profile cannot infer it from a nonzero settlement.
      else requireFact(false);
      cancellation = true; continue;
    }
    if (event.type === "phase") {
      requireFact(event.completedCases === results.size && event.completedCases >= completed && event.completedCases <= 8);
      completed = event.completedCases;
      switch (event.phase) {
        case "preflight": requireFact(phase === "acquired" && !creation && event.currentCaseId === null); break;
        case "admission": requireFact(phase === "preflight" && !creation && event.currentCaseId === null); break;
        case "case_start": requireFact(binding && !candidate && ["admission", "case_collect"].includes(phase)
          && event.currentCaseId !== null && contexts.has(event.currentCaseId) && !requested.has(event.currentCaseId)); break;
        case "case_running": requireFact(phase === "case_start" && event.currentCaseId === caseId
          && [...runs.values()].some(v => v.case.caseId === caseId)); break;
        case "case_collect": requireFact(phase === "case_running" && event.currentCaseId === caseId); break;
        case "publishing": requireFact(!candidate && !boundary && event.currentCaseId === null
          && ["admission", "case_collect"].includes(phase) && results.size === runs.size); break;
        case "finalizing": requireFact(candidate && !boundary && phase === "publishing" && event.currentCaseId === null); break;
        case "settling": requireFact(final && boundary && phase === "finalizing" && event.currentCaseId === null); break;
        default: requireFact(false);
      }
      phase = event.phase; caseId = event.currentCaseId; continue;
    }
    if (event.type === "canary_create_requested") {
      requireFact(!creation && phase === "admission" && !candidate && event.releaseSha === r.reservation.sourceSha && event.suiteHash === r.reservation.suiteHash);
      creation = event; continue;
    }
    if (event.type === "canary_bound") {
      requireFact(creation && !binding && phase === "admission" && event.reservationRevision > acquired.reservation.revision);
      const record = current.find(d => d.value.reservation.revision === event.reservationRevision)?.value;
      requireFact(record && record.reservation.phase === "active" && event.contexts.length === 8);
      const slots = event.contexts.map(v => { const { schema: _schema, slotToken: _token, ...slot } = v.context; return slot; });
      requireFact(equal(slots, record.slots) && equal(slots, r.slots) && slots.every(s => s.admissionHash === record.admissionHash));
      for (const v of event.contexts) {
        const requestedSlot = creation.slots.find(s => s.caseId === v.caseId);
        requireFact(requestedSlot && requestedSlot.caseHash === v.context.caseHash && requestedSlot.taskHash === v.context.taskHash
          && requestedSlot.repetition === v.context.repetition && requestedSlot.slotToken === v.context.slotToken);
        contexts.set(v.caseId, v);
      }
      binding = event; continue;
    }
    if (event.type === "start_requested" || event.type === "run_bound") {
      requireFact(binding && !candidate && !boundary && phase === "case_start" && caseId === event.case.caseId);
      const context = contexts.get(event.case.caseId)?.context;
      requireFact(context && context.caseHash === event.case.caseHash && context.taskHash === event.case.taskHash && context.repetition === event.case.repetition
        && context.admissionHash === event.admissionHash && context.slotHash === event.slotHash);
      if (event.type === "start_requested") { requireFact(!requested.has(event.case.caseId)); requested.set(event.case.caseId, event); }
      else { const request = requested.get(event.case.caseId); requireFact(request && equal(request.case, event.case) && !runs.has(event.runId)
        && ![...runs.values()].some(run => run.case.caseId === event.case.caseId)); runs.set(event.runId, event); }
      continue;
    }
    if (event.type === "stop_requested" || event.type === "stop_observed") {
      requireFact(!candidate && runs.has(event.runId));
      if (event.type === "stop_requested") { requireFact(!stops.has(event.runId) && !observedStops.has(event.runId)); stops.add(event.runId); }
      else { requireFact(!observedStops.has(event.runId) && (event.result === "already_terminal" || stops.has(event.runId))); observedStops.add(event.runId); }
      continue;
    }
    if (event.type === "run_result_stored") {
      const run = runs.get(event.runId), artifact = artifacts.get(`run_result:${event.resultHash}`);
      requireFact(!candidate && phase === "case_collect" && caseId === event.case.caseId && run && equal(run.case, event.case)
        && !results.has(event.runId) && artifact?.kind === "run_result");
      const value = artifact.document.value;
      requireFact(value.runId === event.runId && value.runNumber === run.runNumber && value.caseId === event.case.caseId
        && value.caseHash === event.case.caseHash && value.taskHash === event.case.taskHash && value.repetition === event.case.repetition
        && value.releaseSha === r.reservation.sourceSha && value.suiteHash === r.reservation.suiteHash && value.protocol === "v3");
      results.set(event.runId, event); usedArtifacts.add(`run_result:${event.resultHash}`); continue;
    }
    if (event.type === "artifacts_stored") {
      requireFact(binding && creation && event.stage !== "promotion_confirmed");
      if (event.stage === "candidate") {
        requireFact(!candidate && !boundary && phase === "publishing" && results.size === runs.size);
        const value = pair(event); requireFact(value.preflight.preflightHash === creation.preflightHash); candidate = event;
      } else {
        requireFact(candidate && boundary && !final && phase === "finalizing");
        const value = pair(event), candidateValue = pair(candidate);
        requireFact(event.gateDecision === "no_go");
        if (boundary.decision === "cancel") {
          requireFact(cancellation && event.stage === "cancelled_final" && value.status === "blocked" && value.blockerCodes.includes("EVAL_CANCEL_REQUESTED"));
          const { resultHash: _candidateHash, ...candidatePayload } = candidateValue;
          const { resultHash: _finalHash, ...finalPayload } = value;
          requireFact(equal(finalPayload, { ...candidatePayload, status: "blocked", blockerCodes: [...new Set([...candidateValue.blockerCodes, "EVAL_CANCEL_REQUESTED"])].sort() }));
        } else requireFact(event.stage === "final_without_promotion" && candidate.gateDecision === "no_go"
          && event.resultHash === candidate.resultHash && event.gateHash === candidate.gateHash && event.resultStatus === candidate.resultStatus);
        final = event;
      }
      continue;
    }
    if (event.type === "finalization_boundary") {
      requireFact(candidate && !boundary && !final && phase === "finalizing" && event.resultHash === candidate.resultHash
        && event.gateHash === candidate.gateHash && event.gateDecision === candidate.gateDecision
        && event.decision === (cancellation ? "cancel" : "continue")
        && (event.decision === "cancel" || event.gateDecision === "no_go")); boundary = event; continue;
    }
    requireFact(false);
  }
  const last = events.at(-1);
  requireFact(creation && binding && candidate && boundary && final && phase === "settling"
    && last?.type === "phase" && last.phase === "settling" && last.currentCaseId === null && last.completedCases === results.size
    && usedArtifacts.size === artifacts.size && [...stops].every(id => observedStops.has(id)));
  // Start-child files bind to the actual request boundary, not to a later head.
  const childSlots = new Set<string>();
  for (const d of e.namespace.startChildren) {
    const v = d.value, request = requested.get(v.caseId), ref = e.journal[v.journal.revision - 1];
    requireFact(d.file.relative === `${ROOT}/start-children/${job}/${v.slot.slotHash}.json` && request && ref
      && ref.file.bytes.sha256 === v.journal.hash && equal(ref.value.event, request)
      && equal(v.reservation, r.reservation) && v.intentHash === r.intentHash && equal(v.owner, r.owner) && v.parentPid === r.owner.pid
      && v.child.pid !== r.owner.pid && v.child.processGroupId === r.owner.processGroupId && v.child.executable === e.target.nodeExecutable
      && v.child.script === `${e.target.selection.releaseDir}/dist/cli/cli.js`
      && v.slot.slotHash === request.slotHash && r.slots.some(slot => equal(slot, v.slot)) && !childSlots.has(v.slot.slotHash));
    childSlots.add(v.slot.slotHash);
  }
  requireFact([...requested.values()].every(v => childSlots.has(v.slotHash)));
  for (const row of e.database.releaseGoRows) {
    const payload = row.payload;
    requireFact(payload.kind === "release_go" && row.admission_hash === payload.admissionHash && row.release_sha === payload.releaseSha
      && row.release_sha === e.target.source.sha && row.suite_hash === payload.suiteHash && row.result_hash === payload.result.hash
      && row.result_ref === payload.result.ref && row.gate_hash === payload.gate.hash && row.gate_ref === payload.gate.ref
      && row.result_ref === convergenceArtifactRef(row.result_hash) && row.gate_ref === convergenceArtifactRef(row.gate_hash)
      && !artifactHashes.has(row.result_hash) && !artifactHashes.has(row.gate_hash));
  }
  requireFact(new Set(e.database.releaseGoRows.map(row => row.admission_hash)).size === e.database.releaseGoRows.length);
  return { contexts: binding.contexts, creation, runs, results, artifactHashes };
}

function settlement(e: Evidence): void {
  const s = e.mc.settlement.value, r = e.reservation.value, c = e.mc.channel.value;
  requireFact(e.mc.settlement.file.relative === `${MC}/jobs/${r.reservation.jobId}/original-worker-settlement.json`
    && s.jobId === r.reservation.jobId && s.kind === r.reservation.kind && s.channelId === c.channelId && s.intentHash === r.intentHash
    && s.selectionHash === r.reservation.selectionHash && s.sourceSha === r.reservation.sourceSha && s.mcSourceSha === e.target.mcSourceSha
    && s.mcBuildHash === e.target.mcBuildHash && s.executableHash === e.target.nodeExecutableHash
    && s.originalChild !== null && equal(s.originalChild, r.owner) && equal(s.originalChild, c.originalChild)
    && s.ownerHash === hashObservedControlWorkerOwnerV1(r.owner) && s.observedFactsComplete
    && s.exit?.code === 1 && s.exit.signal === null && equal(s.exit, s.processClose)
    && s.stdout.endObserved && s.stdout.closeObserved && s.stderr.endObserved && s.stderr.closeObserved && s.errors.length === 0);
}
function findings(e: Evidence): void {
  const groups = new Map<string, Evidence["database"]["findingChildren"]>();
  for (const parent of e.database.findingParents) { requireFact(!groups.has(parent.finding_set_hash)); groups.set(parent.finding_set_hash, []); }
  for (const child of e.database.findingChildren) {
    const group = groups.get(child.finding_set_hash); requireFact(group); group.push(child);
  }
  for (const parent of e.database.findingParents) requireFindingPublicationV1(parent, groups.get(parent.finding_set_hash)!);
}
function slots(e: Evidence, j: JournalProof): void {
  const r = e.reservation.value, seen = new Set<string>(), consumed = new Set<string>();
  for (const s of e.database.slots) {
    const slot = s.slot;
    requireFact(!seen.has(slot.slotHash) && r.slots.some(v => equal(slot, v)) && s.admissionRows.length === 1 && s.claimRows.length === 1);
    seen.add(slot.slotHash);
    const row = s.admissionRows[0]!, admission = row.payload, claim = s.claimRows[0]!;
    requireFact(admission.kind === "convergence_canary" && admission.admissionHash === slot.admissionHash
      && admission.releaseSha === r.reservation.sourceSha && admission.suiteHash === r.reservation.suiteHash
      && admission.expiresAt === row.expires_at && admission.preflightHash === j.creation.preflightHash && admission.slots.length === 8);
    const context = j.contexts.find(v => v.context.slotHash === slot.slotHash)?.context;
    requireFact(context);
    const selectorHash = canarySelectorHash(context.slotToken);
    const admitted = admission.slots.find(v => v.slotHash === slot.slotHash);
    requireFact(admitted && admitted.caseHash === slot.caseHash && admitted.taskHash === slot.taskHash && admitted.repetition === 1
      && admitted.selectorHash === selectorHash && computeCanarySlotHash({ releaseSha: admission.releaseSha, suiteHash: admission.suiteHash,
        caseHash: slot.caseHash, taskHash: slot.taskHash, repetition: slot.repetition, selectorHash }) === slot.slotHash);
    requireFact(claim.admission_hash === slot.admissionHash && claim.case_hash === slot.caseHash && claim.task_hash === slot.taskHash
      && claim.repetition === 1 && claim.selector_hash === selectorHash && (claim.run_id === null) === (claim.consumed_at === null));
    // Every admission copy must describe the complete bound inventory, including
    // the seven unconsumed slots; expiry does not undo terminal closure.
    requireFact(admission.slots.every(v => r.slots.some(bound => bound.slotHash === v.slotHash && bound.admissionHash === admission.admissionHash
      && bound.caseHash === v.caseHash && bound.taskHash === v.taskHash && bound.repetition === v.repetition)));
    if (claim.run_id === null) {
      requireFact(s.runRows.length === 0 && s.ownerRows.length === 0 && s.terminalPair === null && s.close === null
        && ![...j.runs.values()].some(v => v.slotHash === slot.slotHash));
      continue;
    }
    const runId = claim.run_id;
    requireFact(!consumed.has(runId) && s.runRows.length === 1 && s.ownerRows.length === 1 && s.terminalPair !== null && s.close !== null);
    consumed.add(runId);
    const run = s.runRows[0]!, owner = s.ownerRows[0]!, pair = s.terminalPair, close = validateInternalProductionOwnerReservationCloseV1(s.close);
    const bound = j.runs.get(runId), result = j.results.get(runId);
    requireFact(bound && result && bound.slotHash === slot.slotHash && bound.admissionHash === slot.admissionHash && run.id === runId
      && run.compiler_release_sha === r.reservation.sourceSha && run.release_admission_hash === slot.admissionHash && hashCanonicalJson(run.task) === slot.taskHash);
    const encoded = encodeURIComponent(runId); requireFact(decodeURIComponent(encoded) === runId);
    // Exact five-field wire formula from db-pg1477, without importing DB code.
    const canonical = validateInternalProductionCanonicalOwnerIdentityV1<"run">({
      schema: "setfarm.internal-production-canonical-owner-identity.v1", category: "run", ownerKey: runId,
      ownerRef: `setfarm://runs/${encoded}`, ownerHash: hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId }) });
    requireFact(equal(owner.canonical_owner_identity, canonical) && owner.close_ref === close.closeRef && owner.close_hash === close.closeHash
      && pair.runOwnerReservationRef === close.reservationRef && pair.runOwnerReservationHash === close.reservationHash
      && close.terminalOwnerRef === `setfarm://runs/${encoded}/terminal/${run.status}`
      && close.terminalOwnerHash === hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-terminal-owner.v1", runId, status: run.status }));
    const terminal = deriveInternalProductionTerminalOwnerAuthorityPairV1(createInternalProductionTerminalOwnerAuthorityV1({ canonicalOwnerIdentity: canonical,
      terminalOwnerRef: close.terminalOwnerRef, terminalOwnerHash: close.terminalOwnerHash }));
    requireFact(pair.terminalAuthorityRef === terminal.terminalAuthorityRef && pair.terminalAuthorityHash === terminal.terminalAuthorityHash);
    const child = e.namespace.startChildren.find(d => d.value.slot.slotHash === slot.slotHash)?.value;
    requireFact(child && child.child.commandHash === digest(`${child.child.executable} ${child.child.script} workflow run ${child.workflowId} ${run.task} --protocol v3`));
  }
  requireFact(seen.size === 8 && consumed.size === j.runs.size && consumed.size === j.results.size);
}

function completeCapture(c: Capture, snapshot: Snapshot, argv: readonly string[]): string {
  requireFact(equal(c.collector, snapshot.collector) && c.executorParentPid === snapshot.collector.pid
    && c.executorPid !== snapshot.collector.pid && equal(c.argv, argv) && c.errors.length === 0
    && c.exit?.code === 0 && c.exit.signal === null && equal(c.exit, c.processClose)
    && c.spawnObservedAtUTC !== null && c.exitObservedAtUTC !== null && c.closeObservedAtUTC !== null
    && snapshot.observedAtStartUTC <= c.invokedAtUTC && c.invokedAtUTC <= c.spawnObservedAtUTC
    && c.spawnObservedAtUTC <= c.exitObservedAtUTC && c.exitObservedAtUTC <= c.closeObservedAtUTC && c.closeObservedAtUTC <= snapshot.observedAtEndUTC);
  for (const stream of [c.stdout, c.stderr]) requireFact(stream.endObserved && stream.closeObserved && stream.dataBytesObserved === stream.bytes.byteLength);
  requireFact(c.stderr.bytes.byteLength === 0);
  return fileText({ bytes: c.stdout.bytes });
}
function identityCapture(identity: Identity, snapshot: Snapshot, subject: Identity["subject"], expected: ManualOwnerV1): string {
  requireFact(identity.subject === subject && equal(identity.expected, expected));
  const argv = ["-ww", "-p", String(expected.pid), "-o", "lstart=", "-o", "pgid=", "-o", "args="];
  const before = completeCapture(identity.before, snapshot, argv), after = completeCapture(identity.after, snapshot, argv);
  const comm = completeCapture(identity.comm, snapshot, ["-ww", "-p", String(expected.pid), "-o", "comm="]);
  requireFact(before === after && identity.before.invokedAtUTC <= identity.comm.invokedAtUTC && identity.comm.invokedAtUTC <= identity.after.invokedAtUTC);
  const row = /^\s*(\w{3} \w{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\s+(\d+)\s+([^\r\n]+)\n?$/.exec(before);
  const executable = /^(\S+)\n?$/.exec(comm);
  requireFact(row && executable && executable[1] === expected.executable && new Date(`${row[1]} UTC`).toISOString() === expected.processStartedAt
    && Number(row[2]) === expected.processGroupId && digest(row[3]!) === expected.commandHash
    && row[3]!.startsWith(`${expected.executable} ${expected.script}`)
    && ["", " "].includes(row[3]!.slice(`${expected.executable} ${expected.script}`.length, `${expected.executable} ${expected.script}`.length + 1)));
  return row[3]!;
}
type ProcessRow = { pid: number; parentPid: number; processGroupId: number; command: string };
function processRows(text: string): ProcessRow[] {
  requireFact(text.endsWith("\n"));
  const lines = text.split("\n").filter(Boolean); requireFact(lines.length <= 65536 && lines.length > 0);
  const seen = new Set<number>();
  const rows = lines.map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line); requireFact(match);
    const row = { pid: Number(match[1]), parentPid: Number(match[2]), processGroupId: Number(match[3]), command: match[4]! };
    requireFact(Number.isSafeInteger(row.pid) && row.pid > 0 && !seen.has(row.pid) && Number.isSafeInteger(row.parentPid) && row.parentPid >= 0
      && Number.isSafeInteger(row.processGroupId) && row.processGroupId >= 0 && Buffer.byteLength(row.command) <= 1024 * 1024 && !/[\u0000-\u001f\u007f]/.test(row.command));
    seen.add(row.pid); return row;
  });
  const byPid = new Map(rows.map(r => [r.pid, r]));
  for (const row of rows) {
    let parent = row.parentPid; const chain = new Set([row.pid]);
    while (parent > 0) { requireFact(!chain.has(parent)); chain.add(parent); const ancestor = byPid.get(parent); if (!ancestor) break; parent = ancestor.parentPid; }
  }
  return rows;
}
function native(e: Evidence): void {
  requireFact(e.nativeBefore.snapshotId !== e.nativeAfter.snapshotId && e.nativeBefore.observedAtStartUTC <= e.nativeBefore.observedAtEndUTC
    && e.nativeBefore.observedAtEndUTC <= e.database.observedAtStartUTC && e.database.observedAtStartUTC <= e.database.observedAtEndUTC
    && e.database.observedAtEndUTC <= e.nativeAfter.observedAtStartUTC && e.nativeAfter.observedAtStartUTC <= e.nativeAfter.observedAtEndUTC
    && e.mc.settlement.value.recordedAtUTC <= e.nativeBefore.observedAtStartUTC);
  const captureIds = new Set<string>();
  for (const snapshot of [e.nativeBefore, e.nativeAfter]) {
    requireFact(equal(snapshot.collector, e.maintenanceOwner));
    const all = [snapshot.census, snapshot.collectorIdentity.before, snapshot.collectorIdentity.comm, snapshot.collectorIdentity.after,
      ...snapshot.services.flatMap(s => s.status === "present" ? [s.identity.before, s.identity.comm, s.identity.after] : [])];
    for (const capture of all) { requireFact(!captureIds.has(capture.captureId)); captureIds.add(capture.captureId); }
    const argv = ["-ww", "-axo", "pid=,ppid=,pgid=,command="];
    const rows = processRows(completeCapture(snapshot.census, snapshot, argv)), byPid = new Map(rows.map(r => [r.pid, r]));
    const own = byPid.get(snapshot.collector.pid), executor = byPid.get(snapshot.census.executorPid);
    const ownCommand = identityCapture(snapshot.collectorIdentity, snapshot, "collector", e.maintenanceOwner);
    requireFact(own && own.command === ownCommand && own.processGroupId === snapshot.collector.processGroupId
      && executor && executor.command === `/bin/ps ${argv.join(" ")}` && executor.parentPid === snapshot.collector.pid
      && executor.processGroupId === own.processGroupId);
    const exempt = new Set([own.pid, executor.pid]), services = new Set<string>();
    for (const service of snapshot.services) {
      requireFact(!services.has(service.service)); services.add(service.service);
      const listing = e.namespace.directories.find(d => d.relative === "services"); requireFact(listing);
      if (service.status === "absent") {
        requireFact(!listing.names.includes(`${service.service}.lock`) && !listing.names.includes(`${service.service}.pid`)); continue;
      }
      const record = service.lock.value, expected = service.identity.expected;
      const script = `${e.target.selection.releaseDir}/dist/${service.service === "dashboard" ? "server/daemon.js" : "spawner.js"}`;
      requireFact(service.lock.file.relative === `services/${service.service}.lock` && service.pidFile.relative === `services/${service.service}.pid`
        && service.pidFile.bytes.byteLength <= 32 && service.lock.file.bytes.byteLength <= 8192
        && listing.names.includes(`${service.service}.lock`) && listing.names.includes(`${service.service}.pid`)
        && record.service === service.service && record.installationDirectory === e.target.selection.installationDir
        && record.sourceSha === e.target.source.sha && record.executable === e.target.nodeExecutable && record.script === script
        && fileText(service.pidFile) === String(record.ownerIdentity.pid) && expected.pid === record.ownerIdentity.pid
        && expected.processStartedAt === record.ownerIdentity.processStartedAt && expected.processGroupId === record.ownerIdentity.processGroupId
        && expected.source === record.ownerIdentity.source && expected.executable === record.executable && expected.script === record.script);
      const command = identityCapture(service.identity, snapshot, service.service, expected), row = byPid.get(expected.pid);
      requireFact(row && row.command === command && row.processGroupId === expected.processGroupId && !exempt.has(row.pid)); exempt.add(row.pid);
    }
    requireFact(services.has("dashboard") && services.has("spawner"));
    const absent = [e.reservation.value.owner, ...e.namespace.startChildren.map(d => d.value.child)];
    for (const row of rows) {
      for (const owner of absent) {
        requireFact(row.pid !== owner.pid && !(owner.pid === owner.processGroupId && row.processGroupId === owner.processGroupId));
        let parent = row.parentPid;
        while (parent > 0) { requireFact(parent !== owner.pid); const ancestor = byPid.get(parent); if (!ancestor) break; parent = ancestor.parentPid; }
      }
      if (exempt.has(row.pid)) continue;
      // Other descendants of the maintenance collector are not exempt merely
      // because the collector is ours. Only this capture's exited ps row is.
      let parent = row.parentPid;
      while (parent > 0) { requireFact(parent !== snapshot.collector.pid); const ancestor = byPid.get(parent); if (!ancestor) break; parent = ancestor.parentPid; }
      requireFact(!row.command.includes(`${e.target.selection.releaseDir}/src/`) && !row.command.includes(`${e.target.selection.releaseDir}/dist/`)
        && !row.command.includes(e.maintenanceOwner.script));
    }
  }
}

function otherOwners(e: Evidence): void {
  const n = e.namespace, r = e.reservation.value;
  requireFact(n.mutationFiles.length === 0 && n.retirementFiles.length === 0 && n.buildMaintenanceFiles.length === 0 && n.unexpectedFiles.length === 0);
  const jobs = new Set<string>(), closures = new Set<string>();
  for (const other of n.otherIntents) {
    requireFact(other.jobId !== r.reservation.jobId && !jobs.has(other.jobId)); jobs.add(other.jobId);
    const value = other.intent.value;
    const initial = other.origin === "mission_control" ? other.intent.value.receipt : other.intent.value;
    requireFact(initial.jobId === other.jobId && initial.selectionHash === r.reservation.selectionHash && initial.sourceSha === r.reservation.sourceSha);
    if (other.origin === "mission_control") {
      const v = other.intent.value;
      requireFact(other.intent.file.relative === `${MC}/jobs/${other.jobId}/intent.json` && v.installationDir === e.target.selection.installationDir && v.releaseDir === e.target.selection.releaseDir);
      const entries = e.mc.index.value.jobs.filter(j => j.receipt.jobId === other.jobId);
      requireFact(entries.length === 1 && entries[0]!.published && entries[0]!.intentHash === other.intent.file.bytes.sha256
        && entries[0]!.receipt.kind === v.receipt.kind && entries[0]!.receipt.selectionHash === v.receipt.selectionHash
        && entries[0]!.receipt.sourceSha === v.receipt.sourceSha && entries[0]!.receipt.suiteHash === v.receipt.suiteHash);
      if (v.receipt.kind === "ui_regression") { requireFact(other.closure === null); continue; }
    } else requireFact(other.intent.file.relative === `${ROOT}/direct/${other.jobId}.json`);
    requireFact(other.closure !== null);
    const c = other.closure.value;
    requireFact(other.closure.file.relative === `${ROOT}/closures/${other.jobId}.json` && !closures.has(other.jobId)
      && n.closures.some(d => equal(d, other.closure)) && c.jobId === other.jobId && c.intentOrigin === other.origin
      && c.kind === initial.kind && c.selectionHash === initial.selectionHash && c.sourceSha === initial.sourceSha && c.suiteHash === initial.suiteHash
      && c.intentHash === other.intent.file.bytes.sha256 && c.nonceDigest === value.nonceDigest
      && c.executionMode === (other.origin === "direct" ? other.intent.value.executionMode : initial.kind === "activation_preflight" ? "preflight" : "execute")
      && (other.origin !== "direct" || equal(c.owner, other.intent.value.owner)));
    closures.add(other.jobId);
    const matching = e.history.filter(d => d.value.reservation.jobId === other.jobId);
    if (c.closure.kind === "never_reserved") requireFact(matching.length === 0
      && e.history.every(d => d.value.intentHash !== c.intentHash && !equal(d.value.owner, c.owner)));
    else {
      const marker = c.closure, d = matching.at(-1);
      requireFact(d && d.value.reservation.phase === "released" && d.value.reservation.revision === marker.revision && d.file.bytes.sha256 === marker.recordHash
        && equal(acquireIdentity(d.value), { jobId: c.jobId, kind: c.kind, selectionHash: c.selectionHash, sourceSha: c.sourceSha, suiteHash: c.suiteHash })
        && d.value.intentHash === c.intentHash && d.value.nonceDigest === c.nonceDigest && d.value.executionMode === c.executionMode && equal(d.value.owner, c.owner));
    }
  }
  requireFact(n.closures.length === closures.size && e.mc.index.value.jobs.every(j => j.receipt.jobId === r.reservation.jobId || jobs.has(j.receipt.jobId)));
  const files = new Map<string, File>();
  const addFile = (f: File) => { const prior = files.get(f.relative); requireFact(!prior || equal(prior, f)); files.set(f.relative, f); };
  const documents = [e.reservation, ...e.history, e.intent, e.mc.index, e.mc.channel, ...e.mc.receipts, e.mc.settlement,
    ...(e.mc.cancel ? [e.mc.cancel] : []), ...e.mc.cancelReplays, ...e.journal, e.journalHead, ...e.artifacts.map(a => a.document),
    ...n.closures, ...n.startChildren, ...n.otherIntents.map(o => o.intent)];
  for (const d of documents) addFile(d.file);
  for (const s of [e.nativeBefore, e.nativeAfter]) for (const service of s.services) if (service.status === "present") { addFile(service.lock.file); addFile(service.pidFile); }
  const expected = new Map<string, Set<string>>();
  const addDirectory = (relative: string) => {
    const parts = relative === "" ? [] : relative.split("/");
    for (let i = 0; i <= parts.length; i++) {
      const parent = parts.slice(0, i).join("/"); if (!expected.has(parent)) expected.set(parent, new Set());
      if (i < parts.length) expected.get(parent)!.add(parts[i]!);
    }
  };
  // These are the existing empty namespace containers, not new retirement
  // directories or caller-defined exclusions.
  for (const relative of [ROOT, `${ROOT}/direct`, `${ROOT}/closures`, `${ROOT}/start-children`, "services", `${MC}/jobs`]) addDirectory(relative);
  for (const file of files.values()) {
    const parts = file.relative.split("/"), name = parts.pop()!, parent = parts.join("/"); addDirectory(parent); expected.get(parent)!.add(name);
  }
  requireFact(new Set(n.directories.map(d => d.relative)).size === n.directories.length && n.directories.length === expected.size);
  for (const d of n.directories) {
    const names = expected.get(d.relative); requireFact(names);
    // Service logs are known append-only output, not process-owner evidence.
    const actual = d.relative === "services" ? d.names.filter(name => name !== "dashboard.log" && name !== "spawner.log") : d.names;
    requireFact(equal([...names].sort(), [...actual].sort()));
  }
}

/** Pure prepublication inference only. No verdict grants an effect capability. */
export function proveManualOrphanRetirementV1(input: ManualOrphanEvidenceV1): ManualOrphanVerdictV1 {
  let stage: ManualOrphanRefusalCodeV1 = "MALFORMED";
  try {
    const e = parseManualOrphanEvidenceV1(input);
    stage = "SOURCE"; sources(e);
    stage = "TARGET"; target(e);
    stage = "HISTORY"; history(e);
    stage = "CAS"; cas(e);
    stage = "AUTHENTICATION"; authentication(e);
    stage = "JOURNAL"; const j = journal(e);
    stage = "SETTLEMENT"; settlement(e);
    stage = "ACTIVITY"; requireFact(e.database.activityRows.length === 1 && Object.values(e.database.activityRows[0]!).every(value => value === 0));
    stage = "FINDINGS"; findings(e);
    stage = "SLOTS"; slots(e, j);
    stage = "NATIVE"; native(e);
    stage = "OTHER_OWNER"; otherOwners(e);
    stage = "CAS";
    const released = deriveManualOrphanReleasedRecordV1(e.reservation.value);
    return Object.freeze({ status: "eligible", evidenceHash: hashCanonicalJson(e),
      priorRecordHash: digest(`${JSON.stringify(e.reservation.value)}\n`), releasedRecordHash: digest(`${JSON.stringify(released)}\n`) });
  } catch { return Object.freeze({ status: "refused", code: stage }); }
}
