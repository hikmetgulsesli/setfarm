import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import type { ClaimContext, PreClaimResult } from "../types.js";
import { logger } from "../../../lib/logger.js";
import { getSql, now, pgGet, pgRun } from "../../../db-pg.js";
import { emitEvent } from "../../events.js";
import { resolvePlatformScript } from "../../paths.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../../product-compiler/canonical-json.js";
import { parseStitchDirectResponseEvidence } from "../../../product-compiler/compatibility/stitch-direct-response-evidence.js";
import { isValidStitchHtmlFile } from "../../../product-compiler/stitch-render-artifact.js";
import {
  produceDesignGenerationTargetsV1,
} from "../../../product-compiler/producers/design-targets.js";
import { decodeStitchDirectBatchV2 } from "../../../product-compiler/producers/stitch-direct-response.js";
import {
  captureStitchRenderedSemanticsV1,
  StitchRenderedSemanticsInfrastructureError,
  verifyStitchRenderedSemanticsReplayV1,
  writeStitchRenderedSemanticsV1,
} from "../../../product-compiler/producers/stitch-rendered-semantics.js";
import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1,
  type StitchCandidateArtifactBytesV1,
} from "../../../product-compiler/producers/stitch-target-candidate-selection.js";
import {
  DesignGenerationTargetsV1Schema,
  type DesignGenerationTargetsV1,
} from "../../../product-compiler/schemas/design-generation-targets-v1.js";
import {
  ProductSpecV1EnglishWriteSchema,
  type ProductSpecV1,
} from "../../../product-compiler/schemas/product-spec-v1.js";
import type { StitchDirectResponseEvidenceV1 } from "../../../product-compiler/schemas/stitch-direct-response-evidence-v1.js";
import {
  StitchDirectResponseEvidenceV2Schema,
  type StitchDirectBatchEvidenceV2,
  type StitchDirectResponseEvidenceV2,
} from "../../../product-compiler/schemas/stitch-direct-response-evidence-v2.js";
import {
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
  type StitchBatchResponseV2,
  type StitchTargetCandidateSelectionV1,
  type StitchTargetResponseBindingsV2,
} from "../../../product-compiler/schemas/stitch-target-candidate-selection-v1.js";
import { executeDesignPreclaimV2 } from "./runtime-v2.js";
import {
  inspectCompilerEnglishAdmissionLedgerAuthorityV1,
  loadCompilerEnglishAdmissionLedgerAuthorityV1,
  type CompilerEnglishAdmissionLedgerAuthorityV1,
} from "../../../execution/compiler-english-admission-ledger-v1.js";
import type { CompilerEnglishAdmissionReceiptV1 } from "../../../product-compiler/schemas/compiler-english-admission-receipt-v1.js";
import type { OperationalFailureCauseV1 } from "../../../execution/schemas/operational-failure-cause-v1.js";

const PRECLAIM_CANCELLED = "DESIGN_PRECLAIM_CANCELLED";
const progressDedupe = new Map<string, { detail: string; emittedAt: number }>();
type StitchDirectResponseEvidence = StitchDirectResponseEvidenceV1 | StitchDirectResponseEvidenceV2;

type ExecFileTextOptions = {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
  onProgress?: () => boolean | void | Promise<boolean | void>;
  progressIntervalMs?: number;
};

function isPreclaimCancelledError(error: unknown): boolean {
  return String((error as any)?.message || error).includes(PRECLAIM_CANCELLED);
}

function redactDiagnosticText(text: unknown): string {
  return String(text || "")
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "AQ.[REDACTED]")
    .replace(/(api[_-]?key|token|authorization|bearer)\s*[:=]\s*["']?[^"'\s,}]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();
}

function isStitchProviderUnavailable(text: unknown): boolean {
  const normalized = redactDiagnosticText(text).toLowerCase();
  return (
    /\bservice is currently unavailable\b/.test(normalized) ||
    /\bservice unavailable\b/.test(normalized) ||
    /\btemporarily unavailable\b/.test(normalized) ||
    /\bprovider unavailable\b/.test(normalized) ||
    /\bstitch provider unavailable\b/.test(normalized) ||
    /\bdeadline exceeded\b/.test(normalized) ||
    /\bresource exhausted\b/.test(normalized) ||
    /\brate limit(?:ed)?\b/.test(normalized) ||
    /\bquota\b/.test(normalized) ||
    /\b503\b/.test(normalized)
  );
}

export type DesignFailureOwner =
  | "stitch_api"
  | "network_or_stitch_api"
  | "setfarm_configuration"
  | "setfarm_local_system"
  | "prompt_or_design_contract"
  | "stitch_empty_project"
  | "unknown";

export type DesignFailureCategory =
  | "authentication"
  | "quota_or_rate_limit"
  | "provider_unavailable"
  | "timeout"
  | "network_fetch"
  | "empty_project"
  | "configuration"
  | "local_filesystem"
  | "provider_response"
  | "response_contract"
  | "surface_mismatch"
  | "unknown";

export type DesignFailureClassification = {
  category: DesignFailureCategory;
  owner: DesignFailureOwner;
  retryable: boolean;
  apiRelated: boolean;
  setfarmBugLikely: boolean;
  promptRelated: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type V3DesignBoundaryCode =
  | "DESIGN_V3_DIRECT_BATCH_INCOMPLETE"
  | "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID"
  | "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH"
  | "DESIGN_V3_EXACT_RESPONSE_BINDING_REJECTED"
  | "DESIGN_V3_RENDERABLE_SCREEN_MISSING"
  | "DESIGN_V3_RENDERED_SEMANTICS_INFRASTRUCTURE_UNAVAILABLE"
  | "DESIGN_V3_RESPONSE_HTML_MISSING"
  | "DESIGN_V3_RESPONSE_SOURCE_INVALID";

export function classifyV3DesignBoundary(code: V3DesignBoundaryCode): DesignFailureClassification {
  switch (code) {
    case "DESIGN_V3_RENDERED_SEMANTICS_INFRASTRUCTURE_UNAVAILABLE":
      return {
        category: "local_filesystem",
        owner: "setfarm_local_system",
        retryable: false,
        apiRelated: false,
        setfarmBugLikely: true,
        promptRelated: false,
        confidence: "high",
        reason: "The exact locked browser renderer or its sealed replay boundary is unavailable; model retry is forbidden.",
      };
    case "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID":
    case "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH":
      return {
        category: "response_contract",
        owner: "setfarm_local_system",
        retryable: false,
        apiRelated: false,
        setfarmBugLikely: true,
        promptRelated: false,
        confidence: "high",
        reason: "The typed Stitch transport evidence and reported direct screen set disagree.",
      };
    case "DESIGN_V3_RESPONSE_SOURCE_INVALID":
    case "DESIGN_V3_RENDERABLE_SCREEN_MISSING":
      return {
        category: "provider_response",
        owner: "stitch_api",
        retryable: false,
        apiRelated: true,
        setfarmBugLikely: false,
        promptRelated: false,
        confidence: "high",
        reason: "The direct generation response did not carry admissible product-screen identity; fallback discovery is not authoritative.",
      };
    case "DESIGN_V3_EXACT_RESPONSE_BINDING_REJECTED":
      return {
        category: "surface_mismatch",
        owner: "prompt_or_design_contract",
        retryable: false,
        apiRelated: false,
        setfarmBugLikely: false,
        promptRelated: true,
        confidence: "high",
        reason: "Renderable Stitch screens did not exactly satisfy the immutable generation target set.",
      };
    case "DESIGN_V3_RESPONSE_HTML_MISSING":
      return {
        category: "network_fetch",
        owner: "network_or_stitch_api",
        retryable: false,
        apiRelated: true,
        setfarmBugLikely: false,
        promptRelated: false,
        confidence: "high",
        reason: "A direct candidate lacked valid attempt-bound downloaded HTML or screenshot evidence after bounded fetch recovery.",
      };
    case "DESIGN_V3_DIRECT_BATCH_INCOMPLETE":
      return {
        category: "response_contract",
        owner: "setfarm_local_system",
        retryable: false,
        apiRelated: false,
        setfarmBugLikely: true,
        promptRelated: false,
        confidence: "medium",
        reason: "The v3 direct batch stopped without a more specific typed boundary code.",
      };
  }
}

class V3DesignBoundaryError extends Error {
  readonly code: V3DesignBoundaryCode;
  readonly classification: DesignFailureClassification;

  constructor(code: V3DesignBoundaryCode, diagnostic: string) {
    super(String(diagnostic || code).includes(code) ? String(diagnostic || code) : `${code}: ${diagnostic}`);
    this.name = "V3DesignBoundaryError";
    this.code = code;
    this.classification = classifyV3DesignBoundary(code);
  }
}

function candidateSelectionBoundaryCode(
  result: ReturnType<typeof selectStitchTargetCandidatesV1>,
): V3DesignBoundaryCode {
  if (!result.candidateSelection) return "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH";
  let allUnresolvedTargetsAreLocalArtifactFailures = true;
  for (const selection of result.candidateSelection.selections.filter((item) => item.status === "unresolved")) {
    const exactTitle = selection.evaluations.filter((evaluation) =>
      evaluation.semanticChecks.some((check) => check.kind === "screen_title" && check.disposition === "exact"));
    const conflictFree = exactTitle.filter((evaluation) =>
      !evaluation.rejectionCodes.includes("CANDIDATE_RESPONSE_IDENTITY_CONFLICT"));
    if (exactTitle.length > 0 && conflictFree.length === 0) {
      return "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISMATCH";
    }
    const candidatesToExplain = conflictFree.length > 0 ? conflictFree : exactTitle;
    const localOnly = candidatesToExplain.length > 0 && candidatesToExplain.every((evaluation) =>
      evaluation.rejectionCodes.length > 0
      && evaluation.rejectionCodes.every((code) =>
        code.startsWith("CANDIDATE_LOCAL_")
        || code.startsWith("CANDIDATE_DOWNLOAD_RECEIPT_")
        || code === "CANDIDATE_RENDER_EVIDENCE_INCOMPLETE"));
    if (!localOnly) allUnresolvedTargetsAreLocalArtifactFailures = false;
  }
  if (allUnresolvedTargetsAreLocalArtifactFailures) {
    return "DESIGN_V3_RESPONSE_HTML_MISSING";
  }
  return "DESIGN_V3_EXACT_RESPONSE_BINDING_REJECTED";
}

type DesignFailureReport = {
  schemaVersion: 1;
  runId: string;
  stepId: string;
  occurredAt: string;
  projectId: string;
  activeProjectId?: string;
  phase: string;
  operation: string;
  attempt?: number;
  maxAttempts?: number;
  stageIndex?: number;
  stageCount?: number;
  surfaceIds?: string[];
  diagnostic: string;
  failureCode?: string;
  classification: DesignFailureClassification;
  fingerprint: string;
  htmlCount?: number;
  screensGenerated?: number;
  reportPath?: string;
};

export function classifyDesignFailure(diagnostic: unknown, phase = ""): DesignFailureClassification {
  const text = redactDiagnosticText(diagnostic);
  const normalized = text.toLowerCase();
  const phaseText = phase.toLowerCase();

  if (/\b(?:401|403|unauthorized|permission denied|forbidden|invalid api key|api key rejected|auth(?:entication)? failed)\b/.test(normalized)) {
    return {
      category: "authentication",
      owner: "setfarm_configuration",
      retryable: false,
      apiRelated: true,
      setfarmBugLikely: false,
      promptRelated: false,
      confidence: "high",
      reason: "The Stitch request reached an authenticated API boundary but credentials or permissions were rejected.",
    };
  }

  if (/\b(?:429|quota|rate limit(?:ed)?|resource exhausted)\b/.test(normalized)) {
    return {
      category: "quota_or_rate_limit",
      owner: "stitch_api",
      retryable: true,
      apiRelated: true,
      setfarmBugLikely: false,
      promptRelated: false,
      confidence: "high",
      reason: "The Stitch/Gemini provider reported quota, rate-limit, or resource exhaustion.",
    };
  }

  if (/\b(?:503|service is currently unavailable|service unavailable|temporarily unavailable|provider unavailable|stitch provider unavailable)\b/.test(normalized)) {
    return {
      category: "provider_unavailable",
      owner: "stitch_api",
      retryable: true,
      apiRelated: true,
      setfarmBugLikely: false,
      promptRelated: false,
      confidence: "high",
      reason: "The provider reported a temporary unavailable state.",
    };
  }

  if (/\b(?:504|deadline exceeded|timed? ?out|timeout|operation was aborted|aborted due to timeout)\b/.test(normalized)) {
    return {
      category: "timeout",
      owner: "network_or_stitch_api",
      retryable: true,
      apiRelated: true,
      setfarmBugLikely: false,
      promptRelated: false,
      confidence: "high",
      reason: "The generation or download operation exceeded its timeout/deadline.",
    };
  }

  if (/\b(?:fetch failed|econnreset|enotfound|eai_again|socket hang up|network error|tls|connection refused)\b/.test(normalized)) {
    return {
      category: "network_fetch",
      owner: "network_or_stitch_api",
      retryable: true,
      apiRelated: true,
      setfarmBugLikely: false,
      promptRelated: false,
      confidence: "medium",
      reason: "The low-level fetch/network call failed before Setfarm received a structured Stitch result.",
    };
  }

  if (/\b(?:no screens found|0 valid html|0 html|0 screens|produced 0 valid html|generated 0 screens)\b/.test(normalized)) {
    return {
      category: "empty_project",
      owner: "stitch_empty_project",
      retryable: true,
      apiRelated: true,
      setfarmBugLikely: false,
      promptRelated: false,
      confidence: phaseText.includes("download") ? "high" : "medium",
      reason: "Stitch project exists but the API returned no downloadable screens for that project.",
    };
  }

  if (/\b(?:design_surface_mismatch|missing required product surfaces|unexpected screens|out of scope)\b/.test(normalized)) {
    return {
      category: "surface_mismatch",
      owner: "prompt_or_design_contract",
      retryable: true,
      apiRelated: false,
      setfarmBugLikely: false,
      promptRelated: true,
      confidence: "high",
      reason: "Generated screens did not satisfy the Product Surface contract.",
    };
  }

  if (/\b(?:enoent|eacces|eperm|no such file|permission denied|read-only file system|write failed)\b/.test(normalized)) {
    return {
      category: "local_filesystem",
      owner: "setfarm_local_system",
      retryable: false,
      apiRelated: false,
      setfarmBugLikely: true,
      promptRelated: false,
      confidence: "high",
      reason: "Local filesystem or process execution failed before/after the provider call.",
    };
  }

  if (/\b(?:stitch_api_key_required|missing stitch_api_key|no stitch api key)\b/.test(normalized)) {
    return {
      category: "configuration",
      owner: "setfarm_configuration",
      retryable: false,
      apiRelated: false,
      setfarmBugLikely: false,
      promptRelated: false,
      confidence: "high",
      reason: "Design generation cannot start because the Stitch API key is missing from Setfarm configuration.",
    };
  }

  return {
    category: "unknown",
    owner: "unknown",
    retryable: true,
    apiRelated: false,
    setfarmBugLikely: false,
    promptRelated: false,
    confidence: "low",
    reason: "The diagnostic did not match a known Stitch/Setfarm failure signature.",
  };
}

function designFailureFingerprint(report: Omit<DesignFailureReport, "fingerprint" | "reportPath">): string {
  return crypto
    .createHash("sha256")
    .update([
      report.phase,
      report.operation,
      report.projectId,
      report.classification.category,
      report.failureCode || "",
      report.diagnostic.slice(0, 500),
      String(report.stageIndex || ""),
      (report.surfaceIds || []).join(","),
    ].join("\n"))
    .digest("hex")
    .slice(0, 16);
}

function writeDesignFailureReport(
  ctx: ClaimContext,
  repo: string,
  input: Omit<DesignFailureReport, "schemaVersion" | "runId" | "stepId" | "occurredAt" | "classification" | "fingerprint" | "reportPath"> & {
    classification?: DesignFailureClassification;
  },
): DesignFailureReport | null {
  if (!repo) return null;
  const diagnostic = redactDiagnosticText(input.diagnostic).slice(0, 2000);
  const classification = input.classification || classifyDesignFailure(diagnostic, input.phase);
  const baseReport = {
    schemaVersion: 1 as const,
    runId: ctx.runId,
    stepId: ctx.stepId,
    occurredAt: new Date().toISOString(),
    ...input,
    diagnostic,
    classification,
  };
  const report: DesignFailureReport = {
    ...baseReport,
    fingerprint: designFailureFingerprint(baseReport),
  };

  try {
    const dir = path.join(repo, ".setfarm");
    fs.mkdirSync(dir, { recursive: true });
    const latestPath = path.join(dir, "DESIGN_FAILURE.latest.json");
    const jsonlPath = path.join(dir, "design-failures.jsonl");
    report.reportPath = latestPath;
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
    fs.appendFileSync(jsonlPath, JSON.stringify(report) + "\n");
    ctx.context["design_failure_report_path"] = latestPath;
    ctx.context["design_failure_category"] = classification.category;
    ctx.context["design_failure_owner"] = classification.owner;
    ctx.context["design_failure_summary"] = `${classification.category}/${classification.owner}: ${classification.reason}`;
  } catch (e) {
    logger.warn(`[module:design preclaim] failed to write DESIGN_FAILURE report: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
  }

  return report;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function boundedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] || fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

function execFileText(command: string, args: string[], options: ExecFileTextOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { onProgress, progressIntervalMs = 30000, ...execOptions } = options;
    let child: ReturnType<typeof execFile> | null = null;
    let cancelled = false;
    let killTimer: NodeJS.Timeout | null = null;
    const cancelChild = () => {
      if (cancelled) return;
      cancelled = true;
      try { child?.kill("SIGTERM"); } catch {}
      killTimer = setTimeout(() => {
        try { child?.kill("SIGKILL"); } catch {}
      }, 5000);
    };
    const progressTimer = onProgress
      ? setInterval(() => {
          Promise.resolve(onProgress())
            .then((keepGoing) => { if (keepGoing === false) cancelChild(); })
            .catch(() => {});
        }, progressIntervalMs)
      : null;
    child = execFile(command, args, {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
      ...execOptions,
    }, (err, stdout, stderr) => {
      if (progressTimer) clearInterval(progressTimer);
      if (killTimer) clearTimeout(killTimer);
      if (cancelled) {
        reject(new Error(`${PRECLAIM_CANCELLED}: step is no longer running; child process terminated.`));
        return;
      }
      if (err) {
        const detail = String(stderr || stdout || (err as any).message || err).replace(/\s+/g, " ").slice(0, 1000);
        reject(new Error(detail));
        return;
      }
      resolve(String(stdout || ""));
    });
  });
}

async function recordPreClaimProgress(ctx: ClaimContext, detail: string): Promise<boolean> {
  const safeDetail = detail.replace(/\s+/g, " ").slice(0, 500);
  const dedupeKey = `${ctx.runId}:${ctx.stepId}`;
  const last = progressDedupe.get(dedupeKey);
  const shouldEmit = !last || last.detail !== safeDetail || Date.now() - last.emittedAt >= 120000;
  try {
    const stepUpdate = await pgRun("UPDATE steps SET updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status = 'running'", [now(), ctx.runId, ctx.stepId]);
    if (stepUpdate.changes === 0) return false;
    if (ctx.claimEnvelope) {
      await pgRun(
        "UPDATE claim_log SET diagnostic = $1 WHERE id = $2 AND outcome IS NULL",
        [safeDetail, ctx.claimEnvelope.claimId],
      );
    } else {
      await pgRun(
        `UPDATE claim_log AS cl
            SET diagnostic = $1
           FROM runs r
          WHERE r.id = cl.run_id
            AND r.protocol = 'legacy'
            AND cl.run_id = $2
            AND cl.step_id = $3
            AND cl.story_id IS NULL
            AND cl.outcome IS NULL`,
        [safeDetail, ctx.runId, ctx.stepId],
      );
    }
  } catch (e) {
    logger.debug(`[module:design preclaim] progress heartbeat failed: ${String(e).slice(0, 120)}`);
    return true;
  }
  if (shouldEmit) {
    progressDedupe.set(dedupeKey, { detail: safeDetail, emittedAt: Date.now() });
    emitEvent({ ts: now(), event: "step.progress", runId: ctx.runId, stepId: ctx.stepId, detail: safeDetail });
  }
  return true;
}

async function failDesignPreclaim(ctx: ClaimContext, error: string, options: Readonly<{
  terminal?: boolean;
  operationalFailureCause?: OperationalFailureCauseV1;
}> = {}): Promise<void> {
  const safeError = error.replace(/\s+/g, " ").slice(0, 1000);
  ctx.context["design_asset_error"] = safeError;
  ctx.context["screens_generated"] = "0";
  await recordPreClaimProgress(ctx, safeError);

  const step = await pgGet<{ id: string }>(
    "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
    [ctx.runId, ctx.stepId],
  );
  if (!step?.id) {
    throw new Error(`design preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
  }

  const v3PlatformPreclaim = ctx.claimEnvelope?.protocol === "v3";
  if (options.terminal && !v3PlatformPreclaim) {
    await pgRun("UPDATE steps SET max_retries = retry_count WHERE id = $1", [step.id]);
  }

  const { failStep } = await import("../../step-fail.js");
  await failStep(
    step.id,
    v3PlatformPreclaim
      ? `PLATFORM_PRECLAIM_TERMINAL [design]: ${safeError}`
      : safeError,
    ctx.claimEnvelope,
    v3PlatformPreclaim ? {
      singleStepMode: "terminal_platform_preclaim",
      ...(options.operationalFailureCause
        ? { operationalFailureCause: options.operationalFailureCause }
        : {}),
    } : undefined,
  );
}

function isValidStitchHtml(filePath: string): boolean {
  return isValidStitchHtmlFile(filePath);
}

function countValidStitchHtml(stitchDir: string): number {
  if (!stitchDir || !fs.existsSync(stitchDir)) return 0;
  return fs.readdirSync(stitchDir)
    .filter(f => f.endsWith(".html"))
    .filter(f => isValidStitchHtml(path.join(stitchDir, f))).length;
}

function isPrdPseudoScreen(screen: any): boolean {
  const title = String(screen?.title || screen?.name || "").trim().toLowerCase();
  const htmlFile = String(screen?.htmlFile || "").trim().toLowerCase();
  return /\b(?:prd|requirements?)\b/.test(title) || /\b(?:prd|requirements?)\b/.test(htmlFile);
}

function manifestHtmlCounts(stitchDir: string): { total: number; valid: number } {
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return { total: 0, valid: countValidStitchHtml(stitchDir) };
  try {
    const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!Array.isArray(manifestRaw)) return { total: 0, valid: countValidStitchHtml(stitchDir) };
    const manifest = manifestRaw.filter(s => !isPrdPseudoScreen(s));
    let valid = 0;
    for (const s of manifest) {
      const sid = String(s?.screenId || s?.id || "");
      if (sid && isValidStitchHtml(path.join(stitchDir, sid + ".html"))) valid++;
    }
    return { total: manifest.length, valid };
  } catch {
    return { total: 0, valid: countValidStitchHtml(stitchDir) };
  }
}

export function manifestUsesLocalFallback(stitchDir: string): boolean {
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!Array.isArray(manifest) || manifest.length === 0) return false;
    return manifest.every((entry) => String(entry?.source || "").toLowerCase() === "local-fallback");
  } catch {
    return false;
  }
}

