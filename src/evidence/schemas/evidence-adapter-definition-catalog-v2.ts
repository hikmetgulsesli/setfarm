import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
  PRODUCT_DELIVERY_PROFILE_IDS_V2,
  PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
  getProductDeliveryProfileCatalogV2,
} from "../../product-compiler/product-delivery-profile-catalog-v2.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
  INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2,
  INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2,
  getInvocationTransportCodecCatalogV2,
  invocationTransportCodecCatalogHashV2,
} from "../../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  EVIDENCE_RECEIPT_ABI_POLICY_V2_SCHEMA,
  EVIDENCE_RECEIPT_V2_SCHEMA,
  evidenceReceiptAbiPolicyHashV2,
  getEvidenceReceiptAbiPolicyV2,
} from "./evidence-receipt-v2.js";

export const EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA =
  "setfarm.evidence-adapter-definition-catalog.v2" as const;
export const EVIDENCE_ADAPTER_REQUIREMENT_DEFINITION_V2_SCHEMA =
  "setfarm.evidence-adapter-requirement-definition.v2" as const;
export const EMPTY_OPERATIONAL_EVIDENCE_ADAPTER_CATALOG_V2_SCHEMA =
  "setfarm.empty-operational-evidence-adapter-catalog.v2" as const;
export const EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_VERSION = "2.0.0" as const;

export const EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2 = Object.freeze([
  "EVIDENCE_ADAPTER_V2_IMPLEMENTATIONS_MISSING",
  "EVIDENCE_ADAPTER_V2_OPERATIONAL_REGISTRY_UNMATERIALIZED",
  "EVIDENCE_ADAPTER_V2_VERIFIED_RELEASE_BINDING_MISSING",
] as const);

const ADAPTER_REQUIREMENT_HASH_DOMAIN_V2 =
  "setfarm.evidence-adapter-requirement-definition-hash.v2";
const EMPTY_OPERATIONAL_ADAPTER_CATALOG_HASH_DOMAIN_V2 =
  "setfarm.empty-operational-evidence-adapter-catalog-hash.v2";
const ADAPTER_DEFINITION_CATALOG_HASH_DOMAIN_V2 =
  "setfarm.evidence-adapter-definition-catalog-hash.v2";

const ProfileRequirementV2Schema = z.object({
  catalogSchema: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA),
  profileSchema: z.literal(PRODUCT_DELIVERY_PROFILE_V2_SCHEMA),
  catalogVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION),
  catalogHash: Sha256Schema,
  profileId: z.enum(PRODUCT_DELIVERY_PROFILE_IDS_V2),
  profileHash: Sha256Schema,
  launcherRef: z.enum(["LAUNCH_NODE_CLI_V2", "LAUNCH_NODE_EXPRESS_API_V2"]),
}).strict();

const ReceiptSchemaBindingV2Schema = z.object({
  policySchema: z.literal(EVIDENCE_RECEIPT_ABI_POLICY_V2_SCHEMA),
  policyVersion: z.literal("2.0.0"),
  receiptSchema: z.literal(EVIDENCE_RECEIPT_V2_SCHEMA),
  policyHash: Sha256Schema,
}).strict();

const InvocationCodecCatalogBindingV2Schema = z.object({
  schema: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2),
  catalogVersion: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2),
  catalogHash: Sha256Schema,
}).strict();

const EvidenceCheckRequirementV2Schema = z.discriminatedUnion("predicateKind", [
  z.object({
    predicateKind: z.literal("action_invocation"),
    checkRef: z.literal("CHECK_ACTION_INVOCATION"),
    selectorRequirement: z.literal("action_subject"),
  }).strict(),
  z.object({
    predicateKind: z.literal("observable_outcome"),
    checkRef: z.literal("CHECK_OBSERVABLE_OUTCOME"),
    selectorRequirement: z.literal("invocation_output"),
  }).strict(),
]);

