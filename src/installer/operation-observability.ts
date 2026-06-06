import { recordObservation, type ObservationStatus } from "./observations.js";
import {
  evidenceClassesForStep,
  resolveOperationalStackContract,
  stackEvidenceMetadata,
  stackEvidenceSummary,
} from "./stack-evidence.js";

export interface StepLike {
  run_id: string;
  step_id: string;
  agent_id?: string | null;
  retry_count?: number | null;
  max_retries?: number | null;
}

function compact(value: unknown, max: number): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function observationStatusFromOutputStatus(status: string | undefined): ObservationStatus {
  const value = String(status || "done").trim().toLowerCase();
  if (value === "done" || value === "skip") return "pass";
  if (value === "retry") return "retry";
  if (value === "fail" || value === "failed" || value === "error") return "fail";
  return "info";
}

export async function recordStepOutputObservation(
  step: StepLike,
  parsed: Record<string, string | undefined>,
  output: string,
  context: Record<string, string>,
): Promise<void> {
  const status = observationStatusFromOutputStatus(parsed["status"]);
  const contract = resolveOperationalStackContract(context, false);
  const evidenceClasses = evidenceClassesForStep(step.step_id, contract);
  await recordObservation({
    runId: step.run_id,
    stepId: step.step_id,
    agentId: step.agent_id || "",
    checkId: `step-output:${step.step_id}`,
    label: `${step.step_id} output`,
    status,
    summary: compact(parsed["result"] || parsed["summary"] || parsed["changes"] || output, 300),
    detail: compact(output, 1500),
    eventType: `step.output.${status}`,
    completedAt: ["pass", "fail", "retry", "blocked"].includes(status) ? new Date().toISOString() : null,
    metadata: {
      retryCount: step.retry_count || 0,
      maxRetries: step.max_retries || 0,
      evidenceClasses,
      ...stackEvidenceMetadata(contract),
    },
  });
}

export async function recordStackEvidencePlanObservation(
  step: StepLike,
  context: Record<string, string>,
  status: ObservationStatus = "info",
  detail?: string,
): Promise<void> {
  const contract = resolveOperationalStackContract(context, false);
  const classes = evidenceClassesForStep(step.step_id, contract);
  if (classes.length === 0 && step.step_id !== "deploy") return;
  await recordObservation({
    runId: step.run_id,
    stepId: step.step_id,
    agentId: step.agent_id || "",
    checkId: `stack-evidence:${step.step_id}`,
    label: `${step.step_id} stack evidence`,
    status,
    summary: `${contract.packId || "unknown stack"} evidence: ${classes.join(", ") || "none"}`,
    detail: detail || stackEvidenceSummary(contract),
    eventType: "stack.evidence",
    metadata: {
      evidenceClasses: classes,
      ...stackEvidenceMetadata(contract),
    },
  });
}

export async function recordGateObservation(input: {
  runId: string;
  stepId: string;
  agentId?: string | null;
  storyId?: string | null;
  checkId: string;
  label: string;
  status: ObservationStatus;
  summary: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await recordObservation({
    runId: input.runId,
    stepId: input.stepId,
    storyId: input.storyId || "",
    agentId: input.agentId || "",
    checkId: input.checkId,
    label: input.label,
    status: input.status,
    summary: compact(input.summary, 300),
    detail: compact(input.detail || input.summary, 1500),
    eventType: `gate.${input.status}`,
    metadata: input.metadata || {},
    completedAt: ["pass", "fail", "retry", "blocked"].includes(input.status) ? new Date().toISOString() : null,
  });
}
