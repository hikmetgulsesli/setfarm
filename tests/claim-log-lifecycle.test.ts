import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");

function claimSingleStepSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function claimSingleStep(");
  const end = source.indexOf("// ── End extracted helpers", start);
  assert.notEqual(start, -1, "claimSingleStep source not found");
  assert.notEqual(end, -1, "claimSingleStep end marker not found");
  return source.slice(start, end);
}

function stepOpsSource(): string {
  return fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
}

function repoSource(): string {
  return fs.readFileSync(path.join(root, "src", "installer", "repo.ts"), "utf-8");
}

function handleVerifyEachSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function handleVerifyEachCompletion(");
  const end = source.indexOf("async function autoVerifyDoneStories(", start);
  assert.notEqual(start, -1, "handleVerifyEachCompletion source not found");
  assert.notEqual(end, -1, "handleVerifyEachCompletion end marker not found");
  return source.slice(start, end);
}

function implementContextSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "steps", "06-implement", "context.ts"), "utf-8");
  const start = source.indexOf("export async function injectStoryContext(");
  const end = source.indexOf("// ── Internal helpers", start);
  assert.notEqual(start, -1, "extracted injectStoryContext not found");
  assert.notEqual(end, -1, "extracted injectStoryContext end not found");
  return source.slice(start, end);
}

function claimStepSelectionSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("const step = await pgGet<StepRow>(");
  const end = source.indexOf("if (!step) return { found: false };", start);
  assert.notEqual(start, -1, "claimStep selection source not found");
  assert.notEqual(end, -1, "claimStep selection end not found");
  return source.slice(start, end);
}

function peekStepSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("export async function peekStep(");
  const end = source.indexOf("// ── Claim", start);
  assert.notEqual(start, -1, "peekStep source not found");
  assert.notEqual(end, -1, "peekStep end not found");
  return source.slice(start, end);
}

function claimImplementLoopSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("// pr-each means strict serial delivery");
  const end = source.indexOf("// Story selection + claim must be atomic", start);
  assert.notEqual(start, -1, "claim implement verifyEach wait source not found");
  assert.notEqual(end, -1, "claim implement verifyEach wait end not found");
  return source.slice(start, end);
}

function autoCompleteStoriesWithPRsSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function autoCompleteStoriesWithPRs(");
  const end = source.indexOf("async function resolveStoryScreens(", start);
  assert.notEqual(start, -1, "autoCompleteStoriesWithPRs source not found");
  assert.notEqual(end, -1, "autoCompleteStoriesWithPRs end not found");
  return source.slice(start, end);
}

function previousStepSelectionBypassSource(source: string): string {
  const marker = source.indexOf("SELECT 1 FROM steps prev");
  assert.notEqual(marker, -1, "previous-step selection bypass source not found");
  const start = source.lastIndexOf("AND NOT EXISTS", marker);
  assert.notEqual(start, -1, "previous-step selection bypass start not found");
  const endCandidates = [
    source.indexOf("ORDER BY", marker),
    source.indexOf("AND (\n          (", marker),
  ].filter((idx) => idx > marker);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : Math.min(source.length, marker + 2200);
  return source.slice(start, end);
}

