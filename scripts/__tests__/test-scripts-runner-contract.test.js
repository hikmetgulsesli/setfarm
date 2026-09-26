import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("test:scripts runs filesystem fixtures one test file at a time", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const [unitRunner, genuineRunner, extra] = packageJson.scripts["test:scripts"].split(" && ");
  assert.equal(genuineRunner, "npm run test:scripts:cutover-genuine");
  assert.equal(extra, undefined);
  assert.match(unitRunner, /scripts\/__tests__\/\*\.test\.js/);

  const directory = mkdtempSync(join(tmpdir(), "setfarm-script-runner-contract-"));
  try {
    const fixture = `import { closeSync, openSync, unlinkSync } from "node:fs";
import { test } from "node:test";
test("holds the exclusive fixture", async () => {
  const lock = process.env.SETFARM_SERIAL_PROBE_LOCK;
  const fd = openSync(lock, "wx", 0o600);
  try { await new Promise(resolve => setTimeout(resolve, 1200)); }
  finally { closeSync(fd); unlinkSync(lock); }
});\n`;
    const first = join(directory, "first.test.mjs");
    const second = join(directory, "second.test.mjs");
    writeFileSync(first, fixture, { mode: 0o600 });
    writeFileSync(second, fixture, { mode: 0o600 });
    const command = unitRunner.replace("scripts/__tests__/*.test.js", `${first} ${second}`);
    const result = spawnSync("/bin/zsh", ["-c", command], {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", SETFARM_SERIAL_PROBE_LOCK: join(directory, "exclusive.lock") },
      timeout: 10000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /pass 2/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