const InvocationTransportRequirementV2Schema = z.object({
  transportSchema: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
  transportKind: z.enum(["cli_command", "http_request"]),
  codecCatalogHash: Sha256Schema,
  receiptAbiPolicyHash: Sha256Schema,
}).strict();

const EvidenceAdapterRequirementDefinitionIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_ADAPTER_REQUIREMENT_DEFINITION_V2_SCHEMA),
  definitionRef: z.enum([
    "ADAPTER_REQUIREMENT_NODE_CLI_ACTION_INVOCATION_V2",
    "ADAPTER_REQUIREMENT_NODE_CLI_INVOCATION_OUTPUT_V2",
    "ADAPTER_REQUIREMENT_NODE_EXPRESS_API_ACTION_INVOCATION_V2",
    "ADAPTER_REQUIREMENT_NODE_EXPRESS_API_INVOCATION_OUTPUT_V2",
  ]),
  profileRequirement: ProfileRequirementV2Schema,
  invocationKind: z.enum(["cli_process", "http_service"]),
  checkRequirement: EvidenceCheckRequirementV2Schema,
  transportRequirement: InvocationTransportRequirementV2Schema,
}).strict();

export type EvidenceAdapterRequirementDefinitionHashPayloadV2 = z.infer<
  typeof EvidenceAdapterRequirementDefinitionIdentityV2Schema
>;

export function hashEvidenceAdapterRequirementDefinitionV2(
  value:
    | EvidenceAdapterRequirementDefinitionHashPayloadV2
    | EvidenceAdapterRequirementDefinitionV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.definitionHash;
  return hashCanonicalJson({
    schema: ADAPTER_REQUIREMENT_HASH_DOMAIN_V2,
    requirement: payload,
  });
}

export const EvidenceAdapterRequirementDefinitionV2Schema =
  EvidenceAdapterRequirementDefinitionIdentityV2Schema.extend({
    definitionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.definitionHash !== hashEvidenceAdapterRequirementDefinitionV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["definitionHash"],
        message: "Evidence adapter requirement definition hash mismatch",
      });
    }
  });

export type EvidenceAdapterRequirementDefinitionV2 = z.infer<
  typeof EvidenceAdapterRequirementDefinitionV2Schema
>;

const EmptyOperationalEvidenceAdapterCatalogIdentityV2Schema = z.object({
  schema: z.literal(EMPTY_OPERATIONAL_EVIDENCE_ADAPTER_CATALOG_V2_SCHEMA),
  entries: z.tuple([]),
}).strict();

export type EmptyOperationalEvidenceAdapterCatalogHashPayloadV2 = z.infer<
  typeof EmptyOperationalEvidenceAdapterCatalogIdentityV2Schema
>;

export function hashEmptyOperationalEvidenceAdapterCatalogV2(
  value:
    | EmptyOperationalEvidenceAdapterCatalogHashPayloadV2
    | EmptyOperationalEvidenceAdapterCatalogV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: EMPTY_OPERATIONAL_ADAPTER_CATALOG_HASH_DOMAIN_V2,
    catalog: payload,
  });
}

export const EmptyOperationalEvidenceAdapterCatalogV2Schema =
  EmptyOperationalEvidenceAdapterCatalogIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.catalogHash !== hashEmptyOperationalEvidenceAdapterCatalogV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "Empty operational adapter catalog hash mismatch",
      });
    }
  });

export type EmptyOperationalEvidenceAdapterCatalogV2 = z.infer<
  typeof EmptyOperationalEvidenceAdapterCatalogV2Schema
>;

const EvidenceAdapterDefinitionCatalogIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA),
  version: z.literal(EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_VERSION),
  readiness: z.literal("shadow_blocked"),
  productionUse: z.literal("forbidden"),
  blockerCodes: z.tuple([
    z.literal(EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2[0]),
    z.literal(EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2[1]),
    z.literal(EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2[2]),
  ]),
  receiptSchemaBinding: ReceiptSchemaBindingV2Schema,
  invocationCodecCatalogBinding: InvocationCodecCatalogBindingV2Schema,
  definitions: z.array(EvidenceAdapterRequirementDefinitionV2Schema).length(4),
  operationalCatalog: EmptyOperationalEvidenceAdapterCatalogV2Schema,
}).strict();

