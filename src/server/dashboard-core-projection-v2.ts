import type { RunInfo, StepInfo } from "../installer/status.js";
import { isSetfarmOperationalActiveRunStatusV1 } from "../contracts/operational-active-run-status-v1.js";

// Shared legacy value projection, not an input validator or reader authority.
export type DashboardRunInfo = RunInfo & {
  steps: StepInfo[];
  operationalActive: boolean;
  terminal: boolean;
  derived_status: "active" | "terminal" | "completed" | "queued";
};

function dashboardDerivedStatus(
  run: RunInfo,
  operationalActive: boolean,
): DashboardRunInfo["derived_status"] {
  const status = String(run.status || "").trim().toLowerCase();
  if (operationalActive) return "active";
  if (status === "completed" || status === "done") return "completed";
  if (
    status === "failed"
    || status === "cancelled"
    || status === "canceled"
    || status === "error"
  ) return "terminal";
  return "queued";
}

export function projectDashboardRunForApi(
  run: RunInfo & { steps: StepInfo[] },
  options: { includeTerminal?: boolean } = {},
): DashboardRunInfo | null {
  const operationalActive = isSetfarmOperationalActiveRunStatusV1(run.status);
  if (!options.includeTerminal && !operationalActive) return null;
  const derivedStatus = dashboardDerivedStatus(run, operationalActive);
  return {
    ...run,
    operationalActive,
    terminal: derivedStatus === "terminal",
    derived_status: derivedStatus,
  };
}

type ObservationFieldV2 =
  | "id" | "run_id" | "step_id" | "story_id" | "agent_id" | "phase"
  | "check_id" | "label" | "status" | "summary" | "detail" | "event_type"
  | "started_at" | "completed_at" | "created_at" | "updated_at"
  | "evidence" | "file_paths" | "github" | "metadata";

export type DashboardObservationProjectionRowV2 = Record<ObservationFieldV2, unknown>;

export function projectDashboardObservationForApiV2(row: DashboardObservationProjectionRowV2) {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    storyId: row.story_id,
    agentId: row.agent_id,
    phase: row.phase,
    checkId: row.check_id,
    label: row.label,
    status: row.status,
    summary: row.summary,
    detail: row.detail,
    eventType: row.event_type,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: safeJson(row.evidence, {}),
    filePaths: safeJson(row.file_paths, []),
    github: safeJson(row.github, {}),
    metadata: safeJson(row.metadata, {}),
  };
}

function safeJson(raw: unknown, fallback: unknown): unknown {
  if (raw == null || raw === "") return fallback;
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}
