import { isProxy } from "node:util/types";

import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  buildPlatformReleaseBootstrapRegistryActivationPlanV2,
  parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2,
  type PlatformReleaseBootstrapRegistryActivationNextActionV2,
  type PlatformReleaseBootstrapRegistryActivationPlanV2,
} from "./platform-release-bootstrap-registry-activation-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_NO_PROGRESS_REPLAYS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_ROUNDS_V2,
} from "./platform-release-bootstrap-registry-physical-activation-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_ACTION_METHOD_REFS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
} from "./platform-release-bootstrap-registry-physical-activation-types-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_RESULT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-physical-activation-mechanics-result.v2" as const;

export type PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorCodeV2 =
  | "PHYSICAL_ACTIVATION_ACTION_FAILED_TO_CONVERGE"
  | "PHYSICAL_ACTIVATION_DRIVER_INVALID"
  | "PHYSICAL_ACTIVATION_NO_PROGRESS"
  | "PHYSICAL_ACTIVATION_ROUND_LIMIT"
  | "PHYSICAL_ACTIVATION_SESSION_CLOSE_FAILED";

export class PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2 extends Error {
  readonly code: PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsResultV2 =
  Readonly<{
    schema: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_RESULT_V2_SCHEMA;
    version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
    mechanicsScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2;
    productionAuthority: false;
    terminalState: "ACTIVATED";
    completedRounds: number;
    finalPlanHash: string;
    contractHash: string;
    mechanicsResultHash: string;
  }>;

type PlanHandleStateV2 = {
  readonly session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2;
  readonly plan: PlatformReleaseBootstrapRegistryActivationPlanV2;
  readonly slotLedgerToken: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2;
  readonly slotLedgerBindingHash: string;
  lifecycle: "planned" | "consumed";
};

const planHandleConstructorCapabilityV2 = Object.freeze({});
const planHandleStatesV2 = new WeakMap<object, PlanHandleStateV2>();

class PhysicalActivationPlanHandleV2 implements PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2 {
  readonly mechanicsScope =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2;
  readonly round: number;
  readonly planHash: string;
  readonly nextAction: PlatformReleaseBootstrapRegistryActivationNextActionV2;

