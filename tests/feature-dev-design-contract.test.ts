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

  it("preserves generated Stitch anchor structure while fixing placeholder links", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const implement = spec.steps.find(step => step.id === "implement");

    assert.ok(implement, "implement step should exist");
    assert.doesNotMatch(implement.input, /Before commit: grep -rn 'href="#'|EVERY item MUST have a working href/);
    assert.match(implement.input, /Preserve generated Stitch `<a>` tags, className,\s+nesting and layout/);
    assert.match(implement.input, /do not replace anchors with `<span>`/i);
  });

  it("keeps generated shared screens as contracts instead of bulk-read targets", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const implement = spec.steps.find(step => step.id === "implement");

    assert.ok(implement, "implement step should exist");
    assert.match(implement.input, /GENERATED SCREEN CONTRACT/);
    assert.match(implement.input, /do NOT use read, cat, sed,\s+head, tail, rg, grep, find, awk, node, or python on that\s+src\/screens\/\*\.tsx file/i);
    assert.match(implement.input, /Focused line-range inspection is allowed only for generated screen\s+files explicitly listed in SCOPE_FILES/i);
    assert.match(implement.input, /Shared\/read-only generated\s+screens must be consumed through SCREEN_INDEX\/index\.ts and injected\s+contracts only/i);
    assert.doesNotMatch(implement.input, /If exact detail is\s+still needed, inspect one relevant file/i);
    assert.doesNotMatch(implement.input, /Never read every src\/screens\/\*\.tsx file/i);
    assert.match(implement.input, /machine-enforced by the Setfarm spawner/i);
    assert.match(implement.input, /reading a generated\s+`?src\/screens\/\*\.tsx`?\s+file outside SCOPE_FILES kills and retries the claim/i);
    assert.match(implement.input, /Global screen reachability is\s+enforced by verify\/supervisor after merge/i);
    assert.doesNotMatch(implement.input, /If any Stitch screen has NO matching page/);
  });

});
