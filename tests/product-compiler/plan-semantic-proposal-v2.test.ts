import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { derivePersistenceRoundTripEvidenceIdV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
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

  it("emits one compiler-owned exact action/policy round-trip witness", () => {
    const proposal: any = containedGamePlanProposalV2();
    const requirementRefs = proposal.actions[0].requirementRefs;
    proposal.persistencePolicies.push({
      key: "game_phase_local",
      kind: "local_storage",
      entityKeys: [],
      rehydration: { kind: "initialization" },
      requirementRefs,
    });
    proposal.actions[0].persistenceIntents.push({
      policyKey: "game_phase_local",
      operation: "write",
      stateDeltaKeys: ["start_phase"],
    });
    proposal.actions[0].observables[0].assertions.push({
      phase: "reload",
      property: "visibility",
      operator: "equals",
      expected: true,
    });

    const result = compilePlanSemanticProposalV2({ task: CONTAINED_GAME_TASK, proposal });
    assert.equal(result.status, "canonicalized", result.status === "rejected"
      ? JSON.stringify(result.diagnostics)
      : undefined);
    if (result.status !== "canonicalized") return;
    const actionRef = "ACT_START_GAME";
    const policyRef = "PERSIST_GAME_PHASE_LOCAL";
    const evidenceRef = derivePersistenceRoundTripEvidenceIdV2(actionRef, policyRef);
    const predicate = result.productSpec.evidencePredicates.find((item) => item.id === evidenceRef);
    assert.deepEqual(predicate, {
      id: evidenceRef,
      kind: "persistence_round_trip",
      required: true,
      subjectRef: policyRef,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    });
    const action = result.productSpec.actions.find((item) => item.id === actionRef)!;
    assert.ok(action.persistenceEffects.some((effect) => effect.policyRef === policyRef));
    assert.ok(action.evidenceRefs.includes(evidenceRef));
    assert.ok(action.success.evidenceRefs.includes(evidenceRef));
    assert.ok(action.success.persistenceRefs?.includes(policyRef));
    assert.equal(action.failure.evidenceRefs.includes(evidenceRef), false);
    assert.equal(action.failure.persistenceRefs?.includes(policyRef), false);
    assert.equal(result.productSpec.traceability.bindings.some((binding) =>
      binding.semanticKind === "evidence" && binding.semanticRef === evidenceRef), true);
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

  it("snapshots hostile public input before Zod without invoking caller code", () => {
    let proxyTrapCount = 0;
    const proxied = new Proxy(containedGamePlanProposalV2(), {
      get() {
        proxyTrapCount += 1;
        throw new Error("proxy trap must not run");
      },
    });
    const proxyResult = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: proxied,
    });
    assert.equal(proxyResult.status, "rejected");
    assert.equal(proxyTrapCount, 0);
    if (proxyResult.status === "rejected") {
      assert.equal(proxyResult.diagnostics[0]?.code, "PLAN_SEMANTIC_PROPOSAL_V2_INPUT_INVALID");
    }

    let getterCount = 0;
    const accessor = containedGamePlanProposalV2();
    Object.defineProperty(accessor.product, "name", {
      enumerable: true,
      configurable: true,
      get() {
        getterCount += 1;
        return "forged";
      },
    });
    const accessorResult = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: accessor,
    });
    assert.equal(accessorResult.status, "rejected");
    assert.equal(getterCount, 0);

    const cyclic: any = containedGamePlanProposalV2();
    cyclic.loop = cyclic;
    assert.equal(compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: cyclic,
    }).status, "rejected");

    const sparse = containedGamePlanProposalV2();
    sparse.actions.length = 2;
    assert.equal(compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: sparse,
    }).status, "rejected");

    let deep: any = "leaf";
    for (let index = 0; index < 140; index += 1) deep = { value: deep };
    const deepProposal = containedGamePlanProposalV2();
    deepProposal.actions[0].observables[0].assertions[0].expected = deep;
    assert.equal(compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: deepProposal,
    }).status, "rejected");

    const oversized = containedGamePlanProposalV2();
    oversized.actions[0].observables[0].assertions[0].expected = "x".repeat(4 * 1024 * 1024);
    const oversizedResult = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: oversized,
    });
    assert.equal(oversizedResult.status, "rejected");
    if (oversizedResult.status === "rejected") {
      assert.equal(oversizedResult.diagnostics[0]?.code, "PLAN_SEMANTIC_PROPOSAL_V2_INPUT_INVALID");
    }

    const longTaskResult = compilePlanSemanticProposalV2({
      task: "x".repeat(50_001),
      proposal: containedGamePlanProposalV2(),
    });
    assert.equal(longTaskResult.status, "rejected");
    if (longTaskResult.status === "rejected") {
      assert.equal(longTaskResult.diagnostics[0]?.code, "PLAN_SEMANTIC_TASK_V2_INPUT_INVALID");
    }
  });

  it("returns one recursively frozen, bounded compiler output or a typed size rejection", () => {
    const result = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: containedGamePlanProposalV2(),
    });
    assert.equal(result.status, "canonicalized");
    if (result.status !== "canonicalized") return;
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.productSpec), true);
    assert.equal(Object.isFrozen(result.productSpec.actions), true);
    assert.equal(Object.isFrozen(result.productSpec.actions[0]), true);
    const canonicalBefore = result.canonicalBytes;
    assert.throws(() => {
      (result.productSpec.actions[0] as { name: string }).name = "mutated";
    }, TypeError);
    assert.equal(result.canonicalBytes, canonicalBefore);

    const oversizedOutput = containedGamePlanProposalV2();
    oversizedOutput.actions[0].observables[2].assertions[0].expected = "x".repeat(
      (3 * 1024 * 1024) + 64 * 1024,
    );
    const rejected = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: oversizedOutput,
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status === "rejected") {
      assert.equal(rejected.diagnostics[0]?.code, "PLAN_SEMANTIC_PROPOSAL_SCHEMA_INVALID");
      assert.match(rejected.diagnostics[0]?.message ?? "", /ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED/);
    }
  });
});
