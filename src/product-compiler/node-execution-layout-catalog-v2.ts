import { z } from "zod";

import {
  getStackPack,
} from "../installer/stack-contract/packs.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
  type CanonicalJsonBoundedLimits,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  ProductDeliverySelectionV2Schema,
  ProductDeliverySelectionVerificationErrorV2,
  getProductDeliveryProfileCatalogV2,
  hashProductDeliverySelectionV2,
  verifyProductDeliverySelectionV2,
  type ProductDeliveryProfileV2,
  type ProductDeliverySelectionV2,
} from "./product-delivery-profile-catalog-v2.js";
import {
  NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2,
  NODE_EXECUTION_LAYOUT_CATALOG_V2_SCHEMA,
  NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2,
  NODE_EXECUTION_LAYOUT_REFS_V2,
  NODE_EXECUTION_LAYOUT_V2_SCHEMA,
  NODE_EXECUTION_PATH_SLOT_SET_V2_SCHEMA,
  LegacyInstallerExecutionObservationV1Schema,
  NodeExecutionLayoutCatalogV2Schema,
  NodeExecutionPathSlotSetV2Schema,
  NodeExecutionLayoutV2Schema,
  hashNodeExecutionPathSlotSetV2,
  hashNodeExecutionLayoutCatalogV2,
  hashNodeExecutionLayoutV2,
  hashLegacyInstallerExecutionObservationV1,
  type LegacyInstallerExecutionObservationHashPayloadV1,
  type LegacyInstallerExecutionObservationV1,
  type NodeExecutionLayoutCatalogV2,
  type NodeExecutionLayoutHashPayloadV2,
  type NodeExecutionLayoutV2,
  type NodeExecutionPathSlotSetHashPayloadV2,
  type NodeExecutionPathSlotSetV2,
} from "./schemas/node-execution-layout-catalog-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import {
  getStackTopologyCatalogContract,
  type StackTopologyCatalogContractV1,
} from "./stack-topology-catalog.js";

const RESOLUTION_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const VERIFICATION_INPUT_MAX_BYTES = 9 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

/*
 * A delivery selection is a separately validated bounded authority beside the
 * largest ProductSpec admitted by ProfileV2. Keep resolver work compositional
 * so attaching that selection cannot make an otherwise admitted ProductSpec
 * fail only because the outer envelope has a few more nodes.
 */
const RESOLUTION_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 4,
  maxNodes: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes + 16_384,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits
    + (2 * 1024 * 1024),
});

const VERIFICATION_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 4,
  maxNodes: (DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes * 2) + 8,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits * 2)
    + (1024 * 1024),
});

const EXPECTED_PROFILE_CATALOG_AUTHORITY_V2 = Object.freeze({
  catalogVersion: "2.0.0",
  catalogHash: "760ba13088fc10bd631835feb071b7f56ed851f49766ce657055727065d16a5f",
  profiles: Object.freeze([
    Object.freeze({
      id: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      profileHash: "e57f520d4bb71bfea2907f8858f6e40772c6355109d43d74d139ee1e9592ea3f",
      stackPackId: "node-cli",
      stackPackVersion: "1.6.0",
      stackPackContentHash:
        "5ad5e6bdc56a2a970c03897a4e205b75166e5edf83a5168ce6526f2f397693d3",
      launcherRef: "LAUNCH_NODE_CLI_V2",
    }),
    Object.freeze({
      id: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      profileHash: "b7c78f2585b22c8720c321c4c311be62f039ed6f6d6527cae139cea7a98cded1",
      stackPackId: "node-express-api",
      stackPackVersion: "1.6.0",
      stackPackContentHash:
        "7dec84cecdf4f3400fa9e10559cfe7d94fe11bac81132bbfdc9158afdccdbdc4",
      launcherRef: "LAUNCH_NODE_EXPRESS_API_V2",
    }),
  ]),
});

const EXPECTED_NODE_EXECUTION_LAYOUT_IDENTITY_V2 = Object.freeze({
  catalogVersion: "2.0.0",
  layoutHashes: Object.freeze([
    Object.freeze({
      layoutRef: "NODE_EXECUTION_LAYOUT_NODE_CLI_V2",
      layoutHash: "fe6e7edaf8dee936d9e8de9ad585003541c18d88f7fac7a407ffde777cbe1d4d",
    }),
    Object.freeze({
      layoutRef: "NODE_EXECUTION_LAYOUT_NODE_EXPRESS_API_V2",
      layoutHash: "684cc97834ae6e470b218bac7b4eb319a856ad2d30f5cdf5cf3189736dc8aef7",
    }),
  ]),
  catalogHash: "22ea7647900849bde998b4b24d520f281e28d81aecc1e05feff4088da367dc57",
});