export type EvidenceAdapterDefinitionCatalogHashPayloadV2 = z.infer<
  typeof EvidenceAdapterDefinitionCatalogIdentityV2Schema
>;

export function hashEvidenceAdapterDefinitionCatalogV2(
  value:
    | EvidenceAdapterDefinitionCatalogHashPayloadV2
    | EvidenceAdapterDefinitionCatalogV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: ADAPTER_DEFINITION_CATALOG_HASH_DOMAIN_V2,
    catalog: payload,
  });
}

function profileRequirementV2(
  profileId: (typeof PRODUCT_DELIVERY_PROFILE_IDS_V2)[number],
): z.infer<typeof ProfileRequirementV2Schema> {
  const catalog = getProductDeliveryProfileCatalogV2();
  const profile = catalog.profiles.find((candidate) => candidate.id === profileId)!;
  return {
    catalogSchema: catalog.schema,
    profileSchema: PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
    catalogVersion: catalog.catalogVersion,
    catalogHash: catalog.catalogHash,
    profileId: profile.id,
    profileHash: profile.profileHash,
    launcherRef: profile.runtime.launcherRef,
  };
}

function receiptSchemaBindingV2() {
  const policy = getEvidenceReceiptAbiPolicyV2();
  return {
    policySchema: policy.schema,
    policyVersion: policy.version,
    receiptSchema: policy.receiptSchema,
    policyHash: evidenceReceiptAbiPolicyHashV2(),
  };
}

function codecCatalogBindingV2() {
  const catalog = getInvocationTransportCodecCatalogV2();
  return {
    schema: catalog.schema,
    catalogVersion: catalog.catalogVersion,
    catalogHash: invocationTransportCodecCatalogHashV2(),
  };
}

function adapterDefinitionIdentitiesV2(): EvidenceAdapterRequirementDefinitionHashPayloadV2[] {
  const codecCatalogHash = invocationTransportCodecCatalogHashV2();
  const receiptAbiPolicyHash = evidenceReceiptAbiPolicyHashV2();
  const cliProfile = profileRequirementV2(PRODUCT_DELIVERY_PROFILE_IDS_V2[0]);
  const apiProfile = profileRequirementV2(PRODUCT_DELIVERY_PROFILE_IDS_V2[1]);
  return [
    {
      schema: EVIDENCE_ADAPTER_REQUIREMENT_DEFINITION_V2_SCHEMA,
      definitionRef: "ADAPTER_REQUIREMENT_NODE_CLI_ACTION_INVOCATION_V2",
      profileRequirement: cliProfile,
      invocationKind: "cli_process",
      checkRequirement: {
        predicateKind: "action_invocation",
        checkRef: "CHECK_ACTION_INVOCATION",
        selectorRequirement: "action_subject",
      },
      transportRequirement: {
        transportSchema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
        transportKind: "cli_command",
        codecCatalogHash,
        receiptAbiPolicyHash,
      },
    },
    {
      schema: EVIDENCE_ADAPTER_REQUIREMENT_DEFINITION_V2_SCHEMA,
      definitionRef: "ADAPTER_REQUIREMENT_NODE_CLI_INVOCATION_OUTPUT_V2",
      profileRequirement: cliProfile,
      invocationKind: "cli_process",
      checkRequirement: {
        predicateKind: "observable_outcome",
        checkRef: "CHECK_OBSERVABLE_OUTCOME",
        selectorRequirement: "invocation_output",
      },
      transportRequirement: {
        transportSchema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
        transportKind: "cli_command",
        codecCatalogHash,
        receiptAbiPolicyHash,
      },
    },
    {
      schema: EVIDENCE_ADAPTER_REQUIREMENT_DEFINITION_V2_SCHEMA,
      definitionRef: "ADAPTER_REQUIREMENT_NODE_EXPRESS_API_ACTION_INVOCATION_V2",
      profileRequirement: apiProfile,
      invocationKind: "http_service",
      checkRequirement: {
        predicateKind: "action_invocation",
        checkRef: "CHECK_ACTION_INVOCATION",
        selectorRequirement: "action_subject",
      },
      transportRequirement: {
        transportSchema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
        transportKind: "http_request",
        codecCatalogHash,
        receiptAbiPolicyHash,
      },
    },
    {
      schema: EVIDENCE_ADAPTER_REQUIREMENT_DEFINITION_V2_SCHEMA,
      definitionRef: "ADAPTER_REQUIREMENT_NODE_EXPRESS_API_INVOCATION_OUTPUT_V2",
      profileRequirement: apiProfile,
      invocationKind: "http_service",
      checkRequirement: {
        predicateKind: "observable_outcome",
        checkRef: "CHECK_OBSERVABLE_OUTCOME",
        selectorRequirement: "invocation_output",
      },
      transportRequirement: {
        transportSchema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
        transportKind: "http_request",
        codecCatalogHash,
        receiptAbiPolicyHash,
      },
    },
  ];
}

