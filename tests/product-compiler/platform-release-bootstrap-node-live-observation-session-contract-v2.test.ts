import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_FRAME_COUNT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_INCOMPLETENESS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_RECURSIVE_ENTRIES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_RELEASE_ORDER_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_HASH_V2,
  buildNodeLiveObservationAckFrameV2,
  buildNodeLiveObservationFrameV2,
  buildNodeLiveObservationSessionCloseFrameV2,
  buildNodeLiveObservationSessionOpenFrameV2,
  hashNodeLiveObservationAckFrameV2,
  hashNodeLiveObservationFrameV2,
  hashNodeLiveObservationHeldLockCaptureBindingV2,
  hashNodeLiveObservationSemanticJoinReceiptV2,
  hashNodeLiveObservationSessionCloseFrameV2,
  hashNodeLiveObservationSessionOpenFrameV2,
  joinNodeLiveObservationSessionToSemanticSnapshotV2,
  parseNodeLiveObservationAckFrameCandidateV2,
  parseNodeLiveObservationFrameCandidateV2,
  parseNodeLiveObservationIncompletenessCandidateV2,
  parseNodeLiveObservationSessionCandidateV2,
  parseNodeLiveObservationSessionCloseFrameCandidateV2,
  parseNodeLiveObservationSessionOpenFrameCandidateV2,
  parseNodeLiveObservationSemanticJoinReceiptCandidateV2,
  rollNodeLiveObservationTranscriptHashV2,
  verifyNodeLiveObservationSemanticJoinReceiptV2,
  type PlatformReleaseBootstrapNodeLiveObservationFrameV2,
  type PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2,
  type PlatformReleaseBootstrapNodeLiveObservationSessionV2,
} from "../../src/product-compiler/platform-release-bootstrap-node-live-observation-session-contract-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
  buildNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2,
  hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2,
} from "../../src/product-compiler/node-toolchain-provisioner-bootstrap-lifecycle-semantic-snapshot-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildFsObservationFingerprintV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildPackageLifecyclePhysicalProjectionV2,
  buildStableFsObjectIdentityV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import {
  classifyPlatformReleaseBootstrapNamespaceBasenameV2,
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  buildNodeToolchainProvisionerBootstrapRollbackHistoryV2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";

const hash = (character: string): string => character.repeat(64);

function makeOpen(sessionOccurrenceHash = hash("a")) {
  const filesystemScope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: hash("0"),
  });
  const parentIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "directory",
    device: "7",
    inode: "100",
  });
  const sharedLockIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "ordinary_file",
    device: "7",
    inode: "101",
  });
  const packageLockIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "ordinary_file",
    device: "7",
    inode: "102",
  });
  const fingerprint = (
    objectIdentity: typeof parentIdentity,
    byteLength: number,
    changedTimeNanoseconds: string,
  ) => buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: 501,
    ownerGid: 20,
    mode: objectIdentity.objectKind === "directory" ? "0755" : "0600",
    linkCount: 1,
    byteLength,
    modifiedTimeNanoseconds: "1000000000",
    changedTimeNanoseconds,
  });
  const sharedLockClassification =
    classifyPlatformReleaseBootstrapNamespaceBasenameV2(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
    );
  const packageLockClassification =
    classifyPlatformReleaseBootstrapNamespaceBasenameV2(
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
    );
  return buildNodeLiveObservationSessionOpenFrameV2({
    sessionOccurrenceHash,
    filesystemScope,
    parent: {
      objectIdentity: parentIdentity,
      fingerprint: fingerprint(parentIdentity, 96, "1000000001"),
    },
    heldLocks: [
      {
        lockRole: "shared_registry_parent_lock",
        lockMode: "exclusive_advisory_held",
        descriptorUse: "read_only_observation_only",
        basename: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
        classification: sharedLockClassification,
        parentObjectIdentityHash: parentIdentity.objectIdentityHash,
        objectIdentity: sharedLockIdentity,
        fingerprint: fingerprint(
          sharedLockIdentity,
          PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_BYTES_V2,
          "1000000002",
        ),
        contentHash:
          PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_HASH_V2,
      },
      {
        lockRole: "registered_node_package_lock",
        lockMode: "exclusive_advisory_held",
        descriptorUse: "read_only_observation_only",
        basename:
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
        classification: packageLockClassification,
        parentObjectIdentityHash: parentIdentity.objectIdentityHash,
        objectIdentity: packageLockIdentity,
        fingerprint: fingerprint(
          packageLockIdentity,
          PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_BYTES_V2,
          "1000000003",
        ),
        contentHash:
          PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_HASH_V2,
      },
    ],
  });
}

