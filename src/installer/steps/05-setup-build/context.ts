import type { ClaimContext } from "../types.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Build is ready, npm install completed, and build is green. Output: STATUS: done + BUILD_CMD. " +
  "BUILD_CMD_HINT is provided in context, usually 'npm run build'. " +
  "Do not change code or config.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
