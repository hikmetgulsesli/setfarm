import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statfsSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { before, test, type TestContext } from "node:test";
import ts from "typescript";
import YAML from "yaml";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

// Real committed Source fixture + filesystem/DATA components only. This is not
// a finalized compiled build, activation, selected phase or public authority.
const root = fileURLToPath(new URL("../../", import.meta.url));
let assetRoot: string, SHA: string;
let initialize: typeof import("../../src/installation/fresh-installation-private-assets-v1.js").initializeFreshInstallationPrivateAssetsV1;
let readWorkflow: typeof import("../../src/installation/fresh-installation-private-assets-v1.js").readFreshInstallationPrivateWorkflowAssetsV1;
let readWorkspace: typeof import("../../src/installation/fresh-installation-private-assets-v1.js").readFreshInstallationPrivateAgentWorkspaceV1;
let assertAssets: typeof import("../../src/installation/fresh-installation-private-assets-v1.js").assertFreshInstallationPrivateAssetsV1;
let capture: typeof import("../../src/installation/fresh-installation-source-v1.js");
before(async () => {
  assert.equal(process.env.SETFARM_INSTALLATION_DIR, undefined, "filesystem DATA suite requires an unselected test process");
  const checkout = await freshSourceCheckoutFixture(); assetRoot = checkout.root; SHA = checkout.sha;
  const api = await import(pathToFileURL(path.join(assetRoot, "src/installation/fresh-installation-private-assets-v1.ts")).href);
  initialize = api.initializeFreshInstallationPrivateAssetsV1; readWorkflow = api.readFreshInstallationPrivateWorkflowAssetsV1;
  readWorkspace = api.readFreshInstallationPrivateAgentWorkspaceV1; assertAssets = api.assertFreshInstallationPrivateAssetsV1;
  capture = checkout.capture;
});
const source = (relative: string): string => readFileSync(path.join(root, relative), "utf8");
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
function fixture(t: TestContext) {
  const capacity = statfsSync(root, { bigint: true });
  assert.ok(capacity.bavail * capacity.bsize >= 8n * 1024n ** 3n + 32n * 1024n ** 2n,
    "private asset component requires32MiB above8GiB host floor");
  const container = mkdtempSync(path.join(realpathSync(tmpdir()), "setfarm-private-assets-component-"));
  chmodSync(container, 0o700);
  const identity = lstatSync(container);
  t.after(() => {
    const current = lstatSync(container);
    assert.equal(current.dev, identity.dev); assert.equal(current.ino, identity.ino);
    assert.equal(current.uid, identity.uid); assert.equal(current.isSymbolicLink(), false);
    rmSync(container, { recursive: true }); // This exact test-created tree only.
  });
  const directory = path.join(container, "installation"); mkdirSync(directory, { mode: 0o700 });
  writeFileSync(path.join(directory, "planned.json"), JSON.stringify({ sourceSha: SHA }) + "\n", { flag: "wx", mode: 0o600 });
  return { container, directory, runtime: path.join(directory, "runtime") };
}
function files(directory: string, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const name of readdirSync(directory).sort()) {
    const full = path.join(directory, name), relative = path.posix.join(prefix, name), stat = lstatSync(full);
    assert.equal(stat.isSymbolicLink(), false, "component tree must contain no alias: " + relative);
    if (stat.isDirectory()) for (const [key, value] of files(full, relative)) result.set(key, value);
    else { assert.equal(stat.isFile(), true); result.set(relative, digest(readFileSync(full))); }
  }
  return result;
}
function assertPrivateTree(directory: string): void {
  const stat = lstatSync(directory);
  assert.equal(stat.uid, process.getuid!()); assert.equal(stat.isSymbolicLink(), false);
  assert.equal(stat.mode & 0o7777, stat.isDirectory() ? 0o700 : 0o600);
  if (stat.isDirectory()) for (const name of readdirSync(directory)) assertPrivateTree(path.join(directory, name));
  else { assert.equal(stat.isFile(), true); assert.equal(stat.nlink, 1); }
}
type Agent = { id: string; workspace: { baseDir: string; files: Record<string, string>; skills?: string[] } };
function bundled() {
  return readdirSync(path.join(assetRoot, "workflows")).sort().flatMap(id => {
    const file = path.join(assetRoot, "workflows", id, "workflow.yml");
    if (!existsSync(file)) return [];
    const value = YAML.parse(readFileSync(file, "utf8")) as { id: string; agents: Agent[] };
    assert.equal(value.id, id); assert.ok(value.agents.length > 0);
    return [value];
  });
}
function declaration(relative: string, name: string): ts.FunctionDeclaration {
  const tree = ts.createSourceFile(relative, source(relative), ts.ScriptTarget.Latest, true);
  const nodes = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(nodes.length, 1, "fixed source declaration missing or ambiguous: " + name);
  return nodes[0]!;
}
function compile(node: ts.Node): string {
  return ts.transpileModule(node.getText(), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/^export /gm, "");
}
function calls(node: ts.Node): string[] {
  const names: string[] = [];
  const visit = (part: ts.Node): void => { if (ts.isCallExpression(part)) names.push(part.expression.getText()); ts.forEachChild(part, visit); };
  visit(node); return names;
}

