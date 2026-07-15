import {
  OperationalFailureCauseV1Schema,
  normalizeOperationalFailureCodeV1,
  operationalFailureCauseHashV1,
  type OperationalFailureCauseV1,
} from "./schemas/operational-failure-cause-v1.js";
import {
  canonicalV3RecoveryTerminalReasonCodesV1,
  createV3DownstreamTerminalOperationalFailureCauseV1,
  V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1,
} from "../recovery/v3-downstream-terminal-cause-v1.js";

export type OperationalFailureCauseAuthorityBindingV1 = Readonly<{
  requestedBy: string;
  workflowStepIds: readonly string[];
  boundary: string;
  failureClass: OperationalFailureCauseV1["failureClass"];
  failureCodes: readonly string[];
}>;

const SETUP_PACKET_CODES = [
  "SETUP_PACKET_ACTIVATION_REJECTED",
  "SETUP_PACKET_DESIGN_GRAPH_REJECTED",
  "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
  "SETUP_PACKET_DELIVERY_PROFILE_REJECTED",
  "SETUP_PACKET_ENTRYPOINT_AMBIGUOUS",
  "SETUP_PACKET_ENTRYPOINT_MISSING",
  "SETUP_PACKET_FILE_INVALID",
  "SETUP_PACKET_GENERATED_SOURCE_AMBIGUOUS",
  "SETUP_PACKET_GENERATED_SOURCE_MISSING",
  "SETUP_PACKET_GENERATED_SOURCE_TOPOLOGY_MISSING",
  "SETUP_PACKET_JSON_INVALID",
  "SETUP_PACKET_PLAN_REJECTED",
  "SETUP_PACKET_PROTOCOL_MISMATCH",
  "SETUP_PACKET_REPO_DIRTY",
  "SETUP_PACKET_REPO_IDENTITY_INVALID",
  "SETUP_PACKET_RUNTIME_EVIDENCE_REJECTED",
  "SETUP_PACKET_RUN_ID_MISMATCH",
  "SETUP_PACKET_SOURCE_NON_CANONICAL",
  "SETUP_PACKET_STORY_PLAN_REJECTED",
  "SETUP_PACKET_TOPOLOGY_OWNER_AMBIGUOUS",
  "SETUP_PACKET_TOPOLOGY_REJECTED",
] as const;

const STITCH_CONVERTER_CONTRACT_CODES = [
  "STITCH_DESIGN_MANIFEST_JSON_INVALID",
  "V3_PROJECTION_CONTRACT_PARTIAL",
  "V3_PROJECTION_CONTRACT_JSON_INVALID",
  "V3_PROJECTION_TARGETS_INVALID",
  "V3_PROJECTION_BINDINGS_INVALID",
  "V3_PROJECTION_TARGET_ID_INVALID",
  "V3_PROJECTION_RESPONSE_BINDING_INVALID",
  "V3_PROJECTION_SCREEN_UNBOUND",
] as const;

const STITCH_CONVERTER_GENERATED_CODES = [
  "V3_OBSERVABLE_REF_INVALID",
  "V3_OBSERVABLE_SELECTOR_INVALID",
  "V3_OBSERVABLE_SELECTOR_MISSING",
  "V3_OBSERVABLE_SELECTOR_AMBIGUOUS",
] as const;

const PREPARATION_PHASES = [
  "eligibility",
  "packet",
  "source",
  "reservation",
  "publication",
] as const;

/** Canonical feature-dev v3 workflow vocabulary; custom legacy steps stay untyped. */
export const V3_OPERATIONAL_STAGE_WORKFLOW_STEP_IDS_V1 = Object.freeze([
  "plan",
  "design",
  "stories",
  "setup-repo",
  "setup-build",
  "implement",
  "verify",
  "security-gate",
  "qa-test",
  "final-test",
  "deploy",
  "supervise",
]);

export function isV3OperationalStageWorkflowStepIdV1(value: string): boolean {
  return V3_OPERATIONAL_STAGE_WORKFLOW_STEP_IDS_V1.includes(value);
}

/**
 * Immutable snapshot of the preparation producer vocabulary at authority v1.
 * It must not derive from the evolving producer enum: migration 21 embeds this
 * exact registry in its checksum. New producer codes require authority v2.
 */
