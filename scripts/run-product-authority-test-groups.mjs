import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SF_GUARDED_TESTS = Object.freeze([
  "tests/product-authority-sf-import-isolation.test.ts",
  "tests/product-build-authority-v3.test.ts",
  "tests/product-build-authority-http.test.ts",
]);
export const SF_PBA_GUARD = "tests/fixtures/product-authority-sf-inert-import-guard.mjs";
const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FILESYSTEM = { lstatSync, readdirSync, realpathSync };

function fail(code, detail) {
  throw new Error(`PBA_TEST_${code}: ${detail}`);
}

function modeFromArgs(args) {
  if (!Array.isArray(args)) fail("ARGUMENTS_INVALID", "Expected an argument array");
  if (args.length === 0) return "default";
  if (args.length === 1 && args[0] === "--group=pba") return "pba";
  fail("ARGUMENTS_INVALID", "Only --group=pba or no arguments are supported");
}

function requireCapability(moduleNamespace) {
  if (typeof moduleNamespace?.registerHooks !== "function") {
    fail("REGISTER_HOOKS_REQUIRED", "node:module registerHooks is required (Node 22.18+ on the Node22 line, or verified equivalent capability)");
  }
}

function requireRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)
    || value.includes("\\") || value !== path.posix.normalize(value)
    || value.split("/").some(part => part === "" || part === "." || part === "..")) {
    fail("PATH_INVALID", String(value));
  }
  return value;
}

