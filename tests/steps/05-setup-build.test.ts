import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
