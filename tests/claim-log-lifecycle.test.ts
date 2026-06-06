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

function stepAdvanceSource(): string {
  return fs.readFileSync(path.join(root, "src", "installer", "step-advance.ts"), "utf-8");
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


function autoVerifyDoneStoriesSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("export async function autoVerifyDoneStories(");
  assert.notEqual(start, -1, "autoVerifyDoneStories source not found");
  return source.slice(start);
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

function injectSuperviseEachContextSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function injectSuperviseEachContext(");
  const end = source.indexOf("/**\n * Claim a single", start);
  assert.notEqual(start, -1, "injectSuperviseEachContext source not found");
  assert.notEqual(end, -1, "injectSuperviseEachContext end not found");
  return source.slice(start, end);
}

function injectVerifyContextSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function injectVerifyContext(");
  const end = source.indexOf("async function injectSuperviseEachContext(", start);
  assert.notEqual(start, -1, "injectVerifyContext source not found");
  assert.notEqual(end, -1, "injectVerifyContext end not found");
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

  it("does not repeatedly claim verify during the PR review delay window", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /r\.context::jsonb \? 'verify_pending_since'/);
    assert.match(fullSource, /r\.context::jsonb \? 'verify_pending_pr_url'/);
    assert.match(fullSource, /\(r\.context::jsonb ->> 'verify_pending_since'\)::timestamptz > NOW\(\) - \(\$3::int \* interval '1 millisecond'\)/);
    assert.match(fullSource, /verify_done_st\.pr_url <> \(r\.context::jsonb ->> 'verify_pending_pr_url'\)/);
    assert.match(fullSource, /LIMIT 1`, \[agentId, callerGatewayAgent \?\? null, PR_REVIEW_DELAY_MS\]/);
  });

  it("allows supervise_each supervisor claims to bypass verify_each ordering delay", () => {
    const source = previousStepSelectionBypassSource(claimStepSelectionSource());
    assert.match(source, /"superviseEach":true/);
    assert.match(source, /sup_loop\.loop_config::jsonb ->> 'superviseStep'/);
    assert.match(source, /sup_done_st\.status = 'done'/);
    assert.match(source, /s\.step_id = COALESCE/);
    assert.match(source, /fix_st\.story_id LIKE 'QA-FIX-%'/);
  });

  it("blocks verify_each reviewer claims until supervise_each has passed the done story", () => {
    const source = claimStepSelectionSource();
    assert.match(source, /verify_loop\.loop_config::jsonb ->> 'verifyStep'/);
    assert.match(source, /"superviseEach":true/);
    assert.match(source, /verify_wait_st\.status = 'done'/);
    assert.match(source, /r\.context::jsonb ->> 'supervised_story_ids'/);
    assert.match(source, /POSITION\(',' \|\| verify_wait_st\.story_id \|\| ',' IN ',' \|\| COALESCE\(r\.context::jsonb ->> 'supervised_story_ids'/);
  });

  it("does not hijack final-product supervisor completion as supervise_each after all stories are verified", () => {
    const source = stepOpsSource();
    const configHelperStart = source.indexOf("async function getSuperviseEachConfigForStep(");
    const configHelperEnd = source.indexOf("async function findUnsupervisedDoneStory(", configHelperStart);
    assert.notEqual(configHelperStart, -1, "getSuperviseEachConfigForStep source not found");
    assert.notEqual(configHelperEnd, -1, "getSuperviseEachConfigForStep end not found");
    const configHelper = source.slice(configHelperStart, configHelperEnd);
    assert.match(configHelper, /status = 'done'/);
    assert.match(configHelper, /if \(!pendingStory\) return null/);

    const completeDispatchStart = source.indexOf("if (lc.superviseEach && (lc.superviseStep || \"supervise\") === step.step_id)");
    assert.notEqual(completeDispatchStart, -1, "supervise_each complete dispatch not found");
    const completeDispatch = source.slice(completeDispatchStart, completeDispatchStart + 700);
    assert.match(completeDispatch, /if \(superviseEachConfigForStep\)/);
    assert.match(completeDispatch, /handleSuperviseEachCompletion/);
    assert.match(completeDispatch, /treating it as final supervisor/);
  });

  it("does not auto-complete downstream quality gates from supervise_each final-product context", () => {
    const source = claimSingleStepSource();
    const finalScope = source.indexOf('context["supervisor_scope"] === "final-product"');
    assert.notEqual(finalScope, -1, "final-product supervise_each auto-complete guard not found");
    const guard = source.slice(Math.max(0, finalScope - 80), finalScope + 160);
    assert.match(guard, /step\.step_id === "supervise"/);
    assert.doesNotMatch(guard, /qa-test|final-test|security-gate|deploy/);
  });

  it("clears stale story supervisor context before final-product supervisor claims", () => {
    const injectSource = injectSuperviseEachContextSource();
    assert.match(injectSource, /status IN \('pending','running','done'\)/);
    assert.match(injectSource, /loopStatus\?\.status === "done"/);
    assert.match(injectSource, /context\["supervisor_scope"\] = "final-product"/);
    assert.match(injectSource, /delete context\["current_story_title"\]/);
    assert.match(injectSource, /SUPERVISOR_AC_CONTEXT_MISSING\|story-scoped supervisor/);
    assert.match(injectSource, /No story remains to audit; claiming/);

    const advanceSource = stepAdvanceSource();
    const clearStart = advanceSource.indexOf("function clearPrEachDownstreamContext(");
    const clearEnd = advanceSource.indexOf("// ── advancePipeline", clearStart);
    assert.notEqual(clearStart, -1, "clearPrEachDownstreamContext source not found");
    assert.notEqual(clearEnd, -1, "clearPrEachDownstreamContext end not found");
    const clearSource = advanceSource.slice(clearStart, clearEnd);
    assert.match(clearSource, /next\["supervisor_scope"\] = "final-product"/);
    assert.match(clearSource, /delete next\["current_story_title"\]/);
  });

  it("runs verify preflight against the PR branch diff, not story branch against itself", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /execFileSync\("git", \["fetch", "--prune", "origin", "main", analysisBranch\]/);
    assert.match(fullSource, /execFileSync\("git", \["checkout", "-B", analysisBranch, `origin\/\$\{analysisBranch\}`\]/);
    assert.match(fullSource, /const baseRef = analysisBranch && analysisBranch !== "main" \? "origin\/main" : "main"/);
    assert.match(fullSource, /buildPreFlightReport\(repoPath, baseRef, "HEAD"\)/);
    assert.doesNotMatch(fullSource, /buildPreFlightReport\(context\["repo"\], analysisBranch\)/);
  });

  it("does not spawn reviewer for done verify_each stories until a story PR exists", () => {
    const fullSource = stepOpsSource();
    const verifySource = autoVerifyDoneStoriesSource();
    const claimSource = claimSingleStepSource();
    assert.match(fullSource, /async function ensureStoryPrUrlForBranch/);
    assert.match(verifySource, /if \(!prUrl\) \{/);
    assert.match(verifySource, /ensureStoryPrUrlForBranch\(/);
    assert.match(verifySource, /AUTO_PR_CREATE_FAILED/);
    assert.match(verifySource, /deferring reviewer claim/);
    assert.match(fullSource, /has no PR URL after platform auto-PR repair attempt; deferring reviewer claim/);
    assert.match(claimSource, /verify_each auto-verified or advanced without agent spawn/);
    assert.doesNotMatch(verifySource, /if \(!prUrl\) return story; \/\/ No PR URL → needs agent verification/);
  });

  it("auto PR reuse ignores closed PRs instead of marking them ready", () => {
    const fullSource = stepOpsSource();
    const start = fullSource.indexOf("async function ensureStoryPrUrlForBranch");
    const end = fullSource.indexOf("function parseGitStatusPaths", start);
    assert.notEqual(start, -1, "ensureStoryPrUrlForBranch source not found");
    assert.notEqual(end, -1, "ensureStoryPrUrlForBranch source end not found");
    const helper = fullSource.slice(start, end);
    assert.match(helper, /const existingState = getPRState\(existingPrUrl\)/);
    assert.match(helper, /existingState === "OPEN" \|\| existingState === "MERGED"/);
    assert.match(helper, /Ignoring \$\{existingState\} existing PR/);
    assert.match(helper, /"--json", "url,state"/);
    assert.match(helper, /select\(\.state == \\"OPEN\\" or \.state == \\"MERGED\\"\)/);
    assert.doesNotMatch(helper, /"--state", "all", "--json", "url", "--jq", "\.\[0\]\.url/);
  });

  it("does not overwrite actionable retry context with stale successful output", () => {
    const fullSource = stepOpsSource();
    const source = claimSingleStepSource();
    assert.match(fullSource, /function isSuccessfulStepOutput\(output: string\): boolean/);
    assert.match(fullSource, /return status === "done" \|\| status === "skip"/);
    assert.match(fullSource, /function sanitizedRetryFailureText\(text: string\): string/);
    assert.match(fullSource, /PR_REVIEW_COMMENTS_OPEN\|PR_NOT_MERGED\|PR_MISSING\|VERIFY_SYSTEM_SMOKE_FAILURE/);
    assert.match(source, /const existingFailure = sanitizedRetryFailureText\(context\["previous_failure"\] \|\| ""\)/);
    assert.match(source, /const stepOutputLooksSuccessful = step\.output \? isSuccessfulStepOutput\(step\.output\) : false/);
    assert.match(source, /const failureText = existingFailure \|\| \(!stepOutputLooksSuccessful \? sanitizedRetryFailureText\(step\.output \|\| ""\) : ""\)/);
    assert.match(source, /if \(context\["previous_failure"\] !== failureText\) context\["previous_failure"\] = failureText/);
    assert.match(source, /currentCategory === "UNKNOWN"/);
    assert.match(source, /Unexpected error/i);
    assert.match(source, /Skipped successful step output as retry previous_failure/);
    assert.doesNotMatch(source, /context\["previous_failure"\] = step\.output/);
  });

  it("accumulates implement retry gate blockers instead of replacing prior blockers", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /mergeRetryFailureTexts/);
    assert.match(fullSource, /function applyRetryFailureContext/);
    assert.match(fullSource, /context\["previous_failure"\] = mergeRetryFailureTexts\(\[/);
    assert.match(fullSource, /applyRetryFailureContext\(context, `QUALITY GATE: \$\{qgMsg\}`/);
    assert.match(fullSource, /applyRetryFailureContext\(context, bridgeResult\.reason!/);
    assert.match(fullSource, /applyRetryFailureContext\(context, generatedRuntimeSemanticResult\.reason!/);
    assert.match(fullSource, /applyRetryFailureContext\(context, implementEvidenceResult\.reason!/);
    assert.doesNotMatch(fullSource, /context\["previous_failure"\] = bridgeResult\.reason!/);
    assert.doesNotMatch(fullSource, /context\["previous_failure"\] = generatedRuntimeSemanticResult\.reason!/);
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
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
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

  it("persists actionable QA-FIX context when reusing an active fix story", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    assert.match(source, /Resolve reported issue:/);
    assert.match(routeSource, /qualityFixAcceptanceCriteria\(failure\)/);
    assert.match(routeSource, /UPDATE stories[\s\S]*description = \$2[\s\S]*acceptance_criteria = \$3[\s\S]*output = \$4/);
  });

  it("creates QA-FIX stories idempotently when duplicate routing races choose the same story id", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    assert.match(routeSource, /qualityFailureFingerprint\(failure\)/);
    assert.match(routeSource, /quality_failure_fingerprint/);
    assert.match(routeSource, /ON CONFLICT \(run_id, story_id\) WHERE status IN \('pending', 'running'\)/);
    assert.match(routeSource, /RETURNING id, story_id/);
  });

  it("routes QA-FIX-disabled app quality failures back to the original story before failing the run", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    const reClaimGuard = routeSource.indexOf("routeDecision.action === \"re_claim\"");
    const originalStoryRoute = routeSource.indexOf("routeOriginalStoryQualityFailureToImplement(");
    const blockedFail = routeSource.indexOf("QUALITY_FAILURE_ROUTER_BLOCKED_QA_FIX");
    const helper = routeSource.indexOf("async function routeOriginalStoryQualityFailureToImplement(");

    assert.ok(reClaimGuard > 0, "re_claim route guard must be present");
    assert.ok(originalStoryRoute > reClaimGuard, "re_claim must attempt original story routing");
    assert.ok(originalStoryRoute < blockedFail, "original story routing must happen before terminal QA-FIX block failure");
    assert.ok(helper > blockedFail, "original story routing helper must live in the quality routing section");
    assert.match(routeSource, /Do not create a QA-FIX story/);
    assert.match(routeSource, /qualityFailure:routeOriginalStory/);
    assert.match(routeSource, /quality failure routed to original story/);
  });

  it("does not terminally fail duplicate quality routes while the original story is already retrying", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function routeOriginalStoryQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeOriginalStoryQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeOriginalStoryQualityFailureToImplement end marker not found");
    const helperSource = source.slice(start, end);

    const pendingRunningQuery = helperSource.indexOf("status IN ('pending','running','done','verified','skipped')");
    const duplicateGuard = helperSource.indexOf('retryStory.status === "pending" || retryStory.status === "running"');
    const terminalFail = helperSource.indexOf("await failRun(step.run_id, true)", duplicateGuard);

    assert.ok(pendingRunningQuery > 0, "original story lookup must include already-routed pending/running stories");
    assert.ok(duplicateGuard > pendingRunningQuery, "pending/running stories must be handled as idempotent duplicate routes");
    assert.ok(terminalFail > duplicateGuard, "terminal failure remains only after duplicate-route guard");
    assert.match(helperSource, /qualityFailure:originalStoryAlreadyRouted/);
    assert.match(helperSource, /quality failure already routed to original story/);
  });

  it("refuses to reopen merged story PRs for post-merge quality regressions", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function routeOriginalStoryQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeOriginalStoryQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeOriginalStoryQualityFailureToImplement end marker not found");
    const helperSource = source.slice(start, end);

    const prSelect = helperSource.indexOf("story_branch, pr_url FROM stories");
    const mergedGuard = helperSource.indexOf('retryStory.pr_url && getPRState(retryStory.pr_url) === "MERGED"', prSelect);
    const postMergeCategory = helperSource.indexOf("POST_MERGE_QUALITY_REGRESSION", mergedGuard);
    const storyReset = helperSource.indexOf("UPDATE stories SET status = 'pending'", mergedGuard);

    assert.ok(prSelect >= 0, "original story router must read pr_url");
    assert.ok(mergedGuard > prSelect, "merged PR guard must run after loading story metadata");
    assert.ok(postMergeCategory > mergedGuard, "merged PR guard must classify post-merge quality regression");
    assert.ok(storyReset > postMergeCategory, "story reset may only appear after the merged PR guard");
    assert.match(helperSource, /must not reopen or recode the original story branch/);
    assert.match(helperSource, /do not reset the merged story to pending or clear its PR metadata/);
  });

  it("enforces active story id uniqueness at the database boundary", () => {
    const source = fs.readFileSync(path.join(root, "src", "db-pg.ts"), "utf-8");
    assert.match(source, /ALTER TABLE stories ADD COLUMN IF NOT EXISTS quality_failure_fingerprint TEXT/);
    assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_active_story_id_unique ON stories\(run_id, story_id\) WHERE status IN \('pending', 'running'\)/);
    assert.match(source, /CREATE INDEX IF NOT EXISTS idx_stories_quality_failure_fingerprint/);
  });

  it("fails verify merge blockers before creating QA-FIX stories", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
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

    assert.match(retrySource, /const issues = resolveVerifyRetryIssues\(parsedOutput, context, output\)/);
    assert.match(retrySource, /context\["verify_feedback"\] = issues/);
    assert.match(retrySource, /context\["previous_failure"\] = issues/);
    assert.match(retrySource, /isVerifyRetryMergeBlocker\(issues\)/);
    assert.match(retrySource, /UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = \$1, output = \$2, updated_at = \$3 WHERE id = \$4/);
    assert.match(retrySource, /UPDATE stories SET status = 'failed', retry_count = \$1, output = \$2, updated_at = \$3 WHERE id = \$4/);
    assert.match(retrySource, /await updateRunContext\(verifyStep\.run_id, context\)/);
  });

  it("defers terminal verify retry exhaustion when fresh pass evidence resolves stale visual retry output", () => {
    const handleSource = handleVerifyEachSource();
    const retryStart = handleSource.indexOf("if (status === \"retry\")");
    const passedStart = handleSource.indexOf("// Verify PASSED", retryStart);
    assert.notEqual(retryStart, -1, "verify retry branch not found");
    assert.notEqual(passedStart, -1, "verify pass branch not found");
    const retrySource = handleSource.slice(retryStart, passedStart);
    const guard = retrySource.indexOf("shouldDeferVerifyRetryExhaustionForResolvedEvidence(");
    const terminalFail = retrySource.indexOf("await failRun(verifyStep.run_id, true)", guard);

    assert.ok(guard >= 0, "retry exhaustion must check resolved pass evidence before failing the run");
    assert.ok(terminalFail > guard, "terminal fail must happen after resolved-evidence deferral guard");
    assert.match(retrySource, /checkId: "verify\.retry_exhaustion\.deferred"/);
    assert.match(retrySource, /VERIFY_STALE_VISUAL_RETRY_DEFERRED/);

    const fullSource = stepOpsSource();
    assert.match(fullSource, /function isResolvedNoRepeatVisualRetryIssue/);
    assert.match(fullSource, /repeat\\s\*=/);
    assert.match(fullSource, /size\\s\*=/);
    assert.match(fullSource, /check_id = 'supervisor-decision'/);
    assert.match(fullSource, /check_id = 'stack-evidence:verify'/);
    assert.match(fullSource, /event_type IN \('story.done', 'story.verified'\)/);
  });

  it("clears stale story failure context after verified and auto-verified stories", () => {
    const handleSource = handleVerifyEachSource();
    const autoSource = autoVerifyDoneStoriesSource();
    const fullSource = stepOpsSource();

    assert.match(fullSource, /function clearVerifiedStoryFailureContext\(context: Record<string, string>\): void/);
    assert.match(fullSource, /delete context\["verify_feedback"\]/);
    assert.match(fullSource, /delete context\["previous_failure"\]/);
    assert.match(fullSource, /delete context\["failure_category"\]/);
    assert.match(fullSource, /delete context\["failure_suggestion"\]/);
    assert.match(fullSource, /delete context\["verify_pending_pr_url"\]/);
    assert.match(fullSource, /delete context\["verify_pending_since"\]/);

    const handleVerifyStory = handleSource.indexOf("await verifyStory(verifiedRow.id, output)");
    const handleClear = handleSource.indexOf("clearVerifiedStoryFailureContext(context)", handleVerifyStory);
    const nextStory = handleSource.indexOf("const nextUnverifiedStory = await autoVerifyDoneStories", handleClear);
    assert.ok(handleVerifyStory >= 0, "normal verify pass must mark the story verified");
    assert.ok(handleClear > handleVerifyStory, "normal verify pass must clear stale failure context after verifyStory");
    assert.ok(nextStory > handleClear, "normal verify pass must clear stale failure context before selecting the next story");

    const autoVerifyCount = (autoSource.match(/await verifyStory\(story\.id/g) || []).length;
    const autoClearCount = (autoSource.match(/clearVerifiedStoryFailureContext\(context\)/g) || []).length;
    assert.ok(autoVerifyCount >= 3, "auto-verify should cover merged, force-merged, and closed-PR paths");
    assert.ok(autoClearCount >= autoVerifyCount, "every auto-verify path must clear stale story failure context");
  });

  it("requires fresh merged PR state before verify can mark a story verified", () => {
    const handleSource = handleVerifyEachSource();
    const passStart = handleSource.indexOf("// Verify PASSED");
    const verifyStoryCall = handleSource.indexOf("await verifyStory(verifiedRow.id, output)", passStart);
    assert.ok(passStart >= 0, "verify pass branch must exist");
    assert.ok(verifyStoryCall > passStart, "verify pass branch must call verifyStory");

    const passSource = handleSource.slice(passStart, verifyStoryCall);
    assert.match(passSource, /fetchFreshPrStateName\(verifiedRow\.pr_url, verifiedStoryId, context, verifyStep\.run_id, verifyStep\.step_id\)/);
    assert.match(passSource, /if \(prState !== "MERGED"\)/);
    assert.match(passSource, /PR_NOT_MERGED/);

    const fullSource = stepOpsSource();
    assert.match(fullSource, /checkId: "verify\.pr_state\.fresh"/);
    assert.match(fullSource, /label: "Verify PR merge state"/);
  });

  it("auto-verify records fresh PR merge state observations before marking stories verified", () => {
    const autoSource = stepOpsSource();
    const helperStart = autoSource.indexOf("export async function autoVerifyDoneStories");
    assert.ok(helperStart >= 0, "auto-verify helper must exist");
    const helperSource = autoSource.slice(helperStart);

    assert.match(helperSource, /const readPrStateForVerify = async/);
    assert.match(helperSource, /fetchFreshPrStateName\(prUrl, story\.story_id, context, runId, verifyStep\.id\)/);

    const readCall = helperSource.indexOf("const prState = await readPrStateForVerify(prUrl)");
    const autoVerify = helperSource.indexOf("Auto-verified after PR was already merged", readCall);
    assert.ok(readCall >= 0, "auto-verify must read fresh PR state before merged branch");
    assert.ok(autoVerify > readCall, "auto-verify must record/check fresh PR state before verifying story");
  });

  it("blocks pr-each implement story selection while PR delivery blocker is open", () => {
    const source = stepOpsSource();
    const blockerHelper = source.indexOf("function isOpenPrDeliveryBlockerContext");
    const autoComplete = source.indexOf("await autoCompleteStoriesWithPRs(step, runIdPrefix, context, null)");
    const pendingSelection = source.indexOf("const pendingStories = await pgQuery<any>", autoComplete);
    assert.ok(blockerHelper >= 0, "PR delivery blocker helper must exist");
    assert.ok(autoComplete >= 0, "implement loop auto-complete point must exist");
    assert.ok(pendingSelection > autoComplete, "pending story selection must happen after auto-complete");

    const selectionPrelude = source.slice(autoComplete, pendingSelection);
    assert.match(selectionPrelude, /isPrEach && isOpenPrDeliveryBlockerContext\(context\)/);
    assert.match(selectionPrelude, /implement\.pr_each_delivery_blocker/);
    assert.match(selectionPrelude, /Blocking new story claim while verify delivery blocker is open/);
    assert.match(selectionPrelude, /return \{ found: false \}/);
  });

  it("does not block later pr-each stories with stale PR context from a verified story", () => {
    const source = stepOpsSource();
    const autoComplete = source.indexOf("await autoCompleteStoriesWithPRs(step, runIdPrefix, context, null)");
    const pendingSelection = source.indexOf("const pendingStories = await pgQuery<any>", autoComplete);
    assert.ok(autoComplete >= 0, "implement loop auto-complete point must exist");
    assert.ok(pendingSelection > autoComplete, "pending story selection must happen after PR blocker cleanup");

    const selectionPrelude = source.slice(autoComplete, pendingSelection);
    assert.match(source, /function prDeliveryBlockerStoryId\(context: Record<string, string>\): string/);
    assert.match(source, /\(explicit \|\| context\["current_story_id"\] \|\| ""\)\.trim\(\)/);
    assert.match(selectionPrelude, /blockedStory\?\.status === "verified"/);
    assert.match(selectionPrelude, /const blockedStoryId = prDeliveryBlockerStoryId\(context\)/);
    assert.match(selectionPrelude, /clearVerifiedStoryFailureContext\(context\)/);
    assert.match(selectionPrelude, /Cleared stale PR delivery blocker for verified story/);
  });

  it("clears stale story failure context after supervise_each passes a story", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function handleSuperviseEachCompletion(");
    const end = source.indexOf("/**\n * Handle verify-each completion", start);
    assert.notEqual(start, -1, "handleSuperviseEachCompletion source not found");
    assert.notEqual(end, -1, "handleSuperviseEachCompletion end not found");

    const superviseSource = source.slice(start, end);
    const markPassed = superviseSource.indexOf("markStorySupervised(context, story.story_id)");
    const clearFailure = superviseSource.indexOf("clearVerifiedStoryFailureContext(context)", markPassed);
    const updateContext = superviseSource.indexOf("await updateRunContext(superviseStep.run_id, context)", clearFailure);

    assert.ok(markPassed >= 0, "supervisor pass must mark the story supervised");
    assert.ok(clearFailure > markPassed, "supervisor pass must clear stale verify/failure context");
    assert.ok(updateContext > clearFailure, "supervisor pass must persist cleaned context before queuing verify");
  });

  it("does not let LLM supervisor pass override blocking visual/state evidence", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function handleSuperviseEachCompletion(");
    const end = source.indexOf("/**\n * Handle verify-each completion", start);
    assert.notEqual(start, -1, "handleSuperviseEachCompletion source not found");
    assert.notEqual(end, -1, "handleSuperviseEachCompletion end not found");

    const superviseSource = source.slice(start, end);
    const evidenceCheck = superviseSource.indexOf("findBlockingSupervisorEvidenceForStory(");
    const markPassed = superviseSource.indexOf("markStorySupervised(context, story.story_id)");
    const queueVerify = superviseSource.indexOf("Supervisor passed ${story.story_id}; verify queued");

    assert.match(source, /readSupervisorVisualResult/);
    assert.match(source, /SUPERVISOR_VISUAL_QA_BLOCKED/);
    assert.match(source, /SUPERVISOR_EVIDENCE_BLOCKED/);
    assert.match(source, /supervise_each\.supervisor_evidence_blocked/);
    assert.match(source, /verify_each\.supervisor_evidence_blocked/);
    assert.match(source, /routeBlockingSupervisorEvidenceToImplement\(/);
    assert.match(source, /returning to implement before reviewer claim/);
    assert.match(source, /expandSupervisorEvidenceWorkdirs\(workdirs, storyBranch \|\| undefined\)/);
    assert.match(source, /params\.story\.story_branch/);
    assert.ok(evidenceCheck >= 0, "supervise_each must inspect supervisor evidence before pass");
    assert.ok(markPassed > evidenceCheck, "supervisor evidence must be checked before marking story supervised");
    assert.ok(queueVerify > evidenceCheck, "supervisor evidence must be checked before verify is queued");
  });

  it("records supervise module observations against the completing story snapshot", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /let completeCurrentStoryId = ""/);
    assert.match(fullSource, /SELECT story_id FROM stories WHERE id = \$1 AND run_id = \$2 LIMIT 1/);
    assert.match(fullSource, /currentStoryId: completeCurrentStoryId/);

    const superviseGuardSource = fs.readFileSync(path.join(root, "src", "installer", "steps", "12-supervise", "guards.ts"), "utf8");
    assert.match(superviseGuardSource, /storyId: ctx\.currentStoryId \|\| ctx\.context\["current_story_id"\] \|\| ""/);
  });

  it("ignores stale supervisor evidence from inactive source workdirs", () => {
    const source = stepOpsSource();
    assert.match(source, /function expandSupervisorEvidenceWorkdirs\(workdirs: string\[\], storyBranch\?: string\): string\[\]/);
    assert.match(source, /story-worktrees/);
    assert.match(source, /fs\.readdirSync\(agentsRoot\)/);
    assert.match(source, /function isUsableSupervisorEvidenceWorkdir\(workdir: string\): boolean/);
    assert.match(source, /Ignoring stale supervisor evidence from inactive workdir/);

    const start = source.indexOf("function findBlockingSupervisorEvidenceForStory(");
    const end = source.indexOf("async function routeBlockingSupervisorEvidenceToImplement(", start);
    assert.notEqual(start, -1, "findBlockingSupervisorEvidenceForStory source not found");
    assert.notEqual(end, -1, "routeBlockingSupervisorEvidenceToImplement source not found");

    const evidenceSource = source.slice(start, end);
    assert.match(evidenceSource, /expandSupervisorEvidenceWorkdirs\(workdirs, storyBranch \|\| undefined\)/);
    const usableCheck = evidenceSource.indexOf("isUsableSupervisorEvidenceWorkdir(workdir)");
    const visualRead = evidenceSource.indexOf("readSupervisorVisualResult(workdir, runId)");
    const stateRead = evidenceSource.indexOf("readSupervisorState(workdir, runId)");

    assert.ok(usableCheck >= 0, "supervisor evidence must verify workdir source markers");
    assert.ok(visualRead > usableCheck, "visual evidence must not be read from inactive workdirs");
    assert.ok(stateRead > usableCheck, "state evidence must not be read from inactive workdirs");
  });

  it("clears stale retry context before verifying a supervise_each-passed story", () => {
    const source = stepOpsSource();
    assert.match(source, /function isStorySupervised\(context: Record<string, string>, storyId: string\): boolean/);

    const verifySource = injectVerifyContextSource();
    const noPrGuard = verifySource.indexOf("if (!nextUnverified.pr_url && context[\"auto_pr_create_failed\"])");
    const supervisedCheck = verifySource.indexOf("if (isStorySupervised(context, nextUnverified.story_id))", noPrGuard);
    const clearFailure = verifySource.indexOf("clearVerifiedStoryFailureContext(context)", supervisedCheck);
    const outputParse = verifySource.indexOf("if (nextUnverified.output)", clearFailure);

    assert.ok(noPrGuard >= 0, "verify claim no-PR guard not found");
    assert.ok(supervisedCheck > noPrGuard, "verify claim must check supervised story status after no-PR deferral");
    assert.ok(clearFailure > supervisedCheck, "verify claim must clear stale retry context for supervised stories");
    assert.ok(outputParse > clearFailure, "verify claim must clear stale context before parsing current story output");
  });


  it("routes auto-verify smoke quality failures back to implement", () => {
    const autoSource = autoVerifyDoneStoriesSource();
    const handleSource = handleVerifyEachSource();
    const fullSource = stepOpsSource();

    assert.match(autoSource, /\["VERIFY_SYSTEM_SMOKE_FAILURE", "BUILD_FAILED"\]\.includes\(context\["failure_category"\] \|\| ""\)/);
    assert.match(autoSource, /routeQualityFailureToImplement\(/);
    assert.match(autoSource, /SYSTEM_SMOKE_FAILURE:/);
    assert.match(autoSource, /verify_quality_failure_routed/);
    assert.match(autoSource, /status IN \('running','pending','failed','waiting'\)/);
    assert.match(autoSource, /ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC LIMIT 1/);
    assert.match(handleSource, /Routed verify smoke failure to implement; not cycling reviewer/);
    assert.match(fullSource, /Routed verify smoke failure to implement; suppressing reviewer claim/);
  });

  it("does not let stale verify context override the current done story", () => {
    const handleSource = handleVerifyEachSource();
    const identifyStart = handleSource.indexOf("// Identify the story being verified.");
    const retryStart = handleSource.indexOf("if (status === \"retry\")", identifyStart);
    assert.notEqual(identifyStart, -1, "verify target selection block not found");
    assert.notEqual(retryStart, -1, "verify retry branch not found");
    const identifySource = handleSource.slice(identifyStart, retryStart);

    const byPr = identifySource.indexOf("SELECT story_id FROM stories WHERE run_id = $1 AND pr_url = $2 AND status = 'done' LIMIT 1");
    const byReported = identifySource.indexOf("SELECT story_id FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1");
    const byContext = identifySource.indexOf("Ignoring stale context current_story_id");

    assert.ok(byPr >= 0, "verify should first match a reported merged PR to a done story");
    assert.ok(byReported > byPr, "reported current_story_id should be checked after PR URL");
    assert.ok(byContext > byReported, "context current_story_id should be treated as the weakest/stale source");
    assert.doesNotMatch(identifySource, /parsedOutput\["current_story_id"\] \|\| context\["current_story_id"\]/);
  });

  it("blocks actionable PR review comments before auto-merge", () => {
    const handleSource = handleVerifyEachSource();
    const passedStart = handleSource.indexOf("// Verify PASSED");
    const smokeStart = handleSource.indexOf("const repoPath = context[\"repo\"] || context[\"REPO\"] || \"\";", passedStart);
    assert.notEqual(passedStart, -1, "verify-each passed branch not found");
    assert.notEqual(smokeStart, -1, "verify smoke branch not found");
    const passedSource = handleSource.slice(passedStart, smokeStart);

    const prCommentsCheck = passedSource.indexOf("detectOpenPrReviewCommentFailure(");
    const prCommentsRoute = passedSource.indexOf("PR_REVIEW_COMMENTS_OPEN", prCommentsCheck);
    const mutableState = passedSource.indexOf("let prState = await fetchFreshPrStateName(verifiedRow.pr_url");
    const openGuard = passedSource.indexOf("if (prState === \"OPEN\")", mutableState);
    const settleGate = passedSource.indexOf("prReviewSettleComplete(context)", openGuard);
    const autoMerge = passedSource.indexOf("tryAutoMergePR(verifiedRow.pr_url, verifiedStoryId, verifyStep.run_id)", settleGate);
    const invalidate = passedSource.indexOf("invalidatePRStateCache(verifiedRow.pr_url)", autoMerge);
    const recheck = passedSource.indexOf("prState = await fetchFreshPrStateName(verifiedRow.pr_url", invalidate);
    const notMergedGuard = passedSource.indexOf("if (prState !== \"MERGED\")", recheck);

    assert.ok(prCommentsCheck >= 0, "verify must fetch fresh PR comments before merge");
    assert.ok(prCommentsRoute > prCommentsCheck, "actionable PR comments must route back to implement");
    assert.ok(prCommentsCheck < mutableState, "PR comments must be checked before fresh PR state and auto-merge");
    assert.ok(mutableState >= 0, "PR state must be mutable so merge can be rechecked");
    assert.ok(openGuard > mutableState, "open PR guard must run after state lookup");
    assert.ok(settleGate > openGuard, "open PR auto-merge must wait for the external review settle window");
    assert.ok(autoMerge > settleGate, "approved open PR should use existing auto-merge helper after review settle");
    assert.ok(invalidate > autoMerge, "PR state cache must be invalidated after merge");
    assert.ok(recheck > invalidate, "PR state must be rechecked after merge");
    assert.ok(notMergedGuard > recheck, "not-merged guard should use post-merge state");
  });

  it("routes actionable PR review comments before spawning reviewer", () => {
    const fullSource = stepOpsSource();
    const reviewDelayStart = fullSource.indexOf("// PR REVIEW DELAY GATE");
    const preClaimStart = fullSource.indexOf("recordSingleStepHandoff(\"claimSingleStep:preClaim\")", reviewDelayStart);
    assert.notEqual(reviewDelayStart, -1, "review delay gate not found");
    assert.notEqual(preClaimStart, -1, "preClaim handoff not found after review delay gate");
    const gateSource = fullSource.slice(reviewDelayStart, preClaimStart);

    const signal = gateSource.indexOf("if (hasReviewSignal)");
    const detect = gateSource.indexOf("detectOpenPrReviewCommentFailure(", signal);
    const category = gateSource.indexOf("category: \"PR_REVIEW_COMMENTS_OPEN\"", detect);
    const route = gateSource.indexOf("routeVerifyScopeFailureToImplement(step, context, storyIdForReviewSignal", detect);
    const close = gateSource.indexOf("actionable PR review comments routed to implement before reviewer spawn", route);
    const noSpawn = gateSource.indexOf("return { found: false }", route);

    assert.ok(signal >= 0, "review signal branch should exist");
    assert.ok(detect > signal, "claim path should re-check actionable PR comments");
    assert.ok(category > detect, "claim path should classify actionable comments as PR_REVIEW_COMMENTS_OPEN");
    assert.ok(route > detect, "claim path should route PR review comments back to implement");
    assert.ok(close > route, "claim path should close the handoff before suppressing spawn");
    assert.ok(noSpawn > route, "claim path should suppress reviewer spawn");
  });

  it("auto-verifies clean open PRs mechanically after comments are clear", () => {
    const source = autoVerifyDoneStoriesSource();
    const openStart = source.indexOf("if (prState === \"OPEN\")");
    const closedStart = source.indexOf("} catch (e)", openStart);
    assert.notEqual(openStart, -1, "OPEN PR auto-verify branch not found");
    assert.notEqual(closedStart, -1, "OPEN PR auto-verify branch end not found");
    const openSource = source.slice(openStart, closedStart);

    const commentsGate = openSource.indexOf("detectOpenPrReviewCommentFailure(");
    const route = openSource.indexOf("routeVerifyScopeFailureToImplement(", commentsGate);
    const settleGate = openSource.indexOf("prReviewSettleComplete(context)", route);
    const cleanOpenPr = openSource.indexOf("const cleanOpenPr", settleGate);
    const autoMerge = openSource.indexOf("tryAutoMergePR(prUrl, story.story_id, runId)", cleanOpenPr);
    const invalidate = openSource.indexOf("invalidatePRStateCache(prUrl)", autoMerge);
    const recheck = openSource.indexOf("const refreshedState = await readPrStateForVerify(prUrl)", invalidate);
    const continueMerged = openSource.indexOf("if (refreshedState === \"MERGED\")", recheck);
    const reviewerFallback = openSource.indexOf("return story", continueMerged);

    assert.ok(commentsGate >= 0, "OPEN PR path must re-check actionable review comments first");
    assert.ok(route > commentsGate, "actionable comments must route to implement before merge");
    assert.ok(settleGate > route, "OPEN PR auto-merge must wait for the external review settle window");
    assert.ok(cleanOpenPr > settleGate, "clean merge signal must be computed after comment gate and settle gate");
    assert.ok(autoMerge > cleanOpenPr, "clean OPEN PR should use Setfarm auto-merge helper");
    assert.ok(invalidate > autoMerge, "PR state cache must be invalidated after auto-merge");
    assert.ok(recheck > invalidate, "PR state must be rechecked after auto-merge");
    assert.ok(continueMerged > recheck, "merged PRs should continue through auto-verify gates");
    assert.ok(reviewerFallback > continueMerged, "reviewer fallback should be last resort for unclean/open PRs");
  });

  it("does not resolve current actionable PR review threads from verify", () => {
    const fullSource = stepOpsSource();
    const detectStart = fullSource.indexOf("async function detectOpenPrReviewCommentFailure");
    const nextFunction = fullSource.indexOf("\nfunction isOpenPrDeliveryBlockerContext", detectStart);
    assert.notEqual(detectStart, -1, "detectOpenPrReviewCommentFailure not found");
    assert.notEqual(nextFunction, -1, "detectOpenPrReviewCommentFailure end not found");
    const detectSource = fullSource.slice(detectStart, nextFunction);

    assert.doesNotMatch(
      detectSource,
      /resolveActionableInlineReviewThreads/,
      "verify must not resolve current actionable PR review threads; it must route them to implement",
    );
    assert.match(detectSource, /PR_REVIEW_COMMENTS_OPEN/, "current actionable comments should remain a blocking route");
    assert.match(detectSource, /policyDecision:\s*"mechanically_satisfied_current_thread"/);
    assert.match(detectSource, /policyDecision:\s*"historical_or_outdated_thread"/);
    assert.doesNotMatch(
      detectSource,
      /state\.state\s*!==\s*"MERGED"\s*&&\s*formatted/,
      "merged PRs with current actionable comments must still be blocked",
    );
    assert.match(detectSource, /PR is merged but still has current actionable PR review comments/);
  });

  it("runs post-merge build before accepting verify or deferring smoke", () => {
    const handleSource = handleVerifyEachSource();
    const passedStart = handleSource.indexOf("// Verify PASSED");
    const smokeStart = handleSource.indexOf("const smokeDecision = await shouldRunStorySystemSmokeGate", passedStart);
    assert.notEqual(passedStart, -1, "verify-each passed branch not found");
    assert.notEqual(smokeStart, -1, "verify smoke decision not found");
    const passedSource = handleSource.slice(passedStart, smokeStart + 1200);

    const syncMain = passedSource.indexOf("syncBaseBranch(repoPath, \"main\")");
    const buildGate = passedSource.indexOf("runPostMergeBuildGate(repoPath");
    const routeFailure = passedSource.indexOf("routeQualityFailureToImplement(", buildGate);
    const smokeDecision = passedSource.indexOf("shouldRunStorySystemSmokeGate", buildGate);

    assert.ok(syncMain >= 0, "verify should sync main before post-merge gates");
    assert.ok(buildGate > syncMain, "post-merge build must run after syncing main");
    assert.ok(routeFailure > buildGate, "post-merge build failure must route through the quality-fix path");
    assert.ok(smokeDecision > buildGate, "smoke may be deferred only after main build passes");

    const fullSource = stepOpsSource();
    const ensureStart = fullSource.indexOf("async function ensureSystemSmokeBeforeAutoVerify(");
    const ensureEnd = fullSource.indexOf("const smokeGate = runSystemSmokeGate", ensureStart);
    assert.notEqual(ensureStart, -1, "auto-verify gate source not found");
    assert.notEqual(ensureEnd, -1, "auto-verify smoke call not found");
    const ensureSource = fullSource.slice(ensureStart, ensureEnd);
    assert.ok(ensureSource.indexOf("runPostMergeBuildGate(repoPath") < ensureSource.indexOf("shouldRunStorySystemSmokeGate"), "auto-verify build must run before smoke deferral");
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
      const qaFixRetryFailure = source.indexOf("isQualityFixStory");
      const verifyFeedback = Math.max(
        source.indexOf("context[\"verify_feedback\"] = retryFailureText"),
        source.indexOf("context[\"verify_feedback\"] = mergeRetryFailureTexts"),
        source.indexOf("context[\"verify_feedback\"] = combinedRetryFailure"),
      );
      const previousFailure = Math.max(
        source.indexOf("context[\"previous_failure\"] = retryFailureText"),
        source.indexOf("context[\"previous_failure\"] = combinedRetryFailure"),
      );
      const clearPreviousFailure = source.indexOf("delete context[\"previous_failure\"]");
      const clearFailureCategory = source.indexOf("delete context[\"failure_category\"]");
      const clearFailureSuggestion = source.indexOf("delete context[\"failure_suggestion\"]");
      const persist = source.indexOf(persistMarker);
      assert.ok(retryFailure >= 0, "retry failure text must be derived from story output");
      assert.ok(qaFixRetryFailure > retryFailure, "QA-FIX story output must be treated as retry feedback even on the first attempt");
      assert.ok(clearPreviousFailure >= 0, "stale previous_failure must be cleared at new story claim");
      assert.ok(clearFailureCategory > clearPreviousFailure, "stale failure_category must be cleared with previous_failure");
      assert.ok(clearFailureSuggestion > clearFailureCategory, "stale failure_suggestion must be cleared with previous_failure");
      assert.ok(verifyFeedback > retryFailure, "verify_feedback must be restored from story output");
      assert.ok(previousFailure > verifyFeedback, "previous_failure must be restored from retry feedback");
      assert.ok(previousFailure > clearFailureSuggestion, "previous_failure must only be restored after stale failure context is cleared");
      assert.ok(persist > previousFailure, "context must be persisted after retry feedback injection");
      assert.doesNotMatch(source, /context\["verify_feedback"\] = ""/);
    }
  });

  it("preserves current-story gate failure ahead of stale story output retry feedback", () => {
    const source = implementContextSource();
    const preserveStoryId = source.indexOf("const priorContextStoryId = context[\"current_story_id\"] || \"\"");
    const preserveFailure = source.indexOf("const priorContextFailure = context[\"previous_failure\"] || \"\"");
    const clearPreviousFailure = source.indexOf("delete context[\"previous_failure\"]");
    const preservedRetry = source.indexOf("const preservedContextRetryFailure =");
    const retryFailure = source.indexOf("const retryFailureText = nextStory.output");
    const verifyFeedback = source.indexOf("context[\"verify_feedback\"] = mergeRetryFailureTexts([preservedContextRetryFailure, retryFailureText, priorStoryFailureText, retryPatchFailureText, context[\"retry_worktree_patch_restored\"] || \"\"])");
    const combinedRetry = source.indexOf("const combinedRetryFailure = mergeRetryFailureTexts([");
    const combinedRetrySource = source.slice(combinedRetry, combinedRetry + 260);
    const categoryPreserve = source.indexOf("preservedContextRetryFailure && priorContextFailureCategory");
    const suggestionPreserve = source.indexOf("preservedContextRetryFailure && priorContextFailureSuggestion");

    assert.ok(preserveStoryId >= 0, "current story id must be captured before stale context is cleared");
    assert.ok(preserveFailure > preserveStoryId, "current previous_failure must be captured before clearing");
    assert.ok(clearPreviousFailure > preserveFailure, "stale context should still be cleared before rebuilding claim context");
    assert.ok(preservedRetry > clearPreviousFailure, "same-story preserved retry failure should be rebuilt after story identity is known");
    assert.ok(retryFailure > preservedRetry, "story output retry text is secondary to preserved current gate failure");
    assert.ok(verifyFeedback > retryFailure, "verify feedback should prioritize preserved current gate failure");
    assert.ok(combinedRetry > verifyFeedback, "previous_failure should be rebuilt after verify feedback");
    assert.match(combinedRetrySource, /scopeFilesRetryFailure,[\s\S]*preservedContextRetryFailure,[\s\S]*retryFailureText,[\s\S]*priorStoryFailureText/);
    assert.ok(categoryPreserve > combinedRetry, "failure category should preserve the current gate category when available");
    assert.ok(suggestionPreserve > categoryPreserve, "failure suggestion should preserve the current gate suggestion when available");
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

  it("does not hide pending stories after manager guard abandons", () => {
    const source = repoSource();
    const nextPendingStart = source.indexOf("export async function getNextPendingStory(");
    const claimNextStart = source.indexOf("export async function claimNextStory(");
    assert.notEqual(nextPendingStart, -1, "getNextPendingStory source not found");
    assert.notEqual(claimNextStart, -1, "claimNextStory source not found");

    const nextPendingSource = source.slice(nextPendingStart, claimNextStart);
    assert.match(nextPendingSource, /WHERE run_id = \$1 AND status = 'pending'/);
    assert.doesNotMatch(nextPendingSource, /abandoned_count\s*(?:IS NULL|<\s*3)/);
  });

  it("closes single-step failure claims by workflow step id, not step UUID", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const singleFailureStart = source.indexOf("async function handleSingleStepFailurePG(");
    const singleFailureEnd = source.indexOf("// Post-transaction side effects", singleFailureStart);
    assert.notEqual(singleFailureStart, -1, "handleSingleStepFailurePG source not found");
    assert.notEqual(singleFailureEnd, -1, "handleSingleStepFailurePG transaction block not found");
    const singleFailureSource = source.slice(singleFailureStart, singleFailureEnd);

    assert.match(singleFailureSource, /const workflowStepId = step\.step_id \|\| ""/);
    assert.match(singleFailureSource, /step_id = \$\{workflowStepId\}/);
    assert.doesNotMatch(singleFailureSource, /claim_log[\s\S]*step_id = \$\{stepId\}/);
  });

  it("emits workflow step ids instead of internal UUIDs for failStep terminal events", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const failStepStart = source.indexOf("export async function failStep(");
    const loopStart = source.indexOf("async function handleLoopStepFailurePG(");
    const singleStart = source.indexOf("async function handleSingleStepFailurePG(");
    const singleEnd = source.indexOf("// ── Fallback Model Cron", singleStart);
    assert.notEqual(failStepStart, -1, "failStep source not found");
    assert.notEqual(loopStart, -1, "loop failure source not found");
    assert.notEqual(singleStart, -1, "single failure source not found");
    assert.notEqual(singleEnd, -1, "single failure end not found");

    const failStepSource = source.slice(failStepStart, loopStart);
    const loopSource = source.slice(loopStart, singleStart);
    const singleSource = source.slice(singleStart, singleEnd);

    assert.match(failStepSource, /SELECT id, run_id, step_id, step_index/);
    assert.match(loopSource, /const workflowStepId = step\.step_id \|\| stepId/);
    assert.match(loopSource, /event: "step\.failed"[\s\S]*stepId: workflowStepId/);
    assert.match(singleSource, /event: "step\.failed"[\s\S]*stepId: workflowStepId \|\| stepId/);
    assert.doesNotMatch(singleSource, /event: "step\.failed"[\s\S]{0,160}stepId: stepId/);
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

  it("treats supervisor as a critical quality gate instead of skipping it", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const criticalStart = source.indexOf("const CRITICAL_STEPS");
    const qualityStart = source.indexOf("const QUALITY_GATE_STEPS");
    const qualityEnd = source.indexOf("const QUALITY_GATE_MIN_RETRIES", qualityStart);
    assert.notEqual(criticalStart, -1, "CRITICAL_STEPS source not found");
    assert.notEqual(qualityStart, -1, "QUALITY_GATE_STEPS source not found");
    assert.notEqual(qualityEnd, -1, "QUALITY_GATE_STEPS end not found");

    const criticalSource = source.slice(criticalStart, qualityStart);
    const qualitySource = source.slice(qualityStart, qualityEnd);
    assert.match(criticalSource, /"supervise"/);
    assert.match(qualitySource, /"supervise"/);
  });

  it("feeds invalid supervisor output back into the next supervisor attempt", () => {
    const source = stepOpsSource();
    const onCompleteStart = source.indexOf("if (_stepModule.onComplete)");
    const supervisorFeedback = source.indexOf("SUPERVISOR_OUTPUT_INVALID", onCompleteStart);
    assert.notEqual(onCompleteStart, -1, "step module onComplete block not found");
    assert.notEqual(supervisorFeedback, -1, "supervisor output feedback context not found");

    const onCompleteSource = source.slice(onCompleteStart, source.indexOf("const supervisorPhase =", onCompleteStart));
    assert.match(onCompleteSource, /previous_failure/);
    assert.match(onCompleteSource, /failure_suggestion/);
    assert.match(onCompleteSource, /AC_COVERAGE must use the exact current story acceptance-criteria count/);
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
