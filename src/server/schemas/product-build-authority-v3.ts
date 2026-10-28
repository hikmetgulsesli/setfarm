import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { BuildTopologyV1Schema } from "../../product-compiler/schemas/build-topology-v1.js";
import { ProductCompilationReportV3Schema } from "../../product-compiler/schemas/compilation-report-v3.js";
import { SemanticArtifactProducerV1Schema, Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import { DesignGenerationTargetsV2Schema } from "../../product-compiler/schemas/design-generation-targets-v2.js";
import { DesignInteractionGraphV2Schema } from "../../product-compiler/schemas/design-interaction-graph-v2.js";
import { DesignSourceClosureV2Schema } from "../../product-compiler/schemas/design-source-closure-v2.js";
import { ImplementationSourceMapV1Schema } from "../../product-compiler/schemas/implementation-source-map-v1.js";
import { ProductBuildPacketV3Schema } from "../../product-compiler/schemas/product-build-packet-v3.js";
import { ProductSpecV2Schema } from "../../product-compiler/schemas/product-spec-v2.js";
import { StitchDirectResponseEvidenceV2Schema } from "../../product-compiler/schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV2Schema } from "../../product-compiler/schemas/stitch-rendered-semantics-v2.js";
import {
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
} from "../../product-compiler/schemas/stitch-target-candidate-selection-v2.js";
import { StoryPlanV2Schema } from "../../product-compiler/schemas/story-plan-v2.js";
import { ProductBuildAuthorityV1Schema } from "./product-build-authority-v1.js";
import { ProductBuildAuthorityV2Schema, ProductBuildRefusalV2Schema } from "./product-build-authority-v2.js";

const NativeDesignSourcesSchema = z.object({
  generationTargets: DesignGenerationTargetsV2Schema,
  directResponseEvidence: StitchDirectResponseEvidenceV2Schema,
  renderedSemantics: StitchRenderedSemanticsV2Schema,
  candidateSelection: StitchTargetCandidateSelectionV2Schema,
  responseBindings: StitchTargetResponseBindingsV3Schema,
}).strict();

const NativePacketAuthoritySchema = z.object({
  schema: z.literal("setfarm.product-build-packet-authority.v3"),
  runId: z.string().min(1).max(200),
  packetHash: Sha256Schema,
  producer: SemanticArtifactProducerV1Schema,
  productSpec: ProductSpecV2Schema,
  designGraph: DesignInteractionGraphV2Schema.nullable(),
  buildTopology: BuildTopologyV1Schema,
  storyPlan: StoryPlanV2Schema,
  designSourceClosure: DesignSourceClosureV2Schema,
  implementationSourceMap: ImplementationSourceMapV1Schema,
  designSources: NativeDesignSourcesSchema.optional(),
  packet: ProductBuildPacketV3Schema,
  compilationReport: ProductCompilationReportV3Schema.options[1],
  refs: z.object({
    productSpec: Sha256Schema,
    designGraph: Sha256Schema.nullable(),
    buildTopology: Sha256Schema,
    storyPlan: Sha256Schema,
    designSourceClosure: Sha256Schema,
    implementationSourceMap: Sha256Schema,
    packet: Sha256Schema,
    compilationReport: Sha256Schema,
  }).strict(),
  authorityHash: Sha256Schema,
}).strict();

type NativePacketAuthority = z.infer<typeof NativePacketAuthoritySchema>;

function issue(context: z.RefinementCtx, path: PropertyKey[], message: string): void {
  context.addIssue({ code: "custom", path, message });
}

function validateNativeRefs(value: NativePacketAuthority, context: z.RefinementCtx): void {
  const { packet, compilationReport: report, refs, producer } = value;
  if (
    value.packetHash !== refs.packet
    || report.packetHash !== refs.packet
    || producer.codeSha !== packet.compiler.codeSha
    || hashCanonicalJson(report.compiler) !== hashCanonicalJson(packet.compiler)
  ) issue(context, ["packet"], "Packet, producer, report and packet ref must attest one exact compiler and packet");

  const bindings = [
    ["productSpec", "productSpecV2Hash", "productSpecV2"],
    ["designGraph", "designGraphV2Hash", "designGraphV2"],
    ["buildTopology", "buildTopologyV1Hash", "buildTopologyV1"],
    ["storyPlan", "storyPlanV2Hash", "storyPlanV2"],
    ["designSourceClosure", "designSourceClosureV2Hash", "designSourceClosureV2"],
    ["implementationSourceMap", "implementationSourceMapV1Hash", "implementationSourceMapV1"],
  ] as const;
  for (const [ref, packetField, reportField] of bindings) {
    if (packet[packetField] !== refs[ref] || report.artifactHashes[reportField] !== refs[ref]) {
      issue(context, ["refs", ref], "Packet and sealed report must bind the exact child envelope ref");
    }
  }
  // Only top-level semantic envelopes share this producer. Nested closure
  // envelopes retain their exact refs and may have distinct producers.
  for (const key of ["productSpec", "designGraph", "buildTopology", "storyPlan", "designSourceClosure", "implementationSourceMap", "packet", "compilationReport"] as const) {
    const payload = value[key];
    const expected = payload === null ? null : hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: payload.schema,
      producer,
      payload,
    });
    if (refs[key] !== expected) issue(context, ["refs", key], "Ref must bind the exact top-level semantic envelope");
  }
}

