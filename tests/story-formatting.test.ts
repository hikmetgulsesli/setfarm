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

  it("recovers JSON criteria with appended design contract text", () => {
    const raw = [
      "[\"First criterion\",\"Second criterion\"]",
      "",
      "--- Design Contract Requirements ---",
      "- [DESIGN] Navigation link \"Home\" -> #home MUST route to a real page/component",
      "- [DESIGN] Button \"Save\" MUST have a functional onClick handler",
    ].join("\n");

    assert.deepEqual(parseAcceptanceCriteria(raw), [
      "First criterion",
      "Second criterion",
      "[DESIGN] Navigation link \"Home\" -> #home MUST route to a real page/component",
      "[DESIGN] Button \"Save\" MUST have a functional onClick handler",
    ]);
  });

  it("flattens legacy nested JSON criteria strings", () => {
    const nested = [
      JSON.stringify(["App shell renders first", "Keyboard controls change state"]) +
        "\n\n--- Design Contract Requirements ---\n- [DESIGN] Navigation link \"Game\" -> #game MUST route",
      "Must implement screen fallback-game-board (Game Board) - read stitch/fallback-game-board.html",
    ];

    assert.deepEqual(parseAcceptanceCriteria(JSON.stringify(nested)), [
      "App shell renders first",
      "Keyboard controls change state",
      "[DESIGN] Navigation link \"Game\" -> #game MUST route",
      "Must implement screen fallback-game-board (Game Board) - read stitch/fallback-game-board.html",
    ]);
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
