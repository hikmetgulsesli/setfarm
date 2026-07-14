import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { produceStoryPlanV1 } from "../../src/product-compiler/producers/story-plan.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function singleStoryInput() {
  const values = buildMinimalValidContracts();
  const { ownerRef: _ownerRef, ownedPathRefs: _ownedPathRefs, sharedGrantRefs: _sharedGrantRefs, ...story } =
    values.storyPlan.stories[0]!;
  return {
    productSpec: clone(values.productSpec),
    designGraph: clone(values.designGraph),
    buildTopology: clone(values.buildTopology),
    stories: [clone(story)],
  };
}

function twoStoryInput(): any {
  const input: any = singleStoryInput();
  const product = input.productSpec;
  const graph = input.designGraph;
  const topology = input.buildTopology;

  product.states.push({
    ...clone(product.states[0]),
    id: "STATE_SECOND",
    name: "Second state",
  });
  product.persistencePolicies.push({
    ...clone(product.persistencePolicies[0]),
    id: "PERSIST_SECOND",
    key: "second-v1",
  });
  product.routes.push({
    id: "ROUTE_SECOND",
    path: "/second",
    surfaceRefs: ["SURF_SECOND"],
    entry: false,
  });
  product.surfaces.push({
    id: "SURF_SECOND",
    name: "Second surface",
    kind: "page",
    routeRef: "ROUTE_SECOND",
    required: true,
  });
  product.actions.push({
    ...clone(product.actions[0]),
    id: "ACT_SECOND",
    name: "Save second task",
    surfaceRefs: ["SURF_SECOND"],
    stateDeltas: product.actions[0].stateDeltas.map((delta: any) => ({
      ...delta,
      stateRef: "STATE_SECOND",
      ...(delta.valueFrom.kind === "state"
        ? { valueFrom: { ...delta.valueFrom, stateRef: "STATE_SECOND" } }
        : {}),
    })),
    persistenceEffects: product.actions[0].persistenceEffects.map((effect: any) => ({
      ...effect,
      policyRef: "PERSIST_SECOND",
      statePaths: effect.statePaths.map((statePath: any) => ({
        ...statePath,
        stateRef: "STATE_SECOND",
      })),
    })),
    success: {
      ...clone(product.actions[0].success),
      stateRefs: ["STATE_SECOND"],
      persistenceRefs: ["PERSIST_SECOND"],
      evidenceRefs: ["EVID_SECOND"],
    },
    failure: {
      ...clone(product.actions[0].failure),
      stateRefs: ["STATE_SECOND"],
      persistenceRefs: ["PERSIST_SECOND"],
      evidenceRefs: ["EVID_SECOND"],
    },
    evidenceRefs: ["EVID_SECOND"],
  });
  product.evidencePredicates.push({
    ...clone(product.evidencePredicates[0]),
    id: "EVID_SECOND",
    subjectRef: "ACT_SECOND",
  });

  graph.surfaces.push({
    ...clone(graph.surfaces[0]),
    id: "DSURF_SECOND",
    surfaceRef: "SURF_SECOND",
    sourceLocator: "sources/second.html",
  });
  graph.controls.push({
    ...clone(graph.controls[0]),
    id: "CTRL_SECOND",
    generatedLocalId: "second-1",
    surfaceRef: "SURF_SECOND",
    source: {
      ...clone(graph.controls[0].source),
      locator: "sources/second.html",
      selector: "[data-action-id=\"second-1\"]",
    },
  });
  graph.bindings.push({
    ...clone(graph.bindings[0]),
    controlRef: "CTRL_SECOND",
    actionRef: "ACT_SECOND",
    routeRef: "ROUTE_SECOND",
    inputBindings: graph.bindings[0].inputBindings.map((binding: any) => ({
      ...binding,
      valueFrom: binding.valueFrom.kind === "state"
        ? { ...binding.valueFrom, stateRef: "STATE_SECOND" }
        : binding.valueFrom.kind === "control_value"
          ? { ...binding.valueFrom, controlRef: "CTRL_SECOND" }
          : binding.valueFrom,
    })),
    stateRefs: ["STATE_SECOND"],
    persistenceRefs: ["PERSIST_SECOND"],
    evidenceRefs: ["EVID_SECOND"],
  });

  topology.owners.push({ id: "OWNER_US_002", kind: "story", storyRef: "US-002" });
  topology.pathBindings.push({
    id: "PATH_SECOND",
    path: "src/Second.tsx",
    role: "source",
    ownerRef: "OWNER_US_002",
    presence: "present",
    knownContentHash: "f".repeat(64),
  });
  topology.sharedGrants.push({
    id: "GRANT_APP_TO_SECOND",
    fromOwnerRef: "OWNER_US_001",
    toOwnerRef: "OWNER_US_002",
    pathRefs: ["PATH_APP"],
    permissions: ["read"],
  });
  topology.entrypoints[0].routeRefs.push("ROUTE_SECOND");

  input.stories.push({
    id: "US-002",
    order: 2,
    title: "Implement second surface",
    description: "Implement the exact second action and its evidence.",
    dependsOn: ["US-001"],
    surfaceRefs: ["SURF_SECOND"],
    controlRefs: ["CTRL_SECOND"],
    actionRefs: ["ACT_SECOND"],
    stateRefs: ["STATE_SECOND"],
    persistenceRefs: ["PERSIST_SECOND"],
    evidenceRefs: ["EVID_SECOND"],
  });
  return input;
}

