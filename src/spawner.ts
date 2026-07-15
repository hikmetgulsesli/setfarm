/**
 * Setfarm Event-Driven Spawner
 * Listens to PostgreSQL NOTIFY events for pending steps/stories
 * and immediately spawns agent sessions via openclaw CLI.
 */
import { runtimeConfig } from "./runtime-config.js";
import postgres from "postgres";
import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { getSql, pgBegin, pgClose, pgGet, pgMigrate, pgQuery, pgRun } from "./db-pg.js";
import { loadWorkflowSpec } from "./installer/workflow-spec.js";
import { resolveWorkflowDir } from "./installer/paths.js";
import {
  claimStep,
  completeStep,
  commitStoryWorktreeScopeIfNeeded,
  reconcileRuntimeCompletionEffects,
  resumeRuntimeCompletionEffects,
} from "./installer/step-ops.js";
import { failStep } from "./installer/step-fail.js";
import { failRun, getRunContext } from "./installer/repo.js";
import {
  discardStoryWorktreeAndResetBranch,
  discardStoryWorktreeAndResetBranchExact,
  removeStoryWorktree,
} from "./installer/worktree-ops.js";
import { cleanupProjectEphemera, cleanupRunningRunOrphanedToolWorkers, scheduleRunCronTeardown } from "./installer/cleanup-ops.js";
import { updateSupervisorMemory } from "./installer/product-supervisor.js";
import { preserveActionableStoryRetryOutput } from "./installer/retry-output.js";
import { buildClaimSummary, buildPreclaimedPrompt, buildResolvedClaimBootstrapScript, claimTaskPreview } from "./spawner-prompt.js";
import { recordObservation } from "./installer/observations.js";
import {
  deliverOperationalEventWebhook,
  emitEvent,
  projectOperationalEventToJsonl,
} from "./installer/events.js";
import {
  createPostgresTerminalAttemptReconciler,
  type TerminalAttemptReconcileEvent,
} from "./execution/attempt-reconciler.js";
import {
  createPostgresTerminalClaimRuntimeReconciler,
  type TerminalClaimRuntimeReconcileEvent,
} from "./execution/terminal-claim-runtime-reconciler.js";
import {
  prepareAttemptRuntimeWorkspace,
  removeAttemptRuntimeWorkspace,
} from "./execution/attempt-runtime-workspace.js";
import {
  closeClaimAndBoundAttempt,
  closeUniqueSingleStepClaimForRecoveryInTransaction,
} from "./execution/claim-attempt-transition.js";
import { isClaimMutationAuthorityError } from "./execution/claim-mutation-authority.js";
import { createAttemptRepository } from "./execution/attempt-repository.js";
import { loadV3ImplementationAttemptContext } from "./execution/v3-implementation-attempt.js";
import {
  createOperationalRetryDirectiveV1,
  parseOperationalRetryDirectiveStoryOutput,
} from "./execution/operational-retry-directive.js";
import {
  publishOperationalRetryDirectiveInTransaction,
  terminalizeOperationalRetryExhaustionInTransaction,
} from "./execution/operational-retry-transition.js";
import type { ClaimAttemptFenceV1, ClaimEnvelopeV1 } from "./execution/schemas/claim-envelope-v1.js";
import { parseClaimEnvelope } from "./execution/claim-authority.js";
import { V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES } from "./execution/v3-implementation-output.js";
import {
  BoundedFileReadError,
  readUtf8RegularFileAtMostSync,
} from "./lib/bounded-file-read.js";
import {
  createRuntimeSessionRepository,
  newRuntimeSessionId,
  releaseDrainedRuntimeSessionInTransaction,
  releaseDrainedRuntimeSessionsInTransaction,
  releaseReservedRuntimeSessionInTransaction,
  type RuntimeClaimIntentV1,
  type ClaimRuntimeSession,
} from "./execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  processRunTerminationBatch,
  type RunTerminationRequest,
} from "./execution/run-termination.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
  type RuntimeCompletionRequest,
} from "./execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "./execution/runtime-completion-effect-repository.js";
import {
  runRuntimeCompletionEffectLedger,
  type RuntimeCompletionEffectResolution,
} from "./execution/runtime-completion-effect-runner.js";
import { createRunRecoveryCoordinator } from "./execution/run-recovery-coordinator.js";
import { createOperationalOutboxRepository } from "./execution/operational-outbox-repository.js";
import { createOperationalOutboxPublisher } from "./execution/operational-outbox-publisher.js";
import { createOperationalEventDeliveryRepository } from "./execution/operational-event-delivery-repository.js";
import { createOperationalEventDeliveryConsumer } from "./execution/operational-event-delivery-consumer.js";
import {
  createPostgresV3RecoveryEffectHandler,
  type V3RecoveryEffectCoordinateResult,
} from "./recovery/v3-recovery-effect.js";
import {
  createV3RecoveryLifecycleReconciler,
} from "./recovery/v3-recovery-lifecycle-reconciler.js";
import { createV3RecoveryOwnerLeaseRepository } from "./recovery/v3-recovery-owner-lease.js";
import { createV3EvidenceOnlyRecoveryWorker } from "./recovery/v3-evidence-only-worker.js";
import { createV3EvidenceOnlyRuntimeDependencies } from "./recovery/v3-evidence-only-runtime.js";
import {
  observeProcessIdentity,
  signalProcessIfIdentityMatches,
} from "./execution/process-identity.js";
import {
  sameProcessIdentity,
  type ProcessIdentityV1,
} from "./execution/schemas/process-identity-v1.js";
import {
  decodeOpenClawTaskTerminalRecord,
  OpenClawAgentTerminalError,
  readOpenClawAgentTerminalOutcome,
} from "./execution/openclaw-agent-terminal-outcome.js";
import { readOpenClawTaskRegistryProbe } from "./execution/openclaw-task-registry.js";

type AgentRuntime = "codex" | "openclaw" | "kimi" | "opencode";
type OperationalRecoveryIntent = "observe_fix" | "platform_replay" | "project_rescue";

function classifyOperationalRecoveryIntent(source: string): OperationalRecoveryIntent {
  const normalized = String(source || "").trim().toLowerCase();
  if (normalized.includes("platform-fix") || normalized.includes("observe-fix")) return "observe_fix";
  if (normalized.includes("orphan") || normalized.includes("runtime-guard") || normalized.includes("agent-exit")) return "platform_replay";
  return "project_rescue";
}

function commandFromPath(name: string): string {
  try {
    return execFileSync("which", [name], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function pathCommandCandidates(name: string): string[] {
  return (process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => path.join(dir, name));
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function isExecutable(candidate: string): boolean {
  if (!candidate) return false;
  if (!path.isAbsolute(candidate)) return true;
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandIsUsable(command: string): boolean {
  if (!isExecutable(command)) return false;
  try {
    execFileSync(command, ["--version"], {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function firstUsableCommand(candidates: string[]): string {
  for (const candidate of candidates) {
    if (commandIsUsable(candidate)) return candidate;
  }
  return "";
}

function resolveCodexCli(): string {
  const candidates = uniqueStrings([
    process.env.CODEX_CLI || "",
    commandFromPath("codex"),
    ...pathCommandCandidates("codex"),
      path.join(os.homedir(), ".local", "bin", "codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
  ]);
  return firstUsableCommand(candidates) || candidates.find(isExecutable) || "codex";
}

function resolveOpenClawCli(): string {
  const candidates = uniqueStrings([
    process.env.OPENCLAW_CLI || "",
    commandFromPath("openclaw"),
    ...pathCommandCandidates("openclaw"),
      path.join(os.homedir(), ".local", "bin", "openclaw"),
      path.join(os.homedir(), ".npm-global", "bin", "openclaw"),
      "/opt/homebrew/bin/openclaw",
      "/usr/local/bin/openclaw",
  ]);
  return firstUsableCommand(candidates) || candidates.find(isExecutable) || "openclaw";
}

function resolveKimiCli(): string {
  const candidates = uniqueStrings([
    process.env.KIMI_CLI || "",
    commandFromPath("kimi"),
    commandFromPath("kimi-cli"),
    ...pathCommandCandidates("kimi"),
    ...pathCommandCandidates("kimi-cli"),
      path.join(os.homedir(), ".local", "bin", "kimi"),
      path.join(os.homedir(), ".local", "bin", "kimi-cli"),
      path.join(os.homedir(), ".npm-global", "bin", "kimi"),
      path.join(os.homedir(), ".npm-global", "bin", "kimi-cli"),
      "/opt/homebrew/bin/kimi",
      "/usr/local/bin/kimi",
  ]);
  return firstUsableCommand(candidates) || candidates.find(isExecutable) || "kimi";
}

function resolveOpencodeCli(): string {
  const candidates = uniqueStrings([
    process.env.OPENCODE_CLI || "",
    commandFromPath("opencode"),
    ...pathCommandCandidates("opencode"),
      path.join(os.homedir(), ".local", "bin", "opencode"),
      "/opt/homebrew/bin/opencode",
      "/usr/local/bin/opencode",
  ]);
  return firstUsableCommand(candidates) || candidates.find(isExecutable) || "opencode";
}

function kimiWeeklyQuotaExhausted(): boolean {
  try {
    const raw = execFileSync("curl", ["-fsS", "http://127.0.0.1:3080/api/kimi-quota"], {
      encoding: "utf-8",
      timeout: 3500,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const data = JSON.parse(raw);
    return data?.severity === "exhausted" || Number(data?.snapshot?.weekly?.remaining ?? 1) <= 0;
  } catch {
    return false;
  }
}

function resolveAgentRuntime(): AgentRuntime {
  const requested = (process.env.SETFARM_AGENT_RUNTIME || "").trim().toLowerCase();
  if (requested === "codex" && commandIsUsable(CODEX_CLI)) return "codex";
  if (requested === "openclaw" && commandIsUsable(OPENCLAW_CLI)) return "openclaw";
  if (requested === "kimi" && commandIsUsable(KIMI_CLI)) return "kimi";
  if ((requested === "opencode" || requested === "minimax") && commandIsUsable(OPENCODE_CLI)) return "opencode";
  if (requested === "codex" || requested === "openclaw" || requested === "kimi" || requested === "opencode" || requested === "minimax") {
    console.warn(`[spawner] Requested runtime ${requested} is not usable; falling back to available runtime`);
  }
  if (commandIsUsable(OPENCLAW_CLI)) return "openclaw";
  if (commandIsUsable(OPENCODE_CLI) && kimiWeeklyQuotaExhausted()) {
    console.warn("[spawner] Kimi weekly quota exhausted; using opencode/minimax runtime fallback");
    return "opencode";
  }
  if (commandIsUsable(KIMI_CLI)) return "kimi";
  if (commandIsUsable(OPENCODE_CLI)) return "opencode";
  if (commandIsUsable(CODEX_CLI)) return "codex";
  return requested === "openclaw" ? "openclaw" : requested === "kimi" ? "kimi" : "codex";
}

const CODEX_CLI = resolveCodexCli();
const OPENCLAW_CLI = resolveOpenClawCli();
const KIMI_CLI = resolveKimiCli();
const OPENCODE_CLI = resolveOpencodeCli();
const AGENT_RUNTIME: AgentRuntime = resolveAgentRuntime();
const OPENCLAW_TASKS_DB = process.env.OPENCLAW_TASKS_DB || path.join(os.homedir(), ".openclaw", "tasks", "runs.sqlite");
const POLL_INTERVAL_MS = 30_000;
const ACTIVE_RETRY_STORY_SQL = "(retry_count > 0 OR COALESCE(output, '') ~* 'PR_REVIEW_COMMENTS_OPEN|actionable PR review comments')";
const ACTIVE_RETRY_STORY_ALIAS_SQL = "(active_st.retry_count > 0 OR COALESCE(active_st.output, '') ~* 'PR_REVIEW_COMMENTS_OPEN|actionable PR review comments')";
const AGENT_TIMEOUT_SECONDS = 1800;
const PID_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
const LOCK_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.lock");
const DEFAULT_MAX_CONCURRENT = AGENT_RUNTIME === "openclaw" ? 8 : 2;
const MAX_CONCURRENT = parsePositiveInt(process.env.SETFARM_MAX_CONCURRENT, DEFAULT_MAX_CONCURRENT);
const SPAWN_STAGGER_MS = parseInt(process.env.SETFARM_SPAWN_STAGGER_MS || "12000", 10);
const RUNTIME_USAGE_LIMIT_DEFAULT_COOLDOWN_MS = parsePositiveInt(process.env.SETFARM_RUNTIME_USAGE_LIMIT_COOLDOWN_MS, 4 * 60_000);
const WORKFLOW_DEFER_RETRY_MS = parsePositiveInt(process.env.SETFARM_WORKFLOW_DEFER_RETRY_MS, POLL_INTERVAL_MS);
const BACKGROUND_WORKFLOWS = new Set((process.env.SETFARM_BACKGROUND_WORKFLOWS || "daily-standup")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean));
const VERIFY_AGENT_HARD_TIMEOUT_MS = parsePositiveInt(process.env.SETFARM_VERIFY_AGENT_HARD_TIMEOUT_MS, 10 * 60_000);
const VERIFY_BOUNDED_REVIEW_MIN_AGE_MS = parsePositiveInt(process.env.SETFARM_VERIFY_BOUNDED_REVIEW_MIN_AGE_MS, 2 * 60_000);
const VERIFY_BOUNDED_REVIEW_MAX_SOURCE_READS = parsePositiveInt(process.env.SETFARM_VERIFY_BOUNDED_REVIEW_MAX_SOURCE_READS, 6);
const SUPERVISOR_BOUNDED_AUDIT_MIN_AGE_MS = parsePositiveInt(process.env.SETFARM_SUPERVISOR_BOUNDED_AUDIT_MIN_AGE_MS, 90_000);
const SUPERVISOR_BOUNDED_AUDIT_MAX_TOOL_CALLS = parsePositiveInt(process.env.SETFARM_SUPERVISOR_BOUNDED_AUDIT_MAX_TOOL_CALLS, 28);
const SUPERVISOR_BOUNDED_AUDIT_MAX_SOURCE_READS = parsePositiveInt(process.env.SETFARM_SUPERVISOR_BOUNDED_AUDIT_MAX_SOURCE_READS, 10);
const SESSION_GUARD_HEAD_BYTES = parsePositiveInt(process.env.SETFARM_SESSION_GUARD_HEAD_BYTES, 768_000);
const SESSION_GUARD_TAIL_BYTES = parsePositiveInt(process.env.SETFARM_SESSION_GUARD_TAIL_BYTES, 768_000);
const NON_DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_AGENT_STUCK_MS, 12 * 60_000);
const DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_DEVELOPER_AGENT_STUCK_MS, 15 * 60_000);
const QA_FIX_AGENT_STUCK_MS = parsePositiveInt(process.env.SETFARM_QA_FIX_AGENT_STUCK_MS, 8 * 60_000);
const STARTUP_RUNNING_GRACE_MS = parsePositiveInt(process.env.SETFARM_STARTUP_RUNNING_GRACE_MS, 0);
const QA_AGENT_STUCK_MS = parsePositiveInt(process.env.SETFARM_QA_AGENT_STUCK_MS, 6 * 60_000);
const AGENT_ACTIVITY_GRACE_MS = parsePositiveInt(process.env.SETFARM_AGENT_ACTIVITY_GRACE_MS, 4 * 60_000);
const AGENT_ACTIVE_WATCHDOG_OVERRUN_MS = parsePositiveInt(process.env.SETFARM_AGENT_ACTIVE_WATCHDOG_OVERRUN_MS, 8 * 60_000);
const AGENT_HEARTBEAT_MS = parsePositiveInt(process.env.SETFARM_AGENT_HEARTBEAT_MS, 60_000);
const V3_RECOVERY_OWNER_HEARTBEAT_MS = parsePositiveInt(
  process.env.SETFARM_V3_RECOVERY_OWNER_HEARTBEAT_MS,
  30_000,
);
const V3_RECOVERY_OWNER_LEASE_MS = Math.max(30_000, V3_RECOVERY_OWNER_HEARTBEAT_MS * 3, parsePositiveInt(
  process.env.SETFARM_V3_RECOVERY_OWNER_LEASE_MS,
  2 * 60_000,
));
const DEFAULT_AGENT_STARTUP_SILENCE_MS = AGENT_RUNTIME === "kimi" ? 12 * 60_000 : 4 * 60_000;
const AGENT_STARTUP_SILENCE_MS = parsePositiveInt(process.env.SETFARM_AGENT_STARTUP_SILENCE_MS, DEFAULT_AGENT_STARTUP_SILENCE_MS);
const AGENT_MODEL_TURN_STALL_MS = parsePositiveInt(process.env.SETFARM_AGENT_MODEL_TURN_STALL_MS, 8 * 60_000);
const AGENT_SELF_LOOP_CHECK_AFTER_MS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_CHECK_AFTER_MS, 6 * 60_000);
const AGENT_REPEATED_TOOL_LOOP_CHECK_AFTER_MS = parsePositiveInt(process.env.SETFARM_AGENT_REPEATED_TOOL_LOOP_CHECK_AFTER_MS, 2 * 60_000);
const IMPLEMENT_NO_DELTA_GRACE_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_NO_DELTA_GRACE_MS, 8 * 60_000);
const IMPLEMENT_RETRY_HARD_TIMEOUT_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_RETRY_HARD_TIMEOUT_MS, 7 * 60_000);
const IMPLEMENT_RETRY_WITH_DELTA_HARD_TIMEOUT_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_RETRY_WITH_DELTA_HARD_TIMEOUT_MS, Math.max(IMPLEMENT_RETRY_HARD_TIMEOUT_MS, 18 * 60_000));
const IMPLEMENT_POST_CHECK_OUTPUT_STALL_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_POST_CHECK_OUTPUT_STALL_MS, 2 * 60_000);
const IMPLEMENT_PRE_DELTA_MAX_CONTEXT_READS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_PRE_DELTA_MAX_CONTEXT_READS, 10);
const AGENT_SELF_LOOP_MIN_ACTIONS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_ACTIONS, 7);
const AGENT_SELF_LOOP_MIN_NOOP_EDITS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_NOOP_EDITS, 4);
const AGENT_SELF_LOOP_MIN_REPEATED_FAILURES = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_REPEATED_FAILURES, 4);
const AGENT_SELF_LOOP_MIN_REPEATED_COMMANDS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_REPEATED_COMMANDS, 8);
const RUNTIME_GUARD_REPEAT_LIMIT = parsePositiveInt(process.env.SETFARM_RUNTIME_GUARD_REPEAT_LIMIT, 3);
const CLAIM_PARSE_LOOP_MIN_READS = parsePositiveInt(process.env.SETFARM_CLAIM_PARSE_LOOP_MIN_READS, 6);
const REAP_FINISHED_ACTIVE_GRACE_MS = parsePositiveInt(process.env.SETFARM_REAP_FINISHED_ACTIVE_GRACE_MS, 60_000);
const ORPHANED_SINGLE_STEP_CLAIM_MS = parsePositiveInt(process.env.SETFARM_ORPHANED_SINGLE_STEP_CLAIM_MS, 2 * 60_000);
const OPENCLAW_TASK_REGISTRY_SETTLE_MS = parsePositiveInt(process.env.SETFARM_OPENCLAW_TASK_REGISTRY_SETTLE_MS, 2000);
const OPENCLAW_TASK_TERMINAL_SETTLE_MS = parsePositiveInt(process.env.SETFARM_OPENCLAW_TASK_TERMINAL_SETTLE_MS, 5_000);
const OPENCLAW_STALE_TASK_SWEEP_MS = parsePositiveInt(process.env.SETFARM_OPENCLAW_STALE_TASK_SWEEP_MS, 2 * 60_000);
const IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS, 120_000);
const OPENCLAW_AGENT_LOCAL = process.env.SETFARM_OPENCLAW_AGENT_LOCAL === "1";
const GATEWAY_HEALTH_URL = process.env.OPENCLAW_GATEWAY_HEALTH_URL || "http://127.0.0.1:18789/health";
const GATEWAY_READY_URL = process.env.OPENCLAW_GATEWAY_READY_URL || GATEWAY_HEALTH_URL.replace(/\/health\/?$/, "/ready");
const GATEWAY_PRESPAWN_RETRY_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_PRESPAWN_RETRY_MS, 10_000);
const GATEWAY_WARMUP_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_WARMUP_MS, 45_000);
const GATEWAY_SIDECAR_BYPASS_AFTER_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_SIDECAR_BYPASS_AFTER_MS, 30_000);
const GATEWAY_TIMEOUT_BYPASS_AFTER_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_TIMEOUT_BYPASS_AFTER_MS, 2 * 60_000);
const GATEWAY_PRESPAWN_RESTART_AFTER_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_PRESPAWN_RESTART_AFTER_MS, 90_000);
const GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS, 5 * 60_000);
const GATEWAY_IGNORABLE_FAILING = new Set((process.env.SETFARM_GATEWAY_IGNORABLE_FAILING || "startup-sidecars,whatsapp,telegram,browser,gmail")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean));
const spawnerStartedAtMs = Date.now();
let gatewayNotReadySinceMs: number | null = null;
let gatewayRestartInFlight = false;
let lastGatewayPrespawnRestartMs = 0;
let lastGatewayCleanupRestartMs = 0;
let lastGuardGatewayRestartMs = 0;
let spawnerLockFd: number | null = null;

// Wave 13 Bug M (run #344 postmortem): agent default cwd must NOT be the
// setfarm-repo. Previously execFile inherited the spawner's cwd (the systemd
// service's WorkingDirectory = ~/.openclaw/setfarm-repo). If the polling
// prompt told the agent to `cd $story_workdir` and the agent skipped that
// step, it would fall through to writing files, staging, committing and
// pushing INSIDE setfarm-repo. Run #344 caught it: Prism wrote a 1067-line
// pomodoro timer into src/lib/ and pushed it to setfarm-repo/main. The
// Wave 12 cross-project guard now detects it in agent output, but this is
// the proactive layer: start every agent in a non-git scratch directory so
// stray `git` commands fail with "not a git repository" instead of silently
// landing in the wrong repo.
const SETFARM_SRC = path.resolve(process.env.SETFARM_REPO_DIR || path.join(os.homedir(), ".openclaw", "setfarm-repo"));
const AGENT_SAFE_CWD = path.join(os.homedir(), ".openclaw", "workspace", "agent-scratch");
const TRANSCRIPT_ROOT = path.join(os.homedir(), ".openclaw", "workspace", "transcripts");
const OPENCLAW_AGENTS_ROOT = path.join(os.homedir(), ".openclaw", "agents");
const OPENCLAW_ATTEMPT_WORKSPACE_ROOT = path.join(os.homedir(), ".openclaw", "setfarm", "attempt-workspaces");

function assertAgentRuntimeAvailable(): void {
  const command = AGENT_RUNTIME === "codex" ? CODEX_CLI : AGENT_RUNTIME === "openclaw" ? OPENCLAW_CLI : AGENT_RUNTIME === "opencode" ? OPENCODE_CLI : KIMI_CLI;
  if (!commandIsUsable(command)) {
    throw new Error(`AGENT_RUNTIME_UNAVAILABLE: ${AGENT_RUNTIME} CLI is not executable or failed --version at ${command}`);
  }
}

function assertAgentCwdSafe(): void {
  // cuddly-sleeping-quail: refuse to spawn agents inside the platform source tree.
  // A misconfigured cwd has historically corrupted setfarm-repo itself (agents
  // writing project code into src/, committing to a story branch, then npm run
  // build rebuilt dist/ from the stale checkout). This is the last-line check —
  // runtime-guard + write-build-info stop it earlier; this stops any spawner
  // that bypassed those.
  const resolved = path.resolve(AGENT_SAFE_CWD);
  if (resolved === SETFARM_SRC || resolved.startsWith(SETFARM_SRC + path.sep)) {
    throw new Error("SELF_CONTAIN_VIOLATION: AGENT_SAFE_CWD (" + resolved + ") resolves inside platform source tree (" + SETFARM_SRC + "). Refusing to spawn agents — they would corrupt setfarm-repo.");
  }
}
try { fs.mkdirSync(AGENT_SAFE_CWD, { recursive: true }); } catch { /* best-effort */ }
try { fs.mkdirSync(TRANSCRIPT_ROOT, { recursive: true }); } catch { /* best-effort */ }
try { fs.mkdirSync(OPENCLAW_ATTEMPT_WORKSPACE_ROOT, { recursive: true }); } catch { /* best-effort */ }
assertAgentCwdSafe();

function safeAgentCwdFromCandidate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let candidate = raw.trim();
  if (!candidate || candidate.includes("<") || candidate.includes(">") || candidate.includes("[missing:")) return null;
  if (candidate.startsWith("~/")) candidate = path.join(os.homedir(), candidate.slice(2));
  if (candidate.includes("$HOME") || candidate.startsWith("~")) return null;
  if (!path.isAbsolute(candidate)) return null;

  const resolved = path.resolve(candidate);
  if (resolved === SETFARM_SRC || resolved.startsWith(SETFARM_SRC + path.sep)) return null;
  try {
    if (!fs.statSync(resolved).isDirectory()) return null;
  } catch {
    return null;
  }
  return resolved;
}

function processIsAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireSpawnerSingletonLock(): void {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      spawnerLockFd = fs.openSync(LOCK_FILE, "wx");
      fs.writeFileSync(spawnerLockFd, `${process.pid}\n`);
      return;
    } catch (err: any) {
      if (err?.code !== "EEXIST") throw err;
      const existingPid = Number(fs.readFileSync(LOCK_FILE, "utf-8").trim());
      if (processIsAlive(existingPid)) {
        console.warn(`[spawner] Another spawner is already running (PID ${existingPid}); exiting duplicate PID ${process.pid}`);
        process.exit(0);
      }
      try { fs.unlinkSync(LOCK_FILE); } catch {}
    }
  }
  throw new Error("SPAWNER_LOCK_UNAVAILABLE: could not acquire singleton lock");
}

function releaseSpawnerSingletonLock(): void {
  if (spawnerLockFd !== null) {
    try { fs.closeSync(spawnerLockFd); } catch {}
    spawnerLockFd = null;
  }
  try {
    const existingPid = Number(fs.readFileSync(LOCK_FILE, "utf-8").trim());
    if (existingPid === process.pid || !processIsAlive(existingPid)) fs.unlinkSync(LOCK_FILE);
  } catch {}
}

const STORY_WORKDIR_CANDIDATE_KEYS = [
  "story_workdir",
  "STORY_WORKDIR",
  "verify_workdir",
  "VERIFY_WORKDIR",
  "WORKDIR",
  "workdir",
];

const REPO_CANDIDATE_KEYS = [
  "MAIN_REPO",
  "repo",
  "REPO",
];

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeAgentCwdFromRecord(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const resolved = safeAgentCwdFromCandidate(record[key]);
    if (resolved) return resolved;
  }
  return null;
}

function safeAgentCwdFromTextLabels(input: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp("(?:^|[\\r\\n])\\s*" + escapeForRegex(key) + "\\s*[:=]\\s*([^\\s\"'`]+)", "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(input)) !== null) {
      const resolved = safeAgentCwdFromCandidate(match[1]);
      if (resolved) return resolved;
    }
  }
  return null;
}

function safeAgentCwdFromStoryWorktreeMentions(input: string): string | null {
  const preparedWorktree = input.match(/prepared story worktree:\s*`?([^`\n]+)`?/i);
  const preparedResolved = safeAgentCwdFromCandidate(preparedWorktree?.[1]);
  if (preparedResolved) return preparedResolved;

  for (const match of input.matchAll(/`?([^\s\"'<>`]+\/story-worktrees\/[A-Za-z0-9._-]+)`?/g)) {
    const resolved = safeAgentCwdFromCandidate(match[1]);
    if (resolved) return resolved;
  }

  for (const match of input.matchAll(/`?(\/home\/setrox\/\.openclaw\/workspaces\/workflows\/[^\s\"'<>`]+\/story-worktrees\/[A-Za-z0-9._-]+)`?/g)) {
    const resolved = safeAgentCwdFromCandidate(match[1]);
    if (resolved) return resolved;
  }

  return null;
}

function safeAgentCwdFromProjectRootMentions(input: string): string | null {
  const projectRootLine = /(?:^|[\r\n])\s*(?:[-*]\s*)?`?([^`\r\n]+?)`?\s*:\s*project root\b/gi;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = projectRootLine.exec(input)) !== null) {
    const resolved = safeAgentCwdFromCandidate(lineMatch[1]);
    if (resolved) return resolved;
  }

  const projectRootLabel = /(?:^|[\r\n])\s*project root\s*[:=]\s*`?([^`\r\n]+?)`?\s*$/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = projectRootLabel.exec(input)) !== null) {
    const resolved = safeAgentCwdFromCandidate(labelMatch[1]);
    if (resolved) return resolved;
  }

  for (const match of input.matchAll(/`?((?:\/Users\/[^/\s"'<>`]+|\/home\/[^/\s"'<>`]+)\/projects\/[A-Za-z0-9._-]+)`?/g)) {
    const resolved = safeAgentCwdFromCandidate(match[1]);
    if (resolved) return resolved;
  }

  return null;
}

function safeAgentCwdFromClaimInput(input: unknown): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    const storyWorkdir = safeAgentCwdFromRecord(record, STORY_WORKDIR_CANDIDATE_KEYS);
    if (storyWorkdir) return storyWorkdir;
    const repo = safeAgentCwdFromRecord(record, REPO_CANDIDATE_KEYS);
    if (repo) return repo;
    return AGENT_SAFE_CWD;
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      const resolved = safeAgentCwdFromClaimInput(parsed);
      if (resolved !== AGENT_SAFE_CWD) return resolved;
    } catch {}

    const storyLabel = safeAgentCwdFromTextLabels(input, STORY_WORKDIR_CANDIDATE_KEYS);
    if (storyLabel) return storyLabel;
    const storyMention = safeAgentCwdFromStoryWorktreeMentions(input);
    if (storyMention) return storyMention;
    const repoLabel = safeAgentCwdFromTextLabels(input, REPO_CANDIDATE_KEYS);
    if (repoLabel) return repoLabel;
    const projectRoot = safeAgentCwdFromProjectRootMentions(input);
    if (projectRoot) return projectRoot;

    for (const match of input.matchAll(/`?(\/home\/setrox\/projects\/[A-Za-z0-9._-]+)`?/g)) {
      const resolved = safeAgentCwdFromCandidate(match[1]);
      if (resolved) return resolved;
    }
  }

  return AGENT_SAFE_CWD;
}

function claimRoleRequiresProjectCwd(role: string, agentId: string): boolean {
  return [
    "security-gate",
    "qa-test",
    "final-test",
    "deploy",
  ].includes(role) || /(?:^|_)(security-gate|qa-tester|final-test|deployer)$/.test(agentId);
}

type InlineSecurityFinding = {
  file: string;
  line: number;
  category: string;
  message: string;
};

function isSecurityGateRole(role: string, agentId: string): boolean {
  return role === "security-gate" || agentId.endsWith("_security-gate") || agentId === "security-gate";
}

function gitTrackedFiles(repo: string): string[] {
  try {
    return execFileSync("git", ["ls-files"], {
      cwd: repo,
      timeout: 15_000,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024,
    })
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isSecurityScanCandidate(file: string): boolean {
  if (/(^|\/)(stitch|\.setfarm)\//.test(file)) return false;
  if (/(^|\/)(node_modules|dist|build|coverage|\.git|\.next|\.nuxt|out)\//.test(file)) return false;
  if (/(^|\/)(package-lock|pnpm-lock|yarn\.lock|bun\.lockb)$/.test(file)) return false;
  if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp4|mov|zip|gz|pdf)$/i.test(file)) return false;
  return /\.(tsx?|jsx?|mjs|cjs|json|env|ya?ml|toml|css|html|md)$/i.test(file);
}

function runInlineSecurityScan(repo: string): { findings: InlineSecurityFinding[]; scanned: number } {
  const tracked = gitTrackedFiles(repo).filter(isSecurityScanCandidate).slice(0, 1500);
  const findings: InlineSecurityFinding[] = [];
  let scanned = 0;

  for (const file of tracked) {
    const fullPath = path.join(repo, file);
    let stat: ReturnType<typeof fs.statSync>;
    try { stat = fs.statSync(fullPath); } catch { continue; }
    if (!stat.isFile() || stat.size > 800_000) continue;

    let content = "";
    try { content = fs.readFileSync(fullPath, "utf-8"); } catch { continue; }
    scanned++;
    const lines = content.split(/\r?\n/);
    const fileHasSanitizer = /\b(DOMPurify|sanitizeHtml|sanitize)\b/.test(content);

    lines.forEach((line, index) => {
      const lineNo = index + 1;
      if (findings.length >= 60) return;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) return;

      if (/\bdangerouslySetInnerHTML\b/.test(line) && !fileHasSanitizer) {
        findings.push({
          file,
          line: lineNo,
          category: "XSS",
          message: "dangerouslySetInnerHTML without an obvious sanitizer in the file.",
        });
      }
      if (/\binnerHTML\s*=/.test(line) && !fileHasSanitizer && !isStaticSafeInnerHtmlAssignment(line)) {
        findings.push({
          file,
          line: lineNo,
          category: "XSS",
          message: "innerHTML assignment without an obvious sanitizer in the file.",
        });
      }
      if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(line)) {
        findings.push({
          file,
          line: lineNo,
          category: "Code Injection",
          message: "dynamic code execution is present.",
        });
      }
      if (/\blocalStorage\.setItem\s*\([^)]*(password|token|secret|api[_-]?key)/i.test(line)) {
        findings.push({
          file,
          line: lineNo,
          category: "Sensitive Storage",
          message: "password/token/secret-like value is written to localStorage.",
        });
      }
      if (/\b(api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{24,}["']/i.test(line)) {
        findings.push({
          file,
          line: lineNo,
          category: "Secret Leak",
          message: "hardcoded credential-like value detected.",
        });
      }
    });
  }

  return { findings, scanned };
}

function isStaticSafeInnerHtmlAssignment(line: string): boolean {
  const match = /\binnerHTML\s*=\s*(`([^`]*)`|"([^"]*)"|'([^']*)')\s*;?\s*$/.exec(line.trim());
  if (!match) return false;
  const quote = match[1]?.[0] || "";
  const html = match[2] ?? match[3] ?? match[4] ?? "";
  if (quote === "`" && /\$\{/.test(match[1] || "")) return false;
  if (!html.trim()) return true;
  return !/<\s*script\b/i.test(html) && !/\son\w+\s*=/i.test(html) && !/\bjavascript\s*:/i.test(html);
}

function formatInlineSecurityOutput(repo: string): string {
  if (!repo || repo === AGENT_SAFE_CWD || !fs.existsSync(repo)) {
    return [
      "STATUS: skip",
      "VULNERABILITIES:",
      "- none",
      "FINDINGS:",
      "- Security gate skipped: no project repository was available in the claim context.",
    ].join("\n");
  }

  const { findings, scanned } = runInlineSecurityScan(repo);
  if (findings.length > 0) {
    return [
      "STATUS: retry",
      "VULNERABILITIES:",
      ...findings.slice(0, 25).map((f) => `- ${f.file}:${f.line} — ${f.category}: ${f.message}`),
      "FINDINGS:",
      `- Inline read-only security scan checked ${scanned} tracked text file(s).`,
    ].join("\n");
  }

  return [
    "STATUS: done",
    "VULNERABILITIES:",
    "- none",
    "FINDINGS:",
    `- Inline read-only security scan checked ${scanned} tracked text file(s).`,
    "- No hardcoded secrets, unsafe HTML sinks, dynamic code execution, or sensitive localStorage writes were detected by the static gate.",
  ].join("\n");
}

async function completeInlineSecurityGateIfApplicable(params: {
  role: string;
  agentId: string;
  wfId: string;
  key: string;
  claim: Awaited<ReturnType<typeof claimStep>>;
  claimEnvelope: ClaimEnvelopeV1;
  repo: string;
  transcriptPath: string;
}): Promise<boolean> {
  const { role, agentId, wfId, key, claim, claimEnvelope, repo, transcriptPath } = params;
  if (!isSecurityGateRole(role, agentId)) return false;

  claimingSpawns.delete(key);
  const stepId = claim.stepId;
  try { fs.mkdirSync(path.dirname(transcriptPath), { recursive: true }); } catch {}
  try {
    fs.writeFileSync(transcriptPath, "[spawner] " + new Date().toISOString() + " " + wfId + "/" + role + " agent=" + agentId + "\n");
    fs.appendFileSync(transcriptPath, `[spawner] inline_security_gate=true cwd=${repo}\n`);
  } catch {}

  if (!stepId) {
    try { fs.appendFileSync(transcriptPath, "--- INLINE ERROR ---\nMissing claimed step id for inline security gate.\n"); } catch {}
    return true;
  }

  const output = formatInlineSecurityOutput(repo);
  try {
    fs.appendFileSync(transcriptPath, output + "\n");
    const result = await completeStep(stepId, output, claimEnvelope);
    fs.appendFileSync(transcriptPath, `--- INLINE COMPLETE ${new Date().toISOString()} ${JSON.stringify(result)} ---\n`);
    console.log(`[spawner] completed ${agentId} inline for ${wfId}/${role} (transcript: ${transcriptPath})`);
  } catch (err) {
    const reason = `INLINE_SECURITY_GATE_FAILED: ${compactExitReason(err)}. Transcript: ${transcriptPath}`;
    try { fs.appendFileSync(transcriptPath, `--- INLINE ERROR ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
    console.warn(`[spawner] ${reason}`);
    await failStep(stepId, reason, claimEnvelope);
  }
  return true;
}

type ActiveProcess = {
  child: ChildProcess;
  processIdentity?: ProcessIdentityV1;
  runId: string;
  stepId: string;
  workflowStepId: string;
  protocol: "legacy" | "shadow" | "v3";
  storyId?: string;
  storyDbId?: string;
  claimGeneration?: number;
  claimId?: number;
  claimAgentId: string;
  agentId: string;
  wfId: string;
  role: string;
  startedAtMs: number;
  transcriptPath: string;
  initialTranscriptSize: number;
  outputPath: string;
  claimSummaryPath?: string;
  spawnCwd: string;
  attempt?: ClaimAttemptFenceV1;
  recoveryDispatchId?: string;
  recoveryRevisionId?: string;
  recoveryLeaseToken?: string;
  runtimeSessionId: string;
  runtimeOwnerInstanceId: string;
  runtimeWorkspaceDir?: string;
  runtimeWorkspaceId?: string;
  sessionId: string;
  sessionKey: string;
  sessionJsonlPath: string;
  lastCpuTicks?: number;
  lastCpuActivityMs?: number;
  lastHeartbeatMs?: number;
  lastHeartbeatSignature?: string;
  lastRecoveryOwnerHeartbeatMs?: number;
  supervisorSignals?: Set<string>;
  claimRecoveryOwned?: boolean;
  runtimeDrainRequested?: boolean;
};

function runtimeClaimEnvelope(
  claim: Awaited<ReturnType<typeof claimStep>>,
  runtimeAgentId: string,
  workdir?: string,
): ClaimEnvelopeV1 {
  if (
    !claim.found
    || !claim.stepId
    || !claim.workflowStepId
    || !claim.runId
    || !claim.protocol
    || !claim.claimId
    || !claim.claimAgentId
  ) {
    throw new Error("CLAIM_ENVELOPE_HANDOFF_INCOMPLETE");
  }
  return parseClaimEnvelope({
    schema: "setfarm.claim-envelope.v1",
    protocol: claim.protocol,
    issuedAt: new Date().toISOString(),
    stepId: claim.stepId,
    workflowStepId: claim.workflowStepId,
    runId: claim.runId,
    ...(claim.storyId ? { storyId: claim.storyId } : {}),
    ...(claim.storyDbId ? { storyDbId: claim.storyDbId } : {}),
    claimId: claim.claimId,
    claimAgentId: claim.claimAgentId,
    runtimeAgentId,
    ...(claim.claimGeneration !== undefined ? { claimGeneration: claim.claimGeneration } : {}),
    ...(claim.attempt ? { attempt: claim.attempt } : {}),
    ...(workdir ? { workdir, repo: workdir } : {}),
    input: claim.resolvedInput,
  });
}

function activeClaimEnvelope(active: ActiveProcess): ClaimEnvelopeV1 {
  if (!active.claimId) throw new Error("ACTIVE_CLAIM_ENVELOPE_ID_MISSING");
  return parseClaimEnvelope({
    schema: "setfarm.claim-envelope.v1",
    protocol: active.protocol,
    issuedAt: new Date(active.startedAtMs).toISOString(),
    stepId: active.stepId,
    workflowStepId: active.workflowStepId,
    runId: active.runId,
    ...(active.storyId ? { storyId: active.storyId } : {}),
    ...(active.storyDbId ? { storyDbId: active.storyDbId } : {}),
    claimId: active.claimId,
    claimAgentId: active.claimAgentId,
    runtimeAgentId: active.agentId,
    ...(active.claimGeneration !== undefined ? { claimGeneration: active.claimGeneration } : {}),
    ...(active.attempt ? { attempt: active.attempt } : {}),
    workdir: active.spawnCwd,
    repo: active.spawnCwd,
  });
}

async function recoverClaimEnvelopeFromDatabase(input: Readonly<{
  runId: string;
  stepDbId: string;
  workflowStepId: string;
  storyId?: string;
  storyDbId?: string;
  claimAgentId?: string;
  runtimeAgentId: string;
  workdir?: string;
}>): Promise<ClaimEnvelopeV1 | undefined> {
  const claims = await pgQuery<{
    claim_id: string;
    claim_agent_id: string;
    protocol: "legacy" | "shadow" | "v3";
    packet_hash: string | null;
    claim_generation: number | null;
  }>(
    `SELECT cl.id::text AS claim_id,
            cl.agent_id AS claim_agent_id,
            r.protocol,
            r.packet_hash,
            st.claim_generation
       FROM claim_log cl
       JOIN runs r ON r.id = cl.run_id
       JOIN steps s ON s.id = $2 AND s.run_id = cl.run_id AND s.step_id = cl.step_id
       LEFT JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
      WHERE cl.run_id = $1
        AND cl.step_id = $3
        AND cl.story_id IS NOT DISTINCT FROM $4
        AND ($5::text IS NULL OR cl.agent_id = $5)
        AND cl.outcome IS NULL
      ORDER BY cl.id DESC
      LIMIT 2`,
    [input.runId, input.stepDbId, input.workflowStepId, input.storyId ?? null, input.claimAgentId ?? null],
  );
  if (claims.length === 0) return undefined;
  if (claims.length !== 1) throw new Error("RECOVERY_CLAIM_AUTHORITY_AMBIGUOUS");
  const claim = claims[0]!;
  const claimId = Number(claim.claim_id);
  if (!Number.isSafeInteger(claimId) || claimId <= 0) throw new Error("RECOVERY_CLAIM_ID_INVALID");

  let attempt: ClaimAttemptFenceV1 | undefined;
  if (claim.protocol !== "legacy" && input.storyId) {
    const attempts = await pgQuery<{
      attempt_id: string;
      generation: number;
      fence_token: string;
      agent_id: string | null;
      evidence_refs: string;
      packet_hash: string | null;
      compilation_report_hash: string | null;
      slice_hash: string | null;
    }>(
      `SELECT attempt_id, generation, fence_token, agent_id, evidence_refs,
              packet_hash, compilation_report_hash, slice_hash
         FROM execution_attempts
        WHERE run_id = $1
          AND step_id = $2
          AND story_id = $3
          AND claim_id = $4
          AND disposition IN ('claimed', 'running')
        ORDER BY generation DESC
        LIMIT 2`,
      [input.runId, input.workflowStepId, input.storyId, claimId],
    );
    if (attempts.length !== 1) throw new Error("RECOVERY_CLAIM_ATTEMPT_AMBIGUOUS");
    const candidate = attempts[0]!;
    let refs: unknown;
    try { refs = JSON.parse(candidate.evidence_refs); } catch { throw new Error("RECOVERY_CLAIM_ATTEMPT_EVIDENCE_INVALID"); }
    const claimRefs = Array.isArray(refs)
      ? refs.filter((ref): ref is string => typeof ref === "string" && /^setfarm:\/\/claim-log\/[1-9][0-9]*$/.test(ref))
      : [];
    if (
      claimRefs.length !== 1
      || claimRefs[0] !== `setfarm://claim-log/${claimId}`
      || (candidate.agent_id !== null && candidate.agent_id !== claim.claim_agent_id)
    ) {
      throw new Error("RECOVERY_CLAIM_ATTEMPT_BINDING_MISMATCH");
    }
    if (
      claim.protocol === "v3"
      && (
        !claim.packet_hash
        || candidate.packet_hash !== claim.packet_hash
        || !candidate.compilation_report_hash
        || !candidate.slice_hash
      )
    ) {
      throw new Error("RECOVERY_CLAIM_V3_ATTEMPT_CONTRACT_MISMATCH");
    }
    attempt = {
      attemptId: candidate.attempt_id,
      generation: candidate.generation,
      fenceToken: candidate.fence_token,
    };
  }

  return parseClaimEnvelope({
    schema: "setfarm.claim-envelope.v1",
    protocol: claim.protocol,
    issuedAt: new Date().toISOString(),
    stepId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    runId: input.runId,
    ...(input.storyId ? { storyId: input.storyId } : {}),
    ...(input.storyDbId ? { storyDbId: input.storyDbId } : {}),
    claimId,
    claimAgentId: claim.claim_agent_id,
    runtimeAgentId: input.runtimeAgentId,
    ...(claim.claim_generation !== null ? { claimGeneration: claim.claim_generation } : {}),
    ...(attempt ? { attempt } : {}),
    ...(input.workdir ? { workdir: input.workdir, repo: input.workdir } : {}),
  });
}

type OpenClawTaskRecord = {
  taskId?: string;
  status?: string;
  runtime?: string;
  requesterSessionKey?: string;
  ownerKey?: string;
  childSessionKey?: string;
};

type OpenClawSessionIndexRecord = {
  sessionId?: string;
  sessionFile?: string;
  status?: string;
  updatedAt?: number;
  abortedLastRun?: boolean;
};

type OpenClawCleanupResult = {
  sessions: number;
  tasks: number;
};

type SessionFileStats = {
  actions: number;
  writes: number;
  edits: number;
  noopEdits: number;
};

type SessionCommandStats = {
  failures: number;
  command: string;
  signature: string;
};

type SessionCommandCallStats = {
  calls: number;
  command: string;
};

const activeProcesses = new Map<string, ActiveProcess>();
const drainingProcesses = new Map<string, ActiveProcess>();
const queuedSpawns = new Set<string>();
const claimingSpawns = new Set<string>();
const inFlightSpawnPromises = new Set<Promise<void>>();
const agentCooldownUntil = new Map<string, number>();
let runtimeUsageLimitCooldownUntil = 0;
let shuttingDown = false;
let nextSpawnEarliest = 0;
let claimMaintenanceInFlight = false;
let terminalAttemptReconciler: ReturnType<typeof createPostgresTerminalAttemptReconciler> | undefined;
let terminalAttemptReconcileInFlight = false;
const SPAWNER_INSTANCE_ID = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;

function trackSpawn(promise: Promise<void>): void {
  const tracked = promise.catch((error) => {
    console.warn(`[spawner] tracked spawn failed: ${String(error).slice(0, 500)}`);
  });
  inFlightSpawnPromises.add(tracked);
  void tracked.then(() => inFlightSpawnPromises.delete(tracked));
}

function hasTrackedClaimRuntime(predicate: (active: ActiveProcess) => boolean): boolean {
  for (const active of activeProcesses.values()) {
    if (predicate(active) && childProcessTerminalReason(active.child) === null) return true;
  }
  for (const active of drainingProcesses.values()) {
    if (predicate(active)) return true;
  }
  return false;
}

function trackedRuntimeCount(): number {
  return new Set([
    ...[...activeProcesses.values()].map((active) => active.runtimeSessionId),
    ...[...drainingProcesses.values()].map((active) => active.runtimeSessionId),
  ]).size;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RUNTIME_GUARD_REQUEUE_SETTLE_MS = parsePositiveInt(
  process.env.SETFARM_RUNTIME_GUARD_REQUEUE_SETTLE_MS,
  15_000,
);

function formatDurationMs(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m${rest}s` : `${rest}s`;
}

function stuckThresholdMs(role: string, storyId?: string | null): number {
  if (storyId?.startsWith("QA-FIX-")) return QA_FIX_AGENT_STUCK_MS;
  if (role.includes("qa") || role.includes("test")) return QA_AGENT_STUCK_MS;
  return role === "developer" ? DEVELOPER_STUCK_MS : NON_DEVELOPER_STUCK_MS;
}

function isTerminalTestRole(role: string, agentId = ""): boolean {
  const value = `${role} ${agentId}`.toLowerCase();
  return value.includes("qa") || value.includes("tester") || value.includes("test");
}

function agentSessionJsonlPath(agentId: string, sessionId: string): string {
  return path.join(OPENCLAW_AGENTS_ROOT, agentId, "sessions", `${sessionId}.jsonl`);
}

function fileSize(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return Number.isFinite(stat.size) ? stat.size : 0;
  } catch {
    return 0;
  }
}

function fileMtimeMs(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : 0;
  } catch {
    return 0;
  }
}

function progressFileMtimeMs(runId: string): number {
  if (!runId) return 0;
  return fileMtimeMs(`/tmp/setfarm-progress-${runId}.txt`);
}

function activeProcessPromptActivityMs(active: ActiveProcess): number {
  return Math.max(
    active.startedAtMs,
    fileMtimeMs(active.transcriptPath),
    fileMtimeMs(active.sessionJsonlPath),
    fileMtimeMs(active.outputPath),
    progressFileMtimeMs(active.runId),
  );
}

function activeProcessHasVisibleOutput(active: ActiveProcess): boolean {
  if (fileSize(active.transcriptPath) > active.initialTranscriptSize) return true;
  return fileSize(active.outputPath) > 0;
}

function activeProcessHasStartupActivity(active: ActiveProcess): boolean {
  if (activeProcessHasVisibleOutput(active)) return true;
  return activeProcessLastActivityMs(active) > active.startedAtMs + 1000;
}

function readProcessCpuTicks(pid: number | undefined): number | null {
  if (!pid || process.platform !== "linux") return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf-8");
    const endComm = stat.lastIndexOf(")");
    if (endComm < 0) return null;
    const fields = stat.slice(endComm + 2).trim().split(/\s+/);
    const userTicks = Number(fields[11]);
    const systemTicks = Number(fields[12]);
    if (!Number.isFinite(userTicks) || !Number.isFinite(systemTicks)) return null;
    return userTicks + systemTicks;
  } catch {
    return null;
  }
}

function refreshActiveProcessCpuActivity(active: ActiveProcess): number {
  const ticks = readProcessCpuTicks(active.child.pid);
  if (ticks === null) return active.lastCpuActivityMs || active.startedAtMs;
  if (active.lastCpuTicks === undefined) {
    active.lastCpuTicks = ticks;
    return active.lastCpuActivityMs || active.startedAtMs;
  }
  if (ticks > active.lastCpuTicks) {
    active.lastCpuTicks = ticks;
    active.lastCpuActivityMs = Date.now();
  }
  return active.lastCpuActivityMs || active.startedAtMs;
}

function activeProcessLastActivityMs(active: ActiveProcess): number {
  let lastActivityMs = active.startedAtMs;
  if (!isTerminalTestRole(active.role, active.agentId)) {
    lastActivityMs = refreshActiveProcessCpuActivity(active);
  }
  for (const filePath of [active.transcriptPath, active.sessionJsonlPath, active.outputPath]) {
    try {
      const mtimeMs = fs.statSync(filePath).mtimeMs;
      if (Number.isFinite(mtimeMs) && mtimeMs > lastActivityMs) lastActivityMs = mtimeMs;
    } catch {}
  }
  return lastActivityMs;
}

function activeProcessIdleMs(active: ActiveProcess): number {
  return Date.now() - activeProcessLastActivityMs(active);
}

function extractSessionText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => {
      if (!part || typeof part !== "object") return "";
      if (typeof part.text === "string") return part.text;
      if (typeof part.content === "string") return part.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function sessionEventMessage(event: any): any {
  if (event?.message && typeof event.message === "object") return event.message;
  return event && typeof event === "object" ? event : {};
}

function parseToolArguments(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw as Record<string, any> : {};
}

function isWriteToolCallName(name: string): boolean {
  return /^(?:write|edit|writefile|strreplacefile|applypatch|apply_patch)$/i.test(String(name || ""));
}

function isEditToolCallName(name: string): boolean {
  return /^(?:edit|strreplacefile|applypatch|apply_patch)$/i.test(String(name || ""));
}

function extractToolCalls(content: unknown): Array<{ name: string; path: string; command: string; limit: number | null }> {
  const calls: Array<{ name: string; path: string; command: string; limit: number | null }> = [];
  const message = content && typeof content === "object" && !Array.isArray(content) ? content as any : {};
  const parts = Array.isArray(content) ? content as any[] : Array.isArray(message.content) ? message.content : [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const type = String(part.type || "");
    if (type !== "toolCall" && type !== "tool_use") continue;
    const name = String(part.name || part.toolName || "");
    const args = parseToolArguments(part.arguments || part.input || {});
    const candidate = typeof args.path === "string" ? args.path : typeof args.filePath === "string" ? args.filePath : typeof args.file_path === "string" ? args.file_path : "";
    const command = typeof args.command === "string" ? args.command : "";
    const rawLimit = args.limit ?? args.maxLines ?? args.max_lines ?? args.max_output_tokens;
    const parsedLimit = rawLimit === undefined || rawLimit === null || rawLimit === ""
      ? null
      : Number(rawLimit);
    calls.push({ name, path: candidate, command, limit: parsedLimit !== null && Number.isFinite(parsedLimit) ? parsedLimit : null });
  }
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls
    : Array.isArray(message.toolCalls)
      ? message.toolCalls
      : [];
  for (const call of toolCalls) {
    if (!call || typeof call !== "object") continue;
    const fn = call.function && typeof call.function === "object" ? call.function : {};
    const name = String(fn.name || call.name || call.toolName || "");
    const args = parseToolArguments(fn.arguments || call.arguments || call.input || {});
    const candidate = typeof args.path === "string" ? args.path : typeof args.filePath === "string" ? args.filePath : typeof args.file_path === "string" ? args.file_path : "";
    const command = typeof args.command === "string" ? args.command : "";
    const rawLimit = args.limit ?? args.maxLines ?? args.max_lines ?? args.max_output_tokens;
    const parsedLimit = rawLimit === undefined || rawLimit === null || rawLimit === ""
      ? null
      : Number(rawLimit);
    calls.push({ name, path: candidate, command, limit: parsedLimit !== null && Number.isFinite(parsedLimit) ? parsedLimit : null });
  }
  return calls;
}

function normalizeWorktreeRelativePath(workdir: string, rawPath: string): string {
  const cleaned = rawPath
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!cleaned) return "";
  const relative = path.isAbsolute(cleaned) ? path.relative(workdir, cleaned) : cleaned;
  return path.normalize(relative).replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizeRelativePath(rawPath: string): string {
  return normalizeWorktreeRelativePath(process.cwd(), rawPath);
}

function isGeneratedScreenComponentPath(relativePath: string): boolean {
  return /^src\/screens\/[^/]+\.tsx$/.test(relativePath);
}

function isGeneratedScreenSourceStubFile(workdir: string, relativePath: string): boolean {
  if (!isGeneratedScreenComponentPath(relativePath)) return false;
  try {
    const abs = path.join(workdir, relativePath);
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > 2_000) return false;
    const text = fs.readFileSync(abs, "utf-8");
    return /\bSetfarm generated screen source stub\b/.test(text)
      && /\bfull generated source is intentionally hidden\b/.test(text);
  } catch {
    return false;
  }
}

function readStoryScopeFileSet(workdir: string): Set<string> {
  const scopePath = path.join(workdir, ".story-scope-files");
  let raw = "";
  try {
    raw = fs.readFileSync(scopePath, "utf-8");
  } catch {
    return new Set();
  }
  return new Set(
    raw
      .split(/\r?\n/)
      .map((line) => normalizeWorktreeRelativePath(workdir, line))
      .filter(Boolean),
  );
}

function isReferenceMarkdownPath(relativePath: string): boolean {
  return /^references\/[^/]+\.md$/.test(relativePath);
}

export function expandSupportedGuardGlob(workdir: string, relativePath: string): string[] {
  const normalized = normalizeWorktreeRelativePath(workdir, relativePath);
  if (!normalized || normalized.startsWith("..")) return [];
  if (!normalized.includes("*")) return [normalized];

  if (normalized === "references/*.md") {
    try {
      const dir = path.join(workdir, "references");
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter((entry) => /^[^/]+\.md$/i.test(entry))
        .map((entry) => `references/${entry}`)
        .sort();
    } catch {
      return [];
    }
  }

  if (normalized === "src/screens/*.tsx") {
    try {
      const dir = path.join(workdir, "src", "screens");
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter((entry) => /^[^/]+\.tsx$/i.test(entry))
        .map((entry) => `src/screens/${entry}`)
        .sort();
    } catch {
      return [];
    }
  }

  return [];
}

function isBackendReferencePath(relativePath: string): boolean {
  return relativePath === "references/backend-standards.md";
}

function isImplementReferencePolicyFile(workdir: string, relativePath: string): boolean {
  if (relativePath !== "references/README.md" && relativePath !== "references/.setfarm-reference-policy.md") return false;
  try {
    const abs = path.join(workdir, relativePath);
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > 2_000) return false;
    const text = fs.readFileSync(abs, "utf-8");
    return /\bSetfarm Implement Reference Policy\b/.test(text)
      && /\bFull reference manuals are intentionally not mounted\b/.test(text);
  } catch {
    return false;
  }
}

function storyScopeLooksBackend(workdir: string): boolean {
  const allowed = Array.from(readStoryScopeFileSet(workdir));
  if (allowed.length === 0) return true;
  return allowed.some((file) =>
    /(^|\/)(api|server|routes|route|middleware|db|database|migrations|models|controllers|services|schemas)\//i.test(file)
    || /(^|\/)(server|api|db|database|prisma|schema|route|routes)\.[cm]?[jt]sx?$/i.test(file)
    || /\.(sql|prisma)$/i.test(file),
  );
}

function extractReferenceReadsFromCommand(workdir: string, command: string): Array<{ path: string; via: string; full: boolean }> {
  const reads: Array<{ path: string; via: string; full: boolean }> = [];
  if (!/\breferences\/[^'"`\s;|&]+\.md\b/.test(command)) return reads;
  const fullReadCommand = /\b(cat|less|bat|python3?|node)\b/.test(command);
  const shellReadCommand = /\b(cat|sed|nl|head|tail|less|bat|rg|grep|awk|find|wc|python3?|node)\b/.test(command);
  if (!shellReadCommand) return reads;

  for (const match of command.matchAll(/(?:^|[\s"'`=])((?:\.\/|\/)?(?:[\w.-]+\/)*references\/[^'"`\s;|&]+\.md)/g)) {
    const relativePath = normalizeWorktreeRelativePath(workdir, match[1] || "");
    const expanded = expandSupportedGuardGlob(workdir, relativePath).filter(isReferenceMarkdownPath);
    for (const path of expanded) reads.push({ path, via: "exec", full: fullReadCommand });
  }
  return reads;
}

function implementReferenceReadGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  const backendScope = storyScopeLooksBackend(active.spawnCwd);

  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message)) {
      const candidates: Array<{ path: string; via: string; full: boolean }> = [];
      if (call.name === "read" && call.path) {
        const relativePath = normalizeWorktreeRelativePath(active.spawnCwd, call.path);
        for (const path of expandSupportedGuardGlob(active.spawnCwd, relativePath).filter(isReferenceMarkdownPath)) {
          candidates.push({ path, via: "read", full: call.limit === null || call.limit > 220 });
        }
      }
      if (call.name === "exec" && call.command) {
        candidates.push(...extractReferenceReadsFromCommand(active.spawnCwd, call.command));
      }

      for (const candidate of candidates) {
        if (!candidateSourceExists(active.spawnCwd, candidate.path)) continue;
        if (isImplementReferencePolicyFile(active.spawnCwd, candidate.path)) continue;
        if (isBackendReferencePath(candidate.path) && !backendScope) {
          return {
            detected: true,
            reason: `IRRELEVANT_REFERENCE_CONTEXT: ${active.agentId} read ${candidate.path} during a non-backend implement story. Backend/API/DB standards must not be loaded into frontend/game story context; Setfarm recorded a supervisor signal so the worker can be redirected without restarting the claim.`,
          };
        }
        if (candidate.full) {
          return {
            detected: true,
            reason: `FULL_REFERENCE_CONTEXT_READ: ${active.agentId} loaded full ${candidate.path}. Implement claims must use injected rules and only inspect the smallest focused reference excerpt when the story owns that domain; Setfarm recorded a supervisor signal so the worker can be redirected without restarting the claim.`,
          };
        }
      }
    }
  }

  return { detected: false, reason: "" };
}

function candidateSourceExists(workdir: string, relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith("..")) return false;
  if (relativePath.includes("*")) {
    const expanded = expandSupportedGuardGlob(workdir, relativePath);
    if (expanded.length > 0) return expanded.some((item) => fs.existsSync(path.join(workdir, item)));
    if (relativePath === "references/*.md" || relativePath === "src/screens/*.tsx") return false;
    if (relativePath === "stitch/*.html") return directoryHasMatch(path.join(workdir, "stitch"), /\.html$/i);
    if (relativePath === ".stitch-screens*.json") return directoryHasMatch(workdir, /^\.stitch-screens.*\.json$/i);
    if (relativePath === "stitch/*") {
      return fs.existsSync(path.join(workdir, "stitch", "DESIGN_DOM.json"))
        || directoryHasMatch(path.join(workdir, "stitch"), /\.html$/i)
        || directoryHasMatch(path.join(workdir, "stitch"), /^\.stitch-screens.*\.json$/i);
    }
    return true;
  }
  return fs.existsSync(path.join(workdir, relativePath));
}

function directoryHasMatch(dir: string, pattern: RegExp): boolean {
  try {
    if (!fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((entry) => pattern.test(entry));
  } catch {
    return false;
  }
}

function shellCommandSegments(command: string): string[] {
  return command
    .split(/\s*(?:&&|\|\||;|\n)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function stripGeneratedScreenSafeMetadataRefs(text: string): string {
  return text.replace(/src\/screens\/(?:SCREEN_INDEX\.json|index\.ts)\b/g, "");
}

function stripExplicitGeneratedScreenComponentRefs(text: string): string {
  return text.replace(
    /(?:^|[\s"'`=])((?:\.\/|\/)?(?:[\w.-]+\/)*src\/screens\/[^'"`\s;|&*?[\]]+\.tsx)\b/g,
    " ",
  );
}

function hasBroadGeneratedScreenSourceRef(text: string): boolean {
  const withoutExplicitComponentRefs = stripExplicitGeneratedScreenComponentRefs(text);
  return /(?:^|[\s"'`=])(?:\.\/|\/)?(?:[\w.-]+\/)*src\/screens(?:\/|\s|$)/.test(withoutExplicitComponentRefs);
}

function isGeneratedScreenContentReadSegment(segment: string): boolean {
  const unsafeSegment = stripGeneratedScreenSafeMetadataRefs(segment);
  if (!/\bsrc\/screens(?:\/|\s|$)/.test(unsafeSegment)) return false;
  return /\b(cat|sed|nl|head|tail|less|bat|rg|grep|awk|wc|python3?|node)\b/i.test(segment)
    || /\b(?:readFileSync|readdirSync|createReadStream|glob(?:Sync)?|fast-glob)\b/i.test(segment);
}

function extractGeneratedScreenReadsFromCommand(workdir: string, command: string): Array<{ path: string; via: string }> {
  const reads: Array<{ path: string; via: string }> = [];
  for (const segment of shellCommandSegments(command)) {
    if (!isGeneratedScreenContentReadSegment(segment)) continue;
    const unsafeSegment = stripGeneratedScreenSafeMetadataRefs(segment);
    if (hasBroadGeneratedScreenSourceRef(unsafeSegment)) {
      reads.push({ path: "src/screens/*.tsx", via: "exec" });
    }
    for (const match of segment.matchAll(/(?:^|[\s"'`=])((?:\.\/|\/)?(?:[\w.-]+\/)*src\/screens\/[^'"`\s;|&*?[\]]+\.tsx)\b/g)) {
      const relativePath = normalizeWorktreeRelativePath(workdir, match[1] || "");
      if (isGeneratedScreenComponentPath(relativePath)) reads.push({ path: relativePath, via: "exec" });
    }
  }
  return reads;
}

function generatedScreenReadGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  const allowed = readStoryScopeFileSet(active.spawnCwd);

  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message)) {
      const candidates: Array<{ path: string; via: string }> = [];
      if (call.name === "read" && call.path) {
        const relativePath = normalizeWorktreeRelativePath(active.spawnCwd, call.path);
        for (const path of expandSupportedGuardGlob(active.spawnCwd, relativePath).filter(isGeneratedScreenComponentPath)) {
          candidates.push({ path, via: "read" });
        }
      }
      if (call.name === "exec" && call.command) {
        candidates.push(...extractGeneratedScreenReadsFromCommand(active.spawnCwd, call.command));
      }

      for (const candidate of candidates) {
        const candidatePaths = expandSupportedGuardGlob(active.spawnCwd, candidate.path)
          .filter(isGeneratedScreenComponentPath);
        if (candidatePaths.length === 0) continue;
        const unsafePath = candidatePaths.find((candidatePath) =>
          !allowed.has(candidatePath) && !isGeneratedScreenSourceStubFile(active.spawnCwd, candidatePath)
        );
        if (!unsafePath) continue;
        return {
          detected: true,
          reason: `GENERATED_SCREEN_SHARED_READ: ${active.agentId} used ${candidate.via} on ${candidate.path} (matched ${unsafePath}), but that generated screen is not in this story's .story-scope-files. Shared generated screens must be consumed through src/screens/SCREEN_INDEX.json, src/screens/index.ts, the component registry, and UI_CONTRACT. Setfarm recorded a supervisor signal so the worker can be redirected without restarting the claim.`,
        };
      }
    }
  }

  return { detected: false, reason: "" };
}

function isRawStitchDesignPath(relativePath: string): boolean {
  return /^stitch\/[^/]+\.html$/i.test(relativePath)
    || relativePath === "stitch/DESIGN_DOM.json"
    || /^\.stitch-screens.*\.json$/i.test(relativePath);
}

function stripSafeStitchMetadataRefs(text: string): string {
  return text
    .replace(/stitch\/(?:design-tokens\.css|UI_CONTRACT\.json|DESIGN_MANIFEST\.json)\b/g, "")
    .replace(/\.stitch\b/g, "");
}

function isRawStitchDesignReadSegment(segment: string): boolean {
  const unsafeSegment = stripSafeStitchMetadataRefs(segment);
  if (!/(?:\bstitch\/|\bstitch\b|\.stitch-screens)/i.test(unsafeSegment)) return false;
  if (!/(?:\.html\b|DESIGN_DOM\.json|\.stitch-screens.*\.json)/i.test(unsafeSegment)
    && !/(?:^|[\s"'`=])(?:\.\/|\/)?(?:[\w.@-]+\/)*stitch\/?(?:[\s"'`;|&]|$)/i.test(unsafeSegment)) return false;
  return /\b(cat|sed|nl|head|tail|less|bat|rg|grep|awk|wc|python3?|node)\b/i.test(segment)
    || /\b(?:readFileSync|readdirSync|createReadStream|glob(?:Sync)?|fast-glob)\b/i.test(segment);
}

function extractRawStitchDesignReadsFromCommand(workdir: string, command: string): Array<{ path: string; via: string }> {
  const reads: Array<{ path: string; via: string }> = [];
  for (const segment of shellCommandSegments(command)) {
    if (!isRawStitchDesignReadSegment(segment)) continue;
    if (/(?:^|[\s"'`=])(?:\.\/|\/)?(?:[\w.@-]+\/)*stitch\/?(?:[\s"'`;|&]|$)/i.test(stripSafeStitchMetadataRefs(segment))) {
      reads.push({ path: "stitch/*", via: "exec" });
    }
    if (/(?:\bstitch\/|\bstitch\b)/i.test(segment) && /\.html\b/i.test(segment)) {
      reads.push({ path: "stitch/*.html", via: "exec" });
    }
    if (/DESIGN_DOM\.json/i.test(segment)) {
      reads.push({ path: "stitch/DESIGN_DOM.json", via: "exec" });
    }
    if (/\.stitch-screens.*\.json/i.test(segment)) {
      reads.push({ path: ".stitch-screens*.json", via: "exec" });
    }
    for (const match of segment.matchAll(/(?:^|[\s"'`=])((?:\.\/|\/)?(?:[\w.-]+\/)*(?:stitch\/[^'"`\s;|&]+\.html|stitch\/DESIGN_DOM\.json|\.stitch-screens[^'"`\s;|&]*\.json))/gi)) {
      const relativePath = normalizeWorktreeRelativePath(workdir, match[1] || "");
      if (isRawStitchDesignPath(relativePath)) reads.push({ path: relativePath, via: "exec" });
    }
  }
  return reads;
}

function hasGeneratedScreenCorpus(workdir: string): boolean {
  const indexPath = path.join(workdir, "src", "screens", "SCREEN_INDEX.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    if (Array.isArray(parsed) && parsed.some((item) => isGeneratedScreenComponentPath(String(item?.file || "")))) {
      return true;
    }
  } catch {
    // Fall through to directory scan.
  }

  try {
    const screensDir = path.join(workdir, "src", "screens");
    return fs.existsSync(screensDir)
      && fs.readdirSync(screensDir).some((name) => /^[^/]+\.tsx$/.test(name));
  } catch {
    return false;
  }
}

function rawStitchDesignReadGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  if (!hasGeneratedScreenCorpus(active.spawnCwd)) {
    return { detected: false, reason: "" };
  }

  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message)) {
      const candidates: Array<{ path: string; via: string }> = [];
      if (call.name === "read" && call.path) {
        const relativePath = normalizeWorktreeRelativePath(active.spawnCwd, call.path);
        if (isRawStitchDesignPath(relativePath)) candidates.push({ path: relativePath, via: "read" });
      }
      if (call.name === "exec" && call.command) {
        candidates.push(...extractRawStitchDesignReadsFromCommand(active.spawnCwd, call.command));
      }

      if (candidates.length > 0) {
        const candidate = candidates.find((item) => candidateSourceExists(active.spawnCwd, item.path));
        if (!candidate) continue;
        return {
          detected: true,
          reason: `RAW_STITCH_CONTEXT_READ: ${active.agentId} used ${candidate.via} on ${candidate.path}. This generated-screen implement claim must use injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX, and story-owned generated screens instead of loading raw stitch HTML/full DESIGN_DOM context. Non-generated stacks may use focused story-owned Stitch files as binding design input. Setfarm recorded a supervisor signal so the worker can be redirected without restarting the claim.`,
        };
      }
    }
  }

  return { detected: false, reason: "" };
}

function isPreDeltaProjectContextPath(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith("..")) return false;
  if (/^(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(?:\.[^/]+)?\.json)$/.test(relativePath)) return true;
  if (/^(vite|vitest|jest|tailwind|postcss|eslint)\.config\.[cm]?[jt]s$/.test(relativePath)) return true;
  if (/^(src|app|components|lib|pages|tests?|public)\//.test(relativePath)) return true;
  if (/^stitch\/(?:design-tokens\.css|UI_CONTRACT\.json|DESIGN_MANIFEST\.json)$/.test(relativePath)) return true;
  return false;
}

function normalizePreDeltaContextPath(relativePath: string): string {
  return relativePath.replace(/^\.\/+/, "").replace(/\/+$/, "");
}

function isPreDeltaSafeContextPath(relativePath: string, allowed: Set<string>): boolean {
  const normalized = normalizePreDeltaContextPath(relativePath);
  if (!normalized || normalized.startsWith("..")) return true;
  if (allowed.has(normalized)) return true;
  if (/^(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(?:\.[^/]+)?\.json)$/.test(normalized)) return true;
  if (/^(vite|vitest|jest|tailwind|postcss|eslint)\.config\.[cm]?[jt]s$/.test(normalized)) return true;
  if (/^src\/screens(?:\/(?:SCREEN_INDEX\.json|index\.ts))?$/.test(normalized)) return true;
  if (/^src\/test(?:\/(?:setup|utils)\.[cm]?[jt]sx?)?$/.test(normalized)) return true;
  if (/^src\/setupTests\.[cm]?[jt]sx?$/.test(normalized)) return true;
  return false;
}

function preDeltaContextReadsFromCommand(active: ActiveProcess, command: string): string[] {
  if (!/\b(cat|sed|nl|head|tail|less|bat|rg|grep|awk|wc|python3?|node)\b/i.test(command)) return [];
  const paths = new Set<string>();
  for (const match of command.matchAll(/(?:^|[\s"'`=])((?:\.\/|\/)?(?:[\w.@-]+\/)*(?:src|app|components|lib|pages|tests?|public|stitch)\/[^'"`\s;|&]+|(?:\.\/)?(?:package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(?:\.[^/]+)?\.json|(?:vite|vitest|jest|tailwind|postcss|eslint)\.config\.[cm]?[jt]s))(?:[\s"'`;|&]|$)/gi)) {
    const relativePath = normalizeSessionProjectRelativePath(active, match[1] || "");
    if (isPreDeltaProjectContextPath(relativePath)) paths.add(relativePath);
  }
  for (const dir of ["src", "app", "components", "lib", "pages", "tests", "test", "public"]) {
    const re = new RegExp(`(?:^|[\\s"'\\\`=])(?:\\.\\/|\\/)?(?:[\\w.@-]+\\/)*${dir}\\/?(?:[\\s"';|&]|$)`, "i");
    if (re.test(command)) paths.add(`${dir}/*`);
  }
  if (/(?:^|[\s"'`=])(?:\.\/|\/)?(?:[\w.@-]+\/)*stitch\/?(?:[\s"';|&]|$)/i.test(stripSafeStitchMetadataRefs(command))) {
    paths.add("stitch/*");
  }
  return Array.from(paths);
}

function claimSummaryRetryDisciplineMode(active: ActiveProcess): string {
  if (!active.claimSummaryPath) return "";
  try {
    const parsed = JSON.parse(fs.readFileSync(active.claimSummaryPath, "utf-8"));
    return String(parsed?.retryDiscipline?.mode || "").trim();
  } catch {
    return "";
  }
}

function implementPreDeltaCheckGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };
  if (sourceStatusFiles(active.spawnCwd).length > 0) return { detected: false, reason: "" };
  if (!/^first-delta$/i.test(claimSummaryRetryDisciplineMode(active))) return { detected: false, reason: "" };

  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message)) {
      if (!call.command || !isVerifyDeterministicEvidenceCommand(call.command)) continue;
      const command = compactCommandForDiagnostic(call.command);
      return {
        detected: true,
        reason: `IMPLEMENT_PRE_DELTA_CHECK_VIOLATION: ${active.agentId} ran deterministic checks before any source delta during first-delta supervisor discipline (${command}). The worker must read CLAIM_SUMMARY_FILE, inspect only owned scope files plus safe metadata needed for the first edit, make a small scoped source change, then run build/test/lint.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

function implementPreDeltaExplorationGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };
  if (sourceStatusFiles(active.spawnCwd).length > 0) return { detected: false, reason: "" };
  if (!/^first-delta$/i.test(claimSummaryRetryDisciplineMode(active))) return { detected: false, reason: "" };

  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  const allowed = readStoryScopeFileSet(active.spawnCwd);
  const contextReads = new Set<string>();
  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message)) {
      if (call.name === "read" && call.path) {
        const relativePath = normalizeSessionProjectRelativePath(active, call.path);
        if (isPreDeltaProjectContextPath(relativePath) && !isPreDeltaSafeContextPath(relativePath, allowed)) {
          contextReads.add(normalizePreDeltaContextPath(relativePath));
        }
      }
      if (call.command) {
        for (const relativePath of preDeltaContextReadsFromCommand(active, call.command)) {
          if (!isPreDeltaSafeContextPath(relativePath, allowed)) {
            contextReads.add(normalizePreDeltaContextPath(relativePath));
          }
        }
      }
    }
  }

  if (contextReads.size > IMPLEMENT_PRE_DELTA_MAX_CONTEXT_READS) {
    return {
      detected: true,
      reason: `IMPLEMENT_PRE_DELTA_CONTEXT_SPRAWL: ${active.agentId} read ${contextReads.size} project/design context paths before any source delta (${Array.from(contextReads).slice(0, 8).join(", ")}). Supervisor should redirect the worker to read CLAIM_SUMMARY_FILE, inspect only owned scope files and safe metadata needed for the first edit, then make a small scoped code change before broad analysis.`,
    };
  }

  return { detected: false, reason: "" };
}

function isImplementEvidenceRequestArtifact(relativePath: string, storyId?: string): boolean {
  if (!storyId) return false;
  const normalizedStoryId = String(storyId || "").trim();
  if (!normalizedStoryId || normalizedStoryId.includes("/") || normalizedStoryId.includes("\\")) return false;
  const base = `.setfarm/implement/${normalizedStoryId}/`;
  return relativePath === `${base}IMPLEMENT_INTENT.json`
    || relativePath === `${base}IMPLEMENT_VERIFICATION_REQUEST.json`;
}

function isRuntimeScopeAllowedWrite(relativePath: string, allowed: Set<string>, storyId?: string): boolean {
  if (isForbiddenProjectScratchArtifact(relativePath)) return false;
  if (allowed.has(relativePath)) return true;
  if (isImplementEvidenceRequestArtifact(relativePath, storyId)) return true;
  if (relativePath === ".story-scope-files" || relativePath === ".story-branch" || relativePath === "pre-commit") return true;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/i.test(relativePath)) return true;
  return /^(vitest|jest)\.config\.[cm]?[jt]s$/i.test(relativePath)
    || relativePath === "src/test/setup.ts"
    || relativePath === "src/test/utils.ts"
    || relativePath === "src/setupTests.ts";
}

function isForbiddenProjectScratchArtifact(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) return false;
  const base = path.basename(normalized);
  if (/^__test[-_.].*\.(?:txt|json|log)$/i.test(base)) return true;
  if (/^(?:test|write|test-write|write-test)(?:[-_.].*)?\.[cm]?[jt]sx?$/i.test(base)) return true;
  if (/^_?(?:debug|probe|scratch|tmp|temp)(?:[-_.].*)?\.[cm]?[jt]sx?$/i.test(base)) return true;
  if (/(?:^|\/)src\/(?:_)?(?:debug|probe|scratch|tmp|temp)\.[cm]?[jt]sx?$/i.test(normalized)) return true;
  return /(?:^|\/)(?:debug|probe|scratch|tmp|temp)\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(normalized)
    || /(?:^|\/)_(?:debug|probe|scratch|tmp|temp)\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(normalized);
}

function isRuntimeControlArtifactWrite(rawPath: string | undefined, active: ActiveProcess): boolean {
  if (!rawPath) return false;
  const resolved = path.resolve(active.spawnCwd, rawPath);
  if (active.outputPath && resolved === path.resolve(active.outputPath)) return true;

  const runtimePrivateRoots = [
    path.join(os.homedir(), ".openclaw", "setfarm", "kimi-runtime"),
  ].map((item) => path.resolve(item));
  if (runtimePrivateRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) return true;

  if (path.dirname(resolved) !== "/tmp") return false;
  const base = path.basename(resolved);
  return /^setfarm-progress-[A-Za-z0-9_.-]+\.txt$/.test(base);
}

function implementScopeWriteGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  const allowed = readStoryScopeFileSet(active.spawnCwd);
  if (!allowed.size) return { detected: false, reason: "" };

  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (!isWriteToolCallName(call.name)) continue;
      if (isRuntimeControlArtifactWrite(call.path, active)) continue;
      const relativePath = normalizeWorktreeRelativePath(active.spawnCwd, call.path);
      if (!relativePath || isRuntimeScopeAllowedWrite(relativePath, allowed, active.storyId)) continue;
      const probeHint = /(?:^|\/|_)(probe|scratch|tmp|test-write|write-test)[^/]*\.[cm]?[jt]sx?$/i.test(relativePath)
        ? " Do not create TypeScript probe/scratch/test-write files in the project tree to infer shared component props or test write persistence; use claim-summary designContracts.componentTypes or a /tmp-only experiment that never writes under WORKDIR."
        : "";
      return {
        detected: true,
        reason: `SCOPE_WRITE_VIOLATION: ${active.agentId} attempted ${call.name} on ${relativePath}, but this story may only write .story-scope-files entries.${probeHint} Runtime supervisor killed the claim before out-of-scope work could be committed.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

function rejectedRetryDeletionLinesFromClaimSummary(active: ActiveProcess): string[] {
  if (!active.claimSummaryPath || !fs.existsSync(active.claimSummaryPath)) return [];
  try {
    const raw = fs.readFileSync(active.claimSummaryPath, "utf-8");
    const summary = JSON.parse(raw);
    const protectedSnippets = summary?.retryFeedback?.protectedSnippets;
    if (Array.isArray(protectedSnippets) && protectedSnippets.length > 0) {
      return [...new Set(protectedSnippets
        .map((line) => String(line || "").trim())
        .filter(Boolean)
      )];
    }
    const text = JSON.stringify(summary);
    const match = text.match(/Repeated deletions:\s*([\s\S]*?)(?:\s+ALSO_FIX:|\s+RETRY_ACTION|\s+RETRY_INSTRUCTION|$)/);
    if (!match) return [];
    return match[1]
      .split("|")
      .map((line) => line.replace(/\\+"/g, "\"").replace(/\\n/g, "\n").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function meaningfulDiffLines(diff: string, marker: "+" | "-"): string[] {
  const header = marker === "+" ? "+++" : "---";
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith(marker) && !line.startsWith(header))
    .map((line) => line.slice(1).trim())
    .filter((line) => line.length >= 12)
    .filter((line) => !/^[{}()[\],;]+$/.test(line));
}

function currentWorktreeDiffLineStats(workdir: string): { deleted: string[]; added: string[] } {
  try {
    const diff = execFileSync("git", ["diff", "--no-ext-diff", "HEAD", "--"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10_000,
      maxBuffer: 5 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      deleted: meaningfulDiffLines(diff, "-"),
      added: meaningfulDiffLines(diff, "+"),
    };
  } catch {
    return { deleted: [], added: [] };
  }
}

function implementRejectedRetryPatchRuntimeGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  if (!active.storyId || !active.spawnCwd || !fs.existsSync(path.join(active.spawnCwd, ".git"))) return { detected: false, reason: "" };
  const rejectedLines = rejectedRetryDeletionLinesFromClaimSummary(active);
  if (rejectedLines.length === 0) return { detected: false, reason: "" };
  const diffStats = currentWorktreeDiffLineStats(active.spawnCwd);
  const currentDeleted = new Set(diffStats.deleted);
  const repeated = rejectedLines.filter((line) => currentDeleted.has(line));
  const uniqueRepeated = [...new Set(repeated)];
  if (uniqueRepeated.length < 2) return { detected: false, reason: "" };
  const uniqueAdded = [...new Set(diffStats.added)];
  if (uniqueAdded.length >= Math.max(5, uniqueRepeated.length + 3)) return { detected: false, reason: "" };
  return {
    detected: true,
    reason: `RETRY_PATCH_REAPPLIED_RUNTIME_GUARD: ${active.agentId} reintroduced ${uniqueRepeated.length} deletion(s) from a rejected retry patch for ${active.storyId}; killing before completion so the next claim starts from a clean worktree. Preserve/restore previously verified lines: ${uniqueRepeated.slice(0, 6).join(" | ")}`,
  };
}

function compactCommandForDiagnostic(command: string): string {
  return command.replace(/\s+/g, " ").trim().slice(0, 240);
}

function hasImplementGitWrapper(workdir: string): boolean {
  try {
    return fs.existsSync(path.join(workdir, ".setfarm-bin", "git"));
  } catch {
    return false;
  }
}

function commandBypassesImplementGitWrapper(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  return /(?:^|[\s;&|])(?:\/usr\/bin\/git|\/bin\/git|\/opt\/homebrew\/bin\/git|\/usr\/local\/bin\/git)\b/.test(compact)
    || /(?:^|[\s;&|])env\b[^;&|]*\bPATH=/.test(compact)
    || /(?:^|[\s;&|])PATH=/.test(compact)
    || /\bSETFARM_(?:PLATFORM|RECOVERY)_COMMIT=1\b/.test(compact);
}

function isTextSearchCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  return /(?:^|[\s;&|])(?:rg|grep|egrep|fgrep|awk|sed)\b/i.test(compact)
    && !/(?:^|[\s;&|])(?:git|\/usr\/bin\/git|\/bin\/git|\/opt\/homebrew\/bin\/git|\/usr\/local\/bin\/git)\s+(?:add|commit|push)\b/i.test(compact);
}

function isBroadGitAddCommand(command: string): boolean {
  if (isTextSearchCommand(command)) return false;
  const compact = compactCommandForDiagnostic(command);
  return /\bgit\s+add\s+(?:-[A-Za-z]*A[A-Za-z]*\b|--all\b|\.(?:\s|$|&&|\|\||;))/i.test(compact);
}

function isAnyGitAddCommand(command: string): boolean {
  if (isTextSearchCommand(command)) return false;
  return /\bgit\s+add\b/i.test(compactCommandForDiagnostic(command));
}

function isGitPushCommand(command: string): boolean {
  if (isTextSearchCommand(command)) return false;
  return /\bgit\s+push\b/i.test(compactCommandForDiagnostic(command));
}

function gitCommitMessages(command: string): string[] {
  if (isTextSearchCommand(command)) return [];
  const compact = compactCommandForDiagnostic(command);
  const messages: string[] = [];
  for (const match of compact.matchAll(/\bgit\s+commit\b[^;&|]*(?:-m|--message=?)\s*(?:"([^"]*)"|'([^']*)'|([^\s;&|]+))/gi)) {
    messages.push(String(match[1] ?? match[2] ?? match[3] ?? "").trim());
  }
  if (messages.length === 0 && /\bgit\s+commit\b/i.test(compact)) messages.push("");
  return messages;
}

function implementGitDisciplineGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  let commitCount = 0;
  const wrapperInstalled = hasImplementGitWrapper(active.spawnCwd);
  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (!call.command) continue;
      const command = compactCommandForDiagnostic(call.command);
      const wrapperBypassHint = wrapperInstalled && commandBypassesImplementGitWrapper(command)
        ? " Wrapper bypass attempt detected."
        : "";

      if (isBroadGitAddCommand(command) || isAnyGitAddCommand(command)) {
        return {
          detected: true,
          reason: `GIT_DISCIPLINE_VIOLATION: ${active.agentId} ran agent-side staging (${command}). Implement claims must not stage files; Setfarm performs the final scoped story commit after gates pass. Runtime supervisor killed the claim before unmanaged staging could be accepted.${wrapperBypassHint}`,
        };
      }
      if (isGitPushCommand(command)) {
        return {
          detected: true,
          reason: `GIT_DISCIPLINE_VIOLATION: ${active.agentId} ran agent-side push (${command}). Implement claims must not push branches; Setfarm pushes the story branch after scoped commit and supervisor gates pass.${wrapperBypassHint}`,
        };
      }

      const messages = gitCommitMessages(command);
      for (const commitMessage of messages) {
        commitCount += 1;
        if (/^wip\b|work in progress/i.test(commitMessage)) {
          return {
            detected: true,
            reason: `INTERMEDIATE_COMMIT_VIOLATION: ${active.agentId} created a WIP commit (${commitMessage || "no message"}). Implement claims must not commit; Setfarm creates the final scoped story commit after gates pass.${wrapperBypassHint}`,
          };
        }
        return {
          detected: true,
          reason: `GIT_DISCIPLINE_VIOLATION: ${active.agentId} ran agent-side commit (${command}). Implement claims must not commit; Setfarm creates the final scoped story commit after gates pass.${wrapperBypassHint}`,
        };
      }
      if (commitCount > 1) {
        return {
          detected: true,
          reason: `INTERMEDIATE_COMMIT_VIOLATION: ${active.agentId} ran git commit ${commitCount} times in one implement claim. Implement claims must not commit; Setfarm creates the final scoped story commit after gates pass.`,
        };
      }
    }
  }

  return { detected: false, reason: "" };
}

function isBroadProcessCleanupCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!compact) return false;

  const broadTargets = "(?:node|npm|pnpm|yarn|bun|vite|vitest|tsx|ts-node|playwright|chromium|chrome)";
  return new RegExp(`\\bpkill\\b[^;&|]*(?:-f\\b[^;&|]*)?\\b${broadTargets}\\b`, "i").test(compact)
    || new RegExp(`\\bkillall\\b[^;&|]*\\b${broadTargets}\\b`, "i").test(compact)
    || new RegExp(`\\bkill\\b[^;&|]*\\$\\([^)]*\\bpgrep\\b[^)]*(?:-f\\b[^)]*)?\\b${broadTargets}\\b[^)]*\\)`, "i").test(compact)
    || new RegExp(`\\bpgrep\\b[^;&|]*(?:-f\\b[^;&|]*)?\\b${broadTargets}\\b[^;&|]*\\|\\s*xargs\\s+(?:-[^;&|]+\\s+)*kill\\b`, "i").test(compact);
}

function implementProcessCleanupGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (!call.command || !isBroadProcessCleanupCommand(call.command)) continue;
      const command = compactCommandForDiagnostic(call.command);
      return {
        detected: true,
        reason: `BROAD_PROCESS_CLEANUP_VIOLATION: ${active.agentId} ran broad process cleanup (${command}). Implement agents may not kill shared dev/runtime processes with pkill/killall/pgrep pipelines; Setfarm owns runtime port lifecycle and cleanup. Runtime supervisor killed the claim before shared previews could be disrupted.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

function isRawClaimFileRead(command: string, claimSummaryPath?: string): boolean {
  if (!command) return false;
  if (claimSummaryPath && command.includes(claimSummaryPath)) return false;
  if (/\bclaim-summary-[^'"`\s;|&]+\.json\b/.test(command)) return false;
  return /\/tmp\/claim-[^'"`\s;|&]+\.json\b/.test(command)
    && /\b(jq|node|python3?|sed|head|tail|cat|grep|rg|awk|wc)\b/.test(command);
}

function isRawClaimInputProbe(command: string, claimSummaryPath?: string): boolean {
  if (!isRawClaimFileRead(command, claimSummaryPath)) return false;
  return /(?:^|[^\w])(?:JSON\.parse\([^)]*\)|[A-Za-z_$][\w$]*)\.input\b/i.test(command)
    || /\bObject\.keys\([^)]*\.input\b/i.test(command)
    || /\bclaim\.input\b/i.test(command);
}

function claimParseLoopGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  let rawClaimReads = 0;
  let summaryReads = 0;
  let writes = 0;
  let edits = 0;
  let rawClaimInputProbes = 0;
  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (isWriteToolCallName(call.name) && !isEditToolCallName(call.name)) writes += 1;
      if (isEditToolCallName(call.name)) edits += 1;
      if (call.path && active.claimSummaryPath && call.path.includes(active.claimSummaryPath)) summaryReads += 1;
      if (call.path && /\/tmp\/claim-[^'"`\s;|&]+\.json\b/.test(call.path)) rawClaimReads += 1;
      if (call.command) {
        if (active.claimSummaryPath && call.command.includes(active.claimSummaryPath)) summaryReads += 1;
        if (isRawClaimFileRead(call.command, active.claimSummaryPath)) rawClaimReads += 1;
        if (isRawClaimInputProbe(call.command, active.claimSummaryPath)) rawClaimInputProbes += 1;
      }
    }
  }

  if (rawClaimInputProbes > 0 && writes === 0 && edits === 0 && sourceStatusFiles(active.spawnCwd).length === 0 && fileSize(active.outputPath) === 0) {
    return {
      detected: true,
      reason: `CLAIM_PARSE_LOOP: ${active.agentId} parsed raw claim.input before making any source delta (${rawClaimInputProbes} probe${rawClaimInputProbes === 1 ? "" : "s"}). Workers must use CLAIM_SUMMARY_FILE focused fields and only read the raw claim for non-input audit fallback such as stepId.`,
    };
  }
  if (rawClaimReads >= CLAIM_PARSE_LOOP_MIN_READS && writes === 0 && edits === 0 && fileSize(active.outputPath) === 0) {
    return {
      detected: true,
      reason: `CLAIM_PARSE_LOOP: ${active.agentId} read raw /tmp/claim-*.json ${rawClaimReads} times without writing project files or output. Workers must use CLAIM_SUMMARY_FILE first and must not jq/sed/head/node-loop over claim.input.`,
    };
  }
  if (rawClaimReads >= CLAIM_PARSE_LOOP_MIN_READS * 2 && summaryReads === 0) {
    return {
      detected: true,
      reason: `CLAIM_SUMMARY_IGNORED: ${active.agentId} kept parsing raw /tmp/claim-*.json (${rawClaimReads} reads) and never used CLAIM_SUMMARY_FILE. Setfarm recorded a supervisor signal for handoff discipline.`,
    };
  }

  return { detected: false, reason: "" };
}

function isVerifyDeterministicEvidenceCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!compact) return false;
  return /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(build|test|test:run|lint|typecheck)\b/i.test(compact)
    || /(?:^|[\s;&|()])(?:bash|sh)?\s*\.setfarm-bin\/setfarm-check\s+(?:build|test|lint)\b/i.test(compact)
    || /(?:^|[\s;&|()])npx\s+(vitest\s+run|eslint\s+(?:\.|src|app|components|lib|pages|tests?|--))/i.test(compact)
    || /(?:^|[\s;&|()])vitest\s+run\b/i.test(compact)
    || /(?:^|[\s;&|()])(?:timeout\s+\d+\s+)?(?:\.\/)?node_modules\/\.bin\/vitest\s+run\b/i.test(compact)
    || isProjectWideTscNoEmitCommand(compact)
    || /(?:^|[\s;&|()])eslint\s+(?:\.|src|app|components|lib|pages|tests?|--)/i.test(compact)
    || /\bnode\b[^;&|]*\b(smoke-test|playwright-check)\b/i.test(compact);
}

function isProjectWideTscNoEmitCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!/(?:^|[\s;&|()])(?:npx\s+)?tsc\s+--noEmit\b/i.test(compact)) return false;
  return !/(?:^|[\s;&|()])(?:npx\s+)?tsc\s+--noEmit\b(?:(?![;&|()]).)*\s(?:src|app|components|lib|pages|tests?)\//i.test(compact);
}

function preservesPipelineExitStatus(command: string): boolean {
  return /\bset\s+-(?:[A-Za-z]*o\s+)?pipefail\b/i.test(command)
    || /\bset\s+-[A-Za-z]*\b[^\n;|&]*\bpipefail\b/i.test(command)
    || /\bPIPESTATUS\s*\[\s*0\s*\]/.test(command);
}

function isModifiedBootstrapCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!/\/tmp\/setfarm-claim-bootstrap-[^'"`\s;|&]+\.sh\b/.test(compact)) return false;
  if (/^\s*bash\s+['"]?\/tmp\/setfarm-claim-bootstrap-[^'"`\s;|&]+\.sh['"]?\s*$/.test(compact)) return false;
  return true;
}

function implementBootstrapCommandGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-256_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (!call.command || !isModifiedBootstrapCommand(call.command)) continue;
      const command = compactCommandForDiagnostic(call.command);
      return {
        detected: true,
        reason: `BOOTSTRAP_COMMAND_MODIFIED: ${active.agentId} used the bootstrap file outside the exact executable handoff command (${command}). The bootstrap file must only run as the exact printed command, with no cat/read/inspection, redirection, pipe, head/tail, tee, timeout, grouping, or command chaining; use the printed bootstrap lines and Setfarm summary helpers instead.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

export function isSetfarmHelperScriptReadCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!compact || !/\.setfarm-bin\/setfarm-(?:check|summary|evidence)\b/.test(compact)) return false;
  return shellCommandSegments(compact).some((segment) => {
    if (!/\.setfarm-bin\/setfarm-(?:check|summary|evidence)\b/.test(segment)) return false;
    return /\b(?:cat|head|tail|sed|grep|rg|awk|less|more|nl|wc)\b[\s\S]{0,160}\.setfarm-bin\/setfarm-(?:check|summary|evidence)\b/i.test(segment);
  });
}

const ALLOWED_SETFARM_SUMMARY_TOPICS = new Set([
  "current-story",
  "implement-context",
  "acceptance",
  "scope-files",
  "checks",
  "workdirs",
  "git-policy",
  "retry",
  "retry-feedback",
  "retry-patch",
  "source-snapshot",
  "screen-usage-contract",
  "design-contracts",
  "output-contract",
  "supervisor-memory",
]);

export function isSetfarmSummaryHelpCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!compact || !/\.setfarm-bin\/setfarm-summary\b/.test(compact)) return false;
  return /(?:^|[\s;&|()])(?:CLAIM_SUMMARY_FILE=(?:'[^']+'|"[^"]+"|\S+)\s+)?node\s+(?:'[^']*\.setfarm-bin\/setfarm-summary'|"[^"]*\.setfarm-bin\/setfarm-summary"|(?:\S*\/)?\.setfarm-bin\/setfarm-summary)\s+(?:--help|-h|help)\b/.test(compact);
}

export function isUnsupportedSetfarmSummaryCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!compact || !/\.setfarm-bin\/setfarm-summary\b/.test(compact)) return false;
  if (isSetfarmHelperScriptReadCommand(compact)) return false;
  if (isSetfarmSummaryHelpCommand(compact)) return false;
  if (/\.setfarm-bin\/setfarm-summary\b[\s\S]*(?:[|<>]|&&|\|\||;)/.test(compact)) return true;

  const summaryRe = /(?:^|[\s;&|()])(?:CLAIM_SUMMARY_FILE=(?:'[^']+'|"[^"]+"|\S+)\s+)?node\s+(?:'[^']*\.setfarm-bin\/setfarm-summary'|"[^"]*\.setfarm-bin\/setfarm-summary"|(?:\S*\/)?\.setfarm-bin\/setfarm-summary)(?:\s+([A-Za-z0-9_-]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = summaryRe.exec(compact)) !== null) {
    const topic = String(match[1] || "").trim();
    if (!topic || !ALLOWED_SETFARM_SUMMARY_TOPICS.has(topic)) return true;
  }

  return shellCommandSegments(compact).some((segment) => {
    if (!/\.setfarm-bin\/setfarm-summary\b/.test(segment)) return false;
    return /[|<>]/.test(segment) || /(?:^|[\s;&|()])(?:&&|\|\||;)\s*/.test(segment);
  });
}

function implementSetfarmHelperScriptReadGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-256_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (!call.command || !isSetfarmHelperScriptReadCommand(call.command)) continue;
      const command = compactCommandForDiagnostic(call.command);
      return {
        detected: true,
        reason: `SETFARM_HELPER_SCRIPT_READ: ${active.agentId} inspected Setfarm helper implementation instead of using it as a command (${command}). Use printed SUMMARY_*_CMD and CHECK_*_CMD commands exactly; do not cat/read/head/grep/sed helper scripts.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

function implementUnsupportedSetfarmSummaryCommandGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-256_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (!call.command || !isUnsupportedSetfarmSummaryCommand(call.command)) continue;
      const command = compactCommandForDiagnostic(call.command);
      return {
        detected: true,
        reason: `SETFARM_SUMMARY_COMMAND_UNSUPPORTED: ${active.agentId} ran setfarm-summary outside the printed exact helper commands (${command}). Use only the printed SUMMARY_*_CMD commands exactly, without guessed topics, pipes, redirection, head/tail, tee, timeout, grouping, or command chaining.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

export function isMaskedDeterministicCheckCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!compact || !isVerifyDeterministicEvidenceCommand(compact)) return false;
  if (!/[|]/.test(compact) || preservesPipelineExitStatus(command)) return false;
  return shellCommandSegments(compact).some((segment) => {
    if (!/[|]/.test(segment) || !isVerifyDeterministicEvidenceCommand(segment)) return false;
    return /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|test|test:run|lint|typecheck)\b[\s\S]{0,160}\|[\s\S]{0,120}\b(?:head|tail|grep|rg|tee|cat|awk|sed)\b/i.test(segment)
      || /(?:^|[\s;&|()])(?:bash|sh)?\s*\.setfarm-bin\/setfarm-check\s+(?:build|test|lint)\b[\s\S]{0,160}\|[\s\S]{0,120}\b(?:head|tail|grep|rg|tee|cat|awk|sed)\b/i.test(segment)
      || /(?:^|[\s;&|()])(?:timeout\s+\d+\s+)?(?:(?:npx\s+)?vitest\s+run\b|(?:\.\/)?node_modules\/\.bin\/vitest\s+run\b|eslint\s+(?:\.|src|app|components|lib|pages|tests?|--))[\s\S]{0,160}\|[\s\S]{0,120}\b(?:head|tail|grep|rg|tee|cat|awk|sed)\b/i.test(segment)
      || (isProjectWideTscNoEmitCommand(segment) && /(?:^|[\s;&|()])(?:npx\s+)?tsc\s+--noEmit\b[\s\S]{0,160}\|[\s\S]{0,120}\b(?:head|tail|grep|rg|tee|cat|awk|sed)\b/i.test(segment));
  });
}

function implementMaskedCheckCommandGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-512_000).trim();
  } catch {
    return { detected: false, reason: "" };
  }
  if (!raw) return { detected: false, reason: "" };

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message)) {
      if (!call.command || !isMaskedDeterministicCheckCommand(call.command)) continue;
      const command = compactCommandForDiagnostic(call.command);
      return {
        detected: true,
        reason: `MASKED_CHECK_COMMAND: ${active.agentId} ran deterministic build/test evidence through an output-filtering pipeline (${command}). Pipelines such as build/test | tail/head/grep/tee/cat can hide the real failing exit code. Rerun the declared build/test command without a pipe, or save output to a log and inspect it after preserving the command exit status.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

function readSessionJsonlForGuard(filePath: string): string {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return "";
  }
  const fileSize = Number(stat.size);
  if (!Number.isFinite(fileSize) || fileSize <= 0) return "";

  const headBytes = Math.max(0, SESSION_GUARD_HEAD_BYTES);
  const tailBytes = Math.max(0, SESSION_GUARD_TAIL_BYTES);
  const windowBytes = headBytes + tailBytes;
  try {
    if (windowBytes <= 0 || fileSize <= windowBytes) {
      return fs.readFileSync(filePath, "utf-8").trim();
    }

    const fd = fs.openSync(filePath, "r");
    try {
      const head = Buffer.alloc(Math.min(headBytes, fileSize));
      const tail = Buffer.alloc(Math.min(tailBytes, fileSize));
      if (head.length > 0) fs.readSync(fd, head, 0, head.length, 0);
      if (tail.length > 0) fs.readSync(fd, tail, 0, tail.length, Math.max(0, fileSize - tail.length));
      return `${head.toString("utf-8")}\n${tail.toString("utf-8")}`.trim();
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

function isSourceReviewPath(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith("..")) return false;
  if (relativePath === "src/screens/SCREEN_INDEX.json" || relativePath === "src/screens/index.ts") return false;
  if (/^src\/screens\/[^/]+\.tsx$/.test(relativePath)) return false;
  if (/^src\/.*\.(tsx?|jsx?|css|scss|sass|less)$/.test(relativePath)) return true;
  if (/^tests?\/.*\.(tsx?|jsx?)$/.test(relativePath)) return true;
  return /\.(test|spec)\.(tsx?|jsx?)$/.test(relativePath);
}

function normalizeSessionProjectRelativePath(active: ActiveProcess, rawPath: string): string {
  let relativePath = normalizeWorktreeRelativePath(active.spawnCwd, rawPath);
  if (relativePath && !relativePath.startsWith("..")) return relativePath;

  const cleaned = rawPath.replace(/^['"]|['"]$/g, "").trim();
  const storyWorktreeMatch = cleaned.match(/\/story-worktrees\/[^/]+\/(.+)$/);
  if (storyWorktreeMatch?.[1]) return path.normalize(storyWorktreeMatch[1]).replace(/\\/g, "/");

  const projectMatch = cleaned.match(/\/projects\/[^/]+\/(.+)$/);
  if (projectMatch?.[1]) return path.normalize(projectMatch[1]).replace(/\\/g, "/");

  return relativePath;
}

function sourceReviewReadsFromCommand(active: ActiveProcess, command: string): string[] {
  if (!/\b(cat|sed|nl|head|tail|less|bat|rg|grep|awk|wc|python3?|node)\b/i.test(command)) return [];
  const paths = new Set<string>();
  for (const match of command.matchAll(/(?:^|[\s"'`=])((?:\.\/|\/)?(?:[\w.@-]+\/)*[\w.@-]+\.(?:tsx?|jsx?|css|scss|sass|less))(?:[\s"'`;|&]|$)/gi)) {
    const relativePath = normalizeSessionProjectRelativePath(active, match[1] || "");
    if (isSourceReviewPath(relativePath)) paths.add(relativePath);
  }
  return Array.from(paths);
}

function verifyBoundedReviewGuard(active: ActiveProcess, ageMs: number): { detected: boolean; reason: string } {
  if (ageMs < VERIFY_BOUNDED_REVIEW_MIN_AGE_MS) return { detected: false, reason: "" };

  const raw = readSessionJsonlForGuard(active.sessionJsonlPath);
  if (!raw) return { detected: false, reason: "" };

  const preEvidenceReads = new Set<string>();
  let sawDeterministicEvidence = false;

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message)) {
      if (call.command && isVerifyDeterministicEvidenceCommand(call.command)) {
        sawDeterministicEvidence = true;
        continue;
      }
      if (sawDeterministicEvidence) continue;

      if (call.name === "read" && call.path) {
        const relativePath = normalizeSessionProjectRelativePath(active, call.path);
        if (isSourceReviewPath(relativePath)) preEvidenceReads.add(relativePath);
      }
      if (call.command) {
        for (const relativePath of sourceReviewReadsFromCommand(active, call.command)) {
          preEvidenceReads.add(relativePath);
        }
      }
    }
  }

  if (!sawDeterministicEvidence && preEvidenceReads.size >= VERIFY_BOUNDED_REVIEW_MAX_SOURCE_READS && fileSize(active.outputPath) === 0) {
    return {
      detected: true,
      reason: `VERIFY_BOUNDED_REVIEW_VIOLATION: ${active.agentId} read ${preEvidenceReads.size} project source/test files before running build/test/lint evidence in verify (${Array.from(preEvidenceReads).slice(0, 6).join(", ")}). Verify is a bounded gate, not broad manual source review: read PR metadata, run deterministic commands once, then inspect only changed files needed for the first blocker.`,
    };
  }

  return { detected: false, reason: "" };
}

function supervisorBoundedAuditGuard(active: ActiveProcess, ageMs: number): { detected: boolean; reason: string } {
  if (ageMs < SUPERVISOR_BOUNDED_AUDIT_MIN_AGE_MS) return { detected: false, reason: "" };
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };

  const raw = readSessionJsonlForGuard(active.sessionJsonlPath);
  if (!raw) return { detected: false, reason: "" };

  let toolCalls = 0;
  const sourceReads = new Set<string>();

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message)) {
      toolCalls++;
      if (call.name === "read" && call.path) {
        const relativePath = normalizeSessionProjectRelativePath(active, call.path);
        if (isSourceReviewPath(relativePath)) sourceReads.add(relativePath);
      }
      if (call.command) {
        for (const relativePath of sourceReviewReadsFromCommand(active, call.command)) {
          sourceReads.add(relativePath);
        }
      }
    }
  }

  if (toolCalls >= SUPERVISOR_BOUNDED_AUDIT_MAX_TOOL_CALLS || sourceReads.size >= SUPERVISOR_BOUNDED_AUDIT_MAX_SOURCE_READS) {
    const details = [
      `${toolCalls} tool calls`,
      `${sourceReads.size} source/test reads`,
    ].join(", ");
    const sampleReads = Array.from(sourceReads).slice(0, 8).join(", ");
    return {
      detected: true,
      reason: `SUPERVISOR_BOUNDED_AUDIT_VIOLATION: ${active.agentId} kept a supervise audit open without STATUS/output after ${details}${sampleReads ? ` (${sampleReads})` : ""}. Supervisor is a bounded product coherence gate: use claim summary, supervisor ledger, direct evidence artifacts, and only directly relevant files; emit STATUS before broad source-review loops or provider step limits.`,
    };
  }

  return { detected: false, reason: "" };
}

function normalizedSessionCommand(command: string): string {
  const compact = command.replace(/\s+/g, " " ).trim();
  if (!compact) return "";
  const isEvidenceCommand = /\b(vitest|npm\s+(run\s+)?test|pnpm\s+test|yarn\s+test|bun\s+test|playwright|npm\s+run\s+build|tsc)\b/i.test(compact);
  const isReadOnlyExplorationCommand =
    /\b(rg|grep|cat|sed|nl|head|tail|awk|wc)\b/i.test(compact)
    && !/\b(>|>>|tee|perl\s+-pi|sed\s+-i|python3?|node|apply_patch|git\s+(?:add|commit|push|checkout|switch|reset))\b/i.test(compact);
  if (!isEvidenceCommand && !isReadOnlyExplorationCommand) return "";
  return compact
    .replace(/\/home\/setrox\/\.openclaw\/workspaces\/workflows\/[^ ]+/g, "<workdir>")
    .replace(/\/Users\/[^ ]+\/\.openclaw\/workspaces\/workflows\/[^ ]+/g, "<workdir>")
    .replace(/\/Users\/[^ ]+\/projects\/[A-Za-z0-9._-]+/g, "<project>")
    .replace(/--reporter(=|\s+)\S+/g, "--reporter")
    .replace(/\|\s*(tail|head)\s+-\d+.*$/i, "")
    .replace(/\|\s*grep\b.*$/i, "")
    .slice(0, 220);
}

function sessionFailureSignature(text: string): string {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, " " ).replace(/\s+/g, " " ).trim();
  if (!/(FAIL|Failed Tests|Tests?\s+\d+\s+failed|AssertionError|TestingLibraryElementError|ReferenceError|TypeError|error TS\d+)/i.test(clean)) return "";
  const pieces = [
    clean.match(/FAIL\s+[^|]{0,260}/i)?.[0],
    clean.match(/(AssertionError|TestingLibraryElementError|ReferenceError|TypeError|error TS\d+)[^|]{0,180}/i)?.[0],
    clean.match(/Tests?\s+\d+\s+failed[^|]{0,80}/i)?.[0],
    clean.match(/Unable to find[^|]{0,180}/i)?.[0],
    clean.match(/expected[^|]{0,120}/i)?.[0],
  ].filter(Boolean);
  return pieces.join(" | " ).slice(0, 420);
}

function compactHeartbeatText(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*m/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function latestSessionActivitySummary(active: ActiveProcess): string {
  let raw = "";
  try {
    raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").slice(-256_000).trim();
  } catch {
    return "";
  }
  if (!raw) return "";

  const lines = raw.split(/\n/).filter(Boolean).slice(-80);
  for (let i = lines.length - 1; i >= 0; i--) {
    let event: any;
    try { event = JSON.parse(lines[i]); } catch { continue; }
    const message = sessionEventMessage(event);
    const role = String(message.role || "");
    const content = message.content;

    if (role === "toolResult") {
      const text = compactHeartbeatText(extractSessionText(content));
      if (text) return `tool result: ${text}`;
      const toolName = String(message.toolName || "").trim();
      if (toolName) return `tool result: ${toolName}`;
      continue;
    }

    if (role === "assistant") {
      const text = compactHeartbeatText(extractSessionText(content));
      if (text) return `assistant: ${text}`;
      const calls = extractToolCalls(content).map((call) => call.name).filter(Boolean);
      if (calls.length > 0) return `assistant tool calls: ${calls.slice(0, 5).join(", ")}`;
    }
  }

  return "";
}

async function updateRunningStepHeartbeat(active: ActiveProcess, stepIdName: string, ageMs: number): Promise<void> {
  if (!active.stepId || Date.now() - (active.lastHeartbeatMs || 0) < AGENT_HEARTBEAT_MS) return;

  const sessionSummary = latestSessionActivitySummary(active);
  const signature = `${stepIdName}|${sessionSummary}|${Math.floor(ageMs / AGENT_HEARTBEAT_MS)}`;
  if (!sessionSummary && active.lastHeartbeatSignature === signature) return;

  const output = [
    `HEARTBEAT: ${new Date().toISOString()}`,
    `RUNNING: ${active.agentId} ${active.wfId}/${active.role} for ${formatDurationMs(ageMs)}`,
    sessionSummary ? `LAST_SESSION_ACTIVITY: ${sessionSummary}` : "LAST_SESSION_ACTIVITY: no session output yet",
    `TRANSCRIPT: ${active.transcriptPath}`,
    `SESSION: ${active.sessionJsonlPath}`,
  ].join("\n");

  try {
    await pgRun(
      "UPDATE steps SET output = $1, updated_at = NOW() WHERE id = $2 AND status = 'running'",
      [output, active.stepId],
    );
    active.lastHeartbeatMs = Date.now();
    active.lastHeartbeatSignature = signature;
  } catch (err) {
    console.warn(`[spawner] failed heartbeat for ${active.agentId}: ${String(err).slice(0, 300)}`);
  }
}

async function heartbeatRunningV3RecoveryOwner(active: ActiveProcess): Promise<boolean> {
  if (!active.recoveryDispatchId) return true;
  if (Date.now() - (active.lastRecoveryOwnerHeartbeatMs || 0) < V3_RECOVERY_OWNER_HEARTBEAT_MS) {
    return true;
  }
  if (
    active.protocol !== "v3"
    || !active.storyId
    || !active.claimId
    || !active.attempt
    || !active.recoveryRevisionId
    || !active.recoveryLeaseToken
  ) {
    console.warn(`[spawner] V3_RECOVERY_OWNER_HEARTBEAT_IDENTITY_INCOMPLETE:${active.recoveryDispatchId}`);
    return false;
  }
  try {
    const retained = await createV3RecoveryOwnerLeaseRepository(getSql()).heartbeat({
      kind: "model_runtime",
      runId: active.runId,
      storyId: active.storyId,
      claimId: active.claimId,
      claimAgentId: active.claimAgentId,
      revisionId: active.recoveryRevisionId,
      dispatchId: active.recoveryDispatchId,
      ownerInstanceId: active.runtimeOwnerInstanceId,
      leaseToken: active.recoveryLeaseToken,
      attempt: active.attempt,
      runtimeSessionId: active.runtimeSessionId,
    }, { leaseMs: V3_RECOVERY_OWNER_LEASE_MS });
    if (retained.status !== "retained") {
      console.warn(`[spawner] V3_RECOVERY_OWNER_LEASE_LOST:${active.recoveryDispatchId}:${retained.reason}`);
      return false;
    }
    active.lastRecoveryOwnerHeartbeatMs = Date.now();
    return true;
  } catch (error) {
    console.warn(`[spawner] V3_RECOVERY_OWNER_HEARTBEAT_FAILED:${active.recoveryDispatchId}:${String(error).slice(0, 300)}`);
    return false;
  }
}

function repeatedTranscriptToolLoop(active: ActiveProcess): { detected: boolean; reason: string } {
  try {
    const tail = fs.readFileSync(active.transcriptPath, "utf-8").slice(-120_000);
    let maxRepeats = 0;
    for (const match of tail.matchAll(/Loop warning: exec called (\d+) times with identical arguments/gi)) {
      const repeats = parseInt(match[1] || "", 10);
      if (Number.isFinite(repeats) && repeats > maxRepeats) maxRepeats = repeats;
    }
    if (maxRepeats >= AGENT_SELF_LOOP_MIN_REPEATED_COMMANDS) {
      return {
        detected: true,
        reason: "AGENT_SELF_LOOP: OpenClaw reported repeated identical exec calls" +
          " (repeats=" + maxRepeats + ")",
      };
    }

    const reminderRepeats = (tail.match(/repeating the exact same tool call with identical parameters/gi) || []).length;
    if (reminderRepeats >= AGENT_SELF_LOOP_MIN_REPEATED_COMMANDS) {
      return {
        detected: true,
        reason: "AGENT_SELF_LOOP: runtime reported repeated identical tool calls" +
          " (reminders=" + reminderRepeats + ")",
      };
    }
  } catch {}
  return { detected: false, reason: "" };
}

function repeatedSessionFileLoop(active: ActiveProcess): { detected: boolean; reason: string } {
  const transcriptLoop = repeatedTranscriptToolLoop(active);
  if (transcriptLoop.detected) return transcriptLoop;

  let lines: string[];
  try {
    const raw = fs.readFileSync(active.sessionJsonlPath, "utf-8").trim();
    if (!raw) return { detected: false, reason: "" };
    lines = raw.split(/\n/).filter(Boolean).slice(-120);
  } catch {
    return { detected: false, reason: "" };
  }

  const fileStats = new Map<string, SessionFileStats>();
  const commandCallStats = new Map<string, SessionCommandCallStats>();
  const commandStats = new Map<string, SessionCommandStats>();
  let currentToolPath = "";
  let currentCommand = "";
  for (const line of lines) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const message = sessionEventMessage(event);
    const role = String(message.role || "");
    if (role === "assistant") {
      for (const call of extractToolCalls(message)) {
        if (call.name === "exec") {
          currentCommand = normalizedSessionCommand(call.command);
          currentToolPath = "";
          if (currentCommand) {
            const stats = commandCallStats.get(currentCommand) || { calls: 0, command: currentCommand };
            stats.calls += 1;
            commandCallStats.set(currentCommand, stats);
          }
          continue;
        }
        currentCommand = "";
        if (!isWriteToolCallName(call.name)) continue;
        const target = call.path || currentToolPath;
        if (!target) continue;
        const stats = fileStats.get(target) || { actions: 0, writes: 0, edits: 0, noopEdits: 0 };
        stats.actions += 1;
        if (isWriteToolCallName(call.name) && !isEditToolCallName(call.name)) stats.writes += 1;
        if (isEditToolCallName(call.name)) stats.edits += 1;
        fileStats.set(target, stats);
        currentToolPath = target;
      }
      continue;
    }

    if (role === "toolResult") {
      const text = extractSessionText(message.content);
      if (currentCommand) {
        const signature = sessionFailureSignature(text);
        if (signature) {
          const key = currentCommand + " => " + signature;
          const stats = commandStats.get(key) || { failures: 0, command: currentCommand, signature };
          stats.failures += 1;
          commandStats.set(key, stats);
        }
      }
      if (!/No changes made/i.test(text) || !currentToolPath) continue;
      const stats = fileStats.get(currentToolPath) || { actions: 0, writes: 0, edits: 0, noopEdits: 0 };
      stats.noopEdits += 1;
      fileStats.set(currentToolPath, stats);
    }
  }

  for (const stats of commandCallStats.values()) {
    if (stats.calls >= AGENT_SELF_LOOP_MIN_REPEATED_COMMANDS) {
      return {
        detected: true,
        reason: "AGENT_SELF_LOOP: repeated identical test/build command" +
          " (calls=" + stats.calls +
          ", command=" + stats.command + ")",
      };
    }
  }

  for (const stats of commandStats.values()) {
    if (stats.failures >= AGENT_SELF_LOOP_MIN_REPEATED_FAILURES) {
      return {
        detected: true,
        reason: "AGENT_SELF_LOOP: repeated failing command output" +
          " (failures=" + stats.failures +
          ", command=" + stats.command +
          ", signature=" + stats.signature + ")",
      };
    }
  }

  for (const [filePath, stats] of fileStats) {
    if (stats.actions >= AGENT_SELF_LOOP_MIN_ACTIONS && stats.noopEdits >= AGENT_SELF_LOOP_MIN_NOOP_EDITS) {
      const rel = filePath.replace(/^\/home\/setrox\//, "~/");
      return {
        detected: true,
        reason: "AGENT_SELF_LOOP: repeated write/edit no-op loop on " + rel +
          " (actions=" + stats.actions +
          ", writes=" + stats.writes +
          ", edits=" + stats.edits +
          ", noop_edits=" + stats.noopEdits + ")",
      };
    }
  }
  return { detected: false, reason: "" };
}

type GatewayReadyBody = { ready?: boolean; ok?: boolean; uptimeMs?: number; failing?: unknown };

type GatewayReadiness = {
  ready: boolean;
  reason: string;
  retryAfterMs: number;
};

function isBackgroundWorkflow(wfId: string): boolean {
  return BACKGROUND_WORKFLOWS.has(wfId);
}

async function shouldDeferBackgroundWorkflow(wfId: string): Promise<boolean> {
  if (!isBackgroundWorkflow(wfId)) return false;
  const row = await pgGet<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running' AND workflow_id <> ALL($1::text[])",
    [[...BACKGROUND_WORKFLOWS]],
  );
  return parseInt(row?.cnt || "0", 10) > 0;
}

function gatewayFailingList(body: GatewayReadyBody): string[] {
  return Array.isArray(body.failing) ? body.failing.map((item) => String(item)).filter(Boolean) : [];
}

function hasOnlyIgnorableGatewayFailures(body: GatewayReadyBody): boolean {
  const failing = gatewayFailingList(body);
  return failing.length > 0 && failing.every((item) => GATEWAY_IGNORABLE_FAILING.has(item));
}

function canBypassGatewaySidecars(body: GatewayReadyBody): boolean {
  return hasOnlyIgnorableGatewayFailures(body)
    && typeof body.uptimeMs === "number"
    && Number.isFinite(body.uptimeMs)
    && body.uptimeMs >= GATEWAY_SIDECAR_BYPASS_AFTER_MS;
}

async function getGatewayReadiness(): Promise<GatewayReadiness> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(GATEWAY_READY_URL, { signal: controller.signal });
    const text = await res.text();
    let body: GatewayReadyBody = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        // Some gateway endpoints return plain text/html after readiness. Treat 2xx as ready.
      }
    }
    if (!res.ok) {
      if (canBypassGatewaySidecars(body)) {
        return { ready: true, reason: `agent-ready; ignoring gateway sidecars: ${gatewayFailingList(body).join(",")}`, retryAfterMs: 0 };
      }
      const failing = gatewayFailingList(body);
      const suffix = failing.length ? `; failing=${failing.join(",")}` : "";
      return { ready: false, reason: `ready endpoint returned HTTP ${res.status}${suffix}`, retryAfterMs: GATEWAY_PRESPAWN_RETRY_MS };
    }
    if (body.ready === false) {
      if (canBypassGatewaySidecars(body)) {
        return { ready: true, reason: `agent-ready; ignoring gateway sidecars: ${gatewayFailingList(body).join(",")}`, retryAfterMs: 0 };
      }
      const failing = gatewayFailingList(body);
      const suffix = failing.length ? `; failing=${failing.join(",")}` : "";
      return { ready: false, reason: `gateway reports not ready${suffix}`, retryAfterMs: GATEWAY_PRESPAWN_RETRY_MS };
    }
    if (typeof body.uptimeMs === "number" && Number.isFinite(body.uptimeMs) && body.uptimeMs < GATEWAY_WARMUP_MS) {
      const remainingMs = GATEWAY_WARMUP_MS - body.uptimeMs;
      const retryAfterMs = Math.min(Math.max(remainingMs, GATEWAY_PRESPAWN_RETRY_MS), GATEWAY_WARMUP_MS);
      return { ready: false, reason: `gateway warmup active for ${formatDurationMs(remainingMs)}`, retryAfterMs };
    }
    if (typeof body.uptimeMs !== "number") {
      const processWarmupRemainingMs = GATEWAY_WARMUP_MS - (Date.now() - spawnerStartedAtMs);
      if (processWarmupRemainingMs > 0) {
        const retryAfterMs = Math.min(Math.max(processWarmupRemainingMs, GATEWAY_PRESPAWN_RETRY_MS), GATEWAY_WARMUP_MS);
        return { ready: false, reason: `spawner warmup fallback active for ${formatDurationMs(processWarmupRemainingMs)}`, retryAfterMs };
      }
    }
    if (body.ready === true || body.ok === true || !text.trim()) {
      return { ready: true, reason: "ready", retryAfterMs: 0 };
    }
    return { ready: true, reason: "ready endpoint returned HTTP 2xx", retryAfterMs: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const healthController = new AbortController();
    const healthTimeout = setTimeout(() => healthController.abort(), 2000);
    try {
      const healthRes = await fetch(GATEWAY_HEALTH_URL, { signal: healthController.signal });
      const healthText = await healthRes.text();
      let healthBody: GatewayReadyBody = {};
      if (healthText.trim()) {
        try {
          healthBody = JSON.parse(healthText);
        } catch {
          // Plain text health responses are acceptable when HTTP status is 2xx.
        }
      }
      if (healthRes.ok && healthBody.ok !== false && healthBody.ready !== false) {
        return { ready: true, reason: `ready endpoint unavailable (${message}); health endpoint returned HTTP 2xx`, retryAfterMs: 0 };
      }
    } catch {
      // Fall through to the original readiness failure.
    } finally {
      clearTimeout(healthTimeout);
    }
    if (gatewayNotReadySinceMs !== null && Date.now() - gatewayNotReadySinceMs >= GATEWAY_TIMEOUT_BYPASS_AFTER_MS) {
      return { ready: true, reason: `gateway probe timeout bypass after ${formatDurationMs(Date.now() - gatewayNotReadySinceMs)}: ${message}`, retryAfterMs: 0 };
    }
    return { ready: false, reason: `ready endpoint unavailable: ${message}`, retryAfterMs: GATEWAY_PRESPAWN_RETRY_MS };
  } finally {
    clearTimeout(timeout);
  }
}

function noteGatewayReady(): void {
  gatewayNotReadySinceMs = null;
}

function maybeRestartGatewayForReadiness(reason: string, key: string): void {
  const nowMs = Date.now();
  if (gatewayNotReadySinceMs === null) gatewayNotReadySinceMs = nowMs;
  const notReadyAgeMs = nowMs - gatewayNotReadySinceMs;
  if (notReadyAgeMs < GATEWAY_PRESPAWN_RESTART_AFTER_MS) return;
  if (gatewayRestartInFlight) return;
  if (trackedRuntimeCount() > 0) return;
  if (nowMs - lastGatewayPrespawnRestartMs < GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS) return;
  if (process.platform !== "linux") {
    lastGatewayPrespawnRestartMs = nowMs;
    console.warn(`[spawner] Gateway restart skipped on ${process.platform} before ${key}. reason=${reason}`);
    return;
  }

  gatewayRestartInFlight = true;
  lastGatewayPrespawnRestartMs = nowMs;
  console.warn(`[spawner] Gateway not ready for ${formatDurationMs(notReadyAgeMs)} before ${key}; restarting openclaw-gateway. reason=${reason}`);
  execFile("systemctl", ["--user", "restart", "openclaw-gateway"], { timeout: 20_000 }, (err, stdout, stderr) => {
    gatewayRestartInFlight = false;
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] gateway prespawn restart failed: ${msg}`);
      return;
    }
    gatewayNotReadySinceMs = null;
    console.log("[spawner] gateway prespawn restart completed");
  });
}

function buildOpenClawChildEnv(pathPrefix?: string): NodeJS.ProcessEnv {
  const e: Record<string, string | undefined> = { ...process.env, OPENCLAW_AUTO_APPROVE: "1" };
  for (const k of ["MASTER_POSTGRES_URL", "MASTER_MARIADB_URL", "MASTER_MONGODB_URL"]) {
    delete e[k];
  }
  e["SETFARM_PG_URL"] = runtimeConfig.setfarmPgUrl;
  // Project agents run build, test, and verification commands. A global
  // NODE_ENV=production from the service environment makes React/Vitest load
  // production React, which breaks Testing Library's act() and creates false
  // QA failures. Let package scripts or explicit commands set NODE_ENV.
  delete e["NODE_ENV"];
  if (pathPrefix) {
    e["PATH"] = `${pathPrefix}${path.delimiter}${e["PATH"] || process.env.PATH || ""}`;
  }
  return e as NodeJS.ProcessEnv;
}

function symlinkOrCopyIfExists(source: string, target: string): void {
  try {
    if (!fs.existsSync(source) || fs.existsSync(target)) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(source, target);
  } catch {
    try {
      const stats = fs.statSync(source);
      if (stats.isDirectory()) {
        fs.cpSync(source, target, { recursive: true, force: false, errorOnExist: false });
      } else {
        fs.copyFileSync(source, target);
      }
    } catch {
      // Best-effort only. If auth/config cannot be prepared, the child process
      // will fail normally and Setfarm's infra routing will surface it.
    }
  }
}

function stripKimiOauthSections(config: string): string {
  return config
    .split(/\n(?=\[)/g)
    .filter((section) => {
      const header = section.match(/^\s*\[([^\]]+)\]/)?.[1] || "";
      return !/\.oauth(?:\.|$)/.test(header);
    })
    .join("\n");
}

function replaceKimiApiKeys(config: string, apiKey: string): string {
  return config.replace(/^(\s*api_key\s*=\s*)["'][^"']*["']/gm, `$1"${apiKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
}

function writeKimiApiKeyConfig(sourceConfigPath: string, targetConfigPath: string, apiKey: string): boolean {
  if (!apiKey.trim() || !fs.existsSync(sourceConfigPath)) return false;
  try {
    const source = fs.readFileSync(sourceConfigPath, "utf-8");
    const rewritten = replaceKimiApiKeys(stripKimiOauthSections(source), apiKey.trim());
    fs.mkdirSync(path.dirname(targetConfigPath), { recursive: true });
    fs.writeFileSync(targetConfigPath, rewritten, { mode: 0o600 });
    return true;
  } catch (err) {
    console.warn(`[spawner] failed to prepare Kimi API-key config: ${String(err).slice(0, 220)}`);
    return false;
  }
}

function prepareKimiIsolatedHome(sessionId: string): string {
  const root = path.join(os.homedir(), ".openclaw", "setfarm", "kimi-runtime", sessionId);
  const home = path.join(root, "home");
  const kimiDir = path.join(home, ".kimi");
  fs.mkdirSync(kimiDir, { recursive: true });
  const sourceKimi = path.join(os.homedir(), ".kimi");
  const apiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "";
  const wroteApiKeyConfig = writeKimiApiKeyConfig(
    path.join(sourceKimi, "config.toml"),
    path.join(kimiDir, "config.toml"),
    apiKey,
  );
  const entries = wroteApiKeyConfig
    ? ["device_id", "mcp.json", "latest_version.txt"]
    : ["config.toml", "credentials", "device_id", "mcp.json", "latest_version.txt"];
  for (const entry of entries) {
    symlinkOrCopyIfExists(path.join(sourceKimi, entry), path.join(kimiDir, entry));
  }
  fs.mkdirSync(path.join(kimiDir, "sessions"), { recursive: true });
  fs.mkdirSync(path.join(kimiDir, "logs"), { recursive: true });
  fs.mkdirSync(path.join(kimiDir, "telemetry"), { recursive: true });
  fs.mkdirSync(path.join(home, ".cache"), { recursive: true });
  fs.mkdirSync(path.join(home, ".config"), { recursive: true });
  return home;
}

const DEFAULT_SETFARM_OPENCLAW_PLUGIN_ALLOW = ["minimax", "kimi", "moonshot", "lmstudio"];

function parseOpenClawAgentPluginAllow(): string[] {
  const raw = process.env.SETFARM_OPENCLAW_PLUGIN_ALLOW || DEFAULT_SETFARM_OPENCLAW_PLUGIN_ALLOW.join(",");
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? [...new Set(values)] : [...DEFAULT_SETFARM_OPENCLAW_PLUGIN_ALLOW];
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function prepareOpenClawIsolatedConfig(sessionId: string, options: { agentId?: string; workspaceDir?: string } = {}): string | undefined {
  if (process.env.SETFARM_OPENCLAW_ISOLATED_CONFIG === "0") return undefined;
  const sourceConfigPath = process.env.OPENCLAW_CONFIG_PATH?.trim() || path.join(os.homedir(), ".openclaw", "openclaw.json");
  try {
    const source = JSON.parse(fs.readFileSync(sourceConfigPath, "utf-8")) as unknown;
    const next = isJsonRecord(source) ? JSON.parse(JSON.stringify(source)) as Record<string, unknown> : {};
    const plugins = isJsonRecord(next.plugins) ? next.plugins : {};
    const entries = isJsonRecord(plugins.entries) ? plugins.entries : {};
    const codexEntry = isJsonRecord(entries.codex) ? entries.codex : {};
    entries.codex = { ...codexEntry, enabled: false };
    plugins.entries = entries;
    plugins.allow = parseOpenClawAgentPluginAllow();
    next.plugins = plugins;
    const tools = isJsonRecord(next.tools) ? next.tools : {};
    const execConfig = isJsonRecord(tools.exec) ? tools.exec : {};
    tools.exec = {
      ...execConfig,
      ask: "off",
      security: "full",
      strictInlineEval: false,
    };
    next.tools = tools;
    if (options.agentId && options.workspaceDir && path.isAbsolute(options.workspaceDir)) {
      const agents = isJsonRecord(next.agents) ? next.agents : {};
      const list = Array.isArray(agents.list) ? agents.list : [];
      agents.list = list.map((entry) => {
        if (!isJsonRecord(entry) || entry.id !== options.agentId) return entry;
        return { ...entry, workspace: options.workspaceDir };
      });
      next.agents = agents;
    }

    const targetDir = path.join(os.homedir(), ".openclaw", "setfarm", "openclaw-runtime", sessionId);
    const targetConfigPath = path.join(targetDir, "openclaw.json");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetConfigPath, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
    return targetConfigPath;
  } catch (err) {
    console.warn(`[spawner] failed to prepare isolated OpenClaw config for ${sessionId}: ${String(err).slice(0, 220)}`);
    return undefined;
  }
}

function resolveHostPlaywrightBrowsersPath(): string | undefined {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH?.trim()) return process.env.PLAYWRIGHT_BROWSERS_PATH.trim();
  const candidates = [
    path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function buildAgentChildEnv(pathPrefix?: string, options: { runtime?: AgentRuntime; sessionId?: string; agentId?: string; openClawWorkspaceDir?: string } = {}): NodeJS.ProcessEnv {
  const e = buildOpenClawChildEnv(pathPrefix);
  const playwrightBrowsersPath = resolveHostPlaywrightBrowsersPath();
  if (playwrightBrowsersPath) e.PLAYWRIGHT_BROWSERS_PATH = playwrightBrowsersPath;
  if (AGENT_RUNTIME === "codex") {
    e.CODEX_HOME = e.CODEX_HOME || path.join(os.homedir(), ".codex");
  }
  if ((options.runtime || AGENT_RUNTIME) === "kimi" && options.sessionId) {
    const kimiHome = prepareKimiIsolatedHome(options.sessionId);
    e.HOME = kimiHome;
    e.KIMI_HOME = path.join(kimiHome, ".kimi");
    e.XDG_CONFIG_HOME = path.join(kimiHome, ".config");
    e.XDG_CACHE_HOME = path.join(kimiHome, ".cache");
    e.XDG_STATE_HOME = path.join(kimiHome, ".local", "state");
  }
  if ((options.runtime || AGENT_RUNTIME) === "openclaw" && options.sessionId) {
    const isolatedConfigPath = prepareOpenClawIsolatedConfig(options.sessionId, {
      agentId: options.agentId,
      workspaceDir: options.openClawWorkspaceDir,
    });
    if (isolatedConfigPath) e.OPENCLAW_CONFIG_PATH = isolatedConfigPath;
  }
  return e;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolveGitBinary(): string {
  try {
    const out = execFileSync("bash", ["-lc", "command -v git"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {}
  return "/usr/bin/git";
}

function resolveNpmBinary(): string {
  try {
    const out = execFileSync("bash", ["-lc", "command -v npm"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {}
  return "/usr/bin/npm";
}

function installImplementGitWrapper(workdir: string, transcriptPath: string): string | undefined {
  if (!workdir) return undefined;
  try {
    const wrapperDir = path.join(workdir, ".setfarm-bin");
    fs.mkdirSync(wrapperDir, { recursive: true });
    const wrapperPath = path.join(wrapperDir, "git");
    const realGit = resolveGitBinary();
    const script = `#!/usr/bin/env bash
REAL_GIT=${shellQuote(realGit)}
cmd="$1"

blocked() {
  echo "SETFARM_GIT_WRAPPER: $1" >&2
  echo "Developer agents do not stage, commit, push, or open PRs." >&2
  echo "Setfarm commits the allowed .story-scope-files entries after build/scope/supervisor gates pass." >&2
  echo "Use git diff/status only, then report STATUS: done." >&2
  exit 2
}

if [ "$cmd" = "add" ]; then
  blocked "blocked agent staging: git $*"
fi

if [ "$cmd" = "commit" ]; then
  prev=""
  for arg in "$@"; do
    case "$arg" in
      -a|--all|--amend)
        blocked "blocked unsafe commit flag: git $*"
        ;;
      --message=*)
        msg="\${arg#--message=}"
        if [[ "$msg" =~ [Ww][Ii][Pp] ]]; then blocked "blocked WIP commit message: $msg"; fi
        ;;
      *)
        if [ "$prev" = "-m" ] || [ "$prev" = "--message" ]; then
          if [[ "$arg" =~ [Ww][Ii][Pp] ]]; then blocked "blocked WIP commit message: $arg"; fi
        fi
        ;;
    esac
    prev="$arg"
  done
  blocked "blocked agent commit: git $*"
fi

if [ "$cmd" = "push" ]; then
  blocked "blocked agent push: git $*"
fi

if [ "$cmd" = "checkout" ]; then
  blocked "blocked agent checkout: git $*"
fi

if [ "$cmd" = "switch" ]; then
  blocked "blocked agent switch: git $*"
fi

if [ "$cmd" = "branch" ]; then
  for arg in "$@"; do
    case "$arg" in
      -m|-M|-d|-D|--move|--delete)
        blocked "blocked agent branch mutation: git $*"
        ;;
    esac
  done
fi

exec "$REAL_GIT" "$@"
`;
    fs.writeFileSync(wrapperPath, script, { mode: 0o755 });

    const npmWrapperPath = path.join(wrapperDir, "npm");
    const realNpm = resolveNpmBinary();
    const npmScript = `#!/usr/bin/env bash
REAL_NPM=${shellQuote(realNpm)}
cmd="$1"

package_scope_allowed() {
  [ -f ".story-scope-files" ] || return 1
  grep -Eq '(^|[,[:space:]])(package\\.json|package-lock\\.json|pnpm-lock\\.yaml|yarn\\.lock)([,[:space:]]|$)' .story-scope-files
}

blocked() {
  echo "SETFARM_NPM_WRAPPER: $1" >&2
  echo "Developer agents must not change package.json or lockfiles during IMPLEMENT unless those files are in SCOPE_FILES." >&2
  echo "Use existing stack-pack dependencies and BUILD_CMD/TEST_CMD. If a new dependency is truly required, report a setup-build/stack-pack dependency blocker instead of running npm install." >&2
  exit 2
}

masked_check_blocked() {
  echo "SETFARM_NPM_WRAPPER_MASKED_CHECK: $1" >&2
  echo "Run the declared CHECK_BUILD_CMD/CHECK_TEST_CMD exactly as its own command." >&2
  echo "Do not append pipes, 2>&1, head, tail, grep, rg, tee, cat, awk, sed, or wrappers to build/test checks." >&2
  exit 2
}

if [ "$cmd" = "run" ]; then
  script_name="\${2:-}"
  case "$script_name" in
    build|test|test:run|typecheck|lint)
      parent_cmd="$(ps -o command= -p "$PPID" 2>/dev/null || true)"
      if [[ "$parent_cmd" =~ [\|] ]] && [[ "$parent_cmd" =~ (head|tail|grep|rg|tee|cat|awk|sed) ]]; then
        masked_check_blocked "blocked masked check pipeline from parent shell: npm $*"
      fi
      ;;
  esac
fi

case "$cmd" in
  install|i|add|remove|rm|uninstall|update|upgrade)
    if ! package_scope_allowed; then
      blocked "blocked package/dependency mutation: npm $*"
    fi
    ;;
esac

exec "$REAL_NPM" "$@"
`;
    fs.writeFileSync(npmWrapperPath, npmScript, { mode: 0o755 });
    try { fs.appendFileSync(transcriptPath, `[spawner] installed implement wrappers at ${wrapperDir} (git,npm)\n`); } catch {}
    return wrapperDir;
  } catch (err) {
    try { fs.appendFileSync(transcriptPath, `[spawner] failed to install implement wrappers: ${String(err).slice(0, 180)}\n`); } catch {}
    return undefined;
  }
}

function buildSessionKey(agentId: string, sessionId: string): string {
  return `agent:${agentId}:explicit:${sessionId}`;
}

function resolveAgentId(wfId: string, role: string, mapping: Record<string, string | string[]>): string[] {
  // cuddly-sleeping-quail: respect agent_mapping the same way agent-cron does.
  // Previously this fell back to `${wfId}_${role}` for single-string mappings,
  // which is NOT a registered gateway agent ID — gateway agents are named in
  // openclaw config (main, mert, atlas, koda, ...). The fallback caused two
  // concurrent processes to claim the same step (cron used the mapped name,
  // spawner used the bogus fallback) and write competing /tmp output files.
  // Run #379 plan retry 0/1 hit this race; only retry 2 caught the cron output.
  const m = mapping[role];
  if (Array.isArray(m)) return m;
  if (typeof m === "string" && m.length > 0) return [m];
  return [`${wfId}_${role}`];
}

function compactExitReason(err: unknown): string {
  return String((err as any)?.message || err || "unknown error").replace(/\s+/g, " ").slice(0, 700);
}

function isCleanZeroExit(err: unknown): boolean {
  return /code\s*=?\s*0|exited with code 0/i.test(compactExitReason(err));
}

function killProcessTree(pid: number | undefined, signal: NodeJS.Signals = "SIGTERM"): void {
  if (!pid) return;
  try {
    const out = execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    for (const childPid of out.split(/\s+/).filter(Boolean)) {
      killProcessTree(Number(childPid), signal);
    }
  } catch {
    // no children or pgrep unavailable
  }
  try { process.kill(pid, signal); } catch { /* already dead */ }
}

function isSpawnerDetachedToolCommand(command: string): boolean {
  return (
    /\b(?:npm|pnpm|yarn|bun)\s+run\s+(?:dev|preview|start)\b/.test(command) ||
    /\b(?:vite|next)\b[\s\S]{0,160}\b(?:dev|preview|start)\b/.test(command) ||
    /\bserve\b[\s\S]{0,160}\bdist\b/.test(command) ||
    /\bchromium_headless_shell\b[\s\S]*\bplaywright_chromiumdev_profile-/.test(command)
  );
}

function commandStoryWorktreeRoots(command: string): string[] {
  const roots = new Set<string>();
  for (const match of command.matchAll(/\/[^\s"'`]+\/story-worktrees\/[A-Za-z0-9._-]+/g)) {
    roots.add(path.resolve(match[0]));
  }
  return [...roots];
}

function cleanupSpawnerDetachedToolChildren(context: string): void {
  let out = "";
  try {
    out = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
  } catch {
    return;
  }

  const trackedProcesses = [...activeProcesses.values(), ...drainingProcesses.values()];
  const activePids = new Set(trackedProcesses.map((active) => active.child.pid).filter((pid): pid is number => Number.isFinite(pid)));
  const activeWorktrees = trackedProcesses
    .map((active) => active.spawnCwd ? path.resolve(active.spawnCwd) : "")
    .filter(Boolean);
  const targets: number[] = [];
  for (const line of out.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\s\S]+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const ppid = Number(match[2]);
    const command = match[3] || "";
    if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue;
    if (pid === process.pid || activePids.has(pid)) continue;
    const isDirectDetachedTool = ppid === process.pid && isSpawnerDetachedToolCommand(command);
    const worktreeRoots = commandStoryWorktreeRoots(command);
    const isInactiveStoryWorktreeTool = worktreeRoots.length > 0 && !worktreeRoots.some((root) =>
      activeWorktrees.some((activeRoot) => root === activeRoot || root.startsWith(`${activeRoot}${path.sep}`)),
    );
    if (!isDirectDetachedTool && !isInactiveStoryWorktreeTool) continue;
    targets.push(pid);
  }

  for (const pid of targets) killProcessTree(pid, "SIGTERM");
  if (targets.length > 0) {
    setTimeout(() => {
      for (const pid of targets) killProcessTree(pid, "SIGKILL");
    }, 2000);
    console.warn(`[spawner] ${context}: reaped ${targets.length} detached tool child process(es)`);
  }
}

function childProcessTerminalReason(child: ChildProcess): string | null {
  if (child.exitCode !== null) return `exitCode=${child.exitCode}`;
  if (child.signalCode !== null) return `signal=${child.signalCode}`;
  if (!child.pid) return "missing pid";
  try {
    const stat = execFileSync("ps", ["-o", "stat=", "-p", String(child.pid)], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    }).trim();
    if (!stat) return "pid not found";
    if (stat.startsWith("Z")) return `zombie stat=${stat}`;
  } catch {
    return "pid not found";
  }
  return null;
}

function parseOpenClawTaskList(stdout: string): OpenClawTaskRecord[] {
  const parsed = JSON.parse(stdout || "{}") as { tasks?: OpenClawTaskRecord[] } | OpenClawTaskRecord[];
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed.tasks) ? parsed.tasks : [];
}

function taskBelongsToLookup(task: OpenClawTaskRecord, lookup: string): boolean {
  return task.requesterSessionKey === lookup || task.ownerKey === lookup || task.childSessionKey === lookup;
}

function taskSessionKeys(task: OpenClawTaskRecord): string[] {
  return [task.requesterSessionKey, task.ownerKey, task.childSessionKey]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function isSetfarmSpawnerSessionKey(sessionKey: string): boolean {
  return /^agent:[^:]+:explicit:spawner-/.test(sessionKey);
}

function isTaskForActiveProcess(task: OpenClawTaskRecord): boolean {
  const keys = taskSessionKeys(task);
  for (const active of [...activeProcesses.values(), ...drainingProcesses.values()]) {
    if (keys.includes(active.sessionKey)) return true;
  }
  return false;
}

function sqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function activeSessionKeyExclusionSql(): string {
  const activeKeys = [...activeProcesses.values(), ...drainingProcesses.values()].map((active) => active.sessionKey).filter(Boolean);
  if (activeKeys.length === 0) return "";
  const values = activeKeys.map(sqliteString).join(", ");
  return [
    "AND NOT (",
    `COALESCE(requester_session_key, '') IN (${values})`,
    `OR COALESCE(owner_key, '') IN (${values})`,
    `OR COALESCE(child_session_key, '') IN (${values})`,
    ")",
  ].join(" ");
}

function activeSessionKeys(): Set<string> {
  return new Set([...activeProcesses.values(), ...drainingProcesses.values()].map((active) => active.sessionKey).filter(Boolean));
}

function cleanupOpenClawSessionLockSync(agentDir: string, record: OpenClawSessionIndexRecord): boolean {
  const candidates = new Set<string>();
  if (record.sessionFile) candidates.add(`${record.sessionFile}.lock`);
  if (record.sessionId) candidates.add(path.join(OPENCLAW_AGENTS_ROOT, agentDir, "sessions", `${record.sessionId}.jsonl.lock`));

  let removed = false;
  for (const lockPath of candidates) {
    try {
      fs.unlinkSync(lockPath);
      removed = true;
    } catch {}
  }
  return removed;
}

function cleanupStaleSetfarmOpenClawSessionRecordsSync(context: string): number {
  const activeKeys = activeSessionKeys();
  const now = Date.now();
  let changed = 0;
  let locksRemoved = 0;

  let agentDirs: string[] = [];
  try {
    agentDirs = fs.readdirSync(OPENCLAW_AGENTS_ROOT);
  } catch {
    return 0;
  }

  for (const agentDir of agentDirs) {
    const sessionsPath = path.join(OPENCLAW_AGENTS_ROOT, agentDir, "sessions", "sessions.json");
    let parsed: Record<string, OpenClawSessionIndexRecord>;
    try {
      parsed = JSON.parse(fs.readFileSync(sessionsPath, "utf-8")) as Record<string, OpenClawSessionIndexRecord>;
    } catch {
      continue;
    }

    let fileChanged = false;
    for (const [sessionKey, record] of Object.entries(parsed)) {
      if (!isSetfarmSpawnerSessionKey(sessionKey)) continue;
      if (activeKeys.has(sessionKey)) continue;
      if (cleanupOpenClawSessionLockSync(agentDir, record)) locksRemoved += 1;
      if (record?.status !== "running") continue;
      record.status = "timeout";
      record.abortedLastRun = true;
      record.updatedAt = now;
      fileChanged = true;
      changed += 1;
    }

    if (fileChanged) {
      try {
        fs.writeFileSync(sessionsPath, JSON.stringify(parsed, null, 2) + "\n");
      } catch (err) {
        console.warn(`[spawner] stale OpenClaw session sweep failed for ${sessionsPath} (${context}): ${compactExitReason(err)}`);
      }
    }
  }

  if (changed > 0) {
    console.warn(`[spawner] OpenClaw stale session sweep marked ${changed} session record(s) timeout (${context})`);
  }
  if (locksRemoved > 0) {
    console.warn(`[spawner] OpenClaw stale session sweep removed ${locksRemoved} transcript lock(s) (${context})`);
  }
  return changed;
}

function markStaleSetfarmOpenClawTaskRecordsCancelledSync(context: string): number {
  const now = Date.now();
  const message = `Cancelled by Setfarm spawner stale sweep (${context}).`;
  const sql = [
    "UPDATE task_runs",
    `SET status = 'cancelled', ended_at = ${now}, last_event_at = ${now}, error = ${sqliteString(message)}`,
    "WHERE runtime = 'cli'",
    "AND status = 'running'",
    "AND (",
    "requester_session_key GLOB 'agent:*:explicit:spawner-*'",
    "OR owner_key GLOB 'agent:*:explicit:spawner-*'",
    "OR child_session_key GLOB 'agent:*:explicit:spawner-*'",
    ")",
    activeSessionKeyExclusionSql(),
    ";",
    "SELECT changes();",
  ].join(" ");
  try {
    const stdout = execFileSync("sqlite3", [OPENCLAW_TASKS_DB, sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    const changed = parseInt(String(stdout || "").trim().split(/\s+/).pop() || "0", 10);
    if (changed > 0) {
      console.warn(`[spawner] OpenClaw stale task sweep marked ${changed} task record(s) cancelled (${context})`);
    }
    return Number.isFinite(changed) ? changed : 0;
  } catch (err) {
    console.warn(`[spawner] OpenClaw stale task sweep failed (${context}): ${compactExitReason(err)}`);
    return 0;
  }
}

function markOpenClawTaskRecordCancelled(taskId: string, lookup: string, context: string): void {
  const now = Date.now();
  const message = "Cancelled by Setfarm spawner after OpenClaw runtime cancel left CLI task running.";
  const sql = [
    "UPDATE task_runs",
    `SET status = 'cancelled', ended_at = ${now}, last_event_at = ${now}, error = ${sqliteString(message)}`,
    `WHERE task_id = ${sqliteString(taskId)}`,
    "AND runtime = 'cli'",
    "AND status = 'running'",
    `AND (requester_session_key = ${sqliteString(lookup)} OR owner_key = ${sqliteString(lookup)} OR child_session_key = ${sqliteString(lookup)});`,
    "SELECT changes();",
  ].join(" ");
  execFile("sqlite3", [OPENCLAW_TASKS_DB, sql], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw registry fallback failed for ${taskId} from ${lookup} (${context}): ${msg}`);
      return;
    }
    const changed = parseInt(String(stdout || "").trim().split(/\s+/).pop() || "0", 10);
    if (changed > 0) {
      console.warn(`[spawner] OpenClaw registry fallback marked ${taskId} cancelled for ${lookup} (${context})`);
    } else {
      console.warn(`[spawner] OpenClaw registry fallback no-op for ${taskId} from ${lookup} (${context})`);
    }
  });
}

function markOpenClawTaskRecordsCancelledForLookup(lookup: string, context: string): void {
  if (!lookup) return;
  const now = Date.now();
  const message = "Cancelled by Setfarm spawner after OpenClaw runtime cancel reported success but registry stayed running.";
  const sql = [
    "UPDATE task_runs",
    `SET status = 'cancelled', ended_at = ${now}, last_event_at = ${now}, error = ${sqliteString(message)}`,
    "WHERE runtime = 'cli'",
    "AND status = 'running'",
    "AND (",
    `requester_session_key = ${sqliteString(lookup)}`,
    `OR owner_key = ${sqliteString(lookup)}`,
    `OR child_session_key = ${sqliteString(lookup)}`,
    ");",
    "SELECT changes();",
  ].join(" ");
  execFile("sqlite3", [OPENCLAW_TASKS_DB, sql], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw registry lookup fallback failed for ${lookup} (${context}): ${msg}`);
      return;
    }
    const changed = parseInt(String(stdout || "").trim().split(/\s+/).pop() || "0", 10);
    if (changed > 0) {
      console.warn(`[spawner] OpenClaw registry lookup fallback marked ${changed} task record(s) cancelled for ${lookup} (${context})`);
    }
  });
}

function openClawTaskIdsForLookupSync(lookup: string): string[] {
  if (!lookup || !fs.existsSync(OPENCLAW_TASKS_DB)) return [];
  const sql = [
    "SELECT task_id FROM task_runs",
    "WHERE runtime = 'cli'",
    "AND status = 'running'",
    "AND (",
    `requester_session_key = ${sqliteString(lookup)}`,
    `OR owner_key = ${sqliteString(lookup)}`,
    `OR child_session_key = ${sqliteString(lookup)}`,
    ");",
  ].join(" ");
  try {
    const stdout = execFileSync("sqlite3", [OPENCLAW_TASKS_DB, sql], {
      encoding: "utf-8",
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (err) {
    console.warn(`[spawner] OpenClaw registry lookup failed for ${lookup}: ${compactExitReason(err)}`);
    return [];
  }
}

function markOpenClawTaskRecordsCancelledForLookupSync(lookup: string, context: string): number {
  if (!lookup || !fs.existsSync(OPENCLAW_TASKS_DB)) return 0;
  const now = Date.now();
  const message = "Cancelled by Setfarm spawner before retrying guarded claim.";
  const sql = [
    "UPDATE task_runs",
    `SET status = 'cancelled', ended_at = ${now}, last_event_at = ${now}, error = ${sqliteString(message)}`,
    "WHERE runtime = 'cli'",
    "AND status = 'running'",
    "AND (",
    `requester_session_key = ${sqliteString(lookup)}`,
    `OR owner_key = ${sqliteString(lookup)}`,
    `OR child_session_key = ${sqliteString(lookup)}`,
    ");",
    "SELECT changes();",
  ].join(" ");
  try {
    const stdout = execFileSync("sqlite3", [OPENCLAW_TASKS_DB, sql], {
      encoding: "utf-8",
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    const changed = parseInt(String(stdout || "").trim().split(/\s+/).pop() || "0", 10);
    if (changed > 0) {
      console.warn(`[spawner] OpenClaw registry sync fallback marked ${changed} task record(s) cancelled for ${lookup} (${context})`);
    }
    return Number.isFinite(changed) ? changed : 0;
  } catch (err) {
    console.warn(`[spawner] OpenClaw registry sync fallback failed for ${lookup} (${context}): ${compactExitReason(err)}`);
    return 0;
  }
}

function forceCancelOpenClawLookupSync(lookup: string, context: string): void {
  if (!lookup || AGENT_RUNTIME !== "openclaw") return;
  const taskIds = openClawTaskIdsForLookupSync(lookup);
  const targets = uniqueStrings([lookup, ...taskIds]);
  for (const target of targets) {
    try {
      execFileSync(OPENCLAW_CLI, ["tasks", "cancel", target], {
        cwd: AGENT_SAFE_CWD,
        timeout: 20_000,
        env: buildOpenClawChildEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch (err) {
      console.warn(`[spawner] OpenClaw sync cancel failed for ${target} from ${lookup} (${context}): ${compactExitReason(err)}`);
    }
  }
  markOpenClawTaskRecordsCancelledForLookupSync(lookup, context);
}

function restartOpenClawGatewayAfterGuardSync(context: string): void {
  if (AGENT_RUNTIME !== "openclaw") return;
  if (activeProcesses.size > 0 || drainingProcesses.size > 0) {
    console.warn(`[spawner] OpenClaw guard gateway restart skipped; active=${activeProcesses.size} draining=${drainingProcesses.size} (${context})`);
    return;
  }
  const nowMs = Date.now();
  if (nowMs - lastGuardGatewayRestartMs < 15_000) return;
  lastGuardGatewayRestartMs = nowMs;
  try {
    execFileSync(OPENCLAW_CLI, ["gateway", "restart"], {
      cwd: AGENT_SAFE_CWD,
      timeout: 25_000,
      env: buildOpenClawChildEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 2 * 1024 * 1024,
    });
    gatewayNotReadySinceMs = null;
    console.warn(`[spawner] restarted OpenClaw gateway after runtime guard (${context})`);
  } catch (err) {
    console.warn(`[spawner] OpenClaw guard gateway restart failed (${context}): ${compactExitReason(err)}`);
  }
}

function cancelOpenClawTaskId(taskId: string, context: string, originalLookup: string): void {
  execFile(OPENCLAW_CLI, ["tasks", "cancel", taskId], {
    cwd: AGENT_SAFE_CWD,
    timeout: 20_000,
    env: buildOpenClawChildEnv(),
    maxBuffer: 2 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw lingering taskId cancel failed for ${taskId} from ${originalLookup} (${context}): ${msg}`);
      setTimeout(() => markOpenClawTaskRecordCancelled(taskId, originalLookup, context), OPENCLAW_TASK_REGISTRY_SETTLE_MS);
      return;
    }
    console.log(`[spawner] OpenClaw lingering taskId cancelled for ${taskId} from ${originalLookup} (${context})`);
    setTimeout(() => markOpenClawTaskRecordCancelled(taskId, originalLookup, context), OPENCLAW_TASK_REGISTRY_SETTLE_MS);
  });
}

function cancelLingeringOpenClawTasksForLookup(lookup: string, context: string): void {
  if (!lookup) return;
  execFile(OPENCLAW_CLI, ["tasks", "list", "--status", "running", "--runtime", "cli", "--json"], {
    cwd: AGENT_SAFE_CWD,
    timeout: 20_000,
    env: buildOpenClawChildEnv(),
    maxBuffer: 4 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw lingering task list failed for ${lookup} (${context}): ${msg}`);
      return;
    }

    let tasks: OpenClawTaskRecord[];
    try {
      tasks = parseOpenClawTaskList(stdout);
    } catch (parseErr) {
      console.warn(`[spawner] OpenClaw lingering task list parse failed for ${lookup} (${context}): ${compactExitReason(parseErr)}`);
      return;
    }

    const seen = new Set<string>();
    for (const task of tasks) {
      const taskId = task.taskId?.trim();
      if (!taskId || taskId === lookup || seen.has(taskId)) continue;
      if (task.status && task.status !== "running") continue;
      if (task.runtime && task.runtime !== "cli") continue;
      if (!taskBelongsToLookup(task, lookup)) continue;
      seen.add(taskId);
      cancelOpenClawTaskId(taskId, context, lookup);
    }
  });
}

function cleanupStaleSetfarmOpenClawTaskRecords(context: string): OpenClawCleanupResult {
  const sessions = cleanupStaleSetfarmOpenClawSessionRecordsSync(context);
  const tasks = markStaleSetfarmOpenClawTaskRecordsCancelledSync(context);
  return { sessions, tasks };
}

async function restartGatewayAfterOpenClawCleanup(context: string, result: OpenClawCleanupResult): Promise<boolean> {
  const changed = result.sessions + result.tasks;
  if (changed === 0) return false;
  if (gatewayRestartInFlight) return false;
  if (activeProcesses.size > 0 || drainingProcesses.size > 0) {
    console.warn(`[spawner] gateway restart after stale OpenClaw cleanup deferred; ${activeProcesses.size} active and ${drainingProcesses.size} draining process(es) (${context})`);
    return false;
  }
  const nowMs = Date.now();
  if (nowMs - lastGatewayCleanupRestartMs < GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS) return false;

  const restartCommand = process.platform === "linux"
    ? { command: "systemctl", args: ["--user", "restart", "openclaw-gateway"], env: process.env, label: "openclaw-gateway" }
    : process.platform === "darwin"
      ? { command: OPENCLAW_CLI, args: ["gateway", "restart"], env: buildOpenClawChildEnv(), label: "openclaw gateway" }
      : null;
  if (!restartCommand) {
    lastGatewayCleanupRestartMs = nowMs;
    console.warn(`[spawner] gateway restart after stale OpenClaw cleanup skipped on ${process.platform} (${context}): sessions=${result.sessions} tasks=${result.tasks}`);
    return false;
  }

  gatewayRestartInFlight = true;
  lastGatewayCleanupRestartMs = nowMs;
  console.warn(`[spawner] restarting ${restartCommand.label} after stale OpenClaw cleanup (${context}): sessions=${result.sessions} tasks=${result.tasks}`);
  const restarted = await new Promise<boolean>((resolve) => {
    execFile(restartCommand.command, restartCommand.args, {
      cwd: AGENT_SAFE_CWD,
      timeout: 20_000,
      env: restartCommand.env,
      maxBuffer: 2 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) {
        const msg = compactExitReason(stderr || stdout || (err as any).message || err);
        console.warn(`[spawner] gateway stale-cleanup restart failed: ${msg}`);
        resolve(false);
        return;
      }
      gatewayNotReadySinceMs = null;
      console.log("[spawner] gateway stale-cleanup restart completed");
      resolve(true);
    });
  });
  gatewayRestartInFlight = false;
  if (restarted) cleanupStaleSetfarmOpenClawTaskRecords(`${context}-post-gateway-restart`);
  return restarted;
}

function cancelOpenClawTask(lookup: string, context: string): void {
  if (!lookup) return;
  execFile(OPENCLAW_CLI, ["tasks", "cancel", lookup], {
    cwd: AGENT_SAFE_CWD,
    timeout: 20_000,
    env: buildOpenClawChildEnv(),
    maxBuffer: 2 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw task cancel failed for ${lookup} (${context}): ${msg}`);
      cancelLingeringOpenClawTasksForLookup(lookup, context);
      setTimeout(() => markOpenClawTaskRecordsCancelledForLookup(lookup, context), OPENCLAW_TASK_REGISTRY_SETTLE_MS);
      return;
    }
    console.log(`[spawner] OpenClaw task cancelled for ${lookup} (${context})`);
    setTimeout(() => markOpenClawTaskRecordsCancelledForLookup(lookup, context), OPENCLAW_TASK_REGISTRY_SETTLE_MS);
    setTimeout(() => cancelLingeringOpenClawTasksForLookup(lookup, context), 1500);
  });
}

function cancelRuntimeTask(lookup: string, context: string): void {
  if (AGENT_RUNTIME !== "openclaw") return;
  cancelOpenClawTask(lookup, context);
}

function terminateActiveProcess(
  active: ActiveProcess,
  context: string,
  callerOwnsClaim = true,
): void {
  if (callerOwnsClaim) active.claimRecoveryOwned = true;
  active.runtimeDrainRequested = true;
  drainingProcesses.set(active.runtimeSessionId, active);
  // Stop the local process tree first. Cancelling task records or restarting
  // the gateway while this child is alive can trigger OpenClaw embedded
  // fallback against a workspace that Setfarm is about to clean.
  if (active.processIdentity) {
    signalProcessIfIdentityMatches(active.processIdentity, "SIGTERM", {
      signalProcess: (pid, signal) => killProcessTree(pid, signal),
    });
  }
  cancelRuntimeTask(active.sessionKey, context);
  setTimeout(() => {
    if (!active.processIdentity) return;
    signalProcessIfIdentityMatches(active.processIdentity, "SIGKILL", {
      signalProcess: (pid, signal) => killProcessTree(pid, signal),
    });
  }, 5000);
  setTimeout(() => cleanupSpawnerDetachedToolChildren(context), 1500);
  if (["qa-tester", "tester", "final-tester"].some((role) => active.role.includes(role) || active.agentId.includes(role))) {
    setTimeout(() => {
      void cleanupProjectEphemera(active.runId, `spawner-${context}-${active.role}`);
    }, 1500);
  }
}

function runtimeActivitySignature(active: ActiveProcess): string {
  return [active.sessionJsonlPath, active.transcriptPath].map((candidate) => {
    try {
      const stat = fs.statSync(candidate);
      return `${candidate}:${stat.size}:${Math.trunc(stat.mtimeMs)}`;
    } catch {
      return `${candidate}:missing`;
    }
  }).join("|");
}

function processReferencesRuntimePath(active: ActiveProcess): boolean {
  const paths = [active.spawnCwd, active.runtimeWorkspaceDir]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => path.resolve(candidate));
  if (paths.length === 0) return false;
  try {
    const output = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.split("\n").some((line) => {
      const match = line.trim().match(/^(\d+)\s+([\s\S]+)$/);
      if (!match || Number(match[1]) === process.pid) return false;
      return paths.some((candidate) => match[2]!.includes(candidate));
    });
  } catch {
    return true;
  }
}

async function waitForClaimRuntimeQuiescence(
  runId: string,
  storyId: string | undefined,
  claimAgentId: string,
  timeoutMs = 7_000,
): Promise<void> {
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  const matching = [...drainingProcesses.values()].filter((active) =>
    active.runId === runId
    && (active.storyId ?? null) === (storyId ?? null)
    && active.claimAgentId === claimAgentId
  );
  const durable = (await runtimeSessions.listRecoverable({ runId, limit: 500 })).filter((session) =>
    (session.storyId ?? undefined) === storyId
    && session.claimAgentId === claimAgentId
    && session.state !== "released"
  );
  const quarantined = durable.find((session) => session.state === "quarantined");
  if (quarantined) throw new Error(`RUNTIME_QUIESCENCE_QUARANTINED:${quarantined.sessionId}`);
  if (matching.length === 0) {
    if (durable.length === 0) {
      const openClaim = await pgGet<{ id: string }>(
        `SELECT id::text FROM claim_log
          WHERE run_id = $1 AND story_id IS NOT DISTINCT FROM $2
            AND agent_id = $3 AND outcome IS NULL
          LIMIT 1`,
        [runId, storyId ?? null, claimAgentId],
      );
      if (openClaim) throw new Error(`RUNTIME_QUIESCENCE_OWNER_MISSING:${openClaim.id}`);
      return;
    }
    for (const session of durable) {
      if (session.state === "drained") continue;
      const requested = await runtimeSessions.requestDrain({
        sessionId: session.sessionId,
        ownerInstanceId: session.ownerInstanceId,
        diagnostic: "Runtime quiescence requested without in-memory process owner",
      });
      await drainDurableRuntimeSession(requested, { requestId: `runtime-quiescence-${session.sessionId}` });
    }
    return;
  }
  for (const active of matching) {
    const session = await runtimeSessions.findById(active.runtimeSessionId);
    if (session && !["drain_requested", "drained", "released"].includes(session.state)) {
      await runtimeSessions.requestDrain({
        sessionId: active.runtimeSessionId,
        ownerInstanceId: active.runtimeOwnerInstanceId,
        diagnostic: "In-memory runtime quiescence requested",
      });
    }
  }
  const deadline = Date.now() + timeoutMs;
  let stableSignature = "";
  let stableSince = 0;
  const forceCancelled = new Set<string>();
  while (Date.now() < deadline) {
    let quiescent = true;
    const signatures: string[] = [];
    for (const active of matching) {
      const childAlive = childProcessTerminalReason(active.child) === null;
      if (childAlive) {
        quiescent = false;
        if (Date.now() + 1_500 >= deadline) killProcessTree(active.child.pid, "SIGKILL");
        continue;
      }
      if (!forceCancelled.has(active.sessionKey)) {
        forceCancelled.add(active.sessionKey);
        forceCancelOpenClawLookupSync(active.sessionKey, "runtime-quiescence");
      }
      if (openClawTaskIdsForLookupSync(active.sessionKey).length > 0) quiescent = false;
      if (processReferencesRuntimePath(active)) quiescent = false;
      signatures.push(runtimeActivitySignature(active));
    }
    const signature = signatures.join("||");
    if (quiescent) {
      if (signature !== stableSignature) {
        stableSignature = signature;
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= 500) {
        for (const active of matching) {
          const durableSession = await runtimeSessions.findById(active.runtimeSessionId);
          if (durableSession?.state === "drain_requested") {
            await runtimeSessions.markDrained({
              sessionId: active.runtimeSessionId,
              ownerInstanceId: active.runtimeOwnerInstanceId,
              evidence: {
                schema: "setfarm.runtime-drain-evidence.v1",
                observedAt: new Date().toISOString(),
                localProcessAbsent: true,
                openClawTaskAbsent: true,
                workspaceProcessAbsent: true,
                stableObservations: 2,
                evidenceRefs: [
                  `setfarm://runtime-session/${active.runtimeSessionId}`,
                  "setfarm://spawner/runtime-quiescence",
                ],
              },
            });
          }
          if (active.runtimeWorkspaceId) {
            removeAttemptRuntimeWorkspace({
              root: OPENCLAW_ATTEMPT_WORKSPACE_ROOT,
              runtimeId: active.runtimeWorkspaceId,
            });
          }
          const tracked = drainingProcesses.get(active.runtimeSessionId);
          if (tracked?.child === active.child) drainingProcesses.delete(active.runtimeSessionId);
        }
        restartOpenClawGatewayAfterGuardSync("runtime-quiescent");
        return;
      }
    } else {
      stableSignature = "";
      stableSince = 0;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  for (const active of matching) killProcessTree(active.child.pid, "SIGKILL");
  throw new Error(`RUNTIME_QUIESCENCE_TIMEOUT: ${runId}/${storyId || "single-step"}/${claimAgentId}`);
}

async function retrySingleStepClaimWithAuthority(input: Readonly<{
  runId: string;
  stepDbId: string;
  workflowStepId: string;
  claimAgentId: string;
  runtimeAgentId: string;
  diagnostic: string;
  envelope?: ClaimEnvelopeV1;
}>): Promise<void> {
  const envelope = input.envelope ?? await recoverClaimEnvelopeFromDatabase({
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    claimAgentId: input.claimAgentId,
    runtimeAgentId: input.runtimeAgentId,
  });
  if (!envelope) throw new Error("CLAIM_ORPHAN_RECOVERY_ENVELOPE_UNAVAILABLE");
  await failStep(
    input.stepDbId,
    `SETFARM_INFRA_RETRY:\n${input.diagnostic}`,
    envelope,
    { recoveryAuthority: "orphan_recovery" },
  );
  await pgRun("SELECT pg_notify('step_pending', $1)", [
    JSON.stringify({ agentId: input.claimAgentId, runId: input.runId, stepId: input.workflowStepId }),
  ]);
}

async function retryActiveSingleStepClaim(active: ActiveProcess, stepIdName: string, diagnostic: string): Promise<void> {
  await waitForClaimRuntimeQuiescence(active.runId, undefined, active.claimAgentId);
  await retrySingleStepClaimWithAuthority({
    runId: active.runId,
    stepDbId: active.stepId,
    workflowStepId: stepIdName,
    claimAgentId: active.claimAgentId,
    runtimeAgentId: active.agentId,
    diagnostic,
    envelope: activeClaimEnvelope(active),
  });
  if (active.claimId) await releaseReservedRuntimeForClaimIfPresent(active.claimId, diagnostic);
}

type V3RecoveryOwnerIdentity = Readonly<{
  runId?: string;
  storyId?: string;
  claimId?: number;
  claimAgentId?: string;
  attempt?: ClaimAttemptFenceV1;
  recoveryDispatchId?: string;
  recoveryRevisionId?: string;
  recoveryLeaseToken?: string;
  runtimeSessionId?: string;
  runtimeOwnerInstanceId?: string;
}>;

async function relinquishV3RecoveryOwner(
  owner: V3RecoveryOwnerIdentity,
  diagnostic: string,
): Promise<boolean> {
  if (!owner.recoveryDispatchId) return false;
  if (
    !owner.runId
    || !owner.storyId
    || !owner.claimId
    || !owner.claimAgentId
    || !owner.attempt
    || !owner.recoveryRevisionId
    || !owner.recoveryLeaseToken
    || !owner.runtimeSessionId
    || !owner.runtimeOwnerInstanceId
  ) {
    throw new Error(`V3_RECOVERY_RELINQUISH_IDENTITY_INCOMPLETE:${owner.recoveryDispatchId}`);
  }
  const result = await createV3RecoveryOwnerLeaseRepository(getSql()).relinquish({
    kind: "model_runtime",
    runId: owner.runId,
    storyId: owner.storyId,
    claimId: owner.claimId,
    claimAgentId: owner.claimAgentId,
    revisionId: owner.recoveryRevisionId,
    dispatchId: owner.recoveryDispatchId,
    ownerInstanceId: owner.runtimeOwnerInstanceId,
    leaseToken: owner.recoveryLeaseToken,
    attempt: owner.attempt,
    runtimeSessionId: owner.runtimeSessionId,
  });
  const reconcileExact = async (observedAt?: string): Promise<void> => {
    const reconciler = createV3RecoveryLifecycleReconciler(getSql());
    const first = await reconciler.reconcileActive({
      runId: owner.runId,
      dispatchId: owner.recoveryDispatchId,
      limit: 1,
    }, observedAt ? { now: new Date(observedAt) } : {});
    for (const event of first.events) {
      if (event.action !== "request_runtime_drain" || !event.runtimeSessionId) continue;
      const session = await createRuntimeSessionRepository(getSql()).findById(event.runtimeSessionId);
      if (!session || session.state !== "drain_requested") {
        throw new Error(`V3_RECOVERY_EXACT_DRAIN_STATE_INVALID:${owner.recoveryDispatchId}`);
      }
      try {
        await drainDurableRuntimeSession(session, {
          requestId: `v3-recovery-relinquish-${owner.recoveryDispatchId}`,
        });
      } catch (error) {
        console.warn(`[spawner] V3_RECOVERY_EXACT_DRAIN_FAILED:${owner.recoveryDispatchId}:${String(error).slice(0, 240)}`);
      }
    }
    const second = await reconciler.reconcileActive({
      runId: owner.runId,
      dispatchId: owner.recoveryDispatchId,
      limit: 1,
    }, observedAt ? { now: new Date(observedAt) } : {});
    const retained = await pgGet<{ state: string }>(
      `SELECT state FROM recovery_dispatch_deliveries
        WHERE dispatch_id = $1 AND revision_id = $2`,
      [owner.recoveryDispatchId, owner.recoveryRevisionId],
    );
    if (retained && ["authorized", "leased", "attempt_reserved", "running"].includes(retained.state)) {
      throw new Error(`V3_RECOVERY_RELINQUISH_NOT_RECONCILED:${owner.recoveryDispatchId}:${retained.state}`);
    }
  };
  if (result.status !== "relinquished") {
    console.warn(`[spawner] V3_RECOVERY_RELINQUISH_STALE:${owner.recoveryDispatchId}:${result.reason}:${diagnostic.slice(0, 160)}`);
    if (!["V3_RECOVERY_OWNER_COMPLETION_ACTIVE", "V3_RECOVERY_OWNER_TERMINATION_PENDING"].includes(result.reason)) {
      await reconcileExact();
    }
    return false;
  }
  console.warn(`[spawner] V3_RECOVERY_OWNER_RELINQUISHED:${owner.recoveryDispatchId}:${diagnostic.slice(0, 160)}`);
  await reconcileExact(result.relinquishedAt);
  return true;
}

async function releaseReservedRuntimeForClaimIfPresent(
  claimId: number,
  diagnostic: string,
): Promise<boolean> {
  const row = await pgGet<{
    session_id: string;
    owner_instance_id: string;
    state: string;
  }>(
    "SELECT session_id, owner_instance_id, state FROM runtime_sessions WHERE claim_id = $1 LIMIT 1",
    [claimId],
  );
  if (!row || row.state === "released") return false;
  if (row.state === "reserved") {
    await pgBegin((sql) => releaseReservedRuntimeSessionInTransaction(sql, {
      sessionId: row.session_id,
      claimId,
      ownerInstanceId: row.owner_instance_id,
      diagnostic,
    }));
  } else if (row.state === "drained") {
    await pgBegin((sql) => releaseDrainedRuntimeSessionInTransaction(sql, {
      sessionId: row.session_id,
      claimId,
      ownerInstanceId: row.owner_instance_id,
    }));
  } else {
    return false;
  }
  return true;
}

async function retryPreSpawnSingleStepClaim(
  runId: string,
  stepDbId: string,
  stepIdName: string,
  agentId: string,
  claimId: number,
  diagnostic: string,
): Promise<void> {
  await retrySingleStepClaimWithAuthority({
    runId,
    stepDbId,
    workflowStepId: stepIdName,
    claimAgentId: agentId,
    runtimeAgentId: agentId,
    diagnostic,
  });
  await releaseReservedRuntimeForClaimIfPresent(claimId, diagnostic);
}

async function stepNameForDbId(stepDbId: string): Promise<string> {
  if (!stepDbId) return "";
  const row = await pgGet<{ step_id: string }>("SELECT step_id FROM steps WHERE id = $1 LIMIT 1", [stepDbId]);
  return row?.step_id || "";
}

async function releasePreSpawnClaim(
  claim: Awaited<ReturnType<typeof claimStep>>,
  runtimeAgentId: string,
  diagnostic: string,
): Promise<boolean> {
  if (
    !claim.found
    || !claim.runId
    || !claim.stepId
    || !claim.workflowStepId
    || !claim.claimId
    || !claim.claimAgentId
  ) return false;
  if (claim.recoveryDispatchId && claim.storyId && claim.storyDbId) {
    return relinquishV3RecoveryOwner(claim, `V3_RECOVERY_PRESPAWN_HANDOFF_FAILED: ${diagnostic}`);
  }
  if (claim.storyId) {
    return requeueOpenStoryClaim(
      claim.runId,
      claim.workflowStepId,
      claim.storyId,
      claim.claimAgentId,
      diagnostic,
      runtimeAgentId,
    );
  }
  await retryPreSpawnSingleStepClaim(
    claim.runId,
    claim.stepId,
    claim.workflowStepId,
    claim.claimAgentId,
    claim.claimId,
    diagnostic,
  );
  return true;
}

export async function releaseUntransferredPostClaimOwnership(
  claim: Awaited<ReturnType<typeof claimStep>>,
  runtimeAgentId: string,
  diagnostic: string,
): Promise<Readonly<{
  status: "settled" | "handed_off_completion" | "handed_off_termination";
}>> {
  if (
    !claim.found
    || !claim.runId
    || !claim.stepId
    || !claim.workflowStepId
    || !claim.claimId
    || !claim.claimAgentId
    || !claim.runtimeSessionId
    || !claim.runtimeOwnerInstanceId
  ) throw new Error("POST_CLAIM_OWNERSHIP_IDENTITY_INCOMPLETE");
  type OwnershipSnapshot = Readonly<{
    claim_outcome: string | null;
    runtime_state: string | null;
    active_attempt_count: number;
    active_delivery_count: number;
    active_completion_count: number;
    quarantined_completion_count: number;
    active_termination_count: number;
  }>;
  const loadExact = () => pgGet<OwnershipSnapshot>(
    `SELECT claim.outcome AS claim_outcome,
            (
              SELECT runtime.state
                FROM runtime_sessions runtime
               WHERE runtime.session_id = $6
                 AND runtime.claim_id = claim.id
                 AND runtime.owner_instance_id = $7
               LIMIT 1
            ) AS runtime_state,
            (
              SELECT COUNT(*)::integer
                FROM execution_attempts attempt
               WHERE attempt.claim_id = claim.id
                 AND attempt.disposition IN ('claimed', 'running')
            ) AS active_attempt_count,
            (
              SELECT COUNT(*)::integer
                FROM recovery_dispatch_deliveries delivery
               WHERE delivery.claim_id = claim.id
                 AND delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
            ) AS active_delivery_count,
            (
              SELECT COUNT(*)::integer
                FROM runtime_completion_requests completion
               WHERE completion.claim_id = claim.id
                 AND completion.runtime_session_id = $6
                 AND completion.state IN ('requested', 'draining', 'processing')
            ) AS active_completion_count,
            (
              SELECT COUNT(*)::integer
                FROM runtime_completion_requests completion
               WHERE completion.claim_id = claim.id
                 AND completion.runtime_session_id = $6
                 AND completion.state = 'quarantined'
            ) AS quarantined_completion_count,
            (
              SELECT COUNT(*)::integer
                FROM run_termination_requests termination
               WHERE termination.run_id = claim.run_id
                 AND termination.state <> 'terminalized'
            ) AS active_termination_count
       FROM claim_log claim
      WHERE claim.id = $1
        AND claim.run_id = $2
        AND claim.step_id = $3
        AND claim.story_id IS NOT DISTINCT FROM $4::text
        AND claim.agent_id = $5
      LIMIT 1`,
    [
      claim.claimId,
      claim.runId,
      claim.workflowStepId,
      claim.storyId ?? null,
      claim.claimAgentId,
      claim.runtimeSessionId,
      claim.runtimeOwnerInstanceId,
    ],
  );

  let snapshot = await loadExact();
  if (!snapshot || !snapshot.runtime_state) {
    throw new Error(`POST_CLAIM_EXACT_OWNERSHIP_MISSING:${claim.claimId}:${claim.runtimeSessionId}`);
  }
  const canonicalHandoff = (current: OwnershipSnapshot) => {
    if (current.quarantined_completion_count > 0) {
      throw new Error(`POST_CLAIM_COMPLETION_QUARANTINED:${claim.claimId}`);
    }
    if (current.active_completion_count > 0 && current.active_termination_count > 0) {
      throw new Error(`POST_CLAIM_DURABLE_OWNER_AMBIGUOUS:${claim.claimId}`);
    }
    if (
      current.active_completion_count === 1
      && ["drain_requested", "drained"].includes(current.runtime_state ?? "")
    ) return { status: "handed_off_completion" as const };
    if (
      current.active_termination_count === 1
      && ["drain_requested", "drained"].includes(current.runtime_state ?? "")
    ) return { status: "handed_off_termination" as const };
    return undefined;
  };
  const initialHandoff = canonicalHandoff(snapshot);
  if (initialHandoff) return initialHandoff;
  const sessions = createRuntimeSessionRepository(getSql());
  if (["starting", "running", "drain_requested"].includes(snapshot.runtime_state)) {
    const current = await sessions.findById(claim.runtimeSessionId);
    if (
      !current
      || current.claimId !== claim.claimId
      || current.ownerInstanceId !== claim.runtimeOwnerInstanceId
    ) {
      throw new Error(`POST_CLAIM_RUNTIME_IDENTITY_MISMATCH:${claim.runtimeSessionId}`);
    }
    const draining = current.state === "drain_requested"
      ? current
      : await sessions.requestDrain({
          sessionId: current.sessionId,
          ownerInstanceId: current.ownerInstanceId,
          diagnostic: `${diagnostic}: exact pre-transfer runtime drain`,
        });
    await drainDurableRuntimeSession(draining, {
      requestId: `post-claim-pre-transfer-${claim.claimId}`,
      authorityRef: `setfarm://claim-log/${claim.claimId}/pre-transfer-drain`,
    });
    snapshot = await loadExact();
    if (!snapshot || snapshot.runtime_state !== "drained") {
      throw new Error(`POST_CLAIM_RUNTIME_DRAIN_UNPROVEN:${claim.runtimeSessionId}`);
    }
    const racedHandoff = canonicalHandoff(snapshot);
    if (racedHandoff) return racedHandoff;
  }
  if (snapshot.runtime_state === "quarantined") {
    throw new Error(`POST_CLAIM_RUNTIME_QUARANTINED:${claim.runtimeSessionId}`);
  }

  if (snapshot.claim_outcome === null) {
    await releasePreSpawnClaim(claim, runtimeAgentId, diagnostic);
  } else {
    if (snapshot.active_delivery_count > 0 && claim.recoveryDispatchId) {
      await relinquishV3RecoveryOwner(claim, `V3_RECOVERY_POST_CLAIM_TERMINAL_CLEANUP: ${diagnostic}`);
    }
    if (snapshot.active_attempt_count > 0 && snapshot.active_delivery_count === 0) {
      await createPostgresTerminalAttemptReconciler(getSql(), { graceMs: 0 }).reconcileClaim({
        claimId: claim.claimId,
        runtimeQuiesced: true,
      });
    }
  }

  const settledRuntime = await sessions.findById(claim.runtimeSessionId);
  if (!settledRuntime) throw new Error(`POST_CLAIM_RUNTIME_MISSING:${claim.runtimeSessionId}`);
  if (settledRuntime.state === "reserved") {
    await pgBegin((sql) => releaseReservedRuntimeSessionInTransaction(sql, {
      sessionId: settledRuntime.sessionId,
      claimId: claim.claimId!,
      ownerInstanceId: settledRuntime.ownerInstanceId,
      diagnostic,
    }));
  } else if (settledRuntime.state === "drained") {
    await pgBegin((sql) => releaseDrainedRuntimeSessionInTransaction(sql, {
      sessionId: settledRuntime.sessionId,
      claimId: claim.claimId!,
      ownerInstanceId: settledRuntime.ownerInstanceId,
    }));
  } else if (settledRuntime.state !== "released") {
    throw new Error(`POST_CLAIM_RUNTIME_NOT_SETTLED:${settledRuntime.sessionId}:${settledRuntime.state}`);
  }

  const retained = await loadExact();
  if (
    !retained
    || retained.claim_outcome === null
    || retained.runtime_state !== "released"
    || retained.active_attempt_count > 0
    || retained.active_delivery_count > 0
    || retained.active_completion_count > 0
    || retained.quarantined_completion_count > 0
    || retained.active_termination_count > 0
  ) {
    throw new Error(
      `POST_CLAIM_OWNERSHIP_RETAINED:${claim.claimId}`
      + `:${retained?.claim_outcome ?? "claim-open"}`
      + `:${retained?.runtime_state ?? "runtime-missing"}`
      + `:attempts=${retained?.active_attempt_count ?? -1}`
      + `:deliveries=${retained?.active_delivery_count ?? -1}`
      + `:completions=${retained?.active_completion_count ?? -1}`
      + `:quarantined-completions=${retained?.quarantined_completion_count ?? -1}`
      + `:terminations=${retained?.active_termination_count ?? -1}`,
    );
  }
  return { status: "settled" };
}

async function activeProcessHasOpenClaim(active: ActiveProcess, stepIdName: string): Promise<boolean> {
  if (active.storyId) {
    const row = await pgGet<{ id: string }>(
      `SELECT id
       FROM claim_log
       WHERE run_id = $1
         AND step_id = $2
         AND story_id = $3
         AND agent_id = $4
         AND outcome IS NULL
       LIMIT 1`,
      [active.runId, stepIdName, active.storyId, active.claimAgentId],
    );
    return Boolean(row);
  }
  const row = await pgGet<{ id: string }>(
    `SELECT id
     FROM claim_log
     WHERE run_id = $1
       AND step_id = $2
       AND story_id IS NULL
       AND agent_id = $3
       AND outcome IS NULL
     LIMIT 1`,
    [active.runId, stepIdName, active.claimAgentId],
  );
  return Boolean(row);
}

function readProcessArgs(pid: number): string {
  try {
    return execFileSync("ps", ["-o", "args=", "-p", String(pid)], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function extractSpawnerSessionKeyFromArgs(args: string): string {
  const agent = args.match(/--agent\s+(\S+)/)?.[1];
  const sessionId = args.match(/--session-id\s+(\S+)/)?.[1];
  return agent && sessionId ? buildSessionKey(agent, sessionId) : "";
}

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killStartupOrphanSpawnerAgents(): Promise<void> {
  const orphans: Array<{ pid: number; sessionKey: string }> = [];
  try {
    const out = execFileSync("pgrep", ["-f", "openclaw.*agent.*--session-id spawner-"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    for (const pidRaw of out.split(/\s+/).filter(Boolean)) {
      const pid = Number(pidRaw);
      if (!Number.isFinite(pid) || pid === process.pid) continue;
      const sessionKey = extractSpawnerSessionKeyFromArgs(readProcessArgs(pid));
      console.warn(`[spawner] killing orphan spawner OpenClaw process pid=${pid}${sessionKey ? " session=" + sessionKey : ""}`);
      if (sessionKey) cancelRuntimeTask(sessionKey, "startup-orphan");
      killProcessTree(pid, "SIGTERM");
      orphans.push({ pid, sessionKey });
    }
  } catch {
    // no orphan spawner-owned openclaw processes
  }
  if (orphans.length === 0) return;
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const elapsed = 8_000 - (deadline - Date.now());
    for (const orphan of orphans) {
      if (elapsed >= 3_000 && pidIsAlive(orphan.pid)) killProcessTree(orphan.pid, "SIGKILL");
      if (!pidIsAlive(orphan.pid) && orphan.sessionKey) {
        forceCancelOpenClawLookupSync(orphan.sessionKey, "startup-orphan-quiescence");
      }
    }
    const liveProcess = orphans.some((orphan) => pidIsAlive(orphan.pid));
    const liveTask = orphans.some((orphan) =>
      Boolean(orphan.sessionKey) && openClawTaskIdsForLookupSync(orphan.sessionKey).length > 0
    );
    if (!liveProcess && !liveTask) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  for (const orphan of orphans) killProcessTree(orphan.pid, "SIGKILL");
  throw new Error(`STARTUP_RUNTIME_QUIESCENCE_TIMEOUT: ${orphans.map((orphan) => orphan.pid).join(",")}`);
}

async function loopStoryCompletedAfter(runId: string, agentId: string, currentStoryId: string | null, startedAtMs?: number): Promise<boolean> {
  const startedAt = new Date(startedAtMs || Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (currentStoryId) {
    const current = await pgGet<{ status: string }>(
      "SELECT status FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
      [currentStoryId, runId],
    );
    if (current && ["done", "verified"].includes(current.status)) return true;
  }

  const completed = await pgGet<{ story_id: string }>(
    `SELECT story_id
     FROM stories
     WHERE run_id = $1
       AND claimed_by = $2
       AND status IN ('done', 'verified')
       AND updated_at >= $3
     ORDER BY updated_at DESC
     LIMIT 1`,
    [runId, agentId, startedAt],
  );
  return !!completed;
}

async function publishRuntimeCompletionProposal(
  stepId: string,
  output: string,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<Readonly<{
  managed: boolean;
  result?: { advanced: boolean; runCompleted: boolean };
  request?: RuntimeCompletionRequest;
}>> {
  let completionOutput = output;
  if (claimEnvelope) {
    const submission = await requestRuntimeCompletion(getSql(), {
      envelope: claimEnvelope,
      output,
    });
    if (submission.status !== "direct") completionOutput = submission.request.output;
    if (submission.status !== "direct") {
      emitEvent({
        ts: new Date().toISOString(),
        event: "runtime.completion_requested",
        runId: submission.request.runId,
        workflowId: submission.request.workflowStepId,
        stepId: submission.request.workflowStepId,
        storyId: submission.request.storyId,
        agentId: submission.request.claimEnvelope.runtimeAgentId,
        detail: `Completion ${submission.request.requestId} published by spawner recovery`,
      });
      await pgRun("SELECT pg_notify('runtime_completion_requested', $1)", [JSON.stringify({
        completionRequestId: submission.request.requestId,
        runId: submission.request.runId,
        runtimeSessionId: submission.request.runtimeSessionId,
      })]);
      await processRuntimeCompletionRequests(submission.request.requestId);
      return {
        managed: true,
        request: (await createRuntimeCompletionRepository(getSql()).findById(submission.request.requestId))
          ?? submission.request,
      };
    }
  }
  return { managed: false, result: await completeStep(stepId, completionOutput, claimEnvelope) };
}

async function publishRuntimeCompletionIfPresent(claimId: number | undefined): Promise<boolean> {
  if (!claimId) return false;
  const request = await createRuntimeCompletionRepository(getSql()).findByClaimId(claimId);
  if (!request) return false;
  if (!["accepted", "rejected", "quarantined"].includes(request.state)) {
    await processRuntimeCompletionRequests(request.requestId);
  }
  return true;
}

async function completeRunningClaimFromOutputFile(
  stepId: string,
  agentId: string,
  outputPath?: string,
  startedAtMs?: number,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<boolean> {
  if (!outputPath) return false;
  const nativeV3Implementation = claimEnvelope?.protocol === "v3"
    && claimEnvelope.workflowStepId === "implement";
  let stat: fs.Stats;
  let output = "";
  if (nativeV3Implementation) {
    try {
      const boundedRead = readUtf8RegularFileAtMostSync(
        outputPath,
        V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES,
      );
      stat = boundedRead.stat;
      output = boundedRead.text.trim();
      if (Buffer.byteLength(output, "utf8") > V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES) {
        console.warn(`[spawner] rejected oversized UTF-8 v3 implementation proposal for ${stepId}`);
        return false;
      }
    } catch (error) {
      if (error instanceof BoundedFileReadError && error.code === "FILE_TOO_LARGE") {
        console.warn(`[spawner] rejected oversized v3 implementation proposal for ${stepId}`);
      }
      return false;
    }
  } else {
    try {
      stat = fs.statSync(outputPath);
      output = fs.readFileSync(outputPath, "utf-8").trim();
    } catch {
      return false;
    }
  }
  if (!stat.isFile() || stat.size <= 0) return false;
  if (startedAtMs && stat.mtimeMs < startedAtMs - 5000) return false;
  if (nativeV3Implementation) {
    if (!output.startsWith("{") || !output.endsWith("}")) return false;
  } else if (!/^STATUS\s*:/mi.test(output)) {
    return false;
  }

  const row = await pgGet<{ status: string; step_id: string; run_id: string }>(
    "SELECT status, step_id, run_id FROM steps WHERE id = $1 LIMIT 1",
    [stepId],
  );
  if (!row || row.status !== "running") return false;

  try {
    const publication = await publishRuntimeCompletionProposal(stepId, output, claimEnvelope);
    try { fs.unlinkSync(outputPath); } catch {}
    console.warn(
      publication.managed
        ? `[spawner] published manager-owned output recovery for ${row.step_id}/${agentId} from ${outputPath}`
        : `[spawner] recovered legacy ${row.step_id} for ${agentId} from ${outputPath}; advanced=${publication.result?.advanced ?? false} runCompleted=${publication.result?.runCompleted ?? false}`,
    );
    return true;
  } catch (err) {
    console.warn(`[spawner] output-file recovery failed for ${row.step_id}/${agentId}: ${String(err).slice(0, 300)}`);
    return false;
  }
}

async function completeActiveClaimFromOutputFile(active: ActiveProcess): Promise<boolean> {
  const completed = await completeRunningClaimFromOutputFile(
    active.stepId,
    active.claimAgentId,
    active.outputPath,
    active.startedAtMs,
    activeClaimEnvelope(active),
  );
  if (completed && active.storyId && active.runtimeDrainRequested) {
    const stepName = await stepNameForDbId(active.stepId);
    if (stepName) {
      await cleanupLatestCompletedClaimRuntime(
        active.runId,
        stepName,
        active.claimAgentId,
        active.spawnCwd,
      );
    }
  }
  return completed;
}

async function reconcileTerminalOpenClawTask(
  active: ActiveProcess,
  activeKey: string,
  workflowStepId: string,
  storyDbId: string | null,
): Promise<boolean> {
  if (AGENT_RUNTIME !== "openclaw") return false;
  const probe = readOpenClawTaskRegistryProbe({
    databasePath: OPENCLAW_TASKS_DB,
    sessionKey: active.sessionKey,
    nowMs: Date.now(),
    settleMs: OPENCLAW_TASK_TERMINAL_SETTLE_MS,
  });
  if (probe.kind === "ambiguous") {
    await recordRuntimeSupervisorSignal(
      active,
      workflowStepId,
      storyDbId,
      "openclaw-task-registry-ambiguous",
      "OPENCLAW TASK REGISTRY AMBIGUOUS",
      `OPENCLAW_TASK_REGISTRY_AMBIGUOUS: exact session resolved ${probe.taskIds.length} task rows`,
    );
    return false;
  }
  if (probe.kind !== "terminal") return false;

  const outcome = decodeOpenClawTaskTerminalRecord(probe.task);
  const sessionKeyHash = crypto.createHash("sha256").update(active.sessionKey).digest("hex");
  const evidence = {
    schema: "setfarm.openclaw-task-terminal-evidence.v1",
    taskId: probe.task.taskId,
    sessionKeyHash,
    status: probe.task.status,
    endedAt: new Date(probe.task.endedAt).toISOString(),
    outcomeKind: outcome.kind,
    ...("code" in outcome ? { code: outcome.code } : {}),
    ...("retryable" in outcome ? { retryable: outcome.retryable } : {}),
  };
  await recordObservation({
    runId: active.runId,
    stepId: workflowStepId,
    storyId: active.storyId || "",
    agentId: active.agentId,
    checkId: `openclaw.task_terminal:${probe.task.taskId}`,
    label: "OpenClaw task terminal",
    status: "info",
    summary: "code" in outcome ? outcome.code : "OPENCLAW_AGENT_COMPLETED",
    detail: "diagnostic" in outcome ? outcome.diagnostic : "OpenClaw task registry reports completion",
    evidence,
    eventType: "runtime.openclaw_task_terminal",
    completedAt: new Date().toISOString(),
  });
  try {
    fs.appendFileSync(active.transcriptPath, `[spawner] ${JSON.stringify(evidence)}\n`);
  } catch {}

  terminateActiveProcess(active, "openclaw-task-registry-terminal");
  activeProcesses.delete(activeKey);
  if (await completeActiveClaimFromOutputFile(active)) return true;
  const error = outcome.kind === "transient_failure" || outcome.kind === "terminal_failure"
    ? new OpenClawAgentTerminalError(outcome)
    : new Error(
      `OPENCLAW_TASK_COMPLETED_WITHOUT_CLAIM_OUTPUT: task ${probe.task.taskId} ended before publishing claim completion`,
    );
  await settleExitedClaimAndRuntime(active, error);
  return true;
}

type RunningStepRow = {
  status: string;
  step_id: string;
  run_id: string;
  type: string;
  current_story_id: string | null;
};

function gitOutput(cwd: string, args: string[], timeoutMs = 10_000): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function buildScriptExists(workdir: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(workdir, "package.json"), "utf-8"));
    return typeof pkg?.scripts?.build === "string" && pkg.scripts.build.trim().length > 0;
  } catch {
    return false;
  }
}

const RECOVERABLE_SOURCE_PATHS = [
  "src", "app", "components", "lib", "pages", "public", "assets",
  "index.html", "package.json", "package-lock.json",
  "vite.config.ts", "vite.config.js", "tsconfig.json",
  "tailwind.config.ts", "tailwind.config.js", "postcss.config.js",
  "eslint.config.js", "vitest.config.ts", "vitest.config.js",
  "jest.config.ts", "jest.config.js",
];

function scopedRecoverableSourcePaths(workdir: string): string[] {
  const scoped = Array.from(readStoryScopeFileSet(workdir)).filter((file) => {
    if (!file || file.startsWith("../") || path.isAbsolute(file)) return false;
    if (/^(?:\.git|\.setfarm|references|node_modules|dist|build|coverage|\.story-branch|pre-commit)(?:\/|$)/.test(file)) return false;
    return true;
  });
  return [...new Set([...RECOVERABLE_SOURCE_PATHS, ...scoped])];
}

function sourceDiffFiles(workdir: string, baseRef: string): string[] {
  const raw = gitOutput(workdir, [
    "diff", "--name-only", `${baseRef}...HEAD`, "--", ...scopedRecoverableSourcePaths(workdir),
  ]);
  return raw ? raw.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function sourceStatusFiles(workdir: string): string[] {
  let raw: string | null = null;
  try {
    raw = execFileSync("git", ["status", "--porcelain", "-uall", "--", ...scopedRecoverableSourcePaths(workdir)], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    raw = null;
  }
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => {
      let rel = line.slice(3).trim();
      if (rel.includes(" -> ")) rel = rel.split(" -> ").pop() || rel;
      return rel.replace(/^"|"$/g, "");
    })
    .filter(Boolean);
}

function sourceTouchedFiles(workdir: string, baseRef: string): string[] {
  return [...new Set([...sourceDiffFiles(workdir, baseRef), ...sourceStatusFiles(workdir)])];
}

const PACKAGE_SCOPE_MUTATION_FILES = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

function packageScopeStatusFiles(workdir: string): string[] {
  let raw: string | null = null;
  try {
    raw = execFileSync("git", ["status", "--porcelain", "-uall", "--", ...PACKAGE_SCOPE_MUTATION_FILES], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    raw = null;
  }
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => {
      let rel = line.slice(3).trim();
      if (rel.includes(" -> ")) rel = rel.split(" -> ").pop() || rel;
      return rel.replace(/^"|"$/g, "");
    })
    .filter(Boolean);
}

function worktreeStatusFiles(workdir: string): string[] {
  let raw: string | null = null;
  try {
    raw = execFileSync("git", ["status", "--porcelain", "-uall"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    raw = null;
  }
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => {
      let rel = line.slice(3).trim();
      if (rel.includes(" -> ")) rel = rel.split(" -> ").pop() || rel;
      return normalizeRelativePath(rel.replace(/^"|"$/g, ""));
    })
    .filter(Boolean);
}

function implementPackageScopeDirtyGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  const allowed = readStoryScopeFileSet(active.spawnCwd);
  const dirty = packageScopeStatusFiles(active.spawnCwd).filter((file) => !allowed.has(file));
  if (dirty.length === 0) return { detected: false, reason: "" };
  return {
    detected: true,
    reason: `SCOPE_WRITE_VIOLATION: ${active.agentId} changed package/dependency file(s) outside .story-scope-files: ${dirty.slice(0, 8).join(", ")}. Developer agents must not change package.json or lockfiles during IMPLEMENT unless those files are in SCOPE_FILES. Revert package/lockfile changes and use existing stack-pack dependencies; if a new dependency is required, report a setup-build/stack-pack dependency blocker.`,
  };
}

function implementScopeDirtyGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  const allowed = readStoryScopeFileSet(active.spawnCwd);
  if (!allowed.size) return { detected: false, reason: "" };
  const dirty = worktreeStatusFiles(active.spawnCwd)
    .filter((file) => !isRuntimeScopeAllowedWrite(file, allowed, active.storyId));
  if (dirty.length === 0) return { detected: false, reason: "" };
  const scratch = dirty.filter(isForbiddenProjectScratchArtifact);
  const scratchHint = scratch.length > 0
    ? " Project-tree debug/probe/scratch files are forbidden even when they match *.test.*; run one-off experiments under /tmp instead."
    : "";
  return {
    detected: true,
    reason: `SCOPE_WRITE_VIOLATION: ${active.agentId} changed file(s) outside .story-scope-files via shell/runtime side effects: ${dirty.slice(0, 8).join(", ")}.${scratchHint} Runtime supervisor killed the claim before out-of-scope work could be committed.`,
  };
}

function implementNoDeltaStallGuard(active: ActiveProcess, ageMs: number): { detected: boolean; reason: string } {
  if (ageMs < IMPLEMENT_NO_DELTA_GRACE_MS) return { detected: false, reason: "" };
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };

  const changedFiles = sourceStatusFiles(active.spawnCwd);
  if (changedFiles.length > 0) return { detected: false, reason: "" };

  return {
    detected: true,
    reason: `IMPLEMENT_NO_DELTA_STALL: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without writing any project source/worktree delta. Supervisor should redirect the same worker toward a small scoped code change before extended analysis; use CLAIM_SUMMARY_FILE and injected contracts instead of reasoning in place.`,
  };
}

function implementRetryHardTimeoutGuard(active: ActiveProcess, ageMs: number): { detected: boolean; reason: string } {
  if (ageMs < IMPLEMENT_RETRY_HARD_TIMEOUT_MS) return { detected: false, reason: "" };
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };
  const retryMode = claimSummaryRetryDisciplineMode(active);
  if (!retryMode) return { detected: false, reason: "" };
  const changedFiles = sourceStatusFiles(active.spawnCwd);
  if (changedFiles.length > 0 && ageMs < IMPLEMENT_RETRY_WITH_DELTA_HARD_TIMEOUT_MS) return { detected: false, reason: "" };
  const progressHint = changedFiles.length > 0
    ? ` after changing scoped source files (${changedFiles.slice(0, 8).join(", ")})`
    : "";

  return {
    detected: true,
    reason: `IMPLEMENT_RETRY_HARD_TIMEOUT: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} in retry discipline mode "${retryMode}" without producing final output${progressHint}. Retry workers must make a bounded scoped fix, run verification, and either finish or fail; Setfarm is requeueing instead of allowing an active-analysis loop.`,
  };
}

function isImplementBuildCommand(command: string): boolean {
  return /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?build\b/i.test(compactCommandForDiagnostic(command));
}

function isImplementTestCommand(command: string): boolean {
  return /\b(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?test(?::run)?|test)\b/i.test(compactCommandForDiagnostic(command))
    || /(?:^|[\s;&|()])(?:npx\s+)?vitest\s+run\b/i.test(compactCommandForDiagnostic(command));
}

function toolResultSucceeded(message: any, text: string): boolean {
  const exitCode = message?.details?.exitCode ?? message?.details?.statusCode;
  if (Number(exitCode) === 0) return true;
  return /\b(?:✓ built in|Test Files\s+\d+\s+passed|Tests?\s+\d+\s+passed)\b/i.test(text)
    && !/\b(?:exit\s+[1-9]\d*|Command exited with code [1-9]\d*|failed|FAIL)\b/i.test(text);
}

function implementPostCheckOutputStallGuard(active: ActiveProcess, ageMs: number): { detected: boolean; reason: string } {
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };
  const changedFiles = sourceStatusFiles(active.spawnCwd);
  if (changedFiles.length === 0) return { detected: false, reason: "" };

  const raw = readSessionJsonlForGuard(active.sessionJsonlPath);
  if (!raw) return { detected: false, reason: "" };

  let currentCommand = "";
  let buildPassed = false;
  let testPassed = false;
  let lastCheckPassAtMs = 0;
  let postCheckToolCalls = 0;
  const postCheckTools: string[] = [];

  for (const line of raw.split(/\n/).filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    const eventAtMs = Number.isFinite(Date.parse(String(event.timestamp || ""))) ? Date.parse(String(event.timestamp || "")) : 0;
    const message = sessionEventMessage(event);
    const role = String(message.role || "");

    if (role === "assistant") {
      for (const call of extractToolCalls(message)) {
        if (call.name === "exec") currentCommand = call.command || "";
        else currentCommand = "";

        if (buildPassed && testPassed) {
          const command = compactCommandForDiagnostic(call.command || "");
          const completesClaim = command.includes(active.outputPath) && /\bstep\s+complete\b/.test(command);
          if (!completesClaim) {
            postCheckToolCalls += 1;
            postCheckTools.push(call.name === "exec" ? `exec:${command.slice(0, 80)}` : call.name);
          }
        }
      }
      continue;
    }

    if (role === "toolResult") {
      const text = extractSessionText(message.content);
      if (currentCommand && toolResultSucceeded(message, text)) {
        if (isImplementBuildCommand(currentCommand)) buildPassed = true;
        if (isImplementTestCommand(currentCommand)) testPassed = true;
        if ((isImplementBuildCommand(currentCommand) || isImplementTestCommand(currentCommand)) && eventAtMs > 0) {
          lastCheckPassAtMs = Math.max(lastCheckPassAtMs, eventAtMs);
        }
      }
    }
  }

  if (!buildPassed || !testPassed || postCheckToolCalls === 0) return { detected: false, reason: "" };
  const nowMs = Date.now();
  const idleAfterChecksMs = lastCheckPassAtMs > 0 ? nowMs - lastCheckPassAtMs : ageMs;
  if (idleAfterChecksMs < IMPLEMENT_POST_CHECK_OUTPUT_STALL_MS) return { detected: false, reason: "" };

  return {
    detected: true,
    reason: `IMPLEMENT_POST_CHECK_OUTPUT_STALL: ${active.agentId} passed build and test, then kept ${active.wfId}/${active.role} running for ${formatDurationMs(idleAfterChecksMs)} without writing final output after ${postCheckToolCalls} extra tool call(s) (${postCheckTools.slice(0, 5).join(", ")}). After declared checks pass, implement workers must write the output contract and stop; Setfarm is recovering build-passing scoped work instead of waiting for post-check drift.`,
  };
}

function findDiffBaseRef(workdir: string): string | null {
  for (const ref of ["main", "origin/main", "HEAD~1"]) {
    if (!gitOutput(workdir, ["rev-parse", "--verify", ref])) continue;
    if (sourceTouchedFiles(workdir, ref).length > 0) return ref;
  }
  return null;
}

function findWorktreeByBranch(repo: string, storyBranch: string): string | null {
  const raw = gitOutput(repo, ["worktree", "list", "--porcelain"]);
  if (!raw) return null;
  let worktree = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      worktree = line.slice("worktree ".length).trim();
      continue;
    }
    if (line.startsWith("branch ")) {
      const branch = line.slice("branch ".length).trim().split("/").pop()?.toLowerCase() || "";
      if (branch === storyBranch.toLowerCase()) return safeAgentCwdFromCandidate(worktree);
    }
  }
  return null;
}

function runBuildGate(workdir: string): boolean {
  if (!buildScriptExists(workdir)) return false;
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: workdir,
      timeout: IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true" },
    });
    return true;
  } catch {
    return false;
  }
}

function commitRecoveredImplementWork(workdir: string, storyId: string, files: string[]): string | null {
  const uniqueFiles = [...new Set(files)].filter(Boolean);
  if (uniqueFiles.length === 0) return null;
  try {
    execFileSync("git", ["add", "--", ...uniqueFiles], {
      cwd: workdir,
      timeout: 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const staged = gitOutput(workdir, ["diff", "--cached", "--name-only"]);
    if (staged) {
      execFileSync("git", ["commit", "-m", `chore: recover ${storyId} implement work`], {
        cwd: workdir,
        timeout: 30_000,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });
    }
    return gitOutput(workdir, ["rev-parse", "--short", "HEAD"]);
  } catch (err) {
    console.warn(`[spawner] implement recovery commit failed for ${storyId}: ${compactExitReason(err)}`);
    return null;
  }
}

function commitRecoveredImplementWorkThroughScopeGate(workdir: string, storyId: string, storyTitle: string): { sha: string; stagedFiles: string[]; error: string } {
  const result = commitStoryWorktreeScopeIfNeeded(workdir, storyId, storyTitle, [], "chore");
  if (!result.committed || !result.sha) {
    return {
      sha: "",
      stagedFiles: result.stagedFiles || [],
      error: result.error || `PLATFORM_STORY_RECOVERY_NO_SCOPED_COMMIT: ${storyId} had no scoped uncommitted source delta to recover.`,
    };
  }
  return { sha: result.sha, stagedFiles: result.stagedFiles, error: "" };
}

async function tryRecoverExitedImplementWork(
  active: Pick<ActiveProcess, "stepId" | "storyDbId" | "claimAgentId" | "agentId" | "transcriptPath" | "spawnCwd">,
  row: RunningStepRow,
  err: unknown,
): Promise<boolean> {
  const exitReason = compactExitReason(err);
  const recoverableExit =
    exitReason.includes("without calling setfarm step complete/fail") ||
    exitReason.includes("AGENT_STARTUP_SILENT") ||
    exitReason.includes("AGENT_PROCESS_STUCK") ||
    exitReason.includes("AGENT_PROCESS_TERMINAL") ||
    exitReason.includes("IMPLEMENT_RETRY_HARD_TIMEOUT") ||
    exitReason.includes("IMPLEMENT_POST_CHECK_OUTPUT_STALL") ||
    exitReason.includes("MASKED_CHECK_COMMAND");
  if (!recoverableExit) return false;
  if (row.status !== "running" || row.type !== "loop" || row.step_id !== "implement" || !active.storyDbId) return false;
  const runProtocol = await pgGet<{ protocol: string }>(
    "SELECT protocol FROM runs WHERE id = $1 LIMIT 1",
    [row.run_id],
  );
  // A native v3 source delta is never converted into fabricated model output.
  // Its valid JSON output file is handled above; without one the typed
  // operational-retry transition resets the sealed source before redispatch.
  if (runProtocol?.protocol === "v3") return false;

  const story = await pgGet<{ id: string; story_id: string; title: string; story_branch: string | null; status: string; claimed_by: string | null }>(
    "SELECT id, story_id, title, story_branch, status, claimed_by FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
    [active.storyDbId, row.run_id],
  );
  if (!story || story.status !== "running") return false;
  if (story.claimed_by && story.claimed_by !== active.claimAgentId) return false;

  const storyBranch = (story.story_branch || `${row.run_id.slice(0, 8)}-${story.story_id}`).toLowerCase();
  const contextRow = await pgGet<{ context: string | null }>("SELECT context FROM runs WHERE id = $1 LIMIT 1", [row.run_id]);
  let context: Record<string, string> = {};
  try {
    context = contextRow?.context ? JSON.parse(contextRow.context) : {};
  } catch {
    context = {};
  }

  const workdirCandidates = [
    safeAgentCwdFromCandidate(active.spawnCwd),
    safeAgentCwdFromCandidate(context["story_workdir"]),
    context["repo"] ? findWorktreeByBranch(context["repo"], storyBranch) : null,
  ].filter((candidate): candidate is string => !!candidate);
  const workdir = [...new Set(workdirCandidates)].find((candidate) => {
    const branch = gitOutput(candidate, ["branch", "--show-current"]);
    return branch?.toLowerCase() === storyBranch;
  });
  if (!workdir) return false;

  const baseRef = findDiffBaseRef(workdir);
  if (!baseRef) return false;
  const changedFiles = sourceTouchedFiles(workdir, baseRef).slice(0, 20);
  if (changedFiles.length === 0) return false;
  if (!runBuildGate(workdir)) return false;
  const recoveryCommit = commitRecoveredImplementWorkThroughScopeGate(workdir, story.story_id, story.title);
  if (!recoveryCommit.sha) {
    console.warn(`[spawner] implement recovery scope gate blocked ${story.story_id}: ${recoveryCommit.error}`);
    return false;
  }

  context["story_workdir"] = workdir;
  context["story_branch"] = storyBranch;
  await pgRun("UPDATE runs SET context = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(context), row.run_id]);

  const recoveryOutput = [
    "STATUS: done",
    `STORY_BRANCH: ${storyBranch}`,
    `CHANGES: Recovered ${story.story_id} after agent exited with build-passing scoped work on ${storyBranch}. Commit: ${recoveryCommit.sha}.`,
    "BUILD_CMD: npm run build",
    "RECOVERY: agent-exit-build-and-scope-passing",
    `RECOVERY_COMMIT: ${recoveryCommit.sha}`,
    `TRANSCRIPT: ${active.transcriptPath}`,
    `CHANGED_FILES: ${(recoveryCommit.stagedFiles.length > 0 ? recoveryCommit.stagedFiles : changedFiles).join(", ")}`,
  ].join("\n");

  const currentOwner = await pgGet<{ current_story_id: string | null }>(
    "SELECT current_story_id FROM steps WHERE id = $1 LIMIT 1",
    [active.stepId],
  );
  if (currentOwner?.current_story_id !== active.storyDbId) {
    throw new Error("RECOVERY_STORY_OWNERSHIP_CHANGED");
  }
  let recoveryEnvelope: ClaimEnvelopeV1 | undefined;
  try {
    recoveryEnvelope = activeClaimEnvelope(active as ActiveProcess);
  } catch {
    recoveryEnvelope = await recoverClaimEnvelopeFromDatabase({
      runId: row.run_id,
      stepDbId: active.stepId,
      workflowStepId: row.step_id,
      storyId: story.story_id,
      storyDbId: story.id,
      claimAgentId: active.claimAgentId,
      runtimeAgentId: active.agentId || active.claimAgentId,
      workdir,
    });
  }
  const publication = await publishRuntimeCompletionProposal(active.stepId, recoveryOutput, recoveryEnvelope);
  if (!publication.managed && !publication.result?.advanced && !publication.result?.runCompleted) {
    const refreshed = await pgGet<{ status: string }>("SELECT status FROM stories WHERE id = $1 LIMIT 1", [story.id]);
    if (!["done", "verified"].includes(refreshed?.status || "")) return false;
  }
  console.warn(`[spawner] recovered exited implement story ${story.story_id} for claim=${active.claimAgentId} runtime=${active.agentId}: build passed in ${workdir}`);
  return true;
}

async function cleanupQuiescedStoryWorktree(
  runId: string,
  storyId: string,
  agentId: string,
  workdir?: string,
): Promise<void> {
  try {
    const context = await getRunContext(runId);
    const branch = workdir ? gitOutput(workdir, ["branch", "--show-current"]) : null;
    await cleanupProjectEphemera(runId, `story-runtime-quiesced:${storyId}`, context);
    if (context["repo"]) {
      removeStoryWorktree(context["repo"], branch || storyId, agentId);
    }
  } catch (error) {
    console.warn(`[spawner] quiesced story cleanup failed for ${runId}/${storyId}: ${String(error).slice(0, 220)}`);
  }
}

async function finalizeExitedStoryRuntime(active: ActiveProcess): Promise<void> {
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  try {
    if (!Number.isSafeInteger(active.claimId) || Number(active.claimId) <= 0) {
      throw new Error("EXITED_RUNTIME_CLAIM_ID_MISSING");
    }
    const claimId = Number(active.claimId);
    let session = await runtimeSessions.findById(active.runtimeSessionId);
    if (!session) throw new Error("EXITED_RUNTIME_SESSION_NOT_FOUND");
    if (!["drained", "released"].includes(session.state)) {
      session = await runtimeSessions.requestDrain({
        sessionId: active.runtimeSessionId,
        ownerInstanceId: active.runtimeOwnerInstanceId,
        diagnostic: "Agent runtime exited; proving quiescence before ownership release",
      });
      await drainDurableRuntimeSession(session, { requestId: `runtime-exit-${active.runtimeSessionId}` });
    }
    const completed = await pgGet<{ story_status: string | null; outcome: string | null }>(
      `SELECT st.status AS story_status, cl.outcome
         FROM claim_log cl
         LEFT JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
        WHERE cl.id = $1
        LIMIT 1`,
      [claimId],
    );
    if (completed?.outcome !== null && completed?.outcome !== undefined) {
      await pgBegin((sql) => releaseDrainedRuntimeSessionInTransaction(sql, {
        sessionId: active.runtimeSessionId,
        claimId,
        ownerInstanceId: active.runtimeOwnerInstanceId,
      }));
      emitEvent({
        ts: new Date().toISOString(),
        event: "runtime.released",
        runId: active.runId,
        workflowId: active.wfId,
        storyId: active.storyId,
        detail: `Runtime ${active.runtimeSessionId} released after claim ${active.claimId} became ${completed.outcome}`,
      });
    }
    if (
      active.storyId
      &&
      completed?.outcome === "completed"
      && ["done", "verified", "skipped"].includes(completed.story_status || "")
    ) {
      await cleanupQuiescedStoryWorktree(
        active.runId,
        active.storyId,
        active.claimAgentId,
        active.spawnCwd,
      );
    }
  } catch (error) {
    const diagnostic = `EXITED_RUNTIME_FINALIZATION_FAILED: ${String(error).slice(0, 500)}`;
    const current = await runtimeSessions.findById(active.runtimeSessionId);
    if (
      current
      && current.ownerInstanceId === active.runtimeOwnerInstanceId
      && !["released", "quarantined"].includes(current.state)
    ) {
      await runtimeSessions.quarantine({
        sessionId: active.runtimeSessionId,
        expectedOwnerInstanceId: current.ownerInstanceId,
        expectedStateVersion: current.stateVersion,
        diagnostic,
        evidence: { claimId: active.claimId ?? null },
      });
    }
    console.warn(`[spawner] exited runtime quarantine retained for ${active.storyId || active.workflowStepId}: ${diagnostic}`);
  }
}

async function cleanupLatestCompletedClaimRuntime(
  runId: string,
  stepId: string,
  claimAgentId: string,
  claimedCwd?: string,
): Promise<void> {
  const completedStory = await pgGet<{ story_id: string }>(
    `SELECT story_id
       FROM claim_log
      WHERE run_id = $1
        AND step_id = $2
        AND agent_id = $3
        AND outcome = 'completed'
        AND story_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1`,
    [runId, stepId, claimAgentId],
  );
  if (!completedStory?.story_id) return;
  await waitForClaimRuntimeQuiescence(runId, completedStory.story_id, claimAgentId);
  await cleanupQuiescedStoryWorktree(runId, completedStory.story_id, claimAgentId, claimedCwd);
}

async function verifyEachHasDoneStory(runId: string, verifyStepId: string): Promise<boolean> {
  const loopStep = await pgGet<{ loop_config: string | null }>(
    `SELECT loop_config
     FROM steps
     WHERE run_id = $1 AND type = 'loop' AND loop_config LIKE '%verifyEach%'
     LIMIT 1`,
    [runId],
  );
  if (!loopStep?.loop_config) return true;

  try {
    const cfg = JSON.parse(loopStep.loop_config);
    if (!cfg?.verifyEach || (cfg.verifyStep || "verify") !== verifyStepId) return true;
  } catch {
    return true;
  }

  const waiting = await pgGet<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
    [runId],
  );
  return parseInt(waiting?.cnt || "0", 10) > 0;
}

async function failActiveClaimAfterRuntimeQuiescence(
  active: ActiveProcess,
  error: string,
): Promise<void> {
  if (!Number.isSafeInteger(active.claimId) || Number(active.claimId) <= 0) {
    throw new Error("ACTIVE_CLAIM_ID_MISSING");
  }
  const claimId = Number(active.claimId);
  if (active.protocol === "v3" && !active.storyId && !active.recoveryDispatchId) {
    await retryActiveSingleStepClaim(active, active.workflowStepId, error);
    return;
  }
  await waitForClaimRuntimeQuiescence(
    active.runId,
    active.storyId,
    active.claimAgentId,
  );
  if (active.recoveryDispatchId) {
    await relinquishV3RecoveryOwner(active, error);
    return;
  }
  await failStep(active.stepId, error, activeClaimEnvelope(active));
  await releaseReservedRuntimeForClaimIfPresent(claimId, error);
}

async function failClaimIfStillRunning(active: ActiveProcess, err: unknown): Promise<void> {
  const { stepId, wfId, role, transcriptPath, startedAtMs, spawnCwd: claimedCwd, outputPath } = active;
  const agentId = active.claimAgentId;
  try {
    const row = await pgGet<{ status: string; step_id: string; run_id: string; type: string; current_story_id: string | null }>(
      "SELECT status, step_id, run_id, type, current_story_id FROM steps WHERE id = $1 LIMIT 1",
      [stepId],
    );
    if (!row) return;
    if (row.type === "loop" && active.storyDbId && row.current_story_id !== active.storyDbId) {
      throw new Error("ACTIVE_CLAIM_STORY_OWNERSHIP_CHANGED");
    }

    if (await publishRuntimeCompletionIfPresent(active.claimId)) {
      return;
    }

    if (row.type === "loop" && await loopStoryCompletedAfter(row.run_id, agentId, active.storyDbId || null, startedAtMs)) {
      console.log(`[spawner] ${agentId} exited after completing a loop story for ${wfId}/${role}; keeping loop ${row.step_id} running (${compactExitReason(err)})`);
      await cleanupLatestCompletedClaimRuntime(row.run_id, row.step_id, agentId, claimedCwd);
      return;
    }

    if (row.status === "running" && await completeRunningClaimFromOutputFile(stepId, agentId, outputPath, startedAtMs, activeClaimEnvelope(active))) {
      await cleanupLatestCompletedClaimRuntime(row.run_id, row.step_id, agentId, claimedCwd);
      return;
    }

    if (row.status === "running" && active.recoveryDispatchId) {
      const reason = `V3_RECOVERY_AGENT_EXITED: exact dispatch ${active.recoveryDispatchId} ended before publishing its evidence-bound completion. ${compactExitReason(err)}. Transcript: ${transcriptPath}`;
      await recordSupervisorInfraEvent(row.run_id, row.step_id, active.storyDbId || null, reason);
      await failActiveClaimAfterRuntimeQuiescence(active, reason);
      return;
    }

    if (row.status === "running") {
      try {
        if (await tryRecoverExitedImplementWork(active, row, err)) {
          await cleanupLatestCompletedClaimRuntime(row.run_id, row.step_id, agentId, claimedCwd);
          return;
        }
      } catch (recoveryErr) {
        console.warn(`[spawner] exited implement recovery failed for ${wfId}/${role}: ${String(recoveryErr).slice(0, 300)}`);
      }
    }

    const openClawTerminalFailure = err instanceof OpenClawAgentTerminalError
      ? err.outcome
      : undefined;
    if (openClawTerminalFailure?.retryable) {
      const reason = `AGENT_RUNTIME_TRANSIENT [${openClawTerminalFailure.code}]: ${openClawTerminalFailure.diagnostic}. Transcript: ${transcriptPath}`;
      console.warn(`[spawner] ${reason}`);
      await recordSupervisorInfraEvent(row.run_id, row.step_id, active.storyDbId || null, reason);
      if (row.type === "loop") {
        const requeued = active.storyId
          ? await requeueOpenStoryClaim(row.run_id, row.step_id, active.storyId, agentId, reason, active.agentId)
          : false;
        if (requeued) return;
        throw new Error("OPENCLAW_TRANSIENT_LOOP_LIFECYCLE_OWNER_FAILED");
      }
      await retryActiveSingleStepClaim(active, row.step_id, reason);
      return;
    }

    if (row.type === "loop" && row.status !== "running") {
      const requeued = await requeueOrphanedStoryClaim(row.run_id, row.step_id, agentId, `agent exited while loop step was ${row.status}: ${compactExitReason(err)}`);
      if (requeued) return;
    }

    if (row.status !== "running") return;

    const usageLimit = detectRuntimeUsageLimit(transcriptPath);
    if (usageLimit.limited) {
      const cooldownMs = usageLimit.retryAfterMs || RUNTIME_USAGE_LIMIT_DEFAULT_COOLDOWN_MS;
      const cooldownUntil = Date.now() + cooldownMs;
      agentCooldownUntil.set(active.agentId, cooldownUntil);
      runtimeUsageLimitCooldownUntil = Math.max(runtimeUsageLimitCooldownUntil, cooldownUntil);
      const reason = `AGENT_RUNTIME_USAGE_LIMIT: ${agentId} hit a runtime usage limit; backing off ${formatDurationMs(cooldownMs)} before retrying ${wfId}/${role}. Transcript: ${transcriptPath}`;
      console.warn(`[spawner] ${reason}`);
      await recordSupervisorInfraEvent(row.run_id, row.step_id, active.storyDbId || null, reason);
      if (row.type === "loop") {
        if (active.storyId && await requeueOpenStoryClaim(row.run_id, row.step_id, active.storyId, agentId, reason, active.agentId)) return;
        throw new Error("USAGE_LIMIT_LOOP_LIFECYCLE_OWNER_FAILED");
      }
      await retryActiveSingleStepClaim(active, row.step_id, reason);
      return;
    }

    const authFailure = detectRuntimeAuthFailure(transcriptPath);
    if (authFailure.failed) {
      const reason = `AGENT_RUNTIME_AUTH_FAILED: ${agentId} cannot start ${AGENT_RUNTIME} because runtime authentication failed. ${authFailure.detail} Transcript: ${transcriptPath}`;
      console.warn(`[spawner] ${reason}`);
      await recordSupervisorInfraEvent(row.run_id, row.step_id, active.storyDbId || null, reason);
      const workflow = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1 LIMIT 1", [row.run_id]);
      if (row.type === "loop" && !active.storyId) throw new Error("AUTH_FAILURE_LOOP_STORY_ID_MISSING");
      await waitForClaimRuntimeQuiescence(row.run_id, active.storyId, agentId);
      await failRun(row.run_id, true, reason);
      const nowIso = new Date().toISOString();
      const workflowId = workflow?.workflow_id || wfId;
      emitEvent({ ts: nowIso, event: "step.failed", runId: row.run_id, workflowId, stepId: row.step_id, detail: reason });
      emitEvent({ ts: nowIso, event: "run.failed", runId: row.run_id, workflowId, detail: "AGENT_RUNTIME_AUTH_FAILED" });
      scheduleRunCronTeardown(row.run_id);
      await refreshRunContractForAuthFailure(row.run_id);
      return;
    }

    const approvalPending = detectRuntimeApprovalPending(transcriptPath);
    if (approvalPending.pending) {
      const reason = `AGENT_RUNTIME_APPROVAL_PENDING: ${agentId} stopped at a runtime approval prompt before completing ${wfId}/${role}. ${approvalPending.detail} Transcript: ${transcriptPath}`;
      console.warn(`[spawner] ${reason}`);
      await recordSupervisorInfraEvent(row.run_id, row.step_id, active.storyDbId || null, reason);
      if (row.type === "loop") {
        const requeued = active.storyId
          ? await requeueOpenStoryClaim(row.run_id, row.step_id, active.storyId, agentId, reason, active.agentId)
          : false;
        if (requeued) return;
        throw new Error("APPROVAL_LOOP_LIFECYCLE_OWNER_FAILED");
      }
      await retryActiveSingleStepClaim(active, row.step_id, reason);
      return;
    }

    const reason = `AGENT_PROCESS_EXITED: ${agentId} exited before completing ${wfId}/${role}. ${compactExitReason(err)}. Transcript: ${transcriptPath}`;
    await recordSupervisorInfraEvent(row.run_id, row.step_id, row.current_story_id, reason);
    const envelope = activeClaimEnvelope(active);
    if (row.type === "loop" && envelope.protocol === "v3") {
      if (
        active.storyId
        && await requeueOpenStoryClaim(
          row.run_id,
          row.step_id,
          active.storyId,
          agentId,
          reason,
          active.agentId,
        )
      ) return;
      throw new Error("V3_AGENT_EXIT_OPERATIONAL_RETRY_OWNER_FAILED");
    }
    console.warn(`[spawner] failing still-running claim ${stepId} (${row.step_id}) after agent exit`);
    await failActiveClaimAfterRuntimeQuiescence(active, reason);
  } catch (failErr) {
    console.warn(`[spawner] failed to mark exited agent claim as failed: ${String(failErr).slice(0, 300)}`);
  }
}

async function settleExitedClaimAndRuntime(active: ActiveProcess, err: unknown): Promise<void> {
  try {
    await failClaimIfStillRunning(active, err);
  } finally {
    await finalizeExitedStoryRuntime(active);
  }
}

function detectRuntimeApprovalPending(transcriptPath: string): { pending: boolean; detail: string } {
  let text = "";
  try {
    text = fs.readFileSync(transcriptPath, "utf-8").slice(-24000);
  } catch {
    return { pending: false, detail: "" };
  }

  const hasApprovalStatus = /"status"\s*:\s*"approval-pending"|Approval required \(id\s+[a-f0-9-]+/i.test(text);
  const hasApprovalInstruction = /Reply with:\s*\/approve\b|\/approve\s+[a-f0-9-]+\s+allow-(?:once|always)/i.test(text);
  const finalApproveOnly = /"finalAssistant(?:Visible|Raw)Text"\s*:\s*"\/approve\s+[a-f0-9-]+\s+allow-(?:once|always)"/i.test(text);
  if (!hasApprovalStatus && !finalApproveOnly) return { pending: false, detail: "" };

  const inlineEval = /strict inline-eval mode requires explicit approval/i.test(text);
  const detailParts = [
    inlineEval ? "OpenClaw strict inline-eval approval blocked an exec command." : "OpenClaw requested interactive approval.",
    hasApprovalInstruction || finalApproveOnly ? "The model answered with /approve instead of continuing the claim." : "",
  ].filter(Boolean);
  return { pending: true, detail: detailParts.join(" ") };
}

function detectRuntimeAuthFailure(transcriptPath: string): { failed: boolean; detail: string } {
  let text = "";
  try {
    text = fs.readFileSync(transcriptPath, "utf-8").slice(-12000);
  } catch {
    return { failed: false, detail: "" };
  }

  const selfPoisonLine =
    /(AGENT_RUNTIME_AUTH_FAILED|cannot start .* because runtime authentication failed|runtime authentication failed|PREVIOUS_FAILURE|RETRY_BLOCKER|FAILURE_CATEGORY|FAILURE_SUGGESTION|CLAIM_SUMMARY|OUTPUT_CONTRACT|Transcript:)/i;
  const strongAuthLine =
    /(invalid[_ -]?authentication|api key appears to be invalid|invalid api key|api key.*(?:invalid|expired)|auth token.*expired|unauthorized|401\b)/i;
  const genericAuthLine = /\bauthentication failed\b/i;
  const providerContextLine = /\b(kimi|moonshot|openclaw|codex|provider|runtime|stderr|error|login|sign in|api)\b/i;

  const authLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !selfPoisonLine.test(line))
    .filter((line) => strongAuthLine.test(line) || (genericAuthLine.test(line) && providerContextLine.test(line)));

  if (authLines.length === 0) {
    return { failed: false, detail: "" };
  }

  const compact = authLines
    .slice(-3)
    .join(" ");
  return { failed: true, detail: compact.slice(0, 500) || "Runtime returned an authentication error." };
}

async function refreshRunContractForAuthFailure(runId: string): Promise<void> {
  try {
    const { refreshRunContractSafe } = await import("./installer/contract-ledger.js");
    await refreshRunContractSafe(runId, "runtime.auth_failed");
  } catch (error) {
    console.warn(`[spawner] run contract refresh after auth failure failed: ${String(error).slice(0, 220)}`);
  }
}

function detectRuntimeUsageLimit(transcriptPath: string): { limited: boolean; retryAfterMs?: number } {
  let text = "";
  try {
    text = fs.readFileSync(transcriptPath, "utf-8").slice(-12000);
  } catch {
    return { limited: false };
  }
  if (!/(usage limit|(?:api\s*)?429|too many requests|rate limit|resource exhausted|access_terminated_error|only available for Coding Agents)/i.test(text)) return { limited: false };
  const retryAt = /\btry again at\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(text);
  if (!retryAt) return { limited: true };
  const nowDate = new Date();
  let hour = parseInt(retryAt[1] || "0", 10);
  const minute = parseInt(retryAt[2] || "0", 10);
  const meridiem = (retryAt[3] || "").toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  const target = new Date(nowDate);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= nowDate.getTime()) target.setDate(target.getDate() + 1);
  const retryAfterMs = Math.min(Math.max(target.getTime() - nowDate.getTime(), 60_000), 30 * 60_000);
  return { limited: true, retryAfterMs };
}

async function recordSupervisorInfraEvent(runId: string, stepId: string, storyDbId: string | null, reason: string): Promise<void> {
  await recordSupervisorRuntimeEvent(runId, stepId, storyDbId, "PRODUCT_SUPERVISOR_INFRA_RETRY", "infra-retry", reason);
}

async function recordSupervisorRuntimeEvent(
  runId: string,
  stepId: string,
  storyDbId: string | null,
  code: string,
  eventType: string,
  summary: string,
): Promise<void> {
  try {
    const contextRow = await pgGet<{ context: string | null }>("SELECT context FROM runs WHERE id = $1 LIMIT 1", [runId]);
    let context: Record<string, string> = {};
    try { context = contextRow?.context ? JSON.parse(contextRow.context) : {}; } catch { context = {}; }

    let storyLabel = "";
    let storyPublicId = "";
    if (storyDbId) {
      const story = await pgGet<{ story_id: string; title: string }>("SELECT story_id, title FROM stories WHERE id = $1 LIMIT 1", [storyDbId]);
      if (story) {
        storyPublicId = story.story_id;
        storyLabel = ` story=${story.story_id} title=${story.title.slice(0, 120)}`;
      }
    }

    const entry = [
      `### ${new Date().toISOString()} ${stepId} ${eventType}${storyLabel}`,
      `- Code: ${code}`,
      `- Step: ${stepId}`,
      `- Summary: ${summary.slice(0, 900)}`,
    ].join("\n") + "\n";
    updateSupervisorMemory(context, entry);
    await pgRun("UPDATE runs SET context = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(context), runId]);
    await recordObservation({
      runId,
      stepId,
      storyId: storyPublicId,
      checkId: `${eventType}:${code}:${Date.now()}`,
      label: `Supervisor ${eventType}`,
      status: eventType.includes("retry")
        ? "retry"
        : eventType.includes("guard") || eventType.includes("violation") || eventType.includes("stuck") || eventType.includes("limit")
          ? "blocked"
          : "info",
      summary: code,
      detail: summary,
      eventType: `supervisor.${eventType}`,
      completedAt: new Date().toISOString(),
      metadata: { code },
    });
  } catch (err) {
    console.warn(`[spawner] supervisor runtime memory update failed: ${String(err).slice(0, 220)}`);
  }
}

async function checkRuntimeGuardLoopContinuation(runId: string, stepId: string): Promise<void> {
  try {
    const step = await pgGet<{ id: string }>(
      "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
      [runId, stepId],
    );
    if (!step?.id) return;
    const { checkLoopContinuation } = await import("./installer/step-advance.js");
    await checkLoopContinuation(runId, step.id);
  } catch (err) {
    console.warn(`[spawner] runtime guard loop continuation failed for ${runId}/${stepId}: ${String(err).slice(0, 220)}`);
  }
}

async function recordRuntimeSupervisorSignal(
  active: ActiveProcess,
  stepId: string,
  storyDbId: string | null,
  guardName: string,
  transcriptTitle: string,
  reason: string,
): Promise<void> {
  const signalKey = `${guardName}:${reason.slice(0, 500)}`;
  active.supervisorSignals ||= new Set<string>();
  if (active.supervisorSignals.has(signalKey)) return;
  active.supervisorSignals.add(signalKey);
  const diagnostic = reason + ` Transcript: ${active.transcriptPath}`;
  console.warn(`[spawner] supervisor signal ${guardName}: ${diagnostic}`);
  try {
    fs.appendFileSync(active.transcriptPath, `--- SUPERVISOR SIGNAL ${transcriptTitle} ${new Date().toISOString()} ---\n${diagnostic}\n`);
  } catch {}
  await recordSupervisorRuntimeEvent(active.runId, stepId, storyDbId, "PRODUCT_SUPERVISOR_RUNTIME_SIGNAL", "supervisor-signal", diagnostic);
}

async function requeueRuntimeSupervisorSignal(
  active: ActiveProcess,
  key: string,
  rowStepId: string,
  storyId: string,
  reason: string,
  terminateReason: string,
): Promise<void> {
  const diagnostic = reason + ` Transcript: ${active.transcriptPath}`;
  terminateActiveProcess(active, terminateReason);
  activeProcesses.delete(key);
  if (await completeActiveClaimFromOutputFile(active)) return;
  await requeueOpenStoryClaim(active.runId, rowStepId, storyId, active.claimAgentId, diagnostic, active.agentId);
}

function runtimeGuardDiagnosticKey(diagnostic: string): string {
  const key = String(diagnostic || "").match(/^\s*([A-Z][A-Z0-9_]{2,80})(?::|\b)/)?.[1] || "";
  return key || "RUNTIME_GUARD";
}

async function runtimeGuardRepeatDecision(runId: string, stepId: string, storyId: string, agentId: string, diagnostic: string): Promise<{ hardFail: boolean; key: string; previousCount: number }> {
  const key = runtimeGuardDiagnosticKey(diagnostic);
  const rows = await pgQuery<{ outcome: string | null; diagnostic: string | null }>(
    `SELECT outcome, diagnostic
     FROM claim_log
     WHERE run_id = $1
       AND step_id = $2
       AND story_id = $3
       AND agent_id = $4
       AND outcome IS NOT NULL
     ORDER BY id DESC
     LIMIT 50`,
    [runId, stepId, storyId, agentId],
  );
  let previousCount = 0;
  for (const row of rows) {
    const outcome = String(row.outcome || "");
    if (outcome !== "infra_retry" && outcome !== "failed") break;
    if (runtimeGuardDiagnosticKey(String(row.diagnostic || "")) !== key) break;
    previousCount += 1;
  }
  return { hardFail: previousCount + 1 >= RUNTIME_GUARD_REPEAT_LIMIT, key, previousCount };
}

function setRuntimeGuardRequeueCooldown(agentId: string, reason: string): void {
  if (RUNTIME_GUARD_REQUEUE_SETTLE_MS <= 0) return;
  const until = Date.now() + RUNTIME_GUARD_REQUEUE_SETTLE_MS;
  agentCooldownUntil.set(agentId, Math.max(agentCooldownUntil.get(agentId) || 0, until));
  console.warn(
    `[spawner] runtime guard settle cooldown for ${agentId}: ${formatDurationMs(RUNTIME_GUARD_REQUEUE_SETTLE_MS)} after ${runtimeGuardDiagnosticKey(reason)}`,
  );
}

async function requeueOrphanedStoryClaim(runId: string, stepId: string, agentId: string, diagnostic: string): Promise<boolean> {
  const row = await pgGet<{ story_id: string }>(
    `SELECT st.id, st.story_id
     FROM stories st
     JOIN claim_log cl ON cl.run_id = st.run_id AND cl.story_id = st.story_id
     WHERE st.run_id = $1
       AND st.status = 'running'
       AND cl.step_id = $2
       AND cl.agent_id = $3
       AND cl.outcome IS NULL
     ORDER BY cl.claimed_at DESC
     LIMIT 1`,
    [runId, stepId, agentId],
  );
  if (!row) return false;
  return requeueOpenStoryClaim(runId, stepId, row.story_id, agentId, diagnostic);
}

async function requeueOpenStoryClaim(
  runId: string,
  stepId: string,
  storyId: string,
  claimAgentId: string,
  diagnostic: string,
  runtimeAgentId = claimAgentId,
): Promise<boolean> {
  const row = await pgGet<{ claim_id: string; protocol: string; step_db_id: string | null; story_db_id: string | null; story_status: string | null; story_output: string | null; claim_story_id: string; recovery_dispatch_id: string | null }>(
    `SELECT cl.id::text as claim_id, step_row.id AS step_db_id,
            st.id as story_db_id, st.status as story_status, st.output as story_output,
            cl.story_id as claim_story_id, r.protocol,
            delivery.dispatch_id AS recovery_dispatch_id
     FROM claim_log cl
     JOIN runs r ON r.id = cl.run_id
     LEFT JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
     LEFT JOIN steps step_row ON step_row.run_id = cl.run_id AND step_row.step_id = cl.step_id
     LEFT JOIN recovery_dispatch_deliveries delivery
       ON delivery.claim_id = cl.id
      AND delivery.run_id = cl.run_id
      AND delivery.story_id = cl.story_id
      AND delivery.state IN ('attempt_reserved', 'running')
     WHERE cl.run_id = $1
       AND cl.step_id = $2
       AND cl.story_id = $3
       AND cl.agent_id = $4
       AND cl.outcome IS NULL
     ORDER BY cl.claimed_at DESC
     LIMIT 1`,
    [runId, stepId, storyId, claimAgentId],
  );
  if (!row) return false;

  const claimId = Number(row.claim_id);
  if (!Number.isSafeInteger(claimId) || claimId <= 0) {
    throw new Error("RUNTIME_REQUEUE_CLAIM_ID_INVALID");
  }
  await waitForClaimRuntimeQuiescence(runId, storyId, claimAgentId);

  if (row.recovery_dispatch_id) {
    console.warn(`[spawner] V3_RECOVERY_GENERIC_REQUEUE_DEFERRED:${row.recovery_dispatch_id}:${diagnostic.slice(0, 160)}`);
    return false;
  }

  if (row.protocol === "v3") {
    if (!row.step_db_id || !row.story_db_id) {
      throw new Error("V3_OPERATIONAL_RETRY_STATE_IDENTITY_INCOMPLETE");
    }
    const activeAttempt = await createAttemptRepository(getSql()).findActive({ runId, stepId, storyId });
    if (!activeAttempt || activeAttempt.claimId !== claimId) {
      throw new Error("V3_OPERATIONAL_RETRY_ACTIVE_ATTEMPT_IDENTITY_MISMATCH");
    }
    const v3AttemptContext = await loadV3ImplementationAttemptContext({
      runId,
      storyId,
      attemptId: activeAttempt.attemptId,
    });
    if (activeAttempt.attemptClass === "infrastructure_retry") {
      const priorDirective = parseOperationalRetryDirectiveStoryOutput(row.story_output);
      if (
        !priorDirective
        || priorDirective.directiveHash !== v3AttemptContext.operationalRetry?.directive.directiveHash
      ) {
        throw new Error("V3_OPERATIONAL_RETRY_STORY_AUTHORITY_MISMATCH");
      }
      const exhaustedDiagnostic = `${diagnostic}\nOPERATIONAL_RETRY_EXHAUSTED: typed fallback ${priorDirective.retryBudget.ordinal}/${priorDirective.retryBudget.limit} failed; unchanged-source redispatch is forbidden.`;
      let closed;
      try {
        closed = await pgBegin((sql) => terminalizeOperationalRetryExhaustionInTransaction(sql, {
          claimId,
          attemptId: activeAttempt.attemptId,
          attemptGeneration: activeAttempt.generation,
          runId,
          stepId,
          stepDbId: row.step_db_id!,
          storyId,
          storyDbId: row.story_db_id!,
          agentId: claimAgentId,
          diagnostic: exhaustedDiagnostic,
          directive: priorDirective,
        }));
      } catch (error) {
        if (isClaimMutationAuthorityError(error)) return false;
        throw error;
      }
      if (closed.status !== "closed") return false;
      await releaseReservedRuntimeForClaimIfPresent(claimId, exhaustedDiagnostic);
      await discardRuntimeGuardRetryWorktree(runId, storyId, claimAgentId, exhaustedDiagnostic);
      await recordObservation({
        runId,
        stepId,
        storyId,
        agentId: claimAgentId,
        phase: "operational-retry",
        checkId: `operational_retry.exhausted:${priorDirective.directiveHash}`,
        label: "Operational retry exhausted",
        status: "blocked",
        summary: "The one exact Kimi fallback failed; another unchanged-source model dispatch was refused.",
        detail: exhaustedDiagnostic,
        evidence: {
          schema: "setfarm.operational-retry-exhaustion-evidence.v1",
          directiveHash: priorDirective.directiveHash,
          failedAttemptId: activeAttempt.attemptId,
          failedAttemptGeneration: activeAttempt.generation,
          packetHash: activeAttempt.packetHash,
          sliceHash: activeAttempt.sliceHash,
          sourceRevision: activeAttempt.sourceBefore,
        },
        metadata: {
          failureCode: runtimeGuardDiagnosticKey(diagnostic),
          recoveryOwner: "platform-terminal",
        },
        eventType: "operational-retry.exhausted",
        completedAt: new Date().toISOString(),
      });
      await checkRuntimeGuardLoopContinuation(runId, stepId);
      console.warn(`[spawner] exhausted typed operational retry for ${storyId}; refused another unchanged-source dispatch`);
      return true;
    }
    if (activeAttempt.attemptClass !== "product_implementation") {
      throw new Error(`V3_OPERATIONAL_RETRY_ATTEMPT_CLASS_INVALID:${activeAttempt.attemptClass}`);
    }
    const directive = createOperationalRetryDirectiveV1({
      runId,
      stepId,
      storyId,
      priorAttempt: {
        claimId,
        attemptId: v3AttemptContext.attempt.attemptId,
        generation: v3AttemptContext.attempt.generation,
        attemptClass: "product_implementation",
        packetHash: v3AttemptContext.packetHash,
        sliceHash: v3AttemptContext.sliceHash,
        sourceBefore: v3AttemptContext.sourceBefore,
        terminalDisposition: "inconclusive",
      },
      failure: {
        code: runtimeGuardDiagnosticKey(diagnostic),
        diagnostic: diagnostic.slice(0, 8_000),
      },
      nextSourceRevision: v3AttemptContext.sourceBefore,
      allowedPaths: v3AttemptContext.slice.files
        .filter((file) => file.role === "owned" || file.role === "shared_writable")
        .map((file) => file.path),
    });
    let closed;
    try {
      closed = await pgBegin(async (sql) => {
        const acquired = await publishOperationalRetryDirectiveInTransaction(sql, {
          claimId,
          attemptId: v3AttemptContext.attempt.attemptId,
          attemptGeneration: v3AttemptContext.attempt.generation,
          runId,
          stepId,
          stepDbId: row.step_db_id!,
          storyId,
          storyDbId: row.story_db_id!,
          agentId: claimAgentId,
          diagnostic,
          directive,
        });
        if (acquired.status !== "closed") return acquired;
        // The exact claim/attempt fence is now closed under the uncommitted
        // transaction. Reset source before pending state becomes observable.
        await discardV3OperationalRetryWorktree(
          runId,
          storyId,
          claimAgentId,
          diagnostic,
          directive.nextSourceRevision.sha,
        );
        return acquired;
      });
    } catch (error) {
      if (isClaimMutationAuthorityError(error)) return false;
      throw error;
    }
    if (closed.status !== "closed") return false;
    await releaseReservedRuntimeForClaimIfPresent(claimId, diagnostic);
    await recordObservation({
      runId,
      stepId,
      storyId,
      agentId: claimAgentId,
      phase: "operational-retry",
      checkId: `operational_retry.directive:${directive.directiveHash}`,
      label: "Operational retry directive",
      status: "retry",
      summary: `${directive.failure.code} authorized one exact Kimi fallback against the reset source.`,
      detail: directive.failure.diagnostic,
      evidence: directive,
      metadata: {
        directiveHash: directive.directiveHash,
        priorAttemptId: directive.priorAttempt.attemptId,
        failureCode: directive.failure.code,
        providerId: directive.executionProfile.providerId,
        modelId: directive.executionProfile.modelId,
      },
      eventType: "operational-retry.authorized",
      completedAt: new Date().toISOString(),
    });
    setRuntimeGuardRequeueCooldown(runtimeAgentId, diagnostic);
    console.warn(`[spawner] published typed operational retry for ${storyId}; claim=${claimAgentId} runtime=${runtimeAgentId}`);
    return true;
  }

  if (row.story_db_id && row.protocol !== "v3") {
    const repeatDecision = await runtimeGuardRepeatDecision(runId, stepId, storyId, claimAgentId, diagnostic);
    if (repeatDecision.hardFail) {
      const hardDiagnostic = `${diagnostic}\nRUNTIME_GUARD_REPEAT_LIMIT: ${repeatDecision.key} repeated ${repeatDecision.previousCount + 1}/${RUNTIME_GUARD_REPEAT_LIMIT} time(s) for ${storyId}; blocking the story instead of requeueing indefinitely.`;
      let closed;
      try {
        closed = await closeClaimAndBoundAttempt(getSql(), {
          claimId,
          runId,
          stepId,
          storyId,
          agentId: claimAgentId,
          outcome: "failed",
          diagnostic: hardDiagnostic,
          recoveryAuthority: "orphan_recovery",
        });
      } catch (error) {
        if (isClaimMutationAuthorityError(error)) return false;
        throw error;
      }
      if (closed.status !== "closed") return false;
      await releaseReservedRuntimeForClaimIfPresent(claimId, hardDiagnostic);
      await discardRuntimeGuardRetryWorktree(runId, storyId, claimAgentId, hardDiagnostic);
      await pgRun(
        "UPDATE stories SET status = 'failed', claimed_by = NULL, output = $2, updated_at = NOW() WHERE id = $1 AND status IN ('running','pending')",
        [row.story_db_id, hardDiagnostic],
      );
      await pgRun("UPDATE steps SET status = 'waiting', current_story_id = NULL, updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('pending','running','waiting')", [runId, stepId]);
      await recordSupervisorRuntimeEvent(runId, stepId, row.story_db_id, "RUNTIME_GUARD_REPEAT_LIMIT", "runtime-guard-repeat-limit", hardDiagnostic);
      await checkRuntimeGuardLoopContinuation(runId, stepId);
      console.warn(`[spawner] blocked repeated runtime guard ${repeatDecision.key} for ${storyId}: ${repeatDecision.previousCount + 1}/${RUNTIME_GUARD_REPEAT_LIMIT}`);
      return true;
    }
  }

  // Close the exact claim and its shadow attempt before exposing retryable
  // story/step state. This prevents the next claim from racing an active fence.
  let closed;
  try {
    closed = await closeClaimAndBoundAttempt(getSql(), {
      claimId,
      runId,
      stepId,
      storyId,
      agentId: claimAgentId,
      outcome: "infra_retry",
      diagnostic,
      recoveryAuthority: "orphan_recovery",
    });
  } catch (error) {
    if (isClaimMutationAuthorityError(error)) return false;
    throw error;
  }
  if (closed.status !== "closed") return false;
  await releaseReservedRuntimeForClaimIfPresent(claimId, diagnostic);
  await discardRuntimeGuardRetryWorktree(runId, storyId, claimAgentId, diagnostic);

  if (row.story_db_id) {
    // Runtime guard retries are manager/discipline failures, not semantic story
    // failures. Keep the diagnostic, but preserve both story retry and abandon
    // budgets for real build/design/verify feedback and crash recovery.
    const storyOutput = preserveActionableStoryRetryOutput(row.story_output, diagnostic);
    await pgRun(
      "UPDATE stories SET status = 'pending', claimed_by = NULL, output = $2, updated_at = NOW() WHERE id = $1 AND status IN ('running','pending')",
      [row.story_db_id, storyOutput],
    );
  }
  await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('pending','running','waiting')", [runId, stepId]);
  setRuntimeGuardRequeueCooldown(runtimeAgentId, diagnostic);
  console.warn(`[spawner] requeued open story claim ${storyId} for claim=${claimAgentId} runtime=${runtimeAgentId}: ${diagnostic.slice(0, 180)}`);
  return true;
}

async function discardV3OperationalRetryWorktree(
  runId: string,
  storyId: string,
  agentId: string,
  diagnostic: string,
  expectedBaseSha: string,
): Promise<void> {
  const ctx = await getRunContext(runId);
  if (!ctx["repo"]) throw new Error("V3_OPERATIONAL_RETRY_REPO_UNAVAILABLE");
  const storyBranch = `${runId.slice(0, 8)}-${storyId}`.toLowerCase();
  discardRuntimeGuardSiblingArtifacts(storyBranch, diagnostic);
  discardStoryWorktreeAndResetBranchExact(
    ctx["repo"],
    storyBranch,
    expectedBaseSha,
    agentId,
  );
  console.warn(`[spawner] proved exact v3 retry reset for ${storyBranch} at ${expectedBaseSha.slice(0, 12)}`);
}

async function discardRuntimeGuardRetryWorktree(runId: string, storyId: string, agentId: string, diagnostic: string): Promise<void> {
  try {
    const ctx = await getRunContext(runId);
    if (!ctx["repo"]) return;
    const storyBranch = `${runId.slice(0, 8)}-${storyId}`.toLowerCase();
    const baseRef = ctx["implement_base_commit"] || ctx["story_base_ref"] || ctx["branch"] || "main";
    discardRuntimeGuardSiblingArtifacts(storyBranch, diagnostic);
    discardStoryWorktreeAndResetBranch(ctx["repo"], storyBranch, baseRef, agentId);
    console.warn(`[spawner] discarded guarded retry worktree ${storyBranch} before requeue: ${diagnostic.slice(0, 160)}`);
  } catch (err) {
    console.warn(`[spawner] guarded retry worktree discard failed for ${storyId}: ${String(err).slice(0, 220)}`);
  }
}

function discardRuntimeGuardSiblingArtifacts(storyBranch: string, diagnostic: string): void {
  const attempted = diagnostic.match(/attempted\s+\S+\s+on\s+([^,\s]+),/i)?.[1];
  if (!attempted || !attempted.startsWith("..")) return;
  const canonicalWorktree = path.join(AGENT_SAFE_CWD, "story-worktrees", storyBranch);
  const storyWorktreesRoot = path.dirname(canonicalWorktree);
  const resolved = path.resolve(canonicalWorktree, attempted);
  if (!resolved.startsWith(`${storyWorktreesRoot}${path.sep}`)) return;
  if (resolved === canonicalWorktree || resolved.startsWith(`${canonicalWorktree}${path.sep}`)) return;
  const relative = path.relative(storyWorktreesRoot, resolved);
  const sibling = relative.split(path.sep)[0] || "";
  const branchParts = storyBranch.split("-");
  const runStoryPrefix = branchParts.length >= 2 ? `${branchParts[0]}-${branchParts[1]}-` : `${storyBranch}-`;
  if (!sibling.startsWith(`${storyBranch}-`) && !sibling.startsWith(`${storyBranch}.`) && !sibling.startsWith(runStoryPrefix)) return;
  const siblingPath = path.join(storyWorktreesRoot, sibling);
  try {
    fs.rmSync(siblingPath, { recursive: true, force: true });
    console.warn(`[spawner] discarded guarded retry sibling artifact ${sibling}`);
  } catch (err) {
    console.warn(`[spawner] guarded retry sibling artifact discard failed for ${sibling}: ${String(err).slice(0, 180)}`);
  }
}

async function tryRecoverOrphanedRunningImplementWork(row: {
  story_db_id: string;
  story_id: string;
  story_title: string;
  story_branch: string | null;
  run_id: string;
  step_db_id: string | null;
  step_id: string | null;
  agent_id?: string | null;
}): Promise<boolean> {
  if (!row.step_db_id || row.step_id !== "implement") return false;
  const runProtocol = await pgGet<{ protocol: string }>(
    "SELECT protocol FROM runs WHERE id = $1 LIMIT 1",
    [row.run_id],
  );
  // Startup orphan recovery follows the same v3 owner as live process exits:
  // never commit source and synthesize an agent proposal; let the caller
  // publish one bounded typed operational retry from the reset source.
  if (runProtocol?.protocol === "v3") return false;

  const storyBranch = (row.story_branch || `${row.run_id.slice(0, 8)}-${row.story_id}`).toLowerCase();
  const contextRow = await pgGet<{ context: string | null }>("SELECT context FROM runs WHERE id = $1 LIMIT 1", [row.run_id]);
  let context: Record<string, string> = {};
  try {
    context = contextRow?.context ? JSON.parse(contextRow.context) : {};
  } catch {
    context = {};
  }

  const workdirCandidates = [
    safeAgentCwdFromCandidate(context["story_workdir"]),
    context["repo"] ? findWorktreeByBranch(context["repo"], storyBranch) : null,
  ].filter((candidate): candidate is string => !!candidate);
  const workdir = [...new Set(workdirCandidates)].find((candidate) => {
    const branch = gitOutput(candidate, ["branch", "--show-current"]);
    return branch?.toLowerCase() === storyBranch;
  });
  if (!workdir) return false;

  const baseRef = findDiffBaseRef(workdir);
  if (!baseRef) return false;
  const changedFiles = sourceTouchedFiles(workdir, baseRef).slice(0, 20);
  if (changedFiles.length === 0) return false;
  if (!runBuildGate(workdir)) return false;
  const recoveryCommit = commitRecoveredImplementWorkThroughScopeGate(workdir, row.story_id, row.story_title);
  if (!recoveryCommit.sha) {
    console.warn(`[spawner] orphan implement recovery scope gate blocked ${row.story_id}: ${recoveryCommit.error}`);
    return false;
  }

  context["story_workdir"] = workdir;
  context["story_branch"] = storyBranch;
  await pgRun("UPDATE runs SET context = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(context), row.run_id]);

  const recoveryOutput = [
    "STATUS: done",
    `STORY_BRANCH: ${storyBranch}`,
    `CHANGES: Recovered ${row.story_id} after spawner restart found build-passing scoped work on ${storyBranch}. Commit: ${recoveryCommit.sha}.`,
    "BUILD_CMD: npm run build",
    "RECOVERY: orphaned-running-story-build-and-scope-passing",
    `RECOVERY_COMMIT: ${recoveryCommit.sha}`,
    `CHANGED_FILES: ${(recoveryCommit.stagedFiles.length > 0 ? recoveryCommit.stagedFiles : changedFiles).join(", ")}`,
    "PR_URL:",
  ].join("\n");

  const recoveryIntent = classifyOperationalRecoveryIntent("orphaned-running-implement-build-scope-passing");
  if (recoveryIntent === "project_rescue") return false;
  await recordObservation({
    runId: row.run_id,
    stepId: row.step_id,
    storyId: row.story_id,
    phase: "operations",
    checkId: `operational_recovery:${recoveryIntent}:orphaned_running_implement`,
    label: "Operational recovery classified",
    status: "info",
    summary: `Spawner classified orphaned implement recovery as ${recoveryIntent}.`,
    detail: `Recovered ${row.story_id} after spawner restart found build-passing scoped work on ${storyBranch}. Evidence was preserved and Setfarm will continue through normal gates.`,
    eventType: "operational_recovery",
    filePaths: recoveryCommit.stagedFiles.length > 0 ? recoveryCommit.stagedFiles : changedFiles,
    metadata: {
      recoveryIntent,
      source: "orphaned-running-implement-build-scope-passing",
      storyBranch,
      recoveryCommit: recoveryCommit.sha,
    },
  });

  const recoveryEnvelope = await recoverClaimEnvelopeFromDatabase({
    runId: row.run_id,
    stepDbId: row.step_db_id,
    workflowStepId: row.step_id,
    storyId: row.story_id,
    storyDbId: row.story_db_id,
    ...(row.agent_id ? { claimAgentId: row.agent_id } : {}),
    runtimeAgentId: "spawner-startup-recovery",
    workdir,
  });
  const result = await completeStep(row.step_db_id, recoveryOutput, recoveryEnvelope);
  if (!result.advanced && !result.runCompleted) {
    const refreshed = await pgGet<{ status: string }>("SELECT status FROM stories WHERE id = $1 LIMIT 1", [row.story_db_id]);
    if (!["done", "verified"].includes(refreshed?.status || "")) return false;
  }
  await releaseReservedRuntimeForClaimIfPresent(
    recoveryEnvelope!.claimId,
    "Orphaned implementation recovery completed after proven runtime quiescence",
  );
  console.warn(`[spawner] recovered orphaned running implement story ${row.story_id}: build passed in ${workdir}`);
  return true;
}

async function requeueOrphanedRunningStories(): Promise<void> {
  const thresholdMs = Math.max(0, ORPHANED_SINGLE_STEP_CLAIM_MS);
  // Process-map absence is advisory. Any active completion, termination,
  // quarantine, or recovery delivery remains the durable lifecycle owner.
  const rows = await pgQuery<{ story_db_id: string; story_id: string; story_title: string; story_branch: string | null; run_id: string; run_number: number; step_db_id: string | null; step_id: string | null; step_status: string | null; agent_id: string | null; claim_step_id: string | null }>(
    `SELECT st.id as story_db_id, st.story_id, st.title as story_title, st.story_branch, st.run_id, r.run_number,
            loop_step.id as step_db_id, loop_step.step_id, loop_step.status as step_status,
            cl.agent_id, cl.step_id as claim_step_id
     FROM stories st
     JOIN runs r ON r.id = st.run_id
     LEFT JOIN claim_log cl ON cl.run_id = st.run_id AND cl.story_id = st.story_id AND cl.outcome IS NULL
     LEFT JOIN steps loop_step ON loop_step.run_id = st.run_id AND loop_step.type = 'loop'
     WHERE st.status = 'running'
       AND r.status = 'running'
       AND NOT EXISTS (
         SELECT 1 FROM runtime_completion_requests completion
          WHERE completion.claim_id = cl.id
            AND completion.state NOT IN ('accepted', 'rejected')
       )
       AND NOT EXISTS (
         SELECT 1 FROM runtime_sessions runtime
          WHERE runtime.claim_id = cl.id
            AND runtime.state = 'quarantined'
       )
       AND NOT EXISTS (
         SELECT 1 FROM recovery_dispatch_deliveries recovery_delivery
          WHERE recovery_delivery.run_id = st.run_id
            AND recovery_delivery.story_id = st.story_id
            AND recovery_delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
       )
       AND NOT EXISTS (
         SELECT 1 FROM run_termination_requests termination
          WHERE termination.run_id = st.run_id
            AND termination.state <> 'terminalized'
       )
       AND st.updated_at <= NOW() - ($1::int * interval '1 millisecond')
       AND (
         loop_step.id IS NULL
         OR loop_step.updated_at <= NOW() - ($1::int * interval '1 millisecond')
       )
       AND (
         loop_step.id IS NULL
         OR loop_step.status <> 'running'
         OR loop_step.current_story_id IS DISTINCT FROM st.id
         OR cl.agent_id IS NULL
       )
     ORDER BY st.updated_at ASC
     LIMIT 20`,
    [thresholdMs],
  );

  for (const row of rows) {
    const trackedByActiveProcess = hasTrackedClaimRuntime((active) =>
      active.runId === row.run_id
      && (active.storyDbId === row.story_db_id || active.storyId === row.story_id)
      && (!row.agent_id || active.claimAgentId === row.agent_id)
    );
    if (trackedByActiveProcess) {
      console.log(`[spawner] preserving running story ${row.story_id} for run #${row.run_number}: active ${row.agent_id || "agent"} process is still tracked`);
      continue;
    }

    try {
      if (row.agent_id) {
        await waitForClaimRuntimeQuiescence(row.run_id, row.story_id, row.agent_id);
      }
      if (await tryRecoverOrphanedRunningImplementWork(row)) continue;
    } catch (recoveryErr) {
      console.warn(`[spawner] orphaned running implement recovery failed for ${row.story_id}: ${String(recoveryErr).slice(0, 300)}`);
    }

    const diagnostic = row.agent_id
      ? `ORPHANED_RUNNING_STORY: ${row.story_id} was running but loop step ${row.step_id || "(missing)"} is ${row.step_status || "(missing)"} or no longer points at story`
      : `ORPHANED_RUNNING_STORY: ${row.story_id} was running without an open claim; retrying instead of leaving the run idle`;
    if (row.agent_id && row.claim_step_id) {
      await requeueOpenStoryClaim(
        row.run_id,
        row.claim_step_id,
        row.story_id,
        row.agent_id,
        diagnostic,
      );
      continue;
    }
    const hiddenOwner = await pgGet<{ owner_count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM runtime_sessions rs
           WHERE rs.run_id = $1 AND rs.story_id = $2 AND rs.state <> 'released')
         +
         (SELECT COUNT(*) FROM execution_attempts ea
           WHERE ea.run_id = $1 AND ea.story_id = $2 AND ea.disposition IN ('claimed', 'running'))
       )::text AS owner_count`,
      [row.run_id, row.story_id],
    );
    if (Number(hiddenOwner?.owner_count || "0") > 0) {
      console.warn(`[spawner] quarantining ownerless-looking story ${row.story_id}; durable runtime/attempt authority still exists`);
      continue;
    }
    await pgRun("UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'", [row.story_db_id]);
    if (row.step_db_id) {
      await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE id = $1 AND status IN ('pending','waiting','running')", [row.step_db_id]);
    }
    console.warn(`[spawner] requeued orphaned running story for run #${row.run_number}: ${row.story_id}`);
  }
}

async function requeueUntrackedRunningLoopStoryClaims(): Promise<void> {
  const thresholdMs = Math.max(0, ORPHANED_SINGLE_STEP_CLAIM_MS);
  // Keep the same durable-owner fence as requeueOrphanedRunningStories.
  const rows = await pgQuery<{ story_db_id: string; story_id: string; story_title: string; story_branch: string | null; run_id: string; run_number: number; step_db_id: string; step_id: string; agent_id: string; claimed_at: string }>(
    `SELECT st.id as story_db_id, st.story_id, st.title as story_title, st.story_branch,
            st.run_id, r.run_number, loop_step.id as step_db_id, loop_step.step_id,
            cl.agent_id, cl.claimed_at
     FROM stories st
     JOIN runs r ON r.id = st.run_id
     JOIN steps loop_step
       ON loop_step.run_id = st.run_id
      AND loop_step.type = 'loop'
      AND loop_step.status = 'running'
      AND loop_step.current_story_id = st.id
     JOIN claim_log cl
       ON cl.run_id = st.run_id
      AND cl.step_id = loop_step.step_id
      AND cl.story_id = st.story_id
      AND cl.outcome IS NULL
     WHERE st.status = 'running'
       AND r.status = 'running'
       AND NOT EXISTS (
         SELECT 1 FROM runtime_completion_requests completion
          WHERE completion.claim_id = cl.id
            AND completion.state NOT IN ('accepted', 'rejected')
       )
       AND NOT EXISTS (
         SELECT 1 FROM runtime_sessions runtime
          WHERE runtime.claim_id = cl.id
            AND runtime.state = 'quarantined'
       )
       AND NOT EXISTS (
         SELECT 1 FROM recovery_dispatch_deliveries recovery_delivery
          WHERE recovery_delivery.run_id = st.run_id
            AND recovery_delivery.story_id = st.story_id
            AND recovery_delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
       )
       AND NOT EXISTS (
         SELECT 1 FROM run_termination_requests termination
          WHERE termination.run_id = st.run_id
            AND termination.state <> 'terminalized'
       )
       AND cl.claimed_at <= NOW() - ($1::int * interval '1 millisecond')
       AND loop_step.updated_at <= NOW() - ($1::int * interval '1 millisecond')
       AND st.updated_at <= NOW() - ($1::int * interval '1 millisecond')
     ORDER BY cl.claimed_at ASC
     LIMIT 20`,
    [thresholdMs],
  );

  for (const row of rows) {
    const tracked = hasTrackedClaimRuntime((active) =>
      active.runId === row.run_id
      && active.stepId === row.step_db_id
      && (active.storyDbId === row.story_db_id || active.storyId === row.story_id)
      && active.claimAgentId === row.agent_id
    );
    if (tracked) continue;

    try {
      await waitForClaimRuntimeQuiescence(row.run_id, row.story_id, row.agent_id);
      if (await tryRecoverOrphanedRunningImplementWork(row)) continue;
    } catch (recoveryErr) {
      console.warn(`[spawner] untracked loop implement recovery failed for ${row.story_id}: ${String(recoveryErr).slice(0, 300)}`);
    }

    const claimedAtMs = new Date(row.claimed_at).getTime();
    const ageMs = Number.isFinite(claimedAtMs) ? Date.now() - claimedAtMs : thresholdMs;
    const diagnostic = `UNTRACKED_RUNNING_LOOP_STORY: ${row.agent_id} has an open ${row.step_id}/${row.story_id} claim for ${formatDurationMs(ageMs)} but no active spawner process is tracking it; retrying instead of leaving the run idle.`;
    if (await requeueOpenStoryClaim(row.run_id, row.step_id, row.story_id, row.agent_id, diagnostic)) {
      console.warn(`[spawner] requeued untracked loop story claim for run #${row.run_number}: ${row.step_id}/${row.story_id}/${row.agent_id}`);
    }
  }
}

async function requeueUntrackedRunningSingleStepClaims(): Promise<void> {
  const thresholdMs = Math.max(0, ORPHANED_SINGLE_STEP_CLAIM_MS);
  const rows = await pgQuery<{ claim_id: string; step_db_id: string; step_id: string; run_id: string; run_number: number; agent_id: string; claimed_at: string }>(
    `SELECT cl.id::text AS claim_id, s.id as step_db_id, s.step_id, s.run_id, r.run_number, s.agent_id, cl.claimed_at
     FROM steps s
     JOIN runs r ON r.id = s.run_id
     JOIN claim_log cl
       ON cl.run_id = s.run_id
      AND cl.step_id = s.step_id
      AND cl.story_id IS NULL
      AND cl.agent_id = s.agent_id
      AND cl.outcome IS NULL
     WHERE s.status = 'running'
       AND s.type <> 'loop'
       AND r.status = 'running'
       AND NOT EXISTS (
         SELECT 1 FROM runtime_completion_requests completion
          WHERE completion.claim_id = cl.id
            AND completion.state NOT IN ('accepted', 'rejected')
       )
       AND NOT EXISTS (
         SELECT 1 FROM runtime_sessions runtime
          WHERE runtime.claim_id = cl.id
            AND runtime.state = 'quarantined'
       )
       AND NOT EXISTS (
         SELECT 1 FROM run_termination_requests termination
          WHERE termination.run_id = s.run_id
            AND termination.state <> 'terminalized'
       )
       AND cl.claimed_at <= NOW() - ($1::int * interval '1 millisecond')
       AND s.updated_at <= NOW() - ($1::int * interval '1 millisecond')
     ORDER BY cl.claimed_at ASC
     LIMIT 20`,
    [thresholdMs],
  );

  for (const row of rows) {
    const tracked = hasTrackedClaimRuntime((active) =>
      active.runId === row.run_id
      && active.stepId === row.step_db_id
      && active.claimAgentId === row.agent_id
    );
    if (tracked) continue;

    const claimedAtMs = new Date(row.claimed_at).getTime();
    const ageMs = Number.isFinite(claimedAtMs) ? Date.now() - claimedAtMs : thresholdMs;
    const diagnostic = `UNTRACKED_RUNNING_SINGLE_STEP: ${row.agent_id} has an open ${row.step_id} claim for ${formatDurationMs(ageMs)} but no active spawner process is tracking it; retrying instead of leaving the run idle.`;
    try {
      await waitForClaimRuntimeQuiescence(row.run_id, undefined, row.agent_id);
      await retrySingleStepClaimWithAuthority({
        runId: row.run_id,
        stepDbId: row.step_db_id,
        workflowStepId: row.step_id,
        claimAgentId: row.agent_id,
        runtimeAgentId: "spawner-untracked-recovery",
        diagnostic,
      });
      await releaseReservedRuntimeForClaimIfPresent(Number(row.claim_id), diagnostic);
    } catch (error) {
      if (isClaimMutationAuthorityError(error)) continue;
      throw error;
    }
    console.warn(`[spawner] requeued untracked single-step claim for run #${row.run_number}: ${row.step_id}/${row.agent_id}`);
  }
}

async function reconcileTerminalClaimRuntimeOwnership(): Promise<void> {
  const reconciler = createPostgresTerminalClaimRuntimeReconciler(getSql(), {
    drain: (session, candidate) => drainDurableRuntimeSession(session, {
      requestId: `terminal-claim-${candidate.claimId}-${candidate.sessionId}`,
      authorityRef: `setfarm://terminal-claim-runtime-reconciler/claim/${candidate.claimId}`,
    }),
    emit: async (event: TerminalClaimRuntimeReconcileEvent) => {
      if (event.code === "TERMINAL_CLAIM_RUNTIME_RECONCILE_FAILED") {
        console.warn(
          `[spawner] terminal claim runtime reconciliation failed for claim=${event.claimId} runtime=${event.sessionId}: ${event.diagnostic || "unknown"}`,
        );
        return;
      }
      if (event.code === "TERMINAL_CLAIM_RUNTIME_ALREADY_SETTLED") return;
      emitEvent({
        ts: new Date().toISOString(),
        event: "runtime.released",
        runId: event.runId,
        detail: `Terminal claim runtime reconciler settled ${event.sessionId} for claim ${event.claimId} (${event.claimOutcome}); ${event.code}`,
      });
    },
  });
  const result = await reconciler.reconcile({ limit: 50 });
  if (result.released > 0 || result.alreadySettled > 0 || result.failed > 0) {
    console.warn(
      `[spawner] terminal claim runtime reconciliation scanned=${result.scanned} released=${result.released} alreadySettled=${result.alreadySettled} failed=${result.failed}`,
    );
  }
}

async function runClaimMaintenance(): Promise<void> {
  if (shuttingDown || claimMaintenanceInFlight) return;
  claimMaintenanceInFlight = true;
  try {
    await reapFinishedClaims();
    await reconcileTerminalClaimRuntimeOwnership();
    await requeueOrphanedRunningStories();
    await requeueUntrackedRunningLoopStoryClaims();
    await requeueUntrackedRunningSingleStepClaims();
  } catch (err) {
    console.warn(`[spawner] claim maintenance failed: ${String(err).slice(0, 300)}`);
  } finally {
    claimMaintenanceInFlight = false;
  }
}

async function cleanupRunningRunEphemeraOnStartup(): Promise<void> {
  try {
    const rows = await pgQuery<{ id: string }>(
      "SELECT id FROM runs WHERE status = 'running' ORDER BY updated_at DESC LIMIT 20",
    );
    for (const row of rows) {
      await cleanupProjectEphemera(row.id, "spawner-startup");
    }
  } catch (err) {
    console.warn(`[spawner] startup project cleanup failed: ${String(err).slice(0, 300)}`);
  }
}

async function reapFinishedClaims(): Promise<void> {
  for (const [key, active] of activeProcesses) {
    try {
      const row = await pgGet<{ step_status: string; run_status: string; step_id: string; run_id: string; type: string; current_story_id: string | null; story_id: string | null; story_status: string | null }>(
        `SELECT s.status as step_status, r.status as run_status, s.step_id, s.run_id, s.type, s.current_story_id, st.story_id, st.status as story_status
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         LEFT JOIN stories st ON st.id = s.current_story_id
         WHERE s.id = $1
         LIMIT 1`,
        [active.stepId],
      );
      if (!row) {
        console.warn(`[spawner] Reaping ${key}: claimed step disappeared`);
      } else if (row.run_status === "running" && row.step_status === "running") {
        const ageMs = Date.now() - active.startedAtMs;
        if (!await heartbeatRunningV3RecoveryOwner(active)) {
          const reason = `V3 recovery owner ${active.recoveryDispatchId ?? "unknown"} lost its exact bounded lease; terminating the local runtime while lifecycle reconciliation drains and terminalizes the durable owner chain.`;
          console.warn(`[spawner] ${reason}`);
          active.claimRecoveryOwned = true;
          terminateActiveProcess(active, "v3-recovery-owner-lease-lost", false);
          activeProcesses.delete(key);
          continue;
        }
        const loopStoryDone = row.type === "loop"
          && await loopStoryCompletedAfter(row.run_id, active.claimAgentId, active.storyDbId || row.current_story_id, active.startedAtMs);
        if (loopStoryDone) {
          console.log(`[spawner] Reaping completed loop agent ${key}: story completed; terminating leftover agent process`);
          terminateActiveProcess(active, "completed-loop-story");
          activeProcesses.delete(key);
          await finalizeExitedStoryRuntime(active);
          continue;
        }

        const effectiveStoryId = active.storyId || row.story_id || undefined;
        const effectiveStoryDbId = active.storyDbId || row.current_story_id || undefined;

        if (await reconcileTerminalOpenClawTask(
          active,
          key,
          row.step_id,
          effectiveStoryDbId || null,
        )) {
          continue;
        }

        if (row.type === "loop" && row.step_id === "implement" && effectiveStoryId && !isTerminalTestRole(active.role, active.agentId)) {
          const packageScopeDirty = implementPackageScopeDirtyGuard(active);
          if (packageScopeDirty.detected) {
            const reason = packageScopeDirty.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- PACKAGE SCOPE DIRTY GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "package-scope-dirty-guard", reason);
            terminateActiveProcess(active, "package-scope-dirty-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const scopeDirty = implementScopeDirtyGuard(active);
          if (scopeDirty.detected) {
            const reason = scopeDirty.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- SCOPE DIRTY GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "scope-dirty-guard", reason);
            terminateActiveProcess(active, "scope-dirty-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const scopeWrite = implementScopeWriteGuard(active);
          if (scopeWrite.detected) {
            const reason = scopeWrite.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- SCOPE WRITE GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "scope-write-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const retryPatchReapplied = implementRejectedRetryPatchRuntimeGuard(active);
          if (retryPatchReapplied.detected) {
            const reason = retryPatchReapplied.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- RETRY PATCH RUNTIME GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "RETRY_PATCH_REAPPLIED_RUNTIME_GUARD", "retry-patch-runtime-guard", reason);
            terminateActiveProcess(active, "retry-patch-runtime-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const gitDiscipline = implementGitDisciplineGuard(active);
          if (gitDiscipline.detected) {
            const reason = gitDiscipline.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- GIT DISCIPLINE GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "git-discipline-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const processCleanup = implementProcessCleanupGuard(active);
          if (processCleanup.detected) {
            const reason = processCleanup.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- PROCESS CLEANUP GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "process-cleanup-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const bootstrapCommand = implementBootstrapCommandGuard(active);
          if (bootstrapCommand.detected) {
            const reason = bootstrapCommand.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- BOOTSTRAP COMMAND GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "bootstrap-command-guard", reason);
            terminateActiveProcess(active, "bootstrap-command-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const unsupportedSummaryCommand = implementUnsupportedSetfarmSummaryCommandGuard(active);
          if (unsupportedSummaryCommand.detected) {
            const reason = unsupportedSummaryCommand.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- SETFARM SUMMARY COMMAND GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "setfarm-summary-command-guard", reason);
            terminateActiveProcess(active, "setfarm-summary-command-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const helperScriptRead = implementSetfarmHelperScriptReadGuard(active);
          if (helperScriptRead.detected) {
            const reason = helperScriptRead.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- SETFARM HELPER SCRIPT READ GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "setfarm-helper-script-read-guard", reason);
            terminateActiveProcess(active, "setfarm-helper-script-read-guard");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const maskedCheck = implementMaskedCheckCommandGuard(active);
          if (maskedCheck.detected) {
            const reason = maskedCheck.reason + ` Transcript: ${active.transcriptPath}`;
            if (active.protocol === "v3") {
              const observationKey = `v3-masked-check-advisory:${maskedCheck.reason.slice(0, 500)}`;
              active.supervisorSignals ||= new Set<string>();
              if (!active.supervisorSignals.has(observationKey)) {
                active.supervisorSignals.add(observationKey);
                console.warn(`[spawner] v3 advisory only; canonical Setfarm evidence remains authoritative: ${reason}`);
                try { fs.appendFileSync(active.transcriptPath, `--- MASKED CHECK COMMAND ADVISORY ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
                await recordObservation({
                  runId: active.runId,
                  stepId: row.step_id,
                  storyId: effectiveStoryId,
                  agentId: active.claimAgentId,
                  phase: "implementation-evidence",
                  checkId: `v3.masked_check.advisory:${active.attempt?.attemptId || active.claimId}`,
                  label: "Agent advisory check output was masked",
                  status: "info",
                  summary: "Candidate source was preserved; Setfarm-owned canonical evidence remains the only build/test verdict.",
                  detail: reason,
                  evidence: {
                    schema: "setfarm.v3-masked-check-advisory-evidence.v1",
                    attemptId: active.attempt?.attemptId || null,
                    candidateSourcePreserved: true,
                    authoritativeEvidenceOwner: "setfarm",
                  },
                  metadata: { code: "MASKED_CHECK_COMMAND", fatal: false },
                  eventType: "implementation.masked-check-advisory",
                  completedAt: new Date().toISOString(),
                });
              }
            } else {
              console.warn(`[spawner] ${reason}`);
              try { fs.appendFileSync(active.transcriptPath, `--- MASKED CHECK COMMAND GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
              await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "masked-check-command-guard", reason);
              terminateActiveProcess(active, "masked-check-command-guard");
              activeProcesses.delete(key);
              if (await completeActiveClaimFromOutputFile(active)) continue;
              await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
              continue;
            }
          }

          const claimParseLoop = claimParseLoopGuard(active);
          if (claimParseLoop.detected) {
            await recordRuntimeSupervisorSignal(active, row.step_id, effectiveStoryDbId || null, "claim-parse-loop-guard", "CLAIM PARSE LOOP", claimParseLoop.reason);
            await requeueRuntimeSupervisorSignal(active, key, row.step_id, effectiveStoryId, claimParseLoop.reason, "claim-parse-loop-guard");
            continue;
          }

          const referenceRead = implementReferenceReadGuard(active);
          if (referenceRead.detected) {
            await recordRuntimeSupervisorSignal(active, row.step_id, effectiveStoryDbId || null, "reference-read-guard", "REFERENCE READ", referenceRead.reason);
            await requeueRuntimeSupervisorSignal(active, key, row.step_id, effectiveStoryId, referenceRead.reason, "reference-read-guard");
            continue;
          }

          const generatedScreenRead = generatedScreenReadGuard(active);
          if (generatedScreenRead.detected) {
            await recordRuntimeSupervisorSignal(active, row.step_id, effectiveStoryDbId || null, "generated-screen-read-guard", "GENERATED SCREEN READ", generatedScreenRead.reason);
            await requeueRuntimeSupervisorSignal(active, key, row.step_id, effectiveStoryId, generatedScreenRead.reason, "generated-screen-read-guard");
            continue;
          }

          const rawStitchRead = rawStitchDesignReadGuard(active);
          if (rawStitchRead.detected) {
            await recordRuntimeSupervisorSignal(active, row.step_id, effectiveStoryDbId || null, "raw-stitch-read-guard", "RAW STITCH READ", rawStitchRead.reason);
            await requeueRuntimeSupervisorSignal(active, key, row.step_id, effectiveStoryId, rawStitchRead.reason, "raw-stitch-read-guard");
            continue;
          }

          const preDeltaCheck = implementPreDeltaCheckGuard(active);
          if (preDeltaCheck.detected) {
            await recordRuntimeSupervisorSignal(active, row.step_id, effectiveStoryDbId || null, "implement-pre-delta-check-guard", "IMPLEMENT PRE-DELTA CHECK", preDeltaCheck.reason);
            if (process.env.SETFARM_IMPLEMENT_PRE_DELTA_CHECK_FATAL === "1") {
              const reason = preDeltaCheck.reason + ` Transcript: ${active.transcriptPath}`;
              terminateActiveProcess(active, "implement-pre-delta-check");
              activeProcesses.delete(key);
              if (await completeActiveClaimFromOutputFile(active)) continue;
              await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
              continue;
            }
          }

          const preDeltaExploration = implementPreDeltaExplorationGuard(active);
          if (preDeltaExploration.detected) {
            await recordRuntimeSupervisorSignal(active, row.step_id, effectiveStoryDbId || null, "implement-pre-delta-context-guard", "IMPLEMENT PRE-DELTA CONTEXT", preDeltaExploration.reason);
            await requeueRuntimeSupervisorSignal(active, key, row.step_id, effectiveStoryId, preDeltaExploration.reason, "implement-pre-delta-context-guard");
            continue;
          }

          const noDeltaStall = implementNoDeltaStallGuard(active, ageMs);
          if (noDeltaStall.detected) {
            await recordRuntimeSupervisorSignal(active, row.step_id, effectiveStoryDbId || null, "implement-no-delta-stall", "IMPLEMENT NO DELTA STALL", noDeltaStall.reason);
            const reason = noDeltaStall.reason + ` Transcript: ${active.transcriptPath}`;
            terminateActiveProcess(active, "implement-no-delta-stall");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const postCheckOutputStall = implementPostCheckOutputStallGuard(active, ageMs);
          if (postCheckOutputStall.detected) {
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "IMPLEMENT_POST_CHECK_OUTPUT_STALL", "implement-post-check-output-stall", postCheckOutputStall.reason);
            const reason = postCheckOutputStall.reason + ` Transcript: ${active.transcriptPath}`;
            terminateActiveProcess(active, "implement-post-check-output-stall");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            try {
              const recoveryRow: RunningStepRow = {
                status: row.step_status,
                step_id: row.step_id,
                run_id: row.run_id,
                type: row.type,
                current_story_id: row.current_story_id,
              };
              if (await tryRecoverExitedImplementWork(active, recoveryRow, new Error(reason))) {
                await cleanupLatestCompletedClaimRuntime(active.runId, row.step_id, active.claimAgentId, active.spawnCwd);
                continue;
              }
            } catch (recoveryErr) {
              console.warn(`[spawner] post-check output stall recovery failed for ${active.wfId}/${active.role}: ${String(recoveryErr).slice(0, 300)}`);
            }
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }

          const retryHardTimeout = implementRetryHardTimeoutGuard(active, ageMs);
          if (retryHardTimeout.detected) {
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "IMPLEMENT_RETRY_HARD_TIMEOUT", "implement-retry-hard-timeout", retryHardTimeout.reason);
            const reason = retryHardTimeout.reason + ` Transcript: ${active.transcriptPath}`;
            terminateActiveProcess(active, "implement-retry-hard-timeout");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            try {
              const recoveryRow: RunningStepRow = {
                status: row.step_status,
                step_id: row.step_id,
                run_id: row.run_id,
                type: row.type,
                current_story_id: row.current_story_id,
              };
              if (await tryRecoverExitedImplementWork(active, recoveryRow, new Error(reason))) {
                await cleanupLatestCompletedClaimRuntime(active.runId, row.step_id, active.claimAgentId, active.spawnCwd);
                continue;
              }
            } catch (recoveryErr) {
              console.warn(`[spawner] retry timeout implement recovery failed for ${active.wfId}/${active.role}: ${String(recoveryErr).slice(0, 300)}`);
            }
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }
        }

        const terminalReason = childProcessTerminalReason(active.child);
        if (terminalReason) {
          const reason = `AGENT_PROCESS_TERMINAL: ${active.agentId} process ended while ${active.wfId}/${active.role} was still running (${terminalReason}); recovering claim. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- PROCESS TERMINAL ${new Date().toISOString()} ---
${reason}
`); } catch {}
          terminateActiveProcess(active, "process-terminal");
          activeProcesses.delete(key);
          await settleExitedClaimAndRuntime(active, new Error(reason));
          continue;
        }

        if (effectiveStoryId && row.type === "loop" && row.step_id === "implement") {
          const storyStillOwned = row.current_story_id === effectiveStoryDbId
            && row.story_id === effectiveStoryId
            && row.story_status === "running";
          if (!storyStillOwned) {
            const reason = `AGENT_STORY_STATE_MISMATCH: ${active.agentId} is still running ${effectiveStoryId}, but loop step points at ${row.story_id || "(none)"} (${row.story_status || "no-story"}); requeueing stale claim. Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- STORY STATE MISMATCH ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "story-state-mismatch");
            activeProcesses.delete(key);
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.claimAgentId, reason, active.agentId);
            continue;
          }
        }

        if (row.step_id === "verify" && !await verifyEachHasDoneStory(active.runId, row.step_id)) {
          console.log(`[spawner] Reaping stale verify agent ${key}: no done story awaits verify`);
          terminateActiveProcess(active, "verify-no-done-story");
          activeProcesses.delete(key);
          await pgRun("UPDATE steps SET status = 'waiting', updated_at = NOW() WHERE id = $1 AND status = 'running'", [active.stepId]);
          continue;
        }

        if (row.step_id === "verify") {
          const boundedReview = verifyBoundedReviewGuard(active, ageMs);
          if (boundedReview.detected) {
            const reason = boundedReview.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- VERIFY BOUNDED REVIEW GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "VERIFY_BOUNDED_REVIEW_VIOLATION", "verify-bounded-review", reason);
            terminateActiveProcess(active, "verify-bounded-review");
            activeProcesses.delete(key);
            await retryActiveSingleStepClaim(active, row.step_id, reason);
            continue;
          }
        }

        if (row.step_id === "supervise") {
          const boundedAudit = supervisorBoundedAuditGuard(active, ageMs);
          if (boundedAudit.detected) {
            const reason = boundedAudit.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- SUPERVISOR BOUNDED AUDIT GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "SUPERVISOR_BOUNDED_AUDIT_VIOLATION", "supervisor-bounded-audit", reason);
            terminateActiveProcess(active, "supervisor-bounded-audit");
            activeProcesses.delete(key);
            await retryActiveSingleStepClaim(active, row.step_id, reason);
            continue;
          }
        }

        await updateRunningStepHeartbeat(active, row.step_id, ageMs);

        if (row.step_id === "verify" && ageMs >= VERIFY_AGENT_HARD_TIMEOUT_MS) {
          const reason = `VERIFY_AGENT_HARD_TIMEOUT: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without completing verify; retrying the verify step instead of leaving an open claim. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- VERIFY HARD TIMEOUT ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
          terminateActiveProcess(active, "verify-hard-timeout");
          activeProcesses.delete(key);
          await retryActiveSingleStepClaim(active, row.step_id, reason);
          continue;
        }

        if (ageMs >= AGENT_STARTUP_SILENCE_MS && !activeProcessHasStartupActivity(active)) {
          const reason = `AGENT_STARTUP_SILENT: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without transcript/output; agent runtime likely stuck before first model/tool turn. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- STARTUP SILENCE ${new Date().toISOString()} ---
${reason}
`); } catch {}
          terminateActiveProcess(active, "startup-silent");
          activeProcesses.delete(key);
          await settleExitedClaimAndRuntime(active, new Error(reason));
          continue;
        }

        if (ageMs >= AGENT_REPEATED_TOOL_LOOP_CHECK_AFTER_MS && !isTerminalTestRole(active.role, active.agentId)) {
          const transcriptLoop = repeatedTranscriptToolLoop(active);
          if (transcriptLoop.detected) {
            const reason = transcriptLoop.reason + "; retrying " + active.wfId + "/" + active.role +
              " instead of waiting on synthetic session activity. Transcript: " + active.transcriptPath;
            console.warn("[spawner] " + reason);
            try { fs.appendFileSync(active.transcriptPath, "--- SELF LOOP " + new Date().toISOString() + " ---\n" + reason + "\n"); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "AGENT_SELF_LOOP", "agent-self-loop", reason);
            terminateActiveProcess(active, "repeated-tool-loop");
            activeProcesses.delete(key);
            if (row.type === "loop" && active.storyId) {
              if (await completeActiveClaimFromOutputFile(active)) continue;
              await requeueOpenStoryClaim(active.runId, row.step_id, active.storyId, active.claimAgentId, reason, active.agentId);
            } else {
              await retryActiveSingleStepClaim(active, row.step_id, reason);
            }
            continue;
          }
        }

        if (ageMs >= AGENT_SELF_LOOP_CHECK_AFTER_MS && !isTerminalTestRole(active.role, active.agentId)) {
          const loop = repeatedSessionFileLoop(active);
          if (loop.detected) {
            const reason = loop.reason + "; retrying " + active.wfId + "/" + active.role +
              " instead of waiting on synthetic session activity. Transcript: " + active.transcriptPath;
            console.warn("[spawner] " + reason);
            try { fs.appendFileSync(active.transcriptPath, "--- SELF LOOP " + new Date().toISOString() + " ---\n" + reason + "\n"); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "AGENT_SELF_LOOP", "agent-self-loop", reason);
            terminateActiveProcess(active, "self-loop");
            activeProcesses.delete(key);
            if (row.type === "loop" && active.storyId) {
              if (await completeActiveClaimFromOutputFile(active)) continue;
              await requeueOpenStoryClaim(active.runId, row.step_id, active.storyId, active.claimAgentId, reason, active.agentId);
            } else {
              await retryActiveSingleStepClaim(active, row.step_id, reason);
            }
            continue;
          }
        }

        const promptIdleMs = Date.now() - activeProcessPromptActivityMs(active);
        if (ageMs >= AGENT_MODEL_TURN_STALL_MS && promptIdleMs >= AGENT_MODEL_TURN_STALL_MS) {
          const reason = `AGENT_MODEL_TURN_STALLED: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} but session/output/progress files have not changed for ${formatDurationMs(promptIdleMs)}; retrying instead of treating CPU activity as progress. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- MODEL TURN STALL ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
          terminateActiveProcess(active, "model-turn-stall");
          activeProcesses.delete(key);
          await settleExitedClaimAndRuntime(active, new Error(reason));
          continue;
        }

        const thresholdMs = stuckThresholdMs(active.role, row.story_id);
        if (ageMs < thresholdMs) continue;

        const idleMs = Date.now() - activeProcessLastActivityMs(active);
        if (idleMs < AGENT_ACTIVITY_GRACE_MS) {
          const hardDeadlineMs = thresholdMs + AGENT_ACTIVE_WATCHDOG_OVERRUN_MS;
          if (ageMs >= hardDeadlineMs) {
            const reason = `AGENT_PROCESS_HARD_STUCK: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} after exceeding watchdog threshold ${formatDurationMs(thresholdMs)} while still producing activity; killed by hard watchdog overrun. Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- HARD WATCHDOG ${new Date().toISOString()} ---
${reason}
`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "AGENT_PROCESS_HARD_STUCK", "watchdog-hard-stuck", reason);
            terminateActiveProcess(active, "watchdog-hard-stuck");
            activeProcesses.delete(key);
            await settleExitedClaimAndRuntime(active, new Error(reason));
            continue;
          }
          console.log(`[spawner] ${active.agentId} exceeded ${formatDurationMs(thresholdMs)} but is active (last activity ${formatDurationMs(idleMs)} ago); watchdog deferred`);
          continue;
        }

        const reason = `AGENT_PROCESS_STUCK: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without step complete/fail and no agent activity for ${formatDurationMs(idleMs)}; killed by spawner watchdog. Transcript: ${active.transcriptPath}`;
        console.warn(`[spawner] ${reason}`);
        try { fs.appendFileSync(active.transcriptPath, `--- WATCHDOG ${new Date().toISOString()} ---
${reason}
`); } catch {}
        terminateActiveProcess(active, "watchdog-stuck");
        activeProcesses.delete(key);
        await settleExitedClaimAndRuntime(active, new Error(reason));
        continue;
      } else {
        const ageMs = Date.now() - active.startedAtMs;
        const idleMs = activeProcessIdleMs(active);
        const terminalReason = childProcessTerminalReason(active.child);
        if (
          row.run_status === "running"
          && ["pending", "waiting"].includes(row.step_status)
          && !terminalReason
        ) {
          if (!await activeProcessHasOpenClaim(active, row.step_id)) {
            console.log(`[spawner] Reaping closed active process ${key}: step ${row.step_id} is ${row.step_status}, run is ${row.run_status}, and claim_log is already closed`);
            terminateActiveProcess(active, "step-state-closed-claim");
            activeProcesses.delete(key);
            await finalizeExitedStoryRuntime(active);
            continue;
          }
          const reason = `AGENT_STEP_STATE_MISMATCH: ${active.agentId} has an active ${active.wfId}/${active.role} process for ${row.step_id}, but the step is ${row.step_status}; retrying the open claim instead of waiting on a non-running step. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- STEP STATE MISMATCH ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
          terminateActiveProcess(active, "step-state-mismatch");
          activeProcesses.delete(key);
          if (row.type === "loop" && active.storyId) {
            if (await completeActiveClaimFromOutputFile(active)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, active.storyId, active.claimAgentId, reason, active.agentId);
          } else {
            await retryActiveSingleStepClaim(active, row.step_id, reason);
          }
          continue;
        }
        const nonRunningActiveGraceMs = Math.max(REAP_FINISHED_ACTIVE_GRACE_MS, stuckThresholdMs(active.role, active.storyId));
        if (row.run_status === "running" && row.step_status !== "running" && !terminalReason && ageMs < nonRunningActiveGraceMs) {
          console.log(`[spawner] Deferring reap for active ${key}: step ${row.step_id} is ${row.step_status}, run is ${row.run_status}, age ${formatDurationMs(ageMs)}`);
          continue;
        } else if (row.run_status === "running" && row.step_status !== "running") {
          console.warn(`[spawner] Reaping stale active process immediately for ${key}: step ${row.step_id} is ${row.step_status}, run is ${row.run_status}; retry must not wait on old process activity`);
        } else if (row.run_status === "running" && idleMs < REAP_FINISHED_ACTIVE_GRACE_MS) {
          console.log(`[spawner] Deferring reap for ${key}: step ${row.step_id} is ${row.step_status}, run is ${row.run_status}, but agent was active ${formatDurationMs(idleMs)} ago`);
          continue;
        } else {
          console.log(`[spawner] Reaping ${key}: step ${row.step_id} is ${row.step_status}, run is ${row.run_status}`);
        }
      }

      terminateActiveProcess(active, "reap-finished");
      activeProcesses.delete(key);
      await finalizeExitedStoryRuntime(active);
    } catch (err) {
      console.warn(`[spawner] reap finished claim ${key}: ${String(err).slice(0, 300)}`);
    }
  }
}

function spawnAgent(agentId: string, wfId: string, role: string): void {
  const key = `${wfId}:${role}:${agentId}`;
  if (runtimeUsageLimitCooldownUntil > Date.now()) {
    console.log(`[spawner] Runtime usage-limit cooldown active; retry ${key} in ${formatDurationMs(runtimeUsageLimitCooldownUntil - Date.now())}`);
    return;
  }
  const cooldownUntil = agentCooldownUntil.get(agentId) || 0;
  if (cooldownUntil > Date.now()) {
    console.log(`[spawner] Cooldown active for ${agentId}; retry in ${formatDurationMs(cooldownUntil - Date.now())}`);
    return;
  }
  if (activeProcesses.has(key) || claimingSpawns.has(key) || hasTrackedClaimRuntime((active) => `${active.wfId}:${active.role}:${active.agentId}` === key)) {
    console.log(`[spawner] Already running/claiming: ${key}, skip`);
    return;
  }
  if (queuedSpawns.has(key)) {
    console.log(`[spawner] Already queued: ${key}, skip`);
    return;
  }
  const nowMs = Date.now();
  const delayMs = Math.max(0, nextSpawnEarliest - nowMs);
  nextSpawnEarliest = nowMs + delayMs + SPAWN_STAGGER_MS;
  queuedSpawns.add(key);
  if (delayMs > 0) console.log(`[spawner] Queueing ${key} for ${delayMs}ms to stagger agent startup`);
  setTimeout(() => {
    queuedSpawns.delete(key);
    if (shuttingDown) return;
    trackSpawn(spawnAgentNow(agentId, wfId, role));
  }, delayMs);
}

function safeClaimScopeRelPath(raw: unknown): string {
  const rel = String(raw || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!rel || rel.includes("\0") || path.isAbsolute(rel)) return "";
  if (rel.split("/").some((part) => part === "..")) return "";
  return rel;
}

function recoveryDispatchClassForRole(
  role: string,
): "product_implementation" | "supervisor_repair" | undefined {
  if (role === "developer") return "product_implementation";
  if (role === "supervisor") return "supervisor_repair";
  return undefined;
}

function ensureClaimScopeParentDirs(workdir: string, claimSummary: Record<string, unknown>): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const root = path.resolve(workdir);
  const scopeFiles = Array.isArray(claimSummary.scopeFiles) ? claimSummary.scopeFiles : [];
  const created = new Set<string>();

  for (const raw of scopeFiles) {
    const rel = safeClaimScopeRelPath(raw);
    if (!rel) continue;
    const dir = path.dirname(rel);
    if (!dir || dir === ".") continue;
    const abs = path.resolve(root, dir);
    if (abs !== root && !abs.startsWith(root + path.sep)) continue;
    fs.mkdirSync(abs, { recursive: true });
    created.add(dir);
  }

  return [...created].sort();
}

async function spawnAgentNow(agentId: string, wfId: string, role: string): Promise<void> {
  const key = `${wfId}:${role}:${agentId}`;
  if (activeProcesses.has(key) || claimingSpawns.has(key) || hasTrackedClaimRuntime((active) => `${active.wfId}:${active.role}:${active.agentId}` === key)) {
    console.log(`[spawner] Already running/claiming: ${key}, skip`);
    return;
  }
  if (await shouldDeferBackgroundWorkflow(wfId)) {
    console.log(`[spawner] Deferring background workflow ${wfId}/${role}; foreground run is active`);
    queuedSpawns.add(key);
    setTimeout(() => {
      queuedSpawns.delete(key);
      if (!shuttingDown) trackSpawn(spawnAgentNow(agentId, wfId, role));
    }, WORKFLOW_DEFER_RETRY_MS);
    return;
  }
  const openClawCleanup = AGENT_RUNTIME === "openclaw"
    ? cleanupStaleSetfarmOpenClawTaskRecords("prespawn")
    : { sessions: 0, tasks: 0 };
  if (AGENT_RUNTIME === "openclaw" && !OPENCLAW_AGENT_LOCAL) await restartGatewayAfterOpenClawCleanup("prespawn", openClawCleanup);
  if (trackedRuntimeCount() >= MAX_CONCURRENT) {
    console.log(`[spawner] At capacity (${trackedRuntimeCount()}/${MAX_CONCURRENT}), skip ${agentId}`);
    return;
  }
  if (AGENT_RUNTIME === "openclaw" && !OPENCLAW_AGENT_LOCAL) {
    const gatewayReadiness = await getGatewayReadiness();
    if (!gatewayReadiness.ready) {
      maybeRestartGatewayForReadiness(gatewayReadiness.reason, key);
      console.warn(`[spawner] Gateway not ready (${gatewayReadiness.reason}; ${GATEWAY_READY_URL}); delaying ${key} for ${gatewayReadiness.retryAfterMs}ms`);
      queuedSpawns.add(key);
      setTimeout(() => {
        queuedSpawns.delete(key);
        if (!shuttingDown) trackSpawn(spawnAgentNow(agentId, wfId, role));
      }, gatewayReadiness.retryAfterMs);
      return;
    }
    if (!gatewayReadiness.reason.startsWith("gateway probe timeout bypass")) noteGatewayReady();
  }
  claimingSpawns.add(key);
  const spawnId = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const sessionId = "spawner-" + agentId + "-" + spawnId;
  const sessionKey = buildSessionKey(agentId, sessionId);
  const sessionJsonlPath = agentSessionJsonlPath(agentId, sessionId);
  const runtimeSessionId = newRuntimeSessionId();
  const transcriptTs = new Date().toISOString().replace(/[:.]/g, "-");
  const transcriptPath = path.join(TRANSCRIPT_ROOT, wfId, agentId + "-" + transcriptTs + ".log");
  const runtimeIntent: RuntimeClaimIntentV1 = {
    schema: "setfarm.runtime-claim-intent.v1",
    sessionId: runtimeSessionId,
    runtimeAgentId: agentId,
    runtimeKind: AGENT_RUNTIME === "openclaw" ? "openclaw_session" : "local_process",
    ownerInstanceId: SPAWNER_INSTANCE_ID,
    sessionKey,
    transcriptPath,
  };
  const outputFileId = agentId + "-spawner-" + spawnId;
  const claimFile = path.join("/tmp", "claim-" + outputFileId + ".json");
  const claimSummaryFile = path.join("/tmp", "claim-summary-" + outputFileId + ".json");
  const outputFile = path.join("/tmp", "setfarm-output-" + outputFileId + ".txt");
  const bootstrapFile = path.join("/tmp", "setfarm-claim-bootstrap-" + outputFileId + ".sh");
  try { fs.unlinkSync(outputFile); } catch { /* didnt exist, fine */ }
  try { fs.unlinkSync(claimFile); } catch { /* didnt exist, fine */ }
  try { fs.unlinkSync(claimSummaryFile); } catch { /* didnt exist, fine */ }
  try { fs.unlinkSync(bootstrapFile); } catch { /* didnt exist, fine */ }

  const fullAgentId = `${wfId}_${role}`;
  let claim: Awaited<ReturnType<typeof claimStep>>;
  try {
    const recoveryDispatchClass = recoveryDispatchClassForRole(role);
    claim = await claimStep(
      fullAgentId,
      agentId,
      runtimeIntent,
      recoveryDispatchClass
        ? { workflowId: wfId, recoveryDispatchClass }
        : undefined,
    );
  } catch (err) {
    claimingSpawns.delete(key);
    console.warn("[spawner] claim failed for " + fullAgentId + ": " + String(err));
    return;
  }
  if (!claim.found) {
    claimingSpawns.delete(key);
    console.log("[spawner] No claimable work for " + fullAgentId + ", skip spawn");
    return;
  }
  let postClaimOwnershipTransferred = false;
  let postClaimFailure: unknown;
  let preTransferChild: ReturnType<typeof spawn> | undefined;
  let preTransferOutFd: number | undefined;
  let preTransferErrFd: number | undefined;
  try {
  if (
    claim.runtimeSessionId !== runtimeSessionId
    || claim.runtimeOwnerInstanceId !== SPAWNER_INSTANCE_ID
  ) {
    claimingSpawns.delete(key);
    const diagnostic = "SPAWNER_RUNTIME_CLAIM_PUBLICATION_MISMATCH";
    const mismatchedSessions = createRuntimeSessionRepository(getSql());
    const observed = await mismatchedSessions.findById(claim.runtimeSessionId || runtimeSessionId);
    if (observed?.ownerInstanceId === SPAWNER_INSTANCE_ID) {
      await mismatchedSessions.quarantine({
        sessionId: observed.sessionId,
        expectedOwnerInstanceId: observed.ownerInstanceId,
        expectedStateVersion: observed.stateVersion,
        diagnostic,
        evidence: { expectedSessionId: runtimeSessionId, observedSessionId: claim.runtimeSessionId || null },
      });
    }
    console.warn(`[spawner] ${diagnostic}; claim left hidden for bounded recovery`);
    return;
  }
  if (typeof claim.resolvedInput === "string") {
    claim.resolvedInput = claim.resolvedInput
      .replace(/\[missing:\s*output_file_id\]/gi, outputFileId)
      .replace(/\[missing:\s*OUTPUT_FILE_ID\]/g, outputFileId);
  }
  const spawnCwd = safeAgentCwdFromClaimInput(claim.resolvedInput);
  let claimEnvelope: ClaimEnvelopeV1;
  try {
    claimEnvelope = runtimeClaimEnvelope(claim, agentId, spawnCwd);
  } catch (error) {
    claimingSpawns.delete(key);
    const reason = `CLAIM_ENVELOPE_HANDOFF_FAILED: ${String(error).slice(0, 300)}`;
    console.warn(`[spawner] ${reason}`);
    if (claim.runId) await recordSupervisorInfraEvent(claim.runId, "spawner", claim.storyDbId || null, reason);
    await releasePreSpawnClaim(claim, agentId, reason);
    return;
  }
  if (claim.storyId && spawnCwd === AGENT_SAFE_CWD) {
    claimingSpawns.delete(key);
    const reason = "CLAIM_WORKDIR_MISSING: story claim " + claim.storyId + " for " + fullAgentId + " did not resolve a project/story worktree from claim input. Refusing to spawn in agent scratch.";
    console.warn("[spawner] " + reason);
    if (claim.runId) await recordSupervisorInfraEvent(claim.runId, "spawner", claim.storyDbId || null, reason);
    await releasePreSpawnClaim(claim, agentId, reason);
    return;
  }
  if (!claim.storyId && claimRoleRequiresProjectCwd(role, agentId) && spawnCwd === AGENT_SAFE_CWD) {
    claimingSpawns.delete(key);
    const reason = "CLAIM_WORKDIR_MISSING: " + fullAgentId + " requires a project repository but did not resolve one from claim input. Refusing to spawn in agent scratch.";
    console.warn("[spawner] " + reason);
    if (claim.runId) await recordSupervisorInfraEvent(claim.runId, "spawner", null, reason);
    if (claim.stepId) await failStep(claim.stepId, reason, claimEnvelope);
    if (claim.claimId) await releaseReservedRuntimeForClaimIfPresent(claim.claimId, reason);
    return;
  }
  let claimSummary: Record<string, unknown>;
  let preparedScopeParentDirs: string[] = [];
  try {
    fs.writeFileSync(claimFile, JSON.stringify(claimEnvelope) + "\n", { mode: 0o600 });
    claimSummary = buildClaimSummary({
      wfId,
      role,
      claimFile,
      outputFile,
      bootstrapFile,
      stepId: claim.stepId || "",
      runId: claim.runId || "",
      workdir: spawnCwd,
      repo: spawnCwd,
      storyId: claim.storyId,
      claimEnvelope,
      v3ImplementationHandoff: claim.v3ImplementationHandoff,
      v3StageRetrySource: claim.v3StageRetrySource,
      input: claim.resolvedInput,
    }) as Record<string, unknown>;
    fs.writeFileSync(claimSummaryFile, JSON.stringify(claimSummary, null, 2) + "\n", { mode: 0o600 });
    preparedScopeParentDirs = claim.storyId
      ? ensureClaimScopeParentDirs(spawnCwd, claimSummary)
      : [];
    fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
      claimFile,
      outputFile,
      claimSummaryFile,
      stepId: claim.stepId || "",
      workdir: spawnCwd,
      taskPreview: claimTaskPreview(claim.resolvedInput),
    }), { mode: 0o700 });
    try { fs.chmodSync(bootstrapFile, 0o700); } catch { /* best-effort */ }
  } catch (err) {
    claimingSpawns.delete(key);
    const stepName = await stepNameForDbId(claim.stepId || "");
    const diagnostic = `CLAIM_HANDOFF_PREP_FAILED: ${fullAgentId} could not prepare spawner handoff files before launch: ${String(err).slice(0, 500)}`;
    console.warn(`[spawner] ${diagnostic}`);
    if (claim.runId) await recordSupervisorInfraEvent(claim.runId, stepName || "spawner", claim.storyDbId || null, diagnostic);
    if (claim.recoveryDispatchId && claim.stepId) {
      await relinquishV3RecoveryOwner(claim, `V3_RECOVERY_HANDOFF_PREPARATION_FAILED: ${diagnostic}`);
    } else if (claim.storyId && claim.runId && stepName) {
      await requeueOpenStoryClaim(claim.runId, stepName, claim.storyId, claim.claimAgentId || fullAgentId, diagnostic, agentId);
    } else if (claim.runId && claim.stepId && stepName) {
      await retryPreSpawnSingleStepClaim(claim.runId, claim.stepId, stepName, claim.claimAgentId || fullAgentId, claim.claimId!, diagnostic);
    } else if (claim.stepId) {
      await failStep(claim.stepId, diagnostic, claimEnvelope);
    }
    return;
  }

  // capture agent stdout/stderr to a transcript file for post-hoc diagnosis.
  if (await completeInlineSecurityGateIfApplicable({ role, agentId, wfId, key, claim, claimEnvelope, repo: spawnCwd, transcriptPath })) {
    if (claim.claimId) {
      await releaseReservedRuntimeForClaimIfPresent(claim.claimId, "Inline security gate completed without runtime spawn");
    }
    claimingSpawns.delete(key);
    return;
  }

  const prompt = buildPreclaimedPrompt({
    wfId,
    role,
    protocol: claim.protocol,
    outputFile,
    claimFile,
    claimSummaryFile,
    bootstrapFile,
  });
  console.log("[spawner] Spawning " + agentId + " for " + wfId + "/" + role + " after pre-claim (active: " + activeProcesses.size + ")");
  try { fs.mkdirSync(path.dirname(transcriptPath), { recursive: true }); } catch {}
  try { fs.writeFileSync(transcriptPath, "[spawner] " + new Date().toISOString() + " " + wfId + "/" + role + " agent=" + agentId + "\n"); } catch {}
  if (preparedScopeParentDirs.length > 0) {
    try {
      fs.appendFileSync(transcriptPath, `[spawner] prepared scope parent dirs: ${preparedScopeParentDirs.slice(0, 40).join(", ")}${preparedScopeParentDirs.length > 40 ? ", ..." : ""}\n`);
    } catch {}
  }

  // Use the same per-spawn id for the gateway session and /tmp handoff files.
  // A reaped child can still have late gateway activity; sharing claim/output
  // paths across retries lets old and new attempts overwrite each other's handoff.
  let runtimeWorkspaceDir: string | undefined;
  let runtimeWorkspaceId: string | undefined;
  if (AGENT_RUNTIME === "openclaw") {
    try {
      runtimeWorkspaceId = claim.attempt?.attemptId || sessionId;
      runtimeWorkspaceDir = prepareAttemptRuntimeWorkspace({
        root: OPENCLAW_ATTEMPT_WORKSPACE_ROOT,
        runtimeId: runtimeWorkspaceId,
        projectWorktree: spawnCwd,
      }).path;
    } catch (error) {
      const reason = `ATTEMPT_RUNTIME_WORKSPACE_PREP_FAILED: ${String(error).slice(0, 220)}`;
      claimingSpawns.delete(key);
      console.warn(`[spawner] ${reason}`);
      if (claim.runId) {
        await recordSupervisorInfraEvent(claim.runId, role, claim.storyDbId || null, reason);
      }
      if (claim.recoveryDispatchId && claim.stepId) {
        await relinquishV3RecoveryOwner(claim, `V3_RECOVERY_RUNTIME_WORKSPACE_PREPARATION_FAILED: ${reason}`);
      } else if (claim.storyId && claim.runId) {
        const claimedStepName = await stepNameForDbId(claim.stepId || "");
        if (claimedStepName) {
          await requeueOpenStoryClaim(claim.runId, claimedStepName, claim.storyId, claim.claimAgentId || fullAgentId, reason, agentId);
        } else if (claim.stepId) {
          await failStep(claim.stepId, reason, claimEnvelope);
          if (claim.claimId) await releaseReservedRuntimeForClaimIfPresent(claim.claimId, reason);
        }
      } else if (claim.stepId) {
        await failStep(claim.stepId, reason, claimEnvelope);
        if (claim.claimId) await releaseReservedRuntimeForClaimIfPresent(claim.claimId, reason);
      }
      return;
    }
  }
  const codexModelArgs = process.env.SETFARM_CODEX_MODEL ? ["--model", process.env.SETFARM_CODEX_MODEL] : [];
  const kimiModelArgs = process.env.SETFARM_KIMI_MODEL ? ["--model", process.env.SETFARM_KIMI_MODEL] : [];
  const openClawV3ModelArgs = claim.v3ImplementationHandoff?.executionProfile.modelId
    ? ["--model", claim.v3ImplementationHandoff.executionProfile.modelId]
    : [];
  const kimiOutputFormat = process.env.SETFARM_KIMI_OUTPUT_FORMAT || "stream-json";
  const opencodeModel = process.env.SETFARM_OPENCODE_MODEL || process.env.SETFARM_MINIMAX_MODEL || "minimax-coding-plan/MiniMax-M3";
  const opencodePromptFile = path.join(path.dirname(transcriptPath), `${agentId}-${sessionId}-prompt.md`);
  if (AGENT_RUNTIME === "opencode") {
    try { fs.writeFileSync(opencodePromptFile, prompt); } catch {}
  }
  const childArgs = AGENT_RUNTIME === "codex"
    ? [
      "--ask-for-approval", "never",
      "exec", "--json",
      "--ignore-user-config",
      "--ignore-rules",
      "--cd", spawnCwd,
      "--sandbox", "danger-full-access",
      "--skip-git-repo-check",
      ...codexModelArgs,
      "-",
    ]
    : AGENT_RUNTIME === "kimi"
      ? [
        "--work-dir", spawnCwd,
        "--yolo",
        "--afk",
        "--print",
        "--input-format", "text",
        "--output-format", kimiOutputFormat,
        ...kimiModelArgs,
      ]
    : AGENT_RUNTIME === "opencode"
      ? [
        "run",
        "Follow the attached Setfarm claim instructions exactly. Complete the task and write the required output file.",
        "--format", "json",
        "--dir", spawnCwd,
        "--model", opencodeModel,
        "--dangerously-skip-permissions",
        "--file", opencodePromptFile,
      ]
    : [
      "agent", "--json", "--agent", agentId,
      ...(OPENCLAW_AGENT_LOCAL ? ["--local"] : []),
      ...openClawV3ModelArgs,
      "--session-id", sessionId,
      "--message", prompt, "--timeout", String(AGENT_TIMEOUT_SECONDS),
    ];
  try {
    const agentCli = AGENT_RUNTIME === "codex" ? CODEX_CLI : AGENT_RUNTIME === "openclaw" ? OPENCLAW_CLI : AGENT_RUNTIME === "opencode" ? OPENCODE_CLI : KIMI_CLI;
    fs.appendFileSync(transcriptPath, `[spawner] runtime=${AGENT_RUNTIME} cli=${agentCli} session_id=${sessionId} session_key=${sessionKey} attempt_id=${claim.attempt?.attemptId || "legacy"} timeout=${AGENT_TIMEOUT_SECONDS}s cwd=${spawnCwd} runtime_workspace=${runtimeWorkspaceDir || spawnCwd}\n`);
  } catch {}
  const shouldInstallImplementGitWrapper = role === "developer" && Boolean(claim.storyId);
  const pathPrefix = shouldInstallImplementGitWrapper ? installImplementGitWrapper(spawnCwd, transcriptPath) : undefined;
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  const reservedRuntimeSession = await runtimeSessions.findById(runtimeSessionId);
  let startingRuntimeSession: ClaimRuntimeSession | undefined;
  try {
    startingRuntimeSession = await runtimeSessions.markStarting({
      sessionId: runtimeSessionId,
      ownerInstanceId: SPAWNER_INSTANCE_ID,
      sessionKey,
      worktree: spawnCwd,
      runtimePath: runtimeWorkspaceDir,
      transcriptPath,
      ...(claim.recoveryDispatchId && claim.recoveryRevisionId && claim.recoveryLeaseToken && claim.attempt
        ? {
            recoveryFence: {
              revisionId: claim.recoveryRevisionId,
              dispatchId: claim.recoveryDispatchId,
              leaseToken: claim.recoveryLeaseToken,
              attempt: claim.attempt,
            },
          }
        : {}),
    });
  } catch (error) {
    claimingSpawns.delete(key);
    const diagnostic = `RUNTIME_SESSION_START_BLOCKED: ${String(error).slice(0, 500)}`;
    if (
      reservedRuntimeSession
      && reservedRuntimeSession.ownerInstanceId === SPAWNER_INSTANCE_ID
      && reservedRuntimeSession.state === "reserved"
    ) {
      await runtimeSessions.quarantine({
        sessionId: runtimeSessionId,
        expectedOwnerInstanceId: reservedRuntimeSession.ownerInstanceId,
        expectedStateVersion: reservedRuntimeSession.stateVersion,
        diagnostic,
        evidence: { phase: "before-spawn" },
      });
      emitEvent({ ts: new Date().toISOString(), event: "runtime.quarantined", runId: claim.runId!, workflowId: wfId, detail: diagnostic });
    }
    if (claim.recoveryDispatchId && claim.stepId) {
      await relinquishV3RecoveryOwner(claim, `V3_RECOVERY_RUNTIME_START_FAILED: ${diagnostic}`);
    }
    console.warn(`[spawner] ${diagnostic}; no child was started`);
    return;
  }
  const outFd = preTransferOutFd = fs.openSync(transcriptPath, "a");
  const errFd = preTransferErrFd = fs.openSync(transcriptPath, "a");
  const child = preTransferChild = spawn(AGENT_RUNTIME === "codex" ? CODEX_CLI : AGENT_RUNTIME === "openclaw" ? OPENCLAW_CLI : AGENT_RUNTIME === "opencode" ? OPENCODE_CLI : KIMI_CLI, childArgs, {
    cwd: spawnCwd,  // Use the claimed worktree when available so relative tool paths resolve correctly.
    // Security audit S-1: explicit env allowlist. Previous `{...process.env}` leaked
    // ALL secrets (API keys, DB password, master URLs) to every agent child process.
    // Agents can run `printenv` and see everything. OpenClaw gateway handles API key
    // resolution internally — agents do not need direct key access.
    // Security: denylist DB credentials from agent env. Keep everything
    // else — OpenClaw CLI needs many env vars and allowlist is too fragile.
    env: (() => {
      return buildAgentChildEnv(pathPrefix, {
        runtime: AGENT_RUNTIME,
        sessionId,
        agentId,
        openClawWorkspaceDir: runtimeWorkspaceDir,
      });
    })(),
    stdio: AGENT_RUNTIME === "openclaw" || AGENT_RUNTIME === "opencode" ? ["ignore", outFd, errFd] : ["pipe", outFd, errFd],
  });
  if (AGENT_RUNTIME === "codex" || AGENT_RUNTIME === "kimi") {
    child.stdin?.write(prompt);
    child.stdin?.end();
  }
  const startedAtMs = Date.now();
  const processIdentity = child.pid ? observeProcessIdentity(child.pid) : undefined;
  const initialTranscriptSize = fileSize(transcriptPath);
  const activeProcess: ActiveProcess = {
    child,
    processIdentity,
    runId: claim.runId || "",
    stepId: claim.stepId || "",
    workflowStepId: claim.workflowStepId || "unknown",
    protocol: claim.protocol || "legacy",
    storyId: claim.storyId,
    storyDbId: claim.storyDbId,
    claimGeneration: claim.claimGeneration,
    claimId: claim.claimId,
    claimAgentId: claim.claimAgentId || fullAgentId,
    agentId,
    wfId,
    role,
    startedAtMs,
    transcriptPath,
    initialTranscriptSize,
    outputPath: outputFile,
    claimSummaryPath: claimSummaryFile,
    spawnCwd,
    attempt: claim.attempt,
    recoveryDispatchId: claim.recoveryDispatchId,
    recoveryRevisionId: claim.recoveryRevisionId,
    recoveryLeaseToken: claim.recoveryLeaseToken,
    runtimeSessionId,
    runtimeOwnerInstanceId: SPAWNER_INSTANCE_ID,
    runtimeWorkspaceDir,
    runtimeWorkspaceId,
    sessionId,
    sessionKey,
    sessionJsonlPath: AGENT_RUNTIME === "openclaw" ? sessionJsonlPath : transcriptPath,
    lastCpuTicks: readProcessCpuTicks(child.pid) ?? undefined,
    lastCpuActivityMs: startedAtMs,
  };
  let processExited = false;
  const closeTranscriptFds = () => {
    try { fs.closeSync(outFd); } catch {}
    try { fs.closeSync(errFd); } catch {}
  };
  const hardTimeout = setTimeout(() => {
    if (processExited) return;
    try {
      fs.appendFileSync(transcriptPath, `--- HARD TIMEOUT ${new Date().toISOString()} ---\nagent exceeded ${AGENT_TIMEOUT_SECONDS + 60}s\n`);
    } catch {}
    terminateActiveProcess(activeProcess, "spawn-hard-timeout", false);
  }, (AGENT_TIMEOUT_SECONDS + 60) * 1000);
  child.once("error", (err) => {
    processExited = true;
    clearTimeout(hardTimeout);
    closeTranscriptFds();
    const currentProcess = activeProcesses.get(key);
    const isCurrentProcess = currentProcess?.child === child;
    const hasReplacementProcess = Boolean(currentProcess && currentProcess.child !== child);
    if (isCurrentProcess) activeProcesses.delete(key);
    if (!hasReplacementProcess && activeProcess.storyId && !activeProcess.runtimeDrainRequested) {
      activeProcess.runtimeDrainRequested = true;
      drainingProcesses.set(runtimeSessionId, activeProcess);
    }
    if (!activeProcess.runtimeDrainRequested && drainingProcesses.get(runtimeSessionId)?.child === child) {
      drainingProcesses.delete(runtimeSessionId);
    }
    try {
      fs.appendFileSync(transcriptPath, "--- SPAWN ERROR ---\n" + String((err as any).message || err) + "\n--- FINISHED " + new Date().toISOString() + " ---\n");
    } catch (e) { console.warn("[spawner] transcript write failed: " + String(e)); }
    console.warn("[spawner] " + agentId + " spawn error: " + ((err as any).message || err) + " (transcript: " + transcriptPath + ")");
    if (!hasReplacementProcess && !shuttingDown && claim.stepId && !activeProcess.claimRecoveryOwned) {
      void settleExitedClaimAndRuntime(activeProcess, err)
        .finally(() => cleanupSpawnerDetachedToolChildren("spawn-error"));
    }
  });
  child.once("exit", (code, signal) => {
    processExited = true;
    clearTimeout(hardTimeout);
    closeTranscriptFds();
    const currentProcess = activeProcesses.get(key);
    const isCurrentProcess = currentProcess?.child === child;
    const hasReplacementProcess = Boolean(currentProcess && currentProcess.child !== child);
    if (isCurrentProcess) activeProcesses.delete(key);
    if (!hasReplacementProcess && activeProcess.storyId && !activeProcess.runtimeDrainRequested) {
      activeProcess.runtimeDrainRequested = true;
      drainingProcesses.set(runtimeSessionId, activeProcess);
    }
    if (!activeProcess.runtimeDrainRequested && drainingProcesses.get(runtimeSessionId)?.child === child) {
      drainingProcesses.delete(runtimeSessionId);
    }
    try {
      fs.appendFileSync(transcriptPath, `--- EXIT code=${code ?? ""} signal=${signal ?? ""} ---\n--- FINISHED ${new Date().toISOString()} ---\n`);
    } catch (e) { console.warn("[spawner] transcript write failed: " + String(e)); }
    const openClawTerminalOutcome = AGENT_RUNTIME === "openclaw"
      ? readOpenClawAgentTerminalOutcome(transcriptPath)
      : undefined;
    const err = openClawTerminalOutcome
      && (openClawTerminalOutcome.kind === "transient_failure" || openClawTerminalOutcome.kind === "terminal_failure")
      ? new OpenClawAgentTerminalError(openClawTerminalOutcome)
      : code === 0
        ? null
        : new Error(`agent exited code=${code ?? ""} signal=${signal ?? ""}`);
    if (err) {
      console.warn("[spawner] " + agentId + " exited: " + ((err as any).message || err) + " (transcript: " + transcriptPath + ")");
      if (!hasReplacementProcess && !shuttingDown && claim.stepId && !activeProcess.claimRecoveryOwned) {
        void settleExitedClaimAndRuntime(activeProcess, err)
          .finally(() => cleanupSpawnerDetachedToolChildren("spawn-exit"));
      }
    }
    else {
      console.log("[spawner] " + agentId + " completed (transcript: " + transcriptPath + ")");
      if (!hasReplacementProcess && !shuttingDown && claim.stepId && !activeProcess.claimRecoveryOwned) {
        void settleExitedClaimAndRuntime(
          activeProcess,
          new Error("agent exited with code 0 without calling setfarm step complete/fail"),
        ).finally(() => cleanupSpawnerDetachedToolChildren("spawn-clean-exit"));
      }
    }
  });
  if (child.pid && claim.runId && claim.stepId) {
    activeProcesses.set(key, activeProcess);
  }
  claimingSpawns.delete(key);
  try {
    if (!child.pid || !processIdentity) {
      throw new Error("RUNTIME_SESSION_PROCESS_IDENTITY_UNOBSERVED");
    }
    const published = await runtimeSessions.markRunning({
      sessionId: runtimeSessionId,
      ownerInstanceId: SPAWNER_INSTANCE_ID,
      pid: child.pid,
      sessionKey,
      processIdentity,
      ...(claim.recoveryDispatchId && claim.recoveryRevisionId && claim.recoveryLeaseToken && claim.attempt
        ? {
            recoveryFence: {
              revisionId: claim.recoveryRevisionId,
              dispatchId: claim.recoveryDispatchId,
              leaseToken: claim.recoveryLeaseToken,
              attempt: claim.attempt,
            },
          }
        : {}),
    });
    postClaimOwnershipTransferred = true;
    if (published.status === "drain_requested") {
      activeProcess.runtimeDrainRequested = true;
      drainingProcesses.set(runtimeSessionId, activeProcess);
      terminateActiveProcess(activeProcess, "termination-raced-runtime-start", false);
      activeProcesses.delete(key);
    }
  } catch (error) {
    const diagnostic = `RUNTIME_SESSION_RUNNING_PUBLICATION_FAILED: ${String(error).slice(0, 500)}`;
    terminateActiveProcess(activeProcess, "runtime-publication-failed", false);
    activeProcesses.delete(key);
    let quarantined = false;
    if (startingRuntimeSession) {
      await runtimeSessions.quarantine({
        sessionId: runtimeSessionId,
        expectedOwnerInstanceId: startingRuntimeSession.ownerInstanceId,
        expectedStateVersion: startingRuntimeSession.stateVersion,
        diagnostic,
        evidence: { pid: child.pid ?? null, sessionKey },
      });
      quarantined = true;
    }
    if (quarantined) {
      emitEvent({ ts: new Date().toISOString(), event: "runtime.quarantined", runId: claim.runId!, workflowId: wfId, detail: diagnostic });
    }
    if (claim.recoveryDispatchId) {
      await relinquishV3RecoveryOwner(activeProcess, diagnostic);
    }
  }
  } catch (error) {
    postClaimFailure = error;
    console.warn(`[spawner] POST_CLAIM_PRE_TRANSFER_FAILED:${fullAgentId}:${String(error).slice(0, 500)}`);
  } finally {
    claimingSpawns.delete(key);
    if (!postClaimOwnershipTransferred) {
      if (preTransferChild && activeProcesses.get(key)?.child === preTransferChild) {
        activeProcesses.delete(key);
      }
      if (preTransferChild?.pid) killProcessTree(preTransferChild.pid, "SIGKILL");
      if (preTransferOutFd !== undefined) {
        try { fs.closeSync(preTransferOutFd); } catch {}
      }
      if (preTransferErrFd !== undefined) {
        try { fs.closeSync(preTransferErrFd); } catch {}
      }
      const diagnostic = `POST_CLAIM_PRE_TRANSFER_FAILED:${String(postClaimFailure ?? "spawn returned before canonical transfer").slice(0, 500)}`;
      try {
        await releaseUntransferredPostClaimOwnership(claim, agentId, diagnostic);
      } catch (cleanupError) {
        if (claim.runId) {
          await recordSupervisorInfraEvent(
            claim.runId,
            role || "spawner",
            claim.storyDbId || null,
            `POST_CLAIM_OWNERSHIP_RELEASE_FAILED:${String(cleanupError).slice(0, 500)}`,
          ).catch(() => {});
        }
        throw cleanupError;
      }
    }
  }
}


async function failStaleRunningClaimsFromPreviousSpawner(): Promise<void> {
  try {
    const graceSeconds = Math.max(0, Math.ceil(STARTUP_RUNNING_GRACE_MS / 1000));
      const rows = await pgQuery<{ id: string; step_id: string; agent_id: string; run_id: string; current_story_id: string | null; story_id: string | null; run_number: number; updated_at: string }>(
      `SELECT s.id, s.step_id, s.agent_id, s.run_id, s.current_story_id, st.story_id, r.run_number, s.updated_at
       FROM steps s
       JOIN runs r ON r.id = s.run_id
       LEFT JOIN stories st ON st.id = s.current_story_id
       WHERE s.status = 'running'
         AND r.status = 'running'
         AND NOT (
           r.protocol = 'v3'
           AND st.story_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM recovery_dispatch_deliveries recovery_delivery
              WHERE recovery_delivery.run_id = s.run_id
                AND recovery_delivery.story_id = st.story_id
                AND recovery_delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
           )
         )
         AND NOT EXISTS (
           SELECT 1 FROM runtime_sessions rs
            WHERE rs.step_db_id = s.id
              AND rs.state <> 'released'
         )
         AND NOT EXISTS (
           SELECT 1 FROM runtime_completion_requests rcr
            WHERE rcr.run_id = s.run_id
              AND rcr.state NOT IN ('accepted', 'rejected')
         )
         AND NOT EXISTS (
           SELECT 1 FROM run_termination_requests rtr
            WHERE rtr.run_id = s.run_id
              AND rtr.state <> 'terminalized'
         )
         AND s.updated_at <= NOW() - ($1::int * interval '1 second')
       ORDER BY s.updated_at ASC
       LIMIT 20`,
      [graceSeconds],
    );
    for (const row of rows) {
      if (row.step_id === "implement") {
        if (row.current_story_id) {
          const currentStory = await pgGet<{ story_id: string; status: string }>(
            "SELECT story_id, status FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
            [row.current_story_id, row.run_id],
          );
          if (currentStory?.status === "running") {
            const recovered = await tryRecoverExitedImplementWork(
              {
                stepId: row.id,
                storyDbId: row.current_story_id,
                claimAgentId: row.agent_id,
                agentId: row.agent_id,
                transcriptPath: "spawner-startup-stale-running-claim",
                spawnCwd: "",
              },
              {
                status: "running",
                step_id: row.step_id,
                run_id: row.run_id,
                type: "loop",
                current_story_id: row.current_story_id,
              },
              new Error("AGENT_PROCESS_ORPHANED: spawner restarted or lost the tracked implement agent before step completion"),
            );
            if (recovered) continue;
            const reason = `AGENT_PROCESS_ORPHANED: startup found no runtime for run #${row.run_number} ${row.step_id}/${currentStory.story_id}/${row.agent_id}`;
            const requeued = await requeueOpenStoryClaim(row.run_id, row.step_id, currentStory.story_id, row.agent_id, reason);
            if (requeued) {
              console.log(`[spawner] requeued orphaned running story for run #${row.run_number}: ${currentStory.story_id}`);
            } else {
              console.warn(`[spawner] startup recovery retained ${currentStory.story_id} as running because no exact open claim could be transitioned`);
            }
            continue;
          }
          if (currentStory && ["done", "verified"].includes(currentStory.status)) {
            console.log(`[spawner] preserving orphaned implement loop for run #${row.run_number}: story ${currentStory.story_id} is ${currentStory.status}`);
            continue;
          }
        }
        const doneStory = await pgGet<{ story_id: string }>(
          "SELECT story_id FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC LIMIT 1",
          [row.run_id],
        );
        if (doneStory) {
          console.log(`[spawner] preserving orphaned implement loop for run #${row.run_number}: story ${doneStory.story_id} awaits verify`);
          continue;
        }
      }
      if (row.step_id === "verify" && !await verifyEachHasDoneStory(row.run_id, row.step_id)) {
        console.log(`[spawner] clearing orphaned verify for run #${row.run_number}: no done story awaits verify`);
        await pgRun("UPDATE steps SET status = 'waiting', updated_at = NOW() WHERE id = $1 AND status = 'running'", [row.id]);
        continue;
      }
      const reason = `AGENT_PROCESS_ORPHANED: spawner restarted with no active process for run #${row.run_number} ${row.step_id} (${row.agent_id}); retrying running claim last updated ${row.updated_at}`;
      console.warn(`[spawner] ${reason}`);
      await requeueStaleRunningClaimFromPreviousSpawner(row, reason);
    }
  } catch (err) {
    console.warn(`[spawner] startup running claim recovery failed: ${String(err).slice(0, 300)}`);
  }
}

async function requeueStaleRunningClaimFromPreviousSpawner(row: {
  id: string;
  step_id: string;
  agent_id: string;
  run_id: string;
  current_story_id: string | null;
  story_id: string | null;
}, reason: string): Promise<void> {
  if (row.story_id) {
    await requeueOpenStoryClaim(row.run_id, row.step_id, row.story_id, row.agent_id, reason);
    return;
  }
  if (row.current_story_id) {
    await pgRun(
      "UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
      [row.current_story_id],
    );
  }
  await retrySingleStepClaimWithAuthority({
    runId: row.run_id,
    stepDbId: row.id,
    workflowStepId: row.step_id,
    claimAgentId: row.agent_id,
    runtimeAgentId: "spawner-startup-recovery",
    diagnostic: reason,
  });
}

type RuntimeReleaseResult =
  | Readonly<{ status: "completed" | "released" | "already_terminal" | "drained_for_termination"; runtimeSessionId: string; claimId: number }>
  | Readonly<{ status: "quarantined"; runtimeSessionId: string; claimId: number; diagnostic: string }>;

async function releaseActiveProcessForShutdown(active: ActiveProcess): Promise<RuntimeReleaseResult> {
  const claimId = active.claimId;
  if (!active.stepId || !claimId) {
    throw new Error("SHUTDOWN_RUNTIME_IDENTITY_INCOMPLETE");
  }
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  try {
    let session = await runtimeSessions.findById(active.runtimeSessionId);
    if (!session) throw new Error("SHUTDOWN_RUNTIME_SESSION_NOT_FOUND");
    if (session.state !== "drained" && session.state !== "released") {
      session = await runtimeSessions.requestDrain({
        sessionId: active.runtimeSessionId,
        ownerInstanceId: active.runtimeOwnerInstanceId,
        diagnostic: "Spawner shutdown requested exact runtime drain",
      });
      await drainDurableRuntimeSession(session, { requestId: `shutdown-${SPAWNER_INSTANCE_ID}` });
      session = (await runtimeSessions.findById(active.runtimeSessionId))!;
    }
    if (session.state === "released") {
      return { status: "already_terminal", runtimeSessionId: active.runtimeSessionId, claimId };
    }

    const completionRequest = await createRuntimeCompletionRepository(getSql()).findByClaimId(claimId);
    if (completionRequest && !["accepted", "rejected", "quarantined"].includes(completionRequest.state)) {
      await processRuntimeCompletionRequests(completionRequest.requestId);
      const completedClaim = await pgGet<{ outcome: string | null }>(
        "SELECT outcome FROM claim_log WHERE id = $1",
        [claimId],
      );
      const completedSession = await runtimeSessions.findById(active.runtimeSessionId);
      if (completedClaim?.outcome !== null && completedSession?.state === "released") {
        return { status: "completed", runtimeSessionId: active.runtimeSessionId, claimId };
      }
    }

    const owner = await pgGet<{
      claim_outcome: string | null;
      run_status: string;
      step_id: string;
      type: string;
      story_id: string | null;
    }>(
      `SELECT cl.outcome AS claim_outcome, r.status AS run_status,
              s.step_id, s.type, cl.story_id
         FROM claim_log cl
         JOIN runs r ON r.id = cl.run_id
         JOIN steps s ON s.id = $2 AND s.run_id = cl.run_id AND s.step_id = cl.step_id
        WHERE cl.id = $1
        LIMIT 1`,
      [claimId, active.stepId],
    );
    if (!owner) throw new Error("SHUTDOWN_CLAIM_OWNER_NOT_FOUND");
    if (owner.claim_outcome !== null) {
      await pgBegin((sql) => releaseDrainedRuntimeSessionsInTransaction(sql, { runId: active.runId }));
      return { status: "already_terminal", runtimeSessionId: active.runtimeSessionId, claimId };
    }
    if (["cancelling", "failing"].includes(owner.run_status)) {
      return { status: "drained_for_termination", runtimeSessionId: active.runtimeSessionId, claimId };
    }
    if (!["running", "resuming"].includes(owner.run_status)) {
      throw new Error(`SHUTDOWN_RUN_STATE_INVALID:${owner.run_status}`);
    }

    let completed = false;
    if (owner.type === "loop" && owner.story_id) {
      completed = await completeActiveClaimFromOutputFile(active);
      if (!completed) {
        const requeued = await requeueOpenStoryClaim(
          active.runId,
          owner.step_id,
          owner.story_id,
          active.claimAgentId,
          "Spawner shutdown released active loop claim after proven drain",
          active.agentId,
        );
        if (!requeued) throw new Error("SHUTDOWN_LOOP_REQUEUE_CAS_LOST");
      }
    } else {
      await retrySingleStepClaimWithAuthority({
        runId: active.runId,
        stepDbId: active.stepId,
        workflowStepId: owner.step_id,
        claimAgentId: active.claimAgentId,
        runtimeAgentId: active.agentId,
        diagnostic: "Spawner shutdown released active single-step claim after proven drain",
        envelope: activeClaimEnvelope(active),
      });
    }
    const terminalClaim = await pgGet<{ outcome: string | null }>(
      "SELECT outcome FROM claim_log WHERE id = $1",
      [claimId],
    );
    if (!terminalClaim || terminalClaim.outcome === null) {
      throw new Error("SHUTDOWN_CLAIM_REMAINED_ACTIVE");
    }
    await pgBegin((sql) => releaseDrainedRuntimeSessionsInTransaction(sql, { runId: active.runId }));
    console.log(`[spawner] shutdown ${completed ? "completed" : "released"} ${active.runtimeSessionId}`);
    return {
      status: completed ? "completed" : "released",
      runtimeSessionId: active.runtimeSessionId,
      claimId,
    };
  } catch (error) {
    const diagnostic = `SHUTDOWN_RUNTIME_QUARANTINED: ${String(error).slice(0, 1_000)}`;
    const current = await runtimeSessions.findById(active.runtimeSessionId);
    if (
      current
      && current.ownerInstanceId === active.runtimeOwnerInstanceId
      && current.state !== "released"
    ) {
      await runtimeSessions.quarantine({
        sessionId: active.runtimeSessionId,
        expectedOwnerInstanceId: current.ownerInstanceId,
        expectedStateVersion: current.stateVersion,
        diagnostic,
        evidence: { claimId, ownerInstanceId: active.runtimeOwnerInstanceId },
      });
    }
    console.warn(`[spawner] ${diagnostic}`);
    return { status: "quarantined", runtimeSessionId: active.runtimeSessionId, claimId, diagnostic };
  }
}

function processReferencesPaths(paths: Array<string | undefined>): boolean {
  const roots = paths
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => path.resolve(candidate));
  if (roots.length === 0) return false;
  try {
    const output = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.split("\n").some((line) => {
      const match = line.trim().match(/^(\d+)\s+([\s\S]+)$/);
      if (!match || Number(match[1]) === process.pid) return false;
      return roots.some((root) => match[2]!.includes(root));
    });
  } catch {
    return true;
  }
}

function activeRuntimeEntry(runtimeSessionId: string): { key: string; active: ActiveProcess } | undefined {
  for (const [key, active] of activeProcesses) {
    if (active.runtimeSessionId === runtimeSessionId) return { key, active };
  }
  const draining = drainingProcesses.get(runtimeSessionId);
  return draining ? { key: "", active: draining } : undefined;
}

async function drainDurableRuntimeSession(
  session: ClaimRuntimeSession,
  request: Readonly<{
    requestId: string;
    authorityRef?: string;
    terminationOwnerInstanceId?: string;
  }>,
): Promise<void> {
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  const tracked = activeRuntimeEntry(session.sessionId);
  const expectedProcessIdentity = session.processIdentity ?? tracked?.active.processIdentity;
  if (tracked) {
    terminateActiveProcess(tracked.active, `run-termination:${request.requestId}`);
    if (tracked.key) activeProcesses.delete(tracked.key);
  } else {
    if (expectedProcessIdentity) {
      signalProcessIfIdentityMatches(expectedProcessIdentity, "SIGTERM", {
        signalProcess: (pid, signal) => killProcessTree(pid, signal),
      });
      setTimeout(() => {
        signalProcessIfIdentityMatches(expectedProcessIdentity, "SIGKILL", {
          signalProcess: (pid, signal) => killProcessTree(pid, signal),
        });
      }, 2_000);
    }
    if (session.runtimeKind === "openclaw_session" && session.sessionKey) {
      forceCancelOpenClawLookupSync(session.sessionKey, `run-termination:${request.requestId}`);
    }
  }

  const deadline = Date.now() + 12_000;
  let stableObservations = 0;
  while (Date.now() < deadline) {
    const trackedChildTerminal = Boolean(
      tracked
      && (tracked.active.child.exitCode !== null || tracked.active.child.signalCode !== null),
    );
    const observedProcessIdentity = session.pid
      ? observeProcessIdentity(session.pid)
      : undefined;
    const processIdentityMatched = Boolean(
      expectedProcessIdentity
      && observedProcessIdentity
      && sameProcessIdentity(expectedProcessIdentity, observedProcessIdentity),
    );
    const localProcessAbsent = trackedChildTerminal
      || !session.pid
      || (expectedProcessIdentity
        ? !processIdentityMatched
        : !observedProcessIdentity);
    const openClawTaskAbsent = session.runtimeKind !== "openclaw_session"
      || !session.sessionKey
      || openClawTaskIdsForLookupSync(session.sessionKey).length === 0;
    const workspaceProcessAbsent = !processReferencesPaths([session.worktree, session.runtimePath]);
    if (localProcessAbsent && openClawTaskAbsent && workspaceProcessAbsent) {
      stableObservations += 1;
      if (stableObservations >= 2) {
        const evidence = {
          schema: "setfarm.runtime-drain-evidence.v1" as const,
          observedAt: new Date().toISOString(),
          localProcessAbsent,
          openClawTaskAbsent,
          workspaceProcessAbsent,
          stableObservations,
          evidenceRefs: [
            request.authorityRef ?? `setfarm://run-termination/${request.requestId}`,
            `setfarm://runtime-session/${session.sessionId}`,
          ],
          ...(expectedProcessIdentity ? { expectedProcessIdentity } : {}),
          ...(observedProcessIdentity ? { observedProcessIdentity } : {}),
          ...(expectedProcessIdentity ? { processIdentityMatched } : {}),
          ...(tracked ? { trackedChildTerminal } : {}),
        };
        if (session.state === "quarantined") {
          if (!request.terminationOwnerInstanceId) {
            throw new Error("RUNTIME_QUARANTINE_RECOVERY_REQUIRES_TERMINATION_OWNER");
          }
          await runtimeSessions.recoverQuarantinedForTermination({
            sessionId: session.sessionId,
            expectedStateVersion: session.stateVersion,
            terminationRequestId: request.requestId,
            terminationOwnerInstanceId: request.terminationOwnerInstanceId,
            evidence,
            diagnostic: `Run termination ${request.requestId} re-proved absence for quarantined runtime`,
          });
        } else {
          await runtimeSessions.markDrained({
            sessionId: session.sessionId,
            ownerInstanceId: session.ownerInstanceId,
            evidence,
          });
        }
        drainingProcesses.delete(session.sessionId);
        emitEvent({
          ts: new Date().toISOString(),
          event: "runtime.drained",
          runId: session.runId,
          detail: `Runtime ${session.sessionId} drained for ${request.requestId}`,
        });
        return;
      }
    } else {
      stableObservations = 0;
      if (expectedProcessIdentity && processIdentityMatched && Date.now() + 2_000 >= deadline) {
        signalProcessIfIdentityMatches(expectedProcessIdentity, "SIGKILL", {
          signalProcess: (pid, signal) => killProcessTree(pid, signal),
        });
      }
      if (session.runtimeKind === "openclaw_session" && session.sessionKey && !openClawTaskAbsent) {
        forceCancelOpenClawLookupSync(session.sessionKey, `run-termination-retry:${request.requestId}`);
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  const diagnostic = `RUNTIME_DRAIN_TIMEOUT: ${session.sessionId} could not prove process/task/workspace absence`;
  await runtimeSessions.quarantine({
    sessionId: session.sessionId,
    expectedOwnerInstanceId: session.ownerInstanceId,
    expectedStateVersion: session.stateVersion,
    diagnostic,
    evidence: {
      requestId: request.requestId,
      pid: session.pid ?? null,
      sessionKey: session.sessionKey ?? null,
      expectedProcessIdentity: expectedProcessIdentity ?? null,
      observedProcessIdentity: session.pid ? observeProcessIdentity(session.pid) ?? null : null,
    },
  });
  emitEvent({ ts: new Date().toISOString(), event: "runtime.quarantined", runId: session.runId, detail: diagnostic });
  throw new Error(diagnostic);
}

async function quarantineRuntimeCompletion(
  request: RuntimeCompletionRequest,
  error: unknown,
): Promise<void> {
  const completions = createRuntimeCompletionRepository(getSql());
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  const diagnostic = `RUNTIME_COMPLETION_QUARANTINED: ${String(error).slice(0, 1_000)}`;
  const preemption = await completions.preemptForRunTermination({
    requestId: request.requestId,
    diagnostic: `Completion preempted by canonical run termination: ${String(error).slice(0, 800)}`,
  });
  if (preemption.status === "preempted") {
    emitEvent({
      ts: new Date().toISOString(),
      event: "runtime.completion_rejected",
      runId: request.runId,
      workflowId: request.workflowStepId,
      stepId: request.workflowStepId,
      storyId: request.storyId,
      detail: `Completion ${request.requestId} yielded to run termination`,
    });
    return;
  }
  if (preemption.status === "resume_effects" || preemption.status === "finalize") {
    console.warn(
      `[spawner] completion ${request.requestId} retained canonical ${preemption.status} continuation after owner failure`,
    );
    return;
  }
  if (preemption.status === "not_preemptible") {
    console.warn(
      `[spawner] completion ${request.requestId} is not termination-preemptible; durable owner remains authoritative`,
    );
    return;
  }
  const currentRequest = await completions.findById(request.requestId);
  if (!currentRequest) throw new Error("RUNTIME_COMPLETION_QUARANTINE_REQUEST_NOT_FOUND");
  if (["accepted", "rejected"].includes(currentRequest.state)) return;
  if (currentRequest.state !== "quarantined") {
    if (
      (currentRequest.state !== "draining" && currentRequest.state !== "processing")
      || currentRequest.ownerInstanceId !== SPAWNER_INSTANCE_ID
      || !currentRequest.leaseExpiresAt
      || new Date(currentRequest.leaseExpiresAt).getTime() <= Date.now()
    ) {
      console.warn(
        `[spawner] completion quarantine authority lost for ${request.requestId}; current owner will recover it`,
      );
      return;
    }
    try {
      await completions.quarantine({
        requestId: request.requestId,
        ownerInstanceId: SPAWNER_INSTANCE_ID,
        expectedState: currentRequest.state,
        expectedLeaseExpiresAt: currentRequest.leaseExpiresAt,
        expectedUpdatedAt: currentRequest.updatedAt,
        diagnostic,
        result: { ownerInstanceId: SPAWNER_INSTANCE_ID },
      });
    } catch (quarantineError) {
      if (
        String(quarantineError).includes("RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST")
        || String(quarantineError).includes("RUNTIME_COMPLETION_QUARANTINE_CANONICAL_CONTINUATION_REQUIRED")
      ) {
        console.warn(
          `[spawner] completion quarantine fence lost for ${request.requestId}; current owner remains authoritative`,
        );
        return;
      }
      throw quarantineError;
    }
  }
  const session = await runtimeSessions.findById(request.runtimeSessionId);
  if (session && !["released", "quarantined"].includes(session.state)) {
    await runtimeSessions.quarantine({
      sessionId: request.runtimeSessionId,
      expectedOwnerInstanceId: session.ownerInstanceId,
      expectedStateVersion: session.stateVersion,
      diagnostic,
      evidence: { completionRequestId: request.requestId, claimId: request.claimId },
    });
  }
  emitEvent({
    ts: new Date().toISOString(),
    event: "runtime.quarantined",
    runId: request.runId,
    workflowId: request.workflowStepId,
    stepId: request.workflowStepId,
    storyId: request.storyId,
    detail: diagnostic,
  });
  console.warn(`[spawner] ${diagnostic}`);
}

async function finalizeRecoveredRuntimeCompletion(request: RuntimeCompletionRequest): Promise<void> {
  const completions = createRuntimeCompletionRepository(getSql());
  await completions.acceptAndRelease({
    requestId: request.requestId,
    ownerInstanceId: SPAWNER_INSTANCE_ID,
    ownerAttemptCount: request.ownerAttemptCount,
    result: { ...request.result, recoveredAfterCoordinatorCrash: true },
  });
  if (request.storyId) {
    await cleanupQuiescedStoryWorktree(
      request.runId,
      request.storyId,
      request.claimEnvelope.claimAgentId,
      request.claimEnvelope.workdir,
    );
  }
  emitEvent({
    ts: new Date().toISOString(),
    event: "runtime.completion_accepted",
    runId: request.runId,
    workflowId: request.workflowStepId,
    stepId: request.workflowStepId,
    storyId: request.storyId,
    detail: `Recovered terminal completion ${request.requestId} and released ${request.runtimeSessionId}`,
  });
}

async function withRuntimeCompletionHeartbeat<T>(
  request: RuntimeCompletionRequest,
  operation: () => Promise<T>,
): Promise<T> {
  const completions = createRuntimeCompletionRepository(getSql());
  let timer: NodeJS.Timeout | undefined;
  let heartbeatInFlight = Promise.resolve();
  let leaseError: Error | undefined;
  let stopped = false;
  const schedule = () => {
    timer = setTimeout(() => {
      heartbeatInFlight = (async () => {
        try {
          const retained = await completions.heartbeatProcessing({
            requestId: request.requestId,
            ownerInstanceId: SPAWNER_INSTANCE_ID,
            ownerAttemptCount: request.ownerAttemptCount,
            leaseMs: 2 * 60_000,
          });
          if (!retained) leaseError = new Error("RUNTIME_COMPLETION_PROCESSING_LEASE_LOST");
        } catch (error) {
          leaseError = new Error(`RUNTIME_COMPLETION_HEARTBEAT_FAILED:${String(error)}`);
        }
        if (!stopped && !leaseError) schedule();
      })();
    }, 30_000);
    timer.unref();
  };
  schedule();
  try {
    const result = await operation();
    if (leaseError) throw leaseError;
    return result;
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    await heartbeatInFlight;
  }
}

async function withRuntimeCompletionOwnerCapability<T>(
  request: RuntimeCompletionRequest,
  operation: () => Promise<T>,
): Promise<T> {
  const { runWithRuntimeCompletionOwner } = await import(
    "./execution/runtime-completion-owner-context.js",
  );
  if (
    request.ownerInstanceId !== SPAWNER_INSTANCE_ID
    || !request.leaseExpiresAt
    || request.ownerAttemptCount < 1
  ) {
    throw new Error(`RUNTIME_COMPLETION_OWNER_CAPABILITY_INCOMPLETE:${request.requestId}`);
  }
  return runWithRuntimeCompletionOwner({
    requestId: request.requestId,
    ownerInstanceId: request.ownerInstanceId,
    leaseExpiresAt: request.leaseExpiresAt,
    ownerAttemptCount: request.ownerAttemptCount,
  }, operation);
}

const V3_RECOVERY_COORDINATE_EFFECT_TYPE = "v3.recovery.coordinate";

function canonicalV3RecoveryEffectResult(
  result: V3RecoveryEffectCoordinateResult,
): Record<string, unknown> {
  return {
    schema: "setfarm.v3-recovery-coordinate-effect-result.v1",
    ...result,
    ...("evidenceBundleHash" in result
      ? { evidenceBundleRef: `setfarm://evidence-bundle/${encodeURIComponent(result.evidenceBundleHash)}` }
      : {
          reviewResolutionEvidenceRef:
            `setfarm://github-review-resolution/${encodeURIComponent(result.reviewResolutionEvidenceHash)}`,
        }),
    ...(result.status !== "verified"
      ? {
          recoveryCaseRef: `setfarm://recovery-case/${encodeURIComponent(result.recoveryCaseId)}`,
          revisionRef: `setfarm://recovery-revision/${encodeURIComponent(result.revisionId)}`,
        }
      : {}),
    ...(result.status === "dispatched"
      ? { dispatchRef: `setfarm://recovery-dispatch/${encodeURIComponent(result.dispatchId)}` }
      : {}),
  };
}

/**
 * Execute the v3 recovery effect without allowing the generic continuation
 * handler to interpret recovery state. The coordinator and continuation are
 * both idempotent durable projections, so a crash before effect settlement can
 * replay this exact sequence without publishing a second semantic transition.
 */
export async function executeV3RecoveryRuntimeCompletionEffect(input: Readonly<{
  completionRequestId: string;
  effectKey: string;
  planHash: string;
  assertLease: () => Promise<void>;
  coordinate: () => Promise<V3RecoveryEffectCoordinateResult>;
  resumeCanonicalContinuation: () => Promise<{ advanced: boolean; runCompleted: boolean }>;
}>): Promise<RuntimeCompletionEffectResolution> {
  await input.assertLease();
  const coordinated = await input.coordinate();
  await input.assertLease();

  const continuationApplied = coordinated.status === "verified" || coordinated.status === "resolved";
  const continuationResult = continuationApplied
    ? await input.resumeCanonicalContinuation()
    : { advanced: false, runCompleted: false };
  await input.assertLease();

  const recovery = canonicalV3RecoveryEffectResult(coordinated);
  return {
    resolution: "applied",
    result: {
      ...continuationResult,
      recoveryStatus: coordinated.status,
      recovery,
    },
    evidence: {
      schema: "setfarm.v3-recovery-coordinate-effect-evidence.v1",
      completionRequestId: input.completionRequestId,
      effectKey: input.effectKey,
      planHash: input.planHash,
      continuationApplied,
      recovery,
    },
  };
}

async function applyAndAcceptRuntimeCompletionEffects(
  request: RuntimeCompletionRequest,
): Promise<void> {
  const completions = createRuntimeCompletionRepository(getSql());
  const effects = createRuntimeCompletionEffectRepository(getSql());
  const result = await withRuntimeCompletionOwnerCapability(request, () => (
    withRuntimeCompletionHeartbeat(request, () => runRuntimeCompletionEffectLedger({
      requestId: request.requestId,
      ownerInstanceId: SPAWNER_INSTANCE_ID,
      repository: effects,
      handler: {
        reconcile: async ({ input: effectInput, effect }) => {
          // V3 recovery is replayed through its content-addressed coordinator.
          // Reconcile must remain observation-only and must never send this
          // effect through the generic continuation-state interpreter.
          if (effect.effectType === V3_RECOVERY_COORDINATE_EFFECT_TYPE) return undefined;
          const reconciled = await reconcileRuntimeCompletionEffects({
            runId: request.runId,
            stepDbId: request.stepDbId,
            workflowStepId: request.workflowStepId,
            output: request.output,
            ...(request.storyDbId ? { storyDbId: request.storyDbId } : {}),
            ...(request.storyId ? { storyId: request.storyId } : {}),
            completionPlan: effectInput.plan,
          });
          if (!reconciled) return undefined;
          return {
            resolution: "reconciled" as const,
            result: reconciled.result,
            evidence: reconciled.evidence,
          };
        },
        apply: async ({ input: effectInput, effect, assertLease }) => {
          if (effect.effectType === V3_RECOVERY_COORDINATE_EFFECT_TYPE) {
            return executeV3RecoveryRuntimeCompletionEffect({
              completionRequestId: request.requestId,
              effectKey: effect.effectKey,
              planHash: effectInput.planHash,
              assertLease,
              coordinate: () => createPostgresV3RecoveryEffectHandler(getSql()).coordinate(effectInput.effect),
              resumeCanonicalContinuation: () => resumeRuntimeCompletionEffects({
                runId: request.runId,
                stepDbId: request.stepDbId,
                workflowStepId: request.workflowStepId,
                output: request.output,
                ...(request.storyDbId ? { storyDbId: request.storyDbId } : {}),
                ...(request.storyId ? { storyId: request.storyId } : {}),
                completionPlan: effectInput.plan,
              }),
            });
          }
          await assertLease();
          const applied = await resumeRuntimeCompletionEffects({
            runId: request.runId,
            stepDbId: request.stepDbId,
            workflowStepId: request.workflowStepId,
            output: request.output,
            ...(request.storyDbId ? { storyDbId: request.storyDbId } : {}),
            ...(request.storyId ? { storyId: request.storyId } : {}),
            completionPlan: effectInput.plan,
          });
          await assertLease();
          return {
            resolution: "applied" as const,
            result: applied,
            evidence: {
              schema: "setfarm.runtime-completion-effect-evidence.v1",
              source: "canonical-continuation-handler",
              completionRequestId: request.requestId,
              effectKey: effect.effectKey,
              planHash: effectInput.planHash,
            },
          };
        },
      },
    }))
  ));
  await completions.markEffectsCommitted({
    requestId: request.requestId,
    ownerInstanceId: SPAWNER_INSTANCE_ID,
    ownerAttemptCount: request.ownerAttemptCount,
    result,
  });
  await completions.acceptAndRelease({
    requestId: request.requestId,
    ownerInstanceId: SPAWNER_INSTANCE_ID,
    ownerAttemptCount: request.ownerAttemptCount,
    result,
  });
  if (request.storyId) {
    await cleanupQuiescedStoryWorktree(
      request.runId,
      request.storyId,
      request.claimEnvelope.claimAgentId,
      request.claimEnvelope.workdir,
    );
  }
  emitEvent({
    ts: new Date().toISOString(),
    event: "runtime.completion_accepted",
    runId: request.runId,
    workflowId: request.workflowStepId,
    stepId: request.workflowStepId,
    storyId: request.storyId,
    detail: `Completion ${request.requestId} accepted after runtime ${request.runtimeSessionId} drained`,
  });
}

async function executeRuntimeCompletionOwner(request: RuntimeCompletionRequest): Promise<void> {
  await withRuntimeCompletionOwnerCapability(request, () => (
    withRuntimeCompletionHeartbeat(request, () => completeStep(
      request.stepDbId,
      request.output,
      request.claimEnvelope,
      { deferContinuationToEffectLedger: true },
    ))
  ));
  await applyAndAcceptRuntimeCompletionEffects(request);
}

async function resumeRuntimeCompletionOwnerEffects(request: RuntimeCompletionRequest): Promise<void> {
  await applyAndAcceptRuntimeCompletionEffects(request);
}

async function runRuntimeCompletionProcessor(requestId?: string): Promise<number> {
  const completions = createRuntimeCompletionRepository(getSql());
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  let processed = 0;

  for (;;) {
    const recovered = await completions.recoverExpiredProcessing({
      ownerInstanceId: SPAWNER_INSTANCE_ID,
    });
    if (recovered.status === "none") break;
    if (!recovered.request) continue;
    processed += 1;
    if (recovered.status === "preempted") {
      emitEvent({
        ts: new Date().toISOString(),
        event: "runtime.completion_rejected",
        runId: recovered.request.runId,
        workflowId: recovered.request.workflowStepId,
        stepId: recovered.request.workflowStepId,
        storyId: recovered.request.storyId,
        detail: recovered.request.diagnostic || "Completion preempted before owner commit",
      });
      continue;
    }
    try {
      if (recovered.status === "finalize") {
        await finalizeRecoveredRuntimeCompletion(recovered.request);
      } else if (recovered.status === "resume_owner") {
        await executeRuntimeCompletionOwner(recovered.request);
      } else if (recovered.status === "resume_effects") {
        await resumeRuntimeCompletionOwnerEffects(recovered.request);
      } else {
        const session = await runtimeSessions.findById(recovered.request.runtimeSessionId);
        if (session && !["released", "quarantined"].includes(session.state)) {
          await runtimeSessions.quarantine({
            sessionId: session.sessionId,
            expectedOwnerInstanceId: session.ownerInstanceId,
            expectedStateVersion: session.stateVersion,
            diagnostic: recovered.request.diagnostic || "Expired completion processing was not safely replayable",
            evidence: { completionRequestId: recovered.request.requestId },
          });
        }
      }
    } catch (error) {
      await quarantineRuntimeCompletion(recovered.request, error);
    }
  }

  const candidates = requestId
    ? [await completions.findById(requestId)].filter((value): value is RuntimeCompletionRequest => Boolean(value))
    : await completions.listPending(50);
  for (const candidate of candidates) {
    if (["accepted", "rejected", "quarantined", "processing"].includes(candidate.state)) continue;
    const owned = await completions.claim({
      requestId: candidate.requestId,
      ownerInstanceId: SPAWNER_INSTANCE_ID,
    });
    if (!owned) continue;
    processed += 1;
    emitEvent({
      ts: new Date().toISOString(),
      event: "runtime.drain_requested",
      runId: owned.runId,
      workflowId: owned.workflowStepId,
      stepId: owned.workflowStepId,
      storyId: owned.storyId,
      detail: `Completion ${owned.requestId} claimed by ${SPAWNER_INSTANCE_ID}`,
    });
    try {
      let session = await runtimeSessions.findById(owned.runtimeSessionId);
      if (!session) throw new Error("RUNTIME_COMPLETION_SESSION_NOT_FOUND");
      if (session.state === "quarantined") throw new Error("RUNTIME_COMPLETION_SESSION_ALREADY_QUARANTINED");
      if (!["drained", "released"].includes(session.state)) {
        if (session.state !== "drain_requested") {
          session = await runtimeSessions.requestDrain({
            sessionId: session.sessionId,
            diagnostic: `Completion ${owned.requestId} requested exact runtime drain`,
          });
        }
        await drainDurableRuntimeSession(session, { requestId: owned.requestId });
        session = (await runtimeSessions.findById(owned.runtimeSessionId))!;
      }
      if (session.state === "released") {
        throw new Error("RUNTIME_COMPLETION_SESSION_RELEASED_BEFORE_CLAIM_TERMINAL");
      }
      const processing = await completions.markProcessing({
        requestId: owned.requestId,
        ownerInstanceId: SPAWNER_INSTANCE_ID,
      });
      await executeRuntimeCompletionOwner(processing);
    } catch (error) {
      await quarantineRuntimeCompletion(owned, error);
    }
  }
  return processed;
}

async function runRunTerminationProcessor(requestId?: string): Promise<number> {
  const terminations = createRunTerminationRepository(getSql());
  const runtimeSessions = createRuntimeSessionRepository(getSql());
  const candidates = requestId
    ? [await terminations.findById(requestId)].filter((value): value is RunTerminationRequest => Boolean(value))
    : await terminations.listPending(50);

  const publishTerminalized = async (request: RunTerminationRequest): Promise<void> => {
    const event = request.targetStatus === "cancelled" ? "run.cancelled" : "run.failed";
    emitEvent({
      ts: new Date().toISOString(),
      event,
      runId: request.runId,
      detail: request.diagnostic,
    });
    scheduleRunCronTeardown(request.runId);
    const channel = request.targetStatus === "cancelled" ? "run_cancelled" : "run_failed";
    try {
      await pgRun("SELECT pg_notify($1, $2)", [
        channel,
        JSON.stringify({ runId: request.runId, requestId: request.requestId }),
      ]);
    } catch {
      // Terminal state and outbox are durable; this notification is advisory.
    }
  };

  return processRunTerminationBatch({
    candidates,
    async process(candidate) {
      if (candidate.state === "drained") {
        await terminations.terminalize({ requestId: candidate.requestId });
        await publishTerminalized(candidate);
        return "processed";
      }
      const owned = await terminations.claim({
        requestId: candidate.requestId,
        ownerInstanceId: SPAWNER_INSTANCE_ID,
        leaseMs: 30_000,
      });
      if (!owned) return "skipped";
      emitEvent({
        ts: new Date().toISOString(),
        event: "runtime.drain_requested",
        runId: owned.runId,
        detail: `Termination ${owned.requestId} claimed by ${SPAWNER_INSTANCE_ID}`,
      });
      const sessions = await runtimeSessions.listRecoverable({ runId: owned.runId, limit: 500 });
      if (!owned.ownerInstanceId) throw new Error("RUN_TERMINATION_OWNER_IDENTITY_MISSING");
      for (const session of sessions) {
        if (["drained", "released"].includes(session.state)) continue;
        await drainDurableRuntimeSession(session, {
          requestId: owned.requestId,
          terminationOwnerInstanceId: owned.ownerInstanceId,
        });
        await terminations.heartbeat({
          requestId: owned.requestId,
          ownerInstanceId: SPAWNER_INSTANCE_ID,
          leaseMs: 30_000,
        });
      }
      await terminations.markDrained({
        requestId: owned.requestId,
        ownerInstanceId: SPAWNER_INSTANCE_ID,
        evidence: { runtimeSessionCount: sessions.length, ownerInstanceId: SPAWNER_INSTANCE_ID },
      });
      await terminations.terminalize({ requestId: owned.requestId });
      await publishTerminalized(owned);
      return "processed";
    },
    async quarantine(candidate, diagnostic) {
      await terminations.quarantine({
        requestId: candidate.requestId,
        diagnostic,
        evidence: { ownerInstanceId: SPAWNER_INSTANCE_ID },
      });
    },
    warn(message) {
      console.warn(`[spawner] ${message}`);
    },
  });
}

async function runOperationalOutboxProcessor(): Promise<number> {
  const sql = getSql();
  const publisher = createOperationalOutboxPublisher({
    repository: createOperationalOutboxRepository(sql),
    ownerInstanceId: `${SPAWNER_INSTANCE_ID}:operational-outbox`,
  });
  const published = await publisher.drain({ maxEvents: 100 });
  const deliveries = createOperationalEventDeliveryRepository(sql);
  const jsonl = createOperationalEventDeliveryConsumer({
    repository: deliveries,
    consumer: "jsonl",
    ownerInstanceId: `${SPAWNER_INSTANCE_ID}:operational-jsonl`,
    sink(delivery) {
      return {
        outcome: "delivered",
        result: projectOperationalEventToJsonl(delivery.event),
      };
    },
  });
  const webhook = createOperationalEventDeliveryConsumer({
    repository: deliveries,
    consumer: "webhook",
    ownerInstanceId: `${SPAWNER_INSTANCE_ID}:operational-webhook`,
    sink(delivery) {
      return deliverOperationalEventWebhook(delivery.event);
    },
  });
  const [jsonlResult, webhookResult] = await Promise.all([
    jsonl.drain({ maxDeliveries: 100 }),
    webhook.drain({ maxDeliveries: 100 }),
  ]);
  return published.claimed + jsonlResult.claimed + webhookResult.claimed;
}

let v3RecoveryLifecycleReconcileInFlight = false;
let v3EvidenceOnlyRecoveryInFlight = false;

async function reconcileV3RecoveryLifecycle(): Promise<void> {
  if (v3RecoveryLifecycleReconcileInFlight) return;
  v3RecoveryLifecycleReconcileInFlight = true;
  try {
    const reconciler = createV3RecoveryLifecycleReconciler(getSql());
    const reports = [await reconciler.reconcileActive({ limit: 100 })];
    const runtimeSessions = createRuntimeSessionRepository(getSql());
    const followUpRunIds = new Set<string>();
    for (const event of reports[0]!.events) {
      if (event.action !== "request_runtime_drain" || !event.runtimeSessionId) continue;
      followUpRunIds.add(event.runId);
      const session = await runtimeSessions.findById(event.runtimeSessionId);
      if (!session) {
        console.warn(`[spawner] v3 recovery runtime ${event.runtimeSessionId} disappeared before exact drain`);
        continue;
      }
      if (session.state !== "drain_requested") continue;
      try {
        await drainDurableRuntimeSession(session, {
          requestId: `v3-recovery-owner-${event.dispatchId}`,
        });
      } catch (error) {
        // drainDurableRuntimeSession durably quarantines failed absence proof.
        // The bounded follow-up pass terminalizes that exact owner chain.
        console.warn(`[spawner] v3 recovery runtime drain failed closed: ${String(error).slice(0, 300)}`);
      }
    }
    for (const runId of followUpRunIds) {
      reports.push(await reconciler.reconcileActive({ runId, limit: 100 }));
    }
    const scanned = reports.reduce((sum, report) => sum + report.counts.scanned, 0);
    const repaired = reports.reduce((sum, report) => sum + report.counts.repaired, 0);
    const quarantined = reports.reduce((sum, report) => sum + report.counts.quarantined, 0);
    if (repaired > 0 || quarantined > 0) {
      console.warn(
        `[spawner] v3 recovery lifecycle scanned=${scanned} repaired=${repaired} quarantined=${quarantined}`,
      );
    }
  } catch (error) {
    console.warn(`[spawner] v3 recovery lifecycle reconciliation unavailable: ${String(error).slice(0, 300)}`);
  } finally {
    v3RecoveryLifecycleReconcileInFlight = false;
  }
}

async function runV3EvidenceOnlyRecovery(): Promise<void> {
  if (v3EvidenceOnlyRecoveryInFlight || shuttingDown) return;
  v3EvidenceOnlyRecoveryInFlight = true;
  try {
    const workflows = await pgQuery<{ workflow_id: string }>(
      `SELECT DISTINCT run_row.workflow_id
         FROM recovery_dispatch_deliveries delivery
         JOIN recovery_revision_dispatches dispatch
           ON dispatch.dispatch_id = delivery.dispatch_id
          AND dispatch.revision_id = delivery.revision_id
         JOIN recovery_case_revisions revision
           ON revision.revision_id = delivery.revision_id
          AND revision.recovery_case_id = delivery.recovery_case_id
         JOIN recovery_cases recovery_case
           ON recovery_case.recovery_case_id = delivery.recovery_case_id
          AND recovery_case.current_revision_id = revision.revision_id
         JOIN runs run_row
           ON run_row.id = delivery.run_id
        WHERE run_row.protocol = 'v3'
          AND run_row.status IN ('running', 'resuming')
          AND dispatch.dispatch_class = 'evidence_only'
          AND revision.owner = 'infrastructure'
          AND recovery_case.owner = 'infrastructure'
          AND recovery_case.status = 'evidencing'
          AND delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
        ORDER BY run_row.workflow_id
        LIMIT 20`,
    );
    if (workflows.length === 0) return;
    const sql = getSql();
    const worker = createV3EvidenceOnlyRecoveryWorker(
      sql,
      createV3EvidenceOnlyRuntimeDependencies(sql),
    );
    let processed = 0;
    for (const workflow of workflows) {
      if (processed >= 5 || shuttingDown) break;
      try {
        const result = await worker.runNext({
          workflowId: workflow.workflow_id,
          ownerInstanceId: `${SPAWNER_INSTANCE_ID}:v3-evidence-only`,
          leaseMs: 30 * 60 * 1_000,
        });
        if (!result) continue;
        processed += 1;
        console.warn(
          `[spawner] v3 evidence-only ${result.execution} attempt=${result.attemptId} dispatch=${result.lease.dispatchId} outcome=${result.coordinator.status}`,
        );
      } catch (error) {
        console.warn(
          `[spawner] v3 evidence-only recovery unavailable for ${workflow.workflow_id}: ${String(error).slice(0, 300)}`,
        );
      }
    }
  } finally {
    v3EvidenceOnlyRecoveryInFlight = false;
  }
}

const runRecoveryCoordinator = createRunRecoveryCoordinator({
  processTerminations: () => runRunTerminationProcessor(),
  processCompletions: () => runRuntimeCompletionProcessor(),
  processOutbox: () => runOperationalOutboxProcessor(),
});

function processRuntimeCompletionRequests(requestId?: string): Promise<void> {
  return runRecoveryCoordinator.signal(`runtime-completion:${requestId ?? "poll"}`);
}

function processRunTerminationRequests(requestId?: string): Promise<void> {
  return runRecoveryCoordinator.signal(`run-termination:${requestId ?? "poll"}`);
}

async function handleStepPending(payload: { agentId: string; runId: string; stepId: string }) {
  if (shuttingDown) return;
  let { agentId, runId, stepId } = payload;
  if (!agentId && runId && stepId) {
    const step = await pgGet<{ agent_id: string }>(
      "SELECT agent_id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
      [runId, stepId],
    );
    agentId = step?.agent_id || "";
  }
  if (!agentId) {
    console.warn(`[spawner] step_pending ignored without agentId for ${runId || "unknown-run"}/${stepId || "unknown-step"}`);
    return;
  }
  const run = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
  if (!run) return;
  const wfId = run.workflow_id;
  const role = agentId.replace(`${wfId}_`, "");
  try {
    const pendingStep = await pgGet<{ type: string; loop_config: string | null }>(
      "SELECT type, loop_config FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
      [runId, stepId],
    );
    if (pendingStep?.type === "loop" && pendingStep.loop_config) {
      const loopConfig = JSON.parse(pendingStep.loop_config);
      if (loopConfig.verifyEach && loopConfig.verifyStep) {
        const awaitingVerify = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
          [runId],
        );
        const activeQaFix = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending', 'running')",
          [runId],
        );
        const activeStory = await pgGet<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_SQL}`,
          [runId],
        );
        if (parseInt(awaitingVerify?.cnt || "0", 10) > 0 && parseInt(activeStory?.cnt || "0", 10) === 0 && parseInt(activeQaFix?.cnt || "0", 10) === 0) {
          console.log(`[spawner] Loop pending but ${awaitingVerify?.cnt || "0"} done story/stories await verify; skip ${wfId}/${role}`);
          return;
        }
      }
    }
    const wf = await loadWorkflowSpec(resolveWorkflowDir(wfId));
    const agents = resolveAgentId(wfId, role, wf.agent_mapping ?? {});
    if (agents[0]) spawnAgent(agents[0], wfId, role);
  } catch (err) { console.error(`[spawner] step handler: ${String(err)}`); }
}

async function handleStoryPending(payload: { role: string; runId: string; storyId: string }) {
  if (shuttingDown) return;
  const { role, runId } = payload;
  const run = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
  if (!run) return;
  const wfId = run.workflow_id;
  try {
    const loopStep = await pgGet<{ loop_config: string | null }>("SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND status = 'running' LIMIT 1", [runId]);
    if (!loopStep) {
      console.log(`[spawner] Story pending but loop step not running for ${wfId}/${role}, skip`);
      return;
    }
    const loopConfig = loopStep.loop_config ? JSON.parse(loopStep.loop_config) : {};
    if (loopConfig.verifyEach && loopConfig.verifyStep) {
      const awaitingVerify = await pgGet<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
        [runId],
      );
      const activeQaFix = await pgGet<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending', 'running')",
        [runId],
      );
      const activeStory = await pgGet<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_SQL}`,
        [runId],
      );
      if (parseInt(awaitingVerify?.cnt || "0", 10) > 0 && parseInt(activeStory?.cnt || "0", 10) === 0 && parseInt(activeQaFix?.cnt || "0", 10) === 0) {
        console.log(`[spawner] Story pending but ${awaitingVerify?.cnt || "0"} done story/stories await verify; skip developer for ${wfId}`);
        return;
      }
    }
    const wf = await loadWorkflowSpec(resolveWorkflowDir(wfId));
    const agents = resolveAgentId(wfId, role, wf.agent_mapping ?? {});
    const cnt = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'running'", [runId]);
    const running = parseInt(cnt?.cnt || "0", 10);
    const parallelCount = loopConfig.parallelCount || 3;
    const slots = parallelCount - running;
    if (slots <= 0) { console.log(`[spawner] No slots for ${wfId}/${role} (${running}/${parallelCount})`); return; }
    const n = Math.min(slots, agents.length);
    for (let i = 0; i < n; i++) spawnAgent(agents[i % agents.length], wfId, role);
  } catch (err) { console.error(`[spawner] story handler: ${String(err)}`); }
}

async function handleV3RecoveryPending(payload: {
  runId: string;
  dispatchClass: "product_implementation" | "supervisor_repair";
}): Promise<void> {
  if (shuttingDown) return;
  const run = await pgGet<{ workflow_id: string }>(
    "SELECT workflow_id FROM runs WHERE id = $1 AND protocol = 'v3' AND status IN ('running', 'resuming')",
    [payload.runId],
  );
  if (!run) return;
  const role = payload.dispatchClass === "product_implementation" ? "developer" : "supervisor";
  try {
    const workflow = await loadWorkflowSpec(resolveWorkflowDir(run.workflow_id));
    const agents = resolveAgentId(run.workflow_id, role, workflow.agent_mapping ?? {});
    for (const agent of agents) spawnAgent(agent, run.workflow_id, role);
  } catch (error) {
    console.error(`[spawner] v3 recovery handler: ${String(error).slice(0, 300)}`);
  }
}

async function spawnPendingV3RecoveryWork(): Promise<void> {
  const rows = await pgQuery<{
    run_id: string;
    dispatch_class: "product_implementation" | "supervisor_repair";
  }>(
    `SELECT DISTINCT ON (delivery.run_id, dispatch.dispatch_class)
            delivery.run_id, dispatch.dispatch_class
       FROM recovery_dispatch_deliveries delivery
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = delivery.dispatch_id
        AND dispatch.revision_id = delivery.revision_id
        AND dispatch.recovery_case_id = delivery.recovery_case_id
       JOIN recovery_case_revisions revision
         ON revision.revision_id = delivery.revision_id
        AND revision.recovery_case_id = delivery.recovery_case_id
       JOIN recovery_cases recovery_case
         ON recovery_case.recovery_case_id = delivery.recovery_case_id
        AND recovery_case.current_revision_id = delivery.revision_id
        AND recovery_case.run_id = delivery.run_id
        AND recovery_case.story_id = delivery.story_id
       JOIN runs run_row
         ON run_row.id = delivery.run_id
        AND run_row.protocol = 'v3'
        AND run_row.status IN ('running', 'resuming')
       JOIN stories story_row
         ON story_row.run_id = delivery.run_id
        AND story_row.story_id = delivery.story_id
        AND story_row.status = 'failed'
       JOIN steps step_row
         ON step_row.run_id = delivery.run_id
        AND step_row.step_id = 'implement'
        AND step_row.type = 'loop'
        AND step_row.status IN ('pending', 'running')
      WHERE dispatch.dispatch_class IN ('product_implementation', 'supervisor_repair')
        AND (
          (dispatch.dispatch_class = 'product_implementation' AND revision.owner = 'implement')
          OR (dispatch.dispatch_class = 'supervisor_repair' AND revision.owner = 'supervisor')
        )
        AND (
          delivery.state = 'authorized'
          OR (delivery.state = 'leased' AND delivery.lease_expires_at <= CURRENT_TIMESTAMP)
        )
        AND dispatch.packet_hash = revision.packet_hash
        AND dispatch.contract_slice_hash = revision.contract_slice_hash
        AND dispatch.finding_set_hash = revision.finding_set_hash
        AND dispatch.source_sha = revision.source_sha
        AND dispatch.source_tree_hash = revision.source_tree_hash
      ORDER BY delivery.run_id, dispatch.dispatch_class, delivery.authorized_at, delivery.dispatch_id
      LIMIT 20`,
  );
  for (const row of rows) {
    await handleV3RecoveryPending({
      runId: row.run_id,
      dispatchClass: row.dispatch_class,
    });
  }
}

async function advanceCompletedVerifyEachLoops(): Promise<void> {
  const rows = await pgQuery<{ run_id: string; loop_step_id: string }>(
    `SELECT r.id as run_id, loop_step.id as loop_step_id
     FROM runs r
     JOIN steps loop_step ON loop_step.run_id = r.id
     WHERE r.status = 'running'
       AND loop_step.type = 'loop'
       AND loop_step.status = 'running'
       AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
       AND EXISTS (
         SELECT 1 FROM stories any_st
         WHERE any_st.run_id = r.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM stories st
         WHERE st.run_id = r.id
           AND st.status IN ('pending', 'running', 'done', 'failed')
       )
     ORDER BY loop_step.updated_at ASC
     LIMIT 10`
  );
  if (rows.length === 0) return;
  const { checkLoopContinuation } = await import("./installer/step-advance.js");
  for (const row of rows) {
    console.log(`[spawner] Advancing completed verify-each loop for run ${row.run_id.slice(0, 8)}`);
    await checkLoopContinuation(row.run_id, row.loop_step_id);
  }
}

async function autoVerifyMergedPrEachStories() {
  try {
    const rows = await pgQuery<{ run_id: string; context: string | null; loop_step_id: string; loop_config: string | null }>(
      `SELECT DISTINCT r.id as run_id, r.context, loop_step.id as loop_step_id
              , loop_step.loop_config
       FROM runs r
       JOIN steps loop_step ON loop_step.run_id = r.id
       WHERE r.status = 'running'
         AND loop_step.type = 'loop'
         AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
         AND NOT EXISTS (
           SELECT 1 FROM steps verify_step
           WHERE verify_step.run_id = r.id
             AND verify_step.step_id = COALESCE(loop_step.loop_config::jsonb->>'verifyStep', 'verify')
             AND verify_step.status = 'running'
         )
         AND EXISTS (
           SELECT 1 FROM stories st
           WHERE st.run_id = r.id AND st.status = 'done' AND st.pr_url IS NOT NULL
         )
       LIMIT 10`
    );
    if (rows.length === 0) return;
    const { autoVerifyDoneStories } = await import("./installer/step-ops.js");
    const { checkLoopContinuation } = await import("./installer/step-advance.js");
    for (const row of rows) {
      let context: Record<string, string> = {};
      try { context = row.context ? JSON.parse(row.context) : {}; } catch {}
      const nextUnverified = await autoVerifyDoneStories(row.run_id, context, "spawner-auto-verify");
      if (!nextUnverified) {
        await checkLoopContinuation(row.run_id, row.loop_step_id);
      } else {
        let verifyStepName = "verify";
        try { verifyStepName = JSON.parse(row.loop_config || "{}").verifyStep || "verify"; } catch {}
        await pgRun(
          "UPDATE steps SET status = 'pending', updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('waiting', 'done', 'pending')",
          [row.run_id, verifyStepName],
        );
      }
    }
  } catch (err) {
    console.error(`[spawner] auto-verify merged PRs: ${String(err)}`);
  }
}

async function queuePendingSuperviseEachSteps(): Promise<void> {
  try {
    const rows = await pgQuery<{ run_id: string; step_id: string; story_id: string; verify_step: string }>(
      `WITH candidates AS (
         SELECT DISTINCT ON (sup.id)
           sup.id AS supervise_step_id,
           sup.run_id,
           sup.step_id,
           st.id AS story_db_id,
           st.story_id,
           COALESCE(NULLIF(loop_step.loop_config::jsonb ->> 'verifyStep', ''), 'verify') AS verify_step
         FROM steps sup
         JOIN runs r ON r.id = sup.run_id AND r.status = 'running' AND r.protocol <> 'v3'
         JOIN steps loop_step
           ON loop_step.run_id = sup.run_id
          AND loop_step.type = 'loop'
          AND loop_step.step_id = 'implement'
          AND loop_step.status = 'running'
          AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"superviseEach":true}'::jsonb
         JOIN stories st
           ON st.run_id = sup.run_id
          AND st.status = 'done'
         WHERE sup.step_id = COALESCE(NULLIF(loop_step.loop_config::jsonb ->> 'superviseStep', ''), 'supervise')
           AND sup.status IN ('waiting', 'done', 'pending')
           AND NOT EXISTS (
             SELECT 1 FROM run_observations supervised_obs
             WHERE supervised_obs.run_id = sup.run_id
               AND supervised_obs.step_id = sup.step_id
               AND supervised_obs.story_id = st.story_id
               AND supervised_obs.status = 'pass'
               AND supervised_obs.label = 'Supervisor decision'
               AND supervised_obs.created_at >= COALESCE((
                 SELECT MAX(evidence_marker.created_at)
                 FROM run_observations evidence_marker
                 WHERE evidence_marker.run_id = sup.run_id
                   AND evidence_marker.step_id = 'implement'
                   AND evidence_marker.story_id = st.story_id
                   AND evidence_marker.check_id = 'implement.evidence'
                   AND evidence_marker.status = 'pass'
               ), TIMESTAMP 'epoch')
           )
           AND NOT EXISTS (
             SELECT 1 FROM stories active_st
             WHERE active_st.run_id = sup.run_id
               AND active_st.status IN ('pending', 'running')
               AND ${ACTIVE_RETRY_STORY_ALIAS_SQL}
           )
           AND NOT EXISTS (
             SELECT 1 FROM stories fix_st
             WHERE fix_st.run_id = sup.run_id
               AND fix_st.story_id LIKE 'QA-FIX-%'
               AND fix_st.status IN ('pending', 'running')
           )
         ORDER BY sup.id, st.story_index ASC
       ),
       queued AS (
         UPDATE steps sup
         SET status = 'pending',
             current_story_id = c.story_db_id,
             updated_at = NOW()
         FROM candidates c
         WHERE sup.id = c.supervise_step_id
         RETURNING sup.run_id, sup.step_id, c.story_id, c.verify_step
       )
       SELECT * FROM queued`
    );

    for (const row of rows) {
      await pgRun(
        "UPDATE steps SET status = 'waiting', current_story_id = NULL, updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status = 'pending'",
        [row.run_id, row.verify_step],
      );
      console.log(`[spawner] Queued supervise_each story ${row.story_id} for ${row.step_id}; reviewer waits for supervisor`);
    }
  } catch (err) {
    console.error(`[spawner] queue supervise_each: ${String(err)}`);
  }
}

function markSupervisedStoryInSpawnerContext(context: Record<string, any>, storyId: string): void {
  const ids = new Set(
    String(context.supervised_story_ids || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  ids.add(storyId);
  context.supervised_story_ids = Array.from(ids).sort().join(",");
}

function clearVerifyFailureContextInSpawner(context: Record<string, any>): void {
  delete context.verify_feedback;
  delete context.previous_failure;
  delete context.failure_category;
  delete context.failure_suggestion;
  delete context.verify_infra_retry;
  delete context.verify_visual_scope_deferred;
  delete context.verify_pending_pr_url;
  delete context.verify_pending_since;
}

async function autoPassEvidenceReadySuperviseEachSteps(): Promise<void> {
  try {
    const rows = await pgQuery<{
      run_id: string;
      context: string | null;
      supervise_step_db_id: string;
      supervise_step_id: string;
      loop_step_db_id: string;
      verify_step_db_id: string;
      story_db_id: string;
      story_id: string;
      story_title: string | null;
      story_branch: string | null;
      pr_url: string | null;
      verify_step: string;
    }>(
      `WITH candidates AS (
         SELECT DISTINCT ON (sup.id)
           sup.id AS supervise_step_db_id,
           sup.run_id,
           r.context::text AS context,
           sup.step_id AS supervise_step_id,
           loop_step.id AS loop_step_db_id,
           verify_step.id AS verify_step_db_id,
           st.id AS story_db_id,
           st.story_id,
           st.title AS story_title,
           st.story_branch,
           st.pr_url,
           COALESCE(NULLIF(loop_step.loop_config::jsonb ->> 'verifyStep', ''), 'verify') AS verify_step
         FROM steps sup
         JOIN runs r ON r.id = sup.run_id AND r.status = 'running' AND r.protocol <> 'v3'
         JOIN steps loop_step
           ON loop_step.run_id = sup.run_id
          AND loop_step.type = 'loop'
          AND loop_step.step_id = 'implement'
          AND loop_step.status = 'running'
          AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"superviseEach":true}'::jsonb
         JOIN stories st
           ON st.run_id = sup.run_id
          AND st.status = 'done'
         JOIN steps verify_step
           ON verify_step.run_id = sup.run_id
          AND verify_step.step_id = COALESCE(NULLIF(loop_step.loop_config::jsonb ->> 'verifyStep', ''), 'verify')
          AND verify_step.status IN ('waiting', 'done', 'pending')
         WHERE sup.step_id = COALESCE(NULLIF(loop_step.loop_config::jsonb ->> 'superviseStep', ''), 'supervise')
           AND sup.status IN ('waiting', 'done', 'pending', 'running')
           AND NOT EXISTS (
             SELECT 1 FROM run_observations supervised_obs
             WHERE supervised_obs.run_id = sup.run_id
               AND supervised_obs.step_id = sup.step_id
               AND supervised_obs.story_id = st.story_id
               AND supervised_obs.status = 'pass'
               AND supervised_obs.label = 'Supervisor decision'
               AND supervised_obs.created_at >= COALESCE((
                 SELECT MAX(evidence_marker.created_at)
                 FROM run_observations evidence_marker
                 WHERE evidence_marker.run_id = sup.run_id
                   AND evidence_marker.step_id = 'implement'
                   AND evidence_marker.story_id = st.story_id
                   AND evidence_marker.check_id = 'implement.evidence'
                   AND evidence_marker.status = 'pass'
               ), TIMESTAMP 'epoch')
           )
           AND EXISTS (
             SELECT 1 FROM run_observations evidence_obs
             WHERE evidence_obs.run_id = sup.run_id
               AND evidence_obs.step_id = 'implement'
               AND evidence_obs.story_id = st.story_id
               AND evidence_obs.check_id = 'implement.evidence'
               AND evidence_obs.status = 'pass'
           )
           AND EXISTS (
             SELECT 1 FROM run_observations product_obs
             WHERE product_obs.run_id = sup.run_id
               AND product_obs.step_id = 'implement'
               AND product_obs.story_id = st.story_id
               AND product_obs.check_id = 'implement.product_supervisor'
               AND product_obs.status = 'pass'
           )
           AND NOT EXISTS (
             SELECT 1 FROM run_observations blocker_obs
             WHERE blocker_obs.run_id = sup.run_id
               AND blocker_obs.story_id = st.story_id
               AND blocker_obs.status IN ('fail', 'blocked')
               AND blocker_obs.check_id IN (
                 'supervise_each.supervisor_evidence_blocked',
                 'verify_each.supervisor_evidence_blocked'
               )
           )
         ORDER BY sup.id, st.story_index ASC
       )
       SELECT * FROM candidates`
    );

    for (const row of rows) {
      try {
        const activeOwners = [...activeProcesses.entries()].filter(([, active]) =>
          active.runId === row.run_id && active.stepId === row.supervise_step_db_id
        );
        for (const [key, active] of activeOwners) {
          terminateActiveProcess(active, "supervise-each-deterministic-auto-pass");
          activeProcesses.delete(key);
          await waitForClaimRuntimeQuiescence(active.runId, active.storyId, active.claimAgentId);
        }

        let context: Record<string, any> = {};
        try {
          context = row.context ? JSON.parse(row.context) : {};
        } catch {
          context = {};
        }
        markSupervisedStoryInSpawnerContext(context, row.story_id);
        clearVerifyFailureContextInSpawner(context);
        context.supervisor_scope = "story";
        context.current_story_id = row.story_id;
        context.current_story_title = row.story_title || "";
        if (row.pr_url) context.pr_url = row.pr_url;
        if (row.story_branch) context.story_branch = row.story_branch;

        const detail = "implement evidence and implement product-supervisor gate already passed; no LLM story-supervisor spawned";
        const output = [
          "STATUS: done",
          "SUPERVISOR_DECISION: pass",
          `AC_COVERAGE: ${detail}`,
          "SUPERVISOR_MEMORY_APPEND: deterministic story supervisor accepted Setfarm-owned implement evidence.",
          "CHECKS: implement.evidence pass; implement.product_supervisor pass",
          "CHANGES: none",
          "RISKS: none",
        ].join("\n");
        const observationId = crypto.randomUUID();

        await pgBegin(async (sql) => {
          await closeUniqueSingleStepClaimForRecoveryInTransaction(sql, {
            runId: row.run_id,
            stepDbId: row.supervise_step_db_id,
            workflowStepId: row.supervise_step_id,
            outcome: "completed",
            diagnostic: "deterministic supervise_each auto-pass from canonical implement evidence",
            runtimeAgentId: "deterministic-supervisor-policy",
          });

          const evidenceReady = await sql.unsafe<Array<{ id: string }>>(
            `SELECT st.id
               FROM stories st
              WHERE st.id = $1
                AND st.run_id = $2
                AND st.status = 'done'
                AND EXISTS (
                  SELECT 1 FROM run_observations evidence_obs
                   WHERE evidence_obs.run_id = st.run_id
                     AND evidence_obs.step_id = 'implement'
                     AND evidence_obs.story_id = st.story_id
                     AND evidence_obs.check_id = 'implement.evidence'
                     AND evidence_obs.status = 'pass'
                )
                AND EXISTS (
                  SELECT 1 FROM run_observations product_obs
                   WHERE product_obs.run_id = st.run_id
                     AND product_obs.step_id = 'implement'
                     AND product_obs.story_id = st.story_id
                     AND product_obs.check_id = 'implement.product_supervisor'
                     AND product_obs.status = 'pass'
                )
                AND NOT EXISTS (
                  SELECT 1 FROM run_observations blocker_obs
                   WHERE blocker_obs.run_id = st.run_id
                     AND blocker_obs.story_id = st.story_id
                     AND blocker_obs.status IN ('fail', 'blocked')
                     AND blocker_obs.check_id IN (
                       'supervise_each.supervisor_evidence_blocked',
                       'verify_each.supervisor_evidence_blocked'
                     )
                )
              FOR UPDATE OF st`,
            [row.story_db_id, row.run_id],
          );
          if (evidenceReady.length !== 1) throw new Error("SUPERVISE_AUTO_PASS_EVIDENCE_CHANGED");

          const runUpdated = await sql.unsafe<Array<{ id: string }>>(
            `UPDATE runs
                SET context = $2, updated_at = NOW()
              WHERE id = $1 AND status = 'running'
              RETURNING id`,
            [row.run_id, JSON.stringify(context)],
          );
          if (runUpdated.length !== 1) throw new Error("SUPERVISE_AUTO_PASS_RUN_CAS_LOST");
          const supervisorUpdated = await sql.unsafe<Array<{ id: string }>>(
            `UPDATE steps
                SET status = 'waiting', output = $2, current_story_id = NULL, updated_at = NOW()
              WHERE id = $1 AND status IN ('waiting', 'done', 'pending', 'running')
              RETURNING id`,
            [row.supervise_step_db_id, output],
          );
          if (supervisorUpdated.length !== 1) throw new Error("SUPERVISE_AUTO_PASS_STEP_CAS_LOST");
          const loopUpdated = await sql.unsafe<Array<{ id: string }>>(
            `UPDATE steps
                SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
              WHERE id = $1 AND run_id = $2
              RETURNING id`,
            [row.loop_step_db_id, row.run_id],
          );
          if (loopUpdated.length !== 1) throw new Error("SUPERVISE_AUTO_PASS_LOOP_CAS_LOST");
          const verifyUpdated = await sql.unsafe<Array<{ id: string }>>(
            `UPDATE steps
                SET status = 'pending', current_story_id = NULL, updated_at = NOW()
              WHERE id = $1
                AND run_id = $2
                AND step_id = $3
                AND status IN ('waiting', 'done', 'pending')
              RETURNING id`,
            [row.verify_step_db_id, row.run_id, row.verify_step],
          );
          if (verifyUpdated.length !== 1) throw new Error("SUPERVISE_AUTO_PASS_VERIFY_CAS_LOST");
          await sql.unsafe(
            `INSERT INTO run_observations (
               id, run_id, step_id, story_id, phase, check_id, label, status,
               detail, evidence, file_paths, github, metadata, event_type,
               completed_at, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $3, 'supervise_each.deterministic_story_auto_pass',
               'Supervisor decision', 'pass', $5, '{}', '[]', '{}', $6,
               'supervise_each.deterministic_story_auto_pass', NOW(), NOW(), NOW()
             )`,
            [observationId, row.run_id, row.supervise_step_id, row.story_id, detail, JSON.stringify({ eventType: "supervise_each.deterministic_story_auto_pass" })],
          );
        });

        console.log(`[spawner] Deterministically supervised ${row.story_id}; reviewer no longer waits for LLM supervisor`);
      } catch (rowError) {
        console.warn(`[spawner] supervise_each auto-pass skipped for ${row.run_id}/${row.story_id}: ${String(rowError).slice(0, 300)}`);
      }
    }
  } catch (err) {
    console.error(`[spawner] auto-pass supervise_each: ${String(err)}`);
  }
}

async function repairCompletedSuperviseEachSteps(): Promise<void> {
  try {
    const rows = await pgQuery<{ run_id: string; run_number: number; supervise_step_db_id: string; supervise_step_id: string; output: string }>(
      `SELECT sup.run_id,
              r.run_number,
              sup.id AS supervise_step_db_id,
              sup.step_id AS supervise_step_id,
              sup.output
       FROM steps sup
       JOIN runs r ON r.id = sup.run_id AND r.status = 'running' AND r.protocol <> 'v3'
       JOIN steps loop_step
         ON loop_step.run_id = sup.run_id
        AND loop_step.type = 'loop'
        AND loop_step.step_id = 'implement'
        AND loop_step.status = 'running'
        AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"superviseEach":true}'::jsonb
       JOIN stories st
         ON st.run_id = sup.run_id
        AND st.id = sup.current_story_id
        AND st.status = 'done'
       WHERE sup.step_id = COALESCE(NULLIF(loop_step.loop_config::jsonb ->> 'superviseStep', ''), 'supervise')
         AND sup.status = 'running'
         AND sup.output ~* '(^|\\n)STATUS\\s*:\\s*done'
         AND sup.output ~* '(^|\\n)SUPERVISOR_DECISION\\s*:\\s*(pass|fixed)'
       ORDER BY sup.updated_at ASC
       LIMIT 10`,
    );
    for (const row of rows) {
      const result = await completeStep(row.supervise_step_db_id, row.output);
      for (const active of activeProcesses.values()) {
        if (active.runId === row.run_id && active.stepId === row.supervise_step_db_id) {
          terminateActiveProcess(active, "supervise-each-db-output-recovered");
        }
      }
      console.warn(`[spawner] Recovered completed supervise_each output for run #${row.run_number}: ${row.supervise_step_id}; advanced=${result.advanced} runCompleted=${result.runCompleted}`);
    }
  } catch (err) {
    console.error(`[spawner] repair completed supervise_each: ${String(err)}`);
  }
}

async function recordTerminalAttemptReconcileEvent(event: TerminalAttemptReconcileEvent): Promise<void> {
  const transition = event.code === "ATTEMPT_TERMINAL_RECONCILED"
    ? `terminalized with fallback disposition ${event.requestedDisposition}`
    : event.code === "ATTEMPT_TERMINAL_RECONCILE_RACED"
      ? `was already terminalized by another fenced owner before fallback disposition ${event.requestedDisposition} could be applied`
      : `could not be terminalized with fallback disposition ${event.requestedDisposition}`;
  await recordObservation({
    runId: event.runId,
    stepId: event.stepId,
    storyId: event.storyId,
    phase: "product-compiler-shadow",
    checkId: `product_compiler.shadow:attempt_terminal_reconcile:${event.attemptId}`,
    label: "Shadow attempt lifecycle reconciliation",
    status: event.code === "ATTEMPT_TERMINAL_RECONCILE_FAILED" ? "fail" : "info",
    summary: event.code,
    detail: `Exact legacy claim ${event.claimId} ended as ${event.claimOutcome}; attempt ${event.attemptId} ${transition}.`,
    evidence: {
      schema: "setfarm.shadow-attempt-reconciliation.v1",
      attemptId: event.attemptId,
      claimId: event.claimId,
      claimOutcome: event.claimOutcome,
      requestedDisposition: event.requestedDisposition,
    },
    metadata: {
      protocol: "shadow",
      authoritative: false,
      recoveryOwner: "terminal-claim-attempt-reconciler",
    },
    eventType: "product_compiler.shadow_attempt_reconciled",
    completedAt: new Date().toISOString(),
  });
}

async function reconcileTerminalShadowAttempts(runtimeQuiesced = false): Promise<void> {
  if (!terminalAttemptReconciler || terminalAttemptReconcileInFlight) return;
  terminalAttemptReconcileInFlight = true;
  try {
    const result = runtimeQuiesced
      ? await terminalAttemptReconciler.reconcileQuiesced({ limit: 50, runtimeQuiesced: true })
      : await terminalAttemptReconciler.reconcile({ limit: 50 });
    if (result.reconciled > 0 || result.raced > 0 || result.failed > 0) {
      console.warn(`[spawner] terminal attempt reconciliation scanned=${result.scanned} reconciled=${result.reconciled} raced=${result.raced} failed=${result.failed}`);
    }
  } catch (error) {
    console.warn(`[spawner] terminal attempt reconciliation unavailable: ${String(error).slice(0, 220)}`);
  } finally {
    terminalAttemptReconcileInFlight = false;
  }
}

async function pollForPendingWork() {
  if (shuttingDown) return;
  try {
    await processRunTerminationRequests();
    await processRuntimeCompletionRequests();
    await reconcileTerminalShadowAttempts();
    await reconcileV3RecoveryLifecycle();
    await runV3EvidenceOnlyRecovery();
    await runClaimMaintenance();
    await cleanupRunningRunOrphanedToolWorkers();
    cleanupSpawnerDetachedToolChildren("poll-orphan-sweep");
    await autoVerifyMergedPrEachStories();
    await autoPassEvidenceReadySuperviseEachSteps();
    await repairCompletedSuperviseEachSteps();
    await queuePendingSuperviseEachSteps();
    await advanceCompletedVerifyEachLoops();
    await spawnPendingV3RecoveryWork();
    const steps = await pgQuery<{ agent_id: string; run_id: string; step_id: string }>(
      `SELECT s.agent_id, s.run_id, s.step_id
       FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.status = 'pending'
         AND r.status = 'running'
         AND NOT (
           s.type = 'loop'
           AND COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
           AND EXISTS (
             SELECT 1 FROM stories done_st
             WHERE done_st.run_id = s.run_id AND done_st.status = 'done'
           )
           AND NOT EXISTS (
             SELECT 1 FROM stories active_st
             WHERE active_st.run_id = s.run_id
               AND active_st.status IN ('pending', 'running')
               AND ${ACTIVE_RETRY_STORY_ALIAS_SQL}
           )
           AND NOT EXISTS (
             SELECT 1 FROM stories fix_st
             WHERE fix_st.run_id = s.run_id
               AND fix_st.story_id LIKE 'QA-FIX-%'
               AND fix_st.status IN ('pending', 'running')
           )
         )
       ORDER BY s.step_index ASC
       LIMIT 5`
    );
    for (const s of steps) {
      await handleStepPending({ agentId: s.agent_id, runId: s.run_id, stepId: s.step_id });
    }
    const stories = await pgQuery<{ run_id: string; story_id: string }>(
      `SELECT s.run_id, s.story_id
       FROM stories s
       JOIN runs r ON r.id = s.run_id
       WHERE s.status = 'pending'
         AND r.status = 'running'
         AND EXISTS (
           SELECT 1 FROM steps loop_step
           WHERE loop_step.run_id = s.run_id
             AND loop_step.type = 'loop'
             AND loop_step.status = 'running'
         )
         AND NOT EXISTS (
           SELECT 1 FROM steps loop_step
           WHERE loop_step.run_id = s.run_id
             AND loop_step.type = 'loop'
             AND loop_step.status = 'running'
             AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
             AND EXISTS (
               SELECT 1 FROM stories done_st
               WHERE done_st.run_id = s.run_id AND done_st.status = 'done'
             )
             AND NOT EXISTS (
               SELECT 1 FROM stories active_st
               WHERE active_st.run_id = s.run_id
                 AND active_st.status IN ('pending', 'running')
                 AND ${ACTIVE_RETRY_STORY_ALIAS_SQL}
             )
             AND NOT EXISTS (
               SELECT 1 FROM stories fix_st
               WHERE fix_st.run_id = s.run_id
                 AND fix_st.story_id LIKE 'QA-FIX-%'
                 AND fix_st.status IN ('pending', 'running')
             )
         )
       ORDER BY s.story_index ASC
       LIMIT 10`
    );
    for (const st of stories) await handleStoryPending({ role: "developer", runId: st.run_id, storyId: st.story_id });
  } catch (err) { console.error(`[spawner] poll: ${String(err)}`); }
}

async function main() {
  process.on("unhandledRejection", (err) => {
    console.warn(`[spawner] unhandled rejection: ${String(err).slice(0, 500)}`);
  });

  acquireSpawnerSingletonLock();
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  assertAgentRuntimeAvailable();
  console.log(`[spawner] Starting (PID ${process.pid}, runtime=${AGENT_RUNTIME})`);
  await pgMigrate();
  terminalAttemptReconciler = createPostgresTerminalAttemptReconciler(getSql(), {
    emit: recordTerminalAttemptReconcileEvent,
  });
  await killStartupOrphanSpawnerAgents();
  await processRunTerminationRequests();
  await processRuntimeCompletionRequests();
  await reconcileV3RecoveryLifecycle();
  await runV3EvidenceOnlyRecovery();
  await failStaleRunningClaimsFromPreviousSpawner();
  await requeueOrphanedRunningStories();
  await reconcileTerminalShadowAttempts(true);
  await cleanupRunningRunEphemeraOnStartup();
  if (AGENT_RUNTIME === "openclaw") {
    await restartGatewayAfterOpenClawCleanup("startup", cleanupStaleSetfarmOpenClawTaskRecords("startup"));
  }

  const pgUrl = process.env.SETFARM_PG_URL || "postgresql://postgres@localhost:5432/setfarm";
  const listener = postgres(pgUrl, { max: 1 });
  const intervalHandles: NodeJS.Timeout[] = [];
  let shutdownPromise: Promise<number> | undefined;

  const shutdown = (): Promise<number> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      shuttingDown = true;
      for (const handle of intervalHandles) clearInterval(handle);
      console.log(`[spawner] Shutting down (${activeProcesses.size} active, ${drainingProcesses.size} draining, ${inFlightSpawnPromises.size} in-flight)`);
      try {
        await listener.end({ timeout: 5 });
      } catch (error) {
        console.warn(`[spawner] listener shutdown failed: ${String(error).slice(0, 300)}`);
      }

      await runRecoveryCoordinator.join();

      while (inFlightSpawnPromises.size > 0) {
        await Promise.allSettled([...inFlightSpawnPromises]);
      }

      const tracked = new Map<string, ActiveProcess>();
      for (const active of [...activeProcesses.values(), ...drainingProcesses.values()]) {
        tracked.set(active.runtimeSessionId, active);
      }
      const results: RuntimeReleaseResult[] = [];
      for (const active of tracked.values()) {
        results.push(await releaseActiveProcessForShutdown(active));
      }
      activeProcesses.clear();
      drainingProcesses.clear();

      const runtimeSessions = createRuntimeSessionRepository(getSql());
      const remaining = await runtimeSessions.listRecoverable({
        ownerInstanceId: SPAWNER_INSTANCE_ID,
        limit: 500,
      });
      for (const session of remaining) {
        if (tracked.has(session.sessionId) || session.state === "released") continue;
        if (session.state === "drained") {
          const handoff = await pgGet<{ request_id: string | null }>(
            `SELECT COALESCE(
                (
                  SELECT rcr.request_id
                    FROM runtime_completion_requests rcr
                   WHERE rcr.runtime_session_id = $1
                     AND rcr.state NOT IN ('accepted', 'rejected', 'quarantined')
                   LIMIT 1
                ),
                (
                  SELECT rtr.request_id
                    FROM run_termination_requests rtr
                   WHERE rtr.run_id = $2
                     AND rtr.state <> 'terminalized'
                   LIMIT 1
                )
              ) AS request_id`,
            [session.sessionId, session.runId],
          );
          if (handoff?.request_id) {
            results.push({
              status: "drained_for_termination",
              runtimeSessionId: session.sessionId,
              claimId: session.claimId,
            });
            continue;
          }
        }
        const diagnostic = `SHUTDOWN_UNTRACKED_DURABLE_RUNTIME: ${session.sessionId} remained ${session.state} after in-flight spawn drain`;
        if (session.state !== "quarantined") {
          await runtimeSessions.quarantine({
            sessionId: session.sessionId,
            expectedOwnerInstanceId: session.ownerInstanceId,
            expectedStateVersion: session.stateVersion,
            diagnostic,
            evidence: { ownerInstanceId: SPAWNER_INSTANCE_ID, shutdown: true },
          });
        }
        results.push({
          status: "quarantined",
          runtimeSessionId: session.sessionId,
          claimId: session.claimId,
          diagnostic,
        });
      }

      const failed = results.filter((result) => result.status === "quarantined");
      await runRecoveryCoordinator.close();
      await pgClose();
      try { fs.unlinkSync(PID_FILE); } catch {}
      releaseSpawnerSingletonLock();
      const exitCode = failed.length > 0 ? 1 : 0;
      process.exitCode = exitCode;
      console.log(`[spawner] Shutdown complete: ${results.length - failed.length} released/completed, ${failed.length} quarantined, exit=${exitCode}`);
      return exitCode;
    })().catch(async (error) => {
      console.error(`[spawner] Shutdown failed closed: ${String(error).slice(0, 1_000)}`);
      process.exitCode = 1;
      try { await pgClose(); } catch {}
      try { fs.unlinkSync(PID_FILE); } catch {}
      releaseSpawnerSingletonLock();
      return 1;
    });
    return shutdownPromise;
  };
  process.on("SIGTERM", () => { void shutdown(); });
  process.on("SIGINT", () => { void shutdown(); });

  await listener.listen("step_pending", (msg) => {
    try { handleStepPending(JSON.parse(msg)); } catch {}
  });
  await listener.listen("story_pending", (msg) => {
    try { handleStoryPending(JSON.parse(msg)); } catch {}
  });
  await listener.listen("run_termination_requested", (msg) => {
    try {
      const payload = JSON.parse(msg);
      if (payload?.terminationRequestId) {
        void processRunTerminationRequests(String(payload.terminationRequestId));
      } else {
        void processRunTerminationRequests();
      }
    } catch {}
  });
  await listener.listen("runtime_completion_requested", (msg) => {
    try {
      const payload = JSON.parse(msg);
      if (payload?.completionRequestId) {
        void processRuntimeCompletionRequests(String(payload.completionRequestId));
      } else {
        void processRuntimeCompletionRequests();
      }
    } catch {}
  });

  console.log("[spawner] Listening for step_pending, story_pending, run_termination_requested, and runtime_completion_requested events");
  intervalHandles.push(setInterval(pollForPendingWork, POLL_INTERVAL_MS));
  intervalHandles.push(setInterval(() => { void runClaimMaintenance(); }, Math.min(POLL_INTERVAL_MS, 10_000)));
  if (AGENT_RUNTIME === "openclaw") {
    intervalHandles.push(setInterval(() => {
      const result = cleanupStaleSetfarmOpenClawTaskRecords("interval");
      void restartGatewayAfterOpenClawCleanup("interval", result);
    }, OPENCLAW_STALE_TASK_SWEEP_MS));
  }
  await pollForPendingWork();
  console.log("[spawner] Ready");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    releaseSpawnerSingletonLock();
    console.error(`[spawner] Fatal: ${String(err)}`);
    process.exit(1);
  });
}
