import postgres from "postgres";
import { types } from "node:util";
import { copyDashboardCoreRequestV2, readDashboardCoreResponseInTransactionV2,
  classifyDashboardCoreResponseFailureV2, type CopiedDashboardCoreRequestV2 } from "./dashboard-core-response-v2.js";
import { observeDashboardCoreReadonlyQualificationV2,
  type DashboardCoreReadonlyQualificationV2 } from "./dashboard-core-readonly-qualification-v2.js";

// Internal source-only lifecycle. Public cold/intent admission, authenticated
// schema-writer exclusion and startup authority are separate caller obligations.
type Phase = "UNPREPARED" | "PREPARING" | "READY" | "REFUSED";
type Outcome = Readonly<{
  qualification: DashboardCoreReadonlyQualificationV2;
  data: unknown;
  capacity: unknown;
}>;
type Attempt = {
  client: ReturnType<typeof postgres> | null;
  burned: boolean;
  live: boolean;
  callbackOriginal: Promise<Outcome> | null;
  callbackSettled: boolean;
  callbackSucceeded: boolean;
  outcome: Outcome | null;
  beginOriginal: Promise<unknown> | null;
  beginSucceeded: boolean;
  originals: Set<Promise<unknown>>;
  pending: Set<Promise<unknown>>;
  usedQueries: WeakSet<object>;
  endStarted: boolean;
  endOriginal: Promise<unknown> | null;
  cleanup: Promise<void> | null;
  endSettled: boolean;
};
let selected = false;
const REFUSED = "DASHBOARD_CUTOVER_CORE_READER_REFUSED";
function fail(code = REFUSED): never { throw new Error(code); }
function primitiveText(value: unknown, nonempty = false): string {
  if (typeof value !== "string" || (nonempty && !value) || value.includes("\0")
    || Buffer.from(value, "utf8").toString("utf8") !== value) fail();
  return value;
}
const utilities = [
  "SET LOCAL statement_timeout = '5s'",
  "SET LOCAL lock_timeout = '1s'",
  "SET LOCAL search_path = pg_catalog",
  "LOCK TABLE ONLY public.runs, ONLY public.steps, ONLY public.stories, ONLY public.rules, ONLY public.run_observations IN ACCESS SHARE MODE",
] as const;

