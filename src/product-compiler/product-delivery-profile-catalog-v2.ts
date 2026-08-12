import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION,
  productEvidenceCapabilityPolicyHashV2,
} from "./product-evidence-capability-policy-v2.js";
import {
  STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1,
  SemanticSourceRuleSetReadinessV1Schema,
} from "./schemas/stack-semantic-source-rules-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import {
  getCodeOwnedStackSemanticSourceRuleSetV1,
} from "./stack-semantic-source-rules-catalog-v1.js";
import { getStackTopologyCatalogContract } from "./stack-topology-catalog.js";

export const PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION = "2.0.0";
export const PRODUCT_DELIVERY_PROFILE_V2_SCHEMA = "setfarm.product-delivery-profile.v2";
export const PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA =
  "setfarm.product-delivery-profile-catalog.v2";
export const PRODUCT_DELIVERY_SELECTION_V2_SCHEMA =
  "setfarm.product-delivery-selection.v2";

export const PRODUCT_DELIVERY_PROFILE_IDS_V2 = Object.freeze([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
] as const);

const PROFILE_HASH_DOMAIN_V2 = "setfarm.product-delivery-profile-hash.v2";
const CATALOG_HASH_DOMAIN_V2 = "setfarm.product-delivery-profile-catalog-hash.v2";
const SELECTION_HASH_DOMAIN_V2 = "setfarm.product-delivery-selection-hash.v2";
const RESOLUTION_INPUT_MAX_BYTES = 4 * 1024 * 1024;
const VERIFICATION_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const ProfileIdV2Schema = z.enum(PRODUCT_DELIVERY_PROFILE_IDS_V2);
const ProfileProductClassV2Schema = z.enum(["developer_tool", "service"]);
const ProfileStackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);
const ProfilePlatformV2Schema = z.enum(["cli", "api"]);
const ProfileTechStackV2Schema = z.enum(["node-cli", "node-express"]);
const ProfilePersistenceKindV2Schema = z.enum(["memory", "none"]);

export const PRODUCT_DELIVERY_PROFILE_SHADOW_BLOCKER_CODES_V2 = Object.freeze([
  "PRODUCT_DELIVERY_V2_DELIVERY_COMPLETION_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_EVIDENCE_PLAN_DIFFERENTIAL_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_EVIDENCE_REGISTRY_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_INVOCATION_INPUT_TRANSPORT_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_NETWORK_RUNTIME_ACTIVATION_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_PREPARED_PACKET_PUBLICATION_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_RELEASE_MANIFEST_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_RUNTIME_EVIDENCE_COMPILER_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_SEMANTIC_SOURCE_ACTIVATION_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_STANDALONE_PRODUCT_COMPILER_UNVERIFIED",
] as const);

const ProfileShadowBlockerCodeV2Schema = z.enum(
  PRODUCT_DELIVERY_PROFILE_SHADOW_BLOCKER_CODES_V2,
);

