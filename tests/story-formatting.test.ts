import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatStoryForTemplate, parseAcceptanceCriteria } from "../src/installer/story-ops.js";
import type { Story } from "../src/installer/types.js";

function story(overrides: Partial<Story>): Story {
  return {
    id: "story-row",
    runId: "run",
    storyIndex: 0,
    storyId: "US-001",
    title: "Demo story",
    description: "Build the demo.",
    acceptanceCriteria: ["It works"],
    status: "pending",
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

describe("story prompt formatting", () => {
  it("drops undefined/null acceptance criteria values", () => {
    assert.deepEqual(parseAcceptanceCriteria("[\"undefined\", null, \"\", \"Fix the button\"]"), ["Fix the button"]);
    assert.deepEqual(parseAcceptanceCriteria("undefined"), []);
  });

  it("uses QA failure output and fallback criteria when QA-FIX fields are empty", () => {
    const formatted = formatStoryForTemplate(story({
      storyId: "QA-FIX-003",
      title: "QA fix",
      description: "undefined",
      acceptanceCriteria: ["undefined", ""],
      output: "STATUS: retry\n- CRITICAL: Settings button is a no-op",
    }));

    assert.match(formatted, /Failure report:\nSTATUS: retry/);
    assert.match(formatted, /Fix every failure listed in the QA\/final failure report/);
    assert.doesNotMatch(formatted, /\bundefined\b/);
  });
});
