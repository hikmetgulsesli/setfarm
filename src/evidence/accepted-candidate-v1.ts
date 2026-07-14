import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  GitCodeShaSchema,
  Sha256Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const EvidenceBundleIdSchema = z.string().regex(/^EVB_[a-f0-9]{64}$/);
const AcceptedCandidateIdSchema = z.string().regex(/^ACPT_[a-f0-9]{64}$/);
const PredicateRefSchema = z.string().regex(/^EVID_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

export const AcceptedStoryEvidenceV1Schema = z.object({
  storyId: StoryIdSchema,
  attemptId: AttemptIdSchema,
  sliceHash: Sha256Schema,
  evidencePlanHash: Sha256Schema,
  evidencePlanArtifactHash: Sha256Schema,
  evidenceBundleHash: Sha256Schema,
  evidenceId: EvidenceBundleIdSchema,
  predicateRefs: z.array(PredicateRefSchema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  const canonical = [...value.predicateRefs].sort();
  if (!hasUniqueStrings(value.predicateRefs)
    || value.predicateRefs.some((reference, index) => reference !== canonical[index])) {
    context.addIssue({
      code: "custom",
      path: ["predicateRefs"],
      message: "Accepted story predicate refs must be unique and canonically sorted",
    });
  }
});

export type AcceptedStoryEvidenceV1 = z.infer<typeof AcceptedStoryEvidenceV1Schema>;

const CandidateIdentityV1Schema = z.object({
  schema: z.literal("setfarm.accepted-candidate.v1"),
  runId: BoundedIdentitySchema,
  packetHash: Sha256Schema,
  storyPlanHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  storyEvidence: z.array(AcceptedStoryEvidenceV1Schema).min(1).max(5_000),
  integrationEvidenceHash: Sha256Schema,
  acceptor: z.object({
    id: z.literal("setfarm-final-tree-acceptor"),
    version: z.literal("1.0.0"),
    codeSha: GitCodeShaSchema,
    environmentHash: Sha256Schema,
  }).strict(),
}).strict();

const AcceptedCandidateCoreV1Schema = CandidateIdentityV1Schema.extend({
  candidateId: AcceptedCandidateIdSchema,
  candidateHash: Sha256Schema,
}).strict();

function integrationEvidenceIdentity(input: Readonly<{
  runId: string;
  packetHash: string;
  storyPlanHash: string;
  sourceRevision: z.infer<typeof SourceRevisionV1Schema>;
  storyEvidence: readonly AcceptedStoryEvidenceV1[];
}>): unknown {
  return {
    schema: "setfarm.integrated-source-evidence.v1",
    runId: input.runId,
    packetHash: input.packetHash,
    storyPlanHash: input.storyPlanHash,
    sourceRevision: input.sourceRevision,
    storyEvidence: input.storyEvidence,
  };
}

export function computeIntegrationEvidenceHashV1(input: Readonly<{
  runId: string;
  packetHash: string;
  storyPlanHash: string;
  sourceRevision: z.infer<typeof SourceRevisionV1Schema>;
  storyEvidence: readonly AcceptedStoryEvidenceV1[];
}>): string {
  return hashCanonicalJson(integrationEvidenceIdentity(input));
}

export const AcceptedCandidateV1Schema = AcceptedCandidateCoreV1Schema.superRefine((value, context) => {
  const storyIds = value.storyEvidence.map((entry) => entry.storyId);
  const attempts = value.storyEvidence.map((entry) => entry.attemptId);
  const bundles = value.storyEvidence.map((entry) => entry.evidenceBundleHash);
  const canonicalStoryIds = [...storyIds].sort();
  if (!hasUniqueStrings(storyIds)
    || storyIds.some((storyId, index) => storyId !== canonicalStoryIds[index])) {
    context.addIssue({
      code: "custom",
      path: ["storyEvidence"],
      message: "Accepted candidate stories must be unique and canonically sorted",
    });
  }
  if (!hasUniqueStrings(attempts)) {
    context.addIssue({ code: "custom", path: ["storyEvidence"], message: "Accepted attempts must be unique" });
  }
  if (!hasUniqueStrings(bundles)) {
    context.addIssue({ code: "custom", path: ["storyEvidence"], message: "Accepted bundles must be unique" });
  }

  const expectedIntegrationHash = computeIntegrationEvidenceHashV1(value);
  if (value.integrationEvidenceHash !== expectedIntegrationHash) {
    context.addIssue({
      code: "custom",
      path: ["integrationEvidenceHash"],
      message: "Integration evidence hash must bind every final-tree story proof",
    });
  }
  const { candidateId: _candidateId, candidateHash: _candidateHash, ...identity } = value;
  const expectedCandidateHash = hashCanonicalJson(identity);
  if (value.candidateHash !== expectedCandidateHash) {
    context.addIssue({ code: "custom", path: ["candidateHash"], message: "Accepted candidate hash mismatch" });
  }
  if (value.candidateId !== `ACPT_${expectedCandidateHash}`) {
    context.addIssue({ code: "custom", path: ["candidateId"], message: "Accepted candidate ID mismatch" });
  }
});

export type AcceptedCandidateV1 = z.infer<typeof AcceptedCandidateCoreV1Schema>;

export function createAcceptedCandidateV1(input: Readonly<{
  runId: string;
  packetHash: string;
  storyPlanHash: string;
  sourceRevision: z.infer<typeof SourceRevisionV1Schema>;
  storyEvidence: readonly AcceptedStoryEvidenceV1[];
  acceptor: z.input<typeof CandidateIdentityV1Schema>["acceptor"];
}>): AcceptedCandidateV1 {
  const storyEvidence = input.storyEvidence
    .map((entry) => AcceptedStoryEvidenceV1Schema.parse({
      ...entry,
      predicateRefs: [...entry.predicateRefs].sort(),
    }))
    .sort((left, right) => left.storyId.localeCompare(right.storyId));
  const integrationEvidenceHash = computeIntegrationEvidenceHashV1({ ...input, storyEvidence });
  const identity = CandidateIdentityV1Schema.parse({
    schema: "setfarm.accepted-candidate.v1",
    runId: input.runId,
    packetHash: input.packetHash,
    storyPlanHash: input.storyPlanHash,
    sourceRevision: input.sourceRevision,
    storyEvidence,
    integrationEvidenceHash,
    acceptor: input.acceptor,
  });
  const candidateHash = hashCanonicalJson(identity);
  return AcceptedCandidateV1Schema.parse({
    ...identity,
    candidateId: `ACPT_${candidateHash}`,
    candidateHash,
  });
}
