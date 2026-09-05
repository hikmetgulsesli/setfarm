import assert from "node:assert/strict";
import { cpSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  RunProtocolError,
  createRunProtocolRepository,
  extractProtocolArgument,
  resolveNewRunProtocol,
} from "../../src/execution/run-protocol.js";
import {
  type PersistWorkflowRunInputV1,
} from "../../src/execution/run-persistence.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const PREFLIGHT_HASH = "b".repeat(64);
const PASS_PREFLIGHT = {
  status: "pass" as const,
  hash: PREFLIGHT_HASH,
  stored: true,
};
const RELEASE_ADMISSION_HASH = "c".repeat(64);
const RELEASE_GO_ADMISSION = {
  admissionHash: RELEASE_ADMISSION_HASH,
  kind: "release_go" as const,
  releaseSha: RELEASE_SHA,
  canary: null,
};

it("P4 readiness loader permits only declared extras", async () => {
  const dbSource = readFileSync(path.resolve(import.meta.dirname, "../../src/db-pg.ts"), "utf8");
  assert.doesNotMatch(dbSource, /^export function validateInternalProductionRunPersistenceReadinessModuleNamespaceV1/m);
  const fixture = await mkdtemp(path.join(tmpdir(), "setfarm-p4-private-readiness-loader-"));
  cpSync(path.resolve(import.meta.dirname, "../../src"), path.join(fixture, "src"), { recursive: true });
  symlinkSync(path.resolve(import.meta.dirname, "../../node_modules"), path.join(fixture, "node_modules"), "dir");
  const fixtureDb = path.join(fixture, "src/db-pg.ts");
  writeFileSync(fixtureDb, dbSource.replace("function validateInternalProductionRunPersistenceReadinessModuleNamespaceV1(", "export function validateInternalProductionRunPersistenceReadinessModuleNamespaceV1("));
  const { validateInternalProductionRunPersistenceReadinessModuleNamespaceV1 } = await import(`${pathToFileURL(fixtureDb).href}?private-loader=${Date.now()}`);
  const calls: string[] = [];
  const observe = async () => { calls.push("observe"); return Object.freeze({ pair: true }); };
  const resolve = async (_pair: unknown) => { calls.push("resolve"); return Object.freeze({ ready: true }); };
  const extra = () => { calls.push("extra"); };
  const required = {
    observeInternalProductionPreSchemaSpawnerRebindStatusV1: observe,
    resolveInternalProductionTask0SpawnerAdmissionReadyV1: resolve,
  };
  const declaredExtras = [
    "prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1",
    "executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1",
    "resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1",
    "resolveInternalProductionPreSchemaSpawnerRebindStatusV1",
    "resolveInternalProductionPreSchemaSpawnerStartupTokenV1",
    "resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1",
    "resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1",
    "resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1",
    "resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1",
  ];
  for (let mask = 0; mask < 1 << declaredExtras.length; mask += 1) {
    const candidate: Record<string, unknown> = { ...required };
    declaredExtras.forEach((name, index) => { if ((mask & (1 << index)) !== 0) candidate[name] = extra; });
    const loaded = validateInternalProductionRunPersistenceReadinessModuleNamespaceV1(candidate);
    const pair = await loaded.observeInternalProductionPreSchemaSpawnerRebindStatusV1();
    await loaded.resolveInternalProductionTask0SpawnerAdmissionReadyV1(pair);
  }
  assert.equal(calls.filter((call) => call === "extra").length, 0);
  assert.deepEqual(calls.slice(0, 2), ["observe", "resolve"]);

  const refuses = (candidate: unknown) => assert.throws(
    () => validateInternalProductionRunPersistenceReadinessModuleNamespaceV1(candidate),
    /RUN_PERSISTENCE_READINESS_MODULE_NAMESPACE_INVALID/,
  );
  refuses({ ...required, unknown: extra });
  const { observeInternalProductionPreSchemaSpawnerRebindStatusV1: _missingObserve, ...withoutObserve } = required;
  const { resolveInternalProductionTask0SpawnerAdmissionReadyV1: _missingResolve, ...withoutResolve } = required;
  refuses(withoutObserve);
  refuses(withoutResolve);
  refuses({ ...required, observeInternalProductionPreSchemaSpawnerRebindStatusV1: "not-a-function" });
  refuses({ ...required, resolveInternalProductionTask0SpawnerAdmissionReadyV1: "not-a-function" });
  refuses({ ...required, observeInternalProductionPreSchemaSpawnerRebindStatusV1: async (_unexpected: unknown) => null });
  refuses({ ...required, resolveInternalProductionTask0SpawnerAdmissionReadyV1: async () => null });
  const accessor = { ...required };
  Object.defineProperty(accessor, "prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1", { enumerable: true, get: () => extra });
  refuses(accessor);
  const hidden = { ...required };
  Object.defineProperty(hidden, "prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1", { enumerable: false, value: extra });
  refuses(hidden);
  refuses(Object.assign({ ...required }, { [Symbol("foreign")]: true }));
  await rm(fixture, { recursive: true, force: true });
});

it("P4 recovery source bootstrap protocol ports reject caller authority before database access", async () => {
  const database = await import("../../src/db-pg.js");
  const protocol = Reflect.get(database, "resolveCurrentInternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1");
  const lock = Reflect.get(database, "lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1");
  const bind = Reflect.get(database, "bindInternalProductionRecoverySourceBootstrapRunInTransactionV1");
  assert.equal(typeof protocol, "function");
  assert.equal((protocol as Function).length, 0);
  assert.equal(typeof lock, "function");
  assert.equal((lock as Function).length, 2);
  assert.equal(typeof bind, "function");
  assert.equal((bind as Function).length, 2);
  await assert.rejects(
    () => (protocol as (input: unknown) => Promise<unknown>)({ callerAuthority: true }),
    /RECOVERY_SOURCE_BOOTSTRAP_PROTOCOL_INPUT_FORBIDDEN/,
  );
  await assert.rejects(
    () => (lock as (sql: unknown, input: unknown) => Promise<unknown>)({ unsafe: () => assert.fail("database accessed") }, { operationRef: "caller-only" }),
    /RECOVERY_SOURCE_BOOTSTRAP_RUN_INSERTION_INPUT_INVALID/,
  );
  await assert.rejects(
    () => (bind as (sql: unknown, input: unknown) => Promise<unknown>)({ unsafe: () => assert.fail("database accessed") }, { operationRef: "caller-only" }),
    /RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_INPUT_INVALID/,
  );
});

