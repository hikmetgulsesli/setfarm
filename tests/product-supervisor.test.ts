import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

  it("persists supervisor memory in the project repo", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-supervisor-"));
    try {
      mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
      const context: Record<string, string> = { repo };
      updateSupervisorMemory(context, "### 2026-05-12T00:00:00.000Z plan pass\n- Code: PRODUCT_SUPERVISOR_OK\n");

      assert.equal(supervisorMemoryPath(context), path.join(repo, "SUPERVISOR_MEMORY.md"));
      assert.match(readSupervisorMemory(context), /PRODUCT_SUPERVISOR_OK/);
      assert.match(readFileSync(path.join(repo, ".git", "info", "exclude"), "utf-8"), /SUPERVISOR_MEMORY\.md/);
      assert.match(context.supervisor_memory, /PRODUCT_SUPERVISOR_OK/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

