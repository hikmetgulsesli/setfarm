import { createHash } from "node:crypto";
import { canonicalJsonStringify, hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { ControlPrivateIntentV1Schema, ControlJobReceiptV1Schema,
  ControlSelectionIdentityV1Schema, hashControlSelectionIdentityV1 } from "../../../src/execution/schemas/manual-control-job-v1.js";
import { ObservedControlWorkerOwnerV1Schema, hashObservedControlWorkerOwnerV1,
  serializeWorkerJournalRecordV1, serializeWorkerJournalHeadV1,
  hashWorkerJournalRecordV1, type WorkerJournalEventV1, type WorkerJournalRecordV1,
} from "../../../src/execution/schemas/manual-control-worker-channel-v1.js";
import { canarySelectorHash, computeCanarySlotHash, createV3ReleaseAdmissionV1,
  convergenceArtifactRef } from "../../../src/execution/v3-release-admission.js";
import { validateInternalProductionCanonicalOwnerIdentityV1,
  createInternalProductionTerminalOwnerAuthorityV1, deriveInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionOwnerReservationCloseV1,
} from "../../../src/internal-production/owner-admission-v1.js";
import { createFindingSetV1 } from "../../../src/findings/finding-set.js";
import { requireFindingPublicationV1 } from "../../../src/findings/finding-publication-v1.js";
import { createConvergencePreflight, createConvergenceRunResult, createConvergenceResult } from "../../../src/evals/result-schema.js";
import { evaluateConvergenceReleaseGate } from "../../../src/evals/release-gate.js";
// Erased imports only: this helper is independently loadable before Task1 exists.
import type { ManualOrphanEvidenceV1 } from "../../../src/execution/schemas/manual-control-orphan-retirement-v1.js";
import type { ManualRecordV1 } from "../../../src/execution/schemas/manual-evaluation-record-v1.js";

const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const h = (label: string) => digest(`synthetic-orphan-v1:${label}`);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T0 = "2026-10-20T00:00:00.000Z";
const time = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();
const SOURCE = "b".repeat(40), MC_SOURCE = "d".repeat(40), M_SOURCE = "c".repeat(40);
const JOB = id(1), OLD_JOB = id(2), CHANNEL = id(3), CANCEL = id(4), RUN = "orphan_fixture_run_1";
const ROOT = "evals/manual-controls", MC = "mission-control/controls";

export function syntheticBytesV1(input: string | Uint8Array) {
  const bytes = Buffer.from(input);
  return { base64: bytes.toString("base64"), byteLength: bytes.length, sha256: digest(bytes) };
}

// All pins are detached synthetic data. No filesystem function is imported or
// called, and no path accepted by this helper selects an installation.
function file(relative: string, input: string | Uint8Array) {
  const bytes = syntheticBytesV1(input);
  const stat = { dev: "1", ino: String(parseInt(digest(relative).slice(0, 12), 16)),
    mode: "33152", nlink: "1", uid: "501", gid: "20", size: String(bytes.byteLength),
    mtimeNs: "1792454400000000000", ctimeNs: "1792454400000000000" };
  const ancestors = ["", ...relative.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))];
  return { relative, bytes, descriptorBefore: { ...stat }, descriptorAfter: { ...stat }, namedAfter: { ...stat },
    parents: ancestors.map(relative => {
      const parent = { ...stat, ino: String(parseInt(digest(`directory:${relative}`).slice(0, 12), 16)), mode: "16832", nlink: "2", size: "64" };
      return { relative, before: { ...parent }, after: { ...parent } };
    }) };
}

export function makeSyntheticManualOrphanMaintenanceResidueV1() {
  return file(".setfarm/.build-generation-maintenance-lock-v1.json.fixture", "synthetic maintenance residue\n");
}

function document<T>(relative: string, value: T, encoding: "canonical" | "record" | "pretty" = "canonical") {
  const text = encoding === "record" ? JSON.stringify(value) : encoding === "pretty" ? JSON.stringify(value, null, 2) : canonicalJsonStringify(value);
  return { file: file(relative, `${text}\n`), value };
}

function owner(pid: number, script: string) {
  return ObservedControlWorkerOwnerV1Schema.parse({ pid, processStartedAt: T0, processGroupId: pid,
    source: "observed_os", executable: "/fixture/node", script, commandHash: digest(`/fixture/node ${script}`) });
}

