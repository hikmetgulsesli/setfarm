import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { canonicalJsonBytes, canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  createInitialDesignSourceGenerationRequestV2,
  DesignSourceMaterializationFailureV2,
  runDesignSourceCompilationAttemptsV2,
  type DesignSourceAcceptedArtifactSetV2,
  type DesignSourceCompilationAttemptRepositoryPortV2,
  type DesignSourceCompilationAttemptRunnerResultV2,
  type DesignSourceGenerationDispatchResultV2,
  type DesignSourceGenerationStagePromptV2,
  type DesignSourceGenerationWriteEvidenceV2,
} from "./design-source-compilation-attempt-runner.js";
import { prepareProductCompilationAttemptWorkspaceV1 } from "./product-compilation-attempt-workspace.js";
import { produceDesignInteractionGraphV2 } from "./producers/design-graph-v2.js";
import { decodeStitchDirectBatchV2 } from "./producers/stitch-direct-response.js";
import {
  captureStitchRenderedSemanticsV2,
  type StitchRenderedSemanticsCaptureV2,
} from "./producers/stitch-rendered-semantics-v2.js";
import {
  bindStitchTargetCandidateSelectionsV3,
  selectStitchTargetCandidatesV2,
  type StitchCandidateArtifactBytesV2,
} from "./producers/stitch-target-candidate-selection-v2.js";
import {
  DesignSourceGenerationAuthorityV1Schema,
  type DesignSourceGenerationAuthorityV1,
} from "./schemas/design-source-generation-authority-v1.js";
import {
  ProductCompilationAttemptArtifactRefV1Schema,
  type ProductCompilationAttemptArtifactRefV1,
} from "./product-compilation-attempt-workspace.js";
import type { ProductCompilationAttemptV1 } from "./schemas/product-compilation-attempt-v1.js";
import {
  STITCH_RENDERED_SEMANTICS_POLICY_V2,
  StitchRenderedSemanticsV2Schema,
  type StitchRenderedSemanticsV2,
} from "./schemas/stitch-rendered-semantics-v2.js";
import {
  STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V2,
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
  type StitchTargetCandidateSelectionV2,
  type StitchTargetResponseBindingsV3,
} from "./schemas/stitch-target-candidate-selection-v2.js";
import {
  StitchDirectResponseEvidenceV2Schema,
  type StitchDirectResponseEvidenceV2,
} from "./schemas/stitch-direct-response-evidence-v2.js";
import {
  DesignInteractionGraphV2Schema,
  type DesignInteractionGraphV2,
} from "./schemas/design-interaction-graph-v2.js";
import { DesignGenerationTargetsV2Schema } from "./schemas/design-generation-targets-v2.js";
import { ProductSpecV2Schema } from "./schemas/product-spec-v2.js";
import {
  buildV3BatchStitchPromptV2,
  type V3DesignContractV2,
} from "./v3-design-contract-v2.js";

const AttemptTransportSchema = z.object({
  schema: z.literal("setfarm.stitch-attempt-transport.v1"),
  total: z.number().int().nonnegative().max(1_000),
  screens: z.array(z.object({
    screenId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
  }).strict()).max(1_000),
  screenSource: z.literal("direct"),
  directCandidateTotal: z.number().int().nonnegative().max(1_000),
  excludedDirectTotal: z.number().int().nonnegative().max(1_000),
  directScreenEvidenceSchema: z.literal("setfarm.stitch-direct-screen-evidence.v2"),
  directScreenEvidence: z.array(z.unknown()).max(1_000),
  downloaded: z.array(z.unknown()).max(1_000),
}).strict();

export type DesignSourceStageArtifactV2 = Readonly<{
  screenId: string;
  htmlBytes?: Uint8Array;
  screenshotBytes?: Uint8Array;
}>;

export type DesignSourceStageTransportResultV2 =
  | Readonly<{
      disposition: "accepted";
      response: unknown;
      rawEvidence: string | Uint8Array;
      artifacts: readonly DesignSourceStageArtifactV2[];
    }>
  | Exclude<DesignSourceGenerationDispatchResultV2, { disposition: "accepted" }>;

