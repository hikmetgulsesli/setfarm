import { detectStackCandidates, extractTaskHints } from "./detector.js";
import { getStackPack } from "./packs.js";
import { parseStackPrefix } from "./prefix.js";
import type { ResolveStackContractInput, StackCandidate, StackContract, StackContractConfidence, StackPackId } from "./types.js";

const HIGH_CONFIDENCE = 100;
const MEDIUM_CONFIDENCE = 55;

export function resolveStackContract(input: ResolveStackContractInput): StackContract {
  const now = input.now ?? new Date().toISOString();
  const prefix = parseStackPrefix(input.taskText);
  if (prefix) {
    return contractFromPack(prefix.packId, {
      confidence: "high",
      reason: `Selected ${prefix.packId} from explicit task prefix "${prefix.prefix}".`,
      repoPath: input.repoPath,
      taskHints: [`task prefix "${prefix.prefix}" selected ${prefix.packId}`],
      evidence: [{ type: "task-hint", value: `task prefix "${prefix.prefix}"`, weight: 999 }],
      requestedPrefix: prefix.prefix,
      normalizedTaskText: prefix.taskText,
      now,
    });
  }

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

  const confidence = confidenceForCandidate(selected);
  return contractFromPack(selected.packId, {
    confidence,
    reason: buildReason(selected, confidence),
    repoPath: input.repoPath,
    taskHints,
    evidence: selected.evidence,
    now,
  });
}

function contractFromPack(
  packId: StackPackId,
  input: {
    confidence: StackContractConfidence;
    reason: string;
    repoPath?: string;
    taskHints: string[];
    evidence: StackContract["evidence"];
    requestedPrefix?: string;
    normalizedTaskText?: string;
    now: string;
  },
): StackContract {
  const pack = getStackPack(packId);
  return {
    schema: "setfarm.stack-contract.v1",
    status: "resolved",
    packId: pack.id,
    label: pack.label,
    requestedPrefix: input.requestedPrefix,
    normalizedTaskText: input.normalizedTaskText,
    confidence: input.confidence,
    reason: input.reason,
    repoPath: input.repoPath,
    taskHints: input.taskHints,
    evidence: input.evidence,
    setup: pack.setup,
    fileContract: pack.fileContract,
    routeContract: pack.routeContract,
    verification: pack.verification,
    designPolicy: pack.designPolicy,
    conversionPolicy: pack.conversionPolicy,
    scaffoldPolicy: pack.scaffoldPolicy,
    targetResolutionRules: pack.targetResolutionRules,
    routerParadigm: pack.routerParadigm,
    slugRules: pack.slugRules,
    slugRuleTests: pack.slugRuleTests,
    mockInjectionPolicy: pack.mockInjectionPolicy,
    dataAccessPolicy: pack.dataAccessPolicy,
    implementationBoundaries: pack.implementationBoundaries,
    dependencyPolicy: pack.dependencyPolicy,
    dependencyResolutionPolicy: pack.dependencyResolutionPolicy,
    sharedEditValidationPolicy: pack.sharedEditValidationPolicy,
    patchWindowMarkers: pack.patchWindowMarkers,
    utilityFilePolicy: pack.utilityFilePolicy,
    buildStrippingPolicy: pack.buildStrippingPolicy,
    sandboxPrewarm: pack.sandboxPrewarm,
    runtime: pack.runtime,
    toolPreflight: pack.toolPreflight,
    nativeEquivalentContract: pack.nativeEquivalentContract,
    prompt: pack.prompt,
    createdAt: input.now,
    updatedAt: input.now,
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
