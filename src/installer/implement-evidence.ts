import fs from "node:fs";
import path from "node:path";

export type EvidenceGateMode = "off" | "advisory" | "blocking";
export type VisualEvidenceProvider = "none" | "minimax" | "openai" | "anthropic";

export interface ImplementEvidenceConfig {
  mode: EvidenceGateMode;
  visualGate: EvidenceGateMode;
  visualProvider: VisualEvidenceProvider;
}

export interface ArtifactValidationIssue {
  code: string;
  message: string;
}

export interface ImplementEvidenceValidationResult {
  ok: boolean;
  mode: EvidenceGateMode;
  visualGate: EvidenceGateMode;
  visualProvider: VisualEvidenceProvider;
  missingArtifacts: string[];
  issues: ArtifactValidationIssue[];
  artifactPaths: Record<string, string>;
}

function enumEnv<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = String(process.env[name] || fallback).trim().toLowerCase();
  return (allowed as readonly string[]).includes(raw) ? raw as T : fallback;
}

export function readImplementEvidenceConfig(): ImplementEvidenceConfig {
  return {
    mode: enumEnv("SETFARM_IMPLEMENT_EVIDENCE_GATE", ["off", "advisory", "blocking"] as const, "blocking"),
    visualGate: enumEnv("SETFARM_VISUAL_EVIDENCE_GATE", ["off", "advisory", "blocking"] as const, "off"),
    visualProvider: enumEnv("SETFARM_VISUAL_EVIDENCE_PROVIDER", ["none", "minimax", "openai", "anthropic"] as const, "none"),
  };
}

function readJson(filePath: string): { value?: any; error?: string } {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, "utf-8")) };
  } catch (err: any) {
    return { error: String(err?.message || err).slice(0, 500) };
  }
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pushRequiredObjectIssues(issues: ArtifactValidationIssue[], artifact: string, value: any, required: string[]): void {
  if (!isObject(value)) {
    issues.push({ code: `${artifact.toUpperCase()}_INVALID`, message: `${artifact} must be a JSON object.` });
    return;
  }
  for (const key of required) {
    if (value[key] === undefined || value[key] === null || value[key] === "") {
      issues.push({ code: `${artifact.toUpperCase()}_${key.toUpperCase()}_MISSING`, message: `${artifact}.${key} is required.` });
    }
  }
}

function pushArrayIssueIfPresent(issues: ArtifactValidationIssue[], artifact: string, value: any, key: string): void {
  if (value?.[key] !== undefined && !Array.isArray(value[key])) {
    issues.push({ code: `${artifact.toUpperCase()}_${key.toUpperCase()}_INVALID`, message: `${artifact}.${key} must be an array when present.` });
  }
}

function pushObjectIssueIfPresent(issues: ArtifactValidationIssue[], artifact: string, value: any, key: string): void {
  if (value?.[key] !== undefined && !isObject(value[key])) {
    issues.push({ code: `${artifact.toUpperCase()}_${key.toUpperCase()}_INVALID`, message: `${artifact}.${key} must be a JSON object when present.` });
  }
}

function pushStoryIdIssue(issues: ArtifactValidationIssue[], artifact: string, value: any, expectedStoryId: string): void {
  if (isObject(value) && value.storyId !== undefined && String(value.storyId) !== String(expectedStoryId)) {
    issues.push({
      code: `${artifact.toUpperCase()}_STORY_ID_MISMATCH`,
      message: `${artifact}.storyId must match ${expectedStoryId}.`,
    });
  }
}

function isExecutableInteractionRequest(value: Record<string, any>): boolean {
  const action = typeof value.action === "string" ? value.action.trim() : "";
  const actionId = typeof value.actionId === "string" ? value.actionId.trim() : "";
  return !!action || !!actionId;
}

function flowCount(value: any): number {
  return Array.isArray(value?.flows) ? value.flows.filter((flow: any) => flow?.flowId !== "initial").length : 0;
}

function criteriaCount(value: any): number {
  return Array.isArray(value?.acceptanceCriteria) ? value.acceptanceCriteria.length : 0;
}

function arrayCount(value: any): number {
  return Array.isArray(value) ? value.length : 0;
}

