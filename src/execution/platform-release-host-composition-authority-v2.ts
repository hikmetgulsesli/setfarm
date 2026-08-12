import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_REF_V2,
  PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_VERSION_V2,
  PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
  PLATFORM_RELEASE_HOST_COMPOSITION_FILE_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_HOST_COMPOSITION_INSTALLATION_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA,
  PlatformReleaseHostCompositionFileReceiptV2Schema,
  PlatformReleaseHostCompositionInstallationReceiptV2Schema,
  PlatformReleaseHostCompositionPlatformProjectionV2Schema,
  PlatformReleaseHostCompositionReceiptV2Schema,
  PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema,
  getPlatformReleaseHostCompositionRequirementV2,
  hashPlatformReleaseHostCompositionFilePhysicalIdentityV2,
  hashPlatformReleaseHostCompositionFileReceiptV2,
  hashPlatformReleaseHostCompositionFileSetMembershipV2,
  hashPlatformReleaseHostCompositionInstallationReceiptV2,
  hashPlatformReleaseHostCompositionParentIdentityV2,
  hashPlatformReleaseHostCompositionPhysicalClosureV2,
  hashPlatformReleaseHostCompositionReceiptV2,
  hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2,
  hashPlatformReleaseHostCompositionVerifierBindingV2,
  hashPlatformReleaseHostCompositionVerifierIdentityV2,
  type PlatformReleaseHostCompositionFileReceiptV2,
  type PlatformReleaseHostCompositionPlatformProjectionV2,
  type PlatformReleaseHostCompositionReceiptV2,
} from
  "./schemas/platform-release-host-composition-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "./schemas/platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
} from "./platform-release-bootstrap-network-negative-operation-v2.js";

export type PlatformReleaseHostCompositionAuthorityErrorCodeV2 =
  | "HOST_COMPOSITION_INPUT_INVALID"
  | "HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE"
  | "HOST_COMPOSITION_AUTHORITY_INVALID"
  | "HOST_COMPOSITION_SCOPE_MISMATCH"
  | "HOST_COMPOSITION_RECEIPT_INVALID"
  | "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED"
  | "HOST_COMPOSITION_HOST_DRIFT"
  | "HOST_COMPOSITION_FILESYSTEM_DRIFT";

