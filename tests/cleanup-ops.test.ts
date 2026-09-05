import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { cleanupAbandonedSteps, cleanupProjectEphemera } from "../src/installer/cleanup-ops.js";
import { captureShadowSourceRevision } from "../src/execution/shadow-attempt-recorder.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
  publishLoopClaimRuntime,
} from "../src/execution/claim-runtime-publication.js";
import { createIsolatedTestDatabase } from "./execution-attempts/test-database.js";

const root = process.cwd();
const ownerBackedIt = fs.existsSync(path.join(root, ".setfarm-p3-projection-marker.json"))
  ? it
  : it.skip;

async function seedLegacyCleanupLoop(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  suffix = "owner",
) {
  const stepDbId = `${runId}-${suffix}-step`;
  const storyDbId = `${runId}-${suffix}-story`;
  await database.sql`
    INSERT INTO runs (id,workflow_id,task,status,protocol)
    VALUES (${runId},'feature-dev','cleanup atomicity','running','legacy')
  `;
  await database.sql`
    INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,current_story_id,updated_at)
    VALUES (${stepDbId},${runId},'implement','feature-dev_developer',1,'','','running','loop',${storyDbId},NOW()-INTERVAL '2 hours')
  `;
  await database.sql`
    INSERT INTO stories (id,run_id,story_index,story_id,title,status,claim_generation,claimed_by,claimed_at,updated_at)
    VALUES (${storyDbId},${runId},1,'US-001','Cleanup story','running',1,'feature-dev_developer',NOW()-INTERVAL '2 hours',NOW()-INTERVAL '2 hours')
  `;
  const claimId = await database.sql.begin(async (sql) => {
    const rows = await sql<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(sql as any, "a-claim-loop-runtime-v1", rows);
    return insertAndBindInternalProductionClaimBirthV1(sql as any, birth, {
      runId, workflowStepId: "implement", storyId: "US-001",
      claimAgentId: "feature-dev_developer", claimedAt: new Date(Date.now() - 7_200_000),
    });
  });
  return { stepDbId, storyDbId, claimId };
}

async function seedLegacyCleanupSingle(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
) {
  const stepDbId = `${runId}-plan-step`;
  await database.sql`
    INSERT INTO runs (id,workflow_id,task,status,protocol)
    VALUES (${runId},'feature-dev','cleanup terminal single','running','legacy')
  `;
  await database.sql`
    INSERT INTO steps (
      id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,
      abandoned_count,retry_count,max_retries,updated_at
    ) VALUES (
      ${stepDbId},${runId},'plan','feature-dev_planner',1,'','','running','single',
      4,13,20,NOW()-INTERVAL '2 hours'
    )
  `;
  const claimId = await database.sql.begin(async (sql) => {
    const rows = await sql<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(sql as any, "a-claim-single-runtime-v1", rows);
    return insertAndBindInternalProductionClaimBirthV1(sql as any, birth, {
      runId, workflowStepId: "plan", storyId: null,
      claimAgentId: "feature-dev_planner", claimedAt: new Date(Date.now() - 7_200_000),
    });
  });
  return { stepDbId, claimId };
}

