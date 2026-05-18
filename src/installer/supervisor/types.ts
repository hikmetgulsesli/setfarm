export type SupervisorSeverity = "blocker" | "warning";

export type SupervisorChecklistItemType =
  | "button"
  | "link"
  | "input"
  | "select"
  | "nav"
  | "icon"
  | "form"
  | "dialog";

export type SupervisorEvidenceStatus =
  | "passed"
  | "missing"
  | "static"
  | "dead-href"
  | "malformed-url"
  | "icon-missing"
  | "visual-failure"
  | "browser-error"
  | "network-error"
  | "layout-overflow"
  | "blank-screen"
  | "dead-control"
  | "warning"
  | "unknown";

export interface SupervisorChecklistItem {
  id: string;
  storyId?: string;
  screen: string;
  screenId?: string;
  file: string;
  scopeFiles: string[];
  type: SupervisorChecklistItemType;
  label?: string;
  icon?: string;
  href?: string;
  action?: string;
  classes?: string[];
  parentId?: string;
  severity: SupervisorSeverity;
  evidenceRequired: string[];
  source: "design-dom" | "ui-contract" | "prd" | "runtime";
}

export interface SupervisorChecklist {
  schema: "setfarm.supervisor-checklist.v1";
  runId: string;
  projectSlug?: string;
  sourceCommit?: string;
  generatedAt: string;
  items: SupervisorChecklistItem[];
}

export interface SupervisorEvidence {
  itemId: string;
  status: SupervisorEvidenceStatus;
  severity: SupervisorSeverity;
  observed: string[];
  lastScan: string;
  files: string[];
  line?: number;
  message: string;
  checkedAt: string;
}

export interface SupervisorFinding extends SupervisorEvidence {
  storyId?: string;
}

export interface SupervisorStoryState {
  status: "pending" | "implementing" | "blocked" | "warning" | "passed";
  currentWorker?: string;
  attempt?: number;
  openBlockers: string[];
  warnings: string[];
  resolved: string[];
  lastEvidenceAt?: string;
}

export interface SupervisorIntervention {
  id: string;
  storyId?: string;
  itemId: string;
  targetWorker?: string;
  targetSessionId?: string;
  type: "live-instruction" | "retry-feedback" | "fixer";
  message: string;
  result: "pending" | "sent" | "resolved" | "failed";
  createdAt: string;
}

export type SupervisorRunScope =
  | "planning"
  | "design"
  | "implement-scan"
  | "story"
  | "verify"
  | "visual-qa"
  | "final-product";

export type SupervisorRunStatus =
  | "active"
  | "blocked"
  | "warning"
  | "passed"
  | "fixing"
  | "failed"
  | "done";

export interface SupervisorRunMetadata {
  schema: "setfarm.supervisor-run.v1";
  runId: string;
  workdir: string;
  mainRepo?: string;
  storyId?: string;
  storyWorkdir?: string;
  scope: SupervisorRunScope;
  status: SupervisorRunStatus;
  provider?: SupervisorModelProvider;
  fallbackProviders?: SupervisorModelProvider[];
  supervisorSessionId?: string;
  activeWorkers: string[];
  activeFixers: string[];
  artifacts: {
    checklist: string;
    state: string;
    events: string;
    interventions: string;
    visualReport?: string;
    fixerPlan?: string;
  };
  startedAt: string;
  updatedAt: string;
}

export interface SupervisorState {
  schema: "setfarm.supervisor-state.v1";
  runId: string;
  projectStatus: "planning" | "designing" | "implementing" | "verifying" | "blocked" | "done";
  updatedAt: string;
  stories: Record<string, SupervisorStoryState>;
  evidence: Record<string, SupervisorEvidence>;
  interventions: SupervisorIntervention[];
}

export interface SupervisorEvent {
  ts: string;
  runId: string;
  storyId?: string;
  type:
    | "checklist-generated"
    | "scan-completed"
    | "blocker-opened"
    | "warning-opened"
    | "blocker-resolved"
    | "intervention-created"
    | "intervention-sent"
    | "runtime-signal"
    | "run-updated"
    | "visual-scan-completed"
    | "fixer-selected";
  itemId?: string;
  source: "scanner" | "runtime-guard" | "supervisor" | "fixer" | "visual-qa";
  message?: string;
  data?: Record<string, unknown>;
}

export interface SupervisorScanResult {
  checklist: SupervisorChecklist;
  findings: SupervisorFinding[];
  blockers: SupervisorFinding[];
  warnings: SupervisorFinding[];
  passed: SupervisorFinding[];
}

export interface SupervisorRuntimeSignal {
  runId: string;
  stepId: string;
  storyDbId?: string | null;
  storyId?: string;
  agentId?: string;
  sessionId?: string;
  code: string;
  reason: string;
  transcriptPath?: string;
  workdir?: string;
}

export type SupervisorModelProvider = "codex" | "kimi" | "minimax" | string;

export interface SupervisorModelPolicy {
  providerPriority: SupervisorModelProvider[];
  defaultProvider: SupervisorModelProvider;
  fallbackProviders: SupervisorModelProvider[];
}

export type SupervisorVisualIssueType =
  | "blank_screen"
  | "console_error"
  | "page_error"
  | "network_error"
  | "layout_overflow"
  | "dead_control"
  | "navigation_error"
  | "preview_failed";

export interface SupervisorVisualIssue {
  id: string;
  type: SupervisorVisualIssueType;
  severity: SupervisorSeverity;
  route: string;
  viewport: string;
  detail: string;
  screenshot?: string;
}

export interface SupervisorVisualResult {
  schema: "setfarm.supervisor-visual-result.v1";
  runId: string;
  storyId?: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  baseUrl?: string;
  routesChecked: string[];
  controlsChecked: number;
  screenshots: string[];
  issues: SupervisorVisualIssue[];
  artifactDir: string;
  createdAt: string;
}
