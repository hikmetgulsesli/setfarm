import { types } from "node:util";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

// Historical links only: no owner, exclusion, dispatch, takeover or READY authority.
const PURPOSE = "preserved-dashboard-cutover";
const INTENT_SCHEMA = "setfarm.internal-production-dashboard-cutover-effect-intent.v2";
const COMPLETION_SCHEMA = "setfarm.internal-production-dashboard-cutover-effect-completion.v2";
const INTENT_PREFIX = "setfarm://internal-production/dashboard-cutover-effect-intent/sha256/";
const COMPLETION_PREFIX = "setfarm://internal-production/dashboard-cutover-effect-completion/sha256/";
const ACTIONS = ["bootout-spawner", "bootout-dashboard", "drain-old-dashboard", "select-new-cli",
  "restore-dashboard-launcher", "authenticate-new-dashboard"] as const;
const OUTCOMES = ["launcher-unloaded", "launcher-unloaded", "original-process-exited", "selector-selected",
  "launcher-restored", "dashboard-authenticated"] as const;
const INPUT_KEYS = ["cutoverIntentHash", "ownerClaimHash", "ordinal", "previousCompletionHash",
  "beforeObservationHash"] as const;
const INTENT_BODY_KEYS = ["schema", "purpose", ...INPUT_KEYS, "action", "maximumDispatchCount"] as const;
const COMPLETION_BODY_KEYS = ["schema", "purpose", "effectIntentHash", "cutoverIntentHash", "ownerClaimHash",
  "completionOwnerClaimHash", "ordinal", "action", "afterObservationHash", "outcome"] as const;
const fail = (): never => { throw Error("DASHBOARD_CUTOVER_RECORD_INVALID"); };

type Ordinal = 1 | 2 | 3 | 4 | 5 | 6;
type Action = typeof ACTIONS[number];
type Outcome = typeof OUTCOMES[number] | "already-absent";
export type DashboardCutoverIntentV2 = Readonly<{
  schema: typeof INTENT_SCHEMA; purpose: typeof PURPOSE; cutoverIntentHash: string;
  ownerClaimHash: string; ordinal: Ordinal; previousCompletionHash: string | null;
  beforeObservationHash: string; action: Action; maximumDispatchCount: 1;
  effectIntentHash: string; effectIntentRef: string;
}>;
export type DashboardCutoverCompletionV2 = Readonly<{
  schema: typeof COMPLETION_SCHEMA; purpose: typeof PURPOSE; effectIntentHash: string;
  cutoverIntentHash: string; ownerClaimHash: string; completionOwnerClaimHash: string;
  ordinal: Ordinal; action: Action; afterObservationHash: string; outcome: Outcome;
  effectCompletionHash: string; effectCompletionRef: string;
}>;

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(fields);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key)
    || !fields[key]!.enumerable || !("value" in fields[key]!))) fail();
  return Object.fromEntries(keys.map(key => [key, fields[key]!.value as unknown]));
}
function sha(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value as string;
}
function ordinal(value: unknown): Ordinal {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 6) fail();
  return value as Ordinal;
}
function outcome(value: unknown, step: Ordinal): Outcome {
  if (value !== OUTCOMES[step - 1] && !(step === 3 && value === "already-absent")) fail();
  return value as Outcome;
}
function ownedBytes(value: unknown): Buffer {
  if (types.isProxy(value) || !types.isUint8Array(value)) fail();
  // Buffer.isBuffer uses instanceof on this Node runtime, which can invoke a
  // proxy prototype trap. Establish the same Buffer ancestry without touching
  // any proxy. Custom own byte-container properties remain unread.
  let prototype: object | null = Object.getPrototypeOf(value) as object | null;
  let depth = 0;
  while (prototype !== Buffer.prototype) {
    if (prototype === null || types.isProxy(prototype) || depth++ >= 128) fail();
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }
  const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!
    .call(value) as number;
  if (length < 1 || length > 65536) fail();
  const copy = Buffer.alloc(length);
  Uint8Array.prototype.set.call(copy, value as Uint8Array);
  return copy;
}
function decode(bytes: unknown): unknown {
  const owned = ownedBytes(bytes);
  try {
    const parsed: unknown = JSON.parse(owned.toString("utf8"));
    if (!owned.equals(Buffer.from(`${canonicalJsonStringify(parsed)}\n`, "utf8"))) fail();
    return parsed;
  } catch { return fail(); }
}
function encode(value: unknown): Buffer {
  const bytes = Buffer.from(`${canonicalJsonStringify(value)}\n`, "utf8");
  if (bytes.length < 1 || bytes.length > 65536) fail();
  return bytes;
}

