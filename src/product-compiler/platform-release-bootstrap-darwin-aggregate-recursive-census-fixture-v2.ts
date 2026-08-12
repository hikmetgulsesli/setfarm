import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import {
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2,
  type PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2,
  type PlatformReleaseBootstrapDarwinAggregateCensusFixtureProcessResultV2,
} from "./platform-release-bootstrap-darwin-aggregate-census-fixture-v2.js";
import {
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
  filesystemObjectLocatorKeyV2,
  type DirectoryMembershipIdentityV2,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
  type StableFsObjectKindV2,
} from "./platform-release-bootstrap-physical-census-v2.js";

const HEADER_SCHEMA_V3 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v3";
const CAPABILITY_V3 =
  "darwin_read_only_aggregate_census_with_node_recursive_evidence_fixture_v3";
const RECURSIVE_SCHEMA_V3 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-node-recursive-evidence.v3";
const FOOTER_SCHEMA_V3 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v3";
const MAPPING_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-mapping.v2";
const JOIN_STATUS_V2 =
  "native_capture_only_requires_ts_aggregate_join_v2";
const MAX_STREAM_BYTES = 64 * 1024 * 1024;
const MAX_RECURSIVE_LINE_BYTES = 64 * 1024;
const MAX_NAMESPACE_ENTRIES = 16_384;
const NODE_ROOT_BASENAME = "node-toolchain-provisioner-v2";

type JsonRecord = Record<string, unknown>;

export type PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2 =
  Readonly<{
    schema: typeof MAPPING_SCHEMA_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    semanticReady: false;
    joinStatus: typeof JOIN_STATUS_V2;
    rawStreamHash: string;
    recursiveLineHash: string;
    namespaceEntryCount: number;
    frameCount: number;
    aggregateObservation:
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2;
    recursiveEvidence: Readonly<{
      status: "root_absent" | "layout_not_exact" | "complete";
      rootBasename: typeof NODE_ROOT_BASENAME;
      orderedEntries: readonly RecursiveMappedEntry[];
    }>;
    mappingHash: string;
  }>;

type RecursiveMappedEntry = Readonly<{
  role: RecursiveRole;
  parentRole: ParentRole;
  locator: string;
  parentObjectIdentityHash: string;
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
  content:
    | Readonly<{
        kind: "directory_membership";
        membership: DirectoryMembershipIdentityV2;
      }>
    | Readonly<{
        kind: "sha256_regular_file";
        rawContentHash: string;
      }>;
}>;

export class PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2
  extends TypeError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name =
      "PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2";
  }
}

function fail(message: string, cause?: unknown): never {
  throw new PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2(
    message,
    cause === undefined ? {} : { cause },
  );
}

// Implementation below deliberately keeps V3 parsing independent from the
// legacy mapper; only an already-validated private V2 byte projection crosses
// that boundary.

const HEADER_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2";
const PARENT_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2";
const LOCKS_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2";
const ENTRY_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const FOOTER_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v2";
const LOCK_ORDER = Object.freeze([
  "shared_parent_lock",
  "registered_node_package_lock",
] as const);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const UINT64_MAX = (1n << 64n) - 1n;
const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const BYTE_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const BYTE_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  BYTE_ARRAY_PROTOTYPE,
  "buffer",
)!.get!;
const BYTE_ARRAY_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  BYTE_ARRAY_PROTOTYPE,
  "byteLength",
)!.get!;
const BYTE_ARRAY_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  BYTE_ARRAY_PROTOTYPE,
  "byteOffset",
)!.get!;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)!.get!;

type RecursiveStatus = "root_absent" | "layout_not_exact" | "complete";
type RecursiveRole =
  | "root_directory"
  | "bin_directory"
  | "launcher_file"
  | "lib_directory"
  | "bundle_file"
  | "manifest_file"
  | "runtime_directory"
  | "bootstrap_runtime_file";
type ParentRole = RecursiveRole | "global_parent";

