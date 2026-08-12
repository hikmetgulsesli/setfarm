import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
  INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2,
  INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2,
  InvocationInputTransportV2Schema,
} from "./invocation-input-transport-v2.js";

export const EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA =
  "setfarm.executable-invocation-transport-binding.v2" as const;
export const EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION = 2 as const;
export const EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_MAX_CANONICAL_BYTES =
  12 * 1024 * 1024;

const BINDING_HASH_DOMAIN_V2 =
  "setfarm.executable-invocation-transport-binding-hash.v2";

const ProfileBindingProjectionV2Schema = z.object({
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  profileHash: Sha256Schema,
  catalogVersion: z.literal("2.0.0"),
  catalogHash: Sha256Schema,
}).strict();

const StackTopologyBindingProjectionV2Schema = z.object({
  stackPackId: z.enum(["node-cli", "node-express-api"]),
  stackPackVersion: z.string().min(1).max(160),
  stackPackContentHash: Sha256Schema,
}).strict();

const EvidenceCapabilityPolicyBindingProjectionV2Schema = z.object({
  policySchema: z.literal("setfarm.product-evidence-capability-policy.v2"),
  policyVersion: z.literal("2.0.0"),
  policyHash: Sha256Schema,
}).strict();

const SemanticSourceRuleBindingProjectionV2Schema = z.object({
  catalogVersion: z.literal("1.0.0"),
  ruleSetRef: z.enum([
    "RULESET_NODE_CLI_V1",
    "RULESET_NODE_EXPRESS_API_STATELESS_V1",
  ]),
  ruleSetVersion: z.literal("1.0.0"),
  ruleSetHash: Sha256Schema,
  readiness: z.object({
    status: z.literal("shadow"),
    blockerCodes: z.array(z.enum([
      "SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED",
      "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED",
      "SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED",
      "SEMANTIC_SOURCE_PARSER_IMPLEMENTATION_UNVERIFIED",
      "SEMANTIC_SOURCE_RELEASE_MANIFEST_UNVERIFIED",
    ])).min(1).max(16),
  }).strict(),
}).strict();

const CodecCatalogBindingProjectionV2Schema = z.object({
  schema: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2),
  catalogVersion: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2),
  catalogHash: Sha256Schema,
}).strict();

const InvocationTransportAuthorityProjectionV2Schema = z.object({
  transportSchema: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
  transportKind: z.enum(["cli_command", "http_request"]),
  transportContractHash: Sha256Schema,
  actionInvocationIntentHash: Sha256Schema,
  productSpecHash: Sha256Schema,
  selectionHash: Sha256Schema,
  profileBinding: ProfileBindingProjectionV2Schema,
  stackTopologyBinding: StackTopologyBindingProjectionV2Schema,
  evidenceCapabilityPolicyBinding: EvidenceCapabilityPolicyBindingProjectionV2Schema,
  semanticSourceRuleBinding: SemanticSourceRuleBindingProjectionV2Schema,
  launcherRef: z.enum(["LAUNCH_NODE_CLI_V2", "LAUNCH_NODE_EXPRESS_API_V2"]),
  codecCatalogBinding: CodecCatalogBindingProjectionV2Schema,
}).strict();

const VerifiedReleaseProjectionV2Schema = z.object({
  platformReleaseManifestHash: Sha256Schema,
  runtimePayloadHash: Sha256Schema,
  externalResolutionHash: Sha256Schema,
  environmentCapsuleHash: Sha256Schema,
  launcherDefinitionHash: Sha256Schema,
  launcherModuleHash: Sha256Schema,
  launcherAbiHash: Sha256Schema,
  runnerDefinitionHash: Sha256Schema,
  runnerModuleHash: Sha256Schema,
  runnerAbiHash: Sha256Schema,
  receiptSchemaHash: Sha256Schema,
  toolchainHash: Sha256Schema,
}).strict();

const ExecutableInvocationTransportBindingIdentityV2Schema = z.object({
  schema: z.literal(EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA),
  bindingVersion: z.literal(EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION),
  bindingState: z.literal("candidate_unverified"),
  productionUse: z.literal("forbidden"),
  invocationTransport: InvocationInputTransportV2Schema,
  transportAuthority: InvocationTransportAuthorityProjectionV2Schema,
  verifiedReleaseProjection: VerifiedReleaseProjectionV2Schema,
}).strict();

export type ExecutableInvocationTransportBindingHashPayloadV2 = z.infer<
  typeof ExecutableInvocationTransportBindingIdentityV2Schema
