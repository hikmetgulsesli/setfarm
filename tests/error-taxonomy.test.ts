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

    const scopeFileMissing = classifyError(
      "SCOPE_FILE_MISSING: Story US-001 declared scope_files but only 3/8 exist as non-empty files.",
    );
    assert.equal(scopeFileMissing.category, "SCOPE_FILE_MISSING");
    assert.match(scopeFileMissing.suggestion, /declared scope_files/);

    const generatedScreenNotIntegrated = classifyError(
      "GENERATED_SCREEN_NOT_INTEGRATED: owned generated screen(s) are not rendered by the app/router surface: MainMenu (src/screens/MainMenu.tsx).",
    );
    assert.equal(generatedScreenNotIntegrated.category, "GENERATED_SCREEN_NOT_INTEGRATED");
    assert.match(generatedScreenNotIntegrated.suggestion, /generated screen/i);
    assert.match(generatedScreenNotIntegrated.suggestion, /app\/router surface/);

    const generatedScreenProps = classifyError(
      "GENERATED_SCREEN_REQUIRED_PROPS_UNWIRED: src/App.tsx renders OperationsScreen without required generated screen prop(s): items.",
    );
    assert.equal(generatedScreenProps.category, "GENERATED_SCREEN_REQUIRED_PROPS_UNWIRED");
    assert.match(generatedScreenProps.suggestion, /Wire every required generated screen prop/);

    const generatedVisibleState = classifyError(
      "STATUS: retry FINDINGS: generated operations table and metrics remain hardcoded placeholder data while store actions update window.app only.",
    );
    assert.equal(generatedVisibleState.category, "GENERATED_SCREEN_VISIBLE_STATE_UNWIRED");
    assert.match(generatedVisibleState.suggestion, /props\/store-backed render data/);
    assert.match(generatedVisibleState.suggestion, /visible DOM/);

    const actionNoop = classifyError(
      "STATUS: retry FINDINGS: ACT_SAVE_RECORD is navigation-only: it only updates active panel and writes the selected status back to the same current value.",
    );
    assert.equal(actionNoop.category, "OWNED_ACTION_NOOP_OR_NAVIGATION_ONLY");
    assert.match(actionNoop.suggestion, /real declared data/);
    assert.match(actionNoop.suggestion, /same current value/);

    const generatedScreenRegression = classifyError(
      "GENERATED_SCREEN_REGRESSION: previously verified generated screen(s) are no longer rendered by the app/router surface: MainMenu (src/screens/MainMenu.tsx).",
    );
    assert.equal(generatedScreenRegression.category, "GENERATED_SCREEN_REGRESSION");
    assert.match(generatedScreenRegression.suggestion, /previously verified generated screen/i);

    const generatedShellChrome = classifyError(
      "GENERATED_SCREEN_SHELL_CHROME_UNSAFE: src/App.tsx renders visible diagnostic/session/status/debug/QA chrome around generated full-screen screens.",
    );
    assert.equal(generatedShellChrome.category, "GENERATED_SCREEN_SHELL_CHROME_UNSAFE");
    assert.match(generatedShellChrome.suggestion, /window\.app/);
    assert.match(generatedShellChrome.suggestion, /visual viewport root/);

    const generatedShellLandmark = classifyError(
      "GENERATED_SCREEN_SHELL_LANDMARK_UNSAFE: src/App.tsx wraps generated full-screen Stitch screens in an app-shell main landmark.",
    );
    assert.equal(generatedShellLandmark.category, "GENERATED_SCREEN_SHELL_CHROME_UNSAFE");
    assert.match(generatedShellLandmark.suggestion, /main landmark/);
    assert.match(generatedShellLandmark.suggestion, /data-setfarm-root/);

    const designImport = classifyError(
      [
        "SETUP_BUILD_PRECLAIM_BLOCKER:",
        "DESIGN_IMPORT_VALIDATE failed after stitch-to-jsx:",
        "generated-screen-validator reported DESIGN_IMPORT_ICON_PROP_INVALID in src/screens/GeneratedEditor.tsx.",
      ].join("\n"),
    );
    assert.equal(designImport.category, "DESIGN_IMPORT_FAILURE");
    assert.match(designImport.suggestion, /stitch-to-jsx/);
    assert.match(designImport.suggestion, /generated-screen-validator/);
  });

  it("classifies PR lifecycle blockers as actionable retry feedback", () => {
    const commentsOpen = classifyError(
      "PR_REVIEW_COMMENTS_OPEN: US-004 has actionable PR review comments that must be fixed before merge.",
    );
    assert.equal(commentsOpen.category, "PR_REVIEW_COMMENTS_OPEN");
    assert.match(commentsOpen.suggestion, /review comment/i);
    assert.match(commentsOpen.suggestion, /fresh PR comments are clear/i);

    const unresolvedThread = classifyError(
      "PR #1 still has an unresolved non-outdated review thread on src/App.css:65. Next fix: a PR-owning implementer/reviewer should resolve or reply to that thread after confirming .vd-road includes touch-action: none, then rerun supervisor/merge gates.",
    );
    assert.equal(unresolvedThread.category, "PR_REVIEW_COMMENTS_OPEN");
    assert.match(unresolvedThread.suggestion, /review thread/i);

    const notMerged = classifyError(
      "PR_NOT_MERGED: US-004 PR is OPEN. Address review comments/checks, merge https://github.com/acme/app/pull/4 into main, then report STATUS: done.",
    );
    assert.equal(notMerged.category, "PR_NOT_MERGED");
    assert.match(notMerged.suggestion, /still open/i);

    const missing = classifyError(
      "PR_MISSING: US-001 cannot be verified until a PR exists and is merged into main.",
    );
    assert.equal(missing.category, "PR_MISSING");
    assert.match(missing.suggestion, /Create or recover the story PR/i);
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

    const visualQaInfra = classifyError([
      "STATUS: retry",
      "FINDINGS:",
      "Supervisor Visual QA",
      "- [blocker] navigation_error mobile /: Error: page.evaluate: Target page, context or browser has been closed",
    ].join("\n"));
    assert.equal(visualQaInfra.category, "VISUAL_QA_INFRA_ERROR");
    assert.match(visualQaInfra.suggestion, /browser sandbox/i);
    assert.doesNotMatch(visualQaInfra.suggestion, /source files|scoped source/i);

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

  it("classifies review and supervisor retry reports instead of UNKNOWN", () => {
    const reviewRetry = classifyError([
      "STATUS: retry",
      "FINDINGS:",
      "- src/App.tsx:270-280: rotateTile increments moves when no tile mutation occurs.",
      "CHECKS:",
      "- npm run build: passed",
    ].join("\n"));
    assert.equal(reviewRetry.category, "QUALITY_RETRY_FEEDBACK");
    assert.match(reviewRetry.suggestion, /exact retry findings/);
    assert.match(reviewRetry.suggestion, /focused regression coverage/);

    const reviewRetryWithConflictWord = classifyError([
      "STATUS: retry",
      "FINDINGS:",
      "- src/App.tsx:517 conflicts with acceptance criterion 10 because paused tiles remain enabled.",
      "## Durable Supervisor Memory",
      "- Prior code: PRODUCT_SUPERVISOR_BLOCKED from an older plan gate.",
      "CHECKS:",
      "- npm run build: passed",
    ].join("\n"));
    assert.equal(reviewRetryWithConflictWord.category, "QUALITY_RETRY_FEEDBACK");

    const supervisorRetry = classifyError([
      "STATUS: retry",
      "SUPERVISOR_DECISION: block",
      "ISSUES:",
      "- AC7 missing window.app state fields.",
    ].join("\n"));
    assert.equal(supervisorRetry.category, "LLM_SUPERVISOR_BLOCKED");
    assert.match(supervisorRetry.suggestion, /manager feedback/);
  });

  it("classifies only real git conflict signals as merge conflicts", () => {
    const naturalLanguageConflict = classifyError(
      "src/App.tsx:517 conflicts with acceptance criterion 10 because paused tiles remain enabled.",
    );
    assert.notEqual(naturalLanguageConflict.category, "MERGE_CONFLICT");

    const gitConflict = classifyError([
      "Auto-merging src/App.tsx",
      "CONFLICT (content): Merge conflict in src/App.tsx",
      "Automatic merge failed; fix conflicts and then commit the result.",
    ].join("\n"));
    assert.equal(gitConflict.category, "MERGE_CONFLICT");

    const markerConflict = classifyError([
      "<<<<<<< HEAD",
      "current",
      "=======",
      "incoming",
      ">>>>>>> feature",
    ].join("\n"));
    assert.equal(markerConflict.category, "MERGE_CONFLICT");
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
