import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  opendirSync,
  openSync,
  readSync,
  readlinkSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  type BigIntStats,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  captureCanonicalRuntimeTreeV2,
  captureCanonicalRuntimeTreeV2ForTest,
  verifyCanonicalRuntimeTreeV2,
  type CanonicalRuntimeMetadataProbeV2,
} from "../execution/canonical-runtime-tree-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  canonicalRuntimePathIssuesV2,
  type CanonicalRuntimeTreeV2,
} from "../execution/schemas/canonical-runtime-tree-v2.js";
import {
  EXACT_SOURCE_FILE_REF_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
  ProductionPackageResolutionGraphV2Schema,
  hashProductionPackageResolutionGraphV2,
  type ProductionPackageResolutionEntryV2,
  type ProductionPackageResolutionGraphHashPayloadV2,
  type ProductionPackageResolutionGraphV2,
} from "../execution/schemas/external-runtime-resolution-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  verifyCodeOwnedNodeScaffoldProductionClosureV2,
} from "./node-scaffold-production-closure-v2.js";
import {
  getCodeOwnedNodeScaffoldToolchainEntryV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import type {
  NodeScaffoldProductionClosureV2,
} from "./schemas/node-scaffold-production-closure-v2.js";
import {
  NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_V2,
} from "./schemas/node-scaffold-production-materialization-v2.js";
export {
  NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_HASH_V2,
  NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_V2,
} from "./schemas/node-scaffold-production-materialization-v2.js";

export type NodeScaffoldProductionMaterializationErrorCodeV2 =
  | "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID"
  | "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID"
  | "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID"
  | "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED"
  | "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_GRAPH_INVALID"
  | "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH";

export class NodeScaffoldProductionMaterializationErrorV2 extends Error {
  readonly code: NodeScaffoldProductionMaterializationErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeScaffoldProductionMaterializationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeScaffoldProductionMaterializationErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type NpmLockDependencyCapsuleAdmissionScopeV2 =
  "production_host" | "test_fixture";

type AdmissionScopeV2 = NpmLockDependencyCapsuleAdmissionScopeV2;

export type RawNpmInstallEntryInternalV2 = Readonly<{
  locator: string;
  type: "directory" | "file" | "symbolic_link";
  mode: number;
  contentHash?: string;
  byteLength?: number;
  linkTarget?: string;
}>;

export type RawNpmInstallExactObjectKindInternalV2 =
  "ordinary_file" | "directory" | "symbolic_link" | "special";

export type RawNpmInstallExactObjectIdentityInternalV2 = Readonly<{
  device: bigint;
  inode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  objectKind: RawNpmInstallExactObjectKindInternalV2;
}>;

export type RawNpmInstallExactCensusInternalV2 = Readonly<{
  rootPath: string;
  root: RawNpmInstallExactObjectIdentityInternalV2;
  entries: ReadonlyMap<string, RawNpmInstallExactObjectIdentityInternalV2>;
}>;

type RawInstallEntryV2 = RawNpmInstallEntryInternalV2;

const rawNpmInstallExactCensusByEntriesV2 =
  new WeakMap<object, RawNpmInstallExactCensusInternalV2>();

export type ExpectedNpmBinInternalV2 = Readonly<{
  linkLocator: string;
  targetLocator: string;
  expectedLinkTarget: string;
}>;

type ExpectedBinV2 = ExpectedNpmBinInternalV2;

export type NodeScaffoldProductionMaterializationV2 = Readonly<{
  profileId: NodeScaffoldProductionClosureV2["profileBinding"]["profileId"];
  productionClosureHash: string;
  hiddenLockRawHash: string;
  rawInstallMembershipHash: string;
  dependencyTree: CanonicalRuntimeTreeV2;
  productionGraph: ProductionPackageResolutionGraphV2;
}>;

export type NodeScaffoldProductionVerificationV2 = Readonly<{
  profileId: NodeScaffoldProductionClosureV2["profileBinding"]["profileId"];
  productionClosureHash: string;
  dependencyTree: CanonicalRuntimeTreeV2;
  productionGraph: ProductionPackageResolutionGraphV2;
}>;

function fail(
  code: NodeScaffoldProductionMaterializationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeScaffoldProductionMaterializationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function runWithIndependentFinalizersV2<T>(input: Readonly<{
  operation: () => T;
  finalizers: readonly (() => void)[];
  onFinalizerFailure: (errors: readonly unknown[]) => never;
}>): T {
  const primaryErrors: unknown[] = [];
  let result: T | undefined;
  try {
    result = input.operation();
  } catch (error) {
    primaryErrors.push(error);
  }
  const finalizerErrors: unknown[] = [];
  for (const finalizer of input.finalizers) {
    try {
      finalizer();
    } catch (error) {
      finalizerErrors.push(error);
    }
  }
  if (finalizerErrors.length > 0) {
    return input.onFinalizerFailure([...primaryErrors, ...finalizerErrors]);
  }
  if (primaryErrors.length > 0) throw primaryErrors[0];
  return result as T;
}

function readBoundedDirectoryNamesV2(input: Readonly<{
  absolutePath: string;
  label: string;
  maxNames: number;
  onFailure: (message: string, cause?: unknown) => never;
  beforeReadForTest?: () => void;
}>): readonly string[] {
  const names: string[] = [];
  const directory = opendirSync(input.absolutePath);
  return runWithIndependentFinalizersV2({
    operation: () => {
      input.beforeReadForTest?.();
      let entry = directory.readSync();
      while (entry !== null) {
        names.push(entry.name);
        if (names.length > input.maxNames) {
          return input.onFailure(`${input.label} exceeded its fixed membership bound`);
        }
        entry = directory.readSync();
      }
      return names.sort(compareUtf16);
    },
    finalizers: [() => directory.closeSync()],
    onFinalizerFailure: (errors) => input.onFailure(
      `${input.label} read or descriptor close failed`,
      new AggregateError(errors, `${input.label} read and descriptor finalization failures`),
    ),
  });
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeBits(stat: Stats): number {
  return stat.mode & 0o7777;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function isPlainNpmLockRecordInternalV2(
  value: unknown,
): value is Record<string, unknown> {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || isProxy(value)
  ) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const isPlainRecord = isPlainNpmLockRecordInternalV2;

function exactDataRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(input)) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Production materialization input must be one non-proxied plain object",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Production materialization input fields are not exact",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const values: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
        "Production materialization input must use enumerable data properties",
      );
    }
    values[key] = descriptor.value;
  }
  return Object.freeze(values);
}

export function parseNpmLockJsonObjectInternalV2(
  bytes: Buffer,
  label: string,
  errorCode: NodeScaffoldProductionMaterializationErrorCodeV2 =
    "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
): Readonly<Record<string, unknown>> {
  if (bytes.byteLength < 2 || bytes.byteLength > 32 * 1024 * 1024) {
    return fail(
      errorCode,
      `${label} is outside its fixed JSON byte bound`,
    );
  }
  try {
    const text = bytes.toString("utf8");
    if (text.includes("\0") || text.startsWith("\ufeff")) {
      throw new Error("non-canonical JSON text");
    }
    const parsed: unknown = JSON.parse(text);
    if (!isPlainRecord(parsed)) throw new Error("expected one JSON object");
    return parsed;
  } catch (error) {
    return fail(
      errorCode,
      `${label} is not one bounded JSON object`,
      error,
    );
  }
}

const parseJsonObject = parseNpmLockJsonObjectInternalV2;

function processOwner(): Readonly<{ uid: number; gid: number }> {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Production materialization requires POSIX ownership evidence",
    );
  }
  return Object.freeze({ uid: process.getuid(), gid: process.getgid() });
}

function syncPath(
  absolutePath: string,
  testHooks?: Readonly<{
    beforeSync?: (absolutePath: string) => void;
    afterDescriptorClose?: (absolutePath: string) => void;
  }>,
): void {
  let descriptor: number | undefined;
  return runWithIndependentFinalizersV2({
    operation: () => {
      descriptor = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      testHooks?.beforeSync?.(absolutePath);
      fsyncSync(descriptor);
    },
    finalizers: [() => {
      if (descriptor === undefined) return;
      closeSync(descriptor);
      testHooks?.afterDescriptorClose?.(absolutePath);
    }],
    onFinalizerFailure: (errors) => fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED",
      `Dependency path ${absolutePath} sync or descriptor close failed`,
      new AggregateError(errors, "Dependency path sync and descriptor finalization failures"),
    ),
  });
}

