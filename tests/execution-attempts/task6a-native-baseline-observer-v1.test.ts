import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

// Genuine JS Promise originals; native context/checkpoint ports are MODELED.
// These controls do not execute PostgreSQL or authenticate native timing.
const target = new URL("./task6a-native-baseline-observer-v1.ts", import.meta.url);
const helper = fs.existsSync(target) ? await import(target.href) : undefined;
type Role = "ACCESS" | "BASE" | "OWNER";
function observer(overrides: Partial<{ contextIsCurrent(): boolean; checkpoint(): void; event(name: string): void }> = {}) {
  const options = { contextIsCurrent: () => true, checkpoint() {}, event(_name: string) {}, ...overrides };
  if (helper) return helper.createTask6aNativeBaselineObserverV1(options);
  // Prior absence of a baseline ledger, not an API-absence setup exception.
  return { observe(_role: Role, _original: Promise<void>, _transaction: unknown, _owner?: string) {},
    canonicalRequested() {}, async joinOriginals() {},
    snapshot: () => ({ failed: false, records: [], failures: [], fulfilled: [] }) };
}
const turns = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

test("pending genuine baseline original prevents observer cleanup from settling", async () => {
  const sensor = observer(), transaction = {};
  let resolve!: () => void;
  const original = new Promise<void>(done => { resolve = done; });
  sensor.observe("ACCESS", original, transaction);
  let joined = false;
  const cleanup = sensor.joinOriginals().then(() => { joined = true; });
  try {
    await turns(); assert.equal(joined, false);
    assert.deepEqual(sensor.snapshot().records.map((row: { state: string }) => row.state), ["pending"]);
  } finally { resolve(); await original; await cleanup; }
  assert.equal(joined, true);
});

test("ordered fulfilled original baseline permits only the complete canonical checkpoint", async () => {
  const sensor = observer(), transaction = {};
  for (const role of ["ACCESS", "BASE", "OWNER"] as const) {
    const original = Promise.resolve();
    sensor.observe(role, original, transaction, role === "OWNER" ? "setfarm_owner" : undefined);
    await original;
  }
  sensor.canonicalRequested(); await sensor.joinOriginals();
  assert.equal(sensor.snapshot().failed, false);
  assert.deepEqual(sensor.snapshot().fulfilled, ["ACCESS", "BASE", "OWNER"]);
  assert.deepEqual(sensor.snapshot().records.map((row: { state: string }) => row.state), ["fulfilled", "fulfilled", "fulfilled"]);
});

test("missing context remains sticky without replacing original undefined rejection", async () => {
  const sensor = observer({ contextIsCurrent: () => false });
  const original = Promise.reject<void>(undefined);
  const joinedOriginal = original.catch(error => { assert.equal(error, undefined); });
  assert.doesNotThrow(() => sensor.observe("ACCESS", original, {}));
  await joinedOriginal; await sensor.joinOriginals();
  assert.equal(sensor.snapshot().failed, true);
  assert.deepEqual(sensor.snapshot().records.map((row: { state: string }) => row.state), ["rejected"]);
});

test("missing context is detected independently of original rejection", async () => {
  const sensor = observer({ contextIsCurrent: () => false });
  const original = Promise.resolve();
  assert.doesNotThrow(() => sensor.observe("ACCESS", original, {}));
  assert.equal(await original, undefined); await sensor.joinOriginals();
  assert.equal(sensor.snapshot().failed, true);
  assert.deepEqual(sensor.snapshot().records.map((row: { state: string }) => row.state), ["fulfilled"]);
});

