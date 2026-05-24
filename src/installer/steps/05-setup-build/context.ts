import type { ClaimContext } from "../types.js";
import { applyStackContractContext } from "../../stack-contract/context.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Build is ready, npm install completed, and build is green. Output: STATUS: done + BUILD_CMD. " +
  "BUILD_CMD_HINT is provided in context, usually 'npm run build'. " +
  "Do not change code or config.";

const DEFAULT_FAILURE_SUGGESTION =
  "Repair setup/build baseline, rerun the declared build command, then complete setup-build.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  applyStackContractContext(ctx.context, {
    repoPath: ctx.context["repo"] || ctx.context["REPO"],
    taskText: ctx.context["prd"] || ctx.task,
    persist: Boolean(ctx.context["repo"] || ctx.context["REPO"]),
  });
  if (ctx.context["baseline_fail"] && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = `SETUP_BUILD_PRECLAIM_BLOCKER:\n${ctx.context["baseline_fail"]}`;
  }
  if (ctx.context["baseline_fail"] && !ctx.context["failure_category"]) {
    ctx.context["failure_category"] = "setup_build_failure";
  }
  if (ctx.context["baseline_fail"] && !ctx.context["failure_suggestion"]) {
    ctx.context["failure_suggestion"] = DEFAULT_FAILURE_SUGGESTION;
  }
  if (ctx.context["compat_fail"] && !ctx.context["failure_category"]) {
    ctx.context["failure_category"] = "setup_compat_failure";
  }
  if (ctx.context["compat_fail"] && !ctx.context["failure_suggestion"]) {
    ctx.context["failure_suggestion"] = "Fix incompatible package versions in setup/build scope, rerun install/build, then complete setup-build.";
  }
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"] && !ctx.context["baseline_fail"] && !ctx.context["compat_fail"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
