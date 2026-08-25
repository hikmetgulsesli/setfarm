import assert from "node:assert/strict";
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
