import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  executeHostNodeToolchainPlatformReleaseBuildV2,
  executeHostNodeToolchainPlatformReleaseNpmCiV2,
  executeHostNodeToolchainPlatformReleaseProductionNpmCiV2,
  isProductionHostNodeToolchainAuthorityV2,
  revalidateHostNodeToolchainAuthorityV2,
  HostNodeToolchainAuthorityErrorV2,
  type HostNodeToolchainAuthorityErrorCodeV2,
  type HostNodeToolchainAuthorityV2,
  type HostNodeToolchainNpmCiInputV2,
  type HostNodeToolchainPlatformReleaseBuildInputV2,
  type HostNodeToolchainPlatformReleaseProductionNpmCiInputV2,
} from "../product-compiler/host-node-toolchain-authority-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  PlatformReleaseHostCompositionAuthorityErrorV2,
  createPlatformReleaseHostCompositionAuthorityV2ForTest,
  inspectPlatformReleaseHostCompositionReceiptV2,
  isProductionPlatformReleaseHostCompositionAuthorityV2,
  openPlatformReleaseHostCompositionAuthorityV2Internal,
  revalidatePlatformReleaseHostCompositionAuthorityV2,
  type PlatformReleaseHostCompositionAuthorityV2,
  type PlatformReleaseHostCompositionFixtureV2,
} from
  "./platform-release-host-composition-authority-v2.js";
import {
  PLATFORM_RELEASE_BUILD_DIRECT_ARGV_TEMPLATE_V2,
  PlatformReleaseBuildCommandResultV2Schema,
  type PlatformReleaseBuildCommandResultV2,
} from "./schemas/platform-release-build-v2.js";
import {
  hashPlatformReleaseHostNodeToolchainBuildEvidenceV2,
  parsePlatformReleaseHostNodeToolchainBuildEvidenceCandidateV2,
  type PlatformReleaseHostNodeToolchainBuildEvidenceV2 as
    ParsedPlatformReleaseHostNodeToolchainBuildEvidenceV2,
} from
  "./schemas/platform-release-host-node-build-evidence-v2.js";
import {
  PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA,
  PlatformReleaseHostCompositionPlatformProjectionV2Schema,
  hashPlatformReleaseHostCompositionHostIdentityV2,
  hashPlatformReleaseHostCompositionPlatformProjectionV2,
  type PlatformReleaseHostCompositionPlatformProjectionV2,
} from
  "./schemas/platform-release-host-composition-v2.js";
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
  | "HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_AUTHORITY_INVALID"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_DRIFT"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED"
  | "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID";

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
  composition:
    PlatformReleaseHostCompositionAuthorityV2;
  compositionReceiptHash: string;
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

export type PlatformReleaseHostNodeToolchainBuildEvidenceV2 =
  ParsedPlatformReleaseHostNodeToolchainBuildEvidenceV2;

