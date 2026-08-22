import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import postgres from "postgres";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
  publishLoopClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const root = path.resolve(import.meta.dirname, "../..");
const stepOps = readFileSync(path.join(root, "src/installer/step-ops.ts"), "utf8");
const stepFail = readFileSync(path.join(root, "src/installer/step-fail.ts"), "utf8");
const cleanupOps = readFileSync(path.join(root, "src/installer/cleanup-ops.ts"), "utf8");
const medic = readFileSync(path.join(root, "src/medic/medic.ts"), "utf8");
const recorder = readFileSync(path.join(root, "src/execution/shadow-attempt-recorder.ts"), "utf8");
const transition = readFileSync(path.join(root, "src/execution/claim-attempt-transition.ts"), "utf8");
const claimPublication = readFileSync(path.join(root, "src/execution/claim-runtime-publication.ts"), "utf8");
const runtimeSessions = readFileSync(path.join(root, "src/execution/runtime-session-repository.ts"), "utf8");
const downstreamPublication = readFileSync(path.join(root, "src/recovery/v3-downstream-evidence-publication.ts"), "utf8");
const evidenceOnlyPublication = readFileSync(path.join(root, "src/recovery/v3-evidence-only-publication.ts"), "utf8");

async function seedLegacyMedicLoop(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  options: Readonly<{ claimWorkflowStepId?: string; omitClaim?: boolean }> = {},
) {
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  await database.sql`
    INSERT INTO runs (id,workflow_id,task,status,protocol,assigned_developer)
    VALUES (${runId},'feature-dev','medic atomicity','running','legacy','prism')
  `;
  await database.sql`
    INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,current_story_id)
    VALUES (${stepDbId},${runId},'implement','feature-dev_developer',1,'','','running','loop',${storyDbId})
  `;
  await database.sql`
    INSERT INTO stories (id,run_id,story_index,story_id,title,status,claim_generation,claimed_by,claimed_at)
    VALUES (${storyDbId},${runId},1,'US-001','Medic story','running',1,'feature-dev_developer',NOW()-INTERVAL '2 hours')
  `;
  const claimId = options.omitClaim
    ? null
    : await database.sql.begin(async (sql) => {
        const rows = await sql<Array<{ id: unknown }>>`
          SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
        `;
        const birth = await prepareInternalProductionClaimBirthV1(sql as any, "a-claim-loop-runtime-v1", rows);
        return insertAndBindInternalProductionClaimBirthV1(sql as any, birth, {
          runId, workflowStepId: options.claimWorkflowStepId ?? "implement", storyId: "US-001",
          claimAgentId: "feature-dev_developer", claimedAt: new Date(Date.now() - 7_200_000),
        });
      });
  return { stepDbId, storyDbId, claimId };
}

async function seedLegacySingleOwners(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  claimedAt: Date,
) {
  await database.sql`
    INSERT INTO runs (id,workflow_id,task,status,protocol)
    VALUES (${runId},'feature-dev','legacy terminal mapping','running','legacy')
  `;
  const owners = [];
  for (const [ordinal, workflowStepId, status] of [[1, "plan", "running"], [2, "stories", "pending"]] as const) {
    const stepDbId = `${runId}-${workflowStepId}-step`;
    await database.sql`
      INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,retry_count,max_retries)
      VALUES (${stepDbId},${runId},${workflowStepId},'feature-dev_planner',${ordinal},'','',${status},0,3)
    `;
    const claimId = await database.sql.begin(async (sql) => {
      const rows = await sql<Array<{ id: unknown }>>`
        SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
      `;
      const birth = await prepareInternalProductionClaimBirthV1(sql as any, "a-claim-single-runtime-v1", rows);
      return insertAndBindInternalProductionClaimBirthV1(sql as any, birth, {
        runId, workflowStepId, storyId: null,
        claimAgentId: "feature-dev_planner", claimedAt: workflowStepId === "plan" ? claimedAt : new Date(),
      });
    });
    owners.push({ stepDbId, workflowStepId, claimId });
  }
  return { target: owners[0]!, adjacent: owners[1]! };
}

type LegacyCompletionPath = "story" | "single" | "supervise" | "verify";

