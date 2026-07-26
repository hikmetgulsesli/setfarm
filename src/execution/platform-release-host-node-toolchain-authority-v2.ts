import { isProxy } from "node:util/types";

import {
  executeHostNodeToolchainPlatformReleaseNpmCiV2,
  isProductionHostNodeToolchainAuthorityV2,
  revalidateHostNodeToolchainAuthorityV2,
  type HostNodeToolchainAuthorityV2,
  type HostNodeToolchainNpmCiInputV2,
} from "../product-compiler/host-node-toolchain-authority-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
  PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2,
  PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
  PlatformReleaseHostNodeToolchainReceiptV2Schema,
  getPlatformReleaseHostNodeToolchainRequirementV2,
  hashPlatformReleaseHostNodeToolchainReceiptV2,
  type PlatformReleaseHostNodeToolchainReceiptV2,
} from "./schemas/platform-release-host-node-toolchain-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "./schemas/platform-release-common-v2.js";

export type PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2 =
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_TEST_AUTHORITY_REQUIRED"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED";

export class PlatformReleaseHostNodeToolchainAuthorityErrorV2
  extends Error {
  readonly code:
    PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseHostNodeToolchainAuthorityErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type PlatformReleaseHostNodeToolchainAuthorityStateV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  bootstrap: HostNodeToolchainAuthorityV2;
  bootstrapReceiptHash: string;
  receipt: PlatformReleaseHostNodeToolchainReceiptV2;
}>;

export type PlatformReleaseHostNodeToolchainNpmCiEvidenceV2 =
  Readonly<{
    schema:
      "setfarm.platform-release-host-node-toolchain-npm-ci-evidence.v2";
    probeRef: "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2";
    platformHostToolchainReceiptHash: string;
    environmentHash: string;
    projectScopeHash: string;
    directArgv: readonly [
      "npm",
      "ci",
      "--include=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ];
    directArgvHash: string;
    timeoutMs: 120_000;
    maxStdoutBytes: 65_536;
    maxStderrBytes: 65_536;
    exitCode: 0;
    signal: null;
    stdoutHash: string;
    stdoutBytes: number;
    stderrHash: string;
    stderrBytes: number;
    evidenceHash: string;
  }>;

const authorityConstructorCapabilityV2 = Object.freeze({});
const authorityStatesV2 =
  new WeakMap<object, PlatformReleaseHostNodeToolchainAuthorityStateV2>();

export class PlatformReleaseHostNodeToolchainAuthorityV2 {
  readonly receiptHash: string;
  readonly admissionScope:
    "production_host" | "test_fixture";

  constructor(
    capability: object,
    state: PlatformReleaseHostNodeToolchainAuthorityStateV2,
  ) {
    if (capability !== authorityConstructorCapabilityV2) {
      throw new PlatformReleaseHostNodeToolchainAuthorityErrorV2(
        "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
        "Platform release host authority constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    this.admissionScope = state.admissionScope;
    authorityStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseHostNodeToolchainAuthorityErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function exactInputHandle(
  input: unknown,
): HostNodeToolchainAuthorityV2 {
  if (
    typeof input !== "object"
    || input === null
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
    || Reflect.ownKeys(input).length !== 1
    || Reflect.ownKeys(input)[0] !== "hostToolchain"
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Platform release host input must contain one exact hostToolchain capability",
    );
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    input,
    "hostToolchain",
  );
  if (
    !descriptor
    || !("value" in descriptor)
    || descriptor.enumerable !== true
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Platform release host input contains an accessor or hidden capability",
    );
  }
  return descriptor.value as HostNodeToolchainAuthorityV2;
}

function buildReceipt(
  bootstrapReceipt: Awaited<
    ReturnType<typeof revalidateHostNodeToolchainAuthorityV2>
  >,
): PlatformReleaseHostNodeToolchainReceiptV2 {
  const identity = {
    schema:
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
    receiptVersion: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityRef:
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
    authorityVersion:
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2,
    status: "verified" as const,
    authorityState:
      "verified_platform_release_host_projection" as const,
    admissionScope: bootstrapReceipt.admissionScope,
    filesystemProtection:
      bootstrapReceipt.filesystemProtection,
    installationRoot:
      structuredClone(bootstrapReceipt.installationRoot),
    provisioning:
      structuredClone(bootstrapReceipt.provisioning),
    requirement:
      getPlatformReleaseHostNodeToolchainRequirementV2(),
    host: structuredClone(bootstrapReceipt.host),
    node: structuredClone(bootstrapReceipt.node),
    npm: structuredClone(bootstrapReceipt.npm),
    probe: structuredClone(bootstrapReceipt.probe),
    commandPathProjection:
      structuredClone(bootstrapReceipt.commandPathProjection),
  };
  const parsed =
    PlatformReleaseHostNodeToolchainReceiptV2Schema.safeParse({
      ...identity,
      receiptHash:
        hashPlatformReleaseHostNodeToolchainReceiptV2(identity),
    });
  if (!parsed.success) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID",
      "Platform release host projection failed its canonical receipt schema",
      parsed.error,
    );
  }
  return deepFreezePlatformReleaseJsonV2(parsed.data);
}

function authenticState(
  handle: PlatformReleaseHostNodeToolchainAuthorityV2,
): PlatformReleaseHostNodeToolchainAuthorityStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PlatformReleaseHostNodeToolchainAuthorityV2.prototype
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
      "Platform release host operation requires one authentic capability",
    );
  }
  const state = authorityStatesV2.get(handle);
  if (!state) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
      "Platform release host operation requires one authentic capability",
    );
  }
  return state;
}

