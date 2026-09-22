import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { createPositiveWorktreeIdentityHashV2, projectPositiveWorktreeOwnersV2 } from "../../src/internal-production/baseline-positive-worktree-owner-partition-v2.js";

const RETAINED_PHYSICAL = [
  {
    root: "/code/.worktrees/mc",
    namespace: "retained-code",
    kind: "git-worktree",
    dev: "1",
    ino: "2",
    birthtimeNs: "3",
    gitPrimaryRoot: "/code/mission-control",
    dirty: true,
    referencingPids: [],
  },
  {
    root: "/code/.worktrees/setfarm",
    namespace: "retained-code",
    kind: "git-worktree",
    dev: "1",
    ino: "4",
    birthtimeNs: "5",
    gitPrimaryRoot: "/code/setfarm",
    dirty: false,
    referencingPids: [],
  },
  {
    root: "/code/.worktrees/test-data",
    namespace: "retained-code",
    kind: "artifact",
    dev: "1",
    ino: "6",
    birthtimeNs: "7",
    gitPrimaryRoot: null,
    dirty: false,
    referencingPids: [],
  },
] as const;

test("retained code worktrees and artifacts remain visible without becoming execution owners", () => {
  const result = projectPositiveWorktreeOwnersV2({
    physicalBefore: RETAINED_PHYSICAL,
    physicalAfter: RETAINED_PHYSICAL,
    retainedGitPrimaries: ["/code/mission-control", "/code/setfarm"],
    database: { snapshotHash: "a".repeat(64), activeOwners: [] },
  });

  assert.deepEqual(result.inventory.map((entry) => entry.classification), [
    "retained-code",
    "retained-code",
    "retained-artifact",
  ]);
  assert.deepEqual(result.inventory.map((entry) => entry.root), [
    "/code/.worktrees/mc",
    "/code/.worktrees/setfarm",
    "/code/.worktrees/test-data",
  ]);
  assert.equal(result.ownedWorktreeCount, 0);
  assert.equal(result.dirtyOwnedWorktreeCount, 0);
  assert.equal(result.primaryProjectOwnerCount, 0);
  assert.equal(result.state, "zero-candidate");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.inventory), true);
});

const RUNTIME = {
  root: "/runs/story-7", namespace: "runtime", kind: "git-worktree",
  dev: "8", ino: "9", birthtimeNs: "10", gitPrimaryRoot: "/projects/story-7",
  dirty: true, referencingPids: [101],
} as const;
const RUNTIME_IDENTITY = createHash("sha256").update(
  '{"birthtimeNs":"10","dev":"8","gitPrimaryRoot":"/projects/story-7","ino":"9","root":"/runs/story-7","schema":"setfarm.internal-production-positive-worktree-identity.v2"}',
).digest("hex");

function boundInput() {
  return {
    physicalBefore: [RUNTIME], physicalAfter: structuredClone([RUNTIME]), retainedGitPrimaries: [],
    database: { snapshotHash: "b".repeat(64), activeOwners: [
      { ownerKey: "attempt:7", worktreeRoot: "/runs/story-7", physicalIdentityHash: RUNTIME_IDENTITY },
    ] },
  };
}

test("one physical-and-DB-bound runtime worktree is one owner; primary DB owner is separate", () => {
  const input = boundInput();
  input.database.activeOwners.unshift({ ownerKey: "attempt:1", worktreeRoot: null as never, physicalIdentityHash: null as never });
  const result = projectPositiveWorktreeOwnersV2(input);
  assert.equal(createPositiveWorktreeIdentityHashV2(RUNTIME), RUNTIME_IDENTITY);
  assert.deepEqual(result.inventory.map((entry) => [entry.root, entry.classification]), [["/runs/story-7", "bound-execution"]]);
  assert.equal(result.ownedWorktreeCount, 1);
  assert.equal(result.dirtyOwnedWorktreeCount, 1);
  assert.equal(result.primaryProjectOwnerCount, 1);
  assert.equal(result.state, "occupied");
  assert.equal(Object.isFrozen(result.inventory[0]), true);
  assert.match(result.projectionHash, /^[a-f0-9]{64}$/);
});

test("unbound runtime entry and DB-only non-primary entry both refuse", () => {
  const orphan = boundInput();
  orphan.database.activeOwners = [];
  assert.throws(() => projectPositiveWorktreeOwnersV2(orphan), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID/);
  const missingPhysical = boundInput();
  missingPhysical.physicalBefore = [] as never;
  missingPhysical.physicalAfter = [] as never;
  assert.throws(() => projectPositiveWorktreeOwnersV2(missingPhysical), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID/);
});

test("a primary-project DB owner alone keeps the partition occupied", () => {
  const result = projectPositiveWorktreeOwnersV2({
    physicalBefore: [], physicalAfter: [], retainedGitPrimaries: [],
    database: { snapshotHash: "c".repeat(64), activeOwners: [
      { ownerKey: "session:1", worktreeRoot: null, physicalIdentityHash: null },
    ] },
  });
  assert.equal(result.state, "occupied");
  assert.equal(result.primaryProjectOwnerCount, 1);
  assert.equal(result.ownedWorktreeCount, 0);
});