type NativeStable = Readonly<{
  objectKind: StableFsObjectKindV2;
  device: string;
  inode: string;
}>;
type NativeMutable = Readonly<{
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: number;
  byteLength: number;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;
type NativeMember = Readonly<{
  basename: string;
  objectKind: StableFsObjectKindV2;
}>;
type ParsedRecursiveEntry = Readonly<{
  role: RecursiveRole;
  parentRole: ParentRole;
  locator: string;
  stable: NativeStable;
  mutable: NativeMutable;
  content:
    | Readonly<{
        kind: "directory_membership";
        members: readonly NativeMember[];
      }>
    | Readonly<{
        kind: "sha256_regular_file";
        sha256: string;
      }>;
}>;

const TREE_SPECS = Object.freeze([
  {
    role: "root_directory",
    parentRole: "global_parent",
    locator: ".",
    kind: "directory",
    mode: "0555",
    members: [
      ["NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json", "ordinary_file"],
      ["bin", "directory"],
      ["lib", "directory"],
      ["runtime", "directory"],
    ],
  },
  {
    role: "bin_directory",
    parentRole: "root_directory",
    locator: "bin",
    kind: "directory",
    mode: "0555",
    members: [["setfarm-node-toolchain-provisioner-v2", "ordinary_file"]],
  },
  {
    role: "launcher_file",
    parentRole: "bin_directory",
    locator: "bin/setfarm-node-toolchain-provisioner-v2",
    kind: "ordinary_file",
    mode: "0555",
    maxBytes: 64 * 1024,
  },
  {
    role: "lib_directory",
    parentRole: "root_directory",
    locator: "lib",
    kind: "directory",
    mode: "0555",
    members: [["node-toolchain-provisioner-v2.cjs", "ordinary_file"]],
  },
  {
    role: "bundle_file",
    parentRole: "lib_directory",
    locator: "lib/node-toolchain-provisioner-v2.cjs",
    kind: "ordinary_file",
    mode: "0444",
    maxBytes: 32 * 1024 * 1024,
  },
  {
    role: "manifest_file",
    parentRole: "root_directory",
    locator: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
    kind: "ordinary_file",
    mode: "0444",
    maxBytes: 4 * 1024 * 1024,
  },
  {
    role: "runtime_directory",
    parentRole: "root_directory",
    locator: "runtime",
    kind: "directory",
    mode: "0555",
    members: [["node", "ordinary_file"]],
  },
  {
    role: "bootstrap_runtime_file",
    parentRole: "runtime_directory",
    locator: "runtime/node",
    kind: "ordinary_file",
    mode: "0555",
    maxBytes: 128 * 1024 * 1024,
  },
] as const);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): JsonRecord {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return fail(`${label} must be one exact JSON object`);
  }
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length
    || keys.some((key, index) => actual[index] !== key)
  ) {
    return fail(`${label} has missing, unknown, or reordered fields`);
  }
  return value;
}

function exactLiteral(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) fail(`${label} does not equal its fixed literal`);
}

function safeInteger(
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
    return fail(`${label} is outside its exact integer bound`);
  }
  return value;
}

function canonicalUnsignedDecimal(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return fail(`${label} is not canonical unsigned decimal`);
  }
  try {
    if (BigInt(value) > UINT64_MAX) return fail(`${label} exceeds uint64`);
  } catch (error) {
    return fail(`${label} cannot be parsed`, error);
  }
  return value;
}

function timestampNanoseconds(
  seconds: unknown,
  nanoseconds: unknown,
  label: string,
): string {
  if (
    typeof seconds !== "string"
    || !/^(?:0|-?[1-9][0-9]*)$/u.test(seconds)
  ) {
    return fail(`${label} seconds are not canonical signed decimal`);
  }
  const fraction = canonicalUnsignedDecimal(nanoseconds, `${label} fraction`);
  const fractionValue = BigInt(fraction);
  if (fractionValue >= NANOSECONDS_PER_SECOND) {
    return fail(`${label} fraction exceeds one second`);
  }
  const total = BigInt(seconds) * NANOSECONDS_PER_SECOND + fractionValue;
  if (total < 0n) return fail(`${label} cannot map to an unsigned fingerprint`);
  return total.toString(10);
}

