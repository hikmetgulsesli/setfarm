import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_DEFINITIONS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_LOGICAL_BINDINGS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OBSERVATION_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_REF_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_DEFINITIONS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_POLICY_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_TRUST_CONCLUSION_V2,
  hashPlatformReleaseBootstrapDarwinSystemAnchorObservationV2,
  hashSystemAnchorFileObservationV2,
  hashSystemAnchorParentObservationV2,
  hashSystemAnchorParentStableIdentityV2,
  hashSystemAnchorSnapshotV2,
  hashSystemAnchorObservationV2,
  hashSystemAnchorDirectEntryNamesV2,
  parsePlatformReleaseBootstrapDarwinSystemAnchorObservationCandidateV2,
  type PlatformReleaseBootstrapDarwinSystemAnchorFileObservationV2,
  type PlatformReleaseBootstrapDarwinSystemAnchorParentObservationV2,
  type PlatformReleaseBootstrapDarwinSystemAnchorSnapshotV2,
  type PlatformReleaseBootstrapDarwinSystemAnchorObservationV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-system-anchor-observation-v2.js";

const HOST_IDENTITY_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.platform-release-bootstrap-darwin-system-anchor-test-host.v2",
  platform: "darwin",
  scope: "test_fixture_system_anchors",
});
const HOST_COMPOSITION_RECEIPT_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.platform-release-bootstrap-darwin-system-anchor-test-host-composition.v2",
  operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_REF_V2,
  operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_HASH_V2,
  authority: "diagnostic_observation_only",
});
const MAX_PARENT_ENTRIES_V2 = 16_384;

export type PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2 = Readonly<{
  dispose(): void;
}>;

export type PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorCodeV2 =
  | "SYSTEM_ANCHOR_PLATFORM_UNAVAILABLE"
  | "SYSTEM_ANCHOR_FIXTURE_BUILD_FAILED"
  | "SYSTEM_ANCHOR_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "SYSTEM_ANCHOR_CHALLENGE_INVALID"
  | "SYSTEM_ANCHOR_FILESYSTEM_DRIFT"
  | "SYSTEM_ANCHOR_RECEIPT_INVALID";

export class PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2
  extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2";
  }
}

type BigIntStatV2 = ReturnType<typeof lstatSync> & {
  dev: bigint;
  ino: bigint;
  uid: bigint;
  gid: bigint;
  mode: bigint;
  nlink: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
};

type ParentDefinitionV2 = typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_DEFINITIONS_V2[number];
type FileDefinitionV2 = typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_DEFINITIONS_V2[number];
type ParentObservationV2 = PlatformReleaseBootstrapDarwinSystemAnchorParentObservationV2;
type FileObservationV2 = PlatformReleaseBootstrapDarwinSystemAnchorFileObservationV2;

