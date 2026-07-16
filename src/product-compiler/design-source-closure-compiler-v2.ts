import { z } from "zod";

import { SemanticArtifactEnvelopeV1Schema } from "./artifact-store.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  DesignGenerationTargetsArtifactRefV2Schema,
  DesignInteractionGraphArtifactRefV2Schema,
  DesignSourceClosureV2Schema,
  StitchDirectResponseEvidenceArtifactRefV2Schema,
  StitchRenderedSemanticsArtifactRefV2Schema,
  StitchTargetCandidateSelectionArtifactRefV2Schema,
  StitchTargetResponseBindingsArtifactRefV3Schema,
  type DesignSourceClosureV2,
} from "./schemas/design-source-closure-v2.js";
import { DesignGenerationTargetsV2Schema } from "./schemas/design-generation-targets-v2.js";
import { DesignInteractionGraphV2Schema } from "./schemas/design-interaction-graph-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import { ProductCompilationAttemptV1Schema } from "./schemas/product-compilation-attempt-v1.js";
import { StitchDirectResponseEvidenceV2Schema } from "./schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV2Schema } from "./schemas/stitch-rendered-semantics-v2.js";
import {
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
} from "./schemas/stitch-target-candidate-selection-v2.js";
import {
  ProductCompilationArtifactManifestV1Schema,
  ProductCompilationProjectionReceiptV1Schema,
} from "./product-compilation-attempt-workspace.js";

function artifactEvidenceSchema<ReferenceSchema extends z.ZodType>(referenceSchema: ReferenceSchema) {
  return z.object({
    reference: referenceSchema,
    envelope: SemanticArtifactEnvelopeV1Schema,
  }).strict();
}

const NoDesignSourceClosureCompilerInputV2Schema = z.object({
  kind: z.literal("none"),
}).strict();

const StitchDesignSourceClosureCompilerInputV2Schema = z.object({
  kind: z.literal("stitch"),
  productSpecV2Hash: Sha256Schema,
  generationTargets: artifactEvidenceSchema(DesignGenerationTargetsArtifactRefV2Schema),
  directResponseEvidence: artifactEvidenceSchema(StitchDirectResponseEvidenceArtifactRefV2Schema),
  renderedSemantics: artifactEvidenceSchema(StitchRenderedSemanticsArtifactRefV2Schema),
  candidateSelection: artifactEvidenceSchema(StitchTargetCandidateSelectionArtifactRefV2Schema),
  responseBindings: artifactEvidenceSchema(StitchTargetResponseBindingsArtifactRefV3Schema),
  designGraph: artifactEvidenceSchema(DesignInteractionGraphArtifactRefV2Schema),
  acceptedAttempt: ProductCompilationAttemptV1Schema,
  artifactManifest: ProductCompilationArtifactManifestV1Schema,
  projectionReceipt: ProductCompilationProjectionReceiptV1Schema,
}).strict();

export const DesignSourceClosureCompilerInputV2Schema = z.discriminatedUnion("kind", [
  NoDesignSourceClosureCompilerInputV2Schema,
  StitchDesignSourceClosureCompilerInputV2Schema,
]);

export type DesignSourceClosureCompilerInputV2 = z.input<
  typeof DesignSourceClosureCompilerInputV2Schema
>;

export type DesignSourceClosureIssueV2 = Readonly<{
  code:
    | "CONTRACT_DESIGN_SOURCE_CLOSURE_V2_INVALID"
    | "CONTRACT_DESIGN_SOURCE_CHILD_ARTIFACT_TYPE_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_CHILD_ENVELOPE_HASH_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_CHILD_PAYLOAD_HASH_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_HASH_CHAIN_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_ATTEMPT_NOT_ACCEPTED"
    | "CONTRACT_DESIGN_SOURCE_ATTEMPT_OUTPUT_REFS_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_OUTPUT_SEAL_HASH_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_MANIFEST_BINDING_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_PROJECTION_BINDING_MISMATCH";
  message: string;
  reference: string;
}>;

export type ValidatedDesignSourceClosureInputV2 = Readonly<{
  kind: "none" | "stitch";
  closure: DesignSourceClosureV2;
}>;

export type ValidateDesignSourceClosureResultV2 =
  | Readonly<{ status: "validated"; value: ValidatedDesignSourceClosureInputV2 }>
  | Readonly<{ status: "rejected"; issues: readonly DesignSourceClosureIssueV2[] }>;

export type CompileDesignSourceClosureResultV2 =
  | Readonly<{ status: "compiled"; closure: DesignSourceClosureV2 }>
  | Readonly<{ status: "rejected"; issues: readonly DesignSourceClosureIssueV2[] }>;

