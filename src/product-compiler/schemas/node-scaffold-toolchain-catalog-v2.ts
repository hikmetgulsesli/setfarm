import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1,
} from "./byte-bundle-v1.js";
import {
  NormalizedRelativeLocatorSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  PATH_TOKEN_CONTRACT_HASH_V2,
  PATH_TOKEN_CONTRACT_VERSION_V2,
  PATH_TOKEN_SET_VERSION_V2,
} from "./path-token-v2.js";
import {
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_VERSION_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
} from "./semantic-source-path-token-set-v2.js";
import {
  SemanticSourceResponsibilityV1Schema,
} from "./stack-semantic-source-rules-v1.js";

export const NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA =
  "setfarm.node-scaffold-toolchain-entry.v2" as const;
export const NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA =
  "setfarm.node-scaffold-toolchain-catalog.v2" as const;
export const NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_V2_SCHEMA =
  "setfarm.node-scaffold-toolchain-resolution.v2" as const;
export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_SCHEMA =
  "setfarm.node-scaffold-execution-environment.v2" as const;
export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2 =
  "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2" as const;
export const NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2 = "2.0.0" as const;
export const NODE_SCAFFOLD_ASSET_CODE_SHA_V2 =
  "9a1b80e7b3e7f2d8cea1b6b0a74d1bfcf76c6ddf" as const;
export const NODE_SCAFFOLD_TOOLCHAIN_CATALOG_MAX_CANONICAL_BYTES_V2 =
  2 * 1024 * 1024;
export const NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;

export const NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2 = Object.freeze([
  "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
  "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
] as const);

export const NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2 = Object.freeze([
  "NODE_SCAFFOLD_V2_BUILD_DEPENDENCY_MATERIALIZATION_UNVERIFIED",
  "NODE_SCAFFOLD_V2_BUILD_DEPENDENCY_RECEIPT_UNVERIFIED",
  "NODE_SCAFFOLD_V2_BUILD_TOPOLOGY_UNVERIFIED",
  "NODE_SCAFFOLD_V2_BYTE_BUNDLE_DEEP_VERIFICATION_UNVERIFIED",
  "NODE_SCAFFOLD_V2_DEPENDENCY_TARBALL_CONTENT_UNVERIFIED",
  "NODE_SCAFFOLD_V2_EFFECTIVE_NPM_CONFIG_RECEIPT_UNVERIFIED",
  "NODE_SCAFFOLD_V2_EXECUTION_ENVIRONMENT_UNVERIFIED",
  "NODE_SCAFFOLD_V2_FILE_TREE_UNVERIFIED",
  "NODE_SCAFFOLD_V2_HOST_TOOLCHAIN_RESOLUTION_UNVERIFIED",
  "NODE_SCAFFOLD_V2_NODE_ENTRYPOINT_GENERATOR_UNVERIFIED",
  "NODE_SCAFFOLD_V2_PRIVATE_STAGED_MATERIALIZER_UNVERIFIED",
  "NODE_SCAFFOLD_V2_RELEASE_ACTIVATION_UNVERIFIED",
  "NODE_SCAFFOLD_V2_SEMANTIC_NODE_RULES_V2_UNVERIFIED",
  "NODE_SCAFFOLD_V2_SOURCE_MATERIALIZATION_UNVERIFIED",
  "NODE_SCAFFOLD_V2_TRANSITIVE_ENGINE_COMPATIBILITY_UNVERIFIED",
] as const);

type NodeScaffoldRequiredPreconditionV2 = Readonly<{
  authorityRef: string;
  receiptSchema: string;
  missingDisposition: "typed_precondition_rejection";
}>;

function preconditionV2(
  authorityRef: string,
  receiptSchema: string,
): NodeScaffoldRequiredPreconditionV2 {
  return Object.freeze({
    authorityRef,
    receiptSchema,
    missingDisposition: "typed_precondition_rejection" as const,
  });
}

export const NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2 = Object.freeze([
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_DEEP_BYTE_BUNDLES_V2",
    "setfarm.deep-byte-bundle-verification-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_EFFECTIVE_NPM_CONFIG_V2",
    "setfarm.effective-npm-config-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2",
    "setfarm.node-scaffold-execution-environment-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_HOST_TOOLCHAIN_V2",
    "setfarm.host-node-toolchain-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_PRIVATE_STAGE_BASE_FILE_TREE_V2",
    "setfarm.file-tree-manifest.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_PRIVATE_STAGED_MATERIALIZER_V2",
    "setfarm.private-staged-materializer-authority.v2",
  ),
] as const);

export const NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2 = Object.freeze([
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_BUILD_DEPENDENCY_RECEIPT_V2",
    "setfarm.build-dependency-materialization-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_BUILD_INPUT_FILE_TREE_V2",
    "setfarm.file-tree-manifest.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_BUILD_TOPOLOGY_V2",
    "setfarm.build-topology.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_EFFECTIVE_NPM_CONFIG_V2",
    "setfarm.effective-npm-config-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2",
    "setfarm.node-scaffold-execution-environment-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_HOST_TOOLCHAIN_V2",
    "setfarm.host-node-toolchain-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_SOURCE_RECEIPT_V2",
    "setfarm.node-entrypoint-source-receipt.v2",
  ),
] as const);

export const NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2 = Object.freeze([
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_BUILD_DEPENDENCY_RECEIPT_V2",
    "setfarm.build-dependency-materialization-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_BUILD_RECEIPT_V2",
    "setfarm.canonical-build-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_BUILD_TOPOLOGY_V2",
    "setfarm.build-topology.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_EFFECTIVE_NPM_CONFIG_V2",
    "setfarm.effective-npm-config-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2",
    "setfarm.node-scaffold-execution-environment-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_HOST_TOOLCHAIN_V2",
    "setfarm.host-node-toolchain-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_SOURCE_RECEIPT_V2",
    "setfarm.node-entrypoint-source-receipt.v2",
  ),
  preconditionV2(
    "AUTH_NODE_SCAFFOLD_TEST_INPUT_FILE_TREE_V2",
    "setfarm.file-tree-manifest.v2",
  ),
] as const);

const ReadinessV2Schema = z.object({
  status: z.literal("shadow"),
  productionUse: z.literal("forbidden"),
  blockerCodes: z.array(z.enum(NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2))
    .length(NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2.length),
}).strict().superRefine((value, context) => {
  if (
    canonicalJsonStringify(value.blockerCodes)
    === canonicalJsonStringify(NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2)
  ) return;
  context.addIssue({
    code: "custom",
    path: ["blockerCodes"],
    message: "Node scaffold blockers must equal the exact code-owned set",
  });
});