for (const refusal of ["missing-context", "checkpoint-throw"] as const) {
  test(`pending original remains enrolled after ${refusal} diagnostic failure`, async () => {
    const sensor = observer(refusal === "missing-context"
      ? { contextIsCurrent: () => false } : { checkpoint() { throw undefined; } });
    let resolve!: () => void;
    const original = new Promise<void>(done => { resolve = done; });
    assert.doesNotThrow(() => sensor.observe("ACCESS", original, {}));
    let joined = false;
    const cleanup = sensor.joinOriginals().then(() => { joined = true; });
    try {
      await turns(); assert.equal(joined, false);
      assert.equal(sensor.snapshot().failed, true);
      assert.deepEqual(sensor.snapshot().records.map((row: { state: string }) => row.state), ["pending"]);
    } finally { resolve(); await original; await cleanup; }
    assert.equal(joined, true);
    assert.equal(sensor.snapshot().failed, true);
    assert.deepEqual(sensor.snapshot().records.map((row: { state: string }) => row.state), ["fulfilled"]);
    if (refusal === "checkpoint-throw") assert.ok(sensor.snapshot().failures.some(
      (value: { error: unknown }) => Object.hasOwn(value, "error") && value.error === undefined));
  });
}

for (const mode of ["duplicate", "order", "transaction", "owner"] as const) {
  test(`baseline sensor keeps ${mode} violation sticky without rejecting genuine fulfilled originals`, async () => {
    const sensor = observer(), transaction = {};
    const roles: readonly Role[] = mode === "duplicate" ? ["ACCESS", "ACCESS"]
      : mode === "order" ? ["BASE"] : ["ACCESS", "BASE", "OWNER"];
    for (const role of roles) {
      const original = Promise.resolve();
      assert.doesNotThrow(() => sensor.observe(role, original,
        mode === "transaction" && role === "BASE" ? {} : transaction,
        role === "OWNER" ? (mode === "owner" ? "foreign_owner" : "setfarm_owner") : undefined));
      assert.equal(await original, undefined);
    }
    await sensor.joinOriginals(); assert.equal(sensor.snapshot().failed, true);
    assert.equal(sensor.snapshot().records.length, roles.length);
  });
}

for (const port of ["checkpoint", "event"] as const) {
  test(`throwing ${port} observer port retains undefined failure without unhandled reaction`, async () => {
    const sensor = observer({ [port]: () => { throw undefined; } });
    const original = Promise.resolve();
    assert.doesNotThrow(() => sensor.observe("ACCESS", original, {}));
    assert.equal(await original, undefined); await sensor.joinOriginals();
    const snapshot = sensor.snapshot(); assert.equal(snapshot.failed, true);
    assert.ok(snapshot.failures.some((value: { error: unknown }) => Object.hasOwn(value, "error") && value.error === undefined));
    assert.equal(snapshot.records[0]!.state, "fulfilled");
  });
}

test("canonical request before all three fulfilled originals is sticky and nonthrowing", async () => {
  const sensor = observer(), original = Promise.resolve();
  sensor.observe("ACCESS", original, {}); await original;
  assert.doesNotThrow(() => sensor.canonicalRequested()); await sensor.joinOriginals();
  assert.equal(sensor.snapshot().failed, true);
});

test("reaction retains captured occurrence context and refuses later context replacement", async () => {
  let current = true, resolve!: () => void;
  const sensor = observer({ contextIsCurrent: () => current });
  const original = new Promise<void>(done => { resolve = done; });
  sensor.observe("ACCESS", original, {}); current = false; resolve();
  assert.equal(await original, undefined); await sensor.joinOriginals();
  assert.equal(sensor.snapshot().failed, true);
  assert.equal(sensor.snapshot().records[0]!.state, "fulfilled");
});

test("next baseline call before preceding original fulfills remains sticky after all settle", async () => {
  const sensor = observer(), transaction = {};
  let resolve!: () => void;
  const access = new Promise<void>(done => { resolve = done; });
  sensor.observe("ACCESS", access, transaction);
  try {
    for (const role of ["BASE", "OWNER"] as const) {
      const original = Promise.resolve();
      assert.doesNotThrow(() => sensor.observe(role, original, transaction,
        role === "OWNER" ? "setfarm_owner" : undefined));
      assert.equal(await original, undefined);
    }
  } finally { resolve(); await access; await sensor.joinOriginals(); }
  assert.doesNotThrow(() => sensor.canonicalRequested());
  assert.deepEqual(sensor.snapshot().fulfilled, ["ACCESS", "BASE", "OWNER"]);
  assert.equal(sensor.snapshot().failed, true);
});
