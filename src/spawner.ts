/**
 * Setfarm Event-Driven Spawner
 * Listens to PostgreSQL NOTIFY events for pending steps/stories
 * and immediately spawns agent sessions via openclaw CLI.
 */
import postgres from "postgres";
import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pgClose, pgGet, pgMigrate, pgQuery, pgRun } from "./db-pg.js";
import { loadWorkflowSpec } from "./installer/workflow-spec.js";
import { resolveWorkflowDir } from "./installer/paths.js";
import { claimStep, completeStep } from "./installer/step-ops.js";
import { failStep } from "./installer/step-fail.js";
import { getRunContext } from "./installer/repo.js";
import { discardStoryWorktreeAndResetBranch } from "./installer/worktree-ops.js";
import { cleanupProjectEphemera, cleanupRunningRunOrphanedToolWorkers } from "./installer/cleanup-ops.js";
import { updateSupervisorMemory } from "./installer/product-supervisor.js";
import { buildClaimSummary, buildPreclaimedPrompt, buildResolvedClaimBootstrapScript, claimTaskPreview } from "./spawner-prompt.js";

const OPENCLAW_CLI = process.env.OPENCLAW_CLI || "/home/setrox/.local/bin/openclaw";
const OPENCLAW_TASKS_DB = process.env.OPENCLAW_TASKS_DB || path.join(os.homedir(), ".openclaw", "tasks", "runs.sqlite");
const POLL_INTERVAL_MS = 30_000;
const AGENT_TIMEOUT_SECONDS = 1800;
const PID_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
const MAX_CONCURRENT = 8;
const SPAWN_STAGGER_MS = parseInt(process.env.SETFARM_SPAWN_STAGGER_MS || "12000", 10);
const WORKFLOW_DEFER_RETRY_MS = parsePositiveInt(process.env.SETFARM_WORKFLOW_DEFER_RETRY_MS, POLL_INTERVAL_MS);
const BACKGROUND_WORKFLOWS = new Set((process.env.SETFARM_BACKGROUND_WORKFLOWS || "daily-standup")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean));
const VERIFY_AGENT_HARD_TIMEOUT_MS = parsePositiveInt(process.env.SETFARM_VERIFY_AGENT_HARD_TIMEOUT_MS, 10 * 60_000);
const VERIFY_BOUNDED_REVIEW_MIN_AGE_MS = parsePositiveInt(process.env.SETFARM_VERIFY_BOUNDED_REVIEW_MIN_AGE_MS, 2 * 60_000);
const VERIFY_BOUNDED_REVIEW_MAX_SOURCE_READS = parsePositiveInt(process.env.SETFARM_VERIFY_BOUNDED_REVIEW_MAX_SOURCE_READS, 6);
const SESSION_GUARD_HEAD_BYTES = parsePositiveInt(process.env.SETFARM_SESSION_GUARD_HEAD_BYTES, 768_000);
const SESSION_GUARD_TAIL_BYTES = parsePositiveInt(process.env.SETFARM_SESSION_GUARD_TAIL_BYTES, 768_000);
const NON_DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_AGENT_STUCK_MS, 12 * 60_000);
const DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_DEVELOPER_AGENT_STUCK_MS, 15 * 60_000);
const QA_FIX_AGENT_STUCK_MS = parsePositiveInt(process.env.SETFARM_QA_FIX_AGENT_STUCK_MS, 8 * 60_000);
const STARTUP_RUNNING_GRACE_MS = parsePositiveInt(process.env.SETFARM_STARTUP_RUNNING_GRACE_MS, 0);
const QA_AGENT_STUCK_MS = parsePositiveInt(process.env.SETFARM_QA_AGENT_STUCK_MS, 6 * 60_000);
const AGENT_ACTIVITY_GRACE_MS = parsePositiveInt(process.env.SETFARM_AGENT_ACTIVITY_GRACE_MS, 4 * 60_000);
const AGENT_HEARTBEAT_MS = parsePositiveInt(process.env.SETFARM_AGENT_HEARTBEAT_MS, 60_000);
const AGENT_STARTUP_SILENCE_MS = parsePositiveInt(process.env.SETFARM_AGENT_STARTUP_SILENCE_MS, 4 * 60_000);
const AGENT_MODEL_TURN_STALL_MS = parsePositiveInt(process.env.SETFARM_AGENT_MODEL_TURN_STALL_MS, 8 * 60_000);
const AGENT_SELF_LOOP_CHECK_AFTER_MS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_CHECK_AFTER_MS, 6 * 60_000);
const IMPLEMENT_NO_DELTA_GRACE_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_NO_DELTA_GRACE_MS, 8 * 60_000);
const IMPLEMENT_PRE_DELTA_MAX_CONTEXT_READS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_PRE_DELTA_MAX_CONTEXT_READS, 10);
const AGENT_SELF_LOOP_MIN_ACTIONS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_ACTIONS, 7);
const AGENT_SELF_LOOP_MIN_NOOP_EDITS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_NOOP_EDITS, 4);
const AGENT_SELF_LOOP_MIN_REPEATED_FAILURES = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_REPEATED_FAILURES, 4);
const AGENT_SELF_LOOP_MIN_REPEATED_COMMANDS = parsePositiveInt(process.env.SETFARM_AGENT_SELF_LOOP_MIN_REPEATED_COMMANDS, 8);
const CLAIM_PARSE_LOOP_MIN_READS = parsePositiveInt(process.env.SETFARM_CLAIM_PARSE_LOOP_MIN_READS, 6);
const REAP_FINISHED_ACTIVE_GRACE_MS = parsePositiveInt(process.env.SETFARM_REAP_FINISHED_ACTIVE_GRACE_MS, 60_000);
const ORPHANED_SINGLE_STEP_CLAIM_MS = parsePositiveInt(process.env.SETFARM_ORPHANED_SINGLE_STEP_CLAIM_MS, 2 * 60_000);
const OPENCLAW_TASK_REGISTRY_SETTLE_MS = parsePositiveInt(process.env.SETFARM_OPENCLAW_TASK_REGISTRY_SETTLE_MS, 2000);
const OPENCLAW_STALE_TASK_SWEEP_MS = parsePositiveInt(process.env.SETFARM_OPENCLAW_STALE_TASK_SWEEP_MS, 2 * 60_000);
const IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS, 120_000);
const OPENCLAW_AGENT_LOCAL = process.env.SETFARM_OPENCLAW_AGENT_LOCAL !== "0";
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

    for (const match of input.matchAll(/`?(\/home\/setrox\/projects\/[A-Za-z0-9._-]+)`?/g)) {
      const resolved = safeAgentCwdFromCandidate(match[1]);
      if (resolved) return resolved;
    }
  }

  return AGENT_SAFE_CWD;
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
      if (/\binnerHTML\s*=/.test(line) && !fileHasSanitizer) {
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
  repo: string;
  transcriptPath: string;
}): Promise<boolean> {
  const { role, agentId, wfId, key, claim, repo, transcriptPath } = params;
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
    const result = await completeStep(stepId, output);
    fs.appendFileSync(transcriptPath, `--- INLINE COMPLETE ${new Date().toISOString()} ${JSON.stringify(result)} ---\n`);
    console.log(`[spawner] completed ${agentId} inline for ${wfId}/${role} (transcript: ${transcriptPath})`);
  } catch (err) {
    const reason = `INLINE_SECURITY_GATE_FAILED: ${compactExitReason(err)}. Transcript: ${transcriptPath}`;
    try { fs.appendFileSync(transcriptPath, `--- INLINE ERROR ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
    console.warn(`[spawner] ${reason}`);
    await failStep(stepId, reason);
  }
  return true;
}

type ActiveProcess = {
  child: ChildProcess;
  runId: string;
  stepId: string;
  storyId?: string;
  storyDbId?: string;
  agentId: string;
  wfId: string;
  role: string;
  startedAtMs: number;
  transcriptPath: string;
  initialTranscriptSize: number;
  outputPath: string;
  claimSummaryPath?: string;
  spawnCwd: string;
  sessionId: string;
  sessionKey: string;
  sessionJsonlPath: string;
  lastCpuTicks?: number;
  lastCpuActivityMs?: number;
  lastHeartbeatMs?: number;
  lastHeartbeatSignature?: string;
};

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
const queuedSpawns = new Set<string>();
const claimingSpawns = new Set<string>();
let shuttingDown = false;
let nextSpawnEarliest = 0;
let claimMaintenanceInFlight = false;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

function extractToolCalls(content: unknown): Array<{ name: string; path: string; command: string; limit: number | null }> {
  if (!Array.isArray(content)) return [];
  const calls: Array<{ name: string; path: string; command: string; limit: number | null }> = [];
  for (const part of content as any[]) {
    if (!part || typeof part !== "object") continue;
    const type = String(part.type || "");
    if (type !== "toolCall" && type !== "tool_use") continue;
    const name = String(part.name || part.toolName || "");
    const args = part.arguments || part.input || {};
    const candidate = typeof args.path === "string" ? args.path : "";
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

function isGeneratedScreenComponentPath(relativePath: string): boolean {
  return /^src\/screens\/[^/]+\.tsx$/.test(relativePath);
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

function isBackendReferencePath(relativePath: string): boolean {
  return relativePath === "references/backend-standards.md";
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
    if (isReferenceMarkdownPath(relativePath)) reads.push({ path: relativePath, via: "exec", full: fullReadCommand });
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message.content)) {
      const candidates: Array<{ path: string; via: string; full: boolean }> = [];
      if (call.name === "read" && call.path) {
        const relativePath = normalizeWorktreeRelativePath(active.spawnCwd, call.path);
        if (isReferenceMarkdownPath(relativePath)) {
          candidates.push({ path: relativePath, via: "read", full: call.limit === null || call.limit > 220 });
        }
      }
      if (call.name === "exec" && call.command) {
        candidates.push(...extractReferenceReadsFromCommand(active.spawnCwd, call.command));
      }

      for (const candidate of candidates) {
        if (!candidateSourceExists(active.spawnCwd, candidate.path)) continue;
        if (isBackendReferencePath(candidate.path) && !backendScope) {
          return {
            detected: true,
            reason: `IRRELEVANT_REFERENCE_CONTEXT: ${active.agentId} read ${candidate.path} during a non-backend implement story. Backend/API/DB standards must not be loaded into frontend/game story context; Setfarm killed the claim before irrelevant reference context polluted implementation.`,
          };
        }
        if (candidate.full) {
          return {
            detected: true,
            reason: `FULL_REFERENCE_CONTEXT_READ: ${active.agentId} loaded full ${candidate.path}. Implement claims must use injected rules and only inspect the smallest focused reference excerpt when the story owns that domain; Setfarm killed the claim before reference context overload.`,
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message.content)) {
      const candidates: Array<{ path: string; via: string }> = [];
      if (call.name === "read" && call.path) {
        const relativePath = normalizeWorktreeRelativePath(active.spawnCwd, call.path);
        if (isGeneratedScreenComponentPath(relativePath)) candidates.push({ path: relativePath, via: "read" });
      }
      if (call.name === "exec" && call.command) {
        candidates.push(...extractGeneratedScreenReadsFromCommand(active.spawnCwd, call.command));
      }

      for (const candidate of candidates) {
        if (allowed.has(candidate.path)) continue;
        return {
          detected: true,
          reason: `GENERATED_SCREEN_SHARED_READ: ${active.agentId} used ${candidate.via} on ${candidate.path}, but that generated screen is not in this story's .story-scope-files. Shared generated screens must be consumed through src/screens/SCREEN_INDEX.json, src/screens/index.ts, the component registry, and UI_CONTRACT. Setfarm killed the claim before generated-screen context overload.`,
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

function rawStitchDesignReadGuard(active: ActiveProcess): { detected: boolean; reason: string } {
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message.content)) {
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
          reason: `RAW_STITCH_CONTEXT_READ: ${active.agentId} used ${candidate.via} on ${candidate.path}. Implement claims must use injected Stitch excerpts, UI_CONTRACT, SCREEN_INDEX, and story-owned generated screens instead of loading raw stitch HTML/full DESIGN_DOM context. Setfarm killed the claim before design-context overload.`,
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message.content)) {
      if (!call.command || !isVerifyDeterministicEvidenceCommand(call.command)) continue;
      const command = compactCommandForDiagnostic(call.command);
      return {
        detected: true,
        reason: `IMPLEMENT_PRE_DELTA_CHECK_VIOLATION: ${active.agentId} ran deterministic checks before any source delta during a first-delta retry (${command}). First-delta retries must read CLAIM_SUMMARY_FILE, inspect only owned scope files plus safe metadata needed for the first edit, make a small scoped source change, then run build/test/lint.`,
      };
    }
  }

  return { detected: false, reason: "" };
}

