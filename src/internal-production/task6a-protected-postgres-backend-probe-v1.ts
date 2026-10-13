import { holdTask6aProtectedPostgresSocketV1 } from "./task6a-socket-physical-evidence-v1.js";
import { createTask6aSingleBackendSocketClientV1 } from "./task6a-single-backend-socket-client-v1.js";
import type postgres from "postgres";
import { setTimeout, clearTimeout } from "node:timers";
import { types } from "node:util";
import type { ReadOnlyCatalogTransactionV1 } from "../db/read-only-catalog-transaction-v1.js";
import { verifyContractSpineRuntimeAccessInTransactionReadOnlyV1 } from "../db/contract-spine-runtime-access-readonly-verifier-v1.js";
import { verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1 } from "../db/base-schema-readonly-verifier-v1.js";
import { verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1 } from "../db/public-object-owner-readonly-verifier-v1.js";
import { requireColdPre32CatalogAbsenceInTransactionV1 } from "./task6a-cold-pre32-catalog-readonly-v1.js";

type Held = NonNullable<ReturnType<typeof holdTask6aProtectedPostgresSocketV1>>;
type Client = ReturnType<typeof createTask6aSingleBackendSocketClientV1>;
type Reserved = Awaited<ReturnType<Client["sql"]["reserve"]>>;
type Lifetime = Readonly<{ pid: number; backendStart: string; session: string;
  role: string; database: string; socket: true }>;
const fields = ["pid", "backendStart", "session", "role", "database", "socket"] as const;
const lifetimeQuery = 'SELECT self.pid AS pid, self.backend_start::text AS "backendStart", session_user AS session, current_user AS role, current_database() AS database, inet_client_addr() IS NULL AS socket FROM pg_catalog.pg_stat_activity self WHERE self.pid = pg_catalog.pg_backend_pid()';
const refused = () => Error("TASK6A_PROTECTED_POSTGRES_BACKEND_PROBE_REFUSED");
declare const protectedBackendOwnerV2: unique symbol;
export type Task6aProtectedBackendOwnerV2 = Readonly<{ [protectedBackendOwnerV2]: true }>;
const cleanupNames = ["join", "rollback", "lifetime", "revoke", "release", "ending", "physical", "timer"] as const;
type CleanupName = typeof cleanupNames[number];
type CleanupSlot = { attempted: boolean; uncertain: boolean;
  state: "unused" | "started" | "fulfilled" | "rejected" | "threw" | "skipped" | "blocked";
  original?: unknown; completion?: Promise<unknown>; error?: unknown };
type Keeper = {
  kind: "finite" | "sustained"; held?: Held; client?: Client; reserved?: Reserved;
  clientAttempted: boolean; beginAttempted: boolean; initialized: boolean; invalid: boolean;
  originals: unknown[]; pending: Set<Promise<unknown>>; before?: Lifetime;
  positiveCount: number; recheckAttempts: number; expiresAt?: bigint;
  timer?: ReturnType<typeof setTimeout>; owner?: Task6aProtectedBackendOwnerV2;
  checking?: Promise<void>; closing?: Promise<void>; driving?: Promise<void>;
  cleanup: Record<CleanupName, CleanupSlot>;
  phase: "initializing" | "held" | "closing" | "closed" | "quarantined";
};
let activeKeeper: Keeper | undefined, cleanupUncertain = false;
const issued = new WeakMap<Task6aProtectedBackendOwnerV2, Keeper>();
// Strong retention is independent of returned token/WeakMap reachability.
const quarantined = new Set<Keeper>();

function checkedLifetime(rows: unknown): Lifetime {
  if (!Array.isArray(rows) || rows.length !== 1) throw refused();
  const row = rows[0] as Record<string, unknown>;
  if (!row || typeof row !== "object" || Array.isArray(row)
    || Object.keys(row).length !== fields.length || fields.some(key => !Object.hasOwn(row, key))
    || typeof row.pid !== "number" || !Number.isSafeInteger(row.pid) || row.pid <= 1 || row.pid > 2147483647
    || typeof row.backendStart !== "string"
    || !/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(?:[.][0-9]{1,6})?[+-][0-9]{2}(?::[0-9]{2})?$/.test(row.backendStart)
    || row.session !== "setfarm_runtime" || row.role !== "setfarm_runtime"
    || row.database !== "setfarm" || row.socket !== true) throw refused();
  return Object.freeze({ pid: row.pid, backendStart: row.backendStart, session: row.session,
    role: row.role, database: row.database, socket: true });
}

