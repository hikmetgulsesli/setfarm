import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  GeneratorMemberKindV2Schema,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  hashNodeProductRuntimeGeneratorProfileV2,
} from "./semantic-realization-plan-v2.js";
import { hashFileTreeRuntimeBindingMembershipV3 } from
  "./file-tree-manifest-v3.js";
import {
  SemanticSourceResponsibilityV1Schema,
  SemanticSourceSubjectKindV1Schema,
} from "./stack-semantic-source-rules-v1.js";

export const NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_VERSION_V2 = "2.0.0" as const;
export const NODE_PRODUCT_RUNTIME_SOURCE_MAX_BYTES_V2 = 12 * 1024 * 1024;
export const NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  6 * 1024 * 1024;
export const NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_BOUNDED_WORK_LIMITS_V2 =
  Object.freeze({
    maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 20,
    maxNodes:
      NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2 + 50_000,
    maxContainerEntries:
      DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
    maxWorkUnits:
      (NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2 * 8)
      + (2 * 1024 * 1024),
  });

/**
 * Exact semantics implemented by the code-owned runtime source template.
 * Product prose never enters this contract. Unsupported behavior is rejected
 * before source bytes exist instead of being guessed by an implementation
 * model or repaired by a later review classifier.
 */
export const NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.node-product-runtime-program-contract.v2" as const,
  contractVersion: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_VERSION_V2,
  sourceAuthority: Object.freeze({
    productBehavior: "product_spec_v2_machine_readable_fields_only" as const,
    invocationInput: "fresh_invocation_input_transport_set_v2" as const,
    semanticCoverage: "fresh_semantic_realization_plan_v2" as const,
    physicalTarget: "fresh_file_tree_v3_and_build_topology_v3" as const,
  }),
  admission: Object.freeze({
    proseStateInvariants: "reject_opaque_behavior" as const,
    entityFieldValueSources: "reject_without_entity_snapshot_binding" as const,
    nonStayNavigation: "reject_without_delivery_navigation_runtime" as const,
    optionalInputs: "rejected_by_invocation_transport_v2" as const,
    temporalInputs: "rejected_by_invocation_transport_v2" as const,
    outputPointerOverlap: "reject_ambiguous_projection" as const,
  }),
  state: Object.freeze({
    initialization: "deep_clone_product_spec_initial_values" as const,
    transaction: "clone_before_apply_in_order_commit_only_on_success" as const,
    valueSourceSnapshot: "state_before_action" as const,
    pointerGrammar: "rfc6901_root_or_existing_parent" as const,
    equality: "canonical_json_deep_equality" as const,
    missingPreconditionPointer:
      "equals_false_not_equals_true_exists_false_not_exists_true" as const,
    operations: Object.freeze([
      "append",
      "clear",
      "merge",
      "remove",
      "set",
      "upsert",
    ] as const),
    clearSemantics: "set_exact_value_from" as const,
    removeSemantics:
      "filter_deep_equal_or_match_field_deep_equal" as const,
    upsertSemantics:
      "replace_first_match_or_append_using_match_field" as const,
  }),
  invocation: Object.freeze({
    cli: "exact_subcommand_then_canonical_transport_suffix_and_stdin" as const,
    http:
      "exact_method_route_rfc3986_query_and_body_pointer_closure" as const,
    inputCoercion: "forbidden_except_inverse_verified_text_codec" as const,
    inputFailure: "declared_input_validation_failure_case" as const,
    preconditionFailure: "declared_precondition_failure_case" as const,
    actionFailure: "declared_action_failure_case" as const,
    jsonBoundary:
      "plain_dense_data_properties_finite_numbers_no_symbols_or_cycles" as const,
  }),
  output: Object.freeze({
    projection: "every_invocation_output_observable_exactly_once" as const,
    valueSources: Object.freeze(["input", "literal"] as const),
    successCode: "first_canonical_declared_success_code" as const,
    failureCode: "first_canonical_declared_failure_code" as const,
    cliSuccessChannel: "stdout_json_single_lf" as const,
    cliFailureChannel: "stderr_json_single_lf" as const,
    httpChannel: "express_response_json" as const,
  }),
  persistence: Object.freeze({
    none: "state_runtime_only" as const,
    memory: "module_lifetime_state_runtime" as const,
    otherKinds: "rejected_by_delivery_profile_v2" as const,
  }),
  determinism: Object.freeze({
    clock: "forbidden" as const,
    randomness: "forbidden" as const,
    network: "forbidden" as const,
    ambientEnvironment: "forbidden" as const,
    filesystemDiscovery: "forbidden" as const,
    objectOrdering: "utf16_code_unit" as const,
  }),
} as const);

