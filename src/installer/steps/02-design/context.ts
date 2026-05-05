import type { ClaimContext } from "../types.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Stitch screens are already generated under stitch/. Only validate them. " +
  "Do not call the Stitch API. Output: STATUS + DEVICE_TYPE + DESIGN_SYSTEM (JSON) + SCREEN_MAP (JSON array). " +
  "Each SCREEN_MAP entry needs screenId+name+type+description. Keep metadata in English and visible copy in UI_LANGUAGE.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  // Design step needs PRD + repo + screen count for context. PRD is already
  // in context from plan step; we just stamp first-attempt reminder.
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
