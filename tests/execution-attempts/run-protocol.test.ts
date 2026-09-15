import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { chmodSync, cpSync, existsSync, linkSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

async function waitForFixtureProcessExit(
  child: ReturnType<typeof spawn>,
  label: string,
): Promise<number | null> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      once(child, "exit") as Promise<[number | null, NodeJS.Signals | null]>,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), 10_000);
      }),
    ]);
    return result[0];
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}

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

it("P4 recovery source bootstrap run context binds the exact managed repository and fence authority", async () => {
  const authorityModule = await import("../../src/execution/recovery-source-bootstrap-run-authority-v1.js");
  const repositoryModule = await import("../../src/execution/recovery-source-bootstrap-repository-v1.js");
  const runtimeAuthorityModule = await import("../../src/execution/recovery-source-bootstrap-runtime-authority-v1.js");
  const createContext = Reflect.get(authorityModule, "createInternalProductionRecoverySourceBootstrapRunContextV1");
  assert.equal(typeof createContext, "function");
  const sha = (member: string) => member.repeat(64);
  const runId = sha("a");
  const sourceRepositoryRoot = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
  const repositoryIdentity = repositoryModule.resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1({
    sourceRepositoryRoot,
    runId,
  });
  const operation = {
    purpose: "recovery-d-source-delivery-v1", repository: "setfarm", workflow: "feature-dev", protocol: "v3",
    promptManifestHash: sha("1"), baseSourceSha: "2".repeat(40), baseSourceTreeHash: "3".repeat(40),
    buildHash: sha("4"), activationPreflightHash: sha("5"), releaseAdmissionHash: sha("6"),
    pendingInputRef: "setfarm://tests/context/pending", pendingInputHash: sha("7"),
    startIntentRef: "setfarm://tests/context/intent", startIntentHash: sha("8"),
    startOutboxRef: "setfarm://tests/context/outbox", startOutboxHash: sha("9"),
    operationRef: "setfarm://tests/context/operation", operationHash: sha("b"),
    targetSourceRunReservationRef: "setfarm://tests/context/source-reservation", targetSourceRunReservationHash: sha("c"),
    targetRunReservationRef: "setfarm://tests/context/run-reservation", targetRunReservationHash: sha("d"),
    targetRunLaunchCompositeHash: sha("e"), ownerAdmissionFenceRef: "setfarm://tests/context/fence", ownerAdmissionFenceHash: sha("f"),
  };
  const context = createContext(operation, {
    runId,
    operationRunBindingHash: sha("1"),
    reciprocalRunOperationBindingHash: sha("2"),
    repositoryIdentity,
  });
  assert.deepEqual(Object.keys(context), [
    "schema", "task", "repo", "branch", "purpose", "repository", "workflow", "protocol", "promptManifestHash",
    "baseSourceSha", "baseSourceTreeHash", "buildHash", "activationPreflightHash", "releaseAdmissionHash",
    "pendingInputRef", "pendingInputHash", "startIntentRef", "startIntentHash", "startOutboxRef", "startOutboxHash",
    "operationRef", "operationHash", "targetSourceRunReservationRef", "targetSourceRunReservationHash",
    "targetRunReservationRef", "targetRunReservationHash", "targetRunLaunchCompositeHash", "ownerAdmissionFenceRef",
    "ownerAdmissionFenceHash", "sourceRunOwnerRef", "sourceRunOwnerHash", "runOwnerRef", "runOwnerHash",
    "operationRunBindingHash", "reciprocalRunOperationBindingHash",
  ]);
  assert.equal(context.repo, repositoryIdentity.repositoryRoot);
  assert.equal(context.branch, runId);
  assert.equal(context.ownerAdmissionFenceRef, operation.ownerAdmissionFenceRef);
  assert.equal(context.ownerAdmissionFenceHash, operation.ownerAdmissionFenceHash);
  assert.equal(context.runOwnerRef, `setfarm://runs/${runId}`);
  assert.equal(context.runOwnerHash, hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId }));
  assert.throws(() => createContext(operation, {
    runId,
    operationRunBindingHash: sha("1"),
    reciprocalRunOperationBindingHash: sha("2"),
    repositoryIdentity: { ...repositoryIdentity, repositoryRoot: sourceRepositoryRoot },
  }), /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_IDENTITY_CROSSED/);
  const requireMutationState = Reflect.get(
    runtimeAuthorityModule,
    "requireInternalProductionRecoverySourceBootstrapRunMutationStateV1",
  );
  assert.equal(typeof requireMutationState, "function");
  for (const workflowState of ["running", "resuming"]) {
    assert.doesNotThrow(() => requireMutationState({ state: "active", workflowState }));
  }
  for (const workflowState of ["cancelling", "failing"]) {
    assert.throws(() => requireMutationState({ state: "active", workflowState }),
      /RECOVERY_SOURCE_BOOTSTRAP_RUN_MUTATION_STATE_INVALID/,
      "termination-in-progress recovery runs cannot fetch, merge, or mutate their repository branch");
  }

  const persistenceSource = readFileSync(new URL("../../src/execution/run-persistence.ts", import.meta.url), "utf8");
  const databaseSource = readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  assert.match(persistenceSource, /canonicalJsonStringify\(createInternalProductionRecoverySourceBootstrapRunContextV1\(operation,\s*\{[\s\S]*repositoryIdentity[\s\S]*\}\)\)/,
    "run persistence serializes only the shared immutable recovery context factory result");
  assert.match(databaseSource, /canonicalJsonStringify\(createInternalProductionRecoverySourceBootstrapRunContextV1\(operation,\s*\{[\s\S]*repositoryIdentity[\s\S]*\}\)\)/,
    "the exact database binder serializes the same shared immutable recovery context factory result");
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
  assert.match(persistenceSource, /resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1\(\{[\s\S]*sourceRepositoryRoot:\s*RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ROOT_V1[\s\S]*runId[\s\S]*\}\)/,
    "recovery persistence derives one deterministic managed repository identity from its code-owned source checkout and run id");
  assert.match(persistenceSource, /createInternalProductionRecoverySourceBootstrapRunContextV1\(operation,\s*\{[\s\S]*repositoryIdentity[\s\S]*\}\)/,
    "the persisted recovery context delegates isolated repository and deterministic branch binding to the shared context factory");
  assert.match(persistenceSource, /const\s+repositoryInput\s*=\s*\{[\s\S]*sourceRepositoryRoot:\s*candidate\.repositoryIdentity\.sourceRepositoryRoot[\s\S]*baseSourceSha:\s*candidate\.operation\.baseSourceSha[\s\S]*baseSourceTreeHash:\s*candidate\.operation\.baseSourceTreeHash[\s\S]*prepareInternalProductionRecoverySourceBootstrapRepositoryV1\(repositoryInput\)/,
    "the locked persistence path prepares or adopts the authority-bound isolated repository before run publication");
  assert.match(persistenceSource, /row\s*===\s*null[\s\S]*\?\s*prepareInternalProductionRecoverySourceBootstrapRepositoryV1[\s\S]*:\s*validateInternalProductionRecoverySourceBootstrapRepositoryV1/,
    "only a missing durable run may create its repository; active adoption is validation-only");
  assert.doesNotMatch(persistenceSource.slice(
    persistenceSource.indexOf("const RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ROOT_V1"),
    persistenceSource.indexOf("async function persistRecoverySourceBootstrapRunInTransactionV1"),
  ), /process\.cwd\(|process\.env|SETFARM_PROJECTS_ROOT|OPENCLAW_PROJECTS_ROOT/,
  "the recovery checkout and branch do not come from ambient working-directory or project-root configuration");
});

