import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SF_GUARDED_TESTS,
  SF_PBA_GUARD,
  collectProductAuthorityTestInventory,
  planProductAuthorityTestGroups,
  interpretProductAuthorityChildResult,
  executeProductAuthorityTestPlans,
  runProductAuthorityTestGroups,
} from "../run-product-authority-test-groups.mjs";

const ROOT = "/synthetic/repo with spaces";
const NODE = "/synthetic/node with spaces";
const ORDINARY = "tests/a visible ordinary.test.ts";
const GUARDED = [
  "tests/product-authority-sf-import-isolation.test.ts",
  "tests/product-build-authority-v3.test.ts",
  "tests/product-build-authority-http.test.ts",
];
const GUARD = "tests/fixtures/product-authority-sf-inert-import-guard.mjs";
const CAPABLE = { registerHooks() {} };

function syntheticIo({ names = [...GUARDED, ORDINARY].map(p => path.basename(p)), types = {}, physical = {} } = {}) {
  const records = new Map([[ROOT, "directory"], [path.join(ROOT, "tests"), "directory"], [path.join(ROOT, "tests/fixtures"), "directory"]]);
  for (const name of names) records.set(path.join(ROOT, "tests", name), "file");
  for (const file of [...GUARDED, GUARD]) records.set(path.join(ROOT, file), "file");
  for (const [relative, type] of Object.entries(types)) records.set(path.join(ROOT, relative), type);
  const reads = [];
  return {
    reads,
    lstatSync(target) {
      reads.push(["lstat", target]);
      const type = records.get(target);
      if (!type || type === "missing") throw Object.assign(new Error("synthetic missing input"), { code: "ENOENT" });
      return { isSymbolicLink: () => type === "symlink", isDirectory: () => type === "directory", isFile: () => type === "file" };
    },
    realpathSync(target) {
      reads.push(["realpath", target]);
      return physical[path.relative(ROOT, target)] ?? target;
    },
    readdirSync(target) {
      reads.push(["readdir", target]);
      assert.equal(target, path.join(ROOT, "tests"), "Discovery stays immediate and inside the only old SF glob directory");
      return [...names];
    },
  };
}

function inventory(options) {
  return collectProductAuthorityTestInventory(ROOT, syntheticIo(options));
}
function plan(input = inventory(), args = []) {
  return planProductAuthorityTestGroups({ inventory: input, args, execPath: NODE, moduleNamespace: CAPABLE });
}
function run({ args = [], io = syntheticIo(), results = [{ status: 0 }, { status: 0 }], moduleNamespace = CAPABLE } = {}) {
  const calls = [], diagnostics = [];
  const result = runProductAuthorityTestGroups({
    repoRoot: ROOT, args, execPath: NODE, moduleNamespace, io,
    spawn(command, argv, options) {
      calls.push({ command, argv, options });
      const next = results[calls.length - 1];
      if (next instanceof Error) throw next;
      return next;
    },
    diagnostic: record => diagnostics.push(record),
  });
  return { result, calls, diagnostics };
}

test("SF manifest is exactly the three admitted files and the existing guard", () => {
  assert.deepEqual(SF_GUARDED_TESTS, GUARDED);
  assert.equal(SF_PBA_GUARD, GUARD);
});

test("default conserves old visible membership once with deterministic guarded-first plans and shell-free paths", () => {
  const input = inventory({ names: ["z new ordinary.test.ts", ".hidden.test.ts", ".product-build-authority-future.test.ts", ...GUARDED.map(p => path.basename(p)), path.basename(ORDINARY), "nested", "not-a-test.ts", "ordinary.test.tsx"] });
  const plans = plan(input);
  assert.deepEqual(plans.map(p => p.group), ["pba", "ordinary"]);
  assert.deepEqual(plans[0].files, [...GUARDED].sort().map(p => path.join(ROOT, p)));
  assert.deepEqual(plans[1].files, [ORDINARY, "tests/z new ordinary.test.ts"].map(p => path.join(ROOT, p)));
  assert.deepEqual(plans[0].argv, ["--import", path.join(ROOT, GUARD), "--import", "tsx", "--test", "--test-concurrency=1", ...plans[0].files]);
  assert.deepEqual(plans[1].argv, ["--import", "tsx", "--test", ...plans[1].files]);
  for (const child of plans) {
    assert.equal(child.command, NODE);
    assert.deepEqual(child.options, { cwd: ROOT, shell: false, stdio: "inherit" });
    assert.ok(child.files.length > 0, "Every successful plan has explicit test files");
    assert.ok(child.files.every(file => child.argv.includes(file)));
    assert.equal(Object.hasOwn(child.options, "env"), false, "No NODE_OPTIONS injection");
    assert.ok(child.files.every(file => !path.basename(file).startsWith(".")));
  }
  const all = plans.flatMap(p => p.files);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual([...all].sort(), [...GUARDED, ORDINARY, "tests/z new ordinary.test.ts"].map(p => path.join(ROOT, p)).sort());
  assert.equal(plans[1].argv.includes(path.join(ROOT, GUARD)), false);
});

