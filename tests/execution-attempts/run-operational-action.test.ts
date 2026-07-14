import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executeRunOperationalAction,
  RunOperationalActionError,
} from "../../src/execution/run-operational-action.js";
import { buildRunOperationalSnapshot } from "../../src/server/run-operational-snapshot.js";
import { createIsolatedTestDatabase } from "./test-database.js";

async function seedLegacyRun(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{
    runId: string;
    status: "running" | "failed" | "cancelled";
    loop?: boolean;
  }>,
): Promise<void> {
  await database.sql.unsafe(
    `INSERT INTO runs (
       id, workflow_id, task, status, context, meta, protocol, protocol_version
     ) VALUES ($1, 'feature-dev', 'operational action test', $2, $3, $4, 'legacy', 1)`,
    [
      input.runId,
      input.status,
      JSON.stringify({ branch: "main", previous_failure: "remove-me" }),
      JSON.stringify({ terminal_failure: input.status !== "running", durable: "keep-me" }),
    ],
  );
  const terminal = input.status === "running" ? ["running", "waiting", "waiting"] : ["done", "failed", "failed"];
  await database.sql.unsafe(
    `INSERT INTO steps (
       id, run_id, step_id, agent_id, step_index, input_template, expects,
       status, output, retry_count, abandoned_count, type, loop_config
     ) VALUES
       ($1, $4, 'plan', 'planner', 0, '', '', $5, NULL, 0, 0, 'single', NULL),
       ($2, $4, 'implement', 'developer', 1, '', '', $6, 'failure', 2, 1, $8, $9),
       ($3, $4, 'verify', 'reviewer', 2, '', '', $7, 'downstream', 1, 1, 'single', NULL)`,
    [
      `STEP_${input.runId}_plan`,
      `STEP_${input.runId}_implement`,
      `STEP_${input.runId}_verify`,
      input.runId,
      terminal[0],
      terminal[1],
      terminal[2],
      input.loop ? "loop" : "single",
      input.loop ? JSON.stringify({ verifyEach: false }) : null,
    ],
  );
  if (input.loop) {
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status, retry_count,
         claimed_by, claimed_at, pr_url
       ) VALUES
         ($1, $4, 0, 'US-001', 'Reset me', 'failed', 2, 'old-agent', NOW() - interval '1 hour', NULL),
         ($2, $4, 1, 'US-002', 'PR-backed', 'skipped', 2, NULL, NULL, 'https://example.test/pr/2'),
         ($3, $4, 2, 'US-003', 'Done', 'done', 0, NULL, NULL, NULL)`,
      [
        `STORY_${input.runId}_1`,
        `STORY_${input.runId}_2`,
        `STORY_${input.runId}_3`,
        input.runId,
      ],
    );
  }
}

async function snapshotHash(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
): Promise<string> {
  const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
  assert.ok(snapshot);
  return snapshot.snapshotHash;
}

describe("Setfarm-owned operational action CAS", () => {
  it("atomically resumes the exact legacy plan and emits one state-keyed outbox event", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_action-resume-0001";
      await seedLegacyRun(database, { runId, status: "failed", loop: true });
      const expectedSnapshotHash = await snapshotHash(database, runId);
      const result = await executeRunOperationalAction(database.sql, {
        action: "resume",
        runId,
        expectedSnapshotHash,
        now: new Date("2026-07-13T15:00:00.000Z"),
      });
      assert.equal(result.action, "resume");
      if (result.action !== "resume") return;
      assert.equal(result.expectedSnapshotHash, expectedSnapshotHash);
      assert.match(result.actionStateHash, /^[a-f0-9]{64}$/);
      assert.match(result.planHash, /^[a-f0-9]{64}$/);

      const run = await database.sql<Array<{ status: string; context: string; meta: string }>>`
        SELECT status, context, meta FROM runs WHERE id = ${runId}
      `;
      assert.equal(run[0]?.status, "running");
      assert.deepEqual(JSON.parse(run[0]!.context), { branch: "main" });
      assert.deepEqual(JSON.parse(run[0]!.meta), { durable: "keep-me" });

      const steps = await database.sql<Array<{
        step_id: string;
        status: string;
        retry_count: number;
        abandoned_count: number;
      }>>`
        SELECT step_id, status, retry_count, abandoned_count
          FROM steps WHERE run_id = ${runId} ORDER BY step_index
      `;
      assert.deepEqual(steps.map((row) => ({ ...row })), [
        { step_id: "plan", status: "done", retry_count: 0, abandoned_count: 0 },
        { step_id: "implement", status: "pending", retry_count: 0, abandoned_count: 0 },
        { step_id: "verify", status: "waiting", retry_count: 0, abandoned_count: 0 },
      ]);
      const stories = await database.sql<Array<{ story_id: string; status: string; pr_url: string | null }>>`
        SELECT story_id, status, pr_url FROM stories WHERE run_id = ${runId} ORDER BY story_index
      `;
      assert.deepEqual(stories.map((row) => ({ ...row })), [
        { story_id: "US-001", status: "pending", pr_url: null },
        { story_id: "US-002", status: "skipped", pr_url: "https://example.test/pr/2" },
        { story_id: "US-003", status: "done", pr_url: null },
      ]);
      const events = await database.sql<Array<{ outbox_id: string; event_key: string; event_type: string; payload: unknown }>>`
        SELECT outbox_id, event_key, event_type, payload
          FROM operational_outbox WHERE aggregate_type = 'run' AND aggregate_id = ${runId}
      `;
      assert.equal(events.length, 1);
      assert.equal(events[0]?.outbox_id, result.outboxId);
      assert.equal(events[0]?.event_key, result.eventKey);
      assert.equal(events[0]?.event_type, "run.resumed");
      assert.equal((events[0]?.payload as Record<string, unknown>).requestedBy, "setfarm.workflow.resume");
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a changed hidden source against the previously displayed snapshot with zero action writes", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_action-stale-0001";
      await seedLegacyRun(database, { runId, status: "failed", loop: true });
      const expectedSnapshotHash = await snapshotHash(database, runId);
      await database.sql`UPDATE runs SET context = '{"branch":"changed"}' WHERE id = ${runId}`;
      assert.notEqual(await snapshotHash(database, runId), expectedSnapshotHash);
      await assert.rejects(
        () => executeRunOperationalAction(database.sql, { action: "resume", runId, expectedSnapshotHash }),
        (error: unknown) => error instanceof RunOperationalActionError
          && error.operationalCode === "RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT",
      );
      const state = await database.sql<Array<{ status: string; outbox_count: number }>>`
        SELECT status,
               (SELECT COUNT(*)::integer FROM operational_outbox WHERE aggregate_id = ${runId}) AS outbox_count
          FROM runs WHERE id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "failed", outbox_count: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("requests durable stop with the exact snapshot/action hashes in canonical evidence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_action-stop-0001";
      await seedLegacyRun(database, { runId, status: "running" });
      const expectedSnapshotHash = await snapshotHash(database, runId);
      const result = await executeRunOperationalAction(database.sql, {
        action: "stop",
        runId,
        expectedSnapshotHash,
        now: new Date("2026-07-13T15:10:00.000Z"),
      });
      assert.equal(result.action, "stop");
      if (result.action !== "stop") return;
      assert.equal(result.terminationRequest.requestedBy, "setfarm.workflow.stop");
      assert.deepEqual(result.terminationRequest.evidence, {
        schema: "setfarm.run-operational-action-stop.v1",
        expectedSnapshotHash,
        actionStateHash: result.actionStateHash,
      });
      const run = await database.sql<Array<{ status: string }>>`SELECT status FROM runs WHERE id = ${runId}`;
      assert.equal(run[0]?.status, "cancelling");
    } finally {
      await database.cleanup();
    }
  });

  it("allows only one concurrent writer for the same displayed snapshot", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_action-concurrent-0001";
      await seedLegacyRun(database, { runId, status: "failed", loop: true });
      const expectedSnapshotHash = await snapshotHash(database, runId);
      const settled = await Promise.allSettled([
        executeRunOperationalAction(database.sql, { action: "resume", runId, expectedSnapshotHash }),
        executeRunOperationalAction(database.sql, { action: "resume", runId, expectedSnapshotHash }),
      ]);
      assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
      const rejection = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
      assert.ok(rejection);
      assert.ok(rejection.reason instanceof RunOperationalActionError);
      assert.ok([
        "RUN_OPERATIONAL_ACTION_CONFLICT",
        "RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT",
      ].includes(rejection.reason.operationalCode));
      const rows = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM operational_outbox
         WHERE aggregate_type = 'run' AND aggregate_id = ${runId} AND event_type = 'run.resumed'
      `;
      assert.equal(rows[0]?.count, 1);
    } finally {
      await database.cleanup();
    }
  });

  it("allows only one concurrent stop and keeps one durable termination owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_action-stop-race-0001";
      await seedLegacyRun(database, { runId, status: "running" });
      const expectedSnapshotHash = await snapshotHash(database, runId);
      const settled = await Promise.allSettled([
        executeRunOperationalAction(database.sql, { action: "stop", runId, expectedSnapshotHash }),
        executeRunOperationalAction(database.sql, { action: "stop", runId, expectedSnapshotHash }),
      ]);
      assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
      const rejection = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
      assert.ok(rejection);
      assert.ok(rejection.reason instanceof RunOperationalActionError);
      assert.ok([
        "RUN_OPERATIONAL_ACTION_CONFLICT",
        "RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT",
      ].includes(rejection.reason.operationalCode));
      const rows = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM run_termination_requests WHERE run_id = ${runId}
      `;
      assert.equal(rows[0]?.count, 1);
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back the stop status transition if durable termination insertion fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_action-stop-rollback-0001";
      await seedLegacyRun(database, { runId, status: "running" });
      const expectedSnapshotHash = await snapshotHash(database, runId);
      await database.sql.unsafe(`
        CREATE FUNCTION reject_action_termination() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'injected termination failure'; END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER trg_reject_action_termination BEFORE INSERT ON run_termination_requests
        FOR EACH ROW EXECUTE FUNCTION reject_action_termination()
      `);
      await assert.rejects(
        () => executeRunOperationalAction(database.sql, { action: "stop", runId, expectedSnapshotHash }),
        /injected termination failure/,
      );
      const rows = await database.sql<Array<{ status: string; request_count: number }>>`
        SELECT status,
               (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS request_count
          FROM runs WHERE id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, { status: "running", request_count: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back every resume row when canonical outbox publication fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_action-rollback-0001";
      await seedLegacyRun(database, { runId, status: "failed", loop: true });
      const expectedSnapshotHash = await snapshotHash(database, runId);
      await database.sql.unsafe(`
        CREATE FUNCTION reject_action_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.event_type = 'run.resumed' THEN RAISE EXCEPTION 'injected outbox failure'; END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER trg_reject_action_outbox BEFORE INSERT ON operational_outbox
        FOR EACH ROW EXECUTE FUNCTION reject_action_outbox()
      `);
      await assert.rejects(
        () => executeRunOperationalAction(database.sql, { action: "resume", runId, expectedSnapshotHash }),
        /injected outbox failure/,
      );
      const run = await database.sql<Array<{ status: string; context: string }>>`
        SELECT status, context FROM runs WHERE id = ${runId}
      `;
      assert.equal(run[0]?.status, "failed");
      assert.equal(JSON.parse(run[0]!.context).previous_failure, "remove-me");
      const steps = await database.sql<Array<{ status: string }>>`
        SELECT status FROM steps WHERE run_id = ${runId} AND step_id = 'implement'
      `;
      assert.equal(steps[0]?.status, "failed");
      const events = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM operational_outbox WHERE aggregate_id = ${runId}
      `;
      assert.equal(events[0]?.count, 0);
    } finally {
      await database.cleanup();
    }
  });

  it("maps serialization conflict without automatic retry and rejects invalid expected hashes before DB access", async () => {
    let beginCalls = 0;
    const fakeSql = {
      begin: async () => {
        beginCalls += 1;
        throw Object.assign(new Error("serialization"), { code: "40001" });
      },
    } as unknown as Parameters<typeof executeRunOperationalAction>[0];
    await assert.rejects(
      () => executeRunOperationalAction(fakeSql, {
        action: "resume",
        runId: "RUN_conflict",
        expectedSnapshotHash: "a".repeat(64),
      }),
      (error: unknown) => error instanceof RunOperationalActionError
        && error.operationalCode === "RUN_OPERATIONAL_ACTION_CONFLICT",
    );
    assert.equal(beginCalls, 1);
    await assert.rejects(
      () => executeRunOperationalAction(fakeSql, {
        action: "resume",
        runId: "RUN_conflict",
        expectedSnapshotHash: "not-a-hash",
      }),
      /RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_INVALID/,
    );
    assert.equal(beginCalls, 1);
  });
});
