import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
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
import {
  observeCurrentInternalProductionCleanSetfarmSourceBuildV1,
} from "./baseline-post-handoff-receipt-v1.js";

type Sha256V1 = string;
type CanonicalRef = string;

export type InternalProductionBaselineRestartSequenceIntentKindV1 =
  | "live-rebind"
  | "d-startup-hook-load"
  | "documentation-rollback";

export type InternalProductionBaselineServiceRestartAuthorityPairV1 = Readonly<{
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  actionId: "a-restart-service-setfarm-spawner-v1" | "a-restart-service-setfarm-dashboard-v1" | "a-restart-service-mission-control-v1";
  authorityRef: CanonicalRef;
  authorityHash: Sha256V1;
}>;

export type InternalProductionBaselineRestartSequenceReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-restart-sequence-receipt.v1";
  intentKind: InternalProductionBaselineRestartSequenceIntentKindV1;
  sequenceIntentHash: Sha256V1;
  migrationReceiptRef: CanonicalRef;
  migrationReceiptHash: Sha256V1;
  migrationSchemaProjectionHash: Sha256V1;
  initialRuntimeSourceProjectionHash: Sha256V1;
  orderedServices: readonly ["setfarm-spawner", "setfarm-dashboard", "mission-control"];
  authorityPairs: readonly [InternalProductionBaselineServiceRestartAuthorityPairV1, InternalProductionBaselineServiceRestartAuthorityPairV1, InternalProductionBaselineServiceRestartAuthorityPairV1];
  orderedAdvanceHashes: readonly [Sha256V1, Sha256V1, Sha256V1];
  finalRuntimeSourceProjectionHash: Sha256V1;
  finalCompleteZeroOwnerCensusHash: Sha256V1;
  sequenceRef: CanonicalRef;
  sequenceHash: Sha256V1;
}>;

type SequenceStatusCommonV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-restart-sequence-status.v1";
  intentKind: InternalProductionBaselineRestartSequenceIntentKindV1;
  statusRef: string;
  statusHash: string;
}>;
export type InternalProductionBaselineRestartSequenceStatusV1 = SequenceStatusCommonV1 & (
  | Readonly<{ state: "absent"; sequenceIntentHash: null; migrationReceiptRef: null; migrationReceiptHash: null; migrationSchemaProjectionHash: null; activeOrdinal: null; refusalCode: null; sequenceRef: null; sequenceHash: null }>
  | Readonly<{ state: "in_progress" | "blocked"; sequenceIntentHash: string; migrationReceiptRef: string; migrationReceiptHash: string; migrationSchemaProjectionHash: string; activeOrdinal: 0 | 1 | 2; refusalCode: null; sequenceRef: null; sequenceHash: null }>
  | Readonly<{ state: "retired"; sequenceIntentHash: null; migrationReceiptRef: string; migrationReceiptHash: string; migrationSchemaProjectionHash: string; activeOrdinal: null; refusalCode: "BASELINE_RESTART_AUTHORITY_RETIRED"; retirementRef: string; retirementHash: string; sequenceRef: null; sequenceHash: null }>
  | Readonly<{ state: "completed"; sequenceIntentHash: string; migrationReceiptRef: string; migrationReceiptHash: string; migrationSchemaProjectionHash: string; activeOrdinal: null; refusalCode: null; sequenceRef: string; sequenceHash: string }>
);