const PREPARATION_CODES_BY_FAILURE_CLASS_V1: Readonly<Record<
  "platform_authority_invalid" | "contract_invalid" | "infrastructure_failure" | "platform_invariant_failed",
  readonly string[]
>> = Object.freeze({
  platform_authority_invalid: Object.freeze([
    "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
    "V3_SLICE_DEPENDENCY_COMMIT_MISSING",
    "V3_SLICE_SOURCE_CHANGED_DURING_CAPTURE",
    "RUNTIME_PACKET_NOT_ACTIVE",
    "V3_PREPARATION_WORKTREE_UNAVAILABLE",
  ]),
  contract_invalid: Object.freeze([
    "V3_EVIDENCE_PLAN_COMPILATION_REJECTED",
    "V3_IMPLEMENTATION_CONTEXT_CAPACITY_EXCEEDED",
    "V3_RUNTIME_EVIDENCE_CONTRACT_REJECTED",
    "V3_RUNTIME_EVIDENCE_STACK_UNSUPPORTED",
    "V3_SLICE_COMPILATION_REJECTED",
    "V3_SLICE_DEPENDENCY_PATH_INVALID",
    "V3_SLICE_DEPENDENCY_PATH_REF_CONFLICT",
    "V3_SLICE_DEPENDENCY_SOURCE_TYPE_UNSUPPORTED",
    "V3_SLICE_PATH_BINDING_MISSING",
    "V3_SLICE_SHARED_GRANT_MISSING",
    "V3_SLICE_SOURCE_PATH_ESCAPE",
    "V3_SLICE_SOURCE_TYPE_UNSUPPORTED",
    "V3_SLICE_STORY_NOT_IN_PACKET",
  ]),
  infrastructure_failure: Object.freeze([
    "40001",
    "40P01",
    "55P03",
    "57014",
    "EAI_AGAIN",
    "EBUSY",
    "ECONNRESET",
    "EMFILE",
    "ENFILE",
    "ENOSPC",
    "ETIMEDOUT",
  ]),
  platform_invariant_failed: Object.freeze([
    "V3_ATTEMPT_CLAIM_ID_REQUIRED",
    "V3_ATTEMPT_CONTEXT_ARTIFACT_MISMATCH",
    "V3_ATTEMPT_CONTEXT_EVIDENCE_PLAN_MISMATCH",
    "V3_ATTEMPT_CONTEXT_EXECUTION_AUTHORITY_MISMATCH",
    "V3_ATTEMPT_CONTEXT_IDENTITY_MISMATCH",
    "V3_ATTEMPT_CONTEXT_INDEX_MISMATCH",
    "V3_ATTEMPT_CONTEXT_PACKET_MISMATCH",
    "V3_ATTEMPT_CONTEXT_RECOVERY_MISMATCH",
    "V3_ATTEMPT_CONTEXT_SLICE_MISMATCH",
    "V3_ATTEMPT_ACTIVE_CONFLICT",
    "V3_ATTEMPT_DUPLICATE_UNCHANGED_SOURCE",
    "V3_ATTEMPT_RESERVATION_BINDING_MISMATCH",
    "V3_DOWNSTREAM_EVIDENCE_PUBLICATION_INPUT_INVALID",
    "V3_EVIDENCE_ONLY_PUBLICATION_INPUT_INVALID",
    "V3_EVIDENCE_PLAN_PUBLICATION_HASH_MISMATCH",
    "V3_EVIDENCE_PUBLICATION_AUTHORITY_CONFLICT",
    "V3_OPERATIONAL_RETRY_AUTHORITY_CONFLICT",
    "V3_OPERATIONAL_RETRY_IDENTITY_MISMATCH",
    "V3_OPERATIONAL_RETRY_PRIOR_ATTEMPT_UNAVAILABLE",
    "V3_OPERATIONAL_RETRY_PRIOR_ATTEMPT_NOT_TERMINAL",
    "V3_OPERATIONAL_RETRY_PUBLICATION_HASH_MISMATCH",
    "V3_RECOVERY_AUTHORIZATION_IDENTITY_MISMATCH",
    "V3_RECOVERY_AUTHORIZATION_NOT_FOUND",
    "V3_RECOVERY_AUTHORIZATION_UNAVAILABLE",
    "V3_RECOVERY_CONTRACT_SLICE_IDENTITY_MISMATCH",
    "V3_RECOVERY_CONTRACT_SLICE_INVALID",
    "V3_RECOVERY_EXECUTION_AUTHORITY_MISMATCH",
    "V3_RECOVERY_FINDING_SET_NOT_FOUND",
    "V3_RECOVERY_FINDING_SET_OVERRIDE_REJECTED",
    "V3_RECOVERY_REVIEW_EVIDENCE_ARTIFACT_INVALID",
    "V3_RECOVERY_REVIEW_EVIDENCE_IDENTITY_MISMATCH",
    "V3_RECOVERY_REVIEW_EVIDENCE_REF_INVALID",
    "V3_RECOVERY_SOURCE_REVISION_MISMATCH",
    "V3_SLICE_DEPENDENCY_ATTEMPT_INVALID",
    "V3_SLICE_DEPENDENCY_COMMIT_INVALID",
    "V3_SLICE_DEPENDENCY_COMMIT_MISMATCH",
    "V3_SLICE_PUBLICATION_HASH_MISMATCH",
    "V3_PREPARATION_PUBLICATION_RESULT_MISMATCH",
    "V3_IMPLEMENTATION_INPUT_UNRESOLVED",
    "V3_IMPLEMENTATION_CRITICAL_CONTEXT_EMPTY",
  ]),
});

