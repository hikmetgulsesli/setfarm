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
} from "../../evidence/schemas/evidence-receipt-v2.js";

export const PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA =
  "setfarm.platform-evidence-definition-catalogs.v2" as const;
export const LAUNCHER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA =
  "setfarm.launcher-definition-requirements-catalog.v2" as const;
export const LAUNCHER_DEFINITION_REQUIREMENT_V2_SCHEMA =
  "setfarm.launcher-definition-requirement.v2" as const;
export const EVIDENCE_RUNNER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA =
  "setfarm.evidence-runner-definition-requirements-catalog.v2" as const;
export const EVIDENCE_RUNNER_DEFINITION_REQUIREMENT_V2_SCHEMA =
  "setfarm.evidence-runner-definition-requirement.v2" as const;
export const EMPTY_OPERATIONAL_EVIDENCE_CATALOG_V2_SCHEMA =
  "setfarm.empty-operational-evidence-catalog.v2" as const;
export const PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION = "2.0.0" as const;

export const PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2 = Object.freeze([
  "PLATFORM_EVIDENCE_V2_LAUNCHER_IMPLEMENTATIONS_MISSING",
  "PLATFORM_EVIDENCE_V2_RUNNER_IMPLEMENTATIONS_MISSING",
  "PLATFORM_EVIDENCE_V2_VERIFIED_RELEASE_BINDING_MISSING",
] as const);

const LAUNCHER_REQUIREMENT_HASH_DOMAIN_V2 =
  "setfarm.launcher-definition-requirement-hash.v2";
const LAUNCHER_CATALOG_HASH_DOMAIN_V2 =
  "setfarm.launcher-definition-requirements-catalog-hash.v2";
const RUNNER_REQUIREMENT_HASH_DOMAIN_V2 =
  "setfarm.evidence-runner-definition-requirement-hash.v2";
const RUNNER_CATALOG_HASH_DOMAIN_V2 =
  "setfarm.evidence-runner-definition-requirements-catalog-hash.v2";
const EMPTY_OPERATIONAL_CATALOG_HASH_DOMAIN_V2 =
  "setfarm.empty-operational-evidence-catalog-hash.v2";
const PLATFORM_CATALOGS_HASH_DOMAIN_V2 =
  "setfarm.platform-evidence-definition-catalogs-hash.v2";

const ProfileIdV2Schema = z.enum(PRODUCT_DELIVERY_PROFILE_IDS_V2);
const LauncherRefV2Schema = z.enum([
  "LAUNCH_NODE_CLI_V2",
  "LAUNCH_NODE_EXPRESS_API_V2",
]);
const RunnerEntrypointRefV2Schema = z.enum([
  "ENTRY_EVIDENCE_CLI_PROCESS_V2",
  "ENTRY_EVIDENCE_COMMAND_V2",
  "ENTRY_EVIDENCE_HTTP_SERVICE_V2",
]);
const FutureModuleLocatorV2Schema = z.string()
  .min(1)
  .max(500)
  .regex(
    /^dist\/(?:evidence|execution)\/[a-z0-9]+(?:[/-][a-z0-9]+)*\.js$/u,
    "Expected one normalized future platform module locator",
  );
const JavascriptExportV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u);
const AbiRequirementRefV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Z][A-Z0-9_]*_V2$/u);

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

const ProfileCatalogBindingV2Schema = z.object({
  catalogSchema: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA),
  profileSchema: z.literal(PRODUCT_DELIVERY_PROFILE_V2_SCHEMA),
  catalogVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION),
  catalogHash: Sha256Schema,
}).strict();

const LauncherDefinitionRequirementIdentityV2Schema = z.object({
  schema: z.literal(LAUNCHER_DEFINITION_REQUIREMENT_V2_SCHEMA),
  launcherRef: LauncherRefV2Schema,
  profileId: ProfileIdV2Schema,
  invocationKind: z.enum(["cli_process", "http_service"]),
  requiredRunnerEntrypointRef: z.enum([
    "ENTRY_EVIDENCE_CLI_PROCESS_V2",
    "ENTRY_EVIDENCE_HTTP_SERVICE_V2",
  ]),
  requiredModuleLocator: FutureModuleLocatorV2Schema,
  requiredExport: JavascriptExportV2Schema,
  requiredAbiRef: AbiRequirementRefV2Schema,
}).strict();

