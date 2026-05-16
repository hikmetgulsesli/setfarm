import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { designModule } from "../../dist/installer/steps/02-design/module.js";
import { inferFallbackScreens } from "../../dist/installer/steps/02-design/preclaim.js";
import { runModule } from "./harness.js";

function designPreclaimSource(): string {
  return fs.readFileSync(path.resolve(import.meta.dirname, "../../src/installer/steps/02-design/preclaim.ts"), "utf-8");
}

function stepOpsSource(): string {
  return fs.readFileSync(path.resolve(import.meta.dirname, "../../src/installer/step-ops.ts"), "utf-8");
}

function validDesignOutput(overrides: Record<string, string> = {}) {
  return {
    status: "done",
    device_type: "DESKTOP",
    design_system: '{"aesthetic": "minimal", "palette": "dark", "fonts": {"heading": "Space Grotesk", "body": "Inter"}}',
    screen_map: JSON.stringify([
      { screenId: "abc123", name: "Main Menu", type: "menu", description: "Main screen" },
      { screenId: "def456", name: "Game Board", type: "game", description: "Game" },
      { screenId: "ghi789", name: "Results", type: "result", description: "Results" },
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

  it("SCREEN_MAP empty array rejected", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ screen_map: "[]" }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("SCREEN_MAP")));
  });

  it("missing SCREEN_MAP rejected", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ screen_map: "" }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("SCREEN_MAP is required")));
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

  it("preClaim records heartbeat progress while Stitch runs", () => {
    const source = designPreclaimSource();
    assert.match(source, /function execFileText[\s\S]*onProgress/);
    assert.match(source, /function recordPreClaimProgress/);
    assert.match(source, /event: "step\.progress"/);
    assert.match(source, /UPDATE steps SET updated_at = \$1/);
    assert.match(source, /UPDATE claim_log SET diagnostic = \$1/);
    assert.match(source, /generate-all-screens[\s\S]*onProgress: \(\) => recordPreClaimProgress\(ctx, "Design preclaim: still generating Stitch screens"\)/);
    assert.match(source, /download-all[\s\S]*onProgress: \(\) => recordPreClaimProgress\(ctx, `Design preclaim: still downloading Stitch HTML files/);
  });

  it("preClaim terminates child processes after cancellation", () => {
    const source = designPreclaimSource();
    assert.match(source, /const PRECLAIM_CANCELLED = "DESIGN_PRECLAIM_CANCELLED"/);
    assert.match(source, /stepUpdate\.changes === 0\) return false/);
    assert.match(source, /child\?\.kill\("SIGTERM"\)/);
    assert.match(source, /child\?\.kill\("SIGKILL"\)/);
    assert.match(source, /if \(isPreclaimCancelledError\(e\)\) return/);
  });

  it("preClaim uses UI_LANGUAGE instead of a hard-coded localized Stitch prompt", () => {
    const source = designPreclaimSource();
    assert.match(source, /const uiLanguage = ctx\.context\["ui_language"\]/);
    assert.match(source, /All visible application text must be in \$\{uiLanguage\}/);
    assert.doesNotMatch(source, /All visible text must be in a hard-coded language|hard-coded language/);
  });

  it("preClaim generates local fallback design assets when Stitch returns no HTML", () => {
    const source = designPreclaimSource();
    assert.match(source, /function createFallbackDesignAssets/);
    assert.match(source, /Design preclaim: generated fallback design assets/);
    assert.match(source, /SCREEN_MAP\.json/);
    assert.match(source, /UI_CONTRACT\.json/);
    assert.match(source, /Main Menu/);
    assert.doesNotMatch(source, /agent will see empty/);
  });

  it("local fallback mirrors the PRD Screens table exactly", () => {
    const prd = `# Tetris PRD

## Screens
| # | Screen Name | Type | Description |
|---|-------------|------|-------------|
| 1 | Main Menu | menu | Start and resume entry point |
| 2 | Game Board | game | Playfield, score, next piece, and touch controls |
| 3 | Pause Overlay | modal | Pause/resume/restart state |
| 4 | Game Over | result | Final score and restart action |
| 5 | Controls Help | help | Keyboard controls and rules |
`;
    const screens = inferFallbackScreens(prd);
    assert.deepEqual(screens.map((screen) => screen.name), [
      "Main Menu",
      "Game Board",
      "Pause Overlay",
      "Game Over",
      "Controls Help",
    ]);
    const controls = screens.find((screen) => screen.name === "Controls Help");
    assert.equal(controls?.type, "help");
    assert.equal(controls?.description, "Keyboard controls and rules");
  });

  it("preClaim reconciles generated screens to the PRD screen contract", () => {
    const source = designPreclaimSource();
    assert.match(source, /function reconcileScreenMapToPrd/);
    assert.match(source, /DESIGN_SCREEN_MAP_PRD_MISMATCH/);
    assert.match(source, /rewriteScreenArtifactsForScreenMap/);
    assert.match(source, /SCREENS_GENERATED: " \+ screenMap\.length/);
    assert.doesNotMatch(source, /SCREENS_GENERATED: " \+ manifest\.length/);
  });

  it("dedup auto-skip validates reusable design assets against PRD screens through normal completion guardrails", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function autoCompleteDesignStep");
    const end = source.indexOf("/**\n * DESIGN STEP DEDUP", start);
    const autoCompleteSource = source.slice(start, end);
    assert.match(source, /function reconcileReusableDesignScreens/);
    assert.match(source, /parsePrdDesignScreenRows/);
    assert.match(source, /Existing design cache missing PRD screen\(s\)/);
    assert.match(source, /clearReusableDesignCache\(dRepoPath\)/);
    assert.match(autoCompleteSource, /SCREEN_MAP: \$\{JSON\.stringify\(dScreenMap\)\}/);
    assert.match(autoCompleteSource, /await completeStep\(step\.id, dOutput\)/);
    assert.doesNotMatch(autoCompleteSource, /UPDATE steps SET status = 'done'/);
  });
});
