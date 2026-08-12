import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildPackageLifecyclePhysicalProjectionV2,
  buildStableFsObjectIdentityV2,
  parseBootstrapFilesystemScopeIdentityCandidateV2,
  type BootstrapFilesystemScopeIdentityV2,
  type NamespacePhysicalCensusV2,
  type PackageLifecyclePhysicalProjectionV2,
  type StableFsObjectIdentityV2,
  type StableFsObjectKindV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2,
  type PlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2,
} from "./platform-release-bootstrap-registry-activation-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
  type PlatformReleaseBootstrapNamespaceCensusV2,
} from "./platform-release-bootstrap-registry-v2.js";

const STREAM_HEADER_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2";
const STREAM_PARENT_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2";
const STREAM_LOCKS_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2";
const STREAM_ENTRY_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const STREAM_FOOTER_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v2";
const MAPPING_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-mapping.v2";
const CAPABILITY_V2 = "darwin_read_only_aggregate_census_fixture_v2";
const OBSERVATION_AUTHORITY_V2 =
  "fixture_evidence_only_never_backend_capability_v2";
const SIGNING_AUTHORITY_V2 = "adhoc_or_unsigned_test_fixture";
const LOCK_ORDER_V2 = Object.freeze([
  "shared_parent_lock",
  "registered_node_package_lock",
] as const);

const MAX_STDOUT_BYTES_V2 = 64 * 1024 * 1024;
const MAX_STDERR_BYTES_V2 = 4 * 1024;
const MAX_BASENAME_BYTES_V2 = 255;
const MAX_FILE_BYTES_V2 = 1024 * 1024;
const MAX_TOTAL_FILE_BYTES_V2 = 8 * 1024 * 1024;
const MAX_TOTAL_NESTED_MEMBERS_V2 = 65_536;
const NANOSECONDS_PER_SECOND_V2 = 1_000_000_000n;
const SHARED_PARENT_LOCK_CONTENT_V2 =
  "setfarm.bootstrap-package-registry-parent-lock.v2\n";
const NODE_PACKAGE_LOCK_CONTENT_V2 =
  "setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n";
const TYPED_ARRAY_PROTOTYPE_V2 = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_GETTER_V2 = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE_V2,
  "buffer",
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER_V2 = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE_V2,
  "byteLength",
)!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER_V2 = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE_V2,
  "byteOffset",
)!.get!;

type JsonRecordV2 = Record<string, unknown>;

type NativeStableV2 = Readonly<{
  objectKind: StableFsObjectKindV2;
  device: string;
  inode: string;
}>;

