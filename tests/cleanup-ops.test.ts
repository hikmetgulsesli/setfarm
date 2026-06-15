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
});
