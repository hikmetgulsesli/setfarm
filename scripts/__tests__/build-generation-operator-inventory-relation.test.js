import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hashCanonicalJsonV1,
  inspectOperatorArchiveInventoryRelationV1,
} from "../build-generation-retention.mjs";

function inventory(device, changes = {}) {
  const rootPhysicalIdentity = {
    devDecimal: device, inoDecimal: "17", mode: 0o755, linkCount: 2,
    ...changes.root,
  };
  const entries = [{
    locator: "artifact.txt", kind: "regular_file", devDecimal: device,
    inoDecimal: "19", mode: 0o644, linkCount: 1, byteLength: 3,
    sha256: "4".repeat(64), ...changes.entry,
  }];
  const common = {
    schema: "setfarm.platform-build-generation-inventory.v1",
    entryCount: entries.length,
    regularFileByteCount: entries[0].byteLength,
  };
  const contentEntries = entries.map(({ locator, kind, mode, byteLength, sha256 }) => ({ locator, kind, mode, byteLength, sha256 }));
  const physicalEntries = entries.map(({ sha256: ignored, ...entry }) => entry);
  return {
    ...common, rootPhysicalIdentity, entries,
    physicalInventoryHash: hashCanonicalJsonV1({ ...common, rootPhysicalIdentity, entries: physicalEntries }),
    contentInventoryHash: hashCanonicalJsonV1({ ...common, entries: contentEntries }),
  };
}

test("operator inventory relation keeps historical and observed devices distinct", () => {
  assert.deepEqual(inspectOperatorArchiveInventoryRelationV1(inventory("16777230"), inventory("16777231")), {
    schema: "setfarm.platform-build-generation-operator-inventory-relation.v1",
    kind: "uniform-device-only-drift",
    recordedDevice: "16777230",
    observedDevice: "16777231",
    entryCount: 1,
    regularFileByteCount: 3,
    contentInventoryHash: inventory("16777230").contentInventoryHash,
  });
});

test("operator inventory relation supports same-device post-build archive without pretending drift", () => {
  assert.equal(inspectOperatorArchiveInventoryRelationV1(inventory("16777231"), inventory("16777231")).kind, "same-device");
});

for (const [name, changed] of [
  ["inode", { entry: { inoDecimal: "20" } }],
  ["mode", { entry: { mode: 0o600 } }],
  ["content", { entry: { sha256: "5".repeat(64) } }],
  ["link count", { root: { linkCount: 3 } }],
  ["mixed device", { entry: { devDecimal: "16777230" } }],
]) {
  test(`operator inventory relation refuses ${name}`, () => {
    assert.throws(() => inspectOperatorArchiveInventoryRelationV1(inventory("16777230"), inventory("16777231", changed)),
      /BUILD_GENERATION_OPERATOR_INVENTORY_REFUSED/);
  });
}

test("operator inventory relation refuses a forged physical hash", () => {
  const observed = inventory("16777231");
  observed.physicalInventoryHash = "f".repeat(64);
  assert.throws(() => inspectOperatorArchiveInventoryRelationV1(inventory("16777230"), observed),
    /BUILD_GENERATION_OPERATOR_INVENTORY_REFUSED/);
});
