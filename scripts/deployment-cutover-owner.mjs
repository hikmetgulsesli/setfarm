import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { types } from "node:util";

// Internal ownership only. A fresh trusted controller bootstrap must authenticate
// this module before import. This is not a service-effect or loaded-code proof.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceFiles = ["scripts/build-generation-maintenance-journal.mjs", "scripts/build-generation-maintenance-owner-observer.mjs", "scripts/build-generation-retention.mjs", "scripts/deployment-cutover-owner.mjs", "scripts/deployment-cutover.mjs"];
const directoryKeys = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"];
const fileKeys = [...directoryKeys, "size", "nlink", "mtimeNs", "ctimeNs"];
const fail = () => { throw Error("DEPLOYMENT_CUTOVER_OWNER_REFUSED"); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const same = (a, b, keys) => keys.every(key => a[key] === b[key]);
let uncertain = false, occupied = false, modulesPromise, originalBuild;
const handles = new WeakMap();

function sourceSnapshot() {
  if (uncertain) fail();
  const pins = [], files = [];
  let result, invalid = false;
  try {
    const check = () => {
      for (const pin of pins) if (!same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), directoryKeys)
        || !same(pin.stat, fs.lstatSync(pin.target, { bigint: true }), directoryKeys)) fail();
    };
    const targets = new Set();
    for (const locator of sourceFiles) {
      const target = path.join(root, locator), directory = path.dirname(target), segments = directory.split(path.sep).filter(Boolean);
      for (let index = 0; index <= segments.length; index++) {
        const ancestor = path.join(path.parse(root).root, ...segments.slice(0, index));
        if (targets.has(ancestor)) continue;
        check(); const stat = fs.lstatSync(ancestor, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
        const fd = fs.openSync(ancestor, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        pins.push({ target: ancestor, fd, stat }); targets.add(ancestor); check();
        if ((ancestor === root || ancestor.startsWith(`${root}/`)) && (stat.uid !== BigInt(process.getuid()) || (stat.mode & 0o022n))) fail();
      }
      let fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      try {
        const stat = fs.fstatSync(fd, { bigint: true });
        if (!stat.isFile() || stat.uid !== BigInt(process.getuid()) || (stat.mode & 0o022n) || stat.nlink !== 1n || stat.size < 1n || stat.size > 1048576n) fail();
        const bytes = Buffer.alloc(1048577), count = fs.readSync(fd, bytes, 0, bytes.length, 0);
        if (BigInt(count) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }), fileKeys)
          || !same(stat, fs.lstatSync(target, { bigint: true }), fileKeys)) fail();
        files.push({ locator, sha256: hash(bytes.subarray(0, count)), identity: Object.fromEntries(fileKeys.map(key => [key, String(stat[key])])) });
      } finally { const owned = fd; fd = null; try { fs.closeSync(owned); } catch { uncertain = true; fail(); } }
      check();
    }
    check();
    result = { files, directories: pins.map(pin => ({ target: pin.target, identity: Object.fromEntries(directoryKeys.map(key => [key, String(pin.stat[key])])) })) };
  } catch { invalid = true; }
  while (pins.length) { const pin = pins.pop(); try { fs.closeSync(pin.fd); } catch { uncertain = true; invalid = true; } }
  if (invalid) { uncertain = true; fail(); } return result;
}
// Never replace these original expectations with a later disk observation.
const initialSource = sourceSnapshot();
function assertSourceFiles() {
  if (canonical(sourceSnapshot()) !== canonical(initialSource)) { uncertain = true; fail(); }
}
function sourceAuthority(modules) {
  assertSourceFiles();
  const build = modules.source.observeCurrentFinalizedSetfarmSourceBuildV1();
  if (!build || Object.keys(build).sort().join(",") !== "branch,buildHash,clean,originMainSha,sha,treeHash"
    || build.branch !== "main" || build.clean !== true || !/^[a-f0-9]{40}$/.test(build.sha)
    || !/^[a-f0-9]{40}$/.test(build.treeHash) || !/^[a-f0-9]{64}$/.test(build.buildHash) || build.originMainSha !== build.sha) fail();
  if (originalBuild && canonical(originalBuild) !== canonical(build)) { uncertain = true; fail(); }
  originalBuild ??= Object.freeze({ ...build }); assertSourceFiles();
  const body = { schema: "setfarm.internal-production-deployment-cutover-controller-source.v1", sourceBuild: originalBuild,
    controllerFiles: initialSource.files.map(({ locator, sha256 }) => ({ locator, sha256 })) };
  return Object.freeze({ controllerSourceHash: hash(canonical(body)) });
}
async function load() {
  if (uncertain) fail();
  modulesPromise ??= (async () => {
    assertSourceFiles();
    const source = await import("./build-generation-retention.mjs");
    sourceAuthority({ source });
    const records = await import(new URL("../dist/internal-production/baseline-deployment-cutover-records-v1.js", import.meta.url));
    sourceAuthority({ source });
    const store = await import(new URL("../dist/internal-production/baseline-deployment-cutover-owner-store-v1.js", import.meta.url));
    sourceAuthority({ source });
    const processObserver = await import("./build-generation-maintenance-owner-observer.mjs");
    const modules = { source, records, store, processObserver }; sourceAuthority(modules); return modules;
  })().catch(() => { uncertain = true; fail(); });
  return modulesPromise;
}
export async function observeDeploymentCutoverOwnerControllerSourceV1() {
  return sourceAuthority(await load());
}
const committed = value => canonical({ root: value.rootIdentityHash, ancestors: value.ancestorIdentityHash, maintenance: value.maintenance, claims: value.claims,
  files: value.files.filter(file => file.kind === "committed") });