function implementPreDeltaExplorationGuard(active: ActiveProcess): { detected: boolean; reason: string } {
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };
  if (sourceStatusFiles(active.spawnCwd).length > 0) return { detected: false, reason: "" };

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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message.content)) {
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
      reason: `IMPLEMENT_PRE_DELTA_CONTEXT_SPRAWL: ${active.agentId} read ${contextReads.size} project/design context paths before any source delta (${Array.from(contextReads).slice(0, 8).join(", ")}). Retry with first-delta supervisor discipline: read CLAIM_SUMMARY_FILE, inspect only owned scope files and safe metadata needed for the first edit, then make a small scoped code change before broad analysis.`,
    };
  }

  return { detected: false, reason: "" };
}

function isRuntimeScopeAllowedWrite(relativePath: string, allowed: Set<string>): boolean {
  if (allowed.has(relativePath)) return true;
  if (relativePath === ".story-scope-files" || relativePath === ".story-branch" || relativePath === "pre-commit") return true;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/i.test(relativePath)) return true;
  return /^(vitest|jest)\.config\.[cm]?[jt]s$/i.test(relativePath)
    || relativePath === "src/test/setup.ts"
    || relativePath === "src/test/utils.ts"
    || relativePath === "src/setupTests.ts";
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message.content)) {
      if (call.name !== "write" && call.name !== "edit") continue;
      const relativePath = normalizeWorktreeRelativePath(active.spawnCwd, call.path);
      if (!relativePath || isRuntimeScopeAllowedWrite(relativePath, allowed)) continue;
      const probeHint = /(?:^|\/|_)(probe|scratch|tmp)[^/]*\.[cm]?[jt]sx?$/i.test(relativePath)
        ? " Do not create TypeScript probe/scratch files in the project tree to infer shared component props; use claim-summary designContracts.componentTypes or a /tmp-only experiment that never writes under WORKDIR."
        : "";
      return {
        detected: true,
        reason: `SCOPE_WRITE_VIOLATION: ${active.agentId} attempted ${call.name} on ${relativePath}, but this story may only write .story-scope-files entries.${probeHint} Runtime supervisor killed the claim before out-of-scope work could be committed.`,
      };
    }
  }

  return { detected: false, reason: "" };
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

function isBroadGitAddCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  return /\bgit\s+add\s+(?:-[A-Za-z]*A[A-Za-z]*\b|--all\b|\.(?:\s|$|&&|\|\||;))/i.test(compact);
}

function isAnyGitAddCommand(command: string): boolean {
  return /\bgit\s+add\b/i.test(compactCommandForDiagnostic(command));
}