export type DesignSourceAuthorityArtifactsV2 = Readonly<{
  directResponseEvidence: StitchDirectResponseEvidenceV2;
  renderedSemantics: StitchRenderedSemanticsV2;
  candidateSelection: StitchTargetCandidateSelectionV2;
  responseBindings: StitchTargetResponseBindingsV3;
  designGraph: DesignInteractionGraphV2;
}>;

export type DesignSourceAuthorityRuntimeResultV2 = Readonly<{
  authority: DesignSourceGenerationAuthorityV1;
  runner: DesignSourceCompilationAttemptRunnerResultV2;
  artifacts?: DesignSourceAuthorityArtifactsV2;
}>;

export type DesignSourceAuthorityRuntimeInputV2 = Readonly<{
  repo: string;
  runId: string;
  projectId: string;
  contract: V3DesignContractV2;
  originClaimId: number;
  ownerClaimId: number;
  ownerInstanceId: string;
  producerReleaseSha: string;
  provider: string;
  model: string;
  deviceType: "DESKTOP" | "TABLET" | "MOBILE";
  uiLanguage: string;
  leaseMs?: number;
  heartbeatIntervalMs?: number;
  duplicateWaitMs?: number;
  duplicatePollMs?: number;
}>;

export type DesignSourceAuthorityRuntimeDependenciesV2 = Readonly<{
  repository: DesignSourceCompilationAttemptRepositoryPortV2;
  generateStage(input: Readonly<{
    projectId: string;
    stageId: string;
    targetRefs: readonly string[];
    prompt: string;
    attempt: ProductCompilationAttemptV1;
    externalOperationId: string;
    signal: AbortSignal;
  }>): Promise<DesignSourceStageTransportResultV2>;
}>;

type StoredStageArtifact = StitchCandidateArtifactBytesV2 & Readonly<{
  htmlRef?: ProductCompilationAttemptArtifactRefV1;
  screenshotRef?: ProductCompilationAttemptArtifactRefV1;
}>;

type StageCache = Map<string, Map<string, readonly StoredStageArtifact[]>>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function screenKey(screenId: string): string {
  return sha256(Buffer.from(screenId, "utf8"));
}

function artifactRef(
  area: ProductCompilationAttemptArtifactRefV1["area"],
  locator: string,
  receipt: Readonly<{ contentHash: string; byteLength: number }>,
): ProductCompilationAttemptArtifactRefV1 {
  return ProductCompilationAttemptArtifactRefV1Schema.parse({
    area,
    locator,
    contentHash: receipt.contentHash,
    byteLength: receipt.byteLength,
  });
}

function stageCacheSet(
  cache: StageCache,
  attemptId: string,
  stageId: string,
  artifacts: readonly StoredStageArtifact[],
): void {
  const stages = cache.get(attemptId) ?? new Map<string, readonly StoredStageArtifact[]>();
  stages.set(stageId, artifacts);
  cache.set(attemptId, stages);
}

async function storeStageArtifacts(input: Readonly<{
  stageId: string;
  attemptId: string;
  artifacts: readonly DesignSourceStageArtifactV2[];
  writeEvidence: DesignSourceGenerationWriteEvidenceV2;
  cache: StageCache;
}>): Promise<void> {
  const ids = input.artifacts.map((artifact) => artifact.screenId);
  if (new Set(ids).size !== ids.length) throw new Error("DESIGN_SOURCE_STAGE_ARTIFACT_ID_DUPLICATE");
  const stored: StoredStageArtifact[] = [];
  for (const artifact of [...input.artifacts].sort((left, right) =>
    compareUtf16(left.screenId, right.screenId))) {
    const key = screenKey(artifact.screenId);
    let htmlRef: ProductCompilationAttemptArtifactRefV1 | undefined;
    let screenshotRef: ProductCompilationAttemptArtifactRefV1 | undefined;
    if (artifact.htmlBytes) {
      const locator = `stages/${input.stageId}/screens/${key}.html`;
      const receipt = await input.writeEvidence({
        area: "download",
        locator,
        content: artifact.htmlBytes,
      });
      htmlRef = artifactRef("download", locator, receipt);
    }
    if (artifact.screenshotBytes) {
      const locator = `stages/${input.stageId}/screens/${key}.png`;
      const receipt = await input.writeEvidence({
        area: "download",
        locator,
        content: artifact.screenshotBytes,
      });
      screenshotRef = artifactRef("download", locator, receipt);
    }
    stored.push({
      screenId: artifact.screenId,
      ...(artifact.htmlBytes ? { htmlBytes: artifact.htmlBytes } : {}),
      ...(artifact.screenshotBytes ? { screenshotBytes: artifact.screenshotBytes } : {}),
      ...(htmlRef ? { htmlRef } : {}),
      ...(screenshotRef ? { screenshotRef } : {}),
    });
  }
  stageCacheSet(input.cache, input.attemptId, input.stageId, stored);
}

