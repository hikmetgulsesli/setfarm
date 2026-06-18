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
  it("blocks legacy PRD screen tables before they become implementation stories", () => {
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
    assert.match(result.reason, /PLAN_SCREEN_TABLE_FORBIDDEN/);
  });

  it("passes a traceable Product Surface plan contract", () => {
    const task = "Project: brick-arcade-0512 Build a browser arcade game with brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.";
    const prd = [
      "# Brick Arcade PRD",
      "The game includes brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_GAMEPLAY",
      "- Name: Gameplay",
      "- Purpose: Main playable brick grid, paddle controls, ball physics, score, lives, pause, restart, and game over.",
      "- Permitted Actions: ACT_START_GAME (control_hint: primary_button), ACT_PAUSE_GAME (control_hint: keyboard_shortcut)",
      "### SURFACE: SURF_HELP",
      "- Name: Controls Help",
      "- Purpose: Keyboard controls and concise game rules.",
      "- Permitted Actions: ACT_RETURN_TO_GAMEPLAY (control_hint: secondary_button)",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("does not reject common game state surfaces when the task asks for a game", () => {
    const task = "Project: falling-blocks Build a browser game with keyboard controls, score, levels, pause, restart, and responsive layout.";
    const prd = [
      "# Falling Blocks PRD",
      "The game includes keyboard controls, score, levels, pause, restart, and responsive layout.",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_GAMEPLAY",
      "- Name: Game Board",
      "- Purpose: Main playable game board with keyboard controls, score, levels, pause, restart, and responsive layout.",
      "- Permitted Actions: ACT_START_GAME (control_hint: primary_button), ACT_RESTART_GAME (control_hint: secondary_button)",
      "### SURFACE: SURF_HELP",
      "- Name: Controls Help",
      "- Purpose: Keyboard controls and rules.",
      "- Permitted Actions: ACT_RETURN_TO_GAMEPLAY (control_hint: secondary_button)",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("allows generic workspace and editor surface labels when the surface contract is task-traceable", () => {
    const task = "Build a compact browser service desk app called SurfaceCheck Desk. It should manage tickets, queues, agents, SLA status, insights, settings, empty and error states.";
    const prd = [
      "# SurfaceCheck Desk PRD",
      "The product manages tickets, queues, agents, SLA status, insights, settings, empty and error states.",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_WORKSPACE",
      "- Name: Workspace",
      "- Purpose: Main ticket queue workspace for tickets, queues, agents, SLA status, insights, settings, empty and error states.",
      "- Permitted Actions: ACT_SEARCH_RECORDS (control_hint: search_input_persistent), ACT_CREATE_RECORD (control_hint: primary_button)",
      "### SURFACE: SURF_RECORD_EDITOR",
      "- Name: Record Editor",
      "- Purpose: Create, update, and validate ticket records while preserving queue, agent, SLA, empty, and error context.",
      "- Permitted Actions: ACT_SAVE_RECORD (control_hint: form_submit)",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("allows generic operations pipeline surface labels for recovery dashboards", () => {
    const task = "Build a compact recovery operations board. It should track failed jobs, supervisor retries, recoverable UI issues, final pass/fail status, editable job cards, retry notes, status filters, persistent local state, and visible error recovery states.";
    const prd = [
      "# Recovery Operations PRD",
      "The product tracks failed jobs, supervisor retries, recoverable UI issues, final pass/fail status, editable job cards, retry notes, status filters, persistent local state, and visible error recovery states.",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_PIPELINE_BOARD",
      "- Name: Pipeline Board",
      "- Purpose: Track failed jobs, supervisor retries, recoverable UI issues, and final pass/fail status.",
      "- Permitted Actions: ACT_FILTER_STATUS (control_hint: segmented_control), ACT_SELECT_JOB (control_hint: list_item)",
      "### SURFACE: SURF_JOB_EDITOR",
      "- Name: Job Editor",
      "- Purpose: Edit job cards and retry notes while preserving visible error recovery states.",
      "- Permitted Actions: ACT_SAVE_JOB (control_hint: form_submit)",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("allows generic item surface labels when the purpose preserves the requested domain", () => {
    const task = "Build a compact browser warehouse maintenance command center app called WarehouseOps Console. It should manage equipment work orders, technician dispatch, live queue status, exception insights, reports, settings, help, and logout.";
    const prd = [
      "# WarehouseOps Console PRD",
      "The product manages equipment work orders, technician dispatch, live queue status, exception insights, reports, settings, help, and logout.",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_ITEM_OPERATIONS",
      "- Name: Item Operations",
      "- Purpose: Manage equipment work orders, technician dispatch, live queue status, exception insights, reports, settings, help, and logout.",
      "### SURFACE: SURF_ITEM_EDITOR",
      "- Name: Item Editor",
      "- Purpose: Create and update equipment work orders while preserving technician dispatch and live queue context.",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("allows requested singular/plural service desk surfaces and ignores negative profile anti-goals", () => {
    const task = "Build a compact browser service desk app called SurfaceGate Desk. It should manage tickets, queues, agents, SLA status, insights, settings, empty and error states.";
    const prd = [
      "# SurfaceGate Desk PRD",
      "The product manages tickets, queues, agents, SLA status, insights, settings, empty and error states.",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_TICKET_OPERATIONS",
      "- Name: Ticket Operations",
      "- Purpose: Give the user the main operational view for tickets, queues, agents, SLA status, insights, settings, empty and error states.",
      "- Design Guidance: Dense product UI; avoid unrelated admin/reporting modules.",
      "### SURFACE: SURF_QUEUE_AND_STATUS_MANAGEMENT",
      "- Name: Queue and Status Management",
      "- Purpose: Help users organize ticket work by queue, status, SLA, stage, priority, or triage context.",
      "### SURFACE: SURF_AGENT_WORKLOAD",
      "- Name: Agent Workload",
      "- Purpose: Show how ticket work is assigned or blocked across requested agents.",
      "- Design Guidance: Make ownership scannable without creating a separate HR or account-management module.",
      "### SURFACE: SURF_SETTINGS_AND_PREFERENCES",
      "- Name: Settings and Preferences",
      "- Purpose: Let users adjust workflow preferences requested by the task.",
      "- Design Guidance: Do not invent unrelated profile or billing areas.",
    ].join("\n");

    const result = runProductSupervisorGate({
      phase: "plan",
      runId: "run-1",
      stepId: "plan",
      task,
      parsed: { status: "done", prd },
      context: { task },
    });

    assert.equal(result.ok, true, result.reason);
  });

  it("blocks design SCREEN_MAP drift against the Product Surface contract", () => {
    const prd = [
      "# Brick Arcade PRD",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_GAMEPLAY",
      "- Name: Game Board",
      "- Purpose: Main playable brick grid and paddle scene.",
      "- Permitted Actions: ACT_START_GAME (control_hint: primary_button)",
      "### SURFACE: SURF_RESULTS",
      "- Name: Game Over",
      "- Purpose: Final score and restart.",
      "- Permitted Actions: ACT_RESTART_GAME (control_hint: secondary_button)",
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
    assert.match(result.reason, /DESIGN_SCREEN_DUPLICATE/);
    assert.match(result.reason, /DESIGN_SURFACE_MISMATCH/);
  });

  it("accepts qualified Stitch screen titles that still map to Product Surfaces", () => {
    const prd = [
      "# Snake PRD",
      "## 4. Product Surfaces",
      "### SURFACE: SURF_GAMEPLAY",
      "- Name: Game Board",
      "- Purpose: Main playable grid and controls.",
      "- Permitted Actions: ACT_START_GAME (control_hint: primary_button)",
      "### SURFACE: SURF_OPTIONS",
      "- Name: Game Options",
      "- Purpose: Speed and control preferences.",
      "- Permitted Actions: ACT_SAVE_PREFERENCES (control_hint: form_submit)",
      "### SURFACE: SURF_RESULTS",
      "- Name: Game Over",
      "- Purpose: Final score and restart.",
      "- Permitted Actions: ACT_RESTART_GAME (control_hint: secondary_button)",
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

  it("allows static html lowercase handlers on multiline controls", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-static-handlers-"));
    try {
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "index.html"), "<main></main>\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "index.html"),
        [
          "<main>",
          "  <button",
          "    type=\"button\"",
          "    data-action-id=\"ACT_NAV_RECORDS\"",
          "    onclick=\"window.app.actions.navigate('records')\"",
          "  >Records</button>",
          "  <input",
          "    type=\"text\"",
          "    data-action-id=\"ACT_SEARCH_RECORDS\"",
          "    oninput=\"window.app.actions.setSearch(this.value)\"",
          "  />",
          "  <label>",
          "    <input",
          "      type=\"checkbox\"",
          "      onchange=\"window.app.actions.savePreferences({ notifications: this.checked })\"",
          "    />",
          "    Notifications",
          "  </label>",
          "</main>",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Wire static controls" },
        rawOutput: "STATUS: done\nCHANGES: wired static html controls",
      });

      assert.equal(result.ok, true, result.reason);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("allows static html data-action-id controls wired by delegated listeners", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-delegated-actions-"));
    try {
      mkdirSync(path.join(repo, "assets/js"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "index.html"), "<main></main>\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "index.html"),
        [
          "<main>",
          "  <button type=\"button\" data-action-id=\"ACT_NAV_RECORDS\">Records</button>",
          "  <button type=\"button\" data-action-id=\"ACT_CREATE_RECORD\">Create Record</button>",
          "  <a href=\"#\" data-action-id=\"ACT_OPEN_DETAILS\">Details</a>",
          "  <script src=\"assets/js/app.js\"></script>",
          "</main>",
          "",
        ].join("\n"),
      );
      writeFileSync(
        path.join(repo, "assets/js", "app.js"),
        [
          "document.addEventListener('click', (event) => {",
          "  const target = event.target.closest('[data-action-id]');",
          "  if (!target) return;",
          "  const actionId = target.getAttribute('data-action-id');",
          "  window.app.actions[actionId]?.();",
          "});",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Wire delegated static controls" },
        rawOutput: "STATUS: done\nCHANGES: wired delegated static controls",
      });

      assert.equal(result.ok, true, result.reason);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("allows changed static html controls wired by existing script delegation", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-existing-static-delegation-"));
    try {
      mkdirSync(path.join(repo, "assets/js"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(
        path.join(repo, "index.html"),
        [
          "<main>",
          "  <script src=\"assets/js/app-state.js\" defer></script>",
          "</main>",
          "",
        ].join("\n"),
      );
      writeFileSync(
        path.join(repo, "assets/js", "app-state.js"),
        [
          "document.body.addEventListener('click', (event) => {",
          "  const target = event.target.closest('[data-action-id]');",
          "  if (!target) return;",
          "  const actionId = target.getAttribute('data-action-id');",
          "  window.app.actions[actionId]?.();",
          "});",
          "",
        ].join("\n"),
      );
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "index.html"),
        [
          "<main>",
          "  <button data-action-id=\"ACT_NAV_RECORDS\">Records</button>",
          "  <button data-action-id=\"ACT_CREATE_RECORD\">Create Record</button>",
          "  <a href=\"#\" data-action-id=\"ACT_OPEN_DETAILS\">Details</a>",
          "  <script src=\"assets/js/app-state.js\" defer></script>",
          "</main>",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-001", title: "Wire existing static delegated controls" },
        rawOutput: "STATUS: done\nCHANGES: wired static html controls through existing delegated runtime",
      });

      assert.equal(result.ok, true, result.reason);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("allows static html data-action-id controls wired by direct action modules", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-direct-action-modules-"));
    try {
      mkdirSync(path.join(repo, "assets", "js", "us-002"), { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "setfarm@example.test"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      writeFileSync(path.join(repo, "index.html"), "<main></main>\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "base"], { cwd: repo, stdio: "ignore" });

      writeFileSync(
        path.join(repo, "index.html"),
        [
          "<main>",
          "  <button type=\"button\" data-action-id=\"ACT_CREATE_RECORD\">Create Record</button>",
          "  <button type=\"button\" data-action-id=\"ACT_RETRY_LOAD\">Retry Load</button>",
          "  <script src=\"assets/js/us-002/act_create_record.js\" defer></script>",
          "  <script src=\"assets/js/us-002/act_retry_load.js\" defer></script>",
          "</main>",
          "",
        ].join("\n"),
      );
      writeFileSync(
        path.join(repo, "assets", "js", "us-002", "act_create_record.js"),
        [
          "window.NotePulseReady.then(function (store) {",
          "  var button = document.querySelector('[data-action-id=\"ACT_CREATE_RECORD\"]');",
          "  if (!button) return;",
          "  button.addEventListener('click', function () { store.createRecord(); });",
          "});",
          "",
        ].join("\n"),
      );
      writeFileSync(
        path.join(repo, "assets", "js", "us-002", "act_retry_load.js"),
        [
          "window.NotePulseReady.then(function (store) {",
          "  var button = document.querySelector(\"[data-action-id=\\\"ACT_RETRY_LOAD\\\"]\");",
          "  if (!button) return;",
          "  button.addEventListener('click', function () { store.retryLoad(); });",
          "});",
          "",
        ].join("\n"),
      );

      const result = runProductSupervisorGate({
        phase: "implement",
        runId: "run-1",
        stepId: "implement",
        workdir: repo,
        baseRef: "HEAD",
        currentStory: { story_id: "US-002", title: "Wire static action modules" },
        rawOutput: "STATUS: done\nCHANGES: wired direct static action modules",
      });

      assert.equal(result.ok, true, result.reason);
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

  it("allows neutral implement output that mentions preserving a generated placeholder attribute", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-placeholder-neutral-"));
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
        currentStory: { story_id: "US-001", title: "Report neutral placeholder mention" },
        rawOutput: "STATUS: done\nCHANGES: Added an accessible label while preserving the generated layout and placeholder. Verified build and tests.",
      });

      assert.equal(result.ok, true);
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
