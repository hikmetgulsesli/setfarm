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

function fixture(fault: "none" | "file" | "parent" | "historical" | "guard" = "none", faultAfter = 0) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "sf-closure-close-")));
  const initial = fs.lstatSync(home, { bigint: true });
  fs.chmodSync(home, 0o700);
  const privateDir = path.join(home, "private"); fs.mkdirSync(privateDir, { mode: 0o700 });
  const files = Array.from({ length: 8 }, (_, i) => path.join(home, `r${i}`));
  for (const file of files) fs.writeFileSync(file, "diagnostic protocol record\n", { mode: 0o600 });
  const allocated: number[] = [];
  const attempts: number[] = [];
  const generations: { fd: number; attempts: number }[] = [];
  const active = new Map<number, { fd: number; attempts: number }>();
  let injected = false;
  let constructionFailure = false;
  let failGuardAfterOpen = false;
  let failParentIdentity = false;
  let failMemberIdentity = false;
  let pauseNextParse = false;
  let finishParse: (() => void) | undefined;
  const kinds = new Map<number, string>();
  const open = (target: string, flags: number, kind: string): number => {
    const fd = fs.openSync(target, flags); allocated.push(fd); kinds.set(fd, kind);
    const generation = { fd, attempts: 0 }; generations.push(generation); active.set(fd, generation); return fd;
  };
  const close = (fd: number): void => {
    attempts.push(fd);
    const generation = active.get(fd); assert.ok(generation, "close must own a live acquisition, not retry an ambiguous FD");
    generation.attempts += 1; active.delete(fd); fs.closeSync(fd);
    // Model ambiguous OS failure after releasing the FD. Never retry that FD.
    if (!injected && kinds.get(fd) === fault && faultAfter-- === 0) { injected = true; throw new Error("TEST_ONLY_CLOSE_UNCERTAIN"); }
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
    readTask12ReceiptDescriptorBytesV1: (fd: number) => {
      const bytes = Buffer.alloc(fs.fstatSync(fd).size); fs.readSync(fd, bytes, 0, bytes.length, 0); return bytes;
    },
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
  function load(name: string, additional: readonly string[] = [], overrides: Record<string, unknown> = {}, selectedCode?: string): ((...args: unknown[]) => any) & { peers: Record<string, (...args: unknown[]) => any> } {
    const node = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.body && node.name?.text === name)!;
    assert.ok(node, `missing actual function ${name}`);
    const cleanup = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.body && node.name?.text === "attemptTask6aReceiptOwnedCleanupV1");
    const asyncCleanup = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.body && node.name?.text === "attemptTask6aReceiptOwnedCleanupAsyncV1");
    const latch = ast.statements.filter(ts.isVariableStatement).find(node =>
      node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === "task6aReceiptCleanupUncertainV1"));
    const member = name === "openExactPoisonRecoveryPinnedRecordV1" ? ast.statements.filter(ts.isFunctionDeclaration)
      .find(node => node.body && node.name?.text === "openExactPoisonRecoveryMemberV1") : undefined;
    const peers = additional.map(name => ast.statements.filter(ts.isFunctionDeclaration).find(node => node.body && node.name?.text === name)!);
    const code = ts.transpileModule(`${latch?.getText(ast) ?? ""}\n${cleanup?.getText(ast) ?? ""}\n${asyncCleanup?.getText(ast) ?? ""}\n${member?.getText(ast) ?? ""}\n${selectedCode ?? node.getText(ast)}\n${peers.map(node => node.getText(ast)).join("\n")}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const context = vm.createContext({ ...ports, ...overrides });
    vm.runInContext(`${code}\nthis.actual=${name};this.peers={${additional.join(",")}};`, context);
    return Object.assign(context.actual, { peers: context.peers });
  }
  function local(name: string, variable: string, state: Record<string, unknown>, occurrence = 0) {
    const owner = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === name)!;
    const declarations: ts.VariableDeclaration[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variable) declarations.push(node);
      ts.forEachChild(node, visit);
    };
    visit(owner); const declaration = declarations[occurrence]; assert.ok(declaration?.initializer, `missing actual local ${name}.${variable}`);
    return load(name, ["openExactPoisonHistoricalInventoryPinsV1"], state,
      `const ${name} = ${declaration.initializer.getText(ast)};`);
  }
  function finalizer(name: string, state: Record<string, unknown>, asynchronous = false) {
    const owner = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === name)!;
    const block = owner.body!.statements.filter(ts.isTryStatement)[0]?.finallyBlock;
    assert.ok(block, `missing actual finalizer ${name}`);
    return load(name, ["openExactPoisonHistoricalInventoryPinsV1"], state, `${asynchronous ? "async " : ""}function ${name}() ${block.getText(ast)}`);
  }
  function acquisitionCatch(name: string, state: Record<string, unknown>, asynchronous = false) {
    const owner = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === name)!;
    const block = owner.body!.statements.filter(ts.isTryStatement)[0]?.catchClause?.block;
    assert.ok(block, `missing actual acquisition catch ${name}`);
    return load(name, [], state, `${asynchronous ? "async " : ""}function ${name}(error: unknown) ${block.getText(ast)}`);
  }
  function nestedAuthorityLoop(state: Record<string, unknown>) {
    const name = "openExactPoisonPostVisibleProgressStatusV1";
    const owner = ast.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === name)!;
    let loop: ts.ForOfStatement | undefined;
    const visit = (node: ts.Node): void => {
      if (ts.isForOfStatement(node) && ts.isIdentifier(node.expression)
        && node.expression.text === "EXACT_POISON_POST_VISIBLE_PROGRESS_NESTED_AUTHORITIES_V1") loop = node;
      ts.forEachChild(node, visit);
    }; visit(owner); assert.ok(loop);
    return load(name, [], state, `async function ${name}() { ${loop.getText(ast)} }`);
  }
  return { home, privateDir, files, inventory, allocated, attempts, load, local, finalizer, acquisitionCatch, nestedAuthorityLoop, openRecord, openParent, rawClose: close,
    failConstruction() { constructionFailure = true; },
    failGuardConstruction() { failGuardAfterOpen = true; },
    failParentConstruction() { failParentIdentity = true; },
    failMemberConstruction() { failMemberIdentity = true; },
    pauseParse() { pauseNextParse = true; },
    resumeParse() { assert.ok(finishParse); finishParse(); },
    makeTwoLinks() { const link = path.join(home, "bad-link"); fs.linkSync(files[0]!, link); files.push(link); },
    assertReleased() {
      for (const fd of allocated) assert.throws(() => fs.fstatSync(fd), { code: "EBADF" }, `descriptor ${fd} was skipped`);
      for (const generation of generations) assert.equal(generation.attempts, 1, "each acquisition is released exactly once, even when FD numbers are reused");
      assert.equal(attempts.length, generations.length, "no release attempt may target an already-revoked acquisition");
      assert.equal(active.size, 0);
    },
    cleanup() {
      for (const fd of active.keys()) { try { fs.closeSync(fd); } catch {} }
      const now = fs.lstatSync(home, { bigint: true });
      assert.equal(now.dev, initial.dev); assert.equal(now.ino, initial.ino); assert.equal(now.uid, initial.uid);
      for (const file of files) fs.unlinkSync(file); fs.rmdirSync(privateDir); fs.rmdirSync(home);
    },
  };
}

for (const invalidState of [false, true]) test(`recovery frontier exhausts temp and final release${invalidState ? " retaining the primary rejection" : " and burns subsequent acquisition"}`, () => {
  const f = fixture("file");
  try {
    f.makeTwoLinks();
    const candidate = { target: f.files[0]!, bytes: invalidState ? Buffer.from("crossed protocol bytes") : fs.readFileSync(f.files[0]!) };
    const frontier = f.load("assertExactPoisonRecoveryFrontierV1", ["openExactPoisonHistoricalInventoryPinsV1"], {
      exactPoisonRecoveryCandidateDirectoriesV1: () => [f.home],
      exactPoisonRecoveryTempPatternV1: () => /^bad-link$/,
      readdirSync: () => ["r0", "bad-link"], compareBytes: (a: string, b: string) => a.localeCompare(b),
      openExactPoisonRecoveryMemberV1: f.openRecord,
      exactPoisonRecoveryMemberIfPresentV1: f.openRecord,
    });
    assert.throws(() => frontier([candidate], { assertStable() {} }), (error: unknown) => {
      if (invalidState) {
        assert.ok(error instanceof AggregateError); assert.match(String(error.errors[0]), /physical state is invalid/);
        assert.match(String(error.errors[1]), /cleanup uncertain/);
      } return true;
    });
    f.assertReleased(); const count = f.allocated.length;
    assert.throws(() => frontier.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
    assert.equal(f.allocated.length, count);
  } finally { f.cleanup(); }
});

// Execute the actual owner-local release callback/finalizer, keeping authority
// parsers outside this resource-protocol test. A raw close without the latch, a
// first-error loop, or a dropped guard release must fail a real FD assertion.
for (const [name, variable] of [
  ["openExactPoisonRecoveryPostVisibleOriginalsV1", "close"],
  ["openExactPoisonPostVisibleProgressStatusV1", "closeAll"],
  ["openExactPoisonPostVisibleProgressNestedAuthorityV1", "close"],
  ["observeInternalProductionPreSchemaSpawnerRebindStatusAtRootV1", "closeResources"],
  ["openExactPoisonPostVisibleProgressCompletedRetainedStatusV1", "close"],
  ["openExactPoisonPostVisibleTask12ReceiptEndpointDirectoryNoWriteV1", "closeOwned"],
] as const) {
  test(`${name} release exhausts members/guards and burns subsequent acquisition`, () => {
    const f = fixture("file");
    try {
      const a = f.openRecord(f.files[0]!); const b = f.openRecord(f.files[1]!);
      const p = f.openParent(f.home); const q = f.openParent(f.privateDir);
      const state = { closed: false, cleanupError: null, filePins: [a, b], directoryPins: [p, q],
        nestedOwners: [], lastValidMember: null, lastValidGuard: null,
        contentMember: b, contentGuard: q, pairMember: a, directoryGuard: p,
        content: b, locator: a, parent: { close() { p.close(); q.close(); } },
        contentResources: [{ member: a, guard: p }, { member: b, guard: q }],
        directoryOwner: { close() {} }, memberPins: [a, b], guard: { close() { p.close(); q.close(); } },
        closeContentMember: () => f.rawClose(b.descriptor),
        closePairMember: () => f.rawClose(a.descriptor), pairGuard: p,
        knownDescriptor: { name: "test-only" } };
      const close = f.local(name, variable, state);
      assert.throws(() => close(null)); f.assertReleased(); const count = f.allocated.length;
      assert.throws(() => close.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
      assert.equal(f.allocated.length, count);
    } finally { f.cleanup(); }
  });
}

for (const name of [
  "resolveInternalProductionHistoricalPreMutationRuntimeAuthorityV1",
  "readHistoricalPreMutationRuntimeAuthorityAtRootV1",
  "readExactRetainedPreSchemaSpawnerRebindStatusV1",
  "readExactRetainedMigration32StatusV1",
] as const) {
  test(`${name} finalizer burns uncertainty after attempting every owner`, () => {
    const f = fixture("file");
    try {
      const member = f.openRecord(f.files[0]!); const guard = f.openParent(f.home);
      const close = f.finalizer(name, { operationPin: member, rootReader: guard, pins: [member], guards: [guard], member, guard, primaryError: null });
      assert.throws(() => close()); f.assertReleased(); const count = f.allocated.length;
      assert.throws(() => close.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
      assert.equal(f.allocated.length, count);
    } finally { f.cleanup(); }
  });
}

test("recovery resource group preserves primary plus cleanup causes and revokes allocation", () => {
  const f = fixture("file");
  try {
    const a = f.openRecord(f.files[0]!); const p = f.openParent(f.home);
    const close = f.load("closeExactPoisonPostVisibleProgressRecoveryResourcesV1", ["openExactPoisonHistoricalInventoryPinsV1"]);
    const primary = new Error("TEST_ONLY_PRIMARY");
    assert.throws(() => close([{ close: p.close }, { close: () => f.rawClose(a.descriptor) }], primary), (error: unknown) => {
      assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primary);
      assert.match(String(error.errors[1]), /cleanup uncertain/); return true;
    }); f.assertReleased();
    assert.throws(() => close.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
  } finally { f.cleanup(); }
});

test("uncertain release invalidates a still-open raw member observation", () => {
  const f = fixture("file");
  try {
    const member = f.openRecord(f.files[0]!);
    const stable = f.load("assertExactPoisonRecoveryPinnedMemberStableV1", ["openExactPoisonHistoricalInventoryPinsV1"]);
    stable(member.target, member, "test-only held member");
    const other = stable.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory); assert.throws(() => other.close());
    assert.throws(() => stable(member.target, member, "test-only held member"), /cleanup uncertain/);
    f.rawClose(member.descriptor); f.assertReleased();
  } finally { f.cleanup(); }
});

for (const faultAfter of [0, 1] as const) {
  test(`publisher revokes ${faultAfter === 0 ? "temp write" : "old selected"} ownership before uncertain close`, async () => {
    const f = fixture("file", faultAfter);
    try {
      let linked = false;
      const publish = f.load("publishExactPoisonRecoveryCandidateV1", ["openExactPoisonHistoricalInventoryPinsV1"], {
        EXACT_POISON_RECOVERY_PUBLICATION_PHASES_V1: [{ phase: "test-only-phase" }],
        assertExactPoisonRecoveryPublicationFenceV1: async () => {}, ensureExactPoisonRecoveryCandidateDirectoryV1() {},
        exactPoisonRecoveryTempPatternV1: () => /^test-only-temp$/, readdirSync: () => [],
        compareBytes: (a: string, b: string) => a.localeCompare(b),
        exactPoisonRecoveryMemberIfPresentV1: () => null,
        openExactPoisonRecoveryMemberV1: () => f.openRecord(f.files[0]!),
        openSync: () => f.openRecord(f.files[0]!).descriptor,
        writeFileSync() {}, fchmodSync() {}, fsyncSync() {}, exactPoisonRecoveryPublicationFaultV1() {},
        fsyncExactPoisonRecoveryCandidateParentV1() {}, linkSync() { linked = true; }, unlinkSync() {},
        fstatSync: (fd: number) => ({ ...fs.fstatSync(fd, { bigint: true }), nlink: linked ? 2n : 1n }),
        lstatSync: () => ({ ...fs.lstatSync(f.files[0]!, { bigint: true }), nlink: linked ? 2n : 1n }),
        assertExactPoisonRecoveryPinnedMemberStableV1() {},
        readTask12ReceiptStoreSnapshotV1: () => ({ bytes: fs.readFileSync(f.files[0]!) }),
      });
      // Publication effects are deliberately not exercised or authenticated;
      // only actual owner transfers and real acquired FD release are under test.
      await assert.rejects(publish({}, { candidates: [{ target: f.files[0]!, bytes: fs.readFileSync(f.files[0]!) }] },
        "test-only-phase", 0, { assertStable() {} }));
      f.assertReleased();
      assert.throws(() => publish.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
    } finally { f.cleanup(); }
  });
}

for (const variable of ["openContent", "openProcessIdentity"] as const) {
  test(`pre-schema ${variable} transfers a newly opened member before membership rejection`, async () => {
    const f = fixture("file");
    try {
      const resources: any[] = [];
      const open = f.local("observeInternalProductionPreSchemaSpawnerRebindStatusAtRootV1", variable, {
        SHA256: /^[a-f0-9]{64}$/, fixedWorkspaceAuthorityPathV1: () => f.files[0], contentResources: resources,
        dynamicContentResources: new Map(), openExactPoisonRecoveryMemberV1: (target: string) => {
          const member = f.openRecord(target); return { ...member, identity: { ...member.identity, uid: member.identity.uid + 1n } };
        },
      });
      const hash = "a".repeat(64);
      const args = variable === "openContent"
        ? ["test-only", { ref: "test-only", hash }, "ref", "hash", async () => ({})]
        : [`setfarm://internal-production/spawner-process-identity/sha256/${hash}`, hash, "test-only"];
      await assert.rejects(open(...args), /membership is crossed/);
      // The outer owner must own both resources even when validation rejects.
      assert.equal(resources.length, 1, "opened member/guard must be tracked before fallible membership check");
      const close = f.local("observeInternalProductionPreSchemaSpawnerRebindStatusAtRootV1", "closeResources",
        { contentResources: resources, directoryOwner: { close() {} } });
      assert.throws(() => close(null)); f.assertReleased();
    } finally { f.cleanup(); }
  });
}