function makePhysicalEvidence(
  open: PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2,
  parent = open.parent,
) {
  const logicalCensus = classifyPlatformReleaseBootstrapNamespaceCensusV2([
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  ]);
  const orderedEntryCaptures = logicalCensus.orderedEntries.map(
    (classification) => {
      const lock = classification.category === "shared_parent_lock"
        ? open.heldLocks[0]
        : open.heldLocks[1];
      return buildNamespacePhysicalEntryCaptureV2({
        classification,
        parentObjectIdentityHash:
          parent.objectIdentity.objectIdentityHash,
        objectIdentity: lock.objectIdentity,
        fingerprint: lock.fingerprint,
        contentEvidence: {
          kind: "bounded_regular_file_bytes",
          rawContentHash: lock.contentHash,
        },
      });
    },
  );
  const physicalCensus = buildNamespacePhysicalCensusV2({
    filesystemScope: open.filesystemScope,
    logicalCensus,
    parentObjectIdentity: parent.objectIdentity,
    parentFingerprint: parent.fingerprint,
    orderedEntryCaptures,
  });
  const nodePhysicalProjection = buildPackageLifecyclePhysicalProjectionV2(
    physicalCensus,
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  );
  const nodeLogicalProjection =
    projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2(
      logicalCensus,
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
    );
  return { physicalCensus, nodePhysicalProjection, nodeLogicalProjection };
}

function makeObservation(
  open: PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2,
  evidence: ReturnType<typeof makePhysicalEvidence>,
) {
  const recursiveEvidenceHash =
    hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2({
      status: "empty_or_rolled_back",
      packageRoot: null,
      orderedTreeEntries: null,
    });
  return buildNodeLiveObservationFrameV2(open, {
    globalPhysicalCensusHash: evidence.physicalCensus.physicalCensusHash,
    nodeRecursiveEvidence: {
      evidenceHash: recursiveEvidenceHash,
      entryCount: 0,
      complete: true,
    },
    sourceProjectionHashes: {
      logicalCensusHash: evidence.physicalCensus.logicalCensus.censusHash,
      physicalCensusHash: evidence.physicalCensus.physicalCensusHash,
      nodePackageProjectionHash: evidence.nodePhysicalProjection.projectionHash,
      nodePackageLockObjectIdentityHash:
        open.heldLocks[1].objectIdentity.objectIdentityHash,
    },
    globalPhysicalCensusLockBindings: {
      physicalCensusHash: evidence.physicalCensus.physicalCensusHash,
      sharedParentLockCaptureBindingHash:
        open.heldLocks[0].captureBindingHash,
      nodePackageLockCaptureBindingHash:
        open.heldLocks[1].captureBindingHash,
    },
  });
}