export type LauncherDefinitionRequirementHashPayloadV2 = z.infer<
  typeof LauncherDefinitionRequirementIdentityV2Schema
>;

export function hashLauncherDefinitionRequirementV2(
  value:
    | LauncherDefinitionRequirementHashPayloadV2
    | LauncherDefinitionRequirementV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.definitionHash;
  return hashCanonicalJson({
    schema: LAUNCHER_REQUIREMENT_HASH_DOMAIN_V2,
    requirement: payload,
  });
}

export const LauncherDefinitionRequirementV2Schema =
  LauncherDefinitionRequirementIdentityV2Schema.extend({
    definitionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.definitionHash !== hashLauncherDefinitionRequirementV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["definitionHash"],
        message: "Launcher requirement definition hash mismatch",
      });
    }
  });

export type LauncherDefinitionRequirementV2 = z.infer<
  typeof LauncherDefinitionRequirementV2Schema
>;

const LauncherDefinitionRequirementsCatalogIdentityV2Schema = z.object({
  schema: z.literal(LAUNCHER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA),
  version: z.literal(PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION),
  authorityKind: z.literal("requirements_only"),
  productionUse: z.literal("forbidden"),
  definitions: z.array(LauncherDefinitionRequirementV2Schema).length(2),
}).strict();

export type LauncherDefinitionRequirementsCatalogHashPayloadV2 = z.infer<
  typeof LauncherDefinitionRequirementsCatalogIdentityV2Schema
>;

export function hashLauncherDefinitionRequirementsCatalogV2(
  value:
    | LauncherDefinitionRequirementsCatalogHashPayloadV2
    | LauncherDefinitionRequirementsCatalogV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: LAUNCHER_CATALOG_HASH_DOMAIN_V2,
    catalog: payload,
  });
}

function codeOwnedLauncherDefinitionsV2(): LauncherDefinitionRequirementV2[] {
  const profiles = getProductDeliveryProfileCatalogV2().profiles;
  const cli = profiles.find((profile) => profile.id === PRODUCT_DELIVERY_PROFILE_IDS_V2[0])!;
  const api = profiles.find((profile) => profile.id === PRODUCT_DELIVERY_PROFILE_IDS_V2[1])!;
  const identities: LauncherDefinitionRequirementHashPayloadV2[] = [
    {
      schema: LAUNCHER_DEFINITION_REQUIREMENT_V2_SCHEMA,
      launcherRef: cli.runtime.launcherRef,
      profileId: cli.id,
      invocationKind: "cli_process",
      requiredRunnerEntrypointRef: "ENTRY_EVIDENCE_CLI_PROCESS_V2",
      requiredModuleLocator: "dist/execution/launchers/node-cli-v2.js",
      requiredExport: "launchNodeCliV2",
      requiredAbiRef: "LAUNCHER_NODE_CLI_ABI_V2",
    },
    {
      schema: LAUNCHER_DEFINITION_REQUIREMENT_V2_SCHEMA,
      launcherRef: api.runtime.launcherRef,
      profileId: api.id,
      invocationKind: "http_service",
      requiredRunnerEntrypointRef: "ENTRY_EVIDENCE_HTTP_SERVICE_V2",
      requiredModuleLocator: "dist/execution/launchers/node-express-api-v2.js",
      requiredExport: "launchNodeExpressApiV2",
      requiredAbiRef: "LAUNCHER_NODE_EXPRESS_API_ABI_V2",
    },
  ];
  return identities.map((identity) => ({
    ...identity,
    definitionHash: hashLauncherDefinitionRequirementV2(identity),
  }));
}

function codeOwnedLauncherCatalogV2(): LauncherDefinitionRequirementsCatalogV2 {
  const identity: LauncherDefinitionRequirementsCatalogHashPayloadV2 = {
    schema: LAUNCHER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA,
    version: PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION,
    authorityKind: "requirements_only",
    productionUse: "forbidden",
    definitions: codeOwnedLauncherDefinitionsV2(),
  };
  return {
    ...identity,
    catalogHash: hashLauncherDefinitionRequirementsCatalogV2(identity),
  };
}

