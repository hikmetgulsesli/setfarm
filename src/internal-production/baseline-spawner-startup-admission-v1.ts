import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
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

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  type InternalProductionCurrentEntryOperationPairV1,
  observePreparedInternalProductionCurrentEntryOperationV1,
  resolveInternalProductionCurrentEntryOperationV1,
  observeInternalProductionServiceCensusV1,
  observeInternalProductionLegacyPreManifestZeroOwnerV1,
  resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1,
} from "./baseline-post-handoff-receipt-v1.js";
import {
  acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1,
  invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1,
} from "./baseline-restart-authority-retirement-v1.js";

type Sha256V1 = string;
type CanonicalRef = string;

export type InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1 = Readonly<{ authorizationRef: CanonicalRef; authorizationHash: Sha256V1 }>;
export type InternalProductionPreSchemaSpawnerStartupTokenPairV1 = Readonly<{ startupTokenRef: CanonicalRef; startupTokenHash: Sha256V1 }>;
export type InternalProductionPreSchemaSpawnerRestartAuthorityPairV1 = Readonly<{ restartAuthorityRef: CanonicalRef; restartAuthorityHash: Sha256V1 }>;
export type InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1 = Readonly<{ predecessorTerminationObservationRef: CanonicalRef; predecessorTerminationObservationHash: Sha256V1 }>;
export type InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1 = Readonly<{ replacementProcessObservationRef: CanonicalRef; replacementProcessObservationHash: Sha256V1 }>;
export type InternalProductionPreSchemaSpawnerSealedAdmissionPairV1 = Readonly<{ sealedAdmissionRef: CanonicalRef; sealedAdmissionHash: Sha256V1 }>;
export type InternalProductionPreSchemaSpawnerRebindStatusPairV1 = Readonly<{ statusRef: CanonicalRef; statusHash: Sha256V1 }>;
export type InternalProductionTask0SpawnerAdmissionReadyPairV1 = Readonly<{ admissionReadyRef: CanonicalRef; admissionReadyHash: Sha256V1 }>;

export type InternalProductionPreSchemaSpawnerRebindAuthorizationV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-rebind-authorization.v1";
  purpose: "task6a-pre-schema-setfarm-spawner-rebind-v1";
  service: "setfarm-spawner";
  currentEntryOperationRef: CanonicalRef;
  currentEntryOperationHash: Sha256V1;
  authorityV3Migration31AuditRef: CanonicalRef;
  authorityV3Migration31AuditHash: Sha256V1;
  legacyZeroOwnerObservationRef: CanonicalRef;
  legacyZeroOwnerObservationHash: Sha256V1;
  cleanSetfarmSourceSha: string;
  cleanSetfarmTreeHash: string;
  cleanSetfarmBuildHash: Sha256V1;
  predecessorSpawnerServiceIdentityHash: Sha256V1;
  predecessorSpawnerGenerationHash: Sha256V1;
  authorizationRef: CanonicalRef;
  authorizationHash: Sha256V1;
}>;

export type InternalProductionPreSchemaSpawnerStartupTokenV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-startup-token.v1";
  startupMode: "pre-manifest-bootstrap-sealed";
  currentEntryOperationRef: CanonicalRef; currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef; preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  task0SpawnerSourceSha: string; task0SpawnerTreeHash: string; task0SpawnerBuildHash: Sha256V1;
  predecessorSpawnerProcessIdentityRef: CanonicalRef; predecessorSpawnerProcessIdentityHash: Sha256V1;
  predecessorSpawnerServiceIdentityHash: Sha256V1; predecessorSpawnerGenerationHash: Sha256V1;
  startupTokenRef: CanonicalRef;
  startupTokenHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerRestartAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-restart-authority.v1";
  actionId: "task6a-pre-schema-setfarm-spawner-rebind-v1";
  service: "setfarm-spawner";
  currentEntryOperationRef: CanonicalRef; currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef; preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef; startupTokenHash: Sha256V1;
  predecessorSpawnerProcessIdentityRef: CanonicalRef; predecessorSpawnerProcessIdentityHash: Sha256V1;
  predecessorSpawnerServiceIdentityHash: Sha256V1; predecessorSpawnerGenerationHash: Sha256V1;
  targetSpawnerSourceSha: string; targetSpawnerTreeHash: string; targetSpawnerBuildHash: Sha256V1;
  uid: number; launchdLabel: "com.setrox.setfarm-spawner"; executable: "/bin/launchctl"; argv: readonly ["kickstart", "-k", string];
  restartAuthorityRef: CanonicalRef;
  restartAuthorityHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-predecessor-termination-observation.v1";
  currentEntryOperationRef: CanonicalRef; currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef; preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef; startupTokenHash: Sha256V1;
  restartAuthorityRef: CanonicalRef; restartAuthorityHash: Sha256V1;
  predecessorSpawnerProcessIdentityRef: CanonicalRef; predecessorSpawnerProcessIdentityHash: Sha256V1;
  predecessorSpawnerServiceIdentityHash: Sha256V1; predecessorSpawnerGenerationHash: Sha256V1;
  observedProcessState: "terminal-and-not-running"; observedListenerState: "absent";
  predecessorTerminationObservationRef: CanonicalRef;
  predecessorTerminationObservationHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerReplacementProcessObservationV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-replacement-process-observation.v1";
  currentEntryOperationRef: CanonicalRef; currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef; preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef; startupTokenHash: Sha256V1;
  restartAuthorityRef: CanonicalRef; restartAuthorityHash: Sha256V1;
  predecessorTerminationObservationRef: CanonicalRef; predecessorTerminationObservationHash: Sha256V1;
  replacementSpawnerProcessIdentityRef: CanonicalRef; replacementSpawnerProcessIdentityHash: Sha256V1;
  replacementSpawnerServiceIdentityHash: Sha256V1; actualSpawnerGenerationHash: Sha256V1;
  actualSpawnerSourceSha: string; actualSpawnerTreeHash: string; actualSpawnerBuildHash: Sha256V1;
  differsFromPredecessorProcessIdentity: true; startupMode: "pre-manifest-bootstrap-sealed";
  replacementProcessObservationRef: CanonicalRef;
  replacementProcessObservationHash: Sha256V1;
}>;
export type InternalProductionPreSchemaSpawnerSealedAdmissionV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-sealed-admission.v1";
  state: "pre-manifest-bootstrap-sealed";
  currentEntryOperationRef: CanonicalRef; currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef; preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef; startupTokenHash: Sha256V1;
  preSchemaSpawnerRestartAuthorityRef: CanonicalRef; preSchemaSpawnerRestartAuthorityHash: Sha256V1;
  predecessorTerminationObservationRef: CanonicalRef; predecessorTerminationObservationHash: Sha256V1;
  replacementProcessObservationRef: CanonicalRef; replacementProcessObservationHash: Sha256V1;
  currentSpawnerGenerationHash: Sha256V1;
  postPredecessorTerminationLegacyZeroOwnerObservationRef: CanonicalRef; postPredecessorTerminationLegacyZeroOwnerObservationHash: Sha256V1;
  allOwnerProducerEntrypointsBlocked: true;
  sealedAdmissionRef: CanonicalRef;
  sealedAdmissionHash: Sha256V1;
}>;

type DispatchPrefixV1 =
  | Readonly<{ phase: "restart_authority_published"; predecessorTerminationObservation: null; replacementProcessObservation: null }>
  | Readonly<{ phase: "predecessor_terminated"; predecessorTerminationObservation: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1; replacementProcessObservation: null }>
  | Readonly<{ phase: "replacement_observed"; predecessorTerminationObservation: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1; replacementProcessObservation: InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1 }>;

type StatusEnvelopeV1 = Readonly<{
  schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1";
  statusRef: CanonicalRef;
  statusHash: Sha256V1;
}>;
type StatusFieldsV1 = Readonly<{
  state: "absent" | "prepared" | "startup_token_published" | "dispatching" | "pre_manifest_bootstrap_sealed" | "normal_task0_admission_ready" | "blocked";
  currentEntryOperation: InternalProductionCurrentEntryOperationPairV1 | null;
  authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1 | null;
  startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1 | null;
  restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1 | null;
  dispatchPrefix: DispatchPrefixV1 | null;
  sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1 | null;
  admissionReady: InternalProductionTask0SpawnerAdmissionReadyPairV1 | null;
  refusalCode:
    | "CURRENT_ENTRY_OPERATION_NOT_PREPARED"
    | "CURRENT_ENTRY_OPERATION_MISMATCH"
    | "PREDECESSOR_IDENTITY_OR_TERMINATION_MISMATCH"
    | "REPLACEMENT_IDENTITY_OR_SOURCE_MISMATCH"
    | "POST_TERMINATION_LEGACY_OWNER_NONZERO"
    | "SEALED_STARTUP_ADMISSION_INVALID"
    | "NORMAL_FULL_VERIFY_OR_DB_INITIALIZATION_FAILED"
    | "HELPER_DISPATCH_SETTLEMENT_UNKNOWN"
    | null;
}>;
type StatusBodyInputV1 = Omit<StatusEnvelopeV1 & StatusFieldsV1, "schema" | "statusRef" | "statusHash">;

export type InternalProductionPreSchemaSpawnerRebindStatusV1 = StatusEnvelopeV1 & (
  | Readonly<{ state: "absent"; currentEntryOperation: null; authorization: null; startupToken: null; restartAuthority: null; dispatchPrefix: null; sealedAdmission: null; admissionReady: null; refusalCode: null }>
  | Readonly<{ state: "prepared"; currentEntryOperation: InternalProductionCurrentEntryOperationPairV1; authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1; startupToken: null; restartAuthority: null; dispatchPrefix: null; sealedAdmission: null; admissionReady: null; refusalCode: null }>
  | Readonly<{ state: "startup_token_published"; currentEntryOperation: InternalProductionCurrentEntryOperationPairV1; authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1; startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1; restartAuthority: null; dispatchPrefix: null; sealedAdmission: null; admissionReady: null; refusalCode: null }>
  | Readonly<{ state: "dispatching"; currentEntryOperation: InternalProductionCurrentEntryOperationPairV1; authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1; startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1; restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1; dispatchPrefix: DispatchPrefixV1; sealedAdmission: null; admissionReady: null; refusalCode: null }>
  | Readonly<{ state: "pre_manifest_bootstrap_sealed"; currentEntryOperation: InternalProductionCurrentEntryOperationPairV1; authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1; startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1; restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1; dispatchPrefix: Extract<DispatchPrefixV1, { phase: "replacement_observed" }>; sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1; admissionReady: null; refusalCode: null }>
  | Readonly<{ state: "normal_task0_admission_ready"; currentEntryOperation: InternalProductionCurrentEntryOperationPairV1; authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1; startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1; restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1; dispatchPrefix: Extract<DispatchPrefixV1, { phase: "replacement_observed" }>; sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1; admissionReady: InternalProductionTask0SpawnerAdmissionReadyPairV1; refusalCode: null }>
  | Readonly<{ state: "blocked"; currentEntryOperation: InternalProductionCurrentEntryOperationPairV1; authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1; startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1; restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1; dispatchPrefix: Extract<DispatchPrefixV1, { phase: "restart_authority_published" }>; sealedAdmission: null; admissionReady: null; refusalCode: "HELPER_DISPATCH_SETTLEMENT_UNKNOWN" }>
);

export type InternalProductionTask0SpawnerAdmissionReadyV1 = Readonly<{
  schema: "setfarm.internal-production-task0-spawner-admission-ready.v1";
  state: "normal-task0-admission-ready";
  currentEntryOperationRef: CanonicalRef; currentEntryOperationHash: Sha256V1;
  preSchemaSpawnerRebindAuthorizationRef: CanonicalRef; preSchemaSpawnerRebindAuthorizationHash: Sha256V1;
  startupTokenRef: CanonicalRef; startupTokenHash: Sha256V1;
  restartAuthorityRef: CanonicalRef; restartAuthorityHash: Sha256V1;
  predecessorTerminationObservationRef: CanonicalRef; predecessorTerminationObservationHash: Sha256V1;
  replacementProcessObservationRef: CanonicalRef; replacementProcessObservationHash: Sha256V1;
  sealedAdmissionRef: CanonicalRef; sealedAdmissionHash: Sha256V1;
  migrationReceiptRef: CanonicalRef; migrationReceiptHash: Sha256V1;
  migrationCurrentAuditRef: CanonicalRef; migrationCurrentAuditHash: Sha256V1;
  manifestActivationRef: CanonicalRef; manifestActivationHash: Sha256V1;
  manifestHeadRef: CanonicalRef; manifestHeadHash: Sha256V1;
  unchangedSpawnerGenerationHash: Sha256V1;
  genericFullVerifyStatus: "verified";
  normalDatabaseInitializationStatus: "ready";
  admissionReadyRef: CanonicalRef;
  admissionReadyHash: Sha256V1;
}>;

const SHA256 = /^[a-f0-9]{64}$/;
const STORE = "data/internal-production-baseline/pre-schema-spawner-rebind-v1";
const MAX_RECORD_BYTES = 1_048_576;
const PREFIXES = Object.freeze({
  authorization: "setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/",
  startupToken: "setfarm://internal-production/pre-schema-spawner-startup-token/sha256/",
  restartAuthority: "setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/",
  predecessorTerminationObservation: "setfarm://internal-production/pre-schema-spawner-predecessor-termination-observation/sha256/",
  replacementProcessObservation: "setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/",
  sealedAdmission: "setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/",
  status: "setfarm://internal-production/pre-schema-spawner-rebind-status/sha256/",
  admissionReady: "setfarm://internal-production/task0-spawner-admission-ready/sha256/",
});

