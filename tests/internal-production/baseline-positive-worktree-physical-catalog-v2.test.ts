import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";

import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "../../src/internal-production/baseline-positive-worktree-physical-catalog-v2.js";

function fixture() {
  const ownerHomeRoot = mkdtempSync(path.join(realpathSync(os.tmpdir()), "setfarm-positive-physical-v2-"));
  const workspaceRoot = path.join(ownerHomeRoot, "ai", "setrox");
  for (const directory of [
    workspaceRoot,
    path.join(workspaceRoot, "setfarm"),
    path.join(workspaceRoot, "mission-control"),
    path.join(ownerHomeRoot, "projects"),
    path.join(ownerHomeRoot, ".openclaw", "workspace", "agent-scratch"),
    path.join(ownerHomeRoot, ".openclaw", "workspaces", "workflows"),
  ]) mkdirSync(directory, { recursive: true });
  return { ownerHomeRoot, workspaceRoot, close: () => rmSync(ownerHomeRoot, { recursive: true, force: true }) };
}

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8", env: {
    ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0",
  } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function initRepo(root: string, origin?: string): void {
  git(["init", "-q", root]);
  git(["-C", root, "config", "user.name", "Fixture"]);
  git(["-C", root, "config", "user.email", "fixture@example.invalid"]);
  git(["-C", root, "commit", "-q", "--allow-empty", "-m", "initial"]);
  if (origin) git(["-C", root, "remote", "add", "origin", origin]);
}

test("non-Git workspace child remains visible and unresolved; optional bases remain explicit", async () => {
  const testHome = fixture();
  try {
    const unknown = path.join(testHome.workspaceRoot, ".worktrees", "data");
    mkdirSync(unknown, { recursive: true });
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.schema, "setfarm.internal-production-positive-worktree-physical-catalog.v2");
    assert.equal(result.observerPidExcluded, process.pid);
    assert.equal(result.status, "unresolved");
    assert.deepEqual(result.entries.map((entry) => [entry.root, entry.zone, entry.kind]), [
      [unknown, "retained-zone", "unresolved"],
    ]);
    assert.deepEqual(result.blockers, [{ root: unknown, reason: "non-git-child" }]);
    assert.ok(result.absentBases.includes(path.join(testHome.workspaceRoot, "setfarm", ".worktrees")));
    assert.ok(result.absentBases.includes(path.join(testHome.workspaceRoot, "mission-control", ".worktrees")));
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.entries), true);
  } finally {
    testHome.close();
  }
});

test("a direct linked Setfarm checkout is retained and remains visible without becoming an owner", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.workspaceRoot, "setfarm");
    initRepo(primary, "https://github.com/hikmetgulsesli/setfarm.git");
    const linked = path.join(testHome.workspaceRoot, ".worktrees", "setfarm-linked");
    mkdirSync(path.dirname(linked), { recursive: true });
    git(["-C", primary, "worktree", "add", "-q", "-b", "fixture-linked", linked]);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "complete");
    assert.deepEqual(result.blockers, []);
    assert.deepEqual(result.entries.map((entry) => [entry.root, entry.zone, entry.kind, entry.gitPrimaryRoot]), [
      [linked, "retained-zone", "linked-git", primary],
    ]);
    assert.equal(result.entries[0]?.dirty, false);
  } finally {
    testHome.close();
  }
});

test("a locked linked Git worktree remains present and topology-visible", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.workspaceRoot, "setfarm");
    initRepo(primary, "https://github.com/hikmetgulsesli/setfarm.git");
    const linked = path.join(testHome.workspaceRoot, ".worktrees", "locked-linked");
    mkdirSync(path.dirname(linked));
    git(["-C", primary, "worktree", "add", "-q", "-b", "locked-linked", linked]);
    git(["-C", primary, "worktree", "lock", "--reason", "fixture reason", linked]);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "complete");
    assert.deepEqual(result.entries.map((entry) => [entry.root, entry.kind]), [[linked, "linked-git"]]);
  } finally {
    testHome.close();
  }
});

test("a locked-worktree annotation change across the bracket refuses", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.workspaceRoot, "setfarm");
    initRepo(primary, "https://github.com/hikmetgulsesli/setfarm.git");
    const linked = path.join(testHome.workspaceRoot, ".worktrees", "locked-linked");
    mkdirSync(path.dirname(linked));
    git(["-C", primary, "worktree", "add", "-q", "-b", "locked-linked", linked]);
    git(["-C", primary, "worktree", "lock", linked]);
    const locked = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(locked.status, "complete");
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }, async () => { git(["-C", primary, "worktree", "unlock", linked]); }),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
  } finally {
    testHome.close();
  }
});