function preparationBindings(): OperationalFailureCauseAuthorityBindingV1[] {
  const bindings: OperationalFailureCauseAuthorityBindingV1[] = [];
  for (const phase of PREPARATION_PHASES) {
    for (const [failureClass, rawCodes] of Object.entries(
      PREPARATION_CODES_BY_FAILURE_CLASS_V1,
    ) as Array<[
      keyof typeof PREPARATION_CODES_BY_FAILURE_CLASS_V1,
      readonly string[],
    ]>) {
      bindings.push(Object.freeze({
        requestedBy: "setfarm.v3-pre-dispatch",
        workflowStepIds: Object.freeze(["implement"]),
        boundary: `implementation.pre_dispatch.${phase}`,
        failureClass,
        failureCodes: Object.freeze(rawCodes
          .map((code) => normalizeOperationalFailureCodeV1(code))
          .filter((code): code is string => Boolean(code))
          .sort()),
      }));
    }
  }
  return bindings;
}

function downstreamTerminalBindings(): OperationalFailureCauseAuthorityBindingV1[] {
  const codesByClass = new Map<OperationalFailureCauseV1["failureClass"], Set<string>>();
  for (const binding of V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1) {
    const codes = codesByClass.get(binding.failureClass) ?? new Set<string>();
    codes.add(binding.failureCode);
    codesByClass.set(binding.failureClass, codes);
  }
  return [...codesByClass.entries()].map(([failureClass, codes]) => Object.freeze({
    requestedBy: "setfarm-v3-downstream-compiler",
    workflowStepIds: Object.freeze(["qa-test", "final-test"]),
    boundary: "product_compiler.downstream_recovery",
    failureClass,
    failureCodes: Object.freeze([...codes].sort()),
  }));
}

