import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

function compilerInput(store: ContentAddressedArtifactStore) {
  const values = buildMinimalValidContracts();
  return {
    productSpec: values.productSpec,
    designGraph: values.designGraph,
    buildTopology: values.buildTopology,
    storyPlan: values.storyPlan,
    compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
    producer: {
      pass: "product-packet-compiler",
      codeSha: "5840ae3",
      toolVersions: { zod: "4.4.3" },
    },
    parentPacketHashes: [],
    artifactStore: store,
  };
}

describe("Product Build Packet compiler", () => {
  const roots: string[] = [];

  async function store(): Promise<ContentAddressedArtifactStore> {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-packet-compiler-"));
    roots.push(root);
    return new ContentAddressedArtifactStore(path.join(root, "artifacts"));
  }

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("seals and stores one complete packet deterministically", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore);
    const before = structuredClone({
      productSpec: input.productSpec,
      designGraph: input.designGraph,
      buildTopology: input.buildTopology,
      storyPlan: input.storyPlan,
    });

    const first = await compileProductBuildPacket(input);
    const second = await compileProductBuildPacket(input);

    assert.equal(first.status, "sealed");
    assert.equal(second.status, "sealed");
    assert.equal(second.packetHash, first.packetHash);
    assert.equal(second.reportHash, first.reportHash);
    assert.deepEqual(second.packet, first.packet);
    assert.deepEqual(first.report.diagnostics, []);
    assert.equal("sealedAt" in first.packet!, false);
    assert.deepEqual({
      productSpec: input.productSpec,
      designGraph: input.designGraph,
      buildTopology: input.buildTopology,
      storyPlan: input.storyPlan,
    }, before);

    const storedPacket = await artifactStore.get(first.packetHash!);
    assert.equal(storedPacket.envelope.artifactType, "setfarm.product-build-packet.v1");
    assert.deepEqual(storedPacket.envelope.payload, first.packet);
  });

  it("rejects unresolved controls without writing a packet manifest", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore);
    const binding = input.designGraph.bindings.shift()!;
    input.designGraph.unresolvedBindings.push({
      controlRef: binding.controlRef,
      code: "LINK_SEMANTIC_ACTION_MISSING",
      provenance: [],
      suggestions: [],
    });

    const result = await compileProductBuildPacket(input);

    assert.equal(result.status, "rejected");
    assert.equal(result.packet, undefined);
    assert.equal(result.packetHash, undefined);
    assert.equal(
      result.report.diagnostics.some((item) => item.code === "LINK_UNRESOLVED_CONTROL"),
      true,
    );
    const files = await readdir(artifactStore.root);
    assert.equal(files.length, 5, "four valid children plus one rejection report");
    const artifactTypes = await Promise.all(files.map(async (file) =>
      (await artifactStore.get(file.replace(/\.json$/, ""))).envelope.artifactType));
    assert.equal(artifactTypes.includes("setfarm.product-build-packet.v1"), false);
    assert.equal(artifactTypes.includes("setfarm.product-compilation-report.v1"), true);
  });

  it("rejects incomplete action input/value binding", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore);
    input.designGraph.bindings[0]!.inputBindings = [];

    const result = await compileProductBuildPacket(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.diagnostics.some((item) => item.code === "LINK_ACTION_INPUT_BINDING_MISSING"),
      true,
    );
  });

  it("rejects story refs that do not resolve to ProductSpec", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore);
    input.storyPlan.stories[0]!.actionRefs = ["ACT_MISSING"];

    const result = await compileProductBuildPacket(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.diagnostics.some((item) => item.code === "CONTRACT_STORY_ACTION_REF_UNRESOLVED"),
      true,
    );
  });

  it("rejects a required surface with no story partition", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore);
    input.storyPlan.stories[0]!.surfaceRefs = [];

    const result = await compileProductBuildPacket(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.diagnostics.some((item) =>
        item.code === "CONTRACT_REQUIRED_SURFACE_UNOWNED"
        && item.reference === "SURF_EDITOR"),
      true,
    );
  });

  it("rejects required evidence whose stack capability is absent or disabled", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore);
    input.buildTopology.capabilities.find((item) =>
      item.id === "CAP_LOCAL_PERSISTENCE")!.enabled = false;

    const result = await compileProductBuildPacket(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.diagnostics.some((item) =>
        item.code === "CONTRACT_EVIDENCE_CAPABILITY_UNAVAILABLE"
        && item.reference === "CAP_LOCAL_PERSISTENCE"),
      true,
    );
  });

  it("rejects strict child schema errors but still stores a stable report", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore) as ReturnType<typeof compilerInput> & {
      productSpec: ReturnType<typeof compilerInput>["productSpec"] & { runId?: string };
    };
    input.productSpec.runId = "operational-run-must-not-enter";

    const first = await compileProductBuildPacket(input);
    const second = await compileProductBuildPacket(input);
    assert.equal(first.status, "rejected");
    assert.equal(second.reportHash, first.reportHash);
    assert.equal(
      first.report.diagnostics.some((item) => item.code === "CONTRACT_PRODUCT_SPEC_SCHEMA_INVALID"),
      true,
    );
  });

  it("rejects producer/compiler revision disagreement", async () => {
    const artifactStore = await store();
    const input = compilerInput(artifactStore);
    input.producer.codeSha = "1111111";

    const result = await compileProductBuildPacket(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.diagnostics.some((item) =>
        item.code === "CONTRACT_COMPILER_PRODUCER_REVISION_MISMATCH"),
      true,
    );
  });
});
