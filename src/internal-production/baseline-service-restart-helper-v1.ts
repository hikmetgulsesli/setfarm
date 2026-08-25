import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/;
const REF = /^setfarm:\/\/internal-production\/[a-z0-9-]+\/sha256\/[a-f0-9]{64}$/;
const MAX_FRAME_BYTES = 65_536;

function fail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_PRE_SCHEMA_RESTART_HELPER_INVALID:${message}`);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const ordered = [...keys].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || JSON.stringify(Object.keys(value)) !== JSON.stringify(ordered)) fail("frame shape is invalid");
  return value as Record<string, unknown>;
}

function exactPair(value: unknown, refKey: string, hashKey: string): Record<string, unknown> {
  const pair = exactRecord(value, [refKey, hashKey]);
  if (typeof pair[refKey] !== "string" || !REF.test(pair[refKey]) || typeof pair[hashKey] !== "string" || !SHA256.test(pair[hashKey]) || !pair[refKey].endsWith(pair[hashKey])) fail("frame pair is invalid");
  return pair;
}

function publishSettlement(settlementPath: string, value: unknown): void {
  if (!path.isAbsolute(settlementPath) || !settlementPath.endsWith(".json")) fail("settlement path is invalid");
  const directoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(settlementPath));
  try {
    directoryGuard.assertStable();
  const bytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  const directory = path.dirname(settlementPath);
  const basename = path.basename(settlementPath);
  const prefix = `.${basename}.`;
  const candidates = readdirSync(directory).filter((name) => name.startsWith(prefix));
  if (candidates.some((name) => !new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[a-f0-9]{32}\\.tmp$`).test(name)) || candidates.length > 1) fail("settlement recovery inventory is invalid");
  let temporary: string;
  if (candidates.length === 1) {
    temporary = path.join(directory, candidates[0]!);
    const descriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stats = fstatSync(descriptor, { bigint: true });
      if (!stats.isFile() || stats.nlink !== 1n || (stats.mode & 0o7777n) !== 0o600n || !readFileSync(descriptor).equals(bytes)) fail("settlement recovery temporary differs");
    } finally { closeSync(descriptor); }
  } else {
    temporary = path.join(directory, `${prefix}${randomBytes(16).toString("hex")}.tmp`);
    const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  }
  try { linkSync(temporary, settlementPath); } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
  }
  unlinkSync(temporary);
  const parent = openSync(path.dirname(settlementPath), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(parent); } finally { closeSync(parent); }
  const finalDescriptor = openSync(settlementPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stats = fstatSync(finalDescriptor, { bigint: true });
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n || (stats.mode & 0o7777n) !== 0o600n || !readFileSync(finalDescriptor).equals(bytes)) fail("settlement adoption differs");
  } finally { closeSync(finalDescriptor); }
    directoryGuard.assertStable();
  } finally {
    try { directoryGuard.assertStable(); } finally { directoryGuard.close(); }
  }
}

