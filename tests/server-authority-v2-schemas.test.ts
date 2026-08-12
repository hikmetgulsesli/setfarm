import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
  DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
  createOperationalFailureIdentityV2,
} from "../src/execution/schemas/operational-failure-identity-v2.js";
import {
  canonicalJsonBytes,
  hashCanonicalJson,
} from "../src/product-compiler/canonical-json.js";
import { ContentAddressedArtifactStore } from "../src/product-compiler/artifact-store.js";
import { compileProductBuildPacket } from "../src/product-compiler/packet-compiler.js";
import {
  RuntimeArtifactReaderError,
  type SealedRuntimePacket,
} from "../src/product-compiler/runtime-artifact-reader.js";
import {
  stitchTargetCandidateSelectionFailureFingerprintBasisV1,
  type StitchTargetCandidateSelectionFailureV1,
} from "../src/product-compiler/schemas/stitch-target-candidate-selection-failure-v1.js";
import { ProductBuildAuthorityV1Schema } from "../src/server/schemas/product-build-authority-v1.js";
import { ProductBuildAuthorityV2Schema } from "../src/server/schemas/product-build-authority-v2.js";
import {
  ProductBuildAuthorityV2Error,
  produceSealedProductBuildAuthorityV2,
  readProductBuildAuthorityV2,
  readVersionedProductBuildAuthority,
} from "../src/server/product-build-authority.js";
import {
  RunOperationalSnapshotV3Schema,
  computeRunOperationalSnapshotHashV3,
} from "../src/server/schemas/run-operational-snapshot-v3.js";
import { projectCanonicalOperationalFailureV3 } from "../src/server/run-operational-snapshot.js";
import { buildMinimalValidV3Contracts } from "./product-compiler/fixtures/minimal-valid-contract.js";

const RELEASE_SHA = "a".repeat(40);
const RUN_ID = "RUN_schema-authority-v2";
const RUN_REF = `setfarm://run/${RUN_ID}`;
const TERMINATION_REF = "setfarm://run-termination/RTR_schema-authority-v2";
const NOW = "2026-07-16T08:00:00.000Z";
const CAUSE = Object.freeze({
  schema: "setfarm.operational-failure-cause.v1" as const,
  workflowStepId: "design",
  boundary: "product_compiler.design_candidate_authority",
  failureClass: "generated_artifact_invalid" as const,
  failureCode: "V3_DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED",
});
const ARTIFACT_LIMITS = {
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 8 * 1024 * 1024,
  minFreeBytes: 0,
};
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function candidateFailure(): StitchTargetCandidateSelectionFailureV1 {
  const withoutFingerprint: Omit<StitchTargetCandidateSelectionFailureV1, "fingerprint"> = {
    schema: "setfarm.stitch-target-candidate-selection-failure.v1",
    generationTargetsHash: "1".repeat(64),
    directResponseEvidenceHash: "2".repeat(64),
    candidateSelectionHash: "3".repeat(64),
    targetFailures: [{
      targetRef: "TARGET_HOME",
      stageId: "stage-home",
      evaluations: [{
        screenId: "screen-home",
        qualificationTier: "exact_title_incomplete_semantics",
        rejectionCodes: ["CANDIDATE_ACTION_SET_MISMATCH"],
        semanticChecks: [{
          kind: "action",
          semanticRef: "ACT_SAVE",
          expectedCount: 1,
          observedCount: 0,
          elementRefs: [],
          disposition: "missing",
        }],
      }],
      rejectionCodes: ["CANDIDATE_ACTION_SET_MISMATCH"],
    }],
    expectedDelta: {
      kind: "candidate_authority_change",
      targetRefs: ["TARGET_HOME"],
      rejectionCodesToClear: ["CANDIDATE_ACTION_SET_MISMATCH"],
      requiredAuthorityHash: "candidateSelectionHash",
      fromCandidateSelectionHash: "3".repeat(64),
    },
    owner: "stitch_generation_orchestrator",
    retry: {
      disposition: "retry_after_authority_delta",
      sameAuthorityRetryForbidden: true,
      maxAttempts: 1,
    },
  };
  return {
    ...withoutFingerprint,
    fingerprint: hashCanonicalJson(
      stitchTargetCandidateSelectionFailureFingerprintBasisV1(withoutFingerprint),
    ),
  };
}