export function readExactNpmLockRegularFileInternalV2(input: Readonly<{
  absolutePath: string;
  label: string;
  maxBytes: number;
  allowedModes?: readonly number[];
  beforeReadForTest?: () => void;
  afterDescriptorCloseForTest?: () => void;
}>): Readonly<{
  bytes: Buffer;
  contentHash: string;
  mode: number;
}> {
  const owner = processOwner();
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
          input.absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(descriptor);
        if (
          !before.isFile()
          || before.isSymbolicLink()
          || before.nlink !== 1
          || before.uid !== owner.uid
          || before.gid !== owner.gid
          || (modeBits(before) & 0o022) !== 0
          || (input.allowedModes !== undefined
            && !input.allowedModes.includes(modeBits(before)))
          || before.size < 1
          || before.size > input.maxBytes
        ) {
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
            `${input.label} has unsafe type, ownership, links, mode or size`,
          );
        }
        input.beforeReadForTest?.();
        const bytes = Buffer.alloc(before.size);
        let byteLength = 0;
        while (byteLength < bytes.byteLength) {
          const count = readSync(
            descriptor,
            bytes,
            byteLength,
            bytes.byteLength - byteLength,
            null,
          );
          if (count === 0) break;
          byteLength += count;
        }
        const growthProbe = Buffer.allocUnsafe(1);
        const growthCount = readSync(descriptor, growthProbe, 0, 1, null);
        const after = fstatSync(descriptor);
        const pathAfter = lstatSync(input.absolutePath);
        if (
          before.dev !== after.dev
          || before.ino !== after.ino
          || before.mode !== after.mode
          || before.size !== after.size
          || before.mtimeMs !== after.mtimeMs
          || before.ctimeMs !== after.ctimeMs
          || after.dev !== pathAfter.dev
          || after.ino !== pathAfter.ino
          || after.mode !== pathAfter.mode
          || after.size !== pathAfter.size
          || byteLength !== after.size
          || growthCount !== 0
        ) {
          bytes.fill(0);
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
            `${input.label} changed while it was captured`,
          );
        }
        return Object.freeze({
          bytes,
          contentHash: sha256(bytes),
          mode: modeBits(after),
        });
      },
      finalizers: [() => {
        if (descriptor === undefined) return;
        closeSync(descriptor);
        input.afterDescriptorCloseForTest?.();
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        `${input.label} read or descriptor close failed`,
        new AggregateError(
          errors,
          `${input.label} read and descriptor finalization failures`,
        ),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldProductionMaterializationErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
      `${input.label} could not be read without following links`,
      error,
    );
  }
}

const readExactRegularFile = readExactNpmLockRegularFileInternalV2;

function rawNpmInstallExactIdentityV2(
  stat: BigIntStats,
): RawNpmInstallExactObjectIdentityInternalV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    objectKind: stat.isSymbolicLink()
      ? "symbolic_link" as const
      : stat.isDirectory()
        ? "directory" as const
        : stat.isFile()
          ? "ordinary_file" as const
          : "special" as const,
  });
}

function sameRawNpmInstallExactIdentityV2(
  left: RawNpmInstallExactObjectIdentityInternalV2,
  right: RawNpmInstallExactObjectIdentityInternalV2,
): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.objectKind === right.objectKind;
}

export function getRawNpmInstallExactObjectIdentityInternalV2(
  entries: readonly RawNpmInstallEntryInternalV2[],
  locator: string,
): RawNpmInstallExactObjectIdentityInternalV2 | undefined {
  const census = rawNpmInstallExactCensusByEntriesV2.get(entries as object);
  if (!census) return undefined;
  return locator === ""
    ? census.root
    : census.entries.get(locator);
}

export function assertRawNpmInstallObjectCurrentInternalV2(input: Readonly<{
  entries: readonly RawNpmInstallEntryInternalV2[];
  nodeModulesRoot: string;
  locator: string;
  expected: RawNpmInstallExactObjectIdentityInternalV2 | undefined;
  onFailure: (message: string, cause?: unknown) => never;
}>): void {
  const census = rawNpmInstallExactCensusByEntriesV2.get(
    input.entries as object,
  );
  if (!census || census.rootPath !== input.nodeModulesRoot) {
    return input.onFailure(
      `Exact npm install census is not bound to ${input.nodeModulesRoot}`,
    );
  }
  const expectedFromCensus = input.locator === ""
    ? census.root
    : census.entries.get(input.locator);
  if (
    !input.expected
    || !expectedFromCensus
    || !sameRawNpmInstallExactIdentityV2(
      input.expected,
      expectedFromCensus,
    )
  ) {
    return input.onFailure(
      `Exact npm install census is unavailable for ${input.locator || "node_modules"}`,
    );
  }
  const absolutePath = input.locator === ""
    ? input.nodeModulesRoot
    : path.join(input.nodeModulesRoot, ...input.locator.split("/"));
  let rootCurrent: RawNpmInstallExactObjectIdentityInternalV2;
  try {
    rootCurrent = rawNpmInstallExactIdentityV2(
      lstatSync(input.nodeModulesRoot, { bigint: true }),
    );
  } catch (error) {
    return input.onFailure(
      "Exact npm install root could not be revalidated before target deletion",
      error,
    );
  }
  if (!sameRawNpmInstallExactIdentityV2(rootCurrent, census.root)) {
    return input.onFailure(
      "Exact npm install root was replaced or changed before target deletion",
    );
  }
  let targetMatches = false;
  try {
    const current = rawNpmInstallExactIdentityV2(
      lstatSync(absolutePath, { bigint: true }),
    );
    targetMatches = sameRawNpmInstallExactIdentityV2(
      current,
      input.expected,
    );
  } catch (error) {
    return input.onFailure(
      `Exact npm install target ${input.locator || "node_modules"} could not be revalidated`,
      error,
    );
  }
  if (!targetMatches) {
    return input.onFailure(
      `Exact npm install target ${input.locator || "node_modules"} was replaced or changed`,
    );
  }
}

