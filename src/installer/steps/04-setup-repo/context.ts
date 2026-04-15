import type { ClaimContext } from "../types.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Repo hazır. Output: STATUS: done + EXISTING_CODE: true/false. " +
  "EXISTING_CODE_HINT context'te verilmiş — onu kullan ya da kendi kararın. " +
  "Git veya npm çağırma, dosya değiştirme — pipeline halletti.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
