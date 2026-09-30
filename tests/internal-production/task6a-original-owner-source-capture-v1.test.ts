import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

// Actual capture/physical comparison bodies, real held FDs; lower semantic/Git
// owners are protocol ports. These fixtures confer no authentic source authority.
const source = fs.readFileSync(new URL("../../src/internal-production/baseline-post-handoff-receipt-v1.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("receipt.ts", source, ts.ScriptTarget.ES2022, true);
const captureName = "observeInternalProductionTask6aOriginalOwnerReceiptCaptureNoWriteV1";
const roles = ["predecessor-operation", "successor-edge", "quarantine-disposition", "successor-operation", "authority-v31", "pending-migration", "activation-seal", "activation-commit"];
type Member = { target: string; descriptor: number; identity: fs.BigIntStats; bytes: Buffer };
type Captured = { schema: string; purpose: string; currentCaptureSource: unknown; orderedMembers: Array<{ role: string; locator: string; bytesBase64: string; bytesSha256: string; identity: Record<string, string> }>;
  originalMembers: Array<{ locator: string; bytesBase64: string }>; historicalPrerequisiteInventory: unknown };

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "sf-original-capture-")));
  fs.chmodSync(root, 0o700);
  const firstRoot = fs.lstatSync(root, { bigint: true });
  const files = Array.from({ length: 13 }, (_, i) => path.join(root, `member-${i}.json`));
  for (const [i, file] of files.entries()) fs.writeFileSync(file, `{"protocolMember":${i}}\n`, { mode: 0o600 });
  const liveDescriptors = new Set<number>();
  const cleanupCalls: string[] = [];
  const closeErrors = new Set<string>();
  const calls: string[] = [];
  const sourceValue = Object.freeze({ sha: "a".repeat(40), treeHash: "b".repeat(40), buildHash: "c".repeat(64) });
  let sourceReads = 0;
  let sourceDrift = false;
  let originalReject = false;
  let chainReject = false;
  let chainPaused = false;
  let resumeChain: (() => void) | undefined;
  let sourceHook: (() => void) | undefined;
  let chainShape: "valid" | "reversed" | "truncated" = "valid";
  let originalTruncated = false;
  let context!: vm.Context;
  let chainMembers: Member[] = [];
  let originalMembers: Member[] = [];
  const history = Object.freeze({ inventoryBody: Object.freeze({ orderedRecords: Object.freeze([
    Object.freeze({ state: "present", parents: Object.freeze(["held-original-parent"]), file: Object.freeze({ bytesBase64: "aGlzdG9yeQ==" }) }),
    Object.freeze({ state: "absent", parents: Object.freeze(["held-absence-parent"]) }),
  ]) }), inventoryHash: "d".repeat(64) });
  let historyValue: unknown = history;
  const open = (target: string, directory = false) => {
    const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | (directory ? fs.constants.O_DIRECTORY : 0));
    liveDescriptors.add(fd); return fd;
  };
  const close = (fd: number) => { assert.ok(liveDescriptors.delete(fd), "must release a live acquisition once"); fs.closeSync(fd); };
  const readMember = (target: string): Member => { const descriptor = open(target); return { target, descriptor,
    identity: fs.fstatSync(descriptor, { bigint: true }), bytes: fs.readFileSync(descriptor) }; };
  const closeOwner = (name: string, fds: number[]) => {
    cleanupCalls.push(name); for (const fd of fds) close(fd);
    if (closeErrors.has(name)) throw Error(`UNCERTAIN_${name}`);
  };
  const stable = (members: Member[]) => {
    for (const member of members) context.assertExactPoisonRecoveryPinnedRecordStableV1(member, "capture protocol member");
  };
  const anchor = () => {
    calls.push("anchor"); const fd = open(root, true);
    return { assertStable() {
      assert.ok(liveDescriptors.has(fd));
      const now = fs.lstatSync(root, { bigint: true });
      if (now.ino !== firstRoot.ino || now.uid !== firstRoot.uid || (now.mode & 0o777n) !== 0o700n) throw Error("ANCHOR_DRIFT");
    }, close() { closeOwner("anchor", [fd]); } };
  };
  const ports: Record<string, unknown> = {
    Object, Reflect, Buffer, BigInt, AggregateError, Map, path, process, createHash,
    lstatSync: fs.lstatSync, fstatSync: fs.fstatSync, readSync: fs.readSync,
    CURRENT_ENTRY_MAX_BYTES: 1_048_576,
    currentEntryFail(message: string): never { throw Error(`INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:${message}`); },
    authenticateInternalProductionBaselineWorkspaceAnchorV1: anchor,
    resolveInternalProductionBaselineWorkspaceRootV1: () => root,
    CODE_OWNED_WORKSPACE_ROOT_V1: root,
    fixedLegacyCurrentEntryRootV1: () => root,
    exactPoisonRecoveryRelativeLocatorV1: (target: string) => path.relative(root, target),
    EXACT_POISON_ORIGINAL_FILE_LOCATORS_V1: files.slice(8).map(file => path.basename(file)),
    canonicalComparable: JSON.stringify,
    requireSource: (value: unknown) => value,
    observeCurrentInternalProductionCleanSetfarmSourceBuildV1: () => {
      calls.push("source"); sourceReads += 1;
      if (sourceReads === 2) sourceHook?.();
      return sourceDrift && sourceReads === 2 ? { ...sourceValue, sha: "e".repeat(40) } : sourceValue;
    },
    openExactPoisonRecoveryPinnedCommitChainV1: async () => {
      calls.push("chain");
      if (chainReject) throw Error("CHAIN_REJECTED");
      if (chainPaused) await new Promise<void>(resolve => { resumeChain = resolve; });
      chainMembers = files.slice(0, 8).map(readMember);
      return { records: chainShape === "reversed" ? [...chainMembers].reverse() : chainShape === "truncated" ? chainMembers.slice(0, 7) : chainMembers,
        operation: chainMembers[0], edge: chainMembers[1], disposition: chainMembers[2],
        successorOperationRecord: chainMembers[3], successorAuthorityV31: chainMembers[4], successorPending: chainMembers[5], seal: chainMembers[6], commit: chainMembers[7],
        successorOperation: { operationRef: "fixture-successor", operationHash: "f".repeat(64) },
        dispositionValue: { value: { historicalPrerequisiteInventory: historyValue } },
        assertStable() { stable(chainMembers); }, close() { closeOwner("chain", chainMembers.map(member => member.descriptor)); } };
    },
    openExactPoisonRecoveryPostVisibleOriginalsV1: () => {
      calls.push("originals"); if (originalReject) throw Error("ORIGINAL_INVENTORY_CROSSED");
      originalMembers = files.slice(8).map(readMember);
      return { records: originalTruncated ? originalMembers.slice(0, 4) : originalMembers, evidence: { inventoryBody: { originalCount: 5 }, inventoryHash: "1".repeat(64),
        predecessorFileIdentities: [{ fixture: true }], assertStableOriginals() { stable(originalMembers); } },
        close() { closeOwner("originals", originalMembers.map(member => member.descriptor)); } };
    },
    fsyncSync() { assert.fail("capture must never fsync"); },
    writeFileSync() { assert.fail("capture must never write"); },
    durablyAuthenticateSuccessorActivationCommitV1() { assert.fail("capture must never call V1 durability"); },
    selectCurrentEntryStoreContextV1() { assert.fail("capture must never call the V1 selector"); },
    resolveInternalProductionCurrentEntryOperationV1() { assert.fail("capture must never call the public V1 resolver"); },
  };
  context = vm.createContext(ports);
  const names = ["sha256", "sameRegularMetadata", "readTask12ReceiptDescriptorBytesV1", "assertExactPoisonRecoveryPinnedMemberStableV1",
    "assertExactPoisonRecoveryPinnedRecordStableV1", "attemptTask6aReceiptOwnedCleanupV1", "recursivelyFreeze",
    "captureTask6aReceiptPinnedMemberV1", captureName];
  const bodies = names.flatMap(name => {
    const node = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.body);
    return node ? [node.getText(ast).replace(/^export\s+/, "")] : [];
  });
  vm.runInContext(ts.transpileModule(`let task6aReceiptCleanupUncertainV1 = false;\n${bodies.join("\n")}`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
  return { root, files, calls, cleanupCalls, closeErrors, liveDescriptors, history,
    invoke: async (...args: unknown[]): Promise<Captured> => {
      const fn = context[captureName]; assert.equal(typeof fn, "function", "original-owner no-write capture composition is missing");
      return await fn(...args) as Captured;
    },
    members: () => [...chainMembers, ...originalMembers],
    burn() { vm.runInContext("task6aReceiptCleanupUncertainV1 = true", context); },
    driftSource() { sourceDrift = true; }, rejectOriginal() { originalReject = true; }, rejectChain() { chainReject = true; },
    pause() { chainPaused = true; }, resume() { assert.ok(resumeChain); resumeChain(); },
    onFinalSource(hook: () => void) { sourceHook = hook; },
    crossChain(value: "reversed" | "truncated") { chainShape = value; }, truncateOriginals() { originalTruncated = true; },
    omitHistory() { historyValue = undefined; },
    oversizeRawMember() {
      // Synthetic lower-reader port allows a record impossible under authentic
      // V1's1MiB cap, solely to exercise the capture's independent aggregate cap.
      context.CURRENT_ENTRY_MAX_BYTES = 33_554_432;
      fs.writeFileSync(files[0]!, Buffer.alloc(16_777_217));
    },
    oversizeDiagnosticHistory() {
      // Synthetic non-authentic inventory, never a production parser substitute.
      historyValue = { oversizedProtocolPayload: "x".repeat(33_554_432) };
    },
    finish() {
      // Test emergency cleanup, not an implementation success assertion.
      for (const fd of [...liveDescriptors]) close(fd);
      for (const file of files) fs.unlinkSync(file);
      const now = fs.lstatSync(root, { bigint: true }); assert.equal(now.dev, firstRoot.dev); assert.equal(now.ino, firstRoot.ino);
      fs.rmdirSync(root);
    } };
}

function leaves(error: unknown): string[] {
  return error instanceof AggregateError ? error.errors.flatMap(leaves) : [String(error)];
}

test("capture retains all eight chain and five original members through copying and yields immutable diagnostic bytes", async () => {
  const f = fixture(); try {
    const result = await f.invoke();
    assert.equal(result.schema, "setfarm.internal-production-original-owner-receipt-capture.v1");
    assert.equal(result.purpose, "task6a-original-owner-receipt-capture-no-write-v1");
    assert.deepEqual(Array.from(result.orderedMembers, member => member.role), roles);
    assert.deepEqual(Array.from(result.orderedMembers, member => member.locator), Array.from({ length: 8 }, (_, i) => `member-${i}.json`));
    assert.deepEqual(Array.from(result.originalMembers, member => member.locator), Array.from({ length: 5 }, (_, i) => `member-${i + 8}.json`));
    for (const [i, member] of [...result.orderedMembers, ...result.originalMembers].entries()) assert.equal(member.bytesBase64, Buffer.from(`{"protocolMember":${i}}\n`).toString("base64"));
    assert.equal(result.orderedMembers[0]!.bytesSha256, "0fd296ccd9c18c09ab1ccf4f718b9b385bc3772d2d3a442e82fce93bd33fb4ee");
    assert.equal(JSON.stringify(result.historicalPrerequisiteInventory), JSON.stringify(f.history));
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.orderedMembers)); assert.ok(Object.isFrozen(result.orderedMembers[0]!.identity));
    const bytes = result.orderedMembers[0]!.bytesBase64;
    f.members()[0]!.bytes.fill(0); assert.equal(result.orderedMembers[0]!.bytesBase64, bytes);
    assert.equal(f.liveDescriptors.size, 0); assert.deepEqual(f.cleanupCalls, ["originals", "chain", "anchor"]);
  } finally { f.finish(); }
});