export const NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2 = hashCanonicalJson(
  NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_V2,
);

const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);
const AdmissionScopeV2Schema = z.enum(["production_host", "test_fixture"]);
const GeneratedMemberSymbolRefV2Schema = z.string().regex(/^GENMEM_[A-F0-9]{64}$/u);

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

export function deriveNodeProductRuntimeGeneratedMemberSymbolRefV2(
  value: Readonly<{
    realizationRef: string;
    realizationHash: string;
    memberKind: string;
  }>,
): string {
  return `GENMEM_${hashCanonicalJson({
    schema: "setfarm.node-product-runtime-generated-member-symbol-ref.v2",
    member: {
      realizationRef: value.realizationRef,
      realizationHash: value.realizationHash,
      memberKind: value.memberKind,
    },
  }).toUpperCase()}`;
}

const GeneratedMemberSourceSpanV2Schema = z.object({
  markerLine: z.number().int().positive().max(100_000),
  startByte: z.number().int().nonnegative().max(
    NODE_PRODUCT_RUNTIME_SOURCE_MAX_BYTES_V2,
  ),
  endByteExclusive: z.number().int().positive().max(
    NODE_PRODUCT_RUNTIME_SOURCE_MAX_BYTES_V2,
  ),
  markerHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.endByteExclusive <= value.startByte) {
    context.addIssue({
      code: "custom",
      path: ["endByteExclusive"],
      message: "Generated member marker span must be non-empty",
    });
  }
});

export const NodeProductRuntimeGeneratedMemberBindingV2Schema = z.object({
  realizationRef: StableReferenceSchema,
  realizationHash: Sha256Schema,
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  subjectHash: Sha256Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  storyId: StoryIdSchema.nullable(),
  memberKind: GeneratorMemberKindV2Schema,
  generatedSymbolRef: GeneratedMemberSymbolRefV2Schema,
  sourceSpan: GeneratedMemberSourceSpanV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.generatedSymbolRef
      !== deriveNodeProductRuntimeGeneratedMemberSymbolRefV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["generatedSymbolRef"],
      message: "Generated member symbol must bind the exact realization",
    });
  }
});

export type NodeProductRuntimeGeneratedMemberBindingV2 = z.infer<
  typeof NodeProductRuntimeGeneratedMemberBindingV2Schema
>;

export function hashNodeProductRuntimeGeneratedMemberMembershipV2(
  members: readonly NodeProductRuntimeGeneratedMemberBindingV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-runtime-generated-member-membership-hash.v2",
    members,
  });
}

