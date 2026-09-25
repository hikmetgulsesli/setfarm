import { types } from "node:util";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

// Historical grammar only. No owner, launchd, process or dispatch authority.
const PURPOSE = "preserved-deployment-cutover-service-quiescence";
const INTENT_SCHEMA = "setfarm.internal-production-deployment-cutover-service-effect-intent.v1";
const COMPLETION_SCHEMA = "setfarm.internal-production-deployment-cutover-service-effect-completion.v1";
const INTENT_PREFIX = "setfarm://internal-production/deployment-cutover-service-effect-intent/sha256/";
const COMPLETION_PREFIX = "setfarm://internal-production/deployment-cutover-service-effect-completion/sha256/";
const INPUT_KEYS = ["cutoverIntentHash", "ownerClaimHash", "ordinal", "previousCompletionHash",
  "beforeLauncherObservationHash", "beforeProcessObservationHash"] as const;
const INTENT_BODY_KEYS = ["schema", "purpose", ...INPUT_KEYS, "action", "maximumDispatchCount"] as const;
const COMPLETION_BODY_KEYS = ["schema", "purpose", "effectIntentHash", "cutoverIntentHash", "ownerClaimHash",
  "ordinal", "action", "afterLauncherObservationHash", "afterProcessObservationHash", "disposition"] as const;
const fail = (): never => { throw Error("DEPLOYMENT_CUTOVER_SERVICE_EFFECT_RECORD_INVALID"); };

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(fields);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key)
    || !fields[key]!.enumerable || !("value" in fields[key]!))) fail();
  return Object.fromEntries(keys.map(key => [key, fields[key]!.value as unknown]));
}
function sha(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value as string;
}
function ordinalAction(value: unknown): "bootout-spawner" | "bootout-dashboard" {
  if (value === 1) return "bootout-spawner";
  if (value === 2) return "bootout-dashboard";
  return fail();
}
function ownedBytes(value: unknown): Buffer {
  if (types.isProxy(value) || !types.isUint8Array(value) || !Buffer.isBuffer(value)) fail();
  const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!.call(value) as number;
  if (length < 1 || length > 65536) fail();
  const copy = Buffer.alloc(length);
  Uint8Array.prototype.set.call(copy, value as Uint8Array);
  return copy;
}
function decode(bytes: unknown): unknown {
  const owned = ownedBytes(bytes);
  let parsed: unknown;
  try { parsed = JSON.parse(owned.toString("utf8")); } catch { fail(); }
  if (!owned.equals(Buffer.from(`${canonicalJsonStringify(parsed)}\n`))) fail();
  return parsed;
}
function encode(value: unknown): Buffer {
  const bytes = Buffer.from(`${canonicalJsonStringify(value)}\n`);
  if (bytes.length > 65536) fail();
  return bytes;
}

export type DeploymentCutoverServiceEffectIntentV1 = Readonly<{
  schema: typeof INTENT_SCHEMA; purpose: typeof PURPOSE;
  cutoverIntentHash: string; ownerClaimHash: string; ordinal: 1 | 2;
  action: "bootout-spawner" | "bootout-dashboard"; previousCompletionHash: string | null;
  beforeLauncherObservationHash: string; beforeProcessObservationHash: string;
  maximumDispatchCount: 1; effectIntentHash: string; effectIntentRef: string;
}>;
export type DeploymentCutoverServiceEffectCompletionV1 = Readonly<{
  schema: typeof COMPLETION_SCHEMA; purpose: typeof PURPOSE; effectIntentHash: string;
  cutoverIntentHash: string; ownerClaimHash: string; ordinal: 1 | 2;
  action: "bootout-spawner" | "bootout-dashboard";
  afterLauncherObservationHash: string; afterProcessObservationHash: string;
  disposition: "recorded-after-observation"; effectCompletionHash: string; effectCompletionRef: string;
}>;

export function createDeploymentCutoverServiceEffectIntentV1(input: unknown): DeploymentCutoverServiceEffectIntentV1 {
  const row = exact(input, INPUT_KEYS), action = ordinalAction(row.ordinal);
  const previousCompletionHash = row.ordinal === 1 ? null : sha(row.previousCompletionHash);
  if (row.ordinal === 1 && row.previousCompletionHash !== null) fail();
  const body = { schema: INTENT_SCHEMA, purpose: PURPOSE, cutoverIntentHash: sha(row.cutoverIntentHash),
    ownerClaimHash: sha(row.ownerClaimHash), ordinal: row.ordinal as 1 | 2, action, previousCompletionHash,
    beforeLauncherObservationHash: sha(row.beforeLauncherObservationHash),
    beforeProcessObservationHash: sha(row.beforeProcessObservationHash), maximumDispatchCount: 1 as const } as const;
  const effectIntentHash = hashCanonicalJson(body);
  return Object.freeze({ ...body, effectIntentHash, effectIntentRef: INTENT_PREFIX + effectIntentHash });
}
function validateIntent(value: unknown): DeploymentCutoverServiceEffectIntentV1 {
  const row = exact(value, [...INTENT_BODY_KEYS, "effectIntentHash", "effectIntentRef"]);
  if (row.schema !== INTENT_SCHEMA || row.purpose !== PURPOSE || row.maximumDispatchCount !== 1) fail();
  const expected = createDeploymentCutoverServiceEffectIntentV1(Object.fromEntries(INPUT_KEYS.map(key => [key, row[key]])));
  if (row.action !== expected.action || row.effectIntentHash !== expected.effectIntentHash
    || row.effectIntentRef !== expected.effectIntentRef) fail();
  return expected;
}
export function encodeDeploymentCutoverServiceEffectIntentV1(value: unknown): Buffer {
  return encode(validateIntent(value));
}