type NativeMutableV2 = Readonly<{
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: number;
  byteLength: number;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;

type NormalizedEntryV2 = Readonly<{
  basename: string;
  basenameBytes: Buffer;
  stable: NativeStableV2;
  mutable: NativeMutableV2;
  content:
    | Readonly<{
        kind: "bounded_regular_file_bytes";
        bytes: Buffer;
        rawContentHash: string;
      }>
    | Readonly<{
        kind: "directory_membership";
        orderedEntries: readonly Readonly<{
          basename: string;
          objectKind: StableFsObjectKindV2;
        }>[];
      }>;
}>;

type HeldLockEvidenceV2 = Readonly<{
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: ReturnType<typeof buildFsObservationFingerprintV2>;
}>;

export type PlatformReleaseBootstrapDarwinAggregateCensusFixtureProcessResultV2 =
  Readonly<{
    exitCode: number | null;
    signal: string | null;
    stdout: Uint8Array;
    stderr: Uint8Array;
  }>;

type SnapshottedByteChannelV2 = Readonly<{
  buffer: ArrayBuffer;
  byteLength: number;
  byteOffset: number;
}>;

type SnapshottedProcessResultV2 = Readonly<{
  exitCode: number | null;
  signal: string | null;
  stdout: SnapshottedByteChannelV2;
  stderr: SnapshottedByteChannelV2;
}>;

export type PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2 =
  Readonly<{
    schema: typeof MAPPING_SCHEMA_V2;
    admissionScope: "test_fixture";
    capability: typeof CAPABILITY_V2;
    productionAuthority: false;
    signingAuthority: typeof SIGNING_AUTHORITY_V2;
    observationAuthority: typeof OBSERVATION_AUTHORITY_V2;
    capturePasses: 2;
    lockOrder: typeof LOCK_ORDER_V2;
    filesystemScope: BootstrapFilesystemScopeIdentityV2;
    logicalCensus: PlatformReleaseBootstrapNamespaceCensusV2;
    physicalCensus: NamespacePhysicalCensusV2;
    nodeLogicalProjection:
      PlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2;
    nodePhysicalProjection: PackageLifecyclePhysicalProjectionV2;
    heldLocks: Readonly<{
      lockOrder: typeof LOCK_ORDER_V2;
      sharedParentLock: HeldLockEvidenceV2;
      registeredNodePackageLock: HeldLockEvidenceV2;
    }>;
  }>;

export type PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorCodeV2 =
  | "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID"
  | "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID"
  | "DARWIN_AGGREGATE_CENSUS_FIXTURE_SCOPE_INVALID"
  | "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID";

export class PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2
  extends TypeError {
  constructor(
    readonly code:
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name =
      "PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function isRecordV2(value: unknown): value is JsonRecordV2 {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function snapshotByteChannelV2(value: unknown): SnapshottedByteChannelV2 {
  if (
    value === null
    || typeof value !== "object"
    || nodeUtilTypes.isProxy(value)
    || (
      Object.getPrototypeOf(value) !== Buffer.prototype
      && Object.getPrototypeOf(value) !== Uint8Array.prototype
    )
    || ["buffer", "byteLength", "byteOffset", "length"].some(
      (key) => Object.getOwnPropertyDescriptor(value, key) !== undefined,
    )
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
      "Aggregate census output must use exact unshadowed byte arrays",
    );
  }
  const buffer = TYPED_ARRAY_BUFFER_GETTER_V2.call(value) as unknown;
  const byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER_V2.call(value) as unknown;
  const byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER_V2.call(value) as unknown;
  if (
    buffer === null
    || typeof buffer !== "object"
    || nodeUtilTypes.isProxy(buffer)
    || !(buffer instanceof ArrayBuffer)
    || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    || typeof byteLength !== "number"
    || !Number.isSafeInteger(byteLength)
    || byteLength < 0
    || typeof byteOffset !== "number"
    || !Number.isSafeInteger(byteOffset)
    || byteOffset < 0
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
      "Aggregate census output must use exact non-shared byte arrays",
    );
  }
  return Object.freeze({
    buffer: buffer as ArrayBuffer,
    byteLength,
    byteOffset,
  });
}

function snapshotProcessResultV2(
  input: PlatformReleaseBootstrapDarwinAggregateCensusFixtureProcessResultV2,
): SnapshottedProcessResultV2 {
  try {
    if (
      input === null
      || typeof input !== "object"
      || nodeUtilTypes.isProxy(input)
      || Object.getPrototypeOf(input) !== Object.prototype
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
        "Fixture process result must be one non-proxy plain record",
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = ["exitCode", "signal", "stdout", "stderr"] as const;
    if (
      Reflect.ownKeys(descriptors).length !== keys.length
      || keys.some((key) => {
        const descriptor = descriptors[key];
        return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
      })
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
        "Fixture process result must expose only exact enumerable data properties",
      );
    }
    const stdout = descriptors.stdout!.value as unknown;
    const stderr = descriptors.stderr!.value as unknown;
    const snapshottedStdout = snapshotByteChannelV2(stdout);
    const snapshottedStderr = snapshotByteChannelV2(stderr);
    if (
      snapshottedStdout.byteLength > MAX_STDOUT_BYTES_V2
      || snapshottedStderr.byteLength > MAX_STDERR_BYTES_V2
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
        "Fixture process output exceeds its pre-copy byte bounds",
      );
    }
    return Object.freeze({
      exitCode: descriptors.exitCode!.value as number | null,
      signal: descriptors.signal!.value as string | null,
      stdout: snapshottedStdout,
      stderr: snapshottedStderr,
    });
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2
    ) {
      throw error;
    }
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
      "Fixture process result could not be snapshotted safely",
      error,
    );
  }
}

function exactRecordV2(
  value: unknown,
  keys: readonly string[],
  label: string,
): JsonRecordV2 {
  if (
    !isRecordV2(value)
    || Object.keys(value).length !== keys.length
    || Object.keys(value).some((key, index) => key !== keys[index])
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} does not have its exact ordered key set`,
    );
  }
  return value;
}

function exactLiteralV2<T extends string | number | boolean>(
  value: unknown,
  expected: T,
  label: string,
): T {
  if (value !== expected) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} does not equal its fixed contract value`,
    );
  }
  return expected;
}

