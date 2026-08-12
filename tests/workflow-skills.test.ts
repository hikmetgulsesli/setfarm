import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkflowSpec } from "../src/installer/workflow-spec.js";
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

  it("scopes installed skills to setup-build and implement agents", async () => {
    const spec = await loadWorkflowSpec(featureDevDir);
    const setupBuild = spec.agents.find((a) => a.id === "setup-build");
    const developer = spec.agents.find((a) => a.id === "developer");
    const setupRepo = spec.agents.find((a) => a.id === "setup-repo");

    assert.deepEqual(setupBuild?.workspace.skills, [
      "diagnosing-bugs",
      "systematic-debugging",
      "verification-before-completion",
      "setup-auditor",
      "dependency-auditor",
    ]);
    assert.deepEqual(developer?.workspace.skills, [
      "implement",
      "systematic-debugging",
      "verification-before-completion",
      "receiving-code-review",
      "code-review",
    ]);
    assert.equal(setupRepo?.workspace.skills, undefined, "setup-repo should not inherit setup-build skill config");
  });
});
