import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("project cleanup operations", () => {
  it("can resolve scoped project tool cwd on macOS without systemd cgroups", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "cleanup-ops.ts"), "utf-8");
    assert.match(source, /function readDarwinProcessCwd\(pid: number\): string \| undefined/);
    assert.match(source, /execFileSync\("lsof",\s*\["-a",\s*"-d",\s*"cwd",\s*"-p",\s*String\(pid\),\s*"-Fn"\]/);
    assert.match(source, /function processCwd\(row: ProcessRow\): string \| undefined/);
    assert.match(source, /process\.platform !== "darwin"/);
    assert.match(source, /if \(row\.cgroup && !isSetfarmOwnedProcess\(row\)\) return false;/);
    assert.match(source, /if \(parent\.cgroup && !isSetfarmOwnedProcess\(parent\)\) break;/);
  });

  it("uses story claimed_at before abandoning a running loop story", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "cleanup-ops.ts"), "utf-8");
    const loopStoryStart = source.indexOf('if (step.type === "loop" && step.current_story_id)');
    const singleStepStart = source.indexOf("// Single steps", loopStoryStart);
    assert.notEqual(loopStoryStart, -1, "loop story cleanup block not found");
    assert.notEqual(singleStepStart, -1, "single step cleanup marker not found");

    const block = source.slice(loopStoryStart, singleStepStart);
    const claimedAt = block.indexOf("const claimedAt = story.claimed_at || step.updated_at");
    const elapsed = block.indexOf("const storyElapsedMs = Date.now() - new Date(claimedAt as string).getTime()");
    const thresholdSkip = block.indexOf("if (storyElapsedMs < threshold) continue");
    const autosave = block.indexOf("autoSaveWorktree");
    const abandon = block.indexOf("UPDATE stories SET status = 'pending'");

    assert.ok(claimedAt >= 0, "story claimed_at fallback must be computed");
    assert.ok(elapsed > claimedAt, "story elapsed must be based on story claimed_at");
    assert.ok(thresholdSkip > elapsed, "fresh story claims must skip abandonment");
    assert.ok(thresholdSkip < autosave, "fresh story claims must not be auto-saved as abandoned");
    assert.ok(thresholdSkip < abandon, "fresh story claims must not be reset to pending");
    assert.match(block, /const durationMin = Math\.round\(storyElapsedMs \/ 60000\)/);
  });
});