export class PlatformReleaseHostCompositionAuthorityErrorV2
  extends Error {
  readonly code:
    PlatformReleaseHostCompositionAuthorityErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseHostCompositionAuthorityErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseHostCompositionAuthorityErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseHostCompositionFixtureV2 =
  Readonly<{
    fixtureRoot: string;
    runtimeAccount: Readonly<{
      accountRef:
        "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2";
      uid: number;
      gid: number;
    }>;
  }>;

type FileRoleDefinitionV2 = Readonly<{
  role:
    | "release_bootstrap_executable"
    | "release_bootstrap_module"
    | "host_verifier_executable"
    | "metadata_bootstrap_module"
    | "xattr_observer_executable"
    | "xattr_clear_executable"
    | "acl_observer_executable"
    | "acl_clear_executable"
    | "sandbox_executable"
    | "network_wrapper_module";
  fileRef:
    | "HOST_COMPOSITION_RELEASE_BOOTSTRAP_EXECUTABLE_V2"
    | "HOST_COMPOSITION_RELEASE_BOOTSTRAP_MODULE_V2"
    | "HOST_COMPOSITION_HOST_VERIFIER_EXECUTABLE_V2"
    | "HOST_COMPOSITION_METADATA_BOOTSTRAP_MODULE_V2"
    | "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2"
    | "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2"
    | "HOST_COMPOSITION_ACL_OBSERVER_EXECUTABLE_V2"
    | "HOST_COMPOSITION_ACL_CLEAR_EXECUTABLE_V2"
    | "HOST_COMPOSITION_SANDBOX_EXECUTABLE_V2"
    | "HOST_COMPOSITION_NETWORK_WRAPPER_MODULE_V2";
  origin:
    | "release_bootstrap_package"
    | "host_verifier_package"
    | "fixed_system_tool";
  relativeLocator: string;
  parentRef:
    | "HOST_COMPOSITION_BIN_PARENT_V2"
    | "HOST_COMPOSITION_LIB_PARENT_V2"
    | "HOST_COMPOSITION_TOOLS_PARENT_V2";
  mode: "0444" | "0555" | "0755";
}>;

const FILE_ROLE_DEFINITIONS_V2 =
  Object.freeze([
    {
      role: "release_bootstrap_executable",
      fileRef:
        "HOST_COMPOSITION_RELEASE_BOOTSTRAP_EXECUTABLE_V2",
      origin: "release_bootstrap_package",
      relativeLocator: "bin/release-bootstrap",
      parentRef: "HOST_COMPOSITION_BIN_PARENT_V2",
      mode: "0555",
    },
    {
      role: "release_bootstrap_module",
      fileRef: "HOST_COMPOSITION_RELEASE_BOOTSTRAP_MODULE_V2",
      origin: "release_bootstrap_package",
      relativeLocator: "lib/release-bootstrap.mjs",
      parentRef: "HOST_COMPOSITION_LIB_PARENT_V2",
      mode: "0444",
    },
    {
      role: "host_verifier_executable",
      fileRef: "HOST_COMPOSITION_HOST_VERIFIER_EXECUTABLE_V2",
      origin: "host_verifier_package",
      relativeLocator: "bin/host-verifier",
      parentRef: "HOST_COMPOSITION_BIN_PARENT_V2",
      mode: "0555",
    },
    {
      role: "metadata_bootstrap_module",
      fileRef: "HOST_COMPOSITION_METADATA_BOOTSTRAP_MODULE_V2",
      origin: "release_bootstrap_package",
      relativeLocator: "lib/metadata-bootstrap.mjs",
      parentRef: "HOST_COMPOSITION_LIB_PARENT_V2",
      mode: "0444",
    },
    {
      role: "xattr_observer_executable",
      fileRef: "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      relativeLocator: "tools/xattr-observe",
      parentRef: "HOST_COMPOSITION_TOOLS_PARENT_V2",
      mode: "0755",
    },
    {
      role: "xattr_clear_executable",
      fileRef: "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      relativeLocator: "tools/xattr-clear",
      parentRef: "HOST_COMPOSITION_TOOLS_PARENT_V2",
      mode: "0755",
    },
    {
      role: "acl_observer_executable",
      fileRef: "HOST_COMPOSITION_ACL_OBSERVER_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      relativeLocator: "tools/acl-observe",
      parentRef: "HOST_COMPOSITION_TOOLS_PARENT_V2",
      mode: "0755",
    },
    {
      role: "acl_clear_executable",
      fileRef: "HOST_COMPOSITION_ACL_CLEAR_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      relativeLocator: "tools/acl-clear",
      parentRef: "HOST_COMPOSITION_TOOLS_PARENT_V2",
      mode: "0755",
    },
    {
      role: "sandbox_executable",
      fileRef: "HOST_COMPOSITION_SANDBOX_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      relativeLocator: "tools/sandbox-exec",
      parentRef: "HOST_COMPOSITION_TOOLS_PARENT_V2",
      mode: "0755",
    },
    {
      role: "network_wrapper_module",
      fileRef: "HOST_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
      origin: "release_bootstrap_package",
      relativeLocator: "lib/network-wrapper.mjs",
      parentRef: "HOST_COMPOSITION_LIB_PARENT_V2",
      mode: "0444",
    },
  ] as const satisfies readonly FileRoleDefinitionV2[]);

const EXPECTED_DIRECTORY_NAMES_V2 =
  Object.freeze({
    ".": Object.freeze(["bin", "lib", "tools"]),
    bin: Object.freeze([
      "host-verifier",
      "release-bootstrap",
    ]),
    lib: Object.freeze([
      "metadata-bootstrap.mjs",
      "network-wrapper.mjs",
      "release-bootstrap.mjs",
    ]),
    tools: Object.freeze([
      "acl-clear",
      "acl-observe",
      "sandbox-exec",
      "xattr-clear",
      "xattr-observe",
    ]),
  });

type DirectoryLocatorV2 = "." | "bin" | "lib" | "tools";

const DIRECTORY_MEMBER_CAPS_V2 = Object.freeze({
  ".": 3,
  bin: 2,
  lib: 3,
  tools: 5,
} as const satisfies Readonly<Record<DirectoryLocatorV2, number>>);

type DirectoryCaptureHookContextV2 = Readonly<{
  absolutePath: string;
  relativeLocator: DirectoryLocatorV2;
}>;

type DirectoryEntryHookContextV2 =
  DirectoryCaptureHookContextV2 & Readonly<{
    name: string;
    retainedNameCount: number;
  }>;

type FileCaptureHookContextV2 = Readonly<{
  absolutePath: string;
  relativeLocator: string;
  role: FileRoleDefinitionV2["role"];
}>;

export type PlatformReleaseHostCompositionAuthorityTestHooksV2 =
  Readonly<{
    afterDirectoryEntryRead?: (
      context: DirectoryEntryHookContextV2,
    ) => void;
    afterDirectoryDescriptorClose?: (
      context: DirectoryCaptureHookContextV2,
    ) => void;
    afterFileRead?: (
      context: FileCaptureHookContextV2,
    ) => void;
    afterFileDescriptorClose?: (
      context: FileCaptureHookContextV2,
    ) => void;
  }>;

type PhysicalFingerprintV2 = Readonly<{
  device: string;
  inode: string;
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: string;
  byteLength: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;

type CapturedDirectoryV2 = Readonly<{
  relativeLocator: DirectoryLocatorV2;
  fingerprint: PhysicalFingerprintV2;
  names: readonly string[];
}>;

type CapturedFileV2 = Readonly<{
  definition: FileRoleDefinitionV2;
  absolutePath: string;
  fingerprint: PhysicalFingerprintV2;
  contentHash: string;
  parent: CapturedDirectoryV2;
}>;

type CapturedInstallationV2 = Readonly<{
  root: CapturedDirectoryV2;
  directories: readonly [
    CapturedDirectoryV2,
    CapturedDirectoryV2,
    CapturedDirectoryV2,
  ];
  files: readonly CapturedFileV2[];
  privatePhysicalStateHash: string;
}>;

type PlatformReleaseHostCompositionAuthorityStateV2 =
  Readonly<{
    admissionScope: "production_host" | "test_fixture";
    fixtureRoot: string;
    platformHost:
      PlatformReleaseHostCompositionPlatformProjectionV2;
    runtimeAccount: Readonly<{
      accountRef:
        "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2";
      uid: number;
      gid: number;
    }>;
    privateAnchors: CapturedInstallationV2;
    privatePhysicalStateHash: string;
    receipt: PlatformReleaseHostCompositionReceiptV2;
  }>;

const authorityConstructorCapabilityV2 = Object.freeze({});
const authorityStatesV2 =
  new WeakMap<
    object,
    PlatformReleaseHostCompositionAuthorityStateV2
  >();

export class PlatformReleaseHostCompositionAuthorityV2 {
  readonly receiptHash: string;
  readonly admissionScope:
    "production_host" | "test_fixture";

  constructor(
    capability: object,
    state: PlatformReleaseHostCompositionAuthorityStateV2,
  ) {
    if (capability !== authorityConstructorCapabilityV2) {
      throw new PlatformReleaseHostCompositionAuthorityErrorV2(
        "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED",
        "Host composition authority constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    this.admissionScope = state.admissionScope;
    authorityStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: PlatformReleaseHostCompositionAuthorityErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseHostCompositionAuthorityErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function modeText(stat: BigIntStats): string {
  return (Number(stat.mode & 0o7777n))
    .toString(8)
    .padStart(4, "0");
}

function fingerprint(stat: BigIntStats):
PhysicalFingerprintV2 {
  return Object.freeze({
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
    ownerUid: Number(stat.uid),
    ownerGid: Number(stat.gid),
    mode: modeText(stat),
    linkCount: stat.nlink.toString(10),
    byteLength: stat.size.toString(10),
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  });
}

function sameFingerprint(
  left: PhysicalFingerprintV2,
  right: PhysicalFingerprintV2,
): boolean {
  return canonicalJsonStringify(left)
    === canonicalJsonStringify(right);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactNames(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return actual.length === expected.length
    && actual.every((name, index) => name === expected[index]);
}

function filesystemCaptureErrorV2(
  error: unknown,
  message: string,
): PlatformReleaseHostCompositionAuthorityErrorV2 {
  return error
    instanceof PlatformReleaseHostCompositionAuthorityErrorV2
    ? error
    : new PlatformReleaseHostCompositionAuthorityErrorV2(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      message,
      { cause: error },
    );
}

function throwPrimaryFirstCaptureFailureV2(
  primaryError:
    PlatformReleaseHostCompositionAuthorityErrorV2
    | undefined,
  closeError:
    PlatformReleaseHostCompositionAuthorityErrorV2
    | undefined,
  message: string,
): void {
  if (primaryError !== undefined && closeError !== undefined) {
    const aggregate = new AggregateError(
      [primaryError, closeError],
      message,
      { cause: primaryError },
    );
    throw new PlatformReleaseHostCompositionAuthorityErrorV2(
      primaryError.code,
      message,
      { cause: aggregate },
    );
  }
  if (primaryError !== undefined) throw primaryError;
  if (closeError !== undefined) throw closeError;
}

function captureDirectoryV2(
  absolutePath: string,
  relativeLocator: DirectoryLocatorV2,
  expectedOwner?: Readonly<{ uid: number; gid: number }>,
  hooks?: PlatformReleaseHostCompositionAuthorityTestHooksV2,
): CapturedDirectoryV2 {
  let before: BigIntStats;
  try {
    before = lstatSync(absolutePath, { bigint: true });
  } catch (error) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      `Host composition ${relativeLocator} directory cannot be captured`,
      error,
    );
  }
  if (before.isSymbolicLink() || !before.isDirectory()) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      `Host composition ${relativeLocator} must be one direct directory`,
    );
  }
  if (modeText(before) !== "0700") {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      `Test host composition ${relativeLocator} directory mode must be 0700`,
    );
  }
  if (
    expectedOwner
    && (
      Number(before.uid) !== expectedOwner.uid
      || Number(before.gid) !== expectedOwner.gid
    )
  ) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      `Host composition ${relativeLocator} directory owner drifted`,
    );
  }
  const expectedNames =
    EXPECTED_DIRECTORY_NAMES_V2[relativeLocator];
  const maximumNames =
    DIRECTORY_MEMBER_CAPS_V2[relativeLocator];
  if (expectedNames.length !== maximumNames) {
    return fail(
      "HOST_COMPOSITION_AUTHORITY_INVALID",
      `Code-owned ${relativeLocator} directory member bound is inconsistent`,
    );
  }
  let directory: ReturnType<typeof opendirSync> | undefined;
  let primaryError:
    PlatformReleaseHostCompositionAuthorityErrorV2
    | undefined;
  const names: string[] = [];
  try {
    directory = opendirSync(absolutePath, { bufferSize: 1 });
    while (true) {
      const entry = directory.readSync();
      if (entry === null) break;
      hooks?.afterDirectoryEntryRead?.({
        absolutePath,
        relativeLocator,
        name: entry.name,
        retainedNameCount: names.length,
      });
      if (names.length >= maximumNames) {
        return fail(
          "HOST_COMPOSITION_FILESYSTEM_DRIFT",
          `Host composition ${relativeLocator} directory membership exceeds its admitted member bound`,
        );
      }
      names.push(entry.name);
    }
  } catch (error) {
    primaryError = filesystemCaptureErrorV2(
      error,
      `Host composition ${relativeLocator} directory membership could not be captured`,
    );
  }

  let closeError:
    PlatformReleaseHostCompositionAuthorityErrorV2
    | undefined;
  if (directory !== undefined) {
    try {
      directory.closeSync();
      hooks?.afterDirectoryDescriptorClose?.({
        absolutePath,
        relativeLocator,
      });
    } catch (error) {
      closeError = filesystemCaptureErrorV2(
        error,
        `Host composition ${relativeLocator} directory descriptor could not be closed`,
      );
    }
  }
  throwPrimaryFirstCaptureFailureV2(
    primaryError,
    closeError,
    `Host composition ${relativeLocator} directory membership capture and descriptor close both failed`,
  );

  let after: BigIntStats;
  try {
    after = lstatSync(absolutePath, { bigint: true });
  } catch (error) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      `Host composition ${relativeLocator} directory disappeared after bounded membership capture`,
      error,
    );
  }
  if (
    after.isSymbolicLink()
    || !after.isDirectory()
    || modeText(after) !== "0700"
    || (
      expectedOwner
      && (
        Number(after.uid) !== expectedOwner.uid
        || Number(after.gid) !== expectedOwner.gid
      )
    )
    || !sameFingerprint(fingerprint(before), fingerprint(after))
  ) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      `Host composition ${relativeLocator} directory changed during bounded membership capture`,
    );
  }
  names.sort();
  if (!exactNames(names, expectedNames)) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      `Host composition ${relativeLocator} directory must contain every and only code-owned member`,
    );
  }
  return Object.freeze({
    relativeLocator,
    fingerprint: fingerprint(after),
    names: Object.freeze(names),
  });
}

