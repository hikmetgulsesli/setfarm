/**
 * Medic — the setfarm health watchdog.
 *
 * Runs periodic health checks on workflow runs, detects stuck/stalled/dead state,
 * and takes corrective action where safe. Logs all findings to the medic_checks table.
 */
import { getDb } from "../db.js";
import { emitEvent, type EventType } from "../installer/events.js";
import { teardownWorkflowCronsIfIdle, ensureWorkflowCrons } from "../installer/agent-cron.js";
import { loadWorkflowSpec } from "../installer/workflow-spec.js";
import { resolveWorkflowDir } from "../installer/paths.js";
import { listCronJobs } from "../installer/gateway-api.js";
import {
  runSyncChecks,
  checkOrphanedCrons,
  type MedicFinding,
} from "./checks.js";
import crypto from "node:crypto";

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

// ── Remediation ─────────────────────────────────────────────────────

/**
 * Attempt to remediate a finding. Returns true if action was taken.
 */
async function remediate(finding: MedicFinding): Promise<boolean> {
  const db = getDb();

  switch (finding.action) {
    case "reset_step": {
      if (!finding.stepId) return false;
      // Reset the stuck step to pending so it can be reclaimed
      const step = db.prepare(
        "SELECT abandoned_count FROM steps WHERE id = ?"
      ).get(finding.stepId) as { abandoned_count: number } | undefined;
      if (!step) return false;

      const newCount = (step.abandoned_count ?? 0) + 1;
      // Don't auto-reset if already abandoned too many times — let cleanupAbandonedSteps handle final failure
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
      // This preserves retry budget for real failures (agent explicitly calling step fail).
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
      // Also fail any non-terminal steps
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
      // Try to clean up crons
      try { await teardownWorkflowCronsIfIdle(run.workflow_id); } catch {}
      return true;
    }

    case "teardown_crons": {
      // Extract workflow ID from the message (format: "... for workflow "xyz" ...")
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

      // Find the failed step
      const failedStep = db.prepare(
        "SELECT id, step_id, type, current_story_id FROM steps WHERE run_id = ? AND status = 'failed' ORDER BY step_index ASC LIMIT 1"
      ).get(run.id) as { id: string; step_id: string; type: string; current_story_id: string | null } | undefined;
      if (!failedStep) return false;

      // Check if it's a loop step with verify_each pattern
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
        // Simple step reset
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

      // Set run back to running
      db.prepare(
        "UPDATE runs SET status = 'running', updated_at = datetime('now') WHERE id = ?"
      ).run(run.id);

      // Update medic resume metadata
      const meta = run.meta ? JSON.parse(run.meta) : {};
      meta.medic_resume_count = (meta.medic_resume_count ?? 0) + 1;
      meta.medic_last_resume = new Date().toISOString();
      db.prepare("UPDATE runs SET meta = ? WHERE id = ?").run(JSON.stringify(meta), run.id);

      // Restore crons
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
 * Run all medic checks, remediate what we can, and log results.
 */
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
  recentChecks: number; // checks in last 24h
  recentIssues: number; // issues found in last 24h
  recentActions: number; // actions taken in last 24h
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