function hasValidStitchDesignMarkdown(stitchDir: string): boolean {
  try {
    const designPath = path.join(stitchDir, "DESIGN.md");
    return fs.existsSync(designPath) && fs.statSync(designPath).size >= 500;
  } catch {
    return false;
  }
}

function readJsonObject(filePath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readJsonArray(filePath: string): any[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markdownEscape(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").replace(/[|]/g, "\\|").trim();
}

function describeRadius(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "restrained corners";
  if (/0(?:px|rem)?$/.test(text)) return `sharp squared edges (${text})`;
  if (/0\.125|2px/.test(text)) return `crisp micro-rounded corners (${text})`;
  if (/0\.25|4px/.test(text)) return `subtly rounded corners (${text})`;
  if (/0\.5|8px/.test(text)) return `soft rounded corners (${text})`;
  return `rounded geometry (${text})`;
}

export function synthesizeDesignMarkdownFromStitchAssets(stitchDir: string, projectId: string): boolean {
  if (!stitchDir || !fs.existsSync(stitchDir)) return false;
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  const tokensPath = path.join(stitchDir, "design-tokens.json");
  const manifest = readJsonArray(manifestPath).filter((entry) => !isPrdPseudoScreen(entry));
  const tokens = readJsonObject(tokensPath);
  const htmlCount = countValidStitchHtml(stitchDir);
  if (manifest.length === 0 || htmlCount === 0 || Object.keys(tokens).length === 0) return false;

  const title = markdownEscape(String(manifest[0]?.title || "Stitch Project").replace(/\s+-\s+.+$/, "")) || "Stitch Project";
  const screenLines = manifest
    .map((entry) => `- ${markdownEscape(entry.title || entry.name || entry.screenId)} (${markdownEscape(entry.deviceType || "screen")})`)
    .join("\n");
  const colorKeys = [
    "--color-primary",
    "--color-primary-container",
    "--color-secondary",
    "--color-tertiary",
    "--color-background",
    "--color-surface",
    "--color-surface-container",
    "--color-on-surface",
    "--color-outline",
    "--color-error",
  ];
  const colors = colorKeys
    .filter((key) => typeof tokens[key] === "string")
    .map((key) => `- **${key.replace("--color-", "").replace(/-/g, " ")}** (${tokens[key]}): ${key.includes("surface") || key.includes("background") ? "layout and container foundation" : key.includes("on-") ? "foreground text and icon contrast" : "interactive emphasis and semantic accent"}.`)
    .join("\n");
  const font = markdownEscape(tokens["--font-body-md"] || tokens["--font-google-0"] || tokens["--font-headline-md"] || "system sans-serif");
  const radius = describeRadius(tokens["--radius-lg"] || tokens["--radius-DEFAULT"]);
  const spacing = markdownEscape(tokens["--spacing-md"] || tokens["--spacing-gutter"] || "16px");
  const md = [
    `# Design System: ${title}`,
    `**Project ID:** ${markdownEscape(projectId || "unknown")}`,
    "",
    "## 1. Visual Theme & Atmosphere",
    "Dense, work-focused product UI generated from Stitch screens. The system favors direct operational surfaces, visible recovery states, compact controls, and clear state changes over marketing composition.",
    "",
    "## 2. Color Palette & Roles",
    colors || "- **primary**: use the generated design tokens in stitch/design-tokens.css as the authoritative palette.",
    "",
    "## 3. Typography Rules",
    `Use ${font} as the primary interface family. Headings should be compact and task-oriented; body text should stay readable in dense panels without oversized hero treatment.`,
    "",
    "## 4. Component Stylings",
    `* **Buttons:** Compact controls with ${radius}; primary actions use the primary token family and secondary actions use surface/outline contrast.`,
    `* **Cards/Containers:** Layered surfaces use generated surface tokens, ${radius}, and restrained borders rather than decorative card stacks.`,
    `* **Inputs/Forms:** Inputs align to the operational grid, use outline tokens for boundaries, and keep validation or recovery feedback adjacent to the affected control.`,
    "",
    "## 5. Layout Principles",
    `Use a constrained product workspace with approximately ${spacing} gutters, stable navigation, and scannable lists/details. Screens should preserve the generated Stitch visual system and keep every control tied to product behavior.`,
    "",
    "## 6. Generated Screen References",
    screenLines,
    "",
    "_Recovered by Setfarm from Stitch HTML, manifest, screenshots, and design token artifacts when Stitch DESIGN.md extraction was unavailable._",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(stitchDir, "DESIGN.md"), md, "utf-8");
  return hasValidStitchDesignMarkdown(stitchDir);
}

export function stitchApiKeyAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.STITCH_API_KEY || "").trim()) return true;
  if (String(env.STITCH_API_KEYS || "").trim()) return true;
  if (Object.keys(env).some((key) => /^STITCH_API_KEY_\d+$/.test(key) && String(env[key] || "").trim())) return true;
  const configuredEnvDir = String(env.SETFARM_ENV_DIR || "").trim();
  const candidates = [
    ...(configuredEnvDir
      ? [
          path.join(configuredEnvDir.replace(/^~(?=\/|$)/, os.homedir()), ".env.local"),
          path.join(configuredEnvDir.replace(/^~(?=\/|$)/, os.homedir()), ".env"),
        ]
      : []),
    path.join(path.dirname(resolvePlatformScript("stitch-api.mjs")), ".env"),
    path.join(path.dirname(resolvePlatformScript("stitch-api.mjs")), ".env.local"),
    path.join(os.homedir(), ".openclaw/setfarm/.env.local"),
    path.join(os.homedir(), ".openclaw/setfarm/.env"),
    path.join(os.homedir(), ".openclaw/.env.local"),
    path.join(os.homedir(), ".openclaw/.env"),
    path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/.env"),
    path.resolve(process.cwd(), "scripts/.env"),
  ];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const match = raw.match(/^\s*(?:export\s+)?STITCH_API_KEY\s*=\s*(.+)$/m);
      if (match?.[1]?.trim()) return true;
      const multi = raw.match(/^\s*(?:export\s+)?STITCH_API_KEYS\s*=\s*(.+)$/m);
      if (multi?.[1]?.trim()) return true;
      if (/^\s*(?:export\s+)?STITCH_API_KEY_\d+\s*=\s*\S+/m.test(raw)) return true;
    } catch {}
  }
  return false;
}

type ScreenMapEntry = { screenId: string; name: string; type: string; description: string; surfaceIds?: string[] };
type ProductSurface = {
  surfaceId: string;
  name: string;
  purpose: string;
  dataEntitiesBound: string;
  coreContent: string;
  permittedActions: Array<{ actionId: string; controlHint: string }>;
  entryPoints: string;
  exitRules: string;
  authRequired: string;
  designGuidance: string;
};

type V3DesignContract = Readonly<{
  productSpec: ProductSpecV1;
  generationTargets: DesignGenerationTargetsV1;
}>;

