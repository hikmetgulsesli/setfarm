import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";

export const NODE_EXECUTION_LAYOUT_V2_SCHEMA =
  "setfarm.node-execution-layout.v2" as const;
export const NODE_EXECUTION_LAYOUT_CATALOG_V2_SCHEMA =
  "setfarm.node-execution-layout-catalog.v2" as const;
export const LEGACY_INSTALLER_EXECUTION_OBSERVATION_V1_SCHEMA =
  "setfarm.legacy-installer-execution-observation.v1" as const;
export const NODE_EXECUTION_PATH_SLOT_SET_V2_SCHEMA =
  "setfarm.node-execution-path-slot-set.v2" as const;
export const NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2 = "2.0.0" as const;
export const NODE_EXECUTION_LAYOUT_CATALOG_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;

export const NODE_EXECUTION_LAYOUT_REFS_V2 = Object.freeze([
  "NODE_EXECUTION_LAYOUT_NODE_CLI_V2",
  "NODE_EXECUTION_LAYOUT_NODE_EXPRESS_API_V2",
] as const);

export const NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2 = Object.freeze([
  "NODE_EXECUTION_LAYOUT_V2_CANDIDATE_BYTES_UNVERIFIED",
  "NODE_EXECUTION_LAYOUT_V2_FILE_TREE_UNVERIFIED",
  "NODE_EXECUTION_LAYOUT_V2_LEGACY_BUILD_OUTPUT_AUTHORITY_UNMIGRATED",
  "NODE_EXECUTION_LAYOUT_V2_LEGACY_ENTRYPOINT_RESOLVER_UNMIGRATED",
  "NODE_EXECUTION_LAYOUT_V2_LEGACY_SCOPE_TARGET_AUTHORITY_UNMIGRATED",
  "NODE_EXECUTION_LAYOUT_V2_PATH_TOKEN_CONTRACT_UNVERIFIED",
  "NODE_EXECUTION_LAYOUT_V2_SCAFFOLD_MATERIALIZATION_UNVERIFIED",
  "NODE_EXECUTION_LAYOUT_V2_SOURCE_DECLARATIONS_UNVERIFIED",
] as const);

const NodeExecutionLayoutBlockerCodeV2Schema = z.enum(
  NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2,
);

const ReadinessV2Schema = z.object({
  status: z.literal("shadow"),
  productionUse: z.literal("forbidden"),
  blockerCodes: z.array(NodeExecutionLayoutBlockerCodeV2Schema)
    .length(NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2.length),
}).strict().superRefine((value, context) => {
  if (
    canonicalJsonStringify(value.blockerCodes)
    === canonicalJsonStringify(NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2)
  ) return;
  context.addIssue({
    code: "custom",
    path: ["blockerCodes"],
    message: "Node execution layout blockers must equal the exact code-owned set",
  });
});

const NodeCompilerContractV2Schema = z.object({
  packageJsonPathSlotRef: z.literal("PATH_SLOT_NODE_PACKAGE_JSON_V2"),
  packageType: z.literal("module"),
  packageBuildScriptName: z.literal("build"),
  compilerExecutable: z.literal("tsc"),
  compilerArguments: z.tuple([
    z.object({
      kind: z.literal("literal"),
      value: z.literal("-p"),
    }).strict(),
    z.object({
      kind: z.literal("path_slot"),
      pathSlotRef: z.literal("PATH_SLOT_NODE_TSCONFIG_JSON_V2"),
    }).strict(),
  ]),
  tsconfigPathSlotRef: z.literal("PATH_SLOT_NODE_TSCONFIG_JSON_V2"),
  target: z.literal("ES2022"),
  module: z.literal("NodeNext"),
  moduleResolution: z.literal("NodeNext"),
  sourceRootRef: z.literal("PATH_ROOT_NODE_SOURCE_V2"),
  outputRootRef: z.literal("PATH_ROOT_NODE_BUILD_OUTPUT_V2"),
  noEmitOnError: z.literal(true),
}).strict();

const ProfileBindingCommonV2Shape = {
  catalogVersion: z.literal("2.0.0"),
  catalogHash: Sha256Schema,
  profileHash: Sha256Schema,
} as const;

