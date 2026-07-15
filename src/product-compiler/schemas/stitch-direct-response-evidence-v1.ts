import { z } from "zod";

import { hasUniqueStrings } from "./common-v1.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";

export const StitchDirectScreenEvidenceV1Schema = z
  .object({
    screenId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
    responsePaths: z.array(z.string().min(1).max(2_000)).min(1).max(100).refine(hasUniqueStrings, {
      message: "Direct response paths must be unique",
    }),
    screenType: z.string().min(1).max(160).optional(),
    displayMode: z.string().min(1).max(160).optional(),
    width: z.string().min(1).max(100).optional(),
    height: z.string().min(1).max(100).optional(),
    htmlAvailable: z.boolean(),
    screenshotAvailable: z.boolean(),
    disposition: z.enum([
      "admitted_renderable_screen",
      "excluded_missing_render_evidence",
    ]),
    missingEvidence: z.array(z.enum(["html", "screenshot"])).max(2).refine(hasUniqueStrings, {
      message: "Missing render evidence fields must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedMissing = [
      ...(!value.htmlAvailable ? ["html" as const] : []),
      ...(!value.screenshotAvailable ? ["screenshot" as const] : []),
    ];
    if (JSON.stringify(value.missingEvidence) !== JSON.stringify(expectedMissing)) {
      context.addIssue({
        code: "custom",
        path: ["missingEvidence"],
        message: "Missing render evidence must exactly describe HTML/screenshot availability",
      });
    }
    const expectedDisposition = expectedMissing.length === 0
      ? "admitted_renderable_screen"
      : "excluded_missing_render_evidence";
    if (value.disposition !== expectedDisposition) {
      context.addIssue({
        code: "custom",
        path: ["disposition"],
        message: "Direct screen disposition must be derived from render evidence",
      });
    }
  });

export const StitchDirectBatchEvidenceV1Schema = z
  .object({
    stageId: z.string().min(1).max(160),
    targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Direct evidence target refs must be unique",
    }),
    source: z.literal("direct"),
    candidates: z.array(StitchDirectScreenEvidenceV1Schema).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.candidates.map((candidate) => candidate.screenId))) {
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "Direct response candidate screen IDs must be unique within a batch",
      });
    }
  });

export const StitchDirectResponseEvidenceV1Schema = z
  .object({
    schema: z.literal("setfarm.stitch-direct-response-evidence.v1"),
    projectId: z.string().min(1).max(500),
    batches: z.array(StitchDirectBatchEvidenceV1Schema).min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.batches.map((batch) => batch.stageId))) {
      context.addIssue({
        code: "custom",
        path: ["batches"],
        message: "Direct response evidence stage IDs must be unique",
      });
    }
    const screenIds = value.batches.flatMap((batch) => batch.candidates.map((candidate) => candidate.screenId));
    if (!hasUniqueStrings(screenIds)) {
      context.addIssue({
        code: "custom",
        path: ["batches"],
        message: "Direct response candidate screen IDs must be unique across batches",
      });
    }
  });

export type StitchDirectScreenEvidenceV1 = z.infer<typeof StitchDirectScreenEvidenceV1Schema>;
export type StitchDirectBatchEvidenceV1 = z.infer<typeof StitchDirectBatchEvidenceV1Schema>;
export type StitchDirectResponseEvidenceV1 = z.infer<typeof StitchDirectResponseEvidenceV1Schema>;
