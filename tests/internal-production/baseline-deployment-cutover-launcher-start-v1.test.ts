import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const source = fs.readFileSync(new URL("../../src/server/spawnerctl.ts", import.meta.url), "utf8");
const cliSource = fs.readFileSync(new URL("../../src/cli/cli.ts", import.meta.url), "utf8");
const pidExpression = 'path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid")';
const logExpression = 'path.join(os.homedir(), ".openclaw", "setfarm", "spawner.log")';
assert.equal(source.split(pidExpression).length, 2);
assert.equal(source.split(logExpression).length, 2);

test("every CLI spawner start precheck and restart stop observes cutover intent first", () => {
  assert.ok(/assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);\s*if \(!isSpawnerRunning\(\)\.running\)/.test(cliSource), "install precheck");
  assert.ok(/assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);\s*if \(process\.env\.SETFARM_DISABLE_SPAWNER_AUTOSTART !== "1" && !isSpawnerRunning\(\)\.running\)/.test(cliSource), "run precheck");
  assert.ok(/if \(sub === "restart"\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);\s*stopSpawner\(\)/.test(cliSource), "restart stop");
});

test("ordinary update, uninstall, install, run, resume and cron mutation entrypoints refuse before effects", () => {
  for (const [label, pattern] of [
    ["update", /if \(group === "update"\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);/],
    ["uninstall", /if \(group === "uninstall" && \(!args\[1\] \|\| args\[1\] === "--force"\)\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);/],
    ["global install", /if \(group === "install" && !args\[1\]\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);/],
    ["workflow install", /if \(action === "install"\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);\s*const result = await installWorkflow/],
    ["workflow uninstall", /if \(action === "uninstall"\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);\s*if \(!process\.stdin\.isTTY/],
    ["workflow resume", /if \(action === "resume"\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);/],
    ["ensure crons", /if \(action === "ensure-crons"\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);/],
    ["workflow run", /if \(action === "run"\) \{\s*assertOrdinarySpawnerDeploymentCutoverAdmissionV1\(\);\s*let notifyUrl/],
  ] as const) assert.ok(pattern.test(cliSource), label);
});

for (const mode of ["open", "absent"] as const) {
  test(`${mode} cutover intent controls launcher effects before stale PID handling`, () => {
    const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-spawnerctl-start-")));
    try {
      const server = path.join(fixture, "src/server");
      const internal = path.join(fixture, "src/internal-production");
      fs.mkdirSync(server, { recursive: true });
      fs.mkdirSync(internal, { recursive: true });
      fs.writeFileSync(path.join(fixture, "package.json"), '{"type":"module"}\n');
      const pidFile = path.join(fixture, "spawner.pid");
      const logFile = path.join(fixture, "spawner.log");
      fs.writeFileSync(pidFile, "not-a-pid\n");
      const before = fs.lstatSync(pidFile, { bigint: true });
      fs.writeFileSync(path.join(server, "spawnerctl.ts"), source
        .replace(pidExpression, JSON.stringify(pidFile))
        .replace(logExpression, JSON.stringify(logFile)));
      fs.writeFileSync(path.join(fixture, "src/runtime-config.ts"),
        'globalThis.effects.push("runtime-env-module");export function loadRuntimeEnv(){globalThis.effects.push("runtime-env-call");throw Error("RUNTIME_ENV_REACHED");}\n');
      fs.writeFileSync(path.join(internal, "baseline-deployment-cutover-v1.ts"),
        'export function assertOrdinarySpawnerDeploymentCutoverAdmissionV1(){globalThis.effects.push("cutover-check");if(globalThis.mode==="open")throw Error("DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");}\n');
      const runner = path.join(fixture, "runner.mjs");
      fs.writeFileSync(runner, `
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
globalThis.mode = ${JSON.stringify(mode)};
globalThis.effects = [];
childProcess.execFileSync = () => { globalThis.effects.push("ps"); return ""; };
childProcess.spawn = () => { globalThis.effects.push("spawn"); throw Error("SPAWN_REACHED"); };
syncBuiltinESMExports();
const module = await import(${JSON.stringify(pathToFileURL(path.join(server, "spawnerctl.ts")).href)});
let error = null;
try { await module.startSpawner(); } catch (cause) { error = cause.message; }
process.stdout.write(JSON.stringify({ error, effects: globalThis.effects }));
`);
      const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), runner],
        { encoding: "utf8", timeout: 15_000, env: {} });
      assert.equal(child.status, 0, child.stderr);
      const observed = JSON.parse(child.stdout);
      if (mode === "open") {
        assert.deepEqual(observed, { error: "DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED",
          effects: ["runtime-env-module", "cutover-check"] });
        const after = fs.lstatSync(pidFile, { bigint: true });
        assert.equal(after.ino, before.ino);
        assert.equal(after.birthtimeNs, before.birthtimeNs);
        assert.equal(fs.readFileSync(pidFile, "utf8"), "not-a-pid\n");
      } else {
        assert.deepEqual(observed, { error: "RUNTIME_ENV_REACHED",
          effects: ["runtime-env-module", "cutover-check", "ps", "runtime-env-call"] });
        assert.equal(fs.existsSync(pidFile), false);
      }
      assert.equal(fs.existsSync(logFile), false);
    } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
  });
}
