import {
  lstatSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";

import { hashCanonicalJson } from "./canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import { z } from "zod";

/**
 * V3 is an additive observation ABI.  The V2 host receipt remains the
 * compatibility receipt; this module is only reached by an explicit caller
 * that already owns an authenticated host-toolchain capability.
 */
export const HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_SCHEMA =
  "setfarm.host-node-toolchain-physical-identity.v3" as const;
export const HOST_NODE_TOOLCHAIN_PHYSICAL_SCOPE_V3_SCHEMA =
  "setfarm.host-node-toolchain-physical-scope.v3" as const;
export const HOST_NODE_TOOLCHAIN_STABLE_OBJECT_IDENTITY_V3_SCHEMA =
  "setfarm.host-node-toolchain-stable-object-identity.v3" as const;
export const HOST_NODE_TOOLCHAIN_MUTABLE_FINGERPRINT_V3_SCHEMA =
  "setfarm.host-node-toolchain-mutable-fingerprint.v3" as const;
export const HOST_NODE_TOOLCHAIN_PHYSICAL_OBSERVATION_V3_SCHEMA =
  "setfarm.host-node-toolchain-physical-observation.v3" as const;

const HOST_NODE_TOOLCHAIN_PHYSICAL_SCOPE_V3_HASH_DOMAIN =
  "setfarm.host-node-toolchain-physical-scope-hash.v3" as const;
const HOST_NODE_TOOLCHAIN_STABLE_OBJECT_IDENTITY_V3_HASH_DOMAIN =
  "setfarm.host-node-toolchain-stable-object-identity-hash.v3" as const;
const HOST_NODE_TOOLCHAIN_MUTABLE_FINGERPRINT_V3_HASH_DOMAIN =
  "setfarm.host-node-toolchain-mutable-fingerprint-hash.v3" as const;
const HOST_NODE_TOOLCHAIN_PHYSICAL_OBSERVATION_V3_HASH_DOMAIN =
  "setfarm.host-node-toolchain-physical-observation-hash.v3" as const;
const HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_HASH_DOMAIN =
  "setfarm.host-node-toolchain-physical-identity-hash.v3" as const;

export const HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION =
  "3.0.0" as const;
/** Five singleton observations plus the unchanged V2 dynamic-library cap. */
export const HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_MAX_DYNAMIC_LIBRARIES =
  512 as const;
export const HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_MAX_OBSERVATIONS =
  5 + HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_MAX_DYNAMIC_LIBRARIES;
export const HOST_NODE_TOOLCHAIN_PHYSICAL_DECIMAL_MAX_DIGITS_V3 =
  80 as const;
export const HOST_NODE_TOOLCHAIN_PHYSICAL_OWNER_ID_MAX_V3 =
  4_294_967_294 as const;

const CanonicalUnsignedPhysicalDecimalV3Schema = z.string()
  .min(1)
  .max(HOST_NODE_TOOLCHAIN_PHYSICAL_DECIMAL_MAX_DIGITS_V3)
  .regex(
    /^(?:0|[1-9][0-9]*)$/,
    "Expected one canonical unsigned physical decimal",
  );

const CanonicalPosixOwnerIdV3Schema = CanonicalUnsignedPhysicalDecimalV3Schema
  .refine(
    (value) => BigInt(value) <= BigInt(HOST_NODE_TOOLCHAIN_PHYSICAL_OWNER_ID_MAX_V3),
    `Expected a POSIX owner id at most ${HOST_NODE_TOOLCHAIN_PHYSICAL_OWNER_ID_MAX_V3}`,
  );

const VersionV3Schema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._+-]+$/, "Expected one bounded host version");

const HostNodeToolchainPhysicalAdmissionScopeV3Schema = z.enum([
  "production_host",
  "test_fixture",
]);

export type HostNodeToolchainPhysicalAdmissionScopeV3 = z.infer<
  typeof HostNodeToolchainPhysicalAdmissionScopeV3Schema
>;

export const HostNodeToolchainPhysicalObjectKindV3Schema = z.enum([
  "ordinary_file",
  "directory",
]);

