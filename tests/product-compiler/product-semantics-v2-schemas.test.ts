import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import { PlanSemanticProposalV1Schema } from "../../src/product-compiler/schemas/plan-semantic-proposal-v1.js";
import { PlanSemanticProposalV2Schema } from "../../src/product-compiler/schemas/plan-semantic-proposal-v2.js";
import { ProductSpecV1Schema } from "../../src/product-compiler/schemas/product-spec-v1.js";
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";

const TASK = "Build a browser game with one Start Game control on the play page; starting the game updates the contained game canvas and status panel.";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function planProposal(): any {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  const requirementRefs = ledger.requirements.map((requirement) => requirement.id);
  return {
    schema: "setfarm.plan-semantic-proposal.v2",
    sourceTaskHash: ledger.sourceHash,
    product: {
      key: "contained_game",
      name: "Contained Game",
      class: "game",
      uiLanguage: "English",
      database: "none",
      uiVisionSummary: "A focused browser game with one primary start control, a contained canvas, and a compact status panel that reports the exact active game phase.",
      goals: [{
        key: "start_game",
        statement: "Start the game and expose the resulting canvas and status state.",
        requirementRefs,
      }],
      nonGoals: [],
    },
    requirements: ledger.requirements.map((requirement) => ({
      id: requirement.id,
      classification: "functional",
      expectedSemanticKinds: [
        "state",
        "route",
        "surface",
        "action",
        "control_placement",
        "observable",
      ],
    })),
    entities: [],
    states: [{
      key: "game_phase",
      name: "Game Phase",
      kind: "application",
      initialValue: { phase: "ready" },
      invariants: ["The phase is ready or playing."],
      requirementRefs,
    }],
    persistencePolicies: [],
    routes: [{
      key: "play",
      path: "/play",
      entry: true,
      requirementRefs,
    }],
    surfaces: [
      {
        key: "play_page",
        name: "Play Page",
        kind: "page",
        routeKey: "play",
        required: true,
        composition: { kind: "route_root" },
        requirementRefs,
      },
      {
        key: "game_canvas",
        name: "Game Canvas",
        kind: "canvas",
        routeKey: "play",
        required: true,
        composition: { kind: "contained", hostSurfaceKey: "play_page" },
        requirementRefs,
      },
      {
        key: "status_panel",
        name: "Status Panel",
        kind: "panel",
        routeKey: "play",
        required: true,
        composition: { kind: "contained", hostSurfaceKey: "play_page" },
        requirementRefs,
      },
    ],
    actions: [{
      key: "start_game",
      name: "Start Game",
      controlPlacements: [{
        key: "primary_start",
        surfaceKey: "play_page",
        controlHint: "primary_button",
        requirementRefs,
      }],
      affectedSurfaceKeys: ["game_canvas", "status_panel"],
      trigger: { kind: "user" },
      invocationInterface: {
        schema: "setfarm.action-invocation-interface-intent.v1",
        kind: "rendered_control",
      },
      inputs: [],
      preconditions: [],
      evidenceScenario: {
        controlPlacementKey: "primary_start",
        targetInputValues: {},
        prerequisiteSteps: [],
      },
      stateDeltas: [{
        key: "start_phase",
        stateKey: "game_phase",
        operation: "set",
        path: "/phase",
        valueFrom: { kind: "literal", value: "playing" },
      }],
      navigation: { kind: "stay" },
      persistenceIntents: [],
      observables: [
        {
          key: "start_control",
          selector: { kind: "control", controlPlacementKey: "primary_start" },
          assertions: [{ phase: "after", property: "visibility", operator: "equals", expected: true }],
          requirementRefs,
        },
        {
          key: "canvas_route",
          selector: { kind: "surface", surfaceKey: "game_canvas" },
          assertions: [{ phase: "after", property: "route", operator: "equals", expected: "/play" }],
          requirementRefs,
        },
        {
          key: "status_text",
          selector: {
            kind: "accessibility",
            surfaceKey: "status_panel",
            role: "status",
            name: "Game status",
          },
          assertions: [{ phase: "after", property: "visible_text", operator: "contains", expected: "Playing" }],
          requirementRefs,
        },
      ],
      requirementRefs,
    }],
    assumptions: [],
  };
}

