import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { storiesModule } from "../../dist/installer/steps/03-stories/module.js";
import { extractExplicitMaxStories } from "../../dist/installer/steps/03-stories/context.js";
import { runModule } from "./harness.js";

describe("03-stories step module", () => {
  it("happy path: STATUS=done passes validation + prompt under budget", async () => {
    const result = await runModule(storiesModule, "Test", { status: "done" });
    assert.ok(result.validation.ok);
    assert.ok(result.promptBytes < storiesModule.maxPromptSize,
      `prompt ${result.promptBytes} >= budget ${storiesModule.maxPromptSize}`);
  });

  it("STATUS missing rejected", async () => {
    const result = await runModule(storiesModule, "Test", { status: "" });
    assert.equal(result.validation.ok, false);
  });

  it("module metadata correct", () => {
    assert.equal(storiesModule.id, "stories");
    assert.equal(storiesModule.type, "single");
    assert.equal(storiesModule.agentRole, "planner");
    assert.equal(storiesModule.maxPromptSize, 32768);
  });

  it("prompt includes scope_files and predicted_screen_files mentions", async () => {
    const result = await runModule(storiesModule, "Test", { status: "done" });
    assert.ok(result.prompt.includes("scope_files"), "prompt should mention scope_files");
    assert.ok(result.prompt.includes("PREDICTED_SCREEN_FILES"), "prompt should mention predicted screens");
    assert.ok(result.prompt.includes("STORIES_JSON"), "prompt should mention STORIES_JSON");
  });

  it("extracts explicit Turkish and English story caps", () => {
    assert.equal(extractExplicitMaxStories("Maksimum 1 story üret."), 1);
    assert.equal(extractExplicitMaxStories("maks 2 adet story olsun"), 2);
    assert.equal(extractExplicitMaxStories("En çok 3 story yaz"), 3);
    assert.equal(extractExplicitMaxStories("4 stories maximum"), 4);
    assert.equal(extractExplicitMaxStories("story listesi üret"), null);
  });
});
