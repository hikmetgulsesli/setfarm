export type SupervisorRunStatus = "idle" | "running" | "blocked" | "done";

export interface SupervisorRunMetadata {
  runId: string;
  workdir: string;
  supervisorSessionId?: string;
  status: SupervisorRunStatus;
  activeWorkers: number;
  activeFixers: number;
  updatedAt: string;
}

const runs = new Map<string, SupervisorRunMetadata>();

export function upsertSupervisorRun(metadata: Omit<SupervisorRunMetadata, "updatedAt">): SupervisorRunMetadata {
  const next: SupervisorRunMetadata = {
    ...metadata,
    updatedAt: new Date().toISOString(),
  };
  runs.set(metadata.runId, next);
  return next;
}

export function getSupervisorRun(runId: string): SupervisorRunMetadata | undefined {
  return runs.get(runId);
}

export function listSupervisorRuns(): SupervisorRunMetadata[] {
  return [...runs.values()].sort((a, b) => a.runId.localeCompare(b.runId));
}