export function removeRawNpmInstallExactOwnedObjectsInternalV2(input: Readonly<{
  entries: readonly RawNpmInstallEntryInternalV2[];
  nodeModulesRoot: string;
  locators: readonly string[];
  onFailure: (message: string, cause?: unknown) => never;
  afterDirectoryWritableForTest?: (locator: string) => void;
  afterDirectoryDescriptorCloseForTest?: (
    locator: string,
    phase: "make_writable" | "restore_mode",
  ) => void;
  beforeDirectoryMembershipReadForTest?: (locator: string) => void;
}>): void {
  if (input.locators.length === 0) return;
  const census = rawNpmInstallExactCensusByEntriesV2.get(
    input.entries as object,
  );
  if (!census || census.rootPath !== input.nodeModulesRoot) {
    return input.onFailure(
      `Exact npm install census is not bound to ${input.nodeModulesRoot}`,
    );
  }
  if (
    new Set(input.locators).size !== input.locators.length
    || input.locators.some((locator) =>
      locator.length === 0
      || !census.entries.has(locator)
      || input.locators.some((other) =>
        other !== locator && locator.startsWith(`${other}/`)))
  ) {
    return input.onFailure(
      "Exact npm install cleanup locators are absent, duplicated, or overlapping",
    );
  }

  const absolutePath = (locator: string): string => locator === ""
    ? input.nodeModulesRoot
    : path.join(input.nodeModulesRoot, ...locator.split("/"));
  const currentIdentity = (
    locator: string,
    label: string,
  ): RawNpmInstallExactObjectIdentityInternalV2 => {
    try {
      return rawNpmInstallExactIdentityV2(
        lstatSync(absolutePath(locator), { bigint: true }),
      );
    } catch (error) {
      return input.onFailure(
        `Exact npm install ${label} ${locator || "node_modules"} could not be revalidated`,
        error,
      );
    }
  };
  const assertIdentity = (
    locator: string,
    expected: RawNpmInstallExactObjectIdentityInternalV2,
    label: string,
  ): void => {
    if (!sameRawNpmInstallExactIdentityV2(
      currentIdentity(locator, label),
      expected,
    )) {
      return input.onFailure(
        `Exact npm install ${label} ${locator || "node_modules"} was replaced or changed`,
      );
    }
  };
  const remaining = new Map(census.entries);
  const immediateChildNames = (directoryLocator: string): string[] => {
    const names: string[] = [];
    for (const locator of remaining.keys()) {
      if (locator === "" || locator === directoryLocator) continue;
      const parent = path.posix.dirname(locator);
      const canonicalParent = parent === "." ? "" : parent;
      if (canonicalParent === directoryLocator) {
        names.push(path.posix.basename(locator));
      }
    }
    return names.sort(compareUtf16);
  };
  const assertDirectoryMembership = (
    locator: string,
    expected: RawNpmInstallExactObjectIdentityInternalV2,
  ): void => {
    assertIdentity(locator, expected, "directory");
    if (expected.objectKind !== "directory") {
      return input.onFailure(
        `Exact npm install cleanup parent ${locator || "node_modules"} is not a directory`,
      );
    }
    const expectedNames = immediateChildNames(locator);
    const actual = readBoundedDirectoryNamesV2({
      absolutePath: absolutePath(locator),
      label: `Exact npm install directory ${locator || "node_modules"}`,
      maxNames: expectedNames.length,
      onFailure: input.onFailure,
      beforeReadForTest: () => input.beforeDirectoryMembershipReadForTest?.(locator),
    });
    if (!sameStrings(actual, expectedNames)) {
      return input.onFailure(
        `Exact npm install directory ${locator || "node_modules"} membership changed before cleanup`,
      );
    }
  };
  const assertRoot = (): void => assertDirectoryMembership("", census.root);
  const modeJournal = new Map<string, Readonly<{
    locator: string;
    expected: RawNpmInstallExactObjectIdentityInternalV2;
    originalMode: number;
  }>>();
  const makeDirectoryOwnerWritable = (
    locator: string,
    expected: RawNpmInstallExactObjectIdentityInternalV2,
  ): void => {
    assertDirectoryMembership(locator, expected);
    let descriptor: number | undefined;
    const operationErrors: unknown[] = [];
    try {
      descriptor = openSync(
        absolutePath(locator),
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      const stat = fstatSync(descriptor, { bigint: true });
      if (
        !stat.isDirectory()
        || !sameRawNpmInstallExactIdentityV2(
          rawNpmInstallExactIdentityV2(stat),
          expected,
        )
      ) {
        throw new TypeError(
          `Exact npm install directory ${locator || "node_modules"} changed before descriptor-bound chmod`,
        );
      }
      if ((stat.mode & 0o700n) !== 0o700n) {
        modeJournal.set(locator, Object.freeze({
          locator,
          expected,
          originalMode: Number(stat.mode & 0o7777n),
        }));
        fchmodSync(descriptor, Number(stat.mode & 0o7777n) | 0o700);
        input.afterDirectoryWritableForTest?.(locator);
      }
    } catch (error) {
      operationErrors.push(error);
    }
    const closeErrors: unknown[] = [];
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
        input.afterDirectoryDescriptorCloseForTest?.(locator, "make_writable");
      } catch (error) {
        closeErrors.push(error);
      }
    }
    if (operationErrors.length > 0 && closeErrors.length > 0) {
      return input.onFailure(
        `Exact npm install directory ${locator || "node_modules"} could not be made owner-writable through its exact descriptor`,
        new AggregateError(
          [...operationErrors, ...closeErrors],
          "Exact npm install directory mutation and descriptor close both failed",
        ),
      );
    }
    if (operationErrors.length > 0) {
      return input.onFailure(
        `Exact npm install directory ${locator || "node_modules"} could not be made owner-writable through its exact descriptor`,
        operationErrors[0],
      );
    }
    if (closeErrors.length > 0) {
      return input.onFailure(
        `Exact npm install directory ${locator || "node_modules"} descriptor could not be closed after owner-writable mutation`,
        closeErrors[0],
      );
    }
    assertDirectoryMembership(locator, expected);
  };

  const restoreDirectoryMode = (entry: Readonly<{
    locator: string;
    expected: RawNpmInstallExactObjectIdentityInternalV2;
    originalMode: number;
  }>): void => {
    let descriptor: number | undefined;
    const operationErrors: unknown[] = [];
    try {
      try {
        lstatSync(absolutePath(entry.locator), { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      descriptor = openSync(
        absolutePath(entry.locator),
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      const before = fstatSync(descriptor, { bigint: true });
      if (
        !before.isDirectory()
        || !sameRawNpmInstallExactIdentityV2(
          rawNpmInstallExactIdentityV2(before),
          entry.expected,
        )
      ) {
        throw new TypeError(
          `Exact npm install surviving directory ${entry.locator || "node_modules"} changed before mode restoration`,
        );
      }
      if (Number(before.mode & 0o7777n) !== entry.originalMode) {
        fchmodSync(descriptor, entry.originalMode);
      }
      const after = fstatSync(descriptor, { bigint: true });
      const pathAfter = lstatSync(absolutePath(entry.locator), { bigint: true });
      if (
        !sameRawNpmInstallExactIdentityV2(
          rawNpmInstallExactIdentityV2(after),
          entry.expected,
        )
        || !sameRawNpmInstallExactIdentityV2(
          rawNpmInstallExactIdentityV2(pathAfter),
          entry.expected,
        )
        || Number(after.mode & 0o7777n) !== entry.originalMode
        || Number(pathAfter.mode & 0o7777n) !== entry.originalMode
      ) {
        throw new TypeError(
          `Exact npm install surviving directory ${entry.locator || "node_modules"} did not retain its original mode`,
        );
      }
    } catch (error) {
      operationErrors.push(error);
    }
    const closeErrors: unknown[] = [];
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
        input.afterDirectoryDescriptorCloseForTest?.(
          entry.locator,
          "restore_mode",
        );
      } catch (error) {
        closeErrors.push(error);
      }
    }
    if (operationErrors.length > 0 && closeErrors.length > 0) {
      throw new AggregateError(
        [...operationErrors, ...closeErrors],
        "Exact npm install directory mode restoration and descriptor close both failed",
      );
    }
    if (operationErrors.length > 0) throw operationErrors[0];
    if (closeErrors.length > 0) throw closeErrors[0];
  };

  // Validate the complete bounded capture once before deleting anything. During
  // deletion, revalidate each parent/leaf and use only unlink(2)/rmdir(2).
  // A raced foreign subtree therefore remains non-empty and cannot be followed
  // by a recursive path-based remover.
  const primaryErrors: unknown[] = [];
  try {
    assertRoot();
    for (const [locator, expected] of remaining) {
      if (locator === "") continue;
      if (expected.objectKind === "directory") {
        assertDirectoryMembership(locator, expected);
      } else {
        assertIdentity(locator, expected, "entry");
      }
    }

    const selected = [...remaining.entries()].filter(([locator]) =>
      locator !== "" && input.locators.some((target) =>
        locator === target || locator.startsWith(`${target}/`)));
    const depth = (locator: string): number => locator.split("/").length;
    const writableDirectories = new Set<string>();
    for (const [locator, expected] of selected) {
      if (expected.objectKind === "directory") writableDirectories.add(locator);
      const rawParent = path.posix.dirname(locator);
      writableDirectories.add(rawParent === "." ? "" : rawParent);
    }
    for (const locator of [...writableDirectories].sort((left, right) =>
      depth(left) - depth(right) || compareUtf16(left, right))) {
      const expected = locator === "" ? census.root : remaining.get(locator);
      if (!expected) {
        return input.onFailure(
          `Exact npm install writable cleanup directory census is absent for ${locator || "node_modules"}`,
        );
      }
      makeDirectoryOwnerWritable(locator, expected);
    }
    const leaves = selected
      .filter(([, expected]) => expected.objectKind !== "directory")
      .sort(([left], [right]) => depth(right) - depth(left)
        || compareUtf16(left, right));
    for (const [locator, expected] of leaves) {
      assertRoot();
      const rawParent = path.posix.dirname(locator);
      const parent = rawParent === "." ? "" : rawParent;
      const parentIdentity = remaining.get(parent);
      if (!parentIdentity) {
        return input.onFailure(
          `Exact npm install cleanup parent census is absent for ${locator}`,
        );
      }
      assertDirectoryMembership(parent, parentIdentity);
      assertIdentity(locator, expected, "cleanup leaf");
      try {
        unlinkSync(absolutePath(locator));
      } catch (error) {
        return input.onFailure(
          `Exact npm install cleanup leaf ${locator} could not be unlinked`,
          error,
        );
      }
      remaining.delete(locator);
      assertIdentity(parent, parentIdentity, "cleanup parent");
    }

    const directories = selected
      .filter(([, expected]) => expected.objectKind === "directory")
      .sort(([left], [right]) => depth(right) - depth(left)
        || compareUtf16(left, right));
    for (const [locator, expected] of directories) {
      assertRoot();
      const rawParent = path.posix.dirname(locator);
      const parent = rawParent === "." ? "" : rawParent;
      const parentIdentity = remaining.get(parent);
      if (!parentIdentity) {
        return input.onFailure(
          `Exact npm install cleanup parent census is absent for ${locator}`,
        );
      }
      assertDirectoryMembership(parent, parentIdentity);
      assertDirectoryMembership(locator, expected);
      try {
        rmdirSync(absolutePath(locator));
      } catch (error) {
        return input.onFailure(
          `Exact npm install cleanup directory ${locator} could not be removed empty`,
          error,
        );
      }
      remaining.delete(locator);
      assertIdentity(parent, parentIdentity, "cleanup parent");
    }
    assertRoot();
  } catch (error) {
    primaryErrors.push(error);
  }

  const restoreErrors: unknown[] = [];
  for (const entry of [...modeJournal.values()].reverse()) {
    try {
      restoreDirectoryMode(entry);
    } catch (error) {
      restoreErrors.push(error);
    }
  }
  if (restoreErrors.length > 0) {
    const errors = primaryErrors.length === 0
      ? restoreErrors
      : [...primaryErrors, ...restoreErrors];
    return input.onFailure(
      "Exact npm install cleanup could not restore every surviving directory mode",
      new AggregateError(
        errors,
        "Exact npm install cleanup retained a surviving directory with uncertain mode",
      ),
    );
  }
  if (primaryErrors.length > 0) throw primaryErrors[0];
}

function hashRegularFile(
  absolutePath: string,
  locator: string,
  testHooks?: Readonly<{
    beforeFileRead?: (locator: string) => void;
    afterFileDescriptorClose?: (locator: string) => void;
    beforeDirectoryRead?: (locator: string) => void;
    maxDirectoryEntriesForTest?: number;
  }>,
): Readonly<{ contentHash: string; byteLength: number; mode: number }> {
  const owner = processOwner();
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
          absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(descriptor);
        if (
          !before.isFile()
          || before.nlink !== 1
          || before.uid !== owner.uid
          || before.gid !== owner.gid
          || (modeBits(before) & 0o022) !== 0
          || before.size < 0
          || before.size > limits.maxFileBytes
        ) {
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
            `Installed file ${locator} is unsafe`,
          );
        }
        const hash = createHash("sha256");
        const buffer = Buffer.allocUnsafe(64 * 1024);
        let byteLength = 0;
        testHooks?.beforeFileRead?.(locator);
        while (true) {
          const count = readSync(descriptor, buffer, 0, buffer.byteLength, null);
          if (count === 0) break;
          if (byteLength + count > before.size || byteLength + count > limits.maxFileBytes) {
            return fail(
              "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
              `Installed file ${locator} exceeded its admitted byte length while hashing`,
            );
          }
          byteLength += count;
          hash.update(buffer.subarray(0, count));
        }
        const after = fstatSync(descriptor);
        const pathAfter = lstatSync(absolutePath);
        if (
          before.dev !== after.dev
          || before.ino !== after.ino
          || before.mode !== after.mode
          || before.size !== after.size
          || before.mtimeMs !== after.mtimeMs
          || before.ctimeMs !== after.ctimeMs
          || after.dev !== pathAfter.dev
          || after.ino !== pathAfter.ino
          || after.mode !== pathAfter.mode
          || after.size !== pathAfter.size
          || byteLength !== after.size
        ) {
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
            `Installed file ${locator} changed while it was hashed`,
          );
        }
        return Object.freeze({
          contentHash: hash.digest("hex"),
          byteLength,
          mode: modeBits(after),
        });
      },
      finalizers: [() => {
        if (descriptor === undefined) return;
        closeSync(descriptor);
        testHooks?.afterFileDescriptorClose?.(locator);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        `Installed file ${locator} hash or descriptor close failed`,
        new AggregateError(
          errors,
          `Installed file ${locator} hash and descriptor finalization failures`,
        ),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldProductionMaterializationErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
      `Installed file ${locator} could not be hashed`,
      error,
    );
  }
}

