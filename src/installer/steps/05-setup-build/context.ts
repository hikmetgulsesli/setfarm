import type { ClaimContext } from "../types.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Build hazır, npm install + build yeşil. Output: STATUS: done + BUILD_CMD. " +
  "BUILD_CMD_HINT context'te verildi — genellikle 'npm run build'. " +
  "Kod veya config değiştirme.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
