import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { buildExpectedV3StoriesOutput } from "../../src/installer/steps/03-stories/guards.js";
import { buildV3AutoStoriesOutput } from "../../src/installer/steps/03-stories/preclaim.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  buildNoDesignProductBuildPacketV3Contracts,
  buildStitchProductBuildPacketV3Contracts,
} from "./fixtures/product-build-packet-v3.js";

const PRODUCER = {
  pass: "story-scheduling-projection-v2-test",
  codeSha: "a".repeat(40),
  model: "deterministic",
  promptHash: "b".repeat(64),
  toolVersions: { node: process.version },
};

async function fixture() {
  const contracts = await buildStitchProductBuildPacketV3Contracts(PRODUCER);
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stories-v2-"));
  const stitchDir = path.join(repo, "stitch");
  fs.mkdirSync(stitchDir, { recursive: true });
  const artifacts = contracts.designSourceArtifactsV2;
  const write = (name: string, value: unknown) => {
    fs.writeFileSync(path.join(stitchDir, name), canonicalJsonStringify(value), "utf8");
  };
  write("GENERATION_TARGETS.json", artifacts.generationTargets);
  write("STITCH_DIRECT_RESPONSE_EVIDENCE.json", artifacts.directResponseEvidence);
  write("STITCH_RENDERED_SEMANTICS_V2.json", artifacts.renderedSemantics);
  write("STITCH_TARGET_CANDIDATE_SELECTION.json", artifacts.candidateSelection);
  write("STITCH_RESPONSE_BINDINGS.json", artifacts.responseBindings);
  write("DESIGN_INTERACTION_GRAPH_V2.json", contracts.designGraphV2);
  const planText = [
    "# Canonical PLAN",
    "",
    "```product-spec-v2",
    canonicalJsonStringify(contracts.productSpecV2),
    "```",
    "",
  ].join("\n");
  return { contracts, repo, stitchDir, write, planText };
}

function jsonLine(output: string, label: string): any {
  const prefix = `${label}: `;
  const line = output.split("\n").find((candidate) => candidate.startsWith(prefix));
  if (!line) throw new Error(`${label} missing`);
  return JSON.parse(line.slice(prefix.length));
}