const SHA256 = /^[a-f0-9]{64}$/;
const REF = /^setfarm:\/\/internal-production\/[a-z0-9-]+\/sha256\/[a-f0-9]{64}$/;
const INTENTS = new Set<InternalProductionBaselineRestartSequenceIntentKindV1>(["live-rebind", "d-startup-hook-load", "documentation-rollback"]);
const SERVICES = Object.freeze([
  Object.freeze({ service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1" }),
  Object.freeze({ service: "setfarm-dashboard", actionId: "a-restart-service-setfarm-dashboard-v1" }),
  Object.freeze({ service: "mission-control", actionId: "a-restart-service-mission-control-v1" }),
] as const);
const MIGRATION_RECEIPT_PREFIX = "setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/";
const SEQUENCE_STATUS_PREFIX = "setfarm://internal-production/baseline-restart-sequence-status/sha256/";
const MIGRATION_IMPLEMENTATION = "src/db/bootstrap-main-claim-handoff-v1-migration.ts";
const MIGRATION_ORDERED_STATEMENTS_HASH = "ccfcfdb6ed9e9d87add9e28394b2e67bf9ed55347841fe0529cdde4d6a5b34c9";
const MIGRATION_NAMED_DIGEST_ENTRY_HASH = "81d9164ca0f2c0be1cece391fc654a854c28ccfce905b87c3ad680202f95557c";
const MIGRATION_DIGEST = "8cbaab0c47bf3639033442d2df9a1c15d421eb34adbab72fa82951712cafe4e2";
const MIGRATION_SCHEMA_PROJECTION_HASH = "9f44b6312ba62fb7b48da153e70fa7f19ce543dbeec500b9111d750847a7eed1";
const NORMAL_AUTHORIZATION_PREFIX = "setfarm://internal-production/baseline-service-restart-authorization/sha256/";
const NORMAL_RESTART_PREFIX = "setfarm://internal-production/baseline/service-restarts/";
const SEQUENCE_RECEIPT_PREFIX = "setfarm://internal-production/baseline/restart-sequences/";
const COMPLETE_ZERO_OWNER_CENSUS_KEYS_V1 = Object.freeze([
  "activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount",
  "ordinaryStartingCount", "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount", "stagedCaseCount", "fixtureAttemptCount",
  "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount", "fleetStageCount", "fleetInflightCount",
  "fleetPendingReviewCount", "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount",
  "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount", "ownedListenerCount", "ownedWorktreeCount",
  "dirtyWorktreeCount", "staleChildCount",
] as const);

function fail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_BASELINE_RESTART_SEQUENCE_INVALID:${message}`);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))).map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sequenceStatusV1<T extends Readonly<Record<string, unknown>>>(body: T): InternalProductionBaselineRestartSequenceStatusV1 {
  const projection = Object.freeze({ schema: "setfarm.internal-production-baseline-restart-sequence-status.v1", ...body });
  const statusHash = sha256(canonical(projection));
  return recursivelyFreeze({ ...projection, statusRef: `${SEQUENCE_STATUS_PREFIX}${statusHash}`, statusHash }) as unknown as InternalProductionBaselineRestartSequenceStatusV1;
}

function recursivelyFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const member of Object.values(value as Record<string, unknown>)) recursivelyFreeze(member);
    Object.freeze(value);
  }
  return value;
}

function repositoryRoot(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const source = path.dirname(current);
  if (!new Set(["src", "dist"]).has(path.basename(source))) fail("module root is invalid");
  return path.dirname(source);
}

function rootPath(): string {
  return path.join(repositoryRoot(), "data/internal-production-baseline/baseline-service-restart-sequence-v1");
}

function exactInput(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || JSON.stringify(Object.keys(value)) !== JSON.stringify(keys)) fail(`${label} shape is invalid`);
  return value as Record<string, unknown>;
}

function exactRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string") || JSON.stringify(Object.keys(value)) !== JSON.stringify(keys)) fail(`${label} shape is invalid`);
  return value as Record<string, unknown>;
}

function intentFrom(input: unknown): InternalProductionBaselineRestartSequenceIntentKindV1 {
  const body = exactInput(input, ["intentKind"], "intent input");
  if (typeof body.intentKind !== "string" || !INTENTS.has(body.intentKind as InternalProductionBaselineRestartSequenceIntentKindV1)) fail("intent is invalid");
  return body.intentKind as InternalProductionBaselineRestartSequenceIntentKindV1;
}

function pair(value: unknown, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, string>> {
  const body = exactInput(value, [refKey, hashKey], `${refKey} pair`);
  if (typeof body[refKey] !== "string" || typeof body[hashKey] !== "string" || !SHA256.test(body[hashKey] as string) || body[refKey] !== `${prefix}${body[hashKey]}`) fail(`${refKey} pair is invalid`);
  return Object.freeze(body as Record<string, string>);
}

function storedPair(value: unknown, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, string>> {
  const ordered = [refKey, hashKey].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const body = exactInput(value, ordered, `${refKey} stored pair`);
  if (typeof body[refKey] !== "string" || typeof body[hashKey] !== "string" || !SHA256.test(body[hashKey] as string) || body[refKey] !== `${prefix}${body[hashKey]}`) fail(`${refKey} stored pair is invalid`);
  return Object.freeze(body as Record<string, string>);
}

type DirectoryGuardV1 = Readonly<{ assertStable: () => void; close: () => void }>;

function authenticateDirectoryChain(directory: string): DirectoryGuardV1 {
  const root = path.resolve(repositoryRoot());
  const target = path.resolve(directory);
  const relative = path.relative(root, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("store escaped repository");
  const paths = [root, ...relative.split(path.sep).map((_, index, members) => path.join(root, ...members.slice(0, index + 1)))];
  const descriptors: number[] = [];
  const identities: Array<ReturnType<typeof fstatSync>> = [];
  let closed = false;
  const assertStable = (): void => {
    if (closed) fail("store directory guard is closed");
    for (const [index, current] of paths.entries()) {
      const held = identities[index]!;
      const descriptorStats = fstatSync(descriptors[index]!, { bigint: true });
      const atPath = lstatSync(current, { bigint: true });
      if (!descriptorStats.isDirectory() || atPath.isSymbolicLink() || descriptorStats.dev !== held.dev || descriptorStats.ino !== held.ino || descriptorStats.mode !== held.mode || atPath.dev !== held.dev || atPath.ino !== held.ino || atPath.mode !== held.mode) fail("store directory changed while authenticated");
    }
  };
  try {
    for (const [index, current] of paths.entries()) {
      const before = lstatSync(current, { bigint: true });
      const descriptor = openSync(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      descriptors.push(descriptor);
      const held = fstatSync(descriptor, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink() || !held.isDirectory() || before.dev !== held.dev || before.ino !== held.ino || before.mode !== held.mode || before.nlink !== held.nlink || held.nlink < 1n || (index > 0 && (held.mode & 0o7777n) !== 0o700n) || (index > 0 && held.dev !== identities[0]!.dev)) fail("store directory identity is invalid");
      identities.push(held);
    }
    assertStable();
    return Object.freeze({
      assertStable,
      close: () => {
        if (closed) fail("store directory guard is already closed");
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

function ensureDirectory(directory: string): DirectoryGuardV1 {
  const root = path.resolve(repositoryRoot());
  const target = path.resolve(directory);
  const relative = path.relative(root, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("store escaped repository");
  let current = root;
  for (const segment of relative.split(path.sep)) {
    const parent = current === root ? null : authenticateDirectoryChain(current);
    current = path.join(current, segment);
    try {
      parent?.assertStable();
      try { mkdirSync(current, { mode: 0o700 }); }
      catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error; }
      parent?.assertStable();
    } finally { parent?.close(); }
    const created = authenticateDirectoryChain(current);
    created.close();
  }
  return authenticateDirectoryChain(target);
}

function fsyncParent(file: string): void {
  const descriptor = openSync(path.dirname(file), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function publish(file: string, value: unknown): void {
  const guard = ensureDirectory(path.dirname(file));
  const bytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  try {
    guard.assertStable();
    const directory = path.dirname(file);
    const basename = path.basename(file);
    const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const candidates = readdirSync(directory).filter((name) => name.startsWith(`.${basename}.`));
    if (candidates.length > 1 || candidates.some((name) => !new RegExp(`^\\.${escaped}\\.[a-f0-9]{32}\\.tmp$`).test(name))) fail("publication recovery inventory is invalid");
    let temporary: string;
    if (candidates.length === 1) {
      temporary = path.join(directory, candidates[0]!);
      const descriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const stats = fstatSync(descriptor, { bigint: true });
        if (!stats.isFile() || stats.nlink < 1n || stats.nlink > 2n || (stats.mode & 0o7777n) !== 0o600n || !readFileSync(descriptor).equals(bytes)) fail("publication recovery temporary differs");
      } finally { closeSync(descriptor); }
    } else {
      temporary = path.join(directory, `.${basename}.${randomBytes(16).toString("hex")}.tmp`);
      const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
    }
    try { linkSync(temporary, file); }
    catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error; }
    const finalDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const temporaryDescriptor = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const finalStats = fstatSync(finalDescriptor, { bigint: true });
      const temporaryStats = fstatSync(temporaryDescriptor, { bigint: true });
      const finalBytes = readFileSync(finalDescriptor);
      const temporaryBytes = readFileSync(temporaryDescriptor);
      const linked = finalStats.dev === temporaryStats.dev && finalStats.ino === temporaryStats.ino && finalStats.nlink === 2n && temporaryStats.nlink === 2n;
      const collision = finalStats.dev === temporaryStats.dev && finalStats.ino !== temporaryStats.ino && finalStats.nlink === 1n && temporaryStats.nlink === 1n && finalBytes.equals(temporaryBytes);
      if (!finalStats.isFile() || !temporaryStats.isFile() || (finalStats.mode & 0o7777n) !== 0o600n || (temporaryStats.mode & 0o7777n) !== 0o600n || !finalBytes.equals(bytes) || !temporaryBytes.equals(bytes) || (!linked && !collision)) fail("immutable publication collision is crossed");
      const finalPathStats = lstatSync(file, { bigint: true });
      const temporaryPathStats = lstatSync(temporary, { bigint: true });
      if (finalPathStats.dev !== finalStats.dev || finalPathStats.ino !== finalStats.ino || temporaryPathStats.dev !== temporaryStats.dev || temporaryPathStats.ino !== temporaryStats.ino) fail("publication changed before recovery cleanup");
      unlinkSync(temporary);
      fsyncParent(file);
    } finally { closeSync(temporaryDescriptor); closeSync(finalDescriptor); }
    const verifiedDescriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stats = fstatSync(verifiedDescriptor, { bigint: true });
      const atPath = lstatSync(file, { bigint: true });
      if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n || (stats.mode & 0o7777n) !== 0o600n || stats.dev !== atPath.dev || stats.ino !== atPath.ino || !readFileSync(verifiedDescriptor).equals(bytes)) fail("immutable publication differs");
    } finally { closeSync(verifiedDescriptor); }
    guard.assertStable();
  } finally {
    try { guard.assertStable(); } finally { guard.close(); }
  }
}

function read(file: string, label: string): Record<string, unknown> {
  const guard = authenticateDirectoryChain(path.dirname(file));
  try {
    guard.assertStable();
    const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(descriptor, { bigint: true });
      const atPath = lstatSync(file, { bigint: true });
      const bytes = readFileSync(descriptor);
      const after = fstatSync(descriptor, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || (before.mode & 0o7777n) !== 0o600n || before.dev !== atPath.dev || before.ino !== atPath.ino || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || BigInt(bytes.length) !== before.size || bytes.length < 1 || bytes.length > 1_048_576) fail(`${label} identity is invalid`);
      let value: unknown;
      try { value = JSON.parse(bytes.toString("utf8")); } catch { return fail(`${label} is not JSON`); }
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || `${canonical(value)}\n` !== bytes.toString("utf8")) fail(`${label} is not canonical`);
      guard.assertStable();
      return value as Record<string, unknown>;
    } finally { closeSync(descriptor); }
  } finally {
    try { guard.assertStable(); } finally { guard.close(); }
  }
}

function optionalRead(file: string, label: string): Record<string, unknown> | null {
  try { return read(file, label); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function intentHash(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1): string {
  return sha256(canonical({ schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind }));
}

function intentDirectory(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1): string {
  return path.join(rootPath(), "intents", intentHash(intentKind));
}

function locatorPath(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1, ordinal: number): string {
  return path.join(intentDirectory(intentKind), `${String(ordinal).padStart(2, "0")}-service-advance.pair.json`);
}

function authorizationLocatorPath(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1, ordinal: number): string {
  return path.join(intentDirectory(intentKind), `${String(ordinal).padStart(2, "0")}-service-authorization.pair.json`);
}

function receiptLocatorPath(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1): string {
  return path.join(intentDirectory(intentKind), "03-sequence-receipt.pair.json");
}

function blockedLocatorPath(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1, ordinal: number): string {
  return path.join(intentDirectory(intentKind), `${String(ordinal).padStart(2, "0")}-blocked.pair.json`);
}

function resolveBlocked(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1, ordinal: number): Readonly<Record<string, unknown>> | null {
  const locator = optionalRead(blockedLocatorPath(intentKind, ordinal), `blocked locator ${ordinal}`);
  if (!locator) return null;
  const expected = storedPair(locator, "blockedRef", "blockedHash", "setfarm://internal-production/baseline-restart-sequence-blocked/sha256/");
  const file = path.join(rootPath(), "blocked", "sha256", expected.blockedHash!.slice(0, 2), `${expected.blockedHash}.json`);
  const blocked = read(file, `blocked ${ordinal}`);
  const projection = { ...blocked };
  delete projection.blockedRef;
  delete projection.blockedHash;
  if (blocked.schema !== "setfarm.internal-production-baseline-restart-sequence-blocked.v1" || blocked.intentKind !== intentKind || blocked.ordinal !== ordinal || blocked.reason !== "HELPER_DISPATCH_SETTLEMENT_UNKNOWN" || blocked.blockedRef !== expected.blockedRef || blocked.blockedHash !== expected.blockedHash || sha256(canonical(projection)) !== expected.blockedHash || typeof blocked.authorizationRef !== "string" || typeof blocked.authorizationHash !== "string" || !SHA256.test(blocked.authorizationHash) || blocked.authorizationRef !== `${NORMAL_AUTHORIZATION_PREFIX}${blocked.authorizationHash}`) fail("blocked sequence record is crossed");
  return recursivelyFreeze(blocked);
}

function headerLocatorPath(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1): string {
  return path.join(intentDirectory(intentKind), "sequence-intent.pair.json");
}

function resolveHeader(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1): Readonly<Record<string, unknown>> | null {
  const locator = optionalRead(headerLocatorPath(intentKind), "sequence intent locator");
  if (!locator) return null;
  const expected = storedPair(locator, "sequenceIntentRef", "sequenceIntentHash", "setfarm://internal-production/baseline-restart-sequence-intent/sha256/");
  const file = path.join(rootPath(), "sequence-intents", "sha256", expected.sequenceIntentHash!.slice(0, 2), `${expected.sequenceIntentHash}.json`);
  const header = read(file, "sequence intent");
  const projection = { ...header };
  delete projection.sequenceIntentRef;
  delete projection.sequenceIntentHash;
  if (header.schema !== "setfarm.internal-production-baseline-restart-sequence-intent.v1" || header.intentKind !== intentKind || header.sequenceIntentRef !== expected.sequenceIntentRef || header.sequenceIntentHash !== expected.sequenceIntentHash || sha256(canonical(projection)) !== expected.sequenceIntentHash || typeof header.migrationReceiptRef !== "string" || !REF.test(header.migrationReceiptRef) || typeof header.migrationReceiptHash !== "string" || !SHA256.test(header.migrationReceiptHash) || !header.migrationReceiptRef.endsWith(header.migrationReceiptHash) || typeof header.migrationSchemaProjectionHash !== "string" || !SHA256.test(header.migrationSchemaProjectionHash) || typeof header.initialRuntimeSourceProjectionHash !== "string" || !SHA256.test(header.initialRuntimeSourceProjectionHash) || canonical(header.orderedServiceActions) !== canonical(SERVICES)) fail("sequence intent is crossed");
  return recursivelyFreeze(header);
}

async function sequenceTransitionPortsV1(): Promise<Readonly<{
  acquire: () => Promise<unknown>;
  release: (lease: unknown) => Promise<void>;
  observeStatus: () => Promise<InternalProductionBaselineRestartSequenceStatusV1 | Readonly<Record<string, unknown>>>;
}>> {
  const retirement = await import("./baseline-restart-authority-retirement-v1.js") as unknown as Record<string, unknown>;
  const acquire = retirement.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  const release = retirement.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  const observeStatus = retirement.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1;
  if (typeof acquire !== "function" || typeof release !== "function" || typeof observeStatus !== "function") fail("sequence transition lease ports are unavailable");
  return Object.freeze({ acquire: acquire as () => Promise<unknown>, release: release as (lease: unknown) => Promise<void>, observeStatus: observeStatus as () => Promise<Readonly<Record<string, unknown>>> });
}

async function observeCutoverStatusV1(): Promise<Readonly<Record<string, unknown>>> {
  return (await sequenceTransitionPortsV1()).observeStatus() as Promise<Readonly<Record<string, unknown>>>;
}

type TerminalMigrationReceiptV1 = Readonly<Record<string, unknown>> & Readonly<{
  migrationReceiptRef: string;
  migrationReceiptHash: string;
  migrationSourceSha: string;
  schemaProjectionHash: string;
}>;

function gitBlobHash(bytes: Buffer): string {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function assertCurrentSourceDescendsFromMigration(source: Readonly<Record<string, unknown>>, migrationSourceSha: string): void {
  const currentSha = source.sha ?? source.sourceSha;
  if (typeof currentSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(currentSha) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(migrationSourceSha)) fail("migration/current source identity is invalid");
  if (currentSha === migrationSourceSha) return;
  const result = spawnSync("/usr/bin/git", ["merge-base", "--is-ancestor", migrationSourceSha, currentSha], {
    cwd: repositoryRoot(),
    env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" }),
    shell: false,
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 65_536,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.signal || result.status !== 0 || result.stdout !== "" || result.stderr !== "") fail("current source does not descend from the terminal migration source");
}

async function resolveExactTerminalMigrationReceiptV1(): Promise<TerminalMigrationReceiptV1> {
  const receiptModule = await import("./baseline-post-handoff-receipt-v1.js") as Readonly<Record<string, unknown>>;
  const observe = receiptModule.observeInternalProductionPreManifestMigration32AuthorizationStatusV1;
  const resolve = receiptModule.resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1;
  if (typeof observe !== "function" || typeof resolve !== "function") fail("terminal bootstrap-handoff migration receipt authority is unavailable");
  const status = await (observe as () => Promise<unknown>)();
  const statusKeys = ["schema", "state", "currentEntryOperation", "authorization", "consumption", "migrationReceipt", "refusalCode", "statusRef", "statusHash"];
  const exactStatus = exactRecord(status, statusKeys, "terminal migration status");
  if (exactStatus.schema !== "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1" || exactStatus.state !== "terminal" || exactStatus.refusalCode !== null) fail("terminal bootstrap-handoff migration receipt is unavailable");
  const migrationPair = pair(exactStatus.migrationReceipt, "migrationReceiptRef", "migrationReceiptHash", MIGRATION_RECEIPT_PREFIX);
  const statusProjection = { ...exactStatus };
  delete statusProjection.statusRef;
  delete statusProjection.statusHash;
  if (typeof exactStatus.statusHash !== "string" || !SHA256.test(exactStatus.statusHash) || exactStatus.statusRef !== `setfarm://internal-production/pre-manifest-migration-32-authorization-status/sha256/${exactStatus.statusHash}` || sha256(canonical(statusProjection)) !== exactStatus.statusHash) fail("terminal migration status pair is crossed");
  const resolved = await (resolve as (input: Readonly<Record<string, string>>) => Promise<unknown>)(migrationPair);
  const receiptKeys = [
    "schema", "migrationId", "predecessorAuthorityV3Migration31AuditRef", "predecessorAuthorityV3Migration31AuditHash",
    "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "migrationSourceSha", "migrationImplementationBlobHash",
    "orderedStatementsHash", "namedMigrationDigestEntryHash", "migrationDigest", "schemaProjectionHash", "currentEntryOperationRef", "currentEntryOperationHash",
    "preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", "preSchemaSpawnerStartupTokenRef", "preSchemaSpawnerStartupTokenHash",
    "preSchemaSpawnerRestartAuthorityRef", "preSchemaSpawnerRestartAuthorityHash", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash",
    "replacementProcessObservationRef", "replacementProcessObservationHash", "preSchemaSpawnerSealedAdmissionRef", "preSchemaSpawnerSealedAdmissionHash",
    "postPredecessorTerminationLegacyZeroOwnerObservationRef", "postPredecessorTerminationLegacyZeroOwnerObservationHash", "freshLegacyZeroOwnerObservationRef",
    "freshLegacyZeroOwnerObservationHash", "preManifestMigration32AuthorizationRef", "preManifestMigration32AuthorizationHash",
    "preManifestMigration32AuthorizationConsumptionRef", "preManifestMigration32AuthorizationConsumptionHash", "planStatus", "applyStatus", "verifyStatus",
    "bootstrapHandoffOperationTablePresent", "bootstrapHandoffOperationIdUnique", "bootstrapHandoffClaimIdUnique", "terminalReceiptPairColumnsPresent",
    "ownerReservationSidecarPresent", "ownerAdmissionHeadPresent", "migrationReceiptRef", "migrationReceiptHash",
  ];
  const receipt = exactRecord(resolved, receiptKeys, "terminal migration receipt");
  const projection = { ...receipt };
  delete projection.migrationReceiptRef;
  delete projection.migrationReceiptHash;
  if (receipt.schema !== "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1" || receipt.migrationId !== "contract-spine-bootstrap-main-claim-handoff-v1" || receipt.migrationReceiptRef !== migrationPair.migrationReceiptRef || receipt.migrationReceiptHash !== migrationPair.migrationReceiptHash || sha256(canonical(projection)) !== receipt.migrationReceiptHash || receipt.planStatus !== "exact-pending-migration" || receipt.applyStatus !== "applied" || receipt.verifyStatus !== "verified" || receipt.bootstrapHandoffOperationTablePresent !== true || receipt.bootstrapHandoffOperationIdUnique !== true || receipt.bootstrapHandoffClaimIdUnique !== true || receipt.terminalReceiptPairColumnsPresent !== true || receipt.ownerReservationSidecarPresent !== true || receipt.ownerAdmissionHeadPresent !== true || receipt.orderedStatementsHash !== MIGRATION_ORDERED_STATEMENTS_HASH || receipt.namedMigrationDigestEntryHash !== MIGRATION_NAMED_DIGEST_ENTRY_HASH || receipt.migrationDigest !== MIGRATION_DIGEST || receipt.schemaProjectionHash !== MIGRATION_SCHEMA_PROJECTION_HASH) fail("terminal migration receipt implementation/schema authority is crossed");
  const implementation = readFileSync(path.join(repositoryRoot(), MIGRATION_IMPLEMENTATION));
  if (receipt.migrationImplementationBlobHash !== gitBlobHash(implementation)) fail("terminal migration implementation blob is crossed");
  for (const [key, value] of Object.entries(receipt)) {
    if (key.endsWith("Hash") && typeof value === "string" && !SHA256.test(value) && key !== "migrationImplementationBlobHash") fail(`terminal migration receipt ${key} is invalid`);
    if (key.endsWith("Ref") && (typeof value !== "string" || !REF.test(value))) fail(`terminal migration receipt ${key} is invalid`);
  }
  const currentSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1() as unknown as Readonly<Record<string, unknown>>;
  assertCurrentSourceDescendsFromMigration(currentSource, receipt.migrationSourceSha as string);
  return recursivelyFreeze(receipt as TerminalMigrationReceiptV1);
}

async function assertReviewedDStartupHookLoadGateV1(): Promise<void> {
  const sourceModule = await import("./baseline-post-handoff-receipt-v1.js") as unknown as Readonly<Record<string, unknown>>;
  const observeSourceGate = sourceModule.observeInternalProductionReviewedDSourceBuildGateV1;
  if (typeof observeSourceGate !== "function") fail("reviewed D Setfarm/Mission Control source-build gate is unavailable");
  const sourceGate = exactInput(await (observeSourceGate as () => Promise<unknown>)(), ["schema", "reviewed", "setfarmSourceSha", "missionControlSourceSha", "setfarmBuildHash", "missionControlBuildHash", "recoveryProducerManifestActivationRef", "recoveryProducerManifestActivationHash", "missionControlHandoffRef", "missionControlHandoffHash"], "reviewed D source-build gate");
  if (sourceGate.schema !== "setfarm.internal-production-reviewed-d-source-build-gate.v1" || sourceGate.reviewed !== true) fail("reviewed D Setfarm/Mission Control source-build gate is unavailable");
  for (const key of ["setfarmSourceSha", "missionControlSourceSha"] as const) if (typeof sourceGate[key] !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceGate[key] as string)) fail(`reviewed D ${key} is invalid`);
  for (const key of ["setfarmBuildHash", "missionControlBuildHash", "recoveryProducerManifestActivationHash", "missionControlHandoffHash"] as const) if (typeof sourceGate[key] !== "string" || !SHA256.test(sourceGate[key] as string)) fail(`reviewed D ${key} is invalid`);
  if (sourceGate.recoveryProducerManifestActivationRef !== `setfarm://internal-production/recovery-owner-producer-manifest-activation/sha256/${sourceGate.recoveryProducerManifestActivationHash}` || sourceGate.missionControlHandoffRef !== `setfarm://internal-production/recovery-mission-control-source-handoff/sha256/${sourceGate.missionControlHandoffHash}`) fail("reviewed D activation/handoff pair is crossed");
  const currentSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1() as unknown as Readonly<Record<string, unknown>>;
  if ((currentSource.sha ?? currentSource.sourceSha) !== sourceGate.setfarmSourceSha || (currentSource.buildHash ?? currentSource.cleanSetfarmBuildHash) !== sourceGate.setfarmBuildHash) fail("reviewed D Setfarm source/build is not current");
  const loaded = await observeRuntimeProjectionV1();
  if (loaded.setfarmSha !== sourceGate.setfarmSourceSha || loaded.setfarmBuildInfoHash !== sourceGate.setfarmBuildHash || loaded.missionControlSha !== sourceGate.missionControlSourceSha || loaded.missionControlBuildHash !== sourceGate.missionControlBuildHash) fail("reviewed D Setfarm/Mission Control source-build gate is not loaded");
}