function isGitPushCommand(command: string): boolean {
  return /\bgit\s+push\b/i.test(compactCommandForDiagnostic(command));
}

function gitCommitMessages(command: string): string[] {
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message.content)) {
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;
    for (const call of extractToolCalls(message.content)) {
      if (call.name === "write") writes += 1;
      if (call.name === "edit") edits += 1;
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
      reason: `CLAIM_SUMMARY_IGNORED: ${active.agentId} kept parsing raw /tmp/claim-*.json (${rawClaimReads} reads) and never used CLAIM_SUMMARY_FILE. Setfarm is retrying with supervisor handoff discipline.`,
    };
  }

  return { detected: false, reason: "" };
}

function isVerifyDeterministicEvidenceCommand(command: string): boolean {
  const compact = compactCommandForDiagnostic(command);
  if (!compact) return false;
  return /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(build|test|test:run|lint|typecheck)\b/i.test(compact)
    || /\bnpx\s+(vitest|tsc|eslint)\b/i.test(compact)
    || /\b(vitest|tsc|eslint)\s+(run|--noEmit|\.)?/i.test(compact)
    || /\bnode\b[^;&|]*\b(smoke-test|playwright-check)\b/i.test(compact);
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
    const message = event?.message || {};
    if (String(message.role || "") !== "assistant") continue;

    for (const call of extractToolCalls(message.content)) {
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

function normalizedSessionCommand(command: string): string {
  const compact = command.replace(/\s+/g, " " ).trim();
  if (!compact) return "";
  if (!/\b(vitest|npm\s+(run\s+)?test|pnpm\s+test|yarn\s+test|bun\s+test|playwright|npm\s+run\s+build|tsc)\b/i.test(compact)) return "";
  return compact
    .replace(/\/home\/setrox\/\.openclaw\/workspaces\/workflows\/[^ ]+/g, "<workdir>")
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
    const message = event?.message || {};
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
    const message = event?.message || {};
    const role = String(message.role || "");
    const content = message.content;

    if (role === "assistant") {
      for (const call of extractToolCalls(content)) {
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
        if (call.name !== "write" && call.name !== "edit") continue;
        const target = call.path || currentToolPath;
        if (!target) continue;
        const stats = fileStats.get(target) || { actions: 0, writes: 0, edits: 0, noopEdits: 0 };
        stats.actions += 1;
        if (call.name === "write") stats.writes += 1;
        if (call.name === "edit") stats.edits += 1;
        fileStats.set(target, stats);
        currentToolPath = target;
      }
      continue;
    }

    if (role === "toolResult") {
      const text = extractSessionText(content);
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
  if (activeProcesses.size > 0) return;
  if (nowMs - lastGatewayPrespawnRestartMs < GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS) return;

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
  for (const k of ["SETFARM_PG_URL", "MASTER_POSTGRES_URL", "MASTER_MARIADB_URL", "MASTER_MONGODB_URL"]) {
    delete e[k];
  }
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
  if [ "\${SETFARM_RECOVERY_COMMIT:-}" = "1" ] || [ "\${SETFARM_PLATFORM_COMMIT:-}" = "1" ]; then
    exec "$REAL_GIT" "$@"
  fi
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
  for arg in "$@"; do
    case "$arg" in
      -b|-B|--orphan)
        blocked "blocked agent branch creation: git $*"
        ;;
    esac
  done
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
    try { fs.appendFileSync(transcriptPath, `[spawner] installed implement git wrapper at ${wrapperPath}\n`); } catch {}
    return wrapperDir;
  } catch (err) {
    try { fs.appendFileSync(transcriptPath, `[spawner] failed to install implement git wrapper: ${String(err).slice(0, 180)}\n`); } catch {}
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
  for (const active of activeProcesses.values()) {
    if (keys.includes(active.sessionKey)) return true;
  }
  return false;
}

function sqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function activeSessionKeyExclusionSql(): string {
  const activeKeys = [...activeProcesses.values()].map((active) => active.sessionKey).filter(Boolean);
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
  return new Set([...activeProcesses.values()].map((active) => active.sessionKey).filter(Boolean));
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
  if (activeProcesses.size > 0) {
    console.warn(`[spawner] gateway restart after stale OpenClaw cleanup deferred; ${activeProcesses.size} active process(es) (${context})`);
    return false;
  }
  const nowMs = Date.now();
  if (nowMs - lastGatewayCleanupRestartMs < GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS) return false;

  gatewayRestartInFlight = true;
  lastGatewayCleanupRestartMs = nowMs;
  console.warn(`[spawner] restarting openclaw-gateway after stale OpenClaw cleanup (${context}): sessions=${result.sessions} tasks=${result.tasks}`);
  const restarted = await new Promise<boolean>((resolve) => {
    execFile("systemctl", ["--user", "restart", "openclaw-gateway"], { timeout: 20_000 }, (err, stdout, stderr) => {
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
      return;
    }
    console.log(`[spawner] OpenClaw task cancelled for ${lookup} (${context})`);
    setTimeout(() => cancelLingeringOpenClawTasksForLookup(lookup, context), 1500);
  });
}

function terminateActiveProcess(active: ActiveProcess, context: string): void {
  cancelOpenClawTask(active.sessionKey, context);
  killProcessTree(active.child.pid, "SIGTERM");
  setTimeout(() => killProcessTree(active.child.pid, "SIGKILL"), 5000);
  if (["qa-tester", "tester", "final-tester"].some((role) => active.role.includes(role) || active.agentId.includes(role))) {
    setTimeout(() => {
      void cleanupProjectEphemera(active.runId, `spawner-${context}-${active.role}`);
    }, 1500);
  }
}

async function retryActiveSingleStepClaim(active: ActiveProcess, stepIdName: string, diagnostic: string): Promise<void> {
  await pgRun(
    "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1 AND status = 'running'",
    [active.stepId],
  );
  await pgRun(
    "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), duration_ms = LEAST(CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS BIGINT), 2147483647)::INTEGER, diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id IS NULL AND agent_id = $4 AND outcome IS NULL",
    [diagnostic, active.runId, stepIdName, active.agentId],
  );
  await pgRun("SELECT pg_notify('step_pending', $1)", [
    JSON.stringify({ agentId: `${active.wfId}_${active.role}`, runId: active.runId, stepId: stepIdName }),
  ]);
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

function killStartupOrphanSpawnerAgents(): void {
  try {
    const out = execFileSync("pgrep", ["-f", "openclaw.*agent.*--session-id spawner-"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    for (const pidRaw of out.split(/\s+/).filter(Boolean)) {
      const pid = Number(pidRaw);
      if (!Number.isFinite(pid) || pid === process.pid) continue;
      const sessionKey = extractSpawnerSessionKeyFromArgs(readProcessArgs(pid));
      console.warn(`[spawner] killing orphan spawner OpenClaw process pid=${pid}${sessionKey ? " session=" + sessionKey : ""}`);
      if (sessionKey) cancelOpenClawTask(sessionKey, "startup-orphan");
      killProcessTree(pid, "SIGTERM");
      setTimeout(() => killProcessTree(pid, "SIGKILL"), 5000);
    }
  } catch {
    // no orphan spawner-owned openclaw processes
  }
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

async function completeRunningClaimFromOutputFile(stepId: string, agentId: string, outputPath?: string, startedAtMs?: number): Promise<boolean> {
  if (!outputPath) return false;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(outputPath);
  } catch {
    return false;
  }
  if (!stat.isFile() || stat.size <= 0) return false;
  if (startedAtMs && stat.mtimeMs < startedAtMs - 5000) return false;

  let output = "";
  try {
    output = fs.readFileSync(outputPath, "utf-8").trim();
  } catch {
    return false;
  }
  if (!/^STATUS\s*:/mi.test(output)) return false;

  const row = await pgGet<{ status: string; step_id: string; run_id: string }>(
    "SELECT status, step_id, run_id FROM steps WHERE id = $1 LIMIT 1",
    [stepId],
  );
  if (!row || row.status !== "running") return false;

  try {
    const result = await completeStep(stepId, output);
    try { fs.unlinkSync(outputPath); } catch {}
    console.warn(`[spawner] recovered ${row.step_id} for ${agentId} from ${outputPath}; advanced=${result.advanced} runCompleted=${result.runCompleted}`);
    return true;
  } catch (err) {
    console.warn(`[spawner] output-file recovery failed for ${row.step_id}/${agentId}: ${String(err).slice(0, 300)}`);
    return false;
  }
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
  "src", "app", "components", "lib", "pages", "public",
  "index.html", "package.json", "package-lock.json",
  "vite.config.ts", "vite.config.js", "tsconfig.json",
  "tailwind.config.ts", "tailwind.config.js", "postcss.config.js",
  "eslint.config.js", "vitest.config.ts", "vitest.config.js",
  "jest.config.ts", "jest.config.js",
];

function sourceDiffFiles(workdir: string, baseRef: string): string[] {
  const raw = gitOutput(workdir, [
    "diff", "--name-only", `${baseRef}...HEAD`, "--", ...RECOVERABLE_SOURCE_PATHS,
  ]);
  return raw ? raw.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function sourceStatusFiles(workdir: string): string[] {
  const raw = gitOutput(workdir, ["status", "--porcelain", "--", ...RECOVERABLE_SOURCE_PATHS]);
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

function implementNoDeltaStallGuard(active: ActiveProcess, ageMs: number): { detected: boolean; reason: string } {
  if (ageMs < IMPLEMENT_NO_DELTA_GRACE_MS) return { detected: false, reason: "" };
  if (fileSize(active.outputPath) > 0) return { detected: false, reason: "" };

  const changedFiles = sourceStatusFiles(active.spawnCwd);
  if (changedFiles.length > 0) return { detected: false, reason: "" };

  return {
    detected: true,
    reason: `IMPLEMENT_NO_DELTA_STALL: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without writing any project source/worktree delta. Retry the same story with a small scoped code change before extended analysis; use CLAIM_SUMMARY_FILE and injected contracts instead of reasoning in place.`,
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
        env: { ...process.env, SETFARM_RECOVERY_COMMIT: "1" },
      });
    }
    return gitOutput(workdir, ["rev-parse", "--short", "HEAD"]);
  } catch (err) {
    console.warn(`[spawner] implement recovery commit failed for ${storyId}: ${compactExitReason(err)}`);
    return null;
  }
}

async function tryRecoverExitedImplementWork(
  stepDbId: string,
  row: RunningStepRow,
  agentId: string,
  transcriptPath: string,
  err: unknown,
  claimedCwd?: string,
): Promise<boolean> {
  const exitReason = compactExitReason(err);
  const recoverableExit =
    exitReason.includes("without calling setfarm step complete/fail") ||
    exitReason.includes("AGENT_STARTUP_SILENT") ||
    exitReason.includes("AGENT_PROCESS_STUCK") ||
    exitReason.includes("AGENT_PROCESS_TERMINAL");
  if (!recoverableExit) return false;
  if (row.status !== "running" || row.type !== "loop" || row.step_id !== "implement" || !row.current_story_id) return false;

  const story = await pgGet<{ id: string; story_id: string; title: string; story_branch: string | null; status: string; claimed_by: string | null }>(
    "SELECT id, story_id, title, story_branch, status, claimed_by FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
    [row.current_story_id, row.run_id],
  );
  if (!story || story.status !== "running") return false;
  if (story.claimed_by && story.claimed_by !== agentId) return false;

  const storyBranch = (story.story_branch || `${row.run_id.slice(0, 8)}-${story.story_id}`).toLowerCase();
  const contextRow = await pgGet<{ context: string | null }>("SELECT context FROM runs WHERE id = $1 LIMIT 1", [row.run_id]);
  let context: Record<string, string> = {};
  try {
    context = contextRow?.context ? JSON.parse(contextRow.context) : {};
  } catch {
    context = {};
  }

  const workdirCandidates = [
    safeAgentCwdFromCandidate(claimedCwd),
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
  const recoveryCommit = commitRecoveredImplementWork(workdir, story.story_id, changedFiles);
  if (!recoveryCommit) return false;

  context["story_workdir"] = workdir;
  context["story_branch"] = storyBranch;
  await pgRun("UPDATE runs SET context = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(context), row.run_id]);

  const recoveryOutput = [
    "STATUS: done",
    `STORY_BRANCH: ${storyBranch}`,
    `CHANGES: Recovered ${story.story_id} after agent exited with build-passing work on ${storyBranch}. Commit: ${recoveryCommit}.`,
    "BUILD_CMD: npm run build",
    "RECOVERY: agent-exit-build-passing",
    `RECOVERY_COMMIT: ${recoveryCommit}`,
    `TRANSCRIPT: ${transcriptPath}`,
    `CHANGED_FILES: ${changedFiles.join(", ")}`,
  ].join("\n");

  const result = await completeStep(stepDbId, recoveryOutput);
  if (!result.advanced && !result.runCompleted) {
    const refreshed = await pgGet<{ status: string }>("SELECT status FROM stories WHERE id = $1 LIMIT 1", [story.id]);
    if (!["done", "verified"].includes(refreshed?.status || "")) return false;
  }
  console.warn(`[spawner] recovered exited implement story ${story.story_id} for ${agentId}: build passed in ${workdir}`);
  return true;
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

async function failClaimIfStillRunning(stepId: string, agentId: string, wfId: string, role: string, transcriptPath: string, err: unknown, startedAtMs?: number, claimedCwd?: string, outputPath?: string): Promise<void> {
  try {
    const row = await pgGet<{ status: string; step_id: string; run_id: string; type: string; current_story_id: string | null }>(
      "SELECT status, step_id, run_id, type, current_story_id FROM steps WHERE id = $1 LIMIT 1",
      [stepId],
    );
    if (!row) return;

    if (row.type === "loop" && await loopStoryCompletedAfter(row.run_id, agentId, row.current_story_id, startedAtMs)) {
      console.log(`[spawner] ${agentId} exited after completing a loop story for ${wfId}/${role}; keeping loop ${row.step_id} running (${compactExitReason(err)})`);
      return;
    }

    if (row.status === "running" && await completeRunningClaimFromOutputFile(stepId, agentId, outputPath, startedAtMs)) return;

    if (row.status === "running") {
      try {
        if (await tryRecoverExitedImplementWork(stepId, row, agentId, transcriptPath, err, claimedCwd)) return;
      } catch (recoveryErr) {
        console.warn(`[spawner] exited implement recovery failed for ${wfId}/${role}: ${String(recoveryErr).slice(0, 300)}`);
      }
    }

    if (row.type === "loop" && row.status !== "running") {
      const requeued = await requeueOrphanedStoryClaim(row.run_id, row.step_id, agentId, `agent exited while loop step was ${row.status}: ${compactExitReason(err)}`);
      if (requeued) return;
    }

    if (row.status !== "running") return;

    const reason = `AGENT_PROCESS_EXITED: ${agentId} exited before completing ${wfId}/${role}. ${compactExitReason(err)}. Transcript: ${transcriptPath}`;
    console.warn(`[spawner] failing still-running claim ${stepId} (${row.step_id}) after agent exit`);
    await recordSupervisorInfraEvent(row.run_id, row.step_id, row.current_story_id, reason);
    await failStep(stepId, reason);
  } catch (failErr) {
    console.warn(`[spawner] failed to mark exited agent claim as failed: ${String(failErr).slice(0, 300)}`);
  }
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
    if (storyDbId) {
      const story = await pgGet<{ story_id: string; title: string }>("SELECT story_id, title FROM stories WHERE id = $1 LIMIT 1", [storyDbId]);
      if (story) storyLabel = ` story=${story.story_id} title=${story.title.slice(0, 120)}`;
    }

    const entry = [
      `### ${new Date().toISOString()} ${stepId} ${eventType}${storyLabel}`,
      `- Code: ${code}`,
      `- Step: ${stepId}`,
      `- Summary: ${summary.slice(0, 900)}`,
    ].join("\n") + "\n";
    updateSupervisorMemory(context, entry);
    await pgRun("UPDATE runs SET context = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(context), runId]);
  } catch (err) {
    console.warn(`[spawner] supervisor runtime memory update failed: ${String(err).slice(0, 220)}`);
  }
}

async function requeueOrphanedStoryClaim(runId: string, stepId: string, agentId: string, diagnostic: string): Promise<boolean> {
  const row = await pgGet<{ id: string; story_id: string }>(
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

  // Runtime guard retries are manager/discipline failures, not semantic story
  // failures. Keep the diagnostic, but preserve both story retry and abandon
  // budgets for real build/design/verify feedback and crash recovery.
  await pgRun(
    "UPDATE stories SET status = 'pending', claimed_by = NULL, output = $2, updated_at = NOW() WHERE id = $1 AND status = 'running'",
    [row.id, diagnostic],
  );
  await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('pending','running','waiting')", [runId, stepId]);
  await pgRun("UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id = $4 AND agent_id = $5 AND outcome IS NULL", [diagnostic, runId, stepId, row.story_id, agentId]);
  console.warn(`[spawner] requeued orphaned story claim ${row.story_id} for ${agentId}: ${diagnostic.slice(0, 180)}`);
  return true;
}

async function requeueOpenStoryClaim(runId: string, stepId: string, storyId: string, agentId: string, diagnostic: string): Promise<boolean> {
  const row = await pgGet<{ story_db_id: string | null; story_status: string | null; claim_story_id: string }>(
    `SELECT st.id as story_db_id, st.status as story_status, cl.story_id as claim_story_id
     FROM claim_log cl
     LEFT JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
     WHERE cl.run_id = $1
       AND cl.step_id = $2
       AND cl.story_id = $3
       AND cl.agent_id = $4
       AND cl.outcome IS NULL
     ORDER BY cl.claimed_at DESC
     LIMIT 1`,
    [runId, stepId, storyId, agentId],
  );
  if (!row) return false;

  await discardRuntimeGuardRetryWorktree(runId, storyId, agentId, diagnostic);

  if (row.story_db_id) {
    // Runtime guard retries are manager/discipline failures, not semantic story
    // failures. Keep the diagnostic, but preserve both story retry and abandon
    // budgets for real build/design/verify feedback and crash recovery.
    await pgRun(
      "UPDATE stories SET status = 'pending', claimed_by = NULL, output = $2, updated_at = NOW() WHERE id = $1 AND status IN ('running','pending')",
      [row.story_db_id, diagnostic],
    );
  }
  await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('pending','running','waiting')", [runId, stepId]);
  await pgRun("UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id = $4 AND agent_id = $5 AND outcome IS NULL", [diagnostic, runId, stepId, storyId, agentId]);
  console.warn(`[spawner] requeued open story claim ${storyId} for ${agentId}: ${diagnostic.slice(0, 180)}`);
  return true;
}

async function discardRuntimeGuardRetryWorktree(runId: string, storyId: string, agentId: string, diagnostic: string): Promise<void> {
  try {
    const ctx = await getRunContext(runId);
    if (!ctx["repo"]) return;
    const storyBranch = `${runId.slice(0, 8)}-${storyId}`.toLowerCase();
    const baseRef = ctx["implement_base_commit"] || ctx["story_base_ref"] || ctx["branch"] || "main";
    discardStoryWorktreeAndResetBranch(ctx["repo"], storyBranch, baseRef, agentId);
    console.warn(`[spawner] discarded guarded retry worktree ${storyBranch} before requeue: ${diagnostic.slice(0, 160)}`);
  } catch (err) {
    console.warn(`[spawner] guarded retry worktree discard failed for ${storyId}: ${String(err).slice(0, 220)}`);
  }
}

async function requeueOrphanedRunningStories(): Promise<void> {
  const rows = await pgQuery<{ story_db_id: string; story_id: string; run_id: string; run_number: number; step_db_id: string | null; step_id: string | null; step_status: string | null; agent_id: string | null }>(
    `SELECT st.id as story_db_id, st.story_id, st.run_id, r.run_number,
            loop_step.id as step_db_id, loop_step.step_id, loop_step.status as step_status,
            cl.agent_id
     FROM stories st
     JOIN runs r ON r.id = st.run_id
     LEFT JOIN claim_log cl ON cl.run_id = st.run_id AND cl.story_id = st.story_id AND cl.outcome IS NULL
     LEFT JOIN steps loop_step ON loop_step.run_id = st.run_id AND loop_step.type = 'loop'
     WHERE st.status = 'running'
       AND r.status = 'running'
       AND (
         loop_step.id IS NULL
         OR loop_step.status <> 'running'
         OR loop_step.current_story_id IS DISTINCT FROM st.id
       )
     ORDER BY st.updated_at ASC
     LIMIT 20`
  );

  for (const row of rows) {
    const diagnostic = `ORPHANED_RUNNING_STORY: ${row.story_id} was running but loop step ${row.step_id || "(missing)"} is ${row.step_status || "(missing)"} or no longer points at story`;
    await pgRun("UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'", [row.story_db_id]);
    if (row.step_db_id) {
      await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE id = $1 AND status IN ('pending','waiting','running')", [row.step_db_id]);
    }
    if (row.agent_id) {
      await pgRun("UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), diagnostic = $1 WHERE run_id = $2 AND story_id = $3 AND agent_id = $4 AND outcome IS NULL", [diagnostic, row.run_id, row.story_id, row.agent_id]);
    }
    console.warn(`[spawner] requeued orphaned running story for run #${row.run_number}: ${row.story_id}`);
  }
}

async function requeueUntrackedRunningSingleStepClaims(): Promise<void> {
  const thresholdMs = Math.max(0, ORPHANED_SINGLE_STEP_CLAIM_MS);
  const rows = await pgQuery<{ step_db_id: string; step_id: string; run_id: string; run_number: number; agent_id: string; claimed_at: string }>(
    `SELECT s.id as step_db_id, s.step_id, s.run_id, r.run_number, s.agent_id, cl.claimed_at
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
       AND cl.claimed_at <= NOW() - ($1::int * interval '1 millisecond')
       AND s.updated_at <= NOW() - ($1::int * interval '1 millisecond')
     ORDER BY cl.claimed_at ASC
     LIMIT 20`,
    [thresholdMs],
  );

  for (const row of rows) {
    const tracked = Array.from(activeProcesses.values()).some((active) =>
      active.runId === row.run_id
      && active.stepId === row.step_db_id
      && active.agentId === row.agent_id
    );
    if (tracked) continue;

    const claimedAtMs = new Date(row.claimed_at).getTime();
    const ageMs = Number.isFinite(claimedAtMs) ? Date.now() - claimedAtMs : thresholdMs;
    const diagnostic = `UNTRACKED_RUNNING_SINGLE_STEP: ${row.agent_id} has an open ${row.step_id} claim for ${formatDurationMs(ageMs)} but no active spawner process is tracking it; retrying instead of leaving the run idle.`;
    await pgRun(
      "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1 AND status = 'running'",
      [row.step_db_id],
    );
    await pgRun(
      "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), duration_ms = LEAST(CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS BIGINT), 2147483647)::INTEGER, diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id IS NULL AND agent_id = $4 AND outcome IS NULL",
      [diagnostic, row.run_id, row.step_id, row.agent_id],
    );
    await pgRun("SELECT pg_notify('step_pending', $1)", [
      JSON.stringify({ agentId: row.agent_id, runId: row.run_id, stepId: row.step_id }),
    ]);
    console.warn(`[spawner] requeued untracked single-step claim for run #${row.run_number}: ${row.step_id}/${row.agent_id}`);
  }
}

async function runClaimMaintenance(): Promise<void> {
  if (shuttingDown || claimMaintenanceInFlight) return;
  claimMaintenanceInFlight = true;
  try {
    await reapFinishedClaims();
    await requeueOrphanedRunningStories();
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
        const loopStoryDone = row.type === "loop"
          && await loopStoryCompletedAfter(row.run_id, active.agentId, active.storyId || row.current_story_id, active.startedAtMs);
        if (loopStoryDone) {
          console.log(`[spawner] Reaping completed loop agent ${key}: story completed; terminating leftover agent process`);
          terminateActiveProcess(active, "completed-loop-story");
          activeProcesses.delete(key);
          continue;
        }

        const effectiveStoryId = active.storyId || row.story_id || undefined;
        const effectiveStoryDbId = active.storyDbId || row.current_story_id || undefined;

        if (row.type === "loop" && row.step_id === "implement" && effectiveStoryId && !isTerminalTestRole(active.role, active.agentId)) {
          const scopeWrite = implementScopeWriteGuard(active);
          if (scopeWrite.detected) {
            const reason = scopeWrite.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- SCOPE WRITE GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "scope-write-guard");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
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
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
            continue;
          }

          const claimParseLoop = claimParseLoopGuard(active);
          if (claimParseLoop.detected) {
            const reason = claimParseLoop.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- CLAIM PARSE LOOP GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "claim-parse-loop-guard");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
            continue;
          }

          const referenceRead = implementReferenceReadGuard(active);
          if (referenceRead.detected) {
            const reason = referenceRead.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- REFERENCE READ GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "reference-read-guard");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
            continue;
          }

          const generatedScreenRead = generatedScreenReadGuard(active);
          if (generatedScreenRead.detected) {
            const reason = generatedScreenRead.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- GENERATED SCREEN READ GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "generated-screen-read-guard");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
            continue;
          }

          const rawStitchRead = rawStitchDesignReadGuard(active);
          if (rawStitchRead.detected) {
            const reason = rawStitchRead.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- RAW STITCH READ GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "raw-stitch-read-guard");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
            continue;
          }

          const preDeltaCheck = implementPreDeltaCheckGuard(active);
          if (preDeltaCheck.detected) {
            const reason = preDeltaCheck.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- IMPLEMENT PRE-DELTA CHECK GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "implement-pre-delta-check-guard");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
            continue;
          }

          const preDeltaExploration = implementPreDeltaExplorationGuard(active);
          if (preDeltaExploration.detected) {
            const reason = preDeltaExploration.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- IMPLEMENT PRE-DELTA CONTEXT GUARD ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "implement-pre-delta-context-guard");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
            continue;
          }

          const noDeltaStall = implementNoDeltaStallGuard(active, ageMs);
          if (noDeltaStall.detected) {
            const reason = noDeltaStall.reason + ` Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- IMPLEMENT NO DELTA STALL ${new Date().toISOString()} ---
${reason}
`); } catch {}
            await recordSupervisorRuntimeEvent(active.runId, row.step_id, effectiveStoryDbId || null, "PRODUCT_SUPERVISOR_RUNTIME_GUARD", "runtime-guard", reason);
            terminateActiveProcess(active, "implement-no-delta-stall");
            activeProcesses.delete(key);
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
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
          cancelOpenClawTask(active.sessionKey, "process-terminal");
          activeProcesses.delete(key);
          await failClaimIfStillRunning(active.stepId, active.agentId, active.wfId, active.role, active.transcriptPath, new Error(reason), active.startedAtMs, active.spawnCwd, active.outputPath);
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
            if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
            await requeueOpenStoryClaim(active.runId, row.step_id, effectiveStoryId, active.agentId, reason);
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
          const reason = `AGENT_STARTUP_SILENT: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without transcript/output; OpenClaw session likely stuck before first model/tool turn. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- STARTUP SILENCE ${new Date().toISOString()} ---
${reason}
`); } catch {}
          terminateActiveProcess(active, "startup-silent");
          activeProcesses.delete(key);
          await failClaimIfStillRunning(active.stepId, active.agentId, active.wfId, active.role, active.transcriptPath, new Error(reason), active.startedAtMs, active.spawnCwd, active.outputPath);
          continue;
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
              if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) continue;
              await requeueOpenStoryClaim(active.runId, row.step_id, active.storyId, active.agentId, reason);
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
          await failClaimIfStillRunning(active.stepId, active.agentId, active.wfId, active.role, active.transcriptPath, new Error(reason), active.startedAtMs, active.spawnCwd, active.outputPath);
          continue;
        }

        const thresholdMs = stuckThresholdMs(active.role, row.story_id);
        if (ageMs < thresholdMs) continue;

        const idleMs = Date.now() - activeProcessLastActivityMs(active);
        if (idleMs < AGENT_ACTIVITY_GRACE_MS) {
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
        await failClaimIfStillRunning(active.stepId, active.agentId, active.wfId, active.role, active.transcriptPath, new Error(reason), active.startedAtMs, active.spawnCwd, active.outputPath);
        continue;
      } else {
        const idleMs = activeProcessIdleMs(active);
        if (row.run_status === "running" && row.step_status !== "running") {
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
    } catch (err) {
      console.warn(`[spawner] reap finished claim ${key}: ${String(err).slice(0, 300)}`);
    }
  }
}