function safeIntegerV2(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} is outside its exact integer bound`,
    );
  }
  return value;
}

function canonicalUnsignedDecimalV2(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} is not one canonical unsigned decimal`,
    );
  }
  return value;
}

function canonicalSignedDecimalV2(value: unknown, label: string): string {
  if (
    typeof value !== "string"
    || !/^(?:0|-?[1-9][0-9]*)$/u.test(value)
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} is not one canonical signed decimal`,
    );
  }
  return value;
}

function timestampNanosecondsV2(
  seconds: unknown,
  nanoseconds: unknown,
  label: string,
): string {
  const parsedSeconds = canonicalSignedDecimalV2(seconds, `${label} seconds`);
  const parsedNanoseconds = canonicalUnsignedDecimalV2(
    nanoseconds,
    `${label} nanoseconds`,
  );
  const fraction = BigInt(parsedNanoseconds);
  if (fraction >= NANOSECONDS_PER_SECOND_V2) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} nanoseconds exceed one canonical second`,
    );
  }
  const total = BigInt(parsedSeconds) * NANOSECONDS_PER_SECOND_V2 + fraction;
  if (total < 0n) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID",
      `${label} cannot map to the unsigned physical fingerprint contract`,
    );
  }
  return total.toString(10);
}

function canonicalBase64V2(
  value: unknown,
  maxBytes: number,
  allowEmpty: boolean,
  label: string,
): Buffer {
  if (
    typeof value !== "string"
    || (!allowEmpty && value.length === 0)
    || value.length > Math.ceil(maxBytes / 3) * 4
    || (
      value !== ""
      && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
        .test(value)
    )
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} is not bounded canonical base64`,
    );
  }
  const decoded = Buffer.from(value, "base64");
  if (
    decoded.byteLength > maxBytes
    || decoded.toString("base64") !== value
  ) {
    decoded.fill(0);
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} does not round-trip as bounded canonical base64`,
    );
  }
  return decoded;
}

function strictBasenameV2(value: unknown, label: string): Readonly<{
  basename: string;
  bytes: Buffer;
}> {
  const bytes = canonicalBase64V2(
    value,
    MAX_BASENAME_BYTES_V2,
    false,
    label,
  );
  let basename: string;
  try {
    basename = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    bytes.fill(0);
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} is not strict UTF-8`,
      error,
    );
  }
  if (
    !Buffer.from(basename, "utf8").equals(bytes)
    || basename === "."
    || basename === ".."
    || basename.includes("/")
    || basename.includes("\\")
    || basename.includes("\0")
  ) {
    bytes.fill(0);
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} is not one exact direct-child basename`,
    );
  }
  return Object.freeze({ basename, bytes });
}

function stableV2(value: unknown, label: string): NativeStableV2 {
  const record = exactRecordV2(
    value,
    ["objectKind", "device", "inode"],
    `${label} stable identity`,
  );
  if (
    record.objectKind !== "ordinary_file"
    && record.objectKind !== "directory"
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} object kind is not supported`,
    );
  }
  return Object.freeze({
    objectKind: record.objectKind,
    device: canonicalUnsignedDecimalV2(record.device, `${label} device`),
    inode: canonicalUnsignedDecimalV2(record.inode, `${label} inode`),
  });
}

function mutableV2(value: unknown, label: string): NativeMutableV2 {
  const record = exactRecordV2(
    value,
    [
      "ownerUid",
      "ownerGid",
      "mode",
      "linkCount",
      "byteLength",
      "modifiedSeconds",
      "modifiedNanoseconds",
      "changedSeconds",
      "changedNanoseconds",
    ],
    `${label} mutable fingerprint`,
  );
  if (typeof record.mode !== "string" || !/^0[0-7]{3}$/u.test(record.mode)) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} mode is not one canonical four-octal string`,
    );
  }
  return Object.freeze({
    ownerUid: safeIntegerV2(record.ownerUid, 0, 2_147_483_647, `${label} uid`),
    ownerGid: safeIntegerV2(record.ownerGid, 0, 2_147_483_647, `${label} gid`),
    mode: record.mode,
    linkCount: safeIntegerV2(
      record.linkCount,
      1,
      Number.MAX_SAFE_INTEGER,
      `${label} link count`,
    ),
    byteLength: safeIntegerV2(
      record.byteLength,
      0,
      Number.MAX_SAFE_INTEGER,
      `${label} byte length`,
    ),
    modifiedTimeNanoseconds: timestampNanosecondsV2(
      record.modifiedSeconds,
      record.modifiedNanoseconds,
      `${label} modified time`,
    ),
    changedTimeNanoseconds: timestampNanosecondsV2(
      record.changedSeconds,
      record.changedNanoseconds,
      `${label} changed time`,
    ),
  });
}

