import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import path from "node:path";

describe("Verifier AGENTS.md browser verification section", () => {
  it("feature-dev v11.2 uses reviewer for verify step (verifier agent removed)", async () => {
    const spec = await loadWorkflowSpec(path.resolve("workflows/feature-dev"));
    const verifyStep = spec.steps.find((s) => s.id === "verify");
    assert.ok(verifyStep, "verify step should exist");
    assert.equal(verifyStep.agent, "reviewer", "verify step should use reviewer agent");
  });

  it("verify step exists in the pipeline", async () => {
    const spec = await loadWorkflowSpec(path.resolve("workflows/feature-dev"));
    const stepIds = spec.steps.map((s) => s.id);
    assert.ok(stepIds.includes("verify"), "verify step must exist");
  });
});