const AssetProducerV2Schema = z.object({
  pass: z.literal("node-scaffold-toolchain-catalog-v2-assets"),
  codeSha: z.literal(NODE_SCAFFOLD_ASSET_CODE_SHA_V2),
  model: z.literal("code-owned"),
  toolVersions: z.object({
    byteBundleContract: z.literal("1.0.0"),
    canonicalJson: z.literal("1.0.0"),
    lockfile: z.literal("3"),
    lockGeneratorNode: z.literal("22.23.1"),
    npm: z.literal("10.9.8"),
  }).strict(),
}).strict();

const AssetSourceAuthorityV2Schema = z.object({
  kind: z.literal("code_owned_commit_assets"),
  repositoryRef: z.literal("SETFARM"),
  codeSha: z.literal(NODE_SCAFFOLD_ASSET_CODE_SHA_V2),
  moduleLocator: z.literal("src/product-compiler/node-scaffold-assets-v2.ts"),
  producer: AssetProducerV2Schema,
  publicationStatus: z.literal("unpublished_shadow"),
  deepCasVerification: z.object({
    status: z.literal("unverified"),
    blockerCode: z.literal(
      "NODE_SCAFFOLD_V2_BYTE_BUNDLE_DEEP_VERIFICATION_UNVERIFIED",
    ),
  }).strict(),
}).strict();

export const NodeScaffoldByteBundleRefV2Schema = z.object({
  artifactType: z.literal(BYTE_BUNDLE_ARTIFACT_TYPE_V1),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive()
    .max(BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1),
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().positive().max(64 * 1024),
}).strict();

export type NodeScaffoldByteBundleRefV2 = z.infer<
  typeof NodeScaffoldByteBundleRefV2Schema
>;

const ScaffoldFileRoleV2Schema = z.enum([
  "package_manifest",
  "dependency_lock_manifest",
  "typescript_compiler_config",
]);

function scaffoldPathBindingForRoleV2(
  role: z.infer<typeof ScaffoldFileRoleV2Schema>,
) {
  return {
    package_manifest: {
      pathSlotRef: "PATH_SLOT_NODE_PACKAGE_JSON_V2" as const,
      normalizedLocator: "package.json" as const,
    },
    dependency_lock_manifest: {
      pathSlotRef: "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2" as const,
      normalizedLocator: "package-lock.json" as const,
    },
    typescript_compiler_config: {
      pathSlotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2" as const,
      normalizedLocator: "tsconfig.json" as const,
    },
  }[role];
}

const ScaffoldFileV2Schema = z.object({
  role: ScaffoldFileRoleV2Schema,
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_PACKAGE_JSON_V2",
    "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2",
    "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
  ]),
  normalizedLocator: z.enum([
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ]),
  mediaType: z.literal("application/json"),
  sourceExportRef: StableReferenceSchema,
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().positive().max(64 * 1024),
  byteBundle: NodeScaffoldByteBundleRefV2Schema,
}).strict().superRefine((value, context) => {
  const expected = scaffoldPathBindingForRoleV2(value.role);
  if (
    value.pathSlotRef !== expected.pathSlotRef
    || value.normalizedLocator !== expected.normalizedLocator
  ) {
    context.addIssue({
      code: "custom",
      path: ["pathSlotRef"],
      message: "Scaffold role must map to its exact V2 path slot and locator",
    });
  }
  if (
    value.byteBundle.rawHash !== value.rawHash
    || value.byteBundle.rawByteLength !== value.rawByteLength
  ) {
    context.addIssue({
      code: "custom",
      path: ["byteBundle"],
      message: "Scaffold ByteBundle ref must bind the exact raw file authority",
    });
  }
});

const CanonicalNumericVersionIdentifierPattern = "(?:0|[1-9]\\d*)";
const ExactVersionPattern = new RegExp(
  `^${CanonicalNumericVersionIdentifierPattern}`
    + `\\.${CanonicalNumericVersionIdentifierPattern}`
    + `\\.${CanonicalNumericVersionIdentifierPattern}$`,
  "u",
);
const ExactVersionSchema = z.string().max(64).regex(
  ExactVersionPattern,
  "Expected a canonical exact three-part semantic version",
);

const NpmPackageSegmentPattern = "[a-z0-9](?:[a-z0-9._~-]{0,99})";
const NpmPackageNamePattern =
  `(?:@${NpmPackageSegmentPattern}/${NpmPackageSegmentPattern}`
  + `|${NpmPackageSegmentPattern})`;
const NpmLockPackagePathPattern = new RegExp(
  `^node_modules/${NpmPackageNamePattern}`
    + `(?:/node_modules/${NpmPackageNamePattern})*$`,
  "u",
);
const NpmLockPackagePathSchema = NormalizedRelativeLocatorSchema.refine(
  (value) => NpmLockPackagePathPattern.test(value),
  "Expected an exact npm lock-v3 node_modules package path",
);

const RootDependencyV2Schema = z.object({
  kind: z.enum(["runtime", "development"]),
  packageName: z.string().min(1).max(214),
  exactVersion: ExactVersionSchema,
}).strict();

const DependencyGraphRootV2Schema = z.object({
  packageName: z.enum([
    "@setfarm/generated-node-cli-v2",
    "@setfarm/generated-node-express-api-v2",
  ]),
  version: z.literal("0.0.0"),
  engines: z.object({
    node: z.literal(">=22.13.0 <23"),
    npm: z.literal("10.9.8"),
  }).strict(),
  packageManager: z.literal("npm@10.9.8"),
  directDependencies: z.array(RootDependencyV2Schema).min(2).max(4),
  manifestRawHash: Sha256Schema,
  lockRootHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const keys = value.directDependencies.map((entry) =>
    `${entry.kind}\0${entry.packageName}`);
  if (
    !hasUniqueStrings(keys)
    || keys.some((key, index) => index > 0 && keys[index - 1]! >= key)
  ) {
    context.addIssue({
      code: "custom",
      path: ["directDependencies"],
      message: "Root dependencies must be unique and canonically ordered",
    });
  }
});

const LockPackageNodeV2Schema = z.object({
  packagePath: NpmLockPackagePathSchema,
  packageName: z.string().min(1).max(214),
  version: ExactVersionSchema,
  resolved: z.string().url().max(2_000)
    .regex(/^https:\/\/registry\.npmjs\.org\//u),
  integrity: z.string().min(20).max(500)
    .regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/u),
  dev: z.boolean(),
  license: z.string().min(1).max(100),
  installLifecycle: z.literal("hasInstallScript_absent_in_lock"),
  nativeLockMetadata: z.literal("absent"),
  lockEntryHash: Sha256Schema,
}).strict();

