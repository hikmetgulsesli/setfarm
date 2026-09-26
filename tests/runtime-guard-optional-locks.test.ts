import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const moduleUrl = new URL("../src/cli/runtime-guard.ts", import.meta.url).href;
const tsxLoader = import.meta.resolve("tsx");
const sha = "a".repeat(40);

function fixture(run: (root: string, bin: string, log: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-guard-optional-"));
  try {
    const bin = path.join(root, "bin");
    const log = path.join(root, "git-calls.log");
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, "dist"));
    fs.writeFileSync(path.join(root, "dist/BUILD_INFO.json"), JSON.stringify({
      sha, branch: "main", dirty: false, builtAt: "2026-09-26T00:00:00.000Z",
    }));
    fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh
if [ "$1" != "--no-optional-locks" ]; then exit 73; fi
shift
printf '%s\\n' "$1" >> "$FAKE_GIT_LOG"
case "$1" in
  branch) printf 'main\\n' ;;
  rev-parse) printf '${sha}\\n' ;;
  status) if [ "$FAKE_GIT_DIRTY" = 1 ]; then printf ' M src/file.ts\\n'; fi ;;
  *) exit 74 ;;
esac
`, { mode: 0o755 });
    run(root, bin, log);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function observe(root: string, bin: string, log: string, dirty: boolean) {
  const child = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e",
    `import {verifyRuntimeIntegrity} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(verifyRuntimeIntegrity()));`], {
    cwd: root, encoding: "utf8", timeout: 10_000,
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
      SETFARM_REPO_DIR: root, GIT_OPTIONAL_LOCKS: "1", FAKE_GIT_DIRTY: dirty ? "1" : "0",
      FAKE_GIT_LOG: log },
  });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout) as { ok: boolean; reason?: string; branch?: string; headSha?: string };
}

test("runtime guard reads branch, HEAD and clean status without optional Git locks", () => fixture((root, bin, log) => {
  const result = observe(root, bin, log, false);
  assert.equal(result.ok, true);
  assert.equal(result.branch, "main");
  assert.equal(result.headSha, sha);
  assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["branch", "rev-parse", "status"]);
}));

test("no-optional-locks mode still refuses a dirty source tree", () => fixture((root, bin, log) => {
  const result = observe(root, bin, log, true);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /uncommitted local changes/);
  assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["branch", "rev-parse", "status"]);
}));