export const LauncherDefinitionRequirementsCatalogV2Schema =
  LauncherDefinitionRequirementsCatalogIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.catalogHash !== hashLauncherDefinitionRequirementsCatalogV2(value)
      || canonicalJsonStringify(value) !== canonicalJsonStringify(codeOwnedLauncherCatalogV2())
    ) {
      context.addIssue({
        code: "custom",
        message: "Launcher requirements catalog must equal the exact zero-input code-owned catalog",
      });
    }
  });

export type LauncherDefinitionRequirementsCatalogV2 = z.infer<
  typeof LauncherDefinitionRequirementsCatalogV2Schema
>;

const EvidenceRunnerDefinitionRequirementIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_RUNNER_DEFINITION_REQUIREMENT_V2_SCHEMA),
  runnerEntrypointRef: RunnerEntrypointRefV2Schema,
  invocationKind: z.enum(["cli_process", "command", "http_service"]),
  requiredModuleLocator: FutureModuleLocatorV2Schema,
  requiredExport: z.literal("runEvidenceAdapterV2"),
  requiredAbiRef: AbiRequirementRefV2Schema,
}).strict();

export type EvidenceRunnerDefinitionRequirementHashPayloadV2 = z.infer<
  typeof EvidenceRunnerDefinitionRequirementIdentityV2Schema
>;

export function hashEvidenceRunnerDefinitionRequirementV2(
  value:
    | EvidenceRunnerDefinitionRequirementHashPayloadV2
    | EvidenceRunnerDefinitionRequirementV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.definitionHash;
  return hashCanonicalJson({
    schema: RUNNER_REQUIREMENT_HASH_DOMAIN_V2,
    requirement: payload,
  });
}

export const EvidenceRunnerDefinitionRequirementV2Schema =
  EvidenceRunnerDefinitionRequirementIdentityV2Schema.extend({
    definitionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.definitionHash !== hashEvidenceRunnerDefinitionRequirementV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["definitionHash"],
        message: "Evidence runner requirement definition hash mismatch",
      });
    }
  });

export type EvidenceRunnerDefinitionRequirementV2 = z.infer<
  typeof EvidenceRunnerDefinitionRequirementV2Schema
>;

const EvidenceRunnerDefinitionRequirementsCatalogIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_RUNNER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA),
  version: z.literal(PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION),
  authorityKind: z.literal("requirements_only"),
  productionUse: z.literal("forbidden"),
  definitions: z.array(EvidenceRunnerDefinitionRequirementV2Schema).length(3),
}).strict();

export type EvidenceRunnerDefinitionRequirementsCatalogHashPayloadV2 = z.infer<
  typeof EvidenceRunnerDefinitionRequirementsCatalogIdentityV2Schema
>;

export function hashEvidenceRunnerDefinitionRequirementsCatalogV2(
  value:
    | EvidenceRunnerDefinitionRequirementsCatalogHashPayloadV2
    | EvidenceRunnerDefinitionRequirementsCatalogV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: RUNNER_CATALOG_HASH_DOMAIN_V2,
    catalog: payload,
  });
}

function codeOwnedRunnerDefinitionsV2(): EvidenceRunnerDefinitionRequirementV2[] {
  const identities: EvidenceRunnerDefinitionRequirementHashPayloadV2[] = [
    {
      schema: EVIDENCE_RUNNER_DEFINITION_REQUIREMENT_V2_SCHEMA,
      runnerEntrypointRef: "ENTRY_EVIDENCE_CLI_PROCESS_V2",
      invocationKind: "cli_process",
      requiredModuleLocator: "dist/evidence/runners/cli-process-v2.js",
      requiredExport: "runEvidenceAdapterV2",
      requiredAbiRef: "EVIDENCE_CLI_PROCESS_RUNNER_ABI_V2",
    },
    {
      schema: EVIDENCE_RUNNER_DEFINITION_REQUIREMENT_V2_SCHEMA,
      runnerEntrypointRef: "ENTRY_EVIDENCE_COMMAND_V2",
      invocationKind: "command",
      requiredModuleLocator: "dist/evidence/runners/command-v2.js",
      requiredExport: "runEvidenceAdapterV2",
      requiredAbiRef: "EVIDENCE_COMMAND_RUNNER_ABI_V2",
    },
    {
      schema: EVIDENCE_RUNNER_DEFINITION_REQUIREMENT_V2_SCHEMA,
      runnerEntrypointRef: "ENTRY_EVIDENCE_HTTP_SERVICE_V2",
      invocationKind: "http_service",
      requiredModuleLocator: "dist/evidence/runners/http-service-v2.js",
      requiredExport: "runEvidenceAdapterV2",
      requiredAbiRef: "EVIDENCE_HTTP_SERVICE_RUNNER_ABI_V2",
    },
  ];
  return identities.map((identity) => ({
    ...identity,
    definitionHash: hashEvidenceRunnerDefinitionRequirementV2(identity),
  }));
}