function spawnAgent(agentId: string, wfId: string, role: string): void {
  const key = `${wfId}:${role}:${agentId}`;
  if (activeProcesses.has(key) || claimingSpawns.has(key)) {
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
  if (delayMs > 0) console.log(`[spawner] Queueing ${key} for ${delayMs}ms to avoid OpenClaw plugin-cache races`);
  setTimeout(() => {
    queuedSpawns.delete(key);
    if (shuttingDown) return;
    void spawnAgentNow(agentId, wfId, role);
  }, delayMs);
}

async function spawnAgentNow(agentId: string, wfId: string, role: string): Promise<void> {
  const key = `${wfId}:${role}:${agentId}`;
  if (activeProcesses.has(key) || claimingSpawns.has(key)) {
    console.log(`[spawner] Already running/claiming: ${key}, skip`);
    return;
  }
  if (await shouldDeferBackgroundWorkflow(wfId)) {
    console.log(`[spawner] Deferring background workflow ${wfId}/${role}; foreground run is active`);
    queuedSpawns.add(key);
    setTimeout(() => {
      queuedSpawns.delete(key);
      if (!shuttingDown) void spawnAgentNow(agentId, wfId, role);
    }, WORKFLOW_DEFER_RETRY_MS);
    return;
  }
  const openClawCleanup = cleanupStaleSetfarmOpenClawTaskRecords("prespawn");
  if (!OPENCLAW_AGENT_LOCAL) await restartGatewayAfterOpenClawCleanup("prespawn", openClawCleanup);
  if (activeProcesses.size >= MAX_CONCURRENT) {
    console.log(`[spawner] At capacity (${activeProcesses.size}/${MAX_CONCURRENT}), skip ${agentId}`);
    return;
  }
  if (!OPENCLAW_AGENT_LOCAL) {
    const gatewayReadiness = await getGatewayReadiness();
    if (!gatewayReadiness.ready) {
      maybeRestartGatewayForReadiness(gatewayReadiness.reason, key);
      console.warn(`[spawner] Gateway not ready (${gatewayReadiness.reason}; ${GATEWAY_READY_URL}); delaying ${key} for ${gatewayReadiness.retryAfterMs}ms`);
      queuedSpawns.add(key);
      setTimeout(() => {
        queuedSpawns.delete(key);
        if (!shuttingDown) void spawnAgentNow(agentId, wfId, role);
      }, gatewayReadiness.retryAfterMs);
      return;
    }
    if (!gatewayReadiness.reason.startsWith("gateway probe timeout bypass")) noteGatewayReady();
  }
  claimingSpawns.add(key);
  const spawnId = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
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
    claim = await claimStep(fullAgentId, agentId);
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
  if (typeof claim.resolvedInput === "string") {
    claim.resolvedInput = claim.resolvedInput
      .replace(/\[missing:\s*output_file_id\]/gi, outputFileId)
      .replace(/\[missing:\s*OUTPUT_FILE_ID\]/g, outputFileId);
  }
  const spawnCwd = safeAgentCwdFromClaimInput(claim.resolvedInput);
  if (claim.storyId && spawnCwd === AGENT_SAFE_CWD) {
    claimingSpawns.delete(key);
    const reason = "CLAIM_WORKDIR_MISSING: story claim " + claim.storyId + " for " + fullAgentId + " did not resolve a project/story worktree from claim input. Refusing to spawn in agent scratch.";
    console.warn("[spawner] " + reason);
    if (claim.runId) await recordSupervisorInfraEvent(claim.runId, "spawner", claim.storyDbId || null, reason);
    if (claim.stepId) await failStep(claim.stepId, reason);
    return;
  }
  fs.writeFileSync(claimFile, JSON.stringify({ stepId: claim.stepId, runId: claim.runId, workdir: spawnCwd, repo: spawnCwd, input: claim.resolvedInput }) + "\n");
  fs.writeFileSync(claimSummaryFile, JSON.stringify(buildClaimSummary({
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
    input: claim.resolvedInput,
  }), null, 2) + "\n");
  fs.writeFileSync(bootstrapFile, buildResolvedClaimBootstrapScript({
    claimFile,
    outputFile,
    claimSummaryFile,
    stepId: claim.stepId || "",
    workdir: spawnCwd,
    taskPreview: claimTaskPreview(claim.resolvedInput),
  }), { mode: 0o700 });
  try { fs.chmodSync(bootstrapFile, 0o700); } catch { /* best-effort */ }

  // capture agent stdout/stderr to a transcript file for post-hoc diagnosis.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const transcriptPath = path.join(TRANSCRIPT_ROOT, wfId, agentId + "-" + ts + ".log");
  if (await completeInlineSecurityGateIfApplicable({ role, agentId, wfId, key, claim, repo: spawnCwd, transcriptPath })) {
    return;
  }

  const prompt = buildPreclaimedPrompt({ wfId, role, outputFile, claimFile, claimSummaryFile, bootstrapFile });
  console.log("[spawner] Spawning " + agentId + " for " + wfId + "/" + role + " after pre-claim (active: " + activeProcesses.size + ")");
  claimingSpawns.delete(key);
  try { fs.mkdirSync(path.dirname(transcriptPath), { recursive: true }); } catch {}
  try { fs.writeFileSync(transcriptPath, "[spawner] " + new Date().toISOString() + " " + wfId + "/" + role + " agent=" + agentId + "\n"); } catch {}

  // Use the same per-spawn id for the gateway session and /tmp handoff files.
  // A reaped child can still have late gateway activity; sharing claim/output
  // paths across retries lets old and new attempts overwrite each other's handoff.
  const sessionId = "spawner-" + agentId + "-" + spawnId;
  const sessionKey = buildSessionKey(agentId, sessionId);
  const sessionJsonlPath = agentSessionJsonlPath(agentId, sessionId);
  const childArgs = [
    "agent", "--json", "--agent", agentId,
    ...(OPENCLAW_AGENT_LOCAL ? ["--local"] : []),
    "--session-id", sessionId,
    "--message", prompt, "--timeout", String(AGENT_TIMEOUT_SECONDS),
  ];
  try {
    fs.appendFileSync(transcriptPath, `[spawner] openclaw_cli=${OPENCLAW_CLI} session_id=${sessionId} session_key=${sessionKey} timeout=${AGENT_TIMEOUT_SECONDS}s cwd=${spawnCwd}\n`);
  } catch {}
  const shouldInstallImplementGitWrapper = role === "developer" && Boolean(claim.storyId);
  const pathPrefix = shouldInstallImplementGitWrapper ? installImplementGitWrapper(spawnCwd, transcriptPath) : undefined;
  const outFd = fs.openSync(transcriptPath, "a");
  const errFd = fs.openSync(transcriptPath, "a");
  const child = spawn(OPENCLAW_CLI, childArgs, {
    cwd: spawnCwd,  // Use the claimed worktree when available so relative tool paths resolve correctly.
    // Security audit S-1: explicit env allowlist. Previous `{...process.env}` leaked
    // ALL secrets (API keys, DB password, master URLs) to every agent child process.
    // Agents can run `printenv` and see everything. OpenClaw gateway handles API key
    // resolution internally — agents do not need direct key access.
    // Security: denylist DB credentials from agent env. Keep everything
    // else — OpenClaw CLI needs many env vars and allowlist is too fragile.
    env: (() => {
      return buildOpenClawChildEnv(pathPrefix);
    })(),
    stdio: ["ignore", outFd, errFd],
  });
  const startedAtMs = Date.now();
  const initialTranscriptSize = fileSize(transcriptPath);
  const activeProcess: ActiveProcess = {
    child,
    runId: claim.runId || "",
    stepId: claim.stepId || "",
    storyId: claim.storyId,
    storyDbId: claim.storyDbId,
    agentId,
    wfId,
    role,
    startedAtMs,
    transcriptPath,
    initialTranscriptSize,
    outputPath: outputFile,
    claimSummaryPath: claimSummaryFile,
    spawnCwd,
    sessionId,
    sessionKey,
    sessionJsonlPath,
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
      fs.appendFileSync(transcriptPath, `--- HARD TIMEOUT ${new Date().toISOString()} ---\nopenclaw agent exceeded ${AGENT_TIMEOUT_SECONDS + 60}s\n`);
    } catch {}
    terminateActiveProcess(activeProcess, "spawn-hard-timeout");
  }, (AGENT_TIMEOUT_SECONDS + 60) * 1000);
  child.once("error", (err) => {
    processExited = true;
    clearTimeout(hardTimeout);
    closeTranscriptFds();
    const isCurrentProcess = activeProcesses.get(key)?.child === child;
    if (isCurrentProcess) activeProcesses.delete(key);
    try {
      fs.appendFileSync(transcriptPath, "--- SPAWN ERROR ---\n" + String((err as any).message || err) + "\n--- FINISHED " + new Date().toISOString() + " ---\n");
    } catch (e) { console.warn("[spawner] transcript write failed: " + String(e)); }
    console.warn("[spawner] " + agentId + " spawn error: " + ((err as any).message || err) + " (transcript: " + transcriptPath + ")");
    if (isCurrentProcess && !shuttingDown && claim.stepId) void failClaimIfStillRunning(claim.stepId, agentId, wfId, role, transcriptPath, err, startedAtMs, spawnCwd, outputFile);
  });
  child.once("exit", (code, signal) => {
    processExited = true;
    clearTimeout(hardTimeout);
    closeTranscriptFds();
    const isCurrentProcess = activeProcesses.get(key)?.child === child;
    if (isCurrentProcess) activeProcesses.delete(key);
    try {
      fs.appendFileSync(transcriptPath, `--- EXIT code=${code ?? ""} signal=${signal ?? ""} ---\n--- FINISHED ${new Date().toISOString()} ---\n`);
    } catch (e) { console.warn("[spawner] transcript write failed: " + String(e)); }
    const err = code === 0 ? null : new Error(`openclaw agent exited code=${code ?? ""} signal=${signal ?? ""}`);
    if (err) {
      console.warn("[spawner] " + agentId + " exited: " + ((err as any).message || err) + " (transcript: " + transcriptPath + ")");
      if (isCurrentProcess && !shuttingDown && claim.stepId) void failClaimIfStillRunning(claim.stepId, agentId, wfId, role, transcriptPath, err, startedAtMs, spawnCwd, outputFile);
    }
    else {
      console.log("[spawner] " + agentId + " completed (transcript: " + transcriptPath + ")");
      if (isCurrentProcess && !shuttingDown && claim.stepId) {
        void failClaimIfStillRunning(
          claim.stepId,
          agentId,
          wfId,
          role,
          transcriptPath,
          new Error("agent exited with code 0 without calling setfarm step complete/fail"),
          startedAtMs,
          spawnCwd,
          outputFile,
        );
      }
    }
  });
  if (child.pid && claim.runId && claim.stepId) {
    activeProcesses.set(key, activeProcess);
  }
}