it("P4 recovery source bootstrap uses dedicated persistence and dispatch ports", async () => {
  const persistence = await import("../../src/execution/run-persistence.js");
  const installer = await import("../../src/installer/run.js");
  const persistSpecial = Reflect.get(persistence, "persistInternalProductionRecoverySourceBootstrapRunV1");
  const persistSpecialForAuthority = Reflect.get(persistence, "persistInternalProductionRecoverySourceBootstrapRunForAuthorityV1");
  const installerObservePersistedSpecial = Reflect.get(installer, "observePersistedInternalProductionRecoverySourceBootstrapRunV1");
  const dispatchSpecial = Reflect.get(installer, "dispatchInternalProductionRecoverySourceBootstrapRunV1");
  const dispatchSpecialForAuthority = Reflect.get(installer, "dispatchInternalProductionRecoverySourceBootstrapRunForAuthorityV1");
  assert.equal(typeof persistSpecial, "function");
  assert.equal((persistSpecial as Function).length, 1);
  assert.equal(typeof persistSpecialForAuthority, "function");
  assert.equal((persistSpecialForAuthority as Function).length, 1);
  assert.equal(typeof installerObservePersistedSpecial, "function");
  assert.equal((installerObservePersistedSpecial as Function).length, 1);
  assert.equal(typeof dispatchSpecial, "function");
  assert.equal((dispatchSpecial as Function).length, 1);
  assert.equal(typeof dispatchSpecialForAuthority, "function");
  assert.equal((dispatchSpecialForAuthority as Function).length, 1);
  const persistenceSource = readFileSync(
    new URL("../../src/execution/run-persistence.ts", import.meta.url),
    "utf8",
  );
  assert.match(persistenceSource, /lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1/);
  assert.match(persistenceSource, /bindInternalProductionRecoverySourceBootstrapRunInTransactionV1/);
  assert.match(persistenceSource, /resolveBundledWorkflowDir\("feature-dev"\)/);
  assert.match(persistenceSource, /RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1/);
  assert.match(persistenceSource, /const\s+RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ROOT_V1\s*=\s*path\.resolve\([\s\S]*fileURLToPath\(import\.meta\.url\)[\s\S]*["']\.\.\/\.\.["'][\s\S]*\)/,
    "recovery persistence derives the Setfarm checkout from its code-owned module location");
  assert.match(persistenceSource, /repo:\s*RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ROOT_V1[\s\S]*branch:\s*runId/,
    "the persisted recovery context pins the authenticated Setfarm checkout and its deterministic managed branch");
  assert.doesNotMatch(persistenceSource.slice(
    persistenceSource.indexOf("const RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ROOT_V1"),
    persistenceSource.indexOf("async function persistRecoverySourceBootstrapRunInTransactionV1"),
  ), /process\.cwd\(|process\.env|SETFARM_PROJECTS_ROOT|OPENCLAW_PROJECTS_ROOT/,
  "the recovery checkout and branch do not come from ambient working-directory or project-root configuration");
});

it("P4 recovery source bootstrap held authority reaches dispatch and persistence without current-entry reselection", () => {
  const installerSource = readFileSync(new URL("../../src/installer/run.ts", import.meta.url), "utf8");
  const persistenceSource = readFileSync(new URL("../../src/execution/run-persistence.ts", import.meta.url), "utf8");
  const region = (source: string, name: string): string => {
    const start = source.indexOf(`export async function ${name}(`);
    assert.ok(start >= 0, `${name}: authority-owned implementation exists`);
    const end = source.indexOf("\nexport ", start + 1);
    assert.ok(end > start, `${name}: authority-owned implementation is bounded`);
    return source.slice(start, end);
  };
  const dispatch = region(installerSource, "dispatchInternalProductionRecoverySourceBootstrapRunForAuthorityV1");
  const persist = region(persistenceSource, "persistInternalProductionRecoverySourceBootstrapRunForAuthorityV1");
  assert.match(dispatch, /^export async function dispatchInternalProductionRecoverySourceBootstrapRunForAuthorityV1\(\s*input:\s*Readonly<\{\s*recoveryOperationAuthority:\s*InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1;?\s*\}>/);
  assert.match(persist, /^export async function persistInternalProductionRecoverySourceBootstrapRunForAuthorityV1\(\s*input:\s*Readonly<\{\s*recoveryOperationAuthority:\s*InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1;?\s*\}>/);
  assert.doesNotMatch(`${dispatch}\n${persist}`, /resolveInternalProductionRecoverySourceBootstrapOperationV1|selectCurrentEntryStoreContextV1/,
    "authority-owned dispatch and persistence cannot ambiently reselect mutable current-entry state");
  assert.doesNotMatch(dispatch, /\bdispatchInternalProductionRecoverySourceBootstrapRunV1\s*\(/,
    "the authority-owned dispatch implementation cannot delegate back to the ambient pair-only public dispatcher");
  assert.doesNotMatch(persist, /\bpersistInternalProductionRecoverySourceBootstrapRunV1\s*\(/,
    "the authority-owned persistence implementation cannot delegate back to the ambient pair-only public persistence wrapper");
  assert.match(dispatch, /persistInternalProductionRecoverySourceBootstrapRunForAuthorityV1\(\s*\{\s*recoveryOperationAuthority:\s*input\.recoveryOperationAuthority\s*,?\s*\}\s*\)/,
    "dispatch transfers the exact authority object to persistence without pair reconstruction");
  assert.match(persist, /recoverySourceBootstrapRunCandidateV1\(\s*input\.recoveryOperationAuthority\s*,/,
    "persistence derives its durable candidate directly from the held authority");
  assert.match(installerSource, /import\s*\{[^}]*persistInternalProductionRecoverySourceBootstrapRunForAuthorityV1[^}]*\}\s*from\s*["']\.\.\/execution\/run-persistence\.js["']/,
    "the authority-owned dispatcher imports its exact persistence port");
  assert.doesNotMatch(`${dispatch}\n${persist}`, /operationRef:\s*input\.|operationHash:\s*input\.|\{\s*operationRef\s*,\s*operationHash\s*\}/,
    "the held path never degrades its authority back into a pair-only public-wrapper input");
});

it("P4 recovery source bootstrap persisted observer delegates the held operation authority without ambient reselection", async () => {
  const production = readFileSync(new URL("../../src/installer/run.ts", import.meta.url), "utf8");
  const marker = "export async function observePersistedInternalProductionRecoverySourceBootstrapRunV1(";
  const start = production.indexOf(marker);
  assert.ok(start >= 0, "the installer exports one durable recovery observer before resume can adopt a response-loss run");
  const nextExport = production.indexOf("\nexport ", start + marker.length);
  assert.ok(nextExport > start, "the durable recovery observer has one bounded implementation region");
  const observer = production.slice(start, nextExport);
  assert.match(observer, /^export async function observePersistedInternalProductionRecoverySourceBootstrapRunV1\(\s*input:\s*Readonly<\{\s*recoveryOperationAuthority:\s*InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1;?\s*\}>/);
  assert.doesNotMatch(observer, /resolveInternalProductionRecoverySourceBootstrapOperationV1|selectCurrentEntryStoreContextV1|createInternalProductionRecoverySourceBootstrapRunOperationAuthorityV1/,
    "the database observer cannot reselect mutable current-entry state or replace the authority already held by resume");
  const sqlBinding = /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*getSql\(\)\s*;/.exec(observer);
  assert.ok(sqlBinding, "the public observer binds its sole SQL owner after filesystem operation authentication");
  const transactionBinding = new RegExp(`${sqlBinding[1]!}\\.begin\\(\\s*["']isolation level repeatable read read only["']\\s*,\\s*async\\s*\\(([A-Za-z_$][A-Za-z0-9_$]*)\\)\\s*=>`).exec(observer);
  assert.ok(transactionBinding, "the public observer owns one explicit repeatable-read/read-only transaction");
  assert.equal(observer.split(".begin(").length - 1, 1, "the public observer owns exactly one PostgreSQL snapshot");
  assert.match(observer, new RegExp(`return\\s+await\\s+${sqlBinding[1]!}\\.begin\\([\\s\\S]*return\\s+await\\s+classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1\\(\\s*${transactionBinding[1]!}\\s*,\\s*\\{[\\s\\S]*recoveryState:\\s*["']prepared["'][\\s\\S]*recoveryOperationAuthority:\\s*input\\.recoveryOperationAuthority[\\s\\S]*\\}\\s*\\)\\s*;`),
    "the observer returns only the shared in-transaction classifier result for that exact operation authority");
  assert.match(production, /import\s*\{[^}]*classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1[^}]*\}\s*from\s*["']\.\.\/db-pg\.js["']/,
    "the public adapter imports its classifier from the exact database module");
  assert.doesNotMatch(observer, /persistInternalProductionRecoverySourceBootstrapRunV1|dispatchInternalProductionRecoverySourceBootstrapRunV1|(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\s/i,
    "the public observer cannot persist, dispatch, or mutate while deciding response-loss adoption");

  const functionHeader = /^export async function observePersistedInternalProductionRecoverySourceBootstrapRunV1\([\s\S]*?\):\s*Promise<[^\n]+>\s*\{/.exec(observer);
  assert.ok(functionHeader, "the observer body remains fixture-executable behind its exact authority-only input");
  const bodyStart = observer.indexOf("{", functionHeader.index + functionHeader[0].length - 1);
  const bodyEnd = observer.lastIndexOf("}");
  assert.ok(bodyStart >= 0 && bodyEnd > bodyStart);
  const fixture = await mkdtemp(path.join(tmpdir(), "setfarm-p4-source-bootstrap-observer-"));
  try {
    const modulePath = path.join(fixture, "observer.ts");
    await writeFile(modulePath, `
const g=globalThis as any;
type PgTransactionSql=any; type InternalProductionPgTransactionSql=any;
type InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1=any;
const resolveInternalProductionRecoverySourceBootstrapOperationV1=async()=>{g.__p4ObserveCalls.push({port:"ambient-reselection"});return g.__p4AmbientOperation};
const transaction={kind:"rr-ro"};
const getSql=()=>({begin:async(mode:string,callback:(sql:any)=>Promise<any>)=>{g.__p4ObserveCalls.push({port:"begin",mode});return callback(transaction)}});
const classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1=async(sql:any,input:any)=>{g.__p4ObserveCalls.push({port:"classify",sameTransaction:sql===transaction,input});return g.__p4ObserveResult};
export async function observePersistedInternalProductionRecoverySourceBootstrapRunV1(input:any) ${observer.slice(bodyStart, bodyEnd + 1)}
`, "utf8");
    const kernel = await import(`${pathToFileURL(modulePath).href}?observer=${Date.now()}`) as any;
    const authority = Object.freeze({ operationRef: "setfarm://tests/p4/recovery-operation", operationHash: "1".repeat(64), pendingInputRef: "setfarm://tests/p4/pending", pendingInputHash: "2".repeat(64) });
    const input = Object.freeze({ recoveryOperationAuthority: authority });
    const ambientOperation = Object.freeze({ ...authority, operationHash: "9".repeat(64), pendingInputHash: "8".repeat(64) });
    const result = Object.freeze({ state: "active", workflowState: "running", runId: "3".repeat(64), operationRunBindingHash: "4".repeat(64), reciprocalRunOperationBindingHash: "5".repeat(64) });
    Object.assign(globalThis as any, { __p4ObserveCalls: [], __p4AmbientOperation: ambientOperation, __p4ObserveResult: result });
    assert.equal(await kernel.observePersistedInternalProductionRecoverySourceBootstrapRunV1(input), result);
    assert.deepEqual((globalThis as any).__p4ObserveCalls, [
      { port: "begin", mode: "isolation level repeatable read read only" },
      { port: "classify", sameTransaction: true, input: { recoveryState: "prepared", recoveryOperationAuthority: authority } },
    ], "a crossed ambient current-entry operation is never read; the exact held authority flows through one RR/RO snapshot unchanged");
    const released = Object.freeze({
      state: "released",
      workflowState: "completed",
      runId: "3".repeat(64),
      operationRunBindingHash: "4".repeat(64),
      reciprocalRunOperationBindingHash: "5".repeat(64),
      terminalOwnerRef: `setfarm://internal-production/recovery-source-run-terminal-owner/sha256/${"6".repeat(64)}`,
      terminalOwnerHash: "6".repeat(64),
      terminalSourceRunRef: `setfarm://internal-production/recovery-source-run-terminal-authority/sha256/${"7".repeat(64)}`,
      terminalSourceRunHash: "7".repeat(64),
      terminalRunLaunchRef: `setfarm://internal-production/recovery-run-launch-terminal-authority/sha256/${"8".repeat(64)}`,
      terminalRunLaunchHash: "8".repeat(64),
      targetReservationPairCloseRef: `setfarm://internal-production/source-run-launch-target-reservation-pair-close/sha256/${"9".repeat(64)}`,
      targetReservationPairCloseHash: "9".repeat(64),
      fenceReleaseRef: `setfarm://internal-production/global-owner-admission-fence-release/sha256/${"a".repeat(64)}`,
      fenceReleaseHash: "a".repeat(64),
      sourceRunRef: `setfarm://internal-production/recovery-source-bootstrap-run-receipt/sha256/${"b".repeat(64)}`,
      sourceRunHash: "b".repeat(64),
    });
    Object.assign(globalThis as any, { __p4ObserveCalls: [], __p4ObserveResult: released });
    assert.equal(await kernel.observePersistedInternalProductionRecoverySourceBootstrapRunV1(input), released,
      "the public RR/RO observer returns flat released database authority without remapping it to absent or a filesystem receipt");
    assert.deepEqual((globalThis as any).__p4ObserveCalls, [
      { port: "begin", mode: "isolation level repeatable read read only" },
      { port: "classify", sameTransaction: true, input: { recoveryState: "prepared", recoveryOperationAuthority: authority } },
    ], "prepared filesystem current can observe an exact H4 release in the same single RR/RO snapshot");
    const targetReservationPairClose = Object.freeze({
      schema: "setfarm.internal-production-source-run-launch-target-reservation-pair-close.v1",
      fenceRef: `setfarm://internal-production/global-owner-admission-fence/sha256/${"c".repeat(64)}`,
      fenceHash: "c".repeat(64),
      targetRunLaunchCompositeHash: "d".repeat(64),
      sourceRunReservationRef: `setfarm://internal-production/owner-reservations/${"e".repeat(64)}`,
      sourceRunReservationHash: "e".repeat(64),
      runReservationRef: `setfarm://internal-production/owner-reservations/${"f".repeat(64)}`,
      runReservationHash: "f".repeat(64),
      terminalSourceRunRef: `setfarm://internal-production/recovery-source-run-terminal-authority/sha256/${"7".repeat(64)}`,
      terminalSourceRunHash: "7".repeat(64),
      terminalRunLaunchRef: `setfarm://internal-production/recovery-run-launch-terminal-authority/sha256/${"8".repeat(64)}`,
      terminalRunLaunchHash: "8".repeat(64),
      ownerAdmissionHeadPredecessorHash: "1".repeat(64),
      ownerAdmissionHeadSuccessorHash: "2".repeat(64),
      preservedFenceRef: `setfarm://internal-production/global-owner-admission-fence/sha256/${"c".repeat(64)}`,
      preservedFenceHash: "c".repeat(64),
      targetReservationPairCloseRef: `setfarm://internal-production/source-run-launch-target-reservation-pair-close/sha256/${"9".repeat(64)}`,
      targetReservationPairCloseHash: "9".repeat(64),
    });
    const pairClosed = Object.freeze({
      state: "pair_closed",
      workflowState: "resuming",
      runId: "3".repeat(64),
      operationRunBindingHash: "4".repeat(64),
      reciprocalRunOperationBindingHash: "5".repeat(64),
      terminalOwnerRef: `setfarm://internal-production/recovery-source-run-terminal-owner/sha256/${"6".repeat(64)}`,
      terminalOwnerHash: "6".repeat(64),
      terminalSourceRunRef: `setfarm://internal-production/recovery-source-run-terminal-authority/sha256/${"7".repeat(64)}`,
      terminalSourceRunHash: "7".repeat(64),
      terminalRunLaunchRef: `setfarm://internal-production/recovery-run-launch-terminal-authority/sha256/${"8".repeat(64)}`,
      terminalRunLaunchHash: "8".repeat(64),
      targetReservationPairClose,
    });
    Object.assign(globalThis as any, { __p4ObserveCalls: [], __p4ObserveResult: pairClosed });
    assert.equal(await kernel.observePersistedInternalProductionRecoverySourceBootstrapRunV1(input), pairClosed,
      "the public RR/RO observer preserves the exact full pair-close H3 authority without fabricating release or receipt fields");
    assert.deepEqual(Object.keys(targetReservationPairClose).sort(), [
      "fenceHash", "fenceRef", "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash",
      "preservedFenceHash", "preservedFenceRef", "runReservationHash", "runReservationRef", "schema",
      "sourceRunReservationHash", "sourceRunReservationRef", "targetReservationPairCloseHash",
      "targetReservationPairCloseRef", "targetRunLaunchCompositeHash", "terminalRunLaunchHash",
      "terminalRunLaunchRef", "terminalSourceRunHash", "terminalSourceRunRef",
    ], "the public H3 passthrough retains the exact 18-key canonical pair-close object");
    assert.equal(Object.isFrozen(targetReservationPairClose), true,
      "the nested pair-close authority remains immutable through the public observer");
    assert.deepEqual((globalThis as any).__p4ObserveCalls, [
      { port: "begin", mode: "isolation level repeatable read read only" },
      { port: "classify", sameTransaction: true, input: { recoveryState: "prepared", recoveryOperationAuthority: authority } },
    ], "prepared filesystem current can observe an exact H3 pair-close response-loss window in the same snapshot");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

it("P4 recovery source bootstrap persistence executes lock-first exact33 bind and commit withholding", async () => {
  const production = readFileSync(new URL("../../src/execution/run-persistence.ts", import.meta.url), "utf8");
  const start = production.indexOf("const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1");
  const end = production.indexOf("export async function persistInternalProductionRecoverySourceBootstrapRunV1", start);
  const publicEnd = production.indexOf("\n}", end) + 2;
  assert.ok(start >= 0 && end > start && publicEnd > end);
  const fixture = await mkdtemp(path.join(tmpdir(), "setfarm-p4-source-bootstrap-persistence-"));
  try {
    const execution = path.join(fixture, "src/execution");
    await mkdir(execution, { recursive: true });
    const modulePath = path.join(execution, "run-persistence-kernel.ts");
    await writeFile(modulePath, `
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
type PgTransactionSql=any; type WorkflowSpec=any; type RunProtocolIdentity=any; type PersistedWorkflowStep=any; type PersistedWorkflowRunRowV1=any;
const g=globalThis as any;
const canonicalJsonStringify=(v:any):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonicalJsonStringify).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonicalJsonStringify(v[k])).join(",")+"}";
const hashCanonicalJson=(v:any)=>createHash("sha256").update(canonicalJsonStringify(v)).digest("hex");
const resolveInternalProductionRecoverySourceBootstrapOperationV1=async()=>g.__p4PersistOperation;
const resolveCurrentInternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1=async()=>g.__p4PersistProtocol;
const resolveBundledWorkflowDir=()=>"feature-dev";
const loadWorkflowSpec=async()=>g.__p4PersistWorkflow;
const lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1=async(_sql:any)=>{g.__p4PersistLedger.push("lock");return g.__p4PersistAuthority};
const bindInternalProductionRecoverySourceBootstrapRunInTransactionV1=async(_sql:any,input:any)=>{g.__p4PersistLedger.push("bind");const context=JSON.parse(g.__p4PersistTx.runs[input.runId].context);if(Object.keys(context).length!==33)throw new Error("EXACT33_CONTEXT_REQUIRED");const expectedRepo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");if(context.repo!==expectedRepo||context.branch!==input.runId)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_RUNTIME_IDENTITY_CROSSED");if(g.__p4PersistTx.steps.length!==g.__p4PersistWorkflow.steps.length)throw new Error("EXACT_STEPS_REQUIRED");return {runOwnerReservationRef:g.__p4PersistOperation.targetRunReservationRef,runOwnerReservationHash:g.__p4PersistOperation.targetRunReservationHash}};
const readDatabaseWallClock=async()=>{g.__p4PersistLedger.push("clock");return new Date("2026-08-26T12:00:00.000Z")};
const persistedWorkflowRunResultV1=(row:any,pair:any)=>({run:{id:row.id,runNumber:row.run_number,workflowId:row.workflow_id,task:row.task,status:"running",context:row.context,notifyUrl:row.notify_url,protocol:row.protocol,protocolVersion:row.protocol_version,compilerReleaseSha:row.compiler_release_sha,activationPreflightHash:row.activation_preflight_hash,releaseAdmissionHash:row.release_admission_hash,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()},...pair});
const pgBegin=async(cb:any)=>{const prior=structuredClone(g.__p4PersistState);const tx=structuredClone(prior);g.__p4PersistTx=tx;const sql:any={unsafe:async(q:string,p:any[]=[])=>{if(q.includes("FROM runs")&&q.includes("FOR UPDATE")){g.__p4PersistLedger.push("select-run");return tx.runs[p[0]]?[tx.runs[p[0]]]:[]}if(q.includes("nextval")){g.__p4PersistLedger.push("nextval");return [{next:41}]}if(q.includes("INSERT INTO runs")){g.__p4PersistLedger.push("insert-run");tx.runs[p[0]]={id:p[0],run_number:p[1],workflow_id:"feature-dev",task:p[2],status:"running",context:p[3],notify_url:null,protocol:"v3",protocol_version:1,compiler_release_sha:p[4],activation_preflight_hash:p[5],release_admission_hash:p[6],created_at:p[7],updated_at:p[7]};return []}if(q.includes("INSERT INTO steps")){g.__p4PersistLedger.push("insert-step");tx.steps.push({id:p[0],run_id:p[1],step_id:p[2],agent_id:p[3],step_index:p[4],input_template:p[5],expects:p[6],status:p[7],max_retries:p[8],type:p[9],loop_config:p[10],created_at:p[11],updated_at:p[11]});return []}if(q.includes("FROM steps")){g.__p4PersistLedger.push("select-steps");return tx.steps}throw new Error("UNEXPECTED_SQL:"+q)}};const value=await cb(sql);if(g.__p4PersistRejectCommit)throw new Error("INJECT_COMMIT_ACK_LOSS");g.__p4PersistState=tx;g.__p4PersistLedger.push("commit");return value};
${production.slice(start, publicEnd)}
export function p4State(){return structuredClone(g.__p4PersistState)}
`, "utf8");
    const kernel = await import(`${pathToFileURL(modulePath).href}?p4=${Date.now()}`) as any;
    const sha = (member: string) => member.repeat(64);
    const operation = { protocol: "v3", baseSourceSha: "1".repeat(40), baseSourceTreeHash: "2".repeat(40), buildHash: sha("1"), activationPreflightHash: sha("2"), releaseAdmissionHash: sha("3"), purpose: "recovery-d-source-delivery-v1", repository: "setfarm", workflow: "feature-dev", promptManifestHash: sha("4"), pendingInputRef: "setfarm://tests/p4/pending", pendingInputHash: sha("5"), startIntentRef: "setfarm://tests/p4/intent", startIntentHash: sha("6"), startOutboxRef: "setfarm://tests/p4/outbox", startOutboxHash: sha("7"), operationRef: "setfarm://tests/p4/operation", operationHash: sha("8"), targetSourceRunReservationRef: "setfarm://tests/p4/source-reservation", targetSourceRunReservationHash: sha("9"), targetRunReservationRef: "setfarm://tests/p4/run-reservation", targetRunReservationHash: sha("a"), targetRunLaunchCompositeHash: sha("b") };
    const runId = hashCanonicalJson({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1", pendingInputRef: operation.pendingInputRef, pendingInputHash: operation.pendingInputHash });
    const protocol = { protocol: "v3", compilerReleaseSha: operation.baseSourceSha, baseSourceTreeHash: operation.baseSourceTreeHash, buildHash: operation.buildHash, activationPreflightHash: operation.activationPreflightHash, releaseAdmissionHash: operation.releaseAdmissionHash, protocolVersion: 1, releaseAdmissionKind: "release_go" };
    const workflow = { id: "feature-dev", context: {}, steps: [{ id: "plan", agent: "planner", input: "plan", expects: "plan" }, { id: "build", agent: "developer", input: "build", expects: "code", max_retries: 1 }] };
    const operationRunBindingHash = sha("c");
    const reciprocalRunOperationBindingHash = sha("d");
    const authority = { runId, operationRef: operation.operationRef, operationHash: operation.operationHash, activationPreflightHash: operation.activationPreflightHash, releaseAdmissionHash: operation.releaseAdmissionHash, operationRunBindingHash, reciprocalRunOperationBindingHash };
    Object.assign(globalThis as any, { __p4PersistOperation: operation, __p4PersistProtocol: protocol, __p4PersistWorkflow: workflow, __p4PersistAuthority: authority, __p4PersistState: { runs: {}, steps: [] }, __p4PersistLedger: [], __p4PersistRejectCommit: false });
    const persisted = await kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash });
    assert.equal(persisted.run.id, runId);
    const ledger = (globalThis as any).__p4PersistLedger as string[];
    assert.deepEqual(ledger, ["lock", "select-run", "nextval", "clock", "insert-run", "insert-step", "insert-step", "bind", "select-run", "select-steps", "commit"]);
    const persistedContext = JSON.parse(persisted.run.context);
    assert.equal(Object.keys(persistedContext).length, 33);
    assert.equal(persistedContext.repo, realpathSync(fixture));
    assert.equal(persistedContext.branch, runId);
    const committed = kernel.p4State();
    (globalThis as any).__p4PersistState = { runs: {}, steps: [] };
    (globalThis as any).__p4PersistLedger = [];
    (globalThis as any).__p4PersistRejectCommit = true;
    await assert.rejects(kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash }), /INJECT_COMMIT_ACK_LOSS/);
    assert.deepEqual(kernel.p4State(), { runs: {}, steps: [] }, "tentative run and steps stay private until commit acknowledgement");
    (globalThis as any).__p4PersistRejectCommit = false;
    (globalThis as any).__p4PersistState = committed;
    (globalThis as any).__p4PersistLedger = [];
    const adopted = await kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash });
    assert.equal(adopted.run.id, runId);
    assert.doesNotMatch((globalThis as any).__p4PersistLedger.join(","), /nextval|clock|insert-/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

describe("run-pinned product compiler protocol", () => {
  let database: TestDatabase;

  const seedProtocolRun = async (input: PersistWorkflowRunInputV1): Promise<void> => {
    await database.sql.begin(async (sql) => {
      await sql.unsafe(
        `INSERT INTO runs
           (id,run_number,workflow_id,task,status,context,notify_url,protocol,
            protocol_version,compiler_release_sha,activation_preflight_hash,
            release_admission_hash,created_at,updated_at)
         VALUES ($1,$2,$3,$4,'running',$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [
          input.run.id,
          input.run.runNumber,
          input.run.workflowId,
          input.run.task,
          input.run.context,
          input.run.notifyUrl,
          input.run.protocol.mode,
          input.run.protocol.version,
          input.run.protocol.compilerReleaseSha,
          input.run.protocol.activationPreflightHash,
          input.run.protocol.releaseAdmissionHash,
          input.run.createdAt,
        ],
      );
      for (const step of input.steps) {
        await sql.unsafe(
          `INSERT INTO steps
             (id,run_id,step_id,agent_id,step_index,input_template,expects,status,
              max_retries,type,loop_config,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
          [step.id,input.run.id,step.stepId,step.agentId,step.stepIndex,
            step.inputTemplate,step.expects,step.status,step.maxRetries,step.type,
            step.loopConfig,input.run.createdAt],
        );
      }
    });
  };

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  it("run persistence exposes exact inner and post-commit public ABI", async () => {
    const persistence = await import("../../src/execution/run-persistence.js");
    assert.equal(typeof persistence.persistWorkflowRunInTransaction, "function");
    assert.equal(persistence.persistWorkflowRunInTransaction.length, 2);
    assert.equal(persistence.persistWorkflowRun.length, 1);

    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../src/execution/run-persistence.ts"),
      "utf8",
    );
    const fence = source.indexOf("FOR UPDATE", source.indexOf("version = 31"));
    const begin = source.indexOf("beginOrAdoptInternalProductionOwnerReservationV1", fence);
    const census = source.indexOf("AS active_runs", begin);
    const insert = source.indexOf("INSERT INTO runs", census);
    const bind = source.indexOf("bindInternalProductionOwnerReservationV1", insert);
    assert.ok(fence >= 0 && begin > fence && census > begin && insert > census && bind > insert);
    assert.doesNotMatch(source, /runAdmissionLockKey|pg_advisory_xact_lock/);
    assert.match(source, /await pgBegin\(async \(sql\) => \{/);
    assert.match(source, /tentative = await persistWorkflowRunInTransaction\(sql, input\)/);
    assert.match(source, /return undefined;/);
    assert.ok(source.indexOf("return committed;") > source.indexOf("await pgBegin("));

    const dbSource = readFileSync(
      path.resolve(import.meta.dirname, "../../src/db-pg.ts"),
      "utf8",
    );
    assert.equal(
      dbSource.match(/const RUN_PERSISTENCE_READINESS_MODULE_SPECIFIER_V1 = "\.\/internal-production\/baseline-spawner-startup-admission-v1\.js";/g)?.length,
      1,
    );
    assert.equal(
      dbSource.match(/await import\(RUN_PERSISTENCE_READINESS_MODULE_SPECIFIER_V1\)/g)?.length,
      1,
    );
    assert.match(dbSource, /observeInternalProductionPreSchemaSpawnerRebindStatusV1\(\)/);
    assert.match(dbSource, /resolveInternalProductionTask0SpawnerAdmissionReadyV1\(status\.admissionReady\)/);
    assert.match(dbSource, /Reflect\.ownKeys\(namespace\)/);
    assert.match(dbSource, /observeInternalProductionPreSchemaSpawnerRebindStatusV1\.length !== 0/);
    assert.match(dbSource, /resolveInternalProductionTask0SpawnerAdmissionReadyV1\.length !== 1/);
    assert.match(dbSource, /6cf01b73fab3004670c98f71ef0c2ac9ee4852f697cfbd976d359807f65abf17/);
    assert.match(dbSource, /currentResolution\.nodes/);
    assert.doesNotMatch(dbSource, /current\.receipt\.phase\s*!==\s*"A"/);

    const installerSource = readFileSync(
      path.resolve(import.meta.dirname, "../../src/installer/run.ts"),
      "utf8",
    );
    assert.match(installerSource, /import \{\s*persistWorkflowRun,\s*type PersistedWorkflowStep,?\s*\} from "\.\.\/execution\/run-persistence\.js";/s);
    assert.doesNotMatch(installerSource, /persistWorkflowRunInTransaction/);
  });

  it("public persistence exposes no tentative result before commit acknowledgement", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-run-persistence-commit-boundary-"));
    try {
      const source = readFileSync(
        path.resolve(import.meta.dirname, "../../src/execution/run-persistence.ts"),
        "utf8",
      );
      const wrapper = source.slice(source.indexOf("export async function persistWorkflowRun("));
      assert.match(wrapper, /^export async function persistWorkflowRun\(/);
      const modulePath = path.join(root, "wrapper.ts");
      await writeFile(modulePath, `
type PersistWorkflowRunInputV1 = unknown;
type PersistWorkflowRunResultV1 = Readonly<{ run: Readonly<{ id: string }> }>;
let acknowledgeCommit;
let callbackReturned;
let commitError;
let callbackValue;
let result = Object.freeze({ run: Object.freeze({ id: "committed-run" }) });
let acknowledgement = new Promise((resolve) => { acknowledgeCommit = resolve; });
let callbackObserved = new Promise((resolve) => { callbackReturned = resolve; });
async function persistWorkflowRunInTransaction() { return result; }
async function pgBegin(operation) {
  callbackValue = await operation(Object.freeze({}));
  callbackReturned(callbackValue);
  await acknowledgement;
  if (commitError) throw commitError;
}
export function controls() {
  return {
    acknowledge(value) { commitError = value; acknowledgeCommit(); },
    callbackObserved,
    callbackValue: () => callbackValue,
  };
}
${wrapper}
`, "utf8");
      const module = await import(`${pathToFileURL(modulePath).href}?commit=${Date.now()}`);
      const controls = module.controls();
      let settled = false;
      const pending = module.persistWorkflowRun(Object.freeze({})).finally(() => { settled = true; });
      assert.equal(await controls.callbackObserved, undefined);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(controls.callbackValue(), undefined);
      assert.equal(settled, false);
      controls.acknowledge(undefined);
      assert.deepEqual(await pending, { run: { id: "committed-run" } });

      const rejectedModule = await import(`${pathToFileURL(modulePath).href}?reject=${Date.now()}`);
      const rejectedControls = rejectedModule.controls();
      let rejectedSettled = false;
      const rejected = rejectedModule.persistWorkflowRun(Object.freeze({}))
        .finally(() => { rejectedSettled = true; });
      assert.equal(await rejectedControls.callbackObserved, undefined);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(rejectedSettled, false);
      rejectedControls.acknowledge(new Error("TEST_COMMIT_REJECTED"));
      await assert.rejects(rejected, /^Error: TEST_COMMIT_REJECTED$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("defaults new runs to legacy and lets an explicit shadow mode override the environment", () => {
    assert.deepEqual(
      resolveNewRunProtocol({ compilerReleaseSha: RELEASE_SHA, env: {} }),
      {
        mode: "legacy",
        version: 1,
        compilerReleaseSha: RELEASE_SHA,
        activationPreflightHash: null,
        releaseAdmissionHash: null,
        releaseAdmissionKind: null,
        canaryAdmission: null,
      },
    );
    assert.equal(
      resolveNewRunProtocol({
        requestedMode: "shadow",
        compilerReleaseSha: RELEASE_SHA,
        env: { SETFARM_PROTOCOL: "legacy" },
        activationPreflight: PASS_PREFLIGHT,
      }).mode,
      "shadow",
    );
  });

  it("rejects invalid configuration before run-number allocation is reachable", () => {
    for (const requestedMode of ["", "SHADOW", " shadow", "observe"]) {
      assert.throws(
        () => resolveNewRunProtocol({ requestedMode, compilerReleaseSha: RELEASE_SHA, env: {} }),
        (error: unknown) =>
          error instanceof RunProtocolError
          && error.code === "RUN_PROTOCOL_INVALID_MODE",
      );
    }

    const runSource = readFileSync(
      path.resolve(import.meta.dirname, "../../src/installer/run.ts"),
      "utf8",
    );
    const resolveIndex = runSource.indexOf("resolveNewRunProtocol(");
    const sequenceIndex = runSource.indexOf("await pgNextRunNumber()");
    assert.ok(resolveIndex >= 0 && sequenceIndex > resolveIndex);
  });

  it("treats activation as a kill switch and also requires exact release authority for v3", () => {
    assert.throws(
      () => resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: RELEASE_SHA,
        env: {},
        activationPreflight: PASS_PREFLIGHT,
      }),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_V3_DISABLED",
    );
    assert.throws(
      () => resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: RELEASE_SHA,
        env: { SETFARM_V3_ACTIVATION: "enabled" },
      }),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_PREFLIGHT_REQUIRED",
    );
    assert.deepEqual(
      (() => {
        assert.throws(
          () => resolveNewRunProtocol({
            requestedMode: "v3",
            compilerReleaseSha: RELEASE_SHA,
            env: { SETFARM_V3_ACTIVATION: "enabled" },
            activationPreflight: PASS_PREFLIGHT,
          }),
          (error: unknown) => error instanceof RunProtocolError
            && error.code === "RUN_PROTOCOL_RELEASE_ADMISSION_REQUIRED",
        );
        return resolveNewRunProtocol({
          requestedMode: "v3",
          compilerReleaseSha: RELEASE_SHA,
          env: { SETFARM_V3_ACTIVATION: "enabled" },
          activationPreflight: PASS_PREFLIGHT,
          releaseAdmission: RELEASE_GO_ADMISSION,
        });
      })(),
      {
        mode: "v3",
        version: 1,
        compilerReleaseSha: RELEASE_SHA,
        activationPreflightHash: PREFLIGHT_HASH,
        releaseAdmissionHash: RELEASE_ADMISSION_HASH,
        releaseAdmissionKind: "release_go",
        canaryAdmission: null,
      },
    );
  });

  it("extracts one protocol flag without leaking it into the task", () => {
    assert.deepEqual(
      extractProtocolArgument(["build", "a", "game", "--protocol", "shadow"]),
      { requestedMode: "shadow", remainingArgs: ["build", "a", "game"] },
    );
    assert.deepEqual(
      extractProtocolArgument(["build", "a", "game"]),
      { requestedMode: undefined, remainingArgs: ["build", "a", "game"] },
    );
    assert.throws(
      () => extractProtocolArgument(["task", "--protocol"]),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_FLAG_INVALID",
    );
    assert.throws(
      () => extractProtocolArgument(["task", "--protocol", "legacy", "--protocol", "shadow"]),
      (error: unknown) =>
        error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_FLAG_INVALID",
    );
  });

  it("keeps compiler-run admission under the database-owned insertion fence", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../../src/execution/run-persistence.ts"), "utf8");
    assert.match(source, /lockInternalProductionWorkflowRunInsertionFenceV1\(sql\)/);
    assert.match(source, /status IN \('running', 'resuming'\)/);
    assert.match(source, /disposition IN \('claimed', 'running'\)/);
    assert.match(source, /new RunActivationConflictError\(\)/);
  });

  it("persists protocol identity atomically with the run and steps", async () => {
    const protocol = resolveNewRunProtocol({
      requestedMode: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      env: {},
      activationPreflight: PASS_PREFLIGHT,
    });
    await seedProtocolRun({
      run: {
        id: "run-protocol-atomic",
        runNumber: 91,
        workflowId: "feature-dev",
        task: "atomic protocol",
        context: "{}",
        notifyUrl: null,
        createdAt: "2026-07-13T00:00:00.000Z",
        protocol,
      },
      steps: [{
        id: "step-protocol-atomic",
        stepId: "plan",
        agentId: "feature-dev_planner",
        stepIndex: 0,
        inputTemplate: "task",
        expects: "plan",
        status: "pending",
        maxRetries: 2,
        type: "single",
        loopConfig: null,
      }],
    });

    const row = await database.sql<{
      protocol: string;
      protocol_version: number;
      compiler_release_sha: string | null;
      activation_preflight_hash: string | null;
      steps: number;
    }[]>`
      SELECT r.protocol, r.protocol_version, r.compiler_release_sha,
             r.activation_preflight_hash,
             (SELECT COUNT(*)::integer FROM steps s WHERE s.run_id = r.id) AS steps
      FROM runs r
      WHERE r.id = 'run-protocol-atomic'
    `;
    assert.deepEqual({ ...row[0] }, {
      protocol: "shadow",
      protocol_version: 1,
      compiler_release_sha: RELEASE_SHA,
      activation_preflight_hash: PREFLIGHT_HASH,
      steps: 1,
    });

    await database.sql`UPDATE runs SET status = 'completed' WHERE id = 'run-protocol-atomic'`;

    await assert.rejects(
      seedProtocolRun({
        run: {
          id: "run-protocol-rollback",
          runNumber: 93,
          workflowId: "feature-dev",
          task: "must roll back",
          context: "{}",
          notifyUrl: null,
          createdAt: "2026-07-13T00:00:00.000Z",
          protocol,
        },
        steps: [
          {
            id: "duplicate-step",
            stepId: "plan",
            agentId: "planner",
            stepIndex: 0,
            inputTemplate: "task",
            expects: "plan",
            status: "pending",
            maxRetries: 2,
            type: "single",
            loopConfig: null,
          },
          {
            id: "duplicate-step",
            stepId: "design",
            agentId: "designer",
            stepIndex: 1,
            inputTemplate: "plan",
            expects: "design",
            status: "waiting",
            maxRetries: 2,
            type: "single",
            loopConfig: null,
          },
        ],
      }),
    );
    const rolledBack = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count FROM runs WHERE id = 'run-protocol-rollback'
    `;
    assert.equal(rolledBack[0]?.count, 0);
  });

  it("reads the stored mode after environment changes and rejects protocol mutation", async () => {
    const repository = createRunProtocolRepository(database.sql);
    process.env.SETFARM_PROTOCOL = "legacy";
    try {
      const stored = await repository.read("run-protocol-atomic");
      assert.equal(stored.mode, "shadow");
      assert.equal(stored.compilerReleaseSha, RELEASE_SHA);
    } finally {
      delete process.env.SETFARM_PROTOCOL;
    }

    await assert.rejects(
      database.sql`UPDATE runs SET protocol = 'v3' WHERE id = 'run-protocol-atomic'`,
      /RUN_PROTOCOL_IMMUTABLE/,
    );
    assert.equal((await repository.read("run-protocol-atomic")).mode, "shadow");
    await assert.rejects(
      database.sql`
        INSERT INTO runs
          (id, run_number, workflow_id, task, protocol, protocol_version, compiler_release_sha)
        VALUES
          ('run-shadow-without-preflight', 94, 'feature-dev', 'invalid shadow',
           'shadow', 1, ${RELEASE_SHA})
      `,
      /runs_compiler_preflight_check/,
    );
  });
});
