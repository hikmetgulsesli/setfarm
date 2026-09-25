import { observePositiveWorktreeActiveBindingSnapshotInTransactionV1 } from "./baseline-positive-worktree-active-binding-snapshot-v1.js";
import { normalizeActiveOwnerRowPgResultV2 } from "./baseline-positive-worktree-active-row-snapshot-v2.js";

// Import-inert, diagnostic-only adapter. The caller must supply its privately
// held launcher URL; neither runtimeConfig nor ambient SETFARM_PG_URL is used.
function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_CUTOVER_DATABASE_INVALID");
}

export async function observePositiveWorktreeActiveBindingCutoverDatabaseV1(databaseUrl: string | undefined) {
  let sql: import("postgres").Sql | undefined;
  try {
    if (typeof databaseUrl !== "string" || Object.keys(process.env).some(key => key.startsWith("PG"))
      || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(databaseUrl)) fail();
    const target = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(target.protocol) || !target.username
      || !["localhost", "127.0.0.1"].includes(target.hostname)
      || (target.port !== "" && target.port !== "5432") || target.pathname !== "/setfarm"
      || target.search !== "" || target.hash !== "") fail();
    const postgresModule = await import("postgres");
    sql = postgresModule.default(databaseUrl, {
      max: 1, idle_timeout: 1, connect_timeout: 5, debug: false, onnotice: () => {},
    });
    if (sql.options.host.length !== 1 || sql.options.host[0] !== target.hostname
      || sql.options.port.length !== 1 || sql.options.port[0] !== 5432
      || sql.options.database !== "setfarm"
      || sql.options.user !== decodeURIComponent(target.username)) fail();
    return await sql.begin("isolation level repeatable read read only", async tx => {
      const connection = tx as unknown as typeof sql;
      if (!connection) fail();
      await connection`SET LOCAL statement_timeout = '5s'`;
      await connection`SET LOCAL lock_timeout = '1s'`;
      return observePositiveWorktreeActiveBindingSnapshotInTransactionV1(async statement =>
        normalizeActiveOwnerRowPgResultV2(await connection.unsafe(statement) as unknown as readonly Record<string, unknown>[]));
    });
  } catch { fail(); }
  finally {
    if (sql) {
      try { await sql.end({ timeout: 1 }); } catch { fail(); }
    }
  }
}