test("focused mode selects the complete guarded group and reports no ordinary success", () => {
  const { result, calls } = run({ args: ["--group=pba"] });
  assert.equal(result.statusCode, 0);
  assert.deepEqual(result.completedGroups, ["pba"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].argv.slice(6), [...GUARDED].sort().map(p => path.join(ROOT, p)));
});

test("default repository root comes from the runner module even with injected I/O", () => {
  let observed;
  const expected = fileURLToPath(new URL("../../", import.meta.url));
  const result = runProductAuthorityTestGroups({
    args: ["--group=pba"], moduleNamespace: CAPABLE, execPath: NODE,
    io: { realpathSync(target) { observed = target; throw new Error("synthetic stop before filesystem"); } },
    spawn() { assert.fail("No child before root metadata"); }, diagnostic() {},
  });
  assert.equal(observed, expected);
  assert.equal(result.statusCode, 1);
});

test("focused mode still validates omitted ordinary inventory before its guarded child", () => {
  const { result, calls } = run({ args: ["--group=pba"], io: syntheticIo({ types: { [ORDINARY]: "directory" } }) });
  assert.equal(result.statusCode, 1);
  assert.equal(calls.length, 0);
});

for (const args of [["--unknown"], ["--group=ordinary"], ["--group=pba", "--group=pba"], ["--group=pba", "extra"], ["--"]]) {
  test(`unknown arguments ${JSON.stringify(args)} fail before metadata or child activity`, () => {
    const io = syntheticIo();
    const { result, calls } = run({ args, io });
    assert.equal(result.statusCode, 1);
    assert.equal(calls.length, 0);
    assert.deepEqual(result.completedGroups, []);
    assert.equal(io.reads.length, 0);
  });
}

for (const moduleNamespace of [{}, { registerHooks: undefined }, { registerHooks: true }]) {
  for (const args of [[], ["--group=pba"]]) {
    test(`missing callable registerHooks fails both modes before inventory or children: ${JSON.stringify(args)}`, () => {
      const io = syntheticIo();
      const { result, calls, diagnostics } = run({ io, args, moduleNamespace });
      assert.equal(result.statusCode, 1);
      assert.equal(calls.length, 0);
      assert.equal(io.reads.length, 0);
      assert.match(diagnostics[0].message, /registerHooks/);
    });
  }
}

test("all-guarded default inventory fails before any child despite otherwise conserved membership", () => {
  const io = syntheticIo({ names: GUARDED.map(p => path.basename(p)) });
  const { result, calls, diagnostics } = run({ io });
  assert.equal(result.statusCode, 1);
  assert.equal(calls.length, 0);
  assert.deepEqual(result.completedGroups, []);
  assert.match(diagnostics[0].message, /ORDINARY_GROUP_EMPTY/);
});

test("all-guarded inventory is valid in focused mode with one nonempty explicit child", () => {
  const io = syntheticIo({ names: GUARDED.map(p => path.basename(p)) });
  const { result, calls } = run({ args: ["--group=pba"], io });
  assert.equal(result.statusCode, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].argv.slice(6), [...GUARDED].sort().map(p => path.join(ROOT, p)));
});

for (const args of [[], ["--group=pba"]]) {
  test(`empty guarded manifest is an inventory failure in ${JSON.stringify(args)}`, () => {
    assert.throws(() => plan({ ...inventory(), guardedTests: [] }, args), /GUARDED_GROUP_EMPTY/);
  });
}

for (const mutation of [
  { name: "duplicate guarded path", change: input => { input.guardedTests.push(input.guardedTests[0]); } },
  { name: "guarded path outside root", change: input => { input.guardedTests[0] = "../outside.test.ts"; } },
  { name: "absolute guarded path", change: input => { input.guardedTests[0] = "/outside.test.ts"; } },
  { name: "missing guarded discovery member", change: input => { input.discoveredTests = input.discoveredTests.filter(p => p !== GUARDED[0]); } },
  { name: "duplicate discovered path", change: input => { input.discoveredTests.push(input.discoveredTests[0]); } },
  { name: "missing required custody record", change: input => { delete input.custody[GUARDED[0]]; } },
]) {
  test(`complete inventory rejects ${mutation.name} before plans exist`, () => {
    const input = structuredClone(inventory());
    mutation.change(input);
    assert.throws(() => plan(input), /PBA_TEST_/);
  });
}