type RuntimeProjectionV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-runtime-source-projection.v1";
  setfarmSha: string;
  missionControlSha: string;
  setfarmBuildInfoHash: string;
  spawnerBuildHash: string;
  spawnerServiceIdentityHash: string;
  dashboardBuildHash: string;
  dashboardServiceIdentityHash: string;
  missionControlBuildHash: string;
  missionControlServiceIdentityHash: string;
  projectionHash: string;
}>;

function validateRuntimeProjectionV1(value: unknown, label: string): RuntimeProjectionV1 {
  const projection = exactInput(value, ["schema", "setfarmSha", "missionControlSha", "setfarmBuildInfoHash", "spawnerBuildHash", "spawnerServiceIdentityHash", "dashboardBuildHash", "dashboardServiceIdentityHash", "missionControlBuildHash", "missionControlServiceIdentityHash", "projectionHash"], label);
  if (projection.schema !== "setfarm.internal-production-baseline-runtime-source-projection.v1") fail(`${label} schema is invalid`);
  for (const key of ["setfarmSha", "missionControlSha"] as const) if (typeof projection[key] !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(projection[key] as string)) fail(`${label} ${key} is invalid`);
  for (const key of ["setfarmBuildInfoHash", "spawnerBuildHash", "spawnerServiceIdentityHash", "dashboardBuildHash", "dashboardServiceIdentityHash", "missionControlBuildHash", "missionControlServiceIdentityHash", "projectionHash"] as const) if (typeof projection[key] !== "string" || !SHA256.test(projection[key] as string)) fail(`${label} ${key} is invalid`);
  const body = { ...projection }; delete body.projectionHash;
  if (sha256(canonical(body)) !== projection.projectionHash) fail(`${label} hash is crossed`);
  return recursivelyFreeze(projection as unknown as RuntimeProjectionV1);
}