type ParsedStitchInput = z.infer<typeof StitchDesignSourceClosureCompilerInputV2Schema>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function issue(
  code: DesignSourceClosureIssueV2["code"],
  message: string,
  reference: string,
): DesignSourceClosureIssueV2 {
  return { code, message, reference };
}

function schemaIssues(error: z.ZodError): DesignSourceClosureIssueV2[] {
  return error.issues.slice(0, 100).map((entry) => issue(
    "CONTRACT_DESIGN_SOURCE_CLOSURE_V2_INVALID",
    `Design-source closure v2 input failed at ${entry.path.join("/") || "$"}: ${entry.message}`,
    entry.path.join("/") || "$",
  ));
}

function validateSemanticArtifact<Payload>(input: Readonly<{
  label: string;
  expectedArtifactType: string;
  evidence: {
    reference: { artifactType: string; envelopeHash: string; payloadHash: string };
    envelope: z.infer<typeof SemanticArtifactEnvelopeV1Schema>;
  };
  payloadSchema?: z.ZodType<Payload>;
}>): Readonly<{
  payload?: Payload;
  issues: readonly DesignSourceClosureIssueV2[];
}> {
  const issues: DesignSourceClosureIssueV2[] = [];
  const { label, expectedArtifactType, evidence } = input;
  if (
    evidence.reference.artifactType !== expectedArtifactType
    || evidence.envelope.artifactType !== expectedArtifactType
  ) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_CHILD_ARTIFACT_TYPE_MISMATCH",
      `${label} must use exact artifact type ${expectedArtifactType}`,
      `${label}.artifactType`,
    ));
  }

  let envelopeHash: string | undefined;
  try {
    envelopeHash = hashCanonicalJson(evidence.envelope);
  } catch (error) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_CLOSURE_V2_INVALID",
      `${label} envelope is not canonical JSON: ${error instanceof Error ? error.message : String(error)}`,
      `${label}.envelope`,
    ));
  }
  if (envelopeHash && envelopeHash !== evidence.reference.envelopeHash) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_CHILD_ENVELOPE_HASH_MISMATCH",
      `${label} envelope hash does not bind the supplied semantic artifact envelope`,
      `${label}.reference.envelopeHash`,
    ));
  }

  let payload: Payload | undefined;
  if (input.payloadSchema) {
    const parsed = input.payloadSchema.safeParse(evidence.envelope.payload);
    if (!parsed.success) {
      issues.push(...parsed.error.issues.slice(0, 100).map((entry) => issue(
        "CONTRACT_DESIGN_SOURCE_CLOSURE_V2_INVALID",
        `${label} payload failed at ${entry.path.join("/") || "$"}: ${entry.message}`,
        `${label}.envelope.payload:${entry.path.join("/") || "$"}`,
      )));
    } else {
      payload = parsed.data;
    }
  } else {
    payload = evidence.envelope.payload as Payload;
  }

  if (payload !== undefined) {
    let payloadHash: string | undefined;
    try {
      payloadHash = hashCanonicalJson(payload);
    } catch (error) {
      issues.push(issue(
        "CONTRACT_DESIGN_SOURCE_CLOSURE_V2_INVALID",
        `${label} payload is not canonical JSON: ${error instanceof Error ? error.message : String(error)}`,
        `${label}.envelope.payload`,
      ));
    }
    if (payloadHash && payloadHash !== evidence.reference.payloadHash) {
      issues.push(issue(
        "CONTRACT_DESIGN_SOURCE_CHILD_PAYLOAD_HASH_MISMATCH",
        `${label} payload hash does not bind the exact validated child payload`,
        `${label}.reference.payloadHash`,
      ));
    }
  }
  return { ...(payload === undefined ? {} : { payload }), issues };
}

function expectedAcceptedOutputRefs(input: ParsedStitchInput) {
  return {
    directResponseEvidenceHash: input.directResponseEvidence.reference.payloadHash,
    renderedSemanticsHash: input.renderedSemantics.reference.payloadHash,
    candidateSelectionHash: input.candidateSelection.reference.payloadHash,
    responseBindingsHash: input.responseBindings.reference.payloadHash,
  };
}

