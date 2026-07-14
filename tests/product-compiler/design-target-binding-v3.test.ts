import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  adaptExactStitchScreenIndexV3,
  produceDesignGraphFromExactStitchScreenIndexV3,
} from "../../src/product-compiler/adapters/stitch-screen-index-v3.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  bindExactStitchTargetResponsesV1,
  produceDesignGenerationTargetsV1,
} from "../../src/product-compiler/producers/design-targets.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import { renderLegacyPrd } from "../../src/product-compiler/renderers/legacy-prd.js";
import {
  buildV3BatchStitchPrompt,
  extractCanonicalProductSpecFromPrd,
} from "../../src/installer/steps/02-design/preclaim.js";

const TASK = [
  "Build a compact single-page status utility called Pulse Tile.",
  "It has a refresh button and a ready/paused toggle.",
  "Keep status in localStorage.",
  "Do not add navigation or analytics.",
].join(" ");

function compilerInputs() {
  const product = produceProductSpecV1({ task: TASK });
  assert.equal(product.status, "produced", JSON.stringify(product.diagnostics));
  const targets = produceDesignGenerationTargetsV1(product.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const target = targets.generationTargets.targets[0]!;
  const bound = bindExactStitchTargetResponsesV1({
    generationTargets: targets.generationTargets,
    batches: [{
      stageId: "stage-1",
      targetRefs: [target.targetId],
      screens: [{ screenId: "screen-pulse", title: target.expectedScreenTitle }],
    }],
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound.diagnostics));
  return {
    productSpec: product.productSpec,
    generationTargets: targets.generationTargets,
    responseBindings: bound.responseBindings,
  };
}

function textArtifact(locator: string, mediaType: string, text: string) {
  const bytes = Buffer.from(text, "utf8");
  return {
    source: {
      schema: "setfarm.source-artifact-ref.v1" as const,
      hash: createHash("sha256").update(bytes).digest("hex"),
      mediaType,
      locator,
      byteLength: bytes.byteLength,
    },
    text,
  };
}

function exactAdapterInput() {
  const contracts = compilerInputs();
  const target = contracts.generationTargets.targets[0]!;
  const generatedLocator = "src/screens/StatusUtilityPulseTile.tsx";
  const generated = [
    "export function StatusUtilityPulseTile() {",
    "  return <>",
    '    <button data-action="ACT_REFRESH_STATUS" data-action-id="refresh-status-1">Refresh</button>',
    '    <button data-action="ACT_SET_PAUSED" data-action-input="ACT_SET_PAUSED.paused" data-action-id="ready-paused-2">Pause</button>',
    "  </>;",
    "}",
  ].join("\n");
  const controls = [{
    id: "refresh-status-1",
    generatedLocalId: "refresh-status-1",
    kind: "button",
    label: "Refresh",
    actionRef: "ACT_REFRESH_STATUS",
    semanticSource: "data-action",
    sourceLocator: "stitch/screen-pulse.html",
    generatedSourceLocator: generatedLocator,
    selector: '[data-action-id="refresh-status-1"]',
  }, {
    id: "ready-paused-2",
    generatedLocalId: "ready-paused-2",
    kind: "button",
    label: "Pause",
    actionRef: "ACT_SET_PAUSED",
    inputBindings: [{ actionRef: "ACT_SET_PAUSED", inputField: "paused" }],
    semanticSource: "data-action",
    sourceLocator: "stitch/screen-pulse.html",
    generatedSourceLocator: generatedLocator,
    selector: '[data-action-id="ready-paused-2"]',
  }];
  const screenIndex = JSON.stringify([{
    screenId: "screen-pulse",
    title: target.expectedScreenTitle,
    componentName: "StatusUtilityPulseTile",
    file: generatedLocator,
    buttons: 2,
    inputs: 0,
    textareas: 0,
    selects: 0,
    links: 0,
    controls,
  }], null, 2);
  return {
    ...contracts,
    screenIndex: textArtifact("src/screens/SCREEN_INDEX.json", "application/json", screenIndex),
    generatedSources: [{
      targetRef: target.targetId,
      ...textArtifact(generatedLocator, "text/typescript", generated),
    }],
  };
}

describe("Product Compiler v3 exact Stitch target binding", () => {
  it("produces deterministic immutable targets from the exact ProductSpec", () => {
    const first = compilerInputs();
    const second = compilerInputs();
    assert.deepEqual(second, first);
    const target = first.generationTargets.targets[0]!;
    assert.equal(first.generationTargets.productSpecHash, hashCanonicalJson(first.productSpec));
    assert.equal(target.targetId, "TARGET_UTILITY");
    assert.equal(target.designSurfaceId, "DSURF_UTILITY");
    assert.equal(target.requestScreenKey, "Status utility - Pulse Tile");
    assert.deepEqual(target.requiredActionRefs, ["ACT_REFRESH_STATUS", "ACT_SET_PAUSED"]);
    assert.deepEqual(target.requiredActionInputs, [{
      actionRef: "ACT_SET_PAUSED",
      inputFields: ["paused"],
    }]);
  });

  it("extracts only the exact canonical ProductSpec projection and renders a machine-binding prompt", () => {
    const { productSpec, generationTargets } = compilerInputs();
    const prd = renderLegacyPrd(productSpec, {
      platform: "web",
      techStack: "vite-react",
      uiLanguage: "English",
    });
    assert.deepEqual(extractCanonicalProductSpecFromPrd(prd), productSpec);
    const target = generationTargets.targets[0]!;
    const prompt = buildV3BatchStitchPrompt(
      productSpec,
      generationTargets,
      [target.targetId],
      "DESKTOP",
      "English",
      "stage-001",
    );
    assert.match(prompt, /exact_screen_title: Status utility - Pulse Tile/);
    assert.match(prompt, /exact_action_attribute: data-action="ACT_REFRESH_STATUS"/);
    assert.match(prompt, /exact_action_attribute: data-action="ACT_SET_PAUSED"/);
    assert.match(prompt, /exact_input_mappings: ACT_SET_PAUSED\.paused/);
    assert.match(prompt, /same button, link, or input element/);
    assert.match(prompt, /no others in this response/);

    const nonCanonical = prd.replace(
      /```product-spec-v1\n(\{)/,
      "```product-spec-v1\n{ \"schema\": \"setfarm.product-spec.v1\", \"product\":",
    );
    assert.throws(
      () => extractCanonicalProductSpecFromPrd(nonCanonical),
      /DESIGN_V3_PRODUCT_SPEC_PROJECTION_INVALID/,
    );
  });

  it("binds only exact direct-response titles and rejects fuzzy or unexpected responses", () => {
    const { generationTargets } = compilerInputs();
    const target = generationTargets.targets[0]!;
    const result = bindExactStitchTargetResponsesV1({
      generationTargets,
      batches: [{
        stageId: "stage-1",
        targetRefs: [target.targetId],
        screens: [
          { screenId: "close-title", title: target.expectedScreenTitle.toLowerCase() },
          { screenId: "assistant-canvas", title: "Design system" },
        ],
      }],
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_RESPONSE_MISSING"), true);
    assert.equal(result.rejectionCodes.includes("DESIGN_RESPONSE_UNEXPECTED"), true);
  });

  it("converts exact SCREEN_INDEX controls and same-element attributes into a complete design graph", () => {
    const input = exactAdapterInput();
    const adapted = adaptExactStitchScreenIndexV3(input);
    assert.equal(adapted.status, "adapted", JSON.stringify(adapted.diagnostics));
    const produced = produceDesignGraphFromExactStitchScreenIndexV3(input);
    assert.equal(produced.status, "produced", JSON.stringify(produced.diagnostics));
    assert.deepEqual(
      produced.designGraph.bindings.filter((binding) => binding.disposition === "action").map((binding) => binding.actionRef).sort(),
      ["ACT_REFRESH_STATUS", "ACT_SET_PAUSED"],
    );
    const toggle = produced.designGraph.bindings.find((binding) =>
      binding.disposition === "action" && binding.actionRef === "ACT_SET_PAUSED");
    assert.equal(toggle?.disposition, "action");
    assert.equal(toggle?.inputBindings[0]?.valueFrom.kind, "control_value");
    assert.equal(toggle?.inputBindings[0]?.valueFrom.kind === "control_value"
      ? toggle.inputBindings[0].valueFrom.controlRef === toggle.controlRef
      : false, true);
  });

  it("rejects a SCREEN_INDEX claim when the exact source element lost data-action", () => {
    const input = exactAdapterInput();
    const source = input.generatedSources[0]!;
    const brokenText = source.text.replace('data-action="ACT_SET_PAUSED" ', "");
    input.generatedSources[0] = {
      targetRef: source.targetRef,
      ...textArtifact(source.source.locator, source.source.mediaType, brokenText),
    };
    const result = adaptExactStitchScreenIndexV3(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_SAME_ELEMENT_ACTION_MISSING"), true);
  });

  it("rejects an extra button even when its label resembles an allowed action", () => {
    const input = exactAdapterInput();
    const index = JSON.parse(input.screenIndex.text);
    index[0].controls.push({
      id: "save-looking-3",
      generatedLocalId: "save-looking-3",
      kind: "button",
      label: "Refresh status again",
      semanticSource: "data-action",
      sourceLocator: "stitch/screen-pulse.html",
      generatedSourceLocator: index[0].file,
      selector: '[data-action-id="save-looking-3"]',
    });
    input.screenIndex = textArtifact(input.screenIndex.source.locator, "application/json", JSON.stringify(index, null, 2));
    const result = adaptExactStitchScreenIndexV3(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_CONTROL_UNEXPECTED"), true);
  });
});
