import type { ClaimContext } from "../types.js";

// Plan step needs only the task text. No stories, no screens, no progress —
// those are later steps' context. Keeping this minimal is the whole point.
export async function injectContext(ctx: ClaimContext): Promise<void> {
  ctx.context["task"] = ctx.task;
}