function captureFileV2(
  root: string,
  definition: FileRoleDefinitionV2,
  parent: CapturedDirectoryV2,
  expectedOwner: Readonly<{ uid: number; gid: number }>,
  hooks?: PlatformReleaseHostCompositionAuthorityTestHooksV2,
): CapturedFileV2 {
  const absolutePath = path.join(
    root,
    definition.relativeLocator,
  );
  if (
    !absolutePath.startsWith(`${root}${path.sep}`)
    || path.relative(root, absolutePath)
      !== definition.relativeLocator
  ) {
    return fail(
      "HOST_COMPOSITION_AUTHORITY_INVALID",
      "Code-owned host composition locator escaped its installation",
    );
  }
  let descriptor: number | undefined;
  let captured: CapturedFileV2 | undefined;
  let primaryError:
    PlatformReleaseHostCompositionAuthorityErrorV2
    | undefined;
  try {
    const parentPath = path.dirname(absolutePath);
    const parentBefore = lstatSync(parentPath, {
      bigint: true,
    });
    if (
      !sameFingerprint(
        parent.fingerprint,
        fingerprint(parentBefore),
      )
    ) {
      return fail(
        "HOST_COMPOSITION_FILESYSTEM_DRIFT",
        `${definition.role} parent changed before file capture`,
      );
    }
    const pathBefore = lstatSync(absolutePath, {
      bigint: true,
    });
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1n
      || modeText(pathBefore) !== definition.mode
      || Number(pathBefore.uid) !== expectedOwner.uid
      || Number(pathBefore.gid) !== expectedOwner.gid
      || pathBefore.size <= 0n
      || pathBefore.size
        > BigInt(
          PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
        )
    ) {
      return fail(
        "HOST_COMPOSITION_FILESYSTEM_DRIFT",
        `${definition.role} violates its exact type, owner, mode, link or byte contract`,
      );
    }
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const descriptorBefore = fstatSync(descriptor, {
      bigint: true,
    });
    if (
      !sameFingerprint(
        fingerprint(pathBefore),
        fingerprint(descriptorBefore),
      )
    ) {
      return fail(
        "HOST_COMPOSITION_FILESYSTEM_DRIFT",
        `${definition.role} changed before descriptor admission`,
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const bytesRead = readSync(
        descriptor,
        buffer,
        0,
        buffer.length,
        null,
      );
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (
        byteLength
          > PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2
      ) {
        buffer.fill(0);
        return fail(
          "HOST_COMPOSITION_FILESYSTEM_DRIFT",
          `${definition.role} exceeded its descriptor read bound`,
        );
      }
      hash.update(buffer.subarray(0, bytesRead));
    }
    buffer.fill(0);
    hooks?.afterFileRead?.({
      absolutePath,
      relativeLocator: definition.relativeLocator,
      role: definition.role,
    });
    const descriptorAfter = fstatSync(descriptor, {
      bigint: true,
    });
    const pathAfter = lstatSync(absolutePath, {
      bigint: true,
    });
    const parentAfter = lstatSync(parentPath, {
      bigint: true,
    });
    if (
      byteLength !== Number(descriptorAfter.size)
      || !sameFingerprint(
        fingerprint(descriptorBefore),
        fingerprint(descriptorAfter),
      )
      || !sameFingerprint(
        fingerprint(descriptorAfter),
        fingerprint(pathAfter),
      )
      || !sameFingerprint(
        parent.fingerprint,
        fingerprint(parentAfter),
      )
    ) {
      return fail(
        "HOST_COMPOSITION_FILESYSTEM_DRIFT",
        `${definition.role} or its parent changed during descriptor admission`,
      );
    }
    captured = Object.freeze({
      definition,
      absolutePath,
      fingerprint: fingerprint(descriptorAfter),
      contentHash: hash.digest("hex"),
      parent,
    });
  } catch (error) {
    primaryError = filesystemCaptureErrorV2(
      error,
      `${definition.role} could not be captured exactly`,
    );
  }

  let closeError:
    PlatformReleaseHostCompositionAuthorityErrorV2
    | undefined;
  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
      hooks?.afterFileDescriptorClose?.({
        absolutePath,
        relativeLocator: definition.relativeLocator,
        role: definition.role,
      });
    } catch (error) {
      closeError = filesystemCaptureErrorV2(
        error,
        `${definition.role} file descriptor could not be closed`,
      );
    }
  }
  throwPrimaryFirstCaptureFailureV2(
    primaryError,
    closeError,
    `${definition.role} capture and descriptor close both failed`,
  );
  return captured!;
}

