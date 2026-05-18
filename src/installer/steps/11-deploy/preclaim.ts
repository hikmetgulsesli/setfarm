import { execFileSync } from "node:child_process";
import os from "node:os";
import type { ClaimContext } from "../types.js";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { missionControlApi, runtimeConfig } from "../../../runtime-config.js";

export interface DeployCapabilitySnapshot {
  platform: NodeJS.Platform | string;
  localMissionControl: boolean;
  localSystemctl: boolean;
  remoteHost: string;
  remoteReachable: boolean;
  deployRequired: boolean;
  deployDisabled: boolean;
}

export interface DeployCapabilityDecision {
  shouldSkip: boolean;
  mode: "local" | "remote" | "disabled" | "unavailable" | "required";
  reason: string;
}

function isTruthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function commandSucceeds(command: string, args: string[], timeoutMs: number): boolean {
  try {
    execFileSync(command, args, { timeout: timeoutMs, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function commandExists(command: string): boolean {
  return commandSucceeds("sh", ["-lc", `command -v ${shellQuote(command)} >/dev/null 2>&1`], 2_000);
}

function localMissionControlAvailable(): boolean {
  if (!commandExists("curl")) return false;
  return commandSucceeds("curl", ["-fsS", "--max-time", "2", missionControlApi("/api/projects/next-port")], 4_000);
}

function localSystemctlAvailable(): boolean {
  if (!commandExists("systemctl")) return false;
  return commandSucceeds("systemctl", ["--user", "is-system-running"], 4_000)
    || commandSucceeds("systemctl", ["--user", "list-units", "--type=service", "--no-pager"], 4_000);
}

function remoteDeployHostReachable(host: string): boolean {
  if (!host || !commandExists("ssh")) return false;
  const script = [
    "command -v systemctl >/dev/null 2>&1",
    `curl -fsS --max-time 3 ${shellQuote(runtimeConfig.missionControlInternalUrl + "/api/projects/next-port")} >/dev/null 2>&1`,
  ].join(" && ");
  return commandSucceeds("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, script], 8_000);
}

function configuredRemoteHost(ctx: ClaimContext): string {
  return (
    ctx.context["deploy_host"]
    || ctx.context["DEPLOY_HOST"]
    || process.env.SETFARM_DEPLOY_HOST
    || process.env.SETFARM_DEPLOY_SSH_HOST
    || ""
  ).trim();
}

export function evaluateDeployCapability(snapshot: DeployCapabilitySnapshot): DeployCapabilityDecision {
  if (snapshot.deployDisabled) {
    return {
      shouldSkip: true,
      mode: "disabled",
      reason: "Deployment is disabled by SETFARM_DISABLE_DEPLOY.",
    };
  }

  if (snapshot.localMissionControl && snapshot.localSystemctl) {
    return {
      shouldSkip: false,
      mode: "local",
      reason: "Local deployment services are available.",
    };
  }

  if (snapshot.remoteHost && snapshot.remoteReachable) {
    return {
      shouldSkip: false,
      mode: "remote",
      reason: `Remote deployment host ${snapshot.remoteHost} is reachable.`,
    };
  }

  const missing = [
    snapshot.localMissionControl ? "" : `Mission Control is not reachable at ${runtimeConfig.missionControlInternalUrl}`,
    snapshot.localSystemctl ? "" : "local systemd user services are unavailable",
    snapshot.remoteHost
      ? `remote deploy host ${snapshot.remoteHost} is not reachable or lacks deploy services`
      : "no SETFARM_DEPLOY_HOST or deploy_host context is configured",
  ].filter(Boolean);

  if (snapshot.deployRequired) {
    return {
      shouldSkip: false,
      mode: "required",
      reason: `Deployment is required but capability checks failed: ${missing.join("; ")}.`,
    };
  }

  return {
    shouldSkip: true,
    mode: "unavailable",
    reason: `Deployment infrastructure is unavailable in this workspace: ${missing.join("; ")}.`,
  };
}

export function detectDeployCapability(ctx: ClaimContext): DeployCapabilitySnapshot {
  const remoteHost = configuredRemoteHost(ctx);
  return {
    platform: process.platform,
    localMissionControl: localMissionControlAvailable(),
    localSystemctl: localSystemctlAvailable(),
    remoteHost,
    remoteReachable: remoteHost ? remoteDeployHostReachable(remoteHost) : false,
    deployRequired: isTruthy(process.env.SETFARM_DEPLOY_REQUIRED) || isTruthy(process.env.SETFARM_REQUIRE_DEPLOY),
    deployDisabled: isTruthy(process.env.SETFARM_DISABLE_DEPLOY),
  };
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  if (isTruthy(process.env.SETFARM_DISABLE_DEPLOY_CAPABILITY_GATE)) {
    logger.info("[module:deploy preclaim] capability gate disabled by environment", { runId: ctx.runId });
    return;
  }

  const snapshot = detectDeployCapability(ctx);
  const decision = evaluateDeployCapability(snapshot);
  if (!decision.shouldSkip) {
    ctx.context["deploy_capability"] = decision.mode;
    ctx.context["deploy_capability_reason"] = decision.reason;
    return;
  }

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) {
    throw new Error(`deploy preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
  }

  const lines = [
    "STATUS: skip",
    "DEPLOY_TYPE: skip",
    "DEPLOY_CAPABILITY: unavailable",
    `SKIP_REASON: ${decision.reason}`,
    `LOCAL_PLATFORM: ${snapshot.platform || os.platform()}`,
    `LOCAL_MISSION_CONTROL: ${snapshot.localMissionControl ? "available" : "unavailable"}`,
    `LOCAL_SYSTEMD: ${snapshot.localSystemctl ? "available" : "unavailable"}`,
    `REMOTE_DEPLOY_HOST: ${snapshot.remoteHost || "none"}`,
    `REMOTE_DEPLOY_REACHABLE: ${snapshot.remoteReachable ? "yes" : "no"}`,
  ];

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, lines.join("\n"));
  logger.warn(`[module:deploy preclaim] AUTO-SKIPPED deploy: ${decision.reason}`, { runId: ctx.runId, stepId: ctx.stepId });
}