function nativeSnapshot(n: number, collector: ReturnType<typeof owner>) {
  const begin = n === 1 ? 70 : 100;
  let ordinal = 0;
  const capture = (argv: string[], stdout: string) => {
    const seq = ++ordinal;
    return { captureId: id(n * 100 + seq), collector, executable: "/bin/ps" as const, argv,
      cwd: "/fixture/maintenance", executorPid: 500 + n * 10 + seq, executorParentPid: collector.pid,
      invokedAtUTC: time(begin), spawnObservedAtUTC: time(begin + 1),
      exitObservedAtUTC: time(begin + 2), closeObservedAtUTC: time(begin + 3),
      exit: { code: 0, signal: null }, processClose: { code: 0, signal: null },
      stdout: { bytes: syntheticBytesV1(stdout), dataBytesObserved: Buffer.byteLength(stdout), endObserved: true, closeObserved: true },
      stderr: { bytes: syntheticBytesV1(""), dataBytesObserved: 0, endObserved: true, closeObserved: true }, errors: [] };
  };
  const censusArgv = ["-ww", "-axo", "pid=,ppid=,pgid=,command="];
  const executor = 500 + n * 10 + 1;
  const census = capture(censusArgv, `1 0 1 /sbin/launchd\n${collector.pid} 1 ${collector.processGroupId} ${collector.executable} ${collector.script}\n${executor} ${collector.pid} ${collector.processGroupId} /bin/ps ${censusArgv.join(" ")}\n`);
  const args = ["-ww", "-p", String(collector.pid), "-o", "lstart=", "-o", "pgid=", "-o", "args="];
  const raw = `Tue Oct 20 00:00:00 2026 ${collector.processGroupId} ${collector.executable} ${collector.script}\n`;
  const before = capture(args, raw), comm = capture(["-ww", "-p", String(collector.pid), "-o", "comm="], `${collector.executable}\n`), after = capture(args, raw);
  return { snapshotId: id(n + 10), observedAtStartUTC: time(begin), observedAtEndUTC: time(begin + 4), collector,
    census, collectorIdentity: { subject: "collector" as const, expected: collector, before, comm, after },
    services: [{ service: "dashboard" as const, status: "absent" as const }, { service: "spawner" as const, status: "absent" as const }] };
}

