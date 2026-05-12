import type { CompleteContext, ParsedOutput, ValidationResult } from "../types.js";
import { updateSupervisorMemory } from "../../product-supervisor.js";

function firstWord(value: string | undefined): string {
  return String(value || "").trim().split(/\s+/)[0].toLowerCase();
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const status = firstWord(parsed.status);
  if (!status) return { ok: false, errors: ["STATUS is required"] };
  if (!["done", "retry", "skip"].includes(status)) {
    return { ok: false, errors: [`STATUS must be done, retry, or skip; got ${parsed.status}`] };
  }
  if (status === "done") {
    const decision = firstWord(parsed.supervisor_decision);
    if (!decision) return { ok: false, errors: ["SUPERVISOR_DECISION is required when STATUS is done"] };
    if (!["pass", "fixed", "block"].includes(decision)) {
      return { ok: false, errors: [`SUPERVISOR_DECISION must be pass, fixed, or block; got ${parsed.supervisor_decision}`] };
    }
  }
  return { ok: true, errors: [] };
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const decision = firstWord(ctx.parsed.supervisor_decision) || "unknown";
  const memoryAppend = (ctx.parsed.supervisor_memory_append || "").trim();
  const checks = (ctx.parsed.checks || "").trim();
  const changes = (ctx.parsed.changes || "").trim();
  const risks = (ctx.parsed.risks || "").trim();
  const issues = (ctx.parsed.issues || "").trim();

  const lines = [
    `### ${new Date().toISOString()} llm-supervisor ${decision}`,
    `- Step: ${ctx.stepId}`,
    `- Decision: ${decision}`,
  ];
  if (memoryAppend) lines.push(`- Memory: ${memoryAppend.slice(0, 1200)}`);
  if (changes) lines.push(`- Changes: ${changes.slice(0, 800)}`);
  if (checks) lines.push(`- Checks: ${checks.slice(0, 800)}`);
  if (risks) lines.push(`- Risks: ${risks.slice(0, 800)}`);
  if (issues) lines.push(`- Issues: ${issues.slice(0, 800)}`);

  updateSupervisorMemory(ctx.context, `${lines.join("\n")}\n`);
  ctx.context["supervisor_last_decision"] = decision;
  ctx.context["supervisor_last_summary"] = (memoryAppend || changes || checks || issues || ctx.rawOutput || "").slice(0, 1500);

  if (decision === "block") {
    ctx.context["previous_failure"] = issues || memoryAppend || "Supervisor blocked the product checkpoint.";
    ctx.context["failure_category"] = "LLM_SUPERVISOR_BLOCKED";
    ctx.context["failure_suggestion"] = "Treat this as manager feedback. Fix the root product/code contract violation, then rerun supervisor.";
    throw new Error(`LLM_SUPERVISOR_BLOCKED: ${(issues || memoryAppend || "blocked").slice(0, 400)}`);
  }
}

