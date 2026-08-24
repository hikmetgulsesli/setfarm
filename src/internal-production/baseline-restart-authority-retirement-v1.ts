import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1 = Readonly<{
  schema: "setfarm.internal-production-physical-service-restart-authority-transition-lease.v1";
}>;

export type InternalProductionPreSchemaSpawnerRebindHelperSettlementPairV1 = Readonly<{
  helperSettlementRef: string;
  helperSettlementHash: string;
}>;

type LeaseStateV1 = {
  descriptor: number;
  lockBytes: Buffer;
  phase: "held" | "released";
  authorityOwner: "baseline-a";
};

const leases = new WeakMap<object, LeaseStateV1>();
const SHA256 = /^[a-f0-9]{64}$/;
const PAIR_REF = /^setfarm:\/\/internal-production\/[a-z0-9-]+\/sha256\/[a-f0-9]{64}$/;
const HELPER_PREFIX = "setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/";

function fail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_RESTART_AUTHORITY_TRANSITION_INVALID:${message}`);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function repositoryRoot(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const source = path.dirname(current);
  if (!new Set(["src", "dist"]).has(path.basename(source))) fail("module root is invalid");
  return path.dirname(source);
}

function rootPaths() {
  const root = path.join(repositoryRoot(), "data/internal-production-baseline/restart-authority-retirement-v1");
  return Object.freeze({
    root,
    lock: path.join(root, "physical-service-restart-authority.transition.lock"),
    epoch: path.join(root, "epoch-head.json"),
    journal: path.join(root, "pre-schema-helper-journal.json"),
    settlements: path.join(root, "pre-schema-helper-settlements", "sha256"),
  });
}

function exactOwnRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || JSON.stringify(Object.keys(value)) !== JSON.stringify(keys)) fail(`${label} shape is invalid`);
  return value as Record<string, unknown>;
}

function exactCanonicalRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  const ordered = [...keys].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || JSON.stringify(Object.keys(value)) !== JSON.stringify(ordered)) fail(`${label} shape is invalid`);
  return value as Record<string, unknown>;
}

function readStableRetirementBytes(file: string, label: string): Buffer {
  const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || (before.mode & 0o777n) !== 0o600n || before.size < 1n || before.size > 1_048_576n) fail(`${label} identity is invalid`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const reopened = lstatSync(file, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode || before.nlink !== after.nlink || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || after.dev !== reopened.dev || after.ino !== reopened.ino || reopened.isSymbolicLink() || BigInt(bytes.length) !== after.size) fail(`${label} changed while read`);
    return bytes;
  } finally { closeSync(descriptor); }
}

function descriptorIdentity(descriptor: number): Readonly<{ devDecimal: string; inoDecimal: string }> {
  const stats = fstatSync(descriptor, { bigint: true });
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n) fail("capability descriptor identity is invalid");
  return Object.freeze({ devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10) });
}

function boundedPsProcessIdentity(pid: number): Readonly<{
  pid: number;
  processStartTimeEpochMs: number;
  lstart: string;
  command: string;
  processIdentityHash: string;
}> | null {
  const observed = spawnSync("/bin/ps", ["-p", String(pid), "-o", "lstart=,command="], {
    env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
    shell: false,
    encoding: "utf8",
    timeout: 2_000,
    maxBuffer: 65_536,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!observed.error && !observed.signal && observed.status === 1 && observed.stdout === "" && observed.stderr === "") return null;
  if (observed.error || observed.signal || observed.status !== 0 || observed.stderr !== "" || !observed.stdout.endsWith("\n") || observed.stdout.slice(0, -1).includes("\n")) fail("transition lock owner process observation is ambiguous");
  const row = observed.stdout.slice(0, -1);
  if (row.length < 26) fail("transition lock owner process observation is malformed");
  const lstart = row.slice(0, 24);
  const command = row.slice(24).trimStart();
  const processStartTimeEpochMs = Date.parse(lstart);
  if (!Number.isSafeInteger(processStartTimeEpochMs) || processStartTimeEpochMs < 1 || command.length < 1) fail("transition lock owner process identity is invalid");
  const body = { schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid, processStartTimeEpochMs, lstart, command };
  return Object.freeze({ pid, processStartTimeEpochMs, lstart, command, processIdentityHash: sha256(canonical(body)) });
}

function currentLockRecord(): Readonly<Record<string, unknown>> {
  const observed = boundedPsProcessIdentity(process.pid);
  if (!observed) fail("current transition lock owner process is absent");
  return Object.freeze({
    schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1",
    pid: observed.pid,
    processStartTimeEpochMs: observed.processStartTimeEpochMs,
    processIdentityHash: observed.processIdentityHash,
    leaseNonce: randomBytes(32).toString("hex"),
  });
}

function parseLockRecord(bytes: Buffer): Readonly<Record<string, unknown>> {
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("transition lock record is not JSON"); }
  const record = exactCanonicalRecord(value, ["schema", "pid", "processStartTimeEpochMs", "processIdentityHash", "leaseNonce"], "transition lock");
  if (`${canonical(record)}\n` !== bytes.toString("utf8") || record.schema !== "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1" || !Number.isSafeInteger(record.pid) || (record.pid as number) < 1 || !Number.isSafeInteger(record.processStartTimeEpochMs) || (record.processStartTimeEpochMs as number) < 1 || typeof record.processIdentityHash !== "string" || !SHA256.test(record.processIdentityHash) || typeof record.leaseNonce !== "string" || !SHA256.test(record.leaseNonce)) fail("transition lock record is invalid");
  return Object.freeze(record);
}

function fsyncParent(file: string): void {
  const descriptor = openSync(path.dirname(file), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function cleanupExactOwnedLock(lock: string, descriptor: number, expectedBytes: Buffer | null): void {
  const held = fstatSync(descriptor, { bigint: true });
  const atPath = lstatSync(lock, { bigint: true });
  const reopened = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const again = fstatSync(reopened, { bigint: true });
    const bytes = readFileSync(reopened);
    if (
      !held.isFile() || held.isSymbolicLink() || held.nlink !== 1n || (held.mode & 0o777n) !== 0o600n
      || !atPath.isFile() || atPath.isSymbolicLink() || atPath.nlink !== 1n || (atPath.mode & 0o777n) !== 0o600n
      || !again.isFile() || again.isSymbolicLink() || again.nlink !== 1n || (again.mode & 0o777n) !== 0o600n
      || atPath.dev !== held.dev || atPath.ino !== held.ino || again.dev !== held.dev || again.ino !== held.ino
      || (expectedBytes !== null && !bytes.equals(expectedBytes))
    ) fail("owned transition lock cleanup identity differs");
    const finalPathStats = lstatSync(lock, { bigint: true });
    if (finalPathStats.dev !== held.dev || finalPathStats.ino !== held.ino || finalPathStats.nlink !== 1n || (finalPathStats.mode & 0o777n) !== 0o600n) fail("owned transition lock changed immediately before cleanup");
    unlinkSync(lock);
    fsyncParent(lock);
  } finally { closeSync(reopened); }
}

function repairCompletedNoReplacePublication(file: string): void {
  const directory = path.dirname(file);
  const basename = path.basename(file);
  let candidates: string[];
  try { candidates = readdirSync(directory).filter((name) => name.startsWith(`.${basename}.`)); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  if (candidates.some((name) => !new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[a-f0-9]{32}\\.tmp$`).test(name)) || candidates.length > 1) fail("durable retirement publication recovery inventory is invalid");
  if (candidates.length === 0) return;
  let finalStats: { dev: bigint; ino: bigint };
  try { finalStats = lstatSync(file, { bigint: true }); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  const temporary = path.join(directory, candidates[0]!);
  const finalDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const temporaryDescriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const finalHeld = fstatSync(finalDescriptor, { bigint: true });
    const temporaryHeld = fstatSync(temporaryDescriptor, { bigint: true });
    const finalBytes = readFileSync(finalDescriptor);
    const temporaryBytes = readFileSync(temporaryDescriptor);
    const linked = finalHeld.nlink === 2n && temporaryHeld.nlink === 2n && finalHeld.dev === temporaryHeld.dev && finalHeld.ino === temporaryHeld.ino;
    const collision = finalHeld.nlink === 1n && temporaryHeld.nlink === 1n && finalHeld.dev !== temporaryHeld.dev && finalBytes.equals(temporaryBytes);
    if (!finalHeld.isFile() || !temporaryHeld.isFile() || (finalHeld.mode & 0o777n) !== 0o600n || (temporaryHeld.mode & 0o777n) !== 0o600n || finalStats.dev !== finalHeld.dev || finalStats.ino !== finalHeld.ino || (!linked && !collision) || !finalBytes.equals(temporaryBytes)) fail("durable retirement publication recovery is crossed");
    const finalPathStats = lstatSync(file, { bigint: true });
    const temporaryPathStats = lstatSync(temporary, { bigint: true });
    if (finalPathStats.dev !== finalHeld.dev || finalPathStats.ino !== finalHeld.ino || temporaryPathStats.dev !== temporaryHeld.dev || temporaryPathStats.ino !== temporaryHeld.ino) fail("durable retirement publication changed before recovery cleanup");
    unlinkSync(temporary);
    fsyncParent(file);
  } finally { closeSync(temporaryDescriptor); closeSync(finalDescriptor); }
}

