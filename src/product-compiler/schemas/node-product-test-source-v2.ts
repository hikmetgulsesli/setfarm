import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  EvidenceIdSchema,
  PathBindingIdSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  FileTreeTestCoverageBindingV3Schema,
  hashFileTreeTestCoverageMembershipV3,
  type FileTreeTestCoverageBindingV3,
} from "./file-tree-manifest-v3.js";
import {
  NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
} from "./node-product-runtime-source-v2.js";
import {
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  hashNodeProductTestGeneratorProfileV2,
} from "./semantic-realization-plan-v2.js";

export const NODE_PRODUCT_TEST_SOURCE_RECEIPT_VERSION_V2 = "2.0.0" as const;
export const NODE_PRODUCT_TEST_SOURCE_MAX_BYTES_V2 = 12 * 1024 * 1024;
export const NODE_PRODUCT_TEST_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  6 * 1024 * 1024;
export const NODE_PRODUCT_TEST_SOURCE_RECEIPT_BOUNDED_WORK_LIMITS_V2 =
  Object.freeze({
    maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 20,
    maxNodes:
      NODE_PRODUCT_TEST_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2 + 50_000,
    maxContainerEntries:
      DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
    maxWorkUnits:
      (NODE_PRODUCT_TEST_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2 * 8)
      + (2 * 1024 * 1024),
  });

export const NODE_PRODUCT_TEST_PROGRAM_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.node-product-test-program-contract.v2" as const,
  contractVersion: NODE_PRODUCT_TEST_SOURCE_RECEIPT_VERSION_V2,
  sourceAuthority: Object.freeze({
    productBehavior:
      "fresh_product_spec_v2_and_product_runtime_behavior_contract_v1" as const,
    invocation:
      "fresh_invocation_input_transport_set_v2_and_evidence_scenarios" as const,
    semanticCoverage: "fresh_semantic_realization_plan_v2" as const,
    physicalTarget: "fresh_file_tree_v3_and_build_topology_v3" as const,
    runtimeSource:
      "fresh_reproduced_node_product_runtime_source_v2" as const,
  }),
  execution: Object.freeze({
    runner: "node_test_direct_compiled_file" as const,
    testCardinality: "one_exact_success_test_per_action" as const,
    cliRuntime:
      "spawn_exact_sibling_runtime_module_with_empty_environment" as const,
    apiRuntime:
      "import_exact_sibling_runtime_module_with_test_ref_cache_isolation" as const,
    network: "forbidden" as const,
    filesystemDiscovery: "forbidden" as const,
    clock: "forbidden" as const,
    randomness: "forbidden" as const,
    timeoutMilliseconds: 5_000 as const,
    maximumOutputBytes: 8 * 1024 * 1024,
  }),
  evidence: Object.freeze({
    supportedKinds: Object.freeze([
      "action_invocation",
      "observable_outcome",
    ] as const),
    unsupportedDisposition: "reject_before_source_bytes" as const,
    actionInvocation:
      "exact_transport_success_code_and_complete_canonical_result" as const,
    observableOutcome:
      "exact_complete_canonical_result_contains_compiled_projection" as const,
  }),
  behavior: Object.freeze({
    initialCheckpoint:
      "exercised_by_fresh_runtime_instance_for_every_action" as const,
    afterActionCheckpoint:
      "exercised_before_runtime_transaction_commit_for_every_action" as const,
    runtimeAssertionCoverage:
      "each_assertion_bound_to_one_deterministic_action_test" as const,
    entitySnapshotCoverage:
      "each_occurrence_bound_to_its_owning_action_test" as const,
    failureOwnership: "runtime_declared_action_failure_abi" as const,
  }),
  scenario: Object.freeze({
    target: "exact_product_spec_evidence_target_input_values" as const,
    prerequisites:
      "exact_product_spec_ordered_prerequisite_steps" as const,
    cliPrerequisites:
      "rejected_until_one_process_sequence_abi_exists" as const,
    apiPrerequisites: "same_fresh_handler_instance_before_target" as const,
  }),
} as const);

