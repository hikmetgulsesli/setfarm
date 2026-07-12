import { z } from "zod";

import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  SourceRevisionV1Schema,
  TerminalAttemptDispositionV1Schema,
} from "./execution-attempt-v1.js";

export const AttemptStructuredOutputV1Schema = z
  .object({
    kind: z.enum(["file_change", "command", "evidence", "finding"]),
    reference: z.string().min(1).max(500),
    status: z.enum(["changed", "unchanged", "passed", "failed", "observed"]),
    contentHash: Sha256Schema.optional(),
    summary: z.string().min(1).max(2_000).optional(),
  })
  .strict();

export const AttemptOutputEnvelopeV1Schema = z
  .object({
    schema: z.literal("setfarm.attempt-output-envelope.v1"),
    attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
    generation: z.number().int().positive(),
    fenceToken: Sha256Schema,
    packetHash: Sha256Schema.optional(),
    sliceHash: Sha256Schema.optional(),
    sourceBefore: SourceRevisionV1Schema,
    sourceAfter: SourceRevisionV1Schema.optional(),
    disposition: TerminalAttemptDispositionV1Schema,
    outputs: z.array(AttemptStructuredOutputV1Schema).max(1_000),
    evidenceRefs: z.array(z.string().min(1).max(500)).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sliceHash && !value.packetHash) {
      context.addIssue({ code: "custom", path: ["sliceHash"], message: "A slice requires a packet" });
    }
    if (value.disposition === "produced_delta" && !value.sourceAfter) {
      context.addIssue({
        code: "custom",
        path: ["sourceAfter"],
        message: "A produced delta requires the observed source-after revision",
      });
    }
  });

export type AttemptOutputEnvelopeV1 = z.infer<typeof AttemptOutputEnvelopeV1Schema>;
