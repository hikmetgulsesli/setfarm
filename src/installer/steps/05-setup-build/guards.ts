import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function cleanProcessText(value: unknown): string {
  const text = Buffer.isBuffer(value) ? value.toString("utf-8") : String(value || "");
  return text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\r/g, "")
    .trim();
}

function formatProcessFailure(error: unknown, max = 1200): string {
  const e = error as { status?: unknown; signal?: unknown; stdout?: unknown; stderr?: unknown; message?: unknown };
  const parts: string[] = [];
  const status = e?.status !== undefined ? `exit=${e.status}` : "";
  const signal = e?.signal ? `signal=${String(e.signal)}` : "";
  const header = [status, signal].filter(Boolean).join(" ");
  if (header) parts.push(header);
  const stderr = cleanProcessText(e?.stderr);
  const stdout = cleanProcessText(e?.stdout);
  if (stderr) parts.push(`stderr:\n${stderr}`);
  if (stdout) parts.push(`stdout:\n${stdout}`);
  if (parts.length === 0 && e?.message) parts.push(cleanProcessText(e.message));
  return parts.join("\n\n").slice(0, max);
}

function resolveRepo(context: Record<string, string>): string {
  const repo = context["repo"] || context["REPO"] || "";
  if (repo.startsWith("~/")) return path.join(process.env.HOME || "", repo.slice(2));
  return repo;
}

async function refreshCompatFailure(context: Record<string, string>): Promise<void> {
  if (!context["compat_fail"]) return;
  const repo = resolveRepo(context);
  const packageJson = path.join(repo, "package.json");
  if (!repo || !fs.existsSync(packageJson)) {
    throw new Error(`COMPAT: ${context["compat_fail"]}`);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJson, "utf-8"));
  const { evaluateCompat } = await import("../../compat-engine.js");
  const { fails } = evaluateCompat(pkg, "setup-build");
  if (fails.length > 0) {
    const header = fails.length === 1
      ? fails[0].resolvedMessage
      : `COMPAT_VIOLATIONS (${fails.length}):\n\n` + fails.map((f: any) => `[${f.id}] ${f.resolvedMessage}`).join("\n\n");
    throw new Error(`COMPAT: ${header.slice(0, 800)}`);
  }
  delete context["compat_fail"];
}

function refreshBaselineFailure(parsed: ParsedOutput, context: Record<string, string>): void {
  if (!context["baseline_fail"]) return;
  const repo = resolveRepo(context);
  const packageJson = path.join(repo, "package.json");
  if (!repo || !fs.existsSync(packageJson)) {
    throw new Error(`BASELINE: npm run build failed — ${context["baseline_fail"].slice(0, 300)}`);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJson, "utf-8"));
  const buildCmd = parsed.build_cmd || context["build_cmd_hint"] || (pkg.scripts?.build ? "npm run build" : "");
  if (!buildCmd) {
    delete context["baseline_fail"];
    return;
  }

  try {
    if (buildCmd === "npm run build") {
      execFileSync("npm", ["run", "build"], { cwd: repo, timeout: 180000, stdio: "pipe" });
    } else {
      execFileSync("sh", ["-lc", buildCmd], { cwd: repo, timeout: 180000, stdio: "pipe" });
    }
    delete context["baseline_fail"];
  } catch (e) {
    throw new Error(`BASELINE: npm run build failed — ${formatProcessFailure(e, 300)}`);
  }
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }
  return { ok: errors.length === 0, errors };
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { parsed, context } = ctx;

  // preClaim may record an actionable failure, then the retry agent can fix it.
  // Re-check current repo state before carrying a stale failure forward.
  await refreshCompatFailure(context);
  refreshBaselineFailure(parsed, context);

  // Stamp BUILD_CMD (agent value or pre-computed hint)
  context["build_cmd"] = parsed.build_cmd || context["build_cmd_hint"] || "npm run build";
}