test("refuses external file-holder PID drift across the awaited bracket", async () => {
  const testHome = fixture();
  let child: ReturnType<typeof spawn> | null = null;
  try {
    const unknown = path.join(testHome.workspaceRoot, ".worktrees", "data");
    mkdirSync(unknown, { recursive: true });
    const heldFile = path.join(unknown, "held.txt");
    writeFileSync(heldFile, "fixture");
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }, async () => {
      child = spawn(process.execPath, ["-e", "require('node:fs').openSync(process.argv[1], 'r'); process.stdout.write('READY\\n'); setInterval(() => {}, 1000)", heldFile],
        { stdio: ["ignore", "pipe", "pipe"] });
      await once(child.stdout!, "data");
    }), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    testHome.close();
  }
});

test("records a real external file holder PID without admitting it as absence", async () => {
  const testHome = fixture();
  let child: ReturnType<typeof spawn> | null = null;
  try {
    const unknown = path.join(testHome.workspaceRoot, ".worktrees", "data");
    mkdirSync(unknown, { recursive: true });
    const heldFile = path.join(unknown, "held.txt");
    writeFileSync(heldFile, "fixture");
    child = spawn(process.execPath, ["-e", "require('node:fs').openSync(process.argv[1], 'r'); process.stdout.write('READY\\n'); setInterval(() => {}, 1000)", heldFile],
      { stdio: ["ignore", "pipe", "pipe"] });
    await once(child.stdout!, "data");
    const observed = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(observed.status, "unresolved");
    assert.deepEqual(observed.entries[0]?.referencingPids, [child.pid]);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    testHome.close();
  }
});

test("lsof observer child does not count its own cwd as an external reference", async () => {
  const testHome = fixture();
  const originalCwd = process.cwd();
  try {
    const unknown = path.join(testHome.workspaceRoot, ".worktrees", "data");
    mkdirSync(unknown, { recursive: true });
    process.chdir(unknown);
    const observed = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(observed.status, "unresolved");
    assert.deepEqual(observed.entries[0]?.referencingPids, []);
  } finally {
    process.chdir(originalCwd);
    testHome.close();
  }
});

test("generated project linked worktree remains a runtime candidate without a remote origin", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.ownerHomeRoot, "projects", "story");
    mkdirSync(primary);
    initRepo(primary);
    const runtime = path.join(primary, ".worktrees", "story-1");
    mkdirSync(path.dirname(runtime));
    git(["-C", primary, "worktree", "add", "-q", "-b", "runtime-1", runtime]);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "complete");
    assert.deepEqual(result.entries.map((entry) => [entry.root, entry.zone, entry.kind, entry.gitPrimaryRoot]), [
      [runtime, "runtime-zone", "linked-git", primary],
    ]);
  } finally {
    testHome.close();
  }
});

test("read-only Git status never executes a repository-local fsmonitor command", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.ownerHomeRoot, "projects", "story");
    mkdirSync(primary);
    initRepo(primary);
    const runtime = path.join(primary, ".worktrees", "story-1");
    mkdirSync(path.dirname(runtime));
    git(["-C", primary, "worktree", "add", "-q", "-b", "runtime-1", runtime]);
    const touched = path.join(testHome.ownerHomeRoot, "fsmonitor-was-run");
    const hook = path.join(testHome.ownerHomeRoot, "fsmonitor-hook");
    writeFileSync(hook, `#!/bin/sh\nprintf ran > '${touched}'\n`);
    chmodSync(hook, 0o700);
    git(["-C", runtime, "config", "core.fsmonitor", hook]);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "complete");
    assert.equal(existsSync(touched), false);
  } finally {
    testHome.close();
  }
});

test("detects Git dirty-state drift across the awaited bracket", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.workspaceRoot, "setfarm");
    initRepo(primary, "https://github.com/hikmetgulsesli/setfarm.git");
    writeFileSync(path.join(primary, "tracked.txt"), "before");
    git(["-C", primary, "add", "tracked.txt"]);
    git(["-C", primary, "commit", "-q", "-m", "tracked"]);
    const linked = path.join(testHome.workspaceRoot, ".worktrees", "setfarm-linked");
    mkdirSync(path.dirname(linked), { recursive: true });
    git(["-C", primary, "worktree", "add", "-q", "-b", "fixture-linked", linked]);
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }, async () => { writeFileSync(path.join(linked, "tracked.txt"), "after"); }),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
  } finally {
    testHome.close();
  }
});