const EXPECTED_TOPOLOGY_ENTRYPOINT_RULES_V2 = Object.freeze({
  "node-cli": Object.freeze([
    Object.freeze({
      id: "ENTRY_RULE_NODE_CLI",
      entrypointKind: "cli",
      selectionPriority: 10,
      mountPoint: "command",
      matcher: Object.freeze({ kind: "exact", path: "src/cli.ts" }),
    }),
    Object.freeze({
      id: "ENTRY_RULE_NODE_INDEX",
      entrypointKind: "cli",
      selectionPriority: 20,
      mountPoint: "command",
      matcher: Object.freeze({ kind: "exact", path: "src/index.ts" }),
    }),
  ]),
  "node-express-api": Object.freeze([
    Object.freeze({
      id: "ENTRY_RULE_NODE_SERVER",
      entrypointKind: "api",
      selectionPriority: 10,
      mountPoint: "/",
      matcher: Object.freeze({ kind: "exact", path: "src/server.ts" }),
    }),
    Object.freeze({
      id: "ENTRY_RULE_NODE_APP",
      entrypointKind: "api",
      selectionPriority: 20,
      mountPoint: "/",
      matcher: Object.freeze({ kind: "exact", path: "src/app.ts" }),
    }),
    Object.freeze({
      id: "ENTRY_RULE_NODE_ROOT_SERVER",
      entrypointKind: "api",
      selectionPriority: 30,
      mountPoint: "/",
      matcher: Object.freeze({ kind: "exact", path: "server.ts" }),
    }),
  ]),
});

const EXPECTED_BUILD_COMMAND_V2 = Object.freeze({
  id: "CMD_BUILD",
  kind: "build",
  argv: Object.freeze(["npm", "run", "build"]),
  cwd: ".",
  timeoutMs: 120_000,
  capabilityRefs: Object.freeze([]),
});

const NODE_COMPILER_CONTRACT_V2: NodeExecutionLayoutHashPayloadV2["compilerContract"] = Object.freeze({
  packageJsonPathSlotRef: "PATH_SLOT_NODE_PACKAGE_JSON_V2",
  packageType: "module",
  packageBuildScriptName: "build",
  compilerExecutable: "tsc",
  compilerArguments: [
    { kind: "literal", value: "-p" },
    {
      kind: "path_slot",
      pathSlotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
    },
  ] as [
    { kind: "literal"; value: "-p" },
    {
      kind: "path_slot";
      pathSlotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2";
    },
  ],
  tsconfigPathSlotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
  target: "ES2022",
  module: "NodeNext",
  moduleResolution: "NodeNext",
  sourceRootRef: "PATH_ROOT_NODE_SOURCE_V2",
  outputRootRef: "PATH_ROOT_NODE_BUILD_OUTPUT_V2",
  noEmitOnError: true,
});

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

function boundedSnapshot(
  value: unknown,
  maxBytes: number,
  workLimits: Omit<CanonicalJsonBoundedLimits, "maxBytes"> =
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...workLimits,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "Invalid bounded canonical JSON input";
}

export class NodeExecutionLayoutCodeAuthorityErrorV2 extends Error {
  readonly code = "NODE_EXECUTION_LAYOUT_V2_CODE_AUTHORITY_DRIFT" as const;

  constructor(message: string) {
    super(message);
    this.name = "NodeExecutionLayoutCodeAuthorityErrorV2";
  }
}

function requireExactCodeAuthority(
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  if (canonicalJsonStringify(actual) === canonicalJsonStringify(expected)) return;
  throw new NodeExecutionLayoutCodeAuthorityErrorV2(
    `${label} no longer equals the versioned NodeExecutionLayoutCatalogV2 authority`,
  );
}

function requireTopology(
  stackPackId: "node-cli" | "node-express-api",
  expectedIdentity: Readonly<{
    stackPackVersion: string;
    stackPackContentHash: string;
  }>,
): StackTopologyCatalogContractV1 {
  const topology = getStackTopologyCatalogContract(stackPackId);
  if (!topology) {
    throw new NodeExecutionLayoutCodeAuthorityErrorV2(
      `${stackPackId} topology is absent`,
    );
  }
  requireExactCodeAuthority(`${stackPackId} topology identity`, topology.identity, {
    id: stackPackId,
    version: expectedIdentity.stackPackVersion,
    contentHash: expectedIdentity.stackPackContentHash,
  });
  requireExactCodeAuthority(
    `${stackPackId} entrypoint rules`,
    topology.descriptor.entrypointRules,
    EXPECTED_TOPOLOGY_ENTRYPOINT_RULES_V2[stackPackId],
  );
  const buildCommands = topology.descriptor.commands.filter((command) =>
    command.id === "CMD_BUILD");
  requireExactCodeAuthority(
    `${stackPackId} build command`,
    buildCommands,
    [EXPECTED_BUILD_COMMAND_V2],
  );
  return topology;
}

