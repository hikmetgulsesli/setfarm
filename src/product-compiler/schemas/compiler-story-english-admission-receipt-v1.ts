import { z } from "zod";

import { Sha256Schema } from "./common-v1.js";

export const CompilerStoryEnglishAdmissionReceiptV1Schema = z.object({
  schema: z.literal("setfarm.compiler-story-english-admission-receipt.v1"),
  authorityVersion: z.literal("compiler_story_english_surface_v1"),
  admissionScope: z.literal("compiler_owned_story_publication_surface"),
  productionAuthority: z.literal(false),
  claimId: z.number().int().positive(),
  runId: z.string().min(1).max(500),
  stepDbId: z.string().min(1).max(500),
  workflowStepId: z.literal("stories"),
  parentPlanReceiptHash: Sha256Schema,
  sourceTaskHash: Sha256Schema,
  productSpecHash: Sha256Schema,
  setupIdentityHash: Sha256Schema,
  designAuthoritySubjectHash: Sha256Schema,
  admissionContextHash: Sha256Schema,
  canonicalProjectionHash: Sha256Schema,
  orderedStoryRowsHash: Sha256Schema,
  screenMapHash: Sha256Schema,
  storyCount: z.number().int().positive().max(100),
  subjectHash: Sha256Schema,
}).strict();

export type CompilerStoryEnglishAdmissionReceiptV1 = z.infer<
  typeof CompilerStoryEnglishAdmissionReceiptV1Schema
>;
