import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  hashNodeToolchainOperationalLocatorV2,
} from "./node-toolchain-target-registry-v2.js";
import {
  buildNodeToolchainProvisionerMutableFingerprintV3,
  buildNodeToolchainProvisionerPhysicalCensusV3,
  buildNodeToolchainProvisionerPhysicalObservationV3,
  buildNodeToolchainProvisionerPhysicalScopeV3,
  buildNodeToolchainProvisionerStableObjectIdentityV3,
  NodeToolchainProvisionerPhysicalScopeV3Schema,
  type NodeToolchainProvisionerPhysicalCensusV3,
  type NodeToolchainProvisionerPhysicalObservationV3,
  type NodeToolchainProvisionerPhysicalRoleV3,
  type NodeToolchainProvisionerPhysicalScopeV3,
} from "./schemas/node-toolchain-provisioner-physical-census-v3.js";

export type NodeToolchainProvisionerPhysicalPathsV3 = Readonly<
  Record<NodeToolchainProvisionerPhysicalRoleV3, string>
>;

export type CaptureNodeToolchainProvisionerPhysicalCensusV3Input = Readonly<{
  scope: NodeToolchainProvisionerPhysicalScopeV3;
  paths: NodeToolchainProvisionerPhysicalPathsV3;
}>;

export type NodeToolchainProvisionerPhysicalCensusV3ErrorCode =
  | "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_PATH_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_PATH_UNAVAILABLE"
  | "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_HOST_IDENTITY_UNAVAILABLE"
  | "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_DRIFT"
  | "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_MISMATCH";

export class NodeToolchainProvisionerPhysicalCensusV3Error extends Error {
  readonly code: NodeToolchainProvisionerPhysicalCensusV3ErrorCode;

  constructor(
    code: NodeToolchainProvisionerPhysicalCensusV3ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainProvisionerPhysicalCensusV3Error";
    this.code = code;
  }
}

function fail(
  code: NodeToolchainProvisionerPhysicalCensusV3ErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerPhysicalCensusV3Error(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function normalizedAbsolutePath(value: string, label: string): string {
  if (
    value.length < 1
    || value.length > 4_096
    || value.includes("\0")
    || !path.isAbsolute(value)
    || path.normalize(value) !== value
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_PATH_INVALID",
      `${label} must be one normalized absolute path`,
    );
  }
  return value;
}

function decimal(value: bigint, label: string): string {
  if (value < 0n) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_PATH_INVALID",
      `${label} must be non-negative`,
    );
  }
  return value.toString(10);
}

function modeText(stat: BigIntStats): string {
  return Number(stat.mode & 0o7777n).toString(8).padStart(4, "0");
}

function objectKind(stat: BigIntStats):
  "ordinary_file" | "directory" | "symbolic_link" | "other" {
  if (stat.isFile()) return "ordinary_file";
  if (stat.isDirectory()) return "directory";
  if (stat.isSymbolicLink()) return "symbolic_link";
  return "other";
}

function sameStat(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.rdev === right.rdev
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function statPath(
  absolutePath: string,
  role: NodeToolchainProvisionerPhysicalRoleV3,
): BigIntStats | undefined {
  try {
    return lstatSync(absolutePath, { bigint: true });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_PATH_UNAVAILABLE",
      `Provisioner physical ${role} path cannot be inspected`,
      error,
    );
  }
}

function captureObservation(
  scope: NodeToolchainProvisionerPhysicalScopeV3,
  role: NodeToolchainProvisionerPhysicalRoleV3,
  absolutePath: string,
): NodeToolchainProvisionerPhysicalObservationV3 {
  const locatorKind = role;
  const locatorHash = hashNodeToolchainOperationalLocatorV2(locatorKind, absolutePath);
  const before = statPath(absolutePath, role);
  if (!before) {
    const afterMissing = statPath(absolutePath, role);
    if (afterMissing) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_DRIFT",
        `Provisioner physical ${role} path appeared during absence capture`,
      );
    }
    return buildNodeToolchainProvisionerPhysicalObservationV3({
      role,
      locatorHash,
      state: "absent",
    });
  }
  const kind = objectKind(before);
  const after = statPath(absolutePath, role);
  if (!after || objectKind(after) !== kind || !sameStat(before, after)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_DRIFT",
      `Provisioner physical ${role} path changed during exact capture`,
    );
  }
  const objectIdentity = buildNodeToolchainProvisionerStableObjectIdentityV3({
    hostIdentityHash: scope.hostIdentityHash,
    objectKind: kind,
    device: decimal(after.dev, `${role} device`),
    inode: decimal(after.ino, `${role} inode`),
  });
  const fingerprint = buildNodeToolchainProvisionerMutableFingerprintV3({
    objectIdentityHash: objectIdentity.objectIdentityHash,
    ownerUid: decimal(after.uid, `${role} owner uid`),
    ownerGid: decimal(after.gid, `${role} owner gid`),
    mode: modeText(after),
    linkCount: decimal(after.nlink, `${role} link count`),
    byteLength: decimal(after.size, `${role} byte length`),
    modifiedTimeNanoseconds: decimal(after.mtimeNs, `${role} modified time`),
    changedTimeNanoseconds: decimal(after.ctimeNs, `${role} changed time`),
  });
  return buildNodeToolchainProvisionerPhysicalObservationV3({
    role,
    locatorHash,
    state: "present",
    objectIdentity,
    fingerprint,
  });
}