function profileAuthorityProjection(profile: ProductDeliveryProfileV2) {
  return {
    id: profile.id,
    profileHash: profile.profileHash,
    stackPackId: profile.stackPackBinding.stackPackId,
    stackPackVersion: profile.stackPackBinding.stackPackVersion,
    stackPackContentHash: profile.stackPackBinding.stackPackContentHash,
    launcherRef: profile.runtime.launcherRef,
  };
}

function withLayoutHash(
  value: NodeExecutionLayoutHashPayloadV2,
): NodeExecutionLayoutV2 {
  return NodeExecutionLayoutV2Schema.parse({
    ...value,
    layoutHash: hashNodeExecutionLayoutV2(value),
  });
}

function withPathSlotSetHash(
  value: NodeExecutionPathSlotSetHashPayloadV2,
): NodeExecutionPathSlotSetV2 {
  return NodeExecutionPathSlotSetV2Schema.parse({
    ...value,
    slotSetHash: hashNodeExecutionPathSlotSetV2(value),
  });
}

function nodeExecutionPathRootsV2() {
  return {
    repository: {
      rootRef: "PATH_ROOT_NODE_REPOSITORY_V2" as const,
      physicalSpace: "repository" as const,
      locatorPrefix: "" as const,
    },
    source: {
      rootRef: "PATH_ROOT_NODE_SOURCE_V2" as const,
      physicalSpace: "repository" as const,
      parentRootRef: "PATH_ROOT_NODE_REPOSITORY_V2" as const,
      locatorPrefix: "src" as const,
    },
    buildOutput: {
      rootRef: "PATH_ROOT_NODE_BUILD_OUTPUT_V2" as const,
      physicalSpace: "repository" as const,
      parentRootRef: "PATH_ROOT_NODE_REPOSITORY_V2" as const,
      locatorPrefix: "dist" as const,
    },
    candidateRuntime: {
      rootRef: "PATH_ROOT_CANDIDATE_RUNTIME_V2" as const,
      physicalSpace: "candidate_runtime" as const,
      locatorPrefix: "" as const,
    },
  };
}

function commonNodePathSlotsV2() {
  return {
    packageJson: {
      slotRef: "PATH_SLOT_NODE_PACKAGE_JSON_V2" as const,
      namespace: "repository_config" as const,
      disposition: "planned" as const,
      nodeKind: "file" as const,
      locator: "package.json" as const,
      underRootRef: "PATH_ROOT_NODE_REPOSITORY_V2" as const,
    },
    tsconfigJson: {
      slotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2" as const,
      namespace: "repository_config" as const,
      disposition: "planned" as const,
      nodeKind: "file" as const,
      locator: "tsconfig.json" as const,
      underRootRef: "PATH_ROOT_NODE_REPOSITORY_V2" as const,
    },
  };
}

function buildLegacyInstallerExecutionObservationV1(
  stackPackId: "node-cli" | "node-express-api",
  topology: StackTopologyCatalogContractV1,
): LegacyInstallerExecutionObservationV1 {
  const pack = getStackPack(stackPackId);
  const appShellTargetRule = pack.targetResolutionRules?.app_shell;
  const entrypointLocators = pack.fileContract.entrypoints;
  const entrypointSet = new Set(entrypointLocators);
  const sharedEntrypointLocators = (
    pack.implementationBoundaries?.sharedFiles ?? []
  ).filter((locator) => entrypointSet.has(locator));
  const observedLegacyFacts = {
    fileContractEntrypointLocators: entrypointLocators,
    appShellTargetRule,
    sharedEntrypointLocators,
    topologyBuildOutputLocators: topology.descriptor.buildOutputPaths,
  };
  const identity: LegacyInstallerExecutionObservationHashPayloadV1 =
    stackPackId === "node-cli"
      ? {
          schema: "setfarm.legacy-installer-execution-observation.v1",
          authorityKind: "compatibility_unmigrated",
          productionUse: "forbidden",
          stackPackId,
          fileContractEntrypointLocators: ["src/cli.ts", "src/index.ts"],
          appShellTargetRule: {
            ruleId: "node-cli.app_shell",
            template: "src/cli.ts",
            allowedRoles: ["app_shell"],
            kind: "single_file",
            companionFiles: [],
          },
          sharedEntrypointLocators: ["src/cli.ts", "src/index.ts"],
          topologyBuildOutputLocators: [],
          sourceDisposition: "canonical_matches_but_fallbacks_unmigrated",
          buildOutputDisposition: "conflicts_with_v2_layout",
          migrationOwner: "build_topology_v2_materializer",
        }
      : {
          schema: "setfarm.legacy-installer-execution-observation.v1",
          authorityKind: "compatibility_unmigrated",
          productionUse: "forbidden",
          stackPackId,
          fileContractEntrypointLocators: [
            "src/server.ts",
            "src/app.ts",
            "server.ts",
          ],
          appShellTargetRule: {
            ruleId: "node-api.app_shell",
            template: "src/server.ts",
            allowedRoles: ["app_shell"],
            kind: "single_file",
            companionFiles: [],
          },
          sharedEntrypointLocators: ["src/server.ts", "src/app.ts"],
          topologyBuildOutputLocators: ["dist"],
          sourceDisposition: "conflicts_with_v2_layout",
          buildOutputDisposition: "matches_v2_layout",
          migrationOwner: "build_topology_v2_materializer",
        };
  requireExactCodeAuthority(
    `${stackPackId} legacy installer execution facts`,
    observedLegacyFacts,
    {
      fileContractEntrypointLocators: identity.fileContractEntrypointLocators,
      appShellTargetRule: identity.appShellTargetRule,
      sharedEntrypointLocators: identity.sharedEntrypointLocators,
      topologyBuildOutputLocators: identity.topologyBuildOutputLocators,
    },
  );
  return LegacyInstallerExecutionObservationV1Schema.parse({
    ...identity,
    observationHash: hashLegacyInstallerExecutionObservationV1(identity),
  });
}

