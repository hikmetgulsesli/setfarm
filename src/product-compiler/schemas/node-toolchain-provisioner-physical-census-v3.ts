import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import { NodeToolchainProvisionerPlanV2Schema } from "./node-toolchain-provisioner-command-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_SCHEMA =
  "setfarm.node-toolchain-provisioner-physical-census.v3" as const;
export const NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_SCOPE_V3_SCHEMA =
  "setfarm.node-toolchain-provisioner-physical-scope.v3" as const;
export const NODE_TOOLCHAIN_PROVISIONER_STABLE_OBJECT_IDENTITY_V3_SCHEMA =
  "setfarm.node-toolchain-provisioner-stable-object-identity.v3" as const;
export const NODE_TOOLCHAIN_PROVISIONER_MUTABLE_FINGERPRINT_V3_SCHEMA =
  "setfarm.node-toolchain-provisioner-mutable-fingerprint.v3" as const;
export const NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_OBSERVATION_V3_SCHEMA =
  "setfarm.node-toolchain-provisioner-physical-observation.v3" as const;
export const NODE_TOOLCHAIN_PROVISIONER_PLAN_TRANSPORT_V3_SCHEMA =
  "setfarm.node-toolchain-provisioner-plan-transport.v3" as const;

export const NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION =
  "3.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_AUTHORITY_REF =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3" as const;
export const NODE_TOOLCHAIN_PROVISIONER_PLAN_TRANSPORT_V3_AUTHORITY_REF =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_PLAN_TRANSPORT_V3" as const;

function deepFreezeV3<T>(value: T): T {
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

const PHYSICAL_CENSUS_HASH_DOMAIN_V3 =
  "setfarm.node-toolchain-provisioner-physical-census-hash.v3" as const;
const PHYSICAL_SCOPE_HASH_DOMAIN_V3 =
  "setfarm.node-toolchain-provisioner-physical-scope-hash.v3" as const;
const STABLE_OBJECT_IDENTITY_HASH_DOMAIN_V3 =
  "setfarm.node-toolchain-provisioner-stable-object-identity-hash.v3" as const;
const MUTABLE_FINGERPRINT_HASH_DOMAIN_V3 =
  "setfarm.node-toolchain-provisioner-mutable-fingerprint-hash.v3" as const;
const PHYSICAL_OBSERVATION_HASH_DOMAIN_V3 =
  "setfarm.node-toolchain-provisioner-physical-observation-hash.v3" as const;
const PLAN_TRANSPORT_HASH_DOMAIN_V3 =
  "setfarm.node-toolchain-provisioner-plan-transport-hash.v3" as const;

const CanonicalPhysicalDecimalV3Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/, "Expected one canonical unsigned physical decimal");

const PhysicalOwnerIdV3Schema = CanonicalPhysicalDecimalV3Schema.refine(
  (value) => BigInt(value) <= 4_294_967_294n,
  "Expected one bounded POSIX owner id",
);

const PhysicalModeV3Schema = z.string().regex(
  /^[0-7]{4}$/,
  "Expected one canonical four-digit octal mode",
);

export const NodeToolchainProvisionerPhysicalObjectKindV3Schema = z.enum([
  "ordinary_file",
  "directory",
  "symbolic_link",
  "other",
]);

export type NodeToolchainProvisionerPhysicalObjectKindV3 = z.infer<
  typeof NodeToolchainProvisionerPhysicalObjectKindV3Schema
>;

export const NodeToolchainProvisionerPhysicalRoleV3Schema = z.enum([
  "parent",
  "root",
  "receipt",
  "claim",
  "rollback_claim",
  "lock",
  "staging",
]);

export type NodeToolchainProvisionerPhysicalRoleV3 = z.infer<
  typeof NodeToolchainProvisionerPhysicalRoleV3Schema
>;

