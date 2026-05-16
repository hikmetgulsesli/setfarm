import type { ClaimContext } from "../types.js";
import { applyStackContractContext } from "../../stack-contract/context.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: Repo is ready. Output: STATUS: done + EXISTING_CODE: true/false. " +
  "EXISTING_CODE_HINT is provided in context; use it or make your own determination. " +
  "Do not run git or npm and do not edit files; the pipeline already handled this.";

export async function injectContext(ctx: ClaimContext): Promise<void> {
  applyStackContractContext(ctx.context, {
    repoPath: ctx.context["repo"] || ctx.context["REPO"],
    taskText: ctx.context["prd"] || ctx.task,
    persist: Boolean(ctx.context["repo"] || ctx.context["REPO"]),
  });
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