export function extractCanonicalProductSpecFromPrd(prd: string): ProductSpecV1 {
  const blocks = [...String(prd || "").matchAll(/```product-spec-v1\s*\n([\s\S]*?)\n```/g)];
  if (blocks.length !== 1) {
    throw new Error(`DESIGN_V3_PRODUCT_SPEC_PROJECTION_INVALID: expected exactly one product-spec-v1 block, got ${blocks.length}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(blocks[0]![1]!);
  } catch {
    throw new Error("DESIGN_V3_PRODUCT_SPEC_PROJECTION_INVALID: product-spec-v1 block is not JSON");
  }
  const parsed = ProductSpecV1EnglishWriteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`DESIGN_V3_PRODUCT_SPEC_PROJECTION_INVALID: ${parsed.error.issues[0]?.message || "schema mismatch"}`);
  }
  if (canonicalJsonStringify(parsed.data) !== blocks[0]![1]!.trim()) {
    throw new Error("DESIGN_V3_PRODUCT_SPEC_PROJECTION_INVALID: ProductSpec bytes are not Setfarm Canonical JSON v1");
  }
  return parsed.data;
}

function writeCanonicalJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${canonicalJsonStringify(value)}\n`, "utf8");
}

function prepareV3DesignContract(
  prd: string,
  stitchDir: string,
  expectedProductSpecHash?: string,
): V3DesignContract {
  const productSpec = extractCanonicalProductSpecFromPrd(prd);
  if (expectedProductSpecHash !== undefined
    && hashCanonicalJson(productSpec) !== expectedProductSpecHash) {
    throw new Error("DESIGN_V3_ENGLISH_ADMISSION_PRODUCT_SPEC_MISMATCH");
  }
  const produced = produceDesignGenerationTargetsV1(productSpec);
  if (produced.status !== "produced") {
    throw new Error(`DESIGN_V3_GENERATION_TARGETS_REJECTED: ${produced.rejectionCodes.join(",")}`);
  }
  fs.mkdirSync(stitchDir, { recursive: true });
  writeCanonicalJson(path.join(stitchDir, "GENERATION_TARGETS.json"), produced.generationTargets);
  return { productSpec, generationTargets: produced.generationTargets };
}

function exactV3ScreenMap(
  contract: V3DesignContract,
  bindings: StitchTargetResponseBindingsV2,
  stitchDir: string,
): ScreenMapEntry[] {
  if (bindings.generationTargetsHash !== hashCanonicalJson(contract.generationTargets)) {
    throw new Error("DESIGN_V3_RESPONSE_TARGET_HASH_MISMATCH");
  }
  const bindingByTarget = new Map(bindings.bindings.map((binding) => [binding.targetRef, binding]));
  const screens = contract.generationTargets.targets.map((target) => {
    const binding = bindingByTarget.get(target.targetId);
    if (!binding || binding.responseTitle !== target.expectedScreenTitle) {
      throw new Error(`DESIGN_V3_RESPONSE_BINDING_MISSING: ${target.targetId}`);
    }
    const htmlFile = path.join(stitchDir, `${binding.responseScreenId}.html`);
    if (!isValidStitchHtml(htmlFile)) {
      throw new Error(`DESIGN_V3_RESPONSE_HTML_MISSING: ${binding.responseScreenId}`);
    }
    const surface = contract.productSpec.surfaces.find((item) => item.id === target.surfaceRef);
    if (!surface) throw new Error(`DESIGN_V3_TARGET_SURFACE_UNRESOLVED: ${target.surfaceRef}`);
    return {
      screenId: binding.responseScreenId,
      name: target.expectedScreenTitle,
      type: classifyScreenType(surface.name),
      description: `${surface.name} ProductSpec surface`,
      surfaceIds: [target.surfaceRef],
    };
  });
  if (bindings.bindings.length !== screens.length) {
    throw new Error("DESIGN_V3_RESPONSE_BINDING_UNEXPECTED");
  }
  return screens;
}

function readExactV3Bindings(stitchDir: string): StitchTargetResponseBindingsV2 | undefined {
  try {
    const text = fs.readFileSync(path.join(stitchDir, "STITCH_RESPONSE_BINDINGS.json"), "utf8");
    const parsed = StitchTargetResponseBindingsV2Schema.parse(JSON.parse(text));
    return canonicalJsonStringify(parsed) === text.trim() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readExactV3CandidateSelection(stitchDir: string): StitchTargetCandidateSelectionV1 | undefined {
  try {
    const text = fs.readFileSync(path.join(stitchDir, "STITCH_TARGET_CANDIDATE_SELECTION.json"), "utf8");
    const parsed = StitchTargetCandidateSelectionV1Schema.parse(JSON.parse(text));
    return canonicalJsonStringify(parsed) === text.trim() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function exactFileHash(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readCandidateArtifactBytes(
  stitchDir: string,
  evidence: StitchDirectResponseEvidence,
): StitchCandidateArtifactBytesV1[] {
  return evidence.batches.flatMap((batch) => batch.candidates.map((candidate) => {
    const archivedHtmlPath = path.join(stitchDir, "candidates", `${candidate.screenId}.html`);
    const archivedScreenshotPath = path.join(stitchDir, "candidates", `${candidate.screenId}.png`);
    const htmlPath = fs.existsSync(archivedHtmlPath)
      ? archivedHtmlPath
      : path.join(stitchDir, `${candidate.screenId}.html`);
    const screenshotPath = fs.existsSync(archivedScreenshotPath)
      ? archivedScreenshotPath
      : path.join(stitchDir, `${candidate.screenId}.png`);
    return {
      screenId: candidate.screenId,
      ...(fs.existsSync(htmlPath) ? { htmlBytes: fs.readFileSync(htmlPath) } : {}),
      ...(fs.existsSync(screenshotPath) ? { screenshotBytes: fs.readFileSync(screenshotPath) } : {}),
    };
  }));
}

function materializeSelectedCandidateProjection(
  stitchDir: string,
  selection: StitchTargetCandidateSelectionV1,
  publishSelected: boolean,
): void {
  const archiveDir = path.join(stitchDir, "candidates");
  fs.mkdirSync(archiveDir, { recursive: true });
  const selectedIds = new Set(publishSelected
    ? selection.selections.flatMap((item) => item.selectedScreenId ? [item.selectedScreenId] : [])
    : []);
  for (const candidate of selection.candidates) {
    for (const extension of ["html", "png"] as const) {
      const operationalPath = path.join(stitchDir, `${candidate.screenId}.${extension}`);
      const archivePath = path.join(archiveDir, `${candidate.screenId}.${extension}`);
      if (fs.existsSync(operationalPath)) fs.copyFileSync(operationalPath, archivePath);
      if (!selectedIds.has(candidate.screenId)) fs.rmSync(operationalPath, { force: true });
    }
  }
  for (const file of fs.readdirSync(stitchDir)) {
    if (!/\.(?:html|png)$/i.test(file)) continue;
    const screenId = file.replace(/\.(?:html|png)$/i, "");
    if (!selectedIds.has(screenId)) fs.rmSync(path.join(stitchDir, file), { force: true });
  }
}

async function verifyExactV3SelectionAuthority(
  contract: V3DesignContract,
  selection: StitchTargetCandidateSelectionV1,
  bindings: StitchTargetResponseBindingsV2,
  stitchDir: string,
): Promise<void> {
  const generationTargetsHash = hashCanonicalJson(contract.generationTargets);
  const renderedSemantics = await verifyStitchRenderedSemanticsReplayV1({ repo: path.dirname(stitchDir) });
  const renderedSemanticsHash = hashCanonicalJson(renderedSemantics);
  if (
    selection.generationTargetsHash !== generationTargetsHash
    || bindings.generationTargetsHash !== generationTargetsHash
    || bindings.candidateSelectionHash !== hashCanonicalJson(selection)
    || selection.semanticEvidencePolicy !== "browser_rendered_v1"
    || selection.renderedSemanticsHash !== renderedSemanticsHash
    || bindings.renderedSemanticsHash !== renderedSemanticsHash
  ) {
    throw new Error("DESIGN_V3_SELECTION_AUTHORITY_HASH_MISMATCH");
  }
  const directEvidencePath = path.join(stitchDir, "STITCH_DIRECT_RESPONSE_EVIDENCE.json");
  let directEvidence: StitchDirectResponseEvidenceV2;
  try {
    const text = fs.readFileSync(directEvidencePath, "utf8");
    const raw = JSON.parse(text);
    const parsed = parseStitchDirectResponseEvidence(raw);
    if (parsed.status !== "parsed" || parsed.sourceVersion !== "v2") throw new Error("v2 required");
    directEvidence = StitchDirectResponseEvidenceV2Schema.parse(parsed.source);
    if (canonicalJsonStringify(directEvidence) !== text.trim()) throw new Error("non-canonical");
  } catch {
    throw new Error("DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_MISSING");
  }
  if (
    selection.downloadReceiptPolicy !== "required"
    || selection.directResponseEvidenceHash !== hashCanonicalJson(directEvidence)
  ) {
    throw new Error("DESIGN_V3_SELECTION_DIRECT_EVIDENCE_HASH_MISMATCH");
  }
  const replayedSelection = selectStitchTargetCandidatesV1({
    generationTargets: contract.generationTargets,
    directResponseEvidence: directEvidence,
    renderedSemantics,
    artifacts: readCandidateArtifactBytes(stitchDir, directEvidence),
    authorityMode: "clean_v3",
  });
  if (
    replayedSelection.status !== "produced"
    || canonicalJsonStringify(replayedSelection.candidateSelection) !== canonicalJsonStringify(selection)
  ) {
    throw new Error("DESIGN_V3_SELECTION_DETERMINISTIC_REPLAY_MISMATCH");
  }
  const replayedBindings = bindStitchTargetCandidateSelectionsV2({
    generationTargets: contract.generationTargets,
    candidateSelection: replayedSelection.candidateSelection,
  });
  if (
    replayedBindings.status !== "produced"
    || canonicalJsonStringify(replayedBindings.responseBindings) !== canonicalJsonStringify(bindings)
  ) {
    throw new Error("DESIGN_V3_BINDINGS_DETERMINISTIC_REPLAY_MISMATCH");
  }
  const selectionByTarget = new Map(selection.selections.map((item) => [item.targetRef, item]));
  const selectedCandidateById = new Map(selection.candidates.map((item) => [item.screenId, item]));
  const renderedCandidateById = new Map(renderedSemantics.candidates.map((item) => [item.screenId, item]));
  for (const binding of bindings.bindings) {
    const selected = selectionByTarget.get(binding.targetRef);
    const selectedCandidate = selectedCandidateById.get(binding.responseScreenId);
    const renderedCandidate = renderedCandidateById.get(binding.responseScreenId);
    if (
      selected?.status !== "selected"
      || selected.selectedScreenId !== binding.responseScreenId
      || selected.stageId !== binding.stageId
      || !selectedCandidate
      || selectedCandidate.semanticDomHash !== binding.semanticDomHash
      || selectedCandidate.semanticObservationHash !== binding.semanticObservationHash
      || renderedCandidate?.status !== "rendered"
      || renderedCandidate.semanticDom?.hash !== binding.semanticDomHash
      || renderedCandidate.observationHash !== binding.semanticObservationHash
      || binding.contractElementRefs.some((elementRef) =>
        !renderedCandidate.elements.some((element) => element.elementRef === elementRef))
    ) {
      throw new Error(`DESIGN_V3_RESPONSE_SELECTION_MISMATCH: ${binding.targetRef}`);
    }
    const htmlPath = path.join(stitchDir, `${binding.responseScreenId}.html`);
    const screenshotPath = path.join(stitchDir, `${binding.responseScreenId}.png`);
    if (
      !fs.existsSync(htmlPath)
      || !fs.existsSync(screenshotPath)
      || exactFileHash(htmlPath) !== binding.htmlArtifactHash
      || exactFileHash(screenshotPath) !== binding.screenshotArtifactHash
    ) {
      throw new Error(`DESIGN_V3_SELECTED_ARTIFACT_HASH_MISMATCH: ${binding.responseScreenId}`);
    }
  }
}

function truncateForPrompt(value: string, max = 420): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function surfaceCaption(surface: ProductSurface): string {
  const content = surface.coreContent || surface.purpose || `${surface.name} workflow`;
  return truncateForPrompt(`${surface.name}: ${content}`, 180);
}

function surfaceActionsLine(surface: ProductSurface): string {
  return surface.permittedActions.map((action) => `${action.actionId} as ${action.controlHint}`).join(", ") || "No explicit actions";
}

function productDisplayName(prd: string): string {
  const text = String(prd || "");
  const candidates = [
    text.match(/(?:^|\n)\s*PROJECT_NAME\s*:?\s*["']?([^"'\n]+)["']?/i)?.[1],
    text.match(/(?:^|\n)\s*project_name\s*:?\s*["']?([^"'\n]+)["']?/i)?.[1],
    text.match(/(?:^|\n)#\s*PRD\s*:\s*(.+)$/i)?.[1],
    text.match(/(?:^|\n)([A-Z][^\n]{3,80})\s+Product Contract\b/)?.[1],
    text.match(/\bcalled\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,5})\s+(?:that|which|to|for|,|\.)/i)?.[1],
    text.match(/(?:^|\n)\s*-?\s*Overview\s*:\s*([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,5})\s+(?:turns|is|helps|lets|provides|manages)\b/i)?.[1],
  ];
  for (const candidate of candidates) {
    const clean = String(candidate || "")
      .replace(/\s*Product Contract\s*$/i, "")
      .replace(/\s+for\s+.*$/i, "")
      .trim();
    const name = truncateForPrompt(clean, 80);
    if (name && !/^product$/i.test(name)) return name;
  }
  return "Product";
}

function surfaceScreenSpec(surface: ProductSurface, index: number, projectName: string): string {
  return [
    `SCREEN_SPEC_${index + 1}:`,
    `- exact_screen_title: ${surface.name} - ${projectName}`,
    `- surface_id: ${surface.surfaceId}`,
    `- unique_canvas_caption: ${surfaceCaption(surface)}`,
    `- purpose: ${truncateForPrompt(surface.purpose)}`,
    `- required_content: ${truncateForPrompt(surface.coreContent || "Use the Product Surface purpose as content.")}`,
    `- data_entities: ${truncateForPrompt(surface.dataEntitiesBound || "not specified", 220)}`,
    `- visible_actions: ${surfaceActionsLine(surface)}`,
    `- entry_exit_rules: ${truncateForPrompt(`${surface.entryPoints || "not specified"} -> ${surface.exitRules || "not specified"}`, 260)}`,
    `- design_guidance: ${truncateForPrompt(surface.designGuidance || "Follow the scoped product contract.", 320)}`,
  ].join("\n");
}

type SurfaceVerificationResult = {
  screenMap: ScreenMapEntry[];
  missing: string[];
  unexpected: string[];
  duplicates: string[];
  surfaces: ProductSurface[];
  missingSurfaces: ProductSurface[];
  inlineCovered: string[];
};

function normalizeScreenName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0130]/g, "I")
    .replace(/[\u0131]/g, "i")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[\u00e7\u00c7]/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function surfaceNameMatches(expectedName: string, actualName: string): boolean {
  const expected = normalizeScreenName(expectedName);
  const actual = normalizeScreenName(actualName);
  if (!expected || !actual) return false;
  if (expected === actual) return true;
  if (actual.startsWith(`${expected} `)) return true;
  if (expected.startsWith(`${actual} `)) return true;

  const expectedTokens = expected.split(" ").filter(Boolean);
  const actualTokens = new Set(actual.split(" ").filter(Boolean));
  if (expectedTokens.length < 2) return false;
  return expectedTokens.every((token) => actualTokens.has(token));
}

function splitCsvish(value: string): string[] {
  return String(value || "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSurfaceId(value: string, fallback: string): string {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (clean.startsWith("SURF_") && clean.length > 5) return clean;
  const fallbackClean = String(fallback || "SURFACE").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `SURF_${fallbackClean || "SURFACE"}`;
}

function parsePermittedActions(value: string): Array<{ actionId: string; controlHint: string }> {
  const actions: Array<{ actionId: string; controlHint: string }> = [];
  const actionRe = /\b(ACT_[A-Z0-9_]+)\b(?:[^()\n]*\((?:control_hint|Control Hint)\s*:\s*([^)]+)\))?/g;
  let match: RegExpExecArray | null;
  while ((match = actionRe.exec(value))) {
    actions.push({ actionId: match[1], controlHint: (match[2] || "primary_button").trim() });
  }
  if (actions.length > 0) return actions;
  return splitCsvish(value).map((item) => {
    const id = item.match(/\b(ACT_[A-Z0-9_]+)\b/)?.[1] || "";
    const hint = item.match(/\b(?:control_hint|Control Hint)\s*:\s*([a-z_]+)/i)?.[1] || "primary_button";
    return id ? { actionId: id, controlHint: hint } : null;
  }).filter(Boolean) as Array<{ actionId: string; controlHint: string }>;
}

function assignSurfaceField(surface: ProductSurface, key: string, value: string): void {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalizedKey === "surface id" || normalizedKey === "surface") surface.surfaceId = normalizeSurfaceId(value, surface.name);
  else if (normalizedKey === "name") surface.name = value.trim() || surface.name;
  else if (normalizedKey === "purpose") surface.purpose = value.trim();
  else if (normalizedKey === "data entities bound" || normalizedKey === "data entities") surface.dataEntitiesBound = value.trim();
  else if (normalizedKey === "core content") surface.coreContent = value.trim();
  else if (normalizedKey === "permitted actions" || normalizedKey === "actions") surface.permittedActions = parsePermittedActions(value);
  else if (normalizedKey === "entry points") surface.entryPoints = value.trim();
  else if (normalizedKey === "exit guard rules" || normalizedKey === "exit rules" || normalizedKey === "exit points") surface.exitRules = value.trim();
  else if (normalizedKey === "auth required") surface.authRequired = value.trim();
  else if (normalizedKey === "design guidance") surface.designGuidance = value.trim();
}

export function parseProductSurfaces(prd: string): ProductSurface[] {
  const surfaces: ProductSurface[] = [];
  const lines = String(prd || "").split(/\r?\n/);
  let inSurfaces = false;
  let current: ProductSurface | null = null;
  const pushCurrent = () => {
    if (!current) return;
    current.surfaceId = normalizeSurfaceId(current.surfaceId, current.name);
    if (!current.name) current.name = current.surfaceId.replace(/^SURF_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
    if (!current.purpose) current.purpose = `${current.name} product surface`;
    surfaces.push(current);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##+\s+(?:\d+\.\s*)?Product Surfaces\b/i.test(trimmed)) {
      inSurfaces = true;
      continue;
    }
    if (inSurfaces && /^##\s+/.test(trimmed)) break;
    if (!inSurfaces) continue;

    const heading = trimmed.match(/^#{3,5}\s+SURFACE\s*:\s*([A-Z0-9_ -]+)(?:\s*[-:]\s*(.+))?$/i);
    const bulletId = trimmed.match(/^[-*]\s*(?:SURFACE_ID|Surface ID)\s*:\s*([A-Z0-9_ -]+)$/i);
    if (heading || bulletId) {
      pushCurrent();
      const idRaw = heading?.[1] || bulletId?.[1] || "";
      const nameRaw = heading?.[2] || idRaw;
      current = {
        surfaceId: normalizeSurfaceId(idRaw, nameRaw),
        name: nameRaw.replace(/^SURF[_ -]?/i, "").replace(/[_-]+/g, " ").trim(),
        purpose: "",
        dataEntitiesBound: "",
        coreContent: "",
        permittedActions: [],
        entryPoints: "",
        exitRules: "",
        authRequired: "",
        designGuidance: "",
      };
      continue;
    }

    if (!current) continue;
    const field = trimmed.match(/^[-*]\s*([^:]+):\s*(.+)$/);
    if (field) assignSurfaceField(current, field[1], field[2]);
  }
  pushCurrent();

  const seen = new Set<string>();
  return surfaces.filter((surface) => {
    if (seen.has(surface.surfaceId)) return false;
    seen.add(surface.surfaceId);
    return true;
  });
}

function surfaceSearchText(surface: ProductSurface): string {
  return [
    surface.surfaceId,
    surface.name,
    surface.purpose,
    surface.dataEntitiesBound,
    surface.coreContent,
    surface.entryPoints,
    surface.exitRules,
    surface.designGuidance,
    surface.permittedActions.map((action) => `${action.actionId} ${action.controlHint}`).join(" "),
  ].join(" ");
}

export function surfaceCoverageMode(surface: ProductSurface): "standalone_required" | "inline_allowed" {
  const text = normalizeScreenName(surfaceSearchText(surface));
  const inlineStateTerms = [
    "empty",
    "error",
    "loading",
    "retry",
    "recover",
    "recovery",
    "failed",
    "failure",
    "validation",
    "fallback",
    "offline",
    "corrupt",
    "unauthorized",
    "permission",
    "confirmation",
  ];
  return inlineStateTerms.some((term) => text.includes(term)) ? "inline_allowed" : "standalone_required";
}

function htmlTextForInlineCoverage(stitchDir: string, screenMap: ScreenMapEntry[]): string {
  const parts = screenMap.map((screen) => `${screen.name} ${screen.type} ${screen.description}`);
  if (!stitchDir || !fs.existsSync(stitchDir)) return normalizeScreenName(parts.join(" "));
  try {
    for (const file of fs.readdirSync(stitchDir).filter((name) => name.endsWith(".html") && !name.startsWith("."))) {
      const filePath = path.join(stitchDir, file);
      if (!isValidStitchHtml(filePath)) continue;
      const html = fs.readFileSync(filePath, "utf-8")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ");
      parts.push(html.slice(0, 200000));
    }
  } catch {}
  return normalizeScreenName(parts.join(" "));
}

function inlineCoverageEvidence(surface: ProductSurface, stitchDir: string, screenMap: ScreenMapEntry[]): string | null {
  if (surfaceCoverageMode(surface) !== "inline_allowed") return null;
  const designText = htmlTextForInlineCoverage(stitchDir, screenMap);
  if (!designText) return null;
  const surfaceText = normalizeScreenName(surfaceSearchText(surface));
  const evidenceTerms = [
    "empty",
    "error",
    "loading",
    "retry",
    "recover",
    "recovery",
    "failed",
    "failure",
    "validation",
    "fallback",
    "offline",
    "corrupt",
    "clear",
    "reset",
    "create",
  ].filter((term) => surfaceText.includes(term));
  const uniqueTerms = [...new Set(evidenceTerms)];
  if (uniqueTerms.length === 0) return null;
  const hits = uniqueTerms.filter((term) => designText.includes(term));
  const requiredHits = Math.min(2, uniqueTerms.length);
  return hits.length >= requiredHits ? `${surface.surfaceId} inline evidence: ${hits.slice(0, 5).join(",")}` : null;
}

function tokenSet(value: string): Set<string> {
  const ignored = new Set(["the", "and", "for", "with", "from", "this", "that", "screen", "surface", "page", "view", "state", "app", "product", "user", "users"]);
  return new Set(normalizeScreenName(value).split(" ").filter((token) => token.length > 2 && !ignored.has(token)));
}

function matchSurfacesForScreen(screen: ScreenMapEntry, surfaces: ProductSurface[]): ProductSurface[] {
  const screenText = `${screen.name} ${screen.type} ${screen.description}`;
  const screenTokens = tokenSet(screenText);
  const exactMatches: ProductSurface[] = [];
  for (const surface of surfaces) {
    if (surfaceNameMatches(surface.name, screen.name) || normalizeScreenName(screenText).includes(normalizeScreenName(surface.surfaceId.replace(/^SURF_/, "")))) {
      exactMatches.push(surface);
    }
  }
  if (exactMatches.length > 0) return exactMatches;

  const matches: ProductSurface[] = [];
  for (const surface of surfaces) {
    if (surfaceCoverageMode(surface) === "inline_allowed") {
      continue;
    }
    const surfaceTokens = tokenSet(surfaceSearchText(surface));
    let hits = 0;
    for (const token of surfaceTokens) if (screenTokens.has(token)) hits++;
    if (hits >= Math.min(2, Math.max(1, surfaceTokens.size))) matches.push(surface);
  }
  return matches;
}

function screenLooksOutOfScope(screen: ScreenMapEntry, prd: string): boolean {
  const text = normalizeScreenName(`${screen.name} ${screen.type} ${screen.description}`);
  const prdText = normalizeScreenName(prd);
  const forbidden = [
    "marketing landing",
    "pricing",
    "checkout",
    "shopping cart",
    "admin panel",
    "documentation",
    "requirements",
    "prd",
    "sitemap",
    "blog",
  ];
  return forbidden.some((term) => text.includes(term) && !prdText.includes(term));
}

export function verifyScreenMapToSurfaces(
  screenMap: ScreenMapEntry[],
  prd: string,
  options: { stitchDir?: string } = {},
): SurfaceVerificationResult {
  const surfaces = parseProductSurfaces(prd);
  if (surfaces.length === 0) return { screenMap, missing: [], unexpected: [], duplicates: [], surfaces, missingSurfaces: [], inlineCovered: [] };

  const next: ScreenMapEntry[] = [];
  const missingSurfaceIds = new Set(surfaces.map((surface) => surface.surfaceId));
  const unexpected: string[] = [];
  const usedIds = new Set<string>();
  const duplicates: string[] = [];

  for (const screen of screenMap) {
    const matches = matchSurfacesForScreen(screen, surfaces);
    if (matches.length === 0 || screenLooksOutOfScope(screen, prd)) {
      unexpected.push(screen.name || screen.screenId);
      continue;
    }
    if (usedIds.has(screen.screenId)) duplicates.push(screen.name || screen.screenId);
    usedIds.add(screen.screenId);
    for (const match of matches) missingSurfaceIds.delete(match.surfaceId);
    next.push({
      ...screen,
      type: screen.type || classifyScreenType(screen.name),
      description: screen.description || `${screen.name} screen`,
      surfaceIds: matches.map((surface) => surface.surfaceId),
    });
  }

  const missingSurfaces: ProductSurface[] = [];
  const inlineCovered: string[] = [];
  for (const surface of surfaces.filter((item) => missingSurfaceIds.has(item.surfaceId))) {
    const evidence = options.stitchDir ? inlineCoverageEvidence(surface, options.stitchDir, next) : null;
    if (evidence) {
      inlineCovered.push(evidence);
      continue;
    }
    missingSurfaces.push(surface);
  }

  const missing = missingSurfaces.map((surface) => `${surface.surfaceId} ${surface.name}`.trim());

  return { screenMap: next, missing, unexpected, duplicates, surfaces, missingSurfaces, inlineCovered };
}

function rewriteScreenArtifactsForScreenMap(stitchDir: string, screenMap: ScreenMapEntry[], deviceType: string): void {
  try {
    const allowedIds = new Set(screenMap.map((screen) => screen.screenId));
    const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
    let manifest: any[] = [];
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (Array.isArray(raw)) manifest = raw;
    } catch {}
    const byId = new Map(manifest.map((entry) => [String(entry?.screenId || entry?.id || ""), entry]));
    const nextManifest = screenMap.map((screen) => {
      const existing = byId.get(screen.screenId) || {};
      return {
        ...existing,
        screenId: screen.screenId,
        title: screen.name,
        htmlFile: `${screen.screenId}.html`,
        deviceType: existing.deviceType || existing.device_type || deviceType,
        surfaceIds: screen.surfaceIds || existing.surfaceIds || [],
      };
    }).filter((entry) => allowedIds.has(String(entry.screenId)));
    fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
    fs.writeFileSync(path.join(stitchDir, "SCREEN_MAP.json"), JSON.stringify(screenMap, null, 2));
  } catch (e) {
    logger.warn(`[module:design preclaim] artifact reconciliation write failed: ${String(e).slice(0, 200)}`);
  }
}

function buildSurfaceInventory(surfaces: ProductSurface[]): string {
  return surfaces.map((surface, index) => [
    `${index + 1}. ${surface.surfaceId} - ${surface.name}`,
    `   Purpose: ${surface.purpose}`,
    `   Data: ${surface.dataEntitiesBound || "not specified"}`,
    `   Core content: ${surface.coreContent || "not specified"}`,
    `   Actions: ${surface.permittedActions.map((action) => `${action.actionId} (${action.controlHint})`).join(", ") || "none"}`,
    `   Entry/exit: ${surface.entryPoints || "not specified"} -> ${surface.exitRules || "not specified"}`,
    `   Guidance: ${surface.designGuidance || "follow the product contract"}`,
  ].join("\n")).join("\n\n");
}

function productVisionSummary(prd: string): string {
  const text = String(prd || "");
  const pick = (label: string): string => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`(?:^|\\n)\\s*-?\\s*${escaped}\\s*:\\s*(.+)`, "i"));
    return truncateForPrompt(match?.[1] || "", 320);
  };
  const lines = [
    pick("Overview"),
    pick("Core Objectives") || pick("FR-001"),
    pick("Target Audience"),
  ].filter(Boolean);
  if (lines.length > 0) return lines.map((line) => `- ${line}`).join("\n");
  return `- ${truncateForPrompt(text.replace(/\s+/g, " ").trim(), 600) || "Use the declared Product Surfaces as the visual product source."}`;
}