export type HostNodeToolchainPhysicalObjectKindV3 = z.infer<
  typeof HostNodeToolchainPhysicalObjectKindV3Schema
>;

export const HostNodeToolchainPhysicalObjectRoleV3Schema = z.enum([
  "toolchain_root",
  "node_executable",
  "npm_package_root",
  "npm_cli",
  "npm_package_json",
  "non_system_dynamic_library",
]);

export type HostNodeToolchainPhysicalObjectRoleV3 = z.infer<
  typeof HostNodeToolchainPhysicalObjectRoleV3Schema
>;

const HOST_NODE_TOOLCHAIN_PHYSICAL_SINGLETON_ROLES_V3 = [
  "toolchain_root",
  "node_executable",
  "npm_package_root",
  "npm_cli",
  "npm_package_json",
] as const satisfies readonly HostNodeToolchainPhysicalObjectRoleV3[];

const HOST_NODE_TOOLCHAIN_PHYSICAL_ROLE_ORDER_V3 = [
  ...HOST_NODE_TOOLCHAIN_PHYSICAL_SINGLETON_ROLES_V3,
  "non_system_dynamic_library",
] as const satisfies readonly HostNodeToolchainPhysicalObjectRoleV3[];

const HostNodeToolchainPhysicalScopeIdentityV3Schema = z.object({
  schema: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_SCOPE_V3_SCHEMA),
  version: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION),
  namespace: z.literal("host_node_toolchain"),
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
  macosProductVersion: VersionV3Schema,
  macosBuildVersion: VersionV3Schema,
  darwinKernelRelease: VersionV3Schema,
}).strict();

export type HostNodeToolchainPhysicalScopeHashPayloadV3 = z.infer<
  typeof HostNodeToolchainPhysicalScopeIdentityV3Schema
>;

export function hashHostNodeToolchainPhysicalScopeV3(
  value: HostNodeToolchainPhysicalScopeHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: HOST_NODE_TOOLCHAIN_PHYSICAL_SCOPE_V3_HASH_DOMAIN,
    scope: value,
  });
}

export const HostNodeToolchainPhysicalScopeV3Schema =
  HostNodeToolchainPhysicalScopeIdentityV3Schema.extend({
    scopeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { scopeHash: _scopeHash, ...identity } = value;
    if (value.scopeHash !== hashHostNodeToolchainPhysicalScopeV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["scopeHash"],
        message: "Host physical scope hash mismatch",
      });
    }
  });

export type HostNodeToolchainPhysicalScopeV3 = z.infer<
  typeof HostNodeToolchainPhysicalScopeV3Schema
>;

export function buildHostNodeToolchainPhysicalScopeV3(input: Readonly<{
  platform: "darwin";
  architecture: "arm64" | "x64";
  macosProductVersion: string;
  macosBuildVersion: string;
  darwinKernelRelease: string;
}>): HostNodeToolchainPhysicalScopeV3 {
  const identity = HostNodeToolchainPhysicalScopeIdentityV3Schema.parse({
    schema: HOST_NODE_TOOLCHAIN_PHYSICAL_SCOPE_V3_SCHEMA,
    version: HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION,
    namespace: "host_node_toolchain",
    ...input,
  });
  return freezeV3({
    ...identity,
    scopeHash: hashHostNodeToolchainPhysicalScopeV3(identity),
  });
}

const HostNodeToolchainStableObjectIdentityV3IdentitySchema = z.object({
  schema: z.literal(HOST_NODE_TOOLCHAIN_STABLE_OBJECT_IDENTITY_V3_SCHEMA),
  version: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION),
  hostIdentityHash: Sha256Schema,
  objectKind: HostNodeToolchainPhysicalObjectKindV3Schema,
  device: CanonicalUnsignedPhysicalDecimalV3Schema,
  inode: CanonicalUnsignedPhysicalDecimalV3Schema,
}).strict();

export type HostNodeToolchainStableObjectIdentityV3HashPayload = z.infer<
  typeof HostNodeToolchainStableObjectIdentityV3IdentitySchema
>;