function buildCodeOwnedNodeExecutionLayoutCatalogV2(): NodeExecutionLayoutCatalogV2 {
  const profileCatalog = getProductDeliveryProfileCatalogV2();
  requireExactCodeAuthority("ProfileV2 catalog identity", {
    catalogVersion: profileCatalog.catalogVersion,
    catalogHash: profileCatalog.catalogHash,
    profiles: profileCatalog.profiles.map(profileAuthorityProjection),
  }, EXPECTED_PROFILE_CATALOG_AUTHORITY_V2);

  const cliProfile = profileCatalog.profiles[0]!;
  const apiProfile = profileCatalog.profiles[1]!;
  const cliTopology = requireTopology(
    "node-cli",
    EXPECTED_PROFILE_CATALOG_AUTHORITY_V2.profiles[0],
  );
  const apiTopology = requireTopology(
    "node-express-api",
    EXPECTED_PROFILE_CATALOG_AUTHORITY_V2.profiles[1],
  );
  const readiness = {
    status: "shadow" as const,
    productionUse: "forbidden" as const,
    blockerCodes: [...NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2],
  };
  const cliLegacyInstallerObservation =
    buildLegacyInstallerExecutionObservationV1("node-cli", cliTopology);
  const apiLegacyInstallerObservation =
    buildLegacyInstallerExecutionObservationV1("node-express-api", apiTopology);
  if (
    cliLegacyInstallerObservation.stackPackId !== "node-cli"
    || apiLegacyInstallerObservation.stackPackId !== "node-express-api"
  ) {
    throw new NodeExecutionLayoutCodeAuthorityErrorV2(
      "Legacy installer observation discriminants do not match Node profiles",
    );
  }
  const commonPathSlots = commonNodePathSlotsV2();
  const cliPathSlots = withPathSlotSetHash({
    schema: NODE_EXECUTION_PATH_SLOT_SET_V2_SCHEMA,
    slotContractVersion: NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2,
    roots: nodeExecutionPathRootsV2(),
    slotCount: 6,
    ...commonPathSlots,
    sourceEntrypoint: {
      slotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
      namespace: "repository_source",
      disposition: "planned",
      nodeKind: "file",
      locator: "src/cli.ts",
      underRootRef: "PATH_ROOT_NODE_SOURCE_V2",
    },
    buildOutput: {
      slotRef: "PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2",
      namespace: "repository_build_output",
      disposition: "planned",
      nodeKind: "file",
      locator: "dist/cli.js",
      underRootRef: "PATH_ROOT_NODE_BUILD_OUTPUT_V2",
    },
    candidateModule: {
      slotRef: "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
      namespace: "candidate_application",
      disposition: "planned",
      nodeKind: "file",
      locator: "candidate-bundle/application/cli.js",
      underRootRef: "PATH_ROOT_CANDIDATE_RUNTIME_V2",
    },
    historicalRejectedEntrypoints: [{
      slotRef: "PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2",
      namespace: "repository_source",
      disposition: "reject_only",
      nodeKind: "file",
      locator: "src/index.ts",
      underRootRef: "PATH_ROOT_NODE_SOURCE_V2",
    }],
  });
  const apiPathSlots = withPathSlotSetHash({
    schema: NODE_EXECUTION_PATH_SLOT_SET_V2_SCHEMA,
    slotContractVersion: NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2,
    roots: nodeExecutionPathRootsV2(),
    slotCount: 7,
    ...commonPathSlots,
    sourceEntrypoint: {
      slotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
      namespace: "repository_source",
      disposition: "planned",
      nodeKind: "file",
      locator: "src/app.ts",
      underRootRef: "PATH_ROOT_NODE_SOURCE_V2",
    },
    buildOutput: {
      slotRef: "PATH_SLOT_NODE_API_BUILD_OUTPUT_V2",
      namespace: "repository_build_output",
      disposition: "planned",
      nodeKind: "file",
      locator: "dist/app.js",
      underRootRef: "PATH_ROOT_NODE_BUILD_OUTPUT_V2",
    },
    candidateModule: {
      slotRef: "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
      namespace: "candidate_application",
      disposition: "planned",
      nodeKind: "file",
      locator: "candidate-bundle/application/app.js",
      underRootRef: "PATH_ROOT_CANDIDATE_RUNTIME_V2",
    },
    historicalRejectedEntrypoints: [
      {
        slotRef: "PATH_SLOT_NODE_API_HISTORICAL_ROOT_SERVER_V2",
        namespace: "repository_source",
        disposition: "reject_only",
        nodeKind: "file",
        locator: "server.ts",
        underRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
      },
      {
        slotRef: "PATH_SLOT_NODE_API_HISTORICAL_SOURCE_SERVER_V2",
        namespace: "repository_source",
        disposition: "reject_only",
        nodeKind: "file",
        locator: "src/server.ts",
        underRootRef: "PATH_ROOT_NODE_SOURCE_V2",
      },
    ],
  });
  if (cliPathSlots.slotCount !== 6 || apiPathSlots.slotCount !== 7) {
    throw new NodeExecutionLayoutCodeAuthorityErrorV2(
      "Node path-slot discriminants do not match Node profiles",
    );
  }

  const cliLayout = withLayoutHash({
    schema: NODE_EXECUTION_LAYOUT_V2_SCHEMA,
    layoutVersion: NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2,
    layoutRef: NODE_EXECUTION_LAYOUT_REFS_V2[0],
    kind: "cli",
    profileBinding: {
      catalogVersion: profileCatalog.catalogVersion,
      catalogHash: profileCatalog.catalogHash,
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      profileHash: cliProfile.profileHash,
      launcherRef: "LAUNCH_NODE_CLI_V2",
    },
    stackPackBinding: {
      stackPackId: "node-cli",
      stackPackVersion: cliTopology.identity.version,
      stackPackContentHash: cliTopology.identity.contentHash,
    },
    pathSlots: cliPathSlots,
    topologyBinding: {
      canonicalEntrypointRuleRef: "ENTRY_RULE_NODE_CLI",
      canonicalEntrypointKind: "cli",
      canonicalEntrypointPathSlotRef:
        "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
      historicalEntrypointPathSlotRefs: [
        "PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2",
      ],
      buildCommand: {
        commandRef: "CMD_BUILD",
        commandKind: "build",
        cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
        directArgv: ["npm", "run", "build"],
      },
    },
    legacyInstallerObservation: cliLegacyInstallerObservation,
    compilerContract: NODE_COMPILER_CONTRACT_V2,
    sourceToRuntime: {
      sourcePathSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
      buildOutputPathSlotRef: "PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2",
      candidateModulePathSlotRef:
        "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
      sourceMediaType: "text/typescript",
      outputMediaType: "text/javascript",
      moduleSystem: "node_esm",
    },
    runtimeTarget: {
      kind: "cli",
      entrypointAbi: "NODE_ESM_CLI_ENTRYPOINT_ABI_V2",
      argvOwnership: "executable_invocation_transport_binding_v2",
      nodeOptionTokens: [],
      moduleArgumentPathSlotRef:
        "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
      transportArguments: "append_after_module",
    },
    readiness,
  });

  const apiLayout = withLayoutHash({
    schema: NODE_EXECUTION_LAYOUT_V2_SCHEMA,
    layoutVersion: NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2,
    layoutRef: NODE_EXECUTION_LAYOUT_REFS_V2[1],
    kind: "http_handler",
    profileBinding: {
      catalogVersion: profileCatalog.catalogVersion,
      catalogHash: profileCatalog.catalogHash,
      profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      profileHash: apiProfile.profileHash,
      launcherRef: "LAUNCH_NODE_EXPRESS_API_V2",
    },
    stackPackBinding: {
      stackPackId: "node-express-api",
      stackPackVersion: apiTopology.identity.version,
      stackPackContentHash: apiTopology.identity.contentHash,
    },
    pathSlots: apiPathSlots,
    topologyBinding: {
      canonicalEntrypointRuleRef: "ENTRY_RULE_NODE_APP",
      canonicalEntrypointKind: "api",
      canonicalEntrypointPathSlotRef:
        "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
      historicalEntrypointPathSlotRefs: [
        "PATH_SLOT_NODE_API_HISTORICAL_ROOT_SERVER_V2",
        "PATH_SLOT_NODE_API_HISTORICAL_SOURCE_SERVER_V2",
      ],
      buildCommand: {
        commandRef: "CMD_BUILD",
        commandKind: "build",
        cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
        directArgv: ["npm", "run", "build"],
      },
    },
    legacyInstallerObservation: apiLegacyInstallerObservation,
    compilerContract: NODE_COMPILER_CONTRACT_V2,
    sourceToRuntime: {
      sourcePathSlotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
      buildOutputPathSlotRef: "PATH_SLOT_NODE_API_BUILD_OUTPUT_V2",
      candidateModulePathSlotRef:
        "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
      sourceMediaType: "text/typescript",
      outputMediaType: "text/javascript",
      moduleSystem: "node_esm",
    },
    runtimeTarget: {
      kind: "http_handler",
      modulePathSlotRef: "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
      exportName: "setfarmHttpHandlerV2",
      handlerAbi: "EXPRESS_REQUEST_HANDLER_ABI_V2",
      serverOwnership: "platform_owned",
      listenerOwnership: "platform_owned",
      socketOwnership: "platform_owned",
      candidateListen: "forbidden",
    },
    readiness,
  });

  const withoutHash = {
    schema: NODE_EXECUTION_LAYOUT_CATALOG_V2_SCHEMA,
    catalogVersion: NODE_EXECUTION_LAYOUT_CATALOG_VERSION_V2,
    readiness,
    layoutCount: NODE_EXECUTION_LAYOUT_REFS_V2.length,
    layouts: [cliLayout, apiLayout],
  };
  const parsed = NodeExecutionLayoutCatalogV2Schema.safeParse({
    ...withoutHash,
    catalogHash: hashNodeExecutionLayoutCatalogV2(withoutHash),
  });
  if (!parsed.success) {
    throw new NodeExecutionLayoutCodeAuthorityErrorV2(
      parsed.error.issues[0]?.message
      ?? "Code-owned NodeExecutionLayoutCatalogV2 is invalid",
    );
  }
  requireExactCodeAuthority("NodeExecutionLayoutCatalogV2 own version identity", {
    catalogVersion: parsed.data.catalogVersion,
    layoutHashes: parsed.data.layouts.map((layout) => ({
      layoutRef: layout.layoutRef,
      layoutHash: layout.layoutHash,
    })),
    catalogHash: parsed.data.catalogHash,
  }, EXPECTED_NODE_EXECUTION_LAYOUT_IDENTITY_V2);
  return deepFreezeJson(parsed.data);
}

