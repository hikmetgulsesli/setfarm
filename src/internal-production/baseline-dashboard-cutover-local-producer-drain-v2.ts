import { AsyncLocalStorage } from "node:async_hooks";
import { types } from "node:util";

// Internal trusted source integration only. This accounts for JS body/promise
// termination, NOT children, effects, historical actors or cross-process freeze.
type ProducerKind = "configuration-write" | "atomic-configuration-write"
  | "medic-install" | "medic-uninstall" | "workflow-uninstall"
  | "all-workflows-uninstall" | "workspace-cleanup" | "run-cron-teardown";
const kinds = new Set<string>(["configuration-write", "atomic-configuration-write",
  "medic-install", "medic-uninstall", "workflow-uninstall", "all-workflows-uninstall", "workspace-cleanup", "run-cron-teardown"]);
type Invocation = { live: boolean; original?: Promise<unknown> };
const ancestry = new AsyncLocalStorage<Invocation>();
const live = new Set<Invocation>();
const handles = new WeakMap<object, true>();
const originalThen = Promise.prototype.then;
let closed = false, attempted = false, burned = false;
let wake: (() => void) | undefined;

function fail(): never { throw Error("DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED"); }
function notifyDrain(): void { const originalWake = wake; wake = undefined; originalWake?.(); }
function burn(): void {
  burned = true;
  notifyDrain(); // Reject a known-burned waiter; never release unknown originals.
}
function enter(kind: ProducerKind, body: unknown, arity: number): Invocation {
  if (burned || arity !== 2 || typeof kind !== "string" || !kinds.has(kind)
    || typeof body !== "function" || types.isProxy(body)) fail();
  const parent = ancestry.getStore();
  if (closed && (!parent?.live || !live.has(parent))) fail();
  const record: Invocation = { live: true };
  live.add(record);
  return record;
}
function finish(record: Invocation): void {
  if (!record.live || !live.delete(record)) { burn(); fail(); }
  record.live = false;
  if (live.size === 0) notifyDrain();
}
function observeOriginal<T>(original: Promise<T>, fulfilled: (value: T) => void,
  rejected: (reason: unknown) => void): void {
  try { Reflect.apply(originalThen, original, [fulfilled, rejected]); }
  catch { burn(); fail(); } // Constructor/species uncertainty retains originals.
}

export function withDashboardCutoverLocalProducerSyncV2<T>(kind: ProducerKind, body: () => T): T {
  const record = enter(kind, body, arguments.length);
  try {
    const result = ancestry.run(record, body);
    if (types.isPromise(result)) {
      record.original = result;
      burn();
      // Retain unknown custody even after this mistaken original settles. The
      // intrinsic observers prevent discarding a later rejected original.
      observeOriginal(result, () => {}, () => {});
      fail();
    }
    return result;
  } finally {
    if (!record.original) finish(record);
  }
}

export async function withDashboardCutoverLocalProducerAsyncV2<T>(kind: ProducerKind, body: () => Promise<T>): Promise<T> {
  const record = enter(kind, body, arguments.length);
  let original: Promise<T>;
  try { original = ancestry.run(record, body); }
  catch (error) { finish(record); throw error; } // Known synchronous body termination.
  if (!types.isPromise(original)) { burn(); fail(); }
  record.original = original;
  let fulfill!: (value: T) => void, reject!: (reason: unknown) => void;
  const terminal = new Promise<T>((resolve, failure) => { fulfill = resolve; reject = failure; });
  // Accounting is driven ONLY by the actual native promise's internal
  // settlement. Never await/adopt the original via its caller-visible then.
  observeOriginal(original,
    value => { finish(record); fulfill(value); },
    reason => { finish(record); reject(reason); });
  return terminal;
}

export async function acquireDashboardCutoverLocalProducerDrainV2(): Promise<object> {
  if (arguments.length !== 0) fail();
  const current = ancestry.getStore();
  if (current?.live && live.has(current)) fail(); // Never wait on ourselves.
  if (attempted) { burn(); fail(); }
  attempted = true;
  closed = true; // Monotonic fresh-entry refusal BEFORE the first await.
  if (burned) fail();
  if (live.size !== 0) await new Promise<void>(resolve => { wake = resolve; });
  if (burned || !closed || live.size !== 0) fail();
  const handle = Object.freeze(Object.create(null)) as object;
  handles.set(handle, true);
  return handle;
}

export function assertDashboardCutoverLocalProducerDrainV2(handle: object): void {
  if (arguments.length !== 1 || !handles.has(handle) || !closed || burned || live.size !== 0) fail();
}
