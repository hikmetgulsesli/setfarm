import { z } from "zod";

import { Sha256Schema } from "./common-v1.js";
import { ProductCompilationAttemptIdSchema } from "./product-compilation-attempt-v1.js";

function typedArtifactReference<const ArtifactType extends string>(artifactType: ArtifactType) {
  return z
    .object({
      artifactType: z.literal(artifactType),
      envelopeHash: Sha256Schema,
      payloadHash: Sha256Schema,
    })
    .strict();
}

function canonicalArtifactReference<const ArtifactType extends string>(artifactType: ArtifactType) {
  return z
    .object({
      artifactType: z.literal(artifactType),
      artifactHash: Sha256Schema,
    })
    .strict();
}

export const DesignGenerationTargetsArtifactRefV2Schema = typedArtifactReference(
  "setfarm.design-generation-targets.v2",
);

export const StitchDirectResponseEvidenceArtifactRefV2Schema = typedArtifactReference(
  "setfarm.stitch-direct-response-evidence.v2",
);

export const StitchRenderedSemanticsArtifactRefV2Schema = typedArtifactReference(
  "setfarm.stitch-rendered-semantics.v2",
);

export const StitchTargetCandidateSelectionArtifactRefV2Schema = typedArtifactReference(
  "setfarm.stitch-target-candidate-selection.v2",
);

export const StitchTargetResponseBindingsArtifactRefV3Schema = typedArtifactReference(
  "setfarm.stitch-target-response-bindings.v3",
);

// Closure payloads carry only exact typed references. The closure compiler owns
// deep DesignInteractionGraphV2 validation; consumers never infer a v2 graph
// from the v1 payload shape.
export const DesignInteractionGraphArtifactRefV2Schema = typedArtifactReference(
  "setfarm.design-interaction-graph.v2",
);

export const ProductCompilationAcceptedAttemptRefV1Schema = z
  .object({
    attemptRef: ProductCompilationAttemptIdSchema,
    outputSealHash: Sha256Schema,
  })
  .strict();

export const ProductCompilationArtifactManifestRefV1Schema = canonicalArtifactReference(
  "setfarm.product-compilation-artifact-manifest.v1",
);

export const ProductCompilationProjectionReceiptRefV1Schema = canonicalArtifactReference(
  "setfarm.product-compilation-projection-receipt.v1",
);

const NoDesignSourceClosureV2Schema = z
  .object({
    schema: z.literal("setfarm.design-source-closure.v2"),
    kind: z.literal("none"),
    reason: z.literal("product_delivery_design_not_required"),
  })
  .strict();

const StitchDesignSourceClosureV2Schema = z
  .object({
    schema: z.literal("setfarm.design-source-closure.v2"),
    kind: z.literal("stitch"),
    generationTargets: DesignGenerationTargetsArtifactRefV2Schema,
    directResponseEvidence: StitchDirectResponseEvidenceArtifactRefV2Schema,
    renderedSemantics: StitchRenderedSemanticsArtifactRefV2Schema,
    candidateSelection: StitchTargetCandidateSelectionArtifactRefV2Schema,
    responseBindings: StitchTargetResponseBindingsArtifactRefV3Schema,
    designGraph: DesignInteractionGraphArtifactRefV2Schema,
    acceptedAttempt: ProductCompilationAcceptedAttemptRefV1Schema,
    artifactManifest: ProductCompilationArtifactManifestRefV1Schema,
    projectionReceipt: ProductCompilationProjectionReceiptRefV1Schema,
  })
  .strict();

export const DesignSourceClosureV2Schema = z.discriminatedUnion("kind", [
  NoDesignSourceClosureV2Schema,
  StitchDesignSourceClosureV2Schema,
]);

export type DesignGenerationTargetsArtifactRefV2 = z.infer<
  typeof DesignGenerationTargetsArtifactRefV2Schema
>;
export type StitchDirectResponseEvidenceArtifactRefV2 = z.infer<
  typeof StitchDirectResponseEvidenceArtifactRefV2Schema
>;
export type StitchRenderedSemanticsArtifactRefV2 = z.infer<
  typeof StitchRenderedSemanticsArtifactRefV2Schema
>;
export type StitchTargetCandidateSelectionArtifactRefV2 = z.infer<
  typeof StitchTargetCandidateSelectionArtifactRefV2Schema
>;
export type StitchTargetResponseBindingsArtifactRefV3 = z.infer<
  typeof StitchTargetResponseBindingsArtifactRefV3Schema
>;
export type DesignInteractionGraphArtifactRefV2 = z.infer<
  typeof DesignInteractionGraphArtifactRefV2Schema
>;
export type DesignSourceClosureV2 = z.infer<typeof DesignSourceClosureV2Schema>;