export function hashHostNodeToolchainStableObjectIdentityV3(
  value: HostNodeToolchainStableObjectIdentityV3HashPayload,
): string {
  return hashCanonicalJson({
    schema: HOST_NODE_TOOLCHAIN_STABLE_OBJECT_IDENTITY_V3_HASH_DOMAIN,
    identity: value,
  });
}

export const HostNodeToolchainStableObjectIdentityV3Schema =
  HostNodeToolchainStableObjectIdentityV3IdentitySchema.extend({
    objectIdentityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { objectIdentityHash: _objectIdentityHash, ...identity } = value;
    if (
      value.objectIdentityHash
      !== hashHostNodeToolchainStableObjectIdentityV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["objectIdentityHash"],
        message: "Host stable object identity hash mismatch",
      });
    }
  });

export type HostNodeToolchainStableObjectIdentityV3 = z.infer<
  typeof HostNodeToolchainStableObjectIdentityV3Schema
>;

export function buildHostNodeToolchainStableObjectIdentityV3(input: Readonly<{
  hostIdentityHash: string;
  objectKind: HostNodeToolchainPhysicalObjectKindV3;
  device: string;
  inode: string;
}>): HostNodeToolchainStableObjectIdentityV3 {
  const identity = HostNodeToolchainStableObjectIdentityV3IdentitySchema.parse({
    schema: HOST_NODE_TOOLCHAIN_STABLE_OBJECT_IDENTITY_V3_SCHEMA,
    version: HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION,
    ...input,
  });
  return freezeV3({
    ...identity,
    objectIdentityHash: hashHostNodeToolchainStableObjectIdentityV3(identity),
  });
}

const HostNodeToolchainMutableFingerprintV3IdentitySchema = z.object({
  schema: z.literal(HOST_NODE_TOOLCHAIN_MUTABLE_FINGERPRINT_V3_SCHEMA),
  version: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION),
  objectIdentityHash: Sha256Schema,
  ownerUid: CanonicalPosixOwnerIdV3Schema,
  ownerGid: CanonicalPosixOwnerIdV3Schema,
  mode: z.string().regex(/^[0-7]{4}$/, "Expected one four-digit octal mode"),
  linkCount: CanonicalUnsignedPhysicalDecimalV3Schema.refine(
    (value) => value !== "0",
    "Expected a positive link count",
  ),
  byteLength: CanonicalUnsignedPhysicalDecimalV3Schema,
  modifiedTimeNanoseconds: CanonicalUnsignedPhysicalDecimalV3Schema,
  changedTimeNanoseconds: CanonicalUnsignedPhysicalDecimalV3Schema,
}).strict();

export type HostNodeToolchainMutableFingerprintV3HashPayload = z.infer<
  typeof HostNodeToolchainMutableFingerprintV3IdentitySchema
>;

export function hashHostNodeToolchainMutableFingerprintV3(
  value: HostNodeToolchainMutableFingerprintV3HashPayload,
): string {
  return hashCanonicalJson({
    schema: HOST_NODE_TOOLCHAIN_MUTABLE_FINGERPRINT_V3_HASH_DOMAIN,
    fingerprint: value,
  });
}

export const HostNodeToolchainMutableFingerprintV3Schema =
  HostNodeToolchainMutableFingerprintV3IdentitySchema.extend({
    fingerprintHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { fingerprintHash: _fingerprintHash, ...identity } = value;
    if (
      value.fingerprintHash
      !== hashHostNodeToolchainMutableFingerprintV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["fingerprintHash"],
        message: "Host mutable fingerprint hash mismatch",
      });
    }
  });

export type HostNodeToolchainMutableFingerprintV3 = z.infer<
  typeof HostNodeToolchainMutableFingerprintV3Schema
>;