const StackPackBindingCommonV2Shape = {
  stackPackVersion: z.string().min(1).max(160),
  stackPackContentHash: Sha256Schema,
} as const;

const BuildCommandBindingV2Schema = z.object({
  commandRef: z.literal("CMD_BUILD"),
  commandKind: z.literal("build"),
  cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
  directArgv: z.tuple([
    z.literal("npm"),
    z.literal("run"),
    z.literal("build"),
  ]),
}).strict();

const CliProfileBindingV2Schema = z.object({
  ...ProfileBindingCommonV2Shape,
  profileId: z.literal("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
  launcherRef: z.literal("LAUNCH_NODE_CLI_V2"),
}).strict();

const ApiProfileBindingV2Schema = z.object({
  ...ProfileBindingCommonV2Shape,
  profileId: z.literal("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"),
  launcherRef: z.literal("LAUNCH_NODE_EXPRESS_API_V2"),
}).strict();

const CliStackPackBindingV2Schema = z.object({
  ...StackPackBindingCommonV2Shape,
  stackPackId: z.literal("node-cli"),
}).strict();

const ApiStackPackBindingV2Schema = z.object({
  ...StackPackBindingCommonV2Shape,
  stackPackId: z.literal("node-express-api"),
}).strict();

const CliTopologyBindingV2Schema = z.object({
  canonicalEntrypointRuleRef: z.literal("ENTRY_RULE_NODE_CLI"),
  canonicalEntrypointKind: z.literal("cli"),
  canonicalEntrypointPathSlotRef: z.literal(
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
  ),
  historicalEntrypointPathSlotRefs: z.tuple([
    z.literal("PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2"),
  ]),
  buildCommand: BuildCommandBindingV2Schema,
}).strict();

const ApiTopologyBindingV2Schema = z.object({
  canonicalEntrypointRuleRef: z.literal("ENTRY_RULE_NODE_APP"),
  canonicalEntrypointKind: z.literal("api"),
  canonicalEntrypointPathSlotRef: z.literal(
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
  ),
  historicalEntrypointPathSlotRefs: z.tuple([
    z.literal("PATH_SLOT_NODE_API_HISTORICAL_ROOT_SERVER_V2"),
    z.literal("PATH_SLOT_NODE_API_HISTORICAL_SOURCE_SERVER_V2"),
  ]),
  buildCommand: BuildCommandBindingV2Schema,
}).strict();

const CliSourceToRuntimeV2Schema = z.object({
  sourcePathSlotRef: z.literal("PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2"),
  buildOutputPathSlotRef: z.literal("PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2"),
  candidateModulePathSlotRef: z.literal("PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2"),
  sourceMediaType: z.literal("text/typescript"),
  outputMediaType: z.literal("text/javascript"),
  moduleSystem: z.literal("node_esm"),
}).strict();

const ApiSourceToRuntimeV2Schema = z.object({
  sourcePathSlotRef: z.literal("PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2"),
  buildOutputPathSlotRef: z.literal("PATH_SLOT_NODE_API_BUILD_OUTPUT_V2"),
  candidateModulePathSlotRef: z.literal("PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2"),
  sourceMediaType: z.literal("text/typescript"),
  outputMediaType: z.literal("text/javascript"),
  moduleSystem: z.literal("node_esm"),
}).strict();

const CliRuntimeTargetV2Schema = z.object({
  kind: z.literal("cli"),
  entrypointAbi: z.literal("NODE_ESM_CLI_ENTRYPOINT_ABI_V2"),
  argvOwnership: z.literal("executable_invocation_transport_binding_v2"),
  nodeOptionTokens: z.tuple([]),
  moduleArgumentPathSlotRef: z.literal(
    "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
  ),
  transportArguments: z.literal("append_after_module"),
}).strict();

const ApiRuntimeTargetV2Schema = z.object({
  kind: z.literal("http_handler"),
  modulePathSlotRef: z.literal("PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2"),
  exportName: z.literal("setfarmHttpHandlerV2"),
  handlerAbi: z.literal("EXPRESS_REQUEST_HANDLER_ABI_V2"),
  serverOwnership: z.literal("platform_owned"),
  listenerOwnership: z.literal("platform_owned"),
  socketOwnership: z.literal("platform_owned"),
  candidateListen: z.literal("forbidden"),
}).strict();

const NodeExecutionPathRootsV2Schema = z.object({
  repository: z.object({
    rootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    physicalSpace: z.literal("repository"),
    locatorPrefix: z.literal(""),
  }).strict(),
  source: z.object({
    rootRef: z.literal("PATH_ROOT_NODE_SOURCE_V2"),
    physicalSpace: z.literal("repository"),
    parentRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    locatorPrefix: z.literal("src"),
  }).strict(),
  buildOutput: z.object({
    rootRef: z.literal("PATH_ROOT_NODE_BUILD_OUTPUT_V2"),
    physicalSpace: z.literal("repository"),
    parentRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    locatorPrefix: z.literal("dist"),
  }).strict(),
  candidateRuntime: z.object({
    rootRef: z.literal("PATH_ROOT_CANDIDATE_RUNTIME_V2"),
    physicalSpace: z.literal("candidate_runtime"),
    locatorPrefix: z.literal(""),
  }).strict(),
}).strict();

function exactPathSlotV2Schema<
  const SlotRef extends string,
  const Namespace extends string,
  const Disposition extends "planned" | "reject_only",
  const Locator extends string,
  const RootRef extends string,
>(
  slotRef: SlotRef,
  namespace: Namespace,
  disposition: Disposition,
  locator: Locator,
  underRootRef: RootRef,
) {
  return z.object({
    slotRef: z.literal(slotRef),
    namespace: z.literal(namespace),
    disposition: z.literal(disposition),
    nodeKind: z.literal("file"),
    locator: z.literal(locator),
    underRootRef: z.literal(underRootRef),
  }).strict();
}

const PackageJsonPathSlotV2Schema = exactPathSlotV2Schema(
  "PATH_SLOT_NODE_PACKAGE_JSON_V2",
  "repository_config",
  "planned",
  "package.json",
  "PATH_ROOT_NODE_REPOSITORY_V2",
);

const TsconfigJsonPathSlotV2Schema = exactPathSlotV2Schema(
  "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
  "repository_config",
  "planned",
  "tsconfig.json",
  "PATH_ROOT_NODE_REPOSITORY_V2",
);

const CliPathSlotSetIdentityV2Schema = z.object({
  schema: z.literal(NODE_EXECUTION_PATH_SLOT_SET_V2_SCHEMA),
  slotContractVersion: z.literal(NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2),
  roots: NodeExecutionPathRootsV2Schema,
  slotCount: z.literal(6),
  packageJson: PackageJsonPathSlotV2Schema,
  tsconfigJson: TsconfigJsonPathSlotV2Schema,
  sourceEntrypoint: exactPathSlotV2Schema(
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    "repository_source",
    "planned",
    "src/cli.ts",
    "PATH_ROOT_NODE_SOURCE_V2",
  ),
  buildOutput: exactPathSlotV2Schema(
    "PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2",
    "repository_build_output",
    "planned",
    "dist/cli.js",
    "PATH_ROOT_NODE_BUILD_OUTPUT_V2",
  ),
  candidateModule: exactPathSlotV2Schema(
    "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
    "candidate_application",
    "planned",
    "candidate-bundle/application/cli.js",
    "PATH_ROOT_CANDIDATE_RUNTIME_V2",
  ),
  historicalRejectedEntrypoints: z.tuple([
    exactPathSlotV2Schema(
      "PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2",
      "repository_source",
      "reject_only",
      "src/index.ts",
      "PATH_ROOT_NODE_SOURCE_V2",
    ),
  ]),
}).strict();

const ApiPathSlotSetIdentityV2Schema = z.object({
  schema: z.literal(NODE_EXECUTION_PATH_SLOT_SET_V2_SCHEMA),
  slotContractVersion: z.literal(NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2),
  roots: NodeExecutionPathRootsV2Schema,
  slotCount: z.literal(7),
  packageJson: PackageJsonPathSlotV2Schema,
  tsconfigJson: TsconfigJsonPathSlotV2Schema,
  sourceEntrypoint: exactPathSlotV2Schema(
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
    "repository_source",
    "planned",
    "src/app.ts",
    "PATH_ROOT_NODE_SOURCE_V2",
  ),
  buildOutput: exactPathSlotV2Schema(
    "PATH_SLOT_NODE_API_BUILD_OUTPUT_V2",
    "repository_build_output",
    "planned",
    "dist/app.js",
    "PATH_ROOT_NODE_BUILD_OUTPUT_V2",
  ),
  candidateModule: exactPathSlotV2Schema(
    "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
    "candidate_application",
    "planned",
    "candidate-bundle/application/app.js",
    "PATH_ROOT_CANDIDATE_RUNTIME_V2",
  ),
  historicalRejectedEntrypoints: z.tuple([
    exactPathSlotV2Schema(
      "PATH_SLOT_NODE_API_HISTORICAL_ROOT_SERVER_V2",
      "repository_source",
      "reject_only",
      "server.ts",
      "PATH_ROOT_NODE_REPOSITORY_V2",
    ),
    exactPathSlotV2Schema(
      "PATH_SLOT_NODE_API_HISTORICAL_SOURCE_SERVER_V2",
      "repository_source",
      "reject_only",
      "src/server.ts",
      "PATH_ROOT_NODE_SOURCE_V2",
    ),
  ]),
}).strict();

export type NodeExecutionPathSlotSetHashPayloadV2 =
  | z.infer<typeof CliPathSlotSetIdentityV2Schema>
  | z.infer<typeof ApiPathSlotSetIdentityV2Schema>;

export function hashNodeExecutionPathSlotSetV2(
  value: NodeExecutionPathSlotSetHashPayloadV2 | NodeExecutionPathSlotSetV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.slotSetHash;
  return hashCanonicalJson({
    schema: "setfarm.node-execution-path-slot-set-hash.v2",
    pathSlotSet: payload,
  });
}

const CliPathSlotSetV2Schema = CliPathSlotSetIdentityV2Schema.extend({
  slotSetHash: Sha256Schema,
}).strict();

const ApiPathSlotSetV2Schema = ApiPathSlotSetIdentityV2Schema.extend({
  slotSetHash: Sha256Schema,
}).strict();

export const NodeExecutionPathSlotSetV2Schema = z.discriminatedUnion(
  "slotCount",
  [CliPathSlotSetV2Schema, ApiPathSlotSetV2Schema],
).superRefine((value, context) => {
  if (value.slotSetHash === hashNodeExecutionPathSlotSetV2(value)) return;
  context.addIssue({
    code: "custom",
    path: ["slotSetHash"],
    message: "Node execution path-slot hash must bind every exact root and slot",
  });
});

export type NodeExecutionPathSlotSetV2 = z.infer<
  typeof NodeExecutionPathSlotSetV2Schema
>;

const LegacyAppShellRuleCommonV1Shape = {
  allowedRoles: z.tuple([z.literal("app_shell")]),
  kind: z.literal("single_file"),
  companionFiles: z.tuple([]),
} as const;

const CliLegacyInstallerExecutionObservationIdentityV1Schema = z.object({
  schema: z.literal(LEGACY_INSTALLER_EXECUTION_OBSERVATION_V1_SCHEMA),
  authorityKind: z.literal("compatibility_unmigrated"),
  productionUse: z.literal("forbidden"),
  stackPackId: z.literal("node-cli"),
  fileContractEntrypointLocators: z.tuple([
    z.literal("src/cli.ts"),
    z.literal("src/index.ts"),
  ]),
  appShellTargetRule: z.object({
    ruleId: z.literal("node-cli.app_shell"),
    template: z.literal("src/cli.ts"),
    ...LegacyAppShellRuleCommonV1Shape,
  }).strict(),
  sharedEntrypointLocators: z.tuple([
    z.literal("src/cli.ts"),
    z.literal("src/index.ts"),
  ]),
  topologyBuildOutputLocators: z.tuple([]),
  sourceDisposition: z.literal("canonical_matches_but_fallbacks_unmigrated"),
  buildOutputDisposition: z.literal("conflicts_with_v2_layout"),
  migrationOwner: z.literal("build_topology_v2_materializer"),
}).strict();

const ApiLegacyInstallerExecutionObservationIdentityV1Schema = z.object({
  schema: z.literal(LEGACY_INSTALLER_EXECUTION_OBSERVATION_V1_SCHEMA),
  authorityKind: z.literal("compatibility_unmigrated"),
  productionUse: z.literal("forbidden"),
  stackPackId: z.literal("node-express-api"),
  fileContractEntrypointLocators: z.tuple([
    z.literal("src/server.ts"),
    z.literal("src/app.ts"),
    z.literal("server.ts"),
  ]),
  appShellTargetRule: z.object({
    ruleId: z.literal("node-api.app_shell"),
    template: z.literal("src/server.ts"),
    ...LegacyAppShellRuleCommonV1Shape,
  }).strict(),
  sharedEntrypointLocators: z.tuple([
    z.literal("src/server.ts"),
    z.literal("src/app.ts"),
  ]),
  topologyBuildOutputLocators: z.tuple([z.literal("dist")]),
  sourceDisposition: z.literal("conflicts_with_v2_layout"),
  buildOutputDisposition: z.literal("matches_v2_layout"),
  migrationOwner: z.literal("build_topology_v2_materializer"),
}).strict();

export type LegacyInstallerExecutionObservationHashPayloadV1 =
  | z.infer<typeof CliLegacyInstallerExecutionObservationIdentityV1Schema>
  | z.infer<typeof ApiLegacyInstallerExecutionObservationIdentityV1Schema>;

export function hashLegacyInstallerExecutionObservationV1(
  value:
    | LegacyInstallerExecutionObservationHashPayloadV1
    | LegacyInstallerExecutionObservationV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.observationHash;
  return hashCanonicalJson({
    schema: "setfarm.legacy-installer-execution-observation-hash.v1",
    observation: payload,
  });
}

const CliLegacyInstallerExecutionObservationV1Schema =
  CliLegacyInstallerExecutionObservationIdentityV1Schema.extend({
    observationHash: Sha256Schema,
  }).strict();

const ApiLegacyInstallerExecutionObservationV1Schema =
  ApiLegacyInstallerExecutionObservationIdentityV1Schema.extend({
    observationHash: Sha256Schema,
  }).strict();

export const LegacyInstallerExecutionObservationV1Schema =
  z.discriminatedUnion("stackPackId", [
    CliLegacyInstallerExecutionObservationV1Schema,
    ApiLegacyInstallerExecutionObservationV1Schema,
  ]).superRefine((value, context) => {
    if (
      value.observationHash
      === hashLegacyInstallerExecutionObservationV1(value)
    ) return;
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Legacy installer observation hash must bind the exact compatibility facts",
    });
  });

