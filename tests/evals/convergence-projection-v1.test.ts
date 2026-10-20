import { computeRunOperationalSnapshotHashV3, RunOperationalSnapshotV3Schema, type RunOperationalSnapshotV3 } from "../../src/server/schemas/run-operational-snapshot-v3.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateConvergenceProjectionPairV1 } from "../../src/evals/convergence-projection-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { RunOperationalSnapshotV2Schema, type RunOperationalSnapshotV2 } from "../../src/server/schemas/run-operational-snapshot-v2.js";
import {
  convergenceAcceptedOperationalSnapshotFixtureV1,
  convergenceOperationalSnapshotV2Fixture,
  convergenceOperationalSnapshotV3Fixture,
  convergenceOperationalSnapshotV2Hash,
} from "./fixtures/convergence-operational-snapshot-v3.js";

const RUN_ID = "run-projection-v2";
const CAPABILITIES = [
  "attempts", "claimBinding", "runtimeOwnership", "managerCompletion", "effectLedger",
  "findingRecovery", "evidenceLedger", "acceptedCandidate", "deploymentReceipt", "projectTransferAck",
].sort();

function validSnapshot(change?: (value: RunOperationalSnapshotV2) => void): RunOperationalSnapshotV2 {
  const value = convergenceOperationalSnapshotV2Fixture(RUN_ID);
  change?.(value);
  const { snapshotHash, ...hashable } = value;
  return RunOperationalSnapshotV2Schema.parse({
    ...hashable,
    snapshotHash: convergenceOperationalSnapshotV2Hash(hashable),
  });
}

function pair(setfarm: unknown, missionControl: unknown = structuredClone(setfarm), runId = RUN_ID) {
  return evaluateConvergenceProjectionPairV1({ runId, setfarm, missionControl });
}

function assertUnavailable(observed: ReturnType<typeof pair>) {
  const hash = hashCanonicalJson({ projection: "unavailable" });
  assert.deepEqual(observed, {
    ordinaryPending: false,
    projection: {
      setfarmSnapshotHash: hash,
      missionControlSnapshotHash: hash,
      exactHashMatch: false,
      setfarmProjection: "unavailable",
      missionControlProjection: "unavailable",
      capabilities: Object.fromEntries(CAPABILITIES.map(key => [key, false])),
      operationalSettled: false,
      transferAcknowledged: false,
      projectTransferAckHash: null,
      projectRecordHash: null,
    },
  });
}

function drainingSnapshot() {
  return validSnapshot(value => {
    value.claims.push({
      ref: "setfarm://claim/1", id: "1", runRef: value.run.ref,
      stepRef: `${value.run.ref}/step/plan`, storyRef: null, workflowStepId: "plan",
      storyId: null, agentId: "compiler", state: "open", outcome: null,
      claimedAt: value.generatedAt, abandonedAt: null,
    });
    value.summary.activeClaims = 1;
    value.outbox.push({
      ref: "setfarm://outbox/projection-drain", outboxId: "projection-drain", requestRef: null,
      eventKey: "projection-drain", eventType: "run.terminalized", aggregateType: "run",
      aggregateId: value.run.id, state: "pending", attemptCount: 0, publishedAt: null,
      createdAt: value.generatedAt, updatedAt: value.generatedAt,
    });
    value.summary.unpublishedOutbox = 1;
  });
}