async function seedLegacyCompletionPath(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  pathKind: LegacyCompletionPath,
) {
  await database.sql`
    INSERT INTO runs (id,workflow_id,task,status,protocol)
    VALUES (${runId},'feature-dev','legacy completion path rollback','running','legacy')
  `;
  const storyDbId = `${runId}-story`;
  if (pathKind !== "single") {
    await database.sql`
      INSERT INTO stories (id,run_id,story_index,story_id,title,status,claim_generation)
      VALUES (${storyDbId},${runId},1,'US-001','Completion rollback story',${pathKind === "story" ? "running" : "done"},1)
    `;
  }
  const targetStepId = pathKind === "story"
    ? "implement"
    : pathKind === "single"
      ? "mapped-single"
      : pathKind;
  const targetStepDbId = `${runId}-${targetStepId}-step`;
  if (pathKind === "story") {
    await database.sql`
      INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,current_story_id,loop_config)
      VALUES (${targetStepDbId},${runId},'implement','feature-dev_developer',1,'','','running','loop',${storyDbId},'{}')
    `;
  } else if (pathKind === "single") {
    await database.sql`
      INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
      VALUES (${targetStepDbId},${runId},${targetStepId},'feature-dev_planner',1,'','','running','single')
    `;
  } else {
    const loopConfig = JSON.stringify({
      verifyEach: true,
      verifyStep: "verify",
      superviseEach: true,
      superviseStep: "supervise",
    });
    await database.sql`
      INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,loop_config)
      VALUES (${`${runId}-implement-step`},${runId},'implement','feature-dev_developer',1,'','','running','loop',${loopConfig})
    `;
    if (pathKind === "supervise") {
      await database.sql`
        INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
        VALUES (${targetStepDbId},${runId},'supervise','feature-dev_supervisor',2,'','','running','single')
      `;
      await database.sql`
        INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
        VALUES (${`${runId}-verify-step`},${runId},'verify','feature-dev_qa',3,'','','waiting','single')
      `;
    } else {
      await database.sql`
        INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
        VALUES (${`${runId}-supervise-step`},${runId},'supervise','feature-dev_supervisor',2,'','','waiting','single')
      `;
      await database.sql`
        INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
        VALUES (${targetStepDbId},${runId},'verify','feature-dev_qa',3,'','','running','single')
      `;
    }
  }
  const claimId = await database.sql.begin(async (sql) => {
    const rows = await sql<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(sql as any, "a-claim-single-runtime-v1", rows);
    return insertAndBindInternalProductionClaimBirthV1(sql as any, birth, {
      runId,
      workflowStepId: targetStepId,
      storyId: pathKind === "story" ? "US-001" : null,
      claimAgentId: pathKind === "story"
        ? "feature-dev_developer"
        : pathKind === "supervise"
          ? "feature-dev_supervisor"
          : pathKind === "verify"
            ? "feature-dev_qa"
            : "feature-dev_planner",
      claimedAt: new Date(),
    });
  });
  return { targetStepDbId, storyDbId, claimId };
}

async function installRejectClaimCloseTrigger(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, name: string) {
  await database.sql.unsafe(`
    CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.category='claim' AND NEW.state='closed' THEN RAISE EXCEPTION 'TEST_MAPPED_CLAIM_CLOSE_REJECTED'; END IF;
      RETURN NEW;
    END $$
  `);
  await database.sql.unsafe(`
    CREATE TRIGGER ${name} BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ${name}()
  `);
}

async function dropRejectClaimCloseTrigger(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, name: string) {
  await database.sql.unsafe(`DROP TRIGGER ${name} ON internal_production_owner_reservations_v1`);
  await database.sql.unsafe(`DROP FUNCTION ${name}()`);
}

async function installRejectClaimCloseAfterProductMutation(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  name: string,
  pathKind: LegacyCompletionPath,
) {
  const productPredicate = pathKind === "story"
    ? `EXISTS (
         SELECT 1 FROM claim_log claim
         JOIN stories story ON story.run_id=claim.run_id AND story.story_id=claim.story_id
          WHERE claim.id::text=NEW.owner_key AND story.status<>'running'
       )`
    : `EXISTS (
         SELECT 1 FROM claim_log claim
         JOIN steps step ON step.run_id=claim.run_id AND step.step_id=claim.step_id
          WHERE claim.id::text=NEW.owner_key
            AND step.status='${pathKind === "single" ? "done" : "waiting"}'
       )`;
  await database.sql.unsafe(`
    CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.category='claim' AND NEW.state='closed' AND ${productPredicate} THEN
        RAISE EXCEPTION 'TEST_MAPPED_CLAIM_CLOSE_REJECTED';
      END IF;
      RETURN NEW;
    END $$
  `);
  await database.sql.unsafe(`
    CREATE TRIGGER ${name} BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ${name}()
  `);
}