function codeOwnedRunnerCatalogV2(): EvidenceRunnerDefinitionRequirementsCatalogV2 {
  const identity: EvidenceRunnerDefinitionRequirementsCatalogHashPayloadV2 = {
    schema: EVIDENCE_RUNNER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA,
    version: PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION,
    authorityKind: "requirements_only",
    productionUse: "forbidden",
    definitions: codeOwnedRunnerDefinitionsV2(),
  };
  return {
    ...identity,
    catalogHash: hashEvidenceRunnerDefinitionRequirementsCatalogV2(identity),
  };
}

export const EvidenceRunnerDefinitionRequirementsCatalogV2Schema =
  EvidenceRunnerDefinitionRequirementsCatalogIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.catalogHash !== hashEvidenceRunnerDefinitionRequirementsCatalogV2(value)
      || canonicalJsonStringify(value) !== canonicalJsonStringify(codeOwnedRunnerCatalogV2())
    ) {
      context.addIssue({
        code: "custom",
        message: "Runner requirements catalog must equal the exact zero-input code-owned catalog",
      });
    }
  });

export type EvidenceRunnerDefinitionRequirementsCatalogV2 = z.infer<
  typeof EvidenceRunnerDefinitionRequirementsCatalogV2Schema
>;

const EmptyOperationalEvidenceCatalogIdentityV2Schema = z.object({
  schema: z.literal(EMPTY_OPERATIONAL_EVIDENCE_CATALOG_V2_SCHEMA),
  entries: z.tuple([]),
}).strict();

export type EmptyOperationalEvidenceCatalogHashPayloadV2 = z.infer<
  typeof EmptyOperationalEvidenceCatalogIdentityV2Schema
>;

export function hashEmptyOperationalEvidenceCatalogV2(
  value:
    | EmptyOperationalEvidenceCatalogHashPayloadV2
    | EmptyOperationalEvidenceCatalogV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: EMPTY_OPERATIONAL_CATALOG_HASH_DOMAIN_V2,
    catalog: payload,
  });
}

export const EmptyOperationalEvidenceCatalogV2Schema =
  EmptyOperationalEvidenceCatalogIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.catalogHash !== hashEmptyOperationalEvidenceCatalogV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "Empty operational evidence catalog hash mismatch",
      });
    }
  });

export type EmptyOperationalEvidenceCatalogV2 = z.infer<
  typeof EmptyOperationalEvidenceCatalogV2Schema
>;

const PlatformEvidenceDefinitionCatalogsIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA),
  version: z.literal(PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION),
  readiness: z.literal("shadow_blocked"),
  productionUse: z.literal("forbidden"),
  blockerCodes: z.tuple([
    z.literal(PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2[0]),
    z.literal(PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2[1]),
    z.literal(PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2[2]),
  ]),
  receiptSchemaBinding: ReceiptSchemaBindingV2Schema,
  invocationCodecCatalogBinding: InvocationCodecCatalogBindingV2Schema,
  profileCatalogBinding: ProfileCatalogBindingV2Schema,
  launcherRequirements: LauncherDefinitionRequirementsCatalogV2Schema,
  runnerRequirements: EvidenceRunnerDefinitionRequirementsCatalogV2Schema,
  operationalCatalog: EmptyOperationalEvidenceCatalogV2Schema,
}).strict();

export type PlatformEvidenceDefinitionCatalogsHashPayloadV2 = z.infer<
  typeof PlatformEvidenceDefinitionCatalogsIdentityV2Schema
>;

export function hashPlatformEvidenceDefinitionCatalogsV2(
  value:
    | PlatformEvidenceDefinitionCatalogsHashPayloadV2
    | PlatformEvidenceDefinitionCatalogsV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: PLATFORM_CATALOGS_HASH_DOMAIN_V2,
    catalogs: payload,
  });
}