export function captureRawNpmInstallTreeInternalV2(
  nodeModulesRoot: string,
  testHooks?: Readonly<{
    beforeFileRead?: (locator: string) => void;
    afterFileDescriptorClose?: (locator: string) => void;
    beforeDirectoryRead?: (locator: string) => void;
    maxDirectoryEntriesForTest?: number;
  }>,
): readonly RawNpmInstallEntryInternalV2[] {
  const owner = processOwner();
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
  const entries: RawInstallEntryV2[] = [];
  const exactEntries = new Map<
    string,
    RawNpmInstallExactObjectIdentityInternalV2
  >();
  let exactRoot:
    RawNpmInstallExactObjectIdentityInternalV2 | undefined;
  const casefold = new Map<string, string>();
  let files = 0;
  let directories = 0;
  let totalBytes = 0;
  const maxMembers = limits.maxFiles + limits.maxDirectories;
  const visit = (absoluteDirectory: string, relativeDirectory: string): void => {
    const before = lstatSync(absoluteDirectory);
    const exactBefore = lstatSync(absoluteDirectory, { bigint: true });
    const beforeNames = readBoundedDirectoryNamesV2({
      absolutePath: absoluteDirectory,
      label: `Installed directory ${relativeDirectory || "node_modules"}`,
      maxNames: Math.min(
        maxMembers - entries.length,
        testHooks?.maxDirectoryEntriesForTest ?? Number.MAX_SAFE_INTEGER,
      ),
      onFailure: (message, cause) => fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        message,
        cause,
      ),
      beforeReadForTest: () => testHooks?.beforeDirectoryRead?.(
        relativeDirectory || "node_modules",
      ),
    });
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || realpathSync(absoluteDirectory) !== absoluteDirectory
      || before.uid !== owner.uid
      || before.gid !== owner.gid
      || (modeBits(before) & 0o022) !== 0
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        `Installed directory ${relativeDirectory || "node_modules"} is unsafe`,
      );
    }
    const exactDirectoryIdentity = rawNpmInstallExactIdentityV2(exactBefore);
    if (relativeDirectory === "") exactRoot = exactDirectoryIdentity;
    exactEntries.set(relativeDirectory, exactDirectoryIdentity);
    for (const name of beforeNames) {
      const locator = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (canonicalRuntimePathIssuesV2(locator, limits).length > 0) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          `Installed locator ${locator} is not portable`,
        );
      }
      const folded = locator.toLowerCase();
      const prior = casefold.get(folded);
      if (prior !== undefined && prior !== locator) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          `Installed locators collide under case folding: ${prior} and ${locator}`,
        );
      }
      casefold.set(folded, locator);
      const absolutePath = path.join(absoluteDirectory, name);
      const stat = lstatSync(absolutePath);
      const exactStat = lstatSync(absolutePath, { bigint: true });
      const exactIdentity = rawNpmInstallExactIdentityV2(exactStat);
      exactEntries.set(locator, exactIdentity);
      if (stat.isSymbolicLink()) {
        if (stat.uid !== owner.uid || stat.gid !== owner.gid || stat.nlink !== 1) {
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
            `Installed symbolic link ${locator} is unsafe`,
          );
        }
        entries.push(Object.freeze({
          locator,
          type: "symbolic_link" as const,
          mode: modeBits(stat),
          linkTarget: readlinkSync(absolutePath),
        }));
        continue;
      }
      if (stat.isDirectory()) {
        directories += 1;
        if (directories > limits.maxDirectories) {
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
            "Installed dependency directory count exceeded its fixed bound",
          );
        }
        entries.push(Object.freeze({
          locator,
          type: "directory" as const,
          mode: modeBits(stat),
        }));
        visit(absolutePath, locator);
        continue;
      }
      if (!stat.isFile()) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          `Installed dependency ${locator} is a forbidden special file`,
        );
      }
      files += 1;
      if (files > limits.maxFiles) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          "Installed dependency file count exceeded its fixed bound",
        );
      }
      const captured = hashRegularFile(absolutePath, locator, testHooks);
      totalBytes += captured.byteLength;
      if (totalBytes > limits.maxTotalBytes) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          "Installed dependency bytes exceeded their fixed bound",
        );
      }
      entries.push(Object.freeze({
        locator,
        type: "file" as const,
        mode: captured.mode,
        contentHash: captured.contentHash,
        byteLength: captured.byteLength,
      }));
    }
    const after = lstatSync(absoluteDirectory);
    const exactAfter = lstatSync(absoluteDirectory, { bigint: true });
    const afterNames = readBoundedDirectoryNamesV2({
      absolutePath: absoluteDirectory,
      label: `Installed directory ${relativeDirectory || "node_modules"}`,
      maxNames: beforeNames.length,
      onFailure: (message, cause) => fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        message,
        cause,
      ),
    });
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.mode !== after.mode
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || !sameRawNpmInstallExactIdentityV2(
        exactDirectoryIdentity,
        rawNpmInstallExactIdentityV2(exactAfter),
      )
      || !sameStrings(beforeNames, afterNames)
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        `Installed directory ${relativeDirectory || "node_modules"} changed during capture`,
      );
    }
  };
  visit(nodeModulesRoot, "");
  const result = Object.freeze(entries.sort((left, right) =>
    compareUtf16(left.locator, right.locator)));
  if (!exactRoot) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
      "Installed dependency root exact census was not captured",
    );
  }
  rawNpmInstallExactCensusByEntriesV2.set(result, Object.freeze({
    rootPath: nodeModulesRoot,
    root: exactRoot,
    entries: exactEntries,
  }));
  return result;
}