const invalidBoundCases: [string, (input: any) => void][] = [
  ["physical inode ABA between passes", (input) => { input.physicalAfter[0].ino = "999"; }],
  ["birth identity ABA between passes", (input) => { input.physicalAfter[0].birthtimeNs = "999"; }],
  ["dirty state changes between passes", (input) => { input.physicalAfter[0].dirty = false; }],
  ["process reference changes between passes", (input) => { input.physicalAfter[0].referencingPids = []; }],
  ["physical membership changes between passes", (input) => { input.physicalAfter = []; }],
  ["wrong DB physical identity", (input) => { input.database.activeOwners[0].physicalIdentityHash = "0".repeat(64); }],
  ["duplicate DB root", (input) => { input.database.activeOwners.push({ ...input.database.activeOwners[0], ownerKey: "attempt:8" }); }],
  ["duplicate DB key", (input) => { input.database.activeOwners.push({ ...input.database.activeOwners[0] }); }],
  ["runtime artifact", (input) => { input.physicalBefore[0].kind = "artifact"; input.physicalBefore[0].gitPrimaryRoot = null; input.physicalAfter = structuredClone(input.physicalBefore); }],
  ["runtime uses retained primary", (input) => { input.retainedGitPrimaries = ["/projects/story-7"]; }],
  ["unsorted process references", (input) => { input.physicalBefore[0].referencingPids = [102, 101]; input.physicalAfter = structuredClone(input.physicalBefore); }],
  ["relative path", (input) => { input.physicalBefore[0].root = "runs/story-7"; input.physicalAfter = structuredClone(input.physicalBefore); }],
  ["path alias", (input) => { input.physicalBefore[0].root = "/runs/./story-7"; input.physicalAfter = structuredClone(input.physicalBefore); }],
  ["malformed decimal", (input) => { input.physicalBefore[0].ino = "09"; input.physicalAfter = structuredClone(input.physicalBefore); }],
  ["malformed DB hash", (input) => { input.database.snapshotHash = "ABC"; }],
  ["extra input key", (input) => { input.untrustedZeroOwner = true; }],
  ["extra physical key", (input) => { input.physicalBefore[0].untrusted = true; input.physicalAfter = structuredClone(input.physicalBefore); }],
];

for (const [name, mutate] of invalidBoundCases) {
  test(`refuses ${name}`, () => {
    const input = structuredClone(boundInput()) as any;
    mutate(input);
    assert.throws(() => projectPositiveWorktreeOwnersV2(input), /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
  });
}

test("refuses two distinct roots claiming one physical directory identity", () => {
  const physical = structuredClone(RETAINED_PHYSICAL) as any[];
  physical[1].dev = physical[0].dev;
  physical[1].ino = physical[0].ino;
  physical[1].birthtimeNs = physical[0].birthtimeNs;
  assert.throws(() => projectPositiveWorktreeOwnersV2({
    physicalBefore: physical, physicalAfter: structuredClone(physical),
    retainedGitPrimaries: ["/code/mission-control", "/code/setfarm"],
    database: { snapshotHash: "a".repeat(64), activeOwners: [] },
  }), /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
});

test("refuses retained-code DB binding or process reference", () => {
  const physical = structuredClone(RETAINED_PHYSICAL) as any[];
  const base = { physicalBefore: physical, physicalAfter: structuredClone(physical),
    retainedGitPrimaries: ["/code/mission-control", "/code/setfarm"],
    database: { snapshotHash: "a".repeat(64), activeOwners: [] as any[] } };
  base.database.activeOwners = [{ ownerKey: "attempt:1", worktreeRoot: physical[0].root,
    physicalIdentityHash: createPositiveWorktreeIdentityHashV2(physical[0]) }];
  assert.throws(() => projectPositiveWorktreeOwnersV2(base), /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
  base.database.activeOwners = [];
  physical[0].referencingPids = [321];
  base.physicalAfter = structuredClone(physical);
  assert.throws(() => projectPositiveWorktreeOwnersV2(base), /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
});

test("refuses unlisted retained Git primary and ambiguous sorted input", () => {
  const physical = structuredClone(RETAINED_PHYSICAL) as any[];
  assert.throws(() => projectPositiveWorktreeOwnersV2({ physicalBefore: physical, physicalAfter: physical,
    retainedGitPrimaries: ["/code/setfarm"], database: { snapshotHash: "a".repeat(64), activeOwners: [] } }),
  /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
  const reversed = [...physical].reverse();
  assert.throws(() => projectPositiveWorktreeOwnersV2({ physicalBefore: reversed, physicalAfter: reversed,
    retainedGitPrimaries: ["/code/mission-control", "/code/setfarm"], database: { snapshotHash: "a".repeat(64), activeOwners: [] } }),
  /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
});

test("refuses proxy and accessor inputs without evaluating accessors", () => {
  const proxy = new Proxy(boundInput(), {});
  assert.throws(() => projectPositiveWorktreeOwnersV2(proxy), /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
  const input = boundInput() as any;
  let invoked = false;
  Object.defineProperty(input, "physicalAfter", { enumerable: true, get() { invoked = true; throw Error("accessor evaluated"); } });
  assert.throws(() => projectPositiveWorktreeOwnersV2(input), /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PARTITION_INVALID$/);
  assert.equal(invoked, false);
});