const FIXED_BINDINGS: readonly OperationalFailureCauseAuthorityBindingV1[] = [
  {
    requestedBy: "setfarm.product-compiler.plan-refusal",
    workflowStepIds: ["plan"],
    boundary: "product_compiler.plan_refusal",
    failureClass: "contract_invalid",
    failureCodes: ["V3_PLAN_CLARIFICATION_REQUIRED"],
  },
  {
    requestedBy: "setfarm.product-compiler.deploy-refusal",
    workflowStepIds: ["deploy"],
    boundary: "product_compiler.deploy_authority",
    failureClass: "contract_invalid",
    failureCodes: [
      "V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING",
      "V3_DEPLOY_ACCEPTED_CANDIDATE_INVALID",
      "V3_DEPLOY_ACCEPTED_CANDIDATE_POINTER_MISMATCH",
      "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
      "V3_DEPLOY_PACKET_INVALID",
      "V3_DEPLOY_RUNTIME_ENV_MISSING",
    ],
  },
  {
    requestedBy: "setfarm.product-compiler.deploy-refusal",
    workflowStepIds: ["deploy"],
    boundary: "product_compiler.deploy_authority",
    failureClass: "infrastructure_failure",
    failureCodes: [
      "V3_DEPLOY_SOURCE_UNAVAILABLE",
      "V3_DEPLOY_PLATFORM_FAILED",
      "V3_DEPLOY_HEALTH_FAILED",
    ],
  },
  {
    requestedBy: "setfarm.product-compiler.deploy-refusal",
    workflowStepIds: ["deploy"],
    boundary: "product_compiler.deploy_authority",
    failureClass: "platform_authority_invalid",
    failureCodes: ["V3_DEPLOY_RUN_NOT_FOUND", "V3_DEPLOY_TARGET_UNSUPPORTED"],
  },
  {
    requestedBy: "setfarm.product-compiler.deploy-refusal",
    workflowStepIds: ["deploy"],
    boundary: "product_compiler.deploy_authority",
    failureClass: "platform_invariant_failed",
    failureCodes: ["V3_DEPLOY_ROLLBACK_FAILED"],
  },
  {
    requestedBy: "setfarm.step-fail.single",
    workflowStepIds: ["setup-build"],
    boundary: "product_compiler.setup_build_packet",
    failureClass: "contract_invalid",
    failureCodes: SETUP_PACKET_CODES,
  },
  {
    requestedBy: "setfarm.step-fail.single",
    workflowStepIds: ["setup-build"],
    boundary: "stitch.converter.input_contract",
    failureClass: "contract_invalid",
    failureCodes: STITCH_CONVERTER_CONTRACT_CODES,
  },
  {
    requestedBy: "setfarm.step-fail.single",
    workflowStepIds: ["setup-build"],
    boundary: "stitch.converter.generated_tsx",
    failureClass: "generated_artifact_invalid",
    failureCodes: STITCH_CONVERTER_GENERATED_CODES,
  },
  {
    requestedBy: "setfarm.step-fail.single",
    workflowStepIds: ["setup-build"],
    boundary: "stitch.converter.result_contract",
    failureClass: "platform_invariant_failed",
    failureCodes: ["STITCH_CONVERTER_RESULT_MISSING", "STITCH_CONVERTER_RESULT_INVALID"],
  },
  {
    requestedBy: "setfarm.step-fail.single",
    workflowStepIds: ["setup-build"],
    boundary: "stitch.design_import_validator",
    failureClass: "generated_artifact_invalid",
    failureCodes: ["STITCH_DESIGN_IMPORT_INVALID"],
  },
  {
    requestedBy: "setfarm-v3-downstream-compiler",
    workflowStepIds: ["qa-test", "final-test"],
    boundary: "product_compiler.downstream_recovery",
    failureClass: "contract_invalid",
    failureCodes: ["V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED"],
  },
  ...downstreamTerminalBindings(),
  {
    requestedBy: "setfarm.step-ops.stories-completeness",
    workflowStepIds: ["stories"],
    boundary: "story_plan.completeness",
    failureClass: "contract_invalid",
    failureCodes: ["STORIES_REQUIRED_OUTPUT_MISSING"],
  },
  {
    requestedBy: "setfarm.v3-stage-input-authority",
    workflowStepIds: V3_OPERATIONAL_STAGE_WORKFLOW_STEP_IDS_V1,
    boundary: "stage_context_assembly",
    failureClass: "contract_invalid",
    failureCodes: ["V3_STAGE_INPUT_UNRESOLVED"],
  },
  {
    requestedBy: "setfarm.v3-stage-retry-authority",
    workflowStepIds: V3_OPERATIONAL_STAGE_WORKFLOW_STEP_IDS_V1,
    boundary: "stage_retry_authority",
    failureClass: "retry_delta_missing",
    failureCodes: ["V3_STAGE_RETRY_DUPLICATE_UNCHANGED_TUPLE"],
  },
  {
    requestedBy: "setfarm.v3-pre-dispatch",
    workflowStepIds: ["implement"],
    boundary: "implementation.pre_dispatch",
    failureClass: "platform_authority_invalid",
    failureCodes: ["V3_PREPARATION_AUTHORITY_UNAVAILABLE"],
  },
] as const;

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1 = Object.freeze([
  ...FIXED_BINDINGS.map((binding) => Object.freeze({
    ...binding,
    workflowStepIds: Object.freeze([...binding.workflowStepIds]),
    failureCodes: Object.freeze([...binding.failureCodes]),
  })),
  ...preparationBindings(),
]);

