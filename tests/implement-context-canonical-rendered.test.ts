import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../src/product-compiler/canonical-json.js";
import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1,
} from "../src/product-compiler/producers/stitch-target-candidate-selection.js";
import { injectStitchHtml } from "../src/installer/steps/06-implement/context.js";
import {
  buildTestRenderedSemantics,
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./product-compiler/fixtures/stitch-artifacts.js";

function writeCanonical(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalJsonStringify(value)}\n`, "utf8");
}

function fixture(repo: string) {
  const stitchDir = path.join(repo, "stitch");
  fs.mkdirSync(stitchDir, { recursive: true });
  const generationTargets = {
    schema: "setfarm.design-generation-targets.v1",
    productSpecHash: "a".repeat(64),
    targets: [{
      targetId: "TARGET_EDITOR",
      designSurfaceId: "DSURF_EDITOR",
      surfaceRef: "SURF_EDITOR",
      requestScreenKey: "Task Editor",
      expectedScreenTitle: "Task Editor",
      requiredActionRefs: ["ACT_SAVE_TASK"],
      requiredActionInputs: [{ actionRef: "ACT_SAVE_TASK", inputFields: ["title"] }],
      requiredObservableSelectors: [],
    }],
  };
  const htmlBytes = validStitchHtml([
    '<main data-surface-id="SURF_EDITOR">',
    '<input data-action-input="ACT_SAVE_TASK.title" />',
    '<button data-action="ACT_SAVE_TASK">Save</button>',
    "</main>",
  ].join(""), "implement-context-rendered");
  const screenshotBytes = validStitchPng(17);
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "implement-context-rendered",
    batches: [{
      stageId: "stage-editor",
      targetRefs: ["TARGET_EDITOR"],
      source: "direct",
      candidates: [{
        screenId: "editor-screen",
        title: "Task Editor",
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts("editor-screen", htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  const artifacts = [{ screenId: "editor-screen", htmlBytes, screenshotBytes }];
  const renderedSemantics = buildTestRenderedSemantics({
    generationTargets,
    directResponseEvidence,
    artifacts,
  });
  const selected = selectStitchTargetCandidatesV1({
    generationTargets,
    directResponseEvidence,
    renderedSemantics,
    artifacts,
    authorityMode: "clean_v3",
  });
  assert.equal(selected.status, "produced", JSON.stringify(selected.diagnostics));
  if (selected.status !== "produced") throw new Error("selection failed");
  const bound = bindStitchTargetCandidateSelectionsV2({
    generationTargets,
    candidateSelection: selected.candidateSelection,
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound.diagnostics));
  if (bound.status !== "produced") throw new Error("binding failed");

  fs.writeFileSync(path.join(stitchDir, "editor-screen.html"), htmlBytes);
  fs.writeFileSync(path.join(stitchDir, "editor-screen.png"), screenshotBytes);
  const semanticDom = renderedSemantics.candidates[0]!.semanticDom!;
  fs.mkdirSync(path.dirname(path.join(repo, semanticDom.locator)), { recursive: true });
  fs.writeFileSync(path.join(repo, semanticDom.locator), htmlBytes);
  writeCanonical(path.join(stitchDir, "GENERATION_TARGETS.json"), generationTargets);
  writeCanonical(path.join(stitchDir, "STITCH_DIRECT_RESPONSE_EVIDENCE.json"), directResponseEvidence);
  writeCanonical(path.join(stitchDir, "STITCH_RENDERED_SEMANTICS.json"), renderedSemantics);
  writeCanonical(path.join(stitchDir, "STITCH_TARGET_CANDIDATE_SELECTION.json"), selected.candidateSelection);
  writeCanonical(path.join(stitchDir, "STITCH_RESPONSE_BINDINGS.json"), bound.responseBindings);
  return { semanticDom };
}

describe("implementation canonical rendered-design context", () => {
  it("injects exact browser evidence instead of reparsing raw Stitch HTML prose", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-rendered-context-"));
    try {
      fixture(repo);
      const context = {
        repo,
        story_screens: JSON.stringify([{
          screenId: "editor-screen",
          name: "Task Editor",
          htmlFile: "stitch/editor-screen.html",
        }]),
      };
      await injectStitchHtml(context, "run-rendered", "US-001");
      assert.equal(context._canonical_rendered_design_authority, "true");
      assert.doesNotMatch(context.stitch_html, /HTML_EXCERPT|DESIGN_SOURCE_OF_TRUTH/);
      const evidence = JSON.parse(context.stitch_html);
      assert.equal(evidence.schema, "setfarm.story-rendered-design-evidence.v1");
      assert.equal(evidence.screens[0].surfaceRef, "SURF_EDITOR");
      assert.equal(evidence.screens[0].semanticDom.locator, "stitch/rendered-dom/editor-screen.html");
      assert.deepEqual(
        evidence.screens[0].elements.map((element: { elementRef: string }) => element.elementRef),
        evidence.screens[0].contractElementRefs,
      );
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rejects changed semantic DOM bytes", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-rendered-tamper-"));
    try {
      const { semanticDom } = fixture(repo);
      fs.appendFileSync(path.join(repo, semanticDom.locator), "<!-- changed -->");
      await assert.rejects(
        injectStitchHtml({
          repo,
          story_screens: JSON.stringify([{
            screenId: "editor-screen",
            name: "Task Editor",
            htmlFile: "stitch/editor-screen.html",
          }]),
        }, "run-rendered", "US-001"),
        /V3_STITCH_SELECTED_ARTIFACT_HASH_MISMATCH/,
      );
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