function codeOwnedReceiptSchemaBindingV2() {
  const policy = getEvidenceReceiptAbiPolicyV2();
  return {
    policySchema: policy.schema,
    policyVersion: policy.version,
    receiptSchema: policy.receiptSchema,
    policyHash: evidenceReceiptAbiPolicyHashV2(),
  };
}

function codeOwnedCodecCatalogBindingV2() {
  const catalog = getInvocationTransportCodecCatalogV2();
  return {
    schema: catalog.schema,
    catalogVersion: catalog.catalogVersion,
    catalogHash: invocationTransportCodecCatalogHashV2(),
  };
}

function codeOwnedProfileCatalogBindingV2(): z.infer<typeof ProfileCatalogBindingV2Schema> {
  const catalog = getProductDeliveryProfileCatalogV2();
  return {
    catalogSchema: catalog.schema,
    profileSchema: PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
    catalogVersion: catalog.catalogVersion,
    catalogHash: catalog.catalogHash,
  };
}

function codeOwnedOperationalCatalogV2(): EmptyOperationalEvidenceCatalogV2 {
  const identity: EmptyOperationalEvidenceCatalogHashPayloadV2 = {
    schema: EMPTY_OPERATIONAL_EVIDENCE_CATALOG_V2_SCHEMA,
    entries: [],
  };
  return {
    ...identity,
    catalogHash: hashEmptyOperationalEvidenceCatalogV2(identity),
  };
}

function codeOwnedPlatformCatalogsV2(): PlatformEvidenceDefinitionCatalogsV2 {
  const identity: PlatformEvidenceDefinitionCatalogsHashPayloadV2 = {
    schema: PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA,
    version: PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION,
    readiness: "shadow_blocked",
    productionUse: "forbidden",
    blockerCodes: [...PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2],
    receiptSchemaBinding: codeOwnedReceiptSchemaBindingV2(),
    invocationCodecCatalogBinding: codeOwnedCodecCatalogBindingV2(),
    profileCatalogBinding: codeOwnedProfileCatalogBindingV2(),
    launcherRequirements: codeOwnedLauncherCatalogV2(),
    runnerRequirements: codeOwnedRunnerCatalogV2(),
    operationalCatalog: codeOwnedOperationalCatalogV2(),
  };
  return {
    ...identity,
    catalogHash: hashPlatformEvidenceDefinitionCatalogsV2(identity),
  };
}

export const PlatformEvidenceDefinitionCatalogsV2Schema =
  PlatformEvidenceDefinitionCatalogsIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.catalogHash !== hashPlatformEvidenceDefinitionCatalogsV2(value)
      || canonicalJsonStringify(value) !== canonicalJsonStringify(codeOwnedPlatformCatalogsV2())
    ) {
      context.addIssue({
        code: "custom",
        message: "Platform evidence definition catalogs must equal exact zero-input code authority",
      });
    }
  });

export type PlatformEvidenceDefinitionCatalogsV2 = z.infer<
  typeof PlatformEvidenceDefinitionCatalogsV2Schema
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

const LAUNCHER_REQUIREMENTS_CATALOG_V2 = deepFreezeCatalogV2(
  LauncherDefinitionRequirementsCatalogV2Schema.parse(codeOwnedLauncherCatalogV2()),
);
const RUNNER_REQUIREMENTS_CATALOG_V2 = deepFreezeCatalogV2(
  EvidenceRunnerDefinitionRequirementsCatalogV2Schema.parse(codeOwnedRunnerCatalogV2()),
);
const PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2 = deepFreezeCatalogV2(
  PlatformEvidenceDefinitionCatalogsV2Schema.parse(codeOwnedPlatformCatalogsV2()),
);

export function getLauncherDefinitionRequirementsCatalogV2(): LauncherDefinitionRequirementsCatalogV2 {
  return deepFreezeCatalogV2(structuredClone(LAUNCHER_REQUIREMENTS_CATALOG_V2));
}

export function getEvidenceRunnerDefinitionRequirementsCatalogV2(): EvidenceRunnerDefinitionRequirementsCatalogV2 {
  return deepFreezeCatalogV2(structuredClone(RUNNER_REQUIREMENTS_CATALOG_V2));
}

export function getPlatformEvidenceDefinitionCatalogsV2(): PlatformEvidenceDefinitionCatalogsV2 {
  return deepFreezeCatalogV2(structuredClone(PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2));
}
