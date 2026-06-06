import crypto from "node:crypto";
import { pgRun } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import type { SetfarmEvent } from "./events.js";

export type ObservationStatus = "pending" | "running" | "pass" | "fail" | "retry" | "blocked" | "info";

export interface RunObservationInput {
  runId: string;
  stepId: string;
  storyId?: string | null;
  agentId?: string | null;
  phase?: string | null;
  checkId: string;
  label: string;
  status: ObservationStatus | string;
  summary?: string | null;
  detail?: string | null;
  evidence?: Record<string, unknown> | null;
  filePaths?: string[] | null;
  github?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  eventType?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

function jsonText(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback));
  } catch {
    return fallback;
  }
}

function statusForEvent(event: string): ObservationStatus {
  if (event.endsWith(".running") || event.endsWith(".started")) return "running";
  if (event.endsWith(".done") || event.endsWith(".completed") || event.endsWith(".verified")) return "pass";
  if (event.endsWith(".failed") || event.endsWith(".timeout") || event.endsWith(".skipped") || event.endsWith(".cancelled")) return "fail";
  if (event.endsWith(".retry")) return "retry";
  if (event.endsWith(".pending")) return "pending";
  if (event.endsWith(".progress") || event.endsWith(".advanced")) return "info";
  return "info";
}

function labelForEvent(evt: SetfarmEvent): string {
  const scope = evt.storyId ? `Story ${evt.storyId}` : evt.stepId ? `Step ${evt.stepId}` : "Run";
  return `${scope} ${evt.event.replace(/^[^.]+\./, "")}`.replace(/[-_]/g, " ");
}

function phaseForStep(stepId: string | undefined): string {
  const value = String(stepId || "");
  if (["plan", "design", "stories"].includes(value)) return "planning";
  if (["setup-repo", "setup-build", "implement"].includes(value)) return "building";
  if (["verify", "supervise", "security-gate", "qa-test", "final-test"].includes(value)) return "quality";
  if (value === "deploy") return "deploy";
  return "operations";
}

export async function recordObservation(input: RunObservationInput): Promise<void> {
  const runId = String(input.runId || "").trim();
  const stepId = String(input.stepId || "").trim() || "run";
  const checkId = String(input.checkId || "").trim() || "observation";
  if (!runId) return;

  try {
    await pgRun(
      `INSERT INTO run_observations (
        id, run_id, step_id, story_id, agent_id, phase, check_id, label, status,
        summary, detail, evidence, file_paths, github, metadata, event_type,
        started_at, completed_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, NOW(), NOW()
      )`,
      [
        crypto.randomUUID(),
        runId,
        stepId,
        String(input.storyId || ""),
        input.agentId || null,
        input.phase || phaseForStep(stepId),
        checkId,
        input.label,
        String(input.status || "info"),
        input.summary || null,
        input.detail || null,
        jsonText(input.evidence || {}, "{}"),
        jsonText(input.filePaths || [], "[]"),
        jsonText(input.github || {}, "{}"),
        jsonText(input.metadata || {}, "{}"),
        input.eventType || null,
        input.startedAt || null,
        input.completedAt || null,
      ],
    );
  } catch (error) {
    logger.warn(`[observations] write failed: ${String(error).slice(0, 180)}`, { runId, stepId });
  }
}

export function recordEventObservation(evt: SetfarmEvent): void {
  const status = statusForEvent(evt.event);
  const timestamp = evt.ts || new Date().toISOString();
  const detail = String(evt.detail || "").trim();
  recordObservation({
    runId: evt.runId,
    stepId: evt.stepId || "run",
    storyId: evt.storyId || "",
    agentId: evt.agentId || "",
    phase: phaseForStep(evt.stepId),
    checkId: `${evt.event}:${timestamp}:${crypto.createHash("sha1").update(detail).digest("hex").slice(0, 10)}`,
    label: labelForEvent(evt),
    status,
    summary: detail || evt.storyTitle || evt.event,
    detail,
    eventType: evt.event,
    startedAt: status === "running" ? timestamp : null,
    completedAt: ["pass", "fail", "retry", "blocked"].includes(status) ? timestamp : null,
    metadata: {
      workflowId: evt.workflowId || "",
      storyTitle: evt.storyTitle || "",
    },
  }).catch(() => {});
}
