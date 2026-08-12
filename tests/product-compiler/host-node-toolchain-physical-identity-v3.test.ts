import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  HostNodeToolchainPhysicalIdentityV3Schema,
  HostNodeToolchainPhysicalIdentityV3Error,
  HostNodeToolchainStableObjectIdentityV3Schema,
  HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_MAX_OBSERVATIONS,
  buildHostNodeToolchainMutableFingerprintV3,
  buildHostNodeToolchainPhysicalIdentityV3,
  buildHostNodeToolchainPhysicalObservationV3,
  buildHostNodeToolchainPhysicalScopeV3,
  buildHostNodeToolchainStableObjectIdentityV3,
  captureHostNodeToolchainPhysicalObservationV3,
  hashHostNodeToolchainPhysicalObservationV3,
} from "../../src/product-compiler/host-node-toolchain-physical-identity-v3.js";

const roots: string[] = [];
const HOST_IDENTITY_HASH_A = "a".repeat(64);
const HOST_IDENTITY_HASH_B = "b".repeat(64);

function scope() {
  return buildHostNodeToolchainPhysicalScopeV3({
    platform: "darwin",
    architecture: "arm64",
    macosProductVersion: "26.5.2",
    macosBuildVersion: "25F84",
    darwinKernelRelease: "25.5.0",
  });
}

type SyntheticObservationOptions = Readonly<{
  hostIdentityHash?: string;
  role?: "toolchain_root" | "node_executable" | "npm_package_root" | "npm_cli" | "npm_package_json" | "non_system_dynamic_library";
  objectKind?: "ordinary_file" | "directory";
  device?: string;
  inode?: string;
  ownerUid?: string;
  ownerGid?: string;
  byteLength?: string;
  modifiedTimeNanoseconds?: string;
  changedTimeNanoseconds?: string;
  memberRef?: string;
  installNameHash?: string;
}>;

function syntheticObservation(options: SyntheticObservationOptions = {}) {
  const role = options.role ?? "toolchain_root";
  const objectIdentity = buildHostNodeToolchainStableObjectIdentityV3({
    hostIdentityHash: options.hostIdentityHash ?? HOST_IDENTITY_HASH_A,
    objectKind: options.objectKind ?? "directory",
    device: options.device ?? "9007199254740993",
    inode: options.inode ?? "9007199254740995",
  });
  const fingerprint = buildHostNodeToolchainMutableFingerprintV3({
    objectIdentityHash: objectIdentity.objectIdentityHash,
    ownerUid: options.ownerUid ?? "0",
    ownerGid: options.ownerGid ?? "0",
    mode: options.objectKind === "ordinary_file" ? "0444" : "0755",
    linkCount: "1",
    byteLength: options.byteLength ?? "9007199254740997",
    modifiedTimeNanoseconds: options.modifiedTimeNanoseconds ?? "9007199254740999",
    changedTimeNanoseconds: options.changedTimeNanoseconds ?? "9007199254741001",
  });
  return buildHostNodeToolchainPhysicalObservationV3({
    admissionScope: "test_fixture",
    role,
    ...(options.memberRef !== undefined ? { memberRef: options.memberRef } : {}),
    ...(options.installNameHash !== undefined ? { installNameHash: options.installNameHash } : {}),
    objectIdentity,
    fingerprint,
  });
}

