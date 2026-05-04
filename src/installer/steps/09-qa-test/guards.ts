import type { ParsedOutput, ValidationResult } from "../types.js";

const ALLOWED_STATUS = new Set(["done", "retry", "skip", "fail", "failed", "error"]);
const FAILURE_STATUSES = new Set(["retry", "fail", "failed", "error"]);

function hasValue(parsed: ParsedOutput, key: string): boolean {
  return typeof parsed[key] === "string" && parsed[key].trim().length > 0;
}

function hasReport(parsed: ParsedOutput): boolean {
  return hasValue(parsed, "qa_report") || hasValue(parsed, "qa_report_path");
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
    if (!hasPositiveCount(parsed, "qa_screens_tested")) errors.push("STATUS: done requires QA_SCREENS_TESTED > 0.");
    if (!hasPositiveCount(parsed, "qa_routes_tested")) errors.push("STATUS: done requires QA_ROUTES_TESTED > 0.");
    if (!hasNonNegativeCount(parsed, "qa_interactions_tested")) errors.push("STATUS: done requires QA_INTERACTIONS_TESTED >= 0.");
    const issueCount = parseCount(parsed, "qa_total_issues");
    if (issueCount !== 0) errors.push("STATUS: done requires QA_TOTAL_ISSUES: 0.");
  } else if (FAILURE_STATUSES.has(status)) {
    if (!hasReport(parsed)) errors.push(`STATUS: ${status} requires QA_REPORT or QA_REPORT_PATH.`);
    if (!hasValue(parsed, "test_failures") && !hasValue(parsed, "issues")) errors.push(`STATUS: ${status} requires batched QA findings in TEST_FAILURES or ISSUES.`);
    const issueCount = parseCount(parsed, "qa_total_issues");
    if (issueCount !== null && issueCount <= 0) errors.push(`STATUS: ${status} requires QA_TOTAL_ISSUES > 0 when provided.`);
  } else if (status === "skip" && !hasValue(parsed, "issues") && !hasValue(parsed, "skip_reason")) {
    errors.push("STATUS: skip requires SKIP_REASON or ISSUES.");
  }
  return { ok: errors.length === 0, errors };
}