test("exclusive initializer installs the actual fixed bundled workflow and private agent payloads", { timeout: 120_000 }, t => {
  const f = fixture(t); initialize(f.directory, SHA); assertAssets(f.runtime, SHA); assertPrivateTree(f.runtime);
  for (const relative of ["projects", "agent-scratch", "transcripts", "agents", "attempt-workspaces", "services", "logs", "runs",
    "workspaces/workflows", "sessions", "evals/results", "mobile", "mission-control/uploads", "mission-control/avatars"]) {
    assert.equal(lstatSync(path.join(f.runtime, relative)).isDirectory(), true, relative);
  }
  for (const name of ["projects.json", "deleted-projects.json"]) {
    const file = path.join(f.runtime, "mission-control", name);
    assert.equal(readFileSync(file, "utf8"), "[]\n"); assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), []);
  }
  assert.deepEqual(files(path.join(f.runtime, "workflows")), files(path.join(assetRoot, "workflows")));
  const gaps: string[] = []; let count = 0;
  for (const workflow of bundled()) {
    const observed = readWorkflow(f.runtime, SHA, workflow.id);
    assert.equal(observed.workflowId, workflow.id);
    assert.equal(observed.workflowDir, path.join(f.runtime, "workflows", workflow.id));
    assert.deepEqual(observed.agents.map(a => a.id), workflow.agents.map(a => `${workflow.id}_${a.id}`));
    for (const agent of workflow.agents) {
      count++;
      const id = `${workflow.id}_${agent.id}`, expected = path.join(f.runtime, "workspaces", "workflows", workflow.id, agent.workspace.baseDir);
      assert.equal(readWorkspace(f.runtime, SHA, id), expected);
      const actual = observed.agents.find(a => a.id === id)!;
      assert.equal(actual.workspaceDir, expected); assert.equal(actual.agentDir, path.join(f.runtime, "agents", id, "agent"));
      assert.equal(lstatSync(path.join(f.runtime, "agents", id, "sessions")).isDirectory(), true);
      const record = JSON.parse(readFileSync(path.join(actual.agentDir, "workspace.json"), "utf8"));
      assert.deepEqual(record, { schema: "setfarm.private-agent-workspace.v1", sourceSha: SHA, agentId: id, relative: path.relative(f.runtime, expected) });
      for (const [name, relative] of Object.entries(agent.workspace.files)) {
        assert.equal(digest(readFileSync(path.join(expected, name))), digest(readFileSync(path.resolve(assetRoot, "workflows", workflow.id, relative))));
      }
      assert.deepEqual(files(path.join(expected, "references")), files(path.join(assetRoot, "references")));
      for (const skill of agent.workspace.skills ?? []) {
        const local = path.join(assetRoot, "workflows", workflow.id, "skills", skill), shared = path.join(assetRoot, "skills", skill);
        const from = existsSync(local) ? local : existsSync(shared) ? shared : undefined;
        if (from) assert.deepEqual(files(path.join(expected, "skills", skill)), files(from));
        else { gaps.push(`${id}:${skill}`); assert.equal(existsSync(path.join(expected, "skills", skill)), false); }
      }
    }
  }
  const summary = JSON.parse(readFileSync(path.join(f.runtime, "asset-summary.json"), "utf8"));
  assert.deepEqual(summary, { schema: "setfarm.private-assets-data.v1", sourceSha: SHA, optionalSkillGaps: gaps });
  assert.equal(readWorkspace(f.runtime, SHA, "feature-dev_setup-repo"), readWorkspace(f.runtime, SHA, "feature-dev_setup-build"));
  assert.ok(gaps.length > 0, "current optional external skills must not be invented as installed");
  t.diagnostic(`filesystem DATA copies verified: ${files(path.join(assetRoot, "workflows")).size} workflow files, ${count} private agents; no build/SQL readiness`);
});