function parseStable(value: unknown, label: string): NativeStable {
  const record = exactRecord(
    value,
    ["objectKind", "device", "inode"],
    `${label} stable`,
  );
  if (
    record.objectKind !== "ordinary_file"
    && record.objectKind !== "directory"
  ) {
    return fail(`${label} object kind is invalid`);
  }
  return Object.freeze({
    objectKind: record.objectKind,
    device: canonicalUnsignedDecimal(record.device, `${label} device`),
    inode: canonicalUnsignedDecimal(record.inode, `${label} inode`),
  });
}

function parseMutable(value: unknown, label: string): NativeMutable {
  const record = exactRecord(value, [
    "ownerUid",
    "ownerGid",
    "mode",
    "linkCount",
    "byteLength",
    "modifiedSeconds",
    "modifiedNanoseconds",
    "changedSeconds",
    "changedNanoseconds",
  ], `${label} mutable`);
  if (typeof record.mode !== "string" || !/^0[0-7]{3}$/u.test(record.mode)) {
    return fail(`${label} mode is invalid`);
  }
  return Object.freeze({
    ownerUid: safeInteger(record.ownerUid, 0, 2_147_483_647, `${label} uid`),
    ownerGid: safeInteger(record.ownerGid, 0, 2_147_483_647, `${label} gid`),
    mode: record.mode,
    linkCount: safeInteger(
      record.linkCount,
      1,
      Number.MAX_SAFE_INTEGER,
      `${label} link count`,
    ),
    byteLength: safeInteger(
      record.byteLength,
      0,
      Number.MAX_SAFE_INTEGER,
      `${label} byte length`,
    ),
    modifiedTimeNanoseconds: timestampNanoseconds(
      record.modifiedSeconds,
      record.modifiedNanoseconds,
      `${label} modified time`,
    ),
    changedTimeNanoseconds: timestampNanoseconds(
      record.changedSeconds,
      record.changedNanoseconds,
      `${label} changed time`,
    ),
  });
}

function decodeBasename(value: unknown, label: string): Readonly<{
  basename: string;
  bytes: Buffer;
}> {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 344
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
      .test(value)
  ) {
    return fail(`${label} is not bounded canonical base64`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > 255 || bytes.toString("base64") !== value) {
    bytes.fill(0);
    return fail(`${label} does not round-trip as canonical base64`);
  }
  let basename: string;
  try {
    basename = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    bytes.fill(0);
    return fail(`${label} is not strict UTF-8`, error);
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
    return fail(`${label} is not a direct-child basename`);
  }
  return Object.freeze({ basename, bytes });
}

function parseMembers(value: unknown, label: string): readonly NativeMember[] {
  if (!Array.isArray(value) || value.length > 4) {
    return fail(`${label} members exceed the exact recursive bound`);
  }
  const retained: Buffer[] = [];
  try {
    const members = value.map((candidate, index) => {
      const record = exactRecord(
        candidate,
        ["basenameBase64", "objectKind"],
        `${label} member ${index}`,
      );
      const decoded = decodeBasename(
        record.basenameBase64,
        `${label} member ${index} basename`,
      );
      retained.push(decoded.bytes);
      if (
        record.objectKind !== "ordinary_file"
        && record.objectKind !== "directory"
      ) {
        return fail(`${label} member ${index} kind is invalid`);
      }
      if (index > 0 && Buffer.compare(retained[index - 1]!, decoded.bytes) >= 0) {
        return fail(`${label} members are not unique raw-byte ordered`);
      }
      return Object.freeze({
        basename: decoded.basename,
        objectKind: record.objectKind,
      });
    });
    return Object.freeze(members);
  } finally {
    for (const bytes of retained) bytes.fill(0);
  }
}

