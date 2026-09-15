import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, readFileSync, lstatSync, rmSync, renameSync, mkdirSync, writeFileSync, symlinkSync, linkSync, unlinkSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { publishControllerPidReservationV1 } from "../build-generation-controller-reservation.mjs";

function fixture(run) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "controller-reservation-")));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("publishes real owner PID exclusively and close preserves the reservation", () => fixture(root => {
  const held = publishControllerPidReservationV1(root);
  try {
    assert.equal(readFileSync(held.path, "utf8"), `${process.pid}\n`);
    assert.equal(lstatSync(held.path).nlink, 1);
    held.assertStable();
    assert.throws(() => publishControllerPidReservationV1(root), { code: "EEXIST" });
    held.assertStable();
  } finally { held.close(); }
  held.close();
  assert.throws(() => held.assertStable(), /RESERVATION_CLOSED/);
  assert.equal(readFileSync(held.path, "utf8"), `${process.pid}\n`);
}));

test("invalid pre-journaled nonce refuses before creating files", () => fixture(root => {
  assert.throws(() => publishControllerPidReservationV1(root, "../escape"), /RESERVATION_NONCE_INVALID/);
  assert.throws(() => lstatSync(path.join(root, "spawner.lock")), { code: "ENOENT" });
}));

test("uses the journaled nonce and preserves an existing staging attempt", () => fixture(root => {
  const nonce = "10000000-0000-4000-8000-000000000001";
  const staging = path.join(root, `.spawner-maintenance-${nonce}.tmp`);
  writeFileSync(staging, "historical partial attempt", { mode: 0o600 });
  assert.throws(() => publishControllerPidReservationV1(root, nonce), { code: "EEXIST" });
  assert.equal(readFileSync(staging, "utf8"), "historical partial attempt");
  assert.throws(() => lstatSync(path.join(root, "spawner.lock")), { code: "ENOENT" });
}));

test("rejects same-byte replacement without removing either inode", () => fixture(root => {
  const held = publishControllerPidReservationV1(root);
  try {
    renameSync(held.path, path.join(root, "original"));
    writeFileSync(held.path, `${process.pid}\n`, { mode: 0o600 });
    assert.throws(() => held.assertStable(), /RESERVATION_CHANGED/);
  } finally { held.close(); }
  assert.equal(readFileSync(path.join(root, "original"), "utf8"), `${process.pid}\n`);
  assert.equal(readFileSync(held.path, "utf8"), `${process.pid}\n`);
}));

test("rejects in-place byte drift and preserves evidence on close", () => fixture(root => {
  const held = publishControllerPidReservationV1(root);
  try {
    writeFileSync(held.path, "changed\n");
    assert.throws(() => held.assertStable(), /RESERVATION_CHANGED/);
  } finally { held.close(); }
  assert.equal(readFileSync(held.path, "utf8"), "changed\n");
}));

test("refuses a symlink ancestor before creating a lock", () => fixture(root => {
  mkdirSync(path.join(root, "physical"), { mode: 0o700 });
  symlinkSync(path.join(root, "physical"), path.join(root, "alias"));
  assert.throws(() => publishControllerPidReservationV1(path.join(root, "alias")), /RESERVATION_PARENT/);
  assert.throws(() => lstatSync(path.join(root, "physical", "spawner.lock")), { code: "ENOENT" });
}));

test("detects changed ancestor even when directory and lock survive", () => fixture(root => {
  const parent = path.join(root, "parent"), directory = path.join(parent, "leaf");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const held = publishControllerPidReservationV1(directory);
  try {
    renameSync(parent, path.join(root, "retired"));
    mkdirSync(parent, { mode: 0o700 });
    renameSync(path.join(root, "retired", "leaf"), directory);
    assert.throws(() => held.assertStable(), /RESERVATION_PARENT/);
  } finally { held.close(); }
  assert.equal(readFileSync(held.path, "utf8"), `${process.pid}\n`);
}));