export type OperationalFailureCauseAuthorityV1Result =
  | Readonly<{ trusted: true; cause: OperationalFailureCauseV1 }>
  | Readonly<{
      trusted: false;
      reasonCode: "STRUCTURE_INVALID" | "REQUESTER_UNKNOWN" | "PRODUCER_TUPLE_UNAUTHORIZED";
    }>;

export type OperationalFailureCauseEvidenceAuthorityV1Result =
  | Readonly<{ trusted: true; cause: OperationalFailureCauseV1 }>
  | Readonly<{
      trusted: false;
      reasonCode:
        | "STRUCTURE_INVALID"
        | "REQUESTER_UNKNOWN"
        | "PRODUCER_TUPLE_UNAUTHORIZED"
        | "EVIDENCE_BINDING_INVALID";
    }>;

export function evaluateOperationalFailureCauseAuthorityV1(input: Readonly<{
  requestedBy: string;
  cause: unknown;
}>): OperationalFailureCauseAuthorityV1Result {
  const parsed = OperationalFailureCauseV1Schema.safeParse(input.cause);
  if (!parsed.success) return Object.freeze({ trusted: false, reasonCode: "STRUCTURE_INVALID" });
  const requesterBindings = OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1
    .filter((binding) => binding.requestedBy === input.requestedBy);
  if (requesterBindings.length === 0) {
    return Object.freeze({ trusted: false, reasonCode: "REQUESTER_UNKNOWN" });
  }
  const trusted = requesterBindings.some((binding) =>
    binding.workflowStepIds.includes(parsed.data.workflowStepId)
    && binding.boundary === parsed.data.boundary
    && binding.failureClass === parsed.data.failureClass
    && binding.failureCodes.includes(parsed.data.failureCode));
  return trusted
    ? Object.freeze({ trusted: true, cause: parsed.data })
    : Object.freeze({ trusted: false, reasonCode: "PRODUCER_TUPLE_UNAUTHORIZED" });
}

/**
 * Bind a trusted cause to any producer evidence that participates in its
 * semantic identity. Downstream recovery is the first v1 producer with such a
 * cross-field contract; occurrence-only evidence remains freely extensible.
 */