type FixtureStateV2 = Readonly<{
  parents: readonly [ParentObservationV2, ParentObservationV2];
  files: readonly [FileObservationV2, FileObservationV2, FileObservationV2, FileObservationV2];
  snapshot: PlatformReleaseBootstrapDarwinSystemAnchorSnapshotV2;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(
  code: PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256BytesV2(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeTextV2(stat: BigIntStatV2): string {
  return (Number(stat.mode & 0o7777n)).toString(8).padStart(4, "0");
}

function statIdentityV2<K extends "directory" | "ordinary_file">(stat: BigIntStatV2, objectKind: K) {
  return {
    hostIdentityHash: HOST_IDENTITY_HASH_V2,
    objectKind,
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  } as const;
}

function samePhysicalV2(
  left: Readonly<{ hostIdentityHash: string; objectKind: string; device: string; inode: string }>,
  right: Readonly<{ hostIdentityHash: string; objectKind: string; device: string; inode: string }>,
): boolean {
  return left.hostIdentityHash === right.hostIdentityHash
    && left.objectKind === right.objectKind
    && left.device === right.device
    && left.inode === right.inode;
}

function sameMutableV2(
  left: Readonly<{ ownerUid: number; ownerGid: number; mode: string; linkCount: number; byteLength: number; contentHash: string; modifiedTimeNanoseconds: string; changedTimeNanoseconds: string }>,
  right: Readonly<{ ownerUid: number; ownerGid: number; mode: string; linkCount: number; byteLength: number; contentHash: string; modifiedTimeNanoseconds: string; changedTimeNanoseconds: string }>,
): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function parentMutableV2(stat: BigIntStatV2, directEntryNamesHash: string) {
  return {
    ownerUid: Number(stat.uid),
    ownerGid: Number(stat.gid),
    mode: modeTextV2(stat),
    linkCount: Number(stat.nlink),
    byteLength: Number(stat.size),
    contentHash: directEntryNamesHash,
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  } as const;
}

function assertRootOwnedDirectoryV2(stat: BigIntStatV2, pathValue: string): void {
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || realpathSync(pathValue) !== pathValue
    || Number(stat.uid) !== 0
    || Number(stat.gid) !== 0
    || modeTextV2(stat) !== "0755"
    || stat.size > BigInt(64 * 1024 * 1024)
  ) {
    return failV2(
      "SYSTEM_ANCHOR_FILESYSTEM_DRIFT",
      "System anchor parent is not the exact root-owned 0755 directory",
    );
  }
}

function captureParentV2(definition: ParentDefinitionV2): ParentObservationV2 {
  let descriptor = -1;
  try {
    const pathBefore = lstatSync(definition.absoluteLocator, { bigint: true }) as BigIntStatV2;
    assertRootOwnedDirectoryV2(pathBefore, definition.absoluteLocator);
    descriptor = openSync(
      definition.absoluteLocator,
      fsConstants.O_RDONLY
        | (fsConstants.O_DIRECTORY ?? 0)
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!descriptorBefore.isDirectory() || !samePhysicalV2(
      statIdentityV2(pathBefore, "directory"),
      statIdentityV2(descriptorBefore, "directory"),
    )) {
      return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor parent changed before descriptor capture");
    }
    const names = readdirSync(definition.absoluteLocator).sort();
    if (names.length > MAX_PARENT_ENTRIES_V2 || names.some((name) => name.length < 1 || name.length > 255)) {
      return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor parent exceeds its bounded membership");
    }
    const namesHash = hashSystemAnchorDirectEntryNamesV2(names);
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(definition.absoluteLocator, { bigint: true }) as BigIntStatV2;
    const mutableBefore = parentMutableV2(descriptorBefore, namesHash);
    const mutableAfter = parentMutableV2(descriptorAfter, namesHash);
    if (!descriptorAfter.isDirectory() || !pathAfter.isDirectory()
      || !samePhysicalV2(statIdentityV2(descriptorBefore, "directory"), statIdentityV2(descriptorAfter, "directory"))
      || !samePhysicalV2(statIdentityV2(descriptorAfter, "directory"), statIdentityV2(pathAfter, "directory"))
      || !sameMutableV2(mutableBefore, mutableAfter)) {
      return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor parent changed during descriptor capture");
    }
    const identity = {
      parentRef: definition.parentRef,
      absoluteLocator: definition.absoluteLocator,
      stableIdentity: statIdentityV2(descriptorAfter, "directory"),
      mutableFingerprint: mutableAfter,
      directEntryNamesHash: namesHash,
    } as const;
    return {
      ...identity,
      observationHash: hashSystemAnchorParentObservationV2(identity),
    };
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2) throw error;
    return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor parent could not be captured", error);
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function fileMutableV2(stat: BigIntStatV2, contentHash: string) {
  return {
    ownerUid: Number(stat.uid),
    ownerGid: Number(stat.gid),
    mode: modeTextV2(stat),
    linkCount: Number(stat.nlink),
    byteLength: Number(stat.size),
    contentHash,
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  } as const;
}

function captureFileV2(
  definition: FileDefinitionV2,
  parent: ParentObservationV2,
): FileObservationV2 {
  let descriptor = -1;
  try {
    const pathBefore = lstatSync(definition.absoluteLocator, { bigint: true }) as BigIntStatV2;
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || Number(pathBefore.uid) !== 0
      || Number(pathBefore.gid) !== 0
      || modeTextV2(pathBefore) !== "0755"
      || pathBefore.nlink !== 1n
      || pathBefore.size <= 0n
      || pathBefore.size > BigInt(16 * 1024 * 1024)
    ) {
      return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor file is not the exact root-owned executable");
    }
    descriptor = openSync(
      definition.absoluteLocator,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!descriptorBefore.isFile()
      || !samePhysicalV2(statIdentityV2(pathBefore, "ordinary_file"), statIdentityV2(descriptorBefore, "ordinary_file"))) {
      return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor file changed before descriptor capture");
    }
    const length = Number(descriptorBefore.size);
    const bytes = Buffer.alloc(length);
    const digest = createHash("sha256");
    let offset = 0;
    while (offset < length) {
      const count = readSync(descriptor, bytes, offset, length - offset, offset);
      if (count <= 0) {
        bytes.fill(0);
        return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor file reached EOF before its size");
      }
      digest.update(bytes.subarray(offset, offset + count));
      offset += count;
    }
    const eof = Buffer.alloc(1);
    if (readSync(descriptor, eof, 0, 1, length) !== 0) {
      bytes.fill(0);
      eof.fill(0);
      return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor file grew during capture");
    }
    bytes.fill(0);
    eof.fill(0);
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(definition.absoluteLocator, { bigint: true }) as BigIntStatV2;
    const contentHash = digest.digest("hex");
    const mutableBefore = fileMutableV2(descriptorBefore, contentHash);
    const mutableAfter = fileMutableV2(descriptorAfter, contentHash);
    if (!descriptorAfter.isFile() || !pathAfter.isFile()
      || !samePhysicalV2(statIdentityV2(descriptorBefore, "ordinary_file"), statIdentityV2(descriptorAfter, "ordinary_file"))
      || !samePhysicalV2(statIdentityV2(descriptorAfter, "ordinary_file"), statIdentityV2(pathAfter, "ordinary_file"))
      || !sameMutableV2(mutableBefore, mutableAfter)) {
      return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor file changed during descriptor capture");
    }
    const identity = {
      fileRef: definition.fileRef,
      parentRef: definition.parentRef,
      absoluteLocator: definition.absoluteLocator,
      parentIdentityHash: hashSystemAnchorParentStableIdentityV2(parent.stableIdentity),
      stableIdentity: statIdentityV2(descriptorAfter, "ordinary_file"),
      mutableFingerprint: mutableAfter,
    } as const;
    return { ...identity, observationHash: hashSystemAnchorFileObservationV2(identity) };
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2) throw error;
    return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchor file could not be captured", error);
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function captureSnapshotV2(): PlatformReleaseBootstrapDarwinSystemAnchorSnapshotV2 {
  const parents = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_DEFINITIONS_V2.map(captureParentV2) as [ParentObservationV2, ParentObservationV2];
  const parentByRef = new Map(parents.map((parent) => [parent.parentRef, parent]));
  const files = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_DEFINITIONS_V2.map((definition) => {
    const parent = parentByRef.get(definition.parentRef);
    if (parent === undefined) return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System file parent anchor is missing");
    return captureFileV2(definition, parent);
  }) as [FileObservationV2, FileObservationV2, FileObservationV2, FileObservationV2];
  const logicalBindings = [...PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_LOGICAL_BINDINGS_V2] as [
    LogicalBindingV2,
    LogicalBindingV2,
    LogicalBindingV2,
    LogicalBindingV2,
    LogicalBindingV2,
  ];
  const identity = { parents, files, logicalBindings } as const;
  return { ...identity, snapshotHash: hashSystemAnchorSnapshotV2(identity) };
}

type LogicalBindingV2 = typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_LOGICAL_BINDINGS_V2[number];

function authenticFixtureStateV2(fixture: PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2): FixtureStateV2 {
  if (typeof fixture !== "object" || fixture === null || isProxy(fixture)) {
    return failV2("SYSTEM_ANCHOR_FIXTURE_HANDLE_UNAUTHENTICATED", "System-anchor probe requires one authentic handle");
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) return failV2("SYSTEM_ANCHOR_FIXTURE_HANDLE_UNAUTHENTICATED", "System-anchor handle is not code-owned");
  return state;
}

export function buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2(): PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2 {
  if (process.platform !== "darwin") return failV2("SYSTEM_ANCHOR_PLATFORM_UNAVAILABLE", "System-anchor fixture requires Darwin");
  try {
    const snapshot = captureSnapshotV2();
    let fixture: PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2;
    fixture = Object.freeze({ dispose(): void { fixtureStatesV2.delete(fixture); } });
    fixtureStatesV2.set(fixture, Object.freeze({ parents: snapshot.parents, files: snapshot.files, snapshot }));
    return fixture;
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2) throw error;
    return failV2("SYSTEM_ANCHOR_FIXTURE_BUILD_FAILED", "Could not capture system-anchor fixture", error);
  }
}

export async function observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2(
  fixture: PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2,
  options: Readonly<{ challenge?: Uint8Array }> = {},
): Promise<PlatformReleaseBootstrapDarwinSystemAnchorObservationV2> {
  if (process.platform !== "darwin") return failV2("SYSTEM_ANCHOR_PLATFORM_UNAVAILABLE", "System-anchor observation requires Darwin");
  const state = authenticFixtureStateV2(fixture);
  const challenge = options.challenge === undefined ? randomBytes(32) : Buffer.from(options.challenge);
  if (challenge.byteLength !== 32) return failV2("SYSTEM_ANCHOR_CHALLENGE_INVALID", "System-anchor challenge must be exactly 32 bytes");
  const before = captureSnapshotV2();
  if (canonicalJsonStringify(before) !== canonicalJsonStringify(state.snapshot)) return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchors changed before observation");
  const after = captureSnapshotV2();
  if (canonicalJsonStringify(before) !== canonicalJsonStringify(after)) return failV2("SYSTEM_ANCHOR_FILESYSTEM_DRIFT", "System anchors changed across observation fence");
  const observationOutcome = "system_anchors_observed" as const;
  const observationHash = hashSystemAnchorObservationV2({ before, after, observationOutcome, policyHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_POLICY_HASH_V2 });
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OBSERVATION_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "observed_test_fixture_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_TRUST_CONCLUSION_V2,
    implementationScope: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_IMPLEMENTATION_SCOPE_V2,
    operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_REF_V2,
    operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_HASH_V2,
    hostCompositionReceiptHash: HOST_COMPOSITION_RECEIPT_HASH_V2,
    challengeHash: sha256BytesV2(challenge),
    policyHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_POLICY_HASH_V2,
    observationOutcome,
    before,
    after,
    observationHash,
  };
  return parsePlatformReleaseBootstrapDarwinSystemAnchorObservationCandidateV2({
    ...identity,
    probeHash: hashPlatformReleaseBootstrapDarwinSystemAnchorObservationV2(identity),
  });
}
