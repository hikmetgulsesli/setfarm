import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import path from "node:path";

describe("workflow-spec skills parsing", () => {
  const featureDevDir = path.resolve("workflows/feature-dev");

  it("parses reviewer agent", async () => {
    const spec = await loadWorkflowSpec(featureDevDir);
    const reviewer = spec.agents.find((a) => a.id === "reviewer");
    assert.ok(reviewer, "reviewer agent should exist");
  });

  it("parses designer agent", async () => {
    const spec = await loadWorkflowSpec(featureDevDir);
    const designer = spec.agents.find((a) => a.id === "designer");
    assert.ok(designer, "designer agent should exist");
  });

  it("agents without skills have no skills field", async () => {
    const spec = await loadWorkflowSpec(featureDevDir);
    const planner = spec.agents.find((a) => a.id === "planner");
    assert.ok(planner, "planner agent should exist");
    assert.equal(planner.workspace?.skills, undefined, "planner should not have skills");
  });
});
