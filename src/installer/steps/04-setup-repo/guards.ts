import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }
  // EXISTING_CODE optional at module level — preClaim provides a hint, agent
  // can omit and we fall back to the hint during onComplete.
  return { ok: errors.length === 0, errors };
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { parsed, context, runId } = ctx;
  const canonicalBranch = context["BRANCH"] || context["branch"] || runId;
  context["branch"] = canonicalBranch;
  context["BRANCH"] = canonicalBranch;
  const existing = (parsed.existing_code || context["existing_code_hint"] || "false").toLowerCase();
  context["existing_code"] = existing === "true" ? "true" : "false";
}