export function buildHostNodeToolchainMutableFingerprintV3(input: Readonly<{
  objectIdentityHash: string;
  ownerUid: string;
  ownerGid: string;
  mode: string;
  linkCount: string;
  byteLength: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>): HostNodeToolchainMutableFingerprintV3 {
  const identity = HostNodeToolchainMutableFingerprintV3IdentitySchema.parse({
    schema: HOST_NODE_TOOLCHAIN_MUTABLE_FINGERPRINT_V3_SCHEMA,
    version: HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION,
    ...input,
  });
  return freezeV3({
    ...identity,
    fingerprintHash: hashHostNodeToolchainMutableFingerprintV3(identity),
  });
}

const HostNodeToolchainPhysicalObservationV3IdentitySchema = z.object({
  schema: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_OBSERVATION_V3_SCHEMA),
  version: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION),
  admissionScope: HostNodeToolchainPhysicalAdmissionScopeV3Schema,
  role: HostNodeToolchainPhysicalObjectRoleV3Schema,
  memberRef: z.string().regex(/^HOST_NODE_NON_SYSTEM_DYLIB_[0-9]{4}$/).optional(),
  installNameHash: Sha256Schema.optional(),
  objectIdentity: HostNodeToolchainStableObjectIdentityV3Schema,
  fingerprint: HostNodeToolchainMutableFingerprintV3Schema,
}).strict();

export type HostNodeToolchainPhysicalObservationV3HashPayload = z.infer<
  typeof HostNodeToolchainPhysicalObservationV3IdentitySchema
>;

export function hashHostNodeToolchainPhysicalObservationV3(
  value: HostNodeToolchainPhysicalObservationV3HashPayload,
): string {
  return hashCanonicalJson({
    schema: HOST_NODE_TOOLCHAIN_PHYSICAL_OBSERVATION_V3_HASH_DOMAIN,
    observation: value,
  });
}

export const HostNodeToolchainPhysicalObservationV3Schema =
  HostNodeToolchainPhysicalObservationV3IdentitySchema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { observationHash: _observationHash, ...identity } = value;
    const hasMemberRef = value.memberRef !== undefined;
    const hasInstallNameHash = value.installNameHash !== undefined;
    const dynamicMemberFieldsPresent = hasMemberRef && hasInstallNameHash;
    const dynamicMemberFieldsPartial = hasMemberRef !== hasInstallNameHash;
    if (
      value.fingerprint.objectIdentityHash
        !== value.objectIdentity.objectIdentityHash
      || (value.role === "non_system_dynamic_library" && !dynamicMemberFieldsPresent)
      || dynamicMemberFieldsPartial
      || (value.role !== "non_system_dynamic_library" && (hasMemberRef || hasInstallNameHash))
      || value.observationHash
        !== hashHostNodeToolchainPhysicalObservationV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        message: "Host physical observation must bind stable identity, mutable fingerprint, and hash",
      });
    }
  });

export type HostNodeToolchainPhysicalObservationV3 = z.infer<
  typeof HostNodeToolchainPhysicalObservationV3Schema
>;

export function buildHostNodeToolchainPhysicalObservationV3(input: Readonly<{
  admissionScope: HostNodeToolchainPhysicalAdmissionScopeV3;
  role: HostNodeToolchainPhysicalObjectRoleV3;
  memberRef?: string;
  installNameHash?: string;
  objectIdentity: HostNodeToolchainStableObjectIdentityV3;
  fingerprint: HostNodeToolchainMutableFingerprintV3;
}>): HostNodeToolchainPhysicalObservationV3 {
  const identity = HostNodeToolchainPhysicalObservationV3IdentitySchema.parse({
    schema: HOST_NODE_TOOLCHAIN_PHYSICAL_OBSERVATION_V3_SCHEMA,
    version: HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION,
    ...input,
  });
  return freezeV3(HostNodeToolchainPhysicalObservationV3Schema.parse({
    ...identity,
    observationHash: hashHostNodeToolchainPhysicalObservationV3(identity),
  }));
}

const HostNodeToolchainPhysicalIdentityV3IdentitySchema = z.object({
  schema: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_SCHEMA),
  version: z.literal(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION),
  authorityDisposition: z.literal("observation_only_non_authoritative"),
  admissionScope: HostNodeToolchainPhysicalAdmissionScopeV3Schema,
  hostToolchainReceiptHash: Sha256Schema,
  revalidatedHostToolchainReceiptHash: Sha256Schema,
  scope: HostNodeToolchainPhysicalScopeV3Schema,
  observations: z.array(HostNodeToolchainPhysicalObservationV3Schema)
    .min(1)
    .max(HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_MAX_OBSERVATIONS),
}).strict();

