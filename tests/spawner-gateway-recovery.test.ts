import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");

describe("spawner gateway recovery wiring", () => {
  it("notifies the event-driven spawner when a run starts", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "run.ts"), "utf-8");
    assert.match(source, /pg_notify\('step_pending'/);
    assert.match(source, /agentId:\s*`\$\{workflow\.id\}_\$\{firstStep\.agent\}`/);
  });

  it("restarts gateway after prolonged prespawn readiness failures only when idle", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /GATEWAY_PRESPAWN_RESTART_AFTER_MS/);
    assert.match(source, /activeProcesses\.size > 0\)\s*return/);
    assert.match(source, /execFile\("systemctl",\s*\["--user",\s*"restart",\s*"openclaw-gateway"\]/);
    assert.match(source, /maybeRestartGatewayForReadiness\(gatewayReadiness\.reason,\s*key\)/);
  });

  it("falls back to gateway health when readiness probe times out", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /fetch\(GATEWAY_HEALTH_URL/);
    assert.match(source, /ready endpoint unavailable \(\$\{message\}\); health endpoint returned HTTP 2xx/);
  });

  it("defers background workflows while foreground runs are active", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /SETFARM_BACKGROUND_WORKFLOWS \|\| "daily-standup"/);
    assert.match(source, /function isBackgroundWorkflow\(wfId: string\)/);
    assert.match(source, /async function shouldDeferBackgroundWorkflow\(wfId: string\)/);
    assert.match(source, /await shouldDeferBackgroundWorkflow\(wfId\)/);
    assert.match(source, /Deferring background workflow/);
  });

  it("does not claim gateway cron recreation in event-driven spawner mode", () => {
    const source = fs.readFileSync(path.join(root, "src", "cli", "cli.ts"), "utf-8");
    assert.match(source, /gatewayAgentCronsEnabled/);
    assert.match(source, /event-driven spawner owns workflow/);
  });

  it("delegates verify review-delay decisions to claimStep", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.doesNotMatch(source, /isVerifyReviewDelayActive/);
    assert.doesNotMatch(source, /Verify review delay active/);
    assert.match(source, /claim = await claimStep\(fullAgentId,\s*agentId\)/);
  });

  it("uses per-spawn handoff files for retry isolation", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /const spawnId = Date\.now\(\) \+ "-" \+ Math\.random\(\)\.toString\(36\)\.slice\(2,\s*10\)/);
    assert.match(source, /const outputFileId = agentId \+ "-spawner-" \+ spawnId/);
    assert.match(source, /const sessionId = "spawner-" \+ agentId \+ "-" \+ spawnId/);
    assert.doesNotMatch(source, /const outputFileId = agentId \+ "-spawner";/);
  });

  it("cancels lingering OpenClaw task records by task id after session-key cancel", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function cancelLingeringOpenClawTasksForLookup\(lookup: string,\s*context: string\)/);
    assert.match(source, /\["tasks",\s*"list",\s*"--status",\s*"running",\s*"--runtime",\s*"cli",\s*"--json"\]/);
    assert.match(source, /task\.requesterSessionKey === lookup/);
    assert.match(source, /task\.ownerKey === lookup/);
    assert.match(source, /task\.childSessionKey === lookup/);
    assert.match(source, /cancelOpenClawTaskId\(taskId,\s*context,\s*lookup\)/);
    assert.match(source, /setTimeout\(\(\) => cancelLingeringOpenClawTasksForLookup\(lookup,\s*context\),\s*1500\)/);
  });

  it("sweeps stale Setfarm-owned OpenClaw CLI task records when runtime cancel does not close the registry", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /OPENCLAW_TASKS_DB/);
    assert.match(source, /function markOpenClawTaskRecordCancelled\(taskId: string,\s*lookup: string,\s*context: string\)/);
    assert.match(source, /UPDATE task_runs/);
    assert.match(source, /status = 'cancelled'/);
    assert.match(source, /requester_session_key = \$\{sqliteString\(lookup\)\}/);
    assert.match(source, /function markStaleSetfarmOpenClawTaskRecordsCancelledSync\(context: string\)/);
    assert.match(source, /requester_session_key GLOB 'agent:\*:explicit:spawner-\*'/);
    assert.match(source, /function activeSessionKeyExclusionSql\(\)/);
    assert.match(source, /function cleanupStaleSetfarmOpenClawTaskRecords\(context: string\)/);
    assert.match(source, /markStaleSetfarmOpenClawTaskRecordsCancelledSync\(context\)/);
    assert.match(source, /cleanupStaleSetfarmOpenClawTaskRecords\("startup"\)/);
    assert.match(source, /cleanupStaleSetfarmOpenClawTaskRecords\("prespawn"\)/);
    assert.match(source, /const result = cleanupStaleSetfarmOpenClawTaskRecords\("interval"\)/);
    assert.match(source, /void restartGatewayAfterOpenClawCleanup\("interval",\s*result\)/);
  });

  it("marks stale OpenClaw session index records timed out before spawning", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /OPENCLAW_AGENTS_ROOT/);
    assert.match(source, /type OpenClawSessionIndexRecord/);
    assert.match(source, /function cleanupOpenClawSessionLockSync\(agentDir: string,\s*record: OpenClawSessionIndexRecord\): boolean/);
    assert.match(source, /function cleanupStaleSetfarmOpenClawSessionRecordsSync\(context: string\): number/);
    assert.match(source, /activeSessionKeys\(\)/);
    assert.match(source, /cleanupOpenClawSessionLockSync\(agentDir,\s*record\)/);
    assert.match(source, /record\.status = "timeout"/);
    assert.match(source, /record\.abortedLastRun = true/);
    assert.match(source, /\.jsonl\.lock/);
    assert.match(source, /fs\.writeFileSync\(sessionsPath,\s*JSON\.stringify\(parsed,\s*null,\s*2\) \+ "\\n"\)/);
    assert.match(source, /cleanupStaleSetfarmOpenClawSessionRecordsSync\(context\)/);
  });

  it("restarts the gateway after stale OpenClaw cleanup when no Setfarm agent is active", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /type OpenClawCleanupResult/);
    assert.match(source, /function cleanupStaleSetfarmOpenClawTaskRecords\(context: string\): OpenClawCleanupResult/);
    assert.match(source, /async function restartGatewayAfterOpenClawCleanup\(context: string,\s*result: OpenClawCleanupResult\): Promise<boolean>/);
    assert.match(source, /activeProcesses\.size > 0/);
    assert.match(source, /\["--user",\s*"restart",\s*"openclaw-gateway"\]/);
    assert.match(source, /gateway stale-cleanup restart completed/);
    assert.match(source, /cleanupStaleSetfarmOpenClawTaskRecords\(`\$\{context\}-post-gateway-restart`\)/);
    assert.match(source, /await restartGatewayAfterOpenClawCleanup\("startup",\s*cleanupStaleSetfarmOpenClawTaskRecords\("startup"\)\)/);
    assert.match(source, /await restartGatewayAfterOpenClawCleanup\("prespawn",\s*openClawCleanup\)/);
  });
});
