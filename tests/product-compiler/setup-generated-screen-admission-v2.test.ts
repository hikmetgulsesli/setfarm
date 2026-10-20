import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  admitSetupGeneratedScreenSourcesV2,
  type SetupGeneratedScreenTargetV2,
} from "../../src/product-compiler/setup-generated-screen-admission-v2.js";
import type { DesignGenerationTargetsV2 } from "../../src/product-compiler/schemas/design-generation-targets-v2.js";
import type { StitchScreenIndexV2 } from "../../src/product-compiler/schemas/stitch-screen-index-v2.js";
import type { StitchTargetResponseBindingsV3 } from "../../src/product-compiler/schemas/stitch-target-candidate-selection-v2.js";

// A root with no physical controls still needs exact surface/source authority.
// Folder membership, a matching label, or a caller-provided source list cannot
// replace any of the independently supplied target/response/manifest bindings.
function fixture() {
  const generationTargets: DesignGenerationTargetsV2 = {
    schema: "setfarm.design-generation-targets.v2",
    productSpecHash: "a".repeat(64),
    targets: ["ALPHA", "BETA"].map((key) => ({
      targetId: `TARGET_${key}`,
      designSurfaceId: `DSURF_${key}`,
      routeRef: `ROUTE_${key}`,
      surfaceRef: `SURF_${key}`,
      containedSurfaceRefs: [`SURF_${key}_DETAIL`],
      requestScreenKey: `${key} request`,
      expectedScreenTitle: `${key} screen`,
      requiredControlPlacements: [],
      affectingActionRefs: [],
      requiredObservableSelectors: [],
    })),
  };
  const screenIndex: StitchScreenIndexV2 = generationTargets.targets.map((target, index) => ({
    screenId: `screen-${index + 1}`,
    title: target.expectedScreenTitle,
    componentName: index === 0 ? "AlphaScreen" : "BetaScreen",
    file: index === 0 ? "src/screens/AlphaScreen.tsx" : "src/screens/BetaScreen.tsx",
    buttons: 0, inputs: 0, textareas: 0, selects: 0, links: 0,
    actions: [], controls: [], observables: [], rejectedControls: [],
    projection: {
      schema: "setfarm.stitch-screen-projection.v2", mode: "contract_only",
      targetRef: target.targetId, authoritySchema: "setfarm.design-interaction-graph.v2",
      rawInteractiveCounts: { buttons: 0, links: 0, inputs: 0, textareas: 0, selects: 0 },
      requiredObservableRefs: [],
    },
    componentApi: {
      schema: "setfarm.generated-screen-component-api.v1", actionsPropName: "actions",
      actionBindings: [], inputTransports: [],
    },
  }));
  const responseBindings: StitchTargetResponseBindingsV3 = {
    schema: "setfarm.stitch-target-response-bindings.v3",
    generationTargetsHash: hashCanonicalJson(generationTargets),
    directResponseEvidenceHash: "b".repeat(64), candidateSelectionHash: "c".repeat(64),
    renderedSemanticsHash: "d".repeat(64),
    bindings: generationTargets.targets.map((target, index) => ({
      targetRef: target.targetId, targetHash: hashCanonicalJson(target),
      requestScreenKey: target.requestScreenKey, expectedScreenTitle: target.expectedScreenTitle,
      responseScreenId: screenIndex[index]!.screenId, responseTitle: target.expectedScreenTitle,
      stageId: `stage-${index + 1}`,
      htmlSourceRefHash: "1".repeat(64), screenshotSourceRefHash: "2".repeat(64),
      htmlDownloadedArtifactHash: "3".repeat(64), screenshotDownloadedArtifactHash: "4".repeat(64),
      htmlArtifactHash: "3".repeat(64), screenshotArtifactHash: "4".repeat(64),
      renderedHtmlArtifactHash: "3".repeat(64), renderedScreenshotArtifactHash: "4".repeat(64),
      semanticDomHash: "5".repeat(64), semanticObservationHash: "6".repeat(64),
      roleReceiptSetHash: "7".repeat(64),
      surfaceBindings: [target.surfaceRef, ...target.containedSurfaceRefs].map((surfaceRef, surfaceIndex) => ({
        surfaceRef, elementRef: surfaceIndex === 0 ? "E000001" : "E000002", elementHash: "8".repeat(64),
      })),
      controlSlotBindings: [], actionInputBindings: [], observableBindings: [],
    })),
  };
  const sources = screenIndex.map((screen, index) => ({
    locator: screen.file,
    text: `export function ${screen.componentName}() { return <main data-surface-id="${generationTargets.targets[index]!.surfaceRef}" data-setfarm-element-ref="E000001"><span data-surface-id="${generationTargets.targets[index]!.containedSurfaceRefs[0]}" data-setfarm-element-ref="E000002" /></main>; }`,
  }));
  const resolvedTargets: SetupGeneratedScreenTargetV2[] = screenIndex.map((screen, index) => ({
    storyId: index === 0 ? "US-001" : "US-002", role: "surface_component", path: screen.file,
    surfaceId: generationTargets.targets[index]!.surfaceRef, screenId: screen.screenId, source: "scope_target",
  }));
  return { screenIndex, generationTargets, responseBindings, sources, resolvedTargets };
}

