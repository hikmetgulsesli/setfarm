import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { logger } from "../lib/logger.js";

export type SmokeBuildFreshnessResult = {
  ok: boolean;
  skipped: boolean;
  command: string;
  output: string;
  failure: string;
};

function cleanProcessText(value: unknown): string {
  const text = Buffer.isBuffer(value) ? value.toString("utf-8") : String(value || "");
  return text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "").trim();
}

function formatFailure(error: unknown): string {
  const e = error as { stdout?: unknown; stderr?: unknown; message?: unknown; status?: unknown; signal?: unknown };
  const parts: string[] = [];
  const header = [e?.status !== undefined ? `exit=${e.status}` : "", e?.signal ? `signal=${String(e.signal)}` : ""].filter(Boolean).join(" ");
  if (header) parts.push(header);
  const stdout = cleanProcessText(e?.stdout);
  const stderr = cleanProcessText(e?.stderr);
  if (stdout) parts.push(`stdout:\n${stdout}`);
  if (stderr) parts.push(`stderr:\n${stderr}`);
  if (parts.length === 0 && e?.message) parts.push(cleanProcessText(e.message));
  return parts.join("\n\n").slice(0, 6000);
}

function detectBuildCommand(repoPath: string, preferredBuildCommand?: string): string {
  const preferred = String(preferredBuildCommand || "").trim();
  if (preferred && preferred !== "true") return preferred;

  try {
    const pkgPath = path.join(repoPath, "package.json");
    if (!fs.existsSync(pkgPath)) return "";
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (pkg?.scripts?.build) return "npm run build";
  } catch {}
  return "";
}

export function ensureSmokeBuildFresh(
  repoPath: string,
  options: {
    runId?: string;
    stepId?: string;
    buildCommand?: string;
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
    logPrefix?: string;
  } = {},
): SmokeBuildFreshnessResult {
  const command = detectBuildCommand(repoPath, options.buildCommand);
  if (!repoPath || !fs.existsSync(repoPath) || !command) {
    return { ok: true, skipped: true, command: "", output: "skip (build command unavailable)", failure: "" };
  }

  const logPrefix = options.logPrefix || "smoke-prebuild";
  try {
    logger.info(`[${logPrefix}] Running ${command} before smoke-test.mjs`, {
      runId: options.runId,
      stepId: options.stepId,
    });
    const output = execFileSync("sh", ["-lc", command], {
      cwd: repoPath,
      timeout: options.timeoutMs || 180_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, CI: "true", ...(options.env || {}) },
    });
    return { ok: true, skipped: false, command, output: cleanProcessText(output).slice(-3000), failure: "" };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      command,
      output: "",
      failure: `SMOKE_PREBUILD_FAILED: ${command} failed before smoke-test.mjs.\n${formatFailure(err)}`.slice(0, 6500),
    };
  }
}
