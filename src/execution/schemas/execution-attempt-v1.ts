import { z } from "zod";

import {
  GitObjectHashSchema,
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const OptionalBoundedIdentitySchema = BoundedIdentitySchema.optional();
const TimestampSchema = z.string().datetime({ offset: true });

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
    runId: BoundedIdentitySchema,
    stepId: BoundedIdentitySchema,
    storyId: z.string().max(500),
    attemptClass: AttemptClassV1Schema,
    packetHash: Sha256Schema.optional(),
    compilationReportHash: Sha256Schema,
    sliceHash: Sha256Schema.optional(),
    sourceBefore: SourceRevisionV1Schema,
    findingSetHash: Sha256Schema.optional(),
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
  });

export const ExecutionAttemptV1Schema = z
  .object({
    schema: z.literal("setfarm.execution-attempt.v1"),
    attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
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
