import { z } from "zod";

import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";

export const ClaimAttemptFenceV1Schema = z.object({
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  generation: z.number().int().positive(),
  fenceToken: Sha256Schema,
}).strict();

/**
 * Immutable capability handed from the claim owner to the worker runtime.
 *
 * `stepId` is the database step UUID retained for CLI compatibility while
 * `workflowStepId` is the stable workflow name (for example `implement`).
 * Compiler story claims must carry the exact legacy claim row and attempt
 * fence; a shared `steps.current_story_id` pointer is never sufficient proof
 * of completion ownership.
 */
export const ClaimEnvelopeV1Schema = z.object({
  schema: z.literal("setfarm.claim-envelope.v1"),
  protocol: z.enum(["legacy", "shadow", "v3"]),
  issuedAt: z.string().datetime({ offset: true }),
  stepId: z.string().min(1).max(500),
  // Claim envelopes are a legacy/shadow/v3 compatibility ABI. Workflow
  // installation currently accepts any non-empty trimmed step ID, so this
  // transport must not silently tighten that pre-existing contract.
  workflowStepId: z.string().min(1).max(500),
  runId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500).optional(),
  storyDbId: z.string().min(1).max(500).optional(),
  claimId: z.number().int().positive(),
  claimAgentId: z.string().min(1).max(500),
  runtimeAgentId: z.string().min(1).max(500),
  claimGeneration: z.number().int().nonnegative().optional(),
  attempt: ClaimAttemptFenceV1Schema.optional(),
  workdir: z.string().min(1).max(4_000).optional(),
  repo: z.string().min(1).max(4_000).optional(),
  input: z.unknown().optional(),
}).strict().superRefine((value, context) => {
  const storyFields = [value.storyId, value.storyDbId];
  if (storyFields.some(Boolean) && !storyFields.every(Boolean)) {
    context.addIssue({
      code: "custom",
      path: ["storyId"],
      message: "Story identity must include both storyId and storyDbId",
    });
  }
  if (value.protocol !== "legacy" && value.storyId && !value.attempt) {
    context.addIssue({
      code: "custom",
      path: ["attempt"],
      message: "Compiler story claims require an attempt fence",
    });
  }
  if (value.attempt && !value.storyId) {
    context.addIssue({
      code: "custom",
      path: ["attempt"],
      message: "Attempt fences are only valid for story claims",
    });
  }
});

export type ClaimAttemptFenceV1 = z.infer<typeof ClaimAttemptFenceV1Schema>;
export type ClaimEnvelopeV1 = z.infer<typeof ClaimEnvelopeV1Schema>;