async function issueAuthority(
  bootstrap: HostNodeToolchainAuthorityV2,
  expectedScope: "production_host" | "test_fixture",
): Promise<PlatformReleaseHostNodeToolchainAuthorityV2> {
  let bootstrapReceipt;
  try {
    bootstrapReceipt =
      await revalidateHostNodeToolchainAuthorityV2(bootstrap);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
      "Platform release host bootstrap is not one authentic stable Node/npm capability",
      error,
    );
  }
  if (bootstrapReceipt.admissionScope !== expectedScope) {
    return fail(
      expectedScope === "production_host"
        ? "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED"
        : "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_TEST_AUTHORITY_REQUIRED",
      `Platform release ${expectedScope} constructor cannot consume ${bootstrapReceipt.admissionScope} authority`,
    );
  }
  const receipt = buildReceipt(bootstrapReceipt);
  const state = Object.freeze({
    admissionScope: expectedScope,
    bootstrap,
    bootstrapReceiptHash: bootstrapReceipt.receiptHash,
    receipt,
  });
  return new PlatformReleaseHostNodeToolchainAuthorityV2(
    authorityConstructorCapabilityV2,
    state,
  );
}

export async function createPlatformReleaseHostNodeToolchainAuthorityV2(
  input: unknown,
): Promise<PlatformReleaseHostNodeToolchainAuthorityV2> {
  const bootstrap = exactInputHandle(input);
  let production: boolean;
  try {
    production =
      isProductionHostNodeToolchainAuthorityV2(bootstrap);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Production platform release host bootstrap is not authentic",
      error,
    );
  }
  if (!production) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "Production platform release host authority requires one production_host capability",
    );
  }
  return issueAuthority(bootstrap, "production_host");
}

export async function createPlatformReleaseHostNodeToolchainAuthorityV2ForTest(
  input: Readonly<{ hostToolchain: HostNodeToolchainAuthorityV2 }>,
): Promise<PlatformReleaseHostNodeToolchainAuthorityV2> {
  const bootstrap = exactInputHandle(input);
  let production: boolean;
  try {
    production =
      isProductionHostNodeToolchainAuthorityV2(bootstrap);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Test platform release host bootstrap is not authentic",
      error,
    );
  }
  if (production) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_TEST_AUTHORITY_REQUIRED",
      "Test platform release host constructor cannot downgrade production authority",
    );
  }
  return issueAuthority(bootstrap, "test_fixture");
}