async function observeRuntimeProjectionV1(): Promise<RuntimeProjectionV1> {
  const receiptModule = await import("./baseline-post-handoff-receipt-v1.js") as Readonly<Record<string, unknown>>;
  const observeCensus = receiptModule.observeInternalProductionServiceCensusV1;
  if (typeof observeCensus !== "function") fail("runtime source projection observer is unavailable");
  const census = exactInput(await (observeCensus as () => Promise<unknown>)(), ["schema", "spawner", "dashboard", "missionControl", "openClaw", "censusHash"], "runtime service census");
  if (census.schema !== "setfarm.internal-production-service-census.v1" || typeof census.censusHash !== "string" || !SHA256.test(census.censusHash)) fail("runtime service census is invalid");
  const service = (value: unknown, label: string): Readonly<Record<string, unknown>> => {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} service authority is invalid`);
    const record = value as Readonly<Record<string, unknown>>;
    for (const key of ["loadedSourceSha", "loadedBuildHash", "serviceIdentityHash"] as const) if (typeof record[key] !== "string") fail(`${label} service authority is incomplete`);
    return record;
  };
  const spawner = service(census.spawner, "spawner");
  const dashboard = service(census.dashboard, "dashboard");
  const missionControl = service(census.missionControl, "mission-control");
  const clean = observeCurrentInternalProductionCleanSetfarmSourceBuildV1() as unknown as Readonly<Record<string, unknown>>;
  const setfarmSha = clean.sha ?? clean.sourceSha;
  const setfarmBuildInfoHash = clean.buildHash ?? clean.cleanSetfarmBuildHash;
  if (spawner.loadedSourceSha !== setfarmSha || dashboard.loadedSourceSha !== setfarmSha || spawner.loadedBuildHash !== setfarmBuildInfoHash || dashboard.loadedBuildHash !== setfarmBuildInfoHash) fail("loaded Setfarm source/build projection is crossed");
  const body = { schema: "setfarm.internal-production-baseline-runtime-source-projection.v1" as const, setfarmSha, missionControlSha: missionControl.loadedSourceSha, setfarmBuildInfoHash, spawnerBuildHash: spawner.loadedBuildHash, spawnerServiceIdentityHash: spawner.serviceIdentityHash, dashboardBuildHash: dashboard.loadedBuildHash, dashboardServiceIdentityHash: dashboard.serviceIdentityHash, missionControlBuildHash: missionControl.loadedBuildHash, missionControlServiceIdentityHash: missionControl.serviceIdentityHash };
  return validateRuntimeProjectionV1({ ...body, projectionHash: sha256(canonical(body)) }, "observed runtime source projection");
}

type NormalRestartPortsV1 = Readonly<{
  prepare: (input: Readonly<{ service: string }>) => Promise<unknown>;
  resolveAuthorization: (input: Readonly<{ authorizationRef: string; authorizationHash: string }>) => Promise<unknown>;
  restart: (input: Readonly<{ authorizationRef: string; authorizationHash: string }>) => Promise<unknown>;
  resolveAuthority: (input: Readonly<{ receiptRef: string; receiptHash: string }>) => Promise<unknown>;
}>;

async function normalRestartPortsV1(): Promise<NormalRestartPortsV1> {
  const module = await import("./baseline-post-handoff-receipt-v1.js") as Readonly<Record<string, unknown>>;
  const prepare = module.prepareInternalProductionBaselineServiceRestartV1;
  const resolveAuthorization = module.resolveInternalProductionBaselineServiceRestartAuthorizationV1;
  const restart = module.restartInternalProductionBaselineServiceV1;
  const resolveAuthority = module.resolveInternalProductionBaselineServiceRestartAuthorityV1;
  const missing = [["prepare", prepare], ["resolve-authorization", resolveAuthorization], ["restart", restart], ["resolve-authority", resolveAuthority]].filter(([, value]) => typeof value !== "function").map(([name]) => name);
  if (missing.length > 0) fail(`normal baseline restart composite authority is unavailable:${missing.join(",")}`);
  return Object.freeze({ prepare, resolveAuthorization, restart, resolveAuthority } as NormalRestartPortsV1);
}

function validateCompleteZeroOwnerCensusV1(value: unknown, label: string): Readonly<Record<string, unknown>> {
  const observation = exactInput(value, ["schema", "census", "ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "activeProducerManifestSetActivationRef", "activeProducerManifestSetActivationHash", "activeProducerManifestSetHash", "reservationIdentitySetHash", "ownerIdentitySetHash", "observationRef", "observationHash"], label);
  const census = exactInput(observation.census, COMPLETE_ZERO_OWNER_CENSUS_KEYS_V1, "complete zero-owner census");
  if (observation.schema !== "setfarm.internal-production-complete-zero-owner-census-observation.v1" || Object.values(census).some((count) => count !== 0)) fail("complete zero-owner census is nonzero");
  for (const key of ["ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "activeProducerManifestSetActivationHash", "activeProducerManifestSetHash", "reservationIdentitySetHash", "ownerIdentitySetHash", "observationHash"] as const) if (typeof observation[key] !== "string" || !SHA256.test(observation[key] as string)) fail(`complete zero-owner ${key} is invalid`);
  if (observation.activeProducerManifestSetActivationRef !== `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${observation.activeProducerManifestSetActivationHash}` || observation.observationRef !== `setfarm://internal-production/complete-zero-owner-census-observation/sha256/${observation.observationHash}`) fail("complete zero-owner observation pair is crossed");
  const projection = { ...observation }; delete projection.observationRef; delete projection.observationHash;
  if (sha256(canonical(projection)) !== observation.observationHash) fail("complete zero-owner observation hash is crossed");
  return recursivelyFreeze(observation);
}