function refusalFixture() {
  const payload = candidateFailure();
  const envelope = {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
    producer: {
      pass: "stitch-target-candidate-selection-failure",
      codeSha: RELEASE_SHA,
      toolVersions: { zod: "4.4.3" },
    },
    payload,
  };
  const artifactHash = hashCanonicalJson(envelope);
  const failureIdentity = createOperationalFailureIdentityV2({
    requestedBy: DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
    evidenceSchema: DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
    operationalCause: CAUSE,
    exactFailure: {
      schema: "setfarm.operational-exact-failure-identity.v2",
      kind: "stitch_target_candidate_selection",
      refKey: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
      artifactType: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
      failureArtifactHash: artifactHash,
      failureFingerprint: payload.fingerprint,
      candidateSelectionHash: payload.candidateSelectionHash,
    },
  });
  const identity = {
    schema: "setfarm.product-build-authority.v2" as const,
    runId: RUN_ID,
    disposition: "refused_before_packet" as const,
    packetAuthority: null,
    refusal: {
      terminationRequestRef: TERMINATION_REF,
      failureIdentity,
      failureArtifact: {
        refKey: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
        artifactHash,
        envelope,
      },
    },
  };
  return {
    ...identity,
    authorityHash: hashCanonicalJson(identity),
  };
}

function snapshotFixture() {
  const refusal = refusalFixture();
  const exact = refusal.refusal.failureIdentity.exactFailure!;
  const hashable = {
    schema: "setfarm.run-operational-snapshot.v3" as const,
    generatedAt: NOW,
    source: {
      database: "postgres" as const,
      projection: "partial" as const,
      migrationVersions: [22],
      verifiedReleaseSha: RELEASE_SHA,
      capabilities: {
        attempts: false,
        claimBinding: false,
        runtimeOwnership: false,
        managerCompletion: false,
        effectLedger: false,
        findingRecovery: false,
        evidenceLedger: false,
        acceptedCandidate: false,
        deploymentReceipt: false,
        projectTransferAck: false,
        implementationSubmissionEvidence: false,
        operationalFailureAuthority: true,
      },
    },
    run: {
      ref: RUN_REF,
      id: RUN_ID,
      runNumber: 42,
      protocol: "v3" as const,
      status: "failed",
      terminal: true,
      updatedAt: NOW,
    },
    summary: {
      lifecycleState: "terminal" as const,
      health: "blocked" as const,
      activeClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: "4".repeat(64) },
        resume: { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: "5".repeat(64) },
      },
    },
    claims: [],
    attempts: [],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [{
      ref: TERMINATION_REF,
      requestId: "RTR_schema-authority-v2",
      runRef: RUN_REF,
      targetStatus: "failed" as const,
      state: "terminalized" as const,
      requestedBy: DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
      diagnostic: "Typed design authority refused before packet sealing",
      evidence: {
        schema: DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
        terminalFailure: true as const,
        owner: "compiler" as const,
        outcome: "candidate_authority_unresolved" as const,
        failureRefKey: exact.refKey,
        failureArtifactType: exact.artifactType,
        failureArtifactHash: exact.failureArtifactHash,
        failureFingerprint: exact.failureFingerprint,
        candidateSelectionHash: exact.candidateSelectionHash,
        modelRedispatchBudget: 0 as const,
        operationalFailureCause: CAUSE,
      },
      requestedAt: NOW,
      drainedAt: NOW,
      terminalizedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    }],
    outbox: [],
    invariants: [],
    operationalFailure: {
      terminationRequestRef: TERMINATION_REF,
      failureIdentity: refusal.refusal.failureIdentity,
    },
  };
  return {
    ...hashable,
    snapshotHash: computeRunOperationalSnapshotHashV3(hashable),
  };
}

