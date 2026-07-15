import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  projectCompilerOwnedPersistencePayloadsV1,
} from "../../src/product-compiler/producers/compiler-owned-persistence-projection.js";

function action(valueFrom: unknown, payloadFields: string[] = ["planner_owned"]): Record<string, unknown> {
  return {
    input: {
      fields: [
        { name: "title", valueType: "string", required: true },
        { name: "status", valueType: "string", required: true },
      ],
    },
    stateDeltas: [{
      stateRef: "STATE_RECORD",
      path: "/record",
      operation: "set",
      valueFrom,
    }],
    persistenceEffects: [{
      policyRef: "PERSIST_RECORD",
      operation: "write",
      payloadFields,
      statePaths: [{ stateRef: "STATE_RECORD", path: "/record" }],
    }],
  };
}

describe("compiler-owned persistence payload projection", () => {
  it("removes planner payload fields from literal, state, and entity-field deltas", () => {
    for (const valueFrom of [
      { kind: "literal", value: "refreshed" },
      { kind: "state", stateRef: "STATE_OTHER", path: "/value" },
      { kind: "entity_field", entityRef: "ENTITY_RECORD", fieldRef: "FIELD_TITLE" },
    ]) {
      const input = { actions: [action(valueFrom)] };
      const projected = projectCompilerOwnedPersistencePayloadsV1(input);
      assert.deepEqual((projected.proposal as any).actions[0].persistenceEffects[0].payloadFields, []);
      assert.deepEqual(projected.evidence.derivedEffects[0]?.payloadFields, []);
      assert.deepEqual((input as any).actions[0].persistenceEffects[0].payloadFields, ["planner_owned"]);
    }
  });

  it("derives a stable unique payload from exact input-backed state deltas", () => {
    const input = {
      actions: [{
        ...action({ kind: "inputs", fields: ["status", "title", "status"] }),
        stateDeltas: [
          {
            stateRef: "STATE_RECORD",
            path: "/record",
            operation: "set",
            valueFrom: { kind: "inputs", fields: ["status", "title", "status"] },
          },
          {
            stateRef: "STATE_RECORD",
            path: "/other",
            operation: "set",
            valueFrom: { kind: "input", field: "ignored" },
          },
        ],
      }],
    };
    const projected = projectCompilerOwnedPersistencePayloadsV1(input);
    assert.deepEqual(
      (projected.proposal as any).actions[0].persistenceEffects[0].payloadFields,
      ["status", "title"],
    );
  });

  it("uses an empty compiler payload for a read effect", () => {
    const value: any = action({ kind: "input", field: "title" });
    value.persistenceEffects[0].operation = "read";
    value.persistenceEffects[0].payloadFields = ["title"];
    const projected = projectCompilerOwnedPersistencePayloadsV1({ actions: [value] });
    assert.deepEqual((projected.proposal as any).actions[0].persistenceEffects[0].payloadFields, []);
  });

  it("leaves an unmatched write untouched for the strict validator to reject", () => {
    const value: any = action({ kind: "input", field: "title" });
    value.persistenceEffects[0].statePaths[0].path = "/missing";
    const projected = projectCompilerOwnedPersistencePayloadsV1({ actions: [value] });
    assert.deepEqual(
      (projected.proposal as any).actions[0].persistenceEffects[0].payloadFields,
      ["planner_owned"],
    );
    assert.deepEqual(projected.evidence.derivedEffects, []);
  });

  it("does not throw or invent evidence for a malformed read state path", () => {
    const value: any = action({ kind: "input", field: "title" });
    value.persistenceEffects[0].operation = "read";
    value.persistenceEffects[0].statePaths = [{}];
    const projected = projectCompilerOwnedPersistencePayloadsV1({ actions: [value] });
    assert.deepEqual(
      (projected.proposal as any).actions[0].persistenceEffects[0].payloadFields,
      ["planner_owned"],
    );
    assert.deepEqual(projected.evidence.derivedEffects, []);
  });

  it("leaves overlong projection evidence fields to strict schema rejection", () => {
    const value: any = action({ kind: "input", field: "title" });
    const overlongStateRef = `STATE_${"X".repeat(200)}`;
    value.stateDeltas[0].stateRef = overlongStateRef;
    value.persistenceEffects[0].statePaths[0].stateRef = overlongStateRef;
    const projected = projectCompilerOwnedPersistencePayloadsV1({ actions: [value] });
    assert.deepEqual(
      (projected.proposal as any).actions[0].persistenceEffects[0].payloadFields,
      ["planner_owned"],
    );
    assert.deepEqual(projected.evidence.derivedEffects, []);
  });

  it("fails closed without throwing when a non-JSON caller value cannot be cloned", () => {
    const input = { actions: [], helper: () => "not JSON" };
    const projected = projectCompilerOwnedPersistencePayloadsV1(input);
    assert.equal(projected.proposal, input);
    assert.deepEqual(projected.evidence.derivedEffects, []);
  });
});
