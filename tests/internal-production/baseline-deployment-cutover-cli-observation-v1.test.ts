import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

function fixture(body: (paths: { home: string; workspace: string; checkout: string; target: string; link: string }) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-cli-")));
  const workspace = path.join(home, "ai", "setrox"), checkout = path.join(workspace, "deployments", "new");
  const target = path.join(checkout, "dist", "cli", "cli.js"), link = path.join(home, ".local", "bin", "setfarm");
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
  fs.mkdirSync(path.dirname(link), { recursive: true, mode: 0o755 });
  fs.writeFileSync(target, "fixture cli\n", { mode: 0o644 }); fs.symlinkSync(target, link);
  try { body({ home, workspace, checkout, target, link }); }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function observe(home: string, fault = "", retryOnFailure = false): any {
  const moduleUrl = new URL("../../src/internal-production/baseline-deployment-cutover-cli-observation-v1.ts", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import os from "node:os";
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    const identity = os.userInfo(); os.userInfo = () => ({...identity, homedir:${JSON.stringify(home)}});
    let active = false, run; let inspect = () => null;
    ${fault}
    syncBuiltinESMExports();
    try {
      const module = await import(${JSON.stringify(moduleUrl)}); run = module.observeDeploymentCutoverCliLinkV1; active = true;
      const observation = run();
      process.stdout.write(JSON.stringify({observation, frozen:Object.isFrozen(observation) && Object.isFrozen(observation.ancestors)
        && observation.ancestors.every(entry => Object.isFrozen(entry) && Object.isFrozen(entry.identity))
        && Object.isFrozen(observation.linkIdentity) && Object.isFrozen(observation.targetIdentity), evidence:inspect()}));
    } catch (error) {
      let retryError = null;
      if (${retryOnFailure} && run) { try { run(); } catch (retry) { retryError = retry.message; } }
      process.stdout.write(JSON.stringify({error:error.message,retryError,evidence:inspect()}));
    }
  `], { encoding: "utf8", timeout: 10000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test("CLI observation accepts legitimate partial entry reads", () => fixture(({ home, checkout }) => {
  const result = observe(home, `const read=fs.readSync;fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,active?Math.min(length,3):length,position);`);
  assert.equal(result.observation?.checkoutPath, checkout, JSON.stringify(result));
  assert.equal(result.observation.targetBytesHash, createHash("sha256").update("fixture cli\n").digest("hex"));
}));

for (const style of ["absolute", "relative"]) {
  test(`${style} fixed CLI observation preserves link and target and returns a stable commitment`, () => fixture(({ home, checkout, target, link }) => {
    if (style === "relative") { fs.unlinkSync(link); fs.symlinkSync(path.relative(path.dirname(link), target), link); }
    const raw = fs.readlinkSync(link), before = fs.lstatSync(link, { bigint: true });
    const result = observe(home);
    assert.equal(result.observation?.checkoutPath, checkout, JSON.stringify(result));
    assert.equal(result.observation.cliLinkPath, link);
    assert.equal(result.observation.rawLinkTarget, raw);
    assert.equal(result.observation.targetPath, target);
    assert.equal(result.observation.targetBytesHash, createHash("sha256").update("fixture cli\n").digest("hex"));
    assert.equal(result.observation.linkIdentity.ino, String(before.ino));
    assert.equal(result.observation.targetIdentity.ino, String(fs.lstatSync(target, { bigint: true }).ino));
    assert.match(result.observation.cliLinkObservationHash, /^[a-f0-9]{64}$/);
    assert.equal(result.frozen, true);
    assert.equal(observe(home).observation.cliLinkObservationHash, result.observation.cliLinkObservationHash);
    assert.equal(fs.readlinkSync(link), raw);
    assert.equal(fs.lstatSync(link, { bigint: true }).ino, before.ino);
    assert.equal(fs.readFileSync(target, "utf8"), "fixture cli\n");
  }));
}

test("sibling-prefix target escape refuses before reading entry bytes", () => fixture(({ home, workspace, link }) => {
  const outside = path.join(`${workspace}-other`, "dist", "cli", "cli.js");
  fs.mkdirSync(path.dirname(outside), { recursive: true }); fs.writeFileSync(outside, "foreign cli\n");
  fs.unlinkSync(link); fs.symlinkSync(outside, link);
  const result = observe(home, `const read = fs.readSync; let reads = 0; fs.readSync = (...args) => { if (active) reads++; return read(...args); }; inspect = () => ({reads});`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID/);
  assert.deepEqual(result.evidence, { reads: 0 });
  assert.equal(fs.readlinkSync(link), outside);
  assert.equal(fs.readFileSync(outside, "utf8"), "foreign cli\n");
}));

for (const state of ["missing", "nonlink"]) {
  test(`${state} fixed CLI refuses without creating or replacing paths`, () => fixture(({ home, link }) => {
    fs.unlinkSync(link); if (state === "nonlink") fs.writeFileSync(link, "not a link\n");
    const names = fs.readdirSync(path.dirname(link));
    assert.match(observe(home).error, /DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID/);
    assert.deepEqual(fs.readdirSync(path.dirname(link)), names);
    if (state === "nonlink") assert.equal(fs.readFileSync(link, "utf8"), "not a link\n");
  }));
}

for (const state of ["target-symlink", "target-parent-symlink", "target-mode", "bin-mode", "hardlink", "empty", "oversized", "directory", "fifo"]) {
  test(`${state} refuses before entry reads and preserves physical state`, () => fixture(({ home, target, link }) => {
    const outside = path.join(home, "outside");
    if (state === "target-symlink") { fs.renameSync(target, outside); fs.symlinkSync(outside, target); }
    if (state === "target-parent-symlink") { fs.renameSync(path.dirname(target), outside); fs.symlinkSync(outside, path.dirname(target)); }
    if (state === "target-mode") fs.chmodSync(target, 0o666);
    if (state === "bin-mode") fs.chmodSync(path.dirname(link), 0o777);
    if (state === "hardlink") fs.linkSync(target, outside);
    if (state === "empty") fs.truncateSync(target, 0);
    if (state === "oversized") fs.truncateSync(target, 16 * 1024 * 1024 + 1);
    if (state === "directory" || state === "fifo") { fs.unlinkSync(target); if (state === "directory") fs.mkdirSync(target); else execFileSync("/usr/bin/mkfifo", [target]); }
    const before = fs.lstatSync(target, { bigint: true }), raw = fs.readlinkSync(link);
    const result = observe(home, `const read = fs.readSync; let reads = 0; fs.readSync = (...args) => { if (active) reads++; return read(...args); }; inspect = () => ({reads});`);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID/);
    assert.deepEqual(result.evidence, { reads: 0 });
    assert.equal(fs.lstatSync(target, { bigint: true }).ino, before.ino);
    assert.equal(fs.readlinkSync(link), raw);
  }));
}

for (const change of ["link", "target", "target-parent", "link-parent", "same-inode-bytes"]) {
  test(`${change} replacement during entry read refuses without repairing it`, () => fixture(({ home, target, link }) => {
    const outside = path.join(home, "retained");
    const result = observe(home, `
      const read = fs.readSync; let changed = false;
      fs.readSync = (...args) => {
        const value = read(...args);
        if (active && !changed) {
          changed = true; const change = ${JSON.stringify(change)}, target = ${JSON.stringify(target)}, link = ${JSON.stringify(link)}, outside = ${JSON.stringify(outside)};
          if (change === "link") { fs.renameSync(link, outside); fs.symlinkSync("../../different-target", link); }
          if (change === "target") { fs.renameSync(target, outside); fs.writeFileSync(target, "fixture cli\\n", {mode:0o644}); }
          if (change === "target-parent") { fs.renameSync(${JSON.stringify(path.dirname(target))}, outside); fs.mkdirSync(${JSON.stringify(path.dirname(target))}); fs.writeFileSync(target, "fixture cli\\n", {mode:0o644}); }
          if (change === "link-parent") { fs.renameSync(${JSON.stringify(path.dirname(link))}, outside); fs.mkdirSync(${JSON.stringify(path.dirname(link))}); fs.symlinkSync(target, link); }
          if (change === "same-inode-bytes") fs.writeFileSync(target, "changed cli\\n");
        }
        return value;
      };
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID/);
    if (change === "link") { assert.equal(fs.readlinkSync(link), "../../different-target"); assert.ok(fs.lstatSync(outside).isSymbolicLink()); }
    else if (change === "same-inode-bytes") assert.equal(fs.readFileSync(target, "utf8"), "changed cli\n");
    else { assert.ok(fs.existsSync(outside)); assert.equal(fs.readFileSync(target, "utf8"), "fixture cli\n"); }
  }));
}

test("uncertain observer close preserves a reused descriptor and refuses fresh observation", () => fixture(({ home }) => {
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "foreign descriptor\n");
  const result = observe(home, `
    const close = fs.closeSync; let failed = false, selected = null, attempts = 0;
    fs.closeSync = fd => {
      if (fd === selected) attempts++;
      if (active && !failed) {
        failed = true; selected = fd; attempts = 1; close(fd);
        if (fs.openSync(${JSON.stringify(sentinel)}, fs.constants.O_RDONLY) !== fd) throw Error("SENTINEL_NOT_REUSED");
        throw Error("CLOSE_RESPONSE_LOST");
      }
      return close(fd);
    };
    inspect = () => { let preserved = false; try { preserved = fs.fstatSync(selected).ino === fs.lstatSync(${JSON.stringify(sentinel)}).ino; } catch {} return {attempts,preserved}; };
  `, true);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID/);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID/);
  assert.deepEqual(result.evidence, {attempts:1,preserved:true});
}));
