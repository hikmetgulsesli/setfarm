import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PlatformReleaseModuleRefV2Schema,
  type PlatformReleaseModuleRefV2,
} from "./platform-release-module-catalogs-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleasePortableLocatorV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  hasCanonicalUniquePlatformReleaseStringsV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2_SCHEMA =
  "setfarm.platform-release-required-module-requirement.v2" as const;
export const PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_ENTRY_V2_SCHEMA =
  "setfarm.platform-release-required-module-closure-entry.v2" as const;
export const PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA =
  "setfarm.platform-release-required-module-closure.v2" as const;
export const PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES =
  1024 * 1024;

const JavascriptExportNameV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(
    /^[A-Za-z_$][A-Za-z0-9_$]*$/,
    "Expected one JavaScript export name",
  );

const JavascriptExportContractV2Schema = z.object({
  name: JavascriptExportNameV2Schema,
  kind: z.enum(["function", "string"]),
}).strict();

export const PlatformReleaseRequiredModuleRoleV2Schema = z.enum([
  "bootstrap_cli",
  "bootstrap_http",
  "catalog_adapter_definition",
  "catalog_evidence_definition",
  "catalog_profile",
  "codec_catalog",
  "codec_runtime",
  "evaluator",
  "launcher_cli",
  "launcher_http",
  "network",
  "receipt_abi",
  "result_abi",
  "runner_cli",
  "runner_command",
  "runner_http",
  "runner_invocation_core",
]);

export type PlatformReleaseRequiredModuleRoleV2 = z.infer<
  typeof PlatformReleaseRequiredModuleRoleV2Schema
>;

const PlatformReleaseRequiredModuleDefinitionV2Schema =
  z.object({
    role: PlatformReleaseRequiredModuleRoleV2Schema,
    moduleLocator:
      PlatformReleasePortableLocatorV2Schema.refine(
        (value) =>
          value.startsWith("dist/")
          && value.endsWith(".js"),
        "Required module must be one JavaScript file below dist",
      ),
    sourceModuleLocator:
      PlatformReleasePortableLocatorV2Schema.refine(
        (value) =>
          value.startsWith("src/")
          && value.endsWith(".ts"),
        "Required source module must be one TypeScript file below src",
      ),
    requiredExports: z.array(JavascriptExportContractV2Schema)
      .min(1)
      .max(16),
    implementationUse: z.enum([
      "bootstrap_source",
      "code_owned_definition",
      "runtime",
      "test_fixture_runtime_blocked",
    ]),
    verificationPolicy: z.enum([
      "bootstrap_source_hash_pair_v2",
      "function_exports_present_v2",
      "manifest_adapter_definition_catalog_projection_v2",
      "manifest_evidence_definition_catalog_projection_v2",
      "manifest_profile_catalog_projection_v2",
      "manifest_receipt_abi_projection_v2",
      "manifest_transport_codec_catalog_projection_v2",
      "test_fixture_only_function_exports_present_v2",
    ]),
  }).strict().superRefine((value, context) => {
    if (
      !hasCanonicalUniquePlatformReleaseStringsV2(
        value.requiredExports.map((entry) => entry.name),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredExports"],
        message:
          "Required module exports must be unique and canonically sorted",
      });
    }
  });

export type PlatformReleaseRequiredModuleDefinitionV2 =
  z.infer<
    typeof PlatformReleaseRequiredModuleDefinitionV2Schema
  >;

