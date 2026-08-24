import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-restart-authority-retirement-v1.ts");

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function installRetirementFixture(fixture: string, source: string): string {
  const internal = path.join(fixture, "src/internal-production");
  mkdirSync(internal, { recursive: true });
  const fixtureModulePath = path.join(internal, "baseline-restart-authority-retirement-v1.ts");
  writeFileSync(fixtureModulePath, source);
  writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), "export async function resolveInternalProductionCurrentEntryOperationV1(value){return {...value,schema:'setfarm.internal-production-current-entry-operation.v1',purpose:'task6a-internal-production-current-entry-v1'}}\nexport async function observeInternalProductionServiceCensusV1(){return globalThis.__p4ServiceCensus}\n");
  writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), "export async function resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(value){const uid=process.getuid?.();return {...value,schema:'setfarm.internal-production-pre-schema-spawner-restart-authority.v1',actionId:'task6a-pre-schema-setfarm-spawner-rebind-v1',service:'setfarm-spawner',currentEntryOperationRef:globalThis.__p4CurrentEntryOperation.operationRef,currentEntryOperationHash:globalThis.__p4CurrentEntryOperation.operationHash,uid,launchdLabel:'com.setrox.setfarm-spawner',executable:'/bin/launchctl',argv:['kickstart','-k',`gui/${uid}/com.setrox.setfarm-spawner`],...(globalThis.__p4RestartOverrides??{})}}\n");
  const epochRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
  mkdirSync(epochRoot, { recursive: true });
  const epochBody = {
    schema: "setfarm.internal-production-physical-service-restart-authority-epoch.v1",
    epochOrdinal: 1,
    authorityOwner: "baseline-a",
    services: ["setfarm-spawner", "setfarm-dashboard", "mission-control"],
    predecessorEpochRef: null,
    predecessorEpochHash: null,
    retirementRef: null,
    retirementHash: null,
    startupHooksReadyRef: null,
    startupHooksReadyHash: null,
    successorActivationRef: null,
    successorActivationHash: null,
  };
  const epochHash = sha256(canonical(epochBody));
  writeFileSync(path.join(epochRoot, "epoch-head.json"), `${canonical({ ...epochBody, epochRef: `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${epochHash}`, epochHash })}\n`, { mode: 0o600 });
  return fixtureModulePath;
}