function uiSafePrdContext(prd: string): string {
  const lines = String(prd || "").split(/\r?\n/);
  const keepSection = (line: string): boolean => {
    const normalized = normalizeScreenName(line);
    return (
      normalized.includes("context and goals") ||
      normalized.includes("behavioral and action contract") ||
      normalized.includes("validation and error strategy") ||
      normalized.includes("out of scope")
    );
  };
  const stopSection = (line: string): boolean => /^#{1,3}\s+/.test(line.trim()) || /^\s*\d+\.\s+/.test(line.trim());
  const kept: string[] = [];
  let active = false;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (keepSection(line)) {
      active = true;
      kept.push(line);
      continue;
    }
    if (active && stopSection(line) && !keepSection(line)) {
      active = false;
    }
    if (!active) continue;
    if (/\b(?:repo|branch|github|local directory|server directory|env|environment|testability|platform contract|state architecture|data flow|server state|db_required)\b/i.test(line)) {
      continue;
    }
    kept.push(line);
  }
  const text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return truncateForPrompt(text, 9000) || "No extra UI-safe PRD context extracted.";
}

function buildDesignBrief(prd: string, deviceType: string, uiLanguage: string): string {
  const surfaces = parseProductSurfaces(prd);
  const surfaceInventory = buildSurfaceInventory(surfaces);

  return [
    "# DESIGN_BRIEF",
    "",
    "## STRICT_UI_SCOPE_CONTRACT",
    "- Design only UI that maps to one or more PRODUCT_SURFACES below.",
    "- Do not invent modules, workflows, dashboards, marketing pages, admin areas, ecommerce flows, docs, PRD pages, or settings outside the Product Surfaces.",
    "- Physical screen count, routing, tabs, modals, drawers, and component hierarchy are Stitch decisions, but every generated screen must be traceable to a SURF_* id.",
    "- Every permitted action must have a plausible visible control or platform-appropriate interaction.",
    "- Empty, loading, validation, and error states may be included only inside the declared Product Surfaces.",
    `- All visible user-facing text must be in ${uiLanguage}.`,
    "- Keep metadata, screen titles, and technical identifiers in English.",
    `- Target device type: ${deviceType}.`,
    "",
    "## PRODUCT_VISION_SUMMARY",
    productVisionSummary(prd),
    "",
    "## PRODUCT_SURFACES",
    surfaceInventory || "No Product Surfaces were declared.",
    "",
    "## UI_OUT_OF_SCOPE",
    "- No PRD/requirements/sitemap/documentation screens.",
    "- No generic admin, pricing, checkout, blog, onboarding, account, or profile areas unless declared as a Product Surface.",
    "- No local placeholder/wireframe design.",
    "",
    "## UI_SAFE_PRD_CONTEXT",
    "Use this only to understand product behavior and missing UI states. Do not render this text directly. SCREEN_SPECS remain the active screen source.",
    uiSafePrdContext(prd),
  ].join("\n");
}

function buildBatchStitchPrompt(repo: string, prd: string, deviceType: string, uiLanguage: string, stageSurfaces?: ProductSurface[], stageLabel = "all surfaces"): string {
  void repo;
  const allSurfaces = parseProductSurfaces(prd);
  const surfaces = stageSurfaces?.length ? stageSurfaces : allSurfaces;
  const projectName = productDisplayName(prd);
  const screenSpecs = surfaces.map((surface, index) => surfaceScreenSpec(surface, index, projectName)).join("\n\n");
  const expectedTitles = surfaces.map((surface) => `- ${surface.name} - ${projectName}`).join("\n");

  return [
    "# STITCH_BATCH_BRIEF",
    "",
    `Generate exactly ${surfaces.length} production-quality UI screens for the Product Surface targets below.`,
    `Batch stage: ${stageLabel}.`,
    "Generate every SCREEN_SPEC in this batch call. Do not generate screens outside this stage.",
    "If this Stitch project already has screens from an earlier stage, preserve the same visual system, navigation pattern, density, typography, spacing, and component language.",
    `Target device type: ${deviceType}.`,
    `All visible user-facing text must be in ${uiLanguage}.`,
    "",
    "## PRODUCT_VISION_SUMMARY",
    productVisionSummary(prd),
    "",
    "## REQUIRED_SCREEN_TITLES",
    expectedTitles || "No Product Surface targets were declared.",
    "",
    "## SCREEN_SPECS",
    screenSpecs || "No Product Surface targets were declared.",
    "",
    "## OUTPUT_RULES",
    "- Create one distinct canvas/frame per SCREEN_SPEC.",
    "- Do not create a design-system/style-guide canvas as an output screen. Apply the design system inside the product screens only.",
    "- Do not output palette, typography, component inventory, or moodboard screens.",
    "- Use exact_screen_title as the screen title/name. Do not rename screens to generic labels.",
    "- Use unique_canvas_caption for that screen only. Do not reuse one global caption across screens.",
    "- Do not place the whole chunk summary, PRD summary, Key Deliverables text, or any follow-up question as visible screen captions.",
    "- Do not write 'How would you like to proceed?', 'We could refine...', or similar assistant chat text in the design output.",
    "- Each screen must visibly emphasize its own required_content and visible_actions. Do not let all screens share the same layout content.",
    "",
    "## STRICT_UI_SCOPE_CONTRACT",
    "- Every generated screen must map to one or more SCREEN_SPECS above.",
    "- Do not invent modules, dashboards, marketing pages, admin areas, ecommerce flows, docs, account, or profile areas outside the Product Surfaces.",
    "- Every permitted action from the matching Product Surface should have a plausible visible control or platform-appropriate interaction.",
    "- Empty, loading, validation, and error states may be included only inside the declared Product Surfaces.",
    "",
    "## PRODUCT_SURFACES",
    buildSurfaceInventory(surfaces) || "No Product Surfaces were declared.",
    "",
    "## UI_SAFE_PRD_CONTEXT",
    "Use this only to understand product behavior and missing UI states. Do not render this text directly. SCREEN_SPECS remain the active screen source.",
    uiSafePrdContext(prd),
  ].join("\n");
}

export function buildV3BatchStitchPrompt(
  productSpec: ProductSpecV1,
  generationTargets: DesignGenerationTargetsV1,
  targetRefs: readonly string[],
  deviceType: string,
  uiLanguage: string,
  stageId: string,
): string {
  const targetById = new Map(generationTargets.targets.map((target) => [target.targetId, target]));
  const targets = targetRefs.map((targetRef) => {
    const target = targetById.get(targetRef);
    if (!target) throw new Error(`DESIGN_V3_BATCH_TARGET_UNRESOLVED: ${targetRef}`);
    return target;
  });
  const specs = targets.map((target, index) => {
    const surface = productSpec.surfaces.find((item) => item.id === target.surfaceRef);
    if (!surface) throw new Error(`DESIGN_V3_TARGET_SURFACE_UNRESOLVED: ${target.surfaceRef}`);
    const actions = target.requiredActionRefs.map((actionRef) => {
      const action = productSpec.actions.find((item) => item.id === actionRef);
      if (!action) throw new Error(`DESIGN_V3_TARGET_ACTION_UNRESOLVED: ${actionRef}`);
      const inputContract = action.input.fields.length > 0
        ? action.input.fields.map((field) => `${action.id}.${field.name}`).join(", ")
        : "none";
      const observableSelectors = (target.requiredObservableSelectors ?? [])
        .filter((observable) => observable.actionRef === action.id)
        .map((observable) => ({
          observableRef: observable.observableRef,
          selector: observable.selector,
        }));
      return [
        `  - action_ref: ${action.id}`,
        `    visible_intent: ${action.name}`,
        `    exact_action_attribute: data-action="${action.id}"`,
        `    exact_input_mappings: ${inputContract}`,
        `    exact_observable_selectors: ${canonicalJsonStringify(observableSelectors)}`,
      ].join("\n");
    }).join("\n");
    return [
      `SCREEN_TARGET_${index + 1}:`,
      `- target_ref: ${target.targetId}`,
      `- surface_ref: ${target.surfaceRef}`,
      `- exact_screen_title: ${target.expectedScreenTitle}`,
      `- exact_surface_attribute: data-surface-id="${target.surfaceRef}"`,
      `- surface_kind: ${surface.kind}`,
      `- exact_actions:`,
      actions || "  - none",
    ].join("\n");
  }).join("\n\n");

  return [
    "# SETFARM_STITCH_V3_GENERATION_CONTRACT",
    "",
    `contract_schema: ${generationTargets.schema}`,
    `product_spec_hash: ${generationTargets.productSpecHash}`,
    `stage_id: ${stageId}`,
    `Generate exactly ${targets.length} screens and no others in this response.`,
    `Target device type: ${deviceType}.`,
    `All visible user-facing text must be in ${uiLanguage}.`,
    "",
    "## EXACT_SCREEN_TARGETS",
    specs,
    "",
    "## MACHINE_READABLE_COMPLETENESS_RULES",
    "- Output static design HTML only. Do not implement application behavior, state transitions, persistence, localStorage, network requests, event handlers, or executable application JavaScript; Setfarm implements behavior from the sealed ProductSpec after design acceptance.",
    "- Script source is forbidden except the compiler-approved https://cdn.tailwindcss.com runtime and an optional data-only tailwind.config assignment. Do not emit onclick/onchange/oninput or any other inline event-handler attribute.",
    "- The returned screen title must equal exact_screen_title byte-for-byte. Do not abbreviate, translate, normalize, decorate, or rename it.",
    "- Return exactly one screen for each SCREEN_TARGET and no style-guide, assistant, summary, moodboard, PRD, or extra canvas.",
    "- Every returned screen must preserve exact_surface_attribute byte-for-byte on exactly one root product-surface wrapper. Do not place a different SURF_* value in that screen.",
    "- For every exact_actions entry, render exactly one actionable HTML element and preserve the exact data-action=\"ACT_*\" attribute on that same button, link, or input element.",
    "- Do not put ACT_* only in prose, labels, nearby wrappers, comments, scripts, or a different DOM element; the actionable element itself owns data-action.",
    "- For every exact_input_mappings entry, exactly one value-providing element must preserve data-action-input=\"ACT_*.field\". A checkbox/action element may carry both data-action and data-action-input when it supplies its own value.",
    "- For every exact_observable_selectors entry, preserve the exact selector contract: control selectors bind the same data-action element, surface selectors require one wrapper with data-surface-id equal to the exact SURF_* ref, and accessibility selectors must expose the declared browser-computed accessible role and exact accessible name on one element. Native semantics are valid: for example a named <button> does not need a redundant role=\"button\" attribute. The Setfarm converter assigns semantic observable IDs only after browser verification.",
    "- Do not emit any button, link, input, textarea, select, checkbox, tab, menu item, or other actionable control that is not declared by exact_actions or exact_input_mappings.",
    "- Disabled-looking, placeholder, icon-only, overflow, breadcrumb, navigation, and decorative controls are still controls and are forbidden unless declared above.",
    "- Custom data-action and data-action-input attributes are contractual source, not visual copy. Preserve their exact case and spelling in exported HTML.",
    "",
    "## PRODUCT_SCOPE",
    `Product: ${productSpec.product.name}`,
    `Goals: ${productSpec.product.goals.map((goal) => goal.statement).join(" | ")}`,
    "Do not invent product behavior outside the typed targets above.",
  ].join("\n");
}