function typedMaterializationFailure(input: Readonly<{
  attempt: ProductCompilationAttemptV1;
  reasonCodes: readonly string[];
  evidence: unknown;
}>): DesignSourceMaterializationFailureV2 {
  const reasonCodes = uniqueSorted(input.reasonCodes).slice(0, 100);
  const cause = {
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "design",
    boundary: "product_compiler.design_source.semantic_closure",
    failureClass: "contract_invalid",
    failureCode: "DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED",
  };
  const evidence = input.evidence && typeof input.evidence === "object" && !Array.isArray(input.evidence)
    ? input.evidence as Record<string, unknown>
    : { detail: input.evidence };
  return new DesignSourceMaterializationFailureV2({
    disposition: "rejected",
    failure: {
      failureFingerprint: hashCanonicalJson({
        schema: "setfarm.design-source-failure-fingerprint.v1",
        requestHash: input.attempt.requestHash,
        reasonCodes,
        evidenceHash: hashCanonicalJson(input.evidence),
      }),
      operationalCauseHash: hashCanonicalJson(cause),
      reasonCodes: reasonCodes.length > 0
        ? reasonCodes
        : ["DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED"],
      evidence: { cause, ...evidence },
    },
  });
}

async function writeCanonicalPayload(input: Readonly<{
  area: ProductCompilationAttemptArtifactRefV1["area"];
  locator: string;
  payload: unknown;
  writeEvidence: DesignSourceGenerationWriteEvidenceV2;
}>): Promise<ProductCompilationAttemptArtifactRefV1> {
  const receipt = await input.writeEvidence({
    area: input.area,
    locator: input.locator,
    content: canonicalJsonBytes(input.payload),
  });
  return artifactRef(input.area, input.locator, receipt);
}

async function writeTextArtifact(input: Readonly<{
  area: ProductCompilationAttemptArtifactRefV1["area"];
  locator: string;
  text: string;
  writeEvidence: DesignSourceGenerationWriteEvidenceV2;
}>): Promise<ProductCompilationAttemptArtifactRefV1> {
  const receipt = await input.writeEvidence({
    area: input.area,
    locator: input.locator,
    content: input.text,
  });
  return artifactRef(input.area, input.locator, receipt);
}

function designMarkdown(input: Readonly<{
  contract: V3DesignContractV2;
  projectId: string;
  bindings: StitchTargetResponseBindingsV3;
}>): string {
  const screens = input.bindings.bindings.map((binding) =>
    `- ${binding.responseTitle} (${binding.targetRef}; source ${binding.responseScreenId})`).join("\n");
  const controls = input.contract.productSpec.actions.flatMap((action) =>
    action.controlPlacements.map((placement) =>
      `- ${placement.id}: ${action.name} on ${placement.surfaceRef}`)).join("\n") || "- none";
  return [
    `# Design System: ${input.contract.productSpec.product.name}`,
    "",
    `**Stitch project:** ${input.projectId}`,
    "**Authority:** ProductSpec v2 plus browser-observed DesignInteractionGraph v2.",
    "",
    "## Product screens",
    screens,
    "",
    "## Physical control slots",
    controls,
    "",
    "## Implementation boundary",
    "These files are accepted visual source, not executable application behavior. Every physical control is owned by its exact data-action and data-control-slot identity. Affected surfaces do not authorize additional controls. Routes, state transitions, persistence, reload behavior, and evidence predicates come from the sealed Product Build Packet, not from labels, inferred layout, or agent prose.",
    "",
    "## Source policy",
    "Only the selected response IDs in DESIGN_MANIFEST.json are canonical screens. STITCH_RENDERED_SEMANTICS_V2.json records the locked browser observation, STITCH_TARGET_CANDIDATE_SELECTION.json records exact qualification, and STITCH_RESPONSE_BINDINGS.json joins each target to the downloaded HTML and screenshot hashes. Unselected provider output is evidence only and cannot become implementation authority.",
    "",
  ].join("\n");
}