export function evaluateOperationalFailureCauseEvidenceAuthorityV1(input: Readonly<{
  requestedBy: string;
  cause: unknown;
  evidence: Readonly<Record<string, unknown>>;
}>): OperationalFailureCauseEvidenceAuthorityV1Result {
  const authority = evaluateOperationalFailureCauseAuthorityV1(input);
  if (!authority.trusted) return authority;
  if (input.requestedBy === "setfarm.product-compiler.deploy-refusal") {
    return input.evidence.schema === "setfarm.v3-deploy-authority-termination.v1"
      && input.evidence.authorityCode === authority.cause.failureCode
      ? authority
      : Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
  }
  if (input.requestedBy === "setfarm.v3-pre-dispatch") {
    const errorCode = typeof input.evidence.errorCode === "string"
      ? normalizeOperationalFailureCodeV1(input.evidence.errorCode)
      : undefined;
    return errorCode === authority.cause.failureCode
      ? authority
      : Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
  }
  if (input.requestedBy !== "setfarm-v3-downstream-compiler") return authority;
  if (input.evidence.schema !== "setfarm.v3-downstream-termination-evidence.v1") {
    return Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
  }
  const outcome = input.evidence.outcome;
  let expected: OperationalFailureCauseV1;
  if (outcome === "packet_amendment_required") {
    if (Object.hasOwn(input.evidence, "terminalReasonCodes")) {
      return Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
    }
    expected = OperationalFailureCauseV1Schema.parse({
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: authority.cause.workflowStepId,
      boundary: "product_compiler.downstream_recovery",
      failureClass: "contract_invalid",
      failureCode: "V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED",
    });
  } else if (
    outcome === "bounded_recovery_blocked"
    && Array.isArray(input.evidence.terminalReasonCodes)
    && ["qa-test", "final-test"].includes(authority.cause.workflowStepId)
  ) {
    try {
      const canonicalReasons = canonicalV3RecoveryTerminalReasonCodesV1(
        input.evidence.terminalReasonCodes,
      );
      if (JSON.stringify(input.evidence.terminalReasonCodes) !== JSON.stringify(canonicalReasons)) {
        return Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
      }
      expected = createV3DownstreamTerminalOperationalFailureCauseV1({
        workflowStepId: authority.cause.workflowStepId as "qa-test" | "final-test",
        terminalReasonCodes: canonicalReasons,
      });
    } catch {
      return Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
    }
  } else {
    return Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
  }
  return operationalFailureCauseHashV1(expected) === operationalFailureCauseHashV1(authority.cause)
    ? authority
    : Object.freeze({ trusted: false, reasonCode: "EVIDENCE_BINDING_INVALID" });
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Build the DB check predicate from the same finite producer registry. */
export function operationalFailureCauseAuthoritySqlPredicateV1(input: Readonly<{
  requestedBySql: string;
  causeSql: string;
}>): string {
  return `(${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1.map((binding) => {
    const workflow = `${input.causeSql}->>'workflowStepId' IN (${binding.workflowStepIds.map(sqlLiteral).join(", ")})`;
    return `(${input.requestedBySql} = ${sqlLiteral(binding.requestedBy)} AND ${workflow} AND ${input.causeSql}->>'boundary' = ${sqlLiteral(binding.boundary)} AND ${input.causeSql}->>'failureClass' = ${sqlLiteral(binding.failureClass)} AND ${input.causeSql}->>'failureCode' IN (${binding.failureCodes.map(sqlLiteral).join(", ")}))`;
  }).join(" OR ")})`;
}

/** SQL equivalent of the producer evidence/cause cross-field contract. */
export function operationalFailureCauseEvidenceAuthoritySqlPredicateV1(input: Readonly<{
  requestedBySql: string;
  evidenceSql: string;
  causeSql: string;
}>): string {
  const downstreamBounded = V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1.map((binding) =>
    `(${input.causeSql}->>'failureClass' = ${sqlLiteral(binding.failureClass)} AND ${input.causeSql}->>'failureCode' = ${sqlLiteral(binding.failureCode)} AND ${input.evidenceSql}->'terminalReasonCodes' = ${sqlLiteral(JSON.stringify(binding.reasons))}::jsonb)`).join(" OR ");
  const normalizedPreDispatchCode = `(CASE WHEN ${input.evidenceSql}->>'errorCode' ~ '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$' THEN ${input.evidenceSql}->>'errorCode' WHEN ${input.evidenceSql}->>'errorCode' ~ '^[0-9A-Z]{5}$' THEN 'SQLSTATE_' || (${input.evidenceSql}->>'errorCode') WHEN ${input.evidenceSql}->>'errorCode' ~ '^E[A-Z0-9_]{2,120}$' THEN 'ERRNO_' || (${input.evidenceSql}->>'errorCode') ELSE NULL END)`;
  const deploy = `(${input.requestedBySql} <> 'setfarm.product-compiler.deploy-refusal' OR (${input.evidenceSql}->>'schema' = 'setfarm.v3-deploy-authority-termination.v1' AND ${input.evidenceSql}->>'authorityCode' = ${input.causeSql}->>'failureCode'))`;
  const preDispatch = `(${input.requestedBySql} <> 'setfarm.v3-pre-dispatch' OR (jsonb_typeof(${input.evidenceSql}->'errorCode') = 'string' AND ${normalizedPreDispatchCode} = ${input.causeSql}->>'failureCode'))`;
  const downstream = `(${input.requestedBySql} <> 'setfarm-v3-downstream-compiler' OR (${input.evidenceSql}->>'schema' = 'setfarm.v3-downstream-termination-evidence.v1' AND ((${input.evidenceSql}->>'outcome' = 'packet_amendment_required' AND NOT (${input.evidenceSql} ? 'terminalReasonCodes') AND ${input.causeSql}->>'failureClass' = 'contract_invalid' AND ${input.causeSql}->>'failureCode' = 'V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED') OR (${input.evidenceSql}->>'outcome' = 'bounded_recovery_blocked' AND (${downstreamBounded})))))`;
  return `(${deploy} AND ${preDispatch} AND ${downstream})`;
}