function productSpec(): any {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  const requirementRefs = ledger.requirements.map((requirement) => requirement.id);
  const invocationEvidenceRef = deriveActionInvocationEvidenceIdV2("ACT_START_GAME");
  const value: any = {
    schema: "setfarm.product-spec.v2",
    product: {
      id: "PROD_CONTAINED_GAME",
      name: "Contained Game",
      class: "game",
      goals: [{
        id: "GOAL_START_GAME",
        statement: "Start the game and expose the resulting canvas and status state.",
      }],
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
      trigger: { kind: "user" },
      invocationInterface: {
        schema: "setfarm.action-invocation-interface-intent.v1",
        kind: "rendered_control",
      },
      input: { fields: [] },
      preconditions: [],
      evidenceScenario: {
        controlSlotRef: "CSLOT_START_GAME_PRIMARY_START",
        targetInputValues: {},
        prerequisiteSteps: [],
      },
      stateDeltas: [{
        stateRef: "STATE_GAME_PHASE",
        operation: "set",
        path: "/phase",
        valueFrom: { kind: "literal", value: "playing" },
      }],
      navigation: { kind: "stay" },
      persistenceEffects: [],
      success: {
        stateRefs: ["STATE_GAME_PHASE"],
        persistenceRefs: [],
        evidenceRefs: ["EVID_START_CONTROL", "EVID_CANVAS_ROUTE", "EVID_STATUS_TEXT", invocationEvidenceRef],
        userVisible: true,
      },
      failure: {
        stateRefs: [],
        persistenceRefs: [],
        evidenceRefs: [],
        userVisible: false,
      },
      evidenceRefs: ["EVID_START_CONTROL", "EVID_CANVAS_ROUTE", "EVID_STATUS_TEXT", invocationEvidenceRef],
      observableEffects: [
        {
          id: "OBS_START_CONTROL",
          selector: { kind: "control", controlSlotRef: "CSLOT_START_GAME_PRIMARY_START" },
          assertions: [{ phase: "after", property: "visibility", operator: "equals", expected: true }],
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
          assertions: [{ phase: "after", property: "visible_text", operator: "contains", expected: "Playing" }],
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
      {
        id: invocationEvidenceRef,
        kind: "action_invocation",
        required: true,
        subjectRef: "ACT_START_GAME",
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
      uiVisionSummary: "A focused browser game with one primary start control, a contained canvas, and a compact status panel.",
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
  const semantics = [
    ...value.product.goals.map((item: any) => ["goal", item.id]),
    ...value.states.map((item: any) => ["state", item.id]),
    ...value.routes.map((item: any) => ["route", item.id]),
    ...value.surfaces.map((item: any) => ["surface", item.id]),
    ...value.actions.map((item: any) => ["action", item.id]),
    ...value.actions.flatMap((action: any) =>
      action.controlPlacements.map((item: any) => ["control_placement", item.id])),
    ...value.evidencePredicates.map((item: any) => ["evidence", item.id]),
    ...value.actions.flatMap((action: any) =>
      action.observableEffects.map((item: any) => ["observable", item.id])),
  ];
  value.traceability.bindings = semantics.map(([semanticKind, semanticRef]) => ({
    semanticKind,
    semanticRef,
    requirementRefs,
  }));
  return value;
}

function rejectionMessages(result: ReturnType<typeof PlanSemanticProposalV2Schema.safeParse>): string[];
function rejectionMessages(result: ReturnType<typeof ProductSpecV2Schema.safeParse>): string[];
function rejectionMessages(result: ReturnType<typeof PlanSemanticProposalV2Schema.safeParse> | ReturnType<typeof ProductSpecV2Schema.safeParse>): string[] {
  assert.equal(result.success, false);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("PlanSemanticProposalV2 schema authority", () => {
  it("parses the same three-surface product deterministically with only one physical control placement", () => {
    const first = PlanSemanticProposalV2Schema.parse(planProposal());
    const second = PlanSemanticProposalV2Schema.parse(clone(planProposal()));
    assert.deepEqual(first, second);
    assert.equal(first.actions[0]!.controlPlacements.length, 1);
    assert.deepEqual(first.actions[0]!.affectedSurfaceKeys, ["game_canvas", "status_panel"]);
    assert.equal(PlanSemanticProposalV1Schema.safeParse(first).success, false);
  });

  it("rejects orphan, cross-route, and cyclic surface containment", () => {
    const orphan = planProposal();
    orphan.surfaces[1].composition.hostSurfaceKey = "missing_host";
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(orphan)).some((message) =>
      message.includes("PLAN_SEMANTIC_SURFACE_HOST_UNRESOLVED")), true);

    const crossRoute = planProposal();
    crossRoute.routes.push({
      key: "hud",
      path: "/hud",
      entry: false,
      requirementRefs: crossRoute.routes[0].requirementRefs,
    });
    crossRoute.surfaces.push({
      key: "hud_page",
      name: "HUD Page",
      kind: "page",
      routeKey: "hud",
      required: true,
      composition: { kind: "route_root" },
      requirementRefs: crossRoute.routes[0].requirementRefs,
    });
    crossRoute.surfaces[2].routeKey = "hud";
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(crossRoute)).some((message) =>
      message.includes("PLAN_SEMANTIC_SURFACE_HOST_CROSS_ROUTE")), true);

    const cycle = planProposal();
    cycle.surfaces[1].composition.hostSurfaceKey = "status_panel";
    cycle.surfaces[2].composition.hostSurfaceKey = "game_canvas";
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(cycle)).some((message) =>
      message.includes("PLAN_SEMANTIC_SURFACE_CONTAINMENT_CYCLE")), true);
  });

  it("requires exactly one route-root surface per route", () => {
    const noRoot = planProposal();
    noRoot.surfaces[0].composition = { kind: "contained", hostSurfaceKey: "game_canvas" };
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(noRoot)).some((message) =>
      message.includes("PLAN_SEMANTIC_ROUTE_ROOT_CARDINALITY")), true);

    const twoRoots = planProposal();
    twoRoots.surfaces[1].composition = { kind: "route_root" };
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(twoRoots)).some((message) =>
      message.includes("PLAN_SEMANTIC_ROUTE_ROOT_CARDINALITY")), true);
  });

  it("rejects ambiguous control selectors and unresolved placement ownership", () => {
    const ambiguous = planProposal();
    ambiguous.actions[0].observables[0].selector = { kind: "control" };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(ambiguous).success, false);

    const wrongPlacement = planProposal();
    wrongPlacement.actions[0].observables[0].selector.controlPlacementKey = "secondary_start";
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(wrongPlacement)).some((message) =>
      message.includes("PLAN_SEMANTIC_OBSERVABLE_CONTROL_PLACEMENT_UNRESOLVED")), true);
  });

  it("enforces trigger/evidence placement rules and keeps observables inside explicit action scope", () => {
    const noControl = planProposal();
    noControl.actions[0].controlPlacements = [];
    delete noControl.actions[0].evidenceScenario.controlPlacementKey;
    const noControlMessages = rejectionMessages(PlanSemanticProposalV2Schema.safeParse(noControl));
    assert.equal(noControlMessages.some((message) => message.includes("INVOCATION_INTERFACE_RENDERED_CONTROL_REQUIRED")), true);
    assert.equal(noControlMessages.some((message) => message.includes("INVOCATION_INTERFACE_RENDERED_EVIDENCE_CONTROL_REQUIRED")), true);

    const affectedOnly = planProposal();
    affectedOnly.actions[0].affectedSurfaceKeys = ["game_canvas"];
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(affectedOnly)).some((message) =>
      message.includes("PLAN_SEMANTIC_OBSERVABLE_SURFACE_OUTSIDE_ACTION_SCOPE")), true);

    const nonUser = planProposal();
    nonUser.actions[0].trigger = { kind: "system" };
    assert.equal(rejectionMessages(PlanSemanticProposalV2Schema.safeParse(nonUser)).some((message) =>
      message.includes("INVOCATION_INTERFACE_RENDERED_TRIGGER_MISMATCH")), true);
  });

  it("rejects legacy action surfaceKeys at the strict v2 boundary", () => {
    const legacy = planProposal();
    legacy.actions[0].surfaceKeys = ["play_page", "game_canvas", "status_panel"];
    assert.equal(PlanSemanticProposalV2Schema.safeParse(legacy).success, false);
  });
});

