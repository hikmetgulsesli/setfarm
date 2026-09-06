import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import {
  allocateRuntimePort,
  createRunRuntimeArtifactV1,
  writeRunRuntimeArtifact,
  type RuntimeAllocation,
} from "../../runtime-ports.js";
import { recordGateObservation, recordStackEvidencePlanObservation } from "../../operation-observability.js";
import { resolveOperationalStackContract, stackEvidenceMetadata, stackExecutionPlanForStep } from "../../stack-evidence.js";
import { resolvePlatformScript } from "../../paths.js";
import { ensureSmokeBuildFresh } from "../../smoke-gate.js";
import { ensurePlaywrightChromiumInstalled, isMissingPlaywrightBrowserFailure } from "../../playwright-runtime.js";
import { isInternalProductionRecoverySourceBootstrapRunContextV1 } from "../../../execution/recovery-source-bootstrap-run-authority-v1.js";

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

function failuresFor(result: any, rawOutput: string): string[] {
  if (Array.isArray(result?.failures)) {
    return result.failures.map((item: unknown) => String(item).replace(/\n/g, " "));
  }
  if (result && typeof result === "object") return [];
  return [rawOutput.slice(0, 3000).replace(/\n/g, " ")].filter(Boolean);
}

export function classifyQaSystemSmokeResult(result: any, rawOutput: string, commandFailed: boolean): {
  result: any;
  status: "done" | "retry" | "skip";
  issueCount: number;
  routesTested: number;
  screensTested: number;
  interactionsTested: number;
} {
  const hasStructuredResult = !!result && typeof result === "object";
  const smokeStatus = hasStructuredResult && result?.status ? String(result.status).toLowerCase() : "";
  const baseFailures = Array.isArray(result?.failures)
    ? result.failures.map((item: unknown) => String(item).replace(/\n/g, " "))
    : [];
  const routesTested = Math.max(
    1,
    numericField(result, "routesDiscovered"),
    countArrayField(result, "routes"),
    countArrayField(result, "hashRoutes"),
  );
  const screensTested = Math.max(routesTested, numericField(result, "screensDiscovered"));
  const interactionsTested =
    numericField(result, "buttonsChecked") +
    numericField(result, "formsChecked") +
    numericField(result, "flowsChecked");
  const syntheticFailures: string[] = [];

  if (!hasStructuredResult) {
    syntheticFailures.push(`QA system smoke did not return structured JSON. ${rawOutput.slice(0, 1000).replace(/\n/g, " ")}`);
  } else if (smokeStatus !== "skip" && interactionsTested <= 0) {
    syntheticFailures.push("QA system smoke produced no interaction evidence; browser QA cannot complete without at least one tested click, control, form, or flow.");
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
  const issueCount = status === "retry" ? Math.max(failures.length, 1) : failures.length;

  return {
    result: enrichedResult,
    status,
    issueCount,
    routesTested,
    screensTested,
    interactionsTested,
  };
}

function buildQaArtifacts(
  repo: string,
  result: any,
  rawOutput: string,
  status: string,
  runtime: RuntimeAllocation,
  recoveryScreenshots?: readonly ("smoke-home.png" | "smoke-after-click.png")[],
): {
  markdownPath: "quality-reports/qa-test-1.md";
  jsonPath: "quality-reports/qa-test-1.json";
  markdownBytes: Buffer;
  jsonBytes: Buffer;
} {
  const failures = failuresFor(result, rawOutput);
  const routesTested = Math.max(
    1,
    numericField(result, "routesDiscovered"),
    countArrayField(result, "routes"),
    countArrayField(result, "hashRoutes"),
  );
  const screensTested = Math.max(routesTested, numericField(result, "screensDiscovered"));
  const interactionsTested =
    numericField(result, "buttonsChecked") +
    numericField(result, "formsChecked") +
    numericField(result, "flowsChecked");
  const issueCount = status === "retry" ? Math.max(failures.length, 1) : failures.length;
  const screenshots: string[] = recoveryScreenshots === undefined
    ? [
        fs.existsSync(path.join(repo, "smoke-home.png")) ? "smoke-home.png" : "",
        fs.existsSync(path.join(repo, "smoke-after-click.png")) ? "smoke-after-click.png" : "",
      ].filter(Boolean)
    : [...recoveryScreenshots];
  if (recoveryScreenshots === undefined && screenshots.length === 0) screenshots.push("smoke-home.png");

  const json = {
    schema: "setfarm.qa-report.v1",
    status,
    generatedAt: new Date().toISOString(),
    runtime,
    summary: {
      smokeStatus: String(result?.status || status),
      confidence: result?.confidence ?? null,
      routesTested,
      screensTested,
      interactionsTested,
      totalIssues: issueCount,
    },
    screenshots,
    failures,
    raw: result && typeof result === "object" ? result : { output: rawOutput.slice(0, 4000) },
  };
  const jsonBytes = Buffer.from(JSON.stringify(json, null, 2) + "\n", "utf8");

  const lines = [
    "# QA Test Report",
    "",
    `Status: ${status.toUpperCase()}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    `- Smoke status: ${String(result?.status || status)}`,
    `- Confidence: ${String(result?.confidence ?? "unknown")}`,
    `- Routes tested: ${String(routesTested)}`,
    `- Screens tested: ${String(screensTested)}`,
    `- Interactions tested: ${String(interactionsTested)}`,
    `- Total issues: ${String(issueCount)}`,
    "",
    "## Environment",
    `- URL: ${runtime.url}`,
    `- Host: ${runtime.host}`,
    `- Port: ${runtime.port}`,
    `- Port band: ${runtime.band}`,
    "",
    "## Routes Tested",
    `- /: ${status === "done" ? "loaded" : "attempted"}`,
    `- Routes discovered: ${String(result?.routesDiscovered ?? 0)}`,
    `- Hash routes discovered: ${String(result?.hashRoutesDiscovered ?? 0)}`,
    "",
    "## Interactions Tested",
    `- Buttons checked: ${String(result?.buttonsChecked ?? 0)}`,
    `- Forms checked: ${String(result?.formsChecked ?? 0)}`,
    `- Flows checked: ${String(result?.flowsChecked ?? 0)}`,
    "",
    "## Screenshots",
    ...screenshots.map((screenshot) => `- ${screenshot}`),
    "",
    "## Console",
    `- Console errors: ${String(result?.consoleErrors ?? 0)}`,
    "",
    "## Visual/Layout Findings",
    ...(status === "done" ? ["- None."] : failures.slice(0, 20).map((failure) => `- ${failure}`)),
    "",
    "## Functional Findings",
    `- Flow issues: ${String(result?.flowIssues ?? 0)}`,
    ...(failures.length > 0 ? failures.slice(0, 20).map((failure) => `- ${failure}`) : ["- None."]),
    "",
    "## Semantic/Test Findings",
    `- Semantic click issues: ${String(result?.semanticClickIssues ?? 0)}`,
    `- Weak interaction assertions: ${String(result?.weakInteractionAssertions ?? 0)}`,
    ...(status === "done" ? ["- None."] : failures.slice(0, 20).map((failure) => `- ${failure}`)),
    "",
    "## Batch Fix Plan",
    ...(status === "done"
      ? ["- None."]
      : ["- Route the batched failures to the owning phase; do not retry with ad-hoc browser setup.", ...failures.slice(0, 10).map((failure) => `- Fix: ${failure}`)]),
  ];
  return {
    markdownPath: "quality-reports/qa-test-1.md",
    jsonPath: "quality-reports/qa-test-1.json",
    markdownBytes: Buffer.from(lines.join("\n") + "\n", "utf8"),
    jsonBytes,
  };
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
  const recoveryRun = isInternalProductionRecoverySourceBootstrapRunContextV1(ctx.context);
  let publishRecoveryArtifact: typeof import("../../../execution/recovery-source-bootstrap-runtime-authority-v1.js").publishActiveInternalProductionRecoverySourceBootstrapArtifactV1 | undefined;
  let decodeRecoveryScreenshotFrames: typeof import("../../../execution/recovery-source-bootstrap-runtime-authority-v1.js").decodeInternalProductionRecoverySourceBootstrapScreenshotFramesV1 | undefined;
  let createRecoverySmokeEnvironment: typeof import("../../../execution/recovery-source-bootstrap-runtime-authority-v1.js").createInternalProductionRecoverySourceBootstrapSmokeEnvironmentV1 | undefined;
  let recoverySmokeEnvironment: NodeJS.ProcessEnv | undefined;
  if (recoveryRun) {
    const recoveryAuthority = await import(
      "../../../execution/recovery-source-bootstrap-runtime-authority-v1.js"
    );
    publishRecoveryArtifact = recoveryAuthority.publishActiveInternalProductionRecoverySourceBootstrapArtifactV1;
    decodeRecoveryScreenshotFrames = recoveryAuthority.decodeInternalProductionRecoverySourceBootstrapScreenshotFramesV1;
    createRecoverySmokeEnvironment = recoveryAuthority.createInternalProductionRecoverySourceBootstrapSmokeEnvironmentV1;
    await recoveryAuthority.syncActiveInternalProductionRecoverySourceBootstrapRunBranchV1({
      runId: ctx.runId,
      context: ctx.context,
    });
  }
  const repo = (ctx.context["repo"] || ctx.context["REPO"] || "").replace(/^~/, os.homedir());
  const publishArtifact = async (
    relativePath: ".setfarm/run-runtime.json" | "quality-reports/qa-test-1.md" | "quality-reports/qa-test-1.json" | "smoke-home.png" | "smoke-after-click.png",
    bytes: Buffer,
  ): Promise<void> => {
    if (recoveryRun) {
      if (publishRecoveryArtifact === undefined) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_PUBLISHER_UNAVAILABLE");
      await publishRecoveryArtifact({ runId: ctx.runId, context: ctx.context, relativePath, bytes });
      return;
    }
    const target = path.join(repo, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  };
  const publishQaArtifacts = async (
    result: any,
    rawOutput: string,
    status: string,
    runtime: RuntimeAllocation,
    recoveryScreenshots?: readonly ("smoke-home.png" | "smoke-after-click.png")[],
  ): Promise<ReturnType<typeof buildQaArtifacts>> => {
    const artifacts = buildQaArtifacts(repo, result, rawOutput, status, runtime, recoveryScreenshots);
    await publishArtifact(artifacts.jsonPath, artifacts.jsonBytes);
    await publishArtifact(artifacts.markdownPath, artifacts.markdownBytes);
    return artifacts;
  };
  const publishRecoveryScreenshots = async (frames: Buffer): Promise<readonly ("smoke-home.png" | "smoke-after-click.png")[]> => {
    if (!recoveryRun) return [];
    if (decodeRecoveryScreenshotFrames === undefined) {
      throw new Error("RECOVERY_SOURCE_BOOTSTRAP_SCREENSHOT_DECODER_UNAVAILABLE");
    }
    const decoded = decodeRecoveryScreenshotFrames(frames);
    for (const frame of decoded) {
      await publishArtifact(frame.relativePath, frame.bytes);
    }
    return decoded.map((frame) => frame.relativePath);
  };
  const stackContract = resolveOperationalStackContract(ctx.context, false);
  const stackPlan = stackExecutionPlanForStep(ctx.stepId, stackContract);
  await recordStackEvidencePlanObservation({
    run_id: ctx.runId,
    step_id: ctx.stepId,
    agent_id: "qa-tester",
  }, ctx.context, "running", "QA preclaim resolved stack evidence contract.");

  if (stackPlan.systemSmokeRunner !== "setfarm-smoke-test") {
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "qa-tester",
      checkId: "qa-stack-preclaim",
      label: "QA stack preclaim",
      status: "info",
      summary: "Browser smoke preclaim skipped for non-browser stack",
      detail: stackPlan.reason,
      metadata: { ...stackEvidenceMetadata(stackContract), stackPlan },
    });
    return;
  }

  if (!repo || !fs.existsSync(repo)) {
    logger.warn(`[module:qa preclaim] skipped - repo missing: ${repo || "(empty)"}`, { runId: ctx.runId });
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "qa-tester",
      checkId: "qa-repo-preclaim",
      label: "QA repo preclaim",
      status: "pending",
      summary: "QA preclaim waiting for repository",
      detail: repo || "repo missing",
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
  const runtimeArtifact = createRunRuntimeArtifactV1({
    runId: ctx.runId,
    runNumber: runRow?.run_number ?? null,
    stepId: ctx.stepId,
    runtime,
    status: "allocated",
  });
  if (recoveryRun) await publishArtifact(runtimeArtifact.relativePath, runtimeArtifact.bytes);
  else writeRunRuntimeArtifact({
    repo,
    runId: ctx.runId,
    runNumber: runRow?.run_number ?? null,
    stepId: ctx.stepId,
    runtime,
    status: "allocated",
  });
  ctx.context["run_runtime_json"] = runtimeArtifact.relativePath;

  await recordGateObservation({
    runId: ctx.runId,
    stepId: ctx.stepId,
    agentId: "qa-tester",
    checkId: "runtime-port-allocation",
    label: "Runtime port allocation",
    status: "pass",
    summary: `Allocated ${runtime.band} port ${runtime.port}`,
    detail: runtime.url,
    metadata: { runtime, artifactPath: runtimeArtifact.relativePath, ...stackEvidenceMetadata(stackContract) },
  });

  for (const tool of stackContract.toolPreflight || []) {
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "qa-tester",
      checkId: `tool-preflight:${tool.tool}`,
      label: `${tool.tool} preflight`,
      status: "running",
      summary: `Running ${tool.command}`,
      metadata: { tool, ...stackEvidenceMetadata(stackContract) },
    });
    const result = runPreflight(tool.command, repo, tool.timeoutMs);
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "qa-tester",
      checkId: `tool-preflight:${tool.tool}`,
      label: `${tool.tool} preflight`,
      status: result.ok ? "pass" : (tool.required ? "blocked" : "info"),
      summary: result.ok ? `${tool.tool} available` : `${tool.tool} unavailable`,
      detail: result.output,
      metadata: { tool, failureCategory: tool.failureCategory, ...stackEvidenceMetadata(stackContract) },
    });
    if (!result.ok && tool.required) {
      const artifacts = await publishQaArtifacts({ status: "fail", failures: [`${tool.tool} preflight failed: ${result.output}`] }, result.output, "retry", runtime);
      const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
      if (!step?.id) throw new Error(`qa preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
      const { completeStep } = await import("../../step-ops.js");
      await completeStep(step.id, [
        "STATUS: retry",
        `QA_REPORT: ${artifacts.markdownPath}`,
        `QA_JSON: ${artifacts.jsonPath}`,
        "QA_SCREENS_TESTED: 1",
        "QA_ROUTES_TESTED: 1",
        "QA_INTERACTIONS_TESTED: 0",
        "QA_TOTAL_ISSUES: 1",
        "FAILURE_CATEGORY: tooling_contract_missing",
        "TEST_FAILURES:",
        `- ${tool.tool} preflight failed before browser QA. ${result.output.replace(/\n/g, " ")}`,
      ].join("\n"), ctx.claimEnvelope);
      return;
    }
  }

  const smokeScript = resolvePlatformScript("smoke-test.mjs");
  if (!fs.existsSync(smokeScript)) {
    logger.warn("[module:qa preclaim] skipped - smoke-test.mjs missing", { runId: ctx.runId });
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "qa-tester",
      checkId: "qa-smoke-script",
      label: "QA smoke script",
      status: "pending",
      summary: "Browser smoke preclaim unavailable",
      detail: "smoke-test.mjs missing",
      metadata: stackEvidenceMetadata(stackContract),
    });
    return;
  }

  if (!recoveryRun) {
    try {
      execFileSync("git", ["checkout", "main"], { cwd: repo, timeout: 10_000, stdio: ["pipe", "pipe", "pipe"] });
      execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: repo, timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });
    } catch (syncErr) {
      logger.warn(`[module:qa preclaim] main sync warning: ${formatFailure(syncErr).slice(0, 300)}`, { runId: ctx.runId });
    }
  }

  let output = "";
  let failed = false;
  let recoveryScreenshotFrames = Buffer.alloc(0);
  let recoverySmokeStdout = "";
  const smokeArguments = [smokeScript, repo, "--port", String(runtime.port)];
  const smokeOptions = {
    cwd: repo,
    timeout: stackContract.runtime?.timeoutMs || 240_000,
  };
  const smokeEnvironment = (): NodeJS.ProcessEnv => ({
      ...(recoveryRun
        ? (recoverySmokeEnvironment ??= createRecoverySmokeEnvironment?.(process.env))
        : process.env),
      DEV_SERVER_PORT: String(runtime.port),
      PREVIEW_PORT: String(runtime.port),
      PORT: String(runtime.port),
      DEV_SERVER_URL: runtime.url,
      QA_URL: runtime.url,
  });
  const runSmoke = (): string => {
    if (!recoveryRun) {
      return execFileSync("node", smokeArguments, {
        ...smokeOptions,
        env: smokeEnvironment(),
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
    const result = spawnSync(process.execPath, [...smokeArguments, "--recovery-byte-screenshots"], {
      ...smokeOptions,
      env: smokeEnvironment(),
      encoding: null,
      maxBuffer: 96 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe", "pipe"],
    });
    recoveryScreenshotFrames = Buffer.isBuffer(result.output?.[3]) ? result.output[3] : Buffer.alloc(0);
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : String(result.stdout || "");
    recoverySmokeStdout = stdout;
    if (result.error || result.status !== 0) {
      const error = result.error ?? new Error("RECOVERY_SMOKE_PROCESS_FAILED");
      Object.assign(error, { stdout: result.stdout, stderr: result.stderr, status: result.status, signal: result.signal });
      throw error;
    }
    return stdout;
  };
  try {
    const buildFresh = ensureSmokeBuildFresh(repo, {
      runId: ctx.runId,
      stepId: ctx.stepId,
      buildCommand: stackContract.setup?.build,
      timeoutMs: stackContract.runtime?.timeoutMs || 240_000,
      logPrefix: "qa-smoke-prebuild",
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
    logger.info(`[module:qa preclaim] Running system smoke gate in ${repo}`, { runId: ctx.runId });
    await recordGateObservation({
      runId: ctx.runId,
      stepId: ctx.stepId,
      agentId: "qa-tester",
      checkId: "qa-system-smoke",
      label: "QA system smoke",
      status: "running",
      summary: "Running browser QA smoke gate",
      detail: repo,
      metadata: stackEvidenceMetadata(stackContract),
    });
    output = runSmoke();
  } catch (err) {
    failed = true;
    output = output || recoverySmokeStdout || formatFailure(err);
    if (isMissingPlaywrightBrowserFailure(output)) {
      await recordGateObservation({
        runId: ctx.runId,
        stepId: ctx.stepId,
        agentId: "qa-tester",
        checkId: "qa-playwright-browser-install",
        label: "QA Playwright browser install",
        status: "running",
        summary: "Installing missing Playwright Chromium browser",
        detail: output.slice(0, 1200),
        metadata: stackEvidenceMetadata(stackContract),
      });
      const install = ensurePlaywrightChromiumInstalled(stackContract.runtime?.timeoutMs || 240_000);
      await recordGateObservation({
        runId: ctx.runId,
        stepId: ctx.stepId,
        agentId: "qa-tester",
        checkId: "qa-playwright-browser-install",
        label: "QA Playwright browser install",
        status: install.ok ? "pass" : "blocked",
        summary: install.ok ? "Installed missing Playwright Chromium browser" : "Playwright Chromium install failed",
        detail: install.output,
        metadata: stackEvidenceMetadata(stackContract),
      });
      if (install.ok) {
        try {
          output = runSmoke();
          failed = false;
        } catch (retryErr) {
          output = recoverySmokeStdout || formatFailure(retryErr);
        }
      }
    }
  }

  const parsed = firstJsonObject(output);
  const evidenceOutput = output;
  const currentRecoveryScreenshots = recoveryRun
    ? (recoveryScreenshotFrames.length > 0 ? await publishRecoveryScreenshots(recoveryScreenshotFrames) : [])
    : undefined;
  const decision = classifyQaSystemSmokeResult(parsed, evidenceOutput, failed);
  const status = decision.status;
  const issueCount = decision.issueCount;
  const reportArtifacts = await publishQaArtifacts(decision.result, evidenceOutput, status, runtime, currentRecoveryScreenshots);
  await recordGateObservation({
    runId: ctx.runId,
    stepId: ctx.stepId,
    agentId: "qa-tester",
    checkId: "qa-system-smoke",
    label: "QA system smoke",
    status: status === "retry" ? "retry" : status === "skip" ? "info" : "pass",
    summary: `QA smoke ${status}`,
    detail: evidenceOutput.slice(0, 2000),
    metadata: { reportPath: reportArtifacts.markdownPath, jsonPath: reportArtifacts.jsonPath, runtime, ...stackEvidenceMetadata(stackContract) },
  });
  const lines = [
    `STATUS: ${status}`,
    `QA_REPORT: ${reportArtifacts.markdownPath}`,
    `QA_JSON: ${reportArtifacts.jsonPath}`,
    `QA_SCREENS_TESTED: ${decision.screensTested}`,
    `QA_ROUTES_TESTED: ${decision.routesTested}`,
    `QA_INTERACTIONS_TESTED: ${decision.interactionsTested}`,
    `QA_TOTAL_ISSUES: ${issueCount}`,
    "QA_GATE: system-smoke-preclaim",
    ...summarizeSmoke(decision.result),
  ];
  if (status === "skip") {
    lines.push(`SKIP_REASON: ${String(decision.result?.reason || "Smoke gate reported skip for this repository.")}`);
  }
  if (status === "retry" && failuresFor(decision.result, evidenceOutput).length === 0) {
    const failures = failuresFor(decision.result, evidenceOutput);
    lines.push("TEST_FAILURES:");
    for (const failure of (failures.length > 0 ? failures : [evidenceOutput.slice(0, 2000).replace(/\n/g, " ")]).slice(0, 20)) {
      lines.push(`- ${failure}`);
    }
  }

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) {
    throw new Error(`qa preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
  }

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, lines.join("\n"), ctx.claimEnvelope);
  logger.info(`[module:qa preclaim] AUTO-COMPLETED qa-test via system smoke (${status})`, { runId: ctx.runId, stepId: ctx.stepId });
}
