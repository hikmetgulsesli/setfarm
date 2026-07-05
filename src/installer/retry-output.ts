export function preserveActionableStoryRetryOutput(currentOutput: string | null | undefined, diagnostic: string): string {
  const existing = String(currentOutput || "").trim();
  const next = String(diagnostic || "").trim();
  const actionablePattern = /\b(?:PR_REVIEW_COMMENTS_OPEN|APP_INTEGRATION_[A-Z_]*REGRESSION|POST_MERGE_QUALITY_REGRESSION|QUALITY GATE|GUARDRAIL|GENERATED_SCREEN_[A-Z_]+|RUNTIME_BRIDGE_[A-Z_]+|SYSTEM_SMOKE_[A-Z_]+|UI_CONTRACT|DESIGN_MISMATCH|VULNERABILITIES|SECURITY_FINDINGS?|STATUS:\s*retry)\b|actionable PR review comments/i;
  const infraPattern = /\bAGENT_(?:STEP|STORY)_STATE_MISMATCH\b|\bAGENT_PROCESS_(?:EXITED|TERMINAL|STUCK|HARD_STUCK)\b|\bAGENT_MODEL_TURN_STALLED\b|\bINFRA_RETRY\b|\bGUARDRAIL \[product-supervisor:implement\]|\bMASKED_CHECK_COMMAND\b|\bIMPLEMENT_NO_DELTA\b|\bNO_CHANGED_FILES\b/i;
  const existingActionable = actionablePattern.test(existing);
  const nextActionable = actionablePattern.test(next);
  const nextInfra = infraPattern.test(next);
  if (!existing) return next;
  if (existingActionable && nextActionable) {
    if (existing.includes(next.slice(0, 400))) return existing;
    if (next.includes(existing.slice(0, 400))) return next;
    return `${existing}\n\nALSO_FIX:\n${next}`.slice(0, 12000);
  }
  if (!existingActionable || !nextInfra) return next;
  if (existing.includes(next.slice(0, 400))) return existing;
  return `${existing}\n\nINFRA_RETRY:\n${next}`.slice(0, 12000);
}
