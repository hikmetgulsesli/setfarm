import { z } from "zod";

import { GitCodeShaSchema, Sha256Schema, hasUniqueStrings } from "./common-v1.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import { ProductCompilationAttemptIdSchema, ProductCompilationRetryAuthorityV1Schema } from "./product-compilation-attempt-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);

export const DesignSourceGenerationAuthorityV1Schema = z
  .object({
    schema: z.literal("setfarm.design-source-generation-authority.v1"),
    runId: BoundedIdentitySchema,
    originClaimId: z.number().int().positive(),
    productSpecHash: Sha256Schema,
    generationTargetsHash: Sha256Schema,
    promptContractHash: Sha256Schema,
    renderPolicyHash: Sha256Schema,
    selectionPolicyHash: Sha256Schema,
    producerReleaseSha: GitCodeShaSchema,
    provider: BoundedIdentitySchema,
    model: BoundedIdentitySchema,
    deviceType: z.enum(["DESKTOP", "TABLET", "MOBILE"]),
    targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Design generation authority target refs must be unique",
    }),
    maximumAttempts: z.literal(2),
  })
  .strict();

export const DesignSourceGenerationRequestV1Schema = z
  .object({
    schema: z.literal("setfarm.design-source-generation-request.v1"),
    attemptRef: ProductCompilationAttemptIdSchema,
    authorityHash: Sha256Schema,
    ordinal: z.union([z.literal(1), z.literal(2)]),
    retryAuthority: ProductCompilationRetryAuthorityV1Schema.nullable(),
    promptHash: Sha256Schema,
    targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Design generation request target refs must be unique",
    }),
    attemptLocator: z.string().min(1).max(1_024),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.ordinal === 1) !== (value.retryAuthority === null)) {
      context.addIssue({
        code: "custom",
        path: ["retryAuthority"],
        message: "Only ordinal two may bind a proven retry delta",
      });
    }
  });

export type DesignSourceGenerationAuthorityV1 = z.infer<typeof DesignSourceGenerationAuthorityV1Schema>;
export type DesignSourceGenerationRequestV1 = z.infer<typeof DesignSourceGenerationRequestV1Schema>;
