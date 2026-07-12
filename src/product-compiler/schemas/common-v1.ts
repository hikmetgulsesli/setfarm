import { z } from "zod";

export const Sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 digest");

export const GitCodeShaSchema = z
  .string()
  .regex(/^[a-f0-9]{7,64}$/, "Expected a lowercase Git code revision");

export const StableReferenceSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "Expected a stable uppercase reference");

export const NormalizedRelativeLocatorSchema = z
  .string()
  .min(1)
  .max(1024)
  .superRefine((value, context) => {
    const segments = value.split("/");
    const invalid =
      value.includes("\0")
      || value.includes("\\")
      || value.startsWith("/")
      || /^[A-Za-z]:\//.test(value)
      || value.startsWith("./")
      || value.endsWith("/")
      || segments.some((segment) => segment === "" || segment === "." || segment === "..");
    if (invalid) {
      context.addIssue({
        code: "custom",
        message: "Expected a normalized relative locator without traversal",
      });
    }
  });

export const ProvenanceConfidenceSchema = z.enum([
  "exact",
  "derived_with_provenance",
  "ambiguous",
  "missing",
  "heuristic_legacy_only",
]);

export const SourceRangeV1Schema = z
  .object({
    startLine: z.number().int().positive(),
    startColumn: z.number().int().nonnegative().optional(),
    endLine: z.number().int().positive(),
    endColumn: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endLine < value.startLine) {
      context.addIssue({
        code: "custom",
        path: ["endLine"],
        message: "Source range must not end before it starts",
      });
    }
    if (
      value.endLine === value.startLine
      && value.startColumn !== undefined
      && value.endColumn !== undefined
      && value.endColumn < value.startColumn
    ) {
      context.addIssue({
        code: "custom",
        path: ["endColumn"],
        message: "Source range must not end before it starts",
      });
    }
  });

export const ProvenanceRefV1Schema = z
  .object({
    schema: z.literal("setfarm.provenance-ref.v1"),
    sourceHash: Sha256Schema,
    locator: NormalizedRelativeLocatorSchema,
    confidence: ProvenanceConfidenceSchema,
    jsonPointer: z.string().max(1024).refine(
      (value) => value === "" || value.startsWith("/"),
      "Expected an RFC 6901-style JSON pointer",
    ).optional(),
    range: SourceRangeV1Schema.optional(),
    note: z.string().min(1).max(500).optional(),
  })
  .strict();

export type ProvenanceRefV1 = z.infer<typeof ProvenanceRefV1Schema>;

export const SourceArtifactRefV1Schema = z
  .object({
    schema: z.literal("setfarm.source-artifact-ref.v1"),
    hash: Sha256Schema,
    mediaType: z.string().min(3).max(160).regex(/^[^\s/]+\/[^\s/]+$/),
    locator: NormalizedRelativeLocatorSchema,
    byteLength: z.number().int().nonnegative(),
  })
  .strict();

export type SourceArtifactRefV1 = z.infer<typeof SourceArtifactRefV1Schema>;

export const SemanticArtifactProducerV1Schema = z
  .object({
    pass: z.string().min(1).max(160),
    codeSha: GitCodeShaSchema,
    model: z.string().min(1).max(200).optional(),
    promptHash: Sha256Schema.optional(),
    toolVersions: z.record(z.string().min(1).max(100), z.string().min(1).max(200)),
  })
  .strict();

export type SemanticArtifactProducerV1 = z.infer<typeof SemanticArtifactProducerV1Schema>;

export const CompilerIdentityV1Schema = z
  .object({
    version: z.string().min(1).max(100),
    codeSha: GitCodeShaSchema,
  })
  .strict();

export type CompilerIdentityV1 = z.infer<typeof CompilerIdentityV1Schema>;

export function hasUniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}
