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
    | "runtime-signal"
    | "fixer-selected";
  itemId?: string;
  source: "scanner" | "runtime-guard" | "supervisor" | "fixer";
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
