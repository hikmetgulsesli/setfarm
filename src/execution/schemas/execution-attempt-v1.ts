import { z } from "zod";

import {
  GitObjectHashSchema,
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const OptionalBoundedIdentitySchema = BoundedIdentitySchema.optional();
const TimestampSchema = z.string().datetime({ offset: true });
const RecoveryCaseRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);

export const AttemptClassV1Schema = z.enum([
  "product_implementation",
  "evidence_only",
  "infrastructure_retry",
  "supervisor_repair",
]);

export const AttemptDispositionV1Schema = z.enum([
  "claimed",
  "running",
  "produced_delta",
  "already_satisfied",
  "no_progress",
  "inconclusive",
  "failed",
  "verified",
  "superseded",
]);

export const TerminalAttemptDispositionV1Schema = z.enum([
  "produced_delta",
  "already_satisfied",
  "no_progress",
  "inconclusive",
  "failed",
  "verified",
]);

export const SourceRevisionV1Schema = z
  .object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  })
  .strict();

export const ExecutionAttemptReservationV1Schema = z
  .object({
    claimId: z.number().int().positive().optional(),
    runId: BoundedIdentitySchema,
    stepId: BoundedIdentitySchema,
    storyId: z.string().max(500),
    attemptClass: AttemptClassV1Schema,
    packetHash: Sha256Schema.optional(),
    compilationReportHash: Sha256Schema,
    sliceHash: Sha256Schema.optional(),
    sourceBefore: SourceRevisionV1Schema,
    findingSetHash: Sha256Schema.optional(),
    recoveryCaseRevisionId: RecoveryCaseRevisionIdSchema.optional(),
    recoveryDispatchId: RecoveryDispatchIdSchema.optional(),
    recoveryDeliveryLease: z.object({
      ownerInstanceId: BoundedIdentitySchema,
      leaseToken: z.string().min(16).max(500),
    }).strict().optional(),
    role: BoundedIdentitySchema,
    agentId: OptionalBoundedIdentitySchema,
    branch: z.string().min(1).max(1_000).optional(),
    worktree: z.string().min(1).max(4_000).optional(),
    evidenceRefs: z.array(BoundedIdentitySchema).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sliceHash && !value.packetHash) {
      context.addIssue({
        code: "custom",
        path: ["sliceHash"],
        message: "A slice hash requires a sealed packet hash",
      });
    }
    const recoveryFields = [
      value.recoveryCaseRevisionId,
      value.recoveryDispatchId,
      value.recoveryDeliveryLease,
    ].filter((item) => item !== undefined).length;
    if (recoveryFields !== 0 && recoveryFields !== 3) {
      context.addIssue({
        code: "custom",
        path: ["recoveryDispatchId"],
        message: "Recovery attempt requires exact revision, dispatch, and delivery lease identity",
      });
    }
    if (recoveryFields === 3 && (!value.packetHash || !value.sliceHash || !value.findingSetHash)) {
      context.addIssue({
        code: "custom",
        path: ["recoveryDispatchId"],
        message: "Recovery attempt requires packet, slice, and finding-set fences",
      });
    }
    const claimRefs = value.evidenceRefs.filter((ref) => /^setfarm:\/\/claim-log\/[1-9][0-9]*$/.test(ref));
    if (value.claimId !== undefined && (claimRefs.length !== 1 || claimRefs[0] !== `setfarm://claim-log/${value.claimId}`)) {
      context.addIssue({
        code: "custom",
        path: ["evidenceRefs"],
        message: "Claim identity requires one matching canonical claim evidence ref",
      });
    }
  });

export const ExecutionAttemptV1Schema = z
  .object({
    schema: z.literal("setfarm.execution-attempt.v1"),
    attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
    claimId: z.number().int().positive().optional(),
    runId: BoundedIdentitySchema,
    stepId: BoundedIdentitySchema,
    storyId: z.string().max(500),
    generation: z.number().int().positive(),
    fenceToken: Sha256Schema,
    attemptClass: AttemptClassV1Schema,
    packetHash: Sha256Schema.optional(),
    compilationReportHash: Sha256Schema,
    sliceHash: Sha256Schema.optional(),
    sourceBefore: SourceRevisionV1Schema,
    sourceAfter: SourceRevisionV1Schema.optional(),
    findingSetHash: Sha256Schema.optional(),
    recoveryCaseRevisionId: RecoveryCaseRevisionIdSchema.optional(),
    recoveryDispatchId: RecoveryDispatchIdSchema.optional(),
    dedupeKey: Sha256Schema.optional(),
    role: BoundedIdentitySchema,
    agentId: OptionalBoundedIdentitySchema,
    branch: z.string().min(1).max(1_000).optional(),
    worktree: z.string().min(1).max(4_000).optional(),
    lease: z.object({
      acquiredAt: TimestampSchema,
      expiresAt: TimestampSchema,
      heartbeatAt: TimestampSchema,
    }).strict(),
    disposition: AttemptDispositionV1Schema,
    outputHash: Sha256Schema.optional(),
    evidenceRefs: z.array(BoundedIdentitySchema).max(1_000),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sliceHash && !value.packetHash) {
      context.addIssue({ code: "custom", path: ["sliceHash"], message: "A slice requires a packet" });
    }
    if (Boolean(value.recoveryCaseRevisionId) !== Boolean(value.recoveryDispatchId)) {
      context.addIssue({
        code: "custom",
        path: ["recoveryDispatchId"],
        message: "Recovery attempt revision and dispatch identities must be paired",
      });
    }
    if (value.recoveryDispatchId && (!value.packetHash || !value.sliceHash || !value.findingSetHash)) {
      context.addIssue({
        code: "custom",
        path: ["recoveryDispatchId"],
        message: "Recovery attempt requires packet, slice, and finding-set fences",
      });
    }
    const requiresDedupe = value.attemptClass === "product_implementation"
      && Boolean(value.packetHash)
      && Boolean(value.findingSetHash);
    if (Boolean(value.dedupeKey) !== requiresDedupe) {
      context.addIssue({
        code: "custom",
        path: ["dedupeKey"],
        message: "Dedupe identity must exactly match an exact product packet and typed finding",
      });
    }
    if (Date.parse(value.lease.expiresAt) < Date.parse(value.lease.acquiredAt)) {
      context.addIssue({ code: "custom", path: ["lease", "expiresAt"], message: "Lease expires before acquisition" });
    }
  });

export type AttemptClassV1 = z.infer<typeof AttemptClassV1Schema>;
export type AttemptDispositionV1 = z.infer<typeof AttemptDispositionV1Schema>;
export type TerminalAttemptDispositionV1 = z.infer<typeof TerminalAttemptDispositionV1Schema>;
export type SourceRevisionV1 = z.infer<typeof SourceRevisionV1Schema>;
export type ExecutionAttemptReservationV1 = z.infer<typeof ExecutionAttemptReservationV1Schema>;
export type ExecutionAttemptV1 = z.infer<typeof ExecutionAttemptV1Schema>;
