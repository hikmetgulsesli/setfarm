import fs from "node:fs";
import path from "node:path";
import { libraryPackSelectionPath, readLibraryPackSelection } from "../library-packs/ledger.js";
import { readStackContract, stackContractPath } from "../stack-contract/ledger.js";
import { ensureSupervisorArtifactsExcluded, readSupervisorState, readSupervisorVisualResult, supervisorStatePath, supervisorVisualResultPath } from "./state.js";
import type { SupervisorEvidence, SupervisorIntervention, SupervisorRunStatus, SupervisorVisualResult } from "./types.js";

export interface SupervisorLedgerPaths {
  ledgerDir: string;
  stackContract: string;
  libraryPacks: string;
  designContract: string;
  domInventory: string;
  repairHistory: string;
  finalEvidence: string;
  supervisorState?: string;
  visualResult?: string;
}

export interface SupervisorRepairHistoryEntry {
  runId: string;
  storyId?: string;
  findingId?: string;
  interventionId?: string;
  actor: "supervisor" | "worker" | "fixer" | "system";
  action: string;
  result: "pending" | "sent" | "fixed" | "failed" | "skipped";
  evidence?: Record<string, unknown>;
  createdAt?: string;
}

export interface SupervisorFinalEvidence {
  schema: "setfarm.final-evidence.v1";
  runId: string;
  status: "passed" | "blocked" | "warning" | "failed";
  summary: string;
  stackPackId?: string;
  libraryPackIds: string[];
  visual?: Pick<SupervisorVisualResult, "ok" | "skipped" | "routesChecked" | "controlsChecked" | "issues">;
  openFindings: string[];
  artifacts: SupervisorLedgerPaths;
  createdAt: string;
}

export interface SupervisorLedgerSummary {
  schema: "setfarm.supervisor-ledger-summary.v1";
  runId?: string;
  stackPackId?: string;
  stackStatus?: string;
  libraryPackIds: string[];
  openFindingCount: number;
  warningCount: number;
  interventionCount: number;
  pendingInterventionCount: number;
  visualStatus: "pass" | "fail" | "skipped" | "missing";
  status: SupervisorRunStatus | "unknown";
  artifacts: SupervisorLedgerPaths;
}

export function supervisorLedgerDir(workdir: string): string {
  return path.join(workdir, ".setfarm", "ledger");
}

export function supervisorLedgerPaths(workdir: string, runId?: string): SupervisorLedgerPaths {
  const ledgerDir = supervisorLedgerDir(workdir);
  return {
    ledgerDir,
    stackContract: stackContractPath(workdir),
    libraryPacks: libraryPackSelectionPath(workdir),
    designContract: path.join(ledgerDir, "design-contract.md"),
    domInventory: path.join(ledgerDir, "dom-inventory.json"),
    repairHistory: path.join(ledgerDir, "repair-history.jsonl"),
    finalEvidence: path.join(ledgerDir, "final-evidence.json"),
    supervisorState: runId ? supervisorStatePath(workdir, runId) : undefined,
    visualResult: runId ? supervisorVisualResultPath(workdir, runId) : undefined,
  };
}

export function readSupervisorLedgerSummary(workdir: string, runId?: string): SupervisorLedgerSummary {
  const paths = supervisorLedgerPaths(workdir, runId);
  const stack = readStackContract(workdir);
  const library = readLibraryPackSelection(workdir);
  const state = runId ? readSupervisorState(workdir, runId) : null;
  const visual = runId ? readSupervisorVisualResult(workdir, runId) : null;
  const findings = state ? Object.values(state.evidence) : [];
  const interventions = state?.interventions ?? [];
  const openFindings = findings.filter((finding) => finding.status !== "passed" && finding.severity === "blocker");
  const warnings = findings.filter((finding) => finding.status !== "passed" && finding.severity === "warning");

  return {
    schema: "setfarm.supervisor-ledger-summary.v1",
    runId,
    stackPackId: stack?.packId,
    stackStatus: stack?.status,
    libraryPackIds: library?.selected.map((pack) => pack.id) ?? [],
    openFindingCount: openFindings.length,
    warningCount: warnings.length,
    interventionCount: interventions.length,
    pendingInterventionCount: interventions.filter((item) => item.result === "pending" || item.result === "sent").length,
    visualStatus: visualStatus(visual),
    status: summarizeStatus(openFindings, warnings, interventions, visual),
    artifacts: paths,
  };
}

export function appendSupervisorRepairHistory(workdir: string, entry: SupervisorRepairHistoryEntry): string {
  ensureSupervisorArtifactsExcluded(workdir);
  const file = supervisorLedgerPaths(workdir, entry.runId).repairHistory;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ...entry, createdAt: entry.createdAt ?? new Date().toISOString() }) + "\n");
  return file;
}

export function writeSupervisorFinalEvidence(workdir: string, evidence: Omit<SupervisorFinalEvidence, "schema" | "createdAt" | "artifacts">): string {
  ensureSupervisorArtifactsExcluded(workdir);
  const paths = supervisorLedgerPaths(workdir, evidence.runId);
  fs.mkdirSync(path.dirname(paths.finalEvidence), { recursive: true });
  const payload: SupervisorFinalEvidence = {
    schema: "setfarm.final-evidence.v1",
    createdAt: new Date().toISOString(),
    artifacts: paths,
    ...evidence,
  };
  fs.writeFileSync(paths.finalEvidence, JSON.stringify(payload, null, 2) + "\n");
  return paths.finalEvidence;
}

export function collectOpenSupervisorFindings(evidence: Record<string, SupervisorEvidence>): string[] {
  return Object.values(evidence)
    .filter((finding) => finding.status !== "passed" && finding.severity === "blocker")
    .map((finding) => finding.itemId)
    .sort();
}

export function collectPendingSupervisorInterventions(interventions: SupervisorIntervention[]): string[] {
  return interventions
    .filter((item) => item.result === "pending" || item.result === "sent")
    .map((item) => item.id)
    .sort();
}

function visualStatus(visual: SupervisorVisualResult | null): SupervisorLedgerSummary["visualStatus"] {
  if (!visual) return "missing";
  if (visual.skipped) return "skipped";
  return visual.ok ? "pass" : "fail";
}

function summarizeStatus(
  openFindings: SupervisorEvidence[],
  warnings: SupervisorEvidence[],
  interventions: SupervisorIntervention[],
  visual: SupervisorVisualResult | null,
): SupervisorLedgerSummary["status"] {
  if (openFindings.length > 0 || (visual && !visual.skipped && !visual.ok)) return "blocked";
  if (warnings.length > 0 || interventions.some((item) => item.result === "pending" || item.result === "sent")) return "warning";
  if (visual?.ok) return "passed";
  return "unknown";
}
