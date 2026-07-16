import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  OperationalFailureCauseV1Schema,
  operationalFailureCauseHashV1,
} from "./operational-failure-cause-v1.js";

export const DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2 =
  "setfarm.product-compiler.design-refusal" as const;
export const DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2 =
  "setfarm.v3-design-candidate-authority-termination.v1" as const;
export const STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2 =
  "STITCH_TARGET_CANDIDATE_SELECTION_FAILURE" as const;
export const STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2 =
  "setfarm.stitch-target-candidate-selection-failure.v1" as const;

export const DesignCandidateAuthorityOutcomeV1Schema = z.enum([
  "candidate_authority_unresolved",
  "retry_delta_missing",
  "regeneration_authority_invalid",
]);

export type DesignCandidateAuthorityOutcomeV1 = z.infer<
  typeof DesignCandidateAuthorityOutcomeV1Schema
>;

const DESIGN_CANDIDATE_CAUSE_BY_OUTCOME = Object.freeze({
  candidate_authority_unresolved: Object.freeze({
    failureClass: "generated_artifact_invalid",
    failureCode: "V3_DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED",
  }),
  retry_delta_missing: Object.freeze({
    failureClass: "retry_delta_missing",
    failureCode: "V3_DESIGN_CANDIDATE_RETRY_DELTA_MISSING",
  }),
  regeneration_authority_invalid: Object.freeze({
    failureClass: "platform_authority_invalid",
    failureCode: "V3_DESIGN_CANDIDATE_REGENERATION_AUTHORITY_INVALID",
  }),
} satisfies Readonly<Record<DesignCandidateAuthorityOutcomeV1, Readonly<{
  failureClass:
    | "generated_artifact_invalid"
    | "retry_delta_missing"
    | "platform_authority_invalid";
  failureCode: string;
}>>>);

const EvidenceSchemaIdentity = z.string()
  .min(1)
  .max(200)
  .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/);

const RequesterIdentity = z.string().min(1).max(500);

/**
 * Exact retry/dedupe identity for the currently supported design refusal.
 *
 * The three hashes deliberately remain separate:
 * - operationalCauseHash groups the stable cross-run platform cause;
 * - failureFingerprint identifies an unchanged failed authority and delta;
 * - failureArtifactHash identifies immutable canonical envelope bytes.
 */
export const OperationalExactFailureIdentityV2Schema = z.object({
  schema: z.literal("setfarm.operational-exact-failure-identity.v2"),
  kind: z.literal("stitch_target_candidate_selection"),
  refKey: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2),
  artifactType: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2),
  failureArtifactHash: Sha256Schema,
  failureFingerprint: Sha256Schema,
  candidateSelectionHash: Sha256Schema,
}).strict();

export type OperationalExactFailureIdentityV2 = z.infer<
  typeof OperationalExactFailureIdentityV2Schema
>;

export const OperationalFailureIdentityV2Schema = z.object({
  schema: z.literal("setfarm.operational-failure-identity.v2"),
  requestedBy: RequesterIdentity,
  evidenceSchema: EvidenceSchemaIdentity.nullable(),
  operationalCause: OperationalFailureCauseV1Schema,
  operationalCauseHash: Sha256Schema,
  exactFailure: OperationalExactFailureIdentityV2Schema.nullable(),
}).strict().superRefine((value, context) => {
  const expectedCauseHash = operationalFailureCauseHashV1(value.operationalCause);
  if (value.operationalCauseHash !== expectedCauseHash) {
    context.addIssue({
      code: "custom",
      path: ["operationalCauseHash"],
      message: "Operational cause hash must bind only the canonical stable cause",
    });
  }

  const hasDesignRequester = value.requestedBy === DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2;
  const hasDesignEvidence = value.evidenceSchema === DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2;
  if (hasDesignRequester !== hasDesignEvidence) {
    context.addIssue({
      code: "custom",
      path: ["evidenceSchema"],
      message: "Design candidate failure requester and evidence schema must activate together",
    });
  }
  if ((hasDesignRequester && hasDesignEvidence) !== Boolean(value.exactFailure)) {
    context.addIssue({
      code: "custom",
      path: ["exactFailure"],
      message: "Design candidate authority requires its exact immutable failure identity",
    });
  }

  if (value.exactFailure) {
    const expectedCauses = Object.values(DESIGN_CANDIDATE_CAUSE_BY_OUTCOME);
    const canonicalDesignCause = value.operationalCause.workflowStepId === "design"
      && value.operationalCause.boundary === "product_compiler.design_candidate_authority"
      && expectedCauses.some((candidate) =>
        candidate.failureClass === value.operationalCause.failureClass
        && candidate.failureCode === value.operationalCause.failureCode);
    if (!canonicalDesignCause) {
      context.addIssue({
        code: "custom",
        path: ["operationalCause"],
        message: "Exact design failure identity requires a canonical design candidate cause",
      });
    }
  }
});

export type OperationalFailureIdentityV2 = z.infer<
  typeof OperationalFailureIdentityV2Schema
>;

const TerminationLifecycleEvidenceFields = {
  deferredForCompletionRequestId: z.string().min(1).max(1_000).optional(),
  runtimeSessionCount: z.number().int().nonnegative().optional(),
  ownerInstanceId: z.string().min(1).max(1_000).optional(),
} as const;

export const OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema = z.object({
  schema: z.literal(DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2),
  terminalFailure: z.literal(true),
  owner: z.literal("compiler"),
  outcome: DesignCandidateAuthorityOutcomeV1Schema,
  failureRefKey: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2),
  failureArtifactType: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2),
  failureArtifactHash: Sha256Schema,
  failureFingerprint: Sha256Schema,
  candidateSelectionHash: Sha256Schema,
  modelRedispatchBudget: z.literal(0),
  operationalFailureCause: OperationalFailureCauseV1Schema,
  ...TerminationLifecycleEvidenceFields,
}).strict().superRefine((value, context) => {
  const expected = DESIGN_CANDIDATE_CAUSE_BY_OUTCOME[value.outcome];
  if (
    value.operationalFailureCause.workflowStepId !== "design"
    || value.operationalFailureCause.boundary !== "product_compiler.design_candidate_authority"
    || value.operationalFailureCause.failureClass !== expected.failureClass
    || value.operationalFailureCause.failureCode !== expected.failureCode
  ) {
    context.addIssue({
      code: "custom",
      path: ["operationalFailureCause"],
      message: "Design candidate outcome must bind its exact canonical operational cause",
    });
  }
});

export type OperationalDesignCandidateAuthorityTerminationEvidenceV1 = z.infer<
  typeof OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema
>;

export function createOperationalFailureIdentityV2(input: Readonly<{
  requestedBy: string;
  evidenceSchema: string | null;
  operationalCause: unknown;
  exactFailure: unknown | null;
}>): OperationalFailureIdentityV2 {
  const operationalCause = OperationalFailureCauseV1Schema.parse(input.operationalCause);
  return OperationalFailureIdentityV2Schema.parse({
    schema: "setfarm.operational-failure-identity.v2",
    requestedBy: input.requestedBy,
    evidenceSchema: input.evidenceSchema,
    operationalCause,
    operationalCauseHash: hashCanonicalJson(operationalCause),
    exactFailure: input.exactFailure,
  });
}