export type HostNodeToolchainPhysicalIdentityV3HashPayload = z.infer<
  typeof HostNodeToolchainPhysicalIdentityV3IdentitySchema
>;

export function hashHostNodeToolchainPhysicalIdentityV3(
  value: HostNodeToolchainPhysicalIdentityV3HashPayload,
): string {
  return hashCanonicalJson({
    schema: HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_HASH_DOMAIN,
    identity: value,
  });
}

export const HostNodeToolchainPhysicalIdentityV3Schema =
  HostNodeToolchainPhysicalIdentityV3IdentitySchema.extend({
    identityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const roles = new Set<string>();
    const expectedKinds: Readonly<Record<
      HostNodeToolchainPhysicalObjectRoleV3,
      HostNodeToolchainPhysicalObjectKindV3
    >> = {
      toolchain_root: "directory",
      node_executable: "ordinary_file",
      npm_package_root: "directory",
      npm_cli: "ordinary_file",
      npm_package_json: "ordinary_file",
      non_system_dynamic_library: "ordinary_file",
    };
    let previousRoleIndex = -1;
    let previousDynamicInstallNameHash: string | undefined;
    let dynamicMemberIndex = 0;
    const aggregateHostIdentityHash =
      value.observations[0]?.objectIdentity.hostIdentityHash;
    for (const [index, observation] of value.observations.entries()) {
      const roleIndex = HOST_NODE_TOOLCHAIN_PHYSICAL_ROLE_ORDER_V3.indexOf(observation.role);
      if (
        roleIndex < previousRoleIndex
        || (roleIndex === previousRoleIndex
          && observation.role === "non_system_dynamic_library"
          && previousDynamicInstallNameHash !== undefined
          && (observation.installNameHash === undefined
            || observation.installNameHash <= previousDynamicInstallNameHash))
      ) {
        context.addIssue({
          code: "custom",
          path: ["observations", index, "role"],
          message: "Host physical observations must use the canonical role and dynamic-member order",
        });
      }
      previousRoleIndex = roleIndex;
      if (observation.role === "non_system_dynamic_library") {
        dynamicMemberIndex += 1;
        const expectedMemberRef =
          `HOST_NODE_NON_SYSTEM_DYLIB_${String(dynamicMemberIndex).padStart(4, "0")}`;
        if (observation.memberRef !== expectedMemberRef) {
          context.addIssue({
            code: "custom",
            path: ["observations", index, "memberRef"],
            message: "Host dynamic-library member refs must be contiguous from 0001",
          });
        }
        previousDynamicInstallNameHash = observation.installNameHash;
      } else {
        previousDynamicInstallNameHash = undefined;
      }
      if (
        aggregateHostIdentityHash === undefined
        || observation.objectIdentity.hostIdentityHash
          !== aggregateHostIdentityHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["observations", index, "objectIdentity", "hostIdentityHash"],
          message: "Every host physical observation must join one host identity",
        });
      }
      if (
        observation.admissionScope !== value.admissionScope
        || observation.objectIdentity.objectKind !== expectedKinds[observation.role]
      ) {
        context.addIssue({
          code: "custom",
          path: ["observations", index],
          message: "Host physical observation role, kind, and admission scope must join the aggregate",
        });
      }
      if (
        observation.role !== "non_system_dynamic_library"
        && roles.has(observation.role)
      ) {
        context.addIssue({
          code: "custom",
          path: ["observations", index, "role"],
          message: "Host physical identity cannot contain duplicate singleton roles",
        });
      }
      roles.add(observation.role);
    }
    for (const requiredRole of HOST_NODE_TOOLCHAIN_PHYSICAL_SINGLETON_ROLES_V3) {
      if (!roles.has(requiredRole)) {
        context.addIssue({
          code: "custom",
          path: ["observations"],
          message: `Host physical identity is missing required ${requiredRole} observation`,
        });
      }
    }
    if (value.hostToolchainReceiptHash !== value.revalidatedHostToolchainReceiptHash) {
      context.addIssue({
        code: "custom",
        path: ["revalidatedHostToolchainReceiptHash"],
        message: "Host physical observation must bind the fresh V2 revalidation receipt hash",
      });
    }
    const { identityHash: _identityHash, ...identity } = value;
    if (value.identityHash !== hashHostNodeToolchainPhysicalIdentityV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["identityHash"],
        message: "Host physical identity hash mismatch",
      });
    }
  });

