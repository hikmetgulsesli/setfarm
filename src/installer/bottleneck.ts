/**
 * Bottleneck Detection Algorithm
 *
 * Analyzes pipeline run data to identify performance bottlenecks:
 * - Queue bottlenecks (slow claim times)
 * - Execution bottlenecks (slow step completion)
 * - Reliability bottlenecks (excessive retries)
 * - Story thrashing (repeated claims without completion)
 * - Parallelism saturation (all slots busy for extended periods)
 */

import { pgQuery, pgGet } from "../db-pg.js";

export interface BottleneckFlag {
  type: "queue_bottleneck" | "execution_bottleneck" | "reliability_bottleneck" | "story_thrashing" | "parallelism_saturated";
  stepId?: string;
  storyId?: string;
  message: string;
  value: number;
  threshold: number;
}

/**
 * Detect bottlenecks for a given run. Uses step_transitions if data exists,
 * falls back to steps.updated_at timestamps otherwise.
 */
export async function detectBottlenecks(runId: string): Promise<BottleneckFlag[]> {
  const flags: BottleneckFlag[] = [];

  // Check if step_transitions has data for this run
  const transitionCount = await pgGet<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM step_transitions WHERE run_id = $1",
    [runId]
  );
  const hasTransitions = Number(transitionCount?.cnt ?? 0) > 0;

  await detectQueueBottlenecks(runId, hasTransitions, flags);
  await detectExecutionBottlenecks(runId, hasTransitions, flags);
  await detectReliabilityBottlenecks(runId, flags);
  await detectStoryThrashing(runId, flags);
  await detectParallelismSaturation(runId, flags);

  return flags;
}

// ── 1. Queue Bottleneck ────────────────────────────────────────────

/**
 * Time from pending → running > 2× average for this run.
 * Indicates agents are overloaded or crons are not firing fast enough.
 */
async function detectQueueBottlenecks(
  runId: string, hasTransitions: boolean, flags: BottleneckFlag[]
): Promise<void> {
  if (hasTransitions) {
    // Use step_transitions for precise timing
    const rows = await pgQuery<{
      step_id: string;
      wait_ms: string;
      avg_wait_ms: string;
    }>(
      `WITH pending_to_running AS (
        SELECT
          t1.step_id,
          EXTRACT(EPOCH FROM (t2.transitioned_at::timestamptz - t1.transitioned_at::timestamptz)) * 1000 AS wait_ms
        FROM step_transitions t1
        JOIN step_transitions t2
          ON t2.step_id = t1.step_id AND t2.run_id = t1.run_id
          AND t2.from_status = 'pending' AND t2.to_status = 'running'
          AND t2.transitioned_at > t1.transitioned_at
        WHERE t1.run_id = $1
          AND t1.to_status = 'pending'
        -- Pick the earliest running transition after each pending
        AND t2.transitioned_at = (
          SELECT MIN(t3.transitioned_at) FROM step_transitions t3
          WHERE t3.step_id = t1.step_id AND t3.run_id = t1.run_id
            AND t3.from_status = 'pending' AND t3.to_status = 'running'
            AND t3.transitioned_at > t1.transitioned_at
        )
      )
      SELECT
        step_id,
        wait_ms::TEXT,
        (AVG(wait_ms) OVER ())::TEXT AS avg_wait_ms
      FROM pending_to_running
      ORDER BY wait_ms DESC`,
      [runId]
    );

    if (rows.length < 2) return; // Need at least 2 data points

    const avgWait = parseFloat(rows[0]?.avg_wait_ms ?? "0");
    const threshold = avgWait * 2;

    for (const row of rows) {
      const waitMs = parseFloat(row.wait_ms);
      if (waitMs > threshold && waitMs > 30000) { // at least 30s absolute
        flags.push({
          type: "queue_bottleneck",
          stepId: row.step_id,
          message: `Step ${row.step_id} waited ${Math.round(waitMs / 1000)}s in queue (avg: ${Math.round(avgWait / 1000)}s)`,
          value: Math.round(waitMs),
          threshold: Math.round(threshold),
        });
      }
    }
  } else {
    // Fallback: use steps table timestamps (less precise)
    const rows = await pgQuery<{
      id: string; step_id: string; created_at: string; started_at: string | null;
    }>(
      "SELECT id, step_id, created_at, started_at FROM steps WHERE run_id = $1 AND started_at IS NOT NULL ORDER BY step_index",
      [runId]
    );

    if (rows.length < 2) return;

    const waits = rows.map(r => ({
      stepId: r.step_id,
      waitMs: new Date(r.started_at!).getTime() - new Date(r.created_at).getTime(),
    })).filter(w => w.waitMs > 0);

    if (waits.length < 2) return;

    const avgWait = waits.reduce((sum, w) => sum + w.waitMs, 0) / waits.length;
    const threshold = avgWait * 2;

    for (const w of waits) {
      if (w.waitMs > threshold && w.waitMs > 30000) {
        flags.push({
          type: "queue_bottleneck",
          stepId: w.stepId,
          message: `Step ${w.stepId} waited ${Math.round(w.waitMs / 1000)}s in queue (avg: ${Math.round(avgWait / 1000)}s)`,
          value: Math.round(w.waitMs),
          threshold: Math.round(threshold),
        });
      }
    }
  }
}