export type LegacyInstallerExecutionObservationV1 = z.infer<
  typeof LegacyInstallerExecutionObservationV1Schema
>;

const LayoutCommonV2Shape = {
  schema: z.literal(NODE_EXECUTION_LAYOUT_V2_SCHEMA),
  layoutVersion: z.literal(NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2),
  readiness: ReadinessV2Schema,
  compilerContract: NodeCompilerContractV2Schema,
} as const;

const CliLayoutIdentityV2Schema = z.object({
  ...LayoutCommonV2Shape,
  layoutRef: z.literal(NODE_EXECUTION_LAYOUT_REFS_V2[0]),
  kind: z.literal("cli"),
  profileBinding: CliProfileBindingV2Schema,
  stackPackBinding: CliStackPackBindingV2Schema,
  pathSlots: CliPathSlotSetV2Schema,
  topologyBinding: CliTopologyBindingV2Schema,
  legacyInstallerObservation: CliLegacyInstallerExecutionObservationV1Schema,
  sourceToRuntime: CliSourceToRuntimeV2Schema,
  runtimeTarget: CliRuntimeTargetV2Schema,
}).strict();

const ApiLayoutIdentityV2Schema = z.object({
  ...LayoutCommonV2Shape,
  layoutRef: z.literal(NODE_EXECUTION_LAYOUT_REFS_V2[1]),
  kind: z.literal("http_handler"),
  profileBinding: ApiProfileBindingV2Schema,
  stackPackBinding: ApiStackPackBindingV2Schema,
  pathSlots: ApiPathSlotSetV2Schema,
  topologyBinding: ApiTopologyBindingV2Schema,
  legacyInstallerObservation: ApiLegacyInstallerExecutionObservationV1Schema,
  sourceToRuntime: ApiSourceToRuntimeV2Schema,
  runtimeTarget: ApiRuntimeTargetV2Schema,
}).strict();

