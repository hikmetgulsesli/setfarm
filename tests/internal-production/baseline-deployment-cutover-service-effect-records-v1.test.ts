import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const wire = (value: unknown) => Buffer.from(`${canonical(value)}\n`);
const hex = (letter: string) => letter.repeat(64);

function firstIntent() {
  const body = { schema: "setfarm.internal-production-deployment-cutover-service-effect-intent.v1",
    purpose: "preserved-deployment-cutover-service-quiescence", cutoverIntentHash: hex("a"), ownerClaimHash: hex("b"),
    ordinal: 1, action: "bootout-spawner", previousCompletionHash: null,
    beforeLauncherObservationHash: hex("c"), beforeProcessObservationHash: hex("d"), maximumDispatchCount: 1 };
  const effectIntentHash = hash(body);
  return { ...body, effectIntentHash,
    effectIntentRef: `setfarm://internal-production/deployment-cutover-service-effect-intent/sha256/${effectIntentHash}` };
}
function firstCompletion() {
  const intent = firstIntent();
  const body = { schema: "setfarm.internal-production-deployment-cutover-service-effect-completion.v1",
    purpose: "preserved-deployment-cutover-service-quiescence", effectIntentHash: intent.effectIntentHash,
    cutoverIntentHash: intent.cutoverIntentHash, ownerClaimHash: intent.ownerClaimHash,
    ordinal: 1, action: "bootout-spawner", afterLauncherObservationHash: hex("e"),
    afterProcessObservationHash: hex("f"), disposition: "recorded-after-observation" };
  const effectCompletionHash = hash(body);
  return { ...body, effectCompletionHash,
    effectCompletionRef: `setfarm://internal-production/deployment-cutover-service-effect-completion/sha256/${effectCompletionHash}` };
}
function secondIntent(previousCompletionHash = firstCompletion().effectCompletionHash) {
  const body = { schema: "setfarm.internal-production-deployment-cutover-service-effect-intent.v1",
    purpose: "preserved-deployment-cutover-service-quiescence", cutoverIntentHash: hex("a"), ownerClaimHash: hex("b"),
    ordinal: 2, action: "bootout-dashboard", previousCompletionHash,
    beforeLauncherObservationHash: hex("1"), beforeProcessObservationHash: hex("2"), maximumDispatchCount: 1 };
  const effectIntentHash = hash(body);
  return { ...body, effectIntentHash,
    effectIntentRef: `setfarm://internal-production/deployment-cutover-service-effect-intent/sha256/${effectIntentHash}` };
}
function secondCompletion() {
  const intent = secondIntent();
  const body = { schema: "setfarm.internal-production-deployment-cutover-service-effect-completion.v1",
    purpose: "preserved-deployment-cutover-service-quiescence", effectIntentHash: intent.effectIntentHash,
    cutoverIntentHash: intent.cutoverIntentHash, ownerClaimHash: intent.ownerClaimHash,
    ordinal: 2, action: "bootout-dashboard", afterLauncherObservationHash: hex("3"),
    afterProcessObservationHash: hex("4"), disposition: "recorded-after-observation" };
  const effectCompletionHash = hash(body);
  return { ...body, effectCompletionHash,
    effectCompletionRef: `setfarm://internal-production/deployment-cutover-service-effect-completion/sha256/${effectCompletionHash}` };
}

test("first fixed spawner bootout intent and completion match independent canonical wire", async () => {
  // Mutation caught: wrong fixed action, owner/cutover binding, self-pair or byte order.
  const records = await import("../../src/internal-production/baseline-deployment-cutover-service-effect-records-v1.js");
  const expectedIntent = firstIntent();
  const intent = records.createDeploymentCutoverServiceEffectIntentV1({ cutoverIntentHash: hex("a"),
    ownerClaimHash: hex("b"), ordinal: 1, previousCompletionHash: null,
    beforeLauncherObservationHash: hex("c"), beforeProcessObservationHash: hex("d") });
  assert.deepEqual(intent, expectedIntent);
  assert.deepEqual(records.encodeDeploymentCutoverServiceEffectIntentV1(intent), wire(expectedIntent));
  const expectedCompletion = firstCompletion();
  const completion = records.createDeploymentCutoverServiceEffectCompletionV1({ intent,
    afterLauncherObservationHash: hex("e"), afterProcessObservationHash: hex("f") });
  assert.deepEqual(completion, expectedCompletion);
  assert.deepEqual(records.encodeDeploymentCutoverServiceEffectCompletionV1(completion), wire(expectedCompletion));
  const history = records.parseDeploymentCutoverServiceEffectHistoryV1([wire(expectedIntent)], [wire(expectedCompletion)]);
  assert.equal(history.authority, "history-only");
  assert.equal(history.historicalState, "recorded-prefix");
  assert.ok(Object.isFrozen(history) && Object.isFrozen(history.intents));
});