test("progress status tracks a returned nested owner before rejecting crossed authority", async () => {
  const f = fixture();
  try {
    const nestedOwners: { close(): void }[] = [];
    const open = f.nestedAuthorityLoop({
      EXACT_POISON_POST_VISIBLE_PROGRESS_NESTED_AUTHORITIES_V1: [{ name: "preMutationLoadedRuntimeServiceAuthority", from: "test-only", sourceKind: "test-only" }],
      EXACT_POISON_POST_VISIBLE_PROGRESS_ROWS_V1: [{ row: "test-only" }], rowIndex: 0,
      effectiveStatus: {}, authority: { successorOperation: { operationRef: "test-only", operationHash: "test-only" } },
      projectExactPoisonPostVisibleProgressNestedAuthorityPairV1: () => ({}),
      openExactPoisonPostVisibleProgressNestedAuthorityV1: async () => {
        const member = f.openRecord(f.files[0]!); const guard = f.openParent(f.home);
        return { body: { currentEntryOperationRef: "crossed", currentEntryOperationHash: "crossed" },
          close() { f.rawClose(member.descriptor); guard.close(); } };
      }, nestedOwners, expectedNested: {}, observedNested: {},
    });
    await assert.rejects(open(), /operation authority is crossed/);
    assert.equal(nestedOwners.length, 1, "returned nested FD owner must transfer before fallible validation");
    for (const owner of nestedOwners) owner.close(); f.assertReleased();
  } finally { f.cleanup(); }
});

