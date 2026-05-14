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

  it("classifies model/session infra failures instead of UNKNOWN", () => {
    const stalled = classifyError(
      "AGENT_PROCESS_EXITED: feature-dev_developer exited before completing feature-dev/developer. AGENT_MODEL_TURN_STALLED: feature-dev_developer kept feature-dev/developer running for 9m38s but session/output/progress files have not changed for 8m4s.",
    );
    assert.equal(stalled.category, "AGENT_STALL");
    assert.match(stalled.suggestion, /provider\/session infra/);

    const overloaded = classifyError(
      "The AI service is temporarily overloaded. Please try again in a moment. rawError=Provider finish_reason: engine_overloaded",
    );
    assert.equal(overloaded.category, "API_ERROR");
    assert.match(overloaded.suggestion, /provider overloaded/i);

    const exited = classifyError(
      "AGENT_PROCESS_EXITED: feature-dev_reviewer exited before completing feature-dev/reviewer. exit code 1",
    );
    assert.equal(exited.category, "AGENT_PROCESS_EXITED");
  });


  it("classifies scope bleed as a scope failure instead of UNKNOWN", () => {
    const scoped = classifyError(
      "SCOPE_BLEED: Story US-001 modified 1 file(s) outside its SCOPE_FILES list: src/Other.tsx.",
    );
    assert.equal(scoped.category, "SCOPE_BLEED");
    assert.match(scoped.suggestion, /SCOPE_FILES/);

    const platformScoped = classifyError(
      "PLATFORM_STORY_COMMIT_SCOPE_BLOCKED: US-001 has out-of-scope uncommitted file(s): src/contexts/.",
    );
    assert.equal(platformScoped.category, "SCOPE_BLEED");
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
