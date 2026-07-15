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

test("v3 setup-build converter reads its machine result instead of classifying process prose", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-setup-cause-"));
  try {
    const runId = "run-v3-setup-build-converter-cause";
    const stepDbId = "step-v3-setup-build-converter-cause";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "c".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'Compile malformed Stitch input', 'running',
        ${JSON.stringify({ repo })}, 'v3', ${releaseSha}, ${"d".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    fs.mkdirSync(path.join(repo, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({
      name: "setup-cause-fixture",
      version: "1.0.0",
      type: "module",
      scripts: { build: "node -e \"process.exit(0)\"" },
    }));
    fs.writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), "{ malformed-json\n");

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
      task: "Compile malformed Stitch input",
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
        assert.ok(error instanceof OperationalFailureCauseError);
        assert.deepEqual(error.failureCause, {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId: "setup-build",
          boundary: "stitch.converter.input_contract",
          failureClass: "contract_invalid",
          failureCode: "STITCH_DESIGN_MANIFEST_JSON_INVALID",
        });
        return true;
      },
    );
    assert.equal(context.failure_category, "design_import_failure");
    assert.match(context.baseline_fail ?? "", /stitch-to-jsx failed/);
  } finally {
    await rm(repo, { recursive: true, force: true });
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});

test("v3 setup-build requires the exact converter passed artifact after exit zero", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-setup-result-contract-"));
  try {
    const { stitchConverterSuccessContractFailure } = await import(
      "../../src/installer/steps/05-setup-build/preclaim.js"
    );
    const missing = stitchConverterSuccessContractFailure(repo);
    assert.equal(missing?.cause.failureCode, "STITCH_CONVERTER_RESULT_MISSING");

    const resultPath = path.join(repo, ".setfarm", "setup", "STITCH_TO_JSX_RESULT.json");
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, JSON.stringify({
      schema: "setfarm.stitch-to-jsx-result.v1",
      status: "passed",
      diagnostic: "forbidden volatile output",
    }));
    const malformed = stitchConverterSuccessContractFailure(repo);
    assert.equal(malformed?.cause.failureCode, "STITCH_CONVERTER_RESULT_INVALID");

    fs.writeFileSync(resultPath, JSON.stringify({
      schema: "setfarm.stitch-to-jsx-result.v1",
      status: "passed",
    }));
    assert.equal(stitchConverterSuccessContractFailure(repo), undefined);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
