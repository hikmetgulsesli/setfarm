import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, closeSync, constants, existsSync, fstatSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-restart-authority-retirement-v1.ts");

function installWorkspaceLocatorFixtureV1(internal: string, workspace: string): void {
  const locatorPath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-workspace-authority-path-v1.ts");
  let source = readFileSync(locatorPath, "utf8");
  const candidates = [
    'const CODE_OWNED_WORKSPACE_ROOT_V1 = path.join(CODE_OWNER_HOME_V1, "ai", "setrox");',
    'const CODE_OWNED_WORKSPACE_ROOT_V1 = path.resolve(import.meta.dirname, "../../..");',
  ];
  const matches = candidates.filter((candidate) => source.includes(candidate));
  assert.equal(matches.length, 1, "fixture authenticates exactly one workspace projection");
  assert.equal(source.split(matches[0]!).length, 2);
  source = source.replace(matches[0]!, `const CODE_OWNED_WORKSPACE_ROOT_V1 = ${JSON.stringify(workspace)};`);
  writeFileSync(path.join(internal, path.basename(locatorPath)), source);
}

test("workspace anchor interrupted close resumes only its remaining descriptors", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-workspace-close-progress-"));
  const internal = path.join(fixture, "src/internal-production");
  mkdirSync(internal, { recursive: true, mode: 0o700 });
  installWorkspaceLocatorFixtureV1(internal, fixture);
  const modulePath = path.join(internal, "baseline-workspace-authority-path-v1.ts");
  const source = readFileSync(modulePath, "utf8")
    .replace("{ closeSync, constants, fstatSync, lstatSync, openSync }", "{ closeSync as realAnchorCloseSync, constants, fstatSync, lstatSync, openSync as realAnchorOpenSync }") + `
function openSync(...args:any[]){const fd=realAnchorOpenSync(...args);globalThis.__anchorOpenedHook?.(fd);return fd;}
function closeSync(fd:number){globalThis.__anchorBeforeCloseHook?.(fd);realAnchorCloseSync(fd);globalThis.__anchorClosedHook?.(fd);}
`;
  writeFileSync(modulePath, source);
  const owned = new Set<number>();
  let sentinel: number | undefined, closedCount = 0, attempts = 0;
  const sentinelPath = path.join(fixture, "sentinel.txt");
  writeFileSync(sentinelPath, "not-owned-by-guard", { mode: 0o600 });
  let guard: { assertStable(): void; close(): void } | undefined;
  try {
    const isolated = await import(pathToFileURL(modulePath).href);
    Reflect.set(globalThis, "__anchorOpenedHook", (fd: number) => { owned.add(fd); });
    guard = isolated.authenticateInternalProductionBaselineWorkspaceAnchorV1();
    Reflect.set(globalThis, "__anchorBeforeCloseHook", () => { if (++attempts === 2) throw new Error("fixture ancestor close interrupted"); });
    Reflect.set(globalThis, "__anchorClosedHook", (fd: number) => { owned.delete(fd); if (++closedCount === 1) sentinel = openSync(sentinelPath, "r"); });
    assert.throws(() => guard!.close(), /interrupted/);
    assert.throws(() => guard!.assertStable(), /IDENTITY_INVALID/);
    assert.ok(owned.size > 0);
    guard!.close();
    assert.equal(owned.size, 0, "retry drains every remaining authority descriptor");
    assert.throws(() => guard!.assertStable(), /IDENTITY_INVALID/);
    assert.equal(fstatSync(sentinel!).ino, lstatSync(sentinelPath).ino, "a completed descriptor slot must not be closed again");
    guard!.close(); // Preserve the locator's existing idempotent closed behavior.
  } finally {
    for (const key of ["__anchorOpenedHook", "__anchorBeforeCloseHook", "__anchorClosedHook"]) Reflect.deleteProperty(globalThis, key);
    for (const fd of owned) { try { closeSync(fd); } catch { /* Test-only cleanup after demonstrated leak. */ } }
    if (sentinel !== undefined) closeSync(sentinel);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("failed workspace and private-chain acquisition close every unreturned descriptor", async () => {
  for (const scope of ["workspace", "private-chain"]) {
    const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-acquisition-close-")), owned = new Set<number>();
    const instrument = (source: string) => source.replace(/\bcloseSync,/, "closeSync as actualCloseSync,").replace(/\bopenSync([, }])/, "openSync as actualOpenSync$1").replace(/\bfstatSync,/, "fstatSync as actualFstatSync,") + `
function openSync(...args:any[]){const fd=actualOpenSync(...args);globalThis.__acquisitionOpened?.(fd);return fd;}
function closeSync(fd:number){globalThis.__acquisitionBeforeClose?.(fd);actualCloseSync(fd);globalThis.__acquisitionClosed?.(fd);}
function fstatSync(...args:any[]){globalThis.__acquisitionBeforeStat?.();return actualFstatSync(...args);}
`;
    let injected = false, invalid = false;
    try {
      const modulePath = installRetirementFixture(fixture, instrument(readFileSync(sourcePath, "utf8")) + "\nexport {authenticatePrivateDirectoryChainV1};\n");
      const locator = path.join(fixture, "src/internal-production/baseline-workspace-authority-path-v1.ts");
      writeFileSync(locator, instrument(readFileSync(locator, "utf8")));
      const isolated = await import(pathToFileURL(scope === "workspace" ? locator : modulePath).href);
      Reflect.set(globalThis, "__acquisitionOpened", (fd: number) => owned.add(fd));
      Reflect.set(globalThis, "__acquisitionClosed", (fd: number) => owned.delete(fd));
      Reflect.set(globalThis, "__acquisitionBeforeClose", () => { if (!injected) { injected = true; throw Error("fixture acquisition pre-close failure"); } });
      Reflect.set(globalThis, "__acquisitionBeforeStat", () => { if (scope === "workspace" && !invalid) { invalid = true; throw Error("fixture acquisition identity failure"); } });
      const unsafe = path.join(fixture, "unsafe"); mkdirSync(unsafe, { mode: 0o755 });
      assert.throws(() => scope === "workspace" ? isolated.authenticateInternalProductionBaselineWorkspaceAnchorV1() : isolated.authenticatePrivateDirectoryChainV1(fixture, unsafe));
      assert.equal(injected, true);
      assert.equal(owned.size, 0, `${scope}: failed acquisition must retain and finish its unreturned cleanup`);
    } finally {
      for (const name of ["Opened", "Closed", "BeforeClose", "BeforeStat"]) Reflect.deleteProperty(globalThis, `__acquisition${name}`);
      for (const fd of owned) closeSync(fd);
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function recursivelyFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const member of Object.values(value as Record<string, unknown>)) recursivelyFreeze(member);
    Object.freeze(value);
  }
  return value;
}

function cutoverReadinessFixture(fixture: string): Readonly<Record<string, unknown>> {
  const epoch = JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8"));
  const sourceSha = "a".repeat(40);
  const buildHash = "b".repeat(64);
  const forward = [
    ["restart-reservation", "restart-reservation", "d-restart-reservation-v1", "reserveInternalProductionServiceRestartDispatchOwnerV1"],
    ["service-restart-operation", "service-restart-operation", "d-service-restart-operation-v1", "reserveInternalProductionServiceRestartOperationOwnerV1"],
    ["launch-outbox", "launch-outbox", "d-service-restart-launch-outbox-v1", "publishInternalProductionServiceRestartLaunchOutboxUnderFenceV1"],
    ["helper-process", "process", "d-service-restart-helper-process-v1", "publishInternalProductionServiceRestartHelperProcessUnderFenceV1"],
    ["dispatch-child-process", "process", "d-service-restart-child-process-v1", "publishInternalProductionServiceRestartDispatchChildProcessUnderFenceV1"],
    ["startup-listener", "listener", "d-service-restart-startup-listener-v1", "publishInternalProductionServiceRestartStartupListenerUnderFenceV1"],
    ["replacement-process", "process", "d-service-restart-replacement-process-v1", "publishInternalProductionServiceRestartReplacementProcessUnderFenceV1"],
  ].map(([role, category, producerImplementationId, expectedExportName], index) => ({ role, category, producerImplementationId, expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName, moduleBlobHash: String(index + 1).repeat(40), sourceSha, buildHash }));
  const migrationReceiptHash = "c".repeat(64);
  return recursivelyFreeze({ schema: "setfarm.internal-production-service-restart-startup-hooks-ready.v1", setfarmSourceSha: sourceSha, missionControlSourceSha: "d".repeat(40), setfarmBuildHash: buildHash, missionControlBuildHash: "e".repeat(64), migrationReceiptRef: `setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/${migrationReceiptHash}`, migrationReceiptHash, migrationSourceSha: sourceSha, migrationImplementationBlobHash: "f".repeat(40), orderedStatementsHash: "1".repeat(64), namedMigrationDigestEntryHash: "2".repeat(64), migrationDigest: "3".repeat(64), schemaProjectionHash: "4".repeat(64), physicalRestartEpochRef: epoch.epochRef, physicalRestartEpochHash: epoch.epochHash, physicalRestartEpochOrdinal: 1, physicalRestartAuthorityOwner: "baseline-a", dForwardIdentityRegistryHash: "c3d88ba2dc7d9e70d773d0056d2fdeaced399f63adc7fd1c37eb423fa22d08d5", dForwardImplementationIdentities: forward, spawnerHookImplementationId: "recovery-d-setfarm-spawner-startup-v1", spawnerHookImplementationHash: "5".repeat(64), dashboardHookImplementationId: "recovery-d-setfarm-dashboard-startup-v1", dashboardHookImplementationHash: "6".repeat(64), missionControlHookImplementationId: "recovery-d-mission-control-startup-v1", missionControlHookImplementationHash: "7".repeat(64), runtimeSourceProjectionHash: "8".repeat(64), recoveryPrepareState: "disabled-by-baseline-epoch-one" });
}

function cutoverGateFixture(readiness: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const recoveryProducerManifestActivationHash = "9".repeat(64);
  const missionControlHandoffHash = "a".repeat(64);
  return Object.freeze({
    schema: "setfarm.internal-production-reviewed-d-source-build-gate.v1",
    reviewed: true,
    setfarmSourceSha: readiness.setfarmSourceSha,
    missionControlSourceSha: readiness.missionControlSourceSha,
    setfarmBuildHash: readiness.setfarmBuildHash,
    missionControlBuildHash: readiness.missionControlBuildHash,
    recoveryProducerManifestActivationRef: `setfarm://internal-production/recovery-owner-producer-manifest-activation/sha256/${recoveryProducerManifestActivationHash}`,
    recoveryProducerManifestActivationHash,
    missionControlHandoffRef: `setfarm://internal-production/recovery-mission-control-source-handoff/sha256/${missionControlHandoffHash}`,
    missionControlHandoffHash,
  });
}

function completeZeroFixture(): Readonly<Record<string, unknown>> {
  const keys = ["activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount", "ordinaryStartingCount", "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount", "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount", "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount", "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount", "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount", "ownedListenerCount", "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount"];
  const body = { schema: "setfarm.internal-production-complete-zero-owner-census-observation.v1", census: Object.fromEntries(keys.map((key) => [key, 0])), ownerCategoryRegistryHash: "1".repeat(64), ownerCategoryCensusMapHash: "2".repeat(64), activeProducerManifestSetActivationRef: `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${"3".repeat(64)}`, activeProducerManifestSetActivationHash: "3".repeat(64), activeProducerManifestSetHash: "4".repeat(64), reservationIdentitySetHash: "5".repeat(64), ownerIdentitySetHash: "6".repeat(64) };
  const observationHash = sha256(canonical(body));
  return recursivelyFreeze({ ...body, observationRef: `setfarm://internal-production/complete-zero-owner-census-observation/sha256/${observationHash}`, observationHash });
}

function coldGenesisObservationFixture(fixture: string): Readonly<Record<string, unknown>> {
  const source = { branch: "main", clean: true, sha: "a".repeat(40), treeHash: "b".repeat(40), buildHash: "c".repeat(64), originMainSha: "a".repeat(40) };
  const loaded = { sha: source.sha, treeHash: source.treeHash, buildHash: source.buildHash };
  const service = (label: string, pid: number, port: number) => {
    const serviceSource = port === 18789 ? null : loaded;
    const serviceIdentityHash = sha256(canonical({ label, pid }));
    return { pid, processStartTimeEpochMs: 1_800_000_000_000 + pid, processIdentityHash: sha256(String(pid)), serviceIdentityHash,
      generationHash: sha256(canonical({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash, source: serviceSource })),
      loadedSourceSha: serviceSource?.sha ?? null, loadedTreeHash: serviceSource?.treeHash ?? null, loadedBuildHash: serviceSource?.buildHash ?? null,
      processOwnerCount: 1, listenerOwnerCount: 1, listener: { host: "127.0.0.1", port, listenerIdentityHash: sha256(String(port)) } };
  };
  const uid = process.getuid!();
  const metadata = { dev: "1", ino: "2", uid: String(uid), mode: 0o700, nlink: "1", size: "0", mtimeNs: "1", ctimeNs: "1" };
  const absenceBody = { schema: "setfarm.internal-production-cold-spawner-absence.v1", source: loaded, uid,
    globalSpawnerFamilyCount: 0, singletonLockState: "absent", pidFile: { state: "absent" },
    ancestors: [fixture, path.join(fixture, ".openclaw"), path.join(fixture, ".openclaw/setfarm")].map((target) => ({ path: target, ...metadata })),
    launcher: { path: path.join(fixture, ".local/bin/setfarm"), target: path.join(fixture, "dist/cli/cli.js"), ...metadata, mode: 0o755 },
    entrypoint: path.join(fixture, "dist/spawner.js"), entrypointBytesSha256: "d".repeat(64), plistBytesSha256: "e".repeat(64), launchProjectionHash: "f".repeat(64) };
  const inventoryBody = { schema: "setfarm.legacy-finding-publication-inventory.v1", entries: [] };
  const operationHash = "90fc2fedc56db22bb013ad1b243e9dc386473d6b4284ede135e26fd1ab82fe3d";
  const body = {
    schema: "setfarm.internal-production-cold-bootstrap-observation.v1",
    operation: { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash },
    operationBytesSha256: "ebcba187e953fda9e7962a0ce0cf4fc10feed881e9ce69b6d59140a9ef43d7f6",
    contaminationFingerprintHash: "9e07f9bd60955a9a681b7365a3c48cb087ff7d46459a5b9885283e0a3492ce65", source,
    authorityV3Migration31Audit: { authorityV3Migration31AuditRef: `setfarm://internal-production/authority-v3-migration31-audit/sha256/${"1".repeat(64)}`, authorityV3Migration31AuditHash: "1".repeat(64) },
    pendingBootstrapHandoffMigration: { pendingBootstrapHandoffMigrationRef: `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${"2".repeat(64)}`, pendingBootstrapHandoffMigrationHash: "2".repeat(64) },
    remainingServices: { dashboard: service("com.setrox.setfarm-dashboard", 1001, 3333), missionControl: service("com.setrox.mission-control", 1002, 3080), openClaw: service("ai.openclaw.gateway", 1003, 18789) },
    spawnerAbsence: { ...absenceBody, absenceHash: sha256(canonical(absenceBody)) },
    physical: { worktrees: [], processes: [], listeners: [], stale: [], ownedProcessCount: 0, ownedListenerCount: 0, ownedWorktreeCount: 0, dirtyWorktreeCount: 0, staleChildCount: 0 },
    census: completeZeroFixture().census,
    syntheticGitAbsence: [
      { repository: "setfarm", objectSha: "4fc67f20df0e935c703c4658a29dbbaa9aa0a956", objectType: "commit", state: "absent", networkAccess: "forbidden" },
      { repository: "mission-control", objectSha: "4ec5fc99a076453a87381c0c75e508d25dd8882d", objectType: "commit", state: "absent", networkAccess: "forbidden" },
    ],
    legacyFindingPublicationInventory: { ...inventoryBody, inventoryHash: sha256(canonical(inventoryBody)) },
  };
  return recursivelyFreeze({ ...body, observationHash: sha256(canonical(body)) });
}

function seedPreSchemaHelperClosure(fixture: string): Readonly<Record<string, unknown>> {
  const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const operationHash = "a".repeat(64);
  const restartAuthorityHash = "b".repeat(64);
  const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
  const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartAuthorityHash}`, restartAuthorityHash };
  const transitionLock = { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: 1, processStartTimeEpochMs: 1, processIdentityHash: "c".repeat(64), leaseNonce: "d".repeat(64) };
  const lockIdentity = { devDecimal: "1", inoDecimal: "2" };
  const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, transitionLock, lockIdentity, maximumDispatchCount: 1 };
  const preSchemaHelperJournalHash = sha256(canonical(journalBody));
  writeFileSync(path.join(root, "pre-schema-helper-journal.json"), `${canonical({ ...journalBody, journalHash: preSchemaHelperJournalHash })}\n`, { mode: 0o600 });
  const settlementBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: journalBody.action, currentEntryOperation, restartAuthority, journalHash: preSchemaHelperJournalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
  const preSchemaHelperSettlementHash = sha256(canonical(settlementBody));
  const preSchemaHelperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${preSchemaHelperSettlementHash}`;
  const settlementDirectory = path.join(root, "pre-schema-helper-settlements/sha256", preSchemaHelperSettlementHash.slice(0, 2));
  mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(settlementDirectory, `${preSchemaHelperSettlementHash}.json`), `${canonical({ ...settlementBody, helperSettlementRef: preSchemaHelperSettlementRef, helperSettlementHash: preSchemaHelperSettlementHash })}\n`, { mode: 0o600 });
  const retainedHelperJournalSettlementSetHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-service-restart-helper-retained-authority-set.v1", preSchemaHelperState: "terminal", preSchemaHelperJournalHash, preSchemaHelperSettlementRef, preSchemaHelperSettlementHash, orderedRegistryEntries: [] }));
  const censusBody = { schema: "setfarm.internal-production-baseline-service-restart-helper-journal-census.v1", preSchemaHelperState: "terminal", registeredBaselineHelperJournalCount: 0, terminalBaselineHelperJournalCount: 0, liveBaselineHelperJournalCount: 0, ambiguousBaselineHelperJournalCount: 0, helperJournalRegistryHeadRef: null, helperJournalRegistryHeadHash: null, retainedHelperJournalSettlementSetHash };
  return Object.freeze({ ...censusBody, censusHash: sha256(canonical(censusBody)) });
}

function cutoverGuardFixture(completeZero: Readonly<Record<string, unknown>>, helperCensusHash: string): Readonly<Record<string, unknown>> {
  const core = {
    schema: "setfarm.internal-production-baseline-zero-owner-mutation-guard.v1",
    completeZeroOwnerCensusObservationRef: completeZero.observationRef,
    completeZeroOwnerCensusObservationHash: completeZero.observationHash,
    baselineServiceRestartHelperJournalCensusHash: helperCensusHash,
    guardNonce: "7".repeat(64),
  };
  const zeroOwnerGuardHash = sha256(canonical(core));
  return Object.freeze({ ...core, zeroOwnerGuardRef: `setfarm://internal-production/baseline-zero-owner-mutation-guard/sha256/${zeroOwnerGuardHash}`, zeroOwnerGuardHash });
}

function seedCompletedSequenceHistory(fixture: string, intentKind: "live-rebind" | "d-startup-hook-load" | "documentation-rollback", readiness: Readonly<Record<string, unknown>>, firstBeforeOverride?: string, finalZeroHash = "b".repeat(64)): Readonly<Record<string, string>> {
  const root = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1");
  const intentDirectoryHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
  const intentDirectory = path.join(root, "intents", intentDirectoryHash);
  const orderedServiceActions = [{ service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1" }, { service: "setfarm-dashboard", actionId: "a-restart-service-setfarm-dashboard-v1" }, { service: "mission-control", actionId: "a-restart-service-mission-control-v1" }];
  const headerBody = { schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, migrationSchemaProjectionHash: readiness.schemaProjectionHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, orderedServiceActions };
  const sequenceIntentHash = sha256(canonical(headerBody));
  const sequenceIntentRef = `setfarm://internal-production/baseline-restart-sequence-intent/sha256/${sequenceIntentHash}`;
  mkdirSync(intentDirectory, { recursive: true, mode: 0o700 });
  const headerStore = path.join(root, "sequence-intents/sha256", sequenceIntentHash.slice(0, 2)); mkdirSync(headerStore, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(headerStore, `${sequenceIntentHash}.json`), `${canonical({ ...headerBody, sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
  writeFileSync(path.join(intentDirectory, "sequence-intent.pair.json"), `${canonical({ sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
  const advances: Array<Record<string, unknown>> = [];
  for (const [ordinal, fixed] of orderedServiceActions.entries()) {
    const authorizationHash = String(ordinal + 1).repeat(64); const authorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${authorizationHash}`;
    writeFileSync(path.join(intentDirectory, `${String(ordinal).padStart(2, "0")}-service-authorization.pair.json`), `${canonical({ authorizationRef, authorizationHash })}\n`, { mode: 0o600 });
    const authorityHash = String(ordinal + 4).repeat(64); const authorityRef = `setfarm://internal-production/baseline/service-restarts/${authorityHash}`;
    const before = ordinal === 0 ? (firstBeforeOverride ?? readiness.runtimeSourceProjectionHash) : advances[ordinal - 1]!.afterRuntimeSourceProjectionHash;
    const after = String(ordinal + 7).repeat(64);
    const body = { schema: "setfarm.internal-production-baseline-service-restart-advance.v1", intentKind, sequenceIntentHash, ordinal, ...fixed, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, authorizationRef, authorizationHash, authorityRef, authorityHash, priorAdvanceHash: ordinal === 0 ? null : advances[ordinal - 1]!.advanceHash, beforeRuntimeSourceProjectionHash: before, afterRuntimeSourceProjectionHash: after, completeZeroOwnerCensusHash: "a".repeat(64) };
    const advanceHash = sha256(canonical(body)); const advanceRef = `setfarm://internal-production/baseline-service-restart-advance/sha256/${advanceHash}`; const value = { ...body, advanceRef, advanceHash }; advances.push(value);
    const store = path.join(root, "advances/sha256", advanceHash.slice(0, 2)); mkdirSync(store, { recursive: true, mode: 0o700 }); writeFileSync(path.join(store, `${advanceHash}.json`), `${canonical(value)}\n`, { mode: 0o600 });
    writeFileSync(path.join(intentDirectory, `${String(ordinal).padStart(2, "0")}-service-advance.pair.json`), `${canonical({ advanceRef, advanceHash })}\n`, { mode: 0o600 });
  }
  const receiptBody = { schema: "setfarm.internal-production-baseline-restart-sequence-receipt.v1", intentKind, sequenceIntentHash, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, migrationSchemaProjectionHash: readiness.schemaProjectionHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, orderedServices: orderedServiceActions.map(({ service }) => service), authorityPairs: advances.map((advance) => ({ service: advance.service, actionId: advance.actionId, authorityRef: advance.authorityRef, authorityHash: advance.authorityHash })), orderedAdvanceHashes: advances.map((advance) => advance.advanceHash), finalRuntimeSourceProjectionHash: advances[2]!.afterRuntimeSourceProjectionHash, finalCompleteZeroOwnerCensusHash: finalZeroHash };
  const sequenceHash = sha256(canonical(receiptBody)); const sequenceRef = `setfarm://internal-production/baseline/restart-sequences/${sequenceHash}`; const receipt = { ...receiptBody, sequenceRef, sequenceHash };
  const receiptStore = path.join(root, "receipts/sha256", sequenceHash.slice(0, 2)); mkdirSync(receiptStore, { recursive: true, mode: 0o700 }); writeFileSync(path.join(receiptStore, `${sequenceHash}.json`), `${canonical(receipt)}\n`, { mode: 0o600 });
  writeFileSync(path.join(intentDirectory, "03-sequence-receipt.pair.json"), `${canonical({ sequenceRef, sequenceHash })}\n`, { mode: 0o600 });
  return Object.freeze({ intentKind, sequenceRef, sequenceHash, sequenceReceiptSemanticHash: sha256(canonical(receipt)) });
}

function installRetirementFixture(fixture: string, source: string): string {
  const internal = path.join(fixture, "src/internal-production");
  mkdirSync(internal, { recursive: true });
  for (const relative of ["findings/legacy-finding-publication-inventory-v1.ts", "product-compiler/canonical-json.ts", "internal-production/baseline-spawner-launch-environment-v1.ts"]) {
    const target = path.join(fixture, "src", relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(path.resolve(import.meta.dirname, "../../src", relative)));
  }
  installWorkspaceLocatorFixtureV1(internal, fixture);
  const fixtureModulePath = path.join(internal, "baseline-restart-authority-retirement-v1.ts");
  const censusReturn = "return orderedFrozenV1({ ...body, censusHash: sha256(canonical(body)) }) as InternalProductionBaselineServiceRestartHelperJournalCensusV1;";
  const instrumentedSource = source
    .replace(censusReturn, `if ((globalThis as Record<string, unknown>).__p4HelperCensusDriftAfterConsumption && (globalThis as Record<string, unknown>).__p4GuardConsumption) { const drifted = { ...body, retainedHelperJournalSettlementSetHash: "f".repeat(64) }; return orderedFrozenV1({ ...drifted, censusHash: sha256(canonical(drifted)) }) as InternalProductionBaselineServiceRestartHelperJournalCensusV1; } ${censusReturn}`)
    .replace("directoryGuard.assertStable();\n    pinned.assertStable();\n    renameSync(temporary, target);", "directoryGuard.assertStable();\n    ((globalThis as Record<string, unknown>).__p4RegistryCasSwap as undefined | (() => void))?.();\n    pinned.assertStable();\n    renameSync(temporary, target);")
    .replace("guard.assertStable();\n    pinned.assertStable();\n    renameSync(temporary, target);", "guard.assertStable();\n    ((globalThis as Record<string, unknown>).__p4EpochCasSwap as undefined | (() => void))?.();\n    pinned.assertStable();\n    renameSync(temporary, target);");
  assert.notEqual(instrumentedSource, source, "fixture installs only the exact helper-census drift hook");
  writeFileSync(fixtureModulePath, instrumentedSource);
  writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
import {createHash} from "node:crypto";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")}]\`:\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")}\`+"}";
const hash=(value)=>createHash("sha256").update(canonical(value)).digest("hex");
export async function resolveInternalProductionCurrentEntryOperationV1(value){return {...value,schema:"setfarm.internal-production-current-entry-operation.v1",purpose:"task6a-internal-production-current-entry-v1"}}
export async function observeInternalProductionServiceCensusV1(){return globalThis.__coldControllerServiceCensusObserver?globalThis.__coldControllerServiceCensusObserver():globalThis.__p4ServiceCensus}
export async function resolveInternalProductionBaselineServiceRestartOperationV1(input){const value=globalThis.__p4BaselineOperation;if(!value||value.operationRef!==input.operationRef||value.operationHash!==input.operationHash)throw new Error("crossed fixture baseline operation");return value}
export async function observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1(input){const value=globalThis.__p4BaselineOutbox;if(!value||value.operationRef!==input.operationRef||value.operationHash!==input.operationHash)throw new Error("crossed fixture baseline outbox");return value}
export async function reobserveInternalProductionBaselineServiceRestartPreparedRuntimeProjectionV1(input){globalThis.__p4ProjectionReobserveCount=(globalThis.__p4ProjectionReobserveCount??0)+1;const operation=globalThis.__p4BaselineOperation;if(!operation||operation.authorizationRef!==input.authorizationRef||operation.authorizationHash!==input.authorizationHash)throw new Error("crossed fixture prepared runtime projection");if(globalThis.__p4PreparedProjectionMissing)throw new Error("prepared runtime projection missing");if(globalThis.__p4PreparedProjectionDrift)throw new Error("prepared runtime projection drifted before dispatch");return Object.freeze({authorizationRef:input.authorizationRef,authorizationHash:input.authorizationHash})}
export async function observeInternalProductionReviewedDSourceBuildGateV1(){if(!globalThis.__p4CutoverGate)throw new Error("complete code-owned cutover readiness gate is unavailable");return globalThis.__p4CutoverGate}
export async function observeInternalProductionServiceRestartCutoverReadinessCandidateV1(){globalThis.__p4ReadinessObservations=(globalThis.__p4ReadinessObservations??0)+1;if(!globalThis.__p4CutoverReadiness)throw new Error("complete code-owned cutover readiness observer is unavailable");if((globalThis.__p4ReadinessDriftUnderLease&&globalThis.__p4ReadinessObservations>=2)||(globalThis.__p4ReadinessDriftAfterConsumption&&globalThis.__p4GuardConsumption))return Object.freeze({...globalThis.__p4CutoverReadiness,runtimeSourceProjectionHash:${JSON.stringify("f".repeat(64))}});return globalThis.__p4CutoverReadiness}
export async function observeCompleteInternalProductionZeroOwnerCensusV1(){if(!globalThis.__p4CompleteZero)throw new Error("complete zero unavailable");return globalThis.__p4CompleteZero}
export async function resolveInternalProductionCompleteZeroOwnerCensusObservationV1(input){const value=globalThis.__p4CompleteZero;if(!value||value.observationRef!==input.observationRef||value.observationHash!==input.observationHash)throw new Error("crossed complete zero pair");return value}
export async function resolveInternalProductionBaselineZeroOwnerMutationGuardV1(input){const value=globalThis.__p4CutoverGuard;if(!value||value.zeroOwnerGuardRef!==input.zeroOwnerGuardRef||value.zeroOwnerGuardHash!==input.zeroOwnerGuardHash)throw new Error("crossed guard pair");return value}
export async function consumeInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardV1(input){
  globalThis.__p4GuardConsumeCalls=(globalThis.__p4GuardConsumeCalls??0)+1;
  const guard=await resolveInternalProductionBaselineZeroOwnerMutationGuardV1({zeroOwnerGuardRef:input.zeroOwnerGuardRef,zeroOwnerGuardHash:input.zeroOwnerGuardHash});
  if(globalThis.__p4OwnerFenceReobservations<1)throw new Error("guard consumed without fresh held fence reobservation");
  const body={schema:"setfarm.internal-production-baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption.v1",purpose:"recovery-d-physical-service-restart-authority-cutover-v1",zeroOwnerGuardRef:guard.zeroOwnerGuardRef,zeroOwnerGuardHash:guard.zeroOwnerGuardHash,completeZeroOwnerCensusObservationRef:guard.completeZeroOwnerCensusObservationRef,completeZeroOwnerCensusObservationHash:guard.completeZeroOwnerCensusObservationHash,baselineServiceRestartHelperJournalCensusHash:guard.baselineServiceRestartHelperJournalCensusHash,operationRef:input.operationRef,operationHash:input.operationHash,guardConsumed:true};
  const consumptionHash=hash(body);const value=Object.freeze({...body,consumptionRef:"setfarm://internal-production/baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption/sha256/"+consumptionHash,consumptionHash});
  if(globalThis.__p4GuardConsumption&&canonical(globalThis.__p4GuardConsumption)!==canonical(value))throw new Error("cross-purpose guard consumption");
  const root=path.resolve(import.meta.dirname,"../..");const indexDirectory=path.join(root,"data/internal-production-baseline/zero-owner-mutation-guard-v1/consumed-guards/sha256",guard.zeroOwnerGuardHash.slice(0,2));mkdirSync(indexDirectory,{recursive:true,mode:0o700});writeFileSync(path.join(indexDirectory,guard.zeroOwnerGuardHash+".json"),canonical({consumptionRef:value.consumptionRef,consumptionHash})+String.fromCharCode(10),{mode:0o600});
  globalThis.__p4GuardConsumption=value;return Object.freeze({consumptionRef:value.consumptionRef,consumptionHash});
}
export async function resolveInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardConsumptionV1(input){const value=globalThis.__p4GuardConsumption;if(!value||value.consumptionRef!==input.consumptionRef||value.consumptionHash!==input.consumptionHash)throw new Error("crossed consumption pair");return value}
`);
  writeFileSync(path.join(internal, "owner-admission-v1.ts"), `
import {createHash} from "node:crypto";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")}]\`:\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")}}\`;
const hash=(value)=>createHash("sha256").update(canonical(value)).digest("hex");
const freeze=(value)=>{if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const member of Object.values(value))freeze(member);Object.freeze(value)}return value};
const categories=${JSON.stringify(["run", "claim", "execution-attempt", "runtime-session", "completion-owner", "mandatory-effect", "ordinary-service-start", "restart-reservation", "service-restart-operation", "launch-preparation", "prepared-launch", "staged-case", "fixture-attempt", "artifact-reservation", "artifact-publication", "docs-session", "docs-lease", "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight", "launch-outbox", "termination", "finding", "recovery", "operational-delivery", "source-run", "cold-rehearsal", "compilation-lease", "execution-lease", "process", "listener", "worktree", "dirty-worktree", "stale-child"])};
export async function acquireInternalProductionGlobalOwnerAdmissionFenceV1(input){const body={schema:"setfarm.internal-production-global-owner-admission-fence.v1",purpose:input.purpose,pendingInputRef:input.pendingInputRef,pendingInputHash:input.pendingInputHash,ownerCategories:categories,ownerCategoryRegistryHash:${JSON.stringify("1".repeat(64))},ownerCategoryCensusMapHash:${JSON.stringify("2".repeat(64))},targetFamily:{kind:"none",targetFamilyHash:null},observedUnrelatedReservationCount:0,observedUnrelatedOwnerCount:0,ownerIdentitySetHash:${JSON.stringify("3".repeat(64))},predecessorFenceHeadHash:null,ownerAdmissionHeadHash:${JSON.stringify("4".repeat(64))}};const fenceHash=hash(body);const value=freeze({...body,fenceRef:\`setfarm://internal-production/global-owner-admission-fence/sha256/\${fenceHash}\`,fenceHash});globalThis.__p4OwnerFence=value;globalThis.__p4OwnerFenceReobservations=0;return value}
export async function reobserveInternalProductionGlobalOwnerAdmissionFenceV1(input){const value=globalThis.__p4OwnerFence;if(!value||value.fenceRef!==input.fenceRef||value.fenceHash!==input.fenceHash)throw new Error("crossed fixture fence");globalThis.__p4OwnerFenceReobservations=(globalThis.__p4OwnerFenceReobservations??0)+1;if(globalThis.__p4FenceDriftAfterConsumption&&globalThis.__p4GuardConsumption)return freeze({...value,ownerIdentitySetHash:${JSON.stringify("f".repeat(64))}});return value}
export async function releaseInternalProductionGlobalOwnerAdmissionFenceV1(input){const body={schema:"setfarm.internal-production-global-owner-admission-fence-release.v1",purpose:input.releaseAuthority.purpose,fenceRef:input.fenceRef,fenceHash:input.fenceHash,releaseAuthority:input.releaseAuthority,ownerAdmissionHeadPredecessorHash:${JSON.stringify("4".repeat(64))},ownerAdmissionHeadSuccessorHash:${JSON.stringify("5".repeat(64))}};const releaseHash=hash(body);const value=freeze({...body,releaseRef:\`setfarm://internal-production/global-owner-admission-fence-release/sha256/\${releaseHash}\`,releaseHash});globalThis.__p4FenceRelease=value;return value}
export async function resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1(input){const value=globalThis.__p4FenceRelease;if(!value||value.releaseRef!==input.releaseRef||value.releaseHash!==input.releaseHash)throw new Error("crossed fixture fence release");return value}
`);
  writeFileSync(path.join(fixture, "src/db-pg.ts"), `
export {
  acquireInternalProductionGlobalOwnerAdmissionFenceV1,
  reobserveInternalProductionGlobalOwnerAdmissionFenceV1,
  releaseInternalProductionGlobalOwnerAdmissionFenceV1,
  resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
} from "./internal-production/owner-admission-v1.js";
`);
  writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), "export async function resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(value){const uid=process.getuid?.();return {...value,schema:'setfarm.internal-production-pre-schema-spawner-restart-authority.v1',actionId:'task6a-pre-schema-setfarm-spawner-rebind-v1',service:'setfarm-spawner',currentEntryOperationRef:globalThis.__p4CurrentEntryOperation.operationRef,currentEntryOperationHash:globalThis.__p4CurrentEntryOperation.operationHash,uid,launchdLabel:'com.setrox.setfarm-spawner',executable:'/bin/launchctl',argv:['kickstart','-k',`gui/${uid}/com.setrox.setfarm-spawner`],...(globalThis.__p4RestartOverrides??{})}}\n");
  writeFileSync(path.join(internal, "baseline-service-restart-sequence-v1.ts"), `
import {createHash} from "node:crypto";import {existsSync} from "node:fs";import path from "node:path";
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?\`[\${value.map(canonical).join(",")} ]\`.replace(" ]","]"):\`{\${Object.keys(value).sort().map((key)=>\`\${JSON.stringify(key)}:\${canonical(value[key])}\`).join(",")} }\`.replace(" }","}");
const hash=(value)=>createHash("sha256").update(canonical(value)).digest("hex");
export async function observeInternalProductionBaselineRestartSequenceStatusV1({intentKind}){const root=path.resolve(import.meta.dirname,"../..","data/internal-production-baseline/baseline-service-restart-sequence-v1");const intentHash=hash({schema:"setfarm.internal-production-baseline-restart-sequence-intent.v1",intentKind});const dir=path.join(root,"intents",intentHash);const header=existsSync(path.join(dir,"sequence-intent.pair.json"));const receipt=existsSync(path.join(dir,"03-sequence-receipt.pair.json"));return Object.freeze({intentKind,state:receipt?"completed":header?"in_progress":"absent"})}
export async function resolveInternalProductionBaselineRestartSequenceReceiptV1(input){const value=globalThis.__p4ResolvedSequenceReceipt;if(!value||value.sequenceRef!==input.sequenceRef||value.sequenceHash!==input.sequenceHash)throw new Error("crossed fixture sequence receipt");return value}
`);
  const epochRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
  mkdirSync(epochRoot, { recursive: true, mode: 0o700 });
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

async function compilePlainRetirementFixtureV1(fixture: string, modulePath: string): Promise<string> {
  const typescript = await import("typescript");
  for (const relative of ["internal-production/baseline-restart-authority-retirement-v1.ts", "internal-production/baseline-workspace-authority-path-v1.ts",
    "internal-production/baseline-spawner-launch-environment-v1.ts", "findings/legacy-finding-publication-inventory-v1.ts", "product-compiler/canonical-json.ts"]) {
    const target = path.join(fixture, "src", relative);
    writeFileSync(target.replace(/\.ts$/, ".js"), typescript.transpileModule(readFileSync(target, "utf8"), { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
  }
  writeFileSync(path.join(fixture, "package.json"), '{"type":"module"}\n');
  return pathToFileURL(modulePath.replace(/\.ts$/, ".js")).href;
}

test("inherited frame selection refuses unauthenticated direct families without cold fallback", async () => {
  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-inherited-frame-selection-")));
  try {
    const modulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8") + "\nexport function inspectSelectionFixture(){return {childFailed:coldChildAuthenticationFailedV1,childHeld:coldChildAuthenticationV1!==null,helperHeld:coldHelperRuntimeContextV1!==null}}\n");
    const moduleUrl = await compilePlainRetirementFixtureV1(fixture, modulePath);
    const authorityRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const before = coldGenesisTreeSnapshotV1(authorityRoot);
    for (const [schema, entry, expected] of [
      ["setfarm.internal-production-pre-schema-spawner-direct-rebind-helper-capability.v1", "internal-production/baseline-service-restart-helper-v1.js", "direct inherited runtime capability is not authenticated"],
      ["setfarm.internal-production-pre-schema-spawner-direct-rebind-child-capability.v1", "spawner.js", "direct child runtime authentication failed"],
      ["setfarm.internal-production-pre-schema-spawner-direct-rebind-helper-capability.v1", "spawner.js", "frame family or entry is crossed"],
      ["unknown", "spawner.js", "frame family or entry is crossed"],
    ]) {
      const framePath = path.join(fixture, "frame"), writer = openSync(framePath, "wx+", 0o600);
      let reader: number | undefined;
      try {
        reader = openSync(framePath, "r"); unlinkSync(framePath);
        writeFileSync(writer, `${canonical({ schema })}\n`);
        const script = `import assert from 'node:assert/strict';import {closeSync} from 'node:fs';
const port=await import(${JSON.stringify(moduleUrl)});process.argv[1]=${JSON.stringify(path.join(fixture, "dist", entry!))};
assert.throws(()=>port.resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),error=>error.message.includes(${JSON.stringify(expected)}));
assert.deepEqual(port.inspectSelectionFixture(),{childFailed:false,childHeld:false,helperHeld:false});
closeSync(3);process.argv[1]='ordinary-after-refusal.js';
assert.throws(()=>port.resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),/authentication is revoked/);
process.stdout.write('refused');`;
        const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: fixture, env: { PATH: "/usr/bin:/bin" }, stdio: ["ignore", "pipe", "pipe", reader], encoding: "utf8", timeout: 10000, maxBuffer: 65536 });
        assert.equal(child.status, 0, `${schema}: ${child.stderr}`);
        assert.equal(child.stdout, "refused");
        assert.equal(child.stderr, "");
        assert.deepEqual(coldGenesisTreeSnapshotV1(authorityRoot), before);
      } finally { if (reader !== undefined) closeSync(reader); closeSync(writer); }
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

async function createColdEpochGenesisFixtureV1(source = readFileSync(sourcePath, "utf8")) {
  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-cold-genesis-case-")));
  const modulePath = installRetirementFixture(fixture, source);
  const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
  const epoch = path.join(root, "epoch-head.json"), lock = path.join(root, "physical-service-restart-authority.transition.lock");
  const historicalHead = readFileSync(epoch);
  unlinkSync(epoch);
  const port = path.join(fixture, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
  writeFileSync(port, readFileSync(port, "utf8") + '\nexport async function observeInternalProductionColdBootstrapObservationV1(){await globalThis.__coldGenesisObserverHook?.();return globalThis.__coldGenesisObservation;}\n');
  Reflect.set(globalThis, "__coldGenesisObservation", coldGenesisObservationFixture(fixture));
  const isolated = await import(`${pathToFileURL(modulePath).href}?cold-case=${Date.now()}-${Math.random()}`);
  return { fixture, root, epoch, lock, historicalHead, isolated, cleanup: () => {
    Reflect.deleteProperty(globalThis, "__coldGenesisObservation");
    Reflect.deleteProperty(globalThis, "__coldGenesisPublicationFault");
    Reflect.deleteProperty(globalThis, "__coldGenesisObserverHook");
    Reflect.deleteProperty(globalThis, "__coldGenesisSyncEvents");
    Reflect.deleteProperty(globalThis, "__coldGenesisSyncedInodes");
    Reflect.deleteProperty(globalThis, "__coldGenesisReleaseFault");
    Reflect.deleteProperty(globalThis, "__coldGenesisRawBefore");
    rmSync(fixture, { recursive: true, force: true });
  } };
}

function coldGenesisTreeSnapshotV1(root: string): unknown[] {
  const entries: unknown[] = [];
  const visit = (target: string, relative: string) => {
    const stats = lstatSync(target, { bigint: true });
    entries.push({ relative, ino: String(stats.ino), mode: String(stats.mode), uid: String(stats.uid), nlink: String(stats.nlink),
      size: String(stats.size), mtimeNs: String(stats.mtimeNs), ctimeNs: String(stats.ctimeNs),
      bytesHash: stats.isFile() ? createHash("sha256").update(readFileSync(target)).digest("hex") : null });
    if (stats.isDirectory()) for (const name of readdirSync(target).sort()) visit(path.join(target, name), relative ? `${relative}/${name}` : name);
  };
  visit(root, "");
  return entries;
}

async function createColdIntentFixtureV1(transformSource?: (source: string) => string) {
  const original = readFileSync(sourcePath, "utf8");
  assert.ok(original.includes("async function prepareColdSpawnerBootstrapIntentV1()"), "cold intent producer is not implemented");
  const rootSyncBoundary = "    fsyncParent(target);\n    assertColdIntentOnlyPrefixV1(state, false);";
  assert.equal(original.split(rootSyncBoundary).length - 1, 1, "inject at the cold intent's own root-sync boundary, not another publisher");
  const source = original.replace("    return created;\n", "    if (path.basename(file) === 'intent.json') globalThis.__coldIntentPublicationHook?.();\n    return created;\n")
    .replace("try { linkSync(temporary, file); }", "try { linkSync(temporary, file); if(path.basename(file)==='intent.json')globalThis.__coldIntentLinkedHook?.(); }")
    .replace("        const genesis = parseColdEpochGenesisReceiptV1(readColdGenesisCandidateV1(genesisPath, lstatSync(genesisPath, { bigint: true })));", "        globalThis.__coldIntentBeforeGenesisReadHook?.(genesisPath);\n        const genesis = parseColdEpochGenesisReceiptV1(readColdGenesisCandidateV1(genesisPath, lstatSync(genesisPath, { bigint: true })));\n        globalThis.__coldIntentAfterGenesisReadHook?.(genesisPath);")
    .replace(rootSyncBoundary, "    globalThis.__coldIntentRootSyncHook?.();\n" + rootSyncBoundary) + `
export { prepareColdSpawnerBootstrapIntentV1 };
export function inspectColdIntentFixtureV1(){const state=retainedColdBootstrapIntentV1;if(!state)return null;const held=heldLease(state.lease);return {phase:state.phase,descriptor:held.descriptor,lockBytesHash:sha256(held.lockBytes.toString()),intent:state.intent,nonceHash:sha256(state.nonce)};}
export function closeColdIntentFixtureV1(){if(typeof retainedColdBootstrapPreparationV1!=='undefined'&&retainedColdBootstrapPreparationV1){const preparation=retainedColdBootstrapPreparationV1;preparation.rootGuard?.close();const held=leases.get(preparation.lease);if(held)closeSync(held.descriptor);leases.delete(preparation.lease);retainedColdBootstrapPreparationV1=null;}if(retainedColdBootstrapIntentV1){const state=retainedColdBootstrapIntentV1,lease=state.lease,invocation=state.helperInvocation;if(invocation){for(const fd of [...invocation.transportDescriptors,...invocation.authorityDescriptors])closeSync(fd);for(const guard of invocation.guards)guard.close();}if(!state.release?.rootGuardClosed)state.rootGuard?.close();const held=leases.get(lease);if(held&&!state.release?.descriptorClosed)closeSync(held.descriptor);leases.delete(lease);retainedColdBootstrapIntentV1=null;}}
`;
  const fixture = await createColdEpochGenesisFixtureV1(transformSource ? transformSource(source) : source);
  const port = path.join(fixture.fixture, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
  writeFileSync(port, readFileSync(port, "utf8") + '\nexport async function observeInternalProductionSpawnerLaunchProfileCandidateV1(){globalThis.__coldControllerBeforeProfile?.();return globalThis.__coldIntentProfile;}\n');
  const observation = Reflect.get(globalThis, "__coldGenesisObservation");
  const profileBody = { schema: "setfarm.internal-production-spawner-launch-profile.v1", source: observation.source, uid: process.getuid!(),
    repository: fixture.fixture, cwd: fixture.fixture, arguments: [path.join(fixture.fixture, "dist/spawner.js")],
    environmentHash: "f".repeat(64) };
  Reflect.set(globalThis, "__coldIntentProfile", { profile: { ...profileBody, profileHash: sha256(canonical(profileBody)) }, environment: { FIXTURE_SECRET: "never-persist-cold-snapshot" } });
  return fixture;
}

async function createColdFrameFixtureV1() {
  assert.ok(readFileSync(sourcePath, "utf8").includes("function openColdSpawnerHelperFrameV1("), "cold helper frame sender is not implemented");
  return createColdIntentFixtureV1((source) => {
    const start = source.indexOf("function openColdSpawnerHelperFrameV1(");
    const end = source.indexOf("\nfunction assertEpochOneActive", start);
    assert.ok(start >= 0 && end > start);
    const frame = source.slice(start, end).replace(
      "  const guard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), root);",
      "  const observedFrameGuard = authenticatePrivateDirectoryChainV1(resolveInternalProductionBaselineWorkspaceRootV1(), root);\n  globalThis.__coldFrameGuardReadyHook?.();\n  const guard={assertStable(){observedFrameGuard.assertStable();globalThis.__coldFrameGuardCheckHook?.();},close(){globalThis.__coldFrameGuardCloseHook?.();observedFrameGuard.close();}};",
    );
    return (source.slice(0, start) + frame + source.slice(end))
    .replace('invocation.child = spawn(profile.executable.path,', 'invocation.child = spawn(globalThis.__coldControllerSpawnPath??profile.executable.path,')
    .replace('        invocation.completion = captureColdControllerHelperCompletionV1(invocation.child);', '        globalThis.__coldControllerSpawnedHook?.(invocation.child);\n        invocation.completion = captureColdControllerHelperCompletionV1(invocation.child);')
    .replace('    const claim = independentlyObserveColdControllerClaimV1(state, completion);', '    globalThis.__coldControllerBeforeClaimHook?.();\n    const claim = independentlyObserveColdControllerClaimV1(state, completion);')
    .replace('35_000', '(globalThis.__coldControllerWaitMs??35_000)')
    .replace('fail("cold process ownership is ambiguous")', 'fail("cold process ownership is ambiguous: "+JSON.stringify({pid,status:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout,stderr:result.stderr}))')
    .replace('      release.lockUnlinked = true;', '      release.lockUnlinked = true;\n      globalThis.__coldReleaseAfterUnlinkHook?.();')
    .replace('    retainedColdBootstrapIntentV1 = null;', '    retainedColdBootstrapIntentV1 = null;\n    globalThis.__coldControllerReleasedHook?.();')
    .replace('async function prepareColdSpawnerBootstrapIntentV1() {', 'async function prepareColdSpawnerBootstrapIntentV1() {\n  globalThis.__coldControllerPreparationHook?.();')
    .replace('      const preparation = retainedColdBootstrapPreparationV1, lease = preparation.lease;', '      const preparation = retainedColdBootstrapPreparationV1, lease = preparation.lease;\n      globalThis.__coldPreparationRetainedHook?.();')
    .replace('readInternalProductionSpawnerUntrustedInheritedFrameV1, verifyInternalProductionSpawnerLaunchOutputCandidateV1 }', 'readInternalProductionSpawnerUntrustedInheritedFrameV1, verifyInternalProductionSpawnerLaunchOutputCandidateV1 as initialColdControllerOutputVerifier }')
    .replace("  writeFileSync,", "  writeFileSync as realColdFrameWriteFileSync,")
    .replace("  unlinkSync,", "  unlinkSync as realColdFrameUnlinkSync,")
    .replace("  linkSync,", "  linkSync as realColdFrameLinkSync,")
    .replace("  openSync,", "  openSync as realColdFrameOpenSync,")
    .replace("  closeSync,", "  closeSync as realColdFrameCloseSync,")
    .replace("  fsyncSync,", "  fsyncSync as realColdFrameFsyncSync,") + `
function writeFileSync(...args:any[]){globalThis.__coldFrameWriteHook?.(...args);return realColdFrameWriteFileSync(...args);}
function unlinkSync(target:any){globalThis.__coldFrameBeforeUnlinkHook?.(String(target));realColdFrameUnlinkSync(target);globalThis.__coldFrameUnlinkHook?.(String(target));}
function linkSync(from:any,to:any){globalThis.__coldFrameBeforeLinkHook?.(String(from),String(to));realColdFrameLinkSync(from,to);globalThis.__coldFrameLinkedHook?.(String(from),String(to));}
function fsyncSync(fd:number){globalThis.__coldFrameBeforeSyncHook?.(fd);realColdFrameFsyncSync(fd);globalThis.__coldFrameSyncHook?.(fd);}
function openSync(...args:any[]){globalThis.__coldFrameBeforeOpenHook?.(...args);const fd=realColdFrameOpenSync(...args);globalThis.__coldFrameOpenedHook?.(fd,...args);return fd;}
function closeSync(fd:number){globalThis.__coldFrameBeforeCloseHook?.(fd);realColdFrameCloseSync(fd);globalThis.__coldFrameClosedHook?.(fd);}
function verifyInternalProductionSpawnerLaunchOutputCandidateV1(value:any){return (globalThis.__coldControllerCompiledOutputVerifier??initialColdControllerOutputVerifier)(value);}
export function openColdFrameFixtureV1(){return openColdSpawnerHelperFrameV1(retainedColdBootstrapIntentV1!);}
export function drainColdFrameFixtureV1(){for(const close of pendingColdHelperAuthenticationCleanupV1)close();return pendingColdHelperAuthenticationCleanupV1.size;}
export async function invokeColdControllerFixtureV1(){const result=await invokeColdSpawnerBootstrapHelperV1();globalThis.__coldControllerAfterObservationHook?.();return result;}
export async function settleColdControllerFixtureV1(){const result=await settleColdSpawnerBootstrapV1();globalThis.__coldControllerAfterSettlementHook?.();return result;}
export async function releaseColdControllerFixtureV1(){if(!retainedColdBootstrapIntentV1)throw Error('fixture cold controller absent');return releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(retainedColdBootstrapIntentV1.lease);}
export async function invokeFreshColdControllerFixtureV1(){const original=retainedColdBootstrapIntentV1;retainedColdBootstrapIntentV1=null;try{return await invokeColdSpawnerBootstrapHelperV1();}finally{retainedColdBootstrapIntentV1=original;}}
export async function ensureUnretainedColdControllerFixtureV1(){const original=retainedColdBootstrapIntentV1;retainedColdBootstrapIntentV1=null;try{return await ensureInternalProductionColdSpawnerBootstrapSettledV1();}finally{retainedColdBootstrapIntentV1=original;}}
`;
  });
}

test("cold helper frame retains descriptor ownership through failed close and preserves a replaced empty path", async () => {
  for (const fault of ["directory-close", "writer-close", "guard-close", "foreign-path", "reader-open", "parent-sync", "partial-write", "file-sync"] as const) {
    const fixture = await createColdFrameFixtureV1();
    const owned = new Set<number>();
    let guardDescriptors = new Set<number>();
    let injected = false, scratchPath = "", directoryCloses = 0;
    try {
      await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
      const retained = fixture.isolated.inspectColdIntentFixtureV1();
      Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, target: string) => { owned.add(fd); if (typeof target === "string" && path.basename(target).startsWith(".cold-helper-capability.")) scratchPath = target; });
      Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => { owned.delete(fd); });
      Reflect.set(globalThis, "__coldFrameGuardReadyHook", () => { guardDescriptors = new Set(owned); });
      Reflect.set(globalThis, "__coldFrameBeforeOpenHook", (target: string, flags: number) => {
        if (fault === "reader-open" && !injected && typeof target === "string" && path.basename(target).startsWith(".cold-helper-capability.") && (flags & 3) === 0) { injected = true; throw new Error("fixture frame reader open interrupted"); }
      });
      Reflect.set(globalThis, "__coldFrameSyncHook", (fd: number) => {
        if (injected) return;
        const stats = fstatSync(fd);
        if (fault === "file-sync" && stats.isFile() && stats.nlink === 0 || fault === "parent-sync" && stats.isDirectory() && scratchPath && !existsSync(scratchPath)) { injected = true; throw new Error("fixture frame sync interrupted"); }
      });
      Reflect.set(globalThis, "__coldFrameWriteHook", (fd: number, bytes: Buffer) => {
        if (fault !== "partial-write" || injected || !Buffer.isBuffer(bytes) || !bytes.includes("never-persist-cold-snapshot")) return;
        assert.equal(fstatSync(fd).nlink, 0); injected = true;
        writeFileSync(fd, bytes.subarray(0, 64)); throw new Error("fixture frame partial write interrupted");
      });
      Reflect.set(globalThis, "__coldFrameBeforeCloseHook", (fd: number) => {
        const stats = fstatSync(fd);
        if (fault === "directory-close" && !injected && guardDescriptors.has(fd) && stats.isDirectory() && ++directoryCloses === 2) { injected = true; throw new Error("fixture directory close interrupted"); }
        if (fault === "writer-close" && !injected && stats.isFile() && stats.nlink === 0 && stats.size > 0) { injected = true; throw new Error("fixture writer close interrupted"); }
      });
      Reflect.set(globalThis, "__coldFrameGuardCloseHook", () => { if (fault === "guard-close" && !injected) { injected = true; throw new Error("fixture guard close interrupted"); } });
      Reflect.set(globalThis, "__coldFrameGuardCheckHook", () => {
        if (fault !== "foreign-path" || injected || !scratchPath || !existsSync(scratchPath)) return;
        injected = true;
        renameSync(scratchPath, path.join(fixture.fixture, "owned-empty-moved"));
        writeFileSync(scratchPath, "foreign-must-survive", { mode: 0o600 });
      });
      assert.throws(() => fixture.isolated.openColdFrameFixtureV1(), /frame|interrupted|already closed/);
      assert.equal(injected, true);
      if (fault === "writer-close") {
        assert.equal(owned.size, 1); assert.throws(() => fixture.isolated.drainColdFrameFixtureV1(), /ambiguous/);
        const descriptor = [...owned][0]!; closeSync(descriptor); owned.delete(descriptor); // Fixture knows its injected close failed before the syscall.
        assert.equal(fixture.isolated.drainColdFrameFixtureV1(), 0);
      }
      assert.equal(owned.size, 0, `${fault}: all newly owned descriptors close on failure`);
      assert.equal(fstatSync(retained.descriptor).nlink, 1, "transport failure must not release the retained lease");
      if (fault === "foreign-path") assert.equal(readFileSync(scratchPath, "utf8"), "foreign-must-survive");
      else assert.deepEqual(readdirSync(path.join(fixture.root, "cold-spawner-bootstrap-v1")), ["intent.json"]);
    } finally {
      for (const key of ["__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldFrameBeforeOpenHook", "__coldFrameBeforeCloseHook", "__coldFrameGuardReadyHook", "__coldFrameGuardCloseHook", "__coldFrameGuardCheckHook", "__coldFrameWriteHook", "__coldFrameSyncHook", "__coldIntentProfile"]) Reflect.deleteProperty(globalThis, key);
      for (const fd of owned) { try { closeSync(fd); } catch { /* Test-only cleanup after a demonstrated leak. */ } }
      fixture.isolated.closeColdIntentFixtureV1(); fixture.cleanup();
    }
  }
});

test("cold helper frame writes secrets only after unlink and passes a read-only inherited descriptor", async () => {
  const fixture = await createColdFrameFixtureV1();
  let handles: { frameDescriptor: number; intentDescriptor: number } | undefined;
  let unlinked = false, parentSynced = false, secretWrites = 0;
  const root = path.join(fixture.root, "cold-spawner-bootstrap-v1");
  try {
    const intent = await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
    Reflect.set(globalThis, "__coldFrameUnlinkHook", (target: string) => { if (path.basename(target).startsWith(".cold-helper-capability.")) { unlinked = true; parentSynced = false; } });
    Reflect.set(globalThis, "__coldFrameSyncHook", (fd: number) => { const stats = fstatSync(fd); if (unlinked && stats.isDirectory() && stats.ino === lstatSync(root).ino) parentSynced = true; });
    Reflect.set(globalThis, "__coldFrameWriteHook", (fd: number | string, bytes: Buffer) => {
      if (!Buffer.isBuffer(bytes) || !bytes.includes("never-persist-cold-snapshot")) return;
      secretWrites += 1;
      assert.equal(typeof fd, "number");
      assert.equal(fstatSync(fd as number).nlink, 0, "secret bytes must never be written to a linked inode");
      assert.equal(unlinked && parentSynced, true, "unlink durability precedes the first secret write");
    });
    handles = fixture.isolated.openColdFrameFixtureV1();
    assert.equal(secretWrites, 1);
    assert.deepEqual(readdirSync(root), ["intent.json"]);
    assert.ok(!readFileSync(path.join(root, "intent.json")).includes("never-persist-cold-snapshot"));
    const state = fixture.isolated.inspectColdIntentFixtureV1();
    const reader = pathToFileURL(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-spawner-launch-environment-v1.ts")).href;
    const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", `
import {fstatSync,writeSync} from 'node:fs'; import {createHash} from 'node:crypto';
import {readInternalProductionSpawnerUntrustedInheritedFrameV1} from ${JSON.stringify(reader)};
const frame=JSON.parse(readInternalProductionSpawnerUntrustedInheritedFrameV1().toString());
let readOnly=false;try{writeSync(3,Buffer.from('x'));}catch(error){readOnly=error.code==='EBADF';}
const identity=fd=>{const s=fstatSync(fd,{bigint:true});return {devDecimal:String(s.dev),inoDecimal:String(s.ino)}};
process.stdout.write(JSON.stringify({schema:frame.schema,intentHash:frame.intentHash,secretMatches:frame.environment.FIXTURE_SECRET==='never-persist-cold-snapshot',nonceHash:createHash('sha256').update(frame.nonce).digest('hex'),nlink:fstatSync(3).nlink,mode:fstatSync(3).mode&4095,readOnly,lockIdentity:identity(4),intentIdentity:identity(5)}));
`], { encoding: "utf8", timeout: 10000, maxBuffer: 65536, stdio: ["ignore", "pipe", "pipe", handles.frameDescriptor, state.descriptor, handles.intentDescriptor], env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
    assert.equal(child.status, 0, child.stderr);
    const output = JSON.parse(child.stdout);
    assert.equal(output.schema, "setfarm.internal-production-cold-spawner-bootstrap-helper-capability.v1");
    assert.equal(output.intentHash, intent.intentHash);
    assert.equal(output.nonceHash, state.nonceHash);
    assert.equal(output.secretMatches, true);
    assert.equal(output.nlink, 0); assert.equal(output.mode, 0o600); assert.equal(output.readOnly, true);
    assert.deepEqual(output.lockIdentity, intent.lockIdentity);
    const intentStats = lstatSync(path.join(root, "intent.json"), { bigint: true });
    assert.deepEqual(output.intentIdentity, { devDecimal: String(intentStats.dev), inoDecimal: String(intentStats.ino) });
    assert.equal(fixture.isolated.inspectColdIntentFixtureV1().phase, "intent-only", "opening transport descriptors does not dispatch");
  } finally {
    if (handles) { closeSync(handles.frameDescriptor); closeSync(handles.intentDescriptor); }
    for (const key of ["__coldFrameWriteHook", "__coldFrameUnlinkHook", "__coldFrameSyncHook", "__coldIntentProfile"]) Reflect.deleteProperty(globalThis, key);
    fixture.isolated.closeColdIntentFixtureV1(); fixture.cleanup();
  }
});

test("cold helper transport refuses writer and reader reuse before its first secret write", async () => {
  for (const kind of ["writer", "reader"]) {
    const fixture = await createColdFrameFixtureV1(), owned = new Set<number>();
    let writer: number | undefined, reader: number | undefined, foreign: number | undefined, fired = false;
    const target = path.join(fixture.fixture, "foreign-empty");
    try {
      await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
      writeFileSync(target, "", { mode: 0o600, flag: "wx" });
      Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, target: string, flags: number) => { owned.add(fd); if (String(target).includes(".cold-helper-capability.")) { if ((flags & 3) === 1) writer = fd; else reader = fd; } });
      Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => owned.delete(fd));
      Reflect.set(globalThis, "__coldFrameSyncHook", (fd: number) => {
        if (fired || writer === undefined || reader === undefined || !fstatSync(fd).isDirectory() || fstatSync(writer).nlink !== 0) return;
        fired = true; const original = kind === "writer" ? writer : reader;
        closeSync(original); owned.delete(original); foreign = openSync(target, kind === "writer" ? "w" : "r"); assert.equal(foreign, original);
      });
      assert.throws(() => fixture.isolated.openColdFrameFixtureV1()); assert.equal(fired, true);
      assert.equal(readFileSync(target).length, 0, `${kind}: no secret reaches a foreign linked file`);
      assert.equal(fstatSync(foreign!).nlink, 1, `${kind}: refusal cleanup preserves the foreign FD`);
      assert.equal(owned.size, 0);
      assert.equal(fstatSync(fixture.isolated.inspectColdIntentFixtureV1().descriptor).nlink, 1);
    } finally {
      for (const key of ["__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldFrameSyncHook"]) Reflect.deleteProperty(globalThis, key);
      if (foreign !== undefined) try { closeSync(foreign); } catch { /* Test cleanup after demonstrated foreign close. */ }
      for (const fd of owned) try { closeSync(fd); } catch { /* Test cleanup after failed assertion. */ }
      fixture.isolated.closeColdIntentFixtureV1(); fixture.cleanup();
    }
  }
});

test("cold helper frame preserves a same-inode reopen after a lost writer-close response", async () => {
  const fixture = await createColdFrameFixtureV1(), owned = new Set<number>();
  let writer: number | undefined, reader: number | undefined, foreign: number | undefined, fired = false;
  try {
    await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
    Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, target: string, flags: number) => { owned.add(fd); if (String(target).includes(".cold-helper-capability.")) { if ((flags & 3) === 1) writer = fd; else reader = fd; } });
    Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => owned.delete(fd));
    Reflect.set(globalThis, "__coldFrameBeforeCloseHook", (fd: number) => {
      if (fired || fd !== writer || reader === undefined || fstatSync(fd).size === 0) return;
      fired = true; closeSync(fd); owned.delete(fd); foreign = openSync(`/dev/fd/${reader}`, "r"); assert.equal(foreign, fd);
      throw Error("fixture close response lost after same-inode reopen");
    });
    assert.throws(() => fixture.isolated.openColdFrameFixtureV1()); assert.equal(fired, true);
    assert.equal(fstatSync(foreign!).nlink, 0); assert.equal(owned.size, 0);
    assert.throws(() => fixture.isolated.drainColdFrameFixtureV1(), /ambiguous/);
    assert.throws(() => fixture.isolated.openColdFrameFixtureV1(), /ambiguous/);
    assert.equal(fstatSync(foreign!).size > 0, true);
    closeSync(foreign!); foreign = undefined; assert.equal(fixture.isolated.drainColdFrameFixtureV1(), 0);
  } finally {
    for (const key of ["__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldFrameBeforeCloseHook"]) Reflect.deleteProperty(globalThis, key);
    if (foreign !== undefined) try { closeSync(foreign); } catch { /* Failed assertion cleanup only. */ }
    for (const fd of owned) try { closeSync(fd); } catch { /* Failed assertion cleanup only. */ }
    fixture.isolated.closeColdIntentFixtureV1(); fixture.cleanup();
  }
});

test("cold helper frame retains failed-acquisition cleanup before any new frame", async () => {
  for (const kind of ["reader", "writer", "intent", "guard"]) {
  for (const persistent of [false, true]) {
    const fixture = await createColdFrameFixtureV1(), owned = new Set<number>();
    const paths = new Map<number, string>();
    let reader: number | undefined, failed = false, closeFault = true, opened = 0;
    try {
      await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
      Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, target: string, flags: number) => { owned.add(fd); paths.set(fd, target); opened++; if (typeof target === "string" && path.basename(target).startsWith(".cold-helper-capability.") && (flags & 3) === 0) reader = fd; });
      Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => { owned.delete(fd); paths.delete(fd); });
      Reflect.set(globalThis, "__coldFrameSyncHook", (fd: number) => { if (!failed && fstatSync(fd).isFile() && fstatSync(fd).nlink === 0) { failed = true; if (kind === "writer") reader = fd; if (kind === "intent") reader = [...paths].find(([, target]) => path.basename(target) === "intent.json")?.[0]; throw Error("fixture frame acquisition failed"); } });
      const closeInterrupted = () => { if (failed && closeFault) { if (!persistent) closeFault = false; throw Error(`fixture ${kind} cleanup failed`); } };
      Reflect.set(globalThis, "__coldFrameBeforeCloseHook", (fd: number) => { if (kind !== "guard" && fd === reader) closeInterrupted(); });
      Reflect.set(globalThis, "__coldFrameGuardCloseHook", () => { if (kind === "guard") closeInterrupted(); });
      assert.throws(() => fixture.isolated.openColdFrameFixtureV1());
      assert.equal(failed, true);
      if (persistent || kind === "reader" || kind === "writer") {
        assert.ok(owned.size > 0, `${kind}: interrupted ownership remains retained`);
        if (kind !== "guard") assert.equal(owned.size, 1);
        const before = opened;
        assert.throws(() => fixture.isolated.openColdFrameFixtureV1());
        assert.equal(opened, before, "pending cleanup fences all new acquisition");
        closeFault = false;
        if (kind === "reader" || kind === "writer") {
          assert.throws(() => fixture.isolated.drainColdFrameFixtureV1(), /ambiguous/);
          closeSync(reader!); owned.delete(reader!); // Test-only owner knows the injected failure was pre-effect.
          assert.equal(fixture.isolated.drainColdFrameFixtureV1(), 0);
        }
        const recovered = fixture.isolated.openColdFrameFixtureV1();
        closeSync(recovered.frameDescriptor); owned.delete(recovered.frameDescriptor);
        closeSync(recovered.intentDescriptor); owned.delete(recovered.intentDescriptor);
      }
      assert.equal(owned.size, 0, "failed acquisition cannot lose an unlinked reader");
    } finally {
      for (const key of ["__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldFrameSyncHook", "__coldFrameBeforeCloseHook", "__coldFrameGuardCloseHook"]) Reflect.deleteProperty(globalThis, key);
      for (const fd of owned) { try { closeSync(fd); } catch { /* Test cleanup after a demonstrated missing owner. */ } }
      fixture.isolated.closeColdIntentFixtureV1(); fixture.cleanup();
    }
  }
  }
});

async function exerciseDirectRebindFixtureV1(mode: "response-loss" | "profile-drift" | "ignored" | "dispatch-write" | "receipt-write" | "signal-before" | "frame-intent-replace" | "frame-dispatch-replace" | "frame-receipt-replace" | "direct-helper", spawnFault?: string) {
  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-rebind-profile-")));
  const directChildCleanupPath = path.join(fixture, "direct-child-cleanup-row");
  const actualDirectController = spawnFault?.startsWith("child-main-controller") ?? false;
  const directControllerFault = actualDirectController ? spawnFault!.slice("child-main-controller".length).replace(/^-/, "") : "";
  const actualDirectHelper = actualDirectController || (spawnFault?.startsWith("child-main-helper") ?? false);
  const directHelperFault = actualDirectController ? directControllerFault === "helper-failure" ? "no-eof" : "" : actualDirectHelper ? spawnFault!.slice("child-main-helper".length).replace(/^-/, "") : "";
  const directHelperAccepted = ["", "fragmented", "second"].includes(directHelperFault);
  const directHelperSelectorRefused = ["mixed", "invalid-selector", "missing-selector"].includes(directHelperFault);
  const directSpawnTracePath = path.join(fixture, "direct-spawn-trace");
  writeFileSync(directSpawnTracePath, "", { mode: 0o600 });
  const positiveDirectMain = spawnFault === "child-main" || actualDirectHelper;
  let targetPid: number | undefined, targetIdentity: ReturnType<typeof parseColdFixtureExitRowV1> | undefined;
  try {
    const source = readFileSync(sourcePath, "utf8"), typescript = await import("typescript");
    const tree = typescript.createSourceFile(sourcePath, source, typescript.ScriptTarget.Latest, true);
    const names = ["validateHistoricalSpawnerLaunchProfileV1", "validateColdHistoricalLaunchProfileV1", "parseDirectSpawnerRebindIntentV1", "parseLockRecord", "exactCanonicalRecord", "coldPairV1", "freezeColdDataV1", "coldRecordV1", "coldHashV1", "coldSelfHashV1", "canonical", "sha256", "fail"];
    const declarations = tree.statements.filter(statement => typescript.isFunctionDeclaration(statement) && statement.name && names.includes(statement.name.text));
    assert.equal(declarations.length, names.length, "extract actual shared and cold-specific validators exactly once");
    const harness = `import path from 'node:path';import{createHash}from'node:crypto';const SHA256=/^[a-f0-9]{64}$/;
function resolveInternalProductionBaselineWorkspaceRootV1(){return ${JSON.stringify(fixture)}}
${declarations.map(statement => statement.getText(tree)).join("\n")}
export {validateHistoricalSpawnerLaunchProfileV1,validateColdHistoricalLaunchProfileV1,parseDirectSpawnerRebindIntentV1};`;
    writeFileSync(path.join(fixture, "harness.mjs"), typescript.transpileModule(harness, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
    const module = await import(pathToFileURL(path.join(fixture, "harness.mjs")).href);
    const uid = process.getuid!(), repository = path.join(fixture, "repo"), home = path.join(fixture, "home"), environmentDirectory = path.join(fixture, "environment"), executablePath = "/opt/profile/bin/node";
    const metadata = { devDecimal: "1", inoDecimal: "2", uid, gid: process.getgid!(), mode: 0o700 };
    const directories = new Set<string>();
    for (const initial of [home, fixture, repository, environmentDirectory, path.join(repository, "dist"), path.join(home, "Library/LaunchAgents"), path.dirname(executablePath)]) {
      for (let target = initial; ; target = path.dirname(target)) { directories.add(target); if (path.dirname(target) === target) break; }
    }
    const hash = "a".repeat(64);
    const body = { schema: "setfarm.internal-production-spawner-launch-profile.v1", source: { branch: "main", clean: true, sha: "b".repeat(40), treeHash: "c".repeat(40), buildHash: hash, originMainSha: "b".repeat(40) }, uid, home, workspace: fixture, repository, rootIdentity: metadata, hostDirectories: [...directories].map(target => ({ path: target, ...metadata })), executable: { path: executablePath, ...metadata, mode: 0o555, bytesHash: hash }, arguments: [path.join(repository, "dist/spawner.js")], cwd: repository, environmentDirectory, buildInfoBytesHash: hash, outputTreeBytesHash: hash, releaseManifestBytesHash: hash, plistBytesHash: hash, loadedLaunchProjectionHash: hash, environmentHash: hash, environmentFiles: [".env", ".env.local"].map(name => ({ path: path.join(environmentDirectory, name), state: "absent" })) };
    const rehash = (value: any) => { delete value.profileHash; value.profileHash = sha256(canonical(value)); return value; };
    const profile = rehash(structuredClone(body));
    const before = canonical(profile);
    assert.doesNotThrow(() => module.validateHistoricalSpawnerLaunchProfileV1(profile));
    assert.equal(canonical(profile), before);
    assert.doesNotThrow(() => module.validateColdHistoricalLaunchProfileV1({ launchProfile: profile, coldObservation: { source: body.source, spawnerAbsence: { entrypoint: body.arguments[0] } } }));
    assert.throws(() => module.validateColdHistoricalLaunchProfileV1({ launchProfile: profile, coldObservation: { source: body.source, spawnerAbsence: { entrypoint: "/crossed/spawner.js" } } }), /entry is crossed/);
    const crossedSource = structuredClone(profile); crossedSource.source.sha = "e".repeat(40); crossedSource.source.originMainSha = crossedSource.source.sha; rehash(crossedSource);
    assert.doesNotThrow(() => module.validateHistoricalSpawnerLaunchProfileV1(crossedSource));
    assert.throws(() => module.validateColdHistoricalLaunchProfileV1({ launchProfile: crossedSource, coldObservation: { source: body.source, spawnerAbsence: { entrypoint: body.arguments[0] } } }), /entry is crossed/, "valid structural source cannot substitute for cold incident authority");
    const mutations: Array<(value: any) => void> = [
      value => { value.schema = "cold-capability"; }, value => { value.workspace += "/crossed"; }, value => { value.cwd += "/crossed"; }, value => { value.arguments.push("--caller-choice"); },
      value => { value.uid += 1; }, value => { value.executable.path = "relative/node"; }, value => { value.executable.mode = 0o777; }, value => { value.executable.mode = 0o600; }, value => { value.executable.uid += 1; },
      value => { value.hostDirectories.pop(); }, value => { value.hostDirectories.push(value.hostDirectories[0]); }, value => { value.hostDirectories.find((entry: any) => entry.path === repository).mode = 0o777; },
      value => { value.rootIdentity.inoDecimal = "9"; }, value => { value.rootIdentity.inoDecimal = "02"; }, value => { value.environmentFiles[0].path += ".crossed"; }, value => { value.environmentFiles.pop(); },
      value => { value.environmentFiles[0].state = "unknown"; }, value => { value.environmentFiles[0] = { ...value.environmentFiles[0], state: "present", ...metadata, mode: 0o666, bytesHash: hash }; },
      value => { value.environmentHash = "A".repeat(64); }, value => { value.executable.bytesHash = "bad"; }, value => { value.capability = "cold"; },
      value => { value.source.branch = "feature"; }, value => { value.source.clean = false; }, value => { value.source.originMainSha = "e".repeat(40); },
      value => { value.source.treeHash = "bad"; }, value => { value.source.sha = "B".repeat(40); value.source.originMainSha = value.source.sha; }, value => { value.source.buildHash = "bad"; }, value => { value.source.extra = true; },
    ];
    for (const mutate of mutations) { const value = structuredClone(profile); mutate(value); assert.throws(() => module.validateHistoricalSpawnerLaunchProfileV1(rehash(value)), /profile|historical|environment|host|executable|repository/); }
    const crossedHash = { ...profile, profileHash: "f".repeat(64) };
    assert.throws(() => module.validateHistoricalSpawnerLaunchProfileV1(crossedHash), /profileHash/);
    const pair = (stem: string, domain: string) => ({ [`${stem}Ref`]: `setfarm://internal-production/${domain}/sha256/${hash}`, [`${stem}Hash`]: hash });
    const intentBody = { schema: "setfarm.internal-production-pre-schema-spawner-direct-rebind-intent.v1", purpose: "operation-bound-pre-schema-spawner-rebind-v1", transport: "direct-detached-node-v1", terminationSignal: "SIGTERM", maximumTerminationDispatchCount: 1, maximumSpawnDispatchCount: 1,
      currentEntryOperation: pair("operation", "current-entry-operation"), restartAuthority: pair("restartAuthority", "pre-schema-spawner-restart-authority"), startupToken: pair("startupToken", "pre-schema-spawner-startup-token"), predecessorSpawnerProcessIdentity: pair("predecessorSpawnerProcessIdentity", "spawner-process-identity"),
      preMutationLoadedRuntimeServiceAuthority: pair("preMutationLoadedRuntimeServiceAuthority", "pre-mutation-loaded-runtime-service-authority"),
      launchProfile: profile, epoch: pair("epoch", "physical-service-restart-authority-epoch"), transitionLock: { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: process.pid, processStartTimeEpochMs: 1, processIdentityHash: hash, leaseNonce: hash }, lockIdentity: { devDecimal: "1", inoDecimal: "2" }, nonceHash: hash };
    const sealIntent = (value: any): Buffer => { delete value.intentRef; delete value.intentHash; const intentHash = sha256(canonical(value)); return Buffer.from(`${canonical({ ...value, intentRef: `setfarm://internal-production/pre-schema-spawner-direct-rebind-intent/sha256/${intentHash}`, intentHash })}\n`); };
    const intentBytes = sealIntent(structuredClone(intentBody));
    const intent = module.parseDirectSpawnerRebindIntentV1(intentBytes);
    assert.deepEqual(intent, JSON.parse(intentBytes.toString()));
    assert.equal(Object.isFrozen(intent.launchProfile.source), true);
    assert.equal(Object.isFrozen(intent.currentEntryOperation), true);
    for (const key of Object.keys(intentBody)) { const value = structuredClone(intentBody) as Record<string, unknown>; delete value[key]; assert.throws(() => module.parseDirectSpawnerRebindIntentV1(sealIntent(value))); }
    const intentFaults: Array<(value: any) => void> = [
      value => { value.schema = "setfarm.internal-production-cold-spawner-bootstrap-intent.v1"; }, value => { value.purpose = "exact-poison-sealed-cold-spawner-v1"; },
      value => { value.transport = "launchctl"; }, value => { value.terminationSignal = "SIGKILL"; }, value => { value.maximumTerminationDispatchCount = 2; }, value => { value.maximumSpawnDispatchCount = 0; },
      value => { value.coldObservation = {}; }, value => { value.lockIdentity.inoDecimal = "02"; }, value => { value.lockIdentity.devDecimal = "-1"; },
      value => { value.nonceHash = "bad"; }, value => { value.transitionLock.pid = 0; }, value => { value.launchProfile = crossedHash; },
    ];
    for (const [key, stem] of [["currentEntryOperation", "operation"], ["restartAuthority", "restartAuthority"], ["startupToken", "startupToken"], ["predecessorSpawnerProcessIdentity", "predecessorSpawnerProcessIdentity"], ["preMutationLoadedRuntimeServiceAuthority", "preMutationLoadedRuntimeServiceAuthority"], ["epoch", "epoch"]]) {
      intentFaults.push(value => { value[key!][`${stem}Ref`] = `setfarm://internal-production/cold-spawner-bootstrap-intent/sha256/${hash}`; });
      intentFaults.push(value => { value[key!][`${stem}Hash`] = "f".repeat(64); });
    }
    for (const mutate of intentFaults) { const value = structuredClone(intentBody); mutate(value); assert.throws(() => module.parseDirectSpawnerRebindIntentV1(sealIntent(value))); }
    for (const bytes of [Buffer.alloc(0), Buffer.from(intentBytes.toString().trim()), Buffer.from(` ${intentBytes.toString()}`), Buffer.alloc(8_388_609, 0x20), Buffer.from(intentBytes.toString().replace(/"intentHash":"[a-f0-9]+"/, `"intentHash":"${"f".repeat(64)}"`))]) assert.throws(() => module.parseDirectSpawnerRebindIntentV1(bytes));
    assert.ok(source.includes("async function resolveDirectSpawnerRebindInputsUnderLeaseV1("), "direct rebind must resolve original authority under the actual physical lease");
    assert.ok(source.includes("async function prepareDirectSpawnerRebindIntentV1("), "direct intent preparation must retain its original lease before publication");
    const writerMarker = "function publishDirectSpawnerRebindIntentV1(state: DirectSpawnerRebindIntentStateV1): void {";
    assert.equal(source.split(writerMarker).length - 1, 1);
    let runtimeSource = source.replace(writerMarker, "function actualDirectIntentPublisherFixtureV1(state: DirectSpawnerRebindIntentStateV1): void {").replace("function fsyncParent(file: string): void {", "function actualDirectFsyncParentFixtureV1(file: string): void {");
    for (const name of ["fsyncSync", "linkSync", "unlinkSync", "writeFileSync", "openSync", "closeSync", "fstatSync"]) {
      const marker = `  ${name},\n`;
      assert.equal(runtimeSource.split(marker).length - 1, 1, `instrument only the actual ${name} import`);
      runtimeSource = runtimeSource.replace(marker, `  ${name} as actualDirect_${name},\n`);
    }
    const directFrameWrite = "    // No nonce or environment value is written while a pathname names the file.\n    writeFileSync(writer, bytes); fsyncSync(writer);";
    assert.equal(runtimeSource.split(directFrameWrite).length - 1, 1, "frame fault targets exactly the direct unnamed secret write");
    runtimeSource = runtimeSource.replace(directFrameWrite, "    globalThis.__directFrameProbeV1?.beforeWrite?.(writer,scratch);writeFileSync(writer,globalThis.__directFrameProbeV1?.mode==='short-write'?bytes.subarray(0,1):bytes);fsyncSync(writer);");
    const directIntentOpen = "    intentDescriptor = openSync(paths.journal, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);";
    assert.equal(runtimeSource.split(directIntentOpen).length - 1, 1);
    runtimeSource = runtimeSource.replace(directIntentOpen, `${directIntentOpen}\n    if(globalThis.__directFrameProbeV1)globalThis.__directFrameProbeV1.intent=intentDescriptor;`);
    runtimeSource = runtimeSource.replaceAll("verifyInternalProductionSpawnerLaunchOutputCandidateV1({", "verifyDirectControllerOutputFixtureV1({");
    const spawnImport = 'import { spawn, spawnSync, type ChildProcess } from "node:child_process";';
    assert.equal(runtimeSource.split(spawnImport).length - 1, 1);
    runtimeSource = runtimeSource.replace(spawnImport, 'import { spawn as actualDirectControllerSpawnFixtureV1, spawnSync, type ChildProcess } from "node:child_process";');
    runtimeSource = runtimeSource.replace("publication.reader = { descriptor: openSync(publication.target,", "publication.reader = { descriptor: openDirectSettlementReaderFixtureV1(publication.target,");
    const pinnedReturn = "return Object.freeze({ bytes, assertStable, assertOwnedDescriptor, close:";
    assert.equal(runtimeSource.split(pinnedReturn).length - 1, 1);
    runtimeSource = runtimeSource.replace(pinnedReturn, "globalThis.__directPinnedDescriptorsV1?.set(label, descriptor); " + pinnedReturn);
    const cleanupReturned = "      history = await observeDirectSpawnerControllerSettlementHistoryV1();\n      if (history.preSchemaHelperJournalHash";
    assert.equal(runtimeSource.split(cleanupReturned).length - 1, 1);
    runtimeSource = runtimeSource.replace(cleanupReturned, "      history = await observeDirectSpawnerControllerSettlementHistoryV1();globalThis.__directCleanupReturnedV1?.();\n      if (history.preSchemaHelperJournalHash");
    const cleanupOuter = "    const assertHelper = await assertHelperJournalAllowsLockCleanup(parseLockRecord(state.lockBytes), descriptorIdentity(state.descriptor));";
    assert.equal(runtimeSource.split(cleanupOuter).length - 1, 2);
    runtimeSource = runtimeSource.replaceAll(cleanupOuter, cleanupOuter + "globalThis.__directCleanupOuterReturnedV1?.();");
    const runtimePath = installRetirementFixture(fixture, runtimeSource.replace('fail("authority directory identity is invalid")', 'fail("authority directory identity is invalid: "+JSON.stringify({current,before:[before.dev,before.ino,before.mode,before.nlink].map(String),observed:[observed.dev,observed.ino,observed.mode,observed.nlink].map(String)}))').replaceAll("process.kill(", "directSignalFixtureV1(") + `
export {resolveDirectSpawnerRebindInputsUnderLeaseV1,prepareDirectSpawnerRebindIntentV1};
import {existsSync} from 'node:fs';
function fstatSync(fd,...args){const p=globalThis.__directReleaseBoundaryV1;if(p?.fault==='unlink-stat'&&p.unlinked&&!p.fired&&fd===p.lock){p.fired=true;throw Error('DIRECT_RELEASE_STAT_FAULT')}return actualDirect_fstatSync(fd,...args)}
export function abandonDirectReleaseEpochFixtureV1(){if(retainedDirectSpawnerRebindIntentV1)retainedDirectSpawnerRebindIntentV1.epochPin={close(){}}}
export function cleanupPartialDirectReleaseFixtureV1(lease){
 const s=retainedDirectSpawnerRebindIntentV1,r=s?.release;if(!r)return;
 const errors=[],attempt=fn=>{try{fn()}catch(error){errors.push(error)}};
 for(const step of [...r.steps,r.rootClose])attempt(()=>{if(step.completed)return;if(step.pin)closePrivateFrameDescriptorV1(step.pin);else step.close();step.completed=true;});
 attempt(()=>closePrivateFrameDescriptorV1(r.parent));const fd=r.lock.descriptor;
 if(fd!==null)attempt(()=>{const current=actualDirect_fstatSync(fd,{bigint:true});if(current.dev!==s.lockIdentity.dev||current.ino!==s.lockIdentity.ino)throw Error('fixture lock cleanup identity crossed');
  if(existsSync(rootPaths().lock)){const visible=lstatSync(rootPaths().lock,{bigint:true});if(visible.dev===current.dev&&visible.ino===current.ino)actualDirect_unlinkSync(rootPaths().lock)}actualDirect_closeSync(fd);r.lock.descriptor=null});
 leases.delete(lease);retainedDirectSpawnerRebindIntentV1=null;
 if(errors.length)throw new AggregateError(errors,'partial direct fixture cleanup failed');
}
function openSync(...args){const fd=actualDirect_openSync(...args),probe=globalThis.__directFrameProbeV1;if(probe){probe.owned.add(fd);if(String(args[0]).includes('.direct-helper-capability.')){if((args[1]&constants.O_CREAT)!==0)probe.writer=fd;else probe.reader=fd;}if(args[0]===rootPaths().journal&&probe.intent===undefined&&probe.writes===0)probe.intent=fd;}const history=globalThis.__directHistoryCleanupV1;if(history){history.opens++;if(args[0]===rootPaths().journal&&history.targetFd===undefined){history.targetFd=fd;history.identity=fstatSync(fd,{bigint:true});}}return fd;}
function closeSync(fd){const probe=globalThis.__directFrameProbeV1;if(probe&&fd===probe.intent&&probe.mode==='intent-same-inode-reuse'&&probe.writes>0&&!probe.fired){probe.fired=true;actualDirect_closeSync(fd);probe.owned.delete(fd);probe.foreign=actualDirect_openSync(rootPaths().journal,constants.O_RDONLY);if(probe.foreign!==fd)throw Error('fixture same-inode FD was not reused');throw Error('DIRECT_FRAME_CLOSE_FAULT')}if(probe&&fd===probe.writer&&!probe.fired&&['late-mutation','close-response','close-reuse'].includes(probe.mode)){probe.fired=true;if(probe.mode==='late-mutation')actualDirect_writeFileSync(fd,'crossed-after-last-reader-check');else{actualDirect_closeSync(fd);probe.owned.delete(fd);if(probe.mode==='close-reuse'){probe.foreign=actualDirect_openSync('/dev/null',constants.O_RDONLY);if(probe.foreign!==fd)throw Error('fixture did not reuse original FD')}throw Error('DIRECT_FRAME_CLOSE_FAULT')}}if(probe&&fd===probe.writer&&(probe.mode==='persistent-close'||probe.mode==='writer-close'&&!probe.fired)){probe.fired=true;throw Error('DIRECT_FRAME_CLOSE_FAULT')}actualDirect_closeSync(fd);probe?.owned.delete(fd);}
function publishDirectSpawnerRebindIntentV1(state){const probe=globalThis.__directIntentPublicationFixtureV1;if(!probe)return actualDirectIntentPublisherFixtureV1(state);probe.attempts++;probe.intent=state.intent;if(probe.fault==='before'){probe.fault=null;throw Error('DIRECT_INTENT_PUBLICATION_BEFORE')}const result=actualDirectIntentPublisherFixtureV1(state);if(probe.fault==='after'){probe.fault=null;throw Error('DIRECT_INTENT_PUBLICATION_AFTER')}return result}
function fsyncParent(file:string){const probe=globalThis.__directIntentPublicationFixtureV1;if(path.basename(file)!=='pre-schema-helper-journal.json'||!probe)return actualDirectFsyncParentFixtureV1(file);if(probe.fault==='parent'&&!existsSync(retainedDirectSpawnerRebindIntentV1.publication.temporary)){probe.fault=null;throw Error('DIRECT_INTENT_PUBLICATION_PARENT')}actualDirectFsyncParentFixtureV1(file);probe.parentSyncs++}
function directPublicationProbeFixtureV1(){const state=retainedDirectSpawnerRebindIntentV1,probe=globalThis.__directIntentPublicationFixtureV1;return state&&probe?{state,probe}:null}
function directPublicationFaultFixtureV1(probe){probe.fault=null;throw Error('DIRECT_INTENT_PUBLICATION_BOUNDARY')}
function fsyncSync(fd){const current=directPublicationProbeFixtureV1();if(current&&fd===current.state.publication.descriptor){const{state,probe}=current;if(probe.fault==='temporary-sync'&&!existsSync(rootPaths().journal))directPublicationFaultFixtureV1(probe);if(probe.fault==='linked-sync'&&existsSync(rootPaths().journal)&&existsSync(state.publication.temporary))directPublicationFaultFixtureV1(probe)}actualDirect_fsyncSync(fd);const p=globalThis.__directFrameProbeV1;if(p&&!p.fired&&['secret-writer-reuse','secret-reader-reuse'].includes(p.mode)&&p.writer!==undefined&&p.reader!==undefined&&fstatSync(fd).isDirectory()&&fstatSync(p.writer).nlink===0){p.fired=true;const original=p.mode==='secret-writer-reuse'?p.writer:p.reader;actualDirect_closeSync(original);p.owned.delete(original);p.foreign=actualDirect_openSync(p.foreignPath,p.mode==='secret-writer-reuse'?constants.O_WRONLY:constants.O_RDONLY);if(p.foreign!==original)throw Error('fixture FD was not reused');}}
function linkSync(from,to){const current=directPublicationProbeFixtureV1();if(!current||from!==current.state.publication.temporary)return actualDirect_linkSync(from,to);const{probe}=current;probe.links++;if(probe.fault==='link-before')directPublicationFaultFixtureV1(probe);actualDirect_linkSync(from,to);if(probe.fault==='link-after')directPublicationFaultFixtureV1(probe)}
function unlinkSync(file){const current=directPublicationProbeFixtureV1();if(!current||file!==current.state.publication.temporary)return actualDirect_unlinkSync(file);const{probe}=current;probe.unlinks++;if(probe.fault==='unlink-before')directPublicationFaultFixtureV1(probe);actualDirect_unlinkSync(file);if(probe.fault==='unlink-after')directPublicationFaultFixtureV1(probe)}
function writeFileSync(file,bytes,...args){if(file===retainedDirectSpawnerRebindIntentV1?.termination?.dispatch?.descriptor||file===retainedDirectSpawnerRebindIntentV1?.termination?.receipt?.descriptor){actualDirect_writeFileSync(file,bytes,...args);globalThis.__directTerminationPublicationHook?.(file===retainedDirectSpawnerRebindIntentV1.termination.dispatch.descriptor?'dispatch':'receipt');return}const current=directPublicationProbeFixtureV1();if(!current||file!==current.state.publication.descriptor)return actualDirect_writeFileSync(file,bytes,...args);const{probe}=current;probe.writes++;if(probe.fault==='partial-write'){actualDirect_writeFileSync(file,bytes.subarray(0,17),...args);directPublicationFaultFixtureV1(probe)}actualDirect_writeFileSync(file,bytes,...args);if(probe.fault==='write-after')directPublicationFaultFixtureV1(probe)}
export function disturbDirectPublicationDescriptorFixtureV1(){const state=retainedDirectSpawnerRebindIntentV1;closeSync(state.publication.descriptor);state.publication.descriptor=openSync('/dev/null',constants.O_RDONLY)}
export async function terminateDirectFixtureV1(lease,input){return await terminateDirectSpawnerRebindPredecessorV1(lease,input)}
export function parseDirectTerminationFixtureV1(dispatch,receipt){const state=retainedDirectSpawnerRebindIntentV1;return parseDirectSpawnerTerminationChainV1(dispatch,receipt,state.intent,state.inputs.preMutation)}
export function openDirectHelperFrameFixtureV1(clone=false){const state=retainedDirectSpawnerRebindIntentV1;return openDirectSpawnerHelperFrameV1(clone?{...state}:state)}
export function directBorrowedLeaseDescriptorFixtureV1(){return heldLease(retainedDirectSpawnerRebindIntentV1.lease).descriptor}
export function parseDirectClaimFixtureV1(bytes,intent,dispatch){return parseDirectSpawnerClaimV1(bytes,intent,dispatch)}
export function parseDirectSpawnDispatchFixtureV1(bytes,intent,terminationDispatch,terminationReceipt){return parseDirectSpawnerSpawnDispatchV1(bytes,intent,terminationDispatch,terminationReceipt)}
function verifyDirectControllerOutputFixtureV1(input){return globalThis.__directControllerOutputFixtureV1(input)}
function spawn(executable,args,options){const probe=globalThis.__directControllerSpawnFixtureV1;probe?.calls.push({executable,args,options});return actualDirectControllerSpawnFixtureV1(probe?.fault==='spawn-error'?${JSON.stringify(path.join(fixture, "absent-controller-node"))}:executable,args,options)}
export async function invokeDirectControllerFixtureV1(lease,input,loseResponse=false){const completion=await invokeDirectSpawnerRebindHelperV1(lease,input);if(loseResponse)throw Error('DIRECT_CONTROLLER_RESPONSE_LOST');return completion}
export async function observeDirectControllerFixtureV1(lease,input){return observeDirectSpawnerRebindControllerClaimV1(lease,input)}
export async function settleDirectControllerFixtureV1(lease,input){return settleDirectSpawnerRebindControllerV1(lease,input)}
export async function readDirectSettlementHistoryFixtureV1(){return observeDirectSpawnerControllerSettlementHistoryV1()}
export async function assertDirectCleanupFixtureV1(unrelated=false){const intent=retainedDirectSpawnerRebindIntentV1.intent;const assertHistory=await assertHelperJournalAllowsLockCleanup(unrelated?{...intent.transitionLock,leaseNonce:'e'.repeat(64)}:intent.transitionLock,unrelated?{devDecimal:'0',inoDecimal:'0'}:intent.lockIdentity);assertHistory()}
export function validateDirectSettlementCensusFixtureV1(claim,census){return assertDirectControllerServiceCensusV1(retainedDirectSpawnerRebindIntentV1,claim,census)}
export function inspectDirectControllerFixtureV1(){const state=retainedDirectSpawnerRebindIntentV1,child=state.helperInvocation?.child;return {phase:state.phase,pid:child?.pid,exitCode:child?.exitCode,signalCode:child?.signalCode}}
export function hasDirectControllerOwnerFixtureV1(){return retainedDirectSpawnerRebindIntentV1!==null}
export function drainDirectFrameCleanupFixtureV1(){for(const close of pendingColdHelperAuthenticationCleanupV1)close();return pendingColdHelperAuthenticationCleanupV1.size}
function directSignalFixtureV1(pid,signal){const probe=globalThis.__directSignalFixtureV1;if(signal==='SIGTERM'&&probe){probe.calls.push({pid,signal});if(probe.before){probe.before=false;throw Error('DIRECT_SIGNAL_BEFORE')}const result=process.kill(pid,signal);if(probe.responseLoss){probe.responseLoss=false;throw Error('DIRECT_SIGNAL_RESPONSE_LOST')}return result}return process.kill(pid,signal)}
export async function releaseDirectPreparationFixtureV1(lease){const state=retainedDirectSpawnerRebindIntentV1;if(!state&&!leases.has(lease))return;if(state){if(state.lease!==lease)throw Error('foreign fixture cleanup');if(state.settlement){for(const pin of [state.settlement.writer,state.settlement.reader])if(pin)closePrivateFrameDescriptorV1(pin);state.settlement.guard?.close()}if(state.helperInvocation)for(const pin of [state.helperInvocation.frame,state.helperInvocation.intentReader,...(state.helperInvocation.observationPins??[])])if(pin)closePrivateFrameDescriptorV1(pin);state.intentPin?.close();state.epochPin?.close();if(state.publication.descriptor!==null)closeSync(state.publication.descriptor);if(existsSync(state.publication.temporary))unlinkSync(state.publication.temporary);if(state.termination){for(const publication of [state.termination.dispatch,state.termination.receipt])if(publication?.descriptor!==null&&publication?.descriptor!==undefined)closeSync(publication.descriptor);state.termination.rootGuard.close()}state.rootGuard.close();retainedDirectSpawnerRebindIntentV1=null;}if(existsSync(rootPaths().journal))unlinkSync(rootPaths().journal);await releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease)}
`.replace("function fsyncSync(fd){", "function priorDirectSettlementSyncFixtureV1(fd){")
      .replace("function fsyncParent(file:string){", "function priorDirectSettlementParentFixtureV1(file:string){")
      .replace("function closeSync(fd){", "function priorDirectSettlementCloseFixtureV1(fd){")
      .replace("function linkSync(from,to){", "function priorDirectSettlementLinkFixtureV1(from,to){")
      .replace("function unlinkSync(file){", "function priorDirectSettlementUnlinkFixtureV1(file){")
      .replace("function writeFileSync(file,bytes,...args){", "function priorDirectSettlementWriteFixtureV1(file,bytes,...args){") + `
function openDirectSettlementReaderFixtureV1(target,flags){
 const p=globalThis.__directSettlementPublicationV1;
 if(p?.fault==='reader-replace'&&!p.fired){const bytes=readFileSync(target);renameSync(target,${JSON.stringify(path.join(fixture, "settlement-original-final"))});actualDirect_writeFileSync(target,bytes,{mode:0o600,flag:'wx'});p.fired=true;}
 const descriptor=openSync(target,flags);if(p?.fault==='reader-replace'){p.ownedReader=descriptor;p.ownedReaderIdentity=fstatSync(descriptor,{bigint:true});}return descriptor;
}
function settlementSyscallFixtureV1(kind,args,invoke){
 const s=retainedDirectSpawnerRebindIntentV1?.settlement,p=globalThis.__directSettlementPublicationV1;
 if(!s||!p||!(['write','sync','close'].includes(kind)?args[0]===s.writer.descriptor:kind==='parent'?args[0]===s.target:args[0]===s.temporary))return invoke();
 p.calls.push(kind);const fault=p.fault;const fail=()=>{p.fired=true;throw Error('DIRECT_SETTLEMENT_BOUNDARY')};
 if(!p.fired&&fault===kind+'-before')fail();
 if(!p.fired&&kind==='write'&&fault==='partial-write'){actualDirect_writeFileSync(args[0],args[1].subarray(0,17));fail()}
 const result=invoke();
 if(!p.fired&&kind==='write'&&fault==='writer-replace'){
  renameSync(s.temporary,${JSON.stringify(path.join(fixture, "settlement-original-temp"))});actualDirect_closeSync(args[0]);actualDirect_writeFileSync(s.temporary,args[1],{mode:0o600,flag:'wx'});
  p.foreign=actualDirect_openSync(s.temporary,constants.O_RDWR);if(p.foreign!==args[0])throw Error('fixture writer FD was not reused');p.foreignIdentity=fstatSync(p.foreign,{bigint:true});fail();
 }
 if(!p.fired&&kind==='parent'&&fault==='late-sibling'&&!existsSync(s.temporary)){actualDirect_writeFileSync(path.join(path.dirname(s.target),'.'+path.basename(s.target)+'.foreign.tmp'),'foreign',{mode:0o600,flag:'wx'});p.fired=true;}
 if(!p.fired&&fault===kind+'-after')fail();return result;
}
function directReleaseSyscallFixtureV1(kind,fd,invoke){
 const p=globalThis.__directReleaseBoundaryV1,r=retainedDirectSpawnerRebindIntentV1?.release;if(!p||!r)return invoke();
 const slot=kind==='sync'&&fd===r.parent.descriptor?'parent-sync':kind==='close'&&fd===r.parent.descriptor?'parent-close':kind==='close'&&fd===r.lock.descriptor?'lock-close':kind==='close'&&fd===r.steps[0].pin.descriptor?'reader-close':kind==='close'&&fd===globalThis.__directPinnedDescriptorsV1?.get('direct rebind retained epoch')?'epoch-close':null;
 if(!slot||!p.fault.startsWith(slot)||p.fired)return invoke();
 p.descriptor=fd;p.identity=actualDirect_fstatSync(fd,{bigint:true});p.fired=true;
 if(p.fault.endsWith('-after'))invoke();throw Error('DIRECT_RELEASE_BOUNDARY');
}
function fsyncSync(fd){return directReleaseSyscallFixtureV1('sync',fd,()=>settlementSyscallFixtureV1('sync',[fd],()=>priorDirectSettlementSyncFixtureV1(fd)))}
function fsyncParent(file){return settlementSyscallFixtureV1('parent',[file],()=>priorDirectSettlementParentFixtureV1(file))}
function closeSync(fd){const history=globalThis.__directHistoryCleanupV1;if(history?.fault&&history.targetFd===fd)throw Error('DIRECT_HISTORY_CLOSE_FAULT');return directReleaseSyscallFixtureV1('close',fd,()=>settlementSyscallFixtureV1('close',[fd],()=>priorDirectSettlementCloseFixtureV1(fd)))}
function linkSync(from,to){return settlementSyscallFixtureV1('link',[from,to],()=>priorDirectSettlementLinkFixtureV1(from,to))}
function unlinkSync(file){const result=settlementSyscallFixtureV1('unlink',[file],()=>priorDirectSettlementUnlinkFixtureV1(file));const p=globalThis.__directReleaseBoundaryV1;if(p&&file===rootPaths().lock)p.unlinked=true;return result}
function writeFileSync(file,bytes,...args){return settlementSyscallFixtureV1('write',[file,bytes,...args],()=>priorDirectSettlementWriteFixtureV1(file,bytes,...args))}
export function inspectDirectSettlementFixtureV1(){const s=retainedDirectSpawnerRebindIntentV1?.settlement;return s?{target:s.target,temporary:s.temporary,record:s.record,writer:s.writer.descriptor,committed:s.committed}:null}
export function drainDirectSettlementReaderFixtureV1(){closePrivateFrameDescriptorV1(retainedDirectSpawnerRebindIntentV1.settlement.reader)}
`);
    const internal = path.dirname(runtimePath);
    const environment = { PATH: "/usr/bin:/bin", PRIVATE_VALUE: "direct-fixture-secret", HOME: home, LANG: "C", LC_ALL: "C", SETFARM_ENV_DIR: environmentDirectory, SETFARM_REPO_DIR: repository, SETFARM_PG_URL: "postgresql://fixture@127.0.0.1:1/disposable" };
    const directProfile = rehash({ ...structuredClone(profile), environmentHash: sha256(`setfarm.internal-production-spawner-launch-environment-candidate.v1\n${canonical(environment)}`) });
    directProfile.executable.path = process.execPath;
    for (let target = path.dirname(process.execPath); ; target = path.dirname(target)) {
      if (!directProfile.hostDirectories.some((entry: any) => entry.path === target)) directProfile.hostDirectories.push({ path: target, ...metadata });
      if (path.dirname(target) === target) break;
    }
    rehash(directProfile);
    const entry = directProfile.arguments[0], ready = path.join(fixture, "direct-target-ready"), signals = path.join(fixture, "direct-target-signals");
    // APFS directory nlink changes when a new signal/stop file appears. Keep
    // disposable control channels present before the original authority pin,
    // so a response-loss retry observes process exit, not fixture-root churn.
    writeFileSync(signals, "", { mode: 0o600, flag: "wx" });
    writeFileSync(path.join(fixture, "direct-owned-stop"), "", { mode: 0o600, flag: "wx" });
    mkdirSync(path.dirname(entry), { recursive: true, mode: 0o700 });
    writeFileSync(entry, `let directMainFixture;export function observeInternalProductionDirectSpawnerStartupOwnershipV1(){return directMainFixture.observeInternalProductionDirectSpawnerStartupOwnershipV1()}if(${JSON.stringify(spawnFault?.startsWith("child-") ?? false)}&&process.env.SETFARM_INTERNAL_PRODUCTION_DIRECT_CHILD){directMainFixture=await import('./direct-child-probe.js');directMainFixture.runDirectMainFixtureV1?.().catch(error=>{process.stderr.write(error.message);process.exitCode=1})}else{const{writeFileSync,appendFileSync,renameSync,readFileSync}=await import('node:fs');process.on('SIGTERM',()=>{appendFileSync(${JSON.stringify(signals)},'SIGTERM\\n',{mode:0o600});if(${JSON.stringify(mode)}!=='ignored')process.exit(0)});const ready=${JSON.stringify(ready)};writeFileSync(ready+'.pending',String(process.pid),{mode:0o600,flag:'wx'});renameSync(ready+'.pending',ready);setInterval(()=>{if(readFileSync(${JSON.stringify(path.join(fixture, "direct-owned-stop"))},'utf8').length>0)process.exit(0)},50);}\n`, { mode: 0o600 });
    directProfile.outputTreeBytesHash = sha256(readFileSync(entry, "utf8")); rehash(directProfile);
    const launcher = spawnSync(process.execPath, ["--input-type=module", "-e", `import{spawn}from'node:child_process';const child=spawn(process.execPath,[${JSON.stringify(entry)}],{cwd:${JSON.stringify(repository)},detached:true,stdio:'ignore'});child.unref();process.stdout.write(String(child.pid));`], { encoding: "utf8", timeout: 3000 });
    assert.equal(launcher.status, 0, launcher.stderr); assert.match(launcher.stdout, /^[1-9][0-9]*$/);
    targetPid = Number(launcher.stdout);
    for (let attempt = 0; attempt < 100 && !existsSync(ready); attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(readFileSync(ready, "utf8"), String(targetPid));
    targetIdentity = observeColdFixtureExitV1(targetPid)!;
    assert.ok(targetIdentity); assert.equal(targetIdentity.command, `${process.execPath} ${entry}`);
    assert.equal(targetIdentity.uid, String(uid)); assert.equal(targetIdentity.pgid, String(targetPid));
    const operation = { ...pair("operation", "current-entry-operation"), schema: "setfarm.internal-production-current-entry-operation.v1", purpose: "task6a-internal-production-current-entry-v1", controllerSource: directProfile.source, authorityV3Migration31Audit: pair("authorityV3Migration31Audit", "authority-v3-migration31-audit") };
    const predecessor = { schema: "setfarm.internal-production-spawner-process-identity.v1", pid: targetPid, processStartTimeEpochMs: Date.parse(targetIdentity.lstart), processIdentityHash: sha256(`${targetPid}\n${targetIdentity.lstart}\n`) };
    const predecessorHash = sha256(canonical(predecessor));
    const predecessorFields = { predecessorSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${predecessorHash}`, predecessorSpawnerProcessIdentityHash: predecessorHash, predecessorSpawnerServiceIdentityHash: hash, predecessorSpawnerGenerationHash: hash };
    const sourceFields = { targetSpawnerSourceSha: directProfile.source.sha, targetSpawnerTreeHash: directProfile.source.treeHash, targetSpawnerBuildHash: directProfile.source.buildHash };
    const preMutationPair = pair("preMutationLoadedRuntimeServiceAuthority", "pre-mutation-loaded-runtime-service-authority");
    const preMutation = { schema: "setfarm.internal-production-pre-mutation-loaded-runtime-service-projection-set.v1", ...preMutationPair, currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, ...(coldGenesisObservationFixture(fixture).remainingServices as object), spawner: { pid: predecessor.pid, processStartTimeEpochMs: predecessor.processStartTimeEpochMs, processIdentityHash: predecessor.processIdentityHash, serviceIdentityHash: hash, generationHash: hash, processOwnerCount: 1, listener: null } };
    const authorization = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-authorization.v1", purpose: "task6a-pre-schema-setfarm-spawner-rebind-v1", service: "setfarm-spawner", ...pair("authorization", "pre-schema-spawner-rebind-authorization"), currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, cleanSetfarmSourceSha: directProfile.source.sha, cleanSetfarmTreeHash: directProfile.source.treeHash, cleanSetfarmBuildHash: directProfile.source.buildHash, predecessorSpawnerServiceIdentityHash: hash, predecessorSpawnerGenerationHash: hash };
    const startup = { schema: "setfarm.internal-production-pre-schema-spawner-startup-token.v1", startupMode: "pre-manifest-bootstrap-sealed", ...pair("startupToken", "pre-schema-spawner-startup-token"), currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, preSchemaSpawnerRebindAuthorizationRef: authorization.authorizationRef, preSchemaSpawnerRebindAuthorizationHash: authorization.authorizationHash, task0SpawnerSourceSha: directProfile.source.sha, task0SpawnerTreeHash: directProfile.source.treeHash, task0SpawnerBuildHash: directProfile.source.buildHash, ...predecessorFields };
    const restart = { schema: "setfarm.internal-production-pre-schema-spawner-restart-authority.v2", ...pair("restartAuthority", "pre-schema-spawner-restart-authority"), currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, preSchemaSpawnerRebindAuthorizationRef: authorization.authorizationRef, preSchemaSpawnerRebindAuthorizationHash: authorization.authorizationHash, startupTokenRef: startup.startupTokenRef, startupTokenHash: startup.startupTokenHash, ...predecessorFields, ...sourceFields, ...preMutationPair, uid, actionId: "task6a-pre-schema-setfarm-spawner-rebind-v1", service: "setfarm-spawner", transport: "direct-detached-node-v1", launchProfileHash: directProfile.profileHash, terminationSignal: "SIGTERM", maximumTerminationDispatchCount: 1, maximumSpawnDispatchCount: 1 };
    const legacy = { ...pair("observation", "legacy-pre-manifest-zero-owner-observation"), schema: "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1", observationKind: "legacy-pre-manifest-existing-live-truth", ...operation.authorityV3Migration31Audit, cleanSetfarmSourceSha: directProfile.source.sha, cleanSetfarmTreeHash: directProfile.source.treeHash, cleanSetfarmBuildHash: directProfile.source.buildHash, observedSpawnerGenerationHash: hash };
    Object.assign(authorization, operation.authorityV3Migration31Audit, { legacyZeroOwnerObservationRef: legacy.observationRef, legacyZeroOwnerObservationHash: legacy.observationHash });
    const censusBody = { schema: "setfarm.internal-production-service-census.v1", ...(coldGenesisObservationFixture(fixture).remainingServices as object),
      spawner: { ...preMutation.spawner, loadedSourceSha: directProfile.source.sha, loadedTreeHash: directProfile.source.treeHash, loadedBuildHash: directProfile.source.buildHash } };
    const records = { operation, restart, startup, authorization, legacy, preMutation, profile: directProfile, environment, census: { ...censusBody, censusHash: sha256(canonical(censusBody)) } };
    const readPort = `import{projectInternalProductionSpawnerLaunchEnvironmentCandidateV1}from'./baseline-spawner-launch-environment-v1.js';
const read=(key)=>{const state=globalThis.__directRebindInputFixtureV1;state.calls.push(key);state.hook?.(key);if(key==='environment'){const{PRIVATE_VALUE,...base}=state.records.environment;const candidate=projectInternalProductionSpawnerLaunchEnvironmentCandidateV1(base,[Buffer.from('PRIVATE_VALUE='+PRIVATE_VALUE+'\\n'),null]);if(Object.getPrototypeOf(candidate.environment)!==null)throw Error('fixture must retain the real producer prototype');return state.customPrototype?Object.assign(Object.create({foreign:true}),candidate.environment):candidate.environment;}return structuredClone(state.records[key])};\n`;
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), readPort + `import{readFileSync}from'node:fs';import{createHash}from'node:crypto';${canonical.toString()}\nexport async function resolveInternalProductionCurrentEntryOperationV1(){return read('operation')}\nexport async function resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(){return read('legacy')}\nexport async function resolveInternalProductionHistoricalPreMutationRuntimeAuthorityV1(){return read('preMutation')}\nexport async function observeInternalProductionServiceCensusV1(){return read('census')}\nexport async function observeInternalProductionSpawnerLaunchProfileCandidateV1(){const profile=read('profile');profile.outputTreeBytesHash=createHash('sha256').update(readFileSync(${JSON.stringify(mode === "direct-helper" ? path.join(repository, "dist/PLATFORM_BUILD_OUTPUT_TREE.json") : entry)})).digest('hex');delete profile.profileHash;profile.profileHash=createHash('sha256').update(canonical(profile)).digest('hex');const result={profile};Object.defineProperty(result,'environment',{value:read('environment'),enumerable:false});return Object.freeze(result)}\n`);
    const receiptFixturePath = path.join(internal, "baseline-post-handoff-receipt-v1.ts");
    writeFileSync(receiptFixturePath, readFileSync(receiptFixturePath, "utf8").replace("export async function observeInternalProductionSpawnerLaunchProfileCandidateV1(){", "export async function observeInternalProductionSpawnerLaunchProfileCandidateV1(){await globalThis.__directControllerProfileGateV1?.();")
      .replace("export async function resolveInternalProductionHistoricalPreMutationRuntimeAuthorityV1(){", "export async function resolveInternalProductionHistoricalPreMutationRuntimeAuthorityV1(){await globalThis.__directControllerHistoryGateV1?.();")
      .replace("export async function observeInternalProductionServiceCensusV1(){", "export async function observeInternalProductionServiceCensusV1(){await globalThis.__directControllerCensusGateV1?.();"));
    writeFileSync(path.join(internal, "baseline-spawner-startup-admission-v1.ts"), readPort + `export async function resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(){return read('restart')}\nexport async function resolveInternalProductionPreSchemaSpawnerStartupTokenV1(){return read('startup')}\nexport async function resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1(){return read('authorization')}\n`);
    const processRecord = path.join(fixture, "data/internal-production-baseline/pre-schema-spawner-rebind-v1/records/process-identity/sha256", predecessorHash.slice(0, 2), predecessorHash + ".json");
    mkdirSync(path.dirname(processRecord), { recursive: true, mode: 0o700 });
    writeFileSync(processRecord, canonical(predecessor) + "\n", { mode: 0o600 });
    const runtime = await import(pathToFileURL(runtimePath).href);
    let lease = await runtime.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    Reflect.set(globalThis, "__directPinnedDescriptorsV1", new Map());
    try {
      const helperCompiled = mode === "direct-helper" ? installDirectHelperCompiledFixtureV1() : null;
      const input = { currentEntryOperation: pair("operation", "current-entry-operation"), restartAuthority: pair("restartAuthority", "pre-schema-spawner-restart-authority") };
      const run = async (mutate?: (value: any) => void, hook?: (key: string) => void) => {
        const observed = structuredClone(records); mutate?.(observed);
        Reflect.set(globalThis, "__directRebindInputFixtureV1", { records: observed, calls: [], hook });
        return runtime.resolveDirectSpawnerRebindInputsUnderLeaseV1(lease, input);
      };
      const resolved = await run();
      assert.deepEqual(resolved.preMutation, preMutation);
      assert.deepEqual(resolved.environment, environment);
      assert.equal(JSON.stringify(resolved).includes("direct-fixture-secret"), false, "plaintext environment is not persisted by spreading or serializing the resolved authority");
      assert.equal(Object.isFrozen(resolved.preMutation.spawner), true);
      const faults: Array<(value: any) => void> = [
        value => { value.operation.purpose = "cold-bootstrap"; }, value => { value.operation.operationHash = "b".repeat(64); },
        value => { value.restart.schema = "setfarm.internal-production-pre-schema-spawner-restart-authority.v1"; }, value => { value.restart.currentEntryOperationHash = "b".repeat(64); }, value => { value.restart.launchProfileHash = "b".repeat(64); }, value => { value.restart.preMutationLoadedRuntimeServiceAuthorityHash = "b".repeat(64); },
        value => { value.startup.startupMode = "ordinary"; }, value => { value.startup.predecessorSpawnerProcessIdentityHash = "b".repeat(64); }, value => { value.startup.preSchemaSpawnerRebindAuthorizationHash = "b".repeat(64); }, value => { value.startup.task0SpawnerBuildHash = "b".repeat(64); },
        value => { value.authorization.currentEntryOperationHash = "b".repeat(64); }, value => { value.authorization.predecessorSpawnerGenerationHash = "b".repeat(64); }, value => { value.authorization.cleanSetfarmTreeHash = "b".repeat(40); },
        value => { value.preMutation.currentEntryOperationHash = "b".repeat(64); }, value => { value.preMutation.spawner.pid++; }, value => { value.preMutation.spawner.processStartTimeEpochMs++; }, value => { value.preMutation.spawner.processIdentityHash = "b".repeat(64); }, value => { value.preMutation.spawner.serviceIdentityHash = "b".repeat(64); },
        value => { value.environment.PRIVATE_VALUE = "crossed"; },
        value => { value.authorization.authorityV3Migration31AuditHash = "b".repeat(64); },
        value => { value.authorization.legacyZeroOwnerObservationHash = "b".repeat(64); },
        value => { value.legacy.authorityV3Migration31AuditHash = "b".repeat(64); },
        value => { value.legacy.cleanSetfarmBuildHash = "b".repeat(64); },
        value => { value.legacy.observedSpawnerGenerationHash = "b".repeat(64); },
      ];
      for (const mutate of faults) await assert.rejects(run(mutate), /direct rebind|profile/);
      await assert.rejects(run(undefined, key => { if (key === "environment") Reflect.get(globalThis, "__directRebindInputFixtureV1").customPrototype = true; }), /environment/, "accepting the real null-prototype producer does not admit an arbitrary prototype");
      await assert.rejects(runtime.resolveDirectSpawnerRebindInputsUnderLeaseV1({ ...lease }, input), /lease/);
      await assert.rejects(run(undefined, key => { if (key === "profile") { const bytes = readFileSync(processRecord); renameSync(processRecord, processRecord + ".old"); writeFileSync(processRecord, bytes, { mode: 0o600 }); } }), /changed/, "the same bytes on a replacement process-authority inode cannot cross an await");
      const epochPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json");
      await assert.rejects(run(undefined, key => { if (key === "profile") { const bytes = readFileSync(epochPath); renameSync(epochPath, epochPath + ".old"); writeFileSync(epochPath, bytes, { mode: 0o600 }); } }), /changed/, "the original epoch inode remains bound across awaits");
      assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json")), false, "input authentication cannot publish dispatch permission");
      for (const fault of ["replace", "parent", "before", "after", "temporary-sync", "linked-sync", "link-before", "link-after", "unlink-before", "unlink-after", "write-after", "partial-write"] as const) {
        await run(); // Reset the independent authenticated observation ports.
        const publication = { fault: (fault === "replace" ? "after" : fault) as string | null, attempts: 0, parentSyncs: 0, links: 0, unlinks: 0, writes: 0, intent: null as any };
        Reflect.set(globalThis, "__directIntentPublicationFixtureV1", publication);
        await assert.rejects(runtime.prepareDirectSpawnerRebindIntentV1(lease, input), /DIRECT_INTENT_PUBLICATION/);
        const originalIntent = publication.intent;
        assert.ok(originalIntent?.intentHash);
        await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
        await run(); // Refused release must preserve the exact live lease, not only its path.
        const journal = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json");
        if (fault === "replace" || fault === "partial-write") {
          if (fault === "replace") {
            const bytes = readFileSync(journal);
            renameSync(journal, journal + ".old");
            writeFileSync(journal, bytes, { mode: 0o600 });
          }
          const writes = publication.writes;
          await assert.rejects(runtime.prepareDirectSpawnerRebindIntentV1(lease, input), /changed|identity|crossed/, "response loss cannot authorize adopting a replacement inode or rewriting partial bytes");
          assert.equal(publication.writes, writes);
          await runtime.releaseDirectPreparationFixtureV1(lease);
          Reflect.deleteProperty(globalThis, "__directIntentPublicationFixtureV1");
          lease = await runtime.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
          continue;
        }
        const parentSyncs = publication.parentSyncs;
        const resumed = await runtime.prepareDirectSpawnerRebindIntentV1(lease, input);
        assert.deepEqual(resumed, originalIntent, "retry retains the original nonce, inputs and intent hash");
        assert.equal(publication.writes, 1, "recovery retains the original write and file descriptor");
        if (fault === "link-after") assert.equal(publication.links, 1, "a visible owned link is observed, not dispatched twice");
        if (fault === "unlink-after") assert.equal(publication.unlinks, 1, "an absent owned temporary is observed, not removed twice");
        if (fault === "parent") assert.ok(publication.parentSyncs > parentSyncs, "final-only response-loss recovery must complete the missing parent fsync before returning an intent");
        const identity = lstatSync(journal, { bigint: true });
        const writes = publication.writes;
        assert.deepEqual(await runtime.prepareDirectSpawnerRebindIntentV1(lease, input), resumed);
        assert.equal(publication.writes, writes, "settled intent publication is not written again on replay");
        assert.equal(lstatSync(journal, { bigint: true }).ino, identity.ino);
        await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
        await assert.rejects(runtime.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1(), /shape|schema|direct|journal/i, "an intent is not a terminal helper census");
        if (fault === "after") {
          const unexpected = path.join(path.dirname(journal), `.pre-schema-helper-journal.json.${"1".repeat(32)}.tmp`);
          writeFileSync(unexpected, readFileSync(journal), { mode: 0o600 });
          await assert.rejects(runtime.prepareDirectSpawnerRebindIntentV1(lease, input), /inventory|temporary/, "committed preparation still refuses a newly appeared pending publication");
          unlinkSync(unexpected);
          runtime.disturbDirectPublicationDescriptorFixtureV1();
          await assert.rejects(runtime.prepareDirectSpawnerRebindIntentV1(lease, input), /identity changed/, "the final pin does not substitute for the original publication descriptor");
        }
        await runtime.releaseDirectPreparationFixtureV1(lease);
        Reflect.deleteProperty(globalThis, "__directIntentPublicationFixtureV1");
        lease = await runtime.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
      }
      await run();
      const signalProbe = { calls: [] as Array<{ pid: number; signal: string }>, responseLoss: mode === "response-loss" || mode.startsWith("frame-") || mode === "direct-helper", before: mode === "signal-before" };
      Reflect.set(globalThis, "__directSignalFixtureV1", signalProbe);
      if (mode === "response-loss") {
        for (const field of ["pid", "processStartTimeEpochMs", "processIdentityHash", "serviceIdentityHash", "generationHash", "loadedSourceSha", "loadedTreeHash", "loadedBuildHash", "processOwnerCount", "listener"]) {
          await run(value => { const old = value.census.spawner[field]; value.census.spawner[field] = typeof old === "number" ? old + 1 : field === "listener" ? { port: 3333 } : "f".repeat(typeof old === "string" ? old.length : 64); });
          await assert.rejects(runtime.terminateDirectFixtureV1(lease, input), /fresh predecessor census/, `${field}: refreshed authority cannot substitute for the original predecessor`);
          assert.deepEqual(signalProbe.calls, []);
        }
        await run();
      }
      if (mode === "dispatch-write" || mode === "receipt-write") {
        Reflect.set(globalThis, "__directTerminationPublicationHook", (phase: string) => { if (mode === `${phase}-write`) throw Error("DIRECT_TERMINATION_PUBLICATION_FAULT"); });
        await assert.rejects(runtime.terminateDirectFixtureV1(lease, input), /DIRECT_TERMINATION_PUBLICATION_FAULT/);
        const privateRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1");
        const before = coldGenesisTreeSnapshotV1(privateRoot);
        Reflect.deleteProperty(globalThis, "__directTerminationPublicationHook");
        await assert.rejects(runtime.terminateDirectFixtureV1(lease, input), /publication is uncertain/);
        assert.deepEqual(coldGenesisTreeSnapshotV1(privateRoot), before, "an uncertain publication is neither rewritten nor admitted on retry");
        assert.equal(signalProbe.calls.length, mode === "dispatch-write" ? 0 : 1);
        if (mode === "dispatch-write") assert.equal(assertColdFixtureExitObservationV1(observeColdFixtureExitV1(targetPid), targetIdentity), "running");
        else assert.equal(observeColdFixtureExitV1(targetPid), null);
        await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
        return;
      }
      if (mode === "profile-drift") {
        Reflect.set(globalThis, "__directTerminationPublicationHook", () => writeFileSync(entry, readFileSync(entry, "utf8") + "// drift after dispatch publication\n", { mode: 0o600 }));
        await assert.rejects(runtime.terminateDirectFixtureV1(lease, input), /profile|source/, "dispatch publication cannot hide a changed launch output from the last signal gate");
        assert.deepEqual(signalProbe.calls, []);
        assert.equal(assertColdFixtureExitObservationV1(observeColdFixtureExitV1(targetPid), targetIdentity), "running");
        await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
        return;
      }
      await assert.rejects(runtime.terminateDirectFixtureV1(lease, input), mode === "ignored" ? /DIRECT_TERMINATION_PENDING/ : mode === "signal-before" ? /DIRECT_SIGNAL_BEFORE/ : /DIRECT_SIGNAL_RESPONSE_LOST/);
      let terminal: any;
      if (mode === "ignored" || mode === "signal-before") {
        assert.equal(assertColdFixtureExitObservationV1(observeColdFixtureExitV1(targetPid), targetIdentity), "running");
        assert.deepEqual(readdirSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1")), ["termination-dispatch.json"]);
        await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
        const retry = runtime.terminateDirectFixtureV1(lease, input);
        await new Promise(resolve => setTimeout(resolve, 150));
        assert.equal(signalProbe.calls.length, 1, "retry while the ignored target is alive cannot signal twice");
        writeFileSync(path.join(fixture, "direct-owned-stop"), "owned test teardown", { mode: 0o600 });
        terminal = await retry;
      } else terminal = await runtime.terminateDirectFixtureV1(lease, input);
      assert.equal(terminal.schema, "setfarm.internal-production-pre-schema-spawner-direct-termination-receipt.v1");
      assert.equal(terminal.observedProcessState, "terminal-and-not-running");
      assert.equal(terminal.terminationSignal, "SIGTERM");
      assert.equal(terminal.signalDispatchCount, 1);
      assert.equal(terminal.controller.pid, process.pid);
      assert.deepEqual(signalProbe.calls, [{ pid: targetPid, signal: "SIGTERM" }]);
      if (mode === "signal-before") assert.equal(readFileSync(signals, "utf8"), "", "a failed pre-effect signal response cannot be retried as another syscall");
      else assert.equal(readFileSync(signals, "utf8"), "SIGTERM\n");
      assert.equal(observeColdFixtureExitV1(targetPid), null);
      assert.deepEqual(await runtime.terminateDirectFixtureV1(lease, input), terminal);
      assert.equal(signalProbe.calls.length, 1, "terminal replay cannot signal or spawn again");
      await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
      const privateRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1");
      assert.deepEqual(readdirSync(privateRoot).sort(), ["termination-dispatch.json", "termination-receipt.json"]);
      function installDirectHelperCompiledFixtureV1() {
        const compiled = new Set<string>();
        const compile = (relative: string, source: string) => {
          compiled.add(relative); const target = path.join(repository, "dist", relative.replace(/\.ts$/, ".js"));
          mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
          writeFileSync(target, typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText, { mode: 0o600 });
        };
        const compileStatic = (relative: string) => {
          if (compiled.has(relative)) return;
          assert.ok(compiled.size < 128);
          const source = readFileSync(path.resolve(import.meta.dirname, "../../src", relative), "utf8"); compile(relative, source);
          const tree = typescript.createSourceFile(relative, source, typescript.ScriptTarget.Latest, true);
          for (const statement of tree.statements) {
            if (!typescript.isImportDeclaration(statement) || statement.importClause?.isTypeOnly || !typescript.isStringLiteral(statement.moduleSpecifier)) continue;
            const bindings = statement.importClause?.namedBindings;
            if (!statement.importClause?.name && bindings && typescript.isNamedImports(bindings) && bindings.elements.every(element => element.isTypeOnly)) continue;
            if (statement.moduleSpecifier.text.startsWith(".")) compileStatic(path.normalize(path.join(path.dirname(relative), statement.moduleSpecifier.text.replace(/\.js$/, ".ts"))));
          }
        };
        compile("internal-production/baseline-workspace-authority-path-v1.ts", readFileSync(path.join(internal, "baseline-workspace-authority-path-v1.ts"), "utf8"));
        const parentUidReturn = "  return { uid, ppid, pgid };";
        assert.equal(source.split(parentUidReturn).length - 1, 1);
        let helperSource = source.replace(parentUidReturn, "  return { uid:globalThis.__directHelperParentUidFault?uid+1:uid, ppid, pgid };");
        if (actualDirectHelper) {
          helperSource = helperSource.replace('import { spawn, spawnSync, type ChildProcess } from "node:child_process";', 'import { spawn as actualDirectSpawnEffectV1, spawnSync, type ChildProcess } from "node:child_process";');
          helperSource += `\nfunction spawn(...args){const target=${JSON.stringify(directSpawnTracePath)};writeFileSync(target,readFileSync(target,'utf8')+JSON.stringify({executable:args[0],arguments:args[1],options:args[2]})+'\\n');if(${JSON.stringify(directHelperFault)}==='spawn-error')throw Error('DIRECT_FIXTURE_SPAWN_ERROR');return actualDirectSpawnEffectV1(...args)}\n`;
          for (const [marker, replacement] of [
            ["    completion = authentication.observeChildClaim(child, envelope);", "    await globalThis.__directHelperBeforeClaimV1?.(child,envelope);completion = authentication.observeChildClaim(child, envelope);"],
            ["      childClaim = { record, rootIdentity: rootStats, reader, assertLive: () => { assertChild(); assertStartup(); } };", "      childClaim = { record, rootIdentity: rootStats, reader, assertLive: () => { assertChild(); assertStartup(); } };globalThis.__directHelperClaimOwnedV1=true;"],
            ["      assertOriginalStable();\n    };\n    const assertRuntimeStable = () => { assertStable(); assertPhysicalRuntimeStable(); assertStable(); };", "      assertOriginalStable();globalThis.__directHelperAfterOutputV1?.();\n    };\n    const assertRuntimeStable = () => { assertStable(); assertPhysicalRuntimeStable(); assertStable(); };"],
          ]) { assert.equal(helperSource.split(marker!).length - 1, 1); helperSource = helperSource.replace(marker!, replacement!); }
          if (directHelperFault === "no-eof") {
            const marker = '      const timer = setTimeout(() => finish(Error("direct child readiness timed out")), 30_000);';
            assert.equal(helperSource.split(marker).length - 1, 1);
            helperSource = helperSource.replace(marker, '      const timer = setTimeout(() => { globalThis.__directHelperTimeoutFiredV1?.(count); finish(Error("direct child readiness timed out")); }, 5_000);');
          }
        }
        if (spawnFault !== undefined) {
          for (const name of ["openSync", "closeSync", "writeFileSync", "fsyncSync"]) {
            const marker = `  ${name},\n`; assert.equal(helperSource.split(marker).length - 1, 1);
            helperSource = helperSource.replace(marker, `  ${name} as actualSpawn_${name},\n`);
          }
          for (const [marker, replacement] of [
            ["      fsyncParent(scratch); assertMembers();", "      fsyncParent(scratch);globalThis.__directSpawnProbeV1?.boundary('unlinked',frameWriter.descriptor);assertMembers();"],
            ["      assertMembers(); assertPhysicalRuntimeStable(); assertMembers(); assertFrame(frameReader);", "      assertMembers();globalThis.__directSpawnProbeV1?.boundary('final');assertPhysicalRuntimeStable();assertMembers();assertFrame(frameReader);"],
          ]) { assert.equal(helperSource.split(marker!).length - 1, 1); helperSource = helperSource.replace(marker!, replacement!); }
          helperSource += `
function openSync(...args){const p=globalThis.__directSpawnProbeV1;if(p&&!p.fired&&p.fault==='collision'&&String(args[0]).endsWith('/spawn-dispatch.json')&&(args[1]&constants.O_CREAT)){p.fired=true;actualSpawn_writeFileSync(args[0],'foreign',{mode:0o600,flag:'wx'});}const fd=actualSpawn_openSync(...args);if(p){p.owned.add(fd);if(String(args[0]).endsWith('/spawn-dispatch.json')&&(args[1]&constants.O_CREAT))p.writer=fd;if(String(args[0]).includes('.direct-child-capability.')){if(args[1]&constants.O_CREAT)p.frameWriter=fd;else p.frameReader=fd;}}return fd;}
function closeSync(fd){globalThis.__directHelperCloseFaultV1?.(fd);const p=globalThis.__directSpawnProbeV1;if(p&&fd===p.frameWriter&&!p.fired&&p.fault==='late-frame'){p.fired=true;actualSpawn_writeFileSync(fd,'crossed-after-read');}if(p&&fd===p.writer&&!p.fired&&['writer-close','close-response','close-reuse','same-inode-close'].includes(p.fault)){p.fired=true;if(p.fault!=='writer-close'){actualSpawn_closeSync(fd);p.owned.delete(fd);if(p.fault==='close-reuse'||p.fault==='same-inode-close'){p.foreign=actualSpawn_openSync(p.fault==='same-inode-close'?path.join(rootPaths().root,'direct-spawner-rebind-v1/spawn-dispatch.json'):'/dev/null',constants.O_RDONLY);if(p.foreign!==fd)throw Error('fixture FD was not reused');}}throw Error('DIRECT_SPAWN_CLOSE_FAULT');}actualSpawn_closeSync(fd);p?.owned.delete(fd);}
function writeFileSync(fd,bytes,...rest){const p=globalThis.__directSpawnProbeV1;if(p&&fd===p.writer&&!p.fired&&p.fault==='short-write'){p.fired=true;return actualSpawn_writeFileSync(fd,bytes.subarray(0,1),...rest)}return actualSpawn_writeFileSync(fd,bytes,...rest);}
function fsyncSync(fd){const p=globalThis.__directSpawnProbeV1;if(p&&!p.fired&&(fd===p.writer&&p.fault==='file-sync'||p.writer!==undefined&&fstatSync(fd).isDirectory()&&p.fault==='parent-sync')){p.fired=true;throw Error('DIRECT_SPAWN_SYNC_FAULT')}return actualSpawn_fsyncSync(fd);}
`;
        }
        if (spawnFault?.startsWith("child-main")) {
          for (const [marker, hook] of [
            ["      const own = boundedPsProcessIdentity(process.pid), owner = observeColdProcessParentGroupV1(process.pid);", "globalThis.__directClaimFaultV1?.('precreate');"],
            ["      const assertPublishing = () => {\n        assertOwner();", "globalThis.__directClaimFaultV1?.('publishing',writer.descriptor);"],
            ["    const publishClaim = async () => {\n      assertStable();\n      if (claimStarted) fail(\"direct child claim was already attempted\");\n      claimStarted = true;", "await globalThis.__directClaimPauseV1?.();"],
          ]) { assert.equal(helperSource.split(marker!).length - 1, 1); helperSource = helperSource.replace(marker!, marker! + hook); }
          writeFileSync(path.join(fixture, "foreign-direct-claim"), "", { mode: 0o600 });
        }
        compile("internal-production/baseline-restart-authority-retirement-v1.ts", helperSource + "\nexport async function acquireDirectHelperFixtureV1(){return await acquireDirectSpawnerHelperContextV1()}\nexport function publishDirectSpawnFixtureV1(){return publishDirectSpawnerHelperSpawnDispatchV1()}\nexport function takeDirectChildFixtureV1(){return takeDirectSpawnerChildLaunchDescriptorsV1()}\nexport async function admitDirectChildFixtureV1(){return await acquireDirectSpawnerChildStartupContextV1()}\nexport function drainDirectSpawnFixtureV1(){for(const close of pendingColdHelperAuthenticationCleanupV1)close();return pendingColdHelperAuthenticationCleanupV1.size}\n");
        for (const relative of ["internal-production/baseline-spawner-launch-environment-v1.ts", "findings/legacy-finding-publication-inventory-v1.ts", "runtime-config.ts"]) compileStatic(relative);
        for (const relative of ["baseline-post-handoff-receipt-v1.ts", "baseline-spawner-startup-admission-v1.ts"]) {
          let source = readFileSync(path.join(internal, relative), "utf8");
          if (relative === "baseline-post-handoff-receipt-v1.ts") {
            const marker = "export async function observeInternalProductionSpawnerLaunchProfileCandidateV1(){";
            assert.equal(source.split(marker).length - 1, 1);
            source = source.replace(marker, `${marker}await globalThis.__directHelperPendingEvidenceHook?.();`);
          }
          compile(`internal-production/${relative}`, source);
        }
        symlinkSync(path.resolve(import.meta.dirname, "../../node_modules"), path.join(repository, "node_modules"), "dir");
        const recordPath = path.join(fixture, "direct-helper-fixture-records.json");
        writeFileSync(recordPath, JSON.stringify(records), { mode: 0o600 });
        if (spawnFault?.startsWith("child-")) writeFileSync(path.join(repository, "dist/direct-child-probe.js"), `
import assert from'node:assert/strict';import{readFileSync,fstatSync,existsSync,renameSync,writeFileSync}from'node:fs';
assert.equal(process.env.PRIVATE_VALUE,undefined);assert.equal(process.env.SETFARM_PG_URL,undefined);
globalThis.__directRebindInputFixtureV1={records:JSON.parse(readFileSync(${JSON.stringify(recordPath)},'utf8')),calls:[]};
const{resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1,resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1,admitDirectChildFixtureV1}=await import('./internal-production/baseline-restart-authority-retirement-v1.js');
const fault=${JSON.stringify(spawnFault)},state=globalThis.__directRebindInputFixtureV1;
if(fault==='child-early-ordinary'){await assert.rejects(admitDirectChildFixtureV1());process.argv[1]='ordinary-after-refused-direct-admission.mjs';assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),undefined,'failed direct admission must not become ordinary config');assert.equal(process.env.PRIVATE_VALUE,undefined);process.stdout.write('child-refused');}else{
const{loadRuntimeEnv,runtimeConfig}=await import('./runtime-config.js');loadRuntimeEnv();assert.equal(runtimeConfig.setfarmPgUrl,'postgresql://fixture@127.0.0.1:1/disposable');
assert.equal(resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1().role,'direct-child');assert.equal(process.env.PRIVATE_VALUE,'direct-fixture-secret');assert.equal(globalThis.__directRebindInputFixtureV1.calls.length,0,'configuration cannot silently substitute async receipt/P3 authority');
assert.throws(()=>resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1(),undefined,'direct configuration is never cold authority');
if(fault==='child-p3')state.records.preMutation.spawner.processOwnerCount=2;
if(fault==='child-token'){state.records.startup.startupTokenHash='f'.repeat(64);state.records.startup.startupTokenRef='setfarm://internal-production/pre-schema-spawner-startup-token/sha256/'+state.records.startup.startupTokenHash;}
if(fault==='child-late-intent'){let fired=false;state.hook=key=>{if(key==='operation'&&!fired){fired=true;const target=${JSON.stringify(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json"))},bytes=readFileSync(target);renameSync(target,target+'.original');writeFileSync(target,bytes,{mode:0o600,flag:'wx'});state.hookFired=true;}};}
if(fault==='child-concurrent'||fault==='child-revoked-await')globalThis.__directHelperPendingEvidenceHook=async()=>{state.hookFired=true;globalThis.__directHelperPendingEvidenceHook=undefined;if(fault==='child-concurrent')await assert.rejects(admitDirectChildFixtureV1());else{const entry=process.argv[1];process.argv[1]='ordinary-during-direct-child-admission.mjs';assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());process.argv[1]=entry;}};
if(fault==='child-none'){const context=await admitDirectChildFixtureV1();assert.equal(context.schema,'setfarm.internal-production-direct-child-startup-context.v1');assert.ok(state.calls.includes('preMutation'));context.close();assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());await assert.rejects(admitDirectChildFixtureV1());process.stdout.write('child-admitted');}
else{await assert.rejects(admitDirectChildFixtureV1());if(['child-late-intent','child-concurrent','child-revoked-await'].includes(fault))assert.equal(state.hookFired,true);await assert.rejects(admitDirectChildFixtureV1());assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());process.stdout.write('child-refused');}
}
assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);assert.equal(existsSync(${JSON.stringify(path.join(fixture, ".openclaw/setfarm/spawner.lock"))}),false);assert.equal(existsSync(${JSON.stringify(path.join(fixture, ".openclaw/setfarm/spawner.pid"))}),false);assert.equal(existsSync(${JSON.stringify(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1/claim.json"))}),false);
`, { mode: 0o600 });
        if (spawnFault?.startsWith("child-main")) {
          const spawnerSource = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
          const tree = typescript.createSourceFile("spawner.ts", spawnerSource, typescript.ScriptTarget.Latest, true);
          const names = new Set(["observeSpawnerStartupFileParentsV1", "assertSpawnerStartupFileParentsV1", "createOwnedSpawnerStartupFileV1", "closeOwnedSpawnerStartupFileV1", "publishSpawnerPidFileV1", "reclaimDeadSpawnerStartupFileV1", "acquireSpawnerSingletonLock", "releaseSpawnerSingletonLock", "observeOwnedSpawnerStartupFileV1", "observeInternalProductionColdSpawnerSingletonOwnershipV1", "observeInternalProductionColdSpawnerStartupOwnershipV1", "runInternalProductionColdSpawnerStartupV1", "observeInternalProductionDirectSpawnerStartupOwnershipV1", "runInternalProductionDirectSpawnerStartupV1", "main"]);
          const declarations = tree.statements.filter(statement => typescript.isFunctionDeclaration(statement) && statement.name && names.has(statement.name.text));
          const variables = tree.statements.filter(statement => typescript.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => typescript.isIdentifier(declaration.name) && /^spawner(?:LockFd|StartupFilesV1|ColdStartup|DirectStartup)/.test(declaration.name.text)));
          const retirementImport = tree.statements.find(statement => typescript.isImportDeclaration(statement) && typescript.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "./internal-production/baseline-restart-authority-retirement-v1.js");
          assert.ok(retirementImport);
          const runtime = path.join(home, ".openclaw/setfarm"); mkdirSync(runtime, { recursive: true, mode: 0o700 });
          let mainSource = `
import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';
${retirementImport.getText(tree)}
globalThis.__directRebindInputFixtureV1={records:JSON.parse(fs.readFileSync(${JSON.stringify(recordPath)},'utf8')),calls:[]};
assert.equal(process.env.PRIVATE_VALUE,undefined);const{runtimeConfig}=await import('./runtime-config.js');assert.equal(runtimeConfig.setfarmPgUrl,'postgresql://fixture@127.0.0.1:1/disposable');
const PID_FILE=${JSON.stringify(path.join(runtime, "spawner.pid"))},LOCK_FILE=${JSON.stringify(path.join(runtime, "spawner.lock"))};
const fault=${JSON.stringify(spawnFault)},probe={fired:false,foreign:null};
if(${JSON.stringify(actualDirectHelper)}){const observed=spawnSync('/bin/ps',['-p',String(process.pid),'-o','pid=,uid=,pgid=,lstart=,stat=,ucomm=,command='],{encoding:'utf8',timeout:2000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}});assert.equal(observed.status,0);assert.equal(observed.stderr,'');fs.writeFileSync(${JSON.stringify(directChildCleanupPath)},observed.stdout,{mode:0o600,flag:'wx'});}
globalThis.__directClaimFaultV1=(stage,fd)=>{if(probe.fired)return;if(fault==='child-main-root'&&stage==='precreate'){probe.fired=true;const target=${JSON.stringify(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1/foreign.tmp"))};fs.writeFileSync(target,'foreign',{mode:0o600,flag:'wx'});fs.unlinkSync(target);}if(fault==='child-main-writer'&&stage==='publishing'){probe.fired=true;fs.closeSync(fd);probe.foreign=fs.openSync(${JSON.stringify(path.join(fixture, "foreign-direct-claim"))},'r+');assert.equal(probe.foreign,fd)}};
if(fault==='child-main-readiness'){fs.closeSync(6);assert.equal(fs.openSync('/dev/null','r'),6);}
if(fault==='child-main-p3'){globalThis.__directRebindInputFixtureV1.records.preMutation.spawner.processOwnerCount=2;probe.fired=true;}
if(fault==='child-main-stop-admission')globalThis.__directHelperPendingEvidenceHook=async()=>{probe.fired=true;process.kill(process.pid,'SIGTERM');await new Promise(resolve=>setImmediate(resolve))};
if(fault==='child-main-stop-claim')globalThis.__directClaimPauseV1=async()=>{probe.fired=true;process.kill(process.pid,'SIGTERM');await new Promise(resolve=>setImmediate(resolve))};
if(fault==='child-main-foreign-pid'){probe.foreignPidBytes=String(globalThis.__directRebindInputFixtureV1.records.preMutation.spawner.pid);fs.writeFileSync(PID_FILE,probe.foreignPidBytes,{mode:0o644,flag:'wx'});probe.fired=true;probe.foreignPid=String(fs.lstatSync(PID_FILE,{bigint:true}).ino);}
const forbiddenCalls={admission:0,provider:0,database:0};
async function resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1(){forbiddenCalls.admission++;throw Error('direct child reached ordinary admission')}
function initializeAgentRuntimeV1(){forbiddenCalls.provider++;throw Error('direct child reached provider discovery')}
async function pgMigrate(){forbiddenCalls.database++;throw Error('direct child reached database initialization')}
${[...variables,...declarations].map(statement=>statement.getText(tree)).join("\n")}
export async function runDirectMainFixtureV1(){try{if(${JSON.stringify(positiveDirectMain)})await main();else{await assert.rejects(main());assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),undefined,'failed main must revoke original configuration');if(fault==='child-main-foreign-pid'){assert.equal(fs.readFileSync(PID_FILE,'utf8'),probe.foreignPidBytes);assert.equal(String(fs.lstatSync(PID_FILE,{bigint:true}).ino),probe.foreignPid);}else assert.equal(fs.existsSync(PID_FILE),false);assert.equal(fs.existsSync(LOCK_FILE),false);if(fault==='child-main-readiness')assert.equal(fs.fstatSync(6).isCharacterDevice(),true);else assert.equal(probe.fired,true);if(probe.foreign!==null){assert.equal(fs.readFileSync(${JSON.stringify(path.join(fixture, "foreign-direct-claim"))}).length,0,'claim bytes must not reach a foreign descriptor');assert.equal(fs.fstatSync(probe.foreign).nlink,1);fs.closeSync(probe.foreign);}}}finally{assert.deepEqual(forbiddenCalls,{admission:0,provider:0,database:0},'direct main must never enter ordinary effects');assert.equal(fs.fstatSync(4).nlink,1);assert.equal(fs.fstatSync(5).nlink,1)}}
`;
          if (spawnFault === "child-main-concurrent") {
            const marker = "    const claim = await context.publishClaim();"; assert.equal(mainSource.split(marker).length - 1, 1);
            mainSource = mainSource.replace(marker, "    const claim = await (async()=>{probe.fired=true;const attempts=await Promise.allSettled([context.publishClaim(),context.publishClaim()]);assert.ok(attempts.every(value=>value.status==='rejected'));throw Error('concurrent direct claims refused')})();");
          }
          if (actualDirectHelper && ["fragmented", "empty", "truncated", "oversize", "duplicate", "extra-key", "noncanonical", "cold-schema", "crossed-hash"].includes(directHelperFault)) {
            const marker = '    if (fs.writeSync(6, ready) !== ready.length) throw Error("SPAWNER_DIRECT_READINESS_WRITE_INCOMPLETE");';
            assert.equal(mainSource.split(marker).length - 1, 1);
            const output: Record<string, string> = {
              empty: "Buffer.alloc(0)", truncated: "ready.subarray(0,ready.length-2)", oversize: "Buffer.alloc(4097,120)", duplicate: "Buffer.concat([ready,ready])",
              "extra-key": "Buffer.from(JSON.stringify({...JSON.parse(ready.toString()),foreign:true})+'\\n')", noncanonical: "Buffer.from(JSON.stringify(JSON.parse(ready.toString()),null,2)+'\\n')",
              "cold-schema": "Buffer.from(ready.toString().replace('direct-spawner-readiness','cold-spawner-readiness'))", "crossed-hash": "Buffer.from(ready.toString().replace(JSON.parse(ready.toString()).claimHash,'0'.repeat(64)))",
            };
            mainSource = mainSource.replace(marker, directHelperFault === "fragmented"
              ? "    for(let offset=0;offset<ready.length;offset+=37)fs.writeSync(6,ready.subarray(offset,offset+37));"
              : `    fs.writeSync(6,${output[directHelperFault]});`);
          }
          if (actualDirectHelper && ["no-eof", "child-exit"].includes(directHelperFault)) {
            const start = mainSource.indexOf("async function runInternalProductionDirectSpawnerStartupV1"), marker = "    closeReadiness();\n    await stopped;";
            assert.ok(start > 0); const tail = mainSource.slice(start); assert.equal(tail.split(marker).length - 1, 1);
            mainSource = mainSource.slice(0, start) + tail.replace(marker, directHelperFault === "no-eof" ? "    await stopped;" : "    process.exit(0);\n    await stopped;");
          }
          writeFileSync(path.join(repository, "dist/direct-child-probe.js"), typescript.transpileModule(mainSource, { compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ES2022 } }).outputText, { mode: 0o600 });
        }
        const runner = path.join(repository, "dist/internal-production/baseline-service-restart-helper-v1.js");
        writeFileSync(runner, `import assert from'node:assert/strict';import{spawnSync,spawn}from'node:child_process';import{readFileSync,writeFileSync,renameSync,chmodSync,lstatSync,fstatSync,openSync,closeSync,unlinkSync}from'node:fs';
import{acquireDirectHelperFixtureV1,publishDirectSpawnFixtureV1,takeDirectChildFixtureV1,drainDirectSpawnFixtureV1,resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1,resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1}from'./baseline-restart-authority-retirement-v1.js';
const fault=process.env.FIXTURE_DIRECT_HELPER_FAULT??'none';let context;
globalThis.__directRebindInputFixtureV1={records:JSON.parse(readFileSync(${JSON.stringify(recordPath)},'utf8')),calls:[]};
try{
if(fault==='early-configuration')assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());
if(fault==='parent-uid'){globalThis.__directHelperParentUidFault=true;await assert.rejects(acquireDirectHelperFixtureV1(),undefined,'actual parent UID must match the authenticated controller');throw Error('expected fixture refusal');}
if(fault==='pending-ordinary'||fault==='pending-spawner'){let refused=false;globalThis.__directHelperPendingEvidenceHook=async()=>{process.argv[1]=fault==='pending-spawner'?${JSON.stringify(path.join(repository, "dist/spawner.js"))}:'ordinary-during-direct-auth.mjs';closeSync(3);delete process.env.SETFARM_INTERNAL_PRODUCTION_DIRECT_HELPER;process.env.SETFARM_ENV_DIR=${JSON.stringify(fixture)};await assert.rejects(import('../runtime-config.js'),/CONFIGURATION_INVALID/);assert.equal(process.env.PENDING_DOTENV,undefined);refused=true;};await assert.rejects(acquireDirectHelperFixtureV1());assert.equal(refused,true,'active direct acquisition must forbid ordinary configuration before its context exists');throw Error('expected fixture refusal');}
if(fault==='revoked-during-evidence'){let fired=false;globalThis.__directRebindInputFixtureV1.hook=key=>{if(key==='profile'&&!fired){fired=true;assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());}};await assert.rejects(acquireDirectHelperFixtureV1(),undefined,'an in-flight acquisition must not succeed after permanent revocation');assert.equal(fired,true);throw Error('expected fixture refusal');}
if(fault==='late-dispatch-swap'){let fired=false;globalThis.__directRebindInputFixtureV1.hook=key=>{if(key==='profile'&&!fired){fired=true;const target=${JSON.stringify(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1/termination-dispatch.json"))},bytes=readFileSync(target);renameSync(target,${JSON.stringify(path.join(fixture, "original-direct-helper-dispatch"))});writeFileSync(target,bytes,{mode:0o600,flag:'wx'});}};await assert.rejects(acquireDirectHelperFixtureV1(),undefined,'awaited evidence cannot replace the original dispatch inode');assert.equal(fired,true);throw Error('expected fixture refusal');}
context=await acquireDirectHelperFixtureV1();
if(fault==='entry-before-selection'){const entry=process.argv[1];process.argv[1]=${JSON.stringify(path.join(repository, "dist/spawner.js"))};closeSync(3);assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());process.argv[1]=entry;throw Error('expected fixture refusal');}
const snapshot=resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1();assert.equal(snapshot.role,'direct-helper');assert.deepEqual(Object.keys(snapshot),['schema','role']);assert.equal(snapshot.environment.PRIVATE_VALUE,'direct-fixture-secret');assert.throws(()=>resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1());
if(fault==='late-output'){const target=${JSON.stringify(entry)},bytes=readFileSync(target);try{writeFileSync(target,Buffer.concat([bytes,Buffer.from('// late mutation')]));assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),undefined,'late actual output mutation must revoke cached helper auth');}finally{writeFileSync(target,bytes)}assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());throw Error('expected fixture refusal');}
if(fault==='late-host'){const target=${JSON.stringify(environmentDirectory)},mode=lstatSync(target).mode&0o7777;try{chmodSync(target,mode^0o010);assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),undefined,'late physical host identity change must revoke cached helper auth');}finally{chmodSync(target,mode)}assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());throw Error('expected fixture refusal');}
if(fault==='late-entry'){const entry=process.argv[1];process.argv[1]=entry+'.foreign';assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());process.argv[1]=entry;assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());throw Error('expected fixture refusal');}
if(fault==='late-frame'){const original=openSync('/dev/fd/3','r');closeSync(3);assert.equal(openSync('/dev/null','r'),3);assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());closeSync(3);assert.equal(openSync('/dev/fd/'+original,'r'),3);closeSync(original);assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());throw Error('expected fixture refusal');}
const{loadRuntimeEnv}=await import('../runtime-config.js');loadRuntimeEnv();assert.equal(process.env.PRIVATE_VALUE,'direct-fixture-secret');assert.equal(process.env.SETFARM_INTERNAL_PRODUCTION_DIRECT_HELPER,'1');assert.equal(process.env.SETFARM_INTERNAL_PRODUCTION_COLD_HELPER,undefined);
if(${JSON.stringify(spawnFault !== undefined)}){
 const sf=${JSON.stringify(spawnFault)},root=${JSON.stringify(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1"))},foreign=${JSON.stringify(path.join(fixture, "foreign-empty"))};
 const probe=globalThis.__directSpawnProbeV1={fault:sf,owned:new Set(),fired:false,boundary(stage,fd){if(stage==='unlinked'&&['secret-fd-reuse','secret-reader-reuse'].includes(sf)){this.fired=true;const original=sf==='secret-reader-reuse'?this.frameReader:fd;closeSync(original);this.owned.delete(original);writeFileSync(foreign,'',{mode:0o600,flag:'wx'});this.foreign=openSync(foreign,sf==='secret-reader-reuse'?'r':'w');assert.equal(this.foreign,original);}if(stage==='final'&&['root-churn','foreign-scratch'].includes(sf)){this.fired=true;writeFileSync(root+'/foreign.tmp','foreign',{mode:0o600,flag:'wx'});if(sf==='root-churn')unlinkSync(root+'/foreign.tmp');}}};
 if(!['none','second-publish','dispatch-swap','termination-swap','late-output'].includes(sf)&&!sf.startsWith('child-')){
  assert.throws(()=>publishDirectSpawnFixtureV1(),undefined,sf+' publication must refuse');assert.equal(probe.fired,true,sf+' boundary must execute');assert.throws(()=>takeDirectChildFixtureV1());assert.throws(()=>publishDirectSpawnFixtureV1());assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());
  if(probe.foreign!==undefined){if(sf==='secret-fd-reuse'||sf==='secret-reader-reuse'){assert.equal(readFileSync(foreign).length,0,'no secret may reach a reused linked file');assert.equal(fstatSync(probe.foreign).nlink,1);}else assert.doesNotThrow(()=>fstatSync(probe.foreign),'foreign reopened descriptor must survive');if(sf==='same-inode-close')assert.throws(()=>drainDirectSpawnFixtureV1(),/ambiguous/);closeSync(probe.foreign);}
  if(sf==='writer-close'){assert.equal(probe.owned.size,1);assert.throws(()=>drainDirectSpawnFixtureV1(),/ambiguous/);closeSync(probe.writer);probe.owned.delete(probe.writer);}assert.equal(drainDirectSpawnFixtureV1(),0);assert.equal(probe.owned.size,0,'owned publication and guard handles must be closed');context.close();assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);process.stdout.write('dispatch-refused');
 }else{
 const record=publishDirectSpawnFixtureV1();assert.equal(record.schema,'setfarm.internal-production-pre-schema-spawner-direct-spawn-dispatch.v1');assert.equal(record.maximumSpawnDispatchCount,1);assert.equal(record.helper.pid,process.pid);assert.equal(record.helper.ppid,process.ppid);assert.equal(record.controller.pid,process.ppid);assert.deepEqual(record.action,{transport:'direct-detached-node-v1',executable:process.execPath,arguments:[${JSON.stringify(entry)}],cwd:process.cwd(),detached:true});
 if(sf.startsWith('child-main')){
  const handles=takeDirectChildFixtureV1(),child=spawn(process.execPath,[${JSON.stringify(entry)}],{cwd:process.cwd(),detached:true,env:{PATH:'/usr/bin:/bin',HOME:${JSON.stringify(home)},LANG:'C',LC_ALL:'C',SETFARM_INTERNAL_PRODUCTION_DIRECT_CHILD:'1'},stdio:['ignore','ignore','pipe',handles.frameDescriptor,4,handles.dispatchDescriptor,'pipe']});let errors='';child.stderr.on('data',chunk=>{errors+=chunk.toString();assert.ok(errors.length<65536)});child.stderr.pipe(process.stderr,{end:false});
  if(sf==='child-main'){try{await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});const observed=spawnSync('/bin/ps',['-p',String(child.pid),'-o','pid=,uid=,pgid=,lstart=,stat=,ucomm=,command='],{encoding:'utf8',timeout:2000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}});assert.equal(observed.status,0);assert.equal(observed.stderr,'');writeFileSync(${JSON.stringify(directChildCleanupPath)},observed.stdout,{mode:0o600,flag:'wx'});}catch(error){child.kill('SIGTERM');throw error}}
  if(sf!=='child-main'){let unexpectedReady=false;child.stdio[6].on('data',()=>{unexpectedReady=true;child.kill('SIGTERM')});const status=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('negative direct main timeout: '+errors))},12000);child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal})})});assert.deepEqual(status,{code:0,signal:null},errors);assert.equal(unexpectedReady,false,'refused direct main must not signal readiness');context.close();process.stdout.write('dispatch-owned');}else
  try{const ready=await new Promise((resolve,reject)=>{let bytes='';const timer=setTimeout(()=>reject(Error('direct main readiness timeout: '+errors)),12000);child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('exit',()=>{clearTimeout(timer);reject(Error('direct main exited before readiness: '+errors))});child.stdio[6].on('data',chunk=>{bytes+=chunk.toString();if(bytes.length>4096){clearTimeout(timer);reject(Error('readiness exceeds cap'))}});child.stdio[6].once('end',()=>{clearTimeout(timer);try{assert.ok(bytes.endsWith('\\n'));const ready=JSON.parse(bytes);assert.equal(ready.schema,'setfarm.internal-production-direct-spawner-readiness.v1');resolve(ready)}catch(error){reject(error)}})});const claim=JSON.parse(readFileSync(root+'/claim.json','utf8'));assert.equal(claim.claimRef,ready.claimRef);assert.equal(claim.claimHash,ready.claimHash);assert.equal(claim.child.pid,child.pid);assert.equal(claim.maximumClaimCount,1);assert.equal(claim.startupFiles.pid,child.pid);assert.equal(claim.startupFiles.schema,'setfarm.internal-production-direct-spawner-startup-ownership.v1');assert.equal(errors,'');child.stderr.destroy();child.stdio[6].destroy();child.unref();context.close();process.stdout.write('dispatch-owned');}catch(error){child.kill('SIGTERM');throw error}
 }else if(sf.startsWith('child-')){
  const handles=takeDirectChildFixtureV1(),child=spawnSync(process.execPath,[${JSON.stringify(entry)}],{cwd:process.cwd(),detached:true,env:{PATH:'/usr/bin:/bin',HOME:${JSON.stringify(home)},LANG:'C',LC_ALL:'C',SETFARM_INTERNAL_PRODUCTION_DIRECT_CHILD:'1'},stdio:['ignore','pipe','pipe',handles.frameDescriptor,4,handles.dispatchDescriptor],encoding:'utf8',timeout:12000,maxBuffer:65536});assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');assert.equal(child.stdout,sf==='child-none'?'child-admitted':'child-refused');context.close();process.stdout.write('dispatch-owned');
 }else if(sf!=='none'){
  if(sf==='second-publish')assert.throws(()=>publishDirectSpawnFixtureV1());
  if(sf==='dispatch-swap'||sf==='termination-swap'){const target=root+'/'+(sf==='dispatch-swap'?'spawn-dispatch.json':'termination-receipt.json'),bytes=readFileSync(target);renameSync(target,${JSON.stringify(path.join(fixture, "original-spawn-authority"))});writeFileSync(target,bytes,{mode:0o600,flag:'wx'});}
  if(sf==='late-output')writeFileSync(${JSON.stringify(entry)},readFileSync(${JSON.stringify(entry)},'utf8')+'// crossed output');
  assert.throws(()=>takeDirectChildFixtureV1());assert.throws(()=>publishDirectSpawnFixtureV1());assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());assert.equal(probe.owned.size,0);context.close();process.stdout.write('dispatch-refused');
 }else{
 const handles=takeDirectChildFixtureV1(),childFrame=JSON.parse(readFileSync(handles.frameDescriptor,'utf8'));assert.equal(fstatSync(handles.frameDescriptor).nlink,0);assert.equal(fstatSync(handles.dispatchDescriptor).nlink,1);assert.deepEqual(JSON.parse(readFileSync(handles.dispatchDescriptor,'utf8')),record);assert.equal(childFrame.schema,'setfarm.internal-production-pre-schema-spawner-direct-rebind-child-capability.v1');assert.equal(childFrame.dispatchRef,record.dispatchRef);assert.equal(childFrame.dispatchHash,record.dispatchHash);assert.equal(childFrame.environment.PRIVATE_VALUE,'direct-fixture-secret');assert.throws(()=>writeFileSync(handles.frameDescriptor,'x'),/EBADF/);assert.throws(()=>writeFileSync(handles.dispatchDescriptor,'x'),/EBADF/);assert.equal(resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1().role,'direct-helper');assert.throws(()=>takeDirectChildFixtureV1());assert.throws(()=>publishDirectSpawnFixtureV1());assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());context.close();assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);process.stdout.write('dispatch-owned');
 }
 }
}else{
context.close();assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);assert.equal(fault,'none');process.stdout.write('authenticated');
}
}catch(error){if(fault==='none'||error.code==='ERR_ASSERTION')throw error;assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);await assert.rejects(acquireDirectHelperFixtureV1());process.stdout.write('refused');}finally{context?.close()}
`, { mode: 0o600 });
        if (actualDirectHelper) compile("internal-production/baseline-service-restart-helper-v1.ts", `
import*as fixtureFs from'node:fs';
globalThis.__directRebindInputFixtureV1={records:JSON.parse(readFileSync(${JSON.stringify(recordPath)},'utf8')),calls:[]};
const helperFault=${JSON.stringify(directHelperFault)},runtime=${JSON.stringify(path.join(home, ".openclaw/setfarm"))};let ownedOutputChecks=0;
const faultMarker=${JSON.stringify(path.join(fixture, "direct-helper-fault-fired"))};let closeFaultFired=false;
globalThis.__directHelperTimeoutFiredV1=(count)=>fixtureFs.writeFileSync(faultMarker,String(count),{mode:0o600,flag:'wx'});
globalThis.__directHelperCloseFaultV1=fd=>{if(helperFault==='cleanup-close'&&globalThis.__directHelperClaimOwnedV1&&!closeFaultFired&&fixtureFs.fstatSync(fd).isFile()&&fixtureFs.fstatSync(fd).nlink===1){closeFaultFired=true;fixtureFs.writeFileSync(faultMarker,'close',{mode:0o600,flag:'wx'});throw Error('DIRECT_HELPER_CLOSE_FIXTURE');}};
globalThis.__directHelperBeforeClaimV1=(child)=>{const root=${JSON.stringify(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/direct-spawner-rebind-v1"))};if(helperFault==='runtime-parent'){const original=${JSON.stringify(path.join(fixture, "direct-original-runtime"))};fixtureFs.renameSync(runtime,original);fixtureFs.symlinkSync(original,runtime,'dir');}if(helperFault==='journal-aba'){const target=root+'/foreign.tmp';fixtureFs.writeFileSync(target,'foreign',{mode:0o600,flag:'wx'});fixtureFs.unlinkSync(target);}if(helperFault==='claim-replace'||helperFault==='startup-pid'){const target=helperFault==='claim-replace'?root+'/claim.json':runtime+'/spawner.pid',bytes=fixtureFs.readFileSync(target);fixtureFs.renameSync(target,${JSON.stringify(path.join(fixture, "direct-replaced-record"))});fixtureFs.writeFileSync(target,bytes,{mode:0o600,flag:'wx'});}if(helperFault==='child-pid')child.pid++;};
globalThis.__directHelperAfterOutputV1=()=>{if(!globalThis.__directHelperClaimOwnedV1)return;ownedOutputChecks++;if(helperFault==='late-pid'&&ownedOutputChecks===2){const target=runtime+'/spawner.pid',bytes=fixtureFs.readFileSync(target);fixtureFs.renameSync(target,${JSON.stringify(path.join(fixture, "direct-original-pid"))});fixtureFs.writeFileSync(target,bytes,{mode:0o600,flag:'wx'});}if(helperFault==='late-parent'&&ownedOutputChecks===3){const original=${JSON.stringify(path.join(fixture, "direct-original-runtime"))};fixtureFs.renameSync(runtime,original);fixtureFs.symlinkSync(original,runtime,'dir');}};
` + readFileSync(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-service-restart-helper-v1.ts"), "utf8").replace(
          "    const completion = await retirement.runInternalProductionDirectSpawnerHelperV1();",
          "    const completion = await retirement.runInternalProductionDirectSpawnerHelperV1();" + (directHelperFault === "second" ? "await (await import('node:assert/strict')).default.rejects(retirement.runInternalProductionDirectSpawnerHelperV1());" : "")));
        mkdirSync(path.join(home, "Library/LaunchAgents"), { recursive: true, mode: 0o700 });
        mkdirSync(environmentDirectory, { recursive: true, mode: 0o700 });
        const entries: Array<{ locator: string; mode: number; byteLength: number; sha256: string }> = [];
        const visit = (directory: string) => {
          chmodSync(directory, 0o755);
          for (const name of readdirSync(directory).sort()) {
            const target = path.join(directory, name);
            if (lstatSync(target).isDirectory()) visit(target);
            else { const locator = path.relative(repository, target), mode = locator === "dist/cli/cli.js" ? 0o755 : 0o644; chmodSync(target, mode); const bytes = readFileSync(target); entries.push({ locator, mode, byteLength: bytes.length, sha256: sha256(bytes) }); }
          }
        };
        visit(path.join(repository, "dist")); entries.sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
        const body = { schema: "setfarm.platform-build-output-tree.v1", sourceSha: directProfile.source.sha, sourceTreeHash: directProfile.source.treeHash, entries };
        const artifacts = [Buffer.from('{"fixture":"build-info"}\n'), Buffer.from(`${JSON.stringify({ ...body, outputTreeHash: sha256(canonical(body)) })}\n`), Buffer.from('{"fixture":"release-manifest"}\n')];
        for (const [index, name] of ["BUILD_INFO.json", "PLATFORM_BUILD_OUTPUT_TREE.json", "PLATFORM_RELEASE_MANIFEST.json"].entries()) writeFileSync(path.join(repository, "dist", name), artifacts[index]!, { mode: 0o444 });
        const identity = (target: string) => { const stats = lstatSync(target, { bigint: true }); return { devDecimal: String(stats.dev), inoDecimal: String(stats.ino), uid: Number(stats.uid), gid: Number(stats.gid), mode: Number(stats.mode & 0o7777n) }; };
        const directories = new Set<string>();
        for (const initial of [home, fixture, repository, environmentDirectory, path.join(repository, "dist"), path.join(home, "Library/LaunchAgents"), path.dirname(process.execPath)]) {
          for (let target = initial; ; target = path.dirname(target)) { directories.add(target); if (path.dirname(target) === target) break; }
        }
        Object.assign(directProfile, { rootIdentity: identity(repository), hostDirectories: [...directories].map(target => ({ path: target, ...identity(target) })),
          executable: { path: process.execPath, ...identity(process.execPath), bytesHash: sha256(readFileSync(process.execPath)) },
          buildInfoBytesHash: sha256(artifacts[0]!), outputTreeBytesHash: sha256(artifacts[1]!), releaseManifestBytesHash: sha256(artifacts[2]!) });
        rehash(directProfile); restart.launchProfileHash = directProfile.profileHash;
        return { runner, recordPath };
      }
      if (mode === "direct-helper") {
        const { runner, recordPath } = helperCompiled!;
        if (actualDirectController) {
          const output = await import(pathToFileURL(path.join(repository, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
          let outputChecks = 0;
          const spawnProbe = { calls: [] as Array<{ executable: string; args: string[]; options: any }>, fault: directControllerFault };
          Reflect.set(globalThis, "__directControllerSpawnFixtureV1", spawnProbe);
          Reflect.set(globalThis, "__directControllerOutputFixtureV1", (input: unknown) => {
            const result = output.verifyInternalProductionSpawnerLaunchOutputCandidateV1(input);
            if (++outputChecks === 2 && directControllerFault === "journal-aba") {
              const foreign = path.join(privateRoot, "controller-foreign.tmp");
              writeFileSync(foreign, "foreign", { mode: 0o600, flag: "wx" }); unlinkSync(foreign);
            }
            if (outputChecks === 2 && directControllerFault === "intent-replace") {
              const target = path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json"), bytes = readFileSync(target);
              renameSync(target, path.join(fixture, "controller-original-intent")); writeFileSync(target, bytes, { mode: 0o600, flag: "wx" });
            }
            if (outputChecks === 4 && directControllerFault === "observe-late-pid") {
              const target = path.join(home, ".openclaw/setfarm/spawner.pid"), bytes = readFileSync(target);
              renameSync(target, path.join(fixture, "controller-original-late-pid")); writeFileSync(target, bytes, { mode: 0o600, flag: "wx" });
            }
            if (outputChecks === 4 && directControllerFault === "observe-late-parent") {
              const target = path.join(home, ".openclaw/setfarm"), original = path.join(fixture, "controller-original-late-runtime");
              renameSync(target, original); symlinkSync(original, target, "dir");
            }
            return result;
          });
          writeFileSync(recordPath, JSON.stringify(records), { mode: 0o600 });
          const initial = runtime.invokeDirectControllerFixtureV1(lease, input, true);
          void initial.catch(() => {});
          await assert.rejects(runtime.invokeDirectControllerFixtureV1(lease, input), /already active/);
          if (directControllerFault && !directControllerFault.startsWith("observe") && !directControllerFault.startsWith("settle")) {
            const entered = ["spawn-error", "helper-failure"].includes(directControllerFault);
            const expected = entered ? /direct helper completion|direct helper exit/ : /helper outcome is uncertain/;
            await assert.rejects(initial, expected);
            const original = runtime.inspectDirectControllerFixtureV1();
            await assert.rejects(runtime.invokeDirectControllerFixtureV1(lease, input), expected);
            assert.deepEqual(runtime.inspectDirectControllerFixtureV1(), original, "failed transport retains its original attempted helper outcome");
            assert.equal(outputChecks, 2, "mutation reaches the final pre-spawn output boundary");
            assert.equal(spawnProbe.calls.length, entered ? 1 : 0, "neither crossed authority nor a failed transport grants a new helper attempt");
            if (!entered) assert.equal(original.pid, undefined, "crossed original authority cannot dispatch even the fixed helper");
            assert.equal(readFileSync(directSpawnTracePath, "utf8").trim().split("\n").filter(Boolean).length, directControllerFault === "helper-failure" ? 1 : 0);
            assert.equal(signalProbe.calls.length, 1);
            await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
            return;
          }
          await assert.rejects(initial, /DIRECT_CONTROLLER_RESPONSE_LOST/);
          const originalInvocation = runtime.inspectDirectControllerFixtureV1();
          const completion = await runtime.invokeDirectControllerFixtureV1(lease, input);
          assert.deepEqual(runtime.inspectDirectControllerFixtureV1(), originalInvocation, "response-loss resume retains the original actual helper PID/outcome");
          assert.deepEqual(await runtime.invokeDirectControllerFixtureV1(lease, input), completion);
          assert.deepEqual(runtime.inspectDirectControllerFixtureV1(), originalInvocation, "repeated completion cannot replace the original helper process");
          assert.equal(spawnProbe.calls.length, 1, "controller owns exactly one helper spawn, independently of child dispatch count");
          assert.equal(spawnProbe.calls[0]!.executable, process.execPath);
          assert.deepEqual(spawnProbe.calls[0]!.args, [runner]);
          const options = spawnProbe.calls[0]!.options;
          assert.equal(options.cwd, repository); assert.equal(options.shell, false);
          assert.deepEqual(options.env, { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", SETFARM_INTERNAL_PRODUCTION_DIRECT_HELPER: "1" });
          assert.deepEqual(options.stdio.slice(0, 3), ["ignore", "pipe", "ignore"]);
          assert.equal(options.stdio[4], runtime.directBorrowedLeaseDescriptorFixtureV1());
          assert.equal(options.stdio.length, 6);
          const invocation = runtime.inspectDirectControllerFixtureV1();
          assert.equal(invocation.phase, "helper-may-have-run", "wire completion is not independent claim/settlement authority");
          assert.ok(Number.isSafeInteger(invocation.pid)); assert.equal(invocation.exitCode, 0); assert.equal(invocation.signalCode, null);
          const dispatch = JSON.parse(readFileSync(path.join(privateRoot, "spawn-dispatch.json"), "utf8"));
          const claim = JSON.parse(readFileSync(path.join(privateRoot, "claim.json"), "utf8"));
          assert.equal(dispatch.helper.pid, invocation.pid); assert.equal(completion.dispatchHash, dispatch.dispatchHash); assert.equal(completion.claimHash, claim.claimHash);
          assert.equal(readFileSync(directSpawnTracePath, "utf8").trim().split("\n").length, 1, "response loss retains the sole real helper/child dispatch");
          assert.equal(signalProbe.calls.length, 1);
          assert.equal(fstatSync(runtime.directBorrowedLeaseDescriptorFixtureV1()).nlink, 1);
          if (directControllerFault.startsWith("settle")) {
            const actualChild = observeColdFixtureExitV1(claim.child.pid)!;
            assert.equal(actualChild.command, claim.child.command);
            assert.equal(Date.parse(actualChild.lstart), claim.child.processStartTimeEpochMs);
            const label = "com.setrox.setfarm-spawner", source = directProfile.source;
            const serviceIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-service-identity.v1", label, command: actualChild.command }));
            const body = { schema: "setfarm.internal-production-service-census.v1", ...(coldGenesisObservationFixture(fixture).remainingServices as object), spawner: {
              pid: claim.child.pid, processStartTimeEpochMs: Date.parse(actualChild.lstart), processIdentityHash: sha256(`${claim.child.pid}\n${actualChild.lstart}\n`), serviceIdentityHash,
              generationHash: sha256(canonical({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash, source: { sha: source.sha, treeHash: source.treeHash, buildHash: source.buildHash } })),
              loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: 1, listener: null,
            } };
            const inputs = Reflect.get(globalThis, "__directRebindInputFixtureV1");
            inputs.records.census = { ...body, censusHash: sha256(canonical(body)) };
            let censusCalls = 0;
            inputs.hook = (key: string) => { if (key === "census") censusCalls++; };
            const before = coldGenesisTreeSnapshotV1(privateRoot);
            const historyRequested = directControllerFault.startsWith("settle-history");
            const releaseRequested = directControllerFault.startsWith("settle-release");
            const cleanupRequested = directControllerFault.startsWith("settle-cleanup");
            const fault = historyRequested || releaseRequested || cleanupRequested ? "" : directControllerFault.slice("settle".length).replace(/^-/, "");
            if (cleanupRequested) {
              for (const unrelated of [false, true]) await assert.rejects(runtime.assertDirectCleanupFixtureV1(unrelated), /DIRECT_REBIND_UNSETTLED|HELPER_DISPATCH_SETTLEMENT_UNKNOWN/, "incomplete direct history fences every lock relation");
            }
            const probe = { fault, fired: false, calls: [] as string[], foreign: undefined as number | undefined, foreignIdentity: undefined as ReturnType<typeof fstatSync> | undefined };
            Reflect.set(globalThis, "__directSettlementPublicationV1", probe);
            const originalCensus = structuredClone(inputs.records.census);
            inputs.hook = (key: string) => {
              if (key !== "census") return;
              censusCalls++; inputs.records.census = structuredClone(originalCensus);
              if (fault === "census-first" && censusCalls === 1 || fault === "census-second" && censusCalls === 2) {
                probe.fired = true; inputs.records.census.dashboard.pid++;
                delete inputs.records.census.censusHash; inputs.records.census.censusHash = sha256(canonical(inputs.records.census));
              }
            };
            if (fault) {
              await assert.rejects(runtime.settleDirectControllerFixtureV1(lease, input), /DIRECT_SETTLEMENT_BOUNDARY|direct settlement/);
              assert.equal(probe.fired, true, "fault reaches its actual observation/publication boundary");
              assert.notEqual(runtime.inspectDirectControllerFixtureV1().phase, "settled");
              if (fault.startsWith("census-")) assert.equal(runtime.inspectDirectSettlementFixtureV1(), null, "crossed census cannot start settlement publication");
              if (["writer-replace", "reader-replace", "late-sibling", "partial-write", "write-before", "close-before"].includes(fault)) {
                await assert.rejects(runtime.settleDirectControllerFixtureV1(lease, input), /direct settlement|private frame|cold publication candidate/);
                assert.notEqual(runtime.inspectDirectControllerFixtureV1().phase, "settled");
                if (fault === "writer-replace") assert.equal(fstatSync(probe.foreign!).ino.toString(), probe.foreignIdentity!.ino.toString(), "refused publication cannot close the foreign FD");
                if (fault === "reader-replace") {
                  const reader = Reflect.get(probe, "ownedReader");
                  assert.ok(Number.isSafeInteger(reader));
                  assert.doesNotThrow(() => runtime.drainDirectSettlementReaderFixtureV1(), "publisher must retain cleanup ownership of the reader it actually opened");
                  assert.throws(() => fstatSync(reader), (error: unknown) => error instanceof Error && "code" in error && error.code === "EBADF");
                }
                if (fault === "close-before") closeSync(runtime.inspectDirectSettlementFixtureV1().writer); // The fixture knows its injected failure preceded actual close.
                assert.deepEqual(coldGenesisTreeSnapshotV1(privateRoot), before);
                assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
                return;
              }
            }
            const priorCensusCalls = censusCalls;
            let settlementAttempt: Promise<any>;
            if (!fault) {
              let entered!: () => void, release!: () => void, gated = false;
              const reached = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
              Reflect.set(globalThis, "__directControllerCensusGateV1", () => { if (!gated) { gated = true; entered(); return gate; } });
              settlementAttempt = runtime.settleDirectControllerFixtureV1(lease, input); void settlementAttempt.catch(() => {});
              await reached;
              try {
                await assert.rejects(runtime.settleDirectControllerFixtureV1(lease, input), /already active/);
                await assert.rejects(runtime.observeDirectControllerFixtureV1(lease, input), /already active/);
              } finally { release(); Reflect.deleteProperty(globalThis, "__directControllerCensusGateV1"); await settlementAttempt; }
            } else settlementAttempt = runtime.settleDirectControllerFixtureV1(lease, input);
            const settled = await settlementAttempt;
            assert.equal(censusCalls, priorCensusCalls + 2, "every settlement attempt requires two independent ordinary observations");
            assert.equal(settled.schema, "setfarm.internal-production-direct-spawner-controller-settlement.v1");
            assert.deepEqual(settled.serviceCensus, inputs.records.census);
            assert.deepEqual(settled.completion, completion);
            assert.equal(settled.terminationDispatch.dispatchHash, JSON.parse(readFileSync(path.join(privateRoot, "termination-dispatch.json"), "utf8")).dispatchHash);
            const target = path.join(path.dirname(privateRoot), "pre-schema-helper-settlements/sha256", settled.helperSettlementHash.slice(0, 2), `${settled.helperSettlementHash}.json`);
            assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), settled, "durable settlement must be JSON, not a serializer's undefined projection");
            assert.match(settled.terminationReceipt.receiptHash, /^[a-f0-9]{64}$/);
            assert.equal(settled.terminationReceipt.receiptHash, JSON.parse(readFileSync(path.join(privateRoot, "termination-receipt.json"), "utf8")).terminationReceiptHash);
            assert.equal(settled.terminationReceipt.receiptRef, JSON.parse(readFileSync(path.join(privateRoot, "termination-receipt.json"), "utf8")).terminationReceiptRef);
            const { helperSettlementRef, helperSettlementHash, ...settlementBody } = settled;
            assert.equal(helperSettlementHash, sha256(canonical(settlementBody)));
            assert.equal(helperSettlementRef, `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`);
            assert.equal(settled.terminationDispatchCount, 1); assert.equal(settled.spawnDispatchCount, 1); assert.equal(settled.serviceObservationCount, 2);
            assert.notEqual(settled.serviceCensus.spawner.processIdentityHash, claim.child.processIdentityHash, "ordinary service observation cannot copy the transition-lock-domain child hash");
            assert.equal(readFileSync(target, "utf8"), `${canonical(settled)}\n`);
            assert.equal(lstatSync(target).nlink, 1);
            assert.deepEqual(readdirSync(path.dirname(target)), [`${settled.helperSettlementHash}.json`]);
            assert.deepEqual(coldGenesisTreeSnapshotV1(privateRoot), before, "controller settlement cannot mutate the child's four-member journal");
            assert.equal(runtime.inspectDirectControllerFixtureV1().phase, "settled");
            assert.deepEqual(await runtime.settleDirectControllerFixtureV1(lease, input), settled);
            assert.equal(censusCalls, priorCensusCalls + 4);
            if (!fault) {
              for (const [member, fields] of [["spawner", Object.keys(originalCensus.spawner)], ...["dashboard", "missionControl", "openClaw"].map(member => [member, ["pid"]])] as Array<[string, string[]]>) {
                for (const field of fields) {
                  const crossed = structuredClone(originalCensus); crossed[member][field] = field === "listener" ? {} : null;
                  delete crossed.censusHash; crossed.censusHash = sha256(canonical(crossed));
                  assert.throws(() => runtime.validateDirectSettlementCensusFixtureV1(claim, crossed), /direct settlement/, `${member}.${field}`);
                }
              }
              for (const crossed of [{ ...originalCensus, extra: 1 }, { ...originalCensus, censusHash: "f".repeat(64) }]) assert.throws(() => runtime.validateDirectSettlementCensusFixtureV1(claim, crossed));
            }
            assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
            if (cleanupRequested) {
              const cleanupFault = directControllerFault.slice("settle-cleanup".length).replace(/^-/, "");
              if (cleanupFault === "outer-claim") {
                await runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
                const laterLease = await runtime.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
                const lock = path.join(path.dirname(privateRoot), "physical-service-restart-authority.transition.lock"), originalLock = lstatSync(lock), lockBytes = readFileSync(lock);
                let fired = false;
                Reflect.set(globalThis, "__directCleanupOuterReturnedV1", () => {
                  if (fired) return; fired = true;
                  const file = path.join(privateRoot, "claim.json"), saved = readFileSync(file);
                  renameSync(file, path.join(fixture, "outer-original-claim")); writeFileSync(file, saved, { mode: 0o600, flag: "wx" });
                });
                await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(laterLease), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
                assert.equal(fired, true); assert.equal(lstatSync(lock).ino, originalLock.ino); assert.deepEqual(readFileSync(lock), lockBytes);
                assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
                return;
              }
              if (cleanupFault) {
                let fired = false;
                const lock = path.join(path.dirname(privateRoot), "physical-service-restart-authority.transition.lock"), originalLock = lstatSync(lock), lockBytes = readFileSync(lock);
                Reflect.set(globalThis, "__directCleanupReturnedV1", () => {
                  if (fired) return; fired = true;
                  if (cleanupFault === "intent-temp" || cleanupFault === "settlement-temp") {
                    const final = cleanupFault === "intent-temp" ? path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json") : target;
                    writeFileSync(path.join(path.dirname(final), `.${path.basename(final)}.fixture.tmp`), "pending", { mode: 0o600, flag: "wx" });
                  } else if (cleanupFault === "directory") {
                    const moved = path.join(fixture, "cleanup-original-directory"); renameSync(privateRoot, moved); mkdirSync(privateRoot, { mode: 0o700 });
                    for (const member of readdirSync(moved)) writeFileSync(path.join(privateRoot, member), readFileSync(path.join(moved, member)), { mode: 0o600, flag: "wx" });
                  } else {
                    const replaced = cleanupFault === "intent" ? path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json") : cleanupFault === "settlement" ? target : path.join(privateRoot, `${cleanupFault}.json`);
                    const saved = readFileSync(replaced); renameSync(replaced, path.join(fixture, "cleanup-original-record")); writeFileSync(replaced, saved, { mode: 0o600, flag: "wx" });
                  }
                });
                await assert.rejects(runtime.assertDirectCleanupFixtureV1(true), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/, "post-await history changes must preserve even an unrelated physical lock");
                assert.equal(fired, true); assert.equal(lstatSync(lock).ino, originalLock.ino); assert.deepEqual(readFileSync(lock), lockBytes);
                assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
                return;
              }
              await runtime.assertDirectCleanupFixtureV1(); await runtime.assertDirectCleanupFixtureV1(true);
              const registry = path.join(path.dirname(privateRoot), "baseline-helper-registry-v1"), locator = path.join(registry, "current-head.pair.json");
              mkdirSync(registry, { mode: 0o700 }); writeFileSync(locator, "crossed-registry\n", { mode: 0o600, flag: "wx" });
              try { await assert.rejects(runtime.assertDirectCleanupFixtureV1(true), /registry/, "valid old direct history cannot bypass the current lock's normal journal checks"); }
              finally { unlinkSync(locator); }
              const intentPath = path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json"), intentBytes = readFileSync(intentPath), terminalBytes = readFileSync(target);
              const members = coldGenesisTreeSnapshotV1(privateRoot);
              await runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
              const laterLease = await runtime.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
              await runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(laterLease);
              assert.equal(existsSync(path.join(path.dirname(privateRoot), "physical-service-restart-authority.transition.lock")), false);
              assert.deepEqual(readFileSync(intentPath), intentBytes); assert.deepEqual(readFileSync(target), terminalBytes);
              assert.deepEqual(coldGenesisTreeSnapshotV1(privateRoot), members);
              assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
              return;
            }
            if (releaseRequested) {
              const physicalLock = path.join(path.dirname(privateRoot), "physical-service-restart-authority.transition.lock"), descriptor = runtime.directBorrowedLeaseDescriptorFixtureV1();
              const historyPaths = [path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json"), ...readdirSync(privateRoot).map(name => path.join(privateRoot, name)), target];
              const snapshot = () => historyPaths.map(file => {
                const stats = lstatSync(file, { bigint: true });
                return { file, bytes: readFileSync(file).toString("base64"), identity: [stats.dev, stats.ino, stats.uid, stats.gid, stats.mode, stats.nlink, stats.size, stats.birthtimeNs, stats.mtimeNs, stats.ctimeNs].map(String) };
              });
              const originalHistory = snapshot();
              assert.equal(existsSync(physicalLock), true);
              const releaseFault = directControllerFault.slice("settle-release".length).replace(/^-/, "");
              const releaseProbe = { fault: releaseFault, lock: descriptor, unlinked: false, fired: false, fixtureClosed: false, descriptor: undefined as number | undefined, identity: undefined as ReturnType<typeof fstatSync> | undefined };
              Reflect.set(globalThis, "__directReleaseBoundaryV1", releaseProbe);
              if (releaseFault === "unlink-stat") {
                await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_RELEASE_STAT_FAULT/);
                assert.equal(releaseProbe.fired, true);
                assert.equal(fstatSync(descriptor).nlink, 0);
                writeFileSync(physicalLock, "later-owner", { mode: 0o600, flag: "wx" });
                const successor = lstatSync(physicalLock, { bigint: true });
                await runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
                assert.equal(lstatSync(physicalLock, { bigint: true }).ino, successor.ino);
                assert.equal(readFileSync(physicalLock, "utf8"), "later-owner", "retry must not inspect or remove a later owner's lock");
                unlinkSync(physicalLock); // Only the test-created successor is removed.
              } else if (releaseFault === "epoch-reuse") {
                const epochFd = Reflect.get(globalThis, "__directPinnedDescriptorsV1").get("direct rebind retained epoch");
                assert.ok(Number.isSafeInteger(epochFd));
                let foreign: number | undefined, foreignIdentity: ReturnType<typeof fstatSync> | undefined;
                inputs.hook = (key: string) => {
                  if (key !== "preMutation" || releaseProbe.fired) return;
                  releaseProbe.fired = true; closeSync(epochFd); foreign = openSync("/dev/null", constants.O_RDONLY);
                  assert.equal(foreign, epochFd); foreignIdentity = fstatSync(foreign);
                };
                try {
                  await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /identity|descriptor|predecessor|crossed|reused/);
                  assert.equal(releaseProbe.fired, true);
                  assert.equal(fstatSync(foreign!).ino, foreignIdentity!.ino, "release must not close a foreign descriptor reused during historical resolution");
                  assert.equal(fstatSync(descriptor).nlink, 1);
                  assert.equal(existsSync(physicalLock), true);
                  assert.deepEqual(snapshot(), originalHistory);
                } finally {
                  inputs.hook = undefined; runtime.abandonDirectReleaseEpochFixtureV1();
                  if (foreign !== undefined) try { const actual = fstatSync(foreign); if (actual.dev === foreignIdentity!.dev && actual.ino === foreignIdentity!.ino) closeSync(foreign); }
                  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBADF")) throw error; }
                }
                return;
              } else if (/^(parent-sync|parent-close|lock-close|reader-close|epoch-close)-(before|after)$/.test(releaseFault)) {
                await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_RELEASE_BOUNDARY/);
                assert.equal(releaseProbe.fired, true);
                assert.equal(runtime.hasDirectControllerOwnerFixtureV1(), true, "cleanup failure retains the owner and its outstanding resources");
                assert.deepEqual(snapshot(), originalHistory);
                const opaque = releaseFault.startsWith("epoch-close"), closeBefore = releaseFault.endsWith("close-before");
                if (opaque || closeBefore) {
                  await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /close outcome is ambiguous/);
                  if (closeBefore) {
                    const fd = releaseProbe.descriptor!, current = fstatSync(fd, { bigint: true });
                    assert.equal(current.dev.toString(), releaseProbe.identity!.dev.toString()); assert.equal(current.ino.toString(), releaseProbe.identity!.ino.toString());
                    closeSync(fd); releaseProbe.fixtureClosed = true; // Exact fixture-owned close-before injection; production still refuses an uncertain close.
                  }
                  if (opaque) {
                    assert.equal(existsSync(physicalLock), true);
                    assert.equal(fstatSync(descriptor).nlink, 1);
                    await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /close outcome is ambiguous/);
                    assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
                    return;
                  }
                }
                const laterOwner = !existsSync(physicalLock);
                if (laterOwner) writeFileSync(physicalLock, "later-owner", { mode: 0o600, flag: "wx" });
                const successor = laterOwner ? lstatSync(physicalLock, { bigint: true }) : null;
                await runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
                if (successor) {
                  assert.equal(lstatSync(physicalLock, { bigint: true }).ino, successor.ino);
                  assert.equal(readFileSync(physicalLock, "utf8"), "later-owner"); unlinkSync(physicalLock);
                }
              } else {
                if (releaseFault === "history-only") {
                  const owned = observeColdFixtureExitV1(claim.child.pid)!;
                  assert.equal(owned.command, claim.child.command); process.kill(claim.child.pid, "SIGTERM");
                  const deadline = Date.now() + 5000;
                  for (let current = observeColdFixtureExitV1(claim.child.pid); current && Date.now() < deadline; current = observeColdFixtureExitV1(claim.child.pid)) {
                    assertColdFixtureExitObservationV1(current, owned); await new Promise(resolve => setTimeout(resolve, 20));
                  }
                  assert.equal(observeColdFixtureExitV1(claim.child.pid), null);
                  const epochPath = path.join(path.dirname(privateRoot), "epoch-head.json");
                  renameSync(epochPath, path.join(fixture, "original-release-epoch")); writeFileSync(epochPath, "later-epoch", { mode: 0o600, flag: "wx" });
                }
                let entered!: () => void, release!: () => void, gated = false;
                const reached = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
                Reflect.set(globalThis, "__directControllerHistoryGateV1", () => { if (!gated) { gated = true; entered(); return gate; } });
                const pending = runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease); void pending.catch(() => {});
                await reached;
                try {
                  await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /ownership is active/);
                  await assert.rejects(runtime.invokeDirectControllerFixtureV1(lease, input), /active/);
                  await assert.rejects(runtime.observeDirectControllerFixtureV1(lease, input), /active/);
                  await assert.rejects(runtime.settleDirectControllerFixtureV1(lease, input), /active/);
                } finally { release(); Reflect.deleteProperty(globalThis, "__directControllerHistoryGateV1"); await pending; }
              }
              assert.equal(existsSync(physicalLock), false);
              assert.equal(runtime.hasDirectControllerOwnerFixtureV1(), false);
              assert.throws(() => fstatSync(descriptor), (error: unknown) => error instanceof Error && "code" in error && error.code === "EBADF");
              assert.deepEqual(snapshot(), originalHistory, "physical release preserves every original history byte and inode");
              assert.deepEqual((await runtime.readDirectSettlementHistoryFixtureV1()).settlement, settled);
              await assert.rejects(runtime.invokeDirectControllerFixtureV1(lease, input));
              assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
              return;
            }
            if (historyRequested) {
              const owned = observeColdFixtureExitV1(claim.child.pid)!;
              assert.equal(owned.command, claim.child.command);
              process.kill(claim.child.pid, "SIGTERM");
              const deadline = Date.now() + 5000;
              for (let current = observeColdFixtureExitV1(claim.child.pid); current && Date.now() < deadline; current = observeColdFixtureExitV1(claim.child.pid)) {
                assertColdFixtureExitObservationV1(current, owned); await new Promise(resolve => setTimeout(resolve, 20));
              }
              assert.equal(observeColdFixtureExitV1(claim.child.pid), null);
              const fresh = await import(`${pathToFileURL(runtimePath).href}?direct-history=${Date.now()}`);
              const stored = coldGenesisTreeSnapshotV1(path.dirname(privateRoot));
              const historyFault = directControllerFault.slice("settle-history".length).replace(/^-/, "");
              if (historyFault === "close") {
                const cleanup: { fault: boolean; opens: number; targetFd?: number; identity?: ReturnType<typeof fstatSync> } = { fault: true, opens: 0 };
                Reflect.set(globalThis, "__directHistoryCleanupV1", cleanup);
                try {
                  await assert.rejects(fresh.readDirectSettlementHistoryFixtureV1(), /DIRECT_HISTORY_CLOSE_FAULT/);
                  assert.ok(Number.isSafeInteger(cleanup.targetFd));
                  const opened = cleanup.opens;
                  await assert.rejects(fresh.readDirectSettlementHistoryFixtureV1(), /close outcome is ambiguous/);
                  assert.equal(cleanup.opens, opened, "pending original cleanup must fence all new history acquisitions");
                  closeSync(cleanup.targetFd!); cleanup.fault = false; // Fixture owns the injected pre-close failure.
                  assert.deepEqual((await fresh.readDirectSettlementHistoryFixtureV1()).settlement, settled);
                  assert.deepEqual(coldGenesisTreeSnapshotV1(path.dirname(privateRoot)), stored);
                } finally {
                  cleanup.fault = false;
                  if (cleanup.targetFd !== undefined) try {
                    const current = fstatSync(cleanup.targetFd, { bigint: true });
                    if (String(current.dev) === String(cleanup.identity!.dev) && String(current.ino) === String(cleanup.identity!.ino)) closeSync(cleanup.targetFd);
                  } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBADF")) throw error; }
                  Reflect.deleteProperty(globalThis, "__directHistoryCleanupV1"); fresh.drainDirectFrameCleanupFixtureV1();
                }
                assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
                return;
              }
              if (historyFault) {
                let fired = false;
                if (["intent", "termination-dispatch", "termination-receipt", "spawn-dispatch", "claim"].includes(historyFault)) {
                  const replaced = historyFault === "intent" ? path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json") : path.join(privateRoot, `${historyFault}.json`);
                  const bytes = readFileSync(replaced); renameSync(replaced, path.join(fixture, "history-original")); writeFileSync(replaced, bytes, { mode: 0o600, flag: "wx" }); fired = true;
                }
                if (historyFault === "p3") { inputs.records.preMutation.spawner.pid++; fired = true; }
                if (historyFault === "await-aba") inputs.hook = (key: string) => {
                  if (key === "preMutation" && !fired) { fired = true; const foreign = path.join(privateRoot, "history-foreign.tmp"); writeFileSync(foreign, "foreign", { mode: 0o600 }); unlinkSync(foreign); }
                };
                const beforeRefusal = coldGenesisTreeSnapshotV1(path.dirname(privateRoot));
                await assert.rejects(fresh.readDirectSettlementHistoryFixtureV1());
                assert.equal(fired, true);
                await assert.rejects(fresh.readDirectSettlementHistoryFixtureV1());
                if (historyFault !== "await-aba") assert.deepEqual(coldGenesisTreeSnapshotV1(path.dirname(privateRoot)), beforeRefusal);
                assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
                return;
              }
              const historical = await fresh.readDirectSettlementHistoryFixtureV1();
              assert.deepEqual(historical.settlement, settled);
              assert.deepEqual(historical.claim, claim);
              assert.equal(historical.preSchemaHelperJournalHash, completion.intentHash);
              assert.equal(historical.preSchemaHelperSettlementRef, settled.helperSettlementRef);
              assert.equal(historical.preSchemaHelperSettlementHash, settled.helperSettlementHash);
              assert.deepEqual(await fresh.readDirectSettlementHistoryFixtureV1(), historical);
              assert.deepEqual(coldGenesisTreeSnapshotV1(path.dirname(privateRoot)), stored, "fresh historical resolution cannot mutate or repair authority");
              assert.equal(spawnProbe.calls.length, 1); assert.equal(signalProbe.calls.length, 1);
              const bytes = readFileSync(target);
              for (const key of Object.keys(settled)) {
                const crossed = structuredClone(settled); crossed[key] = null;
                if (!key.startsWith("helperSettlement")) {
                  delete crossed.helperSettlementHash; delete crossed.helperSettlementRef;
                  crossed.helperSettlementHash = sha256(canonical(crossed)); crossed.helperSettlementRef = `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${crossed.helperSettlementHash}`;
                }
                writeFileSync(target, `${canonical(crossed)}\n`, { mode: 0o600 });
                await assert.rejects(fresh.readDirectSettlementHistoryFixtureV1(), undefined, `historical terminal refuses ${key}`);
              }
              for (const malformed of [Buffer.from("{}\n"), Buffer.from(`${JSON.stringify(settled)}\n`), Buffer.concat([bytes, bytes]), Buffer.alloc(65_537, 32)]) {
                writeFileSync(target, malformed); await assert.rejects(fresh.readDirectSettlementHistoryFixtureV1());
              }
              writeFileSync(target, bytes);
              assert.deepEqual((await fresh.readDirectSettlementHistoryFixtureV1()).settlement, settled);
              renameSync(target, path.join(fixture, "history-original-terminal")); writeFileSync(target, bytes, { mode: 0o600, flag: "wx" });
              const replacedTerminal = await fresh.readDirectSettlementHistoryFixtureV1();
              assert.deepEqual(replacedTerminal.settlement, settled);
              assert.notDeepEqual(replacedTerminal.settlementIdentity, historical.settlementIdentity, "terminal inode replacement must change the future census witness");
            }
          }
          if (directControllerFault.startsWith("observe")) {
            const fault = directControllerFault.slice("observe".length).replace(/^-/, "");
            if (fault.startsWith("replay-")) {
              assert.deepEqual(await runtime.observeDirectControllerFixtureV1(lease, input), claim);
              assert.equal(runtime.inspectDirectControllerFixtureV1().phase, "claim-observed");
            }
            if (["claim-replace", "dispatch-replace", "pid-replace", "intent-replace", "termination-replace", "replay-claim", "replay-dispatch"].includes(fault)) {
              const target = fault === "pid-replace" ? path.join(home, ".openclaw/setfarm/spawner.pid")
                : fault === "intent-replace" ? path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json")
                : path.join(privateRoot, fault === "termination-replace" ? "termination-receipt.json" : ["claim-replace", "replay-claim"].includes(fault) ? "claim.json" : "spawn-dispatch.json");
              const bytes = readFileSync(target); renameSync(target, path.join(fixture, "controller-original-observation")); writeFileSync(target, bytes, { mode: 0o600, flag: "wx" });
            }
            if (fault === "journal-aba") { const target = path.join(privateRoot, "observer-foreign.tmp"); writeFileSync(target, "foreign", { mode: 0o600 }); unlinkSync(target); }
            if (fault === "runtime-parent") {
              const target = path.join(home, ".openclaw/setfarm"), original = path.join(fixture, "controller-original-runtime");
              renameSync(target, original); symlinkSync(original, target, "dir");
            }
            if (fault === "p3") Reflect.get(globalThis, "__directRebindInputFixtureV1").records.preMutation.spawner.pid++;
            if (fault) {
              await assert.rejects(runtime.observeDirectControllerFixtureV1(lease, input), /direct|profile|predecessor/);
              await assert.rejects(runtime.observeDirectControllerFixtureV1(lease, input), /direct|profile|predecessor/);
              assert.equal(runtime.inspectDirectControllerFixtureV1().phase, fault.startsWith("replay-") ? "claim-observed" : "helper-may-have-run");
            } else {
              let entered!: () => void, release!: () => void, gated = false;
              const reached = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
              Reflect.set(globalThis, "__directControllerProfileGateV1", () => { if (!gated) { gated = true; entered(); return gate; } });
              const observation = runtime.observeDirectControllerFixtureV1(lease, input); void observation.catch(() => {});
              await reached;
              try { await assert.rejects(runtime.observeDirectControllerFixtureV1(lease, input), /already active/); }
              finally { release(); Reflect.deleteProperty(globalThis, "__directControllerProfileGateV1"); await observation; }
              assert.deepEqual(await observation, claim);
              assert.equal(runtime.inspectDirectControllerFixtureV1().phase, "claim-observed");
              assert.deepEqual(await runtime.observeDirectControllerFixtureV1(lease, input), claim);
            }
            assert.equal(spawnProbe.calls.length, 1, "independent observation cannot redispatch");
          }
          if (!directControllerFault.startsWith("settle")) await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
          return;
        }
        const crosses: Array<[string, (value: any) => void]> = [
          ["crossed-operation", value => { value.operation.purpose = "crossed"; }],
          ["crossed-restart", value => { value.restart.maximumSpawnDispatchCount = 2; }],
          ["crossed-startup", value => { value.startup.startupTokenHash = "f".repeat(64); }],
          ["crossed-authorization", value => { value.authorization.authorityV3Migration31AuditHash = "f".repeat(64); }],
          ["crossed-legacy", value => { value.legacy.observedSpawnerGenerationHash = "f".repeat(64); }],
          ["crossed-p3", value => { value.preMutation.spawner.pid++; }],
          ["crossed-profile", value => { value.profile.environmentHash = "f".repeat(64); }],
          ["crossed-environment", value => { value.environment.PRIVATE_VALUE = "crossed"; }],
        ];
        const intermediary = path.join(fixture, "direct-helper-parent.mjs");
        writeFileSync(intermediary, `import{spawnSync}from'node:child_process';const child=spawnSync(process.execPath,[${JSON.stringify(runner)}],{cwd:${JSON.stringify(repository)},env:process.env,stdio:['ignore','inherit','inherit',3,4,5],timeout:12000});process.exitCode=child.status??1;\n`, { mode: 0o600 });
        writeFileSync(path.join(fixture, ".env"), "PENDING_DOTENV=escaped\n", { mode: 0o600 });
        for (const [fault, mutate] of (spawnFault === undefined ? [["none", null], ["pending-ordinary", null], ["pending-spawner", null], ["parent-uid", null], ["wrong-parent", null], ["wrong-cwd", null], ["extra-argv", null], ["crossed-frame", null], ["crossed-lock", null], ["crossed-intent", null], ["missing-marker", null], ["revoked-during-evidence", null], ["late-output", null], ["late-host", null], ["early-configuration", null], ["entry-before-selection", null], ["late-entry", null], ["late-frame", null], ["mixed-marker", null], ...crosses, ["late-dispatch-swap", null]] : [["none", null]]) as Array<[string, ((value: any) => void) | null]>) {
          const observed = structuredClone(records); mutate?.(observed); writeFileSync(recordPath, JSON.stringify(observed), { mode: 0o600 });
          const handles = runtime.openDirectHelperFrameFixtureV1(), before = coldGenesisTreeSnapshotV1(privateRoot);
          try {
            const lockDescriptor = runtime.directBorrowedLeaseDescriptorFixtureV1();
            const child = spawnSync(process.execPath, [fault === "wrong-parent" ? intermediary : runner, ...(fault === "extra-argv" ? ["--foreign"] : [])], { cwd: fault === "wrong-cwd" ? fixture : repository, env: { PATH: "/usr/bin:/bin", HOME: home, ...(fault === "missing-marker" || directHelperFault === "missing-selector" ? {} : { SETFARM_INTERNAL_PRODUCTION_DIRECT_HELPER: directHelperFault === "invalid-selector" ? "invalid" : "1" }), FIXTURE_DIRECT_HELPER_FAULT: fault, ...(fault === "mixed-marker" || directHelperFault === "mixed" ? { SETFARM_INTERNAL_PRODUCTION_COLD_HELPER: "1" } : {}) }, stdio: ["ignore", "pipe", "pipe", fault === "crossed-frame" ? handles.intentDescriptor : handles.frameDescriptor, fault === "crossed-lock" ? handles.intentDescriptor : lockDescriptor, fault === "crossed-intent" ? lockDescriptor : handles.intentDescriptor], encoding: "utf8", timeout: 15000, maxBuffer: 65536 });
            if (actualDirectHelper) {
              const entries = readFileSync(directSpawnTracePath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
              assert.equal(entries.length, directHelperSelectorRefused ? 0 : 1, "the fixed helper owns at most one spawn entry");
              if (entries.length) {
                assert.equal(entries[0].executable, process.execPath); assert.deepEqual(entries[0].arguments, [entry]);
                assert.equal(entries[0].options.cwd, repository); assert.equal(entries[0].options.detached, true); assert.equal(entries[0].options.shell, false);
                assert.deepEqual(entries[0].options.env, { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", SETFARM_INTERNAL_PRODUCTION_DIRECT_CHILD: "1" });
                assert.equal(entries[0].options.stdio[4], 4); assert.equal(entries[0].options.stdio[6], "pipe");
              }
            }
            if (actualDirectHelper && !directHelperAccepted) {
              assert.equal(child.status, 1, `${directHelperFault}: uncertain helper must refuse completion`);
              assert.equal(child.stdout, ""); assert.match(child.stderr, directHelperSelectorRefused ? /INTERNAL_PRODUCTION_PRE_SCHEMA_RESTART_HELPER_INVALID/ : /direct helper transport is uncertain/);
              if (["runtime-parent", "late-parent"].includes(directHelperFault)) assert.equal(lstatSync(path.join(home, ".openclaw/setfarm")).isSymbolicLink(), true);
              if (directHelperFault === "late-pid") assert.equal(existsSync(path.join(fixture, "direct-original-pid")), true);
              if (directHelperFault === "no-eof") {
                const receivedCount = Number(readFileSync(path.join(fixture, "direct-helper-fault-fired"), "utf8"));
                assert.ok(Number.isSafeInteger(receivedCount) && receivedCount > 0 && receivedCount <= 4096, "EOF timeout must follow retained readiness bytes");
              }
              if (directHelperFault === "cleanup-close") assert.equal(readFileSync(path.join(fixture, "direct-helper-fault-fired"), "utf8"), "close");
              if (directHelperFault === "child-exit") { const original = parseColdFixtureExitRowV1(readFileSync(directChildCleanupPath, "utf8")); assert.equal(observeColdFixtureExitV1(Number(original.pid)), null); }
            } else assert.equal(child.status, 0, `${spawnFault ?? fault}: ${child.stderr}`);
            if (actualDirectHelper && directHelperAccepted) {
              const completion = JSON.parse(child.stdout), claim = JSON.parse(readFileSync(path.join(privateRoot, "claim.json"), "utf8"));
              assert.equal(child.stdout, `${canonical(completion)}\n`, "fixed helper completion must be canonical for its strict controller consumer");
              assert.equal(completion.schema, "setfarm.internal-production-direct-spawner-helper-completion.v1");
              assert.equal(completion.claimRef, claim.claimRef); assert.equal(completion.claimHash, claim.claimHash);
              assert.equal(completion.dispatchHash, JSON.parse(readFileSync(path.join(privateRoot, "spawn-dispatch.json"), "utf8")).dispatchHash);
              assert.equal(Buffer.byteLength(child.stdout) <= 4096, true);
              const intent = JSON.parse(readFileSync(path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json"), "utf8"));
              const dispatch = JSON.parse(readFileSync(path.join(privateRoot, "spawn-dispatch.json"), "utf8"));
              const dispatchBytes = readFileSync(path.join(privateRoot, "spawn-dispatch.json"));
              const terminationDispatchBytes = readFileSync(path.join(privateRoot, "termination-dispatch.json")), terminationReceiptBytes = readFileSync(path.join(privateRoot, "termination-receipt.json"));
              const parseDispatch = (bytes: Buffer) => runtime.parseDirectSpawnDispatchFixtureV1(bytes, intent, terminationDispatchBytes, terminationReceiptBytes);
              assert.deepEqual(parseDispatch(dispatchBytes), dispatch, "historical parser accepts the real helper's original dispatch");
              const resignDispatch = (value: any) => { delete value.dispatchRef; delete value.dispatchHash; const dispatchHash = sha256(canonical(value)); return Buffer.from(`${canonical({ ...value, dispatchRef: `setfarm://internal-production/pre-schema-spawner-direct-spawn-dispatch/sha256/${dispatchHash}`, dispatchHash })}\n`); };
              for (const key of Object.keys(dispatch).filter(key => !["dispatchRef", "dispatchHash"].includes(key))) {
                const value = structuredClone(dispatch); value[key] = null;
                assert.throws(() => parseDispatch(resignDispatch(value)), undefined, `direct dispatch ${key}`);
              }
              for (const member of ["controller", "helper", "lockIdentity", "action"]) for (const key of Object.keys(dispatch[member])) {
                const value = structuredClone(dispatch); value[member][key] = null;
                assert.throws(() => parseDispatch(resignDispatch(value)), undefined, `direct dispatch ${member}.${key}`);
              }
              for (const key of ["intentIdentity", "terminationDispatchIdentity", "terminationReceiptIdentity"]) {
                for (let index = 0; index < 10; index++) {
                  const value = structuredClone(dispatch); value[key][index] = null;
                  assert.throws(() => parseDispatch(resignDispatch(value)), undefined, `direct dispatch ${key}[${index}] must be a canonical decimal`);
                }
                for (const index of [0, 1, 2, 4, 5, 6]) {
                  const value = structuredClone(dispatch); value[key][index] = index === 0 ? "-1" : index === 1 || index === 5 ? "0" : "99999999";
                  assert.throws(() => parseDispatch(resignDispatch(value)), undefined, `direct dispatch ${key}[${index}]`);
                }
              }
              for (const [target, original] of [["terminationDispatchIdentity", "intentIdentity"], ["terminationReceiptIdentity", "intentIdentity"], ["terminationReceiptIdentity", "terminationDispatchIdentity"]]) {
                const value = structuredClone(dispatch); value[target!][1] = value[original!][1];
                assert.throws(() => parseDispatch(resignDispatch(value)), undefined, "simultaneous original publications cannot share an inode");
              }
              for (const key of ["dispatchRef", "dispatchHash"]) {
                const value = structuredClone(dispatch); value[key] = "crossed";
                assert.throws(() => parseDispatch(Buffer.from(`${canonical(value)}\n`)));
              }
              for (const bytes of [Buffer.alloc(0), Buffer.alloc(65_537), Buffer.from(dispatchBytes.toString().trim()), Buffer.concat([dispatchBytes, Buffer.from(" ")]), Buffer.from(dispatchBytes.toString().replace('"maximumSpawnDispatchCount":1', '"maximumSpawnDispatchCount":1,"maximumSpawnDispatchCount":1'))]) assert.throws(() => parseDispatch(bytes));
              const claimBytes = readFileSync(path.join(privateRoot, "claim.json"));
              assert.deepEqual(runtime.parseDirectClaimFixtureV1(claimBytes, intent, dispatch), claim);
              const resign = (value: any) => { delete value.claimRef; delete value.claimHash; const claimHash = sha256(canonical(value)); return Buffer.from(`${canonical({ ...value, claimRef: `setfarm://internal-production/pre-schema-spawner-direct-claim/sha256/${claimHash}`, claimHash })}\n`); };
              for (const key of Object.keys(claim).filter(key => !["claimRef", "claimHash"].includes(key))) {
                const value = structuredClone(claim); value[key] = null;
                assert.throws(() => runtime.parseDirectClaimFixtureV1(resign(value), intent, dispatch), undefined, `direct claim ${key}`);
              }
              for (const [member, keys] of [["child", ["pid", "processStartTimeEpochMs", "lstart", "command", "processIdentityHash", "uid", "ppid", "pgid"]], ["startupFiles", ["schema", "pid", "uid", "singleton", "pidFile"]]] as const) {
                for (const key of keys) { const value = structuredClone(claim); value[member][key] = null; assert.throws(() => runtime.parseDirectClaimFixtureV1(resign(value), intent, dispatch), undefined, `direct claim ${member}.${key}`); }
              }
              for (const file of ["singleton", "pidFile"]) for (const key of Object.keys(claim.startupFiles[file])) {
                const value = structuredClone(claim); value.startupFiles[file][key] = null;
                assert.throws(() => runtime.parseDirectClaimFixtureV1(resign(value), intent, dispatch), undefined, `direct claim ${file}.${key}`);
              }
              for (const bytes of [Buffer.alloc(0), Buffer.alloc(65_537), Buffer.from(claimBytes.toString().trim()), Buffer.concat([claimBytes, Buffer.from(" ")]), Buffer.from(claimBytes.toString().replace('"maximumClaimCount":1', '"maximumClaimCount":1,"maximumClaimCount":1'))]) assert.throws(() => runtime.parseDirectClaimFixtureV1(bytes, intent, dispatch));
            } else if (!actualDirectHelper) assert.equal(child.stdout, spawnFault !== undefined ? spawnFault === "none" || spawnFault.startsWith("child-") ? "dispatch-owned" : "dispatch-refused" : fault === "none" ? "authenticated" : "refused", fault);
            if (!actualDirectHelper || directHelperAccepted) assert.equal(child.stderr, "");
            const after = coldGenesisTreeSnapshotV1(privateRoot);
            if (fault === "late-dispatch-swap") {
              const original = before.find(entry => entry.relative === "termination-dispatch.json")!, replacement = after.find(entry => entry.relative === "termination-dispatch.json")!;
              assert.notEqual(replacement.ino, original.ino); assert.equal(replacement.bytesHash, original.bytesHash);
              assert.deepEqual(readdirSync(privateRoot).sort(), ["termination-dispatch.json", "termination-receipt.json"]);
            } else if (spawnFault !== undefined) {
              assert.deepEqual(readdirSync(privateRoot).sort(), [...(directHelperSelectorRefused ? [] : ["spawn-dispatch.json"]), "termination-dispatch.json", "termination-receipt.json", ...(spawnFault === "foreign-scratch" ? ["foreign.tmp"] : []), ...((positiveDirectMain && !directHelperSelectorRefused && directHelperFault !== "spawn-error") || spawnFault === "child-main-writer" ? ["claim.json"] : [])].sort());
              assert.deepEqual(after.filter(entry => entry.relative !== "" && entry.relative !== "spawn-dispatch.json" && entry.relative !== "foreign.tmp" && entry.relative !== "claim.json" && !(spawnFault === "termination-swap" && entry.relative === "termination-receipt.json")), before.filter(entry => entry.relative !== "" && !(spawnFault === "termination-swap" && entry.relative === "termination-receipt.json")));
              if (positiveDirectMain && directHelperAccepted) {
                const claim = JSON.parse(readFileSync(path.join(privateRoot, "claim.json"), "utf8")), childPid = claim.child.pid;
                const original = observeColdFixtureExitV1(childPid); assert.ok(original); assert.equal(original.pgid, String(childPid));
                const parent = () => {
                  const result = spawnSync("/bin/ps", ["-p", String(childPid), "-o", "ppid="], { encoding: "utf8", timeout: 2000, maxBuffer: 1024, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
                  assert.equal(result.status, 0); assert.equal(result.stderr, ""); assert.match(result.stdout, /^\s*[0-9]+\n$/); return result.stdout.trim();
                };
                try {
                  const deadline = Date.now() + 5000;
                  while (parent() !== "1" && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
                  assert.equal(parent(), "1", "claimed direct main survives original helper departure");
                  assert.equal(readFileSync(path.join(home, ".openclaw/setfarm/spawner.pid"), "utf8"), String(childPid));
                } finally {
                  const current = observeColdFixtureExitV1(childPid); if (current && assertColdFixtureExitObservationV1(current, original) === "running") process.kill(childPid, "SIGTERM");
                  const deadline = Date.now() + 5000;
                  while (observeColdFixtureExitV1(childPid) !== null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
                }
                assert.equal(observeColdFixtureExitV1(childPid), null);
                assert.equal(existsSync(path.join(home, ".openclaw/setfarm/spawner.pid")), false); assert.equal(existsSync(path.join(home, ".openclaw/setfarm/spawner.lock")), false);
              }
              if (spawnFault === "collision") assert.equal(readFileSync(path.join(privateRoot, "spawn-dispatch.json"), "utf8"), "foreign");
              if (spawnFault === "foreign-scratch") assert.equal(readFileSync(path.join(privateRoot, "foreign.tmp"), "utf8"), "foreign");
              if (spawnFault === "none") {
                writeFileSync(recordPath, JSON.stringify(records), { mode: 0o600 });
                const replay = spawnSync(process.execPath, [runner], { cwd: repository, env: { PATH: "/usr/bin:/bin", SETFARM_INTERNAL_PRODUCTION_DIRECT_HELPER: "1", FIXTURE_DIRECT_HELPER_FAULT: "existing-dispatch" }, stdio: ["ignore", "pipe", "pipe", handles.frameDescriptor, lockDescriptor, handles.intentDescriptor], encoding: "utf8", timeout: 15000 });
                assert.equal(replay.status, 0, replay.stderr); assert.equal(replay.stdout, "refused", "a fresh helper cannot adopt the first dispatch"); assert.deepEqual(coldGenesisTreeSnapshotV1(privateRoot), after);
              }
            } else assert.deepEqual(after, before);
            assert.equal(signalProbe.calls.length, 1, "helper authentication emits no process action");
            await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
          } finally { closeSync(handles.frameDescriptor); closeSync(handles.intentDescriptor); }
        }
      }
      if (mode.startsWith("frame-")) {
        const target = mode === "frame-intent-replace" ? path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json")
          : path.join(privateRoot, mode === "frame-dispatch-replace" ? "termination-dispatch.json" : "termination-receipt.json");
        const bytes = readFileSync(target), original = lstatSync(target, { bigint: true });
        renameSync(target, path.join(fixture, "original-frame-authority"));
        writeFileSync(target, bytes, { mode: 0o600, flag: "wx" });
        assert.notEqual(lstatSync(target, { bigint: true }).ino, original.ino);
        assert.throws(() => runtime.openDirectHelperFrameFixtureV1(), /identity|changed|crossed/, "equal bytes never replace an original publication inode");
        assert.deepEqual(readFileSync(target), bytes, "the foreign replacement is preserved on refusal");
        assert.deepEqual(readdirSync(privateRoot).sort(), ["termination-dispatch.json", "termination-receipt.json"], "no capability scratch is created from crossed authority");
        assert.equal(signalProbe.calls.length, 1);
        await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
      }
      if (mode === "response-loss") {
        const dispatchBytes = readFileSync(path.join(privateRoot, "termination-dispatch.json")), receiptBytes = readFileSync(path.join(privateRoot, "termination-receipt.json"));
        const history = runtime.parseDirectTerminationFixtureV1(dispatchBytes, receiptBytes);
        assert.deepEqual(history.dispatch, JSON.parse(dispatchBytes.toString()));
        assert.deepEqual(history.receipt, terminal);
        assert.ok(Object.isFrozen(history) && Object.isFrozen(history.dispatch.target) && Object.isFrozen(history.receipt.controller));
        const resign = (value: any, stem: string, domain: string) => {
          delete value[`${stem}Ref`]; delete value[`${stem}Hash`];
          const hash = sha256(canonical(value));
          return { ...value, [`${stem}Ref`]: `setfarm://internal-production/${domain}/sha256/${hash}`, [`${stem}Hash`]: hash };
        };
        const wire = (value: any) => Buffer.from(`${canonical(value)}\n`);
        const mutate = (target: any, key: string) => { const old = target[key]; target[key] = typeof old === "number" ? old + 1 : typeof old === "string" ? `${old}-crossed` : null; };
        for (const part of ["dispatch", "receipt"] as const) {
          const baseline = history[part];
          for (const key of Object.keys(baseline)) {
            const crossed = structuredClone(baseline); mutate(crossed, key);
            assert.throws(() => runtime.parseDirectTerminationFixtureV1(part === "dispatch" ? wire(crossed) : dispatchBytes, part === "receipt" ? wire(crossed) : receiptBytes), undefined, `${part}.${key}`);
          }
        }
        for (const [member, keys] of [["target", Object.keys(history.dispatch.target)], ["controller", Object.keys(history.dispatch.controller)]] as const) {
          for (const key of keys) {
            const crossed = structuredClone(history.dispatch); mutate(crossed[member], key);
            const dispatch = resign(crossed, "dispatch", "pre-schema-spawner-direct-termination-dispatch");
            const receipt = resign({ ...structuredClone(terminal), dispatchRef: dispatch.dispatchRef, dispatchHash: dispatch.dispatchHash, ...(member === "controller" ? { controller: dispatch.controller } : {}) }, "terminationReceipt", "pre-schema-spawner-direct-termination-receipt");
            assert.throws(() => runtime.parseDirectTerminationFixtureV1(wire(dispatch), wire(receipt)), undefined, `self-hashed ${member}.${key}`);
          }
        }
        for (const key of ["purpose", "predecessorSpawnerProcessIdentity", "terminationSignal", "signalDispatchCount", "signalCallOutcome", "observedProcessState", "observedListenerState"]) {
          const crossed = structuredClone(terminal); mutate(crossed, key);
          assert.throws(() => runtime.parseDirectTerminationFixtureV1(dispatchBytes, wire(resign(crossed, "terminationReceipt", "pre-schema-spawner-direct-termination-receipt"))), undefined, `self-hashed receipt.${key}`);
        }
        for (const bytes of [Buffer.from("{}\n"), Buffer.concat([dispatchBytes, Buffer.from(" ")]), Buffer.alloc(65537)]) assert.throws(() => runtime.parseDirectTerminationFixtureV1(bytes, receiptBytes));
        assert.equal(signalProbe.calls.length, 1, "history parsing never signals or launches");
        assert.deepEqual(readFileSync(path.join(privateRoot, "termination-dispatch.json")), dispatchBytes);
        assert.deepEqual(readFileSync(path.join(privateRoot, "termination-receipt.json")), receiptBytes);
        assert.throws(() => runtime.openDirectHelperFrameFixtureV1(true), /owner/);
        const beforeFrame = coldGenesisTreeSnapshotV1(privateRoot);
        const handles = runtime.openDirectHelperFrameFixtureV1();
        try {
          assert.equal(fstatSync(handles.frameDescriptor).nlink, 0);
          assert.equal(fstatSync(handles.intentDescriptor).nlink, 1);
          assert.throws(() => writeFileSync(handles.frameDescriptor, "crossed"), /EBADF/);
          assert.throws(() => writeFileSync(handles.intentDescriptor, "crossed"), /EBADF/);
          const child = spawnSync(process.execPath, ["--input-type=module", "-e", `import assert from 'node:assert/strict';import{readFileSync,fstatSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const frame=JSON.parse(readFileSync(3,'utf8')),intent=JSON.parse(readFileSync(5,'utf8'));
assert.equal(frame.schema,'setfarm.internal-production-pre-schema-spawner-direct-rebind-helper-capability.v1');
assert.equal(frame.intentRef,intent.intentRef);assert.equal(frame.intentHash,intent.intentHash);
assert.equal(createHash('sha256').update(frame.nonce).digest('hex'),intent.nonceHash);
assert.equal(frame.environment.PRIVATE_VALUE,'direct-fixture-secret');assert.equal(fstatSync(3).nlink,0);
assert.throws(()=>writeFileSync(3,'crossed'),/EBADF/);assert.throws(()=>writeFileSync(5,'crossed'),/EBADF/);
process.stdout.write(JSON.stringify({keys:Object.keys(frame).sort(),dispatch:frame.terminationDispatchHash,receipt:frame.terminationReceiptHash}));`], {
            cwd: fixture, env: { PATH: "/usr/bin:/bin" }, stdio: ["ignore", "pipe", "pipe", handles.frameDescriptor, "ignore", handles.intentDescriptor], encoding: "utf8", timeout: 10000, maxBuffer: 65536,
          });
          assert.equal(child.status, 0, child.stderr); assert.equal(child.stderr, "");
          const projected = JSON.parse(child.stdout);
          assert.equal(projected.dispatch, history.dispatch.dispatchHash); assert.equal(projected.receipt, terminal.terminationReceiptHash);
          assert.deepEqual(projected.keys, ["schema", "intentRef", "intentHash", "intentIdentity", "terminationDispatchRef", "terminationDispatchHash", "terminationDispatchIdentity", "terminationReceiptRef", "terminationReceiptHash", "terminationReceiptIdentity", "lockIdentity", "environment", "nonce"].sort());
          const afterFrame = coldGenesisTreeSnapshotV1(privateRoot);
          assert.deepEqual(afterFrame.slice(1), beforeFrame.slice(1), "frame preparation preserves both original authority files exactly");
          const { mtimeNs: beforeMtime, ctimeNs: beforeCtime, ...beforeRoot } = beforeFrame[0]!;
          const { mtimeNs: afterMtime, ctimeNs: afterCtime, ...afterRoot } = afterFrame[0]!;
          assert.deepEqual(afterRoot, beforeRoot, "only parent timestamps may reflect the owned empty scratch create/unlink");
          assert.equal(signalProbe.calls.length, 1, "frame issuance has no process effect");
        } finally { closeSync(handles.frameDescriptor); closeSync(handles.intentDescriptor); }
        for (const mode of ["secret-writer-reuse", "secret-reader-reuse", "intent-same-inode-reuse", "late-mutation", "close-response", "close-reuse", "write-before", "short-write", "writer-close", "persistent-close"]) {
          const foreignPath = path.join(fixture, `foreign-empty-${mode}`); writeFileSync(foreignPath, "", { mode: 0o600, flag: "wx" });
          const probe = { mode, foreignPath, owned: new Set<number>(), writer: undefined as number | undefined, foreign: undefined as number | undefined, fired: false, writes: 0, beforeWrite(fd: number, scratch: string) {
            if (!this.mode.startsWith("secret-")) assert.equal(fstatSync(fd).nlink, 0, "every first secret write happens only after unlink");
            assert.equal(existsSync(scratch), false); this.writes++;
            if (this.mode === "write-before" || this.mode === "intent-same-inode-reuse") { if (this.mode === "write-before") this.fired = true; throw Error("DIRECT_FRAME_WRITE_FAULT"); }
          } };
          Reflect.set(globalThis, "__directFrameProbeV1", probe);
          try {
            assert.throws(() => runtime.openDirectHelperFrameFixtureV1(), /frame preparation failed|DIRECT_FRAME_CLOSE_FAULT|descriptor was reused|close outcome is ambiguous/, mode);
            assert.equal(probe.writes, mode.startsWith("secret-") ? 0 : 1, mode);
            if (mode.startsWith("secret-")) { assert.equal(probe.fired, true); assert.equal(readFileSync(foreignPath).length, 0); assert.equal(fstatSync(probe.foreign!).nlink, 1); }
            if (mode === "close-reuse") assert.equal(fstatSync(probe.foreign!).isCharacterDevice(), true, "an ambiguous writer close cannot close a foreign reused FD");
            if (mode === "intent-same-inode-reuse") {
              assert.equal(fstatSync(probe.foreign!).ino, lstatSync(path.join(path.dirname(privateRoot), "pre-schema-helper-journal.json")).ino, "same-inode reopen is a foreign handle too");
              assert.throws(() => runtime.drainDirectFrameCleanupFixtureV1(), /close outcome is ambiguous/);
              closeSync(probe.foreign!); probe.foreign = undefined; // The fixture, not production, owns this reopened handle.
            }
            if (mode === "persistent-close" || mode === "writer-close") {
              assert.equal(probe.owned.size, 1, "only the interrupted original writer remains owned");
              assert.throws(() => runtime.openDirectHelperFrameFixtureV1(), /close outcome is ambiguous/);
              assert.equal(probe.writes, 1, "unfinished cleanup fences another secret frame");
              assert.throws(() => runtime.drainDirectFrameCleanupFixtureV1(), /close outcome is ambiguous/);
              closeSync(probe.writer!); probe.owned.delete(probe.writer!); // Fixture knows its injected failure preceded the real close.
            }
            probe.mode = "disabled";
            assert.equal(runtime.drainDirectFrameCleanupFixtureV1(), 0);
            assert.equal(probe.owned.size, 0, "every unreturned descriptor is closed after cleanup recovery");
            assert.deepEqual(readdirSync(privateRoot).sort(), ["termination-dispatch.json", "termination-receipt.json"]);
            assert.deepEqual(readFileSync(path.join(privateRoot, "termination-dispatch.json")), dispatchBytes);
            assert.deepEqual(readFileSync(path.join(privateRoot, "termination-receipt.json")), receiptBytes);
            await assert.rejects(runtime.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /DIRECT_REBIND_UNSETTLED/);
          } finally { probe.mode = "disabled"; try { runtime.drainDirectFrameCleanupFixtureV1(); } finally { for (const fd of probe.owned) { try { closeSync(fd); } catch { /* Test-only cleanup if a failed assertion exposed a leaked return. */ } } if (probe.foreign !== undefined) { try { closeSync(probe.foreign); } catch { /* Fixture may have demonstrated the erroneous foreign close. */ } } Reflect.deleteProperty(globalThis, "__directFrameProbeV1"); } }
        }
      }
    } finally {
      Reflect.deleteProperty(globalThis, "__directRebindInputFixtureV1");
      Reflect.deleteProperty(globalThis, "__directIntentPublicationFixtureV1");
      Reflect.deleteProperty(globalThis, "__directSignalFixtureV1");
      Reflect.deleteProperty(globalThis, "__directTerminationPublicationHook");
      Reflect.deleteProperty(globalThis, "__directFrameProbeV1");
      Reflect.deleteProperty(globalThis, "__directControllerOutputFixtureV1");
      Reflect.deleteProperty(globalThis, "__directControllerSpawnFixtureV1");
      Reflect.deleteProperty(globalThis, "__directControllerProfileGateV1");
      Reflect.deleteProperty(globalThis, "__directControllerCensusGateV1");
      Reflect.deleteProperty(globalThis, "__directControllerHistoryGateV1");
      Reflect.deleteProperty(globalThis, "__directCleanupReturnedV1");
      Reflect.deleteProperty(globalThis, "__directCleanupOuterReturnedV1");
      const settlementProbe = Reflect.get(globalThis, "__directSettlementPublicationV1");
      if (settlementProbe?.foreign !== undefined) {
        try { const current = fstatSync(settlementProbe.foreign, { bigint: true }); if (current.dev === settlementProbe.foreignIdentity.dev && current.ino === settlementProbe.foreignIdentity.ino) closeSync(settlementProbe.foreign); }
        catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBADF")) throw error; }
      }
      if (settlementProbe?.ownedReader !== undefined) {
        try { const current = fstatSync(settlementProbe.ownedReader, { bigint: true }); if (current.dev === settlementProbe.ownedReaderIdentity.dev && current.ino === settlementProbe.ownedReaderIdentity.ino) closeSync(settlementProbe.ownedReader); }
        catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBADF")) throw error; }
      }
      Reflect.deleteProperty(globalThis, "__directSettlementPublicationV1");
      const releaseProbe = Reflect.get(globalThis, "__directReleaseBoundaryV1");
      if (releaseProbe?.fired && releaseProbe.fault.endsWith("close-before") && !releaseProbe.fixtureClosed) {
        try {
          const current = fstatSync(releaseProbe.descriptor, { bigint: true });
          if (["dev", "ino", "uid", "gid", "mode", "birthtimeNs"].every(key => String(Reflect.get(current, key)) === String(Reflect.get(releaseProbe.identity, key)))) {
            closeSync(releaseProbe.descriptor); releaseProbe.fixtureClosed = true;
          }
        } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBADF")) throw error; }
      }
      Reflect.deleteProperty(globalThis, "__directReleaseBoundaryV1");
      Reflect.deleteProperty(globalThis, "__directPinnedDescriptorsV1");
      runtime.cleanupPartialDirectReleaseFixtureV1(lease);
      await runtime.releaseDirectPreparationFixtureV1(lease);
    }
  } finally {
    // The helper records its actual spawned identity before readiness and any
    // parent assertions. Cleanup remains owned even when those assertions fail.
    if (existsSync(directChildCleanupPath)) {
      const original = parseColdFixtureExitRowV1(readFileSync(directChildCleanupPath, "utf8")), pid = Number(original.pid);
      const current = observeColdFixtureExitV1(pid);
      if (current && assertColdFixtureExitObservationV1(current, original) === "running") process.kill(pid, "SIGTERM");
      const deadline = Date.now() + 5000;
      for (let next = observeColdFixtureExitV1(pid); next && Date.now() < deadline; next = observeColdFixtureExitV1(pid)) {
        assertColdFixtureExitObservationV1(next, original);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(observeColdFixtureExitV1(pid), null);
    }
    if (targetPid !== undefined) {
      const observed = observeColdFixtureExitV1(targetPid);
      if (observed) {
        assert.ok(targetIdentity, "fixture cleanup requires the original target identity");
        if (assertColdFixtureExitObservationV1(observed, targetIdentity) === "running") {
          if (mode === "ignored") writeFileSync(path.join(fixture, "direct-owned-stop"), "owned test teardown", { mode: 0o600 });
          else process.kill(targetPid, "SIGTERM");
        }
        const deadline = Date.now() + 5000;
        for (let next = observeColdFixtureExitV1(targetPid); next && Date.now() < deadline; next = observeColdFixtureExitV1(targetPid)) {
          assertColdFixtureExitObservationV1(next, targetIdentity);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(observeColdFixtureExitV1(targetPid), null);
      }
    }
    rmSync(fixture, { recursive: true, force: true });
  }
}

test("direct controller completion requires bounded canonical bytes EOF and actual clean helper exit", async (context) => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-direct-controller-wire-"));
  try {
    const typescript = await import("typescript"), source = readFileSync(sourcePath, "utf8");
    const tree = typescript.createSourceFile(sourcePath, source, typescript.ScriptTarget.Latest, true);
    const names = ["captureDirectControllerHelperCompletionV1", "coldRecordV1", "freezeColdDataV1", "canonical", "fail"];
    const declarations = tree.statements.filter(statement => typescript.isFunctionDeclaration(statement) && statement.name && names.includes(statement.name.text));
    assert.equal(declarations.length, names.length, "actual direct controller completion capture must exist");
    let harness = declarations.map(statement => statement.getText(tree)).join("\n");
    const originalHarness = harness;
    const timer = 'setTimeout(() => finish(Error("direct helper completion timed out")), 35_000)';
    assert.equal(harness.split(timer).length - 1, 1, "shorten only the copied direct capture timeout");
    harness = harness.replace(timer, 'setTimeout(() => finish(Error("direct helper completion timed out")), 1_000)');
    const modulePath = path.join(fixture, "capture.mjs");
    writeFileSync(modulePath, typescript.transpileModule(`${harness}\nexport {captureDirectControllerHelperCompletionV1};`, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
    const isolated = await import(pathToFileURL(modulePath).href);
    const completion = { schema: "setfarm.internal-production-direct-spawner-helper-completion.v1", intentRef: "intent", intentHash: "a".repeat(64), intentIdentity: ["1"], dispatchRef: "dispatch", dispatchHash: "b".repeat(64), dispatchIdentity: ["2"], claimRef: "claim", claimHash: "c".repeat(64), claimIdentity: ["3"], journalIdentity: ["4"] };
    // This boundary decodes transport only. The independent original-history
    // observer must authenticate all content pairs and inode tuples later.
    const wire = `${canonical(completion)}\n`;
    await context.test("successful and refused capture release their production timeout", () => {
      const originalPath = path.join(fixture, "capture-original.mjs");
      writeFileSync(originalPath, typescript.transpileModule(`${originalHarness}\nexport {captureDirectControllerHelperCompletionV1};`, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
      for (const [text, code, expected] of [[wire, 0, "settled"], [wire, 7, "refused"], ["x".repeat(4097), 0, "refused"], ["", 0, "refused"], ["{}\n", 0, "refused"]] as const) {
        const consumer = `import{spawn}from'node:child_process';import{captureDirectControllerHelperCompletionV1 as capture}from ${JSON.stringify(pathToFileURL(originalPath).href)};
const child=spawn(process.execPath,['-e',${JSON.stringify(`process.stdout.on('error',()=>{});process.stdout.end(${JSON.stringify(text)});process.exitCode=${code};`)}],{stdio:['ignore','pipe','ignore']});try{await capture(child);process.stdout.write('settled')}catch{process.stdout.write('refused')}`;
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", consumer], { encoding: "utf8", timeout: 5000, maxBuffer: 4096 });
        assert.equal(result.error, undefined, "the settled consumer must exit without the 35-second capture timer");
        assert.equal(result.status, 0); assert.equal(result.signal, null); assert.equal(result.stdout, expected); assert.equal(result.stderr, "");
      }
    });
    for (const mode of ["normal", "fragmented", "eof-before-exit", "exit-before-eof", "already-closed", "empty", "truncated", "duplicate", "oversize", "extra-key", "noncanonical", "cold-schema", "invalid-utf8", "nonzero", "signal", "no-eof", "spawn-error"]) await context.test(mode, async () => {
      let text = wire;
      if (mode === "empty") text = "";
      if (mode === "truncated") text = wire.slice(0, -1);
      if (mode === "duplicate") text += wire;
      if (mode === "oversize") text = "x".repeat(4097);
      if (mode === "extra-key") text = `${canonical({ ...completion, extra: true })}\n`;
      if (mode === "noncanonical") text = ` ${wire}`;
      if (mode === "cold-schema") text = `${canonical({ ...completion, schema: "setfarm.internal-production-cold-spawner-helper-completion.v1" })}\n`;
      const bytes = mode === "invalid-utf8" ? Buffer.concat([Buffer.from(wire), Buffer.from([255])]) : Buffer.from(text);
      const script = `const bytes=Buffer.from(${JSON.stringify(bytes.toString("base64"))},'base64');
process.stdout.on('error',()=>{});
${mode === "fragmented" ? "process.stdout.write(bytes.subarray(0,13));setTimeout(()=>process.stdout.end(bytes.subarray(13)),20);" : mode === "no-eof" ? "process.stdout.write(bytes);setTimeout(()=>process.stdout.end(),1400);" : "process.stdout.end(bytes);"}
${mode === "eof-before-exit" ? "process.stdin.resume();process.stdin.on('end',()=>process.exit(0));" : mode === "nonzero" ? "process.exitCode=7;" : mode === "signal" ? "process.kill(process.pid,'SIGTERM');" : ""}`;
      const child = spawn(mode === "spawn-error" ? path.join(fixture, "absent-node") : process.execPath, ["--input-type=module", "-e", script], { stdio: ["pipe", "pipe", "ignore"] });
      const originalPipeListeners = new Map(["data", "end", "error"].map(event => [event, child.stdout.listeners(event)]));
      const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
      const exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
      if (mode === "exit-before-eof") child.stdout.pause();
      let observedBytes = 0, outcomes = 0;
      const observe = (bytes: Buffer) => { observedBytes += bytes.length; };
      child.stdout.on("data", observe);
      if (mode === "already-closed") await closed;
      const pending = isolated.captureDirectControllerHelperCompletionV1(child);
      void pending.then(() => { outcomes++; }, () => { outcomes++; });
      try {
        if (mode === "eof-before-exit") {
          await new Promise<void>(resolve => child.stdout.once("end", resolve));
          await new Promise<void>(resolve => setImmediate(resolve));
          assert.equal(outcomes, 0, "EOF cannot stand in for actual helper exit");
          child.stdin.end();
        }
        if (mode === "exit-before-eof") {
          await exited;
          assert.equal(outcomes, 0, "clean exit cannot stand in for completion EOF");
          child.stdout.resume();
        }
        if (["normal", "fragmented", "eof-before-exit", "exit-before-eof"].includes(mode)) {
          assert.deepEqual(await pending, completion);
          assert.equal(child.exitCode, 0); assert.equal(child.signalCode, null);
        } else await assert.rejects(pending, mode === "no-eof" ? /timed out/ : /direct helper completion|direct helper exit/);
        if (mode === "no-eof") assert.ok(observedBytes > 0 && observedBytes <= 4096, "timeout follows received bytes, not a slow child start");
        await closed;
        assert.equal(outcomes, 1, "late real EOF/exit cannot replace the settled outcome");
        child.stdout.removeListener("data", observe);
        for (const event of ["data", "end", "error"]) assert.deepEqual(child.stdout.listeners(event).filter(listener => !originalPipeListeners.get(event)!.includes(listener)), [], `completion pipe ${event} adds no retained listener`);
        assert.equal(child.listenerCount("error"), 0, "completion child error cleanup");
      } finally {
        if (child.pid && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
        child.stdin.destroy(); child.stdout.destroy();
        await closed;
      }
    });
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test("shared historical launch profile and direct intent do not import cold permission", () => exerciseDirectRebindFixtureV1("response-loss"));
test("direct termination refuses output drift after its dispatch publication", () => exerciseDirectRebindFixtureV1("profile-drift"));
test("direct helper frame refuses same-byte replacement of every original authority file", async () => {
  for (const mode of ["frame-intent-replace", "frame-dispatch-replace", "frame-receipt-replace"]) await exerciseDirectRebindFixtureV1(mode);
});
test("real direct helper authenticates original termination before configuration without cold permission", () => exerciseDirectRebindFixtureV1("direct-helper"));
test("real direct helper publishes one original spawn dispatch and consumes one child handoff", () => exerciseDirectRebindFixtureV1("direct-helper", "none"));
test("real direct child separates inherited configuration from original startup admission", () => exerciseDirectRebindFixtureV1("direct-helper", "child-none"));
test("real direct main publishes one owned claim and remains sealed after helper departure", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main"));
test("actual fixed direct helper authenticates one real sealed child claim and exits", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-helper"));
test("actual direct controller retains one fixed helper through concurrent calls and response loss", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller"));
test("actual direct controller independently binds the original detached child claim", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-observe"));
test("actual direct controller durably settles the original claim and two service observations", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle"));
test("complete direct terminal history permits original and later ordinary lock cleanup without effects", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-cleanup"));
test("ordinary lock release refuses direct history replaced after the outer helper await", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-cleanup-outer-claim"));
for (const member of ["intent", "termination-dispatch", "termination-receipt", "spawn-dispatch", "claim", "settlement", "directory", "intent-temp", "settlement-temp"]) {
  test(`direct cleanup refuses post-await ${member} history replacement`, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-settle-cleanup-${member}`));
}
test("direct controller terminal release removes only its owned physical lock and preserves history", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-release"));
test("direct controller terminal release reconciles an unlinked original after stat response loss without touching a later owner", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-release-unlink-stat"));
test("direct controller terminal release refuses an epoch descriptor reused during historical resolution", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-release-epoch-reuse"));
test("direct controller terminal release accepts history after child departure and current epoch replacement", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-release-history-only"));
for (const boundary of ["parent-sync", "parent-close", "lock-close", "reader-close", "epoch-close"]) {
  for (const effect of ["before", "after"]) test(`direct controller terminal release retains ${boundary}-${effect} cleanup ownership`, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-settle-release-${boundary}-${effect}`));
}
test("fresh direct terminal history authenticates after the original child departs without effects", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-history"));
test("fresh direct terminal history refuses replaced original records P3 and awaited journal churn", async (context) => {
  for (const fault of ["intent", "termination-dispatch", "termination-receipt", "spawn-dispatch", "claim", "p3", "await-aba"]) await context.test(fault, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-settle-history-${fault}`));
});
test("fresh direct terminal history drains interrupted original readers before another acquisition", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-settle-history-close"));
test("direct controller settlement refuses original writer replacement and late sibling appearance", async (context) => {
  for (const fault of ["writer-replace", "reader-replace", "late-sibling"]) await context.test(fault, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-settle-${fault}`));
});
test("direct controller settlement retains publication ownership through syscall and census faults", async (context) => {
  for (const fault of ["write-before", "partial-write", "write-after", "sync-before", "sync-after", "link-before", "link-after", "close-before", "close-after", "parent-before", "parent-after", "unlink-before", "unlink-after", "census-first", "census-second"]) {
    await context.test(fault, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-settle-${fault}`));
  }
});
test("direct controller claim observation refuses replaced history startup files and original P3", async (context) => {
  for (const fault of ["claim-replace", "dispatch-replace", "pid-replace", "journal-aba", "runtime-parent", "p3", "late-pid", "late-parent", "intent-replace", "termination-replace"]) await context.test(fault, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-observe-${fault}`));
});
test("direct controller observed claim replay preserves the original history readers", async (context) => {
  for (const fault of ["replay-claim", "replay-dispatch"]) await context.test(fault, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-observe-${fault}`));
});
test("direct controller refuses journal ABA at its final pre-spawn boundary", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-controller-journal-aba"));
test("direct controller retains its fence through original intent replacement and failed helper transport", async (context) => {
  for (const fault of ["intent-replace", "spawn-error", "helper-failure"]) await context.test(fault, () => exerciseDirectRebindFixtureV1("direct-helper", `child-main-controller-${fault}`));
});
test("actual direct helper refuses replacement of the original startup parent", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-helper-runtime-parent"));
test("actual direct helper refuses late startup inode replacement during output verification", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-helper-late-pid"));
test("actual direct helper refuses late startup parent replacement during output verification", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-helper-late-parent"));
test("actual direct helper bounds readiness and original claim adoption without redispatch", async () => {
  for (const fault of ["fragmented", "empty", "truncated", "oversize", "duplicate", "extra-key", "noncanonical", "cold-schema", "crossed-hash", "journal-aba", "claim-replace", "startup-pid", "child-pid", "spawn-error", "second", "mixed", "invalid-selector", "missing-selector"]) {
    await exerciseDirectRebindFixtureV1("direct-helper", `child-main-helper-${fault}`);
  }
});
test("actual direct helper retains uncertainty on missing EOF child exit and cleanup failure", async () => {
  for (const fault of ["no-eof", "child-exit", "cleanup-close"]) await exerciseDirectRebindFixtureV1("direct-helper", `child-main-helper-${fault}`);
});
test("direct main refuses invalid readiness without retaining configuration authority", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-readiness"));
test("direct claim refuses root churn before publication", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-root"));
test("direct claim refuses writer reuse before publication", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-writer"));
test("direct main refuses independent P3 drift before startup files", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-p3"));
test("direct main stops during admission without startup files", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-stop-admission"));
test("direct main stops during claim admission without publication", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-stop-claim"));
test("direct main preserves foreign PID residue without cold permission", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-foreign-pid"));
test("direct main concurrent claims cannot publish or revive admission", () => exerciseDirectRebindFixtureV1("direct-helper", "child-main-concurrent"));
test("refused direct child admission never falls back to ordinary configuration", () => exerciseDirectRebindFixtureV1("direct-helper", "child-early-ordinary"));
test("direct child original startup admission refuses crossed evidence and in-flight revocation", async () => {
  for (const fault of ["child-p3", "child-token", "child-late-intent", "child-concurrent", "child-revoked-await"]) await exerciseDirectRebindFixtureV1("direct-helper", fault);
});
test("direct child transport refuses original descriptor reuse before secret write", async () => {
  for (const fault of ["secret-fd-reuse", "secret-reader-reuse"]) await exerciseDirectRebindFixtureV1("direct-helper", fault);
});
test("direct helper dispatch refuses transient root churn before its final pin", () => exerciseDirectRebindFixtureV1("direct-helper", "root-churn"));
test("direct helper spawn publication and handoff retain uncertain ownership without retry", async () => {
  for (const fault of ["collision", "short-write", "file-sync", "parent-sync", "writer-close", "close-response", "close-reuse", "same-inode-close", "late-frame", "foreign-scratch", "second-publish", "dispatch-swap", "termination-swap", "late-output"]) await exerciseDirectRebindFixtureV1("direct-helper", fault);
});
test("direct termination retains its fence when the actual predecessor ignores SIGTERM", () => exerciseDirectRebindFixtureV1("ignored"));
test("direct termination refuses uncertain dispatch and receipt publications without redispatch", async () => {
  await exerciseDirectRebindFixtureV1("dispatch-write");
  await exerciseDirectRebindFixtureV1("receipt-write");
  await exerciseDirectRebindFixtureV1("signal-before");
});

async function createColdHelperAuthenticationFixtureV1(helperSourceTransform?: (source: string) => string, runnerSetup = "", configureProfile?: (profile: any, root: string) => void,
  configureCompiled?: (root: string, profile: any, compileRepositoryModule: (relative: string, transform?: (source: string) => string) => void) => void, deferControllerPreparation = false) {
  assert.ok(readFileSync(sourcePath, "utf8").includes("async function authenticateColdSpawnerHelperIntentV1()"), "independent cold helper authentication is not implemented");
  const fixture = await createColdFrameFixtureV1();
  const profile = Reflect.get(globalThis, "__coldIntentProfile");
  profile.profile.executable = { path: process.execPath };
  configureProfile?.(profile, fixture.fixture);
  profile.profile.environmentHash = sha256(`setfarm.internal-production-spawner-launch-environment-candidate.v1\n${canonical(profile.environment)}`);
  delete profile.profile.profileHash;
  profile.profile.profileHash = sha256(canonical(profile.profile));
  const typescript = await import("typescript");
  const dist = path.join(fixture.fixture, "dist/internal-production");
  mkdirSync(dist, { recursive: true, mode: 0o700 });
  const compiled = new Set<string>();
  const compile = (relative: string, source: string) => {
    compiled.add(relative);
    const target = path.join(fixture.fixture, "dist", relative.replace(/\.ts$/, ".js"));
    mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
  };
  const compileRepositoryModule = (relative: string, transform?: (source: string) => string): void => {
    if (compiled.has(relative)) return;
    assert.ok(compiled.size < 128, "runtime fixture static graph is bounded");
    const original = readFileSync(path.resolve(import.meta.dirname, "../../src", relative), "utf8");
    const source = transform ? transform(original) : original;
    compile(relative, source);
    const tree = typescript.createSourceFile(relative, source, typescript.ScriptTarget.Latest, true);
    for (const statement of tree.statements) {
      if (!typescript.isImportDeclaration(statement) || statement.importClause?.isTypeOnly || !typescript.isStringLiteral(statement.moduleSpecifier)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!statement.importClause?.name && bindings && typescript.isNamedImports(bindings) && bindings.elements.every((element) => element.isTypeOnly)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (specifier.startsWith(".")) compileRepositoryModule(path.normalize(path.join(path.dirname(relative), specifier.replace(/\.js$/, ".ts"))));
    }
  };
  for (const relative of ["internal-production/baseline-workspace-authority-path-v1.ts", "findings/legacy-finding-publication-inventory-v1.ts", "product-compiler/canonical-json.ts"]) compile(relative, readFileSync(path.join(fixture.fixture, "src", relative), "utf8"));
  compile("internal-production/baseline-spawner-launch-environment-v1.ts", readFileSync(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-spawner-launch-environment-v1.ts"), "utf8"));
  const helperSource = readFileSync(sourcePath, "utf8");
  compile("internal-production/baseline-restart-authority-retirement-v1.ts", (helperSourceTransform ? helperSourceTransform(helperSource) : helperSource) + "\nexport { authenticateColdSpawnerHelperIntentV1 };\n");
  const runner = path.join(dist, "baseline-service-restart-helper-v1.js");
  writeFileSync(runner, `
import {fstatSync} from 'node:fs';
import {authenticateColdSpawnerHelperIntentV1,observeInternalProductionColdSpawnerBootstrapJournalCensusV1} from './baseline-restart-authority-retirement-v1.js';
${runnerSetup}
let authenticated,result;
try {
  authenticated=await authenticateColdSpawnerHelperIntentV1();
  authenticated.assertStable();
  let publicRefuses=false;try{observeInternalProductionColdSpawnerBootstrapJournalCensusV1();}catch(error){publicRefuses=error.message.includes('COLD_BOOTSTRAP_UNSETTLED');}
  result={accepted:true,intentHash:authenticated.intent.intentHash,publicRefuses,secretEnumerated:JSON.stringify(authenticated).includes('never-persist-cold-snapshot')};
} catch(error) {result={accepted:false,message:error.message};}
finally {authenticated?.close(); if(fstatSync(4).nlink!==1||fstatSync(5).nlink!==1)process.exitCode=2;}
process.stdout.write(JSON.stringify({...result,diagnostic:globalThis.__coldHelperDiagnostic?.()}));
`);
  const observer = (body = "") => writeFileSync(path.join(dist, "baseline-post-handoff-receipt-v1.js"), `import {readFileSync,writeFileSync,renameSync,mkdirSync,unlinkSync,readdirSync} from 'node:fs';\nexport async function observeInternalProductionSpawnerLaunchProfileCandidateV1(){${body};return ${JSON.stringify(profile)}}\n`);
  if (configureCompiled) {
    configureCompiled(fixture.fixture, profile, compileRepositoryModule);
    profile.profile.environmentHash = sha256(`setfarm.internal-production-spawner-launch-environment-candidate.v1\n${canonical(profile.environment)}`);
    delete profile.profile.profileHash;
    profile.profile.profileHash = sha256(canonical(profile.profile));
    writeFileSync(path.join(fixture.fixture, "cold-child-fixture-profile.json"), JSON.stringify({ ...profile, coldObservation: Reflect.get(globalThis, "__coldGenesisObservation") }), { mode: 0o600 });
  } else observer();
  const intent = deferControllerPreparation ? null : await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
  const installRealPhaseReader = () => {
    assert.ok(intent, "phase reader fixture requires prepared authority");
    // Keep filesystem/ownership checks real; only the independently tested clean-source
    // observation is controlled, since this isolated tree is not a built Git checkout.
    const original = readFileSync(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-post-handoff-receipt-v1.ts"), "utf8");
    const tree = typescript.createSourceFile("receipt.ts", original, typescript.ScriptTarget.Latest, true);
    const names = new Set(["canonicalComparable", "strictUtf8", "directorySnapshot", "sameDirectory", "assertDirectory", "sameRegularMetadata", "readStableRegular", "fail", "currentEntryFail", "isEnoent", "recursivelyFreeze", "requireAbsentPhasePathV1", "requireAbsentProducerLiteralV1", "assertPhaseSourceEqualV1", "observePhaseClosedZeroV1"]);
    const declarations = tree.statements.filter((statement) => typescript.isFunctionDeclaration(statement) && statement.name && names.has(statement.name.text));
    assert.equal(declarations.length, names.size);
    const constantsSource = tree.statements.filter((statement) => typescript.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => typescript.isIdentifier(declaration.name) && ["PHASE_CLOSED_FUTURE_PRODUCERS_V1", "MAX_BUILD_FILE_BYTES_V1", "UTF8"].includes(declaration.name.text)));
    assert.equal(constantsSource.length, 3);
    compile("internal-production/baseline-post-handoff-receipt-v1.ts", readFileSync(path.join(dist, "baseline-post-handoff-receipt-v1.js"), "utf8") + `
import {closeSync,constants,fstatSync,lstatSync,openSync,realpathSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {TextDecoder} from 'node:util';
const fixedRepositoryRoot=()=>${JSON.stringify(fixture.fixture)};
const observeCurrentInternalProductionCleanSetfarmSourceBuildV1=()=>{globalThis.__phaseSourceHook?.();return ${JSON.stringify(intent.coldObservation.source)}};
${[...constantsSource, ...declarations].map((statement) => statement.getText(tree)).join("\n")}
export {observePhaseClosedZeroV1};
`);
  };
  const handles = deferControllerPreparation ? null : fixture.isolated.openColdFrameFixtureV1();
  const state = deferControllerPreparation ? null : fixture.isolated.inspectColdIntentFixtureV1();
  const run = (overrides: { frame?: number; lock?: number; intent?: number; entry?: string; coldMode?: string; extraEnvironment?: Record<string, string>; realCold?: boolean; expectedRefusal?: boolean; label?: string } = {}) => {
    assert.ok(handles && state, "direct helper fixture requires prepared controller handles");
    const child = spawnSync(process.execPath, [overrides.entry ?? runner], { cwd: fixture.fixture, encoding: "utf8", timeout: 15000, maxBuffer: 65536,
      stdio: ["ignore", "pipe", "pipe", overrides.frame ?? handles.frameDescriptor, overrides.lock ?? state.descriptor, overrides.intent ?? handles.intentDescriptor],
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", ...(overrides.coldMode === undefined ? {} : { SETFARM_INTERNAL_PRODUCTION_COLD_HELPER: overrides.coldMode }), ...overrides.extraEnvironment } });
    if (overrides.expectedRefusal) {
      assert.equal(child.status, 1, `${overrides.label}: the actual helper must refuse a crossed transport`);
      assert.equal(child.signal, null); assert.equal(child.error, undefined);
      assert.equal(child.stdout, ""); assert.ok(!child.stderr.includes("never-persist-cold-snapshot"));
      return { accepted: false, message: child.stderr };
    }
    const claimError = path.join(fixture.fixture, "fixture-claim-error");
    assert.equal(child.status, 0, `${overrides.label ?? "helper"}: ${child.stderr} ${existsSync(claimError) ? readFileSync(claimError, "utf8") : ""}`);
    assert.ok(!child.stdout.includes("never-persist-cold-snapshot"));
    assert.ok(!child.stderr.includes("never-persist-cold-snapshot"));
    assert.equal(child.stderr, "");
    if (overrides.realCold) {
      assert.ok(Buffer.byteLength(child.stdout) > 0 && Buffer.byteLength(child.stdout) <= 4096, "the real fixed helper must return bounded origin-bound completion evidence");
      const completion = JSON.parse(child.stdout);
      assert.equal(child.stdout, `${canonical(completion)}\n`);
      assert.equal(completion.schema, "setfarm.internal-production-cold-spawner-helper-completion.v1");
      for (const [name, key] of [["intent", "intentIdentity"], ["dispatch", "dispatchIdentity"], ["claim", "claimIdentity"], [null, "journalIdentity"]] as const) {
        const stats = lstatSync(path.join(fixture.root, "cold-spawner-bootstrap-v1", name ? `${name}.json` : ""), { bigint: true });
        assert.deepEqual(completion[key], [stats.dev, stats.ino, stats.uid, stats.gid, stats.mode, stats.nlink, stats.size, stats.birthtimeNs, stats.mtimeNs, stats.ctimeNs].map(String));
      }
      const claim = JSON.parse(readFileSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/claim.json"), "utf8"));
      for (const stem of ["intent", "dispatch", "claim"]) for (const suffix of ["Ref", "Hash"]) assert.equal(completion[`${stem}${suffix}`], claim[`${stem}${suffix}`]);
      return { accepted: true, childPid: claim.child.pid, claim };
    }
    return JSON.parse(child.stdout);
  };
  return { ...fixture, intent, handles, state, runner, observer, run, compileRepositoryModule, installRealPhaseReader, profile, close: () => {
    if (handles) { closeSync(handles.frameDescriptor); closeSync(handles.intentDescriptor); }
    fixture.isolated.closeColdIntentFixtureV1(); Reflect.deleteProperty(globalThis, "__coldIntentProfile"); fixture.cleanup();
  } };
}

test("cold helper independently authenticates inherited intent without journal or process effects", async () => {
  const fixture = await createColdHelperAuthenticationFixtureV1();
  try {
    const before = coldGenesisTreeSnapshotV1(fixture.root);
    const result = fixture.run();
    assert.equal(result.accepted, true, result.message);
    assert.equal(result.intentHash, fixture.intent.intentHash);
    assert.equal(result.publicRefuses, true);
    assert.equal(result.secretEnumerated, false);
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before);
    assert.equal(fixture.isolated.inspectColdIntentFixtureV1().phase, "intent-only");
  } finally { fixture.close(); }
});

test("authenticated helper configuration skips dotenv and retains its exact effective snapshot", async () => {
  assert.ok(readFileSync(sourcePath, "utf8").includes("async function acquireColdSpawnerHelperContextV1()"), "cold helper context issuer is not implemented");
  const fixture = await createColdHelperAuthenticationFixtureV1((source) => source + "\nexport { acquireColdSpawnerHelperContextV1 };\n", "", (profile, root) => {
    profile.profile.home = homedir();
    profile.environment = { HOME: homedir(), PATH: "/usr/bin:/bin:/custom/bin", LANG: "C", LC_ALL: "C", SETFARM_ENV_DIR: path.join(root, "runtime-env"),
      SETFARM_REPO_DIR: root, SETFARM_PG_URL: "postgresql://fixture@127.0.0.1:1/disposable", SETFARM_DIR: path.join(root, "runtime"), FIXTURE_SECRET: "never-persist-cold-snapshot" };
  });
  try {
    fixture.compileRepositoryModule("runtime-config.ts", (source) => source.replace('import { existsSync, readFileSync } from "node:fs";', `import { existsSync as actualExistsSync, readFileSync as actualReadFileSync } from "node:fs";
function existsSync(target:any){if(/\\.env(?:\\.local)?$/.test(String(target)))throw Error('unexpected dotenv existence read');return actualExistsSync(target)}
function readFileSync(target:any,...args:any[]){if(/\\.env(?:\\.local)?$/.test(String(target)))throw Error('unexpected dotenv content read');return actualReadFileSync(target,...args)}`));
    symlinkSync(path.resolve(import.meta.dirname, "../../node_modules"), path.join(fixture.fixture, "node_modules"), "dir");
    const configDir = fixture.profile.environment.SETFARM_ENV_DIR;
    mkdirSync(configDir, { mode: 0o700 });
    writeFileSync(path.join(configDir, ".env.local"), "UNBOUND_NEW_KEY=must-not-load\nFIXTURE_SECRET=crossed\n", { mode: 0o600 });
    fixture.observer("if(globalThis.__contextFault==='post-profile'&&(globalThis.__profileCalls=(globalThis.__profileCalls??0)+1)===2)throw Error('fixture post-bracket profile refusal')");
    const receipt = path.join(path.dirname(fixture.runner), "baseline-post-handoff-receipt-v1.js");
    writeFileSync(receipt, readFileSync(receipt, "utf8") + `
import {observeInternalProductionColdSpawnerHelperIntentPhaseV1} from './baseline-restart-authority-retirement-v1.js';
export async function observeInternalProductionColdSpawnerHelperBootstrapObservationV1(context){
  globalThis.__issuedContext=context;
  if(globalThis.__contextFault==='closed-refresh'){let calls=0;globalThis.__phaseSourceHook=()=>{if(++calls===2)context.close()};}
  observeInternalProductionColdSpawnerHelperIntentPhaseV1(context);
  const phaseContext=globalThis.__contextFault==='cloned-context'?{...context}:globalThis.__contextFault==='public-phase'?undefined:context;
  const phase=await observePhaseClosedZeroV1(${JSON.stringify(fixture.intent.coldObservation.source)},phaseContext).catch(error=>{globalThis.__phaseFailure=error.message;throw error});
  if(Object.keys(phase).length!==18||Object.values(phase).some(value=>value!==0))throw Error('phase did not prove zero');
  if(globalThis.__contextFault==='bracket-refusal')throw Error('fixture bracket refusal');
  const {runtimeConfig,loadRuntimeEnv}=await import('../runtime-config.js');
  globalThis.__coldConfigurationProbe={urlMatches:runtimeConfig.setfarmPgUrl===${JSON.stringify(fixture.profile.environment.SETFARM_PG_URL)},dirMatches:runtimeConfig.setfarmDir===${JSON.stringify(fixture.profile.environment.SETFARM_DIR)},secretMatches:process.env.FIXTURE_SECRET==='never-persist-cold-snapshot',newKeyAbsent:process.env.UNBOUND_NEW_KEY===undefined,path:process.env.PATH};
  writeFileSync(${JSON.stringify(path.join(configDir, ".env.local"))},'ANOTHER_NEW_KEY=must-not-load\\n');loadRuntimeEnv();
  if(process.env.ANOTHER_NEW_KEY!==undefined)throw Error('dotenv introduced an unbound key');
  if(process.env.PATH!==globalThis.__coldConfigurationProbe.path)throw Error('effective PATH drift');
  observeInternalProductionColdSpawnerHelperIntentPhaseV1(context);
  return ${JSON.stringify(fixture.intent.coldObservation)};
}
`);
    fixture.installRealPhaseReader();
    writeFileSync(fixture.runner, `
import assert from 'node:assert/strict';import {fstatSync} from 'node:fs';
import {acquireColdSpawnerHelperContextV1,observeInternalProductionColdSpawnerHelperIntentPhaseV1,observeInternalProductionColdSpawnerBootstrapJournalCensusV1,resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1,resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1} from './baseline-restart-authority-retirement-v1.js';
let context;
try{
  context=await acquireColdSpawnerHelperContextV1();
  assert.throws(()=>observeInternalProductionColdSpawnerHelperIntentPhaseV1(context),/not refreshing/);
  assert.throws(()=>observeInternalProductionColdSpawnerHelperIntentPhaseV1({...context}));
  assert.throws(()=>observeInternalProductionColdSpawnerBootstrapJournalCensusV1(),/COLD_BOOTSTRAP_UNSETTLED/);
  const {loadRuntimeEnv}=await import('../runtime-config.js');
  const shared=resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1();
  assert.equal(shared.role,'cold-helper');assert.deepEqual(Object.keys(shared),['schema','role']);
  assert.equal(shared.environment.FIXTURE_SECRET,'never-persist-cold-snapshot');assert.equal(JSON.stringify(shared).includes('never-persist'),false);
  if(globalThis.__selectorEntryFault){
    const entry=process.argv[1];process.argv[1]=entry+'.foreign';
    assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),/entry changed/);process.argv[1]=entry;
    assert.throws(()=>resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1(),/snapshot is unavailable/);
    assert.throws(()=>observeInternalProductionColdSpawnerHelperIntentPhaseV1(context),/foreign, cloned or closed/);
    process.stdout.write(JSON.stringify({accepted:true,selectorRevoked:true}));context.close();process.exit(0);
  }
  loadRuntimeEnv();process.env.UNEXPECTED='drift';assert.throws(()=>loadRuntimeEnv());delete process.env.UNEXPECTED;
  const probe=globalThis.__coldConfigurationProbe;
  assert.ok(probe.urlMatches&&probe.dirMatches&&probe.secretMatches&&probe.newKeyAbsent);
  assert.equal(probe.path,${JSON.stringify([path.dirname(process.execPath), path.join(homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin", "/custom/bin"].filter((entry, index, values) => values.indexOf(entry) === index).join(path.delimiter))});
  context.close();assert.throws(()=>observeInternalProductionColdSpawnerHelperIntentPhaseV1(context));assert.throws(()=>loadRuntimeEnv());
  assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);process.stdout.write(JSON.stringify({accepted:true}));
}catch(error){
  const {resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1}=await import('./baseline-restart-authority-retirement-v1.js');
  assert.throws(()=>resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1());
  if(globalThis.__issuedContext)assert.throws(()=>observeInternalProductionColdSpawnerHelperIntentPhaseV1(globalThis.__issuedContext));
  assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);
  process.stdout.write(JSON.stringify({accepted:false,message:error.message,phaseFailure:globalThis.__phaseFailure,revoked:true}));
}finally{context?.close();}
`);
    const before = coldGenesisTreeSnapshotV1(fixture.root);
    const result = fixture.run({ coldMode: "1" });
    assert.equal(result.accepted, true, JSON.stringify(result));
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before);
    const validRunner = readFileSync(fixture.runner);
    writeFileSync(fixture.runner, `globalThis.__selectorEntryFault=true;\n${validRunner.toString("utf8")}`);
    const selectorRefused = fixture.run({ coldMode: "1" });
    assert.equal(selectorRefused.selectorRevoked, true, JSON.stringify(selectorRefused));
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before);
    writeFileSync(fixture.runner, validRunner);
    for (const marker of ["SETFARM_INTERNAL_PRODUCTION_DIRECT_HELPER", "SETFARM_INTERNAL_PRODUCTION_DIRECT_CHILD", "SETFARM_INTERNAL_PRODUCTION_COLD_CHILD", "SETFARM_INTERNAL_PRODUCTION_UNKNOWN"]) {
      const mixed = fixture.run({ coldMode: "1", extraEnvironment: { [marker]: "1" } });
      assert.equal(mixed.accepted, false, `authenticated cold helper must refuse mixed role ${marker}`);
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before);
    }
    for (const fault of ["cloned-context", "public-phase", "closed-refresh", "bracket-refusal", "post-profile"]) {
      writeFileSync(fixture.runner, `globalThis.__contextFault=${JSON.stringify(fault)};\n${validRunner.toString("utf8")}`);
      const refused = fixture.run({ coldMode: "1" });
      assert.equal(refused.accepted, false, fault);
      assert.equal(refused.revoked, true, fault);
      assert.match(refused.message, /cold helper context refresh failed/, fault);
      if (fault === "public-phase") assert.match(refused.phaseFailure, /COLD_BOOTSTRAP_UNSETTLED/, "own intent never becomes public zero authority");
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before);
    }
    writeFileSync(fixture.runner, validRunner);
    const authorityRoot = path.join(fixture.profile.environment.SETFARM_DIR, "internal-production");
    mkdirSync(path.dirname(authorityRoot), { recursive: true, mode: 0o700 });
    for (const kind of ["directory", "dangling-symlink"] as const) {
      if (kind === "directory") mkdirSync(authorityRoot, { mode: 0o700 });
      else symlinkSync(path.join(fixture.fixture, "absent-authority"), authorityRoot);
      try {
        const refused = fixture.run({ coldMode: "1" });
        assert.equal(refused.accepted, false, kind);
        assert.equal(refused.revoked, true);
        assert.match(refused.phaseFailure, /future producer authority root is present/);
      } finally { rmSync(authorityRoot, { recursive: kind === "directory" }); }
    }
    for (const coldMode of [undefined, "invalid"]) {
      const refused = fixture.run({ coldMode });
      assert.equal(refused.accepted, false, "missing or malformed selector cannot authorize configuration");
      assert.match(refused.message, /cold helper context refresh failed/);
    }
    writeFileSync(fixture.runner, `try{await import('../runtime-config.js');process.stdout.write(JSON.stringify({accepted:true}))}catch(error){process.stdout.write(JSON.stringify({accepted:false,message:error.message}))}`);
    for (const coldMode of ["1", undefined]) {
      const unauthenticated = fixture.run({ coldMode });
      assert.equal(unauthenticated.accepted, false);
      assert.equal(unauthenticated.message, "INTERNAL_PRODUCTION_INHERITED_RUNTIME_CONFIGURATION_INVALID", "the exact helper entry refuses before dotenv or defaults even without a selector");
    }
    writeFileSync(fixture.runner, validRunner);
  } finally { fixture.close(); }
});

test("cold helper publishes one exclusive dispatch and never converts replay into launch permission", async () => {
  assert.ok(readFileSync(sourcePath, "utf8").includes("function publishColdSpawnerHelperDispatchV1("), "exclusive cold dispatch is not implemented");
  assert.ok(readFileSync(sourcePath, "utf8").includes("function parseColdSpawnerBootstrapDispatchV1("), "shared dispatch validation is not implemented");
  const fixture = await createColdHelperAuthenticationFixtureV1((source) => source.replace('  } catch {\n    state.phase = "closing";', '  } catch (error) {\n    globalThis.__dispatchFailure=error.message;\n    state.phase = "closing";') + "\nexport { acquireColdSpawnerHelperContextV1, publishColdSpawnerHelperDispatchV1, parseColdSpawnerBootstrapDispatchV1, parseColdSpawnerBootstrapIntentV1 };\n");
  try {
    const receipt = path.join(path.dirname(fixture.runner), "baseline-post-handoff-receipt-v1.js");
    writeFileSync(receipt, readFileSync(receipt, "utf8") + `
import {observeInternalProductionColdSpawnerHelperIntentPhaseV1} from './baseline-restart-authority-retirement-v1.js';
export async function observeInternalProductionColdSpawnerHelperBootstrapObservationV1(context){
  observeInternalProductionColdSpawnerHelperIntentPhaseV1(context);return ${JSON.stringify(fixture.intent.coldObservation)};
}
`);
    const dispatchPath = path.join(fixture.root, "cold-spawner-bootstrap-v1/dispatch.json");
    writeFileSync(fixture.runner, `
import assert from 'node:assert/strict';import {readFileSync,lstatSync,fstatSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {acquireColdSpawnerHelperContextV1,publishColdSpawnerHelperDispatchV1,observeInternalProductionColdSpawnerHelperIntentPhaseV1,observeInternalProductionColdSpawnerBootstrapJournalCensusV1,resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1,parseColdSpawnerBootstrapDispatchV1,parseColdSpawnerBootstrapIntentV1} from './baseline-restart-authority-retirement-v1.js';
let context;
try{
  context=await acquireColdSpawnerHelperContextV1();
  assert.throws(()=>publishColdSpawnerHelperDispatchV1({...context}));
  const dispatch=publishColdSpawnerHelperDispatchV1(context);
  assert.equal(dispatch.schema,'setfarm.internal-production-cold-spawner-bootstrap-dispatch.v1');
  assert.equal(dispatch.intentHash,${JSON.stringify(fixture.intent.intentHash)});
  assert.equal(dispatch.observationHash,${JSON.stringify(fixture.intent.coldObservation.observationHash)});
  assert.equal(dispatch.helper.pid,process.pid);assert.equal(dispatch.controller.pid,process.ppid);
  assert.equal(dispatch.maximumDispatchCount,1);
  const bytes=readFileSync(${JSON.stringify(dispatchPath)}),stats=lstatSync(${JSON.stringify(dispatchPath)},{bigint:true});
  assert.equal(stats.nlink,1n);assert.equal(stats.mode&0o7777n,0o600n);
  assert.deepEqual(JSON.parse(bytes),dispatch);
  const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
  const intent=parseColdSpawnerBootstrapIntentV1(readFileSync(5));
  const intentStats=fstatSync(5,{bigint:true}),intentIdentity={devDecimal:String(intentStats.dev),inoDecimal:String(intentStats.ino)};
  assert.deepEqual(parseColdSpawnerBootstrapDispatchV1(bytes,intent,intentIdentity),dispatch);
  assert.throws(()=>parseColdSpawnerBootstrapDispatchV1(Buffer.concat([bytes,Buffer.from(' ')]),intent,intentIdentity));
  for(const mutate of [
    d=>d.schema='foreign',d=>d.extra=true,d=>delete d.action,d=>d.maximumDispatchCount=2,
    d=>d.intentHash='0'.repeat(64),d=>d.observationHash='0'.repeat(64),d=>d.profileHash='0'.repeat(64),
    d=>d.source.buildHash='0'.repeat(64),d=>d.epochRef='foreign',d=>d.genesisHash='0'.repeat(64),d=>d.nonceHash='0'.repeat(64),
    d=>d.lockIdentity.inoDecimal='1',d=>d.intentIdentity.inoDecimal='1',d=>d.controller.pid+=1,
    d=>d.helper.pid=0,d=>d.helper.uid+=1,d=>d.helper.ppid+=1,d=>d.helper.command+=' --foreign',d=>d.helper.processIdentityHash='0'.repeat(64),
    d=>d.action.detached=false,d=>d.action.arguments.push('--foreign'),d=>d.action.cwd='/foreign',d=>d.action.executable='/foreign'
  ]){
    const crossed=structuredClone(dispatch);mutate(crossed);delete crossed.dispatchRef;delete crossed.dispatchHash;
    crossed.dispatchHash=hash(crossed);crossed.dispatchRef='setfarm://internal-production/cold-spawner-bootstrap-dispatch/sha256/'+crossed.dispatchHash;
    assert.throws(()=>parseColdSpawnerBootstrapDispatchV1(Buffer.from(canonical(crossed)+'\\n'),intent,intentIdentity));
  }
  assert.deepEqual(readdirSync(${JSON.stringify(path.dirname(dispatchPath))}).sort(),['dispatch.json','intent.json']);
  assert.throws(()=>publishColdSpawnerHelperDispatchV1(context),/dispatch/);
  assert.ok(readFileSync(${JSON.stringify(dispatchPath)}).equals(bytes));
  assert.equal(lstatSync(${JSON.stringify(dispatchPath)},{bigint:true}).ino,stats.ino);
  assert.throws(()=>observeInternalProductionColdSpawnerHelperIntentPhaseV1(context));
  assert.throws(()=>observeInternalProductionColdSpawnerBootstrapJournalCensusV1(),/COLD_BOOTSTRAP_UNSETTLED/);
  assert.ok(resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1());
  context.close();assert.throws(()=>publishColdSpawnerHelperDispatchV1(context));
  assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);
  process.stdout.write(JSON.stringify({accepted:true,dispatch}));
}catch(error){process.stdout.write(JSON.stringify({accepted:false,message:error.message,failure:globalThis.__dispatchFailure}));}finally{context?.close();}
`);
    const before = coldGenesisTreeSnapshotV1(fixture.root).filter((entry: any) => entry.relative !== "cold-spawner-bootstrap-v1");
    const result = fixture.run();
    assert.equal(result.accepted, true, JSON.stringify(result));
    const { dispatchRef, dispatchHash, ...body } = result.dispatch;
    assert.equal(dispatchHash, sha256(canonical(body)));
    assert.equal(dispatchRef, `setfarm://internal-production/cold-spawner-bootstrap-dispatch/sha256/${dispatchHash}`);
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root).filter((entry: any) => !["cold-spawner-bootstrap-v1", "cold-spawner-bootstrap-v1/dispatch.json"].includes(entry.relative)), before);
    const retained = readFileSync(dispatchPath);
    const replay = fixture.run();
    assert.equal(replay.accepted, false, "a fresh helper must not adopt an existing dispatch as launch permission");
    assert.ok(readFileSync(dispatchPath).equals(retained));
  } finally { fixture.close(); }
});

test("cold dispatch publication faults preserve the fence and revoke every retry", async () => {
  for (const fault of ["child-secret-writer-reuse", "child-secret-reader-reuse", "child-frame-close-response", "collision", "short-write", "file-sync", "directory-sync", "parent-close", "extra-member", "replace-dispatch", "root-swap", "writer-close", "persistent-close", "child-frame-replace-before-unlink"]) {
    const fixture = await createColdHelperAuthenticationFixtureV1((source) => source
      .replace("  openSync,", "  openSync as actualOpenSync,").replace("  closeSync,", "  closeSync as actualCloseSync,")
      .replace("  writeFileSync,", "  writeFileSync as actualWriteFileSync,").replace("  fsyncSync,", "  fsyncSync as actualFsyncSync,").replace("  fstatSync,", "  fstatSync as actualFstatSync,") + `
export {acquireColdSpawnerHelperContextV1,publishColdSpawnerHelperDispatchV1};
const owned=new Set<number>();let writer:number|undefined,frameWriter:number|undefined,frameReader:number|undefined,foreign:number|undefined,framePath:string|undefined,fired=false,closeFault=false;
function openSync(target:any,...args:any[]){
  if(target===globalThis.__dispatchTarget&&(args[0]&constants.O_EXCL)!==0){
    if(globalThis.__dispatchFault==='collision'){fired=true;actualWriteFileSync(target,'foreign',{mode:0o600,flag:'wx'});}
    const fd=actualOpenSync(target,...args);owned.add(fd);writer=fd;return fd;
  }
  const fd=actualOpenSync(target,...args);owned.add(fd);
  if(String(target).includes('/.cold-child-capability.')){if((args[0]&constants.O_WRONLY)===0){frameReader=fd;framePath=String(target);}else frameWriter=fd;}
  return fd;
}
function fstatSync(fd:number,...args:any[]){const stats=actualFstatSync(fd,...args);if(fd===frameReader&&!fired&&globalThis.__dispatchFault==='child-frame-replace-before-unlink'){fired=true;renameSync(framePath,framePath+'.retained');actualWriteFileSync(framePath,'foreign',{mode:0o600,flag:'wx'});}return stats;}
function writeFileSync(target:any,bytes:any,...args:any[]){
  if(target===writer&&globalThis.__dispatchFault==='short-write'){fired=true;return actualWriteFileSync(target,bytes.subarray(0,Math.floor(bytes.length/2)),...args);}
  return actualWriteFileSync(target,bytes,...args);
}
function closeSync(fd:number){
  if(fd===frameWriter&&!fired&&globalThis.__dispatchFault==='child-frame-close-response'){fired=true;actualCloseSync(fd);owned.delete(fd);foreign=actualOpenSync('/dev/fd/'+frameReader,constants.O_RDONLY);if(foreign!==fd)throw Error('fixture same-inode FD was not reused');throw Error('fixture frame close response lost');}
  if(writer!==undefined&&!fired&&globalThis.__dispatchFault==='parent-close'&&actualFstatSync(fd).isDirectory()){fired=true;throw Error('fixture parent pre-close failure');}
  if(fd===writer&&(!closeFault||globalThis.__dispatchFault==='persistent-close')&&['writer-close','persistent-close'].includes(globalThis.__dispatchFault)){fired=true;closeFault=true;throw Error('fixture dispatch writer close interrupted');}
  actualCloseSync(fd);owned.delete(fd);
}
function fsyncSync(fd:number){
  if(!fired&&['child-secret-writer-reuse','child-secret-reader-reuse'].includes(globalThis.__dispatchFault)&&frameWriter!==undefined&&frameReader!==undefined&&actualFstatSync(fd).isDirectory()&&actualFstatSync(frameWriter).nlink===0){fired=true;const original=globalThis.__dispatchFault==='child-secret-writer-reuse'?frameWriter:frameReader;actualCloseSync(original);owned.delete(original);foreign=actualOpenSync(globalThis.__dispatchForeignPath,globalThis.__dispatchFault==='child-secret-writer-reuse'?constants.O_WRONLY:constants.O_RDONLY);if(foreign!==original)throw Error('fixture FD was not reused');}
  if(writer!==undefined&&!fired){
    const fault=globalThis.__dispatchFault,target=globalThis.__dispatchTarget;
    if((fault==='file-sync'&&fd===writer)||(fault==='directory-sync'&&fstatSync(fd).isDirectory())){fired=true;throw Error('fixture dispatch sync interrupted');}
    if(fd===writer&&['extra-member','replace-dispatch','root-swap'].includes(fault)){
      fired=true;
      if(fault==='extra-member')actualWriteFileSync(path.join(path.dirname(target),'foreign'),'x',{mode:0o600});
      if(fault==='replace-dispatch'){const bytes=readFileSync(target);unlinkSync(target);actualWriteFileSync(target,bytes,{mode:0o600,flag:'wx'});}
      if(fault==='root-swap'){const root=path.dirname(target);renameSync(root,root+'.moved');mkdirSync(root,{mode:0o700});for(const name of readdirSync(root+'.moved'))actualWriteFileSync(path.join(root,name),readFileSync(path.join(root+'.moved',name)),{mode:0o600});}
    }
  }
  actualFsyncSync(fd);
}
globalThis.__dispatchDiagnostic=()=>{
  const retained=pendingColdHelperAuthenticationCleanupV1.size,closeResponse=globalThis.__dispatchFault==='child-frame-close-response';globalThis.__dispatchFault='disabled';
  let unknownClosePreserved=true;if(closeResponse){let refused=false;try{for(const close of pendingColdHelperAuthenticationCleanupV1)close();}catch(error){refused=/ambiguous/.test(error.message);}unknownClosePreserved=refused&&actualFstatSync(foreign).nlink===0;actualCloseSync(foreign);foreign=undefined;}
  for(const close of pendingColdHelperAuthenticationCleanupV1)close();
  let foreignPreserved=false;try{foreignPreserved=readFileSync(framePath,'utf8')==='foreign'}catch{}
  let foreignEmpty=true,foreignOpen=true;if(foreign!==undefined){foreignEmpty=readFileSync(globalThis.__dispatchForeignPath).length===0;try{foreignOpen=actualFstatSync(foreign).nlink===1;actualCloseSync(foreign);}catch{foreignOpen=false;}}
  return {fired,owned:owned.size,retained,pending:pendingColdHelperAuthenticationCleanupV1.size,foreignPreserved,foreignEmpty,foreignOpen,unknownClosePreserved};
};
`);
    try {
      const receipt = path.join(path.dirname(fixture.runner), "baseline-post-handoff-receipt-v1.js");
      writeFileSync(receipt, readFileSync(receipt, "utf8") + `\nexport async function observeInternalProductionColdSpawnerHelperBootstrapObservationV1(){return ${JSON.stringify(fixture.intent.coldObservation)}}\n`);
      const target = path.join(fixture.root, "cold-spawner-bootstrap-v1/dispatch.json");
      writeFileSync(fixture.runner, `
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,fstatSync} from 'node:fs';
import {acquireColdSpawnerHelperContextV1,publishColdSpawnerHelperDispatchV1,resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1,observeInternalProductionColdSpawnerBootstrapJournalCensusV1} from './baseline-restart-authority-retirement-v1.js';
const context=await acquireColdSpawnerHelperContextV1();
globalThis.__dispatchTarget=${JSON.stringify(target)};globalThis.__dispatchFault=${JSON.stringify(fault)};
globalThis.__dispatchForeignPath=${JSON.stringify(path.join(fixture.root, "foreign-empty"))};writeFileSync(globalThis.__dispatchForeignPath,'',{mode:0o600,flag:'wx'});
assert.throws(()=>publishColdSpawnerHelperDispatchV1(context),/dispatch publication is uncertain/);
const bytes=readFileSync(${JSON.stringify(target)});
assert.throws(()=>publishColdSpawnerHelperDispatchV1(context));
assert.throws(()=>resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1());
assert.throws(()=>observeInternalProductionColdSpawnerBootstrapJournalCensusV1(),/COLD_BOOTSTRAP_UNSETTLED/);
const diagnostic=globalThis.__dispatchDiagnostic();context.close();
assert.ok(readFileSync(${JSON.stringify(target)}).equals(bytes));
assert.equal(fstatSync(4).nlink,1);assert.equal(fstatSync(5).nlink,1);
process.stdout.write(JSON.stringify({accepted:false,diagnostic}));
`);
      const lock = readFileSync(fixture.lock), epoch = readFileSync(fixture.epoch);
      const result = fixture.run();
      assert.equal(result.diagnostic.fired, true, fault);
      assert.equal(result.diagnostic.foreignEmpty, true, `${fault}: no secret reaches the reused linked file`);
      assert.equal(result.diagnostic.foreignOpen, true, `${fault}: cleanup preserves foreign descriptor ownership`);
      assert.equal(result.diagnostic.unknownClosePreserved, true, `${fault}: unknown same-inode close never becomes a second close`);
      assert.equal(result.diagnostic.pending, 0, `${fault}: a drained cleanup must leave no retained closure`);
      assert.equal(result.diagnostic.owned, 0, `${fault}: all helper-owned descriptors must be closed`);
      assert.equal(result.diagnostic.retained, fault === "persistent-close" || fault === "child-frame-close-response" ? 1 : 0, fault);
      if (fault === "child-frame-replace-before-unlink") assert.equal(result.diagnostic.foreignPreserved, true, "the final unlink must preserve a foreign replacement");
      assert.ok(readFileSync(fixture.lock).equals(lock));
      assert.ok(readFileSync(fixture.epoch).equals(epoch));
    } finally { fixture.close(); }
  }
});

async function createAuthenticatedColdChildFixtureV1(fault: string) {
  const typescript = await import("typescript");
  const refusalFault = fault.startsWith("claim-fault-") || ["claim-concurrent", "claim-stop", "claim-replay", "claim-regular-readiness"].includes(fault);
  return createColdHelperAuthenticationFixtureV1((source) => {
    source = source.replace('fail("cold process ownership is ambiguous")', 'fail("cold process ownership is ambiguous: "+JSON.stringify({pid,status:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout,stderr:result.stderr}))');
    if (fault.startsWith("claim-real-helper-pid-residue-")) {
      if (fault.endsWith("-stop")) source = source.replace('      const startup = await import("../spawner.js");', '      const pendingStartup=import("../spawner.js");await new Promise(resolve=>setImmediate(resolve));const startup=await pendingStartup;');
      source = source.replace("  openSync,", "  openSync as actualResidueOpenSync,").replace("  closeSync,", "  closeSync as actualResidueCloseSync,")
        .replace("  unlinkSync,", "  unlinkSync as actualResidueUnlinkSync,").replace("  fsyncSync,", "  fsyncSync as actualResidueFsyncSync,") + `
const residueFixtureChild=process.argv[1]===path.join(repositoryRoot(),'dist/spawner.js'),residueFixtureOwned=new Set();
const residueFixturePath=path.join(repositoryRoot(),'.openclaw/setfarm/spawner.pid'),residueFixtureFault=${JSON.stringify(fault.slice("claim-real-helper-pid-residue-".length))};let residueFixtureReader,residueFixtureFired=false;
const residueFixtureMark=()=>{residueFixtureFired=true;writeFileSync(path.join(repositoryRoot(),'fixture-residue-boundary'),residueFixtureFault);};
function openSync(...args){const fd=actualResidueOpenSync(...args);if(residueFixtureChild){residueFixtureOwned.add(fd);if(args[0]===residueFixturePath)residueFixtureReader=fd;}return fd;}
function closeSync(fd){if(residueFixtureChild&&fd===residueFixtureReader&&residueFixtureFault==='close'&&!residueFixtureFired){residueFixtureMark();throw Error('fixture residue close');}actualResidueCloseSync(fd);residueFixtureOwned.delete(fd);}
function unlinkSync(target){if(residueFixtureChild&&target===residueFixturePath&&residueFixtureFault==='unlink'&&!residueFixtureFired){residueFixtureMark();throw Error('fixture residue unlink');}return actualResidueUnlinkSync(target);}
function fsyncSync(fd){if(residueFixtureChild&&residueFixtureReader!==undefined&&residueFixtureFault==='fsync'&&!residueFixtureFired&&fstatSync(residueFixtureReader).nlink===0){residueFixtureMark();throw Error('fixture residue fsync');}return actualResidueFsyncSync(fd);}
export function residueFixtureOwnedCount(){return residueFixtureOwned.size;}
`;
    }
    if (fault.startsWith("claim-real-helper")) source = source.replace('    readiness = (child.stdio as readonly unknown[])[6] as Readable | undefined;', '    writeFileSync(path.join(repositoryRoot(), "fixture-spawn-pids"), String(child.pid)+"\\n", {mode:0o600,flag:"a"});\n    readiness = (child.stdio as readonly unknown[])[6] as Readable | undefined;');
    if (fault.startsWith("claim-real-helper-pid-residue")) source = source.replace('    readiness = (child.stdio as readonly unknown[])[6] as Readable | undefined;', `
    const fixtureStart=spawnSync('/bin/ps',['-p',String(child.pid),'-o','pid=,uid=,pgid=,lstart=,stat=,ucomm=,command='],{encoding:'utf8',timeout:2000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}});
    if(fixtureStart.status!==0||fixtureStart.signal!==null||fixtureStart.error||fixtureStart.stderr!==''||!fixtureStart.stdout.endsWith('\\n'))throw Error('fixture could not bind spawned child start');
    writeFileSync(path.join(repositoryRoot(),'fixture-spawn-process'),fixtureStart.stdout,{mode:0o600,flag:'wx'});
    readiness = (child.stdio as readonly unknown[])[6] as Readable | undefined;`);
    if (fault === "claim-real-helper-parent-transition") source = source.replace('      const own = observeColdProcessParentGroupV1(process.pid);', `
      const own = observeColdProcessParentGroupV1(process.pid);
      if(globalThis.__fixtureParentTransition&&claim!==null&&own.ppid===helper.pid){globalThis.__fixtureParentTransition=false;const deadline=Date.now()+4000;while(process.ppid!==1&&Date.now()<deadline)spawnSync('/bin/sleep',['0.01']);if(process.ppid!==1)throw Error('fixture parent transition did not occur');writeFileSync(path.join(repositoryRoot(),'fixture-parent-transition'),'fired');}`);
    if (fault === "claim-real-helper-late-parent-transition") source = source.replace('      originalParent = originalParent &&', `
      if(globalThis.__fixtureLateParentTransition&&claim!==null&&settledOwn.ppid===helper.pid){globalThis.__fixtureLateParentTransition=false;const deadline=Date.now()+4000;while(process.ppid!==1&&Date.now()<deadline)spawnSync('/bin/sleep',['0.01']);if(process.ppid!==1)throw Error('fixture late parent transition did not occur');writeFileSync(path.join(repositoryRoot(),'fixture-parent-transition'),'fired');}
      originalParent = originalParent &&`);
    if (fault === "claim-real-helper-fragmented") source = source.replace('      const onData = (bytes: Buffer) => {', '      const onData = (bytes: Buffer) => {writeFileSync(path.join(repositoryRoot(), "fixture-ready-chunks"), "chunk\\n", {mode:0o600,flag:"a"});');
    if (fault === "claim-real-helper-spawn-error") {
      const childSpawn = '    child = spawn(profile.executable.path, [path.join(profile.repository, "dist/spawner.js")], {';
      const start = source.indexOf("export async function runInternalProductionColdSpawnerHelperV1"), end = source.indexOf("\nfunction observeColdProcessParentGroupV1", start);
      assert.ok(start > 0 && end > start); const coldRunner = source.slice(start, end);
      assert.equal(coldRunner.split(childSpawn).length - 1, 1, "spawn-error fixture targets exactly the cold helper-to-child launch");
      source = source.slice(0, start) + coldRunner.replace(childSpawn, '    child = spawn(path.join(repositoryRoot(), "absent-node"), [path.join(profile.repository, "dist/spawner.js")], {') + source.slice(end);
    }
    if (fault === "claim-real-helper-no-eof") {
      const timer = 'setTimeout(() => finish(Error("cold child readiness timed out")), 30_000)';
      assert.equal(source.split(timer).length - 1, 1);
      source = source.replace(timer, 'setTimeout(() => {writeFileSync(path.join(repositoryRoot(),"fixture-eof-timeout-fired"),String(count));finish(Error("cold child readiness timed out"));}, 5000)');
    }
    if (["claim-real-helper-claim-replace", "claim-real-helper-pid-restore", "claim-real-helper-lock-restore", "claim-real-helper-journal-aba", "claim-real-helper-output-drift"].includes(fault)) source = source.replace('      const target = path.join(root, "claim.json"), stats = lstatSync(target, { bigint: true });', `
      const ready=path.join(repositoryRoot(),'.openclaw/setfarm/fixture-claim-ready'),deadline=Date.now()+4000;
      while(Date.now()<deadline){try{lstatSync(ready);break}catch{spawnSync('/bin/sleep',['0.01']);}}lstatSync(ready);
      const target=path.join(root,'claim.json');
      ${fault === "claim-real-helper-journal-aba" ? "const foreign=path.join(root,'foreign');writeFileSync(foreign,'crossed',{mode:0o600,flag:'wx'});unlinkSync(foreign);" : fault === "claim-real-helper-output-drift" ? "writeFileSync(path.join(repositoryRoot(),'dist/fixture-dependency.js'),'export const crossed = true;\\n');" : fault === "claim-real-helper-claim-replace" ? "const copied=readFileSync(target);unlinkSync(target);writeFileSync(target,copied,{mode:0o600,flag:'wx'});" : `const changed=path.join(repositoryRoot(),'.openclaw/setfarm',${JSON.stringify(fault === "claim-real-helper-pid-restore" ? "spawner.pid" : "spawner.lock")}),copied=readFileSync(changed);writeFileSync(changed,'crossed');writeFileSync(changed,copied);`}
      const stats=lstatSync(target,{bigint:true});
      writeFileSync(path.join(repositoryRoot(),'fixture-claim-replaced'),'fired');`);
    if (fault.startsWith("claim")) source = source
      .replace('fail("cold child host ancestry changed")', 'fail("cold child host ancestry changed: " + target)')
      .replace('} catch { revokeColdSpawnerChildRuntimeV1(); return fail("cold child claim publication is uncertain"); }', '} catch (error) { writeFileSync(path.join(repositoryRoot(), "fixture-claim-error"), String(error)); revokeColdSpawnerChildRuntimeV1(); return fail("cold child claim publication is uncertain"); }')
      .replace('  catch {\n    revokeColdSpawnerChildRuntimeV1();\n    return fail("cold child authentication is revoked");', '  catch (error) {\n    writeFileSync(path.join(repositoryRoot(), "fixture-claim-error"), String(error));\n    revokeColdSpawnerChildRuntimeV1();\n    return fail("cold child authentication is revoked");');
    if (fault === "claim-stop") source = source.replace('const main = await import("../spawner.js");', 'const pendingMain=import("../spawner.js");await new Promise(resolve=>setImmediate(resolve));const main=await pendingMain;');
    if (refusalFault) source = source.replace("  openSync,", "  openSync as actualClaimOpenSync,").replace("  closeSync,", "  closeSync as actualClaimCloseSync,")
      .replace("  writeFileSync,", "  writeFileSync as actualClaimWriteFileSync,").replace("  fsyncSync,", "  fsyncSync as actualClaimFsyncSync,") + `
const claimFixtureChild=process.argv[1]===path.join(repositoryRoot(),'dist/spawner.js'),claimFixtureOwned=new Set<number>(),claimFixturePaths=new Map<number,string>();
let claimFixtureWriter:number|undefined,claimFixtureFired=false,claimFixtureFault=${JSON.stringify(fault)};
const claimFixtureTarget=()=>path.join(rootPaths().root,'cold-spawner-bootstrap-v1/claim.json');
function openSync(target:any,...args:any[]){
 if(claimFixtureChild&&target===claimFixtureTarget()&&(args[0]&constants.O_EXCL)!==0&&claimFixtureFault==='claim-fault-collision'){claimFixtureFired=true;actualClaimWriteFileSync(target,'foreign',{mode:0o600,flag:'wx'});}
 const fd=actualClaimOpenSync(target,...args);if(claimFixtureChild){claimFixtureOwned.add(fd);claimFixturePaths.set(fd,String(target));if(target===claimFixtureTarget()&&(args[0]&constants.O_EXCL)!==0)claimFixtureWriter=fd;}return fd;
}
function writeFileSync(target:any,bytes:any,...args:any[]){if(claimFixtureChild&&target===claimFixtureWriter&&claimFixtureFault==='claim-fault-short-write'){claimFixtureFired=true;return actualClaimWriteFileSync(target,bytes.subarray(0,1),...args);}return actualClaimWriteFileSync(target,bytes,...args);}
function fsyncSync(fd:number){
 if(claimFixtureChild&&claimFixtureWriter!==undefined&&!claimFixtureFired){
  if((claimFixtureFault==='claim-fault-file-sync'&&fd===claimFixtureWriter)||(claimFixtureFault==='claim-fault-parent-sync'&&claimFixturePaths.get(fd)===path.dirname(claimFixtureTarget()))){claimFixtureFired=true;throw Error('fixture claim fsync failure');}
  if(fd===claimFixtureWriter&&claimFixtureFault==='claim-fault-replace'){claimFixtureFired=true;unlinkSync(claimFixtureTarget());actualClaimWriteFileSync(claimFixtureTarget(),'foreign',{mode:0o600,flag:'wx'});}
  if(fd===claimFixtureWriter&&claimFixtureFault==='claim-fault-extra-member'){claimFixtureFired=true;actualClaimWriteFileSync(path.join(path.dirname(claimFixtureTarget()),'foreign'),'foreign',{mode:0o600,flag:'wx'});}
 }
 return actualClaimFsyncSync(fd);
}
function closeSync(fd:number){if(claimFixtureChild&&fd===claimFixtureWriter&&((claimFixtureFault==='claim-fault-writer-close'&&!claimFixtureFired)||claimFixtureFault==='claim-fault-persistent-close')){claimFixtureFired=true;throw Error('fixture claim pre-close failure');}actualClaimCloseSync(fd);claimFixtureOwned.delete(fd);claimFixturePaths.delete(fd);}
if(claimFixtureChild)process.on('exit',()=>{
 const retained=pendingColdHelperAuthenticationCleanupV1.size;claimFixtureFault='disabled';for(const close of pendingColdHelperAuthenticationCleanupV1)close();
 actualClaimWriteFileSync(path.join(repositoryRoot(),'fixture-claim-diagnostic.json'),JSON.stringify({fired:claimFixtureFired,owned:claimFixtureOwned.size,retained,pending:pendingColdHelperAuthenticationCleanupV1.size}));
});
`;
    if (["node-close", "authority-close", "directory-close"].includes(fault)) source = source.replace("  openSync,", "  openSync as actualOpenSync,").replace("  closeSync,", "  closeSync as actualCloseSync,").replace("  opendirSync,", "  opendirSync as actualOpendirSync,") + `
const childOwned=new Set<number>();let interrupted=false,directoryOwned=0;
function openSync(target:any,...args:any[]){const fd=actualOpenSync(target,...args);if(process.argv[1]===path.join(repositoryRoot(),'dist/spawner.js')&&${fault === "node-close" ? "target===process.execPath" : fault === "authority-close" ? "String(target).endsWith('/dispatch.json')" : "false"})childOwned.add(fd);return fd;}
function closeSync(fd:number){if(childOwned.has(fd)&&!interrupted){interrupted=true;throw Error('fixture child pre-close failure')}actualCloseSync(fd);childOwned.delete(fd);}
function opendirSync(target:any,...args:any[]){const directory=actualOpendirSync(target,...args);if(${fault === "directory-close"}&&process.argv[1]===path.join(repositoryRoot(),'dist/spawner.js')&&String(target).endsWith('/cold-spawner-bootstrap-v1')){directoryOwned++;const close=directory.closeSync.bind(directory);directory.closeSync=()=>{if(!interrupted){interrupted=true;throw Error('fixture directory pre-close failure')}close();directoryOwned--;};}return directory;}
if(process.argv[1]===path.join(repositoryRoot(),'dist/spawner.js'))process.on('exit',()=>process.stdout.write(JSON.stringify({owned:childOwned.size+directoryOwned,interrupted})));
`;
    return source + "\nexport {acquireColdSpawnerHelperContextV1,publishColdSpawnerHelperDispatchV1,takeColdSpawnerChildLaunchDescriptorsV1};\n"
      + (source.includes("function parseColdSpawnerBootstrapClaimV1(") ? "export {parseColdSpawnerBootstrapClaimV1};\n" : "");
  }, "", (profile, root) => {
    profile.environment = { HOME: homedir(), LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", SETFARM_REPO_DIR: root, SETFARM_ENV_DIR: path.join(root, "runtime-env"),
      SETFARM_PG_URL: "postgresql://fixture@127.0.0.1:1/disposable", FIXTURE_SECRET: "never-persist-cold-snapshot" };
    if (fault === "reserved-environment") profile.environment.NODE_OPTIONS = "--no-warnings";
  }, (root, profile, compile) => {
    mkdirSync(path.join(root, ".openclaw/setfarm"), { recursive: true, mode: 0o700 });
    compile("runtime-config.ts", (source) => source.replace('import { existsSync, readFileSync } from "node:fs";', `import {existsSync as actualExistsSync,readFileSync as actualReadFileSync} from 'node:fs';
function existsSync(target:any){if(/\\.env(?:\\.local)?$/.test(String(target)))throw Error('child reached dotenv before authentication');return actualExistsSync(target)}
function readFileSync(target:any,...args:any[]){if(/\\.env(?:\\.local)?$/.test(String(target)))throw Error('child read dotenv');return actualReadFileSync(target,...args)}`));
    symlinkSync(path.resolve(import.meta.dirname, "../../node_modules"), path.join(root, "node_modules"), "dir");
    mkdirSync(profile.environment.SETFARM_ENV_DIR, { mode: 0o700 });
    const internal = path.join(root, "dist/internal-production");
    if (fault === "output-file-close" || fault === "output-directory-close") {
      const leaf = path.join(internal, "baseline-spawner-launch-environment-v1.js");
      const source = readFileSync(leaf, "utf8").replace("closeSync,", "closeSync as actualCloseSync,").replace("openSync,", "openSync as actualOpenSync,").replace("opendirSync,", "opendirSync as actualOpendirSync,");
      writeFileSync(leaf, source + `
const owned=new Set();let directoryOwned=0,interrupted=false;
const child=process.argv[1]===${JSON.stringify(path.join(root, "dist/spawner.js"))};
function openSync(...args){const fd=actualOpenSync(...args);if(child)owned.add(fd);return fd;}
function closeSync(fd){if(child&&${fault === "output-file-close"}&&!interrupted){interrupted=true;throw Error('fixture output file pre-close failure')}actualCloseSync(fd);owned.delete(fd);}
function opendirSync(...args){const directory=actualOpendirSync(...args);if(child){directoryOwned++;const close=directory.closeSync.bind(directory);directory.closeSync=()=>{if(${fault === "output-directory-close"}&&!interrupted){interrupted=true;throw Error('fixture output directory pre-close failure')}close();directoryOwned--;};}return directory;}
if(child)process.on('exit',()=>process.stdout.write(JSON.stringify({owned:owned.size+directoryOwned,interrupted})));
`);
    }
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.js"), `import {readFileSync} from 'node:fs';
const fixture=()=>JSON.parse(readFileSync(${JSON.stringify(path.join(root, "cold-child-fixture-profile.json"))},'utf8'));
export async function observeInternalProductionSpawnerLaunchProfileCandidateV1(){return fixture()}
export async function observeInternalProductionColdSpawnerHelperBootstrapObservationV1(){return fixture().coldObservation}
`);
    writeFileSync(path.join(internal, "baseline-service-restart-helper-v1.js"), `
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync,openSync,closeSync,unlinkSync,fsyncSync} from 'node:fs';
import {acquireColdSpawnerHelperContextV1,publishColdSpawnerHelperDispatchV1,takeColdSpawnerChildLaunchDescriptorsV1} from './baseline-restart-authority-retirement-v1.js';
let context,alteredFrame;const fault=${JSON.stringify(fault)};
try{
  context=await acquireColdSpawnerHelperContextV1();publishColdSpawnerHelperDispatchV1(context);
  const handles=takeColdSpawnerChildLaunchDescriptorsV1(context);
  assert.throws(()=>takeColdSpawnerChildLaunchDescriptorsV1(context));
  const environment={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',SETFARM_INTERNAL_PRODUCTION_COLD_CHILD:'1'};
  if(fault==='missing-marker')delete environment.SETFARM_INTERNAL_PRODUCTION_COLD_CHILD;
  if(fault==='bad-marker')environment.SETFARM_INTERNAL_PRODUCTION_COLD_CHILD='invalid';
  if(fault==='both-markers')environment.SETFARM_INTERNAL_PRODUCTION_COLD_HELPER='1';
  if(fault==='output-drift')writeFileSync(${JSON.stringify(path.join(root, "dist/fixture-dependency.js"))},'export const fixtureValue=2;\\n');
  if(fault==='nonce'||fault==='environment'){
    const frame=JSON.parse(readFileSync(handles.frameDescriptor));
    if(fault==='nonce')frame.nonce='0'.repeat(64);else frame.environment.FIXTURE_SECRET='crossed';
    const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
    const scratch=${JSON.stringify(path.join(root, "crossed-child-frame"))},writer=openSync(scratch,'wx+',0o600);alteredFrame=openSync(scratch,'r');unlinkSync(scratch);writeFileSync(writer,canonical(frame)+'\\n');fsyncSync(writer);closeSync(writer);
  }
  const child=spawnSync(process.execPath,[${JSON.stringify(path.join(root, "dist"))}+(fault==='wrong-parent'?'/child-parent.js':'/spawner.js'),...(fault==='extra-argv'?['--foreign']:[])],{cwd:fault==='wrong-cwd'?${JSON.stringify(path.join(root, "dist"))}:${JSON.stringify(root)},detached:fault!=='not-detached',encoding:'utf8',timeout:10000,maxBuffer:65536,
    env:environment,stdio:['ignore','pipe','pipe',fault==='missing-frame'?'ignore':fault==='helper-frame'?3:alteredFrame??handles.frameDescriptor,fault==='crossed-lock'?handles.dispatchDescriptor:4,fault==='crossed-dispatch'?5:handles.dispatchDescriptor]});
  if(fault==='none'||fault==='late-output'||fault==='selector-entry'||fault==='selector-descriptor'){assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');process.stdout.write(child.stdout);}
  else{assert.notEqual(child.status,0,'crossed child was accepted');if(['node-close','authority-close','directory-close','output-file-close','output-directory-close'].includes(fault)){const diagnostic=JSON.parse(child.stdout);assert.equal(diagnostic.interrupted,true);assert.equal(diagnostic.owned,0,'child close failure leaked its descriptor');}else assert.equal(child.stdout,'');assert.match(child.stderr,/INTERNAL_PRODUCTION_INHERITED_RUNTIME_CONFIGURATION_INVALID/);assert.ok(!child.stderr.includes('child reached dotenv'));process.stdout.write(JSON.stringify({accepted:false,childRefused:true}));}
}catch(error){process.stdout.write(JSON.stringify({accepted:false,message:error.message}));}finally{if(alteredFrame!==undefined)closeSync(alteredFrame);context?.close()}
`);
    writeFileSync(path.join(root, "dist/fixture-dependency.js"), "export const fixtureValue=1;\n");
    writeFileSync(path.join(root, "dist/child-parent.js"), `import {spawnSync} from 'node:child_process';const child=spawnSync(process.execPath,[${JSON.stringify(path.join(root, "dist/spawner.js"))}],{cwd:${JSON.stringify(root)},env:process.env,stdio:['ignore','inherit','inherit',3,4,5],detached:true,timeout:8000});process.exitCode=child.status??1;\n`);
    writeFileSync(path.join(root, "dist/spawner.js"), `
import assert from 'node:assert/strict';import {runtimeConfig,loadRuntimeEnv} from './runtime-config.js';
import {readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import './fixture-dependency.js';
import {resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1,resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1} from './internal-production/baseline-restart-authority-retirement-v1.js';
const snapshot=resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1();
assert.ok(snapshot);assert.equal(JSON.stringify(snapshot).includes('never-persist-cold-snapshot'),false);
assert.equal(runtimeConfig.setfarmPgUrl,'postgresql://fixture@127.0.0.1:1/disposable');
assert.equal(process.env.FIXTURE_SECRET,'never-persist-cold-snapshot');loadRuntimeEnv();
assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.SETFARM_INTERNAL_PRODUCTION_COLD_HELPER,undefined);
if(${JSON.stringify(fault)}==='late-output'){
  const target=${JSON.stringify(path.join(root, "dist/fixture-dependency.js"))},original=readFileSync(target);
  writeFileSync(target,'export const fixtureValue=9;\\n');
  assert.throws(()=>loadRuntimeEnv(),/INTERNAL_PRODUCTION_INHERITED_RUNTIME_CONFIGURATION_INVALID/,'a same-inode dependency edit must revoke configuration');
  writeFileSync(target,original);
  assert.throws(()=>resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1(),/cold child authentication is revoked/,'restoring bytes cannot revive failed authentication');
}
if(${JSON.stringify(fault)}==='selector-entry'){
  const original=process.argv[1];process.argv[1]=original+'.foreign';
  assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),/entry changed/);
  process.argv[1]=original;
  assert.throws(()=>resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1(),/cold child authentication is revoked/,'restored entry cannot revive authority after shared selection refusal');
  assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),/authentication is revoked/);
}
if(${JSON.stringify(fault)}==='selector-descriptor'){
  const original=openSync('/dev/fd/3','r');closeSync(3);assert.equal(openSync('/dev/null','r'),3);
  assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1());
  closeSync(3);assert.equal(openSync('/dev/fd/'+original,'r'),3);closeSync(original);
  assert.throws(()=>resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1(),/cold child authentication is revoked/,'restoring original FD3 cannot revive authority');
  assert.throws(()=>resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1(),/authentication is revoked/);
}
process.env.UNBOUND_CHILD_KEY='drift';assert.throws(()=>loadRuntimeEnv());delete process.env.UNBOUND_CHILD_KEY;
assert.throws(()=>loadRuntimeEnv(),/INTERNAL_PRODUCTION_INHERITED_RUNTIME_CONFIGURATION_INVALID/,'restoring the environment cannot revive configuration');
process.stdout.write(JSON.stringify({accepted:true,childPid:process.pid,helperPid:process.ppid}));
`);
    if (fault.startsWith("claim")) {
      const spawnerSource = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
      const tree = typescript.createSourceFile("spawner.ts", spawnerSource, typescript.ScriptTarget.Latest, true);
      const names = new Set(["observeSpawnerStartupFileParentsV1", "assertSpawnerStartupFileParentsV1", "createOwnedSpawnerStartupFileV1", "closeOwnedSpawnerStartupFileV1", "publishSpawnerPidFileV1", "reclaimDeadSpawnerStartupFileV1", "acquireSpawnerSingletonLock", "releaseSpawnerSingletonLock", "observeOwnedSpawnerStartupFileV1", "observeInternalProductionColdSpawnerSingletonOwnershipV1", "observeInternalProductionColdSpawnerStartupOwnershipV1", "runInternalProductionColdSpawnerStartupV1", "observeInternalProductionDirectSpawnerStartupOwnershipV1", "runInternalProductionDirectSpawnerStartupV1", "main"]);
      const declarations = tree.statements.filter((statement) => typescript.isFunctionDeclaration(statement) && statement.name && names.has(statement.name.text));
      const variables = tree.statements.filter((statement) => typescript.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => typescript.isIdentifier(declaration.name) && /^spawner(?:LockFd|StartupFilesV1|ColdStartup|DirectStartup)/.test(declaration.name.text)));
      const retirementImport = tree.statements.find((statement) => typescript.isImportDeclaration(statement) && typescript.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "./internal-production/baseline-restart-authority-retirement-v1.js");
      assert.ok(retirementImport);
      const runtime = path.join(root, ".openclaw/setfarm");
      mkdirSync(runtime, { recursive: true, mode: 0o700 });
      let compiledMain = `
import {runtimeConfig,loadRuntimeEnv} from './runtime-config.js';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
${retirementImport.getText(tree)}
const PID_FILE=${JSON.stringify(path.join(runtime, "spawner.pid"))},LOCK_FILE=${JSON.stringify(path.join(runtime, "spawner.lock"))};
async function resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1(){throw Error('cold child reached ordinary admission')}
function initializeAgentRuntimeV1(){throw Error('cold child reached provider discovery')}
async function pgMigrate(){throw Error('cold child reached database initialization')}
${[...variables, ...declarations].map((statement) => statement.getText(tree)).join("\n")}
${spawnerSource.slice(spawnerSource.lastIndexOf('if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {'))}
`;
      if (fault.startsWith("claim-real-helper-pid-residue-")) {
        const mode = fault.slice("claim-real-helper-pid-residue-".length);
        const changes: Record<string, string> = {
          "diagnostic-barrier": "fs.renameSync(PID_FILE,PID_FILE+'.original');fs.writeFileSync(PID_FILE,originalResidue,{mode:0o644,flag:'wx'});",
          replace: "fs.renameSync(PID_FILE,PID_FILE+'.original');fs.writeFileSync(PID_FILE,originalResidue,{mode:0o644,flag:'wx'});",
          restore: "fs.writeFileSync(PID_FILE,'crossed');fs.writeFileSync(PID_FILE,originalResidue);",
          "other-dead": "const another=fixtureResidueSpawn(process.execPath,['-e','']);assert.equal(another.status,0);fs.writeFileSync(PID_FILE,String(another.pid));",
          symlink: "fs.renameSync(PID_FILE,PID_FILE+'.original');fs.symlinkSync(PID_FILE+'.original',PID_FILE);",
          ancestor: "fs.renameSync(path.dirname(PID_FILE),path.dirname(PID_FILE)+'.original');fs.mkdirSync(path.dirname(PID_FILE),{mode:0o700});fs.writeFileSync(PID_FILE,originalResidue,{mode:0o644,flag:'wx'});",
          singleton: "fs.renameSync(LOCK_FILE,LOCK_FILE+'.original');fs.writeFileSync(LOCK_FILE,String(process.pid)+'\\n',{mode:0o600,flag:'wx'});",
          absent: "fs.unlinkSync(PID_FILE);",
          live: "const actualKill=process.kill.bind(process);process.kill=(pid,signal)=>{if(pid===Number(originalResidue)&&signal===0)return true;return actualKill(pid,signal);};",
          eperm: "const actualKill=process.kill.bind(process);process.kill=(pid,signal)=>{if(pid===Number(originalResidue)&&signal===0)throw Object.assign(Error('fixture PID probe denied'),{code:'EPERM'});return actualKill(pid,signal);};",
        };
        if (mode.startsWith("probe-")) changes[mode] = `
          const actualKill=process.kill.bind(process);let probeCount=0;
          process.kill=(pid,signal)=>{if(pid===Number(originalResidue)&&signal===0&&++probeCount===2){
            ${mode === "probe-replace" ? "fs.renameSync(PID_FILE,PID_FILE+'.original');fs.writeFileSync(PID_FILE,originalResidue,{mode:0o644,flag:'wx'});" : mode === "probe-restore" ? "fs.writeFileSync(PID_FILE,'crossed');fs.writeFileSync(PID_FILE,originalResidue);" : mode === "probe-singleton" ? "fs.renameSync(LOCK_FILE,LOCK_FILE+'.original');fs.writeFileSync(LOCK_FILE,String(process.pid)+'\\n',{mode:0o600,flag:'wx'});" : ""}
            fs.writeFileSync(${JSON.stringify(path.join(root, "fixture-residue-boundary"))},${JSON.stringify(mode)});
            fs.writeFileSync(${JSON.stringify(path.join(root, "fixture-residue-evidence"))},JSON.stringify({bytes:fs.readFileSync(PID_FILE).toString('base64'),ino:String(fs.lstatSync(PID_FILE,{bigint:true}).ino)}));
            ${mode === "probe-live" ? "return true;" : ""}
          }return actualKill(pid,signal);};`;
        compiledMain = `import {spawnSync as fixtureResidueSpawn} from 'node:child_process';import {residueFixtureOwnedCount} from './internal-production/baseline-restart-authority-retirement-v1.js';\n` + compiledMain;
        compiledMain = compiledMain.replace('    await consumeInternalProductionColdSpawnerPidResidueV1();', `
        const originalResidue=fs.readFileSync(PID_FILE);
        ${changes[mode] ?? ""}
        ${["unlink", "fsync", "close"].includes(mode) || mode.startsWith("probe-") ? "" : `fs.writeFileSync(${JSON.stringify(path.join(root, "fixture-residue-boundary"))},${JSON.stringify(mode)});`}
        const evidence=fs.existsSync(PID_FILE)?{bytes:fs.readFileSync(PID_FILE).toString('base64'),ino:String(fs.lstatSync(PID_FILE,{bigint:true}).ino)}:null;
        fs.writeFileSync(${JSON.stringify(path.join(root, "fixture-residue-evidence"))},JSON.stringify(evidence));
        ${mode === "concurrent" ? "const results=await Promise.allSettled([consumeInternalProductionColdSpawnerPidResidueV1(),consumeInternalProductionColdSpawnerPidResidueV1()]);assert.ok(results.every(result=>result.status==='rejected'));throw Error('fixture concurrent residue refused');" : mode === "replay" ? "await consumeInternalProductionColdSpawnerPidResidueV1();await assert.rejects(consumeInternalProductionColdSpawnerPidResidueV1());throw Error('fixture replay residue refused');" : mode === "stop" ? "const pending=consumeInternalProductionColdSpawnerPidResidueV1();process.kill(process.pid,'SIGTERM');await assert.rejects(pending);assert.equal(spawnerColdStartupPhaseV1,'stopping');throw Error('fixture stopped residue refused');" : "await consumeInternalProductionColdSpawnerPidResidueV1();"}
        `);
        compiledMain = compiledMain.replace('  main().catch((err) => {', `  main().catch(async (err) => {
          ${mode === "diagnostic-barrier" ? `await new Promise<void>(resolve=>{const ready=${JSON.stringify(path.join(root, "fixture-residue-diagnostic-release"))};const watcher=fs.watch(${JSON.stringify(root)},()=>{if(fs.existsSync(ready)){watcher.close();resolve();}});if(fs.existsSync(ready)){watcher.close();resolve();}});` : ""}
          fs.writeFileSync(${JSON.stringify(path.join(root, "fixture-residue-owned"))},String(residueFixtureOwnedCount()));`);
      }
      const lateReplacement = fault === "claim-late-pid" || fault === "claim-late-lock";
      const lateHost = fault.startsWith("claim-host-");
      if (fault === "claim-concurrent") compiledMain = compiledMain.replace('claim = await publishInternalProductionColdSpawnerBootstrapClaimV1();', `
        const attempts=await Promise.allSettled([publishInternalProductionColdSpawnerBootstrapClaimV1(),publishInternalProductionColdSpawnerBootstrapClaimV1()]);
        assert.ok(attempts.every(result=>result.status==='rejected'));throw Error('fixture concurrent claims refused');`);
      if (fault === "claim-stop") compiledMain = compiledMain.replace('claim = await publishInternalProductionColdSpawnerBootstrapClaimV1();', `
        const attempt=publishInternalProductionColdSpawnerBootstrapClaimV1();process.kill(process.pid,'SIGTERM');await assert.rejects(attempt);assert.equal(spawnerColdStartupPhaseV1,'stopping');throw Error('fixture stopped claim refused');`);
      if (fault === "claim-replay") compiledMain = compiledMain.replace('claim = await publishInternalProductionColdSpawnerBootstrapClaimV1();', `
        claim = await publishInternalProductionColdSpawnerBootstrapClaimV1();await assert.rejects(publishInternalProductionColdSpawnerBootstrapClaimV1());throw Error('fixture repeated claim refused');`);
      compiledMain = compiledMain.replace('    closeReadiness();', `    closeReadiness();
        ${fault === "claim-real-helper-parent-transition" ? "globalThis.__fixtureParentTransition=true;" : ""}
        ${fault === "claim-real-helper-late-parent-transition" ? "globalThis.__fixtureLateParentTransition=true;" : ""}
        ${fault === "claim-helper-departure" ? "const departureDeadline=Date.now()+4000;while(process.ppid!==1&&Date.now()<departureDeadline)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(process.ppid,1);" : ""}
        ${lateReplacement ? `
        const deadline=Date.now()+4000;while(process.ppid!==1&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(process.ppid,1);
        const target=${fault === "claim-late-pid" ? "PID_FILE" : "LOCK_FILE"},bytes=fs.readFileSync(target);fs.renameSync(target,target+'.original');fs.writeFileSync(target,bytes,{mode:0o600,flag:'wx'});
        assert.throws(()=>loadRuntimeEnv(),/INTERNAL_PRODUCTION_INHERITED_RUNTIME_CONFIGURATION_INVALID/);assert.throws(()=>resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1(),/revoked/);
        ` : lateHost ? `
        const target=${JSON.stringify(profile.environment.SETFARM_ENV_DIR)};
        ${fault === "claim-host-sibling" ? "fs.writeFileSync(path.join(target,'unrelated-sibling'),'unrelated');loadRuntimeEnv();"
          : `${fault === "claim-host-mode" ? "fs.chmodSync(target,0o755);" : `fs.renameSync(target,target+'.original');${fault === "claim-host-symlink" ? "fs.symlinkSync(target+'.original',target,'dir');" : "fs.mkdirSync(target,{mode:0o700});"}`}
        assert.throws(()=>loadRuntimeEnv(),/INTERNAL_PRODUCTION_INHERITED_RUNTIME_CONFIGURATION_INVALID/);assert.throws(()=>resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1(),/revoked/);`}
        ` : "loadRuntimeEnv();"}
        fs.writeFileSync(${JSON.stringify(path.join(runtime, "fixture-claim-ready"))},'ready',{mode:0o600,flag:'wx'});`);
      if (fault === "claim-runtime-replace") compiledMain = compiledMain.replace("spawnerLockFd = createOwnedSpawnerStartupFileV1(LOCK_FILE,", `fs.renameSync(${JSON.stringify(runtime)},${JSON.stringify(runtime + ".moved")});fs.mkdirSync(${JSON.stringify(runtime)},{mode:0o700});spawnerLockFd = createOwnedSpawnerStartupFileV1(LOCK_FILE,`);
      compiledMain = compiledMain.replace("  main().catch((err) => {", `  main().catch((err) => {fs.appendFileSync(${JSON.stringify(path.join(root, "fixture-claim-error"))},' main: '+String(err));`);
      const wireFault = fault.slice("claim-real-helper-".length);
      if (fault.startsWith("claim-real-helper-") && ["fragmented", "empty", "malformed", "extra-key", "oversize", "truncated", "duplicate", "noncanonical", "crossed-hash", "crossed-identity", "no-eof", "pipe-close"].includes(wireFault)) {
        const setup = `
import {spawnSync as fixtureSpawnSync} from 'node:child_process';
const actualFixtureWriteSync=fs.writeSync,actualFixtureCloseSync=fs.closeSync;let fixturePipeCloseInterrupted=false;
const fixtureWireFault=${JSON.stringify(wireFault)},fixtureCanonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(fixtureCanonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+fixtureCanonical(v[k])).join(',')+'}';
fs.writeSync=(fd,bytes,...args)=>{
 if(fd!==6)return actualFixtureWriteSync(fd,bytes,...args);
 if(fixtureWireFault==='no-eof')fixtureSpawnSync('/bin/sleep',['1.5']); // Startup delay must not stand in for a missing EOF.
 fs.writeFileSync(${JSON.stringify(path.join(root, "fixture-wire-fault-fired"))},fixtureWireFault);
 let changed=bytes;
 if(fixtureWireFault==='empty')return bytes.length;
 if(fixtureWireFault==='malformed')changed=Buffer.from('not-json');
 if(fixtureWireFault==='oversize')changed=Buffer.alloc(4097,120);
 if(fixtureWireFault==='truncated')changed=bytes.subarray(0,bytes.length-2);
 if(fixtureWireFault==='duplicate')changed=Buffer.concat([bytes,bytes]);
 if(['extra-key','noncanonical','crossed-hash','crossed-identity'].includes(fixtureWireFault)){
  const value=JSON.parse(bytes);if(fixtureWireFault==='extra-key')value.foreign=true;if(fixtureWireFault==='crossed-hash')value.claimHash='0'.repeat(64);if(fixtureWireFault==='crossed-identity')value.claimIdentity[1]=String(BigInt(value.claimIdentity[1])+1n);
  changed=Buffer.from((fixtureWireFault==='noncanonical'?JSON.stringify(value,null,2):fixtureCanonical(value))+'\\n');
 }
 if(fixtureWireFault==='fragmented'){const half=Math.floor(bytes.length/2);actualFixtureWriteSync(fd,bytes.subarray(0,half));fixtureSpawnSync('/bin/sleep',['0.1']);actualFixtureWriteSync(fd,bytes.subarray(half));}
 else actualFixtureWriteSync(fd,changed,...args);
 return bytes.length;
};
fs.closeSync=fd=>{if(fd===6){if(fixtureWireFault==='no-eof')return;if(fixtureWireFault==='pipe-close'&&!fixturePipeCloseInterrupted){fixturePipeCloseInterrupted=true;throw Error('fixture readiness pre-close failure');}}return actualFixtureCloseSync(fd);};
`;
        compiledMain = compiledMain.replace("const PID_FILE=", setup + "\nconst PID_FILE=");
      }
      writeFileSync(path.join(root, "dist/spawner.js"), typescript.transpileModule(compiledMain, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
      const claimPath = path.join(root, "data/internal-production-baseline/restart-authority-retirement-v1/cold-spawner-bootstrap-v1/claim.json");
      writeFileSync(path.join(internal, "baseline-service-restart-helper-v1.js"), `
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {acquireColdSpawnerHelperContextV1,publishColdSpawnerHelperDispatchV1,takeColdSpawnerChildLaunchDescriptorsV1} from './baseline-restart-authority-retirement-v1.js';
import * as authority from './baseline-restart-authority-retirement-v1.js';import {createHash} from 'node:crypto';
let context,child,readyFd,accepted=false,stderr='';
try{
 context=await acquireColdSpawnerHelperContextV1();publishColdSpawnerHelperDispatchV1(context);const handles=takeColdSpawnerChildLaunchDescriptorsV1(context);
 if(${fault === "claim-regular-readiness"}){const file=${JSON.stringify(path.join(root, "fixture-readiness-file"))};writeFileSync(file,'untouched',{mode:0o600,flag:'wx'});readyFd=openSync(file,'r+');}
 child=spawn(process.execPath,[${JSON.stringify(path.join(root, "dist/spawner.js"))}],{cwd:${JSON.stringify(root)},detached:true,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',SETFARM_INTERNAL_PRODUCTION_COLD_CHILD:'1'},stdio:['ignore','ignore','pipe',handles.frameDescriptor,4,handles.dispatchDescriptor,readyFd??'pipe']});
 child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-65536)});
 if(${refusalFault}){
  child.stdio[6]?.on('data',()=>{});child.stdio[6]?.on('error',()=>{});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('refusing child did not exit')),7000);child.once('close',()=>{clearTimeout(timer);resolve()});child.once('error',error=>{clearTimeout(timer);reject(error)})});
  assert.notEqual(child.exitCode,0);assert.equal(child.signalCode,null);process.stdout.write(JSON.stringify({accepted:false,childRefused:true,diagnostic:JSON.parse(readFileSync(${JSON.stringify(path.join(root, "fixture-claim-diagnostic.json"))},'utf8'))}));
 }else{
 const ready=await new Promise((resolve,reject)=>{let bytes=Buffer.alloc(0);const timer=setTimeout(()=>reject(Error('fixture readiness timed out')),7000);const done=error=>{clearTimeout(timer);if(error)return reject(error);try{const value=JSON.parse(bytes);assert.equal(value.schema,'setfarm.internal-production-cold-spawner-readiness.v1');resolve(value)}catch(error){reject(error)}};child.stdio[6].on('data',chunk=>{bytes=Buffer.concat([bytes,chunk]);if(bytes.length>4096)done(Error('fixture readiness exceeded cap'))});child.stdio[6].once('error',done);child.stdio[6].once('end',()=>done());});
 let claim;const deadline=Date.now()+7000;
 while(Date.now()<deadline){
  if(child.exitCode!==null||child.signalCode!==null)throw Error('real cold main exited before claim: '+stderr);
  try{claim=JSON.parse(readFileSync(${JSON.stringify(claimPath)},'utf8'));break}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error}
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.ok(claim,'real cold main did not publish a claim');assert.equal(claim.child.pid,child.pid);
 assert.equal(ready.claimHash,claim.claimHash);assert.equal(ready.claimRef,claim.claimRef);
 if(${fault === "claim-parser"}){
  assert.equal(typeof authority.parseColdSpawnerBootstrapClaimV1,'function','strict claim parser is missing');
  const root=${JSON.stringify(path.dirname(claimPath))},intent=JSON.parse(readFileSync(root+'/intent.json','utf8')),dispatch=JSON.parse(readFileSync(root+'/dispatch.json','utf8'));
  const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  const parse=bytes=>authority.parseColdSpawnerBootstrapClaimV1(bytes,intent,dispatch),bytes=readFileSync(root+'/claim.json');
  assert.deepEqual(parse(bytes),claim);assert.deepEqual(claim.source,intent.coldObservation.source);
  assert.throws(()=>parse(Buffer.from(JSON.stringify(claim,null,2)+'\\n')));
  for(const malformed of [Buffer.alloc(0),Buffer.alloc(65537),Buffer.from(canonical({...claim,claimHash:'0'.repeat(64)})+'\\n'),Buffer.from(bytes.toString().replace('"schema":','"schema":"duplicate","schema":'))])assert.throws(()=>parse(malformed));
  const mutations=[
   v=>v.schema+='x',v=>v.purpose+='x',v=>v.maximumClaimCount=2,v=>v.foreign=true,
   ...['intentRef','intentHash','dispatchRef','dispatchHash','epochRef','epochHash','genesisRef','genesisHash','profileHash'].map(k=>v=>v[k]='0'.repeat(64)),
   v=>v.source.sha='0'.repeat(40),v=>v.lockIdentity.inoDecimal='0',
   v=>v.child.pid=dispatch.helper.pid,v=>v.child.ppid=1,v=>v.child.pgid=1,v=>v.child.uid+=1,
   v=>v.child.command+=' --foreign',v=>v.child.processStartTimeEpochMs+=1000,v=>v.child.processIdentityHash='0'.repeat(64),v=>v.child.foreign=true,
   v=>v.startupFiles.pid+=1,v=>v.startupFiles.uid+=1,v=>v.startupFiles.schema+='x',v=>v.startupFiles.foreign=true,
   ...['singleton','pidFile'].flatMap(k=>[
    v=>v.startupFiles[k].path+='x',v=>v.startupFiles[k].uid+=1,v=>v.startupFiles[k].mode=0o644,
    v=>v.startupFiles[k].byteLength+=1,v=>v.startupFiles[k].bytesHash='0'.repeat(64),
    v=>v.startupFiles[k].inoDecimal='00',v=>v.startupFiles[k].devDecimal='-1',v=>v.startupFiles[k].identityHash='x',v=>v.startupFiles[k].foreign=true])
  ];
  for(const mutate of mutations){const crossed=structuredClone(claim);mutate(crossed);delete crossed.claimHash;delete crossed.claimRef;
   crossed.claimHash=createHash('sha256').update(canonical(crossed)).digest('hex');crossed.claimRef='setfarm://internal-production/cold-spawner-bootstrap-claim/sha256/'+crossed.claimHash;
   assert.throws(()=>parse(Buffer.from(canonical(crossed)+'\\n')),'self-hashed crossed claim must refuse');}
 }
 accepted=true;child.stderr.destroy();child.unref();process.stdout.write(JSON.stringify({accepted:true,childPid:child.pid,claim}));
 }
}catch(error){process.stdout.write(JSON.stringify({accepted:false,message:error.message}));}
finally{if(child&&!accepted){child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();child.once('close',resolve);setTimeout(resolve,1000)});}if(readyFd!==undefined)closeSync(readyFd);context?.close();}
`);
    }
    if (fault.startsWith("claim-real-helper")) compile("internal-production/baseline-service-restart-helper-v1.ts", source => {
      const mode = fault.slice("claim-real-helper-controller-wire-".length);
      if (!fault.startsWith("claim-real-helper-controller-wire-")) return source;
      const coldStart = source.indexOf('  if (process.env.SETFARM_INTERNAL_PRODUCTION_COLD_HELPER !== undefined) {');
      assert.ok(coldStart > 0); const originalPrefix = source.slice(0, coldStart); source = source.slice(coldStart);
      const expressions: Record<string, string> = {
        missing: '""', truncated: 'JSON.stringify(completion).slice(0,-1)', duplicate: 'canonical(completion)+"\\n"+canonical(completion)+"\\n"',
        oversize: '"x".repeat(4097)', "extra-key": 'canonical({...completion,foreign:true})+"\\n"', noncanonical: 'JSON.stringify(completion,null,2)+"\\n"',
        "crossed-identity": 'canonical({...completion,claimIdentity:["0",...(completion.claimIdentity as string[]).slice(1)]})+"\\n"',
      };
      source = source.replace('    await new Promise<void>((resolve, reject) => {', `
        writeFileSync(${JSON.stringify(path.join(root, "fixture-controller-wire"))},${JSON.stringify(mode)});
        let fixtureCompletionText=${expressions[mode] ?? 'canonical(completion)+"\\n"'};
        ${mode === "fragmented" ? "const half=Math.floor(fixtureCompletionText.length/2);process.stdout.write(fixtureCompletionText.slice(0,half));await new Promise(resolve=>setTimeout(resolve,100));fixtureCompletionText=fixtureCompletionText.slice(half);" : ""}
    await new Promise<void>((resolve, reject) => {`);
      const completionWrite = 'process.stdout.write(`${JSON.stringify(completion)}\\n`,';
      assert.equal(source.split(completionWrite).length - 1, 1, "instrument only the cold completion branch");
      source = source.replace(completionWrite, 'process.stdout.write(fixtureCompletionText,');
      if (mode === "nonzero") source = source.replace('    return;\n  }\n  const frameBytes', '    process.exitCode=1;return;\n  }\n  const frameBytes');
      return originalPrefix + source;
    });
    if (fault.startsWith("claim-real-helper-controller-settlement")) installColdControllerServiceCensusFixtureV1(root, typescript);
    const entries: Array<{ locator: string; mode: number; byteLength: number; sha256: string }> = [];
    const visit = (directory: string) => {
      chmodSync(directory, 0o755);
      for (const name of readdirSync(directory).sort()) {
        const target = path.join(directory, name);
        if (lstatSync(target).isDirectory()) visit(target);
        else { const locator = path.relative(root, target), mode = locator === "dist/cli/cli.js" ? 0o755 : 0o644; chmodSync(target, mode); const bytes = readFileSync(target); entries.push({ locator, mode, byteLength: bytes.length, sha256: sha256(bytes) }); }
      }
    };
    visit(path.join(root, "dist"));entries.sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
    const body = { schema: "setfarm.platform-build-output-tree.v1", sourceSha: profile.profile.source.sha, sourceTreeHash: profile.profile.source.treeHash, entries };
    const artifacts = [Buffer.from('{"fixture":"build-info"}\n'), Buffer.from(`${JSON.stringify({ ...body, outputTreeHash: sha256(canonical(body)) })}\n`), Buffer.from('{"fixture":"release-manifest"}\n')];
    for (const [index, name] of ["BUILD_INFO.json", "PLATFORM_BUILD_OUTPUT_TREE.json", "PLATFORM_RELEASE_MANIFEST.json"].entries()) writeFileSync(path.join(root, "dist", name), artifacts[index]!, { mode: 0o444 });
    const identity = (target: string) => { const s = lstatSync(target, { bigint: true }); return { devDecimal: String(s.dev), inoDecimal: String(s.ino), uid: Number(s.uid), gid: Number(s.gid), mode: Number(s.mode & 0o7777n) }; };
    const dirs = new Set<string>();
    const add = (target: string) => { if (dirs.has(target)) return; if (path.dirname(target) !== target) add(path.dirname(target)); dirs.add(target); };
    for (const target of [root, path.join(root, "dist"), homedir(), path.join(homedir(), "Library/LaunchAgents"), profile.environment.SETFARM_ENV_DIR, path.dirname(process.execPath)]) add(target);
    Object.assign(profile.profile, { home: homedir(), workspace: root, rootIdentity: identity(root), hostDirectories: [...dirs].map((target) => ({ path: target, ...identity(target) })),
      executable: { path: process.execPath, ...identity(process.execPath), bytesHash: sha256(readFileSync(process.execPath)) }, environmentDirectory: profile.environment.SETFARM_ENV_DIR,
      buildInfoBytesHash: sha256(artifacts[0]!), outputTreeBytesHash: sha256(artifacts[1]!), releaseManifestBytesHash: sha256(artifacts[2]!),
      plistBytesHash: "1".repeat(64), loadedLaunchProjectionHash: "2".repeat(64), environmentFiles: [".env", ".env.local"].map((name) => ({ path: path.join(profile.environment.SETFARM_ENV_DIR, name), state: "absent" })) });
    if (fault === "node-hash") profile.profile.executable.bytesHash = "0".repeat(64);
    if (fault === "host-identity") profile.profile.hostDirectories.find((entry: any) => entry.path === profile.environment.SETFARM_ENV_DIR).inoDecimal = "1";
    const cold = structuredClone(Reflect.get(globalThis, "__coldGenesisObservation"));
    if (fault.startsWith("claim-real-helper-pid-residue")) {
      const predecessor = spawnSync(process.execPath, ["-e", ""], { env: { PATH: "/usr/bin:/bin" } });
      assert.equal(predecessor.status, 0);
      const pidPath = path.join(root, ".openclaw/setfarm/spawner.pid"), bytes = String(predecessor.pid);
      writeFileSync(pidPath, bytes, { mode: 0o644, flag: "wx" });
      const s = lstatSync(pidPath, { bigint: true });
      cold.spawnerAbsence.pidFile = { state: "stale-dead-pid", pid: predecessor.pid, bytesSha256: sha256(bytes), identity: {
        dev: String(s.dev), ino: String(s.ino), uid: String(s.uid), mode: Number(s.mode & 0o7777n), nlink: String(s.nlink),
        size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs),
      } };
    }
    cold.spawnerAbsence.ancestors = [root, path.join(root, ".openclaw"), path.join(root, ".openclaw/setfarm")].map((target) => {
      const s = lstatSync(target, { bigint: true });
      return { path: target, dev: String(s.dev), ino: String(s.ino), uid: String(s.uid), mode: Number(s.mode & 0o7777n), nlink: String(s.nlink), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
    });
    delete cold.spawnerAbsence.absenceHash; cold.spawnerAbsence.absenceHash = sha256(canonical(cold.spawnerAbsence));
    delete cold.observationHash; cold.observationHash = sha256(canonical(cold));
    Reflect.set(globalThis, "__coldGenesisObservation", recursivelyFreeze(cold));
  }, fault === "claim-real-helper-controller-settlement-fresh");
}

test("shared runtime refusal permanently revokes the original cold child authority", async () => {
  for (const fault of ["selector-entry", "selector-descriptor"]) {
  const fixture = await createAuthenticatedColdChildFixtureV1(fault);
  try {
    const result = fixture.run();
    assert.equal(result.accepted, true, result.message);
  } finally { fixture.close(); }
  }
});

test("real cold child authenticates its distinct descriptor chain before runtime configuration", async () => {
  assert.ok(readFileSync(sourcePath, "utf8").includes("function resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1("), "synchronous cold child authentication is not implemented");
  for (const fault of ["none", "late-output", "node-close", "authority-close", "directory-close", "output-file-close", "output-directory-close", "missing-marker", "bad-marker", "both-markers", "missing-frame", "helper-frame", "crossed-lock", "crossed-dispatch", "wrong-parent", "not-detached", "extra-argv", "wrong-cwd", "output-drift", "node-hash", "host-identity", "reserved-environment", "nonce", "environment"]) {
  const fixture = await createAuthenticatedColdChildFixtureV1(fault);
  try {
    const result = fixture.run();
    if (fault === "none" || fault === "late-output") {
      assert.equal(result.accepted, true, result.message);
      assert.ok(result.childPid > 0 && result.helperPid > 0 && result.childPid !== result.helperPid);
    } else assert.equal(result.childRefused, true, `${fault}: ${result.message}`);
  } finally { fixture.close(); }
  }
});

test("real cold main publishes one owned claim and stays sealed after helper departure", async () => {
  for (const fault of ["claim-host-sibling", "claim", "claim-helper-departure", "claim-late-pid", "claim-late-lock", "claim-host-mode", "claim-host-inode", "claim-host-symlink"]) {
  const fixture = await createAuthenticatedColdChildFixtureV1(fault);
  let childPid: number | undefined;
  const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,pgid=,command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } }).stdout.trim();
  try {
    const result = fixture.run();
    childPid = result.childPid;
    const earlyError = path.join(fixture.fixture, "fixture-claim-error");
    assert.equal(result.accepted, true, `${fault}: ${result.message}; ${existsSync(earlyError) ? readFileSync(earlyError, "utf8") : "no authority error"}`);
    assert.ok(Number.isSafeInteger(childPid) && childPid! > 0);
    assert.match(identity(childPid!), new RegExp(`^1\\s+${childPid}\\s+`), "sealed child survives real helper departure as its own detached group");
    const runtime = path.join(fixture.fixture, ".openclaw/setfarm");
    const readyDeadline = Date.now() + 5000;
    while (Date.now() < readyDeadline && !existsSync(path.join(runtime, "fixture-claim-ready")) && identity(childPid!)) await new Promise((resolve) => setTimeout(resolve, 20));
    const errorPath = path.join(fixture.fixture, "fixture-claim-error");
    assert.equal(existsSync(path.join(runtime, "fixture-claim-ready")), true, `${fault}: claim must finish and runtime configuration must remain authenticated; ${existsSync(errorPath) ? readFileSync(errorPath, "utf8") : "no authority error"}`);
    assert.equal(readFileSync(path.join(runtime, "spawner.pid"), "utf8"), String(childPid));
    assert.equal(readFileSync(path.join(runtime, "spawner.lock"), "utf8"), `${childPid}\n`);
    assert.equal(result.claim.schema, "setfarm.internal-production-cold-spawner-bootstrap-claim.v1");
    assert.deepEqual(result.claim.source, fixture.intent.coldObservation.source);
    assert.equal(result.claim.dispatchHash, JSON.parse(readFileSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/dispatch.json"), "utf8")).dispatchHash);
    process.kill(childPid!, "SIGTERM");
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && identity(childPid!)) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(identity(childPid!), "", "sealed SIGTERM terminates the exact child");
    assert.equal(existsSync(path.join(runtime, "spawner.pid")), fault === "claim-late-pid", "only a foreign replacement PID is preserved");
    assert.equal(existsSync(path.join(runtime, "spawner.lock")), fault === "claim-late-lock", "only a foreign replacement singleton is preserved");
    assert.equal(existsSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/claim.json")), true, "stop preserves the durable journal");
  } finally {
    if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
      process.kill(childPid, "SIGTERM");
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && identity(childPid)) await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(identity(childPid), "", "fixture cleanup waits for its exact child to exit");
    }
    fixture.close();
  }
  }
});

test("actual fixed cold helper launches one genuine sealed main and exits", async (context) => {
  for (const suffix of ["journal-aba", "output-drift", "parent-transition", "", "claim-replace", "pid-restore", "lock-restore", "fragmented", "empty", "malformed", "extra-key", "oversize", "truncated", "duplicate", "noncanonical", "crossed-hash", "crossed-identity", "pipe-close", "spawn-error"]) {
    await context.test(suffix || "normal", () => exerciseActualColdHelperV1(suffix));
  }
});

test("actual cold helper EOF timeout waits for its deliberately delayed readiness write", () => exerciseActualColdHelperV1("no-eof"));

test("actual fixed cold helper consumes only its authenticated PID residue", async () => {
  for (const mode of ["diagnostic-barrier", "", "probe-replace", "probe-restore", "probe-singleton", "probe-live", "replace", "restore", "other-dead", "symlink", "ancestor", "singleton", "absent", "live", "eperm", "unlink", "fsync", "close", "concurrent", "replay", "stop"]) {
    await exerciseActualColdHelperV1(`pid-residue${mode ? `-${mode}` : ""}`);
  }
});

test("cold child accepts its actual helper departure after the settled parent row", async () => {
  await exerciseActualColdHelperV1("late-parent-transition");
});

function installColdControllerServiceCensusFixtureV1(root: string, typescript: typeof import("typescript")): void {
  const receipt = readFileSync(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-post-handoff-receipt-v1.ts"), "utf8");
  const tree = typescript.createSourceFile("receipt.ts", receipt, typescript.ScriptTarget.Latest, true);
  const names = new Set(["fail", "currentEntryFail", "strictUtf8", "isPlainRecord", "hasExactKeys", "canonicalComparable", "recursivelyFreeze", "directorySnapshot", "sameDirectory", "assertDirectory", "sameRegularMetadata", "readStableRegular", "runPhysicalCommandV1", "parsePhysicalProcessesV1", "lsofFieldsV1", "parseProcessListenersV1", "boundedChildBytes", "boundedChildText", "detachedSetfarmServiceProfileV1", "oneLaunchctlScalarV1", "oneLaunchctlBlockV1", "launchctlEnvironmentBlockV1", "observeDetachedLaunchProjectionV1", "observeDetachedLaunchPlistV1", "parseDetachedLaunchPlistV1", "sameStableRegularV1", "observeDetachedServiceListenersV1", "observeDetachedSetfarmServiceV1"]);
  const declarations = tree.statements.filter(statement => typescript.isFunctionDeclaration(statement) && statement.name && names.has(statement.name.text));
  assert.equal(declarations.length, names.size, "ordinary census fixture extracts every named production boundary once");
  const launcher = path.join(root, ".local/bin/setfarm"), label = "com.setrox.setfarm-spawner";
  mkdirSync(path.dirname(launcher), { recursive: true, mode: 0o700 });
  mkdirSync(path.join(root, "dist/cli"), { recursive: true, mode: 0o755 });
  if (!existsSync(path.join(root, "dist/cli/cli.js"))) writeFileSync(path.join(root, "dist/cli/cli.js"), "throw Error('fixture launcher must never execute');\n");
  symlinkSync(path.join(root, "dist/cli/cli.js"), launcher);
  const plist = path.join(root, "Library/LaunchAgents", `${label}.plist`);
  mkdirSync(path.dirname(plist), { recursive: true, mode: 0o700 });
  writeFileSync(plist, JSON.stringify({ Label: label, RunAtLoad: true, StartInterval: 60, ProgramArguments: [launcher, "spawner", "start"],
    EnvironmentVariables: { PATH: "/usr/bin:/bin", SETFARM_PG_URL: "postgresql://fixture/setfarm" },
    StandardOutPath: path.join(root, ".openclaw/logs/setfarm-spawner.watch.log"), StandardErrorPath: path.join(root, ".openclaw/logs/setfarm-spawner.watch.err.log") }), { mode: 0o600 });
  const launchText = `gui/${process.getuid!()}/${label} = {\n\tactive count = 0\n\tpath = ${plist}\n\ttype = LaunchAgent\n\tstate = not running\n\tprogram = ${launcher}\n\targuments = {\n\t\t${launcher}\n\t\tspawner\n\t\tstart\n\t}\n\tinherited environment = {\n\t\tSETFARM_ENV_DIR => ${path.join(root, "ai/setrox/setfarm/scripts")}\n\t\tSSH_AUTH_SOCK => /var/run/com.apple.launchd.Fixture123/Listeners\n\t}\n\tdefault environment = {\n\t\tPATH => /usr/bin:/bin:/usr/sbin:/sbin\n\t}\n\tenvironment = {\n\t\tOSLogRateLimit => 64\n\t\tPATH => /usr/bin:/bin\n\t\tSETFARM_PG_URL => postgresql://fixture/setfarm\n\t\tXPC_SERVICE_NAME => ${label}\n\t}\n\trun interval = 60 seconds\n\tproperties = runatload | inferred program\n}\n`;
  const production = declarations.map(statement => statement.getText(tree)).join("\n")
    .replace("function boundedChildBytes(", "function actualBoundedChildBytes(");
  const harness = `
import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {closeSync,constants,fstatSync,lstatSync,openSync,readFileSync,realpathSync} from 'node:fs';import path from 'node:path';
const CURRENT_ENTRY_MAX_BYTES=1048576,MAX_BUILD_FILE_BYTES_V1=33554432,PHYSICAL_COMMAND_CAP_V1=1048576,PHYSICAL_PROCESS_CAP_V1=4096;
const UTF8=new TextDecoder('utf-8',{fatal:true});
const PHYSICAL_ENV_V1=Object.freeze({PATH:'/usr/bin:/bin:/usr/sbin:/sbin',LANG:'C',LC_ALL:'C'});
function fixedRepositoryRoot(){return ${JSON.stringify(root)}}
function userInfo(){return {homedir:${JSON.stringify(root)}}}
function sha256(value){return createHash('sha256').update(value).digest('hex')}
function hashCanonicalJson(value){return sha256(canonicalComparable(value))}
function compareBytes(a,b){return Buffer.compare(Buffer.from(a),Buffer.from(b))}
function boundedChildBytes(executable,args,label,input){
 if(executable==='/bin/launchctl'){
  if(JSON.stringify(args)!==JSON.stringify(['print','gui/'+process.getuid()+'/com.setrox.setfarm-spawner']))throw Error('fixture launchctl crossed');
  return Buffer.from(${JSON.stringify(launchText)});
 }
 return actualBoundedChildBytes(executable,args,label,input);
}
${production}
export function observeFixtureSpawner(){const {profile}=JSON.parse(readFileSync(${JSON.stringify(path.join(root, "cold-child-fixture-profile.json"))},'utf8'));const source={sha:profile.source.sha,treeHash:profile.source.treeHash,buildHash:profile.source.buildHash};return observeDetachedSetfarmServiceV1('com.setrox.setfarm-spawner',null,source)}
`;
  writeFileSync(path.join(root, "ordinary-spawner-census-fixture.mjs"), typescript.transpileModule(harness, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
}

test("actual cold controller binds settlement to the genuine ordinary spawner observation", async () => {
  const fixture = await createAuthenticatedColdChildFixtureV1("claim-real-helper-controller-settlement");
  let childPid: number | undefined;
  const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
  try {
    const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
    Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
    const claim = await fixture.isolated.invokeColdControllerFixtureV1().catch((error: Error) => {
      const diagnostic = path.join(fixture.fixture, "fixture-claim-error");
      throw Error(`${error.message}${existsSync(diagnostic) ? `; child: ${readFileSync(diagnostic, "utf8")}` : ""}`, { cause: error });
    }); childPid = claim.child.pid;
    const ordinary = await import(pathToFileURL(path.join(fixture.fixture, "ordinary-spawner-census-fixture.mjs")).href);
    const spawner = ordinary.observeFixtureSpawner();
    assert.equal(spawner.pid, childPid);
    assert.equal(spawner.processStartTimeEpochMs, claim.child.processStartTimeEpochMs);
    assert.equal(spawner.processIdentityHash, sha256(`${childPid}\n${claim.child.lstart}\n`));
    assert.notEqual(spawner.processIdentityHash, claim.child.processIdentityHash, "ordinary identity is not the claim's transition-lock-domain hash");
    assert.equal(spawner.listener, null);
    Reflect.set(globalThis, "__coldControllerServiceCensusObserver", async () => {
      const body = { schema: "setfarm.internal-production-service-census.v1", spawner: ordinary.observeFixtureSpawner(), ...Reflect.get(globalThis, "__coldGenesisObservation").remainingServices };
      return { ...body, censusHash: sha256(canonical(body)) };
    });
    const terminal = await fixture.isolated.settleColdControllerFixtureV1();
    assert.equal(terminal.serviceCensus.spawner.pid, childPid);
    assert.equal(terminal.completion.claimHash, claim.claimHash);
    assert.equal(canonical(await fixture.isolated.settleColdControllerFixtureV1()), canonical(terminal));
    assert.equal(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8"), `${childPid}\n`);
    assert.equal(readFileSync(path.join(fixture.root, "cold-spawner-bootstrap-controller-settlement-v1.json"), "utf8"), `${canonical(terminal)}\n`);
    const historical = fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    assert.equal(historical.state, "settled");
    assert.equal(historical.incompleteOwnerCount, 0);
    assert.equal(canonical(historical.settlement), canonical(terminal));
    let preparations = 0;
    Reflect.set(globalThis, "__coldControllerPreparationHook", () => { preparations++; });
    await assert.rejects(fixture.isolated.invokeFreshColdControllerFixtureV1());
    Reflect.deleteProperty(globalThis, "__coldControllerPreparationHook");
    assert.equal(preparations, 0, "settled history must refuse before another cold preparation");
    assert.ok(identity(childPid!).includes(path.join(fixture.fixture, "dist/spawner.js")));
    process.kill(childPid!, "SIGTERM");
    const stopped = Date.now() + 5000;
    while (Date.now() < stopped && identity(childPid!)) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(identity(childPid!), "");
    assert.throws(() => ordinary.observeFixtureSpawner(), undefined, "immutable history cannot prove a departed process is live");
    assert.equal(canonical(fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1()), canonical(historical));
    writeFileSync(path.join(fixture.root, "epoch-head.json"), "advanced fixture epoch\n", { mode: 0o600 });
    writeFileSync(path.join(fixture.fixture, "dist/spawner.js"), "changed disposable output\n");
    assert.equal(canonical(fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1()), canonical(historical), "history does not read mutable epoch, current output or old live startup files");
    const terminalPath = path.join(fixture.root, "cold-spawner-bootstrap-controller-settlement-v1.json");
    renameSync(terminalPath, `${terminalPath}.preserved`); writeFileSync(terminalPath, `${canonical(terminal)}\n`, { mode: 0o600 });
    const replaced = fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    assert.equal(canonical(replaced.settlement), canonical(terminal));
    assert.notEqual(replaced.censusHash, historical.censusHash, "phase A/B census detects same-byte terminal inode replacement");
  } finally {
    Reflect.deleteProperty(globalThis, "__coldControllerPreparationHook");
    Reflect.deleteProperty(globalThis, "__coldControllerCompiledOutputVerifier"); Reflect.deleteProperty(globalThis, "__coldControllerServiceCensusObserver");
    if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
    if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
      process.kill(childPid, "SIGTERM"); const deadline = Date.now() + 5000;
      while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(identity(childPid), "", "settlement fixture stops only its genuine child before removal");
    }
    fixture.close();
  }
});

test("cold controller facade resumes its sole owner and returns only authenticated settled history", async () => {
  for (const mode of ["fresh", "intent-only", "claim-observed", "settled-dead", "releasing", "response-lost", "concurrent", "unretained-partial", "post-release-replace"]) {
    const fixture = await createAuthenticatedColdChildFixtureV1(`claim-real-helper-controller-settlement-${mode === "fresh" ? "fresh" : "facade"}`);
    let childPid: number | undefined;
    const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
    const stop = async () => {
      if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
      if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
        process.kill(childPid, "SIGTERM"); const deadline = Date.now() + 5000;
        while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(identity(childPid), "", "facade fixture stops only its genuine child");
      }
    };
    try {
      assert.equal(typeof fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1, "function", "production zero-argument controller facade exists");
      assert.equal(fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1.length, 0);
      if (mode === "fresh") {
        assert.equal(existsSync(fixture.lock), false);
        assert.equal(existsSync(fixture.epoch), false);
        assert.equal(existsSync(path.join(fixture.root, "cold-spawner-bootstrap-v1")), false);
        assert.equal(fixture.isolated.inspectColdIntentFixtureV1(), null);
      }
      const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
      Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
      const ordinary = await import(pathToFileURL(path.join(fixture.fixture, "ordinary-spawner-census-fixture.mjs")).href);
      Reflect.set(globalThis, "__coldControllerServiceCensusObserver", async () => {
        const body = { schema: "setfarm.internal-production-service-census.v1", spawner: ordinary.observeFixtureSpawner(), ...Reflect.get(globalThis, "__coldGenesisObservation").remainingServices };
        return { ...body, censusHash: sha256(canonical(body)) };
      });
      if (mode === "unretained-partial") {
        const before = coldGenesisTreeSnapshotV1(fixture.root);
        await assert.rejects(fixture.isolated.ensureUnretainedColdControllerFixtureV1(), /COLD_BOOTSTRAP_UNSETTLED/);
        assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before);
        assert.equal(existsSync(path.join(fixture.fixture, "fixture-spawn-pids")), false);
        continue;
      }
      if (["claim-observed", "settled-dead", "releasing"].includes(mode)) {
        const claim = await fixture.isolated.invokeColdControllerFixtureV1(); childPid = claim.child.pid;
      }
      if (["settled-dead", "releasing"].includes(mode)) {
        await fixture.isolated.settleColdControllerFixtureV1();
        await stop();
        writeFileSync(path.join(fixture.root, "epoch-head.json"), "advanced fixture epoch\n");
        Reflect.set(globalThis, "__coldControllerServiceCensusObserver", () => { throw Error("historical facade must not observe old live child"); });
      }
      if (mode === "releasing") {
        Reflect.set(globalThis, "__coldReleaseAfterUnlinkHook", () => { throw Error("fixture retained release response loss"); });
        await assert.rejects(fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1(), /retained release response loss/);
        assert.equal(existsSync(fixture.lock), false);
        Reflect.deleteProperty(globalThis, "__coldReleaseAfterUnlinkHook");
      }
      if (mode === "post-release-replace") Reflect.set(globalThis, "__coldControllerReleasedHook", () => {
        const target = path.join(fixture.root, "cold-spawner-bootstrap-controller-settlement-v1.json"), bytes = readFileSync(target);
        renameSync(target, `${target}.preserved`); writeFileSync(target, bytes, { mode: 0o600 });
      });
      if (mode === "post-release-replace") {
        await assert.rejects(fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1(), undefined, "original final identity remains bound across release");
        assert.equal(fixture.isolated.inspectColdIntentFixtureV1(), null);
        continue;
      }
      const pending = fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1();
      if (mode === "concurrent") await assert.rejects(fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1(), /already active/);
      const historical = await pending;
      if (mode === "response-lost") await assert.rejects((async () => { throw Error("fixture caller lost committed facade result"); })());
      assert.equal(historical.state, "settled");
      assert.equal(fixture.isolated.inspectColdIntentFixtureV1(), null);
      assert.equal(existsSync(fixture.lock), false, "facade returns only after original physical ownership is drained");
      childPid = historical.settlement.serviceCensus.spawner.pid;
      assert.equal(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8"), `${childPid}\n`, "one retained helper produces one child");
      await stop();
      Reflect.set(globalThis, "__coldControllerPreparationHook", () => { throw Error("historical facade must never prepare again"); });
      const before = coldGenesisTreeSnapshotV1(fixture.root);
      assert.equal(canonical(await fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1()), canonical(historical));
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before, "unretained historical replay is read-only");
    } finally {
      for (const key of ["CompiledOutputVerifier", "ServiceCensusObserver", "ReleasedHook", "PreparationHook"]) Reflect.deleteProperty(globalThis, `__coldController${key}`);
      Reflect.deleteProperty(globalThis, "__coldReleaseAfterUnlinkHook");
      await stop(); fixture.close();
    }
  }
});

test("cold controller release drains its real owned resources after historical settlement", async () => {
  for (const mode of ["post-unlink-new-owner", "post-unlink", "authority-close", "guard-close", "lock-reader-close", "unlink", "parent-sync", "root-guard-close", "physical-close", "foreign-lock", "external-unlink", "terminal-replace", "pending", "success"]) {
  const owned = new Map<number, string>();
  Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, file: string) => owned.set(fd, String(file)));
  Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => owned.delete(fd));
  const fixture = await createAuthenticatedColdChildFixtureV1("claim-real-helper-controller-settlement-release");
  let childPid: number | undefined;
  const sentinels: number[] = [];
  const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
  try {
    owned.delete(fixture.handles.frameDescriptor); owned.delete(fixture.handles.intentDescriptor); // Two fixture-owned transport copies, not controller resources.
    const originalRootDescriptors = new Set([...owned].filter(([, file]) => file === fixture.root).map(([fd]) => fd));
    await assert.rejects(fixture.isolated.releaseColdControllerFixtureV1(), undefined, "unsettled cold state cannot release its only usable lease");
    assert.equal(fixture.isolated.inspectColdIntentFixtureV1().phase, "intent-only");
    const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
    Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
    const claim = await fixture.isolated.invokeColdControllerFixtureV1().catch((error: Error) => {
      const diagnostic = path.join(fixture.fixture, "fixture-claim-error");
      throw Error(`${mode}: ${error.message}; child diagnostic: ${existsSync(diagnostic) ? readFileSync(diagnostic, "utf8") : "absent"}`, { cause: error });
    }); childPid = claim.child.pid;
    const ordinary = await import(pathToFileURL(path.join(fixture.fixture, "ordinary-spawner-census-fixture.mjs")).href);
    Reflect.set(globalThis, "__coldControllerServiceCensusObserver", async () => {
      const body = { schema: "setfarm.internal-production-service-census.v1", spawner: ordinary.observeFixtureSpawner(), ...Reflect.get(globalThis, "__coldGenesisObservation").remainingServices };
      return { ...body, censusHash: sha256(canonical(body)) };
    });
    await fixture.isolated.settleColdControllerFixtureV1();
    const census = fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    assert.ok(identity(childPid!).includes(path.join(fixture.fixture, "dist/spawner.js")));
    process.kill(childPid!, "SIGTERM"); const deadline = Date.now() + 5000;
    while (Date.now() < deadline && identity(childPid!)) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(identity(childPid!), "");
    writeFileSync(path.join(fixture.root, "epoch-head.json"), "advanced fixture epoch\n");
    assert.ok(owned.size > 0, "actual controller owns descriptors before release");
    let fired = false, blocked = true, selected: number | undefined;
    if (mode === "authority-close") selected = [...owned].find(([, file]) => file === path.join(fixture.root, "epoch-head.json"))?.[0];
    if (mode === "guard-close") selected = [...owned].find(([fd, file]) => file === fixture.root && !originalRootDescriptors.has(fd))?.[0];
    if (mode === "root-guard-close") selected = [...originalRootDescriptors][0];
    if (mode === "physical-close") selected = fixture.state.descriptor;
    if (mode === "lock-reader-close") Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, file: string) => { owned.set(fd, String(file)); if (selected === undefined && file === fixture.lock) selected = fd; });
    if (mode.endsWith("-close")) Reflect.set(globalThis, "__coldFrameBeforeCloseHook", (fd: number) => { if (blocked && fd === selected) { fired = true; throw Error(`fixture ${mode}`); } });
    if (mode === "unlink") Reflect.set(globalThis, "__coldFrameBeforeUnlinkHook", (file: string) => { if (blocked && file === fixture.lock) { fired = true; throw Error("fixture lock unlink"); } });
    if (mode.startsWith("post-unlink")) Reflect.set(globalThis, "__coldReleaseAfterUnlinkHook", () => { if (blocked) { fired = true; if (mode === "post-unlink-new-owner") writeFileSync(fixture.lock, "new independent owner\n", { mode: 0o600, flag: "wx" }); throw Error("fixture after owned unlink"); } });
    if (mode === "parent-sync") Reflect.set(globalThis, "__coldFrameBeforeSyncHook", (fd: number) => { if (blocked && owned.get(fd) === fixture.root && !existsSync(fixture.lock)) { fired = true; throw Error("fixture lock parent sync"); } });
    const terminalPath = path.join(fixture.root, "cold-spawner-bootstrap-controller-settlement-v1.json");
    if (mode === "foreign-lock") { renameSync(fixture.lock, `${fixture.lock}.preserved`); writeFileSync(fixture.lock, "foreign lock\n", { mode: 0o600 }); }
    if (mode === "external-unlink") unlinkSync(fixture.lock);
    if (mode === "terminal-replace") { const bytes = readFileSync(terminalPath); renameSync(terminalPath, `${terminalPath}.preserved`); writeFileSync(terminalPath, bytes, { mode: 0o600 }); }
    if (mode === "pending") writeFileSync(path.join(fixture.root, `.${path.basename(terminalPath)}.pending`), "foreign pending", { mode: 0o600 });
    if (["foreign-lock", "external-unlink", "terminal-replace", "pending"].includes(mode)) {
      const before = coldGenesisTreeSnapshotV1(fixture.root);
      await assert.rejects(fixture.isolated.releaseColdControllerFixtureV1(), undefined, mode);
      await assert.rejects(fixture.isolated.releaseColdControllerFixtureV1(), undefined, `${mode}: retry cannot adopt crossed ownership`);
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before);
      continue;
    }
    if (mode !== "success") {
      const beforeDescriptors = new Set(owned.keys());
      await assert.rejects(fixture.isolated.releaseColdControllerFixtureV1(), undefined, mode);
      assert.equal(fired, true, `${mode}: real failure boundary reached`);
      const before = coldGenesisTreeSnapshotV1(fixture.root);
      await assert.rejects(fixture.isolated.invokeColdControllerFixtureV1());
      await assert.rejects(fixture.isolated.settleColdControllerFixtureV1());
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before, `${mode}: cleanup-only owner cannot launch or publish`);
      if (["authority-close", "guard-close", "lock-reader-close", "unlink"].includes(mode)) assert.equal(fstatSync(fixture.state.descriptor).nlink, 1, `${mode}: pre-unlink error retains physical fence`);
      else assert.equal(fstatSync(fixture.state.descriptor).nlink, 0, `${mode}: post-unlink cleanup never pretends the old fence remains`);
      if (mode === "authority-close") {
        const closed = [...beforeDescriptors].find(fd => !owned.has(fd)); assert.notEqual(closed, undefined);
        const file = path.join(fixture.fixture, "release-fd-reuse-sentinel"); writeFileSync(file, "sentinel", { mode: 0o600 });
        for (let count = 0; count < 256 && !sentinels.includes(closed!); count++) sentinels.push(openSync(file, constants.O_RDONLY));
        assert.ok(sentinels.includes(closed!), "a released managed FD number is reused by a foreign sentinel");
      }
      blocked = false;
    }
    const newOwner = mode === "post-unlink-new-owner" ? { identity: lstatSync(fixture.lock, { bigint: true }), bytes: readFileSync(fixture.lock) } : null;
    await fixture.isolated.releaseColdControllerFixtureV1();
    for (const fd of sentinels) assert.equal(readFileSync(fd, "utf8"), "sentinel", "release retry must not close reused foreign descriptors");
    assert.equal(owned.size, 0, `production release must drain managed resources before fixture cleanup: ${JSON.stringify([...owned])}`);
    if (newOwner) { assert.deepEqual(lstatSync(fixture.lock, { bigint: true }), newOwner.identity); assert.deepEqual(readFileSync(fixture.lock), newOwner.bytes); }
    else assert.equal(existsSync(fixture.lock), false);
    assert.equal(fixture.isolated.inspectColdIntentFixtureV1(), null);
    assert.equal(canonical(fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1()), canonical(census));
  } finally {
    for (const key of ["__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldControllerCompiledOutputVerifier", "__coldControllerServiceCensusObserver", "__coldFrameBeforeCloseHook", "__coldFrameBeforeUnlinkHook", "__coldFrameBeforeSyncHook", "__coldReleaseAfterUnlinkHook"]) Reflect.deleteProperty(globalThis, key);
    for (const fd of sentinels) closeSync(fd);
    if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
    if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) { process.kill(childPid, "SIGTERM"); const deadline = Date.now() + 5000; while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(identity(childPid), ""); }
    try { fixture.close(); } catch (error) { if (!String(error).includes("lease is foreign, cloned, or released")) throw error; fixture.cleanup(); }
  }
  }
});

test("cold settlement history rejects crossed immutable records without live process authority", async () => {
  for (const mode of ["profile-dist-omitted", "profile-launchagents-omitted", "profile-library-omitted", "profile-dist-mode", "profile-launchagents-mode", "profile-host-mode", "profile-root-owner", "late-intent", "pending-arrival", "reader-close", "guard-close", "profile-extra", "profile-relative-node", "profile-environment-secret", "pending", "pending-symlink", "orphan-final", "extra-member", "intent-replace", "dispatch-replace", "claim-replace", "genesis-replace", "journal-replace", "completion-pair", "completion-identity", "epoch-pair", "epoch-identity", "ordinary-hash", "remaining-service", "listener", "unknown-key", "bad-hash", "noncanonical"]) {
    const fixture = await createAuthenticatedColdChildFixtureV1("claim-real-helper-controller-settlement-history");
    let childPid: number | undefined;
    const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
    try {
      const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
      Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
      const claim = await fixture.isolated.invokeColdControllerFixtureV1(); childPid = claim.child.pid;
      const ordinary = await import(pathToFileURL(path.join(fixture.fixture, "ordinary-spawner-census-fixture.mjs")).href);
      Reflect.set(globalThis, "__coldControllerServiceCensusObserver", async () => {
        const body = { schema: "setfarm.internal-production-service-census.v1", spawner: ordinary.observeFixtureSpawner(), ...Reflect.get(globalThis, "__coldGenesisObservation").remainingServices };
        return { ...body, censusHash: sha256(canonical(body)) };
      });
      const terminal = structuredClone(await fixture.isolated.settleColdControllerFixtureV1());
      assert.equal(fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1().state, "settled", mode);
      assert.ok(identity(childPid!).includes(path.join(fixture.fixture, "dist/spawner.js")));
      process.kill(childPid!, "SIGTERM"); const deadline = Date.now() + 5000;
      while (Date.now() < deadline && identity(childPid!)) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(identity(childPid!), "");
      const root = path.join(fixture.root, "cold-spawner-bootstrap-v1"), target = path.join(fixture.root, "cold-spawner-bootstrap-controller-settlement-v1.json");
      if (mode.endsWith("-close")) {
        let blocked = true, descriptor: number | undefined, acquisitions = 0;
        const owned = new Set<number>();
        Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, file: string) => { acquisitions++; owned.add(fd); if (descriptor === undefined && file === (mode === "reader-close" ? target : root)) descriptor = fd; });
        Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => { owned.delete(fd); });
        Reflect.set(globalThis, "__coldFrameBeforeCloseHook", (fd: number) => { if (blocked && fd === descriptor) throw Error("fixture persistent historical close"); });
        assert.throws(() => fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1());
        assert.notEqual(descriptor, undefined);
        const originalAcquisitions = acquisitions;
        assert.throws(() => fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1());
        assert.equal(acquisitions, originalAcquisitions, `${mode}: unfinished cleanup fences every later acquisition`);
        blocked = false;
        assert.equal(fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1().state, "settled");
        assert.equal(owned.size, 0, `${mode}: next read drains exact retained resources`);
        continue;
      }
      const tuple = (file: string) => { const s = lstatSync(file, { bigint: true }); return [s.dev, s.ino, s.uid, s.gid, s.mode, s.nlink, s.size, s.birthtimeNs, s.mtimeNs, s.ctimeNs].map(String); };
      const hashRecord = (value: Record<string, any>, stem: string, prefix?: string) => { delete value[`${stem}Hash`]; if (prefix) delete value[`${stem}Ref`]; value[`${stem}Hash`] = sha256(canonical(value)); if (prefix) value[`${stem}Ref`] = `setfarm://internal-production/${prefix}/sha256/${value[`${stem}Hash`]}`; };
      if (mode.startsWith("profile-")) {
        const intentPath = path.join(root, "intent.json"), dispatchPath = path.join(root, "dispatch.json"), claimPath = path.join(root, "claim.json");
        const intent = JSON.parse(readFileSync(intentPath, "utf8")), dispatch = JSON.parse(readFileSync(dispatchPath, "utf8")), changedClaim = JSON.parse(readFileSync(claimPath, "utf8"));
        if (mode === "profile-extra") intent.launchProfile.unknownAuthority = true;
        if (mode === "profile-relative-node") intent.launchProfile.executable.path = "relative-node";
        if (mode === "profile-environment-secret") intent.launchProfile.environmentFiles[0].plaintext = "fixture-secret-must-not-be-durable";
        if (mode === "profile-host-mode" || mode === "profile-root-owner") {
          const key = mode === "profile-host-mode" ? "mode" : "uid", value = mode === "profile-host-mode" ? 0o777 : 0;
          intent.launchProfile.rootIdentity[key] = value;
          intent.launchProfile.hostDirectories.find((entry: any) => entry.path === fixture.fixture)[key] = value;
        }
        if (/^profile-(?:dist|launchagents|library)-/.test(mode)) {
          const target = mode.startsWith("profile-dist-") ? path.join(fixture.fixture, "dist") : path.join(homedir(), mode.startsWith("profile-library-") ? "Library" : "Library/LaunchAgents");
          if (mode.endsWith("-omitted")) intent.launchProfile.hostDirectories = intent.launchProfile.hostDirectories.filter((entry: any) => entry.path !== target);
          else intent.launchProfile.hostDirectories.find((entry: any) => entry.path === target).mode = 0o777;
        }
        hashRecord(intent.launchProfile, "profile"); hashRecord(intent, "intent", "cold-spawner-bootstrap-intent");
        writeFileSync(intentPath, `${canonical(intent)}\n`);
        dispatch.intentRef = intent.intentRef; dispatch.intentHash = intent.intentHash; dispatch.profileHash = intent.launchProfile.profileHash;
        if (mode === "profile-relative-node") {
          dispatch.action.executable = "relative-node"; dispatch.helper.command = `relative-node ${path.join(fixture.fixture, "dist/internal-production/baseline-service-restart-helper-v1.js")}`;
          const h = dispatch.helper; h.processIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: h.pid, processStartTimeEpochMs: h.processStartTimeEpochMs, lstart: h.lstart, command: h.command }));
          changedClaim.child.command = `relative-node ${path.join(fixture.fixture, "dist/spawner.js")}`;
          const c = changedClaim.child; c.processIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: c.pid, processStartTimeEpochMs: c.processStartTimeEpochMs, lstart: c.lstart, command: c.command }));
          const service = terminal.serviceCensus.spawner, label = "com.setrox.setfarm-spawner";
          service.serviceIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-service-identity.v1", label, command: c.command }));
          service.generationHash = sha256(canonical({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash: service.serviceIdentityHash, source: { sha: service.loadedSourceSha, treeHash: service.loadedTreeHash, buildHash: service.loadedBuildHash } }));
          hashRecord(terminal.serviceCensus, "census");
        }
        hashRecord(dispatch, "dispatch", "cold-spawner-bootstrap-dispatch"); writeFileSync(dispatchPath, `${canonical(dispatch)}\n`);
        Object.assign(changedClaim, { intentRef: intent.intentRef, intentHash: intent.intentHash, dispatchRef: dispatch.dispatchRef, dispatchHash: dispatch.dispatchHash, profileHash: intent.launchProfile.profileHash });
        hashRecord(changedClaim, "claim", "cold-spawner-bootstrap-claim"); writeFileSync(claimPath, `${canonical(changedClaim)}\n`);
        for (const [stem, value] of [["intent", intent], ["dispatch", dispatch], ["claim", changedClaim]] as const) {
          terminal.completion[`${stem}Ref`] = value[`${stem}Ref`]; terminal.completion[`${stem}Hash`] = value[`${stem}Hash`]; terminal.completion[`${stem}Identity`] = tuple(path.join(root, `${stem}.json`));
        }
      }
      if (mode === "pending") writeFileSync(path.join(fixture.root, `.${path.basename(target)}.pending`), "unfinished", { mode: 0o600 });
      if (mode === "pending-symlink") symlinkSync(path.join(fixture.fixture, "missing"), path.join(fixture.root, `.${path.basename(target)}.pending`));
      if (mode === "orphan-final") renameSync(root, `${root}.preserved`);
      if (mode === "extra-member") writeFileSync(path.join(root, "foreign.json"), "foreign", { mode: 0o600 });
      if (["intent-replace", "dispatch-replace", "claim-replace", "genesis-replace"].includes(mode)) {
        const hash = claim.genesisHash, file = mode === "genesis-replace" ? path.join(fixture.root, "epoch-genesis/sha256", hash.slice(0, 2), `${hash}.json`) : path.join(root, `${mode.split("-")[0]}.json`);
        const bytes = readFileSync(file); renameSync(file, `${file}.preserved`); writeFileSync(file, bytes, { mode: 0o600 });
        if (mode !== "genesis-replace") renameSync(`${file}.preserved`, path.join(fixture.fixture, `preserved-${mode}`));
      }
      if (mode === "journal-replace") { renameSync(root, `${root}.preserved`); mkdirSync(root, { mode: 0o700 }); for (const name of ["intent.json", "dispatch.json", "claim.json"]) renameSync(path.join(`${root}.preserved`, name), path.join(root, name)); }
      if (mode === "completion-pair") terminal.completion.claimHash = "0".repeat(64);
      if (mode === "completion-identity") terminal.completion.claimIdentity[9] = "0";
      if (mode === "epoch-pair") { terminal.epochEvidence.record.genesisHash = "0".repeat(64); hashRecord(terminal.epochEvidence.record, "epoch", "physical-service-restart-authority-epoch"); }
      if (mode === "epoch-identity") terminal.epochEvidence.identity[5] = "2";
      if (mode === "ordinary-hash") terminal.serviceCensus.spawner.processIdentityHash = claim.child.processIdentityHash;
      if (mode === "remaining-service") terminal.serviceCensus.dashboard.pid++;
      if (mode === "listener") terminal.serviceCensus.spawner.listener = { host: "127.0.0.1", port: 3333 };
      if (["ordinary-hash", "remaining-service", "listener"].includes(mode)) hashRecord(terminal.serviceCensus, "census");
      if (mode === "unknown-key") terminal.extra = true;
      hashRecord(terminal, "settlement", "cold-spawner-controller-settlement");
      if (mode === "bad-hash") terminal.settlementHash = "0".repeat(64);
      writeFileSync(target, mode === "noncanonical" ? JSON.stringify(terminal) : `${canonical(terminal)}\n`);
      let before = coldGenesisTreeSnapshotV1(fixture.root), fired = false;
      if (["late-intent", "pending-arrival"].includes(mode)) Reflect.set(globalThis, "__coldFrameBeforeOpenHook", (file: string) => {
        if (fired || !String(file).endsWith(`${claim.genesisHash}.json`)) return;
        fired = true;
        if (mode === "late-intent") { const file = path.join(root, "intent.json"); writeFileSync(file, readFileSync(file)); }
        else writeFileSync(path.join(fixture.root, `.${path.basename(target)}.pending`), "arrived", { mode: 0o600 });
        before = coldGenesisTreeSnapshotV1(fixture.root);
      });
      assert.throws(() => fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1(), /COLD_BOOTSTRAP_UNSETTLED/, mode);
      if (["late-intent", "pending-arrival"].includes(mode)) assert.equal(fired, true, `${mode}: mutation occurs inside the actual history read`);
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before, `${mode}: refusal never repairs history`);
    } finally {
      for (const key of ["__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldFrameBeforeCloseHook", "__coldFrameBeforeOpenHook"]) Reflect.deleteProperty(globalThis, key);
      Reflect.deleteProperty(globalThis, "__coldControllerCompiledOutputVerifier"); Reflect.deleteProperty(globalThis, "__coldControllerServiceCensusObserver");
      if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
      if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) { process.kill(childPid, "SIGTERM"); const deadline = Date.now() + 5000; while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(identity(childPid), ""); }
      fixture.close();
    }
  }
});

test("cold controller settlement retains original ownership through publication and census faults", async () => {
  for (const mode of ["pending-reappears", "link-after", "link-before", "unlink-after", "unlink-before", "final-sync", "short-write", "retry-service-drift", "response-loss", "file-sync", "parent-sync", "writer-close", "path-replace", "same-byte-write", "foreign-final", "crossed-process-hash", "crossed-generation", "changed-service", "second-census-drift", "late-intent"]) {
    const fixture = await createAuthenticatedColdChildFixtureV1("claim-real-helper-controller-settlement-fault");
    const target = path.join(fixture.root, "cold-spawner-bootstrap-controller-settlement-v1.json");
    const pending = path.join(fixture.root, ".cold-spawner-bootstrap-controller-settlement-v1.json.pending");
    let childPid: number | undefined, writer: number | undefined, fired = false, passes = 0, preSyncFired = false;
    const paths = new Map<number, string>();
    const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
    try {
      const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
      Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
      const claim = await fixture.isolated.invokeColdControllerFixtureV1(); childPid = claim.child.pid;
      const ordinary = await import(pathToFileURL(path.join(fixture.fixture, "ordinary-spawner-census-fixture.mjs")).href);
      Reflect.set(globalThis, "__coldControllerServiceCensusObserver", async () => {
        passes++;
        const body = { schema: "setfarm.internal-production-service-census.v1", spawner: ordinary.observeFixtureSpawner(), ...structuredClone(Reflect.get(globalThis, "__coldGenesisObservation").remainingServices) };
        if (mode === "crossed-process-hash") { fired = true; body.spawner = { ...body.spawner, processIdentityHash: claim.child.processIdentityHash }; }
        if (mode === "crossed-generation") { fired = true; body.spawner = { ...body.spawner, generationHash: "0".repeat(64) }; }
        if (mode === "changed-service" || mode === "second-census-drift" && passes % 2 === 0 || mode === "retry-service-drift" && fired) { fired = true; body.dashboard.pid++; }
        if (mode === "late-intent" && passes === 2) { fired = true; const intent = path.join(fixture.root, "cold-spawner-bootstrap-v1/intent.json"); writeFileSync(intent, readFileSync(intent)); }
        return { ...body, censusHash: sha256(canonical(body)) };
      });
      Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, file: string, flags: number) => { paths.set(fd, String(file)); if (file === pending && (flags & constants.O_EXCL) !== 0) writer = fd; });
      Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => { paths.delete(fd); });
      Reflect.set(globalThis, "__coldFrameSyncHook", (fd: number) => {
        if (fired || writer === undefined) return;
        if (mode === "final-sync" && paths.get(fd) === path.dirname(target) && !existsSync(pending)) { fired = true; throw Error("fixture final settlement sync failure"); }
        if (["file-sync", "retry-service-drift"].includes(mode) && fd === writer || mode === "parent-sync" && paths.get(fd) === path.dirname(target)) { fired = true; throw Error("fixture settlement sync failure"); }
        if ((mode === "path-replace" || mode === "same-byte-write") && fd === writer) {
          fired = true; const changed = existsSync(target) ? target : pending, bytes = readFileSync(changed); if (mode === "path-replace") unlinkSync(changed); writeFileSync(changed, bytes, { mode: 0o600 });
        }
      });
      Reflect.set(globalThis, "__coldFrameBeforeCloseHook", (fd: number) => { if (mode === "writer-close" && fd === writer && !fired) { fired = true; throw Error("fixture settlement close failure"); } });
      Reflect.set(globalThis, "__coldFrameBeforeSyncHook", (fd: number) => { if (mode === "link-after" && fired && !preSyncFired && paths.get(fd) === path.dirname(target)) { preSyncFired = true; throw Error("fixture interrupted-link recovery pre-sync failure"); } });
      Reflect.set(globalThis, "__coldFrameWriteHook", (fd: number, bytes: Buffer) => { if (mode === "short-write" && fd === writer && !fired) { fired = true; writeFileSync(fd, bytes.subarray(0, 1)); throw Error("fixture settlement short write"); } });
      for (const [fault, key] of [["link-before", "__coldFrameBeforeLinkHook"], ["link-after", "__coldFrameLinkedHook"], ["unlink-before", "__coldFrameBeforeUnlinkHook"], ["unlink-after", "__coldFrameUnlinkHook"]]) {
        if (mode === fault) Reflect.set(globalThis, key!, (file: string) => { if (file === pending && !fired) { fired = true; throw Error(`fixture ${fault} interruption`); } });
      }
      if (mode === "response-loss") Reflect.set(globalThis, "__coldControllerAfterSettlementHook", () => { fired = true; Reflect.deleteProperty(globalThis, "__coldControllerAfterSettlementHook"); throw Error("fixture settlement response lost"); });
      if (mode === "pending-reappears") Reflect.set(globalThis, "__coldControllerAfterSettlementHook", () => { fired = true; Reflect.deleteProperty(globalThis, "__coldControllerAfterSettlementHook"); writeFileSync(pending, "foreign pending owner", { mode: 0o600, flag: "wx" }); throw Error("fixture pending reappeared after commit"); });
      if (mode === "foreign-final") { fired = true; writeFileSync(target, "foreign", { mode: 0o600, flag: "wx" }); }
      await assert.rejects(fixture.isolated.settleColdControllerFixtureV1(), undefined, mode);
      assert.equal(fired, true, `${mode}: actual boundary must be reached`);
      if (["short-write", "file-sync", "parent-sync", "writer-close", "retry-service-drift"].includes(mode)) assert.equal(existsSync(path.join(fixture.root, ".cold-spawner-bootstrap-controller-settlement-v1.json.pending")), true, `${mode}: unfinished settlement must retain a filesystem-visible pending owner`);
      if (mode === "short-write") assert.equal(paths.has(writer!), false, "nonresumable partial publication must close its exact writer while retaining the file and lease");
      if (["response-loss", "file-sync", "parent-sync", "writer-close", "link-before", "link-after", "unlink-before", "unlink-after", "final-sync"].includes(mode)) {
        if (mode === "link-after") {
          await assert.rejects(fixture.isolated.settleColdControllerFixtureV1(), /pre-sync failure/);
          assert.equal(preSyncFired, true);
          assert.equal(existsSync(pending), true, "interrupted-link recovery cannot remove pending before the final link is synced");
          assert.equal(lstatSync(target).nlink, 2);
        }
        const result = await fixture.isolated.settleColdControllerFixtureV1();
        assert.equal(readFileSync(target, "utf8"), `${canonical(result)}\n`);
        assert.equal(canonical(await fixture.isolated.settleColdControllerFixtureV1()), canonical(result));
      } else {
        const before = existsSync(target) ? { ino: lstatSync(target).ino, bytes: readFileSync(target) } : null;
        const pendingBefore = existsSync(pending) ? { ino: lstatSync(pending).ino, bytes: readFileSync(pending) } : null;
        await assert.rejects(fixture.isolated.settleColdControllerFixtureV1(), undefined, `${mode}: retry cannot repair crossed ownership`);
        assert.deepEqual(existsSync(target) ? { ino: lstatSync(target).ino, bytes: readFileSync(target) } : null, before);
        assert.deepEqual(existsSync(pending) ? { ino: lstatSync(pending).ino, bytes: readFileSync(pending) } : null, pendingBefore);
      }
      assert.equal(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8"), `${childPid}\n`);
      assert.equal(fstatSync(fixture.state.descriptor).nlink, 1, "publication does not bypass pending public census/release integration");
    } finally {
      for (const key of ["__coldControllerCompiledOutputVerifier", "__coldControllerServiceCensusObserver", "__coldControllerAfterSettlementHook", "__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldFrameSyncHook", "__coldFrameBeforeSyncHook", "__coldFrameBeforeCloseHook", "__coldFrameWriteHook", "__coldFrameBeforeLinkHook", "__coldFrameLinkedHook", "__coldFrameBeforeUnlinkHook", "__coldFrameUnlinkHook"]) Reflect.deleteProperty(globalThis, key);
      if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
      if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
        process.kill(childPid, "SIGTERM"); const deadline = Date.now() + 5000;
        while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(identity(childPid), "", "settlement fault fixture waits for its exact child");
      }
      fixture.close();
    }
  }
});

test("actual cold controller retains one helper result across caller response loss", async () => {
  const fixture = await createAuthenticatedColdChildFixtureV1("claim-real-helper-controller");
  let childPid: number | undefined;
  const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
  try {
    // The retained-lease harness runs through tsx; delegate this location-bound
    // port to the actual compiled verifier, never a fake acceptance result.
    const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
    Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
    const originalLock = readFileSync(fixture.lock);
    await assert.rejects(fixture.isolated.invokeFreshColdControllerFixtureV1(), /COLD_BOOTSTRAP_UNSETTLED/);
    assert.deepEqual(readFileSync(fixture.lock), originalLock);
    Reflect.set(globalThis, "__coldControllerAfterObservationHook", () => { Reflect.deleteProperty(globalThis, "__coldControllerAfterObservationHook"); throw Error("fixture caller response lost"); });
    await assert.rejects(fixture.isolated.invokeColdControllerFixtureV1(), /fixture caller response lost/);
    assert.equal(fixture.isolated.inspectColdIntentFixtureV1().phase, "claim-observed");
    const recovered = await fixture.isolated.invokeColdControllerFixtureV1();
    childPid = recovered.child.pid;
    assert.equal(canonical(await fixture.isolated.invokeColdControllerFixtureV1()), canonical(recovered));
    assert.equal(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8"), `${childPid}\n`, "caller response loss cannot dispatch another helper or child");
    const claim = JSON.parse(readFileSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/claim.json"), "utf8"));
    assert.equal(recovered.claimHash, claim.claimHash);
    await assert.rejects(fixture.isolated.invokeFreshColdControllerFixtureV1(), /COLD_BOOTSTRAP_UNSETTLED/);
    assert.deepEqual(readFileSync(fixture.lock), originalLock, "fresh controller cannot reclaim the unsettled lock or start genesis");
    assert.ok(identity(childPid!).includes(path.join(fixture.fixture, "dist/spawner.js")));
    assert.equal(fstatSync(fixture.state.descriptor).nlink, 1, "claim observation cannot release the unsettled controller lease");
  } finally {
    Reflect.deleteProperty(globalThis, "__coldControllerAfterObservationHook");
    Reflect.deleteProperty(globalThis, "__coldControllerCompiledOutputVerifier");
    if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
    if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
      process.kill(childPid, "SIGTERM");
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(identity(childPid), "", "controller fixture stops only its exact child before removal");
    }
    fixture.close();
  }
});

test("cold controller refuses changed helper output before passing a capability", async () => {
  for (const mode of ["late-intent", "helper", "late-helper", "node-observation", "host-observation", "environment-observation"]) {
  const fixture = await createAuthenticatedColdChildFixtureV1("claim-real-helper-controller-drift");
  const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
  try {
    const marker = path.join(fixture.fixture, "changed-helper-executed"), helper = path.join(fixture.fixture, "dist/internal-production/baseline-service-restart-helper-v1.js");
    const replaceHelper = () => writeFileSync(helper, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'executed');process.exit(1);`);
    let profileCalls = 0;
    if (mode === "helper") replaceHelper();
    else if (mode === "late-helper") Reflect.set(globalThis, "__coldControllerBeforeProfile", () => { if (++profileCalls === 2) replaceHelper(); });
    else if (mode === "late-intent") Reflect.set(globalThis, "__coldControllerBeforeProfile", () => {
      if (++profileCalls === 2) { const intent = path.join(fixture.root, "cold-spawner-bootstrap-v1/intent.json"); writeFileSync(intent, readFileSync(intent)); }
    });
    else {
      const changed = structuredClone(Reflect.get(globalThis, "__coldIntentProfile"));
      if (mode === "node-observation") changed.profile.executable.bytesHash = "0".repeat(64);
      if (mode === "host-observation") changed.profile.hostDirectories[0].inoDecimal = "1";
      if (mode === "environment-observation") changed.environment.PATH += ":/crossed";
      delete changed.profile.profileHash; changed.profile.profileHash = sha256(canonical(changed.profile));
      Reflect.set(globalThis, "__coldIntentProfile", changed);
    }
    const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
    Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
    await assert.rejects(fixture.isolated.invokeColdControllerFixtureV1());
    assert.equal(existsSync(marker), false, "changed code must not execute with the original inherited capability");
    assert.equal(existsSync(path.join(fixture.fixture, "fixture-spawn-pids")), false);
    assert.equal(fixture.isolated.inspectColdIntentFixtureV1().phase, mode.startsWith("late-") ? "helper-may-have-run" : "intent-only");
    if (mode.startsWith("late-")) assert.equal(profileCalls, 2, "recheck original authority at the final pre-spawn boundary");
  } finally {
    Reflect.deleteProperty(globalThis, "__coldControllerCompiledOutputVerifier"); Reflect.deleteProperty(globalThis, "__coldControllerBeforeProfile");
    const spawned = path.join(fixture.fixture, "fixture-spawn-pids");
    const childPid = existsSync(spawned) ? Number(readFileSync(spawned, "utf8").trim()) : undefined;
    if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
      process.kill(childPid, "SIGTERM"); const deadline = Date.now() + 5000;
      while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(identity(childPid), "", "prelaunch fixture stops its exact child before removal");
    }
    fixture.close();
  }
  }
});

test("cold controller preserves one invocation through completion and observation faults", async () => {
  for (const mode of ["missing", "truncated", "duplicate", "oversize", "extra-key", "noncanonical", "crossed-identity", "nonzero", "fragmented", "timeout", "concurrent", "spawn-error", "late-claim", "late-journal", "late-output", "late-pid"]) {
    const wire = ["missing", "truncated", "duplicate", "oversize", "extra-key", "noncanonical", "crossed-identity", "nonzero", "fragmented"].includes(mode);
    const fixture = await createAuthenticatedColdChildFixtureV1(`claim-real-helper-controller-${wire ? `wire-${mode}` : mode}`);
    let childPid: number | undefined, helpers = 0, crossed = false;
    const identity = (pid: number) => spawnSync("/bin/ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 }).stdout.trim();
    try {
      const output = await import(pathToFileURL(path.join(fixture.fixture, "dist/internal-production/baseline-spawner-launch-environment-v1.js")).href);
      Reflect.set(globalThis, "__coldControllerCompiledOutputVerifier", output.verifyInternalProductionSpawnerLaunchOutputCandidateV1);
      Reflect.set(globalThis, "__coldControllerSpawnedHook", () => { helpers++; });
      if (mode === "spawn-error") Reflect.set(globalThis, "__coldControllerSpawnPath", path.join(fixture.fixture, "absent-node"));
      if (mode === "timeout") Reflect.set(globalThis, "__coldControllerWaitMs", 1);
      if (mode.startsWith("late-")) Reflect.set(globalThis, "__coldControllerBeforeClaimHook", () => {
        if (crossed) return; crossed = true;
        const journal = path.join(fixture.root, "cold-spawner-bootstrap-v1");
        if (mode === "late-journal") { const file = path.join(journal, "foreign"); writeFileSync(file, "x", { mode: 0o600 }); unlinkSync(file); }
        else if (mode === "late-output") writeFileSync(path.join(fixture.fixture, "dist/fixture-dependency.js"), "export const changed=true;\n");
        else { const file = mode === "late-claim" ? path.join(journal, "claim.json") : path.join(fixture.fixture, ".openclaw/setfarm/spawner.pid"), bytes = readFileSync(file); unlinkSync(file); writeFileSync(file, bytes, { mode: 0o600, flag: "wx" }); }
      });
      if (["fragmented", "timeout", "concurrent"].includes(mode)) {
        if (mode === "timeout") { await assert.rejects(fixture.isolated.invokeColdControllerFixtureV1(), /uncertain/); Reflect.deleteProperty(globalThis, "__coldControllerWaitMs"); }
        const pending = fixture.isolated.invokeColdControllerFixtureV1();
        if (mode === "concurrent") await assert.rejects(fixture.isolated.invokeColdControllerFixtureV1(), /already active/);
        const result = await pending; childPid = result.child.pid;
        assert.equal(canonical(await fixture.isolated.invokeColdControllerFixtureV1()), canonical(result));
      } else {
        await assert.rejects(fixture.isolated.invokeColdControllerFixtureV1(), undefined, mode);
        await assert.rejects(fixture.isolated.invokeColdControllerFixtureV1(), undefined, `${mode} cannot retry spawn`);
        assert.equal(fixture.isolated.inspectColdIntentFixtureV1().phase, "helper-may-have-run");
      }
      assert.equal(helpers, 1, `${mode}: retain the actual helper invocation`);
      if (wire) assert.equal(readFileSync(path.join(fixture.fixture, "fixture-controller-wire"), "utf8"), mode);
      if (mode.startsWith("late-")) assert.equal(crossed, true);
      if (mode !== "spawn-error") assert.equal(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim().split("\n").length, 1);
      assert.equal(fstatSync(fixture.state.descriptor).nlink, 1, "uncertain or merely observed completion never releases the lease");
    } finally {
      for (const key of ["__coldControllerCompiledOutputVerifier", "__coldControllerSpawnedHook", "__coldControllerSpawnPath", "__coldControllerWaitMs", "__coldControllerBeforeClaimHook"]) Reflect.deleteProperty(globalThis, key);
      if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
      if (childPid && identity(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
        process.kill(childPid, "SIGTERM"); const deadline = Date.now() + 5000;
        while (Date.now() < deadline && identity(childPid)) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(identity(childPid), "", "outer transport fixture waits for its exact child to exit");
      }
      fixture.close();
    }
  }
});

function parseColdFixtureExitRowV1(row: string) {
  assert.ok(row.endsWith("\n") && !row.slice(0, -1).includes("\n"), `one complete child row: ${JSON.stringify(row)}`);
  const match = /^(\d+)\s+(\d+)\s+(\d+)\s+(.{24})\s+(\S+)\s+(\S+)\s+(.+)$/.exec(row.trim());
  assert.ok(match, `strict child process row: ${JSON.stringify(row)}`);
  return { pid: match[1], uid: match[2], pgid: match[3], lstart: match[4], stat: match[5]!, ucomm: match[6]!, command: match[7]! };
}

function observeColdFixtureExitV1(pid: number) {
  const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "pid=,uid=,pgid=,lstart=,stat=,ucomm=,command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.stderr, "");
  if (result.status === 1) { assert.equal(result.stdout, ""); return null; }
  assert.equal(result.status, 0);
  return parseColdFixtureExitRowV1(result.stdout);
}

function assertColdFixtureExitObservationV1(current: ReturnType<typeof observeColdFixtureExitV1>, expected: ReturnType<typeof parseColdFixtureExitRowV1>): "absent" | "running" | "waiting" {
  if (current === null) return "absent";
  for (const key of ["pid", "uid", "pgid", "lstart", "ucomm"] as const) assert.equal(current[key], expected[key], `child identity changed: ${JSON.stringify(current)}`);
  if (current.command === expected.command) return current.stat.startsWith("Z") || current.stat.includes("E") ? "waiting" : "running";
  // Darwin reads argument memory separately from process status. Captured
  // exiting rows had both ?Es and Rs with the same accounting name fallback.
  // This allows waiting only, never a signal or a claim of process absence.
  assert.ok((current.stat.startsWith("Z") && current.command === "<defunct>") || current.command === `(${expected.ucomm})`
    || (current.stat.includes("E") && current.command === "<exiting>"), `PID reuse cannot satisfy child completion: ${JSON.stringify(current)}`);
  return "waiting";
}

test("cold child completion observes its exact unreaped exit before requiring absence", async () => {
  const child = spawn(process.execPath, ["-e", "process.stdin.once('data',()=>process.exit(0));setInterval(()=>{},1000)"], { stdio: ["pipe", "ignore", "ignore"] });
  const completed = new Promise<void>((resolve, reject) => { child.once("error", reject); child.once("close", (code, signal) => { try { assert.equal(code, 0); assert.equal(signal, null); resolve(); } catch (error) { reject(error); } }); });
  try {
    const expected = observeColdFixtureExitV1(child.pid!);
    assert.ok(expected); assert.equal(expected.uid, String(process.getuid!()));
    child.stdin!.end("exit");
    let terminal = observeColdFixtureExitV1(child.pid!);
    const deadline = Date.now() + 3000;
    while (terminal && !terminal.stat.startsWith("Z") && Date.now() < deadline) terminal = observeColdFixtureExitV1(child.pid!);
    assert.ok(terminal?.stat.startsWith("Z"), "blocked parent retains its own actual unreaped child");
    assert.equal(terminal.command, "<defunct>");
    assertColdFixtureExitObservationV1(terminal, expected);
    for (const key of ["pid", "uid", "pgid", "lstart", "ucomm"] as const) assert.throws(() => assertColdFixtureExitObservationV1({ ...terminal, [key]: `${terminal[key]}0` }, expected));
    assert.throws(() => assertColdFixtureExitObservationV1({ ...terminal, stat: "R" }, expected));
    for (const stat of ["?Es", "Rs"]) assert.equal(assertColdFixtureExitObservationV1({ ...expected, stat, command: `(${expected.ucomm})` }, expected), "waiting", "captured Darwin fallback is never signal or completion authority");
    assert.throws(() => assertColdFixtureExitObservationV1({ ...expected, command: "/foreign/node" }, expected));
    await completed;
    assert.equal(observeColdFixtureExitV1(child.pid!), null, "zombie is waiting, only explicit absence completes");
  } finally { if (!child.stdin!.writableEnded) child.stdin!.end("exit"); await completed; }
});

async function exerciseActualColdHelperV1(suffix: string) {
  const fault = suffix ? `claim-real-helper-${suffix}` : "claim-real-helper", expectedRefusal = !["", "fragmented", "parent-transition", "late-parent-transition", "pid-residue"].includes(suffix);
  const fixture = await createAuthenticatedColdChildFixtureV1(fault);
  let childPid: number | undefined;
  let spawnedIdentity: ReturnType<typeof parseColdFixtureExitRowV1> | undefined;
  const alive = (pid: number) => {
    const observed = spawnSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,pgid=,command="], { encoding: "utf8", timeout: 2000, maxBuffer: 65536 });
    assert.equal(observed.error, undefined); assert.equal(observed.signal, null); assert.equal(observed.stderr, "");
    if (observed.status === 1) { assert.equal(observed.stdout, ""); return ""; }
    assert.equal(observed.status, 0); assert.ok(observed.stdout.endsWith("\n") && !observed.stdout.slice(0, -1).includes("\n"));
    assert.notEqual(observed.stdout.trim(), ""); return observed.stdout.trim();
  };
  try {
    const result = fixture.run({ realCold: true, coldMode: "1", expectedRefusal, label: fault });
    assert.equal(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim().split("\n").length, 1, "the real transport invokes spawn exactly once");
    if (expectedRefusal) {
      assert.equal(result.accepted, false);
      if (suffix.startsWith("pid-residue-")) {
        const mode = suffix.slice("pid-residue-".length), runtime = path.join(fixture.fixture, ".openclaw/setfarm");
        childPid = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
        assert.ok(Number.isSafeInteger(childPid) && childPid > 0);
        const expected = parseColdFixtureExitRowV1(readFileSync(path.join(fixture.fixture, "fixture-spawn-process"), "utf8"));
        assert.equal(expected.pid, String(childPid)); assert.equal(expected.uid, String(process.getuid!())); assert.equal(expected.pgid, String(childPid));
        assert.equal(expected.command, `${process.execPath} ${path.join(fixture.fixture, "dist/spawner.js")}`);
        assert.equal(expected.stat.startsWith("Z"), false, "initial identity is captured while the actual spawned child is live");
        spawnedIdentity = expected;
        const original = observeColdFixtureExitV1(childPid);
        assertColdFixtureExitObservationV1(original, expected);
        if (mode === "diagnostic-barrier") {
          assert.ok(original && !original.stat.startsWith("Z"), "helper completion precedes child diagnostic completion at the controlled barrier");
          assert.equal(existsSync(path.join(fixture.fixture, "fixture-residue-owned")), false);
          writeFileSync(path.join(fixture.fixture, "fixture-residue-diagnostic-release"), "release", { mode: 0o600, flag: "wx" });
        }
        const stopped = Date.now() + 5000;
        for (let current = observeColdFixtureExitV1(childPid); current !== null && Date.now() < stopped; current = observeColdFixtureExitV1(childPid)) {
          assertColdFixtureExitObservationV1(current, expected);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(observeColdFixtureExitV1(childPid), null, "explicit absence, not helper EOF or zombie state, closes the diagnostic lifecycle");
        assert.equal(readFileSync(path.join(fixture.fixture, "fixture-residue-boundary"), "utf8"), mode);
        assert.equal(readFileSync(path.join(fixture.fixture, "fixture-residue-owned"), "utf8"), "0", "refused residue drains actual retirement-owned descriptors");
        assert.equal(existsSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/claim.json")), false, "uncertain consumption never publishes a claim");
        assert.equal(existsSync(path.join(runtime, "fixture-claim-ready")), false);
        const residue = JSON.parse(readFileSync(path.join(fixture.fixture, "fixture-residue-evidence"), "utf8"));
        if (["absent", "fsync", "close", "replay"].includes(mode)) assert.equal(existsSync(path.join(runtime, "spawner.pid")), false);
        else {
          assert.equal(readFileSync(path.join(runtime, "spawner.pid")).toString("base64"), residue.bytes, "foreign or unconsumed residue bytes survive refusal");
          assert.equal(String(lstatSync(path.join(runtime, "spawner.pid"), { bigint: true }).ino), residue.ino, "refusal cannot replace residue evidence");
        }
      }
      else if (["claim-replace", "pid-restore", "lock-restore", "journal-aba", "output-drift"].includes(suffix)) assert.equal(readFileSync(path.join(fixture.fixture, "fixture-claim-replaced"), "utf8"), "fired");
      else if (suffix !== "spawn-error") {
        assert.ok(existsSync(path.join(fixture.fixture, "fixture-wire-fault-fired")), `${suffix}: intended wire fault must execute: ${JSON.stringify(result)}`);
        assert.equal(readFileSync(path.join(fixture.fixture, "fixture-wire-fault-fired"), "utf8"), suffix);
        if (suffix === "no-eof") {
          const receivedCount = Number(readFileSync(path.join(fixture.fixture, "fixture-eof-timeout-fired"), "utf8"));
          assert.ok(Number.isSafeInteger(receivedCount) && receivedCount > 0 && receivedCount <= 4096, "EOF timeout must follow retained delayed readiness bytes");
        }
      }
      return;
    }
    if (suffix === "fragmented") assert.ok(readFileSync(path.join(fixture.fixture, "fixture-ready-chunks"), "utf8").trim().split("\n").length >= 2, "the real reader receives multiple actual pipe chunks");
    childPid = result.childPid;
    assert.ok(Number.isSafeInteger(childPid) && childPid! > 0);
    assert.match(alive(childPid!), new RegExp(`^1\\s+${childPid}\\s+`));
    const runtime = path.join(fixture.fixture, ".openclaw/setfarm");
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !existsSync(path.join(runtime, "fixture-claim-ready")) && alive(childPid!)) await new Promise((resolve) => setTimeout(resolve, 20));
    const errorPath = path.join(fixture.fixture, "fixture-claim-error");
    assert.equal(existsSync(path.join(runtime, "fixture-claim-ready")), true, `${fault}: ${existsSync(errorPath) ? readFileSync(errorPath, "utf8") : "no authority error"}`);
    if (suffix === "parent-transition" || suffix === "late-parent-transition") assert.equal(readFileSync(path.join(fixture.fixture, "fixture-parent-transition"), "utf8"), "fired");
    assert.equal(readFileSync(path.join(runtime, "spawner.pid"), "utf8"), String(childPid));
    assert.equal(readFileSync(path.join(runtime, "spawner.lock"), "utf8"), `${childPid}\n`);
  } finally {
    if (suffix === "pid-residue-diagnostic-barrier" && !existsSync(path.join(fixture.fixture, "fixture-residue-diagnostic-release"))) writeFileSync(path.join(fixture.fixture, "fixture-residue-diagnostic-release"), "teardown", { mode: 0o600, flag: "wx" });
    if (!childPid && existsSync(path.join(fixture.fixture, "fixture-spawn-pids"))) {
      const observed = Number(readFileSync(path.join(fixture.fixture, "fixture-spawn-pids"), "utf8").trim());
      if (Number.isSafeInteger(observed) && observed > 0) childPid = observed;
    }
    // Failed acknowledgement can still leave the exact authenticated child.
    if (!childPid && existsSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/claim.json"))) {
      try { childPid = JSON.parse(readFileSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/claim.json"), "utf8")).child.pid; } catch { /* No parseable claimed child. */ }
    }
    if (childPid && suffix.startsWith("pid-residue")) {
      if (!spawnedIdentity && existsSync(path.join(fixture.fixture, "fixture-spawn-process"))) {
        const recorded = parseColdFixtureExitRowV1(readFileSync(path.join(fixture.fixture, "fixture-spawn-process"), "utf8"));
        assert.equal(recorded.pid, String(childPid)); assert.equal(recorded.uid, String(process.getuid!())); assert.equal(recorded.pgid, String(childPid));
        assert.equal(recorded.command, `${process.execPath} ${path.join(fixture.fixture, "dist/spawner.js")}`);
        assert.equal(recorded.stat.startsWith("Z"), false);
        spawnedIdentity = recorded;
      }
      const current = observeColdFixtureExitV1(childPid);
      if (current) {
        assert.ok(spawnedIdentity, "no signal without the original live child identity");
        const cleanupState = assertColdFixtureExitObservationV1(current, spawnedIdentity);
        if (cleanupState === "running") process.kill(childPid, "SIGTERM");
        const deadline = Date.now() + 5000;
        for (let next = observeColdFixtureExitV1(childPid); next && Date.now() < deadline; next = observeColdFixtureExitV1(childPid)) {
          assertColdFixtureExitObservationV1(next, spawnedIdentity);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(observeColdFixtureExitV1(childPid), null, "exact child must be absent before fixture removal");
      }
    } else if (childPid && alive(childPid).includes(path.join(fixture.fixture, "dist/spawner.js"))) {
      process.kill(childPid, "SIGTERM");
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && alive(childPid)) await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(alive(childPid), "", "actual helper fixture child must stop before removal");
    }
    fixture.close();
  }
}

test("real cold claim rejects self-hashed crossed bodies", async () => {
  const fixture = await createAuthenticatedColdChildFixtureV1("claim-parser");
  let childPid: number | undefined;
  try {
    const result = fixture.run();
    childPid = result.childPid;
    assert.equal(result.accepted, true, result.message);
  } finally {
    if (childPid) {
      process.kill(childPid, "SIGTERM");
      const deadline = Date.now() + 5000;
      let alive = true;
      while (Date.now() < deadline) {
        try { process.kill(childPid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") { alive = false; break; } throw error; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(alive, false, "parser fixture child must finish before removal");
    }
    fixture.close();
  }
});

test("real cold main refuses replacement of its originally authenticated runtime directory", async () => {
  const fixture = await createAuthenticatedColdChildFixtureV1("claim-runtime-replace");
  let childPid: number | undefined;
  try {
    const result = fixture.run();
    childPid = result.childPid;
    assert.equal(result.accepted, false, "a fresh replacement runtime directory must not acquire cold claim authority");
    assert.equal(existsSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/claim.json")), false);
    assert.deepEqual(readdirSync(path.join(fixture.fixture, ".openclaw/setfarm.moved")), []);
    assert.deepEqual(readdirSync(path.join(fixture.fixture, ".openclaw/setfarm")), []);
  } finally {
    if (childPid) {
      process.kill(childPid, "SIGTERM");
      const deadline = Date.now() + 5000;
      let alive = true;
      while (Date.now() < deadline) {
        try { process.kill(childPid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") { alive = false; break; } throw error; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(alive, false, "replacement fixture child must finish before removal");
    }
    fixture.close();
  }
});

test("real cold claim uncertainty retains its journal and closes owned resources", async () => {
  for (const fault of ["claim-fault-collision", "claim-fault-short-write", "claim-fault-file-sync", "claim-fault-parent-sync", "claim-fault-replace", "claim-fault-extra-member", "claim-fault-writer-close", "claim-fault-persistent-close", "claim-concurrent", "claim-stop", "claim-replay", "claim-regular-readiness"]) {
    const fixture = await createAuthenticatedColdChildFixtureV1(fault);
    try {
      const result = fixture.run();
      assert.equal(result.childRefused, true, `${fault}: ${result.message}`);
      assert.equal(result.diagnostic.owned, 0, `${fault}: every retirement-owned descriptor must close`);
      assert.equal(result.diagnostic.pending, 0, `${fault}: retained cleanup must drain`);
      if (fault.startsWith("claim-fault-")) assert.equal(result.diagnostic.fired, true, `${fault}: the real boundary must be exercised`);
      assert.equal(result.diagnostic.retained > 0, fault === "claim-fault-persistent-close");
      const runtime = path.join(fixture.fixture, ".openclaw/setfarm"), journal = path.join(fixture.root, "cold-spawner-bootstrap-v1");
      assert.equal(existsSync(path.join(runtime, "spawner.pid")), false);
      assert.equal(existsSync(path.join(runtime, "spawner.lock")), false);
      assert.equal(existsSync(path.join(journal, "intent.json")), true);
      assert.equal(existsSync(path.join(journal, "dispatch.json")), true);
      assert.equal(existsSync(path.join(journal, "claim.json")), !["claim-concurrent", "claim-stop", "claim-regular-readiness"].includes(fault));
      if (fault === "claim-regular-readiness") assert.equal(readFileSync(path.join(fixture.fixture, "fixture-readiness-file"), "utf8"), "untouched");
      if (["claim-fault-collision", "claim-fault-replace"].includes(fault)) assert.equal(readFileSync(path.join(journal, "claim.json"), "utf8"), "foreign");
      if (fault === "claim-fault-short-write") assert.equal(readFileSync(path.join(journal, "claim.json")).length, 1);
      assert.throws(() => fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1(), /COLD_BOOTSTRAP_UNSETTLED/);
      const beforeRetry = coldGenesisTreeSnapshotV1(fixture.root);
      assert.equal(fixture.run().accepted, false, `${fault}: a fresh helper must not turn uncertainty into another launch`);
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), beforeRetry, `${fault}: retry preserves the exact journal`);
    } finally { fixture.close(); }
  }
});

test("cold helper refuses crossed inherited identities, snapshots and awaited authority changes", async () => {
  for (const fault of ["foreign-intent", "foreign-lock", "linked-frame", "nonce", "environment", "profile", "wrong-entry", "wrong-parent", "intent-replace", "prefix-aba", "root-replace", "extra-dispatch", "epoch-replace", "oversized-intent", "secret-exception"] as const) {
    const fixture = await createColdHelperAuthenticationFixtureV1();
    const opened: number[] = [];
    try {
      const overrides: { frame?: number; lock?: number; intent?: number; entry?: string } = {};
      const intentPath = path.join(fixture.root, "cold-spawner-bootstrap-v1/intent.json");
      if (fault === "foreign-intent" || fault === "foreign-lock" || fault === "linked-frame" || fault === "nonce" || fault === "environment") {
        const scratch = path.join(fixture.fixture, `crossed-${fault}`);
        const original = fault === "foreign-intent" ? readFileSync(intentPath) : fault === "foreign-lock" ? readFileSync(fixture.lock) : readFileSync(fixture.handles.frameDescriptor);
        let bytes = original;
        if (fault === "nonce" || fault === "environment") {
          const value = JSON.parse(original.toString());
          if (fault === "nonce") value.nonce = "9".repeat(64); else value.environment.FIXTURE_SECRET = "crossed";
          bytes = Buffer.from(`${canonical(value)}\n`);
        }
        writeFileSync(scratch, bytes, { mode: 0o600 });
        const fd = openSync(scratch, "r"); opened.push(fd);
        if (fault === "foreign-intent") overrides.intent = fd;
        else if (fault === "foreign-lock") overrides.lock = fd;
        else { overrides.frame = fd; if (fault !== "linked-frame") unlinkSync(scratch); }
      } else if (fault === "profile") fixture.observer(`const crossed=${JSON.stringify(Reflect.get(globalThis, "__coldIntentProfile"))};crossed.profile.profileHash='9'.repeat(64);return crossed`);
      else if (fault === "secret-exception") fixture.observer("throw new Error('never-persist-cold-snapshot')");
      else if (fault === "wrong-entry") { overrides.entry = path.join(path.dirname(fixture.runner), "foreign-helper.js"); writeFileSync(overrides.entry, readFileSync(fixture.runner)); }
      else if (fault === "wrong-parent") {
        overrides.entry = path.join(path.dirname(fixture.runner), "intermediate-parent.js");
        writeFileSync(overrides.entry, `import {spawnSync} from 'node:child_process';const child=spawnSync(process.execPath,[${JSON.stringify(fixture.runner)}],{stdio:['ignore','inherit','inherit',3,4,5],env:process.env,timeout:10000});process.exitCode=child.status??1;`);
      }
      else if (fault === "intent-replace" || fault === "epoch-replace") {
        const target = fault === "intent-replace" ? intentPath : fixture.epoch;
        fixture.observer(`const target=${JSON.stringify(target)};const bytes=readFileSync(target);renameSync(target,target+'.moved');writeFileSync(target,bytes,{mode:0o600})`);
      } else if (fault === "prefix-aba") fixture.observer(`const target=${JSON.stringify(path.join(fixture.root, "cold-spawner-bootstrap-v1/transient"))};writeFileSync(target,'x',{mode:0o600});unlinkSync(target)`);
      else if (fault === "root-replace") fixture.observer(`const target=${JSON.stringify(fixture.root)};renameSync(target,target+'.moved');mkdirSync(target,{mode:0o700});for(const name of readdirSync(target+'.moved'))renameSync(target+'.moved/'+name,target+'/'+name)`);
      else if (fault === "extra-dispatch") writeFileSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/dispatch.json"), "{}\n", { mode: 0o600 });
      else if (fault === "oversized-intent") writeFileSync(intentPath, Buffer.alloc(8 * 1024 * 1024 + 1, 32));
      const result = fixture.run(overrides);
      assert.equal(result.accepted, false, `${fault} must refuse`);
      assert.match(result.message, /cold helper/);
      assert.equal(fstatSync(fixture.state.descriptor).nlink, 1, `${fault} does not release its controller's lease`);
    } finally { for (const fd of opened) closeSync(fd); fixture.close(); }
  }
});

test("cold helper authentication refusal drains interrupted directory cleanup", async () => {
  for (const persistent of [false, true]) {
  const fixture = await createColdHelperAuthenticationFixtureV1((source) => source
    .replace("  openSync,", "  openSync as actualOpenSync,").replace("  closeSync,", "  closeSync as actualCloseSync,") + `
const testOwned=new Set<number>();let testClosing=false,testCloseCount=0,testFault=false;
function openSync(...args:any[]){const fd=actualOpenSync(...args);testOwned.add(fd);return fd;}
function closeSync(fd:number){if(testClosing&&fstatSync(fd).isDirectory()&&++testCloseCount${persistent ? ">=" : "==="}2){testFault=true;throw Error('fixture pre-close fault')}actualCloseSync(fd);testOwned.delete(fd);}
globalThis.__coldHelperRefuse=()=>{testClosing=true;throw Error('fixture profile refusal')};
globalThis.__coldHelperDiagnostic=()=>{const retained=pendingColdHelperAuthenticationCleanupV1.size;testClosing=false;for(const close of pendingColdHelperAuthenticationCleanupV1)close();return {owned:testOwned.size,injected:testFault,retained,pending:pendingColdHelperAuthenticationCleanupV1.size}};
`);
  try {
    fixture.observer("globalThis.__coldHelperRefuse()");
    const result = fixture.run();
    assert.equal(result.accepted, false);
    assert.equal(result.diagnostic.injected, true);
    assert.equal(result.diagnostic.retained, persistent ? 1 : 0);
    assert.equal(result.diagnostic.pending, 0);
    assert.equal(result.diagnostic.owned, 0, "remaining authenticated directory handles must not disappear after a close error");
  } finally { fixture.close(); }
  }
});

test("cold helper inherited reads stay bounded when the actual lock or intent inode grows", async () => {
  for (const victim of ["lock", "intent"] as const) {
    const fixture = await createColdHelperAuthenticationFixtureV1((source) => source.replace("  readSync,", "  readSync as actualReadSync,") + `
let testGrowth=false,testBytes=0,testBound=0,testMaximum=0;
function readSync(fd:number,buffer:Buffer,offset:number,length:number,position:number){
  const borrowed=fstatSync(${victim === "lock" ? 4 : 5},{bigint:true}),current=fstatSync(fd,{bigint:true});
  const matches=borrowed.dev===current.dev&&borrowed.ino===current.ino;
  if(matches&&!testGrowth){testGrowth=true;testBound=Number(current.size)+1;const target=${victim === "lock" ? "rootPaths().lock" : "path.join(rootPaths().root,'cold-spawner-bootstrap-v1/intent.json')"};writeFileSync(target,Buffer.concat([readFileSync(target),Buffer.alloc(8*1024*1024,32)]));}
  const count=actualReadSync(fd,buffer,offset,length,position);
  if(matches){testBytes+=count;testMaximum=Math.max(testMaximum,length);}return count;
}
globalThis.__coldHelperDiagnostic=()=>({injected:testGrowth,bytes:testBytes,bound:testBound,maximum:testMaximum});
`);
    try {
      const result = fixture.run();
      assert.equal(result.accepted, false);
      assert.equal(result.diagnostic.injected, true);
      assert.equal(result.diagnostic.bytes, result.diagnostic.bound, "only the original bounded size and one EOF probe may be consumed");
      assert.ok(result.diagnostic.maximum <= 65_536);
    } finally { fixture.close(); }
  }
});

test("cold pre-intent observation failure retains its exact promoted lease for retry", async () => {
  for (const mode of ["profile", "profile-close", "cold", "lock-drift", "root-drift", "epoch-drift", "guard-acquire"]) {
    const fixture = await createColdFrameFixtureV1();
    const owned = new Map<number, string>();
    let originalLock: ReturnType<typeof lstatSync> | undefined, profileCalls = 0, originalDescriptor: number | undefined;
    Reflect.set(globalThis, "__coldFrameOpenedHook", (fd: number, file: string) => { owned.set(fd, String(file)); if (file === fixture.lock && originalDescriptor === undefined) originalDescriptor = fd; });
    Reflect.set(globalThis, "__coldFrameClosedHook", (fd: number) => owned.delete(fd));
    Reflect.set(globalThis, "__coldControllerBeforeProfile", () => {
      profileCalls++; originalLock ??= lstatSync(fixture.lock);
      if (mode === "profile-close") Reflect.set(globalThis, "__coldFrameBeforeCloseHook", (fd: number) => { if (owned.has(fd)) throw Error("fixture persistent pre-intent close"); });
      if (mode.startsWith("profile")) throw Error("fixture profile observation unavailable");
      if (mode === "lock-drift") { renameSync(fixture.lock, `${fixture.lock}.preserved`); writeFileSync(fixture.lock, "foreign pre-intent owner\n", { mode: 0o600 }); }
      if (mode === "root-drift") chmodSync(fixture.root, 0o755);
      if (mode === "epoch-drift") writeFileSync(fixture.epoch, "crossed preparation epoch\n");
    });
    if (mode === "guard-acquire") Reflect.set(globalThis, "__coldPreparationRetainedHook", () => {
      originalLock ??= lstatSync(fixture.lock);
      Reflect.set(globalThis, "__coldFrameBeforeOpenHook", (file: string) => { if (file === fixture.root) throw Error("fixture pre-intent guard acquisition unavailable"); });
    });
    let observations = 0;
    if (mode === "cold") Reflect.set(globalThis, "__coldGenesisObserverHook", () => { if (++observations === 3) throw Error("fixture cold observation unavailable"); });
    try {
      await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1());
      assert.equal(profileCalls, mode === "guard-acquire" ? 0 : 1);
      assert.equal(existsSync(path.join(fixture.root, "cold-spawner-bootstrap-v1")), false);
      assert.equal(owned.has(originalDescriptor!), true, "untransferred promoted lease remains owned after refusal");
      for (const key of ["__coldFrameBeforeCloseHook", "__coldControllerBeforeProfile", "__coldGenesisObserverHook", "__coldPreparationRetainedHook", "__coldFrameBeforeOpenHook"]) Reflect.deleteProperty(globalThis, key);
      if (mode.endsWith("-drift")) {
        const before = coldGenesisTreeSnapshotV1(fixture.root);
        await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1());
        assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before, "retry cannot adopt foreign lock or publish intent");
      } else {
        const result = await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
        assert.equal(lstatSync(fixture.lock).ino, originalLock!.ino);
        assert.equal(fixture.isolated.inspectColdIntentFixtureV1().descriptor, originalDescriptor);
        assert.equal(result.maximumDispatchCount, 1);
      }
    } finally {
      for (const key of ["__coldFrameBeforeCloseHook", "__coldControllerBeforeProfile", "__coldGenesisObserverHook", "__coldPreparationRetainedHook", "__coldFrameBeforeOpenHook"]) Reflect.deleteProperty(globalThis, key);
      fixture.isolated.closeColdIntentFixtureV1();
      for (const fd of owned.keys()) { try { closeSync(fd); } catch { /* Test-only cleanup for demonstrated unretained preparation. */ } }
      for (const key of ["__coldFrameOpenedHook", "__coldFrameClosedHook", "__coldIntentProfile"]) Reflect.deleteProperty(globalThis, key);
      fixture.cleanup();
    }
  }
});

test("cold facade repairs only its own intent publication before entering settlement", async () => {
  for (const mode of ["fresh", "root-sync", "linked-temporary"]) {
    const fixture = await createColdIntentFixtureV1(source => source.replace(
      'async function settleColdSpawnerBootstrapV1(): Promise<Readonly<Record<string, unknown>>> {',
      'async function settleColdSpawnerBootstrapV1(): Promise<Readonly<Record<string, unknown>>> {\n  globalThis.__coldFacadeBeforeSettle?.();'));
    const hook = mode === "root-sync" ? "__coldIntentRootSyncHook" : "__coldIntentLinkedHook";
    let retained: any;
    try {
      if (mode !== "fresh") {
        Reflect.set(globalThis, hook, () => { throw Error("fixture partial intent publication"); });
        await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /partial intent publication/);
        retained = fixture.isolated.inspectColdIntentFixtureV1();
        Reflect.deleteProperty(globalThis, hook);
      }
      let reached = 0;
      Reflect.set(globalThis, "__coldFacadeBeforeSettle", () => {
        reached++;
        const state = fixture.isolated.inspectColdIntentFixtureV1();
        if (mode !== "fresh") {
          assert.deepEqual(readdirSync(path.join(fixture.root, "cold-spawner-bootstrap-v1")), ["intent.json"]);
          assert.equal(lstatSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/intent.json")).nlink, 1);
          assert.equal(state.descriptor, retained.descriptor);
          assert.equal(state.nonceHash, retained.nonceHash);
          assert.equal(state.intent.intentHash, retained.intent.intentHash);
        } else assert.equal(state, null, "fresh absence reaches strict ordinary cold preparation inside settlement");
        throw Error("fixture reached settlement boundary");
      });
      await assert.rejects(fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1(), /reached settlement boundary/);
      assert.equal(reached, 1);
    } finally {
      Reflect.deleteProperty(globalThis, hook); Reflect.deleteProperty(globalThis, "__coldFacadeBeforeSettle");
      fixture.isolated.closeColdIntentFixtureV1(); Reflect.deleteProperty(globalThis, "__coldIntentProfile"); fixture.cleanup();
    }
  }
});

test("cold intent refuses a fresh observation crossed from its bound genesis", async () => {
  for (const swapReceipt of [false, true]) {
  const fixture = await createColdIntentFixtureV1();
  let originalReceipt: Buffer | undefined;
  if (swapReceipt) {
    Reflect.set(globalThis, "__coldIntentBeforeGenesisReadHook", (target: string) => {
      originalReceipt = readFileSync(target);
      const body = JSON.parse(originalReceipt.toString());
      delete body.genesisRef; delete body.genesisHash;
      body.coldObservation = Reflect.get(globalThis, "__coldGenesisObservation");
      const genesisHash = sha256(canonical(body));
      writeFileSync(target, `${canonical({ ...body, genesisRef: `setfarm://internal-production/cold-epoch-genesis/sha256/${genesisHash}`, genesisHash })}\n`);
    });
    Reflect.set(globalThis, "__coldIntentAfterGenesisReadHook", (target: string) => { writeFileSync(target, originalReceipt!); });
  }
  let observations = 0;
  Reflect.set(globalThis, "__coldGenesisObserverHook", () => {
    if (++observations !== 3) return;
    const observation = structuredClone(Reflect.get(globalThis, "__coldGenesisObservation"));
    observation.authorityV3Migration31Audit = { authorityV3Migration31AuditRef: `setfarm://internal-production/authority-v3-migration31-audit/sha256/${"9".repeat(64)}`, authorityV3Migration31AuditHash: "9".repeat(64) };
    delete observation.observationHash;
    Reflect.set(globalThis, "__coldGenesisObservation", { ...observation, observationHash: sha256(canonical(observation)) });
  });
  try {
    await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /genesis.*crossed/);
    assert.equal(observations, 3);
    assert.equal(existsSync(path.join(fixture.root, "cold-spawner-bootstrap-v1")), false);
    assert.equal(existsSync(fixture.lock), true, "pre-intent refusal retains its exact promoted lease until strict retry can transfer it");
  } finally {
    fixture.isolated.closeColdIntentFixtureV1();
    Reflect.deleteProperty(globalThis, "__coldIntentProfile");
    Reflect.deleteProperty(globalThis, "__coldIntentBeforeGenesisReadHook");
    Reflect.deleteProperty(globalThis, "__coldIntentAfterGenesisReadHook");
    fixture.cleanup();
  }
  }
});

test("cold intent does not report publication if the final record disappears", async () => {
  const fixture = await createColdIntentFixtureV1();
  Reflect.set(globalThis, "__coldIntentPublicationHook", () => { unlinkSync(path.join(fixture.root, "cold-spawner-bootstrap-v1/intent.json")); });
  try {
    await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /intent.*absent/);
    assert.equal(fixture.isolated.inspectColdIntentFixtureV1().phase, "intent-only");
    assert.equal(existsSync(fixture.lock), true);
  } finally {
    fixture.isolated.closeColdIntentFixtureV1();
    Reflect.deleteProperty(globalThis, "__coldIntentPublicationHook");
    Reflect.deleteProperty(globalThis, "__coldIntentProfile");
    fixture.cleanup();
  }
});

test("cold intent repairs only its own root-sync and linked-temporary publication prefixes", async () => {
  for (const boundary of ["root-sync", "linked-temporary"] as const) {
    const fixture = await createColdIntentFixtureV1();
    const hook = boundary === "root-sync" ? "__coldIntentRootSyncHook" : "__coldIntentLinkedHook";
    let failures = 0;
    Reflect.set(globalThis, hook, () => { if (failures++ === 0) throw new Error(`fixture ${boundary} interruption`); });
    try {
      await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /interruption/);
      const retained = fixture.isolated.inspectColdIntentFixtureV1();
      assert.equal(retained.phase, "intent-only");
      assert.equal(fstatSync(retained.descriptor).nlink, 1);
      const root = path.join(fixture.root, "cold-spawner-bootstrap-v1");
      const members = readdirSync(root);
      if (boundary === "root-sync") assert.deepEqual(members, []);
      else {
        assert.equal(members.length, 2);
        const [left, right] = members.map((name) => lstatSync(path.join(root, name), { bigint: true }));
        assert.equal(left!.ino, right!.ino);
        assert.equal(left!.nlink, 2n);
      }
      const adopted = await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
      const after = fixture.isolated.inspectColdIntentFixtureV1();
      assert.equal(after.descriptor, retained.descriptor);
      assert.equal(after.nonceHash, retained.nonceHash);
      assert.equal(adopted.intentHash, retained.intent.intentHash);
      assert.deepEqual(readdirSync(root), ["intent.json"]);
      assert.equal(lstatSync(path.join(root, "intent.json")).nlink, 1);
    } finally {
      fixture.isolated.closeColdIntentFixtureV1();
      Reflect.deleteProperty(globalThis, hook);
      Reflect.deleteProperty(globalThis, "__coldIntentProfile");
      fixture.cleanup();
    }
  }
});

test("cold intent publication retains its lease and exact prefix across response loss", async () => {
  const fixture = await createColdIntentFixtureV1();
  let lossCount = 0;
  Reflect.set(globalThis, "__coldIntentPublicationHook", () => { if (lossCount++ === 0) throw new Error("fixture intent acknowledgement lost"); });
  try {
    const pending = fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
    await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /already active/);
    await assert.rejects(pending, /acknowledgement lost/);
    const before = fixture.isolated.inspectColdIntentFixtureV1();
    assert.equal(before.phase, "intent-only");
    assert.equal(fstatSync(before.descriptor).nlink, 1, "uncertain publication retains its usable physical lease");
    const lockBefore = readFileSync(fixture.lock);
    const intentFile = path.join(fixture.root, "cold-spawner-bootstrap-v1/intent.json");
    const intentBefore = readFileSync(intentFile);
    assert.ok(!intentBefore.includes("never-persist-cold-snapshot"));
    assert.equal(JSON.parse(intentBefore.toString()).nonceHash, before.nonceHash);
    assert.throws(() => fixture.isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1(), /COLD_BOOTSTRAP_UNSETTLED/);
    const adopted = await fixture.isolated.prepareColdSpawnerBootstrapIntentV1();
    const after = fixture.isolated.inspectColdIntentFixtureV1();
    assert.equal(after.descriptor, before.descriptor);
    assert.equal(after.lockBytesHash, before.lockBytesHash);
    assert.equal(after.nonceHash, before.nonceHash);
    assert.equal(adopted.intentHash, before.intent.intentHash);
    assert.deepEqual(readFileSync(fixture.lock), lockBefore);
    assert.deepEqual(readFileSync(intentFile), intentBefore);
    assert.deepEqual(readdirSync(path.dirname(intentFile)), ["intent.json"], "preparation has no dispatch or process effect");
    const freshController = await import(`${pathToFileURL(path.join(fixture.fixture, "src/internal-production/baseline-restart-authority-retirement-v1.ts")).href}?new-controller=${Date.now()}`);
    const beforeFreshController = coldGenesisTreeSnapshotV1(fixture.root);
    await assert.rejects(freshController.prepareColdSpawnerBootstrapIntentV1(), /cold/);
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), beforeFreshController, "a new controller cannot acquire around unfinished cold history");
    const foreign = path.join(path.dirname(intentFile), "dispatch.json");
    writeFileSync(foreign, "foreign\n", { mode: 0o600 });
    const crossedPrefix = coldGenesisTreeSnapshotV1(fixture.root);
    await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /intent-only/);
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), crossedPrefix, "foreign dispatch evidence is not adopted or removed");
    unlinkSync(foreign);
    writeFileSync(intentFile, "crossed\n");
    const crossedBytes = coldGenesisTreeSnapshotV1(fixture.root);
    await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /crossed/);
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), crossedBytes, "crossed intent is not overwritten");
    writeFileSync(intentFile, intentBefore);
    const movedRoot = `${fixture.root}-original`;
    renameSync(fixture.root, movedRoot);
    mkdirSync(fixture.root, { mode: 0o700 });
    for (const name of readdirSync(movedRoot)) renameSync(path.join(movedRoot, name), path.join(fixture.root, name));
    const replacedRoot = coldGenesisTreeSnapshotV1(fixture.root);
    await assert.rejects(fixture.isolated.prepareColdSpawnerBootstrapIntentV1(), /directory changed|ancestor|root.*crossed/);
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), replacedRoot, "moving the exact lock and prefix under a foreign parent must not confer ownership");
  } finally {
    fixture.isolated.closeColdIntentFixtureV1();
    Reflect.deleteProperty(globalThis, "__coldIntentProfile");
    Reflect.deleteProperty(globalThis, "__coldIntentPublicationHook");
    fixture.cleanup();
  }
});

test("cold journal absence is read-only and pins the nearest physical ancestor", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const needle = '    try { lstatSync(target); fail("COLD_BOOTSTRAP_UNSETTLED:';
  assert.equal(original.split(needle).length, 2);
  const source = original.replace(needle, '    globalThis.__coldJournalAncestorHook?.();\n' + needle);
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-cold-journal-absence-"));
  try {
    const moduleUrl = await compilePlainRetirementFixtureV1(fixture, installRetirementFixture(fixture, source));
    const typescript = await import("typescript");
    const snapshotSource = /function coldGenesisTreeSnapshotV1\([\s\S]*?\n\}/.exec(readFileSync(import.meta.filename, "utf8"))![0];
    const runner = path.join(fixture, "absence.mjs");
    writeFileSync(runner, typescript.transpileModule(`
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fstatSync,lstatSync,mkdirSync,readFileSync,readdirSync,rmSync,symlinkSync,unlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
${snapshotSource}
const isolated=await import(${JSON.stringify(moduleUrl)});
const fixture=${JSON.stringify(fixture)};
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const cold = path.join(root, "cold-spawner-bootstrap-v1");
    const before = coldGenesisTreeSnapshotV1(path.join(fixture, "data"));
    const descriptorsBefore = readdirSync("/dev/fd").length;
    const absent = isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    assert.equal(absent.state, "absent"); assert.equal(absent.incompleteOwnerCount, 0);
    assert.deepEqual(coldGenesisTreeSnapshotV1(path.join(fixture, "data")), before);
    for (const name of ["cold-spawner-bootstrap-controller-settlement-v1.json", ".cold-spawner-bootstrap-controller-settlement-v1.json.pending", ".cold-spawner-bootstrap-controller-settlement-v1.json.foreign"]) {
      const file=path.join(root,name); writeFileSync(file,"unbound\\n",{mode:0o600});
      const snapshot=coldGenesisTreeSnapshotV1(root);
      assert.throws(()=>isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1(), /COLD_BOOTSTRAP_UNSETTLED/, name);
      assert.deepEqual(coldGenesisTreeSnapshotV1(root), snapshot); unlinkSync(file);
    }
    Reflect.set(globalThis, "__coldJournalAncestorHook", () => { mkdirSync(cold, { mode: 0o700 }); rmSync(cold, { recursive: true }); });
    assert.throws(() => isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1(), /ancestor changed/);
    Reflect.deleteProperty(globalThis, "__coldJournalAncestorHook");
    symlinkSync(path.join(fixture, "missing"), cold);
    assert.throws(() => isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1(), /COLD_BOOTSTRAP_UNSETTLED/);
    unlinkSync(cold);
    rmSync(path.join(fixture, "data"), { recursive: true });
    const missingBefore = coldGenesisTreeSnapshotV1(fixture);
    const absentHierarchy = isolated.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    assert.equal(absentHierarchy.state, "absent"); assert.equal(absentHierarchy.incompleteOwnerCount, 0);
    assert.notEqual(absentHierarchy.absenceIdentityHash, absent.absenceIdentityHash, "different absence anchors never share one identity witness");
    assert.deepEqual(coldGenesisTreeSnapshotV1(fixture), missingBefore, "absent hierarchy creates no directories");
    assert.equal(readdirSync("/dev/fd").length, descriptorsBefore);
`, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText);
    const result = spawnSync(process.execPath, [runner], { encoding: "utf8", timeout: 15000, maxBuffer: 65536, env: { HOME: homedir(), PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
  } finally { Reflect.deleteProperty(globalThis, "__coldJournalAncestorHook"); rmSync(fixture, { recursive: true, force: true }); }
});

test("cold journal prefixes fence ordinary release and dead-owner reclamation before any cleanup", async () => {
  for (const prefix of ["empty", "intent.json", "dispatch.json", "claim.json", "settlement.json", "foreign.json"] as const) {
    const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-cold-journal-fence-"));
    let lease: unknown;
    let isolated: Record<string, any> | undefined;
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const cold = path.join(root, "cold-spawner-bootstrap-v1"), lock = path.join(root, "physical-service-restart-authority.transition.lock");
    try {
      isolated = await import(pathToFileURL(installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"))).href);
      lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
      mkdirSync(cold, { mode: 0o700 });
      if (prefix !== "empty") writeFileSync(path.join(cold, prefix), `${canonical({ schema: "unbound-cold-prefix", disposition: "completed" })}\n`, { mode: 0o600 });
      const before = coldGenesisTreeSnapshotV1(root);
      await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease), /COLD_BOOTSTRAP_UNSETTLED/, prefix);
      assert.deepEqual(coldGenesisTreeSnapshotV1(root), before, "ordinary release retains exact lock and cold evidence");
      assert.throws(() => isolated!.observeInternalProductionColdSpawnerBootstrapJournalCensusV1(), /COLD_BOOTSTRAP_UNSETTLED/);
      lease = undefined; // Ordinary release revokes its handle but preserves the physical fence.
      rmSync(cold, { recursive: true });
      unlinkSync(lock); // Reset only this disposable test fixture for dead-owner coverage.
      const exited = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
      assert.equal(exited.status, 0);
      const dead = { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: Number(exited.stdout), processStartTimeEpochMs: 1, processIdentityHash: "0".repeat(64), leaseNonce: "1".repeat(64) };
      writeFileSync(lock, `${canonical(dead)}\n`, { mode: 0o600 });
      mkdirSync(cold, { mode: 0o700 });
      if (prefix !== "empty") writeFileSync(path.join(cold, prefix), "unbound\n", { mode: 0o600 });
      const deadBefore = coldGenesisTreeSnapshotV1(root);
      await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /COLD_BOOTSTRAP_UNSETTLED/, prefix);
      assert.deepEqual(coldGenesisTreeSnapshotV1(root), deadBefore, "dead-owner reclaim retains exact lock and cold evidence");
    } finally {
      if (existsSync(cold)) rmSync(cold, { recursive: true });
      if (lease && isolated) { try { await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease); } catch { /* already released by pre-fix RED */ } }
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});

test("cold genesis rejects crossed evidence and conflicting history before any publication or reclamation", async () => {
  for (const fault of ["foreign-incident", "source-dirty", "nonzero-owner", "missing-counter", "service-pid-cross", "service-generation-cross", "spawner-family", "live-stale-pid", "inventory-cross", "synthetic-cross", "historical-head", "old-helper-history", "old-cutover-history", "unknown-file", "empty-shard", "sibling-pre-schema", "sibling-normal", "sibling-sequence", "sibling-bootstrap"] as const) {
    const fixture = await createColdEpochGenesisFixtureV1();
    try {
      const observation = structuredClone(Reflect.get(globalThis, "__coldGenesisObservation"));
      if (fault === "foreign-incident") {
        observation.operation.operationHash = "8".repeat(64);
        observation.operation.operationRef = `setfarm://internal-production/current-entry-operation/sha256/${observation.operation.operationHash}`;
      }
      if (fault === "source-dirty") observation.source.clean = false;
      if (fault === "nonzero-owner") observation.census.activeRunCount = 1;
      if (fault === "missing-counter") delete observation.census.recoveryOwnerCount;
      if (fault === "service-pid-cross") observation.remainingServices.missionControl.pid = observation.remainingServices.dashboard.pid;
      if (fault === "service-generation-cross") observation.remainingServices.dashboard.generationHash = "9".repeat(64);
      if (fault === "spawner-family") observation.spawnerAbsence.globalSpawnerFamilyCount = 1;
      if (fault === "live-stale-pid") {
        const pid = observation.remainingServices.dashboard.pid;
        const { path: _path, ...metadata } = observation.spawnerAbsence.ancestors[0];
        observation.spawnerAbsence.pidFile = { state: "stale-dead-pid", pid, bytesSha256: sha256(String(pid)),
          identity: { ...metadata, mode: 0o644, nlink: "1", size: String(String(pid).length) } };
      }
      if (fault === "inventory-cross") observation.legacyFindingPublicationInventory.inventoryHash = "0".repeat(64);
      if (fault === "synthetic-cross") observation.syntheticGitAbsence = [];
      const { absenceHash: _absenceHash, ...absence } = observation.spawnerAbsence;
      observation.spawnerAbsence.absenceHash = sha256(canonical(absence));
      const { observationHash: _observationHash, ...body } = observation;
      observation.observationHash = sha256(canonical(body));
      Reflect.set(globalThis, "__coldGenesisObservation", recursivelyFreeze(observation));
      if (fault === "historical-head") writeFileSync(fixture.epoch, fixture.historicalHead, { mode: 0o600 });
      if (fault === "old-helper-history") writeFileSync(path.join(fixture.root, "pre-schema-helper-journal.json"), "retained\n", { mode: 0o600 });
      if (fault === "old-cutover-history") mkdirSync(path.join(fixture.root, "cutover-to-recovery-d-v1"), { mode: 0o700 });
      if (fault === "unknown-file") writeFileSync(path.join(fixture.root, "unknown.json"), "retained\n", { mode: 0o600 });
      if (fault === "empty-shard") mkdirSync(path.join(fixture.root, "epoch-genesis/sha256/ab"), { recursive: true, mode: 0o700 });
      const siblings = { "sibling-pre-schema": "pre-schema-spawner-rebind-v1", "sibling-normal": "baseline-service-restart-v1", "sibling-sequence": "baseline-service-restart-sequence-v1", "sibling-bootstrap": "baseline-spawner-bootstrap-restart-v1" } as const;
      if (fault in siblings) mkdirSync(path.join(path.dirname(fixture.root), siblings[fault as keyof typeof siblings]), { mode: 0o700 });
      const before = coldGenesisTreeSnapshotV1(path.join(fixture.fixture, "data"));
      await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /cold|LEGACY_FINDING/, fault);
      assert.deepEqual(coldGenesisTreeSnapshotV1(path.join(fixture.fixture, "data")), before, `${fault}: rejection must make zero filesystem changes`);
      assert.equal(existsSync(fixture.lock), false, fault);
    } finally { fixture.cleanup(); }
  }
});

test("cold genesis syncs every receipt ancestor before publishing its head", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const source = original.replace("function fsyncParent(file: string): void {", "function fsyncParent(file: string): void { globalThis.__coldGenesisSyncEvents.push(path.dirname(file));")
    .replace("function writeNoReplace(file: string, value: unknown): boolean {", "function writeNoReplace(file: string, value: unknown): boolean { if(path.basename(file) === 'epoch-head.json') globalThis.__coldGenesisSyncEvents.push('HEAD');");
  const fixture = await createColdEpochGenesisFixtureV1(source);
  try {
    Reflect.set(globalThis, "__coldGenesisSyncEvents", []);
    const lease = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
    await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    const events = Reflect.get(globalThis, "__coldGenesisSyncEvents") as string[];
    const beforeHead = events.slice(0, events.indexOf("HEAD"));
    for (const parent of [fixture.root, path.join(fixture.root, "epoch-genesis"), path.join(fixture.root, "epoch-genesis/sha256")]) {
      assert.ok(beforeHead.includes(parent), `receipt ancestor link must be durable: ${parent}`);
    }
  } finally { fixture.cleanup(); }
});

test("cold genesis rejects same-byte retained history replacement across its awaited observation", async () => {
  for (const fault of ["receipt", "head", "shard"] as const) {
    const fixture = await createColdEpochGenesisFixtureV1();
    try {
      const lease = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
      await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
      const headBytes = readFileSync(fixture.epoch), head = JSON.parse(headBytes.toString("utf8"));
      const receipt = path.join(fixture.root, "epoch-genesis/sha256", head.genesisHash.slice(0, 2), `${head.genesisHash}.json`);
      const receiptBytes = readFileSync(receipt);
      let calls = 0;
      Reflect.set(globalThis, "__coldGenesisObserverHook", () => {
        if (++calls !== 2) return;
        if (fault === "shard") {
          const shard = path.dirname(receipt), held = path.join(fixture.fixture, "held-shard");
          renameSync(shard, held); mkdirSync(shard, { mode: 0o700 });
          renameSync(path.join(held, path.basename(receipt)), receipt);
        } else {
          const target = fault === "receipt" ? receipt : fixture.epoch;
          renameSync(target, path.join(fixture.fixture, "held-record"));
          writeFileSync(target, fault === "receipt" ? receiptBytes : headBytes, { mode: 0o600 });
        }
      });
      await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /prefix changed under lock/, fault);
      assert.deepEqual(readFileSync(fixture.epoch), headBytes);
      assert.deepEqual(readFileSync(receipt), receiptBytes);
      assert.equal(existsSync(fixture.lock), false);
    } finally { fixture.cleanup(); }
  }
});

test("cold genesis resumes only reachable publication prefixes and resyncs retained file data", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const source = original.replaceAll("fsyncSync(", "coldGenesisFixtureFsync(") + '\nfunction coldGenesisFixtureFsync(fd: number){ globalThis.__coldGenesisSyncedInodes.push(String(fstatSync(fd,{bigint:true}).ino)); fsyncSync(fd); }\n';
  for (const fault of ["receipt-temp", "receipt-linked", "receipt-collision", "receipt-only", "head-temp", "head-linked", "head-collision", "head-with-temp-receipt"] as const) {
    const fixture = await createColdEpochGenesisFixtureV1(source);
    try {
      Reflect.set(globalThis, "__coldGenesisSyncedInodes", []);
      const lease = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
      await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
      const headBytes = readFileSync(fixture.epoch), head = JSON.parse(headBytes.toString("utf8"));
      const receipt = path.join(fixture.root, "epoch-genesis/sha256", head.genesisHash.slice(0, 2), `${head.genesisHash}.json`);
      const receiptBytes = readFileSync(receipt);
      const target = fault.startsWith("head-") && fault !== "head-with-temp-receipt" ? fixture.epoch : receipt;
      const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${"a".repeat(32)}.tmp`);
      if (fault.startsWith("receipt-")) unlinkSync(fixture.epoch);
      if (fault.endsWith("temp") || fault === "head-with-temp-receipt") renameSync(target, temporary);
      if (fault.endsWith("linked")) linkSync(target, temporary);
      if (fault.endsWith("collision")) writeFileSync(temporary, readFileSync(target), { mode: 0o600 });
      const before = coldGenesisTreeSnapshotV1(fixture.root);
      Reflect.set(globalThis, "__coldGenesisSyncedInodes", []);
      if (fault === "head-with-temp-receipt") {
        await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /final receipt/, fault);
        assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before, "unreachable prefix must be preserved without mutation");
      } else {
        const resumed = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
        await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(resumed);
        assert.deepEqual(readFileSync(receipt), receiptBytes, fault);
        assert.deepEqual(readFileSync(fixture.epoch), headBytes, fault);
        assert.equal(existsSync(temporary), false, fault);
        const synced = Reflect.get(globalThis, "__coldGenesisSyncedInodes") as string[];
        for (const file of [receipt, fixture.epoch]) assert.ok(synced.includes(String(lstatSync(file, { bigint: true }).ino)), `${fault}: retained final file data must be synced`);
      }
    } finally { fixture.cleanup(); }
  }
});

test("cold facade drains retained raw cleanup without dropping FDs or touching a new owner", async () => {
  for (const mode of ["physical-close", "guard-close", "reader-close", "new-owner"]) {
    const source = readFileSync(sourcePath, "utf8")
      .replace('    writeNoReplace(rootPaths().epoch, head);', '    if(globalThis.__rawFixturePublicationFault)throw Error("fixture raw publication refusal");\n    writeNoReplace(rootPaths().epoch, head);')
      .replace('async function prepareColdSpawnerBootstrapIntentV1() {', 'async function prepareColdSpawnerBootstrapIntentV1() {\n  globalThis.__rawFixturePreparation?.();')
      .replace('    onOwnedUnlink?.();', '    onOwnedUnlink?.();\n    globalThis.__rawFixtureAfterUnlink?.(lock);')
      .replace('  openSync,', '  openSync as actualRawFixtureOpen,')
      .replace('  closeSync,', '  closeSync as actualRawFixtureClose,') + `
function openSync(...args:any[]){const fd=actualRawFixtureOpen(...args);globalThis.__rawFixtureOpened?.(fd,String(args[0]));return fd;}
function closeSync(fd:number){globalThis.__rawFixtureBeforeClose?.(fd);actualRawFixtureClose(fd);globalThis.__rawFixtureClosed?.(fd);}
export function rawFixtureState(){const raw=retainedColdGenesisRawV1;return raw?rawPhysicalTransitionLocksV1.get(raw):null;}
export function disposeRawFixture(){const raw=retainedColdGenesisRawV1,state=raw&&rawPhysicalTransitionLocksV1.get(raw);if(state){if(!state.cleanup.rootGuardClosed)state.rootGuard.close();if(!state.cleanup.descriptorClosed)closeSync(state.descriptor);rawPhysicalTransitionLocksV1.delete(raw);}retainedColdGenesisRawV1=null;}
`;
    const fixture = await createColdEpochGenesisFixtureV1(source), owned = new Map<number, string>();
    let blocked = true, fired = false, selected: number | undefined, directoryCloses = 0;
    try {
      const warmup = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
      await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(warmup);
      Reflect.set(globalThis, "__rawFixtureOpened", (fd: number, file: string) => owned.set(fd, file));
      Reflect.set(globalThis, "__rawFixtureClosed", (fd: number) => owned.delete(fd));
      Reflect.set(globalThis, "__rawFixturePublicationFault", true);
      Reflect.set(globalThis, "__rawFixtureAfterUnlink", (lock: string) => {
        if (lock !== fixture.lock) return;
        if (mode === "new-owner" && blocked) { fired = true; writeFileSync(lock, "new raw-path owner\n", { mode: 0o600, flag: "wx" }); throw Error("fixture raw owned-unlink response lost"); }
        Reflect.set(globalThis, "__rawFixtureBeforeClose", (fd: number) => {
          if (!blocked) return;
          const file = owned.get(fd);
          if (selected === undefined && file) {
            const stats = fstatSync(fd);
            if (mode === "reader-close" && file === fixture.lock && stats.nlink === 0) selected = fd;
            else if (mode === "guard-close" && stats.isDirectory() && ++directoryCloses === 3) selected = fd;
            else if (mode === "physical-close" && file === fixture.lock && stats.nlink === 0 && ++directoryCloses === 2) selected = fd;
          }
          if (selected === fd) { fired = true; throw Error("fixture raw resource pre-close failure"); }
        });
      });
      await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /raw publication refusal/);
      assert.equal(fired, true, `${mode}: real raw release fault reached`);
      assert.ok(owned.size > 0);
      assert.ok(fixture.isolated.rawFixtureState(), `${mode}: interrupted raw owner remains reachable`);
      const foreign = mode === "new-owner" ? { bytes: readFileSync(fixture.lock), stats: lstatSync(fixture.lock, { bigint: true }) } : null;
      blocked = false;
      Reflect.deleteProperty(globalThis, "__rawFixturePublicationFault");
      Reflect.set(globalThis, "__rawFixturePreparation", () => { throw Error("fixture stop before new preparation"); });
      await assert.rejects(fixture.isolated.ensureInternalProductionColdSpawnerBootstrapSettledV1(), /stop before new preparation/);
      assert.equal(fixture.isolated.rawFixtureState(), null);
      assert.equal(owned.size, 0, `${mode}: no old raw resource survives facade cleanup`);
      if (foreign) { assert.deepEqual(readFileSync(fixture.lock), foreign.bytes); assert.deepEqual(lstatSync(fixture.lock, { bigint: true }), foreign.stats); }
      else assert.equal(existsSync(fixture.lock), false);
    } finally {
      blocked = false; Reflect.deleteProperty(globalThis, "__rawFixtureBeforeClose");
      fixture.isolated.disposeRawFixture();
      for (const fd of owned.keys()) { try { closeSync(fd); } catch { /* Dispose demonstrated pre-fix leaks only. */ } }
      for (const suffix of ["Opened", "Closed", "PublicationFault", "AfterUnlink", "Preparation"]) Reflect.deleteProperty(globalThis, `__rawFixture${suffix}`);
      fixture.cleanup();
    }
  }
});

test("cold genesis retries release failures without losing a live fence or retaining a closed capability", async () => {
  for (const fault of ["before-unlink", "after-unlink", "after-close"] as const) {
    const original = readFileSync(sourcePath, "utf8");
    const publication = '    writeNoReplace(rootPaths().epoch, head);';
    const preRelease = 'async function releaseRawPhysicalTransitionLockV1(raw: RawPhysicalTransitionLockV1): Promise<void> {';
    const unlink = '    unlinkSync(lock);\n    onOwnedUnlink?.();\n    fsyncParent(lock);';
    const closed = '  rawPhysicalTransitionLocksV1.delete(raw);\n}\n\nfunction abandonRawPhysicalTransitionLockV1';
    for (const needle of [publication, preRelease, unlink, closed]) assert.ok(original.includes(needle), `fault port exists: ${needle}`);
    const source = original.replace(publication, `    if(globalThis.__coldGenesisPublicationFault) { globalThis.__coldGenesisRawBefore = raw; throw new Error('GENESIS_PUBLICATION_FAULT'); }\n${publication}`)
      .replace(preRelease, preRelease + '\n  if(globalThis.__coldGenesisReleaseFault === "before-unlink") throw new Error("GENESIS_RELEASE_BEFORE");')
      .replace(unlink, '    unlinkSync(lock);\n    onOwnedUnlink?.();\n    if(globalThis.__coldGenesisReleaseFault === "after-unlink") throw new Error("GENESIS_RELEASE_UNLINKED");\n    fsyncParent(lock);')
      .replace(closed, '  rawPhysicalTransitionLocksV1.delete(raw);\n  if(globalThis.__coldGenesisReleaseFault === "after-close") throw new Error("GENESIS_RELEASE_CLOSED");\n}\n\nfunction abandonRawPhysicalTransitionLockV1')
      + '\nexport const coldGenesisRawTestState = () => ({ retained: retainedColdGenesisRawV1, mapped: retainedColdGenesisRawV1 ? rawPhysicalTransitionLocksV1.has(retainedColdGenesisRawV1) : false });\n';
    const fixture = await createColdEpochGenesisFixtureV1(source);
    try {
      const warmup = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
      await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(warmup);
      const descriptorsBefore = readdirSync("/dev/fd").length;
      Reflect.set(globalThis, "__coldGenesisPublicationFault", true);
      Reflect.set(globalThis, "__coldGenesisReleaseFault", fault);
      await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /GENESIS_PUBLICATION_FAULT/);
      const retained = fixture.isolated.coldGenesisRawTestState();
      if (fault === "before-unlink") {
        assert.equal(existsSync(fixture.lock), true);
        assert.equal(retained.retained, Reflect.get(globalThis, "__coldGenesisRawBefore"));
        assert.equal(retained.mapped, true);
      }
      if (fault === "after-close") assert.equal(retained.retained, null, "closed raw capability must never be retained");
      const lockBytes = existsSync(fixture.lock) ? readFileSync(fixture.lock) : null;
      Reflect.deleteProperty(globalThis, "__coldGenesisPublicationFault");
      Reflect.deleteProperty(globalThis, "__coldGenesisReleaseFault");
      const resumed = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
      if (lockBytes) assert.deepEqual(readFileSync(fixture.lock), lockBytes, "live retained physical fence is promoted without reacquisition");
      await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(resumed);
      assert.equal(existsSync(fixture.lock), false);
      assert.equal(fixture.isolated.coldGenesisRawTestState().retained, null);
      assert.equal(readdirSync("/dev/fd").length, descriptorsBefore, `${fault}: no leaked raw descriptors`);
    } finally { fixture.cleanup(); }
  }
});

test("cold genesis never repairs external lock deletion or overwrites a post-unlink foreign lock", async () => {
  for (const fault of ["external-unlink", "foreign-after-unlink"] as const) {
    const original = readFileSync(sourcePath, "utf8");
    const publication = "    writeNoReplace(rootPaths().epoch, head);";
    const ownedUnlink = "    onOwnedUnlink?.();";
    assert.ok(original.includes(publication) && original.includes(ownedUnlink));
    const source = original.replace(publication, `    if(globalThis.__coldGenesisPublicationFault) { if(globalThis.__coldGenesisReleaseFault === 'external-unlink') unlinkSync(rootPaths().lock); throw new Error('GENESIS_PUBLICATION_FAULT'); }\n${publication}`)
      .replace(ownedUnlink, `${ownedUnlink}\n    if(globalThis.__coldGenesisReleaseFault === 'foreign-after-unlink') { writeFileSync(lock, 'foreign-lock\\n', { mode: 0o600 }); throw new Error('GENESIS_FOREIGN_LOCK'); }`)
      + '\nexport function disposeColdGenesisFixtureRaw(){ const raw=retainedColdGenesisRawV1; const state=raw && rawPhysicalTransitionLocksV1.get(raw); if(state){state.rootGuard.close();closeSync(state.descriptor);rawPhysicalTransitionLocksV1.delete(raw);}retainedColdGenesisRawV1=null;}\n';
    const fixture = await createColdEpochGenesisFixtureV1(source);
    try {
      const warmup = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
      await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(warmup);
      const descriptorsBefore = readdirSync("/dev/fd").length;
      Reflect.set(globalThis, "__coldGenesisPublicationFault", true);
      Reflect.set(globalThis, "__coldGenesisReleaseFault", fault);
      await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /GENESIS_PUBLICATION_FAULT/);
      Reflect.deleteProperty(globalThis, "__coldGenesisPublicationFault");
      Reflect.deleteProperty(globalThis, "__coldGenesisReleaseFault");
      const before = coldGenesisTreeSnapshotV1(fixture.root);
      await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1());
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before, `${fault}: retry neither manufactures nor removes authority`);
      if (fault === "external-unlink") assert.equal(existsSync(fixture.lock), false);
      else assert.equal(readFileSync(fixture.lock, "utf8"), "foreign-lock\n");
      fixture.isolated.disposeColdGenesisFixtureRaw();
      assert.equal(readdirSync("/dev/fd").length, descriptorsBefore);
    } finally { fixture.isolated.disposeColdGenesisFixtureRaw(); fixture.cleanup(); }
  }
});

test("cold genesis refuses competing receipts, unsafe retained members and epoch two without writes", async () => {
  for (const fault of ["competing-genesis", "external-hardlink", "receipt-mode", "receipt-symlink", "partial-receipt", "head-only", "epoch-two"] as const) {
    const fixture = await createColdEpochGenesisFixtureV1();
    try {
      const lease = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
      await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
      const head = JSON.parse(readFileSync(fixture.epoch, "utf8"));
      const receipt = path.join(fixture.root, "epoch-genesis/sha256", head.genesisHash.slice(0, 2), `${head.genesisHash}.json`);
      if (fault === "competing-genesis") {
        const candidate = JSON.parse(readFileSync(receipt, "utf8"));
        candidate.coldObservation.spawnerAbsence.ancestors[0].mtimeNs = "2";
        const { absenceHash: _absence, ...absenceBody } = candidate.coldObservation.spawnerAbsence;
        candidate.coldObservation.spawnerAbsence.absenceHash = sha256(canonical(absenceBody));
        const { observationHash: _observation, ...observationBody } = candidate.coldObservation;
        candidate.coldObservation.observationHash = sha256(canonical(observationBody));
        const { genesisRef: _ref, genesisHash: _hash, ...body } = candidate;
        const hash = sha256(canonical(body));
        const second = path.join(fixture.root, "epoch-genesis/sha256", hash.slice(0, 2), `${hash}.json`);
        mkdirSync(path.dirname(second), { recursive: true, mode: 0o700 });
        writeFileSync(second, `${canonical({ ...body, genesisRef: `setfarm://internal-production/cold-epoch-genesis/sha256/${hash}`, genesisHash: hash })}\n`, { mode: 0o600 });
      }
      if (fault === "external-hardlink") linkSync(receipt, path.join(fixture.fixture, "foreign-link"));
      if (fault === "receipt-mode") chmodSync(receipt, 0o644);
      if (fault === "receipt-symlink") { const held = path.join(fixture.fixture, "held-receipt"); renameSync(receipt, held); symlinkSync(held, receipt); }
      if (fault === "partial-receipt") writeFileSync(receipt, "{\n");
      if (fault === "head-only") unlinkSync(receipt);
      if (fault === "epoch-two") {
        const { epochRef: _ref, epochHash: _hash, ...body } = head;
        body.epochOrdinal = 2; body.authorityOwner = "recovery-d";
        const hash = sha256(canonical(body));
        writeFileSync(fixture.epoch, `${canonical({ ...body, epochRef: `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${hash}`, epochHash: hash })}\n`);
      }
      const before = coldGenesisTreeSnapshotV1(fixture.root);
      await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), undefined, fault);
      assert.deepEqual(coldGenesisTreeSnapshotV1(fixture.root), before, fault);
      assert.equal(existsSync(fixture.lock), false);
    } finally { fixture.cleanup(); }
  }
});

test("cold genesis preserves retained evidence on prerequisite drift and incomplete data sync", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const needle = "      fsyncSync(finalDescriptor);";
  assert.ok(original.includes(needle));
  const fixture = await createColdEpochGenesisFixtureV1(original.replace(needle, `      if(globalThis.__coldGenesisPublicationFault) throw new Error('GENESIS_DATA_SYNC_FAULT');\n${needle}`));
  try {
    const lease = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
    await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    const headBytes = readFileSync(fixture.epoch), head = JSON.parse(headBytes.toString("utf8"));
    const receipt = path.join(fixture.root, "epoch-genesis/sha256", head.genesisHash.slice(0, 2), `${head.genesisHash}.json`);
    const receiptBytes = readFileSync(receipt), originalObservation = Reflect.get(globalThis, "__coldGenesisObservation");
    const drifted = structuredClone(originalObservation);
    drifted.authorityV3Migration31Audit.authorityV3Migration31AuditHash = "8".repeat(64);
    drifted.authorityV3Migration31Audit.authorityV3Migration31AuditRef = `setfarm://internal-production/authority-v3-migration31-audit/sha256/${"8".repeat(64)}`;
    const { observationHash: _hash, ...body } = drifted;
    drifted.observationHash = sha256(canonical(body));
    Reflect.set(globalThis, "__coldGenesisObservation", recursivelyFreeze(drifted));
    await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /retained prerequisites are crossed/);
    assert.deepEqual(readFileSync(receipt), receiptBytes);
    assert.deepEqual(readFileSync(fixture.epoch), headBytes);
    Reflect.set(globalThis, "__coldGenesisObservation", originalObservation);
    unlinkSync(fixture.epoch);
    const temporary = path.join(path.dirname(receipt), `.${path.basename(receipt)}.${"a".repeat(32)}.tmp`);
    renameSync(receipt, temporary);
    Reflect.set(globalThis, "__coldGenesisPublicationFault", true);
    await assert.rejects(fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1(), /GENESIS_DATA_SYNC_FAULT/);
    assert.equal(existsSync(fixture.epoch), false, "failed receipt data sync never publishes a head");
    assert.equal(existsSync(fixture.lock), false);
    assert.deepEqual(readFileSync(temporary), receiptBytes, "failed sync preserves recovery candidate");
    Reflect.deleteProperty(globalThis, "__coldGenesisPublicationFault");
    const resumed = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
    await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(resumed);
    assert.deepEqual(readFileSync(receipt), receiptBytes);
    assert.deepEqual(readFileSync(fixture.epoch), headBytes);
  } finally { fixture.cleanup(); }
});

test("cold epoch genesis creates a durable bound head and resumes without redefining its evidence", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-cold-epoch-genesis-"));
  try {
    const modulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const epochPath = path.join(root, "epoch-head.json"), lockPath = path.join(root, "physical-service-restart-authority.transition.lock");
    unlinkSync(epochPath);
    const portPath = path.join(fixture, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
    writeFileSync(portPath, readFileSync(portPath, "utf8") + `
export async function observeInternalProductionColdBootstrapObservationV1(){
  const observation=globalThis.__coldGenesisObservation;
  globalThis.__coldGenesisObservedLocks.push(existsSync(${JSON.stringify(lockPath)})?readFileSync(${JSON.stringify(lockPath)},"utf8"):null);
  return observation;
}\n`.replace("export async function", 'import {existsSync,readFileSync} from "node:fs";\nexport async function'));
    Reflect.set(globalThis, "__coldGenesisObservation", coldGenesisObservationFixture(fixture));
    Reflect.set(globalThis, "__coldGenesisObservedLocks", []);
    const isolated = await import(`${pathToFileURL(modulePath).href}?genesis=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
    const headBytes = readFileSync(epochPath);
    const head = JSON.parse(headBytes.toString("utf8"));
    assert.equal(head.schema, "setfarm.internal-production-physical-service-restart-authority-epoch.v2");
    assert.equal(head.epochOrdinal, 1);
    const receiptPath = path.join(root, "epoch-genesis/sha256", head.genesisHash.slice(0, 2), `${head.genesisHash}.json`);
    const receiptBytes = readFileSync(receiptPath);
    const receipt = JSON.parse(receiptBytes.toString("utf8"));
    assert.equal(receipt.genesisRef, head.genesisRef);
    assert.deepEqual(receipt.coldObservation, Reflect.get(globalThis, "__coldGenesisObservation"));
    const observedLocks = Reflect.get(globalThis, "__coldGenesisObservedLocks") as Array<string | null>;
    assert.equal(observedLocks[0], null, "incident is checked before reclaim or lock mutation");
    assert.ok(observedLocks.some((value) => value === readFileSync(lockPath, "utf8")), "cold evidence is independently observed under the promoted lock");
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    const fresh = structuredClone(Reflect.get(globalThis, "__coldGenesisObservation"));
    fresh.spawnerAbsence.ancestors[0].mtimeNs = "2";
    const { absenceHash: _oldAbsenceHash, ...absence } = fresh.spawnerAbsence;
    fresh.spawnerAbsence.absenceHash = sha256(canonical(absence));
    const { observationHash: _oldObservationHash, ...observation } = fresh;
    fresh.observationHash = sha256(canonical(observation));
    Reflect.set(globalThis, "__coldGenesisObservation", recursivelyFreeze(fresh));
    const resumed = await isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
    assert.deepEqual(readFileSync(epochPath), headBytes);
    assert.deepEqual(readFileSync(receiptPath), receiptBytes, "fresh volatile evidence must not redefine original genesis");
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(resumed);
    const ordinary = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(ordinary);
    assert.equal(existsSync(lockPath), false);
  } finally {
    Reflect.deleteProperty(globalThis, "__coldGenesisObservation");
    Reflect.deleteProperty(globalThis, "__coldGenesisObservedLocks");
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const scenario of ["ordinary", "dead", "raw", "genesis", "ordinary-reused", "raw-reused", "dead-reappeared", "ordinary-parent", "raw-parent", "dead-parent", "ordinary-guard", "ordinary-late-journal", "ordinary-leaf", "raw-leaf", "dead-leaf"] as const) test(`physical ${scenario} cleanup awaits historical helper validation before changing ownership`, async () => {
  const mode = scenario.split("-")[0];
  const original = readFileSync(sourcePath, "utf8"), marker = "function assertHelperJournalAllowsLockCleanup(";
  assert.equal(original.split(marker).length - 1, 1);
  const guardReturn = "    assertStable();\n    return Object.freeze({\n      assertStable,\n      close,\n    });";
  assert.equal(original.split(guardReturn).length - 1, 1);
  const source = original.replace(marker, "function actualAwaitedHelperCleanupFixtureV1(")
    .replaceAll("    const assertHelper = await assertHelperJournalAllowsLockCleanup(parseLockRecord(state.lockBytes), descriptorIdentity(state.descriptor));", "    const assertHelper = await assertHelperJournalAllowsLockCleanup(parseLockRecord(state.lockBytes), descriptorIdentity(state.descriptor));globalThis.__helperCleanupOuterMutationV1?.();")
    .replace(guardReturn, "    globalThis.__helperCleanupGuardCaptureV1?.({descriptors,held,close});\n" + guardReturn)
    .replace("function boundedPsProcessIdentity(pid: number)", "function actualAwaitedOwnerObservationFixtureV1(pid: number)")
    .replace("    writeNoReplace(rootPaths().epoch, head);", "    if(globalThis.__helperCleanupPublicationFaultV1)throw Error('FIXTURE_GENESIS_PUBLICATION');\n    writeNoReplace(rootPaths().epoch, head);") + `
function assertHelperJournalAllowsLockCleanup(...args){const pending=(async()=>{await globalThis.__helperCleanupAwaitGateV1?.();return actualAwaitedHelperCleanupFixtureV1(...args)})();void pending.catch(()=>{});return pending;}
function boundedPsProcessIdentity(pid){if(pid===99999&&globalThis.__helperCleanupOwnerReappearedV1)return {pid,processStartTimeEpochMs:2,processIdentityHash:'f'.repeat(64)};return actualAwaitedOwnerObservationFixtureV1(pid)}
export const awaitedRawCleanupFixtureV1={acquire:acquireRawPhysicalTransitionLockV1,release:releaseRawPhysicalTransitionLockV1,promote:raw=>promoteRawPhysicalTransitionLockV1(raw,assertEpochOneActive),descriptor:value=>rawPhysicalTransitionLocksV1.get(value)?.descriptor??leases.get(value)?.descriptor,dispose:raw=>{const state=rawPhysicalTransitionLocksV1.get(raw);if(state){state.rootGuard.close();rawPhysicalTransitionLocksV1.delete(raw)}}};
export function drainAwaitedCleanupFixtureV1(){for(const close of pendingColdHelperAuthenticationCleanupV1)close()}
export function discardDrainedGuardFixtureV1(){pendingColdHelperAuthenticationCleanupV1.clear()}
export function seedClosableNormalHelperFixtureV1(operation,outbox,transitionLock,lockIdentity){
  appendOrAdoptRegistrationV1(operation,outbox);
  const restartOperation={operationRef:operation.operationRef,operationHash:operation.operationHash};
  const core={schema:'setfarm.internal-production-service-restart-helper-journal.v1',family:'baseline-service-restart',operationSchema:operation.schema,action:operation.actionId,restartOperation,transitionLock,lockIdentity,maximumDispatchCount:1};
  const journal={...core,journalHash:sha256(canonical(core))};
  writeNoReplace(baselineJournalPathV1(operation.operationHash),journal);
  const settlement=baselineSettlementV1(operation,restartOperation,journal);
  writeNoReplace(settlement.path,settlement.value);
}
export function normalHelperCleanupStateFixtureV1(){const walk=walkRegistryV1();return {registrations:walk.registrations.length,outcomes:walk.terminals.map(terminal=>terminal.outcome)}}
`;
  const fixture = await createColdEpochGenesisFixtureV1(source);
  let resume!: () => void, operation: Promise<{ value?: any; error?: unknown }> | undefined;
  let resource: any, ownedFd: number | undefined, ownedIdentity: ReturnType<typeof fstatSync> | undefined;
  let foreignFd: number | undefined, foreignIdentity: ReturnType<typeof fstatSync> | undefined;
  const descriptorReservations: number[] = [];
  const reopenExactSlot = (target: string, expected: number): number => {
    for (let count = 0; count < 256; count++) {
      const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (fd === expected) return fd;
      descriptorReservations.push(fd);
      assert.ok(fd < expected, "original fixture FD slot remains available for controlled reuse");
    }
    throw Error("fixture descriptor reservation bound exceeded");
  };
  let movedRoot: string | undefined;
  let guardProbe: { descriptors: number[]; held: unknown[]; close: () => void } | undefined;
  try {
    const warmup = await fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1();
    await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(warmup);
    if (mode === "ordinary") resource = await fixture.isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    if (mode === "raw") resource = await fixture.isolated.awaitedRawCleanupFixtureV1.acquire();
    if (resource) { ownedFd = fixture.isolated.awaitedRawCleanupFixtureV1.descriptor(resource); ownedIdentity = fstatSync(ownedFd!); }
    if (mode === "dead") writeFileSync(fixture.lock, `${canonical({ schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: 99_999, processStartTimeEpochMs: 1, processIdentityHash: "0".repeat(64), leaseNonce: "1".repeat(64) })}\n`, { mode: 0o600, flag: "wx" });
    const registryRoot = path.join(fixture.root, "baseline-helper-registry-v1");
    if (mode !== "genesis") {
      const authorizationHash = "4".repeat(64), authorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${authorizationHash}`;
      const operationBody = { schema: "setfarm.internal-production-baseline-service-restart-operation.v1", service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", authorizationRef, authorizationHash };
      const operationHash = sha256(canonical(operationBody)), operationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${operationHash}`;
      const normalOperation = recursivelyFreeze({ ...operationBody, operationRef, operationHash });
      const outboxBody = { schema: "setfarm.internal-production-baseline-service-restart-launch-outbox.v1", service: normalOperation.service, actionId: normalOperation.actionId, authorizationRef, authorizationHash, operationRef, operationHash, maximumDispatchCount: 1 };
      const outboxHash = sha256(canonical(outboxBody)), outboxRef = `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${outboxHash}`;
      const lockStats = lstatSync(fixture.lock, { bigint: true });
      fixture.isolated.seedClosableNormalHelperFixtureV1(normalOperation, recursivelyFreeze({ ...outboxBody, outboxRef, outboxHash }), JSON.parse(readFileSync(fixture.lock, "utf8")), { devDecimal: String(lockStats.dev), inoDecimal: String(lockStats.ino) });
      assert.deepEqual(fixture.isolated.normalHelperCleanupStateFixtureV1(), { registrations: 1, outcomes: [] });
    }
    if (mode === "genesis") Reflect.set(globalThis, "__helperCleanupPublicationFaultV1", true);
    let entered!: () => void, completed = false;
    const reached = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { resume = resolve; });
    Reflect.set(globalThis, "__helperCleanupAwaitGateV1", () => { entered(); return gate; });
    if (scenario === "ordinary-guard") Reflect.set(globalThis, "__helperCleanupGuardCaptureV1", (guard: typeof guardProbe) => { guardProbe ??= guard; });
    const invoke = () => mode === "ordinary" ? fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(resource)
      : mode === "raw" ? fixture.isolated.awaitedRawCleanupFixtureV1.release(resource)
      : mode === "genesis" ? fixture.isolated.acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1()
      : fixture.isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    operation = Promise.resolve(invoke()).then(value => ({ value }), error => ({ error })).finally(() => { completed = true; });
    await reached; await new Promise<void>(resolve => setImmediate(resolve));
    Reflect.deleteProperty(globalThis, "__helperCleanupGuardCaptureV1");
    assert.equal(completed, false, "caller must await historical helper validation, including its cleanup path");
    assert.equal(existsSync(fixture.lock), true, "the original physical fence remains while history is pending");
    const fencedIdentity = lstatSync(fixture.lock), fencedBytes = readFileSync(fixture.lock);
    if (mode === "raw") {
      await assert.rejects(fixture.isolated.awaitedRawCleanupFixtureV1.release(resource), /already active/);
      assert.throws(() => fixture.isolated.awaitedRawCleanupFixtureV1.promote(resource), /already active/);
    }
    let replacementBytes: Buffer | undefined;
    let replacementLeafIdentity: ReturnType<typeof lstatSync> | undefined;
    if (scenario.endsWith("-leaf")) {
      renameSync(fixture.lock, path.join(fixture.fixture, "original-awaited-lock"));
      writeFileSync(fixture.lock, fencedBytes, { mode: 0o600, flag: "wx" });
      replacementLeafIdentity = lstatSync(fixture.lock);
    }
    if (scenario.endsWith("-reused")) {
      replacementBytes = readFileSync(fixture.lock); renameSync(fixture.lock, path.join(fixture.fixture, "original-awaited-lock"));
      closeSync(ownedFd!); writeFileSync(fixture.lock, replacementBytes, { mode: 0o600, flag: "wx" });
      foreignFd = reopenExactSlot(fixture.lock, ownedFd!); foreignIdentity = fstatSync(foreignFd);
    }
    if (scenario === "dead-reappeared") Reflect.set(globalThis, "__helperCleanupOwnerReappearedV1", true);
    if (scenario === "ordinary-late-journal") Reflect.set(globalThis, "__helperCleanupOuterMutationV1", () => {
      writeFileSync(path.join(fixture.root, "pre-schema-helper-journal.json"), "new-unsettled-journal", { mode: 0o600, flag: "wx" });
    });
    if (scenario === "ordinary-guard") {
      const fd = guardProbe!.descriptors.at(-1)!;
      closeSync(fd); foreignFd = reopenExactSlot("/dev/null", fd); foreignIdentity = fstatSync(foreignFd);
      replacementBytes = fencedBytes;
    }
    if (scenario.endsWith("-parent")) {
      movedRoot = path.join(fixture.fixture, "original-awaited-parent"); renameSync(fixture.root, movedRoot); mkdirSync(fixture.root, { mode: 0o700 });
      for (const member of readdirSync(movedRoot)) renameSync(path.join(movedRoot, member), path.join(fixture.root, member));
    }
    const registryBeforeResume = mode !== "genesis" ? coldGenesisTreeSnapshotV1(registryRoot) : undefined;
    resume(); const result = await operation;
    if (scenario.includes("-")) {
      assert.ok(result.error, "crossed ownership after the await must refuse cleanup");
      assert.deepEqual(coldGenesisTreeSnapshotV1(registryRoot), registryBeforeResume, "crossed cleanup ownership must refuse before normal registry terminal publication");
      assert.equal(existsSync(fixture.lock), true);
      if (foreignFd === undefined) { assert.equal(lstatSync(fixture.lock).ino, (replacementLeafIdentity ?? fencedIdentity).ino); assert.deepEqual(readFileSync(fixture.lock), fencedBytes); }
      if (foreignFd !== undefined) {
        assert.equal(fstatSync(foreignFd).ino, foreignIdentity!.ino, "refused cleanup must not close a foreign reused FD");
        assert.deepEqual(readFileSync(fixture.lock), replacementBytes);
      }
    } else if (mode === "genesis") assert.match(String(result.error), /FIXTURE_GENESIS_PUBLICATION/);
    else {
      assert.equal(result.error, undefined);
      assert.deepEqual(fixture.isolated.normalHelperCleanupStateFixtureV1(), { registrations: 1, outcomes: ["completed"] }, "valid ownership closes the real pending normal helper registration");
    }
  } finally {
    resume?.(); Reflect.deleteProperty(globalThis, "__helperCleanupPublicationFaultV1");
    const result = await operation;
    if (result?.value) await fixture.isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(result.value);
    if (movedRoot) {
      for (const member of readdirSync(fixture.root)) renameSync(path.join(fixture.root, member), path.join(movedRoot, member));
      renameSync(fixture.root, path.join(fixture.fixture, "foreign-awaited-parent")); renameSync(movedRoot, fixture.root);
    }
    if (scenario === "ordinary-guard" && guardProbe && foreignFd !== undefined) {
      // Test owns the lost original slot; disown the foreign FD before draining
      // only the guard's remaining original descriptors, never restore authority.
      const index = guardProbe.descriptors.indexOf(foreignFd);
      assert.ok(index >= 0); guardProbe.descriptors.splice(index, 1); guardProbe.held.splice(index, 1);
      guardProbe.close(); fixture.isolated.discardDrainedGuardFixtureV1();
    } else fixture.isolated.drainAwaitedCleanupFixtureV1();
    if (mode === "raw" && resource) fixture.isolated.awaitedRawCleanupFixtureV1.dispose(resource);
    for (const [fd, identity] of [[foreignFd, foreignIdentity], [ownedFd, ownedIdentity]] as const) {
      if (fd !== undefined && identity) try { const current = fstatSync(fd); if (current.dev === identity.dev && current.ino === identity.ino) closeSync(fd); }
      catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBADF")) throw error; }
    }
    for (const fd of descriptorReservations) closeSync(fd);
    Reflect.deleteProperty(globalThis, "__helperCleanupOwnerReappearedV1");
    Reflect.deleteProperty(globalThis, "__helperCleanupGuardCaptureV1");
    Reflect.deleteProperty(globalThis, "__helperCleanupOuterMutationV1");
    Reflect.deleteProperty(globalThis, "__helperCleanupAwaitGateV1"); fixture.cleanup();
  }
});

test("cold raw physical lock is not ordinary authority and promotes only the same held descriptor", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-cold-raw-lock-"));
  let descriptorsBefore = 0;
  const identity = (name: string) => { try { const stats = fstatSync(Number(name), { bigint: true }); return `${stats.dev}:${stats.ino}:${stats.mode}:${stats.nlink}`; } catch { return null; } };
  let identitiesBefore = new Map<string, string | null>();
  try {
    const source = readFileSync(sourcePath, "utf8") + `
export const rawLockFixtureV1 = {
  acquire: typeof acquireRawPhysicalTransitionLockV1 === "function" ? acquireRawPhysicalTransitionLockV1 : undefined,
  promote: (raw) => promoteRawPhysicalTransitionLockV1(raw, assertEpochOneActive),
  release: (raw) => releaseRawPhysicalTransitionLockV1(raw),
  descriptor: (value) => rawPhysicalTransitionLocksV1.get(value)?.descriptor ?? leases.get(value)?.descriptor,
};\n`;
    const modulePath = installRetirementFixture(fixture, source);
    const isolated = await import(`${pathToFileURL(modulePath).href}?cold-raw=${Date.now()}`);
    const namesBefore = readdirSync("/dev/fd");
    descriptorsBefore = namesBefore.length;
    identitiesBefore = new Map(namesBefore.map((name) => [name, identity(name)]));
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const epoch = path.join(root, "epoch-head.json");
    const lock = path.join(root, "physical-service-restart-authority.transition.lock");
    const historicalHead = readFileSync(epoch);
    unlinkSync(epoch);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /ENOENT/);
    assert.equal(existsSync(lock), false, "ordinary admission must not create a lock when epoch is absent");
    const raw = await isolated.rawLockFixtureV1.acquire();
    assert.equal(Object.isFrozen(raw), true);
    assert.deepEqual(Reflect.ownKeys(raw), ["schema"]);
    const descriptor = isolated.rawLockFixtureV1.descriptor(raw);
    const inode = fstatSync(descriptor).ino;
    const lockBytes = readFileSync(lock);
    assert.equal(statSync(lock).ino, inode);
    assert.equal(existsSync(epoch), false, "raw ownership creates no epoch or genesis");
    await assert.rejects(isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(raw), /foreign, cloned, or released/);
    await assert.rejects(async () => isolated.rawLockFixtureV1.release(structuredClone(raw)), /raw.*foreign|raw.*cloned/);
    await assert.rejects(async () => isolated.rawLockFixtureV1.promote(raw), /ENOENT/);
    assert.deepEqual(readFileSync(lock), lockBytes, "failed promotion retains the exact raw owner");
    assert.equal(fstatSync(descriptor).ino, inode);
    writeFileSync(epoch, historicalHead, { flag: "wx", mode: 0o600 });
    const lease = await isolated.rawLockFixtureV1.promote(raw);
    assert.equal(isolated.rawLockFixtureV1.descriptor(lease), descriptor);
    assert.equal(statSync(lock).ino, inode);
    assert.deepEqual(readFileSync(lock), lockBytes, "promotion never unlocks or creates a replacement lock");
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /lease is unavailable/);
    await assert.rejects(async () => isolated.rawLockFixtureV1.promote(raw), /raw.*foreign|raw.*released|raw.*promoted/);
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    assert.equal(existsSync(lock), false);
    const abandoned = await isolated.rawLockFixtureV1.acquire();
    await isolated.rawLockFixtureV1.release(abandoned);
    assert.equal(existsSync(lock), false);
    await assert.rejects(async () => isolated.rawLockFixtureV1.release(abandoned), /raw.*foreign|raw.*released/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
  const namesAfter = readdirSync("/dev/fd");
  const added = namesAfter.map((name) => [name, identity(name)] as const).filter(([name, value]) => value !== null && identitiesBefore.get(name) !== value);
  const diagnostic = namesAfter.length !== descriptorsBefore && added.length > 0 ? spawnSync("/usr/sbin/lsof", ["-nP", "-a", "-p", String(process.pid), "-d", added.map(([name]) => name).join(",")], { encoding: "utf8", timeout: 4000, maxBuffer: 65536, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } }).stdout : "";
  assert.equal(namesAfter.length, descriptorsBefore, `raw promotion and release leak no descriptors: ${JSON.stringify(added)} ${diagnostic}`);
});

test("P4 restart transition lease authenticates epoch one", async () => {
  const module = await import(`../../src/internal-production/baseline-restart-authority-retirement-v1.js?p4-lease=${Date.now()}`);
  assert.deepEqual(Object.keys(module), [
    "MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1",
    "acquireInternalProductionColdRecoveryEpochGenesisTransitionLeaseV1",
    "acquireInternalProductionDirectSpawnerChildStartupContextV1",
    "acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1",
    "consumeInternalProductionColdSpawnerPidResidueV1",
    "ensureInternalProductionColdSpawnerBootstrapSettledV1",
    "invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1",
    "invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1",
    "observeInternalProductionBaselineServiceRestartHelperJournalCensusV1",
    "observeInternalProductionColdSpawnerBootstrapJournalCensusV1",
    "observeInternalProductionColdSpawnerHelperIntentPhaseV1",
    "observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1",
    "prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1",
    "publishInternalProductionColdSpawnerBootstrapClaimV1",
    "releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1",
    "resolveInternalProductionBaselineRestartAuthorityRetirementV1",
    "resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1",
    "resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1",
    "resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1",
    "resolveInternalProductionColdSpawnerChildRuntimeSnapshotV1",
    "resolveInternalProductionColdSpawnerHelperRuntimeSnapshotV1",
    "resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1",
    "resolveInternalProductionServiceRestartAuthorityActivationV1",
    "resolveInternalProductionServiceRestartAuthorityCutoverV1",
    "resolveInternalProductionServiceRestartStartupHooksReadyV1",
    "resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1",
    "resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1",
    "runInternalProductionColdSpawnerHelperV1",
    "runInternalProductionDirectSpawnerHelperV1",
  ]);
  assert.equal(module.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1.length, 0);
  assert.equal(module.ensureInternalProductionColdSpawnerBootstrapSettledV1.length, 0);
  assert.equal(module.acquireInternalProductionDirectSpawnerChildStartupContextV1.length, 0);
  assert.equal(module.runInternalProductionDirectSpawnerHelperV1.length, 0);
  assert.equal(module.resolveInternalProductionSpawnerInheritedRuntimeSnapshotV1.length, 0);
  assert.equal(module.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1.length, 1);
  assert.equal(module.invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1.length, 2);
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /process\.env|globalThis|forTests|dependencies\s*:/);
  assert.match(source, /WeakMap/);
  assert.match(source, /authorityOwner:\s*"baseline-a"/);
  assert.match(source, /held.*released/s);
  assert.match(source, /resolveInternalProductionBaselineServiceRestartOperationV1/);
  assert.match(source, /observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1/);
  assert.match(source, /setfarm\.internal-production-baseline-service-restart-helper-registry-registration\.v1/);
  assert.match(source, /setfarm\.internal-production-baseline-service-restart-helper-journal-census\.v1/);

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

test("P4 normal restart keeps census generation stable and binds physical process projection", () => {
  const receipt = readFileSync(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-post-handoff-receipt-v1.ts"), "utf8");
  const retirement = readFileSync(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-restart-authority-retirement-v1.ts"), "utf8");
  const spawner = readFileSync(path.resolve(import.meta.dirname, "../../src/spawner.ts"), "utf8");
  assert.match(receipt, /"runtime-projections"/);
  assert.match(receipt, /spawnerServiceIdentityHash: census\.spawner\.processIdentityHash/);
  assert.match(receipt, /dashboardServiceIdentityHash: census\.dashboard\.processIdentityHash/);
  assert.match(receipt, /missionControlServiceIdentityHash: census\.missionControl\.processIdentityHash/);
  assert.match(receipt, /resolveTask12PreparedRuntimeProjectionV1\(authorization\.preparedRuntimeSourceProjectionHash\)/);
  assert.match(receipt, /beforeGenerationHash: selectedBeforeProcessIdentityHash[\s\S]*afterGenerationHash: selectedAfterProcessIdentityHash/);
  const invoke = retirement.slice(retirement.indexOf("export async function invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1"));
  assert.ok(invoke.indexOf("priorTerminal") < invoke.indexOf("reobserveInternalProductionBaselineServiceRestartPreparedRuntimeProjectionV1"), "response-loss recovery adopts the terminal before requiring the old live process");
  assert.match(spawner, /beforeGenerationHash: String\(spawner\.processIdentityHash\)/);
  assert.match(spawner, /currentGenerationHash: census\.spawner\.processIdentityHash/);
});

test("P4 normal restart executes the production P1 to P2 projection and adopts the terminal before live drift", async () => {
  const receiptSource = readFileSync(path.resolve(import.meta.dirname, "../../src/internal-production/baseline-post-handoff-receipt-v1.ts"), "utf8");
  const projectionStart = receiptSource.indexOf("function task12RuntimeProjectionV1(");
  const projectionEnd = receiptSource.indexOf("export async function reobserveInternalProductionBaselineServiceRestartPreparedRuntimeProjectionV1(", projectionStart);
  const restartStart = receiptSource.indexOf("export async function restartInternalProductionBaselineServiceV1(");
  assert.ok(projectionStart >= 0 && projectionEnd > projectionStart && restartStart > projectionEnd);
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-normal-restart-production-"));
  try {
    const internalDirectory = path.join(fixture, "src/internal-production");
    mkdirSync(internalDirectory, { recursive: true });
    writeFileSync(path.join(internalDirectory, "baseline-restart-authority-retirement-v1.ts"), `
const g=globalThis;
export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){g.__p4RestartAcquireCalls+=1;return Object.freeze({schema:"lease"})}
export async function invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(_lease,input){g.__p4RestartInvokeCalls+=1;g.__p4LiveCensus=g.__p4AfterCensus;const helperSettlementHash="e".repeat(64);return Object.freeze({helperSettlementRef:"setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/"+helperSettlementHash,helperSettlementHash})}
export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(){g.__p4RestartReleaseCalls+=1}
`, "utf8");
    const kernelPath = path.join(internalDirectory, "restart-kernel.ts");
    writeFileSync(kernelPath, `
import path from "node:path";
import {createHash} from "node:crypto";
const g=globalThis as any;
const store=new Map<string,Buffer>();
const canonical=(v:any):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
const hashCanonicalJson=(v:any)=>createHash("sha256").update(canonical(v)).digest("hex");
const recursivelyFreeze=(v:any):any=>{if(v&&typeof v==="object"&&!Object.isFrozen(v)){for(const member of Object.values(v))recursivelyFreeze(member);Object.freeze(v)}return v};
const currentEntryFail=(message:string):never=>{throw new Error(message)};
const requireSha256=(value:any,message:string)=>{if(typeof value!=="string"||!/^[0-9a-f]{64}$/.test(value))currentEntryFail(message);return value};
const requireGitHash=(value:any,message:string)=>{if(typeof value!=="string"||!/^[0-9a-f]{40}$/.test(value))currentEntryFail(message);return value};
const hasExactKeys=(value:any,keys:readonly string[])=>value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));
const strictCanonicalRecord=(bytes:Buffer)=>JSON.parse(bytes.toString("utf8"));
const canonicalRecordBytes=async(value:any)=>Buffer.from(canonical(value));
const readStableRegular=(target:string)=>{const bytes=store.get(target);if(!bytes){const error:any=new Error("ENOENT");error.code="ENOENT";throw error}return {bytes}};
const readTask12ReceiptStoreBytesV1=(target:string)=>readStableRegular(target).bytes;
const publishLegacyZeroRecordV1=(target:string,bytes:Buffer)=>{const current=store.get(target);if(current&&!current.equals(bytes))throw new Error("store conflict");store.set(target,Buffer.from(bytes))};
const isEnoent=(error:any)=>error&&error.code==="ENOENT";
const lstatSync=()=>({dev:1n});
const fixedRepositoryRoot=()=>"/p4";
const fixedWorkspaceAuthorityPathV1=(...segments:string[])=>path.join(fixedRepositoryRoot(),...segments);
const CURRENT_ENTRY_MAX_BYTES=1024*1024;
const BASELINE_RESTART_ROOT_V1="data/internal-production-baseline/baseline-service-restart-v1";
const BASELINE_RESTART_AUTHORIZATION_PREFIX_V1="setfarm://internal-production/baseline-service-restart-authorization/sha256/";
const BASELINE_RESTART_OPERATION_PREFIX_V1="setfarm://internal-production/baseline-service-restart-operation/sha256/";
const BASELINE_RESTART_OUTBOX_PREFIX_V1="setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/";
const BASELINE_RESTART_RECEIPT_PREFIX_V1="setfarm://internal-production/baseline/service-restarts/";
const ZERO_OWNER_GUARD_ROOT_V1="data/zero";
const BASELINE_RESTART_ACTIONS_V1=Object.freeze({"setfarm-spawner":"a-restart-service-setfarm-spawner-v1","setfarm-dashboard":"a-restart-service-setfarm-dashboard-v1","mission-control":"a-restart-service-mission-control-v1"} as const);
const baselineRestartPathV1=(kind:string,hash:string)=>path.join(fixedRepositoryRoot(),BASELINE_RESTART_ROOT_V1,kind,"sha256",hash.slice(0,2),hash+".json");
const baselineRestartOutboxLocatorV1=(hash:string)=>path.join(fixedRepositoryRoot(),BASELINE_RESTART_ROOT_V1,"outbox-by-operation/sha256",hash.slice(0,2),hash+".pair.json");
const baselineRestartAuthorityLocatorV1=(hash:string)=>path.join(fixedRepositoryRoot(),BASELINE_RESTART_ROOT_V1,"authority-by-authorization/sha256",hash.slice(0,2),hash+".pair.json");
const zeroOwnerConsumedIndexPathV1=(hash:string)=>path.join("/p4/zero-index",hash);
const requirePair=(value:any,refKey:string,hashKey:string,prefix:string)=>{if(!value||typeof value!=="object"||typeof value[refKey]!=="string"||!value[refKey].startsWith(prefix)||!requireSha256(value[hashKey],hashKey))throw new Error("pair invalid");return value};
const observeCurrentInternalProductionCleanSetfarmSourceBuildV1=()=>g.__p4Source;
const observeInternalProductionServiceCensusV1=async()=>g.__p4LiveCensus;
const resolveInternalProductionBaselineServiceRestartAuthorizationV1=async(input:any)=>{if(input.authorizationRef!==g.__p4Authorization.authorizationRef||input.authorizationHash!==g.__p4Authorization.authorizationHash)throw new Error("authorization crossed");return g.__p4Authorization};
const resolveInternalProductionBaselineZeroOwnerMutationGuardV1=async()=>g.__p4ZeroGuard;
const observeCompleteInternalProductionZeroOwnerCensusV1=async()=>g.__p4Zero;
const resolveInternalProductionBaselineServiceRestartOperationV1=async(pair:any)=>pair;
const observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1=async(pair:any)=>pair;
const resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1=async()=>({schemaProjectionHash:"f".repeat(64)});
const resolveInternalProductionBaselineServiceRestartAuthorityV1=async(pair:any)=>{const value=strictCanonicalRecord(readStableRegular(baselineRestartPathV1("authorities",pair.receiptHash)).bytes);const body={...value};delete body.receiptRef;delete body.receiptHash;if(hashCanonicalJson(body)!==pair.receiptHash||value.receiptRef!==pair.receiptRef)throw new Error("restart authority crossed");return recursivelyFreeze(value)};
${receiptSource.slice(projectionStart, projectionEnd)}
${receiptSource.slice(restartStart)}
export const p4RuntimeProjection=task12RuntimeProjectionV1;
export const p4ProjectionPath=(hash:string)=>baselineRestartPathV1("runtime-projections",hash);
export const p4Reset=()=>store.clear();
export const p4Seed=(target:string,value:any)=>store.set(target,Buffer.from(canonical(value)));
export const p4ReadAuthority=async(pair:any)=>resolveInternalProductionBaselineServiceRestartAuthorityV1(pair);
`, "utf8");
    const kernel = await import(`${pathToFileURL(kernelPath).href}?production-restart=${Date.now()}`) as any;
    const source = { sha: "1".repeat(40), buildHash: "2".repeat(64) };
    const service = (processIdentityHash: string, loadedSourceSha = source.sha, loadedBuildHash = source.buildHash) => ({
      pid: 100,
      processStartTimeEpochMs: 1,
      processIdentityHash,
      serviceIdentityHash: "8".repeat(64),
      generationHash: "9".repeat(64),
      loadedSourceSha,
      loadedBuildHash,
    });
    const p1 = {
      spawner: service("a".repeat(64)),
      dashboard: service("b".repeat(64)),
      missionControl: service("c".repeat(64), "3".repeat(40), "4".repeat(64)),
      openClaw: service("d".repeat(64)),
    };
    const p2 = { ...p1, spawner: { ...p1.spawner, pid: 200, processStartTimeEpochMs: 2, processIdentityHash: "e".repeat(64) } };
    const zeroHash = "5".repeat(64);
    const authorizationHash = "6".repeat(64);
    const authorization = {
      schema: "setfarm.internal-production-baseline-service-restart-authorization.v1",
      service: "setfarm-spawner",
      preparedRuntimeSourceProjectionHash: "",
      zeroOwnerGuardRef: `setfarm://internal-production/zero-owner-mutation-guard/sha256/${"7".repeat(64)}`,
      zeroOwnerGuardHash: "7".repeat(64),
      completeZeroOwnerCensusHash: zeroHash,
      migrationReceiptRef: `setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/${"8".repeat(64)}`,
      migrationReceiptHash: "8".repeat(64),
      authorizationRef: `${"setfarm://internal-production/baseline-service-restart-authorization/sha256/"}${authorizationHash}`,
      authorizationHash,
    };
    const reset = (after: unknown) => {
      kernel.p4Reset();
      Object.assign(globalThis as Record<string, unknown>, {
        __p4Source: source,
        __p4LiveCensus: p1,
        __p4AfterCensus: after,
        __p4RestartAcquireCalls: 0,
        __p4RestartInvokeCalls: 0,
        __p4RestartReleaseCalls: 0,
        __p4Zero: { observationRef: "setfarm://tests/zero", observationHash: zeroHash },
        __p4ZeroGuard: { completeZeroOwnerCensusObservationRef: "setfarm://tests/zero", completeZeroOwnerCensusObservationHash: zeroHash },
      });
      const projection = kernel.p4RuntimeProjection(p1);
      authorization.preparedRuntimeSourceProjectionHash = projection.projectionHash;
      (globalThis as Record<string, unknown>).__p4Authorization = recursivelyFreeze({ ...authorization });
      kernel.p4Seed(kernel.p4ProjectionPath(projection.projectionHash), projection);
      return projection;
    };

    const before = reset(p2);
    const pair = await kernel.restartInternalProductionBaselineServiceV1({ authorizationRef: authorization.authorizationRef, authorizationHash });
    const authority = await kernel.p4ReadAuthority(pair);
    assert.equal(authority.before.projectionHash, before.projectionHash);
    assert.equal(authority.restart.beforeGenerationHash, p1.spawner.processIdentityHash);
    assert.equal(authority.restart.afterGenerationHash, p2.spawner.processIdentityHash);
    assert.equal(authority.after.dashboardServiceIdentityHash, before.dashboardServiceIdentityHash);
    assert.equal(authority.after.missionControlServiceIdentityHash, before.missionControlServiceIdentityHash);
    assert.equal((globalThis as Record<string, unknown>).__p4RestartInvokeCalls, 1);

    (globalThis as Record<string, unknown>).__p4AfterCensus = { ...p2, dashboard: { ...p2.dashboard, processIdentityHash: "0".repeat(64) } };
    const adopted = await kernel.restartInternalProductionBaselineServiceV1({ authorizationRef: authorization.authorizationRef, authorizationHash });
    assert.deepEqual(adopted, pair, "terminal locator adoption precedes any live reobservation on response loss");
    assert.equal((globalThis as Record<string, unknown>).__p4RestartAcquireCalls, 1);
    assert.equal((globalThis as Record<string, unknown>).__p4RestartInvokeCalls, 1);

    reset(p1);
    await assert.rejects(kernel.restartInternalProductionBaselineServiceV1({ authorizationRef: authorization.authorizationRef, authorizationHash }), /did not replace exactly the target physical process/);
    reset({ ...p2, dashboard: { ...p2.dashboard, processIdentityHash: "0".repeat(64) } });
    await assert.rejects(kernel.restartInternalProductionBaselineServiceV1({ authorizationRef: authorization.authorizationRef, authorizationHash }), /changed an unrelated service identity/);
  } finally {
    for (const key of ["__p4Source", "__p4LiveCensus", "__p4AfterCensus", "__p4RestartAcquireCalls", "__p4RestartInvokeCalls", "__p4RestartReleaseCalls", "__p4Zero", "__p4ZeroGuard", "__p4Authorization"]) Reflect.deleteProperty(globalThis, key);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 normal restart refuses missing or drifted stored-before projection before helper dispatch", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-normal-projection-refusal-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    seedPreSchemaHelperClosure(fixture);
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?projection-refusal=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const authorizationHash = "4".repeat(64);
    const authorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${authorizationHash}`;
    const operationBody = { schema: "setfarm.internal-production-baseline-service-restart-operation.v1", service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", authorizationRef, authorizationHash };
    const operationHash = sha256(canonical(operationBody));
    const operationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${operationHash}`;
    const operation = recursivelyFreeze({ ...operationBody, operationRef, operationHash });
    const outboxBody = { schema: "setfarm.internal-production-baseline-service-restart-launch-outbox.v1", service: operation.service, actionId: operation.actionId, authorizationRef, authorizationHash, operationRef, operationHash, maximumDispatchCount: 1 };
    const outboxHash = sha256(canonical(outboxBody));
    (globalThis as Record<string, unknown>).__p4BaselineOperation = operation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...outboxBody, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${outboxHash}`, outboxHash });
    const restartOperation = { operationRef, operationHash };
    const journalPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/baseline-helper-journals/sha256", operationHash.slice(0, 2), `${operationHash}.json`);
    (globalThis as Record<string, unknown>).__p4PreparedProjectionMissing = true;
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /prepared runtime projection missing/);
    assert.equal(existsSync(journalPath), false, "missing stored-before projection refuses before helper journal/dispatch");
    Reflect.deleteProperty(globalThis, "__p4PreparedProjectionMissing");
    (globalThis as Record<string, unknown>).__p4PreparedProjectionDrift = true;
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /prepared runtime projection drifted/);
    assert.equal(existsSync(journalPath), false, "live P1 drift refuses before helper journal/dispatch");
    Reflect.deleteProperty(globalThis, "__p4PreparedProjectionDrift");
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
  } finally {
    Reflect.deleteProperty(globalThis, "__p4PreparedProjectionMissing");
    Reflect.deleteProperty(globalThis, "__p4PreparedProjectionDrift");
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 retirement rejects insecure authority-store ancestors", async () => {
  const captureAcquireFailure = async (fixture: string): Promise<unknown> => {
    const modulePath = path.join(fixture, "src/internal-production/baseline-restart-authority-retirement-v1.ts");
    const isolated = await import(`${pathToFileURL(modulePath).href}?ancestor=${Date.now()}-${Math.random()}`);
    let lease: Awaited<ReturnType<typeof isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1>> | undefined;
    try {
      lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
      return undefined;
    } catch (error) {
      return error;
    } finally {
      if (lease) await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    }
  };

  const wrongModeFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-bad-mode-"));
  try {
    installRetirementFixture(wrongModeFixture, readFileSync(sourcePath, "utf8"));
    chmodSync(path.join(wrongModeFixture, "data"), 0o755);
    assert.match(String(await captureAcquireFailure(wrongModeFixture)), /directory|mode|ancestor/i);
    chmodSync(path.join(wrongModeFixture, "data"), 0o1700);
    assert.match(String(await captureAcquireFailure(wrongModeFixture)), /directory|mode|ancestor/i, "special permission bits must not pass an exact 0700 check");
  } finally {
    rmSync(wrongModeFixture, { recursive: true, force: true });
  }

  const symlinkFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-symlink-"));
  try {
    installRetirementFixture(symlinkFixture, readFileSync(sourcePath, "utf8"));
    const authorityBase = path.join(symlinkFixture, "data/internal-production-baseline");
    const held = `${authorityBase}.held`;
    renameSync(authorityBase, held);
    symlinkSync(held, authorityBase);
    assert.match(String(await captureAcquireFailure(symlinkFixture)), /directory|symbolic|ancestor/i);
  } finally {
    rmSync(symlinkFixture, { recursive: true, force: true });
  }

  const raceFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-directory-race-"));
  try {
    const originalSource = readFileSync(sourcePath, "utf8");
    const raceSource = originalSource.replace(
      "  try {\n    rootGuard.assertStable();\n    if (abandonedAcquireV1)",
      "  try {\n    const directoryRaceHook = Reflect.get(globalThis, '__setfarmP4RetirementDirectoryRaceHook');\n    if (typeof directoryRaceHook === 'function') directoryRaceHook();\n    rootGuard.assertStable();\n    if (abandonedAcquireV1)",
    );
    assert.notEqual(raceSource, originalSource, "retirement directory-race fixture must replace the exact post-authentication boundary");
    installRetirementFixture(raceFixture, raceSource);
    const raceRoot = path.join(raceFixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const heldRaceRoot = `${raceRoot}.held`;
    const externalRaceRoot = path.join(raceFixture, "external-retirement-store");
    mkdirSync(externalRaceRoot, { mode: 0o700 });
    Reflect.set(globalThis, "__setfarmP4RetirementDirectoryRaceHook", () => {
      renameSync(raceRoot, heldRaceRoot);
      symlinkSync(externalRaceRoot, raceRoot);
    });
    try {
      assert.match(String(await captureAcquireFailure(raceFixture)), /directory.*changed|symbolic|identity/i);
      assert.throws(
        () => readFileSync(path.join(externalRaceRoot, "physical-service-restart-authority.transition.lock")),
        /ENOENT/,
        "a raced external directory must receive no lock bytes",
      );
    } finally {
      Reflect.deleteProperty(globalThis, "__setfarmP4RetirementDirectoryRaceHook");
    }
  } finally {
    rmSync(raceFixture, { recursive: true, force: true });
  }
});

test("P4 retirement recovers an exact abandoned acquisition after a post-lock directory race", async () => {
  for (const leakOwnedLock of [false, true]) {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-post-lock-race-"));
  try {
    const originalSource = readFileSync(sourcePath, "utf8");
    const raceSource = originalSource.replace(
      "const lease = Object.freeze({ schema: \"setfarm.internal-production-physical-service-restart-authority-transition-lease.v1\" as const });",
      "const postLockRaceHook = Reflect.get(globalThis, '__setfarmP4RetirementPostLockRaceHook');\n  if (typeof postLockRaceHook === 'function') postLockRaceHook();\n  const lease = Object.freeze({ schema: \"setfarm.internal-production-physical-service-restart-authority-transition-lease.v1\" as const });",
    );
    assert.notEqual(raceSource, originalSource, "post-lock race fixture must replace the exact pre-registration boundary");
    const measuredSource = leakOwnedLock ? raceSource.replace("  openSync,", "  openSync as actualOpenSync,").replace("  closeSync,", "  closeSync as actualCloseSync,") + `
let measuredLock: number | undefined, leaked = false;
function openSync(target:any,...args:any[]){const fd=actualOpenSync(target,...args);if(measuredLock===undefined&&String(target).endsWith('/physical-service-restart-authority.transition.lock'))measuredLock=fd;return fd;}
function closeSync(fd:number){if(fd===measuredLock&&!leaked){leaked=true;return;}actualCloseSync(fd);}
` : raceSource;
    const modulePath = installRetirementFixture(fixture, measuredSource);
    // A plain child excludes the parent's unawaited tsx cache writes from the
    // all-descriptor census without filtering any descriptor or disabling cache.
    const moduleUrl = await compilePlainRetirementFixtureV1(fixture, modulePath);
    const runner = path.join(fixture, "race.mjs");
    writeFileSync(runner, `
import assert from 'node:assert/strict';
import {existsSync,fstatSync,mkdirSync,readdirSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
import path from 'node:path';
const isolated=await import(${JSON.stringify(moduleUrl)});
const fixture=${JSON.stringify(fixture)};
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const heldRoot = root + '.held';
    const externalRoot = path.join(fixture, "external-post-lock-retirement-store");
    const lock = path.join(root, "physical-service-restart-authority.transition.lock");
    mkdirSync(externalRoot, { mode: 0o700 });
    const descriptorNamesBefore = readdirSync("/dev/fd");
    const descriptorsBefore = descriptorNamesBefore.length;
    const liveDescriptorInventory = (names) => new Map(names.flatMap((name) => {
      try { const stats = fstatSync(Number(name), { bigint: true }); return [[name, String(stats.dev)+':'+stats.ino+':'+stats.mode]]; }
      catch (error) { if (error.code === "EBADF") return []; throw error; }
    }));
    const descriptorInventoryBefore = liveDescriptorInventory(descriptorNamesBefore);
    Reflect.set(globalThis, "__setfarmP4RetirementPostLockRaceHook", () => {
      renameSync(root, heldRoot);
      symlinkSync(externalRoot, root);
    });
    try {
      await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /directory.*changed|symbolic|identity/i);
    } finally {
      Reflect.deleteProperty(globalThis, "__setfarmP4RetirementPostLockRaceHook");
    }
    unlinkSync(root);
    renameSync(heldRoot, root);
    const retryLease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(retryLease);
    assert.equal(existsSync(lock), false, "retry release must leave no transition lock");
    const descriptorsAfter = readdirSync("/dev/fd");
    assert.equal(descriptorsAfter.length, descriptorsBefore, 'abandoned acquisition must not leak a descriptor');
    assert.deepEqual(liveDescriptorInventory(descriptorsAfter), descriptorInventoryBefore, 'abandoned acquisition must preserve every original descriptor identity');
`);
    const result = spawnSync(process.execPath, [runner], { encoding: "utf8", timeout: 15000, maxBuffer: 65536, env: { HOME: homedir(), PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
    assert.equal(result.error, undefined);
    if (leakOwnedLock) {
      assert.notEqual(result.status, 0, "the isolated census must detect a withheld real owned-lock close");
      assert.match(result.stderr, /abandoned acquisition must not leak a descriptor/);
    } else { assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, ""); }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
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
    mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
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
    mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
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
    mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
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
    ["second-epoch", "  assertEpoch();\n  const lease", "  throw new Error('P4_ACQUIRE_SECOND_EPOCH_FAULT');\n  const lease"],
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
  const fencePorts = /async function fencePortsV1\(\)[\s\S]*?\n}\n/.exec(source)?.[0] ?? "";
  assert.match(fencePorts, /import\("\.\.\/db-pg\.js"\)/);
  assert.doesNotMatch(fencePorts, /owner-admission-v1\.js/);
});

test("P4 baseline helper registry closes an indeterminate journal without redispatch", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-baseline-helper-registry-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    seedPreSchemaHelperClosure(fixture);
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?registry=${Date.now()}`);
    const lease = await isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    const authorizationHash = "4".repeat(64);
    const authorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${authorizationHash}`;
    const operationBody = { schema: "setfarm.internal-production-baseline-service-restart-operation.v1", service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", authorizationRef, authorizationHash };
    const operationHash = sha256(canonical(operationBody));
    const operationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${operationHash}`;
    const restartOperation = { operationRef, operationHash };
    const operation = recursivelyFreeze({ ...operationBody, operationRef, operationHash });
    const outboxBody = { schema: "setfarm.internal-production-baseline-service-restart-launch-outbox.v1", service: operation.service, actionId: operation.actionId, authorizationRef, authorizationHash, operationRef, operationHash, maximumDispatchCount: 1 };
    const outboxHash = sha256(canonical(outboxBody));
    const outboxRef = `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${outboxHash}`;
    (globalThis as Record<string, unknown>).__p4BaselineOperation = operation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...outboxBody, outboxRef, outboxHash });
    const root = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const registryRoot = path.join(root, "baseline-helper-registry-v1");
    const journalPath = path.join(root, "baseline-helper-journals/sha256", operationHash.slice(0, 2), `${operationHash}.json`);
    (globalThis as Record<string, unknown>).__p4BaselineOperation = structuredClone(operation);
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /recursively frozen/);
    (globalThis as Record<string, unknown>).__p4BaselineOperation = operation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...outboxBody, unexpected: true, outboxRef, outboxHash });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /shape is invalid/);
    const wrongCountBody = { ...outboxBody, maximumDispatchCount: 2 };
    const wrongCountHash = sha256(canonical(wrongCountBody));
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...wrongCountBody, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${wrongCountHash}`, outboxHash: wrongCountHash });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /outbox.*crossed/);
    const crossedAuthorizationRef = `setfarm://foreign/baseline-service-restart-authorization/sha256/${authorizationHash}`;
    const crossedOperationBody = { ...operationBody, authorizationRef: crossedAuthorizationRef };
    const crossedOperationHash = sha256(canonical(crossedOperationBody));
    const crossedOperationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${crossedOperationHash}`;
    const crossedRestartOperation = { operationRef: crossedOperationRef, operationHash: crossedOperationHash };
    const crossedOperation = recursivelyFreeze({ ...crossedOperationBody, operationRef: crossedOperationRef, operationHash: crossedOperationHash });
    const crossedOutboxBody = { ...outboxBody, authorizationRef: crossedAuthorizationRef, operationRef: crossedOperationRef, operationHash: crossedOperationHash };
    const crossedOutboxHash = sha256(canonical(crossedOutboxBody));
    (globalThis as Record<string, unknown>).__p4BaselineOperation = crossedOperation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...crossedOutboxBody, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${crossedOutboxHash}`, outboxHash: crossedOutboxHash });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation: crossedRestartOperation }), /operation is crossed/, "a self-consistent foreign authorization namespace cannot enter the live registry");
    assert.equal(existsSync(registryRoot), false, "Task12 operation/outbox refusal precedes registry mutation");
    assert.equal(existsSync(journalPath), false, "Task12 operation/outbox refusal precedes journal mutation");
    (globalThis as Record<string, unknown>).__p4BaselineOperation = operation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...outboxBody, outboxRef, outboxHash });
    const lockPath = path.join(root, "physical-service-restart-authority.transition.lock");
    const transitionLock = JSON.parse(readFileSync(lockPath, "utf8"));
    const lockStats = statSync(lockPath, { bigint: true });
    const lockIdentity = { devDecimal: lockStats.dev.toString(10), inoDecimal: lockStats.ino.toString(10) };
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "baseline-service-restart", operationSchema: operation.schema, action: operation.actionId, restartOperation, transitionLock, lockIdentity, maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    const journalDirectory = path.join(root, "baseline-helper-journals/sha256", operationHash.slice(0, 2));
    mkdirSync(journalDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(journalPath, `${canonical({ ...journalBody, journalHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/);
    const census = await isolated.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    assert.deepEqual(Reflect.ownKeys(census), ["schema", "preSchemaHelperState", "registeredBaselineHelperJournalCount", "terminalBaselineHelperJournalCount", "liveBaselineHelperJournalCount", "ambiguousBaselineHelperJournalCount", "helperJournalRegistryHeadRef", "helperJournalRegistryHeadHash", "retainedHelperJournalSettlementSetHash", "censusHash"]);
    assert.deepEqual([census.registeredBaselineHelperJournalCount, census.terminalBaselineHelperJournalCount, census.liveBaselineHelperJournalCount, census.ambiguousBaselineHelperJournalCount], [1, 1, 0, 1]);
    const terminalHead = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1({ headRef: census.helperJournalRegistryHeadRef, headHash: census.helperJournalRegistryHeadHash });
    assert.equal(terminalHead.entryKind, "terminal");
    const terminal = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1({ terminalRef: terminalHead.entryRef, terminalHash: terminalHead.entryHash });
    assert.equal(terminal.outcome, "ambiguous");
    const registrationHead = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1({ headRef: terminal.predecessorHeadRef, headHash: terminal.predecessorHeadHash });
    const registration = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1({ registrationRef: registrationHead.entryRef, registrationHash: registrationHead.entryHash });
    assert.equal(registration.operationHash, operationHash);
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/, "terminal ambiguity must be adopted without another helper attempt");
    const settlementBody = { schema: "setfarm.internal-production-baseline-service-restart-helper-settlement.v1", action: operation.actionId, restartOperation, journalHash, transitionLock, lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(settlementBody));
    const helperSettlementRef = `setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/${helperSettlementHash}`;
    const settlementDirectory = path.join(root, "baseline-helper-settlements/sha256", helperSettlementHash.slice(0, 2));
    mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(settlementDirectory, `${helperSettlementHash}.json`), `${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation }), /HELPER_DISPATCH_SETTLEMENT_UNKNOWN/, "a late settlement cannot rewrite terminal ambiguity");
    const secondAuthorizationHash = "5".repeat(64);
    const secondAuthorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${secondAuthorizationHash}`;
    const secondOperationBody = { ...operationBody, authorizationRef: secondAuthorizationRef, authorizationHash: secondAuthorizationHash };
    const secondOperationHash = sha256(canonical(secondOperationBody));
    const secondOperationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${secondOperationHash}`;
    const secondRestartOperation = { operationRef: secondOperationRef, operationHash: secondOperationHash };
    const secondOperation = recursivelyFreeze({ ...secondOperationBody, operationRef: secondOperationRef, operationHash: secondOperationHash });
    const secondOutboxBody = { schema: outboxBody.schema, service: secondOperation.service, actionId: secondOperation.actionId, authorizationRef: secondAuthorizationRef, authorizationHash: secondAuthorizationHash, operationRef: secondOperationRef, operationHash: secondOperationHash, maximumDispatchCount: 1 };
    const secondOutboxHash = sha256(canonical(secondOutboxBody));
    const secondOutboxRef = `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${secondOutboxHash}`;
    (globalThis as Record<string, unknown>).__p4BaselineOperation = secondOperation;
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...secondOutboxBody, outboxRef: secondOutboxRef, outboxHash: secondOutboxHash });
    const secondJournalBody = { ...journalBody, restartOperation: secondRestartOperation };
    const secondJournalHash = sha256(canonical(secondJournalBody));
    const secondJournalDirectory = path.join(root, "baseline-helper-journals/sha256", secondOperationHash.slice(0, 2));
    mkdirSync(secondJournalDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(secondJournalDirectory, `${secondOperationHash}.json`), `${canonical({ ...secondJournalBody, journalHash: secondJournalHash })}\n`, { mode: 0o600 });
    const secondSettlementBody = { ...settlementBody, restartOperation: secondRestartOperation, journalHash: secondJournalHash };
    const secondSettlementHash = sha256(canonical(secondSettlementBody));
    const secondSettlementRef = `setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/${secondSettlementHash}`;
    const secondSettlementDirectory = path.join(root, "baseline-helper-settlements/sha256", secondSettlementHash.slice(0, 2));
    mkdirSync(secondSettlementDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(secondSettlementDirectory, `${secondSettlementHash}.json`), `${canonical({ ...secondSettlementBody, helperSettlementRef: secondSettlementRef, helperSettlementHash: secondSettlementHash })}\n`, { mode: 0o600 });
    const registryCurrentPath = path.join(registryRoot, "current-head.pair.json");
    const registryPredecessorBackup = `${registryCurrentPath}.predecessor-backup`;
    (globalThis as Record<string, unknown>).__p4RegistryCasSwap = () => { renameSync(registryCurrentPath, registryPredecessorBackup); writeFileSync(registryCurrentPath, "foreign-registry-head\n", { mode: 0o600 }); };
    await assert.rejects(isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation: secondRestartOperation }), /pinned predecessor changed/, "registry CAS refuses a foreign inode swapped after predecessor authentication");
    unlinkSync(registryCurrentPath); renameSync(registryPredecessorBackup, registryCurrentPath); Reflect.deleteProperty(globalThis, "__p4RegistryCasSwap");
    assert.deepEqual(await isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation: secondRestartOperation }), { helperSettlementRef: secondSettlementRef, helperSettlementHash: secondSettlementHash });
    const projectionReobservationsBeforeRetry = Number((globalThis as Record<string, unknown>).__p4ProjectionReobserveCount ?? 0);
    (globalThis as Record<string, unknown>).__p4PreparedProjectionMissing = true;
    assert.deepEqual(
      await isolated.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(lease, { restartOperation: secondRestartOperation }),
      { helperSettlementRef: secondSettlementRef, helperSettlementHash: secondSettlementHash },
      "response-loss retry adopts the authenticated terminal before reopening the pre-dispatch projection",
    );
    assert.equal((globalThis as Record<string, unknown>).__p4ProjectionReobserveCount, projectionReobservationsBeforeRetry);
    Reflect.deleteProperty(globalThis, "__p4PreparedProjectionMissing");
    const completedCensus = await isolated.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    assert.deepEqual([completedCensus.registeredBaselineHelperJournalCount, completedCensus.terminalBaselineHelperJournalCount, completedCensus.liveBaselineHelperJournalCount, completedCensus.ambiguousBaselineHelperJournalCount], [2, 2, 0, 1]);
    const completedHead = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryHeadV1({ headRef: completedCensus.helperJournalRegistryHeadRef, headHash: completedCensus.helperJournalRegistryHeadHash });
    const completedTerminal = await isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1({ terminalRef: completedHead.entryRef, terminalHash: completedHead.entryHash });
    assert.equal(completedTerminal.outcome, "completed");
    const currentHeadPath = path.join(registryRoot, "current-head.pair.json");
    const completedHeadPairBytes = readFileSync(currentHeadPath);
    writeFileSync(currentHeadPath, `${canonical({ headRef: registrationHead.headRef, headHash: registrationHead.headHash })}\n`, { mode: 0o600 });
    const registrationOnlyCensus = await isolated.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    assert.deepEqual(
      [registrationOnlyCensus.registeredBaselineHelperJournalCount, registrationOnlyCensus.terminalBaselineHelperJournalCount, registrationOnlyCensus.liveBaselineHelperJournalCount, registrationOnlyCensus.ambiguousBaselineHelperJournalCount],
      [1, 0, 1, 0],
      "registration-only authority is live and can never be observed as an empty helper census",
    );
    writeFileSync(currentHeadPath, completedHeadPairBytes, { mode: 0o600 });
    const registrationStore = path.join(registryRoot, "registrations/sha256");
    const crossedRegistrationCore = { schema: "setfarm.internal-production-baseline-service-restart-helper-registry-registration.v1", registryOrdinal: completedHead.registryOrdinal + 1, predecessorHeadRef: completedHead.headRef, predecessorHeadHash: completedHead.headHash, service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", authorizationRef: `setfarm://internal-production/baseline-service-restart-authorization/sha256/${"6".repeat(64)}`, authorizationHash: "6".repeat(64), operationRef: secondOperationRef, operationHash: secondOperationHash, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${"7".repeat(64)}`, outboxHash: "7".repeat(64) };
    const crossedRegistrationHash = sha256(canonical(crossedRegistrationCore));
    const crossedRegistrationRef = `setfarm://internal-production/baseline-service-restart-helper-registry-registration/sha256/${crossedRegistrationHash}`;
    const crossedRegistrationDirectory = path.join(registrationStore, crossedRegistrationHash.slice(0, 2));
    mkdirSync(crossedRegistrationDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(crossedRegistrationDirectory, `${crossedRegistrationHash}.json`), `${canonical({ ...crossedRegistrationCore, registrationRef: crossedRegistrationRef, registrationHash: crossedRegistrationHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1({ registrationRef: crossedRegistrationRef, registrationHash: crossedRegistrationHash }), /repeats a prior tuple member/);
    const foreignAuthorizationCore = { ...crossedRegistrationCore, authorizationRef: `setfarm://foreign/baseline-service-restart-authorization/sha256/${"6".repeat(64)}`, operationRef: `setfarm://internal-production/baseline-service-restart-operation/sha256/${"8".repeat(64)}`, operationHash: "8".repeat(64), outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${"9".repeat(64)}`, outboxHash: "9".repeat(64) };
    const foreignAuthorizationHash = sha256(canonical(foreignAuthorizationCore)); const foreignAuthorizationRef = `setfarm://internal-production/baseline-service-restart-helper-registry-registration/sha256/${foreignAuthorizationHash}`;
    const foreignAuthorizationDirectory = path.join(registrationStore, foreignAuthorizationHash.slice(0, 2)); mkdirSync(foreignAuthorizationDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(foreignAuthorizationDirectory, `${foreignAuthorizationHash}.json`), `${canonical({ ...foreignAuthorizationCore, registrationRef: foreignAuthorizationRef, registrationHash: foreignAuthorizationHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1({ registrationRef: foreignAuthorizationRef, registrationHash: foreignAuthorizationHash }), /registration is crossed/, "historical registry resolution rejects a self-consistent foreign authorization namespace");
    const gapRegistrationCore = { ...crossedRegistrationCore, registryOrdinal: completedHead.registryOrdinal + 2, authorizationRef: `setfarm://internal-production/baseline-service-restart-authorization/sha256/${"8".repeat(64)}`, authorizationHash: "8".repeat(64), operationRef: `setfarm://internal-production/baseline-service-restart-operation/sha256/${"9".repeat(64)}`, operationHash: "9".repeat(64), outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${"a".repeat(64)}`, outboxHash: "a".repeat(64) };
    const gapRegistrationHash = sha256(canonical(gapRegistrationCore));
    const gapRegistrationRef = `setfarm://internal-production/baseline-service-restart-helper-registry-registration/sha256/${gapRegistrationHash}`;
    const gapRegistrationDirectory = path.join(registrationStore, gapRegistrationHash.slice(0, 2));
    mkdirSync(gapRegistrationDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(gapRegistrationDirectory, `${gapRegistrationHash}.json`), `${canonical({ ...gapRegistrationCore, registrationRef: gapRegistrationRef, registrationHash: gapRegistrationHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryRegistrationV1({ registrationRef: gapRegistrationRef, registrationHash: gapRegistrationHash }), /predecessor is crossed/);
    const duplicateTerminalCore = { schema: "setfarm.internal-production-baseline-service-restart-helper-registry-terminal.v1", registryOrdinal: completedHead.registryOrdinal + 1, predecessorHeadRef: completedHead.headRef, predecessorHeadHash: completedHead.headHash, registrationRef: completedTerminal.registrationRef, registrationHash: completedTerminal.registrationHash, helperJournalHash: secondJournalHash, outcome: "ambiguous", helperSettlementRef: null, helperSettlementHash: null };
    const duplicateTerminalHash = sha256(canonical(duplicateTerminalCore));
    const duplicateTerminalRef = `setfarm://internal-production/baseline-service-restart-helper-registry-terminal/sha256/${duplicateTerminalHash}`;
    const duplicateTerminalDirectory = path.join(registryRoot, "terminals/sha256", duplicateTerminalHash.slice(0, 2));
    mkdirSync(duplicateTerminalDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(duplicateTerminalDirectory, `${duplicateTerminalHash}.json`), `${canonical({ ...duplicateTerminalCore, terminalRef: duplicateTerminalRef, terminalHash: duplicateTerminalHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.resolveInternalProductionBaselineServiceRestartHelperRegistryTerminalV1({ terminalRef: duplicateTerminalRef, terminalHash: duplicateTerminalHash }), /already has a terminal/);
    await isolated.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    const registryInventory = (): ReadonlyArray<string> => {
      const visit = (directory: string): Array<string> => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const member = path.join(directory, entry.name);
        return entry.isDirectory() ? visit(member) : [`${path.relative(registryRoot, member)}:${sha256(readFileSync(member, "utf8"))}`];
      });
      return visit(registryRoot).sort();
    };
    const inventoryBeforeCaps = registryInventory();
    const thirdAuthorizationHash = "b".repeat(64);
    const thirdAuthorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${thirdAuthorizationHash}`;
    const thirdOperationBody = { ...operationBody, authorizationRef: thirdAuthorizationRef, authorizationHash: thirdAuthorizationHash };
    const thirdOperationHash = sha256(canonical(thirdOperationBody));
    const thirdOperationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${thirdOperationHash}`;
    const thirdRestartOperation = { operationRef: thirdOperationRef, operationHash: thirdOperationHash };
    (globalThis as Record<string, unknown>).__p4BaselineOperation = recursivelyFreeze({ ...thirdOperationBody, operationRef: thirdOperationRef, operationHash: thirdOperationHash });
    const thirdOutboxBody = { ...outboxBody, authorizationRef: thirdAuthorizationRef, authorizationHash: thirdAuthorizationHash, operationRef: thirdOperationRef, operationHash: thirdOperationHash };
    const thirdOutboxHash = sha256(canonical(thirdOutboxBody));
    (globalThis as Record<string, unknown>).__p4BaselineOutbox = recursivelyFreeze({ ...thirdOutboxBody, outboxRef: `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${thirdOutboxHash}`, outboxHash: thirdOutboxHash });
    const internal = path.join(fixture, "src/internal-production");
    const registrationCapSource = readFileSync(sourcePath, "utf8").replace("MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1 = 10_000", "MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRATIONS_V1 = 2");
    const registrationCapPath = path.join(internal, "baseline-restart-authority-retirement-registration-cap-v1.ts");
    writeFileSync(registrationCapPath, registrationCapSource);
    const registrationCapModule = await import(`${pathToFileURL(registrationCapPath).href}?registration-cap=${Date.now()}`);
    assert.equal((await registrationCapModule.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1()).registeredBaselineHelperJournalCount, 2);
    const registrationCapLease = await registrationCapModule.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await assert.rejects(registrationCapModule.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(registrationCapLease, { restartOperation: thirdRestartOperation }), /registration cap is exceeded/);
    await registrationCapModule.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(registrationCapLease);
    assert.deepEqual(registryInventory(), inventoryBeforeCaps, "registration-cap refusal precedes every registry entry/head/current mutation");
    const headCapSource = readFileSync(sourcePath, "utf8").replace("MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1 = 20_000", "MAX_INTERNAL_PRODUCTION_BASELINE_SERVICE_RESTART_HELPER_REGISTRY_HEAD_ENTRIES_V1 = 4");
    const headCapPath = path.join(internal, "baseline-restart-authority-retirement-head-cap-v1.ts");
    writeFileSync(headCapPath, headCapSource);
    const headCapModule = await import(`${pathToFileURL(headCapPath).href}?head-cap=${Date.now()}`);
    assert.equal((await headCapModule.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1()).registeredBaselineHelperJournalCount, 2);
    const headCapLease = await headCapModule.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
    await assert.rejects(headCapModule.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1(headCapLease, { restartOperation: thirdRestartOperation }), /head cap is exceeded|tip exceeds its fixed head budget/);
    await headCapModule.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(headCapLease);
    assert.deepEqual(registryInventory(), inventoryBeforeCaps, "head-cap refusal precedes every registry entry/head/current mutation");
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(fixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, completedCensus.censusHash);
    const ambiguousGuard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: ambiguousGuard.zeroOwnerGuardRef!, zeroOwnerGuardHash: ambiguousGuard.zeroOwnerGuardHash! }), /helper journal census.*(?:stale|nonterminal)|terminal and unambiguous/);
    assert.equal(existsSync(path.join(root, "cutover-to-recovery-d-v1/cutover-pending-input.json")), false, "ambiguous helper census refuses before cutover pending bytes");
  } finally {
    Reflect.deleteProperty(globalThis, "__p4BaselineOperation");
    Reflect.deleteProperty(globalThis, "__p4BaselineOutbox");
    for (const key of ["__p4ServiceCensus", "__p4CutoverReadiness", "__p4CutoverGate", "__p4CompleteZero", "__p4CutoverGuard"]) Reflect.deleteProperty(globalThis, key);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 cutover refuses an absent complete code-owned readiness tuple before mutation", async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-cutover-readiness-absent-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, readFileSync(sourcePath, "utf8"));
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-readiness=${Date.now()}`);
    const zeroOwnerGuardHash = "8".repeat(64);
    await assert.rejects(
      isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: `setfarm://internal-production/baseline-zero-owner-mutation-guard/sha256/${zeroOwnerGuardHash}`, zeroOwnerGuardHash }),
      /complete code-owned cutover readiness.*unavailable/i,
    );
    assert.equal(existsSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1/cutover-pending-input.json")), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 restart authority cutover is one-way", async () => {
  const module = await import(`../../src/internal-production/baseline-restart-authority-retirement-v1.js?p4-cutover=${Date.now()}`);
  assert.equal(typeof module.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1, "function");
  assert.equal(module.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1.length, 2);
  assert.equal(typeof module.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1, "function");
  assert.equal(module.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1.length, 1);
  assert.equal(typeof module.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1, "function");
  assert.equal(module.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1.length, 0);
  assert.equal(typeof module.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1, "function");
  assert.equal(module.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1.length, 0);

  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /authorityOwner:\s*"recovery-d"/);
  assert.match(source, /BASELINE_RESTART_AUTHORITY_RETIRED/);
  assert.match(source, /baseline-service-restart-helper-settlement\/sha256\//);

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-cutover-"));
  try {
    const fixtureModulePath = installRetirementFixture(fixture, source);
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(fixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    const emptyHelperCensus = seedPreSchemaHelperClosure(fixture);
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, emptyHelperCensus.censusHash as string);
    (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover=${Date.now()}`);
    const retirementRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const completedHistory = seedCompletedSequenceHistory(fixture, "documentation-rollback", (globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    const zeroOwnerGuardHash = guard.zeroOwnerGuardHash!;
    const zeroOwnerGuardRef = guard.zeroOwnerGuardRef!;
    (globalThis as Record<string, unknown>).__p4ReadinessObservations = 0;
    (globalThis as Record<string, unknown>).__p4ReadinessDriftUnderLease = true;
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /readiness changed before pending mutation/, "readiness must be byte-identical when freshly reobserved under the transition lease");
    assert.equal(existsSync(path.join(retirementRoot, "cutover-to-recovery-d-v1/cutover-pending-input.json")), false, "under-lease readiness drift leaves zero pending bytes");
    Reflect.deleteProperty(globalThis, "__p4ReadinessDriftUnderLease");
    (globalThis as Record<string, unknown>).__p4ReadinessObservations = 0;
    const sequenceRoot = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-sequence-v1");
    const readiness = (globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>;
    const forgedIntentKind = "d-startup-hook-load";
    const forgedIntentDirectory = path.join(sequenceRoot, "intents", sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind: forgedIntentKind })));
    seedCompletedSequenceHistory(fixture, forgedIntentKind, readiness, "f".repeat(64));
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /advance 0 semantics are crossed/, "a self-consistent rehashed chain cannot cross pair0.before with the initial runtime projection");
    rmSync(forgedIntentDirectory, { recursive: true, force: true });
    seedCompletedSequenceHistory(fixture, forgedIntentKind, readiness, undefined, "not-a-sha256");
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /terminal sequence semantics are crossed/, "terminal retained history requires a SHA-256 final complete-zero census hash");
    rmSync(forgedIntentDirectory, { recursive: true, force: true });
    assert.equal(existsSync(path.join(retirementRoot, "cutover-to-recovery-d-v1/cutover-pending-input.json")), false, "forged retained history refuses before cutover pending bytes");
    const intentKind = "live-rebind";
    const intentDirectoryHash = sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
    const sequenceIntentBody = { schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind, migrationReceiptRef: readiness.migrationReceiptRef, migrationReceiptHash: readiness.migrationReceiptHash, migrationSchemaProjectionHash: readiness.schemaProjectionHash, initialRuntimeSourceProjectionHash: readiness.runtimeSourceProjectionHash, orderedServiceActions: [{ service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1" }, { service: "setfarm-dashboard", actionId: "a-restart-service-setfarm-dashboard-v1" }, { service: "mission-control", actionId: "a-restart-service-mission-control-v1" }] };
    const sequenceIntentHash = sha256(canonical(sequenceIntentBody));
    const sequenceIntentRef = `setfarm://internal-production/baseline-restart-sequence-intent/sha256/${sequenceIntentHash}`;
    const intentDirectory = path.join(sequenceRoot, "intents", intentDirectoryHash);
    mkdirSync(intentDirectory, { recursive: true, mode: 0o700 });
    const sequenceIntentStore = path.join(sequenceRoot, "sequence-intents/sha256", sequenceIntentHash.slice(0, 2));
    mkdirSync(sequenceIntentStore, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(sequenceIntentStore, `${sequenceIntentHash}.json`), `${canonical({ ...sequenceIntentBody, sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
    writeFileSync(path.join(intentDirectory, "sequence-intent.pair.json"), `${canonical({ sequenceIntentRef, sequenceIntentHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /normal restart authority set is not empty/, "sequence-wins must block cutover before pending birth");
    assert.equal(existsSync(path.join(retirementRoot, "cutover-to-recovery-d-v1/cutover-pending-input.json")), false, "sequence-wins leaves zero cutover pending bytes");
    assert.equal(existsSync(path.join(retirementRoot, "cutover-to-recovery-d-v1/00-owner-admission-fence.pair.json")), false, "sequence-wins acquires no owner fence");
    const headerContentPath = path.join(sequenceIntentStore, `${sequenceIntentHash}.json`);
    const exactHeaderContent = readFileSync(headerContentPath);
    unlinkSync(headerContentPath);
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /ENOENT/, "missing named sequence content refuses before cutover mutation");
    writeFileSync(headerContentPath, exactHeaderContent, { mode: 0o600 });
    writeFileSync(headerContentPath, Buffer.from(exactHeaderContent.toString("utf8").replace("live-rebind", "documentation-rollback")), { mode: 0o600 });
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /content is crossed|semantics are crossed/, "tampered named sequence content refuses before cutover mutation");
    writeFileSync(headerContentPath, exactHeaderContent, { mode: 0o600 });
    const headerLocatorPath = path.join(intentDirectory, "sequence-intent.pair.json");
    const exactHeaderLocator = readFileSync(headerLocatorPath);
    const crossedHeaderHash = "f".repeat(64);
    writeFileSync(headerLocatorPath, `${canonical({ sequenceIntentRef: `setfarm://internal-production/baseline-restart-sequence-intent/sha256/${crossedHeaderHash}`, sequenceIntentHash: crossedHeaderHash })}\n`, { mode: 0o600 });
    await assert.rejects(isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), /ENOENT/, "crossed fixed sequence locator refuses before cutover mutation");
    writeFileSync(headerLocatorPath, exactHeaderLocator, { mode: 0o600 });
    rmSync(intentDirectory, { recursive: true, force: true });
    const operation = await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash });
    assert.deepEqual(Reflect.ownKeys(operation), ["operationRef", "operationHash"]);
    const resolvedOperation = await isolated.resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1(operation);
    assert.deepEqual(Reflect.ownKeys(resolvedOperation), ["schema", "pendingInputRef", "pendingInputHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "predecessorPhysicalRestartEpochRef", "predecessorPhysicalRestartEpochHash", "predecessorPhysicalRestartEpochOrdinal", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "codeOwnedHookObservationHash", "operationRef", "operationHash"]);
    assert.equal(resolvedOperation.zeroOwnerGuardRef, zeroOwnerGuardRef);
    assert.equal(resolvedOperation.zeroOwnerGuardHash, zeroOwnerGuardHash);
    const pendingLocatorPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1/cutover-pending-input.json");
    const linkedRecoveryTemporary = path.join(path.dirname(pendingLocatorPath), `.${path.basename(pendingLocatorPath)}.${"a".repeat(32)}.tmp`);
    linkSync(pendingLocatorPath, linkedRecoveryTemporary);
    assert.deepEqual(await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), operation, "linked final+temp crash state must recover byte-identically");
    assert.equal(existsSync(linkedRecoveryTemporary), false);
    const collisionRecoveryTemporary = path.join(path.dirname(pendingLocatorPath), `.${path.basename(pendingLocatorPath)}.${"b".repeat(32)}.tmp`);
    writeFileSync(collisionRecoveryTemporary, readFileSync(pendingLocatorPath), { mode: 0o600 });
    assert.deepEqual(await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash }), operation, "EEXIST collision final+temp crash state must recover byte-identically");
    assert.equal(existsSync(collisionRecoveryTemporary), false);
    const pendingStatus = await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1();
    assert.deepEqual(Reflect.ownKeys(pendingStatus), ["schema", "state", "pendingInputRef", "pendingInputHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "ownerAdmissionFenceReleaseRef", "ownerAdmissionFenceReleaseHash", "operationRef", "operationHash", "guardConsumed", "physicalRestartEpochOrdinal", "physicalRestartAuthorityOwner", "startupHooksReadyRef", "startupHooksReadyHash", "baselineRetirementRef", "baselineRetirementHash", "activationRef", "activationHash", "cutoverRef", "cutoverHash", "statusHash"]);
    assert.equal(pendingStatus.state, "prepared");
    assert.equal(pendingStatus.guardConsumed, false);
    (globalThis as Record<string, unknown>).__p4ReadinessDriftAfterConsumption = true;
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /readiness.*changed/i, "fresh exact10/exact27 readiness drift must prevent the epoch CAS");
    assert.equal(JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8")).epochOrdinal, 1, "readiness drift must leave A epoch one visible");
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "readiness drift must preserve the sole guard CAS");
    Reflect.deleteProperty(globalThis, "__p4ReadinessDriftAfterConsumption");
    (globalThis as Record<string, unknown>).__p4HelperCensusDriftAfterConsumption = true;
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /helper journal census authority changed|normal restart authority set changed/i, "a fresh terminal and unambiguous helper census hash drift must prevent epoch CAS");
    assert.equal(JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8")).epochOrdinal, 1);
    Reflect.deleteProperty(globalThis, "__p4HelperCensusDriftAfterConsumption");
    (globalThis as Record<string, unknown>).__p4FenceDriftAfterConsumption = true;
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /fence.*(?:changed|invalid|crossed)/i, "fence identity drift after guard consumption must prevent the epoch CAS");
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "post-consumption fence drift must preserve the sole guard CAS");
    assert.equal(JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8")).epochOrdinal, 1, "fence drift must leave A epoch one visible");
    Reflect.deleteProperty(globalThis, "__p4FenceDriftAfterConsumption");
    const epochHeadPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json");
    const epochPredecessorBackup = `${epochHeadPath}.predecessor-backup`;
    (globalThis as Record<string, unknown>).__p4EpochCasSwap = () => { renameSync(epochHeadPath, epochPredecessorBackup); writeFileSync(epochHeadPath, "foreign-epoch-head\n", { mode: 0o600 }); };
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /pinned predecessor changed/, "epoch visibility CAS refuses a foreign inode swapped after predecessor authentication");
    unlinkSync(epochHeadPath); renameSync(epochPredecessorBackup, epochHeadPath); Reflect.deleteProperty(globalThis, "__p4EpochCasSwap");
    assert.equal(JSON.parse(readFileSync(epochHeadPath, "utf8")).epochOrdinal, 1, "epoch path-swap refusal preserves the exact predecessor after fixture restoration");
    const completed = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
    assert.deepEqual(await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), completed);
    const terminalStatus = await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1();
    assert.equal(terminalStatus.state, "recovery-d-active");
    assert.equal(terminalStatus.guardConsumed, true);
    assert.equal(typeof terminalStatus.ownerAdmissionFenceReleaseRef, "string");
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "terminal replay must not consume the guard twice");
    const retirement = await isolated.resolveInternalProductionBaselineRestartAuthorityRetirementV1({ retirementRef: completed.retirementRef, retirementHash: completed.retirementHash });
    assert.deepEqual(Object.keys(retirement), ["activeBaselineSequenceCount", "completeZeroOwnerCensusHash", "disposition", "liveBaselineHelperCount", "liveBaselineRestartCount", "pendingBaselineRestartCount", "predecessorEpochHash", "predecessorEpochRef", "retainedHistoricalAuthoritySetHash", "retirementHash", "retirementRef", "schema", "services", "startupHooksReadyHash", "startupHooksReadyRef", "successorActivationHash", "successorActivationRef", "successorAuthorityOwner", "successorEpochOrdinal", "zeroOwnerGuardConsumptionHash", "zeroOwnerGuardConsumptionRef", "zeroOwnerGuardHash", "zeroOwnerGuardRef"].sort());
    assert.equal(retirement.zeroOwnerGuardConsumptionRef.endsWith(retirement.zeroOwnerGuardConsumptionHash), true);
    assert.equal(retirement.retainedHistoricalAuthoritySetHash, sha256(canonical({ completedSequences: [completedHistory], retainedHelperJournalSettlementSetHash: emptyHelperCensus.retainedHelperJournalSettlementSetHash })), "retirement binds the exact three-domain terminal sequence history and helper settlement authority set");
    const cutover = await isolated.resolveInternalProductionServiceRestartAuthorityCutoverV1({ cutoverRef: completed.cutoverRef, cutoverHash: completed.cutoverHash });
    assert.equal(cutover.zeroOwnerGuardConsumptionRef, retirement.zeroOwnerGuardConsumptionRef);
    assert.equal(cutover.zeroOwnerGuardConsumptionHash, retirement.zeroOwnerGuardConsumptionHash);
    const head = JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/epoch-head.json"), "utf8"));
    assert.equal(head.epochOrdinal, 2);
    assert.equal(head.authorityOwner, "recovery-d");
    assert.equal(head.predecessorEpochRef.endsWith(head.predecessorEpochHash), true);
    await assert.rejects(isolated.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(), /BASELINE_RESTART_AUTHORITY_RETIRED/);
  } finally {
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    delete (globalThis as Record<string, unknown>).__p4CutoverReadiness;
    delete (globalThis as Record<string, unknown>).__p4CutoverGate;
    delete (globalThis as Record<string, unknown>).__p4CompleteZero;
    delete (globalThis as Record<string, unknown>).__p4CutoverGuard;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumption;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumeCalls;
    delete (globalThis as Record<string, unknown>).__p4OwnerFenceReobservations;
    delete (globalThis as Record<string, unknown>).__p4OwnerFence;
    delete (globalThis as Record<string, unknown>).__p4FenceRelease;
    delete (globalThis as Record<string, unknown>).__p4FenceDriftAfterConsumption;
    delete (globalThis as Record<string, unknown>).__p4ReadinessDriftAfterConsumption;
    delete (globalThis as Record<string, unknown>).__p4ReadinessDriftUnderLease;
    delete (globalThis as Record<string, unknown>).__p4ReadinessObservations;
    delete (globalThis as Record<string, unknown>).__p4EpochCasSwap;
    delete (globalThis as Record<string, unknown>).__p4HelperCensusDriftAfterConsumption;
    delete (globalThis as Record<string, unknown>).__p4BaselineOperation;
    delete (globalThis as Record<string, unknown>).__p4BaselineOutbox;
    rmSync(fixture, { recursive: true, force: true });
  }

  const crashFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-cutover-crash-"));
  try {
    const injected = source.replace(
      "    replaceEpochHeadV1(successorEpoch);",
      "    const cutoverCrashHook = Reflect.get(globalThis, '__p4CutoverBeforeEpochReplace');\n    if (typeof cutoverCrashHook === 'function') cutoverCrashHook();\n    replaceEpochHeadV1(successorEpoch);",
    );
    assert.notEqual(injected, source, "cutover crash fixture must inject at the exact epoch CAS boundary");
    const fixtureModulePath = installRetirementFixture(crashFixture, injected);
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(crashFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    const helperCensus = seedPreSchemaHelperClosure(crashFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, helperCensus.censusHash as string);
    (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-crash=${Date.now()}`);
    const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    const zeroOwnerGuardHash = guard.zeroOwnerGuardHash!;
    const zeroOwnerGuardRef = guard.zeroOwnerGuardRef!;
    await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef, zeroOwnerGuardHash });
    Reflect.set(globalThis, "__p4CutoverBeforeEpochReplace", () => { throw new Error("CUTOVER_BEFORE_EPOCH_REPLACE"); });
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /CUTOVER_BEFORE_EPOCH_REPLACE/);
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "resuming");
    const preCasRoot = path.join(crashFixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1");
    const storedPreCasRetirement = JSON.parse(readFileSync(path.join(preCasRoot, "04-retirement.pair.json"), "utf8"));
    const storedPreCasActivation = JSON.parse(readFileSync(path.join(preCasRoot, "05-activation.pair.json"), "utf8"));
    const storedPreCasCutover = JSON.parse(readFileSync(path.join(preCasRoot, "07-cutover.pair.json"), "utf8"));
    const preCasRetirement = { retirementRef: storedPreCasRetirement.retirementRef, retirementHash: storedPreCasRetirement.retirementHash };
    const preCasActivation = { activationRef: storedPreCasActivation.activationRef, activationHash: storedPreCasActivation.activationHash };
    const preCasCutover = { cutoverRef: storedPreCasCutover.cutoverRef, cutoverHash: storedPreCasCutover.cutoverHash };
    await assert.rejects(isolated.resolveInternalProductionBaselineRestartAuthorityRetirementV1(preCasRetirement), /terminal|epoch/i, "pre-CAS retirement candidate must remain invisible");
    await assert.rejects(isolated.resolveInternalProductionServiceRestartAuthorityActivationV1(preCasActivation), /terminal|epoch/i, "pre-CAS activation candidate must remain invisible");
    await assert.rejects(isolated.resolveInternalProductionServiceRestartAuthorityCutoverV1(preCasCutover), /terminal|epoch/i, "pre-CAS cutover candidate must remain invisible");
    Reflect.deleteProperty(globalThis, "__p4CutoverBeforeEpochReplace");
    const recovered = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "recovery-d-active");
    assert.equal(recovered.successorEpochRef.endsWith(recovered.successorEpochHash), true);
  } finally {
    Reflect.deleteProperty(globalThis, "__p4CutoverBeforeEpochReplace");
    delete (globalThis as Record<string, unknown>).__p4ServiceCensus;
    delete (globalThis as Record<string, unknown>).__p4CutoverReadiness;
    delete (globalThis as Record<string, unknown>).__p4CutoverGate;
    delete (globalThis as Record<string, unknown>).__p4CompleteZero;
    delete (globalThis as Record<string, unknown>).__p4CutoverGuard;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumption;
    delete (globalThis as Record<string, unknown>).__p4GuardConsumeCalls;
    delete (globalThis as Record<string, unknown>).__p4OwnerFenceReobservations;
    delete (globalThis as Record<string, unknown>).__p4OwnerFence;
    delete (globalThis as Record<string, unknown>).__p4FenceRelease;
    rmSync(crashFixture, { recursive: true, force: true });
  }

  const postCasFixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-retirement-cutover-post-cas-crash-"));
  try {
    const injected = source.replace(
      "    replaceEpochHeadV1(successorEpoch);",
      "    replaceEpochHeadV1(successorEpoch);\n    const cutoverAfterCasHook = Reflect.get(globalThis, '__p4CutoverAfterEpochReplace');\n    if (typeof cutoverAfterCasHook === 'function') cutoverAfterCasHook();",
    );
    assert.notEqual(injected, source, "post-CAS cutover crash fixture must inject after the exact epoch CAS boundary");
    const fixtureModulePath = installRetirementFixture(postCasFixture, injected);
    (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
    (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(postCasFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
    (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
    const helperCensus = seedPreSchemaHelperClosure(postCasFixture);
    (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, helperCensus.censusHash as string);
    (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
    const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-post-cas=${Date.now()}`);
    const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
    await isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: guard.zeroOwnerGuardRef!, zeroOwnerGuardHash: guard.zeroOwnerGuardHash! });
    Reflect.set(globalThis, "__p4CutoverAfterEpochReplace", () => { throw new Error("CUTOVER_AFTER_EPOCH_REPLACE"); });
    await assert.rejects(isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1(), /CUTOVER_AFTER_EPOCH_REPLACE/);
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "resuming");
    const postCasRoot = path.join(postCasFixture, "data/internal-production-baseline/restart-authority-retirement-v1/cutover-to-recovery-d-v1");
    const storedPostCasCutover = JSON.parse(readFileSync(path.join(postCasRoot, "07-cutover.pair.json"), "utf8"));
    const postCasCutover = { cutoverRef: storedPostCasCutover.cutoverRef, cutoverHash: storedPostCasCutover.cutoverHash };
    await assert.rejects(isolated.resolveInternalProductionServiceRestartAuthorityCutoverV1(postCasCutover), /terminal|release/i, "post-CAS cutover candidate must remain invisible until fence release");
    Reflect.deleteProperty(globalThis, "__p4CutoverAfterEpochReplace");
    const recovered = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
    assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "recovery-d-active");
    assert.equal(recovered.cutoverRef.endsWith(recovered.cutoverHash), true);
    assert.equal((globalThis as Record<string, unknown>).__p4GuardConsumeCalls, 1, "post-CAS recovery must not consume the guard twice");
  } finally {
    Reflect.deleteProperty(globalThis, "__p4CutoverAfterEpochReplace");
    for (const key of ["__p4ServiceCensus", "__p4CutoverReadiness", "__p4CutoverGate", "__p4CompleteZero", "__p4CutoverGuard", "__p4GuardConsumption", "__p4GuardConsumeCalls", "__p4OwnerFenceReobservations", "__p4OwnerFence", "__p4FenceRelease"]) Reflect.deleteProperty(globalThis, key);
    rmSync(postCasFixture, { recursive: true, force: true });
  }
});

test("P4 cutover resumes pending-only and fence-only crash prefixes", async () => {
  const original = readFileSync(sourcePath, "utf8");
  const crashes = [
    [
      "pending-only",
      "    const pending = publishPendingInputV1(guard);",
      "    const pending = publishPendingInputV1(guard);\n    if (!Reflect.get(globalThis, '__p4PendingOnlyCrash')) { Reflect.set(globalThis, '__p4PendingOnlyCrash', true); throw new Error('P4_PENDING_ONLY_CRASH'); }",
    ],
    [
      "fence-only",
      "      writeNoReplace(cutoverLocatorV1(\"00-owner-admission-fence\"), fencePair);",
      "      writeNoReplace(cutoverLocatorV1(\"00-owner-admission-fence\"), fencePair);\n      if (!Reflect.get(globalThis, '__p4FenceOnlyCrash')) { Reflect.set(globalThis, '__p4FenceOnlyCrash', true); throw new Error('P4_FENCE_ONLY_CRASH'); }",
    ],
  ] as const;
  for (const [name, needle, replacement] of crashes) {
    const fixture = mkdtempSync(path.join(tmpdir(), `setfarm-p4-cutover-${name}-`));
    try {
      assert.equal(original.includes(needle), true, `${name} injection target exists`);
      const fixtureModulePath = installRetirementFixture(fixture, original.replace(needle, replacement));
      (globalThis as Record<string, unknown>).__p4ServiceCensus = Object.freeze({ censusHash: "9".repeat(64) });
      (globalThis as Record<string, unknown>).__p4CutoverReadiness = cutoverReadinessFixture(fixture);
      (globalThis as Record<string, unknown>).__p4CutoverGate = cutoverGateFixture((globalThis as Record<string, unknown>).__p4CutoverReadiness as Readonly<Record<string, unknown>>);
      (globalThis as Record<string, unknown>).__p4CompleteZero = completeZeroFixture();
      const helperCensus = seedPreSchemaHelperClosure(fixture);
      (globalThis as Record<string, unknown>).__p4CutoverGuard = cutoverGuardFixture((globalThis as Record<string, unknown>).__p4CompleteZero as Readonly<Record<string, unknown>>, helperCensus.censusHash as string);
      (globalThis as Record<string, unknown>).__p4GuardConsumeCalls = 0;
      const isolated = await import(`${pathToFileURL(fixtureModulePath).href}?cutover-prefix=${name}-${Date.now()}`);
      const guard = (globalThis as Record<string, unknown>).__p4CutoverGuard as Readonly<Record<string, string>>;
      await assert.rejects(
        isolated.prepareInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1({ zeroOwnerGuardRef: guard.zeroOwnerGuardRef, zeroOwnerGuardHash: guard.zeroOwnerGuardHash }),
        new RegExp(`P4_${name.replace("-", "_").toUpperCase()}_CRASH`),
      );
      const recovered = await isolated.resumeActiveInternalProductionPhysicalServiceRestartAuthorityCutoverToRecoveryDV1();
      assert.equal(recovered.cutoverRef.endsWith(recovered.cutoverHash), true, `${name} prefix reaches the one terminal cutover`);
      assert.equal((await isolated.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1()).state, "recovery-d-active");
    } finally {
      for (const key of ["__p4ServiceCensus", "__p4CutoverReadiness", "__p4CutoverGate", "__p4CompleteZero", "__p4CutoverGuard", "__p4GuardConsumption", "__p4GuardConsumeCalls", "__p4OwnerFenceReobservations", "__p4OwnerFence", "__p4FenceRelease", "__p4PendingOnlyCrash", "__p4FenceOnlyCrash"]) Reflect.deleteProperty(globalThis, key);
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});