// ── 2. Execution Bottleneck ─────────��──────────────────────────────

/**
 * Time from running → done > 3× median for this run.
 * Indicates a step or story is taking much longer than expected.
 */
async function detectExecutionBottlenecks(
  runId: string, hasTransitions: boolean, flags: BottleneckFlag[]
): Promise<void> {
  if (hasTransitions) {
    const rows = await pgQuery<{
      step_id: string;
      exec_ms: string;
    }>(
      `SELECT
        t1.step_id,
        (EXTRACT(EPOCH FROM (t2.transitioned_at::timestamptz - t1.transitioned_at::timestamptz)) * 1000)::TEXT AS exec_ms
      FROM step_transitions t1
      JOIN step_transitions t2
        ON t2.step_id = t1.step_id AND t2.run_id = t1.run_id
        AND t2.from_status = 'running' AND t2.to_status IN ('done', 'waiting')
        AND t2.transitioned_at > t1.transitioned_at
      WHERE t1.run_id = $1
        AND t1.to_status = 'running'
      AND t2.transitioned_at = (
        SELECT MIN(t3.transitioned_at) FROM step_transitions t3
        WHERE t3.step_id = t1.step_id AND t3.run_id = t1.run_id
          AND t3.from_status = 'running' AND t3.to_status IN ('done', 'waiting')
          AND t3.transitioned_at > t1.transitioned_at
      )
      ORDER BY exec_ms DESC`,
      [runId]
    );

    if (rows.length < 2) return;

    const durations = rows.map(r => parseFloat(r.exec_ms)).sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];
    const threshold = median * 3;

    for (const row of rows) {
      const execMs = parseFloat(row.exec_ms);
      if (execMs > threshold && execMs > 60000) { // at least 1min absolute
        flags.push({
          type: "execution_bottleneck",
          stepId: row.step_id,
          message: `Step ${row.step_id} ran for ${Math.round(execMs / 1000)}s (median: ${Math.round(median / 1000)}s)`,
          value: Math.round(execMs),
          threshold: Math.round(threshold),
        });
      }
    }
  } else {
    // Fallback: use steps table (started_at → updated_at for done steps)
    const rows = await pgQuery<{
      step_id: string; started_at: string; updated_at: string;
    }>(
      "SELECT step_id, started_at, updated_at FROM steps WHERE run_id = $1 AND status IN ('done', 'verified', 'skipped') AND started_at IS NOT NULL ORDER BY step_index",
      [runId]
    );

    if (rows.length < 2) return;

    const durations = rows.map(r => ({
      stepId: r.step_id,
      execMs: new Date(r.updated_at).getTime() - new Date(r.started_at).getTime(),
    })).filter(d => d.execMs > 0).sort((a, b) => a.execMs - b.execMs);

    if (durations.length < 2) return;

    const median = durations[Math.floor(durations.length / 2)].execMs;
    const threshold = median * 3;

    for (const d of durations) {
      if (d.execMs > threshold && d.execMs > 60000) {
        flags.push({
          type: "execution_bottleneck",
          stepId: d.stepId,
          message: `Step ${d.stepId} ran for ${Math.round(d.execMs / 1000)}s (median: ${Math.round(median / 1000)}s)`,
          value: Math.round(d.execMs),
          threshold: Math.round(threshold),
        });
      }
    }
  }
}

// ��─ 3. Reliability Bottleneck ────────���─────────────────────────────

/**
 * Steps with retry_count >= 3 indicate flaky or consistently failing steps.
 */
