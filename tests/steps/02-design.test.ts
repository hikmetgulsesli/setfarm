import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { designModule } from "../../dist/installer/steps/02-design/module.js";
import { inferFallbackScreens, manifestUsesLocalFallback, stitchApiKeyAvailable } from "../../dist/installer/steps/02-design/preclaim.js";
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
    assert.match(source, /function redactDiagnosticText\(text: unknown\): string/);
    assert.match(source, /event: "step\.progress"/);
    assert.match(source, /UPDATE steps SET updated_at = \$1/);
    assert.match(source, /UPDATE claim_log SET diagnostic = \$1/);
    assert.match(source, /generate-all-screens[\s\S]*onProgress: \(\) => recordPreClaimProgress\(ctx, "Design preclaim: still generating Stitch screens"\)/);
    assert.match(source, /0-screen Stitch response/);
    assert.match(source, /Last Stitch diagnostic/);
    assert.match(source, /download-all[\s\S]*onProgress: \(\) => recordPreClaimProgress\(ctx, `Design preclaim: still downloading Stitch HTML files/);
    assert.match(source, /timeout: 660000/);
  });

  it("preClaim resolves Stitch scripts from the active platform root", () => {
    const source = designPreclaimSource();
    assert.match(source, /import \{ resolvePlatformScript \} from "\.\.\/\.\.\/paths\.js"/);
    assert.match(source, /const stitchScript = resolvePlatformScript\("stitch-api\.mjs"\)/);
    assert.match(source, /const domScript = resolvePlatformScript\("design-dom-extract\.mjs"\)/);
    assert.doesNotMatch(source, /\.openclaw\/setfarm-repo\/scripts\/stitch-api\.mjs/);
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
    assert.match(source, /All visible user-facing text must be in \$\{uiLanguage\}/);
    assert.doesNotMatch(source, /All visible text must be in a hard-coded language|hard-coded language/);
  });

  it("preClaim keeps local fallback only for unconfigured Stitch environments", () => {
    const source = designPreclaimSource();
    assert.match(source, /function createFallbackDesignAssets/);
    assert.match(source, /Design preclaim: generated fallback design assets/);
    assert.match(source, /if \(htmlCount === 0 && hasStitchKey\)/);
    assert.match(source, /DESIGN_STITCH_HTML_UNAVAILABLE/);
    assert.match(source, /SCREEN_MAP\.json/);
    assert.match(source, /UI_CONTRACT\.json/);
    assert.match(source, /Main Menu/);
    assert.doesNotMatch(source, /agent will see empty/);
  });

  it("preClaim fails fast on transient Stitch provider outages instead of burning download retries", () => {
    const source = designPreclaimSource();

    assert.match(source, /function isStitchProviderUnavailable\(text: unknown\): boolean/);
    assert.match(source, /service is currently unavailable/);
    assert.match(source, /temporarily unavailable/);
    assert.match(source, /resource exhausted/);
    assert.match(source, /const downloadAttempts = stitchProviderUnavailable \? 0 : \(batchGenerationCompleted \? 3 : 1\)/);
    assert.match(source, /skipping Stitch download recovery because the provider did not accept generation/);
    assert.match(source, /DESIGN_STITCH_SERVICE_UNAVAILABLE/);
    assert.match(source, /failDesignPreclaim\(ctx, error, \{ terminal: stitchProviderUnavailable \}\)/);
    assert.match(source, /UPDATE steps SET max_retries = retry_count WHERE id = \$1/);
  });

  it("preClaim uses compact exact-count batch Stitch prompts and keeps per-screen recovery opt-in", () => {
    const source = designPreclaimSource();
    assert.match(source, /function compactPrdForStitch/);
    assert.match(source, /function buildBatchStitchPrompt/);
    assert.match(source, /Generate exactly \$\{screens\.length\} separate/);
    assert.match(source, /Screen titles must match exactly/);
    assert.match(source, /function buildPerScreenStitchPrompt/);
    assert.match(source, /function retitleTrackedStitchScreens/);
    assert.match(source, /async function generateStitchScreensIndividually/);
    assert.match(source, /generate-screen-safe/);
    assert.match(source, /setfarmExpectedTitle/);
    assert.match(source, /SETFARM_STITCH_PER_SCREEN_RECOVERY/);
    assert.match(source, /Design preclaim: per-screen Stitch generation produced/);
    assert.match(source, /batch generation, download, and tracking-file recovery/);
  });

  it("preClaim does not reuse stale local fallback assets when a Stitch key is available", () => {
    const source = designPreclaimSource();
    assert.match(source, /const hasStitchKey = stitchApiKeyAvailable\(\)/);
    assert.match(source, /manifestUsesLocalFallback\(stitchDir\) && hasStitchKey/);
    assert.match(source, /invalidating stale local fallback assets before real Stitch generation/);
    assert.match(source, /fs\.rmSync\(stitchDir, \{ recursive: true, force: true \}\)/);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-stale-fallback-"));
    try {
      fs.writeFileSync(path.join(tmp, "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "fallback-main", source: "local-fallback" },
      ]));
      assert.equal(manifestUsesLocalFallback(tmp), true);
      assert.equal(stitchApiKeyAvailable({ STITCH_API_KEY: "test-key" } as NodeJS.ProcessEnv), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
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

  it("keeps Game Over fallback on result actions instead of pause controls", () => {
    const source = designPreclaimSource();
    const resultBranch = source.indexOf("if (/(over|result|score|summary)/.test(title))");
    const gameBranch = source.indexOf("if (/(game|board|play)/.test(title))");

    assert.ok(resultBranch >= 0, "result fallback branch should exist");
    assert.ok(gameBranch >= 0, "game fallback branch should exist");
    assert.ok(resultBranch < gameBranch, "Game Over must not match the generic game board fallback first");
    assert.match(source, /<button type="button">Restart<\/button><button type="button">Main Menu<\/button>/);
    assert.doesNotMatch(source, /<button type="button">Play Again<\/button><button type="button">Share Score<\/button><button type="button">Main Menu<\/button>/);
  });

  it("preClaim reconciles generated screens to the PRD screen contract", () => {
    const source = designPreclaimSource();
    assert.match(source, /function reconcileScreenMapToPrd/);
    assert.match(source, /DESIGN_SCREEN_MAP_PRD_MISMATCH/);
    assert.match(source, /rewriteScreenArtifactsForScreenMap/);
    assert.match(source, /SCREENS_GENERATED: " \+ screenMap\.length/);
    assert.doesNotMatch(source, /SCREENS_GENERATED: " \+ manifest\.length/);
  });

  it("preClaim writes a DESIGN.md briefing for real and fallback Stitch artifacts", () => {
    const source = designPreclaimSource();
    assert.match(source, /function writeDesignMarkdownBrief/);
    assert.match(source, /writeDesignMarkdownBrief\(stitchDir, screens, prd, repo\)/);
    assert.match(source, /writeDesignMarkdownBrief\(stitchDir, screenMap, prd, repo\)/);
    assert.match(source, /Implementation must follow these artifacts before inventing new UI structure/);
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

  it("resets an empty Stitch project after a previous HTML availability failure", () => {
    const source = designPreclaimSource();

    assert.match(source, /resetFailedStitchProject/);
    assert.match(source, /DESIGN_STITCH\|0\\s\+\(\?:valid\\s\+\)\?\(\?:HTML\|Stitch screens\)\|download failed/);
    assert.match(source, /Design preclaim: resetting empty Stitch project after previous generation failure/);
    assert.match(source, /STITCH_FORCE_NEW_PROJECT: "1"/);
  });

  it("deduplicates repeated Stitch progress heartbeats without suppressing state updates", () => {
    const source = designPreclaimSource();

    assert.match(source, /const progressDedupe = new Map/);
    assert.match(source, /last\.detail !== safeDetail \|\| Date\.now\(\) - last\.emittedAt >= 120000/);
    assert.match(source, /if \(shouldEmit\)/);
  });
});