function exactPaths(input: unknown): NodeToolchainProvisionerPhysicalPathsV3 {
  if (typeof input !== "object" || input === null) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_INPUT_INVALID",
      "Physical census requires one paths object",
    );
  }
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [...[
    "parent",
    "root",
    "receipt",
    "claim",
    "rollback_claim",
    "lock",
    "staging",
  ]].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_INPUT_INVALID",
      "Physical census paths must contain exactly the seven provisioner roles",
    );
  }
  const result = {} as Record<NodeToolchainProvisionerPhysicalRoleV3, string>;
  for (const role of expected as NodeToolchainProvisionerPhysicalRoleV3[]) {
    const value = record[role];
    if (typeof value !== "string") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_PATH_INVALID",
        `Physical census ${role} path must be a string`,
      );
    }
    result[role] = normalizedAbsolutePath(value, `Physical census ${role}`);
  }
  return Object.freeze(result);
}

function boundedMachineIdentity(): Readonly<{
  source: "darwin_io_platform_uuid_v3" | "linux_machine_id_v3";
  value: string;
}> {
  try {
    if (process.platform === "darwin") {
      const output = execFileSync(
        "/usr/sbin/ioreg",
        ["-rd1", "-c", "IOPlatformExpertDevice"],
        {
          encoding: "utf8",
          maxBuffer: 64 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      const match = /"IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]{36})"/u.exec(output);
      if (match?.[1] && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(match[1].toLowerCase())) {
        return Object.freeze({
          source: "darwin_io_platform_uuid_v3",
          value: match[1].toLowerCase(),
        });
      }
    } else if (process.platform === "linux") {
      for (const candidate of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        let descriptor: number | undefined;
        let machineBytes: Buffer | undefined;
        try {
          descriptor = openSync(
            candidate,
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          );
          const before = fstatSync(descriptor, { bigint: true });
          if (
            !before.isFile()
            || before.isSymbolicLink()
            || before.nlink !== 1n
            || before.size < 1n
            || before.size > 4_096n
            || before.size > BigInt(Number.MAX_SAFE_INTEGER)
          ) continue;
          machineBytes = Buffer.allocUnsafeSlow(Number(before.size));
          let offset = 0;
          while (offset < machineBytes.byteLength) {
            const count = readSync(descriptor, machineBytes, offset, machineBytes.byteLength - offset, null);
            if (count < 1) break;
            offset += count;
          }
          const eof = Buffer.allocUnsafe(1);
          const after = fstatSync(descriptor, { bigint: true });
          const value = offset === machineBytes.byteLength
            && readSync(descriptor, eof, 0, 1, null) === 0
            && before.dev === after.dev
            && before.ino === after.ino
            && before.size === after.size
            && before.mtimeNs === after.mtimeNs
            && before.ctimeNs === after.ctimeNs
            ? machineBytes.toString("utf8").trim().toLowerCase()
            : "";
          if (/^[0-9a-f]{32}$/u.test(value)) {
            return Object.freeze({ source: "linux_machine_id_v3", value });
          }
        } catch {
          // Try the next code-owned machine identity source.
        } finally {
          machineBytes?.fill(0);
          if (descriptor !== undefined) {
            try {
              closeSync(descriptor);
            } catch {
              // Try the next source; the identity is never accepted on read failure.
            }
          }
        }
      }
    }
  } catch {
    // Fail closed below; hostname and kernel release are not host identity.
  }
  return fail(
    "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_HOST_IDENTITY_UNAVAILABLE",
    "Provisioner cannot obtain one stable host machine identity",
  );
}

export function defaultNodeToolchainProvisionerHostIdentityHashV3(_input?: Readonly<{
  admissionScope: "production_root" | "test_fixture";
  architecture: "arm64" | "x64";
}>): string {
  const machine = boundedMachineIdentity();
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-host-identity.v3",
    platform: process.platform,
    machineIdentitySource: machine.source,
    machineIdentity: machine.value,
  });
}