export const NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_ROLE_ORDER_V3 = Object.freeze([
  "parent",
  "root",
  "receipt",
  "claim",
  "rollback_claim",
  "lock",
  "staging",
] as const) satisfies readonly NodeToolchainProvisionerPhysicalRoleV3[];

const ArchitectureV3Schema = z.enum(["arm64", "x64"]);
const AdmissionScopeV3Schema = z.enum(["production_root", "test_fixture"]);
const TargetRefV3Schema = z.enum([
  "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
  "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_X64_V2",
]);

const PhysicalScopeIdentityV3Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_SCOPE_V3_SCHEMA),
  version: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION),
  namespace: z.literal("node_toolchain_provisioner"),
  admissionScope: AdmissionScopeV3Schema,
  architecture: ArchitectureV3Schema,
  targetRef: TargetRefV3Schema,
  hostIdentityHash: Sha256Schema,
  parentLocatorHash: Sha256Schema,
}).strict();

export type NodeToolchainProvisionerPhysicalScopeHashPayloadV3 = z.infer<
  typeof PhysicalScopeIdentityV3Schema
>;

export function hashNodeToolchainProvisionerPhysicalScopeV3(
  value: NodeToolchainProvisionerPhysicalScopeHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PHYSICAL_SCOPE_HASH_DOMAIN_V3,
    scope: value,
  });
}

export const NodeToolchainProvisionerPhysicalScopeV3Schema =
  PhysicalScopeIdentityV3Schema.extend({
    scopeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { scopeHash: _scopeHash, ...identity } = value;
    if (value.scopeHash !== hashNodeToolchainProvisionerPhysicalScopeV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["scopeHash"],
        message: "Provisioner physical scope hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerPhysicalScopeV3 = z.infer<
  typeof NodeToolchainProvisionerPhysicalScopeV3Schema
>;

const StableObjectIdentityV3IdentitySchema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_STABLE_OBJECT_IDENTITY_V3_SCHEMA),
  version: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION),
  hostIdentityHash: Sha256Schema,
  objectKind: NodeToolchainProvisionerPhysicalObjectKindV3Schema,
  device: CanonicalPhysicalDecimalV3Schema,
  inode: CanonicalPhysicalDecimalV3Schema,
}).strict();

export type NodeToolchainProvisionerStableObjectIdentityHashPayloadV3 = z.infer<
  typeof StableObjectIdentityV3IdentitySchema
>;

export function hashNodeToolchainProvisionerStableObjectIdentityV3(
  value: NodeToolchainProvisionerStableObjectIdentityHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: STABLE_OBJECT_IDENTITY_HASH_DOMAIN_V3,
    identity: value,
  });
}

export const NodeToolchainProvisionerStableObjectIdentityV3Schema =
  StableObjectIdentityV3IdentitySchema.extend({
    objectIdentityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { objectIdentityHash: _objectIdentityHash, ...identity } = value;
    if (
      value.objectIdentityHash
      !== hashNodeToolchainProvisionerStableObjectIdentityV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["objectIdentityHash"],
        message: "Provisioner stable object identity hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerStableObjectIdentityV3 = z.infer<
  typeof NodeToolchainProvisionerStableObjectIdentityV3Schema
>;

export function buildNodeToolchainProvisionerStableObjectIdentityV3(input: Readonly<{
  hostIdentityHash: string;
  objectKind: NodeToolchainProvisionerPhysicalObjectKindV3;
  device: string;
  inode: string;
}>): NodeToolchainProvisionerStableObjectIdentityV3 {
  const identity = StableObjectIdentityV3IdentitySchema.parse({
    schema: NODE_TOOLCHAIN_PROVISIONER_STABLE_OBJECT_IDENTITY_V3_SCHEMA,
    version: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION,
    ...input,
  });
  return deepFreezeV3({
    ...identity,
    objectIdentityHash: hashNodeToolchainProvisionerStableObjectIdentityV3(identity),
  });
}

const MutableFingerprintV3IdentitySchema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_MUTABLE_FINGERPRINT_V3_SCHEMA),
  version: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION),
  objectIdentityHash: Sha256Schema,
  ownerUid: PhysicalOwnerIdV3Schema,
  ownerGid: PhysicalOwnerIdV3Schema,
  mode: PhysicalModeV3Schema,
  linkCount: CanonicalPhysicalDecimalV3Schema.refine(
    (value) => value !== "0",
    "Expected a positive link count",
  ),
  byteLength: CanonicalPhysicalDecimalV3Schema,
  modifiedTimeNanoseconds: CanonicalPhysicalDecimalV3Schema,
  changedTimeNanoseconds: CanonicalPhysicalDecimalV3Schema,
}).strict();

