import { z } from "zod";

import { GitCodeShaSchema, Sha256Schema, hasUniqueStrings } from "./common-v1.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import { ProductCompilationAttemptIdSchema, ProductCompilationRetryAuthorityV1Schema } from "./product-compilation-attempt-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

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

/**
 * Runnable design-source request contract.
 *
 * V1 remains readable for compatibility, but it cannot be used to reserve a
 * ProductCompilationAttempt: its attemptRef participates in requestHash while
 * the attempt ID is itself derived from requestHash. V2 deliberately contains
 * only immutable provider-neutral request authority. The repository binds its
 * canonical hash to the generated attempt ID and workspace locator after the
 * reservation succeeds.
 */
export const DesignSourceGenerationRequestV2Schema = z
  .object({
    schema: z.literal("setfarm.design-source-generation-request.v2"),
    authorityHash: Sha256Schema,
    ordinal: z.union([z.literal(1), z.literal(2)]),
    retryAuthority: ProductCompilationRetryAuthorityV1Schema.nullable(),
    stages: z.array(z.object({
      stageId: z.string().regex(/^DSGS_[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/),
      targetRefs: z.array(GenerationTargetIdSchema).min(1).max(5).refine(hasUniqueStrings, {
        message: "A design generation stage target refs must be unique",
      }),
      promptHash: Sha256Schema,
    }).strict()).min(1).max(200),
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
    const stageIds = value.stages.map((stage) => stage.stageId);
    if (new Set(stageIds).size !== stageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["stages"],
        message: "Design generation request stage IDs must be unique",
      });
    }
    const orderedStageIds = [...stageIds].sort(compareUtf16);
    if (stageIds.some((stageId, index) => stageId !== orderedStageIds[index])) {
      context.addIssue({
        code: "custom",
        path: ["stages"],
        message: "Design generation request stages must use canonical stage-ID order",
      });
    }
    value.stages.forEach((stage, stageIndex) => {
      const expectedStageId = `DSGS_${String(stageIndex + 1).padStart(3, "0")}`;
      if (stage.stageId !== expectedStageId) {
        context.addIssue({
          code: "custom",
          path: ["stages", stageIndex, "stageId"],
          message: `Design generation stage identity must be the deterministic ordinal ${expectedStageId}`,
        });
      }
      const canonicalTargetRefs = [...stage.targetRefs].sort(compareUtf16);
      if (stage.targetRefs.some((targetRef, index) => targetRef !== canonicalTargetRefs[index])) {
        context.addIssue({
          code: "custom",
          path: ["stages", stageIndex, "targetRefs"],
          message: "Design generation stage target refs must use canonical UTF-16 order",
        });
      }
    });
    const targetRefs = value.stages.flatMap((stage) => stage.targetRefs);
    if (new Set(targetRefs).size !== targetRefs.length) {
      context.addIssue({
        code: "custom",
        path: ["stages"],
        message: "A generation target may occur in exactly one request stage",
      });
    }
  });

export type DesignSourceGenerationAuthorityV1 = z.infer<typeof DesignSourceGenerationAuthorityV1Schema>;
export type DesignSourceGenerationRequestV1 = z.infer<typeof DesignSourceGenerationRequestV1Schema>;
export type DesignSourceGenerationRequestV2 = z.infer<typeof DesignSourceGenerationRequestV2Schema>;
