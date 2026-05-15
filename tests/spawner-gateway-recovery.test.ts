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

  it("does not defer active QA-FIX implement work behind older done stories", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const stepPendingStart = source.indexOf("async function handleStepPending(");
    const storyPendingStart = source.indexOf("async function handleStoryPending(");
    const storyPendingEnd = source.indexOf("async function advanceCompletedVerifyEachLoops", storyPendingStart);
    const pollStart = source.indexOf("async function pollForPendingWork(");
    const pollEnd = source.indexOf("async function main()", pollStart);
    assert.notEqual(stepPendingStart, -1, "handleStepPending source not found");
    assert.notEqual(storyPendingStart, -1, "handleStoryPending source not found");
    assert.notEqual(storyPendingEnd, -1, "handleStoryPending end not found");
    assert.notEqual(pollStart, -1, "pollForPendingWork source not found");
    assert.notEqual(pollEnd, -1, "pollForPendingWork end not found");
    const stepPendingSource = source.slice(stepPendingStart, storyPendingStart);
    const storyPendingSource = source.slice(storyPendingStart, storyPendingEnd);
    const pollSource = source.slice(pollStart, pollEnd);

    for (const block of [stepPendingSource, storyPendingSource]) {
      assert.match(block, /const activeQaFix = await pgGet/);
      assert.match(block, /const activeStory = await pgGet/);
      assert.match(block, /story_id LIKE 'QA-FIX-%'/);
      assert.match(block, /retry_count > 0/);
      assert.match(block, /parseInt\(awaitingVerify\?\.cnt \|\| "0", 10\) > 0 && parseInt\(activeStory\?\.cnt \|\| "0", 10\) === 0 && parseInt\(activeQaFix\?\.cnt \|\| "0", 10\) === 0/);
    }

    const pollQaFixGuards = pollSource.match(/story_id LIKE 'QA-FIX-%'/g) || [];
    assert.equal(pollQaFixGuards.length, 2, "polling queries must keep active QA-FIX work visible");
    const pollActiveStoryGuards = pollSource.match(/stories active_st/g) || [];
    assert.equal(pollActiveStoryGuards.length, 2, "polling queries must keep retried active stories visible");
    assert.match(pollSource, /fix_st\.run_id = s\.run_id/);
    assert.match(pollSource, /fix_st\.status IN \('pending', 'running'\)/);
    assert.match(pollSource, /active_st\.run_id = s\.run_id/);
    assert.match(pollSource, /active_st\.status IN \('pending', 'running'\)/);
    assert.match(pollSource, /active_st\.retry_count > 0/);
  });

  it("does not claim gateway cron recreation in event-driven spawner mode", () => {
    const source = fs.readFileSync(path.join(root, "src", "cli", "cli.ts"), "utf-8");
    assert.match(source, /gatewayAgentCronsEnabled/);
    assert.match(source, /event-driven spawner owns workflow/);
  });

  it("accepts positional output file paths for step completion", () => {
    const source = fs.readFileSync(path.join(root, "src", "cli", "cli.ts"), "utf-8");
    assert.match(source, /function isLikelyOutputFileArg/);
    assert.match(source, /async function readFreshStepOutputFile/);
    assert.match(source, /outputArgs\.length === 1 && isLikelyOutputFileArg\(outputArgs\[0\]\)/);
    assert.match(source, /Cannot read file \$\{outputArgs\[0\]\}: file does not exist\. Use stdin for literal one-argument output\./);
    assert.match(source, /await readFreshStepOutputFile\(target,\s*outputArgs\[0\]\)/);
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

  it("completes security-gate inline before spawning an agent process", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const spawnStart = source.indexOf("async function spawnAgentNow");
    const promptBuild = source.indexOf("const prompt = buildPreclaimedPrompt", spawnStart);
    const inlineGate = source.indexOf("completeInlineSecurityGateIfApplicable", spawnStart);
    assert.notEqual(spawnStart, -1, "spawnAgentNow source not found");
    assert.notEqual(promptBuild, -1, "prompt build source not found");
    assert.notEqual(inlineGate, -1, "inline security gate source not found");
    assert.ok(inlineGate > spawnStart && inlineGate < promptBuild, "security-gate must complete inline before any agent prompt is built");
    assert.match(source, /function isSecurityGateRole\(role: string,\s*agentId: string\)/);
    assert.match(source, /function runInlineSecurityScan\(repo: string\)/);
    assert.match(source, /const stepId = claim\.stepId/);
    assert.match(source, /await completeStep\(stepId,\s*output\)/);
  });

  it("starts agents in the claimed story worktree when one is available", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function safeAgentCwdFromClaimInput\(input: unknown\): string/);
    assert.match(source, /STORY_WORKDIR_CANDIDATE_KEYS/);
    assert.match(source, /"story_workdir",\s*"STORY_WORKDIR",\s*"verify_workdir",\s*"VERIFY_WORKDIR",\s*"WORKDIR",\s*"workdir"/);
    assert.match(source, /REPO_CANDIDATE_KEYS/);
    assert.match(source, /\\\/home\\\/setrox\\\/projects\\\//);
    assert.match(source, /prepared story worktree/);
    assert.match(source, /story-worktrees/);
    assert.match(source, /safeAgentCwdFromTextLabels\(input,\s*STORY_WORKDIR_CANDIDATE_KEYS\)/);
    assert.match(source, /safeAgentCwdFromTextLabels\(input,\s*REPO_CANDIDATE_KEYS\)/);
    assert.match(source, /CLAIM_WORKDIR_MISSING/);
    assert.match(source, /claim\.storyId && spawnCwd === AGENT_SAFE_CWD/);
    assert.match(source, /resolved === SETFARM_SRC \|\| resolved\.startsWith\(SETFARM_SRC \+ path\.sep\)/);
    assert.match(source, /const spawnCwd = safeAgentCwdFromClaimInput\(claim\.resolvedInput\)/);
    assert.match(source, /JSON\.stringify\(\{ stepId: claim\.stepId, runId: claim\.runId, workdir: spawnCwd, repo: spawnCwd, input: claim\.resolvedInput \}\)/);
    assert.match(source, /const claimSummaryFile = path\.join\("\/tmp", "claim-summary-" \+ outputFileId \+ "\.json"\)/);
    assert.match(source, /JSON\.stringify\(buildClaimSummary\(\{/);
    assert.match(source, /claimSummaryFile,/);
    assert.match(source, /buildResolvedClaimBootstrapScript\(\{/);
    assert.match(source, /workdir: spawnCwd/);
    assert.match(source, /cwd: spawnCwd/);
    assert.match(source, /cwd=\$\{spawnCwd\}/);
  });

  it("does not leak service NODE_ENV into spawned project agents", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const envStart = source.indexOf("function buildOpenClawChildEnv");
    const envEnd = source.indexOf("function buildSessionKey", envStart);
    assert.notEqual(envStart, -1, "buildOpenClawChildEnv source not found");
    assert.notEqual(envEnd, -1, "buildOpenClawChildEnv end not found");
    const envSource = source.slice(envStart, envEnd);

    assert.match(envSource, /delete e\["NODE_ENV"\]/);
    assert.match(envSource, /OPENCLAW_AUTO_APPROVE: "1"/);
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

  it("does not reap an active agent immediately when the claimed step leaves running", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /REAP_FINISHED_ACTIVE_GRACE_MS/);
    assert.match(source, /function activeProcessIdleMs\(active: ActiveProcess\): number/);
    assert.match(source, /row\.run_status === "running" && idleMs < REAP_FINISHED_ACTIVE_GRACE_MS/);
    assert.match(source, /Deferring reap for/);
  });

  it("logs transient async failures without crashing the event-driven spawner", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /process\.on\("unhandledRejection"/);
    assert.match(source, /unhandled rejection/);
  });

  it("runs PostgreSQL migration guards before startup recovery", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /import \{ pgClose, pgGet, pgMigrate, pgQuery, pgRun \} from "\.\/db-pg\.js"/);
    assert.match(source, /await pgMigrate\(\);\s*killStartupOrphanSpawnerAgents\(\);\s*await failStaleRunningClaimsFromPreviousSpawner\(\);/);
  });

  it("keeps PostgreSQL shutdown ordering under spawner control", () => {
    const dbSource = fs.readFileSync(path.join(root, "src", "db-pg.ts"), "utf-8");
    const spawnerSource = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const shutdownStart = spawnerSource.indexOf("const shutdown = async () =>");
    const shutdownEnd = spawnerSource.indexOf("process.on(\"SIGTERM\"", shutdownStart);
    assert.notEqual(shutdownStart, -1, "async shutdown handler not found");
    assert.notEqual(shutdownEnd, -1, "shutdown block end not found");
    const shutdownSource = spawnerSource.slice(shutdownStart, shutdownEnd);

    assert.match(dbSource, /export function installPgSignalHandlers\(\): void \{/);
    assert.match(dbSource, /process\.on\("SIGTERM", \(\) => \{/);
    assert.doesNotMatch(dbSource, /\/\/ P4-05: Graceful shutdown\nprocess\.on\("SIGTERM"/);
    assert.match(shutdownSource, /await releaseActiveProcessForShutdown\(active\)/);
    assert.match(shutdownSource, /await pgClose\(\)/);
    assert.ok(shutdownSource.indexOf("await releaseActiveProcessForShutdown(active)") < shutdownSource.indexOf("await pgClose()"));
  });

  it("closes active claim_log rows when shutdown releases a running step", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const releaseStart = source.indexOf("async function releaseActiveProcessForShutdown(");
    const releaseEnd = source.indexOf("function cancelRunAgents", releaseStart);
    assert.notEqual(releaseStart, -1, "releaseActiveProcessForShutdown source not found");
    assert.notEqual(releaseEnd, -1, "releaseActiveProcessForShutdown end not found");
    const releaseSource = source.slice(releaseStart, releaseEnd);

    assert.match(releaseSource, /LEFT JOIN stories st ON st\.id = s\.current_story_id/);
    assert.match(releaseSource, /UPDATE claim_log SET outcome = 'infra_retry'/);
    assert.match(releaseSource, /Spawner shutdown released active single-step claim/);
    assert.match(releaseSource, /step_id = \$3 AND story_id IS NULL AND agent_id = \$4 AND outcome IS NULL/);
    assert.match(releaseSource, /Spawner shutdown released active loop claim/);
    assert.match(releaseSource, /step_id = \$3 AND story_id = \$4 AND agent_id = \$5 AND outcome IS NULL/);
    assert.doesNotMatch(releaseSource, /story_id = \$3 AND agent_id = \$4 AND outcome IS NULL/);
  });

  it("enforces one open claim per run step story and agent at the database layer", () => {
    const source = fs.readFileSync(path.join(root, "src", "db-pg.ts"), "utf-8");
    assert.match(source, /LEAST\(CAST\(EXTRACT\(EPOCH FROM \(NOW\(\) - cl\.claimed_at::timestamptz\)\) \* 1000 AS BIGINT\), 2147483647\)::INTEGER/);
    assert.match(source, /pgMigrate closed orphan open claim without parent run/);
    assert.match(source, /NOT EXISTS \(SELECT 1 FROM runs r WHERE r\.id = cl\.run_id\)/);
    assert.match(source, /pgMigrate closed open claim for terminal run/);
    assert.match(source, /r\.status NOT IN \('running', 'resuming'\)/);
    assert.match(source, /pgMigrate deduped duplicate open single-step claim/);
    assert.match(source, /PARTITION BY run_id, step_id, agent_id/);
    assert.match(source, /pgMigrate deduped duplicate open story claim/);
    assert.match(source, /PARTITION BY run_id, step_id, story_id, agent_id/);
    assert.match(source, /idx_claim_log_open_single_unique/);
    assert.match(source, /ON claim_log\(run_id, step_id, agent_id\) WHERE outcome IS NULL AND story_id IS NULL/);
    assert.match(source, /idx_claim_log_open_story_unique/);
    assert.match(source, /ON claim_log\(run_id, step_id, story_id, agent_id\) WHERE outcome IS NULL AND story_id IS NOT NULL/);
  });

  it("recovers build-passing implement work when an agent exits without step completion", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /tryRecoverExitedImplementWork/);
    assert.match(source, /without calling setfarm step complete\/fail/);
    assert.match(source, /row\.step_id !== "implement"/);
    assert.match(source, /findDiffBaseRef\(workdir\)/);
    assert.match(source, /sourceStatusFiles\(workdir\)/);
    assert.match(source, /sourceTouchedFiles\(workdir,\s*baseRef\)/);
    assert.match(source, /runBuildGate\(workdir\)/);
    assert.match(source, /commitRecoveredImplementWork\(workdir,\s*story\.story_id,\s*changedFiles\)/);
    assert.match(source, /git",\s*\["add",\s*"--",\s*\.\.\.uniqueFiles\]/);
    assert.match(source, /RECOVERY: agent-exit-build-passing/);
    assert.match(source, /RECOVERY_COMMIT:/);
    assert.match(source, /await completeStep\(stepDbId,\s*recoveryOutput\)/);
    assert.match(source, /exitReason\.includes\("AGENT_STARTUP_SILENT"\)/);
    assert.match(source, /exitReason\.includes\("AGENT_PROCESS_STUCK"\)/);
    assert.match(source, /failClaimIfStillRunning\(active\.stepId,\s*active\.agentId,\s*active\.wfId,\s*active\.role,\s*active\.transcriptPath,\s*new Error\(reason\),\s*active\.startedAtMs,\s*active\.spawnCwd,\s*active\.outputPath\)/);
  });

  it("treats CPU progress as agent activity before watchdog kills a process", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /lastCpuTicks\?: number/);
    assert.match(source, /lastCpuActivityMs\?: number/);
    assert.match(source, /function readProcessCpuTicks/);
    assert.match(source, /\/proc\/\$\{pid\}\/stat/);
    assert.match(source, /function refreshActiveProcessCpuActivity/);
    assert.match(source, /ticks > active\.lastCpuTicks/);
    assert.match(source, /active\.lastCpuActivityMs = Date\.now\(\)/);
    assert.match(source, /let lastActivityMs = active\.startedAtMs/);
    assert.match(source, /lastActivityMs = refreshActiveProcessCpuActivity\(active\)/);
    assert.match(source, /lastCpuTicks: readProcessCpuTicks\(child\.pid\) \?\? undefined/);
  });

  it("writes running agent heartbeat output from session activity", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /SETFARM_AGENT_HEARTBEAT_MS/);
    assert.match(source, /lastHeartbeatMs\?: number/);
    assert.match(source, /lastHeartbeatSignature\?: string/);
    assert.match(source, /function latestSessionActivitySummary/);
    assert.match(source, /fs\.readFileSync\(active\.sessionJsonlPath,\s*"utf-8"\)\.slice\(-256_000\)/);
    assert.match(source, /async function updateRunningStepHeartbeat/);
    assert.match(source, /HEARTBEAT:/);
    assert.match(source, /LAST_SESSION_ACTIVITY:/);
    assert.match(source, /UPDATE steps SET output = \$1, updated_at = NOW\(\) WHERE id = \$2 AND status = 'running'/);
    assert.match(source, /await updateRunningStepHeartbeat\(active,\s*row\.step_id,\s*ageMs\)/);
  });

  it("kills implement claims that read shared generated screen files", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function generatedScreenReadGuard\(active: ActiveProcess\)/);
    assert.match(source, /readStoryScopeFileSet\(active\.spawnCwd\)/);
    assert.match(source, /isGeneratedScreenComponentPath/);
    assert.match(source, /src\\\/screens\\\/\[\^\/\]\+\\\.tsx/);
    assert.match(source, /extractGeneratedScreenReadsFromCommand/);
    assert.match(source, /function shellCommandSegments/);
    assert.match(source, /function isGeneratedScreenContentReadSegment/);
    assert.match(source, /function stripGeneratedScreenSafeMetadataRefs/);
    assert.match(source, /function stripExplicitGeneratedScreenComponentRefs/);
    assert.match(source, /function hasBroadGeneratedScreenSourceRef/);
    assert.match(source, /\bhead\b\|tail\|less\|bat\|rg\|grep/);
    assert.match(source, /readFileSync\|readdirSync\|createReadStream/);
    const screenExtractor = source.slice(
      source.indexOf("function isGeneratedScreenContentReadSegment"),
      source.indexOf("function generatedScreenReadGuard"),
    );
    assert.doesNotMatch(screenExtractor, /\|find\|/);
    assert.match(screenExtractor, /const unsafeSegment = stripGeneratedScreenSafeMetadataRefs\(segment\)/);
    assert.match(screenExtractor, /src\\\/screens\(\?:\\\/\|\\s\|\$\)\/\.test\(unsafeSegment\)/);
    assert.doesNotMatch(screenExtractor, /src\\\/screens\(\?:\\\/\|\\s\|\$\)\/\.test\(segment\)/);
    assert.match(screenExtractor, /hasBroadGeneratedScreenSourceRef\(unsafeSegment\)/);
    assert.match(source, /stripExplicitGeneratedScreenComponentRefs\(text\)/);
    assert.match(screenExtractor, /\[\^'"\`\\s;\|&\*\?\[\\\]\]\+\\\.tsx/);
    assert.match(source, /src\/screens\/\*\.tsx/);
    assert.doesNotMatch(source, /allowed\.size === 0\)\s*return \{ detected: false/);
    assert.match(source, /GENERATED_SCREEN_SHARED_READ/);
    assert.match(source, /async function recordSupervisorRuntimeEvent/);
    assert.match(source, /PRODUCT_SUPERVISOR_RUNTIME_GUARD/);
    assert.match(source, /const effectiveStoryId = active\.storyId \|\| row\.story_id \|\| undefined/);
    assert.match(source, /const effectiveStoryDbId = active\.storyDbId \|\| row\.current_story_id \|\| undefined/);
    assert.match(source, /row\.type === "loop" && row\.step_id === "implement" && effectiveStoryId/);
    assert.match(source, /terminateActiveProcess\(active,\s*"generated-screen-read-guard"\)/);
    assert.ok(
      source.indexOf("recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId") < source.indexOf("await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId"),
      "generated screen guard must write supervisor runtime memory before retrying the story claim",
    );
    assert.match(source, /await requeueOpenStoryClaim\(active\.runId,\s*row\.step_id,\s*effectiveStoryId,\s*active\.agentId,\s*reason\)/);
    assert.ok(
      source.indexOf("generatedScreenReadGuard(active)") < source.indexOf("const terminalReason = childProcessTerminalReason(active.child)"),
      "generated screen read guard must run before terminal-process recovery so quick exec/head exits cannot bypass it",
    );
  });

  it("kills implement claims that read raw Stitch design corpus", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function rawStitchDesignReadGuard\(active: ActiveProcess\)/);
    assert.match(source, /function isRawStitchDesignPath/);
    assert.match(source, /stitch\/\*\.html/);
    assert.match(source, /stitch\/\*/);
    assert.match(source, /stripSafeStitchMetadataRefs\(segment\)/);
    assert.match(source, /stitch\/DESIGN_DOM\.json/);
    assert.match(source, /\.stitch-screens\*\.json/);
    assert.match(source, /RAW_STITCH_CONTEXT_READ/);
    assert.match(source, /injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX/);
    assert.match(source, /terminateActiveProcess\(active,\s*"raw-stitch-read-guard"\)/);
    assert.ok(
      source.indexOf("rawStitchDesignReadGuard(active)") > source.indexOf("generatedScreenReadGuard(active)"),
      "raw Stitch guard should run after the more specific generated-screen guard",
    );
    assert.ok(
      source.indexOf("rawStitchDesignReadGuard(active)") < source.indexOf("const terminalReason = childProcessTerminalReason(active.child)"),
      "raw Stitch read guard must run before terminal-process recovery",
    );
  });

  it("kills implement claims that keep reasoning without any source delta", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /IMPLEMENT_NO_DELTA_GRACE_MS/);
    assert.match(source, /SETFARM_IMPLEMENT_NO_DELTA_GRACE_MS/);
    assert.match(source, /function implementNoDeltaStallGuard\(active: ActiveProcess, ageMs: number\)/);
    assert.match(source, /sourceStatusFiles\(active\.spawnCwd\)/);
    assert.match(source, /IMPLEMENT_NO_DELTA_STALL/);
    assert.match(source, /terminateActiveProcess\(active,\s*"implement-no-delta-stall"\)/);
    assert.match(source, /await requeueOpenStoryClaim\(active\.runId, row\.step_id, effectiveStoryId, active\.agentId, reason\)/);
    assert.ok(
      source.indexOf("implementNoDeltaStallGuard(active, ageMs)") < source.indexOf("const terminalReason = childProcessTerminalReason(active.child)"),
      "no-delta stall guard must run before terminal-process recovery",
    );
  });

  it("kills implement claims that sprawl through context before the first source delta", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /IMPLEMENT_PRE_DELTA_MAX_CONTEXT_READS/);
    assert.match(source, /SETFARM_IMPLEMENT_PRE_DELTA_MAX_CONTEXT_READS/);
    assert.match(source, /function implementPreDeltaExplorationGuard\(active: ActiveProcess\)/);
    assert.match(source, /function isPreDeltaSafeContextPath\(relativePath: string,\s*allowed: Set<string>\)/);
    assert.match(source, /const allowed = readStoryScopeFileSet\(active\.spawnCwd\)/);
    assert.match(source, /allowed\.has\(normalized\)/);
    assert.match(source, /src\\\/screens\(\?:\\\/\(\?:SCREEN_INDEX\\\.json\|index\\\.ts\)\)\?/);
    assert.match(source, /package\\\.json\|package-lock\\\.json\|pnpm-lock\\\.yaml\|yarn\\\.lock/);
    assert.match(source, /IMPLEMENT_PRE_DELTA_CONTEXT_SPRAWL/);
    assert.match(source, /first-delta supervisor discipline/);
    assert.match(source, /preDeltaContextReadsFromCommand\(active, call\.command\)/);
    assert.match(source, /!isPreDeltaSafeContextPath\(relativePath,\s*allowed\)/);
    assert.match(source, /contextReads\.add\(normalizePreDeltaContextPath\(relativePath\)\)/);
    assert.match(source, /terminateActiveProcess\(active,\s*"implement-pre-delta-context-guard"\)/);
    assert.ok(
      source.indexOf("implementPreDeltaExplorationGuard(active)") > source.indexOf("rawStitchDesignReadGuard(active)"),
      "pre-delta context guard should run after more specific context guards",
    );
    assert.ok(
      source.indexOf("implementPreDeltaExplorationGuard(active)") < source.indexOf("implementNoDeltaStallGuard(active, ageMs)"),
      "pre-delta context guard should run before the slower no-delta stall timeout",
    );
  });

  it("kills implement claims that load irrelevant or full reference files", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function implementReferenceReadGuard\(active: ActiveProcess\)/);
    assert.match(source, /function storyScopeLooksBackend\(workdir: string\)/);
    assert.match(source, /references\\\/\[\^\/\]\+\\\.md/);
    assert.match(source, /IRRELEVANT_REFERENCE_CONTEXT/);
    assert.match(source, /FULL_REFERENCE_CONTEXT_READ/);
    assert.match(source, /Backend\/API\/DB standards must not be loaded into frontend\/game story context/);
    assert.match(source, /candidate\.full/);
    assert.match(source, /terminateActiveProcess\(active,\s*"reference-read-guard"\)/);
    assert.match(source, /--- REFERENCE READ GUARD/);
    assert.ok(
      source.indexOf("implementReferenceReadGuard(active)") < source.indexOf("generatedScreenReadGuard(active)"),
      "reference context guard should run before generated-screen guard so stale reference mandates are retried early",
    );
    assert.ok(
      source.indexOf("recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId") < source.indexOf("terminateActiveProcess(active, \"reference-read-guard\")"),
      "reference guard must write supervisor runtime memory before killing the claim",
    );
    assert.match(source, /await requeueOpenStoryClaim\(active\.runId,\s*row\.step_id,\s*effectiveStoryId,\s*active\.agentId,\s*reason\)/);
  });

  it("hands agents a structured claim summary and kills raw claim parsing loops", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const promptSource = fs.readFileSync(path.join(root, "src", "spawner-prompt.ts"), "utf-8");
    assert.match(promptSource, /export function buildClaimSummary/);
    assert.match(promptSource, /schema: "setfarm\.claim-summary\.v1"/);
    assert.match(promptSource, /generatedScreenPolicy/);
    assert.match(promptSource, /readSupervisorMemoryFile/);
    assert.match(promptSource, /supervisorMemory/);
    assert.match(promptSource, /No generated screen source file is in scope/);
    assert.match(promptSource, /Read the structured claim summary/);
    assert.match(promptSource, /Do NOT parse or dump claim\.input with jq\/sed\/head\/node loops/);
    assert.match(promptSource, /CLAIM_SUMMARY_FILE/);
    assert.match(source, /CLAIM_PARSE_LOOP_MIN_READS/);
    assert.match(source, /function claimParseLoopGuard\(active: ActiveProcess\)/);
    assert.match(source, /CLAIM_PARSE_LOOP/);
    assert.match(source, /CLAIM_SUMMARY_IGNORED/);
    assert.match(source, /terminateActiveProcess\(active,\s*"claim-parse-loop-guard"\)/);
    assert.ok(
      source.indexOf("claimParseLoopGuard(active)") < source.indexOf("implementReferenceReadGuard(active)"),
      "claim parse loop guard should run before context-pollution guards",
    );
    assert.match(source, /await requeueOpenStoryClaim\(active\.runId,\s*row\.step_id,\s*effectiveStoryId,\s*active\.agentId,\s*reason\)/);
  });

  it("kills implement claims that write outside story scope during runtime", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function implementScopeWriteGuard\(active: ActiveProcess\)/);
    assert.match(source, /readStoryScopeFileSet\(active\.spawnCwd\)/);
    assert.match(source, /SCOPE_WRITE_VIOLATION/);
    assert.match(source, /attempted \$\{call\.name\} on \$\{relativePath\}/);
    assert.match(source, /isRuntimeScopeAllowedWrite/);
    assert.match(source, /\\\.\(test\|spec\)\\\.\[cm\]\?\[jt\]sx\?/);
    assert.match(source, /terminateActiveProcess\(active,\s*"scope-write-guard"\)/);
    assert.match(source, /--- SCOPE WRITE GUARD/);
    assert.ok(
      source.indexOf("implementScopeWriteGuard(active)") < source.indexOf("claimParseLoopGuard(active)"),
      "scope write guard should run before loop/context guards",
    );
    assert.ok(
      source.indexOf("recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId") < source.indexOf("terminateActiveProcess(active, \"scope-write-guard\")"),
      "scope write guard must write supervisor runtime memory before killing the claim",
    );
  });

  it("kills all agent-side git ownership even when the wrapper should also block it", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function implementGitDisciplineGuard\(active: ActiveProcess\)/);
    assert.match(source, /discardStoryWorktreeAndResetBranch/);
    assert.match(source, /function discardRuntimeGuardRetryWorktree\(runId: string, storyId: string, agentId: string, diagnostic: string\)/);
    assert.match(source, /GIT_DISCIPLINE_VIOLATION/);
    assert.match(source, /INTERMEDIATE_COMMIT_VIOLATION/);
    assert.match(source, /hasImplementGitWrapper\(active\.spawnCwd\)/);
    assert.match(source, /commandBypassesImplementGitWrapper/);
    assert.match(source, /wrapperBypassHint/);
    assert.doesNotMatch(source, /wrapperWillBlock/);
    assert.doesNotMatch(source, /if \(isAnyGitAddCommand\(command\) && wrapperWillBlock\) continue/);
    assert.doesNotMatch(source, /messages\.length > 0 && wrapperWillBlock/);
    assert.match(source, /Setfarm performs the final scoped story commit/);
    assert.match(source, /isBroadGitAddCommand/);
    assert.match(source, /isAnyGitAddCommand/);
    assert.match(source, /isGitPushCommand/);
    assert.match(source, /gitCommitMessages/);
    assert.match(source, /terminateActiveProcess\(active,\s*"git-discipline-guard"\)/);
    assert.match(source, /--- GIT DISCIPLINE GUARD/);
    assert.ok(
      source.indexOf("implementScopeWriteGuard(active)") < source.indexOf("implementGitDisciplineGuard(active)"),
      "scope writes should be checked before git discipline so the first diagnostic is the root write violation",
    );
    assert.ok(
      source.indexOf("implementGitDisciplineGuard(active)") < source.indexOf("claimParseLoopGuard(active)"),
      "git discipline guard should run before loop/context guards",
    );
    assert.ok(
      source.indexOf("recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId") < source.indexOf("terminateActiveProcess(active, \"git-discipline-guard\")"),
      "git discipline guard must write supervisor runtime memory before killing the claim",
    );
  });

  it("installs an implement-only git wrapper that blocks agent-side git ownership before retry loss", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /function installImplementGitWrapper\(workdir: string, transcriptPath: string\)/);
    assert.match(source, /\.setfarm-bin/);
    assert.match(source, /blocked agent staging/);
    assert.match(source, /blocked agent commit/);
    assert.match(source, /blocked agent push/);
    assert.match(source, /Developer agents do not stage, commit, push, or open PRs/);
    assert.match(source, /Setfarm commits the allowed \.story-scope-files entries after build\/scope\/supervisor gates pass/);
    assert.match(source, /const shouldInstallImplementGitWrapper = role === "developer" && Boolean\(claim\.storyId\)/);
    assert.match(source, /shouldInstallImplementGitWrapper \? installImplementGitWrapper/);
    assert.doesNotMatch(source, /claim\.stepId === "implement" \? installImplementGitWrapper/);
    assert.match(source, /buildOpenClawChildEnv\(pathPrefix\)/);
  });

  it("persists runtime guard diagnostics without consuming story retry budgets", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const requeueOpenStart = source.indexOf("async function requeueOpenStoryClaim");
    const requeueOrphanStart = source.indexOf("async function requeueOrphanedStoryClaim");
    assert.notEqual(requeueOpenStart, -1, "requeueOpenStoryClaim not found");
    assert.notEqual(requeueOrphanStart, -1, "requeueOrphanedStoryClaim not found");

    const requeueOpen = source.slice(requeueOpenStart, source.indexOf("async function requeueOrphanedRunningStories", requeueOpenStart));
    const requeueOrphan = source.slice(requeueOrphanStart, source.indexOf("async function requeueOpenStoryClaim", requeueOrphanStart));

    assert.match(requeueOpen, /await discardRuntimeGuardRetryWorktree\(runId, storyId, agentId, diagnostic\)/);
    assert.ok(
      requeueOpen.indexOf("await discardRuntimeGuardRetryWorktree(runId, storyId, agentId, diagnostic)") < requeueOpen.indexOf("UPDATE stories SET status = 'pending'"),
      "runtime guard requeue must discard contaminated worktree before the story can be claimed again",
    );

    for (const block of [requeueOpen, requeueOrphan]) {
      assert.doesNotMatch(block, /abandoned_count = COALESCE\(abandoned_count, 0\) \+ 1/);
      assert.doesNotMatch(block, /retry_count = retry_count \+ 1/);
      assert.match(block, /output = \$2/);
      assert.match(block, /\[.*diagnostic.*\]/s);
    }
  });

  it("records self-loop diagnostics in supervisor memory before retrying claims", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    const selfLoopStart = source.indexOf("const loop = repeatedSessionFileLoop(active)");
    const selfLoopEnd = source.indexOf("const promptIdleMs =", selfLoopStart);
    assert.notEqual(selfLoopStart, -1, "self-loop guard not found");
    assert.notEqual(selfLoopEnd, -1, "self-loop guard end not found");

    const block = source.slice(selfLoopStart, selfLoopEnd);
    assert.match(block, /AGENT_SELF_LOOP/);
    assert.match(block, /recordSupervisorRuntimeEvent\(active\.runId,\s*row\.step_id,\s*effectiveStoryDbId \|\| null,\s*"AGENT_SELF_LOOP",\s*"agent-self-loop",\s*reason\)/);
    assert.ok(
      block.indexOf("recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null") < block.indexOf("terminateActiveProcess(active, \"self-loop\")"),
      "self-loop guard must write supervisor memory before killing the claim",
    );
    assert.ok(
      block.indexOf("recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null") < block.indexOf("await requeueOpenStoryClaim(active.runId, row.step_id, active.storyId"),
      "self-loop guard must preserve manager diagnostics before retry",
    );
  });

  it("hard-times out verify agents as an infra retry instead of leaving open claims", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /VERIFY_AGENT_HARD_TIMEOUT_MS/);
    assert.match(source, /SETFARM_VERIFY_AGENT_HARD_TIMEOUT_MS/);
    assert.match(source, /async function retryActiveSingleStepClaim/);
    assert.match(source, /VERIFY_AGENT_HARD_TIMEOUT/);
    assert.match(source, /row\.step_id === "verify" && ageMs >= VERIFY_AGENT_HARD_TIMEOUT_MS/);
    assert.match(source, /terminateActiveProcess\(active,\s*"verify-hard-timeout"\)/);
    assert.match(source, /await retryActiveSingleStepClaim\(active,\s*row\.step_id,\s*reason\)/);
    assert.match(source, /UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = retry_count \+ 1/);
    assert.match(source, /UPDATE claim_log SET outcome = 'infra_retry'/);
    assert.match(source, /pg_notify\('step_pending'/);
  });

  it("runtime-guards verify agents that broad-read source before evidence commands", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /VERIFY_BOUNDED_REVIEW_MIN_AGE_MS/);
    assert.match(source, /VERIFY_BOUNDED_REVIEW_MAX_SOURCE_READS/);
    assert.match(source, /SESSION_GUARD_HEAD_BYTES/);
    assert.match(source, /SESSION_GUARD_TAIL_BYTES/);
    assert.match(source, /function readSessionJsonlForGuard/);
    assert.match(source, /function verifyBoundedReviewGuard/);
    assert.match(source, /VERIFY_BOUNDED_REVIEW_VIOLATION/);
    assert.match(source, /project source\/test files before running build\/test\/lint evidence/);
    assert.match(source, /normalizeSessionProjectRelativePath/);
    assert.match(source, /story-worktrees/);
    const boundedGuardStart = source.indexOf("function verifyBoundedReviewGuard");
    const boundedGuardEnd = source.indexOf("function normalizedSessionCommand", boundedGuardStart);
    assert.notEqual(boundedGuardStart, -1, "verify bounded review guard function missing");
    assert.notEqual(boundedGuardEnd, -1, "verify bounded review guard function end missing");
    const boundedGuardFunction = source.slice(boundedGuardStart, boundedGuardEnd);
    assert.match(boundedGuardFunction, /readSessionJsonlForGuard\(active\.sessionJsonlPath\)/);
    assert.doesNotMatch(boundedGuardFunction, /slice\(-512_000\)/);

    const guardStart = source.indexOf("const boundedReview = verifyBoundedReviewGuard(active, ageMs)");
    const guardEnd = source.indexOf("await updateRunningStepHeartbeat(active, row.step_id, ageMs)", guardStart);
    assert.notEqual(guardStart, -1, "verify bounded review guard block missing");
    assert.notEqual(guardEnd, -1, "verify bounded review guard block end missing");
    const block = source.slice(guardStart, guardEnd);
    assert.match(block, /recordSupervisorRuntimeEvent\(active\.runId,\s*row\.step_id,\s*effectiveStoryDbId \|\| null,\s*"VERIFY_BOUNDED_REVIEW_VIOLATION"/);
    assert.match(block, /terminateActiveProcess\(active,\s*"verify-bounded-review"\)/);
    assert.match(block, /await retryActiveSingleStepClaim\(active,\s*row\.step_id,\s*reason\)/);
    assert.ok(
      block.indexOf("recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null") < block.indexOf("terminateActiveProcess(active, \"verify-bounded-review\")"),
      "verify bounded review guard must write supervisor memory before killing the claim",
    );
  });

  it("retries running single-step claims that are no longer tracked by the spawner", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /ORPHANED_SINGLE_STEP_CLAIM_MS/);
    assert.match(source, /async function requeueUntrackedRunningSingleStepClaims/);
    assert.match(source, /s\.status = 'running'/);
    assert.match(source, /s\.type <> 'loop'/);
    assert.match(source, /cl\.story_id IS NULL/);
    assert.match(source, /s\.updated_at <= NOW\(\) - \(\$1::int \* interval '1 millisecond'\)/);
    assert.match(source, /Array\.from\(activeProcesses\.values\(\)\)\.some/);
    assert.match(source, /UNTRACKED_RUNNING_SINGLE_STEP/);
    assert.match(source, /UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = retry_count \+ 1/);
    assert.match(source, /UPDATE claim_log SET outcome = 'infra_retry'/);
    assert.match(source, /setInterval\(\(\) => \{ void runClaimMaintenance\(\); \}, Math\.min\(POLL_INTERVAL_MS, 10_000\)\)/);
  });

  it("tells verify agents to fail fast on first blocker", () => {
    const prompt = fs.readFileSync(path.join(root, "src", "installer", "steps", "07-verify", "prompt.md"), "utf-8");
    const rules = fs.readFileSync(path.join(root, "src", "installer", "steps", "07-verify", "rules.md"), "utf-8");
    assert.match(prompt, /First blocker wins/);
    assert.match(prompt, /immediately return\s+`STATUS: retry`; do not run extra commands/);
    assert.match(prompt, /If merge fails, immediately return `STATUS: retry`/);
    assert.match(prompt, /Do not inspect, rebase, resolve, or repair merge conflicts/);
    assert.match(rules, /Stop at the first real blocker/);
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
