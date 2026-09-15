import { createHash } from "node:crypto";

// Historical codecs only. A valid hash chain is not evidence of current process
// liveness, reservation ownership, zero references, or permission to mutate.
const HASH = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const START = /^[A-Z][a-z]{2} [A-Z][a-z]{2} (?: [1-9]|[12][0-9]|3[01]) [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}$/;
const INTENT = "setfarm.build-generation-maintenance-intent.v1";
const CLAIM = "setfarm.build-generation-maintenance-owner-claim.v1";
const PREFIX = "setfarm://build-generation-maintenance/";
const intentFields = ["candidateCompletionHash", "controllerSourceHash", "retainedBuildHash", "launcherConfigurationHash"];
const ownerFields = ["uid", "pid", "processLstart", "processGroupId", "bootSessionHash", "reservationNonce"];
const fail = () => { throw Error("MAINTENANCE_JOURNAL_INVALID"); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;

function dataSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length > 16 || keys.some(key => typeof key !== "string" || !descriptors[key].enumerable || !("value" in descriptors[key]))) fail();
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function exact(value, keys) {
  const snapshot = dataSnapshot(value);
  if (Object.keys(snapshot).sort().join("\n") !== [...keys].sort().join("\n")) fail();
  return snapshot;
}
function requireHash(value) { if (typeof value !== "string" || !HASH.test(value)) fail(); }
function freeze(value) {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function ownerBody(owner) {
  owner = exact(owner, ownerFields);
  if (!Number.isSafeInteger(owner.uid) || owner.uid < 0 || !Number.isSafeInteger(owner.pid) || owner.pid < 1
    || !Number.isSafeInteger(owner.processGroupId) || owner.processGroupId < 1
    || typeof owner.processLstart !== "string" || !START.test(owner.processLstart)
    || typeof owner.reservationNonce !== "string" || !UUID.test(owner.reservationNonce)) fail();
  requireHash(owner.bootSessionHash);
  return { ...owner };
}

export function normalizeMaintenanceOwnerV1(owner) {
  return freeze(ownerBody(owner));
}
function pair(body, kind) {
  const digest = hash(canonical(body));
  const stem = kind === "intent" ? "maintenanceIntent" : "ownerClaim";
  return freeze({ ...body, [`${stem}Ref`]: `${PREFIX}${kind}/sha256/${digest}`, [`${stem}Hash`]: digest });
}
function validate(record) {
  record = dataSnapshot(record);
  let body, kind;
  if (record?.schema === INTENT) {
    exact(record, ["schema", ...intentFields, "maintenanceIntentRef", "maintenanceIntentHash"]);
    for (const field of intentFields) requireHash(record[field]);
    const { maintenanceIntentRef, maintenanceIntentHash, ...rest } = record;
    body = rest; kind = "intent";
  } else if (record?.schema === CLAIM) {
    exact(record, ["schema", "maintenanceIntentHash", "ordinal", "previousOwnerClaimHash", "previousOwnerDeathObservationHash", "owner", "ownerClaimRef", "ownerClaimHash"]);
    requireHash(record.maintenanceIntentHash);
    if (!Number.isSafeInteger(record.ordinal) || record.ordinal < 1 || record.ordinal > 4096) fail();
    if (record.ordinal === 1) {
      if (record.previousOwnerClaimHash !== null || record.previousOwnerDeathObservationHash !== null) fail();
    } else {
      requireHash(record.previousOwnerClaimHash); requireHash(record.previousOwnerDeathObservationHash);
    }
    const { ownerClaimRef, ownerClaimHash, ...rest } = record;
    body = { ...rest, owner: ownerBody(record.owner) }; kind = "owner-claim";
    record = { ...record, owner: body.owner };
  } else fail();
  const expected = pair(body, kind);
  if (canonical(record) !== canonical(expected)) fail();
  return expected;
}

export function createMaintenanceIntentV1(input) {
  input = exact(input, intentFields);
  for (const field of intentFields) requireHash(input[field]);
  return pair({ schema: INTENT, ...input }, "intent");
}

function assertSuccessor(previous, next) {
  if (previous.maintenanceIntentHash !== next.maintenanceIntentHash || next.ordinal !== previous.ordinal + 1
    || next.previousOwnerClaimHash !== previous.ownerClaimHash) fail();
  if (["uid", "pid", "processLstart", "bootSessionHash"].every(key => previous.owner[key] === next.owner[key])) fail();
}

export function createMaintenanceOwnerClaimV1(intent, owner, previousClaim = null, previousOwnerDeathObservationHash = null) {
  const validatedIntent = validate(intent);
  if (validatedIntent.schema !== INTENT) fail();
  const previous = previousClaim === null ? null : validate(previousClaim);
  if (previous !== null && previous.schema !== CLAIM) fail();
  const record = pair({ schema: CLAIM, maintenanceIntentHash: validatedIntent.maintenanceIntentHash,
    ordinal: previous === null ? 1 : previous.ordinal + 1,
    previousOwnerClaimHash: previous?.ownerClaimHash ?? null,
    previousOwnerDeathObservationHash, owner: ownerBody(owner) }, "owner-claim");
  validate(record);
  if (previous !== null) assertSuccessor(previous, record);
  return record;
}

export function encodeMaintenanceJournalRecordV1(record) {
  const bytes = Buffer.from(`${canonical(validate(record))}\n`);
  if (bytes.length > 65536) fail();
  return bytes;
}

function parse(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 65536) fail();
  let record;
  try { record = JSON.parse(bytes.toString("utf8")); } catch { fail(); }
  const validated = validate(record);
  if (!bytes.equals(encodeMaintenanceJournalRecordV1(validated))) fail();
  return validated;
}

export function parseMaintenanceOwnerHistoryV1(intentBytes, claimBytes) {
  const intent = parse(intentBytes);
  if (intent.schema !== INTENT || !Array.isArray(claimBytes) || claimBytes.length > 4096) fail();
  const claims = [];
  for (let index = 0; index < claimBytes.length; index++) {
    const claim = parse(claimBytes[index]);
    if (claim.schema !== CLAIM || claim.maintenanceIntentHash !== intent.maintenanceIntentHash || claim.ordinal !== index + 1) fail();
    if (index > 0) assertSuccessor(claims[index - 1], claim);
    claims.push(claim);
  }
  return freeze({ intent, claims });
}