const captureRawInstallTree = captureRawNpmInstallTreeInternalV2;

function packageNameFromPath(packagePath: string): string {
  const segments = packagePath.split("/");
  const index = segments.lastIndexOf("node_modules");
  return segments[index + 1]!.startsWith("@")
    ? `${segments[index + 1]}/${segments[index + 2]}`
    : segments[index + 1]!;
}

function relativeNodeModulesLocator(packagePath: string): string {
  return packagePath.slice("node_modules/".length);
}

export function validateEveryAndOnlyNpmPackageRootsInternalV2(
  nodeModulesRoot: string,
  rawEntries: readonly RawNpmInstallEntryInternalV2[],
  packagePaths: readonly string[],
): void {
  const expectedContainers = new Map<string, string[]>();
  expectedContainers.set("node_modules", []);
  for (const packagePath of packagePaths) {
    const segments = packagePath.split("/");
    const index = segments.lastIndexOf("node_modules");
    const container = segments.slice(0, index + 1).join("/");
    const members = expectedContainers.get(container) ?? [];
    members.push(packageNameFromPath(packagePath));
    expectedContainers.set(container, members);
  }
  const actualContainers = new Set<string>(["node_modules"]);
  for (const entry of rawEntries) {
    if (entry.type === "directory" && entry.locator.endsWith("/node_modules")) {
      actualContainers.add(`node_modules/${entry.locator}`);
    }
  }
  if (!sameStrings(
    [...actualContainers].sort(compareUtf16),
    [...expectedContainers.keys()].sort(compareUtf16),
  )) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
      "Installed node_modules containers do not equal the production closure",
    );
  }
  for (const [container, packageMembers] of expectedContainers) {
    const relativeContainer = container === "node_modules"
      ? ""
      : container.slice("node_modules/".length);
    const absoluteContainer = relativeContainer
      ? path.join(nodeModulesRoot, ...relativeContainer.split("/"))
      : nodeModulesRoot;
    const expectedTop = [...new Set(packageMembers.map((member) =>
      member.split("/")[0]!))].sort(compareUtf16);
    const actualTop = readBoundedDirectoryNamesV2({
      absolutePath: absoluteContainer,
      label: `Installed package roots in ${container}`,
      maxNames: expectedTop.length + 2,
      onFailure: (message, cause) => fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        message,
        cause,
      ),
    })
      .filter((name) => name !== ".bin" && name !== ".package-lock.json")
      .sort(compareUtf16);
    if (!sameStrings(actualTop, expectedTop)) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        `Installed package roots in ${container} are incomplete or contain extras`,
      );
    }
    for (const scope of expectedTop.filter((name) => name.startsWith("@"))) {
      const expectedScoped = packageMembers
        .filter((member) => member.startsWith(`${scope}/`))
        .map((member) => member.slice(scope.length + 1))
        .sort(compareUtf16);
      const actualScoped = readBoundedDirectoryNamesV2({
        absolutePath: path.join(absoluteContainer, scope),
        label: `Installed scoped package roots in ${container}/${scope}`,
        maxNames: expectedScoped.length,
        onFailure: (message, cause) => fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          message,
          cause,
        ),
      });
      if (!sameStrings(actualScoped, expectedScoped)) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          `Installed scoped package roots in ${container}/${scope} differ`,
        );
      }
    }
  }
}

const validateEveryAndOnlyPackageRoots =
  validateEveryAndOnlyNpmPackageRootsInternalV2;

export function deriveExpectedNpmBinsInternalV2(
  lockPackages: Readonly<Record<string, unknown>>,
  packagePaths: readonly string[],
): readonly ExpectedNpmBinInternalV2[] {
  const result: ExpectedBinV2[] = [];
  const occupied = new Set<string>();
  for (const packagePath of packagePaths) {
    const lockEntry = lockPackages[packagePath];
    if (!isPlainRecord(lockEntry)) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
        `Production lock entry ${packagePath} is absent`,
      );
    }
    const rawBin = lockEntry.bin;
    let commands: Array<readonly [string, string]> = [];
    if (typeof rawBin === "string") {
      commands = [[packageNameFromPath(packagePath).split("/").at(-1)!, rawBin]];
    } else if (rawBin !== undefined) {
      if (!isPlainRecord(rawBin)) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
          `Production lock entry ${packagePath} has a malformed bin map`,
        );
      }
      commands = Object.keys(rawBin).sort(compareUtf16).map((command) => {
        const target = rawBin[command];
        if (!/^[A-Za-z0-9._+-]{1,214}$/u.test(command) || typeof target !== "string") {
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
            `Production lock entry ${packagePath} has an unsafe bin entry`,
          );
        }
        return [command, target] as const;
      });
    }
    const segments = packagePath.split("/");
    const index = segments.lastIndexOf("node_modules");
    const container = segments.slice(0, index + 1).join("/");
    for (const [command, target] of commands) {
      const normalized = path.posix.normalize(target);
      if (
        normalized !== target
        || target.startsWith("/")
        || target.includes("\\")
        || target.split("/").some((segment) =>
          segment === "" || segment === "." || segment === "..")
      ) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
          `Production bin target ${packagePath}/${target} traverses`,
        );
      }
      const fullLink = `${container}/.bin/${command}`;
      const fullTarget = `${packagePath}/${target}`;
      if (occupied.has(fullLink)) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
          `Production bin link ${fullLink} collides`,
        );
      }
      occupied.add(fullLink);
      const linkLocator = relativeNodeModulesLocator(fullLink);
      const targetLocator = relativeNodeModulesLocator(fullTarget);
      result.push(Object.freeze({
        linkLocator,
        targetLocator,
        expectedLinkTarget: path.posix.relative(
          path.posix.dirname(fullLink),
          fullTarget,
        ),
      }));
    }
  }
  return Object.freeze(result.sort((left, right) =>
    compareUtf16(left.linkLocator, right.linkLocator)));
}

function expectedBins(
  lockPackages: Readonly<Record<string, unknown>>,
  closure: NodeScaffoldProductionClosureV2,
): readonly ExpectedBinV2[] {
  return deriveExpectedNpmBinsInternalV2(
    lockPackages,
    closure.nodes.map((node) => node.packagePath),
  );
}