for (const [name, variable, occurrence] of [
  ["observeExactPoisonPostVisibleProgressRawNoWriteV1", "close", 0],
  ["observeExactPoisonPostVisibleProgressRawNoWriteV1", "close", 1],
  ["openExactPoisonPostVisibleSelectedProgressPassV1", "closeResources", 0],
] as const) {
  test(`${name} owner branch ${occurrence} exhausts awaited cleanup and retains two distinct failures`, async () => {
    const f = fixture();
    try {
      const a = f.openRecord(f.files[0]!); const b = f.openRecord(f.files[1]!);
      const first = new Error("TEST_ONLY_FIRST_CHILD_CLOSE"); const second = new Error("TEST_ONLY_SECOND_CHILD_CLOSE");
      const childA = { async close() { f.rawClose(a.descriptor); throw first; } };
      const childB = { async close() { f.rawClose(b.descriptor); throw second; } };
      const close = f.local(name, variable, { closed: false, owned: [childA, childB], currentStatusCas: null,
        raw: childB, status: childA, operationDirectoryGuard: null, rootReader: { close() {} } }, occurrence);
      await assert.rejects(close(), (error: unknown) => {
        assert.ok(error instanceof AggregateError); assert.deepEqual(error.errors, [second, first]); return true;
      }); f.assertReleased();
      assert.throws(() => close.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
    } finally { f.cleanup(); }
  });
}

for (const name of ["observeExactPoisonRecoveryPostVisibleZeroFenceV1", "observeExactPoisonPostVisiblePreStatusPassNoWriteV1", "observeExactPoisonPostVisibleProgressPassNoWriteV1"] as const) {
  test(`${name} borrowed-owner finalizer preserves primary plus cleanup causes`, async () => {
    const f = fixture("file", name.includes("ProgressPassNoWrite") ? 0 : 1);
    try {
      const a = f.openRecord(f.files[0]!); const b = f.openRecord(f.files[1]!);
      const primaryError = new Error("TEST_ONLY_PRIMARY");
      const originals = { close() { f.rawClose(a.descriptor); } };
      const close = f.finalizer(name, { originals, primaryError, primary: primaryError, currentStatusCas: null,
        raw: { async close() { f.rawClose(a.descriptor); } }, status: { close() { f.rawClose(b.descriptor); } } }, true);
      if (name.includes("ProgressPassNoWrite")) {
        await assert.rejects(close(), (error: unknown) => {
          assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primaryError); return true;
        });
      } else {
        // Only one owner exists on the originals-borrowing path.
        f.rawClose(b.descriptor);
        await assert.rejects(close(), (error: unknown) => {
          assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primaryError); return true;
        });
      }
      f.assertReleased();
    } finally { f.cleanup(); }
  });
}

