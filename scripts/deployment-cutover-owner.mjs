import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { types } from "node:util";

// Internal ownership only. A fresh trusted controller bootstrap must authenticate
// this module before import. This is not a service-effect or loaded-code proof.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceFiles = ["scripts/build-generation-maintenance-journal.mjs", "scripts/build-generation-maintenance-owner-observer.mjs", "scripts/build-generation-retention.mjs", "scripts/deployment-cutover-owner.mjs", "scripts/deployment-cutover.mjs", "scripts/deployment-cutover-dependencies.mjs"];
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
let bindingProjectionActive = false, bindingProjectionOwner = null;
let jointReservation = null;
let quietOriginal = null;
function burnQuietOriginal() {
  const record = quietOriginal;
  if (!record) return;
  record.unknown = true; record.held.valid = false; uncertain = true;
  const adapter = record.adapter ?? record.imports.find(row => row.locator === "./deployment-dashboard-cutover-adapter-v2.mjs")?.value;
  if (adapter) adapter.revokeDashboardCutoverJointTokenV4(record.token);
}
function burnJointReservation() {
  const record = jointReservation;
  if (!record) return;
  record.unknown = true; record.held.valid = false; uncertain = true;
  if (record.adapter) record.adapter.revokeDashboardCutoverJointTokenV4(record.token);
}
function legacyOwnerEntry() {
  if (quietOriginal) { burnQuietOriginal(); fail(); }
  if (jointReservation) { burnJointReservation(); fail(); }
}
function checkJointReservation(record) {
  if (jointReservation !== record || record.unknown || !record.held.valid || uncertain || !record.adapter) fail();
  record.adapter.assertDashboardCutoverJointOwnerTokenV4(record.token, record.owner);
}

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
        const bytes = Buffer.alloc(1048577);
        let count = 0;
        while (count < bytes.length) {
          const size = fs.readSync(fd, bytes, count, bytes.length - count, count);
          if (size === 0) break;
          count += size;
        }
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
    const publication = await import(new URL("../dist/internal-production/baseline-deployment-cutover-publication-v1.js", import.meta.url));
    sourceAuthority({ source });
    const observation = await import(new URL("../dist/internal-production/baseline-deployment-cutover-v1.js", import.meta.url));
    sourceAuthority({ source });
    const processObserver = await import("./build-generation-maintenance-owner-observer.mjs");
    const modules = { source, records, store, publication, observation, processObserver }; sourceAuthority(modules); return modules;
  })().catch(() => { uncertain = true; fail(); });
  return modulesPromise;
}
export async function observeDeploymentCutoverOwnerControllerSourceV1() {
  legacyOwnerEntry();
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
  legacyOwnerEntry();
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
    handles.set(capability, { modules, claim, maintenance: intent, projection: committed(published), valid: true });
    assertOwnerOriginal(capability); return capability;
  } catch { uncertain = true; fail(); }
}
function assertOwnerOriginal(capability) {
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
export function assertDeploymentCutoverOwnerV1(capability) {
  legacyOwnerEntry(); assertOwnerOriginal(capability);
}

// Labels only: the original opaque capability remains the owner authority.
// Each assertion is a trusted composite with its existing FS/process resources.
export function observeDashboardCutoverOwnerBindingsV2(capability) {
  legacyOwnerEntry();
  if (bindingProjectionActive) {
    bindingProjectionOwner.valid = false;
    uncertain = true;
    fail();
  }
  const held = handles.get(capability);
  if (!held || !held.valid || uncertain) fail();
  bindingProjectionActive = true;
  bindingProjectionOwner = held;
  const check = () => {
    if (!bindingProjectionActive || bindingProjectionOwner !== held || !held.valid || uncertain) fail();
  };
  try {
    assertOwnerOriginal(capability);
    check();
    const bindings = Object.freeze({
      schema: "setfarm.internal-production-dashboard-cutover-owner-bindings.v2",
      authority: "binding-only",
      maintenanceIntentHash: held.maintenance.maintenanceIntentHash,
      ownerClaimHash: held.claim.ownerClaimHash,
      controllerSourceHash: held.maintenance.controllerSourceHash,
      cutoverPlanHash: held.maintenance.cutoverPlanHash,
    });
    assertOwnerOriginal(capability);
    check();
    return bindings;
  } catch {
    held.valid = false;
    uncertain = true;
    fail();
  } finally {
    bindingProjectionActive = false;
    bindingProjectionOwner = null;
  }
}

// A durable refusal can be published only by this process's current owner.
// This is not a DB admission fence, service-effect permission or zero-owner proof.
export function publishDeploymentCutoverIntentWithOwnerV1(capability, cutoverIntent) {
  legacyOwnerEntry(); assertOwnerOriginal(capability);
  const held = handles.get(capability);
  const { records, publication, observation } = held.modules;
  const intent = records.parseDeploymentCutoverIntentV1(records.encodeDeploymentCutoverIntentV1(cutoverIntent));
  records.assertDeploymentCutoverMaintenanceRelationV1({ cutover: intent, maintenance: held.maintenance,
    controllerSourceHash: sourceAuthority(held.modules).controllerSourceHash });
  assertOwnerOriginal(capability);
  try {
    publication.publishDeploymentCutoverIntentV1(intent);
    assertOwnerOriginal(capability);
    const observed = observation.observeDeploymentCutoverIntentV1();
    if (observed.state !== "open" || !records.encodeDeploymentCutoverIntentV1(observed.intent).equals(records.encodeDeploymentCutoverIntentV1(intent))) fail();
    assertOwnerOriginal(capability);
    return observed.intent;
  } catch {
    held.valid = false;
    uncertain = true;
    fail();
  }
}

// Resource-free identity authentication, not a source/owner/OPEN composite.
// The provider authenticates this ORIGINAL input before taking its value copy.
export function assertDeploymentCutoverJointReservationMetadataV4(token, input) {
  const record = jointReservation;
  if (record?.checking) { burnJointReservation(); fail(); }
  if (arguments.length !== 2 || !record || record.token !== token || record.input !== input || !record.invocationIntent) fail();
  record.checking = true;
  try { checkJointReservation(record); }
  catch { burnJointReservation(); fail(); }
  finally { record.checking = false; }
}

async function jointImport(record, locator) {
  const occurrence = { locator, intent: true, promise: null, settled: false, value: null };
  record.imports.push(occurrence);
  if (record.unknown || !record.held.valid || uncertain) fail();
  occurrence.promise = import(locator);
  try { occurrence.value = await occurrence.promise; occurrence.settled = true; }
  catch { occurrence.settled = true; burnJointReservation(); fail(); }
  if (record.unknown || !record.held.valid || uncertain) fail();
  return occurrence.value;
}

function jointOpenOriginal(record) {
  checkJointReservation(record);
  assertOwnerOriginal(record.owner); checkJointReservation(record);
  const { records, observation } = record.held.modules;
  const observed = observation.observeDeploymentCutoverIntentV1(); checkJointReservation(record);
  if (observed.state !== "open") fail();
  const bytes = records.encodeDeploymentCutoverIntentV1(observed.intent);
  records.assertDeploymentCutoverMaintenanceRelationV1({ cutover: observed.intent, maintenance: record.held.maintenance,
    controllerSourceHash: sourceAuthority(record.held.modules).controllerSourceHash });
  checkJointReservation(record);
  if (record.openBytes && !record.openBytes.equals(bytes)) fail();
  if (record.claim !== record.held.claim || !record.held.valid) fail();
  assertOwnerOriginal(record.owner); checkJointReservation(record);
  return { bytes, intent: observed.intent };
}

export async function reserveDeploymentCutoverFirstGenerationWithOwnerV4(owner, token) {
  legacyOwnerEntry();
  if (arguments.length !== 2 || owner === null || typeof owner !== "object" || types.isProxy(owner)
    || token === null || typeof token !== "object" || types.isProxy(token)) fail();
  const held = handles.get(owner);
  if (!held || !held.valid || uncertain) fail();
  // Provisional lifetime precedes imports and all admitted owner/source/OPEN work.
  const record = { owner, token, held, claim: held.claim, input: null, openBytes: null, adapter: null,
    provider: null, imports: [], promise: null, invocationIntent: false, returned: false,
    settled: false, reservation: null, checking: false, unknown: false };
  jointReservation = record;
  try {
    record.adapter = await jointImport(record, "./deployment-dashboard-cutover-adapter-v2.mjs");
    checkJointReservation(record);
    const original = jointOpenOriginal(record);
    record.openBytes = Buffer.from(original.bytes);
    record.input = Object.freeze({ cutoverIntentHash: original.intent.cutoverIntentHash, ownerClaimHash: held.claim.ownerClaimHash });
    checkJointReservation(record);
    record.provider = await jointImport(record, "./deployment-dashboard-cutover-first-generation-v2.mjs");
    checkJointReservation(record); jointOpenOriginal(record); checkJointReservation(record);
    record.invocationIntent = true;
    record.promise = record.provider.acquireFirstGenerationDashboardCutoverJointReservationV4(record.input, record.token);
    if (!types.isPromise(record.promise)) fail();
    // Retain the actual returned original before any fallible observation.
    void record.promise.then(reservation => { record.reservation = reservation; record.returned = true; record.settled = true; },
      () => { record.settled = true; burnJointReservation(); });
    record.reservation = await record.promise; record.returned = true; record.settled = true;
    checkJointReservation(record);
    record.provider.assertFirstGenerationDashboardCutoverJointReservationV4(record.token);
    checkJointReservation(record); jointOpenOriginal(record); checkJointReservation(record);
  } catch { burnJointReservation(); fail(); }
  // No release/reset: originals survive healthy bookkeeping and all unknowns.
}

// TWO journaled launcher effects only. No PG/ROOT/selector/legacy-death grant.
function quietBasics(record) {
  if (quietOriginal !== record || record.unknown || uncertain || !record.held.valid
    || record.claim !== record.held.claim || jointReservation) fail();
  if (record.adapter) record.adapter.assertDashboardCutoverJointQuietTokenV4(record.token, record.owner, record.scope);
}
function quietOwnerCheck(record) {
  if (record.checking) { burnQuietOriginal(); fail(); }
  record.checking = true;
  try {
    quietBasics(record); assertOwnerOriginal(record.owner); quietBasics(record);
    const { records, observation } = record.held.modules;
    const observed = observation.observeDeploymentCutoverIntentV1(); quietBasics(record);
    if (observed.state !== "open") fail();
    records.assertDeploymentCutoverMaintenanceRelationV1({ cutover: observed.intent, maintenance: record.held.maintenance,
      controllerSourceHash: sourceAuthority(record.held.modules).controllerSourceHash });
    quietBasics(record);
    const bytes = records.encodeDeploymentCutoverIntentV1(observed.intent);
    if (record.openBytes && !record.openBytes.equals(bytes)) fail();
    record.openBytes ??= Buffer.from(bytes); record.open ??= observed.intent;
    assertOwnerOriginal(record.owner); quietBasics(record);
  } catch { burnQuietOriginal(); fail(); }
  finally { record.checking = false; }
}
export function assertDeploymentCutoverQuietMetadataV4(token, scope) {
  const record = quietOriginal;
  if (record?.checking || record?.metadataChecking) { burnQuietOriginal(); fail(); }
  if (arguments.length !== 2 || !record || record.token !== token || record.scope !== scope || !record.adapter) fail();
  record.metadataChecking = true;
  try { quietBasics(record); }
  catch { burnQuietOriginal(); fail(); }
  finally { record.metadataChecking = false; }
}
function quietIntentOriginal(token, scope, arity, ordinal) {
  const record = quietOriginal;
  if (record?.checking || record?.metadataChecking) { burnQuietOriginal(); fail(); }
  if (arity !== 2 || !record || record.token !== token || record.scope !== scope) fail();
  assertDeploymentCutoverQuietMetadataV4(token, scope);
  const step = record.steps[ordinal - 1];
  if (!step || !step.confirmed || !step.dispatchIntent || step.returned || record.ordinal !== ordinal) fail();
  quietBasics(record);
}
export function assertDeploymentCutoverSpawnerQuietIntentV4(token, scope) {
  quietIntentOriginal(token, scope, arguments.length, 1);
}
export function assertDeploymentCutoverDashboardQuietIntentV4(token, scope) {
  quietIntentOriginal(token, scope, arguments.length, 2);
}
async function quietImport(record, locator) {
  const occurrence = { locator, intent: true, promise: null, value: null, settled: false };
  record.imports.push(occurrence); quietBasics(record);
  occurrence.promise = import(locator);
  try { occurrence.value = await occurrence.promise; occurrence.settled = true; }
  catch { occurrence.settled = true; burnQuietOriginal(); fail(); }
  quietBasics(record); return occurrence.value;
}
async function quietWork(record, kind, invoke) {
  const occurrence = { kind, intent: true, promise: null, value: null, returned: false, settled: false, unknown: true };
  record.work.push(occurrence); quietBasics(record);
  try {
    occurrence.promise = invoke();
    if (!types.isPromise(occurrence.promise)) fail();
    void occurrence.promise.then(value => {
      occurrence.value = value; occurrence.returned = true; occurrence.settled = true;
    }, () => { occurrence.settled = true; burnQuietOriginal(); });
    const value = await occurrence.promise;
    occurrence.value = value; occurrence.returned = true; occurrence.settled = true;
    quietBasics(record); quietOwnerCheck(record); occurrence.unknown = false; return value;
  } catch { burnQuietOriginal(); fail(); }
}
function quietStorePort(record, body) {
  if (record.checking || record.metadataChecking) { burnQuietOriginal(); fail(); }
  quietBasics(record); record.checking = true;
  try { const value = body(); quietBasics(record); return value; }
  catch { burnQuietOriginal(); fail(); }
  finally { record.checking = false; }
}
function quietHistory(record) {
  quietOwnerCheck(record);
  const observed = quietStorePort(record, () => {
    const value = record.store.observeDashboardCutoverStoreV2(); quietBasics(record);
    if (value.storageState !== "settled" || (record.historyHash && value.storeObservationHash !== record.historyHash)
      || value.history.intents.length !== record.intents.length || value.history.completions.length !== record.completions.length) fail();
    for (const [index, bytes] of record.intents.entries())
      if (!record.records.encodeDashboardCutoverIntentV2(value.history.intents[index]).equals(bytes)) fail();
    for (const [index, bytes] of record.completions.entries())
      if (!record.records.encodeDashboardCutoverCompletionV2(value.history.completions[index]).equals(bytes)) fail();
    return value;
  });
  quietOwnerCheck(record); record.historyHash ??= observed.storeObservationHash; return observed;
}
function quietPhase(record, value) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const keys = ["observationHash", "spawnerLauncherConfigurationHash", "dashboardLauncherConfigurationHash"];
  const fields = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(fields);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key) || !fields[key].enumerable
    || !("value" in fields[key]) || !/^[a-f0-9]{64}$/.test(fields[key].value))) fail();
  if (fields.spawnerLauncherConfigurationHash.value !== record.open.spawnerLauncherConfigurationHash
    || fields.dashboardLauncherConfigurationHash.value !== record.open.dashboardLauncherConfigurationHash) fail();
  return fields.observationHash.value;
}
function quietPublication(record, step, kind, row) {
  quietHistory(record);
  const isIntent = kind === "intent";
  const bytes = isIntent ? record.records.encodeDashboardCutoverIntentV2(row) : record.records.encodeDashboardCutoverCompletionV2(row);
  const occurrence = { ordinal: step.ordinal, kind, intent: true, returned: false, confirmed: false, bytes, result: null };
  record.publications.push(occurrence); quietBasics(record);
  const published = quietStorePort(record, () => isIntent ? record.store.publishDashboardCutoverIntentV2(row, record.historyHash)
    : record.store.publishDashboardCutoverCompletionV2(row, record.historyHash));
  occurrence.result = published; occurrence.returned = true; quietBasics(record);
  (isIntent ? record.intents : record.completions).push(Buffer.from(bytes));
  record.historyHash = published.storeObservationHash;
  quietHistory(record); occurrence.confirmed = true;
}
export async function quietDeploymentCutoverLaunchersWithOwnerV4(owner, token, scope) {
  legacyOwnerEntry();
  if (arguments.length !== 3 || owner === null || typeof owner !== "object" || types.isProxy(owner)
    || token === null || typeof token !== "object" || types.isProxy(token)
    || scope === null || typeof scope !== "object" || types.isProxy(scope)) fail();
  const held = handles.get(owner); if (!held || !held.valid || uncertain) fail();
  const record = { owner, token, scope, held, claim: held.claim, adapter: null, launcher: null, records: null, store: null,
    checking: false, metadataChecking: false, unknown: false, complete: false, openBytes: null, open: null,
    imports: [], work: [], publications: [], intents: [], completions: [], historyHash: null, steps: [], ordinal: 0 };
  quietOriginal = record;
  try {
    record.adapter = await quietImport(record, "./deployment-dashboard-cutover-adapter-v2.mjs");
    quietOwnerCheck(record);
    record.records = await quietImport(record, new URL("../dist/internal-production/baseline-dashboard-cutover-records-v2.js", import.meta.url).href);
    quietOwnerCheck(record);
    record.store = await quietImport(record, new URL("../dist/internal-production/baseline-dashboard-cutover-store-v2.js", import.meta.url).href);
    quietOwnerCheck(record);
    record.launcher = await quietImport(record, new URL("../dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js", import.meta.url).href);
    quietHistory(record);
    for (const ordinal of [1, 2]) {
      record.ordinal = ordinal;
      const step = { ordinal, confirmed: false, dispatchIntent: false, returned: false };
      record.steps.push(step); quietOwnerCheck(record);
      const before = quietPhase(record, await quietWork(record, "before-phase", () =>
        record.launcher.observeHeldDashboardCutoverApprovedDefinitionQuietV4(scope)));
      const intent = record.records.createDashboardCutoverIntentV2({ cutoverIntentHash: record.open.cutoverIntentHash,
        ownerClaimHash: record.claim.ownerClaimHash, ordinal, previousCompletionHash: ordinal === 1 ? null
          : JSON.parse(record.completions[0].toString("utf8")).effectCompletionHash, beforeObservationHash: before });
      quietPublication(record, step, "intent", intent); step.confirmed = true;
      quietOwnerCheck(record); step.dispatchIntent = true;
      await quietWork(record, "bootout", () => ordinal === 1
        ? record.launcher.bootoutHeldDashboardCutoverApprovedDefinitionSpawnerV4(scope)
        : record.launcher.bootoutHeldDashboardCutoverApprovedDefinitionDashboardV4(scope));
      step.returned = true;
      const after = quietPhase(record, await quietWork(record, "after-phase", () =>
        record.launcher.observeHeldDashboardCutoverApprovedDefinitionQuietV4(scope)));
      const completion = record.records.createDashboardCutoverCompletionV2({ intent,
        completionOwnerClaimHash: record.claim.ownerClaimHash, afterObservationHash: after, outcome: "launcher-unloaded" });
      quietPublication(record, step, "completion", completion);
    }
    quietHistory(record); quietOwnerCheck(record); record.complete = true;
  } catch { burnQuietOriginal(); fail(); }
  // Never release originals or turn the settled journal prefix into authority.
}
