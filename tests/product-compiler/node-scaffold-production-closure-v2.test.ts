import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NodeScaffoldProductionClosureErrorV2,
  deriveCodeOwnedNodeScaffoldProductionClosureV2,
  verifyCodeOwnedNodeScaffoldProductionClosureV2,
} from "../../src/product-compiler/node-scaffold-production-closure-v2.js";
import {
  NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2,
  NodeScaffoldProductionClosureV2Schema,
  hashNodeScaffoldProductionClosureV2,
  type NodeScaffoldProductionClosureV2,
} from "../../src/product-compiler/schemas/node-scaffold-production-closure-v2.js";

const CLI_PROFILE = "PROFILE_NODE_CLI_STATELESS_EXACT_V2";
const API_PROFILE = "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";

const CONTRACT_HASH_GOLDEN_V2 =
  "06b0802487d35d1e889103bc518a862b8b3f8b0378c7e717e49a75d6b6057288";
const CLI_CLOSURE_GOLDEN_V2 = Object.freeze({
  roots: 0,
  nodes: 0,
  edges: 0,
  rootHash: "eec04cad006bcaca6c4a865da62bd77ad64fa306dda6d31e7acbc411f71ba3dc",
  nodeHash: "8e39bba4518b438984bceb09cebfea4d8ee03224a85772c7b2ba3927296159cf",
  edgeHash: "9d4bd13efc18f4f6473d0c6114f47ab16b21ee7afab3f94c21b7ddf17d96d415",
  closureHash: "0ba2b42f17dfa0384329cf24079bb6578e61c3ee3367edd84430dc0eb572b679",
});
const API_CLOSURE_GOLDEN_V2 = Object.freeze({
  roots: 1,
  nodes: 67,
  edges: 124,
  rootHash: "fa507933da11a842dd8eb8f56e0931a8e40489b9c51625e7b964d57c16bab79c",
  nodeHash: "29b5b86ff245b06b8a20075e0438ef7a273a2ad543ec80ba4eb2691c7e3ae89f",
  edgeHash: "489780d3f8fb01a099da6d9b403f6d0bdda5414074d2f0922917b83ec68c1463",
  closureHash: "2c5308924fcce031076b5ef444b13312f16f9f0115ad9033c724327c9208a1e1",
});

function identity(value: Readonly<NodeScaffoldProductionClosureV2>) {
  return {
    roots: value.rootDependencyCount,
    nodes: value.nodeCount,
    edges: value.edgeCount,
    rootHash: value.rootMembershipHash,
    nodeHash: value.nodeMembershipHash,
    edgeHash: value.edgeMembershipHash,
    closureHash: value.closureHash,
  };
}

function rehash(
  value: NodeScaffoldProductionClosureV2,
): NodeScaffoldProductionClosureV2 {
  value.closureHash = hashNodeScaffoldProductionClosureV2(value);
  return value;
}

function expectCode(
  operation: () => unknown,
  code: NodeScaffoldProductionClosureErrorV2["code"],
): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof NodeScaffoldProductionClosureErrorV2
    && error.code === code);
}

describe("Node scaffold production closure V2", () => {
  it("projects literal code-owned CLI and API production closures", () => {
    const cli = deriveCodeOwnedNodeScaffoldProductionClosureV2(CLI_PROFILE);
    const api = deriveCodeOwnedNodeScaffoldProductionClosureV2(API_PROFILE);

    assert.equal(
      NODE_SCAFFOLD_PRODUCTION_CLOSURE_CONTRACT_HASH_V2,
      CONTRACT_HASH_GOLDEN_V2,
    );
    assert.deepEqual(identity(cli), CLI_CLOSURE_GOLDEN_V2);
    assert.deepEqual(identity(api), API_CLOSURE_GOLDEN_V2);
    assert.deepEqual(cli.rootDependencies, []);
    assert.deepEqual(cli.nodes, []);
    assert.deepEqual(cli.edges, []);
    assert.deepEqual(api.rootDependencies.map((root) => ({
      packageName: root.packageName,
      exactVersion: root.exactVersion,
      resolvedPackagePath: root.resolvedPackagePath,
    })), [{
      packageName: "express",
      exactVersion: "5.2.1",
      resolvedPackagePath: "node_modules/express",
    }]);
    assert.equal(api.nodes.every((node) => !node.dev), true);
    assert.equal(api.edges.every((edge) => edge.kind === "dependencies"), true);
    assert.equal(api.nodes.some((node) =>
      node.packageName === "typescript"
      || node.packageName.startsWith("@types/")), false);
    assert.equal(Object.isFrozen(api), true);
    assert.equal(Object.isFrozen(api.nodes), true);
    assert.equal(
      verifyCodeOwnedNodeScaffoldProductionClosureV2(api).closureHash,
      api.closureHash,
    );
  });

  it("rejects unsupported profiles and fresh-authority mismatches", () => {
    expectCode(
      () => deriveCodeOwnedNodeScaffoldProductionClosureV2("PROFILE_FORGED"),
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_PROFILE_UNSUPPORTED",
    );

    const graphDrift = structuredClone(
      deriveCodeOwnedNodeScaffoldProductionClosureV2(API_PROFILE),
    );
    graphDrift.sourceGraph.graphHash = "b".repeat(64);
    rehash(graphDrift);
    assert.equal(NodeScaffoldProductionClosureV2Schema.safeParse(graphDrift).success,
      true);
    expectCode(
      () => verifyCodeOwnedNodeScaffoldProductionClosureV2(graphDrift),
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_AUTHORITY_MISMATCH",
    );

    const crossProfile = structuredClone(
      deriveCodeOwnedNodeScaffoldProductionClosureV2(API_PROFILE),
    );
    crossProfile.profileBinding.profileId = CLI_PROFILE;
    crossProfile.profileBinding.entryRef =
      "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2";
    crossProfile.profileBinding.stackPackId = "node-cli";
    rehash(crossProfile);
    assert.equal(NodeScaffoldProductionClosureV2Schema.safeParse(crossProfile).success,
      true);
    expectCode(
      () => verifyCodeOwnedNodeScaffoldProductionClosureV2(crossProfile),
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_AUTHORITY_MISMATCH",
    );
  });

  it("rejects development nodes, edge downgrades and oversized candidates", () => {
    const developmentNode = structuredClone(
      deriveCodeOwnedNodeScaffoldProductionClosureV2(API_PROFILE),
    );
    developmentNode.nodes[0]!.dev = true;
    rehash(developmentNode);
    assert.equal(
      NodeScaffoldProductionClosureV2Schema.safeParse(developmentNode).success,
      false,
    );
    expectCode(
      () => verifyCodeOwnedNodeScaffoldProductionClosureV2(developmentNode),
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_CANDIDATE_INVALID",
    );

    const developmentEdge = structuredClone(
      deriveCodeOwnedNodeScaffoldProductionClosureV2(API_PROFILE),
    );
    developmentEdge.edges[0]!.kind = "devDependencies";
    rehash(developmentEdge);
    assert.equal(
      NodeScaffoldProductionClosureV2Schema.safeParse(developmentEdge).success,
      false,
    );

    expectCode(
      () => verifyCodeOwnedNodeScaffoldProductionClosureV2({
        padding: "x".repeat(3 * 1024 * 1024),
      }),
      "NODE_SCAFFOLD_PRODUCTION_CLOSURE_V2_CANDIDATE_INVALID",
    );
  });
});