const RuntimeSourceIdentityV2Schema = z.object({
  pathRef: PathBindingIdSchema,
  normalizedLocator: z.enum(["src/cli.ts", "src/app.ts"]),
  mediaType: z.literal("text/typescript"),
  encoding: z.literal("utf-8"),
  newline: z.literal("lf"),
  finalNewline: z.literal(true),
  moduleSystem: z.literal("node_esm"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(
    NODE_PRODUCT_RUNTIME_SOURCE_MAX_BYTES_V2,
  ),
  lineCount: z.number().int().positive().max(100_000),
  runtimeProgramHash: Sha256Schema,
  sourceIdentityHash: Sha256Schema,
}).strict();

export type NodeProductRuntimeSourceIdentityV2 = z.infer<
  typeof RuntimeSourceIdentityV2Schema
>;

export function hashNodeProductRuntimeSourceIdentityV2(
  value:
    | Omit<NodeProductRuntimeSourceIdentityV2, "sourceIdentityHash">
    | NodeProductRuntimeSourceIdentityV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.sourceIdentityHash;
  return hashCanonicalJson({
    schema: "setfarm.node-product-runtime-source-identity-hash.v2",
    source: payload,
  });
}

const RuntimeSourceReceiptLogicalIdentityV2Schema = z.object({
  schema: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_VERSION_V2),
  readiness: z.object({
    status: z.literal("shadow_generated"),
    productionUse: z.literal("forbidden"),
  }).strict(),
  authority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: ProfileIdV2Schema,
    stackPackId: StackPackIdV2Schema,
    generatorRef: z.literal("NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
    generatorContractHash: z.literal(
      NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
    ),
    generatorProfileHash: Sha256Schema,
    runtimeProgramContractHash: z.literal(
      NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
    ),
    invocationTransportSet: z.object({
      schema: z.literal("setfarm.invocation-input-transport-set.v2"),
      contractSetHash: Sha256Schema,
      membershipHash: Sha256Schema,
      contractCount: z.number().int().positive().max(2_000),
    }).strict(),
    runtimeBehavior: z.object({
      proposalHash: Sha256Schema,
      contractHash: Sha256Schema,
      evaluatorContractHash: Sha256Schema,
    }).strict(),
    semanticRealizationPlan: z.object({
      schema: z.literal("setfarm.semantic-realization-plan.v2"),
      planHash: Sha256Schema,
      realizationMembershipHash: Sha256Schema,
      generatorMemberCount: z.number().int().positive().max(20_000),
    }).strict(),
    fileTree: z.object({
      schema: z.literal("setfarm.file-tree-manifest.v3"),
      manifestHash: Sha256Schema,
      runtimePathEntryHash: Sha256Schema,
      runtimeRealizationMembershipHash: Sha256Schema,
    }).strict(),
    buildTopology: z.object({
      schema: z.literal("setfarm.build-topology.v3"),
      logicalBuildHash: Sha256Schema,
      compilationContractHash: Sha256Schema,
    }).strict(),
  }).strict(),
  source: RuntimeSourceIdentityV2Schema,
  coverage: z.object({
    generatorMemberCount: z.number().int().positive().max(20_000),
    members: z.array(NodeProductRuntimeGeneratedMemberBindingV2Schema)
      .min(1).max(20_000),
    realizationBindingMembershipHash: Sha256Schema,
    generatedMemberMembershipHash: Sha256Schema,
    opaqueBehaviorCount: z.literal(0),
    disposition: z.literal(
      "every_generator_realization_bound_to_exact_generated_source_marker",
    ),
  }).strict(),
}).strict();

export type NodeProductRuntimeSourceReceiptLogicalIdentityV2 = z.infer<
  typeof RuntimeSourceReceiptLogicalIdentityV2Schema
>;

export function hashNodeProductRuntimeSourceLogicalReceiptV2(
  value:
    | NodeProductRuntimeSourceReceiptLogicalIdentityV2
    | NodeProductRuntimeSourceReceiptV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-runtime-source-logical-receipt-hash.v2",
    receipt: {
      schema: value.schema,
      receiptVersion: value.receiptVersion,
      readiness: value.readiness,
      authority: value.authority,
      source: value.source,
      coverage: value.coverage,
    },
  });
}

const RuntimeSourceReceiptIdentityV2Schema =
  RuntimeSourceReceiptLogicalIdentityV2Schema.extend({
    logicalReceiptHash: Sha256Schema,
    operationalEvidence: z.object({
      admissionScope: AdmissionScopeV2Schema,
      buildTopologyManifestHash: Sha256Schema,
      evidenceAuthority: z.literal(
        "authenticated_private_dependency_stage_fresh_revalidation_v3",
      ),
    }).strict(),
  }).strict();

export type NodeProductRuntimeSourceReceiptHashPayloadV2 = z.infer<
  typeof RuntimeSourceReceiptIdentityV2Schema
>;