function rehashSnapshot<T extends Record<string, unknown>>(value: T) {
  const { snapshotHash: _snapshotHash, ...hashable } = value;
  return { ...hashable, snapshotHash: computeRunOperationalSnapshotHashV3(hashable) };
}

function rehashAuthority<T extends Record<string, unknown>>(value: T) {
  const { authorityHash: _authorityHash, ...identity } = value;
  return { ...identity, authorityHash: hashCanonicalJson(identity) };
}

async function sealedPacketAuthorityV1() {
  const contracts = buildMinimalValidV3Contracts();
  const producer = {
    pass: "server-authority-schema-test",
    codeSha: RELEASE_SHA,
    toolVersions: { zod: "4.4.3" },
  };
  const compilation = await compileProductBuildPacket({
    ...contracts,
    compiler: { version: "3.0.0", codeSha: RELEASE_SHA },
    producer,
    protocol: "v3",
    artifactStore: {
      async put(value: unknown) {
        return { hash: hashCanonicalJson(value), path: "memory://artifact", created: true };
      },
    },
  });
  assert.equal(compilation.status, "sealed");
  assert.ok(compilation.packet && compilation.packetHash);
  const identity = {
    schema: "setfarm.product-build-authority.v1" as const,
    runId: RUN_ID,
    packetHash: compilation.packetHash,
    producer,
    productSpec: contracts.productSpec,
    designGraph: contracts.designGraph,
    buildTopology: contracts.buildTopology,
    storyPlan: contracts.storyPlan,
    packet: compilation.packet,
    compilationReport: compilation.report,
    refs: {
      productSpec: compilation.artifactHashes.productSpec,
      designGraph: compilation.artifactHashes.designGraph,
      buildTopology: compilation.artifactHashes.buildTopology,
      storyPlan: compilation.artifactHashes.storyPlan,
      packet: compilation.packetHash,
      compilationReport: compilation.reportHash,
    },
  };
  return ProductBuildAuthorityV1Schema.parse({
    ...identity,
    authorityHash: hashCanonicalJson(identity),
  });
}

async function verifiedRefusalReaderFixture(options: Readonly<{
  indexedByteLengthDelta?: number;
}> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-authority-v2-producer-"));
  roots.push(root);
  const artifactRoot = path.join(root, "sha256");
  const refusal = refusalFixture();
  const envelope = refusal.refusal.failureArtifact.envelope;
  const stored = await new ContentAddressedArtifactStore(artifactRoot, {
    limits: ARTIFACT_LIMITS,
  }).put(envelope);
  assert.equal(stored.hash, refusal.refusal.failureArtifact.artifactHash);
  const termination = snapshotFixture().terminationRequests[0]!;
  const sql = {
    async unsafe(query: string) {
      if (query.includes("FROM run_termination_requests")) {
        return [{
          request_id: termination.requestId,
          target_status: termination.targetStatus,
          state: termination.state,
          requested_by: termination.requestedBy,
          evidence: termination.evidence,
        }];
      }
      if (query.includes("FROM run_artifact_refs")) {
        return [{
          artifact_hash: stored.hash,
          artifact_type: envelope.artifactType,
          byte_length: canonicalJsonBytes(envelope).byteLength
            + (options.indexedByteLengthDelta ?? 0),
          producer_metadata: envelope.producer,
        }];
      }
      throw new Error(`Unexpected authority v2 query: ${query}`);
    },
  } as any;
  return {
    options: { sql, artifactRoot, artifactLimits: ARTIFACT_LIMITS },
    refusal,
    storedPath: stored.path,
  };
}

