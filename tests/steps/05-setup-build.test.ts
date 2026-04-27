import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { setupBuildModule } from "../../dist/installer/steps/05-setup-build/module.js";
import { onComplete } from "../../dist/installer/steps/05-setup-build/guards.js";
import type { ParsedOutput, CompleteContext } from "../../dist/installer/steps/types.js";

describe("05-setup-build step module", () => {
  it("module metadata is correct", () => {
    assert.equal(setupBuildModule.id, "setup-build");
    assert.equal(setupBuildModule.type, "single");
    assert.equal(setupBuildModule.agentRole, "setup-build");
    assert.equal(setupBuildModule.maxPromptSize, 6144);
    assert.deepEqual(setupBuildModule.requiredOutputFields, ["STATUS"]);
    assert.ok(typeof setupBuildModule.preClaim === "function");
  });

  it("buildPrompt substitutes REPO/TECH_STACK/BUILD_CMD_HINT from context", () => {
    const prompt = setupBuildModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/testapp-12345",
        tech_stack: "vite-react",
        build_cmd_hint: "npm run build",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/testapp-12345"));
    assert.ok(prompt.includes("vite-react"));
    assert.ok(prompt.includes("npm run build"));
    assert.ok(prompt.includes("Kurallar"));
  });

  it("buildPrompt stays within maxPromptSize for typical inputs", () => {
    const prompt = setupBuildModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { repo: "$HOME/projects/app", tech_stack: "vite-react" },
    });
    assert.ok(
      Buffer.byteLength(prompt, "utf-8") < setupBuildModule.maxPromptSize,
      `prompt ${Buffer.byteLength(prompt, "utf-8")} >= budget ${setupBuildModule.maxPromptSize}`
    );
  });

  it("validateOutput requires STATUS: done", () => {
    assert.equal(setupBuildModule.validateOutput({ status: "done" } as ParsedOutput).ok, true);
    assert.equal(setupBuildModule.validateOutput({ status: "retry" } as ParsedOutput).ok, false);
    assert.equal(setupBuildModule.validateOutput({} as ParsedOutput).ok, false);
  });

  it("does not add a second Tailwind/Vite integration after setup-build", () => {
    const stepOps = fs.readFileSync("src/installer/step-ops.ts", "utf-8");
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    const guardrails = fs.readFileSync("src/installer/step-guardrails.ts", "utf-8");
    assert.equal(stepOps.includes("@tailwindcss/vite"), false, "setup-build completion should not mutate Vite/Tailwind after preclaim build checks");
    assert.ok(preclaim.includes("tailwindcss@^3.4.19"), "missing Tailwind setup should use the v3 PostCSS baseline");
    assert.ok(guardrails.includes("tailwindcss@^3.4.19"), "late Tailwind guardrails should use the same v3 PostCSS baseline");
    assert.ok(guardrails.includes("tailwindcss: {}"), "late PostCSS fallback should not generate a Tailwind v4 plugin config");
  });

  it("records actionable process stderr when setup-build preclaim fails", () => {
    const preclaim = fs.readFileSync("src/installer/steps/05-setup-build/preclaim.ts", "utf-8");
    assert.ok(preclaim.includes("formatProcessFailure"), "preclaim should preserve stdout/stderr from failed commands");
    assert.ok(preclaim.includes("stderr:"), "preclaim failures should include stderr labels");
    assert.ok(preclaim.includes("npm run build failed after stitch-to-jsx:\\n"), "post-stitch build failures should keep the real compiler output");
  });

  it("onComplete stamps build_cmd from parsed output", async () => {
    const context: Record<string, string> = {};
    const ctx: CompleteContext = {
      runId: "r1",
      stepId: "setup-build",
      parsed: { status: "done", build_cmd: "pnpm run build" } as ParsedOutput,
      context,
    };
    await onComplete(ctx);
    assert.equal(context["build_cmd"], "pnpm run build");
  });

  it("onComplete falls back to build_cmd_hint when parsed.build_cmd missing", async () => {
    const context: Record<string, string> = { build_cmd_hint: "yarn build" };
    await onComplete({
      runId: "r1",
      stepId: "setup-build",
      parsed: { status: "done" } as ParsedOutput,
      context,
    });
    assert.equal(context["build_cmd"], "yarn build");
  });

  it("onComplete final fallback is 'npm run build'", async () => {
    const context: Record<string, string> = {};
    await onComplete({
      runId: "r1",
      stepId: "setup-build",
      parsed: { status: "done" } as ParsedOutput,
      context,
    });
    assert.equal(context["build_cmd"], "npm run build");
  });

  it("onComplete throws when compat_fail flag is present", async () => {
    const context: Record<string, string> = { compat_fail: "nextjs not supported" };
    await assert.rejects(
      onComplete({
        runId: "r1",
        stepId: "setup-build",
        parsed: { status: "done" } as ParsedOutput,
        context,
      }),
      /COMPAT: nextjs not supported/
    );
  });

  it("onComplete throws when baseline_fail flag is present", async () => {
    const context: Record<string, string> = { baseline_fail: "Module not found: react-router-dom" };
    await assert.rejects(
      onComplete({
        runId: "r1",
        stepId: "setup-build",
        parsed: { status: "done" } as ParsedOutput,
        context,
      }),
      /BASELINE: npm run build failed/
    );
  });
});