export type NodeExecutionLayoutHashPayloadV2 =
  | z.infer<typeof CliLayoutIdentityV2Schema>
  | z.infer<typeof ApiLayoutIdentityV2Schema>;

export function hashNodeExecutionLayoutV2(
  value: NodeExecutionLayoutHashPayloadV2 | NodeExecutionLayoutV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.layoutHash;
  return hashCanonicalJson({
    schema: "setfarm.node-execution-layout-hash.v2",
    layout: payload,
  });
}

const CliLayoutV2Schema = CliLayoutIdentityV2Schema.extend({
  layoutHash: Sha256Schema,
}).strict();

const ApiLayoutV2Schema = ApiLayoutIdentityV2Schema.extend({
  layoutHash: Sha256Schema,
}).strict();

export const NodeExecutionLayoutV2Schema = z.discriminatedUnion("kind", [
  CliLayoutV2Schema,
  ApiLayoutV2Schema,
]).superRefine((value, context) => {
  if (value.pathSlots.slotSetHash !== hashNodeExecutionPathSlotSetV2(value.pathSlots)) {
    context.addIssue({
      code: "custom",
      path: ["pathSlots", "slotSetHash"],
      message: "Embedded path-slot hash must bind the complete exact slot closure",
    });
  }
  if (
    value.legacyInstallerObservation.observationHash
    !== hashLegacyInstallerExecutionObservationV1(
      value.legacyInstallerObservation,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["legacyInstallerObservation", "observationHash"],
      message: "Embedded legacy installer observation hash must bind its exact compatibility facts",
    });
  }
  if (value.layoutHash !== hashNodeExecutionLayoutV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["layoutHash"],
      message: "Node execution layout hash must bind the complete exact layout",
    });
  }
});