describe("shadow runtime hook boundaries", () => {
  it("rolls back medic story reset when the exact claim owner close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { remediateMedicFinding } = await import("../../src/medic/medic.js");
      const runId = "run-medic-close-rollback";
      const { stepDbId, storyDbId, claimId } = await seedLegacyMedicLoop(database, runId);
      await database.sql.unsafe(`
        CREATE FUNCTION reject_medic_owner_close_v1() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.category='claim' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_MEDIC_OWNER_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_medic_owner_close_v1 BEFORE UPDATE OF state
        ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_medic_owner_close_v1()
      `);
      await assert.rejects(remediateMedicFinding({
        check: "orphaned_story", severity: "warning", message: "orphaned",
        action: "reset_story", runId, storyId: storyDbId, remediated: false,
      }), /TEST_MEDIC_OWNER_CLOSE_REJECTED/);
      const rows = await database.sql<Array<{ step_status: string; current_story_id: string | null; story_status: string; outcome: string | null; owner_state: string }>>`
        SELECT s.status AS step_status,s.current_story_id,st.status AS story_status,cl.outcome,r.state AS owner_state
          FROM steps s JOIN stories st ON st.id=${storyDbId}
          JOIN claim_log cl ON cl.id=${claimId}
          JOIN internal_production_owner_reservations_v1 r ON r.category='claim' AND r.owner_key=cl.id::text
         WHERE s.id=${stepDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "running", current_story_id: storyDbId,
        story_status: "running", outcome: null, owner_state: "bound",
      });
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("rolls back merged-PR medic completion when the exact owner close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    const fakeBin = mkdtempSync(path.join(os.tmpdir(), "setfarm-medic-gh-"));
    const priorPath = process.env.PATH;
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const ghPath = path.join(fakeBin, "gh");
      writeFileSync(
        ghPath,
        "#!/bin/sh\nprintf '%s\\n' '[{\"number\":7,\"url\":\"https://github.com/acme/repo/pull/7\",\"headRefName\":\"US-001\"}]'\n",
      );
      chmodSync(ghPath, 0o755);
      process.env.PATH = `${fakeBin}:${priorPath ?? ""}`;
      const { remediateMedicFinding } = await import("../../src/medic/medic.js");
      const runId = "run-medic-merged-pr-close";
      const { storyDbId, claimId } = await seedLegacyMedicLoop(database, runId);
      await database.sql`
        UPDATE runs SET task='Fix https://github.com/acme/repo' WHERE id=${runId}
      `;
      await installRejectClaimCloseTrigger(database, "reject_medic_merged_pr_close_v1");
      await assert.rejects(remediateMedicFinding({
        check: "orphaned_story", severity: "warning", message: "orphaned",
        action: "reset_story", runId, storyId: storyDbId, remediated: false,
      }), /TEST_MAPPED_CLAIM_CLOSE_REJECTED/);
      const rows = await database.sql<Array<{
        story_status: string;
        outcome: string | null;
        owner_state: string;
      }>>`
        SELECT story.status AS story_status,claim.outcome,owner.state AS owner_state
          FROM stories story
          JOIN claim_log claim ON claim.id=${claimId}
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='claim' AND owner.owner_key=claim.id::text
         WHERE story.id=${storyDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        story_status: "running", outcome: null, owner_state: "bound",
      });
    } finally {
      process.env.PATH = priorPath;
      rmSync(fakeBin, { recursive: true, force: true });
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("rolls terminal-run medic checks back when an exact claim close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { checkStalledRuns } = await import("../../src/medic/checks.js");
      const runId = "run-medic-stalled-run-close";
      const { target, adjacent } = await seedLegacySingleOwners(
        database,
        runId,
        new Date(Date.now() - 8 * 60 * 60 * 1_000),
      );
      await database.sql`
        UPDATE steps SET updated_at=NOW()-INTERVAL '8 hours' WHERE run_id=${runId}
      `;
      await installRejectClaimCloseTrigger(database, "reject_medic_terminal_run_close_v1");
      await assert.rejects(checkStalledRuns(), /TEST_MAPPED_CLAIM_CLOSE_REJECTED/);
      const rows = await database.sql<Array<{
        run_status: string;
        step_status: string;
        outcome: string | null;
        owner_state: string;
      }>>`
        SELECT run.status AS run_status,step.status AS step_status,
               claim.outcome,owner.state AS owner_state
          FROM claim_log claim
          JOIN runs run ON run.id=claim.run_id
          JOIN steps step ON step.run_id=run.id AND step.step_id=claim.step_id
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='claim' AND owner.owner_key=claim.id::text
         WHERE claim.id IN (${target.claimId},${adjacent.claimId})
         ORDER BY claim.id
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { run_status: "running", step_status: "running", outcome: null, owner_state: "bound" },
        { run_status: "running", step_status: "pending", outcome: null, owner_state: "bound" },
      ]);
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("rolls terminal-run orphan step healing back when an exact claim close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { checkOrphanedInTerminalRuns } = await import("../../src/medic/checks.js");
      const runId = "run-medic-orphan-step-close";
      const { target, adjacent } = await seedLegacySingleOwners(database, runId, new Date());
      await database.sql`UPDATE runs SET status='failed' WHERE id=${runId}`;
      await installRejectClaimCloseTrigger(database, "reject_medic_orphan_step_close_v1");
      await assert.rejects(checkOrphanedInTerminalRuns(), /TEST_MAPPED_CLAIM_CLOSE_REJECTED/);
      const rows = await database.sql<Array<{
        step_status: string;
        outcome: string | null;
        owner_state: string;
      }>>`
        SELECT step.status AS step_status,claim.outcome,owner.state AS owner_state
          FROM claim_log claim
          JOIN steps step ON step.run_id=claim.run_id AND step.step_id=claim.step_id
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='claim' AND owner.owner_key=claim.id::text
         WHERE claim.id IN (${target.claimId},${adjacent.claimId})
         ORDER BY claim.id
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { step_status: "running", outcome: null, owner_state: "bound" },
        { step_status: "pending", outcome: null, owner_state: "bound" },
      ]);
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("rolls terminal-run orphan story healing back when its exact claim close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { checkOrphanedInTerminalRuns } = await import("../../src/medic/checks.js");
      const runId = "run-medic-orphan-story-close";
      const { stepDbId, storyDbId, claimId } = await seedLegacyMedicLoop(database, runId);
      await database.sql`UPDATE runs SET status='failed' WHERE id=${runId}`;
      await database.sql`UPDATE steps SET status='done' WHERE id=${stepDbId}`;
      await installRejectClaimCloseTrigger(database, "reject_medic_orphan_story_close_v1");
      await assert.rejects(checkOrphanedInTerminalRuns(), /TEST_MAPPED_CLAIM_CLOSE_REJECTED/);
      const rows = await database.sql<Array<{
        story_status: string;
        outcome: string | null;
        owner_state: string;
      }>>`
        SELECT story.status AS story_status,claim.outcome,owner.state AS owner_state
          FROM stories story
          JOIN claim_log claim ON claim.id=${claimId}
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='claim' AND owner.owner_key=claim.id::text
         WHERE story.id=${storyDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        story_status: "running", outcome: null, owner_state: "bound",
      });
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("adopts the exact bound owner when a loop claim is already terminal", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { terminalizeLoopClaimAndState } = await import("../../src/installer/step-fail.js");
      const runId = "run-step-fail-terminal-owner-adoption";
      const { stepDbId, storyDbId, claimId } = await seedLegacyMedicLoop(database, runId);
      await database.sql`
        UPDATE claim_log SET outcome='failed',diagnostic='precommitted terminal fixture'
         WHERE id=${claimId}
      `;
      const terminalInput = {
        runId,
        stepDbId,
        stepId: "implement",
        storyId: "US-001",
        storyDbId,
        agentId: "feature-dev_developer",
        error: "precommitted terminal fixture",
        outcome: "failed",
        attemptDisposition: "failed",
        state: {
          storyStatus: "failed",
          storyOutput: "precommitted terminal fixture",
          clearStoryClaim: true,
          stepStatus: "failed",
          stepOutput: "precommitted terminal fixture",
        },
      } as const;
      await terminalizeLoopClaimAndState(terminalInput);
      await terminalizeLoopClaimAndState(terminalInput);
      const owner = await database.sql<Array<{ state: string }>>`
        SELECT state FROM internal_production_owner_reservations_v1
         WHERE category='claim' AND owner_key=${String(claimId)}
      `;
      assert.equal(owner[0]?.state, "closed");
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("rejects an already-terminal loop claim outside the canonical close domain", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { terminalizeLoopClaimAndState } = await import("../../src/installer/step-fail.js");
      const runId = "run-step-fail-terminal-owner-domain";
      const { stepDbId, storyDbId, claimId } = await seedLegacyMedicLoop(database, runId);
      await database.sql`
        UPDATE claim_log SET outcome='forged_terminal',diagnostic='invalid terminal fixture'
         WHERE id=${claimId}
      `;
      await assert.rejects(terminalizeLoopClaimAndState({
        runId,
        stepDbId,
        stepId: "implement",
        storyId: "US-001",
        storyDbId,
        agentId: "feature-dev_developer",
        error: "invalid terminal fixture",
        outcome: "failed",
        attemptDisposition: "failed",
        state: {
          storyStatus: "failed",
          storyOutput: "invalid terminal fixture",
          clearStoryClaim: true,
          stepStatus: "failed",
          stepOutput: "invalid terminal fixture",
        },
      }), /LOOP_CLAIM_TERMINAL_OUTCOME_INVALID/);
      assert.equal(
        (await database.sql<Array<{ state: string }>>`
          SELECT state FROM internal_production_owner_reservations_v1
           WHERE category='claim' AND owner_key=${String(claimId)}
        `)[0]?.state,
        "bound",
      );
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("serializes medic reset before successor publication without cross-close", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    const blocker = postgres(database.url, { max: 1 });
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { remediateMedicFinding } = await import("../../src/medic/medic.js");
      const runId = "run-medic-successor-race";
      const { stepDbId, storyDbId, claimId } = await seedLegacyMedicLoop(database, runId);
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
      const medicReset = remediateMedicFinding({
        check: "orphaned_story", severity: "warning", message: "orphaned",
        action: "reset_story", runId, storyId: storyDbId, remediated: false,
      });
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
      assert.equal(await medicReset, true);
      const next = await successor;
      assert.ok(next && next.claimId !== claimId);
      const claims = await database.sql<Array<{ id: number; outcome: string | null }>>`
        SELECT id::integer AS id,outcome FROM claim_log WHERE run_id=${runId} ORDER BY id
      `;
      assert.deepEqual(claims.map((row) => ({ ...row })), [
        { id: claimId, outcome: "infra_retry" },
        { id: next!.claimId, outcome: null },
      ]);
    } finally {
      await blocker.end({ timeout: 5 });
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("fails closed when medic has no exact workflow-step claim owner", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { remediateMedicFinding } = await import("../../src/medic/medic.js");
      const missingRunId = "run-medic-missing-step-owner";
      const missing = await seedLegacyMedicLoop(database, missingRunId, { omitClaim: true });
      await assert.rejects(remediateMedicFinding({
        check: "orphaned_story", severity: "warning", message: "orphaned",
        action: "reset_story", runId: missingRunId, storyId: missing.storyDbId, remediated: false,
      }), /MEDIC_CLAIM_OWNER_CARDINALITY_INVALID/);

      const wrongRunId = "run-medic-wrong-step-owner";
      const wrong = await seedLegacyMedicLoop(database, wrongRunId, { claimWorkflowStepId: "review" });
      await assert.rejects(remediateMedicFinding({
        check: "orphaned_story", severity: "warning", message: "orphaned",
        action: "reset_story", runId: wrongRunId, storyId: wrong.storyDbId, remediated: false,
      }), /MEDIC_CLAIM_OWNER_CARDINALITY_INVALID/);

      const rows = await database.sql<Array<{
        step_status: string;
        current_story_id: string | null;
        story_status: string;
        outcome: string | null;
        owner_state: string;
      }>>`
        SELECT s.status AS step_status,s.current_story_id,st.status AS story_status,
               claim.outcome,owner.state AS owner_state
          FROM steps s
          JOIN stories st ON st.id=${wrong.storyDbId}
          JOIN claim_log claim ON claim.id=${wrong.claimId}
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='claim' AND owner.owner_key=claim.id::text
         WHERE s.id=${wrong.stepDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "running",
        current_story_id: wrong.storyDbId,
        story_status: "running",
        outcome: null,
        owner_state: "bound",
      });
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("keeps failStep state and adjacent owners intact when exact close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { failStep } = await import("../../src/installer/step-fail.js");
      const runId = "run-fail-step-owner-close";
      const { target, adjacent } = await seedLegacySingleOwners(database, runId, new Date(Date.now() - 7_200_000));
      await installRejectClaimCloseTrigger(database, "reject_fail_step_close_v1");
      await assert.rejects(failStep(target.stepDbId, "mapped failure"), /TEST_MAPPED_CLAIM_CLOSE_REJECTED/);
      let rows = await database.sql<Array<{ id: number; outcome: string | null; owner_state: string }>>`
        SELECT cl.id::integer AS id,cl.outcome,r.state AS owner_state FROM claim_log cl
          JOIN internal_production_owner_reservations_v1 r ON r.category='claim' AND r.owner_key=cl.id::text
         WHERE cl.run_id=${runId} ORDER BY cl.id
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { id: target.claimId, outcome: null, owner_state: "bound" },
        { id: adjacent.claimId, outcome: null, owner_state: "bound" },
      ]);
      assert.equal((await database.sql<Array<{ status: string }>>`SELECT status FROM steps WHERE id=${target.stepDbId}`)[0]?.status, "running");
      await dropRejectClaimCloseTrigger(database, "reject_fail_step_close_v1");
      assert.deepEqual(await failStep(target.stepDbId, "mapped failure"), { retrying: true, runFailed: false });
      rows = await database.sql<Array<{ id: number; outcome: string | null; owner_state: string }>>`
        SELECT cl.id::integer AS id,cl.outcome,r.state AS owner_state FROM claim_log cl
          JOIN internal_production_owner_reservations_v1 r ON r.category='claim' AND r.owner_key=cl.id::text
         WHERE cl.run_id=${runId} ORDER BY cl.id
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { id: target.claimId, outcome: "failed", owner_state: "closed" },
        { id: adjacent.claimId, outcome: null, owner_state: "bound" },
      ]);
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("rechecks and rolls back the public stale-claim medic close", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { checkStaleClaims } = await import("../../src/medic/checks.js");
      const runId = "run-stale-claim-owner-close";
      const { target, adjacent } = await seedLegacySingleOwners(database, runId, new Date(Date.now() - 7_200_000));
      const testLogger = { warn() {} };
      await installRejectClaimCloseTrigger(database, "reject_stale_claim_close_v1");
      assert.deepEqual(await checkStaleClaims({}, testLogger), { found: 1, fixed: 0 });
      await dropRejectClaimCloseTrigger(database, "reject_stale_claim_close_v1");
      assert.deepEqual(await checkStaleClaims({}, testLogger), { found: 1, fixed: 1 });
      const rows = await database.sql<Array<{ id: number; outcome: string | null; owner_state: string }>>`
        SELECT cl.id::integer AS id,cl.outcome,r.state AS owner_state FROM claim_log cl
          JOIN internal_production_owner_reservations_v1 r ON r.category='claim' AND r.owner_key=cl.id::text
         WHERE cl.run_id=${runId} ORDER BY cl.id
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { id: target.claimId, outcome: "abandoned", owner_state: "closed" },
        { id: adjacent.claimId, outcome: null, owner_state: "bound" },
      ]);
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  it("rolls back the shared step-ops legacy terminal port on owner-close rejection", async () => {
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    try {
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgQuery("SELECT 1");
      const { closeLegacyClaimOwnersInTransaction } = await import("../../src/installer/step-ops.js");
      const runId = "run-step-ops-owner-close";
      const { target, adjacent } = await seedLegacySingleOwners(database, runId, new Date(Date.now() - 7_200_000));
      await installRejectClaimCloseTrigger(database, "reject_step_ops_close_v1");
      await assert.rejects(database.sql.begin((sql) => closeLegacyClaimOwnersInTransaction(sql, {
        runId, workflowStepId: target.workflowStepId, storyId: null, diagnostic: "mapped completion",
      })), /TEST_MAPPED_CLAIM_CLOSE_REJECTED/);
      await dropRejectClaimCloseTrigger(database, "reject_step_ops_close_v1");
      await database.sql.begin((sql) => closeLegacyClaimOwnersInTransaction(sql, {
        runId, workflowStepId: target.workflowStepId, storyId: null, diagnostic: "mapped completion",
      }));
      const rows = await database.sql<Array<{ id: number; outcome: string | null; owner_state: string }>>`
        SELECT cl.id::integer AS id,cl.outcome,r.state AS owner_state FROM claim_log cl
          JOIN internal_production_owner_reservations_v1 r ON r.category='claim' AND r.owner_key=cl.id::text
         WHERE cl.run_id=${runId} ORDER BY cl.id
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { id: target.claimId, outcome: "completed", owner_state: "closed" },
        { id: adjacent.claimId, outcome: null, owner_state: "bound" },
      ]);
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
    }
  });

  for (const pathKind of ["story", "single", "supervise", "verify"] as const) {
    it(`rolls back the ${pathKind} legacy completion product CAS when its exact owner close rejects`, async () => {
      const database = await createIsolatedTestDatabase();
      const runtimeDb = await import("../../src/db-pg.js");
      try {
        runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
        await runtimeDb.pgQuery("SELECT 1");
        const { completeStep } = await import("../../src/installer/step-ops.js");
        const seeded = await seedLegacyCompletionPath(database, `run-step-ops-${pathKind}-rollback`, pathKind);
        await installRejectClaimCloseAfterProductMutation(
          database,
          `reject_step_ops_${pathKind}_close_v1`,
          pathKind,
        );
        const output = pathKind === "story"
          ? "STATUS: skip\nSKIP_REASON: mapped story rollback"
          : pathKind === "supervise"
            ? "STATUS: done\nSUPERVISOR_DECISION: pass\nCURRENT_STORY_ID: US-001\nAC_COVERAGE: US-001 acceptance covered\nCHECKS: mapped supervisor checks passed"
            : pathKind === "verify"
              ? "STATUS: done\nCURRENT_STORY_ID: US-001"
              : "STATUS: done\nCHANGES: mapped single rollback";
        let closeFailure: unknown;
        let completionResult: unknown;
        try {
          completionResult = await completeStep(seeded.targetStepDbId, output);
        } catch (error) {
          closeFailure = error;
        }
        if (!closeFailure) {
          const observed = await database.sql<Array<{
            step_status: string;
            step_output: string | null;
            story_status: string | null;
            story_output: string | null;
            outcome: string | null;
            owner_state: string;
          }>>`
            SELECT step.status AS step_status,step.output AS step_output,
                   story.status AS story_status,story.output AS story_output,
                   claim.outcome,owner.state AS owner_state
              FROM steps step
              JOIN claim_log claim ON claim.id=${seeded.claimId}
              JOIN internal_production_owner_reservations_v1 owner
                ON owner.category='claim' AND owner.owner_key=claim.id::text
              LEFT JOIN stories story ON story.id=${pathKind === "single" ? null : seeded.storyDbId}
             WHERE step.id=${seeded.targetStepDbId}
          `;
          assert.fail(`mapped close did not reject:${JSON.stringify({ completionResult, observed })}`);
        }
        assert.match(String(closeFailure), /TEST_MAPPED_CLAIM_CLOSE_REJECTED/);
        const rows = await database.sql<Array<{
          step_status: string;
          story_status: string | null;
          outcome: string | null;
          owner_state: string;
        }>>`
          SELECT step.status AS step_status,story.status AS story_status,
                 claim.outcome,owner.state AS owner_state
            FROM steps step
            JOIN claim_log claim ON claim.id=${seeded.claimId}
            JOIN internal_production_owner_reservations_v1 owner
              ON owner.category='claim' AND owner.owner_key=claim.id::text
            LEFT JOIN stories story ON story.id=${pathKind === "single" ? null : seeded.storyDbId}
           WHERE step.id=${seeded.targetStepDbId}
        `;
        assert.deepEqual({ ...rows[0] }, {
          step_status: "running",
          story_status: pathKind === "single" ? null : pathKind === "story" ? "running" : "done",
          outcome: null,
          owner_state: "bound",
        });
      } finally {
        await runtimeDb.pgClose();
        await database.cleanup();
      }
    });
  }

  it("observes claim only after atomic ownership publication and final worktree identity", () => {
    const mainClaim = stepOps.indexOf("const requestedBaseRef = isPrEach");
    const publication = stepOps.indexOf("const publication = await publishLoopClaimAndRuntime(", mainClaim);
    const worktree = stepOps.indexOf("let storyWorkdir = createStoryWorktree", publication);
    const actualBranch = stepOps.indexOf('execFileSync("git", ["branch", "--show-current"]', worktree);
    const resolvedInput = stepOps.indexOf("const resolvedInput = await resolveLoopClaimInput", actualBranch);
    const hook = stepOps.indexOf("await observeShadowAttemptClaim({", resolvedInput);
    const handoff = stepOps.indexOf("// Single (non-loop) step claim path", resolvedInput);
    assert.ok(publication >= 0 && worktree > publication && actualBranch > worktree && resolvedInput > actualBranch);
    assert.ok(hook > resolvedInput, "shadow claim must follow durable ownership and final agent-visible source identity");
    assert.ok(hook > resolvedInput && hook < handoff, "source-before must capture the final agent-visible worktree");
    assert.match(stepOps.slice(publication, worktree), /legacyClaimId = publication\.claimId/);
    assert.match(stepOps.slice(publication, worktree), /claimRuntime = publication\.runtime/);
    assert.match(stepOps.slice(hook, handoff), /shadowAttempt\s*=\s*\{/);
    assert.match(stepOps.slice(hook, handoff), /attemptId:\s*shadowClaim\.attempt\.attemptId/);
    assert.match(stepOps.slice(hook, handoff), /generation:\s*shadowClaim\.attempt\.generation/);
    assert.match(stepOps.slice(hook, handoff), /fenceToken:\s*shadowClaim\.attempt\.fenceToken/);
    assert.match(stepOps.slice(hook, handoff), /attempt:\s*shadowAttempt/);
  });

  it("captures source evidence before one atomic claim-attempt-story-step completion", () => {
    const exactStart = stepOps.indexOf("const exactCompletionEnvelope = completionAuthority?.envelope");
    const sourceCapture = stepOps.indexOf("await captureShadowSourceRevision", exactStart);
    const terminalOwner = stepOps.indexOf("await completeStoryClaimAndBoundAttempt", sourceCapture);
    assert.ok(exactStart >= 0 && sourceCapture > exactStart && terminalOwner > sourceCapture);
    assert.doesNotMatch(stepOps.slice(exactStart, terminalOwner + 200), /observeShadowAttemptSuccess/);

    const ownerStart = transition.indexOf("export async function completeStoryClaimAndBoundAttempt");
    const attemptClose = transition.indexOf("UPDATE execution_attempts", ownerStart);
    const claimClose = transition.indexOf("UPDATE claim_log", attemptClose);
    const storyPublish = transition.indexOf("UPDATE stories", claimClose);
    const stepPublish = transition.indexOf("UPDATE steps", storyPublish);
    assert.ok(ownerStart >= 0 && attemptClose > ownerStart && claimClose > attemptClose);
    assert.ok(storyPublish > claimClose && stepPublish > storyPublish);
  });

  it("publishes the exact claim, attempt, loop state, and owner receipt atomically", () => {
    const start = stepFail.indexOf("async function handleLoopStepFailurePG(");
    const end = stepFail.indexOf("// ── Single step failure", start);
    const block = stepFail.slice(start, end);
    const prepare = block.indexOf("await prepareShadowAttemptFailure({");
    const firstStoryRead = block.indexOf("const story = await pgGet");
    const lifecycleOwner = stepFail.indexOf("async function terminalizeLoopClaimAndState(");
    const ownerTransaction = stepFail.indexOf("await pgBegin(async (sql) => {", lifecycleOwner);
    const ownerTransition = stepFail.indexOf("await closeClaimAndBoundAttemptInTransaction(", ownerTransaction);
    const storyState = stepFail.indexOf("UPDATE stories", ownerTransition);
    const stepState = stepFail.indexOf("UPDATE steps", storyState);
    const ownerReceipt = stepFail.indexOf("await markRuntimeCompletionOwnerCommittedInTransaction(", stepState);
    const ownerFinalize = stepFail.indexOf("await finalizeShadowAttemptFailure(", ownerReceipt);
    assert.ok(prepare >= 0 && prepare < firstStoryRead);
    assert.ok(lifecycleOwner >= 0 && ownerTransaction > lifecycleOwner);
    assert.ok(ownerTransition > ownerTransaction && storyState > ownerTransition && stepState > storyState);
    assert.ok(ownerReceipt > stepState, "RCR owner receipt must follow claim and product state in the same transaction");
    assert.ok(ownerFinalize > ownerReceipt, "post-commit shadow telemetry must follow the authoritative owner transaction");
    assert.equal((block.match(/await terminalizeLoopClaimAndState\(/g) || []).length, 3);
    assert.equal((block.match(/return \{ retrying:/g) || []).length, 3);
    for (const marker of [
      "failStep:loopInfraRetry",
      "failStep:loopStoryExhausted",
      "failStep:loopStoryRetry",
    ]) {
      const stateTransition = block.indexOf(marker);
      const precedingOwner = block.lastIndexOf("await terminalizeLoopClaimAndState(", stateTransition);
      assert.ok(precedingOwner >= 0 && precedingOwner < stateTransition, `${marker} must follow lifecycle terminalization`);
    }
    assert.doesNotMatch(block, /removeStoryWorktree|cleanupProjectEphemera/);
  });

  it("keeps classifiers, supervisor, and prompt parsing out of the recorder", () => {
    assert.doesNotMatch(recorder, /pr-comment|product-supervisor|supervisor\/|parseOutputKeyValues|GitHub/i);
    assert.doesNotMatch(recorder, /spawner(?:-prompt)?\.js/);
    assert.doesNotMatch(recorder, /await db\.pgMigrate\(/);
  });

  it("keeps legacy timeout healers from owning compiler-run lifecycle", () => {
    const cleanupStart = cleanupOps.indexOf("export async function cleanupAbandonedSteps(");
    const stuckPipelines = cleanupOps.indexOf("// Recover stuck pipelines", cleanupStart);
    const stuckVerify = cleanupOps.indexOf("// Recover stuck verify_each", stuckPipelines);
    const cleanupEnd = cleanupOps.indexOf("// ── Progress Archiving", stuckVerify);
    assert.equal((cleanupOps.slice(cleanupStart, stuckPipelines).match(/r\.protocol = 'legacy'/g) || []).length, 2);
    assert.match(cleanupOps.slice(stuckPipelines, stuckVerify), /r\.protocol = 'legacy'/);
    assert.match(cleanupOps.slice(stuckVerify, cleanupEnd), /r\.protocol = 'legacy'/);

    const resumeStart = medic.indexOf('case "resume_run":');
    const resetStart = medic.indexOf('case "reset_story":');
    const resetEnd = medic.indexOf('case "advance_pipeline":', resetStart);
    assert.match(medic.slice(resumeStart, resetStart), /preCheck\.protocol !== "legacy"/);
    assert.match(medic.slice(resetStart, resetEnd), /story\.protocol !== "legacy"/);
    assert.match(medic, /compilerUnsafeActions\.has\(finding\.action\)/);
    const gatewayRestart = medic.indexOf('if (finding.action === "restart_gateway")');
    const gatewayMutation = medic.indexOf('systemctlUser("restart", "openclaw-gateway")', gatewayRestart);
    const compilerOwnerGuard = medic.indexOf("protocol IN ('shadow', 'v3')", gatewayRestart);
    const attemptOwnerGuard = medic.indexOf("disposition IN ('claimed', 'running')", compilerOwnerGuard);
    assert.ok(gatewayRestart >= 0 && compilerOwnerGuard > gatewayRestart && attemptOwnerGuard > compilerOwnerGuard);
    assert.ok(gatewayMutation > attemptOwnerGuard, "gateway restart must follow compiler owner guard");
  });

  it("terminalizes a platform push failure with compiler story and run state atomically", () => {
    const start = stepOps.indexOf("const pushFailure = `PLATFORM_STORY_PUSH_FAILED");
    const end = stepOps.indexOf('checkId: "implement.platform_push.done"', start);
    const block = stepOps.slice(start, end);
    const lifecycle = block.indexOf("await terminalizeLoopClaimAndState({");
    assert.ok(start >= 0 && end > start && lifecycle >= 0);
    assert.match(block.slice(lifecycle), /state:\s*\{[\s\S]*storyStatus:\s*"failed"[\s\S]*stepStatus:\s*"failed"[\s\S]*runFailureDiagnostic:/);
    assert.doesNotMatch(block, /await pgBegin|await failRun|UPDATE claim_log/);
  });

  it("keeps all four claim births on canonical PostgreSQL BIGINT text", () => {
    const exactAllocation = /SELECT nextval\(pg_get_serial_sequence\('claim_log','id'\)\)::bigint::text AS id/g;
    assert.equal((claimPublication.match(exactAllocation) || []).length, 2);
    assert.equal((downstreamPublication.match(exactAllocation) || []).length, 1);
    assert.equal((evidenceOnlyPublication.match(exactAllocation) || []).length, 1);
    for (const source of [claimPublication, downstreamPublication, evidenceOnlyPublication]) {
      assert.doesNotMatch(source, /nextval\(pg_get_serial_sequence\('claim_log','id'\)\)::integer/);
    }
  });

  it("closes claim and runtime sidecars only after terminal row mutation", () => {
    const helperStart = transition.indexOf("export async function closeInternalProductionClaimOwnerAfterTerminalMutationV1");
    const claimResolve = transition.indexOf("resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1", helperStart);
    const claimClose = transition.indexOf("closeInternalProductionOwnerReservationV1", claimResolve);
    const claimUpdate = transition.indexOf("UPDATE claim_log");
    const helperCall = transition.indexOf("closeInternalProductionClaimOwnerAfterTerminalMutationV1(sql, closed[0]!.id)", claimUpdate);
    assert.ok(helperStart >= 0 && claimResolve > helperStart && claimClose > claimResolve);
    assert.ok(claimUpdate >= 0 && helperCall > claimUpdate);
    assert.match(runtimeSessions, /UPDATE runtime_sessions[\s\S]*SET state = 'released'[\s\S]*closeInternalProductionRuntimeSessionOwnerAfterTerminalMutationV1/);
    assert.match(runtimeSessions, /SELECT \* FROM runtime_sessions WHERE session_id = \$1 FOR UPDATE[\s\S]*SET state = 'quarantined'[\s\S]*closeInternalProductionRuntimeSessionOwnerAfterTerminalMutationV1/);
  });
});