function settlementAlreadyExists(settlementPath: string, expected: unknown): boolean {
  let directoryGuard: PrivateDirectoryGuardV1 | null = null;
  try {
    directoryGuard = authenticatePrivateDirectoryChainV1(path.resolve(repositoryRoot()), path.dirname(settlementPath));
    directoryGuard.assertStable();
    const descriptor = openSync(settlementPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stats = fstatSync(descriptor, { bigint: true });
      const bytes = readFileSync(descriptor);
      const directory = path.dirname(settlementPath);
      const basename = path.basename(settlementPath);
      const prefix = `.${basename}.`;
      const candidates = readdirSync(directory).filter((name) => name.startsWith(prefix));
      if (candidates.some((name) => !new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[a-f0-9]{32}\\.tmp$`).test(name)) || candidates.length > 1 || !stats.isFile() || stats.isSymbolicLink() || !new Set([1n, 2n]).has(stats.nlink) || (stats.mode & 0o7777n) !== 0o600n || bytes.toString("utf8") !== `${canonical(expected)}\n`) fail("settlement adoption differs");
      if (candidates.length === 1) {
        const temporary = path.join(directory, candidates[0]!);
        const temporaryDescriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const temporaryStats = fstatSync(temporaryDescriptor, { bigint: true });
          const temporaryBytes = readFileSync(temporaryDescriptor);
          const linked = stats.nlink === 2n && temporaryStats.nlink === 2n && stats.dev === temporaryStats.dev && stats.ino === temporaryStats.ino;
          const collision = stats.nlink === 1n && temporaryStats.nlink === 1n && stats.dev !== temporaryStats.dev && bytes.equals(temporaryBytes);
          if (!temporaryStats.isFile() || (temporaryStats.mode & 0o7777n) !== 0o600n || (!linked && !collision) || !temporaryBytes.equals(bytes)) fail("settlement recovery is crossed");
          const finalPathStats = lstatSync(settlementPath, { bigint: true });
          const temporaryPathStats = lstatSync(temporary, { bigint: true });
          if (finalPathStats.dev !== stats.dev || finalPathStats.ino !== stats.ino || temporaryPathStats.dev !== temporaryStats.dev || temporaryPathStats.ino !== temporaryStats.ino) fail("settlement changed before recovery cleanup");
          unlinkSync(temporary);
          const parent = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
          try { fsyncSync(parent); } finally { closeSync(parent); }
        } finally { closeSync(temporaryDescriptor); }
      } else if (stats.nlink !== 1n) fail("settlement adoption link count differs");
      const finalPathStats = lstatSync(settlementPath, { bigint: true });
      if (finalPathStats.dev !== stats.dev || finalPathStats.ino !== stats.ino || finalPathStats.nlink !== 1n) fail("settlement recovery final differs");
      return true;
    } finally { closeSync(descriptor); }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  } finally {
    if (directoryGuard) {
      try { directoryGuard.assertStable(); } finally { directoryGuard.close(); }
    }
  }
}

function repositoryRoot(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const source = path.dirname(current);
  if (!new Set(["src", "dist"]).has(path.basename(source))) fail("helper module root is invalid");
  return path.dirname(source);
}

type PrivateDirectoryGuardV1 = Readonly<{ assertStable: () => void; close: () => void }>;

function authenticatePrivateDirectoryChainV1(anchor: string, target: string): PrivateDirectoryGuardV1 {
  const relative = path.relative(anchor, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("authority directory escapes the repository root");
  const segments = relative === "" ? [] : relative.split(path.sep);
  const paths = [anchor, ...segments.map((_, index) => path.join(anchor, ...segments.slice(0, index + 1)))];
  const descriptors: number[] = [];
  const held: Array<ReturnType<typeof fstatSync>> = [];
  let closed = false;
  const assertStable = (): void => {
    if (closed) fail("authority directory guard is closed");
    for (const [index, current] of paths.entries()) {
      const after = lstatSync(current, { bigint: true });
      const descriptorAfter = fstatSync(descriptors[index]!, { bigint: true });
      const observed = held[index]!;
      if (
        !after.isDirectory() || after.isSymbolicLink() || !descriptorAfter.isDirectory()
        || after.dev !== observed.dev || after.ino !== observed.ino || after.mode !== observed.mode
        || descriptorAfter.dev !== observed.dev || descriptorAfter.ino !== observed.ino
        || descriptorAfter.mode !== observed.mode
      ) fail("authority directory changed while authenticated");
    }
  };
  try {
    for (const [index, current] of paths.entries()) {
      const before = lstatSync(current, { bigint: true });
      const descriptor = openSync(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      descriptors.push(descriptor);
      const observed = fstatSync(descriptor, { bigint: true });
      if (
        !before.isDirectory() || before.isSymbolicLink() || !observed.isDirectory()
        || before.dev !== observed.dev || before.ino !== observed.ino || before.mode !== observed.mode
        || before.nlink !== observed.nlink || before.nlink < 1n
        || (index > 0 && (observed.mode & 0o7777n) !== 0o700n)
        || (index > 0 && observed.dev !== held[0]!.dev)
      ) fail("authority directory identity is invalid");
      held.push(observed);
    }
    assertStable();
    return Object.freeze({
      assertStable,
      close: () => {
        if (closed) fail("authority directory guard is already closed");
        closed = true;
        for (const descriptor of descriptors.reverse()) closeSync(descriptor);
      },
    });
  } catch (error) {
    closed = true;
    for (const descriptor of descriptors.reverse()) closeSync(descriptor);
    throw error;
  }
}

function ensurePrivateAuthorityDirectoryV1(directory: string): PrivateDirectoryGuardV1 {
  const anchor = path.resolve(repositoryRoot());
  const target = path.resolve(directory);
  const relative = path.relative(anchor, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("authority directory escapes the repository root");
  let current = anchor;
  for (const segment of relative.split(path.sep)) {
    const parentGuard = authenticatePrivateDirectoryChainV1(anchor, current);
    current = path.join(current, segment);
    try {
      parentGuard.assertStable();
      try { mkdirSync(current, { mode: 0o700 }); }
      catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      }
      parentGuard.assertStable();
    } finally {
      parentGuard.close();
    }
    const createdGuard = authenticatePrivateDirectoryChainV1(anchor, current);
    createdGuard.close();
  }
  return authenticatePrivateDirectoryChainV1(anchor, target);
}

function authenticateCanonicalTransitionLock(fd: number): Readonly<{
  identity: Readonly<{ devDecimal: string; inoDecimal: string }>;
  transitionLock: Readonly<Record<string, unknown>>;
}> {
  const lockPath = path.join(repositoryRoot(), "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock");
  const held = fstatSync(fd, { bigint: true });
  const pathStats = lstatSync(lockPath, { bigint: true });
  const reopened = openSync(lockPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const reopenedStats = fstatSync(reopened, { bigint: true });
    if (!held.isFile() || held.isSymbolicLink() || held.nlink !== 1n || (held.mode & 0o7777n) !== 0o600n || pathStats.isSymbolicLink() || pathStats.dev !== held.dev || pathStats.ino !== held.ino || reopenedStats.dev !== held.dev || reopenedStats.ino !== held.ino || reopenedStats.nlink !== 1n || (reopenedStats.mode & 0o7777n) !== 0o600n) fail("canonical transition lock descriptor/path identity is crossed");
    const bytes = readFileSync(reopened);
    let value: unknown;
    try { value = JSON.parse(bytes.toString("utf8")); } catch { fail("canonical transition lock is not JSON"); }
    const lock = exactRecord(value, ["schema", "pid", "processStartTimeEpochMs", "processIdentityHash", "leaseNonce"]);
    if (`${canonical(lock)}\n` !== bytes.toString("utf8") || lock.schema !== "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1" || lock.pid !== process.ppid || !Number.isSafeInteger(lock.pid) || (lock.pid as number) < 1 || !Number.isSafeInteger(lock.processStartTimeEpochMs) || (lock.processStartTimeEpochMs as number) < 1 || typeof lock.processIdentityHash !== "string" || !SHA256.test(lock.processIdentityHash) || typeof lock.leaseNonce !== "string" || !SHA256.test(lock.leaseNonce)) fail("canonical transition lock record is invalid");
    const observed = spawnSync("/bin/ps", ["-p", String(lock.pid), "-o", "lstart=,command="], {
      env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }), shell: false, encoding: "utf8", timeout: 2_000, maxBuffer: 65_536, stdio: ["ignore", "pipe", "pipe"],
    });
    if (observed.error || observed.signal || observed.status !== 0 || observed.stderr !== "" || !observed.stdout.endsWith("\n") || observed.stdout.slice(0, -1).includes("\n")) fail("canonical transition lock owner is not live and unambiguous");
    const row = observed.stdout.slice(0, -1);
    if (row.length < 26) fail("canonical transition lock owner row is malformed");
    const lstart = row.slice(0, 24);
    const command = row.slice(24).trimStart();
    const processStartTimeEpochMs = Date.parse(lstart);
    const processIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: lock.pid, processStartTimeEpochMs, lstart, command }));
    if (processStartTimeEpochMs !== lock.processStartTimeEpochMs || processIdentityHash !== lock.processIdentityHash) fail("canonical transition lock owner identity is crossed");
    return Object.freeze({
      identity: Object.freeze({ devDecimal: held.dev.toString(10), inoDecimal: held.ino.toString(10) }),
      transitionLock: Object.freeze(lock),
    });
  } finally { closeSync(reopened); }
}

function authenticateCanonicalJournalCapability(fd: number): Readonly<{ identity: Readonly<{ devDecimal: string; inoDecimal: string }>; bytes: Buffer }> {
  const journalPath = path.join(repositoryRoot(), "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json");
  const held = fstatSync(fd, { bigint: true });
  const atPath = lstatSync(journalPath, { bigint: true });
  const reopened = openSync(journalPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const again = fstatSync(reopened, { bigint: true });
    const bytes = readFileSync(reopened);
    if (!held.isFile() || held.isSymbolicLink() || held.nlink !== 1n || (held.mode & 0o7777n) !== 0o600n || !atPath.isFile() || atPath.isSymbolicLink() || atPath.nlink !== 1n || (atPath.mode & 0o7777n) !== 0o600n || !again.isFile() || again.isSymbolicLink() || again.nlink !== 1n || (again.mode & 0o7777n) !== 0o600n || atPath.dev !== held.dev || atPath.ino !== held.ino || again.dev !== held.dev || again.ino !== held.ino || bytes.length < 1 || bytes.length > MAX_FRAME_BYTES) fail("canonical journal descriptor/path identity is crossed");
    return Object.freeze({ identity: Object.freeze({ devDecimal: held.dev.toString(10), inoDecimal: held.ino.toString(10) }), bytes });
  } finally { closeSync(reopened); }
}

function helperSettlementPath(hash: string): string {
  return path.join(repositoryRoot(), "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-settlements/sha256", hash.slice(0, 2), `${hash}.json`);
}

async function main(): Promise<void> {
  if (process.argv.length !== 2) fail("argv must be empty");
  const frameBytes = readFileSync(3, { flag: "r" }); // code-owned inherited capability fd: 3
  if (frameBytes.length < 1 || frameBytes.length > MAX_FRAME_BYTES) fail("capability frame size is invalid");
  let value: unknown;
  try { value = JSON.parse(frameBytes.toString("utf8")); } catch { fail("capability frame is not JSON"); }
  const frame = exactRecord(value, ["schema", "action", "currentEntryOperation", "restartAuthority", "journalHash", "lockIdentity", "journalIdentity"]);
  if (frame.schema !== "setfarm.internal-production-pre-schema-spawner-rebind-restart-authority.v1" || frame.action !== "task6a-pre-schema-setfarm-spawner-rebind-v1") fail("capability discriminator is invalid");
  const operation = exactPair(frame.currentEntryOperation, "operationRef", "operationHash");
  const restart = exactPair(frame.restartAuthority, "restartAuthorityRef", "restartAuthorityHash");
  if (typeof frame.journalHash !== "string" || !SHA256.test(frame.journalHash)) fail("journal hash is invalid");
  const lockIdentity = exactRecord(frame.lockIdentity, ["devDecimal", "inoDecimal"]);
  const journalIdentity = exactRecord(frame.journalIdentity, ["devDecimal", "inoDecimal"]);
  const journalCapability = authenticateCanonicalJournalCapability(5);
  const lockCapability = authenticateCanonicalTransitionLock(4);
  if (canonical(lockIdentity) !== canonical(lockCapability.identity) || canonical(journalIdentity) !== canonical(journalCapability.identity)) fail("inherited capability descriptors are crossed");
  const journalBytes = journalCapability.bytes;
  const journalText = journalBytes.toString("utf8");
  let journalValue: unknown;
  try { journalValue = JSON.parse(journalText); } catch { fail("journal capability is not JSON"); }
  const journal = exactRecord(journalValue, ["schema", "family", "operationSchema", "operationPurpose", "action", "currentEntryOperation", "restartAuthority", "transitionLock", "lockIdentity", "maximumDispatchCount", "journalHash"]);
  const journalProjection = { ...journal };
  delete journalProjection.journalHash;
  if (`${canonical(journal)}\n` !== journalText || journal.schema !== "setfarm.internal-production-service-restart-helper-journal.v1" || journal.family !== "pre-schema-spawner-rebind" || journal.operationSchema !== "setfarm.internal-production-current-entry-operation.v1" || journal.operationPurpose !== "task6a-internal-production-current-entry-v1" || journal.action !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || sha256(canonical(journalProjection)) !== frame.journalHash || journal.journalHash !== frame.journalHash || canonical(journal.currentEntryOperation) !== canonical(operation) || canonical(journal.restartAuthority) !== canonical(restart) || canonical(journal.transitionLock) !== canonical(lockCapability.transitionLock) || canonical(journal.lockIdentity) !== canonical(lockIdentity) || journal.maximumDispatchCount !== 1) fail("durable journal capability is invalid");
  const body = {
    schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1",
    action: "task6a-pre-schema-setfarm-spawner-rebind-v1",
    currentEntryOperation: operation,
    restartAuthority: restart,
    journalHash: frame.journalHash,
    transitionLock: lockCapability.transitionLock,
    lockIdentity,
    dispatchCount: 1,
    disposition: "completed",
  };
  const helperSettlementHash = sha256(canonical(body));
  const settlement = {
    ...body,
    helperSettlementRef: `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`,
    helperSettlementHash,
  };
  const settlementPath = helperSettlementPath(helperSettlementHash);
  if (settlementAlreadyExists(settlementPath, settlement)) return;
  const finalJournalCapability = authenticateCanonicalJournalCapability(5);
  const finalLockCapability = authenticateCanonicalTransitionLock(4);
  if (canonical(lockIdentity) !== canonical(finalLockCapability.identity) || canonical(lockCapability.transitionLock) !== canonical(finalLockCapability.transitionLock) || canonical(journalIdentity) !== canonical(finalJournalCapability.identity) || !finalJournalCapability.bytes.equals(journalBytes)) fail("inherited capabilities changed before dispatch");
  const result = spawnSync("/bin/launchctl", ["kickstart", "-k", `gui/${process.getuid?.()}/com.setrox.setfarm-spawner`], {
    env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
    shell: false,
    stdio: ["ignore", "ignore", "pipe"],
    timeout: 30_000,
    encoding: "utf8",
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr !== "") fail("fixed launchctl dispatch failed");
  publishSettlement(settlementPath, settlement);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