export function captureNodeToolchainProvisionerPhysicalCensusV3(
  input: CaptureNodeToolchainProvisionerPhysicalCensusV3Input,
): NodeToolchainProvisionerPhysicalCensusV3 {
  let scope: NodeToolchainProvisionerPhysicalScopeV3;
  try {
    scope = NodeToolchainProvisionerPhysicalScopeV3Schema.parse(input.scope);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_INPUT_INVALID",
      "Physical census requires one validated V3 scope",
      error,
    );
  }
  const paths = exactPaths(input.paths);
  const observations = [
    ...[
      "parent",
      "root",
      "receipt",
      "claim",
      "rollback_claim",
      "lock",
      "staging",
    ] as const,
  ].map((role) => captureObservation(scope, role, paths[role]));
  return buildNodeToolchainProvisionerPhysicalCensusV3({ scope, observations });
}

export function verifyNodeToolchainProvisionerPhysicalCensusV3(
  expected: NodeToolchainProvisionerPhysicalCensusV3,
  input: CaptureNodeToolchainProvisionerPhysicalCensusV3Input,
  options?: Readonly<{ allowPreparationTransition?: boolean }>,
): NodeToolchainProvisionerPhysicalCensusV3 {
  const fresh = captureNodeToolchainProvisionerPhysicalCensusV3(input);
  if (fresh.censusHash !== expected.censusHash) {
    if (options?.allowPreparationTransition) {
      const preparationRoles = new Set<NodeToolchainProvisionerPhysicalRoleV3>([
        "lock",
        "staging",
      ]);
      const expectedByRole = new Map(expected.observations.map((observation) => [observation.role, observation]));
      const freshByRole = new Map(fresh.observations.map((observation) => [observation.role, observation]));
      const sawPreparationTransition = expected.observations.some((observation) => {
        const current = freshByRole.get(observation.role);
        return current !== undefined
          && preparationRoles.has(observation.role)
          && observation.state === "absent"
          && current.state === "present";
      });
      const preparationOnly = expected.observations.every((observation) => {
        const current = freshByRole.get(observation.role);
        if (!current) return false;
        if (
          preparationRoles.has(observation.role)
          && observation.state === "absent"
          && current.state === "present"
        ) {
          return true;
        }
        if (
          observation.role === "parent"
          && observation.state === "absent"
          && current.state === "present"
          && sawPreparationTransition
        ) {
          return true;
        }
        if (
          observation.role === "parent"
          && observation.state === "present"
          && current.state === "present"
          && observation.objectIdentity.objectIdentityHash === current.objectIdentity.objectIdentityHash
          && observation.fingerprint.ownerUid === current.fingerprint.ownerUid
          && observation.fingerprint.ownerGid === current.fingerprint.ownerGid
          && observation.fingerprint.mode === current.fingerprint.mode
          && sawPreparationTransition
        ) {
          return true;
        }
        return current.observationHash === observation.observationHash;
      }) && fresh.observations.every((observation) => {
        const original = expectedByRole.get(observation.role);
        return original !== undefined && (
          !preparationRoles.has(observation.role)
          || original.state !== "absent"
          || observation.state === "present"
        );
      }) && sawPreparationTransition;
      if (preparationOnly) return fresh;
    }
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_MISMATCH",
      "Provisioner physical census no longer equals the bound transport census",
    );
  }
  return fresh;
}

export function makeNodeToolchainProvisionerPhysicalScopeV3(input: Readonly<{
  admissionScope: "production_root" | "test_fixture";
  architecture: "arm64" | "x64";
  targetRef: string;
  parentLocatorHash: string;
  hostIdentityHash?: string;
}>): NodeToolchainProvisionerPhysicalScopeV3 {
  if (input.hostIdentityHash !== undefined && input.admissionScope !== "test_fixture") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_INPUT_INVALID",
      "Production physical scopes must derive host identity from the machine source",
    );
  }
  return buildNodeToolchainProvisionerPhysicalScopeV3({
    admissionScope: input.admissionScope,
    architecture: input.architecture,
    targetRef: input.targetRef,
    parentLocatorHash: input.parentLocatorHash,
    hostIdentityHash: input.hostIdentityHash
      ?? defaultNodeToolchainProvisionerHostIdentityHashV3(input),
  });
}