function parseFrameLineV2(line: string, index: number): unknown {
  if (
    line.length === 0
    || line.includes("\r")
    || Buffer.byteLength(line, "utf8") > MAX_STDOUT_BYTES_V2
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `NDJSON frame ${index} violates its exact byte boundary`,
    );
  }
  try {
    const parsed: unknown = JSON.parse(line);
    if (JSON.stringify(parsed) !== line) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        `NDJSON frame ${index} is not exact compact JSON`,
      );
    }
    return parsed;
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2
    ) {
      throw error;
    }
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `NDJSON frame ${index} is malformed`,
      error,
    );
  }
}

function parseHeaderV2(value: unknown): void {
  const record = exactRecordV2(
    value,
    [
      "schema",
      "admissionScope",
      "capability",
      "productionAuthority",
      "signingAuthority",
      "observationAuthority",
      "capturePasses",
      "lockOrder",
    ],
    "NDJSON header",
  );
  exactLiteralV2(record.schema, STREAM_HEADER_SCHEMA_V2, "header schema");
  exactLiteralV2(record.admissionScope, "test_fixture", "admission scope");
  exactLiteralV2(record.capability, CAPABILITY_V2, "fixture capability");
  exactLiteralV2(record.productionAuthority, false, "production authority");
  exactLiteralV2(record.signingAuthority, SIGNING_AUTHORITY_V2, "signing authority");
  exactLiteralV2(
    record.observationAuthority,
    OBSERVATION_AUTHORITY_V2,
    "observation authority",
  );
  exactLiteralV2(record.capturePasses, 2, "capture pass count");
  exactLockOrderV2(record.lockOrder, "Header");
}

function exactLockOrderV2(value: unknown, label: string): void {
  if (
    !Array.isArray(value)
    || value.length !== LOCK_ORDER_V2.length
    || value.some((lock, index) => lock !== LOCK_ORDER_V2[index])
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} lock order does not equal the fixed fixture lock vector`,
    );
  }
}

function parseParentV2(value: unknown): Readonly<{
  stable: NativeStableV2;
  mutable: NativeMutableV2;
}> {
  const record = exactRecordV2(
    value,
    ["schema", "stable", "mutable"],
    "NDJSON parent",
  );
  exactLiteralV2(record.schema, STREAM_PARENT_SCHEMA_V2, "parent schema");
  const stable = stableV2(record.stable, "parent");
  if (stable.objectKind !== "directory") {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      "Aggregate census parent must be one directory",
    );
  }
  return Object.freeze({
    stable,
    mutable: mutableV2(record.mutable, "parent"),
  });
}

function parseHeldLockV2(value: unknown, label: string): Readonly<{
  stable: NativeStableV2;
  mutable: NativeMutableV2;
}> {
  const record = exactRecordV2(
    value,
    ["stable", "mutable"],
    label,
  );
  const stable = stableV2(record.stable, label);
  if (stable.objectKind !== "ordinary_file") {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} must identify one ordinary lock file`,
    );
  }
  return Object.freeze({
    stable,
    mutable: mutableV2(record.mutable, label),
  });
}

function parseLocksV2(value: unknown): Readonly<{
  sharedParentLock: ReturnType<typeof parseHeldLockV2>;
  registeredNodePackageLock: ReturnType<typeof parseHeldLockV2>;
}> {
  const record = exactRecordV2(
    value,
    [
      "schema",
      "lockOrder",
      "sharedParentLock",
      "registeredNodePackageLock",
    ],
    "NDJSON locks frame",
  );
  exactLiteralV2(record.schema, STREAM_LOCKS_SCHEMA_V2, "locks schema");
  exactLockOrderV2(record.lockOrder, "Locks frame");
  return Object.freeze({
    sharedParentLock: parseHeldLockV2(
      record.sharedParentLock,
      "held shared parent lock",
    ),
    registeredNodePackageLock: parseHeldLockV2(
      record.registeredNodePackageLock,
      "held registered Node package lock",
    ),
  });
}