async function observeCompleteZeroOwnerCensusV1(): Promise<Readonly<Record<string, unknown>>> {
  const module = await import("./baseline-post-handoff-receipt-v1.js") as Readonly<Record<string, unknown>>;
  const observe = module.observeCompleteInternalProductionZeroOwnerCensusV1;
  if (typeof observe !== "function") fail("complete zero-owner census observer is unavailable");
  return validateCompleteZeroOwnerCensusV1(await (observe as () => Promise<unknown>)(), "complete zero-owner census observation");
}

async function resolveCompleteZeroOwnerCensusV1(observationHash: string): Promise<Readonly<Record<string, unknown>>> {
  const module = await import("./baseline-post-handoff-receipt-v1.js") as Readonly<Record<string, unknown>>;
  const resolve = module.resolveInternalProductionCompleteZeroOwnerCensusObservationV1;
  if (typeof resolve !== "function") fail("complete zero-owner census resolver is unavailable");
  const observationRef = `setfarm://internal-production/complete-zero-owner-census-observation/sha256/${observationHash}`;
  const resolved = validateCompleteZeroOwnerCensusV1(await (resolve as (input: Readonly<{ observationRef: string; observationHash: string }>) => Promise<unknown>)({ observationRef, observationHash }), "resolved complete zero-owner census observation");
  if (resolved.observationRef !== observationRef || resolved.observationHash !== observationHash) fail("resolved complete zero-owner census pair is crossed");
  return resolved;
}

function validateAuthorizationV1(value: unknown, pairValue: Readonly<{ authorizationRef: string; authorizationHash: string }>, service: string, migrationReceipt: Readonly<{ migrationReceiptRef: string; migrationReceiptHash: string }>, preparedProjectionHash: string): Readonly<Record<string, unknown>> {
  const authorization = exactInput(value, ["schema", "service", "migrationReceiptRef", "migrationReceiptHash", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "completeZeroOwnerCensusHash", "preparedRuntimeSourceProjectionHash", "authorizationRef", "authorizationHash"], "normal restart authorization");
  const body = { ...authorization }; delete body.authorizationRef; delete body.authorizationHash;
  if (authorization.schema !== "setfarm.internal-production-baseline-service-restart-authorization.v1" || authorization.service !== service) fail("normal restart authorization service is crossed");
  if (authorization.migrationReceiptRef !== migrationReceipt.migrationReceiptRef || authorization.migrationReceiptHash !== migrationReceipt.migrationReceiptHash) fail("normal restart authorization migration is crossed");
  if (authorization.preparedRuntimeSourceProjectionHash !== preparedProjectionHash) fail("normal restart authorization runtime projection is crossed");
  if (authorization.authorizationRef !== pairValue.authorizationRef || authorization.authorizationHash !== pairValue.authorizationHash || sha256(canonical(body)) !== pairValue.authorizationHash) fail("normal restart authorization pair is crossed");
  if (typeof authorization.zeroOwnerGuardHash !== "string" || !SHA256.test(authorization.zeroOwnerGuardHash) || typeof authorization.completeZeroOwnerCensusHash !== "string" || !SHA256.test(authorization.completeZeroOwnerCensusHash) || typeof authorization.zeroOwnerGuardRef !== "string" || !authorization.zeroOwnerGuardRef.endsWith(authorization.zeroOwnerGuardHash)) fail("normal restart authorization zero-owner authority is crossed");
  return recursivelyFreeze(authorization);
}

function validateNormalRestartAuthorityV1(value: unknown, pairValue: Readonly<{ receiptRef: string; receiptHash: string }>, fixed: typeof SERVICES[number], migrationReceipt: Readonly<{ migrationReceiptRef: string; migrationReceiptHash: string }>): Readonly<Record<string, unknown>> {
  const authority = exactInput(value, ["schema", "service", "actionId", "operationId", "migrationReceiptRef", "migrationReceiptHash", "migrationSchemaProjectionHash", "before", "after", "postRuntimeSourceProjectionHash", "restart", "guardKind", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "cleanup", "receiptRef", "receiptHash"], "normal restart composite authority");
  const body = { ...authority }; delete body.receiptRef; delete body.receiptHash;
  if (authority.schema !== "setfarm.internal-production-baseline-service-restart-authority.v1" || authority.service !== fixed.service || authority.actionId !== fixed.actionId || authority.migrationReceiptRef !== migrationReceipt.migrationReceiptRef || authority.migrationReceiptHash !== migrationReceipt.migrationReceiptHash || authority.guardKind !== "complete-zero-owner" || authority.receiptRef !== pairValue.receiptRef || authority.receiptHash !== pairValue.receiptHash || pairValue.receiptRef !== `${NORMAL_RESTART_PREFIX}${pairValue.receiptHash}` || sha256(canonical(body)) !== pairValue.receiptHash || typeof authority.operationId !== "string" || !SHA256.test(authority.operationId as string) || typeof authority.migrationSchemaProjectionHash !== "string" || !SHA256.test(authority.migrationSchemaProjectionHash as string)) fail("normal restart composite authority is crossed");
  const before = validateRuntimeProjectionV1(authority.before, "normal restart before projection");
  const after = validateRuntimeProjectionV1(authority.after, "normal restart after projection");
  if (authority.postRuntimeSourceProjectionHash !== after.projectionHash || before.setfarmSha !== after.setfarmSha || before.missionControlSha !== after.missionControlSha || before.setfarmBuildInfoHash !== after.setfarmBuildInfoHash || before.spawnerBuildHash !== after.spawnerBuildHash || before.dashboardBuildHash !== after.dashboardBuildHash || before.missionControlBuildHash !== after.missionControlBuildHash) fail("normal restart source/build projection drifted");
  const identities = ["spawnerServiceIdentityHash", "dashboardServiceIdentityHash", "missionControlServiceIdentityHash"] as const;
  const changed = fixed.service === "setfarm-spawner" ? identities[0] : fixed.service === "setfarm-dashboard" ? identities[1] : identities[2];
  if (before[changed] === after[changed] || identities.some((key) => key !== changed && before[key] !== after[key])) fail("normal restart service identity transition is crossed");
  const restart = exactInput(authority.restart, ["disposition", "reservationHash", "operationHash", "outboxHash", "helperClaimHash", "helperProcessIdentityHash", "startupMarkerHash", "completionSettlementHash", "beforeGenerationHash", "afterGenerationHash", "beforeServiceAuthorityHash", "afterServiceAuthorityHash", "dispatchReceiptHash"], "normal restart physical authority");
  if (!new Set(["performed", "adopted"]).has(restart.disposition as string) || restart.beforeGenerationHash === restart.afterGenerationHash || restart.beforeServiceAuthorityHash === restart.afterServiceAuthorityHash) fail("normal restart physical transition is invalid");
  for (const [key, member] of Object.entries(restart)) if (key !== "disposition" && (typeof member !== "string" || !SHA256.test(member))) fail(`normal restart ${key} is invalid`);
  const cleanup = exactInput(authority.cleanup, ["guardConsumed", "restartSettled", "observedGlobalZero", "completeZeroOwnerCensusHash"], "normal restart cleanup");
  if (cleanup.guardConsumed !== true || cleanup.restartSettled !== true || cleanup.observedGlobalZero !== true || typeof cleanup.completeZeroOwnerCensusHash !== "string" || !SHA256.test(cleanup.completeZeroOwnerCensusHash)) fail("normal restart cleanup is invalid");
  if (typeof authority.zeroOwnerGuardHash !== "string" || !SHA256.test(authority.zeroOwnerGuardHash) || typeof authority.zeroOwnerGuardRef !== "string" || !authority.zeroOwnerGuardRef.endsWith(authority.zeroOwnerGuardHash)) fail("normal restart zero-owner authority is invalid");
  return recursivelyFreeze(authority);
}