test("two fixed effects form a chained history without granting cutover authority", async () => {
  const records = await import("../../src/internal-production/baseline-deployment-cutover-service-effect-records-v1.js");
  const expectedSecond = secondIntent();
  const second = records.createDeploymentCutoverServiceEffectIntentV1({ cutoverIntentHash: hex("a"),
    ownerClaimHash: hex("b"), ordinal: 2, previousCompletionHash: firstCompletion().effectCompletionHash,
    beforeLauncherObservationHash: hex("1"), beforeProcessObservationHash: hex("2") });
  assert.deepEqual(second, expectedSecond);
  assert.deepEqual(records.encodeDeploymentCutoverServiceEffectIntentV1(second), wire(expectedSecond));
  const expectedCompletion = secondCompletion();
  const completion = records.createDeploymentCutoverServiceEffectCompletionV1({ intent: second,
    afterLauncherObservationHash: hex("3"), afterProcessObservationHash: hex("4") });
  assert.deepEqual(completion, expectedCompletion);
  assert.deepEqual(records.encodeDeploymentCutoverServiceEffectCompletionV1(completion), wire(expectedCompletion));
  const history = records.parseDeploymentCutoverServiceEffectHistoryV1(
    [wire(firstIntent()), wire(second)], [wire(firstCompletion()), wire(completion)]);
  assert.equal(history.historicalState, "recorded-complete");
  assert.deepEqual(Object.keys(history).sort(), ["authority", "completions", "historicalState", "intents", "schema"]);
  assert.equal(history.authority, "history-only");
  assert.ok(Object.isFrozen(history.completions) && Object.isFrozen(history.completions[1]));
});

test("unsettled history is explicit and cannot be advanced or replayed", async () => {
  const records = await import("../../src/internal-production/baseline-deployment-cutover-service-effect-records-v1.js");
  const intent = wire(firstIntent()), firstDone = wire(firstCompletion()), second = wire(secondIntent());
  assert.equal(records.parseDeploymentCutoverServiceEffectHistoryV1([], []).historicalState, "empty");
  assert.equal(records.parseDeploymentCutoverServiceEffectHistoryV1([intent], []).historicalState, "unsettled");
  assert.equal(records.parseDeploymentCutoverServiceEffectHistoryV1([intent, second], [firstDone]).historicalState, "unsettled");
  for (const [intents, completions] of [
    [[intent, second], []], [[intent, intent], [firstDone]], [[second], []],
    [[intent, second], [firstDone, firstDone]], [[intent], [firstDone, firstDone]],
  ] as const) {
    assert.throws(() => records.parseDeploymentCutoverServiceEffectHistoryV1(intents, completions),
      /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_RECORD_INVALID/);
  }
});

test("crossed links, order, action, hash and canonical wire fail closed", async () => {
  const records = await import("../../src/internal-production/baseline-deployment-cutover-service-effect-records-v1.js");
  const intent = firstIntent(), completion = firstCompletion(), second = secondIntent();
  const invalid = (intents: Buffer[], completions: Buffer[]) => assert.throws(
    () => records.parseDeploymentCutoverServiceEffectHistoryV1(intents, completions),
    /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_RECORD_INVALID/);
  invalid([wire({ ...intent, action: "bootout-dashboard" })], []);
  invalid([wire({ ...intent, maximumDispatchCount: 2 })], []);
  invalid([wire({ ...intent, effectIntentHash: hex("0") })], []);
  invalid([wire(intent)], [wire({ ...completion, effectIntentHash: second.effectIntentHash })]);
  invalid([wire(intent)], [wire({ ...completion, ownerClaimHash: hex("0") })]);
  invalid([wire(intent), wire({ ...second, previousCompletionHash: hex("0") })], [wire(completion)]);
  invalid([wire(intent), wire({ ...second, cutoverIntentHash: hex("0") })], [wire(completion)]);
  invalid([wire(second), wire(intent)], [wire(secondCompletion()), wire(completion)]);
  invalid([wire({ ...intent, ordinal: 3, action: "bootout-other" })], []);
  invalid([Buffer.from(`${JSON.stringify(intent)}\n`)], []);
  invalid([Buffer.concat([wire(intent), Buffer.from(" ")])], []);
});

test("inputs reject accessors, proxies, extra keys and malformed byte arrays without invoking them", async () => {
  const records = await import("../../src/internal-production/baseline-deployment-cutover-service-effect-records-v1.js");
  const input = { cutoverIntentHash: hex("a"), ownerClaimHash: hex("b"), ordinal: 1,
    previousCompletionHash: null, beforeLauncherObservationHash: hex("c"), beforeProcessObservationHash: hex("d") };
  const invalid = (value: unknown) => assert.throws(
    () => records.createDeploymentCutoverServiceEffectIntentV1(value),
    /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_RECORD_INVALID/);
  invalid({ ...input, unexpected: true });
  invalid({ ...input, cutoverIntentHash: "A".repeat(64) });
  invalid({ ...input, ordinal: 2 });
  invalid(new Proxy(input, { get() { throw Error("must not run"); } }));
  const withGetter = { ...input };
  Object.defineProperty(withGetter, "ownerClaimHash", { enumerable: true, get() { throw Error("must not run"); } });
  invalid(withGetter);
  for (const bytes of [[wire(firstIntent()), wire(firstIntent()), wire(firstIntent())],
    [Buffer.from("{}\n")], [new Proxy(wire(firstIntent()), {})], new Array(1)]) {
    assert.throws(() => records.parseDeploymentCutoverServiceEffectHistoryV1(bytes, []),
      /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_RECORD_INVALID/);
  }
});
