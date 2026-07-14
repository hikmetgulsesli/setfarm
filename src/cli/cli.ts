#!/usr/bin/env node

import { assertRuntimeIntegrityOrExit } from "./runtime-guard.js";
import { installWorkflow } from "../installer/install.js";
import { uninstallAllWorkflows, uninstallWorkflow, checkActiveRuns } from "../installer/uninstall.js";
import { getWorkflowStatus, listRuns, stopWorkflow } from "../installer/status.js";
import { runWorkflow } from "../installer/run.js";
import { listBundledWorkflows } from "../installer/workflow-fetch.js";
import { readRecentLogs } from "../lib/logger.js";
import { emitEvent, getRecentEvents, getRunEvents, type SetfarmEvent } from "../installer/events.js";
import { startDaemon, stopDaemon, getDaemonStatus, isRunning } from "../server/daemonctl.js";
import { startSpawner, stopSpawner, getSpawnerStatus, isSpawnerRunning } from "../server/spawnerctl.js";
import { claimStep, completeStep, failStep, getStories, peekStep } from "../installer/step-ops.js";
import { refreshRunContractSafe } from "../installer/contract-ledger.js";
import { ensureCliSymlink } from "../installer/symlink.js";
import { runMedicCheck, getMedicStatus, getRecentMedicChecks } from "../medic/medic.js";
import { getSql, pgQuery, pgGet, pgRun, pgClose, now } from "../db-pg.js";
import { installMedicCron, uninstallMedicCron, isMedicCronInstalled } from "../medic/medic-cron.js";
import { missionControlApi } from "../runtime-config.js";
import { resolveConvergenceEvalResultDir } from "../runtime-config.js";
import {
  extractProtocolArgument,
  resolveNewRunProtocol,
  selectNewRunProtocolMode,
} from "../execution/run-protocol.js";
import {
  executeRunOperationalAction,
  resolveRunOperationalActionTarget,
} from "../execution/run-operational-action.js";
import { parseOperationalActionArguments } from "./operational-action-arguments.js";
import { runDefaultActivationPreflight } from "../execution/activation-preflight.js";
import { ContentAddressedEvalResultStore } from "../evals/report.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  createV3ReleaseAdmissionRepository,
  readAndClearInternalCanaryAdmissionEnvironment,
} from "../execution/v3-release-admission-repository.js";
import { parseInternalCanaryAdmissionContext } from "../execution/v3-release-admission.js";
import { readClaimEnvelopeFile } from "../execution/claim-authority.js";
import { requestRuntimeCompletion } from "../execution/runtime-completion.js";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, "..", "..", "package.json");
const buildInfoPath = join(__dirname, "..", "BUILD_INFO.json");

