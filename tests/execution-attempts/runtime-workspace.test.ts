import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  prepareAttemptRuntimeWorkspace,
  removeAttemptRuntimeWorkspace,
  runtimeWorkspacePath,
} from "../../src/execution/attempt-runtime-workspace.js";

describe("attempt-scoped runtime workspace", () => {
  it("keeps OpenClaw bootstrap state outside the generated story worktree", async () => {
    const temp = await mkdtemp(path.join(tmpdir(), "setfarm-runtime-workspace-"));
    const root = path.join(temp, "runtime");
    const project = path.join(temp, "story-worktree");
    try {
      const prepared = await prepareAttemptRuntimeWorkspace({
        root,
        runtimeId: "ATT_runtime-workspace-0001",
        projectWorktree: project,
      });
      assert.equal(prepared.path, path.join(root, "ATT_runtime-workspace-0001"));
      assert.notEqual(prepared.path, project);
      assert.equal(path.relative(project, prepared.path).startsWith(".."), true);
      const marker = JSON.parse(await readFile(prepared.markerPath, "utf8"));
      assert.deepEqual(marker, {
        schema: "setfarm.attempt-runtime-workspace.v1",
        runtimeId: "ATT_runtime-workspace-0001",
        projectWorktree: project,
      });
      assert.equal(removeAttemptRuntimeWorkspace({
        root,
        runtimeId: "ATT_runtime-workspace-0001",
      }), true);
      assert.equal(removeAttemptRuntimeWorkspace({
        root,
        runtimeId: "ATT_runtime-workspace-0001",
      }), false);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("rejects traversal and never aliases the product worktree", () => {
    assert.throws(() => runtimeWorkspacePath("/tmp/runtime", "../story"), /RUNTIME_WORKSPACE_ID_INVALID/);
    assert.throws(() => runtimeWorkspacePath("/tmp/runtime", "a/b"), /RUNTIME_WORKSPACE_ID_INVALID/);
  });

  it("refuses to remove an unmarked directory", async () => {
    const temp = await mkdtemp(path.join(tmpdir(), "setfarm-runtime-workspace-unmarked-"));
    try {
      await mkdir(path.join(temp, "ATT_unmarked-workspace-01"));
      await assert.rejects(
        async () => removeAttemptRuntimeWorkspace({ root: temp, runtimeId: "ATT_unmarked-workspace-01" }),
        /RUNTIME_WORKSPACE_MARKER_MISSING/,
      );
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
