import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// Explicitly opt-in, disposable macOS identity rehearsal. It does not run
// against a live worktree, selected CLI, service, role or credential.
const enabled = process.env.SETFARM_TASK6A_TEST_OS_IDENTITY_FIXTURE === "1";
const WRITE_PROBE = `const fs = require('node:fs');
  try {
    fs.writeFileSync(process.argv[1], 'probe\\n', { flag: process.argv[2] });
    process.exit(0);
  } catch (error) {
    process.exit(error.code === 'EACCES' || error.code === 'EPERM' ? 42 : 43);
  }`;
const PARENT_WRITE_PROBE = `const fs = require('node:fs');
  try {
    fs.accessSync(process.argv[1], fs.constants.W_OK);
    process.exit(0);
  } catch (error) {
    process.exit(error.code === 'EACCES' || error.code === 'EPERM' ? 42 : 43);
  }`;

function sudoResult(args: string[]): Readonly<{ status: number | null; stdout: string }> {
  const result = spawnSync("/usr/bin/sudo", ["-n", ...args], {
    encoding: "utf8", timeout: 10_000, maxBuffer: 4096,
  });
  assert.equal(result.error, undefined, "TASK6A_PRIVATE_OS_SUDO_EXEC_FAILED");
  return Object.freeze({ status: result.status, stdout: result.stdout });
}

function sudo(args: string[]): number | null { return sudoResult(args).status; }

function uid(user: string): number {
  const result = spawnSync("/usr/bin/id", ["-u", user], {
    encoding: "utf8", timeout: 10_000, maxBuffer: 4096,
  });
  assert.equal(result.error, undefined, "TASK6A_PRIVATE_OS_ID_EXEC_FAILED");
  assert.equal(result.status, 0, "TASK6A_PRIVATE_OS_ID_ABSENT");
  const parsed = Number(result.stdout.trim());
  assert.ok(Number.isSafeInteger(parsed) && parsed > 0);
  return parsed;
}

function writeAs(user: string, target: string, flag: "wx" | "a"): number | null {
  return sudo(["-u", user, process.execPath, "-e", WRITE_PROBE, target, flag]);
}

function parentWriteAs(user: string, target: string): number | null {
  return sudo(["-u", user, process.execPath, "-e", PARENT_WRITE_PROBE, target]);
}

test("private Task6A fixture denies new old-UID paths under a distinct successor", {
  skip: enabled ? false : "requires explicit isolated macOS OS-identity fixture opt-in",
}, () => {
  assert.equal(process.platform, "darwin");
  assert.ok(typeof process.getuid === "function" && typeof process.getgid === "function");
  const runnerUid = process.getuid(), runnerGid = process.getgid();
  const oldUid = uid("nobody"), successorUid = uid("_www");
  assert.ok(runnerUid > 0 && runnerUid !== oldUid && runnerUid !== successorUid);
  assert.notEqual(oldUid, successorUid);
  assert.deepEqual(sudoResult(["-u", "nobody", "/usr/bin/id", "-u"]),
    { status: 0, stdout: `${oldUid}\n` });
  assert.deepEqual(sudoResult(["-u", "_www", "/usr/bin/id", "-u"]),
    { status: 0, stdout: `${successorUid}\n` });
  assert.notEqual(sudo(["-u", "nobody", "/usr/bin/sudo", "-n", "-u", "_www",
    "/usr/bin/id", "-u"]), 0, "old identity must not inherit sudo to successor");

  const parent = fs.realpathSync("/tmp");
  const home = fs.mkdtempSync(path.join(parent, "setfarm-task6a-os-fence."));
  fs.chmodSync(home, 0o711);
  const homeStat = fs.lstatSync(home, { bigint: true });
  const root = path.join(home, "root");
  fs.mkdirSync(root, { mode: 0o700 });
  const original = fs.lstatSync(root, { bigint: true });
  const exactHome = (): void => {
    assert.equal(path.dirname(home), parent);
    assert.match(path.basename(home), /^setfarm-task6a-os-fence\.[A-Za-z0-9]+$/);
    const stat = fs.lstatSync(home, { bigint: true });
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(fs.realpathSync(home), home);
    assert.equal(stat.dev, homeStat.dev);
    assert.equal(stat.ino, homeStat.ino);
    assert.equal(stat.uid, BigInt(runnerUid));
    assert.equal(Number(stat.mode & 0o777n), 0o711);
  };
  const exactRoot = (): fs.BigIntStats => {
    exactHome();
    assert.equal(path.dirname(root), home);
    assert.equal(path.basename(root), "root");
    const stat = fs.lstatSync(root, { bigint: true });
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(fs.realpathSync(root), root);
    assert.equal(stat.dev, original.dev);
    assert.equal(stat.ino, original.ino);
    return stat;
  };
  let failure: unknown;
  try {
    assert.equal(original.uid, BigInt(runnerUid));
    assert.equal(Number(original.mode & 0o777n), 0o700);
    exactRoot();
    assert.equal(parentWriteAs("nobody", home), 42,
      "the old identity must not be able to rename the fixture root");
    assert.equal(sudo(["/usr/sbin/chown", "nobody:nobody", root]), 0);
    assert.equal(exactRoot().uid, BigInt(oldUid));
    const before = path.join(root, "old-before.txt");
    assert.equal(writeAs("nobody", before, "wx"), 0,
      "old identity must possess the fixture before transition");

    exactRoot();
    assert.equal(sudo(["/usr/sbin/chown", "_www:_www", root]), 0);
    assert.equal(exactRoot().uid, BigInt(successorUid));

    const denied = path.join(root, "old-after.txt");
    assert.equal(writeAs("nobody", denied, "wx"), 42,
      "old identity must receive an OS permission denial after transition");
    const created = path.join(root, "successor.txt");
    assert.equal(writeAs("_www", created, "wx"), 0,
      "successor identity must write the exact protected fixture");
    assert.equal(writeAs("nobody", created, "a"), 42,
      "old identity must not alter the successor artifact");
    assert.equal(exactRoot().uid, BigInt(successorUid));
    assert.equal(sudo(["/usr/sbin/chown", `${runnerUid}:${runnerGid}`, root]), 0);
    assert.equal(exactRoot().uid, BigInt(runnerUid));
    assert.equal(fs.existsSync(denied), false);
    assert.equal(fs.lstatSync(created, { bigint: true }).uid, BigInt(successorUid));
    assert.equal(fs.readFileSync(before, "utf8"), "probe\n");
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    let cleanupError: unknown;
    try {
      exactRoot();
      assert.equal(sudo(["/usr/sbin/chown", `${runnerUid}:${runnerGid}`, root]), 0);
      assert.equal(exactRoot().uid, BigInt(runnerUid));
      exactHome();
      fs.rmSync(home, { recursive: true, force: false });
    } catch (error) {
      cleanupError = new Error("TASK6A_PRIVATE_OS_FIXTURE_CLEANUP_FAILED", { cause: error });
    }
    if (cleanupError !== undefined) {
      if (failure !== undefined) throw new AggregateError([failure, cleanupError],
        "TASK6A_PRIVATE_OS_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
});