async function resolveAdvance(intentKind: InternalProductionBaselineRestartSequenceIntentKindV1, ordinal: number): Promise<Readonly<Record<string, unknown>> | null> {
  const locator = optionalRead(locatorPath(intentKind, ordinal), `advance locator ${ordinal}`);
  if (!locator) return null;
  const exactLocator = storedPair(locator, "advanceRef", "advanceHash", "setfarm://internal-production/baseline-service-restart-advance/sha256/");
  const file = path.join(rootPath(), "advances", "sha256", exactLocator.advanceHash!.slice(0, 2), `${exactLocator.advanceHash}.json`);
  const advance = read(file, `advance ${ordinal}`);
  exactRecord(advance, ["schema", "intentKind", "sequenceIntentHash", "ordinal", "service", "actionId", "migrationReceiptRef", "migrationReceiptHash", "initialRuntimeSourceProjectionHash", "authorizationRef", "authorizationHash", "authorityRef", "authorityHash", "priorAdvanceHash", "beforeRuntimeSourceProjectionHash", "afterRuntimeSourceProjectionHash", "completeZeroOwnerCensusHash", "advanceRef", "advanceHash"].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))), `advance ${ordinal}`);
  const projection = { ...advance };
  delete projection.advanceRef;
  delete projection.advanceHash;
  if (advance.schema !== "setfarm.internal-production-baseline-service-restart-advance.v1" || advance.intentKind !== intentKind || advance.ordinal !== ordinal || advance.service !== SERVICES[ordinal]!.service || advance.actionId !== SERVICES[ordinal]!.actionId || sha256(canonical(projection)) !== exactLocator.advanceHash || advance.advanceRef !== exactLocator.advanceRef || advance.advanceHash !== exactLocator.advanceHash) fail("advance is crossed");
  const header = resolveHeader(intentKind);
  if (!header || advance.sequenceIntentHash !== header.sequenceIntentHash || advance.initialRuntimeSourceProjectionHash !== header.initialRuntimeSourceProjectionHash || advance.migrationReceiptRef !== header.migrationReceiptRef || advance.migrationReceiptHash !== header.migrationReceiptHash) fail("advance intent/header authority is crossed");
  if (ordinal === 0) {
    if (advance.priorAdvanceHash !== null || advance.beforeRuntimeSourceProjectionHash !== header.initialRuntimeSourceProjectionHash) fail("first advance predecessor is crossed");
  } else {
    const predecessor = await resolveAdvance(intentKind, ordinal - 1);
    if (!predecessor || advance.priorAdvanceHash !== predecessor.advanceHash || advance.beforeRuntimeSourceProjectionHash !== predecessor.afterRuntimeSourceProjectionHash) fail("advance predecessor chain is crossed");
  }
  const authorizationPair = pair({ authorizationRef: advance.authorizationRef, authorizationHash: advance.authorizationHash }, "authorizationRef", "authorizationHash", NORMAL_AUTHORIZATION_PREFIX) as Readonly<{ authorizationRef: string; authorizationHash: string }>;
  const persistedAuthorizationPair = optionalRead(authorizationLocatorPath(intentKind, ordinal), `authorization locator ${ordinal}`);
  if (!persistedAuthorizationPair || canonical(storedPair(persistedAuthorizationPair, "authorizationRef", "authorizationHash", NORMAL_AUTHORIZATION_PREFIX)) !== canonical(authorizationPair)) fail("advance authorization locator is crossed");
  const authorityPair = pair({ receiptRef: advance.authorityRef, receiptHash: advance.authorityHash }, "receiptRef", "receiptHash", NORMAL_RESTART_PREFIX) as Readonly<{ receiptRef: string; receiptHash: string }>;
  const ports = await normalRestartPortsV1();
  const authorization = validateAuthorizationV1(await ports.resolveAuthorization(authorizationPair), authorizationPair, SERVICES[ordinal]!.service, { migrationReceiptRef: advance.migrationReceiptRef as string, migrationReceiptHash: advance.migrationReceiptHash as string }, advance.beforeRuntimeSourceProjectionHash as string);
  const authority = validateNormalRestartAuthorityV1(await ports.resolveAuthority(authorityPair), authorityPair, SERVICES[ordinal]!, { migrationReceiptRef: advance.migrationReceiptRef as string, migrationReceiptHash: advance.migrationReceiptHash as string });
  const before = authority.before as RuntimeProjectionV1; const after = authority.after as RuntimeProjectionV1; const cleanup = authority.cleanup as Readonly<Record<string, unknown>>;
  if (authority.migrationSchemaProjectionHash !== header.migrationSchemaProjectionHash || authority.zeroOwnerGuardRef !== authorization.zeroOwnerGuardRef || authority.zeroOwnerGuardHash !== authorization.zeroOwnerGuardHash || cleanup.completeZeroOwnerCensusHash !== authorization.completeZeroOwnerCensusHash) fail("advance composite guard or migration authority is crossed");
  if (advance.beforeRuntimeSourceProjectionHash !== before.projectionHash || advance.afterRuntimeSourceProjectionHash !== after.projectionHash || advance.completeZeroOwnerCensusHash !== cleanup.completeZeroOwnerCensusHash) fail("advance composite projection is crossed");
  return recursivelyFreeze(advance);
}

function migrationPairFromAdvance(advance: Readonly<Record<string, unknown>>): Readonly<{ migrationReceiptRef: string; migrationReceiptHash: string }> {
  if (typeof advance.migrationReceiptRef !== "string" || !REF.test(advance.migrationReceiptRef) || typeof advance.migrationReceiptHash !== "string" || !SHA256.test(advance.migrationReceiptHash) || !advance.migrationReceiptRef.endsWith(advance.migrationReceiptHash)) fail("advance migration receipt is invalid");
  return Object.freeze({ migrationReceiptRef: advance.migrationReceiptRef, migrationReceiptHash: advance.migrationReceiptHash });
}

export async function observeInternalProductionBaselineRestartSequenceStatusV1(
  input: Readonly<{ intentKind: InternalProductionBaselineRestartSequenceIntentKindV1 }>,
): Promise<InternalProductionBaselineRestartSequenceStatusV1> {
  const intentKind = intentFrom(input);
  const header = resolveHeader(intentKind);
  const cutover = await observeCutoverStatusV1();
  const advances = await Promise.all(SERVICES.map((_, ordinal) => resolveAdvance(intentKind, ordinal)));
  const blocked = SERVICES.map((_, ordinal) => resolveBlocked(intentKind, ordinal));
  const firstMissing = advances.findIndex((value) => value === null);
  if (!header && firstMissing === 0) {
    if (advances.slice(1).some((value) => value !== null) || blocked.some((value) => value !== null) || optionalRead(receiptLocatorPath(intentKind), "sequence receipt locator")) fail("sequence prefix has a gap");
    if (cutover.state === "recovery-d-active") {
      const terminalMigration = await resolveExactTerminalMigrationReceiptV1();
      return sequenceStatusV1({ state: "retired", intentKind, sequenceIntentHash: null, migrationReceiptRef: terminalMigration.migrationReceiptRef, migrationReceiptHash: terminalMigration.migrationReceiptHash, migrationSchemaProjectionHash: terminalMigration.schemaProjectionHash, activeOrdinal: null, refusalCode: "BASELINE_RESTART_AUTHORITY_RETIRED", retirementRef: cutover.baselineRetirementRef, retirementHash: cutover.baselineRetirementHash, sequenceRef: null, sequenceHash: null });
    }
    return sequenceStatusV1({ state: "absent", intentKind, sequenceIntentHash: null, migrationReceiptRef: null, migrationReceiptHash: null, migrationSchemaProjectionHash: null, activeOrdinal: null, refusalCode: null, sequenceRef: null, sequenceHash: null });
  }
  if (!header) fail("sequence advance exists without its intent");
  const terminalMigration = await resolveExactTerminalMigrationReceiptV1();
  if (header.migrationReceiptRef !== terminalMigration.migrationReceiptRef || header.migrationReceiptHash !== terminalMigration.migrationReceiptHash || header.migrationSchemaProjectionHash !== terminalMigration.schemaProjectionHash) fail("sequence status terminal migration authority is crossed");
  if (cutover.state === "recovery-d-active" && firstMissing !== -1) {
    const cutoverRecord = cutover as unknown as Readonly<Record<string, unknown>>;
    if (typeof cutoverRecord.baselineRetirementRef !== "string" || typeof cutoverRecord.baselineRetirementHash !== "string" || !REF.test(cutoverRecord.baselineRetirementRef) || !SHA256.test(cutoverRecord.baselineRetirementHash) || !cutoverRecord.baselineRetirementRef.endsWith(cutoverRecord.baselineRetirementHash)) fail("retired sequence status lacks exact retirement authority");
    return sequenceStatusV1({ state: "retired", intentKind, sequenceIntentHash: null, migrationReceiptRef: header.migrationReceiptRef, migrationReceiptHash: header.migrationReceiptHash, migrationSchemaProjectionHash: header.migrationSchemaProjectionHash, activeOrdinal: null, refusalCode: "BASELINE_RESTART_AUTHORITY_RETIRED", retirementRef: cutoverRecord.baselineRetirementRef, retirementHash: cutoverRecord.baselineRetirementHash, sequenceRef: null, sequenceHash: null });
  }
  if (firstMissing > 0 && advances.slice(firstMissing + 1).some((value) => value !== null)) fail("sequence prefix has a gap");
  const migrationReceipt = Object.freeze({ migrationReceiptRef: header.migrationReceiptRef as string, migrationReceiptHash: header.migrationReceiptHash as string });
  for (const advance of advances.filter((value): value is Readonly<Record<string, unknown>> => value !== null)) {
    if (canonical(migrationPairFromAdvance(advance)) !== canonical(migrationReceipt)) fail("sequence migration receipt crossed");
  }
  for (const [ordinal, blockedRecord] of blocked.entries()) {
    if (blockedRecord && (blockedRecord.sequenceIntentHash !== header.sequenceIntentHash || blockedRecord.ordinal !== ordinal)) fail("blocked sequence history is crossed");
  }
  const receiptLocator = optionalRead(receiptLocatorPath(intentKind), "sequence receipt locator");
  if (firstMissing !== -1) {
    if (receiptLocator) fail("sequence receipt precedes advances");
    return sequenceStatusV1({ state: blocked[firstMissing] ? "blocked" : "in_progress", intentKind, sequenceIntentHash: header.sequenceIntentHash, migrationReceiptRef: migrationReceipt.migrationReceiptRef, migrationReceiptHash: migrationReceipt.migrationReceiptHash, migrationSchemaProjectionHash: header.migrationSchemaProjectionHash, activeOrdinal: firstMissing as 0 | 1 | 2, refusalCode: null, sequenceRef: null, sequenceHash: null });
  }
  if (!receiptLocator) return sequenceStatusV1({ state: "in_progress", intentKind, sequenceIntentHash: header.sequenceIntentHash, migrationReceiptRef: migrationReceipt.migrationReceiptRef, migrationReceiptHash: migrationReceipt.migrationReceiptHash, migrationSchemaProjectionHash: header.migrationSchemaProjectionHash, activeOrdinal: 2, refusalCode: null, sequenceRef: null, sequenceHash: null });
  const receiptPair = storedPair(receiptLocator, "sequenceRef", "sequenceHash", SEQUENCE_RECEIPT_PREFIX);
  await resolveInternalProductionBaselineRestartSequenceReceiptV1({ sequenceRef: receiptPair.sequenceRef!, sequenceHash: receiptPair.sequenceHash! });
  return sequenceStatusV1({ state: "completed", intentKind, sequenceIntentHash: header.sequenceIntentHash, migrationReceiptRef: migrationReceipt.migrationReceiptRef, migrationReceiptHash: migrationReceipt.migrationReceiptHash, migrationSchemaProjectionHash: header.migrationSchemaProjectionHash, activeOrdinal: null, refusalCode: null, sequenceRef: receiptPair.sequenceRef!, sequenceHash: receiptPair.sequenceHash! });
}

