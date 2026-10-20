import type { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { RunOperationalSnapshotV2Schema, type RunOperationalSnapshotV2 } from "../server/schemas/run-operational-snapshot-v2.js";
import { RunOperationalSnapshotV3Schema, type RunOperationalSnapshotV3 } from "../server/schemas/run-operational-snapshot-v3.js";
import type { ConvergenceProjectionEvidenceV1Schema } from "./result-schema.js";

export type ConvergenceProjectionPairEvaluationV1 = Readonly<{
  projection: z.infer<typeof ConvergenceProjectionEvidenceV1Schema>;
  ordinaryPending: boolean;
}>;

type ProjectionCapabilities = ConvergenceProjectionPairEvaluationV1["projection"]["capabilities"];

const REQUIRED_CAPABILITIES = [
  "attempts",
  "claimBinding",
  "runtimeOwnership",
  "managerCompletion",
  "effectLedger",
  "findingRecovery",
  "evidenceLedger",
  "acceptedCandidate",
  "deploymentReceipt",
  "projectTransferAck",
] as const;

function parseSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("schema" in value)) return null;
  if (value.schema === "setfarm.run-operational-snapshot.v2") return RunOperationalSnapshotV2Schema.safeParse(value);
  if (value.schema === "setfarm.run-operational-snapshot.v3") return RunOperationalSnapshotV3Schema.safeParse(value);
  return null;
}

function hasValidSnapshotHash(snapshot: RunOperationalSnapshotV2 | RunOperationalSnapshotV3): boolean {
  const { snapshotHash, generatedAt, ...state } = snapshot;
  const invariants = state.invariants.map(({ observedAt, ...item }) => item);
  const validHash = hashCanonicalJson({ ...state, invariants }) === snapshotHash;
  return validHash;
}

function unavailableProjection(): z.infer<typeof ConvergenceProjectionEvidenceV1Schema> {
  const hash = hashCanonicalJson({ projection: "unavailable" });
  return {
    setfarmSnapshotHash: hash,
    missionControlSnapshotHash: hash,
    exactHashMatch: false,
    setfarmProjection: "unavailable",
    missionControlProjection: "unavailable",
    capabilities: Object.fromEntries(REQUIRED_CAPABILITIES.map((key) => [key, false])) as ProjectionCapabilities,
    operationalSettled: false,
    transferAcknowledged: false,
    projectTransferAckHash: null,
    projectRecordHash: null,
  };
}

export function evaluateConvergenceProjectionPairV1(input: Readonly<{
  runId: string;
  setfarm: unknown;
  missionControl: unknown;
}>): ConvergenceProjectionPairEvaluationV1 {
  const setfarm = parseSnapshot(input.setfarm);
  const missionControl = parseSnapshot(input.missionControl);
  if (!setfarm?.success || !missionControl?.success) return { projection: unavailableProjection(), ordinaryPending: false };
  if (
    setfarm.data.run.id !== input.runId
    || missionControl.data.run.id !== input.runId
    || !hasValidSnapshotHash(setfarm.data)
    || !hasValidSnapshotHash(missionControl.data)
    || !setfarm.data.source.capabilities.implementationSubmissionEvidence
    || !missionControl.data.source.capabilities.implementationSubmissionEvidence
  ) return { projection: unavailableProjection(), ordinaryPending: false };
  const capabilities = Object.fromEntries(REQUIRED_CAPABILITIES.map((key) => [
    key,
    setfarm.data.source.capabilities[key] === true
      && missionControl.data.source.capabilities[key] === true,
  ])) as ProjectionCapabilities;
  const setfarmAck = setfarm.data.projectTransferAck?.acknowledgement ?? null;
  const missionControlAck = missionControl.data.projectTransferAck?.acknowledgement ?? null;
  const transferAcknowledged = Boolean(
    setfarmAck
    && missionControlAck
    && setfarmAck.ackHash === missionControlAck.ackHash
    && setfarmAck.projectRecordHash === missionControlAck.projectRecordHash
    && setfarmAck.sourceSnapshotHash === missionControlAck.sourceSnapshotHash,
  );
  const snapshots = [setfarm.data, missionControl.data];
  const knownTerminal = snapshots.every(snapshot => snapshot.run.terminal
    && snapshot.summary.lifecycleState === "terminal" && snapshot.summary.health === "ok"
    && snapshot.summary.invariantViolations === 0 && snapshot.invariants.length === 0
    && snapshot.source.projection === "complete"
    && snapshot.outbox.every(item => ["pending", "leased", "published"].includes(item.state))
    && snapshot.summary.unpublishedOutbox === snapshot.outbox.filter(item => item.state !== "published").length);
  const pendingOwners = (snapshot: typeof setfarm.data) => snapshot.summary.activeClaims + snapshot.summary.activeAttempts
    + snapshot.summary.activeRuntimes + snapshot.summary.openCompletions + snapshot.summary.mandatoryEffectsPending
    + snapshot.summary.unpublishedOutbox;
  const ordinaryPending = knownTerminal && snapshots.some(snapshot => pendingOwners(snapshot) > 0);
  const operationalSettled = knownTerminal && snapshots.every((snapshot) =>
    snapshot.summary.lifecycleState === "terminal"
    && snapshot.summary.health === "ok"
    && snapshot.summary.invariantViolations === 0
    && pendingOwners(snapshot) === 0
    && snapshot.invariants.length === 0
    && snapshot.outbox.every((item) => item.state === "published"));
  const projection: z.infer<typeof ConvergenceProjectionEvidenceV1Schema> = {
    setfarmSnapshotHash: setfarm.data.snapshotHash,
    missionControlSnapshotHash: missionControl.data.snapshotHash,
    exactHashMatch: setfarm.data.snapshotHash === missionControl.data.snapshotHash,
    setfarmProjection: setfarm.data.source.projection,
    missionControlProjection: missionControl.data.source.projection,
    capabilities,
    operationalSettled,
    transferAcknowledged,
    projectTransferAckHash: transferAcknowledged ? setfarmAck!.ackHash : null,
    projectRecordHash: transferAcknowledged ? setfarmAck!.projectRecordHash : null,
  };
  return { ordinaryPending, projection };
}