export function validateNpmBinSurfaceInternalV2(
  rawEntries: readonly RawNpmInstallEntryInternalV2[],
  bins: readonly ExpectedNpmBinInternalV2[],
): readonly string[] {
  const expectedDirectories = [...new Set(bins.map((bin) =>
    path.posix.dirname(bin.linkLocator)))].sort(compareUtf16);
  const actualDirectories = rawEntries
    .filter((entry) => entry.type === "directory"
      && (entry.locator === ".bin" || entry.locator.endsWith("/node_modules/.bin")))
    .map((entry) => entry.locator)
    .sort(compareUtf16);
  if (!sameStrings(actualDirectories, expectedDirectories)) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
      "Installed npm bin directories do not equal lock-declared bin surfaces",
    );
  }
  const expectedLinks = bins.map((bin) => bin.linkLocator).sort(compareUtf16);
  const actualLinks = rawEntries.filter((entry) => entry.type === "symbolic_link")
    .map((entry) => entry.locator)
    .sort(compareUtf16);
  if (!sameStrings(actualLinks, expectedLinks)) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
      "Installed symbolic links do not equal lock-declared npm bin links",
    );
  }
  const expectedLinkSet = new Set(expectedLinks);
  for (const entry of rawEntries) {
    const segments = entry.locator.split("/");
    const binIndex = segments.indexOf(".bin");
    if (binIndex < 0) continue;
    const isDirectory = entry.type === "directory"
      && binIndex === segments.length - 1;
    const isExpectedLink = entry.type === "symbolic_link"
      && binIndex === segments.length - 2
      && expectedLinkSet.has(entry.locator);
    if (!isDirectory && !isExpectedLink) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        `Generated npm bin surface contains unexpected member ${entry.locator}`,
      );
    }
  }
  for (const expected of bins) {
    const link = rawEntries.find((entry) => entry.locator === expected.linkLocator);
    const target = rawEntries.find((entry) => entry.locator === expected.targetLocator);
    if (
      link?.type !== "symbolic_link"
      || link.linkTarget !== expected.expectedLinkTarget
      || target?.type !== "file"
      || (target.mode & 0o111) === 0
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        `Installed npm bin ${expected.linkLocator} lacks its exact executable target`,
      );
    }
  }
  return expectedDirectories;
}

const validateBins = validateNpmBinSurfaceInternalV2;

function metadataProbeProduction(
  input: Parameters<CanonicalRuntimeMetadataProbeV2>[0],
): ReturnType<CanonicalRuntimeMetadataProbeV2> {
  try {
    const environment = Object.freeze({ LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" });
    const xattrs = execFileSync("/usr/bin/xattr", [input.absolutePath], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
      windowsHide: true,
    });
    const acl = execFileSync("/bin/ls", ["-lde", input.absolutePath], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
      windowsHide: true,
    });
    const metadata: Array<"acl" | "xattr"> = [];
    const names = xattrs.split("\n").map((name) => name.trim()).filter(Boolean);
    if (names.some((name) => name !== "com.apple.provenance")) metadata.push("xattr");
    if (acl.split("\n").slice(1).some((line) => /^\s*[0-9]+:\s/u.test(line))) {
      metadata.push("acl");
    }
    return metadata.length === 0
      ? Object.freeze({ status: "clear" as const })
      : Object.freeze({ status: "present" as const, metadata: Object.freeze(metadata) });
  } catch (error) {
    return Object.freeze({
      status: "unsupported" as const,
      detail: `production metadata probe failed for ${input.relativePath}: ${
        error instanceof Error ? error.name : "unknown_error"
      }`,
    });
  }
}

const metadataProbeTest: CanonicalRuntimeMetadataProbeV2 = () =>
  Object.freeze({ status: "clear" as const });

function metadataProbe(scope: AdmissionScopeV2): CanonicalRuntimeMetadataProbeV2 {
  return scope === "production_host" ? metadataProbeProduction : metadataProbeTest;
}

/** @internal Returns the code-owned metadata authority for one admitted scope. */
export function getNodeScaffoldRuntimeMetadataProbeInternalV2(
  scope: AdmissionScopeV2,
): CanonicalRuntimeMetadataProbeV2 {
  if (scope !== "production_host" && scope !== "test_fixture") {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Runtime metadata probe scope is not admitted",
    );
  }
  return metadataProbe(scope);
}

function normalizeDarwinMetadata(root: string): void {
  const environment = Object.freeze({ LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" });
  try {
    execFileSync("/bin/chmod", ["-RN", root], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      windowsHide: true,
    });
    execFileSync("/usr/bin/xattr", ["-cr", root], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      windowsHide: true,
    });
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED",
      "Code-owned Darwin dependency metadata normalization failed",
      error,
    );
  }
}

/** @internal Normalizes one fresh runtime tree before its read-only seal. */
export function normalizeNodeScaffoldRuntimeMetadataInternalV2(
  scope: AdmissionScopeV2,
  root: string,
): void {
  if (
    (scope !== "production_host" && scope !== "test_fixture")
    || typeof root !== "string"
    || !path.isAbsolute(root)
  ) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Runtime metadata normalization input is not admitted",
    );
  }
  if (scope === "production_host") normalizeDarwinMetadata(root);
}

export function sealNpmDependencyTreeInternalV2(
  root: string,
  testHooks?: Readonly<{
    beforePathSync?: (absolutePath: string) => void;
    afterPathDescriptorClose?: (absolutePath: string) => void;
  }>,
): void {
  const owner = processOwner();
  let remainingMembers = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxFiles
    + CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxDirectories;
  const visit = (absolutePath: string): void => {
    const before = lstatSync(absolutePath);
    if (before.isSymbolicLink()) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED",
        "Dependency seal encountered a symbolic link",
      );
    }
    if (before.uid !== owner.uid || before.gid !== owner.gid) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED",
        "Dependency seal encountered foreign ownership",
      );
    }
    if (before.isDirectory()) {
      const names = readBoundedDirectoryNamesV2({
        absolutePath,
        label: `Dependency seal directory ${absolutePath}`,
        maxNames: remainingMembers,
        onFailure: (message, cause) => fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED",
          message,
          cause,
        ),
      });
      remainingMembers -= names.length;
      for (const name of names) {
        visit(path.join(absolutePath, name));
      }
      chmodSync(absolutePath, 0o555);
      syncPath(absolutePath, {
        beforeSync: testHooks?.beforePathSync,
        afterDescriptorClose: testHooks?.afterPathDescriptorClose,
      });
      return;
    }
    if (!before.isFile() || before.nlink !== 1) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED",
        "Dependency seal encountered a special file or hardlink",
      );
    }
    chmodSync(absolutePath, (modeBits(before) & 0o111) === 0 ? 0o444 : 0o555);
    syncPath(absolutePath, {
      beforeSync: testHooks?.beforePathSync,
      afterDescriptorClose: testHooks?.afterPathDescriptorClose,
    });
  };
  visit(root);
}

const sealDependencyTree = sealNpmDependencyTreeInternalV2;

export function assertSealedOwnedNpmDependencyTreeInternalV2(
  root: string,
): void {
  const owner = processOwner();
  let remainingMembers = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxFiles
    + CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxDirectories;
  const visit = (absolutePath: string): void => {
    const stat = lstatSync(absolutePath);
    if (
      stat.isSymbolicLink()
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || (stat.isDirectory() && modeBits(stat) !== 0o555)
      || (stat.isFile() && ![0o444, 0o555].includes(modeBits(stat)))
      || (stat.isFile() && stat.nlink !== 1)
      || (!stat.isDirectory() && !stat.isFile())
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH",
        "Sealed dependency tree ownership, mode, type or link count changed",
      );
    }
    if (stat.isDirectory()) {
      const names = readBoundedDirectoryNamesV2({
        absolutePath,
        label: `Sealed dependency directory ${absolutePath}`,
        maxNames: remainingMembers,
        onFailure: (message, cause) => fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH",
          message,
          cause,
        ),
      });
      remainingMembers -= names.length;
      for (const name of names) {
        visit(path.join(absolutePath, name));
      }
    }
  };
  visit(root);
}

const assertSealedOwnedTree =
  assertSealedOwnedNpmDependencyTreeInternalV2;

function packageRuntimeTreeHash(
  packageLocator: string,
  packageLocators: readonly string[],
  tree: CanonicalRuntimeTreeV2,
): string {
  const prefix = `${packageLocator}/`;
  const descendants = packageLocators.filter((candidate) =>
    candidate !== packageLocator && candidate.startsWith(prefix));
  const entries = tree.entries.flatMap((entry) => {
    const fullLocator = `node_modules/${entry.path}`;
    if (!fullLocator.startsWith(prefix)) return [];
    if (descendants.some((descendant) =>
      fullLocator === descendant || fullLocator.startsWith(`${descendant}/`))) {
      return [];
    }
    const relativePath = fullLocator.slice(prefix.length);
    if (!relativePath) return [];
    return [{ ...entry, path: relativePath }];
  }).sort((left, right) => compareUtf16(left.path, right.path));
  return hashCanonicalJson({
    schema: NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_V2
      .packageRuntimeTreeHashDomain,
    packageLocator,
    rootMode: "0555",
    entries,
  });
}

