import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { CompleteContext, ParsedOutput, ValidationResult } from "../types.js";

const ALLOWED_STATUS = new Set(["done", "retry", "skip", "fail", "failed", "error"]);
const FAILURE_STATUSES = new Set(["retry", "fail", "failed", "error"]);

function hasValue(parsed: ParsedOutput, key: string): boolean {
  return typeof parsed[key] === "string" && parsed[key].trim().length > 0;
}

function hasFinalJson(parsed: ParsedOutput): boolean {
  return hasValue(parsed, "final_test_json") || hasValue(parsed, "final_test_json_path");
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
    if (!hasValue(parsed, "smoke_test_result")) errors.push("STATUS: done requires SMOKE_TEST_RESULT.");
    if (!hasFinalJson(parsed)) errors.push("STATUS: done requires FINAL_TEST_JSON or FINAL_TEST_JSON_PATH.");
  } else if (FAILURE_STATUSES.has(status)) {
    if (!hasFinalJson(parsed)) errors.push(`STATUS: ${status} requires FINAL_TEST_JSON or FINAL_TEST_JSON_PATH.`);
    if (!hasValue(parsed, "test_failures") && !hasValue(parsed, "issues")) errors.push(`STATUS: ${status} requires TEST_FAILURES or ISSUES.`);
  }
  return { ok: errors.length === 0, errors };
}

function repoPath(context: Record<string, string>): string {
  const raw = context["repo"] || context["REPO"] || "";
  return raw.startsWith("~/") ? raw.replace(/^~/, os.homedir()) : raw;
}

function resolveFinalJsonPath(repo: string, parsed: ParsedOutput): string {
  const report = (parsed["final_test_json"] || parsed["final_test_json_path"] || "").trim();
  if (!report) return "";
  const resolved = path.resolve(repo, report);
  const repoRoot = path.resolve(repo);
  if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) {
    throw new Error(`FINAL_TEST_JSON must stay inside the repository: ${report}`);
  }
  return resolved;
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const status = (ctx.parsed["status"] || "").toLowerCase();
  if (status === "skip") return;

  const repo = repoPath(ctx.context);
  if (!repo) throw new Error("FINAL_TEST_AUDIT: repo context is missing.");

  const jsonPath = resolveFinalJsonPath(repo, ctx.parsed);
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    throw new Error(`FINAL_TEST_AUDIT: JSON report file not found: ${ctx.parsed["final_test_json"] || ctx.parsed["final_test_json_path"] || "(missing)"}`);
  }
  const json = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  if (json?.schema !== "setfarm.final-test.v1") {
    throw new Error("FINAL_TEST_AUDIT: FINAL_TEST_JSON schema must be setfarm.final-test.v1.");
  }
  if (status === "done" && String(json.status || "").toLowerCase() !== "done") {
    throw new Error("FINAL_TEST_AUDIT: STATUS done requires FINAL_TEST_JSON status done.");
  }
  if (status === "done") {
    const interactions = Number(json.interactionsTested ?? 0);
    if (!Number.isFinite(interactions) || interactions <= 0) {
      throw new Error("FINAL_TEST_AUDIT: STATUS done requires FINAL_TEST_JSON interactionsTested > 0.");
    }
    const issueCount = Number(json.issueCount ?? 0);
    if (!Number.isFinite(issueCount) || issueCount !== 0) {
      throw new Error("FINAL_TEST_AUDIT: STATUS done requires FINAL_TEST_JSON issueCount 0.");
    }
  }
}