const COMMON_PROFILE_BLOCKERS = Object.freeze([
  "PRODUCT_DELIVERY_V2_DELIVERY_COMPLETION_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_EVIDENCE_PLAN_DIFFERENTIAL_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_EVIDENCE_REGISTRY_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_INVOCATION_INPUT_TRANSPORT_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_PREPARED_PACKET_PUBLICATION_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_RELEASE_MANIFEST_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_RUNTIME_EVIDENCE_COMPILER_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_SEMANTIC_SOURCE_ACTIVATION_UNVERIFIED",
  "PRODUCT_DELIVERY_V2_STANDALONE_PRODUCT_COMPILER_UNVERIFIED",
] as const);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  if (new Set(values).size !== values.length) return false;
  return values.every((value, index) =>
    index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function deepFreezeJson<T>(value: T): T {
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

function boundedJsonSnapshot(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function hashProfilePayloadV2(value: unknown): string {
  return hashCanonicalJson({
    schema: PROFILE_HASH_DOMAIN_V2,
    profile: value,
  });
}

function hashCatalogPayloadV2(value: unknown): string {
  return hashCanonicalJson({
    schema: CATALOG_HASH_DOMAIN_V2,
    catalog: value,
  });
}

const ProfileDeliveryV2Schema = z.object({
  platform: ProfilePlatformV2Schema,
  techStack: ProfileTechStackV2Schema,
  designRequired: z.literal(false),
  allowedDatabases: z.tuple([z.literal("none")]),
  allowedPersistenceKinds: z.array(ProfilePersistenceKindV2Schema).min(1).max(2),
}).strict();

const ProfileStackPackBindingV2Schema = z.object({
  stackPackId: ProfileStackPackIdV2Schema,
  stackPackVersion: z.string().min(1).max(160),
  stackPackContentHash: Sha256Schema,
}).strict();

const ProfileDesignSourceV2Schema = z.object({
  kind: z.literal("none"),
  closureSchema: z.literal("setfarm.design-source-closure.v2"),
  closureReason: z.literal("product_delivery_design_not_required"),
}).strict();

const ProfileInterfaceScopesV2Schema = z.object({
  routeSemantics: z.enum(["cli_command_namespace", "http_route_namespace"]),
  surfaceSemantics: z.literal("non_rendered_interface_scope"),
}).strict();

const ProfileRuntimeV2Schema = z.object({
  invocationKind: z.enum(["cli_process", "http_service"]),
  invocationTransportSchema: z.literal("setfarm.invocation-input-transport.v2"),
  launcherOwner: z.literal("platform_release_manifest_v2"),
  launcherRef: z.enum(["LAUNCH_NODE_CLI_V2", "LAUNCH_NODE_EXPRESS_API_V2"]),
}).strict();

const ProfileEvidenceCapabilitiesV2Schema = z.object({
  policySchema: z.literal("setfarm.product-evidence-capability-policy.v2"),
  policyVersion: z.literal(PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION),
  policyHash: Sha256Schema,
}).strict();

const ProfileSemanticSourceRulesV2Schema = z.object({
  catalogVersion: z.literal(STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1),
  ruleSetRef: z.string().min(1).max(160),
  ruleSetVersion: z.string().min(1).max(160),
  ruleSetHash: Sha256Schema,
  readiness: SemanticSourceRuleSetReadinessV1Schema,
}).strict();

const ProfileReadinessV2Schema = z.object({
  status: z.literal("shadow"),
  productionSelection: z.literal("forbidden"),
  blockerCodes: z.array(ProfileShadowBlockerCodeV2Schema).min(1).max(16),
}).strict().superRefine((value, context) => {
  if (!canonicalStrings(value.blockerCodes)) {
    context.addIssue({
      code: "custom",
      path: ["blockerCodes"],
      message: "Product-delivery shadow blockers must be unique and canonically sorted",
    });
  }
});

type ProfileDefinitionV2 = Readonly<{
  id: z.infer<typeof ProfileIdV2Schema>;
  productClass: z.infer<typeof ProfileProductClassV2Schema>;
  stackPackId: z.infer<typeof ProfileStackPackIdV2Schema>;
  platform: z.infer<typeof ProfilePlatformV2Schema>;
  techStack: z.infer<typeof ProfileTechStackV2Schema>;
  allowedPersistenceKinds: readonly z.infer<typeof ProfilePersistenceKindV2Schema>[];
  routeSemantics: z.infer<typeof ProfileInterfaceScopesV2Schema>["routeSemantics"];
  invocationKind: z.infer<typeof ProfileRuntimeV2Schema>["invocationKind"];
  launcherRef: z.infer<typeof ProfileRuntimeV2Schema>["launcherRef"];
  ruleSetRef: string;
  apiNetworkBlocker: boolean;
}>;

const PROFILE_DEFINITIONS_V2: readonly ProfileDefinitionV2[] = Object.freeze([
  Object.freeze({
    id: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    productClass: "developer_tool",
    stackPackId: "node-cli",
    platform: "cli",
    techStack: "node-cli",
    allowedPersistenceKinds: Object.freeze(["none"] as const),
    routeSemantics: "cli_command_namespace",
    invocationKind: "cli_process",
    launcherRef: "LAUNCH_NODE_CLI_V2",
    ruleSetRef: "RULESET_NODE_CLI_V1",
    apiNetworkBlocker: false,
  }),
  Object.freeze({
    id: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
    productClass: "service",
    stackPackId: "node-express-api",
    platform: "api",
    techStack: "node-express",
    allowedPersistenceKinds: Object.freeze(["memory", "none"] as const),
    routeSemantics: "http_route_namespace",
    invocationKind: "http_service",
    launcherRef: "LAUNCH_NODE_EXPRESS_API_V2",
    ruleSetRef: "RULESET_NODE_EXPRESS_API_STATELESS_V1",
    apiNetworkBlocker: true,
  }),
]);

function definitionById(
  id: z.infer<typeof ProfileIdV2Schema>,
): ProfileDefinitionV2 {
  const definition = PROFILE_DEFINITIONS_V2.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`PRODUCT_DELIVERY_PROFILE_V2_DEFINITION_MISSING:${id}`);
  return definition;
}

function expectedProfileWithoutHashV2(definition: ProfileDefinitionV2) {
  const topology = getStackTopologyCatalogContract(definition.stackPackId);
  if (!topology) {
    throw new Error(`PRODUCT_DELIVERY_PROFILE_V2_TOPOLOGY_MISSING:${definition.stackPackId}`);
  }
  const ruleSet = getCodeOwnedStackSemanticSourceRuleSetV1(definition.stackPackId);
  if (!ruleSet || ruleSet.ruleSetRef !== definition.ruleSetRef) {
    throw new Error(`PRODUCT_DELIVERY_PROFILE_V2_RULE_SET_MISSING:${definition.ruleSetRef}`);
  }
  const blockerCodes = [
    ...COMMON_PROFILE_BLOCKERS,
    ...(definition.apiNetworkBlocker
      ? ["PRODUCT_DELIVERY_V2_NETWORK_RUNTIME_ACTIVATION_UNVERIFIED" as const]
      : []),
  ].sort(compareUtf16);
  return {
    schema: PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
    profileVersion: PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
    id: definition.id,
    productClass: definition.productClass,
    selectionPolicy: {
      kind: "explicit_stack_prefix_required" as const,
      requestedStackPackId: definition.stackPackId,
    },
    delivery: {
      platform: definition.platform,
      techStack: definition.techStack,
      designRequired: false as const,
      allowedDatabases: ["none"] as ["none"],
      allowedPersistenceKinds: [...definition.allowedPersistenceKinds],
    },
    stackPackBinding: {
      stackPackId: topology.identity.id as z.infer<typeof ProfileStackPackIdV2Schema>,
      stackPackVersion: topology.identity.version,
      stackPackContentHash: topology.identity.contentHash,
    },
    designSource: {
      kind: "none" as const,
      closureSchema: "setfarm.design-source-closure.v2" as const,
      closureReason: "product_delivery_design_not_required" as const,
    },
    interfaceScopes: {
      routeSemantics: definition.routeSemantics,
      surfaceSemantics: "non_rendered_interface_scope" as const,
    },
    runtime: {
      invocationKind: definition.invocationKind,
      invocationTransportSchema: "setfarm.invocation-input-transport.v2" as const,
      launcherOwner: "platform_release_manifest_v2" as const,
      launcherRef: definition.launcherRef,
    },
    evidenceCapabilities: {
      policySchema: "setfarm.product-evidence-capability-policy.v2" as const,
      policyVersion: PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION,
      policyHash: productEvidenceCapabilityPolicyHashV2(),
    },
    semanticSourceRules: {
      catalogVersion: STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1,
      ruleSetRef: ruleSet.ruleSetRef,
      ruleSetVersion: ruleSet.ruleSetVersion,
      ruleSetHash: ruleSet.ruleSetHash,
      readiness: ruleSet.readiness,
    },
    readiness: {
      status: "shadow" as const,
      productionSelection: "forbidden" as const,
      blockerCodes,
    },
  };
}

export const ProductDeliveryProfileV2Schema = z.object({
  schema: z.literal(PRODUCT_DELIVERY_PROFILE_V2_SCHEMA),
  profileVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION),
  id: ProfileIdV2Schema,
  productClass: ProfileProductClassV2Schema,
  selectionPolicy: z.object({
    kind: z.literal("explicit_stack_prefix_required"),
    requestedStackPackId: ProfileStackPackIdV2Schema,
  }).strict(),
  delivery: ProfileDeliveryV2Schema,
  stackPackBinding: ProfileStackPackBindingV2Schema,
  designSource: ProfileDesignSourceV2Schema,
  interfaceScopes: ProfileInterfaceScopesV2Schema,
  runtime: ProfileRuntimeV2Schema,
  evidenceCapabilities: ProfileEvidenceCapabilitiesV2Schema,
  semanticSourceRules: ProfileSemanticSourceRulesV2Schema,
  readiness: ProfileReadinessV2Schema,
  profileHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expected = expectedProfileWithoutHashV2(definitionById(value.id));
  const { profileHash, ...actualWithoutHash } = value;
  if (canonicalJsonStringify(actualWithoutHash) !== canonicalJsonStringify(expected)) {
    context.addIssue({
      code: "custom",
      path: [],
      message: "Product-delivery profile does not equal its code-owned exact authority",
    });
  }
  if (profileHash !== hashProfilePayloadV2(actualWithoutHash)) {
    context.addIssue({
      code: "custom",
      path: ["profileHash"],
      message: "Profile hash must bind the exact domain-separated profile payload",
    });
  }
});

export type ProductDeliveryProfileV2 = z.infer<typeof ProductDeliveryProfileV2Schema>;

export function hashProductDeliveryProfileV2(value: ProductDeliveryProfileV2): string {
  const { profileHash: _profileHash, ...withoutHash } = value;
  return hashProfilePayloadV2(withoutHash);
}

export const ProductDeliveryProfileCatalogV2Schema = z.object({
  schema: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA),
  catalogVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION),
  profiles: z.array(ProductDeliveryProfileV2Schema).length(2),
  catalogHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const profileIds = value.profiles.map((profile) => profile.id);
  if (canonicalJsonStringify(profileIds) !== canonicalJsonStringify(PRODUCT_DELIVERY_PROFILE_IDS_V2)) {
    context.addIssue({
      code: "custom",
      path: ["profiles"],
      message: "ProfileV2 catalog must contain the exact two code-owned profiles in canonical order",
    });
  }
  const { catalogHash, ...withoutHash } = value;
  if (catalogHash !== hashCatalogPayloadV2(withoutHash)) {
    context.addIssue({
      code: "custom",
      path: ["catalogHash"],
      message: "Catalog hash must bind the exact domain-separated ProfileV2 catalog payload",
    });
  }
});