const DependencyEdgeV2Schema = z.object({
  ownerPackagePath: z.union([z.literal(""), NpmLockPackagePathSchema]),
  kind: z.enum(["dependencies", "devDependencies"]),
  dependencyName: z.string().min(1).max(214),
  declaredSpec: z.string().min(1).max(160),
  resolvedPackagePath: NpmLockPackagePathSchema,
  resolvedVersion: ExactVersionSchema,
}).strict();

type VersionTuple = readonly [bigint, bigint, bigint];

function parseVersion(value: string): VersionTuple | null {
  if (value.length > 64) return null;
  if (!ExactVersionPattern.test(value)) return null;
  const [major, minor, patch] = value.split(".");
  return [BigInt(major!), BigInt(minor!), BigInt(patch!)];
}

function compareVersion(left: VersionTuple, right: VersionTuple): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index]! < right[index]!) return -1;
    if (left[index]! > right[index]!) return 1;
  }
  return 0;
}

function parseCanonicalVersionIdentifier(value: string): bigint | null {
  if (
    value.length === 0
    || value.length > 64
    || !/^(?:0|[1-9]\d*)$/u.test(value)
  ) return null;
  return BigInt(value);
}

export function nodeScaffoldVersionSatisfiesSpecV2(
  versionText: string,
  spec: string,
): boolean {
  const version = parseVersion(versionText);
  if (!version) return false;
  if (spec === "*") return true;
  const exact = parseVersion(spec);
  if (exact) return compareVersion(version, exact) === 0;
  const major = parseCanonicalVersionIdentifier(spec);
  if (major !== null) return version[0] === major;
  const shortCaret = /^\^((?:0|[1-9]\d*))$/u.exec(spec);
  if (shortCaret) {
    const shortMajor = parseCanonicalVersionIdentifier(shortCaret[1]!);
    return shortMajor !== null && version[0] === shortMajor;
  }
  const prefix = new RegExp(
    `^([~^])(${CanonicalNumericVersionIdentifierPattern})`
      + `\\.(${CanonicalNumericVersionIdentifierPattern})`
      + `\\.(${CanonicalNumericVersionIdentifierPattern})$`,
    "u",
  ).exec(spec);
  if (prefix) {
    const baseIdentifiers = [prefix[2]!, prefix[3]!, prefix[4]!]
      .map(parseCanonicalVersionIdentifier);
    if (baseIdentifiers.some((identifier) => identifier === null)) return false;
    const base: VersionTuple = [
      baseIdentifiers[0]!,
      baseIdentifiers[1]!,
      baseIdentifiers[2]!,
    ];
    if (compareVersion(version, base) < 0) return false;
    if (prefix[1] === "~") {
      return version[0] === base[0] && version[1] === base[1];
    }
    if (base[0] > 0n) return version[0] === base[0];
    if (base[1] > 0n) {
      return version[0] === 0n && version[1] === base[1];
    }
    return version[0] === 0n && version[1] === 0n && version[2] === base[2];
  }
  const comparators = new RegExp(
    `^>=\\s*(${CanonicalNumericVersionIdentifierPattern}`
      + `\\.${CanonicalNumericVersionIdentifierPattern}`
      + `\\.${CanonicalNumericVersionIdentifierPattern})\\s+<\\s*`
      + `(${CanonicalNumericVersionIdentifierPattern}`
      + `\\.${CanonicalNumericVersionIdentifierPattern}`
      + `\\.${CanonicalNumericVersionIdentifierPattern})$`,
    "u",
  ).exec(spec);
  if (comparators) {
    const minimum = parseVersion(comparators[1]!);
    const maximum = parseVersion(comparators[2]!);
    if (!minimum || !maximum) return false;
    return compareVersion(version, minimum) >= 0
      && compareVersion(version, maximum) < 0;
  }
  return false;
}

export function nodeScaffoldPackageNameFromLockPathV2(
  packagePath: string,
): string | null {
  if (!NpmLockPackagePathPattern.test(packagePath)) return null;
  const marker = "/node_modules/";
  const lastMarker = packagePath.lastIndexOf(marker);
  return lastMarker < 0
    ? packagePath.slice("node_modules/".length)
    : packagePath.slice(lastMarker + marker.length);
}

