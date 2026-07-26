import { z } from "zod";

import {
  canonicalJsonBytesBounded,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  Sha256Schema,
  StoryIdSchema,
} from "./common-v1.js";
import {
  ImplementationSourceMapEvidenceBindingV2Schema,
} from "./implementation-source-map-v2.js";
import {
  ProductInvocationResultValueContractV1Schema,
} from "./action-invocation-interface-intent-v1.js";

export const INVOCATION_EVIDENCE_CHECK_V2_SCHEMA =
  "setfarm.invocation-evidence-check.v2" as const;
export const INVOCATION_EVIDENCE_CHECK_V2_VERSION = "2.0.0" as const;
export const INVOCATION_EVIDENCE_CHECK_V2_MAX_CANONICAL_BYTES =
  2 * 1024 * 1024;

export const INVOCATION_EVIDENCE_CHECK_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.invocation-evidence-check-contract.v2" as const,
  version: INVOCATION_EVIDENCE_CHECK_V2_VERSION,
  authority:
    "fresh_candidate_source_closure_packet_slice_source_map_and_transport" as const,
  supportedPredicateKinds: Object.freeze([
    "action_invocation",
    "observable_outcome",
  ] as const),
  supportedInvocationKinds: Object.freeze([
    "cli_command",
    "http_request",
  ] as const),
  actionInvocationCheck:
    "decoded_success_for_exact_action_transport" as const,
  observableOutcomeCheck:
    "decoded_success_then_exact_result_value_json_pointer_and_canonical_equals" as const,
  observableAssertion:
    "one_exact_after_value_equals_assertion" as const,
  requestAuthority:
    "product_spec_evidence_scenario_reencoded_through_exact_transport" as const,
  sourceAuthority:
    "one_exact_story_leaf_evidence_binding_and_slice_proof" as const,
  callerExpectedValue: "forbidden" as const,
  operationalAdmission:
    "authentic_candidate_check_authority_plus_current_activated_release_execution_lease" as const,
  hashDomain: "setfarm.invocation-evidence-check-hash.v2" as const,
});

export const INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2 =
  hashCanonicalJson(INVOCATION_EVIDENCE_CHECK_CONTRACT_V2);

const JsonObjectV2Schema = z.record(
  z.string().min(1).max(160),
  z.json(),
).refine(
  (value) => Object.keys(value).length <= 500,
  "Invocation evidence target input is limited to 500 fields",
);

const InvocationEvidenceCheckAuthorityV2Schema = z.object({
  candidateSourceReceiptHash: Sha256Schema,
  semanticRevisionHash: Sha256Schema,
  implementationClosureHash: Sha256Schema,
  productSpecHash: Sha256Schema,
  productBuildPacketHash: Sha256Schema,
  productBuildPacketEnvelopeHash: Sha256Schema,
  sourceMapLeafHash: Sha256Schema,
  sourceMapLeafEnvelopeHash: Sha256Schema,
  sourceMapEvidenceBinding:
    ImplementationSourceMapEvidenceBindingV2Schema,
  transportSetHash: Sha256Schema,
  transportMembershipHash: Sha256Schema,
  transportContractHash: Sha256Schema,
}).strict();

const InvocationEvidenceExecutionV2Schema = z.object({
  storyId: StoryIdSchema,
  sliceHash: Sha256Schema,
  predicateRef: EvidenceIdSchema,
}).strict();

const InvocationEvidenceOperationV2Schema = z.object({
  actionRef: ActionIdSchema,
  invocationKind: z.enum(["cli_command", "http_request"]),
  targetInputValues: JsonObjectV2Schema,
  targetInputValuesHash: Sha256Schema,
  encodedRequestHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.targetInputValuesHash
      !== hashCanonicalJson({
        schema: "setfarm.invocation-evidence-target-input-values.v2",
        actionRef: value.actionRef,
        inputValues: value.targetInputValues,
      })
  ) {
    context.addIssue({
      code: "custom",
      path: ["targetInputValuesHash"],
      message: "Target input hash must bind the exact ProductSpec evidence scenario",
    });
  }
});

const ActionInvocationEvidenceCheckV2Schema = z.object({
  predicateKind: z.literal("action_invocation"),
  checkRef: z.literal("CHECK_ACTION_INVOCATION"),
  subjectRef: ActionIdSchema,
  required: z.literal(true),
  assertion: z.object({
    operator: z.literal("passes"),
  }).strict(),
}).strict();

