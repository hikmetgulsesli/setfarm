import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { OperationalFailureCauseError } from "../../src/execution/schemas/operational-failure-cause-v1.js";
import { evaluateOperationalFailureCauseAuthorityV1 } from "../../src/execution/operational-failure-cause-authority-v1.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import type { ClaimContext } from "../../src/installer/steps/types.js";
import { seedCanonicalSetupBuildCompilerStoryAdmissionFixture } from "./helpers/compiler-story-admission-fixture.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 setup-build does not invent a typed cause for a generic build exit", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-setup-untyped-build-"));
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const runId = "run-v3-setup-build-untyped-exit";
    const stepDbId = "step-v3-setup-build-untyped-exit";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "b".repeat(40);
    const admission = await seedCanonicalSetupBuildCompilerStoryAdmissionFixture(database, {
      runId,
      repo,
      setupBuildStepDbId: stepDbId,
      setupBuildClaimAgentId: claimAgentId,
      releaseSha,
    });
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
      claimId: admission.claimId,
      claimAgentId,
      runtimeAgentId: claimAgentId,
    };
    const context: Record<string, string> = {
      ...admission.context,
      stack_pack_id: "vite-react-web-app",
      tech_stack: "vite-react",
      task: admission.task,
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

    const missingSemanticsContext: ClaimContext = {
      ...claimContext,
      context: Object.fromEntries(
        Object.entries(context).filter(([key]) => key !== "product_semantics_version"),
      ),
    };
    await assert.rejects(
      preClaim(missingSemanticsContext),
      (error: unknown) => {
        assert.equal(error instanceof OperationalFailureCauseError, true, String(error));
        if (!(error instanceof OperationalFailureCauseError)) return false;
        assert.match(error.message, /SETUP_PACKET_SEMANTICS_VERSION_MISMATCH/);
        assert.deepEqual(error.failureCause, {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId: "setup-build",
          boundary: "product_compiler.setup_build_packet",
          failureClass: "contract_invalid",
          failureCode: "SETUP_PACKET_PROTOCOL_MISMATCH",
        });
        assert.deepEqual(evaluateOperationalFailureCauseAuthorityV1({
          requestedBy: "setfarm.step-fail.single",
          cause: error.failureCause,
        }), { trusted: true, cause: error.failureCause });
        return true;
      },
    );

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
    await runtimeDb?.pgClose().catch(() => {});
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
