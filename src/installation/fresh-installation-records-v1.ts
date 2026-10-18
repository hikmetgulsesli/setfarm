import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, openSync, readSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { types } from "node:util";
import {
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  validateInternalProductionOwnerProducerManifestSetActivationCurrentV1,
  type FreshInstallationOwnerProducerSourceBuildAuthorityAV1,
  type InternalProductionOwnerProducerManifestSetActivationCurrentV1,
} from "../internal-production/owner-admission-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { parseFreshInstallationOriginV1, type FreshInstallationOriginV1 } from "./fresh-installation-origin-v1.js";

export type FreshInstallationRecordPinV1 = Readonly<{ bytes: number; sha256: string }>;
const HASH = /^[a-f0-9]{64}$/;
const NAMES = ["planned.json", "owner-created.json", "runtime-created.json", "database-created.json", "runtime-credentials.json"] as const;
const hash = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
function refuse(): never { throw new Error("FRESH_INSTALLATION_RECORDS_REFUSED"); }
function exact(v: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype
    || JSON.stringify(Object.keys(v).sort()) !== JSON.stringify([...keys].sort())) refuse();
  return v as Record<string, unknown>;
}
export function freshInstallationDirectoryIdentityV1(directory: string) {
  const s = lstatSync(directory, { bigint: true });
  if (!s.isDirectory() || s.uid !== BigInt(process.getuid!()) || (s.mode & 0o7777n) !== 0o700n) refuse();
  return Object.freeze({ realpath: realpathSync(directory), dev: String(s.dev), ino: String(s.ino), uid: Number(s.uid), gid: Number(s.gid), mode: 0o700 });
}
function syncDirectory(directory: string): void {
  const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function publishFreshInstallationPrivateRecordV1(directory: string, name: string, value: unknown): FreshInstallationRecordPinV1 {
  if (!/^(?:planned|owner-created|runtime-created|database-created|runtime-credentials|schema-prepared|schema-committed|activation-prepared|activated|failure-[a-f0-9-]{36})\.json$/.test(name)) refuse();
  const before = freshInstallationDirectoryIdentityV1(directory);
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  if (bytes.length > (name === "runtime-credentials.json" ? 4096 : 32768)) refuse();
  const fd = openSync(path.join(directory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  syncDirectory(directory);
  if (hashCanonicalJson(before) !== hashCanonicalJson(freshInstallationDirectoryIdentityV1(directory))) refuse();
  return Object.freeze({ bytes: bytes.length, sha256: hash(bytes) });
}
type Snapshot = Readonly<{ value: unknown; pin: FreshInstallationRecordPinV1; identity: string }>;
function snapshot(directory: string, name: string, budget: { bytes: number }, optional = false): Snapshot | null {
  let fd: number;
  try { fd = openSync(path.join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (e) { if (optional && (e as { code?: string }).code === "ENOENT") return null; throw e; }
  try {
    const before = fstatSync(fd, { bigint: true });
    const max = name === "runtime-credentials.json" ? 4096 : 32768;
    if (!before.isFile() || before.nlink !== 1n || before.uid !== BigInt(process.getuid!())
      || (before.mode & 0o7777n) !== 0o600n || before.size > BigInt(max)) refuse();
    const length = Number(before.size); budget.bytes += length;
    if (budget.bytes > 256 * 1024) refuse();
    const bytes = Buffer.alloc(length); let amount = 0;
    while (amount < length) {
      const n = readSync(fd, bytes, amount, length - amount, null);
      if (!n) refuse(); amount += n;
    }
    const after = fstatSync(fd, { bigint: true }), named = lstatSync(path.join(directory, name), { bigint: true });
    const keys = ["dev", "ino", "mode", "nlink", "uid", "gid", "size", "mtimeNs", "ctimeNs"] as const;
    for (const k of keys) if (before[k] !== after[k] || before[k] !== named[k]) refuse();
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!bytes.equals(Buffer.from(`${JSON.stringify(value)}\n`))) refuse();
    return Object.freeze({ value, pin: Object.freeze({ bytes: length, sha256: hash(bytes) }), identity: keys.map(k => String(before[k])).join(":") });
  } finally { closeSync(fd); }
}
const oid = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 4294967295;
function committedMatches(v: unknown, origin: FreshInstallationOriginV1, catalogHash: string): void {
  const r = exact(v, ["schema", "origin", "catalogHash"]);
  if (r.schema !== "setfarm.fresh-installation-schema-committed.v1" || r.catalogHash !== catalogHash
    || hashCanonicalJson(parseFreshInstallationOriginV1(r.origin)) !== hashCanonicalJson(origin)) refuse();
}

/** Internal credential-bearing state; never log it or return it as a verification receipt. */
export function readFreshInstallationPreparedStateV1(directory: string, requireCommitted: boolean) {
  try {
    const identity = freshInstallationDirectoryIdentityV1(directory), budget = { bytes: 0 };
    const original = new Map<string, Snapshot>();
    const read = (name: string, optional = false): Snapshot | null => {
      const s = snapshot(directory, name, budget, optional); if (s) original.set(name, s); return s;
    };
    const p = exact(read("schema-prepared.json")!.value, ["schema", "origin", "catalogHash", "directoryIdentity", "recordPins"]);
    const origin = parseFreshInstallationOriginV1(p.origin);
    if (p.schema !== "setfarm.fresh-installation-schema-prepared.v1" || typeof p.catalogHash !== "string" || !HASH.test(p.catalogHash)
      || path.basename(identity.realpath) !== origin.installationId || hashCanonicalJson(p.directoryIdentity) !== hashCanonicalJson(identity)) refuse();
    const pins = exact(p.recordPins, NAMES), records = new Map<string, unknown>();
    for (const name of NAMES) {
      const s = read(name)!; const pin = exact(pins[name], ["bytes", "sha256"]);
      if (pin.bytes !== s.pin.bytes || pin.sha256 !== s.pin.sha256) refuse(); records.set(name, s.value);
    }
    const planned = exact(records.get("planned.json"), ["schema", "installationId", "operationId", "databaseName", "ownerRole", "runtimeRole", "sourceSha"]);
    if (planned.schema !== "setfarm.fresh-installation-plan.v1") refuse();
    for (const k of ["installationId", "operationId", "databaseName", "ownerRole", "runtimeRole", "sourceSha"] as const) if (planned[k] !== origin[k]) refuse();
    const created = exact(records.get("database-created.json"), ["origin", "ownerOid", "runtimeOid"]);
    const owner = exact(records.get("owner-created.json"), ["ownerRole", "ownerOid"]);
    const runtime = exact(records.get("runtime-created.json"), ["runtimeRole", "runtimeOid"]);
    if (hashCanonicalJson(parseFreshInstallationOriginV1(created.origin)) !== hashCanonicalJson(origin)
      || !oid(created.ownerOid) || !oid(created.runtimeOid) || created.ownerOid === created.runtimeOid
      || owner.ownerRole !== origin.ownerRole || owner.ownerOid !== created.ownerOid
      || runtime.runtimeRole !== origin.runtimeRole || runtime.runtimeOid !== created.runtimeOid) refuse();
    const credential = exact(records.get("runtime-credentials.json"), ["runtimeUrl"]);
    if (typeof credential.runtimeUrl !== "string") refuse();
    const url = new URL(credential.runtimeUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || url.username !== origin.runtimeRole || url.pathname !== `/${origin.databaseName}` || !/^[a-f0-9]{64}$/.test(url.password)
      || (url.port !== "" && Number(url.port) < 1) || url.search || url.hash) refuse();
    const committed = read("schema-committed.json", !requireCommitted);
    if (committed) committedMatches(committed.value, origin, p.catalogHash);
    const assertUnchanged = (): void => {
      if (hashCanonicalJson(identity) !== hashCanonicalJson(freshInstallationDirectoryIdentityV1(directory))) refuse();
      const nextBudget = { bytes: 0 };
      for (const [name, before] of original) {
        const after = snapshot(directory, name, nextBudget)!;
        if (after.identity !== before.identity || after.pin.sha256 !== before.pin.sha256) refuse();
      }
    };
    return Object.freeze({ origin, catalogHash: p.catalogHash, ownerOid: created.ownerOid, runtimeOid: created.runtimeOid,
      runtimeUrl: url.href, committed: committed !== null, baseRecordBytes: budget.bytes,
      baseRecordPins: Object.freeze(Object.fromEntries([...original].map(([name, value]) => [name, value.pin]))), assertUnchanged });
  } catch { return refuse(); }
}

/** Only publishes acknowledgment; callers must first verify the actual prepared database. */
export function acknowledgeFreshInstallationCommitV1(directory: string, origin: FreshInstallationOriginV1, catalogHash: string): void {
  const value = { schema: "setfarm.fresh-installation-schema-committed.v1", origin, catalogHash };
  try { publishFreshInstallationPrivateRecordV1(directory, "schema-committed.json", value); }
  catch (e) {
    if ((e as { code?: string }).code !== "EEXIST") throw e;
    committedMatches(snapshot(directory, "schema-committed.json", { bytes: 0 })!.value, origin, catalogHash);
    syncDirectory(directory);
  }
}


// Activation record DATA only. Parsed bytes never qualify a release, authorize a
// connection, enroll an owner transaction, grant privileges, or certify a COMMIT.
export type FreshInstallationActivationReadModeV1 = "optional" | "required" | "reconcile";
type FreshInstallationSchemaRecordPinsV1 = Readonly<{
  "schema-prepared.json": FreshInstallationRecordPinV1;
  "schema-committed.json": FreshInstallationRecordPinV1;
}>;
export type FreshInstallationActivationPreparedRecordV1 = Readonly<{
  schema: "setfarm.fresh-installation-activation-prepared.v1";
  directoryIdentity: ReturnType<typeof freshInstallationDirectoryIdentityV1>;
  origin: FreshInstallationOriginV1;
  schemaRecordPins: FreshInstallationSchemaRecordPinsV1;
  sourceAuthority: FreshInstallationOwnerProducerSourceBuildAuthorityAV1;
  current: InternalProductionOwnerProducerManifestSetActivationCurrentV1;
  catalogHash: string;
}>;
export type FreshInstallationActivatedRecordV1 = Readonly<{
  schema: "setfarm.fresh-installation-activated.v1";
  activationPreparedPin: FreshInstallationRecordPinV1;
  origin: FreshInstallationOriginV1;
  catalogHash: string;
}>;
export type FreshInstallationActivationStateV1 = Readonly<{
  prepared: FreshInstallationActivationPreparedRecordV1;
  preparedPin: FreshInstallationRecordPinV1;
  activatedPin: FreshInstallationRecordPinV1 | null;
  acknowledged: boolean;
  baseRecordBytes: number;
  baseRecordPins: Readonly<Record<string, FreshInstallationRecordPinV1>>;
  assertUnchanged: () => void;
}>;
const ACTIVATION_NAMES_V1 = ["activation-prepared.json", "activated.json"] as const;
const ACTIVATION_RECORD_MAX_V1 = 32768;

// Clone strict JSON data before delegating to pure owner parsers. Their legacy
// validators need not be broadened merely to consume a new filesystem record.
function activationDataV1(value: unknown): unknown {
  const budget = { nodes: 0, bytes: 0 };
  const copy = (member: unknown, depth: number): unknown => {
    if (++budget.nodes > 4096 || depth > 32) refuse();
    if (member === null || typeof member === "boolean") return member;
    if (typeof member === "string") {
      if (member.length > ACTIVATION_RECORD_MAX_V1) refuse();
      budget.bytes += Buffer.byteLength(member);
      if (budget.bytes > ACTIVATION_RECORD_MAX_V1) refuse();
      return member;
    }
    if (typeof member === "number") {
      if (!Number.isSafeInteger(member) || Object.is(member, -0)) refuse();
      return member;
    }
    if (typeof member !== "object" || types.isProxy(member)) refuse();
    if (Array.isArray(member)) {
      if (Object.getPrototypeOf(member) !== Array.prototype) refuse();
      const length = Object.getOwnPropertyDescriptor(member, "length")?.value;
      if (!Number.isSafeInteger(length) || length < 0 || length > 4096) refuse();
      const keys = Reflect.ownKeys(member);
      if (keys.length !== length + 1) refuse();
      const result: unknown[] = [];
      for (let index = 0; index < length; index++) {
        const entry = Object.getOwnPropertyDescriptor(member, String(index));
        if (!entry || !Object.hasOwn(entry, "value") || !entry.enumerable) refuse();
        result.push(copy(entry.value, depth + 1));
      }
      return Object.freeze(result);
    }
    if (Object.getPrototypeOf(member) !== Object.prototype) refuse();
    const keys = Reflect.ownKeys(member);
    if (keys.length > 32) refuse();
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== "string" || key.length > ACTIVATION_RECORD_MAX_V1) refuse();
      const entry = Object.getOwnPropertyDescriptor(member, key);
      if (!entry || !Object.hasOwn(entry, "value") || !entry.enumerable) refuse();
      budget.bytes += Buffer.byteLength(key);
      if (budget.bytes > ACTIVATION_RECORD_MAX_V1) refuse();
      // Define data properties so "__proto__" cannot mutate the clone prototype.
      Object.defineProperty(result, key, { value: copy(entry.value, depth + 1), enumerable: true });
    }
    return Object.freeze(result);
  };
  const result = copy(value, 0);
  if (Buffer.byteLength(JSON.stringify(result) + "\n") > ACTIVATION_RECORD_MAX_V1) refuse();
  return result;
}
function activationPinV1(value: unknown): FreshInstallationRecordPinV1 {
  const pin = exact(value, ["bytes", "sha256"]);
  if (typeof pin.bytes !== "number" || !Number.isSafeInteger(pin.bytes)
    || pin.bytes < 1 || pin.bytes > ACTIVATION_RECORD_MAX_V1
    || typeof pin.sha256 !== "string" || !HASH.test(pin.sha256)) refuse();
  return Object.freeze({ bytes: pin.bytes, sha256: pin.sha256 });
}
type FreshBaseStateV1 = ReturnType<typeof readFreshInstallationPreparedStateV1>;
function activationSchemaPinsV1(base: FreshBaseStateV1): FreshInstallationSchemaRecordPinsV1 {
  const prepared = base.baseRecordPins["schema-prepared.json"];
  const committed = base.baseRecordPins["schema-committed.json"];
  if (!base.committed || !prepared || !committed) refuse();
  return Object.freeze({ "schema-prepared.json": prepared, "schema-committed.json": committed });
}
function sameActivationDataV1(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}
function activationPreparedV1(value: unknown, base: FreshBaseStateV1,
  directoryIdentity: ReturnType<typeof freshInstallationDirectoryIdentityV1>): FreshInstallationActivationPreparedRecordV1 {
  const record = exact(activationDataV1(value), ["schema", "directoryIdentity", "origin", "schemaRecordPins",
    "sourceAuthority", "current", "catalogHash"]);
  if (record.schema !== "setfarm.fresh-installation-activation-prepared.v1"
    || typeof record.catalogHash !== "string" || !HASH.test(record.catalogHash)
    || !sameActivationDataV1(record.directoryIdentity, directoryIdentity)) refuse();
  const origin = parseFreshInstallationOriginV1(record.origin);
  if (!sameActivationDataV1(origin, base.origin)) refuse();
  const pins = exact(record.schemaRecordPins, ["schema-prepared.json", "schema-committed.json"]);
  const schemaRecordPins = Object.freeze({
    "schema-prepared.json": activationPinV1(pins["schema-prepared.json"]),
    "schema-committed.json": activationPinV1(pins["schema-committed.json"]),
  });
  if (!sameActivationDataV1(schemaRecordPins, activationSchemaPinsV1(base))) refuse();
  const sourceAuthority = validateInternalProductionOwnerProducerSourceBuildAuthorityV1(record.sourceAuthority);
  if (sourceAuthority.schema !== "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1"
    || !sameActivationDataV1(sourceAuthority.origin, origin)) refuse();
  const current = validateInternalProductionOwnerProducerManifestSetActivationCurrentV1(record.current);
  const receipt = current.receipt;
  if (current.currentRevision !== 1 || current.head.phase !== "A" || receipt.phase !== "A"
    || receipt.orderedPlans.length !== 1 || receipt.orderedPlans[0] !== "A"
    || receipt.orderedManifestHashes.length !== 1
    || receipt.orderedManifestHashes[0] !== INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash
    || receipt.orderedSourceBuildAuthorities.length !== 1
    || !sameActivationDataV1(receipt.orderedSourceBuildAuthorities[0], {
      plan: "A", sourceBuildAuthorityRef: sourceAuthority.sourceBuildAuthorityRef,
      sourceBuildAuthorityHash: sourceAuthority.sourceBuildAuthorityHash,
    })
    || receipt.ownerCategoryRegistryHash !== sourceAuthority.ownerCategoryRegistryHash
    || receipt.ownerCategoryCensusMapHash !== sourceAuthority.ownerCategoryCensusMapHash) refuse();
  return Object.freeze({ schema: "setfarm.fresh-installation-activation-prepared.v1",
    directoryIdentity, origin, schemaRecordPins, sourceAuthority, current, catalogHash: record.catalogHash });
}
function activationAckV1(value: unknown, prepared: FreshInstallationActivationPreparedRecordV1,
  preparedPin: FreshInstallationRecordPinV1): FreshInstallationActivatedRecordV1 {
  const ack = exact(activationDataV1(value), ["schema", "activationPreparedPin", "origin", "catalogHash"]);
  const origin = parseFreshInstallationOriginV1(ack.origin);
  const activationPreparedPin = activationPinV1(ack.activationPreparedPin);
  if (ack.schema !== "setfarm.fresh-installation-activated.v1"
    || ack.catalogHash !== prepared.catalogHash || !sameActivationDataV1(origin, prepared.origin)
    || !sameActivationDataV1(activationPreparedPin, preparedPin)) refuse();
  return Object.freeze({ schema: "setfarm.fresh-installation-activated.v1",
    activationPreparedPin, origin, catalogHash: prepared.catalogHash });
}

function captureActivationRecordsV1(directory: string, mode: FreshInstallationActivationReadModeV1) {
  if (!["optional", "required", "reconcile"].includes(mode)) refuse();
  const base = readFreshInstallationPreparedStateV1(directory, true);
  const identity = freshInstallationDirectoryIdentityV1(directory);
  const budget = { bytes: base.baseRecordBytes };
  const preparedSnapshot = snapshot(directory, ACTIVATION_NAMES_V1[0], budget, true);
  const activatedSnapshot = snapshot(directory, ACTIVATION_NAMES_V1[1], budget, true);
  let refused = false;
  const assertUnchanged = (): void => {
    try {
      if (refused) refuse();
      base.assertUnchanged();
      if (!sameActivationDataV1(identity, freshInstallationDirectoryIdentityV1(directory))) refuse();
      const nextBudget = { bytes: base.baseRecordBytes };
      for (const [index, before] of [preparedSnapshot, activatedSnapshot].entries()) {
        const after = snapshot(directory, ACTIVATION_NAMES_V1[index]!, nextBudget, before === null);
        if (before === null ? after !== null : !after
          || after.identity !== before.identity || !sameActivationDataV1(after.pin, before.pin)) refuse();
      }
    } catch { refused = true; return refuse(); }
  };
  if (!preparedSnapshot) {
    if (activatedSnapshot || mode !== "optional") refuse();
    assertUnchanged();
    return Object.freeze({ state: null, assertUnchanged });
  }
  if (!activatedSnapshot && mode !== "reconcile") refuse();
  const prepared = activationPreparedV1(preparedSnapshot.value, base, identity);
  if (activatedSnapshot) activationAckV1(activatedSnapshot.value, prepared, preparedSnapshot.pin);
  assertUnchanged();
  const state: FreshInstallationActivationStateV1 = Object.freeze({ prepared,
    preparedPin: preparedSnapshot.pin, activatedPin: activatedSnapshot?.pin ?? null,
    acknowledged: activatedSnapshot !== null, baseRecordBytes: base.baseRecordBytes,
    baseRecordPins: base.baseRecordPins, assertUnchanged });
  return Object.freeze({ state, assertUnchanged });
}

/** Optional returns null only when BOTH stage names are absent; all partial state refuses. */
export function readFreshInstallationActivationStateV1(directory: string,
  mode: FreshInstallationActivationReadModeV1 = "required"): FreshInstallationActivationStateV1 | null {
  try { return captureActivationRecordsV1(directory, mode).state; }
  catch { return refuse(); }
}

/** Capture before activation. A later visible stage can never promote this process. */
export function captureFreshInstallationActivationAbsenceV1(directory: string): () => void {
  try {
    const captured = captureActivationRecordsV1(directory, "optional");
    if (captured.state !== null) refuse();
    return captured.assertUnchanged;
  } catch { return refuse(); }
}

/** Controller-only ordering obligation: publish inside its owner transaction before COMMIT. */
export function publishFreshInstallationActivationPreparedV1(directory: string, value: unknown): FreshInstallationRecordPinV1 {
  try {
    const base = readFreshInstallationPreparedStateV1(directory, true);
    const identity = freshInstallationDirectoryIdentityV1(directory);
    const input = exact(activationDataV1(value), ["sourceAuthority", "current", "catalogHash"]);
    const prepared = activationPreparedV1({ schema: "setfarm.fresh-installation-activation-prepared.v1",
      directoryIdentity: identity, origin: base.origin, schemaRecordPins: activationSchemaPinsV1(base),
      sourceAuthority: input.sourceAuthority, current: input.current, catalogHash: input.catalogHash }, base, identity);
    const absence = captureFreshInstallationActivationAbsenceV1(directory);
    base.assertUnchanged(); absence();
    if (base.baseRecordBytes + Buffer.byteLength(JSON.stringify(prepared) + "\n") > 256 * 1024) refuse();
    const pin = publishFreshInstallationPrivateRecordV1(directory, "activation-prepared.json", prepared);
    const readback = readFreshInstallationActivationStateV1(directory, "reconcile");
    if (!readback || !sameActivationDataV1(readback.preparedPin, pin)
      || !sameActivationDataV1(readback.prepared, prepared)) refuse();
    return pin;
  } catch { return refuse(); }
}

/** Actual complete DB/release verification MUST precede this acknowledgment.
 * expected pins bind that verification to the exact prepared file; this function
 * never verifies a DB or treats a matching file as COMMIT proof.
 */
export function acknowledgeFreshInstallationActivationV1(directory: string, expectedValue: unknown): void {
  try {
    const expected = exact(activationDataV1(expectedValue), ["activationPreparedPin", "origin", "catalogHash"]);
    const state = readFreshInstallationActivationStateV1(directory, "reconcile");
    if (!state) refuse();
    const value = activationAckV1({ schema: "setfarm.fresh-installation-activated.v1",
      activationPreparedPin: expected.activationPreparedPin, origin: expected.origin,
      catalogHash: expected.catalogHash }, state.prepared, state.preparedPin);
    state.assertUnchanged();
    if (state.baseRecordBytes + state.preparedPin.bytes + Buffer.byteLength(JSON.stringify(value) + "\n") > 256 * 1024) refuse();
    try { publishFreshInstallationPrivateRecordV1(directory, "activated.json", value); }
    catch (error) {
      if ((error as { code?: string }).code !== "EEXIST") throw error;
      const existing = readFreshInstallationActivationStateV1(directory, "required");
      if (!existing || !sameActivationDataV1(existing.preparedPin, state.preparedPin)) refuse();
      syncDirectory(directory);
    }
    const readback = readFreshInstallationActivationStateV1(directory, "required");
    if (!readback || !sameActivationDataV1(readback.preparedPin, state.preparedPin)
      || !sameActivationDataV1(readback.prepared, state.prepared)) refuse();
    readback.assertUnchanged();
  } catch { return refuse(); }
}
