import { z } from "zod";

import {
  CompilerIdentityV1Schema,
  ProvenanceConfidenceSchema,
  ProvenanceRefV1Schema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const CompilationDiagnosticCategorySchema = z.enum([
  "source",
  "contract",
  "link",
  "execution_identity",
  "adapter",
  "artifact",
  "configuration",
]);

export const CompilationDiagnosticSeveritySchema = z.enum([
  "error",
  "warning",
  "info",
]);

export const CompilationSuggestionV1Schema = z
  .object({
    reference: z.string().min(1).max(160),
    reason: z.string().min(1).max(500),
    confidence: ProvenanceConfidenceSchema,
  })
  .strict();

export const CompilationDiagnosticV1Schema = z
  .object({
    schema: z.literal("setfarm.compilation-diagnostic.v1"),
    code: z.string().regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/).max(160),
    category: CompilationDiagnosticCategorySchema,
    severity: CompilationDiagnosticSeveritySchema,
    message: z.string().min(1).max(2_000),
    artifactHash: Sha256Schema.optional(),
    reference: z.string().min(1).max(160).optional(),
    provenance: z.array(ProvenanceRefV1Schema).max(100),
    suggestions: z.array(CompilationSuggestionV1Schema).max(100),
  })
  .strict();

export type CompilationDiagnosticV1 = z.infer<typeof CompilationDiagnosticV1Schema>;

const ArtifactHashesV1Schema = z
  .object({
    sourceSnapshot: Sha256Schema.optional(),
    productSpec: Sha256Schema.optional(),
    designGraph: Sha256Schema.optional(),
    buildTopology: Sha256Schema.optional(),
    storyPlan: Sha256Schema.optional(),
    implementationSlice: Sha256Schema.optional(),
  })
  .strict();

const SealedArtifactHashesV1Schema = ArtifactHashesV1Schema.extend({
  productSpec: Sha256Schema,
  designGraph: Sha256Schema,
  buildTopology: Sha256Schema,
  storyPlan: Sha256Schema,
}).strict();

const ReportCommonShape = {
  schema: z.literal("setfarm.product-compilation-report.v1"),
  compiler: CompilerIdentityV1Schema,
  inputHashes: z.array(Sha256Schema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Input hashes must be unique",
  }),
  diagnostics: z.array(CompilationDiagnosticV1Schema).max(10_000),
  validationIds: z.array(StableReferenceSchema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Validation IDs must be unique",
  }),
};

const RejectedProductCompilationReportV1Schema = z
  .object({
    ...ReportCommonShape,
    status: z.literal("rejected"),
    artifactHashes: ArtifactHashesV1Schema,
    rejectionCodes: z.array(
      z.string().regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/).max(160),
    ).min(1).max(10_000).refine(hasUniqueStrings, {
      message: "Rejection codes must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.diagnostics.some((item) => item.severity === "error")) {
      context.addIssue({
        code: "custom",
        path: ["diagnostics"],
        message: "A rejected report requires at least one error diagnostic",
      });
    }
    const diagnosticCodes = new Set(
      value.diagnostics.filter((item) => item.severity === "error").map((item) => item.code),
    );
    value.rejectionCodes.forEach((code, index) => {
      if (!diagnosticCodes.has(code)) {
        context.addIssue({
          code: "custom",
          path: ["rejectionCodes", index],
          message: "Each rejection code must name an error diagnostic",
        });
      }
    });
  });

const SealedProductCompilationReportV1Schema = z
  .object({
    ...ReportCommonShape,
    status: z.literal("sealed"),
    artifactHashes: SealedArtifactHashesV1Schema,
    packetHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    value.diagnostics.forEach((diagnostic, index) => {
      if (diagnostic.severity === "error") {
        context.addIssue({
          code: "custom",
          path: ["diagnostics", index],
          message: "A sealed report cannot contain error diagnostics",
        });
      }
    });
  });

export const ProductCompilationReportV1Schema = z.union([
  RejectedProductCompilationReportV1Schema,
  SealedProductCompilationReportV1Schema,
]);

export type ProductCompilationReportV1 = z.infer<typeof ProductCompilationReportV1Schema>;
