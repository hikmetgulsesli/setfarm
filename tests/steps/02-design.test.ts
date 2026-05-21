import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { designModule } from "../../dist/installer/steps/02-design/module.js";
import { inferPrdScreens, manifestUsesLocalFallback, parseProductSurfaces, stitchApiKeyAvailable, surfaceCoverageMode, verifyScreenMapToSurfaces } from "../../dist/installer/steps/02-design/preclaim.js";
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
    design_system: '{"aesthetic":"minimal","palette":{"primary":"#2563EB"},"typography":{"heading":"Inter","body":"Inter"}}',
    screen_map: JSON.stringify([
      { screenId: "workspace", name: "Workspace", type: "app-screen", description: "Main workflow", surfaceIds: ["SURF_WORKSPACE"] },
      { screenId: "editor", name: "Note Editor", type: "form", description: "Editor", surfaceIds: ["SURF_NOTE_EDITOR"] },
    ]),
    ...overrides,
  };
}

describe("02-design step module", () => {
  it("happy path: valid output passes + prompt under budget", async () => {
    const result = await runModule(designModule, "Test task", validDesignOutput());
    assert.ok(result.validation.ok, `validation failed: ${result.validation.errors.join("; ")}`);
    assert.ok(result.promptBytes < designModule.maxPromptSize);
  });

  it("allows explicit design bypass for non-UI platforms", async () => {
    const result = await runModule(designModule, "API task", validDesignOutput({
      design_required: "false",
      device_type: "NONE",
      screen_map: "[]",
    }));
    assert.equal(result.validation.ok, true, result.validation.errors.join("; "));
  });

  it("invalid DEVICE_TYPE rejected", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ device_type: "WATCH" }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("DEVICE_TYPE")));
  });

  it("SCREEN_MAP not array rejected", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ screen_map: '{"foo":"bar"}' }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("SCREEN_MAP")));
  });

  it("SCREEN_MAP entry without screenId rejected", async () => {
    const result = await runModule(designModule, "Test", validDesignOutput({ screen_map: JSON.stringify([{ name: "X" }]) }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("screenId or name")));
  });

  it("module metadata correct", () => {
    assert.equal(designModule.id, "design");
    assert.equal(designModule.agentRole, "designer");
    assert.ok(typeof designModule.preClaim === "function");
  });

  it("preClaim uses scoped Product Surface Stitch payload and verify gate", () => {
    const source = designPreclaimSource();
    assert.match(source, /function buildDesignBrief/);
    assert.match(source, /STRICT_UI_SCOPE_CONTRACT/);
    assert.match(source, /PRODUCT_VISION_SUMMARY/);
    assert.match(source, /PRODUCT_SURFACES/);
    assert.match(source, /UI_SAFE_PRD_CONTEXT/);
    assert.match(source, /Use this only to understand product behavior and missing UI states/);
    assert.match(source, /function verifyScreenMapToSurfaces/);
    assert.match(source, /DESIGN_SURFACE_MISMATCH/);
    assert.match(source, /DESIGN_BRIEF\.md/);
    assert.doesNotMatch(source, /FULL_PRD_APPENDIX/);
    assert.doesNotMatch(source, /MANDATORY SCREENS FROM SETFARM/);
    assert.doesNotMatch(source, /reconcileScreenMapToPrd/);
  });

  it("preClaim requires Stitch assets and does not generate local fallback design", () => {
    const source = designPreclaimSource();
    assert.doesNotMatch(source, /function createFallbackDesignAssets/);
    assert.doesNotMatch(source, /completeWithLocalFallbackDesign/);
    assert.match(source, /DESIGN_STITCH_HTML_UNAVAILABLE/);
    assert.match(source, /DESIGN_STITCH_DESIGN_MD_UNAVAILABLE/);
    assert.match(source, /local fallback design generation is disabled/);
    assert.match(source, /get-design-md/);
  });

  it("preClaim keeps Stitch download and whole-batch generation behavior", () => {
    const source = designPreclaimSource();
    assert.match(source, /function generateStitchScreensInSingleBatch/);
    assert.match(source, /STITCH_BATCH_BRIEF/);
    assert.match(source, /Generate every SCREEN_SPEC in this batch call/);
    assert.match(source, /SETFARM_STITCH_BATCH_STAGE_SIZE/);
    assert.match(source, /stageSize/);
    assert.match(source, /generating \$\{surfaces\.length\} Product Surfaces in \$\{stages\.length\} Stitch batch stage/);
    assert.match(source, /preserve the same visual system/);
    assert.match(source, /generate-all-screens[\s\S]*promptFile/);
    assert.match(source, /SCREEN_SPECS/);
    assert.match(source, /exact_screen_title/);
    assert.match(source, /unique_canvas_caption/);
    assert.match(source, /Do not create a design-system\/style-guide canvas/);
    assert.match(source, /Do not reuse one global caption across screens/);
    assert.match(source, /Do not write 'How would you like to proceed\?'/);
    assert.match(source, /SETFARM_STITCH_BATCH_RETRY_ATTEMPTS/);
    assert.match(source, /SETFARM_STITCH_BATCH_RETRY_BASE_DELAY_MS/);
    assert.match(source, /retrying same batch stage/);
    assert.match(source, /const downloadAttempts = stitchProviderUnavailable \? 1 : \(batchGenerationCompleted \? 3 : 1\)/);
    assert.match(source, /SETFARM_STITCH_PER_SCREEN_RECOVERY/);
    assert.match(source, /SETFARM_STITCH_PER_SCREEN_RECOVERY === "1"/);
    assert.match(source, /SETFARM_STITCH_SCREEN_BATCH_SIZE/);
    assert.match(source, /generate-screen-safe/);
    assert.doesNotMatch(source, /Batch generation disabled; using per-screen Stitch generation/);
    assert.doesNotMatch(source, /generating Stitch batch chunk/);
  });

  it("preClaim retries transient Stitch project ensure failures before failing design", () => {
    const source = designPreclaimSource();
    assert.match(source, /SETFARM_STITCH_PROJECT_RETRY_ATTEMPTS/);
    assert.match(source, /ensuring Stitch project \(attempt/);
    assert.match(source, /Stitch project ensure failed on attempt/);
    assert.match(source, /could not create or load a Stitch project after retries/);
  });

  it("preClaim keeps targeted retry opt-in and inline coverage for recoverable design mismatches", () => {
    const source = designPreclaimSource();
    assert.match(source, /function surfaceCoverageMode/);
    assert.match(source, /inline_covered/);
    assert.match(source, /SETFARM_STITCH_TARGETED_SURFACE_RETRY/);
    assert.match(source, /SETFARM_STITCH_TARGETED_SURFACE_RETRY === "1"/);
    assert.match(source, /Product Surface coverage mismatch/);
    assert.match(source, /screenTargetsForSurfaces/);
  });

  it("Product Surface extraction drives Stitch targets", () => {
    const prd = `# Product Contract

## 4. Product Surfaces
### SURFACE: SURF_WORKSPACE
- Name: Workspace
- Purpose: Main workflow.
- Permitted Actions: ACT_SEARCH (control_hint: search_input_persistent), ACT_CREATE (control_hint: primary_button)

### SURFACE: SURF_EDITOR
- Name: Editor
- Purpose: Create and edit records.
- Permitted Actions: ACT_SAVE (control_hint: form_submit)
`;
    const surfaces = parseProductSurfaces(prd);
    assert.deepEqual(surfaces.map((surface) => surface.surfaceId), ["SURF_WORKSPACE", "SURF_EDITOR"]);
    const targets = inferPrdScreens(prd);
    assert.deepEqual(targets.map((screen) => screen.surfaceIds?.[0]), ["SURF_WORKSPACE", "SURF_EDITOR"]);
  });

  it("allows empty/error recovery surfaces to be covered inline by generated HTML", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-inline-coverage-"));
    try {
      const prd = `# Product Contract

## 4. Product Surfaces
### SURFACE: SURF_TICKET_OPERATIONS
- Name: Ticket Operations
- Purpose: Main ticket workflow.
- Core Content: list, filters, selected item.
- Permitted Actions: ACT_SEARCH_RECORDS (control_hint: search_input_persistent)

### SURFACE: SURF_EMPTY_AND_ERROR_RECOVERY
- Name: Empty and Error Recovery
- Purpose: Keep the ticket workflow usable when data is empty, failed, or recoverable.
- Core Content: empty state, error message, retry action, clear filters.
- Permitted Actions: ACT_RETRY_LOAD (control_hint: primary_button)
`;
      fs.writeFileSync(
        path.join(tmp, "ops.html"),
        "<!doctype html><html><head><title>Ticket Operations</title></head><body><main><h1>Ticket Operations</h1><p>Empty queue</p><button>Retry load</button><button>Clear filters</button></main></body></html>".padEnd(1200, " "),
      );
      const surfaces = parseProductSurfaces(prd);
      assert.equal(surfaceCoverageMode(surfaces[0]), "standalone_required");
      assert.equal(surfaceCoverageMode(surfaces[1]), "inline_allowed");

      const result = verifyScreenMapToSurfaces([
        { screenId: "ops", name: "Ticket Operations", type: "app-screen", description: "Main ticket workflow" },
      ], prd, { stitchDir: tmp });

      assert.deepEqual(result.missing, []);
      assert.equal(result.inlineCovered.length, 1);
      assert.deepEqual(result.screenMap.map((screen) => screen.surfaceIds), [["SURF_TICKET_OPERATIONS"]]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("still requires standalone product surfaces when Stitch omits them", () => {
    const prd = `# Product Contract

## 4. Product Surfaces
### SURFACE: SURF_TICKET_OPERATIONS
- Name: Ticket Operations
- Purpose: Main ticket workflow.
- Permitted Actions: ACT_SEARCH_RECORDS (control_hint: search_input_persistent)

### SURFACE: SURF_SETTINGS_AND_PREFERENCES
- Name: Settings and Preferences
- Purpose: Let users adjust workflow preferences and saved filters.
- Permitted Actions: ACT_SAVE_PREFERENCES (control_hint: form_submit)
`;
    const result = verifyScreenMapToSurfaces([
      { screenId: "ops", name: "Ticket Operations", type: "app-screen", description: "Main ticket workflow" },
    ], prd);

    assert.deepEqual(result.missing, ["SURF_SETTINGS_AND_PREFERENCES Settings and Preferences"]);
    assert.deepEqual(result.missingSurfaces.map((surface) => surface.surfaceId), ["SURF_SETTINGS_AND_PREFERENCES"]);
  });

  it("does not attach extra surfaces when a generated screen exactly matches one surface", () => {
    const prd = `# Product Contract

## 4. Product Surfaces
### SURFACE: SURF_TICKET_OPERATIONS
- Name: Ticket Operations
- Purpose: Give users the main ticket operations workflow.
- Entry Points: direct_url
- Permitted Actions: ACT_SEARCH_RECORDS (control_hint: search_input_persistent)

### SURFACE: SURF_AGENT_WORKLOAD
- Name: Agent Workload
- Purpose: Show how Ticket work is assigned across agents.
- Entry Points: SURF_TICKET_OPERATIONS
- Permitted Actions: ACT_ASSIGN_RECORD (control_hint: context_menu)
`;
    const result = verifyScreenMapToSurfaces([
      { screenId: "ops", name: "Ticket Operations", type: "app-screen", description: "Ticket Operations screen" },
      { screenId: "agents", name: "Agent Workload", type: "app-screen", description: "Agent Workload screen" },
    ], prd);

    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.screenMap.map((screen) => screen.surfaceIds), [
      ["SURF_TICKET_OPERATIONS"],
      ["SURF_AGENT_WORKLOAD"],
    ]);
  });

  it("dedup auto-skip validates reusable design assets against Product Surfaces", () => {
    const source = stepOpsSource();
    assert.match(source, /function parsePrdDesignSurfaces/);
    assert.match(source, /Existing design cache missing Product Surface/);
    assert.match(source, /clearReusableDesignCache\(dRepoPath\)/);
    assert.match(source, /PRODUCT_VISION_SUMMARY/);
    assert.match(source, /UI_SAFE_PRD_CONTEXT/);
    assert.doesNotMatch(source, /FULL_PRD_APPENDIX/);
    assert.doesNotMatch(source, /parsePrdDesignScreenRows/);
  });

  it("does not reuse stale local fallback assets when a Stitch key is available", () => {
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
});
