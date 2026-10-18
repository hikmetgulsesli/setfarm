import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, openSync, readSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
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
  if (!/^(?:planned|owner-created|runtime-created|database-created|runtime-credentials|schema-prepared|schema-committed|failure-[a-f0-9-]{36})\.json$/.test(name)) refuse();
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
      runtimeUrl: url.href, committed: committed !== null, assertUnchanged });
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
