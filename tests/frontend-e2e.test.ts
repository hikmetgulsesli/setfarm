import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { computeHasFrontendChanges, resolveTemplate } from "../dist/installer/step-ops.js";

/**
 * Regression test for frontend change detection in the verify flow.
 *
 * Creates a real git repo with controlled diffs and verifies the same
 * has_frontend_changes context value that claimStep injects before resolving
 * verify templates. This stays DB-free so it works with the PG-only runtime.
 */

const VERIFY_TEMPLATE = `Verify the implementation.

## Visual Verification (Frontend Changes)
Has frontend changes: {{has_frontend_changes}}

If {{has_frontend_changes}} is 'true', you MUST also perform visual verification:
1. Use the agent-browser skill to visually inspect the changed UI

If {{has_frontend_changes}} is 'false', skip visual verification entirely.`;

describe("Verify template frontend change detection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-e2e-"));
    // Create a real git repo with a main branch
    execSync("git init && git checkout -b main", { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# test");
    execSync("git add . && git commit -m 'init'", { cwd: tmpDir });
  });

  afterEach(() => {
    // Clean up git repo
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function resolveVerifyInput(repo?: string, branch?: string): string {
    const context: Record<string, string> = {};
    if (repo) context.repo = repo;
    if (branch) context.branch = branch;
    context.has_frontend_changes = repo && branch ? computeHasFrontendChanges(repo, branch) : "false";
    return resolveTemplate(VERIFY_TEMPLATE, context);
  }

  it("includes browser verification instructions when branch has frontend changes", () => {
    // Create branch with frontend file
    execSync("git checkout -b feat-frontend-ui", { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "index.html"), "<html><body>Hello</body></html>");
    execSync("git add . && git commit -m 'add html'", { cwd: tmpDir });

    const result = resolveVerifyInput(tmpDir, "feat-frontend-ui");

    assert.ok(
      result.includes("Has frontend changes: true"),
      "Should indicate frontend changes are true"
    );
    assert.ok(
      result.includes("agent-browser"),
      "Should include browser verification instructions"
    );
    assert.ok(
      result.includes("MUST also perform visual verification"),
      "Should include MUST directive for visual verification"
    );
  });

  it("excludes browser verification when branch has only backend changes", () => {
    // Create branch with only backend files
    execSync("git checkout -b feat-backend-only", { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "server.ts"), "export const x = 1;");
    fs.writeFileSync(path.join(tmpDir, "utils.py"), "def hello(): pass");
    execSync("git add . && git commit -m 'add backend'", { cwd: tmpDir });

    const result = resolveVerifyInput(tmpDir, "feat-backend-only");

    assert.ok(
      result.includes("Has frontend changes: false"),
      "Should indicate frontend changes are false"
    );
    assert.ok(
      result.includes("skip visual verification entirely"),
      "Should include skip instruction"
    );
  });

  it("uses mock git diff (real repo, controlled files) — no external repo needed", () => {
    // This test verifies we're using a temp git repo, not a real project repo
    // The beforeEach creates a fresh git repo in tmpDir
    assert.ok(fs.existsSync(path.join(tmpDir, ".git")), "Should have a .git directory");

    execSync("git checkout -b feat-css-change", { cwd: tmpDir });
    fs.mkdirSync(path.join(tmpDir, "styles"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "styles", "app.css"), "body { margin: 0; }");
    execSync("git add . && git commit -m 'add css'", { cwd: tmpDir });

    const result = resolveVerifyInput(tmpDir, "feat-css-change");

    assert.ok(result.includes("Has frontend changes: true"));
  });

  it("sets has_frontend_changes to false when context has no repo/branch", () => {
    const result = resolveVerifyInput();

    assert.ok(result.includes("Has frontend changes: false"));
  });
});