describe("V2 convergence projection extraction compatibility", () => {
  it("preserves a full strict settled negative pair and exact ten capabilities", () => {
    const value = validSnapshot();
    const before = structuredClone(value);
    assert.equal(value.run.status, "failed");
    assert.equal(value.summary.operatorActions.stop.allowed, false);
    assert.equal(value.summary.operatorActions.resume.allowed, false);
    assert.deepEqual(Object.keys(pair(value).projection.capabilities).sort(), CAPABILITIES);
    assert.deepEqual(pair(value), {
      ordinaryPending: false,
      projection: {
        setfarmSnapshotHash: value.snapshotHash,
        missionControlSnapshotHash: value.snapshotHash,
        exactHashMatch: true,
        setfarmProjection: "complete", missionControlProjection: "complete",
        capabilities: Object.fromEntries(CAPABILITIES.map(key => [key, true])),
        operationalSettled: true, transferAcknowledged: false,
        projectTransferAckHash: null, projectRecordHash: null,
      },
    });
    assert.deepEqual(value, before);
  });

  it("excludes observation clocks from the canonical state hash", () => {
    const left = validSnapshot();
    const right = validSnapshot(value => { value.generatedAt = "2026-07-13T12:00:01.000Z"; });
    assert.equal(left.snapshotHash, right.snapshotHash);
    assert.equal(pair(left, right).projection.exactHashMatch, true);
    assert.equal(pair(left, right).projection.operationalSettled, true);
  });

  it("fails closed for either unavailable read and equal sentinel hashes", () => {
    const value = validSnapshot();
    for (const [setfarm, missionControl] of [[undefined, value], [value, undefined], [undefined, undefined], [null, null]]) {
      assertUnavailable(evaluateConvergenceProjectionPairV1({ runId: RUN_ID, setfarm, missionControl }));
    }
  });

  it("rejects strict schema-invalid bodies even with a recomputed canonical hash", () => {
    const value = validSnapshot();
    const { snapshotHash, ...hashable } = value;
    const extra = { ...hashable, unexpected: true };
    const invalid = { ...extra, snapshotHash: convergenceOperationalSnapshotV2Hash(extra) };
    assert.equal(RunOperationalSnapshotV2Schema.safeParse(invalid).success, false);
    assertUnavailable(pair(value, invalid));
    assertUnavailable(pair(invalid, value));
  });

  it("rejects wrong run identity and stale hashes on either side", () => {
    const value = validSnapshot();
    assertUnavailable(pair(value, value, "different-run"));
    const corrupted = RunOperationalSnapshotV2Schema.parse({ ...value, snapshotHash: "0".repeat(64) });
    assertUnavailable(pair(value, corrupted));
    assertUnavailable(pair(corrupted, value));
    const changedPermission = RunOperationalSnapshotV2Schema.parse({
      ...value,
      summary: { ...value.summary, operatorActions: {
        ...value.summary.operatorActions,
        stop: { ...value.summary.operatorActions.stop, allowed: true },
      } },
    });
    assertUnavailable(pair(value, changedPermission));
  });

  it("preserves valid unequal state hashes without treating the pair as unavailable", () => {
    const left = validSnapshot();
    const right = validSnapshot(value => { value.run.updatedAt = "2026-07-13T12:00:01.000Z"; });
    const observed = pair(left, right);
    assert.notEqual(left.snapshotHash, right.snapshotHash);
    assert.equal(observed.projection.exactHashMatch, false);
    assert.equal(observed.projection.setfarmProjection, "complete");
    assert.equal(observed.projection.missionControlProjection, "complete");
    assert.equal(observed.projection.operationalSettled, true);
    assert.equal(observed.ordinaryPending, false);
  });

  it("keeps partial sources unsettled and capability evidence conjunctive", () => {
    const complete = validSnapshot();
    const partial = validSnapshot(value => {
      value.source.projection = "partial";
      value.source.capabilities.attempts = false;
    });
    for (const [left, right] of [[complete, partial], [partial, complete]]) {
      const observed = pair(left, right);
      assert.equal(observed.projection.capabilities.attempts, false);
      assert.ok(Object.entries(observed.projection.capabilities).every(([key, enabled]) => key === "attempts" || enabled));
      assert.equal(observed.projection.operationalSettled, false);
      assert.equal(observed.ordinaryPending, false);
    }
  });

  it("fails closed when either valid partial source lacks implementation submission evidence", () => {
    const value = validSnapshot();
    const unsupported = validSnapshot(snapshot => {
      snapshot.source.projection = "partial";
      snapshot.source.capabilities.implementationSubmissionEvidence = false;
    });
    assertUnavailable(pair(value, unsupported));
    assertUnavailable(pair(unsupported, value));
  });

  it("distinguishes ordinary owner/outbox drain from a valid settled transition", () => {
    const pending = drainingSnapshot();
    const observed = pair(pending);
    assert.equal(observed.projection.exactHashMatch, true);
    assert.equal(observed.ordinaryPending, true);
    assert.equal(observed.projection.operationalSettled, false);
    const settled = structuredClone(pending);
    settled.claims[0]!.state = "closed";
    settled.claims[0]!.outcome = "completed";
    settled.summary.activeClaims = 0;
    settled.outbox[0]!.state = "published";
    settled.outbox[0]!.publishedAt = "2026-07-13T12:00:01.000Z";
    settled.summary.unpublishedOutbox = 0;
    const { snapshotHash, ...hashable } = settled;
    const validated = RunOperationalSnapshotV2Schema.parse({ ...hashable, snapshotHash: convergenceOperationalSnapshotV2Hash(hashable) });
    assert.equal(pair(validated).ordinaryPending, false);
    assert.equal(pair(validated).projection.operationalSettled, true);
  });

  it("does not mistake inconsistent outbox counters or quarantined work for ordinary drain", () => {
    for (const state of ["counter", "quarantined"] as const) {
      const value = drainingSnapshot();
      if (state === "counter") value.summary.unpublishedOutbox = 0;
      else value.outbox[0]!.state = "quarantined";
      const { snapshotHash, ...hashable } = value;
      const validated = RunOperationalSnapshotV2Schema.parse({ ...hashable, snapshotHash: convergenceOperationalSnapshotV2Hash(hashable) });
      assert.equal(pair(validated).ordinaryPending, false);
      assert.equal(pair(validated).projection.operationalSettled, false);
    }
  });

  it("keeps nonterminal, unhealthy and invariant-bearing snapshots unsettled", () => {
    const changes: Array<(value: RunOperationalSnapshotV2) => void> = [
      value => { value.run.terminal = false; value.run.status = "running"; value.summary.lifecycleState = "idle"; },
      value => { value.summary.health = "attention"; },
      value => {
        value.invariants.push({ code: "TEST_PROJECTION_INVARIANT", severity: "warning", refs: [value.run.ref], observedAt: value.generatedAt });
        value.summary.invariantViolations = 1;
      },
      value => { value.source.projection = "unavailable"; value.summary.health = "unavailable"; },
    ];
    for (const change of changes) {
      const observed = pair(validSnapshot(change));
      assert.equal(observed.projection.operationalSettled, false);
      assert.equal(observed.ordinaryPending, false);
    }
  });

  it("preserves full strict accepted candidate/deployment/transfer success", () => {
    const value = RunOperationalSnapshotV2Schema.parse(convergenceAcceptedOperationalSnapshotFixtureV1({ runId: RUN_ID, version: "v2" }));
    const ack = value.projectTransferAck?.acknowledgement;
    assert.ok(ack);
    assert.ok(value.acceptedCandidate && value.deploymentReceipt);
    const observed = pair(value);
    assert.equal(observed.projection.exactHashMatch, true);
    assert.equal(observed.projection.setfarmProjection, "complete");
    assert.equal(observed.projection.missionControlProjection, "complete");
    assert.equal(observed.projection.operationalSettled, true);
    assert.ok(Object.values(observed.projection.capabilities).every(Boolean));
    assert.equal(observed.ordinaryPending, false);
    assert.equal(observed.projection.transferAcknowledged, true);
    assert.equal(observed.projection.projectTransferAckHash, ack.ackHash);
    assert.equal(observed.projection.projectRecordHash, ack.projectRecordHash);
  });

  it("rejects separately valid unequal transfer identities with their hashes fully rebound", () => {
    const left = RunOperationalSnapshotV2Schema.parse(convergenceAcceptedOperationalSnapshotFixtureV1({ runId: RUN_ID, version: "v2", persistedAt: "2026-07-13T12:00:00.000Z" }));
    const right = RunOperationalSnapshotV2Schema.parse(convergenceAcceptedOperationalSnapshotFixtureV1({ runId: RUN_ID, version: "v2", persistedAt: "2026-07-13T12:00:01.000Z" }));
    assert.notEqual(left.projectTransferAck!.acknowledgement.ackHash, right.projectTransferAck!.acknowledgement.ackHash);
    assert.notEqual(left.projectTransferAck!.acknowledgement.projectRecordHash, right.projectTransferAck!.acknowledgement.projectRecordHash);
    const observed = pair(left, right);
    assert.equal(observed.projection.exactHashMatch, false);
    assert.equal(observed.projection.transferAcknowledged, false);
    assert.equal(observed.projection.projectTransferAckHash, null);
    assert.equal(observed.projection.projectRecordHash, null);
    assert.equal(observed.projection.operationalSettled, true);
  });
});