async function failStaleRunningClaimsFromPreviousSpawner(): Promise<void> {
  try {
    const graceSeconds = Math.max(0, Math.ceil(STARTUP_RUNNING_GRACE_MS / 1000));
    const rows = await pgQuery<{ id: string; step_id: string; agent_id: string; run_id: string; current_story_id: string | null; run_number: number; updated_at: string }>(
      `SELECT s.id, s.step_id, s.agent_id, s.run_id, s.current_story_id, r.run_number, s.updated_at
       FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.status = 'running'
         AND r.status = 'running'
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
            await pgRun(
              "UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
              [row.current_story_id],
            );
            await pgRun(
              "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
              [row.id],
            );
            console.log(`[spawner] requeued orphaned running story for run #${row.run_number}: ${currentStory.story_id}`);
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
      await failStep(row.id, reason);
    }
  } catch (err) {
    console.warn(`[spawner] startup running claim recovery failed: ${String(err).slice(0, 300)}`);
  }
}

async function releaseActiveProcessForShutdown(active: ActiveProcess): Promise<void> {
  if (!active.stepId) return;
  try {
    const row = await pgGet<{ run_id: string; step_id: string; type: string; current_story_id: string | null; story_id: string | null }>(
      `SELECT s.run_id, s.step_id, s.type, s.current_story_id, st.story_id
       FROM steps s
       LEFT JOIN stories st ON st.id = s.current_story_id
       WHERE s.id = $1 AND s.status = 'running'
       LIMIT 1`,
      [active.stepId],
    );
    if (!row) return;
    if (row.type === "loop" && row.current_story_id) {
      if (await completeRunningClaimFromOutputFile(active.stepId, active.agentId, active.outputPath, active.startedAtMs)) return;
      await pgRun(
        "UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
        [row.current_story_id],
      );
      await pgRun(
        "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
        [active.stepId],
      );
      await pgRun(
        "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS INTEGER), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id = $4 AND agent_id = $5 AND outcome IS NULL",
        ["Spawner shutdown released active loop claim", row.run_id, row.step_id, row.story_id, active.agentId],
      );
      console.log(`[spawner] released active loop claim for shutdown: ${active.agentId} ${active.wfId}/${active.role}`);
      return;
    }

    await pgRun("UPDATE steps SET status = 'pending', updated_at = NOW() WHERE id = $1 AND status = 'running'", [active.stepId]);
    await pgRun(
      "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS INTEGER), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id IS NULL AND agent_id = $4 AND outcome IS NULL",
      ["Spawner shutdown released active single-step claim", row.run_id, row.step_id, active.agentId],
    );
    console.log(`[spawner] released active step claim for shutdown: ${active.agentId} ${active.wfId}/${active.role}`);
  } catch (err) {
    console.warn(`[spawner] failed to release active claim during shutdown: ${String(err).slice(0, 300)}`);
  }
}