async function materializeAcceptedAuthority(input: Readonly<{
  contract: V3DesignContractV2;
  projectId: string;
  deviceType: "DESKTOP" | "TABLET" | "MOBILE";
  attempt: ProductCompilationAttemptV1;
  stageResults: readonly Readonly<{
    stageId: string;
    targetRefs: readonly string[];
    response: unknown;
  }>[];
  writeEvidence: DesignSourceGenerationWriteEvidenceV2;
  cache: StageCache;
}>): Promise<Readonly<{
  artifactSet: DesignSourceAcceptedArtifactSetV2;
  authority: DesignSourceAuthorityArtifactsV2;
}>> {
  const batches: StitchDirectResponseEvidenceV2["batches"][number][] = [];
  for (const stage of input.stageResults) {
    const decoded = decodeStitchDirectBatchV2({
      stageId: stage.stageId,
      targetRefs: [...stage.targetRefs],
      result: stage.response,
    });
    if (decoded.status === "rejected") {
      throw typedMaterializationFailure({
        attempt: input.attempt,
        reasonCodes: [decoded.code],
        evidence: {
          phase: "direct_response",
          failedStageIds: [stage.stageId],
          failedTargetRefs: stage.targetRefs,
          diagnostic: decoded.diagnostic,
        },
      });
    }
    batches.push(decoded.evidenceBatch);
  }
  const directResponseEvidence = StitchDirectResponseEvidenceV2Schema.parse({
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: input.projectId,
    batches,
  });
  const directRef = await writeCanonicalPayload({
    area: "raw",
    locator: "direct-response-evidence.json",
    payload: directResponseEvidence,
    writeEvidence: input.writeEvidence,
  });

  const artifacts = input.stageResults.flatMap((stage) =>
    input.cache.get(input.attempt.attemptId)?.get(stage.stageId) ?? []);
  const artifactsById = new Map<string, StoredStageArtifact>();
  for (const artifact of artifacts) {
    if (artifactsById.has(artifact.screenId)) {
      throw new Error("DESIGN_SOURCE_MATERIALIZATION_ARTIFACT_ID_DUPLICATE");
    }
    artifactsById.set(artifact.screenId, artifact);
  }
  const renderedCapture = await captureStitchRenderedSemanticsV2({
    generationTargets: input.contract.generationTargets,
    directResponseEvidence,
    artifacts,
    deviceType: input.deviceType,
  });
  const renderedRef = await writeCanonicalPayload({
    area: "render",
    locator: "rendered-semantics.json",
    payload: renderedCapture.artifact,
    writeEvidence: input.writeEvidence,
  });
  const sidecarProjection: Array<Readonly<{
    source: ProductCompilationAttemptArtifactRefV1;
    targetPath: string;
  }>> = [];
  for (const [locator, bytes] of renderedCapture.sidecars.semanticDom) {
    if (!locator.startsWith("stitch/")) throw new Error("DESIGN_SOURCE_SEMANTIC_DOM_LOCATOR_INVALID");
    const targetPath = locator.slice("stitch/".length);
    const receipt = await input.writeEvidence({
      area: "render",
      locator: targetPath,
      content: bytes,
    });
    const source = artifactRef("render", targetPath, receipt);
    sidecarProjection.push({ source, targetPath });
  }
  for (const [hash, bytes] of renderedCapture.sidecars.resources) {
    const targetPath = `render-resources/${hash}.bin`;
    const receipt = await input.writeEvidence({
      area: "render",
      locator: targetPath,
      content: bytes,
      expectedHash: hash,
    });
    sidecarProjection.push({ source: artifactRef("render", targetPath, receipt), targetPath });
  }

  const selection = selectStitchTargetCandidatesV2({
    generationTargets: input.contract.generationTargets,
    directResponseEvidence,
    renderedSemantics: renderedCapture.artifact,
    artifacts,
  });
  const selectionRef = await writeCanonicalPayload({
    area: "selection",
    locator: "candidate-selection.json",
    payload: selection.candidateSelection,
    writeEvidence: input.writeEvidence,
  });
  if (selection.status === "rejected") {
    const unresolved = selection.candidateSelection.selections
      .filter((item) => item.status === "unresolved")
      .map((item) => ({
        targetRef: item.targetRef,
        stageId: item.stageId,
        evaluations: item.evaluations.map((evaluation) => ({
          screenId: evaluation.screenId,
          qualificationTier: evaluation.qualificationTier,
          rejectionCodes: evaluation.rejectionCodes,
        })),
      }));
    throw typedMaterializationFailure({
      attempt: input.attempt,
      reasonCodes: selection.rejectionCodes,
      evidence: {
        phase: "candidate_selection",
        candidateSelectionArtifact: selectionRef,
        failedStageIds: uniqueSorted(unresolved.map((item) => item.stageId)),
        failedTargetRefs: uniqueSorted(unresolved.map((item) => item.targetRef)),
        unresolvedTargets: unresolved,
      },
    });
  }

  const bound = bindStitchTargetCandidateSelectionsV3({
    generationTargets: input.contract.generationTargets,
    candidateSelection: selection.candidateSelection,
    renderedSemantics: renderedCapture.artifact,
  });
  if (bound.status === "rejected") {
    throw typedMaterializationFailure({
      attempt: input.attempt,
      reasonCodes: bound.rejectionCodes,
      evidence: {
        phase: "response_bindings",
        failedStageIds: uniqueSorted(bound.candidateSelection.selections.map((item) => item.stageId)),
        failedTargetRefs: uniqueSorted(bound.candidateSelection.selections.map((item) => item.targetRef)),
      },
    });
  }
  const bindingsRef = await writeCanonicalPayload({
    area: "selection",
    locator: "response-bindings.json",
    payload: bound.responseBindings,
    writeEvidence: input.writeEvidence,
  });
  const graph = produceDesignInteractionGraphV2({
    productSpec: input.contract.productSpec,
    generationTargets: input.contract.generationTargets,
    renderedSemantics: renderedCapture.artifact,
    candidateSelection: selection.candidateSelection,
    responseBindings: bound.responseBindings,
  }).designGraph;
  const graphRef = await writeCanonicalPayload({
    area: "selection",
    locator: "design-interaction-graph-v2.json",
    payload: graph,
    writeEvidence: input.writeEvidence,
  });

  const manifest = bound.responseBindings.bindings.map((binding) => ({
    screenId: binding.responseScreenId,
    title: binding.responseTitle,
    htmlFile: `${binding.responseScreenId}.html`,
    screenshotFile: `${binding.responseScreenId}.png`,
    deviceType: input.deviceType,
    targetRef: binding.targetRef,
    source: "product-compilation-attempt-v2",
  }));
  const manifestRef = await writeCanonicalPayload({
    area: "selection",
    locator: "design-manifest.json",
    payload: manifest,
    writeEvidence: input.writeEvidence,
  });
  const markdownRef = await writeTextArtifact({
    area: "selection",
    locator: "design.md",
    text: designMarkdown({
      contract: input.contract,
      projectId: input.projectId,
      bindings: bound.responseBindings,
    }),
    writeEvidence: input.writeEvidence,
  });

  const selectedProjection = bound.responseBindings.bindings.flatMap((binding) => {
    const artifact = artifactsById.get(binding.responseScreenId);
    if (!artifact?.htmlRef || !artifact.screenshotRef) {
      throw new Error(`DESIGN_SOURCE_SELECTED_ARTIFACT_MISSING:${binding.responseScreenId}`);
    }
    return [
      { source: artifact.htmlRef, targetPath: `${binding.responseScreenId}.html` },
      { source: artifact.screenshotRef, targetPath: `${binding.responseScreenId}.png` },
    ];
  });
  const projectionArtifacts = [
    ...selectedProjection,
    ...sidecarProjection,
    { source: directRef, targetPath: "STITCH_DIRECT_RESPONSE_EVIDENCE.json" },
    { source: renderedRef, targetPath: "STITCH_RENDERED_SEMANTICS_V2.json" },
    { source: selectionRef, targetPath: "STITCH_TARGET_CANDIDATE_SELECTION.json" },
    { source: bindingsRef, targetPath: "STITCH_RESPONSE_BINDINGS.json" },
    { source: graphRef, targetPath: "DESIGN_INTERACTION_GRAPH_V2.json" },
    { source: manifestRef, targetPath: "DESIGN_MANIFEST.json" },
    { source: markdownRef, targetPath: "DESIGN.md" },
  ].sort((left, right) => compareUtf16(left.targetPath, right.targetPath));

  return {
    authority: {
      directResponseEvidence,
      renderedSemantics: renderedCapture.artifact,
      candidateSelection: selection.candidateSelection,
      responseBindings: bound.responseBindings,
      designGraph: graph,
    },
    artifactSet: {
      outputRefs: {
        directResponseEvidenceHash: hashCanonicalJson(directResponseEvidence),
        renderedSemanticsHash: hashCanonicalJson(renderedCapture.artifact),
        candidateSelectionHash: hashCanonicalJson(selection.candidateSelection),
        responseBindingsHash: hashCanonicalJson(bound.responseBindings),
      },
      authorityArtifacts: [
        { outputRef: "directResponseEvidenceHash", source: directRef },
        { outputRef: "renderedSemanticsHash", source: renderedRef },
        { outputRef: "candidateSelectionHash", source: selectionRef },
        { outputRef: "responseBindingsHash", source: bindingsRef },
      ],
      projectionArtifacts,
    },
  };
}