describe("V3 refusal projection causal witnesses", () => {
  for (const reasonCode of [
    "PRODUCT_SPEC_TASK_AMBIGUOUS",
    "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
  ] as const) {
    it(`accepts the full strict settled V3 refusal pair ${reasonCode}`, () => {
      const value = RunOperationalSnapshotV3Schema.parse(
        convergenceOperationalSnapshotV3Fixture("run-projection-refusal", reasonCode),
      );
      assert.equal(value.terminationRequests.length, 1);
      assert.deepEqual(value.terminationRequests[0]!.evidence.reasonCodes, [reasonCode]);
      assert.equal(value.operationalFailure?.terminationRequestRef, value.terminationRequests[0]!.ref);
      assert.equal(value.summary.operatorActions.stop.allowed, false);
      assert.equal(value.summary.operatorActions.resume.allowed, false);
      const observed = evaluateConvergenceProjectionPairV1({
        runId: value.run.id,
        setfarm: value,
        missionControl: structuredClone(value),
      });
      assert.equal(observed.projection.exactHashMatch, true);
      assert.equal(observed.projection.setfarmProjection, "complete");
      assert.equal(observed.projection.missionControlProjection, "complete");
      assert.equal(observed.projection.operationalSettled, true);
      assert.equal(observed.ordinaryPending, false);
      assert.equal(observed.projection.transferAcknowledged, false);
      assert.ok(Object.values(observed.projection.capabilities).every(Boolean));
    });
  }
});