export const NODE_PRODUCT_TEST_PROGRAM_CONTRACT_HASH_V2 = hashCanonicalJson(
  NODE_PRODUCT_TEST_PROGRAM_CONTRACT_V2,
);

const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);
const AdmissionScopeV2Schema = z.enum(["production_host", "test_fixture"]);
const TestCoverageSymbolRefV2Schema = z.string().regex(/^TESTMEM_[A-F0-9]{64}$/u);

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

const GeneratedTestSourceSpanV2Schema = z.object({
  markerLine: z.number().int().positive().max(100_000),
  startByte: z.number().int().nonnegative().max(
    NODE_PRODUCT_TEST_SOURCE_MAX_BYTES_V2,
  ),
  endByteExclusive: z.number().int().positive().max(
    NODE_PRODUCT_TEST_SOURCE_MAX_BYTES_V2,
  ),
  markerHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.endByteExclusive > value.startByte) return;
  context.addIssue({
    code: "custom",
    path: ["endByteExclusive"],
    message: "Generated test coverage marker span must be non-empty",
  });
});

export function deriveNodeProductTestCoverageSymbolRefV2(
  value: FileTreeTestCoverageBindingV3,
): string {
  return `TESTMEM_${hashCanonicalJson({
    schema: "setfarm.node-product-test-coverage-symbol-ref.v2",
    coverage: value,
  }).toUpperCase()}`;
}

export const NodeProductTestCoverageMemberV2Schema =
  FileTreeTestCoverageBindingV3Schema.extend({
    testRef: StableReferenceSchema,
    coverageSymbolRef: TestCoverageSymbolRefV2Schema,
    sourceSpan: GeneratedTestSourceSpanV2Schema,
  }).strict().superRefine((value, context) => {
    const {
      testRef: _testRef,
      coverageSymbolRef: _coverageSymbolRef,
      sourceSpan: _sourceSpan,
      ...binding
    } = value;
    if (
      value.coverageSymbolRef
      === deriveNodeProductTestCoverageSymbolRefV2(binding)
    ) return;
    context.addIssue({
      code: "custom",
      path: ["coverageSymbolRef"],
      message: "Generated test coverage symbol must bind the exact realization",
    });
  });

export type NodeProductTestCoverageMemberV2 = z.infer<
  typeof NodeProductTestCoverageMemberV2Schema
>;

export function hashNodeProductTestCoverageMemberMembershipV2(
  members: readonly NodeProductTestCoverageMemberV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-test-coverage-member-membership.v2",
    members,
  });
}

export const NodeProductActionTestBindingV2Schema = z.object({
  testRef: StableReferenceSchema,
  actionRef: ActionIdSchema,
  scenarioHash: Sha256Schema,
  transportContractHash: Sha256Schema,
  targetRequestHash: Sha256Schema,
  stepCount: z.number().int().positive().max(101),
  evidenceRefs: z.array(EvidenceIdSchema).min(1).max(500),
  behaviorAssertionRefs: z.array(StableReferenceSchema).max(20_000),
  entityFieldOccurrenceRefs: z.array(StableReferenceSchema).max(500),
}).strict().superRefine((value, context) => {
  for (const [field, values] of [
    ["evidenceRefs", value.evidenceRefs],
    ["behaviorAssertionRefs", value.behaviorAssertionRefs],
    ["entityFieldOccurrenceRefs", value.entityFieldOccurrenceRefs],
  ] as const) {
    if (canonicalStrings(values)) continue;
    context.addIssue({
      code: "custom",
      path: [field],
      message: `${field} must be canonical and unique`,
    });
  }
});

export type NodeProductActionTestBindingV2 = z.infer<
  typeof NodeProductActionTestBindingV2Schema
>;

export function hashNodeProductActionTestMembershipV2(
  bindings: readonly NodeProductActionTestBindingV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-action-test-membership.v2",
    bindings,
  });
}