export type ProductDeliveryProfileCatalogV2 = z.infer<
  typeof ProductDeliveryProfileCatalogV2Schema
>;

export function hashProductDeliveryProfileCatalogV2(
  value: ProductDeliveryProfileCatalogV2,
): string {
  const { catalogHash: _catalogHash, ...withoutHash } = value;
  return hashCatalogPayloadV2(withoutHash);
}

export const ProductDeliverySelectionV2Schema = z.object({
  schema: z.literal(PRODUCT_DELIVERY_SELECTION_V2_SCHEMA),
  catalogVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION),
  catalogHash: Sha256Schema,
  productSpecHash: Sha256Schema,
  profileId: ProfileIdV2Schema,
  profileHash: Sha256Schema,
  productClass: ProfileProductClassV2Schema,
  selectionBasis: z.literal("explicit_stack_prefix"),
  requestedStackPackId: ProfileStackPackIdV2Schema,
  delivery: ProfileDeliveryV2Schema,
  stackPackBinding: ProfileStackPackBindingV2Schema,
  designSource: ProfileDesignSourceV2Schema,
  interfaceScopes: ProfileInterfaceScopesV2Schema,
  runtime: ProfileRuntimeV2Schema,
  evidenceCapabilities: ProfileEvidenceCapabilitiesV2Schema,
  semanticSourceRules: ProfileSemanticSourceRulesV2Schema,
  readiness: ProfileReadinessV2Schema,
}).strict().superRefine((value, context) => {
  const profile = PRODUCT_DELIVERY_PROFILE_CATALOG_V2.profiles.find((candidate) =>
    candidate.id === value.profileId);
  if (!profile) {
    context.addIssue({
      code: "custom",
      path: ["profileId"],
      message: "Selection references no code-owned ProfileV2",
    });
    return;
  }
  const expected = selectionFromProfileV2(value.productSpecHash, profile);
  if (canonicalJsonStringify(value) !== canonicalJsonStringify(expected)) {
    context.addIssue({
      code: "custom",
      path: [],
      message: "Selection does not equal the exact code-owned profile projection",
    });
  }
});

