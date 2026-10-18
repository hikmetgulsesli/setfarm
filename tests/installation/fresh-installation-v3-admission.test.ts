/** Genuine Source-body routing components, not Source/build/DB qualification.
 * No imported production module is granted positive authority by these ports.
 * Root also runs the separately reviewed real restricted compiled PG control.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const read = (file: string): string => readFileSync(new URL(file, root), "utf8");
function sourceFunction(file: string, name: string) {
  const text = read(file), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const rows = tree.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(rows.length, 1, "missing/ambiguous actual Source function " + name);
  return { tree, node: rows[0]!, text };
}
function compile(text: string): string {
  return ts.transpileModule(text, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText.replace(/^export /gm, "");
}
function callback(file: string, owner: string, name: string): string {
  const { tree, node } = sourceFunction(file, owner);
  const matches: Array<ts.Block | ts.ConciseBody> = [];
  function visit(child: ts.Node) {
    if (ts.isPropertyAssignment(child) && child.name.getText(tree) === name
      && ts.isArrowFunction(child.initializer)) matches.push(child.initializer.body);
    if (ts.isMethodDeclaration(child) && child.name.getText(tree) === name && child.body) matches.push(child.body);
    ts.forEachChild(child, visit);
  }
  visit(node); assert.equal(matches.length, 1, "exact callback not found: " + name);
  const body = matches[0]!;
  return compile("async function actualCallback() " + (ts.isBlock(body) ? body.getText(tree) : "{return " + body.getText(tree) + ";}"));
}

const state = { status: "verified", versions: Array.from({ length: 33 }, (_, i) => i + 1), verifiedReleaseSha: "a".repeat(40) };
for (const [file, owner, method] of [
  ["src/execution/activation-preflight.ts", "createActivationPreflightDependencies", "verifyMigrations"],
  ["src/evals/convergence-runner.ts", "createPostgresConvergencePort", "inspectPlatform"],
] as const) test("actual selected journal callback avoids legacy SHARE lock: " + method, async () => {
  const sql = { unsafe: async () => [{ active_runs: 0, open_claims: 0, active_attempts: 0, active_runtimes: 0, active_recovery_deliveries: 0 }] };
  let selectedCalls = 0, legacyCalls = 0;
  const denied = async () => { legacyCalls++; throw Object.assign(new Error("permission denied for table setfarm_schema_migrations"), { code: "42501" }); };
  const selected = async (actual: unknown) => { assert.equal(actual, sql); selectedCalls++; return state; };
  const invoke = new Function("sql", "input", "verifyContractSpineMigrations", "readContractSpineMigrationAttestation",
    "readV3AdmissionMigrationStateV1", "verifyArtifactIndexInventory", "artifactIndex", "artifactInventoryStore", "integer",
    callback(file, owner, method) + ";return actualCallback;")(
      sql, { sql }, denied, denied, selected, async () => ({ capacity: { state: "ready" } }), {}, {}, Number,
    ) as () => Promise<any>;
  const result = await invoke();
  assert.equal(selectedCalls, 1, "must use actual selected adapter, not the old lock-capable verifier");
  assert.equal(legacyCalls, 0);
  if (method === "verifyMigrations") assert.deepEqual(result, state);
  else { assert.equal(result.migrationVerified, true); assert.equal(result.attestedReleaseSha, state.verifiedReleaseSha); }
});

function adapter(options: { selected?: boolean; runtimeFailure?: string; activationFailure?: string; driftAt?: string; legacyAttested?: boolean; sourceMode?: boolean } = {}) {
  const calls: string[] = [], sql: any = {};
  const selected: any = options.selected === false ? null : {
    state: { origin: { sourceSha: state.verifiedReleaseSha, migrations: state.versions.map(version => ({ version })) }, ownerOid: 71, runtimeOid: 72 },
    catalogHash: "b".repeat(64), activation: { acknowledged: true, activatedPin: {} },
    assertUnchanged() { calls.push("record"); },
  };
  let drift = false;
  const assertSelection = () => { calls.push("selection"); if (drift) throw Error("sticky selection refused"); };
  sql.begin = async (mode: string, body: (tx: unknown) => Promise<void>) => {
    assert.equal(mode, "isolation level repeatable read read only"); calls.push("begin");
    const tx = { unsafe: async (query: string) => { assert.match(query, /statement_timeout/); assert.doesNotMatch(query, /LOCK TABLE|INSERT|UPDATE|DELETE|CREATE|ALTER/); calls.push("settings"); } };
    (sql as any).transaction = tx; await body(tx); calls.push("commit");
  };
  const load = async (name: string) => {
    if (name === "./fresh-installation-runtime-v1.js") return {
      verifyFreshInstallationRuntimeConnectionV1: async (actual: unknown, origin: unknown, catalog: unknown, owner: unknown, runtime: unknown, unchanged: () => void) => {
        assert.equal(actual, sql); assert.equal(origin, selected.state.origin); assert.equal(catalog, selected.catalogHash);
        assert.equal(owner, 71); assert.equal(runtime, 72); calls.push("full-runtime"); unchanged();
        if (options.runtimeFailure) throw Error(options.runtimeFailure);
        if (options.driftAt === "runtime") drift = true;
      },
    };
    assert.equal(name, "./fresh-installation-activation-verifier-v1.js");
    return { verifyFreshInstallationActivatedDatabaseOnTransactionV1: async (tx: unknown, activation: unknown, base: unknown, mode: string) => {
      assert.equal(tx, sql.transaction); assert.equal(activation, selected.activation); assert.equal(base, selected.state); assert.equal(mode, "runtime");
      calls.push("compiled-activation"); if (options.activationFailure) throw Error(options.activationFailure);
      if (options.driftAt === "activation") drift = true;
    } };
  };
  const file = "src/installation/fresh-installation-v3-admission-v1.ts";
  let body = sourceFunction(file, "readV3AdmissionMigrationStateV1").node.getText();
  for (const name of ["./fresh-installation-runtime-v1.js", "./fresh-installation-activation-verifier-v1.js"]) {
    const exact = "import(" + JSON.stringify(name) + ")";
    assert.equal(body.split(exact).length - 1, 1); body = body.replace(exact, "load(" + JSON.stringify(name) + ")");
  }
  body = body.replace("import.meta.url", JSON.stringify(options.sourceMode ? "file:///component/source.ts" : "file:///component/dist.js"));
  const invoke = new Function("fileURLToPath", "freshInstallationSelectionV1", "assertFreshInstallationSelectionUnchangedV1", "load",
    "verifyContractSpineMigrations", "readContractSpineMigrationAttestation", compile(body) + ";return readV3AdmissionMigrationStateV1;")(
      (value: string) => value, selected, assertSelection, load,
      async (actual: unknown) => { assert.equal(actual, sql); calls.push("legacy-verify"); return { migrations: state.versions.map(version => ({ version })) }; },
      async (actual: unknown) => { assert.equal(actual, sql); calls.push("legacy-attestation"); return { status: options.legacyAttested === false ? "unattested" : "attested", verifiedReleaseSha: state.verifiedReleaseSha }; },
    ) as (sql: unknown) => Promise<unknown>;
  return { invoke: () => invoke(sql), calls, selected };
}

test("selected adapter verifies actual supplied SQL, complete runtime and compiled activation before attesting", async () => {
  const h = adapter(); assert.deepEqual(await h.invoke(), state);
  assert.ok(h.calls.indexOf("full-runtime") < h.calls.indexOf("compiled-activation"));
  assert.ok(h.calls.indexOf("compiled-activation") < h.calls.indexOf("commit"));
  assert.equal(h.calls.some(x => x.startsWith("legacy-")), false);
});
test("selected adapter propagates real verifier refusal without legacy fallback or caller attestation", async () => {
  for (const options of [{ runtimeFailure: "wrong DB" }, { runtimeFailure: "wrong catalog/role" },
    { activationFailure: "wrong source/release/journal" }, { driftAt: "runtime" }, { driftAt: "activation" }]) {
    const h = adapter(options); await assert.rejects(h.invoke(), /^Error: FRESH_V3_MIGRATION_ATTESTATION_REFUSED$/);
    assert.equal(h.calls.some(x => x.startsWith("legacy-")), false);
  }
  const h = adapter(); h.selected.activation.acknowledged = false;
  await assert.rejects(h.invoke(), /FRESH_V3_MIGRATION_ATTESTATION_REFUSED/);
  assert.equal(h.calls.includes("full-runtime"), false);
});
test("selected source-mode adapter refuses before imports or SQL", async () => {
  const h = adapter({ sourceMode: true }); await assert.rejects(h.invoke(), /FRESH_V3_MIGRATION_ATTESTATION_REFUSED/);
  assert.equal(h.calls.includes("full-runtime"), false); assert.equal(h.calls.includes("begin"), false);
});

test("ordinary adapter preserves full legacy verification then attestation and unattested null", async () => {
  for (const attested of [true, false]) {
    const h = adapter({ selected: false, legacyAttested: attested });
    assert.deepEqual(await h.invoke(), { ...state, verifiedReleaseSha: attested ? state.verifiedReleaseSha : null });
    assert.deepEqual(h.calls.filter(x => x.startsWith("legacy-")), ["legacy-verify", "legacy-attestation"]);
    assert.equal(h.calls.includes("begin"), false);
  }
});

test("selected evaluator default ports prepare and use owned client/close; foreign output refuses before DB", async () => {
  const file = "src/evals/convergence-runner.ts";
  let body = sourceFunction(file, "createDefaultConvergencePorts").node.getText();
  for (const name of ["../installation/fresh-installation-entry-v1.js", "../db-pg.js"]) {
    const exact = "import(" + JSON.stringify(name) + ")";
    assert.equal(body.split(exact).length - 1, 1); body = body.replace(exact, "load(" + JSON.stringify(name) + ")");
  }
  body = body.replace("import.meta.url", JSON.stringify("file:///component/dist/evals/convergence-runner.js"));
  const calls: string[] = [], owned = {}, port: any = {};
  const primary = Error("post-prepare record retarget"), cleanup = Error("close failed");
  let failAfterPrepare = false, failClose = false;
  const selected = { paths: { evals: "/component/private/evals" }, assertUnchanged() { calls.push("record"); if (failAfterPrepare) throw primary; } };
  const load = async (name: string) => name.endsWith("entry-v1.js") ? {
    prepareFreshInstallationOperationalEntryV1: async () => { calls.push("actual-prepare"); },
    assertFreshInstallationOperationalEntryV1() { calls.push("actual-entry"); },
  } : { getSql() { calls.push("owned-get"); return owned; }, async pgClose() { calls.push("owned-close"); if (failClose) throw cleanup; } };
  const setup = new Function("fileURLToPath", "SelectedConvergenceResultStoreV1", "freshInstallationSelectionV1", "assertFreshInstallationSelectionUnchangedV1", "load", "postgres", "runtimeConfig",
    "createPostgresConvergencePort", "ContentAddressedEvalResultStore", "createV3ReleaseAdmissionRepository",
    "createFetchConvergenceHttpPort", "createNodeConvergenceProcessPort", "createSystemClock",
    compile(body) + ";return createDefaultConvergencePorts;")(
      (value: string) => value, class {}, selected, () => calls.push("selection"), load, () => { throw Error("unprepared pool forbidden"); }, {},
      (sql: unknown) => { assert.equal(sql, owned); return port; }, class {}, (sql: unknown) => { assert.equal(sql, owned); return {}; },
      () => ({}), () => ({}), () => ({}),
    ) as (root: string) => Promise<any>;
  await assert.rejects(setup("/foreign/output"), /FRESH_V3_EVAL_OUTPUT_ROOT_REFUSED/);
  assert.deepEqual(calls, ["selection"]); calls.length = 0;
  const ports = await setup(selected.paths.evals); assert.equal(ports.sql, port); await ports.sql.close();
  assert.ok(calls.indexOf("actual-prepare") < calls.indexOf("owned-get"));
  assert.equal(calls.at(-1), "owned-close");
  calls.length = 0; failAfterPrepare = true;
  await assert.rejects(setup(selected.paths.evals), error => error === primary);
  assert.equal(calls.filter(x => x === "owned-close").length, 1);
  assert.equal(calls.includes("owned-get"), false);
  calls.length = 0; failClose = true;
  await assert.rejects(setup(selected.paths.evals), error => error instanceof AggregateError
    && error.errors[0] === primary && error.errors[1] === cleanup);
  assert.equal(calls.filter(x => x === "owned-close").length, 1);
});


test("selected result store rejects ancestor/hash symlinks and replaced private directories before writes", async () => {
  const file = "src/evals/convergence-runner.ts", { tree } = sourceFunction(file, "createDefaultConvergencePorts");
  const classes = tree.statements.filter((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === "SelectedConvergenceResultStoreV1");
  assert.equal(classes.length, 1);
  const guard = sourceFunction(file, "assertSelectedConvergenceDirectoryV1").node.getText();
  const selected = { directory: "/component/I", paths: { root: "/component/I/runtime", evals: "/component/I/runtime/evals/results" } };
  const dirs = new Map<string, { ino: number; symbolic?: boolean }>();
  const initial = [selected.directory, selected.paths.root, selected.paths.root + "/evals", selected.paths.evals];
  let puts = 0, creates = 0;
  function reset() { dirs.clear(); initial.forEach((path, index) => dirs.set(path, { ino: index + 1 })); puts = 0; creates = 0; }
  const lstatSync = (path: string) => {
    const row = dirs.get(path); if (!row) throw Object.assign(Error("absent"), { code: "ENOENT" });
    return { uid: 501, mode: 0o40700, dev: 1, ino: row.ino, isDirectory: () => !row.symbolic, isSymbolicLink: () => !!row.symbolic };
  };
  const mkdirSync = (path: string, options: unknown) => { assert.deepEqual(options, { mode: 0o700 }); assert.equal(dirs.has(path), false); creates++; dirs.set(path, { ino: 10 + creates }); };
  class BaseStore { constructor(_root: string) {} async put(_value: unknown) { puts++; return { hash: "a".repeat(64), locator: "DATA", created: true }; } async get(_hash: string) { return {}; } }
  const Store = new Function("freshInstallationSelectionV1", "assertFreshInstallationSelectionUnchangedV1", "lstatSync", "realpathSync", "mkdirSync", "process", "path", "Sha256Schema", "ContentAddressedEvalResultStore",
    compile(guard + "\n" + classes[0]!.getText(tree)) + ";return SelectedConvergenceResultStoreV1;")(
      selected, () => {}, lstatSync, (path: string) => dirs.get(path)?.symbolic ? "/foreign" : path, mkdirSync,
      { getuid: () => 501 }, { join: (...parts: string[]) => parts.join("/") }, { parse: (hash: string) => { assert.match(hash, /^[a-f0-9]{64}$/); return hash; } }, BaseStore,
    ) as new (root: string) => { prepare(): Promise<void>; put(value: any): Promise<unknown> };
  reset(); dirs.set(selected.paths.root + "/evals", { ino: 3, symbolic: true });
  assert.throws(() => new Store(selected.paths.evals), /FRESH_V3_EVAL_DIRECTORY_REFUSED/); assert.equal(puts, 0); assert.equal(creates, 0);
  for (const bad of [selected.paths.evals + "/sha256", selected.paths.evals + "/sha256/aa"]) {
    reset(); const store = new Store(selected.paths.evals);
    dirs.set(selected.paths.evals + "/sha256", { ino: 30 }); dirs.set(bad, { ino: 31, symbolic: true });
    await assert.rejects(store.put({ schema: "setfarm.product-convergence-result.v1", resultHash: "a".repeat(64) }), /FRESH_V3_EVAL_DIRECTORY_REFUSED/);
    assert.equal(puts, 0); assert.equal(creates, 0);
  }
  reset(); const store = new Store(selected.paths.evals);
  await store.put({ schema: "setfarm.product-convergence-result.v1", resultHash: "a".repeat(64) }); assert.equal(puts, 1); assert.equal(creates, 2);
  dirs.set(selected.paths.root, { ino: 999 }); await assert.rejects(store.prepare(), /FRESH_V3_EVAL_DIRECTORY_REFUSED/);
});