for (const name of ["observeExactPoisonPostVisibleProgressRawNoWriteV1", "openExactPoisonPostVisibleSelectedProgressPassV1"] as const) {
  test(`${name} acquisition cleanup preserves its primary rejection`, async () => {
    const f = fixture("file");
    try {
      const member = f.openRecord(f.files[0]!); const primary = new Error("TEST_ONLY_PRIMARY");
      const release = async () => { f.rawClose(member.descriptor); };
      const reject = f.acquisitionCatch(name, { closed: false, owned: [{ close: release }], closeResources: release }, true);
      await assert.rejects(reject(primary), (error: unknown) => {
        assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primary); return true;
      }); f.assertReleased();
    } finally { f.cleanup(); }
  });
}

for (const [name, variable] of [
  ["openExactPoisonRecoveryPostVisibleOriginalsV1", "close"],
  ["openExactPoisonPostVisibleTask12ReceiptEndpointDirectoryNoWriteV1", "closeOwned"],
] as const) {
  test(`${name} acquisition catch preserves primary and close causes`, () => {
    const f = fixture("file");
    try {
      const member = f.openRecord(f.files[0]!); const primary = new Error("TEST_ONLY_PRIMARY");
      const reject = f.acquisitionCatch(name, { [variable]: () => f.rawClose(member.descriptor) });
      assert.throws(() => reject(primary), (error: unknown) => {
        assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primary);
        assert.match(String(error.errors[1]), /TEST_ONLY_CLOSE_UNCERTAIN/); return true;
      }); f.assertReleased();
    } finally { f.cleanup(); }
  });
}