function recoverExpectedNoReplacePublication(file: string, expectedBytes: Buffer): boolean {
  repairCompletedNoReplacePublication(file);
  try {
    if (!readStableRetirementBytes(file, "expected durable publication").equals(expectedBytes)) fail("expected durable publication differs");
    return true;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const directory = path.dirname(file);
  const basename = path.basename(file);
  let candidates: string[];
  try { candidates = readdirSync(directory).filter((name) => name.startsWith(`.${basename}.`)); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  if (candidates.length === 0) return false;
  if (candidates.length !== 1 || !new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[a-f0-9]{32}\\.tmp$`).test(candidates[0]!)) fail("expected durable publication recovery inventory is invalid");
  const temporary = path.join(directory, candidates[0]!);
  const temporaryDescriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(temporaryDescriptor, { bigint: true });
    const bytes = readFileSync(temporaryDescriptor);
    const atPath = lstatSync(temporary, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || (before.mode & 0o777n) !== 0o600n || atPath.dev !== before.dev || atPath.ino !== before.ino || !bytes.equals(expectedBytes)) fail("expected durable publication recovery temporary differs");
    linkSync(temporary, file);
    fsyncParent(file);
    const finalDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const finalStats = fstatSync(finalDescriptor, { bigint: true });
      const temporaryStats = fstatSync(temporaryDescriptor, { bigint: true });
      if (finalStats.dev !== before.dev || finalStats.ino !== before.ino || finalStats.nlink !== 2n || temporaryStats.nlink !== 2n || !readFileSync(finalDescriptor).equals(expectedBytes)) fail("expected durable publication promotion differs");
      const finalPathStats = lstatSync(file, { bigint: true });
      const temporaryPathStats = lstatSync(temporary, { bigint: true });
      if (finalPathStats.dev !== before.dev || finalPathStats.ino !== before.ino || temporaryPathStats.dev !== before.dev || temporaryPathStats.ino !== before.ino) fail("expected durable publication changed before temporary cleanup");
      unlinkSync(temporary);
      fsyncParent(file);
    } finally { closeSync(finalDescriptor); }
  } finally { closeSync(temporaryDescriptor); }
  if (!readStableRetirementBytes(file, "recovered durable publication").equals(expectedBytes)) fail("recovered durable publication differs");
  return true;
}

function openNewLock(lock: string): Readonly<{ descriptor: number; lockBytes: Buffer }> {
  const value = currentLockRecord();
  const lockBytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  const descriptor = openSync(lock, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let exactBytesWritten = false;
  try {
    writeFileSync(descriptor, lockBytes);
    exactBytesWritten = true;
    fsyncSync(descriptor);
    fsyncParent(lock);
    const stats = fstatSync(descriptor, { bigint: true });
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n || (stats.mode & 0o777n) !== 0o600n) fail("new transition lock identity is invalid");
    return Object.freeze({ descriptor, lockBytes });
  } catch (error) {
    try { cleanupExactOwnedLock(lock, descriptor, exactBytesWritten ? lockBytes : null); }
    finally { closeSync(descriptor); }
    throw error;
  }
}

function assertHelperJournalAllowsLockCleanup(
  transitionLock: Readonly<Record<string, unknown>>,
  currentLockIdentity: Readonly<{ devDecimal: string; inoDecimal: string }>,
): void {
  const paths = rootPaths();
  let bytes: Buffer;
  try { bytes = readStableRetirementBytes(paths.journal, "helper journal"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail("helper journal is not JSON during lock cleanup"); }
  const journal = exactCanonicalRecord(value, ["schema", "family", "operationSchema", "operationPurpose", "action", "currentEntryOperation", "restartAuthority", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"], "helper journal lock cleanup");
  const journalTransitionLock = parseLockRecord(Buffer.from(`${canonical(journal.transitionLock)}\n`, "utf8"));
  const journalLockIdentity = exactCanonicalRecord(journal.lockIdentity, ["devDecimal", "inoDecimal"], "helper journal lock identity");
  if (canonical(journalTransitionLock) !== canonical(transitionLock) || canonical(journalLockIdentity) !== canonical(currentLockIdentity)) return;
  const projection = { ...journal };
  delete projection.journalHash;
  if (
    `${canonical(journal)}\n` !== bytes.toString("utf8")
    || journal.schema !== "setfarm.internal-production-service-restart-helper-journal.v1"
    || journal.family !== "pre-schema-spawner-rebind"
    || journal.operationSchema !== "setfarm.internal-production-current-entry-operation.v1"
    || journal.operationPurpose !== "task6a-internal-production-current-entry-v1"
    || journal.action !== "task6a-pre-schema-setfarm-spawner-rebind-v1"
    || journal.maximumDispatchCount !== 1
    || typeof journal.journalHash !== "string" || !SHA256.test(journal.journalHash)
    || sha256(canonical(projection)) !== journal.journalHash
  ) fail("helper journal is crossed during lock cleanup");
  const currentEntryOperation = exactCanonicalRecord(journal.currentEntryOperation, ["operationRef", "operationHash"], "helper journal operation pair");
  const restartAuthority = exactCanonicalRecord(journal.restartAuthority, ["restartAuthorityRef", "restartAuthorityHash"], "helper journal restart pair");
  if (typeof currentEntryOperation.operationRef !== "string" || !PAIR_REF.test(currentEntryOperation.operationRef) || typeof currentEntryOperation.operationHash !== "string" || !SHA256.test(currentEntryOperation.operationHash) || !currentEntryOperation.operationRef.endsWith(currentEntryOperation.operationHash) || typeof restartAuthority.restartAuthorityRef !== "string" || !PAIR_REF.test(restartAuthority.restartAuthorityRef) || typeof restartAuthority.restartAuthorityHash !== "string" || !SHA256.test(restartAuthority.restartAuthorityHash) || !restartAuthority.restartAuthorityRef.endsWith(restartAuthority.restartAuthorityHash)) fail("helper journal pair is invalid during lock cleanup");
  const lockIdentity = journalLockIdentity;
  const settlementBody = {
    schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1",
    action: "task6a-pre-schema-setfarm-spawner-rebind-v1",
    currentEntryOperation,
    restartAuthority,
    journalHash: journal.journalHash,
    transitionLock,
    lockIdentity,
    dispatchCount: 1,
    disposition: "completed",
  };
  const helperSettlementHash = sha256(canonical(settlementBody));
  const helperSettlementRef = `${HELPER_PREFIX}${helperSettlementHash}`;
  const settlementPath = path.join(paths.settlements, helperSettlementHash.slice(0, 2), `${helperSettlementHash}.json`);
  recoverExpectedNoReplacePublication(
    settlementPath,
    Buffer.from(`${canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })}\n`, "utf8"),
  );
  let settlement: Readonly<Record<string, unknown>>;
  try { settlement = readSettlement(helperSettlementHash); }
  catch { return fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN"); }
  if (canonical(settlement) !== canonical({ ...settlementBody, helperSettlementRef, helperSettlementHash })) fail("helper settlement differs during lock cleanup");
}

function reclaimDeadLockOnce(lock: string): void {
  const descriptor = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const first = fstatSync(descriptor, { bigint: true });
    if (!first.isFile() || first.isSymbolicLink() || first.nlink !== 1n || (first.mode & 0o777n) !== 0o600n) fail("existing transition lock identity is invalid");
    const bytes = readFileSync(descriptor);
    if (bytes.length < 1 || bytes.length > 65_536) fail("transition lock record size is invalid");
    const record = parseLockRecord(bytes);
    const observed = boundedPsProcessIdentity(record.pid as number);
    if (observed) {
      if (observed.processStartTimeEpochMs !== record.processStartTimeEpochMs || observed.processIdentityHash !== record.processIdentityHash) fail("transition lock PID was reused or replaced");
      fail("restart transition lease is unavailable");
    }
    assertHelperJournalAllowsLockCleanup(record, descriptorIdentity(descriptor));
    const pathStats = lstatSync(lock, { bigint: true });
    const secondDescriptor = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const second = fstatSync(secondDescriptor, { bigint: true });
      const secondBytes = readFileSync(secondDescriptor);
      if (pathStats.dev !== first.dev || pathStats.ino !== first.ino || pathStats.nlink !== 1n || second.dev !== first.dev || second.ino !== first.ino || second.nlink !== 1n || !secondBytes.equals(bytes)) fail("transition lock changed before dead-owner cleanup");
      const finalPathStats = lstatSync(lock, { bigint: true });
      if (finalPathStats.dev !== first.dev || finalPathStats.ino !== first.ino || finalPathStats.nlink !== 1n || (finalPathStats.mode & 0o777n) !== 0o600n) fail("transition lock changed immediately before dead-owner cleanup");
      unlinkSync(lock);
      fsyncParent(lock);
    } finally { closeSync(secondDescriptor); }
  } finally { closeSync(descriptor); }
}

function writeNoReplace(file: string, value: unknown): boolean {
  const bytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const directory = path.dirname(file);
  const basename = path.basename(file);
  const prefix = `.${basename}.`;
  const candidates = readdirSync(directory).filter((name) => name.startsWith(prefix));
  if (candidates.some((name) => !new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[a-f0-9]{32}\\.tmp$`).test(name)) || candidates.length > 1) fail("retirement publication recovery inventory is invalid");
  let temporary: string;
  if (candidates.length === 1) {
    temporary = path.join(directory, candidates[0]!);
    const descriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stats = fstatSync(descriptor, { bigint: true });
      if (!stats.isFile() || stats.nlink !== 1n || (stats.mode & 0o777n) !== 0o600n || !readFileSync(descriptor).equals(bytes)) fail("retirement publication recovery temporary differs");
    } finally { closeSync(descriptor); }
  } else {
    temporary = path.join(directory, `${prefix}${randomBytes(16).toString("hex")}.tmp`);
    const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  }
  let created = true;
  try { linkSync(temporary, file); } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    created = false;
  }
  unlinkSync(temporary);
  fsyncParent(file);
  const finalDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stats = fstatSync(finalDescriptor, { bigint: true });
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n || !readFileSync(finalDescriptor).equals(bytes)) fail("immutable retirement record differs");
  } finally { closeSync(finalDescriptor); }
  return created;
}

