import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  readSupervisorMemory,
  runProductSupervisorGate,
  supervisorMemoryPath,
  updateSupervisorMemory,
} from "../dist/installer/product-supervisor.js";

describe("product supervisor", () => {
  it("blocks untraceable PRD screens before they become implementation stories", () => {
    const task = "Project: brick-arcade-0512 Build a browser arcade game with brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.";
    const prd = [
      "# Brick Arcade PRD",
      "The game includes brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.",
      "Do not add profile/account panels unless the user asks for account features.",
      "## Screens",
      "| # | Screen Name | Type | Description |",
      "|---|-----------|-----|----------|",
      "| 1 | Game Board | play | Main playable game board |",
      "| 2 | Next Piece Preview | panel | Preview the next falling piece |",
      "| 3 | Game Over | result | Final score and restart |",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd, prd_screen_count: "3" },
      context: { task },
    });

    assert.equal(result.ok, false);
    assert.match(result.reason, /PLAN_SCREEN_DRIFT/);
    assert.match(result.reason, /Next Piece Preview/);
  });

  it("passes a traceable generic plan contract", () => {
    const task = "Project: brick-arcade-0512 Build a browser arcade game with brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.";
    const prd = [
      "# Brick Arcade PRD",
      "The game includes brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.",
      "## Screens",
      "| # | Screen Name | Type | Description |",
      "|---|-----------|-----|----------|",
      "| 1 | Game Board | play | Main playable brick grid and paddle scene |",
      "| 2 | Controls Help | help | Keyboard controls and game rules |",
      "| 3 | Game Over | result | Final score, lives summary, and restart |",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd, prd_screen_count: "3" },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("does not reject common game state screens when the task asks for a game", () => {
    const task = "Project: falling-blocks Build a browser game with keyboard controls, score, levels, pause, restart, and responsive layout.";
    const prd = [
      "# Falling Blocks PRD",
      "The game includes keyboard controls, score, levels, pause, restart, and responsive layout.",
      "## Screens",
      "| # | Screen Name | Type | Description |",
      "|---|-----------|-----|----------|",
      "| 1 | Game Board | play | Main playable game board |",
      "| 2 | Game Over | result | Final score and restart |",
      "| 3 | Controls Help | help | Keyboard controls and rules |",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd, prd_screen_count: "3" },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("blocks design SCREEN_MAP drift against the PRD screen contract", () => {
    const prd = [
      "# Brick Arcade PRD",
      "## Screens",
      "| # | Screen Name | Type | Description |",
      "|---|-----------|-----|----------|",
      "| 1 | Game Board | play | Main playable brick grid and paddle scene |",
      "| 2 | Main Menu | menu | Start and resume actions |",
      "| 3 | Game Over | result | Final score and restart |",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "design",
      runId: "run-1",
      stepId: "design",
      parsed: {
        status: "done",
        screen_map: JSON.stringify([
          { screenId: "a", name: "Game Board", type: "play", description: "" },
          { screenId: "b", name: "Game Board", type: "play", description: "" },
          { screenId: "c", name: "Leaderboard", type: "result", description: "" },
          { screenId: "d", name: "Controls Help", type: "help", description: "" },
        ]),
      },
      context: { prd },
    });

    assert.equal(result.ok, false);
    assert.match(result.reason, /DESIGN_SCREEN_COUNT_DRIFT/);
    assert.match(result.reason, /DESIGN_SCREEN_DUPLICATE/);
    assert.match(result.reason, /DESIGN_SCREEN_EXTRA/);
    assert.match(result.reason, /DESIGN_SCREEN_MISSING/);
  });

  it("accepts qualified Stitch screen titles that still map to PRD screens", () => {
    const prd = [
      "# Snake PRD",
      "## Screens",
      "| # | Screen Name | Type | Description |",
      "|---|-----------|-----|----------|",
      "| 1 | Game Board | play | Main playable grid and controls |",
      "| 2 | Game Options | settings | Speed and control preferences |",
      "| 3 | Game Over | result | Final score and restart |",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "design",
      runId: "run-1",
      stepId: "design",
      parsed: {
        status: "done",
        screen_map: JSON.stringify([
          { screenId: "a", name: "Game Board - Play State", type: "play", description: "" },
          { screenId: "b", name: "Game Options & Settings", type: "settings", description: "" },
          { screenId: "c", name: "Game Over Summary", type: "result", description: "" },
        ]),
      },
      context: { prd },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("does not treat implementation planning vocabulary as story domain drift", () => {
    const source = [
      "Project: brick-arcade-0512 Build a browser arcade game with brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.",
      "Game Board Main Menu Pause Overlay Game Over Progress Complete Controls Help",
    ].join(" ");

    const result = runProductSupervisorGate({
      phase: "stories",
      runId: "run-1",
      stepId: "stories",
      task: source,
      context: { task: source, prd: source, screen_map: "[]" },
      stories: [
        {
          story_id: "US-001",
          story_index: 1,
          title: "Game Board shell and shared engine bridge wiring",
          description: "Wire the declared DOM shell to the owned game board screen without broader scope changes, helper boundaries, and sibling file groups.",
          acceptance_criteria: JSON.stringify(["Game Board renders", "Paddle and ball state are visible"]),
        },
      ],
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("still blocks a story that introduces an unrelated product concept", () => {
    const source = "Project: brick-arcade-0512 Build a browser arcade game with brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.";
    const result = runProductSupervisorGate({
      phase: "stories",
      runId: "run-1",
      stepId: "stories",
      task: source,
      context: { task: source, prd: source, screen_map: "[]" },
      stories: [
        {
          story_id: "US-001",
          story_index: 1,
          title: "Next Piece Preview Queue",
          description: "Show falling tetromino preview pieces.",
          acceptance_criteria: JSON.stringify(["Preview appears"]),
        },
      ],
    });

    assert.equal(result.ok, false);
    assert.match(result.reason, /STORY_DOMAIN_DRIFT/);
  });

  it("persists supervisor memory under ignored platform metadata", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-"));
    try {
      mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
      const context: Record<string, string> = { repo };
      updateSupervisorMemory(context, "### 2026-05-12T00:00:00.000Z plan pass\n- Code: PRODUCT_SUPERVISOR_OK\n");

      assert.equal(supervisorMemoryPath(context), path.join(repo, ".setfarm", "SUPERVISOR_MEMORY.md"));
      assert.match(readSupervisorMemory(context), /PRODUCT_SUPERVISOR_OK/);
      assert.match(readFileSync(path.join(repo, ".git", "info", "exclude"), "utf-8"), /\.setfarm\//);
      assert.match(context.supervisor_memory, /PRODUCT_SUPERVISOR_OK/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps supervisor memory in run context before the repo exists", () => {
    const root = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-missing-"));
    const repo = path.join(root, "future-repo");
    try {
      const context: Record<string, string> = { repo };
      updateSupervisorMemory(context, "### 2026-05-12T00:00:00.000Z plan pass\n- Code: PRODUCT_SUPERVISOR_OK\n");
      assert.match(context.supervisor_memory, /plan pass/);

      mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
      updateSupervisorMemory(context, "### 2026-05-12T00:01:00.000Z design pass\n- Code: PRODUCT_SUPERVISOR_OK\n");
      const persisted = readFileSync(path.join(repo, ".setfarm", "SUPERVISOR_MEMORY.md"), "utf-8");
      assert.match(persisted, /plan pass/);
      assert.match(persisted, /design pass/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("can read legacy root supervisor memory without writing new updates there", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-legacy-"));
    try {
      mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
      writeFileSync(path.join(repo, "SUPERVISOR_MEMORY.md"), "# Supervisor Memory\n\nlegacy\n");
      const context: Record<string, string> = { repo };

      assert.match(readSupervisorMemory(context), /legacy/);
      updateSupervisorMemory(context, "### 2026-05-12T00:00:00.000Z plan pass\n- Code: PRODUCT_SUPERVISOR_OK\n");

      const legacy = readFileSync(path.join(repo, "SUPERVISOR_MEMORY.md"), "utf-8");
      const current = readFileSync(path.join(repo, ".setfarm", "SUPERVISOR_MEMORY.md"), "utf-8");
      assert.match(legacy, /^# Supervisor Memory\n\nlegacy\n$/);
      assert.match(current, /PRODUCT_SUPERVISOR_OK/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("blocks implement completion with dead controls and malformed URLs in the story diff", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-implement-"));
    try {
      mkdirSync(path.join(repo, "src"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "src", "App.tsx"), "export default function App() { return <main />; }\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "src", "App.tsx"),
        [
          "export default function App() {",
          "  return <main>",
          "    <button>Start</button>",
          "    <a href=\"#\">Dead hash</a>",
          "    <a href=\"https://https//example.test\">Broken</a>",
          "  </main>;",
          "}",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Wire controls" },
        rawOutput: "STATUS: done\nCHANGES: wired controls",
      });

      assert.equal(result.ok, false);
      assert.match(result.reason, /IMPLEMENT_INTERACTION_CONTRACT/);
      assert.match(result.reason, /active <button>/);
      assert.match(result.reason, /active link uses a dead href/);
      assert.match(result.reason, /malformed URL/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("does not block implement completion when placeholder wording is reported as fixed", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-placeholder-fixed-"));
    try {
      mkdirSync(path.join(repo, "src"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "src", "App.tsx"), "export default function App() { return <main />; }\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "src", "App.tsx"),
        [
          "export default function App() {",
          "  return <main>",
          "    <button type=\"button\" onClick={() => {}}>Start</button>",
          "  </main>;",
          "}",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Remove stale placeholder copy" },
        rawOutput: [
          "STATUS: done",
          "summary: Replaced static placeholder display values with real game state.",
          "blocker_fixed: guardrail no longer finds placeholder or unfinished text in scoped files.",
        ].join("\n"),
      });

      assert.equal(result.ok, true, result.reason);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("still blocks implement completion when placeholder wording is unresolved", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-placeholder-unresolved-"));
    try {
      mkdirSync(path.join(repo, "src"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "src", "App.tsx"), "export default function App() { return <main />; }\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });
      writeFileSync(path.join(repo, "src", "App.tsx"), "export default function App() { return <main>Ready</main>; }\n");

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Report unresolved placeholder" },
        rawOutput: "STATUS: done\nremaining: placeholder copy still needs work",
      });

      assert.equal(result.ok, false);
      assert.match(result.reason, /IMPLEMENT_PLACEHOLDER/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("allows explicitly inert hash anchors without treating them as active dead links", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-inert-anchor-"));
    try {
      mkdirSync(path.join(repo, "src"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "src", "App.tsx"), "export default function App() { return <main />; }\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "src", "App.tsx"),
        [
          "export default function App() {",
          "  return <nav>",
          "    <a href=\"#\" aria-current=\"page\">Terminal</a>",
          "    <a href=\"#\" aria-disabled=\"true\" tabIndex={-1}>Records</a>",
          "    <button type=\"button\" onClick={() => {}}>Start</button>",
          "  </nav>;",
          "}",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Wire inert anchors" },
        rawOutput: "STATUS: done\nCHANGES: preserved current and disabled anchors",
      });

      assert.equal(result.ok, true, result.reason);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("allows hash anchors with explicit handlers without treating them as dead links", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-handled-anchor-"));
    try {
      mkdirSync(path.join(repo, "src"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "src", "App.tsx"), "export default function App() { return <main />; }\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "src", "App.tsx"),
        [
          "export default function App({ actions }: any) {",
          "  return <nav>",
          "    <a href=\"#\" data-action-id=\"game-1\" onClick={actions?.[\"game-1\"]}>GAME</a>",
          "    <button type=\"button\" onClick={() => {}}>Start</button>",
          "  </nav>;",
          "}",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Wire handled anchors" },
        rawOutput: "STATUS: done\nCHANGES: wired hash anchors through action handlers",
      });

      assert.equal(result.ok, true, result.reason);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
