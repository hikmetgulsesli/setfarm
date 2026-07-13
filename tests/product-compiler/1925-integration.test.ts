import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { adaptLegacyPlan } from "../../src/product-compiler/adapters/legacy-plan.js";
import { adaptStitchSources } from "../../src/product-compiler/adapters/stitch.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { linkDesignProjection } from "../../src/product-compiler/design-linker.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

const HASH_A = "a".repeat(64);

function sourceRef(locator: string, mediaType: string) {
  return {
    schema: "setfarm.source-artifact-ref.v1" as const,
    hash: HASH_A,
    mediaType,
    locator,
    byteLength: 100,
  };
}

describe("#1925 contract-spine integration", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("retains the exact save join while rejecting the incomplete product packet", async () => {
    const fixtureRoot = path.resolve("evals/fixtures/1925-task-chip/sources");
    const [planText, generatedText, review] = await Promise.all([
      readFile(path.join(fixtureRoot, "plan-gap.md"), "utf8"),
      readFile(path.join(fixtureRoot, "generated-control.tsx"), "utf8"),
      readFile(path.join(fixtureRoot, "review-thread-excerpt.json"), "utf8").then(JSON.parse),
    ]);
    const plan = adaptLegacyPlan({
      source: sourceRef("fixture/plan-gap.md", "text/markdown"),
      text: planText,
    });
    assert.equal(plan.candidate, undefined);
    assert.equal(
      plan.diagnostics.some((item) => item.reference === "ACT_FILTER_INSIGHTS->SURF_INSIGHTS"),
      true,
    );

    const values = buildMinimalValidContracts();
    const productSpec = structuredClone(values.productSpec);
    productSpec.actions[0]!.id = "ACT_SAVE_RECORD";
    productSpec.evidencePredicates[0]!.subjectRef = "ACT_SAVE_RECORD";
    const filterAction = structuredClone(productSpec.actions[0]!);
    filterAction.id = "ACT_FILTER_INSIGHTS";
    filterAction.name = "Filter insights";
    filterAction.input.fields = [];
    filterAction.stateDeltas = [];
    filterAction.persistenceEffects = [];
    const exportAction = structuredClone(filterAction);
    exportAction.id = "ACT_EXPORT_SUMMARY";
    exportAction.name = "Export summary";
    productSpec.actions.push(filterAction, exportAction);

    const saveSource = generatedText.split("\n").filter((line) =>
      line.includes("ACT_SAVE_RECORD") || line.includes("Save Changes"))
      .join("\n");
    const projection = adaptStitchSources({
      rawArtifactHashes: [HASH_A],
      generatedSources: [{
        source: sourceRef("fixture/generated-control.tsx", "text/typescript"),
        designSurfaceId: "DSURF_EDITOR",
        surfaceRef: "SURF_EDITOR",
        text: saveSource,
      }],
    });
    assert.ok(projection.candidate);
    const linked = linkDesignProjection({ productSpec, projection: projection.candidate });
    assert.ok(linked.graph);
    assert.equal(
      linked.exactBindings.some((binding) =>
        binding.actionRef === "ACT_SAVE_RECORD"
        && binding.generatedLocalId === "save-changes-7"),
      true,
    );
    assert.equal(
      linked.graph.controls.some((control) =>
        review.proseTokenCandidates.includes(control.generatedLocalId)),
      false,
    );

    const storyPlan = structuredClone(values.storyPlan);
    storyPlan.stories[0]!.actionRefs = ["ACT_SAVE_RECORD"];
    storyPlan.stories[0]!.controlRefs = [linked.graph.controls[0]!.id];
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-1925-integration-"));
    roots.push(root);
    const result = await compileProductBuildPacket({
      productSpec,
      designGraph: linked.graph,
      buildTopology: values.buildTopology,
      storyPlan,
      compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
      producer: {
        pass: "product-packet-compiler",
        codeSha: "5840ae3",
        toolVersions: { zod: "4.4.3" },
      },
      artifactStore: new ContentAddressedArtifactStore(path.join(root, "artifacts")),
    });

    assert.equal(result.status, "rejected");
    const codes = new Set(result.report.diagnostics.map((item) => item.code));
    assert.equal(codes.has("LINK_ACTION_INPUT_BINDING_MISSING"), true);
    assert.equal(codes.has("LINK_REQUIRED_ACTION_UNREACHABLE"), true);
    assert.equal(codes.has("CONTRACT_ACTION_UNOWNED"), true);
    assert.equal(result.packetHash, undefined);
  });
});
