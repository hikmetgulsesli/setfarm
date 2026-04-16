import type { ClaimContext } from "../types.js";

// Final-test heavy inline logic (design fidelity check, import consistency,
// smoke-test.mjs auto-run) lives in step-ops.ts at lines ~2290-2340. That
// code depends on `processDesignFidelityCheck`, `checkImportConsistency`,
// and the smoke-test.mjs subprocess path; extracting it requires moving
// several cross-cutting helpers and is deferred to a later refactor.
//
// This module registers the step with minimum viable guards so the
// module-delegation block in step-ops.ts runs normalize/validateOutput.
// The inline guardrails still fire on top.
export async function injectContext(_ctx: ClaimContext): Promise<void> {
  return;
}