function captureInstallationV2(
  fixtureRoot: string,
  hooks?: PlatformReleaseHostCompositionAuthorityTestHooksV2,
): CapturedInstallationV2 {
  let resolved: string;
  try {
    resolved = realpathSync(fixtureRoot);
  } catch (error) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      "Test host composition installation cannot be resolved",
      error,
    );
  }
  if (
    !path.isAbsolute(fixtureRoot)
    || resolved !== fixtureRoot
  ) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      "Test host composition installation must be one direct absolute real path",
    );
  }
  const rootBefore = captureDirectoryV2(
    fixtureRoot,
    ".",
    undefined,
    hooks,
  );
  const owner = Object.freeze({
    uid: rootBefore.fingerprint.ownerUid,
    gid: rootBefore.fingerprint.ownerGid,
  });
  const directories = Object.freeze([
    captureDirectoryV2(
      path.join(fixtureRoot, "bin"),
      "bin",
      owner,
      hooks,
    ),
    captureDirectoryV2(
      path.join(fixtureRoot, "lib"),
      "lib",
      owner,
      hooks,
    ),
    captureDirectoryV2(
      path.join(fixtureRoot, "tools"),
      "tools",
      owner,
      hooks,
    ),
  ] as const);
  const byLocator = new Map(
    directories.map(
      (directory) => [
        directory.relativeLocator,
        directory,
      ] as const,
    ),
  );
  const files = Object.freeze(
    FILE_ROLE_DEFINITIONS_V2.map((definition) => {
      const parentLocator =
        path.dirname(definition.relativeLocator) as
          "bin" | "lib" | "tools";
      const parent = byLocator.get(parentLocator);
      if (!parent) {
        return fail(
          "HOST_COMPOSITION_AUTHORITY_INVALID",
          "Code-owned host composition role has no parent",
        );
      }
      return captureFileV2(
        fixtureRoot,
        definition,
        parent,
        owner,
        hooks,
      );
    }),
  );
  const rootAfter = captureDirectoryV2(
    fixtureRoot,
    ".",
    owner,
    hooks,
  );
  const directoriesAfter = Object.freeze([
    captureDirectoryV2(
      path.join(fixtureRoot, "bin"),
      "bin",
      owner,
      hooks,
    ),
    captureDirectoryV2(
      path.join(fixtureRoot, "lib"),
      "lib",
      owner,
      hooks,
    ),
    captureDirectoryV2(
      path.join(fixtureRoot, "tools"),
      "tools",
      owner,
      hooks,
    ),
  ] as const);
  let finalRealpath: string;
  try {
    finalRealpath = realpathSync(fixtureRoot);
  } catch (error) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      "Test host composition installation disappeared after capture",
      error,
    );
  }
  if (
    finalRealpath !== fixtureRoot
    || !sameFingerprint(
      rootBefore.fingerprint,
      rootAfter.fingerprint,
    )
    || directories.some(
      (directory, index) => {
        const after = directoriesAfter[index];
        return !after
          || !sameFingerprint(
            directory.fingerprint,
            after.fingerprint,
          )
          || !exactNames(directory.names, after.names);
      },
    )
  ) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      "Test host composition installation changed during its full census",
    );
  }
  const privatePhysicalStateHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-private-physical-state-hash.v2",
    fixtureRootHash: sha256(fixtureRoot),
    root: rootAfter,
    directories: directoriesAfter,
    files: files.map((file) => ({
      relativeLocatorHash:
        sha256(file.definition.relativeLocator),
      fingerprint: file.fingerprint,
      contentHash: file.contentHash,
      parent: file.parent,
    })),
  });
  return Object.freeze({
    root: rootAfter,
    directories: directoriesAfter,
    files,
    privatePhysicalStateHash,
  });
}

function parentReceiptV2(
  directory: CapturedDirectoryV2,
  parentRef: FileRoleDefinitionV2["parentRef"],
) {
  const identity = {
    parentRef,
    device: directory.fingerprint.device,
    inode: directory.fingerprint.inode,
    ownerUid: directory.fingerprint.ownerUid,
    ownerGid: directory.fingerprint.ownerGid,
    mode: directory.fingerprint.mode as
      "0555" | "0700" | "0755",
    linkCount: directory.fingerprint.linkCount,
    byteLength: directory.fingerprint.byteLength,
    modifiedTimeNanoseconds:
      directory.fingerprint.modifiedTimeNanoseconds,
    changedTimeNanoseconds:
      directory.fingerprint.changedTimeNanoseconds,
  };
  return {
    ...identity,
    identityHash:
      hashPlatformReleaseHostCompositionParentIdentityV2(
        identity,
      ),
  };
}

function filePhysicalIdentityV2(
  captured: CapturedFileV2,
  hostIdentityHash: string,
) {
  return {
    role: captured.definition.role,
    fileRef: captured.definition.fileRef,
    origin: captured.definition.origin,
    hostIdentityHash,
    contentHash: captured.contentHash,
    byteLength: Number(captured.fingerprint.byteLength),
    ownerUid: captured.fingerprint.ownerUid,
    ownerGid: captured.fingerprint.ownerGid,
    mode: captured.definition.mode,
    linkCount: 1 as const,
    device: captured.fingerprint.device,
    inode: captured.fingerprint.inode,
    modifiedTimeNanoseconds:
      captured.fingerprint.modifiedTimeNanoseconds,
    changedTimeNanoseconds:
      captured.fingerprint.changedTimeNanoseconds,
    parent: parentReceiptV2(
      captured.parent,
      captured.definition.parentRef,
    ),
  };
}

