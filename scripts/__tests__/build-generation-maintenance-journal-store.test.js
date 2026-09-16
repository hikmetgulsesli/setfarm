import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync, renameSync, mkdirSync, symlinkSync, readdirSync, linkSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createMaintenanceIntentV1, createMaintenanceOwnerClaimV1, encodeMaintenanceJournalRecordV1 } from "../build-generation-maintenance-journal.mjs";
import { openMaintenanceOwnerJournalV1 } from "../build-generation-maintenance-journal-store.mjs";

const h = value => value.repeat(64);
const intentInput = { candidateCompletionHash: h("a"), controllerSourceHash: h("b"), retainedBuildHash: h("c"), launcherConfigurationHash: h("d") };
const intent = createMaintenanceIntentV1(intentInput);
const owner = { uid: 501, pid: 1234, processLstart: "Tue Sep 15 08:00:00 2026", processGroupId: 1234,
  bootSessionHash: h("e"), reservationNonce: "10000000-0000-4000-8000-000000000001" };
const first = createMaintenanceOwnerClaimV1(intent, owner);
const second = createMaintenanceOwnerClaimV1(intent, { ...owner, pid: 2345 }, first, h("f"));
const encode = encodeMaintenanceJournalRecordV1;
function fixture(run) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "maintenance-journal-")));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("persists intent and ordered owners without permitting stale-owner replay", () => fixture(root => {
  const store = openMaintenanceOwnerJournalV1(root);
  assert.deepEqual(store.read(), { intent: null, claims: [], pendingPublicationCount: 0 });
  store.publishIntent(intent);
  store.publishOwnerClaim(first);
  store.publishOwnerClaim(first);
  store.publishOwnerClaim(second);
  assert.throws(() => store.publishOwnerClaim(first), /MAINTENANCE_JOURNAL/);
  assert.equal(store.read().claims.length, 2);
  assert.equal(openMaintenanceOwnerJournalV1(root).read().claims[1].owner.pid, 2345);
  assert.ok(readFileSync(path.join(root, "intent.json")).equals(encode(intent)));
}));

test("different intent and competing successor cannot overwrite committed bytes", () => fixture(root => {
  const store = openMaintenanceOwnerJournalV1(root);
  store.publishIntent(intent); store.publishOwnerClaim(first); store.publishOwnerClaim(second);
  assert.throws(() => store.publishIntent(createMaintenanceIntentV1({ ...intentInput, retainedBuildHash: h("f") })), /MAINTENANCE_JOURNAL/);
  const competitor = createMaintenanceOwnerClaimV1(intent, { ...owner, pid: 3456 }, first, h("f"));
  assert.throws(() => store.publishOwnerClaim(competitor), /MAINTENANCE_JOURNAL/);
  assert.ok(readFileSync(path.join(root, "owner-0002.json")).equals(encode(second)));
}));