function lockfileRef(
  closure: NodeScaffoldProductionClosureV2,
): ProductionPackageResolutionGraphHashPayloadV2["lockfile"] {
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(
    closure.profileBinding.profileId,
  );
  const lock = entry?.scaffold.files.find((file) =>
    file.normalizedLocator === "package-lock.json");
  if (
    !entry
    || !lock
    || entry.entryHash !== closure.profileBinding.entryHash
    || lock.rawHash !== closure.sourceGraph.lockRawHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH",
      "Fresh scaffold package-lock authority no longer joins production closure",
    );
  }
  return Object.freeze({
    schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
    locator: "package-lock.json" as const,
    mediaType: "application/json" as const,
    hash: lock.rawHash,
    byteLength: lock.rawByteLength,
  });
}

function buildProductionGraph(input: Readonly<{
  nodeModulesRoot: string;
  closure: NodeScaffoldProductionClosureV2;
  dependencyTree: CanonicalRuntimeTreeV2;
}>): ProductionPackageResolutionGraphV2 {
  const packageLocators = input.closure.nodes.map((node) => node.packagePath);
  const dependencyEdges = input.closure.edges.map((edge) => ({
    ownerPackageLocator: edge.ownerPackagePath,
    kind: "dependencies" as const,
    dependencyName: edge.dependencyName,
    declaredSpec: edge.declaredSpec,
    resolvedPackageLocator:
      edge.resolvedPackagePath,
    resolvedVersion: edge.resolvedVersion,
  })).sort((left, right) =>
    compareUtf16(
      [
        left.ownerPackageLocator,
        left.kind,
        left.dependencyName,
        left.resolvedPackageLocator,
        left.declaredSpec,
        left.resolvedVersion,
      ].join("\0"),
      [
        right.ownerPackageLocator,
        right.kind,
        right.dependencyName,
        right.resolvedPackageLocator,
        right.declaredSpec,
        right.resolvedVersion,
      ].join("\0"),
    ));
  const packages: ProductionPackageResolutionEntryV2[] = input.closure.nodes.map((node) => {
    const relativePackage = relativeNodeModulesLocator(node.packagePath);
    const packageJson = readExactRegularFile({
      absolutePath: path.join(input.nodeModulesRoot, ...relativePackage.split("/"), "package.json"),
      label: `${node.packagePath}/package.json`,
      maxBytes: 4 * 1024 * 1024,
      allowedModes: [0o444],
    });
    try {
      const manifest = parseJsonObject(
        packageJson.bytes,
        `${node.packagePath}/package.json`,
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_GRAPH_INVALID",
      );
      if (manifest.name !== node.packageName || manifest.version !== node.version) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_GRAPH_INVALID",
          `Installed package identity differs for ${node.packagePath}`,
        );
      }
      const treeEntry = input.dependencyTree.entries.find((entry) =>
        entry.type === "file" && entry.path === `${relativePackage}/package.json`);
      if (
        treeEntry?.type !== "file"
        || treeEntry.contentHash !== packageJson.contentHash
        || treeEntry.byteLength !== packageJson.bytes.byteLength
      ) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_GRAPH_INVALID",
          `Installed manifest tree binding differs for ${node.packagePath}`,
        );
      }
      const dependencyLocators = input.closure.edges
        .filter((edge) => edge.ownerPackagePath === node.packagePath)
        .map((edge) => edge.resolvedPackagePath)
        .sort(compareUtf16);
      return {
        schema: PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
        packageLocator: node.packagePath,
        packageName: node.packageName,
        version: node.version,
        lockEntryHash: node.lockEntryHash,
        packageJsonHash: packageJson.contentHash,
        runtimeTreeHash: packageRuntimeTreeHash(
          node.packagePath,
          packageLocators,
          input.dependencyTree,
        ),
        dependencyLocators,
      };
    } finally {
      packageJson.bytes.fill(0);
    }
  });
  packages.sort((left, right) =>
    compareUtf16(left.packageLocator, right.packageLocator));
  const identity: ProductionPackageResolutionGraphHashPayloadV2 = {
    schema: PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
    version: "2.0.0",
    lockfileVersion: 3,
    lockfile: lockfileRef(input.closure),
    materializedDependencyTreeHash: input.dependencyTree.treeHash,
    productionClosureHash: input.closure.closureHash,
    productionClosureContractHash:
      input.closure.contractHash,
    dependencyEdgeModel: "dependencies_only",
    rootDependencyLocators: input.closure.rootDependencies
      .map((dependency) => dependency.resolvedPackagePath)
      .sort(compareUtf16),
    dependencyEdges,
    packages,
    packageCount: packages.length,
  };
  const parsed = ProductionPackageResolutionGraphV2Schema.safeParse({
    ...identity,
    resolutionGraphHash: hashProductionPackageResolutionGraphV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_GRAPH_INVALID",
      parsed.error.issues[0]?.message
        ?? "Production package graph failed its canonical schema",
      parsed.error,
    );
  }
  return Object.freeze(parsed.data);
}

function validateInstalledLockAndPackages(input: Readonly<{
  nodeModulesRoot: string;
  closure: NodeScaffoldProductionClosureV2;
  rawEntries: readonly RawInstallEntryV2[];
}>): Readonly<{
  hiddenLockRawHash: string;
  binDirectories: readonly string[];
}> {
  const bundleRoot = path.dirname(input.nodeModulesRoot);
  const rootLockFile = readExactRegularFile({
    absolutePath: path.join(bundleRoot, "package-lock.json"),
    label: "Candidate package-lock.json",
    maxBytes: 16 * 1024 * 1024,
    allowedModes: [0o444],
  });
  const hiddenEntry = input.rawEntries.find((entry) =>
    entry.locator === ".package-lock.json");
  if (
    rootLockFile.contentHash !== input.closure.sourceGraph.lockRawHash
    || hiddenEntry?.type !== "file"
    || input.rawEntries.some((entry) =>
      entry.locator !== ".package-lock.json"
      && entry.locator.endsWith("/.package-lock.json"))
  ) {
    rootLockFile.bytes.fill(0);
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
      "Candidate root or hidden package lock differs from code-owned authority",
    );
  }
  const hiddenLockFile = readExactRegularFile({
    absolutePath: path.join(input.nodeModulesRoot, ".package-lock.json"),
    label: "Candidate npm hidden package lock",
    maxBytes: 16 * 1024 * 1024,
  });
  try {
    if (hiddenLockFile.contentHash !== hiddenEntry.contentHash) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
        "Candidate npm hidden lock changed after raw-tree capture",
      );
    }
    const rootLock = parseJsonObject(rootLockFile.bytes, "Candidate package-lock.json");
    const hiddenLock = parseJsonObject(
      hiddenLockFile.bytes,
      "Candidate npm hidden package lock",
    );
    if (
      !isPlainRecord(rootLock.packages)
      || !isPlainRecord(hiddenLock.packages)
      || hiddenLock.lockfileVersion !== 3
      || hiddenLock.requires !== true
      || hiddenLock.name !== rootLock.name
      || hiddenLock.version !== rootLock.version
      || !sameStrings(Object.keys(hiddenLock).sort(compareUtf16), [
        "lockfileVersion",
        "name",
        "packages",
        "requires",
        "version",
      ])
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
        "Candidate npm hidden lock root identity is not exact",
      );
    }
    const rootPackages = rootLock.packages;
    const hiddenPackages = hiddenLock.packages;
    const expectedPackagePaths = input.closure.nodes.map((node) => node.packagePath);
    if (!sameStrings(
      Object.keys(hiddenPackages).sort(compareUtf16),
      [...expectedPackagePaths].sort(compareUtf16),
    )) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
        "Candidate hidden lock package membership differs from production closure",
      );
    }
    for (const node of input.closure.nodes) {
      const rootEntry = rootPackages[node.packagePath];
      const installedEntry = hiddenPackages[node.packagePath];
      if (
        !isPlainRecord(rootEntry)
        || !isPlainRecord(installedEntry)
        || hashCanonicalJson(rootEntry) !== node.lockEntryHash
        || canonicalJsonStringify(rootEntry)
          !== canonicalJsonStringify(installedEntry)
      ) {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
          `Candidate hidden lock entry differs for ${node.packagePath}`,
        );
      }
      const packageJsonLocator = `${relativeNodeModulesLocator(node.packagePath)}/package.json`;
      const packageJsonEntry = input.rawEntries.find((entry) =>
        entry.locator === packageJsonLocator);
      if (packageJsonEntry?.type !== "file") {
        return fail(
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
          `Installed package manifest is absent for ${node.packagePath}`,
        );
      }
      const packageJson = readExactRegularFile({
        absolutePath: path.join(
          input.nodeModulesRoot,
          ...relativeNodeModulesLocator(node.packagePath).split("/"),
          "package.json",
        ),
        label: `${node.packagePath}/package.json`,
        maxBytes: 4 * 1024 * 1024,
      });
      try {
        const manifest = parseJsonObject(
          packageJson.bytes,
          `${node.packagePath}/package.json`,
          "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        );
        if (
          manifest.name !== node.packageName
          || manifest.version !== node.version
          || packageJson.contentHash !== packageJsonEntry.contentHash
        ) {
          return fail(
            "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
            `Installed package identity differs for ${node.packagePath}`,
          );
        }
      } finally {
        packageJson.bytes.fill(0);
      }
    }
    validateEveryAndOnlyPackageRoots(
      input.nodeModulesRoot,
      input.rawEntries,
      expectedPackagePaths,
    );
    const binDirectories = validateBins(
      input.rawEntries,
      expectedBins(rootPackages, input.closure),
    );
    return Object.freeze({
      hiddenLockRawHash: hiddenLockFile.contentHash,
      binDirectories,
    });
  } finally {
    rootLockFile.bytes.fill(0);
    hiddenLockFile.bytes.fill(0);
  }
}