test("initializer does not import optional HOME skills or touch unrelated sentinel data", t => {
  const f = fixture(t), home = path.join(f.container, "unrelated-home");
  mkdirSync(path.join(home, ".openclaw", "workspace", "skills", "setup-auditor"), { recursive: true, mode: 0o700 });
  const sentinel = path.join(home, ".openclaw", "workspace", "skills", "setup-auditor", "SKILL.md");
  writeFileSync(sentinel, "UNRELATED_PRIVATE_SENTINEL\n", { mode: 0o600 });
  const before = files(home), savedHome = process.env.HOME, savedProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home; process.env.USERPROFILE = home; initialize(f.directory, SHA);
  } finally {
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
    if (savedProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedProfile;
  }
  assert.deepEqual(files(home), before);
  const assets = readWorkflow(f.runtime, SHA, "feature-dev"), setup = assets.agents.find(a => a.id === "feature-dev_setup-build")!;
  assert.equal(existsSync(path.join(setup.workspaceDir, "skills", "setup-auditor")), false);
  const summary = JSON.parse(readFileSync(path.join(f.runtime, "asset-summary.json"), "utf8"));
  assert.ok(summary.optionalSkillGaps.includes("feature-dev_setup-build:setup-auditor"));
});

for (const variant of ["existing-runtime", "extra-installation-file", "wrong-planned-sha", "public-planned-mode"] as const) {
  test(`initializer refuses ${variant} before private provisioning and preserves the evidence`, t => {
    const f = fixture(t);
    if (variant === "existing-runtime") { mkdirSync(f.runtime, { mode: 0o700 }); writeFileSync(path.join(f.runtime, "sentinel"), "retained", { mode: 0o600 }); }
    if (variant === "extra-installation-file") writeFileSync(path.join(f.directory, "foreign.txt"), "retained", { mode: 0o600 });
    if (variant === "wrong-planned-sha") writeFileSync(path.join(f.directory, "planned.json"), JSON.stringify({ sourceSha: "b".repeat(40) }));
    if (variant === "public-planned-mode") chmodSync(path.join(f.directory, "planned.json"), 0o644);
    const before = files(f.directory);
    assert.throws(() => initialize(f.directory, SHA), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
    assert.deepEqual(files(f.directory), before);
  });
}

for (const variant of ["missing-workflow", "changed-workflow", "changed-fragment", "extra-workflow-file", "extra-empty-workflow-directory", "changed-bootstrap", "missing-agent-record", "retargeted-agent-record", "linked-bootstrap"] as const) {
  test(`private asset reopen refuses ${variant} without repair or installation replay`, t => {
    const f = fixture(t); initialize(f.directory, SHA);
    const workflowFile = path.join(f.runtime, "workflows", "feature-dev", "workflow.yml");
    const workspace = readWorkspace(f.runtime, SHA, "feature-dev_planner"), bootstrap = path.join(workspace, "AGENTS.md");
    const record = path.join(f.runtime, "agents", "feature-dev_planner", "agent", "workspace.json");
    let changed: string = workflowFile;
    if (variant === "missing-workflow") unlinkSync(workflowFile);
    if (variant === "changed-workflow") writeFileSync(workflowFile, readFileSync(workflowFile, "utf8") + "\n# tampered DATA\n");
    if (variant === "changed-fragment") {
      const fragments = path.join(f.runtime, "workflows", "_fragments");
      changed = path.join(fragments, readdirSync(fragments).find(name => lstatSync(path.join(fragments, name)).isFile())!);
      writeFileSync(changed, readFileSync(changed, "utf8") + "\nTAMPERED_FRAGMENT\n");
    }
    if (variant === "extra-workflow-file") { changed = path.join(f.runtime, "workflows", "feature-dev", "foreign.txt"); writeFileSync(changed, "retained", { mode: 0o600 }); }
    if (variant === "extra-empty-workflow-directory") { changed = path.join(f.runtime, "workflows", "feature-dev", "foreign-empty"); mkdirSync(changed, { mode: 0o700 }); }
    if (variant === "changed-bootstrap") { changed = bootstrap; writeFileSync(bootstrap, "TAMPERED_BOOTSTRAP\n"); }
    if (variant === "missing-agent-record") { changed = record; unlinkSync(record); }
    if (variant === "retargeted-agent-record") { changed = record; const data = JSON.parse(readFileSync(record, "utf8")); data.relative = "../../unrelated-home"; writeFileSync(record, JSON.stringify(data)); }
    if (variant === "linked-bootstrap") {
      changed = bootstrap; const unrelated = path.join(f.container, "unrelated.txt"); writeFileSync(unrelated, "UNRELATED_RETAINED", { mode: 0o600 });
      unlinkSync(bootstrap); symlinkSync(unrelated, bootstrap);
    }
    const before = existsSync(changed) ? lstatSync(changed).isDirectory() ? readdirSync(changed) : readFileSync(changed) : null;
    assert.throws(() => readWorkflow(f.runtime, SHA, "feature-dev"), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
    assert.throws(() => initialize(f.directory, SHA), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
    if (before === null) assert.equal(existsSync(changed), false);
    else if (Array.isArray(before)) assert.deepEqual(readdirSync(changed), before);
    else assert.deepEqual(readFileSync(changed), before);
    if (variant === "linked-bootstrap") assert.equal(lstatSync(bootstrap).isSymbolicLink(), true);
  });
}

test("unknown/traversing agents, crossed SHA and linked private workspace never acquire a fallback", t => {
  const f = fixture(t); initialize(f.directory, SHA);
  for (const id of ["unknown_agent", "feature-dev_unknown", "../feature-dev_planner", "feature-dev_planner/../../elsewhere"]) {
    assert.throws(() => readWorkspace(f.runtime, SHA, id), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
  }
  assert.throws(() => readWorkflow(f.runtime, "b".repeat(40), "feature-dev"), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
  assert.throws(() => readWorkflow(f.runtime, SHA, "../feature-dev"), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
  const workspace = readWorkspace(f.runtime, SHA, "feature-dev_planner"), retained = workspace + ".retained";
  // No contents are destroyed: move this owned component directory aside and leave a link alias.
  renameSync(workspace, retained); symlinkSync(retained, workspace, "dir");
  assert.throws(() => readWorkspace(f.runtime, SHA, "feature-dev_planner"), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
  assert.equal(lstatSync(workspace).isSymbolicLink(), true); assert.equal(existsSync(path.join(retained, "AGENTS.md")), true);
});

test("asset initialization is after the exclusive plan and before the first PostgreSQL constructor", () => {
  const create = declaration("src/installation/fresh-installation-v1.ts", "createFreshInstallationV1"), text = create.getText();
  const planned = text.indexOf('privateRecord(directory, "planned.json"');
  const assets = text.indexOf("initializeFreshInstallationPrivateAssetsV1(directory, sourceSha)");
  const firstPool = text.indexOf("postgres(u.href");
  assert.ok(planned >= 0 && assets > planned && firstPool > assets);
  assert.ok(text.indexOf("CREATE ROLE") > firstPool);
});

test("selected install/provision source branches require the actual entry then return only existing private assets", () => {
  for (const [relative, name] of [["src/installer/install.ts", "installWorkflow"], ["src/installer/agent-provision.ts", "provisionAgents"]]) {
    const fn = declaration(relative!, name!);
    assert.equal(fn.body!.statements[0]!.getText(), "assertFreshInstallationSelectionUnchangedV1();");
    const branch = fn.body!.statements[1]!;
    assert.equal(ts.isIfStatement(branch), true);
    const selected = branch as ts.IfStatement;
    assert.equal(selected.expression.getText(), "freshInstallationSelectionV1");
    const text = selected.thenStatement.getText(), actualCalls = calls(selected.thenStatement);
    assert.match(text, /import\("\.\.\/installation\/fresh-installation-entry-v1\.js"\)/);
    assert.ok(actualCalls.indexOf("entry.prepareFreshInstallationOperationalEntryV1") >= 0);
    assert.ok(actualCalls.indexOf("entry.assertFreshInstallationOperationalEntryV1") > actualCalls.indexOf("entry.prepareFreshInstallationOperationalEntryV1"));
    assert.ok(actualCalls.indexOf("readFreshInstallationPrivateWorkflowAssetsV1") > actualCalls.indexOf("entry.assertFreshInstallationOperationalEntryV1"));
    for (const forbidden of ["fetchWorkflow", "readOpenClawConfig", "writeOpenClawConfig", "updateMainAgentGuidance", "installSetfarmSkill", "installExternalSkills", "ensureDir"]) {
      assert.equal(actualCalls.includes(forbidden), false, forbidden);
    }
    assert.ok(text.includes("return "), "selected asset branch cannot fall through to shared installation");
  }
});

test("private run keeps shared sweep/cron calls inside the unselected prerequisite branch", () => {
  const fn = declaration("src/installer/run.ts", "runWorkflow"), guards: ts.IfStatement[] = [];
  const visit = (node: ts.Node, parents: readonly ts.Node[]): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["cleanAgentWorkspace", "ensureWorkflowCrons"].includes(node.expression.text)) {
      const legacy = parents.find((parent): parent is ts.IfStatement => ts.isIfStatement(parent) && parent.expression.getText() === "!freshInstallationSelectionV1");
      assert.ok(legacy, "shared prerequisite must remain unselected-only"); guards.push(legacy);
    }
    ts.forEachChild(node, child => visit(child, [...parents, node]));
  };
  visit(fn, []); assert.equal(guards.length, 2);
  assert.equal(fn.body!.statements[0]!.getText(), "assertFreshInstallationSelectionUnchangedV1();");
  const first = fn.body!.statements[1]!;
  assert.equal(ts.isIfStatement(first), true);
  assert.ok(calls(first).includes("entry.prepareFreshInstallationOperationalEntryV1"));
  assert.ok(calls(first).includes("readFreshInstallationPrivateWorkflowAssetsV1"));
});

test("selected classification DATA cannot enable shared gateway crons or workspace sweeping", () => {
  // Negative policy components only. No captured selection/operational positive is supplied.
  let selectedChecks = 0;
  const predicate = new Function("freshInstallationSelectionV1", "assertFreshInstallationSelectionUnchangedV1",
    compile(declaration("src/installer/agent-cron.ts", "gatewayAgentCronsEnabled")) + ";return gatewayAgentCronsEnabled;")({}, () => { selectedChecks++; }) as () => boolean;
  const saved = process.env.SETFARM_ENABLE_GATEWAY_AGENT_CRONS;
  try {
    process.env.SETFARM_ENABLE_GATEWAY_AGENT_CRONS = "1";
    assert.equal(predicate(), false); assert.equal(selectedChecks, 1);
  } finally { if (saved === undefined) delete process.env.SETFARM_ENABLE_GATEWAY_AGENT_CRONS; else process.env.SETFARM_ENABLE_GATEWAY_AGENT_CRONS = saved; }
  let effects = 0;
  const sweep = new Function("freshInstallationSelectionV1", "assertFreshInstallationSelectionUnchangedV1", "withDashboardCutoverLocalProducerSyncV2",
    compile(declaration("src/installer/worktree-ops.ts", "cleanAgentWorkspace")) + ";return cleanAgentWorkspace;")({}, () => {}, () => { effects++; throw Error("SHARED_SWEEP_REACHED"); }) as (id: string) => void;
  assert.throws(() => sweep("feature-dev_planner"), /FRESH_INSTALLATION_WORKSPACE_SWEEP_NOT_WIRED/); assert.equal(effects, 0);
});

test("selected workspace lookup refuses before private reads when actual entry refuses", () => {
  let reads = 0;
  const lookup = new Function("freshInstallationSelectionV1", "assertFreshInstallationSelectionUnchangedV1", "assertFreshInstallationOperationalEntryV1", "readFreshInstallationPrivateAgentWorkspaceV1",
    compile(declaration("src/installer/worktree-ops.ts", "getAgentWorkspacePath")) + ";return getAgentWorkspacePath;")({}, () => {}, () => { throw Error("ACTUAL_ENTRY_REFUSED_COMPONENT"); }, () => { reads++; throw Error("PRIVATE_READ_REACHED"); }) as (id: string) => unknown;
  assert.throws(() => lookup("feature-dev_planner"), /ACTUAL_ENTRY_REFUSED_COMPONENT/); assert.equal(reads, 0);
});

test("committed source fixture copies and tracks the fixed asset trees within its existing limits", () => {
  const text = source("tests/installation/fresh-source-checkout-fixture.ts");
  for (const name of ["workflows", "agents", "references", "skills"]) assert.ok(text.includes('"' + name + '"'), name + " source fixture input missing");
  assert.match(text, /for \(const relative of sourcePaths\) copy\(relative\)/);
  assert.match(text, /git\(\["add", "--", \.\.\.sourcePaths, "\.gitignore"\]\)/);
  assert.match(text, /bytes <= 64 \* 1024 \*\* 2/);
  assert.match(text, /count < 10_000 && depth < 32/);
});


test("fixed complete asset prerequisite checks every Source workflow and retains mutable MC registry data", t => {
  const f = fixture(t); initialize(f.directory, SHA);
  const projects = path.join(f.runtime, "mission-control", "projects.json");
  writeFileSync(projects, JSON.stringify([{ id: "component-project", name: "Owned DATA" }]) + "\n");
  assertAssets(f.runtime, SHA);
  const other = bundled().find(workflow => workflow.id !== "feature-dev")!;
  assert.ok(other, "complete-asset case needs another actual bundled workflow");
  const missing = path.join(f.runtime, "workflows", other.id, "workflow.yml"); unlinkSync(missing);
  assert.throws(() => assertAssets(f.runtime, SHA), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
  assert.equal(existsSync(missing), false); assert.deepEqual(JSON.parse(readFileSync(projects, "utf8")), [{ id: "component-project", name: "Owned DATA" }]);
});

function git(args: string[]): string {
  return execFileSync("/usr/bin/git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: assetRoot,
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
    encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024 }).trim();
}
for (const variant of ["hidden-tracked-bytes", "ignored-extra-file", "ignored-empty-directory"] as const) {
  test(`actual committed Source asset snapshot rejects ${variant} before copy without changing the Git head`, async t => {
    const f = fixture(t), tracked = "workflows/feature-dev/workflow.yml", file = path.join(assetRoot, tracked);
    const original = readFileSync(file), exclude = path.join(assetRoot, ".git", "info", "exclude"), originalExclude = readFileSync(exclude);
    const extra = path.join(assetRoot, variant === "ignored-extra-file" ? "references/.ignored-asset-component" : "skills/.ignored-asset-component");
    try {
      if (variant === "hidden-tracked-bytes") {
        git(["update-index", "--assume-unchanged", "--", tracked]);
        writeFileSync(file, Buffer.concat([original, Buffer.from("\n# hidden component change\n")]));
      } else {
        writeFileSync(exclude, Buffer.concat([originalExclude, Buffer.from("\n/.unused-pattern\n/references/.ignored-asset-component\n/skills/.ignored-asset-component\n")]));
        if (variant === "ignored-extra-file") writeFileSync(extra, "UNTRACKED_IGNORED_DATA\n", { mode: 0o600 });
        else mkdirSync(extra, { mode: 0o700 });
      }
      assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "", "test must exercise a change hidden from porcelain status");
      assert.equal(git(["rev-parse", "HEAD"]), SHA);
      assert.throws(() => capture.readFreshInstallationSourceAssetsV1(SHA), /FRESH_INSTALLATION_SOURCE_UNAVAILABLE/);
      await assert.rejects(capture.captureFreshInstallationSourceShaV1(), /FRESH_INSTALLATION_SOURCE_UNAVAILABLE/);
      assert.throws(() => initialize(f.directory, SHA), /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
      assert.equal(existsSync(f.runtime), false, "Source mismatch must not begin private copy");
    } finally {
      if (variant === "hidden-tracked-bytes") { writeFileSync(file, original); git(["update-index", "--no-assume-unchanged", "--", tracked]); }
      else { rmSync(extra, { recursive: true, force: true }); writeFileSync(exclude, originalExclude); }
    }
    assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
    assert.equal(capture.readFreshInstallationSourceAssetsV1(SHA).get(tracked)?.equals(original), true);
  });
}

test("private FD DATA reader rejects growth, pathname swap and primary-plus-close failure with bounded reads", t => {
  const f = fixture(t), actual = declaration("src/installation/fresh-installation-private-assets-v1.ts", "regular");
  for (const variant of ["growth", "pathname-swap", "primary-plus-close"] as const) {
    const file = path.join(f.container, "read-" + variant), original = Buffer.alloc(4096, 65);
    writeFileSync(file, original, { mode: 0o600 });
    let reads = 0, requested = 0, closes = 0;
    const read = (fd: number, buffer: Buffer, offset: number, length: number, position: number | null): number => {
      requested += length;
      const n = fs.readSync(fd, buffer, offset, length, position);
      if (++reads === 1) {
        if (variant === "growth") fs.appendFileSync(file, "X");
        if (variant === "pathname-swap") { renameSync(file, file + ".held"); writeFileSync(file + ".unrelated", "SENTINEL", { mode: 0o600 }); symlinkSync(file + ".unrelated", file); }
        if (variant === "primary-plus-close") throw Error("COMPONENT_PRIMARY_READ_FAILURE");
      }
      return n;
    };
    const close = (fd: number): void => { closes++; fs.closeSync(fd); if (variant === "primary-plus-close") throw Error("COMPONENT_CLOSE_FAILURE"); };
    const invoke = new Function("openSync", "constants", "fstatSync", "readSync", "lstatSync", "realpathSync", "closeSync", "refuse",
      compile(actual) + ";return regular;")(fs.openSync, fs.constants, fs.fstatSync, read, fs.lstatSync, fs.realpathSync, close,
        () => { throw Error("FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED"); }) as (file: string) => Buffer;
    assert.throws(() => invoke(file), variant === "primary-plus-close" ? /COMPONENT_PRIMARY_READ_FAILURE/ : /FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED/);
    assert.equal(closes, 1); assert.ok(requested <= original.length + 1, "reader must never request an unbounded payload");
    if (variant === "pathname-swap") assert.equal(readFileSync(file + ".unrelated", "utf8"), "SENTINEL");
  }
});

test("all five actual public seams reject late selection and restored absence before parameters, HOME or SQL", () => {
  const script = `import assert from "node:assert/strict";
    import fs from "node:fs";import fsp from "node:fs/promises";import net from "node:net";
    import {syncBuiltinESMExports} from "node:module";
    const root=${JSON.stringify("__ASSET_FIXTURE_ROOT__")};
    const install=await import(root+"/src/installer/install.ts");
    const provision=await import(root+"/src/installer/agent-provision.ts");
    const run=await import(root+"/src/installer/run.ts");
    const workspace=await import(root+"/src/installer/worktree-ops.ts");
    let gets=0,touches=0,connections=0;const hostile=new Proxy({}, {get(){gets++;throw Error("PARAMETER_OR_EFFECT_REACHED");}});
    for(const name of ["readFileSync","lstatSync","statSync","realpathSync","existsSync","openSync","mkdirSync","rmSync","unlinkSync","writeFileSync"])
      fs[name]=()=>{touches++;throw Error("HOME_OR_FILESYSTEM_EFFECT_REACHED");};
    for(const name of ["readFile","lstat","stat","realpath","open","mkdir","rm","unlink","writeFile"])
      fsp[name]=async()=>{touches++;throw Error("HOME_OR_FILESYSTEM_EFFECT_REACHED");};
    net.Socket.prototype.connect=function(){connections++;throw Error("SQL_OR_NETWORK_REACHED");};syncBuiltinESMExports();
    process.env.SETFARM_INSTALLATION_DIR="/late-unadmitted-asset-selection";
    for(let round=0;round<2;round++){
      assert.throws(()=>workspace.getAgentWorkspacePath("feature-dev_planner"),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      assert.throws(()=>workspace.cleanAgentWorkspace("feature-dev_planner"),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      await assert.rejects(install.installWorkflow(hostile),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      await assert.rejects(provision.provisionAgents(hostile),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      await assert.rejects(run.runWorkflow(hostile),/FRESH_INSTALLATION_SELECTION_REFUSED/);
      delete process.env.SETFARM_INSTALLATION_DIR;
    }
    assert.deepEqual({gets,touches,connections},{gets:0,touches:0,connections:0});console.log("ASSET_LATE_SELECTION_REFUSED");`;
  const environment:NodeJS.ProcessEnv={...process.env,TSX_DISABLE_CACHE:"1",SETFARM_ENV_DIR:assetRoot};
  for(const name of Object.keys(environment))if(name==="SETFARM_INSTALLATION_DIR"||name.startsWith("SETFARM_INTERNAL_PRODUCTION_")
    ||["SETFARM_PG_URL","DATABASE_URL","PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE"].includes(name))delete environment[name];
  const result=spawnSync(process.execPath,["--import",import.meta.resolve("tsx"),"--input-type=module","-e",script.replace(JSON.stringify("__ASSET_FIXTURE_ROOT__"),JSON.stringify(assetRoot))],{
    cwd:assetRoot,env:environment,encoding:"utf8",timeout:30_000,maxBuffer:65_536});
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,"ASSET_LATE_SELECTION_REFUSED\n");
});
