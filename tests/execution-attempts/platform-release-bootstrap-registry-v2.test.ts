import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2 } from "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_SIGNATURE_ADMISSION_V2,
  PlatformReleaseBootstrapRegistryActivationClaimV2Schema,
  PlatformReleaseBootstrapRegistryActivationReceiptV2Schema,
  PlatformReleaseBootstrapRegistryEpochClaimV2Schema,
  PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2Schema,
  buildPlatformReleaseBootstrapRegistryActivationClaimV2,
  buildPlatformReleaseBootstrapRegistryActivationReceiptV2,
  buildPlatformReleaseBootstrapRegistryEpochClaimV2,
  buildPlatformReleaseBootstrapRegistryEpochFloorStateV2,
  buildPlatformReleaseBootstrapRegistryGenesisEpochFloorStateV2,
  buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningIdentityV2,
  buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2,
  buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2,
  canonicalizePlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2,
  hashPlatformReleaseBootstrapRegistryActivationClaimV2,
  hashPlatformReleaseBootstrapRegistryActivationReceiptV2,
  hashPlatformReleaseBootstrapRegistryEpochClaimV2,
  hashPlatformReleaseBootstrapRegistryEpochFloorStateV2,
  hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2,
  hashPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2,
  parsePlatformReleaseBootstrapRegistryActivationClaimCandidateV2,
  parsePlatformReleaseBootstrapRegistryActivationReceiptCandidateV2,
  parsePlatformReleaseBootstrapRegistryEpochClaimCandidateV2,
  parsePlatformReleaseBootstrapRegistryEpochFloorStateCandidateV2,
  parsePlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-registry-state-v2.js";