for (const name of ["product-authority-new.test.ts", "product-build-authority-new.test.ts", "setfarm-product-build-authority-new.test.ts"]) {
  test(`visible unclassified family member ${name} fails before either group`, () => {
    const io = syntheticIo({ names: [...GUARDED.map(p => path.basename(p)), path.basename(ORDINARY), name] });
    const { result, calls } = run({ io });
    assert.equal(result.statusCode, 1);
    assert.equal(calls.length, 0);
  });
}

for (const args of [[], ["--group=pba"]]) {
  for (const invalid of [
    { name: "missing guard", types: { [GUARD]: "missing" } },
    { name: "guard directory", types: { [GUARD]: "directory" } },
    { name: "nonregular guard", types: { [GUARD]: "socket" } },
    { name: "final guard symlink to an in-repo file", types: { [GUARD]: "symlink" }, physical: { [GUARD]: path.join(ROOT, ORDINARY) } },
    { name: "guard parent symlink", types: { "tests/fixtures": "symlink" } },
    { name: "guard physical escape", physical: { [GUARD]: "/outside/guard.mjs" } },
    { name: "guard physical prefix collision", physical: { [GUARD]: `${ROOT}-sibling/guard.mjs` } },
  ]) {
    test(`${invalid.name} fails ${JSON.stringify(args)} before spawning`, () => {
      const { result, calls } = run({ args, io: syntheticIo(invalid) });
      assert.equal(result.statusCode, 1);
      assert.equal(calls.length, 0);
      assert.deepEqual(result.completedGroups, []);
    });
  }
}

for (const target of [GUARDED[0], ORDINARY]) {
  for (const type of ["missing", "directory", "socket", "symlink"]) {
    test(`matching ${target} ${type} is not silently omitted`, () => {
      const { result, calls } = run({ io: syntheticIo({ types: { [target]: type } }) });
      assert.equal(result.statusCode, 1);
      assert.equal(calls.length, 0);
    });
  }
}
test("matching test physical escape and tests-parent symlink both fail closed", () => {
  for (const io of [syntheticIo({ physical: { [GUARDED[0]]: `${ROOT}-other/a.test.ts` } }), syntheticIo({ types: { tests: "symlink" } })]) {
    const { result, calls } = run({ io });
    assert.equal(result.statusCode, 1);
    assert.equal(calls.length, 0);
  }
});

test("valid physical guard is inspected as metadata without any source read or import", () => {
  const io = syntheticIo();
  const plans = plan(collectProductAuthorityTestInventory(ROOT, io));
  assert.equal(plans.length, 2);
  assert.ok(io.reads.some(([operation, target]) => operation === "lstat" && target === path.join(ROOT, GUARD)));
  assert.ok(io.reads.some(([operation, target]) => operation === "realpath" && target === path.join(ROOT, GUARD)));
  assert.ok(io.reads.every(([operation]) => ["lstat", "realpath", "readdir"].includes(operation)));
});

for (const [result, expected] of [
  [{ status: 0 }, 0], [{ status: 1 }, 1], [{ status: 7 }, 7],
  [{ status: null }, 1], [{ status: 0, signal: "SIGTERM" }, 1],
  [{ status: null, signal: "SIGKILL" }, 1], [{ status: 0, error: new Error("spawn failure") }, 1],
  [{}, 1], [undefined, 1], [{ status: -1 }, 1],
]) {
  test(`natural-result interpretation ${JSON.stringify(result)} is ${expected}`, () => {
    assert.equal(interpretProductAuthorityChildResult(result), expected);
  });
}
for (const failure of [{ status: 1 }, { status: 7 }, { status: null }, { status: 0, signal: "SIGTERM" }, { error: new Error("spawn result failure") }, new Error("spawn throws")]) {
  test(`guarded child failure stops ordinary group: ${String(failure)}`, () => {
    const { result, calls, diagnostics } = run({ results: [failure, { status: 0 }] });
    assert.equal(result.statusCode, failure.status === 7 ? 7 : 1);
    assert.equal(calls.length, 1);
    assert.deepEqual(result.completedGroups, []);
    assert.equal(result.failedGroup, "pba");
    assert.deepEqual(diagnostics.filter(d => d.schema === "setfarm.product-authority-test-plan.v1").map(d => d.group), ["pba"]);
  });
}
test("ordinary failure preserves its natural status and only the completed guarded group", () => {
  const { result, calls } = run({ results: [{ status: 0 }, { status: 7 }] });
  assert.equal(calls.length, 2);
  assert.equal(result.statusCode, 7);
  assert.deepEqual(result.completedGroups, ["pba"]);
  assert.equal(result.failedGroup, "ordinary");
});
test("diagnostic deterministic argv record precedes every spawn and success needs both groups naturally zero", () => {
  const events = [];
  const result = executeProductAuthorityTestPlans(plan(), {
    diagnostic: record => events.push(["plan", record]),
    spawn(command, argv, options) { events.push(["spawn", { command, argv, options }]); return { status: 0 }; },
  });
  assert.equal(result.statusCode, 0);
  assert.deepEqual(result.completedGroups, ["pba", "ordinary"]);
  assert.deepEqual(events.map(e => e[0]), ["plan", "spawn", "plan", "spawn"]);
  assert.deepEqual(events[0][1].argv, events[1][1].argv);
  assert.deepEqual(events[2][1].argv, events[3][1].argv);
});
test("executor rejects any empty child file list before any child", () => {
  const plans = plan();
  const invalid = [...plans, { ...plans[1], files: [] }];
  let children = 0;
  assert.throws(() => executeProductAuthorityTestPlans(invalid, { spawn() { children += 1; }, diagnostic() {} }), /EMPTY_CHILD/);
  assert.equal(children, 0);
});