function cancelRunAgents(runId: string): void {
  let killed = 0;
  for (const [key, active] of activeProcesses) {
    if (active.runId !== runId) continue;
    killed++;
    console.log(`[spawner] Cancelling active agent ${key} for run ${runId.slice(0, 8)}`);
    terminateActiveProcess(active, "run-cancelled");
  }
  if (killed === 0) {
    console.log(`[spawner] Run ${runId.slice(0, 8)} cancelled; no active agent process found`);
  }
}

async function handleStepPending(payload: { agentId: string; runId: string; stepId: string }) {
  if (shuttingDown) return;
  const { agentId, runId, stepId } = payload;
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
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running') AND retry_count > 0",
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
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running') AND retry_count > 0",
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
             AND verify_step.status IN ('pending', 'running')
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

async function pollForPendingWork() {
  if (shuttingDown) return;
  try {
    await runClaimMaintenance();
    await cleanupRunningRunOrphanedToolWorkers();
    await autoVerifyMergedPrEachStories();
    await advanceCompletedVerifyEachLoops();
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
               AND active_st.retry_count > 0
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
                 AND active_st.retry_count > 0
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

  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`[spawner] Starting (PID ${process.pid})`);
  await pgMigrate();
  killStartupOrphanSpawnerAgents();
  await failStaleRunningClaimsFromPreviousSpawner();
  await requeueOrphanedRunningStories();
  await cleanupRunningRunEphemeraOnStartup();
  await restartGatewayAfterOpenClawCleanup("startup", cleanupStaleSetfarmOpenClawTaskRecords("startup"));

  const shutdown = async () => {
    shuttingDown = true;
    console.log(`[spawner] Shutting down (${activeProcesses.size} active)`);
    for (const [, active] of activeProcesses) {
      await releaseActiveProcessForShutdown(active);
      terminateActiveProcess(active, "spawner-shutdown");
    }
    await pgClose();
    try { fs.unlinkSync(PID_FILE); } catch {}
    setTimeout(() => process.exit(0), 5000);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  const pgUrl = process.env.SETFARM_PG_URL || "postgresql://localhost:5432/setfarm";
  const listener = postgres(pgUrl, { max: 1 });

  await listener.listen("step_pending", (msg) => {
    try { handleStepPending(JSON.parse(msg)); } catch {}
  });
  await listener.listen("story_pending", (msg) => {
    try { handleStoryPending(JSON.parse(msg)); } catch {}
  });
  await listener.listen("run_cancelled", (msg) => {
    try {
      const payload = JSON.parse(msg);
      if (payload?.runId) cancelRunAgents(String(payload.runId));
    } catch {}
  });

  console.log("[spawner] Listening for step_pending and story_pending events");
  setInterval(pollForPendingWork, POLL_INTERVAL_MS);
  setInterval(() => { void runClaimMaintenance(); }, Math.min(POLL_INTERVAL_MS, 10_000));
  setInterval(() => {
    const result = cleanupStaleSetfarmOpenClawTaskRecords("interval");
    void restartGatewayAfterOpenClawCleanup("interval", result);
  }, OPENCLAW_STALE_TASK_SWEEP_MS);
  await pollForPendingWork();
  console.log("[spawner] Ready");
}

main().catch((err) => { console.error(`[spawner] Fatal: ${String(err)}`); process.exit(1); });
