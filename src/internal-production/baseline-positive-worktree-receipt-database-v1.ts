import path from "node:path";
import { types } from "node:util";

import { normalizeActiveOwnerRowPgResultV2 } from "./baseline-positive-worktree-active-row-snapshot-v2.js";
import { observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1 } from "./baseline-positive-worktree-receipt-protocol-v1.js";

// Diagnostic only: the physical/source ports and supplied launcher URL do not
// authenticate a producer. Raw fence bytes remain inside this private DB port.
const NAME = /^[A-Za-z0-9._-]+$/;
const ATTEMPTS_SQL = `SELECT run_id AS "runId", claim_id::text AS "claimId",
  attempt_id AS "attemptId", generation, fence_token AS "fenceToken",
  worktree AS "worktreeRoot", source_before_sha AS "sourceSha",
  source_before_tree_hash AS "sourceTreeHash", disposition
  FROM public.execution_attempts
  WHERE worktree = $1 AND disposition IN ('claimed','running')
  ORDER BY attempt_id COLLATE "C" LIMIT 2`;
const SESSIONS_SQL = `SELECT run_id AS "runId", claim_id::text AS "claimId",
  attempt_id AS "attemptId", session_id AS "sessionId",
  owner_instance_id AS "ownerInstanceId", worktree AS "worktreeRoot", state
  FROM public.runtime_sessions
  WHERE worktree = $1 AND state NOT IN ('released','quarantined')
  ORDER BY session_id COLLATE "C" LIMIT 2`;

type PhysicalPort = <T>(withinHold: (physical: unknown,
  recheckPhysical: () => Promise<unknown>) => Promise<T>) => Promise<T>;
type Ports = Readonly<{ holdPhysical: PhysicalPort; observeSource: () => Promise<unknown> }>;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_DATABASE_INVALID");
}

function canonicalRoot(value: unknown): string {
  if (typeof value !== "string" || value === "/" || value.includes("\0")
    || Buffer.byteLength(value) > 1024 || !path.posix.isAbsolute(value)
    || path.posix.normalize(value) !== value
    || value.split("/").slice(1).some((part) => !NAME.test(part) || part === "." || part === "..")) fail();
  return value;
}

/** Returns only the protocol's unpublished candidate, never the raw DB rows. */
export async function observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1(
  databaseUrl: string | undefined, worktreeRoot: unknown, ports: Ports,
) {
  let sql: import("postgres").Sql | undefined;
  try {
    const root = canonicalRoot(worktreeRoot);
    if (typeof databaseUrl !== "string" || Object.keys(process.env).some((key) => key.startsWith("PG"))
      || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(databaseUrl)
      || ports === null || typeof ports !== "object" || types.isProxy(ports)
      || typeof ports.holdPhysical !== "function" || typeof ports.observeSource !== "function") fail();
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
    let databaseCalls = 0;
    return await observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1({
      holdPhysical: ports.holdPhysical,
      observeSource: ports.observeSource,
      withReadOnlyDatabaseSnapshot: async (withinTransaction) => {
        databaseCalls += 1;
        if (databaseCalls !== 1 || !sql) fail();
        const result = await sql.begin("isolation level repeatable read read only", async (tx) => {
          const connection = tx as unknown as typeof sql;
          if (!connection) fail();
          await connection`SET LOCAL statement_timeout = '5s'`;
          await connection`SET LOCAL lock_timeout = '1s'`;
          await connection`SET LOCAL idle_in_transaction_session_timeout = '10s'`;
          const rawRoleRows = await connection.unsafe(
            'SELECT session_user AS "sessionUser", current_user AS "currentUser"');
          const roleRows = normalizeActiveOwnerRowPgResultV2(
            rawRoleRows as unknown as readonly Record<string, unknown>[]);
          if (roleRows.length !== 1 || roleRows[0]?.sessionUser !== decodeURIComponent(target.username)
            || roleRows[0]?.currentUser !== decodeURIComponent(target.username)) fail();
          const rawAttempts = await connection.unsafe(ATTEMPTS_SQL, [root]);
          const rawSessions = await connection.unsafe(SESSIONS_SQL, [root]);
          const attempts = normalizeActiveOwnerRowPgResultV2(
            rawAttempts as unknown as readonly Record<string, unknown>[]);
          const sessions = normalizeActiveOwnerRowPgResultV2(
            rawSessions as unknown as readonly Record<string, unknown>[]);
          if (attempts.length !== 1 || sessions.length !== 1) fail();
          return withinTransaction({ attempts, sessions });
        });
        return result as unknown as Awaited<ReturnType<typeof withinTransaction>>;
      },
    });
  } catch { fail(); }
  finally {
    if (sql) {
      try { await sql.end({ timeout: 1 }); } catch { fail(); }
    }
  }
}