export function makeSyntheticManualOrphanEvidenceV1(mode: "early_cancel" | "continue_no_go" | "late_cancel" = "early_cancel"): { evidence: ManualOrphanEvidenceV1; priorRecord: ManualRecordV1 } {
  const original = owner(101, "/fixture/old/dist/cli/control-test-worker-v1.js");
  const priorOwner = owner(201, "/fixture/old/dist/cli/control-test-worker-v1.js");
  const maintenanceOwner = owner(400, "/fixture/maintenance/dist/cli/manual-control-orphan-retirement-v1.js");
  const selection = ControlSelectionIdentityV1Schema.parse({ schema: "setfarm.manual-control-selection.v1",
    installationId: id(5), sourceSha: SOURCE, installationDir: "/fixture/installation", releaseDir: "/fixture/old",
    catalogHash: h("catalog"), activationPreparedHash: h("prepared"), activationAcknowledgedHash: h("acknowledged") });
  const selectionHash = hashControlSelectionIdentityV1(selection), suiteHash = h("suite");
  const receipt = ControlJobReceiptV1Schema.parse({ schema: "mission-control.control-job.v1", jobId: JOB,
    kind: "convergence_full8", revision: 1, selectionHash, sourceSha: SOURCE, mcSourceSha: MC_SOURCE, mcBuildHash: h("mc-build"), suiteHash,
    state: "accepted", requestedAt: T0, startedAt: null, updatedAt: T0, finishedAt: null,
    phase: "starting", code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 8,
    reportRefs: {}, cancelRequested: false });
  const intentValue = ControlPrivateIntentV1Schema.parse({ schema: "mission-control.control-intent.v1", receipt,
    installationDir: selection.installationDir, releaseDir: selection.releaseDir, nonceDigest: h("nonce-digest"),
    fixedSuiteRelativePath: "evals/suites/product-convergence-codex-v1.json" });
  const intent = document(`${MC}/jobs/${JOB}/intent.json`, intentValue), intentHash = intent.file.bytes.sha256;
  const oldReceipt = ControlJobReceiptV1Schema.parse({ ...receipt, jobId: OLD_JOB, kind: "activation_preflight", suiteHash: null, plannedCases: 0 });
  const oldIntent = document(`${MC}/jobs/${OLD_JOB}/intent.json`, ControlPrivateIntentV1Schema.parse({ ...intentValue,
    receipt: oldReceipt, nonceDigest: h("prior-nonce-digest"), fixedSuiteRelativePath: null }));
  const acquire = { jobId: JOB, kind: "convergence_full8" as const, selectionHash, sourceSha: SOURCE, suiteHash };
  const oldAcquire = { ...acquire, jobId: OLD_JOB, kind: "activation_preflight" as const, suiteHash: null };
  const checks = ["release_identity", "release_cleanliness", "migration_attestation", "database_ownership", "setfarm_health", "mission_control_health", "execution_profile", "result_store"] as const;
  const preflight = createConvergencePreflight({ checks: checks.map(id => ({ id, status: "pass", code: "FIXTURE_CHECK_PASSED", evidenceHash: h(id) })) });
  const caseIds = ["utility-status-baseline", "utility-preference-compositional", "operations-work-baseline", "operations-queue-paraphrase", "game-start-baseline", "game-restart-compositional", "negative-ambiguous-product", "negative-unsupported-kernel"];
  const cases = caseIds.map((caseId, i) => ({ caseId, repetition: 1 as const, caseHash: h(`case:${i}`), taskHash: hashCanonicalJson(`Synthetic admitted task ${i}`) }));
  const tokens = cases.map((_, i) => `synthetic_slot_token_${i}_not_live_${"x".repeat(32)}`);
  const admissionSlots = cases.map((c, i) => {
    const selectorHash = canarySelectorHash(tokens[i]!);
    return { slotHash: computeCanarySlotHash({ releaseSha: SOURCE, suiteHash, ...c, selectorHash }),
      caseHash: c.caseHash, taskHash: c.taskHash, repetition: 1, selectorHash };
  });
  const admission = createV3ReleaseAdmissionV1({ schema: "setfarm.v3-release-admission.v1", kind: "convergence_canary",
    releaseSha: SOURCE, suiteHash, result: { hash: null, ref: null }, gate: { hash: null, ref: null },
    preflightHash: preflight.preflightHash, slots: admissionSlots, issuedAt: time(5), expiresAt: time(50) });
  const slots = admissionSlots.map(({ slotHash, caseHash, taskHash }) => ({ admissionHash: admission.admissionHash, slotHash, caseHash, taskHash, repetition: 1 as const }));
  const contexts = slots.map((slot, i) => ({ schema: "setfarm.internal-convergence-admission.v1" as const, ...slot, slotToken: tokens[i]! }));
  // Explicit original RecordSchema insertion order, not canonical JSON order.
  const record = (old: boolean, revision: number, phase: "pending" | "active" | "released", bound = false): ManualRecordV1 => ({
    schema: "setfarm.manual-evaluation-record.v1", reservation: { ...(old ? oldAcquire : acquire), revision, phase },
    owner: old ? priorOwner : original, intentHash: old ? oldIntent.file.bytes.sha256 : intentHash,
    nonceDigest: old ? oldIntent.value.nonceDigest : intentValue.nonceDigest,
    admissionHash: bound ? admission.admissionHash : null, slots: bound ? slots : [], executionMode: old ? "preflight" : "execute" });
  const records = [record(true, 1, "pending"), record(true, 2, "active"), record(true, 3, "released"),
    record(false, 4, "pending"), record(false, 5, "active"), record(false, 6, "active", true)];
  const history = records.map(value => document(`${ROOT}/revisions/${String(value.reservation.revision).padStart(20, "0")}.json`, value, "record"));
  const priorRecord = records[5]!;
  const reservation = document(`${ROOT}/reservation.json`, priorRecord, "record");
  const closure = document(`${ROOT}/closures/${OLD_JOB}.json`, { ...oldAcquire,
    schema: "setfarm.manual-control-custody-closed.v1" as const, executionMode: "preflight" as const, intentOrigin: "mission_control" as const,
    intentHash: oldIntent.file.bytes.sha256, nonceDigest: oldIntent.value.nonceDigest, owner: priorOwner,
    closure: { kind: "reservation_released" as const, revision: 3, recordHash: history[2]!.file.bytes.sha256 } }, "record");

  // Exact db-pg1477 wire formula under Root's Source reconciliation. The full
  // five-field stored identity is retained; no DB module is imported.
  const canonicalOwnerIdentity = validateInternalProductionCanonicalOwnerIdentityV1<"run">({
    schema: "setfarm.internal-production-canonical-owner-identity.v1", category: "run", ownerKey: RUN,
    ownerRef: `setfarm://runs/${encodeURIComponent(RUN)}`,
    ownerHash: hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId: RUN }) });
  const terminalAuthority = createInternalProductionTerminalOwnerAuthorityV1({ canonicalOwnerIdentity,
    terminalOwnerRef: `setfarm://runs/${RUN}/terminal/cancelled`,
    terminalOwnerHash: hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-terminal-owner.v1", runId: RUN, status: "cancelled" }) });
  const terminalPairCore = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminalAuthority);
  const closeProjection = { schema: "setfarm.internal-production-owner-reservation-close.v1" as const, closeKind: "ordinary" as const,
    reservationRef: `setfarm://internal-production/owner-reservations/${h("run-reservation")}`, reservationHash: h("run-reservation"),
    terminalOwnerRef: terminalAuthority.terminalOwnerRef, terminalOwnerHash: terminalAuthority.terminalOwnerHash,
    ownerAdmissionHeadPredecessorHash: h("owner-predecessor"), ownerAdmissionHeadSuccessorHash: h("owner-successor"),
    preservedFenceRef: null, preservedFenceHash: null };
  const closeHash = hashCanonicalJson(closeProjection);
  const close = validateInternalProductionOwnerReservationCloseV1({ ...closeProjection,
    closeRef: `setfarm://internal-production/owner-reservation-closes/${closeHash}`, closeHash });
  const terminalPair = { runOwnerReservationRef: close.reservationRef, runOwnerReservationHash: close.reservationHash, ...terminalPairCore };
  const findingSet = createFindingSetV1({ runId: RUN, storyId: "STORY_1", packetHash: h("packet"), sliceHash: h("slice"),
    sourceRevision: { sha: SOURCE, treeHash: "e".repeat(40) }, findings: [{ origin: "test", classification: "structured",
      invariantRef: "INV_FIXTURE_PUBLICATION", sourceLocators: [{ path: "src/fixture.ts", contentHash: h("source-file") }],
      observedEvidenceRefs: [h("finding-evidence")], expectedPredicateRef: "EVID_FIXTURE_PUBLICATION", status: "open" }] });
  const findingParents = [{ finding_set_hash: findingSet.findingSetHash, finding_set_id: findingSet.findingSetId,
    run_id: findingSet.runId, story_id: findingSet.storyId, packet_hash: findingSet.packetHash, slice_hash: findingSet.sliceHash,
    source_sha: findingSet.sourceRevision.sha, source_tree_hash: findingSet.sourceRevision.treeHash,
    finding_ids: findingSet.findings.map(f => f.findingId), payload: findingSet }];
  const findingChildren = findingSet.findings.map(f => ({ finding_set_hash: findingSet.findingSetHash, finding_id: f.findingId,
    origin: f.origin, classification: f.classification, invariant_ref: f.invariantRef, status: f.status,
    source_fingerprint: hashCanonicalJson(f.sourceLocators), payload: f }));
  requireFindingPublicationV1(findingParents[0]!, findingChildren);

  const oraclePayload = { schema: "setfarm.task-intent-oracle-evaluation.v1", oracleHash: h("oracle"), expectedDecision: "accepted_candidate",
    actualDecision: "unavailable", contractComplete: false, decisionEvidenceVerified: false, matchedIntentIds: [], requiredEvidenceRefs: [], mismatchCodes: ["ORACLE_DECISION_EVIDENCE_UNAVAILABLE"] };
  const stateHash = h("canonical-state"), empty = { stateHash };
  const runResult = createConvergenceRunResult({ schema: "setfarm.product-convergence-run-result.v1", suiteId: "synthetic-orphan", suiteVersion: 1,
    suiteHash, ...cases[0], productClass: "utility", runId: RUN, runNumber: 1, protocol: "v3", releaseSha: SOURCE,
    oracleHash: h("oracle"), expectedDecision: "accepted_candidate", expectedProviderHash: h("provider"), expectedModelHash: h("model"), expectedStackHash: h("stack"),
    runnerHash: h("runner"), environmentHash: h("environment"), expectedStackPackId: "vite-react-web-app", actualStackPackId: null,
    runtimeAdapter: "browser", startedAt: time(10), finishedAt: time(40), disposition: "cancelled", passed: false, rootCauseHash: h("cancel-root-cause"),
    canonical: { ...empty,
      packet: { ...empty, packetHash: null, casAuditHash: h("cas"), casDeepVerified: false, sealedStackPackId: null, packetRows: 0, artifactRefs: 0, missingRequiredRefs: 0, missingArtifacts: 0, invalidBindings: 0 },
      attempts: { ...empty, attempts: 0, active: 0, duplicateActiveTuples: 0, staleOwnership: 0, incompleteBindings: 0 },
      findings: { ...empty, findingSets: 1, openFindings: 1, invalidBindings: 0 },
      recovery: { ...empty, cases: 0, activeCases: 0, activeDeliveries: 0, overBudget: 0, invalidBindings: 0 },
      evidence: { ...empty, predicateCoverageHash: h("predicate"), bundles: 0, passing: 0, nonPassing: 0, missingAttemptEvidence: 0, invalidBindings: 0, missingExpectedPredicates: 0, unexpectedProductPredicates: 0, missingInvariantRefs: 0, nonPassingRequiredPredicates: 0 },
      acceptance: { ...empty, candidateHash: null, candidates: 0, storyEvidence: 0, sourceSha: null, sourceTreeHash: null, invalidBindings: 0 },
      oracle: { ...oraclePayload, evaluationHash: hashCanonicalJson(oraclePayload) }, invariantCodes: [] },
    projection: { setfarmSnapshotHash: h("projection"), missionControlSnapshotHash: h("projection"), exactHashMatch: true,
      setfarmProjection: "complete", missionControlProjection: "complete", capabilities: { attempts: true, claimBinding: true, runtimeOwnership: true, managerCompletion: true, effectLedger: true, findingRecovery: true, evidenceLedger: true, acceptedCandidate: true, deploymentReceipt: true, projectTransferAck: true },
      operationalSettled: true, transferAcknowledged: false, projectTransferAckHash: null, projectRecordHash: null },
    ownership: { ...empty, openClaims: 0, activeAttempts: 0, activeRuntimes: 0, activeRecoveryDeliveries: 0,
      projectIdentityState: mode === "early_cancel" ? "not_applicable" : "invalid",
      manualProjectMutationDetected: false, sourceHeadMatchesCanonical: mode === "early_cancel", projectHeadSha: null, projectTreeHash: null, canonicalHeadSha: null, canonicalTreeHash: null },
    github: { ...empty, pullRequests: 0, unverified: 0, open: 0 } });
  const resultPayload = { schema: "setfarm.product-convergence-result.v1", suiteId: "synthetic-orphan", suiteVersion: 1, suiteHash,
    releaseSha: SOURCE, runnerHash: h("runner"), environmentHash: h("environment"), executionMode: "execute", startedAt: time(5), finishedAt: time(45),
    plannedRuns: 8, status: "blocked", preflight, runs: [runResult], rootCauseCounts: [{ rootCauseHash: h("cancel-root-cause"), count: 1 }],
    stoppedOnRepeatedRootCause: null, blockerCodes: [mode === "early_cancel" ? "EVAL_CANCEL_REQUESTED" : "EVAL_RUN_IDENTITY_INVALIDATED"] };
  const candidate = createConvergenceResult(resultPayload), candidateGate = evaluateConvergenceReleaseGate(candidate);
  const final = mode === "late_cancel" ? createConvergenceResult({ ...resultPayload,
    blockerCodes: [...resultPayload.blockerCodes, "EVAL_CANCEL_REQUESTED"].sort() }) : candidate;
  const finalGate = evaluateConvergenceReleaseGate(final);
  const artifact = <T extends { resultHash: string } | { gateHash: string }>(value: T) => {
    const hash = "resultHash" in value && !("gateHash" in value) ? value.resultHash : (value as { gateHash: string }).gateHash;
    return document(`evals/results/${convergenceArtifactRef(hash)}`, value, "pretty");
  };
  const artifacts: Array<ManualOrphanEvidenceV1["artifacts"][number]> = [
    { kind: "run_result", document: artifact(runResult) }, { kind: "eval_result", document: artifact(candidate) },
    { kind: "release_gate", document: artifact(candidateGate) } ];
  if (final.resultHash !== candidate.resultHash) artifacts.push({ kind: "eval_result", document: artifact(final) }, { kind: "release_gate", document: artifact(finalGate) });

  const boundCase = cases[0]!;
  const phase = (phase: "acquired" | "preflight" | "admission" | "case_start" | "case_running" | "case_collect" | "publishing" | "finalizing" | "settling", completedCases = 0, currentCaseId: string | null = null): WorkerJournalEventV1 => ({ type: "phase", phase, currentCaseId, completedCases });
  const events: WorkerJournalEventV1[] = [
    { type: "acquired", kind: "convergence_full8", selectionHash, sourceSha: SOURCE, suiteHash, executionMode: "execute", owner: original, origin: "mission_control", reservationRevision: 5 },
    phase("preflight"), phase("admission"),
    { type: "canary_create_requested", releaseSha: SOURCE, suiteHash, preflightHash: preflight.preflightHash, ttlMs: 45000,
      slots: cases.map((c, i) => ({ ...c, slotToken: tokens[i]! })) },
    { type: "canary_bound", contexts: contexts.map((context, i) => ({ caseId: cases[i]!.caseId, context })), reservationRevision: 6 }, phase("case_start", 0, boundCase.caseId),
    { type: "start_requested", case: boundCase, admissionHash: admission.admissionHash, slotHash: slots[0]!.slotHash },
    { type: "run_bound", case: boundCase, admissionHash: admission.admissionHash, slotHash: slots[0]!.slotHash, runId: RUN, runNumber: 1, source: "start_response" },
    phase("case_running", 0, boundCase.caseId), { type: "cancel_latched", source: "operator", requestId: CANCEL },
    { type: "stop_requested", runId: RUN, snapshotHash: h("terminal-stop-snapshot") },
    { type: "stop_observed", runId: RUN, result: "requested", code: null }, phase("case_collect", 0, boundCase.caseId),
    { type: "run_result_stored", case: boundCase, runId: RUN, resultHash: runResult.resultHash }, phase("publishing", 1),
    { type: "artifacts_stored", stage: "candidate", resultHash: candidate.resultHash, gateHash: candidateGate.gateHash, resultStatus: "blocked", gateDecision: "no_go" },
    phase("finalizing", 1), { type: "finalization_boundary", resultHash: candidate.resultHash, gateHash: candidateGate.gateHash, gateDecision: "no_go", decision: "cancel" },
    { type: "artifacts_stored", stage: "cancelled_final", resultHash: final.resultHash, gateHash: finalGate.gateHash, resultStatus: "blocked", gateDecision: "no_go" }, phase("settling", 1) ];
  if (mode !== "early_cancel") {
    // Without worker cancellation, an invalid project identity causes the
    // runner's real case-return break. No invented stop or padding event.
    events.splice(9, 3);
    if (mode === "continue_no_go") {
      events[14] = { type: "finalization_boundary", resultHash: candidate.resultHash, gateHash: candidateGate.gateHash, gateDecision: "no_go", decision: "continue" };
      events[15] = { type: "artifacts_stored", stage: "final_without_promotion", resultHash: candidate.resultHash, gateHash: candidateGate.gateHash, resultStatus: "blocked", gateDecision: "no_go" };
    } else {
      events.splice(14, 0, { type: "cancel_latched", source: "operator", requestId: CANCEL });
    }
  }
  let previousHash: string | null = null;
  const journal = events.map((event, i) => {
    const value: WorkerJournalRecordV1 = { schema: "setfarm.manual-control-journal-record.v1", jobId: JOB, intentHash,
      ownerHash: hashObservedControlWorkerOwnerV1(original), revision: i + 1, previousHash, event };
    const bytes = serializeWorkerJournalRecordV1(value);
    previousHash = hashWorkerJournalRecordV1(value);
    return { file: file(`evals/manual-control-journals/${JOB}/records/${String(i + 1).padStart(20, "0")}.json`, bytes), value };
  });
  const headValue = { schema: "setfarm.manual-control-journal-head.v1" as const, jobId: JOB, revision: events.length, recordHash: previousHash! };
  const journalHead = { file: file(`evals/manual-control-journals/${JOB}/head.json`, serializeWorkerJournalHeadV1(headValue)), value: headValue };

  const readyReceipt = ControlJobReceiptV1Schema.parse({ ...receipt, revision: 2, state: "starting", updatedAt: time(1), phase: "starting" });
  const readyHash = h("retained-ready-worker-frame"), progressHash = h("retained-progress-worker-frame");
  const mapping = (sequence: number, hash: string, r: typeof receipt, brokerSequence: number) => ({ sequence, hash, ack: {
    schema: "setfarm.manual-control-worker-channel.v1" as const, jobId: JOB, channelId: CHANNEL, intentHash,
    direction: "broker_to_worker" as const, sequence: brokerSequence,
    body: { type: "ack" as const, workerSequence: sequence, workerFrameHash: hash, receiptRevision: r.revision, receipt: r },
    mac: h(`retained-ack-mac:${sequence}`) } });
  const ready = mapping(1, readyHash, readyReceipt, 2);
  const progressReceipt = ControlJobReceiptV1Schema.parse({ ...readyReceipt, revision: 3, state: "running", startedAt: time(2), updatedAt: time(2), phase: "acquired" });
  const progress = mapping(2, progressHash, progressReceipt, 3); // custody consumed broker1; ACKs do not share worker sequence numbers
  const cancelReceipt = ControlJobReceiptV1Schema.parse({ ...progressReceipt, revision: 4, updatedAt: time(25), state: "cancelling", code: "CONTROL_CANCEL_REQUESTED", cancelRequested: true });
  const snapshots = [{ receipt, mapping: null }, { receipt: readyReceipt, mapping: ready }, { receipt: progressReceipt, mapping: progress }, { receipt: cancelReceipt, mapping: progress }];
  const receipts = snapshots.map(value => document(`${MC}/jobs/${JOB}/receipt-${String(value.receipt.revision).padStart(20, "0")}.json`, value));
  const cancelKey = h("cancel-key");
  const cancel = document(`${MC}/jobs/${JOB}/cancel.json`, { schema: "mission-control.control-cancel.v1" as const,
    jobId: JOB, intentHash, channelId: CHANNEL, requestId: CANCEL, idempotencyKeyHash: cancelKey,
    acceptedReceiptRevision: 4, requestedAt: time(25) });
  const settlement = document(`${MC}/jobs/${JOB}/original-worker-settlement.json`, {
    schema: "mission-control.control-original-worker-settlement.v1" as const, subject: "original_fixed_node_worker" as const,
    jobId: JOB, kind: "convergence_full8" as const, channelId: CHANNEL, intentHash, selectionHash, sourceSha: SOURCE,
    mcSourceSha: MC_SOURCE, mcBuildHash: h("mc-build"), executableHash: h("node"), brokerPid: 300,
    originalChild: original, ownerHash: hashObservedControlWorkerOwnerV1(original), exit: { code: 1, signal: null }, processClose: { code: 1, signal: null },
    stdout: { endObserved: true, closeObserved: true }, stderr: { endObserved: true, closeObserved: true }, errors: [], observedFactsComplete: true, recordedAtUTC: time(60) });
  const oldFinishedReceipt = ControlJobReceiptV1Schema.parse({ ...oldReceipt, revision: 2, state: "completed", startedAt: T0, updatedAt: time(1), finishedAt: time(1), phase: "closed" });
  const index = document(`${MC}/index.json`, { schema: "mission-control.control-index.v1" as const, revision: 8,
    jobs: [{ keyHash: h("create-key"), intentHash, published: true, receipt: cancelReceipt, frames: [ready, progress],
      cancel: { keyHash: cancelKey, requestId: CANCEL, receipt: cancelReceipt, aliases: [{ keyHash: cancelKey, expectedRevision: 3 }] } },
    { keyHash: h("old-create-key"), intentHash: oldIntent.file.bytes.sha256, published: true, receipt: oldFinishedReceipt, frames: [], cancel: null }], history: [] });
  const childScript = "/fixture/old/dist/cli/cli.js", workflowId = "product-convergence";
  const child = ObservedControlWorkerOwnerV1Schema.parse({ ...owner(102, childScript), processGroupId: original.processGroupId,
    commandHash: digest(`/fixture/node ${childScript} workflow run ${workflowId} Synthetic admitted task 0 --protocol v3`) });
  const startChild = document(`${ROOT}/start-children/${JOB}/${slots[0]!.slotHash}.json`, { schema: "setfarm.manual-start-child.v1" as const,
    reservation: priorRecord.reservation, intentHash, owner: original, child, parentPid: original.pid,
    journal: { revision: 7, hash: journal[6]!.file.bytes.sha256 }, slot: slots[0]!, caseId: boundCase.caseId, workflowId });
  const activity = { active_runs: 0, open_claims: 0, active_attempts: 0, active_attempt_binding_conflicts: 0,
    active_runtimes: 0, active_runtime_completions: 0, active_completion_effects: 0, active_recovery_cases: 0,
    active_recovery_deliveries: 0, active_termination_requests: 0, active_compilations: 0, active_publications: 0,
    active_publication_batches: 0, active_outbox: 0, active_operational_deliveries: 0, active_owner_reservations: 0 };
  const databaseSlots = slots.map((slot, i) => ({ slot, admissionRows: [{ payload: admission, expires_at: admission.expiresAt!, expired: true }],
    claimRows: [{ run_id: i === 0 ? RUN : null, consumed_at: i === 0 ? time(10) : null, admission_hash: admission.admissionHash,
      admission_kind: "convergence_canary" as const, case_hash: slot.caseHash, task_hash: slot.taskHash, repetition: 1 as const, selector_hash: admissionSlots[i]!.selectorHash }],
    runRows: i === 0 ? [{ id: RUN, status: "cancelled" as const, protocol: "v3" as const, protocol_version: 1 as const, compiler_release_sha: SOURCE, release_admission_hash: admission.admissionHash, task: "Synthetic admitted task 0" }] : [],
    ownerRows: i === 0 ? [{ state: "closed" as const, close_ref: close.closeRef, close_hash: close.closeHash, canonical_owner_identity: canonicalOwnerIdentity }] : [],
    terminalPair: i === 0 ? terminalPair : null, close: i === 0 ? close : null }));
  const documents = [reservation, ...history, intent, oldIntent, closure, startChild, index, cancel, settlement, journalHead, ...receipts, ...journal, ...artifacts.map(a => a.document)];
  // Inventory is derived from every synthetic document, with explicit empty
  // known directories. No absent directory is silently represented by [] files.
  const inventory = new Map<string, Set<string>>();
  for (const relative of [ROOT, `${ROOT}/direct`, `${ROOT}/closures`, `${ROOT}/start-children`, "services", `${MC}/jobs`]) inventory.set(relative, new Set());
  for (const d of documents) {
    const parts = d.file.relative.split("/");
    for (let i = 0; i < parts.length; i++) {
      const parent = parts.slice(0, i).join("/");
      if (!inventory.has(parent)) inventory.set(parent, new Set());
      inventory.get(parent)!.add(parts[i]!);
    }
  }
  for (const relative of [...inventory.keys()]) {
    if (relative === "") continue;
    const parts = relative.split("/"), child = parts.pop()!, parent = parts.join("/");
    if (!inventory.has(parent)) inventory.set(parent, new Set());
    inventory.get(parent)!.add(child);
  }
  const authority = (sha: string, prefix: string) => ({ branch: "main" as const, clean: true as const, sha,
    treeHash: h(`${prefix}-tree`).slice(0, 40), buildHash: h(`${prefix}-build`), originMainSha: sha });
  inventory.get(`${MC}/jobs/${JOB}`)!.add("channel.json");
  const evidence: ManualOrphanEvidenceV1 = { schema: "setfarm.manual-control-orphan-evidence.v1",
    request: { requestId: id(6), jobId: JOB, expectedRevision: 6, expectedRecordHash: reservation.file.bytes.sha256,
      expectedJournalHeadHash: journalHead.file.bytes.sha256, expectedSettlementHash: settlement.file.bytes.sha256 },
    maintenanceSource: authority(M_SOURCE, "maintenance"), maintenanceOwner,
    target: { selection, source: authority(SOURCE, "target"), databaseName: "setfarm_fixture", runtimeRole: "sf_runtime_fixture", ownerRole: "sf_owner_fixture",
      ownerOid: 1001, runtimeOid: 1002, nodeExecutable: "/fixture/node", nodeExecutableHash: h("node"), mcSourceSha: MC_SOURCE, mcBuildHash: h("mc-build") },
    history, reservation, intent, mc: { index, channel: document(`${MC}/jobs/${JOB}/channel.json`, {
      schema: "mission-control.control-channel.v1", jobId: JOB, intentHash, channelId: CHANNEL, originalChild: original, readyFrameHash: readyHash }),
      receipts, cancel, cancelReplays: [], settlement }, journal, journalHead,
    database: { observedAtStartUTC: time(80), observedAtEndUTC: time(90), databaseName: "setfarm_fixture", currentUser: "sf_runtime_fixture", sessionUser: "sf_runtime_fixture",
      ownerOid: 1001, runtimeOid: 1002, backendPid: 600, activityRows: [activity], findingParents, findingChildren, slots: databaseSlots, releaseGoRows: [] },
    artifacts, namespace: { directories: [...inventory].map(([relative, names]) => ({ relative, names: [...names].sort() })).sort((a, b) => a.relative.localeCompare(b.relative)), otherIntents: [{ origin: "mission_control", jobId: OLD_JOB, intent: oldIntent, closure }],
      closures: [closure], startChildren: [startChild], mutationFiles: [], retirementFiles: [], buildMaintenanceFiles: [], unexpectedFiles: [] },
    nativeBefore: nativeSnapshot(1, maintenanceOwner), nativeAfter: nativeSnapshot(2, maintenanceOwner) };
  // Real file/DB observations have independent object graphs. In particular,
  // changing a repeated mapping snapshot must not silently mutate its original
  // ACK or index copy, and changing head data must not mutate archived6.
  return { evidence: JSON.parse(JSON.stringify(evidence)) as ManualOrphanEvidenceV1,
    priorRecord: JSON.parse(JSON.stringify(priorRecord)) as ManualRecordV1 };
}
