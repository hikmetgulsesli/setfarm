import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import path from "node:path";

const workflows = ["bug-fix", "feature-dev", "security-audit"];

describe("polling timeout consistency across all workflows", () => {
  it("all workflows with polling have timeoutSeconds >= 60", async () => {
    for (const wf of workflows) {
      const spec = await loadWorkflowSpec(path.resolve("workflows", wf));
      if (spec.polling) {
        assert.ok(spec.polling.timeoutSeconds >= 60, `${wf} timeout should be >= 60`);
      }
    }
  });

  it("bug-fix, feature-dev, and security-audit all use 1800s timeout", async () => {
    for (const wf of workflows) {
      const spec = await loadWorkflowSpec(path.resolve("workflows", wf));
      assert.equal(spec.polling?.timeoutSeconds, 1800, `${wf} should use 1800s`);
    }
  });
});
