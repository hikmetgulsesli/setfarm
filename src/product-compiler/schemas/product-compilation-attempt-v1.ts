import { z } from "zod";

import { Sha256Schema, hasUniqueStrings } from "./common-v1.js";

export const ProductCompilationAttemptIdSchema = z
  .string()
  .regex(/^PCA_[a-f0-9]{64}$/);

export const ProductCompilationPassKindV1Schema = z.enum([
  "design_source_generation",
]);

export const ProductCompilationAttemptStateV1Schema = z.enum([
  "reserved",
  "dispatching",
  "sealed",
  "quarantined",
]);

export const ProductCompilationAttemptDispositionV1Schema = z.enum([
  "accepted",
  "rejected",
  "infrastructure_failure",
  "dispatch_ambiguous",
]);

const TimestampSchema = z.string().datetime({ offset: true });
const BoundedIdentitySchema = z.string().min(1).max(500);

export const ProductCompilationRetryAuthorityV1Schema = z
  .object({
    parentAttemptRef: ProductCompilationAttemptIdSchema,
    parentFailureArtifactHash: Sha256Schema,
    parentFailureFingerprint: Sha256Schema,
    retryDeltaHash: Sha256Schema,
  })
  .strict();

export const ProductCompilationAttemptOutputRefsV1Schema = z
  .object({
    directResponseEvidenceHash: Sha256Schema.optional(),
    renderedSemanticsHash: Sha256Schema.optional(),
    candidateSelectionHash: Sha256Schema.optional(),
    responseBindingsHash: Sha256Schema.optional(),
    designSourceClosureHash: Sha256Schema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A sealed product-compilation output must bind at least one artifact",
      });
    }
  });

export const ProductCompilationAttemptFailureV1Schema = z
  .object({
    failureArtifactHash: Sha256Schema,
    failureFingerprint: Sha256Schema,
    operationalCauseHash: Sha256Schema,
    reasonCodes: z.array(BoundedIdentitySchema).min(1).max(100).refine(hasUniqueStrings, {
      message: "Product-compilation failure reason codes must be unique",
    }),
  })
  .strict();

export const ProductCompilationAttemptV1Schema = z
  .object({
    schema: z.literal("setfarm.product-compilation-attempt.v1"),
    attemptId: ProductCompilationAttemptIdSchema,
    runId: BoundedIdentitySchema,
    originClaimId: z.number().int().positive(),
    ownerClaimId: z.number().int().positive(),
    passKind: ProductCompilationPassKindV1Schema,
    authorityHash: Sha256Schema,
    requestHash: Sha256Schema,
    ordinal: z.union([z.literal(1), z.literal(2)]),
    retryAuthority: ProductCompilationRetryAuthorityV1Schema.nullable(),
    generation: z.number().int().positive(),
    fenceToken: Sha256Schema,
    state: ProductCompilationAttemptStateV1Schema,
    disposition: ProductCompilationAttemptDispositionV1Schema.nullable(),
    lease: z.object({
      ownerInstanceId: BoundedIdentitySchema,
      acquiredAt: TimestampSchema,
      expiresAt: TimestampSchema,
      heartbeatAt: TimestampSchema,
    }).strict().nullable(),
    dispatch: z.object({
      intentCommittedAt: TimestampSchema,
      startedAt: TimestampSchema.nullable(),
      finishedAt: TimestampSchema.nullable(),
      externalOperationId: BoundedIdentitySchema.nullable(),
    }).strict().nullable(),
    outputRefs: ProductCompilationAttemptOutputRefsV1Schema.nullable(),
    outputSealHash: Sha256Schema.nullable(),
    failure: ProductCompilationAttemptFailureV1Schema.nullable(),
    attemptLocator: z.string().min(1).max(1_024),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.ordinal === 1) !== (value.retryAuthority === null)) {
      context.addIssue({
        code: "custom",
        path: ["retryAuthority"],
        message: "Only ordinal two may carry exact retry authority",
      });
    }
    if (value.state === "reserved") {
      if (value.disposition || value.dispatch || value.outputRefs || value.outputSealHash || value.failure) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "Reserved attempts cannot contain dispatch or terminal evidence",
        });
      }
    }
    if (value.state === "dispatching") {
      if (!value.dispatch || value.disposition || value.outputRefs || value.outputSealHash || value.failure) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "Dispatching attempts require committed intent without terminal evidence",
        });
      }
    }
    if (value.state === "sealed") {
      if (!value.disposition || value.disposition === "dispatch_ambiguous" || !value.outputSealHash) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "Sealed attempts require a non-ambiguous disposition and output seal",
        });
      }
      if (value.disposition === "accepted" && (!value.outputRefs || value.failure)) {
        context.addIssue({
          code: "custom",
          path: ["outputRefs"],
          message: "Accepted attempts require output refs and no failure identity",
        });
      }
      if (
        (value.disposition === "rejected" || value.disposition === "infrastructure_failure")
        && (!value.failure || value.outputRefs)
      ) {
        context.addIssue({
          code: "custom",
          path: ["failure"],
          message: "Failed attempts require one exact failure identity and no accepted output projection",
        });
      }
    }
    if (value.state === "quarantined") {
      if (value.disposition !== "dispatch_ambiguous" || !value.dispatch || !value.failure || value.outputRefs) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "Quarantined attempts preserve an ambiguous dispatch and typed failure",
        });
      }
    }
    if ((value.state === "reserved" || value.state === "dispatching") !== (value.lease !== null)) {
      context.addIssue({
        code: "custom",
        path: ["lease"],
        message: "Only active attempts carry a live lease",
      });
    }
    if (value.lease && Date.parse(value.lease.expiresAt) < Date.parse(value.lease.acquiredAt)) {
      context.addIssue({
        code: "custom",
        path: ["lease", "expiresAt"],
        message: "Attempt lease expires before acquisition",
      });
    }
    if (value.dispatch?.startedAt && value.dispatch.startedAt < value.dispatch.intentCommittedAt) {
      context.addIssue({
        code: "custom",
        path: ["dispatch", "startedAt"],
        message: "Dispatch cannot start before its committed intent",
      });
    }
    if (
      value.dispatch?.finishedAt
      && (!value.dispatch.startedAt || value.dispatch.finishedAt < value.dispatch.startedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dispatch", "finishedAt"],
        message: "Dispatch cannot finish before it starts",
      });
    }
  });

export type ProductCompilationAttemptV1 = z.infer<typeof ProductCompilationAttemptV1Schema>;
export type ProductCompilationRetryAuthorityV1 = z.infer<typeof ProductCompilationRetryAuthorityV1Schema>;
export type ProductCompilationAttemptFailureV1 = z.infer<typeof ProductCompilationAttemptFailureV1Schema>;
