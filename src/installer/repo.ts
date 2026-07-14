/**
 * Query Layer (repo.ts)
 *
 * Centralizes the most repeated DB operations from step-ops.ts and other modules.
 * Each function wraps a single query call — no business logic.
 */

import { getSql, pgGet, pgQuery, pgRun, pgBegin, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { transitionRunToTerminal } from "../execution/run-terminal-transition.js";
import { requestRunTermination } from "../execution/run-termination.js";
import { OPTIONAL_TEMPLATE_VARS } from "./constants.js";


// ── Run queries ─────────────────────────────────────────────────────

export async function getRunStatus(runId: string): Promise<string | undefined> {
  const row = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [runId]);
  return row?.status;
}

export async function getRunContext(runId: string): Promise<Record<string, string>> {
  const row = await pgGet<{ context: string }>("SELECT context FROM runs WHERE id = $1", [runId]);
  return row ? JSON.parse(row.context) : {};
}

export function mergeRunContextForUpdate(existing: unknown, next: Record<string, string>): Record<string, string> {
  const base = existing && typeof existing === "object" && !Array.isArray(existing)
    ? existing as Record<string, string>
    : {};
  const merged = { ...base };
  const optionalKeys = new Set<string>(OPTIONAL_TEMPLATE_VARS);
  for (const [key, value] of Object.entries(next)) {
    if (value === "" && optionalKeys.has(key) && base[key]) {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export async function updateRunContext(runId: string, context: Record<string, string>): Promise<void> {
  // Atomic read-merge-write inside transaction to prevent race conditions
  await pgBegin(async (sql) => {
    const row = await sql.unsafe("SELECT context FROM runs WHERE id = $1 FOR UPDATE", [runId]);
    const existing = row[0]?.context ? (typeof row[0].context === "string" ? JSON.parse(row[0].context) : row[0].context) : {};
    const merged = mergeRunContextForUpdate(existing, context);
    await sql.unsafe("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(merged), now(), runId]);
  });
}

/**
 * Request a failed run terminal transition. When `terminal` is true the intent
 * is carried in the durable request and written to runs.meta only after proven
 * runtime drain, so medic's resume_run action skips it. Wave 13 Bug J-2 (run #344 postmortem):
 * previously any failed run — including intentional merge-queue aborts and
 * retry-exhausted guards — could be revived by medic, which then re-advanced
 * the pipeline past a dead implement step into verify/security-gate/qa-test.
 * Intentional callers (step-ops.ts direct-merge failure paths, retry exhaust,
 * missing-context guards) must pass terminal=true so the failure sticks.
 */
export async function failRun(runId: string, terminal = false, diagnostic?: string): Promise<void> {
  const requested = await requestRunTermination(getSql(), {
    runId,
    targetStatus: "failed",
    requestedBy: "setfarm.installer.fail-run",
    diagnostic: diagnostic || (terminal
      ? "RUN_TERMINAL_FAILURE: run failed through the canonical lifecycle owner."
      : "RUN_FAILED: recoverable run failure closed through the canonical lifecycle owner."),
    evidence: { source: "installer.repo.failRun", terminalFailure: terminal },
  });
  if (requested.status !== "already_terminal") {
    try {
      await pgRun("SELECT pg_notify($1, $2)", [
        "run_termination_requested",
        JSON.stringify({ runId, terminationRequestId: requested.request.requestId }),
      ]);
    } catch {
      // Wake-up only; startup and polling recover the durable request.
    }
  }
  if (terminal) {
    await recordTerminalPlatformSelfHealPlanFromRun(runId);
  }
  try {
    const { refreshRunContractSafe } = await import("./contract-ledger.js");
    await refreshRunContractSafe(runId, "run.fail_requested");
  } catch (e) {
    logger.warn(`[failRun] Contract refresh failed for ${runId}: ${String(e)}`);
  }
}

async function recordTerminalPlatformSelfHealPlanFromRun(runId: string): Promise<void> {
  try {
    const step = await pgGet<{ id: string; step_id: string; agent_id: string | null; output: string | null }>(
      `
        SELECT id, step_id, agent_id, output
        FROM steps
        WHERE run_id = $1
          AND status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [runId],
    );
    if (!step) return;
    const error = String(step.output || `Terminal failure in ${step.step_id}`).trim();
    const { maybeRunPlatformSelfHeal } = await import("./platform-self-heal/runner.js");
    await maybeRunPlatformSelfHeal({
      runId,
      stepId: step.step_id || step.id,
      agentId: step.agent_id,
      error,
    });
  } catch (e) {
    logger.warn(`[failRun] Platform self-heal hook failed for ${runId}: ${String(e).slice(0, 240)}`);
  }
}

export async function completeRun(runId: string): Promise<void> {
  await transitionRunToTerminal(getSql(), {
    runId,
    status: "completed",
    diagnostic: "Pipeline completed with no open claim or attempt owners.",
  });
  try {
    const { refreshRunContractSafe } = await import("./contract-ledger.js");
    await refreshRunContractSafe(runId, "run.completed");
  } catch (e) {
    logger.warn(`[completeRun] Contract refresh failed for ${runId}: ${String(e)}`);
  }
}

export async function getWorkflowId(runId: string): Promise<string | undefined> {
  try {
    const row = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
    return row?.workflow_id;
  } catch (e: any) {
    logger.warn(`[repo] getWorkflowId("${runId}") failed: ${e.message}`);
    return undefined;
  }
}

// ── Story queries ───────────────────────────────────────────────────

export function isStaleFailureStoryOutput(output: string | null | undefined): boolean {
  const text = String(output || "").trim();
  if (!text) return false;
  return /\b(PR_REVIEW_COMMENTS_OPEN|PR_NOT_MERGED|PR_MISSING|BUILD_FAILED|VERIFY_SYSTEM_SMOKE_FAILURE|SYSTEM_SMOKE_FAILURE|LLM_SUPERVISOR_BLOCKED|SUPERVISOR_BLOCKERS_OPEN|SCOPE_BLEED|PLATFORM_STORY_COMMIT_|PLATFORM_SUPERVISOR_|Critical step retries exhausted|retries exhausted|STATUS:\s*retry)\b/i.test(text)
    || /\b(?:open|unresolved|actionable|current)\b[\s\S]{0,180}\bPR\s+review\s+(?:comment|thread)s?\b/i.test(text);
}

export function verifiedStoryOutput(existingOutput: string | null | undefined, verificationOutput?: string): string | null {
  const verifiedOutput = String(verificationOutput || "").trim();
  if (verifiedOutput) return verifiedOutput.slice(0, 6000);
  if (!isStaleFailureStoryOutput(existingOutput)) return null;
  return [
    "STATUS: verified",
    "VERIFICATION_SUMMARY: Story verified by Setfarm gates; stale failure output cleared.",
  ].join("\n");
}

export async function verifyStory(storyId: string, verificationOutput?: string): Promise<void> {
  const row = await pgGet<{ run_id: string; output: string | null }>("SELECT run_id, output FROM stories WHERE id = $1", [storyId]);
  const replacementOutput = verifiedStoryOutput(row?.output, verificationOutput);
  if (replacementOutput !== null) {
    await pgRun("UPDATE stories SET status = 'verified', output = $1, updated_at = $2 WHERE id = $3",
      [replacementOutput, now(), storyId]);
  } else {
    await pgRun("UPDATE stories SET status = 'verified', updated_at = $1 WHERE id = $2",
      [now(), storyId]);
  }
  if (row?.run_id) {
    const { refreshRunContractSafe } = await import("./contract-ledger.js");
    await refreshRunContractSafe(row.run_id, "story.verified");
  }
}

export async function skipFailedStories(_runId: string): Promise<number> {
  // DISABLED: Never skip stories. Failed stories stay as 'failed' and get
  // retried by failStep until max_retries exhausted. Then they stay 'failed'
  // and the loop completes without them. No story is ever marked 'skipped'.
  return 0;
}

export async function countStoriesByStatus(runId: string, status: string): Promise<number> {
  const row = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = $2", [runId, status]);
  return Number(row?.cnt ?? 0);
}

export async function countAllStories(runId: string): Promise<number> {
  const row = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1", [runId]);
  return Number(row?.cnt ?? 0);
}

export async function findStoryByStatus(runId: string, status: string): Promise<{ id: string } | undefined> {
  return await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = $2 LIMIT 1", [runId, status]);
}

export async function getNextPendingStory(runId: string): Promise<any | undefined> {
  return await pgGet(
    `SELECT * FROM stories
     WHERE run_id = $1 AND status = 'pending'
     ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC
     LIMIT 1`,
    [runId],
  );
}

export async function claimNextStory(runId: string, agentId: string, eligibleStoryId?: string): Promise<any | undefined> {
  return await pgBegin(async (sql) => {
    // If a specific dependency-eligible story ID is provided, claim that one.
    // Otherwise fall back to first pending story by index.
    const query = eligibleStoryId
      ? `SELECT id, story_id, title, story_index, output, retry_count, max_retries, abandoned_count, depends_on, scope_files, shared_files, scope_description, file_skeletons, story_branch, pr_url
         FROM stories st WHERE run_id = $1 AND id = $2 AND status = 'pending'
           AND NOT EXISTS (
             SELECT 1 FROM claim_log cl
              WHERE cl.run_id = st.run_id
                AND cl.story_id = st.story_id
                AND cl.outcome IS NULL
           )
         FOR UPDATE SKIP LOCKED`
      : `SELECT id, story_id, title, story_index, output, retry_count, max_retries, abandoned_count, depends_on, scope_files, shared_files, scope_description, file_skeletons, story_branch, pr_url
         FROM stories st WHERE run_id = $1 AND status = 'pending'
           AND NOT EXISTS (
             SELECT 1 FROM claim_log cl
              WHERE cl.run_id = st.run_id
                AND cl.story_id = st.story_id
                AND cl.outcome IS NULL
           )
         ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;
    const params = eligibleStoryId ? [runId, eligibleStoryId] : [runId];
    const rows = await sql.unsafe(query, params);
    const story = rows[0] as any;
    if (!story) return undefined;

    // Wave 14 Bug L: increment claim_generation on every claim. The completeStep
    // path checks the agent's reported generation against DB — stale agents
    // (from a previous claim that was abandoned/timed-out) get rejected.
    await sql.unsafe(
      `UPDATE stories SET status = 'running', claim_generation = COALESCE(claim_generation, 0) + 1, started_at = NOW(), updated_at = $1
       WHERE id = $2`,
      [now(), story.id]
    );
    // Read back the new generation so caller can inject it into agent context
    const genRow = await sql.unsafe("SELECT claim_generation FROM stories WHERE id = $1", [story.id]);
    story.claim_generation = (genRow[0] as any)?.claim_generation ?? 0;
    return story;
  });
}

export async function getNextDoneStory(runId: string): Promise<any | undefined> {
  return await pgGet("SELECT * FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY story_index ASC LIMIT 1", [runId]);
}

export async function getStoryInfo(storyId: string): Promise<{ story_id: string; title: string } | undefined> {
  return await pgGet<{ story_id: string; title: string }>("SELECT story_id, title FROM stories WHERE id = $1", [storyId]);
}

export async function updateStoryStatus(storyId: string, status: string, extra?: {
  output?: string; prUrl?: string; storyBranch?: string;
  retryCount?: number; abandonedCount?: number;
}): Promise<void> {
  const row = await pgGet<{ run_id: string }>("SELECT run_id FROM stories WHERE id = $1", [storyId]);
  const ts = now();
  const sets: string[] = ["status = $1", "updated_at = $2"];
  const vals: any[] = [status, ts];
  let idx = 3;
  if (extra?.output !== undefined) { sets.push(`output = $${idx}`); vals.push(extra.output); idx++; }
  if (extra?.prUrl !== undefined) { sets.push(`pr_url = $${idx}`); vals.push(extra.prUrl); idx++; }
  if (extra?.storyBranch !== undefined) { sets.push(`story_branch = $${idx}`); vals.push(extra.storyBranch); idx++; }
  if (extra?.retryCount !== undefined) { sets.push(`retry_count = $${idx}`); vals.push(extra.retryCount); idx++; }
  if (extra?.abandonedCount !== undefined) { sets.push(`abandoned_count = $${idx}`); vals.push(extra.abandonedCount); idx++; }
  vals.push(storyId);
  await pgRun(`UPDATE stories SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
  if (row?.run_id) {
    const { refreshRunContractSafe } = await import("./contract-ledger.js");
    await refreshRunContractSafe(row.run_id, `story.${status}`);
  }
}

// ── Step queries ────────────────────────────────────────────────────

export async function setStepStatus(stepId: string, status: string): Promise<number> {
  const result = await pgRun("UPDATE steps SET status = $1, updated_at = $2 WHERE id = $3",
    [status, now(), stepId]);
  return result.changes;
}

export async function setStepStatusConditional(stepId: string, newStatus: string, requiredStatus: string): Promise<number> {
  const result = await pgRun("UPDATE steps SET status = $1, updated_at = $2 WHERE id = $3 AND status = $4",
    [newStatus, now(), stepId, requiredStatus]);
  return result.changes;
}

export async function clearStepStory(stepId: string, output: string): Promise<void> {
  await pgRun("UPDATE steps SET current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3",
    [output, now(), stepId]);
}

export async function findLoopStep(runId: string): Promise<{ id: string; loop_config: string | null } | undefined> {
  return await pgGet<{ id: string; loop_config: string | null }>("SELECT id, loop_config FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [runId]);
}

export async function findActiveLoop(runId: string): Promise<{ id: string } | undefined> {
  return await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND type = 'loop' AND status NOT IN ('done', 'failed', 'waiting') LIMIT 1", [runId]);
}

export async function findVerifyStepByStepId(runId: string, stepId: string): Promise<{ id: string } | undefined> {
  return await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [runId, stepId]);
}

// ── Step Transition Recording ──────────────────────────────────────

/**
 * Record a step status transition in step_transitions table.
 * Best-effort — failures are silently logged to avoid breaking the pipeline.
 */
export async function recordStepTransition(
  stepId: string, runId: string, fromStatus: string | null, toStatus: string,
  agentId?: string, triggeredBy?: string, metadata?: Record<string, any>
): Promise<void> {
  try {
    await pgRun(
      "INSERT INTO step_transitions (step_id, run_id, from_status, to_status, agent_id, triggered_by, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [stepId, runId, fromStatus, toStatus, agentId || null, triggeredBy || null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (e) { /* best effort — don't break pipeline */ }
}