const ownerRefused = () => Error("TASK6A_PROTECTED_POSTGRES_BACKEND_OWNER_REFUSED");
function budget(keeper: Keeper) {
  if (keeper.kind === "sustained" && (keeper.invalid || keeper.expiresAt === undefined
    || process.hrtime.bigint() >= keeper.expiresAt)) {
    keeper.invalid = true; throw ownerRefused();
  }
}
function physical(keeper: Keeper) { budget(keeper); keeper.held!.recheck(); budget(keeper); }
function positive(keeper: Keeper) {
  if (activeKeeper !== keeper || keeper.invalid || keeper.phase !== "held") throw ownerRefused();
  physical(keeper);
  const state = keeper.client!.observe();
  if (activeKeeper !== keeper || keeper.invalid || keeper.phase !== "held"
    || state.revoked || state.nativeSocketCreations !== 1) { keeper.invalid = true; throw ownerRefused(); }
}
function original<T>(keeper: Keeper, invoke: () => PromiseLike<T>): Promise<T> {
  if (keeper.kind === "sustained") {
    budget(keeper);
    if (keeper.positiveCount >= 8192) { keeper.invalid = true; throw ownerRefused(); }
    keeper.positiveCount++; // Intent before invocation, including a throw.
  }
  const value = invoke(); keeper.originals.push(value);
  const completion = Promise.resolve(value); keeper.originals.push(completion);
  keeper.pending.add(completion);
  void completion.then(() => keeper.pending.delete(completion), () => keeper.pending.delete(completion));
  return completion;
}
function cleanupOriginal<T>(keeper: Keeper, name: CleanupName, invoke: () => T, nativeEnding = false): Promise<Awaited<T>> {
  const slot = keeper.cleanup[name];
  if (slot.state !== "unused") throw refused();
  slot.attempted = true; slot.state = "started"; // Intent before the owned invocation.
  try {
    const value = invoke(); slot.original = value; keeper.originals.push(value);
    // An assimilated completion cannot prove that the actual owned client's
    // driver/native-ending original was returned. Never invoke foreign thenables.
    if (nativeEnding && !types.isPromise(value)) throw refused();
    const completion = Promise.resolve(value); slot.completion = completion;
    keeper.originals.push(completion);
    void completion.then(() => { slot.state = "fulfilled"; }, error => {
      slot.state = "rejected"; slot.error = error; slot.uncertain = true;
    });
    return completion;
  } catch (error) { slot.state = "threw"; slot.error = error; slot.uncertain = true; throw error; }
}
function skipCleanup(keeper: Keeper, name: CleanupName, blocked = false) {
  const slot = keeper.cleanup[name];
  if (slot.state !== "unused") throw refused();
  slot.state = blocked ? "blocked" : "skipped";
  slot.uncertain = blocked;
}
function createKeeper(kind: Keeper["kind"]): Keeper {
  if (activeKeeper || cleanupUncertain) throw refused();
  const keeper: Keeper = { kind, clientAttempted: false, beginAttempted: false, initialized: false, invalid: false,
    originals: [], pending: new Set(), positiveCount: 0, recheckAttempts: 0, phase: "initializing",
    cleanup: Object.fromEntries(cleanupNames.map(name => [name, { attempted: false, uncertain: false, state: "unused" }])) as Record<CleanupName, CleanupSlot> };
  activeKeeper = keeper; // Strong custody before the first allocation.
  if (kind === "sustained") {
    keeper.expiresAt = process.hrtime.bigint() + 180_000_000_000n;
    keeper.timer = setTimeout(() => { keeper.invalid = true; }, 180_000);
  }
  return keeper;
}
async function initialize(keeper: Keeper): Promise<void> {
  keeper.held = holdTask6aProtectedPostgresSocketV1();
  if (!keeper.held) throw refused();
  const fixed = keeper.held.read(); if (!fixed) throw refused();
  physical(keeper);
  keeper.clientAttempted = true;
  keeper.client = createTask6aSingleBackendSocketClientV1(fixed.descriptor.transport);
  physical(keeper);
  keeper.reserved = await original(keeper, () => keeper.client!.sql.reserve());
  physical(keeper);
  const transaction: ReadOnlyCatalogTransactionV1 = {
    async unsafe<T extends object[] = postgres.Row[]>(statement: string,
      parameters?: Parameters<postgres.TransactionSql["unsafe"]>[1]) {
      physical(keeper);
      const rows = await original(keeper, () => keeper.reserved!.unsafe<T>(statement, parameters));
      physical(keeper); return rows;
    },
  };
  keeper.before = checkedLifetime(await transaction.unsafe(lifetimeQuery));
  physical(keeper);
  keeper.beginAttempted = true;
  await original(keeper, () => keeper.reserved!.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"));
  physical(keeper);
  await verifyContractSpineRuntimeAccessInTransactionReadOnlyV1(transaction);
  await verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1(transaction);
  await verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1(transaction, fixed.descriptor.schemaOwner);
  physical(keeper);
  const canonical = await original(keeper, () => import("../db/contract-spine-migrations.js"));
  physical(keeper);
  await canonical.verifyHeldPre32ContractSpineJournalIdentityV1(
    async (statement, parameters) => await transaction.unsafe(statement, [...parameters]),
  );
  await requireColdPre32CatalogAbsenceInTransactionV1(transaction);
  keeper.initialized = true; keeper.phase = "held";
}

// This wrapper caches its native Promise BEFORE any fallible disposal dispatch.
// Calling again returns that same object, even after rejection/uncertainty.
function closeKeeper(keeper: Keeper): Promise<void> {
  if (keeper.closing) return keeper.closing;
  keeper.invalid = true; keeper.phase = "closing";
  let resolve!: () => void, reject!: (reason: unknown) => void;
  const closing = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  keeper.closing = closing; keeper.originals.push(closing);
  // Caller publication/handler loss cannot create an unhandled rejection. The
  // actual cached Promise still rejects for explicit awaiters and is never replaced.
  void closing.catch(() => {});
  keeper.driving = (async () => {
    let failed = false, uncertain = false;
    // Only started lower-level originals and the actual public recheck. Never
    // join this disposer, its cached close or an initializer awaiting disposal.
    const started = [...keeper.pending];
    if (keeper.checking) started.push(keeper.checking);
    await cleanupOriginal(keeper, "join", () => Promise.allSettled(started));
    if (keeper.reserved && keeper.beginAttempted) {
      try {
        await cleanupOriginal(keeper, "rollback", () => keeper.reserved!.unsafe("ROLLBACK"));
        // Diagnostic checks may refuse; that cannot gate remaining disposal.
        keeper.held!.recheck();
        if (keeper.initialized) {
          keeper.held!.recheck();
          const after = checkedLifetime(await cleanupOriginal(keeper, "lifetime",
            () => keeper.reserved!.unsafe(lifetimeQuery)));
          keeper.held!.recheck();
          if (!keeper.before || fields.some(key => keeper.before![key] !== after[key])) throw refused();
          keeper.held!.recheck();
        }
      } catch { failed = true; }
    } else skipCleanup(keeper, "rollback");
    if (keeper.cleanup.lifetime.state === "unused") skipCleanup(keeper, "lifetime");
    let mayCloseHeld = !keeper.clientAttempted;
    if (keeper.client) {
      try { await cleanupOriginal(keeper, "revoke", () => keeper.client!.revoke()); }
      catch { failed = true; uncertain = true; }
      if (keeper.reserved) {
        try { await cleanupOriginal(keeper, "release", () => keeper.reserved!.release()); }
        catch { failed = true; uncertain = true; }
      } else skipCleanup(keeper, "release");
      let ending: Promise<void> | undefined;
      try { ending = cleanupOriginal(keeper, "ending", () => keeper.client!.close(), true); }
      catch { failed = true; uncertain = true; }
      if (ending) {
        try { await ending; } catch { failed = true; uncertain = true; }
        // Owned client ending joins driver AND actual native socket close.
        mayCloseHeld = true;
      }
    } else for (const name of ["revoke", "release", "ending"] as const) skipCleanup(keeper, name);
    if (keeper.held) {
      if (mayCloseHeld) {
        try { await cleanupOriginal(keeper, "physical", () => keeper.held!.close()); }
        catch { failed = true; uncertain = true; }
      } else { skipCleanup(keeper, "physical", true); failed = true; uncertain = true; }
    } else skipCleanup(keeper, "physical");
    if (keeper.timer) {
      try { await cleanupOriginal(keeper, "timer", () => clearTimeout(keeper.timer)); keeper.timer = undefined; }
      catch { failed = true; uncertain = true; }
    } else skipCleanup(keeper, "timer");
    if (uncertain) {
      cleanupUncertain = true; keeper.phase = "quarantined"; quarantined.add(keeper);
    } else {
      keeper.phase = "closed"; if (activeKeeper === keeper) activeKeeper = undefined;
    }
    if (failed) throw refused();
  })();
  void keeper.driving.then(resolve, error => {
    keeper.invalid = true;
    if (keeper.phase !== "closed") {
      cleanupUncertain = true; keeper.phase = "quarantined"; quarantined.add(keeper);
      if (keeper.timer && keeper.cleanup.timer.state === "unused") {
        try {
          const cancellation = cleanupOriginal(keeper, "timer", () => clearTimeout(keeper.timer));
          void cancellation.catch(() => {}); keeper.timer = undefined;
        } catch { /* Unknown cancellation stays in the fixed slot; never retry. */ }
      }
    }
    reject(error);
  });
  return closing;
}

// Finite closed read-only composition remains void and always disposes.
export async function probeTask6aProtectedPostgresBackendV1(): Promise<void> {
  if (arguments.length !== 0) throw refused();
  const keeper = createKeeper("finite"); let failed = false;
  try { await initialize(keeper); } catch { failed = true; }
  finally { try { await closeKeeper(keeper); } catch { failed = true; } }
  if (failed) throw refused();
}

export async function holdTask6aProtectedPostgresBackendV2(): Promise<Task6aProtectedBackendOwnerV2> {
  if (arguments.length !== 0) throw ownerRefused();
  let keeper: Keeper;
  try { keeper = createKeeper("sustained"); } catch { throw ownerRefused(); }
  try {
    await initialize(keeper); positive(keeper);
    const owner = Object.freeze(Object.create(null)) as Task6aProtectedBackendOwnerV2;
    keeper.owner = owner; issued.set(owner, keeper); return owner;
  } catch {
    try { await closeKeeper(keeper); } catch { /* Actual quarantine stays strongly retained. */ }
    throw ownerRefused();
  }
}

export function recheckTask6aProtectedPostgresBackendV2(owner: Task6aProtectedBackendOwnerV2): Promise<void> {
  if (arguments.length !== 1) return Promise.reject(ownerRefused());
  const keeper = issued.get(owner);
  if (!keeper || keeper.owner !== owner || activeKeeper !== keeper || keeper.invalid
    || keeper.phase !== "held") return Promise.reject(ownerRefused());
  if (keeper.checking || keeper.recheckAttempts >= 64) {
    keeper.invalid = true; return Promise.reject(ownerRefused());
  }
  keeper.recheckAttempts++;
  let resolve!: () => void, reject!: (reason: unknown) => void;
  const checking = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  keeper.checking = checking; keeper.originals.push(checking);
  const driving = (async () => {
    try {
      positive(keeper);
      const observed = checkedLifetime(await original(keeper, () => keeper.reserved!.unsafe(lifetimeQuery)));
      positive(keeper);
      if (fields.some(key => keeper.before![key] !== observed[key])) throw ownerRefused();
    } catch { keeper.invalid = true; throw ownerRefused(); }
  })();
  keeper.originals.push(driving); void driving.then(resolve, reject);
  void checking.then(() => { if (keeper.checking === checking) keeper.checking = undefined; },
    () => { if (keeper.checking === checking) keeper.checking = undefined; });
  return checking;
}

export function closeTask6aProtectedPostgresBackendV2(owner: Task6aProtectedBackendOwnerV2): Promise<void> {
  if (arguments.length !== 1) throw ownerRefused();
  const keeper = issued.get(owner);
  if (!keeper || keeper.owner !== owner) throw ownerRefused();
  return closeKeeper(keeper);
}