describe("project cleanup operations", () => {
  it("stabilizes the exact source fingerprint only when cleanup runs before acceptance", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-pre-acceptance-cleanup-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
      execFileSync("git", ["config", "user.email", "setfarm-test@example.invalid"], { cwd: repo });
      fs.writeFileSync(path.join(repo, "package.json"), '{"name":"cleanup-source-test"}\n');
      execFileSync("git", ["add", "package.json"], { cwd: repo });
      execFileSync("git", ["commit", "-qm", "fixture"], { cwd: repo });
      fs.writeFileSync(path.join(repo, "QA_REPORT.md"), "transient QA output\n");

      const before = await captureShadowSourceRevision(repo);
      await cleanupProjectEphemera(
        "run-pre-acceptance-cleanup",
        "pre-acceptance:test",
        { repo },
      );
      const acceptedSource = await captureShadowSourceRevision(repo);
      await cleanupProjectEphemera(
        "run-pre-acceptance-cleanup",
        "post-cleanup-idempotency:test",
        { repo },
      );
      const replaySource = await captureShadowSourceRevision(repo);

      assert.notEqual(before.treeHash, acceptedSource.treeHash, "transient untracked QA output participates in source identity");
      assert.deepEqual(replaySource, acceptedSource, "the source is stable only after cleanup has completed");
      assert.equal(fs.existsSync(path.join(repo, "QA_REPORT.md")), false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("can resolve scoped project tool cwd on macOS without systemd cgroups", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "cleanup-ops.ts"), "utf-8");
    assert.match(source, /function readDarwinProcessCwd\(pid: number\): string \| undefined/);
    assert.match(source, /execFileSync\("lsof",\s*\["-a",\s*"-d",\s*"cwd",\s*"-p",\s*String\(pid\),\s*"-Fn"\]/);
    assert.match(source, /function processCwd\(row: ProcessRow\): string \| undefined/);
    assert.match(source, /process\.platform !== "darwin"/);
    assert.match(source, /if \(row\.cgroup && !isSetfarmOwnedProcess\(row\)\) return false;/);
    assert.match(source, /if \(parent\.cgroup && !isSetfarmOwnedProcess\(parent\)\) break;/);
  });

  it("uses story claimed_at before abandoning a running loop story", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "cleanup-ops.ts"), "utf-8");
    const loopStoryStart = source.indexOf('if (step.type === "loop" && step.current_story_id)');
    const singleStepStart = source.indexOf("// Single steps", loopStoryStart);
    assert.notEqual(loopStoryStart, -1, "loop story cleanup block not found");
    assert.notEqual(singleStepStart, -1, "single step cleanup marker not found");

    const block = source.slice(loopStoryStart, singleStepStart);
    const claimedAt = block.indexOf("const claimedAt = story.claimed_at || step.updated_at");
    const elapsed = block.indexOf("const storyElapsedMs = Date.now() - new Date(claimedAt as string).getTime()");
    const thresholdSkip = block.indexOf("if (storyElapsedMs < threshold) continue");
    const autosave = block.indexOf("autoSaveWorktree");
    const abandon = block.indexOf("terminalizeAbandonedCleanupInTransaction");

    assert.ok(claimedAt >= 0, "story claimed_at fallback must be computed");
    assert.ok(elapsed > claimedAt, "story elapsed must be based on story claimed_at");
    assert.ok(thresholdSkip > elapsed, "fresh story claims must skip abandonment");
    assert.ok(thresholdSkip < autosave, "fresh story claims must not be auto-saved as abandoned");
    assert.ok(thresholdSkip < abandon, "fresh story claims must not be reset to pending");
    assert.match(block, /const durationMin = Math\.round\(storyElapsedMs \/ 60000\)/);
  });

  it("closes each locked abandoned claim through authenticated owner authority", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "cleanup-ops.ts"), "utf-8");
    const helper = source.slice(
      source.indexOf("async function terminalizeAbandonedCleanupInTransaction"),
      source.indexOf("const PROJECT_ARTIFACT_PATHS"),
    );
    assert.match(helper, /ORDER BY id FOR UPDATE/);
    assert.match(helper, /WHERE id=\$1::bigint AND outcome IS NULL RETURNING id::text AS id/);
    assert.match(helper, /closeInternalProductionClaimOwnerAfterTerminalMutationV1\(sql, closed\[0\]!\.id\)/);
    assert.doesNotMatch(source, /WHERE story_id = \$4 AND outcome IS NULL/);
  });

  ownerBackedIt("requests canonical run failure after terminal cleanup without incrementing retry counts", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const runId = "run-cleanup-terminal-story";
      const { stepDbId, storyDbId } = await seedLegacyCleanupLoop(database, runId);
      await database.sql`UPDATE steps SET abandoned_count=4,retry_count=11 WHERE id=${stepDbId}`;
      await database.sql`UPDATE stories SET abandoned_count=4,retry_count=7 WHERE id=${storyDbId}`;

      await cleanupAbandonedSteps(async () => ({ advanced: false, runCompleted: false }));

      const rows = await database.sql<Array<{
        run_status: string;
        step_status: string;
        step_retry_count: number;
        story_status: string;
        story_retry_count: number;
        target_status: string;
        request_state: string;
        requested_by: string;
      }>>`
        SELECT r.status AS run_status,s.status AS step_status,s.retry_count AS step_retry_count,
               st.status AS story_status,st.retry_count AS story_retry_count,
               request.target_status,request.state AS request_state,request.requested_by
          FROM runs r
          JOIN steps s ON s.id=${stepDbId}
          JOIN stories st ON st.id=${storyDbId}
          JOIN run_termination_requests request ON request.run_id=r.id
         WHERE r.id=${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "failing",
        step_status: "failed",
        step_retry_count: 11,
        story_status: "failed",
        story_retry_count: 7,
        target_status: "failed",
        request_state: "requested",
        requested_by: "setfarm.installer.fail-run",
      });
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  ownerBackedIt("preserves terminal single retry_count and delegates run failure to failRun", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const runId = "run-cleanup-terminal-single";
      const { stepDbId } = await seedLegacyCleanupSingle(database, runId);

      await cleanupAbandonedSteps(async () => ({ advanced: false, runCompleted: false }));

      const rows = await database.sql<Array<{
        run_status: string;
        step_status: string;
        retry_count: number;
        requested_by: string;
      }>>`
        SELECT r.status AS run_status,s.status AS step_status,s.retry_count,request.requested_by
          FROM runs r
          JOIN steps s ON s.id=${stepDbId}
          JOIN run_termination_requests request ON request.run_id=r.id
         WHERE r.id=${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "failing",
        step_status: "failed",
        retry_count: 13,
        requested_by: "setfarm.installer.fail-run",
      });
      const source = fs.readFileSync(path.join(root, "src", "installer", "cleanup-ops.ts"), "utf-8");
      const helper = source.slice(
        source.indexOf("async function terminalizeAbandonedCleanupInTransaction"),
        source.indexOf("const PROJECT_ARTIFACT_PATHS"),
      );
      assert.doesNotMatch(helper, /UPDATE runs SET status='failed'/);
      assert.match(source, /await failRun\(step\.run_id/);
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  ownerBackedIt("rolls back the cleanup state reset when the exact owner close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { stepDbId, storyDbId, claimId } = await seedLegacyCleanupLoop(database, "run-cleanup-close-rollback");
      await database.sql.unsafe(`
        CREATE FUNCTION reject_cleanup_owner_close_v1() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.category='claim' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_CLEANUP_OWNER_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_cleanup_owner_close_v1 BEFORE UPDATE OF state
        ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_cleanup_owner_close_v1()
      `);
      await assert.rejects(cleanupAbandonedSteps(async () => ({ advanced: false, runCompleted: false })), /TEST_CLEANUP_OWNER_CLOSE_REJECTED/);
      const rows = await database.sql<Array<{ step_status: string; story_status: string; outcome: string | null; owner_state: string }>>`
        SELECT s.status AS step_status,st.status AS story_status,cl.outcome,r.state AS owner_state
          FROM steps s JOIN stories st ON st.id=${storyDbId}
          JOIN claim_log cl ON cl.id=${claimId}
          JOIN internal_production_owner_reservations_v1 r
            ON r.category='claim' AND r.owner_key=cl.id::text
         WHERE s.id=${stepDbId}
      `;
      assert.deepEqual({ ...rows[0] }, { step_status: "running", story_status: "running", outcome: null, owner_state: "bound" });
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  ownerBackedIt("terminalizes the exact abandoned-story fallback owner before exposing pending", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { stepDbId, storyDbId, claimId } = await seedLegacyCleanupLoop(
        database,
        "run-cleanup-story-fallback-close",
      );
      await database.sql`
        UPDATE steps SET updated_at=NOW(), current_story_id=NULL WHERE id=${stepDbId}
      `;
      await database.sql.unsafe(`
        CREATE FUNCTION reject_cleanup_fallback_close_v1() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.category='claim' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_CLEANUP_FALLBACK_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_cleanup_fallback_close_v1 BEFORE UPDATE OF state
        ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_cleanup_fallback_close_v1()
      `);
      await assert.rejects(
        cleanupAbandonedSteps(async () => ({ advanced: false, runCompleted: false })),
        /TEST_CLEANUP_FALLBACK_CLOSE_REJECTED/,
      );
      const rows = await database.sql<Array<{
        story_status: string;
        outcome: string | null;
        owner_state: string;
      }>>`
        SELECT story.status AS story_status, claim.outcome, owner.state AS owner_state
          FROM stories story
          JOIN claim_log claim ON claim.id=${claimId}
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='claim' AND owner.owner_key=claim.id::text
         WHERE story.id=${storyDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        story_status: "running",
        outcome: null,
        owner_state: "bound",
      });
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  ownerBackedIt("serializes cleanup before a successor claim and never cross-closes it", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../src/db-pg.js");
    const blocker = postgres(database.url, { max: 1 });
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const runId = "run-cleanup-successor-race";
      const { stepDbId, storyDbId, claimId } = await seedLegacyCleanupLoop(database, runId);
      let release!: () => void;
      const releaseBlock = new Promise<void>((resolve) => { release = resolve; });
      let blocking!: () => void;
      const blockerReady = new Promise<void>((resolve) => { blocking = resolve; });
      const held = blocker.begin(async (sql) => {
        await sql.unsafe("LOCK TABLE claim_log IN ACCESS EXCLUSIVE MODE");
        blocking();
        await releaseBlock;
      });
      await blockerReady;
      const cleanup = cleanupAbandonedSteps(async () => ({ advanced: false, runCompleted: false }));
      for (;;) {
        try {
          await database.sql.unsafe("SELECT id FROM steps WHERE id=$1 FOR UPDATE NOWAIT", [stepDbId]);
          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch (error) {
          if (/lock|available/i.test(String(error))) break;
          throw error;
        }
      }
      const successor = publishLoopClaimRuntime(database.sql, {
        runId, stepDbId, workflowStepId: "implement", storyDbId, storyId: "US-001",
        claimAgentId: "feature-dev_developer", parallelLimit: 1,
      });
      release();
      await held;
      await cleanup;
      const next = await successor;
      assert.ok(next && next.claimId !== claimId);
      const claims = await database.sql<Array<{ id: number; outcome: string | null }>>`
        SELECT id::integer AS id,outcome FROM claim_log WHERE run_id=${runId} ORDER BY id
      `;
      assert.deepEqual(claims.map((row) => ({ ...row })), [
        { id: claimId, outcome: "abandoned" },
        { id: next!.claimId, outcome: null },
      ]);
    } finally {
      await blocker.end({ timeout: 5 });
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  ownerBackedIt("serializes abandoned-story fallback cleanup before successor publication", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../src/db-pg.js");
    const blocker = postgres(database.url, { max: 1 });
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const runId = "run-cleanup-fallback-successor-race";
      const { stepDbId, storyDbId, claimId } = await seedLegacyCleanupLoop(database, runId);
      await database.sql`
        UPDATE steps SET updated_at=NOW(),current_story_id=NULL WHERE id=${stepDbId}
      `;
      let release!: () => void;
      const releaseBlock = new Promise<void>((resolve) => { release = resolve; });
      let blocking!: () => void;
      const blockerReady = new Promise<void>((resolve) => { blocking = resolve; });
      const held = blocker.begin(async (sql) => {
        await sql.unsafe("LOCK TABLE claim_log IN ACCESS EXCLUSIVE MODE");
        blocking();
        await releaseBlock;
      });
      await blockerReady;
      const cleanup = cleanupAbandonedSteps(async () => ({ advanced: false, runCompleted: false }));
      for (;;) {
        try {
          await database.sql.unsafe("SELECT id FROM stories WHERE id=$1 FOR UPDATE NOWAIT", [storyDbId]);
          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch (error) {
          if (/lock|available/i.test(String(error))) break;
          throw error;
        }
      }
      const successor = publishLoopClaimRuntime(database.sql, {
        runId, stepDbId, workflowStepId: "implement", storyDbId, storyId: "US-001",
        claimAgentId: "feature-dev_developer", parallelLimit: 1,
      });
      release();
      await held;
      await cleanup;
      const next = await successor;
      assert.ok(next && next.claimId !== claimId);
      const claims = await database.sql<Array<{ id: number; outcome: string | null }>>`
        SELECT id::integer AS id,outcome FROM claim_log WHERE run_id=${runId} ORDER BY id
      `;
      assert.deepEqual(claims.map((row) => ({ ...row })), [
        { id: claimId, outcome: "abandoned" },
        { id: next!.claimId, outcome: null },
      ]);
    } finally {
      await blocker.end({ timeout: 5 });
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });
});
