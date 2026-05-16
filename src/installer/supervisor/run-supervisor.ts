import { buildSupervisorChecklistFromProject } from "./checklist.js";
import { buildSupervisorIntervention } from "./intervention.js";
import { scanSupervisorChecklist } from "./scanner.js";
import {
  addSupervisorIntervention,
  appendSupervisorEvent,
  applyScanFindings,
  readSupervisorChecklist,
  writeSupervisorChecklist,
} from "./state.js";
import type { SupervisorChecklist, SupervisorScanResult } from "./types.js";

export async function runImplementSupervisorScan(params: {
  runId: string;
  workdir: string;
  repoPath?: string;
  storyId?: string;
  scopeFiles: string[];
  targetWorker?: string;
}): Promise<SupervisorScanResult> {
  const existing = readSupervisorChecklist(params.workdir, params.runId);
  const scopedChecklist = buildSupervisorChecklistFromProject({
    runId: params.runId,
    workdir: params.workdir,
    repoPath: params.repoPath,
    storyId: params.storyId,
    scopeFiles: params.scopeFiles,
  });
  const checklist = mergeSupervisorChecklist(existing, scopedChecklist);
  if (!existing || checklist.items.length !== existing.items.length) {
    writeSupervisorChecklist(params.workdir, checklist);
    appendSupervisorEvent(params.workdir, {
      ts: new Date().toISOString(),
      runId: params.runId,
      storyId: params.storyId,
      type: "checklist-generated",
      source: "scanner",
      message: `${existing ? "Updated" : "Generated"} ${checklist.items.length} supervisor checklist item(s).`,
    });
  }

  const result = scanSupervisorChecklist(params.workdir, checklist, params.scopeFiles);
  applyScanFindings({
    workdir: params.workdir,
    runId: params.runId,
    storyId: params.storyId,
    findings: result.findings,
    targetWorker: params.targetWorker,
  });
  appendSupervisorEvent(params.workdir, {
    ts: new Date().toISOString(),
    runId: params.runId,
    storyId: params.storyId,
    type: "scan-completed",
    source: "scanner",
    message: `Supervisor scan completed: ${result.blockers.length} blocker(s), ${result.warnings.length} warning(s).`,
  });

  for (const blocker of result.blockers.slice(0, 6)) {
    const intervention = buildSupervisorIntervention({
      checklist,
      finding: blocker,
      storyId: params.storyId,
      targetWorker: params.targetWorker,
    });
    addSupervisorIntervention(params.workdir, params.runId, intervention);
    appendSupervisorEvent(params.workdir, {
      ts: new Date().toISOString(),
      runId: params.runId,
      storyId: params.storyId,
      type: "intervention-created",
      itemId: blocker.itemId,
      source: "supervisor",
      message: intervention.message,
    });
  }

  for (const warning of result.warnings.slice(0, 12)) {
    appendSupervisorEvent(params.workdir, {
      ts: new Date().toISOString(),
      runId: params.runId,
      storyId: params.storyId,
      type: "warning-opened",
      itemId: warning.itemId,
      source: "scanner",
      message: warning.message,
    });
  }

  return result;
}

function mergeSupervisorChecklist(existing: SupervisorChecklist | null, scoped: SupervisorChecklist): SupervisorChecklist {
  if (!existing) return scoped;
  const byId = new Map(existing.items.map((item) => [item.id, item]));
  for (const item of scoped.items) {
    byId.set(item.id, item);
  }
  return {
    ...existing,
    projectSlug: existing.projectSlug || scoped.projectSlug,
    sourceCommit: existing.sourceCommit || scoped.sourceCommit,
    generatedAt: scoped.generatedAt,
    items: [...byId.values()],
  };
}
