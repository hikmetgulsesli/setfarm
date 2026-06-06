import type { StackContract } from "./stack-contract/types.js";
import { resolveStackContract } from "./stack-contract/reconcile.js";
import { writeStackContract } from "./stack-contract/ledger.js";
import { stackModuleForContract } from "./stack-modules/registry.js";
import type { StackEvidenceClass, StackRuntimeKind } from "./stack-modules/types.js";

export type EvidenceClass = StackEvidenceClass;

export function resolveOperationalStackContract(context: Record<string, string>, persist = true): StackContract {
  const repoPath = context["story_workdir"] || context["repo"] || context["REPO"] || "";
  const taskText = context["prd"] || context["task"] || context["TASK"] || "";
  const contract = resolveStackContract({
    repoPath: repoPath || undefined,
    taskText,
    projectSlug: context["project_slug"] || context["PROJECT_SLUG"] || undefined,
  });
  if (persist && repoPath && contract.status === "resolved") {
    writeStackContract(repoPath, contract);
  }
  return contract;
}

export function isBrowserRuntimeStack(contract: Pick<StackContract, "packId" | "verification"> | null | undefined): boolean {
  if (!contract) return false;
  const module = stackModuleForContract(contract);
  if (module) return module.isBrowserRuntime();
  const verification = contract.verification || { build: [], smoke: [], dom: [], visual: [], tests: [] };
  const text = [
    ...(verification.smoke || []),
    ...(verification.dom || []),
    ...(verification.visual || []),
  ].join(" ").toLowerCase();
  return /\b(browser|route|dom|playwright|screenshot|web page|viewport)\b/.test(text);
}

export function stackRuntimeKind(contract: Pick<StackContract, "packId"> | null | undefined): StackRuntimeKind {
  return stackModuleForContract(contract)?.runtimeKind() || "unknown";
}

export function stackEvidenceSummary(contract: StackContract): string {
  const verification = contract.verification || { build: [], smoke: [], dom: [], visual: [], tests: [] };
  const parts = [
    verification.build?.length ? `build=${verification.build.join("; ")}` : "",
    verification.tests?.length ? `tests=${verification.tests.join("; ")}` : "",
    verification.smoke?.length ? `smoke=${verification.smoke.join("; ")}` : "",
    verification.dom?.length ? `dom=${verification.dom.join("; ")}` : "",
    verification.visual?.length ? `visual=${verification.visual.join("; ")}` : "",
  ].filter(Boolean);
  return parts.join(" | ") || "no stack-specific verification contract";
}

export function stackEvidenceMetadata(contract: StackContract): Record<string, unknown> {
  return {
    stackPackId: contract.packId || "needs-reconcile",
    stackStatus: contract.status,
    stackConfidence: contract.confidence,
    runtimeKind: stackRuntimeKind(contract),
    browserRuntime: isBrowserRuntimeStack(contract),
    verification: contract.verification,
  };
}

export function evidenceClassesForStep(stepId: string, contract: StackContract): EvidenceClass[] {
  return stackModuleForContract(contract)?.evidenceClassesForStep(stepId) || [];
}
