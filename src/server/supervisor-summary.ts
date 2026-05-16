import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  SupervisorChecklist,
  SupervisorRunMetadata,
  SupervisorRunStatus,
  SupervisorState,
  SupervisorVisualResult,
} from "../installer/supervisor/types.js";

export interface SupervisorArtifactSummary {
  available: boolean;
  runId: string;
  workdir: string | null;
  stateRoot: string | null;
  status: SupervisorRunStatus | "unknown" | "missing";
  scope?: string;
  provider?: string;
  fallbackProviders?: string[];
  supervisorSessionId?: string;
  activeWorkers: string[];
  activeFixers: string[];
  updatedAt?: string;
  storyCount: number;
  openBlockers: number;
  warnings: number;
  resolved: number;
  pendingInterventions: number;
  checklistItems: number;
  checklistPassed: number;
  visual: {
    available: boolean;
    ok?: boolean;
    skipped?: boolean;
    status: "pass" | "fail" | "skipped" | "missing";
    issueCount: number;
    routesChecked: string[];
    controlsChecked: number;
    screenshots: string[];
    reportPath?: string;
  };
  fixerPlan?: unknown;
  artifacts: {
    run?: string;
    state?: string;
    checklist?: string;
    events?: string;
    interventions?: string;
    fixerPlan?: string;
    visualResult?: string;
    visualReport?: string;
  };
  recentEvents: unknown[];
  interventionText?: string;
  visualReportText?: string;
  candidateWorkdirs: string[];
}

interface RunLike {
  id: string;
  context?: string | Record<string, unknown> | null;
  task?: string | null;
}

function expandTilde(value: string): string {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

function parseContext(input: RunLike["context"]): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === "object") return input;
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

function readText(file: string, maxChars: number): string | undefined {
  try {
    if (!fs.existsSync(file)) return undefined;
    const text = fs.readFileSync(file, "utf-8");
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  } catch {
    return undefined;
  }
}

function readJsonlTail(file: string, limit: number): unknown[] {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf-8")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });
  } catch {
    return [];
  }
}

function addCandidate(candidates: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const expanded = expandTilde(value.trim());
  if (!expanded || candidates.includes(expanded)) return;
  candidates.push(expanded);
}

