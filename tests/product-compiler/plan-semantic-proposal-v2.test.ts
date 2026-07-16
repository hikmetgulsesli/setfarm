import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";

describe("plan semantic proposal v2 compiler", () => {
  it("preserves exact placement, containment, effect scope, and traceability", () => {
    const proposal = containedGamePlanProposalV2();
    const first = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal,
    });
    assert.equal(first.status, "canonicalized");
    if (first.status !== "canonicalized") return;

    assert.equal(first.productSpec.schema, "setfarm.product-spec.v2");
    assert.equal(first.productSpec.routes[0]?.rootSurfaceRef, "SURF_PLAY_PAGE");
    assert.deepEqual(first.productSpec.surfaces.map((surface) => ({
      id: surface.id,
      composition: surface.composition,
    })), [
      { id: "SURF_PLAY_PAGE", composition: { kind: "route_root" } },
      {
        id: "SURF_GAME_CANVAS",
        composition: { kind: "contained", hostSurfaceRef: "SURF_PLAY_PAGE" },
      },
      {
        id: "SURF_STATUS_PANEL",
        composition: { kind: "contained", hostSurfaceRef: "SURF_PLAY_PAGE" },
      },
    ]);
    const action = first.productSpec.actions[0]!;
    assert.deepEqual(action.controlPlacements, [{
      id: "CSLOT_START_GAME_PRIMARY_START",
      surfaceRef: "SURF_PLAY_PAGE",
      controlHint: "primary_button",
    }]);
    assert.deepEqual(action.affectedSurfaceRefs, ["SURF_GAME_CANVAS", "SURF_STATUS_PANEL"]);
    assert.equal(action.evidenceScenario.controlSlotRef, "CSLOT_START_GAME_PRIMARY_START");
    assert.deepEqual(action.observableEffects.map((effect) => effect.selector), [
      { kind: "control", controlSlotRef: "CSLOT_START_GAME_PRIMARY_START" },
      { kind: "surface", surfaceRef: "SURF_GAME_CANVAS" },
      {
        kind: "accessibility",
        surfaceRef: "SURF_STATUS_PANEL",
        role: "status",
        name: "Game status",
      },
    ]);
    assert.equal(first.productSpec.traceability.bindings.some((binding) =>
      binding.semanticKind === "control_placement"
      && binding.semanticRef === "CSLOT_START_GAME_PRIMARY_START"), true);

    const replay = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: structuredClone(proposal),
    });
    assert.equal(replay.status, "canonicalized");
    if (replay.status === "canonicalized") {
      assert.equal(hashCanonicalJson(replay.productSpec), hashCanonicalJson(first.productSpec));
      assert.equal(replay.semanticProposalHash, first.semanticProposalHash);
      assert.equal(replay.canonicalBytes, first.canonicalBytes);
    }
  });

  it("rejects an unqualified or wrong-owner control selector before stable base compilation", () => {
    const proposal = containedGamePlanProposalV2();
    proposal.actions[0].observables[0].selector = {
      kind: "control",
      controlPlacementKey: "unknown_slot",
    };
    const result = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal,
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(result.diagnostics.some((item) =>
        item.message.includes("PLAN_SEMANTIC_OBSERVABLE_CONTROL_PLACEMENT_UNRESOLVED")), true);
    }
  });

  it("never upgrades a lossy v1 surfaceRefs proposal into v2 authority", () => {
    const proposal = containedGamePlanProposalV2();
    proposal.schema = "setfarm.plan-semantic-proposal.v1";
    proposal.actions[0].surfaceKeys = ["play_page", "game_canvas", "status_panel"];
    delete proposal.actions[0].controlPlacements;
    delete proposal.actions[0].affectedSurfaceKeys;
    const result = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal,
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(result.diagnostics[0]?.code, "PLAN_SEMANTIC_PROPOSAL_V2_SCHEMA_INVALID");
    }
  });
});