function codeOwnedDefinitionsV2(): EvidenceAdapterRequirementDefinitionV2[] {
  return adapterDefinitionIdentitiesV2().map((identity) => ({
    ...identity,
    definitionHash: hashEvidenceAdapterRequirementDefinitionV2(identity),
  }));
}

function codeOwnedOperationalCatalogV2(): EmptyOperationalEvidenceAdapterCatalogV2 {
  const identity: EmptyOperationalEvidenceAdapterCatalogHashPayloadV2 = {
    schema: EMPTY_OPERATIONAL_EVIDENCE_ADAPTER_CATALOG_V2_SCHEMA,
    entries: [],
  };
  return {
    ...identity,
    catalogHash: hashEmptyOperationalEvidenceAdapterCatalogV2(identity),
  };
}

function codeOwnedCatalogV2(): EvidenceAdapterDefinitionCatalogV2 {
  const identity: EvidenceAdapterDefinitionCatalogHashPayloadV2 = {
    schema: EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA,
    version: EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_VERSION,
    readiness: "shadow_blocked",
    productionUse: "forbidden",
    blockerCodes: [...EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2],
    receiptSchemaBinding: receiptSchemaBindingV2(),
    invocationCodecCatalogBinding: codecCatalogBindingV2(),
    definitions: codeOwnedDefinitionsV2(),
    operationalCatalog: codeOwnedOperationalCatalogV2(),
  };
  return {
    ...identity,
    catalogHash: hashEvidenceAdapterDefinitionCatalogV2(identity),
  };
}

export const EvidenceAdapterDefinitionCatalogV2Schema =
  EvidenceAdapterDefinitionCatalogIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.catalogHash !== hashEvidenceAdapterDefinitionCatalogV2(value)
      || canonicalJsonStringify(value) !== canonicalJsonStringify(codeOwnedCatalogV2())
    ) {
      context.addIssue({
        code: "custom",
        message: "Evidence adapter definition catalog must equal exact zero-input code authority",
      });
    }
  });

export type EvidenceAdapterDefinitionCatalogV2 = z.infer<
  typeof EvidenceAdapterDefinitionCatalogV2Schema
>;

function deepFreezeCatalogV2<T>(value: T): T {
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

const EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2 = deepFreezeCatalogV2(
  EvidenceAdapterDefinitionCatalogV2Schema.parse(codeOwnedCatalogV2()),
);

export function getEvidenceAdapterDefinitionCatalogV2(): EvidenceAdapterDefinitionCatalogV2 {
  return deepFreezeCatalogV2(structuredClone(EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2));
}
