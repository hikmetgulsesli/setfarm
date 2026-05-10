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
  return parts.join("\n\n").slice(0, 5000);
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
  if (result.flowsChecked !== undefined) lines.push(`FLOWS_CHECKED: ${result.flowsChecked}`);
  if (result.buttonWiringIssues !== undefined) lines.push(`BUTTON_WIRING_ISSUES: ${result.buttonWiringIssues}`);
  if (result.semanticClickIssues !== undefined) lines.push(`SEMANTIC_CLICK_ISSUES: ${result.semanticClickIssues}`);
  if (result.weakInteractionAssertions !== undefined) lines.push(`WEAK_INTERACTION_ASSERTIONS: ${result.weakInteractionAssertions}`);
  if (result.uxDeadEnds !== undefined) lines.push(`UX_DEAD_ENDS: ${result.uxDeadEnds}`);
  if (result.flowIssues !== undefined) lines.push(`FLOW_ISSUES: ${result.flowIssues}`);
  if (Array.isArray(result.failures) && result.failures.length > 0) {
    lines.push("TEST_FAILURES:");
    for (const failure of result.failures.slice(0, 20)) lines.push(`- ${String(failure).replace(/\n/g, " ").slice(0, 500)}`);
  }
  return lines;
}

function numericField(result: any, key: string, fallback = 0): number {
  const value = Number(result?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function countArrayField(result: any, key: string): number {
  const value = result?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function buildQaReport(repo: string, result: any, rawOutput: string, status: string): string {
  const reportDir = path.join(repo, "quality-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "qa-smoke-preclaim.md");
  const failures: string[] = Array.isArray(result?.failures)
    ? result.failures.map((item: unknown) => String(item).replace(/\n/g, " "))
    : [rawOutput.slice(0, 3000).replace(/\n/g, " ")].filter(Boolean);
  const lines = [
    "# QA Smoke Preclaim Report",
    "",
    `Status: ${status.toUpperCase()}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    `- Smoke status: ${String(result?.status || status)}`,
    `- Confidence: ${String(result?.confidence ?? "unknown")}`,
    `- Routes discovered: ${String(result?.routesDiscovered ?? 0)}`,
    `- Hash routes discovered: ${String(result?.hashRoutesDiscovered ?? 0)}`,
    `- Buttons checked: ${String(result?.buttonsChecked ?? 0)}`,
    `- Forms checked: ${String(result?.formsChecked ?? 0)}`,
    `- Flows checked: ${String(result?.flowsChecked ?? 0)}`,
    `- Flow issues: ${String(result?.flowIssues ?? 0)}`,
    `- Semantic click issues: ${String(result?.semanticClickIssues ?? 0)}`,
    `- Weak interaction assertions: ${String(result?.weakInteractionAssertions ?? 0)}`,
    `- Failure count: ${String(failures.length)}`,
    "",
    "## Findings",
    ...(failures.length > 0 ? failures.slice(0, 40).map((failure) => `- ${failure}`) : ["- None"]),
  ];
  fs.writeFileSync(reportPath, lines.join("\n") + "\n");
  return path.relative(repo, reportPath).replace(/\\/g, "/");
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = (ctx.context["repo"] || ctx.context["REPO"] || "").replace(/^~/, os.homedir());
  if (!repo || !fs.existsSync(repo)) {
    logger.warn(`[module:qa preclaim] skipped - repo missing: ${repo || "(empty)"}`, { runId: ctx.runId });
    return;
  }

  const smokeScript = path.join(os.homedir(), ".openclaw", "setfarm-repo", "scripts", "smoke-test.mjs");
  if (!fs.existsSync(smokeScript)) {
    logger.warn("[module:qa preclaim] skipped - smoke-test.mjs missing", { runId: ctx.runId });
    return;
  }

  try {
    execFileSync("git", ["checkout", "main"], { cwd: repo, timeout: 10_000, stdio: ["pipe", "pipe", "pipe"] });
    execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: repo, timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });
  } catch (syncErr) {
    logger.warn(`[module:qa preclaim] main sync warning: ${formatFailure(syncErr).slice(0, 300)}`, { runId: ctx.runId });
  }

  let output = "";
  let failed = false;
  try {
    logger.info(`[module:qa preclaim] Running system smoke gate in ${repo}`, { runId: ctx.runId });
    output = execFileSync("node", [smokeScript, repo], { cwd: repo, timeout: 240_000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    failed = true;
    output = formatFailure(err);
  }

  const parsed = firstJsonObject(output);
  const smokeStatus = parsed?.status ? String(parsed.status).toLowerCase() : "";
  const failureCount = countArrayField(parsed, "failures");
  const status = failed || smokeStatus === "fail" || failureCount > 0 ? "retry" : (smokeStatus === "skip" ? "skip" : "done");
  const issueCount = status === "retry" ? Math.max(failureCount, 1) : failureCount;
  const reportPath = buildQaReport(repo, parsed, output, status);
  const routesTested = Math.max(
    1,
    numericField(parsed, "routesDiscovered"),
    countArrayField(parsed, "routes"),
    countArrayField(parsed, "hashRoutes"),
  );
  const screensTested = Math.max(routesTested, numericField(parsed, "screensDiscovered"));
  const interactionsTested = numericField(parsed, "buttonsChecked") + numericField(parsed, "formsChecked");
  const lines = [
    `STATUS: ${status}`,
    `QA_REPORT: ${reportPath}`,
    `QA_SCREENS_TESTED: ${screensTested}`,
    `QA_ROUTES_TESTED: ${routesTested}`,
    `QA_INTERACTIONS_TESTED: ${interactionsTested}`,
    `QA_TOTAL_ISSUES: ${issueCount}`,
    "QA_GATE: system-smoke-preclaim",
    ...summarizeSmoke(parsed),
  ];
  if (!parsed) {
    lines.push(status === "retry" ? "TEST_FAILURES:" : "ISSUES:");
    lines.push(`- ${output.slice(0, 2000).replace(/\n/g, " ")}`);
  }

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) {
    throw new Error(`qa preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
  }

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, lines.join("\n"));
  logger.info(`[module:qa preclaim] AUTO-COMPLETED qa-test via system smoke (${status})`, { runId: ctx.runId, stepId: ctx.stepId });
}