const REQUIRED_MODULE_DEFINITIONS_V2 = Object.freeze([
  {
    role: "bootstrap_cli",
    moduleLocator:
      "dist/execution/schemas/node-cli-launcher-v2.js",
    sourceModuleLocator:
      "src/execution/schemas/node-cli-launcher-v2.ts",
    requiredExports: [
      {
        name: "NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2",
        kind: "string",
      },
      {
        name: "NODE_CLI_BOOTSTRAP_SOURCE_V2",
        kind: "string",
      },
    ],
    implementationUse: "bootstrap_source",
    verificationPolicy: "bootstrap_source_hash_pair_v2",
  },
  {
    role: "bootstrap_http",
    moduleLocator:
      "dist/execution/schemas/node-express-api-launcher-v2.js",
    sourceModuleLocator:
      "src/execution/schemas/node-express-api-launcher-v2.ts",
    requiredExports: [
      {
        name: "NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2",
        kind: "string",
      },
      {
        name: "NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2",
        kind: "string",
      },
    ],
    implementationUse: "bootstrap_source",
    verificationPolicy: "bootstrap_source_hash_pair_v2",
  },
  {
    role: "catalog_adapter_definition",
    moduleLocator:
      "dist/evidence/schemas/evidence-adapter-definition-catalog-v2.js",
    sourceModuleLocator:
      "src/evidence/schemas/evidence-adapter-definition-catalog-v2.ts",
    requiredExports: [
      {
        name: "getEvidenceAdapterDefinitionCatalogV2",
        kind: "function",
      },
    ],
    implementationUse: "code_owned_definition",
    verificationPolicy:
      "manifest_adapter_definition_catalog_projection_v2",
  },
  {
    role: "catalog_evidence_definition",
    moduleLocator:
      "dist/execution/schemas/platform-evidence-definition-catalogs-v2.js",
    sourceModuleLocator:
      "src/execution/schemas/platform-evidence-definition-catalogs-v2.ts",
    requiredExports: [
      {
        name: "getPlatformEvidenceDefinitionCatalogsV2",
        kind: "function",
      },
    ],
    implementationUse: "code_owned_definition",
    verificationPolicy:
      "manifest_evidence_definition_catalog_projection_v2",
  },
  {
    role: "catalog_profile",
    moduleLocator:
      "dist/product-compiler/product-delivery-profile-catalog-v2.js",
    sourceModuleLocator:
      "src/product-compiler/product-delivery-profile-catalog-v2.ts",
    requiredExports: [
      {
        name: "getProductDeliveryProfileCatalogV2",
        kind: "function",
      },
    ],
    implementationUse: "code_owned_definition",
    verificationPolicy:
      "manifest_profile_catalog_projection_v2",
  },
  {
    role: "codec_catalog",
    moduleLocator:
      "dist/product-compiler/schemas/invocation-input-transport-v2.js",
    sourceModuleLocator:
      "src/product-compiler/schemas/invocation-input-transport-v2.ts",
    requiredExports: [
      {
        name: "getInvocationTransportCodecCatalogV2",
        kind: "function",
      },
      {
        name: "invocationTransportCodecCatalogHashV2",
        kind: "function",
      },
    ],
    implementationUse: "code_owned_definition",
    verificationPolicy:
      "manifest_transport_codec_catalog_projection_v2",
  },
  {
    role: "codec_runtime",
    moduleLocator:
      "dist/product-compiler/invocation-input-transport-v2.js",
    sourceModuleLocator:
      "src/product-compiler/invocation-input-transport-v2.ts",
    requiredExports: [
      {
        name: "decodeInvocationResponseV2",
        kind: "function",
      },
      {
        name: "encodeInvocationRequestV2",
        kind: "function",
      },
      {
        name: "hashEncodedInvocationRequestV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "evaluator",
    moduleLocator:
      "dist/evidence/invocation-evidence-evaluator-v2.js",
    sourceModuleLocator:
      "src/evidence/invocation-evidence-evaluator-v2.ts",
    requiredExports: [
      {
        name: "evaluateInvocationEvidenceV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "launcher_cli",
    moduleLocator:
      "dist/execution/launchers/node-cli-v2.js",
    sourceModuleLocator:
      "src/execution/launchers/node-cli-v2.ts",
    requiredExports: [
      {
        name: "launchNodeCliV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "launcher_http",
    moduleLocator:
      "dist/execution/launchers/node-express-api-v2.js",
    sourceModuleLocator:
      "src/execution/launchers/node-express-api-v2.ts",
    requiredExports: [
      {
        name: "launchNodeExpressApiV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "network",
    moduleLocator:
      "dist/execution/network-sandbox-v2.js",
    sourceModuleLocator:
      "src/execution/network-sandbox-v2.ts",
    requiredExports: [
      {
        name: "acquireNetworkSandboxLaunchContextInternalV2",
        kind: "function",
      },
      {
        name: "runNetworkIsolatedV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "receipt_abi",
    moduleLocator:
      "dist/evidence/schemas/evidence-receipt-v2.js",
    sourceModuleLocator:
      "src/evidence/schemas/evidence-receipt-v2.ts",
    requiredExports: [
      {
        name: "createEvidenceOutcomeCandidateV2",
        kind: "function",
      },
      {
        name: "evidenceReceiptAbiPolicyHashV2",
        kind: "function",
      },
      {
        name: "getEvidenceReceiptAbiPolicyV2",
        kind: "function",
      },
      {
        name: "hashEvidenceReceiptV2",
        kind: "function",
      },
      {
        name: "parseEvidenceReceiptCandidateV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy:
      "manifest_receipt_abi_projection_v2",
  },
  {
    role: "result_abi",
    moduleLocator:
      "dist/evidence/schemas/evidence-runner-v2.js",
    sourceModuleLocator:
      "src/evidence/schemas/evidence-runner-v2.ts",
    requiredExports: [
      {
        name: "hashDurableEvidenceExecutionResultV2",
        kind: "function",
      },
      {
        name: "parseDurableEvidenceExecutionResultV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "runner_cli",
    moduleLocator:
      "dist/evidence/runners/cli-process-v2.js",
    sourceModuleLocator:
      "src/evidence/runners/cli-process-v2.ts",
    requiredExports: [
      {
        name: "runEvidenceAdapterV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "runner_command",
    moduleLocator:
      "dist/evidence/runners/command-v2.js",
    sourceModuleLocator:
      "src/evidence/runners/command-v2.ts",
    requiredExports: [
      {
        name: "runEvidenceAdapterV2",
        kind: "function",
      },
    ],
    implementationUse: "test_fixture_runtime_blocked",
    verificationPolicy:
      "test_fixture_only_function_exports_present_v2",
  },
  {
    role: "runner_http",
    moduleLocator:
      "dist/evidence/runners/http-service-v2.js",
    sourceModuleLocator:
      "src/evidence/runners/http-service-v2.ts",
    requiredExports: [
      {
        name: "runEvidenceAdapterV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
  {
    role: "runner_invocation_core",
    moduleLocator:
      "dist/evidence/invocation-evidence-runner-execution-v2.js",
    sourceModuleLocator:
      "src/evidence/invocation-evidence-runner-execution-v2.ts",
    requiredExports: [
      {
        name: "executeCliInvocationEvidenceRunnerLeaseInternalV2",
        kind: "function",
      },
      {
        name: "executeHttpInvocationEvidenceRunnerLeaseInternalV2",
        kind: "function",
      },
    ],
    implementationUse: "runtime",
    verificationPolicy: "function_exports_present_v2",
  },
] as const satisfies readonly PlatformReleaseRequiredModuleDefinitionV2[]);

const PlatformReleaseRequiredModuleRequirementIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    purpose: z.literal(
      "complete_platform_runtime_module_and_export_closure_v2",
    ),
    entryCount: z.literal(17),
    entries: z.tuple([
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
      PlatformReleaseRequiredModuleDefinitionV2Schema,
    ]),
    staticTransitiveDependencyPolicy: z.literal(
      "esm_linked_and_complete_platform_tree_hash_bound_v2",
    ),
    operationalAdapterStatus: z.literal(
      "blocked_until_verified_release_registry_v2",
    ),
  }).strict().superRefine((value, context) => {
    if (
      canonicalJsonStringify(value.entries)
        !== canonicalJsonStringify(
          REQUIRED_MODULE_DEFINITIONS_V2,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message:
          "Required module definitions must equal the exact zero-input ordered closure",
      });
    }
  });

export type PlatformReleaseRequiredModuleRequirementHashPayloadV2 =
  DeepReadonlyV2<z.infer<
    typeof PlatformReleaseRequiredModuleRequirementIdentityV2Schema
  >>;

type DeepReadonlyV2<T> =
  T extends (...args: never[]) => unknown
    ? T
    : T extends readonly unknown[]
      ? { readonly [Index in keyof T]: DeepReadonlyV2<T[Index]> }
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonlyV2<T[Key]> }
        : T;

export function hashPlatformReleaseRequiredModuleRequirementV2(
  value:
    | PlatformReleaseRequiredModuleRequirementHashPayloadV2
    | PlatformReleaseRequiredModuleRequirementV2,
): string {
  const requirement = { ...value } as Record<string, unknown>;
  delete requirement.requirementHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-required-module-requirement-hash.v2",
    requirement,
  });
}

export const PlatformReleaseRequiredModuleRequirementV2Schema =
  PlatformReleaseRequiredModuleRequirementIdentityV2Schema.extend({
    requirementHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const {
      requirementHash: _requirementHash,
      ...identity
    } = value;
    if (
      value.requirementHash
        !== hashPlatformReleaseRequiredModuleRequirementV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["requirementHash"],
        message:
          "Required module requirement hash must bind its exact code-owned closure",
      });
    }
  });

export type PlatformReleaseRequiredModuleRequirementV2 =
  z.infer<
    typeof PlatformReleaseRequiredModuleRequirementV2Schema
  >;

const REQUIRED_MODULE_REQUIREMENT_IDENTITY_V2 = {
  schema:
    PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  purpose:
    "complete_platform_runtime_module_and_export_closure_v2" as const,
  entryCount: 17 as const,
  entries: REQUIRED_MODULE_DEFINITIONS_V2,
  staticTransitiveDependencyPolicy:
    "esm_linked_and_complete_platform_tree_hash_bound_v2" as const,
  operationalAdapterStatus:
    "blocked_until_verified_release_registry_v2" as const,
};

export const PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2:
PlatformReleaseRequiredModuleRequirementV2 =
  deepFreezePlatformReleaseJsonV2(
    PlatformReleaseRequiredModuleRequirementV2Schema.parse({
    ...REQUIRED_MODULE_REQUIREMENT_IDENTITY_V2,
    requirementHash:
      hashPlatformReleaseRequiredModuleRequirementV2(
        REQUIRED_MODULE_REQUIREMENT_IDENTITY_V2,
      ),
    }),
  );

const PlatformReleaseRequiredModuleClosureEntryIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_ENTRY_V2_SCHEMA,
    ),
    definition:
      PlatformReleaseRequiredModuleDefinitionV2Schema,
    module: PlatformReleaseModuleRefV2Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.module.moduleLocator
        !== value.definition.moduleLocator
      || value.module.payloadLocator
        !== `payload/${value.definition.moduleLocator}`
    ) {
      context.addIssue({
        code: "custom",
        path: ["module"],
        message:
          "Required module bytes must project the exact code-owned locator",
      });
    }
  });

export type PlatformReleaseRequiredModuleClosureEntryHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseRequiredModuleClosureEntryIdentityV2Schema
  >;

export function hashPlatformReleaseRequiredModuleClosureEntryV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const entry = { ...value } as Record<string, unknown>;
  delete entry.entryHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-required-module-closure-entry-hash.v2",
    entry,
  });
}

export const PlatformReleaseRequiredModuleClosureEntryV2Schema =
  PlatformReleaseRequiredModuleClosureEntryIdentityV2Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.entryHash
        !== hashPlatformReleaseRequiredModuleClosureEntryV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message:
          "Required module closure entry hash must bind definition and observed module bytes",
      });
    }
  });