test("an independent Setfarm deployment primary clone remains retained and visible", async () => {
  const testHome = fixture();
  try {
    const deployments = path.join(testHome.workspaceRoot, "deployments");
    const clone = path.join(deployments, "setfarm-clean-main");
    mkdirSync(clone, { recursive: true });
    initRepo(clone, "https://github.com/hikmetgulsesli/setfarm.git");
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "complete");
    assert.deepEqual(result.entries.map((entry) => [entry.root, entry.zone, entry.kind, entry.gitPrimaryRoot]), [
      [clone, "retained-zone", "primary-git", clone],
    ]);
    assert.equal(result.entries[0]?.sourceBuildProvenance, "unverified");
  } finally {
    testHome.close();
  }
});

test("parent Git traversal cannot authenticate a non-Git project child", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.ownerHomeRoot, "projects", "story");
    mkdirSync(primary);
    initRepo(primary);
    const orphan = path.join(primary, ".worktrees", "orphan");
    mkdirSync(orphan, { recursive: true });
    assert.equal(git(["-C", orphan, "rev-parse", "--show-toplevel"]), primary);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.deepEqual(result.blockers, [{ root: orphan, reason: "non-git-child" }]);
  } finally {
    testHome.close();
  }
});

test("a non-Git project parent never hides its present worktree child", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.ownerHomeRoot, "projects", "story");
    const orphan = path.join(primary, ".worktrees", "orphan");
    mkdirSync(orphan, { recursive: true });
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.deepEqual(result.entries.map((entry) => [entry.root, entry.kind]), [[orphan, "unresolved"]]);
    assert.deepEqual(result.blockers, [
      { root: primary, reason: "non-git-parent" },
      { root: orphan, reason: "non-git-child" },
    ]);
  } finally {
    testHome.close();
  }
});

test("a workflow without its agents discovery parent refuses instead of claiming complete coverage", async () => {
  const testHome = fixture();
  try {
    mkdirSync(path.join(testHome.ownerHomeRoot, ".openclaw", "workspaces", "workflows", "workflow-1"));
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
  } finally {
    testHome.close();
  }
});

test("an origin-less retained Git worktree is visible but unresolved", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.workspaceRoot, "setfarm");
    initRepo(primary);
    const linked = path.join(testHome.workspaceRoot, ".worktrees", "local-linked");
    mkdirSync(path.dirname(linked));
    git(["-C", primary, "worktree", "add", "-q", "-b", "local-linked", linked]);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.deepEqual(result.entries.map((entry) => [entry.root, entry.kind]), [[linked, "unresolved"]]);
    assert.deepEqual(result.blockers, [{ root: linked, reason: "untrusted-code-git" }]);
  } finally {
    testHome.close();
  }
});

test("a deployment primary names each absent prunable linked root as a blocker", async () => {
  const testHome = fixture();
  try {
    const clone = path.join(testHome.workspaceRoot, "deployments", "local-clone");
    mkdirSync(clone, { recursive: true });
    initRepo(clone, "https://github.com/hikmetgulsesli/setfarm.git");
    const stale = path.join(testHome.ownerHomeRoot, "stale-deployment-linked");
    git(["-C", clone, "worktree", "add", "-q", "-b", "stale-linked", stale]);
    rmSync(stale, { recursive: true });
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.ok(result.blockers.some((item) => item.root === stale && item.reason === "prunable-git-worktree"));
  } finally {
    testHome.close();
  }
});

test("prunable worktree metadata blocks qualification instead of being ignored", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.ownerHomeRoot, "projects", "story");
    mkdirSync(primary);
    initRepo(primary);
    const base = path.join(primary, ".worktrees");
    mkdirSync(base);
    const present = path.join(base, "present");
    const missing = path.join(base, "missing");
    git(["-C", primary, "worktree", "add", "-q", "-b", "present", present]);
    git(["-C", primary, "worktree", "add", "-q", "-b", "missing", missing]);
    rmSync(missing, { recursive: true, force: true });
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.ok(result.blockers.some((item) => item.root === missing && item.reason === "prunable-git-worktree"));
  } finally {
    testHome.close();
  }
});