function requiresInteractiveEvidence(storyType: unknown): boolean {
  const normalized = String(storyType || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  return ["ui-interactive", "browser-game", "game", "interactive"].includes(normalized);
}

export function implementEvidenceArtifactPaths(workdir: string, storyId: string): Record<string, string> {
  const safeStory = storyId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const base = path.join(workdir, ".setfarm", "implement", safeStory);
  return {
    intent: path.join(base, "IMPLEMENT_INTENT.json"),
    request: path.join(base, "IMPLEMENT_VERIFICATION_REQUEST.json"),
    evidence: path.join(base, "IMPLEMENT_EVIDENCE.json"),
  };
}

export function validateImplementEvidenceArtifacts(workdir: string, storyId: string, config = readImplementEvidenceConfig()): ImplementEvidenceValidationResult {
  const paths = implementEvidenceArtifactPaths(workdir, storyId);
  const missingArtifacts = Object.entries(paths)
    .filter(([, filePath]) => !fs.existsSync(filePath))
    .map(([name]) => name);
  const issues: ArtifactValidationIssue[] = [];

  if (config.mode === "off") {
    return { ok: true, mode: config.mode, visualGate: config.visualGate, visualProvider: config.visualProvider, missingArtifacts, issues, artifactPaths: paths };
  }

  if (missingArtifacts.length > 0) {
    return {
      ok: config.mode !== "blocking",
      mode: config.mode,
      visualGate: config.visualGate,
      visualProvider: config.visualProvider,
      missingArtifacts,
      issues,
      artifactPaths: paths,
    };
  }

  const intent = readJson(paths.intent);
  const request = readJson(paths.request);
  const evidence = readJson(paths.evidence);

  if (intent.error) issues.push({ code: "IMPLEMENT_INTENT_JSON_INVALID", message: intent.error });
  if (request.error) issues.push({ code: "IMPLEMENT_VERIFICATION_REQUEST_JSON_INVALID", message: request.error });
  if (evidence.error) issues.push({ code: "IMPLEMENT_EVIDENCE_JSON_INVALID", message: evidence.error });

  if (!intent.error) {
    pushRequiredObjectIssues(issues, "intent", intent.value, ["schema", "storyId", "storyType", "acceptanceCriteria", "runtimeEvidenceRequired"]);
    pushStoryIdIssue(issues, "intent", intent.value, storyId);
    if (intent.value?.schema !== "setfarm.implement-intent.v1") {
      issues.push({ code: "IMPLEMENT_INTENT_SCHEMA_INVALID", message: "intent.schema must be setfarm.implement-intent.v1." });
    }
    if (intent.value && !Array.isArray(intent.value.acceptanceCriteria)) {
      issues.push({ code: "IMPLEMENT_INTENT_ACCEPTANCE_CRITERIA_INVALID", message: "intent.acceptanceCriteria must be an array." });
    }
    pushObjectIssueIfPresent(issues, "intent", intent.value, "runtimeEvidenceRequired");
    pushArrayIssueIfPresent(issues, "intent", intent.value, "boundSurfaces");
    pushArrayIssueIfPresent(issues, "intent", intent.value, "boundActions");
    pushArrayIssueIfPresent(issues, "intent", intent.value, "boundDataEntities");
    const minFlowCount = intent.value?.runtimeEvidenceRequired?.minFlowCount;
    if (minFlowCount !== undefined && (!Number.isFinite(Number(minFlowCount)) || Number(minFlowCount) < 0)) {
      issues.push({ code: "IMPLEMENT_INTENT_MIN_FLOW_COUNT_INVALID", message: "intent.runtimeEvidenceRequired.minFlowCount must be a non-negative number when present." });
    }
  }

  if (!request.error) {
    pushRequiredObjectIssues(issues, "request", request.value, ["schema", "storyId", "status", "interactionRequests", "uncoveredCriteria", "knownGaps"]);
    pushStoryIdIssue(issues, "request", request.value, storyId);
    if (request.value?.schema !== "setfarm.implement-verification-request.v1") {
      issues.push({ code: "IMPLEMENT_VERIFICATION_REQUEST_SCHEMA_INVALID", message: "request.schema must be setfarm.implement-verification-request.v1." });
    }
    if (request.value?.status !== "ready_for_orchestrator_verification") {
      issues.push({ code: "IMPLEMENT_VERIFICATION_REQUEST_STATUS_INVALID", message: "request.status must be ready_for_orchestrator_verification." });
    }
    if (request.value && !Array.isArray(request.value.interactionRequests)) {
      issues.push({ code: "IMPLEMENT_VERIFICATION_REQUEST_INTERACTIONS_INVALID", message: "request.interactionRequests must be an array." });
    }
    if (Array.isArray(request.value?.interactionRequests)) {
      for (const [index, interaction] of request.value.interactionRequests.entries()) {
        if (!isObject(interaction)) {
          issues.push({
            code: "IMPLEMENT_VERIFICATION_REQUEST_INTERACTIONS_INVALID",
            message: `request.interactionRequests[${index}] must be an object with executable action details, not prose.`,
          });
          break;
        }
        if (!isExecutableInteractionRequest(interaction)) {
          issues.push({
            code: "IMPLEMENT_VERIFICATION_REQUEST_INTERACTIONS_INVALID",
            message: `request.interactionRequests[${index}] must include action or actionId so Setfarm can execute it.`,
          });
          break;
        }
      }
    }
    if (request.value && !Array.isArray(request.value.uncoveredCriteria)) {
      issues.push({ code: "IMPLEMENT_VERIFICATION_REQUEST_UNCOVERED_CRITERIA_INVALID", message: "request.uncoveredCriteria must be an array." });
    }
    if (request.value && !Array.isArray(request.value.knownGaps)) {
      issues.push({ code: "IMPLEMENT_VERIFICATION_REQUEST_KNOWN_GAPS_INVALID", message: "request.knownGaps must be an array." });
    }
  }

  if (!evidence.error) {
    pushRequiredObjectIssues(issues, "evidence", evidence.value, ["schema", "storyId", "runtime", "commands", "flows", "visualEvidence", "verdict"]);
    pushStoryIdIssue(issues, "evidence", evidence.value, storyId);
    if (evidence.value?.schema !== "setfarm.implement-evidence.v1") {
      issues.push({ code: "IMPLEMENT_EVIDENCE_SCHEMA_INVALID", message: "evidence.schema must be setfarm.implement-evidence.v1." });
    }
    if (evidence.value && !Array.isArray(evidence.value.commands)) {
      issues.push({ code: "IMPLEMENT_EVIDENCE_COMMANDS_INVALID", message: "evidence.commands must be an array." });
    }
    if (evidence.value && !Array.isArray(evidence.value.flows)) {
      issues.push({ code: "IMPLEMENT_EVIDENCE_FLOWS_INVALID", message: "evidence.flows must be an array." });
    }
    const visualStatus = evidence.value?.visualEvidence?.status;
    const allowedVisualStatuses = ["disabled", "skipped", "pass", "fail", "error"];
    if (!allowedVisualStatuses.includes(String(visualStatus || ""))) {
      issues.push({ code: "VISUAL_EVIDENCE_STATUS_INVALID", message: "evidence.visualEvidence.status must be disabled, skipped, pass, fail, or error." });
    }
    if (config.visualGate === "blocking" && visualStatus !== "pass") {
      issues.push({ code: "VISUAL_EVIDENCE_BLOCKING_NOT_PASSED", message: "Visual evidence gate is blocking and evidence.visualEvidence.status is not pass." });
    }
    if (evidence.value?.verdict !== "pass") {
      issues.push({ code: "IMPLEMENT_EVIDENCE_VERDICT_NOT_PASSED", message: "evidence.verdict must be pass before story completion." });
    }
  }

  if (!intent.error && !request.error && !evidence.error && isObject(intent.value) && isObject(request.value) && isObject(evidence.value)) {
    const minFlowCount = Number(intent.value.runtimeEvidenceRequired?.minFlowCount || 0);
    const completedFlowCount = flowCount(evidence.value);
    const requestedInteractionCount = Array.isArray(request.value.interactionRequests) ? request.value.interactionRequests.length : 0;
    const acceptanceCount = criteriaCount(intent.value);
    const uncoveredCount = arrayCount(request.value.uncoveredCriteria);
    if (Number.isFinite(minFlowCount) && completedFlowCount < minFlowCount) {
      issues.push({
        code: "IMPLEMENT_EVIDENCE_MIN_FLOW_COUNT_NOT_MET",
        message: `evidence.flows must include at least ${minFlowCount} non-initial flow(s).`,
      });
    }
    if (requestedInteractionCount > 0 && completedFlowCount < requestedInteractionCount) {
      issues.push({
        code: "IMPLEMENT_EVIDENCE_REQUESTED_FLOWS_MISSING",
        message: "Each requested interaction must produce an evidence flow.",
      });
    }
    if (
      requiresInteractiveEvidence(intent.value.storyType)
      && acceptanceCount > 0
      && requestedInteractionCount === 0
      && uncoveredCount === 0
      && Number.isFinite(minFlowCount)
      && minFlowCount === 0
    ) {
      issues.push({
        code: "IMPLEMENT_VERIFICATION_REQUEST_UNTESTED_CRITERIA",
        message: "Interactive stories with acceptance criteria must either request executable interactions, require at least one evidence flow, or list unverified criteria in uncoveredCriteria.",
      });
    }
  }

  return {
    ok: config.mode !== "blocking" || issues.length === 0,
    mode: config.mode,
    visualGate: config.visualGate,
    visualProvider: config.visualProvider,
    missingArtifacts,
    issues,
    artifactPaths: paths,
  };
}

export function summarizeImplementEvidenceValidation(result: ImplementEvidenceValidationResult): string {
  const parts: string[] = [
    `implementEvidence=${result.mode}`,
    `visualEvidence=${result.visualGate}`,
    `visualProvider=${result.visualProvider}`,
  ];
  if (result.missingArtifacts.length > 0) parts.push(`missing=${result.missingArtifacts.join(",")}`);
  if (result.issues.length > 0) parts.push(`issues=${result.issues.map((issue) => issue.code).join(",")}`);
  return parts.join(" ");
}
