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
    errors.push(`Unknown STATUS: "${parsed["status"]}". Expected one of: done, retry, skip, fail, failed, error.`);
  }
  if (status === "done" && !parsed["deploy_url"] && !parsed["systemd_unit"] && !parsed["port"]) {
    errors.push("STATUS: done requires at least one deploy marker: DEPLOY_URL, SYSTEMD_UNIT, or PORT");
  }
  return { ok: errors.length === 0, errors };
}