test("forged origin cannot turn an unrelated primary into retained code", async () => {
  const testHome = fixture();
  try {
    const roguePrimary = path.join(testHome.ownerHomeRoot, "rogue");
    mkdirSync(roguePrimary);
    initRepo(roguePrimary, "https://github.com/hikmetgulsesli/setfarm.git");
    const linked = path.join(testHome.workspaceRoot, ".worktrees", "rogue-linked");
    mkdirSync(path.dirname(linked), { recursive: true });
    git(["-C", roguePrimary, "worktree", "add", "-q", "-b", "rogue-linked", linked]);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.deepEqual(result.blockers, [
      { root: linked, reason: "retained-primary-mismatch" },
      { root: roguePrimary, reason: "listed-outside-scope" },
    ]);
  } finally {
    testHome.close();
  }
});

test("prunable metadata on an otherwise empty generated-project base remains visible", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.ownerHomeRoot, "projects", "story");
    mkdirSync(primary);
    initRepo(primary);
    const base = path.join(primary, ".worktrees");
    mkdirSync(base);
    const missing = path.join(base, "missing");
    git(["-C", primary, "worktree", "add", "-q", "-b", "missing", missing]);
    rmSync(missing, { recursive: true, force: true });
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.deepEqual(result.blockers, [{ root: missing, reason: "prunable-git-worktree" }]);
  } finally {
    testHome.close();
  }
});

test("a Git-listed worktree outside enumerated bases is a visible blocker", async () => {
  const testHome = fixture();
  try {
    const primary = path.join(testHome.workspaceRoot, "setfarm");
    initRepo(primary, "https://github.com/hikmetgulsesli/setfarm.git");
    const outside = path.join(testHome.ownerHomeRoot, "outside-linked");
    git(["-C", primary, "worktree", "add", "-q", "-b", "outside", outside]);
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.equal(result.status, "unresolved");
    assert.ok(result.blockers.some((item) => item.root === outside && item.reason === "listed-outside-scope"));
  } finally {
    testHome.close();
  }
});

test("mandatory root absence and symlink child both refuse", async () => {
  const testHome = fixture();
  try {
    rmSync(path.join(testHome.ownerHomeRoot, "projects"), { recursive: true });
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
    mkdirSync(path.join(testHome.ownerHomeRoot, "projects"));
    const base = path.join(testHome.workspaceRoot, ".worktrees");
    mkdirSync(base);
    symlinkSync(testHome.workspaceRoot, path.join(base, "alias"));
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
  } finally {
    testHome.close();
  }
});

test("optional base appearance and same-path directory replacement during callback refuse", async () => {
  const testHome = fixture();
  try {
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }, async () => { mkdirSync(path.join(testHome.workspaceRoot, "setfarm", ".worktrees")); }),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
    const data = path.join(testHome.workspaceRoot, ".worktrees", "data");
    mkdirSync(data, { recursive: true });
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }, async () => {
      const saved = `${data}-saved`;
      renameSync(data, saved);
      mkdirSync(data);
      rmSync(data, { recursive: true });
      renameSync(saved, data);
    }), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
  } finally {
    testHome.close();
  }
});

test("a discovery-parent regular file is visible without becoming a worktree", async () => {
  const testHome = fixture();
  try {
    const incidental = path.join(testHome.ownerHomeRoot, "projects", ".DS_Store");
    writeFileSync(incidental, "fixture");
    const result = await observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    });
    assert.deepEqual(result.incidentalFiles, [incidental]);
    assert.deepEqual(result.entries, []);
    assert.equal(result.status, "complete");
  } finally {
    testHome.close();
  }
});

test("a failed descriptor close poisons later catalog acquisition", async () => {
  const testHome = fixture();
  const originalClose = fs.closeSync;
  let injected = false;
  try {
    await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
      ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
    }, async () => {
      fs.closeSync = (fd) => {
        if (!injected) { injected = true; throw Error("injected-close-failure"); }
        originalClose(fd);
      };
      syncBuiltinESMExports();
    }), /cleanup uncertain/);
    assert.equal(injected, true);
  } finally {
    fs.closeSync = originalClose;
    syncBuiltinESMExports();
    testHome.close();
  }
  await assert.rejects(observeHeldPositiveWorktreePhysicalCatalogV2({
    ownerHomeRoot: testHome.ownerHomeRoot, workspaceRoot: testHome.workspaceRoot,
  }), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID/);
});