export function createDashboardCoreReadonlyReaderV2(capturedPrivateUrl: string) {
  if (selected) fail();
  selected = true;
  if (arguments.length !== 1) fail();
  if (typeof capturedPrivateUrl !== "string" || capturedPrivateUrl.length > 65536
    || Buffer.byteLength(capturedPrivateUrl, "utf8") > 65536) fail();
  const url = primitiveText(capturedPrivateUrl, true);
  if (!/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(url)) fail();
  let target: URL, user: string, password: string;
  try {
    target = new URL(url);
    user = primitiveText(decodeURIComponent(target.username), true);
    password = primitiveText(decodeURIComponent(target.password));
  } catch { fail(); }
  const hostname = target.hostname;
  let phase: Phase = "UNPREPARED";
  let active: Attempt | null = null;
  let baseline: DashboardCoreReadonlyQualificationV2 | undefined;

  function burn(attempt = active): void {
    phase = "REFUSED";
    if (attempt) {
      attempt.burned = true;
      if (attempt.client) void endOnce(attempt).catch(() => {});
    }
  }
  function check(attempt: Attempt, live = false): void {
    if (phase === "REFUSED" || active !== attempt || attempt.burned || (live && !attempt.live)) {
      burn(attempt); fail();
    }
  }
  function endOnce(attempt: Attempt): Promise<void> {
    if (attempt.endStarted) return attempt.cleanup!;
    attempt.endStarted = true; // Before method lookup, invocation or provider await.
    attempt.cleanup = Promise.resolve().then(async () => {
      const client = attempt.client;
      if (!client) fail();
      const original = client.end({ timeout: 1 });
      attempt.endOriginal = original;
      if (!types.isPromise(original)) fail();
      await original;
      attempt.endSettled = true;
    }).catch(() => { burn(attempt); fail(); });
    void attempt.cleanup.catch(() => {});
    return attempt.cleanup;
  }
  function track(attempt: Attempt, original: unknown): Promise<any> {
    if (!types.isPromise(original) || types.isProxy(original) || attempt.usedQueries.has(original)) {
      burn(attempt); fail();
    }
    attempt.usedQueries.add(original);
    attempt.originals.add(original); // Retain actual lazy Query before observers.
    // Observe native settlement without invoking Query.then/handle. This must
    // precede a burn fence: an already-rejecting returned original still needs
    // rejection custody even though its lazy source initiation is now refused.
    const settlement = Reflect.apply(Promise.prototype.then, original, [
      () => { attempt.originals.delete(original); },
      () => { attempt.originals.delete(original); burn(attempt); },
    ]) as Promise<void>;
    attempt.pending.add(settlement);
    void settlement.then(() => attempt.pending.delete(settlement), () => {
      attempt.pending.delete(settlement); burn(attempt);
    });
    check(attempt, true);
    let pending: Promise<unknown>;
    try {
      // Do not defer Query.then through Promise.resolve assimilation: a burn
      // between source invocation and assimilation must not initiate a Query.
      const then = original.then;
      check(attempt, true);
      if (typeof then !== "function" || types.isProxy(then)) { burn(attempt); fail(); }
      pending = Reflect.apply(then, original, [(value: unknown) => {
        attempt.originals.delete(original);
        check(attempt, true);
        return value;
      }, () => { attempt.originals.delete(original); burn(attempt); fail(); }]);
      if (!types.isPromise(pending) || types.isProxy(pending)) { burn(attempt); fail(); }
    } catch { burn(attempt); fail(); }
    attempt.pending.add(pending);
    void pending.then(() => attempt.pending.delete(pending), () => attempt.pending.delete(pending));
    return pending;
  }
  function guardedTransaction(attempt: Attempt, original: unknown): postgres.TransactionSql {
    check(attempt, true);
    if (typeof original !== "function" || types.isProxy(original)) { burn(attempt); fail(); }
    const unsafe = (original as unknown as { unsafe: unknown }).unsafe;
    check(attempt, true);
    if (typeof unsafe !== "function" || types.isProxy(unsafe)) { burn(attempt); fail(); }
    const forward = (...args: unknown[]) => {
      check(attempt, true);
      let pending: unknown;
      try { pending = Reflect.apply(original, original, args); }
      catch { burn(attempt); fail(); }
      return track(attempt, pending);
    };
    Object.defineProperty(forward, "unsafe", { value: (...args: unknown[]) => {
      check(attempt, true);
      let pending: unknown;
      try { pending = Reflect.apply(unsafe, original, args); }
      catch { burn(attempt); fail(); }
      return track(attempt, pending);
    } });
    // Only the retained callable/unsafe surface is forwarded. No driver controls,
    // nested transaction, URL, options or caller callback are supplied.
    return forward as unknown as postgres.TransactionSql;
  }
  async function execute(request?: CopiedDashboardCoreRequestV2): Promise<Outcome> {
    const attempt: Attempt = { client: null, burned: false, live: false, callbackOriginal: null,
      callbackSettled: false, callbackSucceeded: false, outcome: null, beginOriginal: null,
      beginSucceeded: false, originals: new Set(), pending: new Set(), usedQueries: new WeakSet(),
      endStarted: false, endOriginal: null, cleanup: null, endSettled: false };
    active = attempt; // Before environment, factory, target inspection or await.
    try {
      if (Object.keys(process.env).some(key => key.startsWith("PG"))) { burn(attempt); fail(); }
      const client = postgres(url, {
        max: 1, idle_timeout: 1, connect_timeout: 5, debug: false, onnotice: () => {},
        onclose: () => { if (!attempt.endStarted) burn(attempt); },
      });
      attempt.client = client; // Original custody before actual option inspection.
      check(attempt);
      // Installed provider runtime fields include path:false and socket, while
      // its declaration omits those exact runtime alternatives.
      const options = client.options as unknown as Record<string, unknown>;
      if (!options || types.isProxy(options)
        || !Array.isArray(options.host) || types.isProxy(options.host) || options.host.length !== 1 || options.host[0] !== hostname
        || !Array.isArray(options.port) || types.isProxy(options.port) || options.port.length !== 1 || options.port[0] !== 5432
        || options.database !== "setfarm" || options.user !== user || options.pass !== password
        || options.path !== false || options.ssl !== false || options.socket !== undefined) { burn(attempt); fail(); }
      check(attempt);
      const begin = client.begin;
      check(attempt);
      const originalBegin = Reflect.apply(begin, client, ["isolation level repeatable read read only", (original: postgres.TransactionSql) => {
        if (attempt.callbackOriginal) { burn(attempt); fail(); }
        const work = Promise.resolve().then(async () => {
          check(attempt); attempt.live = true;
          const transaction = guardedTransaction(attempt, original);
          for (const statement of utilities) { await transaction.unsafe(statement); check(attempt, true); }
          const initial = await observeDashboardCoreReadonlyQualificationV2(transaction, request ? baseline : undefined);
          check(attempt, true);
          let data: unknown, capacity: unknown;
          if (request) {
            try { data = await readDashboardCoreResponseInTransactionV2(transaction, request); }
            catch (error) {
              if (classifyDashboardCoreResponseFailureV2(error)?.code !== "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED") throw error;
              capacity = error;
            }
          }
          check(attempt, true);
          const qualification = await observeDashboardCoreReadonlyQualificationV2(transaction, initial);
          check(attempt, true);
          while (attempt.pending.size) { await Promise.all([...attempt.pending]); check(attempt, true); }
          attempt.outcome = Object.freeze({ qualification, data, capacity });
          return attempt.outcome;
        }).then(outcome => {
          attempt.callbackSettled = true; attempt.callbackSucceeded = true; attempt.live = false;
          return outcome;
        }, () => {
          attempt.callbackSettled = true; attempt.live = false;
          burn(attempt); fail();
        });
        attempt.callbackOriginal = work; // Before deferred body/source ports.
        void work.catch(() => {});
        return work;
      }]);
      attempt.beginOriginal = originalBegin;
      if (!types.isPromise(originalBegin)) { burn(attempt); fail(); }
      const outcome = await originalBegin;
      if (!attempt.callbackSettled || !attempt.callbackSucceeded || outcome !== attempt.outcome
        || !attempt.outcome || attempt.originals.size || attempt.pending.size) { burn(attempt); fail(); }
      attempt.beginSucceeded = true;
      check(attempt);
      await endOnce(attempt);
      check(attempt);
      if (!attempt.endSettled) { burn(attempt); fail(); }
      active = null; // Only after all original successful settlement.
      return attempt.outcome;
    } catch {
      burn(attempt);
      if (attempt.client) { try { await endOnce(attempt); } catch {} }
      // Failed custody/pending originals stay retained. No replacement.
      fail();
    }
  }
  async function prepare(): Promise<void> {
    if (phase === "REFUSED") fail();
    if (phase === "PREPARING") { burn(); fail(); }
    if (phase === "READY") fail("DASHBOARD_CUTOVER_CORE_READER_DUPLICATE_PREPARATION_REFUSED");
    phase = "PREPARING";
    if (arguments.length !== 0) { burn(); fail(); }
    const outcome = await execute();
    // Provider callbacks may synchronously revoke while execute is suspended.
    if ((phase as Phase) === "REFUSED") fail();
    baseline = outcome.qualification;
    phase = "READY";
  }
  async function read(request: unknown): Promise<unknown> {
    if (phase !== "READY") { burn(); fail(); }
    if (active) fail("DASHBOARD_CUTOVER_CORE_READER_BUSY");
    const copied = copyDashboardCoreRequestV2(arguments.length === 1 ? request : undefined);
    const outcome = await execute(copied);
    if ((phase as Phase) !== "READY") fail(); // Final public publication fence.
    if (outcome.capacity) throw outcome.capacity; // Outside callback, after final/commit/end.
    return outcome.data;
  }
  function refuse(): void {
    burn();
    if (arguments.length !== 0) fail();
  }
  return Object.freeze({ prepare, read, refuse });
}