export const NodeProductBehaviorAssertionTestBindingV2Schema = z.object({
  invariantRef: StableReferenceSchema,
  assertionRef: StableReferenceSchema,
  assertionHash: Sha256Schema,
  testRef: StableReferenceSchema,
}).strict();

export type NodeProductBehaviorAssertionTestBindingV2 = z.infer<
  typeof NodeProductBehaviorAssertionTestBindingV2Schema
>;

export function hashNodeProductBehaviorAssertionTestMembershipV2(
  bindings: readonly NodeProductBehaviorAssertionTestBindingV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-behavior-assertion-test-membership.v2",
    bindings,
  });
}

export const NodeProductEntityFieldTestBindingV2Schema = z.object({
  occurrenceRef: StableReferenceSchema,
  snapshotBindingHash: Sha256Schema,
  actionRef: ActionIdSchema,
  testRef: StableReferenceSchema,
}).strict();

export type NodeProductEntityFieldTestBindingV2 = z.infer<
  typeof NodeProductEntityFieldTestBindingV2Schema
>;

export function hashNodeProductEntityFieldTestMembershipV2(
  bindings: readonly NodeProductEntityFieldTestBindingV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-entity-field-test-membership.v2",
    bindings,
  });
}

const TestSourceIdentityV2Schema = z.object({
  pathRef: PathBindingIdSchema,
  normalizedLocator: z.enum([
    "src/cli.setfarm.test.ts",
    "src/app.setfarm.test.ts",
  ]),
  compiledPathRef: PathBindingIdSchema,
  compiledNormalizedLocator: z.enum([
    "dist/cli.setfarm.test.js",
    "dist/app.setfarm.test.js",
  ]),
  runtimeImportSpecifier: z.enum(["./cli.js", "./app.js"]),
  mediaType: z.literal("text/typescript"),
  encoding: z.literal("utf-8"),
  newline: z.literal("lf"),
  finalNewline: z.literal(true),
  moduleSystem: z.literal("node_esm"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(
    NODE_PRODUCT_TEST_SOURCE_MAX_BYTES_V2,
  ),
  lineCount: z.number().int().positive().max(100_000),
  testProgramHash: Sha256Schema,
  sourceIdentityHash: Sha256Schema,
}).strict();

export type NodeProductTestSourceIdentityV2 = z.infer<
  typeof TestSourceIdentityV2Schema
>;

export function hashNodeProductTestSourceIdentityV2(
  value:
    | Omit<NodeProductTestSourceIdentityV2, "sourceIdentityHash">
    | NodeProductTestSourceIdentityV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.sourceIdentityHash;
  return hashCanonicalJson({
    schema: "setfarm.node-product-test-source-identity-hash.v2",
    source: payload,
  });
}

const LogicalIdentityV2Schema = z.object({
  schema: z.literal(NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_PRODUCT_TEST_SOURCE_RECEIPT_VERSION_V2),
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
    generatorRef: z.literal("NODE_PRODUCT_TEST_GENERATOR_V2"),
    generatorContractHash: z.literal(
      NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
    ),
    generatorProfileHash: Sha256Schema,
    testProgramContractHash: z.literal(
      NODE_PRODUCT_TEST_PROGRAM_CONTRACT_HASH_V2,
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
    runtimeSource: z.object({
      schema: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA),
      logicalReceiptHash: Sha256Schema,
      sourceContentHash: Sha256Schema,
      runtimeProgramHash: Sha256Schema,
      runtimeProgramContractHash: z.literal(
        NODE_PRODUCT_RUNTIME_PROGRAM_CONTRACT_HASH_V2,
      ),
      behaviorContractHash: Sha256Schema,
    }).strict(),
    semanticRealizationPlan: z.object({
      schema: z.literal("setfarm.semantic-realization-plan.v2"),
      planHash: Sha256Schema,
      realizationMembershipHash: Sha256Schema,
      actionTestCount: z.number().int().positive().max(2_000),
      evidenceRelationCount: z.number().int().nonnegative().max(20_000),
    }).strict(),
    fileTree: z.object({
      schema: z.literal("setfarm.file-tree-manifest.v3"),
      manifestHash: Sha256Schema,
      testPathEntryHash: Sha256Schema,
      coverageMembershipHash: Sha256Schema,
    }).strict(),
    buildTopology: z.object({
      schema: z.literal("setfarm.build-topology.v3"),
      logicalBuildHash: Sha256Schema,
      compilationContractHash: Sha256Schema,
    }).strict(),
  }).strict(),
  source: TestSourceIdentityV2Schema,
  coverage: z.object({
    testCount: z.number().int().positive().max(2_000),
    actionTests: z.array(NodeProductActionTestBindingV2Schema).min(1).max(2_000),
    actionTestMembershipHash: Sha256Schema,
    coverageBindingCount: z.number().int().positive().max(20_000),
    coverageMembers: z.array(NodeProductTestCoverageMemberV2Schema)
      .min(1).max(20_000),
    fileTreeCoverageMembershipHash: Sha256Schema,
    generatedCoverageMembershipHash: Sha256Schema,
    behavior: z.object({
      contractHash: Sha256Schema,
      assertionBindingCount: z.number().int().nonnegative().max(20_000),
      assertionBindings: z.array(NodeProductBehaviorAssertionTestBindingV2Schema)
        .max(20_000),
      assertionMembershipHash: Sha256Schema,
      entityFieldBindingCount: z.number().int().nonnegative().max(20_000),
      entityFieldBindings: z.array(NodeProductEntityFieldTestBindingV2Schema)
        .max(20_000),
      entityFieldMembershipHash: Sha256Schema,
      checkpoints: z.object({
        initial: z.literal("fresh_runtime_instance_per_action_test"),
        afterAction: z.literal("target_and_prerequisite_invocations"),
        afterRehydration: z.literal(
          "not_applicable_selected_profiles_forbid_durable_rehydration",
        ),
      }).strict(),
    }).strict(),
    evidenceRelationCount: z.number().int().nonnegative().max(20_000),
    disposition: z.literal(
      "every_action_evidence_relation_runtime_assertion_and_entity_binding_has_exact_generated_test_source",
    ),
  }).strict(),
}).strict();