function makeAcceptedFixture(
  sessionOccurrenceHash = hash("a"),
  transplantProjectionParent = false,
) {
  const open = makeOpen(sessionOccurrenceHash);
  const projectionParentIdentity = transplantProjectionParent
    ? buildStableFsObjectIdentityV2({
        filesystemScope: open.filesystemScope,
        objectKind: "directory",
        device: open.parent.objectIdentity.device,
        inode: "999",
      })
    : open.parent.objectIdentity;
  const projectionParent = transplantProjectionParent
    ? {
        objectIdentity: projectionParentIdentity,
        fingerprint: buildFsObservationFingerprintV2({
          objectIdentity: projectionParentIdentity,
          ownerUid: open.ownershipBoundary.ownerUid,
          ownerGid: open.ownershipBoundary.ownerGid,
          mode: "0755",
          linkCount: 1,
          byteLength: open.parent.fingerprint.byteLength,
          modifiedTimeNanoseconds:
            open.parent.fingerprint.modifiedTimeNanoseconds,
          changedTimeNanoseconds:
            open.parent.fingerprint.changedTimeNanoseconds,
        }),
      }
    : open.parent;
  const evidence = makePhysicalEvidence(open, projectionParent);
  const observation = makeObservation(open, evidence);
  const semanticSnapshot =
    buildNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2({
      schema:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA,
      version: "2.0.0",
      packageRef:
        PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
      admissionScope: "test_fixture",
      productionAuthority: false,
      observationAuthority:
        "captured_evidence_requires_live_native_session_receipt_v2",
      semanticVerifierContractHash:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
      nodeLifecycleIdentityHash:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
      filesystemScope: open.filesystemScope,
      expectedOwner: {
        uid: open.ownershipBoundary.ownerUid,
        gid: open.ownershipBoundary.ownerGid,
      },
      sourceLogicalCensusHash:
        evidence.physicalCensus.logicalCensus.censusHash,
      sourcePhysicalCensusHash: evidence.physicalCensus.physicalCensusHash,
      nodeLogicalProjection: evidence.nodeLogicalProjection,
      nodePhysicalProjection: evidence.nodePhysicalProjection,
      nodePhysicalProjectionHash: evidence.nodePhysicalProjection.projectionHash,
      liveObservationBinding: {
        sessionOccurrenceHash: open.sessionOccurrenceHash,
        observationTranscriptHash: observation.transcriptHash,
        globalPhysicalCensusHash: evidence.physicalCensus.physicalCensusHash,
        nodeRecursiveEvidenceHash:
          observation.nodeRecursiveEvidence.evidenceHash,
        rollbackLocatorAuthority:
          "basename_binding_only_locator_hash_requires_live_native_session_receipt_v2",
      },
      heldPackageLock: {
        objectIdentity: open.heldLocks[1].objectIdentity,
        fingerprint: open.heldLocks[1].fingerprint,
        rawContentHash: open.heldLocks[1].contentHash,
      },
      rollbackReceipts: [],
      rollbackHistory:
        buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([]),
      status: "empty_or_rolled_back",
      activeGeneration: null,
    });
  const acknowledgement = buildNodeLiveObservationAckFrameV2(observation, {
    disposition: "accept_read_only",
    semanticSnapshot,
  });
  const close = buildNodeLiveObservationSessionCloseFrameV2(
    observation,
    acknowledgement,
    true,
  );
  const session = parseNodeLiveObservationSessionCandidateV2({
    schema: "setfarm.platform-release-bootstrap-node-live-observation-session.v2",
    version: "2.0.0",
    open,
    observation,
    acknowledgement,
    close,
  });
  return { session, semanticSnapshot } as const;
}

function makeAcceptedSession(
  sessionOccurrenceHash = hash("a"),
): PlatformReleaseBootstrapNodeLiveObservationSessionV2 {
  return makeAcceptedFixture(sessionOccurrenceHash).session;
}

function rehashOpen(
  frame: Record<string, unknown>,
): void {
  frame.frameHash = hashNodeLiveObservationSessionOpenFrameV2(frame);
  frame.transcriptHash = rollNodeLiveObservationTranscriptHashV2({
    sessionOccurrenceHash: frame.sessionOccurrenceHash as string,
    priorTranscriptHash: frame.priorTranscriptHash as string,
    sequence: frame.sequence as 0,
    frameHash: frame.frameHash as string,
  });
}

function rehashObservation(
  frame: Record<string, unknown>,
): void {
  frame.frameHash = hashNodeLiveObservationFrameV2(frame);
  frame.transcriptHash = rollNodeLiveObservationTranscriptHashV2({
    sessionOccurrenceHash: frame.sessionOccurrenceHash as string,
    priorTranscriptHash: frame.priorTranscriptHash as string,
    sequence: frame.sequence as 1,
    frameHash: frame.frameHash as string,
  });
}

function rehashAck(frame: Record<string, unknown>): void {
  frame.frameHash = hashNodeLiveObservationAckFrameV2(frame);
  frame.transcriptHash = rollNodeLiveObservationTranscriptHashV2({
    sessionOccurrenceHash: frame.sessionOccurrenceHash as string,
    priorTranscriptHash: frame.priorTranscriptHash as string,
    sequence: frame.sequence as 2,
    frameHash: frame.frameHash as string,
  });
}