async function detectReliabilityBottlenecks(
  runId: string, flags: BottleneckFlag[]
): Promise<void> {
  const RETRY_THRESHOLD = 3;

  const rows = await pgQuery<{
    id: string; step_id: string; retry_count: number; abandoned_count: number;
  }>(
    "SELECT id, step_id, retry_count, COALESCE(abandoned_count, 0) as abandoned_count FROM steps WHERE run_id = $1 AND retry_count >= $2",
    [runId, RETRY_THRESHOLD]
  );

  for (const row of rows) {
    const total = row.retry_count + row.abandoned_count;
    flags.push({
      type: "reliability_bottleneck",
      stepId: row.step_id,
      message: `Step ${row.step_id} retried ${row.retry_count}x (${row.abandoned_count} abandons) — possible flaky step`,
      value: total,
      threshold: RETRY_THRESHOLD,
    });
  }

  // Also check stories
  const storyRows = await pgQuery<{
    id: string; story_id: string; retry_count: number; abandoned_count: number;
  }>(
    "SELECT id, story_id, retry_count, COALESCE(abandoned_count, 0) as abandoned_count FROM stories WHERE run_id = $1 AND retry_count >= $2",
    [runId, RETRY_THRESHOLD]
  );

  for (const row of storyRows) {
    flags.push({
      type: "reliability_bottleneck",
      storyId: row.story_id,
      message: `Story ${row.story_id} retried ${row.retry_count}x (${row.abandoned_count} abandons)`,
      value: row.retry_count + row.abandoned_count,
      threshold: RETRY_THRESHOLD,
    });
  }
}

// ── 4. Story Thrashing ─────────────────────────────────────────────

/**
 * Stories claimed > 3 times without completing — agents keep picking up
 * and dropping the same story.
 */
async function detectStoryThrashing(
  runId: string, flags: BottleneckFlag[]
): Promise<void> {
  const CLAIM_THRESHOLD = 3;

  // Check claim_log for multiple claims on the same story
  try {
    const rows = await pgQuery<{
      story_id: string; claim_count: string;
    }>(
      `SELECT story_id, COUNT(*)::TEXT as claim_count
       FROM claim_log
       WHERE run_id = $1 AND story_id IS NOT NULL
       GROUP BY story_id
       HAVING COUNT(*) > $2
       ORDER BY COUNT(*) DESC`,
      [runId, CLAIM_THRESHOLD]
    );

    for (const row of rows) {
      const claimCount = parseInt(row.claim_count, 10);
      flags.push({
        type: "story_thrashing",
        storyId: row.story_id,
        message: `Story ${row.story_id} claimed ${claimCount} times — possible thrashing`,
        value: claimCount,
        threshold: CLAIM_THRESHOLD,
      });
    }
  } catch {
    // claim_log table might not exist in older setups
  }
}

// ── 5. Parallelism Saturation ──────────────────────────────────────

/**
 * Detect when all parallel slots are busy, causing queue buildup.
 * Uses run context (parallel_count) and compares with concurrent running stories.
 */
async function detectParallelismSaturation(
  runId: string, flags: BottleneckFlag[]
): Promise<void> {
  // Get parallel_count from run context
  const runRow = await pgGet<{ context: string }>(
    "SELECT context FROM runs WHERE id = $1", [runId]
  );
  if (!runRow?.context) return;

  let parallelCount: number;
  try {
    const ctx = JSON.parse(runRow.context);
    parallelCount = parseInt(ctx.parallel_count || ctx.PARALLEL_COUNT || "6", 10);
  } catch {
    parallelCount = 6; // default
  }

  // Count total stories and max concurrent running
  const totalStories = await pgGet<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1", [runId]
  );
  const total = parseInt(totalStories?.cnt ?? "0", 10);
  if (total <= parallelCount) return; // Not enough stories to saturate

  // Check if stories are queued up (pending while slots are full)
  const pendingWhileRunning = await pgGet<{ pending_cnt: string; running_cnt: string }>(
    `SELECT
      (SELECT COUNT(*) FROM stories WHERE run_id = $1 AND status = 'pending')::TEXT as pending_cnt,
      (SELECT COUNT(*) FROM stories WHERE run_id = $1 AND status = 'running')::TEXT as running_cnt`,
    [runId]
  );

  const pendingCount = parseInt(pendingWhileRunning?.pending_cnt ?? "0", 10);
  const runningCount = parseInt(pendingWhileRunning?.running_cnt ?? "0", 10);

  // If running == parallel_count and there are pending stories waiting, parallelism is saturated
  if (runningCount >= parallelCount && pendingCount > 0) {
    flags.push({
      type: "parallelism_saturated",
      message: `All ${parallelCount} parallel slots busy with ${pendingCount} stories waiting — consider increasing parallel_count`,
      value: runningCount,
      threshold: parallelCount,
    });
  }

  // Historical check: use claim_log to see if average wait-to-claim is increasing
  try {
    const avgWait = await pgGet<{ avg_wait: string }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (claimed_at::timestamptz -
        (SELECT MIN(cl2.claimed_at) FROM claim_log cl2 WHERE cl2.run_id = $1)::timestamptz
       )))::TEXT as avg_wait
       FROM claim_log WHERE run_id = $1 AND story_id IS NOT NULL`,
      [runId]
    );
    // This is informational — the current running/pending check above is the primary indicator
  } catch {
    // claim_log might not exist
  }
}