function fail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_PRE_SCHEMA_SPAWNER_REBIND_INVALID:${message}`);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) deepFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

function root(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const source = path.dirname(current);
  if (!new Set(["src", "dist"]).has(path.basename(source))) fail("module root is invalid");
  return path.join(path.dirname(source), STORE);
}

function exactPair(value: unknown, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || JSON.stringify(Reflect.ownKeys(value)) !== JSON.stringify([refKey, hashKey])) fail(`${refKey} pair shape is invalid`);
  const pair = value as Record<string, unknown>;
  if (typeof pair[hashKey] !== "string" || !SHA256.test(pair[hashKey]) || pair[refKey] !== `${prefix}${pair[hashKey]}`) fail(`${refKey} pair is invalid`);
  return Object.freeze(pair as Record<string, string>);
}

function pairFromBody(body: Record<string, unknown>, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, string>> {
  return exactPair({ [refKey]: body[refKey], [hashKey]: body[hashKey] }, refKey, hashKey, prefix);
}

function pairFromStored(value: Record<string, unknown>, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, string>> {
  if (Reflect.ownKeys(value).length !== 2) fail(`${refKey} stored pair has extra fields`);
  return exactPair({ [refKey]: value[refKey], [hashKey]: value[hashKey] }, refKey, hashKey, prefix);
}

function operationPair(operation: Readonly<{ operationRef: string; operationHash: string }>): InternalProductionCurrentEntryOperationPairV1 {
  return exactPair({ operationRef: operation.operationRef, operationHash: operation.operationHash }, "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/") as InternalProductionCurrentEntryOperationPairV1;
}

function contentBody<T extends Record<string, unknown>>(body: T, refKey: string, hashKey: string, prefix: string): Readonly<T & Record<string, string>> {
  const hash = hashCanonicalJson(body);
  return deepFreeze({ ...body, [refKey]: `${prefix}${hash}`, [hashKey]: hash }) as Readonly<T & Record<string, string>>;
}

function recordPath(kind: string, hash: string): string {
  return path.join(root(), "records", kind, "sha256", hash.slice(0, 2), `${hash}.json`);
}

function operationPath(operationHash: string, locator: string): string {
  return path.join(root(), "operations", "sha256", operationHash, `${locator}.pair.json`);
}

function exactRecoveryTemporaryTargetV1(name: string, knownBasenames: ReadonlySet<string>): string | null {
  for (const basename of knownBasenames) {
    const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^\\.${escaped}\\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.tmp$`).test(name)) return basename;
  }
  return null;
}

function writeNoReplace(file: string, value: unknown): void {
  const bytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const directory = path.dirname(file);
  const basename = path.basename(file);
  const verify = (target: string, links: bigint): void => {
    const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = lstatSync(target, { bigint: true });
      const held = readFileSync(descriptor);
      const after = lstatSync(target, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== links || before.dev !== after.dev || before.ino !== after.ino || !held.equals(bytes)) fail(`immutable record differs: ${basename}`);
    } finally { closeSync(descriptor); }
  };
  const prefix = `.${basename}.`;
  const candidates = readdirSync(directory).filter((name) => name.startsWith(prefix));
  if (candidates.some((name) => exactRecoveryTemporaryTargetV1(name, new Set([basename])) !== basename)) fail(`immutable record recovery name is invalid: ${basename}`);
  if (candidates.length > 1) fail(`immutable record recovery is ambiguous: ${basename}`);
  try {
    const finalStats = lstatSync(file, { bigint: true });
    if (candidates.length === 0) { verify(file, 1n); return; }
    const recoveredTemporary = path.join(directory, candidates[0]!);
    if (finalStats.nlink === 2n) {
      verify(file, 2n);
      verify(recoveredTemporary, 2n);
      const temporaryStats = lstatSync(recoveredTemporary, { bigint: true });
      if (temporaryStats.dev !== finalStats.dev || temporaryStats.ino !== finalStats.ino) fail(`immutable record recovery inode differs: ${basename}`);
    } else if (finalStats.nlink === 1n) {
      verify(file, 1n);
      verify(recoveredTemporary, 1n);
    } else fail(`immutable record recovery link count is invalid: ${basename}`);
    unlinkSync(recoveredTemporary);
    const recoveryParent = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { fsyncSync(recoveryParent); } finally { closeSync(recoveryParent); }
    verify(file, 1n);
    return;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  let temporary: string;
  if (candidates.length === 1) {
    temporary = path.join(directory, candidates[0]!);
    verify(temporary, 1n);
  } else {
    temporary = path.join(directory, `${prefix}${randomUUID()}.tmp`);
    const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  }
  let linked = true;
  try { linkSync(temporary, file); } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    linked = false;
  }
  const parentDescriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(parentDescriptor); } finally { closeSync(parentDescriptor); }
  verify(file, linked ? 2n : 1n);
  verify(temporary, linked ? 2n : 1n);
  if (linked) {
    const temporaryStats = lstatSync(temporary, { bigint: true });
    const finalStats = lstatSync(file, { bigint: true });
    if (temporaryStats.dev !== finalStats.dev || temporaryStats.ino !== finalStats.ino) fail(`immutable record publication inode differs: ${basename}`);
  }
  unlinkSync(temporary);
  const cleanupDescriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(cleanupDescriptor); } finally { closeSync(cleanupDescriptor); }
  verify(file, 1n);
}

function readRecord(file: string): Record<string, unknown> {
  const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes: Buffer;
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || (before.mode & 0o777n) !== 0o600n || before.size < 1n || before.size > BigInt(MAX_RECORD_BYTES)) fail("record identity is invalid");
    bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const reopened = lstatSync(file, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode || before.nlink !== after.nlink || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || after.dev !== reopened.dev || after.ino !== reopened.ino || reopened.isSymbolicLink() || BigInt(bytes.length) !== after.size) fail("record changed while read");
  } finally { closeSync(descriptor); }
  if (bytes.length < 1 || bytes.length > MAX_RECORD_BYTES) fail("record size is invalid");
  const text = bytes.toString("utf8");
  let value: unknown;
  try { value = JSON.parse(text); } catch { fail("record is not JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || `${canonical(value)}\n` !== text) fail("record is not canonical");
  return value as Record<string, unknown>;
}

function resolveSpawnerProcessIdentityV1(ref: unknown, hash: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof hash !== "string" || !SHA256.test(hash) || ref !== `setfarm://internal-production/spawner-process-identity/sha256/${hash}`) fail(`${label} pair is crossed`);
  const identity = readRecord(recordPath("process-identity", hash));
  exactKeys(identity, ["schema", "pid", "processStartTimeEpochMs", "processIdentityHash"], label);
  if (identity.schema !== "setfarm.internal-production-spawner-process-identity.v1" || hashCanonicalJson(identity) !== hash || !Number.isSafeInteger(identity.pid) || (identity.pid as number) < 1 || !Number.isSafeInteger(identity.processStartTimeEpochMs) || (identity.processStartTimeEpochMs as number) < 1 || typeof identity.processIdentityHash !== "string" || !SHA256.test(identity.processIdentityHash)) fail(`${label} is invalid`);
  return Object.freeze(identity);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const compare = (left: string, right: string) => Buffer.compare(Buffer.from(left), Buffer.from(right));
  if (JSON.stringify(Object.keys(value)) !== JSON.stringify([...keys].sort(compare))) fail(`${label} fields are invalid`);
}