export type ProductDeliverySelectionV2 = z.infer<typeof ProductDeliverySelectionV2Schema>;

export function hashProductDeliverySelectionV2(value: ProductDeliverySelectionV2): string {
  return hashCanonicalJson({
    schema: SELECTION_HASH_DOMAIN_V2,
    selection: value,
  });
}

export type ProductDeliverySelectionDiagnosticV2 = Readonly<{
  code:
    | "PRODUCT_DELIVERY_V2_INPUT_INVALID"
    | "PRODUCT_DELIVERY_V2_PRODUCT_SPEC_INVALID"
    | "PRODUCT_DELIVERY_V2_PROFILE_UNSUPPORTED"
    | "PRODUCT_DELIVERY_V2_EXPLICIT_STACK_UNSUPPORTED"
    | "PRODUCT_DELIVERY_V2_PRODUCT_SEMANTICS_MISMATCH";
  path: string;
  message: string;
}>;

export type ProductDeliverySelectionResultV2 =
  | Readonly<{
      status: "shadow_selected";
      diagnostics: readonly [];
      selection: Readonly<ProductDeliverySelectionV2>;
      selectionHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductDeliverySelectionDiagnosticV2[];
    }>;

const SelectionInputV2Schema = z.object({
  productSpec: z.unknown(),
  requestedStackPackId: z.string().min(1).max(160),
}).strict();

