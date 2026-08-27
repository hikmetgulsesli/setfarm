import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { PgTransactionSql } from "../../src/db-pg.js";

const storiesRegistryUrl = new URL("../../src/installer/steps/registry.js", import.meta.url).href;
const storiesRegistrySource = `
  import * as actual from ${JSON.stringify(`${storiesRegistryUrl}?stories-shared-handler-real=1`)};
  const stories = {
    id: "stories", type: "single", agentRole: "planner", maxPromptSize: 32768,
    requiredOutputFields: [],
    injectContext: async () => {
      process.env.SETFARM_STORIES_SHARED_HANDLER_MOCK_HIT = "1";
      throw new Error("TEST_STORIES_SHARED_HANDLER_INJECT_FAILURE");
    },
    buildPrompt: () => "", validateOutput: () => ({ valid: true, errors: [] }),
    onComplete: async () => {},
  };
  export const get = (id) => {
    if (id === "stories") process.env.SETFARM_STORIES_SHARED_HANDLER_GET_HIT = "1";
    return id === "stories" ? stories : actual.get(id);
  };
  export const has = (id) => id === "stories" || actual.has(id);
  export const list = () => actual.list();
`;
const storiesRegistryMockUrl = `data:text/javascript;base64,${Buffer.from(storiesRegistrySource).toString("base64")}`;

async function createTestDatabase() {
  const { createIsolatedTestDatabase } = await import("./test-database.js");
  return createIsolatedTestDatabase();
}