function parseRecursiveEntry(
  value: unknown,
  index: number,
): ParsedRecursiveEntry {
  const record = exactRecord(value, [
    "role",
    "parentRole",
    "locator",
    "stable",
    "mutable",
    "content",
  ], `recursive entry ${index}`);
  const spec = TREE_SPECS[index];
  if (!spec) return fail("Recursive evidence contains too many entries");
  exactLiteral(record.role, spec.role, `recursive entry ${index} role`);
  exactLiteral(
    record.parentRole,
    spec.parentRole,
    `recursive entry ${index} parent role`,
  );
  exactLiteral(record.locator, spec.locator, `recursive entry ${index} locator`);
  const stable = parseStable(record.stable, `recursive entry ${index}`);
  const mutable = parseMutable(record.mutable, `recursive entry ${index}`);
  exactLiteral(stable.objectKind, spec.kind, `recursive entry ${index} kind`);
  exactLiteral(mutable.mode, spec.mode, `recursive entry ${index} mode`);
  const content = spec.kind === "directory"
    ? (() => {
        const contentRecord = exactRecord(
          record.content,
          ["kind", "members"],
          `recursive entry ${index} content`,
        );
        exactLiteral(
          contentRecord.kind,
          "directory_membership",
          `recursive entry ${index} content kind`,
        );
        const members = parseMembers(
          contentRecord.members,
          `recursive entry ${index}`,
        );
        if (
          canonicalJsonStringify(members)
          !== canonicalJsonStringify(
            spec.members.map(([basename, objectKind]) => ({
              basename,
              objectKind,
            })),
          )
        ) {
          return fail(`recursive entry ${index} membership is not exact`);
        }
        return Object.freeze({
          kind: "directory_membership" as const,
          members,
        });
      })()
    : (() => {
        const contentRecord = exactRecord(
          record.content,
          ["kind", "sha256"],
          `recursive entry ${index} content`,
        );
        exactLiteral(
          contentRecord.kind,
          "sha256_regular_file",
          `recursive entry ${index} content kind`,
        );
        if (typeof contentRecord.sha256 !== "string" || !SHA256_PATTERN.test(contentRecord.sha256)) {
          return fail(`recursive entry ${index} SHA-256 is invalid`);
        }
        if (
          mutable.linkCount !== 1
          || mutable.byteLength < 1
          || mutable.byteLength > spec.maxBytes
        ) {
          return fail(`recursive entry ${index} file metadata exceeds its contract`);
        }
        return Object.freeze({
          kind: "sha256_regular_file" as const,
          sha256: contentRecord.sha256,
        });
      })();
  return Object.freeze({
    role: spec.role,
    parentRole: spec.parentRole,
    locator: spec.locator,
    stable,
    mutable,
    content,
  });
}

function parseRecursiveFrame(value: unknown): Readonly<{
  status: RecursiveStatus;
  orderedEntries: readonly ParsedRecursiveEntry[];
}> {
  const record = exactRecord(value, [
    "schema",
    "admissionScope",
    "productionAuthority",
    "joinStatus",
    "rootBasename",
    "status",
    "entryCount",
    "orderedEntries",
  ], "recursive evidence frame");
  exactLiteral(record.schema, RECURSIVE_SCHEMA_V3, "recursive schema");
  exactLiteral(record.admissionScope, "test_fixture", "recursive admission scope");
  exactLiteral(record.productionAuthority, false, "recursive production authority");
  exactLiteral(record.joinStatus, JOIN_STATUS_V2, "recursive join status");
  exactLiteral(record.rootBasename, NODE_ROOT_BASENAME, "recursive root basename");
  if (
    record.status !== "root_absent"
    && record.status !== "layout_not_exact"
    && record.status !== "complete"
  ) {
    return fail("recursive status is invalid");
  }
  if (!Array.isArray(record.orderedEntries)) {
    return fail("recursive ordered entries are not an array");
  }
  const expectedCount = record.status === "complete" ? 8 : 0;
  if (
    safeInteger(record.entryCount, 0, 8, "recursive entry count")
      !== expectedCount
    || record.orderedEntries.length !== expectedCount
  ) {
    return fail("recursive status and entry count do not agree");
  }
  return Object.freeze({
    status: record.status,
    orderedEntries: Object.freeze(
      record.orderedEntries.map(parseRecursiveEntry),
    ),
  });
}

function exactLockOrder(value: unknown, label: string): void {
  if (
    !Array.isArray(value)
    || value.length !== LOCK_ORDER.length
    || value.some((entry, index) => entry !== LOCK_ORDER[index])
  ) {
    fail(`${label} lock order is not exact`);
  }
}

