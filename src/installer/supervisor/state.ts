import fs from "node:fs";
import path from "node:path";
import type {
  SupervisorChecklist,
  SupervisorEvent,
  SupervisorFinding,
  SupervisorIntervention,
  SupervisorState,
  SupervisorStoryState,
} from "./types.js";

export function supervisorStateDir(workdir: string, runId: string): string {
  return path.join(workdir, ".setfarm", "supervisor", safeSegment(runId || "unknown-run"));
}

export function supervisorChecklistPath(workdir: string, runId: string): string {
  return path.join(supervisorStateDir(workdir, runId), "SUPERVISOR_CHECKLIST.json");
}

export function supervisorStatePath(workdir: string, runId: string): string {
  return path.join(supervisorStateDir(workdir, runId), "SUPERVISOR_STATE.json");
}

export function supervisorEventsPath(workdir: string, runId: string): string {
  return path.join(supervisorStateDir(workdir, runId), "SUPERVISOR_EVENTS.jsonl");
}

export function createEmptySupervisorState(runId: string): SupervisorState {
  const now = new Date().toISOString();
  return {
    schema: "setfarm.supervisor-state.v1",
    runId,
    projectStatus: "implementing",
    updatedAt: now,
    stories: {},
    evidence: {},
    interventions: [],
  };
}

export function readSupervisorState(workdir: string, runId: string): SupervisorState {
  const file = supervisorStatePath(workdir, runId);
  try {
    if (!fs.existsSync(file)) return createEmptySupervisorState(runId);
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as SupervisorState;
    if (parsed?.schema !== "setfarm.supervisor-state.v1") return createEmptySupervisorState(runId);
    return parsed;
  } catch {
    return createEmptySupervisorState(runId);
  }
}

export function writeSupervisorState(workdir: string, state: SupervisorState): void {
  const file = supervisorStatePath(workdir, state.runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2) + "\n");
}

export function readSupervisorChecklist(workdir: string, runId: string): SupervisorChecklist | null {
  const file = supervisorChecklistPath(workdir, runId);
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as SupervisorChecklist;
    return parsed?.schema === "setfarm.supervisor-checklist.v1" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSupervisorChecklist(workdir: string, checklist: SupervisorChecklist): void {
  const file = supervisorChecklistPath(workdir, checklist.runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(checklist, null, 2) + "\n");
}

export function appendSupervisorEvent(workdir: string, event: SupervisorEvent): void {
  const file = supervisorEventsPath(workdir, event.runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(event) + "\n");
}

export function applyScanFindings(params: {
  workdir: string;
  runId: string;
  storyId?: string;
  findings: SupervisorFinding[];
  targetWorker?: string;
}): SupervisorState {
  const { workdir, runId, storyId = "unknown-story", findings, targetWorker } = params;
  const state = readSupervisorState(workdir, runId);
  const story = ensureStoryState(state, storyId);
  if (targetWorker) story.currentWorker = targetWorker;

  const scopedFindingIds = new Set(findings.map((finding) => finding.itemId));
  for (const finding of findings) {
    state.evidence[finding.itemId] = finding;
    if (finding.status === "passed") {
      addUnique(story.resolved, finding.itemId);
      removeValue(story.openBlockers, finding.itemId);
      removeValue(story.warnings, finding.itemId);
      continue;
    }
    if (finding.severity === "blocker") {
      addUnique(story.openBlockers, finding.itemId);
      removeValue(story.resolved, finding.itemId);
      removeValue(story.warnings, finding.itemId);
    } else {
      addUnique(story.warnings, finding.itemId);
      removeValue(story.openBlockers, finding.itemId);
    }
  }

  for (const itemId of [...story.openBlockers]) {
    if (scopedFindingIds.has(itemId) && state.evidence[itemId]?.status === "passed") {
      removeValue(story.openBlockers, itemId);
    }
  }

  story.status = story.openBlockers.length > 0
    ? "blocked"
    : story.warnings.length > 0
      ? "warning"
      : "passed";
  story.lastEvidenceAt = new Date().toISOString();
  state.projectStatus = story.openBlockers.length > 0 ? "blocked" : "implementing";
  writeSupervisorState(workdir, state);
  return state;
}

export function addSupervisorIntervention(workdir: string, runId: string, intervention: SupervisorIntervention): SupervisorState {
  const state = readSupervisorState(workdir, runId);
  state.interventions = [
    ...state.interventions.filter((item) => item.id !== intervention.id),
    intervention,
  ].slice(-200);
  writeSupervisorState(workdir, state);
  return state;
}

function ensureStoryState(state: SupervisorState, storyId: string): SupervisorStoryState {
  if (!state.stories[storyId]) {
    state.stories[storyId] = {
      status: "implementing",
      openBlockers: [],
      warnings: [],
      resolved: [],
    };
  }
  return state.stories[storyId];
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function removeValue(values: string[], value: string): void {
  const index = values.indexOf(value);
  if (index >= 0) values.splice(index, 1);
}

function safeSegment(value: string): string {
  return String(value || "unknown").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120) || "unknown";
}
