import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 single-step unresolved input terminalizes atomically and rolls back as one owner", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const previousDbPath = process.env.SETFARM_DB_PATH;
  const runtimeDir = mkdtempSync(join(tmpdir(), "setfarm-v3-stage-input-"));
  process.env.SETFARM_DB_PATH = join(runtimeDir, "setfarm.db");
  const database = await createIsolatedTestDatabase();
  try {
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const successRunId = "run-v3-stage-input-success";
    const rollbackRunId = "run-v3-stage-input-rollback";
    const legacyRunId = "run-legacy-stage-input-retry";
    const successStepId = "step-v3-stage-input-success";
    const rollbackStepId = "step-v3-stage-input-rollback";
    const legacyStepId = "step-legacy-stage-input-retry";
    const successAgent = "feature-dev_stage-input-success";
    const rollbackAgent = "feature-dev_stage-input-rollback";
    const legacyAgent = "feature-dev_stage-input-legacy";

    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${successRunId}, 'feature-dev', 'Reject unresolved stage input', 'running',
        ${JSON.stringify({ task: "Reject unresolved stage input" })}, 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash}
      ), (
        ${rollbackRunId}, 'feature-dev', 'Rollback unresolved stage input', 'running',
        ${JSON.stringify({ task: "Rollback unresolved stage input" })}, 'v3',
        ${releaseSha}, ${"f".repeat(64)}, ${releaseAdmissionHash}
      ), (
        ${legacyRunId}, 'feature-dev', 'Preserve legacy unresolved input retry', 'running',
        ${JSON.stringify({ task: "Preserve legacy unresolved input retry" })}, 'legacy',
        NULL, NULL, NULL
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${successStepId}, ${successRunId}, 'contract-stage', ${successAgent}, 1,
        'Build from {{missing_required_contract}}', '', 'pending', 'single', 0, 3
      ), (
        ${rollbackStepId}, ${rollbackRunId}, 'contract-stage', ${rollbackAgent}, 1,
        'Build from {{missing_required_contract}}', '', 'pending', 'single', 0, 3
      ), (
        ${legacyStepId}, ${legacyRunId}, 'contract-stage', ${legacyAgent}, 1,
        'Build from {{missing_required_contract}}', '', 'pending', 'single', 0, 3
      )
    `;

    // Single-step publication has no compiler attempt of its own today. This
    // fixture binds one exact active attempt at claim insert so the common
    // pre-dispatch authority must close claim + attempt + runtime together.
    await database.sql.unsafe(`
      CREATE FUNCTION bind_v3_stage_input_attempt() RETURNS trigger AS $$
      BEGIN
        IF NEW.run_id IN ('${successRunId}', '${rollbackRunId}') THEN
          INSERT INTO execution_attempts (
            attempt_id, run_id, step_id, story_id, generation, fence_token,
            attempt_class, compilation_report_hash, source_before_sha,
            source_before_tree_hash, role, agent_id, lease_acquired_at,
            lease_expires_at, heartbeat_at, disposition, evidence_refs, claim_id
          ) VALUES (
            'ATT_' || NEW.run_id, NEW.run_id, NEW.step_id, '', 1, repeat('a', 64),
            'infrastructure_retry', repeat('b', 64), repeat('c', 40),
            repeat('d', 64), 'builder', NEW.agent_id, NOW(),
            NOW() + INTERVAL '5 minutes', NOW(), 'claimed', '[]', NEW.id
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER bind_v3_stage_input_attempt_after_claim
        AFTER INSERT ON claim_log
        FOR EACH ROW EXECUTE FUNCTION bind_v3_stage_input_attempt();
    `);

    const { claimStep } = await import("../../src/installer/step-ops.js");
    const success = await claimStep(successAgent, undefined, {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_v3-stage-input-success-owner",
      runtimeAgentId: "stage-input-success-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "spawner-stage-input-success",
    });
    assert.deepEqual(success, { found: false });

    const successRows = await database.sql<Array<{
      run_status: string;
      step_status: string;
      step_output: string;
      retry_count: number;
      claim_outcome: string | null;
      claim_diagnostic: string | null;
      abandoned_at: Date | null;
      attempt_disposition: string;
      runtime_state: string;
      termination_state: string;
      requested_by: string;
      termination_evidence: Record<string, unknown>;
      completion_count: number;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             step.output AS step_output,
             step.retry_count,
             claim.outcome AS claim_outcome,
             claim.diagnostic AS claim_diagnostic,
             claim.abandoned_at,
             attempt.disposition AS attempt_disposition,
             runtime.state AS runtime_state,
             termination.state AS termination_state,
             termination.requested_by,
             termination.evidence AS termination_evidence,
             (SELECT COUNT(*)::integer FROM runtime_completion_requests completion
               WHERE completion.run_id = run.id) AS completion_count
        FROM runs run
        JOIN steps step ON step.id = ${successStepId}
        JOIN claim_log claim ON claim.run_id = run.id AND claim.step_id = step.step_id
        JOIN execution_attempts attempt ON attempt.claim_id = claim.id
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN run_termination_requests termination ON termination.run_id = run.id
       WHERE run.id = ${successRunId}
    `;
    const terminal = successRows[0]!;
    assert.equal(terminal.run_status, "failing");
    assert.equal(terminal.step_status, "failed");
    assert.equal(terminal.retry_count, 0, "unchanged v3 input must not consume a model retry");
    assert.match(terminal.step_output, /^V3_STAGE_INPUT_UNRESOLVED:/);
    assert.equal(terminal.claim_outcome, "failed");
    assert.equal(terminal.claim_diagnostic, terminal.step_output);
    assert.ok(terminal.abandoned_at);
    assert.equal(terminal.attempt_disposition, "inconclusive");
    assert.equal(terminal.runtime_state, "released");
    assert.equal(terminal.termination_state, "requested");
    assert.equal(terminal.requested_by, "setfarm.v3-stage-input-authority");
    assert.deepEqual(terminal.termination_evidence.missingVariables, ["missing_required_contract"]);
    assert.equal(terminal.termination_evidence.modelRedispatchBudget, 0);
    assert.equal(
      terminal.termination_evidence.operationalFailureCause,
      undefined,
      "custom workflow stages remain terminal but cannot impersonate canonical repeatable causes",
    );
    assert.equal(terminal.completion_count, 0);

    const legacy = await claimStep(legacyAgent, undefined, {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_legacy-stage-input-retry-owner",
      runtimeAgentId: "stage-input-legacy-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "spawner-stage-input-legacy",
    });
    assert.deepEqual(legacy, { found: false });
    const legacyRows = await database.sql<Array<{
      run_status: string;
      step_status: string;
      retry_count: number;
      claim_outcome: string | null;
      runtime_state: string;
      termination_count: number;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             step.retry_count,
             claim.outcome AS claim_outcome,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM run_termination_requests termination
               WHERE termination.run_id = run.id) AS termination_count
        FROM runs run
        JOIN steps step ON step.id = ${legacyStepId}
        JOIN claim_log claim ON claim.run_id = run.id AND claim.step_id = step.step_id
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
       WHERE run.id = ${legacyRunId}
    `;
    assert.deepEqual({ ...legacyRows[0] }, {
      run_status: "running",
      step_status: "pending",
      retry_count: 1,
      claim_outcome: "infra_retry",
      runtime_state: "released",
      termination_count: 0,
    });

    await database.sql.unsafe(`
      CREATE FUNCTION reject_v3_stage_input_terminal_step() RETURNS trigger AS $$
      BEGIN
        IF OLD.id = '${rollbackStepId}' AND NEW.status = 'failed' THEN
          RAISE EXCEPTION 'INJECTED_V3_STAGE_INPUT_STEP_FAILURE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_v3_stage_input_terminal_step_update
        BEFORE UPDATE ON steps
        FOR EACH ROW EXECUTE FUNCTION reject_v3_stage_input_terminal_step();
    `);

    await assert.rejects(
      claimStep(rollbackAgent, undefined, {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-stage-input-rollback-owner",
        runtimeAgentId: "stage-input-rollback-runtime",
        runtimeKind: "local_process",
        ownerInstanceId: "spawner-stage-input-rollback",
      }),
      /INJECTED_V3_STAGE_INPUT_STEP_FAILURE/,
    );

    const rollbackRows = await database.sql<Array<{
      run_status: string;
      step_status: string;
      step_output: string | null;
      retry_count: number;
      claim_outcome: string | null;
      claim_diagnostic: string | null;
      abandoned_at: Date | null;
      attempt_disposition: string;
      runtime_state: string;
      termination_count: number;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             step.output AS step_output,
             step.retry_count,
             claim.outcome AS claim_outcome,
             claim.diagnostic AS claim_diagnostic,
             claim.abandoned_at,
             attempt.disposition AS attempt_disposition,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM run_termination_requests termination
               WHERE termination.run_id = run.id) AS termination_count
        FROM runs run
        JOIN steps step ON step.id = ${rollbackStepId}
        JOIN claim_log claim ON claim.run_id = run.id AND claim.step_id = step.step_id
        JOIN execution_attempts attempt ON attempt.claim_id = claim.id
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
       WHERE run.id = ${rollbackRunId}
    `;
    assert.deepEqual({ ...rollbackRows[0] }, {
      run_status: "running",
      step_status: "running",
      step_output: null,
      retry_count: 0,
      claim_outcome: null,
      claim_diagnostic: null,
      abandoned_at: null,
      attempt_disposition: "claimed",
      runtime_state: "reserved",
      termination_count: 0,
    });
  } finally {
    await database.cleanup();
    rmSync(runtimeDir, { recursive: true, force: true });
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
    if (previousDbPath === undefined) delete process.env.SETFARM_DB_PATH;
    else process.env.SETFARM_DB_PATH = previousDbPath;
  }
});
