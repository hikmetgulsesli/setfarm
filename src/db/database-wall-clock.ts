import type postgres from "postgres";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

/**
 * Read PostgreSQL's wall clock, not the transaction-start timestamp exposed by
 * CURRENT_TIMESTAMP/NOW(). Lease authority must call this only after acquiring
 * every canonical owner lock that can make the decision wait.
 */
export async function readDatabaseWallClock(
  sql: Sql | TransactionSql,
  errorCode = "DATABASE_WALL_CLOCK_UNAVAILABLE",
): Promise<Date> {
  const rows = await sql.unsafe<Array<{ wall_clock: Date | string }>>(
    "SELECT clock_timestamp() AS wall_clock",
  );
  const raw = rows[0]?.wall_clock;
  const wallClock = raw instanceof Date ? raw : new Date(raw ?? Number.NaN);
  if (!Number.isFinite(wallClock.getTime())) throw new Error(errorCode);
  return wallClock;
}
