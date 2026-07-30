import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
  buildPlatformReleaseBootstrapRegistryActivationReceiptV2,
  buildPlatformReleaseBootstrapRegistryEpochClaimV2,
  buildPlatformReleaseBootstrapRegistryEpochFloorStateV2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-registry-state-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
  PlatformReleaseBootstrapRegistryActivationPlanV2Schema,
  PlatformReleaseBootstrapRegistryProductionActivationErrorV2,
  activatePlatformReleaseBootstrapRegistryProductionV2,
  buildPlatformReleaseBootstrapRegistryActivationObservationV2,
  buildPlatformReleaseBootstrapRegistryActivationPlanV2,
  hashPlatformReleaseBootstrapRegistryActivationPlanV2,
  parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2,
  parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2,
  type PlatformReleaseBootstrapRegistryActivationObservationInputV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import {
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
  type PlatformReleaseBootstrapNamespaceCensusV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";

const hash = (character: string): string => character.repeat(64);
const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
const nodePackage = contract.packages.find((entry) =>
  entry.packageRef
    === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
      .nodeToolchainProvisioner)!;

const LEGACY_LOCK_IDENTITY = hash("1");
const PARENT_IDENTITY = hash("2");
const SHARED_LOCK_IDENTITY = hash("3");

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

function exactNamespace(
  names: readonly string[],
): Extract<
  PlatformReleaseBootstrapRegistryActivationObservationInputV2["namespace"],
  { status: "exact" }
> {
  const census =
    classifyPlatformReleaseBootstrapNamespaceCensusV2(names);
  const nonNodeSiblingPackageRefs = [
    ...new Set(
      census.orderedEntries.flatMap((entry) =>
        entry.ownerKind === "package"
          && entry.ownerRef !== nodePackage.packageRef
          ? [entry.ownerRef]
          : []),
    ),
  ].sort();
  return {
    status: "exact",
    census,
    nonNodeSiblingPackageRefs,
  } as Extract<
    PlatformReleaseBootstrapRegistryActivationObservationInputV2["namespace"],
    { status: "exact" }
  >;
}

function emptyNodeNames(): string[] {
  return [nodePackage.lifecycle.packageLockBasename];
}

function readyNodeNames(): string[] {
  return [
    nodePackage.rootBasename,
    nodePackage.lifecycle.activeReceiptBasename,
    nodePackage.lifecycle.activeClaimBasename,
    nodePackage.lifecycle.packageLockBasename,
  ];
}

function baseInput(
  names = emptyNodeNames(),
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  return {
    legacyLock: {
      status: "exact",
      legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
    },
    sharedLock: { status: "absent" },
    parentBoundary: {
      status: "exact",
      parentIdentityHash: PARENT_IDENTITY,
    },
    nodeLifecycle: {
      status: "empty_or_rolled_back",
      nodeLifecycleIdentityHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
    },
    namespace: exactNamespace(names),
    epochFloor: { status: "absent" },
    activationReceipt: { status: "absent" },
    epochClaim: { status: "absent" },
  };
}

function withSharedLock(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  const names = input.namespace.status === "exact"
    ? input.namespace.census.orderedEntries.map((entry) => entry.basename)
    : emptyNodeNames();
  return {
    ...input,
    sharedLock: {
      status: "exact",
      sharedLockIdentityHash: SHARED_LOCK_IDENTITY,
    },
    namespace: exactNamespace([
      ...names,
      contract.registry.sharedLockBasename,
    ]),
  };
}

function withGenesis(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.equal(input.namespace.status, "exact");
  return {
    ...input,
    namespace: exactNamespace([
      ...input.namespace.census.orderedEntries.map((entry) =>
        entry.basename),
      contract.registry.epochFloorBasename,
    ]),
    epochFloor: {
      status: "exact",
      state:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
    },
  };
}

function expectedActivationReceipt() {
  return buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
    sharedLockIdentityHash: SHARED_LOCK_IDENTITY,
    legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
    nodeLifecycleIdentityHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
    parentIdentityHash: PARENT_IDENTITY,
  });
}

