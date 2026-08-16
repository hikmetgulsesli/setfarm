import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { OperationalFailureCauseError } from "../../src/execution/schemas/operational-failure-cause-v1.js";
import { evaluateOperationalFailureCauseAuthorityV3 } from "../../src/execution/operational-failure-cause-authority-v3.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import type { ClaimContext } from "../../src/installer/steps/types.js";
import {
  SETUP_BUILD_PACKET_OPERATIONAL_FAILURE_CODE_BY_ERROR_CODE_V3,
  setupBuildPacketOperationalFailureCode,
} from "../../src/installer/steps/05-setup-build/preclaim.js";
import { SetupBuildPacketError } from "../../src/product-compiler/setup-build-packet-orchestrator.js";
import { seedCanonicalSetupBuildCompilerStoryAdmissionFixture } from "./helpers/compiler-story-admission-fixture.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("setup-build packet failure map exhaustively authorizes the current producer vocabulary", () => {
  const codes = [
    "SETUP_PACKET_ACTIVATION_REJECTED",
    "SETUP_PACKET_DESIGN_GRAPH_REJECTED",
    "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED",
    "SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED",
    "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
    "SETUP_PACKET_DELIVERY_PROFILE_REJECTED",
    "SETUP_PACKET_ENTRYPOINT_AMBIGUOUS",
    "SETUP_PACKET_ENTRYPOINT_MISSING",
    "SETUP_PACKET_FILE_INVALID",
    "SETUP_PACKET_GENERATED_SOURCE_AMBIGUOUS",
    "SETUP_PACKET_GENERATED_SOURCE_MISSING",
    "SETUP_PACKET_GENERATED_SOURCE_TOPOLOGY_MISSING",
    "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
    "SETUP_PACKET_JSON_INVALID",
    "SETUP_PACKET_PLAN_REJECTED",
    "SETUP_PACKET_PROTOCOL_MISMATCH",
    "SETUP_PACKET_REPO_DIRTY",
    "SETUP_PACKET_REPO_IDENTITY_INVALID",
    "SETUP_PACKET_RUNTIME_EVIDENCE_REJECTED",
    "SETUP_PACKET_RUN_ID_MISMATCH",
    "SETUP_PACKET_SEMANTICS_VERSION_MISMATCH",
    "SETUP_PACKET_SOURCE_NON_CANONICAL",
    "SETUP_PACKET_STORY_PLAN_REJECTED",
    "SETUP_PACKET_TOPOLOGY_OWNER_AMBIGUOUS",
    "SETUP_PACKET_TOPOLOGY_REJECTED",
  ] as const;
  assert.deepEqual(Object.keys(SETUP_BUILD_PACKET_OPERATIONAL_FAILURE_CODE_BY_ERROR_CODE_V3).sort(), [...codes].sort());

  for (const code of codes) {
    const mapped = SETUP_BUILD_PACKET_OPERATIONAL_FAILURE_CODE_BY_ERROR_CODE_V3[code];
    assert.equal(
      setupBuildPacketOperationalFailureCode(new SetupBuildPacketError(code, "test")),
      mapped,
    );
    assert.equal(
      mapped,
      code === "SETUP_PACKET_SEMANTICS_VERSION_MISMATCH"
        ? "SETUP_PACKET_PROTOCOL_MISMATCH"
        : code,
    );
    assert.equal(evaluateOperationalFailureCauseAuthorityV3({
      requestedBy: "setfarm.step-fail.single",
      cause: {
        schema: "setfarm.operational-failure-cause.v1",
        workflowStepId: "setup-build",
        boundary: "product_compiler.setup_build_packet",
        failureClass: "contract_invalid",
        failureCode: mapped,
      },
    }).trusted, true, code);
  }
});

test("v3 setup-build converter reads its machine result instead of classifying process prose", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-setup-cause-"));
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const runId = "run-v3-setup-build-converter-cause";
    const stepDbId = "step-v3-setup-build-converter-cause";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "c".repeat(40);
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

    await assert.rejects(
      preClaim(claimContext),
      (error: unknown) => {
        assert.ok(error instanceof OperationalFailureCauseError, String(error));
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
    await runtimeDb?.pgClose().catch(() => {});
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

test("setup-build executes and returns one exact private converter byte snapshot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-converter-attestation-"));
  try {
    const repo = path.join(root, "repo");
    const scriptPath = path.join(root, "stitch-to-jsx.mjs");
    fs.mkdirSync(repo, { recursive: true });
    const sourceText = [
      'import fs from "node:fs";',
      'import path from "node:path";',
      'const repo = process.argv[2];',
      'fs.writeFileSync(path.join(repo, "converter-marker"), "executed");',
      "",
    ].join("\n");
    fs.writeFileSync(scriptPath, sourceText);
    const { executeAttestedStitchConverter } = await import(
      "../../src/installer/steps/05-setup-build/preclaim.js"
    );

    const source = executeAttestedStitchConverter(scriptPath, repo);

    assert.equal(fs.readFileSync(path.join(repo, "converter-marker"), "utf8"), "executed");
    assert.deepEqual(source, {
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: createHash("sha256").update(Buffer.from(sourceText, "utf8")).digest("hex"),
        mediaType: "text/javascript",
        locator: "scripts/stitch-to-jsx.mjs",
        byteLength: Buffer.byteLength(sourceText),
      },
      text: sourceText,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("setup-build rejects converter release bytes changed during execution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-converter-drift-"));
  try {
    const repo = path.join(root, "repo");
    const scriptPath = path.join(root, "stitch-to-jsx.mjs");
    fs.mkdirSync(repo, { recursive: true });
    fs.writeFileSync(scriptPath, [
      'import fs from "node:fs";',
      `fs.writeFileSync(${JSON.stringify(scriptPath)}, "changed-after-private-copy");`,
      "",
    ].join("\n"));
    const { executeAttestedStitchConverter } = await import(
      "../../src/installer/steps/05-setup-build/preclaim.js"
    );

    assert.throws(
      () => executeAttestedStitchConverter(scriptPath, repo),
      /Release converter source changed while the converter was executing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
