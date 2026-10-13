import assert from "node:assert/strict";
import { test } from "node:test";
import type { LoadHookSync } from "node:module";
import * as entry from "./task6a-native-closed-probe-entry.js";

// Unit-only: nextLoad/checkpoint/event ports are MODELED. Real object/error
// identity controls, not native hook installation/loading/PG qualification.
const canonicalURL = "file:///unit-only-canonical-owner.js";
const context = { conditions: [], format: "module", importAttributes: {} };
const result = { format: "module", source: "export const unitOnly = 1;" };
type Observer = { load: LoadHookSync; snapshot(): {
  requested: number; returned: number; failed: boolean;
  failures: readonly { stage: string; error: unknown }[];
} };
function observer(checkpoint: () => void = () => {}, event: (name: string) => void = () => {}): Observer {
  const factory: unknown = Reflect.get(entry, "createTask6aNativeCanonicalLoadObserverV1");
  if (typeof factory === "function") return factory(canonicalURL, checkpoint, event);
  // Existing no-load-sensor behavior, not a missing-export setup exception.
  return { load: (url, ctx, nextLoad) => nextLoad(url, ctx),
    snapshot: () => ({ requested: 0, returned: 0, failed: false, failures: [] }) };
}

test("exact canonical request checkpoints and delegates SAME URL/context/result", () => {
  let checkpoints = 0;
  const events: string[] = [], sensor = observer(() => { checkpoints++; }, name => events.push(name));
  let calls = 0;
  assert.equal(sensor.load(canonicalURL, context, (url, ctx) => {
    calls++; assert.equal(url, canonicalURL); assert.equal(ctx, context); return result;
  }), result);
  assert.equal(calls, 1); assert.equal(checkpoints, 1);
  assert.deepEqual(events, ["canonical-load-request", "canonical-next-load-returned"]);
  assert.deepEqual(sensor.snapshot(), { requested: 1, returned: 1, failed: false, failures: [] });
});

test("foreign load delegates unchanged without borrowing canonical readiness", () => {
  let ports = 0;
  const sensor = observer(() => { ports++; }, () => { ports++; });
  const url = "file:///unit-only-other.js";
  assert.equal(sensor.load(url, context, (actual, ctx) => {
    assert.equal(actual, url); assert.equal(ctx, context); return result;
  }), result);
  assert.equal(ports, 0);
  assert.deepEqual(sensor.snapshot(), { requested: 0, returned: 0, failed: false, failures: [] });
});

test("duplicate canonical request is sticky but neither delegate is replaced", () => {
  const sensor = observer(); let calls = 0;
  for (let i = 0; i < 2; i++) assert.equal(sensor.load(canonicalURL, context, () => { calls++; return result; }), result);
  assert.equal(calls, 2); assert.equal(sensor.snapshot().requested, 2);
  assert.equal(sensor.snapshot().returned, 2); assert.equal(sensor.snapshot().failed, true);
});

for (const port of ["checkpoint", "event"] as const) {
  test(`throwing ${port} records undefined failure without replacing nextLoad result`, () => {
    const fault = () => { throw undefined; };
    const sensor = observer(port === "checkpoint" ? fault : undefined, port === "event" ? fault : undefined);
    let calls = 0;
    assert.equal(sensor.load(canonicalURL, context, () => { calls++; return result; }), result);
    assert.equal(calls, 1); assert.equal(sensor.snapshot().failed, true);
    assert.ok(sensor.snapshot().failures.some(failure => Object.hasOwn(failure, "error") && failure.error === undefined));
    assert.equal(sensor.snapshot().requested, 1); assert.equal(sensor.snapshot().returned, 1);
  });
}

test("genuine nextLoad thrown undefined propagates with no invented completion", () => {
  const sensor = observer(); let threw = false;
  try { sensor.load(canonicalURL, context, () => { throw undefined; }); }
  catch (error) { threw = true; assert.equal(error, undefined); }
  assert.equal(threw, true);
  assert.deepEqual(sensor.snapshot(), { requested: 1, returned: 0, failed: false, failures: [] });
});

test("checkpoint refusal stays sticky while SAME genuine nextLoad error propagates", () => {
  const producerError = Error("unit-modeled-next-load-failure");
  const sensor = observer(() => { throw undefined; }); let threw = false;
  try { sensor.load(canonicalURL, context, () => { throw producerError; }); }
  catch (error) { threw = true; assert.equal(error, producerError); }
  assert.equal(threw, true); assert.equal(sensor.snapshot().failed, true);
  assert.equal(sensor.snapshot().requested, 1); assert.equal(sensor.snapshot().returned, 0);
  assert.ok(sensor.snapshot().failures.some(failure => Object.hasOwn(failure, "error") && failure.error === undefined));
});
