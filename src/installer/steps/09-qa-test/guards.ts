import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { CompleteContext, ParsedOutput, ValidationResult } from "../types.js";

const ALLOWED_STATUS = new Set(["done", "retry", "skip", "fail", "failed", "error"]);
const FAILURE_STATUSES = new Set(["retry", "fail", "failed", "error"]);

function hasValue(parsed: ParsedOutput, key: string): boolean {
  return typeof parsed[key] === "string" && parsed[key].trim().length > 0;
}

function hasReport(parsed: ParsedOutput): boolean {
  return hasValue(parsed, "qa_report") || hasValue(parsed, "qa_report_path");
}

function hasJsonReport(parsed: ParsedOutput): boolean {
  return hasValue(parsed, "qa_json") || hasValue(parsed, "qa_json_path");
}

function parseCount(parsed: ParsedOutput, key: string): number | null {
  const raw = parsed[key];
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) ? value : null;
}

function hasNonNegativeCount(parsed: ParsedOutput, key: string): boolean {
  const value = parseCount(parsed, key);
  return value !== null && value >= 0;
}

function hasPositiveCount(parsed: ParsedOutput, key: string): boolean {
  const value = parseCount(parsed, key);
  return value !== null && value > 0;
}

export function normalize(parsed: ParsedOutput): void {
  if (parsed["status"]) {
    const raw = parsed["status"].trim();
    parsed["status"] = (raw.indexOf("\n") >= 0 ? raw.slice(0, raw.indexOf("\n")).trim() : raw).split(/\s/)[0].toLowerCase();
  }
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  const status = (parsed["status"] || "").toLowerCase();
  if (!status) {
    errors.push("Missing STATUS field");
  } else if (!ALLOWED_STATUS.has(status)) {
    errors.push(`Unknown STATUS: "${parsed["status"]}". Expected one of: done, retry, skip, fail, failed, error.`);
  } else if (status === "done") {
    if (!hasReport(parsed)) errors.push("STATUS: done requires QA_REPORT or QA_REPORT_PATH.");
    if (!hasJsonReport(parsed)) errors.push("STATUS: done requires QA_JSON or QA_JSON_PATH.");
    if (!hasPositiveCount(parsed, "qa_screens_tested")) errors.push("STATUS: done requires QA_SCREENS_TESTED > 0.");
    if (!hasPositiveCount(parsed, "qa_routes_tested")) errors.push("STATUS: done requires QA_ROUTES_TESTED > 0.");
    if (!hasPositiveCount(parsed, "qa_interactions_tested")) errors.push("STATUS: done requires QA_INTERACTIONS_TESTED > 0.");
    const issueCount = parseCount(parsed, "qa_total_issues");
    if (issueCount !== 0) errors.push("STATUS: done requires QA_TOTAL_ISSUES: 0.");
  } else if (FAILURE_STATUSES.has(status)) {
    if (!hasReport(parsed)) errors.push(`STATUS: ${status} requires QA_REPORT or QA_REPORT_PATH.`);
    if (!hasJsonReport(parsed)) errors.push(`STATUS: ${status} requires QA_JSON or QA_JSON_PATH.`);
    if (!hasValue(parsed, "test_failures") && !hasValue(parsed, "issues")) errors.push(`STATUS: ${status} requires batched QA findings in TEST_FAILURES or ISSUES.`);
    const issueCount = parseCount(parsed, "qa_total_issues");
    if (issueCount !== null && issueCount <= 0) errors.push(`STATUS: ${status} requires QA_TOTAL_ISSUES > 0 when provided.`);
  } else if (status === "skip" && !hasValue(parsed, "issues") && !hasValue(parsed, "skip_reason")) {
    errors.push("STATUS: skip requires SKIP_REASON or ISSUES.");
  }
  return { ok: errors.length === 0, errors };
}

function repoPath(context: Record<string, string>): string {
  const raw = context["repo"] || context["REPO"] || "";
  return raw.startsWith("~/") ? raw.replace(/^~/, os.homedir()) : raw;
}

function resolveReportPath(repo: string, parsed: ParsedOutput): string {
  const report = (parsed["qa_report"] || parsed["qa_report_path"] || "").trim();
  if (!report) return "";
  const resolved = path.resolve(repo, report);
  const repoRoot = path.resolve(repo);
  if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) {
    throw new Error(`QA_REPORT must stay inside the repository: ${report}`);
  }
  return resolved;
}

