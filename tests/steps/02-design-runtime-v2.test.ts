import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ensureStitchProjectIdentityV2,
  generateStitchStageOnceWithExecutorForInternalTestV2,
} from "../../src/installer/steps/02-design/runtime-v2.js";
import { resolvePlatformScript } from "../../src/installer/paths.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { canonicalStitchStageProviderRejectionV1 } from
  "../../src/product-compiler/stitch-stage-provider-rejection-v1.js";

async function sourceTypeScriptFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceTypeScriptFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(absolute);
    }
  }
  return files;
}

test("bootstraps Stitch identity from an existing cwd when the generated repo is absent", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "setfarm-design-bootstrap-"));
  const repo = path.join(root, "missing", "generated-repo");
  try {
    await assert.rejects(access(repo));

    const projectId = await ensureStitchProjectIdentityV2({
      repo,
      projectName: "Status Utility",
    }, {
      executeStitch: async (input) => {
        assert.equal(input.cwd, path.dirname(resolvePlatformScript("stitch-api.mjs")));
        assert.equal((await stat(input.cwd)).isDirectory(), true);
        await assert.rejects(access(repo));
        assert.deepEqual(input.args, ["ensure-project-identity", "Status Utility", repo]);
        return JSON.stringify({
          schema: "setfarm.stitch-project-identity.v1",
          projectId: "project-123",
          name: "Status Utility",
          source: "created",
        });
      },
    });

    assert.equal(projectId, "project-123");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("maps only an exact provider rejection with no local output to infrastructure failure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "setfarm-design-provider-rejection-"));
  const diagnostic = "Request contains an invalid argument";
  const stderr = `${canonicalStitchStageProviderRejectionV1({
    schema: "setfarm.stitch-stage-provider-rejection.v1",
    classification: "explicit_mcp_error_before_accepted_result",
    tool: "generate_screen_from_text",
    isError: true,
    acceptedResult: false,
    acceptedScreenIds: [],
    acceptedArtifactLocators: [],
    diagnosticCode: "STITCH_MCP_TOOL_ERROR",
    diagnostic,
    diagnosticHash: hashCanonicalJson({
      schema: "setfarm.stitch-stage-provider-rejection-diagnostic.v1",
      diagnostic,
    }),
  })}\n`;
  const input = {
    repo: root,
    projectId: "project-123",
    stageId: "DSGS_001",
    prompt: "Generate the exact target",
    deviceType: "DESKTOP" as const,
    model: "GEMINI_3_1_PRO",
    signal: new AbortController().signal,
  };
  try {
    const result = await generateStitchStageOnceWithExecutorForInternalTestV2(
      input,
      async () => ({ termination: "exit", exitCode: 1, stdout: "", stderr }),
    );
    assert.equal(result.disposition, "infrastructure_failure");
    if (result.disposition !== "infrastructure_failure") return;
    assert.deepEqual(result.failure.reasonCodes, [
      "DESIGN_SOURCE_PROVIDER_REJECTED_BEFORE_ACCEPTANCE",
    ]);
    assert.deepEqual(
      (result.failure.evidence as { failedStageIds: string[] }).failedStageIds,
      ["DSGS_001"],
    );

    await assert.rejects(
      generateStitchStageOnceWithExecutorForInternalTestV2(input, async (execution) => {
        const outputDir = execution.args[3]!;
        await mkdir(outputDir, { recursive: true });
        await writeFile(path.join(outputDir, "unexpected.html"), "unexpected", "utf8");
        return { termination: "exit", exitCode: 1, stdout: "", stderr };
      }),
      /DESIGN_SOURCE_PROVIDER_REJECTION_LOCAL_OUTPUT_PRESENT/,
    );

    await assert.rejects(
      generateStitchStageOnceWithExecutorForInternalTestV2(
        input,
        async () => ({ termination: "ambiguous", exitCode: 1, stdout: "", stderr }),
      ),
      /STITCH_CHILD_EXECUTION_AMBIGUOUS/,
    );

    const continuationSecret = "FAKE_SECRET_CONTINUATION_999";
    await assert.rejects(
      generateStitchStageOnceWithExecutorForInternalTestV2(
        input,
        async () => ({
          termination: "exit",
          exitCode: 1,
          stdout: "",
          stderr: `Authorization=[REDACTED]\n${continuationSecret}\n`,
        }),
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "STITCH_CHILD_PROVIDER_REJECTION_ENVELOPE_INVALID");
        assert.doesNotMatch(error.message, new RegExp(continuationSecret));
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps the injectable Stitch executor test-only and production on the zero-override wrapper", async () => {
  const sourceRoot = path.resolve("src");
  const internalSymbol = "generateStitchStageOnceWithExecutorForInternalTestV2";
  const importers: string[] = [];
  for (const file of await sourceTypeScriptFiles(sourceRoot)) {
    if ((await readFile(file, "utf8")).includes(internalSymbol)) {
      importers.push(path.relative(process.cwd(), file));
    }
  }
  assert.deepEqual(importers, ["src/installer/steps/02-design/runtime-v2.ts"]);

  const runtimeSource = await readFile(
    path.join(sourceRoot, "installer", "steps", "02-design", "runtime-v2.ts"),
    "utf8",
  );
  assert.match(
    runtimeSource,
    /const generateStage = dependencies\.generateStage \?\? generateStitchStageOnceV2;/,
  );
});
