/**
 * Legacy deploy agents still consume a repository `.env` file. Product
 * Compiler v3 never does: runtime environment is passed only to the typed
 * platform adapter after AcceptedCandidate authority is checked.
 */
export function shouldMaterializeRepoDeployEnvironment(input: Readonly<{
  stepId: string;
  protocol: string | null | undefined;
}>): boolean {
  return input.stepId === "deploy" && input.protocol !== "v3";
}

export function shouldRunLegacyDeployCompletionGuard(input: Readonly<{
  stepId: string;
  protocol: string | null | undefined;
}>): boolean {
  return input.stepId === "deploy" && input.protocol !== "v3";
}
