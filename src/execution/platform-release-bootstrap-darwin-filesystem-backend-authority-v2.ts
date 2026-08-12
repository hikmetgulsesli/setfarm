import { isProxy } from "node:util/types";

import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
  type PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2,
} from "./schemas/platform-release-bootstrap-darwin-filesystem-backend-v2.js";
import { deepFreezePlatformReleaseJsonV2 } from "./schemas/platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2 =
  "DARWIN_FILESYSTEM_BACKEND_UNAVAILABLE" as const;

export type PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorCodeV2 =
  | typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2
  | "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED";

export class PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2 extends Error {
  readonly code: PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type BackendLiveSessionV2 = {
  readonly liveBridge: object;
  lifecycle: "open" | "closed";
  nextSequence: number;
  sessionBindingHash: string;
  openingTranscriptHash: string;
  currentTranscriptHash: string;
};

type BackendCapabilityStateV2 = Readonly<{
  receipt: PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2;
  admissionScope: "production_host";
  liveSession: BackendLiveSessionV2;
}>;

const backendConstructorCapabilityV2 = Object.freeze({});
const authenticatedLiveBridgesV2 = new WeakSet<object>();
const backendCapabilityStatesV2 = new WeakMap<
  object,
  BackendCapabilityStateV2
>();

export class PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2 {
  readonly backendAbiHash: string;
  readonly receiptHash: string;

  constructor(capability: object, state: BackendCapabilityStateV2) {
    if (capability !== backendConstructorCapabilityV2) {
      throw new PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2(
        "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
        "Darwin filesystem backend constructor capability is unavailable",
      );
    }
    if (
      state.admissionScope !== "production_host" ||
      state.receipt.backendAbiHash !==
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash ||
      state.receipt.sessionLifecycle !== "open_fresh" ||
      state.receipt.initialSequence !== 0 ||
      typeof state.liveSession.liveBridge !== "object" ||
      state.liveSession.liveBridge === null ||
      isProxy(state.liveSession.liveBridge) ||
      !authenticatedLiveBridgesV2.has(state.liveSession.liveBridge) ||
      state.liveSession.lifecycle !== "open" ||
      state.liveSession.nextSequence !== 1 ||
      state.liveSession.sessionBindingHash !==
        state.receipt.sessionBindingHash ||
      state.liveSession.openingTranscriptHash !==
        state.receipt.transcriptHash ||
      state.liveSession.currentTranscriptHash !== state.receipt.transcriptHash
    ) {
      throw new PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2(
        "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
        "Darwin filesystem backend live session state is not authenticated",
      );
    }
    this.backendAbiHash = state.receipt.backendAbiHash;
    this.receiptHash = state.receipt.receiptHash;
    backendCapabilityStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function failV2(
  code: PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function authenticStateV2(
  capability: PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2,
): BackendCapabilityStateV2 {
  if (
    typeof capability !== "object" ||
    capability === null ||
    isProxy(capability) ||
    Object.getPrototypeOf(capability) !==
      PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2.prototype
  ) {
    return failV2(
      "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
      "Darwin filesystem backend operation requires one authentic live capability",
    );
  }
  const state = backendCapabilityStatesV2.get(capability);
  if (state === undefined) {
    return failV2(
      "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
      "Darwin filesystem backend operation requires one authentic live capability",
    );
  }
  if (
    state.admissionScope !== "production_host" ||
    typeof state.liveSession.liveBridge !== "object" ||
    state.liveSession.liveBridge === null ||
    isProxy(state.liveSession.liveBridge) ||
    !authenticatedLiveBridgesV2.has(state.liveSession.liveBridge) ||
    state.liveSession.lifecycle !== "open" ||
    !Number.isSafeInteger(state.liveSession.nextSequence) ||
    state.liveSession.nextSequence < 1 ||
    state.liveSession.nextSequence >
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.maxOperationsPerSession ||
    state.liveSession.sessionBindingHash !== state.receipt.sessionBindingHash ||
    state.liveSession.openingTranscriptHash !== state.receipt.transcriptHash ||
    !/^[a-f0-9]{64}$/.test(state.liveSession.currentTranscriptHash)
  ) {
    return failV2(
      "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
      "Darwin filesystem backend live session is closed or detached from its authenticated receipt",
    );
  }
  return state;
}

export async function openProductionAuthenticatedDarwinFilesystemBackendV2(): Promise<PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2> {
  return failV2(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2,
    "Authenticated signed Darwin descriptor backend, conditional epoch replacement proof, all-component beneath resolution, and directory power-loss durability evidence are unavailable",
  );
}

export function inspectPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
  capability: PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2,
): PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(authenticStateV2(capability).receipt),
  );
}

export function isProductionPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2(
  capability: PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2,
): boolean {
  const state = authenticStateV2(capability);
  return (
    state.admissionScope === "production_host" &&
    state.liveSession.lifecycle === "open" &&
    state.liveSession.nextSequence >= 1 &&
    state.liveSession.nextSequence <=
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.maxOperationsPerSession &&
    state.liveSession.sessionBindingHash === state.receipt.sessionBindingHash &&
    state.liveSession.openingTranscriptHash === state.receipt.transcriptHash &&
    /^[a-f0-9]{64}$/.test(state.liveSession.currentTranscriptHash) &&
    state.receipt.backendAbiHash ===
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash
  );
}