export type HostNodeToolchainPhysicalIdentityV3 = z.infer<
  typeof HostNodeToolchainPhysicalIdentityV3Schema
>;

export function buildHostNodeToolchainPhysicalIdentityV3(input: Readonly<{
  admissionScope: HostNodeToolchainPhysicalAdmissionScopeV3;
  hostToolchainReceiptHash: string;
  revalidatedHostToolchainReceiptHash: string;
  scope: HostNodeToolchainPhysicalScopeV3;
  observations: readonly HostNodeToolchainPhysicalObservationV3[];
}>): HostNodeToolchainPhysicalIdentityV3 {
  const parsed = HostNodeToolchainPhysicalIdentityV3IdentitySchema.parse({
    schema: HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_SCHEMA,
    version: HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_VERSION,
    authorityDisposition: "observation_only_non_authoritative",
    ...input,
    observations: [...input.observations].sort((left, right) => {
      const leftRoleIndex = HOST_NODE_TOOLCHAIN_PHYSICAL_ROLE_ORDER_V3.indexOf(left.role);
      const rightRoleIndex = HOST_NODE_TOOLCHAIN_PHYSICAL_ROLE_ORDER_V3.indexOf(right.role);
      if (leftRoleIndex < rightRoleIndex) return -1;
      if (leftRoleIndex > rightRoleIndex) return 1;
      if (left.role === "non_system_dynamic_library") {
        const leftInstallNameHash = left.installNameHash ?? "";
        const rightInstallNameHash = right.installNameHash ?? "";
        if (leftInstallNameHash < rightInstallNameHash) return -1;
        if (leftInstallNameHash > rightInstallNameHash) return 1;
      }
      if (left.observationHash < right.observationHash) return -1;
      if (left.observationHash > right.observationHash) return 1;
      return 0;
    }),
  });
  return freezeV3(HostNodeToolchainPhysicalIdentityV3Schema.parse({
    ...parsed,
    identityHash: hashHostNodeToolchainPhysicalIdentityV3(parsed),
  }));
}

export type CaptureHostNodeToolchainPhysicalObservationV3Input = Readonly<{
  admissionScope: HostNodeToolchainPhysicalAdmissionScopeV3;
  role: HostNodeToolchainPhysicalObjectRoleV3;
  objectKind: HostNodeToolchainPhysicalObjectKindV3;
  hostIdentityHash: string;
  absolutePath: string;
  memberRef?: string;
  installNameHash?: string;
}>;

export type HostNodeToolchainPhysicalIdentityV3ErrorCode =
  | "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_INPUT_INVALID"
  | "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_INVALID"
  | "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_UNAVAILABLE"
  | "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_SYMLINK_FORBIDDEN"
  | "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_OBJECT_KIND_MISMATCH"
  | "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_DRIFT";

export class HostNodeToolchainPhysicalIdentityV3Error extends Error {
  readonly code: HostNodeToolchainPhysicalIdentityV3ErrorCode;

  constructor(code: HostNodeToolchainPhysicalIdentityV3ErrorCode, message: string, options?: ErrorOptions) {
    super(message.slice(0, 1_500), options);
    this.name = "HostNodeToolchainPhysicalIdentityV3Error";
    this.code = code;
  }
}

function physicalFailure(
  code: HostNodeToolchainPhysicalIdentityV3ErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new HostNodeToolchainPhysicalIdentityV3Error(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function decimalPhysicalStat(value: bigint, label: string): string {
  if (value < 0n) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_INVALID",
      `${label} must be non-negative`,
    );
  }
  return String(value);
}

function exactModeV3(stat: BigIntStats): string {
  return Number(stat.mode & 0o7777n).toString(8).padStart(4, "0");
}