function isConfined(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Pure validation of lstat/realpath metadata; never reads or evaluates a file. */
function validateCustody(root, relative, record, finalType = "file") {
  requireRelativePath(relative);
  if (!record || !Array.isArray(record.components)) fail("INPUT_MISSING", relative);
  const parts = relative.split("/");
  if (record.components.length !== parts.length) fail("INPUT_NONREGULAR", relative);
  for (let index = 0; index < parts.length; index += 1) {
    const component = record.components[index];
    const expected = parts.slice(0, index + 1).join("/");
    const type = index === parts.length - 1 ? finalType : "directory";
    if (component.path !== expected || component.type !== type) fail("INPUT_NONREGULAR", expected);
  }
  const physical = record.physicalPath;
  if (typeof physical !== "string" || !path.isAbsolute(physical)
    || !isConfined(root, physical) || physical !== path.join(root, relative)) {
    fail("INPUT_PHYSICAL_ESCAPE", relative);
  }
}

function fileType(stat) {
  if (stat.isSymbolicLink()) return "symlink";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  return "nonregular";
}

function readCustodyRecord(root, relative, io, finalType = "file") {
  requireRelativePath(relative);
  const parts = relative.split("/");
  const components = [];
  for (let index = 0; index < parts.length; index += 1) {
    const component = parts.slice(0, index + 1).join("/");
    let stat;
    try { stat = io.lstatSync(path.join(root, component)); }
    catch (error) { throw new Error(`PBA_TEST_INPUT_MISSING: ${component}`, { cause: error }); }
    const type = fileType(stat);
    components.push({ path: component, type });
    // Do not follow a symlink or traverse a non-directory even to collect metadata.
    if (type !== (index === parts.length - 1 ? finalType : "directory")) return { components };
  }
  return { components, physicalPath: io.realpathSync(path.join(root, relative)) };
}

/** Only immediate, visible literal .test.ts names belonged to the old SF glob. */
function oldGlobMember(relative) {
  const name = relative.slice("tests/".length);
  return relative.startsWith("tests/") && !name.includes("/") && !name.startsWith(".") && name.endsWith(".test.ts");
}

/** Metadata-only I/O boundary. All inventory validation still precedes child planning. */
export function collectProductAuthorityTestInventory(repoRoot, io = FILESYSTEM) {
  if (typeof repoRoot !== "string" || !path.isAbsolute(repoRoot)) fail("ROOT_INVALID", "Absolute repository root required");
  const root = io.realpathSync(repoRoot);
  if (!path.isAbsolute(root) || !io.lstatSync(root).isDirectory()) fail("ROOT_INVALID", root);
  const directory = readCustodyRecord(root, "tests", io, "directory");
  validateCustody(root, "tests", directory, "directory");
  const names = io.readdirSync(path.join(root, "tests"));
  if (!Array.isArray(names) || names.some(name => typeof name !== "string")) fail("INVENTORY_INVALID", "Expected immediate filenames");
  const discoveredTests = names.map(name => `tests/${name}`).filter(oldGlobMember).sort();
  const custody = {};
  for (const relative of new Set([SF_PBA_GUARD, ...SF_GUARDED_TESTS, ...discoveredTests])) {
    custody[relative] = readCustodyRecord(root, relative, io);
  }
  return { repoRoot: root, discoveredTests, guardedTests: [...SF_GUARDED_TESTS], guardPath: SF_PBA_GUARD, custody };
}

/** Pure complete-inventory planner. A failure constructs no executable child plans. */
export function planProductAuthorityTestGroups({ inventory, args = [], execPath, moduleNamespace }) {
  const mode = modeFromArgs(args);
  requireCapability(moduleNamespace);
  const { repoRoot, discoveredTests, guardedTests, guardPath, custody } = inventory;
  if (typeof repoRoot !== "string" || !path.isAbsolute(repoRoot)) fail("ROOT_INVALID", "Absolute physical repository root required");
  if (typeof execPath !== "string" || !path.isAbsolute(execPath)) fail("EXECUTABLE_INVALID", "Absolute Node executable required");
  if (!Array.isArray(guardedTests) || guardedTests.length === 0) fail("GUARDED_GROUP_EMPTY", "Required PBA manifest is empty");
  if (!Array.isArray(discoveredTests) || !custody) fail("INVENTORY_INVALID", "Missing discovery or custody records");
  const guarded = new Set();
  for (const relative of guardedTests) {
    requireRelativePath(relative);
    if (guarded.has(relative)) fail("DUPLICATE_REQUIRED_PATH", relative);
    guarded.add(relative);
  }
  validateCustody(repoRoot, guardPath, custody[guardPath]);
  const baseline = new Set();
  for (const relative of discoveredTests) {
    requireRelativePath(relative);
    if (!oldGlobMember(relative)) fail("DISCOVERY_INVALID", relative);
    if (baseline.has(relative)) fail("DUPLICATE_DISCOVERED_PATH", relative);
    baseline.add(relative);
    const name = path.basename(relative);
    if ((name.includes("product-authority") || name.includes("product-build-authority")) && !guarded.has(relative)) {
      fail("UNCLASSIFIED_AUTHORITY_TEST", relative);
    }
    validateCustody(repoRoot, relative, custody[relative]);
  }
  for (const relative of guarded) {
    validateCustody(repoRoot, relative, custody[relative]);
    if (!baseline.has(relative)) fail("REQUIRED_TEST_NOT_DISCOVERED", relative);
  }
  const ordinary = [...baseline].filter(relative => !guarded.has(relative)).sort();
  const guardedFiles = [...guarded].sort();
  if (mode === "default" && ordinary.length === 0) fail("ORDINARY_GROUP_EMPTY", "Default mode requires ordinary tests before any child");
  // SF has no added .tsx member: disjoint O/G and O union G must equal old B.
  const union = new Set([...ordinary, ...guardedFiles]);
  if (ordinary.some(relative => guarded.has(relative)) || union.size !== baseline.size || [...baseline].some(relative => !union.has(relative))) {
    fail("MEMBERSHIP_NOT_CONSERVED", "O/G partition differs from old SF membership");
  }

  // Only now, after every mode, capability and complete inventory check, make argv.
  const child = (group, members, prefix) => {
    if (members.length === 0) fail("EMPTY_CHILD", group);
    const files = members.map(relative => path.join(repoRoot, relative));
    return { group, command: execPath, argv: [...prefix, ...files], files, options: { cwd: repoRoot, shell: false, stdio: "inherit" } };
  };
  const plans = [child("pba", guardedFiles, ["--import", path.join(repoRoot, guardPath), "--import", "tsx", "--test", "--test-concurrency=1"])];
  if (mode === "default") plans.push(child("ordinary", ordinary, ["--import", "tsx", "--test"]));
  return plans;
}

/** Only a natural numeric status0 succeeds; signals/errors cannot be success. */
export function interpretProductAuthorityChildResult(result) {
  if (!result || result.error || result.signal != null) return 1;
  return Number.isInteger(result.status) && result.status >= 0 ? result.status : 1;
}

/** Sequential, explicit argv execution; no ambient execArgv or NODE_OPTIONS edits. */
export function executeProductAuthorityTestPlans(plans, { spawn = spawnSync, diagnostic }) {
  if (!Array.isArray(plans) || plans.length === 0) fail("EMPTY_CHILD", "No selected groups");
  for (const plan of plans) {
    if (!Array.isArray(plan.files) || plan.files.length === 0 || !Array.isArray(plan.argv)
      || plan.files.some(file => !plan.argv.includes(file))) fail("EMPTY_CHILD", plan.group);
  }
  const completedGroups = [];
  for (const plan of plans) {
    diagnostic({ schema: "setfarm.product-authority-test-plan.v1", group: plan.group, command: plan.command, argv: plan.argv, cwd: plan.options.cwd, shell: false, stdio: "inherit" });
    let result;
    try { result = spawn(plan.command, plan.argv, plan.options); }
    catch (error) { result = { error }; }
    const statusCode = interpretProductAuthorityChildResult(result);
    if (statusCode !== 0) return { statusCode, completedGroups, failedGroup: plan.group };
    completedGroups.push(plan.group);
  }
  return { statusCode: 0, completedGroups, failedGroup: null };
}

const printDiagnostic = record => process.stderr.write(`${JSON.stringify(record)}\n`);

/** Entry orchestration; exported for synthetic I/O/result tests, never runs on import. */
export function runProductAuthorityTestGroups({
  repoRoot = REPOSITORY_ROOT, args = [], execPath = process.execPath,
  moduleNamespace = nodeModule, io = FILESYSTEM, spawn = spawnSync, diagnostic = printDiagnostic,
} = {}) {
  try {
    modeFromArgs(args);
    requireCapability(moduleNamespace);
    const inventory = collectProductAuthorityTestInventory(repoRoot, io);
    const plans = planProductAuthorityTestGroups({ inventory, args, execPath, moduleNamespace });
    return executeProductAuthorityTestPlans(plans, { spawn, diagnostic });
  } catch (error) {
    diagnostic({ schema: "setfarm.product-authority-test-preflight-error.v1", message: error instanceof Error ? error.message : String(error) });
    return { statusCode: 1, completedGroups: [], failedGroup: null };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runProductAuthorityTestGroups({ args: process.argv.slice(2) }).statusCode;
}