export async function resolveInternalProductionBaselineRestartSequenceReceiptV1(
  input: Readonly<{ sequenceRef: CanonicalRef; sequenceHash: Sha256V1 }>,
): Promise<InternalProductionBaselineRestartSequenceReceiptV1> {
  const expected = pair(input, "sequenceRef", "sequenceHash", SEQUENCE_RECEIPT_PREFIX);
  const file = path.join(rootPath(), "receipts", "sha256", expected.sequenceHash!.slice(0, 2), `${expected.sequenceHash}.json`);
  const receipt = read(file, "sequence receipt");
  const expectedKeys = ["schema", "intentKind", "sequenceIntentHash", "migrationReceiptRef", "migrationReceiptHash", "migrationSchemaProjectionHash", "initialRuntimeSourceProjectionHash", "orderedServices", "authorityPairs", "orderedAdvanceHashes", "finalRuntimeSourceProjectionHash", "finalCompleteZeroOwnerCensusHash", "sequenceRef", "sequenceHash"].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (JSON.stringify(Object.keys(receipt)) !== JSON.stringify(expectedKeys)) fail("sequence receipt fields are invalid");
  const projection = { ...receipt };
  delete projection.sequenceRef;
  delete projection.sequenceHash;
  if (receipt.schema !== "setfarm.internal-production-baseline-restart-sequence-receipt.v1" || !INTENTS.has(receipt.intentKind as InternalProductionBaselineRestartSequenceIntentKindV1) || receipt.sequenceRef !== expected.sequenceRef || receipt.sequenceHash !== expected.sequenceHash || sha256(canonical(projection)) !== expected.sequenceHash || canonical(receipt.orderedServices) !== canonical(SERVICES.map(({ service }) => service)) || !Array.isArray(receipt.authorityPairs) || receipt.authorityPairs.length !== 3 || !Array.isArray(receipt.orderedAdvanceHashes) || receipt.orderedAdvanceHashes.length !== 3 || receipt.orderedAdvanceHashes.some((hash) => typeof hash !== "string" || !SHA256.test(hash)) || typeof receipt.finalCompleteZeroOwnerCensusHash !== "string" || !SHA256.test(receipt.finalCompleteZeroOwnerCensusHash) || typeof receipt.migrationReceiptRef !== "string" || !REF.test(receipt.migrationReceiptRef) || typeof receipt.migrationReceiptHash !== "string" || !SHA256.test(receipt.migrationReceiptHash) || !receipt.migrationReceiptRef.endsWith(receipt.migrationReceiptHash) || typeof receipt.migrationSchemaProjectionHash !== "string" || !SHA256.test(receipt.migrationSchemaProjectionHash) || typeof receipt.initialRuntimeSourceProjectionHash !== "string" || !SHA256.test(receipt.initialRuntimeSourceProjectionHash) || typeof receipt.finalRuntimeSourceProjectionHash !== "string" || !SHA256.test(receipt.finalRuntimeSourceProjectionHash) || typeof receipt.sequenceIntentHash !== "string" || !SHA256.test(receipt.sequenceIntentHash)) fail("sequence receipt is invalid");
  const intentKind = receipt.intentKind as InternalProductionBaselineRestartSequenceIntentKindV1;
  const terminalMigration = await resolveExactTerminalMigrationReceiptV1();
  if (receipt.migrationReceiptRef !== terminalMigration.migrationReceiptRef || receipt.migrationReceiptHash !== terminalMigration.migrationReceiptHash || receipt.migrationSchemaProjectionHash !== terminalMigration.schemaProjectionHash) fail("sequence receipt terminal migration authority is crossed");
  const header = resolveHeader(intentKind);
  if (!header || header.sequenceIntentHash !== receipt.sequenceIntentHash || header.migrationReceiptRef !== receipt.migrationReceiptRef || header.migrationReceiptHash !== receipt.migrationReceiptHash || header.migrationSchemaProjectionHash !== receipt.migrationSchemaProjectionHash || header.initialRuntimeSourceProjectionHash !== receipt.initialRuntimeSourceProjectionHash) fail("sequence receipt intent binding is crossed");
  await resolveCompleteZeroOwnerCensusV1(receipt.finalCompleteZeroOwnerCensusHash as string);
  for (const [ordinal, fixed] of SERVICES.entries()) {
    const advance = await resolveAdvance(intentKind, ordinal);
    const authority = (receipt.authorityPairs as unknown[])[ordinal];
    if (!advance || !authority || typeof authority !== "object" || Array.isArray(authority) || Object.getPrototypeOf(authority) !== Object.prototype || JSON.stringify(Object.keys(authority)) !== JSON.stringify(["actionId", "authorityHash", "authorityRef", "service"]) || (authority as Record<string, unknown>).service !== fixed.service || (authority as Record<string, unknown>).actionId !== fixed.actionId || (authority as Record<string, unknown>).authorityRef !== advance.authorityRef || (authority as Record<string, unknown>).authorityHash !== advance.authorityHash || (receipt.orderedAdvanceHashes as unknown[])[ordinal] !== advance.advanceHash) fail("sequence receipt ordered authority is crossed");
  }
  const finalAdvance = await resolveAdvance(intentKind, 2);
  if (!finalAdvance || receipt.finalRuntimeSourceProjectionHash !== finalAdvance.afterRuntimeSourceProjectionHash) fail("sequence receipt final runtime projection is crossed");
  return recursivelyFreeze(receipt as unknown as InternalProductionBaselineRestartSequenceReceiptV1);
}