function validateAttemptProjection(
  input: ParsedStitchInput,
): DesignSourceClosureIssueV2[] {
  const issues: DesignSourceClosureIssueV2[] = [];
  const attempt = input.acceptedAttempt;
  const expectedOutputRefs = expectedAcceptedOutputRefs(input);
  if (
    attempt.state !== "sealed"
    || attempt.disposition !== "accepted"
    || !attempt.outputRefs
    || attempt.failure !== null
    || !attempt.outputSealHash
  ) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_ATTEMPT_NOT_ACCEPTED",
      "Design-source closure v2 requires one sealed accepted ProductCompilationAttempt",
      "acceptedAttempt",
    ));
    return issues;
  }

  if (canonicalJsonStringify(attempt.outputRefs) !== canonicalJsonStringify(expectedOutputRefs)) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_ATTEMPT_OUTPUT_REFS_MISMATCH",
      "Accepted attempt output refs must exactly equal the four generated design "
        + "payload hashes; closure self-hashes and inferred outputs are forbidden",
      "acceptedAttempt.outputRefs",
    ));
  }

  const expectedOutputSealHash = hashCanonicalJson({
    schema: "setfarm.product-compilation-output-seal.v1",
    attemptRef: attempt.attemptId,
    disposition: "accepted",
    outputRefs: attempt.outputRefs,
  });
  if (attempt.outputSealHash !== expectedOutputSealHash) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_OUTPUT_SEAL_HASH_MISMATCH",
      "Accepted attempt output seal does not bind its exact attempt ref and output refs",
      "acceptedAttempt.outputSealHash",
    ));
  }

  const manifest = input.artifactManifest;
  const expectedAuthorityNames = Object.keys(expectedOutputRefs).sort();
  const observedAuthorityNames = manifest.authorityArtifacts
    .map((artifact) => artifact.outputRef)
    .sort();
  const manifestAuthorityMismatch =
    manifest.attemptId !== attempt.attemptId
    || manifest.outputSealHash !== attempt.outputSealHash
    || canonicalJsonStringify(manifest.outputRefs) !== canonicalJsonStringify(attempt.outputRefs)
    || canonicalJsonStringify(observedAuthorityNames) !== canonicalJsonStringify(expectedAuthorityNames)
    || manifest.authorityArtifacts.some((artifact) =>
      expectedOutputRefs[artifact.outputRef as keyof typeof expectedOutputRefs]
        !== artifact.source.contentHash);
  if (manifestAuthorityMismatch) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_MANIFEST_BINDING_MISMATCH",
      "Canonical artifact manifest must bind the accepted attempt, output seal, "
        + "exact output refs, and complete authority artifacts",
      "artifactManifest",
    ));
  }

  const receipt = input.projectionReceipt;
  const expectedProjectionArtifacts = manifest.projectionArtifacts
    .map((artifact) => ({
      path: artifact.targetPath,
      contentHash: artifact.source.contentHash,
      byteLength: artifact.source.byteLength,
    }))
    .sort((left, right) => compareUtf16(left.path, right.path));
  const expectedProjectionHash = hashCanonicalJson({
    schema: "setfarm.product-compilation-projection-content.v1",
    attemptId: attempt.attemptId,
    artifacts: receipt.artifacts,
  });
  if (
    receipt.attemptId !== attempt.attemptId
    || receipt.outputSealHash !== attempt.outputSealHash
    || receipt.manifestHash !== manifest.manifestHash
    || receipt.projectionHash !== expectedProjectionHash
    || canonicalJsonStringify(receipt.artifacts) !== canonicalJsonStringify(expectedProjectionArtifacts)
  ) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_PROJECTION_BINDING_MISMATCH",
      "Canonical projection receipt must bind the accepted attempt, output seal, "
        + "manifest, projection content, and exact projected artifacts",
      "projectionReceipt",
    ));
  }
  return issues;
}