function samePhysicalStatV3(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function statObjectKindV3(stat: BigIntStats): HostNodeToolchainPhysicalObjectKindV3 | undefined {
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "ordinary_file";
  return undefined;
}

export function captureHostNodeToolchainPhysicalObservationV3(
  input: CaptureHostNodeToolchainPhysicalObservationV3Input,
): HostNodeToolchainPhysicalObservationV3 {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.absolutePath !== "string"
    || !path.isAbsolute(input.absolutePath)
    || input.absolutePath.includes("\0")
    || path.resolve(input.absolutePath) !== input.absolutePath
  ) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_INVALID",
      "Host physical observation requires one normalized absolute path",
    );
  }
  let hostIdentityHash: string;
  try {
    hostIdentityHash = Sha256Schema.parse(input.hostIdentityHash);
  } catch (error) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_INPUT_INVALID",
      "Host physical observation requires one validated host identity",
      error,
    );
  }
  let before: BigIntStats;
  try {
    before = lstatSync(input.absolutePath, { bigint: true });
  } catch (error) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_UNAVAILABLE",
      "Host physical observation path cannot be inspected",
      error,
    );
  }
  if (before.isSymbolicLink()) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_SYMLINK_FORBIDDEN",
      "Host physical observation cannot traverse a symbolic link",
    );
  }
  const actualKind = statObjectKindV3(before);
  if (actualKind === undefined) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_OBJECT_KIND_MISMATCH",
      "Host physical observation requires one regular file or directory",
    );
  }
  if (actualKind !== input.objectKind) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_OBJECT_KIND_MISMATCH",
      `Host physical observation expected ${input.objectKind} but found ${actualKind}`,
    );
  }
  try {
    if (realpathSync(input.absolutePath) !== input.absolutePath) {
      return physicalFailure(
        "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_SYMLINK_FORBIDDEN",
        "Host physical observation path is not one direct real path",
      );
    }
  } catch (error) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_UNAVAILABLE",
      "Host physical observation real path cannot be established",
      error,
    );
  }
  let after: BigIntStats;
  try {
    after = lstatSync(input.absolutePath, { bigint: true });
  } catch (error) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_PATH_UNAVAILABLE",
      "Host physical observation disappeared during capture",
      error,
    );
  }
  if (
    after.isSymbolicLink()
    || statObjectKindV3(after) !== input.objectKind
    || !samePhysicalStatV3(before, after)
  ) {
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_DRIFT",
      "Host physical observation changed while it was captured",
    );
  }
  try {
    const objectIdentity = buildHostNodeToolchainStableObjectIdentityV3({
      hostIdentityHash,
      objectKind: input.objectKind,
      device: decimalPhysicalStat(after.dev, "device"),
      inode: decimalPhysicalStat(after.ino, "inode"),
    });
    const fingerprint = buildHostNodeToolchainMutableFingerprintV3({
      objectIdentityHash: objectIdentity.objectIdentityHash,
      ownerUid: decimalPhysicalStat(after.uid, "owner uid"),
      ownerGid: decimalPhysicalStat(after.gid, "owner gid"),
      mode: exactModeV3(after),
      linkCount: decimalPhysicalStat(after.nlink, "link count"),
      byteLength: decimalPhysicalStat(after.size, "byte length"),
      modifiedTimeNanoseconds:
        decimalPhysicalStat(after.mtimeNs, "modified time"),
      changedTimeNanoseconds:
        decimalPhysicalStat(after.ctimeNs, "changed time"),
    });
    return buildHostNodeToolchainPhysicalObservationV3({
      admissionScope: input.admissionScope,
      role: input.role,
      ...(input.memberRef !== undefined ? { memberRef: input.memberRef } : {}),
      ...(input.installNameHash !== undefined ? { installNameHash: input.installNameHash } : {}),
      objectIdentity,
      fingerprint,
    });
  } catch (error) {
    if (error instanceof HostNodeToolchainPhysicalIdentityV3Error) throw error;
    return physicalFailure(
      "HOST_NODE_TOOLCHAIN_PHYSICAL_IDENTITY_V3_INPUT_INVALID",
      "Host physical observation could not be projected into its exact V3 schema",
      error,
    );
  }
}

function freezeV3<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
