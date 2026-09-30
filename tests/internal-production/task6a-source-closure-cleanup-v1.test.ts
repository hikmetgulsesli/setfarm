import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";

// Resource protocol only: compile the real private bodies, without altering
// production exports. Semantic/authentication ports below do NOT prove a graph.
const source = fs.readFileSync(new URL("../../src/internal-production/baseline-post-handoff-receipt-v1.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("receipt.ts", source, ts.ScriptTarget.ES2022, true);

function fixture(fault: "none" | "file" | "parent" | "historical" | "guard" = "none") {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "sf-closure-close-")));
  const initial = fs.lstatSync(home, { bigint: true });
  fs.chmodSync(home, 0o700);
  const privateDir = path.join(home, "private"); fs.mkdirSync(privateDir, { mode: 0o700 });
  const files = Array.from({ length: 8 }, (_, i) => path.join(home, `r${i}`));
  for (const file of files) fs.writeFileSync(file, "diagnostic protocol record\n", { mode: 0o600 });
  const allocated: number[] = [];
  const attempts: number[] = [];
  let injected = false;
  let constructionFailure = false;
  let failGuardAfterOpen = false;
  let failParentIdentity = false;
  let failMemberIdentity = false;
  let pauseNextParse = false;
  let finishParse: (() => void) | undefined;
  const kinds = new Map<number, string>();
  const open = (target: string, flags: number, kind: string): number => {
    const fd = fs.openSync(target, flags); allocated.push(fd); kinds.set(fd, kind); return fd;
  };
  const close = (fd: number): void => {
    attempts.push(fd); fs.closeSync(fd);
    // Model ambiguous OS failure after releasing the FD. Never retry that FD.
    if (!injected && kinds.get(fd) === fault) { injected = true; throw new Error("TEST_ONLY_CLOSE_UNCERTAIN"); }
  };
  const snapshot = (target: string) => ({ locator: target, observed: {
    stats: fs.lstatSync(target, { bigint: true }), bytes: fs.readFileSync(target), mode: 0o600,
  } });
  const snapshots = files.map(snapshot);
  const parsed = { snapshots, dispositionValue: { value: { historicalPrerequisiteInventory: undefined } },
    successorGenesis: { successorStoreHash: "test-only-store" }, zeroEffectProof: { value: {} },
    successorRoot: home, successorOperationPair: { ref: "test-only-ref", hash: "test-only-hash" },
    successorOperation: { operationRef: "test-only-ref", operationHash: "test-only-hash" },
    sealTarget: files[6], commitTarget: files[7] };
  const openRecord = (target: string) => {
    const descriptor = open(target, fs.constants.O_RDONLY, "file");
    return { target, descriptor, identity: fs.fstatSync(descriptor, { bigint: true }), bytes: fs.readFileSync(descriptor) };
  };
  const openParent = (target: string) => {
    const descriptor = open(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY, "parent");
    return { pin: { target, descriptor, identity: fs.fstatSync(descriptor, { bigint: true }), assertStable() {} }, close() { close(descriptor); } };
  };
  const ports: Record<string, unknown> = {
    path, Object, Map, Buffer, AggregateError,
    currentEntryFail(message: string): never { throw new Error(`INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:${message}`); },
    fixedLegacyCurrentEntryOperationPathV1: () => files[0],
    fixedLegacyCurrentEntryRootV1: () => home,
    exactPoisonQuarantinedStoreLocatorV1: () => home,
    exactPoisonSuccessorStoreRootV1: () => home,
    requireExactPoisonRecoverySnapshotV1: () => snapshots[0],
    readExactPoisonRecoveryChainV1: async () => {
      if (pauseNextParse) { pauseNextParse = false; await new Promise<void>(resolve => { finishParse = resolve; }); }
      return parsed;
    },
    openExactPoisonRecoveryPinnedRecordV1: openRecord,
    openExactPoisonRecoveryPinnedParentV1: openParent,
    openExactPoisonHistoricalInventoryPinsV1: () => {
      const fd = open(files[0]!, fs.constants.O_RDONLY, "historical");
      return { assertStable() {}, close() { close(fd); } };
    },
    sameRegularMetadata: (a: fs.BigIntStats, b: fs.BigIntStats) => a.dev === b.dev && a.ino === b.ino && a.mode === b.mode,
    canonicalComparable: JSON.stringify,
    assertExactPoisonRecoveryPinnedRecordStableV1() { if (constructionFailure) throw new Error("TEST_ONLY_CONSTRUCTION_FAILURE"); },
    closeSync: close,
    isPlainRecord: (value: unknown) => !!value && typeof value === "object" && !Array.isArray(value),
    exactPoisonRecoveryPinnedRecordFileSnapshotV1: (value: unknown) => value,
    buildExactPoisonHistoricalInventoryV1: () => inventory,
    constants: fs.constants, lstatSync: fs.lstatSync,
    fstatSync: (fd: number, options: { bigint: true }) => {
      const actual = fs.fstatSync(fd, options);
      if (failParentIdentity && kinds.get(fd) === "guard") return { ...actual, isDirectory: () => false };
      if (failMemberIdentity && kinds.get(fd) === "guard") return { ...actual, isFile: () => false };
      return actual;
    }, realpathSync: fs.realpathSync,
    openSync: (target: string, flags: number) => open(target, flags, "guard"),
    CURRENT_ENTRY_MAX_BYTES: 1_048_576,
    readTask12ReceiptDescriptorBytesV1: (fd: number) => fs.readFileSync(fd),
    task12ReceiptStoreAnchorV1: () => home,
    task12ReceiptPresentedPathV1: (target: string) => target,
    authenticateInternalProductionBaselineWorkspaceAnchorV1: () => {
      const fd = open(home, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY, "historical");
      return { assertStable() { if (failGuardAfterOpen && allocated.length > 2) throw new Error("TEST_ONLY_GUARD_CONSTRUCTION_FAILURE"); }, close() { close(fd); } };
    },
    authenticateTask12ReceiptDirectoryChainV1: () => {
      const fd = open(home, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY, "historical");
      return { assertStable() {}, close() { close(fd); } };
    },
  };
  const inventory = { inventoryBody: { orderedRecords: [
    { parents: [{ locator: "." }], locator: "r0", state: "present" },
    { parents: [{ locator: "." }], locator: "r1", state: "present" },
  ] } };
  // Bind only the selected real body for each test; other owners are protocol
  // ports. Narrowing keeps real FD release assertions independent of parsers.
  function load(name: string, additional: readonly string[] = []): ((...args: unknown[]) => any) & { peers: Record<string, (...args: unknown[]) => any> } {
    const node = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.body && node.name?.text === name)!;
    assert.ok(node, `missing actual function ${name}`);
    const cleanup = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.body && node.name?.text === "attemptTask6aReceiptOwnedCleanupV1");
    const latch = ast.statements.filter(ts.isVariableStatement).find(node =>
      node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === "task6aReceiptCleanupUncertainV1"));
    const member = name === "openExactPoisonRecoveryPinnedRecordV1" ? ast.statements.filter(ts.isFunctionDeclaration)
      .find(node => node.body && node.name?.text === "openExactPoisonRecoveryMemberV1") : undefined;
    const peers = additional.map(name => ast.statements.filter(ts.isFunctionDeclaration).find(node => node.body && node.name?.text === name)!);
    const code = ts.transpileModule(`${latch?.getText(ast) ?? ""}\n${cleanup?.getText(ast) ?? ""}\n${member?.getText(ast) ?? ""}\n${node.getText(ast)}\n${peers.map(node => node.getText(ast)).join("\n")}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const context = vm.createContext({ ...ports });
    vm.runInContext(`${code}\nthis.actual=${name};this.peers={${additional.join(",")}};`, context);
    return Object.assign(context.actual, { peers: context.peers });
  }
  return { home, privateDir, files, inventory, allocated, attempts, load,
    failConstruction() { constructionFailure = true; },
    failGuardConstruction() { failGuardAfterOpen = true; },
    failParentConstruction() { failParentIdentity = true; },
    failMemberConstruction() { failMemberIdentity = true; },
    pauseParse() { pauseNextParse = true; },
    resumeParse() { assert.ok(finishParse); finishParse(); },
    makeTwoLinks() { const link = path.join(home, "bad-link"); fs.linkSync(files[0]!, link); files.push(link); },
    assertReleased() {
      for (const fd of allocated) assert.throws(() => fs.fstatSync(fd), { code: "EBADF" }, `descriptor ${fd} was skipped`);
      assert.equal(new Set(attempts).size, attempts.length, "ambiguous closes must never be retried");
    },
    cleanup() {
      for (const fd of allocated) { try { fs.fstatSync(fd); fs.closeSync(fd); } catch {} }
      const now = fs.lstatSync(home, { bigint: true });
      assert.equal(now.dev, initial.dev); assert.equal(now.ino, initial.ino); assert.equal(now.uid, initial.uid);
      for (const file of files) fs.unlinkSync(file); fs.rmdirSync(privateDir); fs.rmdirSync(home);
    },
  };
}

for (const fault of ["none", "historical", "file", "parent"] as const) {
  test(`successor chain attempts every owned release after ${fault} close`, async () => {
    const f = fixture(fault);
    try {
      const held = await f.load("openExactPoisonRecoveryPinnedChainV1")(true);
      if (fault === "none") held.close(); else assert.throws(() => held.close(), /cleanup|CLOSE|close/);
      f.assertReleased(); assert.throws(() => held.assertStable(), /closed/);
      if (fault === "none") held.close(); else assert.throws(() => held.close(), /cleanup|CLOSE|close/);
      f.assertReleased();
    } finally { f.cleanup(); }
  });
}

for (const [name, fault] of [
  ["openExactPoisonRecoveryPinnedChainV1", "file"],
  ["openExactPoisonHistoricalInventoryPinsV1", "file"],
  ["authenticateTask12ReceiptDirectoryChainV1", "guard"],
  ["openExactPoisonRecoveryPinnedParentV1", "guard"],
] as const) {
  test(`${name} refuses reacquisition after ambiguous owned release`, async () => {
    const f = fixture(fault);
    try {
      const open = f.load(name);
      const args = name.includes("PinnedChain") ? [true] : name.includes("Inventory") ? [f.inventory] : [f.privateDir];
      if (name.includes("PinnedParent")) {
        f.failParentConstruction(); assert.throws(() => open(...args));
      } else {
        const held = await open(...args); assert.throws(() => held.close());
      }
      f.assertReleased(); const count = f.allocated.length;
      await assert.rejects(async () => { await open(...args); }, /cleanup uncertain/);
      assert.equal(f.allocated.length, count, "uncertain process must not allocate a new owner");
    } finally { f.cleanup(); }
  });
}

test("successor construction failure still exhausts cleanup after an uncertain historical close", async () => {
  const f = fixture("historical");
  try { f.failConstruction(); await assert.rejects(f.load("openExactPoisonRecoveryPinnedChainV1")(true)); f.assertReleased(); }
  finally { f.cleanup(); }
});

for (const name of ["openExactPoisonRecoveryMemberV1", "openExactPoisonRecoveryPinnedRecordV1"] as const) {
  test(`${name} burns reacquisition after uncertain rejection before tracking`, () => {
    const f = fixture("guard");
    try {
      const open = f.load(name);
      if (name.includes("PinnedRecord")) f.makeTwoLinks(); else f.failMemberConstruction();
      assert.throws(() => open(f.files[0], "test-only record")); f.assertReleased();
      const count = f.allocated.length;
      assert.throws(() => open(f.files[0], "test-only record"), /cleanup uncertain/);
      assert.equal(f.allocated.length, count, "untracked uncertain close still burns process allocation");
    } finally { f.cleanup(); }
  });
}

for (const constructing of [false, true]) {
  test(`historical inventory exhausts release on ${constructing ? "construction" : "close"} failure`, () => {
    const f = fixture("file");
    try {
      if (constructing) { f.failConstruction(); assert.throws(() => f.load("openExactPoisonHistoricalInventoryPinsV1")(f.inventory)); }
      else { const held = f.load("openExactPoisonHistoricalInventoryPinsV1")(f.inventory);
        assert.throws(() => held.close()); f.assertReleased(); assert.throws(() => held.assertStable(), /closed/); assert.throws(() => held.close()); }
      f.assertReleased();
    } finally { f.cleanup(); }
  });
  test(`receipt directory guard exhausts release on ${constructing ? "construction" : "close"} failure`, () => {
    const f = fixture("guard");
    try {
      if (constructing) { f.failGuardConstruction(); assert.throws(() => f.load("authenticateTask12ReceiptDirectoryChainV1")(f.privateDir)); }
      else { const held = f.load("authenticateTask12ReceiptDirectoryChainV1")(f.privateDir);
        assert.throws(() => held.close()); assert.throws(() => held.assertStable(), /closed/); assert.throws(() => held.close()); }
      f.assertReleased();
    } finally { f.cleanup(); }
  });
}

test("pinned parent failed acquisition releases its guard after uncertain own close", () => {
  const f = fixture("guard");
  try { f.failParentConstruction(); assert.throws(() => f.load("openExactPoisonRecoveryPinnedParentV1")(f.home)); f.assertReleased(); }
  finally { f.cleanup(); }
});

test("pinned parent's uncertain close remains refused and burns new acquisition", () => {
  const f = fixture("guard");
  try {
    const open = f.load("openExactPoisonRecoveryPinnedParentV1");
    const held = open(f.home); assert.throws(() => held.close()); f.assertReleased();
    assert.throws(() => held.pin.assertStable(), /closed/);
    assert.throws(() => held.close(), /cleanup uncertain/);
    const count = f.allocated.length; assert.throws(() => open(f.home), /cleanup uncertain/);
    assert.equal(f.allocated.length, count);
  } finally { f.cleanup(); }
});

test("one owner's uncertain release invalidates another held owner but does not skip its cleanup", () => {
  const f = fixture("file");
  try {
    const open = f.load("openExactPoisonHistoricalInventoryPinsV1", ["authenticateTask12ReceiptDirectoryChainV1"]);
    const other = open.peers.authenticateTask12ReceiptDirectoryChainV1!(f.privateDir);
    const held = open(f.inventory); assert.throws(() => held.close());
    assert.throws(() => other.assertStable(), /cleanup uncertain/);
    other.close(); f.assertReleased();
  } finally { f.cleanup(); }
});

test("cleanup uncertainty during the first semantic await prevents subsequent chain allocation", async () => {
  const f = fixture("file");
  try {
    const open = f.load("openExactPoisonRecoveryPinnedChainV1", ["openExactPoisonHistoricalInventoryPinsV1"]);
    const other = open.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory);
    f.pauseParse(); const pending = open(true); void pending.catch(() => {});
    assert.throws(() => other.close()); const count = f.allocated.length;
    f.resumeParse(); await assert.rejects(pending, /cleanup uncertain/);
    assert.equal(f.allocated.length, count); f.assertReleased();
  } finally { f.cleanup(); }
});

for (const name of ["openExactPoisonRecoveryMemberV1", "openExactPoisonRecoveryPinnedRecordV1"] as const) {
  test(`${name} retains both invalid acquisition and uncertain close causes`, () => {
    const f = fixture("guard");
    try {
      const open = f.load(name);
      if (name.includes("PinnedRecord")) f.makeTwoLinks(); else f.failMemberConstruction();
      assert.throws(() => open(f.files[0], "test-only record"), (error: unknown) => {
        assert.ok(error instanceof AggregateError); assert.equal(error.errors.length, 2);
        assert.match(String(error.errors[0]), /identity is invalid|strict one-link final/);
        assert.ok(error.errors[1] instanceof AggregateError);
        assert.match(String(error.errors[1].errors[0]), /TEST_ONLY_CLOSE_UNCERTAIN/); return true;
      }); f.assertReleased();
    } finally { f.cleanup(); }
  });
}
