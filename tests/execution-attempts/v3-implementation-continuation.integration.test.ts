import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { RuntimeCompletionPlanV1Schema } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 effect resume fails closed when caller omits durable binding identity", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-continuation-"));
  try {
    const { resumeRuntimeCompletionEffects } = await import("../../src/installer/step-ops.js");
    const runId = "run-v3-canonical-continuation";
    const stepDbId = "step-v3-canonical-continuation";
    const acceptedStoryDbId = "story-v3-canonical-accepted";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, packet_hash,
        release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'canonical continuation', 'running', ${JSON.stringify({ repo: repoRoot })}, 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${"a".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, loop_config, current_story_id
      ) VALUES (
        ${stepDbId}, ${runId}, 'implement', 'developer', 1, '', '', 'running', 'loop',
        '{"over":"stories","superviseEach":true,"superviseStep":"supervise","verifyEach":true,"verifyStep":"verify"}',
        NULL
      ), (
        'step-v3-canonical-supervise', ${runId}, 'supervise', 'supervisor', 2, '', '', 'waiting', 'single', NULL, NULL
      ), (
        'step-v3-canonical-verify', ${runId}, 'verify', 'reviewer', 3, '', '', 'waiting', 'single', NULL, NULL
      )
    `;
    await database.sql`
      INSERT INTO stories (
        id, run_id, story_index, story_id, title, status, story_branch
      ) VALUES (
        ${acceptedStoryDbId}, ${runId}, 1, 'US-001', 'Canonical accepted story', 'done', 'run-v3-us-001'
      ), (
        'story-v3-canonical-pending', ${runId}, 2, 'US-002', 'Next story', 'pending', 'run-v3-us-002'
      )
    `;
    const plan = RuntimeCompletionPlanV1Schema.parse({
      schema: "setfarm.runtime-completion-plan.v1",
      planVersion: 1,
      requestId: "RCR_v3-canonical-continuation-0001",
      claimId: 701,
      runId,
      stepDbId,
      workflowStepId: "implement",
      outputHash: "f".repeat(64),
      kind: "story_completion",
      continuation: { type: "story_direct_merge" },
      subject: {
        storyDbId: acceptedStoryDbId,
        storyId: "US-001",
        sourceSha: "1".repeat(40),
      },
      effects: [{
        effectKey: "v3/canonical/accepted/us-001",
        ordinal: 0,
        effectType: "v3.recovery.coordinate",
        mandatory: true,
        payload: {},
      }],
      preparedAt: new Date().toISOString(),
    });
    await assert.rejects(
      resumeRuntimeCompletionEffects({
        runId,
        stepDbId,
        workflowStepId: "implement",
        output: JSON.stringify({ summary: "STATUS: retry and dangerous prose are inert" }),
        storyDbId: acceptedStoryDbId,
        storyId: "US-001",
        completionPlan: plan,
      }),
      /V3_STORY_COMPLETION_EFFECT_BINDING_IDENTITY_REQUIRED/,
    );
    const state = await database.sql<Array<{
      implement_status: string;
      supervise_status: string;
      verify_status: string;
      pending_status: string;
    }>>`
      SELECT implement.status AS implement_status,
             supervise.status AS supervise_status,
             verify.status AS verify_status,
             pending.status AS pending_status
        FROM steps implement
        JOIN steps supervise ON supervise.id = 'step-v3-canonical-supervise'
        JOIN steps verify ON verify.id = 'step-v3-canonical-verify'
        JOIN stories pending ON pending.id = 'story-v3-canonical-pending'
       WHERE implement.id = ${stepDbId}
    `;
    assert.deepEqual({ ...state[0] }, {
      implement_status: "running",
      supervise_status: "waiting",
      verify_status: "waiting",
      pending_status: "pending",
    });
    assert.equal(fs.existsSync(path.join(repoRoot, "PROJECT_MEMORY.md")), false);
    assert.equal(fs.existsSync(path.join(repoRoot, "CLAUDE.md")), false);
  } finally {
    await database.cleanup();
    fs.rmSync(repoRoot, { recursive: true, force: true });
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
