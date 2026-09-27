import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { derivePositiveWorktreeBindingReceiptCandidateV1 } from
  "../../src/internal-production/baseline-positive-worktree-binding-contract-v1.js";
import { appendPrivateDiagnosticPrecreateReservationV1,
  PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-precreate-reservation-contract-v1.js";
import { appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1,
  PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-receipt-journal-contract-v1.js";
import { appendPrivateDiagnosticReservationReceiptLinkV1,
  PRIVATE_POSITIVE_WORKTREE_RESERVATION_RECEIPT_LINK_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-reservation-receipt-link-contract-v1.js";
import { PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-recovery-precreate-reservation-contract-v1.js";
import { observePrivatePendingPositiveWorktreeReservationsV1 } from
  "../../src/internal-production/baseline-positive-worktree-private-pending-reservation-census-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;
const REFUSED = /TASK6A_PRIVATE_RESERVATION_RECEIPT_LINK_REFUSED/;
const LINK = "public.internal_production_positive_worktree_reservation_receipt_links_v1";

test("private reservation–receipt link correlates an exact V3 story claim without admitting an owner", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  requireTask6aPrivateLoopbackHostname(parsed);
  assert.notEqual(parsed.port, "5432");
  const admin = postgres(adminUrl, { max: 1 });
  let database: TestDatabase | undefined;
  let failure: unknown;
  let stage = "private-cluster-preflight";
  try {
    const identity = await admin<Array<{ data_directory: string; port: string;
      socket_directories: string; server_version_num: number }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket_directories,
        current_setting('server_version_num')::integer AS server_version_num`;
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
    for (const statement of PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RESERVATION_RECEIPT_LINK_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }

    const suffix = randomBytes(6).toString("hex");
    const runId = `task6a-link-${suffix}`;
    const stepDbId = `step-${suffix}`;
    const storyDbId = `story-${suffix}`;
    const storyId = "story-1";
    const claimId = 999990;
    const attemptId = `ATT_${randomBytes(8).toString("hex")}`;
    const sessionId = `RTS_${randomBytes(8).toString("hex")}`;
    const ownerInstanceId = `owner-${suffix}`;
    const root = `/tmp/projects/${suffix}/.worktrees/story-1`;
    const sourceSha = "a".repeat(40), sourceTreeHash = "b".repeat(40);
    const fenceToken = randomBytes(32).toString("hex");
    const reservationInput = { runId, storyDbId, storyId,
      dispatchKey: `ordinary-${suffix}`, ownerInstanceId, root, sourceSha, sourceTreeHash };
    stage = "seed-reservation";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`INSERT INTO public.runs (
      id, run_number, workflow_id, task, status, context, protocol,
      compiler_release_sha, activation_preflight_hash, release_admission_hash
    ) VALUES (${runId}, 999990, 'workflow', 'private link probe', 'running', '{}',
      'v3', ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash})`;
    await database.sql`INSERT INTO public.steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects, status
    ) VALUES (${stepDbId}, ${runId}, 'implement', 'agent', 1, '', '', 'running')`;
    await database.sql`INSERT INTO public.stories (
      id, run_id, story_index, story_id, title, claim_generation
    ) VALUES (${storyDbId}, ${runId}, 1, ${storyId}, 'private link probe', 1)`;
    const reservation = await appendPrivateDiagnosticPrecreateReservationV1(database.sql, reservationInput);
    assert.equal(fs.existsSync(root), false);
    const crossedStoryDbId = `other-story-${suffix}`;
    await database.sql`INSERT INTO public.stories (
      id, run_id, story_index, story_id, title, claim_generation
    ) VALUES (${crossedStoryDbId}, ${runId}, 2, 'story-2', 'other story', 1)`;
    const crossedReservation = await appendPrivateDiagnosticPrecreateReservationV1(
      database.sql, { ...reservationInput, storyDbId: crossedStoryDbId,
        storyId: "story-2", dispatchKey: `other-${suffix}`,
        root: `/tmp/projects/${suffix}/.worktrees/story-2` });
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql,
      { reservationHash: reservation.reservationHash, receiptHash: "f".repeat(64) }), REFUSED);

    stage = "seed-active-receipt";
    await database.sql`UPDATE public.stories SET status = 'running' WHERE id = ${storyDbId}`;
    await database.sql`INSERT INTO public.claim_log (id, run_id, step_id, story_id, agent_id)
      VALUES (${claimId}, ${runId}, 'implement', ${storyId}, 'agent')`;
    await database.sql`INSERT INTO public.execution_attempts (
      attempt_id, run_id, step_id, story_id, agent_id, generation, fence_token,
      attempt_class, compilation_report_hash, source_before_sha, source_before_tree_hash,
      role, lease_acquired_at, lease_expires_at, heartbeat_at, disposition,
      claim_id, worktree
    ) VALUES (
      ${attemptId}, ${runId}, 'implement', ${storyId}, 'agent', 1, ${fenceToken},
      'evidence_only', 'private-report', ${sourceSha}, ${sourceTreeHash},
      'implementer', NOW(), NOW() + INTERVAL '1 hour', NOW(), 'claimed',
      ${claimId}, ${root}
    )`;
    await database.sql`INSERT INTO public.runtime_sessions (
      session_id, run_id, step_db_id, workflow_step_id, claim_id, attempt_id,
      claim_agent_id, runtime_agent_id, runtime_kind, state, owner_instance_id,
      heartbeat_at, worktree
    ) VALUES (
      ${sessionId}, ${runId}, ${stepDbId}, 'implement', ${claimId}, ${attemptId},
      'agent', 'agent', 'external_session', 'reserved', ${ownerInstanceId}, NOW(), ${root}
    )`;
    const attempt = { runId, claimId: String(claimId), attemptId, generation: 1,
      fenceToken, worktreeRoot: root, sourceSha, sourceTreeHash, disposition: "claimed" };
    const session = { runId, claimId: String(claimId), attemptId, sessionId,
      ownerInstanceId, worktreeRoot: root, state: "reserved" };
    const physical = { root, dev: "11", ino: "22", birthtimeNs: "33",
      gitPrimaryRoot: `/tmp/projects/${suffix}` };
    const receipt = derivePositiveWorktreeBindingReceiptCandidateV1({ attempt, session, physical }).receipt;
    await appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql,
      { attempt, session, physical, receipt });

    stage = "missing-v3-story-binding-refusal";
    const hashes = { reservationHash: reservation.reservationHash, receiptHash: receipt.receiptHash };
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes), REFUSED);
    await database.sql`UPDATE public.runtime_sessions
      SET story_db_id = ${storyDbId}, story_id = ${storyId}
      WHERE session_id = ${sessionId}`;
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes), REFUSED);
    await database.sql`INSERT INTO public.v3_story_claim_runtime_bindings_v1 (
      claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
      subject_kind, story_db_id, story_id, story_index, story_claim_generation,
      story_admission_receipt_hash, story_admission_subject_hash, bound_at
    ) SELECT ${claimId}, ${sessionId}, ${runId}, ${stepDbId}, 'implement',
      'story_member', ${storyDbId}, ${storyId}, 1, 1,
      ${"c".repeat(64)}, ${"d".repeat(64)}, c.claimed_at
      FROM public.claim_log c WHERE c.id = ${claimId}`;

    stage = "crossed-refusal";
    for (const crossed of [
      { ...hashes, reservationHash: "f".repeat(64) },
      { ...hashes, receiptHash: "e".repeat(64) },
      { ...hashes, reservationHash: crossedReservation.reservationHash },
      { ...hashes, runId },
    ]) await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, crossed), REFUSED);
    const empty = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${LINK}`);
    assert.equal(empty[0]?.count, 0);

    stage = "rollback-before-commit";
    await database.sql.unsafe(`CREATE FUNCTION public.task6a_private_link_crash_probe_v1()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'TASK6A_PRIVATE_LINK_ROLLBACK_PROBE';
      END $$`);
    await database.sql.unsafe(`CREATE TRIGGER task6a_private_link_crash_probe_v1
      AFTER INSERT ON ${LINK} FOR EACH ROW
      EXECUTE FUNCTION public.task6a_private_link_crash_probe_v1()`);
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes), REFUSED);
    await database.sql.unsafe(`DROP TRIGGER task6a_private_link_crash_probe_v1 ON ${LINK}`);
    await database.sql.unsafe(`DROP FUNCTION public.task6a_private_link_crash_probe_v1()`);
    const rolledBack = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${LINK}`);
    assert.equal(rolledBack[0]?.count, 0);

    stage = "insert-identical-retry-and-immutability";
    const first = await appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes);
    assert.equal(first.authority, "diagnostic-only");
    assert.equal(first.disposition, "inserted");
    assert.match(first.linkHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(await appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes),
      { ...first, disposition: "identical-retry" });
    const linked = await database.sql.unsafe<Array<{ count: number; storyDbId: string;
      claimId: string; canonicalBody: string }>>(`SELECT count(*) OVER ()::integer AS count,
      story_db_id AS "storyDbId", claim_id::text AS "claimId",
      canonical_body AS "canonicalBody" FROM ${LINK}`);
    assert.equal(linked.length, 1);
    assert.equal(linked[0]?.count, 1);
    assert.equal(linked[0]?.storyDbId, storyDbId);
    assert.equal(linked[0]?.claimId, String(claimId));
    assert.equal(linked[0]?.canonicalBody.includes(fenceToken), false);
    const pending = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM public.internal_production_positive_worktree_precreate_reservations_v1`);
    assert.equal(pending[0]?.count, 2, "a link does not settle either pending reservation");
    const census = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
    assert.equal(census.disposition, "pending");
    assert.deepEqual(census.counts, { ordinary: 2, recovery: 0, total: 2 },
      "the linked ordinary reservation remains unresolved in the both-table census");
    await assert.rejects(database.sql.unsafe(`UPDATE ${LINK} SET root = root`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    await assert.rejects(database.sql.unsafe(`DELETE FROM ${LINK}`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    await assert.rejects(database.sql.unsafe(`TRUNCATE ${LINK}`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");

    stage = "stale-active-binding-refusal";
    await database.sql`UPDATE public.claim_log SET outcome = 'completed' WHERE id = ${claimId}`;
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes), REFUSED);
    await database.sql`UPDATE public.claim_log SET outcome = NULL WHERE id = ${claimId}`;
    await database.sql`UPDATE public.execution_attempts
      SET fence_token = ${randomBytes(32).toString("hex")} WHERE attempt_id = ${attemptId}`;
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes), REFUSED);
    await database.sql`UPDATE public.execution_attempts
      SET fence_token = ${fenceToken}, source_before_sha = ${"f".repeat(40)}
      WHERE attempt_id = ${attemptId}`;
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes), REFUSED);
    await database.sql`UPDATE public.execution_attempts
      SET source_before_sha = ${sourceSha}, generation = 2 WHERE attempt_id = ${attemptId}`;
    await assert.rejects(appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes), REFUSED);
    await database.sql`UPDATE public.execution_attempts
      SET generation = 1 WHERE attempt_id = ${attemptId}`;
    assert.equal((await appendPrivateDiagnosticReservationReceiptLinkV1(database.sql, hashes)).disposition,
      "identical-retry");
    const stable = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${LINK}`);
    assert.equal(stable[0]?.count, 1);
  } catch (error) {
    failure = error;
    process.stderr.write(`[task6a-private-reservation-receipt-link] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_LINK_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError], "TASK6A_PRIVATE_LINK_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
});