describe("run operational snapshot v3 schema", () => {
  it("binds one canonical terminal request to its stable and exact failure identities", () => {
    const snapshot = snapshotFixture();
    const parsed = RunOperationalSnapshotV3Schema.parse(snapshot);
    assert.equal(parsed.operationalFailure?.terminationRequestRef, TERMINATION_REF);
    assert.equal(
      parsed.operationalFailure?.failureIdentity.exactFailure?.failureArtifactHash,
      refusalFixture().refusal.failureArtifact.artifactHash,
    );
  });

  it("rejects projection, hash, and exact authority drift after canonical rehashing", () => {
    const snapshot = snapshotFixture();
    assert.equal(RunOperationalSnapshotV3Schema.safeParse({
      ...snapshot,
      snapshotHash: "f".repeat(64),
    }).success, false);

    const wrongRef = structuredClone(snapshot);
    wrongRef.operationalFailure.terminationRequestRef = "setfarm://run-termination/other";
    assert.equal(RunOperationalSnapshotV3Schema.safeParse(rehashSnapshot(wrongRef)).success, false);

    const wrongArtifact = structuredClone(snapshot);
    wrongArtifact.operationalFailure.failureIdentity.exactFailure!.failureArtifactHash = "e".repeat(64);
    assert.equal(
      RunOperationalSnapshotV3Schema.safeParse(rehashSnapshot(wrongArtifact)).success,
      false,
    );

    const unsupported = structuredClone(snapshot);
    unsupported.source.capabilities.operationalFailureAuthority = false;
    unsupported.operationalFailure = null;
    assert.equal(RunOperationalSnapshotV3Schema.safeParse(rehashSnapshot(unsupported)).success, false);
  });

  it("uses null when no trusted canonical termination exists", () => {
    const snapshot = snapshotFixture();
    const withoutTermination = rehashSnapshot({
      ...snapshot,
      terminationRequests: [],
      operationalFailure: null,
    });
    assert.equal(RunOperationalSnapshotV3Schema.safeParse(withoutTermination).success, true);
  });

  it("projects exact snapshot failure identity only after the shared deep refusal read", async () => {
    const fixture = await verifiedRefusalReaderFixture();
    const snapshot = snapshotFixture();
    const operationalFailure = await projectCanonicalOperationalFailureV3(
      fixture.options.sql,
      RUN_ID,
      snapshot.terminationRequests,
      {
        artifactRoot: fixture.options.artifactRoot,
        artifactLimits: fixture.options.artifactLimits,
      },
    );
    assert.equal(
      operationalFailure?.failureIdentity.exactFailure?.failureArtifactHash,
      fixture.refusal.refusal.failureArtifact.artifactHash,
    );
  });
});