function fullSingletonObservations(hostIdentityHash = HOST_IDENTITY_HASH_A) {
  return [
    syntheticObservation({ hostIdentityHash, role: "toolchain_root", objectKind: "directory", device: "9007199254740993", inode: "9007199254740995" }),
    syntheticObservation({ hostIdentityHash, role: "node_executable", objectKind: "ordinary_file", device: "42", inode: "43" }),
    syntheticObservation({ hostIdentityHash, role: "npm_package_root", objectKind: "directory", device: "44", inode: "45" }),
    syntheticObservation({ hostIdentityHash, role: "npm_cli", objectKind: "ordinary_file", device: "46", inode: "47" }),
    syntheticObservation({ hostIdentityHash, role: "npm_package_json", objectKind: "ordinary_file", device: "48", inode: "49" }),
  ];
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("HostNodeToolchainPhysicalIdentityV3", () => {
  it("keeps stable decimal device/inode identity separate from mutable fingerprint", () => {
    const hostScope = scope();
    const first = syntheticObservation();
    const changedFingerprint = buildHostNodeToolchainMutableFingerprintV3({
      objectIdentityHash: first.fingerprint.objectIdentityHash,
      ownerUid: first.fingerprint.ownerUid,
      ownerGid: first.fingerprint.ownerGid,
      mode: first.fingerprint.mode,
      linkCount: first.fingerprint.linkCount,
      byteLength: "9007199254741999",
      modifiedTimeNanoseconds: first.fingerprint.modifiedTimeNanoseconds,
      changedTimeNanoseconds: first.fingerprint.changedTimeNanoseconds,
    });

    assert.equal(first.objectIdentity.device, "9007199254740993");
    assert.equal(first.objectIdentity.inode, "9007199254740995");
    assert.equal(first.fingerprint.ownerUid, "0");
    assert.equal(first.objectIdentity.objectIdentityHash, first.fingerprint.objectIdentityHash);
    assert.notEqual(first.fingerprint.fingerprintHash, changedFingerprint.fingerprintHash);
    assert.equal(first.objectIdentity.hostIdentityHash, HOST_IDENTITY_HASH_A);
    assert.throws(() => buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "a".repeat(64),
      revalidatedHostToolchainReceiptHash: "a".repeat(64),
      scope: hostScope,
      observations: [first],
    }));
    const complete = buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "a".repeat(64),
      revalidatedHostToolchainReceiptHash: "a".repeat(64),
      scope: hostScope,
      observations: fullSingletonObservations(),
    });
    assert.equal(HostNodeToolchainPhysicalIdentityV3Schema.safeParse(complete).success, true);
    assert.throws(() => buildHostNodeToolchainMutableFingerprintV3({
      objectIdentityHash: first.objectIdentity.objectIdentityHash,
      ownerUid: "4294967295",
      ownerGid: "0",
      mode: "0755",
      linkCount: "1",
      byteLength: "1",
      modifiedTimeNanoseconds: "1",
      changedTimeNanoseconds: "1",
    }));
    assert.throws(() => buildHostNodeToolchainPhysicalObservationV3({
      admissionScope: "test_fixture",
      role: "toolchain_root",
      memberRef: "HOST_NODE_NON_SYSTEM_DYLIB_0001",
      objectIdentity: first.objectIdentity,
      fingerprint: first.fingerprint,
    }));
    assert.equal(HostNodeToolchainStableObjectIdentityV3Schema.safeParse({
      ...first.objectIdentity,
      device: "09007199254740993",
    }).success, false);
  });

  it("separates aggregate host scope from stable host identity and rejects cross-host joins", () => {
    const hostScope = scope();
    const hostAObservations = fullSingletonObservations(HOST_IDENTITY_HASH_A);
    const hostBObservations = fullSingletonObservations(HOST_IDENTITY_HASH_B);
    const hostAObject = hostAObservations[0]!.objectIdentity;
    const hostBObject = hostBObservations[0]!.objectIdentity;

    assert.equal(hostAObject.device, hostBObject.device);
    assert.equal(hostAObject.inode, hostBObject.inode);
    assert.equal(hostAObject.objectKind, hostBObject.objectKind);
    assert.notEqual(hostAObject.hostIdentityHash, hostBObject.hostIdentityHash);
    assert.notEqual(hostAObject.objectIdentityHash, hostBObject.objectIdentityHash);
    assert.equal("hostScopeHash" in hostAObject, false);

    const hostAIdentity = buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "c".repeat(64),
      revalidatedHostToolchainReceiptHash: "c".repeat(64),
      scope: hostScope,
      observations: hostAObservations,
    });
    const hostBIdentity = buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "c".repeat(64),
      revalidatedHostToolchainReceiptHash: "c".repeat(64),
      scope: hostScope,
      observations: hostBObservations,
    });

    assert.equal(hostAIdentity.scope.scopeHash, hostBIdentity.scope.scopeHash);
    assert.equal("hostIdentityHash" in hostAIdentity, false);
    assert.equal(hostAIdentity.observations.every((observation) =>
      observation.objectIdentity.hostIdentityHash === HOST_IDENTITY_HASH_A), true);
    assert.notEqual(hostAIdentity.identityHash, hostBIdentity.identityHash);
    assert.throws(() => buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "c".repeat(64),
      revalidatedHostToolchainReceiptHash: "c".repeat(64),
      scope: { ...hostScope, scopeHash: "f".repeat(64) },
      observations: hostAObservations,
    }));
    assert.throws(() => buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "c".repeat(64),
      revalidatedHostToolchainReceiptHash: "c".repeat(64),
      scope: hostScope,
      observations: [
        ...hostAObservations.slice(0, -1),
        hostBObservations.at(-1)!,
      ],
    }));
  });

  it("captures real filesystem stats with bigint before decimal serialization", () => {
    const root = mkdtempSync(path.join(tmpdir(), "setfarm-host-physical-v3-"));
    roots.push(root);
    const file = path.join(root, "node");
    writeFileSync(file, "node fixture\n", { mode: 0o555 });
    chmodSync(file, 0o555);
    const observed = captureHostNodeToolchainPhysicalObservationV3({
      admissionScope: "test_fixture",
      role: "node_executable",
      objectKind: "ordinary_file",
      hostIdentityHash: HOST_IDENTITY_HASH_A,
      absolutePath: realpathSync(file),
    });
    const stat = lstatSync(file, { bigint: true });

    assert.equal(observed.objectIdentity.hostIdentityHash, HOST_IDENTITY_HASH_A);
    assert.equal(observed.objectIdentity.device, String(stat.dev));
    assert.equal(observed.objectIdentity.inode, String(stat.ino));
    assert.equal(observed.fingerprint.ownerUid, String(stat.uid));
    assert.equal(observed.fingerprint.ownerGid, String(stat.gid));
    assert.equal(observed.fingerprint.linkCount, String(stat.nlink));
    assert.equal(observed.fingerprint.byteLength, String(stat.size));
    assert.equal(observed.fingerprint.modifiedTimeNanoseconds, String(stat.mtimeNs));
    assert.equal(observed.fingerprint.changedTimeNanoseconds, String(stat.ctimeNs));
    assert.equal(observed.fingerprint.mode, "0555");
    assert.equal(observed.fingerprint.objectIdentityHash, observed.objectIdentity.objectIdentityHash);
  });

  it("fails closed for symlinks, object-kind mismatches, and non-normalized paths", () => {
    const root = mkdtempSync(path.join(tmpdir(), "setfarm-host-physical-v3-"));
    roots.push(root);
    const file = path.join(root, "node");
    const alias = path.join(root, "alias");
    writeFileSync(file, "node fixture\n", { mode: 0o555 });
    chmodSync(file, 0o555);
    symlinkSync(file, alias);

    assert.throws(() => captureHostNodeToolchainPhysicalObservationV3({
      admissionScope: "test_fixture",
      role: "node_executable",
      objectKind: "ordinary_file",
      hostIdentityHash: HOST_IDENTITY_HASH_A,
      absolutePath: alias,
    }), (error: unknown) => error instanceof HostNodeToolchainPhysicalIdentityV3Error
      && error.code === "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_SYMLINK_FORBIDDEN");
    assert.throws(() => captureHostNodeToolchainPhysicalObservationV3({
      admissionScope: "test_fixture",
      role: "node_executable",
      objectKind: "directory",
      hostIdentityHash: HOST_IDENTITY_HASH_A,
      absolutePath: file,
    }), (error: unknown) => error instanceof HostNodeToolchainPhysicalIdentityV3Error
      && error.code === "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_OBJECT_KIND_MISMATCH");
    assert.throws(() => captureHostNodeToolchainPhysicalObservationV3({
      admissionScope: "test_fixture",
      role: "node_executable",
      objectKind: "ordinary_file",
      hostIdentityHash: HOST_IDENTITY_HASH_A,
      absolutePath: `${file}/..`,
    }), (error: unknown) => error instanceof HostNodeToolchainPhysicalIdentityV3Error
      && error.code === "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_INVALID");
    assert.throws(() => captureHostNodeToolchainPhysicalObservationV3({
      admissionScope: "test_fixture",
      role: "node_executable",
      objectKind: "ordinary_file",
      hostIdentityHash: "f".repeat(63),
      absolutePath: realpathSync(file),
    }), (error: unknown) => error instanceof HostNodeToolchainPhysicalIdentityV3Error
      && error.code === "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_INPUT_INVALID");
  });

  it("joins an explicit ordered observation set without changing V2-compatible inputs", () => {
    const hostScope = scope();
    const singletonObservations = fullSingletonObservations();
    const dynamic = syntheticObservation({
      role: "non_system_dynamic_library",
      objectKind: "ordinary_file",
      device: "50",
      inode: "51",
      memberRef: "HOST_NODE_NON_SYSTEM_DYLIB_0001",
      installNameHash: "c".repeat(64),
    });
    const identity = buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "b".repeat(64),
      revalidatedHostToolchainReceiptHash: "b".repeat(64),
      scope: hostScope,
      observations: [dynamic, ...singletonObservations.slice().reverse()],
    });

    assert.equal(identity.observations.length, 6);
    assert.deepEqual(
      identity.observations.map((observation) => observation.role),
      [
        "toolchain_root",
        "node_executable",
        "npm_package_root",
        "npm_cli",
        "npm_package_json",
        "non_system_dynamic_library",
      ],
    );
    assert.equal(identity.observations.at(-1)?.memberRef, "HOST_NODE_NON_SYSTEM_DYLIB_0001");
    assert.equal(identity.identityHash.length, 64);
    assert.equal(HostNodeToolchainPhysicalIdentityV3Schema.parse(identity).identityHash, identity.identityHash);
  });

  it("admits the unchanged V2 dynamic-library ceiling and rejects non-contiguous member refs", () => {
    const hostScope = scope();
    const singletonObservations = fullSingletonObservations();
    const dynamicObservations = Array.from({ length: 512 }, (_, index) => {
      const ordinal = index + 1;
      return syntheticObservation({
        role: "non_system_dynamic_library",
        objectKind: "ordinary_file",
        device: String(100 + ordinal),
        inode: String(10_000 + ordinal),
        memberRef: `HOST_NODE_NON_SYSTEM_DYLIB_${String(ordinal).padStart(4, "0")}`,
        installNameHash: ordinal.toString(16).padStart(64, "0"),
      });
    });
    assert.equal(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_MAX_OBSERVATIONS, 517);
    const identity = buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "d".repeat(64),
      revalidatedHostToolchainReceiptHash: "d".repeat(64),
      scope: hostScope,
      observations: [...singletonObservations, ...dynamicObservations],
    });
    assert.equal(identity.observations.length, 517);
    const nonContiguous = dynamicObservations.map((observation, index) =>
      index === 1
        ? (() => {
          const { observationHash: _observationHash, ...identity } = observation;
          const changed = {
            ...identity,
            memberRef: "HOST_NODE_NON_SYSTEM_DYLIB_0003" as const,
          };
          return {
            ...changed,
            observationHash: hashHostNodeToolchainPhysicalObservationV3(changed),
          };
        })()
        : observation);
    assert.throws(() => buildHostNodeToolchainPhysicalIdentityV3({
      admissionScope: "test_fixture",
      hostToolchainReceiptHash: "d".repeat(64),
      revalidatedHostToolchainReceiptHash: "d".repeat(64),
      scope: hostScope,
      observations: [...singletonObservations, ...nonContiguous],
    }));
  });
});
