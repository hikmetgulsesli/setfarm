import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isVerifyRetryInfraFailure, isVerifyRetryMergeBlocker, isVerifyRetryQualityFailure } from "../dist/installer/verify-retry-routing.js";

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

  it("does not route browser infrastructure retries back to implement", () => {
    const output = [
      "STATUS: retry",
      "FINDINGS:",
      "- Mobile visual QA remains blocked: Error: page.evaluate: Target page, context or browser has been closed.",
      "- agent-browser click '[data-action-id=\"queue-2\"]' hung and exited -1, while DOM element.click() changed route to queue.",
    ].join("\n");

    assert.equal(isVerifyRetryInfraFailure(output), true);
    assert.equal(isVerifyRetryQualityFailure(output), false);
    assert.equal(isVerifyRetryMergeBlocker(output), false);
  });

  it("treats visual QA browser helper reference errors as infrastructure retries", () => {
    const output = [
      "STATUS: retry",
      "FINDINGS:",
      "- Supervisor visual QA report shows blocker navigation_error on desktop /: page.evaluate ReferenceError: isTilingBackgroundRepeat is not defined.",
      "- Same report shows blocker navigation_error on mobile / with the same isTilingBackgroundRepeat ReferenceError.",
    ].join("\n");

    assert.equal(isVerifyRetryInfraFailure(output), true);
    assert.equal(isVerifyRetryQualityFailure(output), false);
    assert.equal(isVerifyRetryMergeBlocker(output), false);
  });

  it("routes blocking review comments about functional defects back to implement", () => {
    const output = [
      "STATUS: retry",
      "FEEDBACK:",
      "- 5 review comments not addressed: form init, mode prop, status preservation, onEdit handler, unused props.",
    ].join("\n");

    assert.equal(isVerifyRetryQualityFailure(output), true);
    assert.equal(isVerifyRetryMergeBlocker(output), false);
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

  it("classifies unmergeable PR retry reports separately from QA-FIX", () => {
    const output = [
      "STATUS: retry",
      "FEEDBACK:",
      "- PR #2 is CONFLICTING/DIRTY: merge conflicts in src/hooks/useAppState.ts.",
      "- Resolve conflict markers before rerunning verify.",
    ].join("\n");

    assert.equal(isVerifyRetryQualityFailure(output), true);
    assert.equal(isVerifyRetryMergeBlocker(output), true);
  });

  it("does not classify normal app quality retry reports as merge blockers", () => {
    const output = [
      "STATUS: retry",
      "FEEDBACK:",
      "- Screenshot shows the profile drawer overlapping the dashboard.",
      "- Button click does not open the create dialog.",
    ].join("\n");

    assert.equal(isVerifyRetryQualityFailure(output), true);
    assert.equal(isVerifyRetryMergeBlocker(output), false);
  });

  it("routes mixed quality findings with PR dirty notes back to implement", () => {
    const output = [
      "STATUS: retry",
      "FEEDBACK:",
      "- src/screens/YeniGorevEkleDuzenle.tsx:105 — UNRESOLVED: new Date(estimatedStart).toISOString() still introduces a timezone shift bug.",
      "- PR merge state: CONFLICTING / DIRTY — must be resolved before merge.",
      "- npm run build passes.",
    ].join("\n");

    assert.equal(isVerifyRetryQualityFailure(output), true);
    assert.equal(isVerifyRetryMergeBlocker(output), false);
  });
});