test("claimStep publishes one normal v3 platform-preclaim terminal transition", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-preclaim-normal-"));
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const runId = "run-v3-platform-preclaim-normal";
    const stepDbId = "step-v3-platform-preclaim-normal";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "9".repeat(40);
    const { seedCanonicalSetupBuildCompilerStoryAdmissionFixture } = await import(
      "./helpers/compiler-story-admission-fixture.js"
    );
    const admission = await seedCanonicalSetupBuildCompilerStoryAdmissionFixture(database, {
      runId,
      repo,
      setupBuildStepDbId: stepDbId,
      setupBuildClaimAgentId: claimAgentId,
      releaseSha,
      additionalContext: {
        stack_pack_id: "vite-react-web-app",
        tech_stack: "vite-react",
      },
    });
    fs.mkdirSync(path.join(repo, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({
      name: "preclaim-normal-fixture",
      version: "1.0.0",
      type: "module",
      scripts: { build: "node -e \"process.exit(0)\"" },
    }));
    fs.writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), "{ malformed-json\n");
    const { claimStep } = await import("../../src/installer/step-ops.js");
    assert.deepEqual(Object.keys(admission), ["claimId", "runtimeIntent", "context", "task"]);
    assert.equal(Object.isFrozen(admission), true);
    assert.equal(Object.isFrozen(admission.runtimeIntent), true);
    assert.deepEqual(admission.runtimeIntent, {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: `RTS_${createHash("sha256").update(`${runId}:setup-build`, "utf8").digest("hex").slice(0, 24)}`,
      runtimeAgentId: claimAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "setup-build-fixture-owner",
      sessionKey: "setup-build-fixture-session",
    });
    const readPreclaimPrefix = async () => {
      const prefix = await database.sql<Array<{
        run_status: string;
        step_status: string;
        claim_outcome: string | null;
        runtime_state: string;
        termination_count: number;
        reservation_count: number;
      }>>`
        SELECT run_row.status AS run_status,
               step.status AS step_status,
               claim.outcome AS claim_outcome,
               runtime.state AS runtime_state,
               (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count,
               (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1) AS reservation_count
          FROM runs run_row
          JOIN steps step ON step.id = ${stepDbId}
          JOIN claim_log claim ON claim.id = ${admission.claimId}
          JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
         WHERE run_row.id = ${runId}
      `;
      assert.equal(prefix.length, 1);
      return { ...prefix[0]! };
    };
    const readScopedAuthoritySnapshot = async (): Promise<unknown> => {
      const rows = await database.sql.unsafe<Array<{ snapshot: unknown }>>(
        `SELECT jsonb_build_object(
           'run',(SELECT to_jsonb(row) FROM (SELECT * FROM runs WHERE id=$1) row),
           'step',(SELECT to_jsonb(row) FROM (SELECT * FROM steps WHERE id=$2) row),
           'claim',(SELECT to_jsonb(row) FROM (SELECT * FROM claim_log WHERE id=$3) row),
           'runtime',(SELECT to_jsonb(row) FROM (SELECT * FROM runtime_sessions WHERE claim_id=$3) row),
           'terminations',COALESCE((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.request_id)
             FROM (SELECT * FROM run_termination_requests WHERE run_id=$1) row),'[]'::jsonb),
           'completionRequests',COALESCE((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.request_id)
             FROM (SELECT * FROM runtime_completion_requests WHERE claim_id=$3) row),'[]'::jsonb),
           'completionEffects',COALESCE((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.request_id,row.effect_key)
             FROM (SELECT effect.* FROM runtime_completion_effects effect
               JOIN runtime_completion_requests request ON request.request_id=effect.request_id
              WHERE request.claim_id=$3) row),'[]'::jsonb),
           'owners',COALESCE((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.reservation_ref)
             FROM (SELECT * FROM internal_production_owner_reservations_v1
               WHERE owner_key IN ($3::text,$4)
                  OR (category IN ('termination','completion-owner') AND owner_key LIKE $1 || '%')) row),'[]'::jsonb),
           'head',(SELECT to_jsonb(row) FROM (SELECT * FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE) row)
         ) AS snapshot`,
        [runId, stepDbId, String(admission.claimId), admission.runtimeIntent.sessionId],
      );
      assert.equal(rows.length, 1);
      return rows[0]!.snapshot;
    };
    const installTerminalMutationGuard = async (): Promise<void> => {
      await database.sql.unsafe(`CREATE OR REPLACE FUNCTION p3_reissue_forbid_terminal_mutation_v1()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'P3_REISSUE_TERMINAL_MUTATION_REACHED'; END $$`);
      await database.sql.unsafe(`CREATE TRIGGER p3_reissue_forbid_terminal_mutation_v1
        BEFORE UPDATE ON claim_log FOR EACH ROW
        EXECUTE FUNCTION p3_reissue_forbid_terminal_mutation_v1()`);
    };
    const removeTerminalMutationGuard = async (): Promise<void> => {
      await database.sql.unsafe("DROP TRIGGER IF EXISTS p3_reissue_forbid_terminal_mutation_v1 ON claim_log");
      await database.sql.unsafe("DROP FUNCTION IF EXISTS p3_reissue_forbid_terminal_mutation_v1()");
    };
    const assertRefusedWithoutScopedMutation = async (
      caller: string,
      runtimeIntent = admission.runtimeIntent,
    ): Promise<void> => {
      const before = await readScopedAuthoritySnapshot();
      await installTerminalMutationGuard();
      try {
        assert.deepEqual(await claimStep(claimAgentId, caller, runtimeIntent), { found: false });
      } finally {
        await removeTerminalMutationGuard();
      }
      assert.deepEqual(await readScopedAuthoritySnapshot(), before);
    };
    const originalPrefix = await readPreclaimPrefix();
    assert.deepEqual(
      await claimStep(claimAgentId, "v3-platform-preclaim-normal"),
      { found: false },
    );
    assert.deepEqual(await readPreclaimPrefix(), originalPrefix);
    const crossedRuntimeIntents = [
      { ...admission.runtimeIntent, sessionId: `RTS_${"a".repeat(24)}` },
      { ...admission.runtimeIntent, ownerInstanceId: "crossed-setup-build-owner" },
      { ...admission.runtimeIntent, runtimeAgentId: "crossed-setup-build-agent" },
      { ...admission.runtimeIntent, runtimeKind: "external_session" as const },
      { ...admission.runtimeIntent, sessionKey: "crossed-setup-build-session" },
      { ...admission.runtimeIntent, worktree: "/tmp/crossed-setup-build-worktree" },
      { ...admission.runtimeIntent, runtimePath: "/tmp/crossed-setup-build-runtime" },
      { ...admission.runtimeIntent, transcriptPath: "/tmp/crossed-setup-build-transcript" },
    ];
    for (const [ordinal, crossedRuntimeIntent] of crossedRuntimeIntents.entries()) {
      assert.deepEqual(
        await claimStep(claimAgentId, `v3-platform-preclaim-crossed-${ordinal}`, crossedRuntimeIntent),
        { found: false },
      );
      assert.deepEqual(await readPreclaimPrefix(), originalPrefix);
    }
    const claimOwnerRows = await database.sql<Array<{
      reservation_ref: string;
      reservation_payload: Record<string, unknown>;
      binding_hash: string;
      canonical_owner_identity: Record<string, unknown>;
      head_version: string;
    }>>`
      SELECT reservation_ref,reservation_payload,binding_hash,canonical_owner_identity,
             head_version::text AS head_version
        FROM internal_production_owner_reservations_v1
       WHERE category='claim' AND owner_key=${String(admission.claimId)} AND state='bound'
    `;
    assert.equal(claimOwnerRows.length, 1);
    const claimOwner = claimOwnerRows[0]!;
    await database.sql`
      UPDATE internal_production_owner_reservations_v1
         SET reservation_payload=reservation_payload || '{"extra":true}'::jsonb
       WHERE reservation_ref=${claimOwner.reservation_ref}
    `;
    try {
      await assertRefusedWithoutScopedMutation("v3-platform-preclaim-crossed-reservation");
    } finally {
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET reservation_payload=${database.sql.json(claimOwner.reservation_payload)}
         WHERE reservation_ref=${claimOwner.reservation_ref}
      `;
    }
    await database.sql`
      UPDATE internal_production_owner_reservations_v1
         SET binding_hash=${"f".repeat(64)}
       WHERE reservation_ref=${claimOwner.reservation_ref}
    `;
    try {
      await assertRefusedWithoutScopedMutation("v3-platform-preclaim-crossed-binding-hash");
    } finally {
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET binding_hash=${claimOwner.binding_hash}
         WHERE reservation_ref=${claimOwner.reservation_ref}
      `;
    }
    await database.sql`
      UPDATE internal_production_owner_reservations_v1
         SET canonical_owner_identity=canonical_owner_identity || '{"extra":true}'::jsonb
       WHERE reservation_ref=${claimOwner.reservation_ref}
    `;
    try {
      await assertRefusedWithoutScopedMutation("v3-platform-preclaim-crossed-owner-identity");
    } finally {
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET canonical_owner_identity=${database.sql.json(claimOwner.canonical_owner_identity)}
         WHERE reservation_ref=${claimOwner.reservation_ref}
      `;
    }
    await database.sql`
      UPDATE internal_production_owner_reservations_v1
         SET head_version=${Number(claimOwner.head_version) + 1}
       WHERE reservation_ref=${claimOwner.reservation_ref}
    `;
    try {
      await assertRefusedWithoutScopedMutation("v3-platform-preclaim-crossed-head-version");
    } finally {
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET head_version=${claimOwner.head_version}
        WHERE reservation_ref=${claimOwner.reservation_ref}
      `;
    }
    const ownerHeadRows = await database.sql<Array<{
      active_fence_ref: string | null;
      active_fence_hash: string | null;
      active_target_family_hash: string | null;
      head_payload: Record<string, unknown>;
    }>>`
      SELECT active_fence_ref,active_fence_hash,active_target_family_hash,head_payload
        FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
    `;
    assert.equal(ownerHeadRows.length, 1);
    const ownerHead = ownerHeadRows[0]!;
    await database.sql`
      UPDATE internal_production_owner_admission_head_v1
         SET head_payload=head_payload || '{"extra":true}'::jsonb
       WHERE singleton=TRUE
    `;
    try {
      await assertRefusedWithoutScopedMutation("v3-platform-preclaim-crossed-head-payload");
    } finally {
      await database.sql`
        UPDATE internal_production_owner_admission_head_v1
           SET head_payload=${database.sql.json(ownerHead.head_payload)}
         WHERE singleton=TRUE
      `;
    }
    await database.sql`
      UPDATE internal_production_owner_admission_head_v1
         SET active_fence_ref=${"setfarm://internal-production/test-running-reissue-fence"},
             active_fence_hash=${"a".repeat(64)},
             active_target_family_hash=${"b".repeat(64)}
       WHERE singleton=TRUE
    `;
    try {
      await assertRefusedWithoutScopedMutation("v3-platform-preclaim-active-owner-fence");
    } finally {
      await database.sql`
        UPDATE internal_production_owner_admission_head_v1
           SET active_fence_ref=${ownerHead.active_fence_ref},
               active_fence_hash=${ownerHead.active_fence_hash},
               active_target_family_hash=${ownerHead.active_target_family_hash}
         WHERE singleton=TRUE
      `;
    }
    const claimAuthorityRows = await database.sql<Array<{
      predecessor_head_hash: string;
      authority_body: Record<string, unknown>;
    }>>`
      SELECT predecessor_head_hash,authority_body
        FROM internal_production_owner_admission_authorities_v1
       WHERE authority_ref=${claimOwner.reservation_ref}
         AND authority_kind='reservation'
    `;
    assert.equal(claimAuthorityRows.length, 1);
    await database.sql.unsafe(
      "ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable",
    );
    try {
      await database.sql`
        UPDATE internal_production_owner_admission_authorities_v1
           SET predecessor_head_hash=${"c".repeat(64)},
               authority_body=jsonb_set(
                 authority_body,
                 '{ownerAdmissionHeadPredecessorHash}',
                 to_jsonb(${"c".repeat(64)}::text)
               )
         WHERE authority_ref=${claimOwner.reservation_ref}
           AND authority_kind='reservation'
      `;
      try {
        await assertRefusedWithoutScopedMutation("v3-platform-preclaim-broken-owner-ancestry-edge");
      } finally {
        await database.sql`
          UPDATE internal_production_owner_admission_authorities_v1
             SET predecessor_head_hash=${claimAuthorityRows[0]!.predecessor_head_hash},
                 authority_body=${database.sql.json(claimAuthorityRows[0]!.authority_body)}
           WHERE authority_ref=${claimOwner.reservation_ref}
             AND authority_kind='reservation'
        `;
      }
    } finally {
      await database.sql.unsafe(
        "ALTER TABLE internal_production_owner_admission_authorities_v1 ENABLE TRIGGER trg_internal_production_owner_admission_authority_immutable",
      );
    }
    const runtimeOwnerRows = await database.sql<Array<{
      reservation_ref: string;
      head_version: string;
    }>>`
      SELECT reservation_ref,head_version::text AS head_version
        FROM internal_production_owner_reservations_v1
       WHERE category='runtime-session'
         AND owner_key=${admission.runtimeIntent.sessionId}
         AND state='bound'
    `;
    assert.equal(runtimeOwnerRows.length, 1);
    const runtimeOwner = runtimeOwnerRows[0]!;
    await database.sql`
      UPDATE internal_production_owner_reservations_v1
         SET head_version=${Number(runtimeOwner.head_version) + 1}
       WHERE reservation_ref=${runtimeOwner.reservation_ref}
    `;
    try {
      await assertRefusedWithoutScopedMutation("v3-platform-preclaim-crossed-runtime-head-version");
    } finally {
      await database.sql`
        UPDATE internal_production_owner_reservations_v1
           SET head_version=${runtimeOwner.head_version}
         WHERE reservation_ref=${runtimeOwner.reservation_ref}
      `;
    }
    const runtimeRow = (await database.sql<Array<{
      step_db_id: string;
      workflow_step_id: string;
      state: string;
      started_at: Date | null;
      drained_at: Date | null;
      released_at: Date | null;
      diagnostic: string | null;
    }>>`
      SELECT step_db_id,workflow_step_id,state,started_at,drained_at,released_at,diagnostic
        FROM runtime_sessions WHERE session_id=${admission.runtimeIntent.sessionId}
    `)[0]!;
    const alternateStep = (await database.sql<Array<{ id: string; step_id: string }>>`
      SELECT id,step_id FROM steps WHERE run_id=${runId} AND id<>${stepDbId}
       ORDER BY step_index LIMIT 1
    `)[0]!;
    for (const [column, value] of [
      ["step_db_id", alternateStep.id],
      ["workflow_step_id", alternateStep.step_id],
    ] as const) {
      await database.sql.unsafe(
        `UPDATE runtime_sessions SET ${column}=$1 WHERE session_id=$2`,
        [value, admission.runtimeIntent.sessionId],
      );
      try {
        await assertRefusedWithoutScopedMutation(`v3-platform-preclaim-crossed-${column}`);
      } finally {
        await database.sql.unsafe(
          `UPDATE runtime_sessions SET ${column}=$1 WHERE session_id=$2`,
          [runtimeRow[column], admission.runtimeIntent.sessionId],
        );
      }
    }
    for (const state of ["drain_requested", "drained", "released", "quarantined"] as const) {
      await database.sql`
        UPDATE runtime_sessions
           SET state=${state},
               drain_requested_at=CASE WHEN ${state} IN ('drain_requested','drained','released') THEN NOW() ELSE drain_requested_at END,
               drained_at=CASE WHEN ${state} IN ('drained','released') THEN NOW() ELSE NULL END,
               released_at=CASE WHEN ${state}='released' THEN NOW() ELSE NULL END,
               diagnostic=CASE WHEN ${state}='quarantined' THEN 'p3 hostile state' ELSE NULL END
         WHERE session_id=${admission.runtimeIntent.sessionId}
      `;
      try {
        await assertRefusedWithoutScopedMutation(`v3-platform-preclaim-state-${state}`);
      } finally {
        await database.sql`
          UPDATE runtime_sessions
             SET state=${runtimeRow.state},started_at=${runtimeRow.started_at},
                 drain_requested_at=NULL,drained_at=${runtimeRow.drained_at},
                 released_at=${runtimeRow.released_at},diagnostic=${runtimeRow.diagnostic}
           WHERE session_id=${admission.runtimeIntent.sessionId}
        `;
      }
    }
    for (const state of ["starting", "running"] as const) {
      await database.sql`
        UPDATE runtime_sessions
           SET state=${state},started_at=COALESCE(started_at,NOW())
         WHERE session_id=${admission.runtimeIntent.sessionId}
      `;
      try {
        await assertRefusedWithoutScopedMutation(`v3-platform-preclaim-active-${state}`);
      } finally {
        await database.sql`
          UPDATE runtime_sessions SET state='reserved',started_at=${runtimeRow.started_at}
           WHERE session_id=${admission.runtimeIntent.sessionId}
        `;
      }
    }
    const transitionEdgeStartedAt = new Date("2026-07-15T12:00:30.000Z");
    await database.sql`
      UPDATE runtime_sessions SET state='starting',started_at=${transitionEdgeStartedAt}
       WHERE session_id=${admission.runtimeIntent.sessionId}
    `;
    const expectedTransitionEdge = await readScopedAuthoritySnapshot();
    await database.sql`
      UPDATE runtime_sessions SET state='reserved',started_at=${runtimeRow.started_at}
       WHERE session_id=${admission.runtimeIntent.sessionId}
    `;
    let releaseTransitionEdge!: () => void;
    const transitionEdgeRelease = new Promise<void>((resolve) => {
      releaseTransitionEdge = resolve;
    });
    let announceTransitionEdge!: (pid: number) => void;
    const transitionEdgeReady = new Promise<number>((resolve) => {
      announceTransitionEdge = resolve;
    });
    const transitionEdgeBlocker = database.sql.begin(async (transaction) => {
      const pidRows = await transaction<Array<{ pid: number }>>`SELECT pg_backend_pid()::integer AS pid`;
      await transaction`SELECT id FROM runs WHERE id=${runId} FOR UPDATE`;
      announceTransitionEdge(pidRows[0]!.pid);
      await transitionEdgeRelease;
      await transaction`
        UPDATE runtime_sessions SET state='starting',started_at=${transitionEdgeStartedAt}
         WHERE session_id=${admission.runtimeIntent.sessionId}
      `;
    });
    const transitionBlockerPid = await transitionEdgeReady;
    const transitionEdgeClaim = claimStep(
      claimAgentId,
      "v3-platform-preclaim-reserved-to-starting-edge",
      admission.runtimeIntent,
    ).then(
      (value) => ({ value, error: undefined as unknown }),
      (error: unknown) => ({ value: undefined, error }),
    );
    let transitionEdgeBlocked = false;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const waiting = await database.sql<Array<{ blocked: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity activity
           WHERE ${transitionBlockerPid}=ANY(pg_blocking_pids(activity.pid))
        ) AS blocked
      `;
      if (waiting[0]?.blocked) {
        transitionEdgeBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(transitionEdgeBlocked, true, "preclaim failure must reach the retained run lock");
    releaseTransitionEdge();
    await transitionEdgeBlocker;
    const transitionEdgeResult = await transitionEdgeClaim;
    assert.equal(transitionEdgeResult.error, undefined);
    assert.deepEqual(transitionEdgeResult.value, { found: false });
    assert.deepEqual(await readScopedAuthoritySnapshot(), expectedTransitionEdge);
    await database.sql`
      UPDATE runtime_sessions SET state='reserved',started_at=${runtimeRow.started_at}
       WHERE session_id=${admission.runtimeIntent.sessionId}
    `;
    await database.sql`UPDATE steps SET retry_count=1 WHERE id=${stepDbId}`;
    try {
      await assertRefusedWithoutScopedMutation(
        "v3-platform-preclaim-retry-history-precedence",
        { ...admission.runtimeIntent, ownerInstanceId: "same-session-crossed-owner" },
      );
    } finally {
      await database.sql`UPDATE steps SET retry_count=0 WHERE id=${stepDbId}`;
    }
    assert.deepEqual(
      await claimStep(claimAgentId, "v3-platform-preclaim-normal", admission.runtimeIntent),
      { found: false },
    );

    const rows = await database.sql<Array<{
      run_status: string;
      step_status: string;
      claim_outcome: string | null;
      claim_count: number;
      termination_count: number;
      termination_state: string;
      requested_by: string;
      evidence: Record<string, unknown>;
      runtime_state: string;
      claim_owner_count: number;
      claim_owner_implementation: string;
      claim_owner_state: string;
      runtime_owner_count: number;
      runtime_owner_implementation: string;
      runtime_owner_state: string;
    }>>`
      SELECT run_row.status AS run_status,
             step.status AS step_status,
             claim.outcome AS claim_outcome,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claim_count,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count,
             termination.state AS termination_state,
             termination.requested_by,
             termination.evidence,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1 owner WHERE owner.category='claim' AND owner.owner_key=claim.id::text) AS claim_owner_count,
             (SELECT MIN(owner.producer_implementation_id) FROM internal_production_owner_reservations_v1 owner WHERE owner.category='claim' AND owner.owner_key=claim.id::text) AS claim_owner_implementation,
             (SELECT MIN(owner.state) FROM internal_production_owner_reservations_v1 owner WHERE owner.category='claim' AND owner.owner_key=claim.id::text) AS claim_owner_state,
             (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1 owner WHERE owner.category='runtime-session' AND owner.owner_key=runtime.session_id) AS runtime_owner_count,
             (SELECT MIN(owner.producer_implementation_id) FROM internal_production_owner_reservations_v1 owner WHERE owner.category='runtime-session' AND owner.owner_key=runtime.session_id) AS runtime_owner_implementation,
             (SELECT MIN(owner.state) FROM internal_production_owner_reservations_v1 owner WHERE owner.category='runtime-session' AND owner.owner_key=runtime.session_id) AS runtime_owner_state
        FROM runs run_row
        JOIN steps step ON step.id = ${stepDbId}
        JOIN claim_log claim ON claim.id = ${admission.claimId}
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN run_termination_requests termination ON termination.run_id = run_row.id
       WHERE run_row.id = ${runId}
    `;
    assert.equal(rows.length, 1);
    assert.deepEqual({
      run_status: rows[0]!.run_status,
      step_status: rows[0]!.step_status,
      claim_outcome: rows[0]!.claim_outcome,
      claim_count: rows[0]!.claim_count,
      termination_count: rows[0]!.termination_count,
      termination_state: rows[0]!.termination_state,
      requested_by: rows[0]!.requested_by,
    }, {
      run_status: "failing",
      step_status: "failed",
      claim_outcome: "failed",
      claim_count: 4,
      termination_count: 1,
      termination_state: "requested",
      requested_by: "setfarm.step-fail.single",
    });
    assert.deepEqual(rows[0]!.evidence.operationalFailureCause, {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "setup-build",
      boundary: "stitch.converter.input_contract",
      failureClass: "contract_invalid",
      failureCode: "STITCH_DESIGN_MANIFEST_JSON_INVALID",
    });
    assert.equal(rows[0]!.runtime_state, "released");
    assert.equal(rows[0]!.claim_owner_count, 1);
    assert.equal(rows[0]!.claim_owner_implementation, "a-claim-single-runtime-v1");
    assert.equal(rows[0]!.claim_owner_state, "closed");
    assert.equal(rows[0]!.runtime_owner_count, 1);
    assert.equal(rows[0]!.runtime_owner_implementation, "a-runtime-session-v1");
    assert.equal(rows[0]!.runtime_owner_state, "closed");
    assert.deepEqual(
      await claimStep(claimAgentId, "v3-platform-preclaim-normal-replay", admission.runtimeIntent),
      { found: false },
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
    await runtimeDb?.pgClose().catch(() => {});
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});

test("claimStep reissues starting and running runtimes only through successful shared handling", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    const { publishSingleClaimRuntime } = await import("../../src/execution/claim-runtime-publication.js");
    const { persistWorkflowRunInTransaction } = await import("../../src/execution/run-persistence.js");
    const { hashCanonicalJson } = await import("../../src/product-compiler/canonical-json.js");
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    await runtimeDb.initializeInternalProductionCurrentEntryDatabaseV1();
    const runId = "run-v3-active-runtime-reissue";
    const stepDbId = "step-v3-active-runtime-reissue";
    const claimAgentId = "feature-dev_reviewer";
    const releaseSha = "8".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
      transaction as PgTransactionSql,
      {
        run: {
          id: runId,
          runNumber: 8603,
          workflowId: "feature-dev",
          task: "Reissue one active verify runtime",
          context: JSON.stringify({ task: "Reissue one active verify runtime" }),
          notifyUrl: null,
          createdAt: "2026-07-15T12:02:00.000Z",
          protocol: {
            mode: "v3",
            version: 1,
            compilerReleaseSha: releaseSha,
            activationPreflightHash: hashCanonicalJson({
              fixture: "v3-release-preflight",
              releaseSha,
            }),
            releaseAdmissionHash,
            releaseAdmissionKind: "release_go",
            canaryAdmission: null,
          },
        },
        steps: [
          { id: stepDbId, stepId: "verify", agentId: claimAgentId, stepIndex: 7, inputTemplate: "", expects: "", status: "pending", maxRetries: 3, type: "single", loopConfig: null },
        ],
      },
    ));
    const runtimeIntent = {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_v3-active-runtime-reissue",
      runtimeAgentId: claimAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "v3-active-runtime-reissue-owner",
      sessionKey: "v3-active-runtime-reissue-session",
    } as const;
    const publication = await publishSingleClaimRuntime(database.sql, {
      runId,
      stepDbId,
      workflowStepId: "verify",
      claimAgentId,
      runtimeIntent,
      now: new Date("2026-07-15T12:02:00.000Z"),
    });
    if (!publication.runtime) throw new Error("test runtime publication missing");
    const { claimStep } = await import("../../src/installer/step-ops.js");
    const initialCounts = (await database.sql<Array<{
      claim_count: number;
      runtime_count: number;
      owner_count: number;
    }>>`
      SELECT (SELECT COUNT(*)::integer FROM claim_log WHERE run_id=${runId}) AS claim_count,
             (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id=${runId}) AS runtime_count,
             (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1) AS owner_count
    `)[0]!;
    for (const state of ["starting", "running"] as const) {
      await database.sql`
        UPDATE runtime_sessions SET state=${state},started_at=COALESCE(started_at,NOW())
         WHERE session_id=${runtimeIntent.sessionId}
      `;
      const reissued = await claimStep(
        claimAgentId,
        `v3-active-runtime-success-${state}`,
        runtimeIntent,
      );
      assert.equal(reissued.found, true);
      if (!reissued.found) throw new Error("active runtime reissue missing");
      assert.equal(reissued.claimId, publication.claimId);
      assert.equal(reissued.runtimeSessionId, runtimeIntent.sessionId);
      assert.equal(reissued.runtimeOwnerInstanceId, runtimeIntent.ownerInstanceId);
      const currentCounts = (await database.sql<Array<typeof initialCounts>>`
        SELECT (SELECT COUNT(*)::integer FROM claim_log WHERE run_id=${runId}) AS claim_count,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id=${runId}) AS runtime_count,
               (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1) AS owner_count
      `)[0]!;
      assert.deepEqual({ ...currentCounts }, { ...initialCounts });
    }
  } finally {
    await runtimeDb?.pgClose();
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});

test("stories outer shared handler leaves starting and running runtime authority untouched", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  let registryHookHit = false;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (context.parentURL?.includes("stories-shared-handler-test=1")
        && /\/src\/installer\/steps\/registry\.(?:js|ts)(?:$|\?)/.test(resolved.url)) {
        registryHookHit = true;
        return { url: storiesRegistryMockUrl, shortCircuit: true };
      }
      return resolved;
    },
  });
  try {
    const { publishSingleClaimRuntime } = await import("../../src/execution/claim-runtime-publication.js");
    const { persistWorkflowRunInTransaction } = await import("../../src/execution/run-persistence.js");
    const { hashCanonicalJson } = await import("../../src/product-compiler/canonical-json.js");
    delete process.env.SETFARM_STORIES_SHARED_HANDLER_MOCK_HIT;
    delete process.env.SETFARM_STORIES_SHARED_HANDLER_GET_HIT;
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    await runtimeDb.initializeInternalProductionCurrentEntryDatabaseV1();
    const runId = "run-v3-stories-shared-handler";
    const stepDbId = "step-v3-stories-shared-handler";
    const claimAgentId = "feature-dev_story-planner";
    const releaseSha = "7".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
      transaction as PgTransactionSql,
      {
        run: {
          id: runId,
          runNumber: 8604,
          workflowId: "feature-dev",
          task: "Exercise the stories shared handler",
          context: JSON.stringify({ task: "Exercise the stories shared handler" }),
          notifyUrl: null,
          createdAt: "2026-07-15T12:03:00.000Z",
          protocol: {
            mode: "v3",
            version: 1,
            compilerReleaseSha: releaseSha,
            activationPreflightHash: hashCanonicalJson({
              fixture: "v3-release-preflight",
              releaseSha,
            }),
            releaseAdmissionHash,
            releaseAdmissionKind: "release_go",
            canaryAdmission: null,
          },
        },
        steps: [
          { id: stepDbId, stepId: "stories", agentId: claimAgentId, stepIndex: 3, inputTemplate: "", expects: "", status: "pending", maxRetries: 3, type: "single", loopConfig: null },
        ],
      },
    ));
    const runtimeIntent = {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_v3-stories-shared-handler",
      runtimeAgentId: claimAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "v3-stories-shared-handler-owner",
      sessionKey: "v3-stories-shared-handler-session",
    } as const;
    const publication = await publishSingleClaimRuntime(database.sql, {
      runId,
      stepDbId,
      workflowStepId: "stories",
      claimAgentId,
      runtimeIntent,
      now: new Date("2026-07-15T12:03:00.000Z"),
    });
    if (!publication.runtime) throw new Error("stories shared-handler runtime missing");
    const readSnapshot = async (): Promise<unknown> => (await database.sql<Array<{ snapshot: unknown }>>`
      SELECT jsonb_build_object(
        'run',(SELECT to_jsonb(row) FROM (SELECT * FROM runs WHERE id=${runId}) row),
        'step',(SELECT to_jsonb(row) FROM (SELECT * FROM steps WHERE id=${stepDbId}) row),
        'claim',(SELECT to_jsonb(row) FROM (SELECT * FROM claim_log WHERE id=${publication.claimId}) row),
        'runtime',(SELECT to_jsonb(row) FROM (SELECT * FROM runtime_sessions WHERE claim_id=${publication.claimId}) row),
        'terminations',COALESCE((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.request_id)
          FROM (SELECT * FROM run_termination_requests WHERE run_id=${runId}) row),'[]'::jsonb),
        'owners',COALESCE((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.reservation_ref)
          FROM (SELECT * FROM internal_production_owner_reservations_v1
            WHERE owner_key IN (${String(publication.claimId)},${runtimeIntent.sessionId})) row),'[]'::jsonb),
        'head',(SELECT to_jsonb(row) FROM (SELECT * FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE) row)
      ) AS snapshot
    `)[0]!.snapshot;
    const storiesStepOpsUrl = new URL(
      "../../src/installer/step-ops.ts?stories-shared-handler-test=1",
      import.meta.url,
    ).href;
    const { claimStep } = await import(storiesStepOpsUrl) as typeof import("../../src/installer/step-ops.js");
    for (const state of ["starting", "running"] as const) {
      await database.sql`
        UPDATE runtime_sessions SET state=${state},started_at=COALESCE(started_at,NOW())
         WHERE session_id=${runtimeIntent.sessionId}
      `;
      const before = await readSnapshot();
      assert.deepEqual(await claimStep(
        claimAgentId,
        `v3-stories-shared-handler-${state}`,
        runtimeIntent,
      ), { found: false });
      assert.equal(registryHookHit, true);
      assert.equal(process.env.SETFARM_STORIES_SHARED_HANDLER_GET_HIT, "1");
      assert.equal(process.env.SETFARM_STORIES_SHARED_HANDLER_MOCK_HIT, undefined);
      delete process.env.SETFARM_STORIES_SHARED_HANDLER_MOCK_HIT;
      delete process.env.SETFARM_STORIES_SHARED_HANDLER_GET_HIT;
      assert.deepEqual(await readSnapshot(), before);
    }
  } finally {
    hooks.deregister();
    delete process.env.SETFARM_STORIES_SHARED_HANDLER_MOCK_HIT;
    delete process.env.SETFARM_STORIES_SHARED_HANDLER_GET_HIT;
    await runtimeDb?.pgClose();
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
