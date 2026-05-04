import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isVerifyRetryQualityFailure } from "../dist/installer/verify-retry-routing.js";

describe("verify retry routing", () => {
  it("routes actionable verify retry reports back to implement", () => {
    const output = [
      "STATUS: retry",
      "FEEDBACK:",
      "- smoke-test still fails: heading-skip (h1->h3).",
      "- low-contrast precision_manufacturingOp icon (2.6:1).",
      "- dead-button dashboardPanorama.",
      "- AcilDurumPaneli.tsx.bak remains in worktree.",
    ].join("\n");

    assert.equal(isVerifyRetryQualityFailure(output), true);
  });

  it("routes visual, route, and interaction failures back to implement", () => {
    const output = [
      "STATUS: retry",
      "ISSUES:",
      "- Trash link navigates to the wrong route.",
      "- Button click does not open the dialog.",
      "- Screenshot shows layout overlap on desktop.",
    ].join("\n");

    assert.equal(isVerifyRetryQualityFailure(output), true);
  });

  it("does not route pure PR merge waiting back to implement", () => {
    const output = [
      "STATUS: retry",
      "FEEDBACK:",
      "- PR is still open.",
      "- Merge check is pending; no application defect found.",
    ].join("\n");

    assert.equal(isVerifyRetryQualityFailure(output), false);
  });

  it("does not route narrative without STATUS retry", () => {
    assert.equal(isVerifyRetryQualityFailure("smoke-test failed but no status line"), false);
  });

  it("preserves explicit system smoke routing", () => {
    assert.equal(isVerifyRetryQualityFailure("SYSTEM_SMOKE_FAILURE:\nblank page after load"), true);
  });
});