export type NodeToolchainProvisionerMutableFingerprintHashPayloadV3 = z.infer<
  typeof MutableFingerprintV3IdentitySchema
>;

export function hashNodeToolchainProvisionerMutableFingerprintV3(
  value: NodeToolchainProvisionerMutableFingerprintHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: MUTABLE_FINGERPRINT_HASH_DOMAIN_V3,
    fingerprint: value,
  });
}

export const NodeToolchainProvisionerMutableFingerprintV3Schema =
  MutableFingerprintV3IdentitySchema.extend({
    fingerprintHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { fingerprintHash: _fingerprintHash, ...identity } = value;
    if (value.fingerprintHash !== hashNodeToolchainProvisionerMutableFingerprintV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["fingerprintHash"],
        message: "Provisioner mutable fingerprint hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerMutableFingerprintV3 = z.infer<
  typeof NodeToolchainProvisionerMutableFingerprintV3Schema
>;

export function buildNodeToolchainProvisionerMutableFingerprintV3(input: Readonly<{
  objectIdentityHash: string;
  ownerUid: string;
  ownerGid: string;
  mode: string;
  linkCount: string;
  byteLength: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>): NodeToolchainProvisionerMutableFingerprintV3 {
  const identity = MutableFingerprintV3IdentitySchema.parse({
    schema: NODE_TOOLCHAIN_PROVISIONER_MUTABLE_FINGERPRINT_V3_SCHEMA,
    version: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION,
    ...input,
  });
  return deepFreezeV3({
    ...identity,
    fingerprintHash: hashNodeToolchainProvisionerMutableFingerprintV3(identity),
  });
}

const PresentObservationV3Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_OBSERVATION_V3_SCHEMA),
  version: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION),
  role: NodeToolchainProvisionerPhysicalRoleV3Schema,
  locatorHash: Sha256Schema,
  state: z.literal("present"),
  objectIdentity: NodeToolchainProvisionerStableObjectIdentityV3Schema,
  fingerprint: NodeToolchainProvisionerMutableFingerprintV3Schema,
}).strict();

const AbsentObservationV3Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_OBSERVATION_V3_SCHEMA),
  version: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION),
  role: NodeToolchainProvisionerPhysicalRoleV3Schema,
  locatorHash: Sha256Schema,
  state: z.literal("absent"),
}).strict();

const PhysicalObservationIdentityV3Schema = z.discriminatedUnion(
  "state",
  [AbsentObservationV3Schema, PresentObservationV3Schema],
);

export type NodeToolchainProvisionerPhysicalObservationHashPayloadV3 = z.infer<
  typeof PhysicalObservationIdentityV3Schema
>;

export function hashNodeToolchainProvisionerPhysicalObservationV3(
  value: NodeToolchainProvisionerPhysicalObservationHashPayloadV3
): string {
  return hashCanonicalJson({
    schema: PHYSICAL_OBSERVATION_HASH_DOMAIN_V3,
    observation: value,
  });
}

