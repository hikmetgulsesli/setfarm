import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { buildRunContract } from "../src/installer/contract-ledger.js";

function tempRepo(name: string): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `setfarm-contract-${name}-`));
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ scripts: { build: "vite build" }, dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest" } }));
  fs.writeFileSync(path.join(repo, "vite.config.ts"), "export default {};\n");
  fs.writeFileSync(path.join(repo, "src", "main.tsx"), "import React from 'react';\n");
  fs.mkdirSync(path.join(repo, "dist"), { recursive: true });
  fs.writeFileSync(path.join(repo, "dist", "index.html"), "<div id=\"root\"></div>\n");
  return repo;
}

function writeDesign(repo: string, screens: Array<{ screenId: string; name: string }>): void {
  fs.writeFileSync(path.join(repo, "stitch", "SCREEN_MAP.json"), JSON.stringify(screens));
  fs.writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify({ screens }));
  fs.writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({ screens: [] }));
  fs.writeFileSync(path.join(repo, "stitch", "UI_CONTRACT.json"), JSON.stringify({ screens: [] }));
  fs.writeFileSync(path.join(repo, "stitch", "design-tokens.json"), JSON.stringify({ colors: [] }));
  fs.writeFileSync(path.join(repo, "stitch", "DESIGN.md"), "# Design\n");
  for (const screen of screens) {
    fs.writeFileSync(path.join(repo, "stitch", `${screen.screenId}.html`), `<main>${screen.name}</main>`);
    fs.writeFileSync(path.join(repo, "stitch", `${screen.screenId}.png`), "png");
  }
}

function baseRun(repo: string) {
  const prd = [
    "# Pulse Grid Product Contract",
    "Build a compact browser puzzle game with menu, play, help, pause, and game over states.",
    "## 4. Product Surfaces",
    "### SURFACE: SURF_MENU",
    "- Name: Main Menu",
    "- Purpose: Start, resume, and choose game mode.",
    "### SURFACE: SURF_GAMEPLAY",
    "- Name: Game Board",
    "- Purpose: Main playable puzzle board with score and input.",
    "### SURFACE: SURF_HELP",
    "- Name: Help",
    "- Purpose: Controls and rules reference.",
    "## 8. Testability Contract",
    "- Critical paths cover starting from menu, playing the board, opening help, pausing, and reaching game over.",
    "- Each interactive control exposes deterministic state so smoke, final-test, and deployment gates can verify the actual game loop.",
    "- The PRD text is intentionally long enough to satisfy the ledger's captured-context evidence threshold for a completed plan phase.",
  ].join("\n");
  return {
    id: "run-contract",
    run_number: 7,
    workflow_id: "feature-dev",
    task: "Build a compact browser puzzle game called Pulse Grid.",
    status: "running",
    context: JSON.stringify({
      repo,
      branch: "feature/pulse-grid",
      tech_stack: "vite-react",
      prd,
      design_required: "true",
      ui_language: "English",
      build_cmd: "npm run build",
    }),
  };
}

function steps() {
  return ["plan", "design", "stories", "setup-repo", "setup-build"].map((step_id, index) => ({
    id: `${step_id}-id`,
    run_id: "run-contract",
    step_id,
    status: "done",
    step_index: index,
  })).concat([{ id: "impl-id", run_id: "run-contract", step_id: "implement", status: "running", step_index: 5 } as any]);
}

function stories() {
  return [
    {
      id: "story-1",
      run_id: "run-contract",
      story_id: "US-001",
      title: "Menu and play board",
      status: "done",
      acceptance_criteria: JSON.stringify(["Menu starts game", "Board accepts input"]),
      scope_files: JSON.stringify(["src/App.tsx"]),
      shared_files: JSON.stringify(["src/game.ts"]),
      story_screens: JSON.stringify(["menu", "play"]),
    },
    {
      id: "story-2",
      run_id: "run-contract",
      story_id: "US-002",
      title: "Help screen",
      status: "pending",
      acceptance_criteria: JSON.stringify(["Help opens", "Controls are listed"]),
      scope_files: JSON.stringify(["src/Help.tsx"]),
      shared_files: JSON.stringify([]),
      story_screens: JSON.stringify(["help"]),
    },
  ];
}