import {
  PlatformReleaseBootstrapNamespaceCensusV2Schema,
  PlatformReleaseBootstrapNamespaceClassificationErrorV2,
  PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  classifyPlatformReleaseBootstrapNamespaceBasenameV2,
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
  hashPlatformReleaseBootstrapNamespaceCensusV2,
  hashPlatformReleaseBootstrapNamespaceClassificationV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";

const hash = (character: string): string => character.repeat(64);
const signature = (byte: number): string =>
  Buffer.alloc(64, byte).toString("base64");

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

function rollbackSample(patternSource: string, character = "a"): string {
  return patternSource
    .slice(1, -1)
    .replaceAll("\\.", ".")
    .replace("[a-f0-9]{64}", character.repeat(64));
}

function exactPackageEpochMap() {
  return mutableClone(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.packageEpochArtifactMap,
  );
}

function epochStageBinding(
  targetEpochState: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
  transactionStagingIdentityHash = hash("7"),
  stagedTargetEpochStatePhysicalIdentityHash = hash("8"),
) {
  return {
    transactionStagingIdentityHash,
    transactionStagingCensusHash:
      hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2([
        {
          memberKind: "staged_target_epoch_state",
          logicalIdentityHash: targetEpochState.epochStateHash,
          physicalIdentityHash: stagedTargetEpochStatePhysicalIdentityHash,
        },
      ]),
    stagedTargetEpochStatePhysicalIdentityHash,
  };
}

describe("platform release bootstrap registry v2", () => {
  it("publishes one exact frozen genesis state without an activation hash cycle", () => {
    const genesis =
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2;
    assert.deepEqual(
      genesis,
      buildPlatformReleaseBootstrapRegistryGenesisEpochFloorStateV2(),
    );
    assert.equal(
      PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema.safeParse(genesis)
        .success,
      true,
    );
    assert.equal(
      genesis.epochStateHash,
      hashPlatformReleaseBootstrapRegistryEpochFloorStateV2(genesis),
    );
    assert.equal(genesis.generation, 0);
    assert.equal(genesis.priorEpochStateHash, null);
    assert.equal(genesis.transactionIdentityHash, null);
    assert.deepEqual(
      Object.keys(genesis.packageEpochArtifactMap).sort(),
      Object.values(PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2).sort(),
    );
    assert.equal(
      Object.values(genesis.packageEpochArtifactMap).every(
        (entry) => entry.distributionEpoch === 0 && entry.artifactHash === null,
      ),
      true,
    );
    assert.ok(Object.isFrozen(genesis));
    assert.ok(Object.isFrozen(genesis.packageEpochArtifactMap));
    assert.ok(
      Object.values(genesis.packageEpochArtifactMap).every((entry) =>
        Object.isFrozen(entry),
      ),
    );
  });

  it("binds activation only to the exact genesis and distinct cutover identities", () => {
    const activation = buildPlatformReleaseBootstrapRegistryActivationReceiptV2(
      {
        sharedLockIdentityHash: hash("1"),
        legacyNodeLockIdentityHash: hash("2"),
        nodeLifecycleIdentityHash: hash("3"),
        parentIdentityHash: hash("4"),
      },
    );
    assert.equal(
      PlatformReleaseBootstrapRegistryActivationReceiptV2Schema.safeParse(
        activation,
      ).success,
      true,
    );
    assert.equal(
      activation.activationReceiptHash,
      hashPlatformReleaseBootstrapRegistryActivationReceiptV2(activation),
    );
    assert.ok(Object.isFrozen(activation));
    const foreignGenesis = mutableClone(activation);
    foreignGenesis.genesisEpochStateHash = hash("5");
    foreignGenesis.activationReceiptHash =
      hashPlatformReleaseBootstrapRegistryActivationReceiptV2(foreignGenesis);
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationReceiptCandidateV2(
        foreignGenesis,
      ),
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
        sharedLockIdentityHash: hash("1"),
        legacyNodeLockIdentityHash: hash("1"),
        nodeLifecycleIdentityHash: hash("3"),
        parentIdentityHash: hash("4"),
      }),
    );

    const tampered = mutableClone(activation);
    tampered.parentIdentityHash = hash("6");
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationReceiptCandidateV2(
        tampered,
      ),
    );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationReceiptCandidateV2({
        ...activation,
        unexpected: true,
      }),
    );
  });

  it("binds one crash-safe activation claim to its deterministic expected receipt", () => {
    const input = {
      transactionIdentityHash: hash("5"),
      sharedLockIdentityHash: hash("1"),
      legacyNodeLockIdentityHash: hash("2"),
      nodeLifecycleIdentityHash: hash("3"),
      parentIdentityHash: hash("4"),
      nodeLifecycleSnapshotHash: hash("6"),
      preActivationNamespaceCaptureHash: hash("7"),
      transactionStagingIdentityHash: hash("8"),
      transactionStagingCensusHash: hash("9"),
    };
    const claim = buildPlatformReleaseBootstrapRegistryActivationClaimV2(input);
    const receipt = buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
      sharedLockIdentityHash: input.sharedLockIdentityHash,
      legacyNodeLockIdentityHash: input.legacyNodeLockIdentityHash,
      nodeLifecycleIdentityHash: input.nodeLifecycleIdentityHash,
      parentIdentityHash: input.parentIdentityHash,
    });
    assert.equal(
      PlatformReleaseBootstrapRegistryActivationClaimV2Schema.safeParse(claim)
        .success,
      true,
    );
    assert.equal(
      claim.expectedActivationReceiptHash,
      receipt.activationReceiptHash,
    );
    assert.equal(claim.genesisEpochStateHash, receipt.genesisEpochStateHash);
    assert.equal(
      claim.activationClaimHash,
      hashPlatformReleaseBootstrapRegistryActivationClaimV2(claim),
    );
    assert.deepEqual(
      claim,
      buildPlatformReleaseBootstrapRegistryActivationClaimV2(input),
    );
    assert.ok(Object.isFrozen(claim));

    const foreignReceipt = mutableClone(claim);
    foreignReceipt.expectedActivationReceiptHash = hash("6");
    foreignReceipt.activationClaimHash =
      hashPlatformReleaseBootstrapRegistryActivationClaimV2(foreignReceipt);
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationClaimCandidateV2(
        foreignReceipt,
      ),
    );

    const foreignMigrator = mutableClone(claim);
    foreignMigrator.migratorProtocolHash = hash("7");
    foreignMigrator.activationClaimHash =
      hashPlatformReleaseBootstrapRegistryActivationClaimV2(foreignMigrator);
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationClaimCandidateV2(
        foreignMigrator,
      ),
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryActivationClaimV2({
        ...input,
        transactionIdentityHash: input.sharedLockIdentityHash,
      }),
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryActivationClaimV2({
        ...input,
        transactionIdentityHash: claim.migratorProtocolHash,
      }),
    );
    for (const aliasedEvidenceHash of [
      claim.nodeLifecycleSnapshotHash,
      claim.preActivationNamespaceCaptureHash,
      claim.transactionStagingIdentityHash,
      claim.transactionStagingCensusHash,
    ]) {
      assert.throws(() =>
        buildPlatformReleaseBootstrapRegistryActivationClaimV2({
          ...input,
          transactionIdentityHash: aliasedEvidenceHash,
        }),
      );
    }

    const aliasedExpectedReceipt = mutableClone(claim);
    aliasedExpectedReceipt.transactionIdentityHash =
      aliasedExpectedReceipt.expectedActivationReceiptHash;
    aliasedExpectedReceipt.activationClaimHash =
      hashPlatformReleaseBootstrapRegistryActivationClaimV2(
        aliasedExpectedReceipt,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationClaimCandidateV2(
        aliasedExpectedReceipt,
      ),
    );
  });

  it("enforces genesis, later-state, and exact four-package epoch relations", () => {
    const nextMap = exactPackageEpochMap();
    nextMap[
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
    ] = {
      distributionEpoch: 1,
      artifactHash: hash("a"),
    };
    const next = buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
      generation: 1,
      priorEpochStateHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
      transactionIdentityHash: hash("b"),
      packageEpochArtifactMap: nextMap,
    });
    assert.equal(
      next.epochStateHash,
      hashPlatformReleaseBootstrapRegistryEpochFloorStateV2(next),
    );
    assert.ok(Object.isFrozen(next.packageEpochArtifactMap));

    for (const invalid of [
      {
        generation: 1,
        priorEpochStateHash: null,
        transactionIdentityHash: hash("b"),
        packageEpochArtifactMap: nextMap,
      },
      {
        generation: 1,
        priorEpochStateHash:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
        transactionIdentityHash: null,
        packageEpochArtifactMap: nextMap,
      },
      {
        generation: 1,
        priorEpochStateHash: hash("b"),
        transactionIdentityHash: hash("b"),
        packageEpochArtifactMap: nextMap,
      },
      {
        generation: 0,
        priorEpochStateHash: null,
        transactionIdentityHash: null,
        packageEpochArtifactMap: nextMap,
      },
    ] as const) {
      assert.throws(() =>
        buildPlatformReleaseBootstrapRegistryEpochFloorStateV2(invalid),
      );
    }

    const missingPackage = exactPackageEpochMap() as Record<
      string,
      {
        distributionEpoch: number;
        artifactHash: string | null;
      }
    >;
    delete missingPackage[
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier
    ];
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
        generation: 0,
        priorEpochStateHash: null,
        transactionIdentityHash: null,
        packageEpochArtifactMap: missingPackage as never,
      }),
    );

    const invalidSentinel = exactPackageEpochMap();
    invalidSentinel[PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier] = {
      distributionEpoch: 0,
      artifactHash: hash("c"),
    };
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
        generation: 0,
        priorEpochStateHash: null,
        transactionIdentityHash: null,
        packageEpochArtifactMap: invalidSentinel,
      }),
    );
  });

  it("builds strict claims and rejects identity aliasing or self-hash drift", () => {
    const prior =
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2;
    const targetMap = exactPackageEpochMap();
    targetMap[
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
    ] = {
      distributionEpoch: 1,
      artifactHash: hash("a"),
    };
    const target = buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
      generation: 1,
      priorEpochStateHash: prior.epochStateHash,
      transactionIdentityHash: hash("6"),
      packageEpochArtifactMap: targetMap,
    });
    const claim = buildPlatformReleaseBootstrapRegistryEpochClaimV2({
      transactionIdentityHash: hash("6"),
      priorEpochState: prior,
      targetEpochState: target,
      ...epochStageBinding(target),
      packageRef:
        PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
      packageInstallationGeneration: 0,
      offlineRollbackAuthorizationHash: null,
    });
    assert.equal(
      PlatformReleaseBootstrapRegistryEpochClaimV2Schema.safeParse(claim)
        .success,
      true,
    );
    assert.equal(
      claim.epochClaimHash,
      hashPlatformReleaseBootstrapRegistryEpochClaimV2(claim),
    );
    assert.deepEqual(
      {
        transactionStagingIdentityHash: claim.transactionStagingIdentityHash,
        transactionStagingCensusHash: claim.transactionStagingCensusHash,
        stagedTargetEpochStatePhysicalIdentityHash:
          claim.stagedTargetEpochStatePhysicalIdentityHash,
      },
      epochStageBinding(target),
    );
    assert.ok(Object.isFrozen(claim));
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryEpochClaimV2({
        transactionIdentityHash: hash("6"),
        priorEpochState: prior,
        targetEpochState: target,
        ...epochStageBinding(target, hash("7"), target.epochStateHash),
        packageRef:
          PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
        packageInstallationGeneration: 0,
        offlineRollbackAuthorizationHash: null,
      }),
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryEpochClaimV2({
        transactionIdentityHash: prior.epochStateHash,
        priorEpochState: prior,
        targetEpochState: target,
        ...epochStageBinding(target),
        packageRef:
          PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
        packageInstallationGeneration: 0,
        offlineRollbackAuthorizationHash: null,
      }),
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryEpochClaimV2({
        transactionIdentityHash: hash("6"),
        priorEpochState: prior,
        targetEpochState: target,
        ...epochStageBinding(target),
        packageRef:
          PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
        packageInstallationGeneration: 0,
        offlineRollbackAuthorizationHash: null,
      }),
    );

    const overflowPrior =
      buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
        generation: Number.MAX_SAFE_INTEGER,
        priorEpochStateHash: hash("d"),
        transactionIdentityHash: hash("e"),
        packageEpochArtifactMap: targetMap,
      });
    const overflowTargetMap = mutableClone(targetMap);
    overflowTargetMap[
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
    ] = {
      distributionEpoch: 2,
      artifactHash: hash("b"),
    };
    const overflowTarget =
      buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
        generation: Number.MAX_SAFE_INTEGER,
        priorEpochStateHash: overflowPrior.epochStateHash,
        transactionIdentityHash: hash("f"),
        packageEpochArtifactMap: overflowTargetMap,
      });
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryEpochClaimV2({
        transactionIdentityHash: hash("f"),
        priorEpochState: overflowPrior,
        targetEpochState: overflowTarget,
        ...epochStageBinding(overflowTarget),
        packageRef:
          PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
        packageInstallationGeneration: 0,
        offlineRollbackAuthorizationHash: null,
      }),
    );

    const tampered = mutableClone(claim);
    tampered.packageInstallationGeneration = 1;
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryEpochClaimCandidateV2(tampered),
    );
    const censusTampered = mutableClone(claim);
    censusTampered.transactionStagingCensusHash = hash("9");
    censusTampered.epochClaimHash =
      hashPlatformReleaseBootstrapRegistryEpochClaimV2(censusTampered);
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryEpochClaimCandidateV2(
        censusTampered,
      ),
    );
  });

  it("separates rollback signature shape, signing bytes, and authorization identity", () => {
    const rollbackInput = {
      currentEpochStateHash: hash("9"),
      currentFloorEpoch: 2,
      targetPackageRef:
        PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
      targetArtifactHash: hash("a"),
      targetDistributionEpoch: 1,
      hostPolicyHash: hash("b"),
      expiresAt: "2030-01-02T03:04:05.006Z",
    } as const;
    const unsigned =
      buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningIdentityV2(
        rollbackInput,
      );
    const signingPreimage =
      buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2(
        unsigned,
      );
    const canonicalSigningPreimage =
      canonicalizePlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2(
        unsigned,
      );
    assert.equal(canonicalSigningPreimage.includes("offlineSignature"), false);
    assert.equal(canonicalSigningPreimage.includes("authorizationHash"), false);
    assert.ok(Object.isFrozen(signingPreimage));
    assert.ok(Object.isFrozen(signingPreimage.authorization));

    const first =
      buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2({
        ...rollbackInput,
        offlineSignature: signature(0),
      });
    const second =
      buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2({
        ...rollbackInput,
        offlineSignature: signature(1),
      });
    assert.equal(
      PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2Schema.safeParse(
        first,
      ).success,
      true,
    );
    assert.equal(
      first.authorizationHash,
      hashPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2(first),
    );
    assert.notEqual(first.authorizationHash, second.authorizationHash);
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_SIGNATURE_ADMISSION_V2,
      "shape_only_production_trust_unconfigured",
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningIdentityV2(
        {
          ...rollbackInput,
          targetDistributionEpoch: rollbackInput.currentFloorEpoch,
        },
      ),
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningIdentityV2(
        {
          ...rollbackInput,
          targetDistributionEpoch: 0,
        },
      ),
    );

    for (const invalid of [
      {
        ...rollbackInput,
        currentFloorEpoch: 0,
        offlineSignature: signature(0),
      },
      {
        ...rollbackInput,
        targetDistributionEpoch: 0,
        offlineSignature: signature(0),
      },
      {
        ...rollbackInput,
        targetDistributionEpoch: rollbackInput.currentFloorEpoch,
        offlineSignature: signature(0),
      },
      {
        ...rollbackInput,
        expiresAt: "2030-01-02T03:04:05Z",
        offlineSignature: signature(0),
      },
      {
        ...rollbackInput,
        offlineSignature: Buffer.alloc(63).toString("base64"),
      },
    ]) {
      assert.throws(() =>
        buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2(
          invalid as never,
        ),
      );
    }

    const stale = mutableClone(first);
    stale.targetArtifactHash = hash("c");
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationCandidateV2(
        stale,
      ),
    );
  });

  it("takes bounded strict document snapshots without invoking accessors", () => {
    const genesis = mutableClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
    );
    const parsed =
      parsePlatformReleaseBootstrapRegistryEpochFloorStateCandidateV2(genesis);
    genesis.packageEpochArtifactMap[
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier
    ] = {
      distributionEpoch: 2,
      artifactHash: hash("d"),
    };
    assert.deepEqual(
      parsed,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
    );
    assert.ok(Object.isFrozen(parsed.packageEpochArtifactMap));

    let getterCalls = 0;
    const accessorCandidate = {};
    Object.defineProperty(accessorCandidate, "schema", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "must-not-run";
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryEpochFloorStateCandidateV2(
        accessorCandidate,
      ),
    );
    assert.equal(getterCalls, 0);

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryEpochFloorStateCandidateV2(cycle),
    );
  });

  it("classifies every registry and package lifecycle basename exactly once", () => {
    const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
    const representatives = [
      contract.registry.filesystemScopeBasename,
      contract.registry.sharedLockBasename,
      contract.registry.activationClaimBasename,
      contract.registry.transactionStagingBasename,
      contract.registry.activationReceiptBasename,
      contract.registry.epochFloorBasename,
      contract.registry.epochClaimBasename,
    ];
    for (const packageContract of contract.packages) {
      representatives.push(
        packageContract.rootBasename,
        packageContract.lifecycle.activeReceiptBasename,
        packageContract.lifecycle.activeClaimBasename,
        packageContract.lifecycle.packageLockBasename,
        packageContract.lifecycle.rollbackClaimBasename,
        `${packageContract.lifecycle.stagingPrefix}.${hash("a")}`,
        rollbackSample(packageContract.lifecycle.rollbackReceiptBasenameRegex),
      );
    }
    assert.equal(representatives.length, 35);
    assert.equal(new Set(representatives).size, representatives.length);

    const classifications = representatives.map((basename) =>
      classifyPlatformReleaseBootstrapNamespaceBasenameV2(basename),
    );
    assert.equal(
      classifications.every(
        (entry) =>
          PlatformReleaseBootstrapNamespaceClassificationV2Schema.safeParse(
            entry,
          ).success &&
          entry.classificationHash ===
            hashPlatformReleaseBootstrapNamespaceClassificationV2(entry) &&
          Object.isFrozen(entry),
      ),
      true,
    );
    assert.deepEqual(
      classifications.slice(0, 7).map((entry) => entry.ownerKind),
      [
        "registry",
        "registry",
        "registry",
        "registry",
        "registry",
        "registry",
        "registry",
      ],
    );
    assert.deepEqual(
      classifications.slice(0, 7).map((entry) => entry.category),
      [
        "filesystem_scope",
        "shared_parent_lock",
        "activation_claim",
        "transaction_staging",
        "activation_receipt",
        "epoch_floor_state",
        "epoch_claim",
      ],
    );

    for (const packageContract of contract.packages) {
      const owned = classifications.filter(
        (entry) =>
          entry.ownerKind === "package" &&
          entry.ownerRef === packageContract.packageRef,
      );
      assert.deepEqual(owned.map((entry) => entry.category).sort(), [
        "active_claim",
        "active_receipt",
        "generation_staging",
        "package_lock",
        "package_root",
        "rollback_claim",
        "rollback_receipt",
      ]);
    }
  });

  it("builds one deterministic frozen Node census and fails closed on foreign state", () => {
    const node = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
      (entry) =>
        entry.packageRef ===
        PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
    )!;
    const nodeNames = [
      node.rootBasename,
      node.lifecycle.activeReceiptBasename,
      node.lifecycle.activeClaimBasename,
      node.lifecycle.packageLockBasename,
      node.lifecycle.rollbackClaimBasename,
      `${node.lifecycle.stagingPrefix}.${hash("e")}`,
      rollbackSample(node.lifecycle.rollbackReceiptBasenameRegex, "e"),
    ];
    const forward =
      classifyPlatformReleaseBootstrapNamespaceCensusV2(nodeNames);
    const reverse = classifyPlatformReleaseBootstrapNamespaceCensusV2(
      [...nodeNames].reverse(),
    );
    assert.deepEqual(forward, reverse);
    assert.equal(
      forward.censusHash,
      hashPlatformReleaseBootstrapNamespaceCensusV2(forward),
    );
    assert.equal(
      PlatformReleaseBootstrapNamespaceCensusV2Schema.safeParse(forward)
        .success,
      true,
    );
    assert.equal(
      forward.orderedEntries.every(
        (entry) =>
          entry.ownerKind === "package" && entry.ownerRef === node.packageRef,
      ),
      true,
    );
    assert.ok(Object.isFrozen(forward));
    assert.ok(Object.isFrozen(forward.orderedEntries));
    assert.ok(forward.orderedEntries.every((entry) => Object.isFrozen(entry)));

    for (const candidate of [
      node.lifecycle.stagingPrefix,
      `${node.lifecycle.stagingPrefix}.${hash("A")}`,
      `${node.lifecycle.stagingPrefix}.${"a".repeat(63)}`,
      "foreign-bootstrap-state",
    ]) {
      assert.throws(
        () => classifyPlatformReleaseBootstrapNamespaceBasenameV2(candidate),
        (error) =>
          error instanceof
            PlatformReleaseBootstrapNamespaceClassificationErrorV2 &&
          error.code ===
            "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_UNKNOWN_BASENAME",
      );
    }
    assert.throws(
      () => classifyPlatformReleaseBootstrapNamespaceBasenameV2("nested/entry"),
      (error) =>
        error instanceof
          PlatformReleaseBootstrapNamespaceClassificationErrorV2 &&
        error.code ===
          "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_MALFORMED_BASENAME",
    );
    assert.throws(
      () =>
        classifyPlatformReleaseBootstrapNamespaceCensusV2([
          node.rootBasename,
          node.rootBasename,
        ]),
      (error) =>
        error instanceof
          PlatformReleaseBootstrapNamespaceClassificationErrorV2 &&
        error.code ===
          "PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_V2_DUPLICATE_BASENAME",
    );

    const tampered = mutableClone(forward);
    tampered.orderedEntries.reverse();
    tampered.censusHash =
      hashPlatformReleaseBootstrapNamespaceCensusV2(tampered);
    assert.equal(
      PlatformReleaseBootstrapNamespaceCensusV2Schema.safeParse(tampered)
        .success,
      false,
    );
  });
});
