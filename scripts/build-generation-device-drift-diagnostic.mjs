import { hashCanonicalJsonV1 } from "./build-generation-retention.mjs";

const SCHEMA = "setfarm.build-generation-device-drift-diagnostic.v1";
const INVENTORY_SCHEMA = "setfarm.platform-build-generation-inventory.v1";
const DECIMAL = /^(?:0|[1-9][0-9]*)$/;
const SHA256 = /^[0-9a-f]{64}$/;
const INVENTORY_KEYS = ["schema", "rootPhysicalIdentity", "entryCount", "regularFileByteCount", "entries", "physicalInventoryHash", "contentInventoryHash"];
const IDENTITY_KEYS = ["devDecimal", "inoDecimal", "mode", "linkCount"];
const ENTRY_KEYS = ["locator", "kind", "devDecimal", "inoDecimal", "mode", "linkCount", "byteLength", "sha256"];

function refuse() {
  throw new Error("BUILD_DEVICE_DRIFT_DIAGNOSTIC_REFUSED");
}

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key)
      && Object.getOwnPropertyDescriptor(value, key)?.enumerable === true
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"));
}

function nonnegativeSafe(value, maximum) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function validIdentity(value) {
  return exactKeys(value, IDENTITY_KEYS)
    && typeof value.devDecimal === "string" && DECIMAL.test(value.devDecimal)
    && typeof value.inoDecimal === "string" && DECIMAL.test(value.inoDecimal)
    && nonnegativeSafe(value.mode, 0o7777)
    && Number.isSafeInteger(value.linkCount) && value.linkCount >= 1;
}

function validLocator(value) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/")
    && !value.includes("\\") && !value.includes("\0") && value === value.normalize("NFC")
    && value.split("/").length <= 64
    && value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function canonicalEntries(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.at(-1) !== "length") return false;
  return keys.slice(0, -1).every((key, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return key === String(index) && descriptor?.enumerable === true
      && Object.hasOwn(descriptor, "value");
  });
}

function validInventory(value) {
  if (!exactKeys(value, INVENTORY_KEYS) || value.schema !== INVENTORY_SCHEMA
    || !validIdentity(value.rootPhysicalIdentity)
    || !nonnegativeSafe(value.entryCount, 10_000)
    || !nonnegativeSafe(value.regularFileByteCount, 536_870_912)
    || !canonicalEntries(value.entries) || value.entries.length !== value.entryCount
    || !SHA256.test(value.physicalInventoryHash) || !SHA256.test(value.contentInventoryHash)) return false;

  let bytes = 0;
  let prior = null;
  for (const entry of value.entries) {
    if (!exactKeys(entry, ENTRY_KEYS) || !validLocator(entry.locator)
      || (prior !== null && Buffer.compare(Buffer.from(prior), Buffer.from(entry.locator)) >= 0)
      || !validIdentity({ devDecimal: entry.devDecimal, inoDecimal: entry.inoDecimal, mode: entry.mode, linkCount: entry.linkCount })
      || entry.devDecimal !== value.rootPhysicalIdentity.devDecimal) return false;
    prior = entry.locator;
    if (entry.kind === "regular_file") {
      if (entry.linkCount !== 1 || !nonnegativeSafe(entry.byteLength, 33_554_432) || !SHA256.test(entry.sha256)) return false;
      bytes += entry.byteLength;
      if (bytes > 536_870_912) return false;
    } else if (entry.kind !== "directory" || entry.byteLength !== null || entry.sha256 !== null) return false;
  }
  if (bytes !== value.regularFileByteCount) return false;
  const common = { schema: value.schema, entryCount: value.entryCount, regularFileByteCount: value.regularFileByteCount };
  const physicalEntries = value.entries.map(({ sha256: ignored, ...entry }) => entry);
  const contentEntries = value.entries.map(({ locator, kind, mode, byteLength, sha256 }) => ({ locator, kind, mode, byteLength, sha256 }));
  return value.physicalInventoryHash === hashCanonicalJsonV1({ ...common, rootPhysicalIdentity: value.rootPhysicalIdentity, entries: physicalEntries })
    && value.contentInventoryHash === hashCanonicalJsonV1({ ...common, entries: contentEntries });
}

function sameExceptDevice(recorded, observed) {
  const oldRoot = recorded.rootPhysicalIdentity;
  const newRoot = observed.rootPhysicalIdentity;
  if (oldRoot.devDecimal === newRoot.devDecimal
    || oldRoot.inoDecimal !== newRoot.inoDecimal
    || oldRoot.mode !== newRoot.mode
    || oldRoot.linkCount !== newRoot.linkCount
    || recorded.entryCount !== observed.entryCount
    || recorded.regularFileByteCount !== observed.regularFileByteCount
    || recorded.contentInventoryHash !== observed.contentInventoryHash
    || recorded.physicalInventoryHash === observed.physicalInventoryHash) return false;
  return recorded.entries.every((oldEntry, index) => {
    const newEntry = observed.entries[index];
    return oldEntry.locator === newEntry.locator
      && oldEntry.kind === newEntry.kind
      && oldEntry.inoDecimal === newEntry.inoDecimal
      && oldEntry.mode === newEntry.mode
      && oldEntry.linkCount === newEntry.linkCount
      && oldEntry.byteLength === newEntry.byteLength
      && oldEntry.sha256 === newEntry.sha256;
  });
}

// Advisory only: the caller must independently authenticate the recorded ledger
// and obtain stable, no-follow observations. This grants no rebind authority.
export function classifyBuildGenerationDeviceDriftV1(recorded, observed) {
  try {
    if (!validInventory(recorded) || !validInventory(observed) || !sameExceptDevice(recorded, observed)) refuse();
    return Object.freeze({
      schema: SCHEMA,
      classification: "uniform-device-only-drift",
      authority: false,
      recordedDevice: recorded.rootPhysicalIdentity.devDecimal,
      observedDevice: observed.rootPhysicalIdentity.devDecimal,
      entryCount: recorded.entryCount,
      regularFileByteCount: recorded.regularFileByteCount,
    });
  } catch {
    refuse();
  }
}