function buildFileReceiptsV2(
  captured: CapturedInstallationV2,
  hostIdentityHash: string,
) {
  const requirement =
    getPlatformReleaseHostCompositionRequirementV2();
  const physicalIdentities =
    captured.files.map(
      (file) =>
        filePhysicalIdentityV2(file, hostIdentityHash),
    );
  const physicalIdentityHashes = physicalIdentities.map(
    (identity) =>
      hashPlatformReleaseHostCompositionFilePhysicalIdentityV2(
        identity,
      ),
  );
  const verifierPhysicalIdentityHash =
    physicalIdentityHashes[2];
  if (!verifierPhysicalIdentityHash) {
    return fail(
      "HOST_COMPOSITION_AUTHORITY_INVALID",
      "Code-owned host verifier role is unavailable",
    );
  }
  const verifierIdentityHash =
    hashPlatformReleaseHostCompositionVerifierIdentityV2({
      verifierPhysicalIdentityHash,
      verifierAbiHash:
        requirement.operationBindings.verifierAbiHash,
    });
  const files = physicalIdentities.map((identity, index) => {
    const physicalIdentityHash =
      physicalIdentityHashes[index];
    if (!physicalIdentityHash) {
      return fail(
        "HOST_COMPOSITION_AUTHORITY_INVALID",
        "Code-owned physical file identity is unavailable",
      );
    }
    const receiptIdentity = {
      schema:
        PLATFORM_RELEASE_HOST_COMPOSITION_FILE_RECEIPT_V2_SCHEMA,
      receiptVersion:
        PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      ...identity,
      physicalIdentityHash,
      verifierIdentityHash,
      verifierBindingHash:
        hashPlatformReleaseHostCompositionVerifierBindingV2({
          verifierIdentityHash,
          filePhysicalIdentityHash: physicalIdentityHash,
          requirementHash: requirement.requirementHash,
        }),
    };
    const parsed =
      PlatformReleaseHostCompositionFileReceiptV2Schema
        .safeParse({
          ...receiptIdentity,
          receiptHash:
            hashPlatformReleaseHostCompositionFileReceiptV2(
              receiptIdentity,
            ),
        });
    if (!parsed.success) {
      return fail(
        "HOST_COMPOSITION_RECEIPT_INVALID",
        "Host composition file failed its strict receipt schema",
        parsed.error,
      );
    }
    return deepFreezePlatformReleaseJsonV2(parsed.data);
  });
  return Object.freeze({
    verifierIdentityHash,
    files: Object.freeze(files) as readonly [
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
      PlatformReleaseHostCompositionFileReceiptV2,
    ],
  });
}

function buildReceiptV2(input: Readonly<{
  platformHost:
    PlatformReleaseHostCompositionPlatformProjectionV2;
  runtimeAccount: Readonly<{
    accountRef:
      "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2";
    uid: number;
    gid: number;
  }>;
  captured: CapturedInstallationV2;
}>): PlatformReleaseHostCompositionReceiptV2 {
  const fileSet = buildFileReceiptsV2(
    input.captured,
    input.platformHost.hostIdentityHash,
  );
  if (
    input.runtimeAccount.uid <= 0
    || !Number.isInteger(input.runtimeAccount.uid)
    || !Number.isInteger(input.runtimeAccount.gid)
    || input.runtimeAccount.gid <= 0
    || input.runtimeAccount.uid
      > 4_294_967_294
    || input.runtimeAccount.gid
      > 4_294_967_294
    || fileSet.files.some(
      (file) =>
        file.ownerUid === input.runtimeAccount.uid
        || file.ownerGid === input.runtimeAccount.gid,
    )
  ) {
    return fail(
      "HOST_COMPOSITION_INPUT_INVALID",
      "Test runtime account must be bounded, unprivileged and distinct from every fixture file owner",
    );
  }
  const runtimeIdentity = {
    schema:
      PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA,
    receiptVersion:
      PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    accountRef: input.runtimeAccount.accountRef,
    authorityState:
      "test_fixture_identity_unverified" as const,
    uid: input.runtimeAccount.uid,
    gid: input.runtimeAccount.gid,
    ownerSeparationPolicy:
      "uid_gid_nonzero_and_distinct_from_every_host_file_owner_v2" as const,
    hostIdentityHash: input.platformHost.hostIdentityHash,
  };
  const runtimeParsed =
    PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema
      .safeParse({
        ...runtimeIdentity,
        receiptHash:
          hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2(
            runtimeIdentity,
          ),
      });
  if (!runtimeParsed.success) {
    return fail(
      "HOST_COMPOSITION_RECEIPT_INVALID",
      "Test runtime account failed its strict receipt schema",
      runtimeParsed.error,
    );
  }
  const totalBytes = fileSet.files.reduce(
    (total, file) => total + file.byteLength,
    0,
  );
  const installationIdentity = {
    schema:
      PLATFORM_RELEASE_HOST_COMPOSITION_INSTALLATION_RECEIPT_V2_SCHEMA,
    receiptVersion:
      PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    filesystemProtection: "test_fixture_only" as const,
    device: input.captured.root.fingerprint.device,
    inode: input.captured.root.fingerprint.inode,
    ownerUid: input.captured.root.fingerprint.ownerUid,
    ownerGid: input.captured.root.fingerprint.ownerGid,
    mode: input.captured.root.fingerprint.mode as "0700",
    linkCount: input.captured.root.fingerprint.linkCount,
    byteLength: input.captured.root.fingerprint.byteLength,
    modifiedTimeNanoseconds:
      input.captured.root.fingerprint.modifiedTimeNanoseconds,
    changedTimeNanoseconds:
      input.captured.root.fingerprint.changedTimeNanoseconds,
    directoryCount: 3 as const,
    fileCount: 10 as const,
    totalBytes,
    fileSetMembershipHash:
      hashPlatformReleaseHostCompositionFileSetMembershipV2(
        fileSet.files,
      ),
  };
  const installationParsed =
    PlatformReleaseHostCompositionInstallationReceiptV2Schema
      .safeParse({
        ...installationIdentity,
        receiptHash:
          hashPlatformReleaseHostCompositionInstallationReceiptV2(
            installationIdentity,
          ),
      });
  if (!installationParsed.success) {
    return fail(
      "HOST_COMPOSITION_RECEIPT_INVALID",
      "Test host composition installation failed its strict receipt schema",
      installationParsed.error,
    );
  }
  const receiptIdentity = {
    schema:
      PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_V2_SCHEMA,
    receiptVersion:
      PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityRef:
      PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_REF_V2,
    authorityVersion:
      PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_VERSION_V2,
    status: "verified" as const,
    authorityState:
      "fresh_exact_physical_admission" as const,
    admissionScope: "test_fixture" as const,
    productionUse: "forbidden_test_fixture" as const,
    requirement:
      getPlatformReleaseHostCompositionRequirementV2(),
    platformHost:
      deepFreezePlatformReleaseJsonV2(
        structuredClone(input.platformHost),
      ),
    runtimeAccount:
      deepFreezePlatformReleaseJsonV2(runtimeParsed.data),
    installation:
      deepFreezePlatformReleaseJsonV2(
        installationParsed.data,
      ),
    verifierIdentityHash: fileSet.verifierIdentityHash,
    files: fileSet.files,
    fileCount: 10 as const,
    physicalClosureHash:
      hashPlatformReleaseHostCompositionPhysicalClosureV2(
        fileSet.files,
      ),
  };
  const parsed =
    PlatformReleaseHostCompositionReceiptV2Schema.safeParse({
      ...receiptIdentity,
      receiptHash:
        hashPlatformReleaseHostCompositionReceiptV2(
          receiptIdentity,
        ),
    });
  if (!parsed.success) {
    return fail(
      "HOST_COMPOSITION_RECEIPT_INVALID",
      "Host composition authority failed its strict aggregate receipt schema",
      parsed.error,
    );
  }
  return deepFreezePlatformReleaseJsonV2(parsed.data);
}

