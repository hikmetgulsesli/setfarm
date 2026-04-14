import type { ClaimContext } from "../types.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Output MUST include ALL mandatory fields. " +
  "PRD (min 500 chars, Turkish, Ekranlar tablosu min 3 satır) + REPO (absolute path) + " +
  "BRANCH + TECH_STACK (vite-react|nextjs|vanilla-ts|node-express|react-native) + " +
  "PRD_SCREEN_COUNT (int >=3) + DB_REQUIRED (none|postgres|sqlite). Missing = instant REJECT.";

// Plan step context is intentionally minimal: only the task. A first-attempt
// reminder is injected to prime the agent on mandatory output fields.
export async function injectContext(ctx: ClaimContext): Promise<void> {
  ctx.context["task"] = ctx.task;
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
