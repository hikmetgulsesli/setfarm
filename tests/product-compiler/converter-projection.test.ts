import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection.js";
import { produceDesignInteractionGraphV2 } from "../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import { StitchScreenIndexEntryV2Schema } from "../../src/product-compiler/schemas/stitch-screen-index-v2.js";
import { validateStitchScreenSourceV2 } from "../../src/product-compiler/stitch-screen-source-validator-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { buildContainedGameProductSpecV2 } from "./fixtures/product-semantics-v2.js";
import {
  buildTestRenderedSemantics,
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

async function writeNativeV2Projection(
  root: string,
  options: {
    customRoleControl?: boolean;
    implicitStatusRole?: boolean;
    materialIcons?: boolean;
  } = {},
) {
  const stitch = path.join(root, "stitch");
  fs.mkdirSync(stitch, { recursive: true });
  const productSpec = buildContainedGameProductSpecV2();
  const producedTargets = produceDesignGenerationTargetsV2(productSpec);
  assert.equal(producedTargets.status, "produced", JSON.stringify(producedTargets));
  if (producedTargets.status !== "produced") throw new Error("unreachable");
  const generationTargets = producedTargets.generationTargets;
  const target = generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility")!;
  assert.equal(statusObservable.selector.kind, "accessibility");
  if (statusObservable.selector.kind !== "accessibility") throw new Error("unreachable");
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusObservable.selector.surfaceRef)!;
  const physicalControl = options.customRoleControl
    ? `<div role="button" aria-label="Start Game" tabindex="0" data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</div>`
    : `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}">Start Game</button>`;
  const materialIconDecorations = options.materialIcons
    ? `<div aria-label="Static icon samples"><span class="material-symbols-outlined h-5 w-5">play_arrow</span><i class="material-icons icon-shell" data-icon="search"></i><span class="material-symbols-outlined text-slate-500">project_specific_unknown_icon</span></div>`
    : "";
  const statusElement = options.implicitStatusRole
    ? `<output hidden aria-label="${statusObservable.selector.name}">Playing</output>`
    : `<div hidden role="${statusObservable.selector.role}" aria-label="${statusObservable.selector.name}">Playing</div>`;
  const htmlBytes = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    physicalControl,
    materialIconDecorations,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusObservable.selector.surfaceRef}">${statusElement}</section>`,
    "</main>",
  ].join(""), "converter-native-v2");
  const screenshotBytes = validStitchPng(177);
  const screenId = "screen-converter-native-v2";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "converter-native-v2",
    batches: [{
      stageId: "stage-converter-native-v2",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
        identityConflicts: [],
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }],
    }],
  };
  const artifacts = [{ screenId, htmlBytes, screenshotBytes }];
  const capture = await captureStitchRenderedSemanticsV2({
    generationTargets,
    directResponseEvidence,
    artifacts,
    deviceType: "DESKTOP",
  });
  const selected = selectStitchTargetCandidatesV2({
    generationTargets,
    directResponseEvidence,
    renderedSemantics: capture.artifact,
    artifacts,
  });
  assert.equal(selected.status, "produced", JSON.stringify(selected));
  if (selected.status !== "produced") throw new Error("unreachable");
  const bound = bindStitchTargetCandidateSelectionsV3({
    generationTargets,
    candidateSelection: selected.candidateSelection,
    renderedSemantics: capture.artifact,
  });
  assert.equal(bound.status, "produced", JSON.stringify(bound));
  if (bound.status !== "produced") throw new Error("unreachable");
  const designGraph = produceDesignInteractionGraphV2({
    productSpec,
    generationTargets,
    renderedSemantics: capture.artifact,
    candidateSelection: selected.candidateSelection,
    responseBindings: bound.responseBindings,
  }).designGraph;

  fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
    screenId,
    title: target.expectedScreenTitle,
    htmlFile: `${screenId}.html`,
    screenshotFile: `${screenId}.png`,
    targetRef: target.targetId,
  }]));
  fs.writeFileSync(path.join(stitch, `${screenId}.html`), htmlBytes);
  fs.writeFileSync(path.join(stitch, `${screenId}.png`), screenshotBytes);
  for (const [locator, bytes] of capture.sidecars.semanticDom) {
    const destination = path.join(root, ...locator.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  fs.writeFileSync(path.join(stitch, "GENERATION_TARGETS.json"), JSON.stringify(generationTargets));
  fs.writeFileSync(path.join(stitch, "STITCH_RENDERED_SEMANTICS_V2.json"), JSON.stringify(capture.artifact));
  fs.writeFileSync(path.join(stitch, "STITCH_TARGET_CANDIDATE_SELECTION.json"), JSON.stringify(selected.candidateSelection));
  fs.writeFileSync(path.join(stitch, "STITCH_RESPONSE_BINDINGS.json"), JSON.stringify(bound.responseBindings));
  fs.writeFileSync(path.join(stitch, "DESIGN_INTERACTION_GRAPH_V2.json"), JSON.stringify(designGraph));
  return { target, placement, designGraph, screenId };
}

describe("Stitch converter semantic projection", () => {
  it("does not infer native v2 authority from partial or mixed-version artifacts", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-v2-version-boundary-"));
    try {
      const stitch = path.join(root, "stitch");
      fs.mkdirSync(stitch, { recursive: true });
      fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), "[]");
      fs.writeFileSync(path.join(stitch, "GENERATION_TARGETS.json"), JSON.stringify({
        schema: "setfarm.design-generation-targets.v2",
        productSpecHash: "a".repeat(64),
        targets: [],
      }));
      fs.writeFileSync(path.join(stitch, "STITCH_RESPONSE_BINDINGS.json"), JSON.stringify({
        schema: "setfarm.stitch-target-response-bindings.v3",
        generationTargetsHash: "b".repeat(64),
        directResponseEvidenceHash: "c".repeat(64),
        candidateSelectionHash: "d".repeat(64),
        renderedSemanticsHash: "e".repeat(64),
        bindings: [],
      }));
      assert.throws(() => execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      }));
      let failed = JSON.parse(fs.readFileSync(
        path.join(root, ".setfarm/setup/STITCH_TO_JSX_RESULT.json"),
        "utf8",
      ));
      assert.equal(failed.failureCode, "V2_PROJECTION_CONTRACT_PARTIAL");

      fs.writeFileSync(path.join(stitch, "GENERATION_TARGETS.json"), JSON.stringify({
        schema: "setfarm.design-generation-targets.v1",
        productSpecHash: "a".repeat(64),
        targets: [],
      }));
      fs.writeFileSync(path.join(stitch, "STITCH_RESPONSE_BINDINGS.json"), JSON.stringify({
        schema: "setfarm.stitch-target-response-bindings.v1",
        generationTargetsHash: "b".repeat(64),
        bindings: [],
      }));
      fs.writeFileSync(path.join(stitch, "DESIGN_INTERACTION_GRAPH_V2.json"), JSON.stringify({
        schema: "setfarm.design-interaction-graph.v2",
      }));
      assert.throws(() => execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      }));
      failed = JSON.parse(fs.readFileSync(
        path.join(root, ".setfarm/setup/STITCH_TO_JSX_RESULT.json"),
        "utf8",
      ));
      assert.equal(failed.failureCode, "V2_PROJECTION_VERSION_MIXED");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("projects native v2 physical slots and every observable from exact browser authority", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-v2-contract-projection-"));
    try {
      const value = await writeNativeV2Projection(root);
      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));
      assert.equal(index.length, 1);
      assert.equal(index[0].projection.authoritySchema, "setfarm.design-interaction-graph.v2");
      const graphControl = value.designGraph.controls.find((control) =>
        control.identity.controlSlotRef === value.placement.controlSlotRef)!;
      const graphAction = value.designGraph.actions.find((action) =>
        action.actionRef === value.placement.actionRef)!;
      const control = index[0].controls.find((entry: any) =>
        entry.controlSlotRef === value.placement.controlSlotRef);
      assert.ok(control);
      assert.equal(control.actionRef, value.placement.actionRef);
      assert.equal(control.surfaceRef, value.placement.surfaceRef);
      assert.equal(control.physicalControlRef, graphControl.id);
      assert.equal(control.sourceElementRef, graphControl.elementRef);
      assert.deepEqual(control.affectedSurfaceRefs, graphAction.affectedSurfaceRefs);
      assert.notDeepEqual(control.affectedSurfaceRefs, [control.surfaceRef]);
      assert.equal(control.tagName, graphControl.tagName);
      assert.equal(control.nativeControlKind, graphControl.nativeControlKind);
      assert.equal(control.role, graphControl.role);
      assert.equal(control.ariaLabel, graphControl.ariaLabel);
      assert.equal(control.href, graphControl.href);
      assert.equal(control.interactiveRole, graphControl.interactiveRole);

      assert.equal(index[0].observables.length, value.target.requiredObservableSelectors.length);
      for (const expected of value.target.requiredObservableSelectors) {
        const observable = index[0].observables.find((entry: any) =>
          entry.observableRef === expected.observableRef);
        const graphObservable = value.designGraph.observables.find((entry) =>
          entry.observableRef === expected.observableRef)!;
        assert.ok(observable);
        assert.equal(observable.actionRef, expected.actionRef);
        assert.equal(observable.selectorKind, expected.selector.kind);
        assert.equal(observable.sourceElementRef, graphObservable.elementBindings[0]!.elementRef);
        assert.equal(observable.evidenceRef, graphObservable.evidenceRef);
      }

      const source = fs.readFileSync(path.join(root, index[0].file), "utf8");
      const exactControlTag = source.match(new RegExp(
        `<button[^>]*data-setfarm-element-ref="${graphControl.elementRef}"[^>]*>`,
      ))?.[0];
      assert.ok(exactControlTag);
      assert.match(exactControlTag, new RegExp(`data-action="${value.placement.actionRef}"`));
      assert.match(exactControlTag, new RegExp(`data-control-slot="${value.placement.controlSlotRef}"`));
      assert.match(exactControlTag, /data-action-id=/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits mapped and fallback Material icons as validator-safe source-local intrinsic SVG", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-v2-intrinsic-icons-"));
    try {
      await writeNativeV2Projection(root, { materialIcons: true });
      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const rawIndex = JSON.parse(fs.readFileSync(
        path.join(root, "src/screens/SCREEN_INDEX.json"),
        "utf8",
      ));
      assert.equal(rawIndex.length, 1);
      const screen = StitchScreenIndexEntryV2Schema.parse(rawIndex[0]);
      const source = fs.readFileSync(path.join(root, screen.file), "utf8");

      assert.doesNotMatch(source, /from\s+["']lucide-react["']/);
      assert.doesNotMatch(source, /<(?:Play|Search|BadgeHelp)\b/);
      assert.match(source, /<svg[^>]*className="h-5 w-5"[^>]*data-setfarm-icon="play_arrow"[^>]*data-setfarm-icon-source="intrinsic-registry\.v1"/);
      assert.match(source, /<polygon points="6 3 20 12 6 21 6 3"\s*\/>/);
      assert.match(source, /<i[^>]*className="icon-shell"[^>]*><svg[^>]*data-setfarm-icon="search"[^>]*data-setfarm-icon-source="intrinsic-registry\.v1"/);
      assert.match(source, /<svg[^>]*className="text-slate-500"[^>]*data-setfarm-icon="project_specific_unknown_icon"[^>]*data-setfarm-icon-source="neutral-fallback\.v1"/);
      assert.match(source, /<circle cx="12" cy="12" r="9"\s*\/>/);
      assert.deepEqual(validateStitchScreenSourceV2({ screen, sourceText: source }), {
        status: "valid",
        diagnostics: [],
      });

      const unknownReport = JSON.parse(fs.readFileSync(
        path.join(root, ".setfarm/setup/UNKNOWN_MATERIAL_ICONS.json"),
        "utf8",
      ));
      assert.equal(unknownReport.status, "warning");
      assert.equal(unknownReport.count, 1);
      assert.deepEqual(unknownReport.icons, [{
        iconName: "project_specific_unknown_icon",
        count: 1,
      }]);
      assert.match(unknownReport.guidance, /source-local neutral intrinsic SVG fallbacks/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves custom-role physical control authority and counts it exactly once", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-v2-role-control-"));
    try {
      const value = await writeNativeV2Projection(root, { customRoleControl: true });
      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));
      assert.equal(index.length, 1);
      assert.deepEqual(index[0].projection.rawInteractiveCounts, {
        buttons: 1,
        links: 0,
        inputs: 0,
        textareas: 0,
        selects: 0,
      });
      assert.equal(index[0].buttons, 1);
      assert.equal(index[0].links, 0);
      const control = index[0].controls.find((entry: any) =>
        entry.controlSlotRef === value.placement.controlSlotRef);
      assert.deepEqual({
        tagName: control.tagName,
        nativeControlKind: control.nativeControlKind,
        role: control.role,
        ariaLabel: control.ariaLabel,
        href: control.href,
        interactiveRole: control.interactiveRole,
      }, {
        tagName: "div",
        nativeControlKind: null,
        role: "button",
        ariaLabel: "Start Game",
        href: null,
        interactiveRole: true,
      });
      const source = fs.readFileSync(path.join(root, index[0].file), "utf8");
      assert.match(source, new RegExp(
        `<div[^>]*data-setfarm-element-ref="${control.sourceElementRef}"[^>]*data-action-id="${control.generatedLocalId}"[^>]*onClick=`,
      ));
      assert.doesNotMatch(source, new RegExp(`<button[^>]*data-action-id="${control.generatedLocalId}"`));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts browser-proven implicit native roles and seals canonical generated role/name", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-v2-implicit-role-"));
    try {
      await writeNativeV2Projection(root, { implicitStatusRole: true });
      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));
      const observable = index[0].observables.find((entry: any) =>
        entry.selectorKind === "accessibility");
      assert.ok(observable);
      const source = fs.readFileSync(path.join(root, index[0].file), "utf8");
      const generatedTag = source.match(new RegExp(
        `<output[^>]*data-setfarm-element-ref="${observable.sourceElementRef}"[^>]*>`,
      ))?.[0];
      assert.ok(generatedTag);
      assert.match(generatedTag, /role="status"/);
      assert.match(generatedTag, /aria-label="Game status"/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed on native v2 physical-slot drift and canonical hash-chain drift", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-v2-slot-tamper-"));
    try {
      const value = await writeNativeV2Projection(root);
      const graphPath = path.join(root, "stitch/DESIGN_INTERACTION_GRAPH_V2.json");
      const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
      const graphAction = graph.actions.find((action: any) => action.actionRef === value.placement.actionRef);
      const graphControl = graph.controls.find((control: any) =>
        control.identity.controlSlotRef === value.placement.controlSlotRef);
      graphControl.identity.surfaceRef = graphAction.affectedSurfaceRefs[0];
      fs.writeFileSync(graphPath, JSON.stringify(graph));

      assert.throws(() => execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      }));
      const failed = JSON.parse(fs.readFileSync(
        path.join(root, ".setfarm/setup/STITCH_TO_JSX_RESULT.json"),
        "utf8",
      ));
      assert.equal(failed.failureCode, "V2_PROJECTION_CONTROL_BINDING_MISMATCH");

      fs.writeFileSync(graphPath, JSON.stringify(value.designGraph));
      const selectionPath = path.join(root, "stitch/STITCH_TARGET_CANDIDATE_SELECTION.json");
      const selection = JSON.parse(fs.readFileSync(selectionPath, "utf8"));
      selection.directResponseEvidenceHash = "f".repeat(64);
      fs.writeFileSync(selectionPath, JSON.stringify(selection));
      assert.throws(() => execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      }));
      const chainFailure = JSON.parse(fs.readFileSync(
        path.join(root, ".setfarm/setup/STITCH_TO_JSX_RESULT.json"),
        "utf8",
      ));
      assert.equal(chainFailure.failureCode, "V2_PROJECTION_AUTHORITY_CHAIN_MISMATCH");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("projects only exact v3 controls and records every undeclared Stitch control as neutralized evidence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-contract-projection-"));
    try {
      const stitch = path.join(root, "stitch");
      fs.mkdirSync(stitch, { recursive: true });
      fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
        screenId: "status-screen",
        title: "Status Page - Status Utility",
        surfaceIds: ["SURF_STATUS"],
      }]));
      const generationTargets = {
        schema: "setfarm.design-generation-targets.v1",
        productSpecHash: "a".repeat(64),
        targets: [{
          targetId: "TARGET_STATUS",
          designSurfaceId: "DSURF_STATUS",
          surfaceRef: "SURF_STATUS",
          requestScreenKey: "Status Page - Status Utility",
          expectedScreenTitle: "Status Page - Status Utility",
          requiredActionRefs: ["ACT_REFRESH"],
          requiredActionInputs: [{ actionRef: "ACT_REFRESH", inputFields: ["query"] }],
          requiredObservableSelectors: [{
            observableRef: "OBS_REFRESHED_STATUS",
            actionRef: "ACT_REFRESH",
            selector: {
              kind: "accessibility",
              surfaceRef: "SURF_STATUS",
              actionRef: "ACT_REFRESH",
              role: "status",
              name: "Status refreshed",
            },
          }],
        }],
      };
      fs.writeFileSync(path.join(stitch, "GENERATION_TARGETS.json"), JSON.stringify(generationTargets));
      const htmlBytes = validStitchHtml(`
        <main data-surface-id="SURF_STATUS" data-setfarm-element-ref="E000001">
          <button hidden data-setfarm-element-ref="E000002">Settings</button>
          <button hidden aria-label="Help" data-setfarm-element-ref="E000003">?</button>
          <button data-action="ACT_REFRESH" data-setfarm-element-ref="E000004">Refresh Status</button>
          <input aria-label="Status query" data-action-input="ACT_REFRESH.query" data-setfarm-element-ref="E000005" placeholder="Use A > B / C" />
          <input hidden aria-label="Decorative filter" data-setfarm-element-ref="E000006" data-note='Filter > / options' />
          <img title="1 > 0" role="status" aria-label="Status refreshed" data-setfarm-element-ref="E000007" />
          ${"<p>design-token</p>".repeat(80)}
        </main>
      `, "converter-browser-authority");
      const screenshotBytes = validStitchPng(9);
      fs.writeFileSync(path.join(stitch, "status-screen.html"), htmlBytes);
      fs.writeFileSync(path.join(stitch, "status-screen.png"), screenshotBytes);
      const directResponseEvidence = {
        schema: "setfarm.stitch-direct-response-evidence.v2",
        projectId: "converter-browser-authority",
        batches: [{
          stageId: "stage-status",
          targetRefs: ["TARGET_STATUS"],
          source: "direct",
          candidates: [{
            screenId: "status-screen",
            title: "Status Page - Status Utility",
            responsePaths: ["$result.screens[0]"],
            htmlAvailable: true,
            screenshotAvailable: true,
            ...stitchDownloadReceipts("status-screen", htmlBytes, screenshotBytes),
            identityConflicts: [],
            disposition: "admitted_renderable_screen",
            missingEvidence: [],
          }],
        }],
      };
      const artifacts = [{ screenId: "status-screen", htmlBytes, screenshotBytes }];
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
      if (selected.status !== "produced") return;
      const bound = bindStitchTargetCandidateSelectionsV2({
        generationTargets,
        candidateSelection: selected.candidateSelection,
      });
      assert.equal(bound.status, "produced", JSON.stringify(bound.diagnostics));
      if (bound.status !== "produced") return;
      fs.mkdirSync(path.join(stitch, "rendered-dom"), { recursive: true });
      fs.writeFileSync(path.join(stitch, "rendered-dom/status-screen.html"), htmlBytes);
      fs.writeFileSync(path.join(stitch, "STITCH_RENDERED_SEMANTICS.json"), JSON.stringify(renderedSemantics));
      fs.writeFileSync(path.join(stitch, "STITCH_TARGET_CANDIDATE_SELECTION.json"), JSON.stringify(selected.candidateSelection));
      fs.writeFileSync(path.join(stitch, "STITCH_RESPONSE_BINDINGS.json"), JSON.stringify(bound.responseBindings));

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));
      assert.deepEqual(index[0].projection, {
        schema: "setfarm.stitch-screen-projection.v2",
        mode: "contract_only",
        targetRef: "TARGET_STATUS",
        rawInteractiveCounts: { buttons: 3, links: 0, inputs: 2, textareas: 0, selects: 0 },
        requiredObservableRefs: ["OBS_REFRESHED_STATUS"],
      });
      assert.deepEqual(index[0].observables, [{
        observableRef: "OBS_REFRESHED_STATUS",
        role: "status",
        name: "Status refreshed",
        sourceLocator: "stitch/rendered-dom/status-screen.html",
        generatedSourceLocator: "src/screens/StatusPageStatusUtility.tsx",
        selector: '[data-observable-refs~="OBS_REFRESHED_STATUS"]',
        sourceElementRef: "E000007",
      }]);
      assert.equal(index[0].controls.length, 2);
      assert.deepEqual(index[0].controls.find((control: { kind: string }) => control.kind === "input").inputBindings, [{
        actionRef: "ACT_REFRESH",
        inputField: "query",
      }]);
      assert.deepEqual(
        index[0].rejectedControls.map((control: { label: string; reasonCode: string }) => ({
          label: control.label,
          reasonCode: control.reasonCode,
        })),
        [
          { label: "Settings", reasonCode: "outside_canonical_rendered_contract" },
          { label: "Help", reasonCode: "outside_canonical_rendered_contract" },
          { label: "Decorative filter", reasonCode: "outside_canonical_rendered_contract" },
        ],
      );

      const source = fs.readFileSync(path.join(root, "src/screens/StatusPageStatusUtility.tsx"), "utf8");
      assert.match(source, /<button[^>]*hidden=\{true\}[^>]*data-setfarm-rejected-control="settings-1"[^>]*>Settings<\/button>/);
      assert.match(source, /<button[^>]*hidden=\{true\}[^>]*data-setfarm-rejected-control="help-2"[^>]*>/);
      assert.match(source, /placeholder="Use A > B \/ C"/);
      assert.match(source, /data-control-id="status-query-1"/);
      assert.match(source, /hidden=\{true\}[^>]*data-setfarm-rejected-control="decorative-filter-2"/);
      assert.match(source, /data-action="ACT_REFRESH"[^>]*data-action-id="refresh-status-3"[^>]*onClick=/);
      assert.match(source, /<img[^>]*title="1 > 0"[^>]*role="status"[^>]*aria-label="Status refreshed"[^>]*data-observable-refs="OBS_REFRESHED_STATUS"[^>]*\/>/);
      assert.doesNotMatch(source, /actions\?\.\["settings-1"\]|actions\?\.\["help-2"\]/);
      assert.doesNotMatch(source, /\/\s+data-(?:control-id|setfarm-rejected-control)=/);
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || [])
        .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map((diagnostic) => diagnostic.messageText), []);
      fs.appendFileSync(path.join(stitch, "rendered-dom/status-screen.html"), "<!-- stale mutation -->");
      assert.throws(() => execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      }));
      const failed = JSON.parse(fs.readFileSync(
        path.join(root, ".setfarm/setup/STITCH_TO_JSX_RESULT.json"),
        "utf8",
      ));
      assert.equal(failed.failureCode, "V3_RENDERED_SEMANTIC_DOM_HASH_MISMATCH");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains same-element semantic and generated-local action identity", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-semantic-projection-"));
    try {
      const stitch = path.join(root, "stitch");
      fs.mkdirSync(stitch, { recursive: true });
      fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
        screenId: "editor",
        title: "Task Editor",
        surfaceIds: ["SURF_EDITOR"],
      }]));
      const filler = "<p>design-token</p>".repeat(80);
      fs.writeFileSync(path.join(stitch, "editor.html"), `<!doctype html><html><body>
        <label for="task-title">Task Title</label>
        <input id="task-title" />
        <label for="task-desc">Description</label>
        <textarea id="task-desc"></textarea>
        <button data-action="ACT_SAVE_RECORD">Save Changes</button>
        <button data-action="actSaveRecord">Invalid Semantic Token</button>
        <a href="#" data-action="ACT_EXPORT_JSON">Export JSON</a>
        ${filler}
      </body></html>`);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(
        fs.readFileSync(path.join(root, "src", "screens", "SCREEN_INDEX.json"), "utf8"),
      );
      const save = index[0].actions.find((action: { actionRef?: string }) =>
        action.actionRef === "ACT_SAVE_RECORD");
      const exportAction = index[0].actions.find((action: { actionRef?: string }) =>
        action.actionRef === "ACT_EXPORT_JSON");
      const invalid = index[0].actions.find((action: { label: string }) =>
        action.label === "Invalid Semantic Token");

      assert.deepEqual(save, {
        id: "save-changes-1",
        kind: "button",
        label: "Save Changes",
        index: 0,
        actionRef: "ACT_SAVE_RECORD",
        generatedLocalId: "save-changes-1",
        semanticSource: "data-action",
        sourceLocator: "stitch/editor.html",
        selector: '[data-action-id="save-changes-1"]',
      });
      assert.deepEqual(exportAction, {
        id: "export-json-1",
        kind: "link",
        label: "Export JSON",
        href: "#",
        index: 0,
        actionRef: "ACT_EXPORT_JSON",
        generatedLocalId: "export-json-1",
        semanticSource: "data-action",
        sourceLocator: "stitch/editor.html",
        selector: '[data-action-id="export-json-1"]',
      });
      assert.equal(invalid.actionRef, undefined);
      assert.equal(invalid.generatedLocalId, undefined);
      assert.deepEqual(
        index[0].actions.map((action: { id: string }) => action.id),
        ["save-changes-1", "invalid-semantic-token-2", "export-json-1"],
      );

      const code = fs.readFileSync(
        path.join(root, "src", "screens", "TaskEditor.tsx"),
        "utf8",
      );
      assert.match(code, /data-action="ACT_SAVE_RECORD"[^>]*data-action-id="save-changes-1"/);
      assert.match(code, /data-action="ACT_EXPORT_JSON"[^>]*data-action-id="export-json-1"/);
      assert.doesNotMatch(JSON.stringify(index), /"Description"|"task-title"|"task-desc"/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits exact value-input mappings without exposing uncontracted form controls", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-input-projection-"));
    try {
      const stitch = path.join(root, "stitch");
      fs.mkdirSync(stitch, { recursive: true });
      fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
        screenId: "editor-v3",
        title: "Task Editor - Exact Product",
        surfaceIds: ["SURF_EDITOR"],
      }]));
      fs.writeFileSync(path.join(stitch, "editor-v3.html"), `<!doctype html><html><body>
        <input aria-label="Task title" data-action-input="ACT_SAVE_RECORD.title" />
        <input aria-label="Decorative search" />
        <button data-action="ACT_SAVE_RECORD">Save</button>
        ${"<p>design-token</p>".repeat(80)}
      </body></html>`);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });
      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));
      assert.equal(index[0].inputs, 2);
      assert.equal(index[0].controls.filter((control: { kind: string }) => control.kind === "input").length, 1);
      assert.deepEqual(index[0].controls.find((control: { kind: string }) => control.kind === "input").inputBindings, [{
        actionRef: "ACT_SAVE_RECORD",
        inputField: "title",
      }]);
      const source = fs.readFileSync(path.join(root, "src/screens/TaskEditorExactProduct.tsx"), "utf8");
      assert.match(source, /data-action-input="ACT_SAVE_RECORD\.title"[^>]*data-control-id="task-title-1"/);
      assert.match(source, /data-action="ACT_SAVE_RECORD"[^>]*data-action-id="save-1"/);
      assert.doesNotMatch(source, /data-control-id="decorative-search/);
      assert.doesNotMatch(source, /\/\s+data-(?:control-id|setfarm-rejected-control)=/);
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics || [])
        .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(errors.map((diagnostic) => diagnostic.messageText), []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
