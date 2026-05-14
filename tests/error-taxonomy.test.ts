import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyError, sanitizeDesignMismatchFeedback } from "../dist/installer/error-taxonomy.js";

describe("error taxonomy", () => {
  it("preserves explicit implement guard categories before generic missing-input matching", () => {
    const runtimeBridge = classifyError(
      "RUNTIME_BRIDGE_MISSING: Story US-001 acceptance criteria require window.app, but no scoped source file assigns it.",
    );
    assert.equal(runtimeBridge.category, "RUNTIME_BRIDGE_MISSING");
    assert.match(runtimeBridge.suggestion, /window\.app/);

    const testFailed = classifyError(
      "TEST_FAILED: Story US-001 reported STATUS: done but its touched test files fail under npm run test:run.",
    );
    assert.equal(testFailed.category, "TEST_FAILED");

    const buildFailed = classifyError(
      "BUILD_FAILED: Story US-001 reported STATUS: done but npm run build failed.",
    );
    assert.equal(buildFailed.category, "BUILD_FAILED");
  });

  it("keeps design mismatch suggestions specific to reported UI contract failures", () => {
    const classified = classifyError([
      "DESIGN UYUMSUZLUK:",
      "src/screens/GameBoard.tsx:145 — UI_CONTRACT: Material Symbols/icon fonts are not allowed",
      "src/screens/GameBoard.tsx:164 — UI_CONTRACT: blanket transition-all is not allowed",
    ].join("\n"));

    assert.equal(classified.category, "DESIGN_MISMATCH");
    assert.match(classified.suggestion, /inline SVG components/);
    assert.match(classified.suggestion, /scoped transition properties/);
    assert.doesNotMatch(classified.suggestion, /design-tokens\.css|hardcoded colors/);
  });

  it("classifies runtime supervisor guard failures before generic killed/crash text", () => {
    const git = classifyError(
      "GIT_DISCIPLINE_VIOLATION: feature-dev_developer ran agent-side staging (git add -A). Runtime supervisor killed the claim before unmanaged staging could be accepted.",
    );
    assert.equal(git.category, "GIT_DISCIPLINE");
    assert.match(git.suggestion, /Setfarm stage|Setfarm.*commit|Setfarm.*push/i);
    assert.doesNotMatch(git.suggestion, /memory/i);

    const generated = classifyError(
      "GENERATED_SCREEN_SHARED_READ: feature-dev_developer used read on src/screens/MainMenu.tsx. Setfarm killed the claim before generated-screen context overload.",
    );
    assert.equal(generated.category, "GENERATED_SCREEN_SHARED_READ");
    assert.match(generated.suggestion, /SCREEN_INDEX\.json/);

    const product = classifyError(
      "GUARDRAIL [product-supervisor:implement]: IMPLEMENT_NO_DELTA: US-001 reported done but supervisor found no changed files.",
    );
    assert.equal(product.category, "PRODUCT_SUPERVISOR_BLOCKED");
  });

  it("rewrites stale generic design mismatch feedback before retry prompts reuse it", () => {
    const feedback = sanitizeDesignMismatchFeedback([
      "DESIGN UYUMSUZLUK:",
      "src/screens/GameBoard.tsx:145 — UI_CONTRACT: Material Symbols/icon fonts are not allowed",
      "src/screens/GameBoard.tsx:164 — UI_CONTRACT: blanket transition-all is not allowed",
      "DÜZELT: Kritik UI sözleşmesi hatalarını düzelt; stitch/design-tokens.css'i import et, hardcoded renkleri var(--*) ile değiştir.",
    ].join("\n"));

    assert.match(feedback, /DÜZELT:\n• replace icon fonts\/emoji with inline SVG components/);
    assert.match(feedback, /• replace transition-all\/transition: all with scoped transition properties/);
    assert.doesNotMatch(feedback, /Kritik UI sözleşmesi|hardcoded renkleri/);
  });
});
