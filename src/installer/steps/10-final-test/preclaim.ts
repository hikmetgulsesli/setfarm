import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { allocateRuntimePort, writeRunRuntimeArtifact } from "../../runtime-ports.js";
import { recordGateObservation, recordStackEvidencePlanObservation } from "../../operation-observability.js";
import { isBrowserRuntimeStack, resolveOperationalStackContract, stackEvidenceMetadata } from "../../stack-evidence.js";
import { updateRunContext } from "../../repo.js";
import { resolvePlatformScript } from "../../paths.js";
import { ensureSmokeBuildFresh } from "../../smoke-gate.js";

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

function countArrayField(result: any, key: string): number {
  const value = result?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function numericField(result: any, key: string, fallback = 0): number {
  const value = Number(result?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function writeFinalJsonReport(repo: string, result: any, rawOutput: string, status: string, runtime: any): string {
  const reportDir = path.join(repo, "quality-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const relPath = "quality-reports/final-test-1.json";
  const routesTested = Math.max(
    1,
    numericField(result, "routesDiscovered"),
    countArrayField(result, "routes"),
    countArrayField(result, "hashRoutes"),
  );
  const interactionsTested =
    numericField(result, "buttonsChecked") +
    numericField(result, "formsChecked") +
    numericField(result, "flowsChecked");
  const failures = Array.isArray(result?.failures)
    ? result.failures.map((item: unknown) => String(item).replace(/\n/g, " "))
    : (status === "retry" ? [rawOutput.slice(0, 2000).replace(/\n/g, " ")] : []);
  const payload = {
    schema: "setfarm.final-test.v1",
    status,
    generatedAt: new Date().toISOString(),
    runtime,
    smokeStatus: result?.status || (status === "done" ? "pass" : status),
    confidence: result?.confidence ?? null,
    routesTested,
    screensTested: Math.max(routesTested, numericField(result, "screensDiscovered")),
    interactionsTested,
    buttonsChecked: numericField(result, "buttonsChecked"),
    formsChecked: numericField(result, "formsChecked"),
    flowsChecked: numericField(result, "flowsChecked"),
    issueCount: failures.length,
    failures,
    rawOutput: rawOutput.slice(0, 4000),
  };
  fs.writeFileSync(path.join(repo, relPath), JSON.stringify(payload, null, 2));
  return relPath;
}

export function classifyFinalSystemSmokeResult(result: any, rawOutput: string, commandFailed: boolean): {
  result: any;
  status: "done" | "retry" | "skip";
  smokeSummary: string;
} {
  const hasStructuredResult = !!result && typeof result === "object";
  const smokeStatus = hasStructuredResult && result?.status ? String(result.status).toLowerCase() : "";
  const baseFailures = Array.isArray(result?.failures)
    ? result.failures.map((item: unknown) => String(item).replace(/\n/g, " "))
    : [];
  const interactionsTested =
    numericField(result, "buttonsChecked") +
    numericField(result, "formsChecked") +
    numericField(result, "flowsChecked");
  const syntheticFailures: string[] = [];

  if (!hasStructuredResult) {
    syntheticFailures.push(`Final system smoke did not return structured JSON. ${rawOutput.slice(0, 1000).replace(/\n/g, " ")}`);
  } else if (smokeStatus !== "skip" && interactionsTested <= 0) {
    syntheticFailures.push("Final system smoke produced no interaction evidence; final-test cannot complete without at least one tested click, control, form, or flow.");
  }

  const failures = [...baseFailures, ...syntheticFailures];
  const enrichedResult = hasStructuredResult
    ? { ...result, failures }
    : {
        status: commandFailed ? "fail" : "retry",
        failures,
        rawOutput: rawOutput.slice(0, 4000),
      };
  const status = smokeStatus === "skip"
    ? "skip"
    : (commandFailed || smokeStatus === "fail" || smokeStatus === "warn" || failures.length > 0 ? "retry" : "done");
  const smokeSummary = smokeStatus
    ? `${smokeStatus} (system smoke gate)`
    : (rawOutput.trim().split(/\n/).filter(Boolean).slice(-1)[0] || "retry (system smoke gate)").slice(0, 500);

  return { result: enrichedResult, status, smokeSummary };
}

function runPreflight(command: string, cwd: string, timeoutMs: number): { ok: boolean; output: string } {
  try {
    const output = execFileSync("sh", ["-lc", command], { cwd, timeout: timeoutMs, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return { ok: true, output: cleanProcessText(output).slice(0, 500) };
  } catch (err) {
    return { ok: false, output: formatFailure(err).slice(0, 1500) };
  }
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = (ctx.context["repo"] || ctx.context["REPO"] || "").replace(/^~/, os.homedir());
  const stackContract = resolveOperationalStackContract(ctx.context, false);
  await recordStackEvidencePlanObservation({
    run_id: ctx.runId,
    step_id: ctx.stepId,
    agent_id: "tester",
  }, ctx.context, "running", "Final-test preclaim resolved stack evidence contract.");

  if (!isBrowserRuntimeStack(stackContract)) {
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "tester",
      checkId: "final-stack-preclaim",
      label: "Final stack preclaim",
      status: "info",
      summary: "Browser smoke preclaim skipped for non-browser stack",
      detail: "Final-test will use the stack-specific agent prompt/evidence contract instead of Setfarm's browser smoke preclaim.",
      metadata: stackEvidenceMetadata(stackContract),
    });
    return;
  }

  if (!repo || !fs.existsSync(repo)) {
    logger.warn(`[module:final-test preclaim] skipped - repo missing: ${repo || "(empty)"}`, { runId: ctx.runId });
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "tester",
      checkId: "final-repo-preclaim",
      label: "Final repo preclaim",
      status: "pending",
      summary: "Final-test preclaim waiting for repository",
      detail: repo || "repo missing",
      metadata: stackEvidenceMetadata(stackContract),
    });
    return;
  }

  const smokeScript = resolvePlatformScript("smoke-test.mjs");
  if (!fs.existsSync(smokeScript)) {
    logger.warn("[module:final-test preclaim] skipped - smoke-test.mjs missing", { runId: ctx.runId });
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "tester",
      checkId: "final-smoke-script",
      label: "Final smoke script",
      status: "pending",
      summary: "Browser smoke preclaim unavailable",
      detail: "smoke-test.mjs missing",
      metadata: stackEvidenceMetadata(stackContract),
    });
    return;
  }

  const runRow = await pgGet<{ run_number: number | null }>("SELECT run_number FROM runs WHERE id = $1 LIMIT 1", [ctx.runId]);
  const runtime = await allocateRuntimePort({
    runId: ctx.runId,
    runNumber: runRow?.run_number ?? null,
    band: stackContract.runtime?.portBand || "preview",
    host: stackContract.runtime?.host || "127.0.0.1",
  });
  ctx.context["preview_port"] = String(runtime.port);
  ctx.context["dev_server_port"] = String(runtime.port);
  ctx.context["dev_server_url"] = runtime.url;
  ctx.context["qa_url"] = runtime.url;
  const runtimeArtifact = writeRunRuntimeArtifact({
    repo,
    runId: ctx.runId,
    runNumber: runRow?.run_number ?? null,
    stepId: ctx.stepId,
    runtime,
    status: "allocated",
  });
  ctx.context["run_runtime_json"] = runtimeArtifact;
  await updateRunContext(ctx.runId, ctx.context);

  await recordGateObservation({
    runId: ctx.runId,
    stepId: ctx.stepId,
    agentId: "tester",
    checkId: "final-runtime-port-allocation",
    label: "Final runtime port allocation",
    status: "pass",
    summary: `Allocated ${runtime.band} port ${runtime.port}`,
    detail: runtime.url,
    metadata: { runtime, artifactPath: runtimeArtifact, ...stackEvidenceMetadata(stackContract) },
  });

  for (const tool of stackContract.toolPreflight || []) {
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "tester",
      checkId: `final-tool-preflight:${tool.tool}`,
      label: `Final ${tool.tool} preflight`,
      status: "running",
      summary: `Running ${tool.command}`,
      metadata: { tool, ...stackEvidenceMetadata(stackContract) },
    });
    const result = runPreflight(tool.command, repo, tool.timeoutMs);
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "tester",
      checkId: `final-tool-preflight:${tool.tool}`,
      label: `Final ${tool.tool} preflight`,
      status: result.ok ? "pass" : (tool.required ? "blocked" : "info"),
      summary: result.ok ? `${tool.tool} available` : `${tool.tool} unavailable`,
      detail: result.output,
      metadata: { tool, failureCategory: tool.failureCategory, runtime, ...stackEvidenceMetadata(stackContract) },
    });
    if (!result.ok && tool.required) {
      const jsonPath = writeFinalJsonReport(repo, { status: "fail", failures: [`${tool.tool} preflight failed: ${result.output}`] }, result.output, "retry", runtime);
      const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
      if (!step?.id) throw new Error(`final-test preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
      const { completeStep } = await import("../../step-ops.js");
      await completeStep(step.id, [
        "STATUS: retry",
        `SMOKE_TEST_RESULT: ${tool.tool} preflight failed before final smoke.`,
        `FINAL_TEST_JSON: ${jsonPath}`,
        "FINAL_GATE: system-smoke-preclaim",
        "FAILURE_CATEGORY: tooling_contract_missing",
        "TEST_FAILURES:",
        `- ${tool.tool} preflight failed before final-test. ${result.output.replace(/\n/g, " ")}`,
      ].join("\n"));
      return;
    }
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
    const buildFresh = ensureSmokeBuildFresh(repo, {
      runId: ctx.runId,
      stepId: ctx.stepId,
      buildCommand: stackContract.setup?.build,
      timeoutMs: stackContract.runtime?.timeoutMs || 240_000,
      logPrefix: "final-smoke-prebuild",
      env: {
        DEV_SERVER_PORT: String(runtime.port),
        PREVIEW_PORT: String(runtime.port),
        PORT: String(runtime.port),
      },
    });
    if (!buildFresh.ok) {
      failed = true;
      output = buildFresh.failure;
      throw new Error(buildFresh.failure);
    }
    logger.info(`[module:final-test preclaim] Running system smoke gate in ${repo}`, { runId: ctx.runId });
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "tester",
      checkId: "final-system-smoke",
      label: "Final system smoke",
      status: "running",
      summary: "Running final browser smoke gate",
      detail: repo,
      metadata: stackEvidenceMetadata(stackContract),
    });
    output = execFileSync("node", [smokeScript, repo, "--port", String(runtime.port)], {
      cwd: repo,
      timeout: stackContract.runtime?.timeoutMs || 240_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        DEV_SERVER_PORT: String(runtime.port),
        PREVIEW_PORT: String(runtime.port),
        PORT: String(runtime.port),
        DEV_SERVER_URL: runtime.url,
        QA_URL: runtime.url,
      },
    });
  } catch (err) {
    failed = true;
    output = output || formatFailure(err);
  }

  const parsed = firstJsonObject(output);
  const decision = classifyFinalSystemSmokeResult(parsed, output, failed);
  const status = decision.status;
  const jsonPath = writeFinalJsonReport(repo, decision.result, output, status, runtime);
  writeRunRuntimeArtifact({
    repo,
    runId: ctx.runId,
    runNumber: runRow?.run_number ?? null,
    stepId: ctx.stepId,
    runtime,
    status: status === "done" ? "passed" : "failed",
  });
  await recordGateObservation({
    runId: ctx.runId,
    stepId: ctx.stepId,
    agentId: "tester",
    checkId: "final-system-smoke",
    label: "Final system smoke",
    status: status === "retry" ? "retry" : status === "skip" ? "info" : "pass",
    summary: `Final smoke ${status}`,
    detail: output.slice(0, 2000),
    metadata: { runtime, ...stackEvidenceMetadata(stackContract) },
  });
  const lines = [
    `STATUS: ${status}`,
    `SMOKE_TEST_RESULT: ${decision.smokeSummary}`,
    `FINAL_TEST_JSON: ${jsonPath}`,
    "FINAL_GATE: system-smoke-preclaim",
    ...summarizeSmoke(decision.result),
  ];
  if (status === "retry" && !Array.isArray(decision.result?.failures)) {
    lines.push("TEST_FAILURES:");
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
