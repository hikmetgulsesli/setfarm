import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 platform preclaim fails closed when another termination cause already owns the run", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-preclaim-race-"));
  try {
    const runId = "run-v3-platform-preclaim-existing-termination";
    const stepDbId = "step-v3-platform-preclaim-existing-termination";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "f".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    fs.mkdirSync(path.join(repo, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({
      name: "preclaim-termination-race-fixture",
      version: "1.0.0",
      type: "module",
      scripts: { build: "node -e \"process.exit(0)\"" },
    }));
    fs.writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), "{ malformed-json\n");
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'Prove preclaim termination conflict fencing', 'running',
        ${JSON.stringify({
          repo,
          stack_pack_id: "vite-react-web-app",
          tech_stack: "vite-react",
          task: "Prove preclaim termination conflict fencing",
        })}, 'v3', ${releaseSha}, ${"a".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${stepDbId}, ${runId}, 'setup-build', ${claimAgentId}, 5, '', '',
        'running', 'single', 0, 3
      )
    `;
    await database.sql`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${runId}, 'setup-build', NULL, ${claimAgentId})
    `;
    const existingCause = {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "setup-build",
      boundary: "product_compiler.setup_build_packet",
      failureClass: "contract_invalid",
      failureCode: "SETUP_PACKET_DESIGN_GRAPH_REJECTED",
    } as const;
    await database.sql.unsafe(
      `INSERT INTO run_termination_requests (
         request_id, run_id, target_status, state, requested_by,
         requested_at, diagnostic, evidence
       ) VALUES (
         'RTR_v3-preclaim-existing-cause', $1, 'failed', 'requested',
         'setfarm.step-fail.single', NOW(), 'existing authoritative failure',
         $2::text::jsonb
       )`,
      [runId, JSON.stringify({ operationalFailureCause: existingCause })],
    );

    const { claimStep } = await import("../../src/installer/step-ops.js");
    await assert.rejects(
      claimStep(claimAgentId, "v3-platform-preclaim-existing-termination"),
      (error: unknown) => {
        assert.equal(
          (error as Error).name,
          "V3PlatformPreclaimLifecycleError",
          `unexpected preclaim race error: ${String(error)}`,
        );
        assert.match(
          String(error),
          /V3_PLATFORM_PRECLAIM_LIFECYCLE_FAILED:.*CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:run_termination:requested:/,
        );
        return true;
      },
    );

    const rows = await database.sql<Array<{
      step_status: string;
      claim_outcome: string | null;
      claim_count: number;
      completion_count: number;
      termination_count: number;
      termination_evidence: Record<string, unknown>;
    }>>`
      SELECT step.status AS step_status,
             claim.outcome AS claim_outcome,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claim_count,
             (SELECT COUNT(*)::integer FROM runtime_completion_requests WHERE run_id = ${runId}) AS completion_count,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count,
             termination.evidence AS termination_evidence
        FROM steps step
        JOIN claim_log claim
          ON claim.run_id = step.run_id
         AND claim.step_id = step.step_id
         AND claim.story_id IS NULL
        JOIN run_termination_requests termination ON termination.run_id = step.run_id
       WHERE step.id = ${stepDbId}
    `;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.step_status, "running", "the rejected lifecycle transaction must roll back");
    assert.equal(rows[0]!.claim_outcome, null, "no false terminal claim may be published");
    assert.equal(rows[0]!.claim_count, 1, "the claim is not silently redispatched");
    assert.equal(rows[0]!.completion_count, 0, "no model runtime was created");
    assert.equal(rows[0]!.termination_count, 1, "the first termination owner stays unique");
    assert.deepEqual(rows[0]!.termination_evidence.operationalFailureCause, existingCause);
  } finally {
    await rm(repo, { recursive: true, force: true });
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
