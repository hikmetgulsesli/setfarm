import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-spawner-startup-admission-v1.ts");

test("P4 startup module exact11 seals generation", async () => {
  const module = await import(`../../src/internal-production/baseline-spawner-startup-admission-v1.js?p4-real=${Date.now()}`);
  assert.deepEqual(Object.keys(module), [
    "executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1",
    "observeInternalProductionPreSchemaSpawnerRebindStatusV1",
    "prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1",
    "resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1",
    "resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1",
    "resolveInternalProductionPreSchemaSpawnerRebindStatusV1",
    "resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1",
    "resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1",
    "resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1",
    "resolveInternalProductionPreSchemaSpawnerStartupTokenV1",
    "resolveInternalProductionTask0SpawnerAdmissionReadyV1",
  ]);
  assert.equal(module.observeInternalProductionPreSchemaSpawnerRebindStatusV1.length, 0);
  assert.equal(module.resolveInternalProductionTask0SpawnerAdmissionReadyV1.length, 1);
  assert.equal(Object.keys(module).length, 11);

  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /state: "pre_manifest_bootstrap_sealed"/);
  assert.match(source, /admissionReady: null/);
  assert.match(source, /const replacementProcessHash = hashCanonicalJson\(replacementProcessIdentity\)/);
  assert.doesNotMatch(source, /replacementSpawnerProcessIdentityRef:\s*`setfarm:\/\/internal-production\/spawner-process-identity\/sha256\/\$\{after\.spawner\.processIdentityHash\}`/);
  assert.match(source, /authenticateObservedStatusHistoryV1/);
  assert.doesNotMatch(source, /prepareInternalProductionCurrentEntryOperationV1/);
  assert.doesNotMatch(source, /baseline-service-restart-helper-v1/);
});

