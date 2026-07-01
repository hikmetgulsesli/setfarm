import type { StackContract, StackPack, StackPackId } from "../stack-contract/types.js";

export type StackRuntimeKind = "browser" | "native" | "server" | "cli" | "unknown";
export type StackEvidenceClass = "build" | "test" | "smoke" | "dom" | "visual" | "security" | "deploy";
export type StackFailureOwner = "product" | "infra" | "platform";
export type StackFailureAction = "product_retry" | "infra_retry" | "platform_bug";

export interface StackFailureClassification {
  owner: StackFailureOwner;
  action: StackFailureAction;
  category: string;
  reason: string;
}

export interface StackFailureInput {
  stepId: string;
  failure: string;
  hasMachineEvidence?: boolean;
}

export interface StackRuntimeIssueContext {
  workdir: string;
  repoPath?: string;
}

export interface StackClaimChecklistContext {
  input: string;
  task: string;
  storyTitle: string;
  acceptanceCriteria: unknown;
}

export interface StackRetryFeedbackContext {
  feedback: string;
  repoPath?: string;
  contractRepoPath?: string;
}

export interface StackPlanContext {
  projectName: string;
  entity: string;
  task: string;
  dbRequired: string;
}

export interface StackEvidencePlan {
  stackPackId: StackPackId;
  runtimeKind: StackRuntimeKind;
  evidenceClasses: StackEvidenceClass[];
  toolPreflightRequired: boolean;
}

export type StackSystemSmokeRunner = "setfarm-smoke-test" | "stack-agent" | "none";

export interface StackExecutionPlan extends StackEvidencePlan {
  systemSmokeRunner: StackSystemSmokeRunner;
  shouldAllocateRuntime: boolean;
  reason: string;
}

export interface StackModule {
  id: StackPackId;
  pack: StackPack;
  runtimeKind(): StackRuntimeKind;
  isBrowserRuntime(): boolean;
  evidenceClassesForStep(stepId: string): StackEvidenceClass[];
  buildEvidencePlan(stepId: string): StackEvidencePlan;
  executionPlanForStep(stepId: string): StackExecutionPlan;
  classifyFailure(input: StackFailureInput): StackFailureClassification;
  resolveContract(base: StackContract): StackContract;
  runtimeSemanticIssues(context: StackRuntimeIssueContext): string[];
  claimDoneChecklist(context: StackClaimChecklistContext): string[];
  sanitizeRetryFeedback(context: StackRetryFeedbackContext): string;
  planPlatformContract(context: StackPlanContext): string | null;
  planUiVisionSummary(context: StackPlanContext): string | null;
  planMockDataContract(context: StackPlanContext): string[] | null;
}
