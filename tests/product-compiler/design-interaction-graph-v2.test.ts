import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  DesignInteractionGraphInfrastructureErrorV2,
  produceDesignInteractionGraphV2,
} from "../../src/product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import {
  DesignInteractionGraphV2Schema,
  designControlIdV2,
} from "../../src/product-compiler/schemas/design-interaction-graph-v2.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import {
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

type FixtureOptions = Readonly<{
  actionName?: string;
  buttonLabel?: string;
}>;

function strictProductSpec(options: FixtureOptions) {
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("unreachable");
  const productSpec: any = structuredClone(compiled.productSpec);
  const userAction = productSpec.actions[0]!;
  userAction.name = options.actionName ?? userAction.name;
  userAction.trigger.sourceRef = options.actionName ?? userAction.trigger.sourceRef;
  userAction.input.fields = [{ name: "phase", valueType: "string", required: true }];
  userAction.evidenceScenario.targetInputValues = { phase: "playing" };
  userAction.stateDeltas[0]!.valueFrom = { kind: "input", field: "phase" };

  const statusObservable = userAction.observableEffects.find((observable: any) =>
    observable.selector.kind === "accessibility")!;
  const systemObservable = {
    ...structuredClone(statusObservable),
    id: "OBS_SYSTEM_REFRESH_STATUS",
    evidenceRef: "EVID_SYSTEM_REFRESH_STATUS",
  };
  const systemAction = {
    ...structuredClone(userAction),
    id: "ACT_SYSTEM_REFRESH",
    name: "System Refresh",
    trigger: { kind: "system", sourceRef: "runtime" },
    input: { fields: [] },
    stateDeltas: [{
      ...structuredClone(userAction.stateDeltas[0]),
      valueFrom: { kind: "literal", value: "playing" },
    }],
    controlPlacements: [],
    evidenceScenario: {
      targetInputValues: {},
      prerequisiteSteps: [],
    },
    success: {
      ...structuredClone(userAction.success),
      evidenceRefs: ["EVID_SYSTEM_REFRESH_STATUS"],
    },
    evidenceRefs: ["EVID_SYSTEM_REFRESH_STATUS"],
    observableEffects: [systemObservable],
  };
  productSpec.actions.push(systemAction);
  productSpec.evidencePredicates.push({
    id: "EVID_SYSTEM_REFRESH_STATUS",
    kind: "observable_outcome",
    required: true,
    subjectRef: "OBS_SYSTEM_REFRESH_STATUS",
    capabilityRefs: ["CAP_BROWSER_INTERACTION"],
    assertion: { operator: "passes" },
  });
  const requirementRefs = productSpec.requirements.map((requirement: any) => requirement.id);
  productSpec.traceability.bindings.push(
    { semanticKind: "action", semanticRef: systemAction.id, requirementRefs },
    { semanticKind: "observable", semanticRef: systemObservable.id, requirementRefs },
    { semanticKind: "evidence", semanticRef: systemObservable.evidenceRef, requirementRefs },
  );
  return ProductSpecV2Schema.parse(productSpec);
}

