import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  EvidenceIdSchema,
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  SourceRangeV1Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const FindingIdSchema = z.string().regex(/^FIND_[a-f0-9]{64}$/);
const FindingSetIdSchema = z.string().regex(/^FSET_[a-f0-9]{64}$/);
const InvariantRefSchema = z
  .string()
  .min(5)
  .max(200)
  .regex(/^INV_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

export const FindingOriginV1Schema = z.enum([
  "compiler",
  "build",
  "test",
  "runtime",
  "review",
  "security",
  "qa",
]);

export const FindingSourceLocatorV1Schema = z
  .object({
    path: NormalizedRelativeLocatorSchema,
    contentHash: Sha256Schema,
    range: SourceRangeV1Schema.optional(),
    symbol: z.string().min(1).max(500).optional(),
  })
  .strict();

const GithubFindingRefV1Schema = z
  .object({
    platform: z.literal("github"),
    repositoryNodeId: z.string().min(1).max(500),
    prNumber: z.number().int().positive(),
    threadId: z.string().min(1).max(500),
    commentId: z.string().min(1).max(500).optional(),
    headSha: GitObjectHashSchema,
    commentRevisionHash: Sha256Schema,
  })
  .strict();

const FindingCoreV1Schema = z
  .object({
    findingId: FindingIdSchema,
    origin: FindingOriginV1Schema,
    classification: z.enum(["structured", "unstructured_review"]),
    externalRef: GithubFindingRefV1Schema.optional(),
    invariantRef: InvariantRefSchema,
    sourceLocators: z.array(FindingSourceLocatorV1Schema).min(1).max(1_000),
    observedEvidenceRefs: z.array(Sha256Schema).min(1).max(1_000),
    expectedPredicateRef: EvidenceIdSchema.optional(),
    status: z.enum(["open", "satisfied", "invalid", "superseded"]),
    resolutionEvidenceRefs: z.array(Sha256Schema).min(1).max(1_000).optional(),
  })
  .strict();

export type FindingV1 = z.infer<typeof FindingCoreV1Schema>;
export type FindingDraftV1 = Omit<FindingV1, "findingId">;

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function locatorKey(locator: z.infer<typeof FindingSourceLocatorV1Schema>): string {
  return hashCanonicalJson(locator);
}

function canonicalFindingDraft(input: FindingDraftV1): FindingDraftV1 {
  return {
    ...input,
    sourceLocators: [...input.sourceLocators].sort((left, right) =>
      lexical(locatorKey(left), locatorKey(right))),
    observedEvidenceRefs: [...new Set(input.observedEvidenceRefs)].sort(lexical),
    ...(input.resolutionEvidenceRefs
      ? { resolutionEvidenceRefs: [...new Set(input.resolutionEvidenceRefs)].sort(lexical) }
      : {}),
  };
}

export function computeFindingId(input: FindingDraftV1): string {
  const canonical = canonicalFindingDraft(input);
  return `FIND_${hashCanonicalJson({
    schema: "setfarm.finding-identity.v1",
    origin: canonical.origin,
    classification: canonical.classification,
    ...(canonical.externalRef
      ? {
          externalIdentity: {
            platform: canonical.externalRef.platform,
            repositoryNodeId: canonical.externalRef.repositoryNodeId,
            prNumber: canonical.externalRef.prNumber,
            threadId: canonical.externalRef.threadId,
          },
        }
      : {}),
    invariantRef: canonical.invariantRef,
    sourceLocators: canonical.sourceLocators,
    ...(canonical.expectedPredicateRef
      ? { expectedPredicateRef: canonical.expectedPredicateRef }
      : {}),
  })}`;
}

export const FindingV1Schema = FindingCoreV1Schema.superRefine((value, context) => {
  if (value.findingId !== computeFindingId(value)) {
    context.addIssue({
      code: "custom",
      path: ["findingId"],
      message: "Finding ID must be derived from exact invariant and source identity",
    });
  }
  if (!hasUniqueStrings(value.sourceLocators.map(locatorKey))) {
    context.addIssue({ code: "custom", path: ["sourceLocators"], message: "Source locators must be unique" });
  }
  const sortedLocatorKeys = value.sourceLocators.map(locatorKey).sort(lexical);
  if (value.sourceLocators.some((locator, index) => locatorKey(locator) !== sortedLocatorKeys[index])) {
    context.addIssue({
      code: "custom",
      path: ["sourceLocators"],
      message: "Source locators must use canonical content order",
    });
  }
  if (!hasUniqueStrings(value.observedEvidenceRefs)) {
    context.addIssue({
      code: "custom",
      path: ["observedEvidenceRefs"],
      message: "Observed evidence refs must be unique",
    });
  }
  if (value.observedEvidenceRefs.some((reference, index) =>
    reference !== [...value.observedEvidenceRefs].sort(lexical)[index])) {
    context.addIssue({
      code: "custom",
      path: ["observedEvidenceRefs"],
      message: "Observed evidence refs must use canonical order",
    });
  }
  if (value.resolutionEvidenceRefs) {
    const canonicalResolution = [...new Set(value.resolutionEvidenceRefs)].sort(lexical);
    if (
      value.resolutionEvidenceRefs.length !== canonicalResolution.length
      || value.resolutionEvidenceRefs.some((reference, index) => reference !== canonicalResolution[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["resolutionEvidenceRefs"],
        message: "Resolution evidence refs must be unique and canonically sorted",
      });
    }
  }
  if (value.externalRef && value.origin !== "review") {
    context.addIssue({
      code: "custom",
      path: ["externalRef"],
      message: "GitHub external refs are valid only for review findings",
    });
  }
  if (value.classification === "structured" && !value.expectedPredicateRef) {
    context.addIssue({
      code: "custom",
      path: ["expectedPredicateRef"],
      message: "Structured findings require a typed evidence predicate",
    });
  }
  if (value.classification === "unstructured_review") {
    if (value.origin !== "review" || !value.externalRef) {
      context.addIssue({
        code: "custom",
        path: ["classification"],
        message: "Unstructured findings are exact GitHub review inputs",
      });
    }
    if (value.expectedPredicateRef) {
      context.addIssue({
        code: "custom",
        path: ["expectedPredicateRef"],
        message: "Unstructured review prose cannot invent an evidence predicate",
      });
    }
    if (value.invariantRef !== "INV_UNSTRUCTURED_REVIEW") {
      context.addIssue({
        code: "custom",
        path: ["invariantRef"],
        message: "Unstructured review input cannot invent a specific invariant",
      });
    }
  }
  if (value.status === "satisfied" && !value.resolutionEvidenceRefs?.length) {
    context.addIssue({
      code: "custom",
      path: ["resolutionEvidenceRefs"],
      message: "Satisfied findings require exact resolution evidence",
    });
  }
  if (value.status === "open" && value.resolutionEvidenceRefs) {
    context.addIssue({
      code: "custom",
      path: ["resolutionEvidenceRefs"],
      message: "Open findings cannot claim resolution evidence",
    });
  }
});

const FindingSetCoreV1Schema = z
  .object({
    schema: z.literal("setfarm.finding-set.v1"),
    findingSetId: FindingSetIdSchema,
    findingSetHash: Sha256Schema,
    runId: BoundedIdentitySchema,
    storyId: StoryIdSchema,
    packetHash: Sha256Schema,
    sliceHash: Sha256Schema,
    sourceRevision: SourceRevisionV1Schema,
    findings: z.array(FindingV1Schema).min(1).max(5_000),
  })
  .strict();

export type FindingSetV1 = z.infer<typeof FindingSetCoreV1Schema>;
export type FindingSetDraftV1 = Omit<
  FindingSetV1,
  "schema" | "findingSetId" | "findingSetHash" | "findings"
> & Readonly<{ findings: readonly FindingDraftV1[] }>;

function withoutFindingSetHash(value: FindingSetV1): Omit<FindingSetV1, "findingSetHash"> {
  const { findingSetHash: _findingSetHash, ...identity } = value;
  return identity;
}

export function computeFindingSetHash(value: FindingSetV1): string {
  return hashCanonicalJson(withoutFindingSetHash(value));
}

function computeFindingSetId(input: Readonly<{
  runId: string;
  storyId: string;
  packetHash: string;
  sliceHash: string;
  sourceRevision: z.infer<typeof SourceRevisionV1Schema>;
  findingIds: readonly string[];
}>): string {
  return `FSET_${hashCanonicalJson({
    schema: "setfarm.finding-set-identity.v1",
    runId: input.runId,
    storyId: input.storyId,
    packetHash: input.packetHash,
    sliceHash: input.sliceHash,
    sourceRevision: input.sourceRevision,
    findingIds: [...input.findingIds].sort(lexical),
  })}`;
}

export const FindingSetV1Schema = FindingSetCoreV1Schema.superRefine((value, context) => {
  if (!hasUniqueStrings(value.findings.map((finding) => finding.findingId))) {
    context.addIssue({ code: "custom", path: ["findings"], message: "Finding IDs must be unique" });
  }
  const sortedFindingIds = value.findings.map((finding) => finding.findingId).sort(lexical);
  if (value.findings.some((finding, index) => finding.findingId !== sortedFindingIds[index])) {
    context.addIssue({ code: "custom", path: ["findings"], message: "Findings must use canonical ID order" });
  }
  const expectedId = computeFindingSetId({
    runId: value.runId,
    storyId: value.storyId,
    packetHash: value.packetHash,
    sliceHash: value.sliceHash,
    sourceRevision: value.sourceRevision,
    findingIds: sortedFindingIds,
  });
  if (value.findingSetId !== expectedId) {
    context.addIssue({
      code: "custom",
      path: ["findingSetId"],
      message: "Finding-set ID must bind exact packet, slice, source, and findings",
    });
  }
  if (value.findingSetHash !== computeFindingSetHash(value)) {
    context.addIssue({
      code: "custom",
      path: ["findingSetHash"],
      message: "Finding-set hash must match its canonical semantic content",
    });
  }
});

export function createFindingSetV1(input: FindingSetDraftV1): FindingSetV1 {
  const base = z.object({
    runId: BoundedIdentitySchema,
    storyId: StoryIdSchema,
    packetHash: Sha256Schema,
    sliceHash: Sha256Schema,
    sourceRevision: SourceRevisionV1Schema,
    findings: z.array(FindingCoreV1Schema.omit({ findingId: true })).min(1).max(5_000),
  }).strict().parse(input);
  const findings = base.findings.map((finding) => {
    const canonical = canonicalFindingDraft(finding);
    return FindingV1Schema.parse({ ...canonical, findingId: computeFindingId(canonical) });
  }).sort((left, right) => lexical(left.findingId, right.findingId));
  const findingSetId = computeFindingSetId({ ...base, findingIds: findings.map((finding) => finding.findingId) });
  const withoutHash = {
    schema: "setfarm.finding-set.v1" as const,
    findingSetId,
    runId: base.runId,
    storyId: base.storyId,
    packetHash: base.packetHash,
    sliceHash: base.sliceHash,
    sourceRevision: base.sourceRevision,
    findings,
  };
  return FindingSetV1Schema.parse({
    ...withoutHash,
    findingSetHash: hashCanonicalJson(withoutHash),
  });
}