export const NodeToolchainProvisionerPhysicalObservationV3Schema =
  PhysicalObservationIdentityV3Schema.and(z.object({
    observationHash: Sha256Schema,
  }).strict()).superRefine((value, context) => {
    if (value.state === "present") {
      if (value.fingerprint.objectIdentityHash !== value.objectIdentity.objectIdentityHash) {
        context.addIssue({
          code: "custom",
          path: ["fingerprint", "objectIdentityHash"],
          message: "Mutable fingerprint must bind its stable object identity",
        });
      }
    }
    const { observationHash: _observationHash, ...identity } = value;
    if (value.observationHash !== hashNodeToolchainProvisionerPhysicalObservationV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Provisioner physical observation hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerPhysicalObservationV3 = z.infer<
  typeof NodeToolchainProvisionerPhysicalObservationV3Schema
>;

export function buildNodeToolchainProvisionerPhysicalObservationV3(
  input: Readonly<{
    role: NodeToolchainProvisionerPhysicalRoleV3;
    locatorHash: string;
    state: "absent";
  } | {
    role: NodeToolchainProvisionerPhysicalRoleV3;
    locatorHash: string;
    state: "present";
    objectIdentity: NodeToolchainProvisionerStableObjectIdentityV3;
    fingerprint: NodeToolchainProvisionerMutableFingerprintV3;
  }>,
): NodeToolchainProvisionerPhysicalObservationV3 {
  const identity = PhysicalObservationIdentityV3Schema.parse({
    schema: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_OBSERVATION_V3_SCHEMA,
    version: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION,
    ...input,
  });
  return deepFreezeV3(NodeToolchainProvisionerPhysicalObservationV3Schema.parse({
    ...identity,
    observationHash: hashNodeToolchainProvisionerPhysicalObservationV3(identity),
  }));
}

const PhysicalCensusIdentityV3Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_SCHEMA),
  version: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_AUTHORITY_REF),
  scope: NodeToolchainProvisionerPhysicalScopeV3Schema,
  observations: z.array(NodeToolchainProvisionerPhysicalObservationV3Schema)
    .length(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_ROLE_ORDER_V3.length),
}).strict();

export type NodeToolchainProvisionerPhysicalCensusHashPayloadV3 = z.infer<
  typeof PhysicalCensusIdentityV3Schema
>;

export function hashNodeToolchainProvisionerPhysicalCensusV3(
  value: NodeToolchainProvisionerPhysicalCensusHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PHYSICAL_CENSUS_HASH_DOMAIN_V3,
    census: value,
  });
}