export function hashNodeProductRuntimeSourceReceiptV2(
  value:
    | NodeProductRuntimeSourceReceiptHashPayloadV2
    | NodeProductRuntimeSourceReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-product-runtime-source-receipt-hash.v2",
    receipt: payload,
  });
}

function addReceiptClosureIssuesV2(
  value: NodeProductRuntimeSourceReceiptHashPayloadV2 & { receiptHash: string },
  context: z.RefinementCtx,
): void {
  const profile = NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find(
    (candidate) => candidate.profileId === value.authority.profileId,
  );
  const expectedLocator = value.authority.profileId
    === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? "src/cli.ts"
    : "src/app.ts";
  if (
    !profile
    || profile.stackPackId !== value.authority.stackPackId
    || value.authority.generatorProfileHash
      !== hashNodeProductRuntimeGeneratorProfileV2(profile)
    || value.source.normalizedLocator !== expectedLocator
    || value.source.sourceIdentityHash
      !== hashNodeProductRuntimeSourceIdentityV2(value.source)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority", "profileId"],
      message: "Runtime source profile, stack, locator and source identity must join",
    });
  }

  const realizationRefs = value.coverage.members.map((member) =>
    member.realizationRef);
  const spanKeys = value.coverage.members.map((member) =>
    `${member.sourceSpan.startByte.toString().padStart(12, "0")}\0${member.realizationRef}`);
  const spansOverlapOrDrift = value.coverage.members.some((member, index) =>
    member.sourceSpan.markerLine !== index + 3
    || (
      index > 0
      && value.coverage.members[index - 1]!.sourceSpan.endByteExclusive
        >= member.sourceSpan.startByte
    ));
  if (
    value.coverage.generatorMemberCount !== value.coverage.members.length
    || value.coverage.generatorMemberCount
      !== value.authority.semanticRealizationPlan.generatorMemberCount
    || !canonicalStrings(realizationRefs)
    || !canonicalStrings(spanKeys)
    || spansOverlapOrDrift
    || value.coverage.members.some((member) =>
      member.sourceSpan.endByteExclusive > value.source.byteLength)
    || value.coverage.realizationBindingMembershipHash
      !== hashFileTreeRuntimeBindingMembershipV3(
        value.coverage.members.map((member) => ({
          realizationRef: member.realizationRef,
          realizationHash: member.realizationHash,
          intentRef: member.intentRef,
          intentHash: member.intentHash,
          subjectKind: member.subjectKind,
          subjectRef: member.subjectRef,
          subjectHash: member.subjectHash,
          responsibility: member.responsibility,
          storyId: member.storyId,
          memberKind: member.memberKind,
        })),
      )
    || value.coverage.generatedMemberMembershipHash
      !== hashNodeProductRuntimeGeneratedMemberMembershipV2(
        value.coverage.members,
      )
    || value.authority.fileTree.runtimeRealizationMembershipHash
      !== value.coverage.realizationBindingMembershipHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["coverage", "members"],
      message: "Runtime source members must be complete, canonical, non-overlapping and hashed",
    });
  }
  if (
    value.logicalReceiptHash
      !== hashNodeProductRuntimeSourceLogicalReceiptV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["logicalReceiptHash"],
      message: "Logical runtime-source receipt hash must bind semantic source identity",
    });
  }
  if (value.receiptHash !== hashNodeProductRuntimeSourceReceiptV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["receiptHash"],
      message: "Runtime-source receipt hash must bind logical and operational authority",
    });
  }
}

const RuntimeSourceReceiptCandidateV2Schema =
  RuntimeSourceReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine(addReceiptClosureIssuesV2);

export const NodeProductRuntimeSourceReceiptV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2,
        ...NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_BOUNDED_WORK_LIMITS_V2,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Runtime-source receipt exceeds canonical byte or work bounds",
      });
    }
  })
  .pipe(RuntimeSourceReceiptCandidateV2Schema);

export type NodeProductRuntimeSourceReceiptV2 = z.infer<
  typeof RuntimeSourceReceiptCandidateV2Schema
>;

export function recursivelyFreezeNodeProductRuntimeSourceV2<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
