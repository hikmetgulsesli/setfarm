import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { qaTestModule } from "../../dist/installer/steps/09-qa-test/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/09-qa-test/guards.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

describe("09-qa-test step module", () => {
  it("module metadata is correct", () => {
    assert.equal(qaTestModule.id, "qa-test");
    assert.equal(qaTestModule.type, "single");
    assert.equal(qaTestModule.agentRole, "qa-tester");
    assert.equal(qaTestModule.maxPromptSize, 12288);
    assert.deepEqual(qaTestModule.requiredOutputFields, ["STATUS"]);
  });

  it("injectContext is a no-op", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await qaTestModule.injectContext({ runId: "r1", stepId: "qa-test", task: "t", context });
    assert.deepEqual(context, { foo: "bar" });
  });

  it("buildPrompt substitutes REPO/BRANCH/STORIES_JSON/FINAL_PR", () => {
    const prompt = qaTestModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/app",
        branch: "feature-app",
        stories_json: '[{"id":"US-001"}]',
        pr_url: "https://github.com/u/r/pull/9",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/app"));
    assert.ok(prompt.includes("feature-app"));
    assert.ok(prompt.includes("pull/9"));
    assert.ok(prompt.includes("happy path"));
    assert.ok(prompt.includes("Kurallar"));
  });

  it("buildPrompt within maxPromptSize", () => {
    const prompt = qaTestModule.buildPrompt({ runId: "r1", task: "t", context: { repo: "$HOME/x" } });
    assert.ok(Buffer.byteLength(prompt, "utf-8") < qaTestModule.maxPromptSize);
  });

  it("validateOutput rejects missing STATUS", () => {
    assert.equal(validateOutput({} as ParsedOutput).ok, false);
  });

  it("validateOutput accepts STATUS: done|skip", () => {
    assert.equal(validateOutput({ status: "done" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts retry without extra fields (enforcement upstream in step-ops)", () => {
    assert.equal(validateOutput({ status: "retry" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", test_failures: "x" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects unknown STATUS", () => {
    assert.equal(validateOutput({ status: "tested" } as ParsedOutput).ok, false);
  });

  it("normalize first-word lowercase", () => {
    const parsed = { status: "RETRY\ntest_failures: counter broken" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "retry");
  });
});