export function getCodeOwnedNodeExecutionLayoutCatalogV2(): NodeExecutionLayoutCatalogV2 {
  return buildCodeOwnedNodeExecutionLayoutCatalogV2();
}

export function nodeExecutionLayoutCatalogHashV2(): string {
  return buildCodeOwnedNodeExecutionLayoutCatalogV2().catalogHash;
}

export function getCodeOwnedNodeExecutionLayoutV2(
  profileId: string,
): NodeExecutionLayoutV2 | null {
  return buildCodeOwnedNodeExecutionLayoutCatalogV2().layouts.find((layout) =>
    layout.profileBinding.profileId === profileId) ?? null;
}

export type NodeExecutionLayoutCatalogVerificationErrorCodeV2 =
  | "NODE_EXECUTION_LAYOUT_CATALOG_V2_CANDIDATE_INVALID"
  | "NODE_EXECUTION_LAYOUT_CATALOG_V2_AUTHORITY_MISMATCH"
  | "NODE_EXECUTION_LAYOUT_CATALOG_V2_CODE_AUTHORITY_DRIFT";

export class NodeExecutionLayoutCatalogVerificationErrorV2 extends Error {
  readonly code: NodeExecutionLayoutCatalogVerificationErrorCodeV2;

  constructor(
    code: NodeExecutionLayoutCatalogVerificationErrorCodeV2,
    message: string,
  ) {
    super(message);
    this.name = "NodeExecutionLayoutCatalogVerificationErrorV2";
    this.code = code;
  }
}