export function supervisorWorkdirCandidates(run: RunLike): string[] {
  const context = parseContext(run.context);
  const candidates: string[] = [];
  addCandidate(candidates, context.story_workdir);
  addCandidate(candidates, context.verify_workdir);
  addCandidate(candidates, context.repo);
  addCandidate(candidates, context.REPO);

  const task = String(run.task || "");
  for (const match of task.matchAll(/(?:^|\s)(?:--repo|REPO:?)\s+([^\s]+)/gi)) {
    addCandidate(candidates, match[1]);
  }
  for (const match of task.matchAll(/(?:\/Users|\/home)\/[^\s'"]+/g)) {
    addCandidate(candidates, match[0]);
  }
  return candidates;
}

function countState(state: SupervisorState | null) {
  const stories = state ? Object.values(state.stories || {}) : [];
  return {
    storyCount: stories.length,
    openBlockers: stories.reduce((sum, story) => sum + (story.openBlockers?.length || 0), 0),
    warnings: stories.reduce((sum, story) => sum + (story.warnings?.length || 0), 0),
    resolved: stories.reduce((sum, story) => sum + (story.resolved?.length || 0), 0),
    pendingInterventions: (state?.interventions || []).filter((item) => item.result !== "resolved").length,
  };
}

function summarizeStatus(
  metadata: SupervisorRunMetadata | null,
  state: SupervisorState | null,
  visual: SupervisorVisualResult | null,
  fixerPlan: unknown | null,
): SupervisorArtifactSummary["status"] {
  if (fixerPlan) return "fixing";
  if (state?.projectStatus === "blocked") return "blocked";
  if (metadata?.status) return metadata.status;
  if (visual) {
    if (visual.skipped) return "warning";
    return visual.ok ? "passed" : "blocked";
  }
  return "unknown";
}

function summarizeFromRoot(runId: string, workdir: string, stateRoot: string, candidateWorkdirs: string[]): SupervisorArtifactSummary | null {
  if (!fs.existsSync(stateRoot)) return null;

  const runPath = path.join(stateRoot, "SUPERVISOR_RUN.json");
  const statePath = path.join(stateRoot, "SUPERVISOR_STATE.json");
  const checklistPath = path.join(stateRoot, "SUPERVISOR_CHECKLIST.json");
  const eventsPath = path.join(stateRoot, "SUPERVISOR_EVENTS.jsonl");
  const interventionsPath = path.join(stateRoot, "SUPERVISOR_INTERVENTIONS.md");
  const fixerPlanPath = path.join(stateRoot, "SUPERVISOR_FIXER_PLAN.json");
  const visualResultPath = path.join(stateRoot, "visual", "VISUAL_QA_RESULT.json");
  const visualReportPath = path.join(stateRoot, "visual", "VISUAL_QA_REPORT.md");

  const metadata = readJson<SupervisorRunMetadata>(runPath);
  const state = readJson<SupervisorState>(statePath);
  const checklist = readJson<SupervisorChecklist>(checklistPath);
  const visualResult = readJson<SupervisorVisualResult>(visualResultPath);
  const fixerPlan = readJson<unknown>(fixerPlanPath);
  const counts = countState(state);
  const checklistItems = checklist?.items || [];
  const screenshots = visualResult?.screenshots || [];

  return {
    available: true,
    runId,
    workdir,
    stateRoot,
    status: summarizeStatus(metadata, state, visualResult, fixerPlan),
    scope: metadata?.scope,
    provider: metadata?.provider,
    fallbackProviders: metadata?.fallbackProviders,
    supervisorSessionId: metadata?.supervisorSessionId,
    activeWorkers: metadata?.activeWorkers || [],
    activeFixers: metadata?.activeFixers || [],
    updatedAt: metadata?.updatedAt || state?.updatedAt || visualResult?.createdAt,
    ...counts,
    checklistItems: checklistItems.length,
    checklistPassed: checklistItems.filter((item) => state?.evidence?.[item.id]?.status === "passed").length,
    visual: {
      available: !!visualResult,
      ok: visualResult?.ok,
      skipped: visualResult?.skipped,
      status: visualResult ? (visualResult.skipped ? "skipped" : visualResult.ok ? "pass" : "fail") : "missing",
      issueCount: visualResult?.issues?.length || 0,
      routesChecked: visualResult?.routesChecked || [],
      controlsChecked: visualResult?.controlsChecked || 0,
      screenshots,
      reportPath: fs.existsSync(visualReportPath) ? visualReportPath : undefined,
    },
    fixerPlan: fixerPlan || undefined,
    artifacts: {
      run: fs.existsSync(runPath) ? runPath : undefined,
      state: fs.existsSync(statePath) ? statePath : undefined,
      checklist: fs.existsSync(checklistPath) ? checklistPath : undefined,
      events: fs.existsSync(eventsPath) ? eventsPath : undefined,
      interventions: fs.existsSync(interventionsPath) ? interventionsPath : undefined,
      fixerPlan: fs.existsSync(fixerPlanPath) ? fixerPlanPath : undefined,
      visualResult: fs.existsSync(visualResultPath) ? visualResultPath : undefined,
      visualReport: fs.existsSync(visualReportPath) ? visualReportPath : undefined,
    },
    recentEvents: readJsonlTail(eventsPath, 25),
    interventionText: readText(interventionsPath, 12000),
    visualReportText: readText(visualReportPath, 12000),
    candidateWorkdirs,
  };
}

export function readSupervisorArtifactSummary(run: RunLike): SupervisorArtifactSummary {
  const candidates = supervisorWorkdirCandidates(run).filter((candidate) => fs.existsSync(candidate));
  for (const candidate of candidates) {
    const stateRoot = path.join(candidate, ".setfarm", "supervisor", run.id);
    const summary = summarizeFromRoot(run.id, candidate, stateRoot, candidates);
    if (summary) return summary;
  }

  return {
    available: false,
    runId: run.id,
    workdir: null,
    stateRoot: null,
    status: "missing",
    activeWorkers: [],
    activeFixers: [],
    storyCount: 0,
    openBlockers: 0,
    warnings: 0,
    resolved: 0,
    pendingInterventions: 0,
    checklistItems: 0,
    checklistPassed: 0,
    visual: {
      available: false,
      status: "missing",
      issueCount: 0,
      routesChecked: [],
      controlsChecked: 0,
      screenshots: [],
    },
    artifacts: {},
    recentEvents: [],
    candidateWorkdirs: supervisorWorkdirCandidates(run),
  };
}
