import { z } from "zod";

import { GitObjectHashSchema, Sha256Schema } from "../../product-compiler/schemas/common-v1.js";

const OpaqueIdentitySchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const FailureCodeSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/);

/**
 * Bounded, non-prose deploy-refusal evidence that is safe to project into
 * Mission Control. Host paths, URLs, raw exceptions, credentials, and command
 * output have no field in this schema; callers retain only typed identities or
 * SHA-256 digests of unavailable private detail.
 */
export const V3DeployAuthorityEvidenceV1Schema = z.object({
  runId: OpaqueIdentitySchema.optional(),
  receiptHash: Sha256Schema.nullable().optional(),
  acceptedCandidateHash: Sha256Schema.nullable().optional(),
  candidateHash: Sha256Schema.optional(),
  expectedSha: GitObjectHashSchema.optional(),
  expectedTreeHash: GitObjectHashSchema.optional(),
  observedSha: GitObjectHashSchema.optional(),
  observedTreeHash: GitObjectHashSchema.optional(),
  stackPackId: OpaqueIdentitySchema.optional(),
  commandKind: z.enum(["build", "preview"]).optional(),
  environmentName: z.string().regex(/^[A-Z_][A-Z0-9_]*$/).max(160).optional(),
  protocol: OpaqueIdentitySchema.optional(),
  stagedReceiptHash: Sha256Schema.optional(),
  freshReceiptHash: Sha256Schema.optional(),
  candidatePacketHash: Sha256Schema.optional(),
  sealedPacketHash: Sha256Schema.optional(),
  projectId: OpaqueIdentitySchema.optional(),
  primaryFailureCode: FailureCodeSchema.optional(),
  primaryFailureHash: Sha256Schema.optional(),
  targetMode: z.literal("remote").optional(),
  remoteHostHash: Sha256Schema.optional(),
  cwdHash: Sha256Schema.optional(),
  lastHttpStatus: z.string().regex(/^(?:0|[1-5][0-9]{2})$/).optional(),
}).strict().superRefine((value, context) => {
  if ((value.primaryFailureCode === undefined) !== (value.primaryFailureHash === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["primaryFailureHash"],
      message: "Primary failure code and digest must be jointly present",
    });
  }
  if ((value.targetMode === undefined) !== (value.remoteHostHash === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["remoteHostHash"],
      message: "Remote target mode and host digest must be jointly present",
    });
  }
});

export type V3DeployAuthorityEvidenceV1 = z.infer<typeof V3DeployAuthorityEvidenceV1Schema>;
