import type { ClaimContext } from "../types.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: PLAN is a product contract only. Output STATUS, PROJECT_NAME, PROJECT_SLUG, PLATFORM, TECH_STACK, UI_LANGUAGE, DB_REQUIRED, DESIGN_REQUIRED, and PRD. " +
  "Do not emit REPO, BRANCH, GITHUB_REPO, RUN_SLUG, PACKAGE_NAME, APP_TITLE, PRD_SCREEN_COUNT, or a physical Screens table. " +
  "PRD must use Product Surfaces and Action Contracts; runtime identity is resolved by MC/Setfarm after PLAN.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  ctx.context["task"] = ctx.task;
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