export type PlatformReleaseRequiredModuleClosureEntryV2 =
  z.infer<
    typeof PlatformReleaseRequiredModuleClosureEntryV2Schema
  >;

const PlatformReleaseRequiredModuleClosureIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    authorityState: z.literal(
      "candidate_module_exports_unverified",
    ),
    productionUse: z.literal(
      "forbidden_until_fresh_module_export_receipts_and_verified_release",
    ),
    platformTreeHash: Sha256Schema,
    runtimePayloadHash: Sha256Schema,
    requirement:
      PlatformReleaseRequiredModuleRequirementV2Schema,
    entries: z.tuple([
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
      PlatformReleaseRequiredModuleClosureEntryV2Schema,
    ]),
  }).strict().superRefine((value, context) => {
    if (
      canonicalJsonStringify(value.requirement)
        !== canonicalJsonStringify(
          PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2,
        )
      || canonicalJsonStringify(
        value.entries.map((entry) => entry.definition),
      ) !== canonicalJsonStringify(
        PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2
          .entries,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Required module closure must reproduce its exact zero-input requirement",
      });
    }
    const moduleRefHashes = value.entries.map(
      (entry) => entry.module.moduleRefHash,
    );
    if (
      new Set(moduleRefHashes).size
        !== moduleRefHashes.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message:
          "Required module definitions must bind unique canonical module refs",
      });
    }
  });

export type PlatformReleaseRequiredModuleClosureHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseRequiredModuleClosureIdentityV2Schema
  >;

export function hashPlatformReleaseRequiredModuleClosureV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const closure = { ...value } as Record<string, unknown>;
  delete closure.closureHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-required-module-closure-hash.v2",
    closure,
  });
}

export const PlatformReleaseRequiredModuleClosureV2Schema =
  PlatformReleaseRequiredModuleClosureIdentityV2Schema.extend({
    closureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Required module closure exceeds its canonical byte cap",
      });
      return;
    }
    if (
      value.closureHash
        !== hashPlatformReleaseRequiredModuleClosureV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["closureHash"],
        message:
          "Required module closure hash must bind every definition and observed module ref",
      });
    }
  });

export type PlatformReleaseRequiredModuleClosureV2 =
  z.infer<
    typeof PlatformReleaseRequiredModuleClosureV2Schema
  >;

export function getPlatformReleaseRequiredModuleRequirementV2():
PlatformReleaseRequiredModuleRequirementV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2,
    ),
  );
}

export function bindPlatformReleaseRequiredModuleClosureCandidateV2(
  input: Readonly<{
    platformTreeHash: string;
    runtimePayloadHash: string;
    modules: readonly PlatformReleaseModuleRefV2[];
  }>,
): PlatformReleaseRequiredModuleClosureV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES,
  );
  const values = z.object({
    platformTreeHash: Sha256Schema,
    runtimePayloadHash: Sha256Schema,
    modules: z.array(PlatformReleaseModuleRefV2Schema),
  }).strict().parse(snapshot);
  const modulesByLocator = new Map(
    values.modules.map(
      (module) => [module.moduleLocator, module],
    ),
  );
  const requiredLocators: ReadonlySet<string> = new Set<string>(
    REQUIRED_MODULE_DEFINITIONS_V2.map(
      (definition) => definition.moduleLocator,
    ),
  );
  if (
    modulesByLocator.size !== requiredLocators.size
    || values.modules.length !== requiredLocators.size
    || [...modulesByLocator.keys()].some(
      (locator) => !requiredLocators.has(locator),
    )
  ) {
    throw new Error(
      "PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MEMBERSHIP_INVALID",
    );
  }
  const entries =
    REQUIRED_MODULE_DEFINITIONS_V2.map((definition) => {
      const module = modulesByLocator.get(
        definition.moduleLocator,
      );
      if (!module) {
        throw new Error(
          "PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MEMBER_MISSING",
        );
      }
      const identity = {
        schema:
          PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_ENTRY_V2_SCHEMA,
        definition,
        module,
      };
      return {
        ...identity,
        entryHash:
          hashPlatformReleaseRequiredModuleClosureEntryV2(
            identity,
          ),
      };
    });
  const identity = {
    schema:
      PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState:
      "candidate_module_exports_unverified" as const,
    productionUse:
      "forbidden_until_fresh_module_export_receipts_and_verified_release" as const,
    platformTreeHash: values.platformTreeHash,
    runtimePayloadHash: values.runtimePayloadHash,
    requirement:
      getPlatformReleaseRequiredModuleRequirementV2(),
    entries,
  };
  return parsePlatformReleaseRequiredModuleClosureCandidateV2({
    ...identity,
    closureHash:
      hashPlatformReleaseRequiredModuleClosureV2(identity),
  });
}

export function parsePlatformReleaseRequiredModuleClosureCandidateV2(
  input: unknown,
): PlatformReleaseRequiredModuleClosureV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseRequiredModuleClosureV2Schema.parse(
      snapshot,
    ),
  );
}