describe("ProductSpecV2 schema authority", () => {
  it("parses deterministically with one CSLOT binding and separate affected surfaces", () => {
    const first = ProductSpecV2Schema.parse(productSpec());
    const second = ProductSpecV2Schema.parse(clone(productSpec()));
    assert.deepEqual(first, second);
    assert.deepEqual(first.actions[0]!.controlPlacements.map((placement) => placement.surfaceRef), ["SURF_PLAY_PAGE"]);
    assert.deepEqual(first.actions[0]!.affectedSurfaceRefs, ["SURF_GAME_CANVAS", "SURF_STATUS_PANEL"]);
    assert.equal(ProductSpecV1Schema.safeParse(first).success, false);
  });

  it("rejects route-index drift, orphan hosts, cross-route hosts, and containment cycles", () => {
    const indexDrift = productSpec();
    indexDrift.routes[0].surfaceRefs.pop();
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(indexDrift)).some((message) =>
      message.includes("PRODUCT_SPEC_ROUTE_SURFACE_INDEX_MISMATCH")), true);

    const orphan = productSpec();
    orphan.surfaces[1].composition.hostSurfaceRef = "SURF_MISSING";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(orphan)).some((message) =>
      message.includes("PRODUCT_SPEC_SURFACE_HOST_UNRESOLVED")), true);

    const crossRoute = productSpec();
    crossRoute.surfaces[2].routeRef = "ROUTE_MISSING";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(crossRoute)).some((message) =>
      message.includes("PRODUCT_SPEC_SURFACE_HOST_CROSS_ROUTE")), true);

    const cycle = productSpec();
    cycle.surfaces[1].composition.hostSurfaceRef = "SURF_STATUS_PANEL";
    cycle.surfaces[2].composition.hostSurfaceRef = "SURF_GAME_CANVAS";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(cycle)).some((message) =>
      message.includes("PRODUCT_SPEC_SURFACE_CONTAINMENT_CYCLE")), true);
  });

  it("requires the route root to name the exact sole route-root surface", () => {
    const wrongRoot = productSpec();
    wrongRoot.routes[0].rootSurfaceRef = "SURF_GAME_CANVAS";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(wrongRoot)).some((message) =>
      message.includes("PRODUCT_SPEC_ROUTE_ROOT_MISMATCH")), true);

    const twoRoots = productSpec();
    twoRoots.surfaces[1].composition = { kind: "route_root" };
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(twoRoots)).some((message) =>
      message.includes("PRODUCT_SPEC_ROUTE_ROOT_CARDINALITY")), true);
  });

  it("rejects ambiguous control selectors and selectors outside slot ownership", () => {
    const ambiguous = productSpec();
    ambiguous.actions[0].observableEffects[0].selector = {
      kind: "control",
      actionRef: "ACT_START_GAME",
    };
    assert.equal(ProductSpecV2Schema.safeParse(ambiguous).success, false);

    const missingSlot = productSpec();
    missingSlot.actions[0].observableEffects[0].selector.controlSlotRef = "CSLOT_START_GAME_SECONDARY";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(missingSlot)).some((message) =>
      message.includes("PRODUCT_SPEC_OBSERVABLE_CONTROL_SLOT_UNRESOLVED")), true);
  });

  it("enforces deterministic slot/action identity and evidence slot ownership", () => {
    const wrongPrefix = productSpec();
    wrongPrefix.actions[0].controlPlacements[0].id = "CSLOT_OTHER_PRIMARY_START";
    wrongPrefix.actions[0].evidenceScenario.controlSlotRef = "CSLOT_OTHER_PRIMARY_START";
    wrongPrefix.actions[0].observableEffects[0].selector.controlSlotRef = "CSLOT_OTHER_PRIMARY_START";
    wrongPrefix.traceability.bindings.find((binding: any) =>
      binding.semanticKind === "control_placement").semanticRef = "CSLOT_OTHER_PRIMARY_START";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(wrongPrefix)).some((message) =>
      message.includes("PRODUCT_SPEC_CONTROL_SLOT_ACTION_MISMATCH")), true);

    const wrongEvidence = productSpec();
    wrongEvidence.actions[0].evidenceScenario.controlSlotRef = "CSLOT_START_GAME_SECONDARY";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(wrongEvidence)).some((message) =>
      message.includes("PRODUCT_SPEC_EVIDENCE_CONTROL_SLOT_UNRESOLVED")), true);
  });

  it("does not allow affected surfaces to satisfy observable scope implicitly", () => {
    const missingAffectedSurface = productSpec();
    missingAffectedSurface.actions[0].affectedSurfaceRefs = ["SURF_GAME_CANVAS"];
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(missingAffectedSurface)).some((message) =>
      message.includes("PRODUCT_SPEC_OBSERVABLE_SURFACE_OUTSIDE_ACTION_SCOPE")), true);

    const orphanAffectedSurface = productSpec();
    orphanAffectedSurface.actions[0].affectedSurfaceRefs[1] = "SURF_MISSING";
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(orphanAffectedSurface)).some((message) =>
      message.includes("PRODUCT_SPEC_AFFECTED_SURFACE_UNRESOLVED")), true);
  });

  it("requires requirement traceability for every declared control placement", () => {
    const missingBinding = productSpec();
    missingBinding.traceability.bindings = missingBinding.traceability.bindings.filter((binding: any) =>
      binding.semanticKind !== "control_placement");
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(missingBinding)).some((message) =>
      message.includes("control_placement:CSLOT_START_GAME_PRIMARY_START")), true);
  });

  it("rejects legacy action surfaceRefs and non-user rendered slots", () => {
    const legacy = productSpec();
    legacy.actions[0].surfaceRefs = ["SURF_PLAY_PAGE", "SURF_GAME_CANVAS", "SURF_STATUS_PANEL"];
    assert.equal(ProductSpecV2Schema.safeParse(legacy).success, false);

    const nonUser = productSpec();
    nonUser.actions[0].trigger = { kind: "system" };
    assert.equal(rejectionMessages(ProductSpecV2Schema.safeParse(nonUser)).some((message) =>
      message.includes("INVOCATION_INTERFACE_RENDERED_TRIGGER_MISMATCH")), true);
  });
});
