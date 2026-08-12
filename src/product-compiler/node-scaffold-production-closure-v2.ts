import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  type NodeScaffoldProfileIdV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_AUTHORITY_REF_V2,
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2,
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2,
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SCHEMA,
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_VERSION_V2,
  NodeScaffoldProductionClosureV2Schema,
  hashNodeScaffoldProductionClosureV2,
  hashNodeScaffoldProductionEdgeMembershipV2,
  hashNodeScaffoldProductionNodeMembershipV2,
  hashNodeScaffoldProductionRootMembershipV2,
  type NodeScaffoldProductionClosureHashPayloadV2,
  type NodeScaffoldProductionClosureV2,
} from "./schemas/node-scaffold-production-closure-v2.js";

const PROFILE_IDS_V2 = new Set<string>([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);

const VERIFIER_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 8,
  maxNodes: NODE_SCAFFOLD_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2 + 10_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (NODE_SCAFFOLD_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2 * 8)
    + (1024 * 1024),
});

export type NodeScaffoldProductionClosureErrorCodeV2 =
  | "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_AUTHORITY_MISMATCH"
  | "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_CANDIDATE_INVALID"
  | "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_PROFILE_UNSUPPORTED"
  | "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SOURCE_GRAPH_INVALID";

export class NodeScaffoldProductionClosureErrorV2 extends Error {
  constructor(
    readonly code: NodeScaffoldProductionClosureErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "NodeScaffoldProductionClosureErrorV2";
  }
}

function failure(
  code: NodeScaffoldProductionClosureErrorCodeV2,
  message: string,
): never {
  throw new NodeScaffoldProductionClosureErrorV2(code, message);
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function edgeKey(edge: Readonly<{
  ownerPackagePath: string;
  kind: string;
  dependencyName: string;
  resolvedPackagePath: string;
}>): string {
  return [
    edge.ownerPackagePath,
    edge.kind,
    edge.dependencyName,
    edge.resolvedPackagePath,
  ].join("\0");
}

function deepFreezeJson<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreezeJson(nested);
    }
  }
  return value;
}

