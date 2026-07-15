import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { OperationalFailureCauseError } from "../../src/execution/schemas/operational-failure-cause-v1.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import type { ClaimContext } from "../../src/installer/steps/types.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 setup-build does not invent a typed cause for a generic build exit", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-setup-untyped-build-"));
  try {
    const runId = "run-v3-setup-build-untyped-exit";
    const stepDbId = "step-v3-setup-build-untyped-exit";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "b".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'Do not attribute an unproven build failure', 'running',
        ${JSON.stringify({ repo })}, 'v3', ${releaseSha}, ${"c".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    fs.mkdirSync(path.join(repo, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({
      name: "setup-untyped-build-fixture",
      version: "1.0.0",
      type: "module",
      scripts: { build: "node -e \"process.exit(23)\"" },
    }));
    fs.writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), "[]\n");

    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-15T12:00:00.000Z",
      stepId: stepDbId,
      workflowStepId: "setup-build",
      runId,
      claimId: 1,
      claimAgentId,
      runtimeAgentId: claimAgentId,
    };
    const context: Record<string, string> = {
      repo,
      stack_pack_id: "vite-react-web-app",
      tech_stack: "vite-react",
      task: "Do not attribute an unproven build failure",
    };
    const claimContext: ClaimContext = {
      runId,
      stepId: "setup-build",
      task: context.task!,
      retryCount: 0,
      context,
      claimEnvelope: envelope,
    };
    const { preClaim } = await import("../../src/installer/steps/05-setup-build/preclaim.js");

    await assert.rejects(
      preClaim(claimContext),
      (error: unknown) => {
        assert.equal(error instanceof OperationalFailureCauseError, false);
        assert.equal((error as Error).name, "SetupBuildPreclaimError");
        assert.match(String(error), /npm run build failed after stitch-to-jsx/);
        return true;
      },
    );
    assert.equal(context.failure_category, "setup_build_failure");
    assert.match(context.failure_suggestion ?? "", /did not prove ownership/);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(
        path.join(repo, ".setfarm", "setup", "STITCH_TO_JSX_RESULT.json"),
        "utf8",
      )),
      { schema: "setfarm.stitch-to-jsx-result.v1", status: "passed" },
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
