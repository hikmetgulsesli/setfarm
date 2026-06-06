import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { securityGateModule } from "../../dist/installer/steps/08-security-gate/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/08-security-gate/guards.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

describe("08-security-gate step module", () => {
  it("module metadata is correct", () => {
    assert.equal(securityGateModule.id, "security-gate");
    assert.equal(securityGateModule.type, "single");
    assert.equal(securityGateModule.agentRole, "security-gate");
    assert.equal(securityGateModule.maxPromptSize, 12288);
    assert.deepEqual(securityGateModule.requiredOutputFields, ["STATUS"]);
  });

  it("injectContext adds stack evidence context", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await securityGateModule.injectContext({
      runId: "r1", stepId: "security-gate", task: "t", context,
    });
    assert.equal(context.foo, "bar");
    assert.equal(context.stack_pack_id, "needs-reconcile");
    assert.match(context.stack_contract, /Schema: setfarm\.stack-contract\.v1/);
    assert.match(context.stack_verification_contract, /no stack-specific verification/i);
  });

  it("buildPrompt substitutes REPO/BRANCH/FINAL_PR/STORIES_JSON", () => {
    const prompt = securityGateModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/counter-12345",
        branch: "feature-counter",
        final_pr: "https://github.com/u/r/pull/7",
        stories_json: '[{"id":"US-001"}]',
      },
    });
    assert.ok(prompt.includes("$HOME/projects/counter-12345"));
    assert.ok(prompt.includes("feature-counter"));
    assert.ok(prompt.includes("pull/7"));
    assert.ok(prompt.includes("OWASP"));
    assert.ok(prompt.includes("Rules"));
  });

  it("buildPrompt stays within maxPromptSize", () => {
    const prompt = securityGateModule.buildPrompt({ runId: "r1", task: "t", context: { repo: "$HOME/x" } });
    assert.ok(Buffer.byteLength(prompt, "utf-8") < securityGateModule.maxPromptSize);
  });

  it("validateOutput rejects missing STATUS", () => {
    const r = validateOutput({} as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("STATUS")));
  });

  it("validateOutput accepts STATUS: done", () => {
    assert.equal(validateOutput({ status: "done" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts retry/fail without extra fields (enforcement upstream in step-ops)", () => {
    assert.equal(validateOutput({ status: "retry" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "fail" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects unknown STATUS", () => {
    const r = validateOutput({ status: "vulnerable" } as ParsedOutput);
    assert.equal(r.ok, false);
  });

  it("normalize first-word lowercase", () => {
    const parsed = { status: "DONE\nNo issues found" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });
});
