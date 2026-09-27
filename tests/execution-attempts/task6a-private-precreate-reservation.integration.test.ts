import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import {
  appendPrivateDiagnosticPrecreateReservationV1,
  PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS,
} from "../../src/internal-production/baseline-positive-worktree-precreate-reservation-contract-v1.js";
import { PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-recovery-precreate-reservation-contract-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;
const REFUSED = /TASK6A_PRIVATE_PRECREATE_RESERVATION_REFUSED/;
const TABLE = "public.internal_production_positive_worktree_precreate_reservations_v1";

test("private pre-create reservation persists immutably while the physical target remains absent", {
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
  let stage = "private-cluster-preflight";
  let failure: unknown;
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
    assert.ok(PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS.length >= 4);
    for (const statement of PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }

    const suffix = randomBytes(6).toString("hex");
    const runId = `task6a-precreate-${suffix}`;
    const storyDbId = `story-${suffix}`;
    const root = `/tmp/projects/${suffix}/.worktrees/story-1`;
    const input = {
      runId, storyDbId, storyId: "story-1", dispatchKey: `ordinary-${suffix}`,
      ownerInstanceId: `owner-${suffix}`, root,
      sourceSha: "a".repeat(40), sourceTreeHash: "b".repeat(40),
    };
    stage = "seed-run-and-story";
    await database.sql`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
      VALUES (${runId}, 999992, 'workflow', 'private precreate probe', 'running', '{}')`;
    await database.sql`INSERT INTO public.stories (id, run_id, story_index, story_id, title)
      VALUES (${storyDbId}, ${runId}, 1, 'story-1', 'private precreate probe')`;

    stage = "invalid-and-crossed-input";
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
      { ...input, root: "relative/story-1" }), REFUSED);
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
      { ...input, root: process.cwd() }), REFUSED);
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
      { ...input, storyId: "other-story" }), REFUSED);
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
      { ...input, surprise: "ambient-authority" }), REFUSED);
    const before = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(before[0]?.count, 0);

    stage = "rollback-before-commit";
    await database.sql.unsafe(`CREATE FUNCTION public.task6a_private_precreate_crash_probe_v1()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'TASK6A_PRIVATE_PRECREATE_ROLLBACK_PROBE';
      END $$`);
    await database.sql.unsafe(`CREATE TRIGGER task6a_private_precreate_crash_probe_v1
      AFTER INSERT ON ${TABLE} FOR EACH ROW
      EXECUTE FUNCTION public.task6a_private_precreate_crash_probe_v1()`);
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql, input), REFUSED);
    await database.sql.unsafe(`DROP TRIGGER task6a_private_precreate_crash_probe_v1 ON ${TABLE}`);
    await database.sql.unsafe(`DROP FUNCTION public.task6a_private_precreate_crash_probe_v1()`);
    const rolledBack = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(rolledBack[0]?.count, 0);

    stage = "insert-and-identical-retry";
    const first = await appendPrivateDiagnosticPrecreateReservationV1(database.sql, input);
    assert.deepEqual(first, {
      schema: "setfarm.internal-production-positive-worktree-private-precreate-reservation.v1",
      authority: "diagnostic-only", disposition: "inserted",
      reservationHash: first.reservationHash,
    });
    assert.match(first.reservationHash, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(root), false);
    const retry = await appendPrivateDiagnosticPrecreateReservationV1(database.sql, input);
    assert.deepEqual(retry, { ...first, disposition: "identical-retry" });
    const pending = await database.sql.unsafe<Array<{ count: number; root: string;
      owner: string; source: string }>>(`SELECT count(*) OVER ()::integer AS count,
      root, owner_instance_id AS owner, source_sha AS source FROM ${TABLE}`);
    assert.deepEqual(Array.from(pending), [{ count: 1, root, owner: input.ownerInstanceId,
      source: input.sourceSha }]);
    await assert.rejects(database.sql`UPDATE public.stories SET story_id = 'crossed-story'
      WHERE id = ${storyDbId}`, (error: unknown) => error !== null
        && typeof error === "object" && "code" in error && error.code === "23503");

    stage = "conflict-and-drift-refusal";
    for (const drift of [
      { ownerInstanceId: "other-owner" },
      { sourceSha: "c".repeat(40) },
      { sourceTreeHash: "d".repeat(40) },
      { root: `/tmp/projects/${suffix}/.worktrees/story-2` },
      { dispatchKey: `other-dispatch-${suffix}` },
      { dispatchKey: `other-dispatch-${suffix}`,
        root: `/tmp/projects/${suffix}/.worktrees/story-2` },
    ]) {
      await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
        { ...input, ...drift }), REFUSED);
    }
    const stable = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(stable[0]?.count, 1);

    stage = "duplicate-logical-story-refusal";
    const failedStoryDbId = `failed-story-${suffix}`;
    await database.sql`INSERT INTO public.stories (
      id, run_id, story_index, story_id, title, status)
      VALUES (${failedStoryDbId}, ${runId}, 2, 'story-1',
        'separate failed row with the same logical story ID', 'failed')`;
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
      { ...input, storyDbId: failedStoryDbId,
        dispatchKey: `failed-${suffix}`,
        root: `/tmp/projects/${suffix}/.worktrees/failed-story-1` }), REFUSED);
    const afterDuplicate = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(afterDuplicate[0]?.count, 1);

    stage = "terminal-run-and-immutability";
    await database.sql`UPDATE public.stories SET status = 'completed' WHERE id = ${storyDbId}`;
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
      { ...input, dispatchKey: `new-story-${suffix}`, root: `/tmp/projects/${suffix}/new-story` }), REFUSED);
    await database.sql`UPDATE public.stories SET status = 'pending' WHERE id = ${storyDbId}`;
    await database.sql`UPDATE public.runs SET status = 'completed' WHERE id = ${runId}`;
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql,
      { ...input, dispatchKey: `new-${suffix}`, root: `/tmp/projects/${suffix}/new` }), REFUSED);
    await assert.rejects(database.sql.unsafe(`UPDATE ${TABLE} SET root = root`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    await assert.rejects(database.sql.unsafe(`DELETE FROM ${TABLE}`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    await assert.rejects(database.sql.unsafe(`TRUNCATE ${TABLE}`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    const after = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(after[0]?.count, 1);
  } catch (error) {
    failure = error;
    process.stderr.write(`[task6a-private-precreate-reservation] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_PRECREATE_RESERVATION_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError], "TASK6A_PRIVATE_PRECREATE_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
});
