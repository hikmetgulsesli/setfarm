import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dirname, "../workflows/feature-dev/workflow.yml");
const workflowContent = readFileSync(workflowPath, "utf-8");

describe("Review step frontend visual verification", () => {
  it("workflow contains a verify step", () => {
    assert.ok(workflowContent.includes("- id: verify"), "must have verify step");
  });

  it("workflow contains a review agent", () => {
    assert.ok(workflowContent.includes("- id: reviewer"), "must have reviewer agent");
  });

  it("verify step is assigned to reviewer agent", () => {
    const verifyMatch = workflowContent.match(/- id: verify\s+agent: (\w+)/);
    assert.ok(verifyMatch, "verify step must exist");
    assert.equal(verifyMatch[1], "reviewer");
  });

  it("workflow has design step before implement", () => {
    const designIdx = workflowContent.indexOf("- id: design");
    const implIdx = workflowContent.indexOf("- id: implement");
    assert.ok(designIdx > 0, "design step must exist");
    assert.ok(implIdx > designIdx, "implement must come after design");
  });

  it("workflow has security-gate step", () => {
    assert.ok(workflowContent.includes("- id: security-gate"), "must have security-gate step");
  });

  it("workflow has deploy step", () => {
    assert.ok(workflowContent.includes("- id: deploy"), "must have deploy step");
  });

  it("workflow has 8 steps in v11.2 pipeline", () => {
    const stepMatches = workflowContent.match(/^\s+- id: (?!planner|setup|developer|reviewer|tester|security-gate|deployer|designer)\w+/gm);
    // Count steps section entries (after "steps:" heading)
    const stepsSection = workflowContent.split(/^steps:/m)[1];
    const steps = stepsSection?.match(/^\s+- id: \w+/gm) || [];
    assert.equal(steps.length, 8, "should have 8 steps");
  });
});