const SelectionVerificationInputV2Schema = z.object({
  productSpec: z.unknown(),
  requestedStackPackId: z.string().min(1).max(160),
  candidate: z.unknown(),
}).strict();

function profileFromDefinitionV2(definition: ProfileDefinitionV2): ProductDeliveryProfileV2 {
  const withoutHash = expectedProfileWithoutHashV2(definition);
  return ProductDeliveryProfileV2Schema.parse({
    ...withoutHash,
    profileHash: hashProfilePayloadV2(withoutHash),
  });
}

const CATALOG_WITHOUT_HASH_V2 = {
  schema: PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
  catalogVersion: PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
  profiles: PROFILE_DEFINITIONS_V2.map(profileFromDefinitionV2)
    .sort((left, right) => compareUtf16(left.id, right.id)),
};

const PRODUCT_DELIVERY_PROFILE_CATALOG_V2 = deepFreezeJson(
  ProductDeliveryProfileCatalogV2Schema.parse({
    ...CATALOG_WITHOUT_HASH_V2,
    catalogHash: hashCatalogPayloadV2(CATALOG_WITHOUT_HASH_V2),
  }),
);

function selectionFromProfileV2(
  productSpecHash: string,
  profile: ProductDeliveryProfileV2,
) {
  return {
    schema: PRODUCT_DELIVERY_SELECTION_V2_SCHEMA,
    catalogVersion: PRODUCT_DELIVERY_PROFILE_CATALOG_V2.catalogVersion,
    catalogHash: PRODUCT_DELIVERY_PROFILE_CATALOG_V2.catalogHash,
    productSpecHash,
    profileId: profile.id,
    profileHash: profile.profileHash,
    productClass: profile.productClass,
    selectionBasis: "explicit_stack_prefix" as const,
    requestedStackPackId: profile.selectionPolicy.requestedStackPackId,
    delivery: profile.delivery,
    stackPackBinding: profile.stackPackBinding,
    designSource: profile.designSource,
    interfaceScopes: profile.interfaceScopes,
    runtime: profile.runtime,
    evidenceCapabilities: profile.evidenceCapabilities,
    semanticSourceRules: profile.semanticSourceRules,
    readiness: profile.readiness,
  };
}

function diagnostic(
  code: ProductDeliverySelectionDiagnosticV2["code"],
  path: string,
  message: string,
): ProductDeliverySelectionDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 500),
    message: message.slice(0, 1_000),
  });
}

