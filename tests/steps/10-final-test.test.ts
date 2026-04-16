import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { finalTestModule } from "../../dist/installer/steps/10-final-test/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/10-final-test/guards.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

describe("10-final-test step module", () => {
  it("module metadata", () => {
    assert.equal(finalTestModule.id, "final-test");
    assert.equal(finalTestModule.type, "single");
    assert.equal(finalTestModule.agentRole, "tester");
    assert.equal(finalTestModule.maxPromptSize, 12288);
  });

  it("injectContext is a no-op", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await finalTestModule.injectContext({ runId: "r1", stepId: "final-test", task: "t", context });
    assert.deepEqual(context, { foo: "bar" });
  });

  it("buildPrompt substitutes REPO/BRANCH/FINAL_PR/STORIES_JSON", () => {
    const prompt = finalTestModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/app-12345",
        branch: "feature-app",
        final_pr: "https://github.com/u/r/pull/3",
        stories_json: '[{"id":"US-001"}]',
      },
    });
    assert.ok(prompt.includes("app-12345"));
    assert.ok(prompt.includes("smoke-test.mjs"));
    assert.ok(prompt.includes("Phase 16"));
    assert.ok(prompt.includes("Kurallar"));
  });

  it("buildPrompt stays within maxPromptSize", () => {
    const prompt = finalTestModule.buildPrompt({ runId: "r1", task: "t", context: {} });
    assert.ok(Buffer.byteLength(prompt, "utf-8") < finalTestModule.maxPromptSize);
  });

  it("validateOutput rejects missing STATUS", () => {
    assert.equal(validateOutput({} as ParsedOutput).ok, false);
  });

  it("validateOutput accepts STATUS: done/skip", () => {
    assert.equal(validateOutput({ status: "done" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, true);
  });

  it("validateOutput requires test_failures/feedback/issues/smoke for retry", () => {
    const r1 = validateOutput({ status: "retry" } as ParsedOutput);
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some(e => e.includes("TEST_FAILURES")));

    assert.equal(validateOutput({ status: "retry", test_failures: "Phase 3 build fail" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", smoke_test_result: "fail: Phase 8" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", feedback: "tsc errors" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects unknown STATUS", () => {
    assert.equal(validateOutput({ status: "tested" } as ParsedOutput).ok, false);
  });

  it("normalize first-word lowercase", () => {
    const parsed = { status: "DONE\nsmoke_test_result: pass" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });
});