function getVersion(): string {
  try {
    if (existsSync(buildInfoPath)) {
      const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8"));
      if (typeof buildInfo.displayVersion === "string" && buildInfo.displayVersion.trim()) {
        return buildInfo.displayVersion.trim();
      }
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const shortSha = String(buildInfo.shortSha || buildInfo.sha || "").slice(0, 8).replace(/[^0-9A-Za-z-]/g, "");
      if (pkg.version && shortSha) return `${pkg.version}+${shortSha}${buildInfo.dirty ? ".dirty" : ""}`;
    }
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function requireClaimEnvelopeForCompilerCliStep(
  target: string,
  hasEnvelope: boolean,
): Promise<void> {
  if (hasEnvelope) return;
  const rows = await pgQuery<{ protocol: string }>(
    `SELECT r.protocol
       FROM steps s
       JOIN runs r ON r.id = s.run_id
      WHERE s.id = $1
         OR (s.run_id = $1 AND s.status IN ('running', 'pending'))
      ORDER BY s.step_index ASC
      LIMIT 2`,
    [target],
  );
  if (rows.some((row) => row.protocol !== "legacy")) {
    throw new Error("COMPILER_CLAIM_ENVELOPE_REQUIRED: pass the immutable --claim-file from this runtime handoff");
  }
}

function getCompilerReleaseSha(): string {
  if (!existsSync(buildInfoPath)) {
    throw new Error("BUILD_INFO.json is required to start a workflow run");
  }
  const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8"));
  const sha = String(buildInfo.sha || "").trim().toLowerCase();
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(sha)) {
    throw new Error("BUILD_INFO.json does not contain a full compiler release SHA");
  }
  return sha;
}

function commandUsable(name: string): boolean {
  try {
    execFileSync(name, ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function openclawMinimaxFallbackUsable(): boolean {
  if (!commandUsable(process.env.OPENCLAW_CLI || "openclaw")) return false;
  const home = process.env.HOME || "";
  const candidates = [
    process.env.OPENCLAW_CONFIG_PATH || "",
    home ? join(home, ".openclaw", "openclaw.json") : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const config = JSON.parse(readFileSync(candidate, "utf-8"));
      const hasMinimaxAuth = Array.isArray(config?.auth?.order?.minimax)
        ? config.auth.order.minimax.length > 0
        : Object.values(config?.auth?.profiles || {}).some((profile: any) => profile?.provider === "minimax");
      const hasMinimaxProvider = Boolean(config?.models?.providers?.minimax);
      if (hasMinimaxAuth && hasMinimaxProvider) return true;
    } catch {
      // Keep quota preflight best-effort; malformed local config should not crash the CLI.
    }
  }
  return false;
}

function isLikelyOutputFileArg(arg: string): boolean {
  return arg.startsWith("/") || arg.startsWith("./") || arg.startsWith("../") || /\.(md|out|txt)$/i.test(arg);
}

async function readFreshStepOutputFile(stepId: string, filePath: string): Promise<string> {
  try {
    // File output is the safest completion path, but stale files can make an
    // agent accidentally pass an old result. Keep the same freshness check for
    // --file and positional file-path use.
    const fileStat = statSync(filePath);
    const stepRow = await pgGet<{ started_at: string | null; status: string }>(
      "SELECT started_at, status FROM steps WHERE id = $1",
      [stepId],
    );
    if (stepRow?.started_at) {
      const stepStartedMs = new Date(stepRow.started_at).getTime();
      const fileMtimeMs = fileStat.mtimeMs;
      if (fileMtimeMs < stepStartedMs - 5000) {
        const ageSec = Math.round((stepStartedMs - fileMtimeMs) / 1000);
        process.stderr.write(`FILE_STALE: ${filePath} mtime is ${ageSec}s older than step started_at. The agent is recycling a previous run's output. Write a fresh file and retry.\n`);
        process.exit(3);
      }
    }
    return readFileSync(filePath, "utf-8").trim();
  } catch (e) {
    process.stderr.write(`Cannot read file ${filePath}: ${e}\n`);
    process.exit(1);
  }
}

function formatEventTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatEventLabel(evt: SetfarmEvent): string {
  const labels: Record<string, string> = {
    "run.started": "Run started",
    "run.completed": "Run completed",
    "run.failed": "Run failed",
    "step.pending": "Step pending",
    "step.running": "Claimed step",
    "step.done": "Step completed",
    "step.failed": "Step failed",
    "step.timeout": "Step timed out",
    "story.started": "Story started",
    "story.done": "Story done",
    "story.verified": "Story verified",
    "story.retry": "Story retry",
    "story.failed": "Story failed",
    "pipeline.advanced": "Pipeline advanced",
  };
  return labels[evt.event] ?? evt.event;
}

function printEvents(events: SetfarmEvent[]): void {
  if (events.length === 0) { console.log("No events yet."); return; }
  for (const evt of events) {
    const time = formatEventTime(evt.ts);
    const agent = evt.agentId ? `  ${evt.agentId.split("_").slice(-1)[0]}` : "";
    const label = formatEventLabel(evt);
    const story = evt.storyTitle ? ` — ${evt.storyTitle}` : "";
    const detail = evt.detail ? ` (${evt.detail})` : "";
    const run = evt.runId ? `  [${evt.runId.slice(0, 8)}]` : "";
    console.log(`${time}${run}${agent}  ${label}${story}${detail}`);
  }
}

async function ensureWorkflowExecutionBackend(workflowId: string): Promise<void> {
  const { gatewayAgentCronsEnabled, removeAgentCrons, setupAgentCrons } = await import("../installer/agent-cron.js");

  if (!gatewayAgentCronsEnabled()) {
    const result = await startSpawner();
    console.log(`Spawner running (PID ${result.pid}).`);
    return;
  }

  const { loadWorkflowSpec } = await import("../installer/workflow-spec.js");
  const { resolveWorkflowDir } = await import("../installer/paths.js");
  const workflowDir = resolveWorkflowDir(workflowId);
  const workflow = await loadWorkflowSpec(workflowDir);

  await removeAgentCrons(workflowId);
  await setupAgentCrons(workflow);

  if (process.platform !== "linux") {
    console.log(`Gateway restart skipped on ${process.platform}; workflow crons were refreshed.`);
    return;
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  try {
    await execFileAsync("systemctl", ["--user", "restart", "openclaw-gateway"], { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await removeAgentCrons(workflowId);
    await setupAgentCrons(workflow);
  } catch (restartErr) {
    process.stderr.write(`Warning: Gateway restart failed: ${restartErr instanceof Error ? restartErr.message : String(restartErr)}\n`);
  }
}

function printUsage() {
  process.stdout.write(
    [
      "setfarm install                      Install all bundled workflows",
      "setfarm uninstall [--force]          Full uninstall (workflows, agents, crons, DB)",
      "",
      "setfarm workflow list                List available workflows",
      "setfarm workflow install <name>      Install a workflow",
      "setfarm workflow uninstall <name>    Uninstall a workflow (blocked if runs active)",
      "setfarm workflow uninstall --all     Uninstall all workflows (--force to override)",
      "setfarm workflow run <name> <task> [--protocol legacy|shadow|v3]",
      "setfarm workflow status <query>      Check run status (task substring, run ID prefix)",
      "setfarm workflow runs                List all workflow runs",
      "setfarm workflow resume <run-id> --expected-snapshot-hash <sha256>  Resume a failed run",
      "setfarm workflow stop <run-id> --expected-snapshot-hash <sha256> [--force]  Stop/cancel a running workflow",
      "setfarm workflow ensure-crons <name>  Ensure workflow scheduler for a workflow",
      "",
      "setfarm dashboard [start] [--port N]   Start dashboard daemon (default: 3333)",
      "setfarm dashboard stop                  Stop dashboard daemon",
      "setfarm dashboard status                Check dashboard status",
      "",
      "setfarm spawner [start]                Start workflow spawner daemon",
      "setfarm spawner stop                   Stop workflow spawner daemon",
      "setfarm spawner restart                Restart workflow spawner daemon",
      "setfarm spawner status                 Check workflow spawner status",
      "",
      "setfarm step peek <agent-id>        Lightweight check for pending work (HAS_WORK or NO_WORK)",
      "setfarm step claim <agent-id>       Claim pending step, output resolved input as JSON",
      "setfarm step complete <step-id> [--claim-file <path>] [--file <path>|<path>]  Complete exact claimed step",
      "setfarm step fail <step-id> [--claim-file <path>] <error>  Fail exact claimed step with retry logic",
      "setfarm step stories <run-id>       List stories for a run",
      "",
      "setfarm medic install                Install medic watchdog cron",
      "setfarm medic uninstall              Remove medic cron",
      "setfarm medic run                    Run medic check now (manual trigger)",
      "setfarm medic status                 Show medic health summary",
      "setfarm medic log [<count>]          Show recent medic check history",
      "",
      "setfarm logs [<lines>]               Show recent activity (from events)",
      "setfarm logs <run-id>                Show activity for a specific run",
      "",
      "setfarm version                      Show installed version",
      "setfarm update                       Pull latest, rebuild, and reinstall workflows",
    ].join("\n") + "\n",
  );
}

async function main() {
  assertRuntimeIntegrityOrExit();
  const args = process.argv.slice(2);
  const [group, action, target] = args;

  if (group === "version" || group === "--version" || group === "-v") {
    console.log(`setfarm v${getVersion()}`);
    return;
  }

  if (group === "ant") {
    const { printAnt } = await import("./ant.js");
    printAnt();
    return;
  }

  if (group === "update") {
    const force = args.includes("--force");
    const repoRoot = join(__dirname, "..", "..");

    // Active-run guard: don't rebuild while pipeline is running
    if (!force) {
      const activeRuns = await checkActiveRuns();
      if (activeRuns.length > 0) {
        process.stderr.write(`Cannot update: ${activeRuns.length} active run(s):\n`);
        for (const run of activeRuns) {
          process.stderr.write(`  - ${run.id} (${run.workflow_id}): ${run.task}\n`);
        }
        process.stderr.write(`\nUse 'setfarm update --force' to override.\n`);
        process.exit(1);
      }
    }

    // No-op guard: skip rebuild if already up-to-date
    console.log("Checking for updates...");
    try {
      execSync("git fetch", { cwd: repoRoot, stdio: "inherit" });
      const diff = execSync("git diff HEAD..origin/main --stat", { cwd: repoRoot, encoding: "utf-8" }).trim();
      if (!diff && !force) {
        console.log("Already up to date. Nothing to rebuild.");
        return;
      }
    } catch {
      // If fetch/diff fails, proceed with pull anyway
    }

    console.log("Pulling latest...");
    try {
      execSync("git pull", { cwd: repoRoot, stdio: "inherit" });
    } catch {
      process.stderr.write("Failed to git pull. Are you in the setfarm repo?\n");
      process.exit(1);
    }
    console.log("Installing dependencies...");
    execSync("npm install", { cwd: repoRoot, stdio: "inherit" });
    console.log("Building...");
    execSync("npm run build", { cwd: repoRoot, stdio: "inherit" });

    // Reinstall workflows
    const workflows = await listBundledWorkflows();
    if (workflows.length > 0) {
      console.log(`Reinstalling ${workflows.length} workflow(s)...`);
      for (const workflowId of workflows) {
        try {
          await installWorkflow({ workflowId });
          console.log(`  ✓ ${workflowId}`);
        } catch (err) {
          console.log(`  ✗ ${workflowId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    ensureCliSymlink();
    console.log(`\nUpdated to v${getVersion()}.`);
    return;
  }

  if (group === "uninstall" && (!args[1] || args[1] === "--force")) {
    if (!process.stdin.isTTY && !args.includes("--force")) {
      process.stderr.write("Error: 'uninstall' is blocked in non-interactive (agent) sessions.\nUse --force from a terminal to override.\n");
      process.exit(1);
    }
    const force = args.includes("--force");
    const activeRuns = await checkActiveRuns();
    if (activeRuns.length > 0 && !force) {
      process.stderr.write(`Cannot uninstall: ${activeRuns.length} active run(s):\n`);
      for (const run of activeRuns) {
        process.stderr.write(`  - ${run.id} (${run.workflow_id}): ${run.task}\n`);
      }
      process.stderr.write(`\nUse --force to uninstall anyway.\n`);
      process.exit(1);
    }

    // Stop dashboard if running
    if (isRunning().running) {
      stopDaemon();
      console.log("Dashboard stopped.");
    }

    await uninstallAllWorkflows();
    console.log("Setfarm fully uninstalled (workflows, agents, crons, database, skill).");
    return;
  }

  if (group === "install" && !args[1]) {
    const workflows = await listBundledWorkflows();
    if (workflows.length === 0) { console.log("No bundled workflows found."); return; }

    console.log(`Installing ${workflows.length} workflow(s)...`);
    for (const workflowId of workflows) {
      try {
        await installWorkflow({ workflowId });
        console.log(`  ✓ ${workflowId}`);
      } catch (err) {
        console.log(`  ✗ ${workflowId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    ensureCliSymlink();
    console.log(`\nDone. Start a workflow with: setfarm workflow run <name> "your task"`);

    // Auto-start dashboard if not already running
    if (!isRunning().running) {
      try {
        const result = await startDaemon(3333);
        console.log(`\nDashboard started (PID ${result.pid}): http://localhost:${result.port}`);
      } catch (err) {
        console.log(`\nNote: Could not start dashboard: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log("\nDashboard already running.");
    }

    if (!isSpawnerRunning().running) {
      try {
        const result = await startSpawner();
        console.log(`Spawner started (PID ${result.pid}).`);
      } catch (err) {
        console.log(`Note: Could not start spawner: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log("Spawner already running.");
    }
    return;
  }

  if (group === "dashboard") {
    const sub = args[1];

    if (sub === "stop") {
      if (stopDaemon()) {
        console.log("Dashboard stopped.");
      } else {
        console.log("Dashboard is not running.");
      }
      return;
    }

    if (sub === "status") {
      const st = getDaemonStatus();
      if (st && st.running) {
        console.log(`Dashboard running (PID ${st.pid ?? "unknown"})`);
      } else {
        console.log("Dashboard is not running.");
      }
      return;
    }

    // start (explicit or implicit)
    let port = 3333;
    const portIdx = args.indexOf("--port");
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10) || 3333;
    } else if (sub && sub !== "start" && !sub.startsWith("-")) {
      // legacy: setfarm dashboard 4000
      const parsed = parseInt(sub, 10);
      if (!Number.isNaN(parsed)) port = parsed;
    }

    if (isRunning().running) {
      const status = getDaemonStatus();
      console.log(`Dashboard already running (PID ${status?.pid})`);
      console.log(`  http://localhost:${port}`);
      return;
    }

    const result = await startDaemon(port);
    console.log(`Dashboard started (PID ${result.pid})`);
    console.log(`  http://localhost:${result.port}`);
    return;
  }

  if (group === "spawner") {
    const sub = args[1];

    if (sub === "stop") {
      if (stopSpawner()) {
        console.log("Spawner stopped.");
      } else {
        console.log("Spawner is not running.");
      }
      return;
    }

    if (sub === "restart") {
      stopSpawner();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const result = await startSpawner();
      console.log(`Spawner restarted (PID ${result.pid}).`);
      console.log(`  log: ${result.logFile}`);
      return;
    }

    if (sub === "status") {
      const st = getSpawnerStatus();
      if (st.running) {
        console.log(`Spawner running (PID ${st.pid ?? "unknown"})`);
      } else {
        console.log("Spawner is not running.");
      }
      console.log(`  log: ${st.logFile}`);
      return;
    }

    const result = await startSpawner();
    console.log(`Spawner started (PID ${result.pid}).`);
    console.log(`  log: ${result.logFile}`);
    return;
  }

  if (group === "medic") {
    if (action === "install") {
      const result = await installMedicCron();
      if (result.ok) {
        console.log("Medic watchdog installed (checks every 5 minutes).");
      } else {
        console.error(`Failed to install medic: ${result.error}`);
        process.exit(1);
      }
      return;
    }

    if (action === "uninstall") {
      const result = await uninstallMedicCron();
      if (result.ok) {
        console.log("Medic watchdog removed.");
      } else {
        console.error(`Failed to uninstall medic: ${result.error}`);
        process.exit(1);
      }
      return;
    }

    if (action === "run") {
      const result = await runMedicCheck();
      if (result.issuesFound === 0) {
        console.log(`All clear — no issues found (${result.checkedAt})`);
      } else {
        console.log(`Medic check complete: ${result.summary}`);
        console.log("");
        for (const f of result.findings) {
          const icon = f.severity === "critical" ? "!!!" : f.severity === "warning" ? " ! " : "   ";
          const fix = f.remediated ? " [FIXED]" : "";
          console.log(`  ${icon} ${f.message}${fix}`);
        }
      }
      return;
    }

    if (action === "status") {
      const status = await getMedicStatus();
      const cronInstalled = await isMedicCronInstalled();

      console.log("Setfarm Medic");
      console.log(`  Cron: ${cronInstalled ? "installed (every 5 min)" : "not installed"}`);

      if (status.lastCheck) {
        const ago = Math.round((Date.now() - new Date(status.lastCheck.checkedAt).getTime()) / 60000);
        console.log(`  Last check: ${ago}min ago — ${status.lastCheck.summary}`);
      } else {
        console.log("  Last check: never");
      }

      console.log(`  Last 24h: ${status.recentChecks} checks, ${status.recentIssues} issues found, ${status.recentActions} auto-fixed`);
      return;
    }

    if (action === "log") {
      const limit = target ? parseInt(target, 10) || 20 : 20;
      const checks = await getRecentMedicChecks(limit);
      if (checks.length === 0) {
        console.log("No medic checks recorded yet.");
        return;
      }
      for (const check of checks) {
        const ts = new Date(check.checkedAt).toLocaleString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
        });
        const icon = check.issuesFound > 0 ? (check.actionsTaken > 0 ? "~" : "X") : ".";
        console.log(`  ${icon} ${ts} — ${check.summary}`);
      }
      return;
    }

    printUsage();
    process.exit(1);
  }

  if (group === "step") {
    if (action === "peek") {
      if (!target) { process.stderr.write("Missing agent-id.\n"); process.exit(1); }
      const callerIdx = args.indexOf("--caller");
      const callerAgent = callerIdx !== -1 ? args[callerIdx + 1] : undefined;
      const result = await peekStep(target, callerAgent);
      process.stdout.write(result + "\n");
      return;
    }
    if (action === "claim") {
      if (!target) { process.stderr.write("Missing agent-id.\n"); process.exit(1); }
      const callerIdx = args.indexOf("--caller");
      const callerAgent = callerIdx !== -1 ? args[callerIdx + 1] : undefined;
      const result = await claimStep(target, callerAgent);
      if (!result.found) {
        process.stdout.write("NO_WORK\n");
      } else {
        process.stdout.write(JSON.stringify({
          schema: "setfarm.claim-envelope.v1",
          protocol: result.protocol || "legacy",
          issuedAt: new Date().toISOString(),
          stepId: result.stepId,
          workflowStepId: result.workflowStepId,
          runId: result.runId,
          storyId: result.storyId,
          storyDbId: result.storyDbId,
          claimId: result.claimId,
          claimAgentId: result.claimAgentId,
          runtimeAgentId: callerAgent || target,
          claimGeneration: result.claimGeneration,
          attempt: result.attempt,
          input: result.resolvedInput,
        }) + "\n");
      }
      return;
    }
    if (action === "complete") {
      if (!target) { process.stderr.write("Missing step-id.\n"); process.exit(1); }
      const claimFileIdx = args.indexOf("--claim-file");
      const claimEnvelope = claimFileIdx !== -1 && args[claimFileIdx + 1]
        ? readClaimEnvelopeFile(args[claimFileIdx + 1])
        : undefined;
      await requireClaimEnvelopeForCompilerCliStep(target, Boolean(claimEnvelope));
      // Read output from --file flag, a positional file path, args, or stdin.
      let output = "";
      const fileIdx = args.indexOf("--file");
      if (fileIdx !== -1 && args[fileIdx + 1]) {
        output = await readFreshStepOutputFile(target, args[fileIdx + 1]);
      } else {
        const outputArgs = args.slice(3).filter((_, index, values) => {
          const absoluteIndex = index + 3;
          if (values[index] === "--file" || values[index] === "--claim-file") return false;
          if (absoluteIndex > 0 && ["--file", "--claim-file"].includes(args[absoluteIndex - 1] || "")) return false;
          return true;
        });
        if (outputArgs.length === 1 && isLikelyOutputFileArg(outputArgs[0])) {
          if (!existsSync(outputArgs[0])) {
            process.stderr.write(`Cannot read file ${outputArgs[0]}: file does not exist. Use stdin for literal one-argument output.\n`);
            process.exit(1);
          }
          output = await readFreshStepOutputFile(target, outputArgs[0]);
        } else {
          output = outputArgs.join(" ").trim();
        }
      }
      if (!output) {
        // Read from stdin (piped input) — fallback
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        output = Buffer.concat(chunks).toString("utf-8").trim();
      }
      if (claimEnvelope) {
        const submission = await requestRuntimeCompletion(getSql(), {
          envelope: claimEnvelope,
          output,
        });
        if (submission.status !== "direct") {
          emitEvent({
            ts: new Date().toISOString(),
            event: "runtime.completion_requested",
            runId: submission.request.runId,
            stepId: submission.request.workflowStepId,
            storyId: submission.request.storyId,
            agentId: submission.request.claimEnvelope.runtimeAgentId,
            detail: `Completion ${submission.request.requestId} awaits proven runtime drain`,
          });
          await pgRun("SELECT pg_notify('runtime_completion_requested', $1)", [JSON.stringify({
            completionRequestId: submission.request.requestId,
            runId: submission.request.runId,
            runtimeSessionId: submission.request.runtimeSessionId,
          })]);
          process.stdout.write(JSON.stringify({
            advanced: false,
            runCompleted: false,
            completionRequested: true,
            completionRequestId: submission.request.requestId,
            requestState: submission.request.state,
          }) + "\n");
          process.stdout.write("\n===== SESSION_DONE =====\nCompletion was durably requested. Setfarm now owns runtime drain and fenced acceptance.\nDo NOT attempt any further work. Reply HEARTBEAT_OK and stop.\n");
          return;
        }
      }
      const result = await completeStep(target, output, claimEnvelope);
      process.stdout.write(JSON.stringify(result) + "\n");
      process.stdout.write("\n===== SESSION_DONE =====\nStep completed successfully. This session's work is FINISHED.\nDo NOT attempt any further work. Reply HEARTBEAT_OK and stop.\n");
      return;
    }
    if (action === "fail") {
      if (!target) { process.stderr.write("Missing step-id.\n"); process.exit(1); }
      const claimFileIdx = args.indexOf("--claim-file");
      const claimEnvelope = claimFileIdx !== -1 && args[claimFileIdx + 1]
        ? readClaimEnvelopeFile(args[claimFileIdx + 1])
        : undefined;
      await requireClaimEnvelopeForCompilerCliStep(target, Boolean(claimEnvelope));
      const error = args.slice(3).filter((value, index) => {
        const absoluteIndex = index + 3;
        if (value === "--claim-file") return false;
        if (absoluteIndex > 0 && args[absoluteIndex - 1] === "--claim-file") return false;
        return true;
      }).join(" ").trim() || "Unknown error";
      if (claimEnvelope) {
        const submission = await requestRuntimeCompletion(getSql(), {
          envelope: claimEnvelope,
          output: `STATUS: fail\nERROR: ${error}`,
        });
        if (submission.status !== "direct") {
          emitEvent({
            ts: new Date().toISOString(),
            event: "runtime.completion_requested",
            runId: submission.request.runId,
            stepId: submission.request.workflowStepId,
            storyId: submission.request.storyId,
            agentId: submission.request.claimEnvelope.runtimeAgentId,
            detail: `Failure disposition ${submission.request.requestId} awaits proven runtime drain`,
          });
          await pgRun("SELECT pg_notify('runtime_completion_requested', $1)", [JSON.stringify({
            completionRequestId: submission.request.requestId,
            runId: submission.request.runId,
            runtimeSessionId: submission.request.runtimeSessionId,
          })]);
          process.stdout.write(JSON.stringify({
            failed: false,
            failureRequested: true,
            completionRequestId: submission.request.requestId,
            requestState: submission.request.state,
          }) + "\n");
          process.stdout.write("\n===== SESSION_DONE =====\nFailure disposition was durably requested. Setfarm now owns runtime drain and fenced transition.\nDo NOT attempt any further work. Reply HEARTBEAT_OK and stop.\n");
          return;
        }
      }
      const result = await failStep(target, error, claimEnvelope);
      process.stdout.write(JSON.stringify(result) + "\n");
      process.stdout.write("\n===== SESSION_DONE =====\nStep failed and recorded. This session's work is FINISHED.\nDo NOT attempt any further work. Reply HEARTBEAT_OK and stop.\n");
      return;
    }
    if (action === "stories") {
      if (!target) { process.stderr.write("Missing run-id.\n"); process.exit(1); }
      let runId = target;
      let run: { id: string } | undefined;
      if (/^\d+$/.test(target)) {
        run = await pgGet<{ id: string }>("SELECT id FROM runs WHERE run_number = $1 LIMIT 1", [parseInt(target, 10)]);
      }
      if (!run) {
        run = await pgGet<{ id: string }>("SELECT id FROM runs WHERE id = $1 OR id LIKE $2 ORDER BY created_at DESC LIMIT 1", [target, `${target}%`]);
      }
      if (run?.id) runId = run.id;
      const stories = await getStories(runId);
      if (stories.length === 0) { console.log("No stories found for this run."); return; }
      for (const s of stories) {
        const retryInfo = s.retryCount > 0 ? ` (retry ${s.retryCount})` : "";
        console.log(`${s.storyId.padEnd(8)} [${s.status.padEnd(7)}] ${s.title}${retryInfo}`);
      }
      return;
    }
    process.stderr.write(`Unknown step action: ${action}\n`);
    printUsage();
    process.exit(1);
  }

  if (group === "logs") {
    const arg = args[1];
    if (arg && !/^\d+$/.test(arg)) {
      // Looks like a run ID (or prefix)
      const events = getRunEvents(arg);
      if (events.length === 0) {
        console.log(`No events found for run matching "${arg}".`);
      } else {
        printEvents(events);
      }
      return;
    }
    // Also support "setfarm logs #3" to show events for run number 3
    if (arg && /^#\d+$/.test(arg)) {
      const runNum = parseInt(arg.slice(1), 10);
      const r = await pgGet<{ id: string }>("SELECT id FROM runs WHERE run_number = $1", [runNum]);
      if (r) {
        const events = getRunEvents(r.id);
        if (events.length === 0) { console.log(`No events for run #${runNum}.`); }
        else { printEvents(events); }
      } else {
        console.log(`No run found with number #${runNum}.`);
      }
      return;
    }
    const limit = parseInt(arg, 10) || 50;
    const events = getRecentEvents(limit);
    printEvents(events);
    return;
  }

  if (args.length < 2) { printUsage(); process.exit(1); }
  if (group !== "workflow") { printUsage(); process.exit(1); }

  if (action === "runs") {
    const runs = await listRuns();
    if (runs.length === 0) { console.log("No workflow runs found."); return; }
    console.log("Workflow runs:");
    for (const r of runs) {
      const num = r.run_number != null ? `#${r.run_number}` : r.id.slice(0, 8);
      console.log(`  [${r.status.padEnd(9)}] ${num.padEnd(6)} ${r.id.slice(0, 8)}  ${r.workflow_id.padEnd(14)}  ${r.task.slice(0, 50)}${r.task.length > 50 ? "..." : ""}`);
    }
    return;
  }

  if (action === "list") {
    const workflows = await listBundledWorkflows();
    if (workflows.length === 0) { process.stdout.write("No workflows available.\n"); } else {
      process.stdout.write("Available workflows:\n");
      for (const w of workflows) process.stdout.write(`  ${w}\n`);
    }
    return;
  }

  if (action === "stop") {
    if (!target) { process.stderr.write("Missing run-id.\n"); printUsage(); process.exit(1); }
    const operationalArguments = parseOperationalActionArguments(args);
    if (!process.stdin.isTTY && !operationalArguments.forceConsent) {
      process.stderr.write("Error: 'workflow stop' is blocked in non-interactive (agent) sessions.\nUse --force from a terminal to override.\n");
      process.exit(1);
    }
    const result = await stopWorkflow(target, operationalArguments.expectedSnapshotHash);
    console.log(
      `Cancellation ${result.requestState} for run ${result.runId.slice(0, 8)} (${result.workflowId}); ` +
      `request ${result.terminationRequestId}. Runtime ownership remains active until proven drained.`,
    );
    return;
  }

  if (!target) { printUsage(); process.exit(1); }

  if (action === "install") {
    const result = await installWorkflow({ workflowId: target });
    process.stdout.write(`Installed workflow: ${result.workflowId}\nAgent crons will start when a run begins.\n`);
    process.stdout.write(`\nStart with: setfarm workflow run ${result.workflowId} "your task"\n`);
    return;
  }

  if (action === "uninstall") {
    if (!process.stdin.isTTY && !args.includes("--force")) {
      process.stderr.write("Error: 'workflow uninstall' is blocked in non-interactive (agent) sessions.\nUse --force from a terminal to override.\n");
      process.exit(1);
    }
    const force = args.includes("--force");
    const isAll = target === "--all" || target === "all";
    const activeRuns = await checkActiveRuns(isAll ? undefined : target);
    if (activeRuns.length > 0 && !force) {
      process.stderr.write(`Cannot uninstall: ${activeRuns.length} active run(s):\n`);
      for (const run of activeRuns) {
        process.stderr.write(`  - ${run.id} (${run.workflow_id}): ${run.task}\n`);
      }
      process.stderr.write(`\nUse --force to uninstall anyway.\n`);
      process.exit(1);
    }
    if (isAll) { await uninstallAllWorkflows(); } else { await uninstallWorkflow({ workflowId: target }); }
    return;
  }

  if (action === "status") {
    const query = args.slice(2).join(" ").trim();
    if (!query) { process.stderr.write("Missing search query.\n"); printUsage(); process.exit(1); }
    const result = await getWorkflowStatus(query);
    if (result.status === "not_found") { process.stdout.write(`${result.message}\n`); return; }
    const { run, steps } = result;
    const runLabel = run.run_number != null ? `#${run.run_number} (${run.id})` : run.id;
    const lines = [
      `Run: ${runLabel}`,
      `Workflow: ${run.workflow_id}`,
      `Protocol: ${run.protocol}/v${run.protocol_version}`,
      `Task: ${run.task.slice(0, 120)}${run.task.length > 120 ? "..." : ""}`,
      `Status: ${run.status}`,
      `Created: ${run.created_at}`,
      `Updated: ${run.updated_at}`,
      "",
      "Steps:",
      ...steps.map((s) => `  [${s.status}] ${s.step_id} (${s.agent_id})`),
    ];
    const stories = await getStories(run.id);
    if (stories.length > 0) {
      const done = stories.filter((s) => s.status === "done").length;
      const verified = stories.filter((s) => s.status === "verified").length;
      const complete = done + verified;
      const running = stories.filter((s) => s.status === "running").length;
      const failed = stories.filter((s) => s.status === "failed").length;
      const skipped = stories.filter((s) => s.status === "skipped").length;
      lines.push("", `Stories: ${complete}/${stories.length} complete${verified ? `, ${verified} verified` : ""}${running ? `, ${running} running` : ""}${skipped ? `, ${skipped} skipped` : ""}${failed ? `, ${failed} failed` : ""}`);
      for (const s of stories) {
        lines.push(`  ${s.storyId.padEnd(8)} [${s.status.padEnd(7)}] ${s.title}`);
      }
    }
    process.stdout.write(lines.join("\n") + "\n");
    return;
  }

  if (action === "resume") {
    if (!target) { process.stderr.write("Missing run-id.\n"); printUsage(); process.exit(1); }
    const operationalArguments = parseOperationalActionArguments(args);
    const runId = await resolveRunOperationalActionTarget(getSql(), target);
    const result = await executeRunOperationalAction(getSql(), {
      action: "resume",
      runId,
      expectedSnapshotHash: operationalArguments.expectedSnapshotHash,
    });
    if (result.action !== "resume") throw new Error("RUN_OPERATIONAL_ACTION_RESULT_KIND_MISMATCH");

    // These are post-commit wakeups/projections only. The durable resume plan,
    // lifecycle rows, and operational outbox event already committed atomically.
    try {
      await refreshRunContractSafe(result.runId, "cli.resume.canonical_action");
    } catch (err) {
      process.stderr.write(`Warning: Could not refresh post-commit run contract: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    try {
      emitEvent({
        ts: now(),
        event: "run.resumed" as SetfarmEvent["event"],
        runId: result.runId,
        workflowId: result.workflowId,
        stepId: result.targetWorkflowStepId,
        detail: `Canonical resume plan ${result.planHash}`,
      });
    } catch (err) {
      process.stderr.write(`Warning: Could not publish post-commit resume projection: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    try {
      await ensureWorkflowExecutionBackend(result.workflowId);
    } catch (err) {
      process.stderr.write(`Warning: Could not start workflow execution backend: ${err instanceof Error ? err.message : String(err)}\n`);
    }

    console.log(`Resumed run ${result.runId.slice(0, 8)} from step "${result.targetWorkflowStepId}" (plan ${result.planHash.slice(0, 12)})`);
    return;
  }

  if (action === "ensure-crons") {
    const { loadWorkflowSpec } = await import("../installer/workflow-spec.js");
    const { resolveWorkflowDir } = await import("../installer/paths.js");
    const { setupAgentCrons, removeAgentCrons, gatewayAgentCronsEnabled } = await import("../installer/agent-cron.js");
    const workflowDir = resolveWorkflowDir(target);
    const workflow = await loadWorkflowSpec(workflowDir);
    if (!gatewayAgentCronsEnabled()) {
      await removeAgentCrons(target);
      const result = await startSpawner();
      console.log(`Gateway agent crons disabled; event-driven spawner owns workflow "${target}" (PID ${result.pid}).`);
      return;
    }
    // Force recreate: remove existing then create fresh
    await removeAgentCrons(target);
    await setupAgentCrons(workflow);
    console.log(`Recreated agent crons for workflow "${target}".`);
    return;
  }

  if (action === "run") {
    let notifyUrl: string | undefined;
    let forceQuota = false;
    const extractedProtocol = extractProtocolArgument(args.slice(3));
    const requestedProtocol = extractedProtocol.requestedMode;
    const runArgs = extractedProtocol.remainingArgs;
    const nuIdx = runArgs.indexOf("--notify-url");
    if (nuIdx !== -1) {
      notifyUrl = runArgs[nuIdx + 1];
      runArgs.splice(nuIdx, 2);
    }
    const fqIdx = runArgs.indexOf("--force-quota");
    if (fqIdx !== -1) {
      forceQuota = true;
      runArgs.splice(fqIdx, 1);
    }
    let taskTitle = runArgs.join(" ").trim();
    // E2BIG fix: if task starts with @, read from file
    if (taskTitle.startsWith("@")) {
      const { readFileSync } = await import("fs");
      taskTitle = readFileSync(taskTitle.slice(1), "utf8").trim();
    }
    if (!taskTitle) { process.stderr.write("Missing task title.\n"); printUsage(); process.exit(1); }

    const compilerReleaseSha = getCompilerReleaseSha();
    const selectedProtocol = selectNewRunProtocolMode(requestedProtocol);
    const internalCanaryAdmission = parseInternalCanaryAdmissionContext(
      readAndClearInternalCanaryAdmissionEnvironment(),
    );
    if (selectedProtocol !== "v3" && internalCanaryAdmission !== null) {
      throw new Error("V3_INTERNAL_CANARY_CONTEXT_FORBIDDEN");
    }
    let activationPreflight: Readonly<{
      status: "pass" | "fail";
      hash: string;
      stored: boolean;
    }> | undefined;
    if (selectedProtocol === "shadow" || selectedProtocol === "v3") {
      const preflight = await runDefaultActivationPreflight({
        protocol: selectedProtocol,
        compilerReleaseSha,
      });
      if (preflight.status !== "pass") {
        const failures = preflight.report.checks
          .filter((check) => check.status === "fail")
          .map((check) => check.code)
          .join(",");
        throw new Error(
          `ACTIVATION_PREFLIGHT_FAILED: ${failures || "UNKNOWN"} report=${preflight.hash}`,
        );
      }
      activationPreflight = preflight;
    }
    const releaseAdmission = selectedProtocol === "v3"
      ? internalCanaryAdmission
        ? await createV3ReleaseAdmissionRepository(
            getSql(),
            new ContentAddressedEvalResultStore(resolveConvergenceEvalResultDir()),
          ).verifyCanarySelection({
            releaseSha: compilerReleaseSha,
            taskHash: hashCanonicalJson(taskTitle),
            context: internalCanaryAdmission,
          })
        : await createV3ReleaseAdmissionRepository(
            getSql(),
            new ContentAddressedEvalResultStore(resolveConvergenceEvalResultDir()),
          ).requireReleaseGo(compilerReleaseSha)
      : undefined;
    // Validate the fully bound identity before spawner/quota checks or any run
    // DB mutation.
    resolveNewRunProtocol({
      ...(requestedProtocol !== undefined ? { requestedMode: requestedProtocol } : {}),
      compilerReleaseSha,
      ...(activationPreflight ? { activationPreflight } : {}),
      ...(releaseAdmission ? { releaseAdmission } : {}),
    });

    if (process.env.SETFARM_DISABLE_SPAWNER_AUTOSTART !== "1" && !isSpawnerRunning().running) {
      try {
        const result = await startSpawner();
        console.log(`Spawner started (PID ${result.pid}).`);
      } catch (err) {
        process.stderr.write(`Cannot start workflow run: spawner failed to start. ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    }

    // Wave 7 (plan: reactive-frolicking-cupcake.md): Kimi quota pre-flight guard.
    // Hits the MC kimi-quota endpoint (which queries Kimi Code billing in turn)
    // and refuses to start a run if quota is critically low. Reason: runs #338-340
    // wasted hours appearing as "gateway stalls" while developer agents were
    // actually getting 403 every call from an exhausted weekly quota. The guard
    // is bypassable with --force-quota for the case where you want a run anyway
    // (e.g. workflows that don't use kimi at all). The check is best-effort —
    // if the quota endpoint is unreachable we let the run through with a warning,
    // we never block a run because of a transient MC API failure.
    if (!forceQuota) {
      try {
        const http = await import("node:http");
        const quotaUrl = missionControlApi("/api/kimi-quota");
        const body = await new Promise<string>((resolve, reject) => {
          const req = http.get(quotaUrl, { timeout: 3000 }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            res.on("error", reject);
          });
          req.on("timeout", () => { req.destroy(); reject(new Error("quota check timeout")); });
          req.on("error", reject);
        });
        const data = JSON.parse(body);
        const sev = data?.severity as string | undefined;
        const snapshot = data?.snapshot;
        if (sev === "exhausted") {
          const w = snapshot?.weekly;
          const r = snapshot?.rateWindow;
          const resetMs = (w?.remaining === 0 ? w?.resetInMs : r?.resetInMs) || 0;
          const resetMin = Math.max(1, Math.round(resetMs / 60000));
          if (commandUsable(process.env.OPENCODE_CLI || "opencode") || openclawMinimaxFallbackUsable()) {
            process.stderr.write(
              `Kimi quota exhausted — continuing with minimax fallback.\n` +
              `  Weekly: ${w?.used ?? "?"}/${w?.limit ?? "?"} remaining=${w?.remaining ?? "?"}\n` +
              `  5h window: ${r?.used ?? "?"}/${r?.limit ?? "?"} remaining=${r?.remaining ?? "?"}\n` +
              `  Kimi resets in ~${resetMin} min.\n`,
            );
          } else {
          process.stderr.write(
            `Kimi quota exhausted — refusing to start run.\n` +
            `  Weekly: ${w?.used ?? "?"}/${w?.limit ?? "?"} remaining=${w?.remaining ?? "?"}\n` +
            `  5h window: ${r?.used ?? "?"}/${r?.limit ?? "?"} remaining=${r?.remaining ?? "?"}\n` +
            `  Resets in ~${resetMin} min.\n` +
              `  Install/configure opencode/minimax or re-run with --force-quota to bypass.\n`,
          );
          process.exit(2);
          }
        }
        if (sev === "critical") {
          const w = snapshot?.weekly;
          const r = snapshot?.rateWindow;
          process.stderr.write(
            `Kimi quota critical — proceeding but expect failures.\n` +
            `  Weekly remaining=${w?.remaining ?? "?"}, 5h remaining=${r?.remaining ?? "?"}\n` +
            `  Use --force-quota to silence this warning.\n`,
          );
        } else if (sev === "warn") {
          const w = snapshot?.weekly;
          process.stderr.write(`Kimi quota warning: weekly remaining=${w?.remaining ?? "?"}\n`);
        }
      } catch (qErr) {
        // Quota endpoint unreachable — log and continue (never block on transient failure)
        process.stderr.write(`Kimi quota check skipped: ${(qErr as Error).message}\n`);
      }
    }

    const run = await runWorkflow({
      workflowId: target,
      taskTitle,
      notifyUrl,
      ...(requestedProtocol !== undefined ? { requestedProtocol } : {}),
      compilerReleaseSha,
      ...(activationPreflight ? { activationPreflight } : {}),
      ...(releaseAdmission ? { releaseAdmission } : {}),
    });
    process.stdout.write(
      [
        `Run: #${run.runNumber} (${run.id})`,
        `Workflow: ${run.workflowId}`,
        `Protocol: ${run.protocol}/v${run.protocolVersion}`,
        `Task: ${run.task}`,
        `Status: ${run.status}`,
      ].join("\n") + "\n",
    );
    return;
  }

  process.stderr.write(`Unknown action: ${action}\n`);
  printUsage();
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
