import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  getProductDeliveryProfileCatalogV2,
} from "../../product-compiler/product-delivery-profile-catalog-v2.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
} from "../../evidence/schemas/cli-process-runner-v2.js";
import {
  EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
  EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
  EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
  EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
} from "../../evidence/schemas/command-runner-v2.js";
import {
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
} from "../../evidence/schemas/http-service-runner-v2.js";
import {
  INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
} from
  "../../evidence/schemas/invocation-evidence-runner-execution-lease-v2.js";
import {
  NODE_CLI_LAUNCHER_ABI_HASH_V2,
  NODE_CLI_LAUNCHER_ABI_REF_V2,
  NODE_CLI_LAUNCHER_EXPORT_V2,
  NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_CLI_LAUNCHER_REF_V2,
} from "./node-cli-launcher-v2.js";
import {
  NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
} from "./node-express-api-launcher-v2.js";
import {
  getPlatformEvidenceDefinitionCatalogsV2,
} from "./platform-evidence-definition-catalogs-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleasePortableLocatorV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA =
  "setfarm.platform-release-module-ref.v2" as const;
export const PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA =
  "setfarm.platform-launcher-catalog-entry.v2" as const;
export const PLATFORM_LAUNCHER_CATALOG_V2_SCHEMA =
  "setfarm.platform-launcher-catalog.v2" as const;
export const PLATFORM_RUNNER_CATALOG_ENTRY_V2_SCHEMA =
  "setfarm.platform-runner-catalog-entry.v2" as const;
export const PLATFORM_RUNNER_CATALOG_V2_SCHEMA =
  "setfarm.platform-runner-catalog.v2" as const;

export const PLATFORM_RELEASE_MODULE_CATALOG_V2_MAX_CANONICAL_BYTES =
  512 * 1024;
export const PLATFORM_RELEASE_MODULE_V2_MAX_BYTES = 64 * 1024 * 1024;
export const PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2 =
  "RUNTIME_NODE_PROCESS" as const;

const LauncherRefV2Schema = z.enum([
  NODE_CLI_LAUNCHER_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
]);
const RunnerEntrypointRefV2Schema = z.enum([
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
]);

const PlatformReleaseModuleRefIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA),
  moduleLocator: PlatformReleasePortableLocatorV2Schema.refine(
    (value) =>
      value.startsWith("dist/")
      && value.endsWith(".js"),
    "Release module must be one JavaScript file below dist",
  ),
  payloadLocator: PlatformReleasePortableLocatorV2Schema.refine(
    (value) =>
      value.startsWith("payload/dist/")
      && value.endsWith(".js"),
    "Release payload module must be one JavaScript file below payload/dist",
  ),
  mediaType: z.literal("text/javascript"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(PLATFORM_RELEASE_MODULE_V2_MAX_BYTES),
  mode: z.literal("0444"),
}).strict().superRefine((value, context) => {
  if (value.payloadLocator !== `payload/${value.moduleLocator}`) {
    context.addIssue({
      code: "custom",
      path: ["payloadLocator"],
      message:
        "Release payload locator must be the exact payload projection of its module locator",
    });
  }
});

export type PlatformReleaseModuleRefHashPayloadV2 = z.infer<
  typeof PlatformReleaseModuleRefIdentityV2Schema
>;

export function hashPlatformReleaseModuleRefV2(
  value:
    | PlatformReleaseModuleRefHashPayloadV2
    | PlatformReleaseModuleRefV2,
): string {
  const moduleRef = { ...value } as Record<string, unknown>;
  delete moduleRef.moduleRefHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-module-ref-hash.v2",
    moduleRef,
  });
}

export const PlatformReleaseModuleRefV2Schema =
  PlatformReleaseModuleRefIdentityV2Schema.safeExtend({
    moduleRefHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.moduleRefHash !== hashPlatformReleaseModuleRefV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["moduleRefHash"],
        message: "Release module ref hash must bind its exact bytes and locator",
      });
    }
  });

export type PlatformReleaseModuleRefV2 = z.infer<
  typeof PlatformReleaseModuleRefV2Schema
>;

const ProfileBindingV2Schema = z.object({
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  profileHash: Sha256Schema,
}).strict();

const PlatformLauncherCatalogEntryIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA),
  launcherRef: LauncherRefV2Schema,
  invocationKind: z.enum(["cli_process", "http_service"]),
  profile: ProfileBindingV2Schema,
  requirementDefinitionHash: Sha256Schema,
  module: PlatformReleaseModuleRefV2Schema,
  requiredExport: z.enum([
    NODE_CLI_LAUNCHER_EXPORT_V2,
    NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  ]),
  abiRef: z.enum([
    NODE_CLI_LAUNCHER_ABI_REF_V2,
    NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  ]),
  abiHash: z.enum([
    NODE_CLI_LAUNCHER_ABI_HASH_V2,
    NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  ]),
  runnerEntrypointRef: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  ]),
  executableRef: z.literal(PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2),
  environmentCapsuleHash: Sha256Schema,
}).strict();

export type PlatformLauncherCatalogEntryHashPayloadV2 = z.infer<
  typeof PlatformLauncherCatalogEntryIdentityV2Schema
>;

export function hashPlatformLauncherCatalogEntryV2(
  value:
    | PlatformLauncherCatalogEntryHashPayloadV2
    | PlatformLauncherCatalogEntryV2,
): string {
  const entry = { ...value } as Record<string, unknown>;
  delete entry.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-launcher-catalog-entry-hash.v2",
    entry,
  });
}

function expectedLauncherEntryStaticV2(
  launcherRef: typeof NODE_CLI_LAUNCHER_REF_V2
    | typeof NODE_EXPRESS_API_LAUNCHER_REF_V2,
): Readonly<{
  invocationKind: "cli_process" | "http_service";
  profileId:
    | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
  profileHash: string;
  requirementDefinitionHash: string;
  moduleLocator:
    | typeof NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2
    | typeof NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2;
  requiredExport:
    | typeof NODE_CLI_LAUNCHER_EXPORT_V2
    | typeof NODE_EXPRESS_API_LAUNCHER_EXPORT_V2;
  abiRef:
    | typeof NODE_CLI_LAUNCHER_ABI_REF_V2
    | typeof NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2;
  abiHash: string;
  runnerEntrypointRef:
    | typeof EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2
    | typeof EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2;
}> {
  const profiles = getProductDeliveryProfileCatalogV2();
  const definitions =
    getPlatformEvidenceDefinitionCatalogsV2().launcherRequirements;
  const profileId = launcherRef === NODE_CLI_LAUNCHER_REF_V2
    ? "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    : "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
  const profile = profiles.profiles.find(
    (candidate) => candidate.id === profileId,
  )!;
  const definition = definitions.definitions.find(
    (candidate) => candidate.launcherRef === launcherRef,
  )!;
  return launcherRef === NODE_CLI_LAUNCHER_REF_V2
    ? {
        invocationKind: "cli_process",
        profileId,
        profileHash: profile.profileHash,
        requirementDefinitionHash: definition.definitionHash,
        moduleLocator: NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
        requiredExport: NODE_CLI_LAUNCHER_EXPORT_V2,
        abiRef: NODE_CLI_LAUNCHER_ABI_REF_V2,
        abiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
        runnerEntrypointRef:
          EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
      }
    : {
        invocationKind: "http_service",
        profileId,
        profileHash: profile.profileHash,
        requirementDefinitionHash: definition.definitionHash,
        moduleLocator: NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
        requiredExport: NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
        abiRef: NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
        abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
        runnerEntrypointRef:
          EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
      };
}

export const PlatformLauncherCatalogEntryV2Schema =
  PlatformLauncherCatalogEntryIdentityV2Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expected = expectedLauncherEntryStaticV2(value.launcherRef);
    const actual = {
      invocationKind: value.invocationKind,
      profileId: value.profile.profileId,
      profileHash: value.profile.profileHash,
      requirementDefinitionHash: value.requirementDefinitionHash,
      moduleLocator: value.module.moduleLocator,
      requiredExport: value.requiredExport,
      abiRef: value.abiRef,
      abiHash: value.abiHash,
      runnerEntrypointRef: value.runnerEntrypointRef,
    };
    if (
      canonicalJsonStringify(actual)
        !== canonicalJsonStringify(expected)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Launcher entry must equal its exact code-owned profile, requirement, module, export, and ABI projection",
      });
    }
    if (value.entryHash !== hashPlatformLauncherCatalogEntryV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Launcher entry hash must bind the exact materialized module",
      });
    }
  });