function pair(value: unknown, refKey: string, hashKey: string): Readonly<Record<string, string>> {
  const result = exactOwnRecord(value, [refKey, hashKey], `${refKey} pair`);
  if (typeof result[refKey] !== "string" || !PAIR_REF.test(result[refKey] as string) || typeof result[hashKey] !== "string" || !SHA256.test(result[hashKey] as string) || !(result[refKey] as string).endsWith(result[hashKey] as string)) fail(`${refKey} pair is invalid`);
  return Object.freeze(result as Record<string, string>);
}

function assertEpochOneActive(): void {
  const { epoch } = rootPaths();
  const bytes = readStableRetirementBytes(epoch, "restart epoch");
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  const head = exactCanonicalRecord(value, [
    "schema", "epochOrdinal", "authorityOwner", "services", "predecessorEpochRef", "predecessorEpochHash",
    "retirementRef", "retirementHash", "startupHooksReadyRef", "startupHooksReadyHash",
    "successorActivationRef", "successorActivationHash", "epochRef", "epochHash",
  ], "restart epoch");
  const projection = { ...head };
  delete projection.epochRef;
  delete projection.epochHash;
  const epochHash = sha256(canonical(projection));
  if (
    `${canonical(head)}\n` !== bytes.toString("utf8")
    || head.schema !== "setfarm.internal-production-physical-service-restart-authority-epoch.v1"
    || head.epochOrdinal !== 1
    || head.authorityOwner !== "baseline-a"
    || canonical(head.services) !== canonical(["setfarm-spawner", "setfarm-dashboard", "mission-control"])
    || [head.predecessorEpochRef, head.predecessorEpochHash, head.retirementRef, head.retirementHash, head.startupHooksReadyRef, head.startupHooksReadyHash, head.successorActivationRef, head.successorActivationHash].some((member) => member !== null)
    || head.epochHash !== epochHash
    || head.epochRef !== `setfarm://internal-production/physical-service-restart-authority-epoch/sha256/${epochHash}`
  ) fail("restart epoch is not unambiguous A-active");
}

