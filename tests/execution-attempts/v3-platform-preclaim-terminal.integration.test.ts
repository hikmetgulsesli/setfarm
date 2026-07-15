import assert from "node:assert/strict";
import { test } from "node:test";

import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 platform preclaim failure terminalizes without model retry authority", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  try {
    const runId = "run-v3-platform-preclaim-terminal";
    const stepDbId = "step-v3-platform-preclaim-terminal";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'Compile the exact setup packet', 'running',
        ${JSON.stringify({ task: "Compile the exact setup packet" })}, 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${stepDbId}, ${runId}, 'setup-build', ${claimAgentId}, 5, '', '',
        'running', 'single', 0, 3
      ), (
        'step-v3-platform-preclaim-implement', ${runId}, 'implement', 'feature-dev_developer', 6, '', '',
        'waiting', 'loop', 0, 3
      )
    `;
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${runId}, 'setup-build', NULL, ${claimAgentId})
      RETURNING id::integer AS id
    `;
    const claimId = claims[0]!.id;
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-15T12:00:00.000Z",
      stepId: stepDbId,
      workflowStepId: "setup-build",
      runId,
      claimId,
      claimAgentId,
      runtimeAgentId: claimAgentId,
    };

    const { failStep } = await import("../../src/installer/step-fail.js");
    const result = await failStep(
      stepDbId,
      "PRODUCT_BUILD_PACKET_V3_BLOCKED: DESIGN_CONTROL_INDEX_INCOMPLETE",
      envelope,
      { singleStepMode: "terminal_platform_preclaim" },
    );
    assert.deepEqual(result, { retrying: false, runFailed: true });

    const rows = await database.sql<Array<{
      step_status: string;
      retry_count: number;
      max_retries: number;
      claim_outcome: string;
      claim_diagnostic: string;
      run_status: string;
      completion_count: number;
      claim_count: number;
      termination_state: string;
      termination_evidence: Record<string, unknown>;
      implement_status: string;
    }>>`
      SELECT step.status AS step_status,
             step.retry_count,
             step.max_retries,
             claim.outcome AS claim_outcome,
             claim.diagnostic AS claim_diagnostic,
             run.status AS run_status,
             (SELECT COUNT(*)::integer FROM runtime_completion_requests WHERE run_id = run.id) AS completion_count,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
             termination.state AS termination_state,
             termination.evidence AS termination_evidence,
             implement.status AS implement_status
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
        JOIN steps implement ON implement.id = 'step-v3-platform-preclaim-implement'
        JOIN claim_log claim ON claim.id = ${claimId}
        JOIN run_termination_requests termination ON termination.run_id = run.id
       WHERE run.id = ${runId}
    `;
    const owner = rows[0]!;
    assert.equal(owner.step_status, "failed");
    assert.equal(owner.retry_count, 0);
    assert.equal(owner.max_retries, 3, "platform terminalization must not rewrite configured stage retry budgets");
    assert.equal(owner.claim_outcome, "failed");
    assert.match(owner.claim_diagnostic, /^PLATFORM_PRECLAIM_TERMINAL \[setup-build\]:/);
    assert.equal(owner.run_status, "failing", "the termination ledger owns the final failed transition");
    assert.equal(owner.completion_count, 0, "preclaim failure has no model completion request");
    assert.equal(owner.claim_count, 1, "unchanged platform source must not be sent to another model claim");
    assert.equal(owner.termination_state, "requested");
    assert.equal(owner.termination_evidence.failureOwner, "platform_preclaim");
    assert.equal(owner.termination_evidence.retryPolicy, "terminal");
    assert.equal(owner.implement_status, "waiting");

    const retry = await (await import("../../src/installer/step-ops.js")).claimStep(
      claimAgentId,
      "v3-platform-preclaim-retry-forbidden",
    );
    assert.deepEqual(retry, { found: false });
    const counts = await database.sql<Array<{ claim_count: number; source_unavailable_count: number }>>`
      SELECT COUNT(*)::integer AS claim_count,
             COUNT(*) FILTER (WHERE diagnostic LIKE 'V3_STAGE_RETRY_SOURCE_UNAVAILABLE%')::integer AS source_unavailable_count
        FROM claim_log
       WHERE run_id = ${runId}
    `;
    assert.deepEqual({ ...counts[0] }, { claim_count: 1, source_unavailable_count: 0 });
  } finally {
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
