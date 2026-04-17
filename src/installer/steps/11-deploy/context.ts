import type { ClaimContext } from "../types.js";

// Deploy step inline logic (handleDeployEnvGuard at step-ops.ts:355, the
// env-check invocation at :1135, and the status=done handler at :2139)
// remains in step-ops.ts. Those hooks depend on systemd interactions and
// DNS/port allocation helpers that are cross-cutting — extracting them
// requires lifting several utilities out of step-ops and is deferred.
//
// Minimum viable module: register the step so module-delegation runs
// normalize/validateOutput on the agent's output.
export async function injectContext(_ctx: ClaimContext): Promise<void> {
  return;
}