test("publishes and replays maintenance history through legal partial reads", () => fixture(root => {
  const moduleUrl = new URL("../build-generation-maintenance-journal-store.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import fs from "node:fs";
    import { openMaintenanceOwnerJournalV1 } from ${JSON.stringify(moduleUrl)};
    const read = fs.readSync;
    fs.readSync = (fd, buffer, offset, length, position) => read(fd, buffer, offset, Math.min(7, length), position);
    const store = openMaintenanceOwnerJournalV1(${JSON.stringify(root)});
    store.publishIntent(${JSON.stringify(intent)});
    store.publishOwnerClaim(${JSON.stringify(first)});
    store.publishOwnerClaim(${JSON.stringify(first)});
    process.stdout.write(JSON.stringify(store.read()));
  `], { encoding: "utf8", timeout: 5000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { intent, claims: [first], pendingPublicationCount: 0 });
  assert.ok(readFileSync(path.join(root, "intent.json")).equals(encode(intent)));
  assert.ok(readFileSync(path.join(root, "owner-0001.json")).equals(encode(first)));
}));

test("partial temporary confers no authority and does not get erased on retry", () => fixture(root => {
  const temp = path.join(root, ".intent.json.10000000-0000-4000-8000-000000000001.tmp");
  writeFileSync(temp, '{"schema":', { mode: 0o600 });
  const store = openMaintenanceOwnerJournalV1(root);
  assert.equal(store.read().intent, null);
  assert.equal(store.read().pendingPublicationCount, 1);
  store.publishIntent(intent);
  assert.equal(store.read().pendingPublicationCount, 1);
  assert.equal(readFileSync(temp, "utf8"), '{"schema":');
}));

test("ninth pending temporary refuses without cleanup", () => fixture(root => {
  for (let n = 1; n <= 9; n++) writeFileSync(path.join(root,
    `.intent.json.10000000-0000-4000-8000-${String(n).padStart(12, "0")}.tmp`), "", { mode: 0o600 });
  assert.throws(() => openMaintenanceOwnerJournalV1(root).read(), /MAINTENANCE_JOURNAL/);
  assert.equal(readdirSync(root).length, 9);
}));

test("fixed corruption and symlink input refuse", () => fixture(root => {
  writeFileSync(path.join(root, "intent.json"), "{}\n", { mode: 0o600 });
  assert.throws(() => openMaintenanceOwnerJournalV1(root).read(), /MAINTENANCE_JOURNAL/);
  symlinkSync(root, path.join(root, "alias"));
  assert.throws(() => openMaintenanceOwnerJournalV1(path.join(root, "alias")), /MAINTENANCE_JOURNAL/);
}));

test("open store detects changed ancestor even with surviving leaf", () => fixture(root => {
  const parent = path.join(root, "parent"), leaf = path.join(parent, "leaf");
  mkdirSync(leaf, { recursive: true, mode: 0o700 });
  const store = openMaintenanceOwnerJournalV1(leaf);
  store.publishIntent(intent);
  renameSync(parent, path.join(root, "retired")); mkdirSync(parent, { mode: 0o700 });
  renameSync(path.join(root, "retired", "leaf"), leaf);
  assert.throws(() => store.read(), /MAINTENANCE_JOURNAL/);
}));

test("reopens and replays a committed link after publisher after-effect failure", () => fixture(root => {
  const moduleUrl = new URL("../build-generation-maintenance-journal-store.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import fs from "node:fs";
    import { openMaintenanceOwnerJournalV1 } from ${JSON.stringify(moduleUrl)};
    const link = fs.linkSync;
    fs.linkSync = (...args) => { link(...args); throw Error("INJECTED_AFTER_LINK"); };
    try { openMaintenanceOwnerJournalV1(${JSON.stringify(root)}).publishIntent(${JSON.stringify(intent)}); }
    catch (error) { process.stdout.write(error.message); }
  `], { encoding: "utf8", timeout: 5000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "INJECTED_AFTER_LINK");
  const store = openMaintenanceOwnerJournalV1(root);
  assert.equal(store.read().intent.maintenanceIntentHash, intent.maintenanceIntentHash);
  store.publishIntent(intent);
  store.publishOwnerClaim(first);
  assert.equal(store.read().claims.length, 1);
}));

test("third hard link refuses and preserves every alias", () => fixture(root => {
  const store = openMaintenanceOwnerJournalV1(root); store.publishIntent(intent);
  const fixed = path.join(root, "intent.json");
  for (const n of [1, 2]) linkSync(fixed, path.join(root,
    `.intent.json.10000000-0000-4000-8000-${String(n).padStart(12, "0")}.tmp`));
  assert.throws(() => store.read(), /MAINTENANCE_JOURNAL/);
  assert.equal(lstatSync(fixed).nlink, 3);
  assert.equal(readdirSync(root).length, 3);
}));

for (const combined of [false, true]) test(`directory sync failure preserves evidence${combined ? " and original cause when close fails" : ""}`, () => fixture(root => {
  const moduleUrl = new URL("../build-generation-maintenance-journal-store.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import fs from "node:fs";
    import { openMaintenanceOwnerJournalV1 } from ${JSON.stringify(moduleUrl)};
    const open = fs.openSync, close = fs.closeSync, sync = fs.fsyncSync, fds = new Set();
    fs.openSync = (...args) => { const fd = open(...args); fds.add(fd); return fd; };
    fs.fsyncSync = fd => { sync(fd); if (fs.fstatSync(fd).isDirectory()) throw Error("INJECTED_SYNC"); };
    fs.closeSync = fd => { const directory = fs.fstatSync(fd).isDirectory(); close(fd); fds.delete(fd); if (directory && ${combined}) throw Error("INJECTED_CLOSE"); };
    try { openMaintenanceOwnerJournalV1(${JSON.stringify(root)}).publishIntent(${JSON.stringify(intent)}); }
    catch (error) { process.stdout.write(JSON.stringify({ message: error.message, causes: (error.errors ?? []).map(value => value.message), open: fds.size })); }
  `], { encoding: "utf8", timeout: 5000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  const observed = JSON.parse(child.stdout);
  assert.equal(observed.open, 0);
  assert.equal(observed.message, combined ? "MAINTENANCE_JOURNAL_CLOSE_UNCERTAIN" : "INJECTED_SYNC");
  assert.deepEqual(observed.causes, combined ? ["INJECTED_SYNC", "INJECTED_CLOSE"] : []);
  assert.ok(readFileSync(path.join(root, "intent.json")).equals(encode(intent)));
  const recovered = openMaintenanceOwnerJournalV1(root);
  recovered.publishIntent(intent);
  assert.equal(recovered.read().intent.maintenanceIntentHash, intent.maintenanceIntentHash);
}));