const InvocationOutputObservableSelectorV2Schema = z.object({
  kind: z.literal("invocation_output"),
  coordinate: z.literal("result_value"),
  pointer: z.string().max(500).refine(
    (value) => /^(?:\/(?:[^~]|~[01])*)*$/u.test(value),
    "Expected an empty or RFC 6901 JSON Pointer",
  ),
  valueContract: ProductInvocationResultValueContractV1Schema,
}).strict();

const ObservableOutcomeEvidenceCheckV2Schema = z.object({
  predicateKind: z.literal("observable_outcome"),
  checkRef: z.literal("CHECK_OBSERVABLE_OUTCOME"),
  subjectRef: ObservableIdSchema,
  required: z.literal(true),
  predicateAssertion: z.object({
    operator: z.literal("passes"),
  }).strict(),
  selector: InvocationOutputObservableSelectorV2Schema,
  assertion: z.object({
    phase: z.literal("after"),
    property: z.literal("value"),
    operator: z.literal("equals"),
    expected: z.json(),
  }).strict(),
}).strict();

export const InvocationEvidencePredicateCheckV2Schema =
  z.discriminatedUnion("predicateKind", [
    ActionInvocationEvidenceCheckV2Schema,
    ObservableOutcomeEvidenceCheckV2Schema,
  ]);

const InvocationEvidenceCheckIdentityV2Schema = z.object({
  schema: z.literal(INVOCATION_EVIDENCE_CHECK_V2_SCHEMA),
  version: z.literal(INVOCATION_EVIDENCE_CHECK_V2_VERSION),
  contractHash: z.literal(INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2),
  authority: InvocationEvidenceCheckAuthorityV2Schema,
  execution: InvocationEvidenceExecutionV2Schema,
  operation: InvocationEvidenceOperationV2Schema,
  check: InvocationEvidencePredicateCheckV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.execution.predicateRef
      !== value.authority.sourceMapEvidenceBinding.evidenceRef
  ) {
    context.addIssue({
      code: "custom",
      path: ["execution", "predicateRef"],
      message: "Execution predicate must equal the exact SourceMap evidence binding",
    });
  }
  if (
    value.check.predicateKind === "action_invocation"
    && value.check.subjectRef !== value.operation.actionRef
  ) {
    context.addIssue({
      code: "custom",
      path: ["check", "subjectRef"],
      message: "Action-invocation subject must equal the exact operation action",
    });
  }
});

export type InvocationEvidenceCheckHashPayloadV2 = z.infer<
  typeof InvocationEvidenceCheckIdentityV2Schema
>;

export function hashInvocationEvidenceCheckV2(
  value:
    | InvocationEvidenceCheckHashPayloadV2
    | InvocationEvidenceCheckV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.checkHash;
  return hashCanonicalJson({
    schema: "setfarm.invocation-evidence-check-hash.v2",
    check: payload,
  });
}

const InvocationEvidenceCheckCandidateV2Schema =
  InvocationEvidenceCheckIdentityV2Schema.extend({
    checkHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.checkHash !== hashInvocationEvidenceCheckV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["checkHash"],
        message: "Invocation evidence check hash must bind the complete request",
      });
    }
  });

export const InvocationEvidenceCheckV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: INVOCATION_EVIDENCE_CHECK_V2_MAX_CANONICAL_BYTES,
        ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Invocation evidence check exceeds canonical byte or work bounds",
      });
    }
  })
  .pipe(InvocationEvidenceCheckCandidateV2Schema);

export type InvocationEvidenceCheckV2 = z.infer<
  typeof InvocationEvidenceCheckCandidateV2Schema
>;

export function createInvocationEvidenceCheckV2(
  input: InvocationEvidenceCheckHashPayloadV2,
): InvocationEvidenceCheckV2 {
  return recursivelyFreezeInvocationEvidenceCheckV2(
    InvocationEvidenceCheckV2Schema.parse({
      ...input,
      checkHash: hashInvocationEvidenceCheckV2(input),
    }),
  );
}

export function recursivelyFreezeInvocationEvidenceCheckV2<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (
        descriptor
        && "value" in descriptor
        && descriptor.value !== null
        && typeof descriptor.value === "object"
      ) {
        pending.push(descriptor.value as object);
      }
    }
    Object.freeze(current);
  }
  return value;
}
