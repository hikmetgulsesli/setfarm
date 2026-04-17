import type { ClaimContext } from "../types.js";

// Verify context injection lives in step-ops.ts (injectVerifyContext) because
// it depends on the verify_each loop mechanism (autoVerifyDoneStories,
// loop_config, story selection, pipeline advancement). Moving that logic
// into this module would require pulling several cross-cutting helpers.
//
// This module's injectContext is a no-op; the real work happens during
// claimSingleStep in step-ops.ts. Once the verify_each pathway is
// refactored end-to-end, this function can own the injection and the
// step-ops branch can be removed.
export async function injectContext(_ctx: ClaimContext): Promise<void> {
  return;
}