function validatePairField(value: unknown, refKey: string, hashKey: string, prefix: string, nullable = false): void {
  if (value === null && nullable) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${refKey} pair is invalid`);
  const record = value as Record<string, unknown>;
  exactPair({ [refKey]: record[refKey], [hashKey]: record[hashKey] }, refKey, hashKey, prefix);
  if (Reflect.ownKeys(record).length !== 2) fail(`${refKey} pair has extra fields`);
}

function validateEmbeddedPairV1(body: Record<string, unknown>, refKey: string, hashKey: string, prefix?: string): void {
  const hash = body[hashKey];
  const ref = body[refKey];
  if (typeof hash !== "string" || !SHA256.test(hash) || typeof ref !== "string" || (prefix ? ref !== `${prefix}${hash}` : !ref.endsWith(`/sha256/${hash}`))) fail(`${refKey} embedded pair is invalid`);
}

function validateResolvedRecord(kind: string, body: Record<string, unknown>): void {
  if (kind === "authorization") {
    exactKeys(body, ["schema", "purpose", "service", "currentEntryOperationRef", "currentEntryOperationHash", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "legacyZeroOwnerObservationRef", "legacyZeroOwnerObservationHash", "cleanSetfarmSourceSha", "cleanSetfarmTreeHash", "cleanSetfarmBuildHash", "predecessorSpawnerServiceIdentityHash", "predecessorSpawnerGenerationHash", "authorizationRef", "authorizationHash"], kind);
    if (body.schema !== "setfarm.internal-production-pre-schema-spawner-rebind-authorization.v1" || body.purpose !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || body.service !== "setfarm-spawner") fail("authorization discriminator is invalid");
    return;
  }
  if (kind === "startup-token") {
    exactKeys(body, ["schema", "startupMode", "currentEntryOperationRef", "currentEntryOperationHash", "preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", "task0SpawnerSourceSha", "task0SpawnerTreeHash", "task0SpawnerBuildHash", "predecessorSpawnerProcessIdentityRef", "predecessorSpawnerProcessIdentityHash", "predecessorSpawnerServiceIdentityHash", "predecessorSpawnerGenerationHash", "startupTokenRef", "startupTokenHash"], kind);
    if (body.schema !== "setfarm.internal-production-pre-schema-spawner-startup-token.v1" || body.startupMode !== "pre-manifest-bootstrap-sealed") fail("startup token discriminator is invalid");
    return;
  }
  if (kind === "restart-authority") {
    exactKeys(body, ["schema", "actionId", "service", "currentEntryOperationRef", "currentEntryOperationHash", "preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", "startupTokenRef", "startupTokenHash", "predecessorSpawnerProcessIdentityRef", "predecessorSpawnerProcessIdentityHash", "predecessorSpawnerServiceIdentityHash", "predecessorSpawnerGenerationHash", "targetSpawnerSourceSha", "targetSpawnerTreeHash", "targetSpawnerBuildHash", "uid", "launchdLabel", "executable", "argv", "restartAuthorityRef", "restartAuthorityHash"], kind);
    if (body.schema !== "setfarm.internal-production-pre-schema-spawner-restart-authority.v1" || body.actionId !== "task6a-pre-schema-setfarm-spawner-rebind-v1" || body.service !== "setfarm-spawner" || body.launchdLabel !== "com.setrox.setfarm-spawner" || body.executable !== "/bin/launchctl" || !Number.isSafeInteger(body.uid) || (body.uid as number) < 0 || !Array.isArray(body.argv) || canonical(body.argv) !== canonical(["kickstart", "-k", `gui/${body.uid}/com.setrox.setfarm-spawner`])) fail("restart authority fixed action is invalid");
    return;
  }
  if (kind === "predecessor-termination") {
    exactKeys(body, ["schema", "currentEntryOperationRef", "currentEntryOperationHash", "preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", "startupTokenRef", "startupTokenHash", "restartAuthorityRef", "restartAuthorityHash", "predecessorSpawnerProcessIdentityRef", "predecessorSpawnerProcessIdentityHash", "predecessorSpawnerServiceIdentityHash", "predecessorSpawnerGenerationHash", "observedProcessState", "observedListenerState", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash"], kind);
    if (body.schema !== "setfarm.internal-production-pre-schema-spawner-predecessor-termination-observation.v1" || body.observedProcessState !== "terminal-and-not-running" || body.observedListenerState !== "absent") fail("predecessor termination discriminator is invalid");
    return;
  }
  if (kind === "replacement-process") {
    exactKeys(body, ["schema", "currentEntryOperationRef", "currentEntryOperationHash", "preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", "startupTokenRef", "startupTokenHash", "restartAuthorityRef", "restartAuthorityHash", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", "replacementSpawnerProcessIdentityRef", "replacementSpawnerProcessIdentityHash", "replacementSpawnerServiceIdentityHash", "actualSpawnerGenerationHash", "actualSpawnerSourceSha", "actualSpawnerTreeHash", "actualSpawnerBuildHash", "differsFromPredecessorProcessIdentity", "startupMode", "replacementProcessObservationRef", "replacementProcessObservationHash"], kind);
    if (body.schema !== "setfarm.internal-production-pre-schema-spawner-replacement-process-observation.v1" || body.differsFromPredecessorProcessIdentity !== true || body.startupMode !== "pre-manifest-bootstrap-sealed") fail("replacement process discriminator is invalid");
    return;
  }
  if (kind === "sealed-admission") {
    exactKeys(body, ["schema", "state", "currentEntryOperationRef", "currentEntryOperationHash", "preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", "startupTokenRef", "startupTokenHash", "preSchemaSpawnerRestartAuthorityRef", "preSchemaSpawnerRestartAuthorityHash", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", "replacementProcessObservationRef", "replacementProcessObservationHash", "currentSpawnerGenerationHash", "postPredecessorTerminationLegacyZeroOwnerObservationRef", "postPredecessorTerminationLegacyZeroOwnerObservationHash", "allOwnerProducerEntrypointsBlocked", "sealedAdmissionRef", "sealedAdmissionHash"], kind);
    if (body.schema !== "setfarm.internal-production-pre-schema-spawner-sealed-admission.v1" || body.state !== "pre-manifest-bootstrap-sealed" || body.allOwnerProducerEntrypointsBlocked !== true) fail("sealed admission discriminator is invalid");
    return;
  }
  if (kind === "admission-ready") {
    exactKeys(body, ["schema", "state", "currentEntryOperationRef", "currentEntryOperationHash", "preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", "startupTokenRef", "startupTokenHash", "restartAuthorityRef", "restartAuthorityHash", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", "replacementProcessObservationRef", "replacementProcessObservationHash", "sealedAdmissionRef", "sealedAdmissionHash", "migrationReceiptRef", "migrationReceiptHash", "migrationCurrentAuditRef", "migrationCurrentAuditHash", "manifestActivationRef", "manifestActivationHash", "manifestHeadRef", "manifestHeadHash", "unchangedSpawnerGenerationHash", "genericFullVerifyStatus", "normalDatabaseInitializationStatus", "admissionReadyRef", "admissionReadyHash"], kind);
    if (body.schema !== "setfarm.internal-production-task0-spawner-admission-ready.v1" || body.state !== "normal-task0-admission-ready" || body.genericFullVerifyStatus !== "verified" || body.normalDatabaseInitializationStatus !== "ready" || typeof body.unchangedSpawnerGenerationHash !== "string" || !SHA256.test(body.unchangedSpawnerGenerationHash)) fail("admission ready discriminator is invalid");
    for (const [refKey, hashKey, prefix] of [
      ["currentEntryOperationRef", "currentEntryOperationHash", "setfarm://internal-production/current-entry-operation/sha256/"],
      ["preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", PREFIXES.authorization],
      ["startupTokenRef", "startupTokenHash", PREFIXES.startupToken], ["restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority],
      ["predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation],
      ["replacementProcessObservationRef", "replacementProcessObservationHash", PREFIXES.replacementProcessObservation],
      ["sealedAdmissionRef", "sealedAdmissionHash", PREFIXES.sealedAdmission],
      ["migrationReceiptRef", "migrationReceiptHash", undefined], ["migrationCurrentAuditRef", "migrationCurrentAuditHash", undefined],
      ["manifestActivationRef", "manifestActivationHash", undefined], ["manifestHeadRef", "manifestHeadHash", undefined],
      ["admissionReadyRef", "admissionReadyHash", PREFIXES.admissionReady],
    ] as const) validateEmbeddedPairV1(body, refKey, hashKey, prefix);
    return;
  }
  if (kind === "status") {
    exactKeys(body, ["schema", "state", "currentEntryOperation", "authorization", "startupToken", "restartAuthority", "dispatchPrefix", "sealedAdmission", "admissionReady", "refusalCode", "statusRef", "statusHash"], kind);
    if (body.schema !== "setfarm.internal-production-pre-schema-spawner-rebind-status.v1") fail("status schema is invalid");
    const operation = body.currentEntryOperation;
    const authorization = body.authorization;
    const startupToken = body.startupToken;
    const restartAuthority = body.restartAuthority;
    const dispatch = body.dispatchPrefix;
    const sealed = body.sealedAdmission;
    const ready = body.admissionReady;
    const refusal = body.refusalCode;
    if (body.state === "absent") {
      if ([operation, authorization, startupToken, restartAuthority, dispatch, sealed, ready, refusal].some((value) => value !== null)) fail("absent status prefix is invalid");
      return;
    }
    validatePairField(operation, "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/");
    validatePairField(authorization, "authorizationRef", "authorizationHash", PREFIXES.authorization);
    if (body.state === "prepared") {
      if ([startupToken, restartAuthority, dispatch, sealed, ready, refusal].some((value) => value !== null)) fail("prepared status prefix is invalid");
      return;
    }
    validatePairField(startupToken, "startupTokenRef", "startupTokenHash", PREFIXES.startupToken);
    if (body.state === "startup_token_published") {
      if ([restartAuthority, dispatch, sealed, ready, refusal].some((value) => value !== null)) fail("startup-token status prefix is invalid");
      return;
    }
    if (body.state === "dispatching" || body.state === "pre_manifest_bootstrap_sealed" || body.state === "normal_task0_admission_ready") {
      validatePairField(restartAuthority, "restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority);
      if (!dispatch || typeof dispatch !== "object" || Array.isArray(dispatch) || Object.getPrototypeOf(dispatch) !== Object.prototype) fail("dispatch prefix is invalid");
      const prefix = dispatch as Record<string, unknown>;
      exactKeys(prefix, ["phase", "predecessorTerminationObservation", "replacementProcessObservation"], "dispatch prefix");
      if (prefix.phase === "restart_authority_published") {
        if (prefix.predecessorTerminationObservation !== null || prefix.replacementProcessObservation !== null) fail("restart-authority prefix is invalid");
      } else if (prefix.phase === "predecessor_terminated") {
        validatePairField(prefix.predecessorTerminationObservation, "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation);
        if (prefix.replacementProcessObservation !== null) fail("predecessor prefix is invalid");
      } else if (prefix.phase === "replacement_observed") {
        validatePairField(prefix.predecessorTerminationObservation, "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation);
        validatePairField(prefix.replacementProcessObservation, "replacementProcessObservationRef", "replacementProcessObservationHash", PREFIXES.replacementProcessObservation);
      } else fail("dispatch phase is invalid");
      if (body.state === "dispatching") {
        if (sealed !== null || ready !== null || refusal !== null) fail("dispatching status suffix is invalid");
        return;
      }
      if (prefix.phase !== "replacement_observed") fail("terminal status lacks replacement observation");
      validatePairField(sealed, "sealedAdmissionRef", "sealedAdmissionHash", PREFIXES.sealedAdmission);
      if (body.state === "pre_manifest_bootstrap_sealed") {
        if (ready !== null || refusal !== null) fail("sealed status suffix is invalid");
        return;
      }
      validatePairField(ready, "admissionReadyRef", "admissionReadyHash", PREFIXES.admissionReady);
      if (refusal !== null) fail("ready status refusal is invalid");
      return;
    }
    if (body.state === "blocked") {
      validatePairField(startupToken, "startupTokenRef", "startupTokenHash", PREFIXES.startupToken);
      validatePairField(restartAuthority, "restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority);
      if (!dispatch || typeof dispatch !== "object" || Array.isArray(dispatch) || Object.getPrototypeOf(dispatch) !== Object.prototype) fail("blocked dispatch prefix is invalid");
      const prefix = dispatch as Record<string, unknown>;
      exactKeys(prefix, ["phase", "predecessorTerminationObservation", "replacementProcessObservation"], "blocked dispatch prefix");
      if (prefix.phase !== "restart_authority_published" || prefix.predecessorTerminationObservation !== null || prefix.replacementProcessObservation !== null || sealed !== null || ready !== null || refusal !== "HELPER_DISPATCH_SETTLEMENT_UNKNOWN") fail("blocked refusal is invalid");
      return;
    }
    fail("status state is invalid");
  }
  fail(`unknown record kind ${kind}`);
}

function resolveBody<T>(pair: unknown, kind: string, refKey: string, hashKey: string, prefix: string): T {
  const expected = exactPair(pair, refKey, hashKey, prefix);
  const body = readRecord(recordPath(kind, expected[hashKey]!));
  const projection = { ...body };
  delete projection[refKey];
  delete projection[hashKey];
  if (hashCanonicalJson(projection) !== expected[hashKey] || body[refKey] !== expected[refKey] || body[hashKey] !== expected[hashKey]) fail(`${kind} body is crossed`);
  validateResolvedRecord(kind, body);
  return deepFreeze(body as T);
}

function publishRecord(kind: string, body: Record<string, unknown>, refKey: string, hashKey: string, prefix: string): Readonly<Record<string, unknown>> {
  const value = contentBody(body, refKey, hashKey, prefix);
  writeNoReplace(recordPath(kind, value[hashKey]!), value);
  return value;
}

function publishOperationPair(operationHash: string, locator: string, pair: unknown): void {
  writeNoReplace(operationPath(operationHash, locator), pair);
}

async function observePredecessorTerminationV1(pid: number, processStartTimeEpochMs: number): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const observed = spawnSync("/bin/ps", ["-p", String(pid), "-o", "lstart="], {
      env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
      shell: false,
      encoding: "utf8",
      timeout: 2_000,
      maxBuffer: 65_536,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (!observed.error && !observed.signal && observed.status === 1 && observed.stdout === "" && observed.stderr === "") return;
    if (!observed.error && !observed.signal && observed.status === 0 && observed.stderr === "") {
      const actualStart = Date.parse(observed.stdout.trim());
      if (Number.isSafeInteger(actualStart) && actualStart !== processStartTimeEpochMs) return;
    }
    if (attempt < 39) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail("predecessor process remains live or its terminal state is ambiguous");
}

function statusBody(input: StatusBodyInputV1): InternalProductionPreSchemaSpawnerRebindStatusV1 {
  return contentBody({ schema: "setfarm.internal-production-pre-schema-spawner-rebind-status.v1", ...input }, "statusRef", "statusHash", PREFIXES.status) as unknown as InternalProductionPreSchemaSpawnerRebindStatusV1;
}

function publishStatus(operationHash: string, ordinal: string, input: StatusBodyInputV1): InternalProductionPreSchemaSpawnerRebindStatusV1 {
  const value = statusBody(input);
  writeNoReplace(recordPath("status", value.statusHash), value);
  publishOperationPair(operationHash, `status-${ordinal}`, { statusRef: value.statusRef, statusHash: value.statusHash });
  return value;
}

async function deriveAuthorization(): Promise<Readonly<{ body: InternalProductionPreSchemaSpawnerRebindAuthorizationV1; operation: Awaited<ReturnType<typeof resolveInternalProductionCurrentEntryOperationV1>>; legacy: Awaited<ReturnType<typeof resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1>>; census: Awaited<ReturnType<typeof observeInternalProductionServiceCensusV1>> }>> {
  const prepared = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (prepared === null) fail("prepared current-entry operation is absent");
  const operation = await resolveInternalProductionCurrentEntryOperationV1(operationPair(prepared));
  const census = await observeInternalProductionServiceCensusV1();
  const observedLegacy = await observeInternalProductionLegacyPreManifestZeroOwnerV1();
  const legacy = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1({ observationRef: observedLegacy.observationRef, observationHash: observedLegacy.observationHash });
  if (legacy.cleanSetfarmSourceSha !== operation.controllerSource.sha || legacy.cleanSetfarmTreeHash !== operation.controllerSource.treeHash || legacy.cleanSetfarmBuildHash !== operation.controllerSource.buildHash || legacy.observedSpawnerGenerationHash !== census.spawner.generationHash) fail("authorization prerequisites are crossed");
  const body = contentBody({
    schema: "setfarm.internal-production-pre-schema-spawner-rebind-authorization.v1",
    purpose: "task6a-pre-schema-setfarm-spawner-rebind-v1",
    service: "setfarm-spawner",
    currentEntryOperationRef: operation.operationRef,
    currentEntryOperationHash: operation.operationHash,
    authorityV3Migration31AuditRef: operation.authorityV3Migration31Audit.authorityV3Migration31AuditRef,
    authorityV3Migration31AuditHash: operation.authorityV3Migration31Audit.authorityV3Migration31AuditHash,
    legacyZeroOwnerObservationRef: legacy.observationRef,
    legacyZeroOwnerObservationHash: legacy.observationHash,
    cleanSetfarmSourceSha: operation.controllerSource.sha,
    cleanSetfarmTreeHash: operation.controllerSource.treeHash,
    cleanSetfarmBuildHash: operation.controllerSource.buildHash,
    predecessorSpawnerServiceIdentityHash: census.spawner.serviceIdentityHash,
    predecessorSpawnerGenerationHash: census.spawner.generationHash,
  }, "authorizationRef", "authorizationHash", PREFIXES.authorization) as InternalProductionPreSchemaSpawnerRebindAuthorizationV1;
  return deepFreeze({ body, operation, legacy, census });
}

export async function prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1(): Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1> {
  const { body } = await deriveAuthorization();
  return pairFromBody(body, "authorizationRef", "authorizationHash", PREFIXES.authorization) as InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
}

export async function executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1(
  input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1,
): Promise<InternalProductionPreSchemaSpawnerRestartAuthorityPairV1> {
  const expected = exactPair(input, "authorizationRef", "authorizationHash", PREFIXES.authorization);
  const prepared = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (prepared === null) fail("prepared current-entry operation is absent");
  const operationBody = await resolveInternalProductionCurrentEntryOperationV1(operationPair(prepared));
  const operation = operationPair(operationBody);
  const locators = [
    ["00-pre-dispatch-legacy-zero", "observationRef", "observationHash"],
    ["01-authorization", "authorizationRef", "authorizationHash"],
    ["02-startup-token", "startupTokenRef", "startupTokenHash"],
    ["03-restart-authority", "restartAuthorityRef", "restartAuthorityHash"],
    ["04-predecessor-termination", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash"],
    ["05-replacement-process", "replacementProcessObservationRef", "replacementProcessObservationHash"],
    ["06-post-termination-legacy-zero", "observationRef", "observationHash"],
    ["07-sealed-admission", "sealedAdmissionRef", "sealedAdmissionHash"],
  ] as const;
  const operationDirectory = path.dirname(operationPath(operation.operationHash, "00-pre-dispatch-legacy-zero"));
  const knownBasenames = new Set([
    ...locators.map(([locator]) => `${locator}.pair.json`),
    "08-admission-ready.pair.json",
    "status-00-prepared.pair.json", "status-01-startup-token-published.pair.json",
    "status-02-restart-authority-published.pair.json", "status-03-predecessor-terminated.pair.json",
    "status-04-replacement-observed.pair.json", "status-05-pre-manifest-bootstrap-sealed.pair.json",
    "status-06-normal-task0-admission-ready.pair.json", "status-blocked-helper-dispatch-settlement-unknown.pair.json",
  ]);
  const recoveryTemporaries = new Map<string, string>();
  try {
    const entries = readdirSync(operationDirectory);
    for (const entry of entries) {
      if (knownBasenames.has(entry)) continue;
      const fixed = exactRecoveryTemporaryTargetV1(entry, knownBasenames);
      if (!fixed || recoveryTemporaries.has(fixed)) fail("operation inventory contains an unknown or duplicate recovery temporary");
      recoveryTemporaries.set(fixed, entry);
    }
    if (recoveryTemporaries.size > 1) fail("operation inventory contains ambiguous recovery temporaries");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  for (const [target, temporaryName] of recoveryTemporaries) {
    const temporaryPath = path.join(operationDirectory, temporaryName);
    const finalPath = path.join(operationDirectory, target);
    try {
      const temporaryStats = lstatSync(temporaryPath, { bigint: true });
      const finalStats = lstatSync(finalPath, { bigint: true });
      const linked = temporaryStats.dev === finalStats.dev && temporaryStats.ino === finalStats.ino && temporaryStats.nlink === 2n && finalStats.nlink === 2n;
      const collision = temporaryStats.dev === finalStats.dev && temporaryStats.ino !== finalStats.ino && temporaryStats.nlink === 1n && finalStats.nlink === 1n && canonical(readRecord(temporaryPath)) === canonical(readRecord(finalPath));
      if (!linked && !collision) fail("recovery temporary/final publication identity is crossed");
      const finalPathStats = lstatSync(finalPath, { bigint: true });
      const temporaryPathStats = lstatSync(temporaryPath, { bigint: true });
      if (finalPathStats.dev !== finalStats.dev || finalPathStats.ino !== finalStats.ino || temporaryPathStats.dev !== temporaryStats.dev || temporaryPathStats.ino !== temporaryStats.ino) fail("recovery publication changed before temporary cleanup");
      unlinkSync(temporaryPath);
      const directoryDescriptor = openSync(operationDirectory, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
      readRecord(finalPath);
      recoveryTemporaries.delete(target);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      const temporary = readRecord(temporaryPath);
      if (!temporary || Reflect.ownKeys(temporary).length !== 2) fail("recovery temporary pair shape is invalid");
    }
  }
  const publicationOrder = [
    "00-pre-dispatch-legacy-zero.pair.json", "01-authorization.pair.json", "status-00-prepared.pair.json",
    "02-startup-token.pair.json", "status-01-startup-token-published.pair.json",
    "03-restart-authority.pair.json", "status-02-restart-authority-published.pair.json",
    "04-predecessor-termination.pair.json", "status-03-predecessor-terminated.pair.json",
    "05-replacement-process.pair.json", "status-04-replacement-observed.pair.json",
    "06-post-termination-legacy-zero.pair.json", "07-sealed-admission.pair.json",
    "status-05-pre-manifest-bootstrap-sealed.pair.json", "08-admission-ready.pair.json",
    "status-06-normal-task0-admission-ready.pair.json",
  ] as const;
  const finalExists = (basename: string): boolean => {
    try {
      const observed = lstatSync(path.join(operationDirectory, basename), { bigint: true });
      if (!observed.isFile() || observed.isSymbolicLink()) fail("operation publication member is not a regular final");
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
      throw error;
    }
  };
  if (recoveryTemporaries.size === 1) {
    const target = recoveryTemporaries.keys().next().value as string;
    const immediate = publicationOrder.find((basename) => !finalExists(basename));
    const blockedAlternative = target === "status-blocked-helper-dispatch-settlement-unknown.pair.json"
      && immediate === "04-predecessor-termination.pair.json";
    if (target !== immediate && !blockedAlternative) fail("recovery temporary is not the immediate next publication");
  }
  const persisted: Array<Record<string, unknown> | null> = [];
  let gap = false;
  for (const [locator] of locators) {
    const basename = `${locator}.pair.json`;
    const candidatePath = recoveryTemporaries.get(basename)
      ? path.join(operationDirectory, recoveryTemporaries.get(basename)!)
      : operationPath(operation.operationHash, locator);
    try {
      const value = readRecord(candidatePath);
      if (gap) fail("operation prefix is not contiguous");
      persisted.push(value);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        gap = true;
        persisted.push(null);
      } else throw error;
    }
  }
  const locatorPrefixes = [
    "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/",
    PREFIXES.authorization, PREFIXES.startupToken, PREFIXES.restartAuthority,
    PREFIXES.predecessorTerminationObservation, PREFIXES.replacementProcessObservation,
    "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/",
    PREFIXES.sealedAdmission,
  ] as const;
  const locatorPairs = persisted.map((value, index) => value === null ? null : pairFromStored(
    value,
    locators[index]![1],
    locators[index]![2],
    locatorPrefixes[index]!,
  ));
  const completeRecoveryTemporary = (basename: string): void => {
    const temporaryName = recoveryTemporaries.get(basename);
    if (!temporaryName) return;
    const temporaryPath = path.join(operationDirectory, temporaryName);
    const finalPath = path.join(operationDirectory, basename);
    linkSync(temporaryPath, finalPath);
    const linkedTemporary = lstatSync(temporaryPath, { bigint: true });
    const linkedFinal = lstatSync(finalPath, { bigint: true });
    if (linkedTemporary.dev !== linkedFinal.dev || linkedTemporary.ino !== linkedFinal.ino || linkedTemporary.nlink !== 2n || linkedFinal.nlink !== 2n) fail("recovery publication link identity is crossed");
    const parent = openSync(operationDirectory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { fsyncSync(parent); } finally { closeSync(parent); }
    unlinkSync(temporaryPath);
    const cleanup = openSync(operationDirectory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { fsyncSync(cleanup); } finally { closeSync(cleanup); }
    readRecord(finalPath);
    recoveryTemporaries.delete(basename);
  };
  const resolvedLocatorBodies: Array<Record<string, unknown> | null> = [];
  let preflightPredecessorIdentity: Record<string, unknown> | null = null;
  for (let locatorIndex = 0; locatorIndex < locatorPairs.length; locatorIndex += 1) {
    const locatorPair = locatorPairs[locatorIndex];
    if (locatorPair !== null) {
      const target = `${locators[locatorIndex]![0]}.pair.json`;
      let resolved: Record<string, unknown>;
      if (locatorIndex === 0 || locatorIndex === 6) resolved = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(locatorPair as { observationRef: string; observationHash: string }) as unknown as Record<string, unknown>;
      else if (locatorIndex === 1) resolved = await resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1(locatorPair as InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1) as unknown as Record<string, unknown>;
      else if (locatorIndex === 2) resolved = await resolveInternalProductionPreSchemaSpawnerStartupTokenV1(locatorPair as InternalProductionPreSchemaSpawnerStartupTokenPairV1) as unknown as Record<string, unknown>;
      else if (locatorIndex === 3) resolved = await resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(locatorPair as InternalProductionPreSchemaSpawnerRestartAuthorityPairV1) as unknown as Record<string, unknown>;
      else if (locatorIndex === 4) resolved = await resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1(locatorPair as InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1) as unknown as Record<string, unknown>;
      else if (locatorIndex === 5) resolved = await resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1(locatorPair as InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1) as unknown as Record<string, unknown>;
      else resolved = await resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1(locatorPair as InternalProductionPreSchemaSpawnerSealedAdmissionPairV1) as unknown as Record<string, unknown>;
      resolvedLocatorBodies[locatorIndex] = resolved;
      const expectedRelations: Array<readonly [string, string, number]> = [
        ["currentEntryOperationRef", "currentEntryOperationHash", -1],
        ["legacyZeroOwnerObservationRef", "legacyZeroOwnerObservationHash", 0],
        ["preSchemaSpawnerRebindAuthorizationRef", "preSchemaSpawnerRebindAuthorizationHash", 1],
        ["startupTokenRef", "startupTokenHash", 2],
        [locatorIndex === 7 ? "preSchemaSpawnerRestartAuthorityRef" : "restartAuthorityRef", locatorIndex === 7 ? "preSchemaSpawnerRestartAuthorityHash" : "restartAuthorityHash", 3],
        ["predecessorTerminationObservationRef", "predecessorTerminationObservationHash", 4],
        ["replacementProcessObservationRef", "replacementProcessObservationHash", 5],
        ["postPredecessorTerminationLegacyZeroOwnerObservationRef", "postPredecessorTerminationLegacyZeroOwnerObservationHash", 6],
      ];
      for (const [refKey, hashKey, index] of expectedRelations) {
        if (!(refKey in resolved) && !(hashKey in resolved)) continue;
        let expectedRef: unknown;
        let expectedHash: unknown;
        if (index < 0) {
          expectedRef = operation.operationRef;
          expectedHash = operation.operationHash;
        } else {
          const expectedPair = locatorPairs[index] as Readonly<Record<string, string>> | null;
          expectedRef = expectedPair?.[locators[index]![1]];
          expectedHash = expectedPair?.[locators[index]![2]];
        }
        if (resolved[refKey] !== expectedRef || resolved[hashKey] !== expectedHash) fail("recovery temporary causal relation is crossed");
      }
      if ((locatorIndex === 0 || locatorIndex === 6) && (resolved.cleanSetfarmSourceSha !== operationBody.controllerSource.sha || resolved.cleanSetfarmTreeHash !== operationBody.controllerSource.treeHash || resolved.cleanSetfarmBuildHash !== operationBody.controllerSource.buildHash)) fail("recovery legacy temporary source is crossed");
      if (locatorIndex === 1 && (resolved.authorizationRef !== expected.authorizationRef || resolved.authorizationHash !== expected.authorizationHash)) fail("recovery authorization temporary differs from input");
      const authorizationBody = resolvedLocatorBodies[1];
      const startupBody = resolvedLocatorBodies[2];
      const replacementBody = resolvedLocatorBodies[5];
      if (locatorIndex === 1 && (
        resolved.cleanSetfarmSourceSha !== operationBody.controllerSource.sha
        || resolved.cleanSetfarmTreeHash !== operationBody.controllerSource.treeHash
        || resolved.cleanSetfarmBuildHash !== operationBody.controllerSource.buildHash
        || resolved.authorityV3Migration31AuditRef !== operationBody.authorityV3Migration31Audit.authorityV3Migration31AuditRef
        || resolved.authorityV3Migration31AuditHash !== operationBody.authorityV3Migration31Audit.authorityV3Migration31AuditHash
      )) fail("persisted authorization source/audit is crossed");
      if (locatorIndex === 2 && (
        resolved.task0SpawnerSourceSha !== operationBody.controllerSource.sha
        || resolved.task0SpawnerTreeHash !== operationBody.controllerSource.treeHash
        || resolved.task0SpawnerBuildHash !== operationBody.controllerSource.buildHash
        || resolved.predecessorSpawnerServiceIdentityHash !== authorizationBody?.predecessorSpawnerServiceIdentityHash
        || resolved.predecessorSpawnerGenerationHash !== authorizationBody?.predecessorSpawnerGenerationHash
      )) fail("persisted startup token source/generation is crossed");
      if (locatorIndex === 2) {
        const identity = resolveSpawnerProcessIdentityV1(resolved.predecessorSpawnerProcessIdentityRef, resolved.predecessorSpawnerProcessIdentityHash, "predecessor process identity");
        preflightPredecessorIdentity = identity;
      }
      if (locatorIndex === 3) {
        const uid = process.getuid?.();
        if (resolved.uid !== uid || resolved.executable !== "/bin/launchctl" || canonical(resolved.argv) !== canonical(["kickstart", "-k", `gui/${uid}/com.setrox.setfarm-spawner`]) || resolved.targetSpawnerSourceSha !== operationBody.controllerSource.sha || resolved.targetSpawnerTreeHash !== operationBody.controllerSource.treeHash || resolved.targetSpawnerBuildHash !== operationBody.controllerSource.buildHash || resolved.predecessorSpawnerServiceIdentityHash !== startupBody?.predecessorSpawnerServiceIdentityHash || resolved.predecessorSpawnerGenerationHash !== startupBody?.predecessorSpawnerGenerationHash) fail("recovery restart temporary fixed action is crossed");
      }
      if (locatorIndex === 4 && (resolved.predecessorSpawnerServiceIdentityHash !== startupBody?.predecessorSpawnerServiceIdentityHash || resolved.predecessorSpawnerGenerationHash !== startupBody?.predecessorSpawnerGenerationHash)) fail("persisted predecessor identity is crossed");
      if (locatorIndex === 5) {
        const replacementIdentity = resolveSpawnerProcessIdentityV1(resolved.replacementSpawnerProcessIdentityRef, resolved.replacementSpawnerProcessIdentityHash, "replacement process identity");
        if (resolved.actualSpawnerSourceSha !== operationBody.controllerSource.sha || resolved.actualSpawnerTreeHash !== operationBody.controllerSource.treeHash || resolved.actualSpawnerBuildHash !== operationBody.controllerSource.buildHash || resolved.actualSpawnerGenerationHash !== startupBody?.predecessorSpawnerGenerationHash || resolved.replacementSpawnerServiceIdentityHash !== startupBody?.predecessorSpawnerServiceIdentityHash || replacementIdentity.processIdentityHash === preflightPredecessorIdentity?.processIdentityHash || resolved.replacementSpawnerProcessIdentityHash === resolvedLocatorBodies[2]?.predecessorSpawnerProcessIdentityHash) fail("persisted replacement source/generation/process is crossed");
      }
      if (locatorIndex === 6 && resolved.observedSpawnerGenerationHash !== replacementBody?.actualSpawnerGenerationHash) fail("persisted post-zero generation is crossed");
      if (locatorIndex === 7 && resolved.currentSpawnerGenerationHash !== replacementBody?.actualSpawnerGenerationHash) fail("persisted sealed generation is crossed");
      completeRecoveryTemporary(target);
    }
    else resolvedLocatorBodies[locatorIndex] = null;
  }
  const statusSpecs = [
    ["status-00-prepared.pair.json", "prepared"],
    ["status-01-startup-token-published.pair.json", "startup_token_published"],
    ["status-02-restart-authority-published.pair.json", "dispatching"],
    ["status-03-predecessor-terminated.pair.json", "dispatching"],
    ["status-04-replacement-observed.pair.json", "dispatching"],
    ["status-05-pre-manifest-bootstrap-sealed.pair.json", "pre_manifest_bootstrap_sealed"],
    ["status-06-normal-task0-admission-ready.pair.json", "normal_task0_admission_ready"],
  ] as const;
  let statusGap = false;
  for (const [basename, expectedState] of statusSpecs) {
    const candidatePath = recoveryTemporaries.get(basename) ? path.join(operationDirectory, recoveryTemporaries.get(basename)!) : path.join(operationDirectory, basename);
    try {
      const candidate = readRecord(candidatePath);
      if (statusGap) fail("status prefix or recovery temporary is not contiguous");
      const pair = pairFromStored(candidate, "statusRef", "statusHash", PREFIXES.status) as InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      const status = await resolveInternalProductionPreSchemaSpawnerRebindStatusV1(pair);
      if (status.state !== expectedState || status.currentEntryOperation?.operationRef !== operation.operationRef || status.currentEntryOperation.operationHash !== operation.operationHash) fail("persisted status ordinal or operation relation is crossed");
      for (const [field, index] of [["authorization", 1], ["startupToken", 2], ["restartAuthority", 3], ["sealedAdmission", 7]] as const) {
        if (status[field] !== null && canonical(status[field]) !== canonical(locatorPairs[index])) fail("persisted status causal pair is crossed");
      }
      if (status.dispatchPrefix !== null) {
        const expectedPhase = basename.includes("02-restart") ? "restart_authority_published" : basename.includes("03-predecessor") ? "predecessor_terminated" : "replacement_observed";
        if (status.dispatchPrefix.phase !== expectedPhase
          || (status.dispatchPrefix.predecessorTerminationObservation !== null && canonical(status.dispatchPrefix.predecessorTerminationObservation) !== canonical(locatorPairs[4]))
          || (status.dispatchPrefix.replacementProcessObservation !== null && canonical(status.dispatchPrefix.replacementProcessObservation) !== canonical(locatorPairs[5]))) fail("persisted status dispatch prefix is crossed");
      }
      completeRecoveryTemporary(basename);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") statusGap = true;
      else throw error;
    }
  }
  const blockedBasename = "status-blocked-helper-dispatch-settlement-unknown.pair.json";
  const blockedPath = recoveryTemporaries.get(blockedBasename) ? path.join(operationDirectory, recoveryTemporaries.get(blockedBasename)!) : path.join(operationDirectory, blockedBasename);
  try {
    const blockedPair = pairFromStored(readRecord(blockedPath), "statusRef", "statusHash", PREFIXES.status) as InternalProductionPreSchemaSpawnerRebindStatusPairV1;
    const blocked = await resolveInternalProductionPreSchemaSpawnerRebindStatusV1(blockedPair);
    if (blocked.state !== "blocked" || blocked.currentEntryOperation.operationRef !== operation.operationRef || blocked.currentEntryOperation.operationHash !== operation.operationHash) fail("persisted blocked status relation is crossed");
    if (canonical(blocked.authorization) !== canonical(locatorPairs[1]) || canonical(blocked.startupToken) !== canonical(locatorPairs[2]) || canonical(blocked.restartAuthority) !== canonical(locatorPairs[3]) || blocked.dispatchPrefix.phase !== "restart_authority_published") fail("persisted blocked status causal prefix is crossed");
    completeRecoveryTemporary(blockedBasename);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const lease = await acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1();
  let released = false;
  try {
    let authorizationBody: InternalProductionPreSchemaSpawnerRebindAuthorizationV1;
    let authorization: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
    let preDispatchLegacy: Awaited<ReturnType<typeof resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1>>;
    let predecessorCensus: Awaited<ReturnType<typeof observeInternalProductionServiceCensusV1>> | null = null;
    if (persisted[1]) {
      authorization = pairFromStored(persisted[1], "authorizationRef", "authorizationHash", PREFIXES.authorization) as InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
      if (authorization.authorizationRef !== expected.authorizationRef || authorization.authorizationHash !== expected.authorizationHash || !persisted[0]) fail("persisted authorization differs from input or lacks legacy prefix");
      authorizationBody = await resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1(authorization);
      preDispatchLegacy = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(pairFromStored(persisted[0], "observationRef", "observationHash", "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/") as { observationRef: string; observationHash: string });
      if (authorizationBody.currentEntryOperationRef !== operation.operationRef || authorizationBody.currentEntryOperationHash !== operation.operationHash || authorizationBody.legacyZeroOwnerObservationRef !== preDispatchLegacy.observationRef || authorizationBody.legacyZeroOwnerObservationHash !== preDispatchLegacy.observationHash) fail("persisted authorization prefix is crossed");
    } else {
      const derived = await deriveAuthorization();
      if (derived.body.authorizationRef !== expected.authorizationRef || derived.body.authorizationHash !== expected.authorizationHash || derived.operation.operationRef !== operation.operationRef || derived.operation.operationHash !== operation.operationHash) fail("authorization changed before mutation");
      authorizationBody = derived.body;
      preDispatchLegacy = derived.legacy;
      predecessorCensus = derived.census;
      writeNoReplace(recordPath("authorization", derived.body.authorizationHash), derived.body);
      authorization = pairFromBody(derived.body, "authorizationRef", "authorizationHash", PREFIXES.authorization) as InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1;
      publishOperationPair(operation.operationHash, "00-pre-dispatch-legacy-zero", { observationRef: derived.legacy.observationRef, observationHash: derived.legacy.observationHash });
      publishOperationPair(operation.operationHash, "01-authorization", authorization);
    }
    publishStatus(operation.operationHash, "00-prepared", { state: "prepared", currentEntryOperation: operation, authorization, startupToken: null, restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null, refusalCode: null });

    let startup: InternalProductionPreSchemaSpawnerStartupTokenV1;
    let startupToken: InternalProductionPreSchemaSpawnerStartupTokenPairV1;
    if (persisted[2]) {
      startupToken = pairFromStored(persisted[2], "startupTokenRef", "startupTokenHash", PREFIXES.startupToken) as InternalProductionPreSchemaSpawnerStartupTokenPairV1;
      startup = await resolveInternalProductionPreSchemaSpawnerStartupTokenV1(startupToken);
    } else {
      predecessorCensus ??= await observeInternalProductionServiceCensusV1();
      if (predecessorCensus.spawner.serviceIdentityHash !== authorizationBody.predecessorSpawnerServiceIdentityHash || predecessorCensus.spawner.generationHash !== authorizationBody.predecessorSpawnerGenerationHash || predecessorCensus.spawner.loadedSourceSha !== operationBody.controllerSource.sha || predecessorCensus.spawner.loadedTreeHash !== operationBody.controllerSource.treeHash || predecessorCensus.spawner.loadedBuildHash !== operationBody.controllerSource.buildHash) fail("predecessor census changed before startup token");
      const predecessorProcessHash = hashCanonicalJson({ schema: "setfarm.internal-production-spawner-process-identity.v1", pid: predecessorCensus.spawner.pid, processStartTimeEpochMs: predecessorCensus.spawner.processStartTimeEpochMs, processIdentityHash: predecessorCensus.spawner.processIdentityHash });
      writeNoReplace(recordPath("process-identity", predecessorProcessHash), {
        schema: "setfarm.internal-production-spawner-process-identity.v1",
        pid: predecessorCensus.spawner.pid,
        processStartTimeEpochMs: predecessorCensus.spawner.processStartTimeEpochMs,
        processIdentityHash: predecessorCensus.spawner.processIdentityHash,
      });
      startup = publishRecord("startup-token", {
        schema: "setfarm.internal-production-pre-schema-spawner-startup-token.v1",
        startupMode: "pre-manifest-bootstrap-sealed",
        currentEntryOperationRef: operation.operationRef,
        currentEntryOperationHash: operation.operationHash,
        preSchemaSpawnerRebindAuthorizationRef: authorization.authorizationRef,
        preSchemaSpawnerRebindAuthorizationHash: authorization.authorizationHash,
        task0SpawnerSourceSha: operationBody.controllerSource.sha,
        task0SpawnerTreeHash: operationBody.controllerSource.treeHash,
        task0SpawnerBuildHash: operationBody.controllerSource.buildHash,
        predecessorSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${predecessorProcessHash}`,
        predecessorSpawnerProcessIdentityHash: predecessorProcessHash,
        predecessorSpawnerServiceIdentityHash: predecessorCensus.spawner.serviceIdentityHash,
        predecessorSpawnerGenerationHash: predecessorCensus.spawner.generationHash,
      }, "startupTokenRef", "startupTokenHash", PREFIXES.startupToken) as InternalProductionPreSchemaSpawnerStartupTokenV1;
      startupToken = pairFromBody(startup, "startupTokenRef", "startupTokenHash", PREFIXES.startupToken) as InternalProductionPreSchemaSpawnerStartupTokenPairV1;
      publishOperationPair(operation.operationHash, "02-startup-token", startupToken);
    }
    if (startup.currentEntryOperationRef !== operation.operationRef || startup.currentEntryOperationHash !== operation.operationHash || startup.preSchemaSpawnerRebindAuthorizationRef !== authorization.authorizationRef || startup.preSchemaSpawnerRebindAuthorizationHash !== authorization.authorizationHash || startup.task0SpawnerSourceSha !== operationBody.controllerSource.sha || startup.task0SpawnerTreeHash !== operationBody.controllerSource.treeHash || startup.task0SpawnerBuildHash !== operationBody.controllerSource.buildHash || startup.predecessorSpawnerServiceIdentityHash !== authorizationBody.predecessorSpawnerServiceIdentityHash || startup.predecessorSpawnerGenerationHash !== authorizationBody.predecessorSpawnerGenerationHash || typeof startup.predecessorSpawnerProcessIdentityRef !== "string" || typeof startup.predecessorSpawnerProcessIdentityHash !== "string" || startup.predecessorSpawnerProcessIdentityRef !== `setfarm://internal-production/spawner-process-identity/sha256/${startup.predecessorSpawnerProcessIdentityHash}` || !SHA256.test(startup.predecessorSpawnerProcessIdentityHash)) fail("startup token prefix is crossed");
    publishStatus(operation.operationHash, "01-startup-token-published", { state: "startup_token_published", currentEntryOperation: operation, authorization, startupToken, restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null, refusalCode: null });

    let restart: InternalProductionPreSchemaSpawnerRestartAuthorityV1;
    let restartAuthority: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1;
    if (persisted[3]) {
      restartAuthority = pairFromStored(persisted[3], "restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority) as InternalProductionPreSchemaSpawnerRestartAuthorityPairV1;
      restart = await resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(restartAuthority);
    } else {
      const uid = process.getuid?.();
      if (!Number.isSafeInteger(uid) || (uid ?? -1) < 0) fail("restart UID is invalid");
      restart = publishRecord("restart-authority", {
        schema: "setfarm.internal-production-pre-schema-spawner-restart-authority.v1",
        actionId: "task6a-pre-schema-setfarm-spawner-rebind-v1",
        service: "setfarm-spawner",
        currentEntryOperationRef: operation.operationRef,
        currentEntryOperationHash: operation.operationHash,
        preSchemaSpawnerRebindAuthorizationRef: authorization.authorizationRef,
        preSchemaSpawnerRebindAuthorizationHash: authorization.authorizationHash,
        startupTokenRef: startupToken.startupTokenRef,
        startupTokenHash: startupToken.startupTokenHash,
        predecessorSpawnerProcessIdentityRef: startup.predecessorSpawnerProcessIdentityRef,
        predecessorSpawnerProcessIdentityHash: startup.predecessorSpawnerProcessIdentityHash,
        predecessorSpawnerServiceIdentityHash: startup.predecessorSpawnerServiceIdentityHash,
        predecessorSpawnerGenerationHash: startup.predecessorSpawnerGenerationHash,
        targetSpawnerSourceSha: operationBody.controllerSource.sha,
        targetSpawnerTreeHash: operationBody.controllerSource.treeHash,
        targetSpawnerBuildHash: operationBody.controllerSource.buildHash,
        uid,
        launchdLabel: "com.setrox.setfarm-spawner",
        executable: "/bin/launchctl",
        argv: ["kickstart", "-k", `gui/${uid}/com.setrox.setfarm-spawner`],
      }, "restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority) as InternalProductionPreSchemaSpawnerRestartAuthorityV1;
      restartAuthority = pairFromBody(restart, "restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority) as InternalProductionPreSchemaSpawnerRestartAuthorityPairV1;
      publishOperationPair(operation.operationHash, "03-restart-authority", restartAuthority);
    }
    if (restart.currentEntryOperationRef !== operation.operationRef || restart.currentEntryOperationHash !== operation.operationHash || restart.preSchemaSpawnerRebindAuthorizationRef !== authorization.authorizationRef || restart.preSchemaSpawnerRebindAuthorizationHash !== authorization.authorizationHash || restart.startupTokenRef !== startupToken.startupTokenRef || restart.startupTokenHash !== startupToken.startupTokenHash || restart.predecessorSpawnerProcessIdentityRef !== startup.predecessorSpawnerProcessIdentityRef || restart.predecessorSpawnerProcessIdentityHash !== startup.predecessorSpawnerProcessIdentityHash || restart.predecessorSpawnerServiceIdentityHash !== startup.predecessorSpawnerServiceIdentityHash || restart.predecessorSpawnerGenerationHash !== startup.predecessorSpawnerGenerationHash || restart.targetSpawnerSourceSha !== operationBody.controllerSource.sha || restart.targetSpawnerTreeHash !== operationBody.controllerSource.treeHash || restart.targetSpawnerBuildHash !== operationBody.controllerSource.buildHash) fail("restart authority prefix is crossed");
    let dispatchPrefix: DispatchPrefixV1 = deepFreeze({ phase: "restart_authority_published", predecessorTerminationObservation: null, replacementProcessObservation: null });
    publishStatus(operation.operationHash, "02-restart-authority-published", { state: "dispatching", currentEntryOperation: operation, authorization, startupToken, restartAuthority, dispatchPrefix, sealedAdmission: null, admissionReady: null, refusalCode: null });

    try {
      await invokeInternalProductionPreSchemaSpawnerRebindHelperUnderTransitionLeaseV1(lease, { currentEntryOperation: operation, restartAuthority });
    } catch (error) {
      if (error instanceof Error && error.message.includes("HELPER_DISPATCH_SETTLEMENT_UNKNOWN")) {
        publishStatus(operation.operationHash, "blocked-helper-dispatch-settlement-unknown", { state: "blocked", currentEntryOperation: operation, authorization, startupToken, restartAuthority, dispatchPrefix, sealedAdmission: null, admissionReady: null, refusalCode: "HELPER_DISPATCH_SETTLEMENT_UNKNOWN" });
      }
      throw error;
    }
    const predecessorIdentity = preflightPredecessorIdentity ?? readRecord(recordPath("process-identity", String(startup.predecessorSpawnerProcessIdentityHash)));
    exactKeys(predecessorIdentity, ["schema", "pid", "processStartTimeEpochMs", "processIdentityHash"], "predecessor process identity");
    if (predecessorIdentity.schema !== "setfarm.internal-production-spawner-process-identity.v1" || hashCanonicalJson(predecessorIdentity) !== startup.predecessorSpawnerProcessIdentityHash || predecessorIdentity.processIdentityHash === undefined) fail("predecessor process identity is crossed");
    let predecessor: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1;
    let predecessorTerminationObservation: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1;
    if (persisted[4]) {
      predecessorTerminationObservation = pairFromStored(persisted[4], "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation) as InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1;
      predecessor = await resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1(predecessorTerminationObservation);
    } else {
      await observePredecessorTerminationV1(Number(predecessorIdentity.pid), Number(predecessorIdentity.processStartTimeEpochMs));
      predecessor = publishRecord("predecessor-termination", {
      schema: "setfarm.internal-production-pre-schema-spawner-predecessor-termination-observation.v1",
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      preSchemaSpawnerRebindAuthorizationRef: authorization.authorizationRef,
      preSchemaSpawnerRebindAuthorizationHash: authorization.authorizationHash,
      startupTokenRef: startupToken.startupTokenRef,
      startupTokenHash: startupToken.startupTokenHash,
      restartAuthorityRef: restartAuthority.restartAuthorityRef,
      restartAuthorityHash: restartAuthority.restartAuthorityHash,
      predecessorSpawnerProcessIdentityRef: startup.predecessorSpawnerProcessIdentityRef,
      predecessorSpawnerProcessIdentityHash: startup.predecessorSpawnerProcessIdentityHash,
      predecessorSpawnerServiceIdentityHash: startup.predecessorSpawnerServiceIdentityHash,
      predecessorSpawnerGenerationHash: startup.predecessorSpawnerGenerationHash,
      observedProcessState: "terminal-and-not-running",
      observedListenerState: "absent",
      }, "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation) as InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1;
      predecessorTerminationObservation = pairFromBody(predecessor, "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation) as InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1;
      publishOperationPair(operation.operationHash, "04-predecessor-termination", predecessorTerminationObservation);
    }
    if (
      predecessor.currentEntryOperationRef !== operation.operationRef || predecessor.currentEntryOperationHash !== operation.operationHash
      || predecessor.preSchemaSpawnerRebindAuthorizationRef !== authorization.authorizationRef || predecessor.preSchemaSpawnerRebindAuthorizationHash !== authorization.authorizationHash
      || predecessor.startupTokenRef !== startupToken.startupTokenRef || predecessor.startupTokenHash !== startupToken.startupTokenHash
      || predecessor.restartAuthorityRef !== restartAuthority.restartAuthorityRef || predecessor.restartAuthorityHash !== restartAuthority.restartAuthorityHash
      || predecessor.predecessorSpawnerProcessIdentityRef !== startup.predecessorSpawnerProcessIdentityRef || predecessor.predecessorSpawnerProcessIdentityHash !== startup.predecessorSpawnerProcessIdentityHash
      || predecessor.predecessorSpawnerServiceIdentityHash !== startup.predecessorSpawnerServiceIdentityHash || predecessor.predecessorSpawnerGenerationHash !== startup.predecessorSpawnerGenerationHash
    ) fail("persisted predecessor termination prefix is crossed");
    dispatchPrefix = deepFreeze({ phase: "predecessor_terminated", predecessorTerminationObservation, replacementProcessObservation: null });
    publishStatus(operation.operationHash, "03-predecessor-terminated", { state: "dispatching", currentEntryOperation: operation, authorization, startupToken, restartAuthority, dispatchPrefix, sealedAdmission: null, admissionReady: null, refusalCode: null });

    let after: Awaited<ReturnType<typeof observeInternalProductionServiceCensusV1>> | null = null;
    let replacement: InternalProductionPreSchemaSpawnerReplacementProcessObservationV1;
    let replacementProcessObservation: InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1;
    if (persisted[5]) {
      replacementProcessObservation = pairFromStored(persisted[5], "replacementProcessObservationRef", "replacementProcessObservationHash", PREFIXES.replacementProcessObservation) as InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1;
      replacement = await resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1(replacementProcessObservation);
    } else {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const observed = await observeInternalProductionServiceCensusV1();
        if (observed.spawner.processIdentityHash !== predecessorIdentity.processIdentityHash && observed.spawner.serviceIdentityHash === startup.predecessorSpawnerServiceIdentityHash && observed.spawner.generationHash === startup.predecessorSpawnerGenerationHash && observed.spawner.loadedSourceSha === operationBody.controllerSource.sha && observed.spawner.loadedTreeHash === operationBody.controllerSource.treeHash && observed.spawner.loadedBuildHash === operationBody.controllerSource.buildHash) { after = observed; break; }
        if (attempt < 39) await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!after) fail("replacement spawner generation is invalid");
      const replacementProcessIdentity = {
        schema: "setfarm.internal-production-spawner-process-identity.v1",
        pid: after.spawner.pid,
        processStartTimeEpochMs: after.spawner.processStartTimeEpochMs,
        processIdentityHash: after.spawner.processIdentityHash,
      };
      const replacementProcessHash = hashCanonicalJson(replacementProcessIdentity);
      writeNoReplace(recordPath("process-identity", replacementProcessHash), replacementProcessIdentity);
      replacement = publishRecord("replacement-process", {
      schema: "setfarm.internal-production-pre-schema-spawner-replacement-process-observation.v1",
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      preSchemaSpawnerRebindAuthorizationRef: authorization.authorizationRef,
      preSchemaSpawnerRebindAuthorizationHash: authorization.authorizationHash,
      startupTokenRef: startupToken.startupTokenRef,
      startupTokenHash: startupToken.startupTokenHash,
      restartAuthorityRef: restartAuthority.restartAuthorityRef,
      restartAuthorityHash: restartAuthority.restartAuthorityHash,
      predecessorTerminationObservationRef: predecessorTerminationObservation.predecessorTerminationObservationRef,
      predecessorTerminationObservationHash: predecessorTerminationObservation.predecessorTerminationObservationHash,
      replacementSpawnerProcessIdentityRef: `setfarm://internal-production/spawner-process-identity/sha256/${replacementProcessHash}`,
      replacementSpawnerProcessIdentityHash: replacementProcessHash,
      replacementSpawnerServiceIdentityHash: after.spawner.serviceIdentityHash,
      actualSpawnerGenerationHash: after.spawner.generationHash,
      actualSpawnerSourceSha: after.spawner.loadedSourceSha,
      actualSpawnerTreeHash: after.spawner.loadedTreeHash,
      actualSpawnerBuildHash: after.spawner.loadedBuildHash,
      differsFromPredecessorProcessIdentity: true,
      startupMode: "pre-manifest-bootstrap-sealed",
      }, "replacementProcessObservationRef", "replacementProcessObservationHash", PREFIXES.replacementProcessObservation) as InternalProductionPreSchemaSpawnerReplacementProcessObservationV1;
      replacementProcessObservation = pairFromBody(replacement, "replacementProcessObservationRef", "replacementProcessObservationHash", PREFIXES.replacementProcessObservation) as InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1;
      publishOperationPair(operation.operationHash, "05-replacement-process", replacementProcessObservation);
    }
    const replacementIdentity = resolveSpawnerProcessIdentityV1(replacement.replacementSpawnerProcessIdentityRef, replacement.replacementSpawnerProcessIdentityHash, "replacement process identity");
    if (
      replacement.currentEntryOperationRef !== operation.operationRef || replacement.currentEntryOperationHash !== operation.operationHash
      || replacement.preSchemaSpawnerRebindAuthorizationRef !== authorization.authorizationRef || replacement.preSchemaSpawnerRebindAuthorizationHash !== authorization.authorizationHash
      || replacement.startupTokenRef !== startupToken.startupTokenRef || replacement.startupTokenHash !== startupToken.startupTokenHash
      || replacement.restartAuthorityRef !== restartAuthority.restartAuthorityRef || replacement.restartAuthorityHash !== restartAuthority.restartAuthorityHash
      || replacement.predecessorTerminationObservationRef !== predecessorTerminationObservation.predecessorTerminationObservationRef || replacement.predecessorTerminationObservationHash !== predecessorTerminationObservation.predecessorTerminationObservationHash
      || replacement.replacementSpawnerProcessIdentityHash === startup.predecessorSpawnerProcessIdentityHash
      || replacementIdentity.processIdentityHash === predecessorIdentity.processIdentityHash
      || replacement.replacementSpawnerServiceIdentityHash !== startup.predecessorSpawnerServiceIdentityHash
      || replacement.actualSpawnerGenerationHash !== startup.predecessorSpawnerGenerationHash
      || replacement.actualSpawnerSourceSha !== operationBody.controllerSource.sha || replacement.actualSpawnerTreeHash !== operationBody.controllerSource.treeHash || replacement.actualSpawnerBuildHash !== operationBody.controllerSource.buildHash
    ) fail("persisted replacement process prefix is crossed");
    dispatchPrefix = deepFreeze({ phase: "replacement_observed", predecessorTerminationObservation, replacementProcessObservation });
    publishStatus(operation.operationHash, "04-replacement-observed", { state: "dispatching", currentEntryOperation: operation, authorization, startupToken, restartAuthority, dispatchPrefix, sealedAdmission: null, admissionReady: null, refusalCode: null });

    let postZero: Awaited<ReturnType<typeof resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1>>;
    if (persisted[6]) {
      postZero = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(pairFromStored(persisted[6], "observationRef", "observationHash", "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/") as { observationRef: string; observationHash: string });
    } else {
      const postZeroObserved = await observeInternalProductionLegacyPreManifestZeroOwnerV1();
      postZero = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1({ observationRef: postZeroObserved.observationRef, observationHash: postZeroObserved.observationHash });
      publishOperationPair(operation.operationHash, "06-post-termination-legacy-zero", { observationRef: postZero.observationRef, observationHash: postZero.observationHash });
    }
    if (
      postZero.cleanSetfarmSourceSha !== operationBody.controllerSource.sha
      || postZero.cleanSetfarmTreeHash !== operationBody.controllerSource.treeHash
      || postZero.cleanSetfarmBuildHash !== operationBody.controllerSource.buildHash
      || postZero.observedSpawnerGenerationHash !== replacement.actualSpawnerGenerationHash
    ) fail("post-termination legacy zero prefix is crossed");
    let sealed: InternalProductionPreSchemaSpawnerSealedAdmissionV1;
    let sealedAdmission: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
    if (persisted[7]) {
      sealedAdmission = pairFromStored(persisted[7], "sealedAdmissionRef", "sealedAdmissionHash", PREFIXES.sealedAdmission) as InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
      sealed = await resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1(sealedAdmission);
    } else {
      sealed = publishRecord("sealed-admission", {
      schema: "setfarm.internal-production-pre-schema-spawner-sealed-admission.v1",
      state: "pre-manifest-bootstrap-sealed",
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      preSchemaSpawnerRebindAuthorizationRef: authorization.authorizationRef,
      preSchemaSpawnerRebindAuthorizationHash: authorization.authorizationHash,
      startupTokenRef: startupToken.startupTokenRef,
      startupTokenHash: startupToken.startupTokenHash,
      preSchemaSpawnerRestartAuthorityRef: restartAuthority.restartAuthorityRef,
      preSchemaSpawnerRestartAuthorityHash: restartAuthority.restartAuthorityHash,
      predecessorTerminationObservationRef: predecessorTerminationObservation.predecessorTerminationObservationRef,
      predecessorTerminationObservationHash: predecessorTerminationObservation.predecessorTerminationObservationHash,
      replacementProcessObservationRef: replacementProcessObservation.replacementProcessObservationRef,
      replacementProcessObservationHash: replacementProcessObservation.replacementProcessObservationHash,
      currentSpawnerGenerationHash: replacement.actualSpawnerGenerationHash,
      postPredecessorTerminationLegacyZeroOwnerObservationRef: postZero.observationRef,
      postPredecessorTerminationLegacyZeroOwnerObservationHash: postZero.observationHash,
      allOwnerProducerEntrypointsBlocked: true,
      }, "sealedAdmissionRef", "sealedAdmissionHash", PREFIXES.sealedAdmission) as InternalProductionPreSchemaSpawnerSealedAdmissionV1;
      sealedAdmission = pairFromBody(sealed, "sealedAdmissionRef", "sealedAdmissionHash", PREFIXES.sealedAdmission) as InternalProductionPreSchemaSpawnerSealedAdmissionPairV1;
      publishOperationPair(operation.operationHash, "07-sealed-admission", sealedAdmission);
    }
    if (
      sealed.currentEntryOperationRef !== operation.operationRef || sealed.currentEntryOperationHash !== operation.operationHash
      || sealed.preSchemaSpawnerRebindAuthorizationRef !== authorization.authorizationRef || sealed.preSchemaSpawnerRebindAuthorizationHash !== authorization.authorizationHash
      || sealed.startupTokenRef !== startupToken.startupTokenRef || sealed.startupTokenHash !== startupToken.startupTokenHash
      || sealed.preSchemaSpawnerRestartAuthorityRef !== restartAuthority.restartAuthorityRef || sealed.preSchemaSpawnerRestartAuthorityHash !== restartAuthority.restartAuthorityHash
      || sealed.predecessorTerminationObservationRef !== predecessorTerminationObservation.predecessorTerminationObservationRef || sealed.predecessorTerminationObservationHash !== predecessorTerminationObservation.predecessorTerminationObservationHash
      || sealed.replacementProcessObservationRef !== replacementProcessObservation.replacementProcessObservationRef || sealed.replacementProcessObservationHash !== replacementProcessObservation.replacementProcessObservationHash
      || sealed.currentSpawnerGenerationHash !== replacement.actualSpawnerGenerationHash
      || sealed.postPredecessorTerminationLegacyZeroOwnerObservationRef !== postZero.observationRef || sealed.postPredecessorTerminationLegacyZeroOwnerObservationHash !== postZero.observationHash
    ) fail("persisted sealed admission prefix is crossed");
    publishStatus(operation.operationHash, "05-pre-manifest-bootstrap-sealed", { state: "pre_manifest_bootstrap_sealed", currentEntryOperation: operation, authorization, startupToken, restartAuthority, dispatchPrefix, sealedAdmission, admissionReady: null, refusalCode: null });
    await resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1(sealedAdmission);
    await releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease);
    released = true;
    return restartAuthority;
  } finally {
    if (!released) {
      try { await releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1(lease); } catch { /* preserve the causal failure */ }
    }
  }
}

async function authenticateObservedOperationPrefixV1(
  operationBody: Awaited<ReturnType<typeof resolveInternalProductionCurrentEntryOperationV1>>,
  status: InternalProductionPreSchemaSpawnerRebindStatusV1,
): Promise<readonly (Readonly<Record<string, string>> | null)[]> {
  if (status.state === "absent") return Object.freeze([]);
  const operation = operationPair(operationBody);
  const specifications = [
    ["00-pre-dispatch-legacy-zero", "observationRef", "observationHash", "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/"],
    ["01-authorization", "authorizationRef", "authorizationHash", PREFIXES.authorization],
    ["02-startup-token", "startupTokenRef", "startupTokenHash", PREFIXES.startupToken],
    ["03-restart-authority", "restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority],
    ["04-predecessor-termination", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation],
    ["05-replacement-process", "replacementProcessObservationRef", "replacementProcessObservationHash", PREFIXES.replacementProcessObservation],
    ["06-post-termination-legacy-zero", "observationRef", "observationHash", "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/"],
    ["07-sealed-admission", "sealedAdmissionRef", "sealedAdmissionHash", PREFIXES.sealedAdmission],
    ["08-admission-ready", "admissionReadyRef", "admissionReadyHash", PREFIXES.admissionReady],
  ] as const;
  const pairs: Array<Readonly<Record<string, string>> | null> = [];
  let gap = false;
  for (const [locator, refKey, hashKey, prefix] of specifications) {
    try {
      const value = pairFromStored(readRecord(operationPath(operation.operationHash, locator)), refKey, hashKey, prefix);
      if (gap) fail("observed operation prefix is not contiguous");
      pairs.push(value);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") { gap = true; pairs.push(null); }
      else throw error;
    }
  }
  const requiredIndex = status.state === "prepared" ? 1
    : status.state === "startup_token_published" ? 2
      : status.state === "blocked" ? 3
        : status.state === "dispatching" ? status.dispatchPrefix.phase === "restart_authority_published" ? 3 : status.dispatchPrefix.phase === "predecessor_terminated" ? 4 : 5
          : status.state === "normal_task0_admission_ready" ? 8 : 7;
  if (pairs.slice(0, requiredIndex + 1).some((pair) => pair === null) || pairs.slice(requiredIndex + 1).some((pair) => pair !== null)) fail("observed status/material operation prefix is incomplete or ahead");
  const bodies: Array<Record<string, unknown>> = [];
  bodies[0] = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(pairs[0] as { observationRef: string; observationHash: string }) as unknown as Record<string, unknown>;
  bodies[1] = await resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1(pairs[1] as InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1) as unknown as Record<string, unknown>;
  if (requiredIndex >= 2) bodies[2] = await resolveInternalProductionPreSchemaSpawnerStartupTokenV1(pairs[2] as InternalProductionPreSchemaSpawnerStartupTokenPairV1) as unknown as Record<string, unknown>;
  if (requiredIndex >= 3) bodies[3] = await resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(pairs[3] as InternalProductionPreSchemaSpawnerRestartAuthorityPairV1) as unknown as Record<string, unknown>;
  if (requiredIndex >= 4) bodies[4] = await resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1(pairs[4] as InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1) as unknown as Record<string, unknown>;
  if (requiredIndex >= 5) bodies[5] = await resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1(pairs[5] as InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1) as unknown as Record<string, unknown>;
  if (requiredIndex >= 6) bodies[6] = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(pairs[6] as { observationRef: string; observationHash: string }) as unknown as Record<string, unknown>;
  if (requiredIndex >= 7) bodies[7] = await resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1(pairs[7] as InternalProductionPreSchemaSpawnerSealedAdmissionPairV1) as unknown as Record<string, unknown>;
  if (requiredIndex >= 8) bodies[8] = await resolveInternalProductionTask0SpawnerAdmissionReadyV1(pairs[8] as InternalProductionTask0SpawnerAdmissionReadyPairV1) as unknown as Record<string, unknown>;
  const source = operationBody.controllerSource;
  if (bodies[0]!.cleanSetfarmSourceSha !== source.sha || bodies[0]!.cleanSetfarmTreeHash !== source.treeHash || bodies[0]!.cleanSetfarmBuildHash !== source.buildHash || bodies[0]!.observedSpawnerGenerationHash !== bodies[1]!.predecessorSpawnerGenerationHash) fail("observed legacy prefix source/generation is crossed");
  if (bodies[1]!.currentEntryOperationRef !== operation.operationRef || bodies[1]!.currentEntryOperationHash !== operation.operationHash || bodies[1]!.legacyZeroOwnerObservationRef !== pairs[0]!.observationRef || bodies[1]!.legacyZeroOwnerObservationHash !== pairs[0]!.observationHash || bodies[1]!.authorizationRef !== pairs[1]!.authorizationRef || bodies[1]!.authorizationHash !== pairs[1]!.authorizationHash) fail("observed authorization prefix is crossed");
  if (bodies[1]!.authorityV3Migration31AuditRef !== operationBody.authorityV3Migration31Audit.authorityV3Migration31AuditRef || bodies[1]!.authorityV3Migration31AuditHash !== operationBody.authorityV3Migration31Audit.authorityV3Migration31AuditHash || bodies[1]!.cleanSetfarmSourceSha !== source.sha || bodies[1]!.cleanSetfarmTreeHash !== source.treeHash || bodies[1]!.cleanSetfarmBuildHash !== source.buildHash) fail("observed authorization audit/source is crossed");
  let observedPredecessorIdentity: Readonly<Record<string, unknown>> | null = null;
  if (requiredIndex >= 2) {
    const startup = bodies[2]!;
    if (startup.currentEntryOperationRef !== operation.operationRef || startup.currentEntryOperationHash !== operation.operationHash || startup.preSchemaSpawnerRebindAuthorizationRef !== pairs[1]!.authorizationRef || startup.preSchemaSpawnerRebindAuthorizationHash !== pairs[1]!.authorizationHash || startup.task0SpawnerSourceSha !== source.sha || startup.task0SpawnerTreeHash !== source.treeHash || startup.task0SpawnerBuildHash !== source.buildHash || startup.predecessorSpawnerServiceIdentityHash !== bodies[1]!.predecessorSpawnerServiceIdentityHash || startup.predecessorSpawnerGenerationHash !== bodies[1]!.predecessorSpawnerGenerationHash) fail("observed startup token prefix is crossed");
    observedPredecessorIdentity = resolveSpawnerProcessIdentityV1(startup.predecessorSpawnerProcessIdentityRef, startup.predecessorSpawnerProcessIdentityHash, "observed predecessor process identity");
  }
  if (requiredIndex >= 3) {
    const restart = bodies[3]!;
    const uid = process.getuid?.();
    if (restart.currentEntryOperationRef !== operation.operationRef || restart.currentEntryOperationHash !== operation.operationHash || restart.preSchemaSpawnerRebindAuthorizationRef !== pairs[1]!.authorizationRef || restart.preSchemaSpawnerRebindAuthorizationHash !== pairs[1]!.authorizationHash || restart.startupTokenRef !== pairs[2]!.startupTokenRef || restart.startupTokenHash !== pairs[2]!.startupTokenHash || restart.predecessorSpawnerProcessIdentityRef !== bodies[2]!.predecessorSpawnerProcessIdentityRef || restart.predecessorSpawnerProcessIdentityHash !== bodies[2]!.predecessorSpawnerProcessIdentityHash || restart.predecessorSpawnerServiceIdentityHash !== bodies[2]!.predecessorSpawnerServiceIdentityHash || restart.predecessorSpawnerGenerationHash !== bodies[2]!.predecessorSpawnerGenerationHash || restart.targetSpawnerSourceSha !== source.sha || restart.targetSpawnerTreeHash !== source.treeHash || restart.targetSpawnerBuildHash !== source.buildHash || restart.uid !== uid || restart.executable !== "/bin/launchctl" || canonical(restart.argv) !== canonical(["kickstart", "-k", `gui/${uid}/com.setrox.setfarm-spawner`])) fail("observed restart authority is crossed");
  }
  if (requiredIndex >= 4 && (bodies[4]!.currentEntryOperationRef !== operation.operationRef || bodies[4]!.currentEntryOperationHash !== operation.operationHash || bodies[4]!.preSchemaSpawnerRebindAuthorizationRef !== pairs[1]!.authorizationRef || bodies[4]!.preSchemaSpawnerRebindAuthorizationHash !== pairs[1]!.authorizationHash || bodies[4]!.startupTokenRef !== pairs[2]!.startupTokenRef || bodies[4]!.startupTokenHash !== pairs[2]!.startupTokenHash || bodies[4]!.restartAuthorityRef !== pairs[3]!.restartAuthorityRef || bodies[4]!.restartAuthorityHash !== pairs[3]!.restartAuthorityHash || bodies[4]!.predecessorSpawnerProcessIdentityRef !== bodies[2]!.predecessorSpawnerProcessIdentityRef || bodies[4]!.predecessorSpawnerProcessIdentityHash !== bodies[2]!.predecessorSpawnerProcessIdentityHash || bodies[4]!.predecessorSpawnerServiceIdentityHash !== bodies[2]!.predecessorSpawnerServiceIdentityHash || bodies[4]!.predecessorSpawnerGenerationHash !== bodies[2]!.predecessorSpawnerGenerationHash)) fail("observed predecessor termination is crossed");
  if (requiredIndex >= 5) {
    const observedReplacementIdentity = resolveSpawnerProcessIdentityV1(bodies[5]!.replacementSpawnerProcessIdentityRef, bodies[5]!.replacementSpawnerProcessIdentityHash, "observed replacement process identity");
    if (bodies[5]!.currentEntryOperationRef !== operation.operationRef || bodies[5]!.currentEntryOperationHash !== operation.operationHash || bodies[5]!.preSchemaSpawnerRebindAuthorizationRef !== pairs[1]!.authorizationRef || bodies[5]!.preSchemaSpawnerRebindAuthorizationHash !== pairs[1]!.authorizationHash || bodies[5]!.startupTokenRef !== pairs[2]!.startupTokenRef || bodies[5]!.startupTokenHash !== pairs[2]!.startupTokenHash || bodies[5]!.restartAuthorityRef !== pairs[3]!.restartAuthorityRef || bodies[5]!.restartAuthorityHash !== pairs[3]!.restartAuthorityHash || bodies[5]!.predecessorTerminationObservationRef !== pairs[4]!.predecessorTerminationObservationRef || bodies[5]!.predecessorTerminationObservationHash !== pairs[4]!.predecessorTerminationObservationHash || bodies[5]!.actualSpawnerSourceSha !== source.sha || bodies[5]!.actualSpawnerTreeHash !== source.treeHash || bodies[5]!.actualSpawnerBuildHash !== source.buildHash || bodies[5]!.actualSpawnerGenerationHash !== bodies[2]!.predecessorSpawnerGenerationHash || bodies[5]!.replacementSpawnerServiceIdentityHash !== bodies[2]!.predecessorSpawnerServiceIdentityHash || bodies[5]!.replacementSpawnerProcessIdentityHash === bodies[2]!.predecessorSpawnerProcessIdentityHash || observedReplacementIdentity.processIdentityHash === observedPredecessorIdentity?.processIdentityHash || bodies[5]!.differsFromPredecessorProcessIdentity !== true) fail("observed replacement process is crossed");
  }
  if (requiredIndex >= 6 && (bodies[6]!.cleanSetfarmSourceSha !== source.sha || bodies[6]!.cleanSetfarmTreeHash !== source.treeHash || bodies[6]!.cleanSetfarmBuildHash !== source.buildHash || bodies[6]!.observedSpawnerGenerationHash !== bodies[5]!.actualSpawnerGenerationHash)) fail("observed post-termination legacy zero is crossed");
  if (requiredIndex >= 7 && (bodies[7]!.currentEntryOperationRef !== operation.operationRef || bodies[7]!.currentEntryOperationHash !== operation.operationHash || bodies[7]!.preSchemaSpawnerRebindAuthorizationRef !== pairs[1]!.authorizationRef || bodies[7]!.preSchemaSpawnerRebindAuthorizationHash !== pairs[1]!.authorizationHash || bodies[7]!.startupTokenRef !== pairs[2]!.startupTokenRef || bodies[7]!.startupTokenHash !== pairs[2]!.startupTokenHash || bodies[7]!.preSchemaSpawnerRestartAuthorityRef !== pairs[3]!.restartAuthorityRef || bodies[7]!.preSchemaSpawnerRestartAuthorityHash !== pairs[3]!.restartAuthorityHash || bodies[7]!.predecessorTerminationObservationRef !== pairs[4]!.predecessorTerminationObservationRef || bodies[7]!.predecessorTerminationObservationHash !== pairs[4]!.predecessorTerminationObservationHash || bodies[7]!.replacementProcessObservationRef !== pairs[5]!.replacementProcessObservationRef || bodies[7]!.replacementProcessObservationHash !== pairs[5]!.replacementProcessObservationHash || bodies[7]!.postPredecessorTerminationLegacyZeroOwnerObservationRef !== pairs[6]!.observationRef || bodies[7]!.postPredecessorTerminationLegacyZeroOwnerObservationHash !== pairs[6]!.observationHash || bodies[7]!.currentSpawnerGenerationHash !== bodies[5]!.actualSpawnerGenerationHash)) fail("observed sealed admission is crossed");
  if (requiredIndex >= 8 && (bodies[8]!.currentEntryOperationRef !== operation.operationRef || bodies[8]!.currentEntryOperationHash !== operation.operationHash || bodies[8]!.preSchemaSpawnerRebindAuthorizationRef !== pairs[1]!.authorizationRef || bodies[8]!.preSchemaSpawnerRebindAuthorizationHash !== pairs[1]!.authorizationHash || bodies[8]!.startupTokenRef !== pairs[2]!.startupTokenRef || bodies[8]!.startupTokenHash !== pairs[2]!.startupTokenHash || bodies[8]!.restartAuthorityRef !== pairs[3]!.restartAuthorityRef || bodies[8]!.restartAuthorityHash !== pairs[3]!.restartAuthorityHash || bodies[8]!.predecessorTerminationObservationRef !== pairs[4]!.predecessorTerminationObservationRef || bodies[8]!.predecessorTerminationObservationHash !== pairs[4]!.predecessorTerminationObservationHash || bodies[8]!.replacementProcessObservationRef !== pairs[5]!.replacementProcessObservationRef || bodies[8]!.replacementProcessObservationHash !== pairs[5]!.replacementProcessObservationHash || bodies[8]!.sealedAdmissionRef !== pairs[7]!.sealedAdmissionRef || bodies[8]!.sealedAdmissionHash !== pairs[7]!.sealedAdmissionHash || bodies[8]!.unchangedSpawnerGenerationHash !== bodies[5]!.actualSpawnerGenerationHash)) fail("observed admission-ready authority is crossed");
  const relationFields: ReadonlyArray<readonly [number, string, string, number]> = [
    [3, "startupTokenRef", "startupTokenHash", 2], [4, "restartAuthorityRef", "restartAuthorityHash", 3],
    [5, "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", 4],
    [7, "replacementProcessObservationRef", "replacementProcessObservationHash", 5],
    [7, "postPredecessorTerminationLegacyZeroOwnerObservationRef", "postPredecessorTerminationLegacyZeroOwnerObservationHash", 6],
  ];
  for (const [bodyIndex, refKey, hashKey, pairIndex] of relationFields) {
    if (requiredIndex < bodyIndex) continue;
    if (bodies[bodyIndex]![refKey] !== pairs[pairIndex]![specifications[pairIndex]![1]] || bodies[bodyIndex]![hashKey] !== pairs[pairIndex]![specifications[pairIndex]![2]]) fail("observed material causal relation is crossed");
  }
  if (canonical(status.authorization) !== canonical(pairs[1]) || (requiredIndex >= 2 && canonical(status.startupToken) !== canonical(pairs[2])) || (requiredIndex >= 3 && canonical(status.restartAuthority) !== canonical(pairs[3])) || (requiredIndex >= 7 && canonical(status.sealedAdmission) !== canonical(pairs[7])) || (requiredIndex >= 8 && canonical(status.admissionReady) !== canonical(pairs[8]))) fail("observed status nested material pair is crossed");
  if (status.dispatchPrefix !== null && ((status.dispatchPrefix.predecessorTerminationObservation !== null && canonical(status.dispatchPrefix.predecessorTerminationObservation) !== canonical(pairs[4])) || (status.dispatchPrefix.replacementProcessObservation !== null && canonical(status.dispatchPrefix.replacementProcessObservation) !== canonical(pairs[5])))) fail("observed status dispatch material pair is crossed");
  return Object.freeze(pairs);
}

function authenticateObservedStatusHistoryV1(
  status: InternalProductionPreSchemaSpawnerRebindStatusV1,
  ordinal: 0 | 1 | 2 | 3 | 4 | 5 | 6 | "blocked",
  pairs: readonly (Readonly<Record<string, string>> | null)[],
): void {
  const exact = (actual: unknown, index: number): boolean => canonical(actual) === canonical(pairs[index]);
  if (!exact(status.authorization, 1)) fail("historical status authorization pair is crossed");
  if (ordinal !== 0 && !exact(status.startupToken, 2)) fail("historical status startup pair is crossed");
  if (ordinal !== 0 && ordinal !== 1 && !exact(status.restartAuthority, 3)) fail("historical status restart pair is crossed");
  if (ordinal === 0 && status.state !== "prepared") fail("historical prepared status ordinal is crossed");
  if (ordinal === 1 && status.state !== "startup_token_published") fail("historical startup status ordinal is crossed");
  if (ordinal === 2 || ordinal === "blocked") {
    if ((ordinal === 2 && status.state !== "dispatching") || (ordinal === "blocked" && (status.state !== "blocked" || status.refusalCode !== "HELPER_DISPATCH_SETTLEMENT_UNKNOWN")) || status.dispatchPrefix?.phase !== "restart_authority_published" || status.dispatchPrefix.predecessorTerminationObservation !== null || status.dispatchPrefix.replacementProcessObservation !== null) fail("historical restart/blocked status prefix is crossed");
  }
  if (ordinal === 3 && (status.state !== "dispatching" || status.dispatchPrefix?.phase !== "predecessor_terminated" || !exact(status.dispatchPrefix.predecessorTerminationObservation, 4) || status.dispatchPrefix.replacementProcessObservation !== null)) fail("historical predecessor status prefix is crossed");
  if (typeof ordinal === "number" && ordinal >= 4 && (status.dispatchPrefix?.phase !== "replacement_observed" || !exact(status.dispatchPrefix.predecessorTerminationObservation, 4) || !exact(status.dispatchPrefix.replacementProcessObservation, 5))) fail("historical replacement status prefix is crossed");
  if (ordinal === 4 && status.state !== "dispatching") fail("historical replacement status ordinal is crossed");
  if ((ordinal === 5 || ordinal === 6) && !exact(status.sealedAdmission, 7)) fail("historical sealed status pair is crossed");
  if (ordinal === 5 && (status.state !== "pre_manifest_bootstrap_sealed" || status.admissionReady !== null)) fail("historical sealed status ordinal is crossed");
  if (ordinal === 6 && (status.state !== "normal_task0_admission_ready" || !exact(status.admissionReady, 8))) fail("historical ready status ordinal is crossed");
}

export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1(): Promise<InternalProductionPreSchemaSpawnerRebindStatusV1> {
  const prepared = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (prepared === null) return statusBody({ state: "absent", currentEntryOperation: null, authorization: null, startupToken: null, restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null, refusalCode: null });
  const operationBody = await resolveInternalProductionCurrentEntryOperationV1(operationPair(prepared));
  const operation = operationPair(operationBody);
  const directory = path.dirname(operationPath(operation.operationHash, "status-00-prepared"));
  let inventory: string[];
  try { inventory = readdirSync(directory).sort(); } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return statusBody({ state: "absent", currentEntryOperation: null, authorization: null, startupToken: null, restartAuthority: null, dispatchPrefix: null, sealedAdmission: null, admissionReady: null, refusalCode: null });
    throw error;
  }
  const allowed = [
    ["status-00-prepared.pair.json", "prepared"],
    ["status-01-startup-token-published.pair.json", "startup_token_published"],
    ["status-02-restart-authority-published.pair.json", "dispatching"],
    ["status-03-predecessor-terminated.pair.json", "dispatching"],
    ["status-04-replacement-observed.pair.json", "dispatching"],
    ["status-05-pre-manifest-bootstrap-sealed.pair.json", "pre_manifest_bootstrap_sealed"],
    ["status-06-normal-task0-admission-ready.pair.json", "normal_task0_admission_ready"],
  ] as const;
  const blockedLocator = "status-blocked-helper-dispatch-settlement-unknown.pair.json";
  const operationLocators = ["00-pre-dispatch-legacy-zero.pair.json", "01-authorization.pair.json", "02-startup-token.pair.json", "03-restart-authority.pair.json", "04-predecessor-termination.pair.json", "05-replacement-process.pair.json", "06-post-termination-legacy-zero.pair.json", "07-sealed-admission.pair.json", "08-admission-ready.pair.json"];
  if (inventory.some((name) => !allowed.some(([locator]) => locator === name) && name !== blockedLocator && !operationLocators.includes(name))) fail("operation inventory contains an unknown locator");
  let lastStatusPair: Record<string, unknown> | null = null;
  let causalStatus: InternalProductionPreSchemaSpawnerRebindStatusV1 | null = null;
  const statusHistory: Array<Readonly<{ ordinal: 0 | 1 | 2 | 3 | 4 | 5 | 6 | "blocked"; status: InternalProductionPreSchemaSpawnerRebindStatusV1 }>> = [];
  let missingSeen = false;
  for (const [ordinal, [locator, expectedState]] of allowed.entries()) {
    try {
      const candidate = readRecord(path.join(directory, locator));
      if (missingSeen) fail("status prefix is not contiguous");
      const candidatePair = pairFromStored(candidate, "statusRef", "statusHash", PREFIXES.status) as InternalProductionPreSchemaSpawnerRebindStatusPairV1;
      const resolved = await resolveInternalProductionPreSchemaSpawnerRebindStatusV1(candidatePair);
      if (resolved.state !== expectedState || resolved.currentEntryOperation?.operationRef !== operation.operationRef || resolved.currentEntryOperation.operationHash !== operation.operationHash) fail("status ordinal or operation relation is crossed");
      if (causalStatus !== null) {
        for (const field of ["currentEntryOperation", "authorization", "startupToken", "restartAuthority"] as const) {
          if (causalStatus[field] !== null && canonical(causalStatus[field]) !== canonical(resolved[field])) fail("status causal prefix is crossed");
        }
      }
      causalStatus = resolved;
      statusHistory.push(Object.freeze({ ordinal: ordinal as 0 | 1 | 2 | 3 | 4 | 5 | 6, status: resolved }));
      lastStatusPair = candidate;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      missingSeen = true;
    }
  }
  if (lastStatusPair === null) fail("status prefix is empty");
  try {
    const blocked = readRecord(path.join(directory, blockedLocator));
    const blockedPair = pairFromStored(blocked, "statusRef", "statusHash", PREFIXES.status) as InternalProductionPreSchemaSpawnerRebindStatusPairV1;
    const blockedStatus = await resolveInternalProductionPreSchemaSpawnerRebindStatusV1(blockedPair);
    if (blockedStatus.state !== "blocked" || blockedStatus.currentEntryOperation.operationRef !== operation.operationRef || blockedStatus.currentEntryOperation.operationHash !== operation.operationHash) fail("blocked status operation relation is crossed");
    statusHistory.push(Object.freeze({ ordinal: "blocked", status: blockedStatus }));
    if (!allowed.slice(3).some(([locator]) => {
      try { readRecord(path.join(directory, locator)); return true; } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
        throw error;
      }
    })) lastStatusPair = blocked;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const resolved = await resolveInternalProductionPreSchemaSpawnerRebindStatusV1({ statusRef: String(lastStatusPair.statusRef), statusHash: String(lastStatusPair.statusHash) });
  const materialPairs = await authenticateObservedOperationPrefixV1(operationBody, resolved);
  for (const historical of statusHistory) authenticateObservedStatusHistoryV1(historical.status, historical.ordinal, materialPairs);
  const afterInventory = readdirSync(directory).sort();
  if (canonical(afterInventory) !== canonical(inventory)) fail("operation/status inventory changed while observed");
  return resolved;
}

export async function resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1(input: InternalProductionPreSchemaSpawnerRebindAuthorizationPairV1): Promise<InternalProductionPreSchemaSpawnerRebindAuthorizationV1> { return resolveBody(input, "authorization", "authorizationRef", "authorizationHash", PREFIXES.authorization); }
export async function resolveInternalProductionPreSchemaSpawnerRebindStatusV1(input: InternalProductionPreSchemaSpawnerRebindStatusPairV1): Promise<InternalProductionPreSchemaSpawnerRebindStatusV1> { return resolveBody(input, "status", "statusRef", "statusHash", PREFIXES.status); }
export async function resolveInternalProductionPreSchemaSpawnerStartupTokenV1(input: InternalProductionPreSchemaSpawnerStartupTokenPairV1): Promise<InternalProductionPreSchemaSpawnerStartupTokenV1> { return resolveBody(input, "startup-token", "startupTokenRef", "startupTokenHash", PREFIXES.startupToken); }
export async function resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1(input: InternalProductionPreSchemaSpawnerRestartAuthorityPairV1): Promise<InternalProductionPreSchemaSpawnerRestartAuthorityV1> { return resolveBody(input, "restart-authority", "restartAuthorityRef", "restartAuthorityHash", PREFIXES.restartAuthority); }
export async function resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1(input: InternalProductionPreSchemaSpawnerPredecessorTerminationObservationPairV1): Promise<InternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1> { return resolveBody(input, "predecessor-termination", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", PREFIXES.predecessorTerminationObservation); }
export async function resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1(input: InternalProductionPreSchemaSpawnerReplacementProcessObservationPairV1): Promise<InternalProductionPreSchemaSpawnerReplacementProcessObservationV1> { return resolveBody(input, "replacement-process", "replacementProcessObservationRef", "replacementProcessObservationHash", PREFIXES.replacementProcessObservation); }
export async function resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1(input: InternalProductionPreSchemaSpawnerSealedAdmissionPairV1): Promise<InternalProductionPreSchemaSpawnerSealedAdmissionV1> { return resolveBody(input, "sealed-admission", "sealedAdmissionRef", "sealedAdmissionHash", PREFIXES.sealedAdmission); }
export async function resolveInternalProductionTask0SpawnerAdmissionReadyV1(input: InternalProductionTask0SpawnerAdmissionReadyPairV1): Promise<InternalProductionTask0SpawnerAdmissionReadyV1> {
  const ready = resolveBody<InternalProductionTask0SpawnerAdmissionReadyV1>(input, "admission-ready", "admissionReadyRef", "admissionReadyHash", PREFIXES.admissionReady);
  const sealed = await resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1({ sealedAdmissionRef: ready.sealedAdmissionRef, sealedAdmissionHash: ready.sealedAdmissionHash });
  if (ready.currentEntryOperationRef !== sealed.currentEntryOperationRef || ready.currentEntryOperationHash !== sealed.currentEntryOperationHash || ready.preSchemaSpawnerRebindAuthorizationRef !== sealed.preSchemaSpawnerRebindAuthorizationRef || ready.preSchemaSpawnerRebindAuthorizationHash !== sealed.preSchemaSpawnerRebindAuthorizationHash || ready.startupTokenRef !== sealed.startupTokenRef || ready.startupTokenHash !== sealed.startupTokenHash || ready.restartAuthorityRef !== sealed.preSchemaSpawnerRestartAuthorityRef || ready.restartAuthorityHash !== sealed.preSchemaSpawnerRestartAuthorityHash || ready.predecessorTerminationObservationRef !== sealed.predecessorTerminationObservationRef || ready.predecessorTerminationObservationHash !== sealed.predecessorTerminationObservationHash || ready.replacementProcessObservationRef !== sealed.replacementProcessObservationRef || ready.replacementProcessObservationHash !== sealed.replacementProcessObservationHash || ready.unchangedSpawnerGenerationHash !== sealed.currentSpawnerGenerationHash) fail("admission ready/sealed relation is crossed");
  return ready;
}
