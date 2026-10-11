import { holdTask6aProtectedPostgresSocketV1 } from "./task6a-socket-physical-evidence-v1.js";
import { createTask6aSingleBackendSocketClientV1 } from "./task6a-single-backend-socket-client-v1.js";
import type postgres from "postgres";
import type { ReadOnlyCatalogTransactionV1 } from "../db/read-only-catalog-transaction-v1.js";
import { verifyContractSpineRuntimeAccessInTransactionReadOnlyV1 } from "../db/contract-spine-runtime-access-readonly-verifier-v1.js";
import { verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1 } from "../db/base-schema-readonly-verifier-v1.js";
import { verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1 } from "../db/public-object-owner-readonly-verifier-v1.js";

type Held = NonNullable<ReturnType<typeof holdTask6aProtectedPostgresSocketV1>>;
type Client = ReturnType<typeof createTask6aSingleBackendSocketClientV1>;
type Reserved = Awaited<ReturnType<Client["sql"]["reserve"]>>;
type Lifetime = Readonly<{ pid: number; backendStart: string; session: string;
  role: string; database: string; socket: true }>;
const fields = ["pid", "backendStart", "session", "role", "database", "socket"] as const;
const lifetimeQuery = 'SELECT self.pid AS pid, self.backend_start::text AS "backendStart", session_user AS session, current_user AS role, current_database() AS database, inet_client_addr() IS NULL AS socket FROM pg_catalog.pg_stat_activity self WHERE self.pid = pg_catalog.pg_backend_pid()';
const refused = () => Error("TASK6A_PROTECTED_POSTGRES_BACKEND_PROBE_REFUSED");
let active = false, cleanupUncertain = false;
// Unknown construction/close cannot surrender custody or be retried/adopted.
const quarantined = new Set<{ held: Held; client: Client | undefined; originals: unknown[] }>();

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

// Finite closed read-only composition, NOT initializer/grants/readiness/admission.
// Returns neither facts nor a client/holder/capability. Import has no effects.
export async function probeTask6aProtectedPostgresBackendV1(): Promise<void> {
  if (arguments.length !== 0 || active || cleanupUncertain) throw refused();
  active = true;
  let held: Held | undefined, client: Client | undefined, reserved: Reserved | undefined;
  let clientAttempted = false, failed = false;
  const originals: unknown[] = [];
  try {
    held = holdTask6aProtectedPostgresSocketV1();
    if (!held) throw refused();
    const fixed = held.read();
    if (!fixed) throw refused();
    held.recheck();
    clientAttempted = true;
    client = createTask6aSingleBackendSocketClientV1(fixed.descriptor.transport);
    held.recheck();
    const reservation = client.sql.reserve(); originals.push(reservation);
    reserved = await reservation;
    held.recheck();
    // This query-only bracket retains the genuine PendingQuery, not a forged
    // transaction/PendingQuery facade. No caller can supply statements or ports.
    const transaction: ReadOnlyCatalogTransactionV1 = {
      async unsafe<T extends object[] = postgres.Row[]>(statement: string,
        parameters?: Parameters<postgres.TransactionSql["unsafe"]>[1]) {
        held!.recheck();
        const query = reserved!.unsafe<T>(statement, parameters); originals.push(query);
        const rows = await query;
        held!.recheck();
        return rows;
      },
    };
    const before = checkedLifetime(await transaction.unsafe(lifetimeQuery));
    let transactionAttempted = false;
    try {
      held.recheck();
      transactionAttempted = true; // Before dispatch, even a rejected BEGIN needs cleanup.
      const beginning = reserved.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); originals.push(beginning);
      await beginning;
      held.recheck();
      await verifyContractSpineRuntimeAccessInTransactionReadOnlyV1(transaction);
      await verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1(transaction);
      await verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1(transaction, fixed.descriptor.schemaOwner);
    } finally {
      if (transactionAttempted) {
        // Cleanup must not be gated by a now-refused holder. Same reservation,
        // one original, no retry; pending rollback cannot surrender custody.
        const rollback = reserved.unsafe("ROLLBACK"); originals.push(rollback);
        await rollback;
        held.recheck();
      }
    }
    // Outside repeatable-read activity snapshot, after the genuine rollback.
    const after = checkedLifetime(await transaction.unsafe(lifetimeQuery));
    if (fields.some(key => before[key] !== after[key])) throw refused();
    held.recheck();
  } catch { failed = true; }
  finally {
    let mayCloseHeld = !clientAttempted;
    if (client) {
      try { client.revoke(); } catch { failed = true; cleanupUncertain = true; }
      try { reserved?.release(); } catch { failed = true; cleanupUncertain = true; }
      let ending: Promise<void> | undefined;
      try { ending = client.close(); originals.push(ending); }
      catch { failed = true; cleanupUncertain = true; }
      if (ending) {
        try { await ending; } catch { failed = true; cleanupUncertain = true; }
        // Owned client contract joins driver ending AND native close, even on rejection.
        mayCloseHeld = true;
      }
    }
    if (held) {
      if (mayCloseHeld) {
        try { held.close(); } catch { failed = true; cleanupUncertain = true; }
      } else {
        failed = true; cleanupUncertain = true;
        quarantined.add({ held, client, originals });
      }
    }
    active = false;
  }
  if (failed) throw refused();
}
