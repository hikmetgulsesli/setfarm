import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createSingleEffectCompletionPlanDescriptorV1,
} from "../../src/execution/schemas/runtime-completion-plan-v1.js";

describe("runtime completion plan", () => {
  it("requires an immutable source revision for the durable QA-FIX merge effect", () => {
    assert.throws(
      () => createSingleEffectCompletionPlanDescriptorV1({
        kind: "story_completion",
        continuation: { type: "story_qa_fix_merge" },
        subject: { storyDbId: "story-db-1", storyId: "QA-FIX-001" },
      }),
      /immutable source SHA/,
    );

    const descriptor = createSingleEffectCompletionPlanDescriptorV1({
      kind: "story_completion",
      continuation: { type: "story_qa_fix_merge" },
      subject: {
        storyDbId: "story-db-1",
        storyId: "QA-FIX-001",
        sourceSha: "a".repeat(40),
      },
    });
    assert.equal(descriptor.continuation.type, "story_qa_fix_merge");
    assert.equal(descriptor.subject?.sourceSha, "a".repeat(40));
    assert.equal(descriptor.effects[0]?.effectType, "story.qa.fix.merge");
  });
});
