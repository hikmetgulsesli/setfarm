import { detectStackCandidates, extractTaskHints } from "./detector.js";
import { getStackPack } from "./packs.js";
import type { ResolveStackContractInput, StackCandidate, StackContract, StackContractConfidence } from "./types.js";

const HIGH_CONFIDENCE = 100;
const MEDIUM_CONFIDENCE = 55;

export function resolveStackContract(input: ResolveStackContractInput): StackContract {
  const now = input.now ?? new Date().toISOString();
  const taskHints = extractTaskHints(input.taskText ?? "");
  const candidates = detectStackCandidates(input.repoPath, input.taskText ?? "");
  const selected = candidates[0];

  if (!selected) {
    return {
      schema: "setfarm.stack-contract.v1",
      status: "needs-reconcile",
      confidence: "low",
      reason: "No stack evidence was detected. Run stack preflight reconcile before implementation.",
      repoPath: input.repoPath,
      taskHints,
      evidence: [],
      setup: {},
      fileContract: { entrypoints: [], routes: [], assets: [], generated: [], notes: [] },
      routeContract: { router: "unknown", routeFiles: [], requiredRoutes: [] },
      verification: { build: [], smoke: [], dom: [], visual: [], tests: [] },
      prompt: "Stack contract is unresolved. Do not start implementation until preflight reconcile selects a stack pack.",
      createdAt: now,
      updatedAt: now,
    };
  }

  const pack = getStackPack(selected.packId);
  const confidence = confidenceForCandidate(selected);
  return {
    schema: "setfarm.stack-contract.v1",
    status: "resolved",
    packId: pack.id,
    label: pack.label,
    confidence,
    reason: buildReason(selected, confidence),
    repoPath: input.repoPath,
    taskHints,
    evidence: selected.evidence,
    setup: pack.setup,
    fileContract: pack.fileContract,
    routeContract: pack.routeContract,
    verification: pack.verification,
    designPolicy: pack.designPolicy,
    conversionPolicy: pack.conversionPolicy,
    scaffoldPolicy: pack.scaffoldPolicy,
    targetResolutionRules: pack.targetResolutionRules,
    mockInjectionPolicy: pack.mockInjectionPolicy,
    dataAccessPolicy: pack.dataAccessPolicy,
    implementationBoundaries: pack.implementationBoundaries,
    dependencyPolicy: pack.dependencyPolicy,
    prompt: pack.prompt,
    createdAt: now,
    updatedAt: now,
  };
}

function confidenceForCandidate(candidate: StackCandidate): StackContractConfidence {
  if (candidate.score >= HIGH_CONFIDENCE) return "high";
  if (candidate.score >= MEDIUM_CONFIDENCE) return "medium";
  return "low";
}

function buildReason(candidate: StackCandidate, confidence: StackContractConfidence): string {
  const evidence = candidate.evidence
    .slice(0, 5)
    .map((item) => item.path || item.value)
    .join(", ");
  return `Selected ${candidate.packId} with ${confidence} confidence from ${candidate.score} evidence points${evidence ? `: ${evidence}` : "."}`;
}
