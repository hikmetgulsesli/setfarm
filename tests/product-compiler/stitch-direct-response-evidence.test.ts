import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StitchDirectResponseEvidenceV1Schema } from "../../src/product-compiler/schemas/stitch-direct-response-evidence-v1.js";

function evidence() {
  return {
    schema: "setfarm.stitch-direct-response-evidence.v1",
    projectId: "project-1",
    batches: [{
      stageId: "stage-001",
      targetRefs: ["TARGET_STATUS"],
      source: "direct",
      candidates: [{
        screenId: "screen-status",
        title: "Status Page - Status Utility",
        responsePaths: ["$result.structuredContent.outputComponents[2].design.screens[0]"],
        width: "2560",
        height: "2048",
        htmlAvailable: true,
        screenshotAvailable: true,
        disposition: "admitted_renderable_screen",
        missingEvidence: [],
      }, {
        screenId: "screen-shader",
        title: "Shader",
        responsePaths: ["$result.structuredContent.outputComponents[1].design.screens[0]"],
        width: "512",
        height: "512",
        htmlAvailable: true,
        screenshotAvailable: false,
        disposition: "excluded_missing_render_evidence",
        missingEvidence: ["screenshot"],
      }],
    }],
  };
}

describe("Stitch direct response evidence v1", () => {
  it("preserves admitted UI and excluded code canvas provenance", () => {
    const parsed = StitchDirectResponseEvidenceV1Schema.parse(evidence());
    assert.equal(parsed.batches[0]?.candidates[0]?.disposition, "admitted_renderable_screen");
    assert.deepEqual(parsed.batches[0]?.candidates[1]?.missingEvidence, ["screenshot"]);
  });

  it("rejects disposition not derived from render evidence", () => {
    const candidate = evidence();
    candidate.batches[0]!.candidates[1]!.disposition = "admitted_renderable_screen";
    assert.equal(StitchDirectResponseEvidenceV1Schema.safeParse(candidate).success, false);
  });

  it("rejects duplicate candidate identity across stages", () => {
    const candidate = evidence();
    candidate.batches.push({
      stageId: "stage-002",
      targetRefs: ["TARGET_OTHER"],
      source: "direct",
      candidates: [{ ...candidate.batches[0]!.candidates[0]! }],
    });
    assert.equal(StitchDirectResponseEvidenceV1Schema.safeParse(candidate).success, false);
  });
});
