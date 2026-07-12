import { z } from "zod";

import {
  ActionIdSchema,
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";

const FixtureProvenanceV1Schema = z
  .object({
    authority: z.enum(["local_git", "github", "postgresql", "audit"]),
    locator: z.string().min(1).max(1_000).refine(
      (value) => !value.startsWith("/") && !value.includes("/Users/") && !value.includes(".openclaw"),
      "Fixture provenance must be host-independent",
    ),
    revision: GitObjectHashSchema.optional(),
    statement: z.string().min(1).max(2_000),
  })
  .strict();

const FixtureSourceV1Schema = z
  .object({
    locator: NormalizedRelativeLocatorSchema.refine((value) => value.startsWith("sources/"), {
      message: "Fixture source locators must be under sources/",
    }),
    sha256: Sha256Schema,
    mediaType: z.string().min(3).max(160).regex(/^[^\s/]+\/[^\s/]+$/),
    redaction: z.enum(["none", "minimal_excerpt", "operational_paths_removed"]),
  })
  .strict();

export const ContractReplayFixtureV1Schema = z
  .object({
    schema: z.literal("setfarm.contract-replay-fixture.v1"),
    caseId: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    productClass: z.enum(["utility", "operations", "game", "content", "service", "other"]),
    provenance: z.array(FixtureProvenanceV1Schema).min(1).max(100),
    sources: z.array(FixtureSourceV1Schema).min(1).max(1_000),
    redaction: z.object({
      containsCredentials: z.literal(false),
      containsPrivateTranscripts: z.literal(false),
      notes: z.string().min(1).max(2_000),
    }).strict(),
    expected: z.object({
      packetStatus: z.enum(["rejected", "sealed"]),
      compilationResult: NormalizedRelativeLocatorSchema.refine(
        (value) => value.startsWith("expected/"),
        "Expected result must be under expected/",
      ),
      attemptResult: NormalizedRelativeLocatorSchema.refine(
        (value) => value.startsWith("expected/"),
        "Expected result must be under expected/",
      ).optional(),
    }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.sources.map((source) => source.locator))) {
      context.addIssue({ code: "custom", path: ["sources"], message: "Fixture source locators must be unique" });
    }
    if (!hasUniqueStrings(value.sources.map((source) => source.sha256))) {
      context.addIssue({ code: "custom", path: ["sources"], message: "Fixture source hashes must be unique" });
    }
  });

export type ContractReplayFixtureV1 = z.infer<typeof ContractReplayFixtureV1Schema>;

const ExpectedExactBindingV1Schema = z
  .object({
    actionRef: ActionIdSchema,
    generatedLocalId: z.string().min(1).max(500),
    provenance: z.enum(["structured_index", "same_element", "exact_manifest"]),
  })
  .strict();

const DiagnosticCodeSchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/).max(160);

export const ExpectedCompilationResultV1Schema = z
  .object({
    schema: z.literal("setfarm.expected-compilation-result.v1"),
    status: z.enum(["rejected", "sealed"]),
    diagnosticCodes: z.array(DiagnosticCodeSchema).max(10_000).refine(hasUniqueStrings, {
      message: "Expected diagnostic codes must be unique",
    }),
    exactBindings: z.array(ExpectedExactBindingV1Schema).max(10_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "rejected" && value.diagnosticCodes.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["diagnosticCodes"],
        message: "Rejected fixture results require at least one diagnostic",
      });
    }
  });

export type ExpectedCompilationResultV1 = z.infer<typeof ExpectedCompilationResultV1Schema>;

export const ExpectedAttemptResultV1Schema = z
  .object({
    schema: z.literal("setfarm.expected-attempt-result.v1"),
    disposition: z.enum([
      "duplicate",
      "source_revision_changed",
      "active_conflict",
      "reserved",
      "not_applicable",
    ]),
    dedupeEligible: z.boolean(),
    diagnosticCodes: z.array(DiagnosticCodeSchema).max(1_000).refine(hasUniqueStrings, {
      message: "Expected attempt diagnostic codes must be unique",
    }),
  })
  .strict();

export type ExpectedAttemptResultV1 = z.infer<typeof ExpectedAttemptResultV1Schema>;
