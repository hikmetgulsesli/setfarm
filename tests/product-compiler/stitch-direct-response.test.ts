import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decodeStitchDirectBatchV2 } from "../../src/product-compiler/producers/stitch-direct-response.js";

const admitted = {
  screenId: "screen-status",
  title: "Status Page - Status Utility",
  responsePaths: ["$result.structuredContent.outputComponents[2].design.screens[0]"],
  width: "2560",
  height: "2048",
  htmlAvailable: true,
  screenshotAvailable: true,
  htmlSourceRefHash: "a".repeat(64),
  screenshotSourceRefHash: "b".repeat(64),
  identityConflicts: [],
  disposition: "admitted_renderable_screen",
  missingEvidence: [],
};

const helper = {
  screenId: "screen-three",
  title: "Three.js",
  responsePaths: ["$result.structuredContent.outputComponents[0].design.screens[0]"],
  width: "512",
  height: "512",
  htmlAvailable: true,
  screenshotAvailable: false,
  htmlSourceRefHash: "c".repeat(64),
  identityConflicts: [],
  disposition: "excluded_missing_render_evidence",
  missingEvidence: ["screenshot"],
};

function decode(result: Record<string, unknown>) {
  return decodeStitchDirectBatchV2({
    stageId: "stage-001",
    targetRefs: ["TARGET_STATUS"],
    result: {
      directScreenEvidenceSchema: "setfarm.stitch-direct-screen-evidence.v2",
      ...result,
    },
  });
}

describe("v3 Stitch direct batch decoder", () => {
  it("rejects transport output that does not declare direct evidence v2", () => {
    const result = decodeStitchDirectBatchV2({
      stageId: "stage-001",
      targetRefs: ["TARGET_STATUS"],
      result: {
        total: 1,
        screenSource: "direct",
        screens: [{ screenId: admitted.screenId, title: admitted.title }],
        directScreenEvidence: [admitted],
      },
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.code, "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID");
    assert.match(result.diagnostic, /transport discriminator/);
  });

  it("binds only renderable direct candidates and preserves excluded evidence", () => {
    const result = decode({
      total: 1,
      screenSource: "direct",
      screens: [{ screenId: admitted.screenId, title: admitted.title }],
      directScreenEvidence: [helper, admitted],
    });
    assert.equal(result.status, "decoded");
    if (result.status !== "decoded") return;
    assert.deepEqual(result.batch.screens, [{ screenId: admitted.screenId, title: admitted.title }]);
    assert.equal(result.evidenceBatch.candidates.length, 2);
  });

  it("does not use expected target titles as a decoder classifier", () => {
    const extra = { ...admitted, screenId: "screen-extra", title: "Unexpected Real Canvas" };
    const result = decode({
      total: 2,
      screenSource: "direct",
      screens: [
        { screenId: admitted.screenId, title: admitted.title },
        { screenId: extra.screenId, title: extra.title },
      ],
      directScreenEvidence: [admitted, extra],
    });
    assert.equal(result.status, "decoded");
    if (result.status !== "decoded") return;
    assert.equal(result.batch.screens.length, 2);
  });

  it("preserves distinct direct candidates that share one provider title", () => {
    const variant = { ...admitted, screenId: "screen-status-variant" };
    const result = decode({
      total: 2,
      screenSource: "direct",
      screens: [
        { screenId: admitted.screenId, title: admitted.title },
        { screenId: variant.screenId, title: variant.title },
      ],
      directScreenEvidence: [admitted, variant],
    });
    assert.equal(result.status, "decoded");
    if (result.status !== "decoded") return;
    assert.deepEqual(result.batch.screens.map((screen) => screen.screenId), [
      admitted.screenId,
      variant.screenId,
    ]);
  });

  it("rejects reported screens that are not backed by admitted evidence", () => {
    const result = decode({
      total: 1,
      screenSource: "direct",
      screens: [{ screenId: "invented", title: admitted.title }],
      directScreenEvidence: [helper, admitted],
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.code, "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH");
  });

  it("classifies helper-only direct responses as missing renderable product evidence", () => {
    const result = decode({
      total: 0,
      screenSource: "direct",
      screens: [],
      directScreenEvidence: [helper],
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.code, "DESIGN_V3_RENDERABLE_SCREEN_MISSING");
    assert.equal(result.evidenceBatch?.candidates[0]?.screenId, helper.screenId);
  });

  it("rejects a same-ID response identity conflict before renderable selection", () => {
    const conflicted = {
      ...admitted,
      identityConflicts: ["title"],
      disposition: "excluded_identity_conflict",
    };
    const result = decode({
      total: 0,
      screenSource: "direct",
      screens: [],
      directScreenEvidence: [conflicted],
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.code, "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH");
    assert.match(result.diagnostic, /conflicting fields/);
  });

  it("retains an unsafe provider identity in excluded decoder evidence", () => {
    const conflicted = {
      ...admitted,
      screenId: "../unsafe",
      identityConflicts: ["screen_id"],
      disposition: "excluded_identity_conflict",
    };
    const result = decode({
      total: 0,
      screenSource: "direct",
      screens: [],
      directScreenEvidence: [conflicted],
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.code, "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH");
    assert.equal(result.evidenceBatch?.candidates[0]?.screenId, "../unsafe");
    assert.deepEqual(result.evidenceBatch?.candidates[0]?.identityConflicts, ["screen_id"]);
  });

  it("rejects fallback discovery while retaining direct candidate evidence", () => {
    const result = decode({
      total: 1,
      screenSource: "fallback_list",
      screens: [{ screenId: admitted.screenId, title: admitted.title }],
      directScreenEvidence: [helper],
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.code, "DESIGN_V3_RESPONSE_SOURCE_INVALID");
    assert.equal(result.evidenceBatch?.candidates[0]?.screenId, helper.screenId);
  });
});