export function createDashboardCutoverIntentV2(input: unknown): DashboardCutoverIntentV2 {
  const row = exact(input, INPUT_KEYS), step = ordinal(row.ordinal);
  const previousCompletionHash = step === 1 ? null : sha(row.previousCompletionHash);
  if (step === 1 && row.previousCompletionHash !== null) fail();
  const body = { schema: INTENT_SCHEMA, purpose: PURPOSE, cutoverIntentHash: sha(row.cutoverIntentHash),
    ownerClaimHash: sha(row.ownerClaimHash), ordinal: step, previousCompletionHash,
    beforeObservationHash: sha(row.beforeObservationHash), action: ACTIONS[step - 1]!, maximumDispatchCount: 1 } as const;
  const effectIntentHash = hashCanonicalJson(body);
  return Object.freeze({ ...body, effectIntentHash, effectIntentRef: INTENT_PREFIX + effectIntentHash });
}
function validateIntent(value: unknown): DashboardCutoverIntentV2 {
  const row = exact(value, [...INTENT_BODY_KEYS, "effectIntentHash", "effectIntentRef"]);
  if (row.schema !== INTENT_SCHEMA || row.purpose !== PURPOSE || row.maximumDispatchCount !== 1) fail();
  const expected = createDashboardCutoverIntentV2(Object.fromEntries(INPUT_KEYS.map(key => [key, row[key]])));
  if (row.action !== expected.action || row.effectIntentHash !== expected.effectIntentHash
    || row.effectIntentRef !== expected.effectIntentRef) fail();
  return expected;
}
export function encodeDashboardCutoverIntentV2(value: unknown): Buffer {
  return encode(validateIntent(value));
}

export function createDashboardCutoverCompletionV2(input: unknown): DashboardCutoverCompletionV2 {
  const row = exact(input, ["intent", "completionOwnerClaimHash", "afterObservationHash", "outcome"]);
  const intent = validateIntent(row.intent);
  const body = { schema: COMPLETION_SCHEMA, purpose: PURPOSE, effectIntentHash: intent.effectIntentHash,
    cutoverIntentHash: intent.cutoverIntentHash, ownerClaimHash: intent.ownerClaimHash,
    completionOwnerClaimHash: sha(row.completionOwnerClaimHash), ordinal: intent.ordinal, action: intent.action,
    afterObservationHash: sha(row.afterObservationHash), outcome: outcome(row.outcome, intent.ordinal) } as const;
  const effectCompletionHash = hashCanonicalJson(body);
  return Object.freeze({ ...body, effectCompletionHash, effectCompletionRef: COMPLETION_PREFIX + effectCompletionHash });
}
function validateCompletion(value: unknown): DashboardCutoverCompletionV2 {
  const row = exact(value, [...COMPLETION_BODY_KEYS, "effectCompletionHash", "effectCompletionRef"]);
  const step = ordinal(row.ordinal), action = ACTIONS[step - 1]!;
  if (row.schema !== COMPLETION_SCHEMA || row.purpose !== PURPOSE || row.action !== action) fail();
  const body = { schema: COMPLETION_SCHEMA, purpose: PURPOSE, effectIntentHash: sha(row.effectIntentHash),
    cutoverIntentHash: sha(row.cutoverIntentHash), ownerClaimHash: sha(row.ownerClaimHash),
    completionOwnerClaimHash: sha(row.completionOwnerClaimHash), ordinal: step, action,
    afterObservationHash: sha(row.afterObservationHash), outcome: outcome(row.outcome, step) } as const;
  const effectCompletionHash = hashCanonicalJson(body);
  if (row.effectCompletionHash !== effectCompletionHash
    || row.effectCompletionRef !== COMPLETION_PREFIX + effectCompletionHash) fail();
  return Object.freeze({ ...body, effectCompletionHash, effectCompletionRef: COMPLETION_PREFIX + effectCompletionHash });
}
export function encodeDashboardCutoverCompletionV2(value: unknown): Buffer {
  return encode(validateCompletion(value));
}

function byteList(value: unknown): readonly Buffer[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  const length = fields.length!.value as number;
  if (length > 6 || keys.length !== length + 1 || keys.some(key => typeof key !== "string"
    || (key !== "length" && (!/^[0-5]$/.test(key) || Number(key) >= length
      || !fields[key]!.enumerable || !("value" in fields[key]!))))) fail();
  return Object.freeze(Array.from({ length }, (_, index) => ownedBytes(fields[String(index)]!.value)));
}

export function parseDashboardCutoverHistoryV2(intentBytes: unknown, completionBytes: unknown) {
  const rawIntents = byteList(intentBytes), rawCompletions = byteList(completionBytes);
  if (rawCompletions.length > rawIntents.length || rawIntents.length > rawCompletions.length + 1) fail();
  const intents = rawIntents.map(bytes => validateIntent(decode(bytes)));
  const completions = rawCompletions.map(bytes => validateCompletion(decode(bytes)));
  for (let index = 0; index < intents.length; index++) {
    const intent = intents[index]!;
    if (intent.ordinal !== index + 1 || (index > 0
      && (intent.previousCompletionHash !== completions[index - 1]!.effectCompletionHash
        || intent.cutoverIntentHash !== intents[0]!.cutoverIntentHash))) fail();
    const completion = completions[index];
    if (completion && (completion.effectIntentHash !== intent.effectIntentHash
      || completion.cutoverIntentHash !== intent.cutoverIntentHash || completion.ownerClaimHash !== intent.ownerClaimHash
      || completion.ordinal !== intent.ordinal || completion.action !== intent.action)) fail();
  }
  const historicalState = intents.length === 0 ? "empty"
    : completions.length < intents.length ? "unsettled"
      : intents.length === 6 ? "dashboard-recorded" : "recorded-prefix";
  return Object.freeze({ schema: "setfarm.internal-production-dashboard-cutover-history.v2" as const,
    authority: "history-only" as const, historicalState,
    intents: Object.freeze(intents), completions: Object.freeze(completions) });
}
