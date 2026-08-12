import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  beginPlatformReleaseBootstrapDarwinSlotLedgerV2,
  disposePlatformReleaseBootstrapDarwinSlotLedgerV2,
  finalizePlatformReleaseBootstrapDarwinSlotLedgerV2,
  issuePlatformReleaseBootstrapDarwinSlotLedgerCatalogV2,
  recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2,
  selectPlatformReleaseBootstrapDarwinSlotLedgerSlotV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-slot-ledger-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

function sha256V2(value: Uint8Array | string): Buffer {
  return createHash("sha256").update(value).digest();
}

function frameV2(
  slot: Buffer,
  ordinal: number,
  bytes: Buffer,
): Buffer {
  const payload = Buffer.alloc(61 + bytes.byteLength);
  slot.copy(payload, 0);
  payload[32] = ordinal;
  payload.writeUInt32BE(0, 33);
  payload.writeUInt32BE(1, 37);
  payload.writeBigUInt64BE(0n, 41);
  payload.writeBigUInt64BE(BigInt(bytes.byteLength), 49);
  payload.writeUInt32BE(bytes.byteLength, 57);
  bytes.copy(payload, 61);
  return payload;
}

function nativeSlotV2(
  challengeHex: string,
  entryIndex: number,
  device: string,
  inode: string,
): Buffer {
  const index = Buffer.alloc(4);
  index.writeUInt32BE(entryIndex, 0);
  const deviceBytes = Buffer.alloc(8);
  deviceBytes.writeBigUInt64BE(BigInt(device), 0);
  const inodeBytes = Buffer.alloc(8);
  inodeBytes.writeBigUInt64BE(BigInt(inode), 0);
  return sha256V2(Buffer.concat([
    Buffer.from("setfarm.darwin.descriptor-backed-member-slot.v2", "utf8"),
    Buffer.from(challengeHex, "hex"),
    index,
    Buffer.from([1]),
    deviceBytes,
    inodeBytes,
  ]));
}

function makeInputV2(bytes: Buffer, seed: string) {
  const filesystemScope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: sha256V2(`${seed}-scope`).toString("hex"),
  });
  const sourceObjectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "ordinary_file",
    device: "7",
    inode: "11",
  });
  const sourceFingerprint = buildFsObservationFingerprintV2({
    objectIdentity: sourceObjectIdentity,
    ownerUid: 501,
    ownerGid: 20,
    mode: "0444",
    linkCount: 1,
    byteLength: bytes.byteLength,
    modifiedTimeNanoseconds: "100",
    changedTimeNanoseconds: "101",
  });
  const expectedCatalog = [1, 2, 3, 7].map((inode) => {
    const objectIdentity = inode === 7
      ? sourceObjectIdentity
      : buildStableFsObjectIdentityV2({
          filesystemScope,
          objectKind: "ordinary_file",
          device: "7",
          inode: String(inode),
        });
    return { objectKind: "ordinary_file" as const, objectIdentity };
  });
  const challengeHex = sha256V2(`${seed}-challenge`).toString("hex");
  const aggregateCensusHash = sha256V2(`${seed}-aggregate`).toString("hex");
  const sessionOccurrenceHash = hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-node-native-controller-session-occurrence-hash.v2",
    challenge: challengeHex,
    aggregateEvidenceStreamHash: aggregateCensusHash,
  });
  return {
    sessionOccurrenceHash,
    aggregateCensusHash,
    challengeHex,
    sessionSlot: `slot_${sha256V2(`session:${sessionOccurrenceHash}`).toString("hex")}`,
    beginRequestHash: sha256V2(`${seed}-begin`).toString("hex"),
    captureSlot: `slot_${sha256V2(`capture:${sessionOccurrenceHash}:3`).toString("hex")}`,
    expectedEntryIndex: 3,
    expectedCatalog,
    sourceObjectIdentity,
    sourceFingerprint,
    sourceContentHash: sha256V2(bytes).toString("hex"),
  } as const;
}

function catalogV2(input: ReturnType<typeof makeInputV2>): Buffer {
  const catalog = Buffer.alloc(4 + input.expectedCatalog.length * 37);
  catalog.writeUInt32BE(input.expectedCatalog.length, 0);
  for (let index = 0; index < input.expectedCatalog.length; index += 1) {
    const entry = input.expectedCatalog[index]!;
    const offset = 4 + index * 37;
    nativeSlotV2(
      input.challengeHex,
      index,
      entry.objectIdentity.device,
      entry.objectIdentity.inode,
    ).copy(catalog, offset);
    catalog.writeUInt32BE(index, offset + 32);
    catalog[offset + 36] = entry.objectKind === "ordinary_file" ? 1 : 2;
  }
  return catalog;
}