>;

export function hashExecutableInvocationTransportBindingV2(
  value:
    | ExecutableInvocationTransportBindingHashPayloadV2
    | ExecutableInvocationTransportBindingCandidateV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.bindingHash;
  return hashCanonicalJson({
    schema: BINDING_HASH_DOMAIN_V2,
    binding: payload,
  });
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

const ExecutableInvocationTransportBindingCandidateV2BaseSchema =
  ExecutableInvocationTransportBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const transport = value.invocationTransport;
    const authority = value.transportAuthority;
    const scalarJoins: readonly Readonly<{
      path: readonly (string | number)[];
      actual: string;
      expected: string;
    }>[] = [
      {
        path: ["transportAuthority", "transportSchema"],
        actual: authority.transportSchema,
        expected: transport.schema,
      },
      {
        path: ["transportAuthority", "transportKind"],
        actual: authority.transportKind,
        expected: transport.kind,
      },
      {
        path: ["transportAuthority", "transportContractHash"],
        actual: authority.transportContractHash,
        expected: transport.contractHash,
      },
      {
        path: ["transportAuthority", "actionInvocationIntentHash"],
        actual: authority.actionInvocationIntentHash,
        expected: transport.actionInvocationIntentHash,
      },
      {
        path: ["transportAuthority", "productSpecHash"],
        actual: authority.productSpecHash,
        expected: transport.productSpecHash,
      },
      {
        path: ["transportAuthority", "selectionHash"],
        actual: authority.selectionHash,
        expected: transport.deliverySelectionHash,
      },
      {
        path: ["transportAuthority", "launcherRef"],
        actual: authority.launcherRef,
        expected: transport.runtimeBinding.launcherRef,
      },
    ];
    for (const join of scalarJoins) {
      if (join.actual === join.expected) continue;
      context.addIssue({
        code: "custom",
        path: [...join.path],
        message: "Executable transport authority must exactly duplicate its nested transport",
      });
    }

    const structuredJoins: readonly Readonly<{
      path: readonly (string | number)[];
      actual: unknown;
      expected: unknown;
    }>[] = [
      {
        path: ["transportAuthority", "profileBinding"],
        actual: authority.profileBinding,
        expected: transport.profileBinding,
      },
      {
        path: ["transportAuthority", "stackTopologyBinding"],
        actual: authority.stackTopologyBinding,
        expected: transport.stackPackBinding,
      },
      {
        path: ["transportAuthority", "evidenceCapabilityPolicyBinding"],
        actual: authority.evidenceCapabilityPolicyBinding,
        expected: transport.evidenceCapabilityPolicyBinding,
      },
      {
        path: ["transportAuthority", "semanticSourceRuleBinding"],
        actual: authority.semanticSourceRuleBinding,
        expected: transport.semanticSourceRuleBinding,
      },
      {
        path: ["transportAuthority", "codecCatalogBinding"],
        actual: authority.codecCatalogBinding,
        expected: transport.codecCatalogBinding,
      },
    ];
    for (const join of structuredJoins) {
      if (sameCanonicalValue(join.actual, join.expected)) continue;
      context.addIssue({
        code: "custom",
        path: [...join.path],
        message: "Executable transport authority must exactly duplicate its nested transport",
      });
    }

    if (value.bindingHash !== hashExecutableInvocationTransportBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "bindingHash must bind the exact domain-separated candidate payload",
      });
    }
  });

const BoundedExecutableInvocationTransportBindingV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_MAX_CANONICAL_BYTES,
        ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: `Executable invocation transport binding must fit ${EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
    }
  });

export const ExecutableInvocationTransportBindingCandidateV2Schema =
  BoundedExecutableInvocationTransportBindingV2Schema.pipe(
    ExecutableInvocationTransportBindingCandidateV2BaseSchema,
  );

export type ExecutableInvocationTransportBindingCandidateV2 = z.infer<
  typeof ExecutableInvocationTransportBindingCandidateV2Schema
>;

function deepFreezeCandidateV2<T>(value: T): T {
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

export function parseExecutableInvocationTransportBindingCandidateV2(
  input: unknown,
): ExecutableInvocationTransportBindingCandidateV2 {
  const bytes = canonicalJsonBytesBounded(input, {
    maxBytes: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_MAX_CANONICAL_BYTES,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  const snapshot = JSON.parse(bytes.toString("utf8")) as unknown;
  return deepFreezeCandidateV2(
    ExecutableInvocationTransportBindingCandidateV2Schema.parse(snapshot),
  );
}