describe("run contract ledger", () => {
  it("resolves browser game stack and marks complete design/setup evidence", () => {
    const repo = tempRepo("complete");
    writeDesign(repo, [
      { screenId: "menu", name: "Main Menu" },
      { screenId: "play", name: "Game Board" },
      { screenId: "help", name: "Help" },
    ]);

    const contract = buildRunContract({
      run: baseRun(repo),
      steps: steps() as any,
      stories: stories() as any,
      reason: "test",
      now: "2026-05-17T00:00:00.000Z",
    });

    assert.equal(contract.stackPack.id, "browser-game-canvas");
    assert.equal(contract.phases.find(p => p.id === "design")?.status, "pass");
    assert.equal(contract.phases.find(p => p.id === "setup-build")?.status, "pass");
    assert.equal(contract.artifacts.pngCount, 3);
  });

  it("does not classify explicit non-game score dashboards as browser games", () => {
    const repo = tempRepo("non-game-score");
    const run = baseRun(repo);
    const prd = [
      "# StackLens Canary Product Contract",
      "Build a compact browser tool for module stack health. Use a frontend web app stack, not a game.",
      "The dashboard shows risk score, stack status, module cards, and a detail panel.",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_MODULE_OVERVIEW",
      "- Name: Module Overview",
      "- Purpose: Compare modules and stack health.",
      "### SURFACE: SURF_SCORE_DETAIL",
      "- Name: Score Detail",
      "- Purpose: Explain risk score drivers.",
      "## 8. Testability Contract",
      "- The PRD text is intentionally long enough to satisfy captured-context evidence for a completed plan phase.",
    ].join("\n");

    run.task = "Build a compact browser tool called StackLens Canary. Use a frontend web app stack, not a game. Show module risk score.";
    run.context = JSON.stringify({
      repo,
      branch: "feature/stacklens-canary",
      tech_stack: "vite-react",
      prd,
      design_required: "true",
      ui_language: "English",
      build_cmd: "npm run build",
    });

    const contract = buildRunContract({
      run,
      steps: steps() as any,
      stories: [] as any,
      reason: "test",
      now: "2026-05-17T00:00:00.000Z",
    });

    assert.equal(contract.stackPack.id, "vite-react-web-app");
  });

  it("keeps future story surfaces deferred instead of failing the current story", () => {
    const repo = tempRepo("deferred");
    writeDesign(repo, [
      { screenId: "menu", name: "Main Menu" },
      { screenId: "play", name: "Game Board" },
      { screenId: "help", name: "Help" },
    ]);

    const contract = buildRunContract({
      run: baseRun(repo),
      steps: steps() as any,
      stories: stories() as any,
      now: "2026-05-17T00:00:00.000Z",
    });
    const storyPhase = contract.phases.find(p => p.id === "stories");
    const ownershipItem = storyPhase?.items.find(i => i.id === "stories.screen_ownership");
    const futureHelp = storyPhase?.items.find(i => i.id === "stories.owner.US-002");

    assert.equal(ownershipItem?.status, "pass");
    assert.equal(futureHelp?.status, "deferred");
    assert.equal(contract.stories.find(s => s.storyId === "US-002")?.deferred, true);
  });

  it("keeps artifact evidence pending until the owning pipeline step has run", () => {
    const repo = tempRepo("future-pending");
    writeDesign(repo, [
      { screenId: "menu", name: "Main Menu" },
      { screenId: "play", name: "Game Board" },
      { screenId: "help", name: "Help" },
    ]);

    const earlySteps = [
      { id: "plan-id", run_id: "run-contract", step_id: "plan", status: "done", step_index: 0 },
      { id: "design-id", run_id: "run-contract", step_id: "design", status: "running", step_index: 1 },
      { id: "stories-id", run_id: "run-contract", step_id: "stories", status: "waiting", step_index: 2 },
      { id: "setup-repo-id", run_id: "run-contract", step_id: "setup-repo", status: "waiting", step_index: 3 },
      { id: "setup-build-id", run_id: "run-contract", step_id: "setup-build", status: "waiting", step_index: 4 },
      { id: "impl-id", run_id: "run-contract", step_id: "implement", status: "waiting", step_index: 5 },
    ];

    const contract = buildRunContract({
      run: baseRun(repo),
      steps: earlySteps as any,
      stories: [] as any,
      now: "2026-05-17T00:00:00.000Z",
    });

    assert.equal(contract.phases.find(p => p.id === "plan")?.status, "pass");
    assert.equal(contract.phases.find(p => p.id === "design")?.status, "pending");
    assert.equal(contract.phases.find(p => p.id === "stories")?.status, "pending");
    assert.equal(contract.phases.find(p => p.id === "setup-build")?.status, "pending");
    assert.equal(contract.phases.find(p => p.id === "implement")?.status, "pending");
    assert.equal(contract.progress.fail, 0);
  });

  it("normalizes object-based story_screens without [object Object] false failures", () => {
    const repo = tempRepo("object-screens");
    writeDesign(repo, [
      { screenId: "menu", name: "Main Menu" },
      { screenId: "play", name: "Game Board" },
      { screenId: "help", name: "Help" },
    ]);

    const objectStories = stories().map((story) => ({
      ...story,
      story_screens: story.story_id === "US-001"
        ? JSON.stringify([
            { screenId: "menu", name: "Main Menu", type: "menu" },
            { screenId: "play", name: "Game Board", type: "game" },
          ])
        : JSON.stringify([{ screenId: "help", name: "Help", type: "help" }]),
    }));

    const contract = buildRunContract({
      run: baseRun(repo),
      steps: steps() as any,
      stories: objectStories as any,
      now: "2026-05-17T00:00:00.000Z",
    });
    const storyPhase = contract.phases.find(p => p.id === "stories");
    const ownershipItem = storyPhase?.items.find(i => i.id === "stories.screen_ownership");
    const firstStory = contract.stories.find(s => s.storyId === "US-001");

    assert.equal(ownershipItem?.status, "pass");
    assert.equal(firstStory?.ownsScreens.includes("[object Object]"), false);
    assert.deepEqual(firstStory?.ownsScreens, ["Main Menu (menu)", "Game Board (game)"]);
  });

  it("uses implementation_contract screen ownership when story_screens is empty", () => {
    const repo = tempRepo("contract-screens");
    writeDesign(repo, [
      { screenId: "menu", name: "Main Menu" },
      { screenId: "play", name: "Game Board" },
      { screenId: "help", name: "Help" },
    ]);

    const contractStories = stories().map((story) => ({
      ...story,
      story_screens: null,
      implementation_contract: JSON.stringify({
        owned_screen_ids: story.story_id === "US-001" ? ["menu", "play"] : ["help"],
        owned_screen_files: story.story_id === "US-001" ? ["src/screens/Menu.tsx", "src/screens/Play.tsx"] : ["src/screens/Help.tsx"],
      }),
    }));

    const contract = buildRunContract({
      run: baseRun(repo),
      steps: steps() as any,
      stories: contractStories as any,
      now: "2026-05-17T00:00:00.000Z",
    });
    const storyPhase = contract.phases.find(p => p.id === "stories");
    const ownershipItem = storyPhase?.items.find(i => i.id === "stories.screen_ownership");

    assert.equal(ownershipItem?.status, "pass");
    assert.equal(ownershipItem?.evidence, "2 story screen map(s)");
    assert.deepEqual(contract.stories.find(s => s.storyId === "US-001")?.ownsScreens, ["Menu", "Play"]);
  });

  it("keeps implementation pending rather than failed when the loop is idle between story gates", () => {
    const repo = tempRepo("idle-loop");
    writeDesign(repo, [
      { screenId: "menu", name: "Main Menu" },
      { screenId: "play", name: "Game Board" },
      { screenId: "help", name: "Help" },
    ]);

    const contract = buildRunContract({
      run: baseRun(repo),
      steps: steps() as any,
      stories: stories() as any,
      now: "2026-05-17T00:00:00.000Z",
    });

    const implPhase = contract.phases.find(p => p.id === "implement");
    const currentStory = implPhase?.items.find(i => i.id === "impl.current_story");

    assert.equal(implPhase?.status, "pending");
    assert.equal(currentStory?.status, "pending");
    assert.equal(currentStory?.evidence, "loop idle between story gates");
    assert.equal(contract.progress.na, 0);
  });

  it("marks current story evidence passed once implementation is complete", () => {
    const repo = tempRepo("done-loop");
    writeDesign(repo, [
      { screenId: "menu", name: "Main Menu" },
      { screenId: "play", name: "Game Board" },
      { screenId: "help", name: "Help" },
    ]);
    const doneSteps = steps().map((step: any) => step.step_id === "implement" ? { ...step, status: "done" } : step);
    const doneStories = stories().map((story) => ({ ...story, status: "verified" }));

    const contract = buildRunContract({
      run: { ...baseRun(repo), status: "completed" },
      steps: doneSteps as any,
      stories: doneStories as any,
      now: "2026-05-17T00:00:00.000Z",
    });

    const currentStory = contract.phases.find(p => p.id === "implement")?.items.find(i => i.id === "impl.current_story");
    assert.equal(currentStory?.status, "pass");
    assert.equal(currentStory?.evidence, "implementation complete");
    assert.equal(contract.progress.na, 0);
  });

  it("fails missing design artifacts after the design step is complete", () => {
    const repo = tempRepo("missing-design");
    const contract = buildRunContract({
      run: baseRun(repo),
      steps: steps() as any,
      stories: stories() as any,
      now: "2026-05-17T00:00:00.000Z",
    });

    const designPhase = contract.phases.find(p => p.id === "design");
    assert.equal(designPhase?.status, "fail");
    assert.equal(designPhase?.items.find(i => i.id === "design.dom")?.status, "fail");
  });
});
