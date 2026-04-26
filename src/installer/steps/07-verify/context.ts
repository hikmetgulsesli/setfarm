import type { ClaimContext } from "../types.js";
import { fetchPrState, formatPrCommentsForAgent } from "./pr-comments.js";
import { runPlaywrightCheck, formatPlaywrightReport } from "./playwright-check.js";
import { logger } from "../../../lib/logger.js";

// Verify context injection lives mostly in step-ops.ts (injectVerifyContext) because
// it depends on the verify_each loop mechanism (autoVerifyDoneStories,
// loop_config, story selection, pipeline advancement).
//
// What this module adds (2026-04-23): PR comment fetch + format injection.
// When a final_pr is present, fetch Copilot/human review comments via `gh`
// CLI and expose them as context["pr_comments"] so verify prompt can ask
// the agent to address each feedback point before auto-merge.
export async function injectContext(ctx: ClaimContext): Promise<void> {
  // PR comments (when final_pr is present)
  const prUrl = ctx.context["final_pr"] || ctx.context["pr_url"] || "";
  const repoFull = ctx.context["repo_full"] || "";
  if (prUrl) {
    try {
      const state = await fetchPrState(prUrl, repoFull);
      if (state) {
        const formatted = formatPrCommentsForAgent(state);
        if (formatted) {
          ctx.context["pr_comments"] = formatted;
          ctx.context["pr_check_state"] = state.checksStatus || "";
          ctx.context["pr_mergeable"] = state.mergeable || "";
          ctx.context["pr_merge_state_status"] = state.mergeStateStatus || "";
          logger.info(`[verify] PR comments injected (${state.comments.length} total, checks=${state.checksStatus})`, { runId: ctx.runId });
        }
      }
    } catch (e) {
      logger.warn(`[verify] PR comment fetch failed (non-fatal): ${String(e).slice(0, 160)}`, { runId: ctx.runId });
    }
  }

  // Playwright visual/smoke check (when repo has Playwright installed)
  const repoPath = ctx.context["repo"] || "";
  if (repoPath) {
    try {
      const result = await runPlaywrightCheck(repoPath);
      if (!result.skipped) {
        const report = formatPlaywrightReport(result);
        ctx.context["playwright_report"] = report;
        logger.info(`[verify] Playwright check ${result.ok ? "PASS" : "FAIL"} (${result.issues.length} issue(s))`, { runId: ctx.runId });
      }
    } catch (e) {
      logger.warn(`[verify] Playwright check errored (non-fatal): ${String(e).slice(0, 160)}`, { runId: ctx.runId });
    }
  }
}