describe("product build authority v2 schema", () => {
  it("defaults versioned reads to v2 and exposes v1 only as an explicit migration view", async () => {
    const v1 = await sealedPacketAuthorityV1();
    const { schema: _schema, authorityHash: _authorityHash, ...packet } = v1;
    const reader = {
      async readSealedPacket() { return packet as SealedRuntimePacket; },
      async auditTerminalPacket() { throw new Error("unreachable"); },
    };
    const refusalOptions = {
      sql: { async unsafe() { throw new Error("unreachable"); } } as any,
      artifactRoot: path.join(tmpdir(), "unreachable-authority-v2"),
      artifactLimits: ARTIFACT_LIMITS,
    };
    const current = await readVersionedProductBuildAuthority({
      reader,
      runId: RUN_ID,
      refusalOptions,
    });
    assert.equal(current.schema, "setfarm.product-build-authority.v2");
    const legacy = await readVersionedProductBuildAuthority({
      schema: "v1",
      reader,
      runId: RUN_ID,
      refusalOptions,
    });
    assert.equal(legacy.schema, "setfarm.product-build-authority.v1");
  });

  it("deeply binds a refused-before-packet authority to the exact semantic envelope", () => {
    const refusal = refusalFixture();
    assert.equal(ProductBuildAuthorityV2Schema.safeParse(refusal).success, true);

    const wrongFingerprint = structuredClone(refusal);
    wrongFingerprint.refusal.failureIdentity.exactFailure!.failureFingerprint = "f".repeat(64);
    assert.equal(
      ProductBuildAuthorityV2Schema.safeParse(rehashAuthority(wrongFingerprint)).success,
      false,
    );

    const wrongArtifactHash = structuredClone(refusal);
    wrongArtifactHash.refusal.failureArtifact.artifactHash = "e".repeat(64);
    wrongArtifactHash.refusal.failureIdentity.exactFailure!.failureArtifactHash = "e".repeat(64);
    assert.equal(
      ProductBuildAuthorityV2Schema.safeParse(rehashAuthority(wrongArtifactHash)).success,
      false,
    );
  });

  it("reads refused-before-packet only after termination, ref, index, and CAS verification", async () => {
    const fixture = await verifiedRefusalReaderFixture();
    const reader = {
      async readSealedPacket(): Promise<SealedRuntimePacket> {
        throw new RuntimeArtifactReaderError("RUNTIME_PACKET_NOT_ACTIVE", "terminal run");
      },
      async auditTerminalPacket(): Promise<SealedRuntimePacket> {
        throw new RuntimeArtifactReaderError("RUNTIME_PACKET_NOT_SEALED", "no packet");
      },
    };
    const authority = await readProductBuildAuthorityV2(reader, RUN_ID, fixture.options);
    assert.equal(authority.disposition, "refused_before_packet");
    assert.equal(
      authority.refusal?.failureArtifact.artifactHash,
      fixture.refusal.refusal.failureArtifact.artifactHash,
    );

    const previousAuthorityMode = process.env.SETFARM_ARTIFACT_STORE_AUTHORITY_V1;
    process.env.SETFARM_ARTIFACT_STORE_AUTHORITY_V1 = "enabled";
    try {
      const standalonePort = new ContentAddressedArtifactStore(
        fixture.options.artifactRoot,
        { limits: ARTIFACT_LIMITS },
      );
      for (const artifactReadPort of [undefined, standalonePort]) {
        await assert.rejects(
          readProductBuildAuthorityV2(reader, RUN_ID, {
            ...fixture.options,
            ...(artifactReadPort ? { artifactReadPort } : {}),
          }),
          (error: unknown) => error instanceof ProductBuildAuthorityV2Error
            && error.code === "PRODUCT_BUILD_REFUSAL_ARTIFACT_AUTHORITY_REQUIRED",
        );
      }
    } finally {
      if (previousAuthorityMode === undefined) {
        delete process.env.SETFARM_ARTIFACT_STORE_AUTHORITY_V1;
      } else {
        process.env.SETFARM_ARTIFACT_STORE_AUTHORITY_V1 = previousAuthorityMode;
      }
    }

    const drifted = await verifiedRefusalReaderFixture({ indexedByteLengthDelta: 1 });
    await assert.rejects(
      readProductBuildAuthorityV2(reader, RUN_ID, drifted.options),
      (error: unknown) => error instanceof ProductBuildAuthorityV2Error
        && error.code === "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID",
    );

    const missing = await verifiedRefusalReaderFixture();
    await rm(missing.storedPath);
    await assert.rejects(
      readProductBuildAuthorityV2(reader, RUN_ID, missing.options),
      (error: unknown) => error instanceof ProductBuildAuthorityV2Error
        && error.code === "PRODUCT_BUILD_REFUSAL_ARTIFACT_STORE_INVALID",
    );
  });

  it("wraps a sealed v1 packet without mutating its authority", async () => {
    const packetAuthority = await sealedPacketAuthorityV1();
    const {
      schema: _schema,
      authorityHash: _authorityHash,
      ...sealedPacket
    } = packetAuthority;
    const authority = produceSealedProductBuildAuthorityV2(
      sealedPacket as SealedRuntimePacket,
    );
    assert.equal(ProductBuildAuthorityV2Schema.safeParse(authority).success, true);
    assert.deepEqual(authority.packetAuthority, packetAuthority);

    const wrongRun = rehashAuthority({ ...authority, runId: "RUN_other" });
    assert.equal(ProductBuildAuthorityV2Schema.safeParse(wrongRun).success, false);
  });
});