function captureMaintenance(input) {
  if (!input || typeof input !== "object" || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) fail();
  const expected = ["schema", "purpose", "controllerSourceHash", "cutoverPlanHash", "maintenanceIntentHash", "maintenanceIntentRef"];
  const fields = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(fields);
  if (keys.length !== expected.length || keys.some(key => !expected.includes(key) || !fields[key].enumerable
    || !("value" in fields[key]) || typeof fields[key].value !== "string")) fail();
  return Object.freeze(Object.fromEntries(expected.map(key => [key, fields[key].value])));
}
export async function acquireDeploymentCutoverOwnerV1(maintenance) {
  if (occupied || uncertain) fail(); occupied = true;
  try {
    const captured = captureMaintenance(maintenance);
    const modules = await load(), { records, store, processObserver } = modules;
    const intent = records.parseDeploymentCutoverMaintenanceIntentV1(records.encodeDeploymentCutoverMaintenanceIntentV1(captured));
    if (intent.controllerSourceHash !== sourceAuthority(modules).controllerSourceHash) fail();
    const before = store.observeDeploymentCutoverOwnerHistoryV1();
    if (before.maintenance && before.maintenance.maintenanceIntentHash !== intent.maintenanceIntentHash) fail();
    const current = processObserver.observeCurrentMaintenanceOwnerV1(randomUUID());
    const previous = before.claims.at(-1); let deathHash = null;
    if (previous) {
      const death = processObserver.observeMaintenanceOwnerProcessV1(previous.owner);
      if (death.state !== "definitely_dead") fail(); deathHash = death.observationHash;
    }
    const claim = records.createDeploymentCutoverOwnerClaimV1({ maintenance: intent, owner: current.owner,
      previous: previous ?? null, previousOwnerDeathObservationHash: deathHash });
    sourceAuthority(modules);
    if (committed(store.observeDeploymentCutoverOwnerHistoryV1()) !== committed(before)) fail();
    const published = store.publishDeploymentCutoverOwnerClaimV1(intent, claim, before.committedHistoryHash);
    if (published.claims.at(-1)?.ownerClaimHash !== claim.ownerClaimHash) fail();
    const capability = Object.freeze(Object.create(null));
    handles.set(capability, { modules, claim, projection: committed(published), valid: true });
    assertDeploymentCutoverOwnerV1(capability); return capability;
  } catch { uncertain = true; fail(); }
}
export function assertDeploymentCutoverOwnerV1(capability) {
  const held = handles.get(capability);
  if (!held || !held.valid || uncertain) fail();
  try {
    sourceAuthority(held.modules);
    if (held.claim.owner.pid !== process.pid || held.claim.owner.uid !== process.getuid()
      || held.modules.processObserver.observeMaintenanceOwnerProcessV1(held.claim.owner).state !== "live_match") fail();
    if (committed(held.modules.store.observeDeploymentCutoverOwnerHistoryV1()) !== held.projection) fail();
    sourceAuthority(held.modules);
  } catch { held.valid = false; uncertain = true; fail(); }
}
