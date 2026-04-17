import type { ClaimContext } from "../types.js";

// qa-test step is a placeholder — step-ops.ts has no dedicated inline logic
// (verified 2026-04-16, only cross-references in comments about downstream
// propagation). Minimum viable module registers the step; real QA
// automation (browser smoke, a11y audit, viewport matrix) should grow
// incrementally as coverage needs mature.
export async function injectContext(_ctx: ClaimContext): Promise<void> {
  return;
}
