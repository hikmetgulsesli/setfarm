import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compileProductBuildPacketV3 } from "../../src/product-compiler/packet-compiler.js";
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
    assert.notEqual(result.packet.productSpecV2Hash, hashCanonicalJson(contracts.productSpecV2));
    assert.deepEqual(result.report.artifactHashes, result.artifactHashes);
    assert.equal(
      artifactStore.artifacts.get(result.packetHash)?.artifactType,
      "setfarm.product-build-packet.v3",
    );
  });

  it("seals the exact Stitch graph envelope and closure without v1 graph adaptation", async () => {
    const contracts = await buildStitchProductBuildPacketV3Contracts(producer);
    const artifactStore = new MemoryArtifactWriter();
    const result = await compileProductBuildPacketV3({
      ...contracts,
      compiler,
      producer,
      artifactStore,
    });
    assert.equal(result.status, "sealed", JSON.stringify(result.report));
    assert.equal(result.packet?.designSourceKind, "stitch");
    assert.ok(result.packet?.designGraphV2Hash);
    assert.equal(result.packet?.designGraphV2Hash, result.artifactHashes.designGraphV2);
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
      compiler,
      producer,
      artifactStore: new MemoryArtifactWriter(),
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.packetHash, undefined);
    assert.equal(result.report.schema, "setfarm.product-compilation-report.v3");
    assert.equal(result.report.status, "rejected");
    if (result.report.status !== "rejected") return;
    assert.equal(result.report.rejectionCodes.includes("CONTRACT_V3_PRODUCT_SPEC_SCHEMA_INVALID"), true);
    assert.equal(result.report.rejectionCodes.includes("CONTRACT_V3_DESIGN_GRAPH_SCHEMA_INVALID"), true);
    assert.equal(result.report.rejectionCodes.includes("CONTRACT_V3_STORY_PLAN_SCHEMA_INVALID"), true);
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