export type PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2 =
  Readonly<{
    schema:
      "setfarm.platform-release-host-node-toolchain-production-npm-ci-evidence.v2";
    version: "2.0.0";
    authorityState:
      "authenticated_process_occurrence_unverified";
    productionUse:
      "forbidden_until_complete_dependency_pair_and_fresh_release_verification";
    probeRef:
      "HOST_NPM_PLATFORM_RELEASE_PRODUCTION_INSTALL_V2";
    platformHostToolchainReceiptHash: string;
    nodeIdentityHash: string;
    npmClosureHash: string;
    environmentHash: string;
    environmentScopeHash: string;
    projectScopeHash: string;
    projectPhysicalIdentityHash: string;
    sourceFenceHash: string;
    directArgv: readonly [
      "npm",
      "ci",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ];
    directArgvHash: string;
    stdin: "closed";
    inheritAmbientEnvironment: false;
    timeoutMs: 120_000;
    maxStdoutBytes: 65_536;
    maxStderrBytes: 65_536;
    shell: "forbidden";
    termination: "normal_exit";
    exitCode: 0;
    signal: null;
    stdoutContentHash: string;
    stdoutByteLength: number;
    stderrContentHash: string;
    stderrByteLength: number;
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

const HOST_ERROR_CODE_TO_PRODUCTION_NPM_ERROR_V2 =
  Object.freeze({
    HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
    HOST_NODE_TOOLCHAIN_V2_NO_ADMITTED_CANDIDATE:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_NODE_IDENTITY_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_PROBE_TIMEOUT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_PROBE_OUTPUT_LIMIT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_PROBE_SIGNALLED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_PROBE_NONZERO:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_NODE_VERSION_MISMATCH:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_NPM_VERSION_MISMATCH:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_EXECUTABLE_PAIRING_MISMATCH:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID",
    HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
    HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED",
    HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
    HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
    HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_EFFECTIVE_NPM_CONFIG_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_INSTALL_TIMEOUT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_INSTALL_OUTPUT_LIMIT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_INSTALL_SPAWN_FAILED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_INSTALL_SIGNALLED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_INSTALL_NONZERO:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_TIMEOUT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_OUTPUT_LIMIT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SPAWN_FAILED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SIGNALLED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_NONZERO:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SOURCE_DRIFT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_SCOPE_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_TIMEOUT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_OUTPUT_LIMIT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_SPAWN_FAILED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_SIGNALLED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_NONZERO:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_RELEASE_DEPENDENCY_INSTALL_SOURCE_DRIFT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID",
    HOST_NODE_TOOLCHAIN_V2_BUILD_TIMEOUT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_BUILD_OUTPUT_LIMIT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_BUILD_SPAWN_FAILED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_BUILD_SIGNALLED:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_BUILD_NONZERO:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    HOST_NODE_TOOLCHAIN_V2_BUILD_COMPILER_DRIFT:
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
  } satisfies Readonly<Record<
    HostNodeToolchainAuthorityErrorCodeV2,
    PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2
  >>);

function translateProductionNpmErrorV2(
  error: unknown,
): never {
  if (error instanceof HostNodeToolchainAuthorityErrorV2) {
    return fail(
      HOST_ERROR_CODE_TO_PRODUCTION_NPM_ERROR_V2[
        error.code
      ],
      "Authenticated platform release production npm ci failed",
      error,
    );
  }
  return fail(
    "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED",
    "Authenticated platform release production npm ci failed",
    error,
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

function exactTestInputV2(
  input: unknown,
): Readonly<{
  hostToolchain: HostNodeToolchainAuthorityV2;
  compositionFixture:
    PlatformReleaseHostCompositionFixtureV2;
}> {
  if (
    typeof input !== "object"
    || input === null
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Test platform release host input must be one exact plain capability record",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2
    || !keys.includes("hostToolchain")
    || !keys.includes("compositionFixture")
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Test platform release host input must contain exact hostToolchain and compositionFixture fields",
    );
  }
  const hostDescriptor =
    Object.getOwnPropertyDescriptor(input, "hostToolchain");
  const fixtureDescriptor =
    Object.getOwnPropertyDescriptor(
      input,
      "compositionFixture",
    );
  if (
    !hostDescriptor
    || !("value" in hostDescriptor)
    || hostDescriptor.enumerable !== true
    || !fixtureDescriptor
    || !("value" in fixtureDescriptor)
    || fixtureDescriptor.enumerable !== true
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Test platform release host input cannot contain accessors or hidden capabilities",
    );
  }
  return Object.freeze({
    hostToolchain:
      hostDescriptor.value as HostNodeToolchainAuthorityV2,
    compositionFixture:
      fixtureDescriptor.value as
        PlatformReleaseHostCompositionFixtureV2,
  });
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

function buildCompositionPlatformProjectionV2(
  receipt: PlatformReleaseHostNodeToolchainReceiptV2,
): PlatformReleaseHostCompositionPlatformProjectionV2 {
  const host = structuredClone(receipt.host);
  const identity = {
    schema:
      PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA,
    platformHostToolchainReceiptHash: receipt.receiptHash,
    host,
    hostIdentityHash:
      hashPlatformReleaseHostCompositionHostIdentityV2(host),
    nodeIdentityHash: receipt.node.identityHash,
    npmClosureHash: receipt.npm.closureHash,
    dynamicLibraryClosureHash:
      receipt.node.nonSystemDynamicLibraries.closureHash,
  };
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseHostCompositionPlatformProjectionV2Schema
      .parse({
        ...identity,
        projectionHash:
          hashPlatformReleaseHostCompositionPlatformProjectionV2(
            identity,
          ),
      }),
  );
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
  compositionFixture?:
    PlatformReleaseHostCompositionFixtureV2,
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
  const platformHost =
    buildCompositionPlatformProjectionV2(receipt);
  let composition:
    PlatformReleaseHostCompositionAuthorityV2;
  try {
    composition = expectedScope === "production_host"
      ? await openPlatformReleaseHostCompositionAuthorityV2Internal()
      : await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost,
        fixture: compositionFixture,
      });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseHostCompositionAuthorityErrorV2
      && error.code
        === "HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE"
    ) {
      return fail(
        "HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE",
        "Production platform release host composition bootstrap is unavailable",
        error,
      );
    }
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_AUTHORITY_INVALID",
      "Platform release host composition authority could not be issued",
      error,
    );
  }
  const compositionReceipt =
    inspectPlatformReleaseHostCompositionReceiptV2(composition);
  if (
    (
      expectedScope === "production_host"
      && !isProductionPlatformReleaseHostCompositionAuthorityV2(
        composition,
      )
    )
    || (
      expectedScope === "test_fixture"
      && isProductionPlatformReleaseHostCompositionAuthorityV2(
        composition,
      )
    )
    || canonicalJsonStringify(
      compositionReceipt.platformHost,
    ) !== canonicalJsonStringify(platformHost)
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_AUTHORITY_INVALID",
      "Platform release host composition authority scope or host projection does not match its Node owner",
    );
  }
  let bootstrapAfter;
  try {
    bootstrapAfter =
      await revalidateHostNodeToolchainAuthorityV2(bootstrap);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
      "Platform release host bootstrap changed while composition authority was issued",
      error,
    );
  }
  if (
    bootstrapAfter.receiptHash
      !== bootstrapReceipt.receiptHash
    || canonicalJsonStringify(buildReceipt(bootstrapAfter))
      !== canonicalJsonStringify(receipt)
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID",
      "Platform release host bootstrap changed while composition authority was issued",
    );
  }
  const state = Object.freeze({
    admissionScope: expectedScope,
    bootstrap,
    bootstrapReceiptHash: bootstrapReceipt.receiptHash,
    composition,
    compositionReceiptHash:
      compositionReceipt.receiptHash,
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
  input: Readonly<{
    hostToolchain: HostNodeToolchainAuthorityV2;
    compositionFixture:
      PlatformReleaseHostCompositionFixtureV2;
  }>,
): Promise<PlatformReleaseHostNodeToolchainAuthorityV2> {
  const exact = exactTestInputV2(input);
  const bootstrap = exact.hostToolchain;
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
  return issueAuthority(
    bootstrap,
    "test_fixture",
    exact.compositionFixture,
  );
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
  let compositionReceipt;
  try {
    compositionReceipt =
      await revalidatePlatformReleaseHostCompositionAuthorityV2(
        state.composition,
      );
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_DRIFT",
      "Platform release host composition authority failed fresh revalidation",
      error,
    );
  }
  let bootstrapAfter;
  try {
    bootstrapAfter =
      await revalidateHostNodeToolchainAuthorityV2(
        state.bootstrap,
      );
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host bootstrap failed its post-composition fence",
      error,
    );
  }
  const after = buildReceipt(bootstrapAfter);
  if (
    bootstrapAfter.receiptHash
      !== currentBootstrap.receiptHash
    || canonicalJsonStringify(after)
      !== canonicalJsonStringify(current)
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host Node/npm authority changed across its composition fence",
    );
  }
  if (
    compositionReceipt.receiptHash
      !== state.compositionReceiptHash
    || canonicalJsonStringify(
      compositionReceipt.platformHost,
    ) !== canonicalJsonStringify(
      buildCompositionPlatformProjectionV2(current),
    )
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_DRIFT",
      "Platform release host composition authority changed across its fresh fence",
    );
  }
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(after),
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

