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

export interface StackEvidencePlan {
  stackPackId: StackPackId;
  runtimeKind: StackRuntimeKind;
  evidenceClasses: StackEvidenceClass[];
  toolPreflightRequired: boolean;
}

export interface StackModule {
  id: StackPackId;
  pack: StackPack;
  runtimeKind(): StackRuntimeKind;
  isBrowserRuntime(): boolean;
  evidenceClassesForStep(stepId: string): StackEvidenceClass[];
  buildEvidencePlan(stepId: string): StackEvidencePlan;
  classifyFailure(input: StackFailureInput): StackFailureClassification;
  resolveContract(base: StackContract): StackContract;
}
