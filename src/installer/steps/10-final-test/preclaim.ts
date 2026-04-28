import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";

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

function firstJsonObject(text: string): any | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
  }
  return null;
}

function summarizeSmoke(result: any): string[] {
  const lines: string[] = [];
  if (!result || typeof result !== "object") return lines;
  if (result.status) lines.push(`SMOKE_STATUS: ${result.status}`);
  if (result.confidence !== undefined) lines.push(`CONFIDENCE: ${result.confidence}`);
  if (result.routesDiscovered !== undefined) lines.push(`ROUTES_DISCOVERED: ${result.routesDiscovered}`);
  if (result.buttonsChecked !== undefined) lines.push(`BUTTONS_CHECKED: ${result.buttonsChecked}`);
  if (result.formsChecked !== undefined) lines.push(`FORMS_CHECKED: ${result.formsChecked}`);
  if (result.buttonWiringIssues !== undefined) lines.push(`BUTTON_WIRING_ISSUES: ${result.buttonWiringIssues}`);
  if (result.uxDeadEnds !== undefined) lines.push(`UX_DEAD_ENDS: ${result.uxDeadEnds}`);
  if (Array.isArray(result.failures) && result.failures.length > 0) {
    lines.push("TEST_FAILURES:");
    for (const failure of result.failures.slice(0, 20)) lines.push(`- ${String(failure).replace(/\n/g, " ").slice(0, 500)}`);
  }
  return lines;
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = (ctx.context["repo"] || ctx.context["REPO"] || "").replace(/^~/, os.homedir());
  if (!repo || !fs.existsSync(repo)) {
    logger.warn(`[module:final-test preclaim] skipped - repo missing: ${repo || "(empty)"}`, { runId: ctx.runId });
    return;
  }

  const smokeScript = path.join(os.homedir(), ".openclaw", "setfarm-repo", "scripts", "smoke-test.mjs");
  if (!fs.existsSync(smokeScript)) {
    logger.warn("[module:final-test preclaim] skipped - smoke-test.mjs missing", { runId: ctx.runId });
    return;
  }

  try {
    execFileSync("git", ["checkout", "main"], { cwd: repo, timeout: 10_000, stdio: ["pipe", "pipe", "pipe"] });
    execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: repo, timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });
  } catch (syncErr) {
    logger.warn(`[module:final-test preclaim] main sync warning: ${formatFailure(syncErr).slice(0, 300)}`, { runId: ctx.runId });
  }

  let output = "";
  let failed = false;
  try {
    logger.info(`[module:final-test preclaim] Running system smoke gate in ${repo}`, { runId: ctx.runId });
    output = execFileSync("node", [smokeScript, repo], { cwd: repo, timeout: 240_000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    failed = true;
    output = formatFailure(err);
  }

  const parsed = firstJsonObject(output);
  const smokeStatus = parsed?.status ? String(parsed.status).toLowerCase() : "";
  const status = failed || smokeStatus === "fail" ? "retry" : (smokeStatus === "skip" ? "skip" : "done");
  const smokeSummary = smokeStatus
    ? `${smokeStatus} (system smoke gate)`
    : (output.trim().split(/\n/).filter(Boolean).slice(-1)[0] || "pass (system smoke gate)").slice(0, 500);
  const lines = [
    `STATUS: ${status}`,
    `SMOKE_TEST_RESULT: ${smokeSummary}`,
    "FINAL_GATE: system-smoke-preclaim",
    ...summarizeSmoke(parsed),
  ];
  if (!parsed) {
    lines.push(status === "retry" ? "TEST_FAILURES:" : "ISSUES:");
    lines.push(`- ${output.slice(0, 2000).replace(/\n/g, " ")}`);
  }

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) {
    throw new Error(`final-test preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
  }

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, lines.join("\n"));
  logger.info(`[module:final-test preclaim] AUTO-COMPLETED final-test via system smoke (${status})`, { runId: ctx.runId, stepId: ctx.stepId });
}
