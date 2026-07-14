import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileRuntimeStoryPlanV1 } from "../../src/product-compiler/runtime-story-plan-compiler.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

describe("runtime StoryPlan compiler", () => {
  it("compiles only from canonical semantic artifacts and exact topology", () => {
    const { productSpec, designGraph, buildTopology, storyPlan } = buildMinimalValidContracts();
    const result = compileRuntimeStoryPlanV1({ productSpec, designGraph, buildTopology });
    assert.equal(result.status, "compiled");
    if (result.status !== "compiled") return;
    assert.deepEqual(result.storyPlan.stories[0]?.actionRefs, storyPlan.stories[0]?.actionRefs);
    assert.deepEqual(result.storyPlan.stories[0]?.controlRefs, storyPlan.stories[0]?.controlRefs);
    assert.deepEqual(result.storyPlan.stories[0]?.ownedPathRefs, storyPlan.stories[0]?.ownedPathRefs);
    assert.deepEqual(result.storyPlan.stories[0]?.evidenceRefs, storyPlan.stories[0]?.evidenceRefs);
  });

  it("rejects topology owner drift instead of consulting DB story prose", () => {
    const { productSpec, designGraph, buildTopology } = buildMinimalValidContracts();
    const topology: any = structuredClone(buildTopology);
    topology.owners[0].storyRef = "US-999";
    const result = compileRuntimeStoryPlanV1({ productSpec, designGraph, buildTopology: topology });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_TOPOLOGY_OWNER_MISSING"), true);
    assert.equal(result.rejectionCodes.includes("STORY_PLAN_TOPOLOGY_OWNER_ORPHANED"), true);
  });
});