export const NodeToolchainProvisionerPhysicalCensusV3Schema =
  PhysicalCensusIdentityV3Schema.extend({
    censusHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const roles = value.observations.map((observation) => observation.role);
    const roleOrderMatches = roles.every((role, index) => role === NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_ROLE_ORDER_V3[index]);
    if (!roleOrderMatches || new Set(roles).size !== roles.length) {
      context.addIssue({
        code: "custom",
        path: ["observations"],
        message: "Provisioner physical census requires one canonical observation for every role",
      });
    }
    for (const [index, observation] of value.observations.entries()) {
      if (observation.state === "present"
        && observation.objectIdentity.hostIdentityHash !== value.scope.hostIdentityHash) {
        context.addIssue({
          code: "custom",
          path: ["observations", index, "objectIdentity", "hostIdentityHash"],
          message: "Every stable object identity must join the census host identity",
        });
      }
    }
    const { censusHash: _censusHash, ...identity } = value;
    if (value.censusHash !== hashNodeToolchainProvisionerPhysicalCensusV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["censusHash"],
        message: "Provisioner physical census hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerPhysicalCensusV3 = z.infer<
  typeof NodeToolchainProvisionerPhysicalCensusV3Schema
>;

export function buildNodeToolchainProvisionerPhysicalScopeV3(input: Readonly<{
  admissionScope: "production_root" | "test_fixture";
  architecture: "arm64" | "x64";
  targetRef: string;
  hostIdentityHash: string;
  parentLocatorHash: string;
}>): NodeToolchainProvisionerPhysicalScopeV3 {
  const identity = PhysicalScopeIdentityV3Schema.parse({
    schema: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_SCOPE_V3_SCHEMA,
    version: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION,
    namespace: "node_toolchain_provisioner",
    ...input,
  });
  return deepFreezeV3(NodeToolchainProvisionerPhysicalScopeV3Schema.parse({
    ...identity,
    scopeHash: hashNodeToolchainProvisionerPhysicalScopeV3(identity),
  }));
}

export function buildNodeToolchainProvisionerPhysicalCensusV3(input: Readonly<{
  scope: NodeToolchainProvisionerPhysicalScopeV3;
  observations: readonly NodeToolchainProvisionerPhysicalObservationV3[];
}>): NodeToolchainProvisionerPhysicalCensusV3 {
  const identity = PhysicalCensusIdentityV3Schema.parse({
    schema: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_SCHEMA,
    version: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_AUTHORITY_REF,
    scope: input.scope,
    observations: [...input.observations],
  });
  return deepFreezeV3(NodeToolchainProvisionerPhysicalCensusV3Schema.parse({
    ...identity,
    censusHash: hashNodeToolchainProvisionerPhysicalCensusV3(identity),
  }));
}

export function parseNodeToolchainProvisionerPhysicalCensusV3(
  input: unknown,
): NodeToolchainProvisionerPhysicalCensusV3 {
  return deepFreezeV3(NodeToolchainProvisionerPhysicalCensusV3Schema.parse(input));
}

const PlanTransportIdentityV3Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_PLAN_TRANSPORT_V3_SCHEMA),
  version: z.literal(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_PLAN_TRANSPORT_V3_AUTHORITY_REF),
  operation: z.enum(["apply", "rollback"]),
  plan: NodeToolchainProvisionerPlanV2Schema,
  physicalCensus: NodeToolchainProvisionerPhysicalCensusV3Schema,
}).strict();

export type NodeToolchainProvisionerPlanTransportHashPayloadV3 = z.infer<
  typeof PlanTransportIdentityV3Schema
>;

export function hashNodeToolchainProvisionerPlanTransportV3(
  value: NodeToolchainProvisionerPlanTransportHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PLAN_TRANSPORT_HASH_DOMAIN_V3,
    transport: value,
  });
}

export const NodeToolchainProvisionerPlanTransportV3Schema =
  PlanTransportIdentityV3Schema.extend({
    transportHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { transportHash: _transportHash, ...identity } = value;
    if (value.transportHash !== hashNodeToolchainProvisionerPlanTransportV3(identity)) {
      context.addIssue({ code: "custom", path: ["transportHash"], message: "Plan transport hash mismatch" });
    }
  });

export type NodeToolchainProvisionerPlanTransportV3 = z.infer<
  typeof NodeToolchainProvisionerPlanTransportV3Schema
>;

export function buildNodeToolchainProvisionerPlanTransportV3(input: Readonly<{
  operation: "apply" | "rollback";
  plan: unknown;
  physicalCensus: NodeToolchainProvisionerPhysicalCensusV3;
}>): NodeToolchainProvisionerPlanTransportV3 {
  const identity = PlanTransportIdentityV3Schema.parse({
    schema: NODE_TOOLCHAIN_PROVISIONER_PLAN_TRANSPORT_V3_SCHEMA,
    version: NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_VERSION,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_PLAN_TRANSPORT_V3_AUTHORITY_REF,
    operation: input.operation,
    plan: input.plan,
    physicalCensus: input.physicalCensus,
  });
  return deepFreezeV3(NodeToolchainProvisionerPlanTransportV3Schema.parse({
    ...identity,
    transportHash: hashNodeToolchainProvisionerPlanTransportV3(identity),
  }));
}

export function parseNodeToolchainProvisionerPlanTransportV3(
  input: unknown,
): NodeToolchainProvisionerPlanTransportV3 {
  return deepFreezeV3(NodeToolchainProvisionerPlanTransportV3Schema.parse(input));
}