function heldLease(lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1): LeaseStateV1 {
  const state = leases.get(lease);
  if (!state || state.phase !== "held" || Reflect.ownKeys(lease).length !== 1 || lease.schema !== "setfarm.internal-production-physical-service-restart-authority-transition-lease.v1") fail("lease is foreign, cloned, or released");
  return state;
}

export async function acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(): Promise<InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1> {
  assertEpochOneActive();
  const paths = rootPaths();
  mkdirSync(paths.root, { recursive: true, mode: 0o700 });
  let opened: Readonly<{ descriptor: number; lockBytes: Buffer }>;
  try {
    opened = openNewLock(paths.lock);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    reclaimDeadLockOnce(paths.lock);
    opened = openNewLock(paths.lock);
  }
  try { assertEpochOneActive(); }
  catch (error) {
    try { cleanupExactOwnedLock(paths.lock, opened.descriptor, opened.lockBytes); }
    finally { closeSync(opened.descriptor); }
    throw error;
  }
  const lease = Object.freeze({ schema: "setfarm.internal-production-physical-service-restart-authority-transition-lease.v1" as const });
  leases.set(lease, { descriptor: opened.descriptor, lockBytes: opened.lockBytes, phase: "held", authorityOwner: "baseline-a" });
  return lease;
}