test("publisher cleanup retains its primary crossed-state rejection", async () => {
  const f = fixture("file");
  try {
    f.makeTwoLinks();
    const publish = f.load("publishExactPoisonRecoveryCandidateV1", [], {
      EXACT_POISON_RECOVERY_PUBLICATION_PHASES_V1: [{ phase: "test-only-phase" }],
      assertExactPoisonRecoveryPublicationFenceV1: async () => {}, ensureExactPoisonRecoveryCandidateDirectoryV1() {},
      exactPoisonRecoveryTempPatternV1: () => /^bad-link$/, readdirSync: () => ["bad-link"],
      compareBytes: (a: string, b: string) => a.localeCompare(b),
      openExactPoisonRecoveryMemberV1: () => f.openRecord(f.files[0]!),
      exactPoisonRecoveryMemberIfPresentV1: () => f.openRecord(f.files[0]!),
    });
    await assert.rejects(publish({}, { candidates: [{ target: f.files[0], bytes: Buffer.from("crossed protocol bytes") }] },
      "test-only-phase", 0, { assertStable() {} }), (error: unknown) => {
      assert.ok(error instanceof AggregateError); assert.match(String(error.errors[0]), /selected temp is crossed/);
      assert.match(String(error.errors[1]), /cleanup uncertain/); return true;
    }); f.assertReleased();
  } finally { f.cleanup(); }
});

