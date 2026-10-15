import { types } from "node:util";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";

const SCHEMA = "setfarm.internal-production-dashboard-cutover-control-message.v2";
const BASE = ["schema", "kind", "exchangeNonce", "childSourceHash", "childBuildHash"] as const;
const CHALLENGED = [...BASE, "challengeNonce", "phase6IntentHash", "ownerClaimHash"] as const;
const fail: () => never = () => { throw Error("DASHBOARD_CUTOVER_CONTROL_MESSAGE_INVALID"); };
type Base = Readonly<{ schema: typeof SCHEMA; exchangeNonce: string; childSourceHash: string; childBuildHash: string }>;
export type DashboardCutoverControlMessageV2 = (Base & Readonly<{ kind: "HELLO" }>)
  | (Base & Readonly<{ kind: "CHALLENGE" | "ACK" | "GRANT"; challengeNonce: string; phase6IntentHash: string; ownerClaimHash: string }>);

// DATA ONLY. Even GRANT decoding does not authenticate a peer, enforce exchange
// freshness, consume phase/owner authority or create a startup capability.
function validate(value: unknown): DashboardCutoverControlMessageV2 {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(value), kind = fields.kind?.value as unknown;
  if (kind !== "HELLO" && kind !== "CHALLENGE" && kind !== "ACK" && kind !== "GRANT") fail();
  const keys = kind === "HELLO" ? BASE : CHALLENGED, actual = Reflect.ownKeys(fields);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string"
    || !(keys as readonly string[]).includes(key) || !fields[key]!.enumerable || !("value" in fields[key]!))) fail();
  const copy: Record<string, string> = {};
  for (const key of keys) {
    const field = fields[key]!.value as unknown;
    if (typeof field !== "string") fail();
    if (key === "schema" ? field !== SCHEMA : key !== "kind" && !/^[a-f0-9]{64}$/.test(field)) fail();
    copy[key] = field;
  }
  return Object.freeze(copy) as DashboardCutoverControlMessageV2;
}

function ownedBytes(value: unknown): Buffer {
  if (types.isProxy(value) || !types.isUint8Array(value)) fail();
  // Buffer.isBuffer may consult caller ancestry on this runtime. Establish the
  // Buffer brand without walking through any proxy, then use byte intrinsics.
  let prototype: object | null = Object.getPrototypeOf(value) as object | null, depth = 0;
  while (prototype !== Buffer.prototype) {
    if (prototype === null || types.isProxy(prototype) || depth++ >= 128) fail();
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }
  const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!.call(value) as number;
  if (length < 1 || length > 1024) fail();
  const copy = Buffer.alloc(length);
  Uint8Array.prototype.set.call(copy, value as Uint8Array);
  return copy;
}

export function encodeDashboardCutoverControlMessageV2(message: unknown): Buffer {
  try {
    if (arguments.length !== 1) fail();
    const bytes = Buffer.from(`${canonicalJsonStringify(validate(message))}\n`, "utf8");
    if (bytes.length < 1 || bytes.length > 1024) fail();
    return bytes;
  } catch { return fail(); }
}

export function decodeDashboardCutoverControlMessageV2(bytes: unknown): DashboardCutoverControlMessageV2 {
  try {
    if (arguments.length !== 1) fail();
    const original = ownedBytes(bytes), decoded = validate(JSON.parse(original.toString("utf8")) as unknown);
    if (!original.equals(Buffer.from(`${canonicalJsonStringify(decoded)}\n`, "utf8"))) fail();
    return decoded;
  } catch { return fail(); }
}