export type NodeProductTestSourceReceiptLogicalIdentityV2 = z.infer<
  typeof LogicalIdentityV2Schema
>;

export function hashNodeProductTestSourceLogicalReceiptV2(
  value:
    | NodeProductTestSourceReceiptLogicalIdentityV2
    | NodeProductTestSourceReceiptV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-test-source-logical-receipt-hash.v2",
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

const ReceiptHashPayloadV2Schema = LogicalIdentityV2Schema.extend({
  logicalReceiptHash: Sha256Schema,
  operationalEvidence: z.object({
    admissionScope: AdmissionScopeV2Schema,
    buildTopologyManifestHash: Sha256Schema,
    runtimeSourceReceiptHash: Sha256Schema,
    evidenceAuthority: z.literal(
      "authenticated_private_dependency_stage_and_fresh_runtime_source_v2",
    ),
  }).strict(),
}).strict();

export type NodeProductTestSourceReceiptHashPayloadV2 = z.infer<
  typeof ReceiptHashPayloadV2Schema
>;

export function hashNodeProductTestSourceReceiptV2(
  value:
    | NodeProductTestSourceReceiptHashPayloadV2
    | NodeProductTestSourceReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-product-test-source-receipt-hash.v2",
    receipt: payload,
  });
}

function coverageBindingFromMemberV2(
  member: NodeProductTestCoverageMemberV2,
): FileTreeTestCoverageBindingV3 {
  const {
    testRef: _testRef,
    coverageSymbolRef: _coverageSymbolRef,
    sourceSpan: _sourceSpan,
    ...binding
  } = member;
  return binding;
}

const ReceiptCandidateV2Schema = ReceiptHashPayloadV2Schema.extend({
  receiptHash: Sha256Schema,
}).strict();

export type NodeProductTestSourceReceiptV2 = z.infer<
  typeof ReceiptCandidateV2Schema
>;

