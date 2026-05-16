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
      "DESIGN MISMATCH:",
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
    assert.match(generated.suggestion, /OpenClaw read tool/);

    const rawStitch = classifyError(
      "RAW_STITCH_CONTEXT_READ: feature-dev_developer used exec on stitch/*.html. Implement claims must use injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX, and story-owned generated screens instead of loading raw stitch HTML/full DESIGN_DOM context.",
    );
    assert.equal(rawStitch.category, "RAW_STITCH_CONTEXT_READ");
    assert.match(rawStitch.suggestion, /CLAIM_SUMMARY_FILE/);
    assert.match(rawStitch.suggestion, /stitch\/\*\.html/);
    assert.doesNotMatch(rawStitch.suggestion, /design guardrail/i);

    const product = classifyError(
      "GUARDRAIL [product-supervisor:implement]: IMPLEMENT_NO_DELTA: US-001 reported done but supervisor found no changed files.",
    );
    assert.equal(product.category, "PRODUCT_SUPERVISOR_BLOCKED");

    const designDom = classifyError([
      "DESIGN_DOM_IMPLEMENTATION_MISMATCH: Story US-002 (Pong arcade - Main Menu and Game Board screens) reported STATUS: done but scoped screen code does not satisfy DESIGN_DOM controls.",
      "- src/screens/MainMenu.tsx:65 DESIGN_DOM button \"Start New Game\" is missing expected icon \"sports_esports\"",
      "- src/screens/GameBoard.tsx: missing DESIGN_DOM button \"arrow_drop_up\" on Game Board",
    ].join("\n"));
    assert.equal(designDom.category, "DESIGN_DOM_IMPLEMENTATION_MISMATCH");
    assert.match(designDom.suggestion, /DESIGN_DOM\/UI_CONTRACT/);
    assert.match(designDom.suggestion, /controls, labels, and action IDs/);
    assert.match(designDom.suggestion, /Labeled icon mismatches are supervisor warnings/);
    assert.match(designDom.suggestion, /Do not read raw Stitch HTML/);
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

    const noDelta = classifyError(
      "IMPLEMENT_NO_DELTA_STALL: feature-dev_developer kept feature-dev/developer running for 15m20s without writing any project source/worktree delta.",
    );
    assert.equal(noDelta.category, "AGENT_STALL");
    assert.match(noDelta.suggestion, /source delta/);

    const preDeltaCheck = classifyError(
      "IMPLEMENT_PRE_DELTA_CHECK_VIOLATION: feature-dev_developer ran deterministic checks before any source delta during a first-delta retry (npm run build).",
    );
    assert.equal(preDeltaCheck.category, "IMPLEMENT_PRE_DELTA_CHECK_VIOLATION");
    assert.match(preDeltaCheck.suggestion, /CLAIM_SUMMARY_FILE/);
    assert.match(preDeltaCheck.suggestion, /source delta first/);

    const noWork = classifyError(
      "NO WORK DETECTED: Story US-002 (Pong arcade - Main Menu and Game Board screens) reported STATUS: done but the worktree has ZERO source-file changes vs main. The agent appears to have shortcut the task.",
    );
    assert.equal(noWork.category, "NO_WORK_DETECTED");
    assert.match(noWork.suggestion, /CLAIM_SUMMARY_FILE/);
    assert.match(noWork.suggestion, /small scoped implementation change/);

    const selfLoop = classifyError(
      "AGENT_SELF_LOOP: repeated identical test/build command (calls=8, command=cd <workdir> && npm run test 2>&1); retrying feature-dev/developer instead of waiting on synthetic session activity.",
    );
    assert.equal(selfLoop.category, "AGENT_SELF_LOOP");
    assert.match(selfLoop.suggestion, /supervisor feedback/);
    assert.match(selfLoop.suggestion, /avoid repeating identical commands/);

    const crossProject = classifyError(
      "CROSS-PROJECT CONTAMINATION: Agent output references a different project. STORY_BRANCH \"us-001-tetris-game-engine-state-test-bridge\" does not match run prefix \"33d23f10\".",
    );
    assert.equal(crossProject.category, "CROSS_PROJECT_CONTAMINATION");
    assert.match(crossProject.suggestion, /CLAIM_SUMMARY_FILE/);
    assert.match(crossProject.suggestion, /prepared story worktree/);

    const boundedVerify = classifyError(
      "VERIFY_BOUNDED_REVIEW_VIOLATION: feature-dev_reviewer read 8 project source/test files before running build/test/lint evidence in verify.",
    );
    assert.equal(boundedVerify.category, "VERIFY_BOUNDED_REVIEW_VIOLATION");
    assert.match(boundedVerify.suggestion, /bounded manager gate/);
    assert.match(boundedVerify.suggestion, /deterministic build\/test\/lint evidence/);
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
      "DESIGN MISMATCH:",
      "src/screens/GameBoard.tsx:145 — UI_CONTRACT: Material Symbols/icon fonts are not allowed",
      "src/screens/GameBoard.tsx:164 — UI_CONTRACT: blanket transition-all is not allowed",
      "FIX: Resolve the exact UI contract failures; import stitch/design-tokens.css and replace hardcoded colors with var(--*) tokens.",
    ].join("\n"));

    assert.match(feedback, /FIX:\n- replace icon fonts\/emoji with inline SVG components/);
    assert.match(feedback, /- replace transition-all\/transition: all with scoped transition properties/);
    assert.doesNotMatch(feedback, /exact UI contract failures/);
  });

  it("rewrites generated screen read feedback without design-mismatch fix text", () => {
    const feedback = sanitizeDesignMismatchFeedback([
      "GENERATED_SCREEN_SHARED_READ: feature-dev_developer used read on src/screens/MainMenu.tsx. Shared generated screens must be consumed through src/screens/SCREEN_INDEX.json, src/screens/index.ts, the component registry, and UI_CONTRACT.",
      "Transcript: /tmp/feature-dev.log",
      "FIX:",
      "• fix only the exact files and issues reported by the design guardrail",
    ].join("\n"));

    assert.match(feedback, /OpenClaw read tool/);
    assert.match(feedback, /SCREEN_INDEX\.json/);
    assert.doesNotMatch(feedback, /design guardrail/i);
    assert.doesNotMatch(feedback, /design-token|hardcoded colors/i);
  });

  it("rewrites raw stitch context feedback without design-mismatch fix text", () => {
    const feedback = sanitizeDesignMismatchFeedback([
      "RAW_STITCH_CONTEXT_READ: feature-dev_developer used exec on stitch/*.html. Implement claims must use injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX, and story-owned generated screens instead of loading raw stitch HTML/full DESIGN_DOM context.",
      "Transcript: /tmp/feature-dev.log",
      "FIX:",
      "• fix only the exact files and issues reported by the design guardrail",
    ].join("\n"));

    assert.match(feedback, /CLAIM_SUMMARY_FILE/);
    assert.match(feedback, /stitch\/\*\.html/);
    assert.doesNotMatch(feedback, /design guardrail/i);
    assert.doesNotMatch(feedback, /design-token|hardcoded colors/i);
  });

});