test("refuses unexpected aliases and a removed target", () => fixture(root => {
  const held = publishControllerPidReservationV1(root);
  try {
    linkSync(held.path, path.join(root, "alias"));
    assert.throws(() => held.assertStable(), /RESERVATION_CHANGED/);
    unlinkSync(held.path);
    assert.throws(() => held.assertStable());
  } finally { held.close(); }
  assert.equal(readFileSync(path.join(root, "alias"), "utf8"), `${process.pid}\n`);
}));

test("retained old singleton exits as a duplicate of the real controller", () => fixture(root => {
  const old = execFileSync("/usr/bin/git", ["show", "eef9f6c4059daa487a5a367f8f1609b1d1e39142:src/spawner.ts"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
  });
  const tree = ts.createSourceFile("old-spawner.ts", old, ts.ScriptTarget.Latest, true);
  const functions = ["processIsAlive", "acquireSpawnerSingletonLock"].map(name => {
    const found = tree.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(found.length, 1);
    return found[0].getText(tree);
  });
  const held = publishControllerPidReservationV1(root);
  try {
    const js = ts.transpileModule(functions.join("\n"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", [
      'import fs from "node:fs"; import path from "node:path";',
      `const LOCK_FILE = ${JSON.stringify(held.path)}; let spawnerLockFd = null;`,
      js, 'acquireSpawnerSingletonLock(); process.stdout.write("ACQUIRED");',
    ].join("\n")], { encoding: "utf8", timeout: 5000, env: {} });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0);
    assert.equal(child.stdout, "", "duplicate must not cross singleton acquisition");
    assert.match(child.stderr, /Another spawner is already running/);
    held.assertStable();
  } finally { held.close(); }
}));

for (const fault of ["link-after-effect", "directory-fsync-after-effect", "directory-sync-and-close"]) {
  test(`preserves published evidence and closes descriptors on ${fault}`, () => fixture(root => {
    const moduleUrl = new URL("../build-generation-controller-reservation.mjs", import.meta.url).href;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import fs from "node:fs";
      import { publishControllerPidReservationV1 } from ${JSON.stringify(moduleUrl)};
      const directory = ${JSON.stringify(root)}, fault = ${JSON.stringify(fault)};
      const descriptors = new Set();
      const open = fs.openSync, close = fs.closeSync, link = fs.linkSync, sync = fs.fsyncSync;
      fs.openSync = (...args) => { const fd = open(...args); descriptors.add(fd); return fd; };
      fs.closeSync = fd => { const isDirectory = fs.fstatSync(fd).isDirectory(); const result = close(fd); descriptors.delete(fd); if (fault === "directory-sync-and-close" && isDirectory) throw Error("INJECTED_CLOSE"); return result; };
      fs.linkSync = (...args) => { const result = link(...args); if (fault === "link-after-effect") throw Error("INJECTED"); return result; };
      fs.fsyncSync = fd => { const isDirectory = fs.fstatSync(fd).isDirectory(); const result = sync(fd); if (["directory-fsync-after-effect", "directory-sync-and-close"].includes(fault) && isDirectory) throw Error("INJECTED"); return result; };
      let error = null, causes = [];
      try { publishControllerPidReservationV1(directory); } catch (caught) { error = caught.message; causes = (caught.errors ?? []).map(value => value.message); }
      process.stdout.write(JSON.stringify({ error, causes, openDescriptors: descriptors.size, pid: process.pid, bytes: fs.readFileSync(directory + "/spawner.lock", "utf8") }));
    `], { encoding: "utf8", timeout: 5000, env: {} });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout);
    if (fault === "directory-sync-and-close") {
      assert.equal(observed.error, "RESERVATION_DIRECTORY_CLOSE_UNCERTAIN");
      assert.deepEqual(observed.causes, ["INJECTED", "INJECTED_CLOSE"]);
    } else assert.equal(observed.error, "INJECTED");
    assert.equal(observed.openDescriptors, 0);
    assert.equal(observed.bytes, `${observed.pid}\n`);
    assert.equal(readFileSync(path.join(root, "spawner.lock"), "utf8"), observed.bytes);
  }));
}
