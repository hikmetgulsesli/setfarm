import type postgres from "postgres";
import { parseTask6aPostgresSocketTransportV1, buildTask6aPostgresSocketOptionsV1 }
  from "./task6a-postgres-socket-transport-v1.js";
import { holdTask6aSocketPhysicalEvidenceV1 } from "./task6a-socket-physical-evidence-v1.js";
import { createTask6aSingleBackendSocketClientV1 } from "./task6a-single-backend-socket-client-v1.js";
import { withHeldContractSpineV31DiagnosticV2 } from "../db/contract-spine-migrations.js";
import { observeHeldColdPre32LegacyDatabaseCensusV2 } from "./baseline-legacy-database-census-v1.js";

type HeldPrivatePg31DiagnosticV2 = Readonly<{
  observe(): Readonly<{
    schema: "setfarm.task6a-held-pg31-diagnostic.v2";
    authority: "diagnostic-only"; productionAuthority: false;
    backendPid: number; observingBackendCount: 1;
  }>;
  recheck(): Promise<void>;
  revoke(): void;
}>;

// Private rehearsal only. Neither this pathname nor caller-supplied transport
// authenticates a production controller/source or excludes arbitrary writers.
export async function withTask6aPrivateHeldPg31DiagnosticV2<T>(
  transport: unknown, serverUid: number, runtimeGid: number,
  operation: (held: HeldPrivatePg31DiagnosticV2) => Promise<T>,
): Promise<T> {
  const refused = new Error("TASK6A_PRIVATE_HELD_PG31_DIAGNOSTIC_REFUSED");
  const candidate = parseTask6aPostgresSocketTransportV1(transport);
  const identityNumber = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= 4294967294;
  if (arguments.length !== 4 || process.platform !== "darwin" || typeof operation !== "function"
    || !identityNumber(serverUid) || !identityNumber(runtimeGid) || serverUid === candidate.osUid
    || candidate.database !== "setfarm"
    || !/^\/private\/tmp\/setfarm-task6a-protected-pg\.[A-Za-z0-9]+\/socket$/.test(candidate.socketDirectory)) throw refused;
  buildTask6aPostgresSocketOptionsV1(candidate, "pool", process.env);
  if (process.getuid?.() !== candidate.osUid || process.geteuid?.() !== candidate.osUid
    || process.getgid?.() !== runtimeGid || process.getegid?.() !== runtimeGid) throw refused;

  const now = () => Number(process.hrtime.bigint()) / 1_000_000;
  const started = now(), expiresAt = started + 60000;
  if (!Number.isFinite(started)) throw refused;
  let physical: ReturnType<typeof holdTask6aSocketPhysicalEvidenceV1> | undefined;
  let client: ReturnType<typeof createTask6aSingleBackendSocketClientV1> | undefined;
  let reserved: postgres.ReservedSql | undefined;
  let disposed = false, positiveBurned = false, inContinuation = false, checking = false;
  let identity: Readonly<Record<string, unknown>> | undefined;
  const failures: unknown[] = [];
  const record = (error: unknown) => {
    if (!failures.some(previous => Object.is(previous, error))) failures.push(error);
  };
  const revoke = () => {
    positiveBurned = true; disposed = true; // Fence before asynchronous disposal.
    try { client?.revoke(); } catch (error) { record(error); }
    try { physical?.close(); } catch (error) { record(error); }
  };
  let expire!: (error: Error) => void;
  const expiration = new Promise<never>((_resolve, reject) => { expire = reject; });
  void expiration.catch(() => {}); // May expire before continuation admission.
  const timer = setTimeout(() => {
    const error = new Error("TASK6A_PRIVATE_HELD_PG31_DEADLINE_EXPIRED");
    record(error); revoke(); expire(error);
  }, 60000);
  const transportCheck = (positive: boolean) => {
    try {
      const current = now();
      if (disposed || (positive && positiveBurned) || !Number.isFinite(current) || current >= expiresAt
        || process.getuid?.() !== candidate.osUid || process.geteuid?.() !== candidate.osUid
        || process.getgid?.() !== runtimeGid || process.getegid?.() !== runtimeGid) throw refused;
      buildTask6aPostgresSocketOptionsV1(candidate, "pool", process.env);
      physical!.recheck();
      const state = client!.observe();
      if (state.revoked || state.nativeSocketCreations !== 1) throw refused;
      const settled = now(); // Synchronous physical ACL inspection can block timers.
      if (disposed || (positive && positiveBurned) || !Number.isFinite(settled) || settled >= expiresAt) throw refused;
    } catch (error) { record(error); revoke(); throw error; }
  };
  // Clear PG's transaction-local activity cache in a separate awaited command.
  // MVCC integrity/census stay the original retained snapshot, not fresh DML.
  const population = async (positive: boolean) => {
    transportCheck(positive);
    await reserved!.unsafe("SELECT pg_catalog.pg_stat_clear_snapshot()");
    transportCheck(positive);
    const rows = await reserved!.unsafe<Array<Record<string, unknown>>>(`
      SELECT self.pid AS "backendPid", self.backend_start::text AS "backendStart",
        self.usesysid::text AS "sessionRoleOid", session_user::text AS "sessionRoleName",
        self.datid::text AS "databaseOid", self.datname::text AS "databaseName",
        current_user::text AS "effectiveRole", self.client_addr::text AS "clientAddress",
        self.client_port AS "clientPort", self.backend_type AS "backendType",
        (SELECT COUNT(*)::text FROM pg_catalog.pg_stat_activity other
          WHERE other.datid = self.datid AND other.pid <> self.pid) AS "otherBackendCount"
      FROM pg_catalog.pg_stat_activity self WHERE self.pid = pg_catalog.pg_backend_pid()`);
    transportCheck(positive);
    const row = rows[0];
    const fields = ["backendPid", "backendStart", "sessionRoleOid", "sessionRoleName", "databaseOid",
      "databaseName", "effectiveRole", "clientAddress", "clientPort", "backendType", "otherBackendCount"];
    if (rows.length !== 1 || !row || Object.getPrototypeOf(row) !== Object.prototype
      || Reflect.ownKeys(row).length !== fields.length || fields.some(key => {
        const descriptor = Object.getOwnPropertyDescriptor(row, key);
        return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
      }) || !Number.isSafeInteger(row.backendPid) || Number(row.backendPid) < 2
      || typeof row.backendStart !== "string" || !row.backendStart
      || typeof row.sessionRoleOid !== "string" || !/^[1-9][0-9]*$/.test(row.sessionRoleOid)
      || typeof row.databaseOid !== "string" || !/^[1-9][0-9]*$/.test(row.databaseOid)
      || row.sessionRoleName !== candidate.user || row.effectiveRole !== candidate.user
      || row.databaseName !== "setfarm" || row.clientAddress !== null || row.clientPort !== -1
      || row.backendType !== "client backend"
      || typeof row.otherBackendCount !== "string" || !/^(0|[1-9][0-9]*)$/.test(row.otherBackendCount)) {
      record(refused); revoke(); throw refused;
    }
    const lifetime = Object.freeze(Object.fromEntries(fields.filter(key => key !== "otherBackendCount")
      .map(key => [key, row[key]])));
    if (identity && Object.keys(lifetime).some(key => !Object.is(identity![key], lifetime[key]))) {
      record(refused); revoke(); throw refused;
    }
    identity ??= lifetime;
    if (positive && row.otherBackendCount !== "0") {
      positiveBurned = true; record(refused); throw refused;
    }
  };
  const controlQuery = (query: string) => query === "ROLLBACK"
    || query === "SELECT pg_advisory_unlock($1) AS unlocked"
    || /^RESET (?:lock_timeout|statement_timeout|idle_in_transaction_session_timeout|search_path|quote_all_identifiers)$/.test(query)
    || query === "SELECT set_config('statement_timeout', $1, false)"
    || /^DROP TABLE IF EXISTS pg_temp\.setfarm_operational_failure_cause_v3_(?:verify_v3|canonical_identity_v3|behavior)$/.test(query);
  let queryTail: Promise<unknown> = Promise.resolve();
  const bracket = (positive: boolean, query: () => PromiseLike<unknown>, recovery = false) => {
    // Source audit branches can use Promise.all. Serialize the complete
    // clear/sample/query/clear/sample bracket, not merely individual commands,
    // or simultaneous clears would leave subsequent samples sharing a cache.
    const pending = queryTail.then(async () => {
      try {
        // An aborted PG transaction rejects every SELECT until ROLLBACK.
        // Recover only this exact control command, with physical/runtime pins
        // before it and refreshed same-backend identity/population afterwards.
        if (recovery) transportCheck(false);
        else await population(positive);
        const result = await query();
        await population(positive);
        return result;
      } catch (error) { positiveBurned = true; record(error); throw error; }
    });
    queryTail = pending.catch(() => {});
    return pending;
  };
  let result: T | undefined;
  try {
    physical = holdTask6aSocketPhysicalEvidenceV1(candidate, serverUid, runtimeGid);
    if (disposed || !Number.isFinite(now()) || now() >= expiresAt) throw refused;
    client = createTask6aSingleBackendSocketClientV1(candidate);
    reserved = await client.sql.reserve();
    // Bind actual backend lifetime/population before session/TEMP/lock effects.
    await population(true);
    const sql = new Proxy(reserved, {
      apply(target, thisArgument, args) {
        return bracket(true, () => Reflect.apply(target, thisArgument, args));
      },
      get(target, property, receiver) {
        if (["begin", "reserve", "release", "end", "listen", "notify"].includes(String(property))) return undefined;
        if (property !== "unsafe") return Reflect.get(target, property, receiver);
        return (query: string, ...args: unknown[]) => bracket(!controlQuery(query),
          () => Reflect.apply(target.unsafe, target, [query, ...args]), query === "ROLLBACK");
      },
    });
    result = await withHeldContractSpineV31DiagnosticV2(sql, async () => {
      await observeHeldColdPre32LegacyDatabaseCensusV2(sql as unknown as postgres.Sql);
      await population(true);
      inContinuation = true;
      const ownedRechecks = new Set<Promise<void>>();
      const check = () => {
        if (!inContinuation) throw refused;
        transportCheck(true);
      };
      const held: HeldPrivatePg31DiagnosticV2 = Object.freeze({
        observe: () => {
          check();
          return Object.freeze({ schema: "setfarm.task6a-held-pg31-diagnostic.v2" as const,
            authority: "diagnostic-only" as const, productionAuthority: false as const,
            backendPid: Number(identity!.backendPid), observingBackendCount: 1 as const });
        },
        recheck: () => {
          const pending = (async () => {
            check();
            if (checking) { record(refused); revoke(); throw refused; }
            checking = true;
            try { await population(true); check(); }
            catch (error) { record(error); revoke(); throw error; }
            finally { checking = false; }
          })();
          ownedRechecks.add(pending);
          void pending.catch(() => {}); // Own the exact public promise, even if abandoned.
          return pending;
        },
        revoke,
      });
      try {
        const value = await Promise.race([operation(held), expiration]);
        check();
        if (checking) throw refused; // Unawaited recheck cannot outlive continuation.
        await population(true);
        return value;
      } finally {
        inContinuation = false;
        if (checking) { record(refused); revoke(); }
        // An unawaited public recheck owns actual driver work, not just a
        // callback promise. Terminal disposal must settle it before cleanup
        // and the final error snapshot; its distinct failure is retained.
        await Promise.allSettled([...ownedRechecks]);
      }
    });
  } catch (error) { record(error); }
  finally {
    revoke();
    try { await client?.close(); } catch (error) { record(error); }
    clearTimeout(timer);
  }
  if (failures.length > 1) throw new AggregateError(failures, "TASK6A_PRIVATE_HELD_PG31_DIAGNOSTIC_FAILED");
  if (failures.length) throw failures[0];
  return result as T;
}
