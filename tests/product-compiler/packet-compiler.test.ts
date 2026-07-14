import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import { produceRuntimeDataContractV1 } from "../../src/product-compiler/producers/runtime-data-contract.js";
import { hashRuntimeDataContractV1 } from "../../src/product-compiler/schemas/runtime-data-contract-v1.js";
import {
  buildMinimalValidContracts,
  buildMinimalValidV3ProductSpec,
} from "./fixtures/minimal-valid-contract.js";

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

function v3CompilerInput(store: ContentAddressedArtifactStore) {
  const input = compilerInput(store);
  input.productSpec = buildMinimalValidV3ProductSpec();
  input.designGraph.bindings[0]!.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
  input.storyPlan.stories[0]!.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
  const runtimeData = produceRuntimeDataContractV1({
    productSpec: input.productSpec,
    commands: input.buildTopology.commands,
  });
  assert.equal(runtimeData.status, "produced", JSON.stringify(runtimeData));
  if (runtimeData.status !== "produced") throw new Error("runtime-data fixture rejected");
  Object.assign(input.buildTopology, {
    runtimeDataContract: runtimeData.contract,
    runtimeDataContractHash: runtimeData.contractHash,
  });
  return input;
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

  it("seals the exact topology runtime-data hash into a v3 Product Build Packet", async () => {
    const artifactStore = await store();
    const input = v3CompilerInput(artifactStore);
    const result = await compileProductBuildPacket(input);
    assert.equal(result.status, "sealed", JSON.stringify(result.report.diagnostics));
    assert.equal(result.packet?.runtimeDataContractHash, input.buildTopology.runtimeDataContractHash);
    assert.equal(result.packet?.validationIds.includes("VALIDATE_RUNTIME_DATA_CLOSURE"), true);
  });

  it("fails v3 packet sealing on runtime-data omission and ProductSpec drift", async () => {
    const artifactStore = await store();
    const omitted = v3CompilerInput(artifactStore);
    delete omitted.buildTopology.runtimeDataContract;
    delete omitted.buildTopology.runtimeDataContractHash;
    const missing = await compileProductBuildPacket(omitted);
    assert.equal(missing.status, "rejected");
    assert.equal(
      missing.report.diagnostics.some((item) => item.code === "CONTRACT_RUNTIME_DATA_MISSING"),
      true,
    );

    const drifted = v3CompilerInput(artifactStore);
    drifted.buildTopology.runtimeDataContract!.sourceProductSpecHash = "f".repeat(64);
    drifted.buildTopology.runtimeDataContractHash = hashRuntimeDataContractV1(
      drifted.buildTopology.runtimeDataContract,
    );
    const drift = await compileProductBuildPacket(drifted);
    assert.equal(drift.status, "rejected");
    assert.equal(
      drift.report.diagnostics.some((item) => item.code === "RUNTIME_DATA_CONTRACT_PRODUCT_DRIFT"),
      true,
    );
  });
});