function boundedSnapshot(input: unknown): unknown {
  const bytes = canonicalJsonBytesBounded(input, {
    maxBytes: NODE_SCAFFOLD_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2,
    ...VERIFIER_WORK_LIMITS_V2,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function normalizeProfileIdV2(profileId: string): NodeScaffoldProfileIdV2 {
  if (!PROFILE_IDS_V2.has(profileId)) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_PROFILE_UNSUPPORTED",
      "Production closure requires one exact code-owned Node scaffold profile",
    );
  }
  return profileId as NodeScaffoldProfileIdV2;
}

export function deriveCodeOwnedNodeScaffoldProductionClosureV2(
  profileId: string,
): Readonly<NodeScaffoldProductionClosureV2> {
  const normalizedProfileId = normalizeProfileIdV2(profileId);
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(normalizedProfileId);
  if (!entry) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SOURCE_GRAPH_INVALID",
      "Code-owned Node scaffold entry is absent for the authenticated profile",
    );
  }

  const graph = entry.dependencyGraph;
  const rootEdges = graph.edges.filter((edge) =>
    edge.ownerPackagePath === "" && edge.kind === "dependencies");
  const reached = new Set(rootEdges.map((edge) => edge.resolvedPackagePath));
  const pending = [...reached];
  while (pending.length > 0) {
    const owner = pending.pop()!;
    for (const edge of graph.edges) {
      if (edge.ownerPackagePath !== owner) continue;
      if (edge.kind !== "dependencies") {
        return failure(
          "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SOURCE_GRAPH_INVALID",
          "A transitive production owner exposed a non-production dependency edge",
        );
      }
      if (!reached.has(edge.resolvedPackagePath)) {
        reached.add(edge.resolvedPackagePath);
        pending.push(edge.resolvedPackagePath);
      }
    }
  }

  const nodes = graph.nodes
    .filter((node) => reached.has(node.packagePath))
    .sort((left, right) => compareUtf16(left.packagePath, right.packagePath));
  const edges = graph.edges
    .filter((edge) =>
      (edge.ownerPackagePath === "" && edge.kind === "dependencies")
      || reached.has(edge.ownerPackagePath))
    .sort((left, right) => compareUtf16(edgeKey(left), edgeKey(right)));
  const nodeByPath = new Map(nodes.map((node) => [node.packagePath, node]));
  if (
    nodes.length !== reached.size
    || nodes.some((node) => node.dev)
    || edges.some((edge) =>
      edge.kind !== "dependencies"
      || !nodeByPath.has(edge.resolvedPackagePath)
      || (edge.ownerPackagePath !== "" && !nodeByPath.has(edge.ownerPackagePath)))
  ) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SOURCE_GRAPH_INVALID",
      "Code-owned lock graph does not project to one exact production-only closure",
    );
  }

  const rootManifest = new Map(graph.root.directDependencies
    .filter((dependency) => dependency.kind === "runtime")
    .map((dependency) => [dependency.packageName, dependency]));
  const rootDependencies = rootEdges.map((edge) => {
    const manifest = rootManifest.get(edge.dependencyName);
    const node = nodeByPath.get(edge.resolvedPackagePath);
    if (
      !manifest
      || !node
      || manifest.exactVersion !== edge.declaredSpec
      || edge.resolvedVersion !== node.version
    ) {
      return failure(
        "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SOURCE_GRAPH_INVALID",
        "Production root manifest, lock edge and lock node do not join exactly",
      );
    }
    return {
      packageName: manifest.packageName,
      exactVersion: manifest.exactVersion,
      resolvedPackagePath: edge.resolvedPackagePath,
      resolvedVersion: edge.resolvedVersion,
      lockEntryHash: node.lockEntryHash,
    };
  }).sort((left, right) => compareUtf16(left.packageName, right.packageName));
  if (rootDependencies.length !== rootManifest.size) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SOURCE_GRAPH_INVALID",
      "Production root projection omitted or invented one runtime dependency",
    );
  }

  const identity: NodeScaffoldProductionClosureHashPayloadV2 = {
    schema: NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SCHEMA,
    version: NODE_SCAFFOLD_PRODUCTION_CLOSURE_VERSION_V2,
    contractHash: NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2,
    producer: {
      authorityRef: NODE_SCAFFOLD_PRODUCTION_CLOSURE_AUTHORITY_REF_V2,
      kind: "code_owned_lock_graph_projection",
      algorithm: "root_runtime_edges_then_transitive_dependency_edges_v2",
      callerGraphOrPackageSelection: "forbidden",
    },
    profileBinding: {
      profileId: entry.profileBinding.profileId,
      entryRef: entry.entryRef,
      entryHash: entry.entryHash,
      stackPackId: entry.profileBinding.stackPackId,
      catalogVersion: entry.profileBinding.catalogVersion,
      catalogHash: entry.profileBinding.catalogHash,
    },
    sourceGraph: {
      graphHash: graph.graphHash,
      lockRawHash: graph.lockRawHash,
      rootManifestRawHash: graph.root.manifestRawHash,
      lockRootHash: graph.root.lockRootHash,
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      nodeMembershipHash: graph.nodeMembershipHash,
      edgeMembershipHash: graph.edgeMembershipHash,
    },
    policy: {
      rootSelection: "dependencies_only",
      transitiveSelection: "dependencies_only",
      graphResolution: "nearest_node_modules_lock_v3",
      developmentNodes: "forbidden",
      installLifecycle: "hasInstallScript_absent_in_lock",
      nativeLockMetadata: "absent",
      emptyProductionClosure: "allowed",
    },
    rootDependencyCount: rootDependencies.length,
    rootDependencies,
    nodeCount: nodes.length,
    nodes,
    edgeCount: edges.length,
    edges,
    rootMembershipHash:
      hashNodeScaffoldProductionRootMembershipV2(rootDependencies),
    nodeMembershipHash: hashNodeScaffoldProductionNodeMembershipV2(nodes),
    edgeMembershipHash: hashNodeScaffoldProductionEdgeMembershipV2(edges),
  };
  const parsed = NodeScaffoldProductionClosureV2Schema.safeParse({
    ...identity,
    closureHash: hashNodeScaffoldProductionClosureV2(identity),
  });
  if (!parsed.success) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_SOURCE_GRAPH_INVALID",
      parsed.error.issues[0]?.message
        ?? "Derived production closure failed its code-owned schema",
    );
  }
  return deepFreezeJson(parsed.data);
}

export function verifyCodeOwnedNodeScaffoldProductionClosureV2(
  candidate: unknown,
): Readonly<NodeScaffoldProductionClosureV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(candidate);
  } catch (error) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_CANDIDATE_INVALID",
      error instanceof Error ? error.message : "Candidate snapshot failed",
    );
  }
  const parsed = NodeScaffoldProductionClosureV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_CANDIDATE_INVALID",
      parsed.error.issues[0]?.message ?? "Production closure candidate is invalid",
    );
  }
  const expected = deriveCodeOwnedNodeScaffoldProductionClosureV2(
    parsed.data.profileBinding.profileId,
  );
  if (canonicalJsonStringify(parsed.data) !== canonicalJsonStringify(expected)) {
    return failure(
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_AUTHORITY_MISMATCH",
      "Production closure candidate differs from fresh code-owned lock authority",
    );
  }
  return deepFreezeJson(parsed.data);
}