function rehashV3(value: unknown) {
  return { ...(value as Record<string, unknown>), snapshotHash: computeRunOperationalSnapshotHashV3(value) };
}

function validV3Snapshot(change?: (value: RunOperationalSnapshotV3) => void): RunOperationalSnapshotV3 {
  const value = convergenceOperationalSnapshotV3Fixture(RUN_ID, "PRODUCT_SPEC_TASK_AMBIGUOUS");
  change?.(value);
  return RunOperationalSnapshotV3Schema.parse(rehashV3(value));
}

function acceptedV3Snapshot(persistedAt?: string): RunOperationalSnapshotV3 {
  return RunOperationalSnapshotV3Schema.parse(convergenceAcceptedOperationalSnapshotFixtureV1({
    runId: RUN_ID, version: "v3", persistedAt,
  }));
}

function assertInvalidV3(value: unknown) {
  const invalid = rehashV3(value);
  assert.equal(RunOperationalSnapshotV3Schema.safeParse(invalid).success, false);
  const valid = validV3Snapshot();
  assertUnavailable(pair(valid, invalid));
  assertUnavailable(pair(invalid, valid));
}

describe("strict versioned convergence projection policy", () => {
  for (const version of ["v2", "v3"] as const) {
    it(`preserves complete accepted transfer authority for ${version}`, () => {
      const fixture = convergenceAcceptedOperationalSnapshotFixtureV1({ runId: RUN_ID, version });
      const value = version === "v3"
        ? RunOperationalSnapshotV3Schema.parse(fixture)
        : RunOperationalSnapshotV2Schema.parse(fixture);
      if (value.schema === "setfarm.run-operational-snapshot.v3") {
        assert.equal(value.operationalFailure, null);
        assert.deepEqual(value.source.migrationVersions, [19, 22]);
        assert.equal(value.source.capabilities.operationalFailureAuthority, true);
      }
      assert.notEqual(value.source.verifiedReleaseSha, null);
      assert.equal(value.source.capabilities.implementationSubmissionEvidence, true);
      assert.equal(value.run.status, "completed");
      assert.equal(value.run.terminal, true);
      assert.equal(value.terminationRequests.length, 0);
      const ack = value.projectTransferAck?.acknowledgement;
      assert.ok(ack);
      const observed = pair(value);
      assert.equal(observed.projection.exactHashMatch, true);
      assert.equal(observed.projection.setfarmProjection, "complete");
      assert.equal(observed.projection.missionControlProjection, "complete");
      assert.equal(observed.projection.operationalSettled, true);
      assert.deepEqual(Object.keys(observed.projection.capabilities).sort(), CAPABILITIES);
      assert.ok(Object.values(observed.projection.capabilities).every(Boolean));
      assert.equal(observed.ordinaryPending, false);
      assert.equal(observed.projection.transferAcknowledged, true);
      assert.equal(observed.projection.projectTransferAckHash, ack.ackHash);
      assert.equal(observed.projection.projectRecordHash, ack.projectRecordHash);
    });
  }

  it("requires equal acknowledgement identities from separately valid accepted V3 snapshots", () => {
    const left = acceptedV3Snapshot("2026-07-13T12:00:00.000Z");
    const right = acceptedV3Snapshot("2026-07-13T12:00:01.000Z");
    const leftAck = left.projectTransferAck!.acknowledgement;
    const rightAck = right.projectTransferAck!.acknowledgement;
    assert.equal(leftAck.candidateHash, rightAck.candidateHash);
    assert.equal(leftAck.deploymentReceiptHash, rightAck.deploymentReceiptHash);
    assert.equal(leftAck.projectionHash, rightAck.projectionHash);
    assert.notEqual(leftAck.projectRecordHash, rightAck.projectRecordHash);
    assert.notEqual(leftAck.projectRecordRef, rightAck.projectRecordRef);
    assert.notEqual(leftAck.ackHash, rightAck.ackHash);
    assert.notEqual(left.projectTransferAck!.ref, right.projectTransferAck!.ref);
    assert.notEqual(left.snapshotHash, right.snapshotHash);
    const observed = pair(left, right);
    assert.equal(observed.projection.exactHashMatch, false);
    assert.equal(observed.projection.operationalSettled, true);
    assert.equal(observed.ordinaryPending, false);
    assert.equal(observed.projection.transferAcknowledged, false);
    assert.equal(observed.projection.projectTransferAckHash, null);
    assert.equal(observed.projection.projectRecordHash, null);
  });

  it("ignores only observation clocks while retaining full V3 failure authority in the hash", () => {
    const left = validV3Snapshot();
    const right = validV3Snapshot(value => { value.generatedAt = "2026-07-13T12:00:01.000Z"; });
    assert.equal(left.snapshotHash, right.snapshotHash);
    assert.equal(pair(left, right).projection.exactHashMatch, true);
    assert.equal(pair(left, right).projection.operationalSettled, true);
    const invariantLeft = validV3Snapshot(value => {
      value.invariants.push({ code: "TEST_PROJECTION_INVARIANT", severity: "warning", refs: [value.run.ref], observedAt: value.generatedAt });
      value.summary.invariantViolations = 1;
    });
    const invariantRight = structuredClone(invariantLeft);
    invariantRight.invariants[0]!.observedAt = "2026-07-13T12:00:01.000Z";
    RunOperationalSnapshotV3Schema.parse(invariantRight);
    assert.equal(invariantLeft.snapshotHash, computeRunOperationalSnapshotHashV3(invariantRight));
    assert.equal(pair(invariantLeft, invariantRight).projection.exactHashMatch, true);
    assert.equal(pair(invariantLeft, invariantRight).projection.operationalSettled, false);
  });

  it("retains literal version identities for independently valid V2 versus V3", () => {
    const v2 = validSnapshot();
    const v3 = validV3Snapshot();
    const observed = pair(v2, v3);
    assert.equal(observed.projection.exactHashMatch, false);
    assert.equal(observed.projection.setfarmProjection, "complete");
    assert.equal(observed.projection.missionControlProjection, "complete");
    assert.equal(observed.projection.operationalSettled, true);
    assert.equal(observed.ordinaryPending, false);
  });

  it("rejects unknown versions and never retries a V3 literal through a V2-shaped body", () => {
    const v2 = validSnapshot();
    const unknown = rehashV3({ ...v2, schema: "setfarm.run-operational-snapshot.v99" });
    assert.equal(RunOperationalSnapshotV2Schema.safeParse(unknown).success, false);
    assert.equal(RunOperationalSnapshotV3Schema.safeParse(unknown).success, false);
    assertUnavailable(pair(unknown, unknown));
    assertInvalidV3({ ...v2, schema: "setfarm.run-operational-snapshot.v3" });
  });

  it("rejects extra top-level and capability fields with independently recomputed hashes", () => {
    const value = validV3Snapshot();
    assertInvalidV3({ ...value, unexpected: true });
    assertInvalidV3({ ...value, source: { ...value.source, capabilities: { ...value.source.capabilities, unexpected: true } } });
  });

  it("rejects missing or spurious canonical failure authority", () => {
    const value = validV3Snapshot();
    const { operationalFailure, ...missing } = value;
    assertInvalidV3(missing);
    assertInvalidV3({ ...value, operationalFailure: null });
    assertInvalidV3({ ...acceptedV3Snapshot(), operationalFailure });
    assertInvalidV3({ ...value, run: { ...value.run, status: "cancelled" } });
  });

  it("rejects incorrect request refs, identity hashes, requesters and trusted causes", () => {
    const changes: Array<(value: RunOperationalSnapshotV3) => void> = [
      value => { value.operationalFailure!.terminationRequestRef = "setfarm://run-termination/unbound"; },
      value => { value.operationalFailure!.failureIdentity.operationalCauseHash = "0".repeat(64); },
      value => { value.operationalFailure!.failureIdentity.requestedBy = "unknown-requester"; },
      value => { value.operationalFailure!.failureIdentity.evidenceSchema = "setfarm.unknown-evidence.v1"; },
      value => { value.terminationRequests[0]!.requestedBy = "unknown-requester"; },
      value => {
        value.terminationRequests[0]!.evidence.operationalFailureCause = {
          ...value.operationalFailure!.failureIdentity.operationalCause,
          failureCode: "V3_PLAN_UNAUTHORIZED_REFUSAL",
        };
      },
    ];
    for (const change of changes) {
      const value = validV3Snapshot();
      change(value);
      assertInvalidV3(value);
    }
  });

  it("rejects incomplete migration, attestation and operational failure capability contracts", () => {
    assertInvalidV3({ ...validV3Snapshot(), source: { ...validV3Snapshot().source, migrationVersions: [19] } });
    const noSubmissionMigration = validV3Snapshot();
    noSubmissionMigration.source.migrationVersions = [22];
    assertInvalidV3(noSubmissionMigration);
    const noAttestation = validV3Snapshot();
    noAttestation.source.verifiedReleaseSha = null;
    assertInvalidV3(noAttestation);
    const incomplete = acceptedV3Snapshot();
    incomplete.source.capabilities.operationalFailureAuthority = false;
    assertInvalidV3(incomplete);
  });

  it("fails closed on wrong runs and corruption of full failure, source or action state", () => {
    const valid = validV3Snapshot();
    assertUnavailable(pair(valid, valid, "different-run"));
    const changes: Array<(value: RunOperationalSnapshotV3) => void> = [
      value => { value.snapshotHash = "0".repeat(64); },
      value => { value.terminationRequests[0]!.diagnostic = "Changed terminal diagnostic."; },
      value => { value.terminationRequests[0]!.evidence.rejectionHash = "0".repeat(64); },
      value => { value.source.verifiedReleaseSha = "c".repeat(40); },
      value => { value.summary.operatorActions.stop.allowed = true; },
      value => { value.operationalFailure!.failureIdentity.operationalCause.boundary = "other.boundary"; },
    ];
    for (const change of changes) {
      const corrupted = structuredClone(valid);
      change(corrupted);
      assert.equal(RunOperationalSnapshotV3Schema.safeParse(corrupted).success, false);
      assertUnavailable(pair(valid, corrupted));
      assertUnavailable(pair(corrupted, valid));
    }
  });

  it("retains valid V3 mismatch and settlement as independent predicates", () => {
    const left = validV3Snapshot();
    const right = validV3Snapshot(value => { value.terminationRequests[0]!.diagnostic = "A separately observed canonical terminal diagnostic."; });
    assert.notEqual(left.snapshotHash, right.snapshotHash);
    const observed = pair(left, right);
    assert.equal(observed.projection.exactHashMatch, false);
    assert.equal(observed.projection.operationalSettled, true);
    assert.equal(observed.ordinaryPending, false);
  });

  it("preserves V3 partial capability conjunctions and the separate submission prerequisite", () => {
    const complete = validV3Snapshot();
    const partial = validV3Snapshot(value => {
      value.source.projection = "partial";
      value.source.capabilities.attempts = false;
    });
    const unsupported = validV3Snapshot(value => {
      value.source.projection = "partial";
      value.source.capabilities.implementationSubmissionEvidence = false;
    });
    for (const [left, right] of [[complete, partial], [partial, complete]]) {
      const observed = pair(left, right);
      assert.equal(observed.projection.capabilities.attempts, false);
      assert.ok(Object.entries(observed.projection.capabilities).every(([key, enabled]) => key === "attempts" || enabled));
      assert.equal(observed.projection.operationalSettled, false);
      assert.equal(observed.ordinaryPending, false);
    }
    assertUnavailable(pair(complete, unsupported));
    assertUnavailable(pair(unsupported, complete));
  });

  it("tracks real V3 claim and outbox drain through closed owners and published events", () => {
    const pending = validV3Snapshot(value => {
      const owners = drainingSnapshot();
      value.claims = owners.claims;
      value.outbox = owners.outbox;
      value.summary.activeClaims = 1;
      value.summary.unpublishedOutbox = 1;
    });
    assert.equal(pair(pending).ordinaryPending, true);
    assert.equal(pair(pending).projection.operationalSettled, false);
    const settled = structuredClone(pending);
    settled.claims[0]!.state = "closed";
    settled.claims[0]!.outcome = "completed";
    settled.summary.activeClaims = 0;
    settled.outbox[0]!.state = "published";
    settled.outbox[0]!.publishedAt = "2026-07-13T12:00:01.000Z";
    settled.summary.unpublishedOutbox = 0;
    const validated = RunOperationalSnapshotV3Schema.parse(rehashV3(settled));
    assert.equal(pair(validated).ordinaryPending, false);
    assert.equal(pair(validated).projection.operationalSettled, true);
    for (const state of ["counter", "quarantined"] as const) {
      const invalidDrain = structuredClone(pending);
      if (state === "counter") invalidDrain.summary.unpublishedOutbox = 0;
      else invalidDrain.outbox[0]!.state = "quarantined";
      const schemaValid = RunOperationalSnapshotV3Schema.parse(rehashV3(invalidDrain));
      assert.equal(pair(schemaValid).ordinaryPending, false);
      assert.equal(pair(schemaValid).projection.operationalSettled, false);
    }
  });

  it("keeps valid nonterminal, unhealthy, partial and unavailable V3 sources unsettled", () => {
    const active = validV3Snapshot();
    active.run.terminal = false;
    active.run.status = "running";
    active.summary.lifecycleState = "idle";
    active.terminationRequests = [];
    active.operationalFailure = null;
    const values = [
      RunOperationalSnapshotV3Schema.parse(rehashV3(active)),
      validV3Snapshot(value => { value.summary.health = "attention"; }),
      validV3Snapshot(value => { value.source.projection = "partial"; }),
      validV3Snapshot(value => { value.source.projection = "unavailable"; value.summary.health = "unavailable"; }),
    ];
    for (const value of values) {
      assert.equal(pair(value).projection.operationalSettled, false);
      assert.equal(pair(value).ordinaryPending, false);
    }
  });
});