function parseEntryV2(
  value: unknown,
  index: number,
  counters: { totalFileBytes: number; totalNestedMembers: number },
  ownedBuffers: Buffer[],
): NormalizedEntryV2 {
  const label = `entry ${index}`;
  const record = exactRecordV2(
    value,
    ["schema", "basenameBase64", "stable", "mutable", "content"],
    label,
  );
  exactLiteralV2(record.schema, STREAM_ENTRY_SCHEMA_V2, `${label} schema`);
  const decodedBasename = strictBasenameV2(
    record.basenameBase64,
    `${label} basename`,
  );
  ownedBuffers.push(decodedBasename.bytes);
  const stable = stableV2(record.stable, label);
  const mutable = mutableV2(record.mutable, label);
  const content = exactRecordV2(
    record.content,
    stable.objectKind === "ordinary_file"
      ? ["kind", "byteLength", "contentBase64"]
      : ["kind", "members"],
    `${label} content`,
  );

  if (stable.objectKind === "ordinary_file") {
    exactLiteralV2(
      content.kind,
      "bounded_regular_file_bytes",
      `${label} content kind`,
    );
    const byteLength = safeIntegerV2(
      content.byteLength,
      0,
      MAX_FILE_BYTES_V2,
      `${label} content byte length`,
    );
    const bytes = canonicalBase64V2(
      content.contentBase64,
      MAX_FILE_BYTES_V2,
      true,
      `${label} content bytes`,
    );
    ownedBuffers.push(bytes);
    counters.totalFileBytes += bytes.byteLength;
    if (
      bytes.byteLength !== byteLength
      || byteLength !== mutable.byteLength
      || counters.totalFileBytes > MAX_TOTAL_FILE_BYTES_V2
    ) {
      bytes.fill(0);
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        `${label} file bytes do not join their exact occurrence length bounds`,
      );
    }
    return Object.freeze({
      basename: decodedBasename.basename,
      basenameBytes: decodedBasename.bytes,
      stable,
      mutable,
      content: Object.freeze({
        kind: "bounded_regular_file_bytes" as const,
        bytes,
        rawContentHash: createHash("sha256").update(bytes).digest("hex"),
      }),
    });
  }

  exactLiteralV2(
    content.kind,
    "directory_membership",
    `${label} content kind`,
  );
  if (!Array.isArray(content.members)) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} directory members are not one bounded array`,
    );
  }
  const members = content.members;
  counters.totalNestedMembers += members.length;
  if (
    members.length > PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2
    || counters.totalNestedMembers > MAX_TOTAL_NESTED_MEMBERS_V2
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} directory membership exceeds its fixed aggregate bound`,
    );
  }
  const rawOrderedEntries = members.map((member, memberIndex) => {
    const memberRecord = exactRecordV2(
      member,
      ["basenameBase64", "objectKind"],
      `${label} member ${memberIndex}`,
    );
    const decoded = strictBasenameV2(
      memberRecord.basenameBase64,
      `${label} member ${memberIndex} basename`,
    );
    ownedBuffers.push(decoded.bytes);
    if (
      memberRecord.objectKind !== "ordinary_file"
      && memberRecord.objectKind !== "directory"
    ) {
      decoded.bytes.fill(0);
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        `${label} member ${memberIndex} has an invalid object kind`,
      );
    }
    if (memberIndex > 0) {
      const prior = members[memberIndex - 1] as JsonRecordV2;
      const priorBytes = canonicalBase64V2(
        prior.basenameBase64,
        MAX_BASENAME_BYTES_V2,
        false,
        `${label} prior member basename`,
      );
      const order = Buffer.compare(priorBytes, decoded.bytes);
      priorBytes.fill(0);
      if (order >= 0) {
        decoded.bytes.fill(0);
        failV2(
          "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
          `${label} members are not unique and strictly raw-byte ordered`,
        );
      }
    }
    decoded.bytes.fill(0);
    return Object.freeze({
      basename: decoded.basename,
      objectKind: memberRecord.objectKind,
    });
  });
  const decodedBasenames = new Set(
    rawOrderedEntries.map((entry) => entry.basename),
  );
  if (decodedBasenames.size !== rawOrderedEntries.length) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      `${label} members contain a duplicate decoded basename`,
    );
  }
  const orderedEntries = [...rawOrderedEntries].sort((left, right) =>
    left.basename < right.basename ? -1 : left.basename > right.basename ? 1 : 0);
  return Object.freeze({
    basename: decodedBasename.basename,
    basenameBytes: decodedBasename.bytes,
    stable,
    mutable,
    content: Object.freeze({
      kind: "directory_membership" as const,
      orderedEntries: Object.freeze(orderedEntries),
    }),
  });
}