function rehashClose(frame: Record<string, unknown>): void {
  frame.frameHash = hashNodeLiveObservationSessionCloseFrameV2(frame);
  frame.finalTranscriptHash = rollNodeLiveObservationTranscriptHashV2({
    sessionOccurrenceHash: frame.sessionOccurrenceHash as string,
    priorTranscriptHash: frame.priorTranscriptHash as string,
    sequence: frame.sequence as 3,
    frameHash: frame.frameHash as string,
  });
}

describe("platform release bootstrap Node live observation session contract v2", () => {
  it("builds one frozen four-frame read-only transcript and one exact incompleteness catalog", () => {
    const fixture = makeAcceptedFixture();
    const { session, semanticSnapshot } = fixture;
    assert.equal(Object.isFrozen(session), true);
    assert.equal(Object.isFrozen(session.open.heldLocks), true);
    assert.deepEqual(
      [
        session.open.sequence,
        session.observation.sequence,
        session.acknowledgement.sequence,
        session.close.sequence,
      ],
      [0, 1, 2, 3],
    );
    assert.equal(session.open.productionAuthority, false);
    assert.equal(session.open.operationMode, "read_only_observation");
    assert.deepEqual(session.open.ownershipBoundary, {
      ownerUid: 501,
      ownerGid: 20,
      parentMode: "0755",
      lockMode: "0600",
      lockLinkCount: 1,
    });
    assert.equal(
      session.open.heldLocks[0].contentHash,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_HASH_V2,
    );
    assert.equal(
      session.open.heldLocks[1].contentHash,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_HASH_V2,
    );
    assert.equal(session.acknowledgement.disposition, "accept_read_only");
    if (session.acknowledgement.disposition === "accept_read_only") {
      assert.equal(
        session.acknowledgement.semanticSnapshotHash,
        semanticSnapshot.snapshotHash,
      );
      assert.equal(
        session.acknowledgement.semanticVerifierContractHash,
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
      );
      assert.equal(
        session.acknowledgement.semanticAcceptanceAuthority,
        "unverified_until_explicit_snapshot_join_v2",
      );
      assert.equal(
        session.acknowledgement.semanticStatus,
        "empty_or_rolled_back",
      );
    }
    assert.equal(session.close.nativeRecaptureEqual, true);
    assert.equal(session.close.released, true);
    assert.equal(session.close.terminal, true);
    assert.equal(
      session.close.standaloneAuthority,
      "declarative_terminal_frame_not_native_receipt_v2",
    );
    assert.deepEqual(
      session.close.releaseOrder,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_RELEASE_ORDER_V2,
    );
    assert.equal(
      session.close.finalTranscriptHash,
      rollNodeLiveObservationTranscriptHashV2({
        sessionOccurrenceHash: session.close.sessionOccurrenceHash,
        priorTranscriptHash: session.close.priorTranscriptHash,
        sequence: 3,
        frameHash: session.close.frameHash,
      }),
    );
    assert.deepEqual(
      parseNodeLiveObservationSessionOpenFrameCandidateV2(session.open),
      session.open,
    );
    assert.deepEqual(
      parseNodeLiveObservationFrameCandidateV2(session.observation),
      session.observation,
    );
    assert.deepEqual(
      parseNodeLiveObservationAckFrameCandidateV2(session.acknowledgement),
      session.acknowledgement,
    );
    assert.deepEqual(
      parseNodeLiveObservationSessionCloseFrameCandidateV2(session.close),
      session.close,
    );

    const catalog = parseNodeLiveObservationIncompletenessCandidateV2(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_INCOMPLETENESS_V2,
    );
    assert.equal(catalog.frameCount, PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_FRAME_COUNT_V2);
    assert.equal(catalog.productionAuthority, false);
    assert.deepEqual(catalog.blockers, [
      "unsigned_test_fixture",
      "native_live_session_driver_absent",
      "mutation_surface_intentionally_absent",
      "production_backend_capability_absent",
      "semantic_snapshot_join_required",
      "native_recapture_proof_absent",
      "native_release_proof_absent",
    ]);
  });

  it("rejects rehashed lock-boundary drift", () => {
    const { session } = makeAcceptedFixture();
    const wrongContent = structuredClone(session.open) as unknown as Record<string, unknown> & {
      heldLocks: Array<{ contentHash: string }>;
    };
    wrongContent.heldLocks[0]!.contentHash = hash("8");
    (wrongContent.heldLocks[0] as unknown as Record<string, unknown>)
      .captureBindingHash = hashNodeLiveObservationHeldLockCaptureBindingV2(
        wrongContent.heldLocks[0] as unknown as Record<string, unknown>,
      );
    rehashOpen(wrongContent);
    assert.throws(() =>
      parseNodeLiveObservationSessionOpenFrameCandidateV2(wrongContent));

    const wrongOwnerBoundary = structuredClone(session.open) as unknown as Record<string, unknown> & {
      ownershipBoundary: { ownerUid: number };
    };
    wrongOwnerBoundary.ownershipBoundary.ownerUid = 502;
    rehashOpen(wrongOwnerBoundary);
    assert.throws(() =>
      parseNodeLiveObservationSessionOpenFrameCandidateV2(wrongOwnerBoundary));

    const wrongGlobalBinding = structuredClone(session) as unknown as {
      observation: Record<string, unknown> & {
        globalPhysicalCensusLockBindings: {
          sharedParentLockCaptureBindingHash: string;
        };
      };
    };
    wrongGlobalBinding.observation.globalPhysicalCensusLockBindings
      .sharedParentLockCaptureBindingHash = hash("8");
    rehashObservation(wrongGlobalBinding.observation);
    assert.doesNotThrow(() =>
      parseNodeLiveObservationFrameCandidateV2(wrongGlobalBinding.observation));
    assert.throws(() =>
      parseNodeLiveObservationSessionCandidateV2(wrongGlobalBinding));

  });

  it("keeps transcript parsing nonauthoritative and requires an exact semantic snapshot join", () => {
    const fixture = makeAcceptedFixture();
    const { session, semanticSnapshot } = fixture;
    const joined = joinNodeLiveObservationSessionToSemanticSnapshotV2(
      session,
      semanticSnapshot,
    );
    assert.equal(joined.semanticSnapshotHash, semanticSnapshot.snapshotHash);
    assert.equal(
      joined.semanticAcceptanceAuthority,
      "self_asserted_requires_explicit_rejoin_v2",
    );
    assert.equal(joined.productionAuthority, false);
    assert.equal(
      verifyNodeLiveObservationSemanticJoinReceiptV2(
        joined,
        session,
        semanticSnapshot,
      ),
      true,
    );

    const syntheticReceipt = structuredClone(joined) as unknown as Record<
      string,
      unknown
    >;
    syntheticReceipt.sessionOccurrenceHash = hash("2");
    syntheticReceipt.joinHash =
      hashNodeLiveObservationSemanticJoinReceiptV2(syntheticReceipt);
    const parsedSynthetic =
      parseNodeLiveObservationSemanticJoinReceiptCandidateV2(
        syntheticReceipt,
      );
    assert.equal(
      parsedSynthetic.semanticAcceptanceAuthority,
      "self_asserted_requires_explicit_rejoin_v2",
    );
    assert.throws(() => verifyNodeLiveObservationSemanticJoinReceiptV2(
      parsedSynthetic,
      session,
      semanticSnapshot,
    ));

    const mutatedReceipt = structuredClone(joined) as unknown as Record<
      string,
      unknown
    >;
    mutatedReceipt.finalTranscriptHash = hash("3");
    mutatedReceipt.joinHash =
      hashNodeLiveObservationSemanticJoinReceiptV2(mutatedReceipt);
    assert.doesNotThrow(() =>
      parseNodeLiveObservationSemanticJoinReceiptCandidateV2(mutatedReceipt));
    assert.throws(() => verifyNodeLiveObservationSemanticJoinReceiptV2(
      mutatedReceipt,
      session,
      semanticSnapshot,
    ));

    assert.throws(() => buildNodeLiveObservationAckFrameV2(
      session.observation,
      {
        disposition: "accept_read_only",
        semanticSnapshotHash: hash("2"),
        semanticVerifierContractHash:
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
        semanticStatus: "empty_or_rolled_back",
      } as never,
    ));

    const missingSemantic = structuredClone(
      session.acknowledgement,
    ) as unknown as Record<string, unknown>;
    delete missingSemantic.semanticSnapshotHash;
    rehashAck(missingSemantic);
    assert.throws(() =>
      parseNodeLiveObservationAckFrameCandidateV2(missingSemantic));

    const forgedAckCandidate = structuredClone(
      session.acknowledgement,
    ) as unknown as Record<string, unknown>;
    forgedAckCandidate.semanticSnapshotHash = hash("2");
    rehashAck(forgedAckCandidate);
    const forgedAck = parseNodeLiveObservationAckFrameCandidateV2(
      forgedAckCandidate,
    );
    const forgedClose = buildNodeLiveObservationSessionCloseFrameV2(
      session.observation,
      forgedAck,
      true,
    );
    const forgedSession = parseNodeLiveObservationSessionCandidateV2({
      ...session,
      acknowledgement: forgedAck,
      close: forgedClose,
    });
    assert.throws(() =>
      joinNodeLiveObservationSessionToSemanticSnapshotV2(
        forgedSession,
        semanticSnapshot,
      ));

    const foreign = makeAcceptedFixture(hash("9"));
    const foreignAck = buildNodeLiveObservationAckFrameV2(
      session.observation,
      {
        disposition: "accept_read_only",
        semanticSnapshot: foreign.semanticSnapshot,
      },
    );
    const foreignClose = buildNodeLiveObservationSessionCloseFrameV2(
      session.observation,
      foreignAck,
      true,
    );
    const foreignDto = parseNodeLiveObservationSessionCandidateV2({
      ...session,
      acknowledgement: foreignAck,
      close: foreignClose,
    });
    assert.throws(() =>
      joinNodeLiveObservationSessionToSemanticSnapshotV2(
        foreignDto,
        foreign.semanticSnapshot,
      ));

    const parentTransplant = makeAcceptedFixture(hash("8"), true);
    assert.doesNotThrow(() =>
      parseNodeLiveObservationSessionCandidateV2(parentTransplant.session));
    assert.throws(() =>
      joinNodeLiveObservationSessionToSemanticSnapshotV2(
        parentTransplant.session,
        parentTransplant.semanticSnapshot,
      ));
  });

  it("rejects rehashed sequence reorder, session splice, and transcript splice", () => {
    const session = makeAcceptedSession();
    const reordered = structuredClone(session) as unknown as {
      open: Record<string, unknown>;
    };
    reordered.open.sequence = 1;
    rehashOpen(reordered.open);
    assert.throws(() =>
      parseNodeLiveObservationSessionCandidateV2(reordered));

    const other = makeAcceptedSession(hash("9"));
    assert.throws(() => buildNodeLiveObservationSessionCloseFrameV2(
      session.observation,
      other.acknowledgement,
      true,
    ));
    const spliced = structuredClone(session) as unknown as {
      observation: PlatformReleaseBootstrapNodeLiveObservationFrameV2;
    };
    spliced.observation = other.observation;
    assert.throws(() =>
      parseNodeLiveObservationSessionCandidateV2(spliced));

    const transcriptSpliced = structuredClone(session) as unknown as {
      observation: Record<string, unknown>;
    };
    transcriptSpliced.observation.priorTranscriptHash = hash("8");
    rehashObservation(transcriptSpliced.observation);
    assert.doesNotThrow(() =>
      parseNodeLiveObservationFrameCandidateV2(
        transcriptSpliced.observation,
      ));
    assert.throws(() =>
      parseNodeLiveObservationSessionCandidateV2(transcriptSpliced));
  });

  it("rejects rehashed accept without recapture and wrong release order, while terminal abort remains exact", () => {
    const session = makeAcceptedSession();
    const noRecapture = structuredClone(session) as unknown as {
      close: Record<string, unknown>;
    };
    noRecapture.close.nativeRecaptureEqual = false;
    rehashClose(noRecapture.close);
    assert.throws(() =>
      parseNodeLiveObservationSessionCandidateV2(noRecapture));

    const wrongRelease = structuredClone(session) as unknown as {
      close: Record<string, unknown>;
    };
    wrongRelease.close.releaseOrder = [
      "shared_registry_parent_lock",
      "registered_node_package_lock",
    ];
    rehashClose(wrongRelease.close);
    assert.throws(() =>
      parseNodeLiveObservationSessionCandidateV2(wrongRelease));

    const observation = session.observation;
    const acknowledgement = buildNodeLiveObservationAckFrameV2(observation, {
      disposition: "abort",
      abortReason: "semantic_rejection",
    });
    const close = buildNodeLiveObservationSessionCloseFrameV2(
      observation,
      acknowledgement,
      false,
    );
    assert.equal(close.outcome, "aborted");
    assert.equal(close.nativeRecaptureEqual, false);
    const abortWithSemanticFields = structuredClone(
      acknowledgement,
    ) as unknown as Record<string, unknown>;
    abortWithSemanticFields.semanticSnapshotHash = hash("6");
    abortWithSemanticFields.semanticVerifierContractHash = hash("7");
    abortWithSemanticFields.semanticStatus = "ready";
    rehashAck(abortWithSemanticFields);
    assert.throws(() =>
      parseNodeLiveObservationAckFrameCandidateV2(abortWithSemanticFields));
    assert.doesNotThrow(() => parseNodeLiveObservationSessionCandidateV2({
      schema: "setfarm.platform-release-bootstrap-node-live-observation-session.v2",
      version: "2.0.0",
      open: session.open,
      observation,
      acknowledgement,
      close,
    }));

    const abortWithRecapture = structuredClone(close) as unknown as Record<string, unknown>;
    abortWithRecapture.nativeRecaptureEqual = true;
    rehashClose(abortWithRecapture);
    assert.throws(() =>
      parseNodeLiveObservationSessionCloseFrameCandidateV2(abortWithRecapture));
  });

  it("has no generic mutation, path, descriptor, byte, payload, or callback input surface", () => {
    const session = makeAcceptedSession();
    for (const [field, value] of [
      ["mutation", "unlink"],
      ["path", "/tmp/escape"],
      ["fd", 9],
      ["bytes", "payload"],
      ["payload", { arbitrary: true }],
      ["callback", "invoke"],
    ] as const) {
      const acknowledgement = structuredClone(
        session.acknowledgement,
      ) as unknown as Record<string, unknown>;
      acknowledgement[field] = value;
      rehashAck(acknowledgement);
      assert.throws(() =>
        parseNodeLiveObservationAckFrameCandidateV2(acknowledgement),
        field,
      );
    }
  });

  it("rejects proxies, accessors without invocation, and fixed entry/byte cap violations", () => {
    const session = makeAcceptedSession();
    assert.throws(() =>
      parseNodeLiveObservationSessionCandidateV2(
        new Proxy(structuredClone(session), {}),
      ));

    let accessorInvocations = 0;
    const accessor = structuredClone(session) as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "hiddenMutation", {
      enumerable: true,
      get() {
        accessorInvocations += 1;
        return "never";
      },
    });
    assert.throws(() => parseNodeLiveObservationSessionCandidateV2(accessor));
    assert.equal(accessorInvocations, 0);

    const overEntries = structuredClone(session.observation) as unknown as {
      nodeRecursiveEvidence: { entryCount: number };
    } & Record<string, unknown>;
    overEntries.nodeRecursiveEvidence.entryCount =
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_RECURSIVE_ENTRIES_V2 + 1;
    rehashObservation(overEntries);
    assert.throws(() =>
      parseNodeLiveObservationFrameCandidateV2(overEntries));

    const oversized = structuredClone(session.observation) as unknown as Record<string, unknown>;
    oversized.padding = "x".repeat(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
    );
    assert.throws(() =>
      parseNodeLiveObservationFrameCandidateV2(oversized));
  });

  it("stays absent from production authority and mutation modules", async () => {
    const sources = await Promise.all([
      "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.ts",
      "../../src/product-compiler/node-toolchain-provisioner-bootstrap-installation-v2.ts",
      "../../src/execution/platform-release-bootstrap-darwin-filesystem-backend-authority-v2.ts",
    ].map((relativePath) =>
      readFile(new URL(relativePath, import.meta.url), "utf8")));
    const forbiddenImport =
      /platform-release-bootstrap-node-live-observation-session-contract-v2/;
    for (const source of sources) assert.doesNotMatch(source, forbiddenImport);
  });
});