function parseHeader(value: unknown): void {
  const record = exactRecord(value, [
    "schema",
    "admissionScope",
    "capability",
    "productionAuthority",
    "signingAuthority",
    "observationAuthority",
    "capturePasses",
    "recursiveEvidencePolicy",
    "lockOrder",
  ], "V3 header");
  exactLiteral(record.schema, HEADER_SCHEMA_V3, "V3 header schema");
  exactLiteral(record.admissionScope, "test_fixture", "V3 admission scope");
  exactLiteral(record.capability, CAPABILITY_V3, "V3 capability");
  exactLiteral(record.productionAuthority, false, "V3 production authority");
  exactLiteral(
    record.signingAuthority,
    "adhoc_or_unsigned_test_fixture",
    "V3 signing authority",
  );
  exactLiteral(
    record.observationAuthority,
    "fixture_evidence_only_never_backend_capability_v2",
    "V3 observation authority",
  );
  exactLiteral(record.capturePasses, 2, "V3 capture passes");
  exactLiteral(
    record.recursiveEvidencePolicy,
    "code_owned_exact_node_tree_descriptor_relative_v3",
    "V3 recursive evidence policy",
  );
  exactLockOrder(record.lockOrder, "V3 header");
}

function parseFooter(
  value: unknown,
  namespaceEntryCount: number,
  frameCount: number,
): void {
  const record = exactRecord(value, [
    "schema",
    "namespaceEntryCount",
    "recursiveFrameCount",
    "frameCount",
    "completed",
  ], "V3 footer");
  exactLiteral(record.schema, FOOTER_SCHEMA_V3, "V3 footer schema");
  if (
    safeInteger(
      record.namespaceEntryCount,
      0,
      MAX_NAMESPACE_ENTRIES,
      "V3 namespace entry count",
    ) !== namespaceEntryCount
    || safeInteger(
      record.recursiveFrameCount,
      1,
      1,
      "V3 recursive frame count",
    ) !== 1
    || safeInteger(
      record.frameCount,
      5,
      MAX_NAMESPACE_ENTRIES + 5,
      "V3 frame count",
    ) !== frameCount
  ) {
    fail("V3 footer counts do not equal the completed stream");
  }
  exactLiteral(record.completed, true, "V3 completion marker");
}

function snapshotChannel(
  value: unknown,
  maximum: number,
  label: string,
): Readonly<{ buffer: ArrayBuffer; byteOffset: number; byteLength: number }> {
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
    return fail(`${label} must be an exact unshadowed byte array`);
  }
  const buffer = BYTE_ARRAY_BUFFER_GETTER.call(value) as unknown;
  const byteLength = BYTE_ARRAY_LENGTH_GETTER.call(value) as unknown;
  const byteOffset = BYTE_ARRAY_OFFSET_GETTER.call(value) as unknown;
  if (
    nodeUtilTypes.isProxy(buffer)
    || !(buffer instanceof ArrayBuffer)
    || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    || Object.getOwnPropertyDescriptor(buffer, "byteLength") !== undefined
  ) {
    return fail(`${label} has a foreign or shadowed backing buffer`);
  }
  let backingByteLength: unknown;
  try {
    backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_GETTER.call(buffer);
  } catch (error) {
    return fail(`${label} backing buffer is not intrinsic`, error);
  }
  if (
    typeof backingByteLength !== "number"
    || !Number.isSafeInteger(backingByteLength)
    || backingByteLength < 0
    || typeof byteLength !== "number"
    || !Number.isSafeInteger(byteLength)
    || byteLength < 0
    || byteLength > maximum
    || typeof byteOffset !== "number"
    || !Number.isSafeInteger(byteOffset)
    || byteOffset < 0
    || byteOffset + byteLength > backingByteLength
  ) {
    return fail(`${label} exceeds its pre-copy byte boundary`);
  }
  return Object.freeze({
    buffer,
    byteLength,
    byteOffset,
  });
}