export function verifyNodeExecutionLayoutCatalogV2(
  candidate: unknown,
): NodeExecutionLayoutCatalogV2 {
  const parsed = NodeExecutionLayoutCatalogV2Schema.safeParse(candidate);
  if (!parsed.success) {
    throw new NodeExecutionLayoutCatalogVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_CATALOG_V2_CANDIDATE_INVALID",
      parsed.error.issues[0]?.message ?? "Layout catalog candidate is invalid",
    );
  }
  let reproduced: NodeExecutionLayoutCatalogV2;
  try {
    reproduced = buildCodeOwnedNodeExecutionLayoutCatalogV2();
  } catch (error) {
    throw new NodeExecutionLayoutCatalogVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_CATALOG_V2_CODE_AUTHORITY_DRIFT",
      errorMessage(error),
    );
  }
  if (canonicalJsonStringify(parsed.data) !== canonicalJsonStringify(reproduced)) {
    throw new NodeExecutionLayoutCatalogVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_CATALOG_V2_AUTHORITY_MISMATCH",
      "Layout catalog candidate does not equal fresh code-owned profile/topology authority",
    );
  }
  return reproduced;
}

export type NodeExecutionLayoutResolutionDiagnosticCodeV2 =
  | "NODE_EXECUTION_LAYOUT_V2_INPUT_INVALID"
  | "NODE_EXECUTION_LAYOUT_V2_PRODUCT_SPEC_INVALID"
  | "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_INVALID"
  | "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH"
  | "NODE_EXECUTION_LAYOUT_V2_CODE_AUTHORITY_DRIFT"
  | "NODE_EXECUTION_LAYOUT_V2_LAYOUT_UNRESOLVED"
  | "NODE_EXECUTION_LAYOUT_V2_LAYOUT_AUTHORITY_MISMATCH";

