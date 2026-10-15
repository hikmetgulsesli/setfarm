import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

// Independent oracle: no production canonicalizer or record builder.
type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
const canonical = (value: Json): string => value === null || typeof value !== "object"
  ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(",")}}`;
const hash = (body: Json) => createHash("sha256").update(canonical(body), "utf8").digest("hex");
const wire = (record: Json) => Buffer.from(`${canonical(record)}\n`, "utf8");
const hex = (letter: string) => letter.repeat(64);
const invalid = /DASHBOARD_CUTOVER_RECORD_INVALID/;
const actions = ["bootout-spawner", "bootout-dashboard", "drain-old-dashboard", "select-new-cli",
  "restore-dashboard-launcher", "authenticate-new-dashboard"] as const;
const outcomes = ["launcher-unloaded", "launcher-unloaded", "original-process-exited", "selector-selected",
  "launcher-restored", "dashboard-authenticated"] as const;
const intentRef = "setfarm://internal-production/dashboard-cutover-effect-intent/sha256/";
const completionRef = "setfarm://internal-production/dashboard-cutover-effect-completion/sha256/";

function sealIntent(body: { [key: string]: Json }): { [key: string]: Json; effectIntentHash: string; effectIntentRef: string } {
  const effectIntentHash = hash(body);
  return { ...body, effectIntentHash, effectIntentRef: intentRef + effectIntentHash };
}
function sealCompletion(body: { [key: string]: Json }): { [key: string]: Json; effectCompletionHash: string; effectCompletionRef: string } {
  const effectCompletionHash = hash(body);
  return { ...body, effectCompletionHash, effectCompletionRef: completionRef + effectCompletionHash };
}
function resealIntent(record: { [key: string]: Json }, changes: { [key: string]: Json }) {
  const { effectIntentHash: _hash, effectIntentRef: _ref, ...body } = record;
  return sealIntent({ ...body, ...changes });
}
function resealCompletion(record: { [key: string]: Json }, changes: { [key: string]: Json }) {
  const { effectCompletionHash: _hash, effectCompletionRef: _ref, ...body } = record;
  return sealCompletion({ ...body, ...changes });
}
function fixture() {
  const intents: ReturnType<typeof sealIntent>[] = [];
  const completions: ReturnType<typeof sealCompletion>[] = [];
  for (let index = 0; index < 6; index++) {
    // Later dispatch and completion owners deliberately differ: historical recovery is legal.
    const intent = sealIntent({ schema: "setfarm.internal-production-dashboard-cutover-effect-intent.v2",
      purpose: "preserved-dashboard-cutover", cutoverIntentHash: hex("a"),
      ownerClaimHash: index < 2 ? hex("b") : hex("c"), ordinal: index + 1,
      previousCompletionHash: index === 0 ? null : completions[index - 1]!.effectCompletionHash,
      beforeObservationHash: hex("d"), action: actions[index]!, maximumDispatchCount: 1 });
    intents.push(intent);
    completions.push(sealCompletion({ schema: "setfarm.internal-production-dashboard-cutover-effect-completion.v2",
      purpose: "preserved-dashboard-cutover", effectIntentHash: intent.effectIntentHash,
      cutoverIntentHash: hex("a"), ownerClaimHash: intent.ownerClaimHash!,
      completionOwnerClaimHash: hex("e"), ordinal: index + 1, action: actions[index]!,
      afterObservationHash: hex("f"), outcome: outcomes[index]! }));
  }
  return { intents, completions, intentBytes: intents.map(wire), completionBytes: completions.map(wire) };
}
const load = () => import("../../src/internal-production/baseline-dashboard-cutover-records-v2.js");
const firstInput = () => ({ cutoverIntentHash: hex("a"), ownerClaimHash: hex("b"), ordinal: 1,
  previousCompletionHash: null, beforeObservationHash: hex("d") });

// Closed transport payloads are data, never a process/phase/startup capability.
const loadControl = () => import("../../src/internal-production/baseline-dashboard-cutover-control-wire-v2.js");
const controlInvalid = /DASHBOARD_CUTOVER_CONTROL_MESSAGE_INVALID/;
const hello = () => ({ schema: "setfarm.internal-production-dashboard-cutover-control-message.v2",
  kind: "HELLO", exchangeNonce: hex("a"), childSourceHash: hex("b"), childBuildHash: hex("c") });
const challenged = (kind = "CHALLENGE") => ({ ...hello(), kind, challengeNonce: hex("d"),
  phase6IntentHash: hex("e"), ownerClaimHash: hex("f") });

for (const kind of ["HELLO", "CHALLENGE", "ACK", "GRANT"]) {
  test(`control ${kind} matches independent canonical bytes and frozen data only`, async () => {
    const codec = await loadControl(), expected = kind === "HELLO" ? hello() : challenged(kind);
    const bytes = wire(expected), encoded = codec.encodeDashboardCutoverControlMessageV2(expected);
    assert.deepEqual(encoded, bytes);
    const decoded = codec.decodeDashboardCutoverControlMessageV2(bytes);
    assert.deepEqual(decoded, expected); assert.ok(Object.isFrozen(decoded));
    assert.notEqual(decoded, expected); assert.notEqual(encoded, bytes);
    expected.childBuildHash = hex("0"); bytes.fill(0);
    assert.equal(decoded.childBuildHash, hex("c"));
    assert.deepEqual(Object.keys(decoded).sort(), kind === "HELLO"
      ? ["childBuildHash", "childSourceHash", "exchangeNonce", "kind", "schema"]
      : ["challengeNonce", "childBuildHash", "childSourceHash", "exchangeNonce", "kind", "ownerClaimHash", "phase6IntentHash", "schema"]);
  });
}

for (const changes of [{ kind: "READY" }, { schema: "PRIVATE_SECRET" }, { exchangeNonce: hex("A") },
  { childSourceHash: "b".repeat(63) }, { childBuildHash: 9 }, { exchangeNonce: null },
  { pid: 4105 }, { permission: true }, { url: "PRIVATE_SECRET" }] as Record<string, Json>[]) {
  test(`control payload rejects wrong ${Object.keys(changes)[0]} without disclosure`, async () => {
    const codec = await loadControl(), message = { ...hello(), ...changes };
    for (const invoke of [() => codec.encodeDashboardCutoverControlMessageV2(message),
      () => codec.decodeDashboardCutoverControlMessageV2(wire(message))]) {
      assert.throws(invoke, error => error instanceof Error && error.message === "DASHBOARD_CUTOVER_CONTROL_MESSAGE_INVALID");
    }
  });
}

test("control phase fields are absent on HELLO and all required on every challenged kind", async () => {
  const codec = await loadControl();
  const bad = (message: { [key: string]: Json }) => {
    assert.throws(() => codec.encodeDashboardCutoverControlMessageV2(message), controlInvalid);
    assert.throws(() => codec.decodeDashboardCutoverControlMessageV2(wire(message)), controlInvalid);
  };
  for (const key of ["challengeNonce", "phase6IntentHash", "ownerClaimHash"]) {
    bad({ ...hello(), [key]: hex("d") });
    for (const kind of ["CHALLENGE", "ACK", "GRANT"]) {
      const missing: Record<string, string> = challenged(kind); delete missing[key]; bad(missing);
      for (const value of ["", hex("A"), "f".repeat(65), null, {}, 8]) bad({ ...challenged(kind), [key]: value });
    }
  }
  for (const key of Object.keys(hello())) {
    const missing: Record<string, string> = hello(); delete missing[key]; bad(missing);
  }
});

test("control descriptor validation invokes no caller traps, accessors or serializers", async () => {
  const codec = await loadControl(); let traps = 0;
  const trap = () => { traps++; throw Error("PRIVATE_SECRET"); };
  const proxied = new Proxy(hello(), { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap });
  const getter = hello(), hidden = hello();
  Object.defineProperty(getter, "exchangeNonce", { enumerable: true, get: trap });
  Object.defineProperty(hidden, "exchangeNonce", { enumerable: false, value: hex("a") });
  for (const input of [proxied, getter, hidden, Object.assign(hello(), { toJSON: trap }),
    Object.assign(hello(), { [Symbol()]: true }), Object.assign(Object.create(null), hello()),
    { ...hello(), childSourceHash: proxied }, Object.create(hello()), [], null, "PRIVATE_SECRET", trap]) {
    assert.throws(() => codec.encodeDashboardCutoverControlMessageV2(input), controlInvalid);
  }
  assert.equal(traps, 0);
});

for (const fault of ["missing-LF", "CRLF", "spaces", "key-order", "duplicate-key", "two-frames", "NUL", "invalid-UTF8", "oversized", "empty"]) {
  test(`control ${fault} wire refuses the complete frame`, async () => {
    const codec = await loadControl(), original = wire(hello());
    const malformed = fault === "missing-LF" ? original.subarray(0, -1)
      : fault === "CRLF" ? Buffer.from(original.toString().slice(0, -1) + "\r\n")
      : fault === "spaces" ? Buffer.from(" " + original.toString())
      : fault === "key-order" ? Buffer.from(JSON.stringify(hello()) + "\n")
      : fault === "duplicate-key" ? Buffer.from(original.toString().replace('{', '{"kind":"HELLO",'))
      : fault === "two-frames" ? Buffer.concat([original, original])
      : fault === "NUL" ? Buffer.concat([original, Buffer.from([0])])
      : fault === "invalid-UTF8" ? Buffer.from([255, 10])
      : fault === "oversized" ? Buffer.alloc(1025, 32) : Buffer.alloc(0);
    assert.throws(() => codec.decodeDashboardCutoverControlMessageV2(malformed), controlInvalid);
  });
}

test("control byte ownership ignores caller Buffer properties and rejects proxy ancestry before traps", async () => {
  const codec = await loadControl(); let traps = 0;
  const trap = () => { traps++; throw Error("PRIVATE_SECRET"); };
  const bytes = wire(hello());
  for (const key of ["length", "toString", "equals", Symbol.iterator]) Object.defineProperty(bytes, key, { get: trap });
  assert.deepEqual(codec.decodeDashboardCutoverControlMessageV2(bytes), hello());
  const proxy = new Proxy(Buffer.from("PRIVATE_SECRET"), { get: trap, getPrototypeOf: trap });
  const prototype = new Proxy(Buffer.prototype, { get: trap, getPrototypeOf: trap });
  const foreign = wire(hello()); Object.setPrototypeOf(foreign, prototype);
  for (const input of [proxy, foreign, new Uint8Array(wire(hello())), wire(hello()).toString(), null]) {
    assert.throws(() => codec.decodeDashboardCutoverControlMessageV2(input), controlInvalid);
  }
  assert.equal(traps, 0);
});

test("control codec enforces exactly one argument before touching hostile inputs", async () => {
  const codec = await loadControl(); let traps = 0;
  const proxy = new Proxy({}, { get(){ traps++; throw Error("PRIVATE_SECRET"); }, getPrototypeOf(){ traps++; throw Error("PRIVATE_SECRET"); } });
  for (const operation of [codec.encodeDashboardCutoverControlMessageV2, codec.decodeDashboardCutoverControlMessageV2]) {
    const invoke = operation as (...args: unknown[]) => unknown;
    assert.throws(() => invoke(), controlInvalid);
    assert.throws(() => invoke(proxy, proxy), controlInvalid);
  }
  assert.equal(traps, 0);
});

test("control Buffer ancestry is bounded at128 intermediates and deeper proxies remain zero-trap", async () => {
  const codec = await loadControl();
  for (const depth of [128, 129]) {
    const bytes = wire(hello()); let prototype: object = Buffer.prototype;
    for (let index = 0; index < depth; index++) prototype = Object.create(prototype) as object;
    Object.setPrototypeOf(bytes, prototype);
    if (depth === 128) assert.deepEqual(codec.decodeDashboardCutoverControlMessageV2(bytes), hello());
    else assert.throws(() => codec.decodeDashboardCutoverControlMessageV2(bytes), controlInvalid);
  }
  let traps = 0;
  const trap = () => { traps++; throw Error("PRIVATE_SECRET"); };
  const proxy = new Proxy(Buffer.prototype, { get: trap, getPrototypeOf: trap });
  const bytes = wire(hello()); Object.setPrototypeOf(bytes, Object.create(Object.create(proxy)) as object);
  assert.throws(() => codec.decodeDashboardCutoverControlMessageV2(bytes), controlInvalid);
  assert.equal(traps, 0);
});

test("control detached original byte storage refuses with the fixed public error", async () => {
  const codec = await loadControl(), storage = new ArrayBuffer(512), bytes = Buffer.from(storage);
  structuredClone(storage, { transfer: [storage] });
  assert.throws(() => codec.decodeDashboardCutoverControlMessageV2(bytes), error =>
    error instanceof Error && error.message === "DASHBOARD_CUTOVER_CONTROL_MESSAGE_INVALID");
});

test("all six builders match independent literal canonical bodies, hashes and wire", async () => {
  const records = await load(), expected = fixture();
  for (let index = 0; index < 6; index++) {
    const literal = expected.intents[index]!;
    const intent = records.createDashboardCutoverIntentV2({ cutoverIntentHash: literal.cutoverIntentHash,
      ownerClaimHash: literal.ownerClaimHash, ordinal: index + 1,
      previousCompletionHash: literal.previousCompletionHash, beforeObservationHash: literal.beforeObservationHash });
    assert.deepEqual(intent, literal);
    assert.deepEqual(records.encodeDashboardCutoverIntentV2(intent), expected.intentBytes[index]);
    const completion = records.createDashboardCutoverCompletionV2({ intent,
      completionOwnerClaimHash: hex("e"), afterObservationHash: hex("f"), outcome: outcomes[index] });
    assert.deepEqual(completion, expected.completions[index]);
    assert.deepEqual(records.encodeDashboardCutoverCompletionV2(completion), expected.completionBytes[index]);
    assert.ok(Object.isFrozen(intent) && Object.isFrozen(completion));
  }
});

test("every settled and pending prefix is explicit and history-only", async () => {
  const records = await load(), expected = fixture();
  for (let count = 0; count <= 6; count++) {
    const settled = records.parseDashboardCutoverHistoryV2(
      expected.intentBytes.slice(0, count), expected.completionBytes.slice(0, count));
    assert.equal(settled.schema, "setfarm.internal-production-dashboard-cutover-history.v2");
    assert.equal(settled.authority, "history-only");
    assert.equal(settled.historicalState, count === 0 ? "empty" : count === 6 ? "dashboard-recorded" : "recorded-prefix");
    assert.deepEqual(settled.intents, expected.intents.slice(0, count));
    assert.deepEqual(settled.completions, expected.completions.slice(0, count));
    assert.deepEqual(Object.keys(settled).sort(), ["authority", "completions", "historicalState", "intents", "schema"]);
    assert.ok(Object.isFrozen(settled) && Object.isFrozen(settled.intents) && Object.isFrozen(settled.completions));
    for (const record of [...settled.intents, ...settled.completions]) assert.ok(Object.isFrozen(record));
    if (count < 6) assert.equal(records.parseDashboardCutoverHistoryV2(
      expected.intentBytes.slice(0, count + 1), expected.completionBytes.slice(0, count)).historicalState, "unsettled");
  }
  assert.equal(records.parseDashboardCutoverHistoryV2(expected.intentBytes, expected.completionBytes).intents[3]!.action,
    "select-new-cli");
});

test("reconciliation owner may change, but original dispatch owner cannot change", async () => {
  const records = await load(), expected = fixture();
  const history = records.parseDashboardCutoverHistoryV2(expected.intentBytes, expected.completionBytes);
  assert.equal(history.intents[2]!.ownerClaimHash, hex("c"));
  assert.equal(history.completions[0]!.completionOwnerClaimHash, hex("e"));
  assert.equal(history.completions[0]!.ownerClaimHash, hex("b"));
  assert.throws(() => records.parseDashboardCutoverHistoryV2([expected.intentBytes[0]!],
    [wire(resealCompletion(expected.completions[0]!, { ownerClaimHash: hex("e") }))]), invalid);
});

test("already-absent is legal only for drain-old-dashboard and remains historical", async () => {
  const records = await load(), expected = fixture();
  const absent = records.createDashboardCutoverCompletionV2({ intent: expected.intents[2],
    completionOwnerClaimHash: hex("e"), afterObservationHash: hex("f"), outcome: "already-absent" });
  assert.deepEqual(absent, resealCompletion(expected.completions[2]!, { outcome: "already-absent" }));
  const history = records.parseDashboardCutoverHistoryV2(expected.intentBytes.slice(0, 3),
    [...expected.completionBytes.slice(0, 2), wire(absent)]);
  assert.equal(history.authority, "history-only");
  for (let index = 0; index < 6; index++) {
    for (const outcome of [...new Set([...outcomes, "already-absent", "ready", "unknown"])]) {
      if (outcome === outcomes[index] || (index === 2 && outcome === "already-absent")) continue;
      assert.throws(() => records.createDashboardCutoverCompletionV2({ intent: expected.intents[index],
        completionOwnerClaimHash: hex("e"), afterObservationHash: hex("f"), outcome }), invalid);
      assert.throws(() => records.encodeDashboardCutoverCompletionV2(
        resealCompletion(expected.completions[index]!, { outcome })), invalid);
    }
  }
});

test("unsettled prefixes cannot advance; gaps, duplicate records and crossed links refuse", async () => {
  const records = await load(), expected = fixture();
  const bad = (intents: Buffer[], completions: Buffer[]) => assert.throws(
    () => records.parseDashboardCutoverHistoryV2(intents, completions), invalid);
  bad([], [expected.completionBytes[0]!]);
  bad(expected.intentBytes.slice(0, 2), []);
  bad([expected.intentBytes[1]!], []);
  bad([expected.intentBytes[0]!, expected.intentBytes[0]!], [expected.completionBytes[0]!]);
  bad(expected.intentBytes.slice(0, 2), [expected.completionBytes[0]!, expected.completionBytes[0]!]);
  bad([expected.intentBytes[0]!], expected.completionBytes.slice(0, 2));
  bad([expected.intentBytes[0]!, expected.intentBytes[2]!], [expected.completionBytes[0]!]);
  for (const changes of [{ previousCompletionHash: hex("0") }, { cutoverIntentHash: hex("0") }] as Record<string, Json>[]) {
    bad([expected.intentBytes[0]!, wire(resealIntent(expected.intents[1]!, changes))], [expected.completionBytes[0]!]);
  }
  for (const changes of [{ effectIntentHash: hex("0") }, { cutoverIntentHash: hex("0") },
    { ordinal: 2, action: "bootout-dashboard" }] as Record<string, Json>[]) {
    bad([expected.intentBytes[0]!], [wire(resealCompletion(expected.completions[0]!, changes))]);
  }
  for (let index = 1; index < 6; index++) {
    for (const changes of [{ previousCompletionHash: hex("0") }, { cutoverIntentHash: hex("0") }] as Record<string, Json>[]) {
      bad([...expected.intentBytes.slice(0, index), wire(resealIntent(expected.intents[index]!, changes))],
        expected.completionBytes.slice(0, index));
    }
    for (const changes of [{ effectIntentHash: hex("0") }, { cutoverIntentHash: hex("0") },
      { ownerClaimHash: hex("0") }] as Record<string, Json>[]) {
      bad(expected.intentBytes.slice(0, index + 1), [...expected.completionBytes.slice(0, index),
        wire(resealCompletion(expected.completions[index]!, changes))]);
    }
  }
});

test("exact schemas, purpose, action, self hashes, references and fields are required", async () => {
  const records = await load(), expected = fixture();
  for (const changes of [{ schema: "other" }, { purpose: "ready" }, { action: "select-new-cli" },
    { maximumDispatchCount: 2 }, { ordinal: 0 }, { ordinal: 7 }, { unexpected: true }] as Record<string, Json>[]) {
    assert.throws(() => records.encodeDashboardCutoverIntentV2(resealIntent(expected.intents[0]!, changes)), invalid);
  }
  for (const changes of [{ schema: "other" }, { purpose: "ready" }, { action: "select-new-cli" },
    { ordinal: 0 }, { ordinal: 7 }, { unexpected: true }] as Record<string, Json>[]) {
    assert.throws(() => records.encodeDashboardCutoverCompletionV2(resealCompletion(expected.completions[0]!, changes)), invalid);
  }
  for (const record of [{ ...expected.intents[0], effectIntentHash: hex("0") },
    { ...expected.intents[0], effectIntentRef: intentRef + hex("0") },
    { ...expected.intents[0], effectIntentHash: hex("A") }]) {
    assert.throws(() => records.encodeDashboardCutoverIntentV2(record), invalid);
    assert.throws(() => records.parseDashboardCutoverHistoryV2([wire(record)], []), invalid);
  }
  for (const record of [{ ...expected.completions[0], effectCompletionHash: hex("0") },
    { ...expected.completions[0], effectCompletionRef: completionRef + hex("0") }]) {
    assert.throws(() => records.encodeDashboardCutoverCompletionV2(record), invalid);
  }
  const { effectIntentRef: _ref, ...missing } = expected.intents[0]!;
  assert.throws(() => records.encodeDashboardCutoverIntentV2(missing), invalid);
});

test("constructors reject malformed scalar hashes, ordinals and predecessor values", async () => {
  const records = await load(), expected = fixture();
  for (const ordinal of [0, 7, -1, 1.5, "1", NaN, Infinity, null, {}, 1n]) {
    assert.throws(() => records.createDashboardCutoverIntentV2({ ...firstInput(), ordinal }), invalid);
  }
  for (const key of ["cutoverIntentHash", "ownerClaimHash", "beforeObservationHash"]) {
    for (const value of ["", hex("A"), "a".repeat(63), "a".repeat(65), null, 4, {}, Symbol()]) {
      assert.throws(() => records.createDashboardCutoverIntentV2({ ...firstInput(), [key]: value }), invalid);
    }
  }
  for (const previousCompletionHash of [hex("a"), undefined, false]) {
    assert.throws(() => records.createDashboardCutoverIntentV2({ ...firstInput(), previousCompletionHash }), invalid);
  }
  for (const previousCompletionHash of [null, "", hex("A"), {}]) {
    assert.throws(() => records.createDashboardCutoverIntentV2({ ...firstInput(), ordinal: 2, previousCompletionHash }), invalid);
  }
  for (const key of ["completionOwnerClaimHash", "afterObservationHash"]) {
    assert.throws(() => records.createDashboardCutoverCompletionV2({ intent: expected.intents[0],
      completionOwnerClaimHash: hex("e"), afterObservationHash: hex("f"), outcome: "launcher-unloaded", [key]: hex("A") }), invalid);
  }
});

test("record inputs reject proxies and accessors without executing caller code", async () => {
  const records = await load(), expected = fixture();
  let calls = 0;
  const trap = () => { calls++; throw Error("caller code executed"); };
  const proxy = (value: object) => new Proxy(value, { get: trap, ownKeys: trap, getPrototypeOf: trap,
    getOwnPropertyDescriptor: trap });
  const getter = { ...firstInput() };
  Object.defineProperty(getter, "ownerClaimHash", { enumerable: true, get: trap });
  const hidden = { ...firstInput() };
  Object.defineProperty(hidden, "ownerClaimHash", { enumerable: false, value: hex("b") });
  for (const input of [proxy(firstInput()), getter, hidden, { ...firstInput(), extra: 1 },
    { ...firstInput(), [Symbol()]: 1 }, Object.assign(Object.create(null), firstInput())]) {
    assert.throws(() => records.createDashboardCutoverIntentV2(input), invalid);
  }
  const completionInput = { intent: expected.intents[0], completionOwnerClaimHash: hex("e"),
    afterObservationHash: hex("f"), outcome: "launcher-unloaded" };
  assert.throws(() => records.createDashboardCutoverCompletionV2(proxy(completionInput)), invalid);
  assert.throws(() => records.createDashboardCutoverCompletionV2({ ...completionInput, intent: proxy(expected.intents[0]!) }), invalid);
  assert.throws(() => records.encodeDashboardCutoverIntentV2(proxy(expected.intents[0]!)), invalid);
  assert.throws(() => records.encodeDashboardCutoverCompletionV2(proxy(expected.completions[0]!)), invalid);
  assert.equal(calls, 0);
});

test("history arrays reject sparse, accessor, extra, symbol, subclass and oversized inputs", async () => {
  const records = await load(), expected = fixture();
  let calls = 0;
  const trap = () => { calls++; throw Error("caller code executed"); };
  const getter = [expected.intentBytes[0]!];
  Object.defineProperty(getter, "0", { enumerable: true, get: trap });
  const hidden = [expected.intentBytes[0]!];
  Object.defineProperty(hidden, "0", { enumerable: false, value: expected.intentBytes[0] });
  class Derived extends Array<Buffer> {}
  const malformed = [new Array(1), getter, hidden, Object.assign([expected.intentBytes[0]!], { extra: true }),
    Object.assign([expected.intentBytes[0]!], { [Symbol()]: true }), new Derived(expected.intentBytes[0]!),
    Array.from({ length: 7 }, () => expected.intentBytes[0]),
    new Proxy([expected.intentBytes[0]!], { get: trap, ownKeys: trap, getPrototypeOf: trap })];
  for (const list of malformed) {
    assert.throws(() => records.parseDashboardCutoverHistoryV2(list, []), invalid);
    assert.throws(() => records.parseDashboardCutoverHistoryV2([], list), invalid);
  }
  assert.equal(calls, 0);
});

test("wire rejects duplicate keys, noncanonical order, whitespace, invalid UTF8 and bounds", async () => {
  const records = await load(), expected = fixture(), first = expected.intentBytes[0]!;
  const duplicate = Buffer.from(first.toString().replace("{", '{"ordinal":1,'));
  for (const bytes of [duplicate, Buffer.from(`${JSON.stringify(expected.intents[0])}\n`),
    Buffer.concat([first, Buffer.from("\n")]), Buffer.concat([Buffer.from(" "), first]), first.subarray(0, -1),
    Buffer.from("{\"x\":\"\xff\"}\n", "latin1"), Buffer.alloc(0), Buffer.alloc(65537, 32),
    new Uint8Array(first), first.toString(), new Proxy(first, {})]) {
    assert.throws(() => records.parseDashboardCutoverHistoryV2([bytes], []), invalid);
  }
  const completion = expected.completionBytes[0]!;
  assert.throws(() => records.parseDashboardCutoverHistoryV2([first],
    [Buffer.concat([completion, Buffer.from("\n")])]), invalid);
});

test("returned records own input values and remain immutable after caller mutation", async () => {
  const records = await load(), expected = fixture(), input = firstInput();
  const intent = records.createDashboardCutoverIntentV2(input);
  input.ownerClaimHash = hex("0");
  assert.equal(intent.ownerClaimHash, hex("b"));
  const ownedInput = expected.intentBytes.map(bytes => Buffer.from(bytes));
  const history = records.parseDashboardCutoverHistoryV2(ownedInput, expected.completionBytes);
  ownedInput[0]!.fill(0);
  ownedInput.length = 0;
  assert.deepEqual(history.intents, expected.intents);
  assert.throws(() => { (history.intents as unknown[]).push({}); }, TypeError);
  assert.throws(() => { (history.intents[0] as { ownerClaimHash: string }).ownerClaimHash = hex("0"); }, TypeError);
});

test("genuine Buffer bytes are copied intrinsically without invoking overridden properties", async () => {
  const records = await load(), expected = fixture(), bytes = Buffer.from(expected.intentBytes[0]!);
  let calls = 0;
  const trap = () => { calls++; throw Error("caller Buffer code executed"); };
  for (const key of ["length", "toString", "equals", "subarray", "copy", Symbol.iterator]) {
    Object.defineProperty(bytes, key, { get: trap });
  }
  assert.deepEqual(records.parseDashboardCutoverHistoryV2([bytes], []).intents[0], expected.intents[0]);
  assert.equal(calls, 0);
});

test("a genuine Buffer with a proxy prototype refuses before any prototype trap", async () => {
  const records = await load(), expected = fixture();
  let calls = 0;
  const trap = () => { calls++; throw Error("caller prototype trap executed"); };
  for (const depth of [0, 1, 4]) {
    const bytes = Buffer.from(expected.intentBytes[0]!);
    let prototype: object = new Proxy(Buffer.prototype, { getPrototypeOf: trap, get: trap });
    for (let index = 0; index < depth; index++) prototype = Object.create(prototype) as object;
    Object.setPrototypeOf(bytes, prototype);
    assert.throws(() => records.parseDashboardCutoverHistoryV2([bytes], []), invalid);
  }
  assert.equal(calls, 0);
});

test("nonproxy Buffer ancestry accepts128 intermediates and refuses129", async () => {
  const records = await load(), expected = fixture();
  for (const depth of [128, 129]) {
    const bytes = Buffer.from(expected.intentBytes[0]!);
    let prototype: object = Buffer.prototype;
    for (let index = 0; index < depth; index++) prototype = Object.create(prototype) as object;
    Object.setPrototypeOf(bytes, prototype);
    if (depth === 128) assert.deepEqual(records.parseDashboardCutoverHistoryV2([bytes], []).intents[0], expected.intents[0]);
    else assert.throws(() => records.parseDashboardCutoverHistoryV2([bytes], []), invalid);
  }
});