function diagnosticsFromZod(
  code: ProductDeliverySelectionDiagnosticV2["code"],
  error: z.ZodError,
): readonly ProductDeliverySelectionDiagnosticV2[] {
  const retained = error.issues.slice(0, MAX_DIAGNOSTICS - 1).map((issue) => diagnostic(
    code,
    issue.path.length > 0 ? `/${issue.path.join("/")}` : "/",
    issue.message,
  ));
  if (error.issues.length >= MAX_DIAGNOSTICS) {
    retained.push(diagnostic(
      code,
      "/",
      `Validation produced ${error.issues.length} issues; retained the first ${MAX_DIAGNOSTICS - 1}`,
    ));
  }
  return Object.freeze(retained);
}

function singleRejected(
  code: ProductDeliverySelectionDiagnosticV2["code"],
  path: string,
  message: string,
): ProductDeliverySelectionResultV2 {
  return deepFreezeJson({
    status: "rejected" as const,
    diagnostics: [diagnostic(code, path, message)],
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid bounded canonical JSON input";
}

function semanticMismatch(
  productSpec: ProductSpecV2,
  profile: ProductDeliveryProfileV2,
): ProductDeliverySelectionDiagnosticV2 | null {
  if (productSpec.delivery.platform !== profile.delivery.platform) {
    return diagnostic(
      "PRODUCT_DELIVERY_V2_PRODUCT_SEMANTICS_MISMATCH",
      "/productSpec/delivery/platform",
      `ProductSpec platform must be ${profile.delivery.platform} for ${profile.id}`,
    );
  }
  if (productSpec.delivery.techStack !== profile.delivery.techStack) {
    return diagnostic(
      "PRODUCT_DELIVERY_V2_PRODUCT_SEMANTICS_MISMATCH",
      "/productSpec/delivery/techStack",
      `ProductSpec tech stack must be ${profile.delivery.techStack} for ${profile.id}`,
    );
  }
  if (productSpec.delivery.designRequired !== profile.delivery.designRequired) {
    return diagnostic(
      "PRODUCT_DELIVERY_V2_PRODUCT_SEMANTICS_MISMATCH",
      "/productSpec/delivery/designRequired",
      "CLI/API ProfileV2 selection requires designRequired=false",
    );
  }
  if (productSpec.delivery.database !== "none") {
    return diagnostic(
      "PRODUCT_DELIVERY_V2_PRODUCT_SEMANTICS_MISMATCH",
      "/productSpec/delivery/database",
      `${profile.id} supports delivery database none only`,
    );
  }
  const persistenceKinds = productSpec.persistencePolicies.length === 0
    ? ["none"]
    : [...new Set(productSpec.persistencePolicies.map((policy) => policy.kind))].sort(compareUtf16);
  const unsupportedPersistence = persistenceKinds.find((kind) =>
    !profile.delivery.allowedPersistenceKinds.includes(
      kind as z.infer<typeof ProfilePersistenceKindV2Schema>,
    ));
  if (unsupportedPersistence) {
    return diagnostic(
      "PRODUCT_DELIVERY_V2_PRODUCT_SEMANTICS_MISMATCH",
      "/productSpec/persistencePolicies",
      `${profile.id} does not support persistence kind ${unsupportedPersistence}`,
    );
  }
  return null;
}

export function getProductDeliveryProfileCatalogV2(): ProductDeliveryProfileCatalogV2 {
  return deepFreezeJson(structuredClone(PRODUCT_DELIVERY_PROFILE_CATALOG_V2));
}

export function productDeliveryProfileCatalogHashV2(): string {
  return PRODUCT_DELIVERY_PROFILE_CATALOG_V2.catalogHash;
}

export function canonicalProductDeliveryProfileCatalogV2(): string {
  return canonicalJsonStringify(PRODUCT_DELIVERY_PROFILE_CATALOG_V2);
}

export function resolveProductDeliverySelectionV2(
  input: unknown,
): ProductDeliverySelectionResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, RESOLUTION_INPUT_MAX_BYTES);
  } catch (error) {
    return singleRejected(
      "PRODUCT_DELIVERY_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const outer = SelectionInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return deepFreezeJson({
      status: "rejected" as const,
      diagnostics: diagnosticsFromZod("PRODUCT_DELIVERY_V2_INPUT_INVALID", outer.error),
    });
  }
  const productSpecResult = ProductSpecV2Schema.safeParse(outer.data.productSpec);
  if (!productSpecResult.success) {
    return deepFreezeJson({
      status: "rejected" as const,
      diagnostics: diagnosticsFromZod(
        "PRODUCT_DELIVERY_V2_PRODUCT_SPEC_INVALID",
        productSpecResult.error,
      ),
    });
  }
  const productSpec = productSpecResult.data;
  const classProfiles = PRODUCT_DELIVERY_PROFILE_CATALOG_V2.profiles.filter((profile) =>
    profile.productClass === productSpec.product.class);
  if (classProfiles.length === 0) {
    return singleRejected(
      "PRODUCT_DELIVERY_V2_PROFILE_UNSUPPORTED",
      "/productSpec/product/class",
      `No ProfileV2 shadow authority exists for ProductSpec class ${productSpec.product.class}`,
    );
  }
  const exactProfiles = classProfiles.filter((profile) =>
    profile.selectionPolicy.requestedStackPackId === outer.data.requestedStackPackId);
  if (exactProfiles.length !== 1) {
    return singleRejected(
      "PRODUCT_DELIVERY_V2_EXPLICIT_STACK_UNSUPPORTED",
      "/requestedStackPackId",
      exactProfiles.length === 0
        ? `Explicit stack ${outer.data.requestedStackPackId} has no exact ProfileV2 authority for ${productSpec.product.class}`
        : `Explicit stack ${outer.data.requestedStackPackId} resolved to ${exactProfiles.length} ProfileV2 authorities; exactly one is required`,
    );
  }
  const exactProfile = exactProfiles[0]!;
  const mismatch = semanticMismatch(productSpec, exactProfile);
  if (mismatch) {
    return deepFreezeJson({
      status: "rejected" as const,
      diagnostics: [mismatch],
    });
  }
  const selection = ProductDeliverySelectionV2Schema.parse(selectionFromProfileV2(
    hashCanonicalJson(productSpec),
    exactProfile,
  ));
  const frozenSelection = deepFreezeJson(selection);
  return deepFreezeJson({
    status: "shadow_selected" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    selection: frozenSelection,
    selectionHash: hashProductDeliverySelectionV2(frozenSelection),
    canonicalBytes: canonicalJsonStringify(frozenSelection),
  });
}