function buildPerScreenStitchPrompt(prd: string, screen: ScreenMapEntry, uiLanguage: string): string {
  return [
    `Create exactly one production-quality UI screen for this Product Surface target.`,
    `Target name: ${screen.name}`,
    `Target description: ${screen.description || `${screen.name} surface`}`,
    `Surface IDs: ${(screen.surfaceIds || []).join(", ") || "unknown"}`,
    "",
    "Scoped design brief:",
    buildDesignBrief(prd, "DESKTOP", uiLanguage).slice(0, 16000),
    "",
    "Design requirements:",
    "- Generate only this scoped target, not a whole unrelated app flow.",
    "- Every visible control must map to an ACT_* action declared in the Product Surface when possible.",
    "- Use a polished, modern visual design with real layout density, not a placeholder wireframe.",
    `- All visible user-facing text must be in ${uiLanguage}.`,
    "- Keep technical metadata in English.",
  ].join("\n");
}

async function generateStitchScreensInSingleBatch(
  ctx: ClaimContext,
  stitchScript: string,
  repo: string,
  stitchDir: string,
  projId: string,
  prd: string,
  deviceType: string,
  uiLanguage: string,
  v3Contract?: V3DesignContract,
): Promise<{
  completed: boolean;
  providerUnavailable: boolean;
  diagnostic: string;
  failureCode?: V3DesignBoundaryCode;
  batches: StitchBatchResponseV2[];
  evidenceBatches: StitchDirectBatchEvidenceV2[];
}> {
  const parsedSurfaces = parseProductSurfaces(prd);
  const parsedSurfaceById = new Map(parsedSurfaces.map((surface) => [surface.surfaceId, surface]));
  const surfaces = v3Contract
    ? v3Contract.generationTargets.targets.flatMap((target) => {
        const surface = parsedSurfaceById.get(target.surfaceRef);
        return surface ? [surface] : [];
      })
    : parsedSurfaces;
  if (surfaces.length === 0) return {
    completed: false,
    providerUnavailable: false,
    diagnostic: "No Product Surfaces declared",
    batches: [],
    evidenceBatches: [],
  };
  if (v3Contract && surfaces.length !== v3Contract.generationTargets.targets.length) {
    return {
      completed: false,
      providerUnavailable: false,
      diagnostic: "V3 ProductSpec surfaces do not exactly match the legacy design projection",
      batches: [],
      evidenceBatches: [],
    };
  }
  const retryAttempts = boundedIntEnv("SETFARM_STITCH_BATCH_RETRY_ATTEMPTS", 3, 1, 5);
  const retryBaseDelayMs = boundedIntEnv("SETFARM_STITCH_BATCH_RETRY_BASE_DELAY_MS", 45000, 5000, 180000);
  const scriptRetryAttempts = boundedIntEnv("SETFARM_STITCH_SCRIPT_RETRY_ATTEMPTS", 1, 1, 3);
  const stageSize = boundedIntEnv("SETFARM_STITCH_BATCH_STAGE_SIZE", 5, 1, 5);
  const stages: ProductSurface[][] = [];
  for (let index = 0; index < surfaces.length; index += stageSize) {
    stages.push(surfaces.slice(index, index + stageSize));
  }
  let providerUnavailable = false;
  let diagnostic = "";
  const batches: StitchBatchResponseV2[] = [];
  const evidenceBatches: StitchDirectBatchEvidenceV2[] = [];

  await recordPreClaimProgress(ctx, `Design preclaim: generating ${surfaces.length} Product Surfaces in ${stages.length} Stitch batch stage(s) of up to ${stageSize}`);
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    const stageSurfaces = stages[stageIndex];
    const stageLabel = `stage ${stageIndex + 1}/${stages.length} (${stageSurfaces.map((surface) => surface.surfaceId).join(", ")})`;
    const stageId = `stage-${String(stageIndex + 1).padStart(3, "0")}`;
    const stageTargetRefs = v3Contract
      ? stageSurfaces.map((surface) => v3Contract.generationTargets.targets.find((target) => target.surfaceRef === surface.surfaceId)?.targetId || "")
          .filter(Boolean)
      : [];
    const promptFile = path.join(stitchDir, ".generate-prompt.txt");
    fs.writeFileSync(
      promptFile,
      v3Contract
        ? buildV3BatchStitchPrompt(v3Contract.productSpec, v3Contract.generationTargets, stageTargetRefs, deviceType, uiLanguage, stageId)
        : buildBatchStitchPrompt(repo, prd, deviceType, uiLanguage, stageSurfaces, stageLabel),
      "utf-8",
    );
    await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch batch ${stageLabel}`);
    let stageCompleted = false;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const genOut = await execFileText("node", [stitchScript, "generate-all-screens", projId, promptFile, deviceType, "GEMINI_3_1_PRO"], {
          timeout: 660000,
          cwd: repo,
          env: {
            ...process.env,
            STITCH_GENERATE_ALL_RETRY_ATTEMPTS: String(scriptRetryAttempts),
          },
          onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still generating Stitch batch ${stageIndex + 1}/${stages.length} (attempt ${attempt}/${retryAttempts})`),
        });

        let genResult: any = {};
        try { genResult = JSON.parse(genOut); } catch {}
        const generatedTotal = Number(genResult.total || 0);
        logger.info(`[module:design preclaim] Generated ${generatedTotal} screen(s) in Stitch batch ${stageIndex + 1}/${stages.length} (attempt ${attempt}/${retryAttempts})`, { runId: ctx.runId });
        if (v3Contract) {
          const decoded = decodeStitchDirectBatchV2({ stageId, targetRefs: stageTargetRefs, result: genResult });
          if (decoded.evidenceBatch) evidenceBatches.push(decoded.evidenceBatch);
          if (decoded.status === "rejected") {
            diagnostic = decoded.diagnostic;
            return {
              completed: false,
              providerUnavailable: false,
              diagnostic,
              failureCode: decoded.code,
              batches,
              evidenceBatches,
            };
          }
          batches.push(decoded.batch);
        }
        if (generatedTotal === 0 && genResult.diagnostic) {
          const shape = JSON.stringify(genResult.diagnostic).slice(0, 260);
          const textSample = redactDiagnosticText(genResult.diagnostic.textSample).slice(0, 500);
          diagnostic = textSample || shape || diagnostic;
          providerUnavailable = providerUnavailable || isStitchProviderUnavailable(textSample || shape);
          writeDesignFailureReport(ctx, repo, {
            projectId: projId,
            phase: "generate_batch",
            operation: "stitch.generate_all_screens",
            attempt,
            maxAttempts: retryAttempts,
            stageIndex: stageIndex + 1,
            stageCount: stages.length,
            surfaceIds: stageSurfaces.map((surface) => surface.surfaceId),
            diagnostic: diagnostic || "Stitch generated 0 screens",
            screensGenerated: 0,
            htmlCount: countValidStitchHtml(stitchDir),
          });
          await recordPreClaimProgress(ctx, `Design preclaim: Stitch batch ${stageIndex + 1}/${stages.length} generated 0 screens on attempt ${attempt}/${retryAttempts}; response shape ${shape}`);
          if (providerUnavailable && attempt < retryAttempts) {
            const delayMs = retryBaseDelayMs * attempt;
            await recordPreClaimProgress(ctx, `Design preclaim: Stitch provider unavailable; retrying same batch stage in ${Math.round(delayMs / 1000)}s`);
            await sleep(delayMs);
            continue;
          }
          return { completed: false, providerUnavailable, diagnostic, batches, evidenceBatches };
        }
        await recordPreClaimProgress(ctx, `Design preclaim: Stitch batch ${stageIndex + 1}/${stages.length} generated ${generatedTotal} screen(s)`);
        stageCompleted = true;
        break;
      } catch (e) {
        if (isPreclaimCancelledError(e)) throw e;
        const failureDetail = redactDiagnosticText(e).slice(0, 500);
        diagnostic = failureDetail || diagnostic;
        providerUnavailable = providerUnavailable || isStitchProviderUnavailable(failureDetail);
        logger.warn(`[module:design preclaim] Stitch batch ${stageIndex + 1}/${stages.length} failed on attempt ${attempt}/${retryAttempts}: ${failureDetail.slice(0, 200)}`, { runId: ctx.runId });
        const report = writeDesignFailureReport(ctx, repo, {
          projectId: projId,
          phase: "generate_batch",
          operation: "stitch.generate_all_screens",
          attempt,
          maxAttempts: retryAttempts,
          stageIndex: stageIndex + 1,
          stageCount: stages.length,
          surfaceIds: stageSurfaces.map((surface) => surface.surfaceId),
          diagnostic: failureDetail || "unknown Stitch batch generation failure",
          screensGenerated: 0,
          htmlCount: countValidStitchHtml(stitchDir),
        });
        if (report) {
          await recordPreClaimProgress(ctx, `Design preclaim: failure classified as ${report.classification.category}/${report.classification.owner} (${report.classification.confidence})`);
        }
        await recordPreClaimProgress(ctx, `Design preclaim: Stitch batch ${stageIndex + 1}/${stages.length} failed on attempt ${attempt}/${retryAttempts}: ${failureDetail || "unknown error"}`);
        if (providerUnavailable && attempt < retryAttempts) {
          const delayMs = retryBaseDelayMs * attempt;
          await recordPreClaimProgress(ctx, `Design preclaim: Stitch provider unavailable; retrying same batch stage in ${Math.round(delayMs / 1000)}s`);
          await sleep(delayMs);
          continue;
        }
        return { completed: false, providerUnavailable, diagnostic, batches, evidenceBatches };
      }
    }
    if (!stageCompleted) return { completed: false, providerUnavailable, diagnostic, batches, evidenceBatches };
  }
  return { completed: true, providerUnavailable: false, diagnostic, batches, evidenceBatches };
}

function retitleTrackedStitchScreens(repo: string, projId: string, screenIds: string[], title: string): void {
  if (screenIds.length === 0) return;
  const trackingFile = path.join(repo, `.stitch-screens-${projId}.json`);
  try {
    const tracked = JSON.parse(fs.readFileSync(trackingFile, "utf-8"));
    if (!Array.isArray(tracked)) return;
    const ids = new Set(screenIds);
    let changed = false;
    for (const entry of tracked) {
      if (ids.has(String(entry?.screenId || entry?.id || ""))) {
        entry.title = title;
        entry.setfarmExpectedTitle = title;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(trackingFile, JSON.stringify(tracked, null, 2));
  } catch {}
}

function stitchScreenRecoveryBatchSize(): number {
  const raw = Number(process.env.SETFARM_STITCH_SCREEN_BATCH_SIZE || 5);
  if (!Number.isFinite(raw) || raw < 1) return 5;
  return Math.max(1, Math.min(5, Math.floor(raw)));
}

async function generateStitchScreensIndividually(
  ctx: ClaimContext,
  stitchScript: string,
  repo: string,
  stitchDir: string,
  projId: string,
  prd: string,
  deviceType: string,
  uiLanguage: string,
  targetsOverride?: ScreenMapEntry[],
  reason = "batch Stitch generation returned no HTML",
): Promise<number> {
  const targets = targetsOverride?.length ? targetsOverride : inferPrdScreens(prd);
  if (targets.length === 0) return 0;

  const batchSize = stitchScreenRecoveryBatchSize();
  await recordPreClaimProgress(ctx, `Design preclaim: ${reason}, generating ${targets.length} Stitch screen(s) in chunks of ${batchSize}`);
  let generated = 0;

  const generateOne = async (screen: ScreenMapEntry): Promise<void> => {
    const promptPath = path.join(stitchDir, `.screen-prompt-${screen.screenId}.txt`);
    fs.writeFileSync(promptPath, buildPerScreenStitchPrompt(prd, screen, uiLanguage), "utf-8");
    await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch screen "${screen.name}"`);
    const out = await execFileText(
      "node",
      [stitchScript, "generate-screen-safe", projId, `@${promptPath}`, screen.name, deviceType, "GEMINI_3_1_PRO"],
      {
        timeout: 360000,
        cwd: repo,
        onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still generating Stitch screen "${screen.name}"`),
      },
    );
    let parsed: any = {};
    try { parsed = JSON.parse(out); } catch {}
    const generatedScreens = Array.isArray(parsed?.screens) ? parsed.screens : [];
    const count = generatedScreens.length;
    retitleTrackedStitchScreens(
      repo,
      projId,
      generatedScreens.map((item: any) => String(item?.screenId || item?.id || "")).filter(Boolean),
      screen.name,
    );
    if (count > 0 || parsed?.skipped) generated++;
  };

  for (let index = 0; index < targets.length; index += batchSize) {
    const batch = targets.slice(index, index + batchSize);
    await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch recovery chunk ${Math.floor(index / batchSize) + 1}/${Math.ceil(targets.length / batchSize)}`);
    const results = await Promise.allSettled(batch.map((screen) => generateOne(screen)));
    for (let offset = 0; offset < results.length; offset++) {
      const result = results[offset];
      if (result.status !== "rejected") continue;
      const screen = batch[offset];
      if (isPreclaimCancelledError(result.reason)) throw result.reason;
      logger.warn(`[module:design preclaim] per-screen Stitch generation failed for ${screen.name}: ${String(result.reason).slice(0, 240)}`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch screen generation failed for "${screen.name}"`);
    }
    if (index + batchSize < targets.length) await new Promise(r => setTimeout(r, 2000));
  }

  if (generated > 0) {
    try {
      await recordPreClaimProgress(ctx, "Design preclaim: downloading individually generated Stitch screens");
      await execFileText("node", [stitchScript, "download-all", projId, stitchDir], {
        timeout: 180000,
        cwd: repo,
        onProgress: () => recordPreClaimProgress(ctx, "Design preclaim: still downloading individually generated Stitch screens"),
      });
    } catch (e) {
      if (isPreclaimCancelledError(e)) throw e;
      logger.warn(`[module:design preclaim] per-screen Stitch download failed: ${String(e).slice(0, 240)}`, { runId: ctx.runId });
    }
  }

  const htmlCount = countValidStitchHtml(stitchDir);
  await recordPreClaimProgress(ctx, `Design preclaim: per-screen Stitch generation produced ${htmlCount} valid HTML files`);
  return htmlCount;
}

async function downloadStitchDesignMarkdown(
  ctx: ClaimContext,
  stitchScript: string,
  repo: string,
  stitchDir: string,
  projId: string,
): Promise<void> {
  if (!projId || projId === "local-fallback") return;
  await recordPreClaimProgress(ctx, "Design preclaim: downloading Stitch DESIGN.md");
  let out = "";
  try {
    out = await execFileText("node", [stitchScript, "get-design-md", projId, stitchDir], {
      timeout: 45000,
      cwd: repo,
      onProgress: () => recordPreClaimProgress(ctx, "Design preclaim: still downloading Stitch DESIGN.md"),
    });
  } catch (e) {
    if (synthesizeDesignMarkdownFromStitchAssets(stitchDir, projId)) {
      await recordPreClaimProgress(ctx, "Design preclaim: recovered DESIGN.md from Stitch assets");
      return;
    }
    throw e;
  }
  let designMd = "";
  try {
    const parsed = JSON.parse(out);
    designMd = String(parsed?.designMd || "").trim();
  } catch {
    designMd = "";
  }
  const designPath = path.join(stitchDir, "DESIGN.md");
  if (!designMd || !fs.existsSync(designPath) || fs.statSync(designPath).size < 500) {
    if (synthesizeDesignMarkdownFromStitchAssets(stitchDir, projId)) {
      await recordPreClaimProgress(ctx, "Design preclaim: recovered DESIGN.md from Stitch assets");
      return;
    }
    throw new Error("DESIGN_STITCH_DESIGN_MD_UNAVAILABLE: Stitch get-design-md did not produce stitch/DESIGN.md.");
  }
}