function resolveJsonReportPath(repo: string, parsed: ParsedOutput): string {
  const report = (parsed["qa_json"] || parsed["qa_json_path"] || "").trim();
  if (!report) return "";
  const resolved = path.resolve(repo, report);
  const repoRoot = path.resolve(repo);
  if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) {
    throw new Error(`QA_JSON must stay inside the repository: ${report}`);
  }
  return resolved;
}

function hasSection(markdown: string, section: string): boolean {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^#{1,3}\\s+${escaped}\\s*$`, "im").test(markdown);
}

function sectionBody(markdown: string, section: string): string {
  const lines = markdown.split(/\n/);
  const target = section.trim().toLowerCase();
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const heading = /^#{1,3}\s+(.+?)\s*$/.exec(lines[i]);
    if (heading && heading[1].trim().toLowerCase() === target) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    if (/^#{1,3}\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function auditQaReport(markdown: string, parsed: ParsedOutput): string[] {
  const status = (parsed["status"] || "").toLowerCase();
  const errors: string[] = [];
  const requiredSections = [
    "Summary",
    "Environment",
    "Routes Tested",
    "Interactions Tested",
    "Screenshots",
    "Console",
    "Visual/Layout Findings",
    "Functional Findings",
    "Semantic/Test Findings",
    "Batch Fix Plan",
  ];

  for (const section of requiredSections) {
    if (!hasSection(markdown, section)) errors.push(`QA report missing required section: ${section}`);
  }

  const screenshots = sectionBody(markdown, "Screenshots");
  if (status === "done" && !/\.(png|jpe?g|webp)\b/i.test(screenshots)) {
    errors.push("STATUS: done QA report must include desktop/mobile screenshot artifact paths in Screenshots.");
  }

  const interactions = sectionBody(markdown, "Interactions Tested");
  const interactionCount = parseCount(parsed, "qa_interactions_tested") || 0;
  if (status === "done" && interactionCount > 0) {
    const evidenceLines = interactions.split(/\n/).filter((line) => /^\s*[-*|]/.test(line)).length;
    if (evidenceLines === 0) {
      errors.push("STATUS: done QA report must list concrete interaction evidence, not only a prose summary.");
    }
  }

  if (status === "done") {
    const findingsText = [
      sectionBody(markdown, "Functional Findings"),
      sectionBody(markdown, "Visual/Layout Findings"),
      sectionBody(markdown, "Semantic/Test Findings"),
    ].join("\n");
    if (/\b(blocker|broken|fail(?:ed|ing)?|error|warning|issue|retry required)\b/i.test(findingsText) &&
        !/\b(no\s+(blocking\s+)?(issues|findings)|none)\b/i.test(findingsText)) {
      errors.push("STATUS: done report contains unresolved finding language; return STATUS: retry with batched findings.");
    }
  }

  if (status !== "done") {
    const fixPlan = sectionBody(markdown, "Batch Fix Plan");
    if (fixPlan.trim().length < 20) errors.push(`STATUS: ${status || "unknown"} QA report requires a concrete Batch Fix Plan.`);
  }

  return errors;
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const status = (ctx.parsed["status"] || "").toLowerCase();
  if (status === "skip") return;

  const repo = repoPath(ctx.context);
  if (!repo) throw new Error("QA_REPORT_AUDIT: repo context is missing.");

  const reportPath = resolveReportPath(repo, ctx.parsed);
  if (!reportPath || !fs.existsSync(reportPath)) {
    throw new Error(`QA_REPORT_AUDIT: report file not found: ${ctx.parsed["qa_report"] || ctx.parsed["qa_report_path"] || "(missing)"}`);
  }
  const jsonReportPath = resolveJsonReportPath(repo, ctx.parsed);
  if (!jsonReportPath || !fs.existsSync(jsonReportPath)) {
    throw new Error(`QA_REPORT_AUDIT: JSON report file not found: ${ctx.parsed["qa_json"] || ctx.parsed["qa_json_path"] || "(missing)"}`);
  }
  const json = JSON.parse(fs.readFileSync(jsonReportPath, "utf-8"));
  if (json?.schema !== "setfarm.qa-report.v1") {
    throw new Error("QA_REPORT_AUDIT: QA_JSON schema must be setfarm.qa-report.v1.");
  }

  const markdown = fs.readFileSync(reportPath, "utf-8");
  const errors = auditQaReport(markdown, ctx.parsed);
  if (errors.length > 0) {
    throw new Error(`QA_REPORT_AUDIT: ${errors.join("; ")}`);
  }
}
