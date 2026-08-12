import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../canonical-json.js";
import {
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2,
  NodeScaffoldDependencyEdgeV2Schema,
  NodeScaffoldDependencyNodeV2Schema,
} from "./node-scaffold-toolchain-catalog-v2.js";

export const NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SCHEMA =
  "setfarm.node-scaffold-production-closure.v2" as const;
export const NODE_SCAFFOLD_PRODUCTION_CLOSURE_VERSION_V2 = "2.0.0" as const;
export const NODE_SCAFFOLD_PRODUCTION_CLOSURE_AUTHORITY_REF_V2 =
  "AUTH_NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2" as const;
export const NODE_SCAFFOLD_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2 =
  2 * 1024 * 1024;

export const NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.node-scaffold-production-closure-contract.v2" as const,
  contractVersion: NODE_SCAFFOLD_PRODUCTION_CLOSURE_VERSION_V2,
  authorityRef: NODE_SCAFFOLD_PRODUCTION_CLOSURE_AUTHORITY_REF_V2,
  sourceAuthority: "fresh_code_owned_node_scaffold_lock_graph_v2" as const,
  projectionAlgorithm:
    "root_runtime_edges_then_transitive_dependency_edges_v2" as const,
  rootSelection: "dependencies_only" as const,
  transitiveSelection: "dependencies_only" as const,
  developmentNodes: "forbidden" as const,
  emptyProductionClosure: "allowed" as const,
  callerGraphOrPackageSelection: "forbidden" as const,
  installedBytesAuthority: "not_claimed_by_projection" as const,
  hashDomains: Object.freeze({
    rootMembership:
      "setfarm.node-scaffold-production-root-membership-hash.v2" as const,
    nodeMembership:
      "setfarm.node-scaffold-production-node-membership-hash.v2" as const,
    edgeMembership:
      "setfarm.node-scaffold-production-edge-membership-hash.v2" as const,
    closure: "setfarm.node-scaffold-production-closure-hash.v2" as const,
  }),
} as const);

export const NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2 =
  hashCanonicalJson(NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_V2);

const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);

const RootRuntimeDependencyV2Schema = z.object({
  packageName: z.string().min(1).max(214),
  exactVersion: z.string().max(64)
    .regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u),
  resolvedPackagePath: z.string().min(1).max(1_000),
  resolvedVersion: z.string().max(64)
    .regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u),
  lockEntryHash: Sha256Schema,
}).strict();

export type NodeScaffoldProductionRootDependencyV2 = z.infer<
  typeof RootRuntimeDependencyV2Schema
>;

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function edgeKey(edge: z.infer<typeof NodeScaffoldDependencyEdgeV2Schema>): string {
  return [
    edge.ownerPackagePath,
    edge.kind,
    edge.dependencyName,
    edge.resolvedPackagePath,
  ].join("\0");
}

