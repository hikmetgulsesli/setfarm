import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { produceStoryDefinitionsV1 } from "../../src/product-compiler/producers/story-definitions.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

describe("typed story definitions", () => {
  it("assigns every exact converter control through its ProductSpec surface", () => {
    const { productSpec, designGraph } = buildMinimalValidContracts();
    const result = produceStoryDefinitionsV1({ productSpec, designGraph });
    assert.equal(result.status, "produced");
    if (result.status !== "produced") return;
    assert.deepEqual(result.stories[0]?.controlRefs, ["CTRL_SAVE_TASK"]);
    assert.deepEqual(result.stories[0]?.actionRefs, ["ACT_SAVE_TASK"]);
  });

  it("rejects a control whose surface cannot be dispositioned", () => {
    const { productSpec, designGraph } = buildMinimalValidContracts();
    const value: any = structuredClone(designGraph);
    value.controls[0].surfaceRef = "SURF_UNKNOWN";
    const result = produceStoryDefinitionsV1({ productSpec, designGraph: value });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.rejectionCodes.includes("STORY_DEFINITIONS_INPUT_INVALID"), true);
  });
});
