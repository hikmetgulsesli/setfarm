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

function handleVerifyEachSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function handleVerifyEachCompletion(");
  const end = source.indexOf("async function autoVerifyDoneStories(", start);
  assert.notEqual(start, -1, "handleVerifyEachCompletion source not found");
  assert.notEqual(end, -1, "handleVerifyEachCompletion end marker not found");
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

describe("single-step claim_log lifecycle", () => {
  it("records single-step handoff before heavy preClaim and closes no-spawn exits", () => {
    const source = claimSingleStepSource();
    const claimInsert = source.indexOf("INSERT INTO claim_log");
    const transitionRecord = source.indexOf("recordStepTransition(step.id, step.run_id, \"pending\", \"running\"");
    const runningEvent = source.indexOf("event: \"step.running\"");
    const verifyContextGate = source.indexOf("injectVerifyContext");
    const reviewDelayGate = source.indexOf("PR REVIEW DELAY GATE");
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
    assert.ok(preClaimHandoff > reviewDelayGate, "preClaim handoff must run after earlier defer gates");
    assert.ok(preClaimHandoff > verifyContextGate, "preClaim handoff must run after verify auto/defer gate");
    assert.ok(preClaimHandoff < modulePreClaimCall, "preClaim handoff must run before heavy module preClaim work");
    assert.ok(finalHandoff > missingInputGate, "final handoff must remain after no-spawn guards as an idempotent fallback");
    assert.ok(modulePreClaimNoSpawnGate > modulePreClaimCall, "preClaim no-spawn gate must be checked after preClaim");
    assert.ok(missingInputRetryClose > missingInputGate, "missing-input retry path must close the preClaim handoff");
    assert.ok(missingInputFailClose > missingInputGate, "missing-input failure path must close the preClaim handoff");
    assert.ok(finalHandoff < handoffReturn, "final handoff must run before handoff return");
    assert.match(source, /preClaim changed step status[\s\S]*closeSingleStepHandoff\(outcome/);
    assert.doesNotMatch(source.slice(0, reviewDelayGate), /await recordSingleStepHandoff/);
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

  it("blocks verify-each claims while an active QA-FIX story is pending", () => {
    const claimSource = claimStepSelectionSource();
    const peekSource = peekStepSource();
    const activeQaFixGuard = /NOT EXISTS \(SELECT 1 FROM stories fix_st WHERE fix_st\.run_id = s\.run_id AND fix_st\.story_id LIKE 'QA-FIX-%' AND fix_st\.status IN \('pending', 'running'\)\)/;

    assert.match(claimSource, activeQaFixGuard);
    assert.match(peekSource, activeQaFixGuard);
    assert.match(peekSource, /prev\.step_index < s\.step_index/);
    assert.match(peekSource, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id/);
    assert.ok(
      claimSource.indexOf("fix_st.story_id LIKE 'QA-FIX-%'") > claimSource.indexOf("COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id"),
      "claimStep should only suppress the verify-each previous-step bypass when an active QA-FIX exists",
    );
  });

  it("allows implement to claim active QA-FIX stories even when older stories are done", () => {
    const source = claimImplementLoopSource();
    assert.match(source, /const activeQaFix = await pgGet/);
    assert.match(source, /story_id LIKE 'QA-FIX-%'/);
    assert.match(source, /parseInt\(awaitingVerify\?\.cnt \|\| "0", 10\) > 0 && parseInt\(activeQaFix\?\.cnt \|\| "0", 10\) === 0/);
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
});
