/**
 * Medic — the setfarm health watchdog.
 *
 * Runs periodic health checks on workflow runs, detects stuck/stalled/dead state,
 * and takes corrective action where safe. Logs all findings to the medic_checks table.
 */
import { getDb } from "../db.js";
import { emitEvent, type EventType } from "../installer/events.js";
import { teardownWorkflowCronsIfIdle, ensureWorkflowCrons, removeAgentCrons, setupAgentCrons } from "../installer/agent-cron.js";
import { loadWorkflowSpec } from "../installer/workflow-spec.js";
import { resolveWorkflowDir } from "../installer/paths.js";
import { listCronJobs } from "../installer/gateway-api.js";
import {
  runSyncChecks,
  checkOrphanedCrons,
  type MedicFinding,
} from "./checks.js";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// ── DB Migration ────────────────────────────────────────────────────

export function ensureMedicTables(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS medic_checks (
      id TEXT PRIMARY KEY,
      checked_at TEXT NOT NULL,
      issues_found INTEGER DEFAULT 0,
      actions_taken INTEGER DEFAULT 0,
      summary TEXT,
      details TEXT
    )
  `);
}

// ── GitHub PR Helpers (Medic v6) ─────────────────────────────────────

/**
 * Extract GitHub repo URL from a run task string.
 */
function extractRepoUrl(task: string): string | null {
  const match = task.match(/https:\/\/github\.com\/[\w-]+\/[\w.-]+/);
  return match ? match[0] : null;
}

/**
 * Check GitHub for a merged PR matching this story.
 * Returns PR URL if found, null otherwise.
 */
function checkMergedPR(repoUrl: string, storyId: string, runId: string): string | null {
  const repoPath = repoUrl.replace("https://github.com/", "");
  const runPrefix = runId.slice(0, 8);
  const storyLower = storyId.toLowerCase().replace(/_/g, "-");
  try {
    const output = execFileSync(
      "gh",
      ["pr", "list", "--repo", repoPath, "--state", "merged", "--json", "number,url,headRefName", "--limit", "100"],
      { encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const prs = JSON.parse(output) as Array<{ number: number; url: string; headRefName: string }>;
    for (const pr of prs) {
      const branch = pr.headRefName.toLowerCase();
      if (
        branch === storyLower ||
        branch.includes("-" + storyLower) ||
        branch.includes("/" + storyLower) ||
        branch.startsWith(runPrefix + "-") ||
        branch.startsWith(runPrefix.toLowerCase() + "-")
      ) {
        return pr.url;
      }
    }
  } catch { /* gh unavailable or API error — fall through */ }
  return null;
}

// ── Remediation ─────────────────────────────────────────────────────

/**
 * Attempt to remediate a finding. Returns true if action was taken.
 */
async function remediate(finding: MedicFinding): Promise<boolean> {
  const db = getDb();

  switch (finding.action) {
    case "reset_step": {
      if (!finding.stepId) return false;
      const step = db.prepare(
        "SELECT abandoned_count FROM steps WHERE id = ?"
      ).get(finding.stepId) as { abandoned_count: number } | undefined;
      if (!step) return false;

      const newCount = (step.abandoned_count ?? 0) + 1;
      if (newCount >= 5) {
        db.prepare(
          "UPDATE steps SET status = 'failed', output = 'Medic: abandoned too many times', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(newCount, finding.stepId);
        if (finding.runId) {
          db.prepare(
            "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
          ).run(finding.runId);
          emitEvent({
            ts: new Date().toISOString(),
            event: "run.failed" as EventType,
            runId: finding.runId,
            detail: "Medic: step abandoned too many times",
          });
        }
        return true;
      }

      // SAFEGUARD_194: Medic resets use ONLY abandoned_count, NEVER retry_count.
      db.prepare(
        "UPDATE steps SET status = 'pending', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newCount, finding.stepId);
      if (finding.runId) {
        emitEvent({
          ts: new Date().toISOString(),
          event: "step.timeout" as EventType,
          runId: finding.runId,
          stepId: finding.stepId,
          detail: `Medic: reset stuck step (abandon ${newCount}/5)`,
        });
      }
      return true;
    }

    case "fail_run": {
      if (!finding.runId) return false;
      const run = db.prepare("SELECT status, workflow_id FROM runs WHERE id = ?").get(finding.runId) as { status: string; workflow_id: string } | undefined;
      if (!run || run.status !== "running") return false;

      db.prepare(
        "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
      ).run(finding.runId);
      db.prepare(
        "UPDATE steps SET status = 'failed', output = 'Medic: run marked as dead', updated_at = datetime('now') WHERE run_id = ? AND status IN ('waiting', 'pending', 'running')"
      ).run(finding.runId);
      emitEvent({
        ts: new Date().toISOString(),
        event: "run.failed" as EventType,
        runId: finding.runId,
        workflowId: run.workflow_id,
        detail: "Medic: zombie run — all steps terminal but run still marked running",
      });
      try { await teardownWorkflowCronsIfIdle(run.workflow_id); } catch {}
      return true;
    }

    case "teardown_crons": {
      const match = finding.message.match(/workflow "([^"]+)"/);
      if (!match) return false;
      try {
        await teardownWorkflowCronsIfIdle(match[1]);
        return true;
      } catch {
        return false;
      }
    }

    case "resume_run": {
      if (!finding.runId) return false;
      const run = db.prepare(
        "SELECT id, workflow_id, status, meta FROM runs WHERE id = ? AND status = 'failed'"
      ).get(finding.runId) as { id: string; workflow_id: string; status: string; meta: string | null } | undefined;
      if (!run) return false;

      const failedStep = db.prepare(
        "SELECT id, step_id, type, current_story_id FROM steps WHERE run_id = ? AND status = 'failed' ORDER BY step_index ASC LIMIT 1"
      ).get(run.id) as { id: string; step_id: string; type: string; current_story_id: string | null } | undefined;
      if (!failedStep) return false;

      const loopStep = db.prepare(
        "SELECT id, loop_config FROM steps WHERE run_id = ? AND type = 'loop' AND status IN ('running', 'failed') LIMIT 1"
      ).get(run.id) as { id: string; loop_config: string | null } | undefined;

      if (loopStep?.loop_config) {
        const lc = JSON.parse(loopStep.loop_config);
        if (lc.verifyEach && lc.verifyStep === failedStep.step_id) {
          db.prepare(
            "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
          ).run(loopStep.id);
          db.prepare(
            "UPDATE steps SET status = 'waiting', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
          ).run(failedStep.id);
          db.prepare(
            "UPDATE stories SET status = 'pending', updated_at = datetime('now') WHERE run_id = ? AND status = 'failed'"
          ).run(run.id);
        }
      } else {
        if (failedStep.type === "loop") {
          const failedStory = db.prepare(
            "SELECT id FROM stories WHERE run_id = ? AND status = 'failed' ORDER BY story_index ASC LIMIT 1"
          ).get(run.id) as { id: string } | undefined;
          if (failedStory) {
            db.prepare(
              "UPDATE stories SET status = 'pending', updated_at = datetime('now') WHERE id = ?"
            ).run(failedStory.id);
          }
          db.prepare(
            "UPDATE steps SET retry_count = 0 WHERE run_id = ? AND type = 'loop'"
          ).run(run.id);
        }
        db.prepare(
          "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
        ).run(failedStep.id);
      }

      db.prepare(
        "UPDATE runs SET status = 'running', updated_at = datetime('now') WHERE id = ?"
      ).run(run.id);

      const meta = run.meta ? JSON.parse(run.meta) : {};
      meta.medic_resume_count = (meta.medic_resume_count ?? 0) + 1;
      meta.medic_last_resume = new Date().toISOString();
      db.prepare("UPDATE runs SET meta = ? WHERE id = ?").run(JSON.stringify(meta), run.id);

      try {
        const workflowDir = resolveWorkflowDir(run.workflow_id);
        const workflow = await loadWorkflowSpec(workflowDir);
        await ensureWorkflowCrons(workflow);
      } catch {}

      emitEvent({
        ts: new Date().toISOString(),
        event: "run.resumed" as EventType,
        runId: run.id,
        workflowId: run.workflow_id,
        detail: `Medic: auto-resumed (attempt ${meta.medic_resume_count}/3)`,
      });
      return true;
    }

    // ── #225: Reset orphaned story to pending ───────────────────────
    case "reset_story": {
      if (!finding.storyId) return false;
      const story = db.prepare(
        "SELECT abandoned_count, run_id FROM stories WHERE id = ? AND status = 'running'"
      ).get(finding.storyId) as { abandoned_count: number; run_id: string } | undefined;
      if (!story) return false;


      // ── Medic v6: GitHub PR guard ───────────────────────────────────────
      // Before resetting, check if the agent already merged a PR on GitHub.
      // If yes → auto-verify instead of wasting another cycle.
      const storyMeta = db.prepare(
        "SELECT story_id FROM stories WHERE id = ?"
      ).get(finding.storyId) as { story_id: string } | undefined;
      const runMeta = db.prepare(
        "SELECT task FROM runs WHERE id = ?"
      ).get(story.run_id) as { task: string } | undefined;
      if (storyMeta && runMeta) {
        const repoUrl = extractRepoUrl(runMeta.task);
        if (repoUrl) {
          const prUrl = checkMergedPR(repoUrl, storyMeta.story_id, story.run_id);
          if (prUrl) {
            db.prepare(
              "UPDATE stories SET status = 'verified', abandoned_count = 0, output = ?, updated_at = datetime('now') WHERE id = ?"
            ).run(
              `STATUS: done
PR_URL: ${prUrl}
CHANGES: Auto-verified by Medic v6 — merged PR detected on GitHub`,
              finding.storyId
            );
            db.prepare(
              "UPDATE steps SET current_story_id = NULL, updated_at = datetime('now') WHERE run_id = ? AND type = 'loop' AND current_story_id = ?"
            ).run(story.run_id, finding.storyId);
            emitEvent({
              ts: new Date().toISOString(),
              event: "story.done" as EventType,
              runId: story.run_id,
              detail: `Medic v6: auto-verified ${storyMeta.story_id} — merged PR: ${prUrl}`,
            });
            return true;
          }
        }
      }
      // ── End GitHub PR guard ─────────────────────────────────────────────

      const newCount = (story.abandoned_count ?? 0) + 1;
      const MAX_STORY_ABANDONS = 5;

      if (newCount >= MAX_STORY_ABANDONS) {
        // Too many abandons — skip this story so the loop can continue
        db.prepare(
          "UPDATE stories SET status = 'skipped', abandoned_count = ?, output = 'Medic: abandoned too many times', updated_at = datetime('now') WHERE id = ?"
        ).run(newCount, finding.storyId);
        emitEvent({
          ts: new Date().toISOString(),
          event: "story.failed" as EventType,
          runId: story.run_id,
          detail: `Medic: story abandoned ${newCount} times — skipped`,
        });
      } else {
        // Reset to pending for retry (uses abandoned_count, NOT retry_count)
        db.prepare(
          "UPDATE stories SET status = 'pending', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(newCount, finding.storyId);
        // Clear current_story_id on the loop step if it points to this story
        db.prepare(
          "UPDATE steps SET current_story_id = NULL, updated_at = datetime('now') WHERE run_id = ? AND type = 'loop' AND current_story_id = ?"
        ).run(story.run_id, finding.storyId);
        emitEvent({
          ts: new Date().toISOString(),
          event: "step.timeout" as EventType,
          runId: story.run_id,
          detail: `Medic: orphaned story reset to pending (abandon ${newCount}/${MAX_STORY_ABANDONS})`,
        });
      }
      return true;
    }

    // ── #218: Circuit breaker — force-recreate dead crons ───────────
    case "recreate_crons": {
      const wfId = finding.workflowId ?? finding.message.match(/workflow "([^"]+)"/)?.[1];
      if (!wfId) return false;
      try {
        // Delete all existing (possibly errored) crons for this workflow
        await removeAgentCrons(wfId);
        // Recreate from workflow spec
        const workflowDir = resolveWorkflowDir(wfId);
        const workflow = await loadWorkflowSpec(workflowDir);
        await setupAgentCrons(workflow);
        emitEvent({
          ts: new Date().toISOString(),
          event: "run.resumed" as EventType,
          runId: finding.runId ?? "",
          workflowId: wfId,
          detail: `Medic: circuit breaker — force-recreated crons for "${wfId}"`,
        });
        return true;
      } catch {
        return false;
      }
    }

    case "none":
    default:
      return false;
  }
}

// ── Main Check Runner ───────────────────────────────────────────────

export interface MedicCheckResult {
  id: string;
  checkedAt: string;
  issuesFound: number;
  actionsTaken: number;
  summary: string;
  findings: MedicFinding[];
}

/**
 * Restore crons for any active runs that lost them (e.g. after gateway restart).
 * Called once at medic startup and periodically during checks.
 */
export async function restoreActiveRunCrons(): Promise<number> {
  const db = getDb();
  const activeRuns = db.prepare(
    "SELECT DISTINCT workflow_id FROM runs WHERE status = 'running'"
  ).all() as Array<{ workflow_id: string }>;

  let restored = 0;
  for (const run of activeRuns) {
    try {
      const workflowDir = resolveWorkflowDir(run.workflow_id);
      const workflow = await loadWorkflowSpec(workflowDir);
      await ensureWorkflowCrons(workflow);
      restored++;
    } catch (err) {
      // Workflow may not exist anymore — skip
    }
  }
  return restored;
}

export async function runMedicCheck(): Promise<MedicCheckResult> {
  ensureMedicTables();

  // Restore crons for active runs (fixes #183 — lost crons after restart)
  try { await restoreActiveRunCrons(); } catch {}

  // Gather all findings
  const findings: MedicFinding[] = runSyncChecks();

  // Async check: orphaned crons
  try {
    const cronResult = await listCronJobs();
    if (cronResult.ok && cronResult.jobs) {
      const setfarmCrons = cronResult.jobs.filter(j => j.name.startsWith("setfarm/"));
      findings.push(...checkOrphanedCrons(setfarmCrons));
    }
  } catch {
    // Can't check crons — skip this check
  }

  // Remediate
  let actionsTaken = 0;
  for (const finding of findings) {
    if (finding.action !== "none") {
      const success = await remediate(finding);
      if (success) {
        finding.remediated = true;
        actionsTaken++;
      }
    }
  }

  // Build summary
  const parts: string[] = [];
  if (findings.length === 0) {
    parts.push("All clear — no issues found");
  } else {
    const critical = findings.filter(f => f.severity === "critical").length;
    const warnings = findings.filter(f => f.severity === "warning").length;
    if (critical > 0) parts.push(`${critical} critical`);
    if (warnings > 0) parts.push(`${warnings} warning(s)`);
    if (actionsTaken > 0) parts.push(`${actionsTaken} auto-fixed`);
  }
  const summary = parts.join(", ");

  // Log to DB
  const checkId = crypto.randomUUID();
  const checkedAt = new Date().toISOString();
  const db = getDb();
  db.prepare(
    "INSERT INTO medic_checks (id, checked_at, issues_found, actions_taken, summary, details) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(checkId, checkedAt, findings.length, actionsTaken, summary, JSON.stringify(findings));

  // Prune old checks (keep last 500)
  db.prepare(`
    DELETE FROM medic_checks WHERE id NOT IN (
      SELECT id FROM medic_checks ORDER BY checked_at DESC LIMIT 500
    )
  `).run();

  return {
    id: checkId,
    checkedAt,
    issuesFound: findings.length,
    actionsTaken,
    summary,
    findings,
  };
}

// ── Query Helpers ───────────────────────────────────────────────────

export interface MedicStatus {
  installed: boolean;
  lastCheck: { checkedAt: string; summary: string; issuesFound: number; actionsTaken: number } | null;
  recentChecks: number;
  recentIssues: number;
  recentActions: number;
}

export function getMedicStatus(): MedicStatus {
  try {
    ensureMedicTables();
    const db = getDb();

    const last = db.prepare(
      "SELECT checked_at, summary, issues_found, actions_taken FROM medic_checks ORDER BY checked_at DESC LIMIT 1"
    ).get() as { checked_at: string; summary: string; issues_found: number; actions_taken: number } | undefined;

    const stats = db.prepare(`
      SELECT COUNT(*) as checks, COALESCE(SUM(issues_found), 0) as issues, COALESCE(SUM(actions_taken), 0) as actions
      FROM medic_checks
      WHERE checked_at > datetime('now', '-24 hours')
    `).get() as { checks: number; issues: number; actions: number };

    return {
      installed: true,
      lastCheck: last ? {
        checkedAt: last.checked_at,
        summary: last.summary,
        issuesFound: last.issues_found,
        actionsTaken: last.actions_taken,
      } : null,
      recentChecks: stats.checks,
      recentIssues: stats.issues,
      recentActions: stats.actions,
    };
  } catch {
    return { installed: false, lastCheck: null, recentChecks: 0, recentIssues: 0, recentActions: 0 };
  }
}

export function getRecentMedicChecks(limit = 20): Array<{
  id: string;
  checkedAt: string;
  issuesFound: number;
  actionsTaken: number;
  summary: string;
  details: MedicFinding[];
}> {
  try {
    ensureMedicTables();
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM medic_checks ORDER BY checked_at DESC LIMIT ?"
    ).all(limit) as Array<{
      id: string; checked_at: string; issues_found: number;
      actions_taken: number; summary: string; details: string;
    }>;

    return rows.map(r => ({
      id: r.id,
      checkedAt: r.checked_at,
      issuesFound: r.issues_found,
      actionsTaken: r.actions_taken,
      summary: r.summary,
      details: JSON.parse(r.details ?? "[]"),
    }));
  } catch {
    return [];
  }
}
