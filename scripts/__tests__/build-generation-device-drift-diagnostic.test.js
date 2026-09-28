import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyBuildGenerationDeviceDriftV1 } from "../build-generation-device-drift-diagnostic.mjs";

const recorded = Object.freeze({
  schema: "setfarm.platform-build-generation-inventory.v1",
  rootPhysicalIdentity: Object.freeze({
    devDecimal: "16777230", inoDecimal: "17", mode: 493, linkCount: 2,
  }),
  entryCount: 1,
  regularFileByteCount: 3,
  entries: Object.freeze([Object.freeze({
    locator: "a.txt", kind: "regular_file", devDecimal: "16777230",
    inoDecimal: "19", mode: 420, linkCount: 1, byteLength: 3,
    sha256: "4444444444444444444444444444444444444444444444444444444444444444",
  })]),
  physicalInventoryHash: "1111111111111111111111111111111111111111111111111111111111111111",
  contentInventoryHash: "3333333333333333333333333333333333333333333333333333333333333333",
});

const observed = Object.freeze({
  ...recorded,
  rootPhysicalIdentity: Object.freeze({ ...recorded.rootPhysicalIdentity, devDecimal: "16777231" }),
  entries: Object.freeze([Object.freeze({ ...recorded.entries[0], devDecimal: "16777231" })]),
  physicalInventoryHash: "2222222222222222222222222222222222222222222222222222222222222222",
});

test("classifies uniform device-only drift without granting authority", () => {
  assert.deepEqual(classifyBuildGenerationDeviceDriftV1(recorded, observed), {
    schema: "setfarm.build-generation-device-drift-diagnostic.v1",
    classification: "uniform-device-only-drift",
    authority: false,
    recordedDevice: "16777230",
    observedDevice: "16777231",
    entryCount: 1,
    regularFileByteCount: 3,
  });
});

const changed = (change) => {
  const copy = structuredClone(observed);
  change(copy);
  return copy;
};

for (const [label, change] of [
  ["root inode", (v) => { v.rootPhysicalIdentity.inoDecimal = "18"; }],
  ["root mode", (v) => { v.rootPhysicalIdentity.mode = 0o700; }],
  ["root link count", (v) => { v.rootPhysicalIdentity.linkCount = 3; }],
  ["entry inode", (v) => { v.entries[0].inoDecimal = "20"; }],
  ["entry mode", (v) => { v.entries[0].mode = 0o600; }],
  ["entry link count", (v) => { v.entries[0].linkCount = 2; }],
  ["entry kind", (v) => { v.entries[0].kind = "directory"; }],
  ["entry locator", (v) => { v.entries[0].locator = "b.txt"; }],
  ["entry count", (v) => { v.entryCount = 2; }],
  ["file byte length", (v) => { v.entries[0].byteLength = 4; v.regularFileByteCount = 4; }],
  ["file digest", (v) => { v.entries[0].sha256 = "5".repeat(64); }],
  ["content inventory hash", (v) => { v.contentInventoryHash = "5".repeat(64); }],
  ["mixed entry device", (v) => { v.entries[0].devDecimal = recorded.rootPhysicalIdentity.devDecimal; }],
  ["mixed root device", (v) => { v.rootPhysicalIdentity.devDecimal = recorded.rootPhysicalIdentity.devDecimal; }],
  ["unchanged device", (v) => { v.rootPhysicalIdentity.devDecimal = recorded.rootPhysicalIdentity.devDecimal; v.entries[0].devDecimal = recorded.rootPhysicalIdentity.devDecimal; }],
  ["malformed device decimal", (v) => { v.rootPhysicalIdentity.devDecimal = "016777231"; }],
  ["numeric device", (v) => { v.rootPhysicalIdentity.devDecimal = 16777231; v.entries[0].devDecimal = 16777231; }],
  ["uncanonical locator", (v) => { v.entries[0].locator = "../a.txt"; }],
  ["nul locator", (v) => { v.entries[0].locator = "a\0.txt"; }],
  ["extra entry property", (v) => { v.entries[0].unknown = true; }],
  ["extra inventory property", (v) => { v.unknown = true; }],
  ["hidden inventory property", (v) => { Object.defineProperty(v, "hidden", { value: true }); }],
  ["symbol inventory property", (v) => { v[Symbol("hidden")] = true; }],
  ["custom inventory prototype", (v) => { Object.setPrototypeOf(v, { inherited: true }); }],
  ["unchanged physical hash", (v) => { v.physicalInventoryHash = recorded.physicalInventoryHash; }],
]) {
  test(`refuses ${label}`, () => {
    assert.throws(() => classifyBuildGenerationDeviceDriftV1(recorded, changed(change)),
      { message: "BUILD_DEVICE_DRIFT_DIAGNOSTIC_REFUSED" });
  });
}

test("refuses malformed recorded inventory", () => {
  const malformed = structuredClone(recorded);
  malformed.entries[0].devDecimal = "16777231";
  assert.throws(() => classifyBuildGenerationDeviceDriftV1(malformed, observed),
    { message: "BUILD_DEVICE_DRIFT_DIAGNOSTIC_REFUSED" });
});

test("classifies sorted multi-entry inventories and refuses reordered entries", () => {
  const oldCopy = structuredClone(recorded);
  const newCopy = structuredClone(observed);
  oldCopy.entries.push({
    locator: "dir", kind: "directory", devDecimal: "16777230",
    inoDecimal: "21", mode: 493, linkCount: 2, byteLength: null, sha256: null,
  });
  newCopy.entries.push({ ...oldCopy.entries[1], devDecimal: "16777231" });
  oldCopy.entryCount = 2;
  newCopy.entryCount = 2;
  assert.equal(classifyBuildGenerationDeviceDriftV1(oldCopy, newCopy).entryCount, 2);
  newCopy.entries.reverse();
  assert.throws(() => classifyBuildGenerationDeviceDriftV1(oldCopy, newCopy),
    { message: "BUILD_DEVICE_DRIFT_DIAGNOSTIC_REFUSED" });
});