async function readJson(repo: string, locator: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(repo, "stitch", locator), "utf8"));
}

export async function readProjectedDesignSourceAuthorityV2(
  repo: string,
  contractInput: V3DesignContractV2,
): Promise<DesignSourceAuthorityArtifactsV2> {
  const contract = {
    productSpec: ProductSpecV2Schema.parse(contractInput.productSpec),
    generationTargets: DesignGenerationTargetsV2Schema.parse(contractInput.generationTargets),
  };
  const directResponseEvidence = StitchDirectResponseEvidenceV2Schema.parse(
    await readJson(repo, "STITCH_DIRECT_RESPONSE_EVIDENCE.json"),
  );
  const renderedSemantics = StitchRenderedSemanticsV2Schema.parse(
    await readJson(repo, "STITCH_RENDERED_SEMANTICS_V2.json"),
  );
  const candidateSelection = StitchTargetCandidateSelectionV2Schema.parse(
    await readJson(repo, "STITCH_TARGET_CANDIDATE_SELECTION.json"),
  );
  const responseBindings = StitchTargetResponseBindingsV3Schema.parse(
    await readJson(repo, "STITCH_RESPONSE_BINDINGS.json"),
  );
  const designGraph = DesignInteractionGraphV2Schema.parse(
    await readJson(repo, "DESIGN_INTERACTION_GRAPH_V2.json"),
  );
  const reproduced = produceDesignInteractionGraphV2({
    productSpec: contract.productSpec,
    generationTargets: contract.generationTargets,
    renderedSemantics,
    candidateSelection,
    responseBindings,
  }).designGraph;
  if (
    hashCanonicalJson(reproduced) !== hashCanonicalJson(designGraph)
    || renderedSemantics.directResponseEvidenceHash !== hashCanonicalJson(directResponseEvidence)
  ) {
    throw new Error("DESIGN_SOURCE_PROJECTED_AUTHORITY_CHAIN_MISMATCH");
  }
  return { directResponseEvidence, renderedSemantics, candidateSelection, responseBindings, designGraph };
}

