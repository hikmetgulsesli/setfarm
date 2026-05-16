import fs from "node:fs";
import path from "node:path";
import type {
  SupervisorChecklist,
  SupervisorEvent,
  SupervisorFinding,
  SupervisorIntervention,
  SupervisorRunMetadata,
  SupervisorRunScope,
  SupervisorRunStatus,
  SupervisorState,
  SupervisorStoryState,
  SupervisorVisualResult,
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

export function supervisorRunPath(workdir: string, runId: string): string {
  return path.join(supervisorStateDir(workdir, runId), "SUPERVISOR_RUN.json");
}

export function supervisorInterventionsPath(workdir: string, runId: string): string {
  return path.join(supervisorStateDir(workdir, runId), "SUPERVISOR_INTERVENTIONS.md");
}

export function supervisorVisualDir(workdir: string, runId: string): string {
  return path.join(supervisorStateDir(workdir, runId), "visual");
}

export function supervisorVisualResultPath(workdir: string, runId: string): string {
  return path.join(supervisorVisualDir(workdir, runId), "VISUAL_QA_RESULT.json");
}

export function supervisorVisualReportPath(workdir: string, runId: string): string {
  return path.join(supervisorVisualDir(workdir, runId), "VISUAL_QA_REPORT.md");
}

export function supervisorFixerPlanPath(workdir: string, runId: string): string {
  return path.join(supervisorStateDir(workdir, runId), "SUPERVISOR_FIXER_PLAN.json");
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

export function readSupervisorRunMetadata(workdir: string, runId: string): SupervisorRunMetadata | null {
  const file = supervisorRunPath(workdir, runId);
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as SupervisorRunMetadata;
    return parsed?.schema === "setfarm.supervisor-run.v1" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSupervisorRunMetadata(workdir: string, metadata: SupervisorRunMetadata): void {
  const file = supervisorRunPath(workdir, metadata.runId);
  ensureSupervisorArtifactsExcluded(workdir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...metadata, updatedAt: new Date().toISOString() }, null, 2) + "\n");
}

export function upsertSupervisorRunMetadata(params: {
  workdir: string;
  runId: string;
  scope?: SupervisorRunScope;
  status?: SupervisorRunStatus;
  mainRepo?: string;
  storyId?: string;
  storyWorkdir?: string;
  provider?: string;
  fallbackProviders?: string[];
  supervisorSessionId?: string;
  activeWorkers?: string[];
  activeFixers?: string[];
  visualReport?: string;
  fixerPlan?: string;
}): SupervisorRunMetadata {
  const existing = readSupervisorRunMetadata(params.workdir, params.runId);
  const nowIso = new Date().toISOString();
  const metadata: SupervisorRunMetadata = {
    schema: "setfarm.supervisor-run.v1",
    runId: params.runId,
    workdir: params.workdir,
    mainRepo: params.mainRepo ?? existing?.mainRepo,
    storyId: params.storyId ?? existing?.storyId,
    storyWorkdir: params.storyWorkdir ?? existing?.storyWorkdir,
    scope: params.scope ?? existing?.scope ?? "implement-scan",
    status: params.status ?? existing?.status ?? "active",
    provider: params.provider ?? existing?.provider,
    fallbackProviders: params.fallbackProviders ?? existing?.fallbackProviders,
    supervisorSessionId: params.supervisorSessionId ?? existing?.supervisorSessionId,
    activeWorkers: params.activeWorkers ?? existing?.activeWorkers ?? [],
    activeFixers: params.activeFixers ?? existing?.activeFixers ?? [],
    artifacts: {
      checklist: supervisorChecklistPath(params.workdir, params.runId),
      state: supervisorStatePath(params.workdir, params.runId),
      events: supervisorEventsPath(params.workdir, params.runId),
      interventions: supervisorInterventionsPath(params.workdir, params.runId),
      visualReport: params.visualReport ?? existing?.artifacts.visualReport,
      fixerPlan: params.fixerPlan ?? existing?.artifacts.fixerPlan,
    },
    startedAt: existing?.startedAt ?? nowIso,
    updatedAt: nowIso,
  };
  writeSupervisorRunMetadata(params.workdir, metadata);
  appendSupervisorEvent(params.workdir, {
    ts: nowIso,
    runId: params.runId,
    storyId: metadata.storyId,
    type: "run-updated",
    source: "supervisor",
    message: `Supervisor run ${metadata.scope} is ${metadata.status}.`,
    data: {
      scope: metadata.scope,
      status: metadata.status,
      workdir: metadata.workdir,
      storyWorkdir: metadata.storyWorkdir,
    },
  });
  return metadata;
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
  ensureSupervisorArtifactsExcluded(workdir);
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
  ensureSupervisorArtifactsExcluded(workdir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(checklist, null, 2) + "\n");
}

export function appendSupervisorEvent(workdir: string, event: SupervisorEvent): void {
  const file = supervisorEventsPath(workdir, event.runId);
  ensureSupervisorArtifactsExcluded(workdir);
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
  state.projectStatus = Object.values(state.stories).some((item) => item.openBlockers.length > 0)
    ? "blocked"
    : "implementing";
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
  writeSupervisorInterventionsMarkdown(workdir, runId, state);
  return state;
}

export function writeSupervisorInterventionsMarkdown(
  workdir: string,
  runId: string,
  state = readSupervisorState(workdir, runId),
): string {
  const file = supervisorInterventionsPath(workdir, runId);
  ensureSupervisorArtifactsExcluded(workdir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const pending = state.interventions.filter((item) => item.result !== "resolved").slice(-80);
  const lines = [
    "# Supervisor Interventions",
    "",
    `Run: ${runId}`,
    `Updated: ${new Date().toISOString()}`,
    "",
  ];
  if (pending.length === 0) {
    lines.push("No open supervisor interventions.");
  } else {
    for (const item of pending) {
      lines.push(`## ${item.id}`);
      lines.push(`- Story: ${item.storyId || "run"}`);
      lines.push(`- Item: ${item.itemId}`);
      lines.push(`- Type: ${item.type}`);
      lines.push(`- Result: ${item.result}`);
      if (item.targetWorker) lines.push(`- Worker: ${item.targetWorker}`);
      if (item.targetSessionId) lines.push(`- Session: ${item.targetSessionId}`);
      lines.push("");
      lines.push(item.message.trim());
      lines.push("");
    }
  }
  fs.writeFileSync(file, `${lines.join("\n").trim()}\n`);
  return file;
}

export function markSupervisorInterventions(params: {
  workdir: string;
  runId: string;
  storyId?: string;
  result: SupervisorIntervention["result"];
}): SupervisorState {
  const state = readSupervisorState(params.workdir, params.runId);
  state.interventions = state.interventions.map((item) => {
    if (params.storyId && item.storyId !== params.storyId) return item;
    return { ...item, result: params.result };
  });
  writeSupervisorState(params.workdir, state);
  writeSupervisorInterventionsMarkdown(params.workdir, params.runId, state);
  return state;
}

export function writeSupervisorVisualResult(workdir: string, result: SupervisorVisualResult): void {
  const file = supervisorVisualResultPath(workdir, result.runId);
  ensureSupervisorArtifactsExcluded(workdir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
  fs.writeFileSync(supervisorVisualReportPath(workdir, result.runId), formatSupervisorVisualMarkdown(result), "utf-8");
  upsertSupervisorRunMetadata({
    workdir,
    runId: result.runId,
    scope: "visual-qa",
    status: result.ok ? "passed" : "blocked",
    storyId: result.storyId,
    visualReport: supervisorVisualReportPath(workdir, result.runId),
  });
}

export function readSupervisorVisualResult(workdir: string, runId: string): SupervisorVisualResult | null {
  const file = supervisorVisualResultPath(workdir, runId);
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as SupervisorVisualResult;
    return parsed?.schema === "setfarm.supervisor-visual-result.v1" ? parsed : null;
  } catch {
    return null;
  }
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

function formatSupervisorVisualMarkdown(result: SupervisorVisualResult): string {
  const lines = [
    "# Supervisor Visual QA",
    "",
    `Run: ${result.runId}`,
    `Story: ${result.storyId || "run"}`,
    `Status: ${result.ok ? "pass" : result.skipped ? "skipped" : "fail"}`,
    `Created: ${result.createdAt}`,
    `Routes checked: ${result.routesChecked.join(", ") || "none"}`,
    `Controls checked: ${result.controlsChecked}`,
    "",
  ];
  if (result.skipped) {
    lines.push(`Skipped: ${result.reason || "not available"}`);
  } else if (result.issues.length === 0) {
    lines.push("No visual QA issues found.");
  } else {
    lines.push("## Issues");
    for (const issue of result.issues.slice(0, 80)) {
      lines.push(`- [${issue.severity}] ${issue.type} ${issue.viewport} ${issue.route}: ${issue.detail}`);
      if (issue.screenshot) lines.push(`  Evidence: ${issue.screenshot}`);
    }
  }
  if (result.screenshots.length > 0) {
    lines.push("");
    lines.push("## Screenshots");
    for (const screenshot of result.screenshots.slice(0, 80)) {
      lines.push(`- ${screenshot}`);
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function safeSegment(value: string): string {
  return String(value || "unknown").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120) || "unknown";
}

export function ensureSupervisorArtifactsExcluded(workdir: string): void {
  try {
    const gitInfoDir = resolveGitInfoDir(workdir);
    if (!gitInfoDir) return;
    fs.mkdirSync(gitInfoDir, { recursive: true });
    const excludePath = path.join(gitInfoDir, "exclude");
    const current = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, "utf-8") : "";
    if (/^\.setfarm\/?$/m.test(current)) return;
    const next = `${current.replace(/\s*$/g, "")}\n.setfarm/\n`;
    fs.writeFileSync(excludePath, next, "utf-8");
  } catch {
    // Supervisor artifacts must never block the product pipeline.
  }
}

function resolveGitInfoDir(workdir: string): string | null {
  const dotGit = path.join(workdir, ".git");
  if (!fs.existsSync(dotGit)) return null;
  const stat = fs.statSync(dotGit);
  if (stat.isDirectory()) return path.join(dotGit, "info");
  if (!stat.isFile()) return null;
  const content = fs.readFileSync(dotGit, "utf-8").trim();
  const match = content.match(/^gitdir:\s*(.+)$/i);
  if (!match) return null;
  const gitDir = path.isAbsolute(match[1]) ? match[1] : path.resolve(workdir, match[1]);
  return path.join(gitDir, "info");
}
