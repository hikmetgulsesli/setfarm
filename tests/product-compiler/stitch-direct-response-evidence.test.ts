import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StitchDirectResponseEvidenceV1Schema } from "../../src/product-compiler/schemas/stitch-direct-response-evidence-v1.js";
import { StitchDirectResponseEvidenceV2Schema } from "../../src/product-compiler/schemas/stitch-direct-response-evidence-v2.js";
import { parseStitchDirectResponseEvidence } from "../../src/product-compiler/compatibility/stitch-direct-response-evidence.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

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

function evidenceV2() {
  const value: any = structuredClone(evidence());
  value.schema = "setfarm.stitch-direct-response-evidence.v2";
  for (const candidate of value.batches[0].candidates) {
    candidate.identityConflicts = [];
    if (candidate.htmlAvailable) candidate.htmlSourceRefHash = "a".repeat(64);
    if (candidate.screenshotAvailable) candidate.screenshotSourceRefHash = "b".repeat(64);
  }
  return value;
}

describe("Stitch direct response evidence v1", () => {
  it("preserves admitted UI and excluded code canvas provenance", () => {
    const parsed = StitchDirectResponseEvidenceV1Schema.parse(evidence());
    assert.equal(parsed.batches[0]?.candidates[0]?.disposition, "admitted_renderable_screen");
    assert.deepEqual(parsed.batches[0]?.candidates[1]?.missingEvidence, ["screenshot"]);
    assert.equal(hashCanonicalJson(parsed), "0d2394a0300ff610bb56b23daed5be3a4e3010a048ff023654ee8eb29c9071a9");
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

  it("keeps v1 frozen and rejects v2-only conflict fields", () => {
    const candidate: any = evidence();
    candidate.batches[0].candidates[0].identityConflicts = [];
    assert.equal(StitchDirectResponseEvidenceV1Schema.safeParse(candidate).success, false);
  });

  it("preserves a same-ID response identity conflict in v2 evidence", () => {
    const candidate = evidenceV2();
    const conflicted = candidate.batches[0]!.candidates[0]! as any;
    conflicted.identityConflicts = ["title", "html_url"];
    conflicted.disposition = "excluded_identity_conflict";
    const parsed = StitchDirectResponseEvidenceV2Schema.parse(candidate);
    assert.deepEqual(parsed.batches[0]!.candidates[0]!.identityConflicts, ["title", "html_url"]);
  });

  it("preserves the full v2 conflict vocabulary including an unsafe observed ID", () => {
    const candidate = evidenceV2();
    const conflicted = candidate.batches[0]!.candidates[0]! as any;
    conflicted.screenId = "../unsafe";
    conflicted.identityConflicts = [
      "title",
      "html_url",
      "screenshot_url",
      "width",
      "height",
      "screen_id",
      "render_evidence_splice",
    ];
    conflicted.disposition = "excluded_identity_conflict";
    const parsed = StitchDirectResponseEvidenceV2Schema.parse(candidate);
    assert.equal(parsed.batches[0]!.candidates[0]!.screenId, "../unsafe");
    assert.equal(parsed.batches[0]!.candidates[0]!.identityConflicts?.length, 7);
  });

  it("parses v1 and v2 only at the compatibility boundary without fabricating receipts", () => {
    const parsedV1 = parseStitchDirectResponseEvidence(evidence());
    const parsedV2 = parseStitchDirectResponseEvidence(evidenceV2());
    const unknown = parseStitchDirectResponseEvidence({ ...evidence(), schema: "setfarm.stitch-direct-response-evidence.v3" });
    assert.equal(parsedV1.status, "parsed");
    assert.equal(parsedV2.status, "parsed");
    assert.equal(unknown.status, "rejected");
    if (parsedV1.status !== "parsed" || parsedV2.status !== "parsed") return;
    assert.equal(parsedV1.sourceVersion, "v1");
    assert.equal(parsedV1.capabilities.attemptBoundDownloadReceipts, false);
    assert.equal(parsedV1.normalized.batches[0]!.candidates[0]!.htmlDownloadedArtifactHash, null);
    assert.equal(parsedV2.sourceVersion, "v2");
    assert.equal(parsedV2.capabilities.identityConflictEvidence, true);
  });
});