function authorityFor(input: DesignSourceAuthorityRuntimeInputV2): DesignSourceGenerationAuthorityV1 {
  const productSpec = ProductSpecV2Schema.parse(input.contract.productSpec);
  const generationTargets = DesignGenerationTargetsV2Schema.parse(input.contract.generationTargets);
  const targetRefs = generationTargets.targets.map((target) => target.targetId).sort(compareUtf16);
  return DesignSourceGenerationAuthorityV1Schema.parse({
    schema: "setfarm.design-source-generation-authority.v1",
    runId: input.runId,
    originClaimId: input.originClaimId,
    productSpecHash: hashCanonicalJson(productSpec),
    generationTargetsHash: hashCanonicalJson(generationTargets),
    promptContractHash: hashCanonicalJson({
      schema: "setfarm.design-source-prompt-contract.v2",
      builder: "buildV3BatchStitchPromptV2",
      generationTargetsSchema: generationTargets.schema,
    }),
    renderPolicyHash: hashCanonicalJson(STITCH_RENDERED_SEMANTICS_POLICY_V2),
    selectionPolicyHash: hashCanonicalJson(STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V2),
    producerReleaseSha: input.producerReleaseSha,
    provider: input.provider,
    model: input.model,
    deviceType: input.deviceType,
    targetRefs,
    maximumAttempts: 2,
  });
}