export function resolveNodeScaffoldDependencyPathV2(
  packagePaths: ReadonlySet<string>,
  ownerPackagePath: string,
  dependencyName: string,
): string | null {
  if (!new RegExp(`^${NpmPackageNamePattern}$`, "u").test(dependencyName)) {
    return null;
  }
  let base = ownerPackagePath;
  for (;;) {
    const candidate = base.length > 0
      ? `${base}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (packagePaths.has(candidate)) return candidate;
    const nestedMarker = base.lastIndexOf("/node_modules/");
    if (nestedMarker >= 0) {
      base = base.slice(0, nestedMarker);
      continue;
    }
    if (base.startsWith("node_modules/")) {
      base = "";
      continue;
    }
    return null;
  }
}

function edgeKey(edge: z.infer<typeof DependencyEdgeV2Schema>): string {
  return [
    edge.ownerPackagePath,
    edge.kind,
    edge.dependencyName,
    edge.resolvedPackagePath,
  ].join("\0");
}

export function hashNodeScaffoldDependencyNodeMembershipV2(
  nodes: readonly z.infer<typeof LockPackageNodeV2Schema>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-dependency-node-membership-hash.v2",
    nodes: nodes.map((node) => ({
      packagePath: node.packagePath,
      lockEntryHash: node.lockEntryHash,
    })),
  });
}

export function hashNodeScaffoldDependencyEdgeMembershipV2(
  edges: readonly z.infer<typeof DependencyEdgeV2Schema>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-dependency-edge-membership-hash.v2",
    edges,
  });
}

const DependencyGraphCandidateV2Schema = z.object({
  schema: z.literal("setfarm.node-scaffold-dependency-graph.v2"),
  lockfileVersion: z.literal(3),
  lockRawHash: Sha256Schema,
  root: DependencyGraphRootV2Schema,
  policy: z.object({
    registryOrigin: z.literal("https://registry.npmjs.org"),
    integrityAlgorithm: z.literal("sha512"),
    rootVersionPolicy: z.literal("exact_versions_only"),
    versionSpecGrammar: z.literal(
      "exact_major_wildcard_caret_tilde_comparator_pair_v2",
    ),
    graphResolution: z.literal("nearest_node_modules_lock_v3"),
    installLifecyclePolicy: z.literal("hasInstallScript_absent_in_lock"),
    scriptExecutionBarrier: z.literal("npm_ci_ignore_scripts"),
    registryLifecycleMetadataAuthority: z.literal(
      "unversioned_audit_not_production_authority",
    ),
    deepTarballContentAuthority: z.literal("unverified_blocking"),
    deepTarballContentBlockerCode: z.literal(
      "NODE_SCAFFOLD_V2_DEPENDENCY_TARBALL_CONTENT_UNVERIFIED",
    ),
    transitiveEngineCompatibilityAuthority: z.literal("unverified_blocking"),
    transitiveEngineCompatibilityBlockerCode: z.literal(
      "NODE_SCAFFOLD_V2_TRANSITIVE_ENGINE_COMPATIBILITY_UNVERIFIED",
    ),
  }).strict(),
  nodeCount: z.number().int().positive().max(1_000),
  nodes: z.array(LockPackageNodeV2Schema).min(1).max(1_000),
  edgeCount: z.number().int().positive().max(4_000),
  edges: z.array(DependencyEdgeV2Schema).min(1).max(4_000),
  nodeMembershipHash: Sha256Schema,
  edgeMembershipHash: Sha256Schema,
  graphHash: Sha256Schema,
}).strict();

export type NodeScaffoldDependencyGraphV2 = z.infer<
  typeof DependencyGraphCandidateV2Schema
>;

export function hashNodeScaffoldDependencyGraphV2(
  value:
    | Omit<NodeScaffoldDependencyGraphV2, "graphHash">
    | NodeScaffoldDependencyGraphV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.graphHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-dependency-graph-hash.v2",
    graph: payload,
  });
}

function addDependencyGraphIssues(
  value: NodeScaffoldDependencyGraphV2,
  context: z.RefinementCtx,
): void {
  const nodePaths = value.nodes.map((node) => node.packagePath);
  if (
    value.nodeCount !== value.nodes.length
    || !hasUniqueStrings(nodePaths)
    || nodePaths.some((item, index) => index > 0 && nodePaths[index - 1]! >= item)
  ) {
    context.addIssue({
      code: "custom",
      path: ["nodes"],
      message: "Dependency nodes must be complete, unique, and ordered by packagePath",
    });
  }
  const nodes = new Map(value.nodes.map((node) => [node.packagePath, node]));
  value.nodes.forEach((node, index) => {
    if (nodeScaffoldPackageNameFromLockPathV2(node.packagePath) !== node.packageName) {
      context.addIssue({
        code: "custom",
        path: ["nodes", index, "packageName"],
        message: "Dependency node name must be derived from its exact lock path",
      });
    }
  });
  const edgeKeys = value.edges.map(edgeKey);
  if (
    value.edgeCount !== value.edges.length
    || !hasUniqueStrings(edgeKeys)
    || edgeKeys.some((item, index) => index > 0 && edgeKeys[index - 1]! >= item)
  ) {
    context.addIssue({
      code: "custom",
      path: ["edges"],
      message: "Dependency edges must be complete, unique, and canonically ordered",
    });
  }
  const rootDependencyIndex = new Map(value.root.directDependencies.map((item) => [
    `${item.kind === "runtime" ? "dependencies" : "devDependencies"}\0${item.packageName}`,
    item.exactVersion,
  ]));
  const rootEdgeIndex = new Map(value.edges
    .filter((edge) => edge.ownerPackagePath === "")
    .map((edge) => [`${edge.kind}\0${edge.dependencyName}`, edge.declaredSpec]));
  if (
    canonicalJsonStringify([...rootDependencyIndex.entries()].sort())
    !== canonicalJsonStringify([...rootEdgeIndex.entries()].sort())
  ) {
    context.addIssue({
      code: "custom",
      path: ["root", "directDependencies"],
      message: "Root dependency projection must equal every and only root graph edge",
    });
  }
  const reached = new Set<string>();
  const packagePaths = new Set(nodes.keys());
  const pending = value.edges
    .filter((edge) => edge.ownerPackagePath === "")
    .map((edge) => edge.resolvedPackagePath);
  value.edges.forEach((edge, index) => {
    const target = nodes.get(edge.resolvedPackagePath);
    if (
      (edge.ownerPackagePath !== "" && !nodes.has(edge.ownerPackagePath))
      || !target
      || target.packageName !== edge.dependencyName
      || resolveNodeScaffoldDependencyPathV2(
        packagePaths,
        edge.ownerPackagePath,
        edge.dependencyName,
      ) !== edge.resolvedPackagePath
      || target.version !== edge.resolvedVersion
      || !nodeScaffoldVersionSatisfiesSpecV2(
        edge.resolvedVersion,
        edge.declaredSpec,
      )
      || (edge.ownerPackagePath !== "" && edge.kind !== "dependencies")
    ) {
      context.addIssue({
        code: "custom",
        path: ["edges", index],
        message: "Dependency edge must resolve an exact compatible node from a valid owner",
      });
    }
  });
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (reached.has(current)) continue;
    reached.add(current);
    for (const edge of value.edges) {
      if (edge.ownerPackagePath === current) pending.push(edge.resolvedPackagePath);
    }
  }
  if (
    reached.size !== nodes.size
    || [...nodes.keys()].some((path) => !reached.has(path))
  ) {
    context.addIssue({
      code: "custom",
      path: ["nodes"],
      message: "Every and only lock node must be reachable from the exact root",
    });
  }
  if (
    value.nodeMembershipHash
      !== hashNodeScaffoldDependencyNodeMembershipV2(value.nodes)
    || value.edgeMembershipHash
      !== hashNodeScaffoldDependencyEdgeMembershipV2(value.edges)
    || value.graphHash !== hashNodeScaffoldDependencyGraphV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["graphHash"],
      message: "Dependency graph hashes must bind the complete exact closure",
    });
  }
}

export const NodeScaffoldDependencyGraphV2Schema =
  DependencyGraphCandidateV2Schema.superRefine(addDependencyGraphIssues);

const ToolchainContractV2Schema = z.object({
  nodeRuntime: z.object({
    executableRef: z.literal("TOOL_NODE_RUNTIME_V2"),
    compatibilityRange: z.literal(">=22.13.0 <23"),
    exactHostResolution: z.literal("unverified_blocking"),
    exactHostResolutionBlockerCode: z.literal(
      "NODE_SCAFFOLD_V2_HOST_TOOLCHAIN_RESOLUTION_UNVERIFIED",
    ),
  }).strict(),
  npm: z.object({
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    exactVersion: z.literal("10.9.8"),
    exactHostResolution: z.literal("unverified_blocking"),
    exactHostResolutionBlockerCode: z.literal(
      "NODE_SCAFFOLD_V2_HOST_TOOLCHAIN_RESOLUTION_UNVERIFIED",
    ),
  }).strict(),
  typescript: z.object({
    executableRef: z.literal("TOOL_NODE_TYPESCRIPT_TSC_V2"),
    exactVersion: z.literal("5.9.3"),
    materializationAuthority: z.literal("package_lock_graph_and_future_receipt"),
  }).strict(),
  lockGeneration: z.object({
    nodeVersion: z.literal("22.23.1"),
    npmVersion: z.literal("10.9.8"),
    lockfileVersion: z.literal(3),
    registryOrigin: z.literal("https://registry.npmjs.org"),
  }).strict(),
}).strict();

const PlannedNpmrcFileV2Schema = z.object({
  pathRef: z.enum([
    "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2",
    "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2",
  ]),
  canonicalContent: z.literal("single_lf_blank_file"),
  rawHash: z.literal(
    "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
  ),
  rawByteLength: z.literal(1),
  byteBundleAuthority: z.literal("future_private_environment_byte_bundle_v2"),
  materializationAuthority: z.literal("future_private_staged_materializer_v2"),
}).strict();

const ExecutionEnvironmentIdentityV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_SCHEMA),
  contractVersion: z.literal("2.1.0"),
  environmentRef: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2),
  mode: z.literal("planned_isolated_exact"),
  productionAuthority: z.literal("unverified_blocking"),
  productionAuthorityBlockerCode: z.literal(
    "NODE_SCAFFOLD_V2_EXECUTION_ENVIRONMENT_UNVERIFIED",
  ),
  inheritAmbientEnvironment: z.literal(false),
  constructionPolicy: z.literal("deny_all_then_exact_set"),
  inheritedVariableAllowlist: z.tuple([]),
  fixedVariables: z.object({
    CI: z.literal("true"),
    LANG: z.literal("C.UTF-8"),
    LC_ALL: z.literal("C.UTF-8"),
    NODE_DISABLE_COMPILE_CACHE: z.literal("1"),
    NO_COLOR: z.literal("1"),
    NPM_CONFIG_REGISTRY: z.literal("https://registry.npmjs.org"),
    NPM_CONFIG_LOGS_MAX: z.literal("0"),
    TZ: z.literal("UTC"),
  }).strict(),
  attemptScopedVariableBindings: z.object({
    HOME: z.literal("PRIVATE_STAGE_HOME_V2"),
    NPM_CONFIG_CACHE: z.literal("PRIVATE_STAGE_NPM_CACHE_V2"),
    NPM_CONFIG_GLOBALCONFIG: z.literal("PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2"),
    NPM_CONFIG_USERCONFIG: z.literal("PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"),
    PATH: z.literal("HOST_TOOLCHAIN_EXACT_COMMAND_PATH_V2"),
    TEMP: z.literal("PRIVATE_STAGE_TMP_V2"),
    TMP: z.literal("PRIVATE_STAGE_TMP_V2"),
    TMPDIR: z.literal("PRIVATE_STAGE_TMP_V2"),
  }).strict(),
  npmConfigIsolation: z.object({
    ambientVariablePrefix: z.literal("npm_config_"),
    prefixMatch: z.literal("case_insensitive"),
    ambientVariablePolicy: z.literal("strip_all_before_exact_set"),
    projectNpmrc: z.object({
      normalizedLocator: z.literal(".npmrc"),
      requiredBaseState: z.literal("absent"),
      evidenceAuthority: z.literal("future_file_tree_manifest_v2"),
    }).strict(),
    userNpmrc: PlannedNpmrcFileV2Schema,
    globalNpmrc: PlannedNpmrcFileV2Schema,
    builtinNpmrcAuthority: z.literal("future_exact_host_npm_toolchain_receipt_v2"),
    effectiveConfigReceiptSchema: z.literal(
      "setfarm.effective-npm-config-receipt.v2",
    ),
    effectiveConfigReceiptStatus: z.literal("unverified_blocking"),
    effectiveConfigReceiptBlockerCode: z.literal(
      "NODE_SCAFFOLD_V2_EFFECTIVE_NPM_CONFIG_RECEIPT_UNVERIFIED",
    ),
  }).strict().superRefine((value, context) => {
    if (
      value.userNpmrc.pathRef === "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"
      && value.globalNpmrc.pathRef === "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2"
    ) return;
    context.addIssue({
      code: "custom",
      path: [],
      message: "User and global npmrc plans must bind their distinct private paths",
    });
  }),
  proxyAndCaPolicy: z.literal("absent_unless_future_secret_authority"),
  credentialVariableRefs: z.tuple([]),
  requiredReceiptSchema: z.literal(
    "setfarm.node-scaffold-execution-environment-receipt.v2",
  ),
  receiptStatus: z.literal("unverified_blocking"),
  receiptBlockerCode: z.literal(
    "NODE_SCAFFOLD_V2_EXECUTION_ENVIRONMENT_UNVERIFIED",
  ),
}).strict();

export type NodeScaffoldExecutionEnvironmentHashPayloadV2 = z.infer<
  typeof ExecutionEnvironmentIdentityV2Schema
>;

export function hashNodeScaffoldExecutionEnvironmentV2(
  value:
    | NodeScaffoldExecutionEnvironmentHashPayloadV2
    | NodeScaffoldExecutionEnvironmentV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.environmentContractHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-execution-environment-hash.v2",
    environment: payload,
  });
}

const ExecutionEnvironmentCandidateV2Schema =
  ExecutionEnvironmentIdentityV2Schema.extend({
    environmentContractHash: Sha256Schema,
  }).strict();

const ExecutionEnvironmentContractV2Schema =
  ExecutionEnvironmentCandidateV2Schema.superRefine((value, context) => {
    if (
      value.environmentContractHash
      === hashNodeScaffoldExecutionEnvironmentV2(value)
    ) return;
    context.addIssue({
      code: "custom",
      path: ["environmentContractHash"],
      message: "Execution environment contract hash must bind the exact plan",
    });
  });

export type NodeScaffoldExecutionEnvironmentV2 = z.infer<
  typeof ExecutionEnvironmentCandidateV2Schema
>;

const EnvironmentBindingV2Schema = z.object({
  environmentRef: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2),
  environmentContractHash: Sha256Schema,
}).strict();

const RequiredPreconditionV2Schema = z.object({
  authorityRef: StableReferenceSchema,
  receiptSchema: z.string().min(1).max(200),
  missingDisposition: z.literal("typed_precondition_rejection"),
}).strict();

const ExecutionRecipesV2Schema = z.object({
  install: z.object({
    commandRef: z.literal("CMD_NODE_SCAFFOLD_INSTALL_V2"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("ci"),
      z.literal("--include=dev"),
      z.literal("--ignore-scripts"),
      z.literal("--no-audit"),
      z.literal("--no-fund"),
    ]),
    environmentBinding: EnvironmentBindingV2Schema,
    requiredPreconditionCount: z.literal(
      NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2.length,
    ),
    requiredPreconditions: z.array(RequiredPreconditionV2Schema).length(
      NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2.length,
    ),
    executionStatus: z.literal("blocked_until_private_materializer_and_host_receipt"),
  }).strict(),
  build: z.object({
    commandRef: z.literal("CMD_BUILD"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("run"),
      z.literal("build"),
    ]),
    environmentBinding: EnvironmentBindingV2Schema,
    requiredPreconditionCount: z.literal(
      NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2.length,
    ),
    requiredPreconditions: z.array(RequiredPreconditionV2Schema).length(
      NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2.length,
    ),
    requiredSourceReceiptSchema: z.literal(
      "setfarm.node-entrypoint-source-receipt.v2",
    ),
    missingSourceReceiptDisposition: z.literal("typed_precondition_rejection"),
    executionStatus: z.literal("blocked_until_source_and_dependency_receipts"),
  }).strict(),
  test: z.object({
    commandRef: z.literal("CMD_TEST"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("test"),
    ]),
    environmentBinding: EnvironmentBindingV2Schema,
    requiredPreconditionCount: z.literal(
      NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2.length,
    ),
    requiredPreconditions: z.array(RequiredPreconditionV2Schema).length(
      NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2.length,
    ),
    canonicalReceiptSchema: z.literal("setfarm.canonical-test-receipt.v2"),
    exitCodeRequired: z.literal(0),
    minimumTestCount: z.literal(1),
    zeroTestReceipt: z.literal("forbidden"),
    acceptanceAuthority: z.literal("none_until_verified_canonical_receipt"),
    executionStatus: z.literal("blocked_until_source_and_dependency_receipts"),
  }).strict(),
}).strict().superRefine((value, context) => {
  const expected = {
    install: NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2,
    build: NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2,
    test: NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2,
  } as const;
  for (const recipe of ["install", "build", "test"] as const) {
    if (
      value[recipe].requiredPreconditionCount
        === value[recipe].requiredPreconditions.length
      && canonicalJsonStringify(value[recipe].requiredPreconditions)
        === canonicalJsonStringify(expected[recipe])
    ) continue;
    context.addIssue({
      code: "custom",
      path: [recipe, "requiredPreconditions"],
      message: `${recipe} must bind every exact execution precondition`,
    });
  }
});

const SourceGenerationContractV2Schema = z.object({
  kind: z.literal("deferred_to_node_entrypoint_generator_v2"),
  scaffoldCreatesSource: z.literal(false),
  sourceDirectoryMayBeAbsent: z.literal(true),
  canonicalEntrypointInitialState: z.literal("absent"),
  requiredBaseState: z.literal("absent"),
  canonicalEntrypointPathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
  ]),
  finalOwnerRef: z.literal("NODE_ENTRYPOINT_GENERATOR_V2"),
  outputMode: z.literal("whole_file"),
  modelWriteAuthority: z.literal("forbidden"),
  requiredReceiptSchema: z.literal("setfarm.node-entrypoint-source-receipt.v2"),
  buildBeforeReceipt: z.literal("typed_precondition_rejection"),
  currentSemanticRulesCompatibility: z.object({
    ruleSetRef: StableReferenceSchema,
    ruleSetVersion: z.literal("1.0.0"),
    ruleSetHash: Sha256Schema,
    status: z.literal("unmigrated_shared_entrypoint_rules"),
    productionActivation: z.literal("forbidden"),
  }).strict(),
}).strict();

const ProfileBindingV2Schema = z.object({
  catalogVersion: z.literal("2.0.0"),
  catalogHash: Sha256Schema,
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  profileHash: Sha256Schema,
  stackPackId: z.enum(["node-cli", "node-express-api"]),
  stackPackVersion: z.string().min(1).max(160),
  stackPackContentHash: Sha256Schema,
}).strict();

const LayoutBindingV2Schema = z.object({
  catalogVersion: z.literal("2.1.0"),
  catalogHash: Sha256Schema,
  layoutRef: z.enum([
    "NODE_EXECUTION_LAYOUT_NODE_CLI_V2",
    "NODE_EXECUTION_LAYOUT_NODE_EXPRESS_API_V2",
  ]),
  layoutHash: Sha256Schema,
  pathSlotContractVersion: z.literal("2.1.0"),
  pathSlotSetHash: Sha256Schema,
}).strict();

const EntryIdentityV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA),
  entryVersion: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2),
  entryRef: z.enum(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2),
  kind: z.enum(["cli", "http_handler"]),
  profileBinding: ProfileBindingV2Schema,
  layoutBinding: LayoutBindingV2Schema,
  readiness: ReadinessV2Schema,
  scaffold: z.object({
    fileCount: z.literal(3),
    files: z.array(ScaffoldFileV2Schema).length(3),
    forbiddenArtifactClasses: z.tuple([
      z.literal("source"),
      z.literal("test"),
      z.literal("documentation"),
      z.literal("repository_control"),
      z.literal("build_output"),
      z.literal("dependency_installation"),
      z.literal("candidate_bundle"),
    ]),
  }).strict(),
  dependencyGraph: NodeScaffoldDependencyGraphV2Schema,
  toolchain: ToolchainContractV2Schema,
  executionEnvironment: ExecutionEnvironmentContractV2Schema,
  recipes: ExecutionRecipesV2Schema,
  sourceGeneration: SourceGenerationContractV2Schema,
}).strict();

export type NodeScaffoldToolchainEntryHashPayloadV2 = z.infer<
  typeof EntryIdentityV2Schema
>;

export function hashNodeScaffoldToolchainEntryV2(
  value: NodeScaffoldToolchainEntryHashPayloadV2 | NodeScaffoldToolchainEntryV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-toolchain-entry-hash.v2",
    entry: payload,
  });
}

const EntryCandidateV2Schema = EntryIdentityV2Schema.extend({
  entryHash: Sha256Schema,
}).strict();

export const NodeScaffoldToolchainEntryV2Schema =
  EntryCandidateV2Schema.superRefine((value, context) => {
    const expected = value.entryRef === NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[0]
      ? {
          kind: "cli",
          profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
          stackPackId: "node-cli",
          layoutRef: "NODE_EXECUTION_LAYOUT_NODE_CLI_V2",
          sourceSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
          sourceExports: [
            "NODE_CLI_PACKAGE_JSON_TEXT_V2",
            "NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2",
            "NODE_CLI_TSCONFIG_JSON_TEXT_V2",
          ],
          packageName: "@setfarm/generated-node-cli-v2",
          directDependencies: [
            { kind: "development", packageName: "@types/node", exactVersion: "22.19.11" },
            { kind: "development", packageName: "typescript", exactVersion: "5.9.3" },
          ],
        }
      : {
          kind: "http_handler",
          profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
          stackPackId: "node-express-api",
          layoutRef: "NODE_EXECUTION_LAYOUT_NODE_EXPRESS_API_V2",
          sourceSlotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
          sourceExports: [
            "NODE_EXPRESS_API_PACKAGE_JSON_TEXT_V2",
            "NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2",
            "NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2",
          ],
          packageName: "@setfarm/generated-node-express-api-v2",
          directDependencies: [
            { kind: "development", packageName: "@types/express", exactVersion: "5.0.6" },
            { kind: "development", packageName: "@types/node", exactVersion: "22.19.11" },
            { kind: "development", packageName: "typescript", exactVersion: "5.9.3" },
            { kind: "runtime", packageName: "express", exactVersion: "5.2.1" },
          ],
        };
    const roles = value.scaffold.files.map((file) => file.role);
    const exports = value.scaffold.files.map((file) => file.sourceExportRef);
    if (
      value.kind !== expected.kind
      || value.profileBinding.profileId !== expected.profileId
      || value.profileBinding.stackPackId !== expected.stackPackId
      || value.layoutBinding.layoutRef !== expected.layoutRef
      || value.sourceGeneration.canonicalEntrypointPathSlotRef
        !== expected.sourceSlotRef
      || value.dependencyGraph.root.packageName !== expected.packageName
      || canonicalJsonStringify(value.dependencyGraph.root.directDependencies)
        !== canonicalJsonStringify(expected.directDependencies)
      || canonicalJsonStringify(roles) !== canonicalJsonStringify([
        "package_manifest",
        "dependency_lock_manifest",
        "typescript_compiler_config",
      ])
      || canonicalJsonStringify(exports)
        !== canonicalJsonStringify(expected.sourceExports)
    ) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Node scaffold entry discriminant bindings are not exact",
      });
    }
    const manifest = value.scaffold.files[0]!;
    const lock = value.scaffold.files[1]!;
    const typescriptDependency = value.dependencyGraph.root.directDependencies
      .find((dependency) => dependency.packageName === "typescript");
    const environmentBindings = [
      value.recipes.install.environmentBinding,
      value.recipes.build.environmentBinding,
      value.recipes.test.environmentBinding,
    ];
    if (
      value.dependencyGraph.root.manifestRawHash !== manifest.rawHash
      || value.dependencyGraph.lockRawHash !== lock.rawHash
      || value.dependencyGraph.root.packageManager
        !== `npm@${value.toolchain.npm.exactVersion}`
      || value.dependencyGraph.root.engines.npm
        !== value.toolchain.npm.exactVersion
      || value.dependencyGraph.lockfileVersion
        !== value.toolchain.lockGeneration.lockfileVersion
      || value.dependencyGraph.policy.registryOrigin
        !== value.toolchain.lockGeneration.registryOrigin
      || typescriptDependency?.kind !== "development"
      || typescriptDependency.exactVersion
        !== value.toolchain.typescript.exactVersion
      || environmentBindings.some((binding) =>
        binding.environmentRef !== value.executionEnvironment.environmentRef
        || binding.environmentContractHash
          !== value.executionEnvironment.environmentContractHash)
      || value.entryHash !== hashNodeScaffoldToolchainEntryV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Node scaffold entry hash and manifest graph binding must be exact",
      });
    }
  });

export type NodeScaffoldToolchainEntryV2 = z.infer<
  typeof EntryCandidateV2Schema
>;

const CatalogCandidateV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA),
  catalogVersion: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2),
  sourceAuthority: AssetSourceAuthorityV2Schema,
  readiness: ReadinessV2Schema,
  entryCount: z.literal(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2.length),
  entries: z.array(NodeScaffoldToolchainEntryV2Schema)
    .length(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2.length),
  catalogHash: Sha256Schema,
}).strict();

export type NodeScaffoldToolchainCatalogV2 = z.infer<
  typeof CatalogCandidateV2Schema
>;

export function hashNodeScaffoldToolchainCatalogV2(
  value:
    | Omit<NodeScaffoldToolchainCatalogV2, "catalogHash">
    | NodeScaffoldToolchainCatalogV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-toolchain-catalog-hash.v2",
    catalog: payload,
  });
}

const CatalogContentV2Schema = CatalogCandidateV2Schema.superRefine(
  (value, context) => {
    const refs = value.entries.map((entry) => entry.entryRef);
    if (
      canonicalJsonStringify(refs)
        !== canonicalJsonStringify(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2)
      || value.catalogHash !== hashNodeScaffoldToolchainCatalogV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "Node scaffold catalog must contain every exact entry in canonical order",
      });
    }
  },
);

const BoundedCatalogV2Schema = z.unknown().superRefine((value, context) => {
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_MAX_CANONICAL_BYTES_V2,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch {
    context.addIssue({
      code: "custom",
      message: "Node scaffold catalog exceeds canonical byte or work limits",
    });
  }
});

export const NodeScaffoldToolchainCatalogV2Schema =
  BoundedCatalogV2Schema.pipe(CatalogContentV2Schema);

const ResolvedFileBindingV2Schema = z.object({
  role: ScaffoldFileRoleV2Schema,
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_PACKAGE_JSON_V2",
    "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2",
    "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  normalizedLocator: z.enum([
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ]),
  rawHash: Sha256Schema,
  byteBundleEnvelopeHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expected = scaffoldPathBindingForRoleV2(value.role);
  if (
    value.pathSlotRef === expected.pathSlotRef
    && value.normalizedLocator === expected.normalizedLocator
  ) return;
  context.addIssue({
    code: "custom",
    path: ["pathSlotRef"],
    message: "Resolved scaffold role must map to its exact V2 path slot and locator",
  });
});

const SelectedEntrypointBindingV2Schema = z.object({
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  normalizedLocator: z.enum(["src/cli.ts", "src/app.ts"]),
  requiredBaseState: z.literal("absent"),
  finalOwnerRef: z.literal("NODE_ENTRYPOINT_GENERATOR_V2"),
  modelWriteAuthority: z.literal("forbidden"),
}).strict();

const SemanticRequirementBindingV2Schema = z.object({
  intentRef: StableReferenceSchema,
  requirementHash: Sha256Schema,
  ruleRef: StableReferenceSchema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  expectationKind: z.literal("shared_structural_selected_entrypoint"),
  entrypointKind: z.enum(["cli", "api"]),
  requiredAuthority: z.literal("node_execution_path_token_v2"),
  resolvedPathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
  ]),
  resolvedPathToken: Sha256Schema,
  resolvedTokenBindingHash: Sha256Schema,
  compatibilityStatus: z.literal("current_v1_rule_unmigrated_v2_activation_forbidden"),
}).strict();

export function hashNodeScaffoldSemanticRequirementMembershipV2(
  bindings: readonly z.infer<typeof SemanticRequirementBindingV2Schema>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-semantic-requirement-membership-hash.v2",
    bindings: bindings.map((binding) => ({
      intentRef: binding.intentRef,
      requirementHash: binding.requirementHash,
      resolvedPathToken: binding.resolvedPathToken,
    })),
  });
}

const ResolutionIdentityV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_V2_SCHEMA),
  resolutionVersion: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2),
  readiness: ReadinessV2Schema,
  sourceAuthority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: z.enum([
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
    ]),
    stackPackId: z.enum(["node-cli", "node-express-api"]),
    layoutHash: Sha256Schema,
    pathTokenContractVersion: z.literal(PATH_TOKEN_CONTRACT_VERSION_V2),
    pathTokenContractHash: z.literal(PATH_TOKEN_CONTRACT_HASH_V2),
    pathTokenSetVersion: z.literal(PATH_TOKEN_SET_VERSION_V2),
    pathTokenSetHash: Sha256Schema,
    semanticPathTokenContractVersion: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_VERSION_V2,
    ),
    semanticPathTokenContractHash: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
    ),
    semanticPathTokenSetVersion: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
    ),
    semanticPathTokenSetContractHash: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2,
    ),
    semanticPathTokenSetHash: Sha256Schema,
    semanticRuleSetHash: Sha256Schema,
  }).strict(),
  catalogBinding: z.object({
    catalogVersion: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2),
    catalogHash: Sha256Schema,
    entryRef: z.enum(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2),
    entryHash: Sha256Schema,
  }).strict(),
  fileBindingCount: z.literal(3),
  fileBindings: z.array(ResolvedFileBindingV2Schema).length(3),
  selectedEntrypoint: SelectedEntrypointBindingV2Schema,
  semanticRequirementBindingCount: z.number().int().positive().max(20_000),
  semanticRequirementBindings: z.array(SemanticRequirementBindingV2Schema)
    .min(1).max(20_000),
  semanticRequirementMembershipHash: Sha256Schema,
}).strict();

export type NodeScaffoldToolchainResolutionHashPayloadV2 = z.infer<
  typeof ResolutionIdentityV2Schema
>;

export function hashNodeScaffoldToolchainResolutionV2(
  value:
    | NodeScaffoldToolchainResolutionHashPayloadV2
    | NodeScaffoldToolchainResolutionV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.resolutionHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-toolchain-resolution-hash.v2",
    resolution: payload,
  });
}

const ResolutionCandidateV2Schema = ResolutionIdentityV2Schema.extend({
  resolutionHash: Sha256Schema,
}).strict();

export type NodeScaffoldToolchainResolutionV2 = z.infer<
  typeof ResolutionCandidateV2Schema
>;

const ResolutionContentV2Schema = ResolutionCandidateV2Schema.superRefine(
  (value, context) => {
    const expected = value.sourceAuthority.stackPackId === "node-cli"
      ? {
          profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
          entryRef: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[0],
          sourceSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
          sourceLocator: "src/cli.ts",
          entrypointKind: "cli",
        }
      : {
          profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
          entryRef: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[1],
          sourceSlotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
          sourceLocator: "src/app.ts",
          entrypointKind: "api",
        };
    const fileRoles = value.fileBindings.map((binding) => binding.role);
    const filePathTokens = value.fileBindings.map((binding) => binding.pathToken);
    const fileTokenBindingHashes = value.fileBindings.map((binding) =>
      binding.tokenBindingHash);
    const requirementRefs = value.semanticRequirementBindings.map((binding) =>
      binding.intentRef);
    if (
      value.sourceAuthority.profileId !== expected.profileId
      || value.catalogBinding.entryRef !== expected.entryRef
      || value.selectedEntrypoint.pathSlotRef !== expected.sourceSlotRef
      || value.selectedEntrypoint.normalizedLocator !== expected.sourceLocator
      || canonicalJsonStringify(fileRoles) !== canonicalJsonStringify([
        "package_manifest",
        "dependency_lock_manifest",
        "typescript_compiler_config",
      ])
      || !hasUniqueStrings(filePathTokens)
      || !hasUniqueStrings(fileTokenBindingHashes)
      || filePathTokens.includes(value.selectedEntrypoint.pathToken)
      || fileTokenBindingHashes.includes(
        value.selectedEntrypoint.tokenBindingHash,
      )
      || value.semanticRequirementBindingCount
        !== value.semanticRequirementBindings.length
      || !hasUniqueStrings(requirementRefs)
      || requirementRefs.some((item, index) =>
        index > 0 && requirementRefs[index - 1]! >= item)
      || value.semanticRequirementBindings.some((binding) =>
        binding.entrypointKind !== expected.entrypointKind
        || binding.resolvedPathSlotRef !== value.selectedEntrypoint.pathSlotRef
        || binding.resolvedPathToken !== value.selectedEntrypoint.pathToken
        || binding.resolvedTokenBindingHash
          !== value.selectedEntrypoint.tokenBindingHash)
      || value.semanticRequirementMembershipHash
        !== hashNodeScaffoldSemanticRequirementMembershipV2(
          value.semanticRequirementBindings,
        )
      || value.resolutionHash !== hashNodeScaffoldToolchainResolutionV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["resolutionHash"],
        message: "Node scaffold resolution must bind the complete exact path and semantic closure",
      });
    }
  },
);

const BoundedResolutionV2Schema = z.unknown().superRefine((value, context) => {
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_MAX_CANONICAL_BYTES_V2,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch {
    context.addIssue({
      code: "custom",
      message: "Node scaffold resolution exceeds canonical byte or work limits",
    });
  }
});

export const NodeScaffoldToolchainResolutionV2Schema =
  BoundedResolutionV2Schema.pipe(ResolutionContentV2Schema);
