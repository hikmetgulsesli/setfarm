import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateProducedPredicateSemanticsV1 } from "../../src/evidence/canonical-evidence-runner.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import type { ProductSpecV1 } from "../../src/product-compiler/schemas/product-spec-v1.js";

function produced(task: string): ProductSpecV1 {
  const result = produceProductSpecV1({ task });
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  return result.productSpec;
}

function predicate(spec: ProductSpecV1, actionRef: string, kind: "state_transition" | "persistence_round_trip") {
  const value = spec.evidencePredicates.find((candidate) =>
    candidate.subjectRef === actionRef && candidate.kind === kind);
  assert.ok(value, `${actionRef} has no ${kind} predicate`);
  return value;
}

function action(spec: ProductSpecV1, actionRef: string) {
  const value = spec.actions.find((candidate) => candidate.id === actionRef);
  assert.ok(value, `Missing ${actionRef}`);
  return value;
}

describe("produced passes predicate semantics", () => {
  it("proves utility state and reload persistence from the exact declared delta", () => {
    const spec = produced(
      "Build a compact single-page status utility with a refresh button and a ready/paused toggle. Keep status in localStorage.",
    );
    const target = action(spec, "ACT_SET_PAUSED");
    const before = { STATE_UTILITY_STATUS: structuredClone(spec.states[0]!.initialValue) };
    const after = { STATE_UTILITY_STATUS: { ...before.STATE_UTILITY_STATUS, paused: true } };
    const common = {
      action: target,
      persistencePolicies: spec.persistencePolicies,
      inputValues: { paused: true },
      stateBefore: before,
      stateAfterAction: after,
      actionPassed: true,
      runtimeAdapter: "browser-service" as const,
    };
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      predicate: predicate(spec, target.id, "state_transition"),
    }), "pass");
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      predicate: predicate(spec, target.id, "persistence_round_trip"),
      stateAfterReload: after,
      reloadPassed: true,
    }), "pass");
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      predicate: predicate(spec, target.id, "state_transition"),
      stateAfterAction: {
        STATE_UTILITY_STATUS: { ...before.STATE_UTILITY_STATUS, refreshRequested: true },
      },
    }), "fail", "an unrelated state change cannot satisfy the paused delta");
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      predicate: predicate(spec, target.id, "persistence_round_trip"),
      stateAfterReload: before,
      reloadPassed: true,
    }), "fail", "the exact written value must survive reload");
  });

  it("proves operations upsert semantics and rejects a wrong field", () => {
    const spec = produced(
      "Build a local inventory operations app that must list, create, edit, save, and delete items. Persist item records in localStorage.",
    );
    const target = action(spec, "ACT_SAVE_ITEM");
    const values = target.evidenceScenario.targetInputValues;
    const beforeState = {
      records: [],
      selectedId: null,
      draft: { id: null, title: "", status: "active" },
      loading: false,
      lastError: null,
    };
    const record = { id: values.id, title: values.title, status: values.status };
    const afterState = {
      ...beforeState,
      records: [record],
      draft: record,
    };
    const common = {
      action: target,
      persistencePolicies: spec.persistencePolicies,
      inputValues: values,
      stateBefore: { STATE_ITEM_OPERATIONS: beforeState },
      stateAfterAction: { STATE_ITEM_OPERATIONS: afterState },
      actionPassed: true,
      runtimeAdapter: "browser-service" as const,
    };
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      predicate: predicate(spec, target.id, "state_transition"),
    }), "pass");
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      predicate: predicate(spec, target.id, "persistence_round_trip"),
      stateAfterReload: {
        STATE_ITEM_OPERATIONS: {
          ...beforeState,
          records: [record],
          draft: null,
          loaded: true,
        },
      },
      reloadPassed: true,
    }), "pass");
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      predicate: predicate(spec, target.id, "state_transition"),
      stateAfterAction: {
        STATE_ITEM_OPERATIONS: {
          ...afterState,
          draft: { ...record, title: "wrong" },
        },
      },
    }), "fail");
  });

  it("proves game session semantics without inventing a reload and durable high score with one", () => {
    const spec = produced(
      "Build a browser game. The player can start, move left and right, pause and resume, and restart. Track score and store high score in localStorage.",
    );
    const initial = spec.states[0]!.initialValue as Record<string, unknown>;
    const start = action(spec, "ACT_START_GAME");
    assert.equal(evaluateProducedPredicateSemanticsV1({
      predicate: predicate(spec, start.id, "persistence_round_trip"),
      action: start,
      persistencePolicies: spec.persistencePolicies,
      inputValues: {},
      stateBefore: { STATE_GAME_SESSION: initial },
      stateAfterAction: { STATE_GAME_SESSION: { ...initial, status: "playing" } },
      actionPassed: true,
      runtimeAdapter: "browser-service",
    }), "pass", "session memory evidence is same-session and needs no reload trace");

    const highScore = action(spec, "ACT_RECORD_HIGH_SCORE");
    const score = highScore.evidenceScenario.targetInputValues.score;
    const after = { STATE_GAME_SESSION: { ...initial, highScore: score } };
    const common = {
      predicate: predicate(spec, highScore.id, "persistence_round_trip"),
      action: highScore,
      persistencePolicies: spec.persistencePolicies,
      inputValues: { score },
      stateBefore: { STATE_GAME_SESSION: initial },
      stateAfterAction: after,
      actionPassed: true,
      runtimeAdapter: "browser-service" as const,
      reloadPassed: true,
    };
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      stateAfterReload: after,
    }), "pass");
    assert.equal(evaluateProducedPredicateSemanticsV1({
      ...common,
      stateAfterReload: { STATE_GAME_SESSION: initial },
    }), "fail");
  });
});
