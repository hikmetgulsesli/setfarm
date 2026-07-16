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
  produceDesignGenerationTargetsV1,
} from "../../src/product-compiler/producers/design-targets.js";
import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";
import { buildTestRenderedSemantics, stitchDownloadReceipts, validStitchHtml, validStitchPng } from "./fixtures/stitch-artifacts.js";
import { renderLegacyPrd } from "../../src/product-compiler/renderers/legacy-prd.js";
import { buildV3AutoStoriesOutput } from "../../src/installer/steps/03-stories/preclaim.js";

function input() {
  const productSpec = buildMinimalValidContracts().productSpec;
  const targets = produceDesignGenerationTargetsV1(productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const candidates = targets.generationTargets.targets.map((target, index) => {
    const accessibility = (target.requiredObservableSelectors ?? [])
      .filter((item) => item.selector.kind === "accessibility");
    const actionTags = target.requiredActionRefs.map((actionRef) => {
      const selector = accessibility.find((item) => item.selector.kind === "accessibility" && item.selector.actionRef === actionRef)?.selector;
      return `<button data-action="${actionRef}"${selector?.kind === "accessibility" ? ` role="${selector.role}" aria-label="${selector.name}"` : ""}>${actionRef}</button>`;
    });
    const standaloneAccessibility = accessibility.flatMap((item) =>
      item.selector.kind === "accessibility" && !item.selector.actionRef
        ? [`<div role="${item.selector.role}" aria-label="${item.selector.name}"></div>`]
        : []);
    const html = validStitchHtml([
      `<main data-surface-id="${target.surfaceRef}">`,
      ...actionTags,
      ...target.requiredActionInputs.flatMap((item) => item.inputFields.map((field) =>
        `<input data-action-input="${item.actionRef}.${field}" />`)),
      ...standaloneAccessibility,
      "</main>",
    ].join(""), `story-projection-screen-${index + 1}`);
    return {
      screenId: `screen-${index + 1}`,
      title: target.expectedScreenTitle,
      html,
      screenshot: validStitchPng(index + 1),
    };
  });
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "story-projection",
    batches: [{
      stageId: "stage-counter",
      targetRefs: targets.generationTargets.targets.map((target) => target.targetId),
      source: "direct",
      candidates: candidates.map((candidate, index) => ({
        screenId: candidate.screenId,
        title: candidate.title,
        responsePaths: [`$result.screens[${index}]`],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(candidate.screenId, candidate.html, candidate.screenshot),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      })),
    }],
  };
  const artifacts = candidates.map((candidate) => ({
    screenId: candidate.screenId,
    htmlBytes: candidate.html,
    screenshotBytes: candidate.screenshot,
  }));
  const renderedSemantics = buildTestRenderedSemantics({
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    artifacts,
  });
  const selected = selectStitchTargetCandidatesV1({
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    renderedSemantics,
    artifacts,
    authorityMode: "clean_v3",
  });
  assert.equal(selected.status, "produced", JSON.stringify(selected.diagnostics));
  if (selected.status !== "produced") throw new Error("story projection selection failed");
  const bound = bindStitchTargetCandidateSelectionsV2({
    generationTargets: targets.generationTargets,
    candidateSelection: selected.candidateSelection,
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound.diagnostics));
  if (bound.status !== "produced") throw new Error("story projection binding failed");
  return {
    productSpec,
    generationTargets: targets.generationTargets,
    renderedSemantics,
    candidateSelection: selected.candidateSelection,
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
      path.join(repo, "stitch", "STITCH_RENDERED_SEMANTICS.json"),
      `${canonicalJsonStringify(contracts.renderedSemantics)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(repo, "stitch", "STITCH_TARGET_CANDIDATE_SELECTION.json"),
      `${canonicalJsonStringify(contracts.candidateSelection)}\n`,
      "utf8",
    );
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