function toScreenId(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

export function inferPrdScreens(prd: string): ScreenMapEntry[] {
  const surfaces = parseProductSurfaces(prd);
  const screenNames = surfaces.length > 0
    ? surfaces.map((surface) => surface.name)
    : ["Product Workspace"];
  const used = new Set<string>();
  return screenNames.map((name, index) => {
    const base = "prd-" + toScreenId(name, `screen-${index + 1}`);
    let screenId = base;
    let suffix = 2;
    while (used.has(screenId)) screenId = `${base}-${suffix++}`;
    used.add(screenId);
    return {
      screenId,
      name,
      type: classifyScreenType(name),
      description: surfaces[index]?.purpose || `${name} Product Surface from the PRD contract`,
      surfaceIds: surfaces[index] ? [surfaces[index].surfaceId] : [],
    };
  });
}

function screenTargetsForSurfaces(surfaces: ProductSurface[]): ScreenMapEntry[] {
  const used = new Set<string>();
  return surfaces.map((surface, index) => {
    const base = "prd-" + toScreenId(surface.name, `surface-${index + 1}`);
    let screenId = base;
    let suffix = 2;
    while (used.has(screenId)) screenId = `${base}-${suffix++}`;
    used.add(screenId);
    return {
      screenId,
      name: surface.name,
      type: classifyScreenType(surface.name),
      description: surface.purpose || `${surface.name} Product Surface from the PRD contract`,
      surfaceIds: [surface.surfaceId],
    };
  });
}

function readScreenMapFromStitchArtifacts(stitchDir: string, deviceType: string, runId?: string): ScreenMapEntry[] {
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  let screenMap: ScreenMapEntry[] = [];
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (Array.isArray(manifest)) {
        screenMap = manifest
          .filter((s: any) => !isPrdPseudoScreen(s))
          .filter((s: any) => s?.screenId && s?.title)
          .map((s: any) => ({
            screenId: String(s.screenId),
            name: String(s.title),
            type: classifyScreenType(String(s.title)),
            description: String(s.title) + " screen",
          }));
      }
    } catch (e) {
      logger.warn(`[module:design preclaim] manifest parse failed: ${String(e).slice(0, 200)}`, { runId });
    }
  }

  if (screenMap.length === 0 && fs.existsSync(stitchDir)) {
    try {
      const htmlFiles = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html") && !f.startsWith(".") && isValidStitchHtml(path.join(stitchDir, f)));
      for (const file of htmlFiles) {
        const screenId = file.replace(/\.html$/, "");
        let title = screenId;
        try {
          const html = fs.readFileSync(path.join(stitchDir, file), "utf-8").slice(0, 4000);
          const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (m) title = m[1].trim();
        } catch {}
        if (/^prd(?:\b|[:\s-])/i.test(title)) continue;
        screenMap.push({
          screenId,
          name: title || screenId,
          type: classifyScreenType(title),
          description: title + " screen",
        });
      }
      if (screenMap.length > 0) {
        try {
          fs.writeFileSync(manifestPath, JSON.stringify(
            screenMap.map(s => ({ screenId: s.screenId, title: s.name, htmlFile: s.screenId + ".html", deviceType })),
            null, 2
          ));
          logger.info(`[module:design preclaim] manifest synthesized from ${screenMap.length} HTML files`, { runId });
        } catch (e) {
          logger.warn(`[module:design preclaim] manifest synthesize failed: ${String(e).slice(0, 200)}`, { runId });
        }
      }
    } catch (e) {
      logger.warn(`[module:design preclaim] HTML fallback failed: ${String(e).slice(0, 200)}`, { runId });
    }
  }
  return screenMap;
}