function withActivation(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.equal(input.namespace.status, "exact");
  return {
    ...input,
    namespace: exactNamespace([
      ...input.namespace.census.orderedEntries.map((entry) =>
        entry.basename),
      contract.registry.activationReceiptBasename,
    ]),
    activationReceipt: {
      status: "exact",
      receipt: expectedActivationReceipt(),
    },
  };
}

function plan(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
) {
  return buildPlatformReleaseBootstrapRegistryActivationPlanV2(
    buildPlatformReleaseBootstrapRegistryActivationObservationV2(
      input,
    ),
  );
}

function laterFloor() {
  const packageEpochArtifactMap = mutableClone(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2
      .packageEpochArtifactMap,
  );
  packageEpochArtifactMap[
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier
  ] = {
    distributionEpoch: 1,
    artifactHash: hash("a"),
  };
  return buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
    generation: 1,
    priorEpochStateHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2
        .epochStateHash,
    transactionIdentityHash: hash("b"),
    packageEpochArtifactMap,
  });
}

describe("platform release bootstrap registry activation v2", () => {
  it("reduces the exact crash-resumable activation sequence and lock orders", () => {
    const legacy = baseInput();
    const legacyPlan = plan(legacy);
    assert.equal(legacyPlan.state, "LEGACY_ONLY");
    assert.equal(
      legacyPlan.nextAction,
      "publish_and_acquire_shared_lock",
    );
    assert.deepEqual(legacyPlan.requiredLockOrder, [
      "legacy_node_package_lock",
      "shared_parent_lock",
    ]);
    assert.equal(legacyPlan.expectedActivationReceipt, null);

    const shared = withSharedLock(legacy);
    const sharedPlan = plan(shared);
    assert.equal(sharedPlan.state, "SHARED_LOCK_PUBLISHED");
    assert.equal(
      sharedPlan.nextAction,
      "publish_genesis_epoch_floor",
    );
    assert.deepEqual(
      sharedPlan.expectedActivationReceipt,
      expectedActivationReceipt(),
    );

    const genesis = withGenesis(shared);
    const genesisPlan = plan(genesis);
    assert.equal(genesisPlan.state, "GENESIS_PUBLISHED");
    assert.equal(
      genesisPlan.nextAction,
      "publish_activation_receipt",
    );
    assert.deepEqual(
      genesisPlan.genesisEpochFloorState,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
    );

    const activated = withActivation(genesis);
    const activatedPlan = plan(activated);
    assert.equal(activatedPlan.state, "ACTIVATED");
    assert.equal(activatedPlan.nextAction, "return_activated");
    assert.equal(activatedPlan.epochClaimDisposition, "absent");
    assert.deepEqual(activatedPlan.requiredLockOrder, [
      "shared_parent_lock",
      "package_lock",
    ]);
    assert.ok(Object.isFrozen(activatedPlan));
    assert.ok(Object.isFrozen(activatedPlan.observation));
    assert.ok(Object.isFrozen(activatedPlan.requiredLockOrder));
    assert.equal(
      activatedPlan.planHash,
      hashPlatformReleaseBootstrapRegistryActivationPlanV2(
        activatedPlan,
      ),
    );
  });

  it("accepts ready or empty stable Node lifecycle only when census agrees", () => {
    const ready = baseInput(readyNodeNames());
    ready.nodeLifecycle = {
      status: "ready",
      nodeLifecycleIdentityHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
    };
    assert.equal(plan(ready).state, "LEGACY_ONLY");

    const readyWithoutRoot = baseInput();
    readyWithoutRoot.nodeLifecycle = {
      status: "ready",
      nodeLifecycleIdentityHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
    };
    assert.deepEqual(
      plan(readyWithoutRoot).corruptionReasons,
      ["node_lifecycle_census_mismatch"],
    );

    const emptyWithClaim = baseInput([
      ...emptyNodeNames(),
      nodePackage.lifecycle.activeClaimBasename,
    ]);
    assert.deepEqual(
      plan(emptyWithClaim).corruptionReasons,
      ["node_lifecycle_census_mismatch"],
    );

    const transient = baseInput([
      ...emptyNodeNames(),
      `${nodePackage.lifecycle.stagingPrefix}.${hash("c")}`,
    ]);
    transient.nodeLifecycle = {
      status: "transient",
      failureKind: "active_staging",
    };
    assert.equal(plan(transient).state, "CORRUPT");
    assert.ok(
      plan(transient).corruptionReasons.includes(
        "node_lifecycle_not_stable",
      ),
    );
  });

  it("fails closed on preactivation siblings, claims, and impossible floor states", () => {
    const sibling = baseInput([
      ...emptyNodeNames(),
      contract.packages.find((entry) =>
        entry.packageRef
          === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier)!
        .rootBasename,
    ]);
    assert.deepEqual(
      plan(sibling).corruptionReasons,
      ["namespace_non_node_siblings_before_activation"],
    );

    const shared = withSharedLock(baseInput());
    const claim = buildPlatformReleaseBootstrapRegistryEpochClaimV2({
      transactionIdentityHash: hash("b"),
      priorEpochStateHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2
          .epochStateHash,
      targetEpochStateHash: laterFloor().epochStateHash,
      packageRef:
        PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      packageInstallationGeneration: 1,
      offlineRollbackAuthorizationHash: null,
    });
    assert.equal(shared.namespace.status, "exact");
    const preactivationClaim = {
      ...shared,
      namespace: exactNamespace([
        ...shared.namespace.census.orderedEntries.map((entry) =>
          entry.basename),
        contract.registry.epochClaimBasename,
      ]),
      epochClaim: { status: "exact", claim } as const,
    };
    assert.ok(
      plan(preactivationClaim).corruptionReasons.includes(
        "epoch_claim_present_before_activation",
      ),
    );

    const laterWithoutReceipt = withGenesis(shared);
    laterWithoutReceipt.epochFloor = {
      status: "exact",
      state: laterFloor(),
    };
    assert.deepEqual(
      plan(laterWithoutReceipt).corruptionReasons,
      ["non_genesis_floor_before_activation"],
    );

    const floorWithoutShared = baseInput([
      ...emptyNodeNames(),
      contract.registry.epochFloorBasename,
    ]);
    floorWithoutShared.epochFloor = {
      status: "exact",
      state:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
    };
    assert.deepEqual(
      plan(floorWithoutShared).corruptionReasons,
      ["shared_lock_missing_for_epoch_floor"],
    );
  });

  it("turns aliased or mismatched cutover identities into corruption without throwing", () => {
    const aliased = withSharedLock(baseInput());
    aliased.sharedLock = {
      status: "exact",
      sharedLockIdentityHash: LEGACY_LOCK_IDENTITY,
    };
    const aliasedPlan = plan(aliased);
    assert.equal(aliasedPlan.state, "CORRUPT");
    assert.deepEqual(aliasedPlan.corruptionReasons, [
      "activation_receipt_cutover_identity_mismatch",
    ]);

    const genesis = withGenesis(withSharedLock(baseInput()));
    const activated = withActivation(genesis);
    const wrongReceipt = buildPlatformReleaseBootstrapRegistryActivationReceiptV2(
      {
        sharedLockIdentityHash: hash("4"),
        legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
        nodeLifecycleIdentityHash:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
        parentIdentityHash: PARENT_IDENTITY,
      },
    );
    activated.activationReceipt = {
      status: "exact",
      receipt: wrongReceipt,
    };
    assert.deepEqual(plan(activated).corruptionReasons, [
      "activation_receipt_cutover_identity_mismatch",
    ]);

    const presenceMismatch = withSharedLock(baseInput());
    assert.equal(presenceMismatch.namespace.status, "exact");
    presenceMismatch.namespace = exactNamespace(
      presenceMismatch.namespace.census.orderedEntries
        .filter((entry) =>
          entry.category !== "shared_parent_lock")
        .map((entry) => entry.basename),
    );
    assert.deepEqual(plan(presenceMismatch).corruptionReasons, [
      "namespace_observation_mismatch",
    ]);
  });

  it("accepts a later floor after activation and types exact claim recovery", () => {
    const activated = withActivation(
      withGenesis(withSharedLock(baseInput())),
    );
    assert.equal(activated.namespace.status, "exact");
    const current = laterFloor();
    const hostRoot = contract.packages.find((entry) =>
      entry.packageRef
        === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier)!
      .rootBasename;
    const activeLater = {
      ...activated,
      namespace: exactNamespace([
        ...activated.namespace.census.orderedEntries.map((entry) =>
          entry.basename),
        hostRoot,
      ]),
      epochFloor: { status: "exact", state: current } as const,
    };
    const activeLaterPlan = plan(activeLater);
    assert.equal(activeLaterPlan.state, "ACTIVATED");
    assert.equal(activeLaterPlan.nextAction, "return_activated");

    const claim = buildPlatformReleaseBootstrapRegistryEpochClaimV2({
      transactionIdentityHash: current.transactionIdentityHash!,
      priorEpochStateHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2
          .epochStateHash,
      targetEpochStateHash: current.epochStateHash,
      packageRef:
        PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      packageInstallationGeneration: 1,
      offlineRollbackAuthorizationHash: null,
    });
    const claimNames = [
      ...activeLater.namespace.census.orderedEntries.map((entry) =>
        entry.basename),
      contract.registry.epochClaimBasename,
    ];
    const atTarget = {
      ...activeLater,
      namespace: exactNamespace(claimNames),
      epochClaim: { status: "exact", claim } as const,
    };
    const targetPlan = plan(atTarget);
    assert.equal(targetPlan.state, "ACTIVATED");
    assert.equal(targetPlan.nextAction, "recover_epoch_claim");
    assert.equal(
      targetPlan.epochClaimDisposition,
      "recovery_from_target",
    );

    const atPrior = {
      ...atTarget,
      epochFloor: {
        status: "exact",
        state:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      } as const,
    };
    assert.equal(
      plan(atPrior).epochClaimDisposition,
      "recovery_from_prior",
    );

    const thirdFloor = buildPlatformReleaseBootstrapRegistryEpochFloorStateV2(
      {
        generation: 2,
        priorEpochStateHash: current.epochStateHash,
        transactionIdentityHash: hash("d"),
        packageEpochArtifactMap: current.packageEpochArtifactMap,
      },
    );
    const third = {
      ...atTarget,
      epochFloor: { status: "exact", state: thirdFloor } as const,
    };
    assert.deepEqual(plan(third).corruptionReasons, [
      "epoch_claim_state_mismatch",
    ]);
  });

  it("snapshots hostile candidates and rejects rehashed semantic plan tamper", () => {
    const activatedPlan = plan(
      withActivation(withGenesis(withSharedLock(baseInput()))),
    );
    const tampered = mutableClone(activatedPlan);
    tampered.state = "LEGACY_ONLY";
    tampered.planHash =
      hashPlatformReleaseBootstrapRegistryActivationPlanV2(tampered);
    assert.equal(
      PlatformReleaseBootstrapRegistryActivationPlanV2Schema
        .safeParse(tampered).success,
      false,
    );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2(
        tampered,
      ));

    let getterCalls = 0;
    const accessorCandidate = {};
    Object.defineProperty(accessorCandidate, "legacyLock", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return { status: "absent" };
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
        accessorCandidate,
      ));
    assert.equal(getterCalls, 0);

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
        cycle,
      ));
  });

  it("keeps production activation zero-input, typed, and physically inert", async () => {
    assert.equal(
      activatePlatformReleaseBootstrapRegistryProductionV2.length,
      0,
    );
    let proxyReads = 0;
    const hostileArgument = new Proxy({}, {
      get() {
        proxyReads += 1;
        throw new Error("must not inspect");
      },
    });
    assert.throws(
      () =>
        Reflect.apply(
          activatePlatformReleaseBootstrapRegistryProductionV2,
          undefined,
          [hostileArgument],
        ),
      (error) =>
        error instanceof
            PlatformReleaseBootstrapRegistryProductionActivationErrorV2
        && error.code
          ===
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2,
    );
    assert.equal(proxyReads, 0);

    const source = await readFile(
      new URL(
        "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /node:(?:fs|child_process|net|http|https)|darwin-parent-descriptor-lease|publication-v2/,
    );
  });
});