describe("typed story-plan producer", () => {
  it("produces an exact semantic partition and derives topology ownership and grants", () => {
    const input = twoStoryInput();
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "produced");
    if (result.status !== "produced") return;

    assert.deepEqual(result.storyPlan.stories.map((story) => story.id), ["US-001", "US-002"]);
    assert.equal(result.storyPlan.stories[0]?.ownerRef, "OWNER_US_001");
    assert.deepEqual(result.storyPlan.stories[0]?.ownedPathRefs, ["PATH_APP"]);
    assert.equal(result.storyPlan.stories[1]?.ownerRef, "OWNER_US_002");
    assert.deepEqual(result.storyPlan.stories[1]?.ownedPathRefs, ["PATH_SECOND"]);
    assert.deepEqual(result.storyPlan.stories[1]?.sharedGrantRefs, ["GRANT_APP_TO_SECOND"]);
    assert.deepEqual(result.storyPlan.stories[1]?.actionRefs, ["ACT_SECOND"]);
  });

  it("rejects renamed action references rather than guessing the ProductSpec action", () => {
    const input = singleStoryInput();
    input.stories[0]!.actionRefs = ["ACT_RENAMED"];
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_ACTION_UNOWNED"), true);
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_ACTION_REF_UNRESOLVED"), true);
  });

  it("rejects any semantic node assigned to more than one story", () => {
    const input = twoStoryInput();
    input.stories[0].actionRefs.push("ACT_SECOND");
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_ACTION_MULTIPLE_OWNERS"), true);
  });

  it("rejects a complete partition whose action closure is assigned to another story", () => {
    const input = twoStoryInput();
    input.stories[1].stateRefs = [];
    input.stories[0].stateRefs.push("STATE_SECOND");
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_ACTION_STATE_OWNER_MISMATCH"), true);
  });

  it("keeps evidence subject and topology capability refs exact", () => {
    const input = twoStoryInput();
    input.productSpec.evidencePredicates.find((item: any) => item.id === "EVID_SECOND").subjectRef =
      "ACT_SAVE_TASK";
    input.buildTopology.capabilities.find((item: any) => item.id === "CAP_LOCAL_PERSISTENCE").enabled =
      false;
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_EVIDENCE_SUBJECT_OWNER_MISMATCH"), true);
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_EVIDENCE_CAPABILITY_UNAVAILABLE"), true);
  });

  it("rejects unresolved controls instead of turning design hints into story semantics", () => {
    const input = singleStoryInput();
    input.designGraph.bindings = [];
    input.designGraph.unresolvedBindings = [{
      controlRef: "CTRL_SAVE_TASK",
      code: "LINK_UNRESOLVED_CONTROL",
      provenance: [],
      suggestions: [],
    }];
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_UNRESOLVED_CONTROL"), true);
  });

  it("requires a dependency path for every cross-story shared grant", () => {
    const input = twoStoryInput();
    input.stories[1].dependsOn = [];
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_GRANT_DEPENDENCY_MISSING"), true);
  });

  it("fails closed when the exact story dependency graph is cyclic", () => {
    const input = twoStoryInput();
    input.stories[0].dependsOn = ["US-002"];
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_CONTRACT_INVALID"), true);
  });

  it("fails closed when a topology story owner is missing", () => {
    const input = singleStoryInput();
    input.buildTopology.owners = [] as typeof input.buildTopology.owners;
    const result = produceStoryPlanV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["STORY_PLAN_INPUT_INVALID"]);
  });
});
