import type { ClaimContext } from "../types.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Stitch ekranları zaten üretildi (stitch/ altında). Sen sadece DOĞRULA. " +
  "Stitch API çağırma. Output: STATUS + DEVICE_TYPE + DESIGN_SYSTEM (JSON) + SCREEN_MAP (JSON array). " +
  "SCREEN_MAP'te her ekran için screenId+name+type+description. PRD'deki Türkçe başlıkları kullan.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  // Design step needs PRD + repo + screen count for context. PRD is already
  // in context from plan step; we just stamp first-attempt reminder.
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