function canonicalUnique(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

export function hashNodeScaffoldProductionRootMembershipV2(
  roots: readonly NodeScaffoldProductionRootDependencyV2[],
): string {
  return hashCanonicalJson({
    schema: NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_V2
      .hashDomains.rootMembership,
    roots,
  });
}

export function hashNodeScaffoldProductionNodeMembershipV2(
  nodes: readonly z.infer<typeof NodeScaffoldDependencyNodeV2Schema>[],
): string {
  return hashCanonicalJson({
    schema: NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_V2
      .hashDomains.nodeMembership,
    nodes: nodes.map((node) => ({
      packagePath: node.packagePath,
      lockEntryHash: node.lockEntryHash,
    })),
  });
}

export function hashNodeScaffoldProductionEdgeMembershipV2(
  edges: readonly z.infer<typeof NodeScaffoldDependencyEdgeV2Schema>[],
): string {
  return hashCanonicalJson({
    schema: NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_V2
      .hashDomains.edgeMembership,
    edges,
  });
}

const ProductionClosureIdentityV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SCHEMA),
  version: z.literal(NODE_SCAFFOLD_PRODUCTION_CLOSURE_VERSION_V2),
  contractHash: z.literal(NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2),
  producer: z.object({
    authorityRef: z.literal(
      NODE_SCAFFOLD_PRODUCTION_CLOSURE_AUTHORITY_REF_V2,
    ),
    kind: z.literal("code_owned_lock_graph_projection"),
    algorithm: z.literal(
      "root_runtime_edges_then_transitive_dependency_edges_v2",
    ),
    callerGraphOrPackageSelection: z.literal("forbidden"),
  }).strict(),
  profileBinding: z.object({
    profileId: ProfileIdV2Schema,
    entryRef: z.enum(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2),
    entryHash: Sha256Schema,
    stackPackId: z.enum(["node-cli", "node-express-api"]),
    catalogVersion: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2),
    catalogHash: Sha256Schema,
  }).strict(),
  sourceGraph: z.object({
    graphHash: Sha256Schema,
    lockRawHash: Sha256Schema,
    rootManifestRawHash: Sha256Schema,
    lockRootHash: Sha256Schema,
    nodeCount: z.number().int().positive().max(1_000),
    edgeCount: z.number().int().positive().max(4_000),
    nodeMembershipHash: Sha256Schema,
    edgeMembershipHash: Sha256Schema,
  }).strict(),
  policy: z.object({
    rootSelection: z.literal("dependencies_only"),
    transitiveSelection: z.literal("dependencies_only"),
    graphResolution: z.literal("nearest_node_modules_lock_v3"),
    developmentNodes: z.literal("forbidden"),
    installLifecycle: z.literal("hasInstallScript_absent_in_lock"),
    nativeLockMetadata: z.literal("absent"),
    emptyProductionClosure: z.literal("allowed"),
  }).strict(),
  rootDependencyCount: z.number().int().nonnegative().max(100),
  rootDependencies: z.array(RootRuntimeDependencyV2Schema).max(100),
  nodeCount: z.number().int().nonnegative().max(1_000),
  nodes: z.array(NodeScaffoldDependencyNodeV2Schema).max(1_000),
  edgeCount: z.number().int().nonnegative().max(4_000),
  edges: z.array(NodeScaffoldDependencyEdgeV2Schema).max(4_000),
  rootMembershipHash: Sha256Schema,
  nodeMembershipHash: Sha256Schema,
  edgeMembershipHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedProfile = value.profileBinding.profileId
    === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? {
        entryRef: "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
        stackPackId: "node-cli",
      }
    : {
        entryRef: "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
        stackPackId: "node-express-api",
      };
  if (
    value.profileBinding.entryRef !== expectedProfile.entryRef
    || value.profileBinding.stackPackId !== expectedProfile.stackPackId
  ) {
    context.addIssue({
      code: "custom",
      path: ["profileBinding"],
      message: "Production closure profile must bind its exact scaffold entry",
    });
  }

  const rootKeys = value.rootDependencies.map((root) => root.packageName);
  const nodePaths = value.nodes.map((node) => node.packagePath);
  const edgeKeys = value.edges.map(edgeKey);
  if (!canonicalUnique(rootKeys)) {
    context.addIssue({
      code: "custom",
      path: ["rootDependencies"],
      message: "Production root dependencies must be unique and canonically ordered",
    });
  }
  if (!canonicalUnique(nodePaths)) {
    context.addIssue({
      code: "custom",
      path: ["nodes"],
      message: "Production nodes must be unique and canonically ordered",
    });
  }
  if (!canonicalUnique(edgeKeys)) {
    context.addIssue({
      code: "custom",
      path: ["edges"],
      message: "Production edges must be unique and canonically ordered",
    });
  }
  if (
    value.rootDependencyCount !== value.rootDependencies.length
    || value.nodeCount !== value.nodes.length
    || value.edgeCount !== value.edges.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["nodeCount"],
      message: "Production closure counts must equal their exact arrays",
    });
  }

  const nodes = new Map(value.nodes.map((node) => [node.packagePath, node]));
  if (value.nodes.some((node) =>
    node.dev
    || node.installLifecycle !== "hasInstallScript_absent_in_lock"
    || node.nativeLockMetadata !== "absent")) {
    context.addIssue({
      code: "custom",
      path: ["nodes"],
      message: "Production closure forbids development and unrecognized lifecycle nodes",
    });
  }

  const rootEdges = value.edges.filter((edge) => edge.ownerPackagePath === "");
  const projectedRoots = rootEdges.map((edge) => {
    const node = nodes.get(edge.resolvedPackagePath);
    return node
      ? {
          packageName: edge.dependencyName,
          exactVersion: edge.declaredSpec,
          resolvedPackagePath: edge.resolvedPackagePath,
          resolvedVersion: edge.resolvedVersion,
          lockEntryHash: node.lockEntryHash,
        }
      : null;
  });
  if (
    projectedRoots.some((root) => root === null)
    || canonicalJsonStringify(projectedRoots)
      !== canonicalJsonStringify(value.rootDependencies)
  ) {
    context.addIssue({
      code: "custom",
      path: ["rootDependencies"],
      message: "Production roots must equal every and only exact root edge",
    });
  }

  const reached = new Set<string>();
  const pending = rootEdges.map((edge) => edge.resolvedPackagePath);
  value.edges.forEach((edge, index) => {
    if (
      edge.kind !== "dependencies"
      || !nodes.has(edge.resolvedPackagePath)
      || (edge.ownerPackagePath !== "" && !nodes.has(edge.ownerPackagePath))
    ) {
      context.addIssue({
        code: "custom",
        path: ["edges", index],
        message: "Production edges must stay inside the exact dependency-only closure",
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
      message: "Every and only production node must be reachable from a runtime root",
    });
  }
  if (
    value.rootMembershipHash
      !== hashNodeScaffoldProductionRootMembershipV2(value.rootDependencies)
    || value.nodeMembershipHash
      !== hashNodeScaffoldProductionNodeMembershipV2(value.nodes)
    || value.edgeMembershipHash
      !== hashNodeScaffoldProductionEdgeMembershipV2(value.edges)
  ) {
    context.addIssue({
      code: "custom",
      path: ["nodeMembershipHash"],
      message: "Production closure membership hashes must bind the exact closure",
    });
  }
});

export type NodeScaffoldProductionClosureHashPayloadV2 = z.infer<
  typeof ProductionClosureIdentityV2Schema
>;

export function hashNodeScaffoldProductionClosureV2(
  value:
    | NodeScaffoldProductionClosureHashPayloadV2
    | NodeScaffoldProductionClosureV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.closureHash;
  return hashCanonicalJson({
    schema: NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_V2.hashDomains.closure,
    closure: payload,
  });
}

export const NodeScaffoldProductionClosureV2Schema =
  ProductionClosureIdentityV2Schema.safeExtend({
    closureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.closureHash !== hashNodeScaffoldProductionClosureV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["closureHash"],
        message: "Production closure hash must bind the complete exact projection",
      });
    }
  });

export type NodeScaffoldProductionClosureV2 = z.infer<
  typeof NodeScaffoldProductionClosureV2Schema
>;