type Fixture = ReturnType<typeof fixture>;

function refreshTargetHashes(input: Fixture): void {
  input.responseBindings.generationTargetsHash = hashCanonicalJson(input.generationTargets);
  for (const binding of input.responseBindings.bindings) {
    const target = input.generationTargets.targets.find((candidate) => candidate.targetId === binding.targetRef);
    if (target) binding.targetHash = hashCanonicalJson(target);
  }
}

describe("setup generated screen admission v2", () => {
  it("admits exactly the target-bound sources in sorted order without mutating authority", () => {
    const input = fixture();
    input.screenIndex.reverse();
    input.sources.reverse();
    input.resolvedTargets.reverse();
    const original = canonicalJsonStringify(input);
    assert.deepEqual(admitSetupGeneratedScreenSourcesV2(input), [
      "src/screens/AlphaScreen.tsx", "src/screens/BetaScreen.tsx",
    ]);
    assert.equal(canonicalJsonStringify(input), original);
    assert.deepEqual(admitSetupGeneratedScreenSourcesV2(input), [
      "src/screens/AlphaScreen.tsx", "src/screens/BetaScreen.tsx",
    ]);
  });

  const refusals: ReadonlyArray<readonly [string, (input: Fixture) => void]> = [
    ["duplicate indexed response", (input) => { input.screenIndex.push(structuredClone(input.screenIndex[0]!)); }],
    ["extra indexed screen outside response set", (input) => {
      const extra = structuredClone(input.screenIndex[0]!);
      extra.screenId = "screen-extra";
      extra.file = "src/screens/ExtraScreen.tsx";
      extra.componentName = "ExtraScreen";
      extra.projection.targetRef = "TARGET_EXTRA";
      input.screenIndex.push(extra);
    }],
    ["extra unbound indexed screen", (input) => { input.screenIndex[1]!.projection.targetRef = "TARGET_UNBOUND"; }],
    ["missing indexed response", (input) => { input.screenIndex.pop(); }],
    ["non-normalized indexed path", (input) => { input.screenIndex[0]!.file = "src/screens/../AlphaScreen.tsx"; }],
    ["extra unindexed handwritten source", (input) => { input.sources.push({ locator: "src/screens/Handwritten.tsx", text: "export const handwritten = true;" }); }],
    ["duplicate exact source", (input) => { input.sources.push({ ...input.sources[0]! }); }],
    ["missing source", (input) => { input.sources.pop(); }],
    ["different source locator", (input) => { input.sources[0]!.locator = "src/screens/Handwritten.tsx"; }],
    ["invalid generated source", (input) => { input.sources[0]!.text = "export const AlphaScreen = 1;"; }],
    ["source loses root surface", (input) => { input.sources[0]!.text = input.sources[0]!.text.replace('data-surface-id="SURF_ALPHA"', 'data-surface-id="SURF_FORGED"'); }],
    ["source loses exact surface element", (input) => { input.sources[0]!.text = input.sources[0]!.text.replace("E000001", "E999999"); }],
    ["source adds active unindexed control", (input) => { input.sources[0]!.text = input.sources[0]!.text.replace("</main>", "<button>Unindexed</button></main>"); }],
    ["generation target document hash drift", (input) => { input.responseBindings.generationTargetsHash = "0".repeat(64); }],
    ["individual target hash drift", (input) => { input.responseBindings.bindings[0]!.targetHash = "0".repeat(64); }],
    ["missing generation target", (input) => { input.generationTargets.targets.pop(); refreshTargetHashes(input); }],
    ["duplicate generation target", (input) => { input.generationTargets.targets.push(structuredClone(input.generationTargets.targets[0]!)); refreshTargetHashes(input); }],
    ["missing response binding", (input) => { input.responseBindings.bindings.pop(); }],
    ["duplicate response binding", (input) => { input.responseBindings.bindings.push(structuredClone(input.responseBindings.bindings[0]!)); }],
    ["response has wrong target reference", (input) => { input.responseBindings.bindings[0]!.targetRef = "TARGET_FORGED"; }],
    ["response has wrong request key", (input) => { input.responseBindings.bindings[0]!.requestScreenKey = "forged request"; }],
    ["response has wrong screen identity", (input) => { input.responseBindings.bindings[0]!.responseScreenId = "screen-forged"; }],
    ["index has wrong title", (input) => { input.screenIndex[0]!.title = "Forged title"; }],
    ["response and index forge target title together", (input) => {
      input.screenIndex[0]!.title = "Forged title";
      input.responseBindings.bindings[0]!.responseTitle = "Forged title";
      input.responseBindings.bindings[0]!.expectedScreenTitle = "Forged title";
    }],
    ["response substitutes a contained surface for root", (input) => { input.responseBindings.bindings[0]!.surfaceBindings.shift(); }],
    ["response adds an unbound surface", (input) => { input.responseBindings.bindings[0]!.surfaceBindings.push({ surfaceRef: "SURF_Z_EXTRA", elementRef: "E000003", elementHash: "8".repeat(64) }); }],
    ["missing manifest binding", (input) => { input.resolvedTargets.shift(); }],
    ["manifest binds wrong path", (input) => { input.resolvedTargets[0] = { ...input.resolvedTargets[0]!, path: "src/screens/Other.tsx" }; }],
    ["manifest binds wrong screen", (input) => { input.resolvedTargets[0] = { ...input.resolvedTargets[0]!, screenId: "screen-forged" }; }],
    ["manifest binds contained surface instead of target root", (input) => { input.resolvedTargets[0] = { ...input.resolvedTargets[0]!, surfaceId: "SURF_ALPHA_DETAIL" }; }],
    ["manifest binds wrong role", (input) => { input.resolvedTargets[0] = { ...input.resolvedTargets[0]!, role: "action_handler" }; }],
    ["manifest uses shared edit authority", (input) => { input.resolvedTargets[0] = { ...input.resolvedTargets[0]!, source: "shared_edit_request" }; }],
    ["manifest carries a shared grant", (input) => { input.resolvedTargets[0] = { ...input.resolvedTargets[0]!, sharedGrantRequestId: "GRANT_SCREEN" }; }],
    ["manifest lacks a stable direct story owner", (input) => { input.resolvedTargets[0] = { ...input.resolvedTargets[0]!, storyId: "" }; }],
    ["manifest has duplicate direct binding", (input) => { input.resolvedTargets.push({ ...input.resolvedTargets[0]! }); }],
    ["manifest has competing direct owner", (input) => { input.resolvedTargets.push({ ...input.resolvedTargets[0]!, storyId: "US-003", role: "action_handler" }); }],
  ];
  for (const [name, mutate] of refusals) {
    it(`rejects ${name}`, () => {
      const input = fixture();
      mutate(input);
      assert.throws(() => admitSetupGeneratedScreenSourcesV2(input), {
        code: "SETUP_GENERATED_SCREEN_ADMISSION_REJECTED",
      });
    });
  }

  for (const field of ["screenIndex", "generationTargets", "responseBindings"] as const) {
    it(`rejects missing ${field} instead of trusting supplied sources`, () => {
      assert.throws(() => admitSetupGeneratedScreenSourcesV2({ ...fixture(), [field]: undefined }), {
        code: "SETUP_GENERATED_SCREEN_ADMISSION_REJECTED",
      });
    });
  }

  it("rejects undeclared projection fields instead of stripping them", () => {
    const input = fixture();
    assert.throws(() => admitSetupGeneratedScreenSourcesV2({
      ...input,
      screenIndex: [{ ...input.screenIndex[0]!, trusted: true }, input.screenIndex[1]],
    }), { code: "SETUP_GENERATED_SCREEN_ADMISSION_REJECTED" });
  });

  it("rejects undeclared generation-target fields", () => {
    const input = fixture();
    assert.throws(() => admitSetupGeneratedScreenSourcesV2({
      ...input, generationTargets: { ...input.generationTargets, trusted: true },
    }), { code: "SETUP_GENERATED_SCREEN_ADMISSION_REJECTED" });
  });

  it("rejects undeclared response-binding fields", () => {
    const input = fixture();
    assert.throws(() => admitSetupGeneratedScreenSourcesV2({
      ...input, responseBindings: { ...input.responseBindings, trusted: true },
    }), { code: "SETUP_GENERATED_SCREEN_ADMISSION_REJECTED" });
  });
});