// Heavy work BEFORE agent claims the design step:
// 1. ensure-project (Stitch project for this repo)
// 2. write PRD as Stitch prompt
// 3. generate-all-screens (one Stitch API call for entire screen set)
// 4. download-all (3 retries + tracking-file fallback)
// Agent then validates the result — never calls Stitch API itself.
//
// Idempotent: if stitch/ already has current non-fallback HTML files plus
// Stitch DESIGN.md, skips. If Stitch cannot produce the required assets, the
// design step fails instead of generating local placeholder design files.
export async function preClaim(ctx: ClaimContext): Promise<PreClaimResult> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  const prd = ctx.context["prd"] || ctx.context["PRD"] || "";
  const stitchDir = repo ? path.join(repo, "stitch") : "";
  if (!repo || !prd || !stitchDir) return;
  const protocol = ctx.claimEnvelope?.protocol
    ?? (await pgGet<{ protocol: "legacy" | "shadow" | "v3" }>(
      "SELECT protocol FROM runs WHERE id = $1",
      [ctx.runId],
    ))?.protocol
    ?? "legacy";
  let englishAdmissionAuthority: CompilerEnglishAdmissionLedgerAuthorityV1 | undefined;
  let englishAdmissionReceipt: CompilerEnglishAdmissionReceiptV1 | undefined;
  if (protocol === "v3") {
    try {
      englishAdmissionAuthority = await loadCompilerEnglishAdmissionLedgerAuthorityV1(
        getSql(),
        { runId: ctx.runId },
      );
      englishAdmissionReceipt = inspectCompilerEnglishAdmissionLedgerAuthorityV1(
        englishAdmissionAuthority,
      );
      const currentPrdHash = crypto.createHash("sha256").update(prd, "utf8").digest("hex");
      if (englishAdmissionReceipt.runId !== ctx.runId
        || englishAdmissionReceipt.prdHash !== currentPrdHash
        || englishAdmissionReceipt.productSpecSchema !== ctx.context["product_spec_schema"]
        || englishAdmissionReceipt.sourceTaskHash !== ctx.context["product_spec_source_task_hash"]) {
        throw new Error("DESIGN_ENGLISH_ADMISSION_CONTEXT_BINDING_MISMATCH");
      }
    } catch (error) {
      await failDesignPreclaim(
        ctx,
        `DESIGN_ENGLISH_ADMISSION_REQUIRED: ${redactDiagnosticText(error).slice(0, 850)}`,
        { terminal: true },
      );
      return;
    }
  }
  if (protocol === "v3" && ctx.context["product_semantics_version"] !== "v2") {
    await failDesignPreclaim(
      ctx,
      "DESIGN_V2_PRODUCT_SEMANTICS_REQUIRED: New v3 DESIGN claims require Product Semantics v2 before bypass or provider dispatch.",
      { terminal: true },
    );
    return;
  }
  const designRequired = String(ctx.context["design_required"] || ctx.context["DESIGN_REQUIRED"] || "true").toLowerCase() !== "false";
  if (!designRequired) {
    const stepRow = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
    if (!stepRow?.id) return;
    // A non-visual delivery must not leak a stale or speculative Stitch join
    // into downstream context. The canonical authority is the empty map.
    delete ctx.context["generation_targets"];
    delete ctx.context["stitch_candidate_selection"];
    delete ctx.context["stitch_response_bindings"];
    ctx.context["screen_map"] = "[]";
    ctx.context["screens_generated"] = "0";
    ctx.context["design_system"] = "{}";
    const completionOutput = [
      "STATUS: done",
      "DESIGN_REQUIRED: false",
      "DEVICE_TYPE: NONE",
      "DESIGN_SYSTEM: {}",
      "SCREEN_MAP: []",
      "SCREENS_GENERATED: 0",
      "AUTO_COMPLETED: design-bypass (DESIGN_REQUIRED=false)",
    ].join("\n");
    if (protocol === "v3") {
      logger.info("[module:design preclaim] PREPARED compiler-owned design bypass (DESIGN_REQUIRED=false)", { runId: ctx.runId });
      return Object.freeze({
        disposition: "compiler_completion" as const,
        output: completionOutput,
      });
    }
    const { completeStep } = await import("../../step-ops.js");
    await completeStep(stepRow.id, completionOutput, ctx.claimEnvelope);
    logger.info("[module:design preclaim] AUTO-COMPLETED design bypass (DESIGN_REQUIRED=false)", { runId: ctx.runId });
    return;
  }
  if (protocol === "v3" && ctx.context["product_semantics_version"] === "v2") {
    if (!englishAdmissionAuthority) {
      await failDesignPreclaim(ctx, "DESIGN_V2_ENGLISH_ADMISSION_REQUIRED", { terminal: true });
      return;
    }
    const envelope = ctx.claimEnvelope;
    if (!envelope || envelope.protocol !== "v3") {
      await failDesignPreclaim(ctx, "DESIGN_V2_CLAIM_AUTHORITY_REQUIRED", { terminal: true });
      return;
    }
    const run = await pgGet<{ compiler_release_sha: string | null }>(
      "SELECT compiler_release_sha FROM runs WHERE id = $1 LIMIT 1",
      [ctx.runId],
    );
    const releaseSha = String(run?.compiler_release_sha || "");
    if (!/^[a-f0-9]{40}$/.test(releaseSha)) {
      await failDesignPreclaim(ctx, "DESIGN_V2_COMPILER_RELEASE_SHA_REQUIRED", { terminal: true });
      return;
    }
    const originClaim = await pgGet<{ id: string }>(
      `SELECT id::text AS id
         FROM claim_log
        WHERE run_id = $1
          AND step_id = $2
          AND story_id IS NULL
          AND id <= $3
        ORDER BY id ASC
        LIMIT 1`,
      [ctx.runId, envelope.workflowStepId, envelope.claimId],
    );
    const originClaimId = Number(originClaim?.id);
    if (!Number.isSafeInteger(originClaimId) || originClaimId <= 0) {
      await failDesignPreclaim(ctx, "DESIGN_V2_ORIGIN_CLAIM_REQUIRED", { terminal: true });
      return;
    }
    const requestedDeviceType = String(ctx.context["device_type"] || "DESKTOP").toUpperCase();
    const deviceType = requestedDeviceType === "MOBILE" || requestedDeviceType === "TABLET"
      ? requestedDeviceType
      : "DESKTOP";
    try {
      await recordPreClaimProgress(ctx, "Design preclaim v2: compiling exact ProductSpec/Stitch authority");
      const result = await executeDesignPreclaimV2({
        sql: getSql(),
        repo,
        runId: ctx.runId,
        prd,
        originClaimId,
        ownerClaimId: envelope.claimId,
        ownerInstanceId: `${envelope.runtimeAgentId}:${envelope.claimId}:${process.pid}`,
        producerReleaseSha: releaseSha,
        deviceType,
        englishAdmissionAuthority,
      });
      if (result.status !== "accepted") {
        ctx.context["design_source_attempt_id"] = result.attemptId || "";
        ctx.context["design_source_failure_code"] = result.code;
        await failDesignPreclaim(ctx, result.diagnostic, {
          terminal: true,
          operationalFailureCause: result.operationalFailureCause,
        });
        return;
      }
      Object.assign(ctx.context, result.context);
      const stepRow = await pgGet<{ id: string }>(
        "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
        [ctx.runId, ctx.stepId],
      );
      if (!stepRow?.id) throw new Error("DESIGN_V2_STEP_ID_REQUIRED");
      await recordPreClaimProgress(
        ctx,
        `Design preclaim v2: ${result.replayed ? "replayed" : "accepted"} ${result.screenMap.length} exact screen authority item(s)`,
      );
      logger.info(
        `[module:design preclaim] PREPARED compiler-owned v2 authority ${result.attemptId} (${result.screenMap.length} screens)`,
        { runId: ctx.runId, stepId: stepRow.id },
      );
      return Object.freeze({
        disposition: "compiler_completion" as const,
        output: result.completionOutput,
      });
    } catch (error) {
      if (isPreclaimCancelledError(error)) return;
      await failDesignPreclaim(
        ctx,
        `DESIGN_V2_RUNTIME_FAILED: ${redactDiagnosticText(error).slice(0, 850)}`,
        { terminal: true },
      );
    }
    return;
  }
  let v3Contract: V3DesignContract | undefined;
  if (protocol === "v3") {
    try {
      v3Contract = prepareV3DesignContract(
        prd,
        stitchDir,
        englishAdmissionReceipt?.productSpecHash,
      );
      ctx.context["generation_targets"] = canonicalJsonStringify(v3Contract.generationTargets);
    } catch (error) {
      await failDesignPreclaim(ctx, String((error as Error)?.message || error), { terminal: true });
      return;
    }
  }
  const declaredSurfaces = parseProductSurfaces(prd);
  if (declaredSurfaces.length === 0) {
    await failDesignPreclaim(ctx, "DESIGN_SURFACE_MISMATCH: DESIGN_REQUIRED=true but PRD has no Product Surfaces to send to Stitch.", { terminal: true });
    return;
  }
  const hasStitchKey = stitchApiKeyAvailable();
  const previousAssetError = String(ctx.context["design_asset_error"] || "");
  const resetFailedStitchProject = hasStitchKey && /DESIGN_STITCH|0\s+(?:valid\s+)?(?:HTML|Stitch screens)|download failed/i.test(previousAssetError);

  if (resetFailedStitchProject) {
    await recordPreClaimProgress(ctx, "Design preclaim: resetting empty Stitch project after previous generation failure");
    try {
      fs.rmSync(stitchDir, { recursive: true, force: true });
      fs.rmSync(path.join(repo, ".stitch"), { force: true });
      for (const file of fs.readdirSync(repo).filter((name) => /^\.stitch-screens-.*\.json$/.test(name))) {
        fs.rmSync(path.join(repo, file), { force: true });
      }
      ctx.context["design_asset_error"] = "";
      ctx.context["screens_generated"] = "0";
      ctx.context["stitch_project_id"] = "";
      ctx.context["STITCH_PROJECT_ID"] = "";
      fs.mkdirSync(stitchDir, { recursive: true });
    } catch (e) {
      logger.warn(`[module:design preclaim] failed Stitch project reset failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }

  const existingHtml = fs.existsSync(stitchDir)
    ? fs.readdirSync(stitchDir).filter(f => f.endsWith(".html")).length
    : 0;
  const existingCounts = manifestHtmlCounts(stitchDir);
  let recoverDesignMdOnly = false;
  const staleFallbackDesign = existingHtml > 0 && manifestUsesLocalFallback(stitchDir) && hasStitchKey;
  if (staleFallbackDesign) {
    logger.warn(`[module:design preclaim] Existing local-fallback Stitch assets found while STITCH_API_KEY is available; regenerating real design assets`, { runId: ctx.runId });
    await recordPreClaimProgress(ctx, "Design preclaim: invalidating stale local fallback assets before real Stitch generation");
    try {
      fs.rmSync(stitchDir, { recursive: true, force: true });
      fs.mkdirSync(stitchDir, { recursive: true });
    } catch (e) {
      logger.warn(`[module:design preclaim] stale fallback cleanup failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  } else if (existingHtml > 0 && existingCounts.valid > 0 && (existingCounts.total === 0 || existingCounts.valid >= existingCounts.total)) {
    if (v3Contract) {
      const bindings = readExactV3Bindings(stitchDir);
      const selection = readExactV3CandidateSelection(stitchDir);
      if (!bindings || !selection) {
        await failDesignPreclaim(ctx, "DESIGN_V3_RESPONSE_BINDINGS_MISSING: cached Stitch HTML requires exact candidate selection and v2 bindings; manifest prose or title similarity cannot rebind it.", { terminal: true });
        return;
      }
      try {
        await verifyExactV3SelectionAuthority(v3Contract, selection, bindings, stitchDir);
        const exactScreenMap = exactV3ScreenMap(v3Contract, bindings, stitchDir);
        rewriteScreenArtifactsForScreenMap(stitchDir, exactScreenMap, ctx.context["device_type"] || "DESKTOP");
        ctx.context["stitch_candidate_selection"] = canonicalJsonStringify(selection);
        ctx.context["stitch_response_bindings"] = canonicalJsonStringify(bindings);
        ctx.context["screen_map"] = JSON.stringify(exactScreenMap);
        if (hasValidStitchDesignMarkdown(stitchDir)) {
          logger.info(`[module:design preclaim] V3 skip — ${exactScreenMap.length} exact target/response bindings are complete`, { runId: ctx.runId });
          return;
        }
        recoverDesignMdOnly = true;
      } catch (error) {
        await failDesignPreclaim(ctx, String((error as Error)?.message || error), { terminal: true });
        return;
      }
    } else {
    const cachedScreenMap = readScreenMapFromStitchArtifacts(stitchDir, ctx.context["device_type"] || "DESKTOP", ctx.runId);
    const cachedReconciliation = verifyScreenMapToSurfaces(cachedScreenMap, prd, { stitchDir });
    if (hasValidStitchDesignMarkdown(stitchDir)) {
      if (cachedReconciliation.screenMap.length > 0 && cachedReconciliation.missing.length === 0) {
        rewriteScreenArtifactsForScreenMap(stitchDir, cachedReconciliation.screenMap, ctx.context["device_type"] || "DESKTOP");
        ctx.context["screen_map"] = JSON.stringify(cachedReconciliation.screenMap);
        logger.info(`[module:design preclaim] Skip — ${existingCounts.valid}/${existingCounts.total || existingCounts.valid} valid HTML and DESIGN.md already in ${stitchDir}`, { runId: ctx.runId });
        return;
      }
      await recordPreClaimProgress(ctx, `Design preclaim: cached Stitch assets missing Product Surface coverage (${cachedReconciliation.missing.slice(0, 5).join(", ")}), regenerating`);
      logger.warn(`[module:design preclaim] cached Stitch assets missing Product Surface coverage; regenerating`, { runId: ctx.runId });
    } else {
      recoverDesignMdOnly = cachedReconciliation.screenMap.length > 0 && cachedReconciliation.missing.length === 0;
      if (recoverDesignMdOnly) {
        logger.info(`[module:design preclaim] ${existingCounts.valid}/${existingCounts.total || existingCounts.valid} valid HTML already in ${stitchDir}; recovering Stitch DESIGN.md`, { runId: ctx.runId });
      } else {
        await recordPreClaimProgress(ctx, `Design preclaim: cached Stitch HTML missing Product Surface coverage (${cachedReconciliation.missing.slice(0, 5).join(", ")}), regenerating`);
        logger.warn(`[module:design preclaim] cached Stitch HTML missing Product Surface coverage; regenerating`, { runId: ctx.runId });
      }
    }
    }
  } else if (existingHtml > 0) {
    logger.warn(`[module:design preclaim] Existing stitch HTML incomplete/invalid (${existingCounts.valid}/${existingCounts.total || existingHtml} valid), regenerating`, { runId: ctx.runId });
    try {
      for (const file of fs.readdirSync(stitchDir).filter(f => f.endsWith(".html"))) {
        const htmlPath = path.join(stitchDir, file);
        if (!isValidStitchHtml(htmlPath)) fs.rmSync(htmlPath, { force: true });
      }
    } catch {}
  }

  const stitchScript = resolvePlatformScript("stitch-api.mjs");
  fs.mkdirSync(stitchDir, { recursive: true });

  // 1. Ensure Stitch project (idempotent — reads .stitch if present)
  let projId = "";
  try {
    const dotStitch = path.join(repo, ".stitch");
    if (fs.existsSync(dotStitch)) {
      projId = JSON.parse(fs.readFileSync(dotStitch, "utf-8")).projectId || "";
    }
  } catch (e) { logger.debug(`[module:design preclaim] dotStitch read: ${String(e).slice(0, 80)}`); }

  if (!projId) {
    const ensureAttempts = Math.max(1, Math.min(5, Number(process.env.SETFARM_STITCH_PROJECT_RETRY_ATTEMPTS || 3) || 3));
    let ensureDiagnostic = "";
    try {
      const ensureEnv = resetFailedStitchProject
        ? { ...process.env, STITCH_FORCE_NEW_PROJECT: "1" }
        : process.env;
      for (let attempt = 0; attempt < ensureAttempts && !projId; attempt++) {
        await recordPreClaimProgress(ctx, `Design preclaim: ensuring Stitch project (attempt ${attempt + 1}/${ensureAttempts})`);
        try {
          const out = await execFileText("node", [stitchScript, "ensure-project", path.basename(repo), repo],
            { timeout: 60000, cwd: repo, env: ensureEnv, onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still ensuring Stitch project (attempt ${attempt + 1}/${ensureAttempts})`) });
          try { projId = JSON.parse(out).projectId || ""; } catch (e) { logger.debug(`[module:design preclaim] parse: ${String(e).slice(0, 80)}`); }
          if (projId) break;
          ensureDiagnostic = "ensure-project returned no projectId";
        } catch (e) {
          if (isPreclaimCancelledError(e)) return;
          ensureDiagnostic = redactDiagnosticText(e).slice(0, 500) || "unknown ensure-project error";
          logger.warn(`[module:design preclaim] ensure-project failed (attempt ${attempt + 1}/${ensureAttempts}): ${ensureDiagnostic.slice(0, 200)}`, { runId: ctx.runId });
          const report = writeDesignFailureReport(ctx, repo, {
            projectId: projId,
            phase: "ensure_project",
            operation: "stitch.ensure_project",
            attempt: attempt + 1,
            maxAttempts: ensureAttempts,
            diagnostic: ensureDiagnostic,
            screensGenerated: 0,
            htmlCount: countValidStitchHtml(stitchDir),
          });
          if (report) {
            await recordPreClaimProgress(ctx, `Design preclaim: failure classified as ${report.classification.category}/${report.classification.owner} (${report.classification.confidence})`);
          }
          await recordPreClaimProgress(ctx, `Design preclaim: Stitch project ensure failed on attempt ${attempt + 1}/${ensureAttempts}: ${ensureDiagnostic}`);
        }
        if (!projId && attempt < ensureAttempts - 1) {
          const delayMs = Math.min(30000, 10000 * (attempt + 1));
          await recordPreClaimProgress(ctx, `Design preclaim: waiting ${Math.round(delayMs / 1000)}s before retrying Stitch project ensure`);
          await sleep(delayMs);
        }
      }
      if (!projId && ensureDiagnostic) {
        ctx.context["stitch_project_diagnostic"] = ensureDiagnostic;
      }
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      logger.warn(`[module:design preclaim] ensure-project failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }

  if (!projId) {
    if (hasStitchKey) {
      const diagnostic = String(ctx.context["stitch_project_diagnostic"] || "").trim();
      const suffix = diagnostic ? ` Last Stitch diagnostic: ${diagnostic.slice(0, 650)}` : "";
      const error = `DESIGN_STITCH_PROJECT_UNAVAILABLE: STITCH_API_KEY is configured but Setfarm could not create or load a Stitch project after retries.${suffix}`;
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      writeDesignFailureReport(ctx, repo, {
        projectId: projId,
        phase: "ensure_project",
        operation: "stitch.ensure_project",
        diagnostic: error,
        screensGenerated: 0,
        htmlCount: countValidStitchHtml(stitchDir),
      });
      await failDesignPreclaim(ctx, error, { terminal: true });
      return;
    }
    const error = "DESIGN_STITCH_API_KEY_REQUIRED: Stitch design generation requires STITCH_API_KEY; local fallback design generation is disabled.";
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    writeDesignFailureReport(ctx, repo, {
      projectId: projId,
      phase: "configuration",
      operation: "setfarm.require_stitch_api_key",
      diagnostic: error,
      screensGenerated: 0,
      htmlCount: countValidStitchHtml(stitchDir),
    });
    await failDesignPreclaim(ctx, error, { terminal: true });
    return;
  }

  ctx.context["stitch_project_id"] = projId;

  if (recoverDesignMdOnly) {
    try {
      await downloadStitchDesignMarkdown(ctx, stitchScript, repo, stitchDir, projId);
      return;
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      const error = redactDiagnosticText(e).slice(0, 500);
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      writeDesignFailureReport(ctx, repo, {
        projectId: projId,
        phase: "design_markdown",
        operation: "stitch.get_design_md",
        diagnostic: error || "DESIGN_STITCH_DESIGN_MD_UNAVAILABLE",
        screensGenerated: Number(ctx.context["screens_generated"] || 0),
        htmlCount: countValidStitchHtml(stitchDir),
      });
      await failDesignPreclaim(ctx, error || "DESIGN_STITCH_DESIGN_MD_UNAVAILABLE", { terminal: true });
      return;
    }
  }

  // 2. Write one explicit batch prompt. The prompt lists every Product Surface
  // as a separate SCREEN_SPEC so Stitch generates the whole design set in one
  // call without falling back to per-screen generation.
  const promptFile = path.join(stitchDir, ".generate-prompt.txt");
  const designBriefPath = path.join(stitchDir, "DESIGN_BRIEF.md");
  const deviceType = ctx.context["device_type"] || "DESKTOP";
  const uiLanguage = ctx.context["ui_language"] || ctx.context["UI_LANGUAGE"] || "English";
  const designBrief = v3Contract
    ? buildV3BatchStitchPrompt(
        v3Contract.productSpec,
        v3Contract.generationTargets,
        v3Contract.generationTargets.targets.map((target) => target.targetId),
        deviceType,
        uiLanguage,
        "all-targets-preview",
      )
    : buildBatchStitchPrompt(repo, prd, deviceType, uiLanguage);
  fs.writeFileSync(designBriefPath, designBrief, "utf-8");
  fs.writeFileSync(promptFile, designBrief, "utf-8");
  logger.info(`[module:design preclaim] Generating screens (project ${projId}, device ${deviceType})`, { runId: ctx.runId });
  await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch screens for ${deviceType}`);

  // 3. generate-all-screens (single Stitch batch call for every Product Surface).
  let batchGenerationCompleted = false;
  let lastStitchDiagnostic = "";
  let stitchProviderUnavailable = false;
  let v3BoundScreenIds: string[] = [];
  if (v3Contract) {
    fs.rmSync(path.join(stitchDir, "STITCH_DIRECT_RESPONSE_EVIDENCE.json"), { force: true });
    fs.rmSync(path.join(stitchDir, "STITCH_RENDERED_SEMANTICS.json"), { force: true });
    fs.rmSync(path.join(stitchDir, "STITCH_TARGET_CANDIDATE_SELECTION.json"), { force: true });
    fs.rmSync(path.join(stitchDir, "STITCH_RESPONSE_BINDINGS.json"), { force: true });
    fs.rmSync(path.join(stitchDir, "candidates"), { recursive: true, force: true });
    fs.rmSync(path.join(stitchDir, "rendered-dom"), { recursive: true, force: true });
    fs.rmSync(path.join(stitchDir, "render-resources"), { recursive: true, force: true });
    for (const file of fs.readdirSync(stitchDir).filter((name) => /\.(?:html|png)$/i.test(name))) {
      fs.rmSync(path.join(stitchDir, file), { force: true });
    }
  }
  try {
    const batchResult = await generateStitchScreensInSingleBatch(ctx, stitchScript, repo, stitchDir, projId, prd, deviceType, uiLanguage, v3Contract);
    batchGenerationCompleted = batchResult.completed;
    stitchProviderUnavailable = batchResult.providerUnavailable;
    lastStitchDiagnostic = batchResult.diagnostic || lastStitchDiagnostic;
    if (v3Contract) {
      let directEvidence: StitchDirectResponseEvidenceV2 | undefined;
      if (batchResult.evidenceBatches.length > 0) {
        const directEvidenceResult = StitchDirectResponseEvidenceV2Schema.safeParse({
          schema: "setfarm.stitch-direct-response-evidence.v2",
          projectId: projId,
          batches: batchResult.evidenceBatches,
        });
        if (!directEvidenceResult.success) {
          throw new V3DesignBoundaryError(
            "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID",
            directEvidenceResult.error.issues[0]?.message || "canonical evidence artifact rejected",
          );
        }
        directEvidence = directEvidenceResult.data;
        writeCanonicalJson(path.join(stitchDir, "STITCH_DIRECT_RESPONSE_EVIDENCE.json"), directEvidence);
      }
      if (!batchResult.completed) {
        throw new V3DesignBoundaryError(
          batchResult.failureCode || "DESIGN_V3_DIRECT_BATCH_INCOMPLETE",
          batchResult.diagnostic || "direct Stitch batch did not complete",
        );
      }
      if (!directEvidence) {
        throw new V3DesignBoundaryError(
          "DESIGN_V3_DIRECT_RESPONSE_EVIDENCE_INVALID",
          "completed direct batch produced no canonical response evidence",
        );
      }
      const candidateArtifacts = readCandidateArtifactBytes(stitchDir, directEvidence);
      let renderedSemantics: Awaited<ReturnType<typeof captureStitchRenderedSemanticsV1>>;
      try {
        renderedSemantics = await captureStitchRenderedSemanticsV1({
          generationTargets: v3Contract.generationTargets,
          directResponseEvidence: directEvidence,
          artifacts: candidateArtifacts,
          deviceType,
        });
        await writeStitchRenderedSemanticsV1(repo, renderedSemantics);
      } catch (error) {
        if (error instanceof StitchRenderedSemanticsInfrastructureError) {
          throw new V3DesignBoundaryError(
            "DESIGN_V3_RENDERED_SEMANTICS_INFRASTRUCTURE_UNAVAILABLE",
            `${error.code}:${error.message}`,
          );
        }
        throw error;
      }
      const selected = selectStitchTargetCandidatesV1({
        generationTargets: v3Contract.generationTargets,
        directResponseEvidence: directEvidence,
        renderedSemantics: renderedSemantics.artifact,
        artifacts: candidateArtifacts,
        authorityMode: "clean_v3",
      });
      if (selected.candidateSelection) {
        writeCanonicalJson(
          path.join(stitchDir, "STITCH_TARGET_CANDIDATE_SELECTION.json"),
          selected.candidateSelection,
        );
        ctx.context["stitch_candidate_selection"] = canonicalJsonStringify(selected.candidateSelection);
      }
      if (selected.status !== "produced") {
        if (selected.candidateSelection) {
          materializeSelectedCandidateProjection(stitchDir, selected.candidateSelection, false);
        }
        const evidence = selected.diagnostics.map((item) => `${item.code}:${item.reference || "candidate"}`).join(", ");
        throw new V3DesignBoundaryError(
          candidateSelectionBoundaryCode(selected),
          evidence,
        );
      }
      const bound = bindStitchTargetCandidateSelectionsV2({
        generationTargets: v3Contract.generationTargets,
        candidateSelection: selected.candidateSelection,
      });
      if (bound.status !== "produced") {
        materializeSelectedCandidateProjection(stitchDir, selected.candidateSelection, false);
        const evidence = bound.diagnostics.map((item) => `${item.code}:${item.reference || "selection"}`).join(", ");
        throw new V3DesignBoundaryError(
          "DESIGN_V3_EXACT_RESPONSE_BINDING_REJECTED",
          evidence,
        );
      }
      materializeSelectedCandidateProjection(stitchDir, selected.candidateSelection, true);
      writeCanonicalJson(path.join(stitchDir, "STITCH_RESPONSE_BINDINGS.json"), bound.responseBindings);
      await verifyExactV3SelectionAuthority(v3Contract, selected.candidateSelection, bound.responseBindings, stitchDir);
      ctx.context["stitch_response_bindings"] = canonicalJsonStringify(bound.responseBindings);
      v3BoundScreenIds = bound.responseBindings.bindings.map((binding) => binding.responseScreenId);
    }
  } catch (e) {
    if (isPreclaimCancelledError(e)) return;
    const boundaryError = e instanceof V3DesignBoundaryError ? e : undefined;
    const failureDetail = redactDiagnosticText(e).slice(0, 500);
    lastStitchDiagnostic = failureDetail;
    stitchProviderUnavailable = isStitchProviderUnavailable(failureDetail);
    logger.warn(`[module:design preclaim] generate-all-screens failed: ${failureDetail.slice(0, 200)}`, { runId: ctx.runId });
    const report = writeDesignFailureReport(ctx, repo, {
      projectId: projId,
      phase: "generate_batch",
      operation: "stitch.generate_all_screens",
      diagnostic: failureDetail || "unknown Stitch generation failure",
      ...(boundaryError ? {
        failureCode: boundaryError.code,
        classification: boundaryError.classification,
      } : {}),
      screensGenerated: 0,
      htmlCount: countValidStitchHtml(stitchDir),
    });
    if (report) {
      await recordPreClaimProgress(ctx, `Design preclaim: failure classified as ${report.classification.category}/${report.classification.owner} (${report.classification.confidence})`);
    }
    if (stitchProviderUnavailable) {
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch provider unavailable during batch generation: ${failureDetail || "unknown error"}`);
    } else {
      await recordPreClaimProgress(ctx, `Design preclaim: batch Stitch generation failed: ${failureDetail || "unknown error"}; checking whether Stitch produced downloadable screens`);
    }
    if (v3Contract) {
      await failDesignPreclaim(ctx, failureDetail || "DESIGN_V3_DIRECT_BATCH_INCOMPLETE", { terminal: true });
      return;
    }
  }

  // 4. download-all with retries. When the batch call completed or returned an
  // ambiguous error, Stitch can still finish async work after a delay.
  let htmlCount = 0;
  if (v3Contract) {
    const missingBoundHtml = v3BoundScreenIds.filter((screenId) =>
      !isValidStitchHtml(path.join(stitchDir, `${screenId}.html`)));
    htmlCount = v3BoundScreenIds.length - missingBoundHtml.length;
    ctx.context["screens_generated"] = String(htmlCount);
    if (missingBoundHtml.length > 0) {
      const boundaryError = new V3DesignBoundaryError(
        "DESIGN_V3_RESPONSE_HTML_MISSING",
        `direct bound screens lack downloaded HTML (${missingBoundHtml.join(", ")})`,
      );
      writeDesignFailureReport(ctx, repo, {
        projectId: projId,
        phase: "direct_bound_html",
        operation: "setfarm.verify_direct_stitch_html",
        diagnostic: boundaryError.message,
        failureCode: boundaryError.code,
        classification: boundaryError.classification,
        screensGenerated: htmlCount,
        htmlCount,
      });
      await failDesignPreclaim(ctx, boundaryError.message, { terminal: true });
      return;
    }
  }
  const downloadAttempts = v3Contract ? 0 : (stitchProviderUnavailable ? 1 : (batchGenerationCompleted ? 3 : 1));
  for (let attempt = 0; attempt < downloadAttempts; attempt++) {
    try {
      await recordPreClaimProgress(ctx, `Design preclaim: downloading Stitch HTML files (attempt ${attempt + 1}/${downloadAttempts})`);
      const dlOut = await execFileText("node", [stitchScript, "download-all", projId, stitchDir],
        { timeout: 180000, cwd: repo, onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still downloading Stitch HTML files (attempt ${attempt + 1}/${downloadAttempts})`) });
      let dlResult: any = {};
      try { dlResult = JSON.parse(dlOut); } catch (e) { logger.debug(`[module:design preclaim] dl parse: ${String(e).slice(0, 80)}`); }
      const manifestCounts = manifestHtmlCounts(stitchDir);
      const total = manifestCounts.total || Number(dlResult.total || 0);
      htmlCount = manifestCounts.total ? manifestCounts.valid : countValidStitchHtml(stitchDir);
      logger.info(`[module:design preclaim] Downloaded ${dlResult.downloaded || 0}/${total || 0} (${htmlCount} valid HTML, attempt ${attempt + 1}/3)`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: downloaded ${htmlCount}/${total || htmlCount || 0} valid Stitch HTML files`);
      ctx.context["screens_generated"] = String(htmlCount);
      if (htmlCount > 0 && (!total || htmlCount >= total)) break;
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      const downloadDetail = redactDiagnosticText(e).slice(0, 300);
      logger.warn(`[module:design preclaim] download-all failed (attempt ${attempt + 1}/3): ${downloadDetail.slice(0, 200)}`, { runId: ctx.runId });
      lastStitchDiagnostic = downloadDetail || lastStitchDiagnostic;
      const report = writeDesignFailureReport(ctx, repo, {
        projectId: projId,
        phase: "download_all",
        operation: "stitch.download_all",
        attempt: attempt + 1,
        maxAttempts: downloadAttempts,
        diagnostic: downloadDetail || "unknown Stitch download failure",
        screensGenerated: Number(ctx.context["screens_generated"] || 0),
        htmlCount,
      });
      if (report) {
        await recordPreClaimProgress(ctx, `Design preclaim: failure classified as ${report.classification.category}/${report.classification.owner} (${report.classification.confidence})`);
      }
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch download failed on attempt ${attempt + 1}/${downloadAttempts}${downloadDetail ? `: ${downloadDetail}` : ""}`);
    }
    if (attempt < downloadAttempts - 1) {
      logger.info(`[module:design preclaim] HTML incomplete (${htmlCount} valid), waiting 30s before retry`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: waiting 30s before retry, ${htmlCount} valid HTML files so far`);
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  // 4b. Tracking-file fallback: direct curl from cached URLs if download-all returned 0
  if (!v3Contract && htmlCount === 0) {
    const trackFile = path.join(repo, ".stitch-screens-" + projId + ".json");
    if (fs.existsSync(trackFile)) {
      try {
        const tracked = JSON.parse(fs.readFileSync(trackFile, "utf-8"));
        logger.info(`[module:design preclaim] Tracking-file fallback: ${tracked.length} entries`, { runId: ctx.runId });
        await recordPreClaimProgress(ctx, `Design preclaim: using tracking-file fallback for ${tracked.length} Stitch screen entries`);
        for (const s of tracked) {
          if (!s.htmlUrl) continue;
          const dest = path.join(stitchDir, (s.screenId || "unknown") + ".html");
          if (fs.existsSync(dest) && isValidStitchHtml(dest)) continue;
          try {
            await execFileText("curl", ["-sL", "-o", dest, "--max-time", "30", s.htmlUrl], { timeout: 35000 });
            if (isValidStitchHtml(dest)) htmlCount++;
          } catch (e) { logger.debug(`[module:design preclaim] curl: ${String(e).slice(0, 80)}`); }
        }
        logger.info(`[module:design preclaim] Tracking fallback recovered ${htmlCount} HTML files`, { runId: ctx.runId });
        await recordPreClaimProgress(ctx, `Design preclaim: tracking fallback recovered ${htmlCount} HTML files`);
      } catch (e) {
        logger.warn(`[module:design preclaim] Tracking fallback failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
      }
    }
  }

  // 4c. Optional manual recovery path. Disabled by default: Setfarm's normal
  // design mode must stay whole-batch Stitch generation, not per-screen calls.
  if (!v3Contract && htmlCount === 0 && hasStitchKey && process.env.SETFARM_STITCH_PER_SCREEN_RECOVERY === "1") {
    try {
      htmlCount = await generateStitchScreensIndividually(ctx, stitchScript, repo, stitchDir, projId, prd, deviceType, uiLanguage);
      ctx.context["screens_generated"] = String(htmlCount);
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      logger.warn(`[module:design preclaim] per-screen Stitch recovery failed: ${String(e).slice(0, 240)}`, { runId: ctx.runId });
    }
  }

  if (htmlCount === 0 && hasStitchKey) {
    const suffix = lastStitchDiagnostic ? ` Last Stitch diagnostic: ${lastStitchDiagnostic.slice(0, 650)}` : "";
    const error = stitchProviderUnavailable
      ? `DESIGN_STITCH_SERVICE_UNAVAILABLE: STITCH_API_KEY is configured but the Stitch provider is temporarily unavailable.${suffix}`
      : `DESIGN_STITCH_HTML_UNAVAILABLE: STITCH_API_KEY is configured but Stitch produced 0 valid HTML screens after single batch generation, download, and tracking-file recovery.${suffix}`;
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    writeDesignFailureReport(ctx, repo, {
      projectId: projId,
      phase: "html_availability",
      operation: "setfarm.verify_stitch_html",
      diagnostic: error,
      screensGenerated: Number(ctx.context["screens_generated"] || 0),
      htmlCount,
    });
    await failDesignPreclaim(ctx, error, { terminal: stitchProviderUnavailable });
    return;
  }

  if (htmlCount === 0) {
    const error = "DESIGN_STITCH_API_KEY_REQUIRED: Stitch design generation requires STITCH_API_KEY; local fallback design generation is disabled.";
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    writeDesignFailureReport(ctx, repo, {
      projectId: projId,
      phase: "configuration",
      operation: "setfarm.require_stitch_api_key",
      diagnostic: error,
      screensGenerated: 0,
      htmlCount,
    });
    await failDesignPreclaim(ctx, error, { terminal: true });
    return;
  }

  if (htmlCount > 0 && hasStitchKey && projId && !manifestUsesLocalFallback(stitchDir)) {
    try {
      await downloadStitchDesignMarkdown(ctx, stitchScript, repo, stitchDir, projId);
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      const error = redactDiagnosticText(e).slice(0, 500);
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      writeDesignFailureReport(ctx, repo, {
        projectId: projId,
        phase: "design_markdown",
        operation: "stitch.get_design_md",
        diagnostic: error || "DESIGN_STITCH_DESIGN_MD_UNAVAILABLE",
        screensGenerated: Number(ctx.context["screens_generated"] || htmlCount),
        htmlCount,
      });
      await failDesignPreclaim(ctx, error || "DESIGN_STITCH_DESIGN_MD_UNAVAILABLE", { terminal: true });
      return;
    }
  }

  // 5. DESIGN_DOM.json extraction — element-level info for downstream context.
  //    Best-effort, non-blocking.
  try {
    const domScript = resolvePlatformScript("design-dom-extract.mjs");
    if (fs.existsSync(domScript)) {
      await recordPreClaimProgress(ctx, "Design preclaim: extracting DOM metadata from Stitch HTML");
      await execFileText("node", [domScript, stitchDir], { timeout: 30000 });
    }
  } catch (e) { logger.debug(`[module:design preclaim] design-dom-extract: ${String(e).slice(0, 80)}`); }

  // 6. AUTO-GENERATE SCREEN_MAP. Prefer DESIGN_MANIFEST.json (rich metadata);
  //    fall back to scanning stitch/*.html when manifest didn't make it (Stitch
  //    download-all sometimes returns HTML without writing manifest — observed
  //    in run #449). Either way the agent gets a populated SCREEN_MAP and only
  //    has to emit DESIGN_SYSTEM.
  let screenMap: ScreenMapEntry[] = [];
  if (v3Contract) {
    const bindings = readExactV3Bindings(stitchDir);
    const selection = readExactV3CandidateSelection(stitchDir);
    if (!bindings || !selection) {
      const error = "DESIGN_V3_RESPONSE_BINDINGS_MISSING: direct candidate selection and response identity were not sealed; manifest/title reconciliation is forbidden.";
      await failDesignPreclaim(ctx, error, { terminal: true });
      return;
    }
    try {
      await verifyExactV3SelectionAuthority(v3Contract, selection, bindings, stitchDir);
      screenMap = exactV3ScreenMap(v3Contract, bindings, stitchDir);
      rewriteScreenArtifactsForScreenMap(stitchDir, screenMap, deviceType);
      ctx.context["stitch_candidate_selection"] = canonicalJsonStringify(selection);
      ctx.context["stitch_response_bindings"] = canonicalJsonStringify(bindings);
      ctx.context["screen_map"] = JSON.stringify(screenMap);
      logger.info(`[module:design preclaim] V3 SCREEN_MAP injected from ${screenMap.length} exact target/response bindings`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: V3 exact SCREEN_MAP ready with ${screenMap.length} entries`);
    } catch (error) {
      await failDesignPreclaim(ctx, String((error as Error)?.message || error), { terminal: true });
      return;
    }
  } else {
    screenMap = readScreenMapFromStitchArtifacts(stitchDir, deviceType, ctx.runId);
  }
  if (!v3Contract && screenMap.length > 0) {
    let reconciliation = verifyScreenMapToSurfaces(screenMap, prd, { stitchDir });
    if (reconciliation.inlineCovered.length > 0) {
      await recordPreClaimProgress(ctx, `Design preclaim: inline-covered state surfaces (${reconciliation.inlineCovered.slice(0, 5).join("; ")})`);
    }
    if (reconciliation.missing.length > 0 && hasStitchKey && process.env.SETFARM_STITCH_TARGETED_SURFACE_RETRY === "1") {
      const retryTargets = screenTargetsForSurfaces(reconciliation.missingSurfaces);
      await recordPreClaimProgress(ctx, `Design preclaim: targeted retry for missing required Product Surfaces (${reconciliation.missing.slice(0, 5).join(", ")})`);
      try {
        await generateStitchScreensIndividually(
          ctx,
          stitchScript,
          repo,
          stitchDir,
          projId,
          prd,
          deviceType,
          uiLanguage,
          retryTargets,
          "Product Surface coverage mismatch",
        );
        screenMap = readScreenMapFromStitchArtifacts(stitchDir, deviceType, ctx.runId);
        reconciliation = verifyScreenMapToSurfaces(screenMap, prd, { stitchDir });
      } catch (e) {
        if (isPreclaimCancelledError(e)) return;
        logger.warn(`[module:design preclaim] targeted Product Surface retry failed: ${String(e).slice(0, 240)}`, { runId: ctx.runId });
      }
    }
    if (reconciliation.missing.length > 0 || reconciliation.screenMap.length === 0) {
      const detail = [
        reconciliation.missing.length ? `missing surfaces=${reconciliation.missing.slice(0, 8).join(", ")}` : "",
        reconciliation.unexpected.length ? `unexpected screens=${reconciliation.unexpected.slice(0, 8).join(", ")}` : "",
      ].filter(Boolean).join("; ");
      const error = `DESIGN_SURFACE_MISMATCH: Stitch output is missing required Product Surfaces after single batch generation. ${detail}. DESIGN must regenerate the whole scoped Stitch batch before stories/implementation.`;
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      writeDesignFailureReport(ctx, repo, {
        projectId: projId,
        phase: "surface_verify",
        operation: "setfarm.verify_product_surface_coverage",
        diagnostic: error,
        surfaceIds: reconciliation.missingSurfaces.map((surface) => surface.surfaceId),
        screensGenerated: screenMap.length,
        htmlCount: countValidStitchHtml(stitchDir),
      });
      await failDesignPreclaim(ctx, error);
      return;
    }
    if (reconciliation.screenMap.length !== screenMap.length || reconciliation.duplicates.length > 0 || reconciliation.unexpected.length > 0 || reconciliation.inlineCovered.length > 0) {
      const detail = [
        reconciliation.duplicates.length ? `duplicates=${[...new Set(reconciliation.duplicates)].slice(0, 8).join(",")}` : "",
        reconciliation.unexpected.length ? `dropped_unexpected=${[...new Set(reconciliation.unexpected)].slice(0, 8).join(",")}` : "",
        reconciliation.inlineCovered.length ? `inline_covered=${reconciliation.inlineCovered.length}` : "",
        `final=${reconciliation.screenMap.length}`,
      ].filter(Boolean).join(" ");
      ctx.context["design_reconciliation"] = detail;
      await recordPreClaimProgress(ctx, `Design preclaim: reconciled SCREEN_MAP to Product Surfaces (${detail})`);
      logger.warn(`[module:design preclaim] Reconciled SCREEN_MAP to Product Surfaces: ${detail}`, { runId: ctx.runId });
    }
    screenMap = reconciliation.screenMap;
    rewriteScreenArtifactsForScreenMap(stitchDir, screenMap, deviceType);
    ctx.context["screen_map"] = JSON.stringify(screenMap);
    logger.info(`[module:design preclaim] SCREEN_MAP injected (${screenMap.length} entries)`, { runId: ctx.runId });
    await recordPreClaimProgress(ctx, `Design preclaim: SCREEN_MAP ready with ${screenMap.length} entries`);
  } else if (screenMap.length === 0) {
    const error = "DESIGN_ASSET_GENERATION_FAILED: Stitch generation/download produced 0 valid HTML screens; SCREEN_MAP unavailable. Do not continue to implementation without design assets.";
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    writeDesignFailureReport(ctx, repo, {
      projectId: projId,
      phase: "screen_map",
      operation: "setfarm.read_screen_map_from_stitch_artifacts",
      diagnostic: error,
      screensGenerated: 0,
      htmlCount: countValidStitchHtml(stitchDir),
    });
    await failDesignPreclaim(ctx, error);
    return;
  }

  // Auto-complete (2026-04-24): if all required design assets are present,
  // skip agent turn entirely and complete step directly. Stitch preclaim
  // produced everything the downstream needs (SCREEN_MAP, DESIGN_DOM,
  // design-tokens, HTMLs). Agent only adds overhead + retry risk.
  // Guards: >=50% HTMLs present (PNG optional), DOM + manifest + tokens exist.
  try {
    const fs = await import("node:fs");
    const p = await import("node:path");
    const repoRaw = ctx.context["repo"] || "";
    const repo = repoRaw.replace(/^~/, process.env.HOME || "");
    if (!repo || screenMap.length === 0) return;
    const stitchDir = p.join(repo, "stitch");
    const domPath = p.join(stitchDir, "DESIGN_DOM.json");
    const tokensPath = p.join(stitchDir, "design-tokens.json");
    const manifestPath = p.join(stitchDir, "DESIGN_MANIFEST.json");
    if (!fs.existsSync(domPath) || !fs.existsSync(manifestPath)) return;
    if (fs.statSync(domPath).size < 50 || fs.statSync(manifestPath).size < 50) return;
    let manifest: any[];
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")); } catch { return; }
    if (!Array.isArray(manifest) || manifest.length === 0) return;
    manifest = manifest.filter((s: any) => !isPrdPseudoScreen(s));
    const allowedScreenIds = new Set(screenMap.map(s => s.screenId));
    manifest = manifest.filter((s: any) => allowedScreenIds.has(String(s?.screenId || s?.id || "")));
    if (manifest.length !== screenMap.length) {
      manifest = screenMap.map(s => ({ screenId: s.screenId, title: s.name, htmlFile: s.screenId + ".html", deviceType }));
      try { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); } catch {}
    }
    if (manifest.length === 0) return;
    let htmlOkCount = 0;
    for (const s of screenMap) {
      const sid = String(s?.screenId || "");
      if (!sid) continue;
      const htmlPath = p.join(stitchDir, sid + ".html");
      if (isValidStitchHtml(htmlPath)) htmlOkCount++;
    }
    if (htmlOkCount < screenMap.length) {
      logger.warn(`[module:design preclaim] auto-complete skipped: only ${htmlOkCount}/${screenMap.length} valid HTMLs ready`, { runId: ctx.runId });
      return;
    }
    let designSystem: any = {};
    try { if (fs.existsSync(tokensPath)) designSystem = JSON.parse(fs.readFileSync(tokensPath, "utf-8")); } catch {}
    const deviceType = ctx.context["device_type"] || "DESKTOP";
    const output = [
      "STATUS: done",
      "STITCH_PROJECT_ID: " + (ctx.context["stitch_project_id"] || ""),
      "DEVICE_TYPE: " + deviceType,
      "DESIGN_SYSTEM: " + JSON.stringify(designSystem),
      "SCREEN_MAP: " + JSON.stringify(screenMap),
      "SCREENS_GENERATED: " + screenMap.length,
      "AUTO_COMPLETED: design-preclaim (all assets ready, agent bypass)"
    ].join("\n");
    const { completeStep } = await import("../../step-ops.js");
    const stepRow = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
    const stepDbId = stepRow?.id || ctx.stepId;
    await recordPreClaimProgress(ctx, `Design preclaim: auto-completing design with ${screenMap.length} screens`);
    await completeStep(stepDbId, output, ctx.claimEnvelope);
    logger.info(`[module:design preclaim] AUTO-COMPLETED step ${ctx.stepId} (${screenMap.length} screens, ${htmlOkCount} HTMLs, agent bypassed)`, { runId: ctx.runId, stepId: stepDbId });
  } catch (e) {
    logger.warn(`[module:design preclaim] auto-complete failed (falling back to agent): ${String(e).slice(0, 200)}`, { runId: ctx.runId });
  }
}

// Lightweight screen-type heuristic from English title keywords.
// The agent can override in its output if a more specific type is needed,
// but defaults are good enough for stories step's screen→story binding.
function classifyScreenType(title: string): string {
  const t = title.toLowerCase();
  if (/(menu|home|landing)/.test(t)) return "menu";
  if (/(list|catalog)/.test(t)) return "list-view";
  if (/(detail)/.test(t)) return "detail";
  if (/(form|new|create|edit|add)/.test(t)) return "form";
  if (/(setting|option|preference|profile|account)/.test(t)) return "settings";
  if (/(result|score|summary)/.test(t)) return "result";
  if (/(game|play)/.test(t)) return "game";
  if (/(select|choice|level|difficulty)/.test(t)) return "selection";
  if (/(info|about|how)/.test(t)) return "info";
  if (/(empty|404|error|fallback)/.test(t)) return "error";
  if (/(upload)/.test(t)) return "form";
  return "app-screen";
}