export async function resumeInternalProductionBaselineRestartSequenceV1(
  input: Readonly<{ intentKind: InternalProductionBaselineRestartSequenceIntentKindV1 }>,
): Promise<Readonly<{ sequenceRef: CanonicalRef; sequenceHash: Sha256V1 }>> {
  const intentKind = intentFrom(input);
  const existing = await observeInternalProductionBaselineRestartSequenceStatusV1({ intentKind });
  if (existing.state === "completed") return recursivelyFreeze({ sequenceRef: existing.sequenceRef, sequenceHash: existing.sequenceHash });
  if (existing.state === "retired") fail("BASELINE_RESTART_AUTHORITY_RETIRED");
  await resolveExactTerminalMigrationReceiptV1();
  const ports = await normalRestartPortsV1();
  const transition = await sequenceTransitionPortsV1();
  const lease = await transition.acquire();
  let terminalMigration: TerminalMigrationReceiptV1;
  let existingHeader: Readonly<Record<string, unknown>> | null;
  try {
    const cutover = await transition.observeStatus();
    if (cutover.state !== "baseline-a-active") fail("BASELINE_RESTART_AUTHORITY_RETIRED");
    if (intentKind === "d-startup-hook-load") await assertReviewedDStartupHookLoadGateV1();
    terminalMigration = await resolveExactTerminalMigrationReceiptV1();
    const currentProjection = await observeRuntimeProjectionV1();
    existingHeader = resolveHeader(intentKind);
    if (!existingHeader) {
      const derivedHeaderBody = { schema: "setfarm.internal-production-baseline-restart-sequence-intent.v1", intentKind, migrationReceiptRef: terminalMigration.migrationReceiptRef, migrationReceiptHash: terminalMigration.migrationReceiptHash, migrationSchemaProjectionHash: terminalMigration.schemaProjectionHash, initialRuntimeSourceProjectionHash: currentProjection.projectionHash, orderedServiceActions: SERVICES };
      const derivedSequenceIntentHash = sha256(canonical(derivedHeaderBody));
      const derivedSequenceIntentRef = `setfarm://internal-production/baseline-restart-sequence-intent/sha256/${derivedSequenceIntentHash}`;
      const value = recursivelyFreeze({ ...derivedHeaderBody, sequenceIntentRef: derivedSequenceIntentRef, sequenceIntentHash: derivedSequenceIntentHash });
      publish(path.join(rootPath(), "sequence-intents", "sha256", derivedSequenceIntentHash.slice(0, 2), `${derivedSequenceIntentHash}.json`), value);
      publish(headerLocatorPath(intentKind), { sequenceIntentRef: derivedSequenceIntentRef, sequenceIntentHash: derivedSequenceIntentHash });
      existingHeader = resolveHeader(intentKind);
    }
    if (!existingHeader || existingHeader.migrationReceiptRef !== terminalMigration.migrationReceiptRef || existingHeader.migrationReceiptHash !== terminalMigration.migrationReceiptHash || existingHeader.migrationSchemaProjectionHash !== terminalMigration.schemaProjectionHash || canonical(existingHeader.orderedServiceActions) !== canonical(SERVICES)) fail("persisted sequence intent authority is crossed while locked");
  } finally {
    await transition.release(lease);
  }
  const header = existingHeader!;
  if (header.migrationReceiptRef !== terminalMigration.migrationReceiptRef || header.migrationReceiptHash !== terminalMigration.migrationReceiptHash || header.migrationSchemaProjectionHash !== terminalMigration.schemaProjectionHash) fail("persisted sequence terminal migration authority is crossed");
  const initialRuntimeSourceProjectionHash = header.initialRuntimeSourceProjectionHash as string;
  const sequenceIntentHash = header.sequenceIntentHash as string;
  const migrationReceiptRef = header.migrationReceiptRef as string;
  const migrationReceiptHash = header.migrationReceiptHash as string;
  const migrationPair = Object.freeze({ migrationReceiptRef, migrationReceiptHash });
  const advances: Array<Readonly<Record<string, unknown>>> = [];
  const authorityPairs: InternalProductionBaselineServiceRestartAuthorityPairV1[] = [];
  for (const [ordinal, fixed] of SERVICES.entries()) {
      const adopted = await resolveAdvance(intentKind, ordinal);
      if (adopted) {
        advances.push(adopted);
        authorityPairs.push(recursivelyFreeze({ service: fixed.service, actionId: fixed.actionId, authorityRef: adopted.authorityRef as string, authorityHash: adopted.authorityHash as string }));
        continue;
      }
      if (advances.length !== ordinal) fail("sequence durable prefix is not contiguous");
      const currentProjection = await observeRuntimeProjectionV1();
      const expectedBeforeHash = ordinal === 0 ? initialRuntimeSourceProjectionHash : advances[ordinal - 1]!.afterRuntimeSourceProjectionHash;
      if (currentProjection.projectionHash !== expectedBeforeHash) fail("sequence runtime projection changed before authorization");
      let authorizationPair: Readonly<{ authorizationRef: string; authorizationHash: string }>;
      const storedAuthorization = optionalRead(authorizationLocatorPath(intentKind, ordinal), `authorization locator ${ordinal}`);
      if (storedAuthorization) authorizationPair = storedPair(storedAuthorization, "authorizationRef", "authorizationHash", NORMAL_AUTHORIZATION_PREFIX) as Readonly<{ authorizationRef: string; authorizationHash: string }>;
      else {
        authorizationPair = pair(await ports.prepare({ service: fixed.service }), "authorizationRef", "authorizationHash", NORMAL_AUTHORIZATION_PREFIX) as Readonly<{ authorizationRef: string; authorizationHash: string }>;
        validateAuthorizationV1(await ports.resolveAuthorization(authorizationPair), authorizationPair, fixed.service, migrationPair, currentProjection.projectionHash);
        publish(authorizationLocatorPath(intentKind, ordinal), authorizationPair);
      }
      validateAuthorizationV1(await ports.resolveAuthorization(authorizationPair), authorizationPair, fixed.service, migrationPair, currentProjection.projectionHash);
      let authorityPair: Readonly<{ receiptRef: string; receiptHash: string }>;
      try {
        authorityPair = pair(await ports.restart(authorizationPair), "receiptRef", "receiptHash", NORMAL_RESTART_PREFIX) as Readonly<{ receiptRef: string; receiptHash: string }>;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("HELPER_DISPATCH_SETTLEMENT_UNKNOWN")) throw error;
        const blockedBody = { schema: "setfarm.internal-production-baseline-restart-sequence-blocked.v1", intentKind, sequenceIntentHash, ordinal, authorizationRef: authorizationPair.authorizationRef, authorizationHash: authorizationPair.authorizationHash, reason: "HELPER_DISPATCH_SETTLEMENT_UNKNOWN" };
        const blockedHash = sha256(canonical(blockedBody));
        const blockedRef = `setfarm://internal-production/baseline-restart-sequence-blocked/sha256/${blockedHash}`;
        publish(path.join(rootPath(), "blocked", "sha256", blockedHash.slice(0, 2), `${blockedHash}.json`), { ...blockedBody, blockedRef, blockedHash });
        publish(blockedLocatorPath(intentKind, ordinal), { blockedRef, blockedHash });
        throw error;
      }
      const authority = validateNormalRestartAuthorityV1(await ports.resolveAuthority(authorityPair), authorityPair, fixed, migrationPair);
      const before = authority.before as RuntimeProjectionV1; const after = authority.after as RuntimeProjectionV1; const cleanup = authority.cleanup as Readonly<Record<string, unknown>>;
      if (before.projectionHash !== currentProjection.projectionHash) fail("normal restart before projection is crossed with sequence head");
      const observedAfter = await observeRuntimeProjectionV1();
      if (observedAfter.projectionHash !== after.projectionHash) fail("normal restart after projection is not current");
      const advanceBody = { schema: "setfarm.internal-production-baseline-service-restart-advance.v1", intentKind, sequenceIntentHash, ordinal, service: fixed.service, actionId: fixed.actionId, migrationReceiptRef, migrationReceiptHash, initialRuntimeSourceProjectionHash, authorizationRef: authorizationPair.authorizationRef, authorizationHash: authorizationPair.authorizationHash, authorityRef: authorityPair.receiptRef, authorityHash: authorityPair.receiptHash, priorAdvanceHash: ordinal === 0 ? null : advances[ordinal - 1]!.advanceHash, beforeRuntimeSourceProjectionHash: before.projectionHash, afterRuntimeSourceProjectionHash: after.projectionHash, completeZeroOwnerCensusHash: cleanup.completeZeroOwnerCensusHash };
      const advanceHash = sha256(canonical(advanceBody));
      const advanceRef = `setfarm://internal-production/baseline-service-restart-advance/sha256/${advanceHash}`;
      const advance = recursivelyFreeze({ ...advanceBody, advanceRef, advanceHash });
      publish(path.join(rootPath(), "advances", "sha256", advanceHash.slice(0, 2), `${advanceHash}.json`), advance);
      publish(locatorPath(intentKind, ordinal), { advanceRef, advanceHash });
      advances.push(advance);
      authorityPairs.push(recursivelyFreeze({ service: fixed.service, actionId: fixed.actionId, authorityRef: authorityPair.receiptRef, authorityHash: authorityPair.receiptHash }));
  }
  const finalProjection = await observeRuntimeProjectionV1();
  if (finalProjection.projectionHash !== advances[2]!.afterRuntimeSourceProjectionHash) fail("sequence final runtime projection is crossed");
  const finalZero = await observeCompleteZeroOwnerCensusV1();
  const receiptBody = {
      schema: "setfarm.internal-production-baseline-restart-sequence-receipt.v1",
      intentKind,
      sequenceIntentHash,
      migrationReceiptRef,
      migrationReceiptHash,
      migrationSchemaProjectionHash: header.migrationSchemaProjectionHash,
      initialRuntimeSourceProjectionHash,
      orderedServices: SERVICES.map(({ service }) => service),
      authorityPairs,
      orderedAdvanceHashes: advances.map((advance) => advance.advanceHash),
      finalRuntimeSourceProjectionHash: finalProjection.projectionHash,
      finalCompleteZeroOwnerCensusHash: finalZero.observationHash,
    };
    const sequenceHash = sha256(canonical(receiptBody));
    const sequenceRef = `${SEQUENCE_RECEIPT_PREFIX}${sequenceHash}`;
    const receipt = recursivelyFreeze({ ...receiptBody, sequenceRef, sequenceHash });
    publish(path.join(rootPath(), "receipts", "sha256", sequenceHash.slice(0, 2), `${sequenceHash}.json`), receipt);
    publish(receiptLocatorPath(intentKind), { sequenceRef, sequenceHash });
  return recursivelyFreeze({ sequenceRef, sequenceHash });
}