export function createDeploymentCutoverServiceEffectCompletionV1(input: unknown): DeploymentCutoverServiceEffectCompletionV1 {
  const row = exact(input, ["intent", "afterLauncherObservationHash", "afterProcessObservationHash"]);
  const intent = validateIntent(row.intent);
  const body = { schema: COMPLETION_SCHEMA, purpose: PURPOSE, effectIntentHash: intent.effectIntentHash,
    cutoverIntentHash: intent.cutoverIntentHash, ownerClaimHash: intent.ownerClaimHash,
    ordinal: intent.ordinal, action: intent.action,
    afterLauncherObservationHash: sha(row.afterLauncherObservationHash),
    afterProcessObservationHash: sha(row.afterProcessObservationHash),
    disposition: "recorded-after-observation" as const } as const;
  const effectCompletionHash = hashCanonicalJson(body);
  return Object.freeze({ ...body, effectCompletionHash, effectCompletionRef: COMPLETION_PREFIX + effectCompletionHash });
}
function validateCompletion(value: unknown): DeploymentCutoverServiceEffectCompletionV1 {
  const row = exact(value, [...COMPLETION_BODY_KEYS, "effectCompletionHash", "effectCompletionRef"]);
  if (row.schema !== COMPLETION_SCHEMA || row.purpose !== PURPOSE || row.disposition !== "recorded-after-observation"
    || row.action !== ordinalAction(row.ordinal)) fail();
  const body = { schema: COMPLETION_SCHEMA, purpose: PURPOSE, effectIntentHash: sha(row.effectIntentHash),
    cutoverIntentHash: sha(row.cutoverIntentHash), ownerClaimHash: sha(row.ownerClaimHash),
    ordinal: row.ordinal as 1 | 2, action: ordinalAction(row.ordinal),
    afterLauncherObservationHash: sha(row.afterLauncherObservationHash),
    afterProcessObservationHash: sha(row.afterProcessObservationHash), disposition: "recorded-after-observation" as const } as const;
  const effectCompletionHash = hashCanonicalJson(body);
  if (row.effectCompletionHash !== effectCompletionHash || row.effectCompletionRef !== COMPLETION_PREFIX + effectCompletionHash) fail();
  return Object.freeze({ ...body, effectCompletionHash, effectCompletionRef: COMPLETION_PREFIX + effectCompletionHash });
}
export function encodeDeploymentCutoverServiceEffectCompletionV1(value: unknown): Buffer {
  return encode(validateCompletion(value));
}

function byteList(value: unknown): readonly Buffer[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 2) fail();
  const list = value as unknown[];
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (keys.length !== list.length + 1 || keys.some(key => typeof key !== "string"
    || (key !== "length" && (!/^(?:0|1)$/.test(key) || Number(key) >= list.length
      || !fields[key]!.enumerable || !("value" in fields[key]!))))) fail();
  return Object.freeze(Array.from({ length: list.length }, (_, index) => ownedBytes(fields[String(index)]!.value)));
}

export function parseDeploymentCutoverServiceEffectHistoryV1(intentBytes: unknown, completionBytes: unknown) {
  const rawIntents = byteList(intentBytes), rawCompletions = byteList(completionBytes);
  if (rawCompletions.length > rawIntents.length || rawIntents.length > rawCompletions.length + 1) fail();
  const intents = rawIntents.map(bytes => validateIntent(decode(bytes)));
  const completions = rawCompletions.map(bytes => validateCompletion(decode(bytes)));
  for (let index = 0; index < intents.length; index++) {
    const intent = intents[index]!;
    if (intent.ordinal !== index + 1 || (index === 1 && (intent.previousCompletionHash !== completions[0]?.effectCompletionHash
      || intent.cutoverIntentHash !== intents[0]!.cutoverIntentHash))) fail();
    const completion = completions[index];
    if (completion && (completion.effectIntentHash !== intent.effectIntentHash
      || completion.cutoverIntentHash !== intent.cutoverIntentHash || completion.ownerClaimHash !== intent.ownerClaimHash
      || completion.ordinal !== intent.ordinal || completion.action !== intent.action)) fail();
  }
  const historicalState = intents.length === 0 ? "empty"
    : completions.length < intents.length ? "unsettled"
      : intents.length === 1 ? "recorded-prefix" : "recorded-complete";
  return Object.freeze({ schema: "setfarm.internal-production-deployment-cutover-service-effect-history.v1" as const,
    authority: "history-only" as const, historicalState,
    intents: Object.freeze(intents), completions: Object.freeze(completions) });
}