export type PlatformLauncherCatalogEntryV2 = z.infer<
  typeof PlatformLauncherCatalogEntryV2Schema
>;

const PlatformLauncherCatalogIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_LAUNCHER_CATALOG_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_module_bytes_unverified"),
  productionUse: z.literal(
    "forbidden_until_fresh_verified_release",
  ),
  runtimePayloadHash: Sha256Schema,
  platformTreeHash: Sha256Schema,
  externalResolutionHash: Sha256Schema,
  environmentCapsuleHash: Sha256Schema,
  profileCatalogHash: Sha256Schema,
  requirementCatalogHash: Sha256Schema,
  entries: z.tuple([
    PlatformLauncherCatalogEntryV2Schema,
    PlatformLauncherCatalogEntryV2Schema,
  ]),
}).strict().superRefine((value, context) => {
  const definitions =
    getPlatformEvidenceDefinitionCatalogsV2().launcherRequirements;
  const profiles = getProductDeliveryProfileCatalogV2();
  if (
    value.profileCatalogHash !== profiles.catalogHash
    || value.requirementCatalogHash !== definitions.catalogHash
    || value.entries[0].launcherRef !== NODE_CLI_LAUNCHER_REF_V2
    || value.entries[1].launcherRef
      !== NODE_EXPRESS_API_LAUNCHER_REF_V2
    || value.entries.some(
      (entry) =>
        entry.environmentCapsuleHash
          !== value.environmentCapsuleHash,
    )
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Launcher catalog must close exact code-owned catalogs, canonical order, and one environment",
    });
  }
});

export type PlatformLauncherCatalogHashPayloadV2 = z.infer<
  typeof PlatformLauncherCatalogIdentityV2Schema
>;

export function hashPlatformLauncherCatalogV2(
  value:
    | PlatformLauncherCatalogHashPayloadV2
    | PlatformLauncherCatalogV2,
): string {
  const catalog = { ...value } as Record<string, unknown>;
  delete catalog.catalogHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-launcher-catalog-hash.v2",
    catalog,
  });
}

export const PlatformLauncherCatalogV2Schema =
  PlatformLauncherCatalogIdentityV2Schema.safeExtend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_MODULE_CATALOG_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: "Launcher catalog exceeds its canonical byte cap",
      });
      return;
    }
    if (value.catalogHash !== hashPlatformLauncherCatalogV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "Launcher catalog hash must bind every exact module entry",
      });
    }
  });

export type PlatformLauncherCatalogV2 = z.infer<
  typeof PlatformLauncherCatalogV2Schema
>;

const PlatformRunnerCatalogEntryIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RUNNER_CATALOG_ENTRY_V2_SCHEMA),
  runnerEntrypointRef: RunnerEntrypointRefV2Schema,
  invocationKind: z.enum(["cli_process", "command", "http_service"]),
  profileBindings: z.array(ProfileBindingV2Schema).min(1).max(2),
  requirementDefinitionHash: Sha256Schema,
  module: PlatformReleaseModuleRefV2Schema,
  requiredExport: z.literal("runEvidenceAdapterV2"),
  abiRef: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
    EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  ]),
  abiHash: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
    EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  ]),
  executableRefs: z.tuple([
    z.literal(PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2),
  ]),
  admission: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("command"),
      readiness: z.literal(
        "shadow_blocked_until_activated_command_execution_lease",
      ),
      productionUse: z.literal("forbidden"),
    }).strict(),
    z.object({
      kind: z.literal("invocation"),
      readiness: z.literal(
        "admission_boundary_only_until_verified_release_join",
      ),
      productionUse: z.literal("forbidden"),
      executionLeaseContractHash: z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
      ),
    }).strict(),
  ]),
  toolchainHash: Sha256Schema,
}).strict();

export type PlatformRunnerCatalogEntryHashPayloadV2 = z.infer<
  typeof PlatformRunnerCatalogEntryIdentityV2Schema
>;

export function hashPlatformRunnerCatalogEntryV2(
  value:
    | PlatformRunnerCatalogEntryHashPayloadV2
    | PlatformRunnerCatalogEntryV2,
): string {
  const entry = { ...value } as Record<string, unknown>;
  delete entry.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-runner-catalog-entry-hash.v2",
    entry,
  });
}