test("capture rejects caller overrides before any owner allocation", async () => {
  const f = fixture(); try { await assert.rejects(f.invoke({ root: f.root }), /zero|argument/i); assert.deepEqual(f.calls, []); } finally { f.finish(); }
});
test("capture rejects burned cleanup before any owner allocation", async () => {
  const f = fixture(); try { f.burn(); await assert.rejects(f.invoke(), /cleanup uncertain/); assert.deepEqual(f.calls, []); } finally { f.finish(); }
});
test("capture retains only the anchor after a rejected chain acquisition", async () => {
  const f = fixture(); try { f.rejectChain(); await assert.rejects(f.invoke(), /CHAIN_REJECTED/); assert.deepEqual(f.cleanupCalls, ["anchor"]); assert.equal(f.liveDescriptors.size, 0); } finally { f.finish(); }
});
test("capture rejects original physical inventory rather than yielding only the chain", async () => {
  const f = fixture(); try { f.rejectOriginal(); await assert.rejects(f.invoke(), /ORIGINAL_INVENTORY_CROSSED/); assert.deepEqual(f.cleanupCalls, ["chain", "anchor"]); assert.equal(f.liveDescriptors.size, 0); } finally { f.finish(); }
});
test("capture rejects source drift before releasing a result", async () => {
  const f = fixture(); try { f.driftSource(); await assert.rejects(f.invoke(), /source.*changed|source.*drift/i); assert.equal(f.liveDescriptors.size, 0); assert.deepEqual(f.cleanupCalls, ["originals", "chain", "anchor"]); } finally { f.finish(); }
});
for (const index of [0, 7, 8, 12]) test(`capture final physical recheck rejects changed held member ${index}`, async () => {
  const f = fixture(); try { f.onFinalSource(() => fs.writeFileSync(f.files[index]!, "changed\n")); await assert.rejects(f.invoke(), /changed while held/); assert.equal(f.liveDescriptors.size, 0); } finally { f.finish(); }
});
test("capture rechecks original owner anchor after its semantic await", async () => {
  const f = fixture(); try {
    f.pause(); const pending = f.invoke(); await new Promise<void>(resolve => setImmediate(resolve));
    fs.chmodSync(f.root, 0o755); f.resume(); await assert.rejects(pending, /ANCHOR_DRIFT/);
    assert.ok(!f.calls.includes("originals")); assert.equal(f.liveDescriptors.size, 0);
  } finally { f.finish(); }
});
for (const owner of ["originals", "chain", "anchor"]) test(`capture uncertain ${owner} close exhausts other owners and burns the next capture`, async () => {
  const f = fixture(); try {
    f.closeErrors.add(owner); await assert.rejects(f.invoke(), error => leaves(error).some(leaf => leaf.includes(`UNCERTAIN_${owner}`)));
    assert.equal(f.liveDescriptors.size, 0); assert.deepEqual(f.cleanupCalls, ["originals", "chain", "anchor"]);
    const before = f.calls.length; await assert.rejects(f.invoke(), /cleanup uncertain/); assert.equal(f.calls.length, before);
  } finally { f.finish(); }
});
test("capture retains its primary failure and every independent owner cleanup error", async () => {
  const f = fixture(); try {
    f.driftSource(); for (const owner of ["originals", "chain", "anchor"]) f.closeErrors.add(owner);
    await assert.rejects(f.invoke(), error => {
      const parts = leaves(error); assert.equal(parts.length, 4); assert.match(parts[0]!, /source.*changed|source.*drift/i);
      assert.deepEqual(parts.slice(1), ["Error: UNCERTAIN_originals", "Error: UNCERTAIN_chain", "Error: UNCERTAIN_anchor"]); return true;
    }); assert.equal(f.liveDescriptors.size, 0);
  } finally { f.finish(); }
});