export type NodeExecutionLayoutV2 = z.infer<typeof NodeExecutionLayoutV2Schema>;

const NodeExecutionLayoutCatalogContentV2Schema = z.object({
  schema: z.literal(NODE_EXECUTION_LAYOUT_CATALOG_V2_SCHEMA),
  catalogVersion: z.literal(NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2),
  readiness: ReadinessV2Schema,
  layoutCount: z.literal(NODE_EXECUTION_LAYOUT_REFS_V2.length),
  layouts: z.array(NodeExecutionLayoutV2Schema)
    .length(NODE_EXECUTION_LAYOUT_REFS_V2.length),
  catalogHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const layoutRefs = value.layouts.map((layout) => layout.layoutRef);
  const profileIds = value.layouts.map((layout) => layout.profileBinding.profileId);
  const stackPackIds = value.layouts.map((layout) => layout.stackPackBinding.stackPackId);
  if (
    canonicalJsonStringify(layoutRefs)
      !== canonicalJsonStringify(NODE_EXECUTION_LAYOUT_REFS_V2)
    || !hasUniqueStrings(profileIds)
    || !hasUniqueStrings(stackPackIds)
  ) {
    context.addIssue({
      code: "custom",
      path: ["layouts"],
      message: "Node layout catalog must contain every exact layout once in canonical order",
    });
  }
  if (value.catalogHash !== hashNodeExecutionLayoutCatalogV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["catalogHash"],
      message: "Node layout catalog hash must bind the complete exact catalog",
    });
  }
});

export type NodeExecutionLayoutCatalogV2 = z.infer<
  typeof NodeExecutionLayoutCatalogContentV2Schema
>;

export function hashNodeExecutionLayoutCatalogV2(
  value:
    | Omit<NodeExecutionLayoutCatalogV2, "catalogHash">
    | NodeExecutionLayoutCatalogV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: "setfarm.node-execution-layout-catalog-hash.v2",
    catalog: payload,
  });
}

const BoundedNodeExecutionLayoutCatalogV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: NODE_EXECUTION_LAYOUT_CATALOG_MAX_CANONICAL_BYTES_V2,
        ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: `Node layout catalog must fit ${NODE_EXECUTION_LAYOUT_CATALOG_MAX_CANONICAL_BYTES_V2} canonical bytes and bounded work`,
      });
    }
  });

export const NodeExecutionLayoutCatalogV2Schema =
  BoundedNodeExecutionLayoutCatalogV2Schema.pipe(
    NodeExecutionLayoutCatalogContentV2Schema,
  );
