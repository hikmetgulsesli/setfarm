import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";

const WORKFLOW_DIR = path.resolve(import.meta.dirname, "..", "workflows", "feature-dev");

describe("feature-dev design contract prompt", () => {
  it("does not instruct implement agents to use Material Symbols icon fonts", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const implement = spec.steps.find(step => step.id === "implement");

    assert.ok(implement, "implement step should exist");
    assert.doesNotMatch(implement.input, /Material\+Symbols\+Outlined|fonts\.googleapis\.com\/css2\?family=Material/i);
    assert.doesNotMatch(implement.input, /YOU MUST add this to index\.html.*Material Symbols/is);
    assert.match(implement.input, /Do NOT add Material Symbols/);
    assert.match(implement.input, /replace them in source UI with inline\s+SVG components or an already-installed SVG icon library/);
  });
});