export const NodeProductTestSourceReceiptV2Schema =
  ReceiptCandidateV2Schema.superRefine((value, context) => {
    const profile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
      (candidate) => candidate.profileId === value.authority.profileId,
    );
    const actionTests = value.coverage.actionTests;
    const members = value.coverage.coverageMembers;
    const assertionBindings = value.coverage.behavior.assertionBindings;
    const entityBindings = value.coverage.behavior.entityFieldBindings;
    const actionTestRefs = new Set(actionTests.map((binding) => binding.testRef));
    const actionMemberCount = members.filter((member) =>
      member.coverageKind === "action").length;
    const evidenceMemberCount = members.length - actionMemberCount;
    const memberKeys = members.map((member) =>
      `${member.coverageKind}\0${member.subjectRef}\0${member.realizationRef}`);
    const projectedCoverage = members.map(coverageBindingFromMemberV2);
    const actionOrder = actionTests.map((binding) => binding.actionRef);
    const assertionOrder = assertionBindings.map((binding) => binding.assertionRef);
    const entityOrder = entityBindings.map((binding) => binding.occurrenceRef);
    const listedEvidenceOrder = actionTests.flatMap((binding) =>
      binding.evidenceRefs).sort(compareUtf16);
    const memberEvidenceOrder = members.flatMap((member) =>
      member.coverageKind === "evidence_relation" ? [member.subjectRef] : [])
      .sort(compareUtf16);
    const listedAssertionOrder = actionTests.flatMap((binding) =>
      binding.behaviorAssertionRefs).sort(compareUtf16);
    const listedEntityOrder = actionTests.flatMap((binding) =>
      binding.entityFieldOccurrenceRefs).sort(compareUtf16);

    const invalid = (
      path: (string | number)[],
      message: string,
    ): void => context.addIssue({ code: "custom", path, message });

    if (
      !profile
      || profile.stackPackId !== value.authority.stackPackId
      || value.authority.generatorProfileHash
        !== hashNodeProductTestGeneratorProfileV2(profile)
      || value.source.pathRef !== profile.sourcePathRef
      || value.source.normalizedLocator !== profile.sourceNormalizedLocator
      || value.source.compiledPathRef !== profile.compiledPathRef
      || value.source.compiledNormalizedLocator !== profile.compiledNormalizedLocator
      || value.source.runtimeImportSpecifier !== profile.runtimeImportSpecifier
    ) {
      invalid(["source"], "Test source identity must equal the selected generator profile");
    }
    if (
      value.source.sourceIdentityHash
      !== hashNodeProductTestSourceIdentityV2(value.source)
      || members.some((member) =>
        member.sourceSpan.endByteExclusive > value.source.byteLength
        || member.sourceSpan.markerLine > value.source.lineCount)
    ) {
      invalid(["source"], "Test source identity and marker bounds must be exact");
    }
    if (
      value.authority.runtimeSource.behaviorContractHash
        !== value.authority.runtimeBehavior.contractHash
      || value.coverage.behavior.contractHash
        !== value.authority.runtimeBehavior.contractHash
    ) {
      invalid(
        ["authority", "runtimeBehavior"],
        "Runtime source, behavior authority and test coverage must share one contract",
      );
    }
    if (
      value.coverage.testCount !== actionTests.length
      || value.authority.semanticRealizationPlan.actionTestCount
        !== actionTests.length
      || !canonicalStrings(actionOrder)
      || !hasUniqueStrings(actionTests.map((binding) => binding.testRef))
      || value.coverage.actionTestMembershipHash
        !== hashNodeProductActionTestMembershipV2(actionTests)
    ) {
      invalid(["coverage", "actionTests"], "Action tests must be complete, canonical and hashed");
    }
    if (
      value.coverage.coverageBindingCount !== members.length
      || !canonicalStrings(memberKeys)
      || value.coverage.fileTreeCoverageMembershipHash
        !== hashFileTreeTestCoverageMembershipV3(projectedCoverage)
      || value.coverage.fileTreeCoverageMembershipHash
        !== value.authority.fileTree.coverageMembershipHash
      || value.coverage.generatedCoverageMembershipHash
        !== hashNodeProductTestCoverageMemberMembershipV2(members)
      || actionMemberCount !== actionTests.length
      || actionTests.some((test) => members.filter((member) =>
        member.coverageKind === "action"
        && member.testRef === test.testRef
        && member.subjectRef === test.actionRef).length !== 1)
      || evidenceMemberCount !== value.coverage.evidenceRelationCount
      || evidenceMemberCount
        !== value.authority.semanticRealizationPlan.evidenceRelationCount
      || !canonicalStrings(listedEvidenceOrder)
      || listedEvidenceOrder.length !== memberEvidenceOrder.length
      || listedEvidenceOrder.some((reference, index) =>
        reference !== memberEvidenceOrder[index])
    ) {
      invalid(["coverage", "coverageMembers"], "Coverage members must equal exact FileTree authority");
    }
    members.forEach((member, index) => {
      const test = actionTests.find((binding) => binding.testRef === member.testRef);
      if (
        !test
        || (
          member.coverageKind === "action"
          && member.subjectRef !== test.actionRef
        )
        || (
          member.coverageKind === "evidence_relation"
          && !test.evidenceRefs.includes(member.subjectRef)
        )
      ) {
        invalid(
          ["coverage", "coverageMembers", index],
          "Each semantic coverage member must join one exact action test",
        );
      }
    });
    if (
      value.coverage.behavior.assertionBindingCount !== assertionBindings.length
      || !canonicalStrings(assertionOrder)
      || assertionBindings.some((binding) => !actionTestRefs.has(binding.testRef))
      || assertionBindings.some((binding) => !actionTests.find((candidate) =>
        candidate.testRef === binding.testRef)?.behaviorAssertionRefs.includes(
        binding.assertionRef,
      ))
      || !canonicalStrings(listedAssertionOrder)
      || listedAssertionOrder.length !== assertionOrder.length
      || listedAssertionOrder.some((reference, index) =>
        reference !== assertionOrder[index])
      || value.coverage.behavior.assertionMembershipHash
        !== hashNodeProductBehaviorAssertionTestMembershipV2(assertionBindings)
    ) {
      invalid(
        ["coverage", "behavior", "assertionBindings"],
        "Runtime assertion test bindings must be complete, canonical and hashed",
      );
    }
    if (
      value.coverage.behavior.entityFieldBindingCount !== entityBindings.length
      || !canonicalStrings(entityOrder)
      || entityBindings.some((binding) => {
        const test = actionTests.find((candidate) =>
          candidate.testRef === binding.testRef);
        return !test
          || test.actionRef !== binding.actionRef
          || !test.entityFieldOccurrenceRefs.includes(binding.occurrenceRef);
      })
      || !canonicalStrings(listedEntityOrder)
      || listedEntityOrder.length !== entityOrder.length
      || listedEntityOrder.some((reference, index) => reference !== entityOrder[index])
      || value.coverage.behavior.entityFieldMembershipHash
        !== hashNodeProductEntityFieldTestMembershipV2(entityBindings)
    ) {
      invalid(
        ["coverage", "behavior", "entityFieldBindings"],
        "Entity snapshot test bindings must join their exact action test",
      );
    }
    if (
      value.logicalReceiptHash
        !== hashNodeProductTestSourceLogicalReceiptV2(value)
      || value.receiptHash !== hashNodeProductTestSourceReceiptV2(value)
    ) {
      invalid([], "Test source receipt hashes must bind exact logical and operational identity");
    }
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: NODE_PRODUCT_TEST_SOURCE_RECEIPT_MAX_CANONICAL_BYTES_V2,
        ...NODE_PRODUCT_TEST_SOURCE_RECEIPT_BOUNDED_WORK_LIMITS_V2,
      });
    } catch {
      invalid([], "Test source receipt exceeds canonical byte or work bounds");
    }
  });

export function recursivelyFreezeNodeProductTestSourceV2<T>(value: T): T {
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