describe("private Darwin descriptor-backed slot ledger v2", () => {
  it("joins one issued slot to two equal content observations and never claims authority", () => {
    const bytes = Buffer.from("slot-ledger-content-v2\n", "utf8");
    const input = makeInputV2(bytes, "slot-ledger-positive");
    const handle = beginPlatformReleaseBootstrapDarwinSlotLedgerV2(input);
    const slot = nativeSlotV2(input.challengeHex, input.expectedEntryIndex, "7", "11");
    const catalog = catalogV2(input);
    const records = issuePlatformReleaseBootstrapDarwinSlotLedgerCatalogV2(
      handle,
      catalog,
    );
    assert.equal(records.length, input.expectedCatalog.length);
    assert.deepEqual(
      selectPlatformReleaseBootstrapDarwinSlotLedgerSlotV2(handle, slot),
      { slot: `slot_${slot.toString("hex")}`, entryIndex: 3 },
    );
    recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2(
      handle,
      frameV2(slot, 0, bytes),
    );
    recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2(
      handle,
      frameV2(slot, 1, bytes),
    );
    const receipt = finalizePlatformReleaseBootstrapDarwinSlotLedgerV2(handle);
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(receipt.productionAuthority, false);
    assert.equal(
      receipt.authority,
      "test_fixture_node_ledger_joining_native_descriptor_capture_frames_v2",
    );
    assert.equal(receipt.signingAuthority, "adhoc_or_unsigned_test_fixture");
    assert.equal(receipt.amfiAdmission, "unproven_test_fixture");
    assert.equal(receipt.notarizationAdmission, "unproven_test_fixture");
    assert.equal(receipt.settlementStatus, "pre_accept_content_join_only");
    assert.equal(receipt.sourceEntryIndex, 3);
    assert.equal(receipt.sourceContentHash, sha256V2(bytes).toString("hex"));
    disposePlatformReleaseBootstrapDarwinSlotLedgerV2(handle);
    assert.throws(() => beginPlatformReleaseBootstrapDarwinSlotLedgerV2(input));
  });

  it("rejects unissued, replayed, incomplete, and disagreeing observations", () => {
    const firstBytes = Buffer.from("first\n", "utf8");
    const secondBytes = Buffer.from("other\n", "utf8");
    const input = makeInputV2(firstBytes, "slot-ledger-negative");
    const handle = beginPlatformReleaseBootstrapDarwinSlotLedgerV2(input);
    const slot = nativeSlotV2(input.challengeHex, input.expectedEntryIndex, "7", "11");
    const catalog = catalogV2(input);
    issuePlatformReleaseBootstrapDarwinSlotLedgerCatalogV2(handle, catalog);
    assert.throws(() =>
      selectPlatformReleaseBootstrapDarwinSlotLedgerSlotV2(
        handle,
        sha256V2("foreign-slot-v2"),
      )
    );
    selectPlatformReleaseBootstrapDarwinSlotLedgerSlotV2(handle, slot);
    recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2(
      handle,
      frameV2(slot, 0, firstBytes),
    );
    assert.throws(() =>
      recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2(
        handle,
        frameV2(slot, 0, firstBytes),
      )
    );
    recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2(
      handle,
      frameV2(slot, 1, secondBytes),
    );
    assert.throws(() => finalizePlatformReleaseBootstrapDarwinSlotLedgerV2(handle));
    disposePlatformReleaseBootstrapDarwinSlotLedgerV2(handle);
  });

  it("rejects a catalog that swaps a valid foreign slot under the target index", () => {
    const bytes = Buffer.from("catalog-identity\n", "utf8");
    const input = makeInputV2(bytes, "slot-ledger-catalog-negative");
    const handle = beginPlatformReleaseBootstrapDarwinSlotLedgerV2(input);
    const catalog = catalogV2(input);
    const targetOffset = 4 + input.expectedEntryIndex * 37;
    const foreignOffset = 4;
    const targetSlot = Buffer.from(catalog.subarray(targetOffset, targetOffset + 32));
    catalog.copy(catalog, targetOffset, foreignOffset, foreignOffset + 32);
    targetSlot.copy(catalog, foreignOffset);
    targetSlot.fill(0);
    assert.throws(() =>
      issuePlatformReleaseBootstrapDarwinSlotLedgerCatalogV2(handle, catalog)
    );
    disposePlatformReleaseBootstrapDarwinSlotLedgerV2(handle);
  });
});