  constructor(
    capability: object,
    round: number,
    session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
    plan: PlatformReleaseBootstrapRegistryActivationPlanV2,
    slotLedgerToken: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
    slotLedgerBindingHash: string,
  ) {
    if (capability !== planHandleConstructorCapabilityV2) {
      throw new PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2(
        "PHYSICAL_ACTIVATION_DRIVER_INVALID",
        "Physical activation plan handles are core-owned",
      );
    }
    this.round = round;
    this.planHash = plan.planHash;
    this.nextAction = plan.nextAction;
    planHandleStatesV2.set(this, {
      session,
      plan,
      slotLedgerToken,
      slotLedgerBindingHash,
      lifecycle: "planned",
    });
    Object.freeze(this);
  }
}

function failV2(
  code: PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function authenticMechanicsDriverV2(
  driver: PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2,
): PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2 {
  if (
    typeof driver !== "object" ||
    driver === null ||
    isProxy(driver) ||
    driver.mechanicsScope !==
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2 ||
    driver.contractHash !==
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash ||
    driver.backendAbiHash !==
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.backendAbiHash ||
    typeof driver.openFreshSession !== "function"
  ) {
    return failV2(
      "PHYSICAL_ACTIVATION_DRIVER_INVALID",
      "Physical activation requires one explicit mechanics-only driver",
    );
  }
  return driver;
}

const requiredSessionMethodsV2 = Object.freeze([
  "observePhysicalActivationState",
  "reobserveLockedPhysicalActivationState",
  "acquireLegacyNodeLock",
  "acquireSharedParentLock",
  "acquireRegisteredPackageLock",
  "revalidateFixedSession",
  "assertPhysicalActivationOperationReserve",
  ...PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_ACTION_METHOD_REFS_V2,
  "closeOrAbortSession",
] as const);

function authenticFreshSessionV2(
  session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
  priorSessions: WeakSet<object>,
  priorSessionOccurrenceHashes: Set<string>,
): PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2 {
  if (
    typeof session !== "object" ||
    session === null ||
    isProxy(session) ||
    priorSessions.has(session) ||
    session.mechanicsScope !==
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2 ||
    session.contractHash !==
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash ||
    session.backendAbiHash !==
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.backendAbiHash ||
    !/^[a-f0-9]{64}$/.test(session.sessionOccurrenceHash) ||
    priorSessionOccurrenceHashes.has(session.sessionOccurrenceHash) ||
    requiredSessionMethodsV2.some(
      (method) => typeof session[method] !== "function",
    )
  ) {
    return failV2(
      "PHYSICAL_ACTIVATION_DRIVER_INVALID",
      "Physical activation driver must return one unused exact mechanics session",
    );
  }
  priorSessions.add(session);
  priorSessionOccurrenceHashes.add(session.sessionOccurrenceHash);
  return session;
}

function exactLockVectorV2(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

export function hashPlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerBindingV2(
  sessionOccurrenceHash: string,
  observation: unknown,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-physical-activation-locked-slot-ledger-binding.v2",
    contractHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash,
    sessionOccurrenceHash,
    observation,
  });
}

async function acquirePlanLocksV2(
  session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
  plan: PlatformReleaseBootstrapRegistryActivationPlanV2,
): Promise<boolean> {
  let deferredSharedLock = false;
  for (const role of plan.requiredLockOrder) {
    if (
      role === "shared_parent_lock" &&
      plan.nextAction === "publish_and_acquire_shared_lock"
    ) {
      deferredSharedLock = true;
      continue;
    }
    switch (role) {
      case "legacy_node_package_lock":
        await session.acquireLegacyNodeLock();
        break;
      case "shared_parent_lock":
        await session.acquireSharedParentLock();
        break;
      case "package_lock":
        await session.acquireRegisteredPackageLock();
        break;
    }
  }
  return deferredSharedLock;
}

function newPlanHandleV2(
  round: number,
  session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
  plan: PlatformReleaseBootstrapRegistryActivationPlanV2,
  slotLedgerToken: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  slotLedgerBindingHash: string,
): PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2 {
  const handle = new PhysicalActivationPlanHandleV2(
    planHandleConstructorCapabilityV2,
    round,
    session,
    plan,
    slotLedgerToken,
    slotLedgerBindingHash,
  );
  return handle;
}

function consumePlanHandleV2(
  handle: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
  session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
  action: PlatformReleaseBootstrapRegistryActivationNextActionV2,
  slotLedgerToken: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  slotLedgerBindingHash: string,
): void {
  if (
    typeof handle !== "object" ||
    handle === null ||
    isProxy(handle) ||
    Object.getPrototypeOf(handle) !== PhysicalActivationPlanHandleV2.prototype
  ) {
    return failV2(
      "PHYSICAL_ACTIVATION_DRIVER_INVALID",
      "Physical activation action requires one authentic core-owned plan handle",
    );
  }
  const state = planHandleStatesV2.get(handle);
  if (
    state === undefined ||
    state.session !== session ||
    state.lifecycle !== "planned" ||
    state.plan.planHash !== handle.planHash ||
    state.plan.nextAction !== action ||
    handle.nextAction !== action ||
    state.slotLedgerToken !== slotLedgerToken ||
    state.slotLedgerBindingHash !== slotLedgerBindingHash
  ) {
    return failV2(
      "PHYSICAL_ACTIVATION_DRIVER_INVALID",
      "Physical activation plan handle is forged, stale, consumed, or cross-session",
    );
  }
  state.lifecycle = "consumed";
}

async function dispatchOneActionV2(
  session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
  plan: PlatformReleaseBootstrapRegistryActivationPlanV2,
  handle: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
  slotLedgerToken: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  slotLedgerBindingHash: string,
): Promise<void> {
  consumePlanHandleV2(
    handle,
    session,
    plan.nextAction,
    slotLedgerToken,
    slotLedgerBindingHash,
  );
  switch (plan.nextAction) {
    case "cleanup_activation_staging":
      return session.cleanupActivationStaging(handle, slotLedgerToken);
    case "cleanup_orphaned_activation_staging":
      return session.cleanupOrphanedActivationStaging(handle, slotLedgerToken);
    case "cleanup_orphaned_epoch_staging":
      return session.cleanupOrphanedEpochStaging(handle, slotLedgerToken);
    case "prepare_and_publish_activation_claim":
      return session.prepareAndPublishActivationClaim(handle, slotLedgerToken);
    case "publish_and_acquire_shared_lock":
      return session.publishAndAcquireSharedLock(handle, slotLedgerToken);
    case "publish_genesis_epoch_floor":
      return session.publishGenesisEpochFloor(handle, slotLedgerToken);
    case "publish_activation_receipt":
      return session.publishActivationReceipt(handle, slotLedgerToken);
    case "recover_epoch_claim":
      return session.recoverEpochClaim(handle, slotLedgerToken);
    case "remove_activation_claim":
      return session.removeActivationClaim(handle, slotLedgerToken);
    case "resume_activation_staging_cleanup":
      return session.resumeActivationStagingCleanup(handle, slotLedgerToken);
    case "return_activated":
      return session.returnActivated(handle, slotLedgerToken);
    case "no_mutation":
      return session.closeWithoutMutation(handle, slotLedgerToken);
  }
}

async function settleSessionV2(
  session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
  disposition: "close" | "abort",
  invocationSettleFailures: WeakSet<object>,
): Promise<void> {
  try {
    await session.closeOrAbortSession(disposition);
  } catch (error) {
    const failure =
      new PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2(
        "PHYSICAL_ACTIVATION_SESSION_CLOSE_FAILED",
        `Physical activation session failed to ${disposition}`,
        { cause: error },
      );
    invocationSettleFailures.add(failure);
    throw failure;
  }
}

function mechanicsResultV2(
  completedRounds: number,
  plan: PlatformReleaseBootstrapRegistryActivationPlanV2,
): PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsResultV2 {
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_RESULT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    mechanicsScope:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
    productionAuthority: false,
    terminalState: "ACTIVATED",
    completedRounds,
    finalPlanHash: plan.planHash,
    contractHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash,
  } as const;
  return deepFreezePlatformReleaseJsonV2({
    ...identity,
    mechanicsResultHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-registry-physical-activation-mechanics-result-hash.v2",
      identity,
    }),
  });
}