function snapshotProcessResult(
  input: PlatformReleaseBootstrapDarwinAggregateCensusFixtureProcessResultV2,
): Readonly<{
  stdout: ReturnType<typeof snapshotChannel>;
  stderr: ReturnType<typeof snapshotChannel>;
}> {
  if (
    input === null
    || typeof input !== "object"
    || nodeUtilTypes.isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return fail("Recursive fixture result must be one exact plain record");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = ["exitCode", "signal", "stdout", "stderr"] as const;
  if (
    Reflect.ownKeys(descriptors).length !== keys.length
    || keys.some((key) => {
      const descriptor = descriptors[key];
      return !descriptor
        || !("value" in descriptor)
        || !descriptor.enumerable;
    })
  ) {
    return fail("Recursive fixture result has accessor or unknown fields");
  }
  if (descriptors.exitCode!.value !== 0 || descriptors.signal!.value !== null) {
    return fail("Recursive fixture process did not exit cleanly");
  }
  const stdout = snapshotChannel(
    descriptors.stdout!.value,
    MAX_STREAM_BYTES,
    "Recursive fixture stdout",
  );
  const stderr = snapshotChannel(
    descriptors.stderr!.value,
    4 * 1024,
    "Recursive fixture stderr",
  );
  if (stderr.byteLength !== 0) {
    return fail("Recursive fixture emitted forbidden diagnostics");
  }
  return Object.freeze({ stdout, stderr });
}

function parseLine(line: string, index: number): JsonRecord {
  if (
    line.length === 0
    || line.includes("\r")
    || Buffer.byteLength(line, "utf8") > MAX_STREAM_BYTES
  ) {
    return fail(`V3 frame ${index} violates its exact line boundary`);
  }
  try {
    const value: unknown = JSON.parse(line);
    if (!isRecord(value) || JSON.stringify(value) !== line) {
      return fail(`V3 frame ${index} is not compact exact JSON`);
    }
    return value;
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2
    ) {
      throw error;
    }
    return fail(`V3 frame ${index} is malformed`, error);
  }
}