export async function releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
): Promise<void> {
  const state = heldLease(lease);
  state.phase = "released";
  const lock = rootPaths().lock;
  try {
    assertHelperJournalAllowsLockCleanup(parseLockRecord(state.lockBytes), descriptorIdentity(state.descriptor));
    cleanupExactOwnedLock(lock, state.descriptor, state.lockBytes);
  } finally {
    closeSync(state.descriptor);
    leases.delete(lease);
  }
}

function readSettlement(hash: string): Readonly<Record<string, unknown>> {
  const file = path.join(rootPaths().settlements, hash.slice(0, 2), `${hash}.json`);
  const bytes = readStableRetirementBytes(file, "helper settlement");
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  if (`${canonical(value)}\n` !== bytes.toString("utf8")) fail("helper settlement is not canonical");
  return exactCanonicalRecord(value, ["schema", "action", "currentEntryOperation", "restartAuthority", "journalHash", "transitionLock", "lockIdentity", "dispatchCount", "disposition", "helperSettlementRef", "helperSettlementHash"], "helper settlement");
}

function startupPrefixAlreadyPassedHelperV1(operationHash: string): boolean {
  const directory = path.join(repositoryRoot(), "data/internal-production-baseline/pre-schema-spawner-rebind-v1/operations/sha256", operationHash);
  for (const basename of [
    "04-predecessor-termination.pair.json", "05-replacement-process.pair.json",
    "06-post-termination-legacy-zero.pair.json", "07-sealed-admission.pair.json",
  ]) {
    const target = path.join(directory, basename);
    try {
      const observed = lstatSync(target, { bigint: true });
      if (!observed.isFile() || observed.isSymbolicLink() || observed.nlink !== 1n || (observed.mode & 0o777n) !== 0o600n) fail("post-helper startup prefix identity is invalid");
      return true;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
  return false;
}

export async function invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(
  lease: InternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  input: Readonly<{
    currentEntryOperation: Readonly<{ operationRef: string; operationHash: string }>;
    restartAuthority: Readonly<{ restartAuthorityRef: string; restartAuthorityHash: string }>;
  }>,
): Promise<InternalProductionPreSchemaSpawnerRebindHelperSettlementPairV1> {
  heldLease(lease);
  assertEpochOneActive();
  const exactInput = exactOwnRecord(input, ["currentEntryOperation", "restartAuthority"], "helper invoke input");
  const currentEntryOperation = pair(exactInput.currentEntryOperation, "operationRef", "operationHash");
  const restartAuthority = pair(exactInput.restartAuthority, "restartAuthorityRef", "restartAuthorityHash");
  const receipt = await import("./baseline-post-handoff-receipt-v1.js");
  const startup = await import("./baseline-spawner-startup-admission-v1.js");
  const resolvedOperation = await receipt.resolveInternalProductionCurrentEntryOperationV1(currentEntryOperation as { operationRef: string; operationHash: string }) as Readonly<Record<string, unknown>>;
  const resolvedRestart = await startup.resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(restartAuthority as { restartAuthorityRef: string; restartAuthorityHash: string }) as Readonly<Record<string, unknown>>;
  const uid = process.getuid?.();
  if (
    resolvedOperation.operationRef !== currentEntryOperation.operationRef
    || resolvedOperation.operationHash !== currentEntryOperation.operationHash
    || resolvedOperation.schema !== "setfarm.internal-production-current-entry-operation.v1"
    || resolvedOperation.purpose !== "task6a-internal-production-current-entry-v1"
    || resolvedRestart.restartAuthorityRef !== restartAuthority.restartAuthorityRef
    || resolvedRestart.restartAuthorityHash !== restartAuthority.restartAuthorityHash
    || resolvedRestart.currentEntryOperationRef !== currentEntryOperation.operationRef
    || resolvedRestart.currentEntryOperationHash !== currentEntryOperation.operationHash
    || resolvedRestart.schema !== "setfarm.internal-production-pre-schema-spawner-restart-authority.v1"
    || resolvedRestart.actionId !== "task6a-pre-schema-setfarm-spawner-rebind-v1"
    || resolvedRestart.service !== "setfarm-spawner"
    || resolvedRestart.uid !== uid
    || resolvedRestart.launchdLabel !== "com.setrox.setfarm-spawner"
    || resolvedRestart.executable !== "/bin/launchctl"
    || canonical(resolvedRestart.argv) !== canonical(["kickstart", "-k", `gui/${uid}/com.setrox.setfarm-spawner`])
  ) fail("helper invoke operation/restart relation or fixed action is crossed");
  const held = heldLease(lease);
  const currentLockIdentity = descriptorIdentity(held.descriptor);
  const currentTransitionLock = parseLockRecord(held.lockBytes);
  const paths = rootPaths();
  mkdirSync(paths.settlements, { recursive: true, mode: 0o700 });
  let journal: Readonly<Record<string, unknown>>;
  let dispatchRequired: boolean;
  repairCompletedNoReplacePublication(paths.journal);
  try {
    const bytes = readStableRetirementBytes(paths.journal, "helper journal");
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    const existing = exactCanonicalRecord(value, ["schema", "family", "operationSchema", "operationPurpose", "action", "currentEntryOperation", "restartAuthority", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"], "helper journal");
    const projection = { ...existing };
    delete projection.journalHash;
    if (`${canonical(existing)}\n` !== bytes.toString("utf8") || existing.schema !== "setfarm.internal-production-service-restart-helper-journal.v1" || existing.family !== "pre-schema-spawner-rebind" || existing.operationSchema !== "setfarm.internal-production-current-entry-operation.v1" || existing.operationPurpose !== "task6a-internal-production-current-entry-v1" || existing.action !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || canonical(existing.currentEntryOperation) !== canonical(currentEntryOperation) || canonical(existing.restartAuthority) !== canonical(restartAuthority) || canonical(existing.transitionLock) !== canonical(parseLockRecord(Buffer.from(`${canonical(existing.transitionLock)}\n`, "utf8"))) || canonical(existing.lockIdentity) !== canonical(exactCanonicalRecord(existing.lockIdentity, ["devDecimal", "inoDecimal"], "journal lock identity")) || existing.maximumDispatchCount !== 1 || typeof existing.journalHash !== "string" || !SHA256.test(existing.journalHash) || sha256(canonical(projection)) !== existing.journalHash) fail("helper journal is crossed or ambiguous");
    journal = Object.freeze(existing);
    dispatchRequired = false;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    if (startupPrefixAlreadyPassedHelperV1(currentEntryOperation.operationHash)) fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
    const journalBody = {
      schema: "setfarm.internal-production-service-restart-helper-journal.v1",
      family: "pre-schema-spawner-rebind",
      operationSchema: resolvedOperation.schema,
      operationPurpose: resolvedOperation.purpose,
      action: "task6a-pre-schema-setfarm-spawner-rebind-v1",
      currentEntryOperation,
      restartAuthority,
      transitionLock: currentTransitionLock,
      lockIdentity: currentLockIdentity,
      maximumDispatchCount: 1,
    };
    const journalHash = sha256(canonical(journalBody));
    journal = Object.freeze({ ...journalBody, journalHash });
    const freshCensus = await receipt.observeInternalProductionServiceCensusV1();
    const freshSpawner = exactOwnRecord(freshCensus.spawner, [
      "pid", "processStartTimeEpochMs", "processIdentityHash", "serviceIdentityHash", "generationHash",
      "loadedSourceSha", "loadedTreeHash", "loadedBuildHash", "processOwnerCount", "listener",
    ], "fresh predecessor spawner census");
    const freshProcessBody = {
      schema: "setfarm.internal-production-spawner-process-identity.v1",
      pid: freshSpawner.pid,
      processStartTimeEpochMs: freshSpawner.processStartTimeEpochMs,
      processIdentityHash: freshSpawner.processIdentityHash,
    };
    const freshProcessHash = sha256(canonical(freshProcessBody));
    if (
      freshSpawner.processOwnerCount !== 1
      || freshSpawner.listener !== null
      || !Number.isSafeInteger(freshSpawner.pid)
      || (freshSpawner.pid as number) < 1
      || !Number.isSafeInteger(freshSpawner.processStartTimeEpochMs)
      || (freshSpawner.processStartTimeEpochMs as number) < 1
      || typeof freshSpawner.processIdentityHash !== "string"
      || !SHA256.test(freshSpawner.processIdentityHash)
      || resolvedRestart.predecessorSpawnerProcessIdentityRef !== `setfarm://internal-production/spawner-process-identity/sha256/${freshProcessHash}`
      || resolvedRestart.predecessorSpawnerProcessIdentityHash !== freshProcessHash
      || resolvedRestart.predecessorSpawnerServiceIdentityHash !== freshSpawner.serviceIdentityHash
      || resolvedRestart.predecessorSpawnerGenerationHash !== freshSpawner.generationHash
      || resolvedRestart.targetSpawnerSourceSha !== freshSpawner.loadedSourceSha
      || resolvedRestart.targetSpawnerTreeHash !== freshSpawner.loadedTreeHash
      || resolvedRestart.targetSpawnerBuildHash !== freshSpawner.loadedBuildHash
    ) fail("fresh predecessor census identity is crossed before helper journal claim");
    dispatchRequired = writeNoReplace(paths.journal, journal);
  }
  const journalHash = journal.journalHash as string;
  const transitionLock = journal.transitionLock as Readonly<Record<string, unknown>>;
  const lockIdentity = journal.lockIdentity as Readonly<Record<string, unknown>>;
  const expectedBody = {
    schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1",
    action: "task6a-pre-schema-setfarm-spawner-rebind-v1",
    currentEntryOperation,
    restartAuthority,
    journalHash,
    transitionLock,
    lockIdentity,
    dispatchCount: 1,
    disposition: "completed",
  };
  const helperSettlementHash = sha256(canonical(expectedBody));
  const helperSettlementRef = `${HELPER_PREFIX}${helperSettlementHash}`;
  const settlementPath = path.join(paths.settlements, helperSettlementHash.slice(0, 2), `${helperSettlementHash}.json`);
  if (dispatchRequired) {
    mkdirSync(path.dirname(settlementPath), { recursive: true, mode: 0o700 });
    const capabilityPath = path.join(paths.root, `.helper-capability.${randomUUID()}.json`);
    const journalDescriptor = openSync(paths.journal, constants.O_RDONLY | constants.O_NOFOLLOW);
    const frame = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-restart-authority.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, lockIdentity: currentLockIdentity, journalIdentity: descriptorIdentity(journalDescriptor) };
    const writable = openSync(capabilityPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(writable, canonical(frame)); fsyncSync(writable); } finally { closeSync(writable); }
    const descriptor = openSync(capabilityPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    unlinkSync(capabilityPath);
    const helper = fileURLToPath(new URL("./baseline-service-restart-helper-v1.js", import.meta.url));
    const child = spawnSync(process.execPath, [helper], {
      env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
      shell: false,
      stdio: ["ignore", "ignore", "ignore", descriptor, heldLease(lease).descriptor, journalDescriptor],
      timeout: 45_000,
    });
    closeSync(descriptor);
    closeSync(journalDescriptor);
    if (child.error || child.signal || child.status !== 0) fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN");
  }
  recoverExpectedNoReplacePublication(settlementPath, Buffer.from(`${canonical({ ...expectedBody, helperSettlementRef, helperSettlementHash })}\n`, "utf8"));
  let settled: Readonly<Record<string, unknown>>;
  try { settled = readSettlement(helperSettlementHash); } catch { return fail("HELPER_DISPATCH_SETTLEMENT_UNKNOWN"); }
  if (canonical(settled) !== canonical({ ...expectedBody, helperSettlementRef, helperSettlementHash })) fail("helper settlement differs");
  return Object.freeze({ helperSettlementRef, helperSettlementHash });
}
