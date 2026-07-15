import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf8");

describe("spawner OpenClaw terminal ownership", () => {
  it("reads the JSON terminal envelope before treating process code zero as completion", () => {
    const exitStart = source.indexOf('child.once("exit"');
    const exitEnd = source.indexOf("if (child.pid && claim.runId", exitStart);
    assert.notEqual(exitStart, -1);
    assert.notEqual(exitEnd, -1);
    const exitHandler = source.slice(exitStart, exitEnd);
    assert.match(exitHandler, /readOpenClawAgentTerminalOutcome\(transcriptPath\)/);
    assert.ok(
      exitHandler.indexOf("readOpenClawAgentTerminalOutcome") < exitHandler.indexOf("code === 0"),
      "machine-readable terminal status must be evaluated before process code zero",
    );
    assert.match(exitHandler, /new OpenClawAgentTerminalError\(openClawTerminalOutcome\)/);
  });

  it("routes typed retryable transport outcomes to the infra owner without a prose regex", () => {
    const settleStart = source.indexOf("async function failClaimIfStillRunning");
    const settleEnd = source.indexOf("async function settleExitedClaimAndRuntime", settleStart);
    assert.notEqual(settleStart, -1);
    assert.notEqual(settleEnd, -1);
    const settle = source.slice(settleStart, settleEnd);
    assert.match(settle, /err instanceof OpenClawAgentTerminalError/);
    assert.match(settle, /openClawTerminalFailure\?\.retryable/);
    assert.match(settle, /retryActiveSingleStepClaim\(active, row\.step_id, reason\)/);
    assert.match(settle, /requeueOpenStoryClaim/);
    assert.doesNotMatch(settle, /OPENCLAW_AGENT_TIMEOUT.*includes|includes.*OPENCLAW_AGENT_TIMEOUT/);
  });

  it("reconciles the exact terminal task registry before waiting on the wrapper process", () => {
    const reconcileStart = source.indexOf("async function reconcileTerminalOpenClawTask");
    const reconcileEnd = source.indexOf("type RunningStepRow", reconcileStart);
    assert.notEqual(reconcileStart, -1);
    assert.notEqual(reconcileEnd, -1);
    const reconcile = source.slice(reconcileStart, reconcileEnd);
    assert.match(reconcile, /readOpenClawTaskRegistryProbe\(\{[\s\S]*sessionKey: active\.sessionKey/);
    assert.match(reconcile, /setfarm\.openclaw-task-terminal-evidence\.v1/);
    assert.match(reconcile, /terminateActiveProcess\(active, "openclaw-task-registry-terminal"\)/);
    assert.ok(
      reconcile.indexOf('terminateActiveProcess(active, "openclaw-task-registry-terminal")')
        < reconcile.indexOf("completeActiveClaimFromOutputFile(active)"),
      "the terminal wrapper must be stopped before its output is recovered",
    );
    assert.ok(
      reconcile.indexOf("completeActiveClaimFromOutputFile(active)")
        < reconcile.indexOf("settleExitedClaimAndRuntime(active, error)"),
      "fresh fenced output must win before task failure is routed to retry",
    );

    const reapStart = source.indexOf("async function reapFinishedClaims");
    const terminalProcess = source.indexOf("const terminalReason = childProcessTerminalReason", reapStart);
    const terminalTask = source.indexOf("await reconcileTerminalOpenClawTask", reapStart);
    assert.notEqual(terminalTask, -1);
    assert.ok(terminalTask < terminalProcess, "task registry must close the wrapper/process liveness split first");
  });
});
