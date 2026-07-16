import assert from "node:assert/strict";
import test from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  StoryPlanV2Schema,
  type StoryPlanV2,
} from "../../src/product-compiler/schemas/story-plan-v2.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function validPlan(): StoryPlanV2 {
  const semantic = {
    routeRefs: ["ROUTE_STATUS"],
    surfaceRefs: ["SURF_STATUS"],
    controlSlotRefs: ["CSLOT_REFRESH_PRIMARY"],
    controlRefs: ["CTRL_0123456789abcdef"],
    actionRefs: ["ACT_REFRESH"],
    observableRefs: ["OBS_REFRESH_RESULT"],
    stateRefs: ["STATE_STATUS"],
    persistenceRefs: ["PERSIST_STATUS"],
    evidenceRefs: ["EVID_REFRESH_RESULT"],
  };
  const stories = [{
    id: "US-001",
    order: 1,
    componentHash: hashCanonicalJson(semantic),
    title: "Implement status behavior",
    description: "Own the exact status surface, control, action, persistence, and evidence closure.",
    ownerRef: "OWNER_STORY_001",
    dependsOn: [],
    ...semantic,
    ownedPathRefs: ["PATH_STATUS_SCREEN"],
    sharedGrantRefs: [],
  }];
  return StoryPlanV2Schema.parse({
    schema: "setfarm.story-plan.v2",
    productSpecHash: HASH_A,
    designSourceKind: "stitch",
    designGraphHash: HASH_B,
    buildTopologyHash: HASH_C,
    partitionHash: hashCanonicalJson(stories),
    stories,
    cardinality: {
      stories: 1,
      routes: 1,
      surfaces: 1,
      controlSlots: 1,
      physicalControls: 1,
      actions: 1,
      observables: 1,
      states: 1,
      persistencePolicies: 1,
      requiredEvidence: 1,
      ownedPaths: 1,
      sharedGrants: 0,
    },
  });
}

test("StoryPlanV2 accepts one exact slot-to-physical-control ownership component", () => {
  const plan = validPlan();
  assert.deepEqual(StoryPlanV2Schema.parse(plan), plan);
});

test("StoryPlanV2 rejects a Stitch plan without its exact graph hash", () => {
  const plan = validPlan();
  assert.equal(StoryPlanV2Schema.safeParse({ ...plan, designGraphHash: null }).success, false);
});

test("StoryPlanV2 rejects non-canonical reference order", () => {
  const plan = validPlan();
  const story = {
    ...plan.stories[0]!,
    evidenceRefs: ["EVID_ZETA", "EVID_ALPHA"],
  };
  assert.equal(StoryPlanV2Schema.safeParse({ ...plan, stories: [story] }).success, false);
});

test("StoryPlanV2 rejects a physical slot or semantic ref owned by two stories", () => {
  const plan = validPlan();
  const second = {
    ...plan.stories[0]!,
    id: "US-002",
    order: 2,
    ownerRef: "OWNER_STORY_002",
    routeRefs: ["ROUTE_SECOND"],
    surfaceRefs: ["SURF_SECOND"],
    controlRefs: ["CTRL_1111111111111111"],
    actionRefs: ["ACT_SECOND"],
    observableRefs: ["OBS_SECOND"],
    stateRefs: ["STATE_SECOND"],
    persistenceRefs: ["PERSIST_SECOND"],
    evidenceRefs: ["EVID_SECOND"],
    ownedPathRefs: ["PATH_SECOND"],
  };
  assert.equal(StoryPlanV2Schema.safeParse({ ...plan, stories: [...plan.stories, second] }).success, false);
});

test("StoryPlanV2 requires dependencies to resolve to an earlier contiguous story", () => {
  const plan = validPlan();
  const first = { ...plan.stories[0]!, dependsOn: ["US-002"] };
  assert.equal(StoryPlanV2Schema.safeParse({ ...plan, stories: [first] }).success, false);
});