describe("single-step claim_log lifecycle", () => {
  it("records single-step handoff before claim-side gates and closes no-spawn exits", () => {
    const source = claimSingleStepSource();
    const claimInsert = source.indexOf("INSERT INTO claim_log");
    const transitionRecord = source.indexOf("recordStepTransition(step.id, step.run_id, \"pending\", \"running\"");
    const runningEvent = source.indexOf("event: \"step.running\"");
    const atomicHandoff = source.indexOf("recordSingleStepHandoff(\"claimSingleStep:atomic\")");
    const verifyContextGate = source.indexOf("injectVerifyContext");
    const verifyAutoClose = source.indexOf("verify_each auto-verified or advanced without agent spawn");
    const reviewDelayGate = source.indexOf("PR REVIEW DELAY GATE");
    const reviewDelayClose = source.indexOf("PR review delay deferral");
    const preClaimHandoff = source.indexOf("recordSingleStepHandoff(\"claimSingleStep:preClaim\")");
    const finalHandoff = source.indexOf("recordSingleStepHandoff(\"claimSingleStep\")");
    const modulePreClaimCall = source.indexOf("await _stepModule.preClaim");
    const modulePreClaimNoSpawnGate = source.indexOf("preClaim changed step status");
    const missingInputGate = source.indexOf("MISSING_INPUT_GUARD");
    const missingInputRetryClose = source.indexOf("closeSingleStepHandoff(\"infra_retry\"");
    const missingInputFailClose = source.indexOf("closeSingleStepHandoff(\"failed\"");
    const handoffReturn = source.indexOf("return {\n    found: true");

    assert.notEqual(claimInsert, -1, "recordSingleStepHandoff must insert claim_log rows");
    assert.notEqual(transitionRecord, -1, "recordSingleStepHandoff must record a step transition");
    assert.notEqual(runningEvent, -1, "recordSingleStepHandoff must emit step.running");
    assert.notEqual(atomicHandoff, -1, "atomic handoff must be recorded immediately after DB claim");
    assert.ok(atomicHandoff < verifyContextGate, "atomic handoff must run before verify auto/defer gate");
    assert.ok(atomicHandoff < reviewDelayGate, "atomic handoff must run before earlier defer gates");
    assert.ok(verifyAutoClose > verifyContextGate, "verify auto/no-agent path must close the early handoff");
    assert.ok(reviewDelayClose > reviewDelayGate, "review-delay no-agent path must close the early handoff");
    assert.ok(preClaimHandoff < modulePreClaimCall, "preClaim handoff must run before heavy module preClaim work");
    assert.ok(finalHandoff > missingInputGate, "final handoff must remain after no-spawn guards as an idempotent fallback");
    assert.ok(modulePreClaimNoSpawnGate > modulePreClaimCall, "preClaim no-spawn gate must be checked after preClaim");
    assert.ok(missingInputRetryClose > missingInputGate, "missing-input retry path must close the preClaim handoff");
    assert.ok(missingInputFailClose > missingInputGate, "missing-input failure path must close the preClaim handoff");
    assert.ok(finalHandoff < handoffReturn, "final handoff must run before handoff return");
    assert.match(source, /preClaim changed step status[\s\S]*closeSingleStepHandoff\(outcome/);
    assert.match(source, /shouldRecordSingleStepClaim = false/);
    assert.match(source, /shouldRecordSingleStepTransition = false/);
  });

  it("does not duplicate idempotent running single-step claims", () => {
    const source = claimSingleStepSource();
    assert.match(source, /let shouldRecordSingleStepClaim = false/);
    assert.match(source, /SELECT id FROM claim_log WHERE run_id = \$1 AND step_id = \$2 AND story_id IS NULL AND agent_id = \$3 AND outcome IS NULL LIMIT 1/);
    assert.match(source, /Requeued orphaned running step/);
    assert.match(source, /NOT EXISTS \(\s*SELECT 1 FROM claim_log/);
    assert.match(source, /return \{ found: false \}/);
    assert.doesNotMatch(source, /shouldRecordSingleStepClaim = !existingOpenClaim/);
    assert.match(source, /shouldRecordSingleStepClaim = true/);
  });

  it("does not overwrite actionable retry context with stale successful output", () => {
    const fullSource = stepOpsSource();
    const source = claimSingleStepSource();
    assert.match(fullSource, /function isSuccessfulStepOutput\(output: string\): boolean/);
    assert.match(fullSource, /return status === "done" \|\| status === "skip"/);
    assert.match(fullSource, /function sanitizedRetryFailureText\(text: string\): string/);
    assert.match(fullSource, /PR_NOT_MERGED\|PR_MISSING\|VERIFY_SYSTEM_SMOKE_FAILURE/);
    assert.match(source, /const existingFailure = sanitizedRetryFailureText\(context\["previous_failure"\] \|\| ""\)/);
    assert.match(source, /const stepOutputLooksSuccessful = step\.output \? isSuccessfulStepOutput\(step\.output\) : false/);
    assert.match(source, /const failureText = existingFailure \|\| \(!stepOutputLooksSuccessful \? sanitizedRetryFailureText\(step\.output \|\| ""\) : ""\)/);
    assert.match(source, /if \(context\["previous_failure"\] !== failureText\) context\["previous_failure"\] = failureText/);
    assert.match(source, /Skipped successful step output as retry previous_failure/);
    assert.doesNotMatch(source, /context\["previous_failure"\] = step\.output/);
  });

  it("resolves verify_each single-step claims when verify output is accepted", () => {
    const source = handleVerifyEachSource();
    const acceptedOutputGuard = source.indexOf("UPDATE steps SET status = 'waiting'");
    const duplicateGuard = source.indexOf("if (_pgChanged.changes === 0)");
    const claimUpdate = source.indexOf("UPDATE claim_log SET outcome = 'completed'");
    const retryBranch = source.indexOf("if (status === \"retry\")");
    const passedBranch = source.indexOf("// Verify PASSED");

    assert.ok(claimUpdate > acceptedOutputGuard, "claim_log must close after verify output atomically transitions the step");
    assert.ok(claimUpdate > duplicateGuard, "claim_log must not close on duplicate/late verify completions");
    assert.ok(claimUpdate < retryBranch, "claim_log must close before retry branch returns");
    assert.ok(claimUpdate < passedBranch, "claim_log must close before passed branch returns");
    assert.match(source, /WHERE run_id = \$1 AND step_id = \$2 AND story_id IS NULL AND outcome IS NULL/);
  });

  it("persists module onComplete context before continuing guardrails", () => {
    const source = stepOpsSource();
    const moduleStart = source.indexOf("if (_stepModule.onComplete)");
    const moduleEnd = source.indexOf("// (Legacy REPO DEDUP", moduleStart);
    assert.notEqual(moduleStart, -1, "module onComplete block not found");
    assert.notEqual(moduleEnd, -1, "module onComplete block end not found");
    const moduleSource = source.slice(moduleStart, moduleEnd);

    const onComplete = moduleSource.indexOf("_stepModule.onComplete");
    const persist = moduleSource.indexOf("UPDATE runs SET context = $1");
    assert.ok(persist > onComplete, "module onComplete context mutations must be persisted");
  });

  it("closes downstream quality gate claims when routing back to implement", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function routeQualityFailureToImplement(");
    const end = source.indexOf("// ── Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    const routeTransition = routeSource.indexOf("qualityFailure:routeToImplement");
    const claimUpdate = routeSource.indexOf("UPDATE claim_log SET outcome = 'completed'");
    const emitEvent = routeSource.indexOf("event: \"story.retry\"");

    assert.ok(claimUpdate > routeTransition, "claim_log closes after route transition is recorded");
    assert.ok(claimUpdate < emitEvent, "claim_log closes before route event returns control to spawner");
    assert.match(routeSource, /quality failure routed to \$\{fixStoryId\}/);
    assert.match(routeSource, /WHERE run_id = \$2 AND step_id = \$3 AND story_id IS NULL AND outcome IS NULL/);
  });

  it("fails verify merge blockers before creating QA-FIX stories", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function routeQualityFailureToImplement(");
    const end = source.indexOf("// ── Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    const blockerGuard = routeSource.indexOf("isVerifyRetryMergeBlocker(output)");
    const qaFixLookup = routeSource.indexOf("story_id LIKE 'QA-FIX-%'");
    assert.ok(blockerGuard > 0, "verify merge blocker guard must be present");
    assert.ok(blockerGuard < qaFixLookup, "merge blockers must fail before QA-FIX lookup/creation");
    assert.match(routeSource, /VERIFY_MERGE_BLOCKER/);
    assert.match(routeSource, /do not route this to QA-FIX/);
    assert.match(routeSource, /await failRun\(step\.run_id, true\)/);
  });

  it("lets verify-each retry output use the story retry path instead of QA-FIX", () => {
    const source = stepOpsSource();
    const helperStart = source.indexOf("async function isVerifyEachVerifyStep(");
    const completeStart = source.indexOf("export async function completeStep(");
    const retryStart = source.indexOf("if (statusVal === \"retry\")", completeStart);
    const unknownStart = source.indexOf("if (statusVal && statusVal !== \"done\"", retryStart);
    const loopDispatch = source.indexOf("return await handleVerifyEachCompletion", unknownStart);
    assert.notEqual(helperStart, -1, "isVerifyEachVerifyStep helper not found");
    assert.notEqual(retryStart, -1, "STATUS retry branch not found");
    assert.notEqual(unknownStart, -1, "unknown status guard not found");
    assert.notEqual(loopDispatch, -1, "verify-each completion dispatch not found");

    const helperSource = source.slice(helperStart, completeStart);
    const retrySource = source.slice(retryStart, unknownStart);
    const unknownSource = source.slice(unknownStart, loopDispatch);

    assert.match(helperSource, /step_id = 'implement'/);
    assert.match(helperSource, /loopConfig\?\.verifyEach/);
    assert.match(helperSource, /\(loopConfig\.verifyStep \|\| "verify"\) === step\.step_id/);
    assert.match(retrySource, /verifyEachRetryHandledLater = await isVerifyEachVerifyStep\(step\)/);
    assert.match(retrySource, /if \(!verifyEachRetryHandledLater\)/);
    assert.match(retrySource, /routeQualityFailureToImplement\(step, output, context\)/);
    assert.match(unknownSource, /!\(statusVal === "retry" && verifyEachRetryHandledLater\)/);
  });

  it("persists verify-each retry feedback onto the story and retry context", () => {
    const source = handleVerifyEachSource();
    const retryStart = source.indexOf("if (status === \"retry\")");
    const passedStart = source.indexOf("// Verify PASSED", retryStart);
    assert.notEqual(retryStart, -1, "verify-each retry branch not found");
    assert.notEqual(passedStart, -1, "verify-each passed branch not found");
    const retrySource = source.slice(retryStart, passedStart);

    assert.match(retrySource, /const issues = context\["issues"\] \?\? output/);
    assert.match(retrySource, /context\["verify_feedback"\] = issues/);
    assert.match(retrySource, /context\["previous_failure"\] = issues/);
    assert.match(retrySource, /isVerifyRetryMergeBlocker\(issues\)/);
    assert.match(retrySource, /UPDATE stories SET status = 'pending', retry_count = \$1, output = \$2, updated_at = \$3 WHERE id = \$4/);
    assert.match(retrySource, /UPDATE stories SET status = 'failed', retry_count = \$1, output = \$2, updated_at = \$3 WHERE id = \$4/);
    assert.match(retrySource, /await updateRunContext\(verifyStep\.run_id, context\)/);
  });

  it("injects stored verify retry feedback before developer claim context is persisted", () => {
    const stepOps = stepOpsSource();
    const stepOpsStart = stepOps.indexOf("async function injectStoryContext(");
    const stepOpsEnd = stepOps.indexOf("async function injectVerifyContext(", stepOpsStart);
    assert.notEqual(stepOpsStart, -1, "step-ops injectStoryContext not found");
    assert.notEqual(stepOpsEnd, -1, "step-ops injectStoryContext end not found");
    const stepOpsInject = stepOps.slice(stepOpsStart, stepOpsEnd);

    const extracted = implementContextSource();
    for (const [source, persistMarker] of [
      [stepOpsInject, "await updateRunContext(step.run_id, context)"],
      [extracted, "await helpers.updateRunContext(step.run_id, context)"],
    ] as Array<[string, string]>) {
      const retryFailure = source.indexOf("const retryFailureText = nextStory.output");
      const verifyFeedback = source.indexOf("context[\"verify_feedback\"] = retryFailureText");
      const previousFailure = source.indexOf("context[\"previous_failure\"] = retryFailureText");
      const persist = source.indexOf(persistMarker);
      assert.ok(retryFailure >= 0, "retry failure text must be derived from story output");
      assert.ok(verifyFeedback > retryFailure, "verify_feedback must be restored from story output");
      assert.ok(previousFailure > verifyFeedback, "previous_failure must be restored from retry feedback");
      assert.ok(persist > previousFailure, "context must be persisted after retry feedback injection");
      assert.doesNotMatch(source, /context\["verify_feedback"\] = ""/);
    }
  });

  it("blocks verify-each claims while an active QA-FIX story is pending", () => {
    const claimSource = claimStepSelectionSource();
    const peekSource = peekStepSource();
    const claimBypassSource = previousStepSelectionBypassSource(claimSource);
    const peekBypassSource = previousStepSelectionBypassSource(peekSource);
    const activeQaFixGuard = /NOT EXISTS \(SELECT 1 FROM stories fix_st WHERE fix_st\.run_id = s\.run_id AND fix_st\.story_id LIKE 'QA-FIX-%' AND fix_st\.status IN \('pending', 'running'\)\)/;

    assert.match(claimBypassSource, activeQaFixGuard);
    assert.match(peekBypassSource, activeQaFixGuard);
    assert.match(peekSource, /prev\.step_index < s\.step_index/);
    assert.match(peekSource, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id/);
    assert.match(
      claimBypassSource,
      /prev\.type = 'loop'[\s\S]*prev\.status = 'running'[\s\S]*NOT EXISTS \(SELECT 1 FROM stories fix_st WHERE fix_st\.run_id = s\.run_id AND fix_st\.story_id LIKE 'QA-FIX-%'/,
      "claimStep must not let verify bypass a running implement loop while an active QA-FIX exists",
    );
    assert.match(
      peekBypassSource,
      /prev\.type = 'loop'[\s\S]*prev\.status = 'running'[\s\S]*NOT EXISTS \(SELECT 1 FROM stories fix_st WHERE fix_st\.run_id = s\.run_id AND fix_st\.story_id LIKE 'QA-FIX-%'/,
      "peekStep must not advertise verify work while implement is actively repairing QA-FIX",
    );
    const pendingBypassStart = claimBypassSource.indexOf("prev.status = 'pending'");
    const pendingBypass = claimBypassSource.slice(pendingBypassStart);
    assert.match(pendingBypass, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id[\s\S]*fix_st\.story_id LIKE 'QA-FIX-%'/);
  });

  it("keeps verify blocked and implement visible after a verify-each story retry", () => {
    const claimSource = claimStepSelectionSource();
    const peekSource = peekStepSource();
    const claimBypassSource = previousStepSelectionBypassSource(claimSource);
    const peekBypassSource = previousStepSelectionBypassSource(peekSource);
    const activeStoryGuard = /NOT EXISTS \(SELECT 1 FROM stories active_st WHERE active_st\.run_id = s\.run_id AND active_st\.status IN \('pending', 'running'\) AND active_st\.retry_count > 0\)/;

    const claimPendingBypass = claimBypassSource.slice(claimBypassSource.indexOf("prev.status = 'pending'"));
    const peekPendingBypass = peekBypassSource.slice(peekBypassSource.indexOf("prev.status = 'pending'"));
    assert.match(claimPendingBypass, activeStoryGuard);
    assert.match(peekPendingBypass, activeStoryGuard);

    const claimRunningStart = claimBypassSource.indexOf("prev.status = 'running'");
    const peekRunningStart = peekBypassSource.indexOf("prev.status = 'running'");
    assert.notEqual(claimRunningStart, -1, "claim running-loop bypass source not found");
    assert.notEqual(peekRunningStart, -1, "peek running-loop bypass source not found");
    const claimRunningBypass = claimBypassSource.slice(claimRunningStart, claimBypassSource.indexOf("prev.status = 'pending'"));
    const peekRunningBypass = peekBypassSource.slice(peekRunningStart, peekBypassSource.indexOf("prev.status = 'pending'"));
    assert.match(claimRunningBypass, activeStoryGuard);
    assert.match(peekRunningBypass, activeStoryGuard);
    assert.match(claimRunningBypass, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id/);
    assert.match(peekRunningBypass, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id/);

    const pendingLoopStart = peekSource.indexOf("s.status = 'pending'");
    const runningLoopStart = peekSource.indexOf("OR (s.status = 'running'", pendingLoopStart);
    assert.notEqual(pendingLoopStart, -1, "peek pending-loop source not found");
    assert.notEqual(runningLoopStart, -1, "peek running-loop source not found");
    const pendingLoopSource = peekSource.slice(pendingLoopStart, runningLoopStart);
    assert.match(pendingLoopSource, activeStoryGuard);
  });

  it("does not auto-complete retried stories from stale PRs", () => {
    const source = autoCompleteStoriesWithPRsSource();
    const retryGuard = source.indexOf("Number(rs.retry_count || 0)");
    const stalePrSkip = source.indexOf("skipping stale PR auto-complete");
    const prCompletion = source.indexOf("if (prFound && prUrlValid)");
    const doneUpdate = source.indexOf("UPDATE stories SET status = 'done'");

    assert.notEqual(retryGuard, -1, "retry_count guard not found");
    assert.notEqual(stalePrSkip, -1, "stale PR skip log not found");
    assert.notEqual(prCompletion, -1, "PR completion branch not found");
    assert.notEqual(doneUpdate, -1, "story done update not found");
    assert.ok(retryGuard < prCompletion, "retry guard must run before PR completion");
    assert.ok(stalePrSkip < doneUpdate, "retried stories must be skipped before status=done update");
    assert.match(source, /if \(retryCount > 0\) \{[\s\S]*continue;/);
  });

  it("allows implement to claim active QA-FIX stories even when older stories are done", () => {
    const source = claimImplementLoopSource();
    assert.match(source, /const activeQaFix = await pgGet/);
    assert.match(source, /story_id LIKE 'QA-FIX-%'/);
    assert.match(source, /parseInt\(awaitingVerify\?\.cnt \|\| "0", 10\) > 0[\s\S]*parseInt\(activeQaFix\?\.cnt \|\| "0", 10\) === 0/);
  });

  it("allows implement to claim retried stories even when stale done stories await verify", () => {
    const source = claimImplementLoopSource();
    const activeRetry = source.indexOf("const activeRetriedStory = await pgGet");
    const awaitingVerify = source.indexOf("const awaitingVerify = await pgGet");
    const waitGate = source.indexOf("parseInt(activeRetriedStory?.cnt || \"0\", 10) === 0");

    assert.notEqual(activeRetry, -1, "active retried story guard not found");
    assert.notEqual(awaitingVerify, -1, "awaiting verify lookup not found");
    assert.notEqual(waitGate, -1, "verify wait gate must check active retried stories");
    assert.ok(activeRetry < awaitingVerify, "active retry guard should be computed before verify wait decision");
    assert.ok(awaitingVerify < waitGate, "active retry guard must affect the pr-each wait gate");
    assert.match(source, /status IN \('pending', 'running'\) AND retry_count > 0/);
  });

  it("prioritizes QA-FIX stories before normal pending stories", () => {
    const source = repoSource();
    const stepOps = stepOpsSource();
    const nextPendingStart = source.indexOf("export async function getNextPendingStory(");
    const claimNextStart = source.indexOf("export async function claimNextStory(");
    const claimNextEnd = source.indexOf("// Wave 14 Bug L", claimNextStart);
    const implementSelectionStart = stepOps.indexOf("// Find next pending story with dependency check");
    const implementSelectionEnd = stepOps.indexOf("let nextStory: any | undefined;", implementSelectionStart);
    assert.notEqual(nextPendingStart, -1, "getNextPendingStory source not found");
    assert.notEqual(claimNextStart, -1, "claimNextStory source not found");
    assert.notEqual(claimNextEnd, -1, "claimNextStory query block not found");
    assert.notEqual(implementSelectionStart, -1, "implement story selection source not found");
    assert.notEqual(implementSelectionEnd, -1, "implement story selection end not found");

    const nextPendingSource = source.slice(nextPendingStart, claimNextStart);
    const claimNextSource = source.slice(claimNextStart, claimNextEnd);
    const implementSelectionSource = stepOps.slice(implementSelectionStart, implementSelectionEnd);
    const qaFixOrder = /ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC/;
    assert.match(nextPendingSource, qaFixOrder);
    assert.match(claimNextSource, qaFixOrder);
    assert.match(implementSelectionSource, qaFixOrder);
  });

  it("closes single-step failure claims by workflow step id, not step UUID", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const singleFailureStart = source.indexOf("async function handleSingleStepFailurePG(");
    const singleFailureEnd = source.indexOf("// Post-transaction side effects", singleFailureStart);
    assert.notEqual(singleFailureStart, -1, "handleSingleStepFailurePG source not found");
    assert.notEqual(singleFailureEnd, -1, "handleSingleStepFailurePG transaction block not found");
    const singleFailureSource = source.slice(singleFailureStart, singleFailureEnd);

    assert.match(singleFailureSource, /const workflowStepId = stepRow\?\.step_id \|\| ""/);
    assert.match(singleFailureSource, /step_id = \$\{workflowStepId\}/);
    assert.doesNotMatch(singleFailureSource, /claim_log[\s\S]*step_id = \$\{stepId\}/);
  });

  it("routes verify-each step fail quality reports back to implement", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const helperStart = source.indexOf("function formatVerifyFailureAsRetryOutput(");
    const routeStart = source.indexOf("async function routeVerifyEachFailureToImplement(");
    const singleFailureStart = source.indexOf("async function handleSingleStepFailurePG(");
    assert.notEqual(helperStart, -1, "formatVerifyFailureAsRetryOutput source not found");
    assert.notEqual(routeStart, -1, "routeVerifyEachFailureToImplement source not found");
    assert.notEqual(singleFailureStart, -1, "handleSingleStepFailurePG source not found");
    const helperSource = source.slice(helperStart, routeStart);
    const routeSource = source.slice(routeStart, singleFailureStart);
    const singleFailureSource = source.slice(singleFailureStart, source.indexOf("  // Boost max_retries", singleFailureStart));

    assert.match(helperSource, /STATUS: retry/);
    assert.match(routeSource, /workflowStepId !== "verify"/);
    assert.match(routeSource, /isTransientAgentInfrastructureFailure\(error\)/);
    assert.match(routeSource, /type = 'loop' AND step_id = 'implement'/);
    assert.match(routeSource, /loopConfig\.verifyEach/);
    assert.match(routeSource, /loopConfig\.verifyStep \|\| "verify"/);
    assert.match(routeSource, /status = 'done'/);
    assert.match(routeSource, /formatVerifyFailureAsRetryOutput\(error\)/);
    assert.match(routeSource, /routeQualityFailureToImplement/);
    assert.match(singleFailureSource, /routeVerifyEachFailureToImplement\(stepId, step, workflowStepId, error\)/);
  });

  it("closes terminal failStepWithOutput claims by workflow step id", () => {
    const source = repoSource();
    const start = source.indexOf("export async function failStepWithOutput(");
    const end = source.indexOf("export async function clearStepStory(", start);
    assert.notEqual(start, -1, "failStepWithOutput source not found");
    assert.notEqual(end, -1, "failStepWithOutput end not found");
    const failSource = source.slice(start, end);

    assert.match(failSource, /SELECT run_id, step_id FROM steps WHERE id = \$1 LIMIT 1/);
    assert.match(failSource, /UPDATE steps SET status = 'failed'/);
    assert.match(failSource, /UPDATE claim_log/);
    assert.match(failSource, /outcome = 'failed'/);
    assert.match(failSource, /step_id = \$\{step\.step_id\}/);
    assert.match(failSource, /story_id IS NULL/);
    assert.match(failSource, /outcome IS NULL/);
    assert.doesNotMatch(failSource, /claim_log[\s\S]*step_id = \$\{stepId\}/);
  });
});
