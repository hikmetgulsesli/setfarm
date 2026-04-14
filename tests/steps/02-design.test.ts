import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { designModule } from "../../dist/installer/steps/02-design/module.js";
import { runModule } from "./harness.js";

function validDesignOutput(overrides: Record<string, string> = {}) {
  return {
    status: "done",
    device_type: "DESKTOP",
    design_system: '{"aesthetic": "minimal", "palette": "dark", "fonts": {"heading": "Space Grotesk", "body": "Inter"}}',
    screen_map: JSON.stringify([
      { screenId: "abc123", name: "Ana Menü", type: "menu", description: "Ana ekran" },
      { screenId: "def456", name: "Oyun Ekranı", type: "game", description: "Oyun" },
      { screenId: "ghi789", name: "Sonuç", type: "result", description: "Sonuç" },
    ]),
    ...overrides,
  };
}

describe("02-design step module", () => {
  it("happy path: valid output passes + prompt under budget", async () => {
    const result = await runModule(designModule, "Test task", validDesignOutput());
    assert.ok(result.validation.ok, `validation failed: ${result.validation.errors.join("; ")}`);
    assert.ok(result.promptBytes < designModule.maxPromptSize,
      `prompt ${result.promptBytes} >= budget ${designModule.maxPromptSize}`);
  });

  it("invalid DEVICE_TYPE rejected", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ device_type: "WATCH" }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("DEVICE_TYPE")));
  });

  it("SCREEN_MAP not array rejected", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ screen_map: '{"foo": "bar"}' }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("SCREEN_MAP")));
  });

  it("SCREEN_MAP entry without screenId rejected", async () => {
    const bad = JSON.stringify([{ name: "X", type: "menu" }]);
    const result = await runModule(designModule, "Test", validDesignOutput({ screen_map: bad }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("screenId or name")));
  });

  it("SCREEN_MAP empty array passes (pipeline auto-recovers)", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ screen_map: "[]" }));
    assert.ok(result.validation.ok, `unexpectedly failed: ${result.validation.errors.join("; ")}`);
  });

  it("module metadata correct", () => {
    assert.equal(designModule.id, "design");
    assert.equal(designModule.type, "single");
    assert.equal(designModule.agentRole, "designer");
    assert.equal(designModule.maxPromptSize, 10240);
    assert.ok(typeof designModule.preClaim === "function", "should have preClaim hook");
  });

  it("missing DEVICE_TYPE allowed (defaults applied downstream)", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ device_type: "" }));
    assert.ok(result.validation.ok);
  });
});
