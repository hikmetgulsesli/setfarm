import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { produceStoryPartitionV1 } from "../../src/product-compiler/producers/story-partition.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("typed ProductSpec story partition", () => {
  it("produces one closed deterministic story for a single semantic component", () => {
    const { productSpec } = buildMinimalValidContracts();
    const result = produceStoryPartitionV1({ productSpec });
    assert.equal(result.status, "produced");
    if (result.status !== "produced") return;
    assert.deepEqual(result.stories, [{
      id: "US-001",
      order: 1,
      title: "Implement Task editor",
      description: "Implement the exact action contract for Save task.",
      dependsOn: [],
      surfaceRefs: ["SURF_EDITOR"],
      actionRefs: ["ACT_SAVE_TASK"],
      stateRefs: ["STATE_EDITOR"],
      persistenceRefs: ["PERSIST_TASK_LOCAL"],
      evidenceRefs: ["EVID_SAVE_RELOAD"],
    }]);
  });

  it("joins surfaces when their actions share state instead of inventing cross-story prose", () => {
    const { productSpec } = buildMinimalValidContracts();
    const value: any = clone(productSpec);
    value.routes.push({ id: "ROUTE_SECOND", path: "/second", surfaceRefs: ["SURF_SECOND"], entry: false });
    value.surfaces.push({ id: "SURF_SECOND", name: "Second", kind: "page", routeRef: "ROUTE_SECOND", required: true });
    value.evidencePredicates.push({
      id: "EVID_SECOND",
      kind: "state_transition",
      required: true,
      subjectRef: "ACT_SECOND",
      capabilityRefs: ["CAP_BROWSER_INTERACTION"],
      assertion: { operator: "exists" },
    });
    value.actions.push({
      ...clone(value.actions[0]),
      id: "ACT_SECOND",
      name: "Second action",
      surfaceRefs: ["SURF_SECOND"],
      navigation: { kind: "stay" },
      persistenceEffects: [],
      success: { stateRefs: ["STATE_EDITOR"], persistenceRefs: [], evidenceRefs: ["EVID_SECOND"] },
      failure: { stateRefs: ["STATE_EDITOR"], persistenceRefs: [], evidenceRefs: [], userVisible: true },
      evidenceRefs: ["EVID_SECOND"],
    });
    const result = produceStoryPartitionV1({ productSpec: value });
    assert.equal(result.status, "produced");
    if (result.status !== "produced") return;
    assert.equal(result.stories.length, 1);
    assert.deepEqual(result.stories[0]?.surfaceRefs, ["SURF_EDITOR", "SURF_SECOND"]);
    assert.deepEqual(result.stories[0]?.actionRefs, ["ACT_SAVE_TASK", "ACT_SECOND"]);
  });

  it("keeps disconnected closed components separate with a bounded dependency root", () => {
    const { productSpec } = buildMinimalValidContracts();
    const value: any = clone(productSpec);
    value.states.push({ id: "STATE_SECOND", name: "Second", kind: "ui", initialValue: false, invariants: [] });
    value.routes.push({ id: "ROUTE_SECOND", path: "/second", surfaceRefs: ["SURF_SECOND"], entry: false });
    value.surfaces.push({ id: "SURF_SECOND", name: "Second", kind: "page", routeRef: "ROUTE_SECOND", required: true });
    value.evidencePredicates.push({
      id: "EVID_SECOND",
      kind: "state_transition",
      required: true,
      subjectRef: "ACT_SECOND",
      capabilityRefs: ["CAP_BROWSER_INTERACTION"],
      assertion: { operator: "exists" },
    });
    value.actions.push({
      ...clone(value.actions[0]),
      id: "ACT_SECOND",
      name: "Second action",
      surfaceRefs: ["SURF_SECOND"],
      input: { fields: [] },
      preconditions: [],
      evidenceScenario: { targetInputValues: {}, prerequisiteSteps: [] },
      stateDeltas: [{ stateRef: "STATE_SECOND", operation: "set", path: "", valueFrom: { kind: "literal", value: true } }],
      navigation: { kind: "stay" },
      persistenceEffects: [],
      success: { stateRefs: ["STATE_SECOND"], persistenceRefs: [], evidenceRefs: ["EVID_SECOND"] },
      failure: { stateRefs: ["STATE_SECOND"], persistenceRefs: [], evidenceRefs: [], userVisible: true },
      evidenceRefs: ["EVID_SECOND"],
    });
    const result = produceStoryPartitionV1({ productSpec: value });
    assert.equal(result.status, "produced");
    if (result.status !== "produced") return;
    assert.equal(result.stories.length, 2);
    assert.deepEqual(result.stories[1]?.dependsOn, ["US-001"]);
    assert.deepEqual(result.stories[1]?.stateRefs, ["STATE_SECOND"]);
  });

  it("fails closed when a canonical state has no action-derived owner", () => {
    const { productSpec } = buildMinimalValidContracts();
    const value: any = clone(productSpec);
    value.states.push({ id: "STATE_ORPHAN", name: "Orphan", kind: "ui", initialValue: null, invariants: [] });
    const result = produceStoryPartitionV1({ productSpec: value });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PARTITION_STATE_UNOWNED"), true);
  });

  it("fails closed when a required surface component has no executable action", () => {
    const { productSpec } = buildMinimalValidContracts();
    const value: any = clone(productSpec);
    value.routes.push({ id: "ROUTE_EMPTY", path: "/empty", surfaceRefs: ["SURF_EMPTY"], entry: false });
    value.surfaces.push({ id: "SURF_EMPTY", name: "Empty", kind: "page", routeRef: "ROUTE_EMPTY", required: true });
    const result = produceStoryPartitionV1({ productSpec: value });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PARTITION_COMPONENT_ACTION_MISSING"), true);
  });
});
