import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import path from "node:path";

describe("polling timeout sync across all workflows", () => {
  it("bug-fix workflow polling.timeoutSeconds matches workflow.yml", async () => {
    const spec = await loadWorkflowSpec(path.resolve("workflows", "bug-fix"));
    assert.equal(spec.polling?.timeoutSeconds, 1800);
    assert.equal(spec.polling?.model, "default");
  });

  it("bug-fix workflow has correct agent count", async () => {
    const spec = await loadWorkflowSpec(path.resolve("workflows", "bug-fix"));
    assert.equal(spec.agents.length, 6);
  });

  it("feature-dev workflow polling.timeoutSeconds matches workflow.yml", async () => {
    const spec = await loadWorkflowSpec(path.resolve("workflows", "feature-dev"));
    assert.equal(spec.polling?.timeoutSeconds, 1800);
  });

  it("feature-dev workflow polling.model is kimi-coding/k2p5", async () => {
    const spec = await loadWorkflowSpec(path.resolve("workflows", "feature-dev"));
    assert.equal(spec.polling?.model, "kimi-coding/k2p5");
  });

  it("security-audit workflow polling.timeoutSeconds matches workflow.yml", async () => {
    const spec = await loadWorkflowSpec(path.resolve("workflows", "security-audit"));
    assert.equal(spec.polling?.timeoutSeconds, 1800);
    assert.equal(spec.polling?.model, "default");
  });
});
