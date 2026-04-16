import type { ParsedOutput, ValidationResult } from "../types.js";

const ALLOWED_STATUS = new Set(["done", "retry", "skip", "fail", "failed", "error"]);

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
    errors.push(`Unknown STATUS: "${parsed["status"]}". Expected one of: done, retry, skip, fail.`);
  }
  // STATUS: done requires smoke_test_result field (step-ops auto-derives if missing, but the agent should surface it)
  // STATUS: retry requires structured failure reason
  if (status === "retry" && !parsed["test_failures"] && !parsed["feedback"] && !parsed["issues"] && !parsed["smoke_test_result"]) {
    errors.push("STATUS: retry requires TEST_FAILURES, FEEDBACK, ISSUES, or SMOKE_TEST_RESULT field explaining blocker");
  }
  return { ok: errors.length === 0, errors };
}
