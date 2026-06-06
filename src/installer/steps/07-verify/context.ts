import type { ClaimContext } from "../types.js";
import { fetchPrState, formatPrCommentsForAgent } from "./pr-comments.js";
import { runSupervisorVisualQa, formatSupervisorVisualReport } from "../../supervisor/visual-qa.js";
import { logger } from "../../../lib/logger.js";
import { readSupervisorMemory } from "../../product-supervisor.js";

// Verify context injection lives mostly in step-ops.ts (injectVerifyContext) because
// it depends on the verify_each loop mechanism (autoVerifyDoneStories,
// loop_config, story selection, pipeline advancement).
//
// What this module adds (2026-04-23): PR comment fetch + format injection.
// When a story PR is present, fetch Copilot/human review comments via `gh`
// CLI and expose them as context["pr_comments"] so verify prompt can ask
// the agent to address each feedback point before auto-merge.
export async function injectContext(ctx: ClaimContext): Promise<void> {
  ctx.context["supervisor_memory"] = readSupervisorMemory(ctx.context);

  // PR comments. Prefer the current story PR over a stale final_pr from earlier
  // merge-queue/final-test state, otherwise old PR comments can leak into the
  // next story verification claim.
  const prUrl = ctx.context["pr_url"] || ctx.context["final_pr"] || "";
  const repoFull = ctx.context["repo_full"] || "";
  ctx.context["pr_comments"] = "";
  ctx.context["pr_check_state"] = "";
  ctx.context["pr_mergeable"] = "";
  ctx.context["pr_merge_state_status"] = "";
  if (prUrl) {
    try {
      const state = await fetchPrState(prUrl, repoFull);
      if (state) {
        const formatted = formatPrCommentsForAgent(state);
        ctx.context["pr_comments"] = formatted || "";
        ctx.context["pr_check_state"] = state.checksStatus || "";
        ctx.context["pr_mergeable"] = state.mergeable || "";
        ctx.context["pr_merge_state_status"] = state.mergeStateStatus || "";
        logger.info(`[verify] PR comments injected (${state.comments.length} total, checks=${state.checksStatus})`, { runId: ctx.runId });
      }
    } catch (e) {
      logger.warn(`[verify] PR comment fetch failed (non-fatal): ${String(e).slice(0, 160)}`, { runId: ctx.runId });
    }
  }

  // Supervisor visual QA persists screenshots, console/browser issues, route
  // crawl results, and clicked-control evidence under .setfarm/supervisor/<runId>.
  const workdir = ctx.context["story_workdir"] || ctx.context["repo"] || "";
  const mainRepo = ctx.context["repo"] || "";
  if (workdir) {
    try {
      const result = await runSupervisorVisualQa({
        runId: ctx.runId,
        workdir,
        repoPath: workdir,
        ownershipRepoPath: mainRepo,
        storyId: ctx.context["current_story_id"] || undefined,
      });
      const report = formatSupervisorVisualReport(result);
      ctx.context["playwright_report"] = report;
      ctx.context["supervisor_visual_report"] = report;
      logger.info(`[verify] Supervisor visual QA ${result.skipped ? "SKIP" : result.ok ? "PASS" : "FAIL"} (${result.issues.length} issue(s))`, { runId: ctx.runId });
    } catch (e) {
      logger.warn(`[verify] Supervisor visual QA errored (non-fatal): ${String(e).slice(0, 160)}`, { runId: ctx.runId });
    }
  }
}
