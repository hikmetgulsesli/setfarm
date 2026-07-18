import { extractTaskRequirementLedgerV1 } from "../../../src/product-compiler/requirements/task-requirements-v1.js";
import { compilePlanSemanticProposalV2 } from "../../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../../src/product-compiler/schemas/product-spec-v2.js";

export const CONTAINED_GAME_TASK = "Build a browser game with one Start Game control on the play page; starting the game updates the contained game canvas and status panel.";

export function containedGamePlanProposalV2(): any {
  const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
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

export function buildContainedGameProductSpecV2(): ProductSpecV2 {
  const result = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  if (result.status !== "canonicalized") {
    throw new Error(`Contained game ProductSpecV2 fixture rejected: ${JSON.stringify(result)}`);
  }
  return ProductSpecV2Schema.parse(result.productSpec);
}
