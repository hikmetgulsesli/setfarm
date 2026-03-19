import path from "node:path";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const WORKFLOW_DIR = path.resolve(import.meta.dirname, "..", "workflows", "feature-dev");

describe("feature-dev workflow polling config", () => {
  it("has a polling section with model and timeoutSeconds", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    assert.ok(spec.polling, "polling config should exist");
    assert.equal(spec.polling.model, "minimax/MiniMax-M2.7");
    assert.equal(spec.polling.timeoutSeconds, 1800);
  });

  it("still has all expected agents", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const ids = spec.agents.map((a) => a.id);
    assert.deepEqual(ids, ["planner", "setup-repo", "setup-build", "developer", "reviewer", "tester", "security-gate", "qa-tester", "deployer", "designer"]);
  });

  it("still has all expected steps", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const stepIds = spec.steps.map((s) => s.id);
    assert.deepEqual(stepIds, ["plan", "design", "stories", "setup-repo", "setup-build", "implement", "verify", "security-gate", "qa-test", "final-test", "deploy"]);
  });

  it("workflow id and version are unchanged", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    assert.equal(spec.id, "feature-dev");
    assert.equal(spec.version, 12);
  });
});