test("P4 restart transition lease authenticates epoch one", async () => {
  const module = await import(`../../src/internal-production/baseline-restart-authority-retirement-v1.js?p4-lease=${Date.now()}`);
  assert.deepEqual(Object.keys(module), [
    "acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1",
    "invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1",
    "releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1",
  ]);
  assert.equal(module.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1.length, 0);
  assert.equal(module.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1.length, 1);
  assert.equal(module.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1.length, 2);
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /process\.env|globalThis|forTests|dependencies\s*:/);
  assert.match(source, /WeakMap/);
  assert.match(source, /authorityOwner:\s*"baseline-a"/);
  assert.match(source, /held.*released/s);

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-lease-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, source);
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?lease=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    assert.deepEqual(Reflect.ownKeys(lease), ["schema"]);
    assert.equal(Object.isFrozen(lease), true);
    await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(structuredClone(lease)), /foreign, cloned, or released/);
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /foreign, cloned, or released/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement refuses an absent epoch head instead of synthesizing A authority", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-absent-epoch-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    rmSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?absent-epoch=${Date.now()}`);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /epoch/i);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement reclaims only a proven dead exact lock owner", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-dead-lock-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const lockRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    mkdirSync(lockRoot, { recursive: true });
    const lockBody = {
      schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1",
      pid: 99_999,
      processStartTimeEpochMs: 1,
      processIdentityHash: "0".repeat(64),
      leaseNonce: "1".repeat(64),
    };
    const lockPath = path.join(lockRoot, "physical-service-restart-authority.transition.lock");
    writeFileSync(lockPath, `${canonical(lockBody)}\n`, { mode: 0o600 });
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?dead-lock=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);

    const ps = spawnSync("/bin/ps", ["-p", String(process.pid), "-o", "lstart=,command="], { encoding: "utf8" });
    assert.equal(ps.status, 0, ps.stderr);
    const row = ps.stdout.slice(0, -1);
    const lstart = row.slice(0, 24);
    const command = row.slice(24).trimStart();
    const processStartTimeEpochMs = Date.parse(lstart);
    const processIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: process.pid, processStartTimeEpochMs, lstart, command }));
    const liveBody = { schema: lockBody.schema, pid: process.pid, processStartTimeEpochMs, processIdentityHash, leaseNonce: "2".repeat(64) };
    const liveBytes = `${canonical(liveBody)}\n`;
    writeFileSync(lockPath, liveBytes, { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /lease is unavailable/);
    assert.equal(readFileSync(lockPath, "utf8"), liveBytes);

    writeFileSync(lockPath, `${canonical({ ...liveBody, processStartTimeEpochMs: 1, processIdentityHash: "3".repeat(64) })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /PID was reused or replaced/);
    assert.equal(statSync(lockPath).isFile(), true);

    writeFileSync(lockPath, "not-json\n", { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /not JSON/);
    assert.equal(readFileSync(lockPath, "utf8"), "not-json\n");

    unlinkSync(lockPath);
    const held = `${lockPath}.held`;
    writeFileSync(held, `${canonical(lockBody)}\n`, { mode: 0o600 });
    symlinkSync(held, lockPath);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /ELOOP|symbolic|identity/i);
    assert.equal(statSync(held).isFile(), true);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement adopts a later exact settlement without redispatch", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-settlement-"));
  try {
    const source = readFileSync(sourcePath, "utf8");
    const fixtureModulePath = installRetirementFixture(fixture, source);
    const helperPath = path.join(fixture, "src/internal-production/baseline-service-restart-helper-v1.ts");
    writeFileSync(helperPath, "throw new Error('SECOND_DISPATCH_FORBIDDEN')\n");
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?settlement=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "a".repeat(64);
    const restartAuthorityHash = "b".repeat(64);
    const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = currentEntryOperation;
    const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash };
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const lockStats = statSync(path.join(root, "physical-service-restart-authority.transition.lock"), { bigint: true });
    const lockIdentity = { devDecimal: lockStats.dev.toString(10), inoDecimal: lockStats.ino.toString(10) };
    const transitionLock = JSON.parse(readFileSync(path.join(root, "physical-service-restart-authority.transition.lock"), "utf8"));
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, transitionLock, lockIdentity, maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    const journal = { ...journalBody, journalHash };
    const journalPath = path.join(root, "pre-schema-helper-journal.json");
    writeFileSync(journalPath, `${canonical(journal)}\n`, { mode: 0o600 });
    const journalCrashTemp = path.join(root, `.pre-schema-helper-journal.json.${"a".repeat(32)}.tmp`);
    linkSync(journalPath, journalCrashTemp);

    await assert.rejects(
      isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, { currentEntryOperation, restartAuthority }),
      /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/,
    );
    assert.equal(existsSync(journalCrashTemp), false, "linked journal crash temp must be repaired");

    const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true });
    const settlementPath = path.join(settlementDirectory, `${helperSettlementHash}.json`);
    writeFileSync(settlementPath, `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    const settlementTempOnly = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"b".repeat(32)}.tmp`);
    linkSync(settlementPath, settlementTempOnly);
    unlinkSync(settlementPath);
    const adopted = await isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, { currentEntryOperation, restartAuthority });
    assert.deepEqual(adopted, { helperSettlementRef, helperSettlementHash });
    assert.equal(existsSync(settlementPath), true, "retirement must promote an exact temp-only settlement");
    assert.equal(existsSync(settlementTempOnly), false);
    const settlementLinkedTemp = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"c".repeat(32)}.tmp`);
    linkSync(settlementPath, settlementLinkedTemp);
    const linkedAdopted = await isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, { currentEntryOperation, restartAuthority });
    assert.deepEqual(linkedAdopted, adopted);
    assert.equal(existsSync(settlementLinkedTemp), false, "retirement must clean exact final+temp settlement crash state");
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    const retryLease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const retryAdopted = await isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(retryLease, { currentEntryOperation, restartAuthority });
    assert.deepEqual(retryAdopted, adopted);
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(retryLease);
    assert.equal(existsSync(path.join(root, "physical-service-restart-authority.transition.lock")), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement preserves a dead-owner lock while dispatch settlement is unknown", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-pending-journal-lock-"));
  try {
    const modulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(modulePath).href}?pending-journal-lock=${Date.now()}`);
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const lockPath = path.join(root, "physical-service-restart-authority.transition.lock");
    const transitionLock = { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: 99_999, processStartTimeEpochMs: 1, processIdentityHash: "1".repeat(64), leaseNonce: "2".repeat(64) };
    writeFileSync(lockPath, `${canonical(transitionLock)}\n`, { mode: 0o600 });
    const lockStats = statSync(lockPath, { bigint: true });
    const lockIdentity = { devDecimal: lockStats.dev.toString(10), inoDecimal: lockStats.ino.toString(10) };
    const operationHash = "3".repeat(64);
    const restartAuthorityHash = "4".repeat(64);
    const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
    const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash };
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, transitionLock, lockIdentity, maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    writeFileSync(path.join(root, "pre-schema-helper-journal.json"), `${canonical({ ...journalBody, journalHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    assert.deepEqual(JSON.parse(readFileSync(lockPath, "utf8")), transitionLock);
    const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true });
    const settlementPath = path.join(settlementDirectory, `${helperSettlementHash}.json`);
    const settlementTemporary = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"5".repeat(32)}.tmp`);
    writeFileSync(settlementPath, `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    linkSync(settlementPath, settlementTemporary);
    const recoveredLease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    assert.equal(existsSync(settlementTemporary), false, "dead-lock reclaim must recover an exact linked helper settlement temporary");
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(recoveredLease);
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement classifies every post-claim helper failure as settlement unknown", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-helper-loss-"));
  try {
    const marker = path.join(fixture, "dispatch-count");
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    writeFileSync(path.join(fixture, "src/internal-production/baseline-service-restart-helper-v1.js"), `import{appendFileSync}from"node:fs";appendFileSync(${JSON.stringify(marker)},"x");process.exit(7);\n`);
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?helper-loss=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "c".repeat(64);
    const restartAuthorityHash = "d".repeat(64);
    const input = {
      currentEntryOperation: { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash },
      restartAuthority: { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash },
    };
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = input.currentEntryOperation;
    const source = { sha: "5".repeat(40), treeHash: "6".repeat(40), buildHash: "7".repeat(64) };
    const predecessorProcess = { schema: "setfarm.internal-production-spawner-process-identity.v1", pid: 101, processStartTimeEpochMs: 1, processIdentityHash: "8".repeat(64) };
    const predecessorProcessHash = sha256(canonical(predecessorProcess));
    (globalThis as Record<string, unknown>).__p4RestartOverrides = {
      predecessorSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${predecessorProcessHash}`,
      predecessorSpawnerProcessIdentityHash: predecessorProcessHash,
      predecessorSpawnerServiceIdentityHash: "9".repeat(64), predecessorSpawnerGenerationHash: "a".repeat(64),
      targetSpawnerSourceSha: source.sha, targetSpawnerTreeHash: source.treeHash, targetSpawnerBuildHash: source.buildHash,
    };
    (globalThis as Record<string, unknown>).__p4ServiceCensus = { spawner: { pid: predecessorProcess.pid, processStartTimeEpochMs: predecessorProcess.processStartTimeEpochMs, processIdentityHash: predecessorProcess.processIdentityHash, serviceIdentityHash: "9".repeat(64), generationHash: "a".repeat(64), loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: 1, listener: null } };
    await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    assert.equal(readFileSync(marker, "utf8"), "x");
    await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    assert.equal(readFileSync(marker, "utf8"), "x", "durable claim must prevent redispatch");
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const journal = JSON.parse(readFileSync(path.join(root, "pre-schema-helper-journal.json"), "utf8"));
    const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation: input.currentEntryOperation, restartAuthority: input.restartAuthority, journalHash: journal.journalHash, transitionLock: journal.transitionLock, lockIdentity: journal.lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true });
    const settlementTemporary = path.join(settlementDirectory, `.${helperSettlementHash}.json.${"e".repeat(32)}.tmp`);
    writeFileSync(settlementTemporary, `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    assert.equal(existsSync(settlementTemporary), false, "release must recover an exact helper settlement temporary after helper loss");
    assert.equal(readFileSync(marker, "utf8"), "x", "settlement recovery must not redispatch");
  } finally {
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement refuses a crossed fixed restart action before journal claim", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-crossed-action-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?crossed-action=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "e".repeat(64);
    const restartAuthorityHash = "f".repeat(64);
    const input = {
      currentEntryOperation: { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash },
      restartAuthority: { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash },
    };
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = input.currentEntryOperation;
    (globalThis as Record<string, unknown>).__p4RestartOverrides = { uid: (process.getuid?.() ?? 0) + 1 };
    await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /fixed action is crossed/);
    assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json")), false);
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
  } finally {
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement refuses fresh predecessor drift before journal claim", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-preclaim-drift-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?preclaim-drift=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const operationHash = "7".repeat(64);
    const restartAuthorityHash = "8".repeat(64);
    const input = {
      currentEntryOperation: { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash },
      restartAuthority: { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash },
    };
    const source = { sha: "a".repeat(40), treeHash: "b".repeat(40), buildHash: "c".repeat(64) };
    const oldProcess = { schema: "setfarm.internal-production-spawner-process-identity.v1", pid: 101, processStartTimeEpochMs: 1, processIdentityHash: "d".repeat(64) };
    const oldProcessHash = sha256(canonical(oldProcess));
    (globalThis as Record<string, unknown>).__p4CurrentEntryOperation = input.currentEntryOperation;
    (globalThis as Record<string, unknown>).__p4RestartOverrides = {
      predecessorSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${oldProcessHash}`,
      predecessorSpawnerProcessIdentityHash: oldProcessHash,
      predecessorSpawnerServiceIdentityHash: "e".repeat(64), predecessorSpawnerGenerationHash: "f".repeat(64),
      targetSpawnerSourceSha: source.sha, targetSpawnerTreeHash: source.treeHash, targetSpawnerBuildHash: source.buildHash,
    };
    const validSpawner = { pid: oldProcess.pid, processStartTimeEpochMs: oldProcess.processStartTimeEpochMs, processIdentityHash: oldProcess.processIdentityHash, serviceIdentityHash: "e".repeat(64), generationHash: "f".repeat(64), loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: 1, listener: null };
    for (const [label, mutation] of [
      ["pid", { pid: 202 }], ["start", { processStartTimeEpochMs: 2 }], ["process hash", { processIdentityHash: "1".repeat(64) }],
      ["service", { serviceIdentityHash: "2".repeat(64) }], ["generation", { generationHash: "3".repeat(64) }],
      ["source", { loadedSourceSha: "4".repeat(40) }], ["tree", { loadedTreeHash: "5".repeat(40) }], ["build", { loadedBuildHash: "6".repeat(64) }],
      ["owner count", { processOwnerCount: 0 }], ["listener", { listener: { port: 1 } }],
    ] as const) {
      (globalThis as Record<string, unknown>).__p4ServiceCensus = { spawner: { ...validSpawner, ...mutation } };
      await assert.rejects(isolated.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, input), /predecessor|census|identity/i, `${label} drift must refuse`);
      assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json")), false, `${label} drift must not claim journal`);
    }
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
  } finally {
    delete (globalThis as Record<string, unknown>).__p4RestartOverrides;
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement removes only its exact lock after acquire faults", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const injections = [
    ["write", "    writeFileSync(descriptor, lockBytes);", "    writeFileSync(descriptor, lockBytes); throw new Error('P4_ACQUIRE_WRITE_FAULT');"],
    ["fsync", "    fsyncSync(descriptor);", "    fsyncSync(descriptor); throw new Error('P4_ACQUIRE_FSYNC_FAULT');"],
    ["parent-fsync", "    fsyncParent(lock);\n    const stats = fstatSync(descriptor, { bigint: true });", "    fsyncParent(lock); throw new Error('P4_ACQUIRE_PARENT_FSYNC_FAULT');\n    const stats = fstatSync(descriptor, { bigint: true });"],
    ["fstat", "    const stats = fstatSync(descriptor, { bigint: true });", "    throw new Error('P4_ACQUIRE_FSTAT_FAULT');\n    const stats = fstatSync(descriptor, { bigint: true });"],
    ["second-epoch", "  try { assertEpochOneActive(); }\n  catch (error) {", "  try { throw new Error('P4_ACQUIRE_SECOND_EPOCH_FAULT'); }\n  catch (error) {"],
  ] as const;
  for (const [name, needle, replacement] of injections) {
    assert.equal(original.includes(needle), true, `${name} injection target exists`);
    const fixture = mkdtempSync(path.join(tmpdir(), `setfarm-p4-retirement-acquire-${name}-`));
    try {
      const modulePath = installRetirementFixture(fixture, original.replace(needle, replacement));
      const isolated = await import(`${pathToFileURL(modulePath).href}?acquire-fault=${name}-${Date.now()}`);
      await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /P4_ACQUIRE_/);
      assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock")), false, `${name} must not leave an owned lock`);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-acquire-foreign-swap-"));
  try {
    const needle = "    writeFileSync(descriptor, lockBytes);";
    const replacement = "    writeFileSync(descriptor, lockBytes); unlinkSync(lock); writeFileSync(lock, 'foreign-lock\\n', { mode: 0o600 }); throw new Error('P4_ACQUIRE_FOREIGN_SWAP');";
    const modulePath = installRetirementFixture(fixture, original.replace(needle, replacement));
    const isolated = await import(`${pathToFileURL(modulePath).href}?acquire-foreign=${Date.now()}`);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /P4_ACQUIRE_FOREIGN_SWAP|cleanup/i);
    const lock = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock");
    assert.equal(readFileSync(lock, "utf8"), "foreign-lock\n");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }

  const lateFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-release-late-swap-"));
  try {
    const injected = original
      .replace("  readFileSync,", "  readFileSync,\n  renameSync,")
      .replace("    const finalPathStats = lstatSync(lock, { bigint: true });", "    renameSync(lock, `${lock}.owned`); writeFileSync(lock, 'late-foreign-lock\\n', { mode: 0o600 });\n    const finalPathStats = lstatSync(lock, { bigint: true });");
    const modulePath = installRetirementFixture(lateFixture, injected);
    const isolated = await import(`${pathToFileURL(modulePath).href}?release-late-swap=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /changed immediately before cleanup/);
    const lock = path.join(lateFixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock");
    assert.equal(readFileSync(lock, "utf8"), "late-foreign-lock\n");
  } finally {
    rmSync(lateFixture, { recursive: true, force: true });
  }
});

test("P4 retirement invoke bridges held lease to empty helper", () => {
  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /baseline-service-restart-helper-v1\.js/);
  assert.match(source, /stdio:\s*\["ignore",\s*"ignore",\s*"ignore",\s*descriptor,\s*heldLease\(lease\)\.descriptor,\s*journalDescriptor\]/s);
  assert.match(source, /shell:\s*false/);
  assert.match(source, /pre-schema-spawner-rebind-helper-settlement\/sha256\//);
  assert.match(source, /currentEntryOperation,\s*restartAuthority/s);
});
