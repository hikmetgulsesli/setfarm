import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { seedCanonicalSetupBuildCompilerStoryAdmissionFixture } from "./helpers/compiler-story-admission-fixture.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("claimStep publishes one normal v3 platform-preclaim terminal transition", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-preclaim-normal-"));
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const runId = "run-v3-platform-preclaim-normal";
    const stepDbId = "step-v3-platform-preclaim-normal";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "9".repeat(40);
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
    assert.deepEqual(
      await claimStep(claimAgentId, "v3-platform-preclaim-normal"),
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
    }>>`
      SELECT run_row.status AS run_status,
             step.status AS step_status,
             claim.outcome AS claim_outcome,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claim_count,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count,
             termination.state AS termination_state,
             termination.requested_by,
             termination.evidence
        FROM runs run_row
        JOIN steps step ON step.id = ${stepDbId}
        JOIN claim_log claim ON claim.id = ${admission.claimId}
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
    assert.deepEqual(
      await claimStep(claimAgentId, "v3-platform-preclaim-normal-replay"),
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
