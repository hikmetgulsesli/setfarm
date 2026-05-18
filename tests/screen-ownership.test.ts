import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeScreenMapStoryOwners } from "../src/installer/step-guardrails.js";

describe("screen map story ownership normalization", () => {
  it("collapses duplicate screen owners to the story that owns the generated screen file", () => {
    const screenMap = [
      {
        screenId: "play-screen",
        name: "Game Board",
        stories: ["US-001", "US-002"],
      },
      {
        screenId: "help-screen",
        name: "Controls Help",
        stories: ["US-001", "US-003"],
      },
    ];
    const stories = [
      {
        story_id: "US-001",
        title: "Game engine and app shell",
        scope_files: JSON.stringify(["src/App.tsx", "src/hooks/useAppState.ts"]),
        shared_files: "[]",
      },
      {
        story_id: "US-002",
        title: "Main Menu and Game Board screens",
        scope_files: JSON.stringify(["src/screens/GameBoard.tsx"]),
        shared_files: "[]",
      },
      {
        story_id: "US-003",
        title: "Controls Help screen",
        scope_files: JSON.stringify(["src/screens/ControlsHelp.tsx"]),
        shared_files: "[]",
      },
    ];
    const predictedScreens = [
      { screenId: "play-screen", title: "Game Board", filePath: "src/screens/GameBoard.tsx" },
      { screenId: "help-screen", title: "Controls Help", filePath: "src/screens/ControlsHelp.tsx" },
    ];

    const result = normalizeScreenMapStoryOwners(screenMap, stories, predictedScreens);

    assert.equal(result.changed, true);
    assert.deepEqual(result.screenMap.map((screen) => screen.stories), [["US-002"], ["US-003"]]);
    assert.equal(result.changes.length, 2);
  });

  it("keeps single-owner screens unchanged", () => {
    const result = normalizeScreenMapStoryOwners(
      [{ screenId: "menu", name: "Main Menu", stories: ["US-002"] }],
      [{ story_id: "US-002", title: "Main Menu", scope_files: "[]", shared_files: "[]" }],
      [],
    );

    assert.equal(result.changed, false);
    assert.deepEqual(result.screenMap[0].stories, ["US-002"]);
  });
});
