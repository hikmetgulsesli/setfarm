import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planModule } from "../../dist/installer/steps/01-plan/module.js";
import { buildAutoPlanOutput, inferUiLanguage, slugify } from "../../dist/installer/steps/01-plan/preclaim.js";
import { runModule, validPlanOutput } from "./harness.js";

function parsePlanOutput(output: string) {
  const field = (key: string) => output.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim() || "";
  return {
    status: field("STATUS"),
    project_slug: field("PROJECT_SLUG"),
    project_display_name: field("PROJECT_DISPLAY_NAME"),
    repo: field("REPO"),
    branch: field("BRANCH"),
    tech_stack: field("TECH_STACK"),
    ui_language: field("UI_LANGUAGE"),
    prd: output.match(/^PRD:\n([\s\S]*?)\nPRD_SCREEN_COUNT:/m)?.[1] || "",
    prd_screen_count: field("PRD_SCREEN_COUNT"),
    db_required: field("DB_REQUIRED"),
  };
}

describe("01-plan step module", () => {
  it("happy path: prompt under budget + validation ok + context populated", async () => {
    const result = await runModule(
      planModule,
      "Simple note-taking application",
      validPlanOutput()
    );
    assert.ok(result.validation.ok, `validation failed: ${result.validation.errors.join("; ")}`);
    assert.ok(result.promptBytes < planModule.maxPromptSize, `prompt ${result.promptBytes} >= budget ${planModule.maxPromptSize}`);
    assert.equal(result.contextAfterComplete["repo"], "$HOME/projects/test-app-12345");
    assert.equal(result.contextAfterComplete["tech_stack"], "vite-react");
    assert.equal(result.contextAfterComplete["ui_language"], "English");
    assert.ok(result.onCompleteCalled);
  });

  it("short PRD is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ prd: "Too short PRD." })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("PRD must be")));
    assert.equal(result.onCompleteCalled, false);
  });

  it("PRD_SCREEN_COUNT missing/invalid is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ prd_screen_count: "" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("PRD_SCREEN_COUNT")));
  });

  it("invalid TECH_STACK (angular) is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ tech_stack: "angular" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("TECH_STACK")));
  });

  it("prompt budget holds with typical task (~1KB)", async () => {
    const typicalTask = "English word guessing game: three difficulty levels, six attempts, letter feedback, score tracking, main menu, difficulty selection, game board, result screen, settings, and help.";
    const result = await runModule(
      planModule,
      typicalTask,
      validPlanOutput()
    );
    assert.ok(result.promptBytes < planModule.maxPromptSize,
      `typical-task prompt ${result.promptBytes} >= budget ${planModule.maxPromptSize}`);
  });

  it("module metadata is correct", () => {
    assert.equal(planModule.id, "plan");
    assert.equal(planModule.type, "single");
    assert.equal(planModule.agentRole, "planner");
    assert.equal(typeof planModule.preClaim, "function");
    assert.equal(planModule.maxPromptSize, 8192);
    assert.deepEqual(planModule.requiredOutputFields, [
      "STATUS", "REPO", "BRANCH", "TECH_STACK", "UI_LANGUAGE", "PRD", "PRD_SCREEN_COUNT", "DB_REQUIRED"
    ]);
  });

  it("invalid REPO (relative path) is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ repo: "projects/test" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("REPO")));
  });

  it("invalid DB_REQUIRED is rejected", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({ db_required: "mongodb" })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("DB_REQUIRED")));
  });

  it("auto-plan output is valid, bounded, and derives repo from Project line", () => {
    const output = buildAutoPlanOutput([
      "Project: lead-triage-0430",
      "Platform: web React 18 Vite TypeScript.",
      "Build a localStorage lead triage app with add lead, pipeline, insights, settings, and profile panel.",
    ].join("\n"));
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.repo.endsWith("/projects/lead-triage-0430"), true);
    assert.equal(parsed.tech_stack, "vite-react");
    assert.equal(parsed.ui_language, "English");
    assert.equal(parsed.db_required, "none");
    assert.ok(parsed.prd.length >= 2000, `PRD too short: ${parsed.prd.length}`);
    assert.ok(output.length < 7000, `auto-plan output should stay compact, got ${output.length}`);
    assert.match(parsed.prd, /## Overview/);
    assert.doesNotMatch(parsed.prd, /localized metadata leak|screen-name-placeholder|settings-placeholder/);
  });

  it("slugify normalizes project names", () => {
    assert.equal(slugify("Call Center Product Schema"), "call-center-product-schema");
  });

  it("auto-plan defaults English projects to English UI and English screen metadata", () => {
    const output = buildAutoPlanOutput([
      "Project: deep-sea-signal-desk",
      "Build a browser app for an ocean research crew to triage hydrophone anomaly reports.",
      "Include dashboard, anomaly queue, signal detail, create/edit report, equipment health, settings, profile, empty and error states.",
    ].join("\n"));
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.ui_language, "English");
    assert.match(parsed.prd, /User-facing copy language: English/);
    assert.match(parsed.prd, /\| 1 \| Dashboard \| dashboard \|/);
    assert.doesNotMatch(output, /localized metadata leak|screen-name-placeholder|error-placeholder|settings-placeholder/);
  });

  it("keeps Project inline descriptions out of the repo slug", () => {
    const output = buildAutoPlanOutput(
      "Project: retry-feedback-lab-0505 Build a browser-based React/Vite TypeScript operations console.",
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);

    assert.equal(parsed.repo.endsWith("/projects/retry-feedback-lab-0505"), true);
    assert.equal(parsed.branch, "feature-retry-feedback-lab-0505");
    assert.equal(parsed.project_display_name, "Operations Console");
    assert.doesNotMatch(parsed.prd.split("\n").slice(0, 8).join("\n"), /Retry Feedback Lab/i);
  });

  it("separates internal run slugs from product display titles", () => {
    const output = buildAutoPlanOutput(
      "Project: tetris-supervisor-rootfix-0514s Build a browser-based Tetris game with playable falling blocks, keyboard controls, pause/resume, scoring, next-piece preview, game-over/restart flow, responsive touch controls, and smoke tests.",
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.project_slug, "tetris-supervisor-rootfix-0514s");
    assert.equal(parsed.repo.endsWith("/projects/tetris-supervisor-rootfix-0514s"), true);
    assert.equal(parsed.project_display_name, "Tetris");
    assert.match(parsed.prd, /^# Tetris PRD/m);
    assert.doesNotMatch(parsed.prd.split("\n").slice(0, 8).join("\n"), /Supervisor Root Fix|0514/i);
  });

  it("derives clean project names from called/named product phrases without a Project line", () => {
    const output = buildAutoPlanOutput(
      "Build a compact browser arcade game called Neon Courier. It should have keyboard controls, score, pause, restart, and responsive touch controls.",
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.project_slug, "neon-courier");
    assert.equal(parsed.repo.endsWith("/projects/neon-courier"), true);
    assert.equal(parsed.project_display_name, "Neon Courier");
    assert.match(parsed.prd, /^# Neon Courier PRD/m);
  });

  it("auto-plan isolates generated repos per run while keeping product display names clean", () => {
    const output = buildAutoPlanOutput(
      "Build a compact browser puzzle game called Pulse Grid. It should have score, timer, reset, help, settings, keyboard and touch controls.",
      { runId: "e9770d0f-8b65-4226-b954-c043332d817c" },
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.project_slug, "pulse-grid-e9770d0f");
    assert.equal(parsed.repo.endsWith("/projects/pulse-grid-e9770d0f"), true);
    assert.equal(parsed.branch, "feature-pulse-grid-e9770d0f");
    assert.equal(parsed.project_display_name, "Pulse Grid");
    assert.match(parsed.prd, /^# Pulse Grid PRD/m);
  });

  it("auto-plan preserves explicit repo overrides without adding a run suffix", () => {
    const output = buildAutoPlanOutput(
      "Build a compact browser puzzle game called Pulse Grid.",
      { runId: "e9770d0f-8b65-4226-b954-c043332d817c", repo: "/tmp/custom-pulse-grid" },
    );
    const parsed = parsePlanOutput(output);

    assert.equal(parsed.project_slug, "custom-pulse-grid");
    assert.equal(parsed.repo, "/tmp/custom-pulse-grid");
    assert.equal(parsed.branch, "feature-custom-pulse-grid");
  });

  it("auto-plan preserves run isolation suffixes for long generated project names", () => {
    const output = buildAutoPlanOutput(
      "Project: extremely-long-generated-browser-game-name-with-many-extra-marketing-words-and-grid-controls Build a compact browser game.",
      { runId: "e9770d0f-8b65-4226-b954-c043332d817c" },
    );
    const parsed = parsePlanOutput(output);

    assert.equal(parsed.project_slug.endsWith("-e9770d0f"), true);
    assert.equal(parsed.project_slug.length <= 80, true);
    assert.equal(parsed.branch.endsWith("-e9770d0f"), true);
    assert.equal(parsed.branch.length <= 80, true);
  });

  it("auto-plan uses Next.js project structure when TECH_STACK is nextjs", () => {
    const output = buildAutoPlanOutput(
      "Project: seo-arcade-0511 Build a Next.js browser arcade game with settings and restart flow.",
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.tech_stack, "nextjs");
    assert.match(parsed.prd, /src\/app\/page\.tsx/);
    assert.match(parsed.prd, /Do not introduce a Vite-style src\/main\.tsx entrypoint/);
    assert.doesNotMatch(parsed.prd, /Use src\/components, src\/screens, src\/hooks, src\/utils, src\/types, src\/App\.tsx, and src\/main\.tsx/);
  });

  it("does not infer Next.js from game phrases that contain next as a normal word", () => {
    const output = buildAutoPlanOutput(
      "Project: arcade-game-0511 Build a browser arcade game with next level preview, score, pause, and restart.",
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.tech_stack, "vite-react");
    assert.match(parsed.prd, /src\/App\.tsx, and src\/main\.tsx/);
    assert.doesNotMatch(parsed.prd, /Next\.js app router structure/);
  });

  it("auto-plan emits a game-specific contract instead of product CRUD/profile requirements", () => {
    const output = buildAutoPlanOutput(
      "Project: arcade-game-0511 Build a browser arcade game with score, level progression, pause/resume, restart, keyboard controls, and game over flow.",
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.tech_stack, "vite-react");
    assert.match(parsed.prd, /\| 1 \| Game Board \| play \|/);
    assert.match(parsed.prd, /duplicate timers/i);
    assert.match(parsed.prd, /playfield entities/i);
    assert.match(parsed.prd, /Gameplay-only controls are rendered active only while they can affect the current game state/i);
    assert.match(parsed.prd, /Touch controls must not appear as active controls outside the gameplay state/i);
    assert.match(parsed.prd, /window\.app = \{ state: \{ screen, status, score, level, progress, entities/);
    assert.doesNotMatch(parsed.prd, /Filtering, search, create, edit, delete, profile/i);
    assert.doesNotMatch(parsed.prd, /profile\/account icon/i);
    assert.doesNotMatch(parsed.prd, /Every persisted record includes id, createdAt, and updatedAt/i);
  });

  it("preserves inline Project requirements without leaking a prior game template", () => {
    const output = buildAutoPlanOutput(
      "Project: brick-arcade-0512 Build a browser-based arcade game. Requirements: brick grid, paddle controls, ball physics, wall collisions, score, lives, pause/resume, restart, game over, and responsive layout.",
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.match(parsed.prd, /brick grid/i);
    assert.match(parsed.prd, /paddle controls/i);
    assert.match(parsed.prd, /ball physics/i);
    assert.doesNotMatch(parsed.prd, /next piece|tetromino|activePiece|nextPiece/i);
  });

  it("keeps UI language English by default", () => {
    assert.equal(inferUiLanguage("Project: signal desk\nBuild an English app."), "English");
    assert.equal(inferUiLanguage("Project: note board\nBuild a simple note-taking app."), "English");
  });
});