test("P4 current-entry readiness stays same generation", async () => {
  const spawner = await import("../../src/spawner.js");
  const spawnerSource = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
  assert.equal(typeof spawner.transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1, "function");
  assert.equal(spawner.transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1.length, 0);
  assert.equal(typeof spawner.resolveInternalProductionBaselineSpawnerStartupAdmissionV1, "function");
  assert.equal(spawner.resolveInternalProductionBaselineSpawnerStartupAdmissionV1.length, 1);
  assert.equal(typeof spawner.prepareInternalProductionBaselineSpawnerStartupAdmissionV1, "function");
  assert.equal(spawner.prepareInternalProductionBaselineSpawnerStartupAdmissionV1.length, 1);
  assert.equal(typeof spawner.resolveInternalProductionBaselineSpawnerStartupAdmissionForRestartOperationV1, "function");
  assert.equal(spawner.resolveInternalProductionBaselineSpawnerStartupAdmissionForRestartOperationV1.length, 1);
  assert.equal(typeof spawner.resolveInternalProductionBaselineSpawnerStartupClaimV1, "function");
  assert.equal(spawner.resolveInternalProductionBaselineSpawnerStartupClaimV1.length, 1);
  assert.match(spawnerSource, /const task12StartupAdmissionCapabilitiesV1 = new WeakMap<object,/);
  assert.match(spawnerSource, /function task12HasExactStoredKeysV1\(/, "canonical JSON records validate their sorted wire keys without confusing them with declaration order");
  assert.match(spawnerSource, /task12HasExactStoredKeysV1\(admission, TASK12_STARTUP_ADMISSION_KEYS_V1\)/);
  assert.match(spawnerSource, /"bootstrapOperationRef", "bootstrapOperationHash", "restartLaunchOutboxHash"/);
  assert.doesNotMatch(spawnerSource, /restartStartupMarkerHash/);
  assert.match(spawnerSource, /by-operation\/sha256[\s\S]*startup-admission\.pair\.json/);
  assert.doesNotMatch(spawnerSource, /TASK12_STARTUP_ADMISSION_ROOT_V1 = path\.resolve\(process\.cwd\(\)/);
  assert.match(spawnerSource, /baseline-spawner-bootstrap-restart-v1/);
  assert.match(spawnerSource, /resolveInternalProductionBaselineSpawnerBootstrapRestartSequenceV1/);
  assert.doesNotMatch(spawnerSource, /if \(fs\.existsSync\(completed\)\) return null/);
  assert.match(spawnerSource, /function task12WriteExpectedPredecessorCasV1\(/, "the fixed pending admission uses expected-predecessor CAS after its initial publication");
  assert.match(spawnerSource, /function authenticateTask12PrivateDirectoryChainV1\(/, "startup authority stores pin their full directory chains");
  assert.match(spawnerSource, /function task12RecoverNoReplacePublicationV1\(/, "startup publication adopts the exact temp-only or linked-temp crash prefix");
  assert.doesNotMatch(spawnerSource, /fs\.mkdirSync\(path\.dirname\(target\), \{ recursive: true, mode: 0o700 \}\)/, "startup authority publication cannot recursively traverse unauthenticated ancestors");
  assert.match(spawnerSource, /recoverAndReleaseInternalProductionBaselineCompletionOwnerBootstrapTargetV1\(operationPair\)[\s\S]*finalizeInternalProductionBaselineSpawnerBootstrapRestartSequenceV1\(operationPair\)/, "bootstrap startup releases the completion owner before sequence finalization with the same pair");
  assert.doesNotMatch(spawnerSource, /Date\.now\(\) - process\.uptime\(\)/, "startup claim start time comes from the authenticated census rather than a local estimate");
  assert.match(spawnerSource, /census\.spawner\.pid !== process\.pid/, "only the census-authenticated replacement spawner may claim");
  assert.match(spawnerSource, /claim\.pid !== census\.spawner\.pid[\s\S]*claim\.processStartTimeEpochMs !== census\.spawner\.processStartTimeEpochMs[\s\S]*claim\.processIdentityHash !== census\.spawner\.processIdentityHash[\s\S]*claim\.currentGenerationHash !== census\.spawner\.processIdentityHash/, "claim resolution freshly revalidates every live process and physical restart-generation field");
});

test("P4 effects-committed completion has one code-owned Task12 bootstrap initiator", () => {
  const source = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
  const start = source.indexOf("async function applyAndAcceptRuntimeCompletionEffects(");
  const end = source.indexOf("\nasync function ", start + 1);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  const committed = body.indexOf("await completions.markEffectsCommitted(");
  const create = body.indexOf("createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1");
  const continuation = body.indexOf("continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1");
  const ordinary = body.indexOf("await completions.acceptAndRelease(");
  assert.ok(committed >= 0 && create > committed && continuation > create && ordinary > continuation);
  assert.match(body, /if \(verification === null\)[\s\S]*acceptAndRelease/);
  assert.match(body, /else[\s\S]*continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1/);
  assert.equal(body.match(/completionBootstrap\.createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1/g)?.length, 1);
  assert.equal(body.match(/completionBootstrap\.continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1/g)?.length, 1);
});

test("P4 startup fixed locators serialize CAS and normalize only authenticated stale temps", async () => {
  const production = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
  assert.match(production, /function task12StartupAdmissionPairFromStoredV1\(/);
  assert.match(production, /function task12AcquireLocatorMutationLockV1\(/);
  assert.match(production, /mutationLock = task12AcquireLocatorMutationLockV1\(target\)/);
  assert.match(production, /failure\.status === 1[\s\S]*state: "dead"[\s\S]*state: "ambiguous"/, "only an explicit ps no-PID result authorizes dead-owner reclamation");
  assert.match(production, /predecessorAfter\.nlink !== 0n[\s\S]*successorIdentity\.dev !== selected\.identity\.dev[\s\S]*successorIdentity\.ino !== selected\.identity\.ino/, "CAS pins both predecessor and successor inodes across rename");
  const sliceStart = production.indexOf("const TASK12_STARTUP_ADMISSION_ROOT_V1");
  const sliceEnd = production.indexOf("export async function resolveInternalProductionBaselineSpawnerStartupAdmissionV1(");
  assert.ok(sliceStart >= 0 && sliceEnd > sliceStart);
  const admissionStart = sliceEnd;
  const forOperationStart = production.indexOf("export async function resolveInternalProductionBaselineSpawnerStartupAdmissionForRestartOperationV1(");
  const prepareStart = production.indexOf("export async function prepareInternalProductionBaselineSpawnerStartupAdmissionV1(");
  const activeStart = production.indexOf("export async function resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1(");
  const claimStart = production.indexOf("export async function claimInternalProductionBaselineSpawnerStartupAdmissionV1(");
  const forOperation = production.slice(forOperationStart, prepareStart);
  const forOperationReceipt = forOperation.indexOf("  const receipt = await import(");
  const active = production.slice(activeStart, claimStart);
  const activeTerminal = active.indexOf("  if (admission.bootstrapOperationHash !== null)");
  const activeCapability = active.indexOf("  task12StartupAdmissionCapabilitiesV1.set(");
  assert.ok(forOperationStart > admissionStart && prepareStart > forOperationStart && activeStart > prepareStart && claimStart > activeStart && forOperationReceipt > 0 && activeTerminal > 0 && activeCapability > activeTerminal);
  const publicActiveSlice = `${production.slice(admissionStart, forOperationStart)}${forOperation.slice(0, forOperationReceipt)}  return pair;\n}\n${active.slice(0, activeTerminal)}${active.slice(activeCapability)}`;
  const locatorKernel = production.slice(sliceStart, sliceEnd)
    .replace(
      "    const current = fs.lstatSync(target, { bigint: true });",
      "    ((globalThis as Record<string, unknown>).__p4CasBeforePredecessorRecheck as undefined | ((target: string) => void))?.(target);\n    const current = fs.lstatSync(target, { bigint: true });",
    )
    .replace(
      "      const now = fs.fstatSync(item.descriptor, { bigint: true });",
      "      ((globalThis as Record<string, unknown>).__p4SpawnerBeforeTempUnlink as undefined | ((member: string) => void))?.(item.temp);\n      const now = fs.fstatSync(item.descriptor, { bigint: true });",
    )
    .replace(
      "      try { fs.fsyncSync(directoryDescriptor); } finally { fs.closeSync(directoryDescriptor); }",
      "      try { fs.fsyncSync(directoryDescriptor); ((globalThis as Record<string, unknown>).__p4SpawnerAfterTempFsync as undefined | ((member: string) => void))?.(item.temp); } finally { fs.closeSync(directoryDescriptor); }",
    );
  assert.notEqual(locatorKernel, production.slice(sliceStart, sliceEnd));

  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-p4-startup-locator-")));
  try {
    const sourceDirectory = path.join(fixture, "src");
    mkdirSync(sourceDirectory, { recursive: true });
    const harnessPath = path.join(sourceDirectory, "locator-harness.ts");
    writeFileSync(harnessPath, `
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
type InternalProductionBaselineSpawnerStartupAdmissionPairV1 = Readonly<{ startupAdmissionRef: string; startupAdmissionHash: string }>;
${locatorKernel}
${publicActiveSlice}
export { task12AcquireLocatorMutationLockV1, task12CanonicalV1, task12HashV1, task12StartupAdmissionPairFromStoredV1, task12WriteExpectedPredecessorCasV1, task12WriteNoReplaceV1 };
`, "utf8");
    const harness = await import(`${pathToFileURL(harnessPath).href}?locator=${Date.now()}`) as Readonly<{
      task12CanonicalV1: (value: unknown) => string;
      task12HashV1: (value: unknown) => string;
      task12StartupAdmissionPairFromStoredV1: (value: unknown) => Readonly<{ startupAdmissionRef: string; startupAdmissionHash: string }>;
      task12WriteExpectedPredecessorCasV1: (target: string, predecessor: unknown, successor: unknown) => void;
      task12WriteNoReplaceV1: (target: string, value: unknown) => void;
      task12AcquireLocatorMutationLockV1: (target: string) => Readonly<{ close: () => void }>;
      resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1: () => Promise<Record<string, unknown> | null>;
    }>;
    const hash = "a".repeat(64);
    const pair = { startupAdmissionRef: `setfarm://internal-production/baseline-spawner-startup-admission/sha256/${hash}`, startupAdmissionHash: hash };
    const storedPair = JSON.parse(harness.task12CanonicalV1(pair));
    const reconstructed = harness.task12StartupAdmissionPairFromStoredV1(storedPair);
    assert.deepEqual(Object.keys(reconstructed), ["startupAdmissionRef", "startupAdmissionHash"]);
    assert.deepEqual(reconstructed, pair);

    const target = path.join(fixture, "data/private/pending.json");
    harness.task12WriteNoReplaceV1(target, pair);
    const tempOnlyTarget = path.join(fixture, "data/private/temp-only.json");
    const tempOnly = `${tempOnlyTarget}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(tempOnly, `${harness.task12CanonicalV1(pair)}\n`, { mode: 0o600 });
    harness.task12WriteNoReplaceV1(tempOnlyTarget, pair);
    assert.deepEqual(JSON.parse(readFileSync(tempOnlyTarget, "utf8")), JSON.parse(harness.task12CanonicalV1(pair)), "authenticated pre-link temp becomes the absent target");
    assert.throws(() => statSync(tempOnly), /ENOENT/);
    for (const count of [2, 8]) {
      const multiTarget = path.join(fixture, `data/private/multi-prelink-${count}.json`);
      const names = Array.from({ length: count }, (_, index) => `${multiTarget}.tmp-${process.pid}-${`32345678-1234-4123-8123-${String(count - index).padStart(12, "0")}`}`);
      for (const member of names) writeFileSync(member, `${harness.task12CanonicalV1(pair)}\n`, { mode: 0o600 });
      const expectedIdentity = statSync([...names].sort()[0]!).ino;
      harness.task12WriteNoReplaceV1(multiTarget, pair);
      assert.equal(statSync(multiTarget).ino, expectedIdentity, `${count} equal pre-link temps select the unsigned-name-first inode`);
      assert.equal(names.some(statExists), false, `${count} equal pre-link temps are all cleaned after adoption`);
    }
    const stale = `${target}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(stale, `${harness.task12CanonicalV1(pair)}\n`, { mode: 0o600 });
    harness.task12WriteNoReplaceV1(target, pair);
    assert.throws(() => statSync(stale), /ENOENT/);
    const invalidStale = `${target}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(invalidStale, `${harness.task12CanonicalV1({ crossed: true })}\n`, { mode: 0o600 });
    assert.throws(() => harness.task12WriteNoReplaceV1(target, pair), /TEMP_CANDIDATE_INVALID/);
    assert.equal(readFileSync(invalidStale, "utf8"), `${harness.task12CanonicalV1({ crossed: true })}\n`);
    unlinkSync(invalidStale);

    const replacementTarget = path.join(fixture, "data/private/replacement-race.json");
    harness.task12WriteNoReplaceV1(replacementTarget, pair);
    const replacementTemp = `${replacementTarget}.tmp-${process.pid}-42345678-1234-4123-8123-999999999999`;
    const replacementPinned = `${replacementTemp}.pinned`;
    writeFileSync(replacementTemp, `${harness.task12CanonicalV1(pair)}\n`, { mode: 0o600 });
    let replaced = false;
    (globalThis as Record<string, unknown>).__p4SpawnerBeforeTempUnlink = (member: string) => {
      if (replaced) return;
      replaced = true;
      renameSync(member, replacementPinned);
      writeFileSync(member, `${harness.task12CanonicalV1(pair)}\n`, { mode: 0o600 });
    };
    assert.throws(() => harness.task12WriteNoReplaceV1(replacementTarget, pair), /TEMP_CANDIDATE_CHANGED|LINKED_TEMP_IDENTITY_INVALID/);
    Reflect.deleteProperty(globalThis, "__p4SpawnerBeforeTempUnlink");
    assert.equal(statExists(replacementTemp), true, "a foreign replacement at the startup temp path is never unlinked");

    const cleanupCrashTarget = path.join(fixture, "data/private/cleanup-crash.json");
    const cleanupCrashTemps = [
      `${cleanupCrashTarget}.tmp-${process.pid}-52345678-1234-4123-8123-000000000001`,
      `${cleanupCrashTarget}.tmp-${process.pid}-52345678-1234-4123-8123-000000000002`,
    ];
    for (const member of cleanupCrashTemps) writeFileSync(member, `${harness.task12CanonicalV1(pair)}\n`, { mode: 0o600 });
    let cleanupFaults = 2;
    (globalThis as Record<string, unknown>).__p4SpawnerAfterTempFsync = () => { if (cleanupFaults-- > 0) throw new Error("P4_SPAWNER_AFTER_TEMP_FSYNC"); };
    assert.throws(() => harness.task12WriteNoReplaceV1(cleanupCrashTarget, pair), /P4_SPAWNER_AFTER_TEMP_FSYNC/);
    assert.equal(cleanupCrashTemps.filter(statExists).length, 1, "one startup candidate is durably removed before the first crash");
    assert.throws(() => harness.task12WriteNoReplaceV1(cleanupCrashTarget, pair), /P4_SPAWNER_AFTER_TEMP_FSYNC/);
    assert.equal(cleanupCrashTemps.filter(statExists).length, 0, "the retry durably removes only the remaining startup candidate");
    Reflect.deleteProperty(globalThis, "__p4SpawnerAfterTempFsync");
    harness.task12WriteNoReplaceV1(cleanupCrashTarget, pair);
    assert.deepEqual(JSON.parse(readFileSync(cleanupCrashTarget, "utf8")), JSON.parse(harness.task12CanonicalV1(pair)));

    const staleLockTarget = path.join(fixture, "data/private/hardlinked-stale-lock-target.json");
    const staleLockPath = `${staleLockTarget}.controller.lock`;
    const staleLockAlias = `${staleLockPath}.alias`;
    const staleOwner = {
      schema: "setfarm.internal-production-task12-locator-mutation-lock.v1",
      targetHash: harness.task12HashV1({ schema: "setfarm.internal-production-task12-locator-mutation-target.v1", target: staleLockTarget }),
      pid: 999999,
      processStart: "Mon Jan 01 00:00:00 2001",
      processCommandHash: "d".repeat(64),
      processIdentityHash: "e".repeat(64),
      nonce: randomUUID(),
    };
    writeFileSync(staleLockPath, `${harness.task12CanonicalV1(staleOwner)}\n`, { mode: 0o600 });
    linkSync(staleLockPath, staleLockAlias);
    assert.throws(() => harness.task12AcquireLocatorMutationLockV1(staleLockTarget), /LOCK_CHANGED|LOCK_INVALID/);
    assert.equal(statSync(staleLockPath).nlink, 2, "hardlinked stale lock remains untouched");
    assert.equal(statSync(staleLockAlias).nlink, 2, "hardlinked stale lock alias remains untouched");

    const predecessor = pair;
    const successorA = { startupAdmissionRef: pair.startupAdmissionRef, startupAdmissionHash: "b".repeat(64) };
    const successorB = { startupAdmissionRef: pair.startupAdmissionRef, startupAdmissionHash: "c".repeat(64) };
    const readyA = path.join(fixture, "ready-a");
    const readyB = path.join(fixture, "ready-b");
    const go = path.join(fixture, "go");
    const worker = `
import fs from "node:fs";
const module = await import(process.argv[1]);
const [target, predecessor, successor, ready, go] = process.argv.slice(2);
fs.writeFileSync(ready, "ready");
while (!fs.existsSync(go)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
module.task12WriteExpectedPredecessorCasV1(target, JSON.parse(predecessor), JSON.parse(successor));
`;
    const launch = (successor: unknown, ready: string) => spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", worker, pathToFileURL(harnessPath).href, target, JSON.stringify(predecessor), JSON.stringify(successor), ready, go], { stdio: "ignore" });
    const first = launch(successorA, readyA);
    const second = launch(successorB, readyB);
    for (let attempt = 0; attempt < 500 && (!statExists(readyA) || !statExists(readyB)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(statExists(readyA) && statExists(readyB), true);
    writeFileSync(go, "go");
    const [[firstCode], [secondCode]] = await Promise.all([once(first, "exit"), once(second, "exit")]) as [[number], [number]];
    assert.deepEqual([firstCode, secondCode].sort(), [0, 1]);
    const final = JSON.parse(readFileSync(target, "utf8"));
    assert.ok(final.startupAdmissionHash === successorA.startupAdmissionHash || final.startupAdmissionHash === successorB.startupAdmissionHash);
    assert.equal(statExists(`${target}.controller.lock`), false);

    const inodeTarget = path.join(fixture, "data/private/inode-swap.json");
    const inodeBackup = `${inodeTarget}.original`;
    harness.task12WriteNoReplaceV1(inodeTarget, predecessor);
    (globalThis as Record<string, unknown>).__p4CasBeforePredecessorRecheck = (candidate: string) => {
      renameSync(candidate, inodeBackup);
      writeFileSync(candidate, `${harness.task12CanonicalV1(predecessor)}\n`, { mode: 0o600 });
    };
    await assert.rejects(
      Promise.resolve().then(() => harness.task12WriteExpectedPredecessorCasV1(inodeTarget, predecessor, successorA)),
      /PENDING_PREDECESSOR_CHANGED/,
      "equal predecessor bytes on a foreign inode cannot satisfy the pinned CAS",
    );
    Reflect.deleteProperty(globalThis, "__p4CasBeforePredecessorRecheck");
    assert.deepEqual(JSON.parse(readFileSync(inodeTarget, "utf8")), JSON.parse(harness.task12CanonicalV1(predecessor)));
    assert.deepEqual(JSON.parse(readFileSync(inodeBackup, "utf8")), JSON.parse(harness.task12CanonicalV1(predecessor)));
    assert.equal(statExists(`${inodeTarget}.controller.lock`), false);

    const crashTarget = path.join(fixture, "data/private/cas-crash.json");
    harness.task12WriteNoReplaceV1(crashTarget, predecessor);
    const crashTemp = `${crashTarget}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(crashTemp, `${harness.task12CanonicalV1(successorA)}\n`, { mode: 0o600 });
    harness.task12WriteExpectedPredecessorCasV1(crashTarget, predecessor, successorA);
    assert.deepEqual(JSON.parse(readFileSync(crashTarget, "utf8")), JSON.parse(harness.task12CanonicalV1(successorA)), "CAS adopts a durable pre-rename successor temp");
    assert.equal(statExists(crashTemp), false);

    const eightTarget = path.join(fixture, "data/private/cas-eight.json");
    harness.task12WriteNoReplaceV1(eightTarget, predecessor);
    const eightTemps = Array.from({ length: 8 }, (_, index) => `${eightTarget}.tmp-${process.pid}-${`12345678-1234-4123-8123-${String(index + 1).padStart(12, "0")}`}`);
    for (const member of eightTemps) writeFileSync(member, `${harness.task12CanonicalV1(successorA)}\n`, { mode: 0o600 });
    harness.task12WriteExpectedPredecessorCasV1(eightTarget, predecessor, successorA);
    assert.equal(eightTemps.some(statExists), false);
    assert.deepEqual(JSON.parse(readFileSync(eightTarget, "utf8")), JSON.parse(harness.task12CanonicalV1(successorA)));

    const ninthTarget = path.join(fixture, "data/private/cas-nine.json");
    harness.task12WriteNoReplaceV1(ninthTarget, predecessor);
    const ninthTemps = Array.from({ length: 9 }, (_, index) => `${ninthTarget}.tmp-${process.pid}-${`22345678-1234-4123-8123-${String(index + 1).padStart(12, "0")}`}`);
    for (const member of ninthTemps) writeFileSync(member, `${harness.task12CanonicalV1(successorA)}\n`, { mode: 0o600 });
    assert.throws(() => harness.task12WriteExpectedPredecessorCasV1(ninthTarget, predecessor, successorA), /TEMP_CANDIDATE_CAP/);
    assert.deepEqual(ninthTemps.filter(statExists), ninthTemps, "ninth refusal leaves every authenticated crash candidate untouched");
    assert.deepEqual(JSON.parse(readFileSync(ninthTarget, "utf8")), JSON.parse(harness.task12CanonicalV1(predecessor)));

    const startupRoot = path.join(fixture, "data/internal-production-baseline/baseline-spawner-startup-admission-v1");
    const makeAdmission = (operationId: string) => {
      const body = { kind: "authenticated-internal-production-baseline-spawner-startup-admission", admissionMode: "ordinary-manifest-backed", service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", operationId, bootstrapOperationRef: null, bootstrapOperationHash: null, restartLaunchOutboxHash: "1".repeat(64), expectedRuntimeSourceProjectionHash: "2".repeat(64), expectedSetfarmSha: "3".repeat(40), expectedSpawnerBuildHash: "4".repeat(64), migrationReceiptRef: `setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/${"5".repeat(64)}`, migrationReceiptHash: "5".repeat(64), manifestActivationRef: `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${"6".repeat(64)}`, manifestActivationHash: "6".repeat(64), genericFullVerifyRequired: true, beforeGenerationHash: "7".repeat(64) };
      const admissionHash = harness.task12HashV1(body);
      return { admission: { ...body, admissionHash }, pair: { startupAdmissionRef: `setfarm://internal-production/baseline-spawner-startup-admission/sha256/${admissionHash}`, startupAdmissionHash: admissionHash } };
    };
    const firstAdmission = makeAdmission("8".repeat(64));
    const firstRecord = path.join(startupRoot, "records/sha256", firstAdmission.pair.startupAdmissionHash.slice(0, 2), `${firstAdmission.pair.startupAdmissionHash}.json`);
    const firstByOperation = path.join(startupRoot, "by-operation/sha256", "88", "8".repeat(64), "startup-admission.pair.json");
    const pending = path.join(startupRoot, "pending/current-startup-admission.pair.json");
    harness.task12WriteNoReplaceV1(firstRecord, firstAdmission.admission);
    harness.task12WriteNoReplaceV1(firstByOperation, firstAdmission.pair);
    harness.task12WriteNoReplaceV1(pending, firstAdmission.pair);
    assert.equal((await harness.resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1())?.admissionHash, firstAdmission.pair.startupAdmissionHash, "public active resolver traverses pending, content and by-operation authorities");
    const crossedAdmission = makeAdmission("9".repeat(64));
    const crossedRecord = path.join(startupRoot, "records/sha256", crossedAdmission.pair.startupAdmissionHash.slice(0, 2), `${crossedAdmission.pair.startupAdmissionHash}.json`);
    const crossedByOperation = path.join(startupRoot, "by-operation/sha256", "99", "9".repeat(64), "startup-admission.pair.json");
    harness.task12WriteNoReplaceV1(crossedRecord, crossedAdmission.admission);
    harness.task12WriteNoReplaceV1(crossedByOperation, firstAdmission.pair);
    harness.task12WriteExpectedPredecessorCasV1(pending, firstAdmission.pair, crossedAdmission.pair);
    await assert.rejects(harness.resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1(), /OPERATION_CROSSED|PENDING_CROSSED/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function statExists(target: string): boolean {
  try { statSync(target); return true; } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return false; throw error; }
}

test("P4 startup executeOrRecover is sole mutation writer", () => {
  const source = readFileSync(sourcePath, "utf8");
  const tree = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const mutators = new Set(["writeNoReplace", "publishRecord", "publishOperationPair", "publishStatus"]);
  const exportedCalls = new Map<string, Set<string>>();
  for (const statement of tree.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const calls = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && mutators.has(node.expression.text)) calls.add(node.expression.text);
      ts.forEachChild(node, visit);
    };
    visit(statement.body);
    exportedCalls.set(statement.name.text, calls);
  }
  assert.deepEqual([...exportedCalls.entries()].filter(([name]) => name !== "executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1").flatMap(([name, calls]) => [...calls].map((call) => `${name}:${call}`)), []);
  assert.deepEqual([...exportedCalls.get("executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1")!].sort(), ["publishOperationPair", "publishRecord", "publishStatus", "writeNoReplace"]);
  const execute = tree.statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === "executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1");
  assert.ok(execute?.body?.getText().includes("invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1"));
  assert.ok(execute?.body?.getText().includes("releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1"));
  assert.match(source, /spawnSync\("\/bin\/ps"/);
  assert.doesNotMatch(source, /baseline-service-restart-helper-v1/);
});

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

test("P4 startup resolvers reject impossible status and fixed-prefix gaps", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-startup-resolver-"));
  try {
    const internal = path.join(fixture, "src/internal-production");
    const compiler = path.join(fixture, "src/product-compiler");
    mkdirSync(internal, { recursive: true });
    mkdirSync(compiler, { recursive: true });
    writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), readFileSync(sourcePath));
    writeFileSync(path.join(compiler, "canonical-json.ts"), readFileSync(path.resolve(import.meta.dirname, "../../src/product-compiler/canonical-json.ts")));
    const operationHash = "a".repeat(64);
    const operationRef = `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`;
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
export async function observePreparedInternalProductionCurrentEntryOperationV1(){return {operationRef:${JSON.stringify(operationRef)},operationHash:${JSON.stringify(operationHash)}}}
export async function resolveInternalProductionCurrentEntryOperationV1(pair){return {...pair,schema:"setfarm.internal-production-current-entry-operation.v1",purpose:"task6a-internal-production-current-entry-v1",controllerSource:{sha:${JSON.stringify("1".repeat(40))},treeHash:${JSON.stringify("2".repeat(40))},buildHash:${JSON.stringify("3".repeat(64))}},authorityV3Migration31Audit:{authorityV3Migration31AuditRef:${JSON.stringify(`setfarm://internal-production/authority-v3-migration31-audit/sha256/${"4".repeat(64)}`)},authorityV3Migration31AuditHash:${JSON.stringify("4".repeat(64))}}}}
export async function observeInternalProductionServiceCensusV1(){throw new Error("UNUSED")}
export async function observeInternalProductionLegacyPreManifestZeroOwnerV1(){throw new Error("UNUSED")}
export async function resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(){throw new Error("UNUSED")}
`, "utf8");
    writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), `
export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){throw new Error("UNUSED")}
export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){throw new Error("UNUSED")}
export async function invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(){throw new Error("UNUSED")}
`, "utf8");
    const module = await import(`${pathToFileURL(path.join(internal, "baseline-spawner-startup-admission-v1.ts")).href}?case=${Date.now()}`);
    const store = path.join(fixture, "data/internal-production-baseline/pre-schema-spawner-rebind-v1");
    const statusStore = path.join(store, "records/status/sha256");
    const operationStore = path.join(store, "operations/sha256", operationHash);
    mkdirSync(operationStore, { recursive: true });
    const persistStatus = (input: Record<string, unknown>, locator: string | null) => {
      const statusHash = hashCanonicalJson(input);
      const statusRef = `setfarm://internal-production/pre-schema-spawner-rebind-status/sha256/${statusHash}`;
      const value = { ...input, statusRef, statusHash };
      const directory = path.join(statusStore, statusHash.slice(0, 2));
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, `${statusHash}.json`), `${canonical(value)}\n`);
      if (locator !== null) writeFileSync(path.join(operationStore, `${locator}.pair.json`), `${canonical({ statusRef, statusHash })}\n`);
      return { statusRef, statusHash };
    };
    const absentPair = persistStatus({
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1",
      state: "absent", currentEntryOperation: null, authorization: null, startupToken: null,
      restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null,
      refusalCode: null,
    }, null);
    const absent = await module.resolveInternalProductionPreSchemaSpawnerRebindStatusV1(absentPair);
    assert.equal(absent.state, "absent");
    assert.equal(Object.isFrozen(absent), true);

    persistStatus({
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1",
      state: "prepared",
      currentEntryOperation: { operationRef, operationHash },
      authorization: { authorizationRef: `setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/${"b".repeat(64)}`, authorizationHash: "b".repeat(64) },
      startupToken: null, restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null,
      refusalCode: null,
    }, "status-00-prepared");
    await assert.rejects(
      module.observeInternalProductionPreSchemaSpawnerRebindStatusV1(),
      /operation prefix|material prefix|authorization/i,
      "status authority must not resolve without reopening its operation/material prefix",
    );
    const impossiblePair = persistStatus({
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1",
      state: "prepared",
      currentEntryOperation: { operationRef, operationHash },
      authorization: { authorizationRef: `setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/${"b".repeat(64)}`, authorizationHash: "b".repeat(64) },
      startupToken: { startupTokenRef: `setfarm://internal-production/pre-schema-spawner-startup-token/sha256/${"c".repeat(64)}`, startupTokenHash: "c".repeat(64) },
      restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null,
      refusalCode: null,
    }, "status-02-restart-authority-published");
    await assert.rejects(module.resolveInternalProductionPreSchemaSpawnerRebindStatusV1(impossiblePair), /prepared status prefix is invalid/);
    await assert.rejects(module.observeInternalProductionPreSchemaSpawnerRebindStatusV1(), /status prefix is not contiguous|operation prefix|material operation prefix/);

    const startupTokenHash = "c".repeat(64);
    const restartAuthorityHash = "d".repeat(64);
    const blockedPair = persistStatus({
      schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1",
      state: "blocked",
      currentEntryOperation: { operationRef, operationHash },
      authorization: { authorizationRef: `setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/${"b".repeat(64)}`, authorizationHash: "b".repeat(64) },
      startupToken: { startupTokenRef: `setfarm://internal-production/pre-schema-spawner-startup-token/sha256/${startupTokenHash}`, startupTokenHash },
      restartAuthority: { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash },
      dispatchPrefix: { phase: "restart_authority_published", predecessorTerminationObservation: null, replacementProcessObservation: null },
      sealedAdmission: null,
      admissionReady: null,
      refusalCode: "HELPER_DISPATCH_SETTLEMENT_UNKNOWN",
    }, "status-blocked-helper-dispatch-settlement-unknown");
    const blocked = await module.resolveInternalProductionPreSchemaSpawnerRebindStatusV1(blockedPair);
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.refusalCode, "HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
    const blockedRecord = path.join(statusStore, blockedPair.statusHash.slice(0, 2), `${blockedPair.statusHash}.json`);
    const heldRecord = `${blockedRecord}.held`;
    renameSync(blockedRecord, heldRecord);
    symlinkSync(heldRecord, blockedRecord);
    await assert.rejects(module.resolveInternalProductionPreSchemaSpawnerRebindStatusV1(blockedPair), /ELOOP|record identity|symbolic/i);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup recovery reopens the durable helper-blocked prefix before live derivation", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-startup-reentry-"));
  try {
    const internal = path.join(fixture, "src/internal-production");
    const compiler = path.join(fixture, "src/product-compiler");
    mkdirSync(internal, { recursive: true });
    mkdirSync(compiler, { recursive: true });
    writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), readFileSync(sourcePath));
    writeFileSync(path.join(compiler, "canonical-json.ts"), readFileSync(path.resolve(import.meta.dirname, "../../src/product-compiler/canonical-json.ts")));
    const operationHash = "1".repeat(64);
    const operationRef = `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`;
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
let legacyCalls = 0;
const operation = {
  operationRef:${JSON.stringify(operationRef)}, operationHash:${JSON.stringify(operationHash)},
  controllerSource:{sha:${JSON.stringify("2".repeat(40))},treeHash:${JSON.stringify("3".repeat(40))},buildHash:${JSON.stringify("4".repeat(64))}},
  authorityV3Migration31Audit:{authorityV3Migration31AuditRef:${JSON.stringify(`setfarm://internal-production/authority-v3-migration31-audit/sha256/${"5".repeat(64)}`)},authorityV3Migration31AuditHash:${JSON.stringify("5".repeat(64))}}
};
const census = {spawner:{pid:99999,processStartTimeEpochMs:1,processIdentityHash:${JSON.stringify("6".repeat(64))},serviceIdentityHash:${JSON.stringify("7".repeat(64))},generationHash:${JSON.stringify("8".repeat(64))},loadedSourceSha:operation.controllerSource.sha,loadedTreeHash:operation.controllerSource.treeHash,loadedBuildHash:operation.controllerSource.buildHash}};
const legacy = {observationRef:${JSON.stringify(`setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/${"9".repeat(64)}`)},observationHash:${JSON.stringify("9".repeat(64))},cleanSetfarmSourceSha:operation.controllerSource.sha,cleanSetfarmTreeHash:operation.controllerSource.treeHash,cleanSetfarmBuildHash:operation.controllerSource.buildHash,observedSpawnerGenerationHash:census.spawner.generationHash};
export async function observePreparedInternalProductionCurrentEntryOperationV1(){return operation}
export async function resolveInternalProductionCurrentEntryOperationV1(){return operation}
export async function observeInternalProductionServiceCensusV1(){return census}
export async function observeInternalProductionLegacyPreManifestZeroOwnerV1(){legacyCalls+=1;if(legacyCalls>2)throw new Error("LIVE_DERIVE_FORBIDDEN");return legacy}
export async function resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(){return legacy}
`, "utf8");
    writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), `
let invokes=0;
const lease=Object.freeze({schema:"setfarm.internal-production-physical-service-restart-authority-transition-lease.v1"});
export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){return lease}
export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){}
export async function invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(){invokes+=1;throw new Error(invokes===1?"HELPER_DISPATCH_SETTLEMENT_UNKNOWN":"SECOND_REACHED_RETIREMENT")}
`, "utf8");
    const module = await import(`${pathToFileURL(path.join(internal, "baseline-spawner-startup-admission-v1.ts")).href}?reentry=${Date.now()}`);
    const authorization = await module.prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1();
    await assert.rejects(module.executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1(authorization), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    const blocked = await module.observeInternalProductionPreSchemaSpawnerRebindStatusV1();
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.refusalCode, "HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
    const operationDirectory = path.join(fixture, "data/internal-production-baseline/pre-schema-spawner-rebind-v1/operations/sha256", operationHash);
    const restartFinal = path.join(operationDirectory, "03-restart-authority.pair.json");
    const collisionTemporary = path.join(operationDirectory, ".03-restart-authority.pair.json.123e4567-e89b-42d3-a456-426614174000.tmp");
    writeFileSync(collisionTemporary, readFileSync(restartFinal), { mode: 0o600 });
    await assert.rejects(module.executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1(authorization), /SECOND_REACHED_RETIREMENT/);
    assert.throws(() => readFileSync(collisionTemporary), /ENOENT/, "exact EEXIST collision temp must be cleaned before recovery advances");
    const laterTemporary = path.join(operationDirectory, ".07-sealed-admission.pair.json.123e4567-e89b-42d3-a456-426614174000.tmp");
    const sealedHash = "a".repeat(64);
    writeFileSync(laterTemporary, `${canonical({ sealedAdmissionRef: `setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/${sealedHash}`, sealedAdmissionHash: sealedHash })}\n`, { mode: 0o600 });
    await assert.rejects(module.executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1(authorization), /not the immediate next publication/);
    unlinkSync(laterTemporary);
    await assert.rejects(module.executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1(authorization), /SECOND_REACHED_RETIREMENT/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup durable publication automaton repairs every fixed crash boundary", async () => {
  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-p4-startup-publication-boundaries-")));
  try {
    const internal = path.join(fixture, "src/internal-production");
    const compiler = path.join(fixture, "src/product-compiler");
    mkdirSync(internal, { recursive: true });
    mkdirSync(compiler, { recursive: true });
    const source = readFileSync(sourcePath, "utf8").replace("function writeNoReplace(file: string, value: unknown): void", "export function writeNoReplace(file: string, value: unknown): void");
    writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), source);
    writeFileSync(path.join(compiler, "canonical-json.ts"), readFileSync(path.resolve(import.meta.dirname, "../../src/product-compiler/canonical-json.ts")));
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), "export async function observePreparedInternalProductionCurrentEntryOperationV1(){return null}\nexport async function resolveInternalProductionCurrentEntryOperationV1(){throw new Error('UNUSED')}\nexport async function observeInternalProductionServiceCensusV1(){throw new Error('UNUSED')}\nexport async function observeInternalProductionLegacyPreManifestZeroOwnerV1(){throw new Error('UNUSED')}\nexport async function resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(){throw new Error('UNUSED')}\n");
    writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), "export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){throw new Error('UNUSED')}\nexport async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){throw new Error('UNUSED')}\nexport async function invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(){throw new Error('UNUSED')}\n");
    const loaded = await import(`${pathToFileURL(path.join(internal, "baseline-spawner-startup-admission-v1.ts")).href}?publication-boundaries=${Date.now()}`) as Readonly<{ writeNoReplace: (file: string, value: unknown) => void }>;
    const directory = path.join(fixture, "durable-boundaries");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const boundaries = [
      "legacy-observation.json", "authorization-record.json", "00-pre-dispatch-legacy-zero.pair.json", "01-authorization.pair.json", "status-00-prepared.pair.json",
      "process-identity.json", "startup-token-record.json", "02-startup-token.pair.json", "status-01-startup-token-published.pair.json",
      "restart-authority-record.json", "03-restart-authority.pair.json", "status-02-restart-authority-published.pair.json",
      "04-predecessor-termination.pair.json", "status-03-predecessor-terminated.pair.json", "05-replacement-process.pair.json", "status-04-replacement-observed.pair.json",
      "06-post-termination-legacy-zero.pair.json", "07-sealed-admission.pair.json", "status-05-pre-manifest-bootstrap-sealed.pair.json",
    ];
    for (const [ordinal, basename] of boundaries.entries()) {
      const target = path.join(directory, basename);
      const value = { boundary: basename, ordinal };
      const temporary = path.join(directory, `.${basename}.123e4567-e89b-42d3-a456-426614174000.tmp`);
      writeFileSync(temporary, `${canonical(value)}\n`, { mode: 0o600 });
      loaded.writeNoReplace(target, value);
      assert.equal(readFileSync(target, "utf8"), `${canonical(value)}\n`, `${basename} final bytes`);
      assert.equal(readFileSync(target, "utf8"), `${canonical(value)}\n`, `${basename} remains adoptable`);
      assert.doesNotThrow(() => loaded.writeNoReplace(target, value));
    }
    const linkedTarget = path.join(directory, "linked-final-crash.pair.json");
    const linkedTemporary = path.join(directory, ".linked-final-crash.pair.json.123e4567-e89b-42d3-a456-426614174000.tmp");
    const linkedValue = { boundary: "after-link-before-temp-unlink" };
    writeFileSync(linkedTemporary, `${canonical(linkedValue)}\n`, { mode: 0o600 });
    linkSync(linkedTemporary, linkedTarget);
    assert.doesNotThrow(() => loaded.writeNoReplace(linkedTarget, linkedValue));
    assert.equal(readFileSync(linkedTarget, "utf8"), `${canonical(linkedValue)}\n`);
    assert.throws(() => readFileSync(linkedTemporary), /ENOENT/);
    const crossedTarget = path.join(directory, "status-blocked-helper-dispatch-settlement-unknown.pair.json");
    const crossedTemporary = path.join(directory, ".status-blocked-helper-dispatch-settlement-unknown.pair.json.123e4567-e89b-42d3-a456-426614174000.tmp");
    writeFileSync(crossedTemporary, `${canonical({ crossed: true })}\n`, { mode: 0o600 });
    assert.throws(() => loaded.writeNoReplace(crossedTarget, { crossed: false }), /immutable record differs/);

    const wrongModeTarget = path.join(directory, "wrong-mode-final.json");
    const wrongModeValue = { boundary: "wrong-mode-final" };
    writeFileSync(wrongModeTarget, `${canonical(wrongModeValue)}\n`, { mode: 0o600 });
    chmodSync(wrongModeTarget, 0o644);
    assert.throws(
      () => loaded.writeNoReplace(wrongModeTarget, wrongModeValue),
      /immutable record differs|mode|identity/,
      "a self-consistent wrong-mode final must not be adopted",
    );
    chmodSync(wrongModeTarget, 0o4600);
    assert.equal(statSync(wrongModeTarget).mode & 0o7777, 0o4600, "special-bit fixture must retain setuid");
    assert.throws(
      () => loaded.writeNoReplace(wrongModeTarget, wrongModeValue),
      /immutable record differs|mode|identity/,
      "special permission bits must not pass an exact 0600 check",
    );

    const insecureParent = path.join(fixture, "data");
    mkdirSync(insecureParent, { mode: 0o755 });
    chmodSync(insecureParent, 0o755);
    assert.throws(
      () => loaded.writeNoReplace(path.join(insecureParent, "internal-production-baseline", "bad-mode", "record.json"), { boundary: "bad-mode-parent" }),
      /directory|mode|ancestor/,
      "an insecure authority-store ancestor must be rejected",
    );
    const external = path.join(fixture, "external-authority-store");
    mkdirSync(external, { mode: 0o700 });
    const linkedParent = path.join(fixture, "linked-authority-store");
    symlinkSync(external, linkedParent);
    assert.throws(
      () => loaded.writeNoReplace(path.join(linkedParent, "record.json"), { boundary: "symlink-parent" }),
      /directory|symbolic|ancestor/,
      "a symlink authority-store ancestor must be rejected",
    );

    const directoryRaceSource = source.replace(
      "const directoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(file));\n  try {\n    directoryGuard.assertStable();",
      "const directoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(file));\n  try {\n    const directoryRaceHook = Reflect.get(globalThis, '__setfarmP4DirectoryRaceHook');\n    if (typeof directoryRaceHook === 'function') directoryRaceHook();\n    directoryGuard.assertStable();",
    );
    assert.notEqual(directoryRaceSource, source, "directory-race fixture must replace the exact post-authentication boundary");
    const directoryRacePath = path.join(internal, "baseline-spawner-startup-admission-directory-race-v1.ts");
    writeFileSync(directoryRacePath, directoryRaceSource);
    const directoryRace = await import(`${pathToFileURL(directoryRacePath).href}?directory-race=${Date.now()}`) as Readonly<{ writeNoReplace: (file: string, value: unknown) => void }>;
    const raceDirectory = path.join(fixture, "race-authority-store");
    const heldRaceDirectory = `${raceDirectory}.held`;
    const externalRaceDirectory = path.join(fixture, "external-race-authority-store");
    mkdirSync(raceDirectory, { mode: 0o700 });
    mkdirSync(externalRaceDirectory, { mode: 0o700 });
    Reflect.set(globalThis, "__setfarmP4DirectoryRaceHook", () => {
      renameSync(raceDirectory, heldRaceDirectory);
      symlinkSync(externalRaceDirectory, raceDirectory);
    });
    try {
      assert.throws(
        () => directoryRace.writeNoReplace(path.join(raceDirectory, "record.json"), { boundary: "post-authentication-directory-swap" }),
        /directory.*changed|symbolic|identity/i,
      );
      assert.throws(() => readFileSync(path.join(externalRaceDirectory, "record.json")), /ENOENT/, "a raced external directory must receive no bytes");
    } finally {
      Reflect.deleteProperty(globalThis, "__setfarmP4DirectoryRaceHook");
    }

    const swappingSource = source.replace(
      "const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);\n    try {",
      "const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);\n    unlinkSync(target); writeFileSync(target, bytes, { mode: 0o600 });\n    try {",
    );
    assert.notEqual(swappingSource, source, "path-swap fixture must replace the exact post-open boundary");
    const swappingPath = path.join(internal, "baseline-spawner-startup-admission-path-swap-v1.ts");
    writeFileSync(swappingPath, swappingSource);
    const swapping = await import(`${pathToFileURL(swappingPath).href}?path-swap=${Date.now()}`) as Readonly<{ writeNoReplace: (file: string, value: unknown) => void }>;
    const swappedTarget = path.join(directory, "path-swapped-final.json");
    const swappedValue = { boundary: "path-swapped-final" };
    writeFileSync(swappedTarget, `${canonical(swappedValue)}\n`, { mode: 0o600 });
    assert.throws(
      () => swapping.writeNoReplace(swappedTarget, swappedValue),
      /immutable record differs|changed|identity/,
      "a same-byte path replacement after descriptor open must be rejected",
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup authenticates every historical status against the material prefix", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-startup-status-history-"));
  try {
    const internal = path.join(fixture, "src/internal-production");
    const compiler = path.join(fixture, "src/product-compiler");
    mkdirSync(internal, { recursive: true });
    mkdirSync(compiler, { recursive: true });
    const source = readFileSync(sourcePath, "utf8").replace("function authenticateObservedStatusHistoryV1(", "export function authenticateObservedStatusHistoryV1(");
    writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), source);
    writeFileSync(path.join(compiler, "canonical-json.ts"), readFileSync(path.resolve(import.meta.dirname, "../../src/product-compiler/canonical-json.ts")));
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), "export async function observePreparedInternalProductionCurrentEntryOperationV1(){return null}\nexport async function resolveInternalProductionCurrentEntryOperationV1(){throw new Error('UNUSED')}\nexport async function observeInternalProductionServiceCensusV1(){throw new Error('UNUSED')}\nexport async function observeInternalProductionLegacyPreManifestZeroOwnerV1(){throw new Error('UNUSED')}\nexport async function resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(){throw new Error('UNUSED')}\n");
    writeFileSync(path.join(internal, "baseline-restart-authority-retirement-v1.ts"), "export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){throw new Error('UNUSED')}\nexport async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){throw new Error('UNUSED')}\nexport async function invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(){throw new Error('UNUSED')}\n");
    const loaded = await import(`${pathToFileURL(path.join(internal, "baseline-spawner-startup-admission-v1.ts")).href}?status-history=${Date.now()}`) as Readonly<{ authenticateObservedStatusHistoryV1: (status: Record<string, unknown>, ordinal: number | "blocked", pairs: readonly unknown[]) => void }>;
    const pairs = Array.from({ length: 9 }, (_, index) => Object.freeze({ ref: `ref-${index}`, hash: `${index}`.repeat(64) }));
    const authorization = pairs[1]; const startupToken = pairs[2]; const restartAuthority = pairs[3];
    const predecessorTerminationObservation = pairs[4]; const replacementProcessObservation = pairs[5];
    const sealedAdmission = pairs[7]; const admissionReady = pairs[8];
    const history: Array<readonly [number | "blocked", Record<string, unknown>]> = [
      [0, { state: "prepared", authorization, startupToken: null, restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null }],
      [1, { state: "startup_token_published", authorization, startupToken, restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null }],
      [2, { state: "dispatching", authorization, startupToken, restartAuthority, dispatchPrefix: { phase: "restart_authority_published", predecessorTerminationObservation: null, replacementProcessObservation: null }, sealedAdmission: null, admissionReady: null }],
      ["blocked", { state: "blocked", refusalCode: "HELPER_DISPATCH_SETTLEMENT_UNKNOWN", authorization, startupToken, restartAuthority, dispatchPrefix: { phase: "restart_authority_published", predecessorTerminationObservation: null, replacementProcessObservation: null }, sealedAdmission: null, admissionReady: null }],
      [3, { state: "dispatching", authorization, startupToken, restartAuthority, dispatchPrefix: { phase: "predecessor_terminated", predecessorTerminationObservation, replacementProcessObservation: null }, sealedAdmission: null, admissionReady: null }],
      [4, { state: "dispatching", authorization, startupToken, restartAuthority, dispatchPrefix: { phase: "replacement_observed", predecessorTerminationObservation, replacementProcessObservation }, sealedAdmission: null, admissionReady: null }],
      [5, { state: "pre_manifest_bootstrap_sealed", authorization, startupToken, restartAuthority, dispatchPrefix: { phase: "replacement_observed", predecessorTerminationObservation, replacementProcessObservation }, sealedAdmission, admissionReady: null }],
      [6, { state: "normal_task0_admission_ready", authorization, startupToken, restartAuthority, dispatchPrefix: { phase: "replacement_observed", predecessorTerminationObservation, replacementProcessObservation }, sealedAdmission, admissionReady }],
    ];
    for (const [ordinal, status] of history) assert.doesNotThrow(() => loaded.authenticateObservedStatusHistoryV1(status, ordinal, pairs), `ordinal ${String(ordinal)}`);
    const mutations: Array<readonly [number | "blocked", Record<string, unknown>]> = [
      [1, { ...history[1]![1], authorization: { crossed: true } }],
      [2, { ...history[2]![1], startupToken: { crossed: true } }],
      [3, { ...history[4]![1], restartAuthority: { crossed: true } }],
      [3, { ...history[4]![1], dispatchPrefix: { phase: "predecessor_terminated", predecessorTerminationObservation: { crossed: true }, replacementProcessObservation: null } }],
      [4, { ...history[5]![1], dispatchPrefix: { phase: "replacement_observed", predecessorTerminationObservation, replacementProcessObservation: { crossed: true } } }],
      [5, { ...history[6]![1], sealedAdmission: { crossed: true } }],
      [6, { ...history[7]![1], admissionReady: { crossed: true } }],
      ["blocked", { ...history[3]![1], dispatchPrefix: { phase: "restart_authority_published", predecessorTerminationObservation, replacementProcessObservation: null } }],
    ];
    for (const [ordinal, status] of mutations) assert.throws(() => loaded.authenticateObservedStatusHistoryV1(status, ordinal, pairs), /historical .* crossed/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