for (const variable of ["closePairMember", "closeContentMember"] as const) {
  test(`completed retained ${variable} latches its own raw-member cleanup`, () => {
    const f = fixture("file");
    try {
      const member = f.openRecord(f.files[0]!);
      const close = f.local("openExactPoisonPostVisibleProgressCompletedRetainedStatusV1", variable,
        { pairMember: member, contentMember: member, pairMemberClosed: false, contentMemberClosed: false });
      assert.throws(() => close()); f.assertReleased(); close(); f.assertReleased();
      assert.throws(() => close.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
    } finally { f.cleanup(); }
  });
}

test("recovery retained record latches its individual raw-member cleanup", () => {
  const f = fixture("file");
  try {
    const resources: { close(): void }[] = [];
    const retain = f.local("observeInternalProductionRecoverySourceBootstrapStatusAtRootV1", "retainRecord", {
      resources, retainedRecords: new Map(), openExactPoisonRecoveryMemberV1: f.openRecord,
      assertExactPoisonRecoveryPinnedMemberStableV1() {},
      strictCanonicalRecord: () => ({ diagnostic: "protocol only" }),
    });
    retain(f.files[0], "test-only"); assert.equal(resources.length, 2);
    assert.throws(() => resources[1]!.close()); resources[0]!.close(); f.assertReleased();
    assert.throws(() => retain.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
  } finally { f.cleanup(); }
});

for (const name of ["openExactPoisonPostVisibleProgressStatusV1", "openExactPoisonPostVisibleProgressNestedAuthorityV1"] as const) {
  test(`${name} construction retains both primary and uncertain cleanup`, async () => {
    const f = fixture("file");
    try {
      const primary = new Error("TEST_ONLY_PRIMARY");
      const descriptor = { name: "test-only", from: "test-only", sourceKind: "test-only", sourcePath: "test-only",
        statusKeys: [], pairKeys: [], recordKind: "test-only", prefix: "test-only", rootAuthority: "test-only" };
      const open = f.load(name, ["openExactPoisonHistoricalInventoryPinsV1"], {
        EXACT_POISON_POST_VISIBLE_PROGRESS_NESTED_AUTHORITIES_V1: [descriptor],
        projectExactPoisonPostVisibleProgressNestedAuthorityPairV1: () => ({}),
        resolveExactPoisonPostVisibleProgressNestedAuthorityRouteV1: () => f.files[0],
        openExactPoisonRecoveryMemberV1: () => f.openRecord(f.files[0]!),
        requirePair: (value: unknown) => value,
        strictCanonicalRecord() { throw primary; }, requireExactPoisonPostVisibleProgressNestedAuthorityBodyV1() { throw primary; },
      });
      const authority = { assertStable() {}, currentStatusTarget: path.join(f.home, "01-current-status.pair.json") };
      await assert.rejects(open(authority, {}, descriptor), (error: unknown) => {
        assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primary);
        assert.match(String(error.errors[1]), /cleanup uncertain/); return true;
      }); f.assertReleased();
      assert.throws(() => open.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
    } finally { f.cleanup(); }
  });
}

test("endpoint untracked member rejection retains cleanup uncertainty and revokes the held owner", () => {
  const f = fixture("guard");
  try {
    const open = f.load("openExactPoisonPostVisibleTask12ReceiptEndpointDirectoryNoWriteV1", ["openExactPoisonHistoricalInventoryPinsV1"], {
      process: { platform: "test-only" }, task12ReceiptLocatorWriterAuthorityTargetV1: (target: string) => target,
      readdirSync: fs.readdirSync, compareBytes: (a: string, b: string) => a.localeCompare(b),
      observeTask12ReceiptPhysicalIdentityV1: (stats: fs.BigIntStats) => ({ diagnosticDevice: stats.dev.toString() }),
    });
    const held = open(f.files[0]); f.failMemberConstruction();
    assert.throws(() => held.pinMember(f.files[0]), (error: unknown) => {
      assert.ok(error instanceof AggregateError); assert.match(String(error.errors[0]), /identity is invalid/);
      assert.match(String(error.errors[1]), /cleanup uncertain/); return true;
    });
    assert.throws(() => held.assertStable(), /cleanup uncertain/);
    held.close(); f.assertReleased();
    assert.throws(() => open.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
  } finally { f.cleanup(); }
});

for (const name of [
  "resolveInternalProductionHistoricalPreMutationRuntimeAuthorityV1", "readHistoricalPreMutationRuntimeAuthorityAtRootV1",
  "readExactRetainedPreSchemaSpawnerRebindStatusV1", "readExactRetainedMigration32StatusV1",
] as const) {
  test(`${name} finalizer retains the preceding primary error`, () => {
    const f = fixture("file");
    try {
      const member = f.openRecord(f.files[0]!); const guard = f.openParent(f.home);
      const primaryError = new Error("TEST_ONLY_PRIMARY");
      const close = f.finalizer(name, { operationPin: member, rootReader: guard, pins: [member], guards: [guard], member, guard, primaryError });
      assert.throws(() => close(), (error: unknown) => {
        assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primaryError);
        assert.match(String(error.errors[1]), /cleanup uncertain/); return true;
      }); f.assertReleased();
    } finally { f.cleanup(); }
  });
}

test("post-visible originals retains uncertain repeat-close refusal", () => {
  const f = fixture("file");
  try {
    const close = f.local("openExactPoisonRecoveryPostVisibleOriginalsV1", "close",
      { closed: false, cleanupError: null, filePins: [f.openRecord(f.files[0]!)], directoryPins: [] });
    assert.throws(() => close()); f.assertReleased();
    assert.throws(() => close(), /cleanup uncertain/); f.assertReleased();
  } finally { f.cleanup(); }
});

for (const secondFailure of [false, true]) test(`completed retained construction retains primary and ${secondFailure ? "two" : "one"} cleanup failures`, async () => {
  const f = fixture("file");
  try {
    const primary = new Error("TEST_ONLY_PRIMARY");
    const secondary = new Error("TEST_ONLY_SECOND_CLOSE_UNCERTAIN");
    const operation = { operationRef: "test-only-ref", operationHash: "a".repeat(64) };
    const open = f.load("openExactPoisonPostVisibleProgressCompletedRetainedStatusV1", ["openExactPoisonHistoricalInventoryPinsV1"], {
      EXACT_POISON_POST_VISIBLE_MIGRATION_RETAINED_READ_FAULTS_V1: { 1: {} },
      task12MigrationOperationDirectoryV1: () => f.home, task12MigrationRecordPathV1: () => f.files[0],
      exactPoisonPostVisibleProgressFaultV1() {}, openExactPoisonRecoveryMemberV1: () => f.openRecord(f.files[0]!),
      TASK12_MIGRATION_PREFIXES_V1: { status: "test-only" },
      requirePair: () => ({ statusRef: "test-only", statusHash: "a".repeat(64) }), strictCanonicalRecord: () => ({}),
      resolveInternalProductionPreManifestMigration32AuthorizationStatusV1: async () => { throw primary; },
      ...(secondFailure ? { closeSync: (fd: number) => { f.rawClose(fd); throw secondary; } } : {}),
    });
    await assert.rejects(open({ assertStable() {}, successorOperation: operation }, operation, "migration-32", 1), (error: unknown) => {
      assert.ok(error instanceof AggregateError); assert.equal(error.errors[0], primary);
      assert.match(String(error.errors[1]), /cleanup uncertain/);
      if (secondFailure) {
        const causes = (value: unknown): unknown[] => value instanceof AggregateError
          ? value.errors.flatMap(causes) : [value];
        const retained = causes(error); assert.ok(retained.includes(primary)); assert.ok(retained.includes(secondary));
        assert.ok(retained.some(cause => String(cause).includes("TEST_ONLY_CLOSE_UNCERTAIN")));
      } return true;
    }); f.assertReleased();
    assert.throws(() => open.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
  } finally { f.cleanup(); }
});

for (const variable of ["openContent", "openProcessIdentity"] as const) {
  test(`pre-schema ${variable} retains uncertain guard release before member transfer`, async () => {
    const f = fixture("historical");
    try {
      const open = f.local("observeInternalProductionPreSchemaSpawnerRebindStatusAtRootV1", variable, {
        SHA256: /^[a-f0-9]{64}$/, fixedWorkspaceAuthorityPathV1: () => f.files[0], contentResources: [],
        lstatSync: () => ({ ...fs.lstatSync(f.home, { bigint: true }), isDirectory: () => false }),
      });
      const hash = "a".repeat(64);
      const args = variable === "openContent"
        ? ["test-only", { ref: "test-only", hash }, "ref", "hash", async () => ({})]
        : [`setfarm://internal-production/spawner-process-identity/sha256/${hash}`, hash, "test-only"];
      await assert.rejects(open(...args), (error: unknown) => {
        assert.ok(error instanceof AggregateError); assert.match(String(error.errors[0]), /directory identity is invalid/);
        assert.match(String(error.errors[1]), /cleanup uncertain/); return true;
      }); f.assertReleased();
      assert.throws(() => open.peers.openExactPoisonHistoricalInventoryPinsV1!(f.inventory), /cleanup uncertain/);
    } finally { f.cleanup(); }
  });
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
