import { AsyncLocalStorage } from "node:async_hooks";
import { ChildProcess, execFile, type ExecFileException, type ExecFileOptionsWithStringEncoding } from "node:child_process";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import { promisify, types } from "node:util";

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
  notifyChildDrain(); // Child authority retains this same JS prerequisite.
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

// Separate, source-owned custody for nominated execFile ports. This is not a
// descendant/remote-effect or hostile EventEmitter/prototype authority.
type LocalChildCallbackV3 = (error: ExecFileException | null, stdout: string, stderr: string) => void;
type ChildOccurrence = {
  uncertain: boolean;
  returned?: unknown; original?: ChildProcess; promise?: Promise<unknown>;
  stdout?: Readable; stderr?: Readable; stdin?: Writable;
  exit?: number; close?: number;
  stdoutEnd: boolean; stdoutClose: boolean; stderrEnd: boolean; stderrClose: boolean; stdinClose: boolean;
};
const originalExecFile = execFile;
const originalExecFileAsync = promisify(execFile);
const originalPrependOnce = EventEmitter.prototype.prependOnceListener;
const childOccurrences = new Set<ChildOccurrence>();
const originalChildren = new WeakMap<ChildProcess, ChildOccurrence>();
const childHandles = new WeakMap<object, object>();
let childAttempted = false, childBurned = false;
let childWake: (() => void) | undefined;
function childFail(): never { throw Error("DASHBOARD_CUTOVER_LOCAL_CHILD_DRAIN_REFUSED"); }
function notifyChildDrain(): void { const original = childWake; childWake = undefined; original?.(); }
function burnChild(record?: ChildOccurrence): void {
  if (record) record.uncertain = true;
  childBurned = true; notifyChildDrain();
}
function reserveChild(): ChildOccurrence {
  const parent = ancestry.getStore();
  if (closed && (!parent?.live || !live.has(parent))) childFail();
  const occurrence: ChildOccurrence = { uncertain: false, stdoutEnd: false, stdoutClose: false,
    stderrEnd: false, stderrClose: false, stdinClose: false };
  childOccurrences.add(occurrence); // Reserve before a possibly partial dispatch.
  return occurrence;
}
function settleChild(record: ChildOccurrence): void {
  if (record.uncertain) return; // Retain unknowns, not unrelated known originals.
  if (record.exit !== undefined && record.close !== undefined && record.exit === record.close
    && record.stdoutEnd && record.stdoutClose && record.stderrEnd && record.stderrClose && record.stdinClose) {
    childOccurrences.delete(record);
    if (childOccurrences.size === 0) notifyChildDrain();
  }
}
function sealChild(record: ChildOccurrence, candidate: unknown): void {
  // All observer failures are custody-only. Never replace ordinary callbacks,
  // timeout errors or fallback behavior with a custody error.
  const refuse = (): void => { burnChild(record); };
  try {
    record.returned = candidate;
    if (!candidate || types.isProxy(candidate) || !(candidate instanceof ChildProcess)) { refuse(); return; }
    record.original = candidate;
    record.stdout = candidate.stdout ?? undefined; record.stderr = candidate.stderr ?? undefined;
    record.stdin = candidate.stdin ?? undefined;
    // A constructed, never-dispatched ChildProcess is not an original spawn.
    // This is sanity data, not caller PID or cross-process identity authority.
    const previous = originalChildren.get(candidate);
    if (previous) { burnChild(previous); refuse(); return; }
    if (!Number.isInteger(candidate.pid) || candidate.pid! <= 0) { refuse(); return; }
    originalChildren.set(candidate, record);
    if (!record.stdout || !record.stderr || types.isProxy(record.stdout) || types.isProxy(record.stderr)
      || !(record.stdout instanceof Readable) || !(record.stderr instanceof Readable)
      || record.stdout === record.stderr || (record.stdin && (types.isProxy(record.stdin) || !(record.stdin instanceof Writable)))) {
      refuse(); return;
    }
    record.stdinClose = !record.stdin;
    const observe = (target: EventEmitter, event: string, body: (...args: any[]) => void): void => {
      Reflect.apply(originalPrependOnce, target, [event, (...args: any[]) => {
        try { body(...args); } catch { refuse(); }
      }]);
    };
    observe(candidate, "error", refuse);
    for (const event of ["exit", "close"] as const) observe(candidate, event, (code: unknown, signal: unknown) => {
      if (!Number.isInteger(code) || signal !== null) { refuse(); return; }
      record[event] = code as number;
      if (record.exit !== undefined && record.close !== undefined && record.exit !== record.close) refuse();
      settleChild(record);
    });
    for (const [stream, prefix] of [[record.stdout, "stdout"], [record.stderr, "stderr"]] as const) {
      observe(stream, "error", refuse);
      observe(stream, "end", () => { record[`${prefix}End`] = true; settleChild(record); });
      observe(stream, "close", () => {
        record[`${prefix}Close`] = true;
        if (!record[`${prefix}End`]) refuse();
        settleChild(record);
      });
    }
    if (record.stdin) {
      observe(record.stdin, "error", refuse);
      observe(record.stdin, "close", () => { record.stdinClose = true; settleChild(record); });
    }
  } catch { refuse(); }
}