function validatePayloadRelationships(value: NativePacketAuthority, context: z.RefinementCtx): void {
  const { productSpec, designGraph, buildTopology, storyPlan, designSourceClosure, implementationSourceMap: sourceMap, packet } = value;
  const specHash = hashCanonicalJson(productSpec);
  const graphHash = designGraph === null ? null : hashCanonicalJson(designGraph);
  const topologyHash = hashCanonicalJson(buildTopology);
  const kind = productSpec.delivery.designRequired ? "stitch" : "none";
  if (
    packet.designSourceKind !== kind || storyPlan.designSourceKind !== kind
    || designSourceClosure.kind !== kind || sourceMap.designSourceKind !== kind
    || (designGraph !== null) !== (kind === "stitch")
    || Boolean(value.designSources) !== (kind === "stitch")
  ) issue(context, ["designSourceClosure"], "All design-kind witnesses, graph and complete source set must agree");
  if (
    sourceMap.productSpecV2PayloadHash !== specHash
    || sourceMap.designGraphV2PayloadHash !== graphHash
    || sourceMap.buildTopologyV1PayloadHash !== topologyHash
    || sourceMap.storyPlanV2PayloadHash !== hashCanonicalJson(storyPlan)
    || sourceMap.designSourceClosureV2PayloadHash !== hashCanonicalJson(designSourceClosure)
    || storyPlan.productSpecHash !== specHash || storyPlan.designGraphHash !== graphHash
    || storyPlan.buildTopologyHash !== topologyHash
    || (designGraph !== null && designGraph.productSpecHash !== specHash)
  ) issue(context, ["implementationSourceMap"], "Native graph/story/source-map payload hashes must form one exact authority chain");
  const dataPresent = buildTopology.runtimeDataContractHash !== undefined;
  const evidencePresent = buildTopology.runtimeEvidenceContractHash !== undefined;
  if (
    dataPresent !== evidencePresent
    || packet.runtimeDataContractHash !== buildTopology.runtimeDataContractHash
    || packet.runtimeEvidenceContractHash !== buildTopology.runtimeEvidenceContractHash
  ) issue(context, ["packet"], "Runtime contract hashes must activate together and equal topology authority");
}