export async function executePlatformReleaseHostNodeToolchainProductionNpmCiInternalV2(
  handle: PlatformReleaseHostNodeToolchainAuthorityV2,
  input:
    HostNodeToolchainPlatformReleaseProductionNpmCiInputV2,
): Promise<
  PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2
> {
  const state = authenticState(handle);
  const before =
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(
      handle,
    );
  let observed;
  try {
    observed =
      await executeHostNodeToolchainPlatformReleaseProductionNpmCiV2(
        state.bootstrap,
        input,
      );
  } catch (error) {
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(
      handle,
    );
    return translateProductionNpmErrorV2(error);
  }
  const after =
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(
      handle,
    );
  const expectedDirectArgvHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-npm-direct-argv-hash.v2",
    directArgv: observed.directArgv,
  });
  if (
    before.receiptHash !== after.receiptHash
    || observed.hostToolchainReceiptHash
      !== state.bootstrapReceiptHash
    || observed.probeRef
      !== "HOST_NPM_PLATFORM_RELEASE_PRODUCTION_INSTALL_V2"
    || observed.nodeIdentityHash !== before.node.identityHash
    || observed.npmClosureHash !== before.npm.closureHash
    || observed.directArgvHash !== expectedDirectArgvHash
    || observed.directArgv.join("\0") !== [
      "npm",
      "ci",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ].join("\0")
    || observed.stdin !== "closed"
    || observed.shell !== "forbidden"
    || observed.ambientEnvironment !== "forbidden"
    || observed.status !== "exited_zero"
    || observed.exitCode !== 0
    || observed.signal !== null
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Platform release host or exact production npm recipe changed during execution",
    );
  }
  const identity = {
    schema:
      "setfarm.platform-release-host-node-toolchain-production-npm-ci-evidence.v2" as const,
    version: "2.0.0" as const,
    authorityState:
      "authenticated_process_occurrence_unverified" as const,
    productionUse:
      "forbidden_until_complete_dependency_pair_and_fresh_release_verification" as const,
    probeRef:
      "HOST_NPM_PLATFORM_RELEASE_PRODUCTION_INSTALL_V2" as const,
    platformHostToolchainReceiptHash: after.receiptHash,
    nodeIdentityHash: observed.nodeIdentityHash,
    npmClosureHash: observed.npmClosureHash,
    environmentHash: observed.environmentHash,
    environmentScopeHash:
      observed.environmentScopeHash,
    projectScopeHash: observed.projectScopeHash,
    projectPhysicalIdentityHash:
      observed.projectPhysicalIdentityHash,
    sourceFenceHash: observed.sourceFenceHash,
    directArgv: [...observed.directArgv] as
      PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2[
        "directArgv"
      ],
    directArgvHash: observed.directArgvHash,
    stdin: "closed" as const,
    inheritAmbientEnvironment: false as const,
    timeoutMs: observed.timeoutMs,
    maxStdoutBytes: observed.maxStdoutBytes,
    maxStderrBytes: observed.maxStderrBytes,
    shell: "forbidden" as const,
    termination: "normal_exit" as const,
    exitCode: 0 as const,
    signal: null,
    stdoutContentHash: observed.stdoutHash,
    stdoutByteLength: observed.stdoutBytes,
    stderrContentHash: observed.stderrHash,
    stderrByteLength: observed.stderrBytes,
  };
  return deepFreezePlatformReleaseJsonV2({
    ...identity,
    evidenceHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-node-toolchain-production-npm-ci-evidence-hash.v2",
      evidence: identity,
    }),
  });
}