export function validateDesignSourceClosureInputV2(
  input: unknown,
): ValidateDesignSourceClosureResultV2 {
  const parsed = DesignSourceClosureCompilerInputV2Schema.safeParse(input);
  if (!parsed.success) return { status: "rejected", issues: schemaIssues(parsed.error) };
  if (parsed.data.kind === "none") {
    const closure = DesignSourceClosureV2Schema.parse({
      schema: "setfarm.design-source-closure.v2",
      kind: "none",
      reason: "product_delivery_design_not_required",
    });
    return { status: "validated", value: { kind: "none", closure } };
  }

  const value = parsed.data;
  const generationTargets = validateSemanticArtifact({
    label: "generationTargets",
    expectedArtifactType: "setfarm.design-generation-targets.v2",
    evidence: value.generationTargets,
    payloadSchema: DesignGenerationTargetsV2Schema,
  });
  const directResponseEvidence = validateSemanticArtifact({
    label: "directResponseEvidence",
    expectedArtifactType: "setfarm.stitch-direct-response-evidence.v2",
    evidence: value.directResponseEvidence,
    payloadSchema: StitchDirectResponseEvidenceV2Schema,
  });
  const renderedSemantics = validateSemanticArtifact({
    label: "renderedSemantics",
    expectedArtifactType: "setfarm.stitch-rendered-semantics.v2",
    evidence: value.renderedSemantics,
    payloadSchema: StitchRenderedSemanticsV2Schema,
  });
  const candidateSelection = validateSemanticArtifact({
    label: "candidateSelection",
    expectedArtifactType: "setfarm.stitch-target-candidate-selection.v2",
    evidence: value.candidateSelection,
    payloadSchema: StitchTargetCandidateSelectionV2Schema,
  });
  const responseBindings = validateSemanticArtifact({
    label: "responseBindings",
    expectedArtifactType: "setfarm.stitch-target-response-bindings.v3",
    evidence: value.responseBindings,
    payloadSchema: StitchTargetResponseBindingsV3Schema,
  });
  const designGraph = validateSemanticArtifact({
    label: "designGraph",
    expectedArtifactType: "setfarm.design-interaction-graph.v2",
    evidence: value.designGraph,
    payloadSchema: DesignInteractionGraphV2Schema,
  });
  const issues = [
    ...generationTargets.issues,
    ...directResponseEvidence.issues,
    ...renderedSemantics.issues,
    ...candidateSelection.issues,
    ...responseBindings.issues,
    ...designGraph.issues,
  ];
  if (
    generationTargets.payload
    && directResponseEvidence.payload
    && renderedSemantics.payload
    && candidateSelection.payload
    && responseBindings.payload
    && designGraph.payload
  ) {
    const chainMatches =
      generationTargets.payload.productSpecHash === value.productSpecV2Hash
      && renderedSemantics.payload.generationTargetsHash
        === value.generationTargets.reference.payloadHash
      && renderedSemantics.payload.directResponseEvidenceHash
        === value.directResponseEvidence.reference.payloadHash
      && candidateSelection.payload.generationTargetsHash
        === value.generationTargets.reference.payloadHash
      && candidateSelection.payload.directResponseEvidenceHash
        === value.directResponseEvidence.reference.payloadHash
      && candidateSelection.payload.renderedSemanticsHash
        === value.renderedSemantics.reference.payloadHash
      && responseBindings.payload.generationTargetsHash
        === value.generationTargets.reference.payloadHash
      && responseBindings.payload.directResponseEvidenceHash
        === value.directResponseEvidence.reference.payloadHash
      && responseBindings.payload.renderedSemanticsHash
        === value.renderedSemantics.reference.payloadHash
      && responseBindings.payload.candidateSelectionHash
        === value.candidateSelection.reference.payloadHash
      && designGraph.payload.productSpecHash === value.productSpecV2Hash
      && designGraph.payload.generationTargetsHash
        === value.generationTargets.reference.payloadHash
      && designGraph.payload.renderedSemanticsHash
        === value.renderedSemantics.reference.payloadHash
      && designGraph.payload.candidateSelectionHash
        === value.candidateSelection.reference.payloadHash
      && designGraph.payload.responseBindingsHash
        === value.responseBindings.reference.payloadHash;
    if (!chainMatches) {
      issues.push(issue(
        "CONTRACT_DESIGN_SOURCE_HASH_CHAIN_MISMATCH",
        "ProductSpecV2, generation targets, direct evidence, rendered semantics, "
          + "candidate selection, response bindings, and DesignInteractionGraphV2 "
          + "do not form one exact payload hash chain",
        "designSource",
      ));
    }
  }
  issues.push(...validateAttemptProjection(value));
  if (issues.length > 0) return { status: "rejected", issues };

  const closure = DesignSourceClosureV2Schema.parse({
    schema: "setfarm.design-source-closure.v2",
    kind: "stitch",
    generationTargets: value.generationTargets.reference,
    directResponseEvidence: value.directResponseEvidence.reference,
    renderedSemantics: value.renderedSemantics.reference,
    candidateSelection: value.candidateSelection.reference,
    responseBindings: value.responseBindings.reference,
    designGraph: value.designGraph.reference,
    acceptedAttempt: {
      attemptRef: value.acceptedAttempt.attemptId,
      outputSealHash: value.acceptedAttempt.outputSealHash,
    },
    artifactManifest: {
      artifactType: "setfarm.product-compilation-artifact-manifest.v1",
      artifactHash: value.artifactManifest.manifestHash,
    },
    projectionReceipt: {
      artifactType: "setfarm.product-compilation-projection-receipt.v1",
      artifactHash: value.projectionReceipt.receiptHash,
    },
  });
  return { status: "validated", value: { kind: "stitch", closure } };
}

export function buildDesignSourceClosureV2(input: Readonly<{
  validated: ValidatedDesignSourceClosureInputV2;
}>): DesignSourceClosureV2 {
  return DesignSourceClosureV2Schema.parse(input.validated.closure);
}

export function compileDesignSourceClosureV2(input: unknown): CompileDesignSourceClosureResultV2 {
  const validated = validateDesignSourceClosureInputV2(input);
  if (validated.status === "rejected") return validated;
  return {
    status: "compiled",
    closure: buildDesignSourceClosureV2({ validated: validated.value }),
  };
}