function privateLegacyProjection(
  frames: readonly JsonRecord[],
  namespaceEntries: readonly JsonRecord[],
): PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2 {
  const projectedFrames = [
    {
      schema: HEADER_SCHEMA_V2,
      admissionScope: "test_fixture",
      capability: "darwin_read_only_aggregate_census_fixture_v2",
      productionAuthority: false,
      signingAuthority: "adhoc_or_unsigned_test_fixture",
      observationAuthority:
        "fixture_evidence_only_never_backend_capability_v2",
      capturePasses: 2,
      lockOrder: [...LOCK_ORDER],
    },
    frames[1]!,
    frames[2]!,
    ...namespaceEntries,
    {
      schema: FOOTER_SCHEMA_V2,
      entryCount: namespaceEntries.length,
      frameCount: namespaceEntries.length + 4,
      completed: true,
    },
  ];
  const bytes = Buffer.from(
    `${projectedFrames.map((frame) => JSON.stringify(frame)).join("\n")}\n`,
    "utf8",
  );
  const empty = Buffer.alloc(0);
  try {
    return mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2({
      exitCode: 0,
      signal: null,
      stdout: bytes,
      stderr: empty,
    });
  } catch (error) {
    return fail("V3 namespace projection does not satisfy legacy aggregate census", error);
  } finally {
    bytes.fill(0);
    empty.fill(0);
  }
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function mapCompleteEntries(
  parsed: readonly ParsedRecursiveEntry[],
  aggregate: PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2,
): readonly RecursiveMappedEntry[] {
  const filesystemScope = aggregate.filesystemScope;
  const identities = parsed.map((entry) => buildStableFsObjectIdentityV2({
    filesystemScope,
    ...entry.stable,
  }));
  const identityByRole = new Map(
    parsed.map((entry, index) => [entry.role, identities[index]!] as const),
  );
  const rootIdentity = identities[0]!;
  const rootMutable = parsed[0]!.mutable;
  if (
    parsed.some((entry) =>
      entry.stable.device !== rootIdentity.device
      || entry.mutable.ownerUid !== rootMutable.ownerUid
      || entry.mutable.ownerGid !== rootMutable.ownerGid)
    || rootMutable.ownerUid
      !== aggregate.physicalCensus.parentFingerprint.ownerUid
    || rootMutable.ownerGid
      !== aggregate.physicalCensus.parentFingerprint.ownerGid
  ) {
    return fail("Recursive tree owner or device boundary is invalid");
  }
  const mapped = parsed.map((entry, index): RecursiveMappedEntry => {
    const objectIdentity = identities[index]!;
    const parentObjectIdentityHash = entry.parentRole === "global_parent"
      ? aggregate.physicalCensus.parentObjectIdentity.objectIdentityHash
      : identityByRole.get(entry.parentRole)?.objectIdentityHash
        ?? fail(`Recursive entry ${index} parent role is unresolved`);
    const fingerprint = buildFsObservationFingerprintV2({
      objectIdentity,
      ...entry.mutable,
    });
    const content = entry.content.kind === "directory_membership"
      ? Object.freeze({
          kind: "directory_membership" as const,
          membership: buildDirectoryMembershipIdentityV2({
            orderedEntries: [...entry.content.members],
          }),
        })
      : Object.freeze({
          kind: "sha256_regular_file" as const,
          rawContentHash: entry.content.sha256,
        });
    return Object.freeze({
      role: entry.role,
      parentRole: entry.parentRole,
      locator: entry.locator,
      parentObjectIdentityHash,
      objectIdentity,
      fingerprint,
      content,
    });
  });
  const locatorKeys = mapped.map((entry) =>
    filesystemObjectLocatorKeyV2(entry.objectIdentity));
  const globalLocatorKeys = new Set(
    aggregate.physicalCensus.orderedEntryCaptures.map((capture) =>
      filesystemObjectLocatorKeyV2(capture.objectIdentity)),
  );
  if (
    new Set(locatorKeys).size !== mapped.length
    || mapped.slice(1).some((entry) =>
      globalLocatorKeys.has(filesystemObjectLocatorKeyV2(entry.objectIdentity)))
  ) {
    return fail("Recursive identities are aliased or transplanted");
  }
  const roots = aggregate.nodePhysicalProjection.orderedEntryCaptures.filter(
    (capture) => capture.classification.category === "package_root",
  );
  const root = mapped[0]!;
  if (
    roots.length !== 1
    || roots[0]!.contentEvidence.kind !== "directory_membership"
    || root.content.kind !== "directory_membership"
    || !same(roots[0]!.objectIdentity, root.objectIdentity)
    || !same(roots[0]!.fingerprint, root.fingerprint)
    || !same(roots[0]!.contentEvidence.membership, root.content.membership)
  ) {
    return fail("Recursive root does not equal the global package_root capture");
  }
  return Object.freeze(mapped);
}

function joinRecursiveEvidence(
  recursive: ReturnType<typeof parseRecursiveFrame>,
  aggregate: PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2,
): readonly RecursiveMappedEntry[] {
  if (
    aggregate.nodePhysicalProjection.packageLockObjectIdentityHash
      !== aggregate.heldLocks.registeredNodePackageLock.objectIdentity
        .objectIdentityHash
  ) {
    return fail("Node projection lock does not equal the held Node lock");
  }
  const roots = aggregate.nodePhysicalProjection.orderedEntryCaptures.filter(
    (capture) => capture.classification.category === "package_root",
  );
  if (recursive.status === "root_absent") {
    if (roots.length !== 0) {
      return fail("root_absent contradicts the global package_root census");
    }
    return Object.freeze([]);
  }
  if (recursive.status === "layout_not_exact") {
    const root = roots[0];
    const expectedRootMembership = buildDirectoryMembershipIdentityV2({
      orderedEntries: TREE_SPECS[0].members.map(
        ([basename, objectKind]) => ({ basename, objectKind }),
      ),
    });
    const matchesNativeRootPredicate = root !== undefined
      && root.objectIdentity.objectKind === "directory"
      && root.objectIdentity.device
        === aggregate.physicalCensus.parentObjectIdentity.device
      && root.fingerprint.ownerUid
        === aggregate.physicalCensus.parentFingerprint.ownerUid
      && root.fingerprint.ownerGid
        === aggregate.physicalCensus.parentFingerprint.ownerGid
      && root.fingerprint.mode === "0555"
      && root.contentEvidence.kind === "directory_membership"
      && same(root.contentEvidence.membership, expectedRootMembership);
    if (roots.length !== 1 || matchesNativeRootPredicate) {
      return fail(
        "layout_not_exact must contradict the exact native global root predicate",
      );
    }
    return Object.freeze([]);
  }
  return mapCompleteEntries(recursive.orderedEntries, aggregate);
}

function hashMappingIdentity(value: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-mapping-hash.v2",
    mapping: value,
  });
}

function mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusSnapshotV2(
  stdout: ReturnType<typeof snapshotChannel>,
): PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2 {
  let raw: Buffer | undefined;
  try {
    raw = Buffer.from(new Uint8Array(
      stdout.buffer,
      stdout.byteOffset,
      stdout.byteLength,
    ));
    if (raw.byteLength === 0 || raw.at(-1) !== 0x0a) {
      return fail("V3 stream must end in exactly one LF-delimited frame");
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch (error) {
      return fail("V3 stream is not fatal strict UTF-8", error);
    }
    if (!Buffer.from(text, "utf8").equals(raw)) {
      return fail("V3 stream does not round-trip as strict UTF-8");
    }
    const lines = text.slice(0, -1).split("\n");
    if (
      lines.length < 5
      || lines.length > MAX_NAMESPACE_ENTRIES + 5
      || lines.some((line) => line.length === 0)
    ) {
      return fail("V3 stream frame count or single-LF boundary is invalid");
    }
    const recursiveLine = lines.at(-2)!;
    if (
      Buffer.byteLength(recursiveLine, "utf8") + 1
        > MAX_RECURSIVE_LINE_BYTES
    ) {
      return fail("V3 recursive frame plus LF exceeds 64 KiB");
    }
    const frames = lines.map(parseLine);
    parseHeader(frames[0]);
    exactLiteral(frames[1]!.schema, PARENT_SCHEMA_V2, "V3 parent position");
    exactLiteral(frames[2]!.schema, LOCKS_SCHEMA_V2, "V3 locks position");
    const namespaceEntries = frames.slice(3, -2);
    if (namespaceEntries.some((frame) => frame.schema !== ENTRY_SCHEMA_V2)) {
      return fail("V3 namespace entry region contains a foreign frame");
    }
    const recursive = parseRecursiveFrame(frames.at(-2));
    parseFooter(frames.at(-1), namespaceEntries.length, frames.length);
    const aggregateObservation = privateLegacyProjection(
      frames,
      namespaceEntries,
    );
    const orderedEntries = joinRecursiveEvidence(
      recursive,
      aggregateObservation,
    );
    const rawStreamHash = createHash("sha256").update(raw).digest("hex");
    const recursiveLineHash = createHash("sha256")
      .update(recursiveLine, "utf8")
      .digest("hex");
    const identity = {
      schema: MAPPING_SCHEMA_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      semanticReady: false as const,
      joinStatus: JOIN_STATUS_V2,
      rawStreamHash,
      recursiveLineHash,
      namespaceEntryCount: namespaceEntries.length,
      frameCount: frames.length,
      aggregateObservation,
      recursiveEvidence: {
        status: recursive.status,
        rootBasename: NODE_ROOT_BASENAME,
        orderedEntries,
      },
    } as const;
    return deepFreezePlatformReleaseJsonV2({
      ...identity,
      mappingHash: hashMappingIdentity(identity),
    });
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2
    ) {
      throw error;
    }
    return fail("V3 recursive aggregate mapping failed", error);
  } finally {
    raw?.fill(0);
  }
}

export function mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2(
  input: Uint8Array,
): PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2 {
  return mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusSnapshotV2(
    snapshotChannel(input, MAX_STREAM_BYTES, "Recursive fixture evidence stream"),
  );
}

export function mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2(
  input: PlatformReleaseBootstrapDarwinAggregateCensusFixtureProcessResultV2,
): PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2 {
  const processResult = snapshotProcessResult(input);
  return mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2(
    new Uint8Array(
      processResult.stdout.buffer,
      processResult.stdout.byteOffset,
      processResult.stdout.byteLength,
    ),
  );
}
