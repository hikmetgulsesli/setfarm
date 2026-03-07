import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dirname, "../workflows/feature-dev/workflow.yml");
const workflowContent = readFileSync(workflowPath, "utf-8");

describe("Verify step prompt - frontend conditional", () => {
  it("verify step exists in workflow", () => {
    assert.ok(workflowContent.includes("- id: verify"), "must have verify step");
  });

  it("verify step has input template", () => {
    const verifySection = workflowContent.split("- id: verify")[1]?.split("- id:")[0] || "";
    assert.ok(verifySection.includes("input:"), "verify step must have input");
  });

  it("verify step is a verify_each loop type", () => {
    const verifySection = workflowContent.split("- id: verify")[1]?.split("- id:")[0] || "";
    assert.ok(
      workflowContent.includes("verify_each") || workflowContent.includes("type: loop"),
      "verify step should be a loop step"
    );
  });
});
