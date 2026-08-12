import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceBuildTopologyV1 } from "../../src/product-compiler/producers/build-topology.js";
import {
  buildMinimalValidContracts,
  buildMinimalValidV3ProductSpec,
} from "./fixtures/minimal-valid-contract.js";
import { buildContainedGameProductSpecV2 } from "./fixtures/product-semantics-v2.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function producerInput() {
  const topology = clone(buildMinimalValidContracts().buildTopology);
  topology.pathBindings[0]!.role = "entrypoint";
  return {
    stackContract: {
      identity: topology.stackPack,
      capabilities: topology.capabilities.map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        required: true,
        providers: [],
      })),
      entrypointKinds: ["web" as const],
      commandKinds: ["build" as const, "test" as const, "preview" as const],
      requiredCommandKinds: ["build" as const, "test" as const, "preview" as const],
      requiredPathRoles: ["entrypoint" as const],
      packageManagers: ["npm" as const],
    },
    repo: topology.repo,
    owners: topology.owners,
    pathBindings: topology.pathBindings,
    sharedGrants: topology.sharedGrants,
    entrypoints: topology.entrypoints,
    commands: topology.commands,
    capabilities: topology.capabilities,
    policies: topology.policies,
  };
}

describe("typed build-topology producer", () => {
  it("produces a deterministic topology from exact stack, repo, role, and command contracts", () => {
    const input = producerInput();
    input.commands.reverse();
    input.capabilities.reverse();
    const first = produceBuildTopologyV1(input);
    const second = produceBuildTopologyV1(clone(input));

    assert.equal(first.status, "produced");
    assert.equal(second.status, "produced");
    if (first.status !== "produced" || second.status !== "produced") return;
    assert.deepEqual(second.buildTopology, first.buildTopology);
    assert.deepEqual(first.buildTopology.commands.map((command) => command.id), ["CMD_BUILD", "CMD_PREVIEW", "CMD_TEST"]);
    assert.equal(first.buildTopology.repo.baseSha, "1".repeat(40));
    assert.equal(first.buildTopology.repo.treeHash, "2".repeat(40));
    assert.equal(first.buildTopology.pathBindings[0]?.role, "entrypoint");
  });

  it("rejects path collisions, path overlap, and a missing stack-required role", () => {
    const input = producerInput();
    input.stackContract.requiredPathRoles.push("test");
    input.owners.push({ id: "OWNER_US_002", kind: "story", storyRef: "US-002" });
    input.pathBindings.push({
      id: "PATH_COLLISION",
      path: "src/App.tsx",
      role: "source",
      ownerRef: "OWNER_US_002",
      presence: "present",
      knownContentHash: "a".repeat(64),
    });
    input.pathBindings.push({
      id: "PATH_OVERLAP",
      path: "src/App.tsx/child.ts",
      role: "source",
      ownerRef: "OWNER_US_002",
      presence: "present",
      knownContentHash: "b".repeat(64),
    });

    const result = produceBuildTopologyV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_PATH_COLLISION"), true);
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_PATH_OVERLAP"), true);
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_REQUIRED_ROLE_MISSING"), true);
  });

  it("rejects owners without paths and grants for paths the source owner does not own", () => {
    const input = producerInput();
    input.owners.push({ id: "OWNER_US_002", kind: "story", storyRef: "US-002" });
    input.sharedGrants.push({
      id: "GRANT_APP_TO_SECOND",
      fromOwnerRef: "OWNER_US_002",
      toOwnerRef: "OWNER_US_001",
      pathRefs: ["PATH_APP"],
      permissions: ["read"],
    });

    const result = produceBuildTopologyV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_OWNER_PATH_MISSING"), true);
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_GRANT_SOURCE_OWNER_MISMATCH"), true);
  });

  it("rejects unsupported, mismatched, disabled, and undeclared command capabilities", () => {
    const input = producerInput();
    input.capabilities[0]!.enabled = false;
    input.capabilities.push({
      id: "CAP_NETWORK_ACCESS",
      kind: "network",
      enabled: true,
      provider: "unknown-provider",
    });
    input.commands[0]!.capabilityRefs = [input.capabilities[0]!.id, "CAP_NETWORK_ACCESS"];

    const result = produceBuildTopologyV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_CAPABILITY_UNSUPPORTED"), true);
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_REQUIRED_CAPABILITY_UNAVAILABLE"), true);
    assert.equal(result.rejectionCodes.includes("BUILD_TOPOLOGY_COMMAND_CAPABILITY_UNAVAILABLE"), true);
  });

  it("fails closed on incomplete repo identity instead of manufacturing a revision", () => {
    const input = producerInput() as ReturnType<typeof producerInput> & {
      repo: ReturnType<typeof producerInput>["repo"] & { baseSha?: string };
    };
    delete input.repo.baseSha;
    const result = produceBuildTopologyV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["BUILD_TOPOLOGY_INPUT_INVALID"]);
  });

  it("embeds one canonical browser-origin runtime-data contract for a v3 ProductSpec", () => {
    const input = producerInput();
    Object.assign(input, { productSpec: buildMinimalValidV3ProductSpec() });
    const first = produceBuildTopologyV1(input);
    const second = produceBuildTopologyV1(clone(input));
    assert.equal(first.status, "produced", JSON.stringify(first));
    assert.equal(second.status, "produced", JSON.stringify(second));
    if (first.status !== "produced" || second.status !== "produced") return;
    assert.equal(first.buildTopology.runtimeDataContractHash, second.buildTopology.runtimeDataContractHash);
    assert.equal(first.buildTopology.runtimeDataContract?.authorities[0]?.kind, "browser-origin");
    assert.deepEqual(first.buildTopology.runtimeDataContract?.writableVolumes, []);
  });

  it("embeds an exact runtime-data v1 projection from native ProductSpecV2", () => {
    const input = producerInput();
    const productSpec = buildContainedGameProductSpecV2();
    Object.assign(input, { productSpec });

    const result = produceBuildTopologyV1(input);
    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.equal(result.buildTopology.schema, "setfarm.build-topology.v1");
    assert.equal(result.buildTopology.runtimeDataContract?.schema, "setfarm.runtime-data-contract.v1");
    assert.equal(result.buildTopology.runtimeDataContract?.sourceProductSpecHash, hashCanonicalJson(productSpec));
    assert.deepEqual(result.buildTopology.runtimeDataContract?.authorities, [{
      id: "AUTH_DATA_STATELESS_NONE",
      kind: "stateless",
      durability: "none",
      persistenceRefs: [],
    }]);
  });

  it("keeps legacy topology absence explicit and rejects provisioning without v3 ProductSpec authority", () => {
    const legacy = producerInput();
    Object.assign(legacy, { productSpec: buildMinimalValidContracts().productSpec });
    const compatible = produceBuildTopologyV1(legacy);
    assert.equal(compatible.status, "produced", JSON.stringify(compatible));
    if (compatible.status === "produced") {
      assert.equal(compatible.buildTopology.runtimeDataContract, undefined);
      assert.equal(compatible.buildTopology.runtimeDataContractHash, undefined);
    }

    Object.assign(legacy, {
      runtimeDataProvisioning: {
        schema: "setfarm.runtime-data-provisioning.v1",
        writableVolumes: [],
        externalDatabases: [],
        scratch: { kind: "none" },
      },
    });
    const rejected = produceBuildTopologyV1(legacy);
    assert.equal(rejected.status, "rejected");
    if (rejected.status === "rejected") {
      assert.deepEqual(rejected.rejectionCodes, ["BUILD_TOPOLOGY_RUNTIME_DATA_PROTOCOL_INVALID"]);
    }
  });
});