function snapshotPlainJsonV2(
  input: unknown,
): unknown {
  const visited = new WeakSet<object>();
  let nodeCount = 0;
  const visit = (value: unknown, depth: number): unknown => {
    if (
      value === null
      || typeof value === "boolean"
      || (
        typeof value === "number"
        && Number.isFinite(value)
      )
      || (
        typeof value === "string"
        && value.length <= 4_096
      )
    ) {
      return value;
    }
    if (
      typeof value !== "object"
      || value === null
      || isProxy(value)
      || depth > 12
      || visited.has(value)
      || ++nodeCount > 256
    ) {
      return fail(
        "HOST_COMPOSITION_INPUT_INVALID",
        "Host composition input must be bounded acyclic plain data",
      );
    }
    visited.add(value);
    if (Array.isArray(value)) {
      const descriptors =
        Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(value);
      if (
        keys.some(
          (key) =>
            key !== "length"
            && (
              typeof key !== "string"
              || !/^(?:0|[1-9][0-9]*)$/u.test(key)
            ),
        )
        || value.length > 64
      ) {
        return fail(
          "HOST_COMPOSITION_INPUT_INVALID",
          "Host composition arrays must be dense and bounded",
        );
      }
      return Array.from(
        { length: value.length },
        (_, index) => {
          const descriptor = descriptors[String(index)];
          if (
            !descriptor
            || !("value" in descriptor)
            || descriptor.enumerable !== true
          ) {
            return fail(
              "HOST_COMPOSITION_INPUT_INVALID",
              "Host composition arrays cannot contain holes or accessors",
            );
          }
          return visit(descriptor.value, depth + 1);
        },
      );
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return fail(
        "HOST_COMPOSITION_INPUT_INVALID",
        "Host composition input must use plain objects",
      );
    }
    const descriptors =
      Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (
      keys.length > 64
      || keys.some((key) => typeof key !== "string")
    ) {
      return fail(
        "HOST_COMPOSITION_INPUT_INVALID",
        "Host composition object keys must be bounded strings",
      );
    }
    const output: Record<string, unknown> = {};
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (
        !descriptor
        || !("value" in descriptor)
        || descriptor.enumerable !== true
      ) {
        return fail(
          "HOST_COMPOSITION_INPUT_INVALID",
          "Host composition input cannot contain accessors or hidden values",
        );
      }
      output[key] = visit(descriptor.value, depth + 1);
    }
    return output;
  };
  return visit(input, 0);
}

function parseTestInputV2(
  input: unknown,
): Readonly<{
  platformHost:
    PlatformReleaseHostCompositionPlatformProjectionV2;
  fixture: PlatformReleaseHostCompositionFixtureV2;
}> {
  const snapshot = snapshotPlainJsonV2(input);
  if (
    typeof snapshot !== "object"
    || snapshot === null
    || Array.isArray(snapshot)
    || Reflect.ownKeys(snapshot).length !== 2
    || Reflect.ownKeys(snapshot).some(
      (key) =>
        typeof key !== "string"
        || !["platformHost", "fixture"].includes(key),
    )
  ) {
    return fail(
      "HOST_COMPOSITION_INPUT_INVALID",
      "Test host composition input must contain exact platformHost and fixture fields",
    );
  }
  const record = snapshot as Record<string, unknown>;
  const platformHost =
    PlatformReleaseHostCompositionPlatformProjectionV2Schema
      .safeParse(record.platformHost);
  if (!platformHost.success) {
    return fail(
      "HOST_COMPOSITION_INPUT_INVALID",
      "Test host composition platform projection is invalid",
      platformHost.error,
    );
  }
  const fixture = record.fixture;
  if (
    typeof fixture !== "object"
    || fixture === null
    || Array.isArray(fixture)
    || Reflect.ownKeys(fixture).length !== 2
    || Reflect.ownKeys(fixture).some(
      (key) =>
        typeof key !== "string"
        || !["fixtureRoot", "runtimeAccount"].includes(key),
    )
  ) {
    return fail(
      "HOST_COMPOSITION_INPUT_INVALID",
      "Test host composition fixture must contain exact fixtureRoot and runtimeAccount fields",
    );
  }
  const fixtureRecord = fixture as Record<string, unknown>;
  const runtimeAccount = fixtureRecord.runtimeAccount;
  if (
    typeof fixtureRecord.fixtureRoot !== "string"
    || typeof runtimeAccount !== "object"
    || runtimeAccount === null
    || Array.isArray(runtimeAccount)
    || Reflect.ownKeys(runtimeAccount).length !== 3
    || Reflect.ownKeys(runtimeAccount).some(
      (key) =>
        typeof key !== "string"
        || !["accountRef", "uid", "gid"].includes(key),
    )
  ) {
    return fail(
      "HOST_COMPOSITION_INPUT_INVALID",
      "Test host composition runtime account must be one exact fixture identity",
    );
  }
  const account =
    runtimeAccount as Record<string, unknown>;
  if (
    account.accountRef
      !== "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2"
    || !Number.isInteger(account.uid)
    || !Number.isInteger(account.gid)
  ) {
    return fail(
      "HOST_COMPOSITION_INPUT_INVALID",
      "Test host composition runtime account fields are invalid",
    );
  }
  return Object.freeze({
    platformHost:
      deepFreezePlatformReleaseJsonV2(platformHost.data),
    fixture: Object.freeze({
      fixtureRoot: fixtureRecord.fixtureRoot,
      runtimeAccount: Object.freeze({
        accountRef:
          "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2",
        uid: account.uid as number,
        gid: account.gid as number,
      }),
    }),
  });
}

function authenticStateV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
): PlatformReleaseHostCompositionAuthorityStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PlatformReleaseHostCompositionAuthorityV2.prototype
  ) {
    return fail(
      "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED",
      "Host composition operation requires one authentic capability",
    );
  }
  const state = authorityStatesV2.get(handle);
  if (!state) {
    return fail(
      "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED",
      "Host composition operation requires one authentic capability",
    );
  }
  return state;
}

export async function openPlatformReleaseHostCompositionAuthorityV2Internal(
): Promise<PlatformReleaseHostCompositionAuthorityV2> {
  return fail(
    "HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE",
    "Fixed-root release composition bootstrap, installed verifier and durable runtime-account authority are unavailable",
  );
}

export async function createPlatformReleaseHostCompositionAuthorityV2ForTest(
  input: unknown,
  hooks:
    PlatformReleaseHostCompositionAuthorityTestHooksV2
    | undefined = undefined,
): Promise<PlatformReleaseHostCompositionAuthorityV2> {
  const parsed = parseTestInputV2(input);
  const first = captureInstallationV2(
    parsed.fixture.fixtureRoot,
    hooks,
  );
  const firstReceipt = buildReceiptV2({
    platformHost: parsed.platformHost,
    runtimeAccount: parsed.fixture.runtimeAccount,
    captured: first,
  });
  const second = captureInstallationV2(
    parsed.fixture.fixtureRoot,
    hooks,
  );
  const secondReceipt = buildReceiptV2({
    platformHost: parsed.platformHost,
    runtimeAccount: parsed.fixture.runtimeAccount,
    captured: second,
  });
  if (
    first.privatePhysicalStateHash
      !== second.privatePhysicalStateHash
    || canonicalJsonStringify(firstReceipt)
      !== canonicalJsonStringify(secondReceipt)
  ) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      "Test host composition installation changed across independent admission captures",
    );
  }
  const state = Object.freeze({
    admissionScope: "test_fixture" as const,
    fixtureRoot: parsed.fixture.fixtureRoot,
    platformHost: parsed.platformHost,
    runtimeAccount: parsed.fixture.runtimeAccount,
    privateAnchors: second,
    privatePhysicalStateHash:
      second.privatePhysicalStateHash,
    receipt: secondReceipt,
  });
  return new PlatformReleaseHostCompositionAuthorityV2(
    authorityConstructorCapabilityV2,
    state,
  );
}