export type NodeExecutionLayoutResolutionDiagnosticV2 = Readonly<{
  code: NodeExecutionLayoutResolutionDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type NodeExecutionLayoutResolutionResultV2 =
  | Readonly<{
      status: "shadow_resolved";
      diagnostics: readonly [];
      layout: Readonly<NodeExecutionLayoutV2>;
      catalogHash: string;
      layoutHash: string;
      deliverySelectionHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly NodeExecutionLayoutResolutionDiagnosticV2[];
    }>;

function diagnostic(
  code: NodeExecutionLayoutResolutionDiagnosticCodeV2,
  path: string,
  message: string,
): NodeExecutionLayoutResolutionDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 500),
    message: message.slice(0, 1_000),
  });
}

function rejected(
  code: NodeExecutionLayoutResolutionDiagnosticCodeV2,
  path: string,
  message: string,
): NodeExecutionLayoutResolutionResultV2 {
  return deepFreezeJson({
    status: "rejected" as const,
    diagnostics: [diagnostic(code, path, message)].slice(0, MAX_DIAGNOSTICS),
  });
}

function diagnosticsFromZod(
  code: NodeExecutionLayoutResolutionDiagnosticCodeV2,
  error: z.ZodError,
  pathPrefix: string,
): NodeExecutionLayoutResolutionResultV2 {
  const diagnostics = error.issues.slice(0, MAX_DIAGNOSTICS - 1).map((issue) =>
    diagnostic(
      code,
      `${pathPrefix}/${issue.path.map(String).join("/")}`.replace(/\/$/u, "") || "/",
      issue.message,
    ));
  if (error.issues.length >= MAX_DIAGNOSTICS) {
    diagnostics.push(diagnostic(
      code,
      pathPrefix || "/",
      `Validation produced ${error.issues.length} issues; retained the first ${MAX_DIAGNOSTICS - 1}`,
    ));
  }
  return deepFreezeJson({ status: "rejected" as const, diagnostics });
}

const ResolutionInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
}).strict();

const VerificationInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  candidate: z.unknown(),
}).strict();

function exactSelection(
  productSpec: ProductSpecV2,
  candidate: unknown,
):
  | Readonly<{ status: "verified"; selection: ProductDeliverySelectionV2 }>
  | Readonly<{
      status: "rejected";
      code:
        | "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_INVALID"
        | "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH";
      message: string;
    }> {
  const parsed = ProductDeliverySelectionV2Schema.safeParse(candidate);
  if (!parsed.success) {
    return {
      status: "rejected",
      code: "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_INVALID",
      message: parsed.error.issues[0]?.message ?? "Delivery selection is invalid",
    };
  }
  try {
    return {
      status: "verified",
      selection: verifyProductDeliverySelectionV2({
        productSpec,
        requestedStackPackId: parsed.data.requestedStackPackId,
        candidate: parsed.data,
      }),
    };
  } catch (error) {
    return {
      status: "rejected",
      code: error instanceof ProductDeliverySelectionVerificationErrorV2
        && error.code === "PRODUCT_DELIVERY_V2_SELECTION_INVALID"
        ? "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_INVALID"
        : "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH",
      message: errorMessage(error),
    };
  }
}

function layoutMatchesSelection(
  layout: NodeExecutionLayoutV2,
  selection: ProductDeliverySelectionV2,
): boolean {
  return canonicalJsonStringify({
    catalogVersion: layout.profileBinding.catalogVersion,
    catalogHash: layout.profileBinding.catalogHash,
    profileId: layout.profileBinding.profileId,
    profileHash: layout.profileBinding.profileHash,
    launcherRef: layout.profileBinding.launcherRef,
    stackPackId: layout.stackPackBinding.stackPackId,
    stackPackVersion: layout.stackPackBinding.stackPackVersion,
    stackPackContentHash: layout.stackPackBinding.stackPackContentHash,
  }) === canonicalJsonStringify({
    catalogVersion: selection.catalogVersion,
    catalogHash: selection.catalogHash,
    profileId: selection.profileId,
    profileHash: selection.profileHash,
    launcherRef: selection.runtime.launcherRef,
    stackPackId: selection.stackPackBinding.stackPackId,
    stackPackVersion: selection.stackPackBinding.stackPackVersion,
    stackPackContentHash: selection.stackPackBinding.stackPackContentHash,
  });
}