it("P4 completed recovery removes only the authenticated isolated repository with journaled whole-clone erasure", () => {
  const cleanupSource = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-repository-cleanup-v1.ts", import.meta.url), "utf8");
  const stepAdvance = readFileSync(new URL("../../src/installer/step-advance.ts", import.meta.url), "utf8");
  const spawner = readFileSync(new URL("../../src/spawner.ts", import.meta.url), "utf8");
  const worktreeOps = readFileSync(new URL("../../src/installer/worktree-ops.ts", import.meta.url), "utf8");
  assert.match(cleanupSource, /cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1[\s\S]*pg_advisory_lock[\s\S]*BEGIN ISOLATION LEVEL REPEATABLE READ[\s\S]*FOR UPDATE OF run[\s\S]*failed[\s\S]*cancelled[\s\S]*completed[\s\S]*state\s*!==\s*["']released["'][\s\S]*removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1/,
    "terminal cleanup takes its session lock before the fresh repeatable-read snapshot, row-locks one run, and requires exact H4 release before filesystem removal");
  assert.match(stepAdvance, /from\s+["']\.\.\/execution\/recovery-source-bootstrap-repository-cleanup-v1\.js["']/,
    "pipeline completion imports terminal repository cleanup from a cycle-free execution module");
  assert.doesNotMatch(stepAdvance, /from\s+["']\.\/run\.js["']/,
    "pipeline completion does not enter the installer run and baseline-receipt import cycle");
  assert.match(cleanupSource, /resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1[\s\S]*cleanupState\s*===\s*["']workspace["'][\s\S]*validateInternalProductionRecoverySourceBootstrapRepositoryV1[\s\S]*cleanupState\s*===\s*["']claimed["'][\s\S]*validateClaimedInternalProductionRecoverySourceBootstrapRepositoryV1[\s\S]*removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1/,
    "authenticated recovery cleanup validates a live or claimed clone before the journaled whole-clone remover owns every nested worktree");
  assert.doesNotMatch(cleanupSource, /cleanupWorktreesAtRepository/,
    "recovery cleanup never delegates its disposable clone to the generic path-based worktree remover");
  const completed = stepAdvance.slice(
    stepAdvance.indexOf('pc.kind === "completed"'),
    stepAdvance.indexOf("scheduleRunCronTeardown(runId)", stepAdvance.indexOf('pc.kind === "completed"')),
  );
  const recoveryCleanup = completed.indexOf("cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1");
  const ordinaryNestedCleanup = completed.indexOf("cleanupWorktrees(runId)", recoveryCleanup);
  const ordinaryBranches = completed.indexOf("cleanupLocalBranches(runId)", ordinaryNestedCleanup);
  assert.ok(recoveryCleanup >= 0 && ordinaryNestedCleanup > recoveryCleanup && ordinaryBranches > ordinaryNestedCleanup,
    "completed recovery authenticates its repository before any generic path-derived cleanup");
  assert.match(stepAdvance, /SELECT status, workflow_id, context FROM runs[\s\S]*recoveryRun:\s*isInternalProductionRecoverySourceBootstrapRunContextV1/,
    "the terminal transaction carries its locked recovery discriminator into the post-commit cleanup effect");
  assert.match(completed, /if\s*\(\s*pc\.recoveryRun\s*\)\s*\{[\s\S]*cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1[\s\S]*\}\s*else\s*\{[\s\S]*cleanupWorktrees\(runId\)[\s\S]*cleanupLocalBranches\(runId\)/,
    "only locked ordinary completion uses context-derived worktree and local-main cleanup; recovery refusal remains retryable");
  const earlyCleanup = stepAdvance.slice(
    stepAdvance.indexOf("export async function advancePipeline"),
    stepAdvance.indexOf('pc.kind === "completed"'),
  );
  assert.doesNotMatch(earlyCleanup, /cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1/,
    "active and retry cleanup never removes the recovery base clone");
  const loopContinuation = stepAdvance.slice(
    stepAdvance.indexOf("export async function checkLoopContinuation"),
    stepAdvance.indexOf("// ── autoVerifyAndAdvance", stepAdvance.indexOf("export async function checkLoopContinuation")),
  );
  const loopRecovery = loopContinuation.indexOf("isInternalProductionRecoverySourceBootstrapRunContextV1");
  const loopAuthority = loopContinuation.indexOf("requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1", loopRecovery);
  const loopGenericCleanup = loopContinuation.indexOf("cleanupWorktrees(runId)", loopAuthority);
  assert.ok(loopRecovery >= 0 && loopAuthority > loopRecovery && loopGenericCleanup > loopAuthority,
    "active recovery authenticates its durable run before bypassing generic loop worktree cleanup");
  assert.match(loopContinuation.slice(loopAuthority, loopGenericCleanup + "cleanupWorktrees(runId)".length),
    /requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1[\s\S]*\}\s*else\s*\{[\s\S]*cleanupWorktrees\(runId\)/,
    "generic early worktree cleanup remains reachable only for an ordinary loop");
  assert.match(loopContinuation, /SELECT status,context FROM runs WHERE id = \$1 FOR UPDATE/,
    "the loop transaction locks status and context together");
  assert.match(loopContinuation,
    /running[\s\S]*resuming[\s\S]*includes\(lockedRun\[0\]![.]status\)[\s\S]*lockedRun\[0\]![.]context[\s\S]*loopRunContextBytes[\s\S]*LOOP_COMPLETION_RECOVERY_RUN_CROSSED/,
    "the loop transaction rechecks running/resuming status and exact authenticated recovery context before any completion mutation");
  const downstreamContext = loopContinuation.indexOf("clearPrEachDownstreamContext");
  assert.ok(downstreamContext < 0 || loopContinuation.lastIndexOf("!recoveryLoop", downstreamContext) >= 0,
    "recovery loop completion never rewrites its immutable branch authority to main");
  const recoveryReconciler = spawner.slice(
    spawner.indexOf("async function reconcileV3RecoveryLifecycle"),
    spawner.indexOf("async function runV3EvidenceOnlyRecovery"),
  );
  assert.match(recoveryReconciler,
    /reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1[\s\S]*failed[\s\S]*cleanup/,
    "the recurring startup and poll reconciler retries every durable completed recovery repository cleanup effect");
  const ordinaryCleanup = worktreeOps.slice(
    worktreeOps.indexOf("export async function cleanupWorktreesAtRepository"),
    worktreeOps.indexOf("export async function cleanupWorktrees(", worktreeOps.indexOf("export async function cleanupWorktreesAtRepository")),
  );
  assert.ok(ordinaryCleanup.indexOf('["worktree", "prune"]') < ordinaryCleanup.indexOf("if (!fs.existsSync(worktreesDir)) return true"),
    "ordinary cleanup prunes stale Git administrative refs even when the physical .worktrees directory is already absent");
  assert.match(cleanupSource,
    /WITH recovery_cleanup_runs AS[\s\S]*SELECT run[.]id,run[.]context[\s\S]*LEFT JOIN public[.]run_observations observation[\s\S]*cleanup_status IS NOT DISTINCT FROM 'retry'[\s\S]*INTERVAL '5 minutes'[\s\S]*LIMIT 100/,
    "durable cleanup receipts and bounded failure backoff prevent restart starvation without an in-memory cursor");
  assert.match(cleanupSource,
    /actionable_cleanup_candidates[\s\S]*LIMIT 100[\s\S]*crossed_cleanup_receipts[\s\S]*LIMIT 100/,
    "actionable cleanup and crossed-receipt audit keep independent bounded quotas");
  const cleanupFunction = cleanupSource.slice(
    cleanupSource.indexOf("export async function cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1"),
    cleanupSource.indexOf("export async function reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1"),
  );
  assert.ok(
    cleanupFunction.indexOf("sessionTimeoutConfigured = true")
      < cleanupFunction.indexOf("await reserved.unsafe(\"SELECT set_config('lock_timeout'"),
    "set_config is treated as may-have-applied before awaiting its acknowledgement",
  );
  assert.ok(
    cleanupFunction.indexOf("sessionLockHeld = true")
      < cleanupFunction.indexOf("await reserved.unsafe<Array<Record<string, unknown>>>("),
    "the blocking session lock is treated as may-have-applied before awaiting its acknowledgement",
  );
  assert.ok(
    cleanupFunction.indexOf("transactionOpen = true")
      < cleanupFunction.indexOf("await reserved.unsafe(\"BEGIN ISOLATION LEVEL REPEATABLE READ\")"),
    "BEGIN is treated as may-have-applied before awaiting its acknowledgement",
  );
  assert.match(cleanupFunction,
    /reserve\(\)[\s\S]*set_config\('lock_timeout'[\s\S]*pg_advisory_lock\(hashtextextended\(\$1, 0\)\)[\s\S]*BEGIN ISOLATION LEVEL REPEATABLE READ[\s\S]*FOR UPDATE OF run[\s\S]*resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1[\s\S]*recordRecoverySourceBootstrapCleanupReceiptV1[\s\S]*COMMIT[\s\S]*releaseAuthenticatedInternalProductionRecoverySourceBootstrapErasureCompletionV1[\s\S]*pg_advisory_unlock[\s\S]*RESET lock_timeout/,
    "one reserved-session lock precedes the fresh RR snapshot and spans cleanup, durable pass, and tombstone release");
  assert.doesNotMatch(cleanupFunction, /pg_advisory_xact_lock/,
    "cleanup never acquires a stale RR snapshot while waiting on a transaction advisory lock");
  assert.match(cleanupSource,
    /crossed_cleanup_receipts[\s\S]*NOT \([\s\S]*cleanup_run_id IS NOT DISTINCT FROM id[\s\S]*cleanup_phase IS NOT DISTINCT FROM 'operations'[\s\S]*cleanup_event_type IS NOT DISTINCT FROM 'recovery-source-bootstrap[.]repository-cleanup'/,
    "nullable cleanup receipt bindings cannot suppress reconciliation through SQL three-valued comparison");
  assert.match(cleanupSource,
    /INSERT INTO public[.]run_observations[\s\S]*recovery-source-bootstrap[.]repository-cleanup[\s\S]*ON CONFLICT \(id\) DO UPDATE[\s\S]*run_observations[.]status = 'pass'/,
    "each run keeps one monotonic pass-or-retry cleanup receipt instead of an unbounded attempt log");
  assert.match(cleanupSource,
    /filesystemCensus[.]diagnostics[\s\S]*failures[.]push[\s\S]*filesystemCensus[.]runIds/,
    "unbound staging diagnostics cannot block recognized filesystem or durable cleanup candidates");
});

it("P4 terminal repository cleanup executes the exact H4, ordinary, crossed, and response-loss branches", async () => {
  const production = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-repository-cleanup-v1.ts", import.meta.url), "utf8");
  const start = production.indexOf("const RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RECEIPT_PREFIX_V1");
  assert.ok(start >= 0);
  const fixture = await mkdtemp(path.join(tmpdir(), "setfarm-p4-repository-cleanup-kernel-"));
  try {
    const modulePath = path.join(fixture, "cleanup-kernel.ts");
    await writeFile(modulePath, `
const g=globalThis as any;
const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1="/canonical/setfarm";
const getSql=()=>{const sql:any=()=>{};const field=(receipt:any,key:string,fallback:any)=>receipt&&Object.prototype.hasOwnProperty.call(receipt,key)?receipt[key]:receipt?fallback:null;const pendingMetadata=(context:string)=>JSON.stringify({completionReleased:false,runContext:context});const doneMetadata=(context:string)=>JSON.stringify({completionReleased:true,runContext:context});const metadata=(receipt:any,context:string)=>field(receipt,"metadata",pendingMetadata(context));const valid=(row:any,receipt:any)=>receipt&&receipt.id===\`internal-production-recovery-source-bootstrap-repository-cleanup-v1:\${row.id}\`&&receipt.runId===row.id&&field(receipt,"stepId","run")==="run"&&field(receipt,"storyId","")===""&&field(receipt,"phase","operations")==="operations"&&field(receipt,"checkId","recovery-source-bootstrap.repository-cleanup")==="recovery-source-bootstrap.repository-cleanup"&&field(receipt,"eventType","recovery-source-bootstrap.repository-cleanup")==="recovery-source-bootstrap.repository-cleanup"&&['pass','retry'].includes(receipt.status)&&(metadata(receipt,row.context)===pendingMetadata(row.context)||(receipt.status==='pass'&&metadata(receipt,row.context)===doneMetadata(row.context)));const project=(row:any)=>{const receipt:any=g.__p4CleanupObservations.find((entry:any)=>entry.runId===row.id);return {...row,cleanup_id:receipt?.id??null,cleanup_run_id:receipt?.runId??null,cleanup_step_id:field(receipt,"stepId","run"),cleanup_story_id:field(receipt,"storyId",""),cleanup_phase:field(receipt,"phase","operations"),cleanup_check_id:field(receipt,"checkId","recovery-source-bootstrap.repository-cleanup"),cleanup_status:receipt?.status??null,cleanup_event_type:field(receipt,"eventType","recovery-source-bootstrap.repository-cleanup"),cleanup_metadata:metadata(receipt,row.context)}};sql.begin=async(mode:string,cb:any)=>{g.__p4CleanupEvents.push(["begin",mode]);const transaction:any=async(strings:any,...values:any[])=>{g.__p4CleanupEvents.push(["select",values[0]]);g.__p4CleanupCurrentRunId=values[0];return g.__p4CleanupRows};transaction.unsafe=async(query:string,params:unknown[])=>{if(/pg_advisory_xact_lock/.test(query)){g.__p4CleanupLockCount=(g.__p4CleanupLockCount??0)+1;return []}if(/^\\s*(?:INSERT|UPDATE) (?:INTO )?public[.]run_observations/.test(query))return sql.unsafe(query,params);g.__p4CleanupCurrentRunId=params[0];g.__p4CleanupEvents.push(["select",params[0]]);return g.__p4CleanupRows.map((row:any)=>project({...row,id:params[0]}))};return await cb(transaction)};sql.unsafe=async(query:string,params:unknown[])=>{if(/^\\s*UPDATE public[.]run_observations/.test(query)){const durable=(g.__p4CleanupDurableUniverse??g.__p4CleanupDurableRows).find((row:any)=>row.id===params[1]);const context=durable?.context??g.__p4CleanupRows[0]?.context??"{}";const existing=g.__p4CleanupObservations.find((entry:any)=>entry.id===params[0]);if(!existing||existing.status!=="pass"||!valid({id:params[1],context},existing))return [];existing.metadata=doneMetadata(context);existing.updatedAt=g.__p4CleanupNowMs;return [{id:params[0],metadata:existing.metadata}];}if(/^\\s*INSERT INTO public[.]run_observations/.test(query)){const durable=(g.__p4CleanupDurableUniverse??g.__p4CleanupDurableRows).find((row:any)=>row.id===params[1]);const context=durable?.context??g.__p4CleanupRows[0]?.context??"{}";const existing=g.__p4CleanupObservations.find((entry:any)=>entry.id===params[0]);if(existing&&(!['pass','retry'].includes(existing.status)||!valid({id:params[1],context},existing)))return [];const status=existing?.status==="pass"?"pass":params[2];const completionReleased=params[4]===true;const receipt={id:params[0],runId:params[1],status,diagnostic:params[3],metadata:completionReleased?doneMetadata(context):pendingMetadata(context),updatedAt:g.__p4CleanupNowMs};if(existing)Object.assign(existing,receipt);else g.__p4CleanupObservations.push(receipt);return [{id:params[0],run_id:params[1],step_id:"run",story_id:"",phase:"operations",check_id:"recovery-source-bootstrap.repository-cleanup",status,event_type:"recovery-source-bootstrap.repository-cleanup",metadata:receipt.metadata}];}g.__p4CleanupEvents.push(["candidates"]);g.__p4CleanupCandidateParams.push(params);const byRun=new Map(g.__p4CleanupObservations.map((entry:any)=>[entry.runId,entry]));const rows=(g.__p4CleanupDurableUniverse??g.__p4CleanupDurableRows);if(/actionable_cleanup_candidates/.test(query)&&/crossed_cleanup_receipts/.test(query)){const actionable=rows.filter((row:any)=>{const receipt:any=byRun.get(row.id);return !receipt||(valid(row,receipt)&&((receipt.status==='retry'&&receipt.updatedAt<=g.__p4CleanupNowMs-300000)||(receipt.status==='pass'&&metadata(receipt,row.context)===pendingMetadata(row.context))))}).slice(0,100);const crossed=rows.filter((row:any)=>{const receipt:any=byRun.get(row.id);return receipt&&!valid(row,receipt)}).slice(0,100);return [...actionable,...crossed].map(project)}return rows.filter((row:any)=>{const receipt:any=byRun.get(row.id);return !valid(row,receipt)}).slice(0,100).map(project)};sql.reserve=async()=>{const reserved:any={release:()=>{g.__p4CleanupReservedReleaseCount=(g.__p4CleanupReservedReleaseCount??0)+1}};reserved.unsafe=async(query:string,params:unknown[]=[])=>{if(/set_config\\('lock_timeout'/.test(query))return [{}];if(/pg_advisory_lock/.test(query))return [{}];if(/^BEGIN/.test(query)){g.__p4CleanupEvents.push(["begin",query]);return []}if(/^COMMIT|^ROLLBACK|^RESET lock_timeout/.test(query))return [];if(/pg_advisory_unlock/.test(query))return [{unlocked:true}];if(/pg_terminate_backend/.test(query))return [];if(/^\\s*(?:INSERT|UPDATE) (?:INTO )?public[.]run_observations/.test(query))return sql.unsafe(query,params);g.__p4CleanupCurrentRunId=params[0];g.__p4CleanupEvents.push(["select",params[0]]);return g.__p4CleanupRows.map((row:any)=>project({...row,id:params[0]}))};return reserved};return sql};
const isInternalProductionRecoverySourceBootstrapRunContextV1=()=>g.__p4CleanupRecoveryIds instanceof Set?g.__p4CleanupRecoveryIds.has(g.__p4CleanupCurrentRunId):g.__p4CleanupRecovery;
const resolveInternalProductionRecoverySourceBootstrapRunContextBindingAuthorityV1=()=>g.__p4CleanupAuthority;
const classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1=async()=>{g.__p4CleanupEvents.push(["classify"]);if(g.__p4CleanupClassifierError)throw g.__p4CleanupClassifierError;return g.__p4CleanupDynamicRunId?{...g.__p4CleanupPersistence,runId:g.__p4CleanupCurrentRunId}:g.__p4CleanupPersistence};
const validateInternalProductionRecoverySourceBootstrapRepositoryV1=()=>{g.__p4CleanupEvents.push(["validate"]);return g.__p4CleanupAuthority.repositoryIdentity};
const resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1=()=>g.__p4CleanupStates?.[g.__p4CleanupCurrentRunId]??g.__p4CleanupState;
const listInternalProductionRecoverySourceBootstrapRepositoryCleanupCandidateRunIdsV1=()=>({runIds:g.__p4CleanupCandidates,diagnostics:g.__p4CleanupCensusDiagnostics});
const validateClaimedInternalProductionRecoverySourceBootstrapRepositoryV1=()=>{g.__p4CleanupEvents.push(["validate-claimed"]);return {...g.__p4CleanupAuthority.repositoryIdentity,repositoryRoot:"/managed/.cleanup/repository"}};
const removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1=(input:any)=>{g.__p4CleanupEvents.push(["remove",input]);if(g.__p4CleanupRemoveError)throw g.__p4CleanupRemoveError};
const releaseAuthenticatedInternalProductionRecoverySourceBootstrapErasureCompletionV1=()=>{g.__p4CleanupEvents.push(["release-completion"]);if(g.__p4CleanupReleaseError){if(g.__p4CleanupReleaseLeavesAbsent)g.__p4CleanupState="absent";throw g.__p4CleanupReleaseError}};
${production.slice(start)}
`, "utf8");
    const kernel = await import(`${pathToFileURL(modulePath).href}?cleanup=${Date.now()}`) as any;
    const runId = "1".repeat(64);
    const authority = Object.freeze({
      repositoryIdentity: Object.freeze({ sourceRepositoryRoot: "/canonical/setfarm", repositoryRoot: "/managed/repository" }),
      operation: Object.freeze({ operationRef: "operation", operationHash: "2".repeat(64), baseSourceSha: "3".repeat(40), baseSourceTreeHash: "4".repeat(40) }),
      operationRunBindingHash: "5".repeat(64),
      reciprocalRunOperationBindingHash: "6".repeat(64),
    });
    const released = Object.freeze({
      state: "released", workflowState: "completed", runId,
      operationRunBindingHash: authority.operationRunBindingHash,
      reciprocalRunOperationBindingHash: authority.reciprocalRunOperationBindingHash,
    });
    const reset = (input: Readonly<{ recovery: boolean; status?: string; persistence?: unknown; classifierError?: Error; removeError?: Error; releaseError?: Error; releaseLeavesAbsent?: boolean; cleanupState?: string }>): void => {
      Object.assign(globalThis as any, {
        __p4CleanupEvents: [], __p4CleanupRecovery: input.recovery,
        __p4CleanupCandidateParams: [],
        __p4CleanupObservations: [],
        __p4CleanupRows: [{ status: input.status ?? "completed", context: "{}" }],
        __p4CleanupAuthority: authority, __p4CleanupPersistence: input.persistence ?? released,
        __p4CleanupClassifierError: input.classifierError, __p4CleanupRemoveError: input.removeError,
        __p4CleanupReleaseError: input.releaseError, __p4CleanupReleaseLeavesAbsent: input.releaseLeavesAbsent,
        __p4CleanupState: input.cleanupState ?? "workspace",
        __p4CleanupCandidates: [runId],
        __p4CleanupCensusDiagnostics: [],
        __p4CleanupDurableRows: [],
        __p4CleanupDurableUniverse: undefined,
        __p4CleanupRecoveryIds: undefined,
        __p4CleanupStates: undefined,
        __p4CleanupDynamicRunId: false,
        __p4CleanupNowMs: Date.UTC(2026, 7, 13, 12, 0, 0),
      });
    };

    reset({ recovery: false });
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), false);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]), ["begin", "select"]);

    reset({ recovery: true, persistence: { ...released, state: "active", workflowState: "running" } });
    await assert.rejects(kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), /RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RUN_CROSSED/);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]), ["begin", "select", "classify"]);

    reset({
      recovery: true,
      status: "running",
      persistence: { ...released, state: "active", workflowState: "running" },
    });
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), false);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify"],
      "a healthy active recovery workspace is a typed nonterminal skip, not an alarming cleanup failure");
    const activeReconcile = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(activeReconcile, { scanned: 1, cleaned: 0, failed: 0, failures: [] },
      "recurring reconciliation silently skips an exact active recovery candidate");

    for (const terminalState of ["failed", "cancelled"] as const) {
      reset({
        recovery: true,
        status: terminalState,
        persistence: { ...released, workflowState: terminalState },
      });
      assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), true);
      assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
        ["begin", "select", "classify", "validate", "remove", "release-completion"],
        `a released ${terminalState} recovery clone is journal-cleaned without retaining an unbounded forensic workspace`);
    }

    reset({ recovery: true, classifierError: new Error("RECOVERY_BINDING_CROSSED") });
    await assert.rejects(kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), /RECOVERY_BINDING_CROSSED/);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]), ["begin", "select", "classify"]);

    reset({ recovery: true, removeError: new Error("RECOVERY_SOURCE_BOOTSTRAP_ERASURE_INTERRUPTED") });
    await assert.rejects(kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), /RECOVERY_SOURCE_BOOTSTRAP_ERASURE_INTERRUPTED/);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify", "validate", "remove"]);

    reset({ recovery: true, cleanupState: "claimed" });
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), true);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify", "validate-claimed", "remove", "release-completion"],
      "public H4 cleanup reauthenticates the claimed quarantine before the journaled remover resumes");

    reset({ recovery: true, cleanupState: "erasing" });
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), true);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify", "remove", "release-completion"],
      "an immutable erasure journal resumes without requiring already-erased Git or marker entries");

    reset({ recovery: true, cleanupState: "erased" });
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), true);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify", "remove", "release-completion"],
      "a durable completion tombstone is revalidated without requiring an erased repository or journal");

    reset({ recovery: true, cleanupState: "absent" });
    await assert.rejects(kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING/,
      "a completed recovery cannot hide an externally removed repository as successful cleanup without its tombstone");
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify"]);

    reset({ recovery: true, cleanupState: "absent" });
    (globalThis as any).__p4CleanupObservations = [{
      id: `internal-production-recovery-source-bootstrap-repository-cleanup-v1:${runId}`,
      runId,
      status: "pass",
      metadata: JSON.stringify({ completionReleased: false, runContext: "{}" }),
    }];
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), true);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify", "release-completion"],
      "a serialized follower durably fsyncs the already-absent tombstone parent before finalizing without a second erase");
    assert.equal(JSON.parse((globalThis as any).__p4CleanupObservations[0].metadata).completionReleased, true,
      "the post-release acknowledgement leaves no pending pass eligible to monopolize the durable cleanup quota");
    (globalThis as any).__p4CleanupEvents = [];
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), false);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify"],
      "a fully acknowledged cleanup is an idempotent no-op on every later replay");

    reset({
      recovery: true,
      cleanupState: "erased",
      releaseError: new Error("INJECT_COMPLETION_UNLINKED_PARENT_FSYNC_FAILED"),
      releaseLeavesAbsent: true,
    });
    (globalThis as any).__p4CleanupObservations = [{
      id: `internal-production-recovery-source-bootstrap-repository-cleanup-v1:${runId}`,
      runId,
      status: "pass",
      metadata: JSON.stringify({ completionReleased: false, runContext: "{}" }),
    }];
    await assert.rejects(
      kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }),
      /INJECT_COMPLETION_UNLINKED_PARENT_FSYNC_FAILED/,
      "unlink success without the parent durability acknowledgement cannot finalize the cleanup receipt",
    );
    assert.equal(JSON.parse((globalThis as any).__p4CleanupObservations[0].metadata).completionReleased, false);
    (globalThis as any).__p4CleanupReleaseError = undefined;
    (globalThis as any).__p4CleanupEvents = [];
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), true);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify", "release-completion"],
      "the next replay fsyncs the authenticated parent and only then finalizes the pending pass");
    assert.equal(JSON.parse((globalThis as any).__p4CleanupObservations[0].metadata).completionReleased, true);

    for (const persistence of [
      { ...released, runId: "9".repeat(64) },
      { ...released, operationRunBindingHash: "9".repeat(64) },
      { ...released, reciprocalRunOperationBindingHash: "9".repeat(64) },
    ]) {
      reset({ recovery: true, persistence });
      await assert.rejects(kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }),
        /RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RUN_CROSSED/);
      assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
        ["begin", "select", "classify"]);
    }

    reset({ recovery: true, removeError: new Error("RECOVERY_SOURCE_BOOTSTRAP_ERASURE_INTERRUPTED") });
    const failedReconcile = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(failedReconcile, {
      scanned: 1,
      cleaned: 0,
      failed: 1,
      failures: [{ runId, diagnostic: "Error: RECOVERY_SOURCE_BOOTSTRAP_ERASURE_INTERRUPTED" }],
    }, "the durable completed run remains a failed cleanup work item after response loss");
    reset({ recovery: true, cleanupState: "erasing" });
    const retriedReconcile = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(retriedReconcile, { scanned: 1, cleaned: 1, failed: 0, failures: [] },
      "the next recurring reconciliation resumes the journal and records successful cleanup");
    reset({ recovery: true, cleanupState: "erasing" });
    (globalThis as any).__p4CleanupCandidates = ["7".repeat(64), "8".repeat(64), runId];
    (globalThis as any).__p4CleanupDynamicRunId = true;
    const pagedReconcile = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(pagedReconcile, { scanned: 3, cleaned: 3, failed: 0, failures: [] },
      "the unfinished filesystem census cannot starve a later cleanup candidate behind historical completed rows");

    reset({ recovery: true, cleanupState: "absent" });
    (globalThis as any).__p4CleanupCandidates = [];
    (globalThis as any).__p4CleanupDurableRows = [{
      id: runId,
      context: JSON.stringify({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1" }),
      updated_at: "2026-08-13T12:00:00.000Z",
    }];
    const missingEvidenceReconcile = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(missingEvidenceReconcile, {
      scanned: 1,
      cleaned: 0,
      failed: 1,
      failures: [{ runId, diagnostic: "Error: RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING" }],
    }, "durable H4 completion cannot disappear from cleanup reconciliation when filesystem evidence is absent");

    reset({ recovery: true, cleanupState: "absent" });
    (globalThis as any).__p4CleanupCandidates = [];
    (globalThis as any).__p4CleanupDynamicRunId = true;
    (globalThis as any).__p4CleanupRecoveryIds = new Set([runId]);
    (globalThis as any).__p4CleanupDurableUniverse = [{ id: runId, context: "{}" }];
    (globalThis as any).__p4CleanupObservations = [{
      id: `internal-production-recovery-source-bootstrap-repository-cleanup-v1:${runId}`,
      runId,
      status: "retry",
      metadata: JSON.stringify({ completionReleased: false, runContext: "{}" }),
      updatedAt: (globalThis as any).__p4CleanupNowMs,
    }];
    assert.deepEqual(await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1(),
      { scanned: 0, cleaned: 0, failed: 0, failures: [] },
      "a fresh retry receipt is held behind the database-clock backoff");
    (globalThis as any).__p4CleanupNowMs += 5 * 60 * 1000 + 1;
    assert.deepEqual(await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1(), {
      scanned: 1,
      cleaned: 0,
      failed: 1,
      failures: [{ runId, diagnostic: "Error: RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING" }],
    }, "a retry becomes independently actionable after the exact five-minute database-clock interval");

    reset({ recovery: true, cleanupState: "absent" });
    (globalThis as any).__p4CleanupCandidates = [];
    (globalThis as any).__p4CleanupDynamicRunId = true;
    (globalThis as any).__p4CleanupRecoveryIds = new Set(Array.from({ length: 51 }, (_unused, index) =>
      index === 50 ? runId : (index + 52).toString(16).padStart(64, "0")));
    (globalThis as any).__p4CleanupDurableUniverse = Array.from({ length: 101 }, (_unused, index) => ({
      id: index === 100 ? runId : (index + 2).toString(16).padStart(64, "0"),
      context: JSON.stringify({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1" }),
      updated_at: new Date(Date.UTC(2026, 7, 13, 12, 0, 0) - index * 1000).toISOString(),
    }));
    const firstFailureBatch = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.equal(firstFailureBatch.scanned, 100);
    assert.equal(firstFailureBatch.failed, 50);
    assert.equal((globalThis as any).__p4CleanupObservations.length, 100,
      "ordinary false positives get terminal no-op receipts while failed recoveries get durable backoff evidence");
    const agedMissingEvidence = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(agedMissingEvidence, {
      scanned: 1,
      cleaned: 0,
      failed: 1,
      failures: [{ runId, diagnostic: "Error: RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING" }],
    }, "durable failure backoff reaches an older tombstone-free recovery across a simulated process restart");

    reset({ recovery: true, cleanupState: "workspace" });
    (globalThis as any).__p4CleanupCandidates = [];
    (globalThis as any).__p4CleanupDynamicRunId = true;
    (globalThis as any).__p4CleanupRecoveryIds = new Set([runId]);
    (globalThis as any).__p4CleanupDurableUniverse = [{ id: runId, context: "{}" }];
    (globalThis as any).__p4CleanupObservations = [{
      id: `internal-production-recovery-source-bootstrap-repository-cleanup-v1:${runId}`,
      runId,
      status: "garbage",
      diagnostic: "forged",
    }];
    const crossedReceipt = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(crossedReceipt, {
      scanned: 0,
      cleaned: 0,
      failed: 1,
      failures: [{ runId, diagnostic: "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED" }],
    }, "a same-id receipt with any non-pass/non-retry state fails closed without suppressing or executing cleanup");

    reset({ recovery: true, cleanupState: "workspace" });
    (globalThis as any).__p4CleanupCandidates = [];
    (globalThis as any).__p4CleanupDynamicRunId = true;
    (globalThis as any).__p4CleanupRecoveryIds = new Set([runId]);
    (globalThis as any).__p4CleanupDurableUniverse = [{ id: runId, context: "{\"changed\":true}" }];
    (globalThis as any).__p4CleanupObservations = [{
      id: `internal-production-recovery-source-bootstrap-repository-cleanup-v1:${runId}`,
      runId,
      status: "pass",
      metadata: JSON.stringify({ completionReleased: false, runContext: "{}" }),
    }];
    assert.deepEqual(await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1(), {
      scanned: 0,
      cleaned: 0,
      failed: 1,
      failures: [{ runId, diagnostic: "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED" }],
    }, "a stale pass receipt cannot suppress cleanup after any exact run-context authority drift");

    for (const nullableBinding of ["phase", "eventType"] as const) {
      reset({ recovery: true, cleanupState: "workspace" });
      (globalThis as any).__p4CleanupCandidates = [];
      (globalThis as any).__p4CleanupDynamicRunId = true;
      (globalThis as any).__p4CleanupRecoveryIds = new Set([runId]);
      (globalThis as any).__p4CleanupDurableUniverse = [{ id: runId, context: "{}" }];
      (globalThis as any).__p4CleanupObservations = [{
        id: `internal-production-recovery-source-bootstrap-repository-cleanup-v1:${runId}`,
        runId,
        status: "pass",
        [nullableBinding]: null,
      }];
      assert.deepEqual(
        await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1(),
        {
          scanned: 0,
          cleaned: 0,
          failed: 1,
          failures: [{ runId, diagnostic: "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED" }],
        },
        `a NULL ${nullableBinding} binding cannot hide behind SQL three-valued comparison`,
      );
    }

    reset({ recovery: true, cleanupState: "workspace" });
    (globalThis as any).__p4CleanupCandidates = [];
    (globalThis as any).__p4CleanupDynamicRunId = true;
    (globalThis as any).__p4CleanupRecoveryIds = new Set([runId]);
    const crossedRunIds = Array.from({ length: 101 }, (_unused, index) =>
      (index + 200).toString(16).padStart(64, "0"));
    (globalThis as any).__p4CleanupDurableUniverse = [
      ...crossedRunIds.map((id) => ({ id, context: "{}" })),
      { id: runId, context: "{}" },
    ];
    (globalThis as any).__p4CleanupObservations = crossedRunIds.map((id) => ({
      id: `internal-production-recovery-source-bootstrap-repository-cleanup-v1:${id}`,
      runId: id,
      status: "garbage",
    }));
    (globalThis as any).__p4CleanupCandidates = [crossedRunIds[0]];
    const independentReceiptQuotas = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.equal(independentReceiptQuotas.scanned, 1);
    assert.equal(independentReceiptQuotas.cleaned, 1);
    assert.equal(independentReceiptQuotas.failed, 100);
    assert.equal(independentReceiptQuotas.failures.every((failure: { diagnostic: string }) =>
      failure.diagnostic === "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED"), true,
    "crossed-receipt audit cannot consume the actionable cleanup quota");

    const retryRunId = "7".repeat(64);
    reset({ recovery: true, cleanupState: "erasing" });
    (globalThis as any).__p4CleanupCandidates = [retryRunId];
    (globalThis as any).__p4CleanupCensusDiagnostics = ["UNBOUND_STAGING:.staging-crash-orphan"];
    (globalThis as any).__p4CleanupDurableRows = [{
      id: runId,
      context: JSON.stringify({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1" }),
      updated_at: "2026-08-13T11:00:00.000Z",
    }];
    (globalThis as any).__p4CleanupDynamicRunId = true;
    (globalThis as any).__p4CleanupRecoveryIds = new Set([retryRunId, runId]);
    (globalThis as any).__p4CleanupStates = { [retryRunId]: "erasing", [runId]: "absent" };
    const independentCensus = await kernel.reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1();
    assert.deepEqual(independentCensus, {
      scanned: 2,
      cleaned: 1,
      failed: 2,
      failures: [
        { runId: "unbound", diagnostic: "UNBOUND_STAGING:.staging-crash-orphan" },
        { runId, diagnostic: "Error: RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING" },
      ],
    }, "one orphan staging diagnostic cannot block a journal retry or tombstone-free durable audit");

    reset({ recovery: true });
    assert.equal(await kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }), true);
    assert.deepEqual((globalThis as any).__p4CleanupEvents.map((event: unknown[]) => event[0]),
      ["begin", "select", "classify", "validate", "remove", "release-completion"]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

it("P4 active recovery final-test never checks out, merges, or pushes canonical main", () => {
  const stepOps = readFileSync(new URL("../../src/installer/step-ops.ts", import.meta.url), "utf8");
  const finalTestPreclaim = readFileSync(new URL("../../src/installer/steps/10-final-test/preclaim.ts", import.meta.url), "utf8");
  const smokeStart = stepOps.indexOf("// SMOKE TEST GUARDRAIL (final-test)");
  const mergeStart = stepOps.indexOf("// ISSUE-2 FIX: Pipeline-level feature", smokeStart);
  const mergeEnd = stepOps.indexOf("await persistCompletionContext();", mergeStart);
  const smoke = stepOps.slice(smokeStart, mergeStart);
  const merge = stepOps.slice(mergeStart, mergeEnd);
  assert.match(smoke, /isInternalProductionRecoverySourceBootstrapRunContextV1\(context\)[\s\S]*requireActiveInternalProductionRecoverySourceBootstrapRunV1/,
    "final smoke authenticates recovery before any branch synchronization decision");
  const finalPreclaimStart = finalTestPreclaim.indexOf("export async function preClaim");
  const finalPreclaim = finalTestPreclaim.slice(finalPreclaimStart);
  const preclaimRecovery = finalPreclaim.indexOf("isInternalProductionRecoverySourceBootstrapRunContextV1");
  const preclaimAuthority = finalPreclaim.indexOf("syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1", preclaimRecovery);
  const preclaimFirstWrite = Math.min(...[
    finalPreclaim.indexOf("recordStackEvidencePlanObservation"),
    finalPreclaim.indexOf("allocateRuntimePort"),
    finalPreclaim.indexOf('execFileSync("git"'),
  ].filter((index) => index >= 0));
  assert.ok(preclaimRecovery >= 0 && preclaimAuthority > preclaimRecovery && preclaimAuthority < preclaimFirstWrite,
    "final-test preclaim authenticates the recovery run before observations, runtime allocation, or Git mutation");
  assert.match(finalPreclaim,
    /if\s*\(\s*!recoveryRun\s*\)\s*\{[\s\S]*checkout[\s\S]*main[\s\S]*pull[\s\S]*origin[\s\S]*main[\s\S]*\}/,
    "only ordinary final-test preclaim checks out or pulls canonical main");
  assert.match(smoke, /if\s*\(isPrEachFinal\s*&&\s*!\s*(?:recovery|isRecovery)/,
    "recovery final smoke stays on the deterministic run branch instead of checking out main");
  const recovery = merge.indexOf("isInternalProductionRecoverySourceBootstrapRunContextV1(context)");
  const authenticate = merge.indexOf("requireActiveInternalProductionRecoverySourceBootstrapRunV1", recovery);
  const ordinary = merge.indexOf("else", authenticate);
  const firstMainMutation = Math.min(...[
    merge.indexOf('"checkout", "main"'),
    merge.indexOf('"push", "origin", "main"'),
    merge.indexOf('"pr", "merge"'),
  ].filter((index) => index >= 0));
  assert.ok(recovery >= 0 && authenticate > recovery && ordinary > authenticate && firstMainMutation > ordinary,
    "recovery final-test authenticates and exits before every main checkout, PR merge, and direct push path");
});

it("P4 active recovery synchronizes origin main without leaving its authenticated run branch", () => {
  const runtimeAuthority = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-runtime-authority-v1.ts", import.meta.url), "utf8");
  const repositorySource = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-repository-v1.ts", import.meta.url), "utf8");
  const stepOps = readFileSync(new URL("../../src/installer/step-ops.ts", import.meta.url), "utf8");
  const stepAdvance = readFileSync(new URL("../../src/installer/step-advance.ts", import.meta.url), "utf8");
  const qaPreclaim = readFileSync(new URL("../../src/installer/steps/09-qa-test/preclaim.ts", import.meta.url), "utf8");
  const finalPreclaim = readFileSync(new URL("../../src/installer/steps/10-final-test/preclaim.ts", import.meta.url), "utf8");
  const verifyPrompt = readFileSync(new URL("../../src/installer/steps/07-verify/prompt.md", import.meta.url), "utf8");
  const qaPrompt = readFileSync(new URL("../../src/installer/steps/09-qa-test/prompt.md", import.meta.url), "utf8");
  const finalPrompt = readFileSync(new URL("../../src/installer/steps/10-final-test/prompt.md", import.meta.url), "utf8");
  const syncStart = runtimeAuthority.indexOf("export async function syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1");
  assert.ok(syncStart >= 0, "runtime authority exports one active recovery branch synchronization port");
  const syncRegion = runtimeAuthority.slice(syncStart);
  assert.match(syncRegion,
    /requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1[\s\S]*syncInternalProductionRecoverySourceBootstrapRepositoryToOriginMainV1[\s\S]*requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1/,
    "branch synchronization requires running/resuming authority before Git mutation and reauthenticates after every awaited boundary");
  const implementationSync = stepOps.slice(
    stepOps.indexOf("syncBeforePin:"),
    stepOps.indexOf("const requestedBaseRef", stepOps.indexOf("syncBeforePin:")),
  );
  assert.match(implementationSync,
    /isInternalProductionRecoverySourceBootstrapRunContextV1\(context\)[\s\S]*syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1[\s\S]*else if\s*\(\s*!syncBaseBranch\(repo,\s*["']main["']\)/,
    "implement preclaim uses authenticated run-branch fast-forward while ordinary runs retain generic main synchronization");
  const completionSetup = stepOps.slice(
    stepOps.indexOf("const isRecoverySetupBuildCompletion"),
    stepOps.indexOf("// DB Auto-Provisioning", stepOps.indexOf("const isRecoverySetupBuildCompletion")),
  );
  assert.match(completionSetup,
    /isRecoverySetupRepoCompletion[\s\S]*requireActiveInternalProductionRecoverySourceBootstrapRunV1[\s\S]*!isRecoverySetupModuleCompletion[\s\S]*_stepModule\.onComplete/,
    "setup-repo completion reauthenticates recovery and bypasses generic module side effects before dispatch");
  assert.match(stepOps,
    /async function syncRunBaseBranchV1[\s\S]*isInternalProductionRecoverySourceBootstrapRunContextV1\(context\)[\s\S]*syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1[\s\S]*return syncBaseBranch\(repoPath,\s*["']main["']\)/,
    "every verify and smoke path shares the same recovery-aware base synchronization decision");
  assert.ok((stepOps.match(/await syncRunBaseBranchV1\(/g) ?? []).length >= 4,
    "all post-merge, confirm-smoke, and auto-verify root synchronization sites use the recovery-aware helper");
  const verifyPreflight = stepOps.slice(stepOps.indexOf("// ═══ VERIFY PRE-FLIGHT"), stepOps.indexOf("// ═══", stepOps.indexOf("// ═══ VERIFY PRE-FLIGHT") + 10));
  assert.match(verifyPreflight, /const repoPath = context\["story_workdir"\] \|\| context\["repo"\]/,
    "verify preflight analyzes the owned story worktree instead of checking its branch out in the recovery root");
  assert.match(stepAdvance,
    /async function runMedicAutoVerifySmokeGate[\s\S]*syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1[\s\S]*else[\s\S]*syncBaseBranch\(repoPath,\s*["']main["']\)/,
    "medic smoke uses authenticated recovery synchronization while ordinary runs retain main sync");
  const medicAdvance = stepAdvance.slice(
    stepAdvance.indexOf("export async function autoVerifyAndAdvance"),
  );
  assert.match(medicAdvance,
    /JSON[.]parse\(ctxRow[.]context\)[\s\S]*catch[\s\S]*return false[\s\S]*if\s*\(\s*!repoPath\s*\)[\s\S]*return false/,
    "medic refuses malformed or repository-less run context instead of force-verifying without a smoke boundary");
  for (const [name, source] of [["qa", qaPreclaim], ["final", finalPreclaim]] as const) {
    const preclaim = source.slice(source.indexOf("export async function preClaim"));
    const recovery = preclaim.indexOf("isInternalProductionRecoverySourceBootstrapRunContextV1");
    const sync = preclaim.indexOf("syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1", recovery);
    const firstWrite = Math.min(...[
      preclaim.indexOf("recordStackEvidencePlanObservation"),
      preclaim.indexOf("allocateRuntimePort"),
      preclaim.indexOf('execFileSync("git"'),
    ].filter((index) => index >= 0));
    assert.ok(recovery >= 0 && sync > recovery && sync < firstWrite,
      `${name} preclaim authenticates and synchronizes recovery before observations, runtime allocation, or Git mutation`);
    assert.match(preclaim, /if\s*\(\s*!recoveryRun\s*\)[\s\S]*checkout[\s\S]*main[\s\S]*pull[\s\S]*origin[\s\S]*main/,
      `${name} keeps direct main checkout and pull inside the ordinary-only branch`);
  }
  assert.match(repositorySource,
    /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDE_V1[\s\S]*quality-reports\/qa-test-1\.md[\s\S]*quality-reports\/qa-test-1\.json[\s\S]*quality-reports\/final-test-1\.json[\s\S]*smoke-home\.png[\s\S]*smoke-after-click\.png[\s\S]*RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDE_CROSSED/,
    "the isolated clone authenticates one finite local exclude for Setfarm-owned QA and smoke artifacts only");
  for (const [name, prompt] of [["verify", verifyPrompt], ["qa", qaPrompt], ["final", finalPrompt]] as const) {
    assert.doesNotMatch(prompt, /git checkout main|git pull --ff-only origin main/,
      `${name} agent prompt cannot undo Setfarm-owned recovery branch authority`);
  }
  assert.doesNotMatch(verifyPrompt,
    /update local `main`|final `main` update|final `main` refresh|local `main`\s+has been updated|git switch(?:\s+-\S+)*\s+main|git reset[^\n]*main|update-ref[^\n]*refs\/heads\/main/i,
    "verify cannot claim or request a canonical-main mutation that belongs to Setfarm's authenticated synchronizer");
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

it("P4 recovery artifacts cross the repository boundary only through the six-target publisher", () => {
  const repositorySource = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-repository-v1.ts", import.meta.url), "utf8");
  const runtimeAuthoritySource = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-runtime-authority-v1.ts", import.meta.url), "utf8");
  const runtimePortsSource = readFileSync(new URL("../../src/installer/runtime-ports.ts", import.meta.url), "utf8");
  const qaSource = readFileSync(new URL("../../src/installer/steps/09-qa-test/preclaim.ts", import.meta.url), "utf8");
  const finalSource = readFileSync(new URL("../../src/installer/steps/10-final-test/preclaim.ts", import.meta.url), "utf8");
  const smokeSource = readFileSync(new URL("../../scripts/smoke-test.mjs", import.meta.url), "utf8");
  assert.match(repositorySource,
    /AUTHENTICATED_RECOVERY_REPOSITORY_ARTIFACT_PUBLISHER_V1[\s\S]*O_CREAT[\s\S]*O_EXCL[\s\S]*O_NOFOLLOW[\s\S]*fsyncSync[\s\S]*renameSync[\s\S]*fsyncSync/,
    "the fixed publisher uses no-follow private staging, atomic replacement, and file plus parent durability");
  assert.match(repositorySource,
    /publishAuthenticatedInternalProductionRecoverySourceBootstrapArtifactV1[\s\S]*RECOVERY_SOURCE_BOOTSTRAP_EXACT_ARTIFACTS_V1[\s\S]*recoveryRepositoryArtifactSandboxProfileV1/,
    "the public publisher derives only a fixed artifact locator under the authenticated repository and Seatbelt parent");
  assert.match(repositorySource,
    /parentBeforeRename[\s\S]*rootBeforeRename[\s\S]*namedParent[\s\S]*renameSync\(temp, target\)[\s\S]*parentAfter[\s\S]*rootAfter/,
    "the fixed child pins and rechecks the root plus direct parent around its only atomic target replacement");
  assert.match(runtimeAuthoritySource,
    /publishActiveInternalProductionRecoverySourceBootstrapArtifactV1[\s\S]*requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1[\s\S]*publishAuthenticatedInternalProductionRecoverySourceBootstrapArtifactV1[\s\S]*requireMutationActiveInternalProductionRecoverySourceBootstrapRunV1/,
    "every recovery artifact publication reauthenticates the mutation authority before and after the write");
  assert.match(runtimeAuthoritySource,
    /decodeInternalProductionRecoverySourceBootstrapScreenshotFramesV1[\s\S]*contentBase64[\s\S]*byteLength[\s\S]*contentHash/,
    "the dedicated screenshot pipe decoder authenticates bounded PNG bytes rather than trusting a filesystem locator");
  assert.match(runtimeAuthoritySource,
    /createInternalProductionRecoverySourceBootstrapSmokeEnvironmentV1[\s\S]*NODE_OPTIONS[\s\S]*NODE_PATH[\s\S]*startsWith\("AGENT_BROWSER_"\)[\s\S]*SETFARM_RECOVERY_AGENT_BROWSER_PATH/,
    "the recovery smoke child discards Node injection and ambient browser routing before receiving one exact executable and fresh namespace");
  assert.match(runtimePortsSource, /createRunRuntimeArtifactV1[\s\S]*\.setfarm\/run-runtime[.]json/,
    "runtime artifact bytes can be routed through the recovery publisher without changing ordinary output");
  for (const source of [qaSource, finalSource]) {
    assert.match(source, /publishActiveInternalProductionRecoverySourceBootstrapArtifactV1/,
      "QA and final-test publish their recovery reports through the active authority wrapper");
    assert.match(source, /spawnSync[\s\S]*stdio:\s*\["pipe",\s*"pipe",\s*"pipe",\s*"pipe"\]/,
      "QA and final-test transport recovery screenshot bytes on a dedicated inherited pipe");
    assert.match(source, /decodeInternalProductionRecoverySourceBootstrapScreenshotFramesV1/,
      "QA and final-test authenticate the dedicated screenshot pipe before publication");
  }
  assert.match(smokeSource,
    /captureRecoveryScreenshotBytes[\s\S]*get[\s\S]*cdp-url[\s\S]*Target[.]getTargets[\s\S]*Target[.]attachToTarget[\s\S]*Runtime[.]evaluate[\s\S]*Page[.]captureScreenshot[\s\S]*Target[.]getTargetInfo/,
    "recovery smoke captures one stable current page through loopback CDP without a screenshot pathname");
  assert.match(smokeSource, /emitRecoveryScreenshotEnvelope[\s\S]*writeFileSync\(3/,
    "recovery smoke emits the authenticated byte frames on its dedicated inherited descriptor");
  const recoveryCaptureStart = smokeSource.indexOf("// AUTHENTICATED_RECOVERY_CDP_SCREENSHOT_V1:start");
  const recoveryCaptureEnd = smokeSource.indexOf("// AUTHENTICATED_RECOVERY_CDP_SCREENSHOT_V1:end", recoveryCaptureStart);
  assert.ok(recoveryCaptureStart >= 0 && recoveryCaptureEnd > recoveryCaptureStart);
  assert.doesNotMatch(smokeSource.slice(recoveryCaptureStart, recoveryCaptureEnd), /agent-browser[^\n]*screenshot|--screenshot-dir/,
    "the recovery screenshot branch never asks the persistent daemon to write a pathname");
});

it("P4 recovery screenshot pipe authenticates exact ordered PNG frames", async () => {
  const runtimeAuthority = await import("../../src/execution/recovery-source-bootstrap-runtime-authority-v1.js");
  const decode = Reflect.get(runtimeAuthority, "decodeInternalProductionRecoverySourceBootstrapScreenshotFramesV1");
  assert.equal(typeof decode, "function");
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("setfarm-recovery-cdp-screenshot", "utf8"),
  ]);
  const frame = (relativePath: string, bytes = png) => ({
    relativePath,
    byteLength: bytes.length,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    contentBase64: bytes.toString("base64"),
  });
  const encode = (screenshots: readonly unknown[]) => Buffer.from(JSON.stringify({
    schema: "setfarm.internal-production-recovery-smoke-screenshots.v1",
    screenshots,
  }), "utf8");
  assert.deepEqual(decode(encode([frame("smoke-home.png"), frame("smoke-after-click.png")])), [
    { relativePath: "smoke-home.png", bytes: png },
    { relativePath: "smoke-after-click.png", bytes: png },
  ]);
  assert.deepEqual(decode(encode([frame("smoke-after-click.png")])), [
    { relativePath: "smoke-after-click.png", bytes: png },
  ], "a failed home capture does not discard a later authenticated after-click frame");
  assert.deepEqual(decode(encode([])), [], "an early or screenshot-free smoke exit carries an exact empty envelope");
  for (const crossed of [
    [frame("smoke-home.png"), frame("smoke-after-click.png"), frame("smoke-after-click.png")],
    [frame("smoke-after-click.png"), frame("smoke-home.png")],
    [frame("smoke-home.png"), frame("smoke-home.png")],
    [{ ...frame("smoke-home.png"), contentHash: "0".repeat(64) }],
    [{ ...frame("smoke-home.png"), byteLength: png.length + 1 }],
    [frame("foreign.png")],
  ]) assert.throws(() => decode(encode(crossed)), /RECOVERY_SOURCE_BOOTSTRAP_SCREENSHOT_FRAMES_CROSSED/);
  const canonicalFrame = frame("smoke-home.png");
  for (const crossedDocument of [
    Buffer.from(`{"screenshots":[${JSON.stringify(canonicalFrame)}],"schema":"setfarm.internal-production-recovery-smoke-screenshots.v1"}`),
    Buffer.from(`{"schema":"crossed","schema":"setfarm.internal-production-recovery-smoke-screenshots.v1","screenshots":[]}`),
    Buffer.from(`${encode([]).toString("utf8")}\n`),
  ]) assert.throws(() => decode(crossedDocument), /RECOVERY_SOURCE_BOOTSTRAP_SCREENSHOT_FRAMES_CROSSED/);

  const smokeEnvironment = runtimeAuthority.createInternalProductionRecoverySourceBootstrapSmokeEnvironmentV1({
    ...process.env,
    NODE_OPTIONS: "--require=/tmp/crossed.js",
    NODE_PATH: "/tmp/crossed-node-path",
    DYLD_INSERT_LIBRARIES: "/tmp/crossed.dylib",
    AGENT_BROWSER_CDP: "ws://example.com/crossed",
    AGENT_BROWSER_CONFIG: "/tmp/crossed-config.json",
    HTTPS_PROXY: "http://example.com:8080",
    no_proxy: "example.com",
  });
  assert.equal(smokeEnvironment.NODE_OPTIONS, undefined);
  assert.equal(smokeEnvironment.NODE_PATH, undefined);
  assert.equal(smokeEnvironment.DYLD_INSERT_LIBRARIES, undefined);
  assert.equal(smokeEnvironment.AGENT_BROWSER_CDP, undefined);
  assert.equal(smokeEnvironment.HTTPS_PROXY, undefined);
  assert.equal(smokeEnvironment.no_proxy, undefined);
  assert.match(smokeEnvironment.AGENT_BROWSER_NAMESPACE ?? "", /^setfarm-recovery-[a-f0-9]{64}$/);
  assert.equal(smokeEnvironment.AGENT_BROWSER_IDLE_TIMEOUT_MS, "300000");
  assert.equal(readFileSync(smokeEnvironment.AGENT_BROWSER_CONFIG!, "utf8"), "{}\n");
  assert.equal(path.isAbsolute(smokeEnvironment.SETFARM_RECOVERY_AGENT_BROWSER_PATH!), true);

  const smokeScript = fileURLToPath(new URL("../../scripts/smoke-test.mjs", import.meta.url));
  const early = spawnSync(process.execPath, [smokeScript, "", "--recovery-byte-screenshots"], {
    env: smokeEnvironment,
    encoding: null,
    stdio: ["pipe", "pipe", "pipe", "pipe"],
    timeout: 10_000,
  });
  assert.equal(early.status, 2);
  assert.deepEqual(decode(Buffer.isBuffer(early.output?.[3]) ? early.output[3] : Buffer.alloc(0)), [],
    "an early launched-child exit still closes fd3 with one exact empty envelope");
});

it("P4 recovery source bootstrap persistence isolates the repository before exact35 bind and commit withholding", async () => {
  const production = readFileSync(new URL("../../src/execution/run-persistence.ts", import.meta.url), "utf8");
  const start = production.indexOf("const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1");
  const end = production.indexOf("export async function persistInternalProductionRecoverySourceBootstrapRunV1", start);
  const publicEnd = production.indexOf("\n}", end) + 2;
  assert.ok(start >= 0 && end > start && publicEnd > end);
  const fixture = await mkdtemp(path.join(tmpdir(), "setfarm-p4-source-bootstrap-persistence-"));
  let managedWorkspaceRoot: string | undefined;
  try {
    const canonicalRepo = fixture;
    const bareOrigin = path.join(fixture, "origin.git");
    const git = (args: string[], cwd = canonicalRepo): string => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    await mkdir(path.join(canonicalRepo, "seed"), { recursive: true });
    await writeFile(path.join(canonicalRepo, ".gitignore"), "seed-ignore\n");
    await writeFile(path.join(canonicalRepo, "seed", "README.md"), "canonical recovery source\n");
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "setfarm-test@example.invalid"]);
    git(["config", "user.name", "Setfarm Test"]);
    git(["add", ".gitignore", "seed/README.md"]);
    git(["commit", "-qm", "canonical recovery source"]);
    execFileSync("git", ["init", "--bare", "-q", bareOrigin]);
    git(["remote", "add", "origin", "origin.git"]);
    git(["push", "-q", "-u", "origin", "main"]);
    const canonicalBranch = git(["branch", "--show-current"]);
    const canonicalIndex = git(["write-tree"]);
    const canonicalIgnore = readFileSync(path.join(canonicalRepo, ".gitignore"));
    const canonicalMain = git(["rev-parse", "refs/remotes/origin/main"]);
    const canonicalOrigin = git(["remote", "get-url", "origin"]);
    const isolatedOrigin = realpathSync(bareOrigin);
    const baseSourceSha = git(["rev-parse", "HEAD"]);
    const baseSourceTreeHash = git(["rev-parse", "HEAD^{tree}"]);
    const execution = path.join(fixture, "src/execution");
    await mkdir(execution, { recursive: true });
    const authorityModule = await import("../../src/execution/recovery-source-bootstrap-run-authority-v1.js");
    const repositoryModule = await import("../../src/execution/recovery-source-bootstrap-repository-v1.js");
    const modulePath = path.join(execution, "run-persistence-kernel.ts");
    await writeFile(modulePath, `
import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
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
const resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1=(input:any)=>g.__p4ResolveRepositoryIdentity(input);
const prepareInternalProductionRecoverySourceBootstrapRepositoryV1=(input:any)=>{g.__p4PersistLedger.push("workspace");return g.__p4PrepareRepository(input)};
const validateInternalProductionRecoverySourceBootstrapRepositoryV1=(input:any)=>g.__p4ValidateRepository(input);
const createInternalProductionRecoverySourceBootstrapRunContextV1=(operation:any,input:any)=>g.__p4CreateRunContext(operation,input);
const bindInternalProductionRecoverySourceBootstrapRunInTransactionV1=async(_sql:any,input:any)=>{g.__p4PersistLedger.push("bind");const context=JSON.parse(g.__p4PersistTx.runs[input.runId].context);if(Object.keys(context).length!==35)throw new Error("EXACT35_CONTEXT_REQUIRED");if(context.branch!==input.runId||context.ownerAdmissionFenceRef!==g.__p4PersistOperation.ownerAdmissionFenceRef||context.ownerAdmissionFenceHash!==g.__p4PersistOperation.ownerAdmissionFenceHash)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_RUNTIME_IDENTITY_CROSSED");if(g.__p4PersistTx.steps.length!==g.__p4PersistWorkflow.steps.length)throw new Error("EXACT_STEPS_REQUIRED");return {runOwnerReservationRef:g.__p4PersistOperation.targetRunReservationRef,runOwnerReservationHash:g.__p4PersistOperation.targetRunReservationHash}};
const readDatabaseWallClock=async()=>{g.__p4PersistLedger.push("clock");return new Date("2026-08-26T12:00:00.000Z")};
const persistedWorkflowRunResultV1=(row:any,pair:any)=>({run:{id:row.id,runNumber:row.run_number,workflowId:row.workflow_id,task:row.task,status:"running",context:row.context,notifyUrl:row.notify_url,protocol:row.protocol,protocolVersion:row.protocol_version,compilerReleaseSha:row.compiler_release_sha,activationPreflightHash:row.activation_preflight_hash,releaseAdmissionHash:row.release_admission_hash,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()},...pair});
const pgBegin=async(cb:any)=>{const prior=structuredClone(g.__p4PersistState);const tx=structuredClone(prior);g.__p4PersistTx=tx;const sql:any={unsafe:async(q:string,p:any[]=[])=>{if(q.includes("FROM runs")&&q.includes("FOR UPDATE")){g.__p4PersistLedger.push("select-run");return tx.runs[p[0]]?[tx.runs[p[0]]]:[]}if(q.includes("nextval")){g.__p4PersistLedger.push("nextval");return [{next:41}]}if(q.includes("INSERT INTO runs")){g.__p4PersistLedger.push("insert-run");tx.runs[p[0]]={id:p[0],run_number:p[1],workflow_id:"feature-dev",task:p[2],status:"running",context:p[3],notify_url:null,protocol:"v3",protocol_version:1,compiler_release_sha:p[4],activation_preflight_hash:p[5],release_admission_hash:p[6],created_at:p[7],updated_at:p[7]};return []}if(q.includes("INSERT INTO steps")){g.__p4PersistLedger.push("insert-step");tx.steps.push({id:p[0],run_id:p[1],step_id:p[2],agent_id:p[3],step_index:p[4],input_template:p[5],expects:p[6],status:p[7],max_retries:p[8],type:p[9],loop_config:p[10],created_at:p[11],updated_at:p[11]});return []}if(q.includes("FROM steps")){g.__p4PersistLedger.push("select-steps");return tx.steps}throw new Error("UNEXPECTED_SQL:"+q)}};const value=await cb(sql);if(g.__p4PersistRejectCommit)throw new Error("INJECT_COMMIT_ACK_LOSS");g.__p4PersistState=tx;g.__p4PersistLedger.push("commit");return value};
${production.slice(start, publicEnd)}
export function p4State(){return structuredClone(g.__p4PersistState)}
`, "utf8");
    const kernel = await import(`${pathToFileURL(modulePath).href}?p4=${Date.now()}`) as any;
    const sha = (member: string) => member.repeat(64);
    const pendingInputHash = sha("5");
    const targetSourceRunReservationHash = sha("9");
    const targetRunReservationHash = sha("a");
    const ownerAdmissionFenceHash = sha("e");
    const startIntentHash = sha("6");
    const startOutboxHash = sha("7");
    const operationBody = {
      schema: "setfarm.internal-production-recovery-source-bootstrap-operation.v1",
      purpose: "recovery-d-source-delivery-v1", repository: "setfarm", workflow: "feature-dev", protocol: "v3",
      promptManifestHash: hashCanonicalJson({ schema: "setfarm.internal-production-recovery-source-bootstrap-prompt-manifest.v1", planPath: "docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md", taskOrdinals: [1, 2], task: "Implement Tasks 1 and 2 from docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md exactly as written." }),
      pendingInputRef: `setfarm://internal-production/recovery-source-bootstrap-pending-input/sha256/${pendingInputHash}`,
      pendingInputHash, baseSourceSha, baseSourceTreeHash, buildHash: sha("1"), activationPreflightHash: sha("2"), releaseAdmissionHash: sha("3"),
      targetSourceRunReservationRef: `setfarm://internal-production/owner-reservations/${targetSourceRunReservationHash}`,
      targetSourceRunReservationHash,
      targetRunReservationRef: `setfarm://internal-production/owner-reservations/${targetRunReservationHash}`,
      targetRunReservationHash, targetRunLaunchCompositeHash: sha("b"),
      ownerAdmissionFenceRef: `setfarm://internal-production/global-owner-admission-fence/sha256/${ownerAdmissionFenceHash}`,
      ownerAdmissionFenceHash,
      startIntentRef: `setfarm://internal-production/recovery-source-bootstrap-start-intent/sha256/${startIntentHash}`,
      startIntentHash,
      startOutboxRef: `setfarm://internal-production/recovery-source-bootstrap-start-outbox/sha256/${startOutboxHash}`,
      startOutboxHash,
    };
    const operationHash = hashCanonicalJson(operationBody);
    const operation = Object.freeze({
      ...operationBody,
      operationRef: `setfarm://internal-production/recovery-source-bootstrap-operation/sha256/${operationHash}`,
      operationHash,
    });
    const runId = hashCanonicalJson({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1", pendingInputRef: operation.pendingInputRef, pendingInputHash: operation.pendingInputHash });
    const protocol = { protocol: "v3", compilerReleaseSha: operation.baseSourceSha, baseSourceTreeHash: operation.baseSourceTreeHash, buildHash: operation.buildHash, activationPreflightHash: operation.activationPreflightHash, releaseAdmissionHash: operation.releaseAdmissionHash, protocolVersion: 1, releaseAdmissionKind: "release_go" };
    const workflow = { id: "feature-dev", context: {}, steps: [{ id: "plan", agent: "planner", input: "plan", expects: "plan" }, { id: "build", agent: "developer", input: "build", expects: "code", max_retries: 1 }] };
    const runOwnerRef = `setfarm://runs/${encodeURIComponent(runId)}`;
    const runOwnerHash = hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId });
    const operationRunBindingHash = hashCanonicalJson({
      schema: "setfarm.internal-production-recovery-source-bootstrap-operation-run-binding.v1",
      operationRef: operation.operationRef, operationHash: operation.operationHash,
      targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
      sourceRunReservationRef: operation.targetSourceRunReservationRef, sourceRunReservationHash: operation.targetSourceRunReservationHash,
      sourceRunOwnerRef: operation.operationRef, sourceRunOwnerHash: operation.operationHash,
      runReservationRef: operation.targetRunReservationRef, runReservationHash: operation.targetRunReservationHash,
      runId, runOwnerRef, runOwnerHash,
    });
    const reciprocalRunOperationBindingHash = hashCanonicalJson({
      schema: "setfarm.internal-production-recovery-source-bootstrap-run-operation-binding.v1",
      runId, runOwnerRef, runOwnerHash,
      runReservationRef: operation.targetRunReservationRef, runReservationHash: operation.targetRunReservationHash,
      operationRef: operation.operationRef, operationHash: operation.operationHash,
      sourceRunOwnerRef: operation.operationRef, sourceRunOwnerHash: operation.operationHash,
      sourceRunReservationRef: operation.targetSourceRunReservationRef, sourceRunReservationHash: operation.targetSourceRunReservationHash,
      targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash, operationRunBindingHash,
    });
    const authority = { runId, operationRef: operation.operationRef, operationHash: operation.operationHash, activationPreflightHash: operation.activationPreflightHash, releaseAdmissionHash: operation.releaseAdmissionHash, operationRunBindingHash, reciprocalRunOperationBindingHash };
    Object.assign(globalThis as any, { __p4PersistOperation: operation, __p4PersistProtocol: protocol, __p4PersistWorkflow: workflow, __p4PersistAuthority: authority, __p4PersistState: { runs: {}, steps: [] }, __p4PersistLedger: [], __p4PersistRejectCommit: false, __p4CreateRunContext: authorityModule.createInternalProductionRecoverySourceBootstrapRunContextV1, __p4ResolveRepositoryIdentity: repositoryModule.resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1, __p4PrepareRepository: repositoryModule.prepareInternalProductionRecoverySourceBootstrapRepositoryV1, __p4ValidateRepository: repositoryModule.validateInternalProductionRecoverySourceBootstrapRepositoryV1 });
    const raceIdentity = repositoryModule.resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1({ sourceRepositoryRoot: canonicalRepo, runId });
    managedWorkspaceRoot = raceIdentity.workspaceRoot;
    const gitWrapperDirectory = path.join(fixture, "git-wrapper");
    await mkdir(gitWrapperDirectory, { recursive: true });
    const actualGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
    await writeFile(path.join(gitWrapperDirectory, "git"), `#!/bin/sh\nif [ "$1" = "clone" ]; then mkdir -p "$P4_RACE_TARGET"; fi\nexec "${actualGit}" "$@"\n`, { mode: 0o755 });
    const priorPath = process.env.PATH;
    process.env.PATH = `${gitWrapperDirectory}:${priorPath || ""}`;
    process.env.P4_RACE_TARGET = raceIdentity.workspaceRoot;
    try {
      await assert.rejects(
        kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash }),
        /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_(?:WORKSPACE_CROSSED|CLAIM_CROSSED)/,
        "an empty target created after the initial absence check cannot be replaced by rename",
      );
    } finally {
      process.env.PATH = priorPath;
      delete process.env.P4_RACE_TARGET;
    }
    assert.deepEqual(readdirSync(raceIdentity.workspaceRoot), [], "the foreign empty target remains untouched");
    await rm(raceIdentity.workspaceRoot, { recursive: true, force: true });
    const repositorySourceBeforePersistence = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-repository-v1.ts", import.meta.url), "utf8");
    const prepareStart = repositorySourceBeforePersistence.indexOf("export function prepareInternalProductionRecoverySourceBootstrapRepositoryV1");
    const prepareRegion = repositorySourceBeforePersistence.slice(prepareStart);
    assert.match(prepareRegion, /let\s+publicationStarted\s*=\s*false[\s\S]*mkdirSync\(identity\.workspaceRoot[\s\S]*publicationStarted\s*=\s*true[\s\S]*if\s*\(publicationStarted\)[\s\S]*RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_PUBLICATION_INCOMPLETE[\s\S]*if\s*\(\s*!publicationStarted\s*&&[\s\S]*rmSync\(stagingRoot/,
      "an incomplete deterministic publication preserves its authority-bearing staging tree and fails closed for explicit recovery");
    (globalThis as any).__p4PersistLedger = [];
    const persisted = await kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash });
    assert.equal(persisted.run.id, runId);
    const ledger = (globalThis as any).__p4PersistLedger as string[];
    assert.deepEqual(ledger, ["lock", "select-run", "workspace", "nextval", "clock", "insert-run", "insert-step", "insert-step", "bind", "select-run", "select-steps", "commit"]);
    const persistedContext = JSON.parse(persisted.run.context);
    assert.equal(Object.keys(persistedContext).length, 35);
    assert.notEqual(persistedContext.repo, realpathSync(canonicalRepo));
    const isolatedRepo = realpathSync(String(persistedContext.repo));
    managedWorkspaceRoot = path.dirname(isolatedRepo);
    assert.equal(git(["rev-parse", "--show-toplevel"], isolatedRepo), isolatedRepo);
    assert.equal(lstatSync(path.join(isolatedRepo, ".git")).isDirectory(), true, "recovery uses an independent clone rather than a linked worktree sharing refs and config");
    assert.equal(git(["rev-parse", "HEAD"], isolatedRepo), baseSourceSha);
    assert.equal(git(["rev-parse", "HEAD^{tree}"], isolatedRepo), baseSourceTreeHash);
    assert.equal(git(["branch", "--show-current"], isolatedRepo), runId);
    assert.equal(git(["remote", "get-url", "origin"], isolatedRepo), isolatedOrigin,
      "relative filesystem origins are normalized against the canonical source repository before entering the isolated clone");
    const validateRepository = Reflect.get(repositoryModule, "validateInternalProductionRecoverySourceBootstrapRepositoryV1");
    assert.equal(typeof validateRepository, "function", "setup and cleanup paths share the same fail-closed managed repository validator");
    assert.deepEqual(validateRepository({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      baseSourceSha,
      baseSourceTreeHash,
    }), (globalThis as any).__p4ResolveRepositoryIdentity({ sourceRepositoryRoot: canonicalRepo, runId }));
    const validateSetupBaseline = Reflect.get(repositoryModule, "validateInternalProductionRecoverySourceBootstrapSetupBaselineV1");
    assert.equal(typeof validateSetupBaseline, "function", "setup-build owns a tracked-clean base-authority validator before any main publication decision");
    assert.deepEqual(validateSetupBaseline({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      baseSourceSha,
      baseSourceTreeHash,
    }), (globalThis as any).__p4ResolveRepositoryIdentity({ sourceRepositoryRoot: canonicalRepo, runId }));
    assert.equal(persistedContext.branch, runId);
    assert.equal(persistedContext.baseSourceSha, baseSourceSha);
    assert.equal(persistedContext.baseSourceTreeHash, baseSourceTreeHash);
    assert.equal(persistedContext.ownerAdmissionFenceRef, operation.ownerAdmissionFenceRef);
    assert.equal(persistedContext.ownerAdmissionFenceHash, operation.ownerAdmissionFenceHash);
    const resolveContextAuthority = Reflect.get(authorityModule, "resolveInternalProductionRecoverySourceBootstrapRunContextAuthorityV1");
    assert.equal(typeof resolveContextAuthority, "function", "setup boundaries authenticate recovery context before choosing their special path");
    const contextAuthority = resolveContextAuthority({ sourceRepositoryRoot: canonicalRepo, runId, context: persistedContext });
    assert.deepEqual(contextAuthority.operation, operation);
    assert.equal(contextAuthority.repositoryIdentity.repositoryRoot, isolatedRepo);
    assert.equal(contextAuthority.operationRunBindingHash, operationRunBindingHash);
    assert.equal(contextAuthority.reciprocalRunOperationBindingHash, reciprocalRunOperationBindingHash);
    const requireSetupAuthority = Reflect.get(authorityModule, "requireExactInternalProductionRecoverySourceBootstrapSetupAuthorityV1");
    const requireActiveRunAuthority = Reflect.get(authorityModule, "requireExactInternalProductionRecoverySourceBootstrapActiveRunAuthorityV1");
    assert.equal(typeof requireActiveRunAuthority, "function", "post-setup recovery gates share exact context and active durable-run authority without requiring a clean base");
    assert.equal(typeof requireSetupAuthority, "function", "setup boundaries share one exact context, persistence, and clean-repository authority validator");
    const activePersistence = Object.freeze({
      state: "active" as const,
      workflowState: "running" as const,
      runId,
      operationRunBindingHash,
      reciprocalRunOperationBindingHash,
    });
    assert.deepEqual(requireSetupAuthority({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      context: persistedContext,
      persistence: activePersistence,
    }), contextAuthority);
    assert.throws(() => requireSetupAuthority({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      context: persistedContext,
      persistence: { ...activePersistence, state: "released" },
    }), /RECOVERY_SOURCE_BOOTSTRAP_SETUP_RUN_NOT_ACTIVE/,
    "setup refuses a terminal or released durable recovery run before repository mutation");
    assert.throws(() => requireSetupAuthority({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      context: persistedContext,
      persistence: { ...activePersistence, operationRunBindingHash: "0".repeat(64) },
    }), /RECOVERY_SOURCE_BOOTSTRAP_SETUP_RUN_CROSSED/,
    "setup cross-binds the durable active run to the context authority");
    assert.throws(() => resolveContextAuthority({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      context: { ...persistedContext, operationRunBindingHash: "0".repeat(64) },
    }), /RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_CROSSED/,
    "context authority recomputes the operation-to-run binding instead of trusting a formatted hash");
    assert.throws(() => resolveContextAuthority({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      context: { ...persistedContext, reciprocalRunOperationBindingHash: "0".repeat(64) },
    }), /RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_CROSSED/,
    "context authority recomputes the reciprocal run-to-operation binding instead of trusting a formatted hash");
    const repositoryAuthorityInput = {
      sourceRepositoryRoot: canonicalRepo,
      runId,
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      baseSourceSha,
      baseSourceTreeHash,
    };
    const validateRecoveryRepository = Reflect.get(
      repositoryModule,
      "validateInternalProductionRecoverySourceBootstrapRepositoryV1",
    );
    const excludePath = path.join(isolatedRepo, ".git", "info", "exclude");
    const expectedExclude = [
      "/.setfarm/",
      "/quality-reports/qa-test-1.md",
      "/quality-reports/.qa-test-1.md.setfarm-recovery-publish.tmp",
      "/quality-reports/qa-test-1.json",
      "/quality-reports/.qa-test-1.json.setfarm-recovery-publish.tmp",
      "/quality-reports/final-test-1.json",
      "/quality-reports/.final-test-1.json.setfarm-recovery-publish.tmp",
      "/smoke-home.png",
      "/.smoke-home.png.setfarm-recovery-publish.tmp",
      "/smoke-after-click.png",
      "/.smoke-after-click.png.setfarm-recovery-publish.tmp",
      "",
    ].join("\n");
    assert.equal(lstatSync(excludePath).mode & 0o777, 0o600);
    assert.equal(readFileSync(excludePath, "utf8"), expectedExclude);
    writeFileSync(excludePath, `${expectedExclude}# crossed\n`);
    assert.throws(() => validateRecoveryRepository(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDE_CROSSED/,
      "the finite local exclude is authenticated on every repository reopen");
    writeFileSync(excludePath, expectedExclude);
    chmodSync(excludePath, 0o600);
    await mkdir(path.join(isolatedRepo, "quality-reports"), { recursive: true });
    const externalVictim = path.join(fixture, "external-qa-victim.txt");
    await writeFile(externalVictim, "keep\n");
    const crossedReport = path.join(isolatedRepo, "quality-reports", "qa-test-1.md");
    symlinkSync(externalVictim, crossedReport);
    assert.throws(() => validateRecoveryRepository(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDED_ARTIFACT_CROSSED/,
      "a pre-existing ignored-artifact symlink is refused at the authenticated repository boundary");
    assert.equal(readFileSync(externalVictim, "utf8"), "keep\n");
    unlinkSync(crossedReport);
    const publishRecoveryArtifact = Reflect.get(
      repositoryModule,
      "publishAuthenticatedInternalProductionRecoverySourceBootstrapArtifactV1",
    );
    assert.equal(typeof publishRecoveryArtifact, "function",
      "recovery-owned artifacts use one six-target authenticated publisher");
    const artifactTargets = [
      ".setfarm/run-runtime.json",
      "quality-reports/qa-test-1.md",
      "quality-reports/qa-test-1.json",
      "quality-reports/final-test-1.json",
      "smoke-home.png",
      "smoke-after-click.png",
    ] as const;
    const artifactTemps = [
      ".setfarm/.run-runtime.json.setfarm-recovery-publish.tmp",
      "quality-reports/.qa-test-1.md.setfarm-recovery-publish.tmp",
      "quality-reports/.qa-test-1.json.setfarm-recovery-publish.tmp",
      "quality-reports/.final-test-1.json.setfarm-recovery-publish.tmp",
      ".smoke-home.png.setfarm-recovery-publish.tmp",
      ".smoke-after-click.png.setfarm-recovery-publish.tmp",
    ] as const;
    for (const [ordinal, relativePath] of artifactTargets.entries()) {
      const target = path.join(isolatedRepo, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await rm(target, { force: true });
      const victim = path.join(fixture, `artifact-victim-${ordinal}`);
      await writeFile(victim, "external-victim\n");
      symlinkSync(victim, target);
      assert.throws(
        () => publishRecoveryArtifact(repositoryAuthorityInput, {
          relativePath,
          bytes: Buffer.from(`artifact-${ordinal}\n`, "utf8"),
        }),
        /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_(?:EXCLUDED_)?ARTIFACT_CROSSED/,
        `${relativePath} refuses a pre-existing symlink without following it`,
      );
      assert.equal(readFileSync(victim, "utf8"), "external-victim\n");
      assert.equal(lstatSync(target).isSymbolicLink(), true);
      unlinkSync(target);
      const responseLossTemp = path.join(isolatedRepo, artifactTemps[ordinal]!);
      writeFileSync(responseLossTemp, "interrupted-prior-publication", { mode: 0o600, flag: "wx" });
      publishRecoveryArtifact(repositoryAuthorityInput, {
        relativePath,
        bytes: Buffer.from(`artifact-${ordinal}\n`, "utf8"),
      });
      const published = lstatSync(target);
      assert.equal(published.isFile() && !published.isSymbolicLink(), true);
      assert.equal(published.nlink, 1);
      assert.equal(published.mode & 0o777, 0o600);
      assert.equal(readFileSync(target, "utf8"), `artifact-${ordinal}\n`);
      assert.equal(existsSync(responseLossTemp), false,
        `${relativePath} retires only its exact authenticated response-loss temporary`);
      unlinkSync(target);
    }
    const syncRecoveryBranch = Reflect.get(repositoryModule, "syncInternalProductionRecoverySourceBootstrapRepositoryToOriginMainV1");
    assert.equal(typeof syncRecoveryBranch, "function",
      "active recovery uses one authenticated fast-forward helper that keeps the repository root on its run branch");
    const publisher = path.join(fixture, "publisher");
    execFileSync("git", ["clone", "-q", "-b", "main", isolatedOrigin, publisher]);
    git(["config", "user.email", "setfarm-test@example.invalid"], publisher);
    git(["config", "user.name", "Setfarm Test"], publisher);
    await writeFile(path.join(publisher, "seed", "ADVANCE.md"), "merged story\n");
    git(["add", "seed/ADVANCE.md"], publisher);
    git(["commit", "-qm", "merged story"], publisher);
    git(["push", "-q", "origin", "main"], publisher);
    const advancedMain = git(["rev-parse", "HEAD"], publisher);
    assert.deepEqual(syncRecoveryBranch(repositoryAuthorityInput), contextAuthority.repositoryIdentity);
    assert.equal(git(["branch", "--show-current"], isolatedRepo), runId,
      "origin/main synchronization never checks the isolated recovery root out to main");
    assert.equal(git(["rev-parse", "HEAD"], isolatedRepo), advancedMain);
    assert.equal(git(["rev-parse", "refs/heads/main"], isolatedRepo), advancedMain);
    const ambientExcludes = path.join(fixture, "ambient-excludes");
    await writeFile(ambientExcludes, "*.ambient-poison\n");
    git(["config", "core.excludesFile", ambientExcludes], isolatedRepo);
    const ambientPoison = path.join(isolatedRepo, "hidden.ambient-poison");
    await writeFile(ambientPoison, "poison\n");
    assert.throws(() => syncRecoveryBranch(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_SYNC_WORKTREE_CROSSED/,
      "ambient Git excludes cannot hide arbitrary untracked poison from the authenticated clean proof");
    await rm(ambientPoison);
    git(["config", "--unset", "core.excludesFile"], isolatedRepo);
    const hookDirectory = path.join(fixture, "ambient-hooks");
    await mkdir(hookDirectory);
    const hookSentinel = path.join(fixture, "hook-executed");
    const postMergeHook = path.join(hookDirectory, "post-merge");
    await writeFile(postMergeHook, `#!/bin/sh\nprintf executed > "${hookSentinel}"\n`);
    chmodSync(postMergeHook, 0o755);
    git(["config", "core.hooksPath", hookDirectory], isolatedRepo);
    await writeFile(path.join(isolatedRepo, "quality-reports", "qa-test-1.md"), "# QA\n");
    await writeFile(path.join(isolatedRepo, "quality-reports", "qa-test-1.json"), "{}\n");
    await writeFile(path.join(isolatedRepo, "smoke-home.png"), "png\n");
    await writeFile(path.join(isolatedRepo, "smoke-after-click.png"), "png\n");
    await writeFile(path.join(publisher, "seed", "NEXT.md"), "next merged story\n");
    git(["add", "seed/NEXT.md"], publisher);
    git(["commit", "-qm", "next merged story"], publisher);
    git(["push", "-q", "origin", "main"], publisher);
    const nextMain = git(["rev-parse", "HEAD"], publisher);
    assert.deepEqual(syncRecoveryBranch(repositoryAuthorityInput), contextAuthority.repositoryIdentity);
    assert.equal(existsSync(hookSentinel), false,
      "ambient Git hooks cannot execute during authenticated recovery checkout or fast-forward mutation");
    assert.equal(git(["branch", "--show-current"], isolatedRepo), runId);
    assert.equal(git(["rev-parse", "HEAD"], isolatedRepo), nextMain,
      "ignored recovery QA evidence cannot block the next authenticated run-branch fast-forward");
    const unownedArtifact = path.join(isolatedRepo, "foreign-output.tmp");
    await writeFile(unownedArtifact, "poison\n");
    assert.throws(() => syncRecoveryBranch(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_SYNC_WORKTREE_CROSSED/,
      "the finite Setfarm artifact exemption never hides arbitrary untracked poison");
    await rm(unownedArtifact);
    await writeFile(path.join(isolatedRepo, "seed", "LOCAL.md"), "diverged recovery\n");
    git(["add", "seed/LOCAL.md"], isolatedRepo);
    git(["commit", "-qm", "diverged recovery"], isolatedRepo);
    await writeFile(path.join(publisher, "seed", "THIRD.md"), "third merged story\n");
    git(["add", "seed/THIRD.md"], publisher);
    git(["commit", "-qm", "third merged story"], publisher);
    git(["push", "-q", "origin", "main"], publisher);
    const divergentHead = git(["rev-parse", "HEAD"], isolatedRepo);
    assert.throws(() => syncRecoveryBranch(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_MAIN_DIVERGED/,
      "a diverged recovery branch refuses before reset, checkout, merge, or push");
    assert.equal(git(["branch", "--show-current"], isolatedRepo), runId);
    assert.equal(git(["rev-parse", "HEAD"], isolatedRepo), divergentHead);
    git(["reset", "--hard", advancedMain], isolatedRepo);
    assert.equal(git(["branch", "--show-current"]), canonicalBranch);
    assert.deepEqual(readFileSync(path.join(canonicalRepo, ".gitignore")), canonicalIgnore);
    assert.equal(git(["rev-parse", "refs/remotes/origin/main"]), canonicalMain);
    assert.equal(git(["remote", "get-url", "origin"]), canonicalOrigin);
    assert.equal(git(["write-tree"]), canonicalIndex);
    const untrackedSentinel = path.join(isolatedRepo, ".setfarm-recovery-sentinel");
    await writeFile(untrackedSentinel, "isolated mutation\n");
    assert.equal(readFileSync(path.join(canonicalRepo, ".gitignore")).equals(canonicalIgnore), true);
    assert.deepEqual(requireActiveRunAuthority({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      context: persistedContext,
      persistence: activePersistence,
    }), contextAuthority,
    "post-setup recovery authority permits run-branch work while retaining marker, base ancestry, context, and DB binding");
    assert.throws(() => validateSetupBaseline({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      baseSourceSha,
      baseSourceTreeHash,
    }), /RECOVERY_SOURCE_BOOTSTRAP_SETUP_BASELINE_CROSSED/,
    "setup-build cannot ignore untracked recovery-source poison before its no-main bypass");
    await rm(untrackedSentinel);
    await writeFile(path.join(isolatedRepo, ".gitignore"), "isolated-ignore\n");
    assert.throws(() => validateSetupBaseline({
      sourceRepositoryRoot: canonicalRepo,
      runId,
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      baseSourceSha,
      baseSourceTreeHash,
    }), /RECOVERY_SOURCE_BOOTSTRAP_SETUP_BASELINE_CROSSED/,
    "setup-build cannot convert tracked recovery-source drift into a direct main push");
    await writeFile(path.join(isolatedRepo, ".gitignore"), canonicalIgnore);
    await writeFile(untrackedSentinel, "isolated mutation\n");
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
    assert.equal(JSON.parse(adopted.run.context).repo, isolatedRepo);
    assert.equal(readFileSync(path.join(isolatedRepo, ".setfarm-recovery-sentinel"), "utf8"), "isolated mutation\n");
    assert.doesNotMatch((globalThis as any).__p4PersistLedger.join(","), /nextval|clock|insert-/);
    const markerPath = path.join(path.dirname(isolatedRepo), "authority.json");
    const removeRepository = Reflect.get(repositoryModule, "removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1");
    assert.equal(typeof removeRepository, "function", "terminal cleanup uses a dedicated fail-closed managed repository remover");
    const listCleanupCandidates = Reflect.get(
      repositoryModule,
      "listInternalProductionRecoverySourceBootstrapRepositoryCleanupCandidateRunIdsV1",
    );
    const orphanStaging = path.join(path.dirname(path.dirname(isolatedRepo)), ".staging-crash-orphan");
    await mkdir(orphanStaging);
    const tombstoneBody = {
      schema: "setfarm.internal-production-recovery-source-bootstrap-erasure-completion.v1",
      authorityHash: "a".repeat(64),
      journalHash: "b".repeat(64),
      rootDev: "1",
      rootIno: "2",
    } as const;
    const tombstone = JSON.stringify({
      ...tombstoneBody,
      completionHash: hashCanonicalJson(tombstoneBody),
    });
    const tombstonePaths = Array.from({ length: 501 }, (_unused, index) => path.join(
      path.dirname(path.dirname(isolatedRepo)),
      `.cleanup-${(index + 1).toString(16).padStart(64, "0")}.erasure-complete.json`,
    ));
    for (const tombstonePath of tombstonePaths) writeFileSync(tombstonePath, tombstone, { mode: 0o600 });
    const unfinishedRunIds = Array.from({ length: 501 }, (_unused, index) =>
      (index + 0x10_000).toString(16).padStart(64, "0"));
    const unfinishedPaths = unfinishedRunIds.map((candidateRunId) => path.join(
      path.dirname(path.dirname(isolatedRepo)),
      `.cleanup-${candidateRunId}`,
    ));
    for (const unfinishedPath of unfinishedPaths) await mkdir(unfinishedPath);
    assert.deepEqual(listCleanupCandidates({ sourceRepositoryRoot: canonicalRepo }), {
      runIds: [
        ...tombstonePaths.slice(0, 500).map((_unused, index) => (index + 1).toString(16).padStart(64, "0")),
        ...unfinishedRunIds.slice(0, 500),
      ],
      diagnostics: ["UNBOUND_STAGING:.staging-crash-orphan", "CENSUS_TRUNCATED:3"],
    }, "completion evidence and unfinished cleanup work each retain an exact half of the bounded census");
    const crossedTombstone = tombstonePaths[0]!;
    writeFileSync(crossedTombstone, "{}", { mode: 0o600 });
    assert.deepEqual(listCleanupCandidates({ sourceRepositoryRoot: canonicalRepo }), {
      runIds: [
        ...tombstonePaths.slice(0, 500).map((_unused, index) => (index + 1).toString(16).padStart(64, "0")),
        ...unfinishedRunIds.slice(0, 500),
      ],
      diagnostics: [
        `CENSUS_CROSSED:${path.basename(crossedTombstone)}`,
        "UNBOUND_STAGING:.staging-crash-orphan",
        "CENSUS_TRUNCATED:3",
      ],
    }, "a malformed completion-looking entry is reported without blocking independent cleanup candidates");
    writeFileSync(crossedTombstone, tombstone, { mode: 0o600 });
    for (const tombstonePath of tombstonePaths) unlinkSync(tombstonePath);
    for (const unfinishedPath of unfinishedPaths) await rm(unfinishedPath, { recursive: true });
    await rm(orphanStaging, { recursive: true });
    const markerBytes = readFileSync(markerPath);
    const crossedMarker = JSON.parse(markerBytes.toString("utf8")) as Record<string, unknown>;
    crossedMarker.originHash = "0".repeat(64);
    await writeFile(markerPath, JSON.stringify(crossedMarker));
    await assert.rejects(
      kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash }),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_MARKER_CROSSED/,
      "a crossed deterministic workspace is refused without resetting or deleting active recovery work",
    );
    const workspaceRoot = path.dirname(isolatedRepo);
    const responseLossCleanupRoot = path.join(path.dirname(workspaceRoot), `.cleanup-${runId}`);
    const erasureJournalPath = path.join(path.dirname(workspaceRoot), `.cleanup-${runId}.erasure.json`);
    const resolveCleanupState = Reflect.get(repositoryModule,
      "resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1");
    assert.throws(() => removeRepository(repositoryAuthorityInput), /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_MARKER_CROSSED/,
      "terminal cleanup refuses a crossed marker without deleting the quarantined workspace");
    assert.equal(existsSync(workspaceRoot), false,
      "failed authentication never republishes an untrusted quarantine at the live workspace name");
    assert.equal(existsSync(responseLossCleanupRoot), true,
      "failed authentication preserves the quarantine for diagnosis");
    await writeFile(path.join(responseLossCleanupRoot, "authority.json"), markerBytes);
    renameSync(responseLossCleanupRoot, workspaceRoot);
    const workspaceBackup = `${workspaceRoot}.trusted`;
    const cleanupVictim = path.join(fixture, "cleanup-victim");
    await mkdir(cleanupVictim);
    await writeFile(path.join(cleanupVictim, "keep.txt"), "foreign\n");
    renameSync(workspaceRoot, workspaceBackup);
    symlinkSync(cleanupVictim, workspaceRoot, "dir");
    assert.throws(() => removeRepository(repositoryAuthorityInput), /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_WORKSPACE_CROSSED/,
      "terminal cleanup refuses a symlink-swapped workspace without following it");
    assert.equal(readFileSync(path.join(cleanupVictim, "keep.txt"), "utf8"), "foreign\n");
    assert.equal(existsSync(workspaceRoot), false,
      "a crossed workspace name is claimed away instead of remaining live");
    unlinkSync(responseLossCleanupRoot);
    renameSync(workspaceBackup, workspaceRoot);

    symlinkSync(cleanupVictim, path.join(workspaceRoot, "external-link"), "dir");
    const interruptDirectory = path.join(workspaceRoot, "a-interrupt");
    await mkdir(interruptDirectory);
    for (let index = 0; index < 12; index += 1) {
      await writeFile(path.join(workspaceRoot, `z-interrupt-${String(index).padStart(2, "0")}`), "owned\n");
    }
    const hardlinkSource = path.join(workspaceRoot, "hardlink-source");
    const hardlinkAlias = path.join(workspaceRoot, "hardlink-alias");
    await writeFile(hardlinkSource, "linked\n");
    linkSync(hardlinkSource, hardlinkAlias);
    renameSync(workspaceRoot, responseLossCleanupRoot);
    assert.throws(() => removeRepository(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_HARDLINK_CROSSED/,
      "cleanup refuses multi-name file inodes before publishing a journal whose replay link counts would diverge");
    assert.equal(resolveCleanupState(repositoryAuthorityInput), "claimed");
    assert.equal(existsSync(erasureJournalPath), false);
    unlinkSync(path.join(responseLossCleanupRoot, "hardlink-alias"));
    unlinkSync(path.join(responseLossCleanupRoot, "hardlink-source"));
    const specialNode = path.join(responseLossCleanupRoot, "special-node");
    execFileSync("mkfifo", [specialNode]);
    assert.throws(() => removeRepository(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_SPECIAL_NODE/,
      "cleanup refuses a special node before publishing an erasure journal or deleting any entry");
    assert.equal(resolveCleanupState(repositoryAuthorityInput), "claimed");
    assert.equal(existsSync(erasureJournalPath), false);
    assert.equal(readFileSync(path.join(cleanupVictim, "keep.txt"), "utf8"), "foreign\n");
    unlinkSync(path.join(responseLossCleanupRoot, "special-node"));

    const lateEntry = path.join(responseLossCleanupRoot, "a-interrupt", "late-entry");
    const partialPublisherCandidate = `${erasureJournalPath}.tmp-124-00000000-0000-4000-8000-000000000001`;
    writeFileSync(partialPublisherCandidate, "", { mode: 0o600, flag: "wx" });
    const watcher = spawn("sh", [
      "-c",
      'while [ ! -e "$1" ]; do sleep 0.01; done; printf "late\\n" > "$2"',
      "setfarm-erasure-watcher",
      erasureJournalPath,
      lateEntry,
    ], { stdio: "ignore" });
    assert.throws(() => removeRepository(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_STEP_FAILED/,
      "an unexpected post-journal entry interrupts erasure after an authenticated suffix was removed");
    const watcherCode = await waitForFixtureProcessExit(watcher, "SETFARM_ERASURE_WATCHER");
    assert.equal(watcherCode, 0);
    assert.equal(resolveCleanupState(repositoryAuthorityInput), "erasing");
    assert.equal(existsSync(erasureJournalPath), true);
    assert.equal(existsSync(partialPublisherCandidate), false,
      "an authority-private incomplete publisher temp is released before the journal is recreated durably");
    assert.equal(existsSync(path.join(responseLossCleanupRoot, "z-interrupt-11")), false,
      "the first erasure attempt reaches a real partial suffix before interruption");
    assert.equal(readFileSync(lateEntry, "utf8"), "late\n");
    assert.equal(readFileSync(path.join(cleanupVictim, "keep.txt"), "utf8"), "foreign\n",
      "an internal symlink is unlinked without following or deleting its external target");
    const responseLossJournalTwin = `${erasureJournalPath}.tmp-123-00000000-0000-4000-8000-000000000000`;
    linkSync(erasureJournalPath, responseLossJournalTwin);
    assert.equal(lstatSync(erasureJournalPath).nlink, 2,
      "fixture models a crash after no-replace journal link but before temporary-link cleanup");
    const erasureJournalBytes = readFileSync(erasureJournalPath);
    unlinkSync(lateEntry);
    removeRepository(repositoryAuthorityInput);
    assert.equal(existsSync(path.dirname(isolatedRepo)), false, "exact cleanup removes only the deterministic recovery workspace");
    assert.equal(existsSync(responseLossCleanupRoot), false,
      "cleanup replay adopts and removes the exact authenticated quarantine left by response loss");
    assert.equal(resolveCleanupState(repositoryAuthorityInput), "erased",
      "a compact immutable completion tombstone keeps final cleanup response loss replayable");
    const releaseErasureCompletion = Reflect.get(
      repositoryModule,
      "releaseAuthenticatedInternalProductionRecoverySourceBootstrapErasureCompletionV1",
    );
    const erasureCompletionPath = path.join(
      path.dirname(workspaceRoot),
      `.cleanup-${runId}.erasure-complete.json`,
    );
    const erasureCompletionBackup = `${erasureCompletionPath}.trusted`;
    renameSync(erasureCompletionPath, erasureCompletionBackup);
    symlinkSync(path.join(fixture, "missing-completion-target"), erasureCompletionPath);
    assert.throws(
      () => releaseErasureCompletion(repositoryAuthorityInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_CROSSED|RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_INVALID/,
      "a dangling completion symlink is a named crossed entry, never durable absence",
    );
    assert.equal(lstatSync(erasureCompletionPath).isSymbolicLink(), true);
    unlinkSync(erasureCompletionPath);
    renameSync(erasureCompletionBackup, erasureCompletionPath);
    assert.equal(existsSync(path.join(path.dirname(workspaceRoot), `.cleanup-${runId}.erasure.json`)), false,
      "the large inventory journal is released only after durable root removal");
    assert.equal(existsSync(path.join(path.dirname(workspaceRoot), `.cleanup-${runId}.erasure-complete.json`)), true,
      "the authority-bound completion tombstone remains as terminal cleanup evidence");
    writeFileSync(erasureJournalPath, erasureJournalBytes, { mode: 0o600, flag: "wx" });
    assert.equal(resolveCleanupState(repositoryAuthorityInput), "erasing",
      "fixture models response loss after durable root removal but before large-journal release");
    removeRepository(repositoryAuthorityInput);
    assert.equal(existsSync(erasureJournalPath), false,
      "metadata replay releases the matching journal while retaining its compact completion tombstone");
    removeRepository(repositoryAuthorityInput);
    assert.equal(resolveCleanupState(repositoryAuthorityInput), "erased");
    assert.equal(existsSync(path.dirname(isolatedRepo)), false,
      "terminal cleanup replay validates an already-erased exact workspace without recreating it");
    const resolveContextBindingAuthority = Reflect.get(authorityModule, "resolveInternalProductionRecoverySourceBootstrapRunContextBindingAuthorityV1");
    assert.equal(typeof resolveContextBindingAuthority, "function",
      "terminal cleanup can reauthenticate immutable run/context bindings after its repository was already removed");
    assert.deepEqual(resolveContextBindingAuthority({ sourceRepositoryRoot: canonicalRepo, runId, context: persistedContext }), contextAuthority,
      "cleanup response-loss replay authenticates context and DB bindings without recreating the deleted clone");
    const absentCleanupInput = { ...repositoryAuthorityInput, runId: "8".repeat(64) };
    assert.equal(resolveCleanupState(absentCleanupInput), "absent");
    assert.throws(() => removeRepository(absentCleanupInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING/,
      "core cleanup refuses tombstone-free absence instead of hiding external repository loss");
    (globalThis as any).__p4PersistState = committed;
    (globalThis as any).__p4PersistLedger = [];
    await assert.rejects(
      kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash }),
      /RECOVERY_SOURCE_BOOTSTRAP_STORED_RUN_REPOSITORY_MISSING/,
      "a durable active run cannot silently recreate a missing repository and discard in-flight recovery work",
    );
    assert.equal(existsSync(path.dirname(isolatedRepo)), false, "active adoption leaves a missing recovery repository absent for diagnosis");
    const terminalState = structuredClone(committed);
    terminalState.runs[runId].status = "completed";
    (globalThis as any).__p4PersistState = terminalState;
    (globalThis as any).__p4PersistLedger = [];
    await assert.rejects(
      kernel.persistInternalProductionRecoverySourceBootstrapRunV1({ operationRef: operation.operationRef, operationHash: operation.operationHash }),
      /RECOVERY_SOURCE_BOOTSTRAP_STORED_RUN_INVALID/,
      "a terminal durable row is rejected before any cleaned workspace can be recreated",
    );
    assert.equal(existsSync(path.dirname(isolatedRepo)), false, "terminal adoption does not leak a fresh external clone");

    const relocationRunId = "7".repeat(64);
    const relocationInput = { ...repositoryAuthorityInput, runId: relocationRunId };
    const prepareRepository = Reflect.get(repositoryModule,
      "prepareInternalProductionRecoverySourceBootstrapRepositoryV1");
    const relocationIdentity = prepareRepository(relocationInput);
    const journaledParent = path.join(relocationIdentity.workspaceRoot, "a-parent");
    await mkdir(journaledParent);
    await writeFile(path.join(journaledParent, "owned.txt"), "owned\n");
    for (let index = 0; index < 12; index += 1) {
      await writeFile(path.join(relocationIdentity.workspaceRoot, `z-relocate-${String(index).padStart(2, "0")}`), "owned\n");
    }
    const relocationCleanupRoot = path.join(path.dirname(relocationIdentity.workspaceRoot), `.cleanup-${relocationRunId}`);
    const relocationJournalPath = path.join(path.dirname(relocationIdentity.workspaceRoot), `.cleanup-${relocationRunId}.erasure.json`);
    const movedJournaledParent = path.join(fixture, "moved-journaled-parent");
    const relocationWatcher = spawn("sh", [
      "-c",
      'while [ ! -e "$1" ] || [ -e "$2" ]; do sleep 0.01; done; mv "$3" "$4"; ln -s "$4" "$3"',
      "setfarm-relocation-watcher",
      relocationJournalPath,
      path.join(relocationCleanupRoot, "z-relocate-11"),
      path.join(relocationCleanupRoot, "a-parent"),
      movedJournaledParent,
    ], { stdio: "ignore" });
    assert.throws(() => removeRepository(relocationInput),
      /RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_STEP_FAILED|RECOVERY_SOURCE_BOOTSTRAP_ERASER_INVALID/,
      "cleanup refuses a journaled parent relocated outside quarantine and symlinked back after its pre-scan");
    const relocationWatcherCode = await waitForFixtureProcessExit(
      relocationWatcher,
      "SETFARM_RELOCATION_WATCHER",
    );
    assert.equal(relocationWatcherCode, 0);
    assert.equal(readFileSync(path.join(movedJournaledParent, "owned.txt"), "utf8"), "owned\n",
      "root-anchored traversal refuses before deleting from the relocated directory inode");
    const repositorySource = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-repository-v1.ts", import.meta.url), "utf8");
    const cleanupStart = repositorySource.indexOf("export function removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1");
    const cleanupEnd = repositorySource.indexOf("\nexport function", cleanupStart + 1);
    const cleanupRegion = repositorySource.slice(cleanupStart, cleanupEnd);
    const claimOrdinal = cleanupRegion.indexOf("renameSync(expectedIdentity.workspaceRoot, cleanupRoot)");
    const claimedValidationOrdinal = cleanupRegion.indexOf("validateClaimedRepository", claimOrdinal);
    assert.ok(claimOrdinal >= 0 && claimedValidationOrdinal > claimOrdinal,
      "terminal cleanup first claims the unpredictable quarantine path, then authenticates the claimed object before deletion");
    assert.doesNotMatch(cleanupRegion, /rmSync\([^)]*\{\s*recursive:\s*true/,
      "terminal cleanup never performs path-based recursive deletion after authenticating a different inode");
    assert.match(cleanupRegion, /publishErasureJournal\([\s\S]*firstMissing[\s\S]*RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_PREFIX_CROSSED[\s\S]*cleanupRootAncestor[\s\S]*eraseAuthenticatedDirent\(path\.dirname\(cleanupRoot\)/,
      "cleanup publishes one immutable inventory before replaying only its authenticated present prefix in reverse order");
    const eraserStart = repositorySource.indexOf("const AUTHENTICATED_RECOVERY_REPOSITORY_DIRENT_ERASER_V1");
    const eraserEnd = repositorySource.indexOf("`;\n\nexport type", eraserStart);
    assert.ok(eraserStart >= 0 && eraserEnd > eraserStart);
    const eraserSource = repositorySource.slice(eraserStart, eraserEnd);
    assert.match(eraserSource, /lstatSync\(["']\.["'],\s*\{\s*bigint:\s*true\s*\}\)[\s\S]*for\s*\(const ancestor of input\.ancestors\)[\s\S]*named\.isSymbolicLink\(\)[\s\S]*process\.chdir\(ancestor\.name\)[\s\S]*lstatSync\(target,\s*\{\s*bigint:\s*true\s*\}\)[\s\S]*rmdirSync\(target\)[\s\S]*unlinkSync\(target\)[\s\S]*fsyncSync\(parentDescriptor\)/,
      "each fixed child pins one parent directory, reauthenticates one direct entry, and never follows a descendant path");
    const eraseHelperStart = repositorySource.indexOf("function eraseAuthenticatedDirent(");
    const eraseHelperEnd = repositorySource.indexOf("\nexport function removeAuthenticated", eraseHelperStart);
    assert.ok(eraseHelperStart >= 0 && eraseHelperEnd > eraseHelperStart);
    const eraseHelperSource = repositorySource.slice(eraseHelperStart, eraseHelperEnd);
    assert.match(repositorySource, /["']\/usr\/bin\/sandbox-exec["'][\s\S]*deny file-write\*[\s\S]*subpath[\s\S]*cleanupRoot[\s\S]*deny network[\s\S]*deny process-exec/,
      "the code-owned eraser profile denies writes outside the authenticated quarantine root");
    assert.match(eraseHelperSource, /const cleanupRoot[\s\S]*recoveryRepositoryEraserSandboxProfileV1\(cleanupRoot,[\s\S]*spawnSync\(sandboxExecutable,[\s\S]*nodeExecutable[\s\S]*cwd:\s*root/,
      "the fixed child runs inside a kernel-enforced write sandbox bound to the authenticated quarantine root");
    assert.match(cleanupRegion, /resolveErasureCompletion\(input,\s*journal,\s*completionPath,\s*true\)[\s\S]*eraseAuthenticatedDirent\(path\.dirname\(cleanupRoot\)[\s\S]*unlinkAuthenticatedErasureRecordV1\(\s*journalPath/,
      "an immutable completion tombstone makes empty-root removal and large-journal release replayable after response loss");
    assert.doesNotMatch(cleanupRegion, /unlinkSync\(completionPath\)/,
      "terminal cleanup retains its compact authority-bound completion tombstone");
    const parentProcessSource = repositorySource.slice(eraserEnd + 2);
    assert.doesNotMatch(parentProcessSource, /\bunlinkSync\s*\(/,
      "the parent process never performs a path-based erasure-record unlink outside the authenticated Seatbelt child");
    assert.ok((parentProcessSource.match(/unlinkAuthenticatedErasureRecordV1\(/g) ?? []).length >= 5,
      "partial, twin, abandoned, and terminal journal records all share the authenticated sandbox unlink boundary");
  } finally {
    if (managedWorkspaceRoot) await rm(managedWorkspaceRoot, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});

it("P4 terminal cleanup poisons no reserved session after control-command acknowledgement loss", async () => {
  const production = readFileSync(new URL("../../src/execution/recovery-source-bootstrap-repository-cleanup-v1.ts", import.meta.url), "utf8");
  const start = production.indexOf("const RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RECEIPT_PREFIX_V1");
  assert.ok(start >= 0);
  const fixture = await mkdtemp(path.join(tmpdir(), "setfarm-p4-cleanup-control-loss-"));
  try {
    const modulePath = path.join(fixture, "cleanup-control-loss.ts");
    await writeFile(modulePath, `
const g=globalThis as any;
type PgTransactionSql=any;
const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1="/canonical/setfarm";
const rejectAfter=(stage:string):void=>{if(g.__p4ControlRejectAfter===stage){g.__p4ControlRejectAfter=undefined;throw new Error("INJECT_"+stage+"_ACK_LOSS")}};
const getSql=()=>({reserve:async()=>({
  unsafe:async(query:string)=>{
    if(query.includes("set_config('lock_timeout'")){g.__p4ControlEvents.push("set-config");rejectAfter("set-config");return [{}]}
    if(query.includes("pg_advisory_lock(")){g.__p4ControlEvents.push("lock");rejectAfter("lock");return [{}]}
    if(query.startsWith("BEGIN")){g.__p4ControlEvents.push("begin");rejectAfter("begin");return []}
    if(query.startsWith("ROLLBACK")){g.__p4ControlEvents.push("rollback");return []}
    if(query.includes("pg_advisory_unlock(")){g.__p4ControlEvents.push("unlock");return [{unlocked:true}]}
    if(query.startsWith("RESET lock_timeout")){g.__p4ControlEvents.push("reset");return []}
    if(query.includes("pg_terminate_backend")){g.__p4ControlEvents.push("terminate");return []}
    throw new Error("UNEXPECTED_CONTROL_SQL:"+query)
  },
  release:()=>{g.__p4ControlEvents.push("release")},
})});
const classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1=async()=>{throw new Error("UNREACHABLE_CLASSIFIER")};
const isInternalProductionRecoverySourceBootstrapRunContextV1=()=>false;
const resolveInternalProductionRecoverySourceBootstrapRunContextBindingAuthorityV1=()=>{throw new Error("UNREACHABLE_AUTHORITY")};
const removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1=()=>{throw new Error("UNREACHABLE_REMOVE")};
const releaseAuthenticatedInternalProductionRecoverySourceBootstrapErasureCompletionV1=()=>{throw new Error("UNREACHABLE_RELEASE")};
const listInternalProductionRecoverySourceBootstrapRepositoryCleanupCandidateRunIdsV1=()=>({runIds:[],diagnostics:[]});
const resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1=()=>"absent";
const validateClaimedInternalProductionRecoverySourceBootstrapRepositoryV1=()=>{};
const validateInternalProductionRecoverySourceBootstrapRepositoryV1=()=>{};
${production.slice(start)}
`, "utf8");
    const kernel = await import(`${pathToFileURL(modulePath).href}?control=${Date.now()}`) as any;
    const runId = "a".repeat(64);
    for (const row of [
      { stage: "set-config", events: ["set-config", "reset", "release"] },
      { stage: "lock", events: ["set-config", "lock", "unlock", "reset", "release"] },
      { stage: "begin", events: ["set-config", "lock", "begin", "rollback", "unlock", "reset", "release"] },
    ] as const) {
      Object.assign(globalThis as any, { __p4ControlRejectAfter: row.stage, __p4ControlEvents: [] });
      await assert.rejects(
        kernel.cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId }),
        new RegExp(`INJECT_${row.stage}_ACK_LOSS`),
      );
      assert.deepEqual((globalThis as any).__p4ControlEvents, row.events,
        `${row.stage} acknowledgement loss cleans every session state that may already have applied`);
    }
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
    // Execute the production call: forwarding the stored body leaks extra keys
    // and its noncanonical key order across the strict two-field resolver ABI.
    const typescript = await import("typescript");
    const dbTree = typescript.createSourceFile("db-pg.ts", dbSource, typescript.ScriptTarget.Latest, true);
    const readinessFunction = dbTree.statements.find(statement =>
      typescript.isFunctionDeclaration(statement) && statement.name?.text === "requireWorkflowRunAdmissionReadyV1");
    assert.ok(readinessFunction);
    const resolverCalls: import("typescript").CallExpression[] = [];
    const visit = (node: import("typescript").Node): void => {
      if (typescript.isCallExpression(node) && typescript.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === "resolveInternalProductionTask0SpawnerAdmissionReadyV1") resolverCalls.push(node);
      typescript.forEachChild(node, visit);
    };
    visit(readinessFunction);
    assert.equal(resolverCalls.length, 1);
    const invokeResolver = new Function("module", "admissionReady", "status", `return ${typescript.transpileModule(
      resolverCalls[0]!.getText(dbTree),
      { compilerOptions: { target: typescript.ScriptTarget.ES2022 } },
    ).outputText}`);
    const storedReady = Object.freeze({ admissionReadyHash: "a".repeat(64), admissionReadyRef: "fixture-ready", state: "stored-body" });
    const received: unknown[][] = [];
    const resolvedReady = Object.freeze({ state: "resolved-fixture" });
    assert.equal(await invokeResolver({
      resolveInternalProductionTask0SpawnerAdmissionReadyV1: async (...args: unknown[]) => {
        received.push(args);
        return resolvedReady;
      },
    }, storedReady, { admissionReady: storedReady }), resolvedReady);
    assert.deepEqual(received, [[{ admissionReadyRef: "fixture-ready", admissionReadyHash: "a".repeat(64) }]]);
    assert.deepEqual(Reflect.ownKeys(received[0]![0] as object), ["admissionReadyRef", "admissionReadyHash"]);
    assert.match(dbSource, /Reflect\.ownKeys\(namespace\)/);
    assert.match(dbSource, /observeInternalProductionPreSchemaSpawnerRebindStatusV1\.length !== 0/);
    assert.match(dbSource, /resolveInternalProductionTask0SpawnerAdmissionReadyV1\.length !== 1/);
    assert.match(dbSource, /470fae4c76397f54be2adfeaeec14adca9afe062a855833a50034b16aff975db/);
    assert.match(dbSource, /currentResolution\.nodes/);
    const readinessStart = dbSource.indexOf("async function requireWorkflowRunAdmissionReadyV1(");
    const readinessEnd = dbSource.indexOf(
      "\ntype InternalProductionCompletionBootstrapHeadLockModeV1",
      readinessStart,
    );
    assert.ok(readinessStart >= 0 && readinessEnd > readinessStart);
    const readinessSource = dbSource.slice(readinessStart, readinessEnd);
    assert.doesNotMatch(readinessSource, /current\.receipt\.phase\s*!==\s*"A"/);

    const installerSource = readFileSync(
      path.resolve(import.meta.dirname, "../../src/installer/run.ts"),
      "utf8",
    );
    const persistenceImportEnd = installerSource.indexOf(
      '} from "../execution/run-persistence.js";',
    );
    const persistenceImportStart = installerSource.lastIndexOf(
      "import {",
      persistenceImportEnd,
    );
    assert.ok(persistenceImportStart >= 0 && persistenceImportEnd > persistenceImportStart);
    const persistenceImport = installerSource.slice(
      persistenceImportStart,
      persistenceImportEnd,
    );
    assert.match(persistenceImport, /\bpersistWorkflowRun,/);
    assert.match(persistenceImport, /\btype PersistedWorkflowStep,/);
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
import path from "node:path";
import {fileURLToPath} from "node:url";
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