export function inspectPlatformReleaseHostCompositionReceiptV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
): PlatformReleaseHostCompositionReceiptV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(authenticStateV2(handle).receipt),
  );
}

export type PlatformReleaseHostCompositionModuleExportLaunchContextInternalV2 =
  Readonly<{
    admissionScope: "production_host" | "test_fixture";
    hostIdentityHash: string;
    hostCompositionReceiptHash: string;
    releaseBootstrapExecutablePath: string;
    releaseBootstrapExecutableContentHash: string;
    releaseBootstrapExecutablePhysicalIdentityHash: string;
    releaseBootstrapModulePath: string;
    releaseBootstrapModuleContentHash: string;
    releaseBootstrapModulePhysicalIdentityHash: string;
  }>;

export type PlatformReleaseHostCompositionTargetOperationAbiRefInternalV2 =
  | "ABI_PLATFORM_RELEASE_HOST_OPERATION_V2"
  | "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2"
  | "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2"
  | "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2";

export type PlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2 =
  Readonly<{
    admissionScope: "production_host" | "test_fixture";
    hostIdentityHash: string;
    hostCompositionReceiptHash: string;
    operationAbiRef:
      PlatformReleaseHostCompositionTargetOperationAbiRefInternalV2;
    releaseBootstrapExecutablePath: string;
    releaseBootstrapExecutableContentHash: string;
    releaseBootstrapExecutablePhysicalIdentityHash: string;
    implementationMemberRef:
      | "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2"
      | "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2"
      | "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2";
    implementationPath: string;
    implementationContentHash: string;
    implementationPhysicalIdentityHash: string;
  }>;

export type PlatformReleaseHostCompositionMetadataOperationLaunchContextInternalV2 =
  PlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2 &
  Readonly<{
    admissionScope: "test_fixture";
    operationAbiRef:
      "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2";
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2";
    xattrObserverExecutablePath: string;
    xattrObserverExecutableContentHash: string;
    xattrObserverExecutablePhysicalIdentityHash: string;
    aclObserverExecutablePath: string;
    aclObserverExecutableContentHash: string;
    aclObserverExecutablePhysicalIdentityHash: string;
  }>;

export type PlatformReleaseHostCompositionNetworkNegativeOperationLaunchContextInternalV2 =
  PlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2 &
  Readonly<{
    admissionScope: "test_fixture";
    operationAbiRef:
      "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2";
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2";
    sandboxPolicyHash:
      typeof PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2;
    sandboxExecutablePath: string;
    sandboxExecutableContentHash: string;
    sandboxExecutablePhysicalIdentityHash: string;
  }>;

const TARGET_OPERATION_IMPLEMENTATION_BINDINGS_V2 = Object.freeze({
  ABI_PLATFORM_RELEASE_HOST_OPERATION_V2: Object.freeze({
    role: "release_bootstrap_module" as const,
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2" as const,
    admissionScopes: Object.freeze([
      "production_host",
      "test_fixture",
    ] as const),
  }),
  ABI_PLATFORM_RELEASE_METADATA_PROBE_V2: Object.freeze({
    role: "metadata_bootstrap_module" as const,
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2" as const,
    admissionScopes: Object.freeze([
      "test_fixture",
    ] as const),
  }),
  ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2: Object.freeze({
    role: "release_bootstrap_module" as const,
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2" as const,
    admissionScopes: Object.freeze([
      "production_host",
      "test_fixture",
    ] as const),
  }),
  ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2: Object.freeze({
    role: "network_wrapper_module" as const,
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2" as const,
    admissionScopes: Object.freeze([
      "test_fixture",
    ] as const),
  }),
});

/**
 * @internal
 *
 * Resolves one of the four target-bound installed operations only after a
 * complete fresh composition census. It returns no target path and grants no
 * process or mutation authority.
 */
export async function acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
  operationAbiRef:
    PlatformReleaseHostCompositionTargetOperationAbiRefInternalV2,
): Promise<PlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2> {
  const state = authenticStateV2(handle);
  if (
    !Object.hasOwn(
      TARGET_OPERATION_IMPLEMENTATION_BINDINGS_V2,
      operationAbiRef,
    )
  ) {
    return fail(
      "HOST_COMPOSITION_INPUT_INVALID",
      "Target operation ABI is not owned by the installed release composition",
    );
  }
  const binding =
    TARGET_OPERATION_IMPLEMENTATION_BINDINGS_V2[
      operationAbiRef
    ];
  if (
    binding.admissionScopes.every(
      (scope) => scope !== state.admissionScope,
    )
  ) {
    return fail(
      "HOST_COMPOSITION_SCOPE_MISMATCH",
      "Target operation ABI is forbidden for this composition admission scope",
    );
  }
  const receipt =
    await revalidatePlatformReleaseHostCompositionAuthorityV2(
      handle,
    );
  const executable = state.privateAnchors.files.find(
    (file) =>
      file.definition.role
        === "release_bootstrap_executable",
  );
  const implementation = state.privateAnchors.files.find(
    (file) => file.definition.role === binding.role,
  );
  const executableReceipt = receipt.files.find(
    (file) => file.role === "release_bootstrap_executable",
  );
  const implementationReceipt = receipt.files.find(
    (file) => file.role === binding.role,
  );
  if (
    !executable
    || !implementation
    || !executableReceipt
    || !implementationReceipt
    || executable.contentHash
      !== executableReceipt.contentHash
    || implementation.contentHash
      !== implementationReceipt.contentHash
    || receipt.receiptHash !== state.receipt.receiptHash
  ) {
    return fail(
      "HOST_COMPOSITION_AUTHORITY_INVALID",
      "Target operation cannot bind its exact admitted executable and implementation",
    );
  }
  return Object.freeze({
    admissionScope: state.admissionScope,
    hostIdentityHash:
      receipt.platformHost.hostIdentityHash,
    hostCompositionReceiptHash: receipt.receiptHash,
    operationAbiRef,
    releaseBootstrapExecutablePath:
      executable.absolutePath,
    releaseBootstrapExecutableContentHash:
      executable.contentHash,
    releaseBootstrapExecutablePhysicalIdentityHash:
      executableReceipt.physicalIdentityHash,
    implementationMemberRef:
      binding.implementationMemberRef,
    implementationPath: implementation.absolutePath,
    implementationContentHash: implementation.contentHash,
    implementationPhysicalIdentityHash:
      implementationReceipt.physicalIdentityHash,
  });
}

/**
 * @internal
 *
 * Extends the target-bound metadata module context with only its two
 * read-only observer roles. Clear-role locators are deliberately not exposed:
 * this bridge grants neither metadata mutation nor production authority.
 */