export function inspectPlatformReleaseHostNodeToolchainReceiptV2(
  handle: PlatformReleaseHostNodeToolchainAuthorityV2,
): PlatformReleaseHostNodeToolchainReceiptV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(authenticState(handle).receipt),
  );
}

export function isProductionPlatformReleaseHostNodeToolchainAuthorityV2(
  handle: PlatformReleaseHostNodeToolchainAuthorityV2,
): boolean {
  return authenticState(handle).admissionScope === "production_host";
}

export async function revalidatePlatformReleaseHostNodeToolchainAuthorityV2(
  handle: PlatformReleaseHostNodeToolchainAuthorityV2,
): Promise<PlatformReleaseHostNodeToolchainReceiptV2> {
  const state = authenticState(handle);
  let currentBootstrap;
  try {
    currentBootstrap =
      await revalidateHostNodeToolchainAuthorityV2(state.bootstrap);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host bootstrap failed fresh revalidation",
      error,
    );
  }
  if (currentBootstrap.admissionScope !== state.admissionScope) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host bootstrap changed admission scope",
    );
  }
  if (currentBootstrap.receiptHash !== state.bootstrapReceiptHash) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host bootstrap receipt identity changed",
    );
  }
  const current = buildReceipt(currentBootstrap);
  if (
    canonicalJsonStringify(current)
      !== canonicalJsonStringify(state.receipt)
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host Node/npm projection changed",
    );
  }
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(current),
  );
}

export async function executePlatformReleaseHostNodeToolchainNpmCiInternalV2(
  handle: PlatformReleaseHostNodeToolchainAuthorityV2,
  input: HostNodeToolchainNpmCiInputV2,
): Promise<PlatformReleaseHostNodeToolchainNpmCiEvidenceV2> {
  const state = authenticState(handle);
  const before =
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(handle);
  let evidence;
  try {
    evidence =
      await executeHostNodeToolchainPlatformReleaseNpmCiV2(
        state.bootstrap,
        input,
      );
  } catch (error) {
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(handle);
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
      "Authenticated platform release npm ci failed",
      error,
    );
  }
  const after =
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(handle);
  const expectedDirectArgvHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-toolchain-direct-argv-hash.v2",
    directArgv: evidence.directArgv,
  });
  if (
    before.receiptHash !== after.receiptHash
    || evidence.hostToolchainReceiptHash
      !== state.bootstrapReceiptHash
    || evidence.probeRef
      !== "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2"
    || evidence.directArgvHash !== expectedDirectArgvHash
    || evidence.directArgv.join("\0")
      !== [
        "npm",
        "ci",
        "--include=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ].join("\0")
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host or exact npm install recipe changed during execution",
    );
  }
  const identity = {
    schema:
      "setfarm.platform-release-host-node-toolchain-npm-ci-evidence.v2" as const,
    probeRef:
      "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2" as const,
    platformHostToolchainReceiptHash: after.receiptHash,
    environmentHash: evidence.environmentHash,
    projectScopeHash: evidence.projectScopeHash,
    directArgv: [...evidence.directArgv] as
      PlatformReleaseHostNodeToolchainNpmCiEvidenceV2["directArgv"],
    directArgvHash: evidence.directArgvHash,
    timeoutMs: evidence.timeoutMs,
    maxStdoutBytes: evidence.maxStdoutBytes,
    maxStderrBytes: evidence.maxStderrBytes,
    exitCode: evidence.exitCode,
    signal: evidence.signal,
    stdoutHash: evidence.stdoutHash,
    stdoutBytes: evidence.stdoutBytes,
    stderrHash: evidence.stderrHash,
    stderrBytes: evidence.stderrBytes,
  };
  return deepFreezePlatformReleaseJsonV2({
    ...identity,
    evidenceHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-node-toolchain-npm-ci-evidence-hash.v2",
      evidence: identity,
    }),
  });
}
