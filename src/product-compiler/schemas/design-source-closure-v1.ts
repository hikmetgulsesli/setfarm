import { z } from "zod";

import { Sha256Schema } from "./common-v1.js";

function typedArtifactReference<const ArtifactType extends string>(artifactType: ArtifactType) {
  return z
    .object({
      artifactType: z.literal(artifactType),
      envelopeHash: Sha256Schema,
      payloadHash: Sha256Schema,
    })
    .strict();
}

export const DesignGenerationTargetsArtifactRefV1Schema = typedArtifactReference(
  "setfarm.design-generation-targets.v1",
);

export const StitchDirectResponseEvidenceArtifactRefV1Schema = typedArtifactReference(
  "setfarm.stitch-direct-response-evidence.v2",
);

export const StitchRenderedSemanticsArtifactRefV1Schema = typedArtifactReference(
  "setfarm.stitch-rendered-semantics.v1",
);

export const StitchTargetCandidateSelectionArtifactRefV1Schema = typedArtifactReference(
  "setfarm.stitch-target-candidate-selection.v1",
);

export const StitchTargetResponseBindingsArtifactRefV1Schema = typedArtifactReference(
  "setfarm.stitch-target-response-bindings.v2",
);

const NoDesignSourceClosureV1Schema = z
  .object({
    schema: z.literal("setfarm.design-source-closure.v1"),
    kind: z.literal("none"),
    reason: z.literal("product_delivery_design_not_required"),
  })
  .strict();

const StitchDesignSourceClosureV1Schema = z
  .object({
    schema: z.literal("setfarm.design-source-closure.v1"),
    kind: z.literal("stitch"),
    generationTargets: DesignGenerationTargetsArtifactRefV1Schema,
    directResponseEvidence: StitchDirectResponseEvidenceArtifactRefV1Schema,
    renderedSemantics: StitchRenderedSemanticsArtifactRefV1Schema,
    candidateSelection: StitchTargetCandidateSelectionArtifactRefV1Schema,
    responseBindings: StitchTargetResponseBindingsArtifactRefV1Schema,
  })
  .strict();

export const DesignSourceClosureV1Schema = z.discriminatedUnion("kind", [
  NoDesignSourceClosureV1Schema,
  StitchDesignSourceClosureV1Schema,
]);

export type DesignGenerationTargetsArtifactRefV1 = z.infer<
  typeof DesignGenerationTargetsArtifactRefV1Schema
>;
export type StitchDirectResponseEvidenceArtifactRefV1 = z.infer<
  typeof StitchDirectResponseEvidenceArtifactRefV1Schema
>;
export type StitchRenderedSemanticsArtifactRefV1 = z.infer<
  typeof StitchRenderedSemanticsArtifactRefV1Schema
>;
export type StitchTargetCandidateSelectionArtifactRefV1 = z.infer<
  typeof StitchTargetCandidateSelectionArtifactRefV1Schema
>;
export type StitchTargetResponseBindingsArtifactRefV1 = z.infer<
  typeof StitchTargetResponseBindingsArtifactRefV1Schema
>;
export type DesignSourceClosureV1 = z.infer<typeof DesignSourceClosureV1Schema>;
