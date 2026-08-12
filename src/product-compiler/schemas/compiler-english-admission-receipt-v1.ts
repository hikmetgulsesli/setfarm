import { z } from "zod";

import { Sha256Schema } from "./common-v1.js";

export const CompilerEnglishAdmissionReceiptV1Schema = z.object({
  schema: z.literal("setfarm.compiler-english-admission-receipt.v1"),
  authorityVersion: z.literal("compiler_english_surface_v1"),
  admissionScope: z.literal("compiler_owned_english_publication_surface"),
  productionAuthority: z.literal(false),
  claimId: z.number().int().positive(),
  runId: z.string().min(1).max(500),
  stepDbId: z.string().min(1).max(500),
  workflowStepId: z.literal("plan"),
  productSpecSchema: z.enum([
    "setfarm.product-spec.v1",
    "setfarm.product-spec.v2",
  ]),
  sourceTaskHash: Sha256Schema,
  productSpecHash: Sha256Schema,
  prdHash: Sha256Schema,
  setupIdentityHash: Sha256Schema,
  subjectHash: Sha256Schema,
}).strict();

export type CompilerEnglishAdmissionReceiptV1 = z.infer<
  typeof CompilerEnglishAdmissionReceiptV1Schema
>;
