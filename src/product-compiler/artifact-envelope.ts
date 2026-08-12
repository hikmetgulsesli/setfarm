import { z } from "zod";

import { SemanticArtifactProducerV1Schema } from "./schemas/common-v1.js";

export const SemanticArtifactEnvelopeV1Schema = z
  .object({
    schema: z.literal("setfarm.semantic-artifact-envelope.v1"),
    artifactType: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/),
    producer: SemanticArtifactProducerV1Schema,
    payload: z.unknown(),
  })
  .strict();

export type SemanticArtifactEnvelopeV1 = z.infer<typeof SemanticArtifactEnvelopeV1Schema>;