for (const shape of ["reversed", "truncated"] as const) test(`capture refuses ${shape} chain role-to-record relations and exhausts owners`, async () => {
  const f = fixture(); try {
    f.crossChain(shape); await assert.rejects(f.invoke(), /member relations are crossed/);
    assert.equal(f.liveDescriptors.size, 0); assert.deepEqual(f.cleanupCalls, ["originals", "chain", "anchor"]);
  } finally { f.finish(); }
});
test("capture refuses an incomplete original retained member set", async () => {
  const f = fixture(); try {
    f.truncateOriginals(); await assert.rejects(f.invoke(), /member relations are crossed/); assert.equal(f.liveDescriptors.size, 0);
  } finally { f.finish(); }
});
test("capture represents absent historical inventory explicitly without fabricating historical authority", async () => {
  const f = fixture(); try {
    f.omitHistory(); const result = await f.invoke(); assert.equal(result.historicalPrerequisiteInventory, null); assert.equal(f.liveDescriptors.size, 0);
  } finally { f.finish(); }
});
test("capture independently bounds aggregate held bytes from a synthetic oversized lower-reader port", async () => {
  const f = fixture(); try {
    f.oversizeRawMember(); await assert.rejects(f.invoke(), /member bytes exceed bound/); assert.equal(f.liveDescriptors.size, 0);
  } finally { f.finish(); }
});
test("capture independently bounds diagnostic serialization from a synthetic oversized history port", async () => {
  const f = fixture(); try {
    f.oversizeDiagnosticHistory(); await assert.rejects(f.invoke(), /serialization exceeds bound/); assert.equal(f.liveDescriptors.size, 0);
  } finally { f.finish(); }
});
test("capture burns pending semantic-await admission and closes the returned local chain before originals", async () => {
  const f = fixture(); try {
    f.pause(); const pending = f.invoke(); await new Promise<void>(resolve => setImmediate(resolve));
    f.burn(); f.resume(); await assert.rejects(pending, /cleanup uncertain/);
    assert.ok(!f.calls.includes("originals")); assert.equal(f.liveDescriptors.size, 0); assert.deepEqual(f.cleanupCalls, ["chain", "anchor"]);
  } finally { f.finish(); }
});