function assertRootLockAuthority(
  nodeModulesRoot: string,
  closure: NodeScaffoldProductionClosureV2,
): void {
  const rootLock = readExactRegularFile({
    absolutePath: path.join(path.dirname(nodeModulesRoot), "package-lock.json"),
    label: "Candidate package-lock.json",
    maxBytes: 16 * 1024 * 1024,
    allowedModes: [0o444],
  });
  try {
    if (
      rootLock.contentHash !== closure.sourceGraph.lockRawHash
      || rootLock.bytes.byteLength !== lockfileRef(closure).byteLength
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID",
        "Candidate package-lock.json changed across dependency capture",
      );
    }
  } finally {
    rootLock.bytes.fill(0);
  }
}

function assertSealedClosureMembership(
  nodeModulesRoot: string,
  closure: NodeScaffoldProductionClosureV2,
): void {
  const entries = captureRawInstallTree(nodeModulesRoot);
  if (entries.some((entry) =>
    entry.type === "symbolic_link"
    || entry.locator === ".package-lock.json"
    || entry.locator.endsWith("/.package-lock.json")
    || entry.locator.split("/").includes(".bin"))) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH",
      "Sealed production tree retained generated npm metadata or symbolic links",
    );
  }
  validateEveryAndOnlyPackageRoots(
    nodeModulesRoot,
    entries,
    closure.nodes.map((node) => node.packagePath),
  );
}

function exactRoot(nodeModulesRoot: string, phase: "raw" | "sealed"): void {
  const owner = processOwner();
  if (
    !path.isAbsolute(nodeModulesRoot)
    || path.basename(nodeModulesRoot) !== "node_modules"
    || path.basename(path.dirname(nodeModulesRoot)) !== "candidate-bundle"
  ) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Production materialization requires one direct candidate-bundle/node_modules root",
    );
  }
  try {
    const stat = lstatSync(nodeModulesRoot);
    const allowedModes = phase === "raw" ? [0o700, 0o755] : [0o555];
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(nodeModulesRoot) !== nodeModulesRoot
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || !allowedModes.includes(modeBits(stat))
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
        "Production node_modules root is not one direct process-owned directory",
      );
    }
  } catch (error) {
    if (error instanceof NodeScaffoldProductionMaterializationErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Production node_modules root could not be authenticated",
      error,
    );
  }
}

export function materializeNodeScaffoldProductionDependenciesInternalV2(
  input: unknown,
): NodeScaffoldProductionMaterializationV2 {
  const values = exactDataRecord(input, [
    "admissionScope",
    "nodeModulesRoot",
    "productionClosure",
  ]);
  if (
    (values.admissionScope !== "production_host"
      && values.admissionScope !== "test_fixture")
    || typeof values.nodeModulesRoot !== "string"
  ) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Production materialization input is not exact",
    );
  }
  const admissionScope = values.admissionScope;
  const nodeModulesRoot = values.nodeModulesRoot;
  const closure = verifyCodeOwnedNodeScaffoldProductionClosureV2(
    values.productionClosure,
  );
  exactRoot(nodeModulesRoot, "raw");
  try {
    const rawEntries = captureRawInstallTree(nodeModulesRoot);
    const validated = validateInstalledLockAndPackages({
      nodeModulesRoot,
      closure,
      rawEntries,
    });
    const rawRevalidated = captureRawInstallTree(nodeModulesRoot);
    if (
      canonicalJsonStringify(rawRevalidated)
        !== canonicalJsonStringify(rawEntries)
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        "Production install tree changed after its exact lock and package validation",
      );
    }
    assertRootLockAuthority(nodeModulesRoot, closure);
    removeRawNpmInstallExactOwnedObjectsInternalV2({
      entries: rawEntries,
      nodeModulesRoot,
      locators: [
        ".package-lock.json",
        ...validated.binDirectories,
      ],
      onFailure: (message, cause) => fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID",
        message,
        cause,
      ),
    });
    syncPath(nodeModulesRoot);
    if (admissionScope === "production_host") {
      normalizeDarwinMetadata(nodeModulesRoot);
    }
    sealDependencyTree(nodeModulesRoot);
    assertSealedClosureMembership(nodeModulesRoot, closure);
    const probe = metadataProbe(admissionScope);
    const dependencyTree = admissionScope === "production_host"
      ? captureCanonicalRuntimeTreeV2({
          root: nodeModulesRoot,
          profile: "dependencies",
          metadataProbe: probe,
        })
      : captureCanonicalRuntimeTreeV2ForTest({
          root: nodeModulesRoot,
          profile: "dependencies",
          metadataProbe: probe,
        });
    const productionGraph = buildProductionGraph({
      nodeModulesRoot,
      closure,
      dependencyTree,
    });
    assertRootLockAuthority(nodeModulesRoot, closure);
    return Object.freeze({
      profileId: closure.profileBinding.profileId,
      productionClosureHash: closure.closureHash,
      hiddenLockRawHash: validated.hiddenLockRawHash,
      rawInstallMembershipHash: hashCanonicalJson({
        schema: "setfarm.node-scaffold-production-raw-install-membership.v2",
        entries: rawEntries,
      }),
      dependencyTree,
      productionGraph,
    });
  } catch (error) {
    if (error instanceof NodeScaffoldProductionMaterializationErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED",
      "Production dependency tree could not be materialized",
      error,
    );
  }
}

export function revalidateNodeScaffoldProductionDependenciesInternalV2(
  input: unknown,
): NodeScaffoldProductionVerificationV2 {
  const values = exactDataRecord(input, [
    "admissionScope",
    "dependencyTree",
    "nodeModulesRoot",
    "productionClosure",
    "productionGraph",
  ]);
  if (
    (values.admissionScope !== "production_host"
      && values.admissionScope !== "test_fixture")
    || typeof values.nodeModulesRoot !== "string"
  ) {
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID",
      "Production dependency verifier input is not exact",
    );
  }
  const admissionScope = values.admissionScope;
  const nodeModulesRoot = values.nodeModulesRoot;
  const closure = verifyCodeOwnedNodeScaffoldProductionClosureV2(
    values.productionClosure,
  );
  exactRoot(nodeModulesRoot, "sealed");
  assertSealedOwnedTree(nodeModulesRoot);
  assertSealedClosureMembership(nodeModulesRoot, closure);
  try {
    const tree = verifyCanonicalRuntimeTreeV2({
      root: nodeModulesRoot,
      candidate: values.dependencyTree,
      metadataProbe: metadataProbe(admissionScope),
    });
    const graph = buildProductionGraph({
      nodeModulesRoot,
      closure,
      dependencyTree: tree,
    });
    const candidateGraph = ProductionPackageResolutionGraphV2Schema.parse(
      values.productionGraph,
    );
    if (
      canonicalJsonStringify(graph) !== canonicalJsonStringify(candidateGraph)
    ) {
      return fail(
        "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH",
        "Production dependency graph no longer reproduces from sealed bytes",
      );
    }
    return Object.freeze({
      profileId: closure.profileBinding.profileId,
      productionClosureHash: closure.closureHash,
      dependencyTree: tree,
      productionGraph: graph,
    });
  } catch (error) {
    if (error instanceof NodeScaffoldProductionMaterializationErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH",
      "Production dependency authority could not be freshly reproduced",
      error,
    );
  }
}