describe("Product Semantics v2 story scheduling projection", { concurrency: 1 }, () => {
  it("is deterministic and keeps slots/physical controls separate from affected surfaces", async () => {
    const value = await fixture();
    try {
      const params = {
        repo: value.repo,
        prd: value.planText,
        productSemanticsVersion: "v2",
      };
      const first = buildV3AutoStoriesOutput(params);
      const second = buildV3AutoStoriesOutput(params);
      assert.equal(second, first);
      assert.match(first, /^STATUS: done\nSTORY_SCHEDULING_PROJECTION_SCHEMA: setfarm\.story-scheduling-projection\.v2/m);

      const stories = jsonLine(first, "STORIES_JSON");
      const screenMap = jsonLine(first, "SCREEN_MAP");
      assert.equal(stories.length, 1);
      assert.equal(screenMap.length, 1);
      const story = stories[0];
      const action = value.contracts.productSpecV2.actions[0]!;
      const slotRef = action.controlPlacements[0]!.id;
      const placementSurface = action.controlPlacements[0]!.surfaceRef;
      const physicalControl = value.contracts.designGraphV2!.controls[0]!;
      assert.deepEqual(story.implementation_contract.owned_control_slot_ids, [slotRef]);
      assert.deepEqual(story.implementation_contract.owned_physical_control_ids, [physicalControl.id]);
      assert.equal(story.implementation_contract.owned_physical_control_ids.length, 1);
      assert.deepEqual(story.implementation_contract.owned_actions[0].control_slot_ids, [slotRef]);
      assert.deepEqual(story.implementation_contract.owned_actions[0].physical_control_ids, [physicalControl.id]);
      assert.deepEqual(story.implementation_contract.owned_actions[0].control_surface_ids, [placementSurface]);
      assert.deepEqual(
        story.implementation_contract.owned_actions[0].affected_surface_ids,
        [...action.affectedSurfaceRefs].sort(),
      );
      assert.equal(
        story.implementation_contract.owned_actions[0].affected_surface_ids.includes(placementSurface),
        false,
      );
      assert.equal(
        story.scope_targets.filter((target: any) => target.role === "surface_component").length,
        1,
        "contained/affected surfaces share one exact generated screen and cannot mint screen components",
      );
      assert.equal(
        story.scope_targets.filter((target: any) => target.role === "action_handler").length,
        1,
        "affected surfaces cannot mint action handlers",
      );
    } finally {
      fs.rmSync(value.repo, { recursive: true, force: true });
    }
  });

  it("selects v2 only from explicit context in both preclaim and completion guard", async () => {
    const value = await fixture();
    try {
      const expected = buildV3AutoStoriesOutput({
        repo: value.repo,
        prd: value.planText,
        productSemanticsVersion: "v2",
      });
      const guarded = buildExpectedV3StoriesOutput({
        repo: value.repo,
        prd: value.planText,
        product_semantics_version: "v2",
      });
      assert.equal(guarded, expected);
      assert.throws(
        () => buildExpectedV3StoriesOutput({ repo: value.repo, prd: value.planText }),
        /V3_STORY_PRODUCT_SPEC_REJECTED/,
        "missing v2 context must stay on the immutable ProductSpecV1 path",
      );
    } finally {
      fs.rmSync(value.repo, { recursive: true, force: true });
    }
  });

  it("projects a no-design CLI directly from ProductSpecV2 without Stitch inference", () => {
    const contracts = buildNoDesignProductBuildPacketV3Contracts();
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stories-v2-cli-"));
    const planText = [
      "# Canonical PLAN",
      "",
      "```product-spec-v2",
      canonicalJsonStringify(contracts.productSpecV2),
      "```",
      "",
    ].join("\n");
    try {
      const output = buildV3AutoStoriesOutput({
        repo,
        prd: planText,
        productSemanticsVersion: "v2",
      });
      const stories = jsonLine(output, "STORIES_JSON");
      assert.ok(stories.length > 0);
      assert.deepEqual(jsonLine(output, "SCREEN_MAP"), []);
      assert.match(output, /^DESIGN_GRAPH_HASH: none$/m);
      for (const story of stories) {
        assert.deepEqual(story.screens, []);
        assert.equal(story.implementation_contract.design_graph_hash, null);
        assert.deepEqual(story.implementation_contract.owned_physical_control_ids, []);
        assert.ok(
          story.scope_targets.some((target: any) => target.role === "cli_command"),
          "each no-design semantic component must own an exact CLI command target",
        );
      }
      assert.equal(fs.existsSync(path.join(repo, "stitch")), false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rejects canonical tampering, non-canonical bytes, and mixed artifact versions", async () => {
    const value = await fixture();
    try {
      const build = () => buildV3AutoStoriesOutput({
        repo: value.repo,
        prd: value.planText,
        productSemanticsVersion: "v2",
      });
      const direct = structuredClone(value.contracts.designSourceArtifactsV2.directResponseEvidence);
      direct.projectId = "tampered-project";
      value.write("STITCH_DIRECT_RESPONSE_EVIDENCE.json", direct);
      assert.throws(build, /V2_STORY_DESIGN_AUTHORITY_HASH_MISMATCH/);

      value.write(
        "STITCH_DIRECT_RESPONSE_EVIDENCE.json",
        value.contracts.designSourceArtifactsV2.directResponseEvidence,
      );
      const forgedGraph = structuredClone(value.contracts.designGraphV2!);
      forgedGraph.responseBindingsHash = "f".repeat(64);
      value.write("DESIGN_INTERACTION_GRAPH_V2.json", forgedGraph);
      assert.throws(build, /V2_STORY_DESIGN_GRAPH_REPRODUCTION_MISMATCH/);

      value.write("DESIGN_INTERACTION_GRAPH_V2.json", value.contracts.designGraphV2);
      fs.writeFileSync(
        path.join(value.stitchDir, "GENERATION_TARGETS.json"),
        JSON.stringify(value.contracts.designSourceArtifactsV2.generationTargets, null, 2),
        "utf8",
      );
      assert.throws(build, /V2_STORY_GENERATION_TARGETS_NON_CANONICAL/);

      const mixedVersion = {
        ...value.contracts.designSourceArtifactsV2.generationTargets,
        schema: "setfarm.design-generation-targets.v1",
      };
      value.write("GENERATION_TARGETS.json", mixedVersion);
      assert.throws(build, /V2_STORY_GENERATION_TARGETS_SCHEMA_INVALID/);
    } finally {
      fs.rmSync(value.repo, { recursive: true, force: true });
    }
  });
});
