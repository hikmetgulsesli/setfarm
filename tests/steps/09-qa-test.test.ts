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
    assert.equal(qaTestModule.preClaim, undefined);
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
    assert.ok(prompt.includes("quality-reports/qa-test-1.md"));
    assert.ok(prompt.includes("Route/link gezintisi"));
    assert.ok(prompt.includes("Kurallar"));
  });

  it("buildPrompt within maxPromptSize", () => {
    const prompt = qaTestModule.buildPrompt({ runId: "r1", task: "t", context: { repo: "$HOME/x" } });
    assert.ok(Buffer.byteLength(prompt, "utf-8") < qaTestModule.maxPromptSize);
  });

  it("validateOutput rejects missing STATUS", () => {
    assert.equal(validateOutput({} as ParsedOutput).ok, false);
  });

  it("validateOutput rejects STATUS: done without QA evidence", () => {
    const r = validateOutput({ status: "done" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("QA_REPORT")));
  });

  it("validateOutput accepts STATUS: done with QA evidence", () => {
    assert.equal(validateOutput({
      status: "done",
      qa_report: "quality-reports/qa-test-1.md",
      qa_screens_tested: "4",
      qa_routes_tested: "3",
      qa_interactions_tested: "12",
      qa_total_issues: "0",
    } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects done with positive issue count", () => {
    const r = validateOutput({
      status: "done",
      qa_report: "quality-reports/qa-test-1.md",
      qa_screens_tested: "4",
      qa_routes_tested: "3",
      qa_interactions_tested: "12",
      qa_total_issues: "1",
    } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("QA_TOTAL_ISSUES")));
  });

  it("validateOutput requires skip reason", () => {
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, false);
    assert.equal(validateOutput({ status: "skip", skip_reason: "Not a browser app" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects retry without batched findings", () => {
    const r = validateOutput({ status: "retry" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("batched QA findings")));
  });

  it("validateOutput accepts retry with batched findings", () => {
    assert.equal(validateOutput({ status: "retry", qa_report: "quality-reports/qa-test-1.md", test_failures: "x" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", qa_report_path: "quality-reports/qa-test-1.md", issues: "x", qa_total_issues: "2" } as ParsedOutput).ok, true);
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