export class ProductDeliverySelectionVerificationErrorV2 extends Error {
  readonly code:
    | "PRODUCT_DELIVERY_V2_VERIFICATION_INPUT_INVALID"
    | "PRODUCT_DELIVERY_V2_SELECTION_INVALID"
    | "PRODUCT_DELIVERY_V2_SELECTION_AUTHORITY_MISMATCH";

  constructor(code: ProductDeliverySelectionVerificationErrorV2["code"], message: string) {
    super(message);
    this.name = "ProductDeliverySelectionVerificationErrorV2";
    this.code = code;
  }
}

export function verifyProductDeliverySelectionV2(input: unknown): ProductDeliverySelectionV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, VERIFICATION_INPUT_MAX_BYTES);
  } catch (error) {
    throw new ProductDeliverySelectionVerificationErrorV2(
      "PRODUCT_DELIVERY_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = SelectionVerificationInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new ProductDeliverySelectionVerificationErrorV2(
      "PRODUCT_DELIVERY_V2_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Selection verification input is invalid",
    );
  }
  const candidate = ProductDeliverySelectionV2Schema.safeParse(outer.data.candidate);
  if (!candidate.success) {
    throw new ProductDeliverySelectionVerificationErrorV2(
      "PRODUCT_DELIVERY_V2_SELECTION_INVALID",
      candidate.error.issues[0]?.message ?? "Selection candidate is invalid",
    );
  }
  const reproduced = resolveProductDeliverySelectionV2({
    productSpec: outer.data.productSpec,
    requestedStackPackId: outer.data.requestedStackPackId,
  });
  if (
    reproduced.status !== "shadow_selected"
    || canonicalJsonStringify(reproduced.selection) !== canonicalJsonStringify(candidate.data)
  ) {
    throw new ProductDeliverySelectionVerificationErrorV2(
      "PRODUCT_DELIVERY_V2_SELECTION_AUTHORITY_MISMATCH",
      "Selection candidate does not equal fresh ProductSpec/profile/topology/policy/rule-set authority",
    );
  }
  return reproduced.selection;
}