export type PlatformRunnerToolchainHashInputV2 = Readonly<{
  runnerEntrypointRef:
    | typeof EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2
    | typeof EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2
    | typeof EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2;
  runnerModuleHash: string;
  runnerAbiHash: string;
  platformTreeHash: string;
  dependencyTreeHash: string;
  runtimePayloadHash: string;
  externalResolutionHash: string;
  productionResolutionGraphHash: string;
  environmentCapsuleHash: string;
  launcherCatalogHash: string;
  requiredModuleClosureHash: string;
  transportCodecCatalogHash: string;
  receiptSchemaHash: string;
  adapterDefinitionCatalogHash: string;
  executionAdmissionHash: string;
}>;

export function hashPlatformRunnerToolchainV2(
  value: PlatformRunnerToolchainHashInputV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-runner-toolchain-hash.v2",
    toolchain: value,
  });
}

function expectedRunnerEntryStaticV2(
  runnerRef:
    | typeof EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2
    | typeof EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2
    | typeof EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
): Readonly<{
  invocationKind: "cli_process" | "command" | "http_service";
  profileBindings: readonly Readonly<{
    profileId:
      | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
    profileHash: string;
  }>[];
  requirementDefinitionHash: string;
  moduleLocator: string;
  requiredExport: "runEvidenceAdapterV2";
  abiRef: string;
  abiHash: string;
  admissionKind: "command" | "invocation";
}> {
  const profileCatalog = getProductDeliveryProfileCatalogV2();
  const profileBinding = (
    profileId:
      | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ) => {
    const profile = profileCatalog.profiles.find(
      (candidate) => candidate.id === profileId,
    )!;
    return {
      profileId,
      profileHash: profile.profileHash,
    };
  };
  const definition =
    getPlatformEvidenceDefinitionCatalogsV2()
      .runnerRequirements.definitions.find(
        (candidate) =>
          candidate.runnerEntrypointRef === runnerRef,
      )!;
  if (runnerRef === EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2) {
    return {
      invocationKind: "cli_process",
      profileBindings: [
        profileBinding("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
      ],
      requirementDefinitionHash: definition.definitionHash,
      moduleLocator: EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
      requiredExport: EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
      admissionKind: "invocation",
    };
  }
  if (runnerRef === EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2) {
    return {
      invocationKind: "command",
      profileBindings: [
        profileBinding("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
        profileBinding(
          "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
        ),
      ],
      requirementDefinitionHash: definition.definitionHash,
      moduleLocator: EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
      requiredExport: EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
      admissionKind: "command",
    };
  }
  return {
    invocationKind: "http_service",
    profileBindings: [
      profileBinding(
        "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      ),
    ],
    requirementDefinitionHash: definition.definitionHash,
    moduleLocator: EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
    requiredExport: EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
    abiRef: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
    abiHash: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
    admissionKind: "invocation",
  };
}

export const PlatformRunnerCatalogEntryV2Schema =
  PlatformRunnerCatalogEntryIdentityV2Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expected = expectedRunnerEntryStaticV2(
      value.runnerEntrypointRef,
    );
    const actual = {
      invocationKind: value.invocationKind,
      profileBindings: value.profileBindings,
      requirementDefinitionHash: value.requirementDefinitionHash,
      moduleLocator: value.module.moduleLocator,
      requiredExport: value.requiredExport,
      abiRef: value.abiRef,
      abiHash: value.abiHash,
      admissionKind: value.admission.kind,
    };
    if (
      canonicalJsonStringify(actual)
        !== canonicalJsonStringify(expected)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Runner entry must equal its exact code-owned profile, requirement, module, export, ABI, and admission projection",
      });
    }
    if (
      value.entryHash !== hashPlatformRunnerCatalogEntryV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Runner entry hash must bind its exact toolchain",
      });
    }
  });

export type PlatformRunnerCatalogEntryV2 = z.infer<
  typeof PlatformRunnerCatalogEntryV2Schema
>;

const PlatformRunnerCatalogIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RUNNER_CATALOG_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_module_bytes_unverified"),
  productionUse: z.literal(
    "forbidden_until_fresh_verified_release_and_derived_adapter_catalog",
  ),
  runtimePayloadHash: Sha256Schema,
  platformTreeHash: Sha256Schema,
  dependencyTreeHash: Sha256Schema,
  externalResolutionHash: Sha256Schema,
  productionResolutionGraphHash: Sha256Schema,
  environmentCapsuleHash: Sha256Schema,
  profileCatalogHash: Sha256Schema,
  requirementCatalogHash: Sha256Schema,
  launcherCatalogHash: Sha256Schema,
  requiredModuleClosureHash: Sha256Schema,
  transportCodecCatalogHash: Sha256Schema,
  receiptSchemaHash: Sha256Schema,
  adapterDefinitionCatalogHash: Sha256Schema,
  invocationExecutionLeasePolicyHash: z.literal(
    INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
  ),
  entries: z.tuple([
    PlatformRunnerCatalogEntryV2Schema,
    PlatformRunnerCatalogEntryV2Schema,
    PlatformRunnerCatalogEntryV2Schema,
  ]),
}).strict().superRefine((value, context) => {
  const definitions =
    getPlatformEvidenceDefinitionCatalogsV2().runnerRequirements;
  const profiles = getProductDeliveryProfileCatalogV2();
  const expectedRefs = [
    EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
    EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  ];
  if (
    value.profileCatalogHash !== profiles.catalogHash
    || value.requirementCatalogHash !== definitions.catalogHash
    || value.entries.some(
      (entry, index) =>
        entry.runnerEntrypointRef !== expectedRefs[index],
    )
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Runner catalog must close exact code-owned catalogs and canonical entrypoint order",
    });
  }
  for (const [index, entry] of value.entries.entries()) {
    const executionAdmissionHash = entry.admission.kind === "invocation"
      ? entry.admission.executionLeaseContractHash
      : entry.abiHash;
    const expectedToolchainHash = hashPlatformRunnerToolchainV2({
      runnerEntrypointRef: entry.runnerEntrypointRef,
      runnerModuleHash: entry.module.contentHash,
      runnerAbiHash: entry.abiHash,
      platformTreeHash: value.platformTreeHash,
      dependencyTreeHash: value.dependencyTreeHash,
      runtimePayloadHash: value.runtimePayloadHash,
      externalResolutionHash: value.externalResolutionHash,
      productionResolutionGraphHash:
        value.productionResolutionGraphHash,
      environmentCapsuleHash: value.environmentCapsuleHash,
      launcherCatalogHash: value.launcherCatalogHash,
      requiredModuleClosureHash:
        value.requiredModuleClosureHash,
      transportCodecCatalogHash: value.transportCodecCatalogHash,
      receiptSchemaHash: value.receiptSchemaHash,
      adapterDefinitionCatalogHash:
        value.adapterDefinitionCatalogHash,
      executionAdmissionHash,
    });
    if (entry.toolchainHash !== expectedToolchainHash) {
      context.addIssue({
        code: "custom",
        path: ["entries", index, "toolchainHash"],
        message:
          "Runner toolchain hash must bind the complete release execution closure",
      });
    }
  }
});

export type PlatformRunnerCatalogHashPayloadV2 = z.infer<
  typeof PlatformRunnerCatalogIdentityV2Schema
>;

export function hashPlatformRunnerCatalogV2(
  value:
    | PlatformRunnerCatalogHashPayloadV2
    | PlatformRunnerCatalogV2,
): string {
  const catalog = { ...value } as Record<string, unknown>;
  delete catalog.catalogHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-runner-catalog-hash.v2",
    catalog,
  });
}

export const PlatformRunnerCatalogV2Schema =
  PlatformRunnerCatalogIdentityV2Schema.safeExtend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_MODULE_CATALOG_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: "Runner catalog exceeds its canonical byte cap",
      });
      return;
    }
    if (value.catalogHash !== hashPlatformRunnerCatalogV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "Runner catalog hash must bind every exact toolchain entry",
      });
    }
  });

export type PlatformRunnerCatalogV2 = z.infer<
  typeof PlatformRunnerCatalogV2Schema
>;

export function parsePlatformLauncherCatalogCandidateV2(
  input: unknown,
): PlatformLauncherCatalogV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_MODULE_CATALOG_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformLauncherCatalogV2Schema.parse(snapshot),
  );
}

export function parsePlatformRunnerCatalogCandidateV2(
  input: unknown,
): PlatformRunnerCatalogV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_MODULE_CATALOG_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformRunnerCatalogV2Schema.parse(snapshot),
  );
}