test("package data integrates the separate unit/group scripts and preserves the exact downstream chain", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["test:pba-runner"], "node --test scripts/__tests__/product-authority-test-runner.test.mjs");
  assert.equal(pkg.scripts["test:pba"], "node scripts/run-product-authority-test-groups.mjs --group=pba");
  const suffix = " && npm run test:cleanup-ops && npm run test:operational-snapshot && npm run test:steps && npm run test:status && npm run test:scripts && npm run test:product-compiler && npm run test:execution-attempts && npm run test:findings && npm run test:evidence && npm run test:recovery && npm run test:evals && npm run test:internal-production";
  assert.equal(pkg.scripts.test, `npm run test:pba-runner && node scripts/run-product-authority-test-groups.mjs${suffix}`);
  assert.equal(pkg.engines.node, ">=22", "Production engine range is retained; runner capability is tested separately");
});

// Root-only later execution: no product guard/test/fixture is imported. The
// harmless preload and children exist only inside this test's owned temp root.
test("temp-only surrogate children isolate preload state, import gating and natural exit7", () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-pba-runner-unit-")));
  try {
    const preload = path.join(root, "harmless preload.mjs");
    const guarded = path.join(root, "guarded child.mjs");
    const ordinary = path.join(root, "ordinary child.mjs");
    const failure = path.join(root, "failure child.mjs");
    const never = path.join(root, "never child.mjs");
    writeFileSync(preload, "globalThis.__pbaSurrogate = true;\n");
    writeFileSync(guarded, `import assert from 'node:assert/strict'; assert.equal(globalThis.__pbaSurrogate, true); assert.equal(process.cwd(), ${JSON.stringify(root)});\n`);
    writeFileSync(ordinary, "import assert from 'node:assert/strict'; assert.equal(globalThis.__pbaSurrogate, undefined);\n");
    writeFileSync(failure, "process.exitCode = 7;\n");
    writeFileSync(never, "process.exitCode = 99;\n");
    const make = (group, file, prefix = []) => ({ group, command: process.execPath, argv: [...prefix, file], files: [file], options: { cwd: root, shell: false, stdio: "inherit" } });
    const launched = [];
    const result = executeProductAuthorityTestPlans([
      make("pba", guarded, ["--import", pathToFileURL(preload).href]),
      make("ordinary", ordinary), make("synthetic-failure", failure), make("must-not-run", never),
    ], { spawn(command, argv, options) { launched.push([...argv]); return spawnSync(command, argv, options); }, diagnostic() {} });
    assert.equal(result.statusCode, 7);
    assert.deepEqual(result.completedGroups, ["pba", "ordinary"]);
    assert.equal(result.failedGroup, "synthetic-failure");
    assert.equal(launched.length, 3);
    // Copy only the built-in-only runner as source data; import must not enter
    // main even though this temp repository has no tests or product guard.
    mkdirSync(path.join(root, "scripts"));
    const copy = path.join(root, "scripts/run-product-authority-test-groups.mjs");
    writeFileSync(copy, readFileSync(new URL("../run-product-authority-test-groups.mjs", import.meta.url)));
    const imported = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(pathToFileURL(copy).href)});`], { cwd: root, shell: false, encoding: "utf8" });
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, "");
    assert.equal(imported.stderr, "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