export function execFileDashboardCutoverLocalChildV3(file: string, args: readonly string[], callback: LocalChildCallbackV3): void;
export function execFileDashboardCutoverLocalChildV3(file: string, args: readonly string[],
  options: ExecFileOptionsWithStringEncoding, callback: LocalChildCallbackV3): void;
export function execFileDashboardCutoverLocalChildV3(file: string, args: readonly string[],
  optionsOrCallback: ExecFileOptionsWithStringEncoding | LocalChildCallbackV3, callback?: LocalChildCallbackV3): void {
  const record = reserveChild();
  try {
    const child = typeof optionsOrCallback === "function"
      ? originalExecFile(file, args, optionsOrCallback)
      : originalExecFile(file, args, optionsOrCallback, callback!);
    sealChild(record, child);
  } catch (error) { burnChild(record); throw error; }
}

export async function execFileDashboardCutoverLocalChildAsyncV3(file: string, args: readonly string[],
  options: ExecFileOptionsWithStringEncoding): Promise<{ stdout: string; stderr: string }> {
  const record = reserveChild();
  let original: Promise<{ stdout: string; stderr: string }> & { child: ChildProcess };
  try {
    original = originalExecFileAsync(file, args, options);
    record.promise = original;
  } catch (error) { burnChild(record); throw error; }
  try { sealChild(record, original.child); } catch { burnChild(record); }
  return await original; // Preserve builtin stdout/stderr and rejection, hide .child.
}

function checkChildPrerequisite(handle: object): void {
  try { assertDashboardCutoverLocalProducerDrainV2(handle); }
  catch { childFail(); }
}
export async function acquireDashboardCutoverLocalChildDrainV3(jsHandle: object): Promise<object> {
  if (arguments.length !== 1) childFail();
  checkChildPrerequisite(jsHandle);
  if (childAttempted) { burnChild(); childFail(); }
  childAttempted = true;
  if (childBurned) childFail();
  if (childOccurrences.size !== 0) await new Promise<void>(resolve => { childWake = resolve; });
  checkChildPrerequisite(jsHandle);
  if (childBurned || childOccurrences.size !== 0) childFail();
  const handle = Object.freeze(Object.create(null)) as object;
  checkChildPrerequisite(jsHandle);
  childHandles.set(handle, jsHandle);
  return handle;
}
export function assertDashboardCutoverLocalChildDrainV3(handle: object): void {
  if (arguments.length !== 1 || childBurned || childOccurrences.size !== 0) childFail();
  const original = childHandles.get(handle);
  if (!original) childFail();
  checkChildPrerequisite(original);
}
