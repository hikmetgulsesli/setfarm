import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;
const adapterSource = new URL("../../src/internal-production/baseline-positive-worktree-receipt-database-v1.ts", import.meta.url);

function fixedSql(name: "ATTEMPTS_SQL" | "SESSIONS_SQL"): string {
  const source = readFileSync(adapterSource, "utf8");
  const matches = [...source.matchAll(new RegExp(`const ${name} = \\x60([^\\x60]*)\\x60;`, "g"))];
  if (matches.length !== 1 || !matches[0]?.[1]) throw new Error("TASK6A_PRIVATE_RECEIPT_SQL_SOURCE_INVALID");
  return matches[0][1];
}

function permissionDenied(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "42501";
}

test("private PG17 proves exact receipt SQL under a SELECT-only role", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  const privateHostname = requireTask6aPrivateLoopbackHostname(parsed);
  assert.notEqual(parsed.port, "5432");

  const attemptsSql = fixedSql("ATTEMPTS_SQL");
  const sessionsSql = fixedSql("SESSIONS_SQL");
  for (const statement of [attemptsSql, sessionsSql]) {
    assert.match(statement, /worktree = \$1[\s\S]*LIMIT 2$/);
    assert.equal(statement.includes("${"), false);
  }

  const admin = postgres(adminUrl, { max: 1 });
  let database: TestDatabase | undefined;
  let restricted: ReturnType<typeof postgres> | undefined;
  const suffix = randomBytes(6).toString("hex");
  const role = `task6a_receipt_select_${suffix}`;
  const password = randomBytes(24).toString("hex");
  let roleCreated = false;
  let testFailure: unknown;
  let stage = "private-cluster-preflight";
  try {
    const identity = await admin<Array<{ data_directory: string; port: string;
      socket_directories: string; server_version_num: number }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket_directories,
        current_setting('server_version_num')::integer AS server_version_num
    `;
    assert.equal(identity[0]?.data_directory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    assert.ok(identity[0]?.socket_directories.split(",").map((value) => value.trim())
      .includes(path.dirname(expectedDataDirectory!)));
    assert.ok(identity[0]!.server_version_num >= 170000
      && identity[0]!.server_version_num < 180000);

    stage = "isolated-schema-and-role";
    database = await createIsolatedTestDatabase();
    const ownerRows = await database.sql<Array<{ owner: string }>>`SELECT current_user AS owner`;
    const owner = ownerRows[0]?.owner;
    assert.match(owner ?? "", /^[a-z_][a-z0-9_]{0,62}$/);
    const existing = await admin<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM pg_catalog.pg_roles WHERE rolname = ${role}
    `;
    assert.equal(existing[0]?.count, "0");
    roleCreated = true;
    try {
      await admin.unsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    } catch { throw new Error("TASK6A_PRIVATE_RECEIPT_ROLE_CREATE_FAILED"); }
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.execution_attempts, public.runtime_sessions TO "${role}"`);

    const root = `/tmp/projects/${suffix}/.worktrees/story-1`;
    const alternateRoot = `/tmp/projects/${suffix}/.worktrees/other`;
    const runId = `task6a-receipt-${suffix}`;
    const claimId = 999991;
    const attemptId = `ATT_${randomBytes(8).toString("hex")}`;
    const sessionId = `RTS_${randomBytes(8).toString("hex")}`;
    const fenceToken = randomBytes(32).toString("hex");
    const sourceSha = "a".repeat(40);
    const sourceTreeHash = "b".repeat(40);

    stage = "seed-linked-owner-rows";
    await database.sql`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
      VALUES (${runId}, 999991, 'workflow', 'private receipt SQL probe', 'running', '{}')`;
    await database.sql`INSERT INTO public.claim_log (id, run_id, step_id, agent_id)
      VALUES (${claimId}, ${runId}, 'step', 'agent')`;
    await database.sql`INSERT INTO public.execution_attempts (
      attempt_id, run_id, step_id, generation, fence_token, attempt_class,
      compilation_report_hash, source_before_sha, source_before_tree_hash,
      role, lease_acquired_at, lease_expires_at, heartbeat_at, disposition,
      claim_id, worktree
    ) VALUES (
      ${attemptId}, ${runId}, 'step', 1, ${fenceToken}, 'evidence_only',
      'private-report', ${sourceSha}, ${sourceTreeHash}, 'implementer',
      NOW(), NOW() + INTERVAL '1 hour', NOW(), 'claimed', ${claimId}, ${root}
    )`;
    await database.sql`INSERT INTO public.runtime_sessions (
      session_id, run_id, step_db_id, workflow_step_id, claim_id, attempt_id,
      claim_agent_id, runtime_agent_id, runtime_kind, state, owner_instance_id,
      heartbeat_at, worktree
    ) VALUES (
      ${sessionId}, ${runId}, 'step-db', 'step', ${claimId}, ${attemptId},
      'agent', 'agent', 'external_session', 'reserved', 'private-owner', NOW(), ${root}
    )`;

    const restrictedUrl = new URL(database.url);
    restrictedUrl.username = role;
    restrictedUrl.password = password;
    restrictedUrl.hostname = privateHostname;
    restrictedUrl.port = parsed.port;
    restricted = postgres(restrictedUrl.toString(), { max: 1, connect_timeout: 5 });

    stage = "select-only-capability";
    const rights = await restricted<Array<{ login: string; effective: string;
      superuser: boolean; bypassRls: boolean; ownerMember: boolean;
      attemptSelect: boolean; sessionSelect: boolean; childDml: boolean[] }>>`
      SELECT session_user AS login, current_user AS effective,
        r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
        pg_catalog.pg_has_role(session_user, o.oid, 'MEMBER') AS "ownerMember",
        has_table_privilege(current_user, 'public.execution_attempts', 'SELECT') AS "attemptSelect",
        has_table_privilege(current_user, 'public.runtime_sessions', 'SELECT') AS "sessionSelect",
        ARRAY(SELECT has_table_privilege(current_user, name, privilege)
          FROM unnest(ARRAY['public.execution_attempts', 'public.runtime_sessions']) AS tables(name)
          CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS rights(privilege)) AS "childDml"
      FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_roles o
      WHERE r.rolname = session_user AND o.rolname = ${owner}
    `;
    assert.deepEqual(rights[0], { login: role, effective: role, superuser: false,
      bypassRls: false, ownerMember: false, attemptSelect: true, sessionSelect: true,
      childDml: Array(6).fill(false) });
    await assert.rejects(restricted.unsafe("INSERT INTO public.execution_attempts DEFAULT VALUES"), permissionDenied);
    await assert.rejects(restricted.unsafe("UPDATE public.execution_attempts SET disposition = 'failed' WHERE attempt_id = $1", [attemptId]), permissionDenied);
    await assert.rejects(restricted.unsafe("DELETE FROM public.execution_attempts WHERE attempt_id = $1", [attemptId]), permissionDenied);
    await assert.rejects(restricted.unsafe("INSERT INTO public.runtime_sessions DEFAULT VALUES"), permissionDenied);
    await assert.rejects(restricted.unsafe("UPDATE public.runtime_sessions SET state = 'released' WHERE session_id = $1", [sessionId]), permissionDenied);
    await assert.rejects(restricted.unsafe("DELETE FROM public.runtime_sessions WHERE session_id = $1", [sessionId]), permissionDenied);

    stage = "exact-sql-read-only-snapshot";
    await restricted.begin("isolation level repeatable read read only", async (tx) => {
      await tx`SET LOCAL statement_timeout = '5s'`;
      await tx`SET LOCAL lock_timeout = '1s'`;
      const attempts = await tx.unsafe(attemptsSql, [root]);
      const sessions = await tx.unsafe(sessionsSql, [root]);
      if (attempts.length !== 1 || sessions.length !== 1) throw new Error("TASK6A_PRIVATE_RECEIPT_CARDINALITY_INVALID");
      assert.deepEqual(attempts[0], {
        runId, claimId: String(claimId), attemptId, generation: 1,
        fenceToken, worktreeRoot: root, sourceSha, sourceTreeHash,
        disposition: "claimed",
      });
      assert.deepEqual(sessions[0], {
        runId, claimId: String(claimId), attemptId, sessionId,
        ownerInstanceId: "private-owner", worktreeRoot: root, state: "reserved",
      });
      const absentAttempts = await tx.unsafe(attemptsSql, [alternateRoot]);
      const absentSessions = await tx.unsafe(sessionsSql, [alternateRoot]);
      assert.equal(absentAttempts.length, 0);
      assert.equal(absentSessions.length, 0);
    });

    stage = "duplicate-root-seed";
    const duplicateRunId = `${runId}-duplicate`;
    const duplicateClaimId = claimId + 1;
    const duplicateAttemptId = `ATT_${randomBytes(8).toString("hex")}`;
    const duplicateSessionId = `RTS_${randomBytes(8).toString("hex")}`;
    await database.sql`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
      VALUES (${duplicateRunId}, 999992, 'workflow', 'duplicate root receipt probe', 'running', '{}')`;
    await database.sql`INSERT INTO public.claim_log (id, run_id, step_id, agent_id)
      VALUES (${duplicateClaimId}, ${duplicateRunId}, 'step', 'agent')`;
    await database.sql`INSERT INTO public.execution_attempts (
      attempt_id, run_id, step_id, generation, fence_token, attempt_class,
      compilation_report_hash, source_before_sha, source_before_tree_hash,
      role, lease_acquired_at, lease_expires_at, heartbeat_at, disposition,
      claim_id, worktree
    ) VALUES (
      ${duplicateAttemptId}, ${duplicateRunId}, 'step', 1,
      ${randomBytes(32).toString("hex")}, 'evidence_only', 'private-report',
      ${sourceSha}, ${sourceTreeHash}, 'implementer',
      NOW(), NOW() + INTERVAL '1 hour', NOW(), 'claimed', ${duplicateClaimId}, ${root}
    )`;
    await database.sql`INSERT INTO public.runtime_sessions (
      session_id, run_id, step_db_id, workflow_step_id, claim_id, attempt_id,
      claim_agent_id, runtime_agent_id, runtime_kind, state, owner_instance_id,
      heartbeat_at, worktree
    ) VALUES (
      ${duplicateSessionId}, ${duplicateRunId}, 'step-db', 'step',
      ${duplicateClaimId}, ${duplicateAttemptId}, 'agent', 'agent',
      'external_session', 'reserved', 'private-owner', NOW(), ${root}
    )`;
    stage = "duplicate-root-read-only-snapshot";
    await restricted.begin("isolation level repeatable read read only", async (tx) => {
      assert.equal((await tx.unsafe(attemptsSql, [root])).length, 2);
      assert.equal((await tx.unsafe(sessionsSql, [root])).length, 2);
    });

    stage = "terminal-attempt-update";
    await database.sql`UPDATE public.execution_attempts SET disposition = 'failed' WHERE attempt_id = ${attemptId}`;
    stage = "terminal-session-update";
    await database.sql`UPDATE public.runtime_sessions
      SET state = 'released', drained_at = NOW(), released_at = NOW()
      WHERE session_id = ${sessionId}`;
    stage = "terminal-read-only-snapshot";
    await restricted.begin("isolation level repeatable read read only", async (tx) => {
      assert.equal((await tx.unsafe(attemptsSql, [root])).length, 1);
      assert.equal((await tx.unsafe(sessionsSql, [root])).length, 1);
    });
    stage = "all-terminal-updates";
    await database.sql`UPDATE public.execution_attempts SET disposition = 'failed'
      WHERE attempt_id = ${duplicateAttemptId}`;
    await database.sql`UPDATE public.runtime_sessions
      SET state = 'released', drained_at = NOW(), released_at = NOW()
      WHERE session_id = ${duplicateSessionId}`;
    stage = "all-terminal-read-only-snapshot";
    await restricted.begin("isolation level repeatable read read only", async (tx) => {
      assert.equal((await tx.unsafe(attemptsSql, [root])).length, 0);
      assert.equal((await tx.unsafe(sessionsSql, [root])).length, 0);
    });
    stage = "other-terminal-variants";
    await database.sql`UPDATE public.execution_attempts SET disposition = 'verified'
      WHERE attempt_id = ${attemptId}`;
    await database.sql`UPDATE public.execution_attempts SET disposition = 'superseded'
      WHERE attempt_id = ${duplicateAttemptId}`;
    await database.sql`UPDATE public.runtime_sessions
      SET state = 'quarantined', diagnostic = 'private receipt SQL probe'
      WHERE session_id = ${duplicateSessionId}`;
    stage = "other-terminal-read-only-snapshot";
    await restricted.begin("isolation level repeatable read read only", async (tx) => {
      assert.equal((await tx.unsafe(attemptsSql, [root])).length, 0);
      assert.equal((await tx.unsafe(sessionsSql, [root])).length, 0);
    });
  } catch {
    testFailure = new Error(`TASK6A_PRIVATE_RECEIPT_SQL_FAILED:${stage}`);
    process.stderr.write(`[task6a-private-receipt-sql] failed at ${stage}\n`);
    throw testFailure;
  } finally {
    const cleanupFailures: string[] = [];
    try { await restricted?.end({ timeout: 5 }); } catch { cleanupFailures.push("restricted_connection"); }
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try { if (roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${role}"`); }
    catch { cleanupFailures.push("restricted_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_RECEIPT_SQL_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (testFailure !== undefined) {
        throw new AggregateError([testFailure, cleanupError], "TASK6A_PRIVATE_RECEIPT_SQL_TEST_AND_CLEANUP_FAILED");
      }
      throw cleanupError;
    }
  }
});