export async function acquirePlatformReleaseHostCompositionMetadataOperationLaunchContextInternalV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
): Promise<PlatformReleaseHostCompositionMetadataOperationLaunchContextInternalV2> {
  const state = authenticStateV2(handle);
  const targetContext =
    await acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
      handle,
      "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2",
    );
  const receipt =
    await revalidatePlatformReleaseHostCompositionAuthorityV2(
      handle,
    );
  const observerRoles = [
    "xattr_observer_executable",
    "acl_observer_executable",
  ] as const;
  const observers = observerRoles.map((role) => {
    const anchor = state.privateAnchors.files.find(
      (file) => file.definition.role === role,
    );
    const fileReceipt = receipt.files.find(
      (file) => file.role === role,
    );
    if (
      !anchor
      || !fileReceipt
      || anchor.contentHash !== fileReceipt.contentHash
    ) {
      return fail(
        "HOST_COMPOSITION_AUTHORITY_INVALID",
        "Metadata operation cannot bind its exact read-only observer roles",
      );
    }
    return Object.freeze({
      absolutePath: anchor.absolutePath,
      contentHash: anchor.contentHash,
      physicalIdentityHash: fileReceipt.physicalIdentityHash,
    });
  });
  if (
    targetContext.operationAbiRef
      !== "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2"
    || targetContext.admissionScope !== "test_fixture"
    || targetContext.implementationMemberRef
      !== "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2"
    || targetContext.hostCompositionReceiptHash
      !== receipt.receiptHash
    || receipt.receiptHash !== state.receipt.receiptHash
  ) {
    return fail(
      "HOST_COMPOSITION_AUTHORITY_INVALID",
      "Metadata operation observer roles detached from its fresh target-operation census",
    );
  }
  const [xattrObserver, aclObserver] = observers;
  if (!xattrObserver || !aclObserver) {
    return fail(
      "HOST_COMPOSITION_AUTHORITY_INVALID",
      "Metadata operation read-only observer role set is incomplete",
    );
  }
  return Object.freeze({
    ...targetContext,
    admissionScope: "test_fixture" as const,
    operationAbiRef:
      "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2" as const,
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2" as const,
    xattrObserverExecutablePath:
      xattrObserver.absolutePath,
    xattrObserverExecutableContentHash:
      xattrObserver.contentHash,
    xattrObserverExecutablePhysicalIdentityHash:
      xattrObserver.physicalIdentityHash,
    aclObserverExecutablePath:
      aclObserver.absolutePath,
    aclObserverExecutableContentHash:
      aclObserver.contentHash,
    aclObserverExecutablePhysicalIdentityHash:
      aclObserver.physicalIdentityHash,
  });
}

/**
 * @internal
 *
 * Extends the target-bound network-wrapper context with the exact installed
 * sandbox executable. This characterization bridge is deliberately test-only;
 * production must obtain a verified-release owner in a later authority slice.
 */
export async function acquirePlatformReleaseHostCompositionNetworkNegativeOperationLaunchContextInternalV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
): Promise<PlatformReleaseHostCompositionNetworkNegativeOperationLaunchContextInternalV2> {
  const state = authenticStateV2(handle);
  const targetContext =
    await acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
      handle,
      "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
    );
  const receipt =
    await revalidatePlatformReleaseHostCompositionAuthorityV2(
      handle,
    );
  const sandboxAnchor = state.privateAnchors.files.find(
    (file) => file.definition.role === "sandbox_executable",
  );
  const sandboxReceipt = receipt.files.find(
    (file) => file.role === "sandbox_executable",
  );
  if (
    targetContext.admissionScope !== "test_fixture"
    || targetContext.operationAbiRef
      !== "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2"
    || targetContext.implementationMemberRef
      !== "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2"
    || targetContext.hostCompositionReceiptHash
      !== receipt.receiptHash
    || receipt.receiptHash !== state.receipt.receiptHash
    || !sandboxAnchor
    || !sandboxReceipt
    || sandboxAnchor.contentHash !== sandboxReceipt.contentHash
  ) {
    return fail(
      "HOST_COMPOSITION_AUTHORITY_INVALID",
      "Network-negative operation detached from its wrapper, sandbox role or test scope",
    );
  }
  return Object.freeze({
    ...targetContext,
    admissionScope: "test_fixture" as const,
    operationAbiRef:
      "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2" as const,
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2" as const,
    sandboxPolicyHash:
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
    sandboxExecutablePath: sandboxAnchor.absolutePath,
    sandboxExecutableContentHash: sandboxAnchor.contentHash,
    sandboxExecutablePhysicalIdentityHash:
      sandboxReceipt.physicalIdentityHash,
  });
}

/**
 * @internal
 *
 * Returns private installed locators only after a complete fresh composition
 * census. The immediate process owner must use them with the authenticated
 * host Node runtime and revalidate this authority after process settlement.
 */
export async function acquirePlatformReleaseHostCompositionModuleExportLaunchContextInternalV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
): Promise<PlatformReleaseHostCompositionModuleExportLaunchContextInternalV2> {
  const context =
    await acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
      handle,
      "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2",
    );
  return Object.freeze({
    admissionScope: context.admissionScope,
    hostIdentityHash: context.hostIdentityHash,
    hostCompositionReceiptHash:
      context.hostCompositionReceiptHash,
    releaseBootstrapExecutablePath:
      context.releaseBootstrapExecutablePath,
    releaseBootstrapExecutableContentHash:
      context.releaseBootstrapExecutableContentHash,
    releaseBootstrapExecutablePhysicalIdentityHash:
      context.releaseBootstrapExecutablePhysicalIdentityHash,
    releaseBootstrapModulePath:
      context.implementationPath,
    releaseBootstrapModuleContentHash:
      context.implementationContentHash,
    releaseBootstrapModulePhysicalIdentityHash:
      context.implementationPhysicalIdentityHash,
  });
}

export function isProductionPlatformReleaseHostCompositionAuthorityV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
): boolean {
  return authenticStateV2(handle).admissionScope
    === "production_host";
}

export async function revalidatePlatformReleaseHostCompositionAuthorityV2(
  handle: PlatformReleaseHostCompositionAuthorityV2,
): Promise<PlatformReleaseHostCompositionReceiptV2> {
  const state = authenticStateV2(handle);
  const first = captureInstallationV2(state.fixtureRoot);
  const firstReceipt = buildReceiptV2({
    platformHost: state.platformHost,
    runtimeAccount: state.runtimeAccount,
    captured: first,
  });
  const second = captureInstallationV2(state.fixtureRoot);
  const secondReceipt = buildReceiptV2({
    platformHost: state.platformHost,
    runtimeAccount: state.runtimeAccount,
    captured: second,
  });
  if (
    first.privatePhysicalStateHash
      !== second.privatePhysicalStateHash
    || second.privatePhysicalStateHash
      !== state.privatePhysicalStateHash
    || state.privateAnchors.privatePhysicalStateHash
      !== state.privatePhysicalStateHash
    || canonicalJsonStringify(firstReceipt)
      !== canonicalJsonStringify(secondReceipt)
    || canonicalJsonStringify(secondReceipt)
      !== canonicalJsonStringify(state.receipt)
  ) {
    return fail(
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      "Host composition installation changed after authority issuance",
    );
  }
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(secondReceipt),
  );
}
