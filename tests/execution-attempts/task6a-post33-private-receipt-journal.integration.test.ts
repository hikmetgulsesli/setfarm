import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { derivePositiveWorktreeBindingReceiptCandidateV1 } from
  "../../src/internal-production/baseline-positive-worktree-binding-contract-v1.js";
import { appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1,
  PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-receipt-journal-contract-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;
const REFUSED = /TASK6A_POST33_PRIVATE_RECEIPT_JOURNAL_REFUSED/;

test("private post-33 receipt journal is insert-once and bound to active claim, attempt, session and fence", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  const privateHostname = requireTask6aPrivateLoopbackHostname(parsed);
  assert.notEqual(parsed.port, "5432");
  const admin = postgres(adminUrl, { max: 1 });
  let database: TestDatabase | undefined;
  let restricted: ReturnType<typeof postgres> | undefined;
  const suffix = randomBytes(6).toString("hex");
  const role = `task6a_journal_reader_${suffix}`;
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

    stage = "isolated-post33-schema";
    database = await createIsolatedTestDatabase();
    const maximum = await database.sql<Array<{ version: number }>>`
      SELECT max(version)::integer AS version FROM public.setfarm_schema_migrations`;
    assert.equal(maximum[0]?.version, 33);
    stage = "journal-statements";
    assert.ok(PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS.length >= 4);
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    const journal = "public.internal_production_positive_worktree_receipt_journal_v1";
    const sourceSha = "a".repeat(40), sourceTreeHash = "b".repeat(40);
    const fenceToken = randomBytes(32).toString("hex");
    const root = `/tmp/projects/${suffix}/.worktrees/story-1`;
    const runId = `task6a-journal-${suffix}`;
    const claimId = 999991;
    const attemptId = `ATT_${randomBytes(8).toString("hex")}`;
    const sessionId = `RTS_${randomBytes(8).toString("hex")}`;
    const ownerInstanceId = `owner-${suffix}`;
    stage = "seed-linked-active-rows";
    await database.sql`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
      VALUES (${runId}, 999991, 'workflow', 'private receipt journal probe', 'running', '{}')`;
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
      'agent', 'agent', 'external_session', 'reserved', ${ownerInstanceId}, NOW(), ${root}
    )`;
    const attempt = { runId, claimId: String(claimId), attemptId, generation: 1,
      fenceToken, worktreeRoot: root, sourceSha, sourceTreeHash, disposition: "claimed" };
    const session = { runId, claimId: String(claimId), attemptId, sessionId,
      ownerInstanceId, worktreeRoot: root, state: "reserved" };
    const physical = { root, dev: "11", ino: "22", birthtimeNs: "33",
      gitPrimaryRoot: `/tmp/projects/${suffix}` };
    const receipt = derivePositiveWorktreeBindingReceiptCandidateV1({ attempt, session, physical }).receipt;
    const input = { attempt, session, physical, receipt };

    stage = "closed-claim-refusal";
    await database.sql`UPDATE public.claim_log SET outcome = 'completed' WHERE id = ${claimId}`;
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql, input), REFUSED);
    const closedClaimRows = await database.sql<Array<{ count: number }>>`
      SELECT count(*)::integer AS count
      FROM public.internal_production_positive_worktree_receipt_journal_v1`;
    assert.equal(closedClaimRows[0]?.count, 0);
    await database.sql`UPDATE public.claim_log SET outcome = NULL WHERE id = ${claimId}`;
    await database.sql`UPDATE public.claim_log SET abandoned_at = NOW() WHERE id = ${claimId}`;
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql, input), REFUSED);
    await database.sql`UPDATE public.claim_log SET abandoned_at = NULL WHERE id = ${claimId}`;

    stage = "rollback-before-commit";
    const defaultIsolation = await database.sql<Array<{ isolation: string }>>`
      SELECT current_setting('default_transaction_isolation') AS isolation`;
    assert.equal(defaultIsolation[0]?.isolation, "read committed");
    await database.sql.unsafe(`CREATE FUNCTION public.task6a_private_receipt_crash_probe_v1()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'TASK6A_PRIVATE_ROLLBACK_PROBE';
      END $$`);
    await database.sql.unsafe(`CREATE TRIGGER task6a_private_receipt_crash_probe_v1
      AFTER INSERT ON ${journal} FOR EACH ROW
      EXECUTE FUNCTION public.task6a_private_receipt_crash_probe_v1()`);
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql, input), REFUSED);
    await database.sql.unsafe(`DROP TRIGGER task6a_private_receipt_crash_probe_v1 ON ${journal}`);
    await database.sql.unsafe(`DROP FUNCTION public.task6a_private_receipt_crash_probe_v1()`);
    const beforeCommit = await database.sql<Array<{ count: number }>>`
      SELECT count(*)::integer AS count
      FROM public.internal_production_positive_worktree_receipt_journal_v1`;
    assert.equal(beforeCommit[0]?.count, 0);

    stage = "insert-and-identical-retry";
    const first = await appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql, input);
    assert.deepEqual(first, { schema: "setfarm.internal-production-positive-worktree-private-journal-append.v1",
      authority: "diagnostic-only", disposition: "inserted", receiptHash: receipt.receiptHash });
    const second = await appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql, input);
    assert.deepEqual(second, { ...first, disposition: "identical-retry" });
    const rows = await database.sql<Array<{ receipt_hash: string; canonical_body: string;
      physical_identity_hash: string; fence_token_hash: string }>>`
      SELECT receipt_hash, canonical_body, physical_identity_hash, fence_token_hash
      FROM public.internal_production_positive_worktree_receipt_journal_v1`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.receipt_hash, receipt.receiptHash);
    assert.equal(rows[0]?.physical_identity_hash, receipt.physicalIdentityHash);
    assert.equal(rows[0]?.fence_token_hash, receipt.fenceTokenHash);
    assert.equal(rows[0]?.canonical_body.includes(fenceToken), false);

    stage = "conflict-and-drift-refusal";
    const changedPhysical = { ...physical, ino: "23" };
    const changedReceipt = derivePositiveWorktreeBindingReceiptCandidateV1({
      attempt, session, physical: changedPhysical }).receipt;
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql,
      { attempt, session, physical: changedPhysical, receipt: changedReceipt }), REFUSED);
    const changedGeneration = { ...attempt, generation: 2 };
    const changedGenerationReceipt = derivePositiveWorktreeBindingReceiptCandidateV1({
      attempt: changedGeneration, session, physical }).receipt;
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql,
      { attempt: changedGeneration, session, physical, receipt: changedGenerationReceipt }), REFUSED);
    const changedSource = { ...attempt, sourceSha: "c".repeat(40) };
    const changedSourceReceipt = derivePositiveWorktreeBindingReceiptCandidateV1({
      attempt: changedSource, session, physical }).receipt;
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql,
      { attempt: changedSource, session, physical, receipt: changedSourceReceipt }), REFUSED);
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql,
      { ...input, session: { ...session, claimId: String(claimId + 1) } }), REFUSED);
    await database.sql`UPDATE public.execution_attempts SET fence_token = ${randomBytes(32).toString("hex")}
      WHERE attempt_id = ${attemptId}`;
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql, input), REFUSED);
    await database.sql`UPDATE public.execution_attempts SET fence_token = ${fenceToken}, disposition = 'failed'
      WHERE attempt_id = ${attemptId}`;
    await assert.rejects(appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql, input), REFUSED);
    const stable = await database.sql`
      SELECT count(*)::integer AS count
      FROM public.internal_production_positive_worktree_receipt_journal_v1`;
    assert.equal(stable[0]?.count, 1);

    stage = "nonowner-immutability";
    const ownerRows = await database.sql<Array<{ owner: string }>>`SELECT current_user AS owner`;
    const owner = ownerRows[0]?.owner;
    assert.match(owner ?? "", /^[a-z_][a-z0-9_]{0,62}$/);
    const existingRole = await admin<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM pg_catalog.pg_roles WHERE rolname = ${role}`;
    assert.equal(existingRole[0]?.count, "0");
    roleCreated = true;
    await admin.unsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT, UPDATE, DELETE, TRUNCATE ON ${journal} TO "${role}"`);
    const restrictedUrl = new URL(database.url);
    restrictedUrl.username = role;
    restrictedUrl.password = password;
    restrictedUrl.hostname = privateHostname;
    restrictedUrl.port = parsed.port;
    restricted = postgres(restrictedUrl.toString(), { max: 1, connect_timeout: 5 });
    const rights = await restricted<Array<{ superuser: boolean; ownerMember: boolean;
      insert: boolean; update: boolean; delete: boolean; truncate: boolean }>>`
      SELECT r.rolsuper AS superuser,
        pg_catalog.pg_has_role(session_user, o.oid, 'MEMBER') AS "ownerMember",
        has_table_privilege(current_user, ${journal}, 'INSERT') AS insert,
        has_table_privilege(current_user, ${journal}, 'UPDATE') AS update,
        has_table_privilege(current_user, ${journal}, 'DELETE') AS delete,
        has_table_privilege(current_user, ${journal}, 'TRUNCATE') AS truncate
      FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_roles o
      WHERE r.rolname = session_user AND o.rolname = ${owner}`;
    assert.deepEqual(rights[0], { superuser: false, ownerMember: false,
      insert: false, update: true, delete: true, truncate: true });
    const immutableRefusal = (error: unknown) => error !== null && typeof error === "object"
      && "code" in error && error.code === "42501"
      && "message" in error && typeof error.message === "string"
      && error.message.includes("TASK6A_POST33_PRIVATE_RECEIPT_JOURNAL_IMMUTABLE");
    await assert.rejects(restricted.unsafe(`UPDATE ${journal} SET root = root WHERE receipt_hash = $1`,
      [receipt.receiptHash]), immutableRefusal);
    await assert.rejects(restricted.unsafe(`DELETE FROM ${journal} WHERE receipt_hash = $1`,
      [receipt.receiptHash]), immutableRefusal);
    await assert.rejects(restricted.unsafe(`TRUNCATE ${journal}`), immutableRefusal);
    await assert.rejects(restricted.unsafe(`INSERT INTO ${journal} DEFAULT VALUES`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
  } catch {
    testFailure = new Error(`TASK6A_POST33_PRIVATE_RECEIPT_JOURNAL_TEST_FAILED:${stage}`);
    process.stderr.write(`[task6a-post33-private-receipt-journal] failed at ${stage}\n`);
    throw testFailure;
  } finally {
    const cleanupFailures: string[] = [];
    try { await restricted?.end({ timeout: 5 }); } catch { cleanupFailures.push("restricted_connection"); }
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try { if (roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${role}"`); }
    catch { cleanupFailures.push("restricted_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_POST33_PRIVATE_RECEIPT_JOURNAL_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (testFailure !== undefined) {
        throw new AggregateError([testFailure, cleanupError], "TASK6A_POST33_PRIVATE_RECEIPT_JOURNAL_TEST_AND_CLEANUP_FAILED");
      }
      throw cleanupError;
    }
  }
});
