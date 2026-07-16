import { z } from "zod";

import {
  CompilerIdentityV1Schema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { CompilationDiagnosticV1Schema } from "./compilation-report-v1.js";

const ArtifactHashesV2Schema = z
  .object({
    productSpec: Sha256Schema.optional(),
    designGraph: Sha256Schema.optional(),
    buildTopology: Sha256Schema.optional(),
    storyPlan: Sha256Schema.optional(),
    designSourceClosure: Sha256Schema.optional(),
  })
  .strict();

const SealedArtifactHashesV2Schema = z
  .object({
    productSpec: Sha256Schema,
    designGraph: Sha256Schema,
    buildTopology: Sha256Schema,
    storyPlan: Sha256Schema,
    designSourceClosure: Sha256Schema,
  })
  .strict();

const ReportCommonShape = {
  schema: z.literal("setfarm.product-compilation-report.v2"),
  compiler: CompilerIdentityV1Schema,
  inputHashes: z.array(Sha256Schema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Input hashes must be unique",
  }),
  diagnostics: z.array(CompilationDiagnosticV1Schema).max(10_000),
  validationIds: z.array(StableReferenceSchema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Validation IDs must be unique",
  }),
};

const RejectedProductCompilationReportV2Schema = z
  .object({
    ...ReportCommonShape,
    status: z.literal("rejected"),
    artifactHashes: ArtifactHashesV2Schema,
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

const SealedProductCompilationReportV2Schema = z
  .object({
    ...ReportCommonShape,
    status: z.literal("sealed"),
    artifactHashes: SealedArtifactHashesV2Schema,
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

export const ProductCompilationReportV2Schema = z.union([
  RejectedProductCompilationReportV2Schema,
  SealedProductCompilationReportV2Schema,
]);

export type ProductCompilationReportV2 = z.infer<typeof ProductCompilationReportV2Schema>;