function validateStitchRelationships(value: NativePacketAuthority, context: z.RefinementCtx): void {
  const { designSourceClosure: closure, designGraph: graph, designSources: sources, implementationSourceMap: sourceMap } = value;
  if (closure.kind !== "stitch" || !graph || !sources || sourceMap.designSourceKind !== "stitch") return;
  if (closure.designGraph.envelopeHash !== value.refs.designGraph || closure.designGraph.payloadHash !== hashCanonicalJson(graph)) {
    issue(context, ["designSourceClosure", "designGraph"], "Stitch closure must bind the exact graph envelope and payload");
  }
  for (const key of ["generationTargets", "directResponseEvidence", "renderedSemantics", "candidateSelection", "responseBindings"] as const) {
    if (closure[key].artifactType !== sources[key].schema || closure[key].payloadHash !== hashCanonicalJson(sources[key])) {
      issue(context, ["designSources", key], "Nested source payload must equal its exact typed closure payload hash");
    }
  }
  const targetsHash = hashCanonicalJson(sources.generationTargets);
  const directHash = hashCanonicalJson(sources.directResponseEvidence);
  const renderedHash = hashCanonicalJson(sources.renderedSemantics);
  const selectionHash = hashCanonicalJson(sources.candidateSelection);
  const bindingsHash = hashCanonicalJson(sources.responseBindings);
  if (
    sources.generationTargets.productSpecHash !== hashCanonicalJson(value.productSpec)
    || sources.renderedSemantics.generationTargetsHash !== targetsHash
    || sources.renderedSemantics.directResponseEvidenceHash !== directHash
    || sources.candidateSelection.generationTargetsHash !== targetsHash
    || sources.candidateSelection.directResponseEvidenceHash !== directHash
    || sources.candidateSelection.renderedSemanticsHash !== renderedHash
    || sources.responseBindings.generationTargetsHash !== targetsHash
    || sources.responseBindings.directResponseEvidenceHash !== directHash
    || sources.responseBindings.renderedSemanticsHash !== renderedHash
    || sources.responseBindings.candidateSelectionHash !== selectionHash
    || graph.generationTargetsHash !== targetsHash || graph.renderedSemanticsHash !== renderedHash
    || graph.candidateSelectionHash !== selectionHash || graph.responseBindingsHash !== bindingsHash
  ) issue(context, ["designSources"], "Stitch source collections and graph must bind the exact same source payload chain");

  const targets = new Map(sources.generationTargets.targets.map(target => [target.targetId, target] as const));
  const responses = new Map(sources.responseBindings.bindings.map(binding => [binding.targetRef, binding] as const));
  if (sourceMap.screens.length !== targets.size || sourceMap.screens.length !== responses.size || graph.sourceAuthorities.length !== targets.size) {
    issue(context, ["implementationSourceMap", "screens"], "Every and only exact target/response must have one source-map screen");
  }
  graph.sourceAuthorities.forEach((authority, index) => {
    const response = responses.get(authority.targetRef);
    const sourceFields = [
      "targetHash", "responseScreenId", "stageId", "htmlSourceRefHash", "screenshotSourceRefHash",
      "htmlDownloadedArtifactHash", "screenshotDownloadedArtifactHash", "htmlArtifactHash", "screenshotArtifactHash",
      "renderedHtmlArtifactHash", "renderedScreenshotArtifactHash", "semanticDomHash", "semanticObservationHash", "roleReceiptSetHash",
    ] as const;
    if (!response || sourceFields.some(key => authority[key] !== response[key])) {
      issue(context, ["designGraph", "sourceAuthorities", index], "Graph source authority must preserve the exact selected response provenance");
    }
  });
  sourceMap.screens.forEach((screen, index) => {
    const target = targets.get(screen.targetRef);
    const response = responses.get(screen.targetRef);
    if (
      !target || !response || screen.responseScreenId !== response.responseScreenId
      || screen.targetHash !== hashCanonicalJson(target) || screen.targetHash !== response.targetHash
      || screen.responseBindingHash !== hashCanonicalJson(response)
    ) issue(context, ["implementationSourceMap", "screens", index], "Screen must bind its exact generation target and selected response");
  });
}

export const ProductBuildPacketAuthorityV3Schema = NativePacketAuthoritySchema.superRefine((value, context) => {
  validateNativeRefs(value, context);
  validatePayloadRelationships(value, context);
  validateStitchRelationships(value, context);
  const { authorityHash: _authorityHash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.authorityHash) issue(context, ["authorityHash"], "Native authority hash must bind the complete canonical exact packet");
});

export type ProductBuildPacketAuthorityV3 = z.infer<typeof ProductBuildPacketAuthorityV3Schema>;

const SealedAuthorityV3Schema = z.object({
  schema: z.literal("setfarm.product-build-authority.v3"),
  runId: z.string().min(1).max(200),
  disposition: z.literal("sealed_packet"),
  packetAuthority: z.discriminatedUnion("schema", [ProductBuildAuthorityV1Schema, ProductBuildPacketAuthorityV3Schema]),
  refusal: z.null(),
  authorityHash: Sha256Schema,
}).strict();

const RefusedAuthorityV3Schema = z.object({
  schema: z.literal("setfarm.product-build-authority.v3"),
  runId: z.string().min(1).max(200),
  disposition: z.literal("refused_before_packet"),
  packetAuthority: z.null(),
  refusal: ProductBuildRefusalV2Schema,
  authorityHash: Sha256Schema,
}).strict();

export const ProductBuildAuthorityV3Schema = z.discriminatedUnion("disposition", [SealedAuthorityV3Schema, RefusedAuthorityV3Schema]).superRefine((value, context) => {
  if (value.disposition === "sealed_packet") {
    if (value.runId !== value.packetAuthority.runId) issue(context, ["packetAuthority", "runId"], "Authority must wrap the exact same run");
  } else {
    // Reuse every existing v2 refusal relationship refinement unchanged. The
    // temporary v2 identity is local validation only, never emitted as wire.
    const legacyIdentity = { ...value, schema: "setfarm.product-build-authority.v2" as const };
    const { authorityHash: _legacyHash, ...legacyCore } = legacyIdentity;
    const result = ProductBuildAuthorityV2Schema.safeParse({ ...legacyCore, authorityHash: hashCanonicalJson(legacyCore) });
    if (!result.success) for (const error of result.error.issues) context.addIssue({ ...error, path: [...error.path] });
  }
  const { authorityHash: _authorityHash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.authorityHash) issue(context, ["authorityHash"], "Authority hash must bind the complete canonical v3 response");
});

export type ProductBuildAuthorityV3 = z.infer<typeof ProductBuildAuthorityV3Schema>;