async function fixture(options: FixtureOptions = {}) {
  const productSpec = strictProductSpec(options);
  const targetsResult = produceDesignGenerationTargetsV2(productSpec);
  assert.equal(targetsResult.status, "produced", JSON.stringify(targetsResult));
  if (targetsResult.status !== "produced") throw new Error("unreachable");
  const generationTargets = targetsResult.generationTargets;
  const target = generationTargets.targets[0]!;
  const placement = target.requiredControlPlacements[0]!;
  const statusObservable = target.requiredObservableSelectors.find((observable) =>
    observable.selector.kind === "accessibility")!;
  assert.equal(statusObservable.selector.kind, "accessibility");
  if (statusObservable.selector.kind !== "accessibility") throw new Error("unreachable");
  const statusSurface = statusObservable.selector.surfaceRef;
  const canvasSurface = target.containedSurfaceRefs.find((surfaceRef) =>
    surfaceRef !== statusSurface)!;
  const actionInputRef = `${placement.actionRef}.${placement.inputFields[0]}`;
  const htmlBytes = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    `<button data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}" data-action-input="${actionInputRef}">${options.buttonLabel ?? "Start Game"}</button>`,
    `<section data-surface-id="${canvasSurface}"><canvas aria-label="Game canvas"></canvas></section>`,
    `<section data-surface-id="${statusSurface}"><div hidden role="status" aria-label="Game status">Playing</div></section>`,
    "</main>",
  ].join(""), "design-interaction-graph-v2");
  const screenshotBytes = validStitchPng(211);
  const screenId = "screen-graph-v2";
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "design-interaction-graph-v2-test",
    batches: [{
      stageId: "stage-design-interaction-graph-v2",
      targetRefs: [target.targetId],
      source: "direct",
      candidates: [{
        screenId,
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens.screen-graph-v2"],
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
  const renderedResult = await captureStitchRenderedSemanticsV2({
    generationTargets,
    directResponseEvidence,
    artifacts,
    deviceType: "DESKTOP",
  });
  const renderedSemantics = renderedResult.artifact;
  const selectionResult = selectStitchTargetCandidatesV2({
    generationTargets,
    directResponseEvidence,
    artifacts,
    renderedSemantics,
  });
  assert.equal(selectionResult.status, "produced", JSON.stringify(selectionResult));
  if (selectionResult.status !== "produced") throw new Error("unreachable");
  const candidateSelection = selectionResult.candidateSelection;
  const bindingsResult = bindStitchTargetCandidateSelectionsV3({
    generationTargets,
    candidateSelection,
    renderedSemantics,
  });
  assert.equal(bindingsResult.status, "produced", JSON.stringify(bindingsResult));
  if (bindingsResult.status !== "produced") throw new Error("unreachable");
  const responseBindings = bindingsResult.responseBindings;
  const input = {
    productSpec,
    generationTargets,
    renderedSemantics,
    candidateSelection,
    responseBindings,
  };
  const graphResult = produceDesignInteractionGraphV2(input);
  return {
    ...input,
    target,
    placement,
    statusSurface,
    canvasSurface,
    graph: graphResult.designGraph,
  };
}

describe("DesignInteractionGraph v2", { concurrency: 1 }, () => {
  it("closes native controls, contained surfaces, affected-only surfaces, inputs, and hidden role receipts", async () => {
    const value = await fixture();
    const replay = produceDesignInteractionGraphV2(structuredClone({
      productSpec: value.productSpec,
      generationTargets: value.generationTargets,
      renderedSemantics: value.renderedSemantics,
      candidateSelection: value.candidateSelection,
      responseBindings: value.responseBindings,
    }));
    assert.deepEqual(replay.designGraph, value.graph, "canonical replay must be byte-stable");
    assert.deepEqual(DesignInteractionGraphV2Schema.parse(value.graph), value.graph);
    assert.equal(value.graph.productSpecHash, hashCanonicalJson(value.productSpec));
    assert.equal(value.graph.generationTargetsHash, hashCanonicalJson(value.generationTargets));
    assert.equal(value.graph.renderedSemanticsHash, hashCanonicalJson(value.renderedSemantics));
    assert.equal(value.graph.candidateSelectionHash, hashCanonicalJson(value.candidateSelection));
    assert.equal(value.graph.responseBindingsHash, hashCanonicalJson(value.responseBindings));

    assert.deepEqual(
      value.graph.surfaces.map((surface) => surface.surfaceRef).sort(),
      [value.target.surfaceRef, value.canvasSurface, value.statusSurface].sort(),
      "every root and contained ProductSpec surface must bind exactly once",
    );
    assert.equal(value.graph.controls.length, 1, "affected surfaces must not mint controls");
    const control = value.graph.controls[0]!;
    assert.equal(control.identity.controlSlotRef, value.placement.controlSlotRef);
    assert.equal(control.identity.actionRef, value.placement.actionRef);
    assert.equal(control.identity.surfaceRef, value.target.surfaceRef);
    assert.equal(control.identity.routeRef, value.target.routeRef);
    assert.equal(control.id, designControlIdV2({
      schema: "setfarm.design-control-identity.v2",
      controlSlotRef: value.placement.controlSlotRef,
      actionRef: value.placement.actionRef,
      routeRef: value.target.routeRef,
      surfaceRef: value.target.surfaceRef,
    }));
    assert.match(control.id, /^CTRL_[a-f0-9]{16}$/);
    assert.equal(control.tagName, "button");
    assert.equal(control.nativeControlKind, "button", "native #2041 button semantics must be authoritative");
    assert.equal(control.role, null);
    assert.equal(control.renderState, "rendered");
    assert.equal(control.enabled, true);
    assert.equal(control.pointerOperable, true);
    assert.deepEqual(control.actionInputBindings.map((binding) => binding.actionInputRef), [
      `${value.placement.actionRef}.phase`,
    ]);

    const userAction = value.graph.actions.find((action) => action.actionRef === value.placement.actionRef)!;
    assert.deepEqual(userAction.controlSlotRefs, [value.placement.controlSlotRef]);
    assert.deepEqual(userAction.controlRefs, [control.id]);
    assert.deepEqual(userAction.affectedSurfaceRefs.sort(), [value.canvasSurface, value.statusSurface].sort());
    const systemAction = value.graph.actions.find((action) =>
      action.actionRef === "ACT_SYSTEM_REFRESH")!;
    assert.equal(systemAction.triggerKind, "system");
    assert.deepEqual(systemAction.controlSlotRefs, []);
    assert.deepEqual(systemAction.controlRefs, []);

    const hiddenObservables = value.graph.observables.filter((observable) =>
      observable.selector.kind === "accessibility");
    assert.equal(hiddenObservables.length, 2);
    hiddenObservables.forEach((observable) => {
      assert.equal(observable.roleReceipt?.receipt.visibilityRequirement, "traceable_hidden_allowed");
      assert.deepEqual(observable.roleReceipt?.receipt.cardinality, {
        expected: 1,
        observed: 1,
        visible: 0,
      });
      assert.equal(observable.assertions.length, 1);
      assert.equal(observable.evidenceRef.startsWith("EVID_"), true);
      assert.equal(observable.elementBindings.length, 1);
    });
    assert.deepEqual(value.graph.cardinality, {
      rawArtifacts: 2,
      sourceAuthorities: 1,
      surfaces: 3,
      actions: 2,
      userActions: 1,
      controlSlots: 1,
      physicalControls: 1,
      actionInputBindings: 1,
      observables: 4,
    });
  });

  it("derives physical IDs from semantic identity, never action or rendered labels", async () => {
    const baseline = await fixture({ actionName: "Start Game", buttonLabel: "Start Game" });
    const relabeled = await fixture({
      actionName: "Launch The Experience",
      buttonLabel: "This label must never become identity",
    });
    assert.notEqual(baseline.productSpec.actions[0]!.name, relabeled.productSpec.actions[0]!.name);
    assert.notEqual(
      baseline.graph.sourceAuthorities[0]!.htmlArtifactHash,
      relabeled.graph.sourceAuthorities[0]!.htmlArtifactHash,
    );
    assert.equal(baseline.graph.controls[0]!.id, relabeled.graph.controls[0]!.id);
    assert.equal(
      baseline.graph.controls[0]!.identity.identityHash,
      relabeled.graph.controls[0]!.identity.identityHash,
    );
  });

  it("throws typed failures for hash drift and exact downstream binding drift", async () => {
    const value = await fixture();
    const driftedChain: any = structuredClone(value.responseBindings);
    driftedChain.candidateSelectionHash = "a".repeat(64);
    assert.throws(
      () => produceDesignInteractionGraphV2({ ...value, responseBindings: driftedChain }),
      (error: unknown) => error instanceof DesignInteractionGraphInfrastructureErrorV2
        && error.code === "DESIGN_GRAPH_V2_AUTHORITY_CHAIN_MISMATCH"
        && error.phase === "authority_chain_validation",
    );

    const forgedElement: any = structuredClone(value.responseBindings);
    forgedElement.bindings[0]!.surfaceBindings[0]!.elementHash = "b".repeat(64);
    assert.throws(
      () => produceDesignInteractionGraphV2({ ...value, responseBindings: forgedElement }),
      (error: unknown) => error instanceof DesignInteractionGraphInfrastructureErrorV2
        && error.code === "DESIGN_GRAPH_V2_CONTRACT_MISMATCH"
        && error.phase === "contract_validation",
    );

    const missingSurface: any = structuredClone(value.responseBindings);
    missingSurface.bindings[0]!.surfaceBindings.splice(1, 1);
    assert.throws(
      () => produceDesignInteractionGraphV2({ ...value, responseBindings: missingSurface }),
      (error: unknown) => error instanceof DesignInteractionGraphInfrastructureErrorV2
        && error.code === "DESIGN_GRAPH_V2_CONTRACT_MISMATCH",
    );

    const duplicateSurface: any = structuredClone(value.responseBindings);
    duplicateSurface.bindings[0]!.surfaceBindings.push(
      structuredClone(duplicateSurface.bindings[0]!.surfaceBindings[0]),
    );
    assert.throws(
      () => produceDesignInteractionGraphV2({ ...value, responseBindings: duplicateSurface }),
      (error: unknown) => error instanceof DesignInteractionGraphInfrastructureErrorV2
        && error.code === "DESIGN_GRAPH_V2_INPUT_INVALID"
        && error.phase === "input_validation",
    );
  });

  it("rejects forged graph IDs, refs, missing nodes, duplicates, and cardinality", async () => {
    const value = await fixture();
    const forgedId: any = structuredClone(value.graph);
    forgedId.controls[0]!.id = "CTRL_aaaaaaaaaaaaaaaa";
    forgedId.actions.find((action: any) => action.triggerKind === "user")!.controlRefs = [
      "CTRL_aaaaaaaaaaaaaaaa",
    ];
    assert.equal(DesignInteractionGraphV2Schema.safeParse(forgedId).success, false);

    const forgedRef: any = structuredClone(value.graph);
    forgedRef.observables.find((observable: any) =>
      observable.selector.kind === "control")!.elementBindings[0]!.elementRef = "E999999";
    assert.equal(DesignInteractionGraphV2Schema.safeParse(forgedRef).success, false);

    const missing: any = structuredClone(value.graph);
    missing.surfaces = missing.surfaces.filter((surface: any) =>
      surface.surfaceRef !== value.canvasSurface);
    missing.cardinality.surfaces -= 1;
    assert.equal(DesignInteractionGraphV2Schema.safeParse(missing).success, false);

    const duplicate: any = structuredClone(value.graph);
    duplicate.controls.push(structuredClone(duplicate.controls[0]));
    duplicate.cardinality.physicalControls += 1;
    assert.equal(DesignInteractionGraphV2Schema.safeParse(duplicate).success, false);

    const wrongCardinality: any = structuredClone(value.graph);
    wrongCardinality.cardinality.observables -= 1;
    assert.equal(DesignInteractionGraphV2Schema.safeParse(wrongCardinality).success, false);
  });
});