export async function executePlatformReleaseHostNodeToolchainBuildInternalV2(
  handle: PlatformReleaseHostNodeToolchainAuthorityV2,
  input: HostNodeToolchainPlatformReleaseBuildInputV2,
): Promise<PlatformReleaseHostNodeToolchainBuildEvidenceV2> {
  const state = authenticState(handle);
  const before =
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(handle);
  let observed;
  try {
    observed =
      await executeHostNodeToolchainPlatformReleaseBuildV2(
        state.bootstrap,
        input,
      );
  } catch (error) {
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(handle);
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      "Authenticated platform release build command failed",
      error,
    );
  }
  const after =
    await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(handle);
  let commandResult: PlatformReleaseBuildCommandResultV2;
  try {
    const snapshot = JSON.parse(observed.stdout);
    commandResult =
      PlatformReleaseBuildCommandResultV2Schema.parse(snapshot);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      "Platform release build stdout is not one exact command result",
      error,
    );
  }
  const canonicalStdout =
    `${canonicalJsonStringify(commandResult)}\n`;
  const expectedDirectArgvHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-direct-argv-hash.v2",
    directArgv:
      PLATFORM_RELEASE_BUILD_DIRECT_ARGV_TEMPLATE_V2,
  });
  const expectedEnvironmentHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-process-environment.v2",
    variables: Object.entries({
      CI: "true",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      NO_COLOR: "1",
      SOURCE_DATE_EPOCH: commandResult.sourceDateEpoch,
      TZ: "UTC",
    }).sort(
      ([left], [right]) => left < right ? -1 : left > right ? 1 : 0,
    ),
  });
  if (
    before.receiptHash !== after.receiptHash
    || observed.hostToolchainReceiptHash
      !== state.bootstrapReceiptHash
    || observed.probeRef !== "HOST_NODE_PLATFORM_RELEASE_BUILD_V2"
    || observed.nodeIdentityHash !== before.node.identityHash
    || canonicalJsonStringify(observed.directArgv)
      !== canonicalJsonStringify(
        PLATFORM_RELEASE_BUILD_DIRECT_ARGV_TEMPLATE_V2,
      )
    || observed.directArgvHash !== expectedDirectArgvHash
    || observed.environmentHash !== expectedEnvironmentHash
    || observed.stdin !== "closed"
    || observed.timeoutMs !== 120_000
    || observed.maxStdoutBytes !== 1_048_576
    || observed.maxStderrBytes !== 1_048_576
    || observed.shell !== "forbidden"
    || observed.ambientEnvironment !== "forbidden"
    || observed.status !== "exited_zero"
    || observed.exitCode !== 0
    || observed.signal !== null
    || observed.stdout !== canonicalStdout
    || observed.stderr !== ""
    || commandResult.sourceSha !== observed.sourceSha
    || commandResult.sourceDateEpoch
      !== observed.sourceDateEpoch
    || commandResult.buildToolchainTreeHash
      !== observed.buildToolchainHash
  ) {
    return fail(
      "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED",
      "Platform release build evidence does not join the exact host, input and canonical command result",
    );
  }
  const identity = {
    schema:
      "setfarm.platform-release-host-node-toolchain-build-evidence.v2" as const,
    version: "2.0.0" as const,
    authorityState:
      "authenticated_process_occurrence_unverified" as const,
    productionUse:
      "forbidden_until_source_owned_double_build_and_fresh_release_verification" as const,
    probeRef: "HOST_NODE_PLATFORM_RELEASE_BUILD_V2" as const,
    platformHostToolchainReceiptHash: after.receiptHash,
    nodeIdentityHash: observed.nodeIdentityHash,
    buildContextRootIdentityHash:
      observed.buildContextRootIdentityHash,
    outputStageIdentityHash:
      observed.outputStageIdentityHash,
    commandModuleHash: observed.commandModuleHash,
    environmentHash: observed.environmentHash,
    directArgv: [...observed.directArgv] as
      PlatformReleaseHostNodeToolchainBuildEvidenceV2["directArgv"],
    directArgvHash: observed.directArgvHash,
    stdin: "closed" as const,
    inheritAmbientEnvironment: false as const,
    timeoutMs: observed.timeoutMs,
    maxStdoutBytes: observed.maxStdoutBytes,
    maxStderrBytes: observed.maxStderrBytes,
    shell: "forbidden" as const,
    termination: "normal_exit" as const,
    exitCode: 0 as const,
    signal: null,
    stdoutContentHash: createHash("sha256")
      .update(observed.stdout)
      .digest("hex"),
    stdoutByteLength:
      Buffer.byteLength(observed.stdout, "utf8"),
    stderrContentHash: createHash("sha256")
      .update(observed.stderr)
      .digest("hex"),
    stderrByteLength:
      Buffer.byteLength(observed.stderr, "utf8"),
    commandResult,
  };
  return parsePlatformReleaseHostNodeToolchainBuildEvidenceCandidateV2({
    ...identity,
    evidenceHash:
      hashPlatformReleaseHostNodeToolchainBuildEvidenceV2(
        identity,
      ),
  });
}
