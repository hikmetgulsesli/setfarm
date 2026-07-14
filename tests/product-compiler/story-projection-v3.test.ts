import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  compileV3CompatibilityStoryProjection,
  stitchComponentNameV3,
} from "../../src/product-compiler/compatibility/story-projection-v3.js";
import {
  bindExactStitchTargetResponsesV1,
  produceDesignGenerationTargetsV1,
} from "../../src/product-compiler/producers/design-targets.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";
import { renderLegacyPrd } from "../../src/product-compiler/renderers/legacy-prd.js";
import { buildV3AutoStoriesOutput } from "../../src/installer/steps/03-stories/preclaim.js";

function input() {
  const productSpec = buildMinimalValidContracts().productSpec;
  const targets = produceDesignGenerationTargetsV1(productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const bound = bindExactStitchTargetResponsesV1({
    generationTargets: targets.generationTargets,
    batches: [{
      stageId: "stage-counter",
      targetRefs: targets.generationTargets.targets.map((target) => target.targetId),
      screens: targets.generationTargets.targets.map((target, index) => ({
        screenId: `screen-${index + 1}`,
        title: target.expectedScreenTitle,
      })),
    }],
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound.diagnostics));
  return {
    productSpec,
    generationTargets: targets.generationTargets,
    responseBindings: bound.responseBindings,
  };
}

describe("Product Compiler v3 legacy story compatibility projection", () => {
  it("projects only canonical ProductSpec semantics and exact Stitch bindings", () => {
    const compiled = compileV3CompatibilityStoryProjection(input());
    assert.equal(compiled.stories.length, 1);
    assert.equal(compiled.screenMap.length, 1);
    const story = compiled.stories[0]!;
    assert.deepEqual(story.implementation_contract.owned_surface_ids, ["SURF_EDITOR"]);
    assert.deepEqual(
      story.implementation_contract.owned_actions.map((action) => action.id).sort(),
      ["ACT_SAVE_TASK"],
    );
    assert.equal(story.implementation_contract.owned_actions.some((action) => action.id === "ACT_APP_STATE_BOOTSTRAP"), false);
    assert.deepEqual(story.screens, ["screen-1"]);
    assert.equal(story.implementation_contract.owned_screen_files[0],
      `src/screens/${stitchComponentNameV3(compiled.screenMap[0]!.name)}.tsx`);
    assert.deepEqual(compiled.screenMap[0]!.stories, [story.id]);
  });

  it("is deterministic and rejects a stale target hash", () => {
    const contracts = input();
    const first = compileV3CompatibilityStoryProjection(contracts);
    const second = compileV3CompatibilityStoryProjection(contracts);
    assert.equal(canonicalJsonStringify(second), canonicalJsonStringify(first));

    assert.throws(() => compileV3CompatibilityStoryProjection({
      ...contracts,
      generationTargets: {
        ...contracts.generationTargets,
        productSpecHash: "f".repeat(64),
      },
    }), /V3_STORY_PRODUCT_SPEC_TARGET_HASH_MISMATCH/);
  });

  it("reads only canonical PLAN and exact canonical design projection files", () => {
    const contracts = input();
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-stories-"));
    fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
    const targetsPath = path.join(repo, "stitch", "GENERATION_TARGETS.json");
    fs.writeFileSync(targetsPath, `${canonicalJsonStringify(contracts.generationTargets)}\n`, "utf8");
    fs.writeFileSync(
      path.join(repo, "stitch", "STITCH_RESPONSE_BINDINGS.json"),
      `${canonicalJsonStringify(contracts.responseBindings)}\n`,
      "utf8",
    );
    const prd = renderLegacyPrd(contracts.productSpec, {
      platform: "web",
      techStack: "vite-react",
      uiLanguage: "English",
    });
    const output = buildV3AutoStoriesOutput({ repo, prd });
    assert.match(output, /^STATUS: done\nV3_STORY_PROJECTION_SCHEMA:/);
    assert.match(output, /"owned_actions":\[\{"id":"ACT_SAVE_TASK"/);

    fs.writeFileSync(targetsPath, JSON.stringify(contracts.generationTargets, null, 2), "utf8");
    assert.throws(
      () => buildV3AutoStoriesOutput({ repo, prd }),
      /V3_STORY_GENERATION_TARGETS_NON_CANONICAL/,
    );
  });
});