export function resolveNodeExecutionLayoutV2(
  input: unknown,
): NodeExecutionLayoutResolutionResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      RESOLUTION_INPUT_MAX_BYTES,
      RESOLUTION_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    return rejected("NODE_EXECUTION_LAYOUT_V2_INPUT_INVALID", "/", errorMessage(error));
  }
  const outer = ResolutionInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return diagnosticsFromZod(
      "NODE_EXECUTION_LAYOUT_V2_INPUT_INVALID",
      outer.error,
      "",
    );
  }
  const productSpec = ProductSpecV2Schema.safeParse(outer.data.productSpec);
  if (!productSpec.success) {
    return diagnosticsFromZod(
      "NODE_EXECUTION_LAYOUT_V2_PRODUCT_SPEC_INVALID",
      productSpec.error,
      "/productSpec",
    );
  }
  const selection = exactSelection(productSpec.data, outer.data.deliverySelection);
  if (selection.status === "rejected") {
    return rejected(selection.code, "/deliverySelection", selection.message);
  }
  let catalog: NodeExecutionLayoutCatalogV2;
  try {
    catalog = buildCodeOwnedNodeExecutionLayoutCatalogV2();
  } catch (error) {
    return rejected(
      "NODE_EXECUTION_LAYOUT_V2_CODE_AUTHORITY_DRIFT",
      "/",
      errorMessage(error),
    );
  }
  const layout = catalog.layouts.find((candidate) =>
    candidate.profileBinding.profileId === selection.selection.profileId);
  if (!layout) {
    return rejected(
      "NODE_EXECUTION_LAYOUT_V2_LAYOUT_UNRESOLVED",
      "/deliverySelection/profileId",
      "Fresh delivery selection has no exact NodeExecutionLayoutV2",
    );
  }
  if (!layoutMatchesSelection(layout, selection.selection)) {
    return rejected(
      "NODE_EXECUTION_LAYOUT_V2_LAYOUT_AUTHORITY_MISMATCH",
      "/deliverySelection",
      "Layout does not equal the exact fresh profile, launcher, and stack binding",
    );
  }
  return deepFreezeJson({
    status: "shadow_resolved" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    layout,
    catalogHash: catalog.catalogHash,
    layoutHash: layout.layoutHash,
    deliverySelectionHash: hashProductDeliverySelectionV2(selection.selection),
    canonicalBytes: canonicalJsonStringify(layout),
  });
}

export type NodeExecutionLayoutVerificationErrorCodeV2 =
  | "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_INPUT_INVALID"
  | "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_CANDIDATE_INVALID"
  | "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_REPRODUCTION_REJECTED"
  | "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_AUTHORITY_MISMATCH";

export class NodeExecutionLayoutVerificationErrorV2 extends Error {
  readonly code: NodeExecutionLayoutVerificationErrorCodeV2;

  constructor(code: NodeExecutionLayoutVerificationErrorCodeV2, message: string) {
    super(message);
    this.name = "NodeExecutionLayoutVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowNodeExecutionLayoutV2 = Readonly<{
  status: "verified_shadow";
  layout: Readonly<NodeExecutionLayoutV2>;
  catalogHash: string;
  layoutHash: string;
  deliverySelectionHash: string;
  canonicalBytes: string;
}>;

export function verifyNodeExecutionLayoutV2(
  input: unknown,
): VerifiedShadowNodeExecutionLayoutV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFICATION_INPUT_MAX_BYTES,
      VERIFICATION_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    throw new NodeExecutionLayoutVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = VerificationInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new NodeExecutionLayoutVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Layout verification input is invalid",
    );
  }
  const candidate = NodeExecutionLayoutV2Schema.safeParse(outer.data.candidate);
  if (!candidate.success) {
    throw new NodeExecutionLayoutVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Layout candidate is invalid",
    );
  }
  const reproduced = resolveNodeExecutionLayoutV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (reproduced.status !== "shadow_resolved") {
    throw new NodeExecutionLayoutVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh layout reproduction was rejected",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== canonicalJsonStringify(reproduced.layout)) {
    throw new NodeExecutionLayoutVerificationErrorV2(
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Layout candidate does not equal fresh ProductSpec/profile/topology authority",
    );
  }
  return deepFreezeJson({
    status: "verified_shadow" as const,
    layout: reproduced.layout,
    catalogHash: reproduced.catalogHash,
    layoutHash: reproduced.layoutHash,
    deliverySelectionHash: reproduced.deliverySelectionHash,
    canonicalBytes: reproduced.canonicalBytes,
  });
}
