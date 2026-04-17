import type { ClaimContext } from "../types.js";

// Security-gate step is a placeholder in the current pipeline — step-ops.ts
// has no dedicated inline logic (verified 2026-04-16). This module registers
// the step with minimum viable guards; real scanning (OWASP, secrets, CSP,
// SSRF, etc.) should be added incrementally as the threat model matures.
export async function injectContext(_ctx: ClaimContext): Promise<void> {
  return;
}
