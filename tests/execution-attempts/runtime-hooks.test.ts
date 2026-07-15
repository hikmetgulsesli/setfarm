import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const stepOps = readFileSync(path.join(root, "src/installer/step-ops.ts"), "utf8");
const stepFail = readFileSync(path.join(root, "src/installer/step-fail.ts"), "utf8");
const cleanupOps = readFileSync(path.join(root, "src/installer/cleanup-ops.ts"), "utf8");
const medic = readFileSync(path.join(root, "src/medic/medic.ts"), "utf8");
const recorder = readFileSync(path.join(root, "src/execution/shadow-attempt-recorder.ts"), "utf8");
const transition = readFileSync(path.join(root, "src/execution/claim-attempt-transition.ts"), "utf8");

describe("shadow runtime hook boundaries", () => {
  it("observes claim only after atomic ownership publication and final worktree identity", () => {
    const mainClaim = stepOps.indexOf("const requestedBaseRef = isPrEach");
    const publication = stepOps.indexOf("const publication = await publishLoopClaimAndRuntime(", mainClaim);
    const worktree = stepOps.indexOf("let storyWorkdir = createStoryWorktree", publication);
    const actualBranch = stepOps.indexOf('execFileSync("git", ["branch", "--show-current"]', worktree);
    const resolvedInput = stepOps.indexOf("const resolvedInput = await resolveLoopClaimInput", actualBranch);
    const hook = stepOps.indexOf("await observeShadowAttemptClaim({", resolvedInput);
    const handoff = stepOps.indexOf("// Single (non-loop) step claim path", resolvedInput);
    assert.ok(publication >= 0 && worktree > publication && actualBranch > worktree && resolvedInput > actualBranch);
    assert.ok(hook > resolvedInput, "shadow claim must follow durable ownership and final agent-visible source identity");
    assert.ok(hook > resolvedInput && hook < handoff, "source-before must capture the final agent-visible worktree");
    assert.match(stepOps.slice(publication, worktree), /legacyClaimId = publication\.claimId/);
    assert.match(stepOps.slice(publication, worktree), /claimRuntime = publication\.runtime/);
    assert.match(stepOps.slice(hook, handoff), /shadowAttempt\s*=\s*\{/);
    assert.match(stepOps.slice(hook, handoff), /attemptId:\s*shadowClaim\.attempt\.attemptId/);
    assert.match(stepOps.slice(hook, handoff), /generation:\s*shadowClaim\.attempt\.generation/);
    assert.match(stepOps.slice(hook, handoff), /fenceToken:\s*shadowClaim\.attempt\.fenceToken/);
    assert.match(stepOps.slice(hook, handoff), /attempt:\s*shadowAttempt/);
  });

  it("captures source evidence before one atomic claim-attempt-story-step completion", () => {
    const exactStart = stepOps.indexOf("const exactCompletionEnvelope = completionAuthority?.envelope");
    const sourceCapture = stepOps.indexOf("await captureShadowSourceRevision", exactStart);
    const terminalOwner = stepOps.indexOf("await completeStoryClaimAndBoundAttempt", sourceCapture);
    assert.ok(exactStart >= 0 && sourceCapture > exactStart && terminalOwner > sourceCapture);
    assert.doesNotMatch(stepOps.slice(exactStart, terminalOwner + 200), /observeShadowAttemptSuccess/);

    const ownerStart = transition.indexOf("export async function completeStoryClaimAndBoundAttempt");
    const attemptClose = transition.indexOf("UPDATE execution_attempts", ownerStart);
    const claimClose = transition.indexOf("UPDATE claim_log", attemptClose);
    const storyPublish = transition.indexOf("UPDATE stories", claimClose);
    const stepPublish = transition.indexOf("UPDATE steps", storyPublish);
    assert.ok(ownerStart >= 0 && attemptClose > ownerStart && claimClose > attemptClose);
    assert.ok(storyPublish > claimClose && stepPublish > storyPublish);
  });

  it("publishes the exact claim, attempt, loop state, and owner receipt atomically", () => {
    const start = stepFail.indexOf("async function handleLoopStepFailurePG(");
    const end = stepFail.indexOf("// ── Single step failure", start);
    const block = stepFail.slice(start, end);
    const prepare = block.indexOf("await prepareShadowAttemptFailure({");
    const firstStoryRead = block.indexOf("const story = await pgGet");
    const lifecycleOwner = stepFail.indexOf("async function terminalizeLoopClaimAndState(");
    const ownerTransaction = stepFail.indexOf("await pgBegin(async (sql) => {", lifecycleOwner);
    const ownerTransition = stepFail.indexOf("await closeClaimAndBoundAttemptInTransaction(", ownerTransaction);
    const storyState = stepFail.indexOf("UPDATE stories", ownerTransition);
    const stepState = stepFail.indexOf("UPDATE steps", storyState);
    const ownerReceipt = stepFail.indexOf("await markRuntimeCompletionOwnerCommittedInTransaction(", stepState);
    const ownerFinalize = stepFail.indexOf("await finalizeShadowAttemptFailure(", ownerReceipt);
    assert.ok(prepare >= 0 && prepare < firstStoryRead);
    assert.ok(lifecycleOwner >= 0 && ownerTransaction > lifecycleOwner);
    assert.ok(ownerTransition > ownerTransaction && storyState > ownerTransition && stepState > storyState);
    assert.ok(ownerReceipt > stepState, "RCR owner receipt must follow claim and product state in the same transaction");
    assert.ok(ownerFinalize > ownerReceipt, "post-commit shadow telemetry must follow the authoritative owner transaction");
    assert.equal((block.match(/await terminalizeLoopClaimAndState\(/g) || []).length, 3);
    assert.equal((block.match(/return \{ retrying:/g) || []).length, 3);
    for (const marker of [
      "failStep:loopInfraRetry",
      "failStep:loopStoryExhausted",
      "failStep:loopStoryRetry",
    ]) {
      const stateTransition = block.indexOf(marker);
      const precedingOwner = block.lastIndexOf("await terminalizeLoopClaimAndState(", stateTransition);
      assert.ok(precedingOwner >= 0 && precedingOwner < stateTransition, `${marker} must follow lifecycle terminalization`);
    }
    assert.doesNotMatch(block, /removeStoryWorktree|cleanupProjectEphemera/);
  });

  it("keeps classifiers, supervisor, and prompt parsing out of the recorder", () => {
    assert.doesNotMatch(recorder, /pr-comment|product-supervisor|supervisor\/|parseOutputKeyValues|GitHub/i);
    assert.doesNotMatch(recorder, /spawner(?:-prompt)?\.js/);
    assert.doesNotMatch(recorder, /await db\.pgMigrate\(/);
  });

  it("keeps legacy timeout healers from owning compiler-run lifecycle", () => {
    const cleanupStart = cleanupOps.indexOf("export async function cleanupAbandonedSteps(");
    const stuckPipelines = cleanupOps.indexOf("// Recover stuck pipelines", cleanupStart);
    const stuckVerify = cleanupOps.indexOf("// Recover stuck verify_each", stuckPipelines);
    const cleanupEnd = cleanupOps.indexOf("// ── Progress Archiving", stuckVerify);
    assert.equal((cleanupOps.slice(cleanupStart, stuckPipelines).match(/r\.protocol = 'legacy'/g) || []).length, 2);
    assert.match(cleanupOps.slice(stuckPipelines, stuckVerify), /r\.protocol = 'legacy'/);
    assert.match(cleanupOps.slice(stuckVerify, cleanupEnd), /r\.protocol = 'legacy'/);

    const resumeStart = medic.indexOf('case "resume_run":');
    const resetStart = medic.indexOf('case "reset_story":');
    const resetEnd = medic.indexOf('case "advance_pipeline":', resetStart);
    assert.match(medic.slice(resumeStart, resetStart), /preCheck\.protocol !== "legacy"/);
    assert.match(medic.slice(resetStart, resetEnd), /story\.protocol !== "legacy"/);
    assert.match(medic, /compilerUnsafeActions\.has\(finding\.action\)/);
    const gatewayRestart = medic.indexOf('if (finding.action === "restart_gateway")');
    const gatewayMutation = medic.indexOf('systemctlUser("restart", "openclaw-gateway")', gatewayRestart);
    const compilerOwnerGuard = medic.indexOf("protocol IN ('shadow', 'v3')", gatewayRestart);
    const attemptOwnerGuard = medic.indexOf("disposition IN ('claimed', 'running')", compilerOwnerGuard);
    assert.ok(gatewayRestart >= 0 && compilerOwnerGuard > gatewayRestart && attemptOwnerGuard > compilerOwnerGuard);
    assert.ok(gatewayMutation > attemptOwnerGuard, "gateway restart must follow compiler owner guard");
  });

  it("terminalizes a platform push failure with compiler story and run state atomically", () => {
    const start = stepOps.indexOf("const pushFailure = `PLATFORM_STORY_PUSH_FAILED");
    const end = stepOps.indexOf('checkId: "implement.platform_push.done"', start);
    const block = stepOps.slice(start, end);
    const lifecycle = block.indexOf("await terminalizeLoopClaimAndState({");
    assert.ok(start >= 0 && end > start && lifecycle >= 0);
    assert.match(block.slice(lifecycle), /state:\s*\{[\s\S]*storyStatus:\s*"failed"[\s\S]*stepStatus:\s*"failed"[\s\S]*runFailureDiagnostic:/);
    assert.doesNotMatch(block, /await pgBegin|await failRun|UPDATE claim_log/);
  });
});
