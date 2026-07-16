import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import { DesignGenerationTargetsV2Schema } from "../../src/product-compiler/schemas/design-generation-targets-v2.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";

const TASK = "Build a browser game with one Start Game control on the Play Page; starting it changes the contained Game Canvas and Status Panel.";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function productSpec2045(): any {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  const requirementRefs = ledger.requirements.map((requirement) => requirement.id);
  const value: any = {
    schema: "setfarm.product-spec.v2",
    product: {
      id: "PROD_CONTAINED_GAME",
      name: "Contained Game",
      class: "game",
      goals: [{ id: "GOAL_START_GAME", statement: "Start the contained browser game." }],
      nonGoals: [],
    },
    entities: [],
    states: [{
      id: "STATE_GAME_PHASE",
      name: "Game Phase",
      kind: "application",
      initialValue: { phase: "ready" },
      invariants: ["The phase is ready or playing."],
    }],
    persistencePolicies: [],
    routes: [{
      id: "ROUTE_PLAY",
      path: "/play",
      rootSurfaceRef: "SURF_PLAY_PAGE",
      surfaceRefs: ["SURF_PLAY_PAGE", "SURF_GAME_CANVAS", "SURF_STATUS_PANEL"],
      entry: true,
    }],
    surfaces: [
      {
        id: "SURF_PLAY_PAGE",
        name: "Play Page",
        kind: "page",
        routeRef: "ROUTE_PLAY",
        required: true,
        composition: { kind: "route_root" },
      },
      {
        id: "SURF_GAME_CANVAS",
        name: "Game Canvas",
        kind: "canvas",
        routeRef: "ROUTE_PLAY",
        required: true,
        composition: { kind: "contained", hostSurfaceRef: "SURF_PLAY_PAGE" },
      },
      {
        id: "SURF_STATUS_PANEL",
        name: "Status Panel",
        kind: "panel",
        routeRef: "ROUTE_PLAY",
        required: true,
        composition: { kind: "contained", hostSurfaceRef: "SURF_PLAY_PAGE" },
      },
    ],
    actions: [{
      id: "ACT_START_GAME",
      name: "Start Game",
      controlPlacements: [{
        id: "CSLOT_START_GAME_PRIMARY_START",
        surfaceRef: "SURF_PLAY_PAGE",
        controlHint: "primary_button",
      }],
      affectedSurfaceRefs: ["SURF_GAME_CANVAS", "SURF_STATUS_PANEL"],
      trigger: { kind: "user", sourceRef: "Start Game" },
      input: {
        fields: [{ name: "phase", valueType: "string", required: true }],
      },
      preconditions: [],
      evidenceScenario: {
        controlSlotRef: "CSLOT_START_GAME_PRIMARY_START",
        targetInputValues: { phase: "playing" },
        prerequisiteSteps: [],
      },
      stateDeltas: [{
        stateRef: "STATE_GAME_PHASE",
        operation: "set",
        path: "/phase",
        valueFrom: { kind: "input", field: "phase" },
      }],
      navigation: { kind: "stay" },
      persistenceEffects: [],
      success: {
        stateRefs: ["STATE_GAME_PHASE"],
        persistenceRefs: [],
        evidenceRefs: ["EVID_START_CONTROL", "EVID_CANVAS_ROUTE", "EVID_STATUS_TEXT"],
        userVisible: true,
      },
      failure: {
        stateRefs: [],
        persistenceRefs: [],
        evidenceRefs: [],
        userVisible: false,
      },
      evidenceRefs: ["EVID_START_CONTROL", "EVID_CANVAS_ROUTE", "EVID_STATUS_TEXT"],
      observableEffects: [
        {
          id: "OBS_START_CONTROL",
          selector: { kind: "control", controlSlotRef: "CSLOT_START_GAME_PRIMARY_START" },
          assertions: [
            { phase: "before", property: "visibility", operator: "equals", expected: true },
            { phase: "after", property: "visibility", operator: "equals", expected: true },
          ],
          evidenceRef: "EVID_START_CONTROL",
        },
        {
          id: "OBS_CANVAS_ROUTE",
          selector: { kind: "surface", surfaceRef: "SURF_GAME_CANVAS" },
          assertions: [{ phase: "after", property: "route", operator: "equals", expected: "/play" }],
          evidenceRef: "EVID_CANVAS_ROUTE",
        },
        {
          id: "OBS_STATUS_TEXT",
          selector: {
            kind: "accessibility",
            surfaceRef: "SURF_STATUS_PANEL",
            role: "status",
            name: "Game status",
          },
          assertions: [
            { phase: "after", property: "visible_text", operator: "contains", expected: "Playing" },
            { phase: "reload", property: "visibility", operator: "equals", expected: true },
          ],
          evidenceRef: "EVID_STATUS_TEXT",
        },
      ],
    }],
    evidencePredicates: [
      {
        id: "EVID_START_CONTROL",
        kind: "observable_outcome",
        required: true,
        subjectRef: "OBS_START_CONTROL",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
      {
        id: "EVID_CANVAS_ROUTE",
        kind: "observable_outcome",
        required: true,
        subjectRef: "OBS_CANVAS_ROUTE",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
      {
        id: "EVID_STATUS_TEXT",
        kind: "observable_outcome",
        required: true,
        subjectRef: "OBS_STATUS_TEXT",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
    ],
    assumptions: [],
    delivery: {
      platform: "game",
      techStack: "browser-game",
      uiLanguage: "English",
      database: "none",
      designRequired: true,
      uiVisionSummary: "One composed browser-game screen with a start control, canvas, and status panel.",
    },
    requirements: ledger.requirements.map((requirement) => ({
      ...requirement,
      classification: "functional",
      expectedSemanticKinds: [
        "state",
        "route",
        "surface",
        "action",
        "control_placement",
        "evidence",
        "observable",
      ],
    })),
    traceability: {
      schema: "setfarm.product-requirement-traceability.v2",
      sourceTaskHash: ledger.sourceHash,
      bindings: [],
    },
  };
  const semantics: Array<[string, string]> = [
    ...value.product.goals.map((item: any) => ["goal", item.id] as [string, string]),
    ...value.states.map((item: any) => ["state", item.id] as [string, string]),
    ...value.routes.map((item: any) => ["route", item.id] as [string, string]),
    ...value.surfaces.map((item: any) => ["surface", item.id] as [string, string]),
    ...value.actions.map((item: any) => ["action", item.id] as [string, string]),
    ...value.actions.flatMap((action: any) => action.controlPlacements.map((item: any) =>
      ["control_placement", item.id] as [string, string])),
    ...value.evidencePredicates.map((item: any) => ["evidence", item.id] as [string, string]),
    ...value.actions.flatMap((action: any) => action.observableEffects.map((item: any) =>
      ["observable", item.id] as [string, string])),
  ];
  value.traceability.bindings = semantics.map(([semanticKind, semanticRef]) => ({
    semanticKind,
    semanticRef,
    requirementRefs,
  }));
  return ProductSpecV2Schema.parse(value);
}

function addSecondRoute(input: ReturnType<typeof productSpec2045>): any {
  const value: any = clone(input);
  value.routes.push({
    id: "ROUTE_SETTINGS",
    path: "/settings",
    rootSurfaceRef: "SURF_SETTINGS_PAGE",
    surfaceRefs: ["SURF_SETTINGS_PAGE"],
    entry: false,
  });
  value.surfaces.push({
    id: "SURF_SETTINGS_PAGE",
    name: "Settings Page",
    kind: "page",
    routeRef: "ROUTE_SETTINGS",
    required: true,
    composition: { kind: "route_root" },
  });
  const requirementRefs = value.requirements.map((requirement: any) => requirement.id);
  value.traceability.bindings.push(
    { semanticKind: "route", semanticRef: "ROUTE_SETTINGS", requirementRefs },
    { semanticKind: "surface", semanticRef: "SURF_SETTINGS_PAGE", requirementRefs },
  );
  return ProductSpecV2Schema.parse(value);
}

function rejectionMessages(input: unknown): string[] {
  const result = DesignGenerationTargetsV2Schema.safeParse(input);
  assert.equal(result.success, false);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("DesignGenerationTargetsV2", () => {
  it("regresses #2045 as one route-root target with one slot and affected-only child context", () => {
    const productSpec = productSpec2045();
    const result = produceDesignGenerationTargetsV2(productSpec);
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") return;

    assert.equal(result.generationTargets.productSpecHash, hashCanonicalJson(productSpec));
    assert.equal(result.generationTargets.targets.length, 1);
    const target = result.generationTargets.targets[0]!;
    assert.equal(target.targetId, "TARGET_PLAY_PAGE");
    assert.equal(target.designSurfaceId, "DSURF_PLAY_PAGE");
    assert.equal(target.routeRef, "ROUTE_PLAY");
    assert.equal(target.surfaceRef, "SURF_PLAY_PAGE");
    assert.deepEqual(target.containedSurfaceRefs, ["SURF_GAME_CANVAS", "SURF_STATUS_PANEL"]);
    assert.deepEqual(target.requiredControlPlacements, [{
      controlSlotRef: "CSLOT_START_GAME_PRIMARY_START",
      actionRef: "ACT_START_GAME",
      surfaceRef: "SURF_PLAY_PAGE",
      controlHint: "primary_button",
      inputFields: ["phase"],
    }]);
    assert.equal(target.requiredControlPlacements.filter((placement) =>
      placement.surfaceRef === "SURF_GAME_CANVAS").length, 0);
    assert.equal(target.requiredControlPlacements.filter((placement) =>
      placement.surfaceRef === "SURF_STATUS_PANEL").length, 0);
    assert.deepEqual(target.affectingActionRefs, ["ACT_START_GAME"]);
  });

  it("preserves exact observable selectors, phases, visibility assertions, and slot qualification", () => {
    const result = produceDesignGenerationTargetsV2(productSpec2045());
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    if (result.status !== "produced") return;
    const observables = result.generationTargets.targets[0]!.requiredObservableSelectors;
    assert.deepEqual(observables.map((observable) => observable.observableRef), [
      "OBS_CANVAS_ROUTE",
      "OBS_START_CONTROL",
      "OBS_STATUS_TEXT",
    ]);
    assert.deepEqual(
      observables.find((observable) => observable.observableRef === "OBS_START_CONTROL"),
      {
        observableRef: "OBS_START_CONTROL",
        actionRef: "ACT_START_GAME",
        selector: { kind: "control", controlSlotRef: "CSLOT_START_GAME_PRIMARY_START" },
        assertions: [
          { phase: "before", property: "visibility", operator: "equals", expected: true },
          { phase: "after", property: "visibility", operator: "equals", expected: true },
        ],
      },
    );
    assert.deepEqual(
      observables.find((observable) => observable.observableRef === "OBS_STATUS_TEXT")?.assertions,
      [
        { phase: "after", property: "visible_text", operator: "contains", expected: "Playing" },
        { phase: "reload", property: "visibility", operator: "equals", expected: true },
      ],
    );
  });

  it("produces exactly one deterministic target per route-root surface", () => {
    const productSpec = addSecondRoute(productSpec2045());
    const first = produceDesignGenerationTargetsV2(productSpec);
    const second = produceDesignGenerationTargetsV2(clone(productSpec));
    assert.deepEqual(second, first);
    assert.equal(first.status, "produced", JSON.stringify(first.diagnostics));
    if (first.status !== "produced") return;
    assert.deepEqual(first.generationTargets.targets.map((target) => target.targetId), [
      "TARGET_PLAY_PAGE",
      "TARGET_SETTINGS_PAGE",
    ]);
    assert.deepEqual(first.generationTargets.targets[1], {
      targetId: "TARGET_SETTINGS_PAGE",
      designSurfaceId: "DSURF_SETTINGS_PAGE",
      routeRef: "ROUTE_SETTINGS",
      surfaceRef: "SURF_SETTINGS_PAGE",
      containedSurfaceRefs: [],
      requestScreenKey: "Settings Page - Contained Game",
      expectedScreenTitle: "Settings Page - Contained Game",
      requiredControlPlacements: [],
      affectingActionRefs: [],
      requiredObservableSelectors: [],
    });
  });

  it("rejects invalid ProductSpec v2 input with typed diagnostics", () => {
    const invalid: any = clone(productSpec2045());
    invalid.actions[0].affectedSurfaceRefs[0] = "SURF_MISSING";
    const result = produceDesignGenerationTargetsV2(invalid);
    assert.equal(result.status, "rejected");
    assert.deepEqual(result.rejectionCodes, ["DESIGN_TARGET_V2_PRODUCT_SPEC_INVALID"]);
    assert.equal(result.diagnostics.some((item) =>
      item.message.includes("PRODUCT_SPEC_AFFECTED_SURFACE_UNRESOLVED")), true);
  });

  it("rejects target-local control, observable, phase, and surface ownership drift", () => {
    const produced = produceDesignGenerationTargetsV2(productSpec2045());
    assert.equal(produced.status, "produced", JSON.stringify(produced.diagnostics));
    if (produced.status !== "produced") return;

    const outsideControl: any = clone(produced.generationTargets);
    outsideControl.targets[0].requiredControlPlacements[0].surfaceRef = "SURF_OUTSIDE";
    assert.equal(rejectionMessages(outsideControl).some((message) =>
      message.includes("DESIGN_TARGET_V2_CONTROL_SURFACE_OUTSIDE_TARGET")), true);

    const wrongSlot: any = clone(produced.generationTargets);
    wrongSlot.targets[0].requiredObservableSelectors.find((observable: any) =>
      observable.observableRef === "OBS_START_CONTROL").selector.controlSlotRef = "CSLOT_START_GAME_SECONDARY";
    assert.equal(rejectionMessages(wrongSlot).some((message) =>
      message.includes("DESIGN_TARGET_V2_OBSERVABLE_CONTROL_SLOT_UNRESOLVED")), true);

    const noAfter: any = clone(produced.generationTargets);
    noAfter.targets[0].requiredObservableSelectors.find((observable: any) =>
      observable.observableRef === "OBS_START_CONTROL").assertions = [
        { phase: "before", property: "visibility", operator: "equals", expected: true },
      ];
    assert.equal(rejectionMessages(noAfter).some((message) =>
      message.includes("DESIGN_TARGET_V2_OBSERVABLE_AFTER_REQUIRED")), true);

    const outsideObservable: any = clone(produced.generationTargets);
    outsideObservable.targets[0].requiredObservableSelectors.find((observable: any) =>
      observable.observableRef === "OBS_STATUS_TEXT").selector.surfaceRef = "SURF_OUTSIDE";
    assert.equal(rejectionMessages(outsideObservable).some((message) =>
      message.includes("DESIGN_TARGET_V2_OBSERVABLE_SURFACE_OUTSIDE_TARGET")), true);
  });

  it("keeps the v1 response ABI absent and rejects legacy target action lists", () => {
    const produced = produceDesignGenerationTargetsV2(productSpec2045());
    assert.equal(produced.status, "produced", JSON.stringify(produced.diagnostics));
    if (produced.status !== "produced") return;
    const legacy: any = clone(produced.generationTargets);
    legacy.targets[0].requiredActionRefs = ["ACT_START_GAME"];
    assert.equal(DesignGenerationTargetsV2Schema.safeParse(legacy).success, false);
    assert.equal("bindings" in produced.generationTargets, false);
  });
});
