import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compileProductBuildPacketV3 } from "../../src/product-compiler/packet-compiler.js";
import { produceImplementationSourceMapV1 } from "../../src/product-compiler/producers/implementation-source-map-v1.js";
import { ProductCompilationReportV3Schema } from "../../src/product-compiler/schemas/compilation-report-v3.js";
import {
  buildNoDesignProductBuildPacketV3Contracts,
  buildStitchProductBuildPacketV3Contracts,
} from "./fixtures/product-build-packet-v3.js";

const RELEASE_SHA = "c".repeat(40);
const producer = {
  pass: "packet-compiler-v3-test",
  codeSha: RELEASE_SHA,
  toolVersions: { node: process.versions.node },
};
const compiler = { version: "4.0.0", codeSha: RELEASE_SHA };

class MemoryArtifactWriter {
  readonly artifacts = new Map<string, any>();

  async put(value: unknown) {
    const hash = hashCanonicalJson(value);
    const created = !this.artifacts.has(hash);
    this.artifacts.set(hash, structuredClone(value));
    return { hash, path: `memory://${hash}`, created };
  }
}

describe("Product Build Packet v3 compiler", () => {
  it("seals only native v2 authorities and records exact CAS envelope child hashes", async () => {
    const contracts = buildNoDesignProductBuildPacketV3Contracts();
    const expectedSourceMap = produceImplementationSourceMapV1(
      contracts.implementationSourceInputsV1,
    );
    assert.equal(expectedSourceMap.status, "produced");
    if (expectedSourceMap.status !== "produced") return;
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      compiler,
      producer,
      artifactStore,
    });
    assert.equal(result.status, "sealed", JSON.stringify(result.report));
    assert.equal(result.packet?.schema, "setfarm.product-build-packet.v3");
    assert.equal(result.report.schema, "setfarm.product-compilation-report.v3");
    assert.equal(result.report.status, "sealed");
    assert.ok(result.packetHash);
    assert.ok(result.packet);
    if (!result.packet || result.report.status !== "sealed") return;
    assert.equal(result.packet.productSpecV2Hash, result.artifactHashes.productSpecV2);
    assert.equal(result.packet.designGraphV2Hash, null);
    assert.equal(result.packet.buildTopologyV1Hash, result.artifactHashes.buildTopologyV1);
    assert.equal(result.packet.storyPlanV2Hash, result.artifactHashes.storyPlanV2);
    assert.equal(
      result.packet.designSourceClosureV2Hash,
      result.artifactHashes.designSourceClosureV2,
    );
    assert.equal(
      result.packet.implementationSourceMapV1Hash,
      result.artifactHashes.implementationSourceMapV1,
    );
    assert.notEqual(result.packet.productSpecV2Hash, hashCanonicalJson(contracts.productSpecV2));
    assert.notEqual(
      result.packet.implementationSourceMapV1Hash,
      expectedSourceMap.payloadHash,
    );
    assert.deepEqual(result.report.artifactHashes, result.artifactHashes);
    const reportWithoutSourceMap: any = structuredClone(result.report);
    delete reportWithoutSourceMap.artifactHashes.implementationSourceMapV1;
    assert.equal(ProductCompilationReportV3Schema.safeParse(reportWithoutSourceMap).success, false);
    const storedSourceMap = artifactStore.artifacts.get(
      result.packet.implementationSourceMapV1Hash,
    );
    assert.equal(storedSourceMap?.artifactType, "setfarm.implementation-source-map.v1");
    assert.deepEqual(storedSourceMap?.payload, expectedSourceMap.sourceMap);
    assert.equal(
      artifactStore.artifacts.get(result.packetHash)?.artifactType,
      "setfarm.product-build-packet.v3",
    );
  });

  it("rejects ASCII localized ProductSpec V2 prose before publishing the child artifact", async () => {
    const contracts = buildNoDesignProductBuildPacketV3Contracts();
    contracts.productSpecV2.product.name = String.fromCharCode(
      71, 117, 97, 114, 100, 97, 114, 32, 99, 97, 109, 98, 105, 111, 115,
    );
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      compiler,
      producer,
      artifactStore,
    });

    assert.equal(result.status, "rejected");
    assert.equal(result.report.diagnostics.some((item) =>
      item.code === "CONTRACT_V3_PRODUCT_SPEC_SCHEMA_INVALID"), true);
    assert.equal([...artifactStore.artifacts.values()].some((envelope) =>
      envelope.artifactType === "setfarm.product-spec.v2"), false);
  });

  it("seals the exact Stitch graph envelope and closure without v1 graph adaptation", async () => {
    const contracts = await buildStitchProductBuildPacketV3Contracts(producer);
    const expectedSourceMap = produceImplementationSourceMapV1(
      contracts.implementationSourceInputsV1,
    );
    assert.equal(expectedSourceMap.status, "produced");
    if (expectedSourceMap.status !== "produced") return;
    const forgedPrecomputedMap: any = structuredClone(expectedSourceMap.sourceMap);
    forgedPrecomputedMap.screens[0].path = "src/Forged.tsx";
    forgedPrecomputedMap.screens[0].storyId = "US-999";
    forgedPrecomputedMap.screens[0].targetHash = "f".repeat(64);
    forgedPrecomputedMap.screens[0].controls[0].generatedSelector = "#forged";
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      implementationSourceMapV1: forgedPrecomputedMap,
      compiler,
      producer,
      artifactStore,
    } as any);
    assert.equal(result.status, "sealed", JSON.stringify(result.report));
    assert.equal(result.packet?.designSourceKind, "stitch");
    assert.ok(result.packet?.designGraphV2Hash);
    assert.equal(result.packet?.designGraphV2Hash, result.artifactHashes.designGraphV2);
    assert.equal(
      result.packet?.implementationSourceMapV1Hash,
      result.artifactHashes.implementationSourceMapV1,
    );
    assert.equal(expectedSourceMap.sourceMap.designSourceKind, "stitch");
    assert.deepEqual(
      artifactStore.artifacts.get(result.artifactHashes.implementationSourceMapV1!)?.payload,
      expectedSourceMap.sourceMap,
    );
    assert.equal(
      contracts.designSourceClosureV2.designGraph.envelopeHash,
      result.artifactHashes.designGraphV2,
    );
    assert.equal(
      contracts.designSourceClosureV2.designGraph.payloadHash,
      hashCanonicalJson(contracts.designGraphV2),
    );
    for (const reference of [
      contracts.designSourceClosureV2.generationTargets,
      contracts.designSourceClosureV2.directResponseEvidence,
      contracts.designSourceClosureV2.renderedSemantics,
      contracts.designSourceClosureV2.candidateSelection,
      contracts.designSourceClosureV2.responseBindings,
    ]) {
      assert.equal(
        artifactStore.artifacts.get(reference.envelopeHash)?.artifactType,
        reference.artifactType,
      );
    }
  });

  it("requires all five strict design-source payloads before a Stitch closure can seal", async () => {
    const contracts = await buildStitchProductBuildPacketV3Contracts(producer);
    const { designSourceArtifactsV2: _omitted, ...withoutArtifacts } = contracts;
    const result = await compileProductBuildPacketV3({
      ...withoutArtifacts,
      compiler,
      producer,
      artifactStore: new MemoryArtifactWriter(),
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.packetHash, undefined);
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes("CONTRACT_V3_DESIGN_SOURCE_ARTIFACTS_REQUIRED"),
      true,
    );
  });

  it("rejects unknown fields in the additive design-source payload contract", async () => {
    const contracts = await buildStitchProductBuildPacketV3Contracts(producer);
    const result = await compileProductBuildPacketV3({
      ...contracts,
      designSourceArtifactsV2: {
        ...contracts.designSourceArtifactsV2,
        inferredLegacySources: [],
      },
      compiler,
      producer,
      artifactStore: new MemoryArtifactWriter(),
    });
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes("CONTRACT_V3_DESIGN_SOURCE_ARTIFACTS_SCHEMA_INVALID"),
      true,
    );
  });

  it("rejects payload drift from closure hashes without publishing a partial nested closure", async () => {
    const contracts = await buildStitchProductBuildPacketV3Contracts(producer);
    const designSourceArtifactsV2 = structuredClone(contracts.designSourceArtifactsV2);
    designSourceArtifactsV2.directResponseEvidence.projectId = "drifted-project-id";
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      designSourceArtifactsV2,
      compiler,
      producer,
      artifactStore,
    });
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes("CONTRACT_V3_DESIGN_SOURCE_ARTIFACT_HASH_MISMATCH"),
      true,
    );
    assert.equal(result.artifactHashes.designSourceClosureV2, undefined);
    assert.equal(
      [...artifactStore.artifacts.values()].some((artifact) =>
        artifact.artifactType === "setfarm.stitch-direct-response-evidence.v2"),
      false,
    );
  });

  it("forbids Stitch payloads for an exact no-design closure", async () => {
    const contracts = buildNoDesignProductBuildPacketV3Contracts();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      designSourceArtifactsV2: {},
      compiler,
      producer,
      artifactStore: new MemoryArtifactWriter(),
    });
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes("CONTRACT_V3_DESIGN_SOURCE_ARTIFACTS_FORBIDDEN"),
      true,
    );
  });

  it("rejects a rehashed caller-authored StoryPlanV2 instead of treating it as authority", async () => {
    const contracts = buildNoDesignProductBuildPacketV3Contracts();
    const storyPlanV2: any = structuredClone(contracts.storyPlanV2);
    storyPlanV2.stories[0].title = "Caller-authored replacement title";
    storyPlanV2.partitionHash = hashCanonicalJson(storyPlanV2.stories);
    const result = await compileProductBuildPacketV3({
      ...contracts,
      storyPlanV2,
      compiler,
      producer,
      artifactStore: new MemoryArtifactWriter(),
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.packet, undefined);
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes("CONTRACT_V3_STORY_PLAN_PROJECTION_MISMATCH"),
      true,
    );
  });

  it("never infers ProductBuildPacketV3 from v1-shaped authority inputs", async () => {
    const result = await compileProductBuildPacketV3({
      productSpecV2: { schema: "setfarm.product-spec.v1" },
      designGraphV2: { schema: "setfarm.design-interaction-graph.v1" },
      buildTopologyV1: { schema: "setfarm.build-topology.v1" },
      storyPlanV2: { schema: "setfarm.story-plan.v1" },
      designSourceClosureV2: { schema: "setfarm.design-source-closure.v1" },
      implementationSourceInputsV1: { schema: "setfarm.implementation-source-map.v0" },
      compiler,
      producer,
      artifactStore: new MemoryArtifactWriter(),
    } as any);
    assert.equal(result.status, "rejected");
    assert.equal(result.packetHash, undefined);
    assert.equal(result.report.schema, "setfarm.product-compilation-report.v3");
    assert.equal(result.report.status, "rejected");
    if (result.report.status !== "rejected") return;
    assert.equal(result.report.rejectionCodes.includes("CONTRACT_V3_PRODUCT_SPEC_SCHEMA_INVALID"), true);
    assert.equal(result.report.rejectionCodes.includes("CONTRACT_V3_DESIGN_GRAPH_SCHEMA_INVALID"), true);
    assert.equal(result.report.rejectionCodes.includes("CONTRACT_V3_STORY_PLAN_SCHEMA_INVALID"), true);
    assert.equal(
      result.report.rejectionCodes.includes(
        "IMPLEMENTATION_SOURCE_MAP_V1_INPUT_INVALID",
      ),
      true,
    );
  });

  it("rejects a forged precomputed map when compiler-owned producer inputs are absent", async () => {
    const contracts = await buildStitchProductBuildPacketV3Contracts(producer);
    const produced = produceImplementationSourceMapV1(contracts.implementationSourceInputsV1);
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    const forgedPrecomputedMap: any = structuredClone(produced.sourceMap);
    forgedPrecomputedMap.screens[0].path = "src/Forged.tsx";
    forgedPrecomputedMap.screens[0].storyId = "US-999";
    forgedPrecomputedMap.screens[0].targetHash = "f".repeat(64);
    forgedPrecomputedMap.screens[0].controls[0].generatedSelector = "#forged";
    const {
      implementationSourceInputsV1: _omitted,
      ...withoutSourceInputs
    } = contracts;
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...withoutSourceInputs,
      implementationSourceMapV1: forgedPrecomputedMap,
      compiler,
      producer,
      artifactStore,
    } as any);
    assert.equal(result.status, "rejected");
    assert.equal(result.packet, undefined);
    assert.equal(result.artifactHashes.implementationSourceMapV1, undefined);
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes(
          "IMPLEMENTATION_SOURCE_MAP_V1_INPUT_INVALID",
        ),
      true,
    );
    assert.equal(
      [...artifactStore.artifacts.values()].some((artifact) =>
        artifact.artifactType === "setfarm.implementation-source-map.v1"),
      false,
    );
  });

  it("propagates producer rejection diagnostics and never stores a source map", async () => {
    const contracts = buildNoDesignProductBuildPacketV3Contracts();
    const implementationSourceInputsV1: any = structuredClone(
      contracts.implementationSourceInputsV1,
    );
    implementationSourceInputsV1.storyPlan.stories[0].title =
      "Caller-authored producer-input title";
    implementationSourceInputsV1.storyPlan.partitionHash = hashCanonicalJson(
      implementationSourceInputsV1.storyPlan.stories,
    );
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      implementationSourceInputsV1,
      compiler,
      producer,
      artifactStore,
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.packet, undefined);
    assert.equal(result.artifactHashes.implementationSourceMapV1, undefined);
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes(
          "IMPLEMENTATION_SOURCE_MAP_V1_STORY_PLAN_PROJECTION_MISMATCH",
        ),
      true,
    );
    assert.equal(
      [...artifactStore.artifacts.values()].some((artifact) =>
        artifact.artifactType === "setfarm.implementation-source-map.v1"),
      false,
    );
  });

  it("rejects producer-input authority or design-kind drift before packet seal", async () => {
    const contracts = await buildStitchProductBuildPacketV3Contracts(producer);
    const noDesign = buildNoDesignProductBuildPacketV3Contracts();
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      implementationSourceInputsV1: noDesign.implementationSourceInputsV1,
      compiler,
      producer,
      artifactStore,
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.packet, undefined);
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes(
          "CONTRACT_V3_IMPLEMENTATION_SOURCE_MAP_AUTHORITY_MISMATCH",
        ),
      true,
    );
    assert.ok(result.artifactHashes.implementationSourceMapV1);
    assert.equal(
      artifactStore.artifacts.get(result.artifactHashes.implementationSourceMapV1!)?.artifactType,
      "setfarm.implementation-source-map.v1",
    );
  });

  it("keeps the v3 report strict and release-pinned", async () => {
    const contracts = buildNoDesignProductBuildPacketV3Contracts();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      compiler,
      producer: { ...producer, codeSha: "f".repeat(40) },
      artifactStore: new MemoryArtifactWriter(),
    });
    assert.equal(result.status, "rejected");
    assert.equal(
      result.report.status === "rejected"
        && result.report.rejectionCodes.includes("CONTRACT_V3_COMPILER_PRODUCER_REVISION_MISMATCH"),
      true,
    );
    assert.equal(ProductCompilationReportV3Schema.safeParse({
      ...result.report,
      inferredFrom: "setfarm.product-compilation-report.v2",
    }).success, false);
  });
});