function parseFooterV2(
  value: unknown,
  entryCount: number,
  frameCount: number,
): void {
  const record = exactRecordV2(
    value,
    ["schema", "entryCount", "frameCount", "completed"],
    "NDJSON footer",
  );
  exactLiteralV2(record.schema, STREAM_FOOTER_SCHEMA_V2, "footer schema");
  if (
    safeIntegerV2(
      record.entryCount,
      0,
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
      "footer entry count",
    ) !== entryCount
    || safeIntegerV2(
      record.frameCount,
      4,
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2 + 4,
      "footer frame count",
    ) !== frameCount
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
      "Footer counts do not equal the exact completed stream",
    );
  }
  exactLiteralV2(record.completed, true, "footer completion marker");
}

function buildFingerprintV2(
  objectIdentity: StableFsObjectIdentityV2,
  mutable: NativeMutableV2,
) {
  return buildFsObservationFingerprintV2({
    objectIdentity,
    ...mutable,
  });
}

function assertFixedLockEntryV2(
  entry: NormalizedEntryV2,
  parent: Readonly<{ stable: NativeStableV2; mutable: NativeMutableV2 }>,
  expectedContent: string,
  label: string,
): void {
  if (
    entry.stable.objectKind !== "ordinary_file"
    || entry.stable.device !== parent.stable.device
    || entry.mutable.ownerUid !== parent.mutable.ownerUid
    || entry.mutable.ownerGid !== parent.mutable.ownerGid
    || entry.mutable.mode !== "0600"
    || entry.mutable.linkCount !== 1
    || entry.content.kind !== "bounded_regular_file_bytes"
    || entry.content.bytes.byteLength !== Buffer.byteLength(expectedContent, "utf8")
    || entry.content.bytes.toString("utf8") !== expectedContent
  ) {
    failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID",
      `${label} does not equal its fixed bytes and physical metadata contract`,
    );
  }
}

function mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamCoreV2(
  input: Uint8Array,
): PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2 {
  let stdout: Buffer | undefined;
  const ownedEntryBuffers: Buffer[] = [];
  try {
    const snapshottedStdout = snapshotByteChannelV2(input);
    if (snapshottedStdout.byteLength > MAX_STDOUT_BYTES_V2) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
        "Aggregate census evidence stream exceeds its pre-copy byte bound",
      );
    }
    stdout = Buffer.from(new Uint8Array(
      snapshottedStdout.buffer,
      snapshottedStdout.byteOffset,
      snapshottedStdout.byteLength,
    ));
    if (
      stdout.byteLength === 0
      || stdout.byteLength > MAX_STDOUT_BYTES_V2
      || stdout.at(-1) !== 0x0a
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        "Native aggregate census stdout violates its exact EOF boundary",
      );
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
    } catch (error) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        "Native aggregate census stdout is not strict UTF-8",
        error,
      );
    }
    if (!Buffer.from(text, "utf8").equals(stdout)) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        "Native aggregate census stdout does not round-trip as strict UTF-8",
      );
    }
    const lines = text.slice(0, -1).split("\n");
    if (
      lines.length < 4
      || lines.length > PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2 + 4
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        "Native aggregate census frame count exceeds its exact bound",
      );
    }
    const frames = lines.map(parseFrameLineV2);
    parseHeaderV2(frames[0]);
    const parent = parseParentV2(frames[1]);
    const locks = parseLocksV2(frames[2]);
    const entryCount = frames.length - 4;
    const counters = { totalFileBytes: 0, totalNestedMembers: 0 };
    const rawOrderedEntries = frames.slice(3, -1).map((frame, index) =>
      parseEntryV2(frame, index, counters, ownedEntryBuffers));
    for (let index = 0; index < rawOrderedEntries.length; index += 1) {
      const entry = rawOrderedEntries[index]!;
      if (
        index > 0
        && Buffer.compare(
          rawOrderedEntries[index - 1]!.basenameBytes,
          entry.basenameBytes,
        ) >= 0
      ) {
        failV2(
          "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
          "Native aggregate census entries are not unique and strictly raw-byte ordered",
        );
      }
    }
    parseFooterV2(frames.at(-1), entryCount, frames.length);

    const logicalCensus =
      classifyPlatformReleaseBootstrapNamespaceCensusV2(
        rawOrderedEntries.map((entry) => entry.basename),
      );
    const entryByBasename = new Map(
      rawOrderedEntries.map((entry) => [entry.basename, entry] as const),
    );
    if (entryByBasename.size !== rawOrderedEntries.length) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_STREAM_INVALID",
        "Native aggregate census contains a duplicate decoded basename",
      );
    }
    const entries = logicalCensus.orderedEntries.map((classification) => {
      const entry = entryByBasename.get(classification.basename);
      if (!entry) {
        failV2(
          "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID",
          "Canonical logical census cannot join one exact native entry",
        );
      }
      return entry;
    });

    const scopeBasename =
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename;
    const scopeEntry = entries.find((entry) => entry.basename === scopeBasename);
    if (
      !scopeEntry
      || scopeEntry.stable.objectKind !== "ordinary_file"
      || scopeEntry.content.kind !== "bounded_regular_file_bytes"
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_SCOPE_INVALID",
        "Aggregate census lacks its exact fixed filesystem-scope document entry",
      );
    }
    const scopeContent = scopeEntry.content;
    let filesystemScope: BootstrapFilesystemScopeIdentityV2;
    try {
      const scopeText = new TextDecoder("utf-8", { fatal: true }).decode(
        scopeContent.bytes,
      );
      if (!Buffer.from(scopeText, "utf8").equals(scopeContent.bytes)) {
        failV2(
          "DARWIN_AGGREGATE_CENSUS_FIXTURE_SCOPE_INVALID",
          "Filesystem-scope document does not round-trip as strict UTF-8",
        );
      }
      filesystemScope = parseBootstrapFilesystemScopeIdentityCandidateV2(
        JSON.parse(scopeText),
      );
      if (canonicalJsonStringify(filesystemScope) !== scopeText) {
        failV2(
          "DARWIN_AGGREGATE_CENSUS_FIXTURE_SCOPE_INVALID",
          "Filesystem-scope document bytes are not exact canonical JSON",
        );
      }
    } catch (error) {
      if (
        error instanceof
          PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2
      ) {
        throw error;
      }
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_SCOPE_INVALID",
        "Filesystem-scope document cannot issue a canonical scope identity",
        error,
      );
    }

    const parentObjectIdentity = buildStableFsObjectIdentityV2({
      filesystemScope,
      ...parent.stable,
    });
    const parentFingerprint = buildFingerprintV2(
      parentObjectIdentity,
      parent.mutable,
    );
    const orderedEntryCaptures = entries.map((entry, index) => {
      if (entry.stable.device !== parent.stable.device) {
        failV2(
          "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID",
          "Aggregate census child does not share its pinned parent device",
        );
      }
      const objectIdentity = buildStableFsObjectIdentityV2({
        filesystemScope,
        ...entry.stable,
      });
      const fingerprint = buildFingerprintV2(objectIdentity, entry.mutable);
      return buildNamespacePhysicalEntryCaptureV2({
        classification: logicalCensus.orderedEntries[index]!,
        parentObjectIdentityHash: parentObjectIdentity.objectIdentityHash,
        objectIdentity,
        fingerprint,
        contentEvidence: entry.content.kind === "bounded_regular_file_bytes"
          ? {
              kind: "bounded_regular_file_bytes",
              rawContentHash: entry.content.rawContentHash,
            }
          : {
              kind: "directory_membership",
              membership: buildDirectoryMembershipIdentityV2({
                orderedEntries: [...entry.content.orderedEntries],
              }),
            },
      });
    });
    const sharedLockIndex = logicalCensus.orderedEntries.findIndex(
      (classification) =>
        classification.ownerKind === "registry"
        && classification.category === "shared_parent_lock",
    );
    const nodeLockIndex = logicalCensus.orderedEntries.findIndex(
      (classification) =>
        classification.ownerKind === "package"
        && classification.ownerRef
          === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
        && classification.category === "package_lock",
    );
    const sharedLockEntry = entries[sharedLockIndex];
    const nodeLockEntry = entries[nodeLockIndex];
    if (sharedLockEntry && nodeLockEntry) {
      assertFixedLockEntryV2(
        sharedLockEntry,
        parent,
        SHARED_PARENT_LOCK_CONTENT_V2,
        "Shared parent lock entry",
      );
      assertFixedLockEntryV2(
        nodeLockEntry,
        parent,
        NODE_PACKAGE_LOCK_CONTENT_V2,
        "Registered Node package lock entry",
      );
    }
    if (
      !sharedLockEntry
      || !nodeLockEntry
      || canonicalJsonStringify(sharedLockEntry.stable)
        !== canonicalJsonStringify(locks.sharedParentLock.stable)
      || canonicalJsonStringify(sharedLockEntry.mutable)
        !== canonicalJsonStringify(locks.sharedParentLock.mutable)
      || canonicalJsonStringify(nodeLockEntry.stable)
        !== canonicalJsonStringify(locks.registeredNodePackageLock.stable)
      || canonicalJsonStringify(nodeLockEntry.mutable)
        !== canonicalJsonStringify(locks.registeredNodePackageLock.mutable)
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID",
        "Held lock evidence does not equal its exact fixed namespace entries",
      );
    }
    const heldSharedObjectIdentity = buildStableFsObjectIdentityV2({
      filesystemScope,
      ...locks.sharedParentLock.stable,
    });
    const heldNodeObjectIdentity = buildStableFsObjectIdentityV2({
      filesystemScope,
      ...locks.registeredNodePackageLock.stable,
    });
    const heldLocks = Object.freeze({
      lockOrder: LOCK_ORDER_V2,
      sharedParentLock: Object.freeze({
        objectIdentity: heldSharedObjectIdentity,
        fingerprint: buildFingerprintV2(
          heldSharedObjectIdentity,
          locks.sharedParentLock.mutable,
        ),
      }),
      registeredNodePackageLock: Object.freeze({
        objectIdentity: heldNodeObjectIdentity,
        fingerprint: buildFingerprintV2(
          heldNodeObjectIdentity,
          locks.registeredNodePackageLock.mutable,
        ),
      }),
    });
    const physicalCensus = buildNamespacePhysicalCensusV2({
      filesystemScope,
      logicalCensus,
      parentObjectIdentity,
      parentFingerprint,
      orderedEntryCaptures,
    });
    const nodePackageRef =
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner;
    const nodeLogicalProjection =
      projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2(
        logicalCensus,
        nodePackageRef,
      );
    const nodePhysicalProjection =
      buildPackageLifecyclePhysicalProjectionV2(
        physicalCensus,
        nodePackageRef,
      );
    if (
      nodePhysicalProjection.packageLockObjectIdentityHash
        !== heldNodeObjectIdentity.objectIdentityHash
      || orderedEntryCaptures[sharedLockIndex]?.objectIdentity.objectIdentityHash
        !== heldSharedObjectIdentity.objectIdentityHash
      || orderedEntryCaptures[nodeLockIndex]?.objectIdentity.objectIdentityHash
        !== heldNodeObjectIdentity.objectIdentityHash
    ) {
      failV2(
        "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID",
        "Held locks do not join their physical census and Node projection identities",
      );
    }

    return deepFreezePlatformReleaseJsonV2({
      schema: MAPPING_SCHEMA_V2,
      admissionScope: "test_fixture" as const,
      capability: CAPABILITY_V2,
      productionAuthority: false as const,
      signingAuthority: SIGNING_AUTHORITY_V2,
      observationAuthority: OBSERVATION_AUTHORITY_V2,
      capturePasses: 2 as const,
      lockOrder: LOCK_ORDER_V2,
      filesystemScope,
      logicalCensus,
      physicalCensus,
      nodeLogicalProjection,
      nodePhysicalProjection,
      heldLocks,
    });
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2
    ) {
      throw error;
    }
    return failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_NORMALIZATION_INVALID",
      "Native aggregate census could not map into the exact Setfarm projections",
      error,
    );
  } finally {
    stdout?.fill(0);
    for (const bytes of ownedEntryBuffers) bytes.fill(0);
  }
}

/**
 * Parses one complete aggregate evidence stream without claiming that its
 * producer exited, released locks, or otherwise settled.
 */
export function mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2(
  stdout: Uint8Array,
): PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2 {
  return mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamCoreV2(
    stdout,
  );
}

export function mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2(
  input: PlatformReleaseBootstrapDarwinAggregateCensusFixtureProcessResultV2,
): PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2 {
  const processResult = snapshotProcessResultV2(input);
  if (
    processResult.exitCode !== 0
    || processResult.signal !== null
    || processResult.stderr.byteLength !== 0
  ) {
    return failV2(
      "DARWIN_AGGREGATE_CENSUS_FIXTURE_PROCESS_INVALID",
      "Native aggregate census fixture did not exit cleanly and silently",
    );
  }
  return mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamCoreV2(
    new Uint8Array(
      processResult.stdout.buffer,
      processResult.stdout.byteOffset,
      processResult.stdout.byteLength,
    ),
  );
}
