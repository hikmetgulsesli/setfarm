import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }
  return { ok: errors.length === 0, errors };
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { parsed, context } = ctx;

  // Hard-fail if preClaim flagged a compat violation or baseline failure
  if (context["compat_fail"]) {
    throw new Error(`COMPAT: ${context["compat_fail"]}`);
  }
  if (context["baseline_fail"]) {
    throw new Error(`BASELINE: npm run build failed — ${context["baseline_fail"].slice(0, 300)}`);
  }

  // Stamp BUILD_CMD (agent value or pre-computed hint)
  context["build_cmd"] = parsed.build_cmd || context["build_cmd_hint"] || "npm run build";
}