export async function runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
  inputDriver: PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2,
): Promise<PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsResultV2> {
  const driver = authenticMechanicsDriverV2(inputDriver);
  const priorSessions = new WeakSet<object>();
  const priorSessionOccurrenceHashes = new Set<string>();
  const priorLockedSlotLedgerTokens = new WeakSet<object>();
  const invocationSettleFailures = new WeakSet<object>();
  let previousPlanHash: string | undefined;
  let noProgressReplays = 0;
  let lastActionError: unknown;

  for (
    let round = 1;
    round <=
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_ROUNDS_V2;
    round += 1
  ) {
    let openedSession: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2;
    try {
      openedSession = await driver.openFreshSession();
    } catch (error) {
      return failV2(
        "PHYSICAL_ACTIVATION_DRIVER_INVALID",
        "Physical activation driver failed to open one fresh session",
        error,
      );
    }
    const session = authenticFreshSessionV2(
      openedSession,
      priorSessions,
      priorSessionOccurrenceHashes,
    );
    let settled = false;
    let mutationAttempted = false;
    let lockedPlan:
      PlatformReleaseBootstrapRegistryActivationPlanV2 | undefined;

    try {
      const probeObservation =
        parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
          await session.observePhysicalActivationState(),
        );
      const probePlan =
        buildPlatformReleaseBootstrapRegistryActivationPlanV2(probeObservation);
      const deferredSharedLock = await acquirePlanLocksV2(session, probePlan);
      await session.revalidateFixedSession();
      const lockedCapture =
        await session.reobserveLockedPhysicalActivationState();
      if (
        typeof lockedCapture !== "object" ||
        lockedCapture === null ||
        isProxy(lockedCapture) ||
        typeof lockedCapture.slotLedgerToken !== "object" ||
        lockedCapture.slotLedgerToken === null ||
        isProxy(lockedCapture.slotLedgerToken) ||
        lockedCapture.slotLedgerToken.mechanicsScope !==
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2 ||
        priorLockedSlotLedgerTokens.has(lockedCapture.slotLedgerToken)
      ) {
        return failV2(
          "PHYSICAL_ACTIVATION_DRIVER_INVALID",
          "Locked physical observation requires one fresh private slot-ledger token",
        );
      }
      const lockedObservation =
        parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
          lockedCapture.observation,
        );
      if (
        lockedCapture.slotLedgerBindingHash !==
        hashPlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerBindingV2(
          session.sessionOccurrenceHash,
          lockedObservation,
        )
      ) {
        return failV2(
          "PHYSICAL_ACTIVATION_DRIVER_INVALID",
          "Locked physical observation does not bind its exact session slot ledger",
        );
      }
      priorLockedSlotLedgerTokens.add(lockedCapture.slotLedgerToken);
      lockedPlan =
        buildPlatformReleaseBootstrapRegistryActivationPlanV2(
          lockedObservation,
        );

      if (lockedPlan.planHash === previousPlanHash) {
        noProgressReplays += 1;
        if (
          noProgressReplays >
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_NO_PROGRESS_REPLAYS_V2
        ) {
          await settleSessionV2(session, "close", invocationSettleFailures);
          settled = true;
          return failV2(
            "PHYSICAL_ACTIVATION_NO_PROGRESS",
            "Physical activation repeated the same locked observation and plan beyond its exact replay bound",
            lastActionError,
          );
        }
      } else {
        previousPlanHash = lockedPlan.planHash;
        noProgressReplays = 0;
      }

      if (
        !exactLockVectorV2(
          probePlan.requiredLockOrder,
          lockedPlan.requiredLockOrder,
        ) ||
        (deferredSharedLock &&
          lockedPlan.nextAction !== "publish_and_acquire_shared_lock") ||
        (lockedPlan.nextAction === "publish_and_acquire_shared_lock" &&
          probePlan.nextAction !== "publish_and_acquire_shared_lock")
      ) {
        await settleSessionV2(session, "close", invocationSettleFailures);
        settled = true;
      } else {
        const protocol =
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.actionProtocols.find(
            (candidate) => candidate.nextAction === lockedPlan!.nextAction,
          );
        if (protocol === undefined) {
          return failV2(
            "PHYSICAL_ACTIVATION_DRIVER_INVALID",
            "Physical activation reducer action has no exact contract method",
          );
        }
        if (protocol.mutationClass === "closed_crash_microprotocol") {
          await session.assertPhysicalActivationOperationReserve();
          mutationAttempted = true;
        }
        const handle = newPlanHandleV2(
          round,
          session,
          lockedPlan,
          lockedCapture.slotLedgerToken,
          lockedCapture.slotLedgerBindingHash,
        );
        await dispatchOneActionV2(
          session,
          lockedPlan,
          handle,
          lockedCapture.slotLedgerToken,
          lockedCapture.slotLedgerBindingHash,
        );
        await session.revalidateFixedSession();
        await settleSessionV2(session, "close", invocationSettleFailures);
        settled = true;

        if (lockedPlan.nextAction === "return_activated") {
          return mechanicsResultV2(round, lockedPlan);
        }
      }
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        invocationSettleFailures.has(error)
      ) {
        throw error;
      }
      if (
        settled &&
        error instanceof
          PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2
      ) {
        throw error;
      }
      if (!settled) {
        await settleSessionV2(session, "abort", invocationSettleFailures);
        settled = true;
      }
      if (!mutationAttempted) {
        return failV2(
          "PHYSICAL_ACTIVATION_DRIVER_INVALID",
          "Physical activation failed before one closed mutation microprotocol began",
          error,
        );
      }
      lastActionError = error;
    }
  }

  return failV2(
    lastActionError === undefined
      ? "PHYSICAL_ACTIVATION_ROUND_LIMIT"
      : "PHYSICAL_ACTIVATION_ACTION_FAILED_TO_CONVERGE",
    "Physical activation did not reach one final locked activated observation within its exact round bound",
    lastActionError,
  );
}