function retryStages(failureEvidence: unknown): string[] {
  if (!failureEvidence || typeof failureEvidence !== "object" || Array.isArray(failureEvidence)) return [];
  const record = failureEvidence as Record<string, unknown>;
  const providerEvidence = record.providerEvidence
    && typeof record.providerEvidence === "object"
    && !Array.isArray(record.providerEvidence)
    ? record.providerEvidence as Record<string, unknown>
    : undefined;
  const values = record.failedStageIds ?? providerEvidence?.failedStageIds;
  if (!Array.isArray(values)) return [];
  return uniqueSorted(values.filter((value): value is string => typeof value === "string"));
}

export async function runDesignSourceAuthorityV2(
  input: DesignSourceAuthorityRuntimeInputV2,
  dependencies: DesignSourceAuthorityRuntimeDependenciesV2,
): Promise<DesignSourceAuthorityRuntimeResultV2> {
  const contract: V3DesignContractV2 = {
    productSpec: ProductSpecV2Schema.parse(input.contract.productSpec),
    generationTargets: DesignGenerationTargetsV2Schema.parse(input.contract.generationTargets),
  };
  const authority = authorityFor({ ...input, contract });
  const stages: Array<DesignSourceGenerationStagePromptV2 & Readonly<{
    targetRefs: readonly string[];
  }>> = [];
  for (let index = 0; index < authority.targetRefs.length; index += 5) {
    const stageId = `DSGS_${String(stages.length + 1).padStart(3, "0")}`;
    const targetRefs = authority.targetRefs.slice(index, index + 5);
    stages.push({
      stageId,
      targetRefs,
      prompt: buildV3BatchStitchPromptV2({
        contract,
        targetRefs,
        deviceType: input.deviceType,
        uiLanguage: input.uiLanguage,
        stageId,
      }),
    });
  }
  const request = createInitialDesignSourceGenerationRequestV2({ authority, stages });
  const cache: StageCache = new Map();
  let materialized: DesignSourceAuthorityArtifactsV2 | undefined;
  const runner = await runDesignSourceCompilationAttemptsV2({
    repo: input.repo,
    authority,
    request,
    stagePrompts: stages.map(({ stageId, prompt }) => ({ stageId, prompt })),
    ownerClaimId: input.ownerClaimId,
    ownerInstanceId: input.ownerInstanceId,
    ...(input.leaseMs === undefined ? {} : { leaseMs: input.leaseMs }),
    ...(input.heartbeatIntervalMs === undefined
      ? {}
      : { heartbeatIntervalMs: input.heartbeatIntervalMs }),
    ...(input.duplicateWaitMs === undefined ? {} : { duplicateWaitMs: input.duplicateWaitMs }),
    ...(input.duplicatePollMs === undefined ? {} : { duplicatePollMs: input.duplicatePollMs }),
  }, {
    repository: dependencies.repository,
    dispatchStage: async (dispatchInput) => {
      const result = await dependencies.generateStage({
        projectId: input.projectId,
        stageId: dispatchInput.stage.stageId,
        targetRefs: dispatchInput.stage.targetRefs,
        prompt: dispatchInput.prompt,
        attempt: dispatchInput.attempt,
        externalOperationId: dispatchInput.externalOperationId,
        signal: dispatchInput.signal,
      });
      if (result.disposition !== "accepted") return result;
      await storeStageArtifacts({
        stageId: dispatchInput.stage.stageId,
        attemptId: dispatchInput.attempt.attemptId,
        artifacts: result.artifacts,
        writeEvidence: dispatchInput.writeEvidence,
        cache,
      });
      return {
        disposition: "accepted",
        response: AttemptTransportSchema.parse(result.response),
        rawEvidence: result.rawEvidence,
      };
    },
    reuseStage: async (reuseInput) => {
      const parent = await dependencies.repository.get(reuseInput.parentAttemptRef);
      if (!parent) throw new Error("DESIGN_SOURCE_CARRY_FORWARD_PARENT_MISSING");
      const workspace = await prepareProductCompilationAttemptWorkspaceV1({ repo: input.repo, attempt: parent });
      const rawEvidence = await readFile(path.join(
        workspace.raw,
        "stages",
        reuseInput.stage.stageId,
        "response.bin",
      ));
      const response = AttemptTransportSchema.parse(JSON.parse(rawEvidence.toString("utf8")));
      const decoded = decodeStitchDirectBatchV2({
        stageId: reuseInput.stage.stageId,
        targetRefs: [...reuseInput.stage.targetRefs],
        result: response,
      });
      if (decoded.status !== "decoded") throw new Error("DESIGN_SOURCE_CARRY_FORWARD_RESPONSE_INVALID");
      const artifacts: DesignSourceStageArtifactV2[] = [];
      for (const candidate of decoded.evidenceBatch.candidates) {
        const key = screenKey(candidate.screenId);
        let htmlBytes: Buffer | undefined;
        let screenshotBytes: Buffer | undefined;
        if (candidate.htmlDownloadedArtifactHash) {
          htmlBytes = await readFile(path.join(
            workspace.download,
            "stages",
            reuseInput.stage.stageId,
            "screens",
            `${key}.html`,
          ));
          if (sha256(htmlBytes) !== candidate.htmlDownloadedArtifactHash) {
            throw new Error("DESIGN_SOURCE_CARRY_FORWARD_HTML_HASH_MISMATCH");
          }
        }
        if (candidate.screenshotDownloadedArtifactHash) {
          screenshotBytes = await readFile(path.join(
            workspace.download,
            "stages",
            reuseInput.stage.stageId,
            "screens",
            `${key}.png`,
          ));
          if (sha256(screenshotBytes) !== candidate.screenshotDownloadedArtifactHash) {
            throw new Error("DESIGN_SOURCE_CARRY_FORWARD_SCREENSHOT_HASH_MISMATCH");
          }
        }
        artifacts.push({
          screenId: candidate.screenId,
          ...(htmlBytes ? { htmlBytes } : {}),
          ...(screenshotBytes ? { screenshotBytes } : {}),
        });
      }
      await storeStageArtifacts({
        stageId: reuseInput.stage.stageId,
        attemptId: reuseInput.attempt.attemptId,
        artifacts,
        writeEvidence: reuseInput.writeEvidence,
        cache,
      });
      return { disposition: "accepted", response, rawEvidence };
    },
    materializeAccepted: async (materializeInput) => {
      const result = await materializeAcceptedAuthority({
        contract,
        projectId: input.projectId,
        deviceType: input.deviceType,
        attempt: materializeInput.attempt,
        stageResults: materializeInput.stageResults,
        writeEvidence: materializeInput.writeEvidence,
        cache,
      });
      materialized = result.authority;
      return result.artifactSet;
    },
    planRetry: async ({ stagePrompts, failure, failureEvidence }) => {
      const failedStageIds = retryStages(failureEvidence);
      if (failedStageIds.length === 0) return null;
      const failed = new Set(failedStageIds);
      return {
        stagePrompts: stagePrompts.map((stage) => failed.has(stage.stageId)
          ? {
              stageId: stage.stageId,
              prompt: [
                stage.prompt,
                "",
                "# SETFARM_PROVEN_RETRY_DELTA_V1",
                `parent_failure_fingerprint: ${failure.failureFingerprint}`,
                `parent_failure_artifact_hash: ${failure.failureArtifactHash}`,
                `reason_codes: ${failure.reasonCodes.join(",")}`,
                `failed_stage_id: ${stage.stageId}`,
                "Regenerate only this stage from the unchanged typed contract above.",
                "Correct every listed semantic violation. Do not reuse prior candidate source, invent controls, or change target identity.",
              ].join("\n"),
            }
          : stage),
      };
    },
  });
  if (runner.status === "accepted") {
    materialized ??= await readProjectedDesignSourceAuthorityV2(input.repo, contract);
  }
  return { authority, runner, ...(materialized ? { artifacts: materialized } : {}) };
}

export function serializeAttemptTransportV2(value: unknown): string {
  return `${canonicalJsonStringify(AttemptTransportSchema.parse(value))}\n`;
}
